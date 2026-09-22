import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeftRight, 
  Coins, 
  DollarSign, 
  Calculator, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Wallet
} from 'lucide-react';

export interface DualPaymentDetails {
  enabled: boolean;
  baseCurrency: 'YER' | 'SAR' | 'USD';
  primaryCurrency: 'YER' | 'SAR' | 'USD';
  primaryAmount: number;
  secondaryCurrency: 'YER' | 'SAR' | 'USD';
  secondaryAmount: number;
  exchangeRate: number; // rate of secondary/foreign currency vs Base Currency (e.g. 1 SAR = 400 YER, 1 USD = 1600 YER)
  totalReceivedInBase: number;
  changeAmount: number;
  changeCurrency: 'YER' | 'SAR' | 'USD';
  isFullyPaid: boolean;
  shortageInBase: number;
}

interface DualCurrencyPaymentEngineProps {
  totalAmount: number; // Base invoice amount in base currency
  defaultBaseCurrency?: 'YER' | 'SAR' | 'USD';
  currencyRates?: { [key: string]: { buy: number; sell: number } | number };
  onChange: (details: DualPaymentDetails) => void;
  disabled?: boolean;
}

export const DEFAULT_RATES: { [key: string]: number } = {
  SAR_TO_YER: 400,
  USD_TO_YER: 1600,
  USD_TO_SAR: 3.75
};

