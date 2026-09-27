import { postMaintenanceToLedger, postPettyCashOrSalaryToLedger } from './MaintenanceFinancialService';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * MAINTENANCE & EXPENSES INTEGRATION UNIT TEST MODULE (ملف تجريبي - المهمة الرابعة)
 * Validates double-entry postings for maintenance tickets, commissions, and petty cash expenses.
 */
export async function runMaintenanceTest(ownerId: string = 'test-owner-maintenance-123') {
  console.log("🚀 Starting Maintenance & Expenses Integration Unit Test...");
  const results: string[] = [];

  try {
    // SCENARIO 1: Paid Maintenance with Engineer Commission (صيانة نقداً مع عمولة مهندس)
    // Debit Cash (1101): 4000 YER
    // Credit Maintenance Revenue (4200): 4000 YER
    // Debit Commission Expense (5100): 800 YER
    // Credit Cash (1101): 800 YER
    console.log("🧪 Scenario 1: Paid Maintenance with Commission");
    const mData1 = {
      ownerId,
      total: 4000,
      isPaid: true,
      engineerCommission: 800,
      engineerName: 'المهندس أحمد صالح',
      ticketNumber: 'TEST-MNT-101',
      customerName: 'محمد السنيدار'
    };

    const res1 = await postMaintenanceToLedger(mData1);
    results.push(`Scenario 1 (Paid Maintenance & Commission): Posted with Ref ${res1.reference}. ✅`);

    // SCENARIO 2: Credit Maintenance (صيانة على الحساب / آجل)
    // Debit Receivables (1200): 2500 YER
    // Credit Maintenance Revenue (4200): 2500 YER
    console.log("🧪 Scenario 2: Credit Maintenance");
    const mData2 = {
      ownerId,
      total: 2500,
      isPaid: false,
      engineerCommission: 0,
      ticketNumber: 'TEST-MNT-102',
      customerName: 'خالد الارياني'
    };

    const res2 = await postMaintenanceToLedger(mData2);
    results.push(`Scenario 2 (Credit Maintenance): Posted with Ref ${res2.reference}. ✅`);

    // SCENARIO 3: Petty Cash & General Expenses / Salaries (المصاريف والرواتب والنثريات)
    // Debit Admin/Salaries Expense (5200): 15000 YER
    // Credit Cash (1101): 15000 YER
    console.log("🧪 Scenario 3: Salary Payout");
    const eData1 = {
      ownerId,
      amount: 15000,
      type: 'salary',
      description: 'مرتب شهر يوليو للمساعد المالي',
      recipientName: 'صلاح اليماني',
      voucherNumber: 'TEST-EXP-501'
    };

    const res3 = await postPettyCashOrSalaryToLedger(eData1);
    results.push(`Scenario 3 (Salary Payout Expense): Posted with Ref ${res3.reference}. ✅`);

    console.log("\n📊 MAINTENANCE & EXPENSES INTEGRATION TEST SUMMARY:");
    results.forEach(r => console.log(r));

    return {
      success: true,
      results,
      details: { res1, res2, res3 }
    };
  } catch (error: any) {
    console.error("❌ Maintenance Integration Unit Test Failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * CLEANUP FUNCTION: Wipes temporary test data created during maintenance isolation testing
 */
export async function cleanupMaintenanceTestLogs(ownerId: string = 'test-owner-maintenance-123') {
  console.log("🧹 Cleaning up Maintenance sandbox test collections...");
  let count = 0;

  try {
    // 1. Query and delete temporary journal entries
    const qEntries = query(collection(db, 'journalEntries'), where('ownerId', '==', ownerId));
    const entriesSnap = await getDocs(qEntries);
    for (const d of entriesSnap.docs) {
      await deleteDoc(doc(db, 'journalEntries', d.id));
      count++;
    }

    // 2. Query and delete temporary accounts
    const qAccounts = query(collection(db, 'accounts'), where('ownerId', '==', ownerId));
    const accountsSnap = await getDocs(qAccounts);
    for (const d of accountsSnap.docs) {
      await deleteDoc(doc(db, 'accounts', d.id));
      count++;
    }

    console.log(`✅ Cleaned up ${count} temporary maintenance test documents from sandbox.`);
    return count;
  } catch (error) {
    console.error("Cleanup of maintenance sandbox failed:", error);
    return 0;
  }
}
