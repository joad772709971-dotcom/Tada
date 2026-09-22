import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Layers3, 
  Clock, 
  Filter, 
  Eye, 
  CheckCircle2, 
  Building2, 
  ShoppingCart, 
  Wrench, 
  Smartphone, 
  Package, 
  AlertCircle,
  RefreshCw,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Account, JournalEntry, Vault } from '../types';

interface LiveDisplaysAndAnalyticsProps {
  profile: UserProfile | null;
  accounts?: Account[];
  entries?: JournalEntry[];
  vaults?: Vault[];
}

type DatePreset = 'today' | 'week' | 'month' | 'year' | 'specific' | 'custom';

export default function LiveDisplaysAndAnalytics({ profile, accounts: initialAccounts, entries: initialEntries, vaults: initialVaults }: LiveDisplaysAndAnalyticsProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [specificDate, setSpecificDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [accounts, setAccounts] = useState<Account[]>(initialAccounts || []);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(initialEntries || []);
  const [vaultList, setVaultList] = useState<Vault[]>(initialVaults || []);
  const [salesRecords, setSalesRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(!initialAccounts);

  // Fetch live data if not passed or to keep updated
  useEffect(() => {
    if (!profile?.ownerId) return;
    const ownerId = profile.ownerId;

    // Accounts listener
    const accQuery = query(collection(db, 'accounts'), where('ownerId', '==', ownerId));
    const unsubAcc = onSnapshot(accQuery, (snap) => {
      const accs: Account[] = [];
      snap.forEach(doc => accs.push({ id: doc.id, ...doc.data() } as Account));
      setAccounts(accs);
    }, (err) => console.warn("Error fetching accounts:", err));

    // Journal entries
    const journalQuery = query(collection(db, 'journalEntries'), where('ownerId', '==', ownerId));
    const unsubJournal = onSnapshot(journalQuery, (snap) => {
      const jEntries: JournalEntry[] = [];
      snap.forEach(doc => jEntries.push({ id: doc.id, ...doc.data() } as JournalEntry));
      setJournalEntries(jEntries);
    }, (err) => console.warn("Error fetching journal entries:", err));

    // Vaults
    const vaultQuery = query(collection(db, 'vaults'), where('ownerId', '==', ownerId));
    const unsubVault = onSnapshot(vaultQuery, (snap) => {
      const vList: Vault[] = [];
      snap.forEach(doc => vList.push({ id: doc.id, ...doc.data() } as Vault));
      setVaultList(vList);
    }, (err) => console.warn("Error fetching vaults:", err));

    // Sales transactions for granular detailed category sheets
    const salesQuery = query(collection(db, 'sales'), where('ownerId', '==', ownerId));
    const unsubSales = onSnapshot(salesQuery, (snap) => {
      const sales: any[] = [];
      snap.forEach(doc => sales.push({ id: doc.id, ...doc.data() }));
      setSalesRecords(sales);
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching sales:", err);
      setLoading(false);
    });

    return () => {
      unsubAcc();
      unsubJournal();
      unsubVault();
      unsubSales();
    };
  }, [profile?.ownerId]);

  // Compute date range boundaries based on datePreset
  const rangeBoundaries = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (datePreset === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (datePreset === 'week') {
      const dayOfWeek = now.getDay(); // 0 is Sunday
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59, 999);
    } else if (datePreset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (datePreset === 'year') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (datePreset === 'specific') {
      const parts = specificDate.split('-');
      if (parts.length === 3) {
        start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
        end = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999);
      }
    } else if (datePreset === 'custom') {
      const sParts = startDate.split('-');
      const eParts = endDate.split('-');
      if (sParts.length === 3) start = new Date(parseInt(sParts[0]), parseInt(sParts[1]) - 1, parseInt(sParts[2]), 0, 0, 0, 0);
      if (eParts.length === 3) end = new Date(parseInt(eParts[0]), parseInt(eParts[1]) - 1, parseInt(eParts[2]), 23, 59, 59, 999);
    }

    return { start, end };
  }, [datePreset, specificDate, startDate, endDate]);

  // Helper to test if a record date is in range
  const isDateInRange = (dateVal: any) => {
    if (!dateVal) return true;
    let d: Date;
    if (typeof dateVal?.toDate === 'function') {
      d = dateVal.toDate();
    } else if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
      d = new Date(dateVal);
    } else {
      return true;
    }
    return d >= rangeBoundaries.start && d <= rangeBoundaries.end;
  };

  // Filtered sales & entries
  const filteredSales = useMemo(() => salesRecords.filter(s => isDateInRange(s.timestamp || s.createdAt || s.date)), [salesRecords, rangeBoundaries]);
  const filteredEntries = useMemo(() => journalEntries.filter(e => isDateInRange(e.timestamp || e.createdAt || e.date)), [journalEntries, rangeBoundaries]);

  // Compute metrics for filtered date range
  const totals = useMemo(() => {
    let salesTotal = 0;
    let rechargeSales = 0;
    let maintenanceReceipts = 0;
    let simSales = 0;
    let accessoriesSales = 0;
    let phoneSales = 0;
    let reservationsTotal = 0;
    let wholesaleSales = 0;
    let damagedLosses = 0;
    let purchasesTotal = 0;

    filteredSales.forEach(s => {
      const amount = Number(s.totalAmount || s.price || s.amount || 0);
      salesTotal += amount;
      
      const type = (s.type || s.category || '').toLowerCase();
      if (type.includes('recharge') || type.includes('رصيد') || type.includes('تغذية')) {
        rechargeSales += amount;
      } else if (type.includes('maintenance') || type.includes('صيانة') || type.includes('ورشة')) {
        maintenanceReceipts += amount;
      } else if (type.includes('sim') || type.includes('شريحة') || type.includes('شرائح')) {
        simSales += amount;
      } else if (type.includes('accessory') || type.includes('إكسسوار') || type.includes('ملحقات')) {
        accessoriesSales += amount;
      } else if (type.includes('phone') || type.includes('جوال') || type.includes('هاتف')) {
        phoneSales += amount;
      } else if (type.includes('reservation') || type.includes('حجز') || type.includes('عربون')) {
        reservationsTotal += amount;
      } else if (type.includes('wholesale') || type.includes('جملة') || type.includes('سوق')) {
        wholesaleSales += amount;
      } else if (type.includes('damage') || type.includes('تالف') || type.includes('خسارة')) {
        damagedLosses += amount;
      } else if (type.includes('purchase') || type.includes('شراء') || type.includes('توريد')) {
        purchasesTotal += amount;
      }
    });

    // Also calculate entries debit/credit totals
    let entriesDebitSum = 0;
    let entriesCreditSum = 0;
    filteredEntries.forEach(entry => {
      entry.lines?.forEach(line => {
        entriesDebitSum += Number(line.debit || 0);
        entriesCreditSum += Number(line.credit || 0);
      });
    });

    // Calculated overall assets, liabilities, revenues, expenses from accounts
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalRevenues = 0;
    let totalExpenses = 0;

    accounts.forEach(acc => {
      const bal = Number(acc.balance || 0);
      if (acc.type === 'asset') totalAssets += bal;
      else if (acc.type === 'liability') totalLiabilities += bal;
      else if (acc.type === 'revenue') totalRevenues += bal;
      else if (acc.type === 'expense') totalExpenses += bal;
    });

    const netProfit = totalRevenues - totalExpenses;

    return {
      salesTotal,
      rechargeSales,
      maintenanceReceipts,
      simSales,
      accessoriesSales,
      phoneSales,
      reservationsTotal,
      wholesaleSales,
      damagedLosses,
      purchasesTotal,
      entriesDebitSum,
      entriesCreditSum,
      totalAssets,
      totalLiabilities,
      totalRevenues,
      totalExpenses,
      netProfit
    };
  }, [filteredSales, filteredEntries, accounts]);

  // Total Vault balance sum
  const totalVaultsBalance = useMemo(() => {
    return vaultList.reduce((acc, v) => acc + Number(v.balance || 0), 0);
  }, [vaultList]);

  return (
    <div className="space-y-6 font-sans dir-rtl text-right">
      
      {/* HEADER & DATE RANGE FILTER BAR */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-white/10 shadow-2xl space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-sky-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
              <BarChart3 size={24} />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-white m-0 flex items-center gap-2">
                <span>الشاشات الحية والتقارير الشاملة</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">مباشر ⚡</span>
              </h2>
              <p className="text-xs text-zinc-400 m-0 mt-0.5">
                شاشات العرض التفصيلي الموحدة للعمل، المبيعات، الصناديق، والأرباح مع الفلترة الزمنية المرنة
              </p>
            </div>
          </div>

          <button 
            onClick={() => window.print()}
            className="self-start md:self-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <Printer size={14} />
            <span>طباعة تقرير الشاشة الحية</span>
          </button>
        </div>

        {/* DATE PRESET SELECTOR BAR */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-indigo-300 flex items-center gap-1.5">
              <Filter size={14} />
              <span>تحديد المدى الزمني للشاشات الحية:</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              من: {rangeBoundaries.start.toLocaleDateString('ar-YE')} — إلى: {rangeBoundaries.end.toLocaleDateString('ar-YE')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            
            <button
              onClick={() => setDatePreset('today')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                datePreset === 'today'
                  ? 'bg-gradient-to-r from-indigo-500 to-sky-600 text-white border-indigo-400/30 shadow-md'
                  : 'bg-slate-900/60 text-zinc-400 hover:text-white border-white/5'
              }`}
            >
              اليوم (Today)
            </button>

            <button
              onClick={() => setDatePreset('week')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                datePreset === 'week'
                  ? 'bg-gradient-to-r from-indigo-500 to-sky-600 text-white border-indigo-400/30 shadow-md'
                  : 'bg-slate-900/60 text-zinc-400 hover:text-white border-white/5'
              }`}
            >
              الأسبوع الحالي
            </button>

            <button
              onClick={() => setDatePreset('month')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                datePreset === 'month'
                  ? 'bg-gradient-to-r from-indigo-500 to-sky-600 text-white border-indigo-400/30 shadow-md'
                  : 'bg-slate-900/60 text-zinc-400 hover:text-white border-white/5'
              }`}
            >
              الشهر الحالي
            </button>

            <button
              onClick={() => setDatePreset('year')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                datePreset === 'year'
                  ? 'bg-gradient-to-r from-indigo-500 to-sky-600 text-white border-indigo-400/30 shadow-md'
                  : 'bg-slate-900/60 text-zinc-400 hover:text-white border-white/5'
              }`}
            >
              السنة الحالية
            </button>

            <button
              onClick={() => setDatePreset('specific')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                datePreset === 'specific'
                  ? 'bg-gradient-to-r from-indigo-500 to-sky-600 text-white border-indigo-400/30 shadow-md'
                  : 'bg-slate-900/60 text-zinc-400 hover:text-white border-white/5'
              }`}
            >
              تاريخ محدد 📅
            </button>

            <button
              onClick={() => setDatePreset('custom')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                datePreset === 'custom'
                  ? 'bg-gradient-to-r from-indigo-500 to-sky-600 text-white border-indigo-400/30 shadow-md'
                  : 'bg-slate-900/60 text-zinc-400 hover:text-white border-white/5'
              }`}
            >
              بين تاريخين ↔️
            </button>
          </div>

          {/* DYNAMIC DATE PICKER INPUTS */}
          <AnimatePresence mode="wait">
            {datePreset === 'specific' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2 flex items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-white/5"
              >
                <span className="text-xs font-bold text-zinc-300">اختر اليوم المطلوب:</span>
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  className="bg-slate-950 border border-white/10 text-white px-3 py-1.5 rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                />
              </motion.div>
            )}

            {datePreset === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2 flex flex-wrap items-center gap-4 bg-slate-900/80 p-3 rounded-2xl border border-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-300">من تاريخ:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-slate-950 border border-white/10 text-white px-3 py-1.5 rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-300">إلى تاريخ:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-slate-950 border border-white/10 text-white px-3 py-1.5 rounded-xl text-xs font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

      {/* OVERALL HIGH-LEVEL KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* TOTAL SALES / WORK MOVEMENT */}
        <div className="bg-slate-950/80 p-5 rounded-3xl border border-sky-500/20 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-sky-400">حجم مبيعات الفترة المحددة</span>
            <div className="p-2 bg-sky-500/10 rounded-xl text-sky-400">
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-white tabular-nums">
            {totals.salesTotal.toLocaleString()} <span className="text-xs text-zinc-400 font-bold">YER</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-400 font-semibold flex items-center gap-1">
            <Clock size={12} className="text-sky-400" />
            <span>عدد العمليات المسجلة: {filteredSales.length} عملية</span>
          </div>
        </div>

        {/* NET OPERATING PROFIT */}
        <div className="bg-slate-950/80 p-5 rounded-3xl border border-emerald-500/20 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-emerald-400">صافي الأرباح والإيرادات</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className={`text-xl md:text-2xl font-black tabular-nums ${totals.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totals.netProfit.toLocaleString()} <span className="text-xs text-zinc-400 font-bold">YER</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-400 font-semibold flex items-center gap-1">
            <Coins size={12} className="text-emerald-400" />
            <span>إجمالي الإيرادات: {totals.totalRevenues.toLocaleString()} YER</span>
          </div>
        </div>

        {/* VAULTS & CASH MOVEMENT */}
        <div className="bg-slate-950/80 p-5 rounded-3xl border border-amber-500/20 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-amber-400">إجمالي الصناديق والخزائن</span>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <Wallet size={18} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-amber-400 tabular-nums">
            {totalVaultsBalance.toLocaleString()} <span className="text-xs text-zinc-400 font-bold">YER</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-400 font-semibold flex items-center gap-1">
            <Building2 size={12} className="text-amber-400" />
            <span>عدد الصناديق النشطة: {vaultList.length} صندوق</span>
          </div>
        </div>

        {/* ASSETS & DEBTS SUMMARY */}
        <div className="bg-slate-950/80 p-5 rounded-3xl border border-indigo-500/20 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-indigo-400">إجمالي أصول المنظومة</span>
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Layers3 size={18} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-indigo-300 tabular-nums">
            {totals.totalAssets.toLocaleString()} <span className="text-xs text-zinc-400 font-bold">YER</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-400 font-semibold flex items-center gap-1">
            <CreditCard size={12} className="text-indigo-400" />
            <span>الالتزامات والخصوم: {totals.totalLiabilities.toLocaleString()} YER</span>
          </div>
        </div>

      </div>

      {/* TWO 4x6 ASPECT RATIO PORTRAIT DETAILED LIVE DISPLAY SHEETS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2 m-0">
            <Eye size={16} className="text-indigo-400" />
            <span>شاشات العرض التفصيلي الموحدة (Photo 4x6 Live Sheets)</span>
          </h3>
          <span className="text-[10px] text-zinc-500">حالة الشاشات: تتحدّث تلقائياً لحظة بصلحظة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto py-2">
          
          {/* SHEET 1: CASH & DIRECT SERVICES (شيت المبيعات والخدمات المباشرة) */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 rounded-[2rem] border border-indigo-500/20 shadow-2xl overflow-hidden flex flex-col p-6 relative group transition-transform hover:scale-[1.01] space-y-4">
            <div className="absolute top-3 left-4 text-[8px] tracking-widest text-indigo-400/60 font-mono">JAM SYSTEM PRO • LIVE SHEET 4X6</div>
            
            {/* Visual Header */}
            <div className="border-b border-indigo-500/20 pb-3 text-center">
              <span className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400 inline-block mb-1">
                <Coins size={22} />
              </span>
              <h4 className="font-black text-sm text-indigo-200 m-0">الشيت الأول: المبيعات والخدمات المباشرة</h4>
              <p className="text-[10px] text-zinc-400 mt-1 m-0">عرض تفصيلي لإيرادات الرصيد، الصيانة، الشرايح، والإكسسوارات</p>
            </div>

            {/* Detailed list rows */}
            <div className="space-y-2.5 flex-1 flex flex-col justify-center">
              
              <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Smartphone size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-200">مبيعات سداد الرصيد والكبس</div>
                    <div className="text-[9px] text-zinc-500">يمن موبايل، يو، سبأفون، واي</div>
                  </div>
                </div>
                <div className="text-left font-black text-amber-400 tabular-nums">
                  {totals.rechargeSales.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                </div>
              </div>

              <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
                    <Wrench size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-200">إيرادات ورشة الصيانة والقطع</div>
                    <div className="text-[9px] text-zinc-500">أجور اليد، تصليح الشاشات، صيانة الهاردوير</div>
                  </div>
                </div>
                <div className="text-left font-black text-sky-400 tabular-nums">
                  {totals.maintenanceReceipts.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                </div>
              </div>

              <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-200">عمليات مبيعات الشرايح والتفعيل</div>
                    <div className="text-[9px] text-zinc-500">شرائح جديدة، بدل تالف، تفعيل فورجي</div>
                  </div>
                </div>
                <div className="text-left font-black text-emerald-400 tabular-nums">
                  {totals.simSales.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                </div>
              </div>

              <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                    <Package size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-200">بيع الإكسسوارات والملحقات</div>
                    <div className="text-[9px] text-zinc-500">شواحن، سماعات، زجاج حماية، خازن</div>
                  </div>
                </div>
                <div className="text-left font-black text-purple-400 tabular-nums">
                  {totals.accessoriesSales.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                </div>
              </div>

              <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <Smartphone size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-200">مبيعات الأجهزة والجوالات direct</div>
                    <div className="text-[9px] text-zinc-500">هواتف ذكية جديدة، أجهزة مستخدمة نظيفة</div>
                  </div>
                </div>
                <div className="text-left font-black text-indigo-300 tabular-nums">
                  {totals.phoneSales.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                </div>
              </div>

            </div>

            {/* Footer summary */}
            <div className="border-t border-indigo-500/15 pt-3 flex justify-between items-center text-xs">
              <span className="text-indigo-400 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} /> اعتماد الشيت الحي
              </span>
              <span className="text-white font-black tabular-nums">
                المجموع: {(totals.rechargeSales + totals.maintenanceReceipts + totals.simSales + totals.accessoriesSales + totals.phoneSales).toLocaleString()} ر.ي
              </span>
            </div>
          </div>

          {/* SHEET 2: MARKET, RESERVATIONS & SUPPLIES (شيت الحجوزات والمبيعات الخارجية والتوريد) */}
          <div className="bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 rounded-[2rem] border border-amber-500/20 shadow-2xl overflow-hidden flex flex-col p-6 relative group transition-transform hover:scale-[1.01] space-y-4">
            <div className="absolute top-3 left-4 text-[8px] tracking-widest text-amber-400/60 font-mono">JAM SYSTEM PRO • LIVE SHEET 4X6</div>

            {/* Visual Header */}
            <div className="border-b border-amber-500/20 pb-3 text-center">
              <span className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-400 inline-block mb-1">
                <Layers3 size={22} />
              </span>
              <h4 className="font-black text-sm text-amber-200 m-0">الشيت الثاني: السوق المفتوح والحجوزات والتوريد</h4>
              <p className="text-[10px] text-zinc-400 mt-1 m-0">معاملات حراج الجوالات، العربون، المشتريات، والتوالف</p>
            </div>

            {/* Detailed list rows */}
            <div className="space-y-2.5 flex-1 flex flex-col justify-center">

              <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Clock size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-200">حجوزات الأجهزة والعرابين المسددة</div>
                    <div className="text-[9px] text-zinc-500">حجز أجهزة تحت الطلب مع دفع مقدم عربون</div>
                  </div>
                </div>
                <div className="text-left font-black text-amber-400 tabular-nums">
                  {totals.reservationsTotal.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                </div>
              </div>

              <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-200">مبيعات الجملة والسوق الموزع</div>
                    <div className="text-[9px] text-zinc-500">توزيع المحلات الصديقة والدراجات</div>
                  </div>
                </div>
                <div className="text-left font-black text-sky-400 tabular-nums">
                  {totals.wholesaleSales.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                </div>
              </div>

              <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                    <AlertCircle size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-rose-300">سجل التوالف والفاقد والقطع المعطوبة</div>
                    <div className="text-[9px] text-zinc-500">شطب البضاعة التالفة والتسويات</div>
                  </div>
                </div>
                <div className="text-left font-black text-rose-400 tabular-nums">
                  {totals.damagedLosses.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                </div>
              </div>

              <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <ShoppingCart size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-200">مشتريات نقدية وتوريدات الجرد</div>
                    <div className="text-[9px] text-zinc-500">شراء بضاعة جديدة ومستلزمات صيانة</div>
                  </div>
                </div>
                <div className="text-left font-black text-emerald-400 tabular-nums">
                  {totals.purchasesTotal.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                </div>
              </div>

              <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <BarChart3 size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-200">إجمالي القيود اليومية المحولة</div>
                    <div className="text-[9px] text-zinc-500">حجم حركات المدين والدائن في الدفتر</div>
                  </div>
                </div>
                <div className="text-left font-black text-indigo-300 tabular-nums">
                  {totals.entriesDebitSum.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                </div>
              </div>

            </div>

            {/* Footer summary */}
            <div className="border-t border-amber-500/15 pt-3 flex justify-between items-center text-xs">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} /> اعتماد شيت الجرد والسوق
              </span>
              <span className="text-white font-black tabular-nums">
                مشتريات وتوالف: {(totals.damagedLosses + totals.purchasesTotal).toLocaleString()} ر.ي
              </span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
