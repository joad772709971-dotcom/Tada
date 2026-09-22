import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  serverTimestamp, 
  increment, 
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { FinancialMath } from '../utils/financialMath';
import { LedgerEngine, LedgerEntry, TransactionPayload, CurrencyCode } from '../utils/LedgerValidation';

// =========================================================================
// INTERFACES & DOMAIN TYPES
// =========================================================================

export interface EmployeeCommissionProfile {
  employeeId: string;
  employeeName: string;
  commissionType: 'percentage' | 'flat';
  commissionValue: number; // e.g. 15 for 15% or 500 for YER 500 flat rate
  staffCreditAccountId: string; // "Pending Staff Credit Ledger" / ذمم وحسابات مستحقات الموظفين
  shopRevenueAccountId: string; // "Net Maintenance Profit" / إيرادات صيانة وتصليح
  advanceBal: number;          // Total current accrued advances/loans (سلف وقروض معلقة)
}

export interface ShiftSession {
  id?: string;
  employeeId: string;
  employeeName: string;
  cashDrawerId: string;        // Cash box ID linked to this active shift
  clockInTime: string;
  clockOutTime?: string;
  openingBalance: Record<CurrencyCode, number>; // opening balance validation checks
  closingBalance?: Record<CurrencyCode, number>; // target counted physical balance
  expectedBalance?: Record<CurrencyCode, number>; // book calculated balance
  reconciliationResult?: {
    status: 'perfect' | 'surplus' | 'deficit'; // مطابقة تماماً / زيادة / عجز
    discrepancy: Record<CurrencyCode, number>;
  };
  isActive: boolean;
}

export interface LeaveRecord {
  id?: string;
  employeeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  leaveType: 'vacation' | 'sick' | 'unpaid' | 'official_holiday';
  status: 'pending' | 'approved' | 'rejected';
  backupEmployeeId?: string; // Redirect tickets/maintenance orders here
}

export interface StoreSeasonalHours {
  id: string; // Date or override label e.g., "2026-03-24" (Ramadan Overrides)
  name: string;      // e.g. "Ramadan Hours / دوام شهر رمضان"
  openTime: string;  // "20:00"
  closeTime: string; // "02:00"
  isHoliday: boolean;
}

// =========================================================================
// MAIN SERVICE IMPLEMENTATION
// =========================================================================

export class WorkforceManagementService {

  // =========================================================================
  // 1. AUTOMATED COMMISSION KERNEL (نظام العمولات)
  // =========================================================================

