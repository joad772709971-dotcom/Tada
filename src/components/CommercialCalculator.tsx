import React, { useState, useEffect } from 'react';
import { X, Percent, DollarSign, Calculator, TrendingUp, Sparkles, RefreshCw, Delete } from 'lucide-react';

interface CommercialCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

type CalcTab = 'standard' | 'margin' | 'discount' | 'currency';

export default function CommercialCalculator({ isOpen, onClose }: CommercialCalculatorProps) {
  const [activeTab, setActiveTab] = useState<CalcTab>('standard');

  // Standard Calculator States
  const [display, setDisplay] = useState('');
  const [equation, setEquation] = useState('');

  // Profit Margin States
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [sellPrice, setSellPrice] = useState<number | ''>('');
  const [profitAmount, setProfitAmount] = useState<number>(0);
  const [profitMargin, setProfitMargin] = useState<number>(0);

  // Discount States
  const [originalPrice, setOriginalPrice] = useState<number | ''>('');
  const [discountPercent, setDiscountPercent] = useState<number | ''>('');
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [savedAmount, setSavedAmount] = useState<number>(0);

  // Currency States
  const [currencyAmount, setCurrencyAmount] = useState<number | ''>('');
  const [exchangeRate, setExchangeRate] = useState<number | ''>('');
  const [currencyType, setCurrencyType] = useState<'SAR_TO_YER' | 'USD_TO_YER' | 'YER_TO_SAR' | 'YER_TO_USD'>('SAR_TO_YER');
  const [convertedResult, setConvertedResult] = useState<number>(0);

  useEffect(() => {
    // Recalculate Profit Margin
    if (costPrice !== '' && sellPrice !== '') {
      const profit = Number(sellPrice) - Number(costPrice);
      const margin = Number(costPrice) > 0 ? (profit / Number(costPrice)) * 100 : 0;
      setProfitAmount(profit);
      setProfitMargin(margin);
    } else {
      setProfitAmount(0);
      setProfitMargin(0);
    }
  }, [costPrice, sellPrice]);

  useEffect(() => {
    // Recalculate Discount
    if (originalPrice !== '') {
      const pct = discountPercent === '' ? 0 : Number(discountPercent);
      const saved = (Number(originalPrice) * pct) / 100;
      const final = Number(originalPrice) - saved;
      setSavedAmount(saved);
      setFinalPrice(final);
    } else {
      setSavedAmount(0);
      setFinalPrice(0);
    }
  }, [originalPrice, discountPercent]);

  useEffect(() => {
    // Recalculate Currency Exchange
    if (currencyAmount !== '' && exchangeRate !== '') {
      const amt = Number(currencyAmount);
      const rate = Number(exchangeRate);
      if (currencyType === 'SAR_TO_YER' || currencyType === 'USD_TO_YER') {
        setConvertedResult(amt * rate);
      } else {
        setConvertedResult(rate > 0 ? amt / rate : 0);
      }
    } else {
      setConvertedResult(0);
    }
  }, [currencyAmount, exchangeRate, currencyType]);

  if (!isOpen) return null;

  // Standard Calc Action handlers
  const handleCalcBtn = (val: string) => {
    if (val === 'C') {
      setDisplay('');
      setEquation('');
    } else if (val === '⌫') {
      setDisplay(prev => prev.slice(0, -1));
    } else if (val === '=') {
      try {
        // Safe evaluation without eval()
        const sanitized = display.replace(/×/g, '*').replace(/÷/g, '/');
        if (/^[0-9+\-*/.()\s]+$/.test(sanitized)) {
          const safeEval = new Function(`"use strict"; return (${sanitized})`);
          const res = safeEval();
          if (res !== undefined && !isNaN(res) && isFinite(res)) {
            setEquation(display + ' =');
            setDisplay(Number(res.toFixed(4)).toString());
          } else {
            setDisplay('خطأ في العملية');
          }
        } else {
          setDisplay('خطأ في العملية');
        }
      } catch (e) {
        setDisplay('خطأ في العملية');
      }
    } else {
      if (display === 'خطأ في العملية') {
        setDisplay(val);
      } else {
        setDisplay(prev => prev + val);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100005] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div 
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #030814 100%)',
          border: '2px solid rgba(212, 175, 55, 0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 20px rgba(212,175,55,0.1)'
        }}
        className="w-full max-w-md rounded-3xl p-6 flex flex-col relative text-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#cf8a3c]/10 text-[#cf8a3c] rounded-xl">
              <Calculator size={18} />
            </span>
            <div>
              <h3 className="text-sm font-black text-white">الحاسبة التجارية الذكية</h3>
              <p className="text-[10px] text-gray-400">لعمليات البيع، حساب الأرباح والخصومات وصرف العملات</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 bg-slate-950/60 p-1 rounded-xl mb-4 border border-white/5">
          {[
            { id: 'standard', name: 'الحاسبة', icon: Calculator },
            { id: 'margin', name: 'الأرباح', icon: TrendingUp },
            { id: 'discount', name: 'الخصومات', icon: Percent },
            { id: 'currency', name: 'العملات', icon: DollarSign }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as CalcTab)}
                className={`py-2 rounded-lg text-[10px] font-black flex flex-col items-center gap-1 transition cursor-pointer ${
                  isActive 
                    ? 'bg-[#cf8a3c] text-slate-950 shadow-md font-sans' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={12} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 min-h-[300px]">
          
          {/* 1. Standard Calculator Tab */}
          {activeTab === 'standard' && (
            <div className="space-y-4">
              <div className="bg-slate-950/95 border border-white/5 p-4 rounded-2xl text-left font-mono relative overflow-hidden">
                <div className="text-gray-500 text-xs min-h-[16px] truncate text-right arab-nums">{equation}</div>
                <div className="text-xl sm:text-2xl font-black text-[#ffd700] truncate text-right mt-1 arab-nums select-all">
                  {display || '0'}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-sm font-black font-mono">
                {['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '00', '.', '='].map((btn) => {
                  const isOperator = ['÷', '×', '-', '+', '='].includes(btn);
                  const isAction = ['C', '⌫', '%'].includes(btn);
                  return (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => handleCalcBtn(btn)}
                      className={`py-3.5 rounded-xl transition cursor-pointer active:scale-95 text-center ${
                        btn === '='
                          ? 'bg-[#cf8a3c] text-slate-950 font-black font-sans shadow-lg'
                          : isOperator
                            ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                            : isAction
                              ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-sans'
                              : 'bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {btn}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Profit Margin Tab */}
          {activeTab === 'margin' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400">سعر التكلفة (YER / SAR)</label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="التكلفة الفعلية..."
                    className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-[#cf8a3c] outline-none transition text-left"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400">سعر البيع المقترح</label>
                  <input
                    type="number"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="سعر البيع المقترح..."
                    className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-[#cf8a3c] outline-none transition text-left"
                  />
                </div>
              </div>

              {/* Profit Outcomes Banner */}
              <div className="space-y-3 bg-[#cf8a3c]/5 border border-[#cf8a3c]/20 p-4 rounded-2xl">
                <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                  <span className="text-xs text-gray-400 font-bold">قيمة صافي الربح:</span>
                  <span className={`text-sm font-black font-mono ${profitAmount > 0 ? 'text-emerald-400' : profitAmount < 0 ? 'text-rose-500' : 'text-white'}`}>
                    {profitAmount.toLocaleString()} YER/SAR
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 font-bold">نسبة الهامش الربحي:</span>
                  <span className={`text-sm font-black font-mono ${profitMargin >= 30 ? 'text-emerald-400' : profitMargin >= 10 ? 'text-amber-400' : profitMargin < 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                    {profitMargin.toFixed(2)} %
                  </span>
                </div>
              </div>

              {/* Profit Indicator */}
              <div className="p-3.5 bg-slate-950/60 border border-white/5 rounded-xl text-center">
                {profitAmount > 0 ? (
                  <div className="space-y-1">
                    <span className="text-xs font-black text-emerald-400 flex items-center justify-center gap-1.5">
                      <Sparkles size={14} className="animate-pulse" />
                      عملية ناجحة ومربحة للعلامة!
                    </span>
                    <p className="text-[10px] text-gray-450">الهامش الربحي ممتاز ويغطي استهلاك الصناديق والمصاريف الميدانية.</p>
                  </div>
                ) : profitAmount < 0 ? (
                  <div className="space-y-1">
                    <span className="text-xs font-black text-rose-400">عجز مالي / بيع خسارة ⚠️</span>
                    <p className="text-[10px] text-gray-450">انتبه! سعر البيع المدخل يقل عن سعر التكلفة الفعلي للصنف.</p>
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-450">قم بإدخال التكلفة وسعر البيع لبدء التحليل الفوري للمهام الهيكلية.</span>
                )}
              </div>
            </div>
          )}

          {/* 3. Discount Tab */}
          {activeTab === 'discount' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400">السعر الأصلي (قبل الخصم)</label>
                  <input
                    type="number"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="السعر الأساسي..."
                    className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-[#cf8a3c] outline-none transition text-left"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400">نسبة الخصم %</label>
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="مثال: 15%"
                    className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-[#cf8a3c] outline-none transition text-left"
                  />
                </div>
              </div>

              {/* Discount Outcomes */}
              <div className="space-y-3 bg-amber-500/5 border border-amber-550/20 p-4 rounded-2xl">
                <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                  <span className="text-xs text-gray-400 font-bold">السعر النهائي بعد الخصم:</span>
                  <span className="text-sm font-black text-[#ffd700] font-mono">
                    {finalPrice.toLocaleString()} YER/SAR
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 font-bold">مقدار التوفير (قيمة الخصم):</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {savedAmount.toLocaleString()} YER/SAR
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Currency Exchange Calculator Tab */}
          {activeTab === 'currency' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 bg-slate-950/80 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setCurrencyType('SAR_TO_YER')}
                  className={`py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                    currencyType === 'SAR_TO_YER' ? 'bg-[#cf8a3c]/15 text-[#cf8a3c] border border-[#cf8a3c]/30' : 'text-gray-400'
                  }`}
                >
                  سعودي ➔ يمني
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyType('USD_TO_YER')}
                  className={`py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                    currencyType === 'USD_TO_YER' ? 'bg-[#cf8a3c]/15 text-[#cf8a3c] border border-[#cf8a3c]/30' : 'text-gray-400'
                  }`}
                >
                  دولار ➔ يمني
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400">المبلغ بالعملة الأجنبية</label>
                  <input
                    type="number"
                    value={currencyAmount}
                    onChange={(e) => setCurrencyAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="أدخل المبلغ..."
                    className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-[#cf8a3c] outline-none transition text-left"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400">سعر الصرف بالسوق اليوم</label>
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="مثال: يمني للريال الواحد..."
                    className="w-full bg-slate-950/50 border border-white/10 p-3 rounded-xl text-white font-mono text-sm focus:border-[#cf8a3c] outline-none transition text-left"
                  />
                </div>
              </div>

              {/* Exchange Outcomes */}
              <div className="space-y-3 bg-sky-500/5 border border-sky-500/20 p-4 rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 font-bold">القيمة المقابلة بالريال اليمني (YER):</span>
                  <span className="text-sm font-black text-sky-400 font-mono">
                    {convertedResult.toLocaleString(undefined, { maximumFractionDigits: 2 })} YER
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer info brand */}
        <div className="border-t border-white/5 pt-3 mt-4 text-center">
          <span className="text-[8px] font-black text-gray-500 tracking-wider font-mono">
            JAM SYSTEM PLATINUM ENGINE • OFFLINE MATH PROTOCOL
          </span>
        </div>
      </div>
    </div>
  );
}
