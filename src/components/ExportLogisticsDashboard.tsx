import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Ship, 
  DollarSign, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  FileText, 
  Coins, 
  Building2, 
  Sparkles, 
  Printer, 
  FileCheck, 
  TrendingUp, 
  AlertCircle,
  TrendingDown,
  Info
} from 'lucide-react';

interface ExportShipment {
  id: string;
  targetCountry: string;
  customerName: string;
  exitPort: 'Wadeeah' | 'Shehn' | 'AdenPort' | 'Hodeidah';
  containerNumber: string;
  shipmentType: 'frozen_chicken' | 'fresh_eggs' | 'manure_organic';
  invoiceValue: number;
  currency: 'USD' | 'SAR';
  exRateYER: number; // exchange rate to YER
  bankAccount: string; // international bank account name
  paymentStatus: 'deposit_received' | 'arrival_payment' | 'deferred_due';
  advanceAmount: number;
  onArrivalAmount: number;
  deferredAmount: number;
  healthCertAttached: boolean;
  originCertAttached: boolean;
  invoiceAttached: boolean;
  permitAttached: boolean;
  transitStatus: 'preparing' | 'on_border' | 'delivered';
  createdDate: string;
}

export function ExportLogisticsDashboard() {
  // Beep sound effect
  const playBeep = (freq = 900, duration = 0.1) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('Audio feedback requires user interaction first.');
    }
  };

  const [shipments, setShipments] = useState<ExportShipment[]>(() => {
    const saved = localStorage.getItem('erp_export_shipments_v2');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'EXP-1001',
        targetCountry: 'المملكة العربية السعودية (الرياض)',
        customerName: 'مؤسسة السديري للاستيراد والتوزيع',
        exitPort: 'Wadeeah',
        containerNumber: 'REEFER-99201-UA',
        shipmentType: 'fresh_eggs',
        invoiceValue: 24500,
        currency: 'USD',
        exRateYER: 530,
        bankAccount: 'البنك الأهلي السعودي - فرع جيزان الأجنبي',
        paymentStatus: 'deposit_received',
        advanceAmount: 10000,
        onArrivalAmount: 14500,
        deferredAmount: 0,
        healthCertAttached: true,
        originCertAttached: true,
        invoiceAttached: true,
        permitAttached: true,
        transitStatus: 'on_border',
        createdDate: '2026-05-25 09:30'
      },
      {
        id: 'EXP-1002',
        targetCountry: 'سلطنة عمان (صلالة)',
        customerName: 'شركة الخليج للأغذية والبرادات',
        exitPort: 'Shehn',
        containerNumber: 'REEFER-77402-OM',
        shipmentType: 'frozen_chicken',
        invoiceValue: 88000,
        currency: 'SAR',
        exRateYER: 140,
        bankAccount: 'بنك مسقط الدولي - حساب التصدير بالريال',
        paymentStatus: 'arrival_payment',
        advanceAmount: 30000,
        onArrivalAmount: 58000,
        deferredAmount: 0,
        healthCertAttached: true,
        originCertAttached: true,
        invoiceAttached: true,
        permitAttached: false,
        transitStatus: 'preparing',
        createdDate: '2026-05-27 14:15'
      }
    ];
  });

  // Form interactive state
  const [targetCountry, setTargetCountry] = useState('المملكة العربية السعودية');
  const [customerName, setCustomerName] = useState('مجموعة العثيم التجارية');
  const [exitPort, setExitPort] = useState<'Wadeeah' | 'Shehn' | 'AdenPort' | 'Hodeidah'>('Wadeeah');
  const [containerNumber, setContainerNumber] = useState('REEFER-');
  const [shipmentType, setShipmentType] = useState<'frozen_chicken' | 'fresh_eggs' | 'manure_organic'>('fresh_eggs');
  const [invoiceValue, setInvoiceValue] = useState('18500');
  const [currency, setCurrency] = useState<'USD' | 'SAR'>('USD');
  const [bankAccount, setBankAccount] = useState('البنك الإسلامي اليمني - حساب التصدير');
  const [paymentStatus, setPaymentStatus] = useState<'deposit_received' | 'arrival_payment' | 'deferred_due'>('deposit_received');
  
  // Installments calculations State
  const [advanceAmount, setAdvanceAmount] = useState('5000');
  const [onArrivalAmount, setOnArrivalAmount] = useState('10000');
  const [deferredAmount, setDeferredAmount] = useState('3500');

  // Customs Documents checkboxes
  const [healthCert, setHealthCert] = useState(true);
  const [originCert, setOriginCert] = useState(true);
  const [invoiceCert, setInvoiceCert] = useState(true);
  const [permitCert, setPermitCert] = useState(false);

  const [activeTab, setActiveTab] = useState<'list' | 'add_shipment' | 'customs_checklist'>('list');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Auto-sync installments when invoiceValue changes
  useEffect(() => {
    const total = parseFloat(invoiceValue) || 0;
    const adv = total * 0.3; // 30% advance
    const arr = total * 0.5; // 50% on arrival
    const def = total - (adv + arr); // 20% deferred
    setAdvanceAmount(adv.toFixed(0));
    setOnArrivalAmount(arr.toFixed(0));
    setDeferredAmount(def.toFixed(0));
  }, [invoiceValue]);

  useEffect(() => {
    localStorage.setItem('erp_export_shipments_v2', JSON.stringify(shipments));
  }, [shipments]);

  const handleCreateShipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !targetCountry.trim()) {
      alert('الرجاء تعبئة اسم العميل الدولي والدولة المستهدفة');
      return;
    }

    const totalVal = parseFloat(invoiceValue) || 0;
    const adv = parseFloat(advanceAmount) || 0;
    const arrival = parseFloat(onArrivalAmount) || 0;
    const def = parseFloat(deferredAmount) || 0;

    // Financial validation
    if (Math.abs((adv + arrival + def) - totalVal) > 5) {
      alert(`تنبيه مالي: مجموع الدفعات (${(adv + arrival + def).toLocaleString()}) يجب أن يتطابق بدقة مع الفاتورة الكلية (${totalVal.toLocaleString()})`);
      return;
    }

    const newShipment: ExportShipment = {
      id: 'EXP-' + Math.floor(1005 + Math.random() * 990),
      targetCountry: targetCountry.trim(),
      customerName: customerName.trim(),
      exitPort,
      containerNumber: containerNumber.trim(),
      shipmentType,
      invoiceValue: totalVal,
      currency,
      exRateYER: currency === 'USD' ? 530 : 140, // standard conversion values
      bankAccount,
      paymentStatus,
      advanceAmount: adv,
      onArrivalAmount: arrival,
      deferredAmount: def,
      healthCertAttached: healthCert,
      originCertAttached: originCert,
      invoiceAttached: invoiceCert,
      permitAttached: permitCert,
      transitStatus: 'preparing',
      createdDate: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    setShipments(prev => [newShipment, ...prev]);
    playBeep(1050, 0.25);
    setFeedbackMsg(`🌍 تم تقييد شحنة التصدير الدولية [${newShipment.id}] وتوثيق الدفعات المستلمة بالدفاتر.`);
    setActiveTab('list');

    // reset fields
    setContainerNumber('REEFER-');
    setTimeout(() => setFeedbackMsg(''), 5000);
  };

  const handleDeleteShipment = (id: string) => {
    playBeep(320, 0.1);
    setShipments(prev => prev.filter(s => s.id !== id));
  };

  const toggleDocument = (id: string, doc: 'health' | 'origin' | 'invoice' | 'permit') => {
    playBeep(1200, 0.05);
    setShipments(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          healthCertAttached: doc === 'health' ? !s.healthCertAttached : s.healthCertAttached,
          originCertAttached: doc === 'origin' ? !s.originCertAttached : s.originCertAttached,
          invoiceAttached: doc === 'invoice' ? !s.invoiceAttached : s.invoiceAttached,
          permitAttached: doc === 'permit' ? !s.permitAttached : s.permitAttached,
        };
      }
      return s;
    }));
  };

  const updateTransitStatus = (id: string, status: 'preparing' | 'on_border' | 'delivered') => {
    playBeep(1100, 0.1);
    setShipments(prev => prev.map(s => s.id === id ? { ...s, transitStatus: status } : s));
  };

  // Aggregated export values - convert to YER and display with USD helper
  const totalUsdSales = shipments.reduce((sum, item) => {
    if (item.currency === 'USD') return sum + item.invoiceValue;
    // SAR to USD conversion (approx 3.75)
    return sum + (item.invoiceValue / 3.75);
  }, 0);

  const totalReceivedAdvanceUsd = shipments.reduce((sum, item) => {
    const val = item.advanceAmount;
    return sum + (item.currency === 'USD' ? val : val / 3.75);
  }, 0);

  const pendingCollectionUsd = totalUsdSales - totalReceivedAdvanceUsd;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 flex flex-col gap-6 text-right animate-fade-in" id="export_logistics_panel" dir="rtl">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950 px-4 py-4 rounded-2xl border border-slate-800/85">
        <div className="flex items-center gap-3 w-full sm:w-auto text-right">
          <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Globe className="w-6 h-6 animate-spin-slow text-cyan-400" />
          </div>
          <div>
            <h3 className="text-white text-base font-black flex items-center gap-1.5">
              <span>إدارة التصدير اللوجستي والتبادل التجاري الدولي</span>
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">تتبع شاحنات التصدير عبر الوديعة وشحن، جرد المبيعات بالعملات الصعبة ومطابقة الوثائق الجمركية.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-slate-900 border border-slate-800 text-cyan-400 font-bold rounded-xl px-2.5 py-1">
            موانئ ومنافذ التصدير المعتمدة لليمن
          </span>
        </div>
      </div>

      {feedbackMsg && (
        <div className="bg-cyan-950/60 border-2 border-cyan-500 text-cyan-300 p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400 flex-shrink-0 animate-bounce" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* THREE BENTO STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Stat 1: Total Global Billings */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl mt-[-20px] mr-[-20px] pointer-events-none" />
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400 text-xs font-black flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-cyan-400" />
              قيمة فواتير التصدير الإجمالية (USD)
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">العملة الصعبة</span>
          </div>
          <div className="my-3 flex items-baseline gap-1.5 justify-center">
            <span className="text-3xl font-black font-mono text-white">
              ${totalUsdSales.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </span>
            <span className="text-xs text-slate-400">دولار أمريكي</span>
          </div>
          <div className="flex justify-between items-center text-[10.5px] border-t border-slate-900 pt-2 text-slate-400">
            <span>ما يعادل بالريال السعودي:</span>
            <span className="font-mono font-bold text-emerald-400">{(totalUsdSales * 3.75).toLocaleString(undefined, {maximumFractionDigits: 0})} SAR</span>
          </div>
        </div>

        {/* Stat 2: Advance Collected Deposit */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl mt-[-20px] ml-[-20px] pointer-events-none" />
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400 text-xs font-black flex items-center gap-1.5 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              المدفوعات المقدمة المستلمة في البنك
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 rounded">مضمونة</span>
          </div>
          <div className="my-3 flex items-baseline gap-1.5 justify-center">
            <span className="text-3xl font-black font-mono text-emerald-400">
              ${totalReceivedAdvanceUsd.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </span>
            <span className="text-xs text-slate-400">دولار أمريكي</span>
          </div>
          <div className="text-[10px] text-slate-500 bg-slate-900 p-1.5 rounded-xl border border-slate-850 text-center">
            تم ربط المبالغ مباشرة بحساب البنك الأهلي وشبكة الودائع الدولية
          </div>
        </div>

        {/* Stat 3: Processing Documents Complete Counter */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400 text-xs font-black flex items-center gap-1.5 text-amber-400">
              <FileCheck className="w-4 h-4" />
              جاهزية الوثائق والتخليص الجمركي
            </span>
            <span className="text-[10px] bg-amber-950 text-amber-400 px-1.5 rounded">الجمارك</span>
          </div>
          <div className="my-2 text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-black font-mono text-amber-400">
              {shipments.filter(s => s.healthCertAttached && s.originCertAttached && s.invoiceAttached && s.permitAttached).length} / {shipments.length}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">شحنات مستوفية لكافة الوثائق البيطرية والشهادات</p>
          </div>
          <div className="bg-slate-900 p-1.5 rounded-lg text-[9.5px] border border-slate-800 text-center text-slate-500">
            المنفذ يقبل الشاحنات الحاصلة على الشهادة الصحية المرفقة بالباركود.
          </div>
        </div>

      </div>

      {/* NAVIGATION TABS FOR INTERNATIONAL MODULE */}
      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => { playBeep(850, 0.1); setActiveTab('list'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'list' 
              ? 'bg-cyan-600 text-slate-950 font-black shadow-md' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Ship className="w-3.5 h-3.5" />
          <span>الشحنات الدولية الجارية</span>
        </button>
        <button
          onClick={() => { playBeep(860, 0.1); setActiveTab('add_shipment'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'add_shipment' 
              ? 'bg-cyan-600 text-slate-950 font-black shadow-md' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>تصدير دفعة جديدة وتسجيل مبيعات 🌍</span>
        </button>
        <button
          onClick={() => { playBeep(870, 0.1); setActiveTab('customs_checklist'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'customs_checklist' 
              ? 'bg-amber-600 text-slate-950 font-black shadow-md' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>بيان جمارك وشهادات الصحة البيطرية</span>
        </button>
      </div>

      {/* ACTIVE SCREEN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* TAB 1: ACTIVE EXPORT SHIPMENTS LIST */}
        {activeTab === 'list' && (
          <div className="lg:col-span-12 flex flex-col gap-4">
            
            <div className="flex flex-col gap-4">
              {shipments.map((s) => (
                <div key={s.id} className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col gap-3 text-right">
                  
                  {/* Item Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-cyan-950 pb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-black font-mono">{s.id} | {s.customerName}</span>
                        <span className="bg-cyan-950 text-cyan-400 font-bold text-[10px] px-2 py-0.5 rounded-lg border border-cyan-900/40">
                          {s.transitStatus === 'preparing' ? '⏳ قيد التجهيز بالمصنع' :
                           s.transitStatus === 'on_border' ? '🚛 في المنفذ الجمركي للبلد' : '✓ تم التسليم للعميل'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono block mt-1">
                        الوجهة: 🌍 <strong>{s.targetCountry}</strong> | تاريخ الحجز: {s.createdDate}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <select 
                        value={s.transitStatus}
                        onChange={(e) => updateTransitStatus(s.id, e.target.value as any)}
                        className="bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 rounded p-1"
                      >
                        <option value="preparing">جهيز بالمصنع</option>
                        <option value="on_border">وصول للمنفذ</option>
                        <option value="delivered">تسليم للعميل</option>
                      </select>

                      <button
                        onClick={() => handleDeleteShipment(s.id)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                        title="حذف القيد الدولي"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Financial calculations info row */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                      <span className="text-[9.5px] text-slate-400 block mb-0.5">القيمة الاسمية الإجمالية:</span>
                      <span className="text-white font-mono font-black text-sm">
                        {s.invoiceValue.toLocaleString()} {s.currency}
                      </span>
                    </div>

                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                      <span className="text-[9.5px] text-emerald-400 block mb-0.5">الدفعة المقدمة (المستلم):</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {s.advanceAmount.toLocaleString()} {s.currency}
                      </span>
                    </div>

                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                      <span className="text-[9.5px] text-slate-400 block mb-0.5">دفعة عند الوصول:</span>
                      <span className="text-slate-300 font-mono font-bold">
                        {s.onArrivalAmount.toLocaleString()} {s.currency}
                      </span>
                    </div>

                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                      <span className="text-[9.5px] text-red-400 block mb-0.5">آجل متبقي للتسوية:</span>
                      <span className="text-red-400 font-mono font-bold">
                        {s.deferredAmount.toLocaleString()} {s.currency}
                      </span>
                    </div>

                  </div>

                  {/* Shipment properties */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-400 border-t border-slate-900 pt-2 bg-slate-900/20 p-2 rounded-xl">
                    <div>
                      🚛 <strong className="text-slate-300">طريقة النقل والحاوية:</strong> {s.containerNumber} (مبردة/براد)
                    </div>
                    <div>
                      🏢 <strong className="text-slate-300">منفذ الخروج اليمني:</strong> {
                        s.exitPort === 'Wadeeah' ? 'منفذ الوديعة البري حضرموت' :
                        s.exitPort === 'Shehn' ? 'منفذ شحن الحدودي المهرة' :
                        s.exitPort === 'AdenPort' ? 'ميناء عدن الدولي للحاويات' : 'ميناء الحديدة'
                      }
                    </div>
                    <div>
                      🏦 <strong className="text-slate-300">حساب البنك المراسل:</strong> {s.bankAccount}
                    </div>
                  </div>

                  {/* Documents mini-checklist */}
                  <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-xl border border-slate-850 text-xs">
                    <span className="text-slate-400 font-bold text-[10.5px]">جاهزية مطابقة ملف الوثائق للجمارك:</span>
                    <div className="flex items-center gap-2 flex-wrap text-[10.5px]">
                      <span className={`${s.healthCertAttached ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {s.healthCertAttached ? '✓ شهادة صحية' : '✗ شهادة صحية' }
                      </span>
                      <span className="text-slate-700">|</span>
                      <span className={`${s.originCertAttached ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {s.originCertAttached ? '✓ شهادة منشأ' : '✗ شهادة منشأ' }
                      </span>
                      <span className="text-slate-700">|</span>
                      <span className={`${s.invoiceAttached ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {s.invoiceAttached ? '✓ الفاتورة' : '✗ الفاتورة' }
                      </span>
                      <span className="text-slate-700">|</span>
                      <span className={`${s.permitAttached ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {s.permitAttached ? '✓ تصريح الزراعة' : '✗ تصريح الزراعة' }
                      </span>
                    </div>
                  </div>

                </div>
              ))}
            </div>

          </div>
        )}

        {/* TAB 2: CREATE NEW EXPORT SHIPMENT & CALCULATE FINANCES */}
        {activeTab === 'add_shipment' && (
          <div className="lg:col-span-12">
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 sm:p-6 max-w-3xl mx-auto flex flex-col gap-5 text-right">
              
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Globe className="w-5 h-5 text-cyan-400" />
                <h4 className="text-white text-sm font-black">تسجيل ترحيل شحنة دولية وتقييد دفعاتها المالية بالعملة الأجنبية</h4>
              </div>

              <form onSubmit={handleCreateShipment} className="flex flex-col gap-4">
                
                {/* Section A: Customer & Destination */}
                <span className="text-[11px] text-cyan-400 font-extrabold tracking-wider border-b border-cyan-950 pb-1">أولاً: معلومات التصدير والشحن الدولي</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">الدولة المستهدفة والمدينة:</label>
                    <input 
                      type="text" 
                      value={targetCountry}
                      onChange={(e) => setTargetCountry(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-850 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      placeholder="العربية السعودية (الرياض/خميس مشيط)"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">اسم المستورد أو العميل الدولي:</label>
                    <input 
                      type="text" 
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-850 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">منفذ الخروج اليمني المعتمد:</label>
                    <select
                      value={exitPort}
                      onChange={(e) => setExitPort(e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 text-xs font-bold text-white p-2.5 rounded-xl"
                    >
                      <option value="Wadeeah">منفذ الوديعة البري (حضرموت)</option>
                      <option value="Shehn">منفذ شحن الحدودي (المهرة)</option>
                      <option value="AdenPort">ميناء حاويات عدن الدولي</option>
                      <option value="Hodeidah">ميناء الحديدة البحري</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">رقم الحاوية أو براد الشحن الدولي:</label>
                    <input 
                      type="text" 
                      value={containerNumber}
                      onChange={(e) => setContainerNumber(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-850 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 h-10"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">الصنف المصدر الفعلي:</label>
                    <select
                      value={shipmentType}
                      onChange={(e) => setShipmentType(e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 text-xs font-bold text-white p-2.5 rounded-xl h-10"
                    >
                      <option value="fresh_eggs">كرتون بيض المائدة طازج 🥚</option>
                      <option value="frozen_chicken">دجاج مجمد مغلف بأوزان مختلفة 🍗</option>
                      <option value="manure_organic">أسمدة زراعية عضوية بياض معقم</option>
                    </select>
                  </div>
                </div>

                {/* Section B: Hard Currency Calculations */}
                <span className="text-[11px] text-cyan-400 font-extrabold tracking-wider border-b border-cyan-950 pb-1 mt-2">ثانياً: الحسابات المالية وتقسيم الدفعات</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">قالب قيمة الفاتورة الدولية الكلية:</label>
                    <input 
                      type="number" 
                      value={invoiceValue}
                      onChange={(e) => setInvoiceValue(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-850 rounded-xl p-2 text-xs font-mono font-bold text-white h-11 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">عملة التصدير الدولية:</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 text-xs font-bold text-white p-2.5 rounded-xl h-11"
                    >
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-300 font-bold">البنك الدولي المقيد المستلم:</label>
                    <select
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-xs font-bold text-white p-2.5 rounded-xl h-11"
                    >
                      <option value="البنك الأهلي السعودي - فرع جيزان الأجنبي">البنك الأهلي السعودي - فرع جيزان</option>
                      <option value="بنك مسقط الدولي - حساب التصدير بالريال">بنك مسقط الدولي (عمان)</option>
                      <option value="البنك الإسلامي اليمني - حساب التصدير">البنك الإسلامي اليمني والاعتمادات</option>
                    </select>
                  </div>
                </div>

                {/* Three installments tracker (with manual overrider but auto-completed based on 30/50/20 standard) */}
                <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-cyan-400 font-black">جدولة استلام دفعات الفواتير (تعديل مباشر متاح):</span>
                    <span className="text-[10px] text-slate-500">مجموع الدفع يجب أن يساوي الفاتورة</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs text-right text-slate-300">
                    <div className="flex flex-col gap-1">
                      <span>دفعة دفعت مقدماً (30%):</span>
                      <input 
                        type="number"
                        value={advanceAmount}
                        onChange={(e) => setAdvanceAmount(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-center rounded p-1.5 text-xs text-emerald-400 font-bold font-mono"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <span>عند وصول الشحنة (50%):</span>
                      <input 
                        type="number"
                        value={onArrivalAmount}
                        onChange={(e) => setOnArrivalAmount(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-center rounded p-1.5 text-xs text-slate-200 font-bold font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span>مؤجل أو آجل متبقي (20%):</span>
                      <input 
                        type="number"
                        value={deferredAmount}
                        onChange={(e) => setDeferredAmount(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-center rounded p-1.5 text-xs text-red-400 font-bold font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Section C: Mandatory Documents for Clearance */}
                <span className="text-[11px] text-amber-400 font-extrabold tracking-wider border-b border-amber-950/40 pb-1 mt-2">ثالثاً: ترفيق الوثائق الإلزامية للمنفذ</span>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-right">
                  <button
                    type="button"
                    onClick={() => setHealthCert(prev => !prev)}
                    className={`p-3 rounded-lg border-2 text-right transition-all flex items-center justify-between cursor-pointer ${
                      healthCert ? 'bg-amber-950/20 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-850 text-slate-400'
                    }`}
                  >
                    <span>🩺 الشهادة الصحية البيطرية</span>
                    <span className="text-xs font-mono">{healthCert ? '✓ مرفق' : '✗ ناقص'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOriginCert(prev => !prev)}
                    className={`p-3 rounded-lg border-2 text-right transition-all flex items-center justify-between cursor-pointer ${
                      originCert ? 'bg-amber-950/20 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-850 text-slate-400'
                    }`}
                  >
                    <span>📜 شهادة منشأ الفوج</span>
                    <span className="text-xs font-mono">{originCert ? '✓ مرفق' : '✗ ناقص'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInvoiceCert(prev => !prev)}
                    className={`p-3 rounded-lg border-2 text-right transition-all flex items-center justify-between cursor-pointer ${
                      invoiceCert ? 'bg-amber-950/20 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-850 text-slate-400'
                    }`}
                  >
                    <span>📃 فاتورة تصدير ورقية</span>
                    <span className="text-xs font-mono">{invoiceCert ? '✓ مرفق' : '✗ ناقص'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPermitCert(prev => !prev)}
                    className={`p-3 rounded-lg border-2 text-right transition-all flex items-center justify-between cursor-pointer ${
                      permitCert ? 'bg-amber-950/20 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-850 text-slate-400'
                    }`}
                  >
                    <span>🛡️ تصريح التصدير الزراعي</span>
                    <span className="text-xs font-mono">{permitCert ? '✓ مرفق' : '✗ ناقص'}</span>
                  </button>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-850 text-[10.5px] text-slate-400 flex items-start gap-2 leading-relaxed">
                  <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>ملحوظة تنبيهية: تمنع بعض الهيئات والجمارك دخول شحنات اللحوم والبيض الطازج ما لم تحصل على "الشهادة الصحية البيطرية" الصادرة من معمل الفرز المركزي التابع لنا للتأكد من خلوه الكلي من إنفلونزا الطيور.</span>
                </div>

                <button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs py-3.5 rounded-xl cursor-pointer shadow-md transition-all active:scale-95 text-center mt-3 h-11"
                >
                  حفظ وتأكيد فاتورة التصدير وتتبع الشاحنات الجارية
                </button>

              </form>

            </div>
          </div>
        )}

        {/* TAB 3: CUSTOMS DOCUMENT CHECKLISTS FOR ACTIVE SHIPS */}
        {activeTab === 'customs_checklist' && (
          <div className="lg:col-span-12 flex flex-col gap-4">
            
            <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 text-right">
              <span className="text-white text-xs font-bold block border-b border-slate-900 pb-2 mb-3">
                بيان مطابقة الوثائق البيطرية والجمركية (المنفذ الحدودي والجمارك)
              </span>

              <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                انقر على الوثائق أدناه بشكل تفاعلي سريع لتثبيتها أو ترفيقها فور تسليمها بملف الشحنة للمرافق وسائق البراد للعبور السريع من الحدود:
              </p>

              <div className="space-y-4">
                {shipments.map(s => {
                  const itemsCount = [s.healthCertAttached, s.originCertAttached, s.invoiceAttached, s.permitAttached].filter(Boolean).length;
                  return (
                    <div key={s.id} className="bg-slate-900 p-4 rounded-xl border border-slate-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      
                      {/* Left: Info */}
                      <div>
                        <span className="text-white text-xs font-black block font-mono">{s.id} | {s.customerName}</span>
                        <span className="text-[10.5px] text-slate-400 mt-1 block">
                          بلد المقصد للبيع: 🌍 {s.targetCountry} | منفذ العبور: {s.exitPort}
                        </span>
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <span className="text-[9.5px] text-slate-400">معدل الجاهزية للعبور:</span>
                          <span className={`text-[10.5px] font-mono font-bold ${itemsCount === 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {itemsCount * 25}% ({itemsCount} من 4 مستندات جاهزة)
                          </span>
                        </div>
                      </div>

                      {/* Right: Checklist Buttons */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        
                        <button
                          onClick={() => toggleDocument(s.id, 'health')}
                          className={`px-3 py-2 rounded-lg border flex items-center gap-1.5 font-bold cursor-pointer ${
                            s.healthCertAttached ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          <span>🩺 شهادة صحية</span>
                          <span className="font-mono text-[10px]">{s.healthCertAttached ? '✓' : '✗'}</span>
                        </button>

                        <button
                          onClick={() => toggleDocument(s.id, 'origin')}
                          className={`px-3 py-2 rounded-lg border flex items-center gap-1.5 font-bold cursor-pointer ${
                            s.originCertAttached ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          <span>📜 شهادة منشأ</span>
                          <span className="font-mono text-[10px]">{s.originCertAttached ? '✓' : '✗'}</span>
                        </button>

                        <button
                          onClick={() => toggleDocument(s.id, 'invoice')}
                          className={`px-3 py-2 rounded-lg border flex items-center gap-1.5 font-bold cursor-pointer ${
                            s.invoiceAttached ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          <span>📃 فاتورة تجارية</span>
                          <span className="font-mono text-[10px]">{s.invoiceAttached ? '✓' : '✗'}</span>
                        </button>

                        <button
                          onClick={() => toggleDocument(s.id, 'permit')}
                          className={`px-3 py-2 rounded-lg border flex items-center gap-1.5 font-bold cursor-pointer ${
                            s.permitAttached ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          <span>🛡️ تصريح الزراعة</span>
                          <span className="font-mono text-[10px]">{s.permitAttached ? '✓' : '✗'}</span>
                        </button>

                      </div>

                    </div>
                  );
                })}
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
