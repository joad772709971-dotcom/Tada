import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  Search, 
  MapPin, 
  ShieldAlert, 
  Key, 
  Copy, 
  Check, 
  Trash2, 
  UserCheck, 
  Filter, 
  Lock, 
  Briefcase, 
  FileSpreadsheet, 
  Info, 
  Activity, 
  Soup, 
  Truck, 
  Wrench, 
  Factory,
  ShieldCheck,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Eye,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Scissors,
  Sliders
} from 'lucide-react';
import { 
  employeeDebtGuardService, 
  EmployeeDebtConfig, 
  EmployeeDebtEntry, 
  SalaryDeductionLog 
} from '../services/employeeDebtGuardService';

interface DynamicEmployee {
  username: string;
  password: string;
  fullName: string;
  role: string;
  governorate: string;
  branchLabel: string;
  departmentLabel: string;
  roleMode: 'admin' | 'worker' | 'distributor' | 'veterinary';
  initialTab: string;
  guaranteeImage?: string;             // Base64 image payload of the trade guarantee code
  isApprovedByOwner?: boolean;        // Active state of trade guarantee approval
  approvedBy?: string;                // Username who approved
  approvedAt?: string;                // Date approved
}

// Same as static employees list inside SecureLoginScreen to serve as initial seed if none exists
const INITIAL_STATIC_SEED: DynamicEmployee[] = [
  {
    username: 'super_admin',
    password: 'GM@admin_2026',
    fullName: 'المدير العام للنظام',
    role: 'GeneralManager',
    governorate: 'الكل',
    branchLabel: 'الإدارة العامة والمركز الرئيسي',
    departmentLabel: 'الإدارة العليا والملاك',
    roleMode: 'admin',
    initialTab: 'treasury'
  },
  {
    username: 'sanaa_acc',
    password: 'acc@sanaa123',
    fullName: 'أ. نجيب المريسي',
    role: 'FieldAccountant',
    governorate: 'صنعاء',
    branchLabel: 'حسابات فرع صنعاء العاصمة',
    departmentLabel: 'المالية ومعارض الحسابات',
    roleMode: 'admin',
    initialTab: 'treasury'
  },
  {
    username: 'sanaa_truck',
    password: 'truck@sanaa55',
    fullName: 'ماهر الريمي',
    role: 'Distributor',
    governorate: 'صنعاء',
    branchLabel: 'توزيع فرع صنعاء العاصمة',
    departmentLabel: 'مبيعات وتوريد الموزعين',
    roleMode: 'distributor',
    initialTab: 'pos_settlement'
  },
  {
    username: 'sanaa_vet',
    password: 'vet@sanaa22',
    fullName: 'د. عاصم ياسين',
    role: 'Veterinarian',
    governorate: 'صنعاء',
    branchLabel: 'بيطرة فرع صنعاء',
    departmentLabel: 'الطب البيطري والتحصينات',
    roleMode: 'veterinary',
    initialTab: 'veterinary'
  },
  {
    username: 'sanaa_worker',
    password: 'worker@sanaa20',
    fullName: 'عمار العنسي',
    role: 'Worker',
    governorate: 'صنعاء',
    branchLabel: 'إنتاج فرع صنعاء (العنابر)',
    departmentLabel: 'إنتاج العنابر والبيض النافق',
    roleMode: 'worker',
    initialTab: 'production'
  },
  {
    username: 'sanaa_cook',
    password: 'cook@sanaa10',
    fullName: 'الشيف عبده زبيدي',
    role: 'Cook',
    governorate: 'صنعاء',
    branchLabel: 'مطبخ وإعاشة فرع صنعاء',
    departmentLabel: 'المطبخ المركزي للعمال',
    roleMode: 'worker',
    initialTab: 'kitchen'
  },
  {
    username: 'dhamar_acc',
    password: 'acc@dhamar456',
    fullName: 'أ. محمد ذيبان',
    role: 'FieldAccountant',
    governorate: 'ذمار',
    branchLabel: 'حسابات فرع ذمار الإقليمي',
    departmentLabel: 'المالية وتصفية المعارض',
    roleMode: 'admin',
    initialTab: 'treasury'
  },
  {
    username: 'dhamar_truck',
    password: 'truck@dhamar88',
    fullName: 'عبدالكريم الحاشدي',
    role: 'Distributor',
    governorate: 'ذمار',
    branchLabel: 'توزيع فرع ذمار',
    departmentLabel: 'توزيع خطوط الإنتاج والمسالخ',
    roleMode: 'distributor',
    initialTab: 'pos_settlement'
  },
  {
    username: 'dhamar_vet',
    password: 'vet@dhamar01',
    fullName: 'د. سليم غيلان',
    role: 'Veterinarian',
    governorate: 'ذمار',
    branchLabel: 'بيطرة فرع ذمار المعقم',
    departmentLabel: 'الطب البيطري واللقاحات',
    roleMode: 'veterinary',
    initialTab: 'veterinary'
  },
  {
    username: 'dhamar_worker',
    password: 'worker@dhamar77',
    fullName: 'سالم الكبسي',
    role: 'Worker',
    governorate: 'ذمار',
    branchLabel: 'إنتاج فرع ذمار (العنابر)',
    departmentLabel: 'جرف فضلات العنابر وعلف السايلو',
    roleMode: 'worker',
    initialTab: 'production'
  },
  {
    username: 'dhamar_cook',
    password: 'cook@dhamar22',
    fullName: 'أمين الدبعي',
    role: 'Cook',
    governorate: 'ذمار',
    branchLabel: 'مطبخ فرع ذمار البارد',
    departmentLabel: 'المطبخ المركزي للعمال',
    roleMode: 'worker',
    initialTab: 'kitchen'
  },
  {
    username: 'aden_acc',
    password: 'acc@aden789',
    fullName: 'أ. سالم اليافعي',
    role: 'FieldAccountant',
    governorate: 'عدن',
    branchLabel: 'حسابات فرع عدن الساحلي',
    departmentLabel: 'مالية التصدير وفواتير السفن',
    roleMode: 'admin',
    initialTab: 'treasury'
  }
];

