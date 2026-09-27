import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, BookOpen, ChevronLeft, ChevronRight, HelpCircle, 
  Sparkles, Layers, Briefcase, Phone, Store, MapPin, 
  Award, Clock, CheckCircle, Info, ChevronDown, Wrench, 
  Database, Landmark, ShoppingCart, MessageCircle, AlertCircle
} from 'lucide-react';
import { UserProfile } from '../types';

interface OnboardingGuideProps {
  profile: UserProfile | null;
}

interface Step {
  title: string;
  icon: any;
  content: string;
  tips: string[];
}

export default function OnboardingGuide({ profile }: OnboardingGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeRemainingText, setTimeRemainingText] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // Determine registration/trial date
    let regDate: Date | null = null;
    if (profile.trialStartDate) {
      regDate = profile.trialStartDate.toDate ? profile.trialStartDate.toDate() : new Date(profile.trialStartDate);
    } else if (profile.joinDate) {
      regDate = profile.joinDate.toDate ? profile.joinDate.toDate() : new Date(profile.joinDate);
    } else if (profile.lastRegistrationDate) {
      regDate = profile.lastRegistrationDate.toDate ? profile.lastRegistrationDate.toDate() : new Date(profile.lastRegistrationDate);
    }

    if (!regDate) {
      // If no registration date is found, we assume a newly created account for compatibility or fallback to current time
      regDate = new Date();
    }

    // 48 hours in milliseconds
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
    
    const updateCountdown = () => {
      const now = new Date();
      const elapsed = now.getTime() - regDate!.getTime();
      const remaining = FORTY_EIGHT_HOURS - elapsed;

      // Check if user has manually dismissed this guide forever
      const isDismissed = localStorage.getItem(`jam_pro_onboarding_dismissed_${profile.uid}`) === 'true';

      if (remaining <= 0 || isDismissed) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
        // Calculate remaining hours and minutes
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        setTimeRemainingText(`نشط للمساعدة الفورية: متبقي ${hours} ساعة و ${minutes} دقيقة ⏳`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [profile]);

  // Handle manual permanent close
  const handleDismissForever = () => {
    if (profile?.uid) {
      localStorage.setItem(`jam_pro_onboarding_dismissed_${profile.uid}`, 'true');
    }
    setIsVisible(false);
  };

  // Returned null per user request to delete the bottom floating AI button ("ذكاء") and 2-day countdown timer
  return null;

  // Translate business level and trade type to user friendly texts
  const getBusinessLevelLabel = (level?: string) => {
    switch (level) {
      case 'importer': return 'مستورد 🚢';
      case 'mega_wholesale': return 'جملة الجملة 🏭';
      case 'wholesale': return 'تاجر جملة 📦';
      case 'retailer': return 'تجزئة (محل صيانة ومبيعات) 🏪';
      default: return 'صاحب محل تجاري 🏪';
    }
  };

  const getTradeTypeLabel = (type?: string) => {
    switch (type) {
      case 'mobiles': return 'تجارة الجوالات 📱';
      case 'parts': return 'قطع غيار الجوالات والصيانة 🛠️';
      case 'accessories': return 'الإكسسوارات والملحقات 🔌';
      case 'all': return 'الكل (جوالات، قطع، إكسسوارات) 🌟';
      default: return 'تجارة عامة 📱';
    }
  };

  // Get current pathname to provide contextual interactive tips
  const currentPath = window.location.pathname;
  
  // Custom context content depending on the current page
  const getContextualTip = () => {
    if (currentPath === '/sales') {
      return {
        title: '💡 أنت الآن في واجهة المبيعات والمحاسبة الفورية',
        icon: <ShoppingCart className="text-green-400 w-5 h-5 shrink-0" />,
        tips: [
          'يمكنك تمرير الباركود مباشرة بالماسح الضوئي لتنزيل الموديل تلقائياً في السلة.',
          'اختر العميل لتسجيل المبيعات بالآجل (الديون) وحفظها فورياً في كشف حسابه.',
          'اضغط على زر الفاتورة السريعة لتوليد فاتورة حرارية للطباعة بنقرة واحدة.'
        ]
      };
    }
    if (currentPath === '/inventory') {
      return {
        title: '💡 أنت الآن في واجهة المخزون وإدارة السلع',
        icon: <Database className="text-amber-400 w-5 h-5 shrink-0" />,
        tips: [
          'يمكنك إضافة سلع جديدة، وتحديد سعر الشراء، سعر الجملة، وسعر التجزئة.',
          'استخدم محرك الباركود لتوليد ملصقات باركود مخصصة لمنتجاتك التي لا تحتوي على باركود.',
          'انتبه لحد الطلب (الحد الأدنى) ليقوم النظام بتنبيهك تلقائياً في صفحة النواقص.'
        ]
      };
    }
    if (currentPath === '/maintenance') {
      return {
        title: '💡 أنت الآن في واجهة الصيانة والورشة المتقدمة',
        icon: <Wrench className="text-orange-400 w-5 h-5 shrink-0" />,
        tips: [
          'سجل الأجهزة المستلمة من الزبائن، واكتب العطل، والرمز السري، والملحقات بدقة.',
          'يمكنك تعيين كرت الصيانة لمهندس معين وتتبع تقدم الصيانة خطوة بخطوة.',
          'عند الانتهاء، سيقوم النظام باحتساب قيمة قطع الغيار وتكلفة اليد وحساب الأرباح الصافية.'
        ]
      };
    }
    if (currentPath === '/accounts' || currentPath === '/finances') {
      return {
        title: '💡 أنت الآن في الإدارة المالية وميزان المراجعة الذكي',
        icon: <Landmark className="text-blue-400 w-5 h-5 shrink-0" />,
        tips: [
          'هنا تدار الصناديق والتحويلات المالية المتبادلة بين الصرافين والشركاء.',
          'تأكد من تسوية الخزينة بشكل يومي لضمان دقة التقارير والأرباح والخسائر.',
          'يمكنك فحص ميزان المراجعة بالأرصدة لمطابقة الأرقام وضمان عدم وجود فوارق نقدية.'
        ]
      };
    }
    return {
      title: '💡 نصيحة سريعة للتنقل داخل المنظومة الموحدة',
      icon: <HelpCircle className="text-sky-400 w-5 h-5 shrink-0" />,
      tips: [
        'استخدم القائمة الجانبية (Sidebar) للتنقل السلس بين الأقسام المختلفة من جوالك أو حاسوبك.',
        'يمكنك استخدام الاختصارات السريعة لفتح النوافذ بلمسة واحدة دون عناء البحث.',
        'فريق الدعم الفني والمبرمج م. عبد الغني المحفلي متواجد دائماً لخدمتكم على الرقم 772315106.'
      ]
    };
  };

  const contextualInfo = getContextualTip();

  const steps: Step[] = [
    {
      title: 'مرحبًا بك في نظامك الجديد 🌸',
      icon: Award,
      content: `مرحباً بك يا ${profile.name || 'التاجر العزيز'}! لقد قمنا بتهيئة وتخصيص نسختك البرمجية لتناسب مستوى عملك المختار كـ (${getBusinessLevelLabel(profile.businessLevel)}) في مجال (${getTradeTypeLabel(profile.tradeType)}). سنرافقك خطوة بخطوة لضمان استمتاعك بتجربة مريحة وخالية من التعقيد.`,
      tips: [
        `مستوى عملك الحالي: ${getBusinessLevelLabel(profile.businessLevel)} بصلاحيات متكاملة.`,
        `نوع تجارتك: ${getTradeTypeLabel(profile.tradeType)} لتسهيل البحث وتهيئة السلع.`,
        'تم منحك رخصة تجريبية كاملة مجانية لمدة شهر واحد للاستفادة من كافة الخصائص.',
      ]
    },
    {
      title: 'إدارة مبيعاتك وأرباحك اليومية 💰',
      icon: ShoppingCart,
      content: 'تعتبر واجهة المبيعات والـ POS النبض الحقيقي لمحلك. من هنا يمكنك القيام بجميع عمليات البيع كاش، شبكة، أو بالآجل لزبائنك مع كروت الضمان والطباعة المباشرة.',
      tips: [
        'أدخل الباركود أو ابحث عن السلعة بالاسم لإضافتها فوراً لسلة المبيعات.',
        'عند اختيار دفع آجل، سيسأل النظام عن اسم العميل ليقوم بتقييد الديون وتحديث كشف حسابه تلقائياً.',
        'تأكد من مراجعة ملخص صندوقك اليومي لمعرفة صافي الأرباح الواردة لكل وردية.'
      ]
    },
    {
      title: 'التحكم بالمخازن والسلع والنواقص 📦',
      icon: Database,
      content: 'محرك المخزون الذكي يحميك من الخسارة وينبهك قبل نفاد البضاعة. قمنا بتخصيص تصنيفات السلع الافتراضية لتلائم نوع تجارتك فوراً.',
      tips: [
        'تتبع حركة السلعة: سعر التكلفة، سعر الجملة، وسعر التجزئة والكمية المتبقية في الرف.',
        'تنبيهات النواقص: أي صنف يقل عن الحد الأدنى سيظهر تلقائياً في شاشة النواقص لتجهيز طلبية جديدة.',
        'مزامنة الكلاود: مخزونك آمن ومحمي بنظام حفظ سحابي مكرر لمقاومة الكوارث وعمليات الحذف غير المصرحة.'
      ]
    },
    {
      title: 'إدارة الصناديق والديون والحسابات ⚖️',
      icon: Landmark,
      content: 'المنظومة المالية المتكاملة توفر لك شجرة حسابات محاسبية حقيقية مدمجة، لإدارة النقدية داخل الخزائن، حسابات الموردين والدائنين، ومطابقة الصرافين.',
      tips: [
        'أضف الموردين والشركاء وقم بتسجيل الدفعات المسددة لهم والمستحقة عليهم بدقة.',
        'استخدم الصناديق المنفصلة (الخزنة الرئيسية، الصراف، الحساب البنكي) للتنظيم وسهولة التسوية.',
        'افحص ميزان المراجعة والأرباح والخسائر شهرياً لتقييم نمو رأس مالك ونشاطك التجاري.'
      ]
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsOpen(false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const ActiveIcon = steps[currentStep].icon;

  return (
    <>
      {/* Mini Floating Teacher Badge in Bottom Left Corner */}
      <div className="fixed bottom-4 left-4 z-[90] flex flex-col items-end gap-2 text-right">
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex flex-col items-end"
            >
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="relative group flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-black font-black rounded-2xl shadow-[0_10px_30px_rgba(245,158,11,0.4)] border-2 border-white/25 hover:scale-105 active:scale-95 transition-all cursor-pointer select-none"
                id="floating-onboarding-btn"
              >
                <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full border border-white animate-pulse" />
                <span className="text-xs">ذكاء 🧠</span>
                <BookOpen size={16} className="animate-bounce" />
              </button>
              
              {/* Contextual tiny indicator */}
              <div className="bg-[#0b0f19]/90 backdrop-blur-md border border-yellow-500/20 text-[10px] text-yellow-400 font-bold px-2 py-1 rounded-lg shadow-md mt-1 shrink-0 max-w-[200px] leading-tight select-none">
                {timeRemainingText.split('⏳')[0]} ⏳
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Guide Main Modal Window */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative w-full max-w-xl bg-gradient-to-b from-[#161b2e] via-[#0b0f19] to-[#04060c] rounded-[2.5rem] shadow-2xl overflow-hidden border-2 border-yellow-500/30 my-8 text-right"
            >
              {/* High-Contrast Top Golden Border */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600" />

              {/* Main Container */}
              <div className="p-6 sm:p-8">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                      title="إغلاق مؤقت"
                    >
                      <X size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissForever}
                      className="text-[10px] font-black text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg border border-red-500/25 transition-all cursor-pointer"
                      title="إنهاء الدليل وإخفاؤه تماماً"
                    >
                      إغلاق نهائي 🗑️
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-sm font-black text-yellow-400">مرشد التوجيه التفاعلي الذكي</span>
                      <Sparkles size={16} className="text-yellow-400 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-black text-white">المعلّم الذكي JAM AI</h3>
                  </div>
                </div>

                {/* Info Text Alert about remaining active hours */}
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 mb-5 flex items-center justify-between text-right">
                  <span className="text-[10px] font-bold text-gray-400">
                    * يختفي الدليل تلقائياً بعد مرور 48 ساعة على تسجيلك.
                  </span>
                  <span className="text-[11px] font-black text-yellow-400 tabular-nums">
                    {timeRemainingText}
                  </span>
                </div>

                {/* Dynamically Loaded Interactive Tips for Current Page */}
                <div className="bg-gradient-to-l from-indigo-500/10 to-transparent border-r-4 border-indigo-500 rounded-r-xl rounded-l-md p-4 mb-5 text-right space-y-2">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs font-black text-white">{contextualInfo.title}</span>
                    {contextualInfo.icon}
                  </div>
                  <ul className="space-y-1.5">
                    {contextualInfo.tips.map((tip, idx) => (
                      <li key={idx} className="text-[11px] font-semibold text-gray-300 flex items-start gap-1 justify-end">
                        <span>{tip}</span>
                        <span className="text-indigo-400 shrink-0 font-bold">▪</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Step Content Card */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-5 mb-6 space-y-4">
                  <div className="flex items-center gap-3 justify-end">
                    <span className="text-base font-black text-white">{steps[currentStep].title}</span>
                    <div className="w-10 h-10 bg-yellow-400/10 text-yellow-400 rounded-xl flex items-center justify-center border border-yellow-400/20">
                      <ActiveIcon size={20} />
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-gray-300 font-bold">
                    {steps[currentStep].content}
                  </p>

                  <div className="border-t border-white/5 pt-4">
                    <h4 className="text-[11px] font-black text-yellow-400 uppercase tracking-wider mb-2">تعليمات هامة لحسابك:</h4>
                    <ul className="space-y-2">
                      {steps[currentStep].tips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-2 justify-end text-right">
                          <span className="text-[11px] font-semibold text-gray-400 leading-normal">{tip}</span>
                          <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Navigation Dots and Buttons */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-5 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:brightness-110 active:scale-95 text-black font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-lg"
                  >
                    <span>{currentStep === steps.length - 1 ? 'مفهوم، إنهاء' : 'التالي'}</span>
                    <ChevronLeft size={16} />
                  </button>

                  {/* Step dots */}
                  <div className="flex gap-1.5">
                    {steps.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentStep(idx)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${idx === currentStep ? 'w-6 bg-yellow-400' : 'w-2 bg-white/20'}`}
                        title={`خطوة ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={currentStep === 0}
                    onClick={handlePrev}
                    className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:pointer-events-none font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ChevronRight size={16} />
                    <span>السابق</span>
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
