/**
 * 🔒 JAM PRO - Universal Protected Persistent Storage Engine (v3.0)
 * ------------------------------------------------------------------
 * Directives Implemented:
 * 1. AES-GCM Encrypted Storage for sensitive offline queues & ledgers.
 * 2. Atomic Writing simulation to prevent JSON corruption on power failure.
 * 3. Dual-Storage Mirroring:
 *    - Internal Protected App Storage (IndexedDB + Private FS)
 *    - External Persistent Mirror (/Documents/JAM_Vault/ on Android, D:/JAM_Vault/ on Windows)
 *    - External mirror SURVIVES App Uninstall!
 * 4. Auto-Discovery Engine:
 *    - Auto-scans external mirror directories upon reinstallation or login.
 *    - Validates multi-tenant isolation (verifies storeId & ownerId match).
 *    - Auto-rehydrates pending invoices directly into sync queue without loss.
 */

const DB_NAME = 'JamProtectedStoreDB_v3';
const DB_VERSION = 1;
const STORE_NAME = 'protected_kv_encrypted';

export interface VaultMetadata {
  storeId: string;
  ownerId: string;
  createdAt: number;
  data: string; // Encrypted string
  checksum: string;
}

class PersistentStorageEngine {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private cryptoKeyPromise: Promise<CryptoKey | null> | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    if (typeof window === 'undefined') return;

