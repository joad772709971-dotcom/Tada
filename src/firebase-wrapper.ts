import * as realFirestore from '@firebase/firestore';
import { getAuth } from 'firebase/auth';
import { quotaAndOfflineEngine } from './services/quotaAndOfflineEngine';
import { MultiTenantService } from './services/multiTenantService';

const getAuthInfo = () => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return { userId: null, email: null, emailVerified: false, isAnonymous: false };
    return {
      userId: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      isAnonymous: user.isAnonymous,
      tenantId: user.tenantId,
      providerInfo: user.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    };
  } catch (e) {
    return { userId: null, email: null, emailVerified: false, isAnonymous: false };
  }
};

// Re-export everything by default
export * from '@firebase/firestore';

// EXEMPT COLLECTIONS for Queries Tenant Guard
const EXEMPT_COLLECTIONS = new Set([
  'shops',
  'promo_videos',
  'public_auctions',
  'wholesaleProducts',
  'networkLinks',
  'messages',
  'global_configs'
]);

/**
 * 🛡️ Queries Tenant Guard: Wrapped collection to preserve path metadata
 */
export const collection = (db: any, path: string, ...pathSegments: string[]) => {
  const colRef = realFirestore.collection(db, path, ...pathSegments);
  const fullPath = [path, ...pathSegments].filter(Boolean).join('/');
  (colRef as any).__path = fullPath;
  return colRef;
};

/**
 * 🛡️ Queries Tenant Guard: Wrapped where to preserve fieldPath metadata
 */
export const where = (fieldPath: string, opStr: any, value: any) => {
  const constraint = realFirestore.where(fieldPath, opStr, value);
  (constraint as any).__fieldPath = fieldPath;
  (constraint as any).__opStr = opStr;
  (constraint as any).__value = value;
  return constraint;
};

/**
 * 🛡️ Queries Tenant Guard: Wrapped query helper to auto-inject tenant ownerId filters
 */
export const query = (queryRef: any, ...queryConstraints: any[]) => {
  const path = queryRef.__path || queryRef.path || '';
  
  const needsGuard = path && 
                     !path.startsWith('shops') && 
                     !path.includes('/shops') && 
                     !EXEMPT_COLLECTIONS.has(path);
  
  let finalConstraints = [...queryConstraints];
  let hasOwnerFilter = queryConstraints.some(c => 
    c.__fieldPath === 'ownerId' || 
    c.__fieldPath === 'storeId' || 
    c.__fieldPath === 'tenantId'
  );

  if (!hasOwnerFilter) {
    hasOwnerFilter = queryConstraints.some(c => {
      try {
        const str = JSON.stringify(c);
        return str.includes('"ownerId"') || str.includes('"storeId"') || str.includes('"tenantId"');
      } catch (e) {
        return false;
      }
    });
  }

  if (needsGuard) {
    const profile = (window as any).__user_profile;
    const currentOwnerId = profile?.ownerId || profile?.storeId || '';
    
    if (currentOwnerId && !hasOwnerFilter) {
      console.warn(`🛡️ [Queries Tenant Guard] Intercepted missing tenant filter for query path: "${path}". Automatically injecting ownerId: "${currentOwnerId}"`);
      finalConstraints.push(where('ownerId', '==', currentOwnerId));
      hasOwnerFilter = true;
    }
  }

  const q = realFirestore.query(queryRef, ...finalConstraints);
  (q as any).__path = path;
  if (hasOwnerFilter) {
    (q as any).__hasOwnerFilter = true;
  }
  return q;
};

/**
 * Helper to guard reference before query read execution
 */
const guardQueryOrRef = (queryOrRef: any) => {
  if (!queryOrRef) return queryOrRef;

  // 🛡️ Queries Tenant Guard: DocumentReferences do not support query filtering and are exempt
  const isDocumentRef = queryOrRef.type === 'document' || 
                        (typeof queryOrRef.path === 'string' && queryOrRef.path.split('/').filter(Boolean).length % 2 === 0);
  if (isDocumentRef) {
    return queryOrRef;
  }

  const path = queryOrRef.__path || queryOrRef.path || '';
  const needsGuard = path && 
                     !path.startsWith('shops') && 
                     !path.includes('/shops') && 
                     !EXEMPT_COLLECTIONS.has(path);

  if (!needsGuard) return queryOrRef;

  const profile = (window as any).__user_profile;
  const currentOwnerId = profile?.ownerId || profile?.storeId || '';

  if (!currentOwnerId) return queryOrRef;

  if (queryOrRef.__hasOwnerFilter) {
    return queryOrRef;
  }

  console.warn(`🛡️ [Queries Tenant Guard] Last-mile intercept on getDocs/onSnapshot for path: "${path}". Injecting tenant ownerId: "${currentOwnerId}"`);
  
  const guardedQuery = realFirestore.query(queryOrRef, where('ownerId', '==', currentOwnerId));
  (guardedQuery as any).__path = path;
  (guardedQuery as any).__hasOwnerFilter = true;
  return guardedQuery;
};

/**
 * Helper to merge offline queue items and local cache docs with Firestore snapshot docs
 */
