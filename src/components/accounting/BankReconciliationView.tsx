import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Scale, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  FileText, 
  ArrowRightLeft, 
  Download, 
  Plus, 
  Search, 
  Filter, 
  Check, 
  X, 
  Loader2, 
  DollarSign, 
  ShieldCheck,
  History,
  Lock,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Account, Vault, JournalEntry, UserProfile, BankReconciliation } from '../../types';
import { financialAuditService } from '../../services/financialAuditService';

interface BankReconciliationViewProps {
  profile: UserProfile;
  accounts: Account[];
  vaults: Vault[];
  onOpenJournalVoucher?: () => void;
}

interface ReconciliationTxItem {
  id: string;
  entryId: string;
  date: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  amount: number;
  type: 'deposit' | 'withdrawal';
  reconciled: boolean;
  reconciledAt?: any;
}

export const BankReconciliationView: React.FC<BankReconciliationViewProps> = ({
  profile,
  accounts = [],
  vaults = [],
  onOpenJournalVoucher
}) => {
  const ownerId = profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';

  // Bank / Account Selection
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [statementDate, setStatementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statementBalanceInput, setStatementBalanceInput] = useState<string>('');
  const [reconciliationNotes, setReconciliationNotes] = useState<string>('');

  // Transactions & Matching
  const [transactions, setTransactions] = useState<ReconciliationTxItem[]>([]);
  const [checkedTxIds, setCheckedTxIds] = useState<Set<string>>(new Set());
  const [isLoadingTxs, setIsLoadingTxs] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Past Reconciliation Sessions History
  const [pastReconciliations, setPastReconciliations] = useState<BankReconciliation[]>([]);
  const [activeTab, setActiveTab] = useState<'reconcile' | 'history'>('reconcile');

  // Filter bank/vault eligible accounts (Assets: Bank, Cash, Vaults)
  const bankAccounts = useMemo(() => {
    return accounts.filter(
      acc => acc.type === 'asset' || acc.accountNumber?.startsWith('1') || acc.accountName?.includes('بنك') || acc.accountName?.includes('صندوق') || acc.accountName?.includes('حساب')
    );
  }, [accounts]);

  // Set default selected account on mount
  useEffect(() => {
    if (!selectedAccountId && bankAccounts.length > 0) {
      setSelectedAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, selectedAccountId]);

  // Selected Account details
  const currentAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  // Load Transactions for the selected account from journalEntries
  useEffect(() => {
    if (!ownerId || !selectedAccountId) return;

    setIsLoadingTxs(true);
    const q = query(
      collection(db, 'journalEntries'),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ReconciliationTxItem[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as JournalEntry;
        if (!data.items || data.status === 'rejected') return;

        // Find if this entry has a line for selectedAccountId
        data.items.forEach((line, lineIdx) => {
          if (line.accountId === selectedAccountId || line.accountName === currentAccount?.accountName) {
            const deb = Number(line.debit || 0);
            const cred = Number(line.credit || 0);
            const isDeposit = deb > 0;
            const amt = isDeposit ? deb : cred;
            
            const rawDate = data.date?.toDate ? data.date.toDate().toISOString().split('T')[0] : (typeof data.date === 'string' ? data.date : new Date().toISOString().split('T')[0]);

            items.push({
              id: `${docSnap.id}_${lineIdx}`,
              entryId: docSnap.id,
              date: rawDate,
              description: data.description || 'حركة بنكية',
              reference: data.reference || `JV-${docSnap.id.slice(-5)}`,
              debit: deb,
              credit: cred,
              amount: amt,
              type: isDeposit ? 'deposit' : 'withdrawal',
              reconciled: !!line.reconciled || (docSnap.data() as any).reconciled || false,
              reconciledAt: line.reconciledAt || (docSnap.data() as any).reconciledAt
            });
          }
        });
      });

      setTransactions(items);
      setIsLoadingTxs(false);
    }, (err) => {
      console.warn("Failed fetching entries for reconciliation:", err);
      setIsLoadingTxs(false);
    });

    return () => unsubscribe();
  }, [ownerId, selectedAccountId, currentAccount]);

  // Load Past Reconciliations
  useEffect(() => {
    if (!ownerId) return;
    const q = query(
      collection(db, 'bankReconciliations'),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const past = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BankReconciliation));
      setPastReconciliations(past);
    });

    return () => unsubscribe();
  }, [ownerId]);

  // Toggle single item matching
  const toggleItemMatch = (id: string) => {
    setCheckedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Match all visible
  const toggleSelectAll = () => {
    if (checkedTxIds.size === transactions.length) {
      setCheckedTxIds(new Set());
    } else {
      setCheckedTxIds(new Set(transactions.map(t => t.id)));
    }
  };

  // Mathematical Calculations
  const bookBalance = currentAccount ? Number(currentAccount.balance || 0) : 0;
  const statementBalance = parseFloat(statementBalanceInput) || 0;

  // Reconciled / Matched items math
  const { 
    matchedDeposits, 
    matchedWithdrawals, 
    unclearedDeposits, 
    unclearedWithdrawals 
  } = useMemo(() => {
    let mDep = 0;
    let mWith = 0;
    let uDep = 0;
    let uWith = 0;

    transactions.forEach(tx => {
      const isChecked = checkedTxIds.has(tx.id) || tx.reconciled;
      if (isChecked) {
        if (tx.type === 'deposit') mDep += tx.amount;
        else mWith += tx.amount;
      } else {
        if (tx.type === 'deposit') uDep += tx.amount;
        else uWith += tx.amount;
      }
    });

    return {
      matchedDeposits: mDep,
      matchedWithdrawals: mWith,
      unclearedDeposits: uDep,
      unclearedWithdrawals: uWith
    };
  }, [transactions, checkedTxIds]);

  // Adjusted Bank Balance = Statement Balance + Uncleared Deposits - Uncleared Withdrawals
  const adjustedBankBalance = statementBalance + unclearedDeposits - unclearedWithdrawals;
  const difference = Math.abs(bookBalance - adjustedBankBalance);
  const isReconciled = difference < 0.01 && (statementBalanceInput !== '');

  // Save Reconciliation Record
  const handleSaveReconciliation = async (status: 'completed' | 'draft') => {
    if (!selectedAccountId || !currentAccount) {
      setFeedbackMessage({ type: 'error', text: 'يرجى تحديد الحساب البنكي أولاً.' });
      return;
    }

    if (statementBalanceInput === '') {
      setFeedbackMessage({ type: 'error', text: 'يرجى إدخال رصيد كشف حساب البنك الفعلي.' });
      return;
    }

    setIsSaving(true);
    setFeedbackMessage(null);
    try {
      const matchedEntriesList: string[] = [];
      transactions.forEach(t => {
        if (checkedTxIds.has(t.id)) {
          matchedEntriesList.push(t.entryId);
        }
      });

      await financialAuditService.saveBankReconciliation(ownerId, {
        accountId: selectedAccountId,
        accountName: currentAccount.accountName,
        statementDate,
        statementBalance,
        bookBalance,
        reconciledBalance: adjustedBankBalance,
        difference,
        matchedEntryIds: matchedEntriesList,
        unclearedDeposits,
        unclearedWithdrawals,
        notes: reconciliationNotes,
        status,
        operator: {
          uid: profile?.uid || 'admin',
          name: profile?.displayName || profile?.name || 'المحاسب',
          role: profile?.role || 'محاسب'
        }
      });

      setFeedbackMessage({
        type: 'success',
        text: status === 'completed'
          ? 'تم بنجاح إقفال واعتماد مذكرة التسوية والمطابقة البنكية وتحديث القيود!'
          : 'تم حفظ مسودة مذكرة التسوية البنكية بنجاح.'
      });
      setCheckedTxIds(new Set());
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: 'فشل حفظ التسوية: ' + (err?.message || err) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-xs font-black flex items-center gap-1">
              <Building2 size={13} />
              <span>نظام المطابقة والتسوية البنكية</span>
            </span>
            <span className="p-1 px-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[11px] font-bold">
              Bank Reconciliation Engine
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5 mt-2">
            <Scale className="text-indigo-400" size={24} />
            <span>شاشة التسوية البنكية ومطابقة كشوفات الحساب</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            مطابقة كشوفات الحسابات البنكية ومحافظ الصرافين مع حركات النظام وتحديد الإيداعات والسحوبات المعلقة والفوارق آلياً.
          </p>
        </div>

        {/* Tab switch */}
        <div className="bg-slate-950 p-1.5 rounded-2xl border border-white/10 flex items-center gap-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('reconcile')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer border-none flex items-center gap-1.5 ${
              activeTab === 'reconcile'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowRightLeft size={14} />
            <span>جلسة المطابقة الحالية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer border-none flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <History size={14} />
            <span>أرشيف التسويات السابقة ({pastReconciliations.length})</span>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${
          feedbackMessage.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
        }`}>
          {feedbackMessage.type === 'error' ? <AlertCircle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🚀 TAB 1: ACTIVE RECONCILIATION WORKBENCH               */}
      {/* ======================================================= */}
      {activeTab === 'reconcile' && (
        <div className="space-y-6">
          
          {/* Account and Statement Inputs */}
          <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="text-xs font-black text-indigo-400 flex items-center gap-2 border-b border-white/5 pb-2">
              <Building2 size={15} />
              <span>1. اختيار الحساب البنكي وبيانات كشف الحساب الفعلي</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Bank Account Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-300 block">
                  الحساب البنكي / المحفظة: <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 text-white p-3 text-xs rounded-2xl font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {bankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      🏛️ {acc.accountName} ({acc.accountNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Statement Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-300 block">
                  تاريخ كشف البنك: <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 text-white p-3 text-xs rounded-2xl font-mono font-bold outline-none focus:border-indigo-500 cursor-pointer"
                />
              </div>

              {/* Statement Balance */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-300 block">
                  الرصيد الفعلي بكشف البنك: <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={statementBalanceInput}
                    onChange={(e) => setStatementBalanceInput(e.target.value)}
                    className="w-full bg-slate-950 border border-indigo-500/40 focus:border-indigo-500 text-indigo-400 font-mono font-black text-base p-2.5 rounded-2xl text-left outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs pointer-events-none">
                    YER
                  </span>
                </div>
              </div>

              {/* Book Balance Display */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-300 block">
                  رصيد الدفاتر بالنظام حالياً:
                </label>
                <div className="w-full bg-slate-950 border border-white/10 text-emerald-400 font-mono font-black text-base p-2.5 rounded-2xl text-left">
                  {bookBalance.toLocaleString()} <span className="text-xs font-sans text-gray-500">ر.ي</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Live Reconciliation & Discrepancy Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Statement Balance */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-[11px] font-bold text-gray-400 block">رصيد كشف الحساب البنكي</span>
              <div className="text-lg font-black font-mono text-indigo-400">
                {statementBalance.toLocaleString()} ر.ي
              </div>
              <span className="text-[10px] text-gray-500 block">وفقاً للورقة أو تطبيق البنك</span>
            </div>

            {/* Uncleared Deposits (+) */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 block">إيداعات قيد التحصيل (+)</span>
                <ArrowDownLeft size={14} className="text-emerald-400" />
              </div>
              <div className="text-lg font-black font-mono text-emerald-400">
                +{unclearedDeposits.toLocaleString()} ر.ي
              </div>
              <span className="text-[10px] text-gray-500 block">حركات غير معلّمة بكشف البنك</span>
            </div>

            {/* Uncleared Payments (-) */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 block">مسحوبات/حوالات معلقة (-)</span>
                <ArrowUpRight size={14} className="text-rose-400" />
              </div>
              <div className="text-lg font-black font-mono text-rose-400">
                -{unclearedWithdrawals.toLocaleString()} ر.ي
              </div>
              <span className="text-[10px] text-gray-500 block">شيكات أو سحوبات لم تصرف</span>
            </div>

            {/* Discrepancy Status Card */}
            <div className={`border rounded-2xl p-4 shadow-lg space-y-1 ${
              isReconciled 
                ? 'bg-emerald-950/40 border-emerald-500/30' 
                : 'bg-rose-950/40 border-rose-500/30'
            }`}>
              <span className="text-[11px] font-bold text-gray-300 block">حالة التوازن والمطابقة</span>
              <div className={`text-lg font-black font-mono ${isReconciled ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isReconciled ? '0.00 ر.ي (متطابق ✓)' : `${difference.toLocaleString()} ر.ي`}
              </div>
              <span className="text-[10px] text-gray-400 block font-bold">
                {isReconciled ? '🟢 متطابق بنسبة 100%' : '🔴 يوجد فارق يتطلب الفحص'}
              </span>
            </div>
          </div>

          {/* Transactions Checklist Table */}
          <div className="bg-slate-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-5 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <CheckCircle2 className="text-indigo-400" size={18} />
                  <span>2. جدول حركات الحساب بالدفاتر ومطابقتها مع الكشف</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  ضع علامة (✓) أمام كل حركة تظهر في كشف حساب البنك لاعتمادها.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  {checkedTxIds.size === transactions.length ? 'إلغاء تحديد الكل' : 'تحديد الكل ✓'}
                </button>

                {onOpenJournalVoucher && (
                  <button
                    type="button"
                    onClick={onOpenJournalVoucher}
                    className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>إثبات عمولة / حركة بنكية جديدة</span>
                  </button>
                )}
              </div>
            </div>

            {isLoadingTxs ? (
              <div className="p-10 text-center text-gray-400 space-y-2">
                <Loader2 className="w-7 h-7 animate-spin mx-auto text-indigo-400" />
                <span className="text-xs font-bold">جاري تحميل حركات الحساب البنكي...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-10 text-center text-gray-400 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-gray-600 mb-1" />
                <p className="text-sm font-bold text-gray-300">لا توجد حركات مسجلة لهذا الحساب</p>
                <p className="text-xs text-gray-500">سجل قيود يومية أو سندات مرتبطة بهذا الحساب لتظهر هنا للمطابقة.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-gray-400 text-xs font-bold border-b border-white/10">
                      <th className="p-3.5 text-center">مطابقة (✓)</th>
                      <th className="p-3.5">التاريخ</th>
                      <th className="p-3.5">المرجع</th>
                      <th className="p-3.5">البيان والشرح</th>
                      <th className="p-3.5 text-emerald-400">إيداع / مدين (+)</th>
                      <th className="p-3.5 text-rose-400">سحب / دائن (-)</th>
                      <th className="p-3.5 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs font-bold">
                    {transactions.map((tx) => {
                      const isChecked = checkedTxIds.has(tx.id) || tx.reconciled;
                      return (
                        <tr 
                          key={tx.id} 
                          onClick={() => toggleItemMatch(tx.id)}
                          className={`cursor-pointer transition-colors ${
                            isChecked ? 'bg-indigo-950/20 hover:bg-indigo-950/30' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by row click
                              className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-white/20 cursor-pointer"
                            />
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-gray-300 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-amber-300 whitespace-nowrap">
                            {tx.reference}
                          </td>
                          <td className="p-3.5 text-white max-w-xs truncate">
                            {tx.description}
                          </td>
                          <td className="p-3.5 font-mono font-black text-emerald-400 whitespace-nowrap">
                            {tx.debit > 0 ? `${tx.debit.toLocaleString()} ر.ي` : '-'}
                          </td>
                          <td className="p-3.5 font-mono font-black text-rose-400 whitespace-nowrap">
                            {tx.credit > 0 ? `${tx.credit.toLocaleString()} ر.ي` : '-'}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {isChecked ? (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black">
                                تمت المطابقة ✓
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-black">
                                معلق / بالانتظار
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Reconciliation Notes & Final Actions */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-300 block">
                  ملاحظات وتوصيات جلسة التسوية والمطابقة:
                </label>
                <input
                  type="text"
                  placeholder="مثال: تمت مطابقة كشف بنك الكريمي لشهر أغسطس، توجد حوالة معلقة تحت التحصيل..."
                  value={reconciliationNotes}
                  onChange={(e) => setReconciliationNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 text-white p-3 text-xs rounded-2xl outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSaving || !statementBalanceInput}
                  onClick={() => handleSaveReconciliation('completed')}
                  className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs md:text-sm rounded-2xl shadow-xl shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 border-none disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>جاري إقفال مذكرة التسوية...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>إقفال واعتماد مذكرة التسوية البنكية نهائياً</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSaving || !statementBalanceInput}
                  onClick={() => handleSaveReconciliation('draft')}
                  className="py-3.5 px-6 bg-slate-800 hover:bg-slate-700 text-gray-200 font-bold text-xs rounded-2xl transition-all cursor-pointer border border-white/10"
                >
                  حفظ كمسودة تسوية
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ======================================================= */}
      {/* 📜 TAB 2: PAST RECONCILIATION SESSIONS ARCHIVE          */}
      {/* ======================================================= */}
      {activeTab === 'history' && (
        <div className="bg-slate-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <History className="text-indigo-400" size={18} />
              <span>سجل مذكرات التسوية البنكية المعتمدة والأرشيف</span>
            </h3>
          </div>

          {pastReconciliations.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <History size={36} className="mx-auto text-gray-600 mb-2" />
              <p className="text-sm font-bold text-gray-300">لا توجد مذكرات تسوية مؤرشفة بعد</p>
              <p className="text-xs text-gray-500">عند إقفال أي جلسة تسوية بنكية سيتم توثيقها هنا مع كافة تفاصيل المطابقة.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastReconciliations.map((rec) => (
                <div key={rec.id} className="bg-slate-950 p-4 rounded-2xl border border-white/10 space-y-3 shadow-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-black text-indigo-400 block">{rec.accountName}</span>
                      <span className="text-[11px] text-gray-400 font-mono">تاريخ الكشف: {rec.statementDate}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                      rec.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {rec.status === 'completed' ? 'معتمد ومقفل ✓' : 'مسودة ⏳'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-900 p-3 rounded-xl border border-white/5 text-[11px]">
                    <div>
                      <span className="text-gray-500 block">رصيد الكشف:</span>
                      <span className="font-bold text-white font-mono">{rec.statementBalance?.toLocaleString()} ر.ي</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">رصيد الدفاتر:</span>
                      <span className="font-bold text-white font-mono">{rec.bookBalance?.toLocaleString()} ر.ي</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">الفارق:</span>
                      <span className="font-bold text-emerald-400 font-mono">{rec.difference?.toLocaleString()} ر.ي</span>
                    </div>
                  </div>

                  {rec.notes && (
                    <p className="text-xs text-gray-400 leading-relaxed font-sans">{rec.notes}</p>
                  )}

                  <div className="text-[10px] text-gray-500 flex justify-between items-center pt-2 border-t border-white/5">
                    <span>المنفذ: {rec.createdBy?.name || 'المحاسب'}</span>
                    <span>الحركات المطابقة: {rec.matchedEntryIds?.length || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default BankReconciliationView;
