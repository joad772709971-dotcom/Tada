import React, { useState } from 'react';
import { 
  Calendar, Eye, PenTool, Wrench, ShoppingCart, Package, 
  Wallet, User, Building2, FileText, ChevronDown, Sparkles, 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, 
  HelpCircle, CheckCircle, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SmartAIQuickActionsBarProps {
  onSelectPrompt: (prompt: string, autoSubmit?: boolean) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  mode: 'entry' | 'display';
  onToggleMode: () => void;
  suggestedMatch?: { originalText: string; matchedName: string; type: string } | null;
  onApplySuggestion?: (matchedName: string) => void;
  onOpenOCR?: () => void;
  onOpenTelecom?: () => void;
  onOpenCatalog?: () => void;
}

export const SmartAIQuickActionsBar: React.FC<SmartAIQuickActionsBarProps> = ({
  onSelectPrompt,
  selectedDate,
  onSelectDate,
  mode,
  onToggleMode,
  suggestedMatch,
  onApplySuggestion,
  onOpenOCR,
  onOpenTelecom,
  onOpenCatalog
}) => {
  const [activeFlyout, setActiveFlyout] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const toggleFlyout = (key: string) => {
    setActiveFlyout(prev => prev === key ? null : key);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const handleDatePreset = (preset: 'today' | 'yesterday' | 'before_yesterday' | 'week' | 'month') => {
    const d = new Date();
    if (preset === 'today') {
      onSelectDate(d.toISOString().split('T')[0]);
      onSelectPrompt(mode === 'display' ? 'اعرض لي كشف وحركات اليوم تفصيلياً مع الأرباح' : 'سجل حركة بتاريخ اليوم: ');
    } else if (preset === 'yesterday') {
      d.setDate(d.getDate() - 1);
      const str = d.toISOString().split('T')[0];
      onSelectDate(str);
      onSelectPrompt(mode === 'display' ? `اعرض لي كشف وعمليات يوم أمس (${str}) تفصيلياً` : `سجل حركة بتاريخ أمس (${str}): `);
    } else if (preset === 'before_yesterday') {
      d.setDate(d.getDate() - 2);
      const str = d.toISOString().split('T')[0];
      onSelectDate(str);
      onSelectPrompt(mode === 'display' ? `اعرض لي كشف وعمليات يوم أول أمس (${str}) تفصيلياً` : `سجل حركة بتاريخ أول أمس (${str}): `);
    } else if (preset === 'week') {
      onSelectPrompt('أعطني تقريراً تفصيلياً عن حركة المبيعات والمصاريف والأرباح لهذا الأسبوع');
    } else if (preset === 'month') {
      onSelectPrompt('أعطني ملخصاً محاسبياً شاملاً لكامل إيرادات ومصاريف وأرباح هذا الشهر');
    }
    setShowDatePicker(false);
  };

  return (
    <div className="space-y-2.5 select-none" dir="rtl">
      {/* PRIMARY CONTROLS: DATE PICKER & MODE TOGGLE */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-navy-950/80 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 📅 زر تعيين التاريخ الذكي */}
          <div className="relative">
            <button
              type="button"
              id="ai-btn-date-picker"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-navy-900 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-white/15 text-xs font-black flex items-center gap-2 transition-all shadow-sm"
            >
              <Calendar size={15} className="text-amber-500" />
              <span>تحديد التاريخ: <strong className="font-mono text-amber-600 dark:text-amber-400">{selectedDate === todayStr ? 'اليوم' : selectedDate}</strong></span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {/* Date Popover */}
            <AnimatePresence>
              {showDatePicker && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  className="absolute top-full mt-1.5 right-0 z-50 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/15 rounded-2xl p-3 shadow-2xl w-72 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs font-black border-b border-slate-100 dark:border-white/10 pb-2">
                    <span className="text-slate-800 dark:text-slate-200">اختر التاريخ أو الفترة:</span>
                    <span className="text-[10px] text-amber-500 font-bold">ذكي ومتكيف 🤖</span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => handleDatePreset('today')}
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-navy-950 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-right transition-colors"
                    >
                      ✓ اليوم الحالي
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset('yesterday')}
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-navy-950 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-right transition-colors"
                    >
                      ✓ يوم أمس
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset('before_yesterday')}
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-navy-950 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-right transition-colors"
                    >
                      ✓ أول أمس
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset('week')}
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-navy-950 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-right transition-colors"
                    >
                      ✓ هذا الأسبوع
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset('month')}
                      className="col-span-2 p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-700 dark:text-amber-300 text-right transition-colors"
                    >
                      ✓ كشف كامل لهذا الشهر 📅
                    </button>
                  </div>

                  {/* Custom Date Input */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">أو حدد تاريخاً محدداً:</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        onSelectDate(e.target.value);
                        onSelectPrompt(mode === 'display' ? `اعرض لي كشف وعمليات يوم ${e.target.value} تفصيلياً` : `سجل قيد بتاريخ ${e.target.value}: `);
                        setShowDatePicker(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-navy-950 text-xs font-bold"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 👁️ / ✍️ زر التبديل بين العرض والإدخال */}
          <button
            type="button"
            id="ai-btn-toggle-view-input"
            onClick={onToggleMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm ${
              mode === 'entry'
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-blue-600 text-white shadow-blue-600/30'
            }`}
            title="انقر للتبديل بين إدخال قيد محاسبي أو عرض كشوفات واستعلامات"
          >
            {mode === 'entry' ? (
              <>
                <PenTool size={14} />
                <span>وضع: إدخال وتوجيه القيود ✍️</span>
              </>
            ) : (
              <>
                <Eye size={14} />
                <span>وضع: الاستعلام والعرض المالي 👁️</span>
              </>
            )}
          </button>
        </div>

        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold hidden sm:inline">
          {mode === 'entry' ? 'اكتب أو تحدث بالعملية المحاسبية لتدقيقها وترحيلها' : 'انقر على أي تصنيف للاستعلام الفوري المباشر'}
        </span>
      </div>

      {/* DEVELOPED CATEGORY ACTION BUTTONS (أزرار العمليات المطورة) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {/* 1. صيانة (دخل أو خرج) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('maintenance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all whitespace-nowrap ${
              activeFlyout === 'maintenance'
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 hover:border-amber-400 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Wrench size={14} className="text-amber-500" />
            <span>صيانة</span>
            <span className="text-[10px] text-amber-500 bg-amber-500/15 px-1 py-0.2 rounded font-mono">دخل/خرج</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'maintenance' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/15 rounded-2xl p-2 shadow-xl w-60 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل دخل وأجور يد صيانة جهاز بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowUpRight size={14} />
                    <span>دخل أجور يد الصيانة ⬆️</span>
                  </span>
                  <span className="text-[10px] text-slate-400">إيراد</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل مصروف وتكلفة قطع غيار صيانة شاشة بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowDownLeft size={14} />
                    <span>خرج قطع غيار الصيانة ⬇️</span>
                  </span>
                  <span className="text-[10px] text-slate-400">تكلفة/مصروف</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('أعطني تقريراً تفصيلياً عن إجمالي دخل وأرباح الصيانة لليوم');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400 flex items-center justify-between border-t border-slate-100 dark:border-white/10 mt-1"
                >
                  <span>كشف إيرادات الصيانة 📊</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2. مبيعات */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('sales')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all whitespace-nowrap ${
              activeFlyout === 'sales'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 hover:border-blue-400 text-slate-700 dark:text-slate-200'
            }`}
          >
            <ShoppingCart size={14} className="text-blue-500" />
            <span>مبيعات</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'sales' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/15 rounded-2xl p-2 shadow-xl w-60 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل مبيعات كاش هواتف وإكسسوارات بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                >
                  مبيعات كاش اليومية 💰
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل مبيعات آجلة على الحساب للعميل ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-700 dark:text-purple-400"
                >
                  مبيعات آجلة لعميل (على الحساب) 📝
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('ما هي أكثر الأصناف مبيعاً وإيراداً اليوم؟');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-200 border-t border-slate-100 dark:border-white/10"
                >
                  أعلى المبيعات اليوم 🏆
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3. مشتريات */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('purchases')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all whitespace-nowrap ${
              activeFlyout === 'purchases'
                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 hover:border-purple-400 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Package size={14} className="text-purple-500" />
            <span>مشتريات</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'purchases' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/15 rounded-2xl p-2 shadow-xl w-60 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل شراء بضاعة ومخزون نقداً بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-700 dark:text-purple-400"
                >
                  شراء بضاعة نقداً من الصندوق 💸
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل فاتورة شراء بضاعة آجل على الحساب من المورد ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400"
                >
                  فاتورة شراء آجل من مورد 📦
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('اعرض لي كشف حساب ومستحقات الموردين وتواريخ الاستحقاق');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-200 border-t border-slate-100 dark:border-white/10"
                >
                  كشف مستحقات الموردين 🤝
                </button>
                {onOpenOCR && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenOCR();
                      setActiveFlyout(null);
                    }}
                    className="w-full text-right p-2 rounded-xl text-xs font-black bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center justify-between"
                  >
                    <span>قارئ ومدقق الفواتير OCR 📷</span>
                    <Sparkles size={13} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4. رصيد */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('balance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all whitespace-nowrap ${
              activeFlyout === 'balance'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 hover:border-emerald-400 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Wallet size={14} className="text-emerald-500" />
            <span>رصيد</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'balance' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/15 rounded-2xl p-2 shadow-xl w-60 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('كم رصيد الصندوق الرئيسي وجميع الحسابات البنكية المتاحة الآن؟');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                >
                  رصيد الصناديق والبنوك 🏦
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('ما هو صافي الأرباح المقدرة حتى الآن بعد خصم التكاليف؟');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                >
                  صافي الأرباح المقدرة 📈
                </button>
                {onOpenTelecom && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenTelecom();
                      setActiveFlyout(null);
                    }}
                    className="w-full text-right p-2 rounded-xl text-xs font-black bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center justify-between"
                  >
                    <span>كشوفات السداد و PDF 📲</span>
                    <Sparkles size={13} />
                  </button>
                )}
                {onOpenCatalog && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenCatalog();
                      setActiveFlyout(null);
                    }}
                    className="w-full text-right p-2 rounded-xl text-xs font-black bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30 flex items-center justify-between"
                  >
                    <span>كتالوج تسعير الباقات 🏷️</span>
                    <Sparkles size={13} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 5. خرج موظف أو شخص محدد */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('employee_expense')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all whitespace-nowrap ${
              activeFlyout === 'employee_expense'
                ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 hover:border-teal-400 text-slate-700 dark:text-slate-200'
            }`}
          >
            <User size={14} className="text-teal-500" />
            <span>خرج موظف / شخص</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'employee_expense' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/15 rounded-2xl p-2 shadow-xl w-60 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل سلفة نقدية على حساب الراتب للموظف ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-teal-50 dark:hover:bg-teal-950/30 text-teal-700 dark:text-teal-400"
                >
                  سلفة موظف نقدية 💵
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل مسحوبات شخصية للمدير من الصندوق بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                >
                  مسحوبات شخصية للمدير 👔
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل صرف راتب شهري للموظف ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-teal-50 dark:hover:bg-teal-950/30 text-teal-700 dark:text-teal-400"
                >
                  صرف راتب موظف 💼
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('اعرض لي كشف مسحوبات وسلف الموظف ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-200 border-t border-slate-100 dark:border-white/10"
                >
                  كشف مسحوبات موظف 📑
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 6. خرج المحل */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('shop_expense')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all whitespace-nowrap ${
              activeFlyout === 'shop_expense'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 hover:border-rose-400 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Building2 size={14} className="text-rose-500" />
            <span>خرج المحل</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'shop_expense' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/15 rounded-2xl p-2 shadow-xl w-60 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('صرفت إيجار المحل الشهري بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                >
                  إيجار المحل 🏠
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('صرفت فاتورة كهرباء وماء للمحل بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                >
                  كهرباء وماء المحل 💡
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('صرفت ضيافة ونثريات للمحل بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                >
                  ضيافة ونثريات ووجبات ☕
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('صرفت اشتراك إنترنت المحل بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-cyan-50 dark:hover:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400"
                >
                  اشتراك إنترنت واتصالات 📶
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 7. كشوفات العملاء والديون */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('statements')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all whitespace-nowrap ${
              activeFlyout === 'statements'
                ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 hover:border-violet-400 text-slate-700 dark:text-slate-200'
            }`}
          >
            <FileText size={14} className="text-violet-500" />
            <span>كشوفات العملاء والديون</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'statements' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/15 rounded-2xl p-2 shadow-xl w-64 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('اعرض لي كشفاً بجميع ديون العملاء المتبقية ومن أكثرهم تأخيراً');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                >
                  كشف ديون العملاء المتأخرة ⚠️
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('أعطني كشف حساب تفصيلي للعميل ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-violet-50 dark:hover:bg-violet-950/30 text-violet-700 dark:text-violet-400"
                >
                  كشف حساب عميل محدد 👤
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('استلمت وقبضت دفعة من حساب العميل ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                >
                  سداد دفعة من عميل (سند قبض) 💰
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 💡 شريط الاقتراح الذكي ("هل تقصد كذا؟") */}
      <AnimatePresence>
        {suggestedMatch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-400/50 flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Sparkles size={16} className="text-amber-500 shrink-0 animate-bounce" />
              <span>
                💡 هل تقصد: <strong className="font-black text-amber-700 dark:text-amber-300 underline underline-offset-2">{suggestedMatch.matchedName}</strong> ({suggestedMatch.type})؟
              </span>
            </div>

            {onApplySuggestion && (
              <button
                type="button"
                onClick={() => onApplySuggestion(suggestedMatch.matchedName)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm transition-all shrink-0"
              >
                تطبيق التصحيح ✓
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartAIQuickActionsBar;
