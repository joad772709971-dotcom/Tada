import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Calculator, CheckCircle2, DollarSign, Calendar, Clock, AlertTriangle, Printer, FileText } from 'lucide-react';
import { UserProfile, NetworkOrder } from '../types';

interface DailyShiftCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  orders?: NetworkOrder[];
  onConfirmShiftClose: (closeData: ShiftCloseReport) => void;
}

export interface ShiftCloseReport {
  id: string;
  closedAt: string;
  closedBy: string;
  closedByName: string;
  ownerId: string;
  shiftType: 'morning' | 'evening' | 'full_day';
  expectedCash: number;
  actualCash: number;
  difference: number;
  totalSales: number;
  totalDebtSales: number;
  totalExpenses: number;
  notes: string;
}

export default function DailyShiftCloseModal({
  isOpen,
  onClose,
  currentUser,
  orders = [],
  onConfirmShiftClose
}: DailyShiftCloseModalProps) {
  const [shiftType, setShiftType] = useState<'morning' | 'evening' | 'full_day'>('morning');
  const [actualCash, setActualCash] = useState<number>(0);
  const [expenses, setExpenses] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [summaryReport, setSummaryReport] = useState<ShiftCloseReport | null>(null);

  // Calculate expected shift totals from current user's sales or shop sales
  const todayStr = new Date().toISOString().split('T')[0];
  const userOrders = orders.filter(o => {
    const isToday = o.createdAt && typeof o.createdAt === 'string' && o.createdAt.startsWith(todayStr);
    const isOwner = o.ownerId === currentUser.ownerId || o.ownerId === currentUser.uid;
    return isToday && isOwner && o.status !== 'cancelled';
  });

  const totalSales = userOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalDebtSales = userOrders.filter(o => o.paymentType === 'debt').reduce((sum, o) => sum + (o.total || 0), 0);
  const totalCashSales = totalSales - totalDebtSales;
  const expectedCash = Math.max(0, totalCashSales - expenses);
  const difference = actualCash - expectedCash;

  const handleExecuteClose = (e: React.FormEvent) => {
    e.preventDefault();
    const report: ShiftCloseReport = {
      id: `shift-${Date.now()}`,
      closedAt: new Date().toLocaleString('ar-YE'),
      closedBy: currentUser.uid,
      closedByName: currentUser.name,
      ownerId: currentUser.ownerId || currentUser.uid,
      shiftType,
      expectedCash,
      actualCash: Number(actualCash) || 0,
      difference: (Number(actualCash) || 0) - expectedCash,
      totalSales,
      totalDebtSales,
      totalExpenses: Number(expenses) || 0,
      notes
    };

    setSummaryReport(report);
    setIsSuccess(true);
    onConfirmShiftClose(report);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose} 
          className="absolute inset-0 bg-black/85 backdrop-blur-md" 
        />

        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.95, opacity: 0 }} 
          className="relative w-full max-w-lg bg-[#0a0a0a] border border-zinc-800/90 rounded-3xl p-6 text-right shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-900">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Lock size={18} className="text-amber-500" />
              🔒 إغلاق الورديّة والنشرة اليومية (Shift Closing)
            </h3>
            <button 
              onClick={onClose} 
              className="p-1 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg text-xs"
            >
              ✕
            </button>
          </div>

          {!isSuccess ? (
            <form onSubmit={handleExecuteClose} className="space-y-4 text-xs">
              {/* Shift Type selection */}
              <div>
                <label className="block text-zinc-400 mb-1.5 font-bold">نوع الوردية المراد إغلاقها</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'morning', label: 'الوردية الصباحية 🌅' },
                    { id: 'evening', label: 'الوردية المسائية 🌙' },
                    { id: 'full_day', label: 'إغلاق اليوم كاملاً 📅' }
                  ].map(st => (
                    <button
                      type="button"
                      key={st.id}
                      onClick={() => setShiftType(st.id as any)}
                      className={`p-2.5 rounded-xl border font-bold text-center transition ${
                        shiftType === st.id
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                          : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats Summary */}
              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">ملخص مبيعات اليوم المستخرجة تلقائياً</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-zinc-900/40 rounded-xl">
                    <span className="text-zinc-400 text-[10px] block">إجمالي المبيعات الكلي</span>
                    <span className="font-black text-amber-400 font-mono text-sm">{totalSales.toLocaleString()} YER</span>
                  </div>
                  <div className="p-2.5 bg-zinc-900/40 rounded-xl">
                    <span className="text-zinc-400 text-[10px] block">مبيعات الآجل (الديون)</span>
                    <span className="font-black text-rose-400 font-mono text-sm">{totalDebtSales.toLocaleString()} YER</span>
                  </div>
                  <div className="p-2.5 bg-zinc-900/40 rounded-xl col-span-2 flex justify-between items-center">
                    <div>
                      <span className="text-zinc-400 text-[10px] block">النقد المتوقع درج الكاشير (المفترض)</span>
                      <span className="text-[10px] text-zinc-500">(المبيعات الكاش - المصاريف)</span>
                    </div>
                    <span className="font-black text-emerald-400 font-mono text-base">{expectedCash.toLocaleString()} YER</span>
                  </div>
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-bold">مصاريف/نثريات الوردية (إن وجدت)</label>
                  <input
                    type="number"
                    value={expenses || ''}
                    onChange={(e) => setExpenses(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white font-mono text-center focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-amber-400 mb-1.5 font-bold">النقدية الفعلية بـ درج الكاشير 💵</label>
                  <input
                    type="number"
                    required
                    value={actualCash || ''}
                    onChange={(e) => setActualCash(Number(e.target.value) || 0)}
                    placeholder="أدخل المبلغ الفعلي"
                    className="w-full p-2.5 bg-zinc-900/80 border border-amber-500/50 rounded-xl text-amber-300 font-mono text-center font-bold text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Difference calculation feedback */}
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                difference === 0 
                  ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300' 
                  : difference > 0 
                  ? 'bg-blue-950/40 border-blue-900/50 text-blue-300' 
                  : 'bg-rose-950/40 border-rose-900/50 text-rose-300'
              }`}>
                <span>فرق الصندوق (الفائض / العجز):</span>
                <span className="font-mono text-sm">
                  {difference > 0 ? `+${difference.toLocaleString()} (فائض)` : difference < 0 ? `${difference.toLocaleString()} (عجز)` : 'متطابق تماماً ✅'}
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-zinc-400 mb-1.5 font-bold">ملاحظات تسليم الوردية للمشرف</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات حول فارق النقدية أو فواتير معلقة..."
                  className="w-full p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Submit button */}
              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock size={16} />
                  تأكيد إغلاق الوردية وحفظ السجل
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold text-xs rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          ) : (
            /* Success Summary Receipt */
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} />
              </div>

              <h4 className="text-base font-black text-white">تم إغلاق الوردية بنجاح 🧾</h4>
              <p className="text-xs text-zinc-400">تم تسجيل تقرير إغلاق الوردية وترحيل الحسابات إلى السجل الرئيسي.</p>

              {summaryReport && (
                <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-2xl text-right space-y-2 font-mono text-xs">
                  <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                    <span className="text-zinc-500">المسؤول:</span>
                    <span className="text-white font-bold">{summaryReport.closedByName}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                    <span className="text-zinc-500">التاريخ والوقت:</span>
                    <span className="text-zinc-300">{summaryReport.closedAt}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                    <span className="text-zinc-500">النقدية الفعلية المسلمة:</span>
                    <span className="text-amber-400 font-bold">{summaryReport.actualCash.toLocaleString()} YER</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                    <span className="text-zinc-500">فارق الصندوق:</span>
                    <span className={summaryReport.difference >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {summaryReport.difference.toLocaleString()} YER
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer size={15} />
                  طباعة التقرير
                </button>
                <button
                  onClick={() => {
                    setIsSuccess(false);
                    onClose();
                  }}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-black text-xs rounded-xl cursor-pointer"
                >
                  إنهاء
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
