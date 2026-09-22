import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Sparkles, 
  Cpu, 
  Database, 
  WifiOff, 
  Layers, 
  Printer, 
  Zap, 
  Award, 
  PhoneCall, 
  CheckCircle2, 
  Globe, 
  Lock, 
  Smartphone,
  BarChart4,
  Boxes,
  Users
} from 'lucide-react';
import { MERCHANT_LOGO, CUSTOMER_LOGO } from '../constants/assets';

interface AboutSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  currentStoreName?: string;
}

export default function AboutSystemModal({
  isOpen,
  onClose,
  isDark = true,
  currentStoreName
}: AboutSystemModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'security' | 'developer'>('overview');

  if (!isOpen) return null;

  const resolvedStoreName = currentStoreName || localStorage.getItem('jam_last_logged_in_shop_name') || 'منظومتكم التجارية';

  return (
    <div 
      id="jam-about-system-modal-backdrop"
      dir="rtl"
      className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div 
        id="jam-about-system-modal-card"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
          isDark 
            ? 'bg-gradient-to-b from-[#0c1424] via-[#070b14] to-[#03060c] border-[#d4af37]/40 text-white' 
            : 'bg-white border-amber-300 text-slate-900'
        }`}
      >
        {/* Header Bar */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-lg flex items-center justify-center">
              <img 
                src={MERCHANT_LOGO} 
                alt="System Logo" 
                className="w-full h-full object-contain rounded-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
                نظام {resolvedStoreName} الذكي
              </h2>
              <p className="text-[11px] text-gray-400 font-medium">
                المنظومة السحابية والمحلية المتكاملة لإدارة التجارة والمبيعات والصيانة
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className={`p-2 rounded-xl transition active:scale-90 cursor-pointer ${
              isDark ? 'bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400' : 'bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600'
            }`}
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className={`grid grid-cols-4 gap-1 p-2 border-b ${
          isDark ? 'border-white/10 bg-black/30' : 'border-slate-200 bg-slate-100/70'
        }`}>
          {[
            { id: 'overview', label: 'حقيقة المنظومة 🌟', icon: Sparkles },
            { id: 'features', label: 'القدرات والوحدات ⚙️', icon: Boxes },
            { id: 'security', label: 'الأمان والعمل دون نت 🛡️', icon: ShieldCheck },
            { id: 'developer', label: 'المطور والاعتماد 👨‍💻', icon: Award },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 sm:px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md scale-102' 
                    : isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-sm leading-relaxed">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                  <Zap size={18} />
                  <span>ما هي المنظومة الحقيقية؟</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-300">
                  منظومة <strong className="text-amber-300">{resolvedStoreName}</strong> هي منصة تخطيط وإدارة موارد تجارية وصناعية ذكية (ERP) متكاملة ومصممة بأحدث تقنيات الويب والأجهزة المحمولة السريعة، تدمج بين العمل السحابي الفوري والعمل المحلي المنفصل بنسبة 100% دون انقطاع.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                    <Cpu size={16} />
                    <span>هندسة هجينة متعددة المنصات</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    تعمل كـ تطبيق أندرويد أصلي (APK)، وتطبيق كمبيوتر وسطح مكتب (Windows EXE)، وبوابة ويب سحابية، مع تناسق كامل في البيانات والتصميم.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <WifiOff size={16} />
                    <span>محرك الـ 0ms والعمل دون إنترنت</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    لا يتوقف البيع أو الصيانة عند انقطاع الإنترنت نهائياً. يتم حفظ الحركات محلياً في خزانة آمنة وتصديرها ومزامنتها فور عودة الشبكة تلقائياً.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                    <Printer size={16} />
                    <span>الطباعة الحرارية والبلوتوث</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    دعم مباشر لكافة طابعات الفواتير والكروت الحرارية عبر البلوتوث والواي فاي والـ USB مع قوالب تنسيق احترافية واضحة وموزونة.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <BarChart4 size={16} />
                    <span>محرك التقارير وميزان المراجعة</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    تقارير تفصيلية للأرباح، الميزانيات، جرد المخزون، وحسابات الكاشير والمهندسين، تصدر لـ PDF وإكسل بصفوف وأعمدة واسعة ومريحة للعين.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider">
                الوحدات التشغيلية المعتمدة في النظام
              </h3>

              <div className="space-y-2.5">
                {[
                  { title: 'نقطة البيع والكاشير المتقدم (POS)', desc: 'بيع سريع بالباركود، خصومات مخصصة، دفع نقدي وآجل وتحويل، وإصدار فواتير ذكية.', tag: 'سريع وفوري' },
                  { title: 'ورشة وهندسة الصيانة المتكاملة', desc: 'إدارة كروت الأجهزة، تتبع مسار الصيانة (مستلم، فحص، جاهز، تسليم)، مع حساب أجور اليد وقطع الغيار بدقة.', tag: 'أرشفة شاملة' },
                  { title: 'إدارة المخازن والجرد والباركود', desc: 'توليد وطباعة الباركود، رصد هوامش الربح، كشف النواقص، إدارة التوالف، وجرد متعدد الصناديق.', tag: 'حماية المخزون' },
                  { title: 'الحسابات والمصارف والصناديق (Vaults)', desc: 'متابعة حركة النقدية، السندات، الحوالات، ديون العملاء، مستحقات الموردين، وإقفال اليوميات والورديات.', tag: 'دقة محاسبية' },
                  { title: 'بوابة الزبائن وخدمات المواطنين (Store pro)', desc: 'تطبيق مخصص للزبائن لمتابعة عروض المتجر، فحص كروت الصيانة، ومعرفة الرصيد والديون بنقرة واحدة.', tag: 'خدمة العملاء' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                        <span className="text-xs font-black text-white">{item.title}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 pr-5">{item.desc}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 shrink-0">
                      {item.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & OFFLINE */}
          {activeTab === 'security' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Lock size={16} />
                  <span>تشفير البيانات وحماية الصلاحيات</span>
                </div>
                <p className="text-xs text-gray-300">
                  جميع العمليات الحساسة، الصناديق، والأرباح محمية بنظام صلاحيات صارم (أدوار: مالك، مدير، كاشير، مهندس صيانة) يمنع التلاعب أو حذف السجلات المعتمدة.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1.5">
                  <span className="text-xs font-bold text-[#d4af37]">خزائن النسخ الاحتياطي التلقائي</span>
                  <p className="text-[11px] text-gray-400">
                    يتم إنشاء نسخ احتياطية دورية محلياً وسحابياً لضمان عدم ضياع أي فاتورة أو حركة مالية حتى في أصعب الظروف.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1.5">
                  <span className="text-xs font-bold text-[#d4af37]">عزل تام لبيانات المتجر</span>
                  <p className="text-[11px] text-gray-400">
                    بيانات كل متجر وحساباته مشفرة ومفصولة كلياً ولا يمكن لأي طرف خارجي الاطلاع عليها.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DEVELOPER & CONTACT */}
          {activeTab === 'developer' && (
            <div className="space-y-5 animate-in fade-in duration-200 text-center sm:text-right">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border border-amber-500/30 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 flex items-center justify-center shrink-0 shadow-xl">
                  <div className="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center text-amber-400">
                    <Award size={30} />
                  </div>
                </div>
                <div className="space-y-1 text-center sm:text-right">
                  <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/40 mb-1">
                    الإشراف الفني والهندسي المعتمد
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    المهندس / عبدالغني المحفلي
                  </h3>
                  <p className="text-xs text-gray-400 font-medium">
                    مهندس ومطور المنظومات التجارية والحلول التقنية الذكية
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <PhoneCall size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold">هاتف الدعم والتطوير المباشر</span>
                    <span className="text-sm font-black text-emerald-300 font-mono" dir="ltr">+967 772315106</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400">
                    <Globe size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold">حالة النظام والترخيص</span>
                    <span className="text-xs font-black text-sky-300">نسخة معتمدة v2.8.7 (2026) 🟢</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className={`px-6 py-3.5 border-t flex items-center justify-between text-xs ${
          isDark ? 'border-white/10 bg-black/40 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}>
          <span className="text-[11px]">
            نظام <strong className="text-amber-400">{resolvedStoreName}</strong> - جميع الحقوق محفوظة © 2026
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow transition active:scale-95 cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
}
