import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  FileText, 
  Upload, 
  Smartphone, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Filter, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  UserCheck, 
  Wifi, 
  Save, 
  RefreshCw, 
  Layers, 
  PieChart,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Edit2,
  Check
} from 'lucide-react';
import { 
  TelecomOperationRecord, 
  TelecomStatementSummary, 
  TelecomServiceType,
  TelecomPackageCatalogItem 
} from '../../types';
import { smartAccountingService } from '../../services/smartAccountingService';
import { CustomerDebtLinkModal } from './CustomerDebtLinkModal';

interface TelecomPDFStatementEngineProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  ownerId: string;
  onDebtLinked?: (result: { customerName: string; amount: number }) => void;
}

export const TelecomPDFStatementEngine: React.FC<TelecomPDFStatementEngineProps> = ({
  isOpen,
  onClose,
  storeId,
  ownerId,
  onDebtLinked
}) => {
  const [statementText, setStatementText] = useState('');
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusStep, setStatusStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Parsed results
  const [summary, setSummary] = useState<TelecomStatementSummary | null>(null);
  const [operations, setOperations] = useState<TelecomOperationRecord[]>([]);
  const [catalog, setCatalog] = useState<TelecomPackageCatalogItem[]>([]);

  // Time & Category Filters
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'month' | 'year' | 'custom'>('all');
  const [customDate, setCustomDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Debt linking modal state
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [selectedOperationForDebt, setSelectedOperationForDebt] = useState<TelecomOperationRecord | null>(null);

  // Inline row editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateOperation = (id: string, updates: Partial<TelecomOperationRecord>) => {
    setOperations(prev => {
      const updated = prev.map(op => {
        if (op.id === id) {
          const debit = updates.debitAmount !== undefined ? updates.debitAmount : op.debitAmount;
          const selling = updates.sellingPrice !== undefined ? updates.sellingPrice : op.sellingPrice;
          const profit = op.serviceType === 'feed_balance' ? 0 : Math.max(0, selling - debit);
          return {
            ...op,
            ...updates,
            profit
          };
        }
        return op;
      });

      // Recalculate summary
      const nonFeedOps = updated.filter(o => o.serviceType !== 'feed_balance');
      const totalDebit = nonFeedOps.reduce((acc, o) => acc + (o.debitAmount || 0), 0);
      const totalSelling = nonFeedOps.reduce((acc, o) => acc + (o.sellingPrice || 0), 0);
      const totalProfit = nonFeedOps.reduce((acc, o) => acc + (o.profit || 0), 0);
      const totalFeeds = updated.filter(o => o.serviceType === 'feed_balance').reduce((acc, o) => acc + (o.creditAmount || 0), 0);

      setSummary(prevSummary => prevSummary ? {
        ...prevSummary,
        totalCostDeducted: totalDebit,
        totalCustomerSellingPrice: totalSelling,
        totalEstimatedProfit: totalProfit,
        totalBalanceFeedAmount: totalFeeds
      } : null);

      return updated;
    });
  };

  useEffect(() => {
    if (!isOpen || !storeId || !ownerId) return;
    // Load catalog to match prices
    const fetchCatalog = async () => {
      try {
        const cat = await smartAccountingService.getPackageCatalog(storeId, ownerId);
        setCatalog(cat);
      } catch (err) {
        console.warn('Could not load package catalog:', err);
      }
    };
    fetchCatalog();
  }, [isOpen, storeId, ownerId]);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    setErrorMsg('');

    const reader = new FileReader();
    if (file.type === 'application/pdf') {
      reader.onload = () => {
        const base64 = (reader.result as string).replace(/^data:application\/pdf;base64,/, '');
        setPdfBase64(base64);
        processStatement(base64, '');
      };
      reader.readAsDataURL(file);
    } else {
      // Text or CSV
      reader.onload = () => {
        const text = reader.result as string;
        setStatementText(text);
        processStatement('', text);
      };
      reader.readAsText(file);
    }
  };

  const processStatement = async (pdfData: string, textData: string) => {
    setIsProcessing(true);
    setStatusStep('جاري قراءة كشف السداد واستخراج العمليات الحسابية...');
    setErrorMsg('');

    try {
      const result = await smartAccountingService.processTelecomStatement({
        pdfBase64: pdfData || pdfBase64,
        textContent: textData || statementText,
        ownerId,
        storeId,
        catalog
      });

      setSummary(result.summary);
      setOperations(result.operations);
      setSuccessMsg(`تم استخراج وتصنيف ${result.operations.length} حركة سداد بنجاح!`);
    } catch (err: any) {
      console.error('Error parsing telecom statement:', err);
      setErrorMsg('حدث خطأ أثناء معالجة الكشف: ' + err.message);
    } finally {
      setIsProcessing(false);
      setStatusStep('');
    }
  };

  const handleSaveToDatabase = async () => {
    if (operations.length === 0) return;
    setIsSavingBatch(true);
    setErrorMsg('');
    try {
      await smartAccountingService.saveTelecomOperations({
        operations,
        storeId,
        ownerId
      });
      setSuccessMsg(`تم حفظ ${operations.length} عملية بنجاح في قاعدة البيانات.`);
    } catch (err: any) {
      setErrorMsg('فشل حفظ العمليات: ' + err.message);
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleOpenDebtModal = (op: TelecomOperationRecord) => {
    setSelectedOperationForDebt(op);
    setDebtModalOpen(true);
  };

  // Filter operations
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.slice(0, 7);
  const currentYearStr = todayStr.slice(0, 4);

  const filteredOperations = operations.filter(op => {
    // Category filter
    if (categoryFilter !== 'all' && op.serviceType !== categoryFilter) return false;

    // Time filter
    if (timeFilter === 'today' && op.date !== todayStr) return false;
    if (timeFilter === 'month' && !op.date.startsWith(currentMonthStr)) return false;
    if (timeFilter === 'year' && !op.date.startsWith(currentYearStr)) return false;
    if (timeFilter === 'custom' && customDate && op.date !== customDate) return false;

    // Search filter
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return (
        op.operationRef.toLowerCase().includes(t) ||
        op.serviceTitle.toLowerCase().includes(t) ||
        (op.targetNumber && op.targetNumber.includes(t)) ||
        (op.debtCustomerName && op.debtCustomerName.toLowerCase().includes(t))
      );
    }

    return true;
  });

  // Re-compute filtered KPIs
  const activeDebits = filteredOperations.reduce((sum, o) => sum + (o.serviceType !== 'feed_balance' ? o.debitAmount : 0), 0);
  const activeRevenue = filteredOperations.reduce((sum, o) => sum + (o.serviceType !== 'feed_balance' ? o.sellingPrice : 0), 0);
  const activeProfit = filteredOperations.reduce((sum, o) => sum + o.profit, 0);
  const activeFeeds = filteredOperations.reduce((sum, o) => sum + (o.serviceType === 'feed_balance' ? o.creditAmount : 0), 0);

  const getServiceBadge = (type: TelecomServiceType) => {
    switch (type) {
      case 'yemen_mobile_package':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">يمن موبايل باقة</span>;
      case 'yemen_mobile_balance':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-300 border border-red-500/20">يمن موبايل رصيد</span>;
      case 'yemen_4g':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">يمن فورجي 4G</span>;
      case 'you_mtn':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">يو YOU</span>;
      case 'sabafon':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">سبأفون</span>;
      case 'feed_balance':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">تغذية رصيد</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">خدمة أخرى</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn" dir="rtl">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>محرك معالجة كشوفات وتقارير السداد (PDF Engine)</span>
                <span className="text-[11px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                  الهادي أونلاين / الشامل / يمن روبوت
                </span>
              </h3>
              <p className="text-xs text-slate-400">تحليل وتصنيف كشوفات السداد، احتساب الأرباح اللحظية، والربط المباشر بديون العملاء</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-3 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-300 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Upload / Ingestion Section */}
          {operations.length === 0 ? (
            <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-purple-500/60 rounded-3xl p-10 bg-slate-800/30 hover:bg-slate-800/50 transition-all cursor-pointer group"
              >
                <div className="w-20 h-20 mx-auto rounded-3xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-10 h-10" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">ارفع كشف حساب السداد (ملف PDF أو نص)</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  يدعم كشوفات الهادي أونلاين، تطبيق الشامل، كشوفات سداد، العمقي، وبنك الكريمي مع التعرف التلقائي على الباقات والأرقام.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-lg shadow-purple-600/20"
                  >
                    <FileText className="w-4 h-4" />
                    <span>اختيار كشف PDF أو نصي</span>
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.txt,.csv"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
              </div>

              {/* Paste Text Option */}
              <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-right space-y-2">
                <label className="text-xs font-bold text-slate-300 block">أو الصق نص كشف الحساب / رسائل السداد مباشرة:</label>
                <textarea
                  rows={3}
                  value={statementText}
                  onChange={(e) => setStatementText(e.target.value)}
                  placeholder="الصق أسطر كشف الحساب من تطبيق السداد أو واتساب..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!statementText.trim() || isProcessing}
                    onClick={() => processStatement('', statementText)}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    تحليل النص الملصوق
                  </button>
                </div>
              </div>

              {isProcessing && (
                <div className="p-6 bg-slate-800/80 border border-purple-500/30 rounded-2xl flex flex-col items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <span>{statusStep}</span>
                  </div>
                  <p className="text-xs text-slate-400">يتم تصنيف العمليات ومطابقتها مع كتالوج الباقات وحساب هوامش الربح...</p>
                </div>
              )}
            </div>
          ) : (
            /* Results View: KPI Cards, Time Filters, & Data Table */
            <div className="space-y-5">
              
              {/* Top Financial KPI Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl">
                  <span className="block text-[11px] text-slate-400 mb-1">إجمالي الحركات</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-white font-mono">{filteredOperations.length}</span>
                    <span className="text-[10px] text-slate-500">حركة</span>
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl">
                  <span className="block text-[11px] text-amber-400 mb-1">المخصوم من المزود (التكلفة)</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-amber-400 font-mono">{activeDebits.toLocaleString()}</span>
                    <span className="text-[10px] text-amber-400/80">ر.ي</span>
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl">
                  <span className="block text-[11px] text-slate-300 mb-1">إجمالي البيع للزبائن</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-slate-100 font-mono">{activeRevenue.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400">ر.ي</span>
                  </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl">
                  <span className="block text-[11px] text-emerald-400 mb-1 font-bold">صافي الأرباح المحققة</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-emerald-400 font-mono">+{activeProfit.toLocaleString()}</span>
                    <span className="text-[10px] text-emerald-400/80">ر.ي</span>
                  </div>
                </div>

                <div className="bg-cyan-500/10 border border-cyan-500/30 p-3.5 rounded-2xl col-span-2 sm:col-span-1">
                  <span className="block text-[11px] text-cyan-300 mb-1">إجمالي تغذية الرصيد</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-cyan-400 font-mono">{activeFeeds.toLocaleString()}</span>
                    <span className="text-[10px] text-cyan-400/80">ر.ي</span>
                  </div>
                </div>
              </div>

              {/* Time & Category Filter Bar */}
              <div className="p-4 bg-slate-800/50 border border-slate-700/80 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                {/* Time Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 flex items-center gap-1 ml-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>الفترة:</span>
                  </span>
                  {(['all', 'today', 'month', 'year'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTimeFilter(t)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        timeFilter === t
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {t === 'all' && 'كافة الفترات'}
                      {t === 'today' && 'اليوم'}
                      {t === 'month' && 'هذا الشهر'}
                      {t === 'year' && 'هذه السنة'}
                    </button>
                  ))}
                </div>

                {/* Service Category Selector */}
                <div className="flex items-center gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">كافة أنواع الخدمات</option>
                    <option value="yemen_mobile_package">باقات يمن موبايل (مزايا، نت)</option>
                    <option value="yemen_mobile_balance">رصيد يمن موبايل فوري</option>
                    <option value="yemen_4g">يمن فورجي 4G</option>
                    <option value="you_mtn">يو YOU</option>
                    <option value="sabafon">سبأفون</option>
                    <option value="feed_balance">تغذية رصيد</option>
                  </select>

                  <button
                    onClick={() => {
                      setOperations([]);
                      setSummary(null);
                    }}
                    className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1"
                  >
                    مسح وإعادة تحميل
                  </button>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث برقم الهاتف، الرقم المرجعي، مسمى الباقة، أو اسم العميل المقيد عليه الدين..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Operations Table */}
              <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-900/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                        <th className="p-3">التاريخ والوقت</th>
                        <th className="p-3">الرقم المرجعي</th>
                        <th className="p-3">الخدمة / الباقة</th>
                        <th className="p-3">الرقم المستفيد</th>
                        <th className="p-3 text-left">التكلفة (المخصوم)</th>
                        <th className="p-3 text-left">سعر البيع</th>
                        <th className="p-3 text-left">الربح الصافي</th>
                        <th className="p-3 text-center">تعديل الأسعار</th>
                        <th className="p-3 text-center">إجراءات الدين والعملاء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredOperations.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-500 text-xs">
                            لا توجد عمليات مطابقة للفترة أو التصنيف المحدد.
                          </td>
                        </tr>
                      ) : (
                        filteredOperations.map((op, idx) => {
                          const isEditing = editingRowId === op.id;

                          return (
                            <tr key={op.id || idx} className={`transition-colors ${isEditing ? 'bg-purple-950/30' : 'hover:bg-slate-800/30'}`}>
                              <td className="p-3 font-mono text-[11px] text-slate-300">
                                {op.date} <span className="text-slate-500">{op.time}</span>
                              </td>
                              <td className="p-3 font-mono text-[11px] text-slate-400">
                                {op.operationRef}
                              </td>
                              <td className="p-3">
                                {isEditing ? (
                                  <div className="space-y-1">
                                    <input
                                      type="text"
                                      value={op.serviceTitle}
                                      onChange={(e) => handleUpdateOperation(op.id, { serviceTitle: e.target.value })}
                                      className="w-full bg-slate-950 border border-purple-500 rounded px-2 py-1 text-xs text-white"
                                    />
                                    <div>{getServiceBadge(op.serviceType)}</div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <span className="font-bold text-white">{op.serviceTitle}</span>
                                    <div>{getServiceBadge(op.serviceType)}</div>
                                  </div>
                                )}
                              </td>
                              <td className="p-3 font-mono font-bold text-cyan-300">
                                {op.targetNumber || '-'}
                              </td>
                              <td className="p-3 text-left font-mono font-bold text-amber-400">
                                {isEditing && op.serviceType !== 'feed_balance' ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <input
                                      type="number"
                                      value={op.debitAmount}
                                      onChange={(e) => handleUpdateOperation(op.id, { debitAmount: Number(e.target.value) || 0 })}
                                      className="w-20 bg-slate-950 border border-purple-500 rounded px-1.5 py-0.5 text-xs text-left font-mono text-amber-300"
                                    />
                                    <span className="text-[10px]">ر.ي</span>
                                  </div>
                                ) : (
                                  op.serviceType === 'feed_balance' ? '-' : `${op.debitAmount.toLocaleString()} ر.ي`
                                )}
                              </td>
                              <td className="p-3 text-left font-mono font-bold text-slate-200">
                                {isEditing && op.serviceType !== 'feed_balance' ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <input
                                      type="number"
                                      value={op.sellingPrice}
                                      onChange={(e) => handleUpdateOperation(op.id, { sellingPrice: Number(e.target.value) || 0 })}
                                      className="w-20 bg-slate-950 border border-purple-500 rounded px-1.5 py-0.5 text-xs text-left font-mono text-emerald-300"
                                    />
                                    <span className="text-[10px]">ر.ي</span>
                                  </div>
                                ) : (
                                  op.serviceType === 'feed_balance' ? `${op.creditAmount.toLocaleString()} ر.ي (تغذية)` : `${op.sellingPrice.toLocaleString()} ر.ي`
                                )}
                              </td>
                              <td className="p-3 text-left font-mono font-bold text-emerald-400">
                                {op.serviceType === 'feed_balance' ? '-' : `+${op.profit.toLocaleString()} ر.ي`}
                              </td>
                              <td className="p-3 text-center">
                                {isEditing ? (
                                  <button
                                    type="button"
                                    onClick={() => setEditingRowId(null)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 mx-auto shadow"
                                    title="حفظ التعديل"
                                  >
                                    <Check size={12} />
                                    <span>تم</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditingRowId(op.id)}
                                    className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-purple-300 rounded-lg transition-colors mx-auto inline-flex items-center gap-1 text-[11px]"
                                    title="تعديل السعر أو الباقة"
                                  >
                                    <Edit2 size={13} />
                                    <span>تعديل</span>
                                  </button>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {op.serviceType === 'feed_balance' ? (
                                  <span className="text-[10px] text-slate-500">حركة تغذية</span>
                                ) : op.isDebt ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-1 rounded-lg font-bold">
                                    <UserCheck className="w-3 h-3" />
                                    <span>مقيد كدين: {op.debtCustomerName || 'عميل'}</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleOpenDebtModal(op)}
                                    className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1 shadow-sm"
                                    title="تقييد هذا المبلغ كدين في ذمة العميل"
                                  >
                                    <UserCheck className="w-3 h-3 text-amber-400" />
                                    <span>ترحيل لدين عميل</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        {operations.length > 0 && (
          <div className="px-6 py-4 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              إجمالي الحركات المعروضة: <strong className="text-white">{filteredOperations.length}</strong>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                إغلاق
              </button>

              <button
                type="button"
                disabled={isSavingBatch}
                onClick={handleSaveToDatabase}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
              >
                {isSavingBatch ? (
                  <span>جاري الحفظ بالسجلات...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ العمليات في قاعدة البيانات</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Customer Debt Linking Modal */}
      {selectedOperationForDebt && (
        <CustomerDebtLinkModal
          isOpen={debtModalOpen}
          onClose={() => {
            setDebtModalOpen(false);
            setSelectedOperationForDebt(null);
          }}
          storeId={storeId}
          ownerId={ownerId}
          initialData={{
            amount: selectedOperationForDebt.sellingPrice,
            description: `سداد ${selectedOperationForDebt.serviceTitle} للرقم (${selectedOperationForDebt.targetNumber})`,
            sourceType: 'telecom_operation',
            sourceReference: selectedOperationForDebt.id,
            suggestedPhone: selectedOperationForDebt.targetNumber
          }}
          onSuccess={(res) => {
            setSuccessMsg(`تم تقييد دين بقيمة ${res.amount.toLocaleString()} ر.ي على العميل (${res.customerName}) بنجاح!`);
            // Mark operation as debt locally
            setOperations(prev => prev.map(o => 
              o.id === selectedOperationForDebt.id 
                ? { ...o, isDebt: true, debtCustomerName: res.customerName } 
                : o
            ));
            if (onDebtLinked) onDebtLinked(res);
          }}
        />
      )}

    </div>
  );
};
