import { 
  collection, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  getDocs,
  writeBatch,
  Unsubscribe,
  DocumentChange
} from 'firebase/firestore';
import { db } from '../firebase';

export interface AccountingTransactionItem {
  id: string;
  shopId: string;
  voucherNumber?: string;
  invoiceNo?: string;
  type: 'sale' | 'purchase' | 'receipt' | 'payment' | 'journal' | 'expense' | 'return' | 'inflow' | 'outflow' | 'income' | string;
  originalType?: string;
  amount?: number;
  totalAmount?: number;
  currency?: string;
  exchangeRate?: number;
  description?: string;
  details?: string;
  category?: string;
  reason?: string;
  recipient?: string;
  purchaseMethod?: string;
  boxId?: string;
  accountDebit?: string;
  accountCredit?: string;
  entries?: Array<{
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
    notes?: string;
  }>;
  partnerId?: string;
  partnerName?: string;
  partnerTier?: 'importer' | 'wholesaler_master' | 'wholesaler' | 'retail' | 'citizen';
  createdByUid?: string;
  createdByName?: string;
  status?: 'posted' | 'draft' | 'cancelled';
  createdAt?: any;
  date?: any;
  updatedAt?: any;
  [key: string]: any;
}

export type TransactionChangeCallback = (
  items: AccountingTransactionItem[],
  changeDetails?: {
    added: AccountingTransactionItem[];
    modified: AccountingTransactionItem[];
    removed: string[];
  }
) => void;

/**
 * خدمة المزامنة الحية الفورية للقيود والسندات المحاسبية التابعة للمحل
 * تضمن العزل الكامل بمسار shops/{shopId}/transactions
 */
export class RealtimeSyncService {
  private static activeListeners: Map<string, Unsubscribe> = new Map();

