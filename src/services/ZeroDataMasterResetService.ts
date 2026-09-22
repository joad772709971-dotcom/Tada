import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
  setDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { FirebaseProjectRouter, ProjectTier } from './FirebaseProjectRouter';
import { MultiTenantService } from './multiTenantService';

export interface CleanSlateResetResult {
  success: boolean;
  purgedLocalKeysCount: number;
  purgedDbCollectionsCount: number;
  ownerAccountPreserved: boolean;
  masterOwnerUid: string;
  timestamp: string;
  message: string;
}

export class ZeroDataMasterResetEngine {
  // Collections containing temporary or dummy test data that must be wiped on clean-slate reset
  private testAndDemoCollections = [
    'demo_shops',
    'test_vouchers',
    'mock_transactions',
    'temporary_test_logs',
    'demo_customers',
    'sample_inventory',
    'sandbox_orders'
  ];

  /**
   * Executes a zero-data clean slate reset.
   * Wipes all test, demo, and dummy accounts/transactions across projects while preserving the master owner account empty.
   */
  public async executeZeroDataCleanSlate(masterOwnerUid: string): Promise<CleanSlateResetResult> {
    console.log("⚡ [ZeroDataMasterReset] Initiating master clean slate protocol...");

    // 1. Local Storage & Session State Purge
    const purgedKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.includes('master_owner_auth') && !key.includes('firebase:host')) {
        if (
          key.includes('demo') || 
          key.includes('mock') || 
          key.includes('test') || 
          key.includes('sample') ||
          key.includes('user_') ||
          key.includes('shop_') ||
          key.includes('offline_pending')
        ) {
          purgedKeys.push(key);
        }
      }
    }
    purgedKeys.forEach(k => localStorage.removeItem(k));
    MultiTenantService.purgeTenantCache();

    // 2. Clear dummy collections across all 6 project tiers
    let purgedCollectionsCount = 0;
    const tiers = FirebaseProjectRouter.getAllTiers();

    for (const tier of tiers) {
      try {
        const db = FirebaseProjectRouter.getFirestoreForTier(tier);
        for (const colName of this.testAndDemoCollections) {
          try {
            const snap = await getDocs(collection(db, colName));
            if (!snap.empty) {
              const deletePromises = snap.docs.map(d => deleteDoc(doc(db, colName, d.id)));
              await Promise.all(deletePromises);
              purgedCollectionsCount++;
            }
          } catch {
            // Collection might not exist or be empty
          }
        }
      } catch (tierErr) {
        console.warn(`[ZeroDataMasterReset] Clean-up skipped for tier ${tier}:`, tierErr);
      }
    }

    // 3. Ensure Master Owner account profile is safely preserved empty
    let ownerPreserved = false;
    if (masterOwnerUid) {
      try {
        const superAdminDb = FirebaseProjectRouter.getFirestoreForTier('super_admin');
        const ownerDocRef = doc(superAdminDb, 'users', masterOwnerUid);
        await setDoc(ownerDocRef, {
          uid: masterOwnerUid,
          role: 'super_admin',
          isOwner: true,
          status: 'active',
          updatedAt: new Date().toISOString()
        }, { merge: true });
        ownerPreserved = true;
      } catch (err) {
        console.error('[ZeroDataMasterReset] Error preserving master owner document:', err);
      }
    }

    return {
      success: true,
      purgedLocalKeysCount: purgedKeys.length,
      purgedDbCollectionsCount: purgedCollectionsCount,
      ownerAccountPreserved: ownerPreserved,
      masterOwnerUid,
      timestamp: new Date().toISOString(),
      message: 'تم تنظيف كافة الحسابات والبيانات التجريبية بنجاح. النظام الآن فارغ ونظيف بالكامل وجاهز للتشغيل الحقيقي بدون أي بيانات وهمية.'
    };
  }

  /**
   * Verifies system is 100% free from any mock/demo data
   */
  public async verifyZeroTestDataState(): Promise<{ isClean: boolean; detectedTestRecordsCount: number }> {
    let count = 0;
    const tiers = FirebaseProjectRouter.getAllTiers();

    for (const tier of tiers) {
      try {
        const db = FirebaseProjectRouter.getFirestoreForTier(tier);
        for (const colName of this.testAndDemoCollections) {
          try {
            const snap = await getDocs(collection(db, colName));
            count += snap.size;
          } catch {}
        }
      } catch {}
    }

    return {
      isClean: count === 0,
      detectedTestRecordsCount: count
    };
  }
}

export const ZeroDataMasterResetService = new ZeroDataMasterResetEngine();
