import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'JAM_ERP_CACHE';
const STORE_NAME = 'inventory';
const VERSION = 1;

export interface CachedItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
  [key: string]: any;
}

class IDBService {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('barcode', 'barcode', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      },
    });
  }

  async syncInventory(items: CachedItem[]) {
    const db = await this.db;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Clear old data for this shop (simplified: clear all if we assume one shop per device/session)
    await store.clear();
    
    for (const item of items) {
      await store.put(item);
    }
    return tx.done;
  }

  async searchItems(query: string): Promise<CachedItem[]> {
    const db = await this.db;
    const items = await db.getAll(STORE_NAME);
    if (!query) return items;
    
    const lowerQuery = query.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(lowerQuery) || 
      item.barcode.includes(query)
    );
  }

  async getItemByBarcode(barcode: string): Promise<CachedItem | undefined> {
    const db = await this.db;
    const index = db.transaction(STORE_NAME).objectStore(STORE_NAME).index('barcode');
    return index.get(barcode);
  }

  async clear() {
    const db = await this.db;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.objectStore(STORE_NAME).clear();
    return tx.done;
  }
}

export const idbService = new IDBService();
