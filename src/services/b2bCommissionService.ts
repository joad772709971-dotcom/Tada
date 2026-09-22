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
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { FinancialMath } from '../utils/financialMath';
import { LedgerEngine, LedgerEntry, TransactionPayload, CurrencyCode } from '../utils/LedgerValidation';

// Interface Definitions for Commission Engine Records
export interface CommissionTargetTier {
  targetSpent: number;      // Target procurement spending threshold (e.g. 100,000 USD)
  rebatePercent: number;    // Retroactive discount % (e.g., 2% for reaching tier)
  rebateCashBack: number;   // Or fixed callback amount (e.g., 2000 USD)
}

export interface SupplierContract {
  supplierId: string;
  supplierName: string;
  supplierPayableAccountId: string; // "Supplier's Payable Account" / ذمم وأرصدة الموردين الدائنة
  supplierCurrentAccountId: string; // "Supplier's Current Account" / الحساب الجاري للمورد
  commissionIncomeAccountId: string; // "Commercial Commission Income Account" / إيرادات عمولات تجارية
  consignmentProfitAccountId: string; // "Consignment Sales Profit Account" / أرباح مبيعات بضائع الأمانة
  wholesaleDiscountAccountId: string; // "Earned Wholesale Discounts" / خصم مكتسب وعمولات التخفيض
  currency: CurrencyCode;
  targetTiers: CommissionTargetTier[];
}

export interface ConsignmentItem {
  id?: string;
  itemId: string;
  name: string;
  supplierId: string;
  originalCost: number;       // Cost payable to supplier upon sales
  recommendSalePrice: number; // Set retail suggest price
  stock: number;
  warehouseId: string;        // Must be "Makhzan_AlAmanah" for safety stock matrix
  isConsignment: boolean;     // Excluded from core asset models
}

export class B2bCommissionService {

  // =========================================================================
  // 1. B2B BROKERAGE & MEDIATION LEDGER (عمولة السعي والوساطة)
  // =========================================================================

