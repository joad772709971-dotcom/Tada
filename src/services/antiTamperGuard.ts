/**
 * 🛡️ Anti-Tamper & Security Guard for JAM System Pro
 * Protects against inspection, reverse engineering, unauthorized hotkeys (F12, Ctrl+Shift+I),
 * and provides responsive viewport sizing enforcement.
 */

export function initAntiTamperGuard() {
  if (typeof window === 'undefined') return;

  const isProduction = import.meta.env.PROD;
  const isCapacitor = !!(window as any).Capacitor;
  const isElectron = !!(window as any).electronAPI || navigator.userAgent.toLowerCase().includes('electron');

  // Enforce protection primarily on Standalone targets (APK & Desktop EXE) and Production
  if (isProduction || isCapacitor || isElectron) {
    // 1. Prevent Right-Click Context Menu on Desktop & Mobile App
    if (isCapacitor || isElectron) {
      window.addEventListener('contextmenu', (e) => {
        // Allow right click only on text inputs and textareas
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        return false;
      }, { capture: true });
    }

    // 2. Disable DevTools and Source Viewing Shortcuts
    window.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, { capture: true });

    // 3. Clear sensitive console logs in release binaries
    if (isCapacitor || isElectron) {
      try {
        const noop = () => {};
        console.debug = noop;
        console.trace = noop;
      } catch {}
    }
  }

  // 4. Responsive Viewport Size Guard
  try {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    }
  } catch {}
}
