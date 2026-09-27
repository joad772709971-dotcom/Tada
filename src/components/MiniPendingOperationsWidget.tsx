import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, CheckCircle2, Clock, Zap, ChevronDown, ChevronUp, ShieldCheck, Activity, HardDrive, Smartphone, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { quotaAndOfflineEngine, QuotaStats, getDeviceId, getPlatformType } from '../services/quotaAndOfflineEngine';
import { db } from '../firebase';

interface MiniPendingOperationsWidgetProps {
  profile?: any;
}

export default function MiniPendingOperationsWidget({ profile }: MiniPendingOperationsWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'quota'>('pending');
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  const [quotaStats, setQuotaStats] = useState<QuotaStats>(() => quotaAndOfflineEngine.getStats());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const currentDeviceId = getDeviceId();
  const currentPlatform = getPlatformType();

  const storeId = profile?.storeId || profile?.shopId || profile?.id;
  const userId = profile?.id || profile?.uid;

  const refreshData = () => {
    try {
      // 🔒 Strict Multi-Tenant, User, and Device/Platform Isolation
      const isolatedQueue = quotaAndOfflineEngine.getIsolatedQueue(storeId, userId, currentDeviceId);
      setPendingQueue(isolatedQueue || []);
      setQuotaStats(quotaAndOfflineEngine.getStats());
    } catch {
      setPendingQueue([]);
    }
  };

  useEffect(() => {
    refreshData();
    const unsub = quotaAndOfflineEngine.subscribe(setQuotaStats);
    const interval = setInterval(refreshData, 3000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [storeId, userId, currentDeviceId]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('جاري المزامنة مع السحابة...');
    try {
      const res = await quotaAndOfflineEngine.syncPendingQueue(db);
      refreshData();
      setSyncStatusMsg(`تمت مزامنة ${res.synced} عملية بنجاح!`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch {
      setSyncStatusMsg('تم تأجيل المزامنة تلقائياً (الشبكة مشغولة)');
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const count = pendingQueue.length;
  const readPercent = Math.min(100, Math.round((quotaStats.readsToday / quotaStats.maxDailyReads) * 100));
  const writePercent = Math.min(100, Math.round((quotaStats.writesToday / quotaStats.maxDailyWrites) * 100));

  return (
    <div className="relative text-right dir-rtl font-sans" dir="rtl">
      {/* 🔘 Combined Bottom Pill Control */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => {
            if (isExpanded && activeTab === 'pending') {
              setIsExpanded(false);
            } else {
              setActiveTab('pending');
              setIsExpanded(true);
            }
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-md active:scale-95 ${
            count > 0
              ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-600/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
              : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/60 text-slate-300 hover:text-white'
          }`}
          title="عرض العمليات المعلقة الخاصة بهذا المحل والمستخدم والجهاز"
        >
          <div className="relative flex items-center justify-center">
            <Database size={15} className={count > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-black">
            <span>العمليات المعلقة:</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
              count > 0 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
            }`}>
              {count}
            </span>
          </div>
        </button>

        {/* 📊 Merged "حركة العمليات" Button */}
        <button
          onClick={() => {
            if (isExpanded && activeTab === 'quota') {
              setIsExpanded(false);
            } else {
              setActiveTab('quota');
              setIsExpanded(true);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-slate-900/90 hover:bg-slate-800 text-emerald-400 text-[11px] font-black transition-all cursor-pointer shadow-md active:scale-95"
          title="مراقبة حركة العمليات اليومية وسعة السحابة المجانية"
        >
          <Activity size={14} className="text-emerald-400 animate-pulse" />
          <span>حركة العمليات: {quotaStats.totalOperationsToday.toLocaleString('ar-YE')}</span>
          <ChevronUp size={13} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* 📦 Expanded Merged Drawer Popover */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-full mb-2 right-0 z-[150] w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border-2 border-emerald-500/40 rounded-2xl p-4 shadow-[0_15px_40px_rgba(0,0,0,0.6)] text-slate-200"
          >
            {/* Tab Navigation Controls */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                    activeTab === 'pending'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  العمليات المعلقة ({count})
                </button>
                <button
                  onClick={() => setActiveTab('quota')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                    activeTab === 'quota'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  حركة العمليات والسعة 📊
                </button>
              </div>

              <button
                onClick={() => setIsExpanded(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition text-[11px]"
              >
                ✕
              </button>
            </div>

            {/* Tab 1: Pending Operations (Strict Store + User + Device Isolated) */}
            {activeTab === 'pending' && (
              <div>
                {/* Strict Security Isolation Badge */}
                <div className="p-2 rounded-xl bg-slate-950/80 border border-emerald-500/30 mb-3 text-[10px] leading-relaxed text-slate-300 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                    <span className="font-bold text-emerald-300">عزل تام: العمليات خاصة بهذا الجهاز والمستخدم فقط</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400 font-mono text-[9px]">
                    {currentPlatform === 'desktop_exe' ? <Monitor size={12} className="text-sky-400" /> : <Smartphone size={12} className="text-purple-400" />}
                    <span>{currentPlatform === 'desktop_exe' ? 'كمبيوتر EXE' : 'تطبيق/جوال'}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 mb-3 text-[11px] leading-relaxed text-slate-300">
                  {count > 0 ? (
                    <div className="text-amber-300 font-bold flex items-center gap-1.5">
                      <Clock size={14} />
                      <span>يوجد {count} عمليات معلقة بانتظار المزامنة من هذا الجهاز.</span>
                    </div>
                  ) : (
                    <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>جميع عمليات هذا الجهاز ومستخدم المحل مكتملة ومزامنة 100%.</span>
                    </div>
                  )}
                </div>

                {count > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 mb-3 custom-scrollbar pr-1">
                    {pendingQueue.map((item, idx) => (
                      <div key={item.id || idx} className="p-2 rounded-lg bg-slate-950/60 border border-amber-500/20 text-[10px] flex items-center justify-between">
                        <span className="font-bold text-slate-300 truncate max-w-[180px]">
                          {item.type || 'عملية معلقة'} ({item.id?.substring(0, 8) || idx + 1})
                        </span>
                        <span className="text-[9px] text-amber-400 font-mono">
                          محاولة #{item.attempts || 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleManualSync}
                  disabled={isSyncing || count === 0}
                  className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-black rounded-xl text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة معلقة هذا الجهاز'}</span>
                </button>
              </div>
            )}

            {/* Tab 2: Operations Activity & Spark Quota Breakdown */}
            {activeTab === 'quota' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 mb-0.5">حركة العمليات اليومية</div>
                    <div className="text-base font-black text-emerald-400">{quotaStats.totalOperationsToday.toLocaleString('ar-YE')}</div>
                  </div>
                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 mb-0.5">عمليات هذا الجهاز المعلقة</div>
                    <div className="text-base font-black text-amber-400">{count}</div>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-300 font-bold">القراءة السحابية المجانية المتبقية</span>
                      <span className="text-emerald-400 font-mono font-bold">{quotaStats.readsRemaining.toLocaleString('ar-YE')} / 50k</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${readPercent}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-300 font-bold">الكتابة والحفظ المتبقية</span>
                      <span className="text-cyan-400 font-mono font-bold">{quotaStats.writesRemaining.toLocaleString('ar-YE')} / 20k</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${writePercent}%` }} />
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300 flex items-center gap-1.5">
                  <Zap size={12} className="animate-pulse shrink-0" />
                  <span>تجديد الرصيد المجاني يتم تلقائياً بمنتصف الليل بتوقيت اليمن.</span>
                </div>
              </div>
            )}

            {syncStatusMsg && (
              <div className="mt-2 text-center text-[10px] font-black text-amber-300 bg-amber-950/60 p-1.5 rounded-lg border border-amber-500/30">
                {syncStatusMsg}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