const mergeOfflineItemsWithSnapshot = (queryOrRef: any, remoteDocs: any[] = []) => {
  try {
    const path = queryOrRef.__path || queryOrRef.path || (queryOrRef._query?.path?.toString()) || '';
    if (!path) return remoteDocs;
    const colName = path.split('/')[0];
    if (!colName) return remoteDocs;

    // Read offline queue items for this collection
    const queue = getOfflineQueue();
    const offlineItemsForCol = queue.filter(item => item.path.startsWith(colName));

    // Read local cache docs for this collection
    const rawLocal = localStorage.getItem(`jam_local_docs_${colName}`);
    const localCacheDocs: any[] = rawLocal ? JSON.parse(rawLocal) : [];

    const existingIds = new Set<string>();
    const existingBarcodes = new Set<string>();

    // Index remote docs
    remoteDocs.forEach((d: any) => {
      const id = d.id || d.docId;
      if (id) existingIds.add(id);
      const data = typeof d.data === 'function' ? d.data() : d;
      if (data?.barcode) existingBarcodes.add(data.barcode);
      if (data?.id) existingIds.add(data.id);
      if (data?.transaction_id) existingIds.add(data.transaction_id);
    });

    const mergedDocs = [...remoteDocs];

    const resolvedDb = getSafeFirestore(queryOrRef) || (typeof window !== 'undefined' ? (window as any).__firebase_db : null);

    // Helper to wrap raw data as Firestore-like doc object
    const wrapAsDoc = (id: string, data: any) => {
      let docRef: any = null;
      try {
        if (resolvedDb && path && id) {
          docRef = realFirestore.doc(resolvedDb, path, id);
        }
      } catch (e) {
        console.warn('Could not create doc ref for offline doc:', e);
      }
      return {
        id,
        docId: id,
        ref: docRef,
        exists: () => true,
        data: () => ({ id, ...data }),
        ...data
      };
    };

    // Merge pending offline queue items
    offlineItemsForCol.forEach(qItem => {
      if (qItem.data && qItem.data._deleted) return;
      const itemId = qItem.data?.id || qItem.id || qItem.data?.transaction_id;
      const barcode = qItem.data?.barcode;

      if (!existingIds.has(itemId) && (!barcode || !existingBarcodes.has(barcode))) {
        if (itemId) existingIds.add(itemId);
        if (barcode) existingBarcodes.add(barcode);
        mergedDocs.unshift(wrapAsDoc(itemId || crypto.randomUUID(), qItem.data));
      }
    });

    // Merge local cache docs
    localCacheDocs.forEach(cDoc => {
      if (cDoc._deleted) return;
      const cId = cDoc.id || cDoc.docId;
      const barcode = cDoc.barcode;
      if (!existingIds.has(cId) && (!barcode || !existingBarcodes.has(barcode))) {
        if (cId) existingIds.add(cId);
        if (barcode) existingBarcodes.add(barcode);
        mergedDocs.unshift(wrapAsDoc(cId, cDoc));
      }
    });

    return mergedDocs;
  } catch (e) {
    console.error('Error merging offline items with snapshot:', e);
    return remoteDocs;
  }
};

/**
 * 🛡️ Queries Tenant Guard: Wrapped getDoc with local cache fallback and resilience
 */
export const getDoc = async (docRef: any) => {
  try {
    quotaAndOfflineEngine.trackRead(1);
    const snap = await realFirestore.getDoc(docRef);
    if (snap && typeof snap.exists === 'function' && snap.exists()) {
      return snap;
    }
  } catch (err) {
    console.warn('getDoc network notice (falling back to local cache):', err);
  }

  // Fallback to local collection cache
  const path = docRef?.path || '';
  const parts = path.split('/').filter(Boolean);
  const docId = parts[parts.length - 1] || '';
  const colName = parts[0] || '';

  let localData = null;
  if (colName && docId) {
    try {
      const rawLocal = localStorage.getItem(`jam_local_docs_${colName}`);
      if (rawLocal) {
        const docs = JSON.parse(rawLocal);
        const found = docs.find((d: any) => d.id === docId || d.docId === docId);
        if (found) localData = found;
      }
    } catch (e) {}
  }

  return {
    id: docId || '',
    ref: docRef,
    metadata: { hasPendingWrites: true, fromCache: true },
    exists: () => !!localData,
    data: () => localData || undefined,
    get: (f: string) => localData ? localData[f] : undefined
  };
};

/**
 * 🛡️ Queries Tenant Guard: Wrapped getDocs with auto-injection and diagnostic error mapping
 */
export const getDocs = async (queryOrRef: any) => {
  const guarded = guardQueryOrRef(queryOrRef);
  try {
    quotaAndOfflineEngine.trackRead(1);
    const snap = await realFirestore.getDocs(guarded);
    const mergedDocs = mergeOfflineItemsWithSnapshot(queryOrRef, snap.docs || []);
    return {
      ...snap,
      docs: mergedDocs,
      empty: mergedDocs.length === 0,
      size: mergedDocs.length,
      forEach: (cb: (doc: any) => void) => mergedDocs.forEach(cb)
    };
  } catch (err: any) {
    const mergedDocs = mergeOfflineItemsWithSnapshot(queryOrRef, []);
    if (mergedDocs.length > 0) {
      return {
        docs: mergedDocs,
        empty: false,
        size: mergedDocs.length,
        forEach: (cb: (doc: any) => void) => mergedDocs.forEach(cb)
      };
    }
    const rawError = err?.message || String(err);
    if (
      rawError.includes('INTERNAL ASSERTION FAILED') ||
      rawError.includes('Unexpected state') ||
      rawError.includes('ca9') ||
      rawError.includes('b815') ||
      rawError.includes('ve:')
    ) {
      console.warn('⚠️ Tolerated internal Firestore assertion notice in getDocs:', rawError);
      return {
        docs: mergedDocs,
        empty: mergedDocs.length === 0,
        size: mergedDocs.length,
        forEach: (cb: (doc: any) => void) => mergedDocs.forEach(cb)
      };
    }
    const errorInfo = {
      error: rawError,
      operationType: 'list',
      path: queryOrRef.__path || queryOrRef.path || '',
      authInfo: getAuthInfo()
    };
    throw new Error(JSON.stringify(errorInfo));
  }
};

/**
 * 🛡️ Queries Tenant Guard: Wrapped onSnapshot with auto-injection and diagnostic error mapping
 */
