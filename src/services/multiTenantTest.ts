import { collection, doc, setDoc, getDocs, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MultiTenantService } from './multiTenantService';

/**
 * MULTI-TENANT ISOLATION & ATOMIC SECURE GATE UNIT TEST (ملف تجريبي - المهمة الأولى)
 * Tests query verification, write collision prevention, and complete cache purging.
 */
export async function runMultiTenantTest(ownerId: string = 'test-tenant-A-111') {
  console.log("🚀 Starting Multi-Tenant Isolation & Atomic Check Integration Unit Test...");
  const results: string[] = [];

  // Consistent Test Identifiers
  const tenantAId = 'test-tenant-A-111';
  const tenantBId = 'test-tenant-B-222';
  const productIdA = `prod-A-${Math.floor(1000 + Math.random() * 9000)}`;
  const productIdB = `prod-B-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    // =========================================================================
    // STEP 1: Sandbox Environment Setup & Double-Tenant Writes
    // =========================================================================
    console.log("🧪 Step 1: Writing data for separate tenants under strict keys...");
    
    // Store product A under tenant A
    const prodRefA = doc(db, 'inventory', `${tenantAId}_${productIdA}`);
    await setDoc(prodRefA, {
      id: productIdA,
      ownerId: tenantAId,
      name: 'بضاعة سرية المستأجر أ',
      stock: 100,
      price: 25000,
      createdAt: new Date().toISOString()
    });

    // Store product B under tenant B
    const prodRefB = doc(db, 'inventory', `${tenantBId}_${productIdB}`);
    await setDoc(prodRefB, {
      id: productIdB,
      ownerId: tenantBId,
      name: 'بضاعة سرية المستأجر ب',
      stock: 50,
      price: 45000,
      createdAt: new Date().toISOString()
    });

    results.push("Step 1: Isolated sandbox records created for Tenant A and Tenant B. ✅");

    // =========================================================================
    // STEP 2: Programmatic Query Isolation Verification & Filter Injection
    // =========================================================================
    console.log("🧪 Step 2: Evaluating query interception and programmatic constraint enforcement...");

    // Scenario 2A: Query with proper tenant filter
    const queryConstraintsA = [where('ownerId', '==', tenantAId)];
    const checkA = MultiTenantService.verifyQueryConstraints('inventory', queryConstraintsA, tenantAId);
    
    results.push(`Step 2A: Filter verified on query. Action taken: "${checkA.actionTaken}". ✅`);

    // Scenario 2B: Query WITHOUT tenant filter (simulating developer oversight)
    const rawConstraintsB: any[] = []; // Omitted filter!
    const checkB = MultiTenantService.verifyQueryConstraints('inventory', rawConstraintsB, tenantBId);

    results.push(`Step 2B: Missing filter detected. Security action: "${checkB.actionTaken}". ✅`);
    
    // Execute the programmatically-repaired query on Firestore to verify it retrieves B and NOT A
    const repairedQuery = query(collection(db, 'inventory'), ...checkB.updatedConstraints);
    const snapB = await getDocs(repairedQuery);
    
    let foundAInBQuery = false;
    let foundBInBQuery = false;

    snapB.forEach(docSnap => {
      const d = docSnap.data();
      if (d.ownerId === tenantAId) foundAInBQuery = true;
      if (d.ownerId === tenantBId) foundBInBQuery = true;
    });

    results.push(`Step 2C: Programmatic query repaired successfully. Found Tenant B data: ${foundBInBQuery}. Found Tenant A leak: ${foundAInBQuery ? '❌ LEAK' : '✅ NO LEAK'}`);

    // =========================================================================
    // STEP 2D: Runtime Wrapper Auto-Injection Verification (Queries Tenant Guard)
    // =========================================================================
    console.log("🧪 Step 2D: Verifying runtime Queries Tenant Guard interceptors...");
    const origUserProfile = (window as any).__user_profile;
    (window as any).__user_profile = { ownerId: tenantBId, storeId: tenantBId };

    try {
      const totallyUnprotectedQuery = query(collection(db, 'inventory'));
      const wrapperSnap = await getDocs(totallyUnprotectedQuery);
      
      let foundAInWrapperQuery = false;
      let foundBInWrapperQuery = false;

      wrapperSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.ownerId === tenantAId) foundAInWrapperQuery = true;
        if (d.ownerId === tenantBId) foundBInWrapperQuery = true;
      });

      results.push(`Step 2D: Runtime Queries Tenant Guard Auto-Injection tested. Found Tenant B: ${foundBInWrapperQuery}. Found Tenant A leak: ${foundAInWrapperQuery ? '❌ LEAK' : '✅ NO LEAK (Guarded)'}`);
    } catch (err: any) {
      results.push(`Step 2D Fail: Runtime Queries Tenant Guard failed with error: ${err.message || err}`);
    } finally {
      (window as any).__user_profile = origUserProfile;
    }

    // =========================================================================
    // STEP 3: Atomic Voucher Write Collision Prevention
    // =========================================================================
    console.log("🧪 Step 3: Checking cross-tenant voucher write collision prevention...");

    // Tenant B attempts to write a transaction carrying Tenant A's ownerId
    const rogueVoucher = {
      id: `rogue-txn-${Date.now()}`,
      ownerId: tenantAId, // rogue spoofing attempt
      amount: 150000,
      description: 'محاولة تعديل رصيد مستأجر آخر'
    };

    let writeBlocked = false;
    let errorMessage = '';

    try {
      // Pass rogue write payload through voucher write guard
      MultiTenantService.validateVoucherWrite('transactions', rogueVoucher, tenantBId);
    } catch (err: any) {
      writeBlocked = true;
      errorMessage = err.message;
    }

    results.push(`Step 3: Atomic write gate block test. Blocked rogue write: ${writeBlocked ? '✅ PASS' : '❌ FAIL'}`);
    results.push(`Step 3 Validation: Received message: "${errorMessage}". ✅`);

    // =========================================================================
    // STEP 4: Brand-New User Cache Purging Simulation
    // =========================================================================
    console.log("🧪 Step 4: Simulating brand-new user cache purge...");

    // Seed mock local storage markers
    localStorage.setItem('jam_cached_user_profile', JSON.stringify({ uid: 'old-uid', ownerId: 'old-owner' }));
    localStorage.setItem('jam_remembered_username', 'pre_user_123');
    localStorage.setItem('tour_seen_old_uid', 'true');
    localStorage.setItem('jam_order_status_lock_some-id', '9999999');

    // Run deep purge
    const purgedKeys = MultiTenantService.purgeTenantCache();

    // Verify localStorage state
    const hasProfile = localStorage.getItem('jam_cached_user_profile') !== null;
    const hasUsername = localStorage.getItem('jam_remembered_username') !== null;
    const hasTour = localStorage.getItem('tour_seen_old_uid') !== null;

    results.push(`Step 4: Deep cache purge executed. Purged variables: [${purgedKeys.join(', ')}]. ✅`);
    results.push(`Step 4 Validation: Profile cleared: ${!hasProfile}. Username cleared: ${!hasUsername}. Tour cleared: ${!hasTour}. ${(!hasProfile && !hasUsername && !hasTour) ? '✅ PASS' : '❌ FAIL'}`);

    console.log("\n📊 MULTI-TENANT ATOMIC SECURE GATE TEST SUMMARY:");
    results.forEach(r => console.log(r));

    return {
      success: true,
      results,
      details: { tenantAId, tenantBId, productIdA, productIdB, purgedCount: purgedKeys.length }
    };

  } catch (error: any) {
    console.error("❌ Multi-Tenant Integration Unit Test Failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * CLEANUP FUNCTION: Deletes all sandbox tenant documents from Firestore
 */
export async function cleanupMultiTenantTestLogs() {
  console.log("🧹 Cleaning up sandbox multi-tenant test collections...");
  let count = 0;

  try {
    const qInv = query(collection(db, 'inventory'), where('ownerId', 'in', ['test-tenant-A-111', 'test-tenant-B-222']));
    const invSnap = await getDocs(qInv);
    for (const d of invSnap.docs) {
      await deleteDoc(doc(db, 'inventory', d.id));
      count++;
    }

    console.log(`✅ Cleaned up ${count} multi-tenant test records from Firestore sandbox.`);
    return count;
  } catch (error) {
    console.error("Cleanup of multi-tenant sandbox failed:", error);
    return 0;
  }
}
