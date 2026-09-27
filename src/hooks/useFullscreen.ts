import { useState, useEffect, useCallback } from 'react';

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFakeFullscreen, setIsFakeFullscreen] = useState(false);

  const checkFullscreen = useCallback(() => {
    const doc = document as any;
    const isFull = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
    setIsFullscreen(isFull);
    if (!isFull) {
      setIsFakeFullscreen(false);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    try {
      const doc = document as any;
      const docEl = document.documentElement as any;
      const isNativeFull = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (isNativeFull || isFakeFullscreen) {
        // Exit fullscreen
        if (isNativeFull) {
          const exitFS =
            doc.exitFullscreen ||
            doc.webkitExitFullscreen ||
            doc.mozCancelFullScreen ||
            doc.msExitFullscreen;
          if (exitFS) {
            try {
              const res = exitFS.call(doc);
              if (res && typeof res.catch === 'function') {
                res.catch((err: any) => {
                  console.warn("Fullscreen exit error:", err);
                });
              }
            } catch (err) {
              console.warn("Exit fullscreen call error:", err);
            }
          }
        }
        setIsFakeFullscreen(false);
      } else {
        // ALWAYS try native fullscreen first (browser monitor mode)
        const requestFS =
          docEl.requestFullscreen ||
          docEl.webkitRequestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.msRequestFullscreen;

        if (requestFS) {
          try {
            const promise = requestFS.call(docEl);
            if (promise && typeof promise.catch === 'function') {
              promise.catch((err: any) => {
                console.warn(
                  "Native fullscreen request blocked - falling back to instant fake fullscreen:",
                  err
                );
                setIsFakeFullscreen(true);
              });
            } else {
              // Verify if native fullscreen engaged
              setTimeout(() => {
                const isFull = !!(
                  doc.fullscreenElement ||
                  doc.webkitFullscreenElement ||
                  doc.mozFullScreenElement ||
                  doc.msFullscreenElement
                );
                if (!isFull) {
                  setIsFakeFullscreen(true);
                }
              }, 150);
            }
          } catch (err) {
            console.warn("requestFullscreen failed, using fake fallback:", err);
            setIsFakeFullscreen(true);
          }
        } else {
          setIsFakeFullscreen(true);
        }
      }
    } catch (e) {
      console.error("Custom fullscreen hook execution failed:", e);
      setIsFakeFullscreen((p) => !p);
    }
  }, [isFakeFullscreen]);

  const exitFullscreenForce = useCallback(() => {
    try {
      const doc = document as any;
      const exitFS =
        doc.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.msExitFullscreen;
      if (exitFS) {
        try {
          const res = exitFS.call(doc);
          if (res && typeof res.catch === 'function') {
            res.catch(() => {});
          }
        } catch (e) {}
      }
    } catch (e) {}
    setIsFakeFullscreen(false);
  }, []);

  useEffect(() => {
    const handleEvents = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];

    const handleErrorEvents = [
      'fullscreenerror',
      'webkitfullscreenerror',
      'mozfullscreenerror',
      'MSFullscreenError'
    ];

    const onFullscreenError = () => {
      console.warn("Native fullscreen error event - switching to fake fullscreen");
      setIsFakeFullscreen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFakeFullscreen(false);
      }
    };

    handleEvents.forEach((event) => {
      document.addEventListener(event, checkFullscreen);
    });

    handleErrorEvents.forEach((event) => {
      document.addEventListener(event, onFullscreenError);
    });

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      handleEvents.forEach((event) => {
        document.removeEventListener(event, checkFullscreen);
      });
      handleErrorEvents.forEach((event) => {
        document.removeEventListener(event, onFullscreenError);
      });
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [checkFullscreen]);

  return {
    isFullscreen: isFullscreen || isFakeFullscreen,
    isFakeFullscreen,
    toggleFullscreen,
    exitFullscreen: exitFullscreenForce
  };
}
