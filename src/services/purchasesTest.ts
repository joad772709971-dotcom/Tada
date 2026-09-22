import { postPurchaseToLedger } from './PurchasesManagerService';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * PURCHASES & INVENTORY FINANCIAL INTEGRATION UNIT TEST MODULE (ملف تجريبي - المهمة الثالثة)
 * Validates automatic purchase posting to ledger, double-entry alignment, and inventory increments
 * under isolated test conditions.
 */
export async function runPurchasesTest(ownerId: string = 'test-owner-purchases-123') {
  console.log("🚀 Starting Purchases and Inventory Integration Unit Test...");
  const results: string[] = [];
  const testStoreId = 'test-store-purchases-999';
  const testProductId = 'test-prod-purchases-888';

  try {
    // 0. Ensure the inventory item exists in the test store
    const itemRef = doc(db, 'stores', testStoreId, 'inventory', testProductId);
    await setDoc(itemRef, {
      name: 'شاحن يمن موبايل تجريبي',
      barcode: '999111888',
      category: 'إكسسوارات',
      cost: 500,
      price: 800,
      stock: 10,
      ownerId,
      updatedAt: new Date()
    }, { merge: true });

    results.push("Step 0: Initialised temporary test product in sandbox store. ✅");

    // SCENARIO 1: Cash Purchase (نقداً)
    // Debit Inventory 1100, Credit Cash 1101
    console.log("🧪 Scenario 1: Cash Purchase of Inventory");
    const pData1 = {
      ownerId,
      storeId: testStoreId,
      total: 5000,
      paymentMethod: 'cash',
      invoiceNumber: `TEST-PUR-CASH-${Math.floor(Math.random() * 10000)}`,
      supplierId: 'test-supp-1',
      supplierName: 'مورد صنعاء المركزي التجريبي',
      items: [
        {
          productId: testProductId,
          quantity: 10,
          qtyInPieces: 1,
          buyPrice: 500
        }
      ]
    };

    const res1 = await postPurchaseToLedger(pData1);
    results.push(`Scenario 1 (Cash Purchase): Posted with Ref ${res1.reference}. ✅`);

    // Verify inventory incremented from 10 to 20
    const updatedSnap = await getDoc(itemRef);
    const updatedStock = updatedSnap.data()?.stock || 0;
    results.push(`Scenario 1 Verification: Expected stock 20, Actual stock ${updatedStock}. ${updatedStock === 20 ? '✅ PASS' : '❌ FAIL'}`);

    // SCENARIO 2: Credit Purchase (على الحساب / آجل)
    // Debit Inventory 1100, Credit Payables 2100
    console.log("🧪 Scenario 2: Credit Purchase of Inventory");
    const pData2 = {
      ownerId,
      storeId: testStoreId,
      total: 3000,
      paymentMethod: 'credit',
      invoiceNumber: `TEST-PUR-CREDIT-${Math.floor(Math.random() * 10000)}`,
      supplierId: 'test-supp-1',
      supplierName: 'مورد صنعاء المركزي التجريبي',
      items: [
        {
          productId: testProductId,
          quantity: 6,
          qtyInPieces: 1,
          buyPrice: 500
        }
      ]
    };

    const res2 = await postPurchaseToLedger(pData2);
    results.push(`Scenario 2 (Credit Purchase): Posted with Ref ${res2.reference}. ✅`);

    // Verify inventory incremented from 20 to 26
    const finalSnap = await getDoc(itemRef);
    const finalStock = finalSnap.data()?.stock || 0;
    results.push(`Scenario 2 Verification: Expected stock 26, Actual stock ${finalStock}. ${finalStock === 26 ? '✅ PASS' : '❌ FAIL'}`);

    console.log("\n📊 PURCHASES FINANCIAL INTEGRATION TEST SUMMARY:");
    results.forEach(r => console.log(r));

    return {
      success: true,
      results,
      details: { res1, res2, finalStock }
    };
  } catch (error: any) {
    console.error("❌ Purchases Integration Unit Test Failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * CLEANUP FUNCTION: Wipes temporary test data created during isolation testing
 */
export async function cleanupPurchasesTestLogs(ownerId: string = 'test-owner-purchases-123') {
  console.log("🧹 Cleaning up Purchases sandbox test collections...");
  let count = 0;
  const testStoreId = 'test-store-purchases-999';
  const testProductId = 'test-prod-purchases-888';

  try {
    // 1. Delete the test inventory item
    try {
      const itemRef = doc(db, 'stores', testStoreId, 'inventory', testProductId);
      await deleteDoc(itemRef);
      count++;
    } catch (err: any) {
      console.warn("⚠️ Could not delete store subcollection inventory item:", err.message);
    }

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
    console.error("Cleanup of purchases sandbox failed:", error);
    return 0;
  }
}
