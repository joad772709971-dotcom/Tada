import { useState } from 'react';
import { Transaction, TransactionType, PaymentMethod } from '../types';
import { Plus, Trash2, Search, FileDown, Layers, HelpCircle, Check, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { secureFileExport } from '../services/securityService';

interface FinanceTabProps {
  transactions: Transaction[];
  onAddTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export default function FinanceTab({ transactions, onAddTransaction, onDeleteTransaction }: FinanceTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  
  // Adding state
  const [isAdding, setIsAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.RECEIPT);
  const [category, setCategory] = useState('مبيعات هواتف');
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [notes, setNotes] = useState('');

  // Categories Suggestion
  const categoriesList = [
    'مبيعات هواتف', 'مبيعات إكسسوارات', 'خدمات صيانة', 'شراء مخزون', 'أجور صيانة', 'كهرباء وإنترنت', 'مصاريف تشغيلية', 'رواتب وأجور', 'أخرى'
  ];

  // Filtering
  const filtered = transactions.filter(t => {
    const matchesSearch = t.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.notes.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    const newTx: Transaction = {
      id: 't_' + Date.now(),
      type,
      amount: Number(amount),
      category,
      paymentMethod: method,
      date: new Date().toISOString(),
      notes,
      auditorApproved: type === TransactionType.RECEIPT, // Automatically approve general receipts, flag giant expenses
      auditorFlagged: type === TransactionType.EXPENSE && Number(amount) >= 500000,
      auditorFlagMessage: type === TransactionType.EXPENSE && Number(amount) >= 500000 
        ? 'يحتاج هذا المصروف الكبير لموافقة خطية من المدير لإتمام التسوية' : undefined
    };

    onAddTransaction(newTx);
    
    // Reset
    setAmount('');
    setNotes('');
    setIsAdding(false);
  };

  // Excel Export
  const exportToExcel = () => {
    const data = filtered.map(t => ({
      ID: t.id,
      'النوع': t.type === TransactionType.RECEIPT ? 'إيراد' : 'مصروف',
      'التصنيف': t.category,
      'القيمة د.ع': t.amount,
      'طريقة الدفع': t.paymentMethod,
      'التاريخ': new Date(t.date).toLocaleString('ar-IQ'),
      'الملاحظات': t.notes,
      'الاعتماد والتدقيق': t.auditorApproved ? 'معتمد' : t.auditorFlagged ? 'موقوف بملاحظة' : 'بانتظار المراجعة'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف الحسابات');
    secureFileExport.protectXLSX(ws, wb, 'كشف الحسابات');
    XLSX.writeFile(wb, `كشف_حسابات_نمبر_ون_${Date.now()}.xlsx`);
  };

  // PDF Export
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'p', format: 'a4' });
    
    // Simple mock styling for arabic export (jsPDF core uses standard text layout)
    doc.setFontSize(18);
    doc.text("NUMBER ONE STORE - REPORT", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated At: ${new Date().toLocaleString()}`, 14, 28);
    
    // Prepare table columns
    const columns = ["ID", "Type", "Category", "Amount (IQD)", "Date"];
    const rows = filtered.map(t => [
      t.id,
      t.type,
      t.category,
      t.amount.toLocaleString(),
      new Date(t.date).toLocaleDateString()
    ]);

    (doc as any).autoTable({
      head: [columns],
      body: rows,
      startY: 35,
      theme: 'striped',
      headStyles: { fillColor: [20, 184, 166] }
    });

    secureFileExport.protectPDF(doc, "Finance Report");
    doc.save(`finance_report_no_one_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controller */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/30 p-6 rounded-3xl border border-slate-850">
        <div>
          <h2 className="text-xl font-black text-white">إدارة الحسابات والخزينة</h2>
          <p className="text-xs text-slate-400 mt-1">تقييد عمليات القبض والمسحوبات بأسلوب تدقيقي إلزامي ومحكم</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-[#030712] rounded-xl font-bold text-xs hover:bg-teal-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            تقييد حركة مالية جديدة
          </button>

          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-100 rounded-xl font-bold text-xs hover:bg-slate-700 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            تصدير Excel
          </button>

          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-850 text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            تصدير كشف PDF
          </button>
        </div>
      </div>

      {/* Adding Box Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-3xl border border-teal-500/20 shadow-xl space-y-4 animate-fadeIn">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            تقييد معاملة نقدية جديدة (سند قبض / صرف مصروف)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Amount */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">القيمة (دينار عراقي)</label>
              <input 
                type="number" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="أدخل المبلغ بالكامل..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-sm font-mono text-white text-right"
                dir="ltr"
                required
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">نوع الحركة</label>
              <select 
                value={type}
                onChange={e => setType(e.target.value as TransactionType)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2.5 text-sm text-white text-right font-medium"
              >
                <option value={TransactionType.RECEIPT}>إيراد مقبوض (+)</option>
                <option value={TransactionType.EXPENSE}>مصروف مدفوع (-)</option>
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">أو اختر تصنيفاً</label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2.5 text-sm text-white text-right font-medium"
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">طريقة الدفع / التسوية</label>
              <select 
                value={method}
                onChange={e => setMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2.5 text-sm text-white text-right font-medium"
              >
                <option value={PaymentMethod.CASH}>صندوق كاش</option>
                <option value={PaymentMethod.ZAIN_CASH}>زين كاش العراقي</option>
                <option value={PaymentMethod.CARD}>بطاقة الكي كارد / الفيزا</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5 text-right">
            <label className="text-xs text-slate-400 font-bold block">البيان والتفاصيل للمراجعة والتدقيق المالي</label>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="مثال: بيع كفر ايفون 13 مع تركيب شاشة وتقديم ضمان للزبون..."
              rows={2}
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-sm text-white text-right"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={() => setIsAdding(false)} 
              className="px-4 py-2 rounded-xl text-xs text-slate-400 font-bold hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 rounded-xl text-xs bg-teal-500 text-slate-950 font-bold hover:bg-teal-400"
            >
              حفظ وتوثيق الحركة
            </button>
          </div>
        </form>
      )}

      {/* Dynamic Search & Filters Row */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950/30 p-4 rounded-2xl border border-slate-900">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
          <input 
            type="text"
            placeholder="ابحث بتصنيف المعاملة أو الملاحظات والبيان..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 focus:border-teal-500 rounded-xl pr-10 pl-4 py-3 text-xs text-slate-200 text-right font-sans"
          />
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto self-start md:self-auto">
          <button 
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3.5 py-2 rounded-xl font-bold text-[10px] whitespace-nowrap transition-all ${
              typeFilter === 'all' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30' : 'bg-slate-900/50 text-slate-400 border border-transparent'
            }`}
          >
            كل المعاملات
          </button>
          <button 
            type="button"
            onClick={() => setTypeFilter(TransactionType.RECEIPT)}
            className={`px-3.5 py-2 rounded-xl font-bold text-[10px] whitespace-nowrap transition-all ${
              typeFilter === TransactionType.RECEIPT ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/50 text-slate-400 border border-transparent'
            }`}
          >
            إيراد فقط
          </button>
          <button 
            type="button"
            onClick={() => setTypeFilter(TransactionType.EXPENSE)}
            className={`px-3.5 py-2 rounded-xl font-bold text-[10px] whitespace-nowrap transition-all ${
              typeFilter === TransactionType.EXPENSE ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-slate-900/50 text-slate-400 border border-transparent'
            }`}
          >
            مصاريف فقط
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold">
                <th className="pb-3 pt-2">معرف الحركة</th>
                <th className="pb-3 pt-2">تاريخ القيد</th>
                <th className="pb-3 pt-2">طبيعة الحركة</th>
                <th className="pb-3 pt-2">طريقة الدفع</th>
                <th className="pb-3 pt-2">التصنيف</th>
                <th className="pb-3 pt-2">القيمة د.ع</th>
                <th className="pb-3 pt-2">البيان والملاحظات</th>
                <th className="pb-3 pt-2">البوند والتدقيق</th>
                <th className="pb-3 pt-2 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-500 font-semibold">
                    لا توجد قيود مضافة تطابق معايير المراجعة الحالية.
                  </td>
                </tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                    <td className="py-3.5 font-mono text-[10px] text-slate-500">#{t.id}</td>
                    <td className="py-3.5 font-mono">{new Date(t.date).toLocaleString('ar-IQ')}</td>
                    <td className="py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.type === TransactionType.RECEIPT ? 'bg-teal-500/10 text-teal-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {t.type === TransactionType.RECEIPT ? 'إيراد قبض (+)' : 'مصروف صرف (-)'}
                      </span>
                    </td>
                    <td className="py-3.5 font-medium">
                      {t.paymentMethod === PaymentMethod.CASH ? 'الصندوق - كاش' : 
                       t.paymentMethod === PaymentMethod.ZAIN_CASH ? 'محفظة زين كاش' : 'فيزا/كي كارت'}
                    </td>
                    <td className="py-3.5 font-bold text-white">{t.category}</td>
                    <td className={`py-3.5 font-mono font-bold text-sm ${
                      t.type === TransactionType.RECEIPT ? 'text-teal-400' : 'text-red-400'
                    }`}>
                      {t.amount.toLocaleString()} د.ع
                    </td>
                    <td className="py-3.5 text-slate-400 max-w-sm truncate" title={t.notes}>{t.notes}</td>
                    <td className="py-3.5">
                      {t.auditorApproved ? (
                        <span className="text-emerald-400 font-semibold text-[10px] inline-flex items-center gap-1 bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/10">
                          <Check className="w-3 h-3" /> تم الاعتماد
                        </span>
                      ) : t.auditorFlagged ? (
                        <span className="text-red-400 font-bold text-[10px] inline-flex items-center gap-1 bg-red-500/5 px-2 py-0.5 rounded-lg border border-red-500/10 animate-pulse">
                          <AlertCircle className="w-3" /> تحت التحقيق
                        </span>
                      ) : (
                        <span className="text-slate-500 font-semibold text-[10px] bg-slate-800/40 px-2 py-0.5 rounded-lg">
                          في الانتظار
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-center">
                      <button 
                        onClick={() => onDeleteTransaction(t.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="حذف القيد المالي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
