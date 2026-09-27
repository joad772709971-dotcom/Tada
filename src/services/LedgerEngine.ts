import { 
  doc, 
  writeBatch, 
  increment, 
  serverTimestamp, 
  collection, 
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { FinancialMath } from '../utils/financialMath';

// Supported currencies in Yemen/GCC context
export type CurrencyType = 'YER' | 'SAR' | 'USD';

// Exactly 8 standard digital wallets, 1 main drawer, and 1 owner ledger wallet
export enum TreasuryType {
  MainDrawer = 'CASH_BOX',
  OwnerWallet = 'OWNER_WALLET',
  BankKuraimi = 'BANK_KURAIMI',
  BankTadhamon = 'BANK_TADHAMON',
  BankCAC = 'BANK_CAC',
  BankAlNajm = 'BANK_ALNAJM',
  BankSwaid = 'BANK_SWAID',
  BankAlAmal = 'BANK_ALAMAL',
  BankYkb = 'BANK_YKB',
  BankYap = 'BANK_YAP'
}

// Fixed Asset structure
export interface FixedAsset {
  id?: string;
  name: string;
  category: 'vehicles' | 'furniture' | 'computers' | 'real_estate' | 'machinery';
  currency: CurrencyType;
  purchaseValue: number;
  currentBookValue: number;
  depreciationRate: number; // yearly percentage (e.g. 15 for 15%)
  acquiredAt: any;
  status: 'active' | 'depreciated' | 'sold' | 'written_off';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

// Hardened Firestore Error Handler to provide precise diagnostics
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid || 'offline',
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('insufficient')) {
    console.warn('🛡️ Core Ledger Firestore Permission Notice (tolerated):', JSON.stringify(errInfo));
    return errInfo;
  }
  console.warn('Core Ledger Firestore Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

export interface DoubleEntryTransaction {
  id?: string;
  ownerId: string;
  debitAccount: string;   // Giver of value / recipient of assets (e.g. CASH_BOX, BANK_KURAIMI, client receivables)
  creditAccount: string;  // Origin of value / Giver of cash (e.g. Sales Revenue, prepaid deposits, supplier payable)
  amount: number;
  currency: CurrencyType;
  exchangeRate: number;   // rate against YER
  narrative: string;      
  module: 'treasury' | 'debt_clients' | 'returns_logistics' | 'administrative';
  referenceId?: string;   // associated OrderID, ReturnID, InvoiceID, CustomerID, AssetID
  operatorEmail: string;  
  isReversed?: boolean;   // tracking administrative reversals
  reversedTransId?: string;
  timestamp?: any;
}

export interface EodReconcileResult {
  currency: CurrencyType;
  openingBalance: number;
  receipts: number;
  expenses: number;
  payments: number;
  calculatedBalance: number;
  actualHandCount: number;
  discrepancy: number; 
  status: 'balanced' | 'surplus' | 'deficit';
}

export interface B2BReturnItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  defectLog?: string;
  step1Confirmed: boolean; // Warehouse Packager Inspected & Matched 
  step2Verified: boolean;  // SuperAdmin verified
  step3Status?: 'damaged' | 'stock' | 'supplier' | 'escrow'; // Manager macro decisions
}

export const LedgerEngine = {

  /**
   * Helper to fetch the exact exchange rate and currency of the original purchase invoice
   * to enforce strict Historical Rate Binding and bypass any current live market rates.
   */
  async getHistoricalInvoiceRate(originalInvoiceId: string, ownerId?: string): Promise<{ currency: CurrencyType; exchangeRate: number }> {
    if (!originalInvoiceId) {
      return { currency: 'YER', exchangeRate: 1 };
    }

    const collectionsToTry = ['invoices', 'sales', 'purchases', 'orders'];
    for (const colName of collectionsToTry) {
      try {
        const docRef = doc(db, colName, originalInvoiceId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const currency = (data.currency || 'YER') as CurrencyType;
          const exchangeRate = Number(data.exchangeRate || data.rate || (currency === 'YER' ? 1 : (currency === 'SAR' ? 140 : 530)));
          console.log(`[Historical Rate Binding] Found original invoice in '${colName}' with currency ${currency} and historical exchange rate ${exchangeRate}`);
          return { currency, exchangeRate };
        }
      } catch (err) {
        console.warn(`[Historical Rate Binding] Error fetching from ${colName}:`, err);
      }
    }

    // Fallback if not found: try querying ledger_transactions for associated transactions
    try {
      const q = query(
        collection(db, 'ledger_transactions'),
        where('referenceId', '==', originalInvoiceId),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        const currency = (data.currency || 'YER') as CurrencyType;
        const exchangeRate = Number(data.exchangeRate || (currency === 'YER' ? 1 : (currency === 'SAR' ? 140 : 530)));
        console.log(`[Historical Rate Binding] Found original invoice in 'ledger_transactions' reference with currency ${currency} and historical exchange rate ${exchangeRate}`);
        return { currency, exchangeRate };
      }
    } catch (err) {
      console.warn(`[Historical Rate Binding] Error fetching from ledger_transactions fallback:`, err);
    }

    // Default fallback if absolutely not found
    console.warn(`[Historical Rate Binding] Original invoice ${originalInvoiceId} not found. Using default YER 1 rate.`);
    return { currency: 'YER', exchangeRate: 1 };
  },

  // =========================================================================
  // LAYER 1: THE CASHIER'S OPERATIONAL PANEL (إجرائية بحتة وسريعة)
  // =========================================================================

  /**
   * Cash In / Cash Out operations (e.g., small overheads, drawer adjustments)
   */
  async processCashInOut(params: {
    ownerId: string,
    type: 'in' | 'out',
    targetWallet: TreasuryType,
    amount: number,
    currency: CurrencyType,
    narrative: string,
    operatorEmail: string
  }): Promise<{ message: string }> {
    const path = 'ledger_transactions';
    try {
      const batch = writeBatch(db);
      const transRef = doc(collection(db, path));
      const walletId = params.targetWallet || TreasuryType.MainDrawer;

      const debitAccount = params.type === 'in' ? walletId : 'EXPENSES_MISC';
      const creditAccount = params.type === 'in' ? 'CAPITAL_ADJUSTMENT' : walletId;

      const finalNarrative = `[صندوق العمل - حركة سريعة] ${params.type === 'in' ? 'إدخل نقدية' : 'إخراج كاش'}: ${params.narrative}.`;

      const entry: DoubleEntryTransaction = {
        ownerId: params.ownerId,
        debitAccount,
        creditAccount,
        amount: params.amount,
        currency: params.currency,
        exchangeRate: 1,
        narrative: finalNarrative,
        module: 'treasury',
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      };
      
      batch.set(transRef, entry);

      // Mutate targets
      const adjustment = params.type === 'in' ? params.amount : -params.amount;
      const boxRef = doc(db, 'stores', params.ownerId, 'customBoxes', walletId);
      batch.set(boxRef, {
        balance: increment(adjustment),
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      return { message: finalNarrative };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
  },

  /**
   * Quick Currency Exchange operation (e.g., Client pays SAR, Cashier returns YER change)
   */
  async processCurrencyExchange(params: {
    ownerId: string,
    receivedAmount: number,
    receivedCurrency: CurrencyType,
    givenAmount: number,
    givenCurrency: CurrencyType,
    targetWallet: TreasuryType,
    operatorEmail: string
  }): Promise<{ message: string }> {
    const path = 'ledger_transactions';
    try {
      const batch = writeBatch(db);
      const walletId = params.targetWallet || TreasuryType.MainDrawer;
      
      // Debit the wallet for received foreign/alternative currency
      const transInRef = doc(collection(db, path));
      const entryIn: DoubleEntryTransaction = {
        ownerId: params.ownerId,
        debitAccount: walletId,
        creditAccount: 'CURRENCY_EXCHANGE_LIABILITY',
        amount: params.receivedAmount,
        currency: params.receivedCurrency,
        exchangeRate: 1,
        narrative: `[تبادل عملات] استلام ${params.receivedAmount} ${params.receivedCurrency} بالخزينة.`,
        module: 'treasury',
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      };
      batch.set(transInRef, entryIn);

      // Credit the wallet for paid base/change currency
      const transOutRef = doc(collection(db, path));
      const entryOut: DoubleEntryTransaction = {
        ownerId: params.ownerId,
        debitAccount: 'CURRENCY_EXCHANGE_ASSET',
        creditAccount: walletId,
        amount: params.givenAmount,
        currency: params.givenCurrency,
        exchangeRate: 1,
        narrative: `[تبادل عملات] صرف فوري ${params.givenAmount} ${params.givenCurrency} من الخزينة.`,
        module: 'treasury',
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      };
      batch.set(transOutRef, entryOut);

      // Make dynamic atomic wallet increments
      const boxRef = doc(db, 'stores', params.ownerId, 'customBoxes', walletId);
      batch.set(boxRef, {
        [`balances.${params.receivedCurrency}`]: increment(params.receivedAmount),
        [`balances.${params.givenCurrency}`]: increment(-params.givenAmount),
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      return { message: `تم مبادلة ${params.receivedAmount} ${params.receivedCurrency} مقابل ${params.givenAmount} ${params.givenCurrency} وتحديث خزانة ${walletId} محاسبياً.` };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
  },

  /**
   * Cashier processes payment of customer debt installment (وفاء أقساط الدين الآجل)
   */
  async processInstallmentPayment(params: {
    ownerId: string,
    clientId: string,
    clientName: string,
    amountPaid: number,
    currency: CurrencyType,
    targetWallet: TreasuryType,
    operatorEmail: string
  }): Promise<{ message: string }> {
    const path = 'ledger_transactions';
    try {
      const batch = writeBatch(db);
      const transRef = doc(collection(db, path));

      const debitAccount = params.targetWallet || TreasuryType.MainDrawer;
      const creditAccount = `CLIENT_RECEIVABLES_${params.clientId}`;
      const narrative = `[تسديد قسط دين آجل] استلام محضر النقدية بقيمة ${params.amountPaid} ${params.currency} من العميل ${params.clientName} لتقليل عجز الحساب الجاري المفتوح.`;

      const entry: DoubleEntryTransaction = {
        ownerId: params.ownerId,
        debitAccount,
        creditAccount,
        amount: params.amountPaid,
        currency: params.currency,
        exchangeRate: 1,
        narrative,
        module: 'debt_clients',
        referenceId: params.clientId,
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      };
      batch.set(transRef, entry);

      // Mutate box balance
      const boxRef = doc(db, 'stores', params.ownerId, 'customBoxes', debitAccount);
      batch.set(boxRef, {
        balance: increment(params.amountPaid),
        [`balances.${params.currency}`]: increment(params.amountPaid),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Decrement outstanding client debt
      const custRef = doc(db, 'customers', params.clientId);
      batch.update(custRef, {
        debt: increment(-params.amountPaid),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      return { message: narrative };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
  },

  /**
   * Cashier logs EOD digital wallet receipts and verifies cash flow
   */
  async confirmTreasuryReceipt(params: {
    ownerId: string,
    walletId: TreasuryType,
    amount: number,
    currency: CurrencyType,
    clientName: string,
    clientId: string,
    isOrderReadyToday: boolean,
    operatorEmail: string
  }): Promise<{ message: string; transactionId: string }> {
    const path = 'ledger_transactions';
    try {
      const batch = writeBatch(db);
      const transRef = doc(collection(db, path));
      const transId = transRef.id;

      let debitAccount = params.walletId || TreasuryType.MainDrawer; 
      let creditAccount = '';
      let narrative = '';

      if (params.isOrderReadyToday) {
        creditAccount = 'REVENUE_SALES';
        narrative = `[تحصيل مبيعات] استلام دفعة ${params.amount} ${params.currency} من العميل ${params.clientName} بصندوق ${debitAccount}.`;
      } else {
        // Deferred Fulfillment Micro-account to handle tomorrow deliveries flawlessly without messing up EOD balances
        creditAccount = `PREPAID_DEPOSITS_${params.clientId}`;
        narrative = `[دفعات مقدمة معلقة] تجميد الرصيد مالياً باليوم الحالي وتأجيل التسليم غداً لضمان تطابق الجرد.`;

        // Update prepaid deposits track on customer object
        const custRef = doc(db, 'customers', params.clientId);
        batch.update(custRef, {
          prepaidBalance: increment(params.amount),
          updatedAt: serverTimestamp()
        });
      }

      const entry: DoubleEntryTransaction = {
        ownerId: params.ownerId,
        debitAccount,
        creditAccount,
        amount: params.amount,
        currency: params.currency,
        exchangeRate: 1,
        narrative,
        module: 'treasury',
        referenceId: params.clientId,
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      };
      batch.set(transRef, entry);

      // Update the targeted virtual or custom box balance
      const boxRef = doc(db, 'stores', params.ownerId, 'customBoxes', debitAccount);
      batch.set(boxRef, {
        balance: increment(params.amount),
        [`balances.${params.currency}`]: increment(params.amount),
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      return { message: narrative, transactionId: transId };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
  },

  /**
   * Action of Cashier [Transfer to Owner / عهدة للمالك] to clear daily cash completely
   */
  async transferToOwner(params: {
    ownerId: string,
    sourceWallet: TreasuryType,
    amount: number,
    currency: CurrencyType,
    operatorEmail: string
  }): Promise<{ message: string }> {
    const path = 'ledger_transactions';
    try {
      const batch = writeBatch(db);
      const transRef = doc(collection(db, path));

      const narrative = `[تصفية عهدة] ترحيل وتصفية مبلغ ${params.amount} ${params.currency} من صندوق العمل (${params.sourceWallet}) إلى عهدة المالك مباشرة.`;

      const entry: DoubleEntryTransaction = {
        ownerId: params.ownerId,
        debitAccount: TreasuryType.OwnerWallet,
        creditAccount: params.sourceWallet,
        amount: params.amount,
        currency: params.currency,
        exchangeRate: 1,
        narrative,
        module: 'treasury',
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      };
      batch.set(transRef, entry);

      // Deduct from source and add to owner wallet
      const srcWallet = params.sourceWallet || TreasuryType.MainDrawer;
      const srcRef = doc(db, 'stores', params.ownerId, 'customBoxes', srcWallet);
      batch.set(srcRef, {
        balance: increment(-params.amount),
        [`balances.${params.currency}`]: increment(-params.amount),
        updatedAt: serverTimestamp()
      }, { merge: true });

      const ownerRef = doc(db, 'stores', params.ownerId, 'customBoxes', TreasuryType.OwnerWallet);
      batch.set(ownerRef, {
        balance: increment(params.amount),
        [`balances.${params.currency}`]: increment(params.amount),
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      return { message: narrative };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
  },

  // =========================================================================
  // LAYER 2: THE OWNER'S COMMAND CENTER (للعرض والرقابة فقط)
  // =========================================================================

  /**
   * Compiles EOD Balance reconciliation with precision and checks variance
   */
  calculateEodMetrics(
    transactions: DoubleEntryTransaction[],
    openingBalances: Record<CurrencyType, number>,
    actualCounts: Record<CurrencyType, number>,
    currency: CurrencyType
  ): EodReconcileResult {
    const baseOpening = openingBalances[currency] || 0;
    let receipts = 0;
    let expenses = 0;
    let payments = 0;

    transactions.forEach(t => {
      if (t.currency !== currency || t.isReversed) return;
      
      const isReceipt = t.debitAccount === TreasuryType.MainDrawer || 
                        t.debitAccount === TreasuryType.OwnerWallet || 
                        t.debitAccount.startsWith('BANK-') || 
                        t.debitAccount.startsWith('BANK_');

      const isExpense = t.debitAccount.startsWith('EXPENSES_') || t.debitAccount === 'EXPENSES_MISC';

      const isPaymentOut = t.creditAccount === TreasuryType.MainDrawer || 
                           t.creditAccount === TreasuryType.OwnerWallet || 
                           t.creditAccount.startsWith('BANK-') || 
                           t.creditAccount.startsWith('BANK_');

      if (isReceipt && !isPaymentOut) {
        receipts += t.amount;
      } else if (isExpense) {
        expenses += t.amount;
      } else if (isPaymentOut) {
        payments += t.amount;
      }
    });

    const calculatedBalance = (baseOpening + receipts) - (expenses + payments);
    const handCount = actualCounts[currency] || 0;
    const discrepancy = handCount - calculatedBalance;

    let status: 'balanced' | 'surplus' | 'deficit' = 'balanced';
    if (discrepancy > 1) status = 'surplus';
    else if (discrepancy < -1) status = 'deficit';

    return {
      currency,
      openingBalance: baseOpening,
      receipts,
      expenses,
      payments,
      calculatedBalance,
      actualHandCount: handCount,
      discrepancy,
      status
    };
  },

  // =========================================================================
  // LAYER 3: LOGISTICS, FIXED ASSETS & DETAILED RETURNS
  // =========================================================================

  /**
   * Inserts new Fixed Asset into the depreciation registry
   */
  async registerFixedAsset(params: {
    ownerId: string,
    name: string,
    category: FixedAsset['category'],
    value: number,
    currency: CurrencyType,
    depreciationRate: number,
    operatorEmail: string
  }): Promise<{ message: string; assetId: string }> {
    const path = 'fixed_assets';
    try {
      const docRef = await addDoc(collection(db, path), {
        ownerId: params.ownerId,
        name: params.name,
        category: params.category,
        currency: params.currency,
        purchaseValue: params.value,
        currentBookValue: params.value,
        depreciationRate: params.depreciationRate,
        acquiredAt: serverTimestamp(),
        status: 'active',
        operatorEmail: params.operatorEmail
      });

      // Post standard double-entry transaction
      const transRef = doc(collection(db, 'ledger_transactions'));
      const ledgerEntry: DoubleEntryTransaction = {
        ownerId: params.ownerId,
        debitAccount: `ASSET_FIXED_${docRef.id}`,
        creditAccount: TreasuryType.OwnerWallet, // Funded by capital/owner funds
        amount: params.value,
        currency: params.currency,
        exchangeRate: 1,
        narrative: `[شراء أصول ثابتة] قيد قيمة الأصل الملموس (${params.name}) بسجلات التدقيق العام.`,
        module: 'administrative',
        referenceId: docRef.id,
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      };
      await addDoc(collection(db, 'ledger_transactions'), ledgerEntry);

      return { message: `تم تسجيل الأصل الثابت (${params.name}) بقيمة ${params.value} ${params.currency} وتأكيد قيده محاسبياً بنجاح.`, assetId: docRef.id };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
  },

  /**
   * Step 1: Submit a returned invoice record (Inspected & Matched by Packager)
   */
  async submitReturnRecord(params: {
    ownerId: string,
    items: B2BReturnItem[],
    totalRefund: number,
    currency: CurrencyType,
    originalInvoiceId: string,
    offsetInvoiceId?: string,
    settlementOption: 'offset_order' | 'cash_refund' | 'account_credit' | 'supplier_offset',
    settlementWalletId?: string,
    clientId?: string,
    supplierId?: string,
    isEscrowLocked?: boolean,
    operatorEmail: string
  }): Promise<{ returnId: string; message: string }> {
    const path = 'b2b_returns';
    try {
      const returnRef = doc(collection(db, path));
      const returnId = returnRef.id;

      // Ensure that for each item, we default acceptedQty and rejectedQty if not set
      const processedItems = params.items.map(item => {
        const accepted = typeof item.acceptedQty === 'number' ? item.acceptedQty : item.quantity;
        const rejected = typeof item.rejectedQty === 'number' ? item.rejectedQty : 0;
        return {
          ...item,
          acceptedQty: accepted,
          rejectedQty: rejected,
          isDamaged: item.isDamaged || false,
          damageLiability: item.damageLiability || 'shop',
          step1Confirmed: true,
          step2Verified: false, 
          step3Status: null
        };
      });

      // Calculate total refund strictly on accepted items (avoiding floating point anomalies)
      const calculatedRefund = processedItems.reduce(
        (acc, item) => acc + (item.acceptedQty * item.unitPrice), 0
      );

      // Historical Rate Binding: Retrieve original exchange rate at invoice timestamp
      const { currency: histCurrency, exchangeRate: histRate } = await this.getHistoricalInvoiceRate(params.originalInvoiceId, params.ownerId);
      const targetCurrency = params.currency || histCurrency;
      const targetRate = targetCurrency === histCurrency ? histRate : (targetCurrency === 'YER' ? 1 : histRate);

      const payload = {
        id: returnId,
        ownerId: params.ownerId,
        originalInvoiceId: params.originalInvoiceId,
        offsetInvoiceId: params.offsetInvoiceId || null,
        totalRefund: calculatedRefund,
        currency: targetCurrency,
        historicalCurrency: histCurrency,
        historicalRate: targetRate,
        exchangeRateLocked: true,
        baseRefund: FinancialMath.multiply(calculatedRefund, targetRate),
        settlementOption: params.settlementOption,
        settlementWalletId: params.settlementWalletId || null,
        clientId: params.clientId || null,
        supplierId: params.supplierId || null,
        items: processedItems,
        status: params.isEscrowLocked ? 'escrow_locked' : 'pending_admin',
        operatorEmail: params.operatorEmail,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, path), payload);

      const lockMsg = params.isEscrowLocked 
        ? 'وضع الحجز والتعليق العيني نشط واحتجاز القيمة المحاسبية بـ (مخزن المحجوزات)'
        : 'انتظار الموافقة المحاسبية والتحقق الإداري';
      const msg = `[سجل المرتجعات] تم تسجيل طلب مرتجع بقيمة ${calculatedRefund} ${targetCurrency} بسعر صرف تاريخي ${targetRate} [${lockMsg}] بواسطة ${params.operatorEmail}.`;
      return { returnId, message: msg };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
  },

  /**
   * Step 2 & 3: SuperAdmin approves validation, Manager commits final settlement macro
   * Supports virtual escrow lock, release escrow, partial validation, and damage routing.
   */
  async commitReturnResolution(params: {
    ownerId: string,
    returnDocId: string,
    decision: 'damaged' | 'stock' | 'supplier' | 'escrow',
    operatorEmail: string,
    // Optional parameter overwrites for final settlement at release
    finalSettlementOption?: 'offset_order' | 'cash_refund' | 'account_credit' | 'supplier_offset',
    finalSettlementWalletId?: string,
    finalClientId?: string,
    finalSupplierId?: string,
    finalDamageLiability?: 'shop' | 'supplier'
  }): Promise<{ message: string }> {
    const path = 'b2b_returns';
    try {
      const batch = writeBatch(db);
      const returnDocRef = doc(db, path, params.returnDocId);
      const returnSnap = await getDoc(returnDocRef);

      if (!returnSnap.exists()) {
        throw new Error('المستند المرتجع غير متواجد بسجلات الأرشفة!');
      }

      const returnData = returnSnap.data();
      const items: B2BReturnItem[] = returnData.items || [];
      const currency = returnData.currency || 'YER';

      // 1. ESCROW LOCK STATE MOVEMENT
      if (params.decision === 'escrow') {
        const updatedItems = items.map(item => ({
          ...item,
          step3Status: 'escrow' as const
        }));

        batch.update(returnDocRef, {
          status: 'escrow_locked',
          items: updatedItems,
          updatedAt: serverTimestamp(),
          updatedBy: params.operatorEmail
        });

        await batch.commit();
        return { message: '[الحساب المعلق لضمان المورد] تم تحويل بضاعة الفاتورة إلى مخزن المحجوزات بنجاح وتجميد الحساب المالي آلياً.' };
      }

      // 2. FINAL ROUTING & FINANCIAL SETTLEMENT
      // Ensure we calculate refund strictly from acceptedQty
      const calculatedRefund = items.reduce(
        (acc, item) => acc + ((item.acceptedQty ?? item.quantity) * item.unitPrice), 0
      );

      // Load Locked Historical Exchange Rates for Discrepancy Prevention
      const historicalCurrency = returnData.historicalCurrency || currency;
      const historicalRate = Number(returnData.historicalRate || 1);
      const exchangeRateLocked = returnData.exchangeRateLocked || false;
      const rateToUse = currency === 'YER' ? 1 : historicalRate;
      const baseRefund = FinancialMath.multiply(calculatedRefund, rateToUse);

      const sOption = params.finalSettlementOption || returnData.settlementOption || 'cash_refund';
      const sWallet = params.finalSettlementWalletId || returnData.settlementWalletId || TreasuryType.MainDrawer;
      const sClient = params.finalClientId || returnData.clientId;
      const sSupplier = params.finalSupplierId || returnData.supplierId || 'general_supplier';

      let destinationNotes = '';
      
      // A. Inventory Physical Routing based on decision on *acceptedQty* only (rejectedQty completely isolated)
      for (const item of items) {
        const itemAcceptedQty = item.acceptedQty ?? item.quantity;
        const itemVal = itemAcceptedQty * item.unitPrice;
        
        if (itemAcceptedQty <= 0) continue; // Skip zero/negative values safely

        const invRef = doc(db, 'inventory', item.itemId);
        
        if (params.decision === 'stock') {
          // Re-shelve back to regular inventory stock
          batch.update(invRef, {
            stock: increment(itemAcceptedQty),
            updatedAt: serverTimestamp()
          });
          destinationNotes = 'إعادة إدراج الوحدات المقبولة مباشرة في الرفوف للبيع بالمخزن الرئيسي.';
        } 
        else if (params.decision === 'damaged') {
          // Track damaged items collection
          const damagedColRef = doc(collection(db, 'damaged_items'));
          const liabilityVal = params.finalDamageLiability || item.damageLiability || 'shop';
          
          batch.set(damagedColRef, {
            ownerId: params.ownerId,
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: itemAcceptedQty,
            defectLog: item.defectLog || 'تالف أو مكسر عيني',
            liability: liabilityVal,
            createdAt: serverTimestamp()
          });

          if (liabilityVal === 'shop') {
            // Internal Shop Loss: Debit internal overhead losses
            destinationNotes += ` [تالف للمحل] قيد محاسبي كخسائر مستغنى عنها بقيمة ${itemVal} ${currency}.`;
          } else {
            // Supplier Defect: Debit Note against supplier
            destinationNotes += ` [تعديل للمورد] تقليل ذمة الحساب المالي الدائن مع المورد (${sSupplier}) بقيمة ${itemVal} ${currency}.`;
          }
        } 
        else if (params.decision === 'supplier') {
          // Outbound Debit Note against Supplier: Status remains "Pending Supplier Exchange"
          destinationNotes = `مرتجع مباشر للمورد وتخفيض فوري للحساب الآجل المستحق للمورد (${sSupplier}).`;
        }
      }

      // B. Programmatic Bookkeeping and Balance Settlement triggers
      const transRef = doc(collection(db, 'ledger_transactions'));
      let debitAccount = `RETURNS_REDUCTION_ALREADY_CHARGED`;
      let creditAccount = '';
      let settlementActionMsg = '';

      if (sOption === 'offset_order') {
        const linkInvoice = returnData.offsetInvoiceId || 'ACTIVE_PURCHASE';
        creditAccount = `OFFSET_INVOICE_CLEARANCE_${linkInvoice}`;
        settlementActionMsg = `مقاصة شراء بدل مع الفاتورة رقم: (${linkInvoice})`;
      } 
      else if (sOption === 'cash_refund') {
        creditAccount = sWallet;
        settlementActionMsg = `صرف كاش نقدي مصفى من صندوق عيني: [${sWallet}]`;

        // Update target wallet box balance with strict YER base balance matching
        const boxRef = doc(db, 'stores', params.ownerId, 'customBoxes', sWallet);
        batch.set(boxRef, {
          balance: increment(-baseRefund),
          [`balances.${currency}`]: increment(-calculatedRefund),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } 
      else if (sOption === 'account_credit') {
        creditAccount = `CLIENT_RECEIVABLES_${sClient || 'unidentified'}`;
        settlementActionMsg = `وفاء ودين - تقليل عجز الحساب الجاري المفتوح للعميل`;

        if (sClient) {
          const custRef = doc(db, 'customers', sClient);
          batch.update(custRef, {
            debt: increment(-baseRefund),
            updatedAt: serverTimestamp()
          });
        }
      } 
      else if (sOption === 'supplier_offset') {
        creditAccount = `SUPPLIER_PAYABLES_${sSupplier}`;
        settlementActionMsg = `خصم مباشر ومقاصة رصيد من كشف حساب المورد: [${sSupplier}]`;
      }

      const narrative = `[قرار المرتجع النهائي] تسوية عينية بقرار المدير: [${params.decision === 'stock' ? 'إعادة للرفوف' : params.decision}]. الخيار المحاسبي: [${settlementActionMsg}]. بقيمة ${calculatedRefund} ${currency} بسعر الصرف التاريخي المغلق ${rateToUse}. ${destinationNotes}`;

      const ledgerEntry: DoubleEntryTransaction = {
        ownerId: params.ownerId,
        debitAccount,
        creditAccount,
        amount: calculatedRefund,
        currency,
        exchangeRate: rateToUse,
        narrative,
        module: 'returns_logistics',
        referenceId: params.returnDocId,
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      };
      batch.set(transRef, ledgerEntry);

      // C. Finalize Return record status
      batch.update(returnDocRef, {
        status: 'finalized',
        totalRefund: calculatedRefund,
        settlementOption: sOption,
        settlementWalletId: sWallet,
        clientId: sClient || null,
        supplierId: sSupplier || null,
        items: items.map(i => ({
          ...i,
          step2Verified: true,
          step3Status: params.decision
        })),
        finalizedAt: serverTimestamp(),
        finalizedBy: params.operatorEmail
      });

      await batch.commit();
      return { message: narrative };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
  },

  // =========================================================================
  // LAYER 4: THE HARDENED CORE ACCOUNTING KERNEL (النظام المحاسبي المعمق)
  // =========================================================================

  /**
   * Administrative Reverse Journal Entry (protected by security dev keys)
   */
  async reverseJournalEntry(params: {
    ownerId: string,
    targetTransactionId: string,
    developerKey: string,
    operatorEmail: string
  }): Promise<{ message: string }> {
    if (params.developerKey !== 'DEVELOPER_CORE_KEY_2026') {
      throw new Error('الرمز البرمجي السري للمطورين غير صحيح! العملية مرفوضة أمنياً لتفادي الاحتيال الاختراقي.');
    }

    const path = 'ledger_transactions';
    try {
      const batch = writeBatch(db);
      const targetDocRef = doc(db, path, params.targetTransactionId);
      const targetSnap = await getDoc(targetDocRef);

      if (!targetSnap.exists()) {
        throw new Error('المستند المالي المراد عكسه غير متواجد بسجلات الأستاذ العام!');
      }

      const origData = targetSnap.data() as DoubleEntryTransaction;
      if (origData.isReversed) {
        throw new Error('هذا القيد تم عكسه مسبقاً! لا يمكن تجديد عكس قيود مغلرة ثانية.');
      }

      // Mark original reversed
      batch.update(targetDocRef, {
        isReversed: true,
        reversedTransId: 'REVERSED',
        updatedBy: params.operatorEmail,
        updatedAt: serverTimestamp()
      });

      // Issue inversion double-entry
      const reverseRef = doc(collection(db, path));
      const inversion: DoubleEntryTransaction = {
        ownerId: params.ownerId,
        debitAccount: origData.creditAccount, // Inverting debit/credit perfectly
        creditAccount: origData.debitAccount,
        amount: origData.amount,
        currency: origData.currency,
        exchangeRate: origData.exchangeRate,
        narrative: `[عكس قيد مالي إداري] إلغاء ومعاكسة يدوية للقيد المحاسبي (${params.targetTransactionId}) المرخص بالرمز التدقيقي للتحقق البشري.`,
        module: 'administrative',
        referenceId: params.targetTransactionId,
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      };
      batch.set(reverseRef, inversion);

      // Restore treasury cash balances
      const dBoxRef = doc(db, 'stores', params.ownerId, 'customBoxes', origData.debitAccount);
      const dBoxSnap = await getDoc(dBoxRef);
      if (dBoxSnap.exists()) {
        batch.update(dBoxRef, {
          balance: increment(-origData.amount),
          [`balances.${origData.currency}`]: increment(-origData.amount),
          updatedAt: serverTimestamp()
        });
      }

      const cBoxRef = doc(db, 'stores', params.ownerId, 'customBoxes', origData.creditAccount);
      const cBoxSnap = await getDoc(cBoxRef);
      if (cBoxSnap.exists()) {
        batch.update(cBoxRef, {
          balance: increment(origData.amount),
          [`balances.${origData.currency}`]: increment(origData.amount),
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      return { message: `تم عكس القيد رقم ${params.targetTransactionId} وإقرار التدفق الراجع في شجرة الأستاذ العام.` };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
  },

  /**
   * Completely administrative void invoice action (reversing stock and financials synchronously)
   */
  async voidInvoiceAndFinancials(params: {
    ownerId: string,
    invoiceId: string,
    developerKey: string,
    operatorEmail: string
  }): Promise<{ message: string }> {
    if (params.developerKey !== 'DEVELOPER_CORE_KEY_2026') {
      throw new Error('الرمز المحاسبي السري غير مصرح به لتعديل المستودع المالي للشركة!');
    }

    const path = 'ledger_transactions';
    try {
      const batch = writeBatch(db);

      // Mark invoice voided
      const invRef = doc(db, 'invoices', params.invoiceId);
      const invSnap = await getDoc(invRef);
      if (invSnap.exists()) {
        batch.update(invRef, {
          status: 'voided',
          voidedAt: serverTimestamp(),
          voidedBy: params.operatorEmail
        });

        // Loop items and restore stock
        const invData = invSnap.data();
        const items = invData.items || [];
        for (const item of items) {
          const itemRef = doc(db, 'inventory', item.id);
          batch.update(itemRef, {
            stock: increment(item.quantity),
            updatedAt: serverTimestamp()
          });
        }
      }

      // Record Administrative entry
      const transRef = doc(collection(db, path));
      const narrative = `[مسح وإلغاء فاتورة] إلغاء كلي للفاتورة رقم (${params.invoiceId}) واسترجاع السلع التالفة لرفوف المخزون بموافقة المالك.`;
      
      const voidEntry: DoubleEntryTransaction = {
        ownerId: params.ownerId,
        debitAccount: 'SALES_REVENUE_VOID',
        creditAccount: 'CASH_BOX',
        amount: invSnap.exists() ? (invSnap.data().total || 0) : 0,
        currency: 'YER',
        exchangeRate: 1,
        narrative,
        module: 'administrative',
        referenceId: params.invoiceId,
        operatorEmail: params.operatorEmail,
        timestamp: serverTimestamp()
      };
      
      batch.set(transRef, voidEntry);
      await batch.commit();

      return { message: narrative };
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
  }
};