export default function DualCurrencyPaymentEngine({
  totalAmount,
  defaultBaseCurrency = 'YER',
  currencyRates,
  onChange,
  disabled = false
}: DualCurrencyPaymentEngineProps) {
  const [baseCurrency, setBaseCurrency] = useState<'YER' | 'SAR' | 'USD'>(defaultBaseCurrency);
  const [isDualEnabled, setIsDualEnabled] = useState(false);

  // Currencies for dual payment
  const [curr1, setCurr1] = useState<'YER' | 'SAR' | 'USD'>('SAR');
  const [amount1, setAmount1] = useState<number>(0);

  const [curr2, setCurr2] = useState<'YER' | 'SAR' | 'USD'>('YER');
  const [amount2, setAmount2] = useState<number>(0);

  // Exchange rate
  const initialRate = useMemo(() => {
    if (curr1 === 'SAR' && baseCurrency === 'YER') {
      const r = (currencyRates?.['SAR'] as any)?.sell || (currencyRates?.['SAR'] as any)?.buy || DEFAULT_RATES.SAR_TO_YER;
      return typeof r === 'number' ? r : DEFAULT_RATES.SAR_TO_YER;
    }
    if (curr1 === 'USD' && baseCurrency === 'YER') {
      const r = (currencyRates?.['USD'] as any)?.sell || (currencyRates?.['USD'] as any)?.buy || DEFAULT_RATES.USD_TO_YER;
      return typeof r === 'number' ? r : DEFAULT_RATES.USD_TO_YER;
    }
    if (curr1 === 'USD' && baseCurrency === 'SAR') {
      return DEFAULT_RATES.USD_TO_SAR;
    }
    return 1;
  }, [curr1, baseCurrency, currencyRates]);

  const [customRate, setCustomRate] = useState<number>(initialRate);
  const [changeCurrency, setChangeCurrency] = useState<'YER' | 'SAR' | 'USD'>('YER');

  useEffect(() => {
    setCustomRate(initialRate);
  }, [initialRate]);

  // If dual payment is not enabled, default values
  useEffect(() => {
    if (!isDualEnabled) {
      onChange({
        enabled: false,
        baseCurrency,
        primaryCurrency: baseCurrency,
        primaryAmount: totalAmount,
        secondaryCurrency: baseCurrency,
        secondaryAmount: 0,
        exchangeRate: 1,
        totalReceivedInBase: totalAmount,
        changeAmount: 0,
        changeCurrency: baseCurrency,
        isFullyPaid: true,
        shortageInBase: 0
      });
    }
  }, [isDualEnabled, baseCurrency, totalAmount]);

  // Calculate equivalence and change
  // Currency 1 in Base:
  const amount1InBase = useMemo(() => {
    if (curr1 === baseCurrency) return amount1;
    // Foreign to Base
    return amount1 * customRate;
  }, [curr1, baseCurrency, amount1, customRate]);

  // Currency 2 in Base:
  const amount2InBase = useMemo(() => {
    if (curr2 === baseCurrency) return amount2;
    // If curr2 is foreign:
    return amount2 * customRate;
  }, [curr2, baseCurrency, amount2, customRate]);

  const totalReceivedInBase = amount1InBase + amount2InBase;
  const difference = totalReceivedInBase - totalAmount;
  const changeInBase = Math.max(0, difference);
  const shortageInBase = Math.max(0, -difference);
  const isFullyPaid = difference >= -0.01;

  // Convert change to preferred return currency
  const finalChangeAmount = useMemo(() => {
    if (changeInBase <= 0) return 0;
    if (changeCurrency === baseCurrency) return Math.round(changeInBase);
    // Convert base to foreign currency change:
    if (customRate > 0) {
      return Number((changeInBase / customRate).toFixed(2));
    }
    return 0;
  }, [changeInBase, changeCurrency, baseCurrency, customRate]);

  // Fire onChange
  useEffect(() => {
    if (isDualEnabled) {
      onChange({
        enabled: true,
        baseCurrency,
        primaryCurrency: curr1,
        primaryAmount: amount1,
        secondaryCurrency: curr2,
        secondaryAmount: amount2,
        exchangeRate: customRate,
        totalReceivedInBase,
        changeAmount: finalChangeAmount,
        changeCurrency,
        isFullyPaid,
        shortageInBase
      });
    }
  }, [
    isDualEnabled,
    baseCurrency,
    curr1,
    amount1,
    curr2,
    amount2,
    customRate,
    totalReceivedInBase,
    finalChangeAmount,
    changeCurrency,
    isFullyPaid,
    shortageInBase
  ]);

  // Quick helper to fill remaining in Currency 2
  const autoFillRemainingInCurr2 = () => {
    const remainingBase = Math.max(0, totalAmount - amount1InBase);
    if (curr2 === baseCurrency) {
      setAmount2(Math.round(remainingBase));
    } else if (customRate > 0) {
      setAmount2(Number((remainingBase / customRate).toFixed(2)));
    }
  };

  return (
    <div className="p-4 bg-slate-50 dark:bg-[#161b22] rounded-3xl border border-slate-200 dark:border-white/[0.05] space-y-4 text-right" dir="rtl">
      
      {/* 1. Base Currency Header & Dual Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/[0.05] pb-3">
        <div className="flex items-center gap-2">
          <Coins size={18} className="text-[#d4af37]" />
          <div>
            <span className="text-xs font-black text-slate-800 dark:text-white block">
              نظام العملات والدفع المزدوج (Dual Currency)
            </span>
            <span className="text-[10px] text-gray-400">
              عملة الفاتورة الأساسية:{' '}
              <strong className="text-[#d4af37] font-bold font-mono">
                {baseCurrency === 'YER' ? 'ريال يمني (YER)' : baseCurrency === 'SAR' ? 'ريال سعودي (SAR)' : 'دولار أمريكي (USD)'}
              </strong>
            </span>
          </div>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center gap-1.5">
          {(['YER', 'SAR', 'USD'] as const).map((curr) => (
            <button
              key={curr}
              type="button"
              disabled={disabled}
              onClick={() => {
                setBaseCurrency(curr);
                if (curr === 'YER') {
                  setCurr1('SAR');
                  setCurr2('YER');
                  setChangeCurrency('YER');
                } else if (curr === 'SAR') {
                  setCurr1('USD');
                  setCurr2('SAR');
                  setChangeCurrency('SAR');
                }
              }}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                baseCurrency === curr
                  ? 'bg-[#d4af37] text-slate-950 shadow-md font-extrabold'
                  : 'bg-white dark:bg-[#0d1117] text-gray-400 hover:text-slate-200 border border-slate-200 dark:border-white/5'
              }`}
            >
              {curr === 'YER' ? 'ر.ي' : curr === 'SAR' ? 'ر.س' : '$'}
            </button>
          ))}
        </div>
      </div>

      {/* Dual Payment Toggle */}
      <div className="flex items-center justify-between bg-white dark:bg-[#0d1117] p-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.03]">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={16} className={isDualEnabled ? 'text-[#d4af37]' : 'text-gray-400'} />
          <div>
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
              تفعيل الدفع بنفس الوقت بعملتين (مزدوج)
            </span>
            <span className="text-[10px] text-gray-400">
              دفع جزء بالريال السعودي/الدولار والجزء المتبقي باليمني مع احتساب الفكة آلياً
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const next = !isDualEnabled;
            setIsDualEnabled(next);
            if (next) {
              // Pre-fill
              setAmount1(0);
              setAmount2(totalAmount);
            }
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isDualEnabled ? 'bg-[#d4af37]' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isDualEnabled ? '-translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Dual Currency Configuration Panel */}
      {isDualEnabled && (
        <div className="space-y-4 pt-1 animate-fadeIn">
          {/* Rate Controller */}
          <div className="flex items-center justify-between bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              سعر الصرف اللحظي المستخدم ({curr1} مقابل {baseCurrency}):
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.5"
                value={customRate}
                onChange={(e) => setCustomRate(Math.max(0.001, Number(e.target.value)))}
                className="w-24 p-1.5 text-center bg-white dark:bg-[#0d1117] border border-amber-500/30 rounded-xl font-mono font-black text-amber-500 text-xs outline-none"
              />
              <span className="font-bold text-gray-400">{baseCurrency}</span>
            </div>
          </div>

          {/* Inputs for Currency 1 and Currency 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Currency 1 (e.g. SAR / USD) */}
            <div className="p-3 bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-200 dark:border-white/[0.05] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>الدفعة الأولى بالعملة:</span>
                </label>
                <select
                  value={curr1}
                  onChange={(e) => setCurr1(e.target.value as any)}
                  className="bg-slate-100 dark:bg-[#161b22] px-2 py-1 rounded-lg text-xs font-black outline-none border border-slate-200 dark:border-white/5 cursor-pointer"
                >
                  <option value="SAR">🇸🇦 ريال سعودي (SAR)</option>
                  <option value="USD">🇺🇸 دولار أمريكي (USD)</option>
                  <option value="YER">🇾🇪 ريال يمني (YER)</option>
                </select>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="المبلغ المدفوع..."
                  value={amount1 || ''}
                  onChange={(e) => setAmount1(Math.max(0, Number(e.target.value)))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-white/5 rounded-xl font-mono font-black text-sm text-slate-800 dark:text-white outline-none focus:border-[#d4af37] text-left"
                />
              </div>

              <div className="flex justify-between text-[10px] text-gray-400 font-bold pt-0.5">
                <span>المعادل بالعملة الأساسية:</span>
                <span className="font-mono text-[#d4af37] font-black">
                  {amount1InBase.toLocaleString()} {baseCurrency}
                </span>
              </div>
            </div>

            {/* Currency 2 (e.g. YER) */}
            <div className="p-3 bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-200 dark:border-white/[0.05] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>الدفعة الثانية بالعملة:</span>
                </label>
                <select
                  value={curr2}
                  onChange={(e) => setCurr2(e.target.value as any)}
                  className="bg-slate-100 dark:bg-[#161b22] px-2 py-1 rounded-lg text-xs font-black outline-none border border-slate-200 dark:border-white/5 cursor-pointer"
                >
                  <option value="YER">🇾🇪 ريال يمني (YER)</option>
                  <option value="SAR">🇸🇦 ريال سعودي (SAR)</option>
                  <option value="USD">🇺🇸 دولار أمريكي (USD)</option>
                </select>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="المبلغ المدفوع..."
                  value={amount2 || ''}
                  onChange={(e) => setAmount2(Math.max(0, Number(e.target.value)))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-white/5 rounded-xl font-mono font-black text-sm text-slate-800 dark:text-white outline-none focus:border-[#d4af37] text-left"
                />
              </div>

              <div className="flex justify-between items-center text-[10px] pt-0.5">
                <button
                  type="button"
                  onClick={autoFillRemainingInCurr2}
                  className="text-[10px] font-black text-[#d4af37] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={10} />
                  <span>تعبئة المتبقي آلياً</span>
                </button>
                <span className="font-mono text-gray-400 font-bold">
                  {amount2InBase.toLocaleString()} {baseCurrency}
                </span>
              </div>
            </div>
          </div>

          {/* Change & Balance Output */}
          <div className="p-3.5 bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-200 dark:border-white/[0.05] space-y-2 text-xs">
            <div className="flex justify-between items-center text-gray-500">
              <span>إجمالي المبالغ المستلمة (بالمعادل):</span>
              <span className="font-mono font-black text-slate-800 dark:text-white text-sm">
                {totalReceivedInBase.toLocaleString()} {baseCurrency}
              </span>
            </div>

            <div className="flex justify-between items-center text-gray-500">
              <span>المطلوب لسداد الفاتورة:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {totalAmount.toLocaleString()} {baseCurrency}
              </span>
            </div>

            {changeInBase > 0 ? (
              <div className="pt-2 border-t border-slate-200 dark:border-white/[0.05] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    الفكة المتبقية للزبون (Change):
                  </span>
                  <select
                    value={changeCurrency}
                    onChange={(e) => setChangeCurrency(e.target.value as any)}
                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-black border border-emerald-500/20"
                  >
                    <option value="YER">إرجاع بالريال اليمني (YER)</option>
                    <option value="SAR">إرجاع بالريال السعودي (SAR)</option>
                    <option value="USD">إرجاع بالدولار (USD)</option>
                  </select>
                </div>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-base">
                  {finalChangeAmount.toLocaleString()} {changeCurrency}
                </span>
              </div>
            ) : shortageInBase > 0 ? (
              <div className="pt-2 border-t border-slate-200 dark:border-white/[0.05] flex items-center justify-between text-rose-500">
                <span className="font-black flex items-center gap-1">
                  <AlertCircle size={14} />
                  <span>المتبقي غير المدفوع (عجز):</span>
                </span>
                <span className="font-mono font-black text-sm">
                  {shortageInBase.toLocaleString()} {baseCurrency}
                </span>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200 dark:border-white/[0.05] flex items-center justify-between text-emerald-500 font-black">
                <span>الحالة: مدفوع بالكامل وبالتطابق التام ✓</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