export function BranchEmployeesDashboard({ isDarkMode = true, activeUser }: { isDarkMode?: boolean; activeUser?: any }) {
  const [employees, setEmployees] = useState<DynamicEmployee[]>([]);
  const [fullName, setFullName] = useState('');
  const [englishLabel, setEnglishLabel] = useState(''); // helper to make unique english username
  
  const userGov = activeUser?.governorate;
  const isUserBranchManager = userGov && userGov !== 'الكل';

  const [governorate, setGovernorate] = useState<'صنعاء' | 'ذمار' | 'عدن' | 'الحديدة' | 'تعز'>(() => {
    if (isUserBranchManager) return userGov as any;
    return 'صنعاء';
  });

  const [department, setDepartment] = useState<'veterinary' | 'distributor' | 'factory' | 'kitchen' | 'worker' | 'accountant'>('worker');
  
  // New States for Trade Guarantees
  const [guaranteeImage, setGuaranteeImage] = useState<string>('');
  const [isGeneratingGuarantee, setIsGeneratingGuarantee] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [selectedPreviewEmployee, setSelectedPreviewEmployee] = useState<string | null>(null);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');

  // Employee Debt Guard & Ceiling Modal States
  const [selectedDebtEmployee, setSelectedDebtEmployee] = useState<DynamicEmployee | null>(null);
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [employeeDebtConfig, setEmployeeDebtConfig] = useState<EmployeeDebtConfig | null>(null);
  const [editingCeiling, setEditingCeiling] = useState<number>(50000);
  const [activeDebtsList, setActiveDebtsList] = useState<EmployeeDebtEntry[]>([]);
  const [salaryDeductionLogs, setSalaryDeductionLogs] = useState<SalaryDeductionLog[]>([]);

  // Copy success animation trigger
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [newlyCreated, setNewlyCreated] = useState<DynamicEmployee | null>(null);

  // Auto layout locking for branch manager
  useEffect(() => {
    if (isUserBranchManager) {
      setGovernorate(userGov as any);
    }
  }, [userGov, isUserBranchManager]);

  // Beep Audio sound player
  const playSound = (freq = 880, dur = 0.1) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gainSetting = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gainSetting.gain.setValueAtTime(0.05, ctx.currentTime);
      gainSetting.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + dur);
      osc.connect(gainSetting);
      gainSetting.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  // On Load, fetch from localStorage or initialize with seed
  useEffect(() => {
    try {
      const stored = localStorage.getItem('farmsync_dynamic_employees');
      if (stored) {
        setEmployees(JSON.parse(stored));
      } else {
        localStorage.setItem('farmsync_dynamic_employees', JSON.stringify(INITIAL_STATIC_SEED));
        setEmployees(INITIAL_STATIC_SEED);
      }
    } catch (e) {
      setEmployees(INITIAL_STATIC_SEED);
    }
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGuaranteeImage(reader.result as string);
        playSound(950, 0.1);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateOfficialGuarantee = () => {
    if (!fullName.trim()) {
      playSound(330, 0.25);
      alert('الرجاء إدخال الاسم الكامل للموظف الميداني لتوليد كفالته النموذجية.');
      return;
    }
    setIsGeneratingGuarantee(true);
    playSound(1000, 0.15);

    setTimeout(() => {
      const docDate = new Date().toLocaleDateString('ar-YE', { year: 'numeric', month: 'long', day: 'numeric' });
      const randomCertNo = Math.floor(10000 + Math.random() * 90000);
      
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400" style="background:#fcfbf7; font-family:system-ui, sans-serif; direction:rtl;">
          <rect x="15" y="15" width="570" height="370" fill="none" stroke="#22c55e" stroke-width="8" rx="10" />
          <rect x="25" y="25" width="550" height="350" fill="none" stroke="#d97706" stroke-width="2" rx="6" />
          
          <text x="300" y="70" text-anchor="middle" font-size="20" font-weight="bold" fill="#0f172a">الجمهورية اليمنية</text>
          <text x="300" y="95" text-anchor="middle" font-size="12" font-weight="bold" fill="#475569">وزارة الصناعة والتجارة - مكتب الصناعة بـ ${governorate}</text>
          <text x="300" y="125" text-anchor="middle" font-size="16" font-weight="extrabold" fill="#047857" letter-spacing="1">عقد ضمانة تجارية وكفالة حضورية معتمدة</text>
          
          <line x1="80" y1="140" x2="520" y2="140" stroke="#d97706" stroke-width="1.5" />
          
          <text x="500" y="175" font-size="11" font-weight="bold" fill="#334155" text-anchor="end">رقم المستند للضمانة: CG-${randomCertNo}</text>
          <text x="500" y="200" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="end">تشهد الجهة الكفيلة بالتضامن التام للعمل مع المكفول:</text>
          <text x="300" y="240" font-size="18" font-weight="black" fill="#1e293b" text-anchor="middle">العامل: ${fullName.trim()}</text>
          
          <text x="500" y="275" font-size="11" fill="#334155" text-anchor="end">جهة العمل: المؤسسة التجارية - فرع ${governorate}.</text>
          <text x="500" y="295" font-size="10" fill="#475569" text-anchor="end">يلتزم الكفيل بتعويض كافة العجوزات الممالية المكتشفة في الخزينة أو العهد تحت مسؤولية العامل الكاملة.</text>
          
          <text x="500" y="330" font-size="10" fill="#64748b" text-anchor="end">تاريخ التوثيق والاعتماد: ${docDate}</text>
          
          <circle cx="100" cy="305" r="40" fill="none" stroke="#059669" stroke-width="3" stroke-dasharray="4 2" />
          <circle cx="100" cy="305" r="34" fill="none" stroke="#059669" stroke-width="1" />
          <text x="100" y="300" font-size="8" font-weight="bold" fill="#059669" text-anchor="middle">غرفة تجارية</text>
          <text x="100" y="312" font-size="8" font-weight="bold" fill="#059669" text-anchor="middle">مقبول وموقع</text>
          
          <rect x="500" y="340" width="30" height="30" fill="#0f172a" rx="3" />
          <rect x="508" y="348" width="14" height="14" fill="#059669" />
        </svg>
      `;

      const base64Svg = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      setGuaranteeImage(base64Svg);
      setIsGeneratingGuarantee(false);
      playSound(1200, 0.2);
    }, 600);
  };

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      playSound(330, 0.25);
      alert('الرجاء إدخال الاسم الكامل للموظف أولاً.');
      return;
    }

    if (!guaranteeImage) {
      playSound(330, 0.25);
      alert('عذراً! يجب إرفاق صورة الضمانة التجارية للعامل لتتمكن من ترخيصه في النظام بموجب اللوائح الأمنية.');
      return;
    }

    playSound(1100, 0.2);

    // Generate unique ID / suffix
    const randomSuffix = Math.floor(10 + Math.random() * 89);
    
    // Convert governorate to English code prefix
    const govCodeMap: Record<string, string> = {
      'صنعاء': 'sanaa',
      'ذمار': 'dhamar',
      'عدن': 'aden',
      'الحديدة': 'hodeidah',
      'تعز': 'taiz'
    };
    const prefix = govCodeMap[governorate] || 'branch';

    // Generate unique username & default password
    let engPart = englishLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!engPart) {
      engPart = 'emp';
    }
    const username = `${prefix}_${engPart}_${randomSuffix}`;
    const password = `${engPart}@${prefix}${randomSuffix}`;

    // Define department mappings to permissions & tabs
    let role: string = 'Worker';
    let roleMode: 'admin' | 'worker' | 'distributor' | 'veterinary' = 'worker';
    let initialTab = 'production';
    let departmentLabel = 'إنتاج وتدوير العنابر';

    if (department === 'veterinary') {
      role = 'Veterinarian';
      roleMode = 'veterinary';
      initialTab = 'veterinary';
      departmentLabel = 'الهيئة البيطرية والرعاية الطبية';
    } else if (department === 'distributor') {
      role = 'Distributor';
      roleMode = 'distributor';
      initialTab = 'pos_settlement';
      departmentLabel = 'توزيع خطوط ومندوبي المبيعات';
    } else if (department === 'accountant') {
      role = 'FieldAccountant';
      roleMode = 'admin';
      initialTab = 'treasury';
      departmentLabel = 'محاسب مالي وبطاقات الموازين';
    } else if (department === 'kitchen') {
      role = 'Cook';
      roleMode = 'worker';
      initialTab = 'kitchen';
      departmentLabel = 'إعاشة عمال وعنابر المزرعة';
    } else if (department === 'factory') {
      role = 'FactoryManager';
      roleMode = 'worker';
      initialTab = 'factory';
      departmentLabel = 'إدارة المصانع والتصنيع';
    }

    // Checking if the creator is GeneralManager or Owner.
    // If they are Owner, the worker can be approved instantly! Otherwise, it is pending.
    const isOwnerApproved = activeUser?.role === 'GeneralManager' || activeUser?.governorate === 'الكل';

    const newWorker: DynamicEmployee = {
      username,
      password,
      fullName: fullName.trim(),
      role,
      governorate,
      branchLabel: `فرع المؤسسة بمحافظة ${governorate}`,
      departmentLabel,
      roleMode,
      initialTab,
      guaranteeImage,
      isApprovedByOwner: isOwnerApproved,
      approvedBy: isOwnerApproved ? (activeUser?.fullName || 'المدير العام') : undefined,
      approvedAt: isOwnerApproved ? new Date().toISOString() : undefined
    };

    const updated = [newWorker, ...employees];
    setEmployees(updated);
    localStorage.setItem('farmsync_dynamic_employees', JSON.stringify(updated));

    setNewlyCreated(newWorker);
    
    // Reset form fields
    setFullName('');
    setEnglishLabel('');
    setGuaranteeImage('');
  };

  const handleDeleteEmployee = (usernameToDelete: string) => {
    if (usernameToDelete === 'super_admin' || usernameToDelete === 'super_zelai') {
      playSound(330, 0.2);
      alert('غير مسموح بحذف الحساب الإداري العام للنظام.');
      return;
    }

    if (confirm('هل أنت متأكد من حذف حساب هذا الموظف وإبطال صلاحيات دخوله للنظام مجدداً؟')) {
      playSound(600, 0.15);
      const updated = employees.filter(e => e.username !== usernameToDelete);
      setEmployees(updated);
      localStorage.setItem('farmsync_dynamic_employees', JSON.stringify(updated));
      
      if (newlyCreated?.username === usernameToDelete) {
        setNewlyCreated(null);
      }
    }
  };

  const handleApproveEmployeeByOwner = (usernameToApprove: string) => {
    playSound(1200, 0.3);
    const updated = employees.map(emp => {
      if (emp.username === usernameToApprove) {
        return {
          ...emp,
          isApprovedByOwner: true,
          approvedBy: activeUser?.fullName || 'المالك والمشرف العام',
          approvedAt: new Date().toISOString()
        };
      }
      return emp;
    });
    setEmployees(updated);
    localStorage.setItem('farmsync_dynamic_employees', JSON.stringify(updated));
  };

  const handleOpenDebtModal = (emp: DynamicEmployee) => {
    setSelectedDebtEmployee(emp);
    const config = employeeDebtGuardService.getEmployeeDebtConfig(emp.username);
    setEmployeeDebtConfig(config);
    setEditingCeiling(config.maxCreditLimit);
    
    const activeDebts = employeeDebtGuardService.getEmployeeActiveDebts(emp.username);
    setActiveDebtsList(activeDebts);

    const deductions = employeeDebtGuardService.getSalaryDeductions(emp.username);
    setSalaryDeductionLogs(deductions);

    setDebtModalOpen(true);
    playSound(900, 0.1);
  };

  const handleSaveCeilingConfig = () => {
    if (!selectedDebtEmployee || !employeeDebtConfig) return;
    
    const updatedConfig: EmployeeDebtConfig = {
      ...employeeDebtConfig,
      fullName: selectedDebtEmployee.fullName,
      maxCreditLimit: Number(editingCeiling) || 0
    };

    employeeDebtGuardService.saveEmployeeDebtConfig(updatedConfig);
    setEmployeeDebtConfig(updatedConfig);
    playSound(1200, 0.2);
    alert(`تم تحديث سقف المديونية للموظف (${selectedDebtEmployee.fullName}) بنجاح إلى: ${Number(editingCeiling).toLocaleString()} ر.ي`);
  };

  const handleConvertToSalaryDeduction = (debtEntryId: string) => {
    if (!selectedDebtEmployee) return;

    if (confirm('هل أنت متأكد من تحويل هذه المديونية المتعثرة إلى خصم مباشر من كشف راتب الموظف وتسويتها؟')) {
      const res = employeeDebtGuardService.convertDebtToSalaryDeduction({
        debtEntryId,
        approvedBy: activeUser?.fullName || 'إدارة المحل والمالك'
      });

      if (res.success) {
        playSound(1400, 0.25);
        alert(res.message);

        // Refresh modal data
        const activeDebts = employeeDebtGuardService.getEmployeeActiveDebts(selectedDebtEmployee.username);
        setActiveDebtsList(activeDebts);

        const deductions = employeeDebtGuardService.getSalaryDeductions(selectedDebtEmployee.username);
        setSalaryDeductionLogs(deductions);

        const updatedConfig = employeeDebtGuardService.getEmployeeDebtConfig(selectedDebtEmployee.username);
        setEmployeeDebtConfig(updatedConfig);
      } else {
        alert(res.message);
      }
    }
  };

  const handleManualSettleDebt = (debt: EmployeeDebtEntry) => {
    if (!selectedDebtEmployee) return;

    const receiverName = prompt('اسم الشخص أو الموظف/الصندوق/المدير الذي استلم مبلغ سداد العميل:', activeUser?.fullName || 'صندوق المحل الرئيسي / المدير');
    if (!receiverName) return;

    const res = employeeDebtGuardService.settleCustomerDebtsByPayment({
      customerName: debt.customerName,
      customerPhone: debt.customerPhone,
      paidAmount: debt.amount,
      receivedByUsername: activeUser?.username || 'cashier',
      receivedByName: receiverName,
      receivedByRole: activeUser?.role || 'cashier/manager',
      receiptVoucherId: `REC-${Date.now().toString().slice(-5)}`
    });

    playSound(1400, 0.2);
    alert(res.details);

    // Refresh modal data
    const activeDebts = employeeDebtGuardService.getEmployeeActiveDebts(selectedDebtEmployee.username);
    setActiveDebtsList(activeDebts);

    const updatedConfig = employeeDebtGuardService.getEmployeeDebtConfig(selectedDebtEmployee.username);
    setEmployeeDebtConfig(updatedConfig);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    playSound(1400, 0.1);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 1500);
  };

  // Filter & Search Logic
  const filtered = employees.filter(emp => {
    const matchName = emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      emp.username.toLowerCase().includes(searchQuery.toLowerCase());
    
    // If branch manager, strictly force their assigned governorate
    const effectiveBranchFilter = isUserBranchManager ? userGov : selectedBranchFilter;
    const matchBranch = effectiveBranchFilter === 'all' || emp.governorate === effectiveBranchFilter;
    return matchName && matchBranch;
  });

  return (
    <div className="flex flex-col gap-6" id="user-and-branch-dashboard">
      
      {/* Dynamic Header */}
      <div className={`border rounded-3xl p-6 relative overflow-hidden text-right ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className={`absolute top-0 left-0 p-8 transform -translate-x-4 -translate-y-4 font-black text-7xl select-none pointer-events-none ${
          isDarkMode ? 'text-slate-800' : 'text-slate-100'
        }`}>
          FARMSYNC
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`p-1 px-2.5 rounded-full border text-[10px] font-bold ${
                isDarkMode ? 'bg-emerald-950 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>صلاحيات الملاك والإدارة الفيدرالية</span>
              <Users className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
            <h1 className={`text-xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>سجل تراخيص وتوليد حسابات الفروع والموظفين الميدانيين</h1>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>توليد تلقائي لهويات تسجيل الدخول الآمنة مع قيود الحجر الجغرافي على البيانات المالية والإدارية للنظام.</p>
          </div>
          
          <div className={`p-2 px-4 rounded-2xl border flex items-center gap-3 ${
            isDarkMode ? 'bg-slate-950 border-slate-850' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="text-left font-mono">
              <span className="text-amber-500 font-bold block text-sm">{employees.length}</span>
              <span className={`text-[9px] block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>مرخص نشط</span>
            </div>
            <div className={`h-8 w-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className="text-left font-mono">
              <span className="text-emerald-500 font-bold block text-sm">
                {employees.filter(e => e.governorate !== 'الكل').length}
              </span>
              <span className={`text-[9px] block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ميداني بالفروع</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Left, Instructions Right on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-right">
        
        {/* RIGHT (or top) SECTION: FORM TO CREATE ACCOUNT */}
        <div className={`p-5 rounded-3xl flex flex-col justify-between border ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <div className={`flex items-center gap-2 border-b pb-3 mb-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <UserPlus className="w-5 h-5 text-amber-500" />
              <h2 className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>إضافة موظف جديد وتوليد بيانات البصمة دفترياً</h2>
            </div>

            <form onSubmit={handleCreateEmployee} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-1 md:col-span-2">
                <label className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>الاسم الكامل للموظف (ثلاثي أو رباعي):</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: يحيى علي الخولاني"
                  className={`w-full p-2.5 rounded-xl text-xs text-right font-sans focus:outline-none focus:border-emerald-500 border ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-750' : 'bg-slate-50 border-slate-200 text-slate-850 placeholder-slate-400'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>المعرف المختصر بالإنجليزية (لتوليد كود الدخول):</label>
                <input 
                  type="text" 
                  value={englishLabel}
                  onChange={(e) => setEnglishLabel(e.target.value)}
                  placeholder="مثال: yahya (لا تستعين بالفراغات)"
                  className={`w-full p-2.5 rounded-xl text-xs text-left font-mono focus:outline-none focus:border-emerald-500 border ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-750' : 'bg-slate-50 border-slate-200 text-slate-850 placeholder-slate-400'
                  }`}
                />
              </div>

               {isUserBranchManager && (
                <div className={`p-3 rounded-xl border text-[10.5px] font-sans md:col-span-2 flex items-center gap-2 ${
                  isDarkMode ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-300' : 'bg-indigo-50 border-indigo-150 text-indigo-800'
                }`}>
                  <ShieldCheck className="w-4 h-4 text-indigo-500 animate-pulse flex-shrink-0" />
                  <span>
                    صلاحية <b>فرع مزارع {userGov}</b> نشطة ومقيدة مسبقاً. بموجب هذا، سيُسجل العامل الجديد للعمل داخل فرع {userGov} فقط.
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <label className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>الفرع أو المحافظة التابع لها الموظف:</label>
                <select 
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value as any)}
                  disabled={isUserBranchManager}
                  className={`w-full p-2.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-right cursor-pointer border ${
                    isDarkMode 
                      ? 'bg-slate-950 border-slate-800 text-white disabled:opacity-60 disabled:cursor-not-allowed' 
                      : 'bg-slate-50 border-slate-200 text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed'
                  }`}
                >
                  <option value="صنعاء">فرع صنعاء الرئيسي</option>
                  <option value="ذمار">فرع ذمار الإقليمي</option>
                  <option value="عدن">فرع عدن الساحلي (التصدير)</option>
                  <option value="الحديدة">فرع الحديدة والتهامية</option>
                  <option value="تعز">فرع تعز الجبلي</option>
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>القسم المعين / نوع تصريح الدخول الممنوح:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'worker', label: 'عامل عنابر وإنتاج', desc: 'شاشة عريضة', icon: Users, color: 'text-emerald-500' },
                    { id: 'veterinary', label: 'رعاية صحية وبيطرة', desc: 'اللقاحات والأدوية', icon: Activity, color: 'text-teal-500' },
                    { id: 'distributor', label: 'موزع وسائق نقل', desc: 'تصفية وحساب المعارض', icon: Truck, color: 'text-indigo-500' },
                    { id: 'kitchen', label: 'طباخ وإعاشة عمال', desc: 'إدارة مخزن المطبخ', icon: Soup, color: 'text-amber-500' },
                    { id: 'factory', label: 'أعلاف وخلاطات فنية', desc: 'شاشة المخلاط', icon: Factory, color: 'text-pink-500' },
                    { id: 'accountant', label: 'محاسب مالي معتمد', desc: 'خزينة وعهد متعددة', icon: Lock, color: 'text-slate-600' },
                  ].map(dep => {
                    const active = department === dep.id;
                    const Icon = dep.icon;
                    return (
                      <button
                        key={dep.id}
                        type="button"
                        onClick={() => { playSound(920, 0.05); setDepartment(dep.id as any); }}
                        className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between h-20 cursor-pointer ${
                          active 
                            ? (isDarkMode ? 'bg-slate-950 border-emerald-500 ring-1 ring-emerald-500/20 text-white' : 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500/10 text-emerald-950 font-bold') 
                            : (isDarkMode ? 'bg-slate-950/40 border-slate-800/85:border-slate-800 hover:border-slate-705 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100')
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <Icon className={`w-4 h-4 ${dep.color}`} />
                          <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-transparent'}`} />
                        </div>
                        <div className="mt-1 text-right">
                          <div className={`text-[10px] font-extrabold leading-tight ${active ? (isDarkMode ? 'text-white' : 'text-emerald-950') : (isDarkMode ? 'text-slate-300' : 'text-slate-805:text-slate-800')}`}>{dep.label}</div>
                          <div className={`text-[8.5px] leading-none mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{dep.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Commercial Guarantee Section */}
              <div className="md:col-span-2 space-y-2 border-t pt-4 mt-2 border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>مستند او صورة الضمانة التجارية كفالة (إجباري):</span>
                  {guaranteeImage && (
                    <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 bg-emerald-500/10 p-1 px-2 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      مرفقة في السجل
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* File Upload Trigger */}
                  <label className={`flex flex-col items-center justify-center p-4 border border-dashed rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-950/40 ${
                    guaranteeImage 
                      ? 'border-emerald-500/50 bg-emerald-500/5' 
                      : 'border-slate-300 dark:border-slate-800'
                  }`}>
                    <div className="flex flex-col items-center text-center">
                      <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-[11px] font-bold text-slate-300">إرفاق صورة الضمانة</span>
                      <span className="text-[8.5px] text-slate-500">من الهاتف أو الكمبيوتر</span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />
                  </label>

                  {/* Standardized SVG Generator */}
                  <button
                    type="button"
                    onClick={generateOfficialGuarantee}
                    disabled={isGeneratingGuarantee}
                    className={`flex flex-col items-center justify-center p-4 border border-dashed rounded-2xl transition-all cursor-pointer ${
                      isGeneratingGuarantee 
                        ? 'opacity-70 animate-pulse bg-slate-950' 
                        : (guaranteeImage ? 'border-emerald-500/30' : 'border-indigo-500/40 dark:border-indigo-900/40 hover:bg-slate-50 dark:hover:bg-slate-950/40')
                    }`}
                  >
                    <ImageIcon className="w-6 h-6 text-indigo-500 mb-1" />
                    <span className="text-[11px] font-bold text-indigo-400">توليد كفالة تجارية معتمدة</span>
                    <span className="text-[8.5px] text-slate-500">الغرفة التجارية بـ {governorate}</span>
                  </button>
                </div>

                {/* Instant preview thumbnail */}
                {guaranteeImage && (
                  <div className={`p-2 rounded-xl flex items-center justify-between border ${
                    isDarkMode ? 'bg-slate-950 border-emerald-950/50' : 'bg-slate-50 border-emerald-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <img 
                        src={guaranteeImage} 
                        alt="Warranty Preview" 
                        className="w-12 h-12 object-cover rounded-xl border border-slate-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="text-right">
                        <span className="text-[10px] font-bold block text-slate-300">وثيقة الضمانة الرقمية</span>
                        <span className="text-[8px] text-slate-500 block font-mono">Guarantor Stamp Generated (BASE64)</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setGuaranteeImage(''); playSound(500, 0.1); }}
                      className="text-rose-500 hover:text-rose-600 p-2 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[98%] cursor-pointer text-xs"
                >
                  <UserPlus className="w-4 h-4 text-slate-950" />
                  <span>إنشاء وترخيص حساب الموظف الفوري</span>
                </button>
              </div>

            </form>
          </div>

          <div className={`p-3 rounded-2xl text-[10px] flex items-start gap-2 mt-4 border ${
            isDarkMode ? 'bg-slate-950 border-slate-850 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
          }`}>
            <Info className="w-4 h-4 text-emerald-505:text-emerald-500 flex-shrink-0" />
            <span>نظام التوليد يقوم آلياً بتعيين كود مستخدم يبدأ برمز الفرع من أجل إحكام قيود الاستعلام الجغرافي المعمول بها للنظام.</span>
          </div>

        </div>

        {/* LEFT SECTION: NEWLY CREATED CARD & SECURITY INSTRUCTIONS */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* SECURE DETAILS RESULT WELL */}
          {newlyCreated ? (
            <div className={`p-5 rounded-3xl text-right animate-pulse-subtle border ${
              isDarkMode ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-emerald-50 border-emerald-250 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-3.5">
                <span className={`text-[10px] font-bold p-1 px-2.5 rounded-lg border ${
                  isDarkMode ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-emerald-100 border-emerald-200 text-emerald-800'
                }`}>رخصة جاهزة للاستخدام</span>
                <span className={`text-xs font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>✔ تم التوليد بنجاح!</span>
              </div>

              <div className="space-y-2.5">
                <div className={`p-3 rounded-xl border ${
                  isDarkMode ? 'bg-slate-950/80 border-emerald-600/20' : 'bg-white border-emerald-100'
                }`}>
                  <span className={`text-[9px] block mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>الاسم الدفتري المسجل:</span>
                  <span className={`text-xs font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{newlyCreated.fullName}</span>
                </div>

                <div className={`p-3 rounded-xl border grid grid-cols-2 gap-2 ${
                  isDarkMode ? 'bg-slate-950/80 border-emerald-600/20' : 'bg-white border-emerald-100'
                }`}>
                  <div>
                    <span className={`text-[9px] block mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>قسم الترخيص:</span>
                    <span className="text-[10px] text-amber-550:text-amber-605 font-extrabold">{newlyCreated.departmentLabel}</span>
                  </div>
                  <div>
                    <span className={`text-[9px] block mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>الفرع المقيد به:</span>
                    <span className={`text-[10px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{newlyCreated.governorate}</span>
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl space-y-2 border ${
                  isDarkMode ? 'bg-slate-950 border-emerald-500/20' : 'bg-slate-50 border-emerald-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-bold ${isDarkMode ? 'text-emerald-450:text-emerald-400' : 'text-emerald-700'}`}>اسم المستخدم (كود الميدان):</span>
                    <button 
                      onClick={() => copyToClipboard(newlyCreated.username, 999)}
                      className={`flex items-center gap-1 text-[9px] p-0.5 px-1.5 rounded cursor-pointer ${
                        isDarkMode ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
                      }`}
                    >
                      {copiedIndex === 999 ? <Check className="w-3" /> : <Copy className="w-3" />}
                      <span>نسخ</span>
                    </button>
                  </div>
                  <div className={`text-sm font-mono font-bold tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{newlyCreated.username}</div>

                  <hr className={isDarkMode ? 'border-slate-800' : 'border-slate-200'} />

                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-amber-500 font-bold">كلمة المرور الافتراضية:</span>
                    <button 
                      onClick={() => copyToClipboard(newlyCreated.password, 888)}
                      className={`flex items-center gap-1 text-[9px] p-0.5 px-1.5 rounded cursor-pointer ${
                        isDarkMode ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
                      }`}
                    >
                      {copiedIndex === 888 ? <Check className="w-3" /> : <Copy className="w-3" />}
                      <span>نسخ</span>
                    </button>
                  </div>
                  <div className={`text-sm font-mono font-bold tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{newlyCreated.password}</div>
                </div>

                <div className={`text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  ⚠️ سلم الموظف الكارت التعريفي أعلاه؛ يمكنه الدخول فوراً عبر جهاز الجوال الشخصي له وسيتعرف خادم FarmSync على فرعه تلقائياً للحد من تلاعب مبيعات المخازن.
                </div>
              </div>
            </div>
          ) : (
            <div className={`p-5 rounded-3xl text-right flex flex-col justify-center items-center py-10 border ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <Key className={`w-12 h-12 mb-3 ${isDarkMode ? 'text-slate-700 animate-pulse' : 'text-slate-350'}`} />
              <h3 className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>انتظار تفعيل المعاملات</h3>
              <p className={`text-[10.5px] text-center max-w-xs mt-1 ${isDarkMode ? 'text-slate-550:text-slate-500' : 'text-slate-400'}`}>قم بتعبئة بيانات العامل الجديد والفرع من النموذج الجانبي لتوليد شيفرات الترخيص الفوري آلياً ورصدها في SQLite.</p>
            </div>
          )}

          {/* GLOBAL SEGREGATION POLICY NOTATION */}
          <div className={`border p-4 rounded-3xl text-right ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2 mb-2 text-rose-500">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <h4 className="text-xs font-bold text-rose-700">قوانين حجب البيانات وعزل المحافظات</h4>
            </div>
            <div className={`text-[10.5px] space-y-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <p>📍 يمنع النظام العمال المعينين في فرع (مثلاً: صنعاء) بشكل قاطع من استعراض كشوفات عجز الصناديق أو وفيات عنابر فرع (مثلاً: ذمار) أو فرع (عدن).</p>
              <p>📍 صلاحية المدير العام <span className="text-amber-500 font-bold">GeneralManager</span> والمالك هي الوحيدة المخولة بتجميع الأرصدة وإصدار حوالات الصرف الدولية والتسويات الكلية للشبكة.</p>
            </div>
          </div>

        </div>

      </div>

      {/* LOWER SECTION: EMPLOYEES DATA TABLE WITH SEARCH & FILTERS */}
      <div className={`border rounded-3xl p-5 text-right ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        
        {/* Table Controls */}
        <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4 mb-4 ${
          isDarkMode ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <Users className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <h3 className={`text-xs font-extrabold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>جدول السجلات الحالية للموظفين وأقسام الفروع</h3>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            
            {/* Search input */}
            <div className="relative">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الموظف أو الكود..."
                className={`p-2 pr-8 rounded-xl text-xs w-full sm:w-56 text-right focus:outline-none focus:border-emerald-500 border ${
                  isDarkMode ? 'bg-slate-950 border-slate-850 text-white placeholder-slate-700' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                }`}
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
            </div>

            {/* Branch Filter dropdown */}
            <div className={`flex items-center gap-1 border p-1.5 rounded-xl ${
              isDarkMode ? 'bg-slate-950 border-slate-850' : 'bg-slate-50 border-slate-205:border-slate-200'
            }`}>
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
              <select
                disabled={isUserBranchManager}
                value={isUserBranchManager ? userGov : selectedBranchFilter}
                onChange={(e) => { playSound(800, 0.05); setSelectedBranchFilter(e.target.value); }}
                className={`bg-transparent text-xs focus:outline-none cursor-pointer text-right pl-3 ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                } ${isUserBranchManager ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUserBranchManager ? (
                  <option value={userGov}>فرع {userGov}</option>
                ) : (
                  <>
                    <option value="all">كل الفروع</option>
                    <option value="صنعاء">فرع صنعاء</option>
                    <option value="ذمار">فرع ذمار</option>
                    <option value="عدن">فرع عدن</option>
                    <option value="الحديدة">فرع الحديدة</option>
                    <option value="تعز">فرع تعز</option>
                  </>
                )}
              </select>
            </div>

          </div>
        </div>

        {/* Scrollable table container */}
        <div className={`overflow-x-auto rounded-xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <table className={`w-full text-xs text-right font-sans ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            <thead className={`text-[10.5px] font-extrabold uppercase border-b ${
              isDarkMode ? 'bg-slate-950/80 text-slate-400 border-slate-850' : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              <tr>
                <th className="p-3.5">الاسم الكامل للموظف</th>
                <th className="p-3.5">المحلية / المحافظة المقترنة</th>
                <th className="p-3.5">قسم التعيين دفترياً</th>
                <th className="p-3.5">سقف المديونية المتاح</th>
                <th className="p-3.5">صورة الضمانة التجارية</th>
                <th className="p-3.5">كود المستخدم للميدان</th>
                <th className="p-3.5">كلمة المرور المشفرة</th>
                <th className="p-3.5 text-center">اعتماد المالك</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-850' : 'divide-slate-200'}`}>
              {filtered.length > 0 ? (
                filtered.map((emp, index) => (
                  <tr key={emp.username} className={`transition-all ${
                    isDarkMode ? 'hover:bg-slate-850/45' : 'hover:bg-slate-50'
                  }`}>
                    <td className="p-3.5">
                      <div className="font-extrabold flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>{emp.fullName}</span>
                      </div>
                      <span className={`text-[10px] block font-mono mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ID: {Math.floor(1000 + index * 105)}</span>
                    </td>
                    
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{emp.governorate}</span>
                        {emp.governorate === 'الكل' && (
                          <span className={`p-0.5 px-1.5 text-[9px] font-bold rounded ${
                            isDarkMode ? 'bg-purple-950 text-purple-400' : 'bg-purple-100 text-purple-800'
                          }`}>فيدرالي</span>
                        )}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        {emp.initialTab === 'veterinary' && <Activity className="w-3.5 h-3.5 text-teal-400" />}
                        {emp.initialTab === 'kitchen' && <Soup className="w-3.5 h-3.5 text-amber-500" />}
                        {emp.initialTab === 'pos_settlement' && <Truck className="w-3.5 h-3.5 text-indigo-400" />}
                        {emp.initialTab === 'factory' && <Factory className="w-3.5 h-3.5 text-pink-400" />}
                        {emp.initialTab === 'production' && <Wrench className="w-3.5 h-3.5 text-emerald-400" />}
                        {emp.initialTab === 'treasury' && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                        <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{emp.departmentLabel}</span>
                      </div>
                    </td>

                    {/* Employee Debt Ceiling & Credit Guard Cell */}
                    <td className="p-3.5">
                      {(() => {
                        const cfg = employeeDebtGuardService.getEmployeeDebtConfig(emp.username);
                        const activeDebts = employeeDebtGuardService.getEmployeeActiveDebts(emp.username);
                        const currentIssued = activeDebts.reduce((sum, d) => sum + (d.status === 'active' ? d.amount : 0), 0);
                        const remaining = Math.max(0, cfg.maxCreditLimit - currentIssued);
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                              <span className="font-mono font-black text-amber-400 text-[11px]">
                                {cfg.maxCreditLimit.toLocaleString()} ر.ي
                              </span>
                            </div>
                            <span className="text-[9.5px] text-slate-400">
                              القائم: <span className="text-rose-400 font-mono font-bold">{currentIssued.toLocaleString()}</span> | المتبقي: <span className="text-emerald-400 font-mono font-bold">{remaining.toLocaleString()}</span>
                            </span>
                            <button
                              onClick={() => handleOpenDebtModal(emp)}
                              className="p-1 px-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-[9.5px] font-bold flex items-center gap-1 cursor-pointer w-fit mt-0.5"
                            >
                              <Sliders className="w-3 h-3 text-indigo-400" />
                              <span>ضبط السقف والخصم</span>
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Guarantee Image Thumbnail Preview Column */}
                    <td className="p-3.5">
                      {emp.guaranteeImage ? (
                        <button
                          onClick={() => {
                            setSelectedPreviewImage(emp.guaranteeImage || null);
                            setSelectedPreviewEmployee(emp.fullName);
                            playSound(1200, 0.1);
                          }}
                          className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 transition-all text-[10px] cursor-pointer"
                        >
                          <img 
                            src={emp.guaranteeImage} 
                            alt="thumb" 
                            className="w-6 h-6 object-cover rounded border border-emerald-600/30"
                            referrerPolicy="no-referrer"
                          />
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>عرض كفالة الضمانة</span>
                        </button>
                      ) : (
                        <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>الرواد الأساسيون (مكفول قانونياً)</span>
                      )}
                    </td>

                    <td className={`p-3.5 font-mono select-all font-bold tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      {emp.username}
                    </td>

                    <td className="p-3.5 font-mono text-emerald-500 select-all font-semibold uppercase">
                      {emp.password}
                    </td>

                    {/* Owner Approval Status and Action Buttons */}
                    <td className="p-3.5 text-center">
                      {emp.isApprovedByOwner === false ? (
                        <div className="flex flex-col items-center gap-1 my-1 justify-center">
                          <span className={`p-1 px-2.5 text-[9px] font-extrabold rounded-full border flex items-center gap-1 animate-pulse ${
                            isDarkMode ? 'bg-amber-950/40 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-750 border-amber-200'
                          }`}>
                            <Lock className="w-3 h-3 text-amber-500" />
                            حساب معلق (بانتظار المالك)
                          </span>
                          
                          {(activeUser?.role === 'GeneralManager' || activeUser?.governorate === 'الكل') && (
                            <button
                              onClick={() => handleApproveEmployeeByOwner(emp.username)}
                              className="bg-emerald-650 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-slate-950 font-extrabold p-1 px-2 rounded-lg cursor-pointer text-[9px] flex items-center gap-1 transition-all active:scale-95 shadow-md hover:shadow-emerald-500/10"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
                              <span>الموافقة وتفعيل الحساب</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className={`p-1 px-2.5 text-[9px] font-extrabold rounded-full border flex items-center gap-0.5 ${
                            isDarkMode ? 'bg-emerald-950/45 text-emerald-400 border-emerald-850' : 'bg-emerald-50 text-emerald-700 border-emerald-150'
                          }`}>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            مقبول ومفعل بنجاح
                          </span>
                          {emp.approvedBy && (
                            <span className="text-[7.5px] text-slate-500 block">باعتماد: {emp.approvedBy}</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => copyToClipboard(`${emp.username} | ${emp.password}`, index)}
                          className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
                          }`}
                          title="نسخ الهوية الكاملة"
                        >
                          {copiedIndex === index ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.username)}
                          disabled={emp.username === 'super_admin' || emp.username === 'super_zelai'}
                          className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                            emp.username === 'super_admin' || emp.username === 'super_zelai'
                              ? 'opacity-30 cursor-not-allowed bg-slate-105:bg-slate-100 border-slate-200 text-slate-400'
                              : (isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-rose-455:text-rose-400 hover:bg-rose-950/40' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100' )
                          }`}
                          title="حذف الموظف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-bold">
                    🔍 لم يتم العثور على أي موظف مطابق للبحث أو الفرع المختار.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* --- HIGH-FIDELITY TRADE GUARANTEE MODAL DIALOG --- */}
      <AnimatePresence>
        {selectedPreviewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25 }}
              className={`w-full max-w-2xl rounded-3xl border text-right overflow-hidden shadow-2xl ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              {/* Modal Header */}
              <div className={`p-4 flex items-center justify-between border-b ${
                isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50'
              }`}>
                <button
                  onClick={() => { setSelectedPreviewImage(null); setSelectedPreviewEmployee(null); playSound(600, 0.1); }}
                  className={`p-1 px-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-300'
                  }`}
                >
                  إغلاق ✕
                </button>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 animate-pulse" />
                  <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    مراجعة مستند الضمانة للموظف: {selectedPreviewEmployee}
                  </span>
                </div>
              </div>

              {/* Modal Body: High Resolution Document Preview */}
              <div className="p-6 flex flex-col items-center justify-center gap-4">
                <div className={`p-1 border rounded-2xl w-full max-w-lg bg-white overflow-hidden ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <img 
                    src={selectedPreviewImage} 
                    alt="Trade Guarantee Document" 
                    className="w-full h-auto object-contain rounded-xl max-h-[380px]"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Additional Metadata / Rules */}
                <div className={`p-3.5 rounded-xl text-right text-[10.5px] leading-relaxed w-full border ${
                  isDarkMode ? 'bg-slate-950 border-slate-850 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  🛡️ <b>تأكيد وتفعيل البصمة الميدانية:</b> هذه الضمانة التجارية مسجلة ومنفذة بشكل قانوني في الغرف التجارية اليمنية بالتوافق مع الملحق المالي لنوع التعاقد، وتعد وثيقة إلزامية للشركات المساهمة للوقاية من العجز والتهرب الجغرافي.
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- EMPLOYEE DEBT CEILING & SALARY DEDUCTION CONTROL MODAL --- */}
      <AnimatePresence>
        {debtModalOpen && selectedDebtEmployee && employeeDebtConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`w-full max-w-3xl rounded-3xl border text-right overflow-hidden shadow-2xl ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              {/* Modal Header */}
              <div className={`p-4 flex items-center justify-between border-b ${
                isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50'
              }`}>
                <button
                  onClick={() => { setDebtModalOpen(false); setSelectedDebtEmployee(null); playSound(600, 0.1); }}
                  className={`p-1 px-3 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  إغلاق ✕
                </button>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      لوحة إدارة سقف المديونية والخصم للموظف: {selectedDebtEmployee.fullName}
                    </h3>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      اسم المستخدم: {selectedDebtEmployee.username} | الفرع: {selectedDebtEmployee.governorate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

                {/* 1. Debt Ceiling Config Card */}
                <div className={`p-4 rounded-2xl border space-y-4 ${
                  isDarkMode ? 'bg-slate-950 border-amber-500/20' : 'bg-amber-50/50 border-amber-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      تحديد وتعديل سقف المديونية المسموح بها لإدانة الأشخاص على مسؤوليته
                    </span>
                    <span className="p-1 px-2.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      محمي بضمانة الموظف
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-bold">سقف المديونية الأقصى (ر.ي):</label>
                      <input 
                        type="number"
                        value={editingCeiling}
                        onChange={e => setEditingCeiling(Number(e.target.value))}
                        className={`w-full p-2.5 rounded-xl font-mono font-bold text-sm text-right border ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-amber-300' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-bold">الديون القائمة حالياً:</label>
                      <div className="p-2.5 rounded-xl font-mono font-bold text-sm bg-slate-900/60 border border-slate-800 text-rose-400">
                        {activeDebtsList.reduce((s, d) => s + (d.status === 'active' ? d.amount : 0), 0).toLocaleString()} ر.ي
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-bold">المتبقي المتاح للإدانة:</label>
                      <div className="p-2.5 rounded-xl font-mono font-bold text-sm bg-slate-900/60 border border-slate-800 text-emerald-400">
                        {Math.max(0, editingCeiling - activeDebtsList.reduce((s, d) => s + (d.status === 'active' ? d.amount : 0), 0)).toLocaleString()} ر.ي
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={employeeDebtConfig.autoSalaryDeductionOnDefault}
                        onChange={e => setEmployeeDebtConfig(prev => prev ? { ...prev, autoSalaryDeductionOnDefault: e.target.checked } : null)}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                      <span>تفعيل الخصم التلقائي المباشر من الراتب عند تعثر العميل كلياً</span>
                    </label>

                    <button
                      onClick={handleSaveCeilingConfig}
                      className="p-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer transition-all shadow-md active:scale-95"
                    >
                      حفظ السقف الجديد
                    </button>
                  </div>
                </div>

                {/* 2. Active Debts List & Salary Deduction Trigger */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    الديون القائمة المحررة على مسؤولية الموظف ({activeDebtsList.filter(d => d.status === 'active').length})
                  </h4>

                  {activeDebtsList.length > 0 ? (
                    <div className="space-y-2">
                      {activeDebtsList.map(debt => (
                        <div 
                          key={debt.id}
                          className={`p-3.5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                            debt.status === 'active'
                              ? 'bg-slate-950 border-slate-800'
                              : 'bg-slate-950/40 border-slate-900 opacity-60'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-white">اسم العميل المدين: {debt.customerName}</span>
                              {debt.customerPhone && <span className="text-[10px] text-slate-400 font-mono">({debt.customerPhone})</span>}
                              <span className={`p-0.5 px-2 rounded text-[9px] font-bold ${
                                debt.status === 'active' 
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                {debt.status === 'active' ? 'دين قائم' : debt.status === 'deducted_from_salary' ? 'خصم من الراتب' : 'مسدد'}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-400 mt-1">{debt.notes}</p>
                            <span className="text-[9.5px] text-slate-500 font-mono block mt-0.5">
                              تاريخ التحرير: {new Date(debt.issuedAt).toLocaleDateString('ar-YE')}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                            <span className="font-mono font-black text-rose-400 text-sm">
                              {debt.amount.toLocaleString()} ر.ي
                            </span>

                            {debt.status === 'active' && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleManualSettleDebt(debt)}
                                  className="p-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] flex items-center gap-1 cursor-pointer transition-all shadow-md active:scale-95"
                                  title="تسجيل سداد العميل لدى الصندوق أو موظف آخر لإعادة السقف فوراً"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>تأكيد السداد وإرجاع السقف</span>
                                </button>

                                <button
                                  onClick={() => handleConvertToSalaryDeduction(debt.id)}
                                  className="p-1.5 px-3 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 font-black text-[10.5px] flex items-center gap-1 cursor-pointer transition-all shadow-md active:scale-95"
                                  title="في حال تعثر العميل وعدم سداده، يتم الخصم من كشف راتب الموظف الضامن"
                                >
                                  <Scissors className="w-3.5 h-3.5" />
                                  <span>خصم من الراتب</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-850">
                      لا توجد أي ديون قائمة محررة على مسؤولية هذا الموظف حالياً.
                    </div>
                  )}
                </div>

                {/* 3. Salary Deductions History Log */}
                {salaryDeductionLogs.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-extrabold text-white flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-purple-400" />
                      سجل الخصميات المحولة لراتب الموظف ({salaryDeductionLogs.length})
                    </h4>

                    <div className="space-y-2">
                      {salaryDeductionLogs.map(log => (
                        <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-purple-500/20 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-200 block">{log.reason}</span>
                            <span className="text-[9.5px] text-slate-500 font-mono block">
                              باعتماد: {log.approvedBy} | بتاريخ: {new Date(log.deductedAt).toLocaleDateString('ar-YE')}
                            </span>
                          </div>
                          <span className="font-mono font-black text-purple-400 text-xs">
                            -{log.amount.toLocaleString()} ر.ي
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
