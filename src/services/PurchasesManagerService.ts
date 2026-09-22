import { 
  collection, 
  getDocs, 
  query, 
  where, 
  limit, 
  doc, 
  setDoc, 
  serverTimestamp, 
  writeBatch, 
  increment 
} from 'firebase/firestore';
import { db } from '../firebase';
import { accountingService } from './accountingService';

/**
 * Ensures or dynamically boots up standard accounts in the database charts of accounts
 */
export const ensureAndGetAccount = async (ownerId: string, accountNumber: string, defaultName: string, defaultType: string) => {
  const q = query(
    collection(db, 'accounts'),
    where('ownerId', '==', ownerId),
    where('accountNumber', '==', accountNumber),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as any;
  }
  
  const ref = doc(collection(db, 'accounts'));
  const newAcc = {
    ownerId,
    accountNumber,
    accountName: defaultName,
    type: defaultType,
    balance: 0,
    currency: 'YER',
    createdAt: serverTimestamp()
  };
  await setDoc(ref, newAcc);
  return { id: ref.id, ...newAcc };
};

/**
 * MISSION 3 CORE FUNCTION: Posts double-entry ledger lines and triggers atomic inventory counter modifications
 * DEBIT (مدين): Inventory / Asset Account (حساب المخزون المركزي - 1100)
 * CREDIT (دائن): Cash Room (حساب الصندوق والطوارئ - 1101) or Accounts Payable (حساب الموردين ذمم دائنة - 2100)
 */
export const postPurchaseToLedger = async (purchaseData: any) => {
  const { 
    ownerId, 
    storeId, 
    total, 
    paymentMethod, 
    items, 
    invoiceNumber, 
    supplierId, 
    supplierName 
  } = purchaseData;

  if (!ownerId) {
    throw new Error("Missing ownerId in billing purchase payload");
  }

  // 1. Standard Ledger Account Handshaking
  const inventoryAcc = await ensureAndGetAccount(ownerId, '1100', 'حساب المخزون والمخازن المركزي', 'asset');
  
  const isCredit = paymentMethod === 'credit' || paymentMethod === 'debt' || paymentMethod === 'on-credit';
  const creditAccountCode = isCredit ? '2100' : '1101';
  const creditAccountName = isCredit ? 'حساب الموردين - ذمم دائنة' : 'حساب الصندوق والطوارئ';
  const creditAccountType = isCredit ? 'liability' : 'asset';

  const counterpartyAcc = await ensureAndGetAccount(ownerId, creditAccountCode, creditAccountName, creditAccountType);

  const debitEntry = {
    accountId: inventoryAcc.id,
    accountName: inventoryAcc.accountName,
    debit: total,
    credit: 0
  };

  const creditEntry = {
    accountId: counterpartyAcc.id,
    accountName: counterpartyAcc.accountName,
    debit: 0,
    credit: total
  };

  const description = `فاتورة توريد بضاعة للمستودع #${invoiceNumber || 'NEW'} ${supplierName ? `من المورد: ${supplierName}` : ''}`;
  const reference = invoiceNumber || `PUR-${Date.now()}`;

  // Log to standard General Journal
  await accountingService.recordJournalEntry(
    ownerId,
    description,
    [debitEntry, creditEntry],
    reference
  );

  // 2. Perform Atomic Increment on Active Warehouse Store Pathway
  if (storeId && items && items.length > 0) {
    const batch = writeBatch(db);
    for (const item of items) {
      if (!item.productId) continue;
      
      const inventoryDocRef = doc(db, 'stores', storeId, 'inventory', item.productId);
      const qtyNew = (item.quantity || 1) * (item.qtyInPieces || 1);
      
      batch.set(inventoryDocRef, {
        stock: increment(qtyNew),
        lastBuyPrice: item.buyPrice || 0,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    await batch.commit();
  }

  return { success: true, reference };
};

export const PurchasesManagerService = {
  postPurchaseToLedger,
  ensureAndGetAccount
};