  /**
   * Automatically executes a double-entry transaction via 'LedgerEngine':
   * - Debit: "Supplier's Current Account" (جاري المورد)
   * - Credit: "Commercial Commission Income Account" (إيرادات عمولات تجارية)
   * perfectly balancing across multiple currencies (YER, SAR, USD).
   */
  public static async executeMediationCommission(params: {
    brokerageId: string,
    supplierId: string,
    supplierName: string,
    commissionAmount: number,
    currency: CurrencyCode,
    supplierCurrentAccount: string,
    commercialCommissionIncomeAccount: string,
    narrative: string,
    operatorEmail: string
  }): Promise<{ success: boolean; message: string; transactionId?: string }> {
    
    const transactionId = `TXB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Build the Double-Entry Ledger Transaction Entries
    const entries: LedgerEntry[] = [
      {
        accountId: params.supplierCurrentAccount, // Giver of debt/liability or directly debited (Supplier Current Account)
        currency: params.currency,
        debit: params.commissionAmount,
        credit: 0
      },
      {
        accountId: params.commercialCommissionIncomeAccount, // Commercial Commission Income (Credit Increases Equity/Revenue)
        currency: params.currency,
        debit: 0,
        credit: params.commissionAmount
      }
    ];

    const payload: TransactionPayload = {
      transactionId,
      timestamp: new Date().toISOString(),
      entries
    };

    // 1. Validate Balance Absolute Rule (Debit === Credit) using LedgerEngine
    const validation = LedgerEngine.validateAndCommit(payload);
    if (!validation.success) {
      return { success: false, message: validation.message };
    }

    try {
      const batch = writeBatch(db);

      // Save real-time system ledger journal entry
      const ledgerColRef = doc(collection(db, 'ledger_transactions'), transactionId);
      batch.set(ledgerColRef, {
        transactionId,
        ownerId: params.supplierId,
        debitAccount: params.supplierCurrentAccount,
        creditAccount: params.commercialCommissionIncomeAccount,
        amount: params.commissionAmount,
        currency: params.currency,
        narrative: `[عمولة وساطة B2B] ${params.narrative}`,
        module: 'wholesale_commission',
        referenceId: params.brokerageId,
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      });

      // Update Supplier's Current Account Balance (We debit their account, meaning they owe us commission)
      const supplierAccRef = doc(db, 'accounts', params.supplierCurrentAccount);
      const accSnap = await getDoc(supplierAccRef);
      if (accSnap.exists()) {
        batch.update(supplierAccRef, {
          balance: increment(-params.commissionAmount), // reduces balance owed to them or raises receivable
          updatedAt: serverTimestamp()
        });
      } else {
        // Initialize if first time
        batch.set(supplierAccRef, {
          id: params.supplierCurrentAccount,
          ownerId: params.supplierId,
          accountName: `جاري المورد - ${params.supplierName}`,
          balance: -params.commissionAmount,
          currency: params.currency,
          createdAt: serverTimestamp()
        });
      }

      // Record specialized commission log entries
      const b2bCommissionCol = doc(collection(db, 'b2b_mediation_commissions'));
      batch.set(b2bCommissionCol, {
        brokerageId: params.brokerageId,
        transactionId,
        supplierId: params.supplierId,
        supplierName: params.supplierName,
        amount: params.commissionAmount,
        currency: params.currency,
        operatorEmail: params.operatorEmail,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      return { 
        success: true, 
        message: `تم قيد عمولة الوساطة بنجاح بقيمة ${params.commissionAmount} ${params.currency}. ${validation.message}`,
        transactionId 
      };

    } catch (error: any) {
      console.error("[خطأ في الوساطة B2B]", error);
      return { 
        success: false, 
        message: `تعذر ترحيل قيد عمولة الوساطة محاسبياً: ${error.message || error}` 
      };
    }
  }

  // =========================================================================
  // 2. CONSIGNMENT & SAFETY STOCK MATRIX (البضاعة برسم التصريف)
  // =========================================================================

  /**
   * Registers a consignment item inside the "Makhzan Boda'at Al-Amanah" isolation system.
   */
  public static async registerConsignmentItem(item: ConsignmentItem): Promise<string> {
    const consignmentRef = doc(collection(db, 'consignment_inventory'));
    const payload = {
      ...item,
      id: consignmentRef.id,
      warehouseId: 'Makhzan_AlAmanah', // Virtual warehouse isolation tag
      isConsignment: true,             // Excluded from standard inventory asset computations
      createdAt: new Date().toISOString()
    };
    await setDoc(consignmentRef, payload);
    console.log(`[نظام الأمانة] تم تسجيل صنف برسم التصريف برقم ${consignmentRef.id} في مخزن الأمانة.`);
    return consignmentRef.id;
  }

  /**
   * Sell a Consignment Item: Spawns an automated split transaction:
   * - Credit core cost to Supplier's Payable Ledger
   * - Credit percentage commission margin directly to Consignment Sales Profit Account
   * - Debit Cash Account/Box for Sales Total
   */
  public static async sellConsignmentItem(params: {
    consignmentDocId: string,
    quantitySold: number,
    salePrice: number,
    originalCost: number,
    currency: CurrencyCode,
    supplierPayableAccount: string, // ACC_SUPPLIER_PAYABLE_XXX
    consignmentProfitAccount: string, // ACC_CONSIGNMENT_SALES_PROFIT_XXX
    cashBoxAccount: string,          // ACC_CASH_BOX_XXX
    supplierId: string,
    supplierName: string,
    operatorEmail: string
  }): Promise<{ success: boolean; message: string; transactionId?: string }> {

    const costOfGoods = FinancialMath.multiply(params.quantitySold, params.originalCost);
    const revenueOfGoods = FinancialMath.multiply(params.quantitySold, params.salePrice);
    const profitMargin = FinancialMath.subtract(revenueOfGoods, costOfGoods);

    if (profitMargin < 0) {
      throw new Error("سعر البيع لا يمكن أن يكون أقل من التكلفة الأصلية للبضاعة برسم التصريف!");
    }

    const transactionId = `TXC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Double Entry split payload
    // Debit (Recipient of Asset) must equal Credits
    const entries: LedgerEntry[] = [
      {
        accountId: params.cashBoxAccount, // Received cash from retail customer total (Debit)
        currency: params.currency,
        debit: revenueOfGoods,
        credit: 0
      },
      {
        accountId: params.supplierPayableAccount, // Cost goes to credit our liability to supplier (Credit)
        currency: params.currency,
        debit: 0,
        credit: costOfGoods
      },
      {
        accountId: params.consignmentProfitAccount, // Store profit goes to consignment profit account (Credit)
        currency: params.currency,
        debit: 0,
        credit: profitMargin
      }
    ];

    const payload: TransactionPayload = {
      transactionId,
      timestamp: new Date().toISOString(),
      entries
    };

    // Validate the core double-entry equation: Debits (revenueOfGoods) === Credits (costOfGoods + profitMargin)
    const validation = LedgerEngine.validateAndCommit(payload);
    if (!validation.success) {
      return { success: false, message: validation.message };
    }

    try {
      const batch = writeBatch(db);

      // Deduct item stock from virtual warehouse "consignment_inventory"
      const itemRef = doc(db, 'consignment_inventory', params.consignmentDocId);
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        const currentStock = itemSnap.data().stock || 0;
        if (currentStock < params.quantitySold) {
          throw new Error(`مخزون الأمانة غير كافٍ! المتبقي: ${currentStock} والمطلوب بيعه: ${params.quantitySold}`);
        }
        batch.update(itemRef, {
          stock: increment(-params.quantitySold),
          updatedAt: serverTimestamp()
        });
      }

      // Publish Ledger Transaction
      const ledgerColRef = doc(collection(db, 'ledger_transactions'), transactionId);
      batch.set(ledgerColRef, {
        transactionId,
        ownerId: params.supplierId,
        debitAccount: params.cashBoxAccount,
        creditAccount: `${params.supplierPayableAccount} & ${params.consignmentProfitAccount}`,
        amount: revenueOfGoods,
        currency: params.currency,
        narrative: `[بيع بضاعة أمانة] صرف ${params.quantitySold} وحدة من بضاعة الأمانة. التكلفة للمورد: ${costOfGoods}، عمولة التصريف للمحل: ${profitMargin}.`,
        module: 'wholesale_commission',
        referenceId: params.consignmentDocId,
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      });

      // Update Supplier's Payable Account Balance (we owe them the core cost)
      const supplierPayRef = doc(db, 'accounts', params.supplierPayableAccount);
      const paySnap = await getDoc(supplierPayRef);
      if (paySnap.exists()) {
        batch.update(supplierPayRef, {
          balance: increment(costOfGoods), // Increases the liability/payable balance we owe to the supplier
          updatedAt: serverTimestamp()
        });
      }

      // Update Cashbox Account Balance (increases by retail total cash)
      const cashboxRef = doc(db, 'accounts', params.cashBoxAccount);
      const cashSnap = await getDoc(cashboxRef);
      if (cashSnap.exists()) {
        batch.update(cashboxRef, {
          balance: increment(revenueOfGoods),
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      return { 
        success: true, 
        message: `تم بيع بضاعة الأمانة وتقسيم القيد آلياً بنجاح. تم ترحيل ${costOfGoods} ${params.currency} لحساب المورد و ${profitMargin} ${params.currency} لعمولة المحل.`,
        transactionId 
      };

    } catch (error: any) {
      console.error("[خطأ في بيع بضاعة أمانة]", error);
      return { 
        success: false, 
        message: `فشل قيد تصريف بضائع الأمانة: ${error.message || error}` 
      };
    }
  }

  // =========================================================================
  // 3. ACCRUED REBATES & RETROACTIVE TARGET TARGETING (عمولات التخفيض وفارق السعر)
  // =========================================================================

  /**
   * Tracks procurement volumes against specific dynamic supplier target tiers.
   * If breached, automatically post retroactive discount adjustment note:
   * - Debit: "Supplier's Payable Account" / ذمم وأرصدة الموردين الدائنة (reduces what we owe them)
   * - Credit: "Earned Wholesale Discounts" (خصم مكتسب / عمولات التخفيض)
   */
  public static async evaluateAndTriggerRetroactiveRebates(params: {
    supplierId: string,
    contract: SupplierContract,
    operatorEmail: string
  }): Promise<{ success: boolean; triggeredRebates: any[] }> {
    
    // 1. Fetch all completed wholesale orders we bought from this supplier to calculate cumulative volume
    const ordersQuery = query(
      collection(db, 'orders'),
      where('wholesalerId', '==', params.supplierId),
      where('status', '==', 'received') // strictly completed/received goods
    );
    const ordersSnap = await getDocs(ordersQuery);
    
    let totalPurchasedVolume = 0;
    ordersSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      totalPurchasedVolume = FinancialMath.add(totalPurchasedVolume, data.total || 0);
    });

    // 2. Fetch already triggered target settlements to avoid double-charging
    const settlementsQuery = query(
      collection(db, 'accrued_rebates_settlements'),
      where('supplierId', '==', params.supplierId)
    );
    const settlementsSnap = await getDocs(settlementsQuery);
    const settledThresholds = new Set<number>();
    settlementsSnap.docs.forEach(docSnap => {
      settledThresholds.add(docSnap.data().targetLimit);
    });

    const triggeredRebates: any[] = [];

    // Sort tiers by spent target ascending
    const sortedTiers = [...params.contract.targetTiers].sort((a,b) => a.targetSpent - b.targetSpent);

    for (const tier of sortedTiers) {
      if (totalPurchasedVolume >= tier.targetSpent && !settledThresholds.has(tier.targetSpent)) {
        
        // Calculate accrued rebate total
        let rebateAmount = 0;
        if (tier.rebatePercent > 0) {
          rebateAmount = FinancialMath.multiply(totalPurchasedVolume, tier.rebatePercent / 100);
        } else {
          rebateAmount = tier.rebateCashBack;
        }

        if (rebateAmount <= 0) continue;

        const transactionId = `TXR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Build adjustment journal:
        // Debit (reduces supplier payable/liability)
        // Credit (accrues wholesale discount revenue/savings Asset)
        const entries: LedgerEntry[] = [
          {
            accountId: params.contract.supplierPayableAccountId,
            currency: params.contract.currency,
            debit: rebateAmount,
            credit: 0
          },
          {
            accountId: params.contract.wholesaleDiscountAccountId,
            currency: params.contract.currency,
            debit: 0,
            credit: rebateAmount
          }
        ];

        const payload: TransactionPayload = {
          transactionId,
          timestamp: new Date().toISOString(),
          entries
        };

        const validation = LedgerEngine.validateAndCommit(payload);
        if (validation.success) {
          const batch = writeBatch(db);

          // Save tracking documentation
          const trackingDocRef = doc(collection(db, 'accrued_rebates_settlements'));
          batch.set(trackingDocRef, {
            supplierId: params.supplierId,
            supplierName: params.contract.supplierName,
            targetLimit: tier.targetSpent,
            volumeReached: totalPurchasedVolume,
            rebateValue: rebateAmount,
            currency: params.contract.currency,
            transactionId,
            operatorEmail: params.operatorEmail,
            createdAt: serverTimestamp()
          });

          // Write ledger trans
          const ledgerDocRef = doc(collection(db, 'ledger_transactions'), transactionId);
          batch.set(ledgerDocRef, {
            transactionId,
            ownerId: params.supplierId,
            debitAccount: params.contract.supplierPayableAccountId,
            creditAccount: params.contract.wholesaleDiscountAccountId,
            amount: rebateAmount,
            currency: params.contract.currency,
            narrative: `[عمولة تسوية التخفيض] ترقية الأهداف السنوية للمورد وتحصيل رصيد تخفيض راجع بقيمة ${rebateAmount} ${params.contract.currency} بموجب تخطي المبيعات الكلية حاجز ${tier.targetSpent}.`,
            module: 'wholesale_commission',
            referenceId: transactionId,
            operatorEmail: params.operatorEmail,
            timestamp: serverTimestamp()
          });

          // Decrement supplier payable balance (reduces what we owe)
          const supplierPayAccRef = doc(db, 'accounts', params.contract.supplierPayableAccountId);
          batch.update(supplierPayAccRef, {
            balance: increment(-rebateAmount),
            updatedAt: serverTimestamp()
          });

          await batch.commit();
          triggeredRebates.push({
            targetLimit: tier.targetSpent,
            rebateAmount,
            transactionId
          });
          console.warn(`[الأهداف الشرائية] تم تحشيد وحصد خصم مكتسب مسترجع بقيمة ${rebateAmount} لكسر سقف المشتريات المحددة.`);
        }
      }
    }

    return { 
      success: triggeredRebates.length > 0, 
      triggeredRebates 
    };
  }

  // =========================================================================
  // 4. AUTOMATED RETURN OFFSETS & LIABILITIES (إلغاء وعكس عمولة المرتجع)
  // =========================================================================

  /**
   * If a wholesale order that previously accrued commercial commission is returned completely or partially,
   * calculate exact returned commission via FinancialMath and post instant reverse entries.
   * - Debit: "Commercial Commission Income Account" (إيرادات عمولات تجارية)
   * - Credit: "Supplier's Current Account" (جاري المورد)
   */
  public static async reverseB2BCommissionOnReturn(params: {
    originalOrderId: string,
    returnId: string,
    returnedItems: { productId: string; quantityReturned: number; itemOriginalPrice: number }[],
    originalCommissionRate: number, // percentage (e.g. 5 for 5% commission)
    contract: SupplierContract,
    operatorEmail: string
  }): Promise<{ success: boolean; reversedAmount: number; transactionId?: string }> {

    let totalReturnedSum = 0;
    params.returnedItems.forEach(i => {
      const lineCost = FinancialMath.multiply(i.quantityReturned, i.itemOriginalPrice);
      totalReturnedSum = FinancialMath.add(totalReturnedSum, lineCost);
    });

    // Reversed commission = (Total Returned Sum * Commission Rate / 100)
    const reversedCommissionAmount = FinancialMath.multiply(totalReturnedSum, params.originalCommissionRate / 100);

    if (reversedCommissionAmount <= 0) {
      return { success: false, reversedAmount: 0 };
    }

    const transactionId = `TXR-REV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Debit commission income (decreases income)
    // Credit supplier current account (reverts debit, giving back supplier balance value)
    const entries: LedgerEntry[] = [
      {
        accountId: params.contract.commissionIncomeAccountId, // Debit reduces commission revenues
        currency: params.contract.currency,
        debit: reversedCommissionAmount,
        credit: 0
      },
      {
        accountId: params.contract.supplierCurrentAccountId, // Credit reduces what they owe or gives back
        currency: params.contract.currency,
        debit: 0,
        credit: reversedCommissionAmount
      }
    ];

    const payload: TransactionPayload = {
      transactionId,
      timestamp: new Date().toISOString(),
      entries
    };

    const validation = LedgerEngine.validateAndCommit(payload);
    if (!validation.success) {
      throw new Error(`تعذر عكس القيد لتطابق الأرصدة: ${validation.message}`);
    }

    try {
      const batch = writeBatch(db);

      // Save reverse transaction
      const ledgerDocRef = doc(collection(db, 'ledger_transactions'), transactionId);
      batch.set(ledgerDocRef, {
        transactionId,
        ownerId: params.contract.supplierId,
        debitAccount: params.contract.commissionIncomeAccountId,
        creditAccount: params.contract.supplierCurrentAccountId,
        amount: reversedCommissionAmount,
        currency: params.contract.currency,
        narrative: `[عكس عمولة المرتجع] استرداد وعكس عمولة المبيعات للمرتجع #${params.returnId} للفاتورة #${params.originalOrderId.slice(-6)}. تم تعديل الفائض بقيمة ${reversedCommissionAmount} ${params.contract.currency}.`,
        module: 'wholesale_commission',
        referenceId: params.returnId,
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      });

      // Update accounts: Debit commission revenues / Credit supplier current account
      const commissionAccRef = doc(db, 'accounts', params.contract.commissionIncomeAccountId);
      batch.update(commissionAccRef, {
        balance: increment(-reversedCommissionAmount),
        updatedAt: serverTimestamp()
      });

      const supplierAccRef = doc(db, 'accounts', params.contract.supplierCurrentAccountId);
      batch.update(supplierAccRef, {
        balance: increment(reversedCommissionAmount), // restores their current balance credit limit
        updatedAt: serverTimestamp()
      });

      // Record specialized logs to return collection
      const returnOffsetRef = doc(collection(db, 'b2b_return_commission_reversals'));
      batch.set(returnOffsetRef, {
        originalOrderId: params.originalOrderId,
        returnId: params.returnId,
        totalReturnedSum,
        reversedCommissionAmount,
        currency: params.contract.currency,
        transactionId,
        operatorEmail: params.operatorEmail,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      return { 
        success: true, 
        reversedAmount: reversedCommissionAmount, 
        transactionId 
      };

    } catch (error: any) {
      console.error("[خطأ في عكس عمولة المرتجع]", error);
      throw new Error(`فشل تصفية قيد عكس عمولة المرتجع: ${error.message || error}`);
    }
  }
}