    // 1. Request Browser/WebView Persistent Storage Grant
    if (navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
          await navigator.storage.persist();
        }
      } catch (e) {
        console.warn('⚠️ Storage persistence request skipped:', e);
      }
    }

    // 2. Initialize Key & IDB
    this.cryptoKeyPromise = this.getOrCreateAESKey();
    this.dbPromise = this.openIDB();

    // 3. Auto-rehydrate if LocalStorage was cleared by cleaner app
    await this.rehydrateLocalStorageIfNeeded();
  }

  /**
   * Generates or derives a persistent AES-GCM CryptoKey using Web Crypto API
   */
  private async getOrCreateAESKey(): Promise<CryptoKey | null> {
    if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
    try {
      const rawSeed = 'JAM_PRO_OFFLINE_SECRET_VAULT_KEY_2026_SECURE_SALT_99';
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(rawSeed),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      return await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: enc.encode('JAM_PROTECTED_SALT_SALT'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (e) {
      console.warn('⚠️ CryptoKey generation failed, falling back to plaintext:', e);
      return null;
    }
  }

  /**
   * AES-GCM Encryption
   */
  private async encrypt(text: string): Promise<string> {
    const key = await this.cryptoKeyPromise;
    if (!key || !window.crypto?.subtle) return 'RAW:' + btoa(unescape(encodeURIComponent(text)));

    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(text);
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
      );

      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ciphertext), iv.length);

      return 'ENC:' + btoa(String.fromCharCode(...combined));
    } catch (e) {
      console.warn('⚠️ Encryption failed, using fallback:', e);
      return 'RAW:' + btoa(unescape(encodeURIComponent(text)));
    }
  }

  /**
   * AES-GCM Decryption
   */
  private async decrypt(cipherStr: string): Promise<string> {
    if (cipherStr.startsWith('RAW:')) {
      return decodeURIComponent(escape(atob(cipherStr.slice(4))));
    }

    if (!cipherStr.startsWith('ENC:')) return cipherStr;

    const key = await this.cryptoKeyPromise;
    if (!key || !window.crypto?.subtle) {
      throw new Error('Crypto API unavailable for decryption');
    }

    try {
      const rawCombined = atob(cipherStr.slice(4));
      const combined = new Uint8Array(rawCombined.length);
      for (let i = 0; i < rawCombined.length; i++) {
        combined[i] = rawCombined.charCodeAt(i);
      }

      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error('❌ Decryption failed:', e);
      throw e;
    }
  }

  private openIDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = (event: any) => resolve(event.target.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * 1. ATOMIC WRITE & DUAL-STORAGE MIRRORING
   * Writes data securely to:
   * - LocalStorage
   * - Encrypted IndexedDB
   * - Native App Private Data Storage
   * - External Public Vault Mirror (/Documents/JAM_Vault/ or D:/JAM_Vault/)
   */
  public async setItem(key: string, value: string, storeId = 'master', ownerId = 'master'): Promise<void> {
    if (typeof window === 'undefined') return;

    // Encrypt content first
    const encryptedData = await this.encrypt(value);

    // Metadata wrapper
    const vaultObject: VaultMetadata = {
      storeId,
      ownerId,
      createdAt: Date.now(),
      data: encryptedData,
      checksum: this.calculateSimpleHash(value)
    };

    const serializedVault = JSON.stringify(vaultObject);

    // Step A: LocalStorage (Primary In-Memory Cache)
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`LocalStorage write error for ${key}:`, e);
    }

    // Step B: Atomic Write to IndexedDB (Protected System Cache)
    try {
      const db = await this.dbPromise;
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(serializedVault, key);
      }
    } catch (e) {
      console.warn(`IndexedDB write error for ${key}:`, e);
    }

    // Step C: Native APK Dual-Mirroring (Capacitor / Cordova Filesystem)
    if ((window as any).Capacitor?.Plugins?.Filesystem) {
      try {
        const Filesystem = (window as any).Capacitor.Plugins.Filesystem;
        const Directory = (window as any).Capacitor.Plugins.Directory;

        // 1. Internal Private Directory (Atomic Write with tmp file)
        const tmpFileName = `tmp_${key}_${Date.now()}.json`;
        const finalFileName = `jam_protected_${key}.json`;

        await Filesystem.writeFile({
          path: tmpFileName,
          data: serializedVault,
          directory: Directory.Data,
          encoding: 'utf8'
        });

        // Rename tmp -> final (Atomic Swap)
        try {
          await Filesystem.rename({
            from: tmpFileName,
            to: finalFileName,
            directory: Directory.Data
          });
        } catch {
          // Fallback rewrite
          await Filesystem.writeFile({
            path: finalFileName,
            data: serializedVault,
            directory: Directory.Data,
            encoding: 'utf8'
          });
        }

        // 2. External Mirror Directory (/Documents/JAM_Vault/) - Survives App Uninstall!
        try {
          await Filesystem.writeFile({
            path: `JAM_Vault/${storeId}_${key}_mirror.jam`,
            data: serializedVault,
            directory: Directory.Documents || Directory.ExternalStorage,
            encoding: 'utf8',
            recursive: true
          });
        } catch (extErr) {
          console.warn('⚠️ External APK mirror write warning:', extErr);
        }
      } catch (e) {
        // Ignored if browser env
      }
    }

    // Step D: Native EXE Dual-Mirroring (Electron / Tauri Bridge)
    if ((window as any).electronAPI) {
      try {
        if ((window as any).electronAPI.saveProtectedData) {
          await (window as any).electronAPI.saveProtectedData(key, serializedVault);
        }
        if ((window as any).electronAPI.saveExternalMirror) {
          await (window as any).electronAPI.saveExternalMirror(storeId, key, serializedVault);
        }
      } catch (e) {
        console.warn('⚠️ Electron bridge write error:', e);
      }
    }
  }

  /**
   * Retrieves data with automatic decryption
   */
  public async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    // 1. LocalStorage
    const localVal = localStorage.getItem(key);
    if (localVal) return localVal;

    // 2. Encrypted IndexedDB
    try {
      const db = await this.dbPromise;
      if (db) {
        const vaultStr = await new Promise<string | null>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });

        if (vaultStr) {
          const vault: VaultMetadata = JSON.parse(vaultStr);
          const decrypted = await this.decrypt(vault.data);
          try {
            localStorage.setItem(key, decrypted);
          } catch {}
          return decrypted;
        }
      }
    } catch (e) {
      console.warn('⚠️ IDB read error:', e);
    }

    return null;
  }

  /**
   * 2. AUTO-DISCOVERY & RESTORATION ENGINE
   * Scans external mirror vaults after app reinstallation or fresh boot.
   * Filters by storeId & ownerId to guarantee multi-tenant isolation.
   * Returns restored offline transactions list.
   */
  public async autoDiscoverAndRestoreMirrors(activeStoreId: string, activeOwnerId: string): Promise<any[]> {
    console.log(`🔍 [Auto-Discovery Engine] Scanning external mirrors for store: "${activeStoreId}"...`);
    const restoredItems: any[] = [];

    // A. Capacitor APK External Mirror Scan (/Documents/JAM_Vault/)
    if ((window as any).Capacitor?.Plugins?.Filesystem) {
      try {
        const Filesystem = (window as any).Capacitor.Plugins.Filesystem;
        const Directory = (window as any).Capacitor.Plugins.Directory;

        const filesResult = await Filesystem.readdir({
          path: 'JAM_Vault',
          directory: Directory.Documents || Directory.ExternalStorage
        });

        if (filesResult?.files) {
          for (const fileObj of filesResult.files) {
            const fileName = typeof fileObj === 'string' ? fileObj : fileObj.name;
            if (fileName.includes(activeStoreId) && fileName.endsWith('_mirror.jam')) {
              try {
                const fileContent = await Filesystem.readFile({
                  path: `JAM_Vault/${fileName}`,
                  directory: Directory.Documents || Directory.ExternalStorage,
                  encoding: 'utf8'
                });

                if (fileContent?.data) {
                  const vault: VaultMetadata = JSON.parse(fileContent.data);

                  // Strict Isolation Check!
                  if (vault.storeId === activeStoreId && vault.ownerId === activeOwnerId) {
                    const decryptedVal = await this.decrypt(vault.data);
                    const parsedQueue = JSON.parse(decryptedVal);

                    if (Array.isArray(parsedQueue)) {
                      restoredItems.push(...parsedQueue);
                      console.log(`✅ [Auto-Discovery] Restored ${parsedQueue.length} items from external mirror: ${fileName}`);
                    }
                  } else {
                    console.warn(`🛡️ [Isolation Shield] Skipped mirror "${fileName}" - Tenant mismatch!`);
                  }
                }
              } catch (readErr) {
                console.warn(`⚠️ Error reading mirror file ${fileName}:`, readErr);
              }
            }
          }
        }
      } catch (e) {
        console.log('ℹ️ No external APK mirrors found or permission pending.');
      }
    }

    // B. Electron/Tauri EXE External Mirror Scan (D:\JAM_Vault or E:\JAM_Vault)
    if ((window as any).electronAPI?.scanExternalMirrors) {
      try {
        const externalMirrors = await (window as any).electronAPI.scanExternalMirrors(activeStoreId);
        for (const mirrorRaw of externalMirrors) {
          try {
            const vault: VaultMetadata = JSON.parse(mirrorRaw);
            if (vault.storeId === activeStoreId && vault.ownerId === activeOwnerId) {
              const decryptedVal = await this.decrypt(vault.data);
              const parsedQueue = JSON.parse(decryptedVal);
              if (Array.isArray(parsedQueue)) {
                restoredItems.push(...parsedQueue);
              }
            }
          } catch {}
        }
      } catch (e) {
        console.warn('⚠️ Electron external mirror scan warning:', e);
      }
    }

    return restoredItems;
  }

  /**
   * Rehydrates LocalStorage if wiped by cleaner applications
   */
  private async rehydrateLocalStorageIfNeeded() {
    const criticalKeys = [
      'jam_pending_offline_queue_v2',
      'offline_cached_accounts_map',
      'JAM_TIME_HIGH_WATERMARK'
    ];

    for (const key of criticalKeys) {
      if (!localStorage.getItem(key)) {
        const restored = await this.getItem(key);
        if (restored) {
          console.log(`🛡️ [PersistentStorageEngine] Restored wiped key "${key}" from Encrypted IDB Cache!`);
        }
      }
    }
  }

  private calculateSimpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString(16);
  }
}

export const persistentStorageEngine = new PersistentStorageEngine();
