import React, { useState, useEffect } from 'react';
import { openDB } from 'idb';

// ==========================================
// 1. SMART IMAGE COMPRESSION (المعالج الذكي الموفر لمساحة التخزين)
// ==========================================
/**
 * compresses any local product or asset image directly in the browser using HTML5 Canvas.
 * It resizes the image to a maximum of 800x800px (retaining aspect ratio) at 80% quality (jpeg).
 */
export const compressProductImageFast = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 800; 
        let width = img.width;
        let height = img.height;

        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Highly optimized JPEG at 80% quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        console.log("⚡ [ImageOptimizer] Client-side image compressed to fit quota and save cloud hosting costs (800x800 max, 80% quality).");
        resolve(compressedBase64);
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

// ==========================================
// 2. GLOBAL OFFLINE IMAGE CACHING ENGINE (محرك التخزين المحلي الفوري)
// ==========================================
const IMAGE_DB_NAME = 'JAM_IMAGE_CACHE_DB';
const STORE_NAME = 'product-images';
const VERSION = 1;

interface ImageCacheEntry {
  url: string;
  blob: Blob;
  mimeType: string;
  timestamp: number;
}

const dbPromise = openDB(IMAGE_DB_NAME, VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'url' });
    }
  }
});

export const imageLocalStorageCache = {
  get: async (url: string): Promise<string | null> => {
    if (!url) return null;
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    try {
      const db = await dbPromise;
      const entry = await db.get(STORE_NAME, url) as ImageCacheEntry | undefined;
      if (entry && entry.blob) {
        return URL.createObjectURL(entry.blob);
      }
    } catch (e) {
      console.warn('⚠️ [OfflineCache] Failed to load from IndexedDB image cache:', e);
    }
    return null;
  },

  set: async (url: string, blob: Blob, mimeType: string): Promise<void> => {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;
    try {
      const db = await dbPromise;
      const entry: ImageCacheEntry = {
        url,
        blob,
        mimeType,
        timestamp: Date.now()
      };
      await db.put(STORE_NAME, entry);
      
      // Manage cache memory efficiently so browser limits are never exceeded (keep max 120 items)
      setTimeout(() => {
        imageLocalStorageCache.cleanupOldEntries();
      }, 5000);
    } catch (e) {
      console.warn('⚠️ [OfflineCache] Failed to save in IndexedDB image cache:', e);
    }
  },

  cleanupOldEntries: async () => {
    try {
      const db = await dbPromise;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const keys = await store.getAllKeys();
      if (keys.length > 120) {
        const allEntries = await store.getAll() as ImageCacheEntry[];
        allEntries.sort((a, b) => a.timestamp - b.timestamp);
        const toDeleteCount = allEntries.length - 100;
        for (let i = 0; i < toDeleteCount; i++) {
          await store.delete(allEntries[i].url);
        }
        console.log(`🧹 [OfflineCache] Pruned ${toDeleteCount} old cached images to keep IndexedDB light.`);
      }
    } catch (e) {
      console.warn('⚠️ [OfflineCache] Cache prune failed:', e);
    }
  }
};

// ==========================================
// 3. CACHED IMAGE COMPONENT (كرت عرض الصور الذكي المانع للتحميل المتكرر)
// ==========================================
interface JamFastProductImageProps {
  imageUrl: string;
  altName: string;
  className?: string;
  size?: number | string;
}

export const JamFastProductImage: React.FC<JamFastProductImageProps> = ({ 
  imageUrl, 
  altName, 
  className = '', 
  size 
}) => {
  const [loaded, setLoaded] = useState(false);
  const [displaySrc, setDisplaySrc] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (!imageUrl) {
      setDisplaySrc('');
      return;
    }

    const loadCachedOrFetch = async () => {
      // Step 1: Attempt to read from high-performance local IndexedDB Cache
      const cached = await imageLocalStorageCache.get(imageUrl);
      if (cached && active) {
        setDisplaySrc(cached);
        setLoaded(true);
        return;
      }

      // Step 2: Fallback to Cache API if matched
      try {
        if ('caches' in window) {
          const cache = await caches.open('jam-fast-product-images');
          const matched = await cache.match(imageUrl);
          if (matched && active) {
            const blob = await matched.blob();
            const localUrl = URL.createObjectURL(blob);
            setDisplaySrc(localUrl);
            setLoaded(true);
            await imageLocalStorageCache.set(imageUrl, blob, blob.type || 'image/jpeg');
            return;
          }
        }
      } catch (err) {
        console.warn('Cache API matching failed:', err);
      }

      // Step 3: Default to downloading the network image
      if (active) {
        setDisplaySrc(imageUrl);
      }

      if (imageUrl.startsWith('http')) {
        try {
          const res = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
          if (res.ok) {
            const resClone = res.clone();
            const blob = await res.blob();
            
            // Unify: Save in both stores
            await imageLocalStorageCache.set(imageUrl, blob, blob.type || 'image/jpeg');
            try {
              if ('caches' in window) {
                const cache = await caches.open('jam-fast-product-images');
                await cache.put(imageUrl, resClone);
              }
            } catch (err) {
              console.warn('Cache API caching error:', err);
            }

            const localUrl = URL.createObjectURL(blob);
            if (active) {
              setDisplaySrc(localUrl);
              setLoaded(true);
            }
          }
        } catch (err) {
          // Keep displaySrc on default url
        }
      }
    };

    loadCachedOrFetch();

    return () => {
      active = false;
    };
  }, [imageUrl]);

  const sizeStyle = size 
    ? (typeof size === 'number' ? { width: `${size}px`, height: `${size}px` } : { width: size, height: size })
    : {};

  return (
    <div 
      className={`overflow-hidden bg-black/40 border border-white/5 flex items-center justify-center shrink-0 ${className}`}
      style={{ ...sizeStyle, transition: 'all 0.2s' }}
    >
      {displaySrc ? (
        <img 
          src={displaySrc} 
          alt={altName}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0.4,
            transition: 'opacity 0.2s ease-in-out'
          }}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
      ) : (
        <span style={{ fontSize: size && typeof size === 'number' ? `${size * 0.35}px` : '16px' }}>📦</span>
      )}
    </div>
  );
};
