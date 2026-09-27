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
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { VersionControlService, VersionCheckResult } from '../services/versionControlService';
import { environmentService } from '../services/environmentService';

export default function AppVersionEnforcerModal() {
  const [versionStatus, setVersionStatus] = useState<VersionCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [dismissedOptional, setDismissedOptional] = useState(false);
  const currentLocalVersion = environmentService.getVersionInfo().version;

  const performCheck = async () => {
    setIsChecking(true);
    try {
      const res = await VersionControlService.checkAppVersion();
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

  if (isChecking || !versionStatus) {
    return null;
  }

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

          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 shrink-0">
              <ShieldAlert className="w-10 h-10 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  تحديث إجباري للأمان المحاسبي
                </span>
                <span className="text-xs text-slate-400">v{currentLocalVersion}</span>
              </div>
              <h2 className="text-2xl font-black text-white">تحديث هام للنظام مطلوب لمواصلة العمل</h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            تم إطلاق تحديث جوهري يُحسّن من <strong>أنظمة العزل بين المتاجر والحماية الحسابية</strong>. النسخة الحالية المعروضة لديك قديمة وتتجاوز الحد الأدنى المقبول (v{versionStatus.minSupportedVersion}). يرجى تنزيل التحديث الجديد فوراً لضمان عدم توقف العمليات السحابية لحساباتك.
          </p>

          {/* Version Stats */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block">إصدارك الحالي:</span>
              <strong className="text-rose-400 font-mono text-sm">v{currentLocalVersion}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">أحدث إصدار معتمد:</span>
              <strong className="text-emerald-400 font-mono text-sm">v{versionStatus.latestVersion}</strong>
            </div>
          </div>

          {/* Release Notes */}
          {versionStatus.releaseNotes && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>مميزات التحديث الجديد:</span>
              </div>
              <div className="text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800 max-h-28 overflow-y-auto whitespace-pre-line">
                {versionStatus.releaseNotes}
              </div>
            </div>
          )}

          {/* Download Buttons for APK and EXE */}
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Android APK Link */}
              <a
                href={versionStatus.updateUrlApk || '#'}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 ${
                  !versionStatus.updateUrlApk ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>تحديث تطبيق Android (APK)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>

              {/* Windows EXE Link */}
              <a
                href={versionStatus.updateUrlExe || '#'}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 ${
                  !versionStatus.updateUrlExe ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>تحديث تطبيق الكمبيوتر (EXE)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <button
              onClick={performCheck}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة الفحص والتحقق بعد التثبيت</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Case 2: Optional Update Notification Banner (Current < Latest, but >= Min)
  if (versionStatus.requiresUpdate && !dismissedOptional) {
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
              {versionStatus.updateUrlApk && (
                <a
                  href={versionStatus.updateUrlApk}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shadow-md transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل APK</span>
                </a>
              )}

              {versionStatus.updateUrlExe && (
                <a
                  href={versionStatus.updateUrlExe}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-md transition-all"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>تحديث EXE</span>
                </a>
              )}

              <button
                onClick={() => setDismissedOptional(true)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                title="إغلاق التنبيه مؤقتاً"
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
