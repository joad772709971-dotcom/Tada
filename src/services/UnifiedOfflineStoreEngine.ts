/**
 * 🏬 UnifiedOfflineStoreEngine.ts
 * ----------------------------------------------------
 * محرك قاعدة البيانات المحلية الشامل والتشغيل أوفلاين بالكامل (Offline-First Core Engine)
 * 
 * المبادئ المعمارية المطبقة بناءً على أمر إعادة الهيكلة والتصحيح المعماري الشامل:
 * 1. التخزين المحلي الدائم عبر محرك SQLite (Capacitor SQLite Plugin) في APK و EXE، مع حماية 100% من المسح.
 * 2. طابور مزامنة آمن (sync_queue) يعتمد معرّفات معاملات فريدة UUID v4 لكل حركة أوفلاين.
 * 3. المزامنة الآمنة غير المتكررة (Idempotent Sync) عند توفر الإنترنت.
 * 4. إلغاء التكرار: منع تكرار بيانات الزبائن في المجموعات (customers, clients, leads, users).
 * 5. عزل المتاجر في stores/{storeId}/... (invoices, inventory, customers, employees).
 * 6. مجموعة الهويات الموحدة users/{userId} بـ role من الطبقات الـ 5 ومصفوفة associatedStores.
 */

import { Customer, Product, Invoice } from '../types';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { generateUUID, generateInvoiceUUID, generateCustomerUUID } from '../utils/uuid';
import { sqliteStorageProvider, OfflineSyncQueueItem } from './SqliteStorageProvider';

export interface OfflineVoucher {
  id: string;
  voucherNumber: string;
  type: 'receipt' | 'payment';
  customerOrSupplierId?: string;
  customerOrSupplierName: string;
  amount: number;
  currency: string;
  notes: string;
  date: string;
  createdAt: number;
  synced: boolean;
  storeId: string;
}

class UnifiedOfflineStoreEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncInProgress: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.triggerBackgroundSync();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      // Immediate background sync on boot if online
      if (this.isOnline) {
        setTimeout(() => this.triggerBackgroundSync(), 1500);
      }

      // Heartbeat periodic background sync every 25 seconds
      setInterval(() => {
        if (navigator.onLine) {
          this.isOnline = true;
          this.triggerBackgroundSync();
        }
      }, 25000);
    }
  }

  // ==========================================
  // 1. CUSTOMERS REPOSITORY (SQLite محلي + طابور مزامنة معزول)
  // ==========================================
  async saveCustomerLocal(customer: Customer, queueForSync: boolean = true): Promise<Customer> {
    const effectiveStoreId = (customer as any).storeId || customer.ownerId || (auth.currentUser ? auth.currentUser.uid : 'store-4-master');
    const cleanPhone = (customer.phone || '').replace(/[\s\-\(\)\+]/g, '').trim();

    // Deterministic Idempotent ID per store
    let finalId = customer.id;
    if (!finalId || finalId.startsWith('local_') || finalId.startsWith('CUST-')) {
      if (cleanPhone) {
        finalId = `cust_${effectiveStoreId}_${cleanPhone}`;
      } else {
        finalId = customer.id || generateCustomerUUID();
      }
    }

    const finalCust: Customer = {
      ...customer,
      id: finalId,
      ownerId: effectiveStoreId,
      shopId: effectiveStoreId,
      status: customer.status || 'active',
      updatedAt: customer.updatedAt || new Date().toISOString()
    };
    (finalCust as any).storeId = effectiveStoreId;

    // Save to persistent SQLite / IndexedDB
    await sqliteStorageProvider.putRecord('customers', finalId, finalCust, effectiveStoreId);

    // Backup to local storage cache for instant 0ms hydration
    try {
      const existing = JSON.parse(localStorage.getItem('jam_offline_customers') || '[]');
      const filtered = existing.filter((c: any) => c.id !== finalCust.id && (c.phone || '').replace(/[\s\-\(\)\+]/g, '').trim() !== cleanPhone);
      filtered.unshift(finalCust);
      localStorage.setItem('jam_offline_customers', JSON.stringify(filtered.slice(0, 500)));
    } catch (e) {
      console.warn('LocalStorage customer cache notice:', e);
    }

    if (queueForSync) {
      await sqliteStorageProvider.enqueueSyncItem({
        storeId: effectiveStoreId,
        collectionName: 'customers',
        action: 'create',
        data: finalCust
      });

      // If currently online, attempt immediate sync
      if (this.isOnline) {
        this.syncSingleCustomerToCloud(finalCust).catch(() => {});
      }
    }

    // Broadcast customer local change
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jam:customers_synced', { detail: { customer: finalCust } }));
    }

    return finalCust;
  }

  async getAllCustomersLocal(storeId?: string): Promise<Customer[]> {
    let list = await sqliteStorageProvider.getAllRecords('customers', storeId);
    
    // Fallback to localStorage if empty
    if ((!list || list.length === 0) && typeof window !== 'undefined') {
      try {
        const cached = JSON.parse(localStorage.getItem('jam_offline_customers') || '[]');
        if (storeId) {
          list = cached.filter((c: any) => !c.storeId || c.storeId === storeId || c.ownerId === storeId);
        } else {
          list = cached;
        }
      } catch (e) {}
    }
    return list;
  }

  async searchCustomersLocal(queryText: string, storeId?: string): Promise<Customer[]> {
    const list = await this.getAllCustomersLocal(storeId);
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
  // 2. INVENTORY & PRODUCTS REPOSITORY (SQLite محلي)
  // ==========================================
  async syncLocalProducts(products: Product[], storeId?: string): Promise<void> {
    const effStoreId = storeId || 'store-4-master';
    for (const p of products) {
      await sqliteStorageProvider.putRecord('products', p.id, p, (p as any).storeId || effStoreId);
    }
  }

  async getProductByBarcode(barcode: string, storeId?: string): Promise<Product | undefined> {
    const list = await sqliteStorageProvider.getAllRecords('products', storeId);
    return list.find((p: Product) => p.barcode === barcode);
  }

  async searchProductsLocal(queryText: string, storeId?: string): Promise<Product[]> {
    const list = await sqliteStorageProvider.getAllRecords('products', storeId);
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
    const effStoreId = (invoice as any).storeId || (invoice as any).ownerId || (auth.currentUser ? auth.currentUser.uid : 'store-4-master');
    const finalInv: Invoice = {
      ...invoice,
      id: invoice.id || generateInvoiceUUID(),
      createdAt: invoice.createdAt || new Date().toISOString()
    };
    (finalInv as any).storeId = effStoreId;

    await sqliteStorageProvider.putRecord('invoices', finalInv.id, finalInv, effStoreId);

    // Add to safe UUID sync queue
    await sqliteStorageProvider.enqueueSyncItem({
      storeId: effStoreId,
      collectionName: 'invoices',
      action: 'create',
      data: finalInv
    });

    if (this.isOnline) {
      this.syncSingleInvoiceToCloud(finalInv).catch(() => {});
    }

    return finalInv;
  }

  async getAllInvoicesLocal(storeId?: string): Promise<Invoice[]> {
    return await sqliteStorageProvider.getAllRecords('invoices', storeId);
  }

  // ==========================================
  // 4. VOUCHERS REPOSITORY (سندات القبض والصرف)
  // ==========================================
  async saveVoucherLocal(voucher: OfflineVoucher): Promise<OfflineVoucher> {
    const effStoreId = voucher.storeId || 'store-4-master';
    const finalVoucher: OfflineVoucher = {
      ...voucher,
      id: voucher.id || generateUUID()
    };
    await sqliteStorageProvider.putRecord('vouchers', finalVoucher.id, finalVoucher, effStoreId);

    await sqliteStorageProvider.enqueueSyncItem({
      storeId: effStoreId,
      collectionName: 'vouchers',
      action: 'create',
      data: finalVoucher
    });

    return finalVoucher;
  }

  async getAllVouchersLocal(storeId?: string): Promise<OfflineVoucher[]> {
    return await sqliteStorageProvider.getAllRecords('vouchers', storeId);
  }

  // ==========================================
  // 5. SAFE SYNC QUEUE & IDEMPOTENT CLOUD SYNC
  // ==========================================
  public async getPendingSyncCount(storeId?: string): Promise<number> {
    return await sqliteStorageProvider.countSyncQueue(storeId);
  }

  public async triggerBackgroundSync(): Promise<{ processed: number; failed: number }> {
    if (this.syncInProgress || !this.isOnline) {
      return { processed: 0, failed: 0 };
    }
    this.syncInProgress = true;
    let processed = 0;
    let failed = 0;

    try {
      const items = await sqliteStorageProvider.getSyncQueue();
      for (const item of items) {
        try {
          if (item.collectionName === 'customers') {
            await this.syncSingleCustomerToCloud(item.data);
          } else if (item.collectionName === 'invoices') {
            await this.syncSingleInvoiceToCloud(item.data);
          }
          // Remove from queue strictly on confirmed cloud write (Idempotent Sync)
          await sqliteStorageProvider.removeSyncQueueItem(item.id);
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

  /**
   * مزامنة العميل السحابية المعزولة:
   * 1. منع تكرار السجل في مجموعات متعددة (لا كتابة في clients أو leads).
   * 2. الكتابة محصورة في المتجر: stores/{storeId}/customers/{targetId}.
   * 3. توحيد الهوية في users/{userId} مع مصفوفة associatedStores ودور CUSTOMER.
   */
  private async syncSingleCustomerToCloud(cust: Customer): Promise<void> {
    if (!cust) return;
    try {
      const cleanData: any = { ...cust };
      const cleanPhone = (cust.phone || '').replace(/[\s\-\(\)\+]/g, '').trim();
      const effectiveStoreId = (cust as any).storeId || cust.ownerId || (auth.currentUser ? auth.currentUser.uid : 'store-4-master');
      
      const targetId = cust.id && cust.id.startsWith('cust_')
        ? cust.id
        : (cleanPhone ? `cust_${effectiveStoreId}_${cleanPhone}` : (cust.id || generateCustomerUUID()));

      delete cleanData.id;

      cleanData.ownerId = effectiveStoreId;
      cleanData.shopId = effectiveStoreId;
      cleanData.storeId = effectiveStoreId;
      cleanData.status = cleanData.status || 'active';

      // 1. كتابة معزولة وحيدة داخل المتجر: stores/{storeId}/customers/{targetId}
      await setDoc(doc(db, 'stores', effectiveStoreId, 'customers', targetId), {
        ...cleanData,
        id: targetId,
        storeId: effectiveStoreId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. تحديث هوية المستخدم الموحدة في users/{userId} (بدون تكرار في clients أو leads)
      if (cleanPhone) {
        try {
          const userRef = doc(db, 'users', cleanPhone);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const uData = userSnap.data();
            const associated = Array.isArray(uData.associatedStores) 
              ? [...uData.associatedStores] 
              : (Array.isArray(uData.linkedStores) ? [...uData.linkedStores] : []);
            if (!associated.includes(effectiveStoreId)) {
              associated.push(effectiveStoreId);
              await setDoc(userRef, { 
                associatedStores: associated,
                updatedAt: serverTimestamp() 
              }, { merge: true });
            }
          } else {
            await setDoc(userRef, {
              userId: cleanPhone,
              uid: cleanPhone,
              phone: cleanPhone,
              name: cust.name || 'عميل المتجر',
              role: 'CUSTOMER',
              status: 'ACTIVE',
              associatedStores: [effectiveStoreId],
              primaryStoreId: effectiveStoreId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        } catch (userErr) {
          console.warn('[UnifiedOfflineStoreEngine] User identity profile notice:', userErr);
        }
      }

      // Broadcast customer sync complete event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jam:customers_synced', { detail: { targetId, phone: cleanPhone, storeId: effectiveStoreId } }));
      }
    } catch (e) {
      throw e;
    }
  }

  /**
   * مزامنة الفاتورة محصورة في المتجر: stores/{storeId}/invoices/{invId}
   */
  private async syncSingleInvoiceToCloud(inv: Invoice): Promise<void> {
    if (!inv) return;
    try {
      const cleanData: any = { ...inv };
      const effectiveStoreId = (inv as any).storeId || (inv as any).ownerId || (auth.currentUser ? auth.currentUser.uid : 'store-4-master');
      const invId = inv.id || generateInvoiceUUID();
      delete cleanData.id;

      cleanData.storeId = effectiveStoreId;

      // حصر الفواتير داخل المتجر الخاص بها: stores/{storeId}/invoices/{invId}
      await setDoc(doc(db, 'stores', effectiveStoreId, 'invoices', invId), {
        ...cleanData,
        id: invId,
        storeId: effectiveStoreId,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      throw e;
    }
  }
}

export const unifiedOfflineStoreEngine = new UnifiedOfflineStoreEngine();
export type { OfflineSyncQueueItem };
