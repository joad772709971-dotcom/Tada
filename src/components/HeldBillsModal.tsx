import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PauseCircle, 
  Play, 
  Trash2, 
  Clock, 
  User, 
  Package, 
  AlertCircle, 
  X, 
  Search, 
  RotateCcw,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { Customer } from '../types';

export interface HeldBill {
  id: string;
  tag: string;
  customer: Customer | null;
  customerName?: string;
  items: any[];
  posMode: 'sales' | 'purchases' | 'returns';
  returnsSubMode?: 'sales_return' | 'purchase_return';
  discount: number;
  subtotal: number;
  finalTotal: number;
  currency: string;
  heldAt: string;
  timestamp: number;
  notes?: string;
}

interface HeldBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreBill: (bill: HeldBill) => void;
  onSaveCurrentAsHeld: (customTag?: string) => void;
  canHoldCurrent: boolean;
  heldBills: HeldBill[];
  onDeleteHeldBill: (id: string) => void;
  onClearAllHeld: () => void;
}

export default function HeldBillsModal({
  isOpen,
  onClose,
  onRestoreBill,
  onSaveCurrentAsHeld,
  canHoldCurrent,
  heldBills,
  onDeleteHeldBill,
  onClearAllHeld
}: HeldBillsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');
  const [showTagForm, setShowTagForm] = useState(false);

  const filteredBills = heldBills.filter(bill => {
    const q = searchQuery.toLowerCase();
    const tagMatch = (bill.tag || '').toLowerCase().includes(q);
    const customerMatch = (bill.customerName || bill.customer?.name || '').toLowerCase().includes(q);
    const idMatch = bill.id.toLowerCase().includes(q);
    return tagMatch || customerMatch || idMatch;
  });

  const handleHoldNow = () => {
    onSaveCurrentAsHeld(customTagInput.trim() || undefined);
    setCustomTagInput('');
    setShowTagForm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white dark:bg-[#0d1117] border border-amber-500/30 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-right flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.05] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
              <PauseCircle size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>إدارة الفواتير المعلقة (Hold Bills)</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-xs font-black border border-amber-500/20">
                  {heldBills.length} معلقة
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                حفظ واسترجاع الفواتير المؤقتة بلمسة واحدة دون فقدان السلة أو الخروج
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161b22] rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action: Hold Current Bill */}
        <div className="bg-slate-50 dark:bg-[#161b22] p-4 rounded-2xl border border-slate-200/70 dark:border-white/[0.05] space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                هل تريد تعليق الفاتورة الحالية في السلة؟
              </span>
              <span className="text-[11px] text-gray-400">
                سيتم إخلاء السلة الحالية لحساب زبون آخر مع إمكانية استرجاع هذه الفاتورة بأي وقت
              </span>
            </div>
            {!showTagForm ? (
              <button
                type="button"
                disabled={!canHoldCurrent}
                onClick={() => setShowTagForm(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <PauseCircle size={16} />
                <span>تعليق الفاتورة الحالية ⏸️</span>
              </button>
            ) : null}
          </div>

          {showTagForm && (
            <div className="pt-2 border-t border-slate-200 dark:border-white/[0.05] flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="أدخل وسم/اسم تعريفي للفاتورة (مثال: طلبية عميل أبو راشد)..."
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                className="flex-1 p-2.5 bg-white dark:bg-[#0d1117] border border-amber-500/30 rounded-xl text-xs font-bold outline-none focus:border-amber-500 text-slate-900 dark:text-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleHoldNow();
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleHoldNow}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer"
                >
                  تأكيد التعليق ✓
                </button>
                <button
                  type="button"
                  onClick={() => setShowTagForm(false)}
                  className="px-3 py-2.5 bg-slate-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search & Bulk Operations */}
        {heldBills.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="ابحث بالوسم أو اسم العميل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-white/[0.05] rounded-xl text-xs font-bold outline-none focus:border-amber-500 text-slate-800 dark:text-white"
              />
            </div>
            {heldBills.length > 1 && (
              <button
                type="button"
                onClick={onClearAllHeld}
                className="text-[11px] font-black text-rose-500 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Trash2 size={13} />
                <span>حذف الكل</span>
              </button>
            )}
          </div>
        )}

        {/* Held Bills List */}
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 min-h-[220px]">
          {filteredBills.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-white/[0.05] rounded-2xl">
              <PauseCircle size={40} className="text-gray-300 dark:text-gray-700 mb-2" />
              <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">لا توجد فواتير معلقة</h4>
              <p className="text-xs text-gray-400 max-w-xs mt-1">
                عند تعليق أي فاتورة ستظهر هنا لتتمكن من استئنافها واسترجاع أصنافها بلمسة واحدة.
              </p>
            </div>
          ) : (
            filteredBills.map((bill) => (
              <div
                key={bill.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-[#161b22] border border-slate-200/80 dark:border-white/[0.04] hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      {bill.tag}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-[10px] font-black text-gray-600 dark:text-gray-300">
                      {bill.posMode === 'sales' ? 'مبيعات' : bill.posMode === 'purchases' ? 'مشتريات' : 'مرتجع'}
                    </span>
                    {bill.customerName && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                        <User size={12} />
                        {bill.customerName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Package size={13} className="text-gray-400" />
                      {bill.items.length} أصناف (
                      {bill.items.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} قطعة)
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-gray-400" />
                      {bill.heldAt}
                    </span>
                  </div>

                  {/* Sample items preview */}
                  <div className="text-[10px] text-gray-400 truncate max-w-md pt-0.5">
                    {bill.items.slice(0, 3).map((i) => i.name).join(' • ')}
                    {bill.items.length > 3 ? ` ... (+${bill.items.length - 3} أخرى)` : ''}
                  </div>
                </div>

                {/* Amount and Restore action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 dark:border-white/[0.05]">
                  <div className="text-right sm:text-left">
                    <span className="text-base font-extrabold text-amber-500 font-mono">
                      {bill.finalTotal.toLocaleString()} {bill.currency || 'ر.ي'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRestoreBill(bill)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <Play size={13} />
                      <span>استرجاع الفاتورة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteHeldBill(bill.id)}
                      className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                      title="حذف من المعلقات"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-white/[0.05] pt-3 flex justify-between items-center text-xs text-gray-400">
          <span>💡 يتم حفظ الفواتير المعلقة محلياً لمنع ضياعها في حال انقطاع الاتصال.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-[#161b22] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  );
}
