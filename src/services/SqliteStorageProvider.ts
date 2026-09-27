/**
 * 📦 SqliteStorageProvider.ts
 * ----------------------------------------------------
 * مزود التخزين المحلي الدائم عبر محرك SQLite (Capacitor SQLite Plugin)
 * مع التبديل التلقائي إلى IndexedDB في بيئة المتصفح / سطح المكتب.
 * 
 * الميزات:
 * 1. حماية التخزين المحلي في تطبيقات APK و EXE من المسح التلقائي لنظام التشغيل.
 * 2. طابور مزامنة آمن (sync_queue) يعتمد معرّفات UUID فريدة.
 * 3. دعم كامل للمزامنة غير المتكررة (Idempotent Sync).
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { openDB, IDBPDatabase } from 'idb';
import { generateUUID } from '../utils/uuid';

export interface OfflineSyncQueueItem {
  id: string; // syncTxId (UUID v4)
  storeId: string;
  collectionName: 'customers' | 'invoices' | 'products' | 'vouchers' | 'expenses';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  attempts: number;
}

const IDB_NAME = 'JAM_OFFLINE_MASTER_DB_V4';
const IDB_VERSION = 2;
const SQLITE_DB_NAME = 'jam_master_offline_store';

class SqliteStorageProvider {
  private isNative: boolean = false;
  private sqliteConnection: SQLiteConnection | null = null;
  private dbConnection: SQLiteDBConnection | null = null;
  private idbPromise: Promise<IDBPDatabase> | null = null;
  private isReady: boolean = false;
  private initPromise: Promise<void>;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    if (this.isReady) return;

    if (this.isNative) {
      try {
        console.log('📱 [SqliteStorage] Initializing native SQLite database via Capacitor SQLite...');
        this.sqliteConnection = new SQLiteConnection(CapacitorSQLite);
        
        // Check if connection already exists or create new
        const isConn = (await this.sqliteConnection.isConnection(SQLITE_DB_NAME, false)).result;
        if (isConn) {
          this.dbConnection = await this.sqliteConnection.retrieveConnection(SQLITE_DB_NAME, false);
        } else {
          this.dbConnection = await this.sqliteConnection.createConnection(
            SQLITE_DB_NAME,
            false,
            'no-encryption',
            1,
            false
          );
        }

        await this.dbConnection.open();

        // Create standard isolated tables
        const schema = `
          CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            storeId TEXT,
            phone TEXT,
            name TEXT,
            data TEXT,
            updatedAt TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(storeId);
          CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

          CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            storeId TEXT,
            customerId TEXT,
            date TEXT,
            data TEXT,
            createdAt TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_invoices_store ON invoices(storeId);

          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            storeId TEXT,
            barcode TEXT,
            name TEXT,
            data TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
          CREATE INDEX IF NOT EXISTS idx_products_store ON products(storeId);

          CREATE TABLE IF NOT EXISTS vouchers (
            id TEXT PRIMARY KEY,
            storeId TEXT,
            type TEXT,
            data TEXT
          );

          CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            storeId TEXT,
            collectionName TEXT,
            action TEXT,
            data TEXT,
            timestamp INTEGER,
            attempts INTEGER
          );
          CREATE INDEX IF NOT EXISTS idx_sync_queue_store ON sync_queue(storeId);
        `;

        await this.dbConnection.execute(schema);
        console.log('✅ [SqliteStorage] Native SQLite database ready and schema verified.');
        this.isReady = true;
        return;
      } catch (err) {
        console.warn('⚠️ [SqliteStorage] Native SQLite initialization failed. Falling back to persistent IndexedDB:', err);
        this.isNative = false;
      }
    }

    // Web / Electron / Desktop persistent IndexedDB
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(persisted => {
        console.log(`💾 [SqliteStorage] Web persistent storage granted: ${persisted}`);
      }).catch(() => {});
    }

    this.idbPromise = openDB(IDB_NAME, IDB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('customers')) {
          const custStore = db.createObjectStore('customers', { keyPath: 'id' });
          custStore.createIndex('phone', 'phone', { unique: false });
          custStore.createIndex('name', 'name', { unique: false });
          custStore.createIndex('ownerId', 'ownerId', { unique: false });
          custStore.createIndex('storeId', 'storeId', { unique: false });
        }
        if (!db.objectStoreNames.contains('products')) {
          const prodStore = db.createObjectStore('products', { keyPath: 'id' });
          prodStore.createIndex('barcode', 'barcode', { unique: false });
          prodStore.createIndex('storeId', 'storeId', { unique: false });
        }
        if (!db.objectStoreNames.contains('invoices')) {
          const invStore = db.createObjectStore('invoices', { keyPath: 'id' });
          invStore.createIndex('storeId', 'storeId', { unique: false });
        }
        if (!db.objectStoreNames.contains('vouchers')) {
          const vouchStore = db.createObjectStore('vouchers', { keyPath: 'id' });
          vouchStore.createIndex('storeId', 'storeId', { unique: false });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
          queueStore.createIndex('storeId', 'storeId', { unique: false });
        }
      }
    });

    this.isReady = true;
  }

  public async ensureReady(): Promise<void> {
    await this.initPromise;
  }

  // ==========================================
  // Generic CRUD
  // ==========================================
  public async putRecord(table: 'customers' | 'invoices' | 'products' | 'vouchers', id: string, data: any, storeId: string): Promise<void> {
    await this.ensureReady();

    if (this.isNative && this.dbConnection) {
      const dataStr = JSON.stringify(data);
      if (table === 'customers') {
        const phone = (data.phone || '').replace(/[\s\-\(\)\+]/g, '').trim();
        const name = data.name || '';
        const updatedAt = data.updatedAt || new Date().toISOString();
        const query = `
          INSERT OR REPLACE INTO customers (id, storeId, phone, name, data, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?);
        `;
        await this.dbConnection.run(query, [id, storeId, phone, name, dataStr, updatedAt]);
      } else if (table === 'invoices') {
        const customerId = data.customerId || '';
        const date = data.date || '';
        const createdAt = data.createdAt || new Date().toISOString();
        const query = `
          INSERT OR REPLACE INTO invoices (id, storeId, customerId, date, data, createdAt)
          VALUES (?, ?, ?, ?, ?, ?);
        `;
        await this.dbConnection.run(query, [id, storeId, customerId, date, dataStr, createdAt]);
      } else if (table === 'products') {
        const barcode = data.barcode || '';
        const name = data.name || '';
        const query = `
          INSERT OR REPLACE INTO products (id, storeId, barcode, name, data)
          VALUES (?, ?, ?, ?, ?);
        `;
        await this.dbConnection.run(query, [id, storeId, barcode, name, dataStr]);
      } else if (table === 'vouchers') {
        const type = data.type || 'receipt';
        const query = `
          INSERT OR REPLACE INTO vouchers (id, storeId, type, data)
          VALUES (?, ?, ?, ?);
        `;
        await this.dbConnection.run(query, [id, storeId, type, dataStr]);
      }
      return;
    }

    // Fallback IDB
    if (this.idbPromise) {
      const db = await this.idbPromise;
      const tx = db.transaction(table, 'readwrite');
      await tx.objectStore(table).put({ ...data, id, storeId });
      await tx.done;
    }
  }

  public async getRecord(table: 'customers' | 'invoices' | 'products' | 'vouchers', id: string): Promise<any | null> {
    await this.ensureReady();

    if (this.isNative && this.dbConnection) {
      const res = await this.dbConnection.query(`SELECT data FROM ${table} WHERE id = ? LIMIT 1;`, [id]);
      if (res.values && res.values.length > 0) {
        return JSON.parse(res.values[0].data);
      }
      return null;
    }

    if (this.idbPromise) {
      const db = await this.idbPromise;
      return (await db.get(table, id)) || null;
    }

    return null;
  }

  public async getAllRecords(table: 'customers' | 'invoices' | 'products' | 'vouchers', storeId?: string): Promise<any[]> {
    await this.ensureReady();

    if (this.isNative && this.dbConnection) {
      let query = `SELECT data FROM ${table}`;
      const params: any[] = [];
      if (storeId) {
        query += ` WHERE storeId = ?`;
        params.push(storeId);
      }
      const res = await this.dbConnection.query(query, params);
      if (res.values) {
        return res.values.map((row: any) => JSON.parse(row.data));
      }
      return [];
    }

    if (this.idbPromise) {
      const db = await this.idbPromise;
      let list = await db.getAll(table);
      if (storeId) {
        list = list.filter((item: any) => !item.storeId || item.storeId === storeId || item.ownerId === storeId);
      }
      return list;
    }

    return [];
  }

  public async deleteRecord(table: 'customers' | 'invoices' | 'products' | 'vouchers', id: string): Promise<void> {
    await this.ensureReady();

    if (this.isNative && this.dbConnection) {
      await this.dbConnection.run(`DELETE FROM ${table} WHERE id = ?;`, [id]);
      return;
    }

    if (this.idbPromise) {
      const db = await this.idbPromise;
      const tx = db.transaction(table, 'readwrite');
      await tx.objectStore(table).delete(id);
      await tx.done;
    }
  }

  // ==========================================
  // Safe Sync Queue Operations
  // ==========================================
  public async enqueueSyncItem(item: Omit<OfflineSyncQueueItem, 'id' | 'timestamp' | 'attempts'>): Promise<OfflineSyncQueueItem> {
    await this.ensureReady();

    const fullItem: OfflineSyncQueueItem = {
      ...item,
      id: generateUUID(),
      timestamp: Date.now(),
      attempts: 0
    };

    if (this.isNative && this.dbConnection) {
      const query = `
        INSERT OR REPLACE INTO sync_queue (id, storeId, collectionName, action, data, timestamp, attempts)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `;
      await this.dbConnection.run(query, [
        fullItem.id,
        fullItem.storeId,
        fullItem.collectionName,
        fullItem.action,
        JSON.stringify(fullItem.data),
        fullItem.timestamp,
        fullItem.attempts
      ]);
      return fullItem;
    }

    if (this.idbPromise) {
      const db = await this.idbPromise;
      const tx = db.transaction('sync_queue', 'readwrite');
      await tx.objectStore('sync_queue').put(fullItem);
      await tx.done;
    }

    return fullItem;
  }

  public async getSyncQueue(storeId?: string): Promise<OfflineSyncQueueItem[]> {
    await this.ensureReady();

    if (this.isNative && this.dbConnection) {
      let query = `SELECT * FROM sync_queue ORDER BY timestamp ASC`;
      const params: any[] = [];
      if (storeId) {
        query = `SELECT * FROM sync_queue WHERE storeId = ? ORDER BY timestamp ASC`;
        params.push(storeId);
      }
      const res = await this.dbConnection.query(query, params);
      if (res.values) {
        return res.values.map((row: any) => ({
          id: row.id,
          storeId: row.storeId,
          collectionName: row.collectionName,
          action: row.action,
          data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
          timestamp: row.timestamp,
          attempts: row.attempts
        }));
      }
      return [];
    }

    if (this.idbPromise) {
      const db = await this.idbPromise;
      let list = await db.getAll('sync_queue');
      if (storeId) {
        list = list.filter((item: any) => !item.storeId || item.storeId === storeId);
      }
      return list.sort((a, b) => a.timestamp - b.timestamp);
    }

    return [];
  }

  public async removeSyncQueueItem(id: string): Promise<void> {
    await this.ensureReady();

    if (this.isNative && this.dbConnection) {
      await this.dbConnection.run(`DELETE FROM sync_queue WHERE id = ?;`, [id]);
      return;
    }

    if (this.idbPromise) {
      const db = await this.idbPromise;
      const tx = db.transaction('sync_queue', 'readwrite');
      await tx.objectStore('sync_queue').delete(id);
      await tx.done;
    }
  }

  public async countSyncQueue(storeId?: string): Promise<number> {
    await this.ensureReady();

    if (this.isNative && this.dbConnection) {
      let query = `SELECT COUNT(*) as count FROM sync_queue`;
      const params: any[] = [];
      if (storeId) {
        query += ` WHERE storeId = ?`;
        params.push(storeId);
      }
      const res = await this.dbConnection.query(query, params);
      if (res.values && res.values.length > 0) {
        return res.values[0].count || 0;
      }
      return 0;
    }

    if (this.idbPromise) {
      const db = await this.idbPromise;
      if (!storeId) {
        return await db.count('sync_queue');
      }
      const list = await db.getAll('sync_queue');
      return list.filter((item: any) => item.storeId === storeId).length;
    }

    return 0;
  }
}

export const sqliteStorageProvider = new SqliteStorageProvider();