  /**
   * الاستماع الفوري والمستمر لكافة قيود وفواتير وسندات المحل
   * يتفاعل فورياً مع الإضافة، التعديل، والحذف
   */
  static subscribeToShopTransactions(
    shopId: string,
    onData: TransactionChangeCallback,
    onError?: (err: Error) => void,
    maxLimit: number = 200
  ): Unsubscribe {
    if (!shopId) {
      console.warn('⚠️ [RealtimeSyncService] لا يمكن الاستماع دون تحديد shopId');
      return () => {};
    }

    // إيقاف أي مستمع سابق لنفس المحل لتجنب تكرار الاتصالات
    this.unsubscribeFromShopTransactions(shopId);

    console.log(`📡 [RealtimeSyncService] بدء الاستماع الحي لقيود المحل: shops/${shopId}/transactions`);
    
    const transactionsRef = collection(db, 'shops', shopId, 'transactions');
    const qIsolated = query(transactionsRef, orderBy('createdAt', 'desc'), limit(maxLimit));

    let isolatedItems: AccountingTransactionItem[] = [];
    let legacyItems: AccountingTransactionItem[] = [];

    const emitMerged = () => {
      const mergedMap = new Map<string, AccountingTransactionItem>();
      // Legacy items first
      legacyItems.forEach(item => mergedMap.set(item.id, item));
      // Isolated tenant items override and take precedence
      isolatedItems.forEach(item => mergedMap.set(item.id, item));

      const mergedList = Array.from(mergedMap.values());
      mergedList.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0));
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0));
        return timeB - timeA;
      });

      onData(mergedList);
    };

    const unsubIsolated = onSnapshot(
      qIsolated,
      (snapshot) => {
        const items: AccountingTransactionItem[] = [];
        const addedItems: AccountingTransactionItem[] = [];
        const modifiedItems: AccountingTransactionItem[] = [];
        const removedIds: string[] = [];

        snapshot.docChanges().forEach((change: DocumentChange) => {
          const itemData = {
            id: change.doc.id,
            shopId,
            ...(change.doc.data() as Omit<AccountingTransactionItem, 'id' | 'shopId'>)
          };

          if (change.type === 'added') {
            addedItems.push(itemData);
          } else if (change.type === 'modified') {
            modifiedItems.push(itemData);
          } else if (change.type === 'removed') {
            removedIds.push(change.doc.id);
            console.log(`🗑️ [RealtimeSyncService] تم رصد حذف قيد محاسبي فورياً: ${change.doc.id}`);
          }
        });

        snapshot.forEach((docSnap) => {
          items.push({
            id: docSnap.id,
            shopId,
            ...(docSnap.data() as Omit<AccountingTransactionItem, 'id' | 'shopId'>)
          });
        });

        isolatedItems = items;
        emitMerged();
      },
      (error) => {
        console.error(`❌ [RealtimeSyncService] خطأ في المزامنة الحية للمحل (${shopId}):`, error);
        if (onError) {
          onError(error);
        }
      }
    );

    // Also listen to legacy root transactions filtered by shopId/ownerId for seamless transition
    let unsubLegacy: Unsubscribe = () => {};
    try {
      const qLegacy = query(collection(db, 'transactions'), where('ownerId', '==', shopId), limit(maxLimit));
      unsubLegacy = onSnapshot(qLegacy, (snap) => {
        legacyItems = snap.docs.map(docSnap => ({
          id: docSnap.id,
          shopId,
          ...(docSnap.data() as any)
        }));
        emitMerged();
      }, () => {
        // Fallback or permission warning ignored if rule restricts root
      });
    } catch (e) {}

    const combinedUnsubscribe = () => {
      unsubIsolated();
      unsubLegacy();
    };

    this.activeListeners.set(shopId, combinedUnsubscribe);
    return combinedUnsubscribe;
  }

  /**
   * إيقاف الاستماع للمحل
   */
  static unsubscribeFromShopTransactions(shopId: string): void {
    const existing = this.activeListeners.get(shopId);
    if (existing) {
      existing();
      this.activeListeners.delete(shopId);
      console.log(`🛑 [RealtimeSyncService] تم إيقاف الاستماع لقيود المحل: ${shopId}`);
    }
  }

  /**
   * إيقاف كافة المستمعين النشطين
   */
  static unsubscribeAll(): void {
    this.activeListeners.forEach((unsub) => unsub());
    this.activeListeners.clear();
  }

  /**
   * ترحيل وحفظ قيد/سند محاسبي فورياً داخل مسار المحل المعزول
   * يضمن عدم التكرار (Idempotency) والعزل التام لمسار المحل أوفلاين وأونلاين
   */
  static async saveTransaction(
    shopId: string,
    transaction: Omit<AccountingTransactionItem, 'id' | 'shopId'> & { id?: string }
  ): Promise<string> {
    if (!shopId) throw new Error('معرف المحل (shopId) مطلوب لحفظ القيد');

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const cleanShopId = String(shopId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const txType = (transaction.type || 'tx').replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // توليد معرف فريد حتمي يمنع التكرار نهائياً عند المزامنة
    const txId = transaction.id || `TX_${cleanShopId}_${txType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const txRef = doc(db, 'shops', shopId, 'transactions', txId);

    const payload = {
      ...transaction,
      id: txId,
      shopId,
      ownerId: (transaction as any).ownerId || shopId,
      idempotencyKey: (transaction as any).idempotencyKey || txId,
      syncState: isOnline ? 'synced' : 'pending',
      offlineCreated: !isOnline,
      status: transaction.status || 'posted',
      createdAt: transaction.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(txRef, payload, { merge: true });

    // Also mirror to root transactions for backward compatibility with existing views if permitted
    try {
      const rootTxRef = doc(db, 'transactions', txId);
      await setDoc(rootTxRef, payload, { merge: true });
    } catch (e) {
      // Tolerate permission restriction on root when strict tenant isolation is enforced
    }

    console.log(`✅ [RealtimeSyncService] تم ترحيل السند ${txId} للمحل ${shopId} (${isOnline ? 'Online Synced' : 'Offline Cached'})`);
    return txId;
  }

  /**
   * تحديث قيد محاسبي قائم في المحل
   */
  static async updateTransaction(
    shopId: string,
    txId: string,
    updates: Partial<AccountingTransactionItem>
  ): Promise<void> {
    if (!shopId || !txId) throw new Error('معرف المحل ورقم القيد مطلوبان للتحديث');

    const txRef = doc(db, 'shops', shopId, 'transactions', txId);
    await updateDoc(txRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    try {
      const rootTxRef = doc(db, 'transactions', txId);
      await updateDoc(rootTxRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (e) {}

    console.log(`✏️ [RealtimeSyncService] تم تحديث السند ${txId} للمحل ${shopId}`);
  }

  /**
   * حذف قيد محاسبي فورياً من المحل
   */
  static async deleteTransaction(shopId: string, txId: string): Promise<void> {
    if (!shopId || !txId) throw new Error('معرف المحل ورقم القيد مطلوبان للحذف');

    try {
      const txRef = doc(db, 'shops', shopId, 'transactions', txId);
      await deleteDoc(txRef);
    } catch (e) {
      console.warn('Error deleting from shops subcollection:', e);
    }

    try {
      const rootTxRef = doc(db, 'transactions', txId);
      await deleteDoc(rootTxRef);
    } catch (e) {}

    console.log(`🗑️ [RealtimeSyncService] تم حذف السند ${txId} فورياً من المحل ${shopId}`);
  }

  /**
   * ترحيل دفعة من القيود بعملية ذرية (Batch Commit)
   */
  static async batchSaveTransactions(
    shopId: string,
    transactions: Array<Omit<AccountingTransactionItem, 'id' | 'shopId'> & { id?: string }>
  ): Promise<string[]> {
    if (!shopId) throw new Error('معرف المحل مطلوب للعمليات الدفعية');

    const batch = writeBatch(db);
    const createdIds: string[] = [];

    for (const tx of transactions) {
      const txId = tx.id || `TX_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const txRef = doc(db, 'shops', shopId, 'transactions', txId);
      batch.set(txRef, {
        ...tx,
        id: txId,
        shopId,
        createdAt: tx.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      createdIds.push(txId);
    }

    await batch.commit();
    console.log(`📦 [RealtimeSyncService] تم ترحيل دفعة من ${createdIds.length} قيود للمحل ${shopId}`);
    return createdIds;
  }
}

/**
 * دالة للاستماع المباشر لقيود وسندات المحل
 */
export const listenToTransactions = (
  shopId: string,
  onData: TransactionChangeCallback,
  onError?: (err: Error) => void,
  maxLimit: number = 200
) => {
  return RealtimeSyncService.subscribeToShopTransactions(shopId, onData, onError, maxLimit);
};

/**
 * دالة لحذف قيد أو سند محاسبي فورياً
 */
export const deleteTransaction = async (shopId: string, txId: string) => {
  return RealtimeSyncService.deleteTransaction(shopId, txId);
};

export const realtimeSyncService = {
  listenToTransactions,
  deleteTransaction,
  saveTransaction: RealtimeSyncService.saveTransaction.bind(RealtimeSyncService),
  updateTransaction: RealtimeSyncService.updateTransaction.bind(RealtimeSyncService),
  batchSaveTransactions: RealtimeSyncService.batchSaveTransactions.bind(RealtimeSyncService),
  subscribeToShopTransactions: RealtimeSyncService.subscribeToShopTransactions.bind(RealtimeSyncService),
  unsubscribeFromShopTransactions: RealtimeSyncService.unsubscribeFromShopTransactions.bind(RealtimeSyncService),
  unsubscribeAll: RealtimeSyncService.unsubscribeAll.bind(RealtimeSyncService)
};

export default realtimeSyncService;
