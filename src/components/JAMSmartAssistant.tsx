import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  HelpCircle, 
  Compass, 
  Eye, 
  BookOpen, 
  ArrowLeft, 
  Search, 
  X, 
  Info, 
  ChevronRight, 
  MapPin,
  HelpCircle as HelpIcon,
  MousePointer,
  ChevronLeft,
  MousePointerClick
} from 'lucide-react';

// قاعدة بيانات المساعد الذكي لكل الصفحات والأزرار
export const PAGE_GUIDES: Record<string, {
  title: string;
  desc: string;
  steps: string[];
  tips: string[];
  buttons: Record<string, string>;
}> = {
  '/dashboard': {
    title: 'لوحة التحكم الرئيسية',
    desc: 'المركز القيادي للمحل. يعرض إحصائيات الأداء المالي، المبيعات النشطة، وحالة الصناديق في الوقت الفعلي.',
    steps: [
      'راقب الأرباح والمبيعات اليومية من البطاقات العلوية الملونة.',
      'راجع حركة الخزائن والمحافظ الإلكترونية للتأكد من مطابقة الأرصدة.',
      'تابع المبيعات الأخيرة وجدول النشاط للتأكد من سلامة العمليات.'
    ],
    tips: [
      'انقر على بطاقات الأرصدة للانتقال السريع لقسم المالية والمطابقة.',
      'استخدم التحديث الفوري أعلى الشاشة لتحديث الإحصائيات المالية.'
    ],
    buttons: {
      'تحديث': 'تحديث فوري لجميع الإحصائيات والأرصدة من قاعدة البيانات مباشرة.',
      'إغلاق اليومية': 'إقفال حسابات اليوم وترحيل الأرصدة مع طباعة التقرير الختامي لليوم.',
      'فلترة': 'تصفية الإحصائيات لفترة زمنية محددة (اليوم، أمس، هذا الأسبوع، هذا الشهر).'
    }
  },
  '/sales': {
    title: 'نقطة المبيعات (كاشير التجزئة)',
    desc: 'واجهة البيع السريع لعملاء التجزئة. تتيح لك قراءة الباركود، إدارة السلة، وتطبيق الخصومات وطرق الدفع المتعددة.',
    steps: [
      'أضف المنتجات للسلة عن طريق تمرير الباركود أو البحث بالاسم.',
      'عدل كمية المنتجات بالضغط على أزرار (+) و (-) داخل السلة.',
      'اختر طريقة الدفع (نقدي، شبكة، كاش، آجل) ثم انقر على "إتمام البيع والتسديد".'
    ],
    tips: [
      'اضغط على زر "تعليق الفاتورة" لحفظ السلة مؤقتاً وخدمة عميل آخر دون فقدان البيانات.',
      'يمكنك تغيير عرض السلة (قياسي، متوازن، عريض) باستخدام أزرار التحكم لتوسيع مساحة العمل.'
    ],
    buttons: {
      'تعليق': 'حفظ الفاتورة الحالية في قائمة الانتظار لخدمة زبون آخر مؤقتاً.',
      'الفواتير المعلقة': 'استعراض الفواتير التي تم تعليقها سابقاً لاستكمالها وإتمامها.',
      'إلغاء الفاتورة': 'تفريغ السلة بالكامل وإلغاء عملية البيع الحالية.',
      'مسح الباركود': 'تفعيل كاميرا الهاتف لمسح باركود المنتجات وإضافتها تلقائياً.',
      'تسجيل زبون': 'ربط الفاتورة الحالية باسم زبون مسجل لتوثيق الديون أو النقاط.',
      'دفع نقدي': 'إتمام الفاتورة فوراً كدفع كاش ونقدي.',
      'دفع شبكة': 'إتمام الفاتورة واحتسابها كمدفوعات شبكة/بطاقة مدى.'
    }
  },
  '/wholesale-pos': {
    title: 'مبيعات الجملة السريعة',
    desc: 'شاشة بيع الجملة المخصصة للكميات الكبيرة والتجار. تتميز بجدول سلع مرن وخيارات تسعير الجملة والدفع الآجل المتطور.',
    steps: [
      'اختر العميل (تاجر الجملة) لتطبيق الخصم والأسعار المخصصة له.',
      'أدخل الباركود أو اختر الصنف لتنزيله في جدول الكميات مباشرة.',
      'أدخل الكميات والوحدات (كرتون، علبة، حبة) وسجل الخصم الإجمالي إن وجد.'
    ],
    tips: [
      'استخدم زر "عرض عريض" لتوسيع مساحة جدول السلع ورؤية تفاصيل الأسعار بشكل أفضل.',
      'تأكد من مطابقة السعر الخاص بالتاجر من خلال عمود فئة السعر.'
    ],
    buttons: {
      'حفظ مسودة': 'حفظ الطلبية كمسودة غير مرحلة لمراجعتها لاحقاً مع العميل.',
      'تأكيد وترحيل': 'اعتماد الفاتورة نهائياً، خصم الكميات من المستودع، وترحيل المبالغ للصناديق.',
      'طباعة الفاتورة': 'طباعة فاتورة الجملة بصيغة حرارية أو قياس A4 مخصص للشركات.',
      'إضافة صنف': 'إدراج صنف مخصص سريع غير مسجل بالمخزن للفاتورة مباشرة.'
    }
  },
  '/wholesale-purchases': {
    title: 'مشتريات الجملة السريعة',
    desc: 'تسجيل البضائع الواردة من الموردين وتغذية المخزون بالكميات الجديدة، مع تحديث أسعار الشراء والبيع والربط بالصناديق المخصصة.',
    steps: [
      'اختر المورد الذي اشتريت منه السلع.',
      'أضف المنتجات المشتراة وحدد الكمية الواردة وتكلفة الشراء.',
      'حدد الصندوق المالي الذي تم الدفع منه أو اختر الدفع الآجل للمورد.'
    ],
    tips: [
      'سجل تكلفة الشراء بدقة ليقوم النظام باحتساب متوسط سعر التكلفة وصافي الأرباح التقديرية.',
      'يمكنك عمل استيراد ذكي لفاتورة المشتريات لتوفير الوقت.'
    ],
    buttons: {
      'اعتماد الشراء': 'ترحيل الفاتورة وتغذية المخزن بالكميات فوراً وزيادة مديونية المورد.',
      'إدخال باركود جديد': 'إنشاء باركود جديد سريع للصنف في حال كان يفتقد للباركود الدولي.'
    }
  },
  '/inventory': {
    title: 'المخزون المتوفر والسلع',
    desc: 'مستودع السلع المركزي. يتيح لك إضافة المنتجات، طباعة الباركود، مراجعة تواريخ الصلاحية، وتعديل مستويات التنبيه.',
    steps: [
      'استخدم شريط البحث للعثور على أي منتج بالاسم أو الباركود.',
      'انقر على "إضافة منتج جديد" لتعريف صنف جديد ببياناته وسعره وتكلفته.',
      'اضغط على رمز الباركود لطباعة ملصقات الأسعار المخصصة للملصقات.'
    ],
    tips: [
      'احرص على ملء حقل "الحد الأدنى للمخزون" لكي يرسل لك النظام تنبيهاً عند قرب نفاد السلعة.',
      'انقر على الصنف لتعديل أسعار التجزئة والجملة وسعر التكلفة فوراً.'
    ],
    buttons: {
      'إضافة منتج': 'فتح نموذج إضافة منتج جديد مع الباركود وتصنيف القسم والصورة والتكلفة.',
      'تصدير Excel': 'تحميل قائمة المنتجات والمخزون بالكامل كملف Excel بضغطة واحدة.',
      'طباعة الباركود': 'فتح نافذة طباعة ملصق الباركود المخصص للصنف المحدد.',
      'تعديل سريع': 'تعديل السعر والكمية المتاحة مباشرة دون الدخول لصفحة تعديل الصنف الكلية.'
    }
  },
  '/finances': {
    title: 'إدارة الصناديق والأرصدة',
    desc: 'المركز المالي للمؤسسة. يراقب النقدية بالصناديق، الأرصدة البنكية، والمحافظ الإلكترونية، مع إمكانية تحويل المبالغ بينها.',
    steps: [
      'تأكد من مطابقة الأرصدة المعروضة مع النقد الفعلي المتوفر بالصندوق.',
      'استخدم زر "تحويل مالي" لنقل المبالغ بين الصناديق أو سحب الإيداعات.',
      'راجع جدول العمليات للتأكد من تدوين جميع الحركات المالية بشكل سليم.'
    ],
    tips: [
      'استخدم الصناديق الفرعية لفصل عهد الموظفين عن الصندوق الرئيسي للمحل لتسهيل المطابقة اليومية.',
      'يدعم النظام التحويل السريع للمحافظ مثل كريمي وبوسي وكاش.'
    ],
    buttons: {
      'إيداع': 'إضافة مبلغ مالي كاستثمار رأس مال أو دفعة خارجية للصندوق المالي المختار.',
      'سحب مالي': 'تسجيل سحب نقدي للمصروفات، الإيجارات، أو الأرباح من الصندوق المحدد.',
      'تحويل مالي': 'نقل رصيد مالي من صندوق أو محفظة إلى صندوق أو محفظة أخرى مع تدوين القيد.'
    }
  },
  '/accounts': {
    title: 'المنظومة المحاسبية المتكاملة',
    desc: 'النظام المحاسبي الاحترافي. يحتوي على شجرة الحسابات (الأصول، الخصوم، الإيرادات، المصروفات) والقيود اليومية التلقائية وميزان المراجعة.',
    steps: [
      'راجع شجرة الحسابات وهيكل الحسابات المعتمد.',
      'انقر على "إضافة قيد يدوي" لإدخال قيد محاسبي مزدوج (مدين ودائن) للحالات الخاصة.',
      'استعرض ميزان المراجعة وقائمة الأرباح والخسائر لمراقبة الموقف المالي.'
    ],
    tips: [
      'كل مبيعات وفواتير ومشتريات النظام تقوم بتوليد قيود محاسبية تلقائية في الخلفية دون تدخل منك.',
      'لا تقم بتعديل القيود التلقائية إلا تحت إشراف المحاسب المعتمد لضمان توازن الدفاتر.'
    ],
    buttons: {
      'إضافة حساب': 'إدراج حساب فرعي جديد داخل شجرة الحسابات (مثال: مصروفات الكهرباء).',
      'قيد جديد': 'إنشاء قيد محاسبي يدوي مزدوج الطرفين وتحديد مركز التكلفة والبيان.'
    }
  },
  '/maintenance': {
    title: 'مركز الصيانة والورشة',
    desc: 'إدارة ورشة صيانة الهواتف والأجهزة الإلكترونية. تتبع استلام الأجهزة، تشخيص الأعطال، تكاليف قطع الغيار، ومراحل العمل.',
    steps: [
      'سجل جهاز صيانة جديد باسم العميل ورقمه ونوع العطل المتوقع.',
      'حدث حالة الجهاز (بانتظار الفحص، قيد التصليح، جاهز للتسليم).',
      'عند التسليم، حدد قطع الغيار المستخدمة واطبع الفاتورة النهائية للعميل.'
    ],
    tips: [
      'يمكن للعميل متابعة حالة جهازه من خلال بوابة العميل باستخدام رقم هاتفه الموثق.',
      'فصل تكلفة قطع الغيار عن تكلفة يد المهندس يضمن دقة حساب أرباح الورشة.'
    ],
    buttons: {
      'استلام جهاز': 'تسجيل كرت صيانة جديد لجهاز مستلم مع كتابة السيريال والأعطال والملحقات.',
      'تسليم وتصفية': 'اعتماد تسليم الجهاز للعميل وتحصيل التكلفة وطرح قطع الغيار من المخزن.'
    }
  }
};

