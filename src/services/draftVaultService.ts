import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'JAM_OFFLINE_PERSISTENCE_VAULT';
const DB_VERSION = 2;

const STORE_DRAFTS = 'page_drafts';
const STORE_HELD_INVOICES = 'held_invoices_vault';
const STORE_CACHE_META = 'cache_meta';

export interface PageDraft {
  key: string; // e.g. "sales_pos_${storeId}_${userId}" or "maintenance_new_${storeId}"
  storeId: string;
  userId: string;
  page: string;
  data: any;
  updatedAt: number;
}

export interface HeldInvoiceSession {
  id: string;
  storeId: string;
  userId: string;
  name: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  items: any[];
  total: number;
  discount: number;
  paymentMethod: string;
  isDebt?: boolean;
  notes?: string;
  createdAt: number;
  posType: 'retail' | 'wholesale';
}

class DraftVaultService {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          const draftStore = db.createObjectStore(STORE_DRAFTS, { keyPath: 'key' });
          draftStore.createIndex('storeId', 'storeId', { unique: false });
          draftStore.createIndex('page', 'page', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_HELD_INVOICES)) {
          const heldStore = db.createObjectStore(STORE_HELD_INVOICES, { keyPath: 'id' });
          heldStore.createIndex('storeId', 'storeId', { unique: false });
          heldStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_CACHE_META)) {
          db.createObjectStore(STORE_CACHE_META, { keyPath: 'key' });
        }
      },
    });
  }

  // --- 1. Page State Auto-Preservation (Offline-First / Resistant to Cache Wipe) ---
  async saveDraft(storeId: string, userId: string, page: string, data: any): Promise<void> {
    try {
      const cleanStore = storeId || 'default_store';
      const cleanUser = userId || 'default_user';
      const key = `${page}_${cleanStore}_${cleanUser}`;
      const payload: PageDraft = {
        key,
        storeId: cleanStore,
        userId: cleanUser,
        page,
        data,
        updatedAt: Date.now(),
      };

      // 1. Save to IndexedDB (Persistent Storage)
      const db = await this.dbPromise;
      await db.put(STORE_DRAFTS, payload);

      // 2. Mirror into LocalStorage as immediate zero-latency fallback
      try {
        localStorage.setItem(`jam_draft_${key}`, JSON.stringify(payload));
      } catch (lsErr) {
        // Safe ignore localStorage quota
      }
    } catch (err) {
      console.warn('⚠️ [DraftVaultService] Error saving state draft:', err);
    }
  }

  async getDraft(storeId: string, userId: string, page: string): Promise<any | null> {
    try {
      const cleanStore = storeId || 'default_store';
      const cleanUser = userId || 'default_user';
      const key = `${page}_${cleanStore}_${cleanUser}`;

      // 1. Try IndexedDB first
      const db = await this.dbPromise;
      const draft = await db.get(STORE_DRAFTS, key);
      if (draft && draft.data) {
        return draft.data;
      }

      // 2. Fallback to LocalStorage
      const local = localStorage.getItem(`jam_draft_${key}`);
      if (local) {
        const parsed = JSON.parse(local);
        return parsed.data || parsed;
      }
      return null;
    } catch (err) {
      console.warn('⚠️ [DraftVaultService] Error reading state draft:', err);
      return null;
    }
  }

  async clearDraft(storeId: string, userId: string, page: string): Promise<void> {
    try {
      const cleanStore = storeId || 'default_store';
      const cleanUser = userId || 'default_user';
      const key = `${page}_${cleanStore}_${cleanUser}`;

      const db = await this.dbPromise;
      await db.delete(STORE_DRAFTS, key);
      localStorage.removeItem(`jam_draft_${key}`);
    } catch (err) {
      console.warn('⚠️ [DraftVaultService] Error clearing draft:', err);
    }
  }

  // --- 2. Multiple Invoices Sessions Vault (تعليق وتبديل الفواتير) ---
  async saveHeldInvoice(invoice: HeldInvoiceSession): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.put(STORE_HELD_INVOICES, invoice);

      // LocalStorage sync
      const list = await this.getHeldInvoices(invoice.storeId, invoice.userId);
      localStorage.setItem(`jam_held_vault_${invoice.storeId}`, JSON.stringify(list));
    } catch (err) {
      console.warn('⚠️ [DraftVaultService] Error saving held invoice:', err);
    }
  }

  async getHeldInvoices(storeId: string, userId?: string): Promise<HeldInvoiceSession[]> {
    try {
      const db = await this.dbPromise;
      const allHeld: HeldInvoiceSession[] = await db.getAll(STORE_HELD_INVOICES);
      const cleanStore = storeId || 'default_store';
      
      const filtered = allHeld.filter(h => h.storeId === cleanStore);
      if (filtered.length > 0) return filtered;

      // Fallback
      const local = localStorage.getItem(`jam_held_vault_${cleanStore}`);
      return local ? JSON.parse(local) : [];
    } catch (err) {
      console.warn('⚠️ [DraftVaultService] Error reading held invoices:', err);
      return [];
    }
  }

  async removeHeldInvoice(id: string, storeId: string): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.delete(STORE_HELD_INVOICES, id);

      const list = await this.getHeldInvoices(storeId);
      localStorage.setItem(`jam_held_vault_${storeId}`, JSON.stringify(list));
    } catch (err) {
      console.warn('⚠️ [DraftVaultService] Error deleting held invoice:', err);
    }
  }
}

export const draftVaultService = new DraftVaultService();
