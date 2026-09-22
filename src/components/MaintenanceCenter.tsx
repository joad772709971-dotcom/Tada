import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wrench, 
  Smartphone, 
  User, 
  Cpu, 
  DollarSign, 
  Archive, 
  CheckCircle, 
  Clock, 
  Settings, 
  Plus,
  Scale,
  Sparkles,
  Users,
  TrendingDown,
  Trash2,
  Share2,
  Check,
  AlertCircle,
  Bike,
  Printer,
  Loader2
} from 'lucide-react';
import { MaintenanceJob, InventoryItem, UserProfile } from '../types';
import { formatMoney, roundToTwoDecimals, getCurrencySymbol } from '../utils/currency';

interface MaintenanceCenterProps {
  maintenanceJobs: MaintenanceJob[];
  inventory: InventoryItem[];
  users: UserProfile[];
  onAddJob: (job: MaintenanceJob) => void;
  onUpdateJobStatus: (id: string, status: MaintenanceJob['status']) => void;
  onAddSparePartToJob?: (jobId: string, partsToAdd: any[], warehouseName: string) => void;
  onDeductInventoryPartForMaintenance?: (
    itemId: string,
    quantity: number,
    warehouseName: string,
    cost: number,
    description: string,
    borneBy: 'shop' | 'engineer' | 'customer',
    bearAmount: number
  ) => void;
  onEngineerWithdrawalPayout?: (
    engineerId: string,
    engineerName: string,
    amount: number,
    description: string
  ) => void;
  onClose?: () => void;
  isMotorcycles?: boolean;
}

// Custom interfaces for persistent features
interface MaintenanceLoss {
  id: string;
  itemName: string;
  partId?: string;
  quantity: number;
  cost: number;
  borneBy: 'shop' | 'engineer' | 'customer' | 'split';
  bearAmount: number;
  bearAmountShop?: number;
  bearAmountEngineer?: number;
  bearAmountCustomer?: number;
  engineerId?: string;
  details: string;
  createdAt: string;
}

interface EngineerWithdrawal {
  id: string;
  engineerId: string;
  amount: number;
  description: string;
  createdAt: string;
}