// دليل الأزرار التلقائي في حال عدم توفر دليل مخصص في الصفحة
const DEFAULT_BUTTON_GUIDES: Record<string, string> = {
  'حفظ': 'حفظ وتثبيت كافة التغييرات والبيانات المدخلة في النظام.',
  'إضافة': 'إضافة عنصر أو سجل جديد في هذا القسم.',
  'تعديل': 'تعديل السجل أو البيانات المحددة حالياً.',
  'حذف': 'حذف العنصر المحدد نهائياً. يرجى الحذر!',
  'طباعة': 'إرسال المستند أو الفاتورة إلى الطابعة المتصلة بالنظام.',
  'تصدير': 'تصدير البيانات المعروضة كملف Excel مخصص.',
  'بحث': 'شريط البحث للوصول السريع للعناصر بواسطة الاسم أو الرمز.',
  'تصفية': 'تنقية وفلترة البيانات بناءً على معايير يحددها المستخدم.',
  'إغلاق': 'إغلاق النافذة الحالية والعودة للشاشة السابقة.'
};

export default function JAMSmartAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [sidebarGuide, setSidebarGuide] = useState(() => {
    return localStorage.getItem('jam_sidebar_guide_active') === 'true';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const [hoveredElementInfo, setHoveredElementInfo] = useState<string | null>(null);
  const [hoveredCoords, setHoveredCoords] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Listen to toggle event from JamFloatingActionDock
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      const forceOpen = customEvent.detail?.open;
      if (forceOpen === true) {
        setIsOpen(true);
      } else if (forceOpen === false) {
        setIsOpen(false);
      } else {
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('toggle-jam-assistant', handleToggle);
    return () => window.removeEventListener('toggle-jam-assistant', handleToggle);
  }, []);

  // Sync state change back to dock if closed
  useEffect(() => {
    if (!isOpen) {
      window.dispatchEvent(new CustomEvent('jam-tool-closed', { detail: { tool: 'assistant' } }));
    }
  }, [isOpen]);

  // حفظ وضع إرشادات القائمة
  useEffect(() => {
    localStorage.setItem('jam_sidebar_guide_active', sidebarGuide ? 'true' : 'false');
    // إطلاق حدث مخصص لإعلام Layout.tsx بالتحديث
    window.dispatchEvent(new Event('jam_sidebar_guide_changed'));
  }, [sidebarGuide]);

  // تتبع الصفحة الحالية وإرشادها
  const currentPath = location.pathname;
  const pageGuide = PAGE_GUIDES[currentPath] || {
    title: 'شاشة النظام الحالية',
    desc: 'هذه الشاشة جزء من منظومة JAM الذكية لإدارة المحلات والمستودعات والتجارة الإلكترونية المتكاملة.',
    steps: [
      'تصفح الأدوات المتاحة في هذه الصفحة لإنجاز مهامك اليومية.',
      'استخدم البحث السريع للوصول السريع للمعلومات والأصناف.',
      'في حال واجهت أي صعوبة، انقر على المساعدة لفتح الدليل الكامل.'
    ],
    tips: [
      'تأكد من مزامنة فواتيرك بشكل دوري لضمان سلامة الدفاتر المالية.',
      'استخدم الاختصارات السريعة للتنقل بمرونة أكبر.'
    ],
    buttons: {}
  };

  // ميزة "وضع الاستكشاف الذكي" (Inspect Mode)
  useEffect(() => {
    if (!inspectMode) {
      setHoveredElementInfo(null);
      return;
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // تجنب فحص المساعد الذكي نفسه
      if (panelRef.current?.contains(target)) return;

      // محاولة استخراج نص أو تلميح عن العنصر
      const tag = target.tagName.toLowerCase();
      const text = target.innerText?.trim();
      const title = target.getAttribute('title') || target.getAttribute('placeholder') || '';
      const ariaLabel = target.getAttribute('aria-label') || '';
      const dataHelp = target.getAttribute('data-help');

      let explanation = '';

      if (dataHelp) {
        explanation = dataHelp;
      } else {
        // المطابقة مع الأزرار المخصصة للصفحة الحالية
        let matched = false;
        if (pageGuide.buttons) {
          for (const [key, value] of Object.entries(pageGuide.buttons)) {
            if (text?.includes(key) || title?.includes(key) || ariaLabel?.includes(key)) {
              explanation = value;
              matched = true;
              break;
            }
          }
        }

        // المطابقة مع الأدلة العامة للأزرار
        if (!matched) {
          for (const [key, value] of Object.entries(DEFAULT_BUTTON_GUIDES)) {
            if (text?.includes(key) || title?.includes(key) || ariaLabel?.includes(key)) {
              explanation = value;
              matched = true;
              break;
            }
          }
        }

        if (!matched && (tag === 'button' || target.closest('button') || target.classList.contains('cursor-pointer'))) {
          explanation = `عنصر تفاعلي لإنجاز المهام: "${text || title || 'زر غير مسمى'}". اضغط لتفعيل الإجراء المخصص له.`;
        } else if (!matched && (tag === 'input' || tag === 'select' || tag === 'textarea')) {
          explanation = `حقل إدخال بيانات مخصص لـ: "${title || text || 'إدخال معلومة'}". اكتب أو اختر القيمة المناسبة.`;
        }
      }

      if (explanation) {
        setHoveredElementInfo(explanation);
        setHoveredCoords({ x: e.clientX, y: e.clientY });
        
        // رسم حد ذهبي مؤقت حول العنصر المكتشف
        target.style.outline = '2px dashed #ffd700';
        target.style.outlineOffset = '2px';
      } else {
        setHoveredElementInfo(null);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target) {
        target.style.outline = '';
        target.style.outlineOffset = '';
      }
      setHoveredElementInfo(null);
    };

    const handleClickPrevent = (e: MouseEvent) => {
      if (inspectMode) {
        const target = e.target as HTMLElement;
        if (panelRef.current?.contains(target)) return;
        
        // منع تنفيذ الضغطة في وضع الاستكشاف لكي يستكشف دون تفعيل الزر
        e.preventDefault();
        e.stopPropagation();
        
        // إظهار تنبيه لطيف بأن الاستكشاف تم
        if (hoveredElementInfo) {
          const originalOutline = target.style.outline;
          target.style.outline = '3px solid #cf8a3c';
          setTimeout(() => {
            target.style.outline = originalOutline;
          }, 800);
        }
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClickPrevent, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleClickPrevent, true);
    };
  }, [inspectMode, pageGuide, hoveredElementInfo]);

  // تصفية الفهرس السريع للمساعدة
  const filteredAllGuides = Object.entries(PAGE_GUIDES).filter(([path, data]) => {
    return data.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           data.desc.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <>
      {/* مؤشر وضع الاستكشاف النشط */}
      <AnimatePresence>
        {inspectMode && (
          <div className="fixed bottom-24 left-6 z-[9999] pointer-events-none">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-amber-600 text-slate-950 font-black text-[10px] px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 border border-amber-400 select-none pointer-events-auto cursor-pointer animate-pulse"
              onClick={() => setInspectMode(false)}
            >
              <MousePointerClick size={12} />
              <span>وضع الاستكشاف نشط (اضغط هنا للإلغاء)</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. تلميح الاستكشاف الطائر (Inspector Tooltip) */}
      <AnimatePresence>
        {inspectMode && hoveredElementInfo && hoveredCoords && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ 
              position: 'fixed',
              left: Math.min(window.innerWidth - 320, Math.max(16, hoveredCoords.x - 150)),
              top: Math.min(window.innerHeight - 150, Math.max(16, hoveredCoords.y + 20)),
              zIndex: 100000 
            }}
            className="w-72 p-3 bg-slate-950/95 backdrop-blur-md border border-[#ffd700] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] text-right pointer-events-none"
          >
            <div className="flex items-center gap-1.5 text-[#ffd700] mb-1">
              <Eye size={12} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-wider">شرح العنصر المستكشف</span>
            </div>
            <p className="text-xs text-white leading-relaxed font-sans">{hoveredElementInfo}</p>
            <div className="mt-2 text-[9px] text-gray-400 border-t border-white/5 pt-1.5 flex justify-between">
              <span>انقر لإلغاء وضع الفحص</span>
              <span>● استكشاف تفاعلي</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. لوحة المساعد الذكي الجانبية الفخمة */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9998] flex justify-end">
            {/* الخلفية المعتمة */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm cursor-pointer"
            />

            {/* اللوح الجانبي الفاخر */}
            <motion.div
              ref={panelRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="relative w-full max-w-md bg-[#090d16] text-white border-r border-[#ffd700]/10 flex flex-col h-full shadow-[0_0_50px_rgba(0,0,0,0.8)] text-right"
              style={{ direction: 'rtl' }}
            >
              
              {/* الرأس الفاخر (Header) */}
              <div className="p-6 bg-[#0c1424] border-b border-[#ffd700]/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ffd700]/10 border border-[#ffd700]/30 flex items-center justify-center text-[#ffd700]">
                    <Sparkles size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      مساعد JAM الذكي 
                      <span className="text-[9px] bg-amber-500/20 text-[#ffd700] px-1.5 py-0.5 rounded font-black border border-[#ffd700]/30">مساعد فوري</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">مرشدك التفاعلي لكل شاشات وأزرار النظام</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer border-none"
                >
                  <X size={16} />
                </button>
              </div>

              {/* المحتوى الرئيسي القابل للتمرير */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                
                {/* الجزء الأول: وضع الاستكشاف الفوري */}
                <div className="p-4 bg-[#ffd700]/5 border border-[#ffd700]/20 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-black text-[#ffd700] flex items-center gap-1.5">
                        <MousePointer size={14} />
                        وضع الاستكشاف الذكي (Hover & Learn)
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        قم بتفعيل هذا الوضع ثم حرك الماوس على أي زر، قائمة أو حقل إدخال في الشاشة لتظهر لك وظيفته وشرح كامل عنه فوراً!
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[10px] font-bold text-gray-300">حالة وضع الاستكشاف:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectMode(!inspectMode);
                        if (!inspectMode) {
                          setIsOpen(false); // إغلاق اللوح ليتيح الفحص بوضوح
                        }
                      }}
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer border-none ${
                        inspectMode 
                          ? 'bg-amber-600 text-slate-950 font-black' 
                          : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}
                    >
                      {inspectMode ? 'إيقاف الاستكشاف' : 'تشغيل الاستكشاف والبدء بالفحص'}
                    </button>
                  </div>
                </div>

                {/* الجزء الثاني: إرشادات الصفحة الحالية */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <Compass size={14} className="text-[#ffd700]" />
                    <h4 className="text-xs font-black text-white">إرشاد الصفحة الحالية: {pageGuide.title}</h4>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-[#0c1424] p-3 rounded-xl border border-white/[0.03]">
                    {pageGuide.desc}
                  </p>

                  {/* خطوات الاستخدام */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">كيف تستخدم هذه الشاشة؟</span>
                    <ul className="space-y-2 pr-1">
                      {pageGuide.steps.map((step, idx) => (
                        <li key={idx} className="flex gap-2.5 items-start text-xs text-slate-300 leading-relaxed">
                          <span className="w-5 h-5 rounded-md bg-brand-primary/10 border border-brand-primary/30 text-[#ffd700] text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* نصائح ذكية */}
                  {pageGuide.tips && pageGuide.tips.length > 0 && (
                    <div className="p-3.5 bg-brand-primary/5 border border-brand-primary/10 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-black text-[#ffd700] flex items-center gap-1">
                        <Info size={11} />
                        نصيحة ذكية للتسريع:
                      </span>
                      {pageGuide.tips.map((tip, idx) => (
                        <p key={idx} className="text-[11px] text-slate-300 leading-relaxed pr-1">
                          • {tip}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* الجزء الثالث: تلميحات القائمة الجانبية */}
                <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                      <BookOpen size={14} className="text-blue-400" />
                      إرشادات القائمة الجانبية (شرح بجانب كل صفحة)
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      عند تفعيل هذا الخيار، سيظهر وصف مالي ووظيفي مختصر مع سهم توضيحي بجانب اسم كل صفحة في القائمة الجانبية لتسهيل تذكر دور الشاشة.
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[10px] font-bold text-gray-300">أدلة القائمة الجانبية:</span>
                    <button
                      type="button"
                      onClick={() => setSidebarGuide(!sidebarGuide)}
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer border-none ${
                        sidebarGuide 
                          ? 'bg-blue-600 text-white font-black' 
                          : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}
                    >
                      {sidebarGuide ? 'مفعلة (ظاهرة)' : 'غير مفعلة (مخفية)'}
                    </button>
                  </div>
                </div>

                {/* الجزء الرابع: محرك البحث في كل الشاشات */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <Search size={14} className="text-[#ffd700]" />
                    <h4 className="text-xs font-black text-white">فهرس البحث السريع في صفحات النظام</h4>
                  </div>
                  
                  <div className="relative">
                    <Search size={14} className="absolute right-3.5 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ابحث عن أي شاشة أو ميزة..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-10 pl-4 py-2.5 bg-[#0c1424] text-xs text-white placeholder-gray-500 rounded-xl border border-white/10 outline-none focus:border-[#ffd700] transition-all text-right"
                    />
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {filteredAllGuides.map(([path, data]) => (
                      <div 
                        key={path} 
                        className="p-3 bg-white/[0.02] border border-white/[0.05] hover:border-[#ffd700]/30 rounded-xl transition-all cursor-pointer space-y-1 text-right"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#ffd700]">{data.title}</span>
                          <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-gray-400">{path}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">{data.desc}</p>
                      </div>
                    ))}
                    {filteredAllGuides.length === 0 && (
                      <p className="text-center text-[10px] text-gray-500 py-4">لا توجد نتائج بحث مطابقة لشروطك.</p>
                    )}
                  </div>
                </div>

              </div>

              {/* تذييل اللوح الجانبي */}
              <div className="p-4 bg-[#0c1424] border-t border-[#ffd700]/10 text-center">
                <p className="text-[9px] text-gray-500 leading-relaxed">
                  مطور بالكامل لصالح منصة JAM لإدارة المتاجر المتكاملة.
                  <br />
                  جميع الحقوق محفوظة © 2026
                </p>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
