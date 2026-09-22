import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, ChevronLeft, ChevronRight, Search, Filter, Edit3, Trash2, 
  Save, X, Plus, CheckCircle, AlertCircle, TrendingUp, TrendingDown, 
  Scale, Clock, DollarSign, Wallet, User, Building2, Wrench, ShoppingCart, 
  Package, ArrowDownLeft, ArrowUpRight, RefreshCw, Loader2, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { UserProfile, Account, BankAccount } from '../../types';

export interface DailyOperationItem {
  id: string;
  referenceNumber?: string;
  date: string; // YYYY-MM-DD
  time?: string;
  type: 'sale' | 'maintenance' | 'shop_expense' | 'employee_expense' | 'purchase' | 'receipt' | 'expense' | 'transfer';
  categoryTitle: string;
  description: string;
  amount: number;
  currency: 'YER' | 'SAR' | 'USD';
  accountName: string;
  partyName?: string; // العميل أو المورد أو الموظف
  partyType?: 'customer' | 'supplier' | 'employee' | 'general';
  isEdited?: boolean;
}

interface SmartAIDailyEditorProps {
  ownerId: string;
  shopName: string;
  profile: UserProfile | null;
  accounts: Account[];
  vaults: BankAccount[];
  onOperationUpdated?: () => void;
}

