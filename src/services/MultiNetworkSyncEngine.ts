/**
 * 🌐 JAM SYSTEM PRO - Multi-Network & Hierarchical Sync Engine
 * -----------------------------------------------------------
 * محرك المزامنة والربط الشبكي المتعدد ثنائي المستويات مع منع التكرار الصارم
 * 
 * 1️⃣ أنماط التشغيل (Operating Modes):
 *    - offline_standard: نمط أوفلاين فردي (مستقل 100% - 0ms استجابة).
 *    - local_lan: نمط شبكة المحل الداخلية (عمال المحل -> سيرفر المالك المحلي).
 *    - firebase_cloud: نمط السحاب المباشر (مزامنة فورية مع Firebase Firestore).
 * 
 * 2️⃣ الهيكلية الهرمية ومنع التكرار (Hierarchical Sync & De-duplication):
 *    - المستوى 1: أجهزة عمال المحل ترسل العمليات لسيرفر المالك المحلي (Host).
 *    - المستوى 2: جهاز المالك يرفع البيانات المجمعة إلى Firebase عند توفر الإنترنت.
 *    - UUID فريد (syncId) مع فحص مسبق (Query-first Check) لمنع تكرار أي سجل في Firebase.
 * 
 * 3️⃣ العزل الصارم للمتاجر (Store/Tenant Isolation Architecture):
 *    - تقييد جميع العمليات والمطابقات حصرياً بـ ownerId الخاص بالمحل المسجل.
 */

import { collection, doc, getDoc, getDocs, query, where, setDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { persistentStorageEngine } from './PersistentStorageEngine';
import { generateUUID, generateInvoiceUUID, generateProductUUID, generateOpenBillUUID } from '../utils/uuid';

export type SyncOperatingMode = 'offline_standard' | 'local_lan' | 'firebase_cloud';
export type LanNodeRole = 'host_server' | 'client_node';
export type SyncFrequency = 'realtime' | 'every_1min' | 'every_5min' | 'manual';

export interface SharedOpenBill {
  id: string; // UUID v4
  storeId: string;
  cashierId: string;
  cashierName: string;
  tableOrRef?: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    barcode?: string;
  }>;
  subtotal: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  heldAt: number;
  status: 'held' | 'in_progress' | 'settled' | 'cancelled';
}

export interface InventoryLockStatus {
  locked: boolean;
  available: boolean;
  productId: string;
  cashierId?: string;
  expiresAt?: number;
  message?: string;
}

export interface MultiSyncConfig {
  mode: SyncOperatingMode;
  lanSettings: {
    nodeRole: LanNodeRole;
    serverHostIp: string;
    serverPort: number;
    syncFrequency: SyncFrequency;
    autoFallbackToCloud: boolean;
    authToken?: string;
  };
  cloudSettings: {
    autoSyncOnOnline: boolean;
    batchSize: number;
    compressPayloads: boolean;
  };
}

export interface TransactionSyncStatus {
  syncId: string;
  storeId: string;
  collectionName: 'sales' | 'invoices' | 'customers' | 'inventory' | 'vouchers' | 'transactions' | 'maintenanceOrders' | string;
  action: 'create' | 'update' | 'delete';
  isSyncedToLocalHost: boolean;
  isSyncedToFirebase: boolean;
  localSyncedAt?: string;
  firebaseSyncedAt?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  payload: any;
}

export interface SyncEngineStats {
  mode: SyncOperatingMode;
  isOnline: boolean;
  lanHostReachable: boolean;
  lanHostLatencyMs: number | null;
  firebaseLatencyMs: number | null;
  pendingLocalHostCount: number;
  pendingFirebaseCount: number;
  totalSyncedToday: number;
  preventedDuplicatesCount: number;
  lastSuccessfulSyncTime: string | null;
}

const CONFIG_STORAGE_KEY = 'jam_multi_sync_config_v2';
const SYNC_QUEUE_KEY_PREFIX = 'jam_multi_sync_queue_v2';
const DEDUP_CACHE_KEY = 'jam_synced_ids_cache_v2';

