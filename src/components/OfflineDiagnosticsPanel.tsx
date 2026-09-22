import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Database, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Cpu, 
  HardDrive, 
  Hash, 
  Calculator, 
  Clock, 
  X 
} from 'lucide-react';
import { StoreQueueEngine, QueueTaskPayload } from '../services/StoreQueueEngine';
import { OfflineAuthService, TimeProtectionService } from '../services/OfflineCore';
import { UserProfile } from '../types';

interface OfflineDiagnosticsPanelProps {
  profile: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineDiagnosticsPanel: React.FC<OfflineDiagnosticsPanelProps> = ({
  profile,
  isOpen,
  onClose
}) => {
  const storeId = profile?.ownerId || 'master';
  const [report, setReport] = useState<any>(null);
  const [queueTasks, setQueueTasks] = useState<QueueTaskPayload[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<QueueTaskPayload | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'math_guard' | 'storage'>('overview');

  const refreshDiagnostics = async () => {
    setIsLoading(true);
    try {
      const rep = await StoreQueueEngine.getDiagnosticReport(storeId);
      const tasks = await StoreQueueEngine.getStoreQueue(storeId);
      setReport(rep);
      setQueueTasks(tasks);
    } catch (e) {
      console.error('Failed to load diagnostics:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshDiagnostics();
    }
  }, [isOpen, storeId]);

  if (!isOpen) return null;

  const handleRetryFailed = async () => {
    await StoreQueueEngine.retryFailedTasks(storeId);
    await refreshDiagnostics();
  };

  const handleClearCompleted = async () => {
    await StoreQueueEngine.clearCompletedTasks(storeId);
    await refreshDiagnostics();
  };

  const handleDeleteTask = async (taskId: string) => {
    await StoreQueueEngine.removeTask(storeId, taskId);
    if (selectedTask?.id === taskId) setSelectedTask(null);
    await refreshDiagnostics();
  };

  const handleManualSync = async () => {
    setIsLoading(true);
    try {
      await StoreQueueEngine.processSyncQueue(storeId);
      await refreshDiagnostics();
    } finally {
      setIsLoading(false);
    }
  };

  const timeDrift = TimeProtectionService.getTimeDriftInfo();
  const offlineAuthState = OfflineAuthService.getOfflineAuthState();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-right" dir="rtl">
      <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                لوحة التفتيش الذاتي والتشخيص أوفلاين
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  المحور 7
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                فحص محلي 0ms لتشخيص الذاكرة، طابور الحركات، حماية Math Guard والنزاعات
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-5 gap-2 pt-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            نظرة عامة والتشخيص
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'queue'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            طابور الحركات ({queueTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('math_guard')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'math_guard'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-4 h-4" />
            تدقيق Math Guard
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'storage'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            فحص الذاكرة والرمز
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-xs mb-1 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    الحالة الحالية
                  </div>
                  <div className="text-lg font-bold text-white flex items-center gap-2">
                    {report?.isOnline ? (
                      <span className="text-emerald-400 flex items-center gap-1 text-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> متصل أونلاين
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1 text-sm">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" /> وضع الأوفلاين 0ms
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-xs mb-1 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-sky-400" />
                    حركات بالطابور
                  </div>
                  <div className="text-xl font-bold text-sky-400">
                    {report?.pendingCount || 0} <span className="text-xs text-slate-400">معلقة</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-xs mb-1 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-purple-400" />
                    تصحيحات Math Guard
                  </div>
                  <div className="text-xl font-bold text-purple-400">
                    {report?.mathGuardViolations || 0} <span className="text-xs text-slate-400">حركة</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-xs mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    حماية التوقيت
                  </div>
                  <div className="text-sm font-bold text-emerald-400">
                    {timeDrift.isAcceptable ? 'محمي 100%' : 'تنبيه انحراف'}
                  </div>
                </div>
              </div>

              {/* Offline Auth & Store Stamping Integrity */}
              <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  حماية الجلسة وتختيم الفرع (Store Context Stamp)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block mb-1">المستخدم الحالي المستهدف:</span>
                    <span className="font-mono text-emerald-300 font-medium">
                      {offlineAuthState.activeUserId || profile?.uid || 'غير محدد'}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block mb-1">معرف المتجر والفرع المعزول:</span>
                    <span className="font-mono text-emerald-300 font-medium">
                      {report?.storeId || storeId}
                    </span>
                  </div>
                </div>
              </div>

              {/* Diagnostic Log Summary */}
              <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-sky-400 flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    تقرير الفحص الأخير ({report?.lastAuditTime})
                  </h4>
                  <button 
                    onClick={refreshDiagnostics} 
                    disabled={isLoading}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    إعادة الفحص
                  </button>
                </div>

                <div className="text-xs text-slate-300 space-y-2">
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">إجمالي الحركات في السجل:</span>
                    <span className="font-mono text-white">{report?.totalTasks || 0}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">حركات بانتظار المزامنة أونلاين:</span>
                    <span className="font-mono text-amber-400">{report?.pendingCount || 0}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">حجم ذاكرة الطابور المحلي (Storage):</span>
                    <span className="font-mono text-sky-400">{((report?.storageUsageBytes || 0) / 1024).toFixed(2)} KB</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">بصمات التكرار الفريدة (Payload Hashes):</span>
                    <span className="font-mono text-emerald-400">{report?.uniqueHashes || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">
                  تحكم طابور الحركات لفرع [{storeId}]
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSync}
                    disabled={isLoading || !report?.isOnline}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    مزامنة فورية الآن
                  </button>
                  <button
                    onClick={handleRetryFailed}
                    className="text-xs bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    إعادة محاولة الفاشلة
                  </button>
                  <button
                    onClick={handleClearCompleted}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    تنظيف المكتمل
                  </button>
                </div>
              </div>

              {queueTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/60">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-2" />
                  لا توجد حركات معلقة بالطابور المحلي. النظام مزامن 100%!
                </div>
              ) : (
                <div className="space-y-2">
                  {queueTasks.map(task => (
                    <div 
                      key={task.id}
                      className={`p-3.5 rounded-xl border transition text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        task.status === 'failed'
                          ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                          : task.status === 'synced'
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : 'bg-slate-950/70 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{task.actionType}</span>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {task.collectionName}
                          </span>
                          {task.data?.mathGuardCorrected && (
                            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">
                              Math Guard Corrected
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ID: {task.id} | Hash: {task.payloadHash.substring(0, 18)}...
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                          task.status === 'synced' ? 'bg-emerald-500/20 text-emerald-400' :
                          task.status === 'failed' ? 'bg-rose-500/20 text-rose-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {task.status}
                        </span>
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="text-slate-400 hover:text-sky-300 bg-slate-800 p-1.5 rounded-lg"
                          title="معاينة البيانات"
                        >
                          <Hash className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-slate-400 hover:text-rose-400 bg-slate-800 p-1.5 rounded-lg"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTask && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 space-y-2 mt-4">
                  <div className="flex items-center justify-between text-xs text-sky-400 font-bold">
                    <span>تفاصيل البيانات المختومة ({selectedTask.id}):</span>
                    <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-white">إغلاق</button>
                  </div>
                  <pre className="text-[11px] font-mono text-emerald-300 bg-slate-900 p-3 rounded-lg overflow-x-auto max-h-48 border border-slate-800">
                    {JSON.stringify(selectedTask.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'math_guard' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  حارس الحسابات أوفلاين (Offline Math Guard Protocol)
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  يقوم المحرك أوفلاين بإعادة حساب مجاميع المبيعات، الفواتير، والسندات تلقائياً لمنع أي تلاعب أو انحراف في الأرقام أو الخصومات، مع تصحيح الفروقات الحسابية 0ms قبل الحفظ.
                </p>

                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>حالة التدقيق الحسابي الحالية:</span>
                    <span className="text-emerald-400 font-bold">نشط 100%</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>عدد الحركات المعدلة حسابياً:</span>
                    <span className="text-purple-400 font-bold font-mono">{report?.mathGuardViolations || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  فحص سعة واستقرار الذاكرة المحلية (IndexedDB + Storage)
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400">حجم طابور المحل الحالي:</span>
                    <span className="font-mono text-emerald-300">{report?.storageUsageBytes || 0} Bytes</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400">وضع الأمان ضد الانقطاع الكهربائي:</span>
                    <span className="text-emerald-400 font-medium">مفعل (Mirror Sync Guard)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>نظام JAM SYSTEM PRO أوفلاين - المحور 7 & 8</span>
          <button 
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl transition"
          >
            إغلاق التقرير
          </button>
        </div>

      </div>
    </div>
  );
};
