import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, ShieldCheck, Check } from 'lucide-react';
import { StoreQueueEngine } from '../services/StoreQueueEngine';
import { OfflineDiagnosticsPanel } from './OfflineDiagnosticsPanel';
import { EnterpriseAxesSuiteModal } from './EnterpriseAxesSuiteModal';
import { UserProfile } from '../types';

interface OfflineSyncStatusDockProps {
  profile: UserProfile | null;
  className?: string;
}

export const OfflineSyncStatusDock: React.FC<OfflineSyncStatusDockProps> = ({
  profile,
  className = ''
}) => {
  const storeId = profile?.ownerId || 'master';
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [showAxesSuite, setShowAxesSuite] = useState<boolean>(false);
  const [justSynced, setJustSynced] = useState<boolean>(false);

  const updateCounts = async () => {
    try {
      const summary = await StoreQueueEngine.getQueueSummary(storeId);
      setPendingCount(summary.pending);
      setFailedCount(summary.failed);
    } catch (e) {
      console.warn('Queue summary update notice:', e);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerAutoSync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleTriggerSync = () => {
      triggerAutoSync();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('app-trigger-sync', handleTriggerSync);

    updateCounts();
    const interval = setInterval(updateCounts, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('app-trigger-sync', handleTriggerSync);
      clearInterval(interval);
    };
  }, [storeId]);

  const triggerAutoSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await StoreQueueEngine.processSyncQueue(storeId);
      if (res.syncedCount > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      }
      await updateCounts();
    } catch (err) {
      console.warn('Auto sync trigger notice:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`} dir="rtl">
        {/* Status Indicator Badge */}
        <button
          id="header-offline-status-badge"
          onClick={() => setShowDiagnostics(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold shadow-sm transition-all duration-300 cursor-pointer ${
            !isOnline
              ? 'bg-amber-950/80 border-amber-500/40 text-amber-300 hover:bg-amber-900/90'
              : pendingCount > 0
              ? 'bg-sky-950/80 border-sky-500/40 text-sky-300 hover:bg-sky-900/90'
              : failedCount > 0
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-300 hover:bg-rose-900/90'
              : 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/80'
          }`}
          title="حالة الاتصال - انقر لفتح لوحة تشخيص الشبكة والمزامنة"
        >
          {!isOnline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span className="text-[10px]">أوفلاين (0ms)</span>
            </>
          ) : isSyncing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
              <span className="text-[10px]">مزامنة...</span>
            </>
          ) : justSynced ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px]">تمت المزامنة!</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] hidden sm:inline">متصل بالسحابة</span>
            </>
          )}

          {/* Pending items badge */}
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-slate-950 font-mono font-bold px-1.5 py-0 text-[9px] rounded-full animate-bounce">
              {pendingCount}
            </span>
          )}

          {/* Failed count badge */}
          {failedCount > 0 && pendingCount === 0 && (
            <span className="bg-rose-500 text-white font-mono font-bold px-1.5 py-0 text-[9px] rounded-full">
              !{failedCount}
            </span>
          )}

          <ShieldCheck className="w-3.5 h-3.5 text-slate-400 opacity-60 hover:opacity-100 shrink-0" />
        </button>
      </div>

      {/* Axis 7 Diagnostics Modal */}
      <OfflineDiagnosticsPanel
        profile={profile}
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
      />

      {/* Axis Enterprise Suite Modal */}
      <EnterpriseAxesSuiteModal
        profile={profile}
        isOpen={showAxesSuite}
        onClose={() => setShowAxesSuite(false)}
      />
    </>
  );
};
