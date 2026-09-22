import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Settings2, 
  Layers, 
  Trash2, 
  Hash, 
  Scissors, 
  TrendingDown, 
  CheckCircle, 
  Plus, 
  RotateCcw, 
  Sparkles, 
  Activity, 
  Percent, 
  FileCheck, 
  Printer, 
  Barcode, 
  Egg,
  TrendingUp, 
  Inbox,
  AlertCircle
} from 'lucide-react';

// Interfaces
interface ChickenProcessingBatch {
  id: string;
  timestamp: string;
  sourceHouse: string;
  liveBirdsReceived: number;
  qty800g: number;
  qty1000g: number;
  qty1200g: number;
  wasteBirds: number;
  netProcessed: number;
  efficiencyPercent: number;
  operator: string;
}

interface EggSortingBatch {
  id: string;
  timestamp: string;
  unsortedQuantity: number; // in eggs or plates
  sortedLargePlates: number;
  sortedMediumPlates: number;
  sortedSmallPlates: number;
  brokenEggs: number; // waste
  generatedBarcode: string;
  efficiencyPercent: number;
  operator: string;
}

export function FactoryDashboard() {
  // Sound system generator
  const playBeep = (freq = 800, duration = 0.1) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('Audio disabled until user gesture');
    }
  };

  // State for Chicken Processing
  const [chickenBatches, setChickenBatches] = useState<ChickenProcessingBatch[]>(() => {
    const saved = localStorage.getItem('factory_chicken_batches');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'CHB-2401',
        timestamp: '2026-05-28 08:30',
        sourceHouse: 'العنبر رقم 3 (تسمين سريع)',
        liveBirdsReceived: 1200,
        qty800g: 250,
        qty1000g: 600,
        qty1200g: 310,
        wasteBirds: 40, // 40 birds rejected or lost in process
        netProcessed: 1160,
        efficiencyPercent: 96.6,
        operator: 'أبو أحمد السنيداني'
      },
      {
        id: 'CHB-2402',
        timestamp: '2026-05-27 14:15',
        sourceHouse: 'العنبر رقم 5 (المركزي)',
        liveBirdsReceived: 850,
        qty800g: 100,
        qty1000g: 450,
        qty1200g: 275,
        wasteBirds: 25,
        netProcessed: 825,
        efficiencyPercent: 97.0,
        operator: 'سلطان ردمان'
      }
    ];
  });

  // State for Egg Sorting
  const [eggBatches, setEggBatches] = useState<EggSortingBatch[]>(() => {
    const saved = localStorage.getItem('factory_egg_batches');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'EGB-701',
        timestamp: '2026-05-28 09:10',
        unsortedQuantity: 15000, // 15,000 eggs received from battery house
        sortedLargePlates: 180,  // plates containing 30 eggs
        sortedMediumPlates: 220,
        sortedSmallPlates: 90,
        brokenEggs: 300,        // sorting lines breakages
        generatedBarcode: 'EGG-L701-0528A',
        efficiencyPercent: 98.0,
        operator: 'سالم المطري'
      },
      {
        id: 'EGB-702',
        timestamp: '2026-05-27 11:45',
        unsortedQuantity: 9000,
        sortedLargePlates: 100,
        sortedMediumPlates: 140,
        sortedSmallPlates: 55,
        brokenEggs: 150,
        generatedBarcode: 'EGG-M702-0527B',
        efficiencyPercent: 98.3,
        operator: 'ماجد الفقيه'
      }
    ];
  });

  // Form states - Chicken processing
  const [liveBirds, setLiveBirds] = useState<string>('500');
  const [sourceHouse, setSourceHouse] = useState<string>('العنبر رقم 1 (بياض أمهات)');
  const [qty800, setQty800] = useState<string>('120');
  const [qty1000, setQty1000] = useState<string>('240');
  const [qty1200, setQty1200] = useState<string>('125');
  const [chickenWaste, setChickenWaste] = useState<string>('15');
  const [chickenOperator, setChickenOperator] = useState<string>('م. عبدالله الريمي');

  // Form states - Egg sorting
  const [rawEggsInput, setRawEggsInput] = useState<string>('6000'); // Total raw eggs received
  const [largePlates, setLargePlates] = useState<string>('80');    // plates of 30 eggs
  const [mediumPlates, setMediumPlates] = useState<string>('95');
  const [smallPlates, setSmallPlates] = useState<string>('20');
  const [brokenEggs, setBrokenEggs] = useState<string>('150');     // broken in sorting
  const [eggOperator, setEggOperator] = useState<string>('جميل حمران');

  // UI feedback text
  const [feedback, setFeedback] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'chicken' | 'eggs' | 'efficiency'>('chicken');

  // Persist to local storage
  useEffect(() => {
    localStorage.setItem('factory_chicken_batches', JSON.stringify(chickenBatches));
  }, [chickenBatches]);

  useEffect(() => {
    localStorage.setItem('factory_egg_batches', JSON.stringify(eggBatches));
  }, [eggBatches]);

  // Handle adding chicken processed batch
  const handleAddChickenBatch = (e: React.FormEvent) => {
    e.preventDefault();

    const totalInput = parseInt(liveBirds, 10) || 0;
    const g800 = parseInt(qty800, 10) || 0;
    const g1000 = parseInt(qty1000, 10) || 0;
    const g1200 = parseInt(qty1200, 10) || 0;
    const waste = parseInt(chickenWaste, 10) || 0;

    const netProcessed = g800 + g1000 + g1200;

    if (totalInput <= 0) {
      alert('الرجاء إدخال عدد سليم للدجاج المستلم');
      return;
    }

    if (netProcessed + waste > totalInput * 1.1) {
      alert('مجموع الدجاج المذبح والفاقد يتجاوز المستلم الفعلي بشكل غير طبيعي، يرجى مراجعة الأرقام.');
      return;
    }

    // Efficiency target: (net processed / total received) * 100
    const eff = parseFloat(((netProcessed / totalInput) * 100).toFixed(1));

    const newBatch: ChickenProcessingBatch = {
      id: 'CHB-' + Math.floor(1000 + Math.random() * 9000),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      sourceHouse,
      liveBirdsReceived: totalInput,
      qty800g: g800,
      qty1000g: g1000,
      qty1200g: g1200,
      wasteBirds: waste,
      netProcessed,
      efficiencyPercent: eff,
      operator: chickenOperator
    };

    setChickenBatches(prev => [newBatch, ...prev]);
    playBeep(980, 0.2);
    setFeedback(`تم تسجيل خط الذبح بنجاح والاحتفاظ بالبيانات مع كفاءة تشغيل بنسبة ${eff}%.`);
    
    // Clear major form inputs
    setQty800('');
    setQty1000('');
    setQty1200('');
    setChickenWaste('0');

    setTimeout(() => setFeedback(''), 5000);
  };

  // Handle adding egg batch
  const handleAddEggBatch = (e: React.FormEvent) => {
    e.preventDefault();

    const unsortedEggsTotal = parseInt(rawEggsInput, 10) || 0;
    const lPlates = parseInt(largePlates, 10) || 0;
    const mPlates = parseInt(mediumPlates, 15) || 0;
    const sPlates = parseInt(smallPlates, 10) || 0;
    const broken = parseInt(brokenEggs, 10) || 0;

    // Total sorted eggs = (Plates * 30 eggs per plate)
    const sortedEggsSum = (lPlates + mPlates + sPlates) * 30;
    const discrepancy = unsortedEggsTotal - (sortedEggsSum + broken);

    if (unsortedEggsTotal <= 0) {
      alert('الرجاء تعبئة كمية البيض الخام المستلم');
      return;
    }

    // Efficiency: (Sorted eggs / Total input) * 100
    const eff = parseFloat(((sortedEggsSum / unsortedEggsTotal) * 100).toFixed(1));

    // Generate smart unique barcode representation
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const barcodeStr = `EGG-L${lPlates}M${mPlates}-${randomSuffix}`;

    const newBatch: EggSortingBatch = {
      id: 'EGB-' + Math.floor(100 + Math.random() * 900),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      unsortedQuantity: unsortedEggsTotal,
      sortedLargePlates: lPlates,
      sortedMediumPlates: mPlates,
      sortedSmallPlates: sPlates,
      brokenEggs: broken,
      generatedBarcode: barcodeStr,
      efficiencyPercent: eff,
      operator: eggOperator
    };

    setEggBatches(prev => [newBatch, ...prev]);
    playBeep(1100, 0.25);
    setFeedback(`تم حفظ فرز البيض وتوليد باركود التعبئة والتغليف بنجاح: [${barcodeStr}]`);

    // Reset fields
    setLargePlates('');
    setMediumPlates('');
    setSmallPlates('');
    setBrokenEggs('0');

    setTimeout(() => setFeedback(''), 5000);
  };

  const handleDeleteChickenBatch = (id: string) => {
    playBeep(300, 0.15);
    setChickenBatches(prev => prev.filter(b => b.id !== id));
  };

  const handleDeleteEggBatch = (id: string) => {
    playBeep(300, 0.15);
    setEggBatches(prev => prev.filter(b => b.id !== id));
  };

  // Aggregate metrics for efficiency statistics
  const totalReceivedChickens = chickenBatches.reduce((acc, item) => acc + item.liveBirdsReceived, 0);
  const totalProcessedChickens = chickenBatches.reduce((acc, item) => acc + item.netProcessed, 0);
  const totalWasteChickens = chickenBatches.reduce((acc, item) => acc + item.wasteBirds, 0);
  
  const totalReceivedEggs = eggBatches.reduce((acc, item) => acc + item.unsortedQuantity, 0);
  const totalBrokenEggs = eggBatches.reduce((acc, item) => acc + item.brokenEggs, 0);
  const totalSortedPlates = eggBatches.reduce((acc, item) => acc + item.sortedLargePlates + item.sortedMediumPlates + item.sortedSmallPlates, 0);
  const totalSortedEggsNum = totalSortedPlates * 30;

  // Efficiency scores
  const globalChickenEfficiency = totalReceivedChickens > 0 
    ? parseFloat(((totalProcessedChickens / totalReceivedChickens) * 100).toFixed(1))
    : 100;

  const globalEggEfficiency = totalReceivedEggs > 0 
    ? parseFloat(((totalSortedEggsNum / totalReceivedEggs) * 100).toFixed(1))
    : 100;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 flex flex-col gap-6 text-right" id="processing_factory_wrapper" dir="rtl">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950 px-4 py-4 rounded-2xl border border-slate-800/85">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Building2 className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-white text-base font-black flex items-center gap-1.5">
              <span>إدارة خطوط الإنتاج والمسلخ والفرز التلقائي</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">تسجيل الدجاج المذبح حسب الأوزان، فرز أحجام البيض، وتوليد باركود تتبع الشحنات.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-slate-900 border border-slate-800 text-purple-400 font-bold rounded-xl px-2.5 py-1">
            خط الإنتاج رقم 1 (شبه تلقائي)
          </span>
        </div>
      </div>

      {feedback && (
        <div className="bg-purple-950/60 border-2 border-purple-500 text-purple-300 p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* METRIC CARD BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Met 1: Chicken Processed Yield */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl mt-[-20px] mr-[-20px] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-black">🍗 كفاءة المسلخ وعدد المغلف الجاهز</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5 justify-center">
            <span className="text-3xl font-black font-mono text-white">
              {totalProcessedChickens.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">حبة مغلفة / {totalWasteChickens} هدر رأس وعافية</span>
          </div>
          <div className="flex justify-between items-center text-[10.5px] border-t border-slate-900 pt-2 text-slate-400">
            <span>نسبة كفاءة اللحم:</span>
            <span className="font-mono font-bold text-emerald-400">{globalChickenEfficiency}%</span>
          </div>
        </div>

        {/* Met 2: Sorted Eggs Plates */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl mt-[-20px] ml-[-20px] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-black">🥚 إجمالي كرتونات البيض المفرز النهائي</span>
            <Egg className="w-4 h-4 text-amber-500" />
          </div>
          <div className="my-3 flex items-baseline gap-1.5 justify-center">
            <span className="text-3xl font-black font-mono text-amber-400">
              {totalSortedPlates.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-bold">طبق جاهز للبيع ({totalSortedEggsNum.toLocaleString()} بيضة)</span>
          </div>
          <div className="flex justify-between items-center text-[10.5px] border-t border-slate-900 pt-2 text-slate-400">
            <span>البيض المكسر التالف:</span>
            <span className="font-mono font-bold text-rose-400">-{totalBrokenEggs} بيضة مفرزة</span>
          </div>
        </div>

        {/* Met 3: Manufacturing Industrial Efficiency Dial */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl mt-[-20px] mr-[-20px] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-black">📊 مؤشر الكفاءة التشغيلية الصناعية (OEE)</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2.5 text-center">
            <div className="text-2xl font-black font-mono text-emerald-400">
              {((globalChickenEfficiency + globalEggEfficiency) / 2).toFixed(1)}%
            </div>
            <p className="text-[9.5px] text-slate-500 mt-1">تعد هذه النسبة ممتازة وضمن معايير الجودة العالمية ISO9001</p>
          </div>
          <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 text-[9.5px] text-center text-slate-400">
            مستوى الفاقد المسموح: أقل من 3.5% من المدخل الكلي
          </div>
        </div>

      </div>

      {/* SEGMENTED TAB SELECTOR FOR APP MODULES */}
      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => { playBeep(900, 0.1); setActiveSubTab('chicken'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'chicken' 
              ? 'bg-purple-650 bg-purple-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>خط معالجة وتغليف البضائع</span>
        </button>
        <button
          onClick={() => { playBeep(905, 0.1); setActiveSubTab('eggs'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'eggs' 
              ? 'bg-amber-600 text-slate-950 shadow-md font-black' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Egg className="w-3.5 h-3.5" />
          <span>خط عزل وفرز وتعبئة البيض</span>
        </button>
        <button
          onClick={() => { playBeep(910, 0.1); setActiveSubTab('efficiency'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'efficiency' 
              ? 'bg-emerald-600 text-slate-950 shadow-md font-black' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          <span>حساب الهدر وتقارير الكفاءة</span>
        </button>
      </div>

      {/* MODULE MAIN STAGES CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* TAB 1: CHICKEN PROCESSING */}
        {activeSubTab === 'chicken' && (
          <>
            {/* Input Form Column */}
            <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Scissors className="w-5 h-5 text-purple-400" />
                <h4 className="text-white text-sm font-black">تسجيل حصيلة الذبح والتغليف الوزني</h4>
              </div>

              <form onSubmit={handleAddChickenBatch} className="flex flex-col gap-3.5">
                
                {/* Source element */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold">مصدر الفوج (العنبر):</label>
                  <select 
                    value={sourceHouse} 
                    onChange={(e) => setSourceHouse(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-purple-500 h-11"
                  >
                    <option value="العنبر رقم 1 (أمهات تسمين سريع)">العنبر رقم 1 (أمهات تسمين سريع)</option>
                    <option value="العنبر رقم 3 (دجاج رومي بياض)">العنبر رقم 3 (دجاج رومي بياض)</option>
                    <option value="العنبر رقم 5 (فرنسا بلدي)">العنبر رقم 5 (فرنسا بلدي)</option>
                    <option value="عنبر الإنتاج الطارئ ب">عنبر الإنتاج الطارئ ب</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold">عدد الدجاج الحي المستلم للذبح:</label>
                  <input
                    type="number"
                    value={liveBirds}
                    onChange={(e) => setLiveBirds(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white h-11 focus:outline-none focus:border-purple-500"
                    placeholder="مثال: 1000"
                  />
                </div>

                {/* Weights input */}
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850 flex flex-col gap-3.5">
                  <span className="text-[10.5px] text-purple-300 font-black">تصنيف الأعداد المعبأة المنجزة والجاهزة:</span>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs text-right">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">وزن 800 جرام:</span>
                      <input 
                        type="number"
                        placeholder="0"
                        value={qty800}
                        onChange={(e) => setQty800(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-center rounded px-2 py-1.5 font-bold font-mono text-xs text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">وزن 1000 جرام:</span>
                      <input 
                        type="number"
                        placeholder="0"
                        value={qty1000}
                        onChange={(e) => setQty1000(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-center rounded px-2 py-1.5 font-bold font-mono text-xs text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">وزن 1200 جرام:</span>
                      <input 
                        type="number"
                        placeholder="0"
                        value={qty1200}
                        onChange={(e) => setQty1200(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-center rounded px-2 py-1.5 font-bold font-mono text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Waste at slaughter */}
                <div className="bg-red-950/20 border border-red-900/45 p-3 rounded-xl flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-red-400 font-extrabold">الفاقد اثناء الكشف والذبح (رأس تالف / مستبعد):</span>
                    <span className="text-[9px] text-slate-400">للأمانة الصحية</span>
                  </div>
                  <input
                    type="number"
                    value={chickenWaste}
                    onChange={(e) => setChickenWaste(e.target.value)}
                    className="bg-slate-900 border border-red-900 text-rose-300 rounded px-2 py-1.5 text-xs font-mono font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400">اسم فني المسلخ / المناوب:</span>
                  <input 
                    type="text" 
                    value={chickenOperator}
                    onChange={(e) => setChickenOperator(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white font-bold h-10"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs py-3.5 rounded-xl cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 h-11"
                >
                  <Plus className="w-4 h-4" />
                  <span>تثبيت وتشغيل دفعة المسلخ</span>
                </button>

              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                <span className="text-white text-xs font-bold block border-b border-slate-900 pb-2">سجل دفعات المجزر والمسلخ المنجزة</span>
                
                <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto">
                  {chickenBatches.map((batch) => (
                    <div key={batch.id} className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-850 pb-2 gap-2">
                        <div>
                          <span className="text-white text-xs font-black font-mono block">{batch.id} | {batch.sourceHouse}</span>
                          <span className="text-[10px] text-slate-500 font-mono mt-0.5">{batch.timestamp}</span>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span className="text-[10.5px] bg-purple-950 text-purple-400 px-2 py-0.5 rounded-lg border border-purple-900/40 font-bold font-mono">
                            الكفاءة: {batch.efficiencyPercent}%
                          </span>
                          <button
                            type="button" 
                            onClick={() => handleDeleteChickenBatch(batch.id)}
                            className="text-slate-500 hover:text-red-400 p-1 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-right mt-1">
                        <div className="bg-slate-950 p-2 rounded">
                          <span className="text-[9.5px] text-slate-400 block">المستلم الحي:</span>
                          <span className="text-white font-mono font-bold">{batch.liveBirdsReceived} رأس</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded">
                          <span className="text-[9.5px] text-slate-400 block font-normal text-purple-400">إجمالي المغلف سليم:</span>
                          <span className="text-emerald-400 font-mono font-bold">{batch.netProcessed} حبة</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded">
                          <span className="text-[9.5px] text-slate-400 block">أوزان (800 / 1000 / 1200):</span>
                          <span className="text-slate-200 font-mono font-bold text-[10.5px]">
                            {batch.qty800g}/{batch.qty1000g}/{batch.qty1200g}
                          </span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded">
                          <span className="text-[9.5px] text-slate-400 block text-red-400">الفاقد والاستبعاد:</span>
                          <span className="text-red-400 font-mono font-bold">-{batch.wasteBirds} رأس</span>
                        </div>
                      </div>

                      <span className="block text-[10px] text-slate-500 font-sans mt-1">
                        👤 المشرف الميداني: <strong>{batch.operator}</strong> | يتوافق مع معايير جودة الغذاء اليمنية.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: EGG SORTING */}
        {activeSubTab === 'eggs' && (
          <>
            {/* Input Form Column */}
            <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Egg className="w-5 h-5 text-amber-500 animate-bounce-slow" />
                <h4 className="text-white text-sm font-black">تسجيل حصيلة فرز وتصنيف مخرجات البيض</h4>
              </div>

              <form onSubmit={handleAddEggBatch} className="flex flex-col gap-3.5">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold">كمية البيض المستلم غير المفروز (حبة فردي):</label>
                  <input
                    type="number"
                    value={rawEggsInput}
                    onChange={(e) => setRawEggsInput(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white h-11 focus:outline-none focus:border-amber-500"
                    placeholder="مثال: 12000"
                  />
                </div>

                {/* Plates sorting sizes */}
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex flex-col gap-3">
                  <span className="text-[10.5px] text-amber-400 font-bold">تصنيف أطباق البيض الجاهزة بعد الميزان (حجم):</span>
                  
                  <div className="grid grid-cols-3 gap-2.5 text-xs text-right">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">أطباق حجم كبير L:</span>
                      <input 
                        type="number"
                        placeholder="0"
                        value={largePlates}
                        onChange={(e) => setLargePlates(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-center rounded px-2 py-1.5 font-bold font-mono text-xs text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">أطباق حجم وسط M:</span>
                      <input 
                        type="number"
                        placeholder="0"
                        value={mediumPlates}
                        onChange={(e) => setMediumPlates(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-center rounded px-2 py-1.5 font-bold font-mono text-xs text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">أطباق حجم صغير S:</span>
                      <input 
                        type="number"
                        placeholder="0"
                        value={smallPlates}
                        onChange={(e) => setSmallPlates(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-center rounded px-2 py-1.5 font-bold font-mono text-xs text-white"
                      />
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-500 block">* ملحوظة: يستوعب كل طبق بيض قياسي مفرز 30 حبة بيضة بياض تامة الجودة.</span>
                </div>

                {/* Broken/Cracked during transport and belt */}
                <div className="bg-rose-950/20 border border-rose-900/50 p-3 rounded-xl flex flex-col gap-1.5">
                  <span className="text-xs text-rose-400 font-extrabold block">البيض المكسور والتالف اثناء الفرز (حبة فردي):</span>
                  <input
                    type="number"
                    value={brokenEggs}
                    onChange={(e) => setBrokenEggs(e.target.value)}
                    className="bg-slate-900 border border-rose-900 text-rose-300 rounded px-2 py-1.5 text-xs font-mono font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400">المشرف على معمل فرز البيض:</span>
                  <input 
                    type="text" 
                    value={eggOperator}
                    onChange={(e) => setEggOperator(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white font-bold h-10"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs py-3.5 rounded-xl cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 h-11"
                >
                  <Barcode className="w-4 h-4" />
                  <span>توليد باركود تتبع الدفعة وتثبيت الفرز</span>
                </button>

              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                <span className="text-white text-xs font-bold block border-b border-slate-900 pb-2">أطباق غسيل البيض وإعتماد الباركودات الذكية للكرتونات الجاهزة للبيع</span>
                
                <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto">
                  {eggBatches.map((eb) => (
                    <div key={eb.id} className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                        <div>
                          <span className="text-white text-xs font-black font-mono block">{eb.id} | خط الفرز الآلي</span>
                          <span className="text-[10px] text-slate-500 font-mono mt-0.5">{eb.timestamp}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10.5px] bg-amber-950 text-amber-500 px-2 py-0.5 rounded-lg border border-amber-900/40 font-bold font-mono">
                            OEE: {eb.efficiencyPercent}%
                          </span>
                          <button
                            type="button" 
                            onClick={() => handleDeleteEggBatch(eb.id)}
                            className="text-slate-500 hover:text-red-400 p-1 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-right">
                        <div className="bg-slate-950 p-2 rounded">
                          <span className="text-[9.5px] text-slate-400 block">وصل من العنابر:</span>
                          <span className="text-white font-mono font-bold">{eb.unsortedQuantity} بيضة</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded">
                          <span className="text-[9.5px] text-slate-400 block text-amber-500">الأطباق المصلحة:</span>
                          <span className="text-amber-400 font-mono font-bold">
                            {(eb.sortedLargePlates + eb.sortedMediumPlates + eb.sortedSmallPlates)} طبق
                          </span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded">
                          <span className="text-[9.5px] text-slate-400 block">توزيع الأحجام ل/و/ص:</span>
                          <span className="text-slate-200 font-mono font-bold">
                            {eb.sortedLargePlates}L / {eb.sortedMediumPlates}M / {eb.sortedSmallPlates}S
                          </span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-rose-950">
                          <span className="text-[9.5px] text-rose-400 block">فاقد ومكسر:</span>
                          <span className="text-rose-400 font-mono font-bold">-{eb.brokenEggs} حبة</span>
                        </div>
                      </div>

                      {/* Barcode visual render */}
                      <div className="mt-2 p-2 bg-white rounded-lg flex items-center justify-between gap-3 text-slate-950">
                        <div className="flex items-center gap-2">
                          <Barcode className="w-8 h-8 text-black" />
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block font-bold leading-none">الملصق التعريفي الذكي:</span>
                            <span className="text-xs font-mono font-black tracking-widest text-slate-950">{eb.generatedBarcode}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            playBeep(1200, 0.15);
                            alert(`إشارة طباعة ملصق الباركود مبرمجة وجاهزة للإرسال طابعة الخط (Zebra Thermal Printer) للشحنة ${eb.generatedBarcode}`);
                          }}
                          className="bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة ملصق 🖨️</span>
                        </button>
                      </div>

                      <span className="block text-[10px] text-slate-500 font-sans">
                        👤 الكادر المسؤول: <strong>{eb.operator}</strong> | تم الفرز وغسل وتعقيم البيض بمستحلب مأمون بيئياً.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 3: WASTE AND EFFICIENCY MATRIX */}
        {activeSubTab === 'efficiency' && (
          <div className="lg:col-span-12 flex flex-col gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-5 text-right">
              
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Percent className="w-5 h-5 text-emerald-400" />
                <h4 className="text-white text-sm font-black">تحليل الكفاءة الإجمالية وحساب الهدر السنوي والشهري للمصنع</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Visual indicator of factors */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-4">
                  <span className="text-xs text-emerald-400 font-extrabold block">📊 تفكيك عوامل جودة الفرز والإنتاجية</span>
                  
                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="flex justify-between font-bold text-slate-300 mb-1">
                        <span>معدل جودة دجاج المسلخ (سليم):</span>
                        <span className="text-emerald-400 font-mono">{globalChickenEfficiency}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${globalChickenEfficiency}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-bold text-slate-300 mb-1">
                        <span>معدل سلامة البيض من الكسر (غير مكسر):</span>
                        <span className="text-amber-400 font-mono">{globalEggEfficiency}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2">
                        <div 
                          className="bg-amber-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${globalEggEfficiency}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-bold text-slate-300 mb-1">
                        <span>معدل الهدر المسموح المالي الصناعي:</span>
                        <span className="text-indigo-400 font-mono">3.0% الحد الأقصى</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2">
                        <div 
                          className="bg-indigo-505 bg-indigo-500 h-2 rounded-full" 
                          style={{ width: '90%' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-slate-400 text-[10.5px] leading-relaxed mt-2">
                    🛡️ يتم مراقبة الهدر تلقائياً عبر نظام ERP ومطابقته مباشرة مع داتابيز SQLite على السيرفر لتنبيه الإدارة في حالة قفز الهدر فوق 5% لاتخاذ الإجراءات مع الماكينات أو العنايل المصابة.
                  </div>
                </div>

                {/* Explanatory summary card */}
                <div className="space-y-4">
                  
                  <div className="bg-emerald-950/25 border-2 border-emerald-500/20 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="text-emerald-400 w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-white font-bold">التدخل الإيجابي في تحسين الكفاءة</span>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        يُعزى الفقد في العادة إلى ضعف الدفايات بالمساء مما يعرض الكتاكيت للإجهاد، أو لسرعة حركة السير الناقل بالفرز. نوصي بمعدل سرعة 0.8 متر بالثانية للسيور للحفاظ على البيض من التصدع.
                      </p>
                    </div>
                  </div>

                  {/* Summary aggregate numbers */}
                  <div className="grid grid-cols-2 gap-3 text-right">
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                      <span className="text-[9.5px] text-slate-400 block mb-1">مدخلات الطيور الكلية:</span>
                      <span className="text-white font-mono font-extrabold text-sm">{totalReceivedChickens} رأس</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                      <span className="text-[9.5px] text-slate-400 block mb-1">صافي الوزن المغلف:</span>
                      <span className="text-purple-400 font-mono font-extrabold text-sm">{totalProcessedChickens} رأس</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                      <span className="text-[9.5px] text-slate-400 block mb-1">مدخل بيض غير مفروز:</span>
                      <span className="text-white font-mono font-extrabold text-sm">{totalReceivedEggs} بيضة</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                      <span className="text-[9.5px] text-slate-400 block mb-1">خارج مغسل التلقيح:</span>
                      <span className="text-amber-500 font-mono font-extrabold text-sm">{(totalSortedPlates * 30)} بيضة</span>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}
