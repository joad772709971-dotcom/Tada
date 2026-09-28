import React, { useState } from 'react';
import { 
  Calendar, Eye, PenTool, Wrench, ShoppingCart, Package, 
  Wallet, User, Building2, ChevronDown, Sparkles, 
  ArrowUpRight, ArrowDownLeft, FileText, Signal, ArrowLeftRight
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
}

export const SmartAIQuickActionsBar: React.FC<SmartAIQuickActionsBarProps> = ({
  onSelectPrompt,
  selectedDate,
  onSelectDate,
  mode,
  onToggleMode,
  suggestedMatch,
  onApplySuggestion,
  onOpenOCR
}) => {
  const [activeFlyout, setActiveFlyout] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const toggleFlyout = (key: string) => {
    setActiveFlyout(prev => prev === key ? null : key);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const handleDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    const d = new Date();
    if (preset === 'today') {
      onSelectDate(d.toISOString().split('T')[0]);
      onSelectPrompt(mode === 'display' ? 'كشف وأرباح اليوم' : 'سجل حركة اليوم: ');
    } else if (preset === 'yesterday') {
      d.setDate(d.getDate() - 1);
      const str = d.toISOString().split('T')[0];
      onSelectDate(str);
      onSelectPrompt(mode === 'display' ? `كشف يوم أمس (${str})` : `سجل حركة أمس: `);
    } else if (preset === 'week') {
      onSelectPrompt('تقرير حركة الأسبوع والأرباح');
    } else if (preset === 'month') {
      onSelectPrompt('ملخص إيرادات ومصاريف وأرباح الشهر');
    }
    setShowDatePicker(false);
  };

  return (
    <div className="space-y-2 select-none" dir="rtl">
      {/* COMPACT TOP ROW: DATE & MODE */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-800/80 p-1.5 sm:p-2 rounded-2xl border border-slate-700/80">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Quick Date Presets */}
          <div className="flex items-center bg-slate-900/90 rounded-xl p-0.5 border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => handleDatePreset('today')}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${
                selectedDate === todayStr ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('yesterday')}
              className="px-2 py-1 rounded-lg font-bold text-slate-300 hover:text-white transition-all"
            >
              أمس
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('week')}
              className="px-2 py-1 rounded-lg font-bold text-slate-300 hover:text-white transition-all"
            >
              الأسبوع
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('month')}
              className="px-2 py-1 rounded-lg font-bold text-slate-300 hover:text-white transition-all"
            >
              الشهر
            </button>
          </div>

          {/* Date Picker Button */}
          <div className="relative">
            <button
              type="button"
              id="ai-btn-date-picker"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-bold flex items-center gap-1.5 transition-all"
              title="تاريخ مخصص"
            >
              <Calendar size={13} className="text-amber-400" />
              <span className="font-mono">{selectedDate === todayStr ? 'اليوم' : selectedDate}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            <AnimatePresence>
              {showDatePicker && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full mt-1.5 right-0 z-50 bg-slate-900 border border-slate-700 rounded-2xl p-2.5 shadow-2xl w-60 space-y-2"
                >
                  <label className="text-[11px] font-bold text-slate-400 block">حدد التاريخ:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      onSelectDate(e.target.value);
                      onSelectPrompt(mode === 'display' ? `كشف عمليات يوم ${e.target.value}` : `سجل قيد بتاريخ ${e.target.value}: `);
                      setShowDatePicker(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mode Toggle */}
          <button
            type="button"
            id="ai-btn-toggle-view-input"
            onClick={onToggleMode}
            className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm ${
              mode === 'entry'
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {mode === 'entry' ? (
              <>
                <PenTool size={13} />
                <span>إدخال قيد ✍️</span>
              </>
            ) : (
              <>
                <Eye size={13} />
                <span>استعلام مالي 👁️</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Tools OCR & Telecom */}
        <div className="flex items-center gap-1">
          {onOpenOCR && (
            <button
              type="button"
              onClick={onOpenOCR}
              className="px-2 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold flex items-center gap-1"
              title="قارئ فواتير OCR"
            >
              <FileText size={13} />
              <span>OCR</span>
            </button>
          )}
        </div>
      </div>

      {/* ULTRA-CONCISE ACTION BUTTONS (مختصرة جداً بدون حشو كلمات) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {/* 1. صرف */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('expense')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border transition-all whitespace-nowrap ${
              activeFlyout === 'expense'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                : 'bg-slate-900 border-slate-700/80 hover:border-rose-400 text-slate-200'
            }`}
          >
            <ArrowDownLeft size={13} className="text-rose-400" />
            <span>صرف</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'expense' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-1.5 shadow-xl w-44 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('صرفت إيجار المحل بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-rose-500/20 text-rose-300"
                >
                  إيجار المحل
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('صرفت كهرباء وماء بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-rose-500/20 text-rose-300"
                >
                  كهرباء وماء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('صرفت نثريات وضيافة بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-rose-500/20 text-rose-300"
                >
                  نثريات وضيافة
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2. قبض */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('receipt')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border transition-all whitespace-nowrap ${
              activeFlyout === 'receipt'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'bg-slate-900 border-slate-700/80 hover:border-emerald-400 text-slate-200'
            }`}
          >
            <ArrowUpRight size={13} className="text-emerald-400" />
            <span>قبض</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'receipt' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-1.5 shadow-xl w-44 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('استلمت وقبضت دفعة من العميل ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-emerald-500/20 text-emerald-300"
                >
                  دفعة من عميل
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('قبضت إيراد مبيعات عامة بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-emerald-500/20 text-emerald-300"
                >
                  إيراد عام
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3. مبيعات */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('sales')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border transition-all whitespace-nowrap ${
              activeFlyout === 'sales'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-slate-900 border-slate-700/80 hover:border-blue-400 text-slate-200'
            }`}
          >
            <ShoppingCart size={13} className="text-blue-400" />
            <span>مبيعات</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'sales' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-1.5 shadow-xl w-44 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل مبيعات كاش بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-blue-500/20 text-blue-300"
                >
                  مبيعات كاش
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل مبيعات آجلة للعميل ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-blue-500/20 text-blue-300"
                >
                  مبيعات آجلة
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4. مشتريات */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('purchases')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border transition-all whitespace-nowrap ${
              activeFlyout === 'purchases'
                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                : 'bg-slate-900 border-slate-700/80 hover:border-purple-400 text-slate-200'
            }`}
          >
            <Package size={13} className="text-purple-400" />
            <span>مشتريات</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'purchases' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-1.5 shadow-xl w-44 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل شراء بضاعة نقداً بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-purple-500/20 text-purple-300"
                >
                  شراء نقداً
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل شراء بضاعة آجل من المورد ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-purple-500/20 text-purple-300"
                >
                  شراء آجل
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 5. صيانة */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleFlyout('maintenance')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border transition-all whitespace-nowrap ${
              activeFlyout === 'maintenance'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                : 'bg-slate-900 border-slate-700/80 hover:border-amber-400 text-slate-200'
            }`}
          >
            <Wrench size={13} className="text-amber-400" />
            <span>صيانة</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {activeFlyout === 'maintenance' && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-1.5 right-0 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-1.5 shadow-xl w-44 space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل دخل وأجور صيانة بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-amber-500/20 text-amber-300"
                >
                  أجور صيانة (دخل)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrompt('سجل قطع غيار صيانة بقيمة ');
                    setActiveFlyout(null);
                  }}
                  className="w-full text-right p-2 rounded-xl text-xs font-bold hover:bg-amber-500/20 text-amber-300"
                >
                  قطع غيار (خرج)
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 6. تحويل خزائن */}
        <button
          type="button"
          onClick={() => onSelectPrompt('تحويل مبلغ من الصندوق الرئيسي إلى ')}
          className="px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border border-slate-700/80 hover:border-indigo-400 bg-slate-900 text-slate-200 whitespace-nowrap transition-all"
        >
          <ArrowLeftRight size={13} className="text-indigo-400" />
          <span>تحويل</span>
        </button>

        {/* 7. رواتب وسلف */}
        <button
          type="button"
          onClick={() => onSelectPrompt('سجل سلفة نقدية على الراتب للموظف ')}
          className="px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border border-slate-700/80 hover:border-teal-400 bg-slate-900 text-slate-200 whitespace-nowrap transition-all"
        >
          <User size={13} className="text-teal-400" />
          <span>رواتب</span>
        </button>

        {/* 8. رصيد وملخص */}
        <button
          type="button"
          onClick={() => onSelectPrompt('كم رصيد الصندوق الرئيسي والبنوك وأرباح اليوم؟', true)}
          className="px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border border-slate-700/80 hover:border-amber-400 bg-slate-900 text-amber-300 whitespace-nowrap transition-all"
        >
          <Wallet size={13} className="text-amber-400" />
          <span>رصيد اليوم</span>
        </button>
      </div>

      {/* Smart Match Suggestion (Compact) */}
      <AnimatePresence>
        {suggestedMatch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-1.5 text-amber-300 font-bold truncate">
              <Sparkles size={14} className="text-amber-400 shrink-0" />
              <span>هل تقصد: <strong>{suggestedMatch.matchedName}</strong>؟</span>
            </div>

            {onApplySuggestion && (
              <button
                type="button"
                onClick={() => onApplySuggestion(suggestedMatch.matchedName)}
                className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shrink-0"
              >
                تطبيق ✓
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartAIQuickActionsBar;
