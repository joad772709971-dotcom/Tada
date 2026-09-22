import React, { useState, useEffect } from 'react';
import { 
  Rocket, 
  Save, 
  RefreshCw, 
  Smartphone, 
  Monitor, 
  Globe, 
  ShieldAlert, 
  CheckCircle2, 
  Info,
  Sparkles,
  Link,
  Code,
  Zap
} from 'lucide-react';
import { VersionControlService, VersionCheckResult } from '../services/versionControlService';
import { environmentService } from '../services/environmentService';
import LiveHotFixPublisherModal from './LiveHotFixPublisherModal';

export default function AppVersionPublisherPanel() {
  const [latestVersion, setLatestVersion] = useState('2.8.8');
  const [minSupportedVersion, setMinSupportedVersion] = useState('2.0.0');
  const [releaseNotes, setReleaseNotes] = useState('1. إخفاء وتأمين وحدات الصيانة والأرصدة لتجار جملة الجملة والمستوردين.\n2. تحسين وتصغير مقاس سند الصيانة وتقليص خانات الإدخال بشبكة مدمجة.\n3. التوافق العكسي التام ودعم التحديث الفوري المباشر OTA بدون تنزيل.');
  const [updateUrlApk, setUpdateUrlApk] = useState('https://ais-pre-cpravmzzzjg3jsiayido7z-320469830981.europe-west1.run.app/downloads/jam_pro.apk');
  const [updateUrlExe, setUpdateUrlExe] = useState('https://ais-pre-cpravmzzzjg3jsiayido7z-320469830981.europe-west1.run.app/downloads/jam_pro.exe');
  const [updateUrlWeb, setUpdateUrlWeb] = useState('https://ais-pre-cpravmzzzjg3jsiayido7z-320469830981.europe-west1.run.app');

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [currentStatus, setCurrentStatus] = useState<VersionCheckResult | null>(null);
  const [isHotFixModalOpen, setIsHotFixModalOpen] = useState(false);

  const localVersionInfo = environmentService.getVersionInfo();

  const fetchServerConfig = async () => {
    const res = await VersionControlService.checkAppVersion();
    setCurrentStatus(res);
    if (res) {
      setLatestVersion(res.latestVersion);
      setMinSupportedVersion(res.minSupportedVersion);
      setReleaseNotes(res.releaseNotes || '');
      setUpdateUrlApk(res.updateUrlApk || '');
      setUpdateUrlExe(res.updateUrlExe || '');
      setUpdateUrlWeb(res.updateUrlWeb || '');
    }
  };

  useEffect(() => {
    fetchServerConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    const success = await VersionControlService.updateServerVersionConfig({
      latestVersion,
      minSupportedVersion,
      releaseNotes,
      updateUrlApk,
      updateUrlExe,
      updateUrlWeb,
    });

    setIsSaving(false);
    if (success) {
      setSaveStatus({
        type: 'success',
        message: 'تم نشر إعدادات الإصدارات الجديدة وحفظها في السيرفر بنجاح! سيتم تطبيق القواعد فوراً على كافة الـ APK و EXE عند العملاء.',
      });
      fetchServerConfig();
    } else {
      setSaveStatus({
        type: 'error',
        message: 'فشل حفظ الإعدادات على السيرفر. يرجى التحقق من الاتصال بالإنترنت وصلاحيات الأدمين.',
      });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-6 dir-rtl text-right font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">إدارة إصدارات التطبيق والتحديث الإجباري (APK & EXE Release Manager)</h3>
            <p className="text-xs text-slate-400">
              المرحلة الثالثة: نشر النسخ المعتمدة والتحكم في شروط التحديث الإجباري أو الاختياري لمنع استخدام النسخ الكاسرة للبيانات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsHotFixModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>دفع تحديث حار فوري بدون تنزيل (Push Live Hot-Fix)</span>
          </button>

          <button
            onClick={fetchServerConfig}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Local vs Server Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">نسخة التطبيق المحلية (Local Code)</span>
          <strong className="text-lg font-mono text-cyan-400">v{localVersionInfo.version}</strong>
          <p className="text-[11px] text-slate-500 mt-1">تاريخ البناء: {localVersionInfo.buildDate}</p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">أحدث إصدار معتمد لدى العملاء</span>
          <strong className="text-lg font-mono text-emerald-400">v{currentStatus?.latestVersion || latestVersion}</strong>
          <p className="text-[11px] text-slate-500 mt-1">المسجل في Firestore app_version_config</p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">الحد الأدنى المسموح به (Min Supported)</span>
          <strong className="text-lg font-mono text-amber-400">v{currentStatus?.minSupportedVersion || minSupportedVersion}</strong>
          <p className="text-[11px] text-slate-500 mt-1">أي تطبيق أدنى من ذلك سيتلقى شاشة إجبار للتحديث</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSaveConfig} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>رقم أحدث إصدار منشور (Latest Version Number):</span>
            </label>
            <input
              type="text"
              value={latestVersion}
              onChange={(e) => setLatestVersion(e.target.value)}
              placeholder="مثال: 2.5.0"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-emerald-400 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>أقل إصدار مدعوم (Min Supported Version):</span>
            </label>
            <input
              type="text"
              value={minSupportedVersion}
              onChange={(e) => setMinSupportedVersion(e.target.value)}
              placeholder="مثال: 2.0.0"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-rose-400 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-slate-500">العميل الذي يمتلك إكزي أو APK بversion أصغر من هذا لن يستطيع الدخول حتى يحدث.</p>
          </div>
        </div>

        {/* Download URLs */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold text-slate-200">روابط تنزيل التحديث للعملاء (Update Binary URLs):</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>رابط تنزيل تطبيق أندرويد (APK Download URL):</span>
              </label>
              <input
                type="url"
                value={updateUrlApk}
                onChange={(e) => setUpdateUrlApk(e.target.value)}
                placeholder="https://.../jam_pro.apk"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 ltr text-left focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 flex items-center gap-1">
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                <span>رابط تنزيل تطبيق الويندوز (EXE Download URL):</span>
              </label>
              <input
                type="url"
                value={updateUrlExe}
                onChange={(e) => setUpdateUrlExe(e.target.value)}
                placeholder="https://.../jam_pro.exe"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 ltr text-left focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Release Notes */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-bold text-slate-300">ملاحظات التحديث للعملاء (Release Notes):</label>
          <textarea
            rows={3}
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            placeholder="اكتب التغييرات والميزات الجديدة ليراها العميل..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 leading-relaxed"
          />
        </div>

        {saveStatus && (
          <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            saveStatus.type === 'success' 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          }`}>
            {saveStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
            <span>{saveStatus.message}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'جاري نشر الإعدادات للعملاء...' : 'حفظ ونشر إعدادات الإصدار فوراً'}</span>
        </button>
      </form>

      <LiveHotFixPublisherModal 
        isOpen={isHotFixModalOpen} 
        onClose={() => setIsHotFixModalOpen(false)} 
      />
    </div>
  );
}