  /**
   * Split maintenance or repair revenue in real-time securely:
   * - Technician's Cut goes to their designated "Pending Staff Credit Ledger Account"
   * - Shop's share goes to "Net Maintenance Profit Account"
   * - Adjusts the transaction automatically if employee has outstanding advance loans.
   */
  public static async executeRepairCommissionSplit(params: {
    repairOrderId: string,
    invoiceTotal: number,
    currency: CurrencyCode,
    employeeId: string,
    profile: EmployeeCommissionProfile,
    cashBoxAccount: string,
    operatorEmail: string
  }): Promise<{ success: boolean; message: string; transactionId?: string }> {

    const transactionId = `TXW-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Calculate the Split Cuts safely
    let technicianCut = 0;
    if (params.profile.commissionType === 'percentage') {
      const percentageDecimal = FinancialMath.divide(params.profile.commissionValue, 100);
      technicianCut = FinancialMath.multiply(params.invoiceTotal, percentageDecimal);
    } else {
      technicianCut = Math.min(params.profile.commissionValue, params.invoiceTotal);
    }

    const shopShare = FinancialMath.subtract(params.invoiceTotal, technicianCut);

    if (technicianCut < 0 || shopShare < 0) {
      throw new Error("قسمة الحصص غير صالحة ولا يمكن أن تكون قيم سالبة!");
    }

    // 2. Build direct double entry equation:
    // Debit cash box with full invoice total
    // Credit pending employee credit with their cut
    // Credit net maintenance profits with shop share
    const entries: LedgerEntry[] = [
      {
        accountId: params.cashBoxAccount, // Total Cash Received
        currency: params.currency,
        debit: params.invoiceTotal,
        credit: 0
      },
      {
        accountId: params.profile.staffCreditAccountId, // Credit technician account (we owe them)
        currency: params.currency,
        debit: 0,
        credit: technicianCut
      },
      {
        accountId: params.profile.shopRevenueAccountId, // Credit shop income
        currency: params.currency,
        debit: 0,
        credit: shopShare
      }
    ];

    const payload: TransactionPayload = {
      transactionId,
      timestamp: new Date().toISOString(),
      entries
    };

    // Validate the bookkeeping balancer
    const validation = LedgerEngine.validateAndCommit(payload);
    if (!validation.success) {
      return { success: false, message: validation.message };
    }

    try {
      const batch = writeBatch(db);

      // Check if employee has outstanding advance loans to deduct automatically
      let finalCommissionPaid = technicianCut;
      let loanDeducted = 0;

      if (params.profile.advanceBal > 0) {
        // We can deduct up to 50% of this commission to settle the advance, or the entire advance if very small
        loanDeducted = Math.min(params.profile.advanceBal, FinancialMath.multiply(technicianCut, 0.5));
        finalCommissionPaid = FinancialMath.subtract(technicianCut, loanDeducted);

        if (loanDeducted > 0) {
          // Generate a concurrent internal micro-ledger settlement to debit technician credit and credit advance recovery
          const loanTxId = `TXW-LN-${Date.now()}`;
          const loanLogRef = doc(collection(db, 'advance_loan_repayments'), loanTxId);
          batch.set(loanLogRef, {
            id: loanTxId,
            employeeId: params.employeeId,
            employeeName: params.profile.employeeName,
            repairOrderId: params.repairOrderId,
            repaidAmount: loanDeducted,
            currency: params.currency,
            createdAt: serverTimestamp()
          });

          // Update employee advance balance in their database record
          const empRef = doc(db, 'employees', params.employeeId);
          batch.update(empRef, {
            advanceBal: increment(-loanDeducted),
            updatedAt: serverTimestamp()
          });
        }
      }

      // Record Ledger Transaction Document
      const ledgerDocRef = doc(collection(db, 'ledger_transactions'), transactionId);
      batch.set(ledgerDocRef, {
        transactionId,
        ownerId: params.employeeId,
        debitAccount: params.cashBoxAccount,
        creditAccount: `${params.profile.staffCreditAccountId} & ${params.profile.shopRevenueAccountId}`,
        amount: params.invoiceTotal,
        currency: params.currency,
        narrative: `[توزيع عمولة الصيانة] معالجة الصيانة #${params.repairOrderId}. إجمالي الفاتورة: ${params.invoiceTotal} ${params.currency}. حصة الفني: ${technicianCut} (تم استقطاع ${loanDeducted} سلف معلقة)، حصة المتجر: ${shopShare}.`,
        module: 'workforce_commissions',
        referenceId: params.repairOrderId,
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      });

      // Update cash box balance accounts
      const cashRef = doc(db, 'accounts', params.cashBoxAccount);
      batch.update(cashRef, {
        balance: increment(params.invoiceTotal),
        updatedAt: serverTimestamp()
      });

      // Update staff credit card balance accounts
      const staffRef = doc(db, 'accounts', params.profile.staffCreditAccountId);
      batch.update(staffRef, {
        balance: increment(finalCommissionPaid), // Credited balance they can withdraw
        updatedAt: serverTimestamp()
      });

      // Record official logs
      const commLogRef = doc(collection(db, 'employee_commission_logs'));
      batch.set(commLogRef, {
        repairOrderId: params.repairOrderId,
        employeeId: params.employeeId,
        employeeName: params.profile.employeeName,
        totalInvoice: params.invoiceTotal,
        technicianCut,
        loanDeducted,
        netStaffCredited: finalCommissionPaid,
        shopShare,
        currency: params.currency,
        transactionId,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      return {
        success: true,
        message: `تم تقسيم قيد صيانة الجهاز بنجاه ورحلت العمولات وحسمت الاستقطاعات آلياً. ${validation.message}`,
        transactionId
      };

    } catch (error: any) {
      console.error("[خطأ في توزيع عمولة الصيانة B2B/员工]", error);
      return {
        success: false,
        message: `تعذر ترحيل قيد تقسيم عمولة الصيانة: ${error.message || error}`
      };
    }
  }

  // =========================================================================
  // 2. LOGICAL SHIFT & ATTENDANCE MATRIX (آلية الدوام والورديات)
  // =========================================================================

  /**
   * Logs local clock-in immutable event securely and binds user to a target Cash Drawer.
   */
  public static async clockInAndOpenDrawerShift(
    employeeId: string,
    employeeName: string,
    cashDrawerId: string,
    openingBalances: Record<CurrencyCode, number>
  ): Promise<string> {
    
    // First, verify that there is no unfinished or active shift for this drawer or user
    const q = query(
      collection(db, 'shift_sessions'),
      where('employeeId', '==', employeeId),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error("لا يمكن فتح الوردية! لديك وردية جارية معلقة بالفعل.");
    }

    const shiftRef = doc(collection(db, 'shift_sessions'));
    const payload: ShiftSession = {
      id: shiftRef.id,
      employeeId,
      employeeName,
      cashDrawerId,
      clockInTime: new Date().toISOString(),
      openingBalance: openingBalances,
      isActive: true
    };

    await setDoc(shiftRef, payload);
    console.log(`[آلية الوردية] تم تسجيل حضور الموظف ${employeeName} وتم استلام الصندوق الرقمي رقم ${cashDrawerId} ببدء التشغيل اليومي.`);
    return shiftRef.id;
  }

  /**
   * Clock out shift, execute EOD (End of Day) cash counting, and isolate Surplus or Deficits
   */
  public static async clockOutAndCloseShift(
    shiftId: string,
    physicalCashCounts: Record<CurrencyCode, number>,
    operatorEmail: string
  ): Promise<{ success: boolean; result: ShiftSession }> {
    
    const shiftRef = doc(db, 'shift_sessions', shiftId);
    const shiftSnap = await getDoc(shiftRef);

    if (!shiftSnap.exists()) {
      throw new Error("مستند الوردية المطلوب إقفاله غير موجود بالخادم!");
    }

    const currentShift = shiftSnap.data() as ShiftSession;
    if (!currentShift.isActive) {
      throw new Error("هذه الوردية مقفلة مسبقاً ولا يمكن إعادة إغلاقها مرة أخرى.");
    }

    // Initialize book expected calculation map
    const expectedCounts: Record<CurrencyCode, number> = { YER: 0, SAR: 0, USD: 0 };
    const discrepancy: Record<CurrencyCode, number> = { YER: 0, SAR: 0, USD: 0 };

    // Set starting balances
    for (const cur of ['YER', 'SAR', 'USD'] as CurrencyCode[]) {
      expectedCounts[cur] = currentShift.openingBalance[cur] || 0;
    }

    // Fetch all cash transactions logged under this drawer since clock-in
    const txQuery = query(
      collection(db, 'ledger_transactions'),
      where('referenceId', '>=', currentShift.clockInTime) // Simple local timestamp isolate
    );
    const txSnap = await getDocs(txQuery);

    txSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const cur = (data.currency || 'YER') as CurrencyCode;
      const amount = data.amount || 0;

      // If this cashbox was DEBITED, it means money was added to the box
      if (data.debitAccount === currentShift.cashDrawerId) {
        expectedCounts[cur] = FinancialMath.add(expectedCounts[cur], amount);
      }
      // If this cashbox was CREDITED, it means money was spent out of the box
      if (data.creditAccount === currentShift.cashDrawerId) {
        expectedCounts[cur] = FinancialMath.subtract(expectedCounts[cur], amount);
      }
    });

    let hasDifferences = false;
    let finalStatus: 'perfect' | 'surplus' | 'deficit' = 'perfect';

    for (const cur of ['YER', 'SAR', 'USD'] as CurrencyCode[]) {
      const physicalVal = physicalCashCounts[cur] || 0;
      const bookVal = expectedCounts[cur];
      const diff = FinancialMath.subtract(physicalVal, bookVal);
      discrepancy[cur] = diff;

      if (diff !== 0) {
        hasDifferences = true;
        if (diff > 0) finalStatus = 'surplus';
        else if (finalStatus !== 'surplus') finalStatus = 'deficit'; // deficit has final weight if mixed
      }
    }

    const batch = writeBatch(db);

    // If there is surplus or deficit, generate adjusting transactions inside the ledger account to reconcile
    if (hasDifferences) {
      for (const cur of ['YER', 'SAR', 'USD'] as CurrencyCode[]) {
        const diffVal = discrepancy[cur];
        if (diffVal === 0) continue;

        const adjTxId = `TXW-ADJ-${Date.now()}-${cur}`;
        const targetAdjAccount = diffVal > 0 ? "ACC-SHOP-REVENUES-SURPLUS-001" : "ACC-SHOP-EXPENSES-DEFICIT-001";
        const adjEntry: LedgerEntry[] = [
          {
            accountId: currentShift.cashDrawerId,
            currency: cur,
            debit: diffVal > 0 ? diffVal : 0,
            credit: diffVal < 0 ? Math.abs(diffVal) : 0
          },
          {
            accountId: targetAdjAccount,
            currency: cur,
            debit: diffVal < 0 ? Math.abs(diffVal) : 0,
            credit: diffVal > 0 ? diffVal : 0
          }
        ];

        const payload: TransactionPayload = {
          transactionId: adjTxId,
          timestamp: new Date().toISOString(),
          entries: adjEntry
        };

        const val = LedgerEngine.validateAndCommit(payload);
        if (val.success) {
          const adjDoc = doc(collection(db, 'ledger_transactions'), adjTxId);
          batch.set(adjDoc, {
            transactionId: adjTxId,
            ownerId: currentShift.employeeId,
            debitAccount: diffVal > 0 ? currentShift.cashDrawerId : targetAdjAccount,
            creditAccount: diffVal > 0 ? targetAdjAccount : currentShift.cashDrawerId,
            amount: Math.abs(diffVal),
            currency: cur,
            narrative: `[معاينة الجرد والتسوية والـ EOD] تم رصد فجوة مالية بقيمة ${diffVal} ${cur} ومطابقتها بالتسوية لخدمة عجز وزيادة وردية الموظف ${currentShift.employeeName}.`,
            module: 'workforce_recon',
            referenceId: shiftId,
            operatorEmail,
            timestamp: serverTimestamp()
          });

          // Adjust cashbox balance accounts to match physical count reality
          const cashboxAccountRef = doc(db, 'accounts', currentShift.cashDrawerId);
          batch.update(cashboxAccountRef, {
            balance: increment(diffVal),
            updatedAt: serverTimestamp()
          });
        }
      }
    }

    const closedShiftPayload: ShiftSession = {
      ...currentShift,
      clockOutTime: new Date().toISOString(),
      closingBalance: physicalCashCounts,
      expectedBalance: expectedCounts,
      reconciliationResult: {
        status: finalStatus,
        discrepancy
      },
      isActive: false
    };

    batch.set(shiftRef, closedShiftPayload);
    await batch.commit();

    console.warn(`[آلية الوردية] تم إقفال وردية الفني ${currentShift.employeeName} بنجاح. حالة الجرد المالي: ${finalStatus}.`);
    return { success: true, result: closedShiftPayload };
  }

  // =========================================================================
  // 3. HOLIDAY & SEASONAL SHIFT SCHEDULER (أوقات الدوام والإجازات الرسمية والأعياد)
  // =========================================================================

  /**
   * Saves or overrides seasonal timing details (e.g. late-night Ramadan shifts or Eid closures)
   */
  public static async saveSeasonalTimeOverrides(override: StoreSeasonalHours): Promise<void> {
    const overrideRef = doc(db, 'seasonal_operational_hours', override.id);
    await setDoc(overrideRef, {
      ...override,
      updatedAt: new Date().toISOString()
    });
    console.log(`[نظام الإجازات] تم حفظ الإعدادات والورديات الموسمية بنجاح للتاريخ والموسم: ${override.name}`);
  }

  /**
   * Request Leave record for worker, frozen computations redirect tickets automatically
   */
  public static async requestEmployeeLeave(leave: LeaveRecord): Promise<string> {
    const leaveRef = doc(collection(db, 'employee_leave_requests'));
    const payload = {
      ...leave,
      id: leaveRef.id,
      createdAt: new Date().toISOString()
    };
    await setDoc(leaveRef, payload);
    console.log(`[الدوام والإجازات] تم تقديم نموذج الإجازة الرسمية بنجاح وبانتظار الموافقة من المالك لضمان استقرار المهام.`);
    return leaveRef.id;
  }

  /**
   * Approves leave request, froze ticket routing for maintenance tasks smoothly
   */
  public static async approveLeaveAndSetBackup(leaveId: string, backupEmployeeId: string): Promise<void> {
    const leaveRef = doc(db, 'employee_leave_requests', leaveId);
    await updateDoc(leaveRef, {
      status: 'approved',
      backupEmployeeId,
      updatedAt: new Date().toISOString()
    });
    console.warn(`[نظام الإجازات] تم تأكيد ترحيل الموظف لإجازته الرسمية بنجاح، وتم تعيين الـ Backup ID: ${backupEmployeeId} لتلقي طلبات وفنيات الصيانة تجنباً للخلل.`);
  }

  /**
   * Safe getter to fetch currently active technician. If on leave, yields their assigned backup automatically.
   */
  public static async resolveActiveTechnicianForOrder(targetEmployeeId: string, currentDateStr: string): Promise<string> {
    try {
      // Query if this worker has approved leave for today
      const q = query(
        collection(db, 'employee_leave_requests'),
        where('employeeId', '==', targetEmployeeId),
        where('status', '==', 'approved')
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        for (const docSnap of snap.docs) {
          const leave = docSnap.data() as LeaveRecord;
          if (currentDateStr >= leave.startDate && currentDateStr <= leave.endDate) {
            if (leave.backupEmployeeId) {
              console.warn(`[تحويل آلي ذكي] الفني الأساسي في إجازة حالياً! تم توجيه ملفات الصيانة تلقائياً نحو الفني البديل: ${leave.backupEmployeeId}`);
              return leave.backupEmployeeId;
            }
          }
        }
      }
    } catch (err) {
      console.warn("[الإجازات والمطابقة] تعذر قراءة حظر الإجازات السحابية. يتم تعيين الفني الأساسي كافتراضي.");
    }
    return targetEmployeeId;
  }
}
