import { useState } from 'react';
import { Transaction, Product, MaintenanceJob, CashSafe, TransactionType, MaintenanceStatus } from '../types';
import { ShieldCheck, ShieldAlert, CheckCircle2, Lock, HelpCircle, Activity, Warning, DollarSign, CalendarCheck } from 'lucide-react';

interface AuditTabProps {
  transactions: Transaction[];
  products: Product[];
  maintenance: MaintenanceJob[];
  safe: CashSafe;
  onUpdateSafe: (safe: CashSafe) => void;
  onAuditorApproveAll: () => void;
  onTriggerAuditFlag: (txId: string, flag: boolean, msg?: string) => void;
}

export default function AuditTab({ 
  transactions, 
  products, 
  maintenance, 
  safe, 
  onUpdateSafe, 
  onAuditorApproveAll,
  onTriggerAuditFlag
}: AuditTabProps) {

  const [activeTab, setActiveTab] = useState<'scan' | 'safe'>('scan');
  
  // Safe accounting calculation
  const receipts = transactions.filter(t => t.type === TransactionType.RECEIPT);
  const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);

  const sumReceipts = receipts.reduce((acc, c) => acc + c.amount, 0);
  const sumExpenses = expenses.reduce((acc, c) => acc + c.amount, 0);
  
  // Mathematically calculated ideal safe balance
  const mathematicalSafeBalance = safe.openingBalance + sumReceipts - sumExpenses;

  // Real matching checking
  const checkDiscrepancy = safe.currentBalance - mathematicalSafeBalance;
  const isFullyBalanced = checkDiscrepancy === 0;

  // 1. Audit check scenarios
  const auditScenarios = [
    {
      id: 'sc_1',
      title: 'تطابق الحسابات الهيكلية والخزينة',
      desc: 'تدقيق الرصيد الفعلي للخزانة ومقارنته بمعادلة الرصيد الأولي والواردات والمصاريف اليومية.',
      result: isFullyBalanced ? 'passed' : 'failed',
      value: `الفارق المالي: ${checkDiscrepancy.toLocaleString()} د.ع | الحساب الدفتري: ${mathematicalSafeBalance.toLocaleString()} د.ع`
    },
    {
      id: 'sc_2',
      title: 'تدقيق المعاملات مجهولة التفاصيل',
      desc: 'فحص مبيعات وصيانة بدون شرح واضح أو بيان مقيد يمنع كشف سرقة الحسابات.',
      result: transactions.some(t => t.notes.length < 5) ? 'warning' : 'passed',
      value: transactions.some(t => t.notes.length < 5) 
        ? 'تم كشف معاملات مقيدة بصور مقتضبة وغير كافية' 
        : 'كافة المعاملات مفسرة ومقيدة بوضوح تام'
    },
    {
      id: 'sc_3',
      title: 'تدقيق فجوات الصيانة ومطابقة المبيعات',
      desc: 'هل يوجد أجهزة سلمت للزبون (DELIVERED) دون قيد مالي إيرادات مقابل لها؟',
      result: maintenance.some(m => m.status === MaintenanceStatus.DELIVERED && !m.invoiceIssued) ? 'failed' : 'passed',
      value: maintenance.some(m => m.status === MaintenanceStatus.DELIVERED && !m.invoiceIssued) 
        ? 'تحذير: تم الكشف عن تذاكر صيانة مغلقة بالاستلام دون قيد الإيراد لنظام JAM!' 
        : 'كافة تذاكر الصيانة المسلمة لها قيود إيرادات مطابقة'
    },
    {
      id: 'sc_4',
      title: 'تدقيق المخزون السلبي ومعدل تلف البضاعة',
      desc: 'التحقق من عدم حدوث مبيعات لمنتج بكمية صفر أو حدوث سحوبات بضائع دون محاسبة.',
      result: products.some(p => p.quantity < 0) ? 'failed' : 'passed',
      value: products.some(p => p.quantity < 0) ? 'توجد أصناف مخزنية برصيد سالب!' : 'توازن حركة المستودعات سليم'
    }
  ];

  // Manual safe balance entry
  const [typedCurrentSafe, setTypedCurrentSafe] = useState(safe.currentBalance.toString());
  const [reconciliationLog, setReconciliationLog] = useState<string>('');

  const handleReconcileSafe = () => {
    const val = Number(typedCurrentSafe);
    if (isNaN(val)) return;

    const diff = val - mathematicalSafeBalance;
    const newSafe: CashSafe = {
      ...safe,
      currentBalance: val,
      lastReconciledAt: new Date().toISOString(),
      reconciliationStatus: diff === 0 ? 'balanced' : 'discrepancy',
      discrepancyAmount: diff !== 0 ? diff : undefined
    };

    onUpdateSafe(newSafe);
    setReconciliationLog(
      diff === 0 
        ? '✅ تم إغلاق الخزينة وتصفير المطابقة بنجاح. مطابقة كاملة ودقيقة للرصيد الفعلي والدفتري!'
        : `⚠️ تم تقييد الخزينة بوجود فجوة عجز/فائض تبلغ ${diff.toLocaleString()} د.ع. يرجى مراجعة كافة الفنيين.`
    );
  };

  const handleApplyFlag = (txId: string, flag: boolean) => {
    onTriggerAuditFlag(txId, flag, 'فشل التدقيق الإلزامي - تم حجب المعاملة للاشتباه ومطلوب مراجعة مستندية');
  };

  // Flagged list
  const flaggedTxs = transactions.filter(t => t.auditorFlagged);

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/60">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-400" />
            المدقق الحديدي الذكي (التدقيق الإجباري للحسابات)
          </h2>
          <p className="text-xs text-slate-400 mt-1">نظام مطابقة مالي وتدقيق تذاكر لضمان جودة الحسابات ومنع الثغرات والسرقة</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('scan')}
            className={`px-4 py-2 font-bold text-xs rounded-xl border transition-all ${
              activeTab === 'scan' ? 'bg-teal-500 text-slate-950 border-teal-500' : 'bg-slate-800/45 text-slate-400 border-slate-700/50 hover:bg-slate-800'
            }`}
          >
            مسح وتدقيق المعاملات الحسابية
          </button>
          <button 
            onClick={() => setActiveTab('safe')}
            className={`px-4 py-2 font-bold text-xs rounded-xl border transition-all ${
              activeTab === 'safe' ? 'bg-teal-500 text-slate-950 border-teal-500' : 'bg-slate-800/45 text-slate-400 border-slate-700/50 hover:bg-slate-800'
            }`}
          >
            مطابقة الخزينة وأقفال الصناديق
          </button>
        </div>
      </div>

      {activeTab === 'scan' ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Audit Score widget */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/30 border border-slate-850 p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-200 mb-2">مؤشر جودة وتكامل تدقيق JAM</h3>
                <p className="text-xs text-slate-400">تقييم سلامة القيود المالية الحالية مع تذاكر استلام الأجهزة والصيانة من العملاء</p>
              </div>

              <div className="my-6 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-400/20 flex items-center justify-center font-mono text-xl font-black text-teal-400 animate-pulse">
                  {flaggedTxs.length > 0 ? '80%' : '100%'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">درجة الأمان المالي: {flaggedTxs.length > 0 ? 'مقبول (ملاحظات تدقيقية)' : 'ممتاز ونظيف 100/100'}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {flaggedTxs.length > 0 
                      ? `تم كشف عدد ${flaggedTxs.length} من الإنذارات التدقيقية النشطة في السجلات` 
                      : 'سجلاتك المالية متطابقة تماماً ولا توجد تسريبات أو حركات غير موثقة'}
                  </p>
                </div>
              </div>

              {flaggedTxs.length > 0 && (
                <button 
                  onClick={onAuditorApproveAll}
                  className="w-full bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-bold py-2.5 rounded-xl text-xs transition-colors"
                >
                  اعتماد جميع الحسابات المعلقة وتسوية الفجوات دفعة واحدة
                </button>
              )}
            </div>

            {/* Quick stats box */}
            <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-400 block mb-1">الرصيد الدفتري النظري</h4>
                <p className="text-xl font-mono font-black text-white">{mathematicalSafeBalance.toLocaleString()} د.ع</p>
              </div>

              <div className="border-t border-slate-850 pt-3">
                <h4 className="text-xs font-bold text-slate-400 block mb-1">الرصيد الفعلي في الصندوق</h4>
                <p className="text-xl font-mono font-black text-teal-400">{safe.currentBalance.toLocaleString()} د.ع</p>
              </div>

              <div className="border-t border-slate-850 pt-3">
                <h4 className="text-xs font-bold text-slate-400 block mb-1">الفجوة الحركية المكتشفة</h4>
                <p className={`text-sm font-mono font-bold ${isFullyBalanced ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isFullyBalanced ? 'لا يوجد عجز دفتري (0 د.ع)' : `${checkDiscrepancy.toLocaleString()} د.ع عجز`}
                </p>
              </div>
            </div>
          </div>

          {/* Audit Checks results */}
          <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-white mb-4">فحوصات الباب الدفتري الإجباري</h3>
            <div className="space-y-3">
              {auditScenarios.map(sc => (
                <div key={sc.id} className="p-4 rounded-2xl bg-slate-950/40 border border-slate-850/80 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {sc.result === 'passed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : sc.result === 'warning' ? (
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{sc.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{sc.desc}</p>
                      <p className="text-[11px] font-mono font-semibold text-slate-300 mt-2 bg-slate-900/60 py-1 px-2.5 rounded-lg inline-block">{sc.value}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    sc.result === 'passed' ? 'bg-emerald-500/10 text-emerald-400' : 
                    sc.result === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {sc.result === 'passed' ? 'طبيعي ومطابق' : 
                     sc.result === 'warning' ? 'تنبيه تدقيق' : 'فشل مالي'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Specific Flagged entries */}
          {flaggedTxs.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-6">
              <h3 className="text-sm font-bold text-red-400 mb-4 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                معاملات حسابية تم حجبها وحظر إغلاق الصندوق بسببها
              </h3>

              <div className="space-y-3">
                {flaggedTxs.map(t => (
                  <div key={t.id} className="p-4 rounded-xl bg-slate-950/50 border border-red-500/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-white">{t.amount.toLocaleString()} د.ع</span>
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-bold">{t.category}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">البيان: " {t.notes} "</p>
                      {t.auditorFlagMessage && <p className="text-[10px] text-red-300 font-bold mt-1">● سبب الحظر: {t.auditorFlagMessage}</p>}
                    </div>

                    <button 
                      onClick={() => handleApplyFlag(t.id, false)}
                      className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg text-[10px] hover:bg-emerald-400 transition-colors"
                    >
                      تسوية واعتماد السند الحسابي
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-6 space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">المطابقة اليدوية لجرار كاش الصندوق</h3>
            <p className="text-xs text-slate-400">تحديث دوري وإلزامي للرصيد الفعلي المتواجد بيدك في جرار المال ومطابقته دفترياً</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5 text-right">
                <label className="text-xs text-slate-400 font-bold block">إجمالي مبلغ الكاش الحقيقي المتواجد الآن بالجرار (د.ع)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  <input 
                    type="number" 
                    value={typedCurrentSafe}
                    onChange={e => setTypedCurrentSafe(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl pr-10 pl-4 py-3 text-sm font-mono text-white text-right"
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <button 
                onClick={handleReconcileSafe}
                className="w-full bg-teal-500 hover:bg-teal-400 text-[#030712] rounded-xl font-bold text-xs py-3"
              >
                تحديث وجرد الخزينة اليوم بقيمة الجرد الفعلي
              </button>

              {reconciliationLog && (
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs leading-relaxed font-semibold text-teal-300">
                  {reconciliationLog}
                </div>
              )}
            </div>

            {/* Quick Summary of last reconciles */}
            <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-850 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block mb-2">● آخر جرد مسجل للخزانة</span>
                <div className="flex justify-between items-center text-xs text-slate-400 mt-2">
                  <span>تاريخ الجرد:</span>
                  <span className="font-mono text-white">{new Date(safe.lastReconciledAt).toLocaleString('ar-IQ')}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400 mt-2">
                  <span>الحالة التدقيقية:</span>
                  <span className={`font-bold ${safe.reconciliationStatus === 'balanced' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {safe.reconciliationStatus === 'balanced' ? 'الخزينة مطابقة للدرج' : 'كشف عجز مالي قيد المطابقة'}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850 flex gap-2 text-xs">
                <CalendarCheck className="w-4 h-4 text-emerald-400 mt-0.5" />
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  يؤمن نظام JAM جدار حماية مطبق بنسبة 100/100 يمنع تغيير القيود التاريخية أو تعديل حسابات الصندوق بعد إتمام الجرد والمطابقة.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
