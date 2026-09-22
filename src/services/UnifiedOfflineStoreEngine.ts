/**
 * 🏬 UnifiedOfflineStoreEngine.ts
 * ----------------------------------------------------
 * محرك قاعدة البيانات المحلية الشامل والتشغيل أوفلاين بالكامل (Offline-First Core Engine)
 * 
 * المبادئ المعمارية المطبقة:
 * 1. العمل أوفلاين 100% لكافة عمليات المحل (مبيعات، فواتير، عملاء، مخزون، سندات، مصاريف).
 * 2. حفظ فوري في IndexedDB و LocalStorage مع استجابة 0ms بدون إنترنت.
 * 3. حصر الاتصال الشبكي (Online Relays) في:
 *    - أول تسجيل دخول / تنشيط.
 *    - مراسلات ودردشة B2B الحية.
 *    - ترحيل واستعراض طلبات سوق الجملة B2B (المحور 3 و 4).
 *    - بوابة الزبائن B2C (المحور 5).
 *    - المزامنة السحابية الخلفية الذاتية عند توفر الإنترنت دون مقاطعة الكاشير.
 */

import { openDB, IDBPDatabase } from 'idb';
import { Customer, Product, Invoice } from '../types';
import { db } from '../firebase';
import { collection, addDoc, doc, setDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { generateUUID, generateInvoiceUUID, generateCustomerUUID } from '../utils/uuid';

const DB_NAME = 'JAM_OFFLINE_MASTER_DB_V4';
const DB_VERSION = 2;

export interface OfflineVoucher {
  id: string;
  voucherNumber: string;
  type: 'receipt' | 'payment'; // قبض أو صرف
  customerOrSupplierId?: string;
  customerOrSupplierName: string;
  amount: number;
  currency: string;
  notes: string;
  date: string;
  createdAt: number;
  synced: boolean;
  ownerId: string;
}

export interface OfflineSyncQueueItem {
  id: string;
  collectionName: 'customers' | 'invoices' | 'products' | 'vouchers' | 'expenses';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  attempts: number;
}

class UnifiedOfflineStoreEngine {
  private dbPromise: Promise<IDBPDatabase>;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncInProgress: boolean = false;

  constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        // Store 1: Customers
        if (!db.objectStoreNames.contains('customers')) {
          const custStore = db.createObjectStore('customers', { keyPath: 'id' });
          custStore.createIndex('phone', 'phone', { unique: false });
          custStore.createIndex('name', 'name', { unique: false });
          custStore.createIndex('code', 'code', { unique: false });
          custStore.createIndex('ownerId', 'ownerId', { unique: false });
        }

        // Store 2: Products & Inventory
        if (!db.objectStoreNames.contains('products')) {
          const prodStore = db.createObjectStore('products', { keyPath: 'id' });
          prodStore.createIndex('barcode', 'barcode', { unique: false });
          prodStore.createIndex('name', 'name', { unique: false });
          prodStore.createIndex('category', 'category', { unique: false });
        }

        // Store 3: Invoices
        if (!db.objectStoreNames.contains('invoices')) {
          const invStore = db.createObjectStore('invoices', { keyPath: 'id' });
          invStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
          invStore.createIndex('customerId', 'customerId', { unique: false });
          invStore.createIndex('date', 'date', { unique: false });
          invStore.createIndex('synced', 'synced', { unique: false });
        }

        // Store 4: Vouchers (Receipts & Payments)
        if (!db.objectStoreNames.contains('vouchers')) {
          const vouchStore = db.createObjectStore('vouchers', { keyPath: 'id' });
          vouchStore.createIndex('voucherNumber', 'voucherNumber', { unique: false });
          vouchStore.createIndex('type', 'type', { unique: false });
        }

        // Store 5: Sync Queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.triggerBackgroundSync();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  // ==========================================
  // 1. CUSTOMERS REPOSITORY (محلي + طابور مزامنة)
  // ==========================================
  async saveCustomerLocal(customer: Customer, queueForSync: boolean = true): Promise<Customer> {
    const db = await this.dbPromise;
    const finalCust: Customer = {
      ...customer,
      id: customer.id || generateCustomerUUID(),
      updatedAt: customer.updatedAt || new Date().toISOString()
    };

    const tx = db.transaction('customers', 'readwrite');
    await tx.objectStore('customers').put(finalCust);
    await tx.done;

    // Backup to local storage cache for instant hydration
    try {
      const existing = JSON.parse(localStorage.getItem('jam_offline_customers') || '[]');
      const filtered = existing.filter((c: any) => c.id !== finalCust.id);
      filtered.unshift(finalCust);
      localStorage.setItem('jam_offline_customers', JSON.stringify(filtered.slice(0, 500)));
    } catch (e) {
      console.warn('LocalStorage customer cache fallback warning:', e);
    }

    if (queueForSync) {
      await this.addToSyncQueue('customers', 'create', finalCust);
      // If currently online, attempt immediate non-blocking sync
      if (this.isOnline) {
        this.syncSingleCustomerToCloud(finalCust).catch(() => {});
      }
    }

    return finalCust;
  }

  async getAllCustomersLocal(ownerId?: string): Promise<Customer[]> {
    const db = await this.dbPromise;
    let list = await db.getAll('customers');
    if (ownerId) {
      list = list.filter(c => !c.ownerId || c.ownerId === ownerId);
    }
    // Fallback to localStorage if IDB returned empty
    if (list.length === 0 && typeof window !== 'undefined') {
      try {
        list = JSON.parse(localStorage.getItem('jam_offline_customers') || '[]');
      } catch (e) {}
    }
    return list;
  }

  async searchCustomersLocal(queryText: string, ownerId?: string): Promise<Customer[]> {
    const list = await this.getAllCustomersLocal(ownerId);
    if (!queryText.trim()) return list.slice(0, 50);
    const q = queryText.toLowerCase().trim();
    return list.filter(c => 
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.shopName || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q)
    );
  }

  // ==========================================
  // 2. INVENTORY & PRODUCTS REPOSITORY (محلي)
  // ==========================================
  async syncLocalProducts(products: Product[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    for (const p of products) {
      await store.put(p);
    }
    await tx.done;
  }

  async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    const db = await this.dbPromise;
    const index = db.transaction('products').objectStore('products').index('barcode');
    return index.get(barcode);
  }

  async searchProductsLocal(queryText: string): Promise<Product[]> {
    const db = await this.dbPromise;
    const list = await db.getAll('products');
    if (!queryText.trim()) return list;
    const q = queryText.toLowerCase().trim();
    return list.filter(p => 
      (p.name || '').toLowerCase().includes(q) ||
      (p.barcode || '').includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    );
  }

  // ==========================================
  // 3. INVOICES REPOSITORY (مبيعات الكاشير أوفلاين)
  // ==========================================
  async saveInvoiceLocal(invoice: Invoice): Promise<Invoice> {
    const db = await this.dbPromise;
    const finalInv: Invoice = {
      ...invoice,
      id: invoice.id || generateInvoiceUUID(),
      createdAt: invoice.createdAt || new Date().toISOString()
    };

    const tx = db.transaction('invoices', 'readwrite');
    await tx.objectStore('invoices').put(finalInv);
    await tx.done;

    // Add to sync queue
    await this.addToSyncQueue('invoices', 'create', finalInv);

    if (this.isOnline) {
      this.syncSingleInvoiceToCloud(finalInv).catch(() => {});
    }

    return finalInv;
  }

  async getAllInvoicesLocal(): Promise<Invoice[]> {
    const db = await this.dbPromise;
    return await db.getAll('invoices');
  }

  // ==========================================
  // 4. VOUCHERS REPOSITORY (سندات القبض والصرف)
  // ==========================================
  async saveVoucherLocal(voucher: OfflineVoucher): Promise<OfflineVoucher> {
    const db = await this.dbPromise;
    const finalVoucher: OfflineVoucher = {
      ...voucher,
      id: voucher.id || generateUUID()
    };
    const tx = db.transaction('vouchers', 'readwrite');
    await tx.objectStore('vouchers').put(finalVoucher);
    await tx.done;

    await this.addToSyncQueue('vouchers', 'create', finalVoucher);
    return finalVoucher;
  }

  async getAllVouchersLocal(): Promise<OfflineVoucher[]> {
    const db = await this.dbPromise;
    return await db.getAll('vouchers');
  }

  // ==========================================
  // 5. SYNC QUEUE & CLOUD INTEGRATION
  // ==========================================
  private async addToSyncQueue(
    collectionName: 'customers' | 'invoices' | 'products' | 'vouchers' | 'expenses',
    action: 'create' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    const db = await this.dbPromise;
    const item: OfflineSyncQueueItem = {
      id: generateUUID(),
      collectionName,
      action,
      data,
      timestamp: Date.now(),
      attempts: 0
    };
    const tx = db.transaction('sync_queue', 'readwrite');
    await tx.objectStore('sync_queue').put(item);
    await tx.done;
  }

  public async getPendingSyncCount(): Promise<number> {
    const db = await this.dbPromise;
    return await db.count('sync_queue');
  }

  public async triggerBackgroundSync(): Promise<{ processed: number; failed: number }> {
    if (this.syncInProgress || !this.isOnline) {
      return { processed: 0, failed: 0 };
    }
    this.syncInProgress = true;
    let processed = 0;
    let failed = 0;

    try {
      const db = await this.dbPromise;
      const items = await db.getAll('sync_queue');
      for (const item of items) {
        try {
          if (item.collectionName === 'customers') {
            await this.syncSingleCustomerToCloud(item.data);
          } else if (item.collectionName === 'invoices') {
            await this.syncSingleInvoiceToCloud(item.data);
          }
          // Remove from queue on success
          const tx = db.transaction('sync_queue', 'readwrite');
          await tx.objectStore('sync_queue').delete(item.id);
          await tx.done;
          processed++;
        } catch (err) {
          failed++;
          console.warn(`[SyncQueue] Failed to sync item ${item.id}:`, err);
        }
      }
    } catch (e) {
      console.warn('Background sync general notice:', e);
    } finally {
      this.syncInProgress = false;
    }

    return { processed, failed };
  }

  private async syncSingleCustomerToCloud(cust: Customer): Promise<void> {
    if (!cust) return;
    try {
      const cleanData: any = { ...cust };
      delete cleanData.id;
      if (cust.id && !cust.id.startsWith('local_')) {
        await setDoc(doc(db, 'customers', cust.id), {
          ...cleanData,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await addDoc(collection(db, 'customers'), {
          ...cleanData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      // Keep in local queue
      throw e;
    }
  }

  private async syncSingleInvoiceToCloud(inv: Invoice): Promise<void> {
    if (!inv) return;
    try {
      const cleanData: any = { ...inv };
      delete cleanData.id;
      if (inv.id && !inv.id.startsWith('local_')) {
        await setDoc(doc(db, 'invoices', inv.id), {
          ...cleanData,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await addDoc(collection(db, 'invoices'), {
          ...cleanData,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      throw e;
    }
  }
}

export const unifiedOfflineStoreEngine = new UnifiedOfflineStoreEngine();
