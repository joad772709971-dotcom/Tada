import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, MessageCircle, AlertTriangle, X, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import { UserProfile } from '../types';
import { antiTamperLicenseVault } from '../services/AntiTamperLicenseVault';

interface TrialExpirationNoticeModalProps {
  profile: UserProfile | null;
}

export default function TrialExpirationNoticeModal({ profile }: TrialExpirationNoticeModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;

    // Validate license using AntiTamper Vault
    const validation = antiTamperLicenseVault.validateLicense(profile);

    // If lifetime or superadmin, don't show notice
    if (validation.isLifetime || profile.isLifetime || profile.role === 'superadmin') {
      return;
    }

    const remainingDays = validation.daysRemaining;

    // Show notice if 3 days or less remaining (0, 1, 2, 3)
    if (remainingDays >= 0 && remainingDays <= 3) {
      const todayStr = new Date().toISOString().split('T')[0];
      const dismissedToday = localStorage.getItem(`jam_trial_notice_dismissed_${todayStr}`);
      if (!dismissedToday) {
        setDaysLeft(remainingDays);
        setIsVisible(true);
      }
    }
  }, [profile]);

  const handleDismiss = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem(`jam_trial_notice_dismissed_${todayStr}`, 'true');
    setIsVisible(false);
  };

  const handleContactAdmin = () => {
    const message = encodeURIComponent(`مرحباً إدارة منظومة JAM، أود تجديد اشتراك المحل (${profile?.shopName || profile?.name}) باقي على انتهاء الفترة: ${daysLeft} أيام.`);
    window.open(`https://wa.me/967777503191?text=${message}`, '_blank');
  };

  if (!isVisible || daysLeft === null) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" dir="rtl">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-3xl border border-amber-500/40 shadow-2xl overflow-hidden text-right p-6"
        >
          {/* Top Banner Accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 animate-pulse" />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 left-4 p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
            title="إغلاق التنبيه اليومي"
          >
            <X size={18} />
          </button>

          {/* Header Icon */}
          <div className="flex items-center gap-3 mb-4 pt-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
              <AlertTriangle size={26} className="animate-bounce" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                تنبيه قرب انتهاء الصلاحية
              </span>
              <h3 className="text-base font-black text-white mt-1">
                تذكير تجديد اشتراك المنظومة ⏳
              </h3>
            </div>
          </div>

          {/* Main Card Content */}
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-amber-500/20 mb-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span>الوقت المتبقي للاشتراك:</span>
              <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-sm shadow-md">
                {daysLeft === 0 ? 'اليوم هو اليوم الأخير! ⚠️' : `${daysLeft} أيام متبقية`}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              عزيزي التاجر <span className="font-bold text-amber-400">{profile?.shopName || profile?.name}</span>، يرجى التواصل مع إدارة المنظومة لتجديد اشتراكك أو ترقية باقتك وضمان استمرار كافة الخدمات والعمليات دون توقف.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleContactAdmin}
              className="py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <MessageCircle size={16} />
              <span>تواصل لتجديد الاشتراك</span>
            </button>

            <button
              onClick={handleDismiss}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-700"
            >
              إغلاق (تذكير غداً)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