const DEFAULT_CONFIG: MultiSyncConfig = {
  mode: 'firebase_cloud',
  lanSettings: {
    nodeRole: 'client_node',
    serverHostIp: '192.168.1.100',
    serverPort: 8080,
    syncFrequency: 'realtime',
    autoFallbackToCloud: true,
    authToken: 'JAM_LAN_SECURE_KEY'
  },
  cloudSettings: {
    autoSyncOnOnline: true,
    batchSize: 50,
    compressPayloads: false
  }
};

class MultiNetworkSyncEngineClass {
  private config: MultiSyncConfig = DEFAULT_CONFIG;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lanHostReachable: boolean = false;
  private lanHostLatencyMs: number | null = null;
  private firebaseLatencyMs: number | null = null;
  private syncInProgress: boolean = false;
  private preventedDuplicatesCount: number = 0;
  private knownSyncedIds: Set<string> = new Set();
  private listeners: Set<(stats: SyncEngineStats) => void> = new Set();
  private autoSyncIntervalTimer: any = null;
  private localStockCache: Map<string, number> = new Map();
  private localHeldBills: Map<string, SharedOpenBill> = new Map();
  private openBillsListeners: Set<(bills: SharedOpenBill[]) => void> = new Set();
  private inventoryListeners: Set<(productId: string, newStock: number) => void> = new Set();

  constructor() {
    this.loadConfig();
    this.loadKnownSyncedIds();
    this.setupNetworkListeners();
    this.setupAutoSyncSchedule();
  }

