/**
 * Aggressive client-side image compression & global offline caching utility for JAM System Pro
 * Compresses an image file locally to an optimized size and quality before uploading, and
 * cache downloaded images locally for robust instant offline access without redundant downloads.
 */

export const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate the best dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D context from canvas'));
          return;
        }

        // Draw image on canvas
        ctx.fillStyle = '#FFFFFF'; // Background fallback for transparent PNGs
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // WebP compression fallback to JPEG
        let mimeType = 'image/jpeg';
        if (file.type === 'image/webp') {
          mimeType = 'image/webp';
        }

        try {
          const compressedDataUrl = canvas.toDataURL(mimeType, quality);
          console.log(`⚡ [Smart Image Compression] Compressed from ${(file.size / 1024).toFixed(1)}KB to ${(compressedDataUrl.length * 0.75 / 1024).toFixed(1)}KB`);
          resolve(compressedDataUrl);
        } catch (e) {
          try {
            const fallback = canvas.toDataURL('image/jpeg', quality);
            resolve(fallback);
          } catch (err: any) {
            reject(err);
          }
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// ========================================================
// GLOBAL OFFLINE IMAGE CACHING ENGINE
// ========================================================
export const imageCacheManager = {
  get: async (url: string): Promise<string | null> => {
    if (!url) return null;
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    try {
      if ('caches' in window) {
        const cache = await caches.open('jam-global-images-cache');
        const matched = await cache.match(url);
        if (matched) {
          const blob = await matched.blob();
          return URL.createObjectURL(blob);
        }
      }
    } catch (e) {
      console.warn('⚠️ Failure reading offline image cache:', e);
    }
    return null;
  },

  set: async (url: string, responseClone: Response): Promise<void> => {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;
    try {
      if ('caches' in window) {
        const cache = await caches.open('jam-global-images-cache');
        await cache.put(url, responseClone);
      }
    } catch (e) {
      console.warn('⚠️ Failure writing to offline image cache:', e);
    }
  },

  prefetch: async (url: string): Promise<string> => {
    if (!url || !url.startsWith('http')) return url;
    try {
      const cached = await imageCacheManager.get(url);
      if (cached) return cached;

      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (res.ok) {
        await imageCacheManager.set(url, res.clone());
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
    } catch (err) {
      // Return original URL on fallback
    }
    return url;
  }
};
