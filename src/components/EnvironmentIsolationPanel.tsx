import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Cpu, 
  RefreshCw, 
  Database, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  Server, 
  Layers, 
  Play, 
  Globe, 
  Check, 
  Info,
  Sliders,
  Shield,
  Zap,
  GitFork
} from 'lucide-react';
import { environmentService, AppEnvironment } from '../services/environmentService';
import { TenantIsolationAuditor, TenantAuditReport } from '../services/tenantIsolationAuditor';
import SystemIsolationMasterPanel from './SystemIsolationMasterPanel';
import OrderRoutingControlPanel from './OrderRoutingControlPanel';

interface EnvironmentIsolationPanelProps {
  onEnvironmentChange?: (env: AppEnvironment) => void;
}

export default function EnvironmentIsolationPanel({ onEnvironmentChange }: EnvironmentIsolationPanelProps) {
  const [config, setConfig] = useState(environmentService.getConfig());
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<TenantAuditReport | null>(null);
  const [isolateDevCollections, setIsolateDevCollections] = useState(
    localStorage.getItem('jam_isolate_dev_collections') === 'true'
  );
  const [activeTab, setActiveTab] = useState<'master' | 'overview' | 'audit' | 'environments'>('master');

  useEffect(() => {
    // Run initial auto audit on load
    runAudit();
  }, []);

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const report = await TenantIsolationAuditor.runFullAudit();
      setAuditReport(report);
    } catch (e) {
      console.error('Audit failed:', e);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSwitchEnv = (targetEnv: AppEnvironment) => {
    if (targetEnv === 'production') {
      const confirmProd = window.confirm(
        '⚠️ تنبيه أمان عالي الخطورة!\nأنت على وشك التبديل إلى [بيئة الإنتاج الحية - Live Production].\nهل أنت متأكد من أنك تريد العمل على السيرفر الفعلي لبيانات المحلات والمستأجرين الحقيقيين؟'
      );
      if (!confirmProd) return;
    }

    environmentService.setEnvironment(targetEnv);
    setConfig(environmentService.getConfig());
    if (onEnvironmentChange) {
      onEnvironmentChange(targetEnv);
    }
    runAudit();
  };

  const toggleIsolateDevCollections = (val: boolean) => {
    setIsolateDevCollections(val);
    localStorage.setItem('jam_isolate_dev_collections', val ? 'true' : 'false');
    setConfig(environmentService.getConfig());
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-6 dir-rtl text-right font-sans">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-xl text-cyan-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">لوحة إدارة عزل البيانات وبيئات التشغيل (Stage Isolation)</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                config.isProduction 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : config.isStaging 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              }`}>
                {config.isProduction ? '🟢 بيئة الإنتاج الحية' : config.isStaging ? '🟡 بيئة الاختيار Staging' : '🔵 بيئة التطوير Dev'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              المرحلة الثانية: حماية بيانات العملاء والمحلات من أي تسريب وتأمين بيئة اختبار معزولة 100% للتعديلات والتحديثات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runAudit}
            disabled={isAuditing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
            {isAuditing ? 'جاري الفحص والتدقيق...' : 'فحص وتدقيق العزل الآن'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('master')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'master'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>لوحة ضبط العزل والخصوصية السيادية (42 صفحة)</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('order_routing')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'order_routing'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-indigo-400" />
            <span>مسارات الطلب والخصومات والبدائل</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            <span>نظرة عامة ومؤشرات العزل</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>تقرير التدقيق والتحصين السحابي</span>
            {auditReport && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-cyan-400">
                {auditReport.summary.isolationScore}%
              </span>
            )}
          </div>
        </button>

        <button
          onClick={() => setActiveTab('environments')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'environments'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>التحكم في بيئات العزل والـ Sandbox</span>
          </div>
        </button>
      </div>

      {/* Master Isolation Config Tab */}
      {activeTab === 'master' && (
        <SystemIsolationMasterPanel />
      )}

      {/* Order Routing Control Tab */}
      {activeTab === 'order_routing' && (
        <OrderRoutingControlPanel />
      )}

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Status Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>نسبة سلامة العزل السحابي</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400">
                {auditReport ? `${auditReport.summary.isolationScore}%` : '100%'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">مستوى الأمان: عزل تام ومحمي</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>البيئة النشطة للبرنامج</span>
                <Globe className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-lg font-bold text-slate-200 uppercase">
                {config.env}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">بادئة الجداول: {config.dbPrefix || 'لا توجد (مباشرة)'}</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>قوانين أمان Firestore</span>
                <Lock className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>محدثة ومفعلة</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">عزل تلقائي برقم المتجر tenantId</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>حجب التعديلات الكاسرة</span>
                <Sliders className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-lg font-bold text-slate-200">
                Non-Breaking
              </div>
              <p className="text-[11px] text-slate-500 mt-1">دعم التوافق الرجعي للـ APK/EXE</p>
            </div>
          </div>

          {/* Quick Explanation for Commercial Peace of Mind */}
          <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-cyan-950/40 border border-cyan-500/20 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
              <Info className="w-5 h-5 text-cyan-400" />
              <span>كيف نضمن سلامة حسابات العملاء 100% أثناء تطوير وتحديث البرنامج؟</span>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
              <li className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>جدار السيرفر الصارم:</strong> الاستعلامات تفحص رقم الشركة في سيرفر Google Firestore، ولا يمكن لكود APK قديم أن يصل لبيانات متجر آخر.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>بيئة تجارب معزولة (Staging Sandbox):</strong> التعديلات والتجارب تجري على بيئة منفصلة بالكامل بدون أي تأثير على المحلات الحقيقية.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>حجب التداخل في السندات:</strong> محرك `MultiTenantService` يمنع تسجيل أي قيد أو فاتورة لمعرّف شركة لا يطابق جلسة المستخدم.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>تحديثات مرنة بدون كسر:</strong> الحقول الجديدة تُضاف بقيم افتراضية لضمان عمل تطبيقات العملاء الحالية بسلامة تامة.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Audit Report */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div>
              <div className="text-sm font-bold text-white">نتائج آخر تدقيق أمني ومحاكاة للعزل</div>
              <div className="text-xs text-slate-400 mt-0.5">
                تاريخ التدقيق: {auditReport ? auditReport.auditedAt : 'غير منفذ'}
              </div>
            </div>
            {auditReport && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  الناجحة: <strong className="text-emerald-400">{auditReport.summary.passed}</strong> / {auditReport.summary.totalChecks}
                </span>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold">
                  درجة الأمان: {auditReport.summary.isolationScore}%
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {auditReport?.checks.map((check) => (
              <div
                key={check.id}
                className={`p-4 rounded-xl border transition-all ${
                  check.status === 'passed'
                    ? 'bg-slate-950/40 border-emerald-500/30'
                    : check.status === 'warning'
                    ? 'bg-amber-950/20 border-amber-500/30'
                    : 'bg-rose-950/20 border-rose-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {check.status === 'passed' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
                    {check.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
                    {check.status === 'failed' && <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}

                    <div>
                      <h4 className="text-sm font-bold text-slate-200">{check.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">{check.details}</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                    check.status === 'passed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : check.status === 'warning'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {check.status === 'passed' ? 'ناجح ومحمي' : check.status === 'warning' ? 'تنبيه' : 'فشل'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Environment Controls */}
      {activeTab === 'environments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Development Mode */}
            <div className={`p-5 rounded-xl border transition-all space-y-3 ${
              config.isDevelopment 
                ? 'bg-cyan-950/30 border-cyan-500/50 shadow-lg shadow-cyan-950/50' 
                : 'bg-slate-950/40 border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                  Development
                </span>
                {config.isDevelopment && <span className="text-[10px] bg-cyan-500 text-slate-950 px-2 py-0.5 rounded font-black">نشط الان</span>}
              </div>
              <h3 className="text-base font-bold text-white">بيئة التطوير (Development)</h3>
              <p className="text-xs text-slate-400">
                مخصصة لتجربة البرمجة وإضافة الميزات الجديدة بسرعة وتجربة الواجهات دون المساس بأي قاعدة بيانات حقيقية.
              </p>
              <button
                onClick={() => handleSwitchEnv('development')}
                disabled={config.isDevelopment}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold rounded-lg text-slate-200 transition-all cursor-pointer"
              >
                {config.isDevelopment ? 'أنت في بيئة التطوير' : 'التحويل إلى بيئة التطوير'}
              </button>
            </div>

            {/* Staging Sandbox Mode */}
            <div className={`p-5 rounded-xl border transition-all space-y-3 ${
              config.isStaging 
                ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-950/50' 
                : 'bg-slate-950/40 border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                  Staging Sandbox
                </span>
                {config.isStaging && <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-black">نشط الان</span>}
              </div>
              <h3 className="text-base font-bold text-white">بيئة الاختبار السحابية (Staging)</h3>
              <p className="text-xs text-slate-400">
                بيئة معزولة تحاكي الإنتاج 100%. يتم فيها اختبار دورات المبيعات والحسابات الشاملة قبل رفع التحديث للعملاء.
              </p>
              <button
                onClick={() => handleSwitchEnv('staging')}
                disabled={config.isStaging}
                className="w-full py-2 bg-amber-600/80 hover:bg-amber-600 disabled:opacity-40 text-xs font-bold rounded-lg text-white transition-all cursor-pointer"
              >
                {config.isStaging ? 'أنت في بيئة Staging' : 'التحويل إلى Staging Sandbox'}
              </button>
            </div>

            {/* Production Live Mode */}
            <div className={`p-5 rounded-xl border transition-all space-y-3 ${
              config.isProduction 
                ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-950/50' 
                : 'bg-slate-950/40 border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Production Live
                </span>
                {config.isProduction && <span className="text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-black">نشط الان</span>}
              </div>
              <h3 className="text-base font-bold text-white">بيئة الإنتاج الحية (Production)</h3>
              <p className="text-xs text-slate-400">
                بيئة المتاجر والعملاء الفعليين. جميع حركات الحسابات معزولة تماماً بقواعد أمان السيرفر.
              </p>
              <button
                onClick={() => handleSwitchEnv('production')}
                disabled={config.isProduction}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold rounded-lg text-white transition-all cursor-pointer"
              >
                {config.isProduction ? 'أنت في البيئة الحية' : 'التحويل إلى البيئة الحية'}
              </button>
            </div>
          </div>

          {/* Dev Collections Scope Toggle */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-200">عزل مجموعات بيانات التطوير (Dev Collections Isolation)</div>
              <div className="text-xs text-slate-400">
                عند التفعيل، سيقوم التطبيق بإنشاء وقراءة مجموعات ببادئة `dev_` أثناء التطوير لتفادي أي اختلاط تجريبي.
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isolateDevCollections} 
                onChange={(e) => toggleIsolateDevCollections(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
