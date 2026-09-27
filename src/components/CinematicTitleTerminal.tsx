import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const labelTranslations: Record<string, { en: string; ar: string }> = {
  'لوحة التحكم الرئيسية': { ar: 'لوحة التحكم الرئيسية', en: 'CORE CONTROLLER DASHBOARD' },
  'المبيعات': { ar: 'كاشير التجزئة', en: 'RETAIL POS ENGINE' },
  'كاشير التجزئة': { ar: 'كاشير التجزئة', en: 'RETAIL POS ENGINE' },
  'الصيانة والورشة': { ar: 'الصيانة والورشة', en: 'MAINTENANCE TERMINAL' },
  'مركز الصيانة والورشة': { ar: 'الصيانة والورشة', en: 'MAINTENANCE TERMINAL' },
  'مبيعات الجملة': { ar: 'مبيعات الجملة', en: 'WHOLESALE POS STATION' },
  'مبيعات الجملة السريعة': { ar: 'مبيعات الجملة السريعة', en: 'WHOLESALE POS STATION' },
  'مشتريات الجملة': { ar: 'مشتريات الجملة', en: 'WHOLESALE PURCHASE STATION' },
  'مشتريات الجملة السريعة': { ar: 'مشتريات الجملة السريعة', en: 'WHOLESALE PURCHASE STATION' },
  'العمليات والعملاء': { ar: 'التجارة الذكية', en: 'CLIENT OVERVIEW CORE' },
  'التجارة الذكية': { ar: 'التجارة الذكية', en: 'SMART COMMERCE HUB' },
  'رصيد يمن موبايل': { ar: 'رصيد وباقات يمن موبايل', en: 'YEMEN MOBILE DESK' },
  'رصيد وباقات يمن موبايل': { ar: 'رصيد وباقات يمن موبايل', en: 'YEMEN MOBILE DESK' },
  'المخزون المتوفر': { ar: 'إدارة المخزن', en: 'INVENTORY CORE DATABASE' },
  'إدارة المخزن': { ar: 'إدارة المخزن', en: 'INVENTORY CORE DATABASE' },
  'ماسح الفواتير': { ar: 'ماسح الفواتير', en: 'AI INVOICE SCAN STATION' },
  'ماسح الفواتير الذكي': { ar: 'ماسح الفواتير الذكي', en: 'AI INVOICE SCAN STATION' },
  'تجهيز الطلبات': { ar: 'تجهيز المستودع', en: 'ORDER PREP SYSTEM' },
  'تجهيز المستودع 📦': { ar: 'تجهيز المستودع', en: 'WAREHOUSE PREP SYSTEM' },
  'تجهيز المستودع': { ar: 'تجهيز المستودع', en: 'WAREHOUSE PREP SYSTEM' },
  'توصيلات السائقين': { ar: 'توصيلات السائقين', en: 'DRIVER LOGISTICS DESK' },
  'النواقص والطلبيات': { ar: 'النواقص والطلبيات', en: 'SHORTAGES FORECASTER' },
  'النواقص والعجز': { ar: 'النواقص والعجز', en: 'SHORTAGES & DEFICIT' },
  'الرقابة والجرد': { ar: 'الجرد والرقابة المخزنية', en: 'INVENTORY BALANCER' },
  'الجرد والرقابة المخزنية': { ar: 'الجرد والرقابة المخزنية', en: 'INVENTORY AUDIT & BALANCE' },
  'التالف والفاقد': { ar: 'التالف والفاقد', en: 'SCRAP & LOSS LOGGER' },
  'الأرشيف الرقمي': { ar: 'أرشيف الفواتير', en: 'ARCHIVE VAULT' },
  'أرشيف الفواتير 📂': { ar: 'أرشيف الفواتير', en: 'ARCHIVE INVOICE VAULT' },
  'أرشيف الفواتير': { ar: 'أرشيف الفواتير', en: 'ARCHIVE INVOICE VAULT' },
  'التقارير الشاملة 📊': { ar: 'التقارير الشاملة', en: 'COMPREHENSIVE REPORTS' },
  'التقارير الشاملة': { ar: 'التقارير الشاملة', en: 'COMPREHENSIVE REPORTS' },
  'مخزن الشرائح الذكي': { ar: 'مخزن الشرائح والبطائق', en: 'SIM QUANTUM VAULT' },
  'مخزن الشرائح والبطائق': { ar: 'مخزن الشرائح والبطائق', en: 'SIM QUANTUM VAULT' },
  'الشرائح ورصيد الباقات': { ar: 'الشرائح ورصيد الباقات', en: 'SIM CARDS & PACKAGES' },
  'الخزينة الموحدة': { ar: 'الصناديق والخزائن', en: 'CENTRAL FINANCIAL VAULT' },
  'الصناديق والخزائن': { ar: 'الصناديق والخزائن', en: 'CENTRAL FINANCIAL VAULT' },
  'الإيداعات البنكية 🏦': { ar: 'الإيداعات البنكية', en: 'BANK TRANSFERS MANAGER' },
  'الإيداعات البنكية': { ar: 'الإيداعات البنكية', en: 'BANK TRANSFERS MANAGER' },
  'تسويات الصراف والشيفتات': { ar: 'تسويات الصراف والشيفتات', en: 'CASHIER SHIFT CLOSE' },
  'أعمال الصناديق والصراف للشبكة': { ar: 'أعمال الصناديق والصراف للشبكة', en: 'CASH DETECTOR PRO' },
  'شجرة الحسابات': { ar: 'الحسابات والقيود', en: 'LEDGER TREE ENGINE' },
  'الحسابات والقيود': { ar: 'الحسابات والقيود', en: 'LEDGER TREE ENGINE' },
  'التدقيق والمحاسبة ⚖️': { ar: 'التدقيق والمحاسبة', en: 'AUDIT & SMART ACCOUNTING' },
  'التدقيق والمحاسبة': { ar: 'التدقيق والمحاسبة', en: 'AUDIT & SMART ACCOUNTING' },
  'سوق الموردين الموحد 💎': { ar: 'سوق الموردين الموحد', en: 'SUPPLIER HUB PRO' },
  'سوق الموردين الموحد': { ar: 'سوق الموردين الموحد', en: 'SUPPLIER HUB PRO' },
  'سوق الموردين 💎': { ar: 'سوق الموردين', en: 'SUPPLIER HUB PRO' },
  'سوق الموردين': { ar: 'سوق الموردين', en: 'SUPPLIER HUB PRO' },
  'الدردشة والارتباطات': { ar: 'الدردشة والتواصل', en: 'SUPPLIER CHAT SYSTEM' },
  'الدردشة والتواصل': { ar: 'الدردشة والتواصل', en: 'COMMUNICATION & CHAT' },
  'ديون العملاء': { ar: 'العملاء ومديونياتهم', en: 'CUSTOMER DEBTS LOGGER' },
  'العملاء ومديونياتهم': { ar: 'العملاء ومديونياتهم', en: 'CUSTOMERS & BALANCES' },
  'حسابات الموردين': { ar: 'الموردين ومستحقاتهم', en: 'SUPPLIER DEBTS LOGGER' },
  'الموردين ومستحقاتهم': { ar: 'الموردين ومستحقاتهم', en: 'SUPPLIERS & BALANCES' },
  'لوحة رقابة المالك': { ar: 'لوحة رقابة المالك', en: 'OWNER FORCE CONTROL' },
  'سجل النشاطات والرقابة': { ar: 'سجل النشاطات والرقابة', en: 'OWNER AUDIT & CONTROL' },
  'الاستيراد الذكي للبيانات': { ar: 'الاستيراد الذكي', en: 'SMART PARSER IMPORT' },
  'الاستيراد الذكي': { ar: 'الاستيراد الذكي', en: 'SMART PARSER IMPORT' },
  'شؤون الموظفين والصلاحيات': { ar: 'شؤون الموظفين والصلاحيات', en: 'STAFF FORCE CONTROL' },
  'عقود وحسابات المهندسين': { ar: 'عقود وحسابات المهندسين', en: 'ENGINEERS CONTRACTS & LEDGER' },
  'إدارة العروض Reels': { ar: 'إدارة العروض Reels', en: 'PROMO REELS MANAGER' },
  'سجل الدوام والحضور': { ar: 'سجل الدوام والحضور', en: 'TIME TRACK CLOCK' },
  'سجل النشاط والرقابة': { ar: 'سجل النشاط والرقابة', en: 'AUDIT LOG RUNTIME' },
  'المساعدة': { ar: 'المساعدة والتعليمات', en: 'SYSTEM MANUAL HELPDESK' },
  'المساعدة والتعليمات': { ar: 'المساعدة والتعليمات', en: 'SYSTEM MANUAL HELPDESK' },
  'الإعدادات العامة': { ar: 'الإعدادات العامة للمحل', en: 'GLOBAL CONFIG SYSTEM' },
  'الإعدادات العامة للمحل': { ar: 'الإعدادات العامة للمحل', en: 'GLOBAL CONFIG SYSTEM' },
  'لوحة التحكم للمبرمج': { ar: 'لوحة التحكم للمبرمج', en: 'ROOT SUPERADMIN TERMINAL' },
  'لوحة التحكم للمبرمج (SuperAdmin)': { ar: 'لوحة التحكم للمبرمج', en: 'ROOT SUPERADMIN TERMINAL' },
  'إدارة الطلبيات': { ar: 'إدارة الطلبيات', en: 'ORDERS DISPATCH DESK' },
  'مستودعات وورش العمل': { ar: 'مستودعات وورش العمل', en: 'WORKFORCE & WAREHOUSE' },
  'بوابة العملاء': { ar: 'بوابة العملاء VIP', en: 'VIP CUSTOMER PORTAL' },
  'النظام': { ar: 'النظام', en: 'JAM SYSTEM CORE' }
};

