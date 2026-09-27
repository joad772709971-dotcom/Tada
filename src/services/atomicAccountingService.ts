import { 
  collection, 
  doc, 
  writeBatch, 
  increment, 
  serverTimestamp, 
  getDocs, 
  query, 
  where, 
  limit,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import Big from 'big.js';

/**
 * 🛠️ ATOMIC ACCOUNTING & TRANSACTION SERVICE (المهمة العلاجية الثانية)
 * Guarantees 'All or Nothing' transactional consistency across Sales, Purchases, 
 * Inventory, General Ledger (GL), and Front-Facing Vaults using unified Firestore Write Batches.
 */
export class AtomicAccountingService {

  /**
   * Helper to ensure GL account is resolved and added to the batch if newly created
   */
  private static async getOrCreateGLAccountRef(ownerId: string, accountNumber: string, defaultName: string, defaultType: string, batch: any) {
    const q = query(
      collection(db, 'accounts'),
      where('ownerId', '==', ownerId),
      where('accountNumber', '==', accountNumber),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return doc(db, 'accounts', d.id);
    }

    // Account does not exist, pre-allocate doc ref and add set operation to the batch
    const newAccRef = doc(collection(db, 'accounts'));
    batch.set(newAccRef, {
      ownerId,
      accountNumber,
      accountName: defaultName,
      type: defaultType,
      balance: 0,
      currency: 'YER',
      createdAt: serverTimestamp()
    });
    return newAccRef;
  }

  /**
   * 1. 🛒 ATOMIC SALE WRITE PATHWAY (مسار المبيعات المتكامل والذري)
   * Saves:
   *  - Sales document
   *  - Inventory stock decrements
   *  - Transaction document
   *  - GL Journal Entry
   *  - GL Account Balance updates
   *  - Front-Facing Vaults and CustomBoxes sync
   * ALL in a single Write Batch to ensure 100% financial matching.
   */
  static async saveAtomicSale(params: {
    ownerId: string;
    storeId: string;
    sellerId: string;
    sellerName: string;
    customerName: string;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
      cost: number;
      discount: number;
    }>;
    total: number;
    profit: number;
    paymentMethod: 'cash' | 'debt' | 'wallet' | string;
    currency: string;
    exchangeRate: number;
    notes?: string;
    isReturn?: boolean;
    forceNetworkFailureSim?: boolean; // For simulation testing
  }) {
    const {
      ownerId,
      storeId,
      sellerId,
      sellerName,
      customerName,
      items,
      total,
      profit,
      paymentMethod,
      currency,
      exchangeRate,
      notes = '',
      isReturn = false,
      forceNetworkFailureSim = false
    } = params;

    console.log(`⚡ [Atomic Sale] Starting atomic write batch for sale. Total: ${total} ${currency}. IsReturn: ${isReturn}`);

    const batch = writeBatch(db);

    // Pre-allocate document references
    const saleCol = isReturn ? 'returns' : 'sales';
    const saleRef = doc(collection(db, saleCol));
    const transactionRef = doc(collection(db, 'transactions'));
    const journalRef = doc(collection(db, 'journalEntries'));

    // Step 1: Write Sale Document
    const saleDocPayload = {
      ownerId,
      storeId,
      items,
      total,
      profit,
      paymentMethod,
      currency,
      customerName,
      notes,
      sellerId,
      sellerName,
      type: isReturn ? 'return' : 'sale',
      createdAt: serverTimestamp(),
      lastTransactionId: saleRef.id
    };
    batch.set(saleRef, saleDocPayload);

    // Step 2: Update Inventory Stock
    for (const item of items) {
      if (!item.id || item.id === 'manual') continue;
      const invRef = doc(db, 'inventory', item.id);
      
      // Stock goes UP for return, DOWN for sale
      const stockChange = isReturn ? item.quantity : -item.quantity;
      batch.update(invRef, {
        stock: increment(stockChange),
        updatedAt: serverTimestamp()
      });
    }

    // Step 3: Write Transaction Document (Cashier / Expense log)
    batch.set(transactionRef, {
      ownerId,
      storeId,
      type: isReturn ? 'expense' : 'income',
      amount: total,
      currency,
      category: isReturn ? 'sale_return' : 'sale',
      description: `${isReturn ? 'مرتجع مبيعات' : 'مبيعات نقدية'}: فاتورة #${saleRef.id.slice(-8)} للعميل ${customerName}`,
      boxId: paymentMethod === 'debt' ? 'RECEIVABLES' : 'CASH_BOX',
      createdAt: serverTimestamp()
    });

    // Step 4: Resolve GL Accounts inside the batch (pre-fetching and pre-allocating)
    const cashAccRef = await this.getOrCreateGLAccountRef(ownerId, '1100', 'الصندوق / البنك', 'asset', batch);
    const revenuesAccRef = await this.getOrCreateGLAccountRef(ownerId, '4100', 'إيرادات المبيعات', 'revenue', batch);
    const receivablesAccRef = await this.getOrCreateGLAccountRef(ownerId, '1101', 'ذمم مدينة - العملاء', 'asset', batch);
    const inventoryAccRef = await this.getOrCreateGLAccountRef(ownerId, '1200', 'المخازن', 'asset', batch);
    const cogsAccRef = await this.getOrCreateGLAccountRef(ownerId, '5100', 'تكلفة المبيعات', 'expense', batch);

    // Step 5: Construct Double-Entry Journal Lines
    const totalCost = items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const isDebt = paymentMethod === 'debt' || paymentMethod === 'credit';
    
    const ledgerLines: any[] = [];

    if (isReturn) {
      // Return Accounts
      if (isDebt) {
        ledgerLines.push({ accountId: revenuesAccRef.id, accountName: 'إيرادات المبيعات', debit: total, credit: 0 });
        ledgerLines.push({ accountId: receivablesAccRef.id, accountName: 'ذمم مدينة - العملاء', debit: 0, credit: total });
      } else {
        ledgerLines.push({ accountId: revenuesAccRef.id, accountName: 'إيرادات المبيعات', debit: total, credit: 0 });
        ledgerLines.push({ accountId: cashAccRef.id, accountName: 'الصندوق / البنك', debit: 0, credit: total });
      }

      if (totalCost > 0) {
        ledgerLines.push({ accountId: inventoryAccRef.id, accountName: 'المخازن', debit: totalCost, credit: 0 });
        ledgerLines.push({ accountId: cogsAccRef.id, accountName: 'تكلفة المبيعات', debit: 0, credit: totalCost });
      }
    } else {
      // Normal Sale Accounts
      if (isDebt) {
        ledgerLines.push({ accountId: receivablesAccRef.id, accountName: 'ذمم مدينة - العملاء', debit: total, credit: 0 });
        ledgerLines.push({ accountId: revenuesAccRef.id, accountName: 'إيرادات المبيعات', debit: 0, credit: total });
      } else {
        ledgerLines.push({ accountId: cashAccRef.id, accountName: 'الصندوق / البنك', debit: total, credit: 0 });
        ledgerLines.push({ accountId: revenuesAccRef.id, accountName: 'إيرادات المبيعات', debit: 0, credit: total });
      }

      if (totalCost > 0) {
        ledgerLines.push({ accountId: cogsAccRef.id, accountName: 'تكلفة المبيعات', debit: totalCost, credit: 0 });
        ledgerLines.push({ accountId: inventoryAccRef.id, accountName: 'المخازن', debit: 0, credit: totalCost });
      }
    }

    // Step 6: Write GL Journal Entry Document
    batch.set(journalRef, {
      ownerId,
      date: serverTimestamp(),
      description: `${isReturn ? 'مرتجع مبيعات' : 'مبيعات'} - فاتورة #${saleRef.id.slice(-8)}`,
      reference: saleRef.id,
      items: ledgerLines,
      createdAt: serverTimestamp()
    });

    // Step 7: Apply GL Account Balances Changes and Vault Synchronization (All inside the SAME batch)
    for (const line of ledgerLines) {
      const lineAccRef = doc(db, 'accounts', line.accountId);
      const balanceChange = parseFloat(new Big(line.debit || 0).minus(line.credit || 0).toString());
      
      batch.update(lineAccRef, {
        balance: increment(balanceChange)
      });

      // Synchronize Vaults inside the batch!
      const nameLower = (line.accountName || '').toLowerCase();
      let vaultId = '';
      let boxId = '';
      let boxName = '';

      if (nameLower.includes('صندوق') || nameLower.includes('كاش') || nameLower.includes('cash')) {
        vaultId = 'v1';
        boxId = 'CASH_BOX';
        boxName = 'صندوق النقد الرئيسي (الكاش)';
      } else if (nameLower.includes('بنك') || nameLower.includes('bank') || nameLower.includes('شبكة')) {
        vaultId = 'v2';
        boxId = 'v2';
        boxName = 'حساب البنك والشبكات المالي';
      }

      if (vaultId) {
        // Root Vault Doc
        const rootVDocRef = doc(db, 'vaults', `${ownerId}-${vaultId}`);
        batch.set(rootVDocRef, {
          id: vaultId,
          name: boxName,
          balance: increment(balanceChange),
          ownerId,
          storeId,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Store Vault Doc
        const storeVDocRef = doc(db, 'stores', storeId, 'vaults', vaultId);
        batch.set(storeVDocRef, {
          balance: increment(balanceChange),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      if (boxId) {
        // Store CustomBox Doc
        const customRef = doc(db, 'stores', ownerId, 'customBoxes', boxId);
        batch.set(customRef, {
          id: boxId,
          boxName: boxName,
          balance: increment(balanceChange),
          ownerId,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    }

    // Step 8: Network Failure Simulation (For Testing)
    if (forceNetworkFailureSim) {
      console.warn("⚠️ [Simulation] Intentionally throwing simulated network offline failure before commit!");
      throw new Error("خطأ اتصال بالشبكة (محاكاة): فشل إرسال حزمة مبيعات متكاملة لـ Firestore. تم إلغاء كامل المعاملة بالتراجع.");
    }

    // Commit ALL 100% atomically
    await batch.commit();
    console.log(`✅ [Atomic Sale] Batch committed successfully. SaleId: ${saleRef.id}`);
    
    return {
      success: true,
      saleId: saleRef.id,
      journalId: journalRef.id,
      transactionId: transactionRef.id
    };
  }

  /**
   * 2. 📦 ATOMIC PURCHASE WRITE PATHWAY (مسار المشتريات المتكامل والذري)
   * Saves:
   *  - Purchases/Expenses document
   *  - Inventory stock increments (or decrements if purchase return)
   *  - Transaction document
   *  - GL Journal Entry
   *  - GL Account Balance updates
   *  - Front-Facing Vaults and CustomBoxes sync
   * ALL in a single Write Batch to ensure 100% financial matching.
   */
  static async saveAtomicPurchase(params: {
    ownerId: string;
    storeId: string;
    supplierId: string;
    supplierName: string;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number; // buy price
    }>;
    total: number;
    paymentMethod: 'cash' | 'credit' | 'debt' | string;
    currency: string;
    exchangeRate: number;
    notes?: string;
    isReturn?: boolean;
    forceNetworkFailureSim?: boolean; // For simulation testing
  }) {
    const {
      ownerId,
      storeId,
      supplierId,
      supplierName,
      items,
      total,
      paymentMethod,
      currency,
      exchangeRate,
      notes = '',
      isReturn = false,
      forceNetworkFailureSim = false
    } = params;

    console.log(`⚡ [Atomic Purchase] Starting atomic write batch for purchase. Total: ${total} ${currency}. IsReturn: ${isReturn}`);

    const batch = writeBatch(db);

    // Pre-allocate document references
    const purchaseCol = isReturn ? 'purchase_returns' : 'purchases';
    const purchaseRef = doc(collection(db, purchaseCol));
    const transactionRef = doc(collection(db, 'transactions'));
    const journalRef = doc(collection(db, 'journalEntries'));

    // Step 1: Write Purchase Document
    const purchaseDocPayload = {
      ownerId,
      storeId,
      items,
      total,
      paymentMethod,
      currency,
      supplierId,
      supplierName,
      notes,
      type: isReturn ? 'purchase_return' : 'purchase',
      createdAt: serverTimestamp(),
      lastTransactionId: purchaseRef.id
    };
    batch.set(purchaseRef, purchaseDocPayload);

    // Step 2: Update Inventory Stock & Last Buy Price
    for (const item of items) {
      if (!item.id || item.id === 'manual') continue;
      const invRef = doc(db, 'inventory', item.id);
      
      // Stock goes DOWN for purchase return, UP for normal purchase
      const stockChange = isReturn ? -item.quantity : item.quantity;
      batch.update(invRef, {
        stock: increment(stockChange),
        lastBuyPrice: item.price,
        updatedAt: serverTimestamp()
      });
    }

    // Step 3: Write Transaction Document
    batch.set(transactionRef, {
      ownerId,
      storeId,
      type: isReturn ? 'income' : 'expense',
      amount: total,
      currency,
      category: isReturn ? 'purchase_return' : 'purchase',
      description: `${isReturn ? 'مرتجع مشتريات' : 'مشتريات بضاعة'}: مستند #${purchaseRef.id.slice(-8)} للمورد ${supplierName}`,
      boxId: paymentMethod === 'credit' ? 'PAYABLES' : 'CASH_BOX',
      createdAt: serverTimestamp()
    });

    // Step 4: Resolve GL Accounts inside the batch (pre-fetching and pre-allocating)
    const cashAccRef = await this.getOrCreateGLAccountRef(ownerId, '1100', 'الصندوق / البنك', 'asset', batch);
    const payablesAccRef = await this.getOrCreateGLAccountRef(ownerId, '2100', 'ذمم دائنة - الموردين', 'liability', batch);
    const inventoryAccRef = await this.getOrCreateGLAccountRef(ownerId, '1200', 'المخازن', 'asset', batch);

    // Step 5: Construct Double-Entry Journal Lines
    const isDebt = paymentMethod === 'credit' || paymentMethod === 'debt' || paymentMethod === 'on-credit';
    const ledgerLines: any[] = [];

    if (isReturn) {
      // Purchase Return Accounts
      if (isDebt) {
        ledgerLines.push({ accountId: payablesAccRef.id, accountName: 'ذمم دائنة - الموردين', debit: total, credit: 0 });
        ledgerLines.push({ accountId: inventoryAccRef.id, accountName: 'المخازن', debit: 0, credit: total });
      } else {
        ledgerLines.push({ accountId: cashAccRef.id, accountName: 'الصندوق / البنك', debit: total, credit: 0 });
        ledgerLines.push({ accountId: inventoryAccRef.id, accountName: 'المخازن', debit: 0, credit: total });
      }
    } else {
      // Normal Purchase Accounts
      if (isDebt) {
        ledgerLines.push({ accountId: inventoryAccRef.id, accountName: 'المخازن', debit: total, credit: 0 });
        ledgerLines.push({ accountId: payablesAccRef.id, accountName: 'ذمم دائنة - الموردين', debit: 0, credit: total });
      } else {
        ledgerLines.push({ accountId: inventoryAccRef.id, accountName: 'المخازن', debit: total, credit: 0 });
        ledgerLines.push({ accountId: cashAccRef.id, accountName: 'الصندوق / البنك', debit: 0, credit: total });
      }
    }

    // Step 6: Write GL Journal Entry Document
    batch.set(journalRef, {
      ownerId,
      date: serverTimestamp(),
      description: `${isReturn ? 'مرتجع مشتريات' : 'مشتريات'} - مستند #${purchaseRef.id.slice(-8)}`,
      reference: purchaseRef.id,
      items: ledgerLines,
      createdAt: serverTimestamp()
    });

    // Step 7: Apply GL Account Balances Changes and Vault Synchronization (All inside the SAME batch)
    for (const line of ledgerLines) {
      const lineAccRef = doc(db, 'accounts', line.accountId);
      const balanceChange = parseFloat(new Big(line.debit || 0).minus(line.credit || 0).toString());
      
      batch.update(lineAccRef, {
        balance: increment(balanceChange)
      });

      // Synchronize Vaults inside the batch!
      const nameLower = (line.accountName || '').toLowerCase();
      let vaultId = '';
      let boxId = '';
      let boxName = '';

      if (nameLower.includes('صندوق') || nameLower.includes('كاش') || nameLower.includes('cash')) {
        vaultId = 'v1';
        boxId = 'CASH_BOX';
        boxName = 'صندوق النقد الرئيسي (الكاش)';
      } else if (nameLower.includes('بنك') || nameLower.includes('bank') || nameLower.includes('شبكة')) {
        vaultId = 'v2';
        boxId = 'v2';
        boxName = 'حساب البنك والشبكات المالي';
      }

      if (vaultId) {
        // Root Vault Doc
        const rootVDocRef = doc(db, 'vaults', `${ownerId}-${vaultId}`);
        batch.set(rootVDocRef, {
          id: vaultId,
          name: boxName,
          balance: increment(balanceChange),
          ownerId,
          storeId,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Store Vault Doc
        const storeVDocRef = doc(db, 'stores', storeId, 'vaults', vaultId);
        batch.set(storeVDocRef, {
          balance: increment(balanceChange),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      if (boxId) {
        // Store CustomBox Doc
        const customRef = doc(db, 'stores', ownerId, 'customBoxes', boxId);
        batch.set(customRef, {
          id: boxId,
          boxName: boxName,
          balance: increment(balanceChange),
          ownerId,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    }

    // Step 8: Network Failure Simulation (For Testing)
    if (forceNetworkFailureSim) {
      console.warn("⚠️ [Simulation] Intentionally throwing simulated network offline failure before commit!");
      throw new Error("خطأ اتصال بالشبكة (محاكاة): فشل إرسال حزمة مشتريات متكاملة لـ Firestore. تم إلغاء كامل المعاملة بالتراجع.");
    }

    // Commit ALL 100% atomically
    await batch.commit();
    console.log(`✅ [Atomic Purchase] Batch committed successfully. PurchaseId: ${purchaseRef.id}`);
    
    return {
      success: true,
      purchaseId: purchaseRef.id,
      journalId: journalRef.id,
      transactionId: transactionRef.id
    };
  }
}
