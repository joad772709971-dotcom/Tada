import React, { useState, useEffect } from 'react';
import { quotaAndOfflineEngine, QuotaStats } from '../services/quotaAndOfflineEngine';
import { yemenTimeService, YemenTimeStatus } from '../services/yemenTimeReconciliation';
import { db } from '../firebase';
import { Zap, Database, Users, HardDrive, RefreshCw, CheckCircle, Wifi, WifiOff, Activity, ChevronDown, ChevronUp, Clock, ShieldCheck, Store, Server, AlertTriangle } from 'lucide-react';

interface QuotaOperationsMonitorProps {
  isEmbeddedInSuperAdmin?: boolean;
  shops?: any[];
  users?: any[];
}

export const QuotaOperationsMonitor: React.FC<QuotaOperationsMonitorProps> = ({
  isEmbeddedInSuperAdmin = false,
  shops = [],
  users = []
}) => {
  const [quotaStats, setQuotaStats] = useState<QuotaStats>(() => quotaAndOfflineEngine.getStats());
  const [yemenTime, setYemenTime] = useState<YemenTimeStatus>(() => yemenTimeService.getStatus());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubQuota = quotaAndOfflineEngine.subscribe(setQuotaStats);
    const unsubTime = yemenTimeService.subscribe(setYemenTime);

    // Auto-sync trigger on daily quota reset or network recovery
    if (!quotaStats.isQuotaExhausted && quotaStats.pendingOfflineCount > 0) {
      quotaAndOfflineEngine.syncPendingQueue(db);
    }

    return () => {
      unsubQuota();
      unsubTime();
    };
  }, [quotaStats.isQuotaExhausted, quotaStats.pendingOfflineCount]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMsg('جاري المزامنة التلقائية مع السحابة...');
    try {
      const res = await quotaAndOfflineEngine.syncPendingQueue(db);
      setSyncMsg(`تمت المزامنة بنجاح لـ ${res.synced} عملية. المتبقي: ${res.remaining}`);
    } catch (err) {
      setSyncMsg('حفظ أوفلاين مؤمن: سيتم الاستكمال تلقائياً فور توفر الرصيد.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  };

  const readPercent = Math.min(100, Math.round((quotaStats.readsToday / quotaStats.maxDailyReads) * 100));
  const writePercent = Math.min(100, Math.round((quotaStats.writesToday / quotaStats.maxDailyWrites) * 100));

  // Compute shop breakdown
  const pendingQueue = quotaAndOfflineEngine.getQueue();

  // Render Full Embedded Panel for Developer / SuperAdmin Dashboard
  if (isEmbeddedInSuperAdmin) {
    return (
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 md:p-6 shadow-2xl text-slate-100 dir-rtl font-sans space-y-6">
        {/* Header Badge */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 shadow-inner">
              <Server className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-100">لوحة المبرمج - مراقبة حركة العمليات والمحاولات المجانية (Firebase Spark Quota)</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  الحساب الرئيسي الموحد
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>توقيت اليمن (صنعاء): <strong className="text-emerald-400">{yemenTime.yemenTimeString}</strong></span>
                <span>•</span>
                <span>تاريخ اليوم: <strong className="text-slate-300">{yemenTime.yemenDateString}</strong></span>
              </p>
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSyncing || quotaStats.pendingOfflineCount === 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>مزامنة العمليات المعلقة تلقائياً ({quotaStats.pendingOfflineCount})</span>
          </button>
        </div>

        {/* Informational Banner */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-emerald-400 block mb-0.5 font-bold">آلية عمل المحاولات والعمليات المجانية (Firebase Spark Tier):</strong>
            يتم تخصيص المحاولات المجانية (50,000 قراءة و 20,000 كتابة يومياً) لحساب مالك المشروع بالكامل. تستفيد جميع المحلات والمستخدمين المضافين من هذا الرصيد المشترك حسب الاستخدام الفعلي. وعند اكتمال المحاولات اليومية، يتحول النظام تلقائياً وبسلاسة إلى <strong>وضع الحفظ المحلي (Offline Storage)</strong> دون تصفير الشاشات أو تعطل المبيعات، ويتم المزامنة تلقائياً عند تجديد المحاولات في منتصف الليل بتوقيت اليمن.
          </div>
        </div>

        {/* Global Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>إجمالي العمليات اليومية</span>
            </div>
            <div className="text-xl font-black text-emerald-400">{quotaStats.totalOperationsToday.toLocaleString('ar-YE')}</div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span>العمليات المعلقة (أوفلاين)</span>
            </div>
            <div className={`text-xl font-black ${quotaStats.pendingOfflineCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
              {quotaStats.pendingOfflineCount.toLocaleString('ar-YE')}
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-cyan-400" />
              <span>إجمالي المحلات المجهزة</span>
            </div>
            <div className="text-xl font-black text-cyan-400">{shops.length || 1} محلات</div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>المستخدمون المسجلون</span>
            </div>
            <div className="text-xl font-black text-indigo-400">{users.length || 1} مستخدم</div>
          </div>
        </div>

        {/* Quota Usage Meter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">محاولات القراءة المجانية المتبقية اليوم</span>
              <span className="text-emerald-400 font-extrabold">{quotaStats.readsRemaining.toLocaleString('ar-YE')} / 50,000</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${readPercent}%` }} />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">تم استهلاك: {quotaStats.readsToday.toLocaleString('ar-YE')} قراءة ({readPercent}%)</div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">محاولات الكتابة والحفظ المتبقية اليوم</span>
              <span className="text-cyan-400 font-extrabold">{quotaStats.writesRemaining.toLocaleString('ar-YE')} / 20,000</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${writePercent}%` }} />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">تم استهلاك: {quotaStats.writesToday.toLocaleString('ar-YE')} كتابة ({writePercent}%)</div>
          </div>
        </div>

        {syncMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center">
            {syncMsg}
          </div>
        )}

        {/* Breakdown Per Store (كل محل على حدة) */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-400" />
            <span>جدول حركة واستخدام المحلات والأنشطة التجارية</span>
          </h4>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-xs text-right text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">اسم المحل / النشاط</th>
                  <th className="p-3">صاحب المحل</th>
                  <th className="p-3">الموظفون المرتبطون</th>
                  <th className="p-3">العمليات المعلقة (أوفلاين)</th>
                  <th className="p-3">حالة المزامنة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {shops.length > 0 ? (
                  shops.map((shop: any, idx: number) => {
                    const storeUsers = users.filter((u: any) => u.storeId === shop.id || u.ownerId === shop.id || u.email === shop.ownerEmail);
                    const shopPendingOps = pendingQueue.filter((op: any) => op.storeId === shop.id);

                    return (
                      <tr key={shop.id || idx} className="hover:bg-slate-900/50 transition">
                        <td className="p-3 font-bold text-slate-100 flex items-center gap-2">
                          <Store className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>{shop.name || shop.shopName || 'محل رئيسي'}</span>
                        </td>
                        <td className="p-3 text-slate-300">{shop.ownerName || shop.phone || '---'}</td>
                        <td className="p-3 font-medium text-indigo-300">{storeUsers.length} موظفين</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${shopPendingOps.length > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                            {shopPendingOps.length} معلقة
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>مظبوط وآمن تلقائياً</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="p-3 font-bold text-slate-100 flex items-center gap-2">
                      <Store className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>المتجر الرئيسي (Jam System Master)</span>
                    </td>
                    <td className="p-3 text-slate-300">المالك المباشر</td>
                    <td className="p-3 font-medium text-indigo-300">{users.length || 1} موظفين</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${quotaStats.pendingOfflineCount > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        {quotaStats.pendingOfflineCount} معلقة
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>مظبوط وآمن تلقائياً</span>
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Floating Monitor Control for SuperAdmin or developer quick widget
  return (
    <div className="fixed bottom-4 right-4 z-[9990] dir-rtl font-sans select-none max-w-md w-full px-2 sm:px-0">
      {/* Collapsed Pill Button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-slate-900/90 hover:bg-slate-900 border border-emerald-500/40 text-slate-100 shadow-xl rounded-full px-4 py-2.5 flex items-center justify-between gap-3 backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${quotaStats.isQuotaExhausted ? 'bg-amber-400 opacity-75' : 'bg-emerald-400 opacity-75'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${quotaStats.isQuotaExhausted ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            </span>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              حركة العمليات: {quotaStats.totalOperationsToday}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            {quotaStats.pendingOfflineCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                معلقات: {quotaStats.pendingOfflineCount}
              </span>
            )}
            <ChevronUp className="w-4 h-4 text-slate-400" />
          </div>
        </button>
      )}

      {/* Expanded Details Card */}
      {isExpanded && (
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-slate-100 backdrop-blur-lg relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Top Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">لوحة حركة العمليات والمحاولات المجانية</h4>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  توقيت اليمن: {yemenTime.yemenTimeString}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Grid Stats */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <div className="text-[10px] text-slate-400 mb-0.5">حركة العمليات اليومية</div>
              <div className="text-base font-black text-emerald-400">{quotaStats.totalOperationsToday.toLocaleString('ar-YE')}</div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <div className="text-[10px] text-slate-400 mb-0.5">العمليات المعلقة (أوفلاين)</div>
              <div className={`text-base font-black ${quotaStats.pendingOfflineCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                {quotaStats.pendingOfflineCount.toLocaleString('ar-YE')}
              </div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <div className="text-[10px] text-slate-400 mb-0.5">المستخدمون المسجلون</div>
              <div className="text-base font-black text-cyan-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>{users.length || 1}</span>
              </div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <div className="text-[10px] text-slate-400 mb-0.5">حالة الاتصال والبيانات</div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{quotaStats.isQuotaExhausted ? 'حفظ أوفلاين آمن' : 'تلقائي ومتصل'}</span>
              </div>
            </div>
          </div>

          {/* Progress Bars for Daily Quota */}
          <div className="space-y-2 mb-3 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-300">محاولات القراءة المجانية اليومية</span>
                <span className="text-emerald-400 font-bold">{quotaStats.readsRemaining.toLocaleString('ar-YE')} متبقية</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${readPercent}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-300">محاولات الكتابة والحفظ اليومية</span>
                <span className="text-cyan-400 font-bold">{quotaStats.writesRemaining.toLocaleString('ar-YE')} متبقية</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${writePercent}%` }} />
              </div>
            </div>
          </div>

          {syncMsg && (
            <div className="text-[11px] p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center mb-3">
              {syncMsg}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSync}
              disabled={isSyncing || quotaStats.pendingOfflineCount === 0}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>مزامنة تلقائية للأوفلاين ({quotaStats.pendingOfflineCount})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotaOperationsMonitor;

