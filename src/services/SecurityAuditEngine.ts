import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore';
import { FirebaseProjectRouter, ProjectTier } from './FirebaseProjectRouter';

export type SecuritySeverity = 'info' | 'warning' | 'high' | 'critical';

export interface SecurityEventLog {
  id?: string;
  eventType: 'unauthorized_write_attempt' | 'cross_tenant_leak' | 'quota_breach' | 'auth_violation' | 'clean_slate_reset';
  severity: SecuritySeverity;
  sourceUid?: string;
  sourceTier?: ProjectTier;
  targetCollection?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: any;
}

export class SecurityAuditEngineClass {
  /**
   * Logs a security audit event into the SuperAdmin Master project tier (joad7723-master)
   */
  public async recordSecurityEvent(
    event: Omit<SecurityEventLog, 'id' | 'timestamp'>
  ): Promise<string> {
    try {
      const masterDb = FirebaseProjectRouter.getFirestoreForTier('super_admin');
      const payload = {
        ...event,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server/Client',
        timestamp: serverTimestamp()
      };

      const docRef = await addDoc(collection(masterDb, 'security_audit_logs'), payload);
      console.warn(`🚨 [SecurityAuditEngine] Recorded ${event.severity.toUpperCase()} event: ${event.eventType} - ${event.description}`);
      return docRef.id;
    } catch (err) {
      console.error('[SecurityAuditEngine] Failed to write security event:', err);
      return '';
    }
  }

  /**
   * Fetches recent critical security incident logs for SuperAdmin monitoring dashboard
   */
  public async fetchRecentSecurityIncidents(): Promise<SecurityEventLog[]> {
    try {
      const masterDb = FirebaseProjectRouter.getFirestoreForTier('super_admin');
      const colRef = collection(masterDb, 'security_audit_logs');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(30));

      const snap = await getDocs(q);
      const logs: SecurityEventLog[] = [];
      snap.forEach(d => {
        logs.push({ id: d.id, ...d.data() } as SecurityEventLog);
      });
      return logs;
    } catch (err) {
      console.error('[SecurityAuditEngine] Failed to fetch security incidents:', err);
      return [];
    }
  }

  /**
   * Evaluates write payload for suspicious patterns or unauthorized tenant manipulation
   */
  public inspectWritePayload(collectionPath: string, data: any, activeProfile: any): void {
    if (!activeProfile) return;

    const activeOwnerId = activeProfile.ownerId || activeProfile.parentUid || activeProfile.uid;
    const dataOwnerId = data.ownerId || data.storeId || data.tenantId;

    if (dataOwnerId && dataOwnerId !== activeOwnerId && activeProfile.role !== 'super_admin' && activeProfile.role !== 'developer') {
      this.recordSecurityEvent({
        eventType: 'cross_tenant_leak',
        severity: 'critical',
        sourceUid: activeProfile.uid,
        sourceTier: FirebaseProjectRouter.resolveTier(activeProfile.role, activeProfile),
        targetCollection: collectionPath,
        description: `محاولة كتابة بيانات تخص التاجر (${dataOwnerId}) بواسطة المستخدم (${activeProfile.uid}) المنتمي للتاجر (${activeOwnerId})`
      });
    }
  }
}

export const SecurityAuditEngine = new SecurityAuditEngineClass();
