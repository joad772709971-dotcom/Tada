/**
 * ⚡ UNIT TEST: Offline Sync State & Transaction Timestamps / Shutdown Resilience Test
 * (سكربت فحص المزامنة الأوفلاين والطوابع الزمنية والحماية من الإغلاق المفاجئ)
 */

import { OfflineSyncValidatorService } from './OfflineSyncValidatorService';

// Polyfill localStorage for Node CLI execution if undefined
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

export async function runOfflineSyncValidatorTest(): Promise<{ success: boolean; log: string[] }> {
  const log: string[] = [];
  log.push('🚀 [TEST START] Offline Sync State & Timestamp Integrity Audit Test...');

  const STORAGE_QUEUE_KEY = 'jam_pending_offline_queue_v2';
  const originalQueue = localStorage.getItem(STORAGE_QUEUE_KEY);

  try {
    // =========================================================================
    // STEP 1: Inject Test Transactions (Valid, Invalid Timestamps, Shutdown Corrupted)
    // =========================================================================
    log.push('🧪 STEP 1: Injecting test offline queue containing simulated corruptions...');

    const sampleValidTimestamp = Date.now() - 3600000; // 1 hour ago
    const mockQueueData = [
      // 1. Valid transaction
      {
        id: 'tx_valid_101',
        storeId: 'store_test_yemen',
        userId: 'cashier_01',
        collectionName: 'sales',
        action: 'add',
        createdAt: sampleValidTimestamp,
        attempts: 0,
        data: {
          id: 'sale_101',
          total: 15000,
          currency: 'YER',
          items: [{ name: 'صنف سليم', price: 15000, qty: 1 }]
        }
      },
      // 2. Transaction with corrupted / missing timestamp (e.g. power loss during timestamp assignment)
      {
        id: 'tx_corrupt_time_102',
        storeId: 'store_test_yemen',
        userId: 'cashier_01',
        collectionName: 'sales',
        action: 'add',
        createdAt: null, // INVALID!
        attempts: 0,
        data: {
          id: 'sale_102',
          total: 8000,
          currency: 'YER'
        }
      },
      // 3. Transaction with string/invalid NaN timestamp
      {
        id: 'tx_nan_time_103',
        storeId: 'store_test_yemen',
        userId: 'cashier_01',
        collectionName: 'journalEntries',
        action: 'add',
        createdAt: 'INVALID_TIMESTAMP_STRING', // INVALID!
        attempts: 0,
        data: {
          id: 'journal_103',
          amount: 5000,
          type: 'debit'
        }
      },
      // 4. Corrupted transaction caused by sudden shutdown (missing data payload & action)
      {
        id: 'tx_aborted_shutdown_104',
        storeId: 'store_test_yemen',
        userId: 'cashier_01',
        // Missing collectionName, action, and data!
        createdAt: Date.now()
      },
      // 5. Transaction missing storeId / userId
      {
        id: 'tx_no_tenant_105',
        collectionName: 'sales',
        action: 'add',
        createdAt: Date.now() - 7200000,
        attempts: 0,
        data: {
          id: 'sale_105',
          total: 3000
        }
      }
    ];

    localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(mockQueueData));
    log.push(`✅ Injected ${mockQueueData.length} mock transactions into localStorage (${STORAGE_QUEUE_KEY}).`);

    // =========================================================================
    // STEP 2: Run Offline Sync Inspection and Auto-Repair
    // =========================================================================
    log.push('🔍 STEP 2: Running OfflineSyncValidatorService.inspectAndValidateQueue(autoRepair = true)...');

    const report = await OfflineSyncValidatorService.inspectAndValidateQueue(true);

    log.push(`📊 Audit Report Status: ${report.integrityStatus}`);
    log.push(`📊 Total Inspected: ${report.totalPendingTransactions}`);
    log.push(`📊 Valid Transactions: ${report.validTransactionsCount}`);
    log.push(`📊 Invalid Timestamps Repaired: ${report.repairedCount}`);
    log.push(`📊 Shutdown Aborted Transactions Quarantined: ${report.quarantinedCount}`);

    // =========================================================================
    // STEP 3: Verify Integrity & Repair Results
    // =========================================================================
    log.push('🛡️ STEP 3: Verifying queue repair results...');

    const repairedQueueRaw = localStorage.getItem(STORAGE_QUEUE_KEY);
    const repairedQueue: any[] = repairedQueueRaw ? JSON.parse(repairedQueueRaw) : [];

    log.push(`📦 Repaired Queue Length: ${repairedQueue.length}`);

    // Check if invalid timestamp item (tx_corrupt_time_102) was repaired with valid timestamp
    const item102 = repairedQueue.find(x => x.id === 'tx_corrupt_time_102');
    const is102Repaired = item102 && typeof item102.createdAt === 'number' && item102.createdAt > 0;
    log.push(`Verification 1: TX tx_corrupt_time_102 timestamp repaired: ${is102Repaired ? '✅ PASSED' : '❌ FAILED'}`);

    // Check if NaN string timestamp item (tx_nan_time_103) was repaired
    const item103 = repairedQueue.find(x => x.id === 'tx_nan_time_103');
    const is103Repaired = item103 && typeof item103.createdAt === 'number' && item103.createdAt > 0;
    log.push(`Verification 2: TX tx_nan_time_103 timestamp repaired: ${is103Repaired ? '✅ PASSED' : '❌ FAILED'}`);

    // Check if shutdown aborted item (tx_aborted_shutdown_104) was removed/quarantined from main queue
    const item104 = repairedQueue.find(x => x.id === 'tx_aborted_shutdown_104');
    const is104Quarantined = !item104;
    log.push(`Verification 3: Corrupted shutdown item tx_aborted_shutdown_104 quarantined: ${is104Quarantined ? '✅ PASSED' : '❌ FAILED'}`);

    // Check if missing tenant item (tx_no_tenant_105) received default tenant
    const item105 = repairedQueue.find(x => x.id === 'tx_no_tenant_105');
    const is105Fixed = item105 && item105.storeId && item105.userId;
    log.push(`Verification 4: Missing tenant item tx_no_tenant_105 tenant assigned: ${is105Fixed ? '✅ PASSED' : '❌ FAILED'}`);

    // Verify all remaining items in queue have valid numbers for createdAt
    const allTimestampsValid = repairedQueue.every(op => typeof op.createdAt === 'number' && !isNaN(op.createdAt) && op.createdAt > 0);
    log.push(`Verification 5: ALL remaining transactions have 100% valid timestamps: ${allTimestampsValid ? '✅ PASSED' : '❌ FAILED'}`);

    // =========================================================================
    // STEP 4: Test Transactions Array Validator Function
    // =========================================================================
    log.push('🧪 STEP 4: Testing array validator function for sales & journal entries...');

    const mockSalesArray = [
      { id: 'sale_1', total: 500, createdAt: '2026-05-15T12:00:00Z' },
      { id: 'sale_2', total: 700, createdAt: null }, // Corrupted
      { id: 'sale_3', total: 900, createdAt: undefined } // Corrupted
    ];

    const arrayValidation = OfflineSyncValidatorService.validateTransactionsArray(mockSalesArray);
    log.push(`Array Validator: Inputs: ${mockSalesArray.length}, Repaired Fixes: ${arrayValidation.fixesCount}, Valid Output: ${arrayValidation.valid.length}`);

    const isArrayTestPassed = arrayValidation.fixesCount === 2 && arrayValidation.valid.length === 3;
    log.push(`Verification 6: Array Timestamp Repair: ${isArrayTestPassed ? '✅ PASSED' : '❌ FAILED'}`);

    const overallSuccess = is102Repaired && is103Repaired && is104Quarantined && is105Fixed && allTimestampsValid && isArrayTestPassed;

    if (overallSuccess) {
      log.push('🎉 [TEST SUCCESS] Offline Sync State & Timestamp Integrity Audit PASSED completely!');
    } else {
      log.push('❌ [TEST FAILED] Some verification checks failed.');
    }

    return { success: overallSuccess, log };

  } finally {
    // Restore original queue if present
    if (originalQueue !== null) {
      localStorage.setItem(STORAGE_QUEUE_KEY, originalQueue);
    } else {
      localStorage.removeItem(STORAGE_QUEUE_KEY);
    }
  }
}

// Node CLI Runner for tsx execution
if (import.meta.url.endsWith('offlineSyncValidatorTest.ts') || process.argv[1]?.includes('offlineSyncValidatorTest')) {
  runOfflineSyncValidatorTest().then(({ success, log }) => {
    console.log('\n--- OFFLINE SYNC VALIDATOR TEST RESULTS ---');
    log.forEach(line => console.log(line));
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error('Test script runtime exception:', err);
    process.exit(1);
  });
}
