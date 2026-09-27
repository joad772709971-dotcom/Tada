import React, { useState, useEffect } from 'react';
import { imageCacheManager } from '../utils/imageCompressor';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  aspect?: 'square' | 'video' | 'auto' | '4/3';
}

export const CachedImage: React.FC<CachedImageProps> = ({
  src,
  alt,
  aspect = 'square',
  className = '',
  style,
  ...props
}) => {
  const [displaySrc, setDisplaySrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!src) {
      setDisplaySrc('');
      setIsLoading(false);
      return;
    }

    const loadCached = async () => {
      // 1. Try reading from central offline cache
      const cached = await imageCacheManager.get(src);
      if (cached) {
        if (isMounted) {
          setDisplaySrc(cached);
          setIsLoading(false);
        }
        return;
      }

      // 2. Fallback to direct url while caching in parallel
      if (isMounted) {
        setDisplaySrc(src);
      }

      if (src.startsWith('http')) {
        try {
          const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
          if (res.ok) {
            await imageCacheManager.set(src, res.clone());
            const blob = await res.blob();
            const localUrl = URL.createObjectURL(blob);
            if (isMounted) {
              setDisplaySrc(localUrl);
              setIsLoading(false);
            }
          }
        } catch (e) {
          // CORS/Offline - keep live src safely
          if (isMounted) {
            setIsLoading(false);
          }
        }
      } else {
        setIsLoading(false);
      }
    };

    loadCached();

    return () => {
      isMounted = false;
    };
  }, [src]);

  // Aspect ratio styling mapping
  const aspectClass = 
    aspect === 'square' ? 'aspect-square' :
    aspect === 'video' ? 'aspect-video' :
    aspect === '4/3' ? 'aspect-[4/3]' : '';

  return (
    <div className={`overflow-hidden relative flex items-center justify-center bg-navy-950/20 dark:bg-white/5 border border-white/5 rounded-2xl ${aspectClass} ${className}`} style={style}>
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          onLoad={() => setIsLoading(false)}
          className="w-full h-full object-cover transition-all duration-300"
          style={{ opacity: isLoading ? 0.4 : 1 }}
          referrerPolicy="no-referrer"
          {...props}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-500 text-xs p-2">
          <span>📦</span>
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
