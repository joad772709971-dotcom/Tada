/**
 * ⚡ instantCacheService.ts
 * ----------------------------------------------------
 * خدمة الاستجابة الفورية والتحميل غير المتزامن (Instant Cache & Asynchronous Data Loading)
 * 
 * الميزات:
 * 1. فتح فوري لجميع الأقسام (0ms delay) بقراءة الذاكرة المؤقتة (Local Memory & Storage Cache).
 * 2. جلب البيانات غير المتزامن من Firestore في الخلفية دون تجميد أو تعليق واجهة المستخدم.
 * 3. المزامنة التلقائية مع تحديث الواجهة فور وصول البيانات الأحدث من السيرفر.
 */

import { 
  onSnapshot, 
  getDocsFromCache, 
  Query, 
  DocumentReference, 
  DocumentSnapshot, 
  QuerySnapshot 
} from 'firebase/firestore';

const memoryStore = new Map<string, { data: any; timestamp: number }>();

export class InstantCacheService {
  /**
   * قراءة فورية للبيانات من الذاكرة المؤقتة (Memory Cache -> LocalStorage)
   */
  public static get<T>(key: string): T | null {
    // 1. In-memory check (fastest, 0ms)
    const mem = memoryStore.get(key);
    if (mem) {
      return mem.data as T;
    }

    // 2. LocalStorage fallback
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = localStorage.getItem(`jam_cache_${key}`);
        if (item) {
          const parsed = JSON.parse(item);
          memoryStore.set(key, { data: parsed, timestamp: Date.now() });
          return parsed as T;
        }
      }
    } catch (e) {
      // Ignored safely
    }

    return null;
  }

  /**
   * حفظ فوري في الذاكرة المؤقتة والتخزين المحلي
   */
  public static set<T>(key: string, data: T): void {
    memoryStore.set(key, { data, timestamp: Date.now() });
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Run in microtask or timeout to prevent main thread blocking
        setTimeout(() => {
          try {
            localStorage.setItem(`jam_cache_${key}`, JSON.stringify(data));
          } catch (e) {
            // LocalStorage might be full, safe ignore
          }
        }, 0);
      }
    } catch (e) {}
  }

  /**
   * حذف مفتاح محدد من الذاكرة المؤقتة والتخزين المحلي
   */
  public static remove(key: string): void {
    memoryStore.delete(key);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(`jam_cache_${key}`);
      }
    } catch (e) {}
  }

  /**
   * مسح وتطهير كافة البيانات المخزنة مؤقتاً للتأكد من المزامنة الفريش
   */
  public static clearAll(): void {
    memoryStore.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.startsWith('jam_cache_')) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch (e) {}
  }

  /**
   * ربط استعلام Firestore مع الاستجابة الفورية
   * يعيد إلغاء الاشتراك (Unsubscribe)
   */
  public static subscribeQuery<T>(
    cacheKey: string,
    firestoreQuery: Query,
    onData: (data: T[], fromCache: boolean) => void,
    onError?: (err: any) => void
  ): () => void {
    // 1. Synchronous Instant Hydration from Memory/LocalStorage (0ms)
    const cached = this.get<T[]>(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      onData(cached, true);
    }

    // 2. Fast background attempt from Firestore's persistent local cache
    getDocsFromCache(firestoreQuery)
      .then((cacheSnap: QuerySnapshot) => {
        if (!cacheSnap.empty) {
          const items = cacheSnap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as T[];
          this.set(cacheKey, items);
          onData(items, true);
        }
      })
      .catch(() => {
        // Fallback silently if not in firestore local cache yet
      });

    // 3. Real-time background asynchronous listener
    const unsubscribe = onSnapshot(
      firestoreQuery,
      (snapshot: QuerySnapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as T[];
        this.set(cacheKey, items);
        onData(items, false);
      },
      (error) => {
        console.warn(`InstantCache query error for [${cacheKey}]:`, error?.message || error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  }

  /**
   * ربط مستند Firestore فردي مع الاستجابة الفورية
   */
  public static subscribeDoc<T>(
    cacheKey: string,
    docRef: DocumentReference,
    onData: (data: T | null, fromCache: boolean) => void,
    onError?: (err: any) => void
  ): () => void {
    // 1. Instant Synchronous Cache
    const cached = this.get<T>(cacheKey);
    if (cached) {
      onData(cached, true);
    }

    // 2. Real-time background listener
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          const item = { id: snapshot.id, ...snapshot.data() } as unknown as T;
          this.set(cacheKey, item);
          onData(item, false);
        } else {
          onData(null, false);
        }
      },
      (error) => {
        console.warn(`InstantCache doc error for [${cacheKey}]:`, error?.message || error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  }
}