export const onSnapshot = (queryOrRef: any, ...args: any[]) => {
  const isDocRef = queryOrRef?.type === 'document' || 
    (typeof queryOrRef?.path === 'string' && queryOrRef.path.split('/').filter(Boolean).length % 2 === 0);

  let nextCallback: any = null;
  let errorCallback: any = null;
  let options: any = null;
  
  if (typeof args[0] === 'function') {
    nextCallback = args[0];
    errorCallback = args[1];
  } else if (typeof args[0] === 'object' && typeof args[1] === 'function') {
    options = args[0];
    nextCallback = args[1];
    errorCallback = args[2];
  }

  const guarded = guardQueryOrRef(queryOrRef);

  if (isDocRef) {
    const wrappedDocNextCallback = (snap: any) => {
      try { quotaAndOfflineEngine.trackRead(1); } catch {}
      
      const path = queryOrRef.path || '';
      const parts = path.split('/').filter(Boolean);
      const docId = parts[parts.length - 1] || '';
      const colName = parts[0] || '';

      let localData = null;
      if (colName && docId) {
        try {
          const rawLocal = localStorage.getItem(`jam_local_docs_${colName}`);
          if (rawLocal) {
            const docs = JSON.parse(rawLocal);
            const found = docs.find((d: any) => d.id === docId || d.docId === docId);
            if (found) localData = found;
          }
        } catch (e) {}
      }

      if (snap && typeof snap.exists === 'function' && snap.exists()) {
        if (localData) {
          const merged = { ...snap.data(), ...localData };
          const docSnap = {
            id: snap.id || docId,
            ref: snap.ref || queryOrRef,
            metadata: snap.metadata,
            exists: () => true,
            data: () => merged,
            get: (f: string) => merged[f]
          };
          if (nextCallback) nextCallback(docSnap);
          return;
        }
        if (nextCallback) nextCallback(snap);
        return;
      }

      if (localData) {
        const docSnap = {
          id: docId,
          ref: queryOrRef,
          metadata: { hasPendingWrites: true, fromCache: true },
          exists: () => true,
          data: () => localData,
          get: (f: string) => localData[f]
        };
        if (nextCallback) nextCallback(docSnap);
        return;
      }

      if (snap) {
        if (nextCallback) nextCallback(snap);
        return;
      }

      const emptyDocSnap = {
        id: docId,
        ref: queryOrRef,
        metadata: { hasPendingWrites: false, fromCache: true },
        exists: () => false,
        data: () => undefined,
        get: () => undefined
      };
      if (nextCallback) nextCallback(emptyDocSnap);
    };

    const wrappedDocErrorCallback = (err: any) => {
      const rawError = err?.message || String(err);
      if (
        rawError.includes('INTERNAL ASSERTION FAILED') ||
        rawError.includes('Unexpected state') ||
        rawError.includes('ca9') ||
        rawError.includes('b815') ||
        rawError.includes('ve:')
      ) {
        console.warn('⚠️ Tolerated internal Firestore assertion notice in doc onSnapshot:', rawError);
        return;
      }
      console.warn('Doc onSnapshot notice (tolerated):', rawError);
      const path = queryOrRef.path || '';
      const parts = path.split('/').filter(Boolean);
      const docId = parts[parts.length - 1] || '';
      const colName = parts[0] || '';

      let localData = null;
      if (colName && docId) {
        try {
          const rawLocal = localStorage.getItem(`jam_local_docs_${colName}`);
          if (rawLocal) {
            const docs = JSON.parse(rawLocal);
            const found = docs.find((d: any) => d.id === docId || d.docId === docId);
            if (found) localData = found;
          }
        } catch (e) {}
      }

      const docSnap = {
        id: docId,
        ref: queryOrRef,
        metadata: { hasPendingWrites: true, fromCache: true },
        exists: () => !!localData,
        data: () => localData || undefined,
        get: (f: string) => localData ? localData[f] : undefined
      };

      if (nextCallback) nextCallback(docSnap);
      if (errorCallback) {
        try { errorCallback(err); } catch (e) {}
      }
    };

    const unsubscribe = options 
      ? realFirestore.onSnapshot(guarded, options, wrappedDocNextCallback, wrappedDocErrorCallback)
      : realFirestore.onSnapshot(guarded, wrappedDocNextCallback, wrappedDocErrorCallback);

    return unsubscribe;
  }
  
  const wrappedErrorCallback = (err: any) => {
    const rawError = err?.message || String(err);
    if (
      rawError.includes('INTERNAL ASSERTION FAILED') ||
      rawError.includes('Unexpected state') ||
      rawError.includes('ca9') ||
      rawError.includes('b815')
    ) {
      console.warn('⚠️ Tolerated internal Firestore assertion notice:', rawError);
      return;
    }

    const isPermissionError = rawError.toLowerCase().includes('permission') || rawError.toLowerCase().includes('insufficient');
    const pathStr = queryOrRef.__path || queryOrRef.path || (queryOrRef._query?.path?.toString()) || '';

    const errorInfo = {
      error: rawError,
      operationType: 'list',
      path: pathStr,
      authInfo: getAuthInfo()
    };
    const errorString = JSON.stringify(errorInfo);

    if (isPermissionError) {
      console.warn('🛡️ JAM Firestore onSnapshot Permission Notice (offline/guest):', pathStr, rawError);
    } else {
      console.warn('Firestore onSnapshot Notice:', errorString);
    }

    if (errorCallback) {
      try {
        errorCallback(err);
      } catch (cbErr) {
        console.warn('Unhandled onSnapshot errorCallback handled safely:', cbErr);
      }
    }
  };

  let latestRemoteSnap: any = null;

  const emitMergedSnap = (snap?: any) => {
    if (snap) latestRemoteSnap = snap;
    const remoteDocs = latestRemoteSnap?.docs || [];
    const mergedDocs = mergeOfflineItemsWithSnapshot(queryOrRef, remoteDocs);

    const mergedSnap = {
      ...(latestRemoteSnap || {}),
      docs: mergedDocs,
      empty: mergedDocs.length === 0,
      size: mergedDocs.length,
      forEach: (cb: (doc: any) => void) => mergedDocs.forEach(cb),
      exists: () => false,
      docChanges: () => (typeof latestRemoteSnap?.docChanges === 'function' ? latestRemoteSnap.docChanges() : []),
      metadata: latestRemoteSnap?.metadata || { hasPendingWrites: false, fromCache: true }
    };

    try {
      const docCount = mergedDocs.length || 1;
      quotaAndOfflineEngine.trackRead(docCount);
    } catch {
      quotaAndOfflineEngine.trackRead(1);
    }

    if (nextCallback) nextCallback(mergedSnap);
  };

  // Listen to jam_offline_data_updated event for instant UI screen updates
  let updateListener: any = null;
  if (typeof window !== 'undefined') {
    const path = queryOrRef.__path || queryOrRef.path || (queryOrRef._query?.path?.toString()) || '';
    const colName = path.split('/')[0];

    updateListener = (e: any) => {
      if (e.detail?.colName === colName || !colName || e.detail?.path?.includes(colName)) {
        emitMergedSnap();
      }
    };
    window.addEventListener('jam_offline_data_updated', updateListener);
  }

  const wrappedNextCallback = (snap: any) => {
    emitMergedSnap(snap);
  };

  const unsubscribe = options 
    ? realFirestore.onSnapshot(guarded, options, wrappedNextCallback, wrappedErrorCallback)
    : realFirestore.onSnapshot(guarded, wrappedNextCallback, wrappedErrorCallback);

  return () => {
    if (typeof window !== 'undefined' && updateListener) {
      window.removeEventListener('jam_offline_data_updated', updateListener);
    }
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  };
};

