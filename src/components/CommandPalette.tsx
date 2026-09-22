import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Command, Sparkles, Navigation, FileText, Package, Users, Wrench, Settings, HelpCircle, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { isModuleAutoHidden } from '../utils/businessPermissions';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: any;
}

interface SearchResult {
  id: string;
  title: string;
  category: 'pages' | 'invoices' | 'products' | 'customers' | 'actions';
  path?: string;
  action?: () => void;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  subtitle?: string;
}

export default function CommandPalette({ isOpen, onClose, profile }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'pages' | 'invoices' | 'products' | 'customers'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [funSuggestion, setFunSuggestion] = useState('حاول البحث عن "إضافة عميل" أو "فاتورة مبيعات"');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // List of standard actions/pages
  const staticItems: SearchResult[] = [
    { id: 'pos', title: 'نقطة المبيعات الفورية (POS)', category: 'pages', path: '/sales', icon: FileText, subtitle: 'إصدار الفواتير وبيع السلع والباركود' },
    { id: 'maint', title: 'قسم الصيانة والورشة', category: 'pages', path: '/maintenance', icon: Wrench, subtitle: 'استلام الأجهزة وتعيين المهندسين وتتبع التقدم' },
    { id: 'inventory', title: 'إدارة المخازن والسلع', category: 'pages', path: '/inventory', icon: Package, subtitle: 'المنتجات، الحد الأدنى، وتوليد الباركود' },
    { id: 'finances', title: 'الإدارة المالية والحسابات', category: 'pages', path: '/finances', icon: ArrowRightLeft, subtitle: 'الصناديق، ميزان المراجعة، والمصروفات' },
    { id: 'settings', title: 'ترس ضبط إعدادات المحل', category: 'pages', path: '/settings', icon: Settings, subtitle: 'تخصيص الهوية، الطباعة، وواتساب' },
    { id: 'help', title: 'مركز المساعدة والتعليم الذكي', category: 'pages', path: '/help', icon: HelpCircle, subtitle: 'شرح المنظومة بالفيديو والصوت والتوجيهات' },
    
    { id: 'act-new-client', title: 'إضافة عميل جديد 👤', category: 'actions', path: '/sales?action=add-customer', icon: Users, subtitle: 'تسجيل اسم ورقم عميل جديد بالمنظومة' },
    { id: 'act-new-product', title: 'إضافة منتج أو بضاعة جديدة 📦', category: 'actions', path: '/inventory?action=add-product', icon: Package, subtitle: 'إدخال سعر الشراء والبيع والباركود' },
    { id: 'act-new-invoice', title: 'فاتورة مبيعات جديدة 🧾', category: 'actions', path: '/sales?action=new-invoice', icon: FileText, subtitle: 'فتح سلة بيع فارغة فورياً' },
    { id: 'act-new-maint', title: 'فتح كرت صيانة مستعجل 🔧', category: 'actions', path: '/maintenance?action=new-job', icon: Wrench, subtitle: 'استلام هاتف أو قطعة جديدة للصيانة' },
    { id: 'act-profit-report', title: 'تقرير أرباح اليوم والمبيعات 📈', category: 'actions', path: '/finances?tab=reports', icon: ArrowRightLeft, subtitle: 'عرض صافي المكاسب والسيولة في الخزائن' },
    { id: 'act-integrity-check', title: 'فحص وإصلاح قاعدة البيانات 🛡️', category: 'actions', path: '/settings?tab=audit&auto=true', icon: Settings, subtitle: 'تدقيق الأرصدة وحل الفروقات التلقائية' },
  ];

  // Dynamic search data (realistic simulation if database is large, or query database)
  const simulatedData: SearchResult[] = [
    { id: 'inv-25', title: 'فاتورة رقم #10025 🧾', category: 'invoices', path: '/sales?search=10025', icon: FileText, subtitle: 'فاتورة نقداً بقيمة 12,500 ر.ي - مكتملة' },
    { id: 'inv-88', title: 'فاتورة رقم #10088 🧾', category: 'invoices', path: '/sales?search=10088', icon: FileText, subtitle: 'فاتورة ديون للعميل أحمد علي بقيمة 45,000 ر.ي' },
    { id: 'prod-iphone14', title: 'شاشة آيفون 14 برومكس 📱', category: 'products', path: '/inventory?search=شاشة', icon: Package, subtitle: 'مخزون: 8 حبات - تكلفة: 24,000 ر.ي' },
    { id: 'prod-airpods', title: 'سماعات بلوتوث جيروم أصلي 🎧', category: 'products', path: '/inventory?search=سماعة', icon: Package, subtitle: 'مخزون: 15 حبة - سعر البيع: 7,500 ر.ي' },
    { id: 'cust-saleh', title: 'صالح محمد الخولاني 👥', category: 'customers', path: '/sales?customer=صالح', icon: Users, subtitle: 'رقم الهاتف: 771234567 - رصيد الديون: 18,000 ر.ي' },
    { id: 'cust-yasser', title: 'ياسر محمد الحبيشي 👥', category: 'customers', path: '/sales?customer=ياسر', icon: Users, subtitle: 'رقم الهاتف: 733554422 - رصيد الديون: 0 ر.ي' },
  ];

  const allItems = [...staticItems, ...simulatedData].filter(item => !isModuleAutoHidden(item.id, profile));

  // Filter items based on query and selected category
  const filteredItems = allItems.filter(item => {
    // 1. Category Filter
    if (activeCategory !== 'all' && item.category !== activeCategory) {
      return false;
    }
    
    // 2. Query Filter
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query)) ||
      item.category.toLowerCase().includes(query)
    );
  });

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  // Reset index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, activeCategory]);

  // Focus input when open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSelect = (item: SearchResult) => {
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
    onClose();
  };

  // Fun suggestion/entertainment button logic
  const handleFunSuggestion = () => {
    const funnyIdeas = [
      'حاول البحث عن "شاشة آيفون" لمعاينة المخزون والقطع الفورية 📱',
      'ابحث عن "أحمد علي" لمراجعة ديونه المعلقة فوراً 👥',
      'اكتب "فاتورة رقم 25" لتحديد ومطابقة عملية البيع القديمة 🧾',
      'حاول كتابة "تقرير أرباح" لترى ميزان الخزنة وصافي المكاسب اليوم 📈',
      'هل تعلم؟ م. عبد الغني المحفلي صمم هذا المحرك الذكي لتوفير 90% من وقت النقر ⚡',
      'اكتب "فحص" للانتقال السريع إلى طبيب النظام الذكي ومطابقة الأرصدة 🛡️',
      'حاول كتابة "شحن رصيد" للوصول الفوري لباقة سداد الاتصالات 📶',
      'نصيحة اليوم: تفحص الأجهزة المكتملة في الصيانة للتواصل الفوري بواتساب الزبائن 🔧'
    ];
    const randomIdx = Math.floor(Math.random() * funnyIdeas.length);
    setFunSuggestion(funnyIdeas[randomIdx]);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-start justify-center pt-[10vh] px-4 overflow-y-auto">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Command dialog */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: -20 }}
          ref={containerRef}
          className="relative w-full max-w-2xl bg-[#0b0f19] border-2 border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden text-right flex flex-col h-auto max-h-[75vh]"
          dir="rtl"
        >
          {/* Top glowing bar */}
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-teal-500 via-amber-500 to-indigo-500" />

          {/* Search Input bar */}
          <div className="flex items-center px-5 py-4 border-b border-slate-800/80 bg-slate-900/40 relative">
            <Search className="text-teal-400 shrink-0 w-6 h-6 ml-3" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب ما تبحث عنه (اسم عميل، رقم فاتورة، شاشة، إضافة بضاعة)..."
              className="w-full bg-transparent border-none outline-none text-white text-base font-black placeholder-slate-500 pr-1 placeholder:text-right text-right focus:ring-0"
            />
            <div className="flex items-center gap-2 shrink-0 mr-2">
              <span className="text-[10px] font-bold font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded-md border border-slate-700/60 flex items-center gap-0.5">
                <Command size={10} /> + K
              </span>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Categories Tab selector */}
          <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-800/50 bg-[#0d1325] overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${activeCategory === 'all' ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/10' : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'}`}
            >
              الكل 🌟
            </button>
            <button
              onClick={() => setActiveCategory('pages')}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${activeCategory === 'pages' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'}`}
            >
              الشاشات والصفحات 🖥️
            </button>
            <button
              onClick={() => setActiveCategory('invoices')}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${activeCategory === 'invoices' ? 'bg-[#cf8a3c] text-white' : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'}`}
            >
              الفواتير والعمليات 🧾
            </button>
            <button
              onClick={() => setActiveCategory('products')}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${activeCategory === 'products' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'}`}
            >
              المنتجات والقطع 📦
            </button>
            <button
              onClick={() => setActiveCategory('customers')}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${activeCategory === 'customers' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'}`}
            >
              العملاء والديون 👥
            </button>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1 max-h-[40vh] custom-scrollbar bg-[#080b13]">
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => {
                const IconComponent = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-gradient-to-l from-slate-900/90 to-slate-800/70 border border-teal-500/30 shadow-md translate-x-1' 
                        : 'border border-transparent hover:bg-slate-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`p-2.5 rounded-xl transition-all ${
                        isSelected ? 'bg-teal-500/20 text-teal-400 scale-105' : 'bg-slate-800/50 text-slate-400'
                      }`}>
                        <IconComponent size={18} />
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-black transition-colors ${isSelected ? 'text-teal-400' : 'text-white'}`}>
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-[10px] text-slate-400 mt-0.5 font-bold">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Category Badge */}
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                      item.category === 'pages' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25' :
                      item.category === 'invoices' ? 'bg-[#cf8a3c]/10 text-[#cf8a3c] border border-[#cf8a3c]/25' :
                      item.category === 'products' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/25' :
                      item.category === 'customers' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/25' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                    }`}>
                      {item.category === 'pages' ? 'شاشة' :
                       item.category === 'invoices' ? 'فاتورة' :
                       item.category === 'products' ? 'منتج' :
                       item.category === 'customers' ? 'عميل' : 'إجراء سريع'}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 px-4">
                <Search className="mx-auto text-slate-600 mb-3" size={32} />
                <p className="text-xs text-slate-400 font-bold">لا توجد نتائج مطابقة لبحثك...</p>
                <p className="text-[10px] text-slate-500 mt-1">حاول استخدام كلمات أبسط مثل "فاتورة" أو "شاشة" أو "عميل"</p>
              </div>
            )}
          </div>

          {/* Fun Entertainment Box footer (زر الترفيه عن ايش يشتي يبحث) */}
          <div className="p-4 bg-slate-900/60 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="animate-pulse" />
              </div>
              <p className="text-[10px] font-black text-amber-400 max-w-sm leading-tight">
                {funSuggestion}
              </p>
            </div>
            
            <button
              onClick={handleFunSuggestion}
              className="text-[10px] font-black text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:scale-105 active:scale-95 px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0 border-none select-none"
            >
              <span>اقتراح ترفيهي ذكي 🎲</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
