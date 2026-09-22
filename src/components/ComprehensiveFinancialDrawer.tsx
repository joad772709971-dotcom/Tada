import React, { useState } from 'react';
import { 
  X, 
  Wallet, 
  TrendingUp, 
  Package, 
  Users, 
  Truck, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Printer, 
  Sparkles, 
  PieChart, 
  Calendar,
  Layers,
  Banknote,
  Activity,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';

interface ComprehensiveFinancialDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  unifiedStats: {
    overallSales: number;
    cashSales: number;
    debtSales: number;
    transferSales: number;
    marketSales: number;
    totalProfit: number;
    marginPercent: number;
    outgoings: number;
    adjustments: number;
    totalCashInBoxes: number;
    totalBankBalance: number;
  };
  vaults: any[];
  inventory: any[];
  allCustomers: any[];
  allSuppliers: any[];
  selectedEmployeeName?: string;
  isOwnerView: boolean;
  onTriggerEOD?: () => void;
}

export const ComprehensiveFinancialDrawer: React.FC<ComprehensiveFinancialDrawerProps> = ({
  isOpen,
  onClose,
  profile,
  unifiedStats,
  vaults,
  inventory,
  allCustomers,
  allSuppliers,
  selectedEmployeeName,
  isOwnerView,
  onTriggerEOD
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'treasury' | 'sales' | 'inventory' | 'debts'>('all');

  if (!isOpen) return null;

  // Calculate Inventory Assets Valuation
  const inventoryValuation = inventory.reduce(
    (acc, item) => {
      const qty = Number(item.stock) || 0;
      const cost = Number(item.cost) || Number(item.buyPrice) || 0;
      const price = Number(item.price) || Number(item.sellPrice) || 0;
      acc.totalItemsCount += qty;
      acc.totalCostValue += qty * cost;
      acc.totalRetailValue += qty * price;
      if (qty <= (item.minStock || 0)) acc.lowStockCount += 1;
      return acc;
    },
    { totalItemsCount: 0, totalCostValue: 0, totalRetailValue: 0, lowStockCount: 0 }
  );

  // Expected potential inventory profit
  const potentialInventoryProfit = Math.max(0, inventoryValuation.totalRetailValue - inventoryValuation.totalCostValue);

  // Calculate Customer Debts (Receivables - لنا)
  const totalCustomerDebts = allCustomers.reduce((sum, c) => sum + (Number(c.debt) || 0), 0);

  // Calculate Supplier Debts (Payables - علينا)
  const totalSupplierPayables = allSuppliers.reduce((sum, s) => sum + (Number(s.debt) || 0), 0);

  // Cash in Hand split by currencies if available
  const yerVaults = vaults.filter(v => !v.currency || v.currency === 'YER');
  const sarVaults = vaults.filter(v => v.currency === 'SAR');
  const usdVaults = vaults.filter(v => v.currency === 'USD');

  const totalYerCash = yerVaults.reduce((sum, v) => sum + (Number(v.balance) || 0), 0);
  const totalSarCash = sarVaults.reduce((sum, v) => sum + (Number(v.balance) || 0), 0);
  const totalUsdCash = usdVaults.reduce((sum, v) => sum + (Number(v.balance) || 0), 0);

  // Net Estimated Financial Position = (Cash + Customer Debts + Inventory Cost) - Supplier Payables
  const netEstimatedPosition = (totalYerCash + totalCustomerDebts + inventoryValuation.totalCostValue) - totalSupplierPayables;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div 
        id="comprehensive-financial-drawer-backdrop"
        className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end transition-opacity"
        onClick={onClose}
      >
        <motion.div
          id="comprehensive-financial-drawer-container"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl bg-slate-50 dark:bg-slate-900 h-full max-h-[100dvh] shadow-2xl flex flex-col overflow-hidden text-right border-r border-slate-200 dark:border-slate-800"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 flex items-center justify-between sticky top-0 z-20 flex-shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg sm:text-xl shadow-sm shrink-0">
                📊
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white truncate">
                    الدرج المالي الشامل للإجماليات
                  </h2>
                  <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    كشف مباشر ✓
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {selectedEmployeeName ? `بيانات الموظف: ${selectedEmployeeName}` : 'إجمالي كافة عمليات ونشاط المتجر بالكامل'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                id="btn-print-drawer"
                onClick={handlePrint}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold active:scale-95"
                title="طباعة الكشف"
              >
                <Printer size={16} />
                <span className="hidden sm:inline">طباعة</span>
              </button>
              <button
                id="btn-close-drawer"
                onClick={onClose}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors active:scale-95"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 py-2 flex gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
            {[
              { id: 'all', label: 'كافة الإجماليات 🌟' },
              { id: 'treasury', label: 'الخزينة والصناديق 💰' },
              { id: 'sales', label: 'المبيعات والأرباح 📈' },
              { id: 'inventory', label: 'أصول المخزون 📦' },
              { id: 'debts', label: 'الديون والذمم 👥' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black whitespace-nowrap transition-all active:scale-95 ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 sm:space-y-6">

            {/* Top Net Worth Card (الموقف المالي الإجمالي) */}
            {(activeTab === 'all' || activeTab === 'treasury') && (
              <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
                  <div>
                    <span className="text-[11px] sm:text-xs font-bold text-indigo-300 block mb-1">
                      المركز المالي التقديري للمتجر (صافي الأصول والسيولة والديون)
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black font-mono tracking-tight text-white">
                        {netEstimatedPosition.toLocaleString()}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-indigo-300">ر.ي</span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-indigo-200/80 mt-1.5 sm:mt-2 leading-relaxed">
                      يشمل: (النقدية في الدرج + ديون العملاء لنا + بضاعة المخزون بالتكلفة) - مستحقات الموردين علينا.
                    </p>
                  </div>
                  {onTriggerEOD && (
                    <button
                      id="btn-drawer-eod"
                      onClick={() => {
                        onTriggerEOD();
                      }}
                      className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                      title="إغلاق الوردية واليومية المالية وتسليم الصندوق"
                    >
                      <Activity size={16} />
                      إقفال وتصفية اليومية (EOD)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Section 1: Treasury & Multi-Currency Boxes */}
            {(activeTab === 'all' || activeTab === 'treasury') && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Wallet className="text-emerald-500 w-5 h-5" />
                    خزينة النقد والصناديق وتفصيل العملات
                  </h3>
                  <span className="text-xs font-bold text-slate-400">
                    عدد الصناديق: {vaults.length || 1}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* YER Box */}
                  <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40">
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 block mb-1">
                      الريال اليمني (YER) 🇾🇪
                    </span>
                    <p className="text-xl font-black font-mono text-emerald-900 dark:text-emerald-300">
                      {totalYerCash.toLocaleString()} <span className="text-xs font-bold">ر.ي</span>
                    </p>
                    <span className="text-[10px] text-emerald-700/80 dark:text-emerald-500 block mt-1">
                      النقد المتوفر في صندوق الكاش
                    </span>
                  </div>

                  {/* SAR Box */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40">
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 block mb-1">
                      الريال السعودي (SAR) 🇸🇦
                    </span>
                    <p className="text-xl font-black font-mono text-amber-900 dark:text-amber-300">
                      {totalSarCash.toLocaleString()} <span className="text-xs font-bold">ر.س</span>
                    </p>
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-500 block mt-1">
                      صناديق ومحافظ العملة السعودية
                    </span>
                  </div>

                  {/* USD Box */}
                  <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-800/40">
                    <span className="text-[11px] font-bold text-blue-800 dark:text-blue-400 block mb-1">
                      الدولار الأمريكي (USD) 🇺🇸
                    </span>
                    <p className="text-xl font-black font-mono text-blue-900 dark:text-blue-300">
                      {totalUsdCash.toLocaleString()} <span className="text-xs font-bold">$</span>
                    </p>
                    <span className="text-[10px] text-blue-700/80 dark:text-blue-500 block mt-1">
                      خزينة الدولار الأجنبي
                    </span>
                  </div>
                </div>

                {/* Vaults detailed list */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                    قائمة الخزائن والحسابات المسجلة:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {vaults.map((v, i) => (
                      <div key={v.id || i} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-200">{v.name || `صندوق #${i + 1}`}</p>
                          <span className="text-[10px] text-slate-400 font-bold">{v.type === 'bank' ? 'حساب بنكي / محفظة' : 'درج كاش عيني'}</span>
                        </div>
                        <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                          {(Number(v.balance) || 0).toLocaleString()} {v.currency || 'ر.ي'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Detailed Sales & Channels */}
            {(activeTab === 'all' || activeTab === 'sales') && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="text-indigo-500 w-5 h-5" />
                    إجمالي حركة المبيعات وتوزيع القنوات اليومية
                  </h3>
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-xs">
                    <span>الهامش: {unifiedStats.marginPercent.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">المبيعات الكاملة</span>
                    <p className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
                      {unifiedStats.overallSales.toLocaleString()} <span className="text-[10px]">ر.ي</span>
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block mb-1">مبيعات نقدية (كاش)</span>
                    <p className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
                      {unifiedStats.cashSales.toLocaleString()} <span className="text-[10px]">ر.ي</span>
                    </p>
                  </div>

                  <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block mb-1">مبيعات آجلة (دين)</span>
                    <p className="text-base font-black font-mono text-amber-700 dark:text-amber-300">
                      {unifiedStats.debtSales.toLocaleString()} <span className="text-[10px]">ر.ي</span>
                    </p>
                  </div>

                  <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 block mb-1">إيداعات وحوالات</span>
                    <p className="text-base font-black font-mono text-blue-700 dark:text-blue-300">
                      {unifiedStats.transferSales.toLocaleString()} <span className="text-[10px]">ر.ي</span>
                    </p>
                  </div>
                </div>

                {/* Profit summary */}
                <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 block">
                      صافي الأرباح المحققة اليوم (الفايدة)
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      فارق سعر البيع والتكلفة بعد خصم المرتجعات
                    </p>
                  </div>
                  <div className="text-left">
                    <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {unifiedStats.totalProfit.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-slate-500 mr-1">ر.ي</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Inventory Valuation & Assets */}
            {(activeTab === 'all' || activeTab === 'inventory') && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Package className="text-amber-500 w-5 h-5" />
                    تقييم أصول المخزون والبضاعة الحالية
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    إجمالي الأصناف: {inventory.length} صنف ({inventoryValuation.totalItemsCount} قطعة)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">
                      قيمة المخزون بسعر التكلفة (رأس المال المجمد)
                    </span>
                    <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
                      {inventoryValuation.totalCostValue.toLocaleString()} <span className="text-xs">ر.ي</span>
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40">
                    <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-400 block mb-1">
                      قيمة المخزون المتوقعة بسعر البيع
                    </span>
                    <p className="text-lg font-black font-mono text-indigo-900 dark:text-indigo-300">
                      {inventoryValuation.totalRetailValue.toLocaleString()} <span className="text-xs">ر.ي</span>
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40">
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 block mb-1">
                      الربح المتوقع عند تصريف المخزون
                    </span>
                    <p className="text-lg font-black font-mono text-emerald-900 dark:text-emerald-300">
                      {potentialInventoryProfit.toLocaleString()} <span className="text-xs">ر.ي</span>
                    </p>
                  </div>
                </div>

                {inventoryValuation.lowStockCount > 0 && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 font-bold">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} />
                      <span>تنبيه: يوجد ({inventoryValuation.lowStockCount}) صنف قارب على النفاد أو وصل للحد الأدنى.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section 4: Debts & Receivables / Payables */}
            {(activeTab === 'all' || activeTab === 'debts') && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="text-cyan-500 w-5 h-5" />
                    كشف الذمم والديون (ما لنا وما علينا)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer Receivables (لنا) */}
                  <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                        <Users size={14} /> ديون العملاء (لنا بالخارج)
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                        {allCustomers.filter(c => Number(c.debt) > 0).length} عميل مدين
                      </span>
                    </div>
                    <p className="text-2xl font-black font-mono text-amber-900 dark:text-amber-300">
                      {totalCustomerDebts.toLocaleString()} <span className="text-xs font-bold">ر.ي</span>
                    </p>
                    <p className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-1">
                      مجموع المبالغ المستحقة لصالح المحل طرف العملاء
                    </p>
                  </div>

                  {/* Supplier Payables (علينا) */}
                  <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                        <Truck size={14} /> مستحقات الموردين (علينا للموردين)
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                        {allSuppliers.filter(s => Number(s.debt) > 0).length} مورد دائن
                      </span>
                    </div>
                    <p className="text-2xl font-black font-mono text-rose-900 dark:text-rose-300">
                      {totalSupplierPayables.toLocaleString()} <span className="text-xs font-bold">ر.ي</span>
                    </p>
                    <p className="text-[10px] text-rose-700/80 dark:text-rose-400 mt-1">
                      مجموع الفواتير والمشتريات الآجلة الواجب سدادها للموردين
                    </p>
                  </div>
                </div>

                {/* Net Balance of Debts */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-bold">
                    فارق الذمم الصافي (ديون العملاء - مستحقات الموردين):
                  </span>
                  <span className={`font-black font-mono ${totalCustomerDebts >= totalSupplierPayables ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {(totalCustomerDebts - totalSupplierPayables).toLocaleString()} ر.ي
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* Footer Action */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center sticky bottom-0 gap-3">
            {onTriggerEOD ? (
              <button
                id="btn-footer-eod"
                onClick={onTriggerEOD}
                className="px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-500 dark:text-amber-300 font-black rounded-xl text-xs flex items-center gap-1.5 transition-colors active:scale-95"
                title="إغلاق الوردية واليومية المالية"
              >
                <Activity size={15} />
                <span>إغلاق الوردية واليومية</span>
              </button>
            ) : (
              <span className="text-xs font-bold text-slate-400">
                نظام إدارة الحسابات المتقدم - Jam System Pro
              </span>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black rounded-xl text-xs hover:opacity-90 transition-opacity active:scale-95 cursor-pointer"
            >
              تم ومتابعة العمل
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