interface CinematicTitleTerminalProps {
  arabicLabel: string;
  shopName?: string;
  isDark?: boolean;
}

export const CinematicTitleTerminal: React.FC<CinematicTitleTerminalProps> = ({
  arabicLabel,
  shopName = 'JAM SYSTEM PRO',
  isDark = true
}) => {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [isFlipped, setIsFlipped] = useState(false);

  const matched = labelTranslations[arabicLabel] || { ar: arabicLabel, en: 'JAM SYSTEM MODULE' };

  // Periodically flip the languages to show the kinetic language morphing automatically
  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlipped((prev) => !prev);
      setTimeout(() => {
        setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
      }, 150); // Mid-flip switch to avoid ugly text popping
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Force language resetting on page label change to ensure immediate feedback
  useEffect(() => {
    setLang('ar');
    setIsFlipped(false);
  }, [arabicLabel]);

  return (
    <div className="relative self-start sm:self-auto select-none no-drag">
      {/* Dynamic Keyframe Shimmer Style Injection */}
      <style>{`
        @keyframes sweepLine {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(110%); }
          100% { transform: translateX(110%); }
        }
        .laser-shimmer-ray {
          animation: sweepLine 3.8s ease-in-out infinite;
        }
        .cinematic-ar-title {
          font-size: 18px !important;
          line-height: 1.25 !important;
        }
        .cinematic-en-title {
          font-size: 14px !important;
          line-height: 1.25 !important;
        }
        @media (min-width: 480px) {
          .cinematic-ar-title {
            font-size: 24px !important;
          }
          .cinematic-en-title {
            font-size: 18px !important;
          }
        }
        @media (min-width: 640px) {
          .cinematic-ar-title {
            font-size: 30px !important;
          }
          .cinematic-en-title {
            font-size: 22px !important;
          }
        }
        @media (min-width: 768px) {
          .cinematic-ar-title {
            font-size: 38px !important;
          }
          .cinematic-en-title {
            font-size: 28px !important;
          }
        }
      `}</style>

      {/* Sibling Metallic Glassmorphic Underlayer (For 3D depth alignment) */}
      <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-tr from-amber-600/45 to-yellow-500/25 blur-[8px] opacity-80 dark:opacity-65 pointer-events-none animate-pulse" />

      {/* The Cinematic Graphic Terminal Container Box */}
      <div 
        className={`relative w-full max-w-full sm:min-w-[340px] md:min-w-[420px] p-3.5 sm:p-6 px-4 sm:px-8 rounded-3xl overflow-hidden transition-all duration-500 border-2 ${
          isDark 
            ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-amber-500/50 shadow-[0_0_35px_rgba(245,158,11,0.25)]' 
            : 'bg-gradient-to-r from-white via-amber-50/20 to-white border-amber-600/70 shadow-[0_6px_30px_rgba(245,158,11,0.28)]'
        }`}
        style={{
          perspective: '1000px',
        }}
      >
        {/* Sleek Laser-beam swept ray */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
          <div className="laser-shimmer-ray absolute inset-y-0 w-2/3 bg-gradient-to-r from-transparent via-amber-400/35 to-transparent skew-x-12" />
        </div>

        {/* 3D Flip Animating Text Section */}
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="flex items-center gap-4 relative z-10 w-full"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="flex flex-col w-full" style={{ backfaceVisibility: 'hidden' }}>
            {lang === 'ar' ? (
              // Arabic Font Style (Corporate Premium Cairo) - Upscaled by ~15%
              <h2 className={`cinematic-ar-title font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${
                isDark ? 'from-amber-400 via-yellow-100 to-amber-600' : 'from-slate-950 via-amber-800 to-slate-950'
              } drop-shadow-[0_2px_10px_rgba(245,158,11,0.2)]`}>
                {matched.ar}
              </h2>
            ) : (
              // Futuristic Futuristic English Chrome style (Scale adjustment included to prevent wrapping) - Upscaled by ~15%
              <h2 
                className={`cinematic-en-title font-black tracking-wide uppercase font-mono text-transparent bg-clip-text bg-gradient-to-r ${
                   isDark ? 'from-yellow-400 via-white to-amber-500' : 'from-slate-950 via-neutral-900 to-amber-700'
                } drop-shadow-[0_2px_10px_rgba(245,158,11,0.2)]`}
                style={{ transform: 'rotateY(180deg)' }}
              >
                {matched.en}
              </h2>
            )}

            {/* Subtitle Station ID Line */}
            <div 
              className="flex items-center gap-2 mt-2 leading-none"
              style={{ transform: lang === 'en' ? 'rotateY(180deg)' : 'none' }}
            >
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </div>
              <p className={`text-[10px] sm:text-[11px] font-black tracking-[0.25em] leading-none uppercase ${
                isDark ? 'text-white/75' : 'text-slate-950/80'
              }`}>
                {shopName}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
