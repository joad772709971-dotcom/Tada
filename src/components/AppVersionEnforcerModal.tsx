import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Download, 
  RefreshCw, 
  Smartphone, 
  Monitor, 
  Sparkles, 
  X, 
  CheckCircle2, 
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { VersionControlService, VersionCheckResult } from '../services/versionControlService';
import { environmentService } from '../services/environmentService';

export default function AppVersionEnforcerModal() {
  const [versionStatus, setVersionStatus] = useState<VersionCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const currentLocalVersion = environmentService.getVersionInfo().version;

  const performCheck = async () => {
    setIsChecking(true);
    try {
      const res = await VersionControlService.checkAppVersion();
      
      // Check if user already acknowledged, installed, or snoozed this version
      if (typeof window !== 'undefined' && res) {
        const dismissedVer = localStorage.getItem('jam_dismissed_update_version');
        const installedVer = localStorage.getItem('jam_installed_update_version');
        const snoozedUntilStr = localStorage.getItem('jam_snoozed_update_until');
        const snoozedUntil = snoozedUntilStr ? parseInt(snoozedUntilStr, 10) : 0;
        const now = Date.now();

        // 1. If currently snoozed and snooze time hasn't passed, do not show
        if (snoozedUntil > now) {
          setIsDismissed(true);
          setVersionStatus(res);
          return;
        }

        // 2. If user already recorded installing this or higher version, do not show
        if (installedVer) {
          const comp = VersionControlService.compareVersions(installedVer, res.latestVersion);
          if (comp >= 0) {
            setIsDismissed(true);
            setVersionStatus(res);
            return;
          }
        }

        // 3. If user explicitly dismissed this update version, do not show
        if (dismissedVer && (dismissedVer === res.latestVersion || dismissedVer === res.minSupportedVersion)) {
          setIsDismissed(true);
          setVersionStatus(res);
          return;
        }
      }

      setVersionStatus(res);
    } catch (e) {
      console.error("Failed version check:", e);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    performCheck();
  }, []);

  const handleMarkAsInstalled = () => {
    if (typeof window !== 'undefined' && versionStatus) {
      try {
        const targetVer = versionStatus.latestVersion || '1.0.0';
        localStorage.setItem('jam_installed_update_version', targetVer);
        localStorage.setItem('jam_dismissed_update_version', targetVer);
        localStorage.removeItem('jam_snoozed_update_until');
        window.dispatchEvent(new Event('storage'));
      } catch (e) {}
    }
    setIsDismissed(true);
  };

  const handleSnooze = (days: number = 7) => {
    if (typeof window !== 'undefined' && versionStatus) {
      try {
        const targetVer = versionStatus.latestVersion || '1.0.0';
        const snoozeUntil = Date.now() + days * 24 * 60 * 60 * 1000;
        localStorage.setItem('jam_snoozed_update_until', snoozeUntil.toString());
        localStorage.setItem('jam_dismissed_update_version', targetVer);
      } catch (e) {}
    }
    setIsDismissed(true);
  };

  if (isChecking || !versionStatus || isDismissed) {
    return null;
  }

  const apkDownloadUrl = versionStatus.updateUrlApk || 'https://github.com/joad772709971-dotcom/Tada/releases/latest/download/Jam-Store.apk';
  const exeDownloadUrl = versionStatus.updateUrlExe || 'https://github.com/joad772709971-dotcom/Tada/releases/latest/download/Jam-Store-Setup.exe';

  // Case 1: Force Update Required (Current Version < Minimum Supported Version)
  if (versionStatus.isForceUpdate) {
    return (
      <div className="fixed inset-0 z-[999999] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 dir-rtl text-right font-sans">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-xl w-full bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/50 text-slate-100 space-y-6 relative overflow-hidden"
        >
          {/* Top Decorative Glow */}
          <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />

          {/* Close / Snooze Button at Top Right */}
          <button
            onClick={() => handleSnooze(7)}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer"
            title="تخطي مؤقتاً ومتابعة العمل"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 shrink-0">
              <ShieldAlert className="w-10 h-10 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  تحديث هام للنظام
                </span>
                <span className="text-xs text-slate-400">v{currentLocalVersion}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">تحديث النظام والترقية للإصدار v{versionStatus.latestVersion}</h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            تم إطلاق تحديث شامل ومستقر لنظامك يشمل <strong>تحسينات السرعة، حماية العمليات المحاسبية، والعزل التام</strong>. إذا قمت بتثبيت التحديث يمكنك تأكيد ذلك فوراً دون إزعاج.
          </p>

          {/* Version Stats */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block">إصدارك الحالي:</span>
              <strong className="text-emerald-400 font-mono text-sm">v{currentLocalVersion}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">أحدث إصدار معتمد:</span>
              <strong className="text-cyan-400 font-mono text-sm">v{versionStatus.latestVersion}</strong>
            </div>
          </div>

          {/* Release Notes */}
          {versionStatus.releaseNotes && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>مميزات التحديث الجديد:</span>
              </div>
              <div className="text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800 max-h-24 overflow-y-auto whitespace-pre-line">
                {versionStatus.releaseNotes}
              </div>
            </div>
          )}

          {/* Download Buttons for APK and EXE */}
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Android APK Link */}
              <a
                href={apkDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>تنزيل تطبيق Android (APK)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>

              {/* Windows EXE Link */}
              <a
                href={exeDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <Monitor className="w-4 h-4" />
                <span>تنزيل للكمبيوتر (Windows EXE)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Smart Confirmation & Polite Dismissal Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleMarkAsInstalled}
                className="w-full py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>تم التثبيت بالفعل (عدم التنبيه مجدداً)</span>
              </button>

              <button
                onClick={() => handleSnooze(7)}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>تخطي ومتابعة العمل (تذكير لاحقاً)</span>
              </button>
            </div>

            <button
              onClick={performCheck}
              className="w-full py-2 text-slate-500 hover:text-slate-400 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة التحقق من الخادم</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Case 2: Optional Update Notification Banner (Current < Latest, but >= Min)
  if (versionStatus.requiresUpdate) {
    return (
      <AnimatePresence>
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-3 right-3 left-3 z-[9999] max-w-4xl mx-auto bg-gradient-to-r from-cyan-900/90 via-slate-900/95 to-blue-900/90 border border-cyan-500/40 backdrop-blur-md rounded-2xl p-4 shadow-2xl text-slate-100 dir-rtl text-right font-sans"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/20 rounded-xl text-cyan-400 border border-cyan-500/30 shrink-0">
                <Sparkles className="w-5 h-5 animate-bounce" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">يتوفر تحديث جديد للبرنامج (v{versionStatus.latestVersion})</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    نسختك الحالية v{currentLocalVersion} متوافقة
                  </span>
                </div>
                <p className="text-slate-300 line-clamp-1">
                  {versionStatus.releaseNotes || 'تحديثات هامة لتحسين السرعة والأمان المحاسبي والعزل.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                onClick={handleMarkAsInstalled}
                className="px-2.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                title="تأكيد التثبيت وعدم التنبيه مرة أخرى"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تم التثبيت</span>
              </button>

              <a
                href={apkDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shadow-md transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>APK</span>
              </a>

              <a
                href={exeDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-md transition-all cursor-pointer"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>EXE</span>
              </a>

              <button
                onClick={() => handleSnooze(7)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                title="إغلاق التنبيه نهائياً لهذا الإصدار"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
