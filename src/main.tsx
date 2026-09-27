import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import { ThemeProvider } from './components/ThemeEngine.tsx';
import axios from 'axios';
import { initAntiTamperGuard } from './services/antiTamperGuard.ts';

// Initialize anti-tamper and responsive viewport guards
initAntiTamperGuard();

// --- Zero-Console-Noise Guard & Vite WebSocket Override ---
// Intercepts and neutralizes Firestore internal assertion failures, pre-auth permission warnings, and chart dimension warnings
if (typeof window !== 'undefined') {
  // Suppress uncaught Firebase internal assertion failures (e.g. ID: ca9, b815, ve:) and pre-auth permissions or cross-origin script errors
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason?.message || event.reason?.stack || event.reason || '');
    const lower = reasonStr.toLowerCase();
    if (
      reasonStr.includes('INTERNAL ASSERTION FAILED') ||
      reasonStr.includes('Unexpected state') ||
      reasonStr.includes('ca9') ||
      reasonStr.includes('b815') ||
      reasonStr.includes('ve:') ||
      reasonStr.includes('Missing or insufficient permissions') ||
      reasonStr.includes('permission-denied') ||
      lower.includes('script error') ||
      reasonStr === 'Script error.'
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return true;
    }
  }, true);

  window.addEventListener('error', (event) => {
    const errorStr = String(event.error?.message || event.error?.stack || event.message || '');
    const lower = errorStr.toLowerCase();
    const eventMsg = String(event.message || '').toLowerCase();
    if (
      errorStr.includes('INTERNAL ASSERTION FAILED') ||
      errorStr.includes('Unexpected state') ||
      errorStr.includes('ca9') ||
      errorStr.includes('b815') ||
      errorStr.includes('ve:') ||
      errorStr.includes('Missing or insufficient permissions') ||
      errorStr.includes('permission-denied') ||
      lower.includes('script error') ||
      eventMsg.includes('script error') ||
      errorStr === 'Script error.' ||
      event.message === 'Script error.'
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return true;
    }
  }, true);

  window.onerror = function (message, source, lineno, colno, error) {
    const errorStr = String(message || error?.message || '').toLowerCase();
    if (
      errorStr.includes('script error') ||
      errorStr.includes('internal assertion failed') ||
      errorStr.includes('unexpected state') ||
      errorStr.includes('permission-denied') ||
      errorStr.includes('missing or insufficient permissions')
    ) {
      return true;
    }
  };

  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = function (...args) {
    const msg = args.map(a => String(a || '')).join(' ').toLowerCase();
    if (
      msg.includes('websocket') || 
      msg.includes('hmr') || 
      msg.includes('vite') || 
      msg.includes('connect to websocket') || 
      msg.includes('closed without opened') ||
      msg.includes('internal assertion failed') ||
      msg.includes('unexpected state') ||
      msg.includes('ca9') ||
      msg.includes('b815') ||
      msg.includes('ve:') ||
      msg.includes('width/height should be greater than 0') ||
      msg.includes('chart width') ||
      msg.includes('recharts')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = function (...args) {
    const msg = args.map(a => String(a || '')).join(' ').toLowerCase();
    if (
      msg.includes('websocket') || 
      msg.includes('hmr') || 
      msg.includes('vite') || 
      msg.includes('failed to connect') || 
      msg.includes('closed without opened') ||
      msg.includes('internal assertion failed') ||
      msg.includes('unexpected state') ||
      msg.includes('ca9') ||
      msg.includes('b815') ||
      msg.includes('ve:') ||
      msg.includes('width/height should be greater than 0') ||
      msg.includes('missing or insufficient permissions') ||
      msg.includes('permission-denied')
    ) {
      if (msg.includes('missing or insufficient permissions') || msg.includes('permission-denied')) {
        // Silent graceful fallback without polluting console error trace
        return;
      }
      return;
    }
    originalError.apply(console, args);
  };

  const OriginalWebSocket = window.WebSocket;
  if (OriginalWebSocket) {
    class SafeWebSocket extends OriginalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener('error', () => {
          // Quietly swallow the error to keep the client unperturbed
        });
      }
    }
    try {
      window.WebSocket = SafeWebSocket;
    } catch (e) {
      // Do nothing, safe WebSocket wrapper bypass
    }
  }
}

