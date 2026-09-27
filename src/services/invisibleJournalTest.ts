import { InvisibleJournalEngine } from './InvisibleJournalEngine';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * INVISIBLE JOURNAL ENGINE UNIT TEST MODULE (ملف تجريبي)
 * Validates automatic double-entry generation, verification, and ledger balancing under isolated sandbox (عزل).
 */
export async function runInvisibleJournalEngineTest(ownerId: string = 'test-owner-id-123') {
  console.log("🚀 Starting Invisible Journal Engine Unit Test...");
  const results: string[] = [];

  try {
    // SCENARIO 1: Sell Yemen Mobile electronic balance on Cash
    console.log("🧪 Scenario 1: Sale of Yemen Mobile Balance (Cash)");
    const res1 = await InvisibleJournalEngine.postBalanceTransactionToLedger({
      ownerId,
      type: 'sale',
      amount: 500,
      cost: 480,
      price: 520,
      provider: 'Yemen Mobile',
      paymentMethod: 'cash',
      isDryRun: true
    });

    const isBalanced1 = verifyEntriesBalance(res1.entries);
    results.push(`Scenario 1 (Balance Cash Sale) Balanced: ${isBalanced1 ? '✅ PASS' : '❌ FAIL'}`);

    // SCENARIO 2: Sell Sabafon electronic balance on Debt
    console.log("🧪 Scenario 2: Sale of Sabafon Balance (Debt/Credit)");
    const res2 = await InvisibleJournalEngine.postBalanceTransactionToLedger({
      ownerId,
      type: 'sale',
      amount: 1000,
      cost: 950,
      price: 1050,
      provider: 'Sabafon',
      paymentMethod: 'debt',
      isDryRun: true
    });

    const isBalanced2 = verifyEntriesBalance(res2.entries);
    results.push(`Scenario 2 (Balance Debt Sale) Balanced: ${isBalanced2 ? '✅ PASS' : '❌ FAIL'}`);

    // SCENARIO 3: Purchase Yemen Mobile balance stock
    console.log("🧪 Scenario 3: Purchase of Yemen Mobile Balance");
    const res3 = await InvisibleJournalEngine.postBalanceTransactionToLedger({
      ownerId,
      type: 'purchase',
      amount: 5000,
      cost: 4750,
      price: 0,
      provider: 'Yemen Mobile',
      isDryRun: true
    });

    const isBalanced3 = verifyEntriesBalance(res3.entries);
    results.push(`Scenario 3 (Balance Purchase) Balanced: ${isBalanced3 ? '✅ PASS' : '❌ FAIL'}`);

    // SCENARIO 4: Purchase SIM Card Batch
    console.log("🧪 Scenario 4: Purchase of SIM Cards batch (NEW SIMs)");
    const res4 = await InvisibleJournalEngine.postSIMTransactionToLedger({
      ownerId,
      type: 'purchase',
      qty: 10,
      purchasePrice: 200,
      salesPrice: 300,
      provider: 'Yemen Mobile',
      simType: 'NEW',
      isDryRun: true
    });

    const isBalanced4 = verifyEntriesBalance(res4.entries);
    results.push(`Scenario 4 (SIM Purchase Batch) Balanced: ${isBalanced4 ? '✅ PASS' : '❌ FAIL'}`);

    // SCENARIO 5: Sell SIM card on Cash
    console.log("🧪 Scenario 5: Sale of individual SIM card (Cash)");
    const res5 = await InvisibleJournalEngine.postSIMTransactionToLedger({
      ownerId,
      type: 'sale',
      qty: 1,
      purchasePrice: 200,
      salesPrice: 350,
      provider: 'YOU',
      simType: 'NEW',
      serialNumber: '73300112233',
      paymentMethod: 'cash',
      isDryRun: true
    });

    const isBalanced5 = verifyEntriesBalance(res5.entries);
    results.push(`Scenario 5 (SIM Cash Sale) Balanced: ${isBalanced5 ? '✅ PASS' : '❌ FAIL'}`);

    console.log("\n📊 INVISIBLE JOURNAL ENGINE TEST SUMMARY:");
    results.forEach(r => console.log(r));

    return {
      success: true,
      results,
      details: { res1, res2, res3, res4, res5 }
    };
  } catch (error: any) {
    console.error("❌ Invisible Journal Engine Unit Test Failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Verification helper to assert sum(debits) === sum(credits)
 */
function verifyEntriesBalance(entries: any[]): boolean {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of entries) {
    totalDebit += entry.debit || 0;
    totalCredit += entry.credit || 0;
  }
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  console.log(`   Debit Sum: ${totalDebit} YER | Credit Sum: ${totalCredit} YER | Balanced: ${isBalanced ? '✅' : '❌'}`);
  return isBalanced;
}

/**
 * CLEANUP FUNCTION: As requested, wipes temporary test collections used under the isolation protocol.
 */
export async function cleanupInvisibleJournalTestLogs() {
  console.log("🧹 Cleaning up temporary test_journalEntries collections...");
  try {
    const q = query(collection(db, 'test_journalEntries'), where('isDryRun', '==', true));
    const snap = await getDocs(q);
    let count = 0;
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(db, 'test_journalEntries', docSnap.id));
      count++;
    }
    console.log(`✅ Cleaned up ${count} dry-run test documents.`);
    return count;
  } catch (error) {
    console.error("Cleanup failed:", error);
    return 0;
  }
}