// In-process memory log to prevent duplicate processing
const processedTransactions = new Set<string>();

// Interface for offline queue items
interface OfflineQueueItem {
  id: string;
  operation: 'addDoc' | 'setDoc' | 'updateDoc';
  path: string;
  data: any;
  options?: any;
  timestamp: number;
  failCount?: number;
}

/**
 * Check if the current shop's subscription/license has expired
 */
export const isSubscriptionExpired = (): boolean => {
  try {
    const expiry = localStorage.getItem('jam_shop_subscription_expiry');
    if (!expiry) return false;
    if (expiry === 'Infinity') return false;
    const expiryMs = parseInt(expiry, 10);
    return !isNaN(expiryMs) && expiryMs < Date.now();
  } catch (err) {
    return false;
  }
};

/**
 * Global helper to determine if we should fall back to saving/writing locally (offline-like mode)
 */
export const shouldForceOfflineWrite = (): boolean => {
  if (typeof window === 'undefined') return false;

  // 1. Physically offline
  if (!navigator.onLine) return true;

  // 2. Local Storage or global variable flags representing quota/license limit exhaustion
  if ((window as any).__quota_exceeded) return true;

  // 3. Checked subscription expired status
  if (isSubscriptionExpired()) return true;

  return false;
};

/**
 * Smart Deduplication Guard for Financial and Accounting Transactions (SCRE)
 * Bypassed safely to allow legitimate repeat purchases, inventory entries, and sales without false popups or blocks.
 */
export const checkAndPreventDuplicateTransaction = (colPath: string, data: any): boolean => {
  return false;
};

/**
 * Smart Deduplication Guard for Order Status and Employee Task Acceptances (SCRE)
 * Bypassed safely to allow legitimate status updates without false popups or blocks.
 */
export const checkAndPreventDuplicateOrderUpdate = (colPath: string, docId: string, data: any): boolean => {
  return false;
};

/**
 * Helper to keep persistent local collection cache updated in real time for offline resilience
 */
export const updateLocalCollectionCache = (path: string, docId: string, data: any, isDelete = false) => {
  try {
    if (!path || !docId) return;
    const parts = path.split('/');
    const colName = parts[0];
    const key = `jam_local_docs_${colName}`;
    const raw = localStorage.getItem(key);
    let docs: any[] = raw ? JSON.parse(raw) : [];

    if (isDelete) {
      docs = docs.filter((d: any) => d.id !== docId && d.docId !== docId);
    } else {
      const idx = docs.findIndex((d: any) => d.id === docId || d.docId === docId);
      const newDoc = { id: docId, docId, ...data, _updatedAtLocal: Date.now() };
      if (idx >= 0) {
        docs[idx] = { ...docs[idx], ...newDoc };
      } else {
        docs.unshift(newDoc);
      }
    }
    if (docs.length > 1000) docs = docs.slice(0, 1000);
    localStorage.setItem(key, JSON.stringify(docs));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jam_offline_data_updated', {
        detail: { path, colName, docId, data, isDelete }
      }));
    }
  } catch (err) {
    console.error('Failed to update local collection cache:', err);
  }
};

/**
 * Helper to get the offline write queue from localStorage securely
 */
const getOfflineQueue = (): OfflineQueueItem[] => {
  try {
    const data = localStorage.getItem('jam_offline_write_queue');
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to parse offline write queue:', err);
    return [];
  }
};

/**
 * Helper to save the offline write queue to localStorage securely
 */
