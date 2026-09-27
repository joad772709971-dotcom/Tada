import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  writeBatch, 
  increment,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { FinancialAuditLog, JournalEntry, CostCenter, BankReconciliation } from '../types';
import Big from 'big.js';
import { accountingService } from './accountingService';

export const financialAuditService = {
  /**
   * 1️⃣ Record a tamper-evident audit log in `financialAuditLogs` collection
   */
  async recordAudit(data: {
    ownerId: string;
    entityType: 'journal_entry' | 'account' | 'voucher' | 'bank_reconciliation' | 'cost_center' | 'system_closing';
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'APPROVE' | 'REJECT' | 'DELETE' | 'RECONCILE' | 'CLOSE_PERIOD';
    actionTitle: string;
    userId: string;
    userName: string;
    userRole?: string;
    details: string;
    beforeState?: any;
    afterState?: any;
    changesSummary?: string;
  }): Promise<string> {
    try {
      if (!data.ownerId) return '';
      const auditCol = collection(db, 'financialAuditLogs');
      const newDocRef = doc(auditCol);

      // Clean before/after state to avoid undefined properties breaking Firestore
      const sanitizeObj = (obj: any) => {
        if (!obj) return null;
        try {
          return JSON.parse(JSON.stringify(obj));
        } catch {
          return null;
        }
      };

      const auditRecord = {
        ownerId: data.ownerId,
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        actionTitle: data.actionTitle,
        userId: data.userId || 'system',
        userName: data.userName || 'مستخدم النظام',
        userRole: data.userRole || 'مشرف',
        details: data.details || '',
        beforeState: sanitizeObj(data.beforeState),
        afterState: sanitizeObj(data.afterState),
        changesSummary: data.changesSummary || '',
        timestamp: serverTimestamp()
      };

      await setDoc(newDocRef, auditRecord);
      return newDocRef.id;
    } catch (err) {
      console.warn("⚠️ Financial Audit Logging error:", err);
      return '';
    }
  },

  /**
   * 2️⃣ Approve a pending journal voucher (اعتماد وترحيل القيد)
   * This applies the financial shift to accounts and updates the voucher status to 'approved'
   */
  async approveJournalEntry(
    ownerId: string, 
    entryId: string, 
    operator: { uid?: string; name?: string; role?: string }
  ): Promise<{ success: boolean; message: string }> {
    if (!ownerId || !entryId) throw new Error("بيانات المالك أو معرف القيد غير مكتملة.");

    const entryRef = doc(db, 'journalEntries', entryId);
    const entrySnap = await getDoc(entryRef);
    if (!entrySnap.exists()) {
      throw new Error("سند القيد المحاسبي غير موجود في قواعد البيانات.");
    }

    const entryData = entrySnap.data() as JournalEntry;
    if (entryData.status === 'approved') {
      return { success: true, message: "القيد معتمد ومرحل بالفعل مسبقاً." };
    }

    // Verify balance
    let totalDebit = new Big(0);
    let totalCredit = new Big(0);
    for (const item of (entryData.items || [])) {
      totalDebit = totalDebit.plus(item.debit || 0);
      totalCredit = totalCredit.plus(item.credit || 0);
    }

    if (!totalDebit.eq(totalCredit) || totalDebit.lte(0)) {
      throw new Error(`لا يمكن اعتماد قيد غير متوازن! المدين: ${totalDebit.toString()} ر.ي، الدائن: ${totalCredit.toString()} ر.ي`);
    }

    const batch = writeBatch(db);

    // 1. Update entry status
    batch.update(entryRef, {
      status: 'approved',
      approvedBy: {
        uid: operator.uid || 'admin',
        name: operator.name || 'المشرف المعتمد',
        role: operator.role || 'مدير مالي',
        at: new Date().toISOString()
      },
      approvedAt: serverTimestamp()
    });

    // 2. Post balance shifts to accounts
    for (const item of (entryData.items || [])) {
      if (!item.accountId) continue;
      const accRef = doc(db, 'accounts', item.accountId);
      const shift = Number(item.debit || 0) - Number(item.credit || 0);
      
      batch.set(accRef, {
        balance: increment(shift)
      }, { merge: true });

      // Sync vault balance if applicable
      accountingService.syncVaultBalance(ownerId, item.accountName, shift);
    }

    await batch.commit();

    // 3. Record Audit Log
    await this.recordAudit({
      ownerId,
      entityType: 'journal_entry',
      entityId: entryId,
      action: 'APPROVE',
      actionTitle: `اعتماد وترحيل سند قيد #${entryData.reference || entryId.slice(-6)}`,
      userId: operator.uid || 'admin',
      userName: operator.name || 'المشرف',
      userRole: operator.role || 'مدير مالي',
      details: `تم اعتماد وترحيل القيد وتحديث أرصدة الحسابات بإجمالي ${totalDebit.toString()} ر.ي. البيان: ${entryData.description}`,
      beforeState: { status: entryData.status || 'pending_approval' },
      afterState: { status: 'approved', approvedBy: operator.name }
    });

    return { success: true, message: "تم بنجاح اعتماد وترحيل القيد وتحديث شجرة الحسابات والدفاتر المالية!" };
  },

  /**
   * 3️⃣ Reject / Cancel a pending journal voucher (إلغاء ورفض القيد)
   */
  async rejectJournalEntry(
    ownerId: string,
    entryId: string,
    reason: string,
    operator: { uid?: string; name?: string; role?: string }
  ): Promise<{ success: boolean; message: string }> {
    if (!ownerId || !entryId) throw new Error("بيانات المالك أو معرف القيد غير مكتملة.");

    const entryRef = doc(db, 'journalEntries', entryId);
    const entrySnap = await getDoc(entryRef);
    if (!entrySnap.exists()) {
      throw new Error("سند القيد المحاسبي غير موجود.");
    }

    const entryData = entrySnap.data() as JournalEntry;
    if (entryData.status === 'approved') {
      throw new Error("لا يمكن إلغاء قيد معتمد ومرحل مباشرة، يجب إنشاء قيد تسوية عكسي لضمان سلامة الدفاتر.");
    }

    await setDoc(entryRef, {
      status: 'rejected',
      rejectedReason: reason || 'تم الرفض بواسطة الإدارة المالية',
      rejectedBy: {
        uid: operator.uid || 'admin',
        name: operator.name || 'المشرف',
        role: operator.role || 'مشرف',
        reason: reason || 'مرفوض',
        at: new Date().toISOString()
      }
    }, { merge: true });

    // Record Audit Log
    await this.recordAudit({
      ownerId,
      entityType: 'journal_entry',
      entityId: entryId,
      action: 'REJECT',
      actionTitle: `رفض وإلغاء سند قيد #${entryData.reference || entryId.slice(-6)}`,
      userId: operator.uid || 'admin',
      userName: operator.name || 'المشرف',
      userRole: operator.role || 'مشرف',
      details: `تم رفض القيد بالسبب: ${reason || 'لا يوجد سبب محدد'}`,
      beforeState: { status: entryData.status },
      afterState: { status: 'rejected', reason }
    });

    return { success: true, message: "تم إلغاء سند القيد وتوثيق العملية في سجل الرقابة والتدقيق." };
  },

  /**
   * 4️⃣ Manage Cost Centers (مراكز التكلفة)
   */
  async getCostCenters(ownerId: string): Promise<CostCenter[]> {
    if (!ownerId) return [];
    try {
      const q = query(
        collection(db, 'costCenters'),
        where('ownerId', '==', ownerId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as CostCenter));
    } catch (err) {
      console.warn("Cost centers fetch error:", err);
      return [];
    }
  },

  async addCostCenter(ownerId: string, centerData: {
    code: string;
    name: string;
    type: 'branch' | 'department' | 'project';
    manager?: string;
    budget?: number;
    notes?: string;
    operator?: { uid?: string; name?: string; role?: string };
  }): Promise<string> {
    if (!ownerId) throw new Error("معرف المالك مطلوب.");
    const colRef = collection(db, 'costCenters');
    const newDoc = doc(colRef);

    const record: Omit<CostCenter, 'id'> = {
      ownerId,
      code: centerData.code || `CC-${Date.now().toString().slice(-4)}`,
      name: centerData.name,
      type: centerData.type || 'department',
      manager: centerData.manager || '',
      budget: Number(centerData.budget || 0),
      active: true,
      notes: centerData.notes || '',
      createdAt: serverTimestamp()
    };

    await setDoc(newDoc, record);

    // Record Audit Log
    await this.recordAudit({
      ownerId,
      entityType: 'cost_center',
      entityId: newDoc.id,
      action: 'CREATE',
      actionTitle: `إضافة مركز كلفة جديد: ${centerData.name} (${record.code})`,
      userId: centerData.operator?.uid || 'admin',
      userName: centerData.operator?.name || 'المشرف',
      userRole: centerData.operator?.role || 'إدارة',
      details: `تم تعريف مركز تكلفة جديد بنوع: ${centerData.type} وميزانية: ${centerData.budget || 0} ر.ي`,
      afterState: record
    });

    return newDoc.id;
  },

  async deleteCostCenter(ownerId: string, centerId: string, centerName: string, operator?: { uid?: string; name?: string }): Promise<void> {
    if (!ownerId || !centerId) return;
    const ref = doc(db, 'costCenters', centerId);
    await setDoc(ref, { active: false }, { merge: true });

    await this.recordAudit({
      ownerId,
      entityType: 'cost_center',
      entityId: centerId,
      action: 'DELETE',
      actionTitle: `تعطيل وإلغاء مركز الكلفة: ${centerName}`,
      userId: operator?.uid || 'admin',
      userName: operator?.name || 'المشرف',
      details: `تم تعطيل مركز التكلفة ${centerName}`
    });
  },

  /**
   * 5️⃣ Save Bank Reconciliation (تسوية ومطابقة الحساب البنكي)
   */
  async saveBankReconciliation(
    ownerId: string,
    data: {
      accountId: string;
      accountName: string;
      statementDate: string;
      statementBalance: number;
      bookBalance: number;
      reconciledBalance: number;
      difference: number;
      matchedEntryIds: string[];
      unclearedDeposits: number;
      unclearedWithdrawals: number;
      notes?: string;
      status: 'completed' | 'draft';
      operator?: { uid?: string; name?: string; role?: string };
    }
  ): Promise<string> {
    if (!ownerId) throw new Error("معرف المالك مطلوب.");

    const colRef = collection(db, 'bankReconciliations');
    const newDoc = doc(colRef);

    const record = {
      ownerId,
      accountId: data.accountId,
      accountName: data.accountName,
      statementDate: data.statementDate,
      statementBalance: Number(data.statementBalance || 0),
      bookBalance: Number(data.bookBalance || 0),
      reconciledBalance: Number(data.reconciledBalance || 0),
      difference: Number(data.difference || 0),
      status: data.status,
      matchedEntryIds: data.matchedEntryIds || [],
      unclearedDeposits: Number(data.unclearedDeposits || 0),
      unclearedWithdrawals: Number(data.unclearedWithdrawals || 0),
      notes: data.notes || '',
      createdAt: serverTimestamp(),
      createdBy: {
        uid: data.operator?.uid || 'admin',
        name: data.operator?.name || 'المشرف المحاسبي',
        role: data.operator?.role || 'محاسب'
      }
    };

    const batch = writeBatch(db);
    batch.set(newDoc, record);

    // If completed, update items in matchedEntryIds to mark them reconciled
    if (data.status === 'completed' && data.matchedEntryIds.length > 0) {
      for (const entryId of data.matchedEntryIds) {
        const eRef = doc(db, 'journalEntries', entryId);
        batch.set(eRef, {
          reconciled: true,
          reconciledAt: serverTimestamp(),
          reconciliationId: newDoc.id
        }, { merge: true });
      }
    }

    await batch.commit();

    // Record Audit Log
    await this.recordAudit({
      ownerId,
      entityType: 'bank_reconciliation',
      entityId: newDoc.id,
      action: 'RECONCILE',
      actionTitle: `إتمام مذكرة تسوية بنكية للحساب: ${data.accountName}`,
      userId: data.operator?.uid || 'admin',
      userName: data.operator?.name || 'المحاسب',
      userRole: data.operator?.role || 'محاسب',
      details: `تمت التسوية البنكية لتاريخ ${data.statementDate} - رصيد الكشف: ${data.statementBalance} - رصيد الدفاتر: ${data.bookBalance} - الفارق: ${data.difference} ر.ي - عدد الحركات المطابقة: ${data.matchedEntryIds.length}`,
      afterState: record
    });

    return newDoc.id;
  }
};
