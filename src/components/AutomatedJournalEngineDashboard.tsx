import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  ShieldCheck, 
  DollarSign, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  Wrench, 
  ShoppingBag, 
  Smartphone, 
  Package, 
  Plus, 
  Zap, 
  Layers,
  Sparkles,
  WifiOff,
  Database,
  Check,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { AutomatedJournalEngine, CumulativeBalanceSummary } from '../services/AutomatedJournalEngine';
import { collection, query, where, onSnapshot, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

interface AutomatedJournalEngineDashboardProps {
  profile: UserProfile | null;
  onRefreshLedger?: () => void;
}

export default function AutomatedJournalEngineDashboard({ profile, onRefreshLedger }: AutomatedJournalEngineDashboardProps) {
  const [cumulativeBalances, setCumulativeBalances] = useState<CumulativeBalanceSummary>({
    cashVaultsBalance: 0,
    bankAccountsBalance: 0,
    totalAssets: 0,
    lastUpdated: new Date().toISOString()
  });

  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');

  // Fault / Damage Deduction Form state
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; role?: string }>>([]);
  const [faultType, setFaultType] = useState<'engineer' | 'employee' | 'company_waste'>('employee');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedStaffName, setSelectedStaffName] = useState('');
  const [itemName, setItemName] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [isPostingDeduction, setIsPostingDeduction] = useState(false);
  const [deductionFeedback, setDeductionFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Recent Auto Journal Entries
  const [recentJournals, setRecentJournals] = useState<any[]>([]);
  const [loadingJournals, setLoadingJournals] = useState(true);

  useEffect(() => {
    // 1. Initial cached balance & offline queue check
    refreshBalancesAndQueue();

    // 2. Fetch users for staff selection dropdown
    fetchStaffList();

    // 3. Listen to journalEntries in Firestore
    if (profile?.ownerId) {
      const q = query(
        collection(db, 'journalEntries'),
        where('ownerId', '==', profile.ownerId),
        limit(20)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort descending locally by createdAt
        items.sort((a: any, b: any) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setRecentJournals(items);
        setLoadingJournals(false);
        refreshBalancesAndQueue();
      }, (err) => {
        console.warn("Snapshot error fetching journal entries:", err);
        setLoadingJournals(false);
      });

      return () => unsubscribe();
    }
  }, [profile?.ownerId]);

  const refreshBalancesAndQueue = () => {
    const cached = AutomatedJournalEngine.getCachedCumulativeBalances();
    setCumulativeBalances(cached);
    const pending = AutomatedJournalEngine.getPendingOfflineQueueCount();
    setOfflineCount(pending);
  };

  const fetchStaffList = async () => {
    try {
      if (!profile?.ownerId) return;
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      const list = snap.docs
        .map(d => ({ id: d.id, name: d.data().name || d.data().username || d.id, role: d.data().role }))
        .filter(u => u.name);
      setEmployees(list);
    } catch (e) {
      console.warn("Could not load users for fault deduction list:", e);
    }
  };

  const handleManualOfflineSync = async () => {
    if (!profile?.ownerId) return;
    setIsSyncing(true);
    setSyncStatusMsg('جاري مزامنة قيود الأوفلاين المحفوظة محلياً إلى الدفتر العام السحابي...');
    try {
      const res = await AutomatedJournalEngine.syncOfflineQueue(profile.ownerId);
      setIsSyncing(false);
      if (res.syncedCount > 0) {
        setSyncStatusMsg(`✅ تمت مزامنة (${res.syncedCount}) قيد محاسبي محلي بنجاح إلى الدفتر العام السحابي!`);
      } else if (res.errors > 0) {
        setSyncStatusMsg(`⚠️ حدثت أخطاء أثناء مزامنة ${res.errors} قيد، سيتم إعادة المحاولة تلقائياً عند استقرار الشبكة.`);
      } else {
        setSyncStatusMsg(`ℹ️ جميع القيود المحاسبية متزامنة 100% مع قاعدة البيانات سحابياً.`);
      }
      refreshBalancesAndQueue();
      if (onRefreshLedger) onRefreshLedger();
    } catch (e: any) {
      setIsSyncing(false);
      setSyncStatusMsg(`فشلت العملية: ${e.message || e}`);
    }
  };

  const handlePostDeductionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeductionFeedback(null);

    if (!profile?.ownerId) {
      setDeductionFeedback({ type: 'error', msg: 'تعذر التنفيذ: حساب المالك غير متوفر' });
      return;
    }

    const cost = parseFloat(costAmount);
    if (isNaN(cost) || cost <= 0) {
      setDeductionFeedback({ type: 'error', msg: 'الرجاء إدخال مبلغ تكلفة تالف/خطأ صحيح وأكبر من 0' });
      return;
    }

    if (!itemName.trim()) {
      setDeductionFeedback({ type: 'error', msg: 'الرجاء كتابة اسم المادة التالفة أو بيان الخطأ' });
      return;
    }

    setIsPostingDeduction(true);
    try {
      const staffObj = employees.find(emp => emp.id === selectedStaffId);
      const staffName = staffObj ? staffObj.name : selectedStaffName;

      const result = await AutomatedJournalEngine.postDamageOrShrinkage({
        ownerId: profile.ownerId,
        storeId: profile.storeId,
        itemName,
        costAmount: cost,
        responsibleType: faultType,
        responsibleId: selectedStaffId || undefined,
        responsibleName: staffName || undefined,
        deductFromPayroll: true,
        reason: reasonNote || 'تلف/خطأ مهندس/عامل'
      });

      setIsPostingDeduction(false);
      setDeductionFeedback({
        type: 'success',
        msg: result.msg || 'تم إنشاء وتوليد قيد التسوية المالية واستقطاعه من حساب الراتب والذمة بنجاح!'
      });

      // Clear form
      setItemName('');
      setCostAmount('');
      setReasonNote('');
      setSelectedStaffId('');
      setSelectedStaffName('');

      refreshBalancesAndQueue();
      if (onRefreshLedger) onRefreshLedger();
    } catch (err: any) {
      setIsPostingDeduction(false);
      setDeductionFeedback({
        type: 'error',
        msg: err.message || 'فشل توليد قيد الخصم والتسوية.'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mt-20"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mb-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-black flex items-center gap-1">
                <Sparkles size={12} className="animate-spin text-indigo-400" />
                محرك القيود المحاسبية التلقائي الآلي (100% Automated)
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1">
                <ShieldCheck size={12} />
                مُعالج توازن القيد (المدين = الدائن)
              </span>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold flex items-center gap-1">
                <WifiOff size={12} />
                دعم العمل والخصم أوفلاين
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              <Cpu className="text-indigo-400" size={30} />
              <span>محرك إسناد القيود المحاسبية والأرصدة التراكمية</span>
            </h1>
            <p className="text-gray-300 text-xs md:text-sm max-w-3xl leading-relaxed">
              ربط تلقائي فوريلكافة حركات الكاشير، مبيعات التجزئة والجملة، الصيانة والورش، شحن الرصيد والمشتريات بشجرة الحسابات والدفتر العام لحظياً مع معالجة الخصومات والأخطاء أوفلاين وسحابياً.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowDeductionModal(true)}
              className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white font-black text-xs md:text-sm rounded-2xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
            >
              <Plus size={16} />
              <span>توليد قيد خصم تالف / خطأ عاملي</span>
            </button>

            <button
              onClick={handleManualOfflineSync}
              disabled={isSyncing}
              className="w-full sm:w-auto px-4 py-3 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-white font-bold text-xs md:text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin text-indigo-400' : ''} />
              <span>مزامنة الأوفلاين ({offlineCount})</span>
            </button>
          </div>
        </div>

        {syncStatusMsg && (
          <div className="mt-4 p-3 bg-indigo-900/50 border border-indigo-500/30 text-indigo-200 text-xs rounded-xl font-bold flex items-center justify-between">
            <span>{syncStatusMsg}</span>
            <button onClick={() => setSyncStatusMsg('')} className="text-indigo-400 hover:text-white bg-transparent border-none cursor-pointer">✕</button>
          </div>
        )}
      </div>

      {/* CUMULATIVE BALANCES CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash Vaults Cumulative */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">إجمالي أرصدة الصناديق التراكمية</span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-white font-mono dir-ltr">
            {cumulativeBalances.cashVaultsBalance.toLocaleString()} <span className="text-xs text-emerald-400 font-sans">YER</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>تحديث تراكمي لحظي فور كل حركة</span>
          </div>
        </div>

        {/* Bank & E-Wallets Cumulative */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">أرصدة البنوك والمحافظ الإلكترونية</span>
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
              <Database size={18} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-white font-mono dir-ltr">
            {cumulativeBalances.bankAccountsBalance.toLocaleString()} <span className="text-xs text-sky-400 font-sans">YER</span>
          </div>
          <div className="text-[11px] text-sky-400 font-bold flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>تحديث رصيد البنك والمحافظ تلقائياً</span>
          </div>
        </div>

        {/* Total Liquid Assets */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">إجمالي النقدية والسيولة التراكمية</span>
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Layers size={18} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-indigo-300 font-mono dir-ltr">
            {cumulativeBalances.totalAssets.toLocaleString()} <span className="text-xs text-indigo-400 font-sans">YER</span>
          </div>
          <div className="text-[11px] text-gray-400 font-medium">
            مجموع الصناديق والبنوك المسندة تلقائياً
          </div>
        </div>

        {/* Offline Queue & Sync Status */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">قيود الأوفلاين المعلقة</span>
            <div className={`p-2 rounded-xl ${offlineCount > 0 ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'}`}>
              <WifiOff size={18} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-white font-mono">
            {offlineCount} <span className="text-xs text-gray-400 font-sans">قيد محفوظ أوفلاين</span>
          </div>
          <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
            {offlineCount > 0 ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <AlertTriangle size={12} />
                جاهزة للمزامنة السحابية
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check size={12} />
                جميع القيود متزامنة بالكامل
              </span>
            )}
          </div>
        </div>
      </div>



      {/* RECENT AUTOMATED JOURNAL ENTRIES TABLE */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="space-y-1">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <FileText className="text-sky-400" size={18} />
              <span>سجل القيود اليومية التلقائية المسندة فورياً (Journal Vouchers Log)</span>
            </h3>
            <p className="text-xs text-gray-400">
              قائمة أحدث القيود التي ولدها محرك الإسناد المحاسبي التلقائي بالدفتر العام سحابياً ومحلياً.
            </p>
          </div>
        </div>

        {loadingJournals ? (
          <div className="p-8 text-center text-gray-400 text-xs font-bold animate-pulse">
            جاري تحميل سجلات القيود التلقائية بالدفتر العام...
          </div>
        ) : recentJournals.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs font-bold">
            لا توجد قيود تلقائية في السجل حالياً. سيتم تسجيل أول قيد فور تنفيذ أي حركة كاشير أو صيانة أو مشتريات.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-gray-300">
              <thead className="bg-slate-950/80 text-gray-400 text-[11px] font-bold border-b border-white/10">
                <tr>
                  <th className="p-3">المرجع / الرقم</th>
                  <th className="p-3">البيان والشرح المحاسبي</th>
                  <th className="p-3">بنود القيد (مدين / دائن)</th>
                  <th className="p-3 text-center">التوازن المالي</th>
                  <th className="p-3">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {recentJournals.map((j) => {
                  const items = j.items || [];
                  const totalDeb = items.reduce((sum: number, it: any) => sum + (Number(it.debit) || 0), 0);
                  const totalCred = items.reduce((sum: number, it: any) => sum + (Number(it.credit) || 0), 0);
                  const isBalanced = Math.abs(totalDeb - totalCred) < 0.01;

                  return (
                    <tr key={j.id} className="hover:bg-white/5 transition-all">
                      <td className="p-3 font-mono font-bold text-sky-400">{j.reference || j.id.slice(-8)}</td>
                      <td className="p-3 max-w-xs font-bold text-white">{j.description}</td>
                      <td className="p-3 space-y-1">
                        {items.slice(0, 3).map((line: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-gray-300 font-sans">{line.accountName || line.accountId}</span>
                            <span className="text-emerald-400 font-bold dir-ltr">
                              {line.debit > 0 ? `+${line.debit.toLocaleString()} YER` : `-${line.credit.toLocaleString()} YER`}
                            </span>
                          </div>
                        ))}
                        {items.length > 3 && (
                          <div className="text-[10px] text-gray-500 font-bold">+ {items.length - 3} بنود أخرى...</div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {isBalanced ? (
                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black">
                            متوازن (100%)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-[10px] font-black">
                            فارق: {Math.abs(totalDeb - totalCred)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-400 text-[11px] font-mono">
                        {j.createdAt?.seconds ? new Date(j.createdAt.seconds * 1000).toLocaleString('ar-YE') : 'الآن'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DEDUCTION MODAL FOR EMPLOYEE/ENGINEER FAULTS AND DAMAGE */}
      <AnimatePresence>
        {showDeductionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <UserCheck className="text-rose-400" size={22} />
                    <span>توليد قيد خصم التالف وأخطاء العمال والمهندسين</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    إنشاء وتصدير قيد تسوية مالي آلي لخصم قيمة المواد التالفة أو أخطاء الصيانة أوفلاين وسحابياً.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeductionModal(false)}
                  className="text-gray-400 hover:text-white bg-slate-800 p-2 rounded-xl border-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {deductionFeedback && (
                <div className={`p-4 rounded-2xl border text-xs font-bold ${deductionFeedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                  {deductionFeedback.msg}
                </div>
              )}

              <form onSubmit={handlePostDeductionSubmit} className="space-y-4">
                {/* Target Type Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300">نوع مسؤولية الخطأ / التلف *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFaultType('employee')}
                      className={`p-2.5 rounded-xl text-xs font-bold cursor-pointer border transition-all ${faultType === 'employee' ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-slate-950/60 border-white/10 text-gray-400'}`}
                    >
                      موظف / عامل
                    </button>
                    <button
                      type="button"
                      onClick={() => setFaultType('engineer')}
                      className={`p-2.5 rounded-xl text-xs font-bold cursor-pointer border transition-all ${faultType === 'engineer' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-950/60 border-white/10 text-gray-400'}`}
                    >
                      مهندس صيانة
                    </button>
                    <button
                      type="button"
                      onClick={() => setFaultType('company_waste')}
                      className={`p-2.5 rounded-xl text-xs font-bold cursor-pointer border transition-all ${faultType === 'company_waste' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-950/60 border-white/10 text-gray-400'}`}
                    >
                      خسارة محل عامة
                    </button>
                  </div>
                </div>

                {/* Staff Dropdown if applicable */}
                {faultType !== 'company_waste' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-300">اختر الموظف / المهندس المسؤول *</label>
                    {employees.length > 0 ? (
                      <select
                        value={selectedStaffId}
                        onChange={(e) => {
                          setSelectedStaffId(e.target.value);
                          const emp = employees.find(x => x.id === e.target.value);
                          if (emp) setSelectedStaffName(emp.name);
                        }}
                        className="w-full bg-slate-950 border border-white/10 text-white p-3 rounded-xl text-xs outline-none focus:border-rose-500"
                      >
                        <option value="">-- اختر من قائمة كادر العمل --</option>
                        {employees.map(e => (
                          <option key={e.id} value={e.id}>
                            {e.name} {e.role ? `(${e.role})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="أدخل اسم الموظف/المهندس..."
                        value={selectedStaffName}
                        onChange={(e) => setSelectedStaffName(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 text-white p-3 rounded-xl text-xs outline-none focus:border-rose-500"
                      />
                    )}
                  </div>
                )}

                {/* Item Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300">اسم المادة التالفة أو مسمى الخطأ *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: شاشة آيفون 13 تالفة أثناء التركيب / قطعة غيار محروقة"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 text-white p-3 rounded-xl text-xs outline-none focus:border-rose-500"
                  />
                </div>

                {/* Cost Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300">مبلغ التكلفة المستقطعة (YER) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="أدخل مبلغ الخصم بالنقدية..."
                    value={costAmount}
                    onChange={(e) => setCostAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 text-white p-3 rounded-xl text-xs font-mono font-bold outline-none focus:border-rose-500 dir-ltr text-right"
                  />
                </div>

                {/* Reason Note */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300">ملاحظات والتفاصيل التشغيلية</label>
                  <input
                    type="text"
                    placeholder="مثال: خصم 50% من الراتب والـ 50% الأخرى تحملها المحل..."
                    value={reasonNote}
                    onChange={(e) => setReasonNote(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 text-white p-3 rounded-xl text-xs outline-none focus:border-rose-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeductionModal(false)}
                    className="px-4 py-2.5 bg-slate-800 text-gray-300 hover:text-white rounded-xl text-xs font-bold border-none cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isPostingDeduction}
                    className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-500/20 border-none cursor-pointer flex items-center gap-2"
                  >
                    {isPostingDeduction && <RefreshCw size={14} className="animate-spin" />}
                    <span>تأكيد وتوليد قيد الخصم والترحيل</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