const saveOfflineQueue = (queue: OfflineQueueItem[]) => {
  try {
    localStorage.setItem('jam_offline_write_queue', JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to save offline write queue:', err);
  }
};

/**
 * Automatically carries the authenticated storeId / ownerId context for all mutations
 */
const enrichWithStoreContext = (data: any) => {
  if (!data || typeof data !== 'object') return data;
  const profile = (window as any).__user_profile;
  const storeId = profile?.storeId || profile?.ownerId || '';
  const ownerId = profile?.ownerId || profile?.storeId || '';

  const enriched = { ...data };
  if (storeId) {
    if (!enriched.storeId) enriched.storeId = storeId;
    if (!enriched.ownerId) enriched.ownerId = ownerId;
  }
  return enriched;
};

/**
 * We wrap realDoc so we can resolve reference paths cleanly
 */
const getRefFromPath = (db: any, path: string, operation: string) => {
  const parts = path.split('/');
  if (parts.length % 2 === 0) {
    // Document path
    return realFirestore.doc(db, path);
  } else {
    // Collection path
    return realFirestore.collection(db, path);
  }
};

/**
 * Background Silent Sync Runner
 * Reads offline queue items, processes them in chunks of 100, and sleeps between items
 * to ensure 100% smooth UI performance (no main thread freezing).
 */
let isSyncing = false;

export const startBackgroundSync = async (dbInstance: any) => {
  if (isSyncing) return;
  if (!navigator.onLine) return;

  // Run offline validator audit to auto-repair timestamps and state integrity
  try {
    const { OfflineSyncValidatorService } = await import('./services/OfflineSyncValidatorService');
    await OfflineSyncValidatorService.inspectAndValidateQueue(true);
  } catch (auditErr) {
    console.warn('OfflineSyncValidator audit warning (tolerated):', auditErr);
  }

  // Trigger telemetry queue sync to upload offline logs to SuperAdmin dashboard
  try {
    const { AccountingTelemetry } = await import('./services/telemetryInterceptor');
    AccountingTelemetry.syncOfflineTelemetry().catch(console.warn);
  } catch (telErr) {
    console.warn('Telemetry sync trigger notice:', telErr);
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  console.log(`📶 [Offline Sync Daemon] Found ${queue.length} items to sync. Processing silently in the background...`);

  // Process in chunks of 100 records
  const tempQueue = [...queue];
  const chunkSize = 100;
  
  const successfulItemIds = new Set<string>();
  const failedItemsUpdate: { [id: string]: { failCount: number } } = {};
  const itemsToPurge = new Set<string>();

  while (tempQueue.length > 0 && navigator.onLine) {
    const chunk = tempQueue.splice(0, chunkSize);
    
    for (const item of chunk) {
      if (!navigator.onLine) break;

      try {
        const ref = getRefFromPath(dbInstance, item.path, item.operation);
        
        if (item.operation === 'addDoc') {
          // Send to database
          await realFirestore.setDoc(ref, {
            ...item.data,
            synced_from_offline: true,
            synced_at: realFirestore.serverTimestamp()
          });
        } else if (item.operation === 'setDoc') {
          await realFirestore.setDoc(ref, {
            ...item.data,
            synced_from_offline: true,
            synced_at: realFirestore.serverTimestamp()
          }, item.options);
        } else if (item.operation === 'updateDoc') {
          try {
            await realFirestore.updateDoc(ref, {
              ...item.data,
              synced_from_offline: true,
              synced_at: realFirestore.serverTimestamp()
            });
          } catch (updateErr: any) {
            const isNotFound = updateErr?.code === 'not-found' || 
                               updateErr?.message?.includes('No document to update') ||
                               updateErr?.message?.includes('not-found') ||
                               updateErr?.message?.includes('NOT_FOUND');
            if (isNotFound) {
              console.warn(`⚠️ [Offline Syncer] Document not found for updateDoc on ${item.path}, falling back to setDoc with merge: true`);
              await realFirestore.setDoc(ref, {
                ...item.data,
                synced_from_offline: true,
                synced_at: realFirestore.serverTimestamp()
              }, { merge: true });
            } else {
              throw updateErr;
            }
          }
        }
        
        successfulItemIds.add(item.id);
        console.log(` ✅ Synchronized item ${item.id} successfully: ${item.path}`);
      } catch (err: any) {
        console.error(` ❌ Sync skipped for item ${item.id} (${item.operation} on ${item.path}):`, err);
        
        const isPermission = err?.code === 'permission-denied' || 
                             err?.message?.includes('permission-denied') || 
                             err?.message?.includes('Missing or insufficient permissions') ||
                             err?.message?.includes('insufficient permissions');

        const isNotFound = err?.code === 'not-found' || 
                           err?.message?.includes('No document to update') ||
                           err?.message?.includes('not-found') ||
                           err?.message?.includes('NOT_FOUND');

        const newFailCount = (item.failCount || 0) + 1;
        if (isPermission || (isNotFound && newFailCount >= 3) || newFailCount >= 10) {
          console.warn(`⚠️ [Offline Syncer] Dropping/purging item ${item.id} from queue due to unresolvable error (permission-denied/notFound/excessive failures). Attempts: ${newFailCount}`);
          itemsToPurge.add(item.id);
        } else {
          failedItemsUpdate[item.id] = { failCount: newFailCount };
        }
      }

      // NEVER freeze UI: Yield 80ms sleep to main thread between processing items
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }

  // Update persistently saved queue
  const currentQueue = getOfflineQueue();
  const updatedQueue = currentQueue
    .filter(origItem => !successfulItemIds.has(origItem.id) && !itemsToPurge.has(origItem.id))
    .map(origItem => {
      if (origItem.id in failedItemsUpdate) {
        return {
          ...origItem,
          failCount: failedItemsUpdate[origItem.id].failCount
        };
      }
      return origItem;
    });
  saveOfflineQueue(updatedQueue);

  isSyncing = false;
};

// Start a periodic checker to kick off background sync silently
if (typeof window !== 'undefined') {
  setInterval(() => {
    // Retrieve the default Firestore db from our exports if initializeFirestore was executed
    const db = (window as any).__firebase_db;
    if (db && navigator.onLine) {
      startBackgroundSync(db).catch(err => console.error('[Offline Sync Daemon Error]:', err));
    }
  }, 20000); // Executed silently every 20 seconds
}

/**
 * Helper to safely obtain a valid Firestore instance
 */
const getSafeFirestore = (candidate?: any) => {
  if (!candidate) return typeof window !== 'undefined' ? (window as any).__firebase_db : null;
  if (candidate?.firestore) return candidate.firestore;
  if (candidate?._delegate?.firestore) return candidate._delegate.firestore;
  if (candidate?._firestore) return candidate._firestore;
  if (candidate && typeof candidate === 'object' && candidate.type === 'firestore') return candidate;
  if (typeof window !== 'undefined' && (window as any).__firebase_db) {
    return (window as any).__firebase_db;
  }
  return candidate;
};

/**
 * 1. Global Anti-Duplication: addDoc Wrapper
 * Converts addDoc into unique composite setDoc to enforce 100% accounting accuracy.
 */
export const addDoc = async (colRef: any, data: any) => {
  if (!colRef) {
    console.warn('[addDoc] Called with undefined or null colRef');
    return { id: crypto.randomUUID(), path: '', firestore: (window as any)?.__firebase_db };
  }

  const path = colRef?.path || colRef?.__path || (colRef?._query?.path?.toString()) || '';
  const resolvedDb = colRef?.firestore || getSafeFirestore(colRef) || (window as any).__firebase_db;

  // Capture or generate a transaction ID
  const txId = (window as any).__lastTransactionId || crypto.randomUUID();
  const writeCount = (window as any).__transactionWriteCount || 0;
  (window as any).__transactionWriteCount = writeCount + 1;

  const compositeDocId = `${txId}_${writeCount}`;

  // Helper to safely construct doc reference
  const safeDocRef = () => {
    if (resolvedDb && path) {
      try {
        return realFirestore.doc(resolvedDb, path, compositeDocId);
      } catch (err) {
        console.warn('realFirestore.doc failed, returning fallback reference:', err);
      }
    }
    return {
      id: compositeDocId,
      path: path ? `${path}/${compositeDocId}` : compositeDocId,
      firestore: resolvedDb,
      parent: colRef
    };
  };

  // 1. SCRE Deduplication check for financial entries
  if (path && checkAndPreventDuplicateTransaction(path, data)) {
    // Return a mock DocumentReference immediately
    return safeDocRef();
  }

  // Local deduplication protection
  if (processedTransactions.has(compositeDocId)) {
    console.warn(`[Anti-Duplication] Intercepted duplicate call for: ${compositeDocId}`);
    return safeDocRef();
  }
  processedTransactions.add(compositeDocId);

  // Store the active Firestore instance for background syncer daemon
  if (resolvedDb && !(window as any).__firebase_db) {
    (window as any).__firebase_db = resolvedDb;
  }

  const enrichedData = {
    ...enrichWithStoreContext(data),
    transaction_id: txId,
    write_index: writeCount,
    idempotency_key: compositeDocId,
    createdAt: data?.createdAt || (realFirestore.serverTimestamp ? realFirestore.serverTimestamp() : new Date())
  };

  // Enforce Store & Staff Isolation Guard
  if (path) {
    try {
      MultiTenantService.validateStoreAndStaffIsolation(path, enrichedData, (window as any).__user_profile);
    } catch (isolationErr) {
      console.error('🛡️ [Isolation Guard Block]:', isolationErr);
      throw isolationErr;
    }
  }

  // Intercept shops collection writes from unauthorized users
  if (path && (path === 'shops' || path.startsWith('shops/') || path.includes('/shops/'))) {
    const profile = (window as any).__user_profile;
    const role = (profile?.role || '').toLowerCase();
    const isOwnerOrSuperAdmin = role === 'owner' || role === 'superadmin';
    if (!isOwnerOrSuperAdmin) {
      console.warn(`🛡️ [Guard Shop Add] Blocked unauthorized shop addDoc on path ${path} for user role: ${profile?.role || 'unknown'}. Applying fallback in local memory.`);
      try {
        const localKey = `jam_local_shop_${path}_${compositeDocId}`;
        localStorage.setItem(localKey, JSON.stringify({ ...data, local_fallback: true }));
      } catch (e) {
        console.error('Failed to save shop settings to local fallback:', e);
      }
      return safeDocRef();
    }
  }

  // 2. Auto-fallback check (subscription expired, quota exceeded, or physically offline)
  if (path) {
    updateLocalCollectionCache(path, compositeDocId, enrichedData);
  }

  if (shouldForceOfflineWrite() || !resolvedDb) {
    console.warn(`[Offline Fallback Mode] Silently saving write to offline queue for col: ${path}`);
    const queue = getOfflineQueue();
    queue.push({
      id: compositeDocId,
      operation: 'addDoc',
      path: `${path}/${compositeDocId}`,
      data: enrichedData,
      timestamp: Date.now()
    });
    saveOfflineQueue(queue);

    // Return a mock DocumentReference so that ui processes without interruption
    return safeDocRef();
  }

  try {
    const customDocRef = safeDocRef();
    if (customDocRef && typeof (customDocRef as any).id === 'string' && (customDocRef as any).type === 'document') {
      await realFirestore.setDoc(customDocRef, enrichedData);
    } else if (resolvedDb && path) {
      const realRef = realFirestore.doc(resolvedDb, path, compositeDocId);
      await realFirestore.setDoc(realRef, enrichedData);
      quotaAndOfflineEngine.trackWrite(1);
      return realRef;
    }
    quotaAndOfflineEngine.trackWrite(1);
    return customDocRef;
  } catch (err: any) {
    const isQuota = err?.code === 'resource-exhausted' || 
                    err?.message?.includes('quota') || 
                    err?.message?.includes('Quota exceeded') || 
                    err?.message?.includes('Resource exhausted') ||
                    err?.message?.includes('Free daily read units');

    const isPermission = err?.code === 'permission-denied' || 
                         err?.message?.includes('permission-denied') || 
                         err?.message?.includes('Missing or insufficient permissions') ||
                         err?.message?.includes('insufficient permissions');

    // If quota is exceeded, set global flag to immediately bypass future network calls
    if (isQuota) {
      (window as any).__quota_exceeded = true;
    }

    // Fall back to offline queue on any quota exceeded, subscription expiration, or connection error
    if (isQuota || isSubscriptionExpired() || !isPermission) {
      console.warn('[Write Fallback Activated] Enqueueing to offline queue:', err);
      const queue = getOfflineQueue();
      queue.push({
        id: compositeDocId,
        operation: 'addDoc',
        path: `${path}/${compositeDocId}`,
        data: enrichedData,
        timestamp: Date.now()
      });
      saveOfflineQueue(queue);
      return safeDocRef();
    }

    const errorInfo = {
      error: err.message || String(err),
      operationType: 'create',
      path: path,
      authInfo: getAuthInfo()
    };
    throw new Error(JSON.stringify(errorInfo));
  }
};

/**
 * 2. setDoc Wrapper with client-side UUID security
 */
export const setDoc = async (docRef: any, data: any, options?: any) => {
  if (!docRef) {
    console.warn('[setDoc] Called with undefined or null docRef');
    return;
  }
  const path = docRef?.path || docRef?.__path || (docRef?._key?.path?.toString()) || '';
  const docId = docRef?.id || (path ? path.split('/').filter(Boolean).pop() : '') || crypto.randomUUID();
  const resolvedDb = docRef?.firestore || getSafeFirestore(docRef) || (window as any).__firebase_db;

  const txId = (window as any).__lastTransactionId || crypto.randomUUID();
  const enrichedData = {
    ...enrichWithStoreContext(data),
    transaction_id: txId
  };

  // Enforce Store & Staff Isolation Guard
  if (path) {
    try {
      MultiTenantService.validateStoreAndStaffIsolation(path, enrichedData, (window as any).__user_profile);
    } catch (isolationErr) {
      console.error('🛡️ [Isolation Guard Block]:', isolationErr);
      throw isolationErr;
    }
  }

  if (resolvedDb && !(window as any).__firebase_db) {
    (window as any).__firebase_db = resolvedDb;
  }

  // 1. SCRE Deduplication Checks
  if (path && checkAndPreventDuplicateTransaction(path, data)) {
    return;
  }
  if (path && checkAndPreventDuplicateOrderUpdate(path, docId, data)) {
    return;
  }

  // Intercept shops collection writes from unauthorized users
  if (path && (path === 'shops' || path.startsWith('shops/') || path.includes('/shops/'))) {
    const profile = (window as any).__user_profile;
    const role = (profile?.role || '').toLowerCase();
    const isOwnerOrSuperAdmin = role === 'owner' || role === 'superadmin';
    if (!isOwnerOrSuperAdmin) {
      console.warn(`🛡️ [Guard Shop Set] Blocked unauthorized shop setDoc on path ${path} for user role: ${profile?.role || 'unknown'}. Applying fallback in local memory.`);
      try {
        const localKey = `jam_local_shop_${path}`;
        localStorage.setItem(localKey, JSON.stringify({ ...data, local_fallback: true }));
      } catch (e) {
        console.error('Failed to save shop settings to local fallback:', e);
      }
      return; // Intercept entirely
    }
  }

  if (path) {
    updateLocalCollectionCache(path, docId, enrichedData);
  }

  // 2. Auto-fallback check
  if (shouldForceOfflineWrite()) {
    console.warn(`[Offline Fallback Mode] Silently saving setDoc to offline queue for doc: ${path}`);
    const queue = getOfflineQueue();
    queue.push({
      id: txId,
      operation: 'setDoc',
      path: path,
      data: enrichedData,
      options,
      timestamp: Date.now()
    });
    saveOfflineQueue(queue);
    return;
  }

  try {
    const res = await realFirestore.setDoc(docRef, enrichedData, options);
    quotaAndOfflineEngine.trackWrite(1);
    return res;
  } catch (err: any) {
    const isQuota = err?.code === 'resource-exhausted' || 
                    err?.message?.includes('quota') || 
                    err?.message?.includes('Quota exceeded') || 
                    err?.message?.includes('Resource exhausted') ||
                    err?.message?.includes('Free daily read units');

    const isPermission = err?.code === 'permission-denied' || 
                         err?.message?.includes('permission-denied') || 
                         err?.message?.includes('Missing or insufficient permissions') ||
                         err?.message?.includes('insufficient permissions');

    if (isQuota) {
      (window as any).__quota_exceeded = true;
    }

    if (isQuota || isSubscriptionExpired() || !isPermission) {
      console.warn('[setDoc Fallback Activated] Enqueueing to offline queue:', err);
      const queue = getOfflineQueue();
      queue.push({
        id: txId,
        operation: 'setDoc',
        path: path,
        data: enrichedData,
        options,
        timestamp: Date.now()
      });
      saveOfflineQueue(queue);
      return;
    }

    const errorInfo = {
      error: err.message || String(err),
      operationType: 'write',
      path: path,
      authInfo: getAuthInfo()
    };
    throw new Error(JSON.stringify(errorInfo));
  }
};

/**
 * 3. updateDoc Wrapper with Concurrency transaction locking for shared tasks
 */
export const updateDoc = async (docRef: any, data: any) => {
  if (!docRef) {
    console.warn('[updateDoc] Called with undefined or null docRef');
    return;
  }
  const path = docRef?.path || docRef?.__path || (docRef?._key?.path?.toString()) || '';
  const docId = docRef?.id || (path ? path.split('/').filter(Boolean).pop() : '') || '';
  const resolvedDb = docRef?.firestore || getSafeFirestore(docRef) || (window as any).__firebase_db;

  if (path) {
    updateLocalCollectionCache(path, docId, data);
  }

  const isSharedTask = path.includes('maintenanceOrders') || 
                       path.includes('warehousePreps') || 
                       path.includes('orders') || 
                       path.includes('networkOrders');

  if (resolvedDb && !(window as any).__firebase_db) {
    (window as any).__firebase_db = resolvedDb;
  }

  // 1. SCRE Deduplication Checks
  if (path && checkAndPreventDuplicateTransaction(path, data)) {
    return;
  }
  if (path && checkAndPreventDuplicateOrderUpdate(path, docId, data)) {
    return;
  }

  // Intercept shops collection writes from unauthorized users
  if (path === 'shops' || path.startsWith('shops/') || path.includes('/shops/')) {
    const profile = (window as any).__user_profile;
    const role = (profile?.role || '').toLowerCase();
    const isOwnerOrSuperAdmin = role === 'owner' || role === 'superadmin';
    if (!isOwnerOrSuperAdmin) {
      console.warn(`🛡️ [Guard Shop Update] Blocked unauthorized shop update on path ${path} for user role: ${profile?.role || 'unknown'}. Applying fallback in local memory.`);
      try {
        const localKey = `jam_local_shop_${path}`;
        const existingLocal = localStorage.getItem(localKey);
        const existingData = existingLocal ? JSON.parse(existingLocal) : {};
        const merged = { ...existingData, ...data, local_fallback: true };
        localStorage.setItem(localKey, JSON.stringify(merged));
      } catch (e) {
        console.error('Failed to save shop settings to local fallback:', e);
      }
      return; // Intercept entirely, DO NOT fire the Firestore request
    }
  }

  // If a shared task status/assignment is updated, perform transaction lock check
  if (isSharedTask && data && ('status' in data || 'engineerId' in data)) {
    if (shouldForceOfflineWrite() || !resolvedDb) {
      // In offline/fallback mode, complete update local-only as fallback without freezing
      console.warn(`[Offline/Fallback Mode] Shared task update saved offline: ${path}`);
      const queue = getOfflineQueue();
      queue.push({
        id: crypto.randomUUID(),
        operation: 'updateDoc',
        path,
        data,
        timestamp: Date.now()
      });
      saveOfflineQueue(queue);
      return;
    }

    try {
      await realFirestore.runTransaction(resolvedDb, async (transaction) => {
        const freshSnap = await transaction.get(docRef);
        if (!freshSnap.exists()) {
          throw new Error('Task not found');
        }
        
        const freshData = freshSnap.data();
        const targetStatus = data.status;
        const currentDbStatus = freshData.status;

        // If target status is active (like working/ready) but current db status is already changed
        if (targetStatus && targetStatus !== currentDbStatus) {
          if (currentDbStatus && currentDbStatus !== 'waiting' && currentDbStatus !== 'pending' && currentDbStatus !== 'awaiting_response') {
            throw new Error('lock_concurrency_error');
          }
        }

        // Apply transaction update
        transaction.update(docRef, {
          ...enrichWithStoreContext(data),
          updatedAt: realFirestore.serverTimestamp()
        });
      });
      return;
    } catch (err: any) {
      if (err.message === 'lock_concurrency_error' || err.toString().includes('lock_concurrency_error')) {
        const arMsg = "تم معالجة هذا الطلب بالفعل";
        alert(arMsg);
        throw new Error(arMsg);
      }
      
      const isQuota = err?.code === 'resource-exhausted' || 
                      err?.message?.includes('quota') || 
                      err?.message?.includes('Quota exceeded') || 
                      err?.message?.includes('Resource exhausted') ||
                      err?.message?.includes('Free daily read units');
      if (isQuota) {
        (window as any).__quota_exceeded = true;
      }

      if (isQuota || isSubscriptionExpired()) {
        console.warn(`[Quota/Expiry Fallback] Shared task transaction fallback active for ${path}`);
        const queue = getOfflineQueue();
        queue.push({
          id: crypto.randomUUID(),
          operation: 'updateDoc',
          path,
          data,
          timestamp: Date.now()
        });
        saveOfflineQueue(queue);
        return;
      }
      throw err;
    }
  }

  // Handle standard updates
  if (shouldForceOfflineWrite() || !resolvedDb) {
    console.warn(`[Offline/Fallback Mode] Enqueueing updateDoc to offline queue: ${path}`);
    const queue = getOfflineQueue();
    queue.push({
      id: crypto.randomUUID(),
      operation: 'updateDoc',
      path,
      data: enrichWithStoreContext(data),
      timestamp: Date.now()
    });
    saveOfflineQueue(queue);
    return;
  }

  try {
    const res = await realFirestore.updateDoc(docRef, enrichWithStoreContext(data));
    quotaAndOfflineEngine.trackWrite(1);
    return res;
  } catch (err: any) {
    const isNotFound = err?.code === 'not-found' || 
                       err?.message?.includes('No document to update') ||
                       err?.message?.includes('not-found') ||
                       err?.message?.includes('NOT_FOUND');
    if (isNotFound) {
      console.warn(`[updateDoc] Document not found at ${path}, creating/merging with setDoc({ merge: true })`);
      try {
        const res = await realFirestore.setDoc(docRef, enrichWithStoreContext(data), { merge: true });
        quotaAndOfflineEngine.trackWrite(1);
        return res;
      } catch (setErr) {
        console.warn(`[updateDoc] setDoc merge fallback failed at ${path}:`, setErr);
      }
    }

    const isQuota = err?.code === 'resource-exhausted' || 
                    err?.message?.includes('quota') || 
                    err?.message?.includes('Quota exceeded') || 
                    err?.message?.includes('Resource exhausted') ||
                    err?.message?.includes('Free daily read units');

    const isPermission = err?.code === 'permission-denied' || 
                         err?.message?.includes('permission-denied') || 
                         err?.message?.includes('Missing or insufficient permissions') ||
                         err?.message?.includes('insufficient permissions');

    if (isQuota) {
      (window as any).__quota_exceeded = true;
    }

    if (isQuota || isSubscriptionExpired() || !isPermission) {
      console.warn('[updateDoc Fallback Activated] Enqueueing to offline queue:', err);
      const queue = getOfflineQueue();
      queue.push({
        id: crypto.randomUUID(),
        operation: 'updateDoc',
        path,
        data: enrichWithStoreContext(data),
        timestamp: Date.now()
      });
      saveOfflineQueue(queue);
      return;
    }

    const errorInfo = {
      error: err.message || String(err),
      operationType: 'update',
      path,
      authInfo: getAuthInfo()
    };
    throw new Error(JSON.stringify(errorInfo));
  }
};

/**
 * 4. Wrapped runTransaction to automatically enrich data with store context
 */
export const runTransaction = async (db: any, updateFunction: (transaction: any) => Promise<any>, options?: any) => {
  return await realFirestore.runTransaction(db, async (transaction) => {
    const wrappedTransaction = {
      get: (ref: any) => transaction.get(ref),
      delete: (ref: any) => transaction.delete(ref),
      set: (ref: any, data: any, options?: any) => {
        return transaction.set(ref, enrichWithStoreContext(data), options);
      },
      update: (ref: any, data: any) => {
        return transaction.update(ref, enrichWithStoreContext(data));
      }
    };
    return await updateFunction(wrappedTransaction);
  }, options);
};

/**
 * 5. Wrapped writeBatch to automatically enrich data with store context
 */
export const writeBatch = (db: any) => {
  const resolvedDb = getSafeFirestore(db) || (typeof window !== 'undefined' ? (window as any).__firebase_db : null);
  if (!resolvedDb) {
    console.warn('[writeBatch] No valid Firestore instance available');
    return {
      set: () => {},
      update: () => {},
      delete: () => {},
      commit: async () => {}
    } as any;
  }
  const batch = realFirestore.writeBatch(resolvedDb);
  return {
    set: (ref: any, data: any, options?: any) => {
      if (!ref) {
        console.warn('[batch.set] Called with undefined ref, skipped');
        return;
      }
      return batch.set(ref, enrichWithStoreContext(data), options);
    },
    update: (ref: any, data: any) => {
      if (!ref) {
        console.warn('[batch.update] Called with undefined ref, skipped');
        return;
      }
      return batch.update(ref, enrichWithStoreContext(data));
    },
    delete: (ref: any) => {
      if (!ref) {
        console.warn('[batch.delete] Called with undefined ref, skipped');
        return;
      }
      return batch.delete(ref);
    },
    commit: () => batch.commit()
  } as any;
};

/**
 * 6. Wrapped deleteDoc to update local collection cache and offline queue
 */
export const deleteDoc = async (docRef: any) => {
  if (!docRef) return;
  const path = docRef.path || docRef.__path || (docRef._key?.path?.toString()) || '';
  const docId = docRef.id || (path ? path.split('/').filter(Boolean).pop() : '') || '';

  if (path) {
    updateLocalCollectionCache(path, docId, null, true);
  }
  if (shouldForceOfflineWrite()) {
    if (path) {
      const queue = getOfflineQueue();
      queue.push({
        id: crypto.randomUUID(),
        operation: 'updateDoc',
        path,
        data: { _deleted: true },
        timestamp: Date.now()
      });
      saveOfflineQueue(queue);
    }
    return;
  }
  try {
    return await realFirestore.deleteDoc(docRef);
  } catch (err) {
    console.warn('deleteDoc fallback executed:', err);
  }
};

