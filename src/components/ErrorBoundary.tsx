import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'حدث خطأ غير متوقع في النظام.';
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            isFirestoreError = true;
            errorMessage = `خطأ في قاعدة البيانات: ${parsed.error}`;
            if (parsed.error.includes('permission-denied')) {
              errorMessage = 'عذراً، ليس لديك الصلاحيات الكافية لإجراء هذه العملية أو الوصول لهذه البيانات.';
            }
          }
        }
      } catch (e) {
        // Not a JSON error message
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-smoke-white dark:bg-navy-900 p-4">
          <div className="card-glass p-8 max-w-md w-full text-center space-y-6 border-2 border-danger/20">
            <div className="w-20 h-20 bg-danger/10 text-danger rounded-3xl mx-auto flex items-center justify-center">
              <AlertTriangle size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-navy-900 dark:text-white">عذراً، حدث خطأ</h2>
              <p className="text-gray-500 dark:text-gray-400 font-bold">{errorMessage}</p>
            </div>
            <button
              onClick={() => {
                if (navigator.onLine) {
                  window.location.reload();
                } else {
                  console.warn("إعادة تحميل النظام معطلة أثناء انقطاع الاتصال بالإنترنت لتجنب حلقة التكرار اللانهائي.");
                }
              }}
              disabled={!navigator.onLine}
              className={`btn-primary w-full py-4 flex items-center justify-center gap-3 ${!navigator.onLine ? 'opacity-50 cursor-not-allowed bg-gray-400 dark:bg-gray-700' : ''}`}
            >
              <RefreshCw size={20} />
              إعادة تحميل النظام {!navigator.onLine && "(غير متاح أوفلاين)"}
            </button>
            {isFirestoreError && (
              <p className="text-[10px] text-gray-400">
                إذا استمرت المشكلة، يرجى التأكد من أنك مسجل دخول بحساب يمتلك الصلاحيات المطلوبة.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
