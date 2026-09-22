import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  Database, 
  RefreshCw, 
  Play, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Lock, 
  Layers, 
  FileText, 
  Sparkles, 
  Info,
  Shield,
  Zap,
  Activity
} from 'lucide-react';
import { SafeMigrationService, MigrationCollectionStats, MigrationReport } from '../services/safeMigrationService';
import { performBackup } from '../services/backupService';
import { environmentService } from '../services/environmentService';

export default function SafeMigrationPanel() {
  const [stats, setStats] = useState<MigrationCollectionStats[]>([]);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'health' | 'execute' | 'logs'>('health');

  const envConfig = environmentService.getConfig();

  const loadHealthStats = async () => {
    setIsLoadingHealth(true);
    try {
      const res = await SafeMigrationService.analyzeSchemaHealth();
      setStats(res);
    } catch (e) {
      console.error('Failed to load schema health:', e);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    loadHealthStats();
  }, []);

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    try {
      await performBackup();
    } catch (e) {
      console.error('Manual backup failed:', e);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRunSafeMigration = async () => {
    const confirm = window.confirm(
      '🛡️ بروتوكول الهجرة الإضافية الوقائي (Additive Migration)\n\n' +
      'سيتولى النظام إجراء ما يلي تلقائياً:\n' +
      '1. إنشاء نسخة احتياطية سحابية ومحلية قبل البدء.\n' +
      '2. إضافة الحقول والتوافقات الجديدة بحذر دون حذف أي حقل قديم (Additive Only).\n' +
      '3. ضمان استمرار تشغيل تطبيقات الـ APK والـ EXE القديمة لدى العملاء دون توقف.\n\n' +
      'هل تريد بدء عملية الهجرة التحديثية الآمنة الآن؟'
    );
    if (!confirm) return;

    setIsMigrating(true);
    setProgressPct(0);
    setProgressMsg('جاري بدء التحضير وإنشاء النسخة الوقائية...');

    try {
      const report = await SafeMigrationService.executeAdditiveMigration((msg, pct) => {
        setProgressMsg(msg);
        setProgressPct(pct);
      });
      setMigrationReport(report);
      setActiveSubTab('logs');
      loadHealthStats();
    } catch (e: any) {
      alert(`حدث خطأ أثناء تنفيذ الهجرة: ${e.message || e}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const totalDocs = stats.reduce((acc, s) => acc + s.totalDocs, 0);
  const totalLegacyDocs = stats.reduce((acc, s) => acc + s.legacyDocs, 0);
  const totalUpToDateDocs = stats.reduce((acc, s) => acc + s.upToDateDocs, 0);
  const healthScore = totalDocs > 0 ? Math.round((totalUpToDateDocs / totalDocs) * 100) : 100;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-6 dir-rtl text-right font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 rounded-xl text-emerald-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">بروتوكول الهجرة الآمنة والنسخ الاحتياطي (Safe Additive Migration)</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                المرحلة الرابعة: حماية البيانات 100%
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              التحكم في هجرة الهيكل بقوانين التحديث الإضافي (Additive Changes) لمنع فقدان البيانات وتأمين نسخ احتياطية تلقائية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualBackup}
            disabled={isBackingUp || isMigrating}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-4 h-4 text-cyan-400 ${isBackingUp ? 'animate-bounce' : ''}`} />
            <span>{isBackingUp ? 'جاري تصدير النسخة الاحتياطية...' : 'تصدير نسخة احتياطية فورية'}</span>
          </button>

          <button
            onClick={handleRunSafeMigration}
            disabled={isMigrating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${isMigrating ? 'animate-spin' : ''}`} />
            <span>{isMigrating ? 'جاري تنفيذ الهجرة...' : 'تشغيل الهجرة الآمنة للبيانات'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>مؤشر سلامة توافق الهيكل</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{healthScore}%</div>
          <p className="text-[11px] text-slate-500 mt-1">
            {totalLegacyDocs === 0 ? 'جميع السجلات متوافقة مع الإصدار v2' : `${totalLegacyDocs} سجل يتطلب تحديثاً إضافياً`}
          </p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>إجمالي المجموعات المفحوصة</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">الحسابات، المخزون، السندات، والمبيعات</p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>إجمالي السجلات المسجلة</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-200">{totalDocs}</div>
          <p className="text-[11px] text-slate-500 mt-1">مفحوصة ومؤمنة في Firestore</p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>بيئة التشغيل النشطة</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-200 uppercase">{envConfig.env}</div>
          <p className="text-[11px] text-slate-500 mt-1">التحديث إضافي وغير كاسر (Additive)</p>
        </div>
      </div>

      {/* Progress Bar (Visible while migrating) */}
      {isMigrating && (
        <div className="bg-slate-950 border border-emerald-500/40 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-200">
            <span className="flex items-center gap-2 text-emerald-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{progressMsg}</span>
            </span>
            <span className="font-mono text-emerald-400">{progressPct}%</span>
          </div>

          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <motion.div 
              initial={{ width: '0%' }}
              animate={{ width: `${progressPct}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('health')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'health'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span>حالة توافق المجموعات والحقول</span>
          </div>
        </button>

        <button
          onClick={() => setActiveSubTab('execute')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'execute'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>قواعد الهجرة والتوافق العكسي</span>
          </div>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'logs'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>سجل عمليات الهجرة التحديثية</span>
            {migrationReport && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500 text-slate-950 font-bold">
                تم بنجاح
              </span>
            )}
          </div>
        </button>
      </div>

      {/* SubTab 1: Health Grid */}
      {activeSubTab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>فحص صحة الهيكل عبر مجموعات البيانات الأساسية:</span>
            <button
              onClick={loadHealthStats}
              disabled={isLoadingHealth}
              className="flex items-center gap-1 text-cyan-400 hover:underline cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
              <span>إعادة فحص المجموعات</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.map((s) => (
              <div 
                key={s.collectionName}
                className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm font-mono">{s.collectionName}</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                      v{s.schemaVersion}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    السجلات المحدثة: <strong className="text-emerald-400">{s.upToDateDocs}</strong> / {s.totalDocs}
                  </div>
                </div>

                <div className="text-left shrink-0">
                  {s.legacyDocs === 0 ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>متوافق 100%</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{s.legacyDocs} سجل يتطلب هجرة</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SubTab 2: Safety Rules Explanation */}
      {activeSubTab === 'execute' && (
        <div className="space-y-4 text-xs text-slate-300">
          <div className="bg-gradient-to-r from-emerald-950/30 via-slate-900 to-teal-950/30 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>قواعد ضمان الهجرة بدون فقدان أي قرش أو كسر النسخ القديمة</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-white block">1. التحديث الإضافي فقط (Additive Only):</strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  يمنع المحرك تماماً حذف أو تغيير أسماء المفاتيح القديمة. الحقول الجديدة تُضاف بقيم افتراضية مرنة لتعمل تطبيقات APK و EXE القديمة والحديثة معاً دون أي تعارض.
                </p>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-white block">2. النسخ الاحتياطي التلقائي (Pre-Migration Backup):</strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  قبل البدء بأول تعديل في الهيكل، يتم إنشاء نسخة JSON كاملة مشفرة لجميع مجموعات المتاجر وتخزينها في التخزين الوقائي.
                </p>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-white block">3. وسم إصدار الهيكل (Schema Version Tagging):</strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  يتم وسم كل سجل بـ `schemaVersion: 2` ليتمكن المحرك من تخطي السجلات المحدثة فوراً في المرات القادمة لتوفير السرعة المطلقة.
                </p>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-white block">4. عدم المساس بالسندات التاريخية (Immutable Vouchers):</strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  السندات والمزارعات المحاسبية السابقة لا تتغير أرقامها أو مبالغها إطلاقاً، ويتم حفظ توازن الطرفين (المدين والدائن) بدقة صلبة.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Migration Execution Logs */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {!migrationReport ? (
            <div className="text-center py-10 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
              لم يتم تشغيل أي عملية هجرة في هذه الجلسة بعد. انقر على "تشغيل الهجرة الآمنة للبيانات" للبدء.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">تاريخ الهجرة:</span>
                  <strong className="text-white mr-2">{migrationReport.timestamp}</strong>
                </div>
                <div>
                  <span className="text-slate-400">إجمالي المعالج:</span>
                  <strong className="text-emerald-400 mr-2">{migrationReport.totalProcessed} سجل</strong>
                </div>
                <div>
                  <span className="text-slate-400">النسخة الاحتياطية:</span>
                  <strong className="text-cyan-400 mr-2">
                    {migrationReport.backupSuccess ? 'محفوظة بنجاح' : 'تحذير'}
                  </strong>
                </div>
              </div>

              <div className="bg-slate-950 font-mono text-xs text-slate-300 p-4 rounded-xl border border-slate-800 max-h-64 overflow-y-auto space-y-1.5 ltr text-left dir-ltr">
                {migrationReport.logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