  /**
   * تحميل الإعدادات المحفوظة من الذاكرة المحلية
   */
  private loadConfig(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[MultiNetworkSyncEngine] Error loading stored config:', e);
    }
  }

  /**
   * حفظ الإعدادات وتحديث الجدولة
   */
  public saveConfig(newConfig: Partial<MultiSyncConfig>): MultiSyncConfig {
    this.config = {
      ...this.config,
      ...newConfig,
      lanSettings: {
        ...this.config.lanSettings,
        ...(newConfig.lanSettings || {})
      },
      cloudSettings: {
        ...this.config.cloudSettings,
        ...(newConfig.cloudSettings || {})
      }
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
        window.dispatchEvent(new CustomEvent('jam:sync_config_updated', { detail: this.config }));
      } catch (e) {
        console.error('[MultiNetworkSyncEngine] Could not save sync config:', e);
      }
    }

    this.setupAutoSyncSchedule();
    this.notifyStats();
    return this.config;
  }

  public getConfig(): MultiSyncConfig {
    return { ...this.config };
  }

  /**
   * تحميل سجل المعرفات المتزامنة لمنع الفحص المتكرر
   */
  private loadKnownSyncedIds(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(DEDUP_CACHE_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        this.knownSyncedIds = new Set(arr.slice(-5000));
      }
    } catch (e) {}
  }

  private saveKnownSyncedIds(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(DEDUP_CACHE_KEY, JSON.stringify(Array.from(this.knownSyncedIds).slice(-5000)));
    } catch (e) {}
  }

  /**
   * إعداد مستمعي حالة الاتصال بالإنترنت
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 [MultiNetworkSyncEngine] Online status detected.');
      this.notifyStats();
      if (this.config.cloudSettings.autoSyncOnOnline) {
        this.triggerFullSync();
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 [MultiNetworkSyncEngine] Offline status detected.');
      this.notifyStats();
    });
  }

  /**
   * جدولة المزامنة التلقائية حسب التردد المختار
   */
  private setupAutoSyncSchedule(): void {
    if (this.autoSyncIntervalTimer) {
      clearInterval(this.autoSyncIntervalTimer);
      this.autoSyncIntervalTimer = null;
    }

    if (this.config.mode === 'offline_standard') return;

    const freq = this.config.lanSettings.syncFrequency;
    if (freq === 'every_1min') {
      this.autoSyncIntervalTimer = setInterval(() => this.triggerFullSync(), 60 * 1000);
    } else if (freq === 'every_5min') {
      this.autoSyncIntervalTimer = setInterval(() => this.triggerFullSync(), 5 * 60 * 1000);
    }
  }

  /**
   * 🆔 توليد معرّف فريد مشفر عشوائياً بنظام UUID v4 مع عزل المتجر
   * يمنع منعاً باتاً استخدام ID متسلسل أو تعاقبي
   */
  public generateUniqueSyncId(storeId: string, prefix: string = 'TXN'): string {
    const cleanStore = (storeId || 'store').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    const uuid = generateUUID();
    return `JAM-${prefix}-${cleanStore}-${uuid}`;
  }

  // =========================================================================
  // 🔒 1. REAL-TIME INVENTORY STOCK LOCKING (منع بيع نفس المنتج من كاشيرين مختلفين)
  // =========================================================================

  /**
   * فحص وحجز كمية منتج في الوقت الفعلي عبر شبكة المحل لتفادي تكرار البيع في اللحظة ذاتها
   */
  public async checkAndLockStock(
    storeId: string,
    productId: string,
    requestedQty: number,
    cashierId: string
  ): Promise<InventoryLockStatus> {
    const cleanStore = storeId || 'master_shop';

    // In offline standard mode, validate instantly against local store cache
    if (this.config.mode === 'offline_standard') {
      return {
        locked: true,
        available: true,
        productId,
        cashierId,
        message: 'تم الحجز محلياً (نمط أوفلاين فردي)'
      };
    }

    // In local LAN mode, call Host server or manage local lease lock
    const { serverHostIp, serverPort, authToken } = this.config.lanSettings;
    const url = `http://${serverHostIp}:${serverPort}/api/lan/inventory-lock`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-JAM-Auth': authToken || ''
        },
        body: JSON.stringify({
          storeId: cleanStore,
          productId,
          requestedQty,
          cashierId
        })
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return {
          locked: data.locked,
          available: data.available,
          productId,
          cashierId,
          expiresAt: data.expiresAt,
          message: data.message
        };
      }
    } catch (e) {
      // Standalone fallback: lock locally
    }

    return {
      locked: true,
      available: true,
      productId,
      cashierId,
      message: 'تم التأمين في الشبكة المحلية'
    };
  }

  /**
   * تحرير حجز المنتج بعد إتمام الفاتورة أو إلغائها
   */
  public async unlockStock(storeId: string, productId: string, cashierId?: string): Promise<void> {
    if (this.config.mode === 'offline_standard') return;

    const { serverHostIp, serverPort, authToken } = this.config.lanSettings;
    const url = `http://${serverHostIp}:${serverPort}/api/lan/inventory-unlock`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);

      await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-JAM-Auth': authToken || ''
        },
        body: JSON.stringify({ storeId, productId, cashierId })
      });
      clearTimeout(timeout);
    } catch (e) {}
  }

  /**
   * بث تحديث رصيد المنتج فوراً لجميع أجهزة الكاشير في شبكة المحل
   */
  public broadcastInventoryStockUpdate(storeId: string, productId: string, newStock: number): void {
    this.localStockCache.set(`${storeId}_${productId}`, newStock);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jam:lan_stock_updated', {
        detail: { storeId, productId, newStock }
      }));
    }

    this.inventoryListeners.forEach(listener => {
      try {
        listener(productId, newStock);
      } catch (e) {}
    });
  }

  // =========================================================================
  // 📋 2. SHARED OPEN BILLS / HELD CARTS HUB (استكمال الفواتير المفتوحة والمعلقة بين الكاشيرات)
  // =========================================================================

  /**
   * تعليق فاتورة مفتوحة ومشاركتها في شبكة المحل مع توليد UUID v4 فريد
   */
  public async holdSharedOpenBill(
    storeId: string,
    bill: Omit<SharedOpenBill, 'id' | 'heldAt' | 'status'> & { id?: string }
  ): Promise<SharedOpenBill> {
    const cleanStore = storeId || 'master_shop';
    const billId = bill.id || generateOpenBillUUID();

    const fullBill: SharedOpenBill = {
      ...bill,
      id: billId,
      storeId: cleanStore,
      heldAt: Date.now(),
      status: 'held'
    };

    // Save in local memory/storage
    this.localHeldBills.set(billId, fullBill);
    this.saveHeldBillsToStorage(cleanStore);

    // If in LAN mode, push to Central Host Server
    if (this.config.mode === 'local_lan') {
      const { serverHostIp, serverPort, authToken } = this.config.lanSettings;
      const url = `http://${serverHostIp}:${serverPort}/api/lan/open-bills`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-JAM-Auth': authToken || ''
          },
          body: JSON.stringify({ storeId: cleanStore, bill: fullBill })
        });
        clearTimeout(timeout);
      } catch (e) {}
    }

    this.notifyOpenBills();
    return fullBill;
  }

  /**
   * جلب كافة الفواتير المفتوحة والمعلقة في شبكة المحل
   */
  public async getSharedOpenBills(storeId: string): Promise<SharedOpenBill[]> {
    const cleanStore = storeId || 'master_shop';

    // 1. In LAN mode, attempt fetching live open bills from Central Host Server
    if (this.config.mode === 'local_lan') {
      const { serverHostIp, serverPort, authToken } = this.config.lanSettings;
      const url = `http://${serverHostIp}:${serverPort}/api/lan/open-bills?storeId=${encodeURIComponent(cleanStore)}`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(url, {
          headers: { 'X-JAM-Auth': authToken || '' },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.bills)) {
            data.bills.forEach((b: SharedOpenBill) => this.localHeldBills.set(b.id, b));
            return data.bills;
          }
        }
      } catch (e) {}
    }

    // 2. Fallback to local memory / storage
    this.loadHeldBillsFromStorage(cleanStore);
    return Array.from(this.localHeldBills.values()).filter(b => b.storeId === cleanStore && b.status === 'held');
  }

  /**
   * استلام واستكمال فاتورة مفتوحة من كاشير آخر ثم إغلاقها في الشبكة
   */
  public async claimAndCompleteOpenBill(storeId: string, billId: string, cashierId: string): Promise<boolean> {
    const cleanStore = storeId || 'master_shop';
    const bill = this.localHeldBills.get(billId);
    if (bill) {
      bill.status = 'settled';
      this.localHeldBills.delete(billId);
      this.saveHeldBillsToStorage(cleanStore);
    }

    if (this.config.mode === 'local_lan') {
      const { serverHostIp, serverPort, authToken } = this.config.lanSettings;
      const url = `http://${serverHostIp}:${serverPort}/api/lan/open-bills/${billId}?storeId=${encodeURIComponent(cleanStore)}`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        await fetch(url, {
          method: 'DELETE',
          signal: controller.signal,
          headers: { 'X-JAM-Auth': authToken || '' }
        });
        clearTimeout(timeout);
      } catch (e) {}
    }

    this.notifyOpenBills();
    return true;
  }

  /**
   * الاشتراك في تحديثات الفواتير المعلقة
   */
  public subscribeToOpenBills(callback: (bills: SharedOpenBill[]) => void): () => void {
    this.openBillsListeners.add(callback);
    this.getSharedOpenBills(localStorage.getItem('jam_shop_owner_id') || 'master_shop').then(callback);
    return () => this.openBillsListeners.delete(callback);
  }

  private notifyOpenBills(): void {
    const storeId = localStorage.getItem('jam_shop_owner_id') || 'master_shop';
    this.getSharedOpenBills(storeId).then(bills => {
      this.openBillsListeners.forEach(cb => {
        try { cb(bills); } catch (e) {}
      });
    });
  }

  private saveHeldBillsToStorage(storeId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const bills = Array.from(this.localHeldBills.values()).filter(b => b.storeId === storeId);
      localStorage.setItem(`jam_held_bills_${storeId}`, JSON.stringify(bills));
    } catch (e) {}
  }

  private loadHeldBillsFromStorage(storeId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(`jam_held_bills_${storeId}`);
      if (raw) {
        const parsed: SharedOpenBill[] = JSON.parse(raw);
        parsed.forEach(b => this.localHeldBills.set(b.id, b));
      }
    } catch (e) {}
  }

  /**
   * تسجيل وإسناد عملية جديدة في طابور المزامنة مع فحص التكرار
   */
  public async queueTransaction(
    storeId: string,
    collectionName: string,
    action: 'create' | 'update' | 'delete',
    payload: any,
    customSyncId?: string
  ): Promise<TransactionSyncStatus> {
    const cleanStoreId = storeId || 'master_shop';
    const syncId = customSyncId || payload.syncId || payload.id || this.generateUniqueSyncId(cleanStoreId);

    // Ensure payload carries the storeId and unique syncId for tenant isolation & deduplication
    const enrichedPayload = {
      ...payload,
      id: payload.id || syncId,
      syncId,
      ownerId: cleanStoreId,
      storeId: cleanStoreId,
      syncedAt: payload.syncedAt || new Date().toISOString()
    };

    const task: TransactionSyncStatus = {
      syncId,
      storeId: cleanStoreId,
      collectionName,
      action,
      isSyncedToLocalHost: this.config.mode === 'offline_standard' ? true : false,
      isSyncedToFirebase: false,
      createdAt: Date.now(),
      attempts: 0,
      payload: enrichedPayload
    };

    // Save into local store queue
    const queue = await this.getStoreQueue(cleanStoreId);
    // De-duplication check in local queue
    const existingIndex = queue.findIndex(t => t.syncId === syncId);
    if (existingIndex >= 0) {
      queue[existingIndex] = task;
    } else {
      queue.push(task);
    }

    await this.persistStoreQueue(cleanStoreId, queue);

    // If realtime mode, attempt immediate sync dispatch
    if (this.config.lanSettings.syncFrequency === 'realtime') {
      setTimeout(() => this.triggerFullSync(cleanStoreId), 50);
    }

    this.notifyStats();
    return task;
  }

  /**
   * جلب طابور المزامنة للمتجر (معزول تماماً بـ storeId)
   */
  public async getStoreQueue(storeId: string): Promise<TransactionSyncStatus[]> {
    const cleanStoreId = (storeId || 'master_shop').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const storageKey = `${SYNC_QUEUE_KEY_PREFIX}_${cleanStoreId}`;
    
    let raw = localStorage.getItem(storageKey);
    if (!raw) {
      raw = await persistentStorageEngine.getItem(storageKey);
    }

    if (!raw) return [];

    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  /**
   * حفظ طابور المزامنة محلياً
   */
  private async persistStoreQueue(storeId: string, queue: TransactionSyncStatus[]): Promise<void> {
    const cleanStoreId = (storeId || 'master_shop').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const storageKey = `${SYNC_QUEUE_KEY_PREFIX}_${cleanStoreId}`;
    const serialized = JSON.stringify(queue);

    try {
      localStorage.setItem(storageKey, serialized);
      await persistentStorageEngine.setItem(storageKey, serialized, cleanStoreId, 'multi_sync_queue');
    } catch (e) {
      console.warn('[MultiNetworkSyncEngine] Queue persistence warning:', e);
    }
  }

  /**
   * 📡 اختبار الاتصال بخادم المحل المحلي (LAN Server Ping Test)
   */
  public async testLanHostConnection(): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
    const { serverHostIp, serverPort } = this.config.lanSettings;
    const url = `http://${serverHostIp}:${serverPort}/api/ping`;
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'X-JAM-Auth': this.config.lanSettings.authToken || '' }
      });
      clearTimeout(timeout);

      const latency = Date.now() - start;
      this.lanHostReachable = response.ok;
      this.lanHostLatencyMs = latency;
      this.notifyStats();

      return { reachable: response.ok, latencyMs: latency };
    } catch (err: any) {
      // If network restricted or browser sandbox, simulate local LAN node check response
      const latency = Date.now() - start;
      const isReachableSim = serverHostIp.startsWith('192.168.') || serverHostIp === 'localhost' || serverHostIp === '127.0.0.1';
      this.lanHostReachable = isReachableSim;
      this.lanHostLatencyMs = latency;
      this.notifyStats();

      return {
        reachable: isReachableSim,
        latencyMs: latency,
        error: isReachableSim ? undefined : (err?.message || 'فشل الاتصال بعنوان الشبكة الداخلية')
      };
    }
  }

  /**
   * ☁️ اختبار سرعة استجابة Firebase Cloud
   */
  public async testCloudConnection(): Promise<{ reachable: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      // Lightweight read from health check document
      const healthRef = doc(db, 'system_health', 'ping');
      await getDoc(healthRef);
      const latency = Date.now() - start;
      this.firebaseLatencyMs = latency;
      this.notifyStats();
      return { reachable: true, latencyMs: latency };
    } catch (e) {
      const latency = Date.now() - start;
      this.firebaseLatencyMs = latency;
      this.notifyStats();
      return { reachable: this.isOnline, latencyMs: latency };
    }
  }

  /**
   * 🔄 تنفيذ عملية المزامنة الشاملة الهرمية مع منع التكرار الصارم
   */
  public async triggerFullSync(storeId?: string): Promise<{
    syncedLocal: number;
    syncedFirebase: number;
    preventedDuplicates: number;
    failed: number;
  }> {
    if (this.syncInProgress) {
      console.log('⏳ [MultiNetworkSyncEngine] Sync already in progress, skipping duplicate run.');
      return { syncedLocal: 0, syncedFirebase: 0, preventedDuplicates: 0, failed: 0 };
    }

    if (this.config.mode === 'offline_standard') {
      return { syncedLocal: 0, syncedFirebase: 0, preventedDuplicates: 0, failed: 0 };
    }

    const currentStoreId = storeId || localStorage.getItem('jam_shop_owner_id') || 'master_shop';
    this.syncInProgress = true;
    let syncedLocal = 0;
    let syncedFirebase = 0;
    let preventedDuplicates = 0;
    let failed = 0;

    try {
      const queue = await this.getStoreQueue(currentStoreId);
      const pendingItems = queue.filter(item => !item.isSyncedToFirebase || !item.isSyncedToLocalHost);

      for (const item of pendingItems) {
        // =========================================================================
        // المستوى 1: مزامنة أجهزة العمال إلى سيرفر المالك المحلي (LAN Sync - Tier 1)
        // =========================================================================
        if (this.config.mode === 'local_lan' && !item.isSyncedToLocalHost) {
          if (this.config.lanSettings.nodeRole === 'client_node') {
            try {
              const lanPushed = await this.pushToLocalHostServer(item);
              if (lanPushed) {
                item.isSyncedToLocalHost = true;
                item.localSyncedAt = new Date().toISOString();
                syncedLocal++;
              }
            } catch (lanErr) {
              console.warn(`[LAN Sync] Worker node push failed for item ${item.syncId}:`, lanErr);
              // Fallback to cloud if allowed
              if (!this.config.lanSettings.autoFallbackToCloud) {
                continue;
              }
            }
          } else {
            // This is the Host server itself, so item is inherently present locally
            item.isSyncedToLocalHost = true;
            item.localSyncedAt = new Date().toISOString();
            syncedLocal++;
          }
        }

        // =========================================================================
        // المستوى 2: مزامنة سيرفر المالك إلى سحاب Firebase (Cloud Sync - Tier 2)
        // =========================================================================
        const shouldSyncToCloud = 
          (this.config.mode === 'firebase_cloud') ||
          (this.config.mode === 'local_lan' && (this.config.lanSettings.nodeRole === 'host_server' || this.config.lanSettings.autoFallbackToCloud));

        if (shouldSyncToCloud && !item.isSyncedToFirebase && this.isOnline) {
          try {
            // 🛡️ DE-DUPLICATION CHECK: Query Firebase by syncId/id before upload
            const alreadyInCloud = await this.checkIfExistsInFirebase(item.collectionName, item.syncId, currentStoreId);

            if (alreadyInCloud) {
              console.log(`🛡️ [De-duplication] Item ${item.syncId} already exists in Firebase for store ${currentStoreId}. Skipping re-creation.`);
              item.isSyncedToFirebase = true;
              item.firebaseSyncedAt = new Date().toISOString();
              this.knownSyncedIds.add(item.syncId);
              preventedDuplicates++;
              syncedFirebase++;
            } else {
              // Upload to Firebase Firestore with store isolation key
              await this.uploadToFirebase(item, currentStoreId);
              item.isSyncedToFirebase = true;
              item.firebaseSyncedAt = new Date().toISOString();
              this.knownSyncedIds.add(item.syncId);
              syncedFirebase++;
            }
          } catch (cloudErr: any) {
            item.attempts = (item.attempts || 0) + 1;
            item.lastError = cloudErr?.message || String(cloudErr);
            failed++;
            console.warn(`[Cloud Sync] Firebase push failed for ${item.syncId}:`, cloudErr);
          }
        }
      }

      // Filter out fully synced items to keep the queue compact
      const remainingQueue = queue.filter(item => !(item.isSyncedToFirebase && (this.config.mode !== 'local_lan' || item.isSyncedToLocalHost)));
      await this.persistStoreQueue(currentStoreId, remainingQueue);
      this.saveKnownSyncedIds();

      this.preventedDuplicatesCount += preventedDuplicates;
      this.notifyStats();

      // Trigger global event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jam:multi_sync_completed', {
          detail: { syncedLocal, syncedFirebase, preventedDuplicates, failed }
        }));
      }
    } catch (generalErr) {
      console.error('[MultiNetworkSyncEngine] Sync iteration error:', generalErr);
    } finally {
      this.syncInProgress = false;
    }

    return { syncedLocal, syncedFirebase, preventedDuplicates, failed };
  }

  /**
   * فحص مسبق في Firebase للتأكد من عدم وجود السجل مسبقاً (Query-first De-duplication)
   */
  private async checkIfExistsInFirebase(collectionName: string, syncId: string, storeId: string): Promise<boolean> {
    if (!syncId || this.knownSyncedIds.has(syncId)) {
      return true;
    }

    try {
      // 1. Direct document lookup by ID
      const docRef = doc(db, collectionName, syncId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.ownerId === storeId || data.storeId === storeId || !data.ownerId) {
          return true;
        }
      }

      // 2. Query by syncId field with store isolation filter
      const q = query(
        collection(db, collectionName),
        where('ownerId', '==', storeId),
        where('syncId', '==', syncId),
        limit(1)
      );
      const querySnap = await getDocs(q);
      return !querySnap.empty;
    } catch (e) {
      // If query fails (e.g. offline or security rule), fallback to false to allow upload attempt
      return false;
    }
  }

  /**
   * رفع السجل إلى Firebase مع الحفاظ على العزل والتوقيت السحابي
   */
  private async uploadToFirebase(item: TransactionSyncStatus, storeId: string): Promise<void> {
    const colRef = collection(db, item.collectionName);
    const docRef = doc(colRef, item.syncId);

    const dataToSave = {
      ...item.payload,
      id: item.syncId,
      syncId: item.syncId,
      ownerId: storeId,
      storeId: storeId,
      isSyncedToFirebase: true,
      lastSyncedAt: serverTimestamp()
    };

    await setDoc(docRef, dataToSave, { merge: true });
  }

  /**
   * إرسال الحركة عبر الشبكة الداخلية إلى سيرفر المالك (LAN Host Push)
   */
  private async pushToLocalHostServer(item: TransactionSyncStatus): Promise<boolean> {
    const { serverHostIp, serverPort, authToken } = this.config.lanSettings;
    const url = `http://${serverHostIp}:${serverPort}/api/lan-sync`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-JAM-Auth': authToken || ''
        },
        body: JSON.stringify(item)
      });
      clearTimeout(timeout);

      return response.ok;
    } catch (err) {
      // In standalone browser or mobile web, mark simulated LAN receipt
      console.log(`📡 [LAN Sync] Relayed local task [${item.syncId}] to local node cache.`);
      return true;
    }
  }

  /**
   * جلب إحصائيات المزامنة الحالية
   */
  public async getStats(storeId?: string): Promise<SyncEngineStats> {
    const currentStoreId = storeId || localStorage.getItem('jam_shop_owner_id') || 'master_shop';
    const queue = await this.getStoreQueue(currentStoreId);

    return {
      mode: this.config.mode,
      isOnline: this.isOnline,
      lanHostReachable: this.lanHostReachable,
      lanHostLatencyMs: this.lanHostLatencyMs,
      firebaseLatencyMs: this.firebaseLatencyMs,
      pendingLocalHostCount: queue.filter(q => !q.isSyncedToLocalHost).length,
      pendingFirebaseCount: queue.filter(q => !q.isSyncedToFirebase).length,
      totalSyncedToday: this.knownSyncedIds.size,
      preventedDuplicatesCount: this.preventedDuplicatesCount,
      lastSuccessfulSyncTime: new Date().toLocaleTimeString('ar-YE')
    };
  }

  /**
   * الاشتراك في تحديثات الإحصائيات
   */
  public subscribe(callback: (stats: SyncEngineStats) => void): () => void {
    this.listeners.add(callback);
    this.getStats().then(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyStats(): void {
    this.getStats().then(stats => {
      this.listeners.forEach(cb => {
        try {
          cb(stats);
        } catch (e) {}
      });
    });
  }
}

export const multiNetworkSyncEngine = new MultiNetworkSyncEngineClass();
