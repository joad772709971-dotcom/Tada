import { postReturnOrLossToLedger } from './InventoryLossesService';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * RETURNS, LOSSES & WASTE FINANCIAL INTEGRATION UNIT TEST MODULE (ملف تجريبي - المهمة الخامسة)
 * Validates automatic stock replenishment/write-off and corresponding double-entry journal postings.
 */
export async function runLossesTest(ownerId: string = 'test-owner-losses-123') {
  console.log("🚀 Starting Returns, Losses & Waste Integration Unit Test...");
  const results: string[] = [];
  const testStoreId = 'test-store-losses-999';
  const testProductId = 'test-prod-losses-888';

  try {
    // 0. Set up initial sandbox product state with 20 items
    const itemRef = doc(db, 'stores', testStoreId, 'inventory', testProductId);
    await setDoc(itemRef, {
      name: 'شريحة يمن موبايل تجريبية للفحص',
      barcode: '888777666',
      category: 'شرائح',
      cost: 1000,
      price: 1500,
      stock: 20,
      ownerId,
      updatedAt: new Date()
    }, { merge: true });

    results.push("Step 0: Initialised temporary test product with stock: 20. ✅");

    // SCENARIO 1: Customer Return (مرتجع مبيعات نقداً)
    // Debit Sales Returns (4150), Credit Cash (1101), Stock increases from 20 to 22
    console.log("🧪 Scenario 1: Customer Return of 2 items");
    const rData1 = {
      ownerId,
      storeId: testStoreId,
      type: 'return',
      total: 3000, // 2 items * 1500 price
      paymentMethod: 'cash',
      items: [
        {
          productId: testProductId,
          quantity: 2,
          qtyInPieces: 1
        }
      ],
      notes: 'مرتجع سلع غير مطابقة للمواصفات من العميل'
    };

    const res1 = await postReturnOrLossToLedger(rData1);
    results.push(`Scenario 1 (Sales Return): Posted with Ref ${res1.reference}. ✅`);

    // Verify stock incremented to 22
    const snap1 = await getDoc(itemRef);
    const stockAfterReturn = snap1.data()?.stock || 0;
    results.push(`Scenario 1 Verification: Expected stock 22, Actual stock ${stockAfterReturn}. ${stockAfterReturn === 22 ? '✅ PASS' : '❌ FAIL'}`);

    // SCENARIO 2: Damaged / Lost / Waste Write-off (إهلاك وتلف البضاعة)
    // Debit Losses & Waste (5300), Credit Inventory Central (1200/1100), Stock decreases from 22 to 17
    console.log("🧪 Scenario 2: Damaged stock write-off of 5 items");
    const lData2 = {
      ownerId,
      storeId: testStoreId,
      type: 'loss',
      total: 5000, // 5 items * 1000 cost
      items: [
        {
          productId: testProductId,
          quantity: 5,
          qtyInPieces: 1
        }
      ],
      notes: 'تلف شحنة كابلات وشواحن بسبب رطوبة المخزن الرئيسي'
    };

    const res2 = await postReturnOrLossToLedger(lData2);
    results.push(`Scenario 2 (Damaged Stock write-off): Posted with Ref ${res2.reference}. ✅`);

    // Verify stock decremented to 17
    const snap2 = await getDoc(itemRef);
    const stockAfterLoss = snap2.data()?.stock || 0;
    results.push(`Scenario 2 Verification: Expected stock 17, Actual stock ${stockAfterLoss}. ${stockAfterLoss === 17 ? '✅ PASS' : '❌ FAIL'}`);

    console.log("\n📊 RETURNS, LOSSES & WASTE INTEGRATION TEST SUMMARY:");
    results.forEach(r => console.log(r));

    return {
      success: true,
      results,
      details: { res1, res2, stockAfterLoss }
    };
  } catch (error: any) {
    console.error("❌ Returns/Losses Integration Unit Test Failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * CLEANUP FUNCTION: Wipes sandbox collections after testing
 */
export async function cleanupLossesTestLogs(ownerId: string = 'test-owner-losses-123') {
  console.log("🧹 Cleaning up Returns & Losses sandbox test collections...");
  let count = 0;
  const testStoreId = 'test-store-losses-999';
  const testProductId = 'test-prod-losses-888';

  try {
    // 1. Delete the test inventory item
    const itemRef = doc(db, 'stores', testStoreId, 'inventory', testProductId);
    await deleteDoc(itemRef);
    count++;

    // 2. Query and delete temporary journal entries
    const qEntries = query(collection(db, 'journalEntries'), where('ownerId', '==', ownerId));
    const entriesSnap = await getDocs(qEntries);
    for (const d of entriesSnap.docs) {
      await deleteDoc(doc(db, 'journalEntries', d.id));
      count++;
    }

    // 3. Query and delete temporary accounts
    const qAccounts = query(collection(db, 'accounts'), where('ownerId', '==', ownerId));
    const accountsSnap = await getDocs(qAccounts);
    for (const d of accountsSnap.docs) {
      await deleteDoc(doc(db, 'accounts', d.id));
      count++;
    }

    console.log(`✅ Cleaned up ${count} temporary test documents from sandbox.`);
    return count;
  } catch (error) {
    console.error("Cleanup of losses sandbox failed:", error);
    return 0;
  }
}
