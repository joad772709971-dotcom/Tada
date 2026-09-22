import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Banknote, 
  CreditCard, 
  User, 
  Building2, 
  Sparkles, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeftRight, 
  Wallet, 
  Coins, 
  Receipt, 
  PackageCheck, 
  Send, 
  Sliders, 
  RefreshCw, 
  Plus, 
  Check, 
  X,
  FileSpreadsheet,
  Clock,
  Printer
} from 'lucide-react';
import { doc, updateDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Customer, UserProfile, PaymentMatrixMethod, PaymentSplitDetails, OrderExecutionMode } from '../types';
import JAMPayModal from './JAMPayModal';
import DualCurrencyPaymentEngine, { DualPaymentDetails } from './DualCurrencyPaymentEngine';

export interface AdvancedPaymentMatrixProps {
  totalAmount: number; // الصافي المطلوب بعد الخصم
  customer: Customer | null;
  profile: UserProfile | null;
  onCustomerUpdate?: (updatedCustomer: Customer) => void;
  onCompleteSale: (
    executionMode: OrderExecutionMode,
    paymentMethod: PaymentMatrixMethod,
    splitDetails: PaymentSplitDetails
  ) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
  availableAccounts?: any[];
  defaultMethod?: PaymentMatrixMethod;
  hideExecutionButtons?: boolean;
  onMatrixChange?: (data: {
    paymentMethod: PaymentMatrixMethod;
    splitDetails: PaymentSplitDetails;
    isValid: boolean;
    errorReason?: string;
  }) => void;
}

export const POPULAR_BANKS_YEMEN = [
  { id: 'kuraimi', name: 'بنك الكريمي للتمويل الأصغر (حساب / جوال)', icon: '🏦' },
  { id: 'tadhamon_mfloos', name: 'بنك التضامن الإسلامي (محفظة إم فلوس)', icon: '📱' },
  { id: 'qutaibi', name: 'بنك القطيبي الإسلامي (القطيبي لحظات)', icon: '🏛️' },
  { id: 'omgy', name: 'شركة العمقي وإخوانه للصرافة', icon: '🏢' },
  { id: 'alnajm', name: 'شبكة النجم للحوالات والصرافة', icon: '⭐' },
  { id: 'ykb', name: 'بنك اليمن والكويت (YKB)', icon: '🏛️' },
  { id: 'alamal', name: 'بنك الأمل للتمويل الأصغر (بيس PYES)', icon: '💳' },
  { id: 'onepay', name: 'ون باي كاش (OnePay)', icon: '⚡' },
  { id: 'shomool', name: 'بنك الشمول للتمويل الأصغر الإسلامي', icon: '🏛️' },
  { id: 'custom_cashier_box', name: 'صندوق المحل الرئيسي (كاش)', icon: '📥' }
];