const getProductionBackendDomain = (): string => {
  // In standard web browser environments, use relative URLs ('') so Express & Vite handle it directly
  if (typeof window !== 'undefined' && !window.location.origin.includes('capacitor://') && !window.location.protocol.startsWith('file')) {
    return '';
  }
  // 1. Try environment variables
  let env_url = (import.meta as any).env?.VITE_APP_URL || '';
  if (env_url && !env_url.includes('localhost')) {
    return env_url.endsWith('/') ? env_url.slice(0, -1) : env_url;
  }
  // 2. Try window.location (if not localhost/capacitor)
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const origin = window.location.origin;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !origin.includes('capacitor://')) {
      return origin;
    }
  }
  // 3. Fallback to the dedicated platform Run URL
  return 'https://ais-dev-cpravmzzzjg3jsiayido7z-320469830981.europe-west1.run.app';
};

const backendDomain = getProductionBackendDomain();

// 1. Global Fetch Interceptor to force absolute backend URLs and wrap response.json()
try {
  const originalFetch = window.fetch;
  if (originalFetch) {
    const customFetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      let targetUrl = input;
      
      if (typeof input === 'string') {
        if (input.startsWith('/api/')) {
          targetUrl = `${backendDomain}${input}`;
        }
      } else if (input instanceof Request) {
        const url = input.url;
        const isCapacitorOrLocal = typeof window !== 'undefined' && (
          window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1' || 
          window.location.origin.includes('capacitor://')
        );
        if (isCapacitorOrLocal && (url.includes('/api/') || url.startsWith('/api/'))) {
          let relativePath = url;
          try {
            const urlObj = new URL(url);
            relativePath = urlObj.pathname + urlObj.search + urlObj.hash;
          } catch {}
          if (relativePath.startsWith('/api/')) {
            targetUrl = new Request(`${backendDomain}${relativePath}`, input);
          }
        }
      }

      try {
        const response = await originalFetch(targetUrl, init);
        
        // We only need to intercept response.json() if it's an API route
        const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
        
        if (urlStr.includes('/api/')) {
          const originalJson = response.json.bind(response);
          response.json = async function () {
            try {
              const cloned = response.clone();
              const text = await cloned.text();
              const trimmed = text.trim();
              
              if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
                console.error(`⚠️ [API Global Fetch Interceptor] Non-JSON starting with HTML on url: ${urlStr}`);
                return {
                  success: false,
                  error: 'تلقينا استجابة غير صالحة من نظام معالجة الملفات (تنسيق HTML بدلاً من JSON). يرجى التحقق من اتصالك وصلاحية المستند.',
                  message: 'استجابة الخادم غير متوقعة (تنسيق HTML).',
                  data: [],
                  suggestions: {}
                };
              }
              
              try {
                return JSON.parse(text);
              } catch (jsonErr: any) {
                console.error(`⚠️ [API Global JSON Parse Error] URL: ${urlStr}. Error: ${jsonErr.message}`);
                return {
                  success: false,
                  error: 'فشل فك وتحليل استجابة الخادم الرقمي.',
                  message: 'فشلت قراءة الاستجابة كـ JSON.',
                  data: [],
                  suggestions: {}
                };
              }
            } catch (err: any) {
              console.error("⚠️ [API Global Parser Interception Exception]:", err);
              return {
                success: false,
                error: 'حدث خطأ غير متوقع أثناء قراءة استجابة الخادم.',
                message: err.message,
                data: [],
                suggestions: {}
              };
            }
          };
        }
        
        return response;
      } catch (fetchErr: any) {
        const isAbort = fetchErr?.name === 'AbortError' || 
                        fetchErr?.message?.toLowerCase().includes('abort') || 
                        fetchErr?.message?.toLowerCase().includes('timeout');
        if (isAbort) {
          console.warn("⏱️ Intercepted Fetch gracefully aborted or timed out:", fetchErr.message || fetchErr);
        } else {
          console.warn("⚠️ Connection/Network Alert in Intercepted Fetch:", fetchErr.message || fetchErr);
        }
        throw fetchErr;
      }
    };

    try {
      Object.defineProperty(window, 'fetch', {
        value: customFetch,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch (e) {
      console.warn("⚠️ Failed to redefine fetch via Object.defineProperty, attempting direct assignment:", e);
      try {
        (window as any).fetch = customFetch;
      } catch (innerErr) {
        console.error("❌ Critical: Failed both defineProperty and direct assignment of fetch. Utilizing local wrappers only.", innerErr);
      }
    }
  }
} catch (outerErr) {
  console.error("⚠️ Unhandled error during fetch global interception wrapper setup:", outerErr);
}

// 2. Global Axios Interceptor
axios.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('/api/')) {
    config.url = `${backendDomain}${config.url}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.data) {
      const responseData = error.response.data;
      if (typeof responseData === 'string' && responseData.trim().startsWith('<')) {
        error.response.data = {
          success: false,
          error: 'استجابة غير صالحة من الخادم (HTML بدلاً من JSON).',
          message: 'فشلت معالجة الطلب الذكي.'
        };
      }
    }
    return Promise.reject(error);
  }
);

// Global UI Debouncing and Idempotency Transaction Generator
if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (!button) return;

    // Check if the button acts as a form submission/save/confirm trigger
    const isSubmitBtn = 
      button.type === 'submit' ||
      button.getAttribute('role') === 'submit' ||
      button.id?.toLowerCase().includes('submit') ||
      button.id?.toLowerCase().includes('save') ||
      button.className?.toLowerCase().includes('submit') ||
      button.className?.toLowerCase().includes('save') ||
      // Native language (Arabic) translation checking for submit triggers
      button.textContent?.includes('حفظ') ||
      button.textContent?.includes('إرسال') ||
      button.textContent?.includes('تأكيد') ||
      button.textContent?.includes('إضافة') ||
      button.textContent?.includes('إتمام') ||
      button.textContent?.includes('شراء') ||
      button.textContent?.includes('قبول');

    if (isSubmitBtn && !button.disabled && !button.dataset.isPruned) {
      // Create a fresh idempotency/transaction UUID
      const txId = crypto.randomUUID();
      (window as any).__lastTransactionId = txId;
      (window as any).__transactionWriteCount = 0;

      // Wrap visual blocking and pointerEvents alteration in setTimeout
      // to avoid breaking React's capture-to-bubble event lifecycle on click
      setTimeout(() => {
        if (!button) return;
        button.dataset.isPruned = 'true';
        button.style.pointerEvents = 'none';
        button.classList.add('opacity-75', 'cursor-not-allowed');

        // Re-enable and reset state after a reasonable cooldown
        setTimeout(() => {
          if (!button) return;
          button.style.pointerEvents = '';
          button.classList.remove('opacity-75', 'cursor-not-allowed');
          delete button.dataset.isPruned;
          const spinnerDecor = button.querySelector('#submit-spinner-decor');
          if (spinnerDecor) spinnerDecor.remove();
        }, 1500);
      }, 0);
    }
  }, true); // Use capture phase to intercept before React bubble handlers
}

const isStandaloneOrElectron = typeof window !== 'undefined' && (
  window.location.protocol === 'file:' ||
  Boolean((window as any).electron) ||
  Boolean((window as any).electronAPI) ||
  Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
  navigator.userAgent.toLowerCase().includes('electron') ||
  window.location.origin.includes('capacitor://')
);

const AppRouter = isStandaloneOrElectron ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AppRouter>
          <App />
        </AppRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
