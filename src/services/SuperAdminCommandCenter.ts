import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { FirebaseProjectRouter, ProjectTier, PROJECT_TIER_CONFIGS } from './FirebaseProjectRouter';

export interface TierHealthMetrics {
  tier: ProjectTier;
  projectId: string;
  status: 'online' | 'degraded' | 'offline';
  activeMerchantsCount: number;
  totalOrdersCount: number;
  totalVolumeYer: number;
  lastPingTimestamp: number;
  storageQuotaMb: number;
}

export interface GlobalSystemOverview {
  totalProjectsCount: number;
  overallHealth: 'healthy' | 'warning' | 'critical';
  combinedVolumeYer: number;
  combinedMerchantsCount: number;
  tierMetrics: Record<ProjectTier, TierHealthMetrics>;
}

export class SuperAdminCommandCenterEngine {
  /**
   * Fetches health, active stores, and order metrics across all 6 Firebase Project Tiers
   */
  public async fetchGlobalSystemOverview(): Promise<GlobalSystemOverview> {
    const tiers = FirebaseProjectRouter.getAllTiers();
    const metricsMap: Record<string, TierHealthMetrics> = {};
    let globalVolume = 0;
    let globalMerchants = 0;

    for (const tier of tiers) {
      try {
        const db = FirebaseProjectRouter.getFirestoreForTier(tier);
        const config = PROJECT_TIER_CONFIGS[tier];

        // 1. Fetch active merchants count in this project
        let merchantsCount = 0;
        try {
          const shopsSnap = await getDocs(collection(db, 'shops'));
          merchantsCount = shopsSnap.size;
        } catch {
          merchantsCount = 0;
        }

        // 2. Fetch order metrics in this project
        let ordersCount = 0;
        let tierVolume = 0;
        try {
          const ordersSnap = await getDocs(collection(db, 'transactions'));
          ordersCount = ordersSnap.size;
          ordersSnap.forEach(doc => {
            const data = doc.data();
            tierVolume += Number(data.totalAmount || data.amount || data.netTotal || 0);
          });
        } catch {
          // If transactions collection differs per tier
          ordersCount = 0;
        }

        globalMerchants += merchantsCount;
        globalVolume += tierVolume;

        metricsMap[tier] = {
          tier,
          projectId: config.projectId,
          status: 'online',
          activeMerchantsCount: merchantsCount,
          totalOrdersCount: ordersCount,
          totalVolumeYer: tierVolume,
          lastPingTimestamp: Date.now(),
          storageQuotaMb: 1024 // Allocated tier limit
        };
      } catch (err) {
        console.warn(`[CommandCenter] Failed to inspect tier ${tier}:`, err);
        const config = PROJECT_TIER_CONFIGS[tier];
        metricsMap[tier] = {
          tier,
          projectId: config.projectId,
          status: 'degraded',
          activeMerchantsCount: 0,
          totalOrdersCount: 0,
          totalVolumeYer: 0,
          lastPingTimestamp: Date.now(),
          storageQuotaMb: 1024
        };
      }
    }

    return {
      totalProjectsCount: tiers.length,
      overallHealth: 'healthy',
      combinedVolumeYer: globalVolume,
      combinedMerchantsCount: globalMerchants,
      tierMetrics: metricsMap as Record<ProjectTier, TierHealthMetrics>
    };
  }

  /**
   * Real-time stream of audit logs across the Super Admin master project tier (joad7723-master)
   */
  public subscribeToMasterAuditLogs(
    onLogsUpdated: (logs: any[]) => void
  ): Unsubscribe {
    const masterDb = FirebaseProjectRouter.getFirestoreForTier('super_admin');
    const colRef = collection(masterDb, 'system_audit_logs');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));

    return onSnapshot(
      q,
      (snap) => {
        const logs: any[] = [];
        snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
        onLogsUpdated(logs);
      },
      (err) => {
        console.error('[CommandCenter] Audit log listener error:', err);
        onLogsUpdated([]);
      }
    );
  }
}

export const SuperAdminCommandCenter = new SuperAdminCommandCenterEngine();
