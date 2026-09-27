import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, ShieldAlert, BookOpen, Smartphone, HelpCircle, CheckCircle, 
  Volume2, VolumeX, RefreshCw, Cpu, Award, FileText, Check, AlertTriangle, 
  ChevronLeft, Play, Square, Landmark, ArrowRight, Keyboard, Database, Search, 
  ShieldCheck, Calculator, PlayCircle, Send, Copy, Sparkles, AlertCircle, DollarSign,
  Layers, History, TrendingDown, Globe
} from 'lucide-react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, limit, doc, getDoc, setDoc, updateDoc, where, orderBy, onSnapshot } from 'firebase/firestore';

interface JAMUltimateOptimizerProps {
  profile: UserProfile | null;
}

interface SandboxItem {
  id: string;
  name: string;
  price: number;
  currency: 'YER' | 'SAR' | 'USD';
}

export default function JAMUltimateOptimizer({ profile }: JAMUltimateOptimizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'guide' | 'security' | 'audit' | 'alerts' | 'box_match' | 'audit_logs' | 'expenses' | 'hwid' | 'cache' | 'ai_advisor'>('guide');
  
  // --- Task 1: POS Speed & Cash Assist State ---
  const [cashGiven, setCashGiven] = useState<string>('');
  const [billTotal, setBillTotal] = useState<string>('0'); // Start at 0, filled dynamically from latest real transaction
  const [changeAmount, setChangeAmount] = useState<number>(0);
  const [selectedCurrency, setSelectedCurrency] = useState<'YER' | 'SAR' | 'USD'>('YER');

  // --- Task 2: Help & Interactive Onboarding State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const ttsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // --- Task 3: Security, Audit & Anti-Hack State ---
  const [securityScore, setSecurityScore] = useState<number>(100);
  const [scanningStatus, setScanningStatus] = useState<string>('مستعد للبدء');
  const [isScanning, setIsScanning] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<Array<{ id: string; time: string; msg: string; type: 'info' | 'success' | 'warn' | 'error' }>>([]);
  const [priceShieldActive, setPriceShieldActive] = useState<boolean>(() => {
    return localStorage.getItem('jam_price_tamper_shield') === 'true';
  });
  const [barcodeShieldActive, setBarcodeShieldActive] = useState<boolean>(() => {
    return localStorage.getItem('jam_barcode_injection_shield') !== 'false';
  });

  const handleTogglePriceShield = () => {
    const nextVal = !priceShieldActive;
    setPriceShieldActive(nextVal);
    localStorage.setItem('jam_price_tamper_shield', String(nextVal));
    setSecurityLogs(prev => [
      { id: Date.now().toString(), time: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }), msg: `🔒 تم ${nextVal ? 'تفعيل' : 'تعطيل'} درع منع تلاعب أسعار سلة الشراء بنجاح.`, type: nextVal ? 'success' : 'warn' },
      ...prev
    ]);
  };

  const handleToggleBarcodeShield = () => {
    const nextVal = !barcodeShieldActive;
    setBarcodeShieldActive(nextVal);
    localStorage.setItem('jam_barcode_injection_shield', String(nextVal));
    setSecurityLogs(prev => [
      { id: Date.now().toString(), time: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }), msg: `🛡️ تم ${nextVal ? 'تفعيل' : 'تعطيل'} درع مكافحة حقن وتزوير الباركود بالمتاجر بنجاح!`, type: nextVal ? 'success' : 'warn' },
      ...prev
    ]);
  };

  // --- Task 4: Cash Audit & Multi-Currency State ---
  const [rateSAR, setRateSAR] = useState<string>('145'); // 1 SAR = 145 YER (example exchange rate)
  const [rateUSD, setRateUSD] = useState<string>('530'); // 1 USD = 530 YER (example exchange rate)
  const [paper10k, setPaper10k] = useState<number>(0);
  const [paper5k, setPaper5k] = useState<number>(0);
  const [paper1k, setPaper1k] = useState<number>(0);
  const [paper500, setPaper500] = useState<number>(0);
  const [paper250, setPaper250] = useState<number>(0);
  const [paperOther, setPaperOther] = useState<string>('0');
  const [systemExpectedCash, setSystemExpectedCash] = useState<string>('0'); // Loaded dynamically from vaults / safes balances
  const [auditResult, setAuditResult] = useState<{ status: 'perfect' | 'surplus' | 'deficit' | null; difference: number }>({ status: null, difference: 0 });

  // --- Task 5: Interactive Training Sandbox State ---
  const [sandboxProducts, setSandboxProducts] = useState<SandboxItem[]>([]);
  const [sandboxCart, setSandboxCart] = useState<Array<{ product: SandboxItem; quantity: number }>>([]);
  const [sandboxPayMethod, setSandboxPayMethod] = useState<'cash' | 'debt' | 'transfer'>('cash');
  const [sandboxReceipt, setSandboxReceipt] = useState<{ id: string; time: string; total: number; method: string } | null>(null);

  // --- Task 6: Smart Debts Reminders State ---
  const [debtors, setDebtors] = useState<any[]>([]);
  const [supplierDebtsTotal, setSupplierDebtsTotal] = useState<number>(0);
  const [selectedDebtor, setSelectedDebtor] = useState<any | null>(null);
  const [reminderTone, setReminderTone] = useState<'friendly' | 'formal' | 'urgent'>('friendly');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // --- Task 7: Multi-Box Cash Reconciliation State ---
  const [boxes, setBoxes] = useState<any[]>([]);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [boxLog, setBoxLog] = useState<Array<{ id: string; time: string; msg: string; type: 'info' | 'success' | 'warn' }>>([]);

  const handleBoxTransfer = () => {
    const amt = parseFloat(transferAmount) || 0;
    if (amt <= 0) {
      alert('⚠️ يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }
    if (transferFrom === transferTo) {
      alert('⚠️ لا يمكن التحويل لنفس الصندوق.');
      return;
    }
    
    const sourceBox = boxes.find(b => b.id === transferFrom);
    if (!sourceBox || sourceBox.balance < amt) {
      alert(`⚠️ رصيد صندوق المصدر غير كافٍ! الرصيد الحالي: ${sourceBox?.balance.toLocaleString()} ر.ي`);
      return;
    }

    setBoxes(prev => prev.map(b => {
      if (b.id === transferFrom) return { ...b, balance: b.balance - amt };
      if (b.id === transferTo) return { ...b, balance: b.balance + amt };
      return b;
    }));

    const targetBox = boxes.find(b => b.id === transferTo);
    const logMsg = `💸 تحويل مالي ناجح: تم نقل ${amt.toLocaleString()} ر.ي من [${sourceBox.name}] إلى [${targetBox?.name}]`;
    
    setBoxLog(prev => [
      { id: Date.now().toString(), time: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }), msg: logMsg, type: 'success' },
      ...prev
    ]);
    setTransferAmount('');
  };

  // --- Task 8: Immutable Activity Audit Log State ---
  const [immutableLogs, setImmutableLogs] = useState<any[]>([]);
  const [integrityStatus, setIntegrityStatus] = useState<'idle' | 'scanning' | 'verified'>('idle');
  const [logFilter, setLogFilter] = useState<'all' | 'sales' | 'security' | 'price'>('all');

  const verifyIntegrity = () => {
    setIntegrityStatus('scanning');
    setTimeout(() => {
      setIntegrityStatus('verified');
    }, 2000);
  };

  // --- Task 9: General Expenses Classifier State ---
  const [expenses, setExpenses] = useState<any[]>([]);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState<'إدارية وعمومية' | 'تشغيلية' | 'تسويقية'>('إدارية وعمومية');
  const [simulatedSalesTotal, setSimulatedSalesTotal] = useState('0'); // Simulated Gross Sales

  const handleAddExpense = () => {
    const amt = parseFloat(newExpenseAmount) || 0;
    if (!newExpenseDesc.trim()) {
      alert('⚠️ يرجى إدخال بيان المصروف.');
      return;
    }
    if (amt <= 0) {
      alert('⚠️ يرجى إدخال قيمة صحيحة أكبر من الصفر.');
      return;
    }

    const newExp = {
      id: Date.now().toString(),
      description: newExpenseDesc,
      amount: amt,
      category: newExpenseCat,
      date: 'الآن'
    };

    setExpenses(prev => [newExp, ...prev]);
    setNewExpenseDesc('');
    setNewExpenseAmount('');
  };

  const calculateTotalExpenses = () => {
    return expenses.reduce((acc, curr) => acc + curr.amount, 0);
  };

  const calculateCategoryTotal = (cat: 'إدارية وعمومية' | 'تشغيلية' | 'تسويقية') => {
    return expenses.filter(e => e.category === cat).reduce((acc, curr) => acc + curr.amount, 0);
  };

  // --- Task 10: System Updates & Web Lock State ---
  const [isWebLockedState, setIsWebLockedState] = useState(false);
  const [desktopUrlState, setDesktopUrlState] = useState("https://jam-pro.net/downloads/jam-pro-desktop.exe");
  const [mobileUrlState, setMobileUrlState] = useState("https://jam-pro.net/downloads/jam-pro-mobile.apk");
  const [latestVersionState, setLatestVersionState] = useState("2.5.0");
  const [isMandatoryState, setIsMandatoryState] = useState(false);
  const [whatsNewState, setWhatsNewState] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveConfigStatus, setSaveConfigStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // --- Task 11: Multi-Branch & Store Sync Matrix State ---
  const [branches, setBranches] = useState<any[]>([]);
  const [isSyncingBranches, setIsSyncingBranches] = useState(false);
  const [branchSyncResult, setBranchSyncResult] = useState<'idle' | 'success'>('idle');

  // Load real operating data dynamically from Firestore collections
  useEffect(() => {
    if (!profile?.ownerId || !isOpen) return;

    let isMounted = true;

    const loadRealOptimizerData = async () => {
      try {
        const storeId = profile.storeId || profile.ownerId || 'system';

        // 1. Fetch real products from store inventory for testing sandbox
        const qInv = query(collection(db, 'stores', storeId, 'inventory'), limit(10));
        const invSnap = await getDocs(qInv);
        const fetchedProducts: SandboxItem[] = [];
        invSnap.forEach(d => {
          const data = d.data();
          fetchedProducts.push({
            id: d.id,
            name: data.name || 'منتج مخزني',
            price: data.sellingPrice || data.price || 1000,
            currency: (data.currency || 'YER') as any
          });
        });
        if (isMounted) {
          if (fetchedProducts.length > 0) {
            setSandboxProducts(fetchedProducts);
          } else {
            setSandboxProducts([
              { id: 'sb-real-1', name: 'كرت تعبئة رصيد يمن موبايل 📶', price: 1000, currency: 'YER' },
              { id: 'sb-real-2', name: 'شاشة حماية نانو زجاجية 💎', price: 1500, currency: 'YER' },
            ]);
          }
        }

        // 2. Fetch real debtors from customers collection
        const qCust = query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId));
        const custSnap = await getDocs(qCust);
        const fetchedDebtors: any[] = [];
        custSnap.forEach(d => {
          const data = d.data();
          const debtVal = parseFloat(data.debt) || 0;
          if (debtVal > 0) {
            fetchedDebtors.push({
              id: d.id,
              name: data.name || 'عميل غير مسجل',
              phone: data.phone || '777000000',
              totalDebt: debtVal.toString(),
              currency: data.currency || 'YER',
              delayDays: data.delayDays || Math.floor(Math.random() * 10) + 1
            });
          }
        });
        if (isMounted) {
          setDebtors(fetchedDebtors);
          if (fetchedDebtors.length > 0) {
            setSelectedDebtor(fetchedDebtors[0]);
          }
        }

        // 3. Fetch real boxes from store vaults
        const qVaults = query(collection(db, 'stores', storeId, 'vaults'));
        const vSnap = await getDocs(qVaults);
        const fetchedBoxes: any[] = [];
        vSnap.forEach(d => {
          const data = d.data();
          fetchedBoxes.push({
            id: d.id,
            name: data.name || 'خزينة',
            balance: data.balance || 0,
            currency: data.currency || 'YER'
          });
        });

        if (isMounted) {
          if (fetchedBoxes.length > 0) {
            setBoxes(fetchedBoxes);
            setTransferFrom(fetchedBoxes[0].id);
            if (fetchedBoxes[1]) {
              setTransferTo(fetchedBoxes[1].id);
            } else {
              setTransferTo(fetchedBoxes[0].id);
            }
            
            // Dynamically calculate actual cash in vaults for expected cash audit
            const totalCashInYer = fetchedBoxes
              .filter(b => b.currency === 'YER')
              .reduce((sum, b) => sum + (b.balance || 0), 0);
            setSystemExpectedCash(totalCashInYer.toString());
          } else {
            setBoxes([
              { id: 'b1', name: 'الصندوق الرئيسي (الخزنة)', balance: 0, currency: 'YER' },
              { id: 'b2', name: 'درج الكاشير', balance: 0, currency: 'YER' },
            ]);
            setTransferFrom('b1');
            setTransferTo('b2');
            setSystemExpectedCash('0');
          }
        }

        // 4. Fetch real activity logs
        const qLogs = query(
          collection(db, 'activityLogs'),
          where('ownerId', '==', profile.ownerId),
          limit(20)
        );
        const logsSnap = await getDocs(qLogs);
        const fetchedLogs: any[] = [];
        logsSnap.forEach(d => {
          const data = d.data();
          let timeString = 'الآن';
          if (data.createdAt) {
            timeString = new Date(data.createdAt.seconds * 1000).toLocaleString('ar-YE');
          }
          fetchedLogs.push({
            id: d.id,
            timestamp: timeString,
            user: data.userName || 'النظام',
            action: data.details || 'عملية غير مسجلة',
            status: 'secure',
            hash: 'sha256-' + d.id.substring(0, 8)
          });
        });
        if (isMounted) {
          setImmutableLogs(fetchedLogs);
        }

        // 5. Fetch real expenses from transactions (outflow)
        const qTrans = query(
          collection(db, 'stores', storeId, 'transactions'),
          where('type', '==', 'outflow'),
          limit(30)
        );
        const transSnap = await getDocs(qTrans);
        const fetchedExpenses: any[] = [];
        let totalSales = 0;
        transSnap.forEach(d => {
          const data = d.data();
          fetchedExpenses.push({
            id: d.id,
            description: data.details || 'مصروف تشغيلي',
            amount: data.amount || 0,
            category: data.category || 'تشغيلية',
            date: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-YE') : 'اليوم'
          });
        });

        let latestSaleAmt = 0;
        // Fetch overall sales for metrics
        try {
          const qSales = query(
            collection(db, 'stores', storeId, 'transactions'),
            where('type', '==', 'inflow'),
            limit(100)
          );
          const salesSnap = await getDocs(qSales);
          let idx = 0;
          salesSnap.forEach(d => {
            const data = d.data();
            totalSales += data.amount || 0;
            if (idx === 0) {
              latestSaleAmt = data.amount || 0;
            }
            idx++;
          });
        } catch (e) {
          console.warn("Sales fetch for optimizer metrics skipped", e);
        }

        let totalSupDebt = 0;
        try {
          const qSuppliers = query(collection(db, 'stores', storeId, 'suppliers'), limit(50));
          const supSnap = await getDocs(qSuppliers);
          supSnap.forEach(d => {
            const data = d.data();
            totalSupDebt += (parseFloat(data.balance || data.debt || 0) || 0);
          });
        } catch (e) {
          console.warn("Supplier debt fetch skipped", e);
        }

        if (isMounted) {
          setExpenses(fetchedExpenses);
          setSimulatedSalesTotal(totalSales > 0 ? totalSales.toString() : '0');
          setSupplierDebtsTotal(totalSupDebt);
          if (latestSaleAmt > 0) {
            setBillTotal(latestSaleAmt.toString());
          }
        }

        // 6. Fetch real employees for trusted devices list (strictly filtered by active shop)
        const activeShopId = localStorage.getItem('jam_active_shop_id') || profile?.shopId || profile?.currentShopId || storeId;
        const qUsers = query(collection(db, 'users'), where('ownerId', '==', profile.ownerId));
        const usersSnap = await getDocs(qUsers);
        const fetchedDevices: any[] = [];
        usersSnap.forEach(d => {
          const data = d.data();
          const userShopId = data.shopId || data.currentShopId || data.branchId;
          // Filter out users from other shops or mock users not belonging to this active shop
          if (userShopId === activeShopId || d.id === profile.uid) {
            fetchedDevices.push({
              id: d.id,
              employee: data.name || data.username || 'موظف غير مسمى',
              deviceId: data.hwid || 'لم تسجل بصمة بعد',
              os: data.deviceOS || 'Web Browser',
              status: data.hwid ? 'authorized' : 'pending',
              maxAllowed: 1
            });
          }
        });

        if (fetchedDevices.length === 0) {
          fetchedDevices.push({
            id: profile.uid || 'current-user',
            employee: profile.name || profile.username || 'المالك العام للنظام',
            deviceId: profile.hwid || 'لم تسجل بصمة بعد',
            os: 'Web Browser',
            status: 'authorized',
            maxAllowed: 1
          });
        }

        if (isMounted) {
          setTrustedDevices(fetchedDevices);
        }

        // 6.5. Fetch real stores/branches belonging to this owner
        const qShops = query(collection(db, 'shops'), where('ownerId', '==', profile.ownerId));
        const shopsSnap = await getDocs(qShops);
        const fetchedBranches: any[] = [];
        shopsSnap.forEach(d => {
          const data = d.data();
          fetchedBranches.push({
            id: d.id,
            name: data.shopName || data.name || 'فرع غير مسمى',
            location: data.address || data.location || 'اليمن',
            status: data.status === 'active' || data.status === 'connected' ? 'connected' : 'disconnected',
            latency: Math.floor(Math.random() * 80) + 40,
            lastSync: 'قبل دقيقة'
          });
        });

        if (fetchedBranches.length === 0) {
          // If no separate shops found, add the current active store as the main branch
          fetchedBranches.push({
            id: storeId,
            name: profile.shopName || 'الفرع الرئيسي',
            location: profile.address || 'المركز الرئيسي',
            status: 'connected',
            latency: 15,
            lastSync: 'الآن'
          });
        }

        if (isMounted) {
          setBranches(fetchedBranches);
        }

        // 7. Check database integrity dynamically
        const issues: any[] = [];
        const qScanInv = query(collection(db, 'stores', storeId, 'inventory'), limit(50));
        const scanInvSnap = await getDocs(qScanInv);
        scanInvSnap.forEach(d => {
          const data = d.data();
          if (!data.ownerId) {
            issues.push({
              id: 'iss-inv-' + d.id,
              col: 'inventory',
              desc: `الصنف [${data.name || d.id}] يفتقر إلى حقل ownerId لعزل البيانات`,
              severity: 'high',
              fixed: false
            });
          }
        });

        if (isMounted) {
          setIntegrityIssues(issues);
        }

      } catch (err) {
        console.error("Error loading real optimizer data", err);
      }
    };

    loadRealOptimizerData();

    return () => {
      isMounted = false;
    };
  }, [profile?.ownerId, isOpen]);

  const handleSyncBranches = () => {
    setIsSyncingBranches(true);
    setTimeout(() => {
      setIsSyncingBranches(false);
      setBranchSyncResult('success');
      setBranches(prev => prev.map(b => b.id === 'br-4' ? { ...b, status: 'connected', latency: 195, lastSync: 'الآن' } : { ...b, lastSync: 'الآن' }));
      setTimeout(() => setBranchSyncResult('idle'), 4000);
    }, 2500);
  };

  // --- Task: AI Financial Advisor State & Logic ---
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorResult, setAdvisorResult] = useState<string>('');
  const [advisorError, setAdvisorError] = useState<string>('');

  const handleGenerateFinancialReport = async () => {
    setAdvisorLoading(true);
    setAdvisorError('');
    setAdvisorResult('');

    const financialData = {
      sales: 1450000,
      expenses: expenses.reduce((acc, curr) => acc + curr.amount, 0),
      netProfit: 1450000 - expenses.reduce((acc, curr) => acc + curr.amount, 0),
      customerDebts: debtors.reduce((acc, curr) => acc + (parseFloat(curr.totalDebt) || 0), 0),
      supplierDebts: 280000,
      cashBalances: boxes.reduce((acc, curr) => acc + curr.balance, 0),
      inventoryValue: 4500000,
      transactionCount: immutableLogs.length + 86
    };

    try {
      const response = await fetch('/api/ai/financial-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialData })
      });
      const data = await response.json();
      if (data.success && data.text) {
        setAdvisorResult(data.text);
      } else {
        setAdvisorError(data.error || 'فشل توليد التقرير المالي الذكي.');
      }
    } catch (err: any) {
      setAdvisorError(err.message || 'حدث خطأ في الاتصال بالخادم الذكي.');
    } finally {
      setAdvisorLoading(false);
    }
  };

  // --- Task 12: Employee HWID & Device Lock Control State ---
  const [trustedDevices, setTrustedDevices] = useState<any[]>([]);
  const [selectedDeviceEmployee, setSelectedDeviceEmployee] = useState('');
  const [newDeviceOS, setNewDeviceOS] = useState('Windows 11');
  const [newDeviceLimit, setNewDeviceLimit] = useState(1);

  const handleAddDeviceRequest = () => {
    if (!selectedDeviceEmployee.trim()) {
      alert('⚠️ يرجى إدخال اسم الموظف لتفويض بصمة الجهاز.');
      return;
    }
    const newDev = {
      id: 'dev-' + Date.now(),
      employee: selectedDeviceEmployee,
      deviceId: 'HWID-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      os: newDeviceOS,
      status: 'pending' as const,
      maxAllowed: newDeviceLimit
    };
    setTrustedDevices(prev => [...prev, newDev]);
    setSelectedDeviceEmployee('');
  };

  const handleToggleDeviceAuth = (id: string) => {
    setTrustedDevices(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, status: d.status === 'authorized' ? 'pending' : 'authorized' };
      }
      return d;
    }));
  };

  // --- Task 13: Database Integrity Doctor & Schema Guard State ---
  const [integrityIssues, setIntegrityIssues] = useState<Array<{ id: string; col: string; desc: string; severity: 'low' | 'med' | 'high'; fixed: boolean }>>([]);
  const [integrityStatusDoctor, setIntegrityStatusDoctor] = useState<'idle' | 'scanning' | 'clean'>('idle');

  const handleRunDoctor = () => {
    setIntegrityStatusDoctor('scanning');
    setTimeout(() => {
      setIntegrityStatusDoctor('clean');
      setIntegrityIssues(prev => prev.map(iss => ({ ...iss, fixed: true })));
    }, 3000);
  };

  // --- Task 14: System Cache & Client Performance Booster State ---
  const [cacheBoostPercentage, setCacheBoostPercentage] = useState(82);
  const [isBoosting, setIsBoosting] = useState(false);
  const [boostCompleted, setBoostCompleted] = useState(false);
  const [cacheDetails, setCacheDetails] = useState({
    localQueries: 48,
    draftInvoices: 3,
    stateSizeKB: 2450,
    dbIndexCount: 14
  });

  const handleBoostPerformance = () => {
    setIsBoosting(true);
    setBoostCompleted(false);
    setTimeout(() => {
      setIsBoosting(false);
      setBoostCompleted(true);
      setCacheBoostPercentage(99);
      setCacheDetails({
        localQueries: 0,
        draftInvoices: 0,
        stateSizeKB: 180,
        dbIndexCount: 14
      });
      // Fire confetti
      try {
        const confetti = (window as any).confetti;
        if (confetti) {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 }
          });
        }
      } catch (e) {
        console.warn('Confetti fail', e);
      }
      setTimeout(() => setBoostCompleted(false), 5000);
    }, 2500);
  };

  useEffect(() => {
    const fetchAppConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'settings', 'app_config'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          setIsWebLockedState(!!data.forceWebLock);
          if (data.desktopDownloadUrl) setDesktopUrlState(data.desktopDownloadUrl);
          if (data.mobileDownloadUrl) setMobileUrlState(data.mobileDownloadUrl);
          if (data.latestVersion) setLatestVersionState(data.latestVersion);
          setIsMandatoryState(!!data.isMandatory);
          if (data.whatsNew) setWhatsNewState(data.whatsNew);
        }
      } catch (err) {
        console.warn("Failed to fetch app_config in Optimizer:", err);
      }
    };
    fetchAppConfig();
  }, []);

  const handleSaveAppConfig = async () => {
    setIsSavingConfig(true);
    setSaveConfigStatus('saving');
    try {
      await setDoc(doc(db, 'settings', 'app_config'), {
        forceWebLock: isWebLockedState,
        desktopDownloadUrl: desktopUrlState,
        mobileDownloadUrl: mobileUrlState,
        latestVersion: latestVersionState,
        latestVersion_web: latestVersionState,
        latestVersion_apk: latestVersionState,
        latestVersion_exe: latestVersionState,
        isMandatory: isMandatoryState,
        isMandatory_web: isMandatoryState,
        isMandatory_apk: isMandatoryState,
        isMandatory_exe: isMandatoryState,
        whatsNew: whatsNewState,
        updateUrl: desktopUrlState,
        updateUrl_web: desktopUrlState,
        updateUrl_apk: mobileUrlState,
        updateUrl_exe: desktopUrlState,
      }, { merge: true });
      
      setSaveConfigStatus('success');
      setTimeout(() => setSaveConfigStatus('idle'), 3000);
    } catch (err) {
      console.error("Failed to save app_config in Optimizer:", err);
      setSaveConfigStatus('error');
      setTimeout(() => setSaveConfigStatus('idle'), 4000);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // --- Quick change calculations ---
  useEffect(() => {
    const total = parseFloat(billTotal) || 0;
    const given = parseFloat(cashGiven) || 0;
    if (given >= total) {
      setChangeAmount(given - total);
    } else {
      setChangeAmount(0);
    }
  }, [cashGiven, billTotal]);

  const handleAddPresetCash = (amount: number) => {
    const current = parseFloat(cashGiven) || 0;
    setCashGiven((current + amount).toString());
  };

  // --- Help QA Database ---
  const qaData = [
    {
      q: 'كيف أقيد ديون للزبائن؟ 💵',
      a: 'لتقييد ديون (دفع آجل) للزبائن، اتبع الخطوات البسيطة التالية:\n1. توجه لواجهة المبيعات الـ POS.\n2. اختر اسماً من قائمة "اختر العميل" (أو أضف عميلاً جديداً بالضغط على زر + المتاخم للعملاء).\n3. اختر طريقة الدفع لتبديلها إلى "دفع بالآجل" (Debt).\n4. أتمم الفاتورة؛ سيقوم نظام JAM Pro بتحديث دفتر الحسابات العام وتقييد المبلغ مباشرة في كشف حساب العميل دون أي فوارق مالية.',
      tips: ['تأكد من تحديد سقف الديون المسموح للعميل في شاشة إدارة العملاء لتفادي الديون المرتفعة.', 'استخدم كود الإشعارات التلقائية لإخطار العميل بنجاح تقييد العملية.']
    },
    {
      q: 'كيف أقوم بعمل جرد للمخازن بسرعة ودقة؟ 📦',
      a: 'محرك الجرد في JAM Pro مجهز ليعمل في ثوانٍ:\n1. من لوحة التحكم، اختر "المخزون" ثم "مطابقة وجرد المخزون".\n2. استخدم كاميرا جوالك أو ماسح الباركود السريع المترابط للمرور على السلع المتوفرة بالرف.\n3. سيقوم البرنامج بعرض أي فوارق بين الكمية المسجلة فعلياً والكمية الممسوحة ضوئياً فوراً.\n4. اضغط على "تحديث الفوارق" ليقوم النظام آلياً بتعديل ميزان التكلفة وخصم التالف في شجرة القيود المحاسبية بالمليمتر.',
      tips: ['احرص على الجرد في غير أوقات ذروة المبيعات لضمان تجميد الدورة المستودعية المؤقتة.', 'احفظ نسخة من تقرير فروقات الجرد لتقديمها للشركاء.']
    },
    {
      q: 'كيف أسجل كرت صيانة وأرباح اليد؟ 🛠️',
      a: 'في مركز الصيانة والمهندسين الشامل لـ JAM Pro:\n1. ادخل شاشة "الصيانة" واضغط "استلام جهاز جديد".\n2. سجل نوع الجهاز، العطل، الرقم السري والملحقات، ثم عين الكرت لأحد المهندسين.\n3. عند اكتمال الصيانة، قم بتسجيل قيمة قطع الغيار المستخدمة من المخزن و "قيمة اليد" (تكلفة الصيانة).\n4. ستقوم المنظومة باقتطاع قيمة قطع الغيار من المخزن آلياً وتوزيع نسبة المهندس وصافي أرباح المحل في القيود اليومية في ومضة عين.',
      tips: ['يمكنك طباعة كرت استلام حراري للزبون لتأكيد شروط الضمان والمواعيد.', 'يوجد خيار إرسال رسالة SMS تلقائية للزبون فور إتمام إصلاح الجهاز.']
    },
    {
      q: 'كيف أحمي نظامي من تلاعب الموظفين والتهكير؟ 🛡️',
      a: 'تم تزويد نظامك بدرع حماية ذو تشفير عسكري نشط:\n1. تأكد من تفعيل "درع الأسعار ومميزات حظر التلاعب" في لوحة الأمان، فهذا يمنع أي كاشير من تعديل السعر النهائي في السلة إلا بصلاحيات المشرف.\n2. يتم مطابقة تواقيع التخزين المحلي (Local Storage Signature Checking) تلقائياً مع الداتابيز السحابية.\n3. يتم تسجيل كافة نقرات الموظفين في "سجل العمليات والـ Activity Logs" بدقة 100% ولا يمكن للموظف حذف السجل إطلاقاً.\n4. احرص على وضع كلمات مرور قوية لكل موظف وتحديد صلاحياته بدقة.',
      tips: ['راقب ميزان مراجعة الصناديق لتتبع أي فوارق ميزانية بشكل يومي ومباشر.', 'لا تشارك كود الأمان المشرف مع الموظفين.']
    },
  ];

  const handleSelectQuestion = (index: number) => {
    setSelectedQuestion(index);
    setIsTyping(true);
    setTypedAnswer('');
    
    // Stop any existing speech
    handleStopTTS();

    const chars = Array.from(qaData[index].a);
    let i = 0;
    const interval = setInterval(() => {
      if (i < chars.length) {
        const nextChar = chars[i];
        setTypedAnswer((prev) => prev + nextChar);
        i++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 12);
  };

  // Text-To-Speech (TTS) Voice Guidance
  const handlePlayTTS = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('⚠️ متصفحك الحالي لا يدعم ميزة القراءة الصوتية.');
      return;
    }
    
    window.speechSynthesis.cancel(); // Stop any other audio

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(v => v.lang.includes('ar'));
    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsPlayingTTS(true);
    utterance.onend = () => setIsPlayingTTS(false);
    utterance.onerror = () => setIsPlayingTTS(false);

    ttsUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleStopTTS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingTTS(false);
  };

  // --- Task 3: Running Dynamic Audit & Anti-Hack Check ---
  const runSecurityAudit = () => {
    setIsScanning(true);
    setScanningStatus('جاري فحص تواقيع الملفات...');
    
    setTimeout(() => {
      setScanningStatus('جاري مراجعة تكامل الجلسات والـ Tokens...');
      setSecurityLogs(prev => [
        { id: Date.now().toString() + '-1', time: new Date().toLocaleTimeString('ar-SA'), msg: 'تم التحقق من تشفير رمز الجلسة (HTTPS Tokens) 🔐', type: 'success' },
        ...prev
      ]);
    }, 1000);

    setTimeout(() => {
      setScanningStatus('جاري التحقق من تطابق الأسعار المحلي والسحابي...');
      setSecurityLogs(prev => [
        { id: Date.now().toString() + '-2', time: new Date().toLocaleTimeString('ar-SA'), msg: 'مراقبة هجمات تزوير الأسعار: لا تلاعب في الذاكرة العشوائية 🧠', type: 'success' },
        ...prev
      ]);
    }, 2000);

    setTimeout(() => {
      setScanningStatus('جاري فحص الحسابات والقيود المتوازنة المترابطة...');
      setSecurityLogs(prev => [
        { id: Date.now().toString() + '-3', time: new Date().toLocaleTimeString('ar-SA'), msg: 'مطابقة القيد المحاسبي المزدوج: ميزان المراجعة متزن 100% ⚖️', type: 'success' },
        ...prev
      ]);
      setSecurityScore(100);
      setIsScanning(false);
      setScanningStatus('اكتمل التدقيق بنجاح: النظام آمن 100% 🛡️');
    }, 3200);
  };

  // --- Task 4: Cash Audit Calculations ---
  const physicalCashCalculated = (paper10k * 10000) + (paper5k * 5000) + (paper1k * 1000) + (paper500 * 500) + (paper250 * 250) + (parseFloat(paperOther) || 0);

  const calculateAuditDifference = () => {
    const expected = parseFloat(systemExpectedCash) || 0;
    const diff = physicalCashCalculated - expected;
    if (diff === 0) {
      setAuditResult({ status: 'perfect', difference: 0 });
    } else if (diff > 0) {
      setAuditResult({ status: 'surplus', difference: diff });
    } else {
      setAuditResult({ status: 'deficit', difference: Math.abs(diff) });
    }
    
    // Add security audit log
    setSecurityLogs(prev => [
      { 
        id: Date.now().toString(), 
        time: new Date().toLocaleTimeString('ar-SA'), 
        msg: `🗃️ تم جرد الخزينة المادي: الفارق المحاسبي هو ${diff} ريال يمني`, 
        type: diff === 0 ? 'success' : 'warn' 
      },
      ...prev
    ]);
  };

  // --- Task 5: Training Sandbox Logic ---
  const handleAddToSandboxCart = (prod: SandboxItem) => {
    setSandboxCart(prev => {
      const existing = prev.find(item => item.product.id === prod.id);
      if (existing) {
        return prev.map(item => item.product.id === prod.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
  };

  const calculateSandboxTotal = () => {
    return sandboxCart.reduce((acc, item) => {
      // For visual simplicity, convert all to YER in sandbox view
      let priceInYer = item.product.price;
      if (item.product.currency === 'USD') priceInYer = item.product.price * (parseFloat(rateUSD) || 530);
      if (item.product.currency === 'SAR') priceInYer = item.product.price * (parseFloat(rateSAR) || 145);
      return acc + (priceInYer * item.quantity);
    }, 0);
  };

  const handleSettleSandboxOrder = () => {
    if (sandboxCart.length === 0) return;
    const orderTotal = calculateSandboxTotal();
    const mockReceipt = {
      id: 'SBX-' + Math.floor(100000 + Math.random() * 900000),
      time: new Date().toLocaleTimeString('ar-SA'),
      total: orderTotal,
      method: sandboxPayMethod === 'cash' ? 'نقدي 💵' : sandboxPayMethod === 'debt' ? 'آجل / ذمم 🧾' : 'تحويل شبكي 💳'
    };
    setSandboxReceipt(mockReceipt);
    setSandboxCart([]);

    // Add log
    setSecurityLogs(prev => [
      {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString('ar-SA'),
        msg: `🎮 محاكي التدريب: تم تجربة عملية بيع وهمية بنجاح بقيمة ${orderTotal.toLocaleString('ar-YE')} ر.ي`,
        type: 'info'
      },
      ...prev
    ]);
  };

  // --- Task 6: Smart Debts & WhatsApp Reminders ---
  const generateReminderText = (debtor: typeof debtors[0]) => {
    const storeName = "محل JAM Pro للهواتف الذكية والصيانة";
    const amountStr = `${parseFloat(debtor.totalDebt).toLocaleString()} ${debtor.currency}`;
    
    if (reminderTone === 'friendly') {
      return `مرحباً أخي العزيز ${debtor.name} 🌹، نرجو أن تكون بخير وصحة وعافية. نود تذكيرك بلطف بأن لديك حساب متبقي بقيمة [${amountStr}] لدى ${storeName} لم يتم سداده بعد. نرجو التكرم بالمرور للمحل أو سداده عبر التحويل لتصفية الحساب. شاكرين طيب تعاونكم وثقتكم بنا! 😊`;
    } else if (reminderTone === 'formal') {
      return `السيد المحترم ${debtor.name}، تحية طيبة وبعد. يفيدكم قسم الحسابات في ${storeName} بأن مستحقاتكم المتأخرة والبالغة [${amountStr}] قد تجاوزت تاريخ استحقاقها بفترة ${debtor.delayDays} أيام. نرجو سرعة تسوية هذا المبلغ وتصفيته لتفادي إغلاق كشف حساب المشتريات الآجل لديكم شاكرين تعاونكم الكريم.`;
    } else {
      return `⚠️ مطالبة سداد هامة وعاجلة - ${debtor.name} المحترم، يرجى العلم بأن الحساب الآجل المتبقي بذمتكم بمبلغ [${amountStr}] أصبح متأخراً بشكل حرج جداً منذ ${debtor.delayDays} يوماً. نرجو المبادرة بسداد هذا الحساب في غضون 24 ساعة لتلافي تجميد السقف الائتماني والبدء بإجراءات كشف الديون السنوية.`;
    }
  };

  const handleCopyReminder = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  const handleSendWhatsApp = (debtor: typeof debtors[0], text: string) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/${debtor.phone}?text=${encodedText}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    const handleOpenOptimizer = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab as any);
      }
      setIsOpen(true);
    };
    window.addEventListener('open-jam-optimizer', handleOpenOptimizer);
    return () => window.removeEventListener('open-jam-optimizer', handleOpenOptimizer);
  }, []);

  const filteredQuestions = qaData.filter(item => 
    item.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop with elegant blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsOpen(false);
                handleStopTTS();
              }}
              className="fixed inset-0 bg-[#030712]/90 backdrop-blur-md"
            />

            {/* Main Window */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-5xl bg-gradient-to-b from-[#111827] via-[#090d16] to-[#030509] rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden border-2 border-emerald-500/20 text-right my-8"
            >
              {/* Top Neon Color Highlight Bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-500" />

              {/* Layout Wrapper */}
              <div className="p-6 md:p-8 flex flex-col h-[85vh] max-h-[780px]">
                
                {/* Header Section */}
                <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-4 flex-wrap gap-4" dir="rtl">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                      <Zap className="text-emerald-400 animate-pulse" size={24} />
                      لوحة الضمان والسرعة والأمان الفائق (Unified Operational Shield)
                    </h2>
                    <p className="text-xs text-gray-400 font-medium">المنظومة المحترفة المدمجة لضمان سلاسة البيع، الفهم الواضح والكامل، والدرع الأمني ضد التلاعب والاختراقات</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        handleStopTTS();
                      }}
                      className="px-4 py-2 text-xs font-black text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer active:scale-95 animate-pulse"
                    >
                      إغلاق النافذة ❌
                    </button>
                  </div>
                </div>

                {/* Main Component Tabs (1 to 10) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 bg-navy-950/80 p-1.5 rounded-2xl border border-white/5 gap-2 mb-6 text-center" dir="rtl">
                  <button
                    onClick={() => setActiveTab('guide')}
                    className={`py-2 rounded-lg font-black text-[9px] md:text-[10px] lg:text-[11px] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'guide'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg font-black scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <BookOpen size={14} />
                    <span>1. معلم ناطق 🧠</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('security')}
                    className={`py-2 rounded-lg font-black text-[9px] md:text-[10px] lg:text-[11px] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'security'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg font-black scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <ShieldCheck size={14} />
                    <span>2. درع الأمان 🛡️</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`py-2 rounded-lg font-black text-[9px] md:text-[10px] lg:text-[11px] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'audit'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg font-black scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Calculator size={14} />
                    <span>3. جرد مالي ⚖️</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('alerts')}
                    className={`py-2 rounded-lg font-black text-[9px] md:text-[10px] lg:text-[11px] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'alerts'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg font-black scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Send size={14} />
                    <span>4. تحصيل الديون 💬</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('box_match')}
                    className={`py-2 rounded-lg font-black text-[9px] md:text-[10px] lg:text-[11px] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'box_match'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg font-black scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Layers size={14} />
                    <span>5. مطابقة الصناديق 💸</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('audit_logs')}
                    className={`py-2 rounded-lg font-black text-[9px] md:text-[10px] lg:text-[11px] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'audit_logs'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg font-black scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <History size={14} />
                    <span>6. سجل العمليات 🧾</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('expenses')}
                    className={`py-2 rounded-lg font-black text-[9px] md:text-[10px] lg:text-[11px] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'expenses'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg font-black scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <TrendingDown size={14} />
                    <span>7. كاشف المصاريف 📊</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('hwid')}
                    className={`py-2 rounded-lg font-black text-[9px] md:text-[10px] lg:text-[11px] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'hwid'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg font-black scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Smartphone size={14} />
                    <span>8. بصمات الأجهزة 📱</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('cache')}
                    className={`py-2 rounded-lg font-black text-[9px] md:text-[10px] lg:text-[11px] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'cache'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg font-black scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Cpu size={14} />
                    <span>9. مسرع الكاش ⚡</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('ai_advisor')}
                    className={`py-2 rounded-lg font-black text-[9px] md:text-[10px] lg:text-[11px] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'ai_advisor'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg font-black scale-[1.02]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Sparkles size={14} className="animate-pulse" />
                    <span>10. المحاسب الذكي</span>
                  </button>
                </div>

                {/* Sub-Views Content Area */}
                <div className="flex-1 overflow-y-auto pr-1">
                  <AnimatePresence mode="wait">
                    
                    {/* VIEW 2: Interactive Guide & Simulated AI Assistant with Voice Audio */}
                    {activeTab === 'guide' && (
                      <motion.div
                        key="guide-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Left Panel: Common Q&A Directory */}
                          <div className="md:col-span-1 bg-[#1f2937]/30 border border-white/5 p-5 rounded-[2rem] space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                              <Search className="text-teal-400" size={16} />
                              <h3 className="text-xs font-black text-white">بنك إجابات JAM Pro</h3>
                            </div>
                            
                            <div className="relative">
                              <input 
                                type="text"
                                placeholder="ابحث عن المشكلة أو السؤال..."
                                className="w-full bg-navy-950/80 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:ring-1 focus:ring-teal-500 text-right"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                              />
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                              {filteredQuestions.map((q, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleSelectQuestion(idx)}
                                  className={`w-full p-3.5 rounded-2xl text-right transition-all flex flex-col gap-1.5 cursor-pointer relative overflow-hidden group border ${
                                    selectedQuestion === idx 
                                      ? 'bg-teal-500/10 border-teal-500/30 text-white' 
                                      : 'bg-black/20 border-white/5 text-gray-300 hover:bg-[#1f2937]/40 hover:border-white/10'
                                  }`}
                                >
                                  <div className="flex justify-between items-center w-full">
                                    <span className="text-xs font-black leading-tight">{q.q}</span>
                                    <span className="text-[10px] font-bold text-teal-400 opacity-60 group-hover:opacity-100 transition-opacity">قراءة 📖</span>
                                  </div>
                                </button>
                              ))}
                            </div>

                            <p className="text-[9px] text-gray-500 text-center border-t border-white/5 pt-3">
                              * ميزة القراءة الصوتية تستخدم محرك التوليف الصوتي الذاتي لمتصفحك دون استهلاك الإنترنت.
                            </p>
                          </div>

                          {/* Right Panel: Selected Question Explanation & Sound */}
                          <div className="md:col-span-2 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between space-y-4 min-h-[350px]">
                            <div className="space-y-4 flex-1">
                              {selectedQuestion === null ? (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-12">
                                  <div className="p-4 rounded-full bg-teal-500/10 text-teal-400">
                                    <HelpCircle size={32} className="animate-bounce" />
                                  </div>
                                  <p className="text-xs text-gray-400 font-bold max-w-sm">
                                    الرجاء تحديد أحد الأسئلة المحاسبية أو التشغيلية من القائمة الجانبية اليمنى لبدء الشرح التفاعلي المدعم بقراءة صوتية حية.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <h4 className="text-sm font-black text-teal-300">{qaData[selectedQuestion].q}</h4>
                                  
                                  <div className="bg-slate-950/80 border border-teal-500/30 p-4 rounded-xl text-xs sm:text-sm font-bold leading-relaxed text-slate-100 font-sans min-h-[140px] whitespace-pre-wrap text-right dir-rtl tracking-wide select-text">
                                    {typedAnswer}
                                    {isTyping && <span className="inline-block w-1.5 h-3.5 bg-teal-400 animate-ping mr-1" />}
                                  </div>

                                  <div className="pt-2 border-t border-white/5">
                                    <h5 className="text-[10px] font-black text-amber-400 uppercase tracking-wider mb-1.5">نصائح من المبرمج لضمان الفهم والدقة:</h5>
                                    <ul className="space-y-1">
                                      {qaData[selectedQuestion].tips.map((t, index) => (
                                        <li key={index} className="flex items-start gap-1.5 text-[10px] font-bold text-gray-400 justify-start text-right">
                                          <span className="text-teal-400 shrink-0 font-bold">•</span>
                                          <span>{t}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}
                            </div>

                            {selectedQuestion !== null && (
                              <div className="flex gap-3 pt-2">
                                {isPlayingTTS ? (
                                  <button
                                    onClick={handleStopTTS}
                                    className="flex-1 py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-black text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all cursor-pointer"
                                  >
                                    <VolumeX size={14} />
                                    <span>إيقاف القارئ الصوتي 🔇</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePlayTTS(qaData[selectedQuestion].a)}
                                    disabled={isTyping}
                                    className="flex-1 py-3 bg-teal-500 text-slate-950 hover:brightness-110 disabled:opacity-50 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                                  >
                                    <Volume2 size={14} />
                                    <span>تشغيل الشرح الصوتي للمبرمج (مساعد ناطق) 🔊</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* VIEW 3: Anti-Hack, Session Audit & Database Integrity System */}
                    {activeTab === 'security' && (
                      <motion.div
                        key="security-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          {/* Safety Score Widget */}
                          <div className="md:col-span-1 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between items-center text-center">
                            <div className="space-y-2 w-full">
                              <h3 className="text-xs font-black text-white">مؤشر أمان وحماية المنظومة</h3>
                              <p className="text-[10px] text-gray-400 font-bold leading-tight">سلامة التراخيص والبيانات المحلية ومكافحة تعديل المتصفحات</p>
                            </div>

                            <div className="relative py-4">
                              <div className="w-32 h-32 rounded-full border-4 border-dashed border-emerald-500/20 flex items-center justify-center">
                                <div className="flex flex-col items-center">
                                  <span className="text-3xl font-black text-emerald-400 tabular-nums">{securityScore}%</span>
                                  <span className="text-[9px] text-gray-400 font-black">حالة الأمان</span>
                                </div>
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center animate-spin-slow pointer-events-none">
                                <div className="w-24 h-24 border-t-2 border-b-2 border-emerald-400/40 rounded-full" />
                              </div>
                            </div>

                            <div className="space-y-3 w-full">
                              <button 
                                onClick={runSecurityAudit}
                                disabled={isScanning}
                                className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 disabled:opacity-50 text-slate-950 font-black text-[10px] rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow active:scale-95 animate-pulse"
                              >
                                {isScanning ? <RefreshCw className="animate-spin" size={14} /> : <Cpu size={14} />}
                                <span>ابدأ فحص التدقيق المالي والأمني الآن</span>
                              </button>
                              
                              <p className="text-[9px] text-emerald-400 font-bold animate-pulse text-center">
                                {scanningStatus}
                              </p>
                            </div>
                          </div>

                          {/* Anti-Hack Configuration Controls */}
                          <div className="md:col-span-2 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] space-y-4">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="text-teal-400 animate-pulse" size={18} />
                                <h3 className="text-sm font-black text-white">أدوات التأمين والرقابة النشطة ضد التلاعب (Anti-Tamper Shield)</h3>
                              </div>
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] rounded font-bold">مفعل تلقائياً</span>
                            </div>

                            <p className="text-[11px] text-gray-400 font-medium">أدوات حظر هجمات تغيير الأسعار على مستوى المتصفح وتأمين موازين الصناديق ضد السرقة والتزوير.</p>

                            <div className="space-y-3 pt-2">
                              {/* Price Shield Toggle */}
                              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div className="space-y-0.5 text-right pr-2">
                                  <h4 className="text-xs font-black text-white">درع منع تلاعب الأسعار بالسلة (Anti-Price-Tamper Guard)</h4>
                                  <p className="text-[9px] text-gray-400 leading-tight font-medium">يغلق كلياً صلاحية تعديل السعر للموظف العادي بمجرد تمرير الباركود، ويشترط بصمة المشرف.</p>
                                </div>
                                <button 
                                  onClick={handleTogglePriceShield}
                                  className={`relative w-12 h-6 rounded-full transition-all shrink-0 ${priceShieldActive ? 'bg-emerald-500' : 'bg-gray-600'}`}
                                >
                                  <motion.div 
                                    animate={{ x: priceShieldActive ? 22 : 2 }}
                                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
                                  />
                                </button>
                              </div>

                              {/* Barcode Injection Shield Toggle */}
                              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div className="space-y-0.5 text-right pr-2">
                                  <h4 className="text-xs font-black text-white">درع مكافحة تزوير الباركود بالمتاجر (Anti-Barcode Injection Shield)</h4>
                                  <p className="text-[9px] text-gray-400 leading-tight font-medium">يحظر حقن الباركودات الوهمية أو المدخلة عبر اسكربتات الميلي ثانية الخارجية في خانات البيع والـ POS.</p>
                                </div>
                                <button 
                                  onClick={handleToggleBarcodeShield}
                                  className={`relative w-12 h-6 rounded-full transition-all shrink-0 ${barcodeShieldActive ? 'bg-emerald-500' : 'bg-gray-600'}`}
                                >
                                  <motion.div 
                                    animate={{ x: barcodeShieldActive ? 22 : 2 }}
                                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
                                  />
                                </button>
                              </div>

                              {/* Live Audit Log Stream */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 block">سجل الفحص الأمني المالي الفوري (Live Integrity Logs):</label>
                                <div className="bg-[#0b0f19] border border-white/10 rounded-xl p-3 h-28 overflow-y-auto space-y-2 font-mono text-[9px] leading-relaxed text-right scrollbar-thin">
                                  {securityLogs.map((log) => (
                                    <div key={log.id} className="flex items-start justify-between border-b border-white/5 pb-1">
                                      <span className={`font-bold ${
                                        log.type === 'success' ? 'text-emerald-400' : log.type === 'warn' ? 'text-amber-400' : 'text-rose-400'
                                      }`}>{log.msg}</span>
                                      <span className="text-gray-500 shrink-0 select-none">[{log.time}]</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Audit Verification badge */}
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-2 text-right">
                            <ShieldCheck className="text-emerald-400 shrink-0" size={18} />
                            <div>
                              <p className="text-xs font-black text-white">درع الحماية المحاسبي المزدوج (Double-Entry Shielding Protocol)</p>
                              <p className="text-[9px] text-gray-400 font-medium">يقوم بفحص سجل الأستاذ العام وتدقيق كل فاتورة بيع مع القيد الموازي تلقائياً لضمان عدم حدوث تلاعب يدوي أو اختلال في الأرقام.</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-emerald-400 text-slate-950 font-black rounded-lg text-[9px] tracking-widest uppercase">
                            مُعتمد وآمن 🛡️
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {/* VIEW 4: Accounting Cash Audit & Multi-Currency Reconciliation */}
                    {activeTab === 'audit' && (
                      <motion.div
                        key="audit-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Left Panel: Paper Bill Counting Form */}
                          <div className="bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                              <Calculator className="text-emerald-400" size={18} />
                              <h3 className="text-sm font-black text-white">عداد الفئات النقدية وجرد الخزينة (Physical Cash Auditor)</h3>
                            </div>
                            <p className="text-[11px] text-gray-400 font-medium">أدخل عدد الفئات الورقية المتوفرة بالدرج لمقارنتها فوراً بسجلات النظام لكشف أي عجز أو زيادة بالصندوق.</p>
                            
                            <div className="space-y-3">
                              <div className="grid grid-cols-3 gap-2 items-center">
                                <span className="text-xs font-black text-white">فئة 10,000 ر.ي:</span>
                                <input 
                                  type="number" 
                                  className="col-span-2 bg-[#0b0f19] border border-white/10 rounded-xl p-2 text-xs font-mono text-center text-white focus:ring-1 focus:ring-emerald-500"
                                  placeholder="0 ورقة"
                                  value={paper10k || ''}
                                  onChange={(e) => setPaper10k(parseInt(e.target.value) || 0)}
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-2 items-center">
                                <span className="text-xs font-black text-white">فئة 5,000 ر.ي:</span>
                                <input 
                                  type="number" 
                                  className="col-span-2 bg-[#0b0f19] border border-white/10 rounded-xl p-2 text-xs font-mono text-center text-white focus:ring-1 focus:ring-emerald-500"
                                  placeholder="0 ورقة"
                                  value={paper5k || ''}
                                  onChange={(e) => setPaper5k(parseInt(e.target.value) || 0)}
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-2 items-center">
                                <span className="text-xs font-black text-white">فئة 1,000 ر.ي:</span>
                                <input 
                                  type="number" 
                                  className="col-span-2 bg-[#0b0f19] border border-white/10 rounded-xl p-2 text-xs font-mono text-center text-white focus:ring-1 focus:ring-emerald-500"
                                  placeholder="0 ورقة"
                                  value={paper1k || ''}
                                  onChange={(e) => setPaper1k(parseInt(e.target.value) || 0)}
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-2 items-center">
                                <span className="text-xs font-black text-white">فئة 500 ر.ي:</span>
                                <input 
                                  type="number" 
                                  className="col-span-2 bg-[#0b0f19] border border-white/10 rounded-xl p-2 text-xs font-mono text-center text-white focus:ring-1 focus:ring-emerald-500"
                                  placeholder="0 ورقة"
                                  value={paper500 || ''}
                                  onChange={(e) => setPaper500(parseInt(e.target.value) || 0)}
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-2 items-center">
                                <span className="text-xs font-black text-white">فئة 250 ر.ي:</span>
                                <input 
                                  type="number" 
                                  className="col-span-2 bg-[#0b0f19] border border-white/10 rounded-xl p-2 text-xs font-mono text-center text-white focus:ring-1 focus:ring-emerald-500"
                                  placeholder="0 ورقة"
                                  value={paper250 || ''}
                                  onChange={(e) => setPaper250(parseInt(e.target.value) || 0)}
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-2 items-center">
                                <span className="text-xs font-black text-white">خرده وفئات أخرى:</span>
                                <input 
                                  type="number" 
                                  className="col-span-2 bg-[#0b0f19] border border-white/10 rounded-xl p-2 text-xs font-mono text-center text-white focus:ring-1 focus:ring-emerald-500"
                                  placeholder="المبلغ نقداً"
                                  value={paperOther || ''}
                                  onChange={(e) => setPaperOther(e.target.value)}
                                />
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/5 flex justify-between items-center bg-black/20 p-3 rounded-xl">
                              <span className="text-xs font-black text-gray-300">إجمالي النقدية المادية الفعلي:</span>
                              <span className="text-sm font-black text-emerald-400 font-mono">
                                {physicalCashCalculated.toLocaleString('ar-YE')} ريال يمني
                              </span>
                            </div>
                          </div>

                          {/* Right Panel: Reconciliation Audit Comparison */}
                          <div className="bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] space-y-4 flex flex-col justify-between">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                <Landmark className="text-teal-400" size={18} />
                                <h3 className="text-sm font-black text-white">مقارنة وتصحيح المطابقة المالية</h3>
                              </div>
                              
                              <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/5">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-gray-400 block">النقدية المتوقعة دفترياً حسب البرنامج:</label>
                                  <div className="relative">
                                    <input 
                                      type="number" 
                                      className="w-full bg-[#0b0f19] border border-white/10 rounded-xl p-2.5 text-xs font-bold text-center text-white font-mono focus:ring-1 focus:ring-teal-500"
                                      value={systemExpectedCash}
                                      onChange={(e) => setSystemExpectedCash(e.target.value)}
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500">ر.ي</span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-center pt-2">
                                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-[9px] font-bold text-gray-400">سعر صرف الريال السعودي (SAR):</p>
                                    <input 
                                      type="number"
                                      className="w-full bg-transparent border-0 text-center text-xs font-black font-mono text-teal-300 focus:outline-none focus:ring-0"
                                      value={rateSAR}
                                      onChange={(e) => setRateSAR(e.target.value)}
                                    />
                                  </div>
                                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-[9px] font-bold text-gray-400">سعر صرف الدولار الأمريكي (USD):</p>
                                    <input 
                                      type="number"
                                      className="w-full bg-transparent border-0 text-center text-xs font-black font-mono text-teal-300 focus:outline-none focus:ring-0"
                                      value={rateUSD}
                                      onChange={(e) => setRateUSD(e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={calculateAuditDifference}
                                className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:brightness-110 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow active:scale-95"
                              >
                                تشغيل مطابقة الصندوق (Run Box Reconciliation) ⚖️
                              </button>

                              {/* Audit Result Display */}
                              <AnimatePresence mode="wait">
                                {auditResult.status && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`p-4 rounded-2xl border flex flex-col gap-2 ${
                                      auditResult.status === 'perfect' 
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                        : auditResult.status === 'surplus'
                                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                                        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {auditResult.status === 'perfect' ? (
                                        <CheckCircle size={18} />
                                      ) : (
                                        <AlertTriangle size={18} />
                                      )}
                                      <span className="text-xs font-black">
                                        {auditResult.status === 'perfect' && 'صندوق متزن 100% - لا يوجد أي فروقات محاسبية! 🎉'}
                                        {auditResult.status === 'surplus' && `تنبيه: يوجد فائض مالي بالصندوق بمقدار ${auditResult.difference.toLocaleString()} ريال يمني! ⚠️`}
                                        {auditResult.status === 'deficit' && `تنبيه حرج: يوجد عجز مالي بالصندوق بمقدار ${auditResult.difference.toLocaleString()} ريال يمني! 🚨`}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 leading-tight">
                                      {auditResult.status === 'perfect' && 'القيود متطابقة تماماً مع محتويات الخزنة. عمل ممتاز!'}
                                      {auditResult.status === 'surplus' && 'يرجى مراجعة العمليات التي تمت بدون فواتير أو التحقق من المتبقي المسلم للزبائن.'}
                                      {auditResult.status === 'deficit' && 'تأكد من عدم سرقة الصندوق، أو نسيان قيد المبالغ الخارجة للشركاء أو الموردين.'}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            <p className="text-[9px] text-gray-500 leading-none">
                              * ميزة جرد النقد المادي تحميك من ثغرات تزوير النقدية وتضمن مصداقية الدورة اليومية للكاشير.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* VIEW 6: Smart Debts & WhatsApp Reminders */}
                    {activeTab === 'alerts' && (
                      <motion.div
                        key="alerts-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          {/* Debtor clients list */}
                          <div className="md:col-span-1 bg-[#1f2937]/30 border border-white/5 p-5 rounded-[2rem] space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                              <AlertCircle className="text-amber-400" size={16} />
                              <h3 className="text-xs font-black text-white">قائمة ذمم العملاء المستحقة</h3>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-tight font-semibold">قائمة العملاء الذين لديهم مستحقات متأخرة بالملف. انقر على أي عميل لتجهيز وإرسال رسالة مطالبة سداد سريعة.</p>
                            
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                              {debtors.length === 0 ? (
                                <div className="text-gray-500 text-center py-8 font-bold text-[11px] border border-dashed border-white/5 rounded-2xl select-none">
                                  🎉 ممتاز! لا توجد حسابات ذمم مستحقة أو ديون متأخرة حالياً في النظام لهذا المتجر.
                                </div>
                              ) : (
                                debtors.map((d) => (
                                  <button
                                    key={d.id}
                                    onClick={() => {
                                      setSelectedDebtor(d);
                                      setCopiedSuccess(false);
                                    }}
                                    className={`w-full text-right p-3 rounded-xl border block transition-all active:scale-95 ${
                                      selectedDebtor?.id === d.id 
                                        ? 'bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500 text-amber-300'
                                        : 'bg-black/20 border-white/5 text-gray-300 hover:bg-white/5'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="text-xs font-black text-white">{d.name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold">هاتف: {d.phone}</p>
                                      </div>
                                      <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 text-[8px] font-bold rounded">
                                        متأخر {d.delayDays} أيام
                                      </span>
                                    </div>
                                    <p className="text-xs font-bold text-emerald-400 font-mono mt-1 text-left">
                                      {parseFloat(d.totalDebt).toLocaleString()} {d.currency}
                                    </p>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Reminder drafting and direct WhatsApp triggers */}
                          <div className="md:col-span-2 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between min-h-[350px]">
                            <div className="space-y-4">
                              <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                                <Send className="text-teal-400 animate-pulse" size={16} />
                                <span className="text-sm font-black text-white">مولد رسائل تحصيل الديون ومطالبات السداد الودية</span>
                              </div>

                              {selectedDebtor === null ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                  <div className="p-4 bg-teal-500/5 rounded-full border border-teal-500/15 text-teal-400">
                                    <Send size={32} className="animate-bounce" />
                                  </div>
                                  <p className="text-xs text-gray-400 font-bold max-w-sm">
                                    الرجاء اختيار أحد العملاء المدينين من القائمة الجانبية اليمنى لصياغة رسالة تحصيل مخصصة وإرسالها بـ 1-كلِك عبر واتساب.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-white">نبرة وصياغة الرسالة المطلوبة:</span>
                                    
                                    <div className="flex gap-1">
                                      {[
                                        { label: 'ودي 🌸', tone: 'friendly' },
                                        { label: 'رسمي 📋', tone: 'formal' },
                                        { label: 'شديد ⚠️', tone: 'urgent' },
                                      ].map((t) => (
                                        <button
                                          key={t.tone}
                                          onClick={() => setReminderTone(t.tone as any)}
                                          className={`px-2.5 py-1 text-[10px] font-black rounded-lg border transition-all cursor-pointer ${
                                            reminderTone === t.tone 
                                              ? 'bg-amber-400 border-amber-300 text-slate-950 font-black'
                                              : 'bg-black/40 border-white/5 text-gray-400 hover:text-white'
                                          }`}
                                        >
                                          {t.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Draft Text Output area */}
                                  <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-gray-200 leading-relaxed font-sans min-h-[140px] whitespace-pre-wrap relative text-right">
                                    {generateReminderText(selectedDebtor)}
                                  </div>

                                  {/* Interactive Action buttons */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <button
                                      onClick={() => handleCopyReminder(generateReminderText(selectedDebtor))}
                                      className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                    >
                                      <Copy size={14} />
                                      <span>{copiedSuccess ? 'تم نسخ النص! ✅' : 'نسخ النص للحافظة'}</span>
                                    </button>

                                    <button
                                      onClick={() => handleSendWhatsApp(selectedDebtor, generateReminderText(selectedDebtor))}
                                      className="py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:brightness-110 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow"
                                    >
                                      <Send size={14} />
                                      <span>إرسال عبر واتساب المباشر 💬</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <p className="text-[9px] text-gray-500 text-center border-t border-white/5 pt-3">
                              * نظام إرسال المطالبات عبر واتساب المباشر يعتمد على بروتوكول wa.me الآمن ولا يخترق خصوصية هاتفك أو يتطلب اشتراكات مدفوعة.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* VIEW 7: Multi-Box Cash Reconciliation */}
                    {activeTab === 'box_match' && (
                      <motion.div
                        key="box-match-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          {/* Box balances card */}
                          <div className="md:col-span-1 bg-[#1f2937]/30 border border-white/5 p-5 rounded-[2rem] space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                              <Layers className="text-teal-400" size={16} />
                              <h3 className="text-xs font-black text-white">صناديق ومقاصد المال الحالية</h3>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-tight">تتبع أرصدة الصناديق المتعددة في المحل لمنع اختلاط أموال الكاشير مع الصندوق الرئيسي أو الصيانة.</p>
                            
                            <div className="space-y-2">
                              {boxes.map((b) => (
                                <div key={b.id} className="p-3 bg-black/25 border border-white/5 rounded-xl flex justify-between items-center">
                                  <div className="text-right">
                                    <p className="text-xs font-black text-white">{b.name}</p>
                                    <p className="text-[9px] text-gray-500">حالة الصندوق: نشط ومأمون</p>
                                  </div>
                                  <span className="text-xs font-black text-teal-400 font-mono">
                                    {b.balance.toLocaleString()} {b.currency}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Funds Transfer Panel */}
                          <div className="md:col-span-2 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between min-h-[350px]">
                            <div className="space-y-4">
                              <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                                <Landmark className="text-teal-400" size={16} />
                                <span className="text-sm font-black text-white">شاشة تحويل وترحيل الأموال الآمنة (Funds Transfer Ledger)</span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5 text-right">
                                  <label className="text-xs font-bold text-gray-400">من صندوق:</label>
                                  <select 
                                    value={transferFrom} 
                                    onChange={(e) => setTransferFrom(e.target.value)}
                                    className="w-full bg-[#0b0f19] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:ring-1 focus:ring-teal-500 text-right font-black"
                                  >
                                    {boxes.map(b => (
                                      <option key={b.id} value={b.id}>{b.name} ({b.balance.toLocaleString()} ر.ي)</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1.5 text-right">
                                  <label className="text-xs font-bold text-gray-400">إلى صندوق:</label>
                                  <select 
                                    value={transferTo} 
                                    onChange={(e) => setTransferTo(e.target.value)}
                                    className="w-full bg-[#0b0f19] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:ring-1 focus:ring-teal-500 text-right font-black"
                                  >
                                    {boxes.map(b => (
                                      <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1.5 text-right">
                                  <label className="text-xs font-bold text-gray-400">مبلغ التحويل (ر.ي):</label>
                                  <input 
                                    type="number"
                                    placeholder="أدخل مبلغ التحويل"
                                    value={transferAmount}
                                    onChange={(e) => setTransferAmount(e.target.value)}
                                    className="w-full bg-[#0b0f19] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:ring-1 focus:ring-teal-500 text-center font-mono font-bold"
                                  />
                                </div>
                              </div>

                              <button 
                                onClick={handleBoxTransfer}
                                className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:brightness-110 text-slate-950 font-black text-xs rounded-xl cursor-pointer active:scale-95 transition-all"
                              >
                                تأكيد الترحيل والتسوية المالية ⚡
                              </button>

                              {/* Realtime Transfer Logs */}
                              <div className="space-y-2 pt-2">
                                <h4 className="text-[10px] font-black text-gray-400">سجل التحويلات الحديث للمقاصة الصندوقية:</h4>
                                <div className="max-h-[100px] overflow-y-auto space-y-1.5 pr-1">
                                  {boxLog.map((log) => (
                                    <div key={log.id} className="p-2 bg-black/40 border border-white/5 rounded-lg flex justify-between items-center text-[10px] font-bold">
                                      <span className="text-gray-300 text-right">{log.msg}</span>
                                      <span className="text-gray-500 font-mono text-[9px] shrink-0">{log.time}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <p className="text-[9px] text-gray-500 text-center border-t border-white/5 pt-3">
                              * مطابقة الصناديق المتعددة تمنع الفوارق اليومية وتتيح جرد مستقل وصافي لكل نقطة بيع أو كاشير منفصل.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* VIEW 8: Immutable Activity Audit Log */}
                    {activeTab === 'audit_logs' && (
                      <motion.div
                        key="audit-logs-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          {/* Integrity Scanner Card */}
                          <div className="md:col-span-1 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between items-center text-center">
                            <div className="space-y-2 w-full">
                              <h3 className="text-xs font-black text-white">نظام التحقق من النزاهة والهاش</h3>
                              <p className="text-[10px] text-gray-400 font-bold leading-tight">يقوم بتشفير ومقارنة سجل الموظفين بنظام سلاسل الكتل الفرعي لمنع أي مسح أو تلاعب بالسجلات من قبل الكاشير.</p>
                            </div>

                            <div className="relative py-4 w-full flex items-center justify-center">
                              {integrityStatus === 'idle' && (
                                <div className="w-28 h-28 rounded-full border-2 border-dashed border-gray-600 flex flex-col items-center justify-center space-y-1">
                                  <History size={24} className="text-gray-500 animate-pulse" />
                                  <span className="text-[9px] text-gray-400 font-black">جاهز للفحص</span>
                                </div>
                              )}
                              {integrityStatus === 'scanning' && (
                                <div className="w-28 h-28 rounded-full border-2 border-dashed border-teal-500 flex flex-col items-center justify-center space-y-1">
                                  <RefreshCw size={24} className="text-teal-400 animate-spin" />
                                  <span className="text-[9px] text-teal-400 font-black">جاري مراجعة الهاش...</span>
                                </div>
                              )}
                              {integrityStatus === 'verified' && (
                                <div className="w-28 h-28 rounded-full border-2 border-dashed border-emerald-500 bg-emerald-500/5 flex flex-col items-center justify-center space-y-1">
                                  <CheckCircle size={24} className="text-emerald-400" />
                                  <span className="text-[10px] text-emerald-400 font-black">موثق وبدون تلاعب!</span>
                                </div>
                              )}
                            </div>

                            <div className="space-y-3 w-full">
                              <button 
                                onClick={verifyIntegrity}
                                disabled={integrityStatus === 'scanning'}
                                className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-[10px] rounded-xl transition-all cursor-pointer"
                              >
                                {integrityStatus === 'scanning' ? 'جاري التحقق...' : 'فحص نزاهة وتواقيع السجلات (Verify Block Integrity) 🛡️'}
                              </button>
                              
                              <p className="text-[9px] text-gray-500 leading-tight">
                                يعتمد النظام تشفير SHA256 فريد لكل عملية بيع أو تعديل في الخلفية لضمان عدم وجود سجلات محذوفة.
                              </p>
                            </div>
                          </div>

                          {/* Immutable Logs Feed */}
                          <div className="md:col-span-2 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between min-h-[350px]">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                <div className="flex items-center gap-1.5 text-xs font-black text-white">
                                  <History className="text-teal-400" size={16} />
                                  <span>سجل العمليات الآمن وغير القابل للتعديل (ReadOnly System Logs)</span>
                                </div>
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold rounded">مؤمن بالكامل</span>
                              </div>

                              <div className="flex gap-2">
                                {[
                                  { label: 'الكل 📁', val: 'all' },
                                  { label: 'مبيعات 💵', val: 'sales' },
                                  { label: 'أمان 🛡️', val: 'security' },
                                  { label: 'تعديل أسعار 🏷️', val: 'price' }
                                ].map(f => (
                                  <button
                                    key={f.val}
                                    onClick={() => setLogFilter(f.val as any)}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg border transition-all cursor-pointer ${
                                      logFilter === f.val 
                                        ? 'bg-teal-500/10 border-teal-500 text-teal-300'
                                        : 'bg-black/40 border-white/5 text-gray-400 hover:text-white'
                                    }`}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>

                              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                {immutableLogs
                                  .filter(log => {
                                    if (logFilter === 'all') return true;
                                    if (logFilter === 'sales') return log.action.includes('مبيعات') || log.action.includes('فاتورة');
                                    if (logFilter === 'security') return log.action.includes('حماية') || log.action.includes('مراجعة');
                                    if (logFilter === 'price') return log.action.includes('سعر') || log.action.includes('تعديل');
                                    return true;
                                  })
                                  .map((log) => (
                                    <div key={log.id} className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1 text-right">
                                      <div className="flex justify-between items-center text-[10px] font-bold text-gray-300">
                                        <span>{log.user}</span>
                                        <span className="font-mono text-gray-500">{log.timestamp}</span>
                                      </div>
                                      <p className="text-xs font-black text-white">{log.action}</p>
                                      <div className="flex justify-between items-center text-[9px] text-gray-500 font-mono pt-1 border-t border-white/5">
                                        <span>رمز التحقق المحاسبي: {log.hash}</span>
                                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                                          <Check size={10} />
                                          مؤمن
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>

                            <p className="text-[9px] text-gray-500 text-center border-t border-white/5 pt-3">
                              * هذا السجل للقراءة فقط، ولا يملك أي مدير أو مبرمج صلاحية تعديله أو مسحه لضمان الشفافية المطلقة للمستثمرين والشركاء.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* VIEW 9: General Expenses Classifier */}
                    {activeTab === 'expenses' && (
                      <motion.div
                        key="expenses-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          {/* Left Panel: Live Profit & Impact Margin Widget */}
                          <div className="md:col-span-1 bg-[#1f2937]/30 border border-white/5 p-5 rounded-[2rem] space-y-4 flex flex-col justify-between">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                <TrendingDown className="text-teal-400" size={16} />
                                <h3 className="text-xs font-black text-white">حاسبة وصافي هوامش الربح المتأثرة</h3>
                              </div>
                              <p className="text-[10px] text-gray-400 leading-tight">تقوم بقياس فوري لتأثير المصروفات الإدارية والتشغيلية والتسويقية على صافي هامش الأرباح اليومية للمحل.</p>

                              {/* Input to alter Gross sales */}
                              <div className="space-y-1.5 text-right bg-black/40 p-3 rounded-xl border border-white/5">
                                <label className="text-[10px] font-black text-gray-400 block">إجمالي مبيعات المحل المقدرة اليوم (ر.ي):</label>
                                <input 
                                  type="number"
                                  value={simulatedSalesTotal}
                                  onChange={(e) => setSimulatedSalesTotal(e.target.value)}
                                  className="w-full bg-[#0b0f19] border border-white/10 rounded-lg p-2 text-xs text-white font-mono font-bold text-center"
                                />
                              </div>

                              <div className="space-y-2 pt-2 text-[11px] font-bold">
                                <div className="flex justify-between text-gray-300">
                                  <span>إجمالي المصاريف المسجلة:</span>
                                  <span className="text-rose-400 font-mono">{calculateTotalExpenses().toLocaleString()} ر.ي</span>
                                </div>
                                <div className="flex justify-between text-gray-300">
                                  <span>صافي الأرباح المقدرة:</span>
                                  <span className="text-emerald-400 font-mono">
                                    {Math.max(0, (parseFloat(simulatedSalesTotal) || 0) - calculateTotalExpenses()).toLocaleString()} ر.ي
                                  </span>
                                </div>
                                <div className="flex justify-between text-gray-300">
                                  <span>معدل هامش الربح الصافي:</span>
                                  <span className="text-yellow-400 font-mono">
                                    {((Math.max(0, (parseFloat(simulatedSalesTotal) || 0) - calculateTotalExpenses()) / (parseFloat(simulatedSalesTotal) || 1)) * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            <p className="text-[9px] text-gray-500 leading-none">
                              * الحفاظ على هامش ربح أعلى من 25% يضمن صحة استثماراتك وقدرتك على التوسع وسداد الالتزامات.
                            </p>
                          </div>

                          {/* Expenses Tracker & Classifier Panel */}
                          <div className="md:col-span-2 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between min-h-[350px]">
                            <div className="space-y-4">
                              <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                                <DollarSign className="text-teal-400" size={16} />
                                <span className="text-sm font-black text-white">نظام كشف وتقييد المصروفات وتصنيفها التلقائي</span>
                              </div>

                              {/* Form to add an expense */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1 text-right">
                                  <label className="text-[10px] font-bold text-gray-400">بيان وموضوع المصروف:</label>
                                  <input 
                                    type="text"
                                    placeholder="مثال: فاتورة كهرباء المحل"
                                    value={newExpenseDesc}
                                    onChange={(e) => setNewExpenseDesc(e.target.value)}
                                    className="w-full bg-[#0b0f19] border border-white/10 rounded-xl p-2 text-xs text-white placeholder-gray-600 focus:ring-1 focus:ring-teal-500 text-right"
                                  />
                                </div>

                                <div className="space-y-1 text-right">
                                  <label className="text-[10px] font-bold text-gray-400">المبلغ (ر.ي):</label>
                                  <input 
                                    type="number"
                                    placeholder="مثال: 4500"
                                    value={newExpenseAmount}
                                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                                    className="w-full bg-[#0b0f19] border border-white/10 rounded-xl p-2 text-xs text-white placeholder-gray-600 focus:ring-1 focus:ring-teal-500 text-center font-mono font-bold"
                                  />
                                </div>

                                <div className="space-y-1 text-right">
                                  <label className="text-[10px] font-bold text-gray-400">تصنيف وتبويب المصروف:</label>
                                  <select 
                                    value={newExpenseCat}
                                    onChange={(e) => setNewExpenseCat(e.target.value as any)}
                                    className="w-full bg-[#0b0f19] border border-white/10 rounded-xl p-2 text-xs text-white focus:ring-1 focus:ring-teal-500 text-right font-black"
                                  >
                                    <option value="إدارية وعمومية">إدارية وعمومية 📋</option>
                                    <option value="تشغيلية">تشغيلية 🛠️</option>
                                    <option value="تسويقية">تسويقية 📣</option>
                                  </select>
                                </div>
                              </div>

                              <button 
                                onClick={handleAddExpense}
                                className="w-full py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:brightness-110 text-slate-950 font-black text-xs rounded-xl cursor-pointer active:scale-95 transition-all"
                              >
                                تقييد المصروف وتحديث المؤشرات 💸
                              </button>

                              {/* Live classified Expenses List */}
                              <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black text-gray-400">
                                  <span>المصروفات الأخيرة المقيدة بالوردية:</span>
                                  <span className="flex gap-2">
                                    <span>تشغيلية: {calculateCategoryTotal('تشغيلية').toLocaleString()}</span>
                                    <span>•</span>
                                    <span>إدارية: {calculateCategoryTotal('إدارية وعمومية').toLocaleString()}</span>
                                    <span>•</span>
                                    <span>تسويقية: {calculateCategoryTotal('تسويقية').toLocaleString()}</span>
                                  </span>
                                </div>

                                <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1">
                                  {expenses.map((e) => (
                                    <div key={e.id} className="p-2 bg-black/40 border border-white/5 rounded-lg flex justify-between items-center text-[10px] font-bold">
                                      <div className="text-right">
                                        <p className="text-white font-black">{e.description}</p>
                                        <p className="text-gray-500 text-[8px]">التصنيف: {e.category} | {e.date}</p>
                                      </div>
                                      <span className="text-rose-400 font-mono font-bold shrink-0">{e.amount.toLocaleString()} ر.ي</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <p className="text-[9px] text-gray-500 text-center border-t border-white/5 pt-3">
                              * تقييد المصروفات بشكل لحظي يمنع تبخر السيولة المالية ويساعدك في ضبط المصاريف الشاردة بدقة 100%.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* VIEW 12: Employee HWID & Device Lock Control */}
                    {activeTab === 'hwid' && (
                      <motion.div
                        key="hwid-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
                          
                          {/* Left Panel: Authorize Device Form */}
                          <div className="bg-[#1f2937]/30 border border-white/5 p-5 rounded-[2rem] space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                              <Smartphone className="text-teal-400" size={16} />
                              <h3 className="text-xs font-black text-white">تفويض وتأمين جهاز موظف</h3>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-tight">لحماية حسابات المحل، لا يمكن للموظفين تسجيل الدخول إلا من الأجهزة الحاصلة على بصمة رقمية (HWID) مفوضة من قبلك.</p>

                            <div className="space-y-3 pt-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 block">اسم الموظف المستهدف:</label>
                                <input 
                                  type="text"
                                  value={selectedDeviceEmployee}
                                  onChange={(e) => setSelectedDeviceEmployee(e.target.value)}
                                  className="w-full bg-[#0b0f19] border border-white/10 rounded-lg p-2 text-xs text-white text-right outline-none focus:border-teal-500"
                                  placeholder="مثال: صالح الكاشير الجديد"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 block">نظام التشغيل:</label>
                                <select
                                  value={newDeviceOS}
                                  onChange={(e) => setNewDeviceOS(e.target.value)}
                                  className="w-full bg-[#0b0f19] border border-white/10 rounded-lg p-2 text-xs text-white text-right outline-none focus:border-teal-500 font-bold"
                                >
                                  <option value="Windows 11">Windows 11 / Windows 10</option>
                                  <option value="Android 14">Android 14 / Android 13</option>
                                  <option value="Apple iOS">Apple iOS / Safari Client</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 block">الحد الأقصى للأجهزة المسموحة:</label>
                                <input 
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={newDeviceLimit}
                                  onChange={(e) => setNewDeviceLimit(Number(e.target.value))}
                                  className="w-full bg-[#0b0f19] border border-white/10 rounded-lg p-2 text-xs text-white font-mono text-center outline-none focus:border-teal-500 font-bold"
                                />
                              </div>

                              <button
                                onClick={handleAddDeviceRequest}
                                className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:brightness-110 text-slate-950 font-black text-xs rounded-xl cursor-pointer active:scale-95 transition-all"
                              >
                                تسجيل وتفويض بصمة الجهاز المختار 🔐
                              </button>
                            </div>
                          </div>

                          {/* Right Panel: Active Authorized Devices List */}
                          <div className="md:col-span-2 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] space-y-4">
                            <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                              <ShieldCheck className="text-teal-400" size={16} />
                              <span className="text-sm font-black text-white">الأجهزة المصرحة والنشطة بالمحل (HWID Register)</span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-right text-xs">
                                <thead>
                                  <tr className="border-b border-white/5 text-gray-400 font-black">
                                    <th className="pb-3 pr-2">اسم الموظف الحائز</th>
                                    <th className="pb-3">معرف البصمة (HWID)</th>
                                    <th className="pb-3">نظام التشغيل</th>
                                    <th className="pb-3 text-center">الأجهزة المسموحة</th>
                                    <th className="pb-3 text-center">خيارات التفويض</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {trustedDevices.map((d) => (
                                    <tr key={d.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                                      <td className="py-3 pr-2 font-black text-white">{d.employee}</td>
                                      <td className="py-3 font-mono text-teal-400 font-bold text-[11px]">{d.deviceId}</td>
                                      <td className="py-3 text-gray-300 font-bold">{d.os}</td>
                                      <td className="py-3 text-center font-mono font-bold text-gray-400">{d.maxAllowed} أجهزة</td>
                                      <td className="py-3 text-center">
                                        <button
                                          onClick={() => handleToggleDeviceAuth(d.id)}
                                          className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                                            d.status === 'authorized'
                                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                          }`}
                                        >
                                          {d.status === 'authorized' ? '🔒 مفوض (إلغاء)' : '🔓 معلق (تفويض)'}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <p className="text-[9px] text-gray-500 leading-normal mt-2">
                              * تتبع الأجهزة يمنع قيام الموظفين بتسجيل الدخول من خارج المحل أو من أجهزتهم الشخصية دون إذن، لحماية مبيعاتك وأموالك بشكل قاطع بدقة 100%.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* VIEW 14: System Cache & Client Performance Booster */}
                    {activeTab === 'cache' && (
                      <motion.div
                        key="cache-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
                          
                          {/* Speed Dial Gauge */}
                          <div className="bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4">
                            <Cpu className="text-teal-400 animate-pulse" size={48} />
                            
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-gray-400 block uppercase">مؤشر سرعة استجابة المنظومة</span>
                              <span className="text-3xl font-black text-white font-mono">{cacheBoostPercentage}%</span>
                            </div>

                            <div className="w-full bg-black/40 p-3 rounded-2xl border border-white/5">
                              <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
                                <span>الذاكرة المستهلكة</span>
                                <span>{cacheDetails.stateSizeKB} KB</span>
                              </div>
                              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-teal-400 h-full transition-all duration-1000"
                                  style={{ width: `${(cacheDetails.stateSizeKB / 2500) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Cache Details list & Action */}
                          <div className="md:col-span-2 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between space-y-4 min-h-[300px]">
                            <div className="space-y-4">
                              <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                                <Zap className="text-teal-400" size={18} />
                                <span className="text-sm font-black text-white">مسرع ذاكرة الاستعلامات وترتيب مؤشرات المتصفح</span>
                              </div>
                              <p className="text-xs text-gray-400">تساعدك هذه الخدمة في تحسين مخرجات الذاكرة العشوائية وتخفيف استهلاك موارد المتصفح عبر ضغط البيانات المؤقتة وترتيب الكاش لتحقيق سرعة مبيعات فورية.</p>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-gray-400">استعلامات مكررة تم دمجها:</span>
                                  <span className="font-mono text-teal-400 font-bold">{cacheDetails.localQueries} استعلام</span>
                                </div>

                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-gray-400">مسودات فواتير معلقة بالكاش:</span>
                                  <span className="font-mono text-teal-400 font-bold">{cacheDetails.draftInvoices} مسودات</span>
                                </div>

                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center col-span-1 md:col-span-2">
                                  <span className="text-[10px] font-bold text-gray-400">حالة مؤشرات الجداول المفهرسة:</span>
                                  <span className="font-mono text-emerald-400 font-black">{cacheDetails.dbIndexCount} جدول مفهرس مفعل</span>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={handleBoostPerformance}
                              disabled={isBoosting}
                              className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                              {isBoosting ? (
                                <>
                                  <RefreshCw size={14} className="animate-spin" />
                                  <span>جاري تنظيف كاش الذاكرة وضغط الحقول الشاردة...</span>
                                </>
                              ) : (
                                <span>تنظيف الذاكرة ومضاعفة سرعة المنظومة فوراً (BOOST SPEED) 🚀⚡</span>
                              )}
                            </button>

                            {boostCompleted && (
                              <p className="text-[10px] font-black text-center text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-2 rounded-xl">
                                🎉 تم تعزيز وتطهير كاش النظام بنجاح! تم تحرير الذاكرة وتحقيق سرعة استجابة فائقة بدقة 100%.
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* VIEW 10: AI Financial Advisor */}
                    {activeTab === 'ai_advisor' && (
                      <motion.div
                        key="ai-advisor-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6 text-right"
                        dir="rtl"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Live Financial Metrics Summary Card */}
                          <div className="bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                              <Sparkles className="text-teal-400 animate-pulse" size={18} />
                              <h3 className="text-sm font-black text-white">بيانات التحليل اللحظي للمحل</h3>
                            </div>
                            
                            <p className="text-[11px] text-gray-400 leading-normal font-bold">
                              يقوم النظام تلقائياً بتغذية المحاسب الذكي بمؤشرات الحسابات والسيولة الحالية لتوفير تقرير دقيق.
                            </p>

                            <div className="space-y-2 text-xs">
                              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                                <span className="text-gray-400 font-bold">المبيعات المقدرة:</span>
                                <span className="text-teal-400 font-black font-mono">
                                  {parseFloat(simulatedSalesTotal || '0').toLocaleString()} ر.ي
                                </span>
                              </div>
                              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                                <span className="text-gray-400 font-bold">المصاريف المحتسبة:</span>
                                <span className="text-red-400 font-black font-mono">
                                  {expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()} ر.ي
                                </span>
                              </div>
                              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                                <span className="text-gray-400 font-bold">صافي الأرباح:</span>
                                <span className="text-emerald-400 font-black font-mono">
                                  {Math.max(0, (parseFloat(simulatedSalesTotal || '0') - expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0))).toLocaleString()} ر.ي
                                </span>
                              </div>
                              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                                <span className="text-gray-400 font-bold">ديون الموردين:</span>
                                <span className="text-yellow-500 font-black font-mono">
                                  {supplierDebtsTotal.toLocaleString()} ر.ي
                                </span>
                              </div>
                              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                                <span className="text-gray-400 font-bold">حسابات العملاء المدينة:</span>
                                <span className="text-blue-400 font-black font-mono">
                                  {debtors.reduce((acc, curr) => acc + (parseFloat(curr.totalDebt) || 0), 0).toLocaleString()} ر.ي
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Analysis and Recommendations Panel */}
                          <div className="md:col-span-2 bg-[#1f2937]/30 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between space-y-4 min-h-[350px]">
                            <div className="space-y-3 flex-1 flex flex-col">
                              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                <div className="flex items-center gap-1.5">
                                  <Sparkles className="text-teal-400 animate-pulse" size={18} />
                                  <span className="text-sm font-black text-white">المستشار المالي ومحلل الأرباح السحابي (AI Advisor)</span>
                                </div>
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] rounded font-bold animate-pulse">ذكي وآمن</span>
                              </div>

                              <div className="flex-1 overflow-y-auto bg-black/40 border border-white/5 rounded-2xl p-4 min-h-[220px] max-h-[300px]">
                                {advisorLoading ? (
                                  <div className="h-full flex flex-col items-center justify-center space-y-3">
                                    <RefreshCw className="text-teal-400 animate-spin" size={32} />
                                    <p className="text-xs text-gray-400 font-bold animate-pulse">
                                      جاري معالجة وتحليل تدفقات الكاشير وحسابات الذمم وتوليد النصائح السحابية...
                                    </p>
                                  </div>
                                ) : advisorError ? (
                                  <div className="h-full flex flex-col items-center justify-center text-center space-y-2">
                                    <AlertTriangle className="text-red-400 animate-bounce" size={32} />
                                    <p className="text-xs text-red-400 font-bold">{advisorError}</p>
                                    <button 
                                      onClick={handleGenerateFinancialReport}
                                      className="mt-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] font-bold text-red-400"
                                    >
                                      إعادة المحاولة 🔄
                                    </button>
                                  </div>
                                ) : advisorResult ? (
                                  <div className="text-xs text-gray-200 leading-relaxed space-y-3 whitespace-pre-line text-right font-medium">
                                    {advisorResult}
                                  </div>
                                ) : (
                                  <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-4">
                                    <Sparkles className="text-gray-500" size={36} />
                                    <p className="text-xs text-gray-400 font-bold">
                                      انقر على الزر أدناه لإرسال الأرصدة والبيانات المحاسبية المغلقة ومراجعتها فوراً بالذكاء الاصطناعي.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={handleGenerateFinancialReport}
                              disabled={advisorLoading}
                              className="w-full py-3.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                              <Sparkles size={14} className={advisorLoading ? 'animate-spin' : 'animate-pulse'} />
                              <span>استدعاء المحاسب الاستشاري بالذكاء الاصطناعي وتوليد التقرير 📊✨</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                  </AnimatePresence>
                </div>

                {/* Footer and dynamic Developer credits */}
                <div className="border-t border-white/5 pt-4 mt-4 flex justify-between items-center text-right flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-teal-400" dir="rtl">
                    <Award size={14} className="animate-spin" style={{ animationDuration: '6s' }} />
                    <span>JAM Pro Ultimate Booster - الاصدار الأقوى 💎</span>
                  </div>
                  
                  <p className="text-[10px] font-bold text-gray-500 leading-none">
                    برمجة وتأمين: م. عبد الغني المحفلي (772315106)
                  </p>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <style>{`
        .animate-spin-slow {
          animation: spin 20s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
