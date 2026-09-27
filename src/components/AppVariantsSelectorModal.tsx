import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Store, 
  Monitor, 
  Crown, 
  ShieldCheck, 
  X,
  Check,
  Smartphone,
  Layers
} from 'lucide-react';
import { 
  APP_VARIANTS, 
  AppVariantType, 
  getCurrentVariant, 
  switchAppVariant,
  validateUserVariantAccess 
} from '../services/variantEngine';
import { UserProfile } from '../types';

interface AppVariantsSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile | null;
}

export default function AppVariantsSelectorModal({
  isOpen,
  onClose,
  userProfile
}: AppVariantsSelectorModalProps) {
  const currentVariantCode = getCurrentVariant();
  const [selectedVariant, setSelectedVariant] = useState<AppVariantType>(currentVariantCode);

  if (!isOpen) return null;

  const userRole = userProfile?.role || 'owner';
  const userEmail = userProfile?.email || 'a777503191@gmail.com';
  const isOwner = userRole === 'owner' || userRole === 'superadmin' || userEmail === 'a777503191@gmail.com';

  const handleApplyVariant = (code: AppVariantType) => {
    switchAppVariant(code);
    window.location.reload();
  };

  const mainVariant = APP_VARIANTS['JAM_MAIN'];
  const portalVariant = APP_VARIANTS['JAM_PORTAL'];
  const desktopVariant = APP_VARIANTS['JAM_DESKTOP'];
  const masterVariant = APP_VARIANTS['ALL'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 dir-rtl text-right overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl text-cyan-400">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">منظومة البناء المحولة (3 حزم بناء: 2 APK + 1 EXE)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  تطبيقان هاتف + تطبيق كمبيوتر
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تطبيق الإدارة الرئيسي (APK) + تطبيق خدمة وبوابة العملاء (APK) + تطبيق الكمبيوتر المباشر (EXE)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/50 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Owner Notice Bar */}
        <div className="px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {isOwner 
                ? 'حساب المالك / SuperAdmin: دخول نافذ شامل لكافة التطبيقات والحزم بمرونة تامة.'
                : 'يتم تحويل وتوجيه المستخدمين بحسب صلاحيات حسابه تلقائياً.'}
            </span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/30">
            {isOwner ? 'المالك: دخول شامل' : `الدور: ${userRole}`}
          </span>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Section 1: Main APK */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Store className="w-4 h-4 text-sky-400" />
                <span>التطبيق الأول: تطبيق النظام الرئيسي (Main Store APK)</span>
              </h3>
              <span className="text-[11px] text-slate-400">APK 1 من 2</span>
            </div>

            <div
              onClick={() => setSelectedVariant(mainVariant.code)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col md:flex-row items-center justify-between gap-4 ${
                currentVariantCode === mainVariant.code || currentVariantCode === 'JAM_RETAIL'
                  ? 'bg-slate-950 border-sky-500 shadow-lg shadow-sky-500/10' 
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/70'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl border ${mainVariant.badgeColor}`}>
                  <Store className="w-8 h-8 text-sky-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">{mainVariant.editionNumber}</span>
                    {(currentVariantCode === mainVariant.code || currentVariantCode === 'JAM_RETAIL') && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500 text-slate-950">
                        النسخة النشطة
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-white">{mainVariant.titleAr}</h4>
                  <p className="text-xs text-slate-400 mt-1">{mainVariant.descriptionAr}</p>
                  <span className="text-[10px] font-mono text-sky-400/80 block mt-1">{mainVariant.packageId}</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyVariant(mainVariant.code);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                  currentVariantCode === mainVariant.code
                    ? 'bg-slate-800 text-slate-400 cursor-default'
                    : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-md active:scale-95'
                }`}
              >
                {currentVariantCode === mainVariant.code ? 'النسخة الحالية' : 'تشغيل تطبيق النظام الرئيسي'}
              </button>
            </div>
          </div>

          {/* Section 2: Customer Portal APK */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <span>التطبيق الثاني: تطبيق بوابة الزباين والخدمات (Customer Care APK)</span>
              </h3>
              <span className="text-[11px] text-slate-400">APK 2 من 2 - مع أيقونة الزباين المستقلة</span>
            </div>

            <div
              onClick={() => setSelectedVariant(portalVariant.code)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col md:flex-row items-center justify-between gap-4 ${
                currentVariantCode === portalVariant.code || currentVariantCode === 'JAM_CUSTOMER'
                  ? 'bg-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/10' 
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/70'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl border ${portalVariant.badgeColor}`}>
                  <ShoppingBag className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">{portalVariant.editionNumber}</span>
                    {(currentVariantCode === portalVariant.code || currentVariantCode === 'JAM_CUSTOMER') && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                        تطبيق الزباين النشط
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-white">{portalVariant.titleAr}</h4>
                  <p className="text-xs text-slate-400 mt-1">{portalVariant.descriptionAr}</p>
                  <span className="text-[10px] font-mono text-emerald-400/80 block mt-1">{portalVariant.packageId}</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyVariant(portalVariant.code);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                  currentVariantCode === portalVariant.code
                    ? 'bg-slate-800 text-slate-400 cursor-default'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md active:scale-95'
                }`}
              >
                {currentVariantCode === portalVariant.code ? 'النسخة الحالية' : 'تشغيل تطبيق بوابة الزباين'}
              </button>
            </div>
          </div>

          {/* Section 3: Desktop EXE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-purple-400" />
                <span>التطبيق الثالث: تطبيق الكمبيوتر المباشر (jam system pro)</span>
              </h3>
              <span className="text-[11px] text-slate-400">EXE المباشر للويندوز والطابعات</span>
            </div>

            <div
              onClick={() => setSelectedVariant(desktopVariant.code)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col md:flex-row items-center justify-between gap-4 ${
                currentVariantCode === desktopVariant.code 
                  ? 'bg-slate-950 border-purple-500 shadow-lg shadow-purple-500/10' 
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/70'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl border ${desktopVariant.badgeColor}`}>
                  <Monitor className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">{desktopVariant.editionNumber}</span>
                    {currentVariantCode === desktopVariant.code && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500 text-slate-950">
                        نسخة الكمبيوتر النشطة
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-white">{desktopVariant.titleAr}</h4>
                  <p className="text-xs text-slate-400 mt-1">{desktopVariant.descriptionAr}</p>
                  <span className="text-[10px] font-mono text-purple-400/80 block mt-1">{desktopVariant.packageId}</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyVariant(desktopVariant.code);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                  currentVariantCode === desktopVariant.code
                    ? 'bg-slate-800 text-slate-400 cursor-default'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md active:scale-95'
                }`}
              >
                {currentVariantCode === desktopVariant.code ? 'النسخة الحالية' : 'تشغيل نسخة الكمبيوتر'}
              </button>
            </div>
          </div>

          {/* Master All-In-One */}
          <div className="space-y-3 pt-2">
            <div
              onClick={() => setSelectedVariant(masterVariant.code)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col md:flex-row items-center justify-between gap-4 ${
                currentVariantCode === masterVariant.code 
                  ? 'bg-slate-950 border-amber-500 shadow-lg shadow-amber-500/10' 
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/70'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl border ${masterVariant.badgeColor}`}>
                  <Crown className="w-8 h-8 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-amber-400">{masterVariant.editionNumber}</span>
                    {currentVariantCode === masterVariant.code && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                        النسخة الشاملة النشطة
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-white">{masterVariant.titleAr}</h4>
                  <p className="text-xs text-slate-400 mt-1">{masterVariant.descriptionAr}</p>
                  <span className="text-[10px] font-mono text-amber-400/80 block mt-1">{masterVariant.packageId}</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyVariant(masterVariant.code);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                  currentVariantCode === masterVariant.code
                    ? 'bg-slate-800 text-slate-400 cursor-default'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black shadow-md active:scale-95'
                }`}
              >
                {currentVariantCode === masterVariant.code ? 'النسخة الحالية' : 'تشغيل النسخة الشاملة للمالك'}
              </button>
            </div>
          </div>

        </div>

        {/* Footer info & APK Info */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>تم تقليص وهيكلة سكريبات البناء إلى 3 حزم رسمية (2 APK + 1 EXE) بنجاح</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
}
