import { collection, doc, getDocs, deleteDoc, query, where, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AtomicAccountingService } from './atomicAccountingService';

/**
 * ATOMIC WRITE BATCH & NETWORK FAILURE SIMULATION UNIT TEST (ملف تجريبي - المهمة الثانية)
 * Tests full atomicity (All or Nothing) by simulating network disconnects and successful transactions.
 */
export async function runAtomicAccountingTest(ownerId: string = 'test-owner-atomic-999') {
  console.log("🚀 Starting Atomic Write Batch & Network Failure Simulation Unit Test...");
  const results: string[] = [];

  const storeId = 'test-store-atomic-999';
  const productId = `prod-atomic-${Math.floor(1000 + Math.random() * 9000)}`;
  const sellerId = 'seller-999';
  const sellerName = 'مجرّب ذري';
  const customerName = 'عميل فحص الدفعة الذرية';

  try {
    // =========================================================================
    // STEP 0: Create Inventory Sandbox Record
    // =========================================================================
    const invRef = doc(db, 'inventory', productId);
    await setDoc(invRef, {
      id: productId,
      ownerId,
      name: 'صنف اختبار ذري',
      stock: 10,
      cost: 500,
      price: 1000,
      createdAt: new Date().toISOString()
    });
    results.push(`Step 0: Sandboxed product initialized with stock: 10. ✅`);

    // =========================================================================
    // STEP 1: Simulate Network Failure (All or Nothing Block)
    // =========================================================================
    console.log("🧪 Step 1: Executing Atomic Sale with forced Network Failure...");
    
    let simErrorThrown = false;
    let simErrorMsg = '';

    const testItems = [{
      id: productId,
      name: 'صنف اختبار ذري',
      quantity: 2,
      price: 1000,
      cost: 500,
      discount: 0
    }];

    try {
      await AtomicAccountingService.saveAtomicSale({
        ownerId,
        storeId,
        sellerId,
        sellerName,
        customerName,
        items: testItems,
        total: 2000,
        profit: 1000,
        paymentMethod: 'cash',
        currency: 'YER',
        exchangeRate: 1,
        notes: 'تجربة فشل الشبكة',
        forceNetworkFailureSim: true // Force rollback!
      });
    } catch (err: any) {
      simErrorThrown = true;
      simErrorMsg = err.message;
    }

    results.push(`Step 1: Forced network error triggered. Errored: ${simErrorThrown ? '✅ YES' : '❌ NO'}`);
    results.push(`Step 1 Message: "${simErrorMsg}"`);

    // Assert that NO document was saved to sales, transactions, or journalEntries under this owner
    const qSalesSim = query(collection(db, 'sales'), where('ownerId', '==', ownerId));
    const snapSalesSim = await getDocs(qSalesSim);

    const qJournalSim = query(collection(db, 'journalEntries'), where('ownerId', '==', ownerId));
    const snapJournalSim = await getDocs(qJournalSim);

    // Assert inventory stock remains exactly 10 (no decrement)
    const invSnapSim = await getDoc(invRef);
    const simStock = invSnapSim.exists() ? invSnapSim.data().stock : 0;

    const rollbackPassed = snapSalesSim.empty && snapJournalSim.empty && simStock === 10;
    results.push(`Step 1 Validation: Sales document recorded: ${!snapSalesSim.empty ? '❌ YES (Leak!)' : '✅ NO'}`);
    results.push(`Step 1 Validation: Journal entries recorded: ${!snapJournalSim.empty ? '❌ YES (Leak!)' : '✅ NO'}`);
    results.push(`Step 1 Validation: Stock decremented: ${simStock !== 10 ? '❌ YES (Leak!)' : '✅ NO (Stock is 10)'}`);
    results.push(`Step 1 Atomicity Check: ${rollbackPassed ? '✅ PASS (Strict Rollback Verified)' : '❌ FAIL'}`);

    // =========================================================================
    // STEP 2: Execute Successful Atomic Transaction
    // =========================================================================
    console.log("🧪 Step 2: Executing Successful Atomic Sale Transaction...");

    const successRes = await AtomicAccountingService.saveAtomicSale({
      ownerId,
      storeId,
      sellerId,
      sellerName,
      customerName,
      items: testItems,
      total: 2000,
      profit: 1000,
      paymentMethod: 'cash',
      currency: 'YER',
      exchangeRate: 1,
      notes: 'تجربة نجاح المعاملة',
      forceNetworkFailureSim: false // Execute!
    });

    // Fetch and check
    const qSalesSucc = query(collection(db, 'sales'), where('ownerId', '==', ownerId));
    const snapSalesSucc = await getDocs(qSalesSucc);

    const qJournalSucc = query(collection(db, 'journalEntries'), where('ownerId', '==', ownerId));
    const snapJournalSucc = await getDocs(qJournalSucc);

    const invSnapSucc = await getDoc(invRef);
    const succStock = invSnapSucc.exists() ? invSnapSucc.data().stock : 0;

    const successPassed = !snapSalesSucc.empty && !snapJournalSucc.empty && succStock === 8;
    results.push(`Step 2 Validation: Sales document written: ${!snapSalesSucc.empty ? '✅ YES' : '❌ NO'}`);
    results.push(`Step 2 Validation: Journal entries written: ${!snapJournalSucc.empty ? '✅ YES' : '❌ NO'}`);
    results.push(`Step 2 Validation: Inventory stock updated to 8 (10 - 2): ${succStock === 8 ? '✅ YES' : '❌ NO (Stock: ' + succStock + ')'}`);
    results.push(`Step 2 Atomicity Check: ${successPassed ? '✅ PASS (Atomic Commit Verified)' : '❌ FAIL'}`);

    console.log("\n📊 ATOMIC WRITE BATCH TEST SUMMARY:");
    results.forEach(r => console.log(r));

    return {
      success: true,
      results,
      details: { ownerId, storeId, productId, finalStock: succStock }
    };

  } catch (error: any) {
    console.error("❌ Atomic Accounting Integration Unit Test Failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * CLEANUP FUNCTION: Deletes all sandbox test logs and records from Firestore
 */
export async function cleanupAtomicTestLogs(ownerId: string = 'test-owner-atomic-999') {
  console.log("🧹 Cleaning up sandbox atomic test collections...");
  let count = 0;

  const collections = ['sales', 'returns', 'journalEntries', 'transactions', 'inventory', 'vaults', 'accounts'];

  try {
    for (const col of collections) {
      const q = query(collection(db, col), where('ownerId', '==', ownerId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, col, d.id));
        count++;
      }
    }

    // Clean up specific customBoxes and vaults inside stores
    const storeId = 'test-store-atomic-999';
    const storeVaults = ['v1', 'v2'];
    for (const vId of storeVaults) {
      await deleteDoc(doc(db, 'stores', storeId, 'vaults', vId));
      count++;
    }

    const customBoxes = ['CASH_BOX', 'v2'];
    for (const cbId of customBoxes) {
      await deleteDoc(doc(db, 'stores', ownerId, 'customBoxes', cbId));
      count++;
    }

    console.log(`✅ Cleaned up ${count} atomic test records from Firestore sandbox.`);
    return count;
  } catch (error) {
    console.error("Cleanup of atomic sandbox failed:", error);
    return 0;
  }
}
