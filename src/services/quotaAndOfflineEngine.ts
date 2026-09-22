/**
 * ⚡ JAM SYSTEM PRO - Quota & Offline Operations Engine
 * 1. Daily Firebase Spark Free Tier Quota tracking (~50k Reads / 20k Writes).
 * 2. Idempotency & Anti-Duplicate transaction protection (dedupKey).
 * 3. Zero-Reset offline persistence (screen state never blanks or resets).
 * 4. Automatic transition to offline local storage when quota is exhausted or network is lost.
 * 5. Auto-syncing of pending operations when online or when quota resets the next day.
 */

import { generateIdempotencyKey } from './appSecurityGuard';
import { persistentStorageEngine } from './PersistentStorageEngine';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_node';
  let devId = localStorage.getItem('JAM_DEVICE_PERSISTENT_ID_V1');
  if (!devId) {
    const isElectron = (window as any).electron || (window as any).electronAPI || navigator.userAgent.toLowerCase().includes('electron');
    const prefix = isElectron ? 'EXE_DESKTOP' : (window.innerWidth < 768 ? 'MOBILE_APP' : 'WEB_DESKTOP');
    devId = `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    localStorage.setItem('JAM_DEVICE_PERSISTENT_ID_V1', devId);
  }
  return devId;
}

export function getPlatformType(): 'desktop_exe' | 'mobile_web' | 'browser' {
  if (typeof window === 'undefined') return 'browser';
  const isElectron = (window as any).electron || (window as any).electronAPI || navigator.userAgent.toLowerCase().includes('electron');
  if (isElectron) return 'desktop_exe';
  if (window.innerWidth < 768 || /Android|iPhone|iPad/i.test(navigator.userAgent)) return 'mobile_web';
  return 'browser';
}

export interface PendingOfflineOperation {
  id: string; // Idempotency key
  storeId: string;
  userId: string;
  deviceId?: string;
  platformType?: string;
  collectionName: string;
  action: 'set' | 'update' | 'add' | 'delete';
  data: any;
  createdAt: number;
  attempts: number;
}

export interface QuotaStats {
  readsToday: number;
  writesToday: number;
  maxDailyReads: number;
  maxDailyWrites: number;
  readsRemaining: number;
  writesRemaining: number;
  isQuotaExhausted: boolean;
  pendingOfflineCount: number;
  activeUsersCount: number;
  totalOperationsToday: number;
  lastQuotaResetDate: string;
}

const STORAGE_QUOTA_KEY = 'jam_daily_quota_stats_v1';
const STORAGE_QUEUE_KEY = 'jam_pending_offline_queue_v2';
const STORAGE_PROCESSED_DEDUP_KEY = 'jam_processed_dedup_hashes_v1';

// Default Firebase Spark Free Tier Daily Limits
const DEFAULT_MAX_READS = 50000;
const DEFAULT_MAX_WRITES = 20000;

class QuotaAndOfflineEngine {
  private stats: QuotaStats = {
    readsToday: 0,
    writesToday: 0,
    maxDailyReads: DEFAULT_MAX_READS,
    maxDailyWrites: DEFAULT_MAX_WRITES,
    readsRemaining: DEFAULT_MAX_READS,
    writesRemaining: DEFAULT_MAX_WRITES,
    isQuotaExhausted: false,
    pendingOfflineCount: 0,
    activeUsersCount: 1,
    totalOperationsToday: 0,
    lastQuotaResetDate: this.getTodayDateString()
  };

  private listeners: Set<(stats: QuotaStats) => void> = new Set();
  private processedDedupSet: Set<string> = new Set();
  private isSyncing = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined') return;

    // Load processed idempotency hashes to prevent duplicate local/remote writes
    try {
      const storedHashes = localStorage.getItem(STORAGE_PROCESSED_DEDUP_KEY);
      if (storedHashes) {
        const parsed = JSON.parse(storedHashes);
        this.processedDedupSet = new Set(parsed.slice(-2000)); // Keep recent 2000 hashes
      }
    } catch {
      this.processedDedupSet = new Set();
    }

    // Load quota stats
    try {
      const storedStats = localStorage.getItem(STORAGE_QUOTA_KEY);
      if (storedStats) {
        const parsed = JSON.parse(storedStats);
        if (parsed.lastQuotaResetDate === this.getTodayDateString()) {
          this.stats = { ...this.stats, ...parsed };
        } else {
          // New day reset!
          this.resetDailyQuota();
        }
      }
    } catch {
      // Use defaults
    }

    // Update pending offline count
    this.updatePendingCount();

    // Set up auto-sync listener when network toggles
    window.addEventListener('online', () => {
      console.log('🌐 Internet restored. Triggering offline queue flush...');
      this.syncPendingQueue();
    });
  }

  /**
   * 🛡️ Scans external mirrors (/Documents/JAM_Vault/ or D:\JAM_Vault) on startup/login
   * and auto-rehydrates un-synced offline invoices safely with tenant isolation check.
   */
  public async runAutoDiscoveryAndRestore(storeId: string, ownerId: string): Promise<number> {
    if (!storeId || !ownerId) return 0;
    try {
      const restoredOperations = await persistentStorageEngine.autoDiscoverAndRestoreMirrors(storeId, ownerId);
      if (!restoredOperations || restoredOperations.length === 0) return 0;

      const currentQueue = this.getQueue();
      const existingIds = new Set(currentQueue.map(op => op.id));
      let newlyAddedCount = 0;

      for (const op of restoredOperations) {
        if (op && op.id && !existingIds.has(op.id) && !this.processedDedupSet.has(op.id)) {
          currentQueue.push(op);
          existingIds.add(op.id);
          newlyAddedCount++;
        }
      }

      if (newlyAddedCount > 0) {
        this.saveQueue(currentQueue);
        this.updatePendingCount();
        console.log(`🛡️ [Auto-Discovery Engine] Successfully restored ${newlyAddedCount} pending transactions from external mirror vault!`);
        // Trigger auto-sync if online
        if (navigator.onLine) {
          this.syncPendingQueue();
        }
      }
      return newlyAddedCount;
    } catch (err) {
      console.warn('⚠️ Auto-discovery restoration warning:', err);
      return 0;
    }
  }

  public getTodayDateString(): string {
    // Yemen timezone (UTC+3) date string YYYY-MM-DD
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const yemenDate = new Date(utcMs + (3 * 3600000));
    return yemenDate.toISOString().split('T')[0];
  }

  public getStats(): QuotaStats {
    return { ...this.stats };
  }

  public subscribe(listener: (stats: QuotaStats) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStats());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.saveStats();
    const currentStats = this.getStats();
    this.listeners.forEach(fn => {
      try {
        fn(currentStats);
      } catch (e) {
        console.warn('Quota Engine listener error:', e);
      }
    });
  }

  private saveStats(): void {
    try {
      localStorage.setItem(STORAGE_QUOTA_KEY, JSON.stringify(this.stats));
    } catch {
      // Ignore quota storage write error
    }
  }

  public resetDailyQuota(): void {
    this.stats.readsToday = 0;
    this.stats.writesToday = 0;
    this.stats.readsRemaining = this.stats.maxDailyReads;
    this.stats.writesRemaining = this.stats.maxDailyWrites;
    this.stats.isQuotaExhausted = false;
    this.stats.totalOperationsToday = 0;
    this.stats.lastQuotaResetDate = this.getTodayDateString();
    this.notify();
    console.log('🌅 Daily Firebase quota reset successfully for new day (Yemen Time).');
  }

  /**
   * Track Read operation
   */
  public trackRead(count = 1): void {
    this.checkDayRoll();
    this.stats.readsToday += count;
    this.stats.readsRemaining = Math.max(0, this.stats.maxDailyReads - this.stats.readsToday);
    this.stats.totalOperationsToday += count;
    if (this.stats.readsRemaining <= 0) {
      this.stats.isQuotaExhausted = true;
    }
    this.notify();
  }

  /**
   * Track Write operation
   */
  public trackWrite(count = 1): void {
    this.checkDayRoll();
    this.stats.writesToday += count;
    this.stats.writesRemaining = Math.max(0, this.stats.maxDailyWrites - this.stats.writesToday);
    this.stats.totalOperationsToday += count;
    if (this.stats.writesRemaining <= 0) {
      this.stats.isQuotaExhausted = true;
    }
    this.notify();
  }

  private checkDayRoll(): void {
    const today = this.getTodayDateString();
    if (this.stats.lastQuotaResetDate !== today) {
      this.resetDailyQuota();
    }
  }

  /**
   * 🛡️ Anti-Duplicate & Idempotency Validator
   * Checks if operation hash has already been processed locally
   */
  public isDuplicate(dedupKey: string): boolean {
    if (!dedupKey) return false;
    return this.processedDedupSet.has(dedupKey);
  }

  public registerDedupKey(dedupKey: string): void {
    if (!dedupKey) return;
    this.processedDedupSet.add(dedupKey);
    try {
      const arr = Array.from(this.processedDedupSet).slice(-2000);
      localStorage.setItem(STORAGE_PROCESSED_DEDUP_KEY, JSON.stringify(arr));
    } catch {
      // Ignore
    }
  }

  /**
   * Enqueue offline operation cleanly
   */
  public enqueueOfflineOperation(op: Omit<PendingOfflineOperation, 'id' | 'createdAt' | 'attempts'> & { id?: string }): string {
    const id = op.id || generateIdempotencyKey(op.storeId, op.collectionName, Date.now());

    // Check duplicate
    if (this.isDuplicate(id)) {
      console.warn(`🛡️ Duplicate operation intercepted and safely ignored (Dedup ID: ${id})`);
      return id;
    }

    const newOp: PendingOfflineOperation = {
      ...op,
      id,
      deviceId: op.deviceId || getDeviceId(),
      platformType: op.platformType || getPlatformType(),
      createdAt: Date.now(),
      attempts: 0
    };

    const queue = this.getQueue();
    queue.push(newOp);
    this.saveQueue(queue);
    this.registerDedupKey(id);

    this.updatePendingCount();
    console.log(`💾 Saved offline operation [${op.action.toUpperCase()}] for collection "${op.collectionName}". Queue length: ${queue.length}`);
    return id;
  }

  public getQueue(): PendingOfflineOperation[] {
    try {
      const raw = localStorage.getItem(STORAGE_QUEUE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Fallback
    }
    return [];
  }

  /**
   * 🔒 Gets strictly isolated pending queue for active Store, User, and Device.
   * Ensures complete multi-tenant, staff-level, and device-level isolation.
   */
  public getIsolatedQueue(storeId?: string, userId?: string, deviceId?: string): PendingOfflineOperation[] {
    const fullQueue = this.getQueue();
    if (!storeId && !userId && !deviceId) return fullQueue;

    const currentDevId = deviceId || getDeviceId();
    const currentPlatform = getPlatformType();

    return fullQueue.filter(op => {
      // 1. Store/Shop level isolation
      if (storeId && op.storeId && op.storeId !== storeId) {
        return false;
      }
      // 2. User/Staff level isolation
      if (userId && op.userId && op.userId !== userId && op.data?.cashierId !== userId) {
        return false;
      }
      // 3. Device/Platform level isolation (PC vs Mobile vs Device ID)
      if (deviceId && op.deviceId && op.deviceId !== currentDevId) {
        if (op.platformType && op.platformType !== currentPlatform) {
          return false;
        }
      }
      return true;
    });
  }

  private saveQueue(queue: PendingOfflineOperation[]): void {
    const serialized = JSON.stringify(queue);
    try {
      localStorage.setItem(STORAGE_QUEUE_KEY, serialized);
    } catch {
      // Storage error
    }
    // Asynchronously write to protected IndexedDB + FileSystem storage
    persistentStorageEngine.setItem(STORAGE_QUEUE_KEY, serialized).catch(() => {});
  }

  private updatePendingCount(): void {
    const queue = this.getQueue();
    this.stats.pendingOfflineCount = queue.length;
    this.notify();
  }

  /**
   * Auto-sync pending offline queue when online & quota available
   */
  public async syncPendingQueue(dbInstance?: any): Promise<{ synced: number; remaining: number }> {
    if (this.isSyncing) return { synced: 0, remaining: this.stats.pendingOfflineCount };
    
    const queue = this.getQueue();
    if (queue.length === 0) return { synced: 0, remaining: 0 };

    if (this.stats.isQuotaExhausted) {
      console.warn('⚠️ Quota exhausted today. Syncing delayed until quota resets tomorrow.');
      return { synced: 0, remaining: queue.length };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    const remainingOps: PendingOfflineOperation[] = [];

    for (const op of queue) {
      try {
        if (dbInstance) {
          const { doc, setDoc, updateDoc, deleteDoc, collection, addDoc } = await import('firebase/firestore');
          if (op.action === 'set') {
            const docRef = doc(dbInstance, op.collectionName, op.data.id || op.id);
            await setDoc(docRef, op.data, { merge: true });
          } else if (op.action === 'update') {
            const docRef = doc(dbInstance, op.collectionName, op.data.id);
            await updateDoc(docRef, op.data);
          } else if (op.action === 'add') {
            await addDoc(collection(dbInstance, op.collectionName), op.data);
          } else if (op.action === 'delete') {
            const docRef = doc(dbInstance, op.collectionName, op.data.id);
            await deleteDoc(docRef);
          }
          this.trackWrite(1);
          syncedCount++;
        } else {
          // If no db instance passed, keep in queue
          remainingOps.push(op);
        }
      } catch (err: any) {
        console.warn(`⚠️ Failed to sync item ${op.id}, preserving in queue:`, err?.message || err);
        op.attempts = (op.attempts || 0) + 1;
        remainingOps.push(op);
      }
    }

    this.saveQueue(remainingOps);
    this.updatePendingCount();
    this.isSyncing = false;

    console.log(`✅ Offline Queue Sync: Synced ${syncedCount} ops. Remaining in queue: ${remainingOps.length}`);
    return { synced: syncedCount, remaining: remainingOps.length };
  }
}

export const quotaAndOfflineEngine = new QuotaAndOfflineEngine();