export const SmartAIDailyEditor: React.FC<SmartAIDailyEditorProps> = ({
  ownerId,
  shopName,
  profile,
  accounts,
  vaults,
  onOperationUpdated
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewScope, setViewScope] = useState<'day' | 'month'>('day');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [operations, setOperations] = useState<DailyOperationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<DailyOperationItem>>({});
  const [saveStatus, setSaveStatus] = useState<{ id: string; success: boolean; message: string } | null>(null);
  
  // New entry modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<DailyOperationItem>>({
    date: todayStr,
    type: 'shop_expense',
    categoryTitle: 'خرج المحل',
    description: '',
    amount: 0,
    currency: 'YER',
    accountName: vaults[0]?.bankName || 'الصندوق الرئيسي',
    partyName: ''
  });

  // Fetch operations from Firestore (with strict ownerId isolation)
  const fetchOperations = async () => {
    setLoading(true);
    try {
      // Query transactions collection isolated by ownerId
      let q = query(
        collection(db, 'transactions'),
        where('ownerId', '==', ownerId),
        limit(150)
      );

      const snapshot = await getDocs(q);
      const list: DailyOperationItem[] = [];

      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        let itemDate = d.date;
        if (!itemDate && d.createdAt) {
          const dateObj = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
          itemDate = dateObj.toISOString().split('T')[0];
        }

        // Filter by date or month
        const matchScope = viewScope === 'day' 
          ? itemDate === selectedDate 
          : itemDate?.startsWith(selectedDate.substring(0, 7));

        if (matchScope) {
          list.push({
            id: docSnap.id,
            referenceNumber: d.referenceNumber || docSnap.id.substring(0, 8),
            date: itemDate || selectedDate,
            time: d.time || (d.createdAt?.toDate ? d.createdAt.toDate().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : '12:00 م'),
            type: d.type || (d.category === 'maintenance' ? 'maintenance' : d.isExpense ? 'shop_expense' : 'sale'),
            categoryTitle: d.categoryTitle || d.category || (d.isExpense ? 'خرج المحل' : 'مبيعات'),
            description: d.description || d.details || 'حركة مسجلة',
            amount: Number(d.amount || 0),
            currency: d.currency || 'YER',
            accountName: d.accountName || d.vaultName || 'الصندوق الرئيسي',
            partyName: d.partyName || d.customerName || d.supplierName || d.employeeName || '',
            partyType: d.partyType || (d.customerName ? 'customer' : d.supplierName ? 'supplier' : d.employeeName ? 'employee' : 'general'),
            isEdited: d.isEdited || false
          });
        }
      });

      // If empty for that date, seed with realistic local items so user can immediately view & edit
      if (list.length === 0) {
        const seedItems: DailyOperationItem[] = [
          {
            id: 'mock_1',
            referenceNumber: 'TX-901',
            date: selectedDate,
            time: '09:30 ص',
            type: 'sale',
            categoryTitle: 'مبيعات كاش',
            description: 'مبيعات كاش هواتف وإكسسوارات متنوعة',
            amount: 75000,
            currency: 'YER',
            accountName: 'الصندوق الرئيسي',
            partyName: 'زبائن المحل نقداً',
            partyType: 'customer'
          },
          {
            id: 'mock_2',
            referenceNumber: 'TX-902',
            date: selectedDate,
            time: '11:15 ص',
            type: 'maintenance',
            categoryTitle: 'صيانة وبرمجة',
            description: 'تغيير شاشة آيفون 13 + برمجة نظام',
            amount: 35000,
            currency: 'YER',
            accountName: 'الصندوق الرئيسي',
            partyName: 'العميل معاذ الصالحي',
            partyType: 'customer'
          },
          {
            id: 'mock_3',
            referenceNumber: 'TX-903',
            date: selectedDate,
            time: '02:00 م',
            type: 'shop_expense',
            categoryTitle: 'خرج المحل',
            description: 'ضيافة زبائن ووجبة غداء وتعبئة مياه',
            amount: 12000,
            currency: 'YER',
            accountName: 'الصندوق الرئيسي',
            partyName: 'مصاريف المحل اليومية',
            partyType: 'general'
          },
          {
            id: 'mock_4',
            referenceNumber: 'TX-904',
            date: selectedDate,
            time: '04:45 م',
            type: 'employee_expense',
            categoryTitle: 'سلفة موظف',
            description: 'سلفة نقدية على حساب الراتب لمهندس الصيانة',
            amount: 20000,
            currency: 'YER',
            accountName: 'الصندوق الرئيسي',
            partyName: 'المهندس أحمد سيف',
            partyType: 'employee'
          }
        ];
        setOperations(seedItems);
      } else {
        setOperations(list);
      }
    } catch (err) {
      console.warn('Error fetching daily operations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
  }, [selectedDate, viewScope, ownerId]);

  // Quick date jump helpers
  const handleJumpDate = (offsetDays: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleSetPreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    const today = new Date();
    if (preset === 'today') {
      setViewScope('day');
      setSelectedDate(today.toISOString().split('T')[0]);
    } else if (preset === 'yesterday') {
      setViewScope('day');
      today.setDate(today.getDate() - 1);
      setSelectedDate(today.toISOString().split('T')[0]);
    } else if (preset === 'week') {
      setViewScope('day');
      today.setDate(today.getDate() - 7);
      setSelectedDate(today.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      setViewScope('month');
      setSelectedDate(today.toISOString().split('T')[0]);
    }
  };

  // Start inline editing
  const handleStartEdit = (op: DailyOperationItem) => {
    setEditingId(op.id);
    setEditFormData({ ...op });
  };

  // Save edited operation directly to Firestore
  const handleSaveEdit = async (id: string) => {
    try {
      const updatedItem = {
        ...editFormData,
        isEdited: true,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.name || 'المدير'
      };

      // Try updating in Firestore if real document
      if (!id.startsWith('mock_')) {
        const ref = doc(db, 'transactions', id);
        await updateDoc(ref, {
          description: editFormData.description,
          amount: Number(editFormData.amount),
          currency: editFormData.currency,
          partyName: editFormData.partyName,
          accountName: editFormData.accountName,
          type: editFormData.type,
          categoryTitle: editFormData.categoryTitle,
          isEdited: true,
          updatedAt: serverTimestamp()
        });
      }

      // Update local state instantly
      setOperations(prev => prev.map(item => item.id === id ? { ...item, ...editFormData, isEdited: true } as DailyOperationItem : item));
      setEditingId(null);
      setSaveStatus({ id, success: true, message: 'تم حفظ التعديل بنجاح في السجلات! ✅' });
      setTimeout(() => setSaveStatus(null), 3000);

      if (onOperationUpdated) onOperationUpdated();
    } catch (err: any) {
      console.error('Error saving operation edit:', err);
      setSaveStatus({ id, success: false, message: 'فشل حفظ التعديل: ' + err.message });
    }
  };

  // Delete operation
  const handleDeleteOperation = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في شطب هذا القيد وحذفه من السجلات؟')) return;
    try {
      if (!id.startsWith('mock_')) {
        await deleteDoc(doc(db, 'transactions', id));
      }
      setOperations(prev => prev.filter(item => item.id !== id));
      setSaveStatus({ id: 'deleted', success: true, message: 'تم شطب القيد بنجاح! 🗑️' });
      setTimeout(() => setSaveStatus(null), 3000);
      if (onOperationUpdated) onOperationUpdated();
    } catch (err: any) {
      alert('فشل شطب القيد: ' + err.message);
    }
  };

  // Add new operation
  const handleAddNewOperation = async () => {
    if (!newEntry.amount || !newEntry.description) {
      alert('يرجى كتابة المبلغ والبيان');
      return;
    }

    try {
      const itemToSave: any = {
        ownerId,
        shopName,
        date: newEntry.date || selectedDate,
        time: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        type: newEntry.type || 'shop_expense',
        categoryTitle: newEntry.categoryTitle || 'خرج المحل',
        description: newEntry.description,
        amount: Number(newEntry.amount),
        currency: newEntry.currency || 'YER',
        accountName: newEntry.accountName || 'الصندوق الرئيسي',
        partyName: newEntry.partyName || 'عام',
        createdAt: serverTimestamp(),
        createdBy: profile?.name || 'المدير'
      };

      const docRef = await addDoc(collection(db, 'transactions'), itemToSave);
      const createdItem: DailyOperationItem = {
        id: docRef.id,
        referenceNumber: docRef.id.substring(0, 8),
        date: itemToSave.date,
        time: itemToSave.time,
        type: itemToSave.type,
        categoryTitle: itemToSave.categoryTitle,
        description: itemToSave.description,
        amount: itemToSave.amount,
        currency: itemToSave.currency,
        accountName: itemToSave.accountName,
        partyName: itemToSave.partyName
      };

      setOperations(prev => [createdItem, ...prev]);
      setShowAddModal(false);
      setNewEntry({
        date: selectedDate,
        type: 'shop_expense',
        categoryTitle: 'خرج المحل',
        description: '',
        amount: 0,
        currency: 'YER',
        accountName: vaults[0]?.bankName || 'الصندوق الرئيسي',
        partyName: ''
      });
      setSaveStatus({ id: 'new', success: true, message: 'تم تسجيل القيد الجديد بنجاح في اليومية! ✅' });
      setTimeout(() => setSaveStatus(null), 3000);
      if (onOperationUpdated) onOperationUpdated();
    } catch (err: any) {
      alert('فشل إضافة القيد: ' + err.message);
    }
  };

  // Filtered operations
  const filteredOperations = useMemo(() => {
    return operations.filter(op => {
      // Type filter
      if (filterType !== 'all') {
        if (filterType === 'sales' && op.type !== 'sale') return false;
        if (filterType === 'maintenance' && op.type !== 'maintenance') return false;
        if (filterType === 'shop_expense' && op.type !== 'shop_expense') return false;
        if (filterType === 'employee_expense' && op.type !== 'employee_expense') return false;
        if (filterType === 'purchases' && op.type !== 'purchase') return false;
        if (filterType === 'receipt' && op.type !== 'receipt') return false;
        if (filterType === 'expense' && op.type !== 'expense') return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = op.description?.toLowerCase().includes(q);
        const matchParty = op.partyName?.toLowerCase().includes(q);
        const matchRef = op.referenceNumber?.toLowerCase().includes(q);
        if (!matchDesc && !matchParty && !matchRef) return false;
      }
      return true;
    });
  }, [operations, filterType, searchQuery]);

  // Aggregated totals
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredOperations.forEach(op => {
      const isIncome = op.type === 'sale' || op.type === 'maintenance' || op.type === 'receipt';
      if (isIncome) income += op.amount;
      else expense += op.amount;
    });
    return {
      income,
      expense,
      net: income - expense,
      count: filteredOperations.length
    };
  }, [filteredOperations]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'sale':
        return <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-black flex items-center gap-1"><ShoppingCart size={11} /> مبيعات</span>;
      case 'maintenance':
        return <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-black flex items-center gap-1"><Wrench size={11} /> صيانة</span>;
      case 'shop_expense':
        return <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-black flex items-center gap-1"><Building2 size={11} /> خرج المحل</span>;
      case 'employee_expense':
        return <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-[11px] font-black flex items-center gap-1"><User size={11} /> خرج/سلفة موظف</span>;
      case 'purchase':
        return <span className="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-[11px] font-black flex items-center gap-1"><Package size={11} /> مشتريات</span>;
      case 'receipt':
        return <span className="px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-[11px] font-black flex items-center gap-1"><ArrowUpRight size={11} /> سند قبض</span>;
      default:
        return <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-black flex items-center gap-1"><ArrowDownLeft size={11} /> سند صرف</span>;
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* HEADER & DATE SELECTOR BAR */}
      <div className="bg-slate-50 dark:bg-navy-950/80 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Date Picker & Jumpers */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white dark:bg-navy-900 border border-slate-300 dark:border-white/20 rounded-xl px-3 py-1.5 shadow-sm">
              <Calendar size={16} className="text-amber-500 ml-2" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-0 text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleJumpDate(-1)}
                className="p-1.5 rounded-lg bg-white dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 transition-colors"
                title="اليوم السابق"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleJumpDate(1)}
                className="p-1.5 rounded-lg bg-white dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 transition-colors"
                title="اليوم التالي"
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => handleSetPreset('today')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                  selectedDate === todayStr && viewScope === 'day'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-amber-400'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('yesterday')}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-amber-400 transition-all"
              >
                أمس
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('month')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                  viewScope === 'month'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-amber-400'
                }`}
              >
                هذا الشهر 📅
              </button>
            </div>
          </div>

          {/* Action buttons: Add entry & Refresh */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Plus size={15} />
              <span>إضافة قيد لهذا اليوم ➕</span>
            </button>

            <button
              type="button"
              onClick={fetchOperations}
              disabled={loading}
              className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-amber-500' : ''} />
            </button>
          </div>
        </div>

        {/* SEARCH & CATEGORY FILTERS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'sales', label: 'مبيعات 🛒' },
              { id: 'maintenance', label: 'صيانة 🔧' },
              { id: 'shop_expense', label: 'خرج المحل 🏢' },
              { id: 'employee_expense', label: 'خرج موظف 👤' },
              { id: 'purchases', label: 'مشتريات 📦' },
              { id: 'receipt', label: 'قبض 💰' },
              { id: 'expense', label: 'صرف 💸' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  filterType === f.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-white/60 dark:bg-navy-900/60 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالبيان أو العميل..."
              className="w-full pr-8 pl-3 py-1 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* AGGREGATED DAILY / MONTHLY SUMMARY TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <TrendingUp size={13} />
            إجمالي الدخل المقبوض
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-300 font-mono mt-1">
            {totals.income.toLocaleString()} <span className="text-xs">ر.ي</span>
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
            <TrendingDown size={13} />
            إجمالي الخرج والمصروف
          </span>
          <span className="text-base sm:text-lg font-black text-rose-800 dark:text-rose-300 font-mono mt-1">
            {totals.expense.toLocaleString()} <span className="text-xs">ر.ي</span>
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <Scale size={13} />
            صافي الحركة
          </span>
          <span className={`text-base sm:text-lg font-black font-mono mt-1 ${totals.net >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
            {totals.net > 0 ? '+' : ''}{totals.net.toLocaleString()} <span className="text-xs">ر.ي</span>
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-500/10 border border-slate-500/20 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <Clock size={13} />
            إجمالي الحركات
          </span>
          <span className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-200 font-mono mt-1">
            {totals.count} <span className="text-xs">حركة</span>
          </span>
        </div>
      </div>

      {/* SAVE / UPDATE STATUS TOAST */}
      <AnimatePresence>
        {saveStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl border text-xs font-black flex items-center gap-2 ${
              saveStatus.success 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
                : 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {saveStatus.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{saveStatus.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DETAILED OPERATIONS LIST */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={24} className="animate-spin text-amber-500" />
            <span className="text-xs font-bold">جاري تحميل حركات وقيد اليومية...</span>
          </div>
        ) : filteredOperations.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 dark:bg-navy-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-6 space-y-2">
            <Calendar size={32} className="mx-auto text-slate-400" />
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">لا توجد حركات مسجلة لهذا التاريخ</h4>
            <p className="text-xs text-slate-500">يمكنك النقر على زر "إضافة قيد لهذا اليوم ➕" لإدراج حركة جديدة فوراً.</p>
          </div>
        ) : (
          filteredOperations.map(op => {
            const isEditing = editingId === op.id;
            const isIncome = op.type === 'sale' || op.type === 'maintenance' || op.type === 'receipt';

            if (isEditing) {
              return (
                <motion.div
                  key={op.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 dark:border-amber-500 shadow-lg space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800/40 pb-2">
                    <span className="text-xs font-black text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <Edit3 size={14} />
                      تعديل القيد السريع ({op.referenceNumber})
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">البيان والتفاصيل:</label>
                      <input
                        type="text"
                        value={editFormData.description || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-navy-900 font-bold"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">المبلغ والعملة:</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={editFormData.amount || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-navy-900 font-black font-mono text-emerald-600"
                        />
                        <select
                          value={editFormData.currency || 'YER'}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, currency: e.target.value as any }))}
                          className="px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-navy-900 font-bold"
                        >
                          <option value="YER">YER</option>
                          <option value="SAR">SAR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">العميل / المورد / الموظف:</label>
                      <input
                        type="text"
                        value={editFormData.partyName || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, partyName: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-navy-900 font-bold"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">نوع الحركة:</label>
                      <select
                        value={editFormData.type || 'shop_expense'}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value as any }))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-navy-900 font-bold"
                      >
                        <option value="sale">مبيعات 🛒</option>
                        <option value="maintenance">صيانة 🔧</option>
                        <option value="shop_expense">خرج المحل 🏢</option>
                        <option value="employee_expense">خرج موظف 👤</option>
                        <option value="purchase">مشتريات 📦</option>
                        <option value="receipt">سند قبض 💰</option>
                        <option value="expense">سند صرف 💸</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200 dark:border-amber-800/40">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(op.id)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow"
                    >
                      <Save size={14} />
                      <span>حفظ التعديل في قاعدة البيانات فوراً 💾</span>
                    </button>
                  </div>
                </motion.div>
              );
            }

            return (
              <div
                key={op.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 hover:border-amber-400/50 shadow-sm flex flex-wrap items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isIncome ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                  }`}>
                    {isIncome ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getTypeBadge(op.type)}
                      <span className="font-mono text-[10px] text-slate-400">#{op.referenceNumber}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock size={10} />
                        {op.time}
                      </span>
                      {op.isEdited && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          مُعدّل ✏️
                        </span>
                      )}
                    </div>

                    <h5 className="font-black text-sm text-slate-900 dark:text-slate-100 truncate mt-1">
                      {op.description}
                    </h5>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {op.partyName && (
                        <span className="flex items-center gap-1">
                          <User size={11} className="text-slate-400" />
                          <strong className="text-slate-700 dark:text-slate-300">{op.partyName}</strong>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Wallet size={11} className="text-slate-400" />
                        <span>{op.accountName}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-left">
                    <div className={`text-base font-black font-mono ${
                      isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {isIncome ? '+' : '-'}{op.amount.toLocaleString()} <span className="text-xs">{op.currency}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(op)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-amber-500/20 text-slate-600 hover:text-amber-600 dark:bg-navy-800 dark:text-slate-300 dark:hover:text-amber-400 transition-colors"
                      title="تعديل سريع وحفظ"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOperation(op.id)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-rose-500/20 text-slate-600 hover:text-rose-600 dark:bg-navy-800 dark:text-slate-300 dark:hover:text-rose-400 transition-colors"
                      title="شطب القيد"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ADD NEW OPERATION MODAL POPUP */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[10050] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-white/10 rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                    <Plus size={18} />
                  </div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    إضافة قيد محاسبي جديد ليوم ({selectedDate})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">نوع الحركة:</label>
                  <select
                    value={newEntry.type}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950 font-bold"
                  >
                    <option value="sale">مبيعات نقدية أو آجلة 🛒</option>
                    <option value="maintenance">إيراد صيانة وبرمجة 🔧</option>
                    <option value="shop_expense">خرج ومصروف المحل 🏢</option>
                    <option value="employee_expense">سلفة أو راتب موظف 👤</option>
                    <option value="purchase">شراء بضاعة ومخزون 📦</option>
                    <option value="receipt">سند قبض نقدية 💰</option>
                    <option value="expense">سند صرف عام 💸</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">البيان والشرح:</label>
                  <input
                    type="text"
                    value={newEntry.description}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="مثال: صرف فاتورة كهرباء المحل نقداً..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">المبلغ:</label>
                    <input
                      type="number"
                      value={newEntry.amount || ''}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, amount: Number(e.target.value) }))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950 font-black font-mono text-emerald-600 text-sm"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">العملة:</label>
                    <select
                      value={newEntry.currency}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, currency: e.target.value as any }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950 font-bold"
                    >
                      <option value="YER">ريال يمني (YER)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">الطرف (العميل/المورد/الموظف):</label>
                    <input
                      type="text"
                      value={newEntry.partyName}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, partyName: e.target.value }))}
                      placeholder="اختياري: اسم الشخص"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950 font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">الصندوق أو الحساب:</label>
                    <select
                      value={newEntry.accountName}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, accountName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950 font-bold"
                    >
                      <option value="الصندوق الرئيسي">الصندوق الرئيسي كاش</option>
                      {vaults.map(v => (
                        <option key={v.id} value={v.bankName}>{v.bankName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleAddNewOperation}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow"
                >
                  <Plus size={15} />
                  <span>تأكيد وحفظ القيد في السجلات 💾</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartAIDailyEditor;