export default function MaintenanceCenter({
  maintenanceJobs,
  inventory,
  users,
  onAddJob,
  onUpdateJobStatus,
  onAddSparePartToJob,
  onDeductInventoryPartForMaintenance,
  onEngineerWithdrawalPayout,
  onClose,
  isMotorcycles
}: MaintenanceCenterProps) {
  // Sub-tab Navigation
  const [maintTab, setMaintTab] = useState<'active' | 'reconcile' | 'finance'>('active');

  // Multi-execution protection and micro-visual feedback state
  const [submittingStatusId, setSubmittingStatusId] = useState<string | null>(null);

  const handleSafeStatusUpdate = async (jobId: string, status: MaintenanceJob['status']) => {
    const key = `${jobId}_${status}`;
    setSubmittingStatusId(key);
    // Sleek 300ms micro-visual state switch to absorb finger bounces
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      await onUpdateJobStatus(jobId, status);
    } finally {
      setSubmittingStatusId(null);
    }
  };

  // Default configurations
  const [defaultWarehouse, setDefaultWarehouse] = useState(() => {
    return localStorage.getItem('default_maintenance_warehouse') || 'مستودع الفحص والصيانة';
  });
  const [defaultEngineer, setDefaultEngineer] = useState(() => {
    return localStorage.getItem('default_maintenance_engineer') || 'user-engineer';
  });

  // Load persistent repair losses (parts / direct scrap)
  const [losses, setLosses] = useState<MaintenanceLoss[]>(() => {
    try {
      const saved = localStorage.getItem('jam_maint_losses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load persistent engineer cash withdrawals / advance payments
  const [withdrawals, setWithdrawals] = useState<EngineerWithdrawal[]>(() => {
    try {
      const saved = localStorage.getItem('jam_maint_withdrawals');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Custom adjustable commission ratios per engineer (defaults to 50%)
  const [customRatios, setCustomRatios] = useState<{ [engineerId: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('jam_maint_ratios');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sync custom states back to browser localStorage automatically
  useEffect(() => {
    localStorage.setItem('jam_maint_losses', JSON.stringify(losses));
  }, [losses]);

  useEffect(() => {
    localStorage.setItem('jam_maint_withdrawals', JSON.stringify(withdrawals));
  }, [withdrawals]);

  useEffect(() => {
    localStorage.setItem('jam_maint_ratios', JSON.stringify(customRatios));
  }, [customRatios]);

  // --- DYNAMIC PRICING & TERMS WARNING SETTINGS ---
  const [isWarningSettingsOpen, setIsWarningSettingsOpen] = useState(false);
  const [maintBusinessType, setMaintBusinessType] = useState<'mobiles' | 'motorcycles'>(() => {
    return (localStorage.getItem('maint_business_type') as 'mobiles' | 'motorcycles') || 'mobiles';
  });

  useEffect(() => {
    if (isMotorcycles !== undefined) {
      setMaintBusinessType(isMotorcycles ? 'motorcycles' : 'mobiles');
    }
  }, [isMotorcycles]);
  const [maintInspectionFee, setMaintInspectionFee] = useState<string>(() => {
    return localStorage.getItem('maint_inspection_fee') || '1000';
  });
  const [maintBankAccounts, setMaintBankAccounts] = useState<string>(() => {
    return localStorage.getItem('maint_bank_accounts') || 'حساب الكريمي: 30291040 باسم المحل | خدمة أم فلوس لمالك الفرع';
  });
  const [maintDelayPenalty, setMaintDelayPenalty] = useState<string>(() => {
    return localStorage.getItem('maint_delay_penalty') || '1500';
  });
  const [maintMaxFreeDays, setMaintMaxFreeDays] = useState<string>(() => {
    return localStorage.getItem('maint_max_free_days') || '30';
  });
  const [maintCustomTerms, setMaintCustomTerms] = useState<string>(() => {
    return localStorage.getItem('maint_custom_terms') || 'المحل ملتزم بإصلاح الخلل المتفق عليه ولسنا مسؤولين عن أي خلل آخر يتم اكتشافه لاحقاً.';
  });

  // Direct Scrap Form states
  const [scrapItemId, setScrapItemId] = useState('');
  const [scrapQty, setScrapQty] = useState(1);
  const [scrapAction, setScrapAction] = useState<'consumable' | 'damaged'>('damaged');
  const [scrapBearShop, setScrapBearShop] = useState(0);
  const [scrapBearEngineer, setScrapBearEngineer] = useState(0);
  const [scrapBearCustomer, setScrapBearCustomer] = useState(0);
  const [scrapLossEngineerId, setScrapLossEngineerId] = useState('');
  const [scrapDetails, setScrapDetails] = useState('');

  // Advance Payment Form states
  const [payEngineerId, setPayEngineerId] = useState('');
  const [payAmount, setPayAmount] = useState(0);
  const [payDescription, setPayDescription] = useState('');

  // WhatsApp Link formatter helper
  const formatWhatsAppLink = (phone: string, text: string) => {
    let clean = phone.replace(/\D/g, ''); // Numbers only
    if (clean.startsWith('7') && clean.length === 9) {
      clean = '967' + clean;
    } else if (clean.startsWith('0') && clean.length === 10) {
      clean = '967' + clean.slice(1);
    }
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  };

  // Modal toggle for registering a physical device
  const [isNewJobOpen, setIsNewJobOpen] = useState(false);

  // Normal Form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [problem, setProblem] = useState('');
  const [selectedSparePartId, setSelectedSparePartId] = useState('');
  const [sparePartQty, setSparePartQty] = useState(1);
  const [laborPrice, setLaborPrice] = useState(15);
  const [engineerId, setEngineerId] = useState(defaultEngineer);

  // Missing spare part automated shortages states
  const [isSparePartMissing, setIsSparePartMissing] = useState(false);
  const [missingSparePartName, setMissingSparePartName] = useState('');
  const [missingSpareQty, setMissingSpareQty] = useState(1);

  // Filter only engineers
  const engineers = useMemo(() => {
    const list = users.filter(u => u.role === 'engineer');
    // If empty fallback is user profile with role engineer
    if (list.length === 0) {
      return [{ uid: 'user-engineer', name: 'المهندس علي الفني', role: 'engineer' } as UserProfile];
    }
    return list;
  }, [users]);

  // Calculate dynamic commissions ratio override or defaults (50%)
  const getCommissionForJob = (job: MaintenanceJob) => {
    const customRatio = customRatios[job.engineerId] ?? 50;
    // Commission is applied strictly on Labor cost (excluding physical spare parts value to preserve store equity)
    const sparePartsCost = roundToTwoDecimals(job.sparePartsUsed.reduce((sum, p) => sum + (p.price * p.quantity), 0));
    const laborOnlyValue = roundToTwoDecimals(job.cost - sparePartsCost);
    const finalVal = Math.max(0, laborOnlyValue);
    return roundToTwoDecimals(finalVal * (customRatio / 100));
  };

  const handleSubmitJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !deviceModel || !problem) {
      alert('⚠️ فضلاً، أكمل جميع الحقول الأساسية لإنشاء السند!');
      return;
    }

    let sparePartsUsedList: any[] = [];
    let spareCostSum = 0;

    if (selectedSparePartId) {
      const foundPart = inventory.find(i => i.id === selectedSparePartId);
      if (foundPart) {
        if (foundPart.stock < sparePartQty) {
          alert(`⚠️ صنف قطع الغيار المحدد يتوفر منه (${foundPart.stock}) حبة فقط بالمخزن!`);
          return;
        }
        sparePartsUsedList.push({
          id: foundPart.id,
          name: foundPart.name,
          price: foundPart.price,
          cost: foundPart.cost,
          quantity: Number(sparePartQty)
        });
        spareCostSum = foundPart.price * Number(sparePartQty);
      }
    }

    const totalCalculatedCost = Number(laborPrice) + spareCostSum;
    const computedCommission = Number(laborPrice) * ((customRatios[engineerId] ?? 50) / 100);

    const newJob: MaintenanceJob = {
      id: `maint-${Date.now().toString().slice(-4)}`,
      customerName,
      customerPhone,
      deviceModel,
      problem,
      sparePartsUsed: sparePartsUsedList,
      cost: totalCalculatedCost,
      status: 'pending',
      engineerId,
      engineerName: users.find(u => u.uid === engineerId)?.name || 'علي الفني',
      commission: computedCommission,
      createdAt: new Date().toISOString()
    };

    onAddJob(newJob);

    // Create manual shortage if checked
    if (isSparePartMissing && missingSparePartName.trim()) {
      const existingManuals = JSON.parse(localStorage.getItem('manual_shortages') || '[]');
      const newShortage = {
        id: 'short-maint-' + Date.now(),
        name: `${missingSparePartName.trim()} (لجوال ${deviceModel} / العميل ${customerName})`,
        category: 'قطع غيار',
        requiredQty: missingSpareQty,
        stock: 0,
        notes: `مضافة تلقائياً من سند صيانة جهاز ${deviceModel}`,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('manual_shortages', JSON.stringify([newShortage, ...existingManuals]));
    }

    setIsNewJobOpen(false);
    resetForm();
    alert('🎉 تم فتح بطاقة صيانة فنية جديدة للمهندس المختص واقتطاع الجزء المخزني!');
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setDeviceModel('');
    setProblem('');
    setSelectedSparePartId('');
    setSparePartQty(1);
    setLaborPrice(15);
    setIsSparePartMissing(false);
    setMissingSparePartName('');
    setMissingSpareQty(1);
  };

  const updateScrapCostAndAllocate = (id: string, qty: number) => {
    setScrapItemId(id);
    setScrapQty(qty);
    const part = inventory.find(i => i.id === id);
    if (part) {
      const costOfLoss = part.cost * qty;
      setScrapBearShop(costOfLoss);
      setScrapBearEngineer(0);
      setScrapBearCustomer(0);
    } else {
      setScrapBearShop(0);
      setScrapBearEngineer(0);
      setScrapBearCustomer(0);
    }
  };

  // Direct addition of custom scrap/consumable part with split cost allocation
  const handleAddScrapRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapItemId) {
      alert('⚠️ الرجاء اختيار مادة قطع الغيار التالفة من مستودع الورشة!');
      return;
    }

    const foundPart = inventory.find(i => i.id === scrapItemId);
    if (!foundPart) return;

    const availableInWh = foundPart.warehouses?.[defaultWarehouse] ?? 0;
    if (availableInWh < scrapQty) {
      alert(`⚠️ عذراً، الكمية المتوفرة بالمستودع المحدد (${defaultWarehouse}) هي ${availableInWh} حبة فقط! لا يمكن الهلاك الافتراضي.`);
      return;
    }

    const costOfLoss = foundPart.cost * scrapQty;
    const sumOfBears = roundToTwoDecimals(scrapBearShop + scrapBearEngineer + scrapBearCustomer);

    // Prompt user if the split amounts do not equal total cost
    if (sumOfBears !== roundToTwoDecimals(costOfLoss)) {
      const confirmDiff = window.confirm(`⚠️ تنبيه: مجموع المبالغ الموزعة (${formatMoney(sumOfBears)}) لا يساوي التكلفة الفعلية للقطعة التالفة (${formatMoney(costOfLoss)}).\n\nهل ترغب في الاستمرار وحفظ السند بهذا التوزيع المخصص؟`);
      if (!confirmDiff) return;
    }

    // 1. Trigger parent callback to deduct from real inventory and trigger book entry if Shop bears some of the amount
    if (onDeductInventoryPartForMaintenance) {
      onDeductInventoryPartForMaintenance(
        scrapItemId,
        scrapQty,
        defaultWarehouse,
        costOfLoss,
        `${scrapAction === 'damaged' ? 'تالف تجميعي' : 'خرج فحص'} - ${foundPart.name}`,
        'shop',
        scrapBearShop
      );
    }

    // 2. Automatically register an expense withdrawal deduction for the engineer if he bears some of the amount
    if (scrapBearEngineer > 0) {
      const targetEngId = scrapLossEngineerId || (engineers[0]?.uid || 'user-engineer');
      const engLossWth: EngineerWithdrawal = {
        id: `wth-loss-${Date.now().toString().slice(-4)}`,
        engineerId: targetEngId,
        amount: scrapBearEngineer,
        description: `تحمل قطعة تالفة: ${foundPart.name} (عدد ${scrapQty})`,
        createdAt: new Date().toISOString()
      };
      setWithdrawals(prev => [engLossWth, ...prev]);
    }

    // 3. Register loss log locally for tracking with splits
    const newLoss: MaintenanceLoss = {
      id: `loss-${Date.now().toString().slice(-5)}`,
      itemName: foundPart.name,
      partId: foundPart.id,
      quantity: scrapQty,
      cost: costOfLoss,
      borneBy: 'split',
      bearAmount: sumOfBears,
      bearAmountShop: scrapBearShop,
      bearAmountEngineer: scrapBearEngineer,
      bearAmountCustomer: scrapBearCustomer,
      engineerId: scrapBearEngineer > 0 ? (scrapLossEngineerId || 'user-engineer') : undefined,
      details: scrapDetails || `تسجيل ${scrapAction === 'damaged' ? 'قطعة تالفة' : 'خرج صيانة للقطع'} في ورشة الصيانة`,
      createdAt: new Date().toISOString()
    };

    setLosses(prev => [newLoss, ...prev]);
    alert('✅ تم قيد المادة بنجاح وخصمها من المستودع وتوزيع الخسائر مالياً على الأطراف المحددة بنجاح!');

    // Reset Form
    setScrapItemId('');
    setScrapQty(1);
    setScrapBearShop(0);
    setScrapBearEngineer(0);
    setScrapBearCustomer(0);
    setScrapLossEngineerId('');
    setScrapDetails('');
  };

  // Process advance payment / pay out engineering dues
  const handlePayEngineerDues = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payEngineerId || payAmount <= 0) {
      alert('⚠️ الرجاء اختيار المهندس وتحديد مبلغ الصرف الصحيح!');
      return;
    }

    const targetEng = engineers.find(eng => eng.uid === payEngineerId);
    if (!targetEng) return;

    // Call parent to deduct from general Cash balance box
    if (onEngineerWithdrawalPayout) {
      onEngineerWithdrawalPayout(
        payEngineerId,
        targetEng.name,
        payAmount,
        payDescription || 'سحب عاجل تحت الحساب'
      );
    }

    // Record locally
    const newWithdrawal: EngineerWithdrawal = {
      id: `wth-${Date.now().toString().slice(-5)}`,
      engineerId: payEngineerId,
      amount: payAmount,
      description: payDescription || 'صرف دفعة مالية تحت الحساب',
      createdAt: new Date().toISOString()
    };

    setWithdrawals(prev => [newWithdrawal, ...prev]);
    alert(`🎉 تم صرف مبلغ ${formatMoney(payAmount)} للمهندس (${targetEng.name}) وتسجيل الحركة بالدفتر.`);
    
    setPayAmount(0);
    setPayDescription('');
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* 🚀 Interactive Toolbar / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#f1c40f]" />
            منظومة ورشة الصيانة، عمولات الفنيين، وتتبع الحسابات والقطع والتوالف
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            توزيع المسؤوليات المالية، قيد الخوارج، تتبع المخزون المعلق للصيانة، واحتساب سحبيات الصناديق.
          </p>
        </div>
        
        <div className="flex gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-900/50 text-rose-300 font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer"
            >
              ✕ إغلاق النافذة
            </button>
          )}
          
          <button
            onClick={() => setIsWarningSettingsOpen(true)}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-white font-bold text-xs rounded border border-zinc-750 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-[#f1c40f]" />
            أسعار الفحص والتنبيهات المصرفية ⚙️
          </button>
          
          <button
            onClick={() => setIsNewJobOpen(true)}
            className="px-4 py-2 bg-[#f1c40f] hover:bg-[#d2ac0a] text-black font-extrabold text-xs rounded transition flex items-center gap-1.5 cursor-pointer animate-pulse"
          >
            <Plus className="w-4 h-4" />
            {maintBusinessType === 'motorcycles' ? 'استلام دراجة للصيانة 🏍️' : 'استلام جوال للصيانة 📱'}
          </button>
        </div>
      </div>

      {/* ⚙️ SUB-TABS NAVIGATION BAR */}
      <div className="flex border-b border-zinc-800 gap-1 overflow-x-auto">
        <button
          onClick={() => setMaintTab('active')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            maintTab === 'active' 
              ? 'border-[#f1c40f] text-[#f1c40f] bg-zinc-900/40' 
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          {maintBusinessType === 'motorcycles' ? (
            <Bike className="w-4 h-4 text-amber-500" />
          ) : (
            <Smartphone className="w-4 h-4" />
          )}
          {maintBusinessType === 'motorcycles' ? 'تذاكر صيانة الدراجات النشطة 🏍️' : 'تذاكر صيانة الأجهزة النشطة 📱'} ({maintenanceJobs.filter(j => j.status !== 'delivered' && j.status !== 'cancelled').length})
        </button>

        <button
          onClick={() => setMaintTab('reconcile')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            maintTab === 'reconcile' 
              ? 'border-[#f1c40f] text-[#f1c40f] bg-zinc-900/40' 
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Scale className="w-4 h-4" />
          مطابقة قطع الغيار، الخوارج والتوالف ({inventory.filter(i => (i.warehouses?.[defaultWarehouse] ?? 0) > 0).length} صنف مسجل)
        </button>

        <button
          onClick={() => setMaintTab('finance')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            maintTab === 'finance' 
              ? 'border-[#f1c40f] text-[#f1c40f] bg-zinc-900/40' 
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          حسابات، ونسب عمولات، وسحبيات المهندسين
        </button>
      </div>

      {/* ⚙️ SETTINGS RAIL */}
      <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-zinc-400">
          <Settings className="w-4 h-4 text-zinc-500" />
          <span>مخزن سحب وتدقيق ورشة الصيانة:</span>
          <select
            value={defaultWarehouse}
            onChange={(e) => {
              setDefaultWarehouse(e.target.value);
              localStorage.setItem('default_maintenance_warehouse', e.target.value);
            }}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-[11px] text-[#f1c40f]"
          >
            <option value="مستودع الفحص والصيانة">مستودع الفحص والصيانة</option>
            <option value="المستودع الرئيسي (التحرير)">المستودع الرئيسي (التحرير)</option>
            <option value="المستودع الاحتياطي">المستودع الاحتياطي</option>
          </select>
        </div>

        <div className="text-zinc-500 font-mono text-[10px]">
          JAM SYSTEM PRO - SECURED AUTOMATED REPAIR MODULE
        </div>
      </div>

      {/* ======================= TAB 1: ACTIVE REPAIRS ======================= */}
      {maintTab === 'active' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Active Repair Tickets (Left 2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-bold text-zinc-300 text-xs flex items-center gap-1.5">
              <span>●</span> الأجهزة المودعة بالورشة حالياً
            </h3>

            {maintenanceJobs.filter(j => j.status !== 'delivered' && j.status !== 'cancelled').length === 0 ? (
              <div className="p-12 text-center bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-500 text-xs text-sans">
                🟢 لا يوجد هواتف متأخرة بالصيانة! جميع المهام والبطاقات تم تسويتها وصرفها وتسليمها بالتمام والكمال.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {maintenanceJobs
                  .filter(j => j.status !== 'delivered' && j.status !== 'cancelled')
                  .map((job) => {
                    const commissionValue = getCommissionForJob(job);
                    return (
                      <div key={job.id} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-4 space-y-4 transition">
                        
                        {/* Header details */}
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 font-semibold">
                                #{job.id}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const shopName = localStorage.getItem('default_shop_name') || 'مركز الصيانة المعتمد';
                                  const printWindow = window.open('', '_blank', 'width=800,height=750');
                                  if (!printWindow) return;
                                  printWindow.document.write(`
                                    <!DOCTYPE html>
                                    <html dir="rtl" lang="ar">
                                      <head>
                                        <meta charset="UTF-8">
                                        <title>سند استلام صيانة #${job.id}</title>
                                        <style>
                                          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
                                          * { box-sizing: border-box; }
                                          body { font-family: 'Tajawal', sans-serif; padding: 10px; background: white; color: black; line-height: 1.2; margin: 0 auto; max-width: 480px; }
                                          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
                                          .title { font-size: 14px; font-weight: 900; margin: 0; }
                                          .ticket-id { font-size: 11px; font-weight: 900; background: #0f172a; color: #fff; padding: 2px 8px; display: inline-block; border-radius: 3px; margin: 3px 0; }
                                          .grid-table { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin: 4px 0; }
                                          .cell { background: #f8fafc; border: 0.5px solid #cbd5e1; padding: 2.5px 5px; border-radius: 3px; }
                                          .cell-label { font-size: 8px; color: #475569; font-weight: bold; display: block; }
                                          .cell-val { font-size: 10.5px; font-weight: 900; color: #000; display: block; }
                                          .full-cell { grid-column: span 2; }
                                          .warning-block { background: #fffcf0; border: 1px solid #d9a406; padding: 4px 6px; border-radius: 4px; font-size: 8px; color: #5c3c00; margin-top: 5px; line-height: 1.2; }
                                          .footer { margin-top: 8px; border-top: 1px dashed black; padding-top: 4px; font-size: 8.5px; }
                                          @media print { body { padding: 4px; max-width: 100%; } }
                                        </style>
                                      </head>
                                      <body onload="window.print();">
                                        <div class="header">
                                          <div class="title">${shopName}</div>
                                          <div class="ticket-id">سند استلام صيانة رسمي #${job.id}</div>
                                          <p style="margin: 2px 0 0 0; font-size: 8.5px; color: #475569;">التاريخ والوقت: ${new Date().toLocaleString('ar-YE')}</p>
                                        </div>
                                        <div class="grid-table">
                                          <div class="cell">
                                            <span class="cell-label">اسم العميل:</span>
                                            <span class="cell-val">${job.customerName}</span>
                                          </div>
                                          <div class="cell">
                                            <span class="cell-label">رقم الهاتف:</span>
                                            <span class="cell-val" dir="ltr">${job.customerPhone}</span>
                                          </div>
                                          <div class="cell">
                                            <span class="cell-label">الجهاز / الموديل:</span>
                                            <span class="cell-val">${job.deviceModel}</span>
                                          </div>
                                          <div class="cell">
                                            <span class="cell-label">التكلفة التقديرية:</span>
                                            <span class="cell-val">${formatMoney(job.cost)}</span>
                                          </div>
                                          <div class="cell full-cell">
                                            <span class="cell-label">الخلل / المشكلة:</span>
                                            <span class="cell-val">${job.problem}</span>
                                          </div>
                                          <div class="cell full-cell">
                                            <span class="cell-label">المهندس المشرف:</span>
                                            <span class="cell-val">${job.engineerName || 'الورشة'}</span>
                                          </div>
                                        </div>
                                        
                                        <div class="warning-block">
                                          <strong>⚠️ شروط وضوابط الاستلام:</strong>
                                          <div style="margin-top: 2px;">• في حال إلغاء الإصلاح بعد الفحص تدفع رسوم الفحص [ ${maintInspectionFee} ر.ي ].</div>
                                          <div>• في حال تجاوز [ ${maintMaxFreeDays} ] يوماً دون استلام تطبق غرامة حفظ [ ${maintDelayPenalty} ر.ي ].</div>
                                          <div>• المحل غير مسؤول عن فقدان البيانات المخزنة داخل الجهاز.</div>
                                        </div>
                                        
                                        <div class="footer">
                                          <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                                            <span>توقيع العميل: _______________</span>
                                            <span>توقيع المستلم: _______________</span>
                                          </div>
                                          <p style="margin: 4px 0 0 0; color: #555; text-align: center; font-size: 8px;">شكراً لثقتكم بنا | Powered by JAM System Pro</p>
                                        </div>
                                      </body>
                                    </html>
                                  `);
                                  printWindow.document.close();
                                }}
                                className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 font-bold text-[9px] rounded flex items-center gap-1 cursor-pointer transition select-none"
                              >
                                <Printer className="w-2.5 h-2.5 text-amber-500" />
                                طباعة السند 🖨️
                              </button>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                job.status === 'pending' ? 'bg-amber-500/15 text-amber-500' :
                                job.status === 'repairing' ? 'bg-[#f1c40f]/15 text-[#f1c40f]' :
                                'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {job.status === 'pending' ? 'بانتظار المباشرة' :
                                 job.status === 'repairing' ? 'تحت الفحص والاصلاح' :
                                 'تمت الصيانة - بانتظار العميل'}
                              </span>
                            </div>
                            <h4 className="font-bold text-white text-sm mt-2">{job.deviceModel}</h4>
                            <p className="text-[11px] text-zinc-400 mt-1">الخلل: {job.problem}</p>
                          </div>

                          <div className="text-left font-mono">
                            <span className="text-white text-sm font-bold block">{formatMoney(job.cost)}</span>
                            <span className="text-[9px] text-[#f1c40f] block mt-0.5">العمولة المقدرة: {formatMoney(commissionValue)}</span>
                          </div>
                        </div>

                        {/* Customer information */}
                        <div className="bg-[#0a0a0a] p-2 rounded text-[11px] space-y-1 text-zinc-400 border border-zinc-850">
                          <div className="flex justify-between">
                            <span>الزبون: <strong>{job.customerName}</strong></span>
                            <span>الهاتف: <strong className="font-mono">{job.customerPhone}</strong></span>
                          </div>
                        </div>

                        {/* Consumed Spare Parts */}
                        {job.sparePartsUsed.length > 0 && (
                          <div className="p-2 bg-[#0c0c0d] border border-zinc-850 rounded text-[11px] text-zinc-400 space-y-1">
                            <span className="font-semibold text-zinc-300 block mb-1">قطع غيار تم دمجها مع السند:</span>
                            {job.sparePartsUsed.map((part, idx) => (
                              <div key={idx} className="flex justify-between font-mono text-[10px]">
                                <span>• {part.name}</span>
                                <span>{part.quantity} حبة ({formatMoney(part.price)})</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Dynamic Spare Parts Injector */}
                        <div className="bg-black/40 p-2 rounded border border-zinc-850 space-y-2 text-xs">
                          <label className="text-[10px] text-zinc-400 font-bold block">⚙️ صرف قطع غيار إضافية فورا من المستودع:</label>
                          <div className="flex gap-1">
                            <select
                              id={`part-select-${job.id}`}
                              className="bg-zinc-950 border border-zinc-800 rounded px-1 py-1 text-[11px] text-white flex-1 focus:outline-none"
                            >
                              <option value="">-- حدد قطعة الغيار المقترحة --</option>
                              {inventory
                                .filter(i => i.category.toLowerCase().includes('غيار') || i.category.toLowerCase().includes('بطار') || i.category.toLowerCase().includes('شاش'))
                                .map(item => (
                                  <option key={item.id} value={item.id}>
                                    {item.name} ({formatMoney(item.price)})
                                  </option>
                                ))}
                            </select>
                            <input
                              type="number"
                              id={`part-qty-${job.id}`}
                              defaultValue="1"
                              min="1"
                              className="w-10 bg-zinc-950 border border-zinc-800 rounded text-center text-white py-0.5 text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const selectEl = document.getElementById(`part-select-${job.id}`) as HTMLSelectElement;
                                const qtyEl = document.getElementById(`part-qty-${job.id}`) as HTMLInputElement;
                                const pid = selectEl?.value;
                                const qty = parseInt(qtyEl?.value) || 1;

                                if (!pid) {
                                  alert('⚠️ الرجاء اختيار مادة الصيانة أولاً!');
                                  return;
                                }
                                const pItem = inventory.find(i => i.id === pid);
                                if (!pItem) return;

                                const avail = pItem.warehouses?.[defaultWarehouse] ?? 0;
                                if (avail < qty) {
                                  alert(`⚠️ رصيد صنف قطع الغيار غير كافي في مستودع (${defaultWarehouse})! المتبقي: ${avail} حبة.`);
                                  return;
                                }

                                if (onAddSparePartToJob) {
                                  onAddSparePartToJob(job.id, [{
                                    id: pItem.id,
                                    name: pItem.name,
                                    price: pItem.price,
                                    cost: pItem.cost,
                                    quantity: qty
                                  }], defaultWarehouse);
                                  alert(`🎉 تم تحديث بطاقة الصيانة وإدراج قطعة (${pItem.name}) وخصمها بنجاح.`);
                                  selectEl.value = "";
                                  qtyEl.value = "1";
                                }
                              }}
                              className="px-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[#f1c40f] rounded font-bold text-[11px] cursor-pointer"
                            >
                              إضافة قطع
                            </button>
                          </div>
                        </div>

                        {/* WhatsApp Updates Alerts */}
                        <div className="bg-black/35 p-3 rounded-lg border border-zinc-800 space-y-2.5 text-xs text-right">
                          <span className="text-[10px] text-zinc-400 font-bold block flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                            📞 إشعارات المتابعة الديناميكية الفورية وتقرير الفحص والتحذيرات:
                          </span>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                            {/* Alert 1 */}
                            <a
                              href={formatWhatsAppLink(
                                job.customerPhone,
                                `السلام عليكم ورحمة الله وبركاته، الأخ العزيز ${job.customerName} 🌹\nنحيطك علماً بأن ${maintBusinessType === 'motorcycles' ? 'مترك / دراجتك النارية' : 'جهازك الجوال'} ${job.deviceModel} (رقم البطاقة #${job.id}) قد تم معالجته واكتملت عملية الصيانة بنجاح في ${localStorage.getItem('default_shop_name') || 'مركز الصيانة المعتمد'}.\nالخلل المعالج: ${job.problem}\nتكلفة الخدمة الإجمالية: ${formatMoney(job.cost)}\n\nتفضل بزيارتنا في أي وقت لاستلامه قريباً.\nمع تحيات: ورشة الصيانة الفنية - تليفون: ${localStorage.getItem('default_shop_phone') || '772315106'}`
                              )}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              className="py-1.5 px-2 bg-emerald-950/40 hover:bg-emerald-950 border border-emerald-800/80 hover:border-emerald-700 text-emerald-400 text-[10px] rounded text-center font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                            >
                              <span>🟢</span> جاهز للاستلام
                            </a>

                            {/* Alert 2 */}
                            <a
                              href={formatWhatsAppLink(
                                job.customerPhone,
                                `مرحباً عزيزنا العميل ${job.customerName} 🌹\nنود إبلاغكم من ${localStorage.getItem('default_shop_name') || 'مركز الصيانة المحترف'} بأن ${maintBusinessType === 'motorcycles' ? 'مترك أو دراجتك النارية' : 'جهازك أو جوالك'} ${job.deviceModel} (سند #${job.id}) قد تم فحص الخلل كاملاً.\n\n*التقرير الأولي:* يوجد به خلل (${job.problem}) وبحاجة قطع غيار وإصلاح بتكلفة إجمالية تقديرية: ${formatMoney(job.cost)}.\n\n⚠️ *ضوابط وتنبيهات عقد الصيانة الهامة:*:\n- لا يتم بدء الإصلاح والعمل إلا بعد إبلاغنا وتأكيد الموافقة برسالة نصية منك.\n- في حال التراجع والكنسلة بعد الفحص، وجب عليكم دفع مبلغ [ ${maintInspectionFee} ر.ي ] مقابل خدمات الفحص الفني العاجل.\n- في حال موافقتكم على بدء الإصلاح، يرجى إرسال مبلغ دفعة مقدمة على حساب المحل برقم:\n[ ${maintBankAccounts} ]\n- في حال مرور فترة تتجاوز [ ${maintMaxFreeDays} ] يوماً دون استلام، يجب دفع غرامة [ ${maintDelayPenalty} ر.ي ] عن كل شهر تتأخر فيه السلعة مقابل خدمات وتأمين الحفظ.\n- لا يتم تسليم أي قطعة أو سلعة إلا بعد تسليم كافة الغرامات والمستحقات مالم فالمستودع غير مسؤول.\n- المحل ملتزم بإصلاح الخلل المتفق عليه وابلاغكم به وأما أي عطل إضافي لسنا مسؤولين عنه: [ ${maintCustomTerms} ]\n\nيرجى تأكيد موافقتكم عبر رسالة نصية أو واتساب للبدء في عمل إصلاحه فوراً ⚙️`
                              )}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              className="py-1.5 px-2 bg-amber-950/40 hover:bg-amber-950 border border-amber-800/80 hover:border-amber-700 text-amber-400 text-[10px] rounded text-center font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                            >
                              <span>📋</span> تقرير فحص وموافقة الدفع
                            </a>

                            {/* Alert 3 */}
                            <a
                              href={formatWhatsAppLink(
                                job.customerPhone,
                                `مرحباً عزيزنا العميل ${job.customerName} 🌹\nجهازك أو دراجتك النارية ${job.deviceModel} (سند #${job.id}) يخضع للعمل والفحص الفني تحت المتابعة دقيقة حالياً في ${localStorage.getItem('default_shop_name') || 'ورشة الصيانة المعتمدة'}.\nنعمل لخدمتك بدقة وسنقوم بإبلاغك فور اجتياز كافة الاختبارات والتشغيل السليم.`
                              )}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              className="py-1.5 px-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] rounded text-center flex items-center justify-center gap-1 transition"
                            >
                              <span>⏳</span> قيد العمل والفحص
                            </a>
                          </div>
                        </div>

                        {/* Status Change Controls */}
                        <div className="flex justify-between items-center pt-2.5 border-t border-zinc-850 text-[11px]">
                          <span className="text-zinc-500">المهندس: <strong className="text-zinc-300">{job.engineerName}</strong></span>
                          
                          <div className="flex gap-1.5">
                            {job.status === 'pending' && (
                              <button
                                disabled={submittingStatusId !== null}
                                onClick={() => handleSafeStatusUpdate(job.id, 'repairing')}
                                className="px-2.5 py-1 bg-zinc-850 hover:bg-zinc-800 text-[#f1c40f] rounded font-bold text-[10px] transition cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {submittingStatusId === `${job.id}_repairing` ? (
                                  <Loader2 className="animate-spin" size={10} />
                                ) : null}
                                <span>البدء بالعمل الفني 🛠️</span>
                              </button>
                            )}
                            {job.status === 'repairing' && (
                              <button
                                disabled={submittingStatusId !== null}
                                onClick={() => handleSafeStatusUpdate(job.id, 'completed')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] transition cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {submittingStatusId === `${job.id}_completed` ? (
                                  <Loader2 className="animate-spin" size={10} />
                                ) : null}
                                <span>إنهاء الصيانة واختباره 📱</span>
                              </button>
                            )}
                            {job.status === 'completed' && (
                              <button
                                disabled={submittingStatusId !== null}
                                onClick={async () => {
                                  const confirmed = window.confirm(`❓ هل تم تأكيد تحصيل وإكمال كامل المبلغ المستحق لهذه الصيانة بقيمة (${formatMoney(job.cost)}) من العميل؟\n\n(🚨 قانون المركز: لا يمكن تسليم الجهاز أو أرشفة السند إلا بعد سداد المبلغ كاملاً)`);
                                  if (confirmed) {
                                    await handleSafeStatusUpdate(job.id, 'delivered');
                                  } else {
                                    alert(`⚠️ تم رفض التحويل. يجب استلام وإكمال المبلغ المطلوب (${formatMoney(job.cost)}) لتتمكن من تسليم الساند وأرشفته.`);
                                  }
                                }}
                                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-bold text-[10px] transition cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {submittingStatusId === `${job.id}_delivered` ? (
                                  <Loader2 className="animate-spin" size={10} />
                                ) : null}
                                <span>مالي: تسليم وأرشفة السند 💰</span>
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Quick Metrics & Archive Column (Right 1 column) */}
          <div className="space-y-4 font-sans">
            <h3 className="font-bold text-zinc-300 text-xs">قبو السجلات والأرشفة الفنية</h3>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4 divide-y divide-zinc-850">
              
              {/* Delivered stats summary */}
              <div className="space-y-2 pb-3">
                <span className="text-xs font-bold text-white block">مقياس التوريد اليومي للورشة:</span>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-[#0a0a0a] p-2.5 rounded border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">إجمالي المقبوضات:</span>
                    <strong className="text-white text-xs font-bold font-mono">
                      {formatMoney(maintenanceJobs.filter(j => j.status === 'delivered').reduce((sum, j) => sum + j.cost, 0))}
                    </strong>
                  </div>
                  <div className="bg-[#0a0a0a] p-2.5 rounded border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">مستحقات علي الفني:</span>
                    <strong className="text-[#f1c40f] text-xs font-bold font-mono">
                      {formatMoney(maintenanceJobs.filter(j => j.status === 'delivered' && j.engineerId === 'user-engineer').reduce((sum, j) => sum + getCommissionForJob(j), 0))}
                    </strong>
                  </div>
                </div>
              </div>

              {/* List of Delivered Repair Archives */}
              <div className="pt-3">
                <span className="text-xs font-black text-zinc-400 block mb-3">📦 بطاقات تم ترحيلها وقبض ثمنها:</span>
                <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                  {maintenanceJobs.filter(j => j.status === 'delivered').length === 0 ? (
                    <span className="text-[10px] text-zinc-600 block text-center py-4">لا توجد بطاقات مؤرشفة اليوم.</span>
                  ) : (
                    maintenanceJobs
                      .filter(j => j.status === 'delivered')
                      .map((log) => (
                        <div key={log.id} className="p-2.5 bg-black/40 border border-zinc-850 rounded text-[11px] space-y-1">
                          <div className="flex justify-between text-zinc-500 font-mono text-[9px]">
                            <span>سند #{log.id}</span>
                            <span className="text-emerald-400 font-bold">تم تسليم العميل</span>
                          </div>
                          <h4 className="font-bold text-white leading-tight">{log.deviceModel}</h4>
                          <p className="text-zinc-400">العقدة: {log.problem}</p>
                          <div className="flex justify-between font-mono text-[10px] text-zinc-400 pt-1 border-t border-zinc-900">
                            <span>القيمة: {formatMoney(log.cost)}</span>
                            <span className="text-[#f1c40f]">عمول فني: {formatMoney(getCommissionForJob(log))}</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ======================= TAB 2: SPARE PARTS RECONCILIATION & SCRAP ======================= */}
      {maintTab === 'reconcile' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Direct Scrap Registration Form */}
            <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                <TrendingDown className="w-5 h-5 text-rose-400" />
                <h3 className="text-xs font-bold text-white">إضافة قطعة خرج صيانة أو تالف</h3>
              </div>

              <form onSubmit={handleAddScrapRecord} className="space-y-4 text-xs text-zinc-300">
                
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">قطعة الغيار المراد استهلاكها</label>
                  <select
                    value={scrapItemId}
                    onChange={(e) => {
                      const id = e.target.value;
                      updateScrapCostAndAllocate(id, scrapQty);
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- اختر من مستودع الورشة --</option>
                    {inventory
                      .map(item => {
                        const level = item.warehouses?.[defaultWarehouse] ?? 0;
                        return (
                          <option key={item.id} value={item.id}>
                            {item.name} | التكلفة: {formatMoney(item.cost)} (متوفر للورشة: {level} حبة)
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">الكمية المهلكة</label>
                    <input
                      type="number"
                      min="1"
                      value={scrapQty}
                      onChange={(e) => {
                        const n = parseInt(e.target.value) || 1;
                        updateScrapCostAndAllocate(scrapItemId, n);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-mono text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">نوع الحركة الفنية</label>
                    <select
                      value={scrapAction}
                      onChange={(e) => setScrapAction(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="damaged">💥 تالف صيانة (كسر أو عطل)</option>
                      <option value="consumable">🛠️ خرج صيانة استهلاكي للغرض</option>
                    </select>
                  </div>
                </div>

                {/* Overhead allocation Sharing selector */}
                <div className="p-3 bg-zinc-950 border border-zinc-850 rounded space-y-3">
                  <span className="block text-[10.5px] text-[#f1c40f] font-bold">توزيع الخسارة/التكلفة على الأطراف:</span>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-0.5">🏢 يتحمل المحل ({getCurrencySymbol()}):</label>
                      <input
                        type="number"
                        step="any"
                        value={scrapBearShop}
                        onChange={(e) => setScrapBearShop(Number(e.target.value) || 0)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-0.5">👥 يتحمل الزبون ({getCurrencySymbol()}):</label>
                      <input
                        type="number"
                        step="any"
                        value={scrapBearCustomer}
                        onChange={(e) => setScrapBearCustomer(Number(e.target.value) || 0)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white font-mono"
                      />
                    </div>

                    <div className="p-2 bg-rose-950/20 border border-rose-900/30 rounded space-y-2">
                      <div>
                        <label className="block text-[10px] text-rose-300 mb-0.5">👨‍🔧 يتحمل المهندس ({getCurrencySymbol()}):</label>
                        <input
                          type="number"
                          step="any"
                          value={scrapBearEngineer}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setScrapBearEngineer(val);
                            if (val > 0 && !scrapLossEngineerId && engineers.length > 0) {
                              setScrapLossEngineerId(engineers[0].uid);
                            }
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white font-mono"
                        />
                      </div>

                      {scrapBearEngineer > 0 && (
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">اختيار فني الصيانة للخصم من مستحقاته:</label>
                          <select
                            value={scrapLossEngineerId}
                            onChange={(e) => setScrapLossEngineerId(e.target.value)}
                            required={scrapBearEngineer > 0}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] text-white"
                          >
                            <option value="">-- اختر الفني المسؤول --</option>
                            {engineers.map(eng => {
                              return (
                                <option key={eng.uid} value={eng.uid}>
                                  {eng.name}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-900 flex justify-between items-center text-[10px] font-mono">
                    <span className="text-zinc-500">مجموع الموزع:</span>
                    <strong className="text-white">
                      {formatMoney(scrapBearShop + scrapBearEngineer + scrapBearCustomer)}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">تفاصيل وسبب الهلاك (لماذا تعذر الحساب؟)</label>
                  <textarea
                    rows={2}
                    placeholder="مثال: فقعت شاشة OLED في الكبس، أو فقدان باص آي سي البصمة أثناء تسخين البورد..."
                    value={scrapDetails}
                    onChange={(e) => setScrapDetails(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded text-xs transition cursor-pointer"
                >
                  قيد وتخريج قطعة تالفة / استهلاك 💥
                </button>
              </form>
            </div>

            {/* Inventory store audit & losses history (Left 2 columns) */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Warehouse Audit Button & Stats */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    المطابقة التلقائية لمستودع الورشة الحالي:
                  </h4>
                  <p className="text-[10px] text-zinc-500 mt-0.5">تقييم نسبة توافر البكسلات، الكابلات، والبطاريات لعدم تعطيل كروت الزبائن.</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const lowStockParts = inventory.filter(i => {
                      const qty = i.warehouses?.[defaultWarehouse] ?? 0;
                      return qty < 3 && i.category.toLowerCase().includes('غيار') || i.category.toLowerCase().includes('بطار');
                    });
                    
                    if (lowStockParts.length > 0) {
                      alert(`🔔 تم تدقيق الورشة! يوجد عدد (${lowStockParts.length}) أصناف حرجة تحتاج توريد عاجل لمنظومة الورشة (الكمية < 3).\n\nأهمها: ${lowStockParts.slice(0, 3).map(p => p.name).join(' و')}.`);
                    } else {
                      alert('🟢 تدقيق ناجح! كافة مواد الصيانة متوفرة بالحدود المطمئنة في مستودع الصيانة حالياً.');
                    }
                  }}
                  className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition rounded text-[11px] font-black cursor-pointer"
                >
                  🔍 فحص ومطابقة قطع الصيانة
                </button>
              </div>

              {/* Losses tracking list */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <span className="text-xs font-bold text-white block mb-4 flex items-center gap-1">
                  <span>📉</span> سجل خسائر وتوالف قطع ورشة الصيانة وتوزيع تحملها
                </span>

                {losses.length === 0 ? (
                  <div className="text-center p-8 text-zinc-500 text-xs font-sans">
                    لا يوجد توالف أو خسائر مسجلة لورشة الصيانة حالياً.
                  </div>
                ) : (
                  <div className="overflow-x-auto text-[11px]">
                    <table className="w-full text-zinc-300 text-right">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500">
                          <th className="py-2">تاريخ الحركة</th>
                          <th>الصنف</th>
                          <th className="text-center">الهالك</th>
                          <th className="text-center">كلفة الهلاك</th>
                          <th className="text-right px-2">توزيع تحمل التكلفة الفعلي</th>
                          <th className="text-center">المقدار الكلي</th>
                          <th className="text-center">إلغاء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850">
                        {losses.map((loss) => (
                          <tr key={loss.id} className="hover:bg-zinc-855 transition">
                            <td className="py-3 font-mono text-zinc-500 text-[10px]">
                              {new Date(loss.createdAt).toLocaleDateString()}
                            </td>
                            <td className="font-bold text-white">{loss.itemName}</td>
                            <td className="text-center font-mono font-bold text-zinc-400">-{loss.quantity}</td>
                            <td className="text-center font-mono font-medium">{formatMoney(loss.cost)}</td>
                            <td className="py-2 px-2">
                              {loss.bearAmountShop !== undefined ? (
                                <div className="space-y-0.5 text-[10px] text-right font-sans">
                                  {loss.bearAmountShop > 0 && <span className="block text-purple-400">🏢 المحل: {formatMoney(loss.bearAmountShop)}</span>}
                                  {loss.bearAmountCustomer > 0 && <span className="block text-sky-400">👥 الزبون: {formatMoney(loss.bearAmountCustomer)}</span>}
                                  {loss.bearAmountEngineer > 0 && <span className="block text-amber-400">👨‍🔧 الفني: {formatMoney(loss.bearAmountEngineer)}</span>}
                                  {loss.bearAmountShop === 0 && loss.bearAmountCustomer === 0 && loss.bearAmountEngineer === 0 && <span className="text-zinc-500">أرض الصيانة استثنائي</span>}
                                </div>
                              ) : (
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                  loss.borneBy === 'shop' ? 'bg-purple-500/20 text-purple-400' :
                                  loss.borneBy === 'engineer' ? 'bg-amber-500/20 text-amber-500' :
                                  'bg-sky-500/20 text-sky-400'
                                }`}>
                                  {loss.borneBy === 'shop' ? '🏢 المحل' : loss.borneBy === 'engineer' ? '👨‍🔧 المهندس' : '👥 الزبون'}
                                </span>
                              )}
                            </td>
                            <td className="text-center font-mono font-bold text-[#f1c40f]">
                              {formatMoney(loss.bearAmount)}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('هل ترغب في شطب قيد هذه الخسارة من السجلات الطارئة؟')) {
                                    setLosses(prev => prev.filter(l => l.id !== loss.id));
                                  }
                                }}
                                className="text-zinc-600 hover:text-red-500 transition"
                                title="إلغاء الحركة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* STORE PARTS QUANTITIES DETAILED SUMMARY */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <span className="text-xs font-black text-white block mb-3">📦 قائمة بمخزنة قطع غيار الورشة الحالية:</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {inventory
                    .filter(i => i.category.toLowerCase().includes('غيار') || i.category.toLowerCase().includes('بورد') || i.category.toLowerCase().includes('شاش') || i.category.toLowerCase().includes('كاب'))
                    .map(item => {
                      const level = item.warehouses?.[defaultWarehouse] ?? 0;
                      return (
                        <div key={item.id} className="p-3 bg-zinc-950 border border-zinc-850 rounded flex justify-between items-center">
                          <div>
                            <span className="text-xs font-bold text-white block">{item.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">الباركود: {item.id} | كلفة: {formatMoney(item.cost)}</span>
                          </div>
                          
                          <div className="text-left">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              level === 0 ? 'bg-red-500/10 text-red-500' :
                              level < 3 ? 'bg-amber-500/15 text-amber-500' :
                              'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {level} قطع بالورشة
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 3: ENGINEERS payOUTS & PERCENTAGES ======================= */}
      {maintTab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Advance payment / payout form */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-805">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-bold text-white">صرف دفعة مالية للمهندس تحت الحساب</h3>
              </div>

              <form onSubmit={handlePayEngineerDues} className="space-y-4 text-xs text-zinc-300">
                
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">المهندس المستلم</label>
                  <select
                    value={payEngineerId}
                    onChange={(e) => setPayEngineerId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- اختر المهندس المطلوب --</option>
                    {engineers.map(eng => {
                      // Calc total commissions
                      const totalC = maintenanceJobs
                        .filter(j => j.status === 'delivered' && j.engineerId === eng.uid)
                        .reduce((sum, j) => sum + getCommissionForJob(j), 0);
                      
                      // Calc total withdrawn
                      const totalW = withdrawals
                        .filter(w => w.engineerId === eng.uid)
                        .reduce((sum, w) => sum + w.amount, 0);

                      const net = totalC - totalW;

                      return (
                        <option key={eng.uid} value={eng.uid}>
                          {eng.name} | (المتبقي له فترات: {formatMoney(net)})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">قيمة الدفعة المصروفة لليد ($)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="20"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">شرح وتفاصيل التبويب بالدفتر</label>
                  <input
                    type="text"
                    placeholder="سحب دفعة تحت الحساب لصنايع صنعاء..."
                    value={payDescription}
                    onChange={(e) => setPayDescription(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#f1c40f] hover:bg-[#d2ac0a] text-black font-extrabold rounded text-xs transition cursor-pointer"
                >
                  صرف وقيد الدفعة الفنية فوراً ✅
                </button>
              </form>
            </div>

            {/* Engineers Ledger Sheets & Commissions (Left 2 columns) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* LEDGER DETAILS TABLE */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <span className="text-xs font-bold text-white block mb-4 flex items-center gap-1.5">
                  <span>👨‍🔧</span> قائمة المهندسين ومطابقة المستحقات ونسب العمولات
                </span>

                <div className="space-y-4">
                  {engineers.map((eng) => {
                    // Commissions
                    const completed = maintenanceJobs.filter(j => j.status === 'delivered' && j.engineerId === eng.uid);
                    
                    const totalCommissions = roundToTwoDecimals(completed.reduce((sum, j) => sum + getCommissionForJob(j), 0));
                    
                    // Withdrawals
                    const totalWithdrawals = roundToTwoDecimals(withdrawals
                      .filter(w => w.engineerId === eng.uid)
                      .reduce((sum, w) => sum + w.amount, 0));

                    // Net Remaining
                    const netDues = roundToTwoDecimals(totalCommissions - totalWithdrawals);

                    // Custom percentage input
                    const currentRatio = customRatios[eng.uid] ?? 50;

                    return (
                      <div key={eng.uid} className="bg-zinc-950 p-4 rounded-lg border border-zinc-850 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        
                        <div className="md:col-span-1 space-y-1">
                          <span className="font-bold text-white text-xs block">{eng.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono block">رقم هاتفي: {eng.phone || 'بلا هاتف'}</span>
                          
                          {/* Commission Adjuster Inline */}
                          <div className="pt-2 flex items-center gap-1">
                            <span className="text-[10px] text-zinc-400">النسبة المقتطعة:</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentRatio}
                              onChange={(e) => {
                                const n = parseInt(e.target.value) || 0;
                                setCustomRatios(prev => ({ ...prev, [eng.uid]: n }));
                              }}
                              className="w-12 bg-zinc-900 border border-zinc-800 rounded text-center text-white py-0.5 text-[10px] font-mono leading-none"
                            />
                            <span className="text-[10px] text-[#f1c40f]">%من يد</span>
                          </div>
                        </div>

                        {/* Financial figures */}
                        <div className="grid grid-cols-3 md:col-span-3 gap-3 text-center">
                          <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800">
                            <span className="text-[9px] text-zinc-500 block">إجمالي مستحق العمولات</span>
                            <span className="text-xs font-bold text-emerald-400 font-mono block mt-1">
                              {formatMoney(totalCommissions)}
                            </span>
                            <span className="text-[8px] text-zinc-600">({completed.length} بطاقات صيانة مخلص)</span>
                          </div>

                          <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800">
                            <span className="text-[9px] text-zinc-500 block">المسحوب / المستلم</span>
                            <span className="text-xs font-bold text-rose-400 font-mono block mt-1">
                              {formatMoney(totalWithdrawals)}
                            </span>
                          </div>

                          <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800">
                            <span className="text-[9px] text-zinc-500 block">المتبقي الصافي له</span>
                            <span className="text-xs font-extrabold text-white font-mono block mt-1">
                              {formatMoney(netDues)}
                            </span>
                            <span className={`text-[8px] block mt-0.5 font-bold ${netDues > 0 ? 'text-[#f1c40f]' : 'text-zinc-600'}`}>
                              {netDues > 0 ? '⚠️ مستحق صرفه' : 'متعادل'}
                            </span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* WITHDRAWALS HISTORY OF ENGINEERING DUETS */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <span className="text-xs font-black text-white block mb-3">📁 سجل الحركات والدفعات المالية المسلوبة للمهندسين:</span>
                {withdrawals.length === 0 ? (
                  <span className="text-[11px] text-zinc-500 font-sans block text-center py-4">
                    لا يوجد أي عمليات صرف رواتب أو سحبيات مرقومة لهذا اليوم بعد.
                  </span>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {withdrawals.map((wth) => {
                      const engName = engineers.find(e => e.uid === wth.engineerId)?.name || 'المهندس الفني';
                      return (
                        <div key={wth.id} className="p-2.5 bg-zinc-950 border border-zinc-850 rounded text-[11px] flex justify-between items-center font-sans">
                          <div>
                            <span className="font-bold text-white block">صرف للمهندس: {engName}</span>
                            <span className="text-[10px] text-zinc-500 block mt-0.5">السبب: {wth.description} | تاريخ: {new Date(wth.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="text-left font-mono">
                            <span className="text-rose-400 font-bold block">-{formatMoney(wth.amount)}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('هل ترغب بإلغاء هذه الدفعة وإرجاعها للدفاتر والصندوق لتصحيح الخطأ الفني؟')) {
                                  setWithdrawals(prev => prev.filter(w => w.id !== wth.id));
                                }
                              }}
                              className="text-[9px] text-zinc-600 hover:text-red-400 underline cursor-pointer"
                            >
                              إسقاط الحركة
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: REGISTER NEW DEVICE CARD ======================= */}
      {isNewJobOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-sm w-full font-sans shadow-2xl">
            <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-1.5 pb-2 border-b border-zinc-800">
              <Wrench className="text-[#f1c40f] w-5 h-5" />
              {maintBusinessType === 'motorcycles' ? 'استلام دراجة نارية/موتور جديد للصيانة 🏍️' : 'فتح بطاقة صيانة هاتف جديدة بالورشة 📱'}
            </h3>
            
            <form onSubmit={handleSubmitJob} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">اسم العميل</label>
                  <input
                    type="text"
                    required
                    placeholder="صادق اليماني..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">هاتف العميل</label>
                  <input
                    type="text"
                    required
                    placeholder="772315106..."
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">{maintBusinessType === 'motorcycles' ? 'الدراجة والموديل' : 'الهاتف والموديل بدقة'}</label>
                  <input
                    type="text"
                    required
                    placeholder={maintBusinessType === 'motorcycles' ? 'دراجة سوزوكي 150...' : 'iPhone 15 Pro...'}
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">أجرة اليد الفنية ($)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={laborPrice}
                    onChange={(e) => setLaborPrice(parseInt(e.target.value) || 15)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">المهندس المختص</label>
                  <select
                    value={engineerId}
                    onChange={(e) => setEngineerId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200"
                  >
                    {engineers.map(eng => (
                      <option key={eng.uid} value={eng.uid}>{eng.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">عمولته المقترحة (%)</label>
                  <div className="p-2 bg-zinc-950 border border-zinc-850 text-white rounded text-xs font-mono text-center">
                    {customRatios[engineerId] ?? 50}%
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">وصف العطل بالتفصيل</label>
                <input
                  type="text"
                  required
                  placeholder={maintBusinessType === 'motorcycles' ? 'تصفية البواجي، تصفية مكربن، شد جنزير...' : 'تبديل بطارية وتأكيد مقاومة البكسلات...'}
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">إشراك قطعة غيار ابتدائية (اختياري)</label>
                <select
                  value={selectedSparePartId}
                  disabled={isSparePartMissing}
                  onChange={(e) => setSelectedSparePartId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
                >
                  <option value="">-- بلا قطعة غيار عينية --</option>
                  {inventory
                    .filter(i => i.category.toLowerCase().includes('غيار') || i.category.toLowerCase().includes('قطع') || i.category.toLowerCase().includes('بطار') || i.category.toLowerCase().includes('متر') || i.category.toLowerCase().includes('جنزير') || i.category.toLowerCase().includes('فرامل'))
                    .map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} - (مستودع الورشة: {item.warehouses?.[defaultWarehouse] ?? 0}) | {formatMoney(item.price)}
                      </option>
                    ))}
                </select>
              </div>

              {/* Missing Spare Part Option Section */}
              <div className="p-3 rounded bg-rose-500/[0.03] border border-rose-950/40 space-y-2 mt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-rose-300 font-bold select-none">
                  <input
                    type="checkbox"
                    checked={isSparePartMissing}
                    onChange={(e) => {
                      setIsSparePartMissing(e.target.checked);
                      if (e.target.checked) setSelectedSparePartId('');
                    }}
                    className="rounded bg-zinc-950 border-zinc-800 text-rose-500 focus:ring-0 cursor-pointer"
                  />
                  ⚠️ قطعة غيار الصيانة غير متوفرة؟ (إضافتها للنواقص)
                </label>

                {isSparePartMissing && (
                  <div className="grid grid-cols-3 gap-2 pt-1 animate-fade-in">
                    <div className="col-span-2">
                      <label className="text-[10px] text-zinc-400 block mb-0.5">اسم القطعة المطلوبة</label>
                      <input
                        type="text"
                        required={isSparePartMissing}
                        placeholder="مثال: شاشة آيفون 13 عادي..."
                        value={missingSparePartName}
                        onChange={(e) => setMissingSparePartName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">الكمية المطلوبة</label>
                      <input
                        type="number"
                        min="1"
                        required={isSparePartMissing}
                        value={missingSpareQty}
                        onChange={(e) => setMissingSpareQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#f1c40f] text-black font-extrabold rounded text-xs hover:bg-[#d2ac0a] transition cursor-pointer"
                >
                  تعليق البطاقة للورشة ✅
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewJobOpen(false)}
                  className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded text-xs hover:text-white transition"
                >
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: EDIT MAINTENANCE PRICING & BANK WARNING SETTINGS ======================= */}
      {isWarningSettingsOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full font-sans shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-right">
            <h3 className="font-bold text-white text-xs pb-2.5 border-b border-zinc-800 flex items-center gap-2">
              <Settings className="text-[#f1c40f] w-4 h-4" />
              إعدادات أسعار الفحص والضوابط والحسابات البنكية للمحل ⚙️
            </h3>

            <form className="space-y-4">
              {/* Business Type Selector */}
              <div>
                <label className="text-[10px] text-zinc-300 font-bold block mb-1.5">نوع نشاط المحل ومسميات التشغيل 🏷️</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMaintBusinessType('mobiles')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      maintBusinessType === 'mobiles'
                        ? 'bg-[#f1c40f]/10 border-[#f1c40f] text-[#f1c40f]'
                        : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">📱</span>
                    <span>جوالات وإلكترونيات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaintBusinessType('motorcycles')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      maintBusinessType === 'motorcycles'
                        ? 'bg-[#f1c40f]/10 border-[#f1c40f] text-[#f1c40f]'
                        : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">🏍️</span>
                    <span>دراجات وبابات</span>
                  </button>
                </div>
              </div>

              {/* Inspection Fee and Max Allowed Delay Free Days */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">مبلغ الفحص التلقائي (ر.ي)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={maintInspectionFee}
                    onChange={(e) => setMaintInspectionFee(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-[#f1c40f] font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">مهلة الاستلام (يوم)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={maintMaxFreeDays}
                    onChange={(e) => setMaintMaxFreeDays(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white font-mono text-center"
                  />
                </div>
              </div>

              {/* Monthly Delay Penalty */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">غرامة تأخر الاستلام المسموح شهرياً (ر.ي)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={maintDelayPenalty}
                  onChange={(e) => setMaintDelayPenalty(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-red-400 font-mono text-center"
                />
              </div>

              {/* Bank Accounts */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">البيانات والحسابات البنكية لعربون البدء 🏦</label>
                <textarea
                  required
                  rows={2}
                  value={maintBankAccounts}
                  onChange={(e) => setMaintBankAccounts(e.target.value)}
                  placeholder="مثال: حساب الكريمي: 30291040 باسم المحل | خدمة أم فلوس..."
                  className="w-full bg-zinc-950 border border-zinc-850 rounded p-2 text-xs text-zinc-200"
                />
              </div>

              {/* Custom Terms Notes */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">التزام المحل والعهدة الإضافية العقدية ✍️</label>
                <textarea
                  required
                  rows={2}
                  value={maintCustomTerms}
                  onChange={(e) => setMaintCustomTerms(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded p-2 text-xs text-zinc-300"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-zinc-800 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('maint_business_type', maintBusinessType);
                    localStorage.setItem('maint_inspection_fee', maintInspectionFee);
                    localStorage.setItem('maint_bank_accounts', maintBankAccounts);
                    localStorage.setItem('maint_delay_penalty', maintDelayPenalty);
                    localStorage.setItem('maint_max_free_days', maintMaxFreeDays);
                    localStorage.setItem('maint_custom_terms', maintCustomTerms);
                    setIsWarningSettingsOpen(false);
                    alert('🎉 تم حفظ جميع الإعدادات البنكية، أسعار الفحص، والتنبيهات الديناميكية وشروط المستندات بنجاح!');
                  }}
                  className="flex-1 py-1.5 bg-[#f1c40f] hover:bg-[#d2ac0a] text-black font-extrabold rounded text-xs transition cursor-pointer"
                >
                  حفظ التعديلات والضوابط ✅
                </button>
                <button
                  type="button"
                  onClick={() => setIsWarningSettingsOpen(false)}
                  className="px-4 py-1.5 bg-zinc-800 text-zinc-400 rounded text-xs hover:text-white transition cursor-pointer"
                >
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