export default function AdvancedPaymentMatrix({
  totalAmount,
  customer,
  profile,
  onCustomerUpdate,
  onCompleteSale,
  isSubmitting = false,
  disabled = false,
  availableAccounts = [],
  defaultMethod = 'cash',
  hideExecutionButtons = false,
  onMatrixChange
}: AdvancedPaymentMatrixProps) {
  const [activeMethod, setActiveMethod] = useState<PaymentMatrixMethod>(defaultMethod);
  const [cashPart, setCashPart] = useState<number>(totalAmount);
  const [debtPart, setDebtPart] = useState<number>(0);
  const [depositPart, setDepositPart] = useState<number>(0);

  const [selectedBankId, setSelectedBankId] = useState<string>('kuraimi');
  const [transferRefNo, setTransferRefNo] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');

  // Dual Payment data state
  const [dualPaymentData, setDualPaymentData] = useState<DualPaymentDetails | null>(null);

  // Supervisor credit limit raise modal
  const [isRaiseLimitOpen, setIsRaiseLimitOpen] = useState(false);
  const [newLimitInput, setNewLimitInput] = useState<number>(() => (customer?.creditLimit || 500000) + 100000);
  const [isRaisingLimit, setIsRaisingLimit] = useState(false);

  // JAM Pay modal
  const [isJAMPayOpen, setIsJAMPayOpen] = useState(false);

  // Auto-distribute amounts when payment method changes or totalAmount changes
  useEffect(() => {
    if (activeMethod === 'cash') {
      setCashPart(totalAmount);
      setDebtPart(0);
      setDepositPart(0);
    } else if (activeMethod === 'credit') {
      setCashPart(0);
      setDebtPart(totalAmount);
      setDepositPart(0);
    } else if (activeMethod === 'transfer') {
      setCashPart(0);
      setDebtPart(0);
      setDepositPart(totalAmount);
    } else if (activeMethod === 'split_cash_debt') {
      const half = Math.round(totalAmount / 2);
      setCashPart(half);
      setDebtPart(totalAmount - half);
      setDepositPart(0);
    } else if (activeMethod === 'split_deposit_cash') {
      const half = Math.round(totalAmount / 2);
      setDepositPart(half);
      setCashPart(totalAmount - half);
      setDebtPart(0);
    } else if (activeMethod === 'split_deposit_debt') {
      const half = Math.round(totalAmount / 2);
      setDepositPart(half);
      setDebtPart(totalAmount - half);
      setCashPart(0);
    } else if (activeMethod === 'jampay') {
      setCashPart(totalAmount);
      setDebtPart(0);
      setDepositPart(0);
    }
  }, [activeMethod, totalAmount]);

  // Debt calculations
  const creditLimit = customer?.creditLimit || (customer?.allowCredit ? 1000000 : 0);
  const currentDebt = customer?.debt || 0;
  const requestedDebt = (activeMethod === 'credit' || activeMethod === 'split_cash_debt' || activeMethod === 'split_deposit_debt') 
    ? (activeMethod === 'credit' ? totalAmount : debtPart) 
    : 0;

  const totalDebtAfterSale = currentDebt + requestedDebt;
  const remainingCreditAllowed = Math.max(0, creditLimit - currentDebt);
  const isCreditAllowedForCustomer = customer ? (customer.allowCredit !== false && (customer.creditLimit ? customer.creditLimit > 0 : true)) : false;
  const isDebtLimitExceeded = requestedDebt > 0 && (!customer || !isCreditAllowedForCustomer || totalDebtAfterSale > creditLimit);

  const debtUsagePercent = creditLimit > 0 ? Math.min(100, Math.round((totalDebtAfterSale / creditLimit) * 100)) : 100;

  // Split sum validation
  const currentTotalAllocated = useMemo(() => {
    if (activeMethod === 'cash') return cashPart;
    if (activeMethod === 'credit') return debtPart;
    if (activeMethod === 'transfer') return depositPart;
    if (activeMethod === 'split_cash_debt') return cashPart + debtPart;
    if (activeMethod === 'split_deposit_cash') return depositPart + cashPart;
    if (activeMethod === 'split_deposit_debt') return depositPart + debtPart;
    if (activeMethod === 'jampay') return totalAmount;
    return totalAmount;
  }, [activeMethod, cashPart, debtPart, depositPart, totalAmount]);

  const isMathExact = Math.abs(currentTotalAllocated - totalAmount) < 1;

  // Notification / Callback on Matrix Change
  useEffect(() => {
    let isValid = true;
    let errorReason = '';

    if (!isMathExact) {
      isValid = false;
      errorReason = `المجموع الموزع (${currentTotalAllocated.toLocaleString()}) لا يطابق إجمالي الفاتورة (${totalAmount.toLocaleString()})`;
    } else if (requestedDebt > 0 && !customer) {
      isValid = false;
      errorReason = 'يجب تحديد عميل مسجل لتسجيل المديونية / الحساب الآجل';
    } else if (requestedDebt > 0 && !isCreditAllowedForCustomer) {
      isValid = false;
      errorReason = 'العميل غير مفعل له خيار الشراء بالآجل';
    } else if (isDebtLimitExceeded) {
      isValid = false;
      errorReason = `تجاوز السقف الائتماني المسموح (${creditLimit.toLocaleString()} ر.ي)`;
    }

    if (onMatrixChange) {
      onMatrixChange({
        paymentMethod: activeMethod,
        splitDetails: {
          cashAmount: cashPart,
          debtAmount: debtPart,
          depositAmount: depositPart,
          bankAccountId: selectedBankId,
          bankAccountName: POPULAR_BANKS_YEMEN.find(b => b.id === selectedBankId)?.name || selectedBankId,
          transferRefNo,
          dueDate,
          notes: transferNotes,
          currency: dualPaymentData?.baseCurrency || 'YER',
          dualPayment: dualPaymentData?.enabled ? dualPaymentData : undefined
        },
        isValid,
        errorReason: errorReason || undefined
      });
    }
  }, [
    activeMethod,
    cashPart,
    debtPart,
    depositPart,
    selectedBankId,
    transferRefNo,
    dueDate,
    transferNotes,
    isMathExact,
    customer,
    isCreditAllowedForCustomer,
    isDebtLimitExceeded,
    creditLimit,
    currentTotalAllocated,
    totalAmount,
    requestedDebt,
    onMatrixChange,
    dualPaymentData
  ]);

  // Handle raise credit limit
  const handleSaveNewCreditLimit = async () => {
    if (!customer?.id) return;
    setIsRaisingLimit(true);
    try {
      const custRef = doc(db, 'customers', customer.id);
      await updateDoc(custRef, {
        allowCredit: true,
        creditLimit: Number(newLimitInput) || 0
      });
      if (onCustomerUpdate) {
        onCustomerUpdate({
          ...customer,
          allowCredit: true,
          creditLimit: Number(newLimitInput) || 0
        });
      }
      setIsRaiseLimitOpen(false);
    } catch (err: any) {
      console.error('Error raising credit limit:', err);
      alert('فشل تحديث السقف الائتماني: ' + err.message);
    } finally {
      setIsRaisingLimit(false);
    }
  };

  const handleTriggerSale = (mode: OrderExecutionMode) => {
    if (disabled || isSubmitting) return;

    if (requestedDebt > 0 && !customer) {
      alert('⚠️ يرجى اختيار أو إضافة عميل لتسجيل المديونية / الحساب الآجل');
      return;
    }

    if (isDebtLimitExceeded) {
      alert(`⛔ منع البيع الآجل: لقد تجاوز العميل السقف الائتماني (${creditLimit.toLocaleString()} ر.ي). المتبقي له فقط: ${remainingCreditAllowed.toLocaleString()} ر.ي.`);
      return;
    }

    if (!isMathExact) {
      alert(`⚠️ المبالغ الموزعة (${currentTotalAllocated.toLocaleString()}) لا تطابق إجمالي الفاتورة المطلوبة (${totalAmount.toLocaleString()}). اضغط على زر التوزيع التلقائي.`);
      return;
    }

    onCompleteSale(mode, activeMethod, {
      cashAmount: cashPart,
      debtAmount: debtPart,
      depositAmount: depositPart,
      bankAccountId: selectedBankId,
      bankAccountName: POPULAR_BANKS_YEMEN.find(b => b.id === selectedBankId)?.name || selectedBankId,
      transferRefNo: transferRefNo.trim() || undefined,
      dueDate: dueDate || undefined,
      notes: transferNotes.trim() || undefined,
      currency: dualPaymentData?.baseCurrency || 'YER',
      dualPayment: dualPaymentData?.enabled ? dualPaymentData : undefined
    });
  };

  const isSupervisorOrManager = 
    profile?.role === 'manager' || 
    profile?.role === 'superadmin' || 
    profile?.role === 'owner' ||
    profile?.role === 'wholesaler' ||
    profile?.role === 'master_wholesale';

  return (
    <div className="space-y-5 text-right" dir="rtl">
      {/* 1. Payment Matrix Grid Selectors (7 Methods) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
            <Coins size={15} className="text-brand-primary" />
            <span>مصفوفة خيارات الدفع والتسوية المالية:</span>
          </label>
          <span className="text-[10px] text-gray-400 font-bold">
            المبلغ المستحق: <strong className="text-brand-primary font-mono text-xs">{totalAmount.toLocaleString()} ر.ي</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
          {/* Method 1: Cash */}
          <button
            type="button"
            onClick={() => setActiveMethod('cash')}
            className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
              activeMethod === 'cash'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                : 'bg-gray-50 dark:bg-navy-950 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-800 hover:border-emerald-500'
            }`}
          >
            <Banknote size={18} />
            <span className="text-[11px] font-black leading-tight">نقد (Cash)</span>
            <span className="text-[8px] opacity-75 font-bold">صندوق المحل</span>
          </button>

          {/* Method 2: Credit */}
          <button
            type="button"
            onClick={() => setActiveMethod('credit')}
            className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
              activeMethod === 'credit'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                : 'bg-gray-50 dark:bg-navy-950 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-800 hover:border-rose-500'
            }`}
          >
            <User size={18} />
            <span className="text-[11px] font-black leading-tight">آجل / دين</span>
            <span className="text-[8px] opacity-75 font-bold">حساب العميل</span>
          </button>

          {/* Method 3: Split Cash + Debt */}
          <button
            type="button"
            onClick={() => setActiveMethod('split_cash_debt')}
            className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
              activeMethod === 'split_cash_debt'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                : 'bg-gray-50 dark:bg-navy-950 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-800 hover:border-amber-500'
            }`}
          >
            <ArrowLeftRight size={18} />
            <span className="text-[11px] font-black leading-tight">نقد وآجل</span>
            <span className="text-[8px] opacity-75 font-bold">جزء كاش + دين</span>
          </button>

          {/* Method 4: Bank Transfer / Deposit */}
          <button
            type="button"
            onClick={() => setActiveMethod('transfer')}
            className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
              activeMethod === 'transfer'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                : 'bg-gray-50 dark:bg-navy-950 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-800 hover:border-blue-500'
            }`}
          >
            <Building2 size={18} />
            <span className="text-[11px] font-black leading-tight">إيداع / حوالة</span>
            <span className="text-[8px] opacity-75 font-bold">بنوك وصرافة</span>
          </button>

          {/* Method 5: Split Deposit + Cash */}
          <button
            type="button"
            onClick={() => setActiveMethod('split_deposit_cash')}
            className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
              activeMethod === 'split_deposit_cash'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                : 'bg-gray-50 dark:bg-navy-950 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-800 hover:border-indigo-500'
            }`}
          >
            <Wallet size={18} />
            <span className="text-[11px] font-black leading-tight">إيداع ونقد</span>
            <span className="text-[8px] opacity-75 font-bold">تحويل + كاش</span>
          </button>

          {/* Method 6: Split Deposit + Debt */}
          <button
            type="button"
            onClick={() => setActiveMethod('split_deposit_debt')}
            className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
              activeMethod === 'split_deposit_debt'
                ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                : 'bg-gray-50 dark:bg-navy-950 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-800 hover:border-purple-500'
            }`}
          >
            <CreditCard size={18} />
            <span className="text-[11px] font-black leading-tight">إيداع ودين</span>
            <span className="text-[8px] opacity-75 font-bold">تحويل + آجل</span>
          </button>

          {/* Method 7: JAM Pay */}
          <button
            type="button"
            onClick={() => {
              setActiveMethod('jampay');
              setIsJAMPayOpen(true);
            }}
            className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
              activeMethod === 'jampay'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-navy-950 border-amber-400 font-black shadow-md shadow-amber-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:border-amber-400'
            }`}
          >
            <Sparkles size={18} className="animate-pulse" />
            <span className="text-[11px] font-black leading-tight">JAM Pay 💳</span>
            <span className="text-[8px] font-bold">دفع إلكتروني</span>
          </button>
        </div>
      </div>

      {/* 2. Real-time Customer Debt Watchdog & Credit Limit Guard */}
      {(requestedDebt > 0 || activeMethod === 'credit' || activeMethod === 'split_cash_debt' || activeMethod === 'split_deposit_debt') && (
        <div className={`p-4 rounded-3xl border transition-all ${
          isDebtLimitExceeded 
            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800' 
            : 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-navy-800 pb-3">
            <div className="flex items-center gap-2">
              {isDebtLimitExceeded ? (
                <ShieldAlert size={20} className="text-rose-500" />
              ) : (
                <ShieldCheck size={20} className="text-emerald-500" />
              )}
              <div>
                <span className="text-xs font-black text-navy-900 dark:text-white block">
                  الرقابة على السقف الائتماني والمديونية {customer ? `[${customer.name}]` : ''}
                </span>
                <span className="text-[10px] text-gray-500">
                  {customer
                    ? (isCreditAllowedForCustomer ? 'الحساب مفعل للشراء بالآجل' : '⚠️ العميل غير مفعل له خيار الآجل')
                    : '⚠️ لم يتم اختيار عميل مسجل'}
                </span>
              </div>
            </div>

            {/* Supervisor Quick Raise Button */}
            {customer && isSupervisorOrManager && (
              <button
                type="button"
                onClick={() => {
                  setNewLimitInput(creditLimit > 0 ? creditLimit + 200000 : 500000);
                  setIsRaiseLimitOpen(true);
                }}
                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Sliders size={13} />
                <span>رفع / تعديل السقف (مشرف)</span>
              </button>
            )}
          </div>

          {customer && (
            <div className="space-y-3 pt-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800">
                  <span className="text-[10px] text-gray-400 font-bold block">السقف الائتماني:</span>
                  <span className="font-mono font-black text-navy-900 dark:text-white">
                    {creditLimit.toLocaleString()} ر.ي
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800">
                  <span className="text-[10px] text-gray-400 font-bold block">المديونية الحالية:</span>
                  <span className="font-mono font-black text-rose-500">
                    {currentDebt.toLocaleString()} ر.ي
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800">
                  <span className="text-[10px] text-gray-400 font-bold block">دين هذه الفاتورة:</span>
                  <span className="font-mono font-black text-amber-500">
                    {requestedDebt.toLocaleString()} ر.ي
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800">
                  <span className="text-[10px] text-gray-400 font-bold block">المتبقي من السقف:</span>
                  <span className={`font-mono font-black ${remainingCreditAllowed >= requestedDebt ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {(creditLimit - totalDebtAfterSale).toLocaleString()} ر.ي
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-gray-400">
                  <span>نسبة استهلاك السقف بعد العملية:</span>
                  <span className={debtUsagePercent >= 100 ? 'text-rose-500 font-black' : 'text-navy-900 dark:text-white'}>
                    {debtUsagePercent}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 dark:bg-navy-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      debtUsagePercent >= 100 
                        ? 'bg-rose-500' 
                        : debtUsagePercent >= 80 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${debtUsagePercent}%` }}
                  />
                </div>
              </div>

              {isDebtLimitExceeded && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>
                    ⛔ تنبيه: لقد وصل العميل للحد الأقصى للمديونية المسموحة أو تجاوز السقف! يجب دفع جزء نقداً أو رفع السقف بواسطة المشرف.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Split Amounts Matrix Configuration */}
      {(activeMethod === 'split_cash_debt' || activeMethod === 'split_deposit_cash' || activeMethod === 'split_deposit_debt') && (
        <div className="p-4 bg-gray-50 dark:bg-navy-950/80 rounded-3xl border border-gray-200 dark:border-navy-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-navy-900 dark:text-white flex items-center gap-1.5">
              <Sliders size={14} className="text-brand-primary" />
              <span>توزيع المبالغ المجزأة وتحديد النسب:</span>
            </span>
            {/* Quick Balance Button */}
            <button
              type="button"
              onClick={() => {
                if (activeMethod === 'split_cash_debt') {
                  setDebtPart(Math.max(0, totalAmount - cashPart));
                } else if (activeMethod === 'split_deposit_cash') {
                  setCashPart(Math.max(0, totalAmount - depositPart));
                } else if (activeMethod === 'split_deposit_debt') {
                  setDebtPart(Math.max(0, totalAmount - depositPart));
                }
              }}
              className="text-[11px] font-black text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={11} />
              <span>موازنة المتبقي تلقائياً</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Field A: Primary */}
            {(activeMethod === 'split_cash_debt' || activeMethod === 'split_deposit_cash') && (
              <div className="space-y-1.5">
                <label className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                  <span>💵 المبلغ المدفوع نقداً (Cash):</span>
                  <span className="font-mono">{cashPart.toLocaleString()} ر.ي</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalAmount}
                  value={cashPart || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCashPart(val);
                    if (activeMethod === 'split_cash_debt') {
                      setDebtPart(Math.max(0, totalAmount - val));
                    } else {
                      setDepositPart(Math.max(0, totalAmount - val));
                    }
                  }}
                  className="w-full p-3 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-mono font-black text-emerald-600 outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Field B: Deposit / Bank */}
            {(activeMethod === 'split_deposit_cash' || activeMethod === 'split_deposit_debt') && (
              <div className="space-y-1.5">
                <label className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center justify-between">
                  <span>🏦 المبلغ المحول / إيداع بنكي:</span>
                  <span className="font-mono">{depositPart.toLocaleString()} ر.ي</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalAmount}
                  value={depositPart || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDepositPart(val);
                    if (activeMethod === 'split_deposit_cash') {
                      setCashPart(Math.max(0, totalAmount - val));
                    } else {
                      setDebtPart(Math.max(0, totalAmount - val));
                    }
                  }}
                  className="w-full p-3 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-mono font-black text-blue-600 outline-none focus:border-blue-500"
                />
              </div>
            )}

            {/* Field C: Debt Part */}
            {(activeMethod === 'split_cash_debt' || activeMethod === 'split_deposit_debt') && (
              <div className="space-y-1.5">
                <label className="text-xs font-black text-rose-500 flex items-center justify-between">
                  <span>📝 المبلغ المتبقي على الحساب (دين):</span>
                  <span className="font-mono">{debtPart.toLocaleString()} ر.ي</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalAmount}
                  value={debtPart || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDebtPart(val);
                    if (activeMethod === 'split_cash_debt') {
                      setCashPart(Math.max(0, totalAmount - val));
                    } else {
                      setDepositPart(Math.max(0, totalAmount - val));
                    }
                  }}
                  className="w-full p-3 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-mono font-black text-rose-500 outline-none focus:border-rose-500"
                />
              </div>
            )}
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { label: '50% مناصفة', action: () => {
                const half = Math.round(totalAmount / 2);
                if (activeMethod === 'split_cash_debt') { setCashPart(half); setDebtPart(totalAmount - half); }
                else if (activeMethod === 'split_deposit_cash') { setDepositPart(half); setCashPart(totalAmount - half); }
                else if (activeMethod === 'split_deposit_debt') { setDepositPart(half); setDebtPart(totalAmount - half); }
              }},
              { label: '25% دفعة أولى', action: () => {
                const p = Math.round(totalAmount * 0.25);
                if (activeMethod === 'split_cash_debt') { setCashPart(p); setDebtPart(totalAmount - p); }
                else if (activeMethod === 'split_deposit_cash') { setDepositPart(p); setCashPart(totalAmount - p); }
                else if (activeMethod === 'split_deposit_debt') { setDepositPart(p); setDebtPart(totalAmount - p); }
              }},
              { label: '75% دفعة كبرى', action: () => {
                const p = Math.round(totalAmount * 0.75);
                if (activeMethod === 'split_cash_debt') { setCashPart(p); setDebtPart(totalAmount - p); }
                else if (activeMethod === 'split_deposit_cash') { setDepositPart(p); setCashPart(totalAmount - p); }
                else if (activeMethod === 'split_deposit_debt') { setDepositPart(p); setDebtPart(totalAmount - p); }
              }}
            ].map((btn, idx) => (
              <button
                key={idx}
                type="button"
                onClick={btn.action}
                className="px-2.5 py-1 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg text-[10px] font-black text-gray-600 dark:text-gray-300 hover:border-brand-primary cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Bank / Exchange Details Picker */}
      {(activeMethod === 'transfer' || activeMethod === 'split_deposit_cash' || activeMethod === 'split_deposit_debt') && (
        <div className="p-4 bg-blue-500/5 dark:bg-blue-500/10 rounded-3xl border border-blue-500/20 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-navy-900 dark:text-white">
            <Building2 size={15} className="text-blue-500" />
            <span>بيانات الحساب البنكي / جهة الصرافة المستلمة للحوالة:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400">اختر الحساب البنكي / المحفظة</label>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full p-3 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-black outline-none focus:border-blue-500 cursor-pointer"
              >
                {POPULAR_BANKS_YEMEN.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.icon} {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400">رقم الإشعار / الحوالة / السند المرجعي</label>
              <input
                type="text"
                placeholder="مثال: TRX-9823140"
                value={transferRefNo}
                onChange={(e) => setTransferRefNo(e.target.value)}
                className="w-full p-3 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-mono font-black outline-none focus:border-blue-500 text-left"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Due Date / Notes for Debt options */}
      {(activeMethod === 'credit' || activeMethod === 'split_cash_debt' || activeMethod === 'split_deposit_debt') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock size={13} />
              <span>تاريخ الاستحقاق المتفق عليه للآجل (اختياري)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl text-xs font-black outline-none focus:border-brand-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400">ملاحظات الفاتورة والتسوية</label>
            <input
              type="text"
              placeholder="مثال: تم الاتفاق على السداد نهاية الشهر"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl text-xs font-bold outline-none focus:border-brand-primary"
            />
          </div>
        </div>
      )}

      {/* Dual Currency & Foreign Exchange Engine */}
      <DualCurrencyPaymentEngine
        totalAmount={totalAmount}
        onChange={(details) => setDualPaymentData(details)}
        disabled={disabled}
      />

      {/* 6. Dual Transaction Execution Actions (Final Sale vs Hold & Dispatch) */}
      {!hideExecutionButtons && (
        <div className="pt-2 border-t border-gray-200 dark:border-navy-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Action 1: Final Sale (بيع نهائي وتأكيد) */}
            <button
              type="button"
              disabled={disabled || isSubmitting || !isMathExact || isDebtLimitExceeded}
              onClick={() => handleTriggerSale('final_sale')}
              className="py-4 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-2xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:grayscale"
              id="btn-matrix-final-sale"
            >
              <CheckCircle2 size={18} />
              <span>{isSubmitting ? 'جاري الاعتماد والترصيد...' : 'بيع نهائي وتأكيد الفاتورة (Final Sale) 💾'}</span>
            </button>

            {/* Action 2: Hold & Dispatch (حجز طلبية وإرسال للتجهيز) */}
            <button
              type="button"
              disabled={disabled || isSubmitting || !isMathExact || isDebtLimitExceeded}
              onClick={() => handleTriggerSale('hold_dispatch')}
              className="py-4 px-5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs sm:text-sm rounded-2xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:grayscale"
              id="btn-matrix-hold-dispatch"
            >
              <PackageCheck size={18} />
              <span>حجز طلبية وإرسال للتجهيز (Hold & Dispatch) 📦</span>
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center font-bold">
            💡 "البيع النهائي" يرصد المخزن والحساب مباشرة. بينما "حجز وتجهيز" ينشئ أمر تجهيز للمخزن لحين الاستلام والتسليم.
          </p>
        </div>
      )}

      {/* Supervisor Credit Limit Adjustment Modal */}
      <AnimatePresence>
        {isRaiseLimitOpen && customer && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRaiseLimitOpen(false)}
              className="fixed inset-0 bg-navy-950/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-navy-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-navy-700 z-10 space-y-4 text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-navy-800 pb-3">
                <div className="flex items-center gap-2 text-brand-primary font-black text-base">
                  <Sliders size={20} />
                  <span>تحديث السقف الائتماني (صلاحية مشرف)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRaiseLimitOpen(false)}
                  className="p-1 text-gray-400 hover:text-navy-900 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-gray-500">
                  العميل: <strong className="text-navy-900 dark:text-white">{customer.name}</strong>
                </p>
                <div className="p-3 bg-gray-50 dark:bg-navy-950 rounded-xl space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-gray-400">السقف الحالي:</span>
                    <span>{(customer.creditLimit || 0).toLocaleString()} ر.ي</span>
                  </div>
                  <div className="flex justify-between text-rose-500 font-bold">
                    <span>المديونية الحالية:</span>
                    <span>{(customer.debt || 0).toLocaleString()} ر.ي</span>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <label className="font-black text-gray-700 dark:text-gray-300">أدخل السقف الائتماني الجديد المعتمد (ر.ي):</label>
                  <input
                    type="number"
                    step="50000"
                    value={newLimitInput}
                    onChange={(e) => setNewLimitInput(Number(e.target.value))}
                    className="w-full p-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-sm font-mono font-black text-emerald-600 outline-none focus:border-brand-primary text-left"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isRaisingLimit}
                  onClick={handleSaveNewCreditLimit}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isRaisingLimit ? 'جاري الاعتماد...' : 'حفظ واعتماد السقف فوراً ✓'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRaiseLimitOpen(false)}
                  className="py-3 px-4 bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* JAM Pay Gateway Modal */}
      <JAMPayModal
        isOpen={isJAMPayOpen}
        onClose={() => setIsJAMPayOpen(false)}
      />
    </div>
  );
}
