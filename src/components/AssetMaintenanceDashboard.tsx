import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Trash2, 
  Plus, 
  CheckCircle, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  Sparkles, 
  Clock, 
  Coins, 
  Calendar, 
  Truck, 
  Hammer, 
  CheckSquare, 
  Sliders, 
  Cpu
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, query, where, onSnapshot, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';

interface FixedAsset {
  id: string;
  name: string;
  category: 'generator' | 'cooling' | 'vehicle' | 'tipper' | 'other';
  purchaseDate: string;
  purchaseValueUSD: number;
  purchaseValueYER: number;
  status: 'operational' | 'under_maintenance' | 'broken';
  lastServiceHoursOrDate: string;
  serialNumber: string;
}

interface MaintenanceSchedule {
  id: string;
  assetId: string;
  assetName: string;
  taskName: string;
  frequencyDaysOrHours: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  priority: 'high' | 'medium' | 'low';
}

interface BreakdownLog {
  id: string;
  assetId: string;
  assetName: string;
  issueDescription: string;
  sparePartsCostYER: number;
  sparePartsCostUSD: number;
  laborCostUSD: number;
  reporter: string;
  loggedDate: string;
  accountingStatus: 'pending_ledger' | 'posted_to_expenses';
}

interface AssetMaintenanceProps {
  registeredAssetNames?: string[];
  onRegisterNewAssetName?: (name: string) => void;
  ownerId?: string;
  storeId?: string;
}

