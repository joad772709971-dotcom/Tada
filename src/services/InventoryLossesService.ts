import { 
  collection, 
  getDocs, 
  getDoc,
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
import { ensureAndGetAccount } from './PurchasesManagerService';
import { FinancialMath } from '../utils/financialMath';
import { AutomatedJournalEngine } from './AutomatedJournalEngine';

/**
 * MISSION 5 CORE FUNCTION - AUTOMATED RETURNS, LOSSES, AND WASTE ACCOUNTING
 * 
 * SCENARIO A: Returns (المرتجع المالي)
 * - DEBIT (مدين): Sales Returns Account (مردودات المبيعات - Code: 4150)
 * - CREDIT (دائن): Cash Room (الصندوق والطوارئ - Code: 1101) or Client Balance (ذمم العملاء المدينين - Code: 1200)
 * 
 * SCENARIO B: Damaged / Lost / Waste (التالف والفاقد والضياع)
 * - DEBIT (مدين): Inventory Losses/Waste (خسائر وتوالف بضاعة المخازن - Code: 5300)
 * - CREDIT (دائن): Inventory Asset (حساب المخزون المركزي - Code: 1100)
 */
export const postReturnOrLossToLedger = async (adjustmentData: any) => {
  const {
    ownerId,
    storeId,
    type, // 'return' | 'loss' 
    total, // total cost or valuation
    paymentMethod, // 'cash' | 'credit' (only for return)
    items, // array of { productId, quantity, qtyInPieces }
    referenceId,
    notes
  } = adjustmentData;

  if (!ownerId) {
    throw new Error("Missing ownerId in inventory adjustment or return ledger transaction");
  }

  const amt = parseFloat(total) || 0;
  const isLoss = type === 'loss';

  // Historical Rate Binding & Discrepancy Prevention Lookup
  let returnCurrency = 'YER';
  let returnRate = 1;

  if (referenceId && !isLoss) {
    const collectionsToTry = ['invoices', 'sales', 'purchases', 'orders'];
    for (const colName of collectionsToTry) {
      try {
        const docRef = doc(db, colName, referenceId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          returnCurrency = data.currency || 'YER';
          returnRate = Number(data.exchangeRate || data.rate || (returnCurrency === 'YER' ? 1 : (returnCurrency === 'SAR' ? 140 : 530)));
          console.log(`[Historical Rate Binding - LossesService] Found original invoice in '${colName}' with currency ${returnCurrency} and rate ${returnRate}`);
          break;
        }
      } catch (err) {
        console.warn(`[Historical Rate Binding - LossesService] Error fetching from ${colName}:`, err);
      }
    }
  }

  // 1. Double-Entry Posting Logic
  const entries: any[] = [];
  let description = '';
  let reference = referenceId || `INV-ADJ-${Date.now()}`;

  if (isLoss) {
    // SCENARIO B: Damaged/Lost/Waste
    const wasteExpenseAcc = await ensureAndGetAccount(
      ownerId, 
      '5300', 
      'حساب خسائر وتوالف بضاعة المخازن', 
      'expense'
    );
    const inventoryAcc = await ensureAndGetAccount(
      ownerId, 
      '1200', // OR '1100' centralized stock
      'حساب المخزون والمخازن المركزي', 
      'asset'
    );

    entries.push({
      accountId: wasteExpenseAcc.id,
      accountName: wasteExpenseAcc.accountName,
      debit: amt,
      credit: 0,
      currency: 'YER',
      exchangeRate: 1
    });

    entries.push({
      accountId: inventoryAcc.id,
      accountName: inventoryAcc.accountName,
      debit: 0,
      credit: amt,
      currency: 'YER',
      exchangeRate: 1
    });

    description = `إهلاك وتلف بضاعة أو عجز جرد مخزني - التفاصيل: ${notes || 'تسجيل فاقد وتالف تلقائي'}`;
  } else {
    // SCENARIO A: Returns
    const returnsAcc = await ensureAndGetAccount(
      ownerId, 
      '4150', 
      'حساب مردودات المبيعات', 
      'revenue' // Contra-revenue account
    );
    
    const isCredit = paymentMethod === 'credit' || paymentMethod === 'debt' || paymentMethod === 'on-credit';
    const creditAccountCode = isCredit ? '1200' : '1101';
    const creditAccountName = isCredit ? 'ذمم العملاء المدينين' : 'حساب الصندوق والطوارئ';
    const creditAccountType = isCredit ? 'asset' : 'asset';

    const counterpartyAcc = await ensureAndGetAccount(ownerId, creditAccountCode, creditAccountName, creditAccountType);

    entries.push({
      accountId: returnsAcc.id,
      accountName: returnsAcc.accountName,
      debit: amt,
      credit: 0,
      currency: returnCurrency,
      exchangeRate: returnRate
    });

    entries.push({
      accountId: counterpartyAcc.id,
      accountName: counterpartyAcc.accountName,
      debit: 0,
      credit: amt,
      currency: returnCurrency,
      exchangeRate: returnRate
    });

    description = `مرتجع مبيعات بضاعة من العميل بسعر صرف تاريخي ${returnRate} (${returnCurrency}) - التفاصيل: ${notes || 'عملية إرجاع بضاعة تلقائية'}`;
  }

  // Save General Journal Double-Entry
  if (amt > 0) {
    await AutomatedJournalEngine.postAutomatedJournal({
      ownerId,
      storeId,
      sourceModule: isLoss ? 'losses_damage' : 'pos_cashier',
      description,
      reference,
      lines: entries
    });
  }

  // 2. Perform Stock Modifications Atomic Operations
  if (items && items.length > 0) {
    const batch = writeBatch(db);
    
    for (const item of items) {
      if (!item.productId) continue;
      
      const qtyDelta = (item.quantity || 1) * (item.qtyInPieces || 1);
      const stockIncrement = isLoss ? -qtyDelta : qtyDelta;

      // Update both potential collections to maintain consistency: root inventory and sub-path stores
      const rootInvRef = doc(db, 'inventory', item.productId);
      batch.set(rootInvRef, {
        stock: increment(stockIncrement),
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (storeId) {
        const storeInvRef = doc(db, 'stores', storeId, 'inventory', item.productId);
        batch.set(storeInvRef, {
          stock: increment(stockIncrement),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    }

    await batch.commit();
  }

  return { success: true, reference };
};
