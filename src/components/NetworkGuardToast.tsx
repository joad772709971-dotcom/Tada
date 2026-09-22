import React, { useState, useEffect } from 'react';
import { WifiOff, X, AlertTriangle } from 'lucide-react';
import { GuardBlockEventDetail } from '../services/networkGuardService';

export const NetworkGuardToast: React.FC = () => {
  const [activeAlert, setActiveAlert] = useState<GuardBlockEventDetail | null>(null);

  useEffect(() => {
    const handleBlock = (e: CustomEvent<GuardBlockEventDetail>) => {
      setActiveAlert(e.detail);
    };

    window.addEventListener('jam:network_guard_block' as any, handleBlock);
    return () => {
      window.removeEventListener('jam:network_guard_block' as any, handleBlock);
    };
  }, []);

  if (!activeAlert) return null;

  return (
    <div 
      id="network-guard-modal"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      dir="rtl"
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-300 dark:border-amber-600/40 p-6 overflow-hidden relative text-slate-800 dark:text-slate-100"
      >
        <button
          id="close-network-guard-btn"
          onClick={() => setActiveAlert(null)}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <WifiOff className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                ميزة تتطلب اتصالاً سحابياً
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {activeAlert.title}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {activeAlert.reason}
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <AlertTriangle className="w-4 h-4 text-emerald-500" />
            <span>المبيعات، الفواتير، والجرد تعمل أوفلاين كالمعتاد</span>
          </div>
          <button
            id="acknowledge-network-guard-btn"
            onClick={() => setActiveAlert(null)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-transform active:scale-95"
          >
            حسناً، فهمت
          </button>
        </div>
      </div>
    </div>
  );
};