export function AssetMaintenanceDashboard({ 
  registeredAssetNames = [], 
  onRegisterNewAssetName,
  ownerId,
  storeId
}: AssetMaintenanceProps) {
  // Play sound effect for user actions
  const playBeep = (freq = 840, duration = 0.12) => {
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
      console.log('Audio feedback requires manual user gesture.');
    }
  };

  // Fixed Assets State
  const [assets, setAssets] = useState<FixedAsset[]>([]);

  // Scheduled Maintenance Program State
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);

  // Sudden Breakdowns logs with Cost calculations
  const [breakdowns, setBreakdowns] = useState<BreakdownLog[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);

  // Sync state changes to local Storage when offline / Firestore when online
  useEffect(() => {
    if (!ownerId) {
      // Offline fallback
      const saved = localStorage.getItem('erp_fixed_assets');
      if (saved) {
        setAssets(JSON.parse(saved));
      } else {
        setAssets([]);
      }
      return;
    }

    setIsSyncing(true);
    const qAssets = query(collection(db, 'fixed_assets'), where('ownerId', '==', ownerId), where('storeId', '==', storeId || 'main_store'));
    const unsubAssets = onSnapshot(qAssets, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as FixedAsset);
      setAssets(items);
      setIsSyncing(false);
    }, err => {
      console.warn('Sync fixed_assets err:', err);
      setIsSyncing(false);
    });

    return () => unsubAssets();
  }, [ownerId, storeId]);

  useEffect(() => {
    if (!ownerId) {
      const saved = localStorage.getItem('erp_maintenance_schedules');
      if (saved) {
        setSchedules(JSON.parse(saved));
      } else {
        setSchedules([]);
      }
      return;
    }

    const qSchedules = query(collection(db, 'maintenance_schedules'), where('ownerId', '==', ownerId), where('storeId', '==', storeId || 'main_store'));
    const unsubSchedules = onSnapshot(qSchedules, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MaintenanceSchedule);
      setSchedules(items);
    }, err => console.warn('Sync schedules err:', err));

    return () => unsubSchedules();
  }, [ownerId, storeId]);

  useEffect(() => {
    if (!ownerId) {
      const saved = localStorage.getItem('erp_breakdowns_logs');
      if (saved) {
        setBreakdowns(JSON.parse(saved));
      } else {
        setBreakdowns([]);
      }
      return;
    }

    const qBreakdowns = query(collection(db, 'breakdown_logs'), where('ownerId', '==', ownerId), where('storeId', '==', storeId || 'main_store'));
    const unsubBreakdowns = onSnapshot(qBreakdowns, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as BreakdownLog);
      setBreakdowns(items);
    }, err => console.warn('Sync breakdowns err:', err));

    return () => unsubBreakdowns();
  }, [ownerId, storeId]);

  // Offline syncing fallback (only if ownerId is not present)
  useEffect(() => {
    if (!ownerId && assets.length > 0) {
      localStorage.setItem('erp_fixed_assets', JSON.stringify(assets));
    }
  }, [assets, ownerId]);

  useEffect(() => {
    if (!ownerId && schedules.length > 0) {
      localStorage.setItem('erp_maintenance_schedules', JSON.stringify(schedules));
    }
  }, [schedules, ownerId]);

  useEffect(() => {
    if (!ownerId && breakdowns.length > 0) {
      localStorage.setItem('erp_breakdowns_logs', JSON.stringify(breakdowns));
    }
  }, [breakdowns, ownerId]);

  const handleLoadDefaultAssetsTemplate = async () => {
    const defaultAssets = [
      {
        id: 'ASSET-101',
        name: 'ماكينة كبس وفك الزجاج الحراري لشاشات الجوالات',
        category: 'generator' as const,
        purchaseDate: '2024-03-12',
        purchaseValueUSD: 3500,
        purchaseValueYER: 1855000,
        status: 'operational' as const,
        lastServiceHoursOrDate: '200 ساعة استخدام',
        serialNumber: 'LAM-PRESS-992'
      },
      {
        id: 'ASSET-102',
        name: 'مجهر إلكتروني احترافي 4K لمركز صيانة المايكرولحام',
        category: 'cooling' as const,
        purchaseDate: '2025-01-15',
        purchaseValueUSD: 1200,
        purchaseValueYER: 636000,
        status: 'operational' as const,
        lastServiceHoursOrDate: '2026-04-10',
        serialNumber: 'MICROSCOPE-4K-882'
      },
      {
        id: 'ASSET-103',
        name: 'سيرفر البث الشبكي المحلي ونظام الكاشير الموحد',
        category: 'tipper' as const,
        purchaseDate: '2023-08-20',
        purchaseValueUSD: 2500,
        purchaseValueYER: 1325000,
        status: 'operational' as const,
        lastServiceHoursOrDate: 'فحص فلاتر التبريد والتحديث',
        serialNumber: 'SRV-POS-771'
      }
    ];

    const defaultSchedules = [
      {
        id: 'SCH-301',
        assetId: 'ASSET-101',
        assetName: 'ماكينة كبس وفك الزجاج الحراري لشاشات الجوالات',
        taskName: 'معايرة ضغط الهيدروليك وتنظيف مضخة الشفط',
        frequencyDaysOrHours: 'كل 100 ساعة عمل',
        dueDate: '2026-06-05',
        status: 'pending' as const,
        priority: 'high' as const
      },
      {
        id: 'SCH-302',
        assetId: 'ASSET-102',
        assetName: 'مجهر إلكتروني احترافي 4K لمركز صيانة المايكرولحام',
        taskName: 'تنظيف ومعايرة العدسات البصرية وفحص الإضاءة',
        frequencyDaysOrHours: 'كل 60 يوم',
        dueDate: '2026-05-24',
        status: 'pending' as const,
        priority: 'medium' as const
      }
    ];

    if (ownerId && storeId) {
      const batch = writeBatch(db);
      defaultAssets.forEach(a => {
        const ref = doc(db, 'fixed_assets', a.id);
        batch.set(ref, { ...a, ownerId, storeId });
      });
      defaultSchedules.forEach(s => {
        const ref = doc(db, 'maintenance_schedules', s.id);
        batch.set(ref, { ...s, ownerId, storeId });
      });
      try {
        await batch.commit();
        setMsg('✅ تم تحميل وتهيئة قوالب الأصول الافتراضية وحفظها سحابياً بنجاح.');
      } catch (err: any) {
        alert('حدث خطأ أثناء الاتصال بالخادم: ' + err.message);
      }
    } else {
      setAssets(defaultAssets);
      setSchedules(defaultSchedules);
      setMsg('✅ تم تفعيل قوالب الأصول الافتراضية أوفلاين.');
    }
    setTimeout(() => setMsg(''), 4000);
  };

  // UI Interactive States
  const [activeTab, setActiveTab] = useState<'status' | 'add_asset' | 'breakdowns' | 'scheduled'>('status');
  const [msg, setMsg] = useState<string>('');

  // Form State: Add Asset
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState<'generator' | 'cooling' | 'vehicle' | 'tipper' | 'other'>('generator');
  const [assetValUsd, setAssetValUsd] = useState('15000');
  const [assetSerial, setAssetSerial] = useState('');
  const [assetHours, setAssetHours] = useState('0 ساعة');
  const [assetPurchaseDate, setAssetPurchaseDate] = useState('2026-05-28');

  // Form State: Breakdown report
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [breakdownDesc, setBreakdownDesc] = useState('');
  const [partsCostYer, setPartsCostYer] = useState('53000'); // defaults
  const [laborCostUsd, setLaborCostUsd] = useState('20');
  const [breakdownReporter, setBreakdownReporter] = useState('طه الهندي - قسم الصيانة');

  // Sync state changes to local Storage
  useEffect(() => {
    localStorage.setItem('erp_fixed_assets', JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    localStorage.setItem('erp_maintenance_schedules', JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    localStorage.setItem('erp_breakdowns_logs', JSON.stringify(breakdowns));
  }, [breakdowns]);

  // Set selectedAssetId logic safely
  useEffect(() => {
    if (assets.length > 0 && !selectedAssetId) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  // Submit breakdown log (with instant posting to expenses)
  const handleAddBreakdown = (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakdownDesc.trim()) {
      alert('الرجاء كتابة وصف دقيق للعطل المفاجئ لقطع الغيار.');
      return;
    }

    const selectedAsset = assets.find(a => a.id === selectedAssetId);
    if (!selectedAsset) return;

    const yer = parseFloat(partsCostYer) || 0;
    const usdEquivalent = parseFloat((yer / 530).toFixed(1)); // 530 average YER rate
    const labor = parseFloat(laborCostUsd) || 0;

    const newLog: BreakdownLog = {
      id: 'BRK-' + Math.floor(500 + Math.random() * 500),
      assetId: selectedAssetId,
      assetName: selectedAsset.name,
      issueDescription: breakdownDesc.trim(),
      sparePartsCostYER: yer,
      sparePartsCostUSD: usdEquivalent,
      laborCostUSD: labor,
      reporter: breakdownReporter.trim(),
      loggedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      accountingStatus: 'posted_to_expenses' // Automatically posted to journal standard expenses
    };

    if (ownerId && storeId) {
      setDoc(doc(db, 'breakdown_logs', newLog.id), { ...newLog, ownerId, storeId }).then(() => {
        updateDoc(doc(db, 'fixed_assets', selectedAssetId), { status: 'under_maintenance' }).catch(console.error);
      }).catch(console.error);
    } else {
      setBreakdowns(prev => [newLog, ...prev]);
      setAssets(prev => prev.map(a => a.id === selectedAssetId ? { ...a, status: 'under_maintenance' } : a));
    }

    playBeep(980, 0.25);
    setMsg(`⚠️ تم تقييد العطل بنجاح وترحيله محاسبياً كـ "مصاريف صيانة أصول" بقيمة ${yer.toLocaleString()} ر.ي.`);
    
    // Clear state
    setBreakdownDesc('');
    setTimeout(() => setMsg(''), 5000);
  };

  // Add Asset manual logic
  const handleAddNewAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = assetName.trim();
    if (!trimmedName) {
      alert('الرجاء إدخال اسم الأصل الثابت للمزرعة.');
      return;
    }

    onRegisterNewAssetName?.(trimmedName);

    const valUsd = parseFloat(assetValUsd) || 0;
    const valYer = parseInt((valUsd * 530).toFixed(0), 10);

    const newAsset: FixedAsset = {
      id: 'ASSET-' + Math.floor(105 + Math.random() * 90),
      name: assetName.trim(),
      category: assetCategory,
      purchaseDate: assetPurchaseDate,
      purchaseValueUSD: valUsd,
      purchaseValueYER: valYer,
      status: 'operational',
      lastServiceHoursOrDate: assetHours.trim() || 'لا توجد ساعات عمل سابقة',
      serialNumber: assetSerial.trim() || 'SN-' + Math.floor(10000 + Math.random() * 90000)
    };

    // Auto-create a pending standard maintenance task for this custom asset
    const newSchedule: MaintenanceSchedule = {
      id: 'SCH-' + Math.floor(310 + Math.random() * 90),
      assetId: newAsset.id,
      assetName: newAsset.name,
      taskName: 'الفحص الدوري المبدئي والاختبار الحراري للماكينة',
      frequencyDaysOrHours: 'كل 90 يوم',
      dueDate: '2026-08-28',
      status: 'pending',
      priority: 'medium'
    };

    if (ownerId && storeId) {
      try {
        await setDoc(doc(db, 'fixed_assets', newAsset.id), { ...newAsset, ownerId, storeId });
        await setDoc(doc(db, 'maintenance_schedules', newSchedule.id), { ...newSchedule, ownerId, storeId });
      } catch (err) {
        console.error('Error writing asset to Firestore:', err);
      }
    } else {
      setAssets(prev => [...prev, newAsset]);
      setSchedules(prev => [newSchedule, ...prev]);
    }

    playBeep(1100, 0.2);
    setMsg(`✅ تمت إضافة الأصل الثابت [${newAsset.name}] بنجاح مع جدولة صيانة تلقائية.`);
    
    // Clean form
    setAssetName('');
    setAssetSerial('');
    setAssetHours('');

    setTimeout(() => setMsg(''), 5000);
  };

  // Mark pending maintenance tasks as completed
  const handleCompleteTask = async (taskId: string) => {
    playBeep(1200, 0.15);
    const schedule = schedules.find(s => s.id === taskId);

    if (ownerId && storeId) {
      try {
        await updateDoc(doc(db, 'maintenance_schedules', taskId), { status: 'completed' });
        if (schedule) {
          await updateDoc(doc(db, 'fixed_assets', schedule.assetId), { status: 'operational' });
        }
      } catch (err) {
        console.error('Complete task Firestore err:', err);
      }
    } else {
      setSchedules(prev => prev.map(sch => {
        if (sch.id === taskId) {
          return {
            ...sch,
            status: 'completed'
          };
        }
        return sch;
      }));
      
      // Find the corresponding asset and reset status to 'operational'
      if (schedule) {
        setAssets(prev => prev.map(a => a.id === schedule.assetId ? { ...a, status: 'operational' } : a));
      }
    }

    setMsg('⚡ تم تغيير حالة الصيانة إلى منجزة وإرسال التغذية لقسم الجرد والتشغيل.');
    setTimeout(() => setMsg(''), 4000);
  };

  // Delete Breakdown/Log
  const handleDeleteBreakdown = async (id: string) => {
    playBeep(320, 0.1);
    if (ownerId && storeId) {
      try {
        await deleteDoc(doc(db, 'breakdown_logs', id));
      } catch (err) {
        console.error('Delete breakdown log Firestore err:', err);
      }
    } else {
      setBreakdowns(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleDeleteAsset = async (id: string) => {
    playBeep(320, 0.1);
    if (ownerId && storeId) {
      try {
        await deleteDoc(doc(db, 'fixed_assets', id));
        // Delete related schedules
        const relatedSchedules = schedules.filter(s => s.assetId === id);
        for (const sch of relatedSchedules) {
          await deleteDoc(doc(db, 'maintenance_schedules', sch.id));
        }
      } catch (err) {
        console.error('Delete asset Firestore err:', err);
      }
    } else {
      setAssets(prev => prev.filter(a => a.id !== id));
      setSchedules(prev => prev.filter(s => s.assetId !== id));
    }
  };

  // Math helper
  const totalAssetsValueYER = assets.reduce((sum, item) => sum + item.purchaseValueYER, 0);
  const totalActualMaintenanceCostYER = breakdowns.reduce((sum, item) => sum + item.sparePartsCostYER, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 flex flex-col gap-6 text-right" id="fixed_assets_and_maintenance_dashboard" dir="rtl">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950 px-4 py-4 rounded-2xl border border-slate-800/85">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Wrench className="w-6 h-6 animate-pulse text-indigo-400" />
          </div>
          <div>
            <h3 className="text-white text-base font-black flex items-center gap-1.5">
              <span>إدارة الأصول الثابتة والصيانة الوقائية للأعطال</span>
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">تسجيل المولدات الكبرى والناقلات، حصر نفقات المشتريات ومصاريف صيانة الماكينات.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-indigo-950 text-indigo-400 font-bold rounded-xl px-2.5 py-1 border border-indigo-500/10">
            بروتوكول OEE العام للأصول المزرعية
          </span>
        </div>
      </div>

      {msg && (
        <div className="bg-teal-500/10 border-2 border-teal-500 text-teal-300 p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-pulse">
          <CheckSquare className="w-5 h-5 text-teal-400 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* THREE BENTO CARDS STATISTICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Total Assets Value Card */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-505 bg-indigo-500/5 rounded-full blur-2xl mt-[-20px] mr-[-20px]" />
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400 text-xs font-black flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-indigo-400" />
              إجمالي القيمة التقديرية للأصول الكبرى
            </span>
            <span className="text-[9.5px] text-indigo-400 font-mono">دفتر الحسابات</span>
          </div>
          <div className="my-3 flex flex-col text-center justify-center">
            <span className="text-2xl font-black font-mono text-emerald-400">
              {totalAssetsValueYER.toLocaleString()} ر.ي
            </span>
            <span className="text-xs text-slate-400 mt-1">
              ما يقارب ${(totalAssetsValueYER / 530).toLocaleString(undefined, {maximumFractionDigits: 0})} دولار أمريكي
            </span>
          </div>
          <div className="text-[10px] text-slate-500 bg-slate-900 p-1.5 rounded-xl text-center border border-slate-800">
            يتضمن {assets.length} أصول فاعلة ومقيدة بسيريال المكنة
          </div>
        </div>

        {/* Maintenance Expenses posted to Ledger */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl mt-[-20px] ml-[-20px]" />
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400 text-xs font-black flex items-center gap-1 text-rose-400">
              <TrendingUp className="w-3.5 h-3.5" />
              مصاريف صيانة الأصول المقيدة للترحيل
            </span>
            <span className="text-[10px] bg-rose-950 text-rose-400 px-1.5 rounded">صرف غيار</span>
          </div>
          <div className="my-3 flex flex-col text-center justify-center">
            <span className="text-2xl font-black font-mono text-red-400">
              {totalActualMaintenanceCostYER.toLocaleString()} ر.ي
            </span>
            <span className="text-xs text-slate-400 mt-1">ترحل شهرياً كـ [مصاريف تشغيلية طارئة] للفرائب</span>
          </div>
          <p className="text-[9.5px] text-slate-500 block text-center">
            * تتضمن قطع غيار فلاتر ديزل، ديناموهات، ووصولات فنيين.
          </p>
        </div>

        {/* Preventive Alarms Counter */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-slate-400 text-xs font-black flex items-center gap-1 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              إنذارات صيانة دورية مستحقة
            </span>
            <span className="text-[9.5px] bg-amber-950 text-amber-400 px-1.5 rounded">الموعد الزمني</span>
          </div>
          
          <div className="my-2.5 text-center flex flex-col gap-1 items-center justify-center">
            <div className="text-3xl font-black font-mono text-amber-400">
              {schedules.filter(s => s.status === 'overdue' || s.status === 'pending').length}
            </div>
            {schedules.filter(s => s.status === 'overdue').length > 0 ? (
              <span className="text-[10px] bg-red-950 border border-red-500/30 text-red-400 px-2 rounded-xl py-0.5 font-bold animate-pulse">
                تنبيـه: توجد صيانة متأخرة! ⚠️
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-bold">كل المواعيد سارية وضمن النطاق الآمن</span>
            )}
          </div>

          <span className="text-[9.5px] text-slate-500 block text-center leading-relaxed">
            سرعة الصيانة توفر 24% من قيمة المكون التالف سنوياً.
          </span>
        </div>

      </div>

      {/* METICULOUS NAVIGATION SUBTABS FOR ASSETS MODULE */}
      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => { playBeep(850, 0.1); setActiveTab('status'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'status' 
              ? 'bg-indigo-650 bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>سجل وجرد الأصول الثابتة</span>
        </button>
        <button
          onClick={() => { playBeep(860, 0.1); setActiveTab('scheduled'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'scheduled' 
              ? 'bg-indigo-655 bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>برنامج الصيانة الدورية</span>
        </button>
        <button
          onClick={() => { playBeep(870, 0.1); setActiveTab('breakdowns'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'breakdowns' 
              ? 'bg-rose-600 text-white shadow-md font-black' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Hammer className="w-3.5 h-3.5" />
          <span>تسجيل عطل مفاجئ وتكاليف صيانة</span>
        </button>
        <button
          onClick={() => { playBeep(880, 0.1); setActiveTab('add_asset'); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'add_asset' 
              ? 'bg-teal-600 text-slate-950 shadow-md font-black' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>شراء / تسجيل أصل جديد 🚚</span>
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* TAB 1: STATUS / LIST ACTIVE ASSETS */}
        {activeTab === 'status' && (
          <div className="lg:col-span-12 flex flex-col gap-3">
            <span className="text-white text-xs font-bold block border-b border-slate-900 pb-2">قائمة جرد الأصول الثابتة وجدول القيمة التقديرية</span>
            
            {assets.length === 0 ? (
              <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center flex flex-col items-center gap-4 py-12" id="assets-empty-state">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                  <Wrench className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h5 className="text-white text-sm font-black">لا توجد أصول ثابتة مسجلة في هذا الفرع</h5>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">هذا الفرع جديد تماماً ولم يتم جرد أو ترحيل أصوله الثابتة لتهيئة الهيكل المالي.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  <button 
                    type="button"
                    onClick={() => setActiveTab('add_asset')} 
                    className="px-5 py-2.5 bg-teal-600 text-slate-950 font-extrabold hover:bg-teal-500 rounded-xl text-xs transition-all border-none cursor-pointer"
                  >
                    شراء / تسجيل أول أصل جديد
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assets.map((asset) => (
                  <div key={asset.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-indigo-500/20 transition-all flex flex-col gap-3">
                    <div className="flex items-start justify-between border-b border-indigo-950 pb-2">
                      <div>
                        <span className="text-white text-xs font-black block text-right">{asset.name}</span>
                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                          سيريال الصنع: {asset.serialNumber} | تاريخ الشراء: {asset.purchaseDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                          asset.status === 'operational' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30' :
                          asset.status === 'under_maintenance' ? 'bg-amber-955 bg-amber-950 text-amber-400 border border-amber-900/30' :
                          'bg-red-955 bg-red-950 text-red-400 border border-red-900/40 animate-pulse'
                        }`}>
                          {asset.status === 'operational' ? 'شغال كفؤ' :
                           asset.status === 'under_maintenance' ? 'تحت الاصلاح' : 'معطل مفاجئ ⚠️'}
                        </span>
                        <button
                          type="button" 
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded-md transition-colors"
                          title="حذف الأصل من القيود"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs text-right text-slate-300">
                      <div className="bg-slate-900 p-2 rounded">
                        <span className="text-[9px] text-slate-400 block">تكلفة الشراء USD:</span>
                        <span className="font-mono text-white font-bold">${asset.purchaseValueUSD.toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded">
                        <span className="text-[9px] text-slate-400 block">تكلفة الشراء YER:</span>
                        <span className="font-mono text-emerald-400 font-bold">{asset.purchaseValueYER.toLocaleString()} ر.ي</span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded">
                        <span className="text-[9px] text-slate-400 block">عداد العمل القياسي/الملاحظات:</span>
                        <span className="font-sans text-white text-[10.5px]">{asset.lastServiceHoursOrDate}</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 flex items-center justify-between mt-1">
                      <span className="font-serif">فئة الأصل: <strong className="text-indigo-300">{asset.category.toUpperCase()}</strong></span>
                      <span>* القيمة تهلك بنسبة 10% سنوياً لأغراض الضرائب والزكاة.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SCHEDULED MAINTENANCE TIMES */}
        {activeTab === 'scheduled' && (
          <div className="lg:col-span-12 flex flex-col gap-4">
            <span className="text-white text-xs font-bold block border-b border-slate-900 pb-2">جدول وجدول الصيانة الدورية المخططة (حماية الأمهات والقطيع من الانقطاع)</span>
            
            <div className="flex flex-col gap-3">
              {schedules.map((task) => (
                <div 
                  key={task.id} 
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
                    task.status === 'completed' 
                      ? 'bg-slate-900/50 border-slate-950/20 opacity-70' 
                      : task.status === 'overdue'
                        ? 'bg-rose-950/20 border-red-500/30 ring-2 ring-red-500/5'
                        : 'bg-indigo-95/10 bg-indigo-950/20 border-indigo-500/10'
                  }`}
                >
                  <div className="flex-1 text-right">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white text-xs font-extrabold block">{task.taskName}</span>
                      <span className="bg-slate-900 border border-slate-800 text-indigo-300 font-mono text-[9px] px-2 py-0.5 rounded">
                        {task.assetName}
                      </span>
                      {task.status === 'completed' ? (
                        <span className="text-[9.5px] bg-emerald-950 text-emerald-400 px-1.5 rounded font-bold border border-emerald-900/30">
                          منجزة بنجاح ✓
                        </span>
                      ) : task.status === 'overdue' ? (
                        <span className="text-[9.5px] bg-red-950 text-red-400 px-1.5 rounded font-bold border border-red-900/40 animate-pulse">
                          متأخرة! (تاريخ الصيانة: {task.dueDate}) ⚠️
                        </span>
                      ) : (
                        <span className="text-[9.5px] bg-amber-955 bg-amber-955/30 text-amber-400 px-1.5 rounded font-bold border border-amber-900/30">
                          مستحقة قادماً مأمونة ({task.dueDate})
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 text-xs text-slate-400 gap-1 my-1">
                      <span>⚙️ <strong className="text-slate-300">دورية الخدمة الموصى بها:</strong> {task.frequencyDaysOrHours}</span>
                      <span>📅 <strong className="text-slate-300">تاريخ الفحص المطلوب:</strong> {task.dueDate} م</span>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto flex-shrink-0 self-end sm:self-center">
                    {task.status !== 'completed' ? (
                      <button
                        type="button"
                        onClick={() => handleCompleteTask(task.id)}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2 rounded-lg cursor-pointer transition-all active:scale-95 text-center h-10 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>تأكيد المراجعة وفني الخدمة</span>
                      </button>
                    ) : (
                      <span className="text-slate-500 text-xs font-bold block text-center sm:w-32">جاهزة ومكتملة ✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: BREAKDOWN LOGS & COST POSTING FORM */}
        {activeTab === 'breakdowns' && (
          <>
            {/* Input Form Column */}
            <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Hammer className="w-5 h-5 text-rose-400" />
                <h4 className="text-white text-sm font-black">تقييد حادث عطل وتعميد قطع غيار الأصول</h4>
              </div>

              <form onSubmit={handleAddBreakdown} className="flex flex-col gap-3.5">
                
                {/* Asset Choice */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold">الأصل المعطّل أو المستهدف بالصيانة:</label>
                  <select
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-rose-500 h-11"
                  >
                    <option value="">-- اختر الأصل المستهدف بالصيانة --</option>
                    <option disabled value="" className="text-rose-400">
                      ⚠️ تنبيه محاسبي: يرجى تغذية وإضافة مسميات وأسعار الأصول بشكل منعزل لتفادي تداخلها مع الصناديق!
                    </option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>
                    ))}
                  </select>
                </div>

                {/* Issue Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold">تفاصيل العطل الفني المكتشف وقطع الغيار المشتراة:</label>
                  <textarea
                    rows={2}
                    value={breakdownDesc}
                    onChange={(e) => setBreakdownDesc(e.target.value)}
                    className="bg-slate-900 border-2 border-slate-800 text-xs text-white p-2.5 rounded-lg focus:outline-none focus:border-rose-500"
                    placeholder="مثال: ذوبان منظم حرارة المروحة لعنبر البياض وتغيير قاطع التماسيح الكهربائي للتبريد."
                  />
                </div>

                {/* Cost in YER */}
                <div className="grid grid-cols-2 gap-3 text-right">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400">تكلفة قطع الغيار المشتراة (ر.ي):</span>
                    <input 
                      type="number" 
                      value={partsCostYer}
                      onChange={(e) => setPartsCostYer(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-800 p-2 font-mono text-center text-xs font-bold text-white rounded-lg h-10"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400">تكلفة اليد الفنية / الفني (USD):</span>
                    <input 
                      type="number"
                      value={laborCostUsd}
                      onChange={(e) => setLaborCostUsd(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-800 p-2 font-mono text-center text-xs font-bold text-white rounded-lg h-10"
                    />
                  </div>
                </div>

                {/* Reporter name */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400">اسم مهندس/فني الصيانة المناوب:</span>
                  <input 
                    type="text"
                    value={breakdownReporter}
                    onChange={(e) => setBreakdownReporter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white font-bold h-10"
                  />
                </div>

                <div className="bg-rose-950/20 border border-rose-900/40 p-2.5 rounded-xl text-[9.5px] text-rose-300">
                  ⚠️ بمجرد النقر، سيتم خصم وحسم هذه المشتريات وتصنيفها محاسبياً كـ "مصاريف صيانة أصول ثابتة" في قيود الصندوق لتعاد احتساب الكفاءة بدقة.
                </div>

                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs py-3 rounded-xl shadow cursor-pointer transition-all active:scale-95 h-11"
                >
                  ترحيل مصاريف صيانة الأعطال للصندوق
                </button>

              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                <span className="text-white text-xs font-bold block border-b border-slate-900 pb-2">أعطال الأصول المنقضية والمرحلة دفترياً</span>
                
                <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto">
                  {breakdowns.map((b) => (
                    <div key={b.id} className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-1.5">
                        <div>
                          <span className="text-white text-xs font-black block text-right">{b.assetName}</span>
                          <span className="text-[10px] text-slate-500 block font-mono text-right mt-0.5">{b.loggedDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9.5px] bg-red-950 text-red-400 px-1.5 rounded-lg border border-red-900/40 font-bold font-mono">
                            قيد: مرحل للدفاتر
                          </span>
                          <button
                            type="button" 
                            onClick={() => handleDeleteBreakdown(b.id)}
                            className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-slate-300 text-xs leading-relaxed text-right font-sans">
                        👨‍🔧 <strong className="text-slate-400">وصف العيب:</strong> {b.issueDescription}
                      </p>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-850 text-slate-400">
                        <span>تكلفة القطع: <strong className="text-red-400 font-mono font-black">{b.sparePartsCostYER.toLocaleString()} ر.ي</strong></span>
                        <span>أجرة الفني: <strong className="text-white font-mono">${b.laborCostUSD}</strong></span>
                        <span className="text-[10px] text-slate-500">مرحل بواسطة: {b.reporter}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 4: ADD ASSET / REGISTER NEW TRUCK OR GENERATOR */}
        {activeTab === 'add_asset' && (
          <div className="lg:col-span-12">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 max-w-2xl mx-auto">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Plus className="w-5 h-5 text-teal-400" />
                <h4 className="text-white text-sm font-black">شراء أصل جديد أو تسجيل أدوات ومعدات صيانة ومبيعات الجوالات</h4>
              </div>

              <form onSubmit={handleAddNewAsset} className="flex flex-col gap-4 text-right">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold">اسم الأصل التجاري أو الموديل بالتفصيل:</label>
                  
                  {registeredAssetNames && registeredAssetNames.length > 0 && (
                    <div className="flex flex-col gap-1 mb-1.5 text-right">
                      <span className="text-[10px] text-amber-500 font-bold">📋 قاعدة البيانات المحفوظة لأسماء الأصول (اضغط للاختيار):</span>
                      <select 
                        onChange={(e) => {
                          if (e.target.value) {
                            setAssetName(e.target.value);
                          }
                        }}
                        className="bg-slate-900 border border-amber-500/20 text-amber-300 text-[11px] p-2.5 rounded-xl focus:outline-none focus:border-amber-400 cursor-pointer font-bold"
                      >
                        <option value="">-- اختر من أسماء الأصول المسجلة سحابياً لتسهيل الإدخال --</option>
                        <option disabled value="" className="text-amber-500 font-extrabold text-xs">
                          ⚠️ تنبيه محاسبي: يجب تغذية وتوصيف الأصول بأسعارها بشكل معزول ومستقل لتفادي دخول الخرج عشوائياً!
                        </option>
                        {registeredAssetNames.map((name, idx) => (
                          <option key={idx} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <input 
                    type="text" 
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="مثال: جهاز كبس باغات وشاشات TBK أوتوماتيكي"
                    className="bg-slate-900 border-2 border-slate-805 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold">تصنيف الأصل الثابت للزكاة والاهلاك:</label>
                    <select
                      value={assetCategory}
                      onChange={(e) => setAssetCategory(e.target.value as any)}
                      className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500 font-bold"
                    >
                      <option value="other">-- اختر تصنيف الأصل الثابت --</option>
                      <option disabled value="" className="text-teal-400">
                        ⚠️ تنبيه محاسبي: يرجى تغذية مسميات وأسعار الأصول بشكل مستقل ومنعزل لتجنب خلط الخرج مع الأصول!
                      </option>
                      <option value="generator">معدات وأدوات الصيانة الدقيقة (كاوية، مجهر، كابس باغات)</option>
                      <option value="cooling">أجهزة فك الشفرات والبرمجة والسوفت وير (كمبيوترات، بوكسات)</option>
                      <option value="tipper">أثاث وديكورات صالة العرض واستاندات الجوالات</option>
                      <option value="vehicle">أجهزة إلكترونية عامة (طابعات فواتير، سيرفرات، كاميرات مراقبة)</option>
                      <option value="other">أصول تشغيلية ومكاتب إدارية أخرى مخصصة</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold">سيريال الصنع أو رقم اللوحة البرونزي:</label>
                    <input 
                      type="text" 
                      value={assetSerial}
                      onChange={(e) => setAssetSerial(e.target.value)}
                      placeholder="SN-6677-YEM"
                      className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold">تاريخ الشراء والاعتماد الفعلي:</label>
                    <input 
                      type="date" 
                      value={assetPurchaseDate}
                      onChange={(e) => setAssetPurchaseDate(e.target.value)}
                      className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-xs text-slate-300 font-mono text-center"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold">قيمة الأصل الكلي بالعملة الصعبة (USD):</label>
                    <input 
                      type="number" 
                      value={assetValUsd}
                      onChange={(e) => setAssetValUsd(e.target.value)}
                      className="bg-slate-900 border-2 border-slate-800 p-2 text-center text-xs font-extrabold text-white rounded-lg font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold">القيمة المعادلة بالريال اليمني (تقريبياً):</label>
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-xs font-mono font-bold text-center text-emerald-400">
                      {(parseFloat(assetValUsd) * 530).toLocaleString()} ر.ي
                    </div>
                  </div>

                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-bold">حالة العداد الحالي أو الاستخدام الأولي للجودة:</label>
                  <input 
                    type="text" 
                    value={assetHours}
                    onChange={(e) => setAssetHours(e.target.value)}
                    placeholder="مثال: 0 ساعة عمل (جديد بكاردونه)"
                    className="bg-slate-900 border-2 border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-black text-xs py-3.5 rounded-xl cursor-pointer shadow-md transition-all active:scale-95 text-center mt-3 h-11"
                >
                  حفظ الأصل وتعميد كرت الأصول الثابتة
                </button>

              </form>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}
