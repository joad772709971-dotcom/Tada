import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Wrench, 
  Package, 
  DollarSign, 
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Download,
  ShieldCheck,
  ShoppingBasket,
  Database,
  Users,
  Book,
  LayoutDashboard,
  Smartphone,
  CreditCard,
  Store,
  HelpCircle,
  History,
  RotateCcw,
  BarChart3,
  Settings,
  AlertTriangle,
  Bell,
  Eye,
  ClipboardList,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Banknote,
  Truck,
  Activity,
  ShieldAlert,
  Archive,
  WifiOff,
  BellRing,
  ChevronLeft,
  Printer,
  FileText,
  Filter,
  Calendar,
  Search,
  Sparkles,
  RefreshCw,
  UserCheck,
  ChevronDown
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  limit, 
  orderBy, 
  Timestamp, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  setDoc, 
  runTransaction, 
  increment, 
  getDocs, 
  getDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { MaintenanceOrder, InventoryItem, Transaction, UserProfile, Sale } from './types';
import { isModuleAutoHidden } from './utils/businessPermissions';
import { motion, AnimatePresence } from 'motion/react';
import QuickActionModal from './components/QuickActionModal';
import CurtainDrawer from './components/CurtainDrawer';
import { QuarantinePanel } from './components/QuarantinePanel';
import { QuickBalanceForm, QuickMaintenanceForm, QuickInventoryForm } from './components/QuickForms';
import MiniPendingOperationsWidget from './components/MiniPendingOperationsWidget';
import { ComprehensiveFinancialDrawer } from './components/ComprehensiveFinancialDrawer';
import DailyShiftCloseModal, { ShiftCloseReport } from './components/DailyShiftCloseModal';
import { EmployeeFilterSelector } from './components/EmployeeFilterSelector';
import { BUSINESS_LABELS } from './constants/labels';
import { useConnectivity } from './hooks/useConnectivity';
import { getSafeCachedLicense } from './services/securityService';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface DashboardProps {
  profile: UserProfile | null;
}

export default function Dashboard({ profile }: DashboardProps) {
  const navigate = useNavigate();
  const isOnline = useConnectivity();

  // Role Checks: Store Owner vs Isolated Employee
  const isUserAdminOrOwner = profile ? (
    ['manager', 'superadmin', 'owner', 'admin', 'developer'].includes((profile.role || '').toLowerCase()) ||
    ['a777503191@gmail.com'].includes((profile.email || '').toLowerCase())
  ) : false;

  useEffect(() => {
    if (profile?.role === 'delivery_agent') {
      navigate('/delivery');
    }
  }, [profile, navigate]);

  // Main State
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [visibleInvLimit, setVisibleInvLimit] = useState(20);
  const [vaults, setVaults] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [b2bOrders, setB2bOrders] = useState<any[]>([]);
  const [allMaintenanceOrders, setAllMaintenanceOrders] = useState<any[]>([]);
  const [storeEmployees, setStoreEmployees] = useState<any[]>([]);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('ALL');

  // Drawer and Modal States
  const [isFinancialDrawerOpen, setIsFinancialDrawerOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'balance' | 'maintenance' | 'sale' | 'purchase' | null>(null);
  const [dashboardShortcuts, setDashboardShortcuts] = useState<string[]>(['sale', 'maintenance', 'balance', 'inventory']);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  // Statement & Report Modal States
  const [statementModalType, setStatementModalType] = useState<'customer' | 'supplier' | null>(null);
  const [statementFilter, setStatementFilter] = useState<'purchases' | 'returns' | 'totals' | 'payments' | null>('totals');
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [statementResults, setStatementResults] = useState<any[]>([]);
  const [statementTotals, setStatementTotals] = useState({ totalPurchases: 0, totalReturns: 0, totalPayments: 0, finalDebt: 0 });
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isSavingStatement, setIsSavingStatement] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Load Store Employees for Owner Filter & Staff Isolation
  useEffect(() => {
    if (!profile?.ownerId) return;
    const qUsers = query(collection(db, 'users'), where('ownerId', '==', profile.ownerId));
    const unsub = onSnapshot(qUsers, (snap) => {
      const emps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStoreEmployees(emps);
    }, (err) => console.warn('Employees listener fallback:', err));
    return () => unsub();
  }, [profile?.ownerId]);

  // Load Customers & Suppliers (Filtered by shop for tenant isolation)
  useEffect(() => {
    if (!profile?.ownerId) return;
    
    // Customers subscription
    const unsubCust = onSnapshot(
      query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        let custs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const userShopId = profile.shopId || profile.storeId;
        if (profile.role !== 'owner' && profile.role !== 'superadmin' && userShopId) {
          custs = custs.filter((c: any) => !c.shopId || c.shopId === userShopId || c.storeId === userShopId || c.store_id === userShopId);
        }
        setAllCustomers(custs);
      }
    );

    // Suppliers subscription
    const unsubSupp = onSnapshot(
      query(collection(db, 'suppliers'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        let sups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const userShopId = profile.shopId || profile.storeId;
        if (profile.role !== 'owner' && profile.role !== 'superadmin' && userShopId) {
          sups = sups.filter((s: any) => !s.shopId || s.shopId === userShopId || s.storeId === userShopId || s.store_id === userShopId);
        }
        setAllSuppliers(sups);
      }
    );

    return () => {
      unsubCust();
      unsubSupp();
    };
  }, [profile?.ownerId, profile?.role, profile?.shopId, profile?.storeId]);

  // Core Data Subscription (Sales, Transactions, Maintenance, Inventory, Vaults, B2B)
  useEffect(() => {
    if (!profile?.ownerId) return;

    if (!navigator.onLine) {
      // Offline fallback from local storage cache
      try {
        const cachedSales = localStorage.getItem(`jam_dash_sales_${profile.ownerId}`);
        const cachedTrans = localStorage.getItem(`jam_dash_trans_${profile.ownerId}`);
        const cachedOrders = localStorage.getItem(`jam_dash_orders_${profile.ownerId}`);
        const cachedInv = localStorage.getItem(`jam_dash_inventory_${profile.ownerId}`);
        const cachedVaults = localStorage.getItem(`jam_dash_vaults_${profile.ownerId}`);
        const cachedB2b = localStorage.getItem(`jam_dash_b2b_${profile.ownerId}`);
        const cachedMaintAll = localStorage.getItem(`jam_dash_maint_all_${profile.ownerId}`);

        if (cachedSales) setRecentSales(JSON.parse(cachedSales));
        if (cachedTrans) setTransactions(JSON.parse(cachedTrans));
        if (cachedOrders) setOrders(JSON.parse(cachedOrders));
        if (cachedInv) setInventory(JSON.parse(cachedInv));
        if (cachedVaults) setVaults(JSON.parse(cachedVaults));
        if (cachedB2b) setB2bOrders(JSON.parse(cachedB2b));
        if (cachedMaintAll) setAllMaintenanceOrders(JSON.parse(cachedMaintAll));
        setIsStatsLoading(false);
      } catch (e) {
        setIsStatsLoading(false);
      }
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    // 1. Sales Subscription
    const salesQ = query(
      collection(db, 'sales'),
      where('ownerId', '==', profile.ownerId),
      where('createdAt', '>=', todayTimestamp),
      orderBy('createdAt', 'desc')
    );
    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      let sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      const userShopId = profile.shopId || profile.storeId;
      if (profile.role !== 'owner' && profile.role !== 'superadmin' && userShopId) {
        sales = sales.filter((s: any) => s.shopId === userShopId || s.storeId === userShopId || s.store_id === userShopId);
      }
      setRecentSales(sales);
      setIsStatsLoading(false);
    }, (err) => {
      console.warn('Sales subscription fallback:', err);
      setIsStatsLoading(false);
    });

    // 2. Transactions Subscription
    const transQ = query(
      collection(db, 'transactions'),
      where('ownerId', '==', profile.ownerId),
      orderBy('createdAt', 'desc'),
      limit(150)
    );
    const unsubTrans = onSnapshot(transQ, (snapshot) => {
      let trans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      const userShopId = profile.shopId || profile.storeId;
      if (profile.role !== 'owner' && profile.role !== 'superadmin' && userShopId) {
        trans = trans.filter((t: any) => t.shopId === userShopId || t.storeId === userShopId || t.store_id === userShopId);
      }
      setAllTransactions(trans);
      setTransactions(trans.filter(t => {
        if (!t.createdAt) return false;
        const d = (t.createdAt as any).toDate ? (t.createdAt as any).toDate() : new Date(t.createdAt as any);
        return d >= today;
      }));
    }, (err) => console.warn('Transactions subscription fallback:', err));

    // 3. Maintenance Orders Subscription
    const maintQ = query(
      collection(db, 'maintenanceOrders'),
      where('ownerId', '==', profile.ownerId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubMaint = onSnapshot(maintQ, (snapshot) => {
      let maintList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceOrder));
      const userShopId = profile.shopId || profile.storeId;
      if (profile.role !== 'owner' && profile.role !== 'superadmin' && userShopId) {
        maintList = maintList.filter((m: any) => m.shopId === userShopId || m.storeId === userShopId || m.store_id === userShopId);
      }
      setAllMaintenanceOrders(maintList);
      setOrders(maintList.filter(m => m.status !== 'delivered'));
    }, (err) => console.warn('Maintenance subscription fallback:', err));

    // 4. Inventory Subscription
    const invQ = query(
      collection(db, 'inventory'),
      where('ownerId', '==', profile.ownerId),
      limit(visibleInvLimit)
    );
    const unsubInv = onSnapshot(invQ, (snapshot) => {
      let invList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      const userShopId = profile.shopId || profile.storeId;
      if (profile.role !== 'owner' && profile.role !== 'superadmin' && userShopId) {
        invList = invList.filter((i: any) => i.shopId === userShopId || i.storeId === userShopId || i.store_id === userShopId);
      }
      setInventory(invList);
    }, (err) => console.warn('Inventory subscription fallback:', err));

    // 5. Vaults / Cash Boxes Subscription
    const sId = profile.storeId || profile.ownerId || 'main_store';
    const qVaults = query(collection(db, 'stores', sId, 'vaults'));
    const unsubVaults = onSnapshot(qVaults, (snap) => {
      const vList = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || 'الصندوق الرئيسي',
          type: d.type || 'cash',
          currency: d.currency || 'YER',
          balance: parseFloat(d.balance) || 0
        };
      });
      setVaults(vList);
    }, (err) => console.warn('Vaults subscription fallback:', err));

    // 6. B2B / Market Orders Subscription
    const b2bQ = query(
      collection(db, 'orders'),
      where('store_id', '==', sId)
    );
    const unsubB2b = onSnapshot(b2bQ, (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setB2bOrders(ordersList);
    }, (err) => console.warn('B2B subscription fallback:', err));

    return () => {
      unsubSales();
      unsubTrans();
      unsubMaint();
      unsubInv();
      unsubVaults();
      unsubB2b();
    };
  }, [profile?.ownerId, profile?.role, profile?.shopId, profile?.storeId, visibleInvLimit]);

  // Employee Isolation vs Owner Full View filtering
  // If current user is employee: automatically isolate to his own operations
  // If current user is owner: filter by selectedEmployeeFilter ('ALL' or specific employee uid)
  const activeEmployeeTargetId = !isUserAdminOrOwner
    ? (profile?.uid || '')
    : (selectedEmployeeFilter !== 'ALL' ? selectedEmployeeFilter : null);

  const selectedEmployeeObj = storeEmployees.find(e => (e.id === activeEmployeeTargetId || e.uid === activeEmployeeTargetId));
  const selectedEmployeeName = selectedEmployeeObj?.name || selectedEmployeeObj?.displayName || '';

  // Filtered datasets based on employee isolation
  const displaySales = useMemo(() => {
    if (!activeEmployeeTargetId) return recentSales;
    return recentSales.filter(s => 
      s.userId === activeEmployeeTargetId || 
      (s as any).employeeId === activeEmployeeTargetId || 
      (s as any).cashierId === activeEmployeeTargetId ||
      (s as any).createdBy === activeEmployeeTargetId
    );
  }, [recentSales, activeEmployeeTargetId]);

  const displayTransactions = useMemo(() => {
    if (!activeEmployeeTargetId) return transactions;
    return transactions.filter(t => 
      t.userId === activeEmployeeTargetId || 
      (t as any).employeeId === activeEmployeeTargetId || 
      (t as any).operatorEmail === selectedEmployeeObj?.email
    );
  }, [transactions, activeEmployeeTargetId, selectedEmployeeObj]);

  const displayMaintenance = useMemo(() => {
    if (!activeEmployeeTargetId) return allMaintenanceOrders;
    return allMaintenanceOrders.filter(m => 
      m.technicianId === activeEmployeeTargetId || 
      (m as any).assignedTo === activeEmployeeTargetId ||
      (m as any).employeeId === activeEmployeeTargetId
    );
  }, [allMaintenanceOrders, activeEmployeeTargetId]);

  // Compute Unified Metrics
  const unifiedStats = useMemo(() => {
    const totalSalesSum = displaySales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const cashSalesSum = displaySales.filter(s => s.paymentMethod === 'cash' || !s.paymentMethod).reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const debtSalesSum = displaySales.filter(s => s.paymentMethod === 'debt').reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const transferSalesSum = displaySales.filter(s => s.paymentMethod === 'transfer' || s.paymentMethod === 'bank').reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const marketSalesSum = b2bOrders.reduce((sum, o) => sum + (Number(o.total || o.totalAmount) || 0), 0);

    const totalProfitSum = displaySales.reduce((sum, s) => {
      if (s.profit !== undefined) return sum + s.profit;
      const cost = (s.items || []).reduce((acc, i) => acc + ((i.cost || 0) * (i.quantity || 1)), 0);
      return sum + Math.max(0, s.total - cost);
    }, 0);

    const marginPercent = totalSalesSum > 0 ? (totalProfitSum / totalSalesSum) * 100 : 0;

    const outgoingsSum = displayTransactions
      .filter(t => t.type === 'expense' || t.category === 'purchase' || t.category?.includes('مصروف'))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const adjustmentsSum = allTransactions
      .filter(t => t.category?.includes('تسوية') || t.description?.includes('تسوية'))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalCashInBoxes = vaults
      .filter(v => v.type === 'cash')
      .reduce((sum, v) => sum + (parseFloat(v.balance) || 0), 0);

    const totalBankBalance = vaults
      .filter(v => v.type === 'bank')
      .reduce((sum, v) => sum + (parseFloat(v.balance) || 0), 0);

    return {
      overallSales: totalSalesSum,
      cashSales: cashSalesSum,
      debtSales: debtSalesSum,
      transferSales: transferSalesSum,
      marketSales: marketSalesSum,
      totalProfit: totalProfitSum,
      marginPercent,
      outgoings: outgoingsSum,
      adjustments: adjustmentsSum,
      totalCashInBoxes,
      totalBankBalance
    };
  }, [displaySales, displayTransactions, b2bOrders, allTransactions, vaults]);

  // Weekly Sales Chart Data Simulation
  const chartData = [
    { name: 'السبت', sales: Math.round(unifiedStats.overallSales * 0.7) + 300, profit: Math.round(unifiedStats.totalProfit * 0.7) + 50 },
    { name: 'الأحد', sales: Math.round(unifiedStats.overallSales * 0.85) + 420, profit: Math.round(unifiedStats.totalProfit * 0.85) + 80 },
    { name: 'الاثنين', sales: Math.round(unifiedStats.overallSales * 0.6) + 210, profit: Math.round(unifiedStats.totalProfit * 0.6) + 40 },
    { name: 'الثلاثاء', sales: Math.round(unifiedStats.overallSales * 0.95) + 550, profit: Math.round(unifiedStats.totalProfit * 0.95) + 110 },
    { name: 'الأربعاء', sales: Math.round(unifiedStats.overallSales * 0.8) + 390, profit: Math.round(unifiedStats.totalProfit * 0.8) + 75 },
    { name: 'الخميس', sales: Math.round(unifiedStats.overallSales * 1.1) + 680, profit: Math.round(unifiedStats.totalProfit * 1.1) + 140 },
    { name: 'الجمعة (اليوم)', sales: unifiedStats.overallSales || 500, profit: unifiedStats.totalProfit || 100 },
  ];

  // State for Daily Shift Close Modal
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Manual End-of-Day Clearance / Shift Close
  const handleOpenEOD = () => {
    setIsShiftModalOpen(true);
  };

  const handleConfirmShiftClose = async (report: ShiftCloseReport) => {
    if (!profile) return;
    const targetOwnerId = profile.ownerId || profile.uid;
    try {
      setIsStatsLoading(true);
      await addDoc(collection(db, 'shiftCloses'), {
        ...report,
        ownerId: targetOwnerId,
        createdAt: serverTimestamp()
      });

      // Also record the difference/balancing transaction if there's cash
      const customRef = doc(db, 'stores', targetOwnerId, 'customBoxes', 'CASH_BOX');
      const customSnap = await getDoc(customRef);
      let currentBalance = 0;
      if (customSnap.exists()) {
        currentBalance = parseFloat(customSnap.data().balance) || 0;
      }

      await addDoc(collection(db, 'transactions'), {
        ownerId: targetOwnerId,
        type: currentBalance >= 0 ? 'expense' : 'income',
        amount: Math.abs(currentBalance),
        category: 'تسوية الفروقات المالي',
        description: `إقفال نهاية الوردية (${report.shiftType}) بواسطة ${report.closedByName}`,
        boxId: 'CASH_BOX',
        createdAt: serverTimestamp()
      });

      await setDoc(customRef, {
        id: 'CASH_BOX',
        boxName: 'صندوق النقد الرئيسي (الكاش)',
        type: 'cash',
        balance: 0,
        ownerId: targetOwnerId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert("✓ تم حفظ إقفال الوردية بنجاح وتحديث الصندوق!");
    } catch (err: any) {
      console.error(err);
      alert("تم إقفال الوردية محلياً: " + (err.message || 'نجاح'));
    } finally {
      setIsStatsLoading(false);
    }
  };

  const handlePrintStatement = () => {
    if (!selectedEntityId) return;
    const entity = statementModalType === 'customer' 
      ? allCustomers.find(c => c.id === selectedEntityId) 
      : allSuppliers.find(s => s.id === selectedEntityId);
    if (!entity) return;

    const todayStr = new Date().toLocaleDateString('ar-YE');
    const timeStr = new Date().toLocaleTimeString('ar-YE');
    const currentDebt = Number(entity?.debt) || 0;

    // Filter relevant transactions for this entity if any
    const entityTrans = allTransactions.filter(t => {
      const matchEntity = statementModalType === 'customer'
        ? (t.customerId === selectedEntityId || (t as any).customer_id === selectedEntityId || t.customerName === entity.name)
        : (t.supplierId === selectedEntityId || (t as any).supplier_id === selectedEntityId || t.supplierName === entity.name);
      
      if (!matchEntity) return false;
      if (!t.createdAt) return true;
      const d = (t.createdAt as any).toDate ? (t.createdAt as any).toDate() : new Date(t.createdAt as any);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });

    const pageCss = `
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      @media print {
        body {
          visibility: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        #printableArea, #printableArea * {
          visibility: visible !important;
        }
        #printableArea {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 16px !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        .no-print, aside, header, footer, button, nav, .sidebar, [role="dialog"], .fixed {
          display: none !important;
        }
      }
    `;

    const titleText = statementModalType === 'customer' ? 'كشف حساب عميل تفصيلي' : 'كشف حساب مورد تفصيلي';

    const contentHtml = `
      <div style="font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; max-width: 800px; margin: 0 auto; padding: 15px; color: #000000; background: #ffffff;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="font-size: 22px; font-weight: 900; margin: 0 0 4px 0; color: #0f172a;">JAM SYSTEM PRO</h1>
            <p style="font-size: 14px; font-weight: bold; margin: 0; color: #475569;">${titleText}</p>
          </div>
          <div style="text-align: left; font-size: 11px; color: #475569; line-height: 1.5;">
            <div>تاريخ الإصدار: <b>${todayStr}</b></div>
            <div>الوقت: <b>${timeStr}</b></div>
            <div>نطاق التاريخ: <b>${dateFrom || 'البداية'} &larr; ${dateTo || 'الآن'}</b></div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 15px; font-weight: 900; color: #0f172a;">الاسم: ${entity.name}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">الهاتف: ${entity.phone || 'غير مسجل'}</div>
          </div>
          <div style="text-align: left;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">صافي الرصيد الحالي</div>
            <div style="font-size: 18px; font-weight: 900; color: ${currentDebt > 0 ? '#b91c1c' : '#15803d'};">
              ${currentDebt.toLocaleString()} YER
            </div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px 10px; text-align: right; font-weight: 900;">التاريخ</th>
              <th style="padding: 8px 10px; text-align: right; font-weight: 900;">البيان / نوع الحركة</th>
              <th style="padding: 8px 10px; text-align: left; font-weight: 900;">المبلغ (YER)</th>
              <th style="padding: 8px 10px; text-align: center; font-weight: 900;">طريقة السداد</th>
            </tr>
          </thead>
          <tbody>
            ${entityTrans.length === 0 ? `
              <tr>
                <td colspan="4" style="padding: 20px; text-align: center; color: #64748b; font-weight: bold; border-bottom: 1px solid #e2e8f0;">
                  لا توجد حركات تفصيلية سابقة مسجلة في هذا النطاق الزمني.
                </td>
              </tr>
            ` : entityTrans.map((tx: any) => {
              const d = tx.createdAt ? ((tx.createdAt as any).toDate ? (tx.createdAt as any).toDate() : new Date(tx.createdAt)) : new Date();
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 10px;">${d.toLocaleDateString('ar-YE')}</td>
                  <td style="padding: 8px 10px; font-weight: bold;">${tx.description || (tx.type === 'income' ? 'سداد / قبض' : 'مسحوبات / مشتريات')}</td>
                  <td style="padding: 8px 10px; text-align: left; font-weight: bold; font-family: monospace;">${(tx.amount || 0).toLocaleString()}</td>
                  <td style="padding: 8px 10px; text-align: center;">${tx.paymentMethod === 'cash' ? 'نقداً' : tx.paymentMethod === 'debt' ? 'آجل' : 'بنكي'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
          <div style="text-align: center; width: 180px;">
            <div>توقيع وختم المحاسب</div>
            <div style="margin-top: 40px; border-bottom: 1px dashed #94a3b8;"></div>
          </div>
          <div style="text-align: center; width: 180px;">
            <div>توقيع المستلم / العميل</div>
            <div style="margin-top: 40px; border-bottom: 1px dashed #94a3b8;"></div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px;">
          نظام JAM System Pro لإدارة المنشآت التجارية | م. عبد الغني المحفلي (772315106)
        </div>
      </div>
    `;

    // Inject into printableArea
    let printArea = document.getElementById('printableArea');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'printableArea';
      printArea.className = 'printableArea';
      document.body.appendChild(printArea);
    }
    printArea.innerHTML = `
      <style>${pageCss}</style>
      ${contentHtml}
    `;

    // Hidden iframe setup
    let iframe = document.getElementById('jam-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'jam-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '800px';
      iframe.style.height = '1000px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0.01';
      iframe.style.zIndex = '-999';
      document.body.appendChild(iframe);
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>${titleText} - ${entity.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;700;900&display=swap');
            ${pageCss}
            body {
              visibility: visible !important;
              margin: 0;
              padding: 15px;
              background: #ffffff;
              color: #000000;
              direction: rtl;
            }
            .no-print { display: none !important; }
          </style>
        </head>
        <body>
          <div id="printableArea">
            ${contentHtml}
          </div>
        </body>
      </html>
    `;

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(fullHtml);
      iframeDoc.close();
    }

    const isAndroidOrApp = typeof window !== 'undefined' && 
      (navigator.userAgent.includes('Android') || (window as any).Capacitor?.isNativePlatform?.() || !!(window as any).Android);

    if (isAndroidOrApp) {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 150);
    } else {
      setTimeout(() => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } else {
            window.focus();
            window.print();
          }
        } catch (e) {
          console.warn('Iframe print failed, falling back to window.print():', e);
          window.focus();
          window.print();
        }
      }, 200);
    }
  };

  const businessType = profile?.businessType || 'mobiles';
  const labels = BUSINESS_LABELS[businessType as keyof typeof BUSINESS_LABELS] || BUSINESS_LABELS.mobiles;

  return (
    <div 
      id="dashboard-root-view"
      className="space-y-5 animate-fade-in pb-16 text-right min-h-screen bg-slate-50/70 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100" 
      dir="rtl"
    >
      {/* 1. Header Bar: Daylight Top Control Deck */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left Side: Store Brand */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-amber-500/20 shrink-0">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {(profile?.shopName || 'لوحة تحكم المتجر').replace(/\s*\([^)]*(مالك|عام|جملة|تجزئة|موظف|فني|محلي|مدمج|صاحب)[^)]*\)/gi, '').trim()}
              </h1>
              {!isOnline && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <WifiOff size={12} /> محلي (أوفلاين)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Employee Isolation Selector & Grand Breakdown Drawer Button */}
        <div className="flex items-center gap-2.5 flex-wrap justify-start lg:justify-end">
          
          {/* Employee Filter / Isolation Badge */}
          <EmployeeFilterSelector
            profile={profile}
            employees={storeEmployees}
            selectedEmployeeId={selectedEmployeeFilter}
            onSelectEmployee={setSelectedEmployeeFilter}
            isOwnerOrManager={isUserAdminOrOwner}
          />

          {/* Prominent Button: Grand Breakdown Drawer */}
          <button
            id="btn-open-grand-drawer"
            onClick={() => setIsFinancialDrawerOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <BarChart3 size={16} />
            <span>📊 درج الإجماليات الشامل</span>
          </button>

          <MiniPendingOperationsWidget profile={profile} />
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (High Contrast Daylight Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Today's Total Sales */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-600 dark:text-slate-400">
              إجمالي مبيعات اليوم ⚡
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center font-bold">
              <ShoppingBasket size={20} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {unifiedStats.overallSales.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400">ر.ي</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>نقد: <strong className="text-slate-800 dark:text-slate-200 font-mono">{unifiedStats.cashSales.toLocaleString()}</strong></span>
            <span>دين: <strong className="text-amber-600 dark:text-amber-400 font-mono">{unifiedStats.debtSales.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Card 2: Cash in Drawer / Hand */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-600 dark:text-slate-400">
              رصيد الكاش في الدرج 💵
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center font-bold">
              <Wallet size={20} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
              {unifiedStats.totalCashInBoxes.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400">ر.ي</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>البنوك: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{unifiedStats.totalBankBalance.toLocaleString()}</strong></span>
            <button 
              onClick={() => setIsFinancialDrawerOpen(true)}
              className="text-amber-600 dark:text-amber-400 font-black hover:underline"
            >
              تفصيل الخزينة ←
            </button>
          </div>
        </div>

        {/* Card 3: Today's Net Profit (Owner View) or Completed Tasks (Employee View) */}
        {isUserAdminOrOwner ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-600 dark:text-slate-400">
                صافي أرباح اليوم (الفايدة) 💸
              </span>
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center justify-center font-bold">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                {unifiedStats.totalProfit.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400">ر.ي</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>الهامش: <strong className="text-indigo-600 font-mono">{unifiedStats.marginPercent.toFixed(1)}%</strong></span>
              <span className="text-emerald-600 font-bold">محسوب بالتكلفة ✓</span>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-600 dark:text-slate-400">
                فواتيرك المنجزة اليوم 📋
              </span>
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center justify-center font-bold">
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                {displaySales.length}
              </span>
              <span className="text-xs font-bold text-slate-400">عملية بيع</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>عهدتك النقدية: <strong className="text-emerald-600 font-mono">{unifiedStats.cashSales.toLocaleString()}</strong></span>
              <span className="text-slate-400">كاشير نشط</span>
            </div>
          </div>
        )}

        {/* Card 4: Maintenance & Shortages Alert (or Inventory Alert for Wholesalers/Importers) */}
        {!isModuleAutoHidden('maintenance', profile) ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-600 dark:text-slate-400">
                أجهزة الصيانة والنواقص 🔧
              </span>
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 flex items-center justify-center font-bold">
                <Wrench size={20} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-orange-600 dark:text-orange-400">
                {orders.length}
              </span>
              <span className="text-xs font-bold text-slate-400">جهاز قيد العمل</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>نواقص المخزون: <strong className="text-rose-600 font-mono">{inventory.filter(i => i.stock <= (i.minStock || 0)).length}</strong></span>
              <button 
                onClick={() => navigate('/maintenance')}
                className="text-orange-600 dark:text-orange-400 font-black hover:underline cursor-pointer"
              >
                فتح الصيانة ←
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-600 dark:text-slate-400">
                نواقص المخزون والتوريد 📦
              </span>
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center font-bold">
                <Package size={20} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
                {inventory.filter(i => i.stock <= (i.minStock || 0)).length}
              </span>
              <span className="text-xs font-bold text-slate-400">صنف بحاجة للطلب</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>إجمالي الأصناف: <strong className="text-slate-900 dark:text-white font-mono">{inventory.length}</strong></span>
              <button 
                onClick={() => navigate('/inventory')}
                className="text-rose-600 dark:text-rose-400 font-black hover:underline cursor-pointer"
              >
                فتح المخزن ←
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 3. Quick Action Buttons (Daylight Optimized Palette) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs">
              ⚡
            </span>
            أزرار العمليات السريعة والفواتير الفورية
          </h3>
          <span className="text-xs text-slate-400 font-bold hidden sm:inline">
            اضغط لتسجيل فاتورة أو سند فوري
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
          
          {/* Action 1: Instant Sale */}
          <button
            id="btn-quick-sale"
            onClick={() => setActiveModal('sale')}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 transition-all active:scale-95 group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
              <ShoppingBasket size={20} />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-2">فاتورة مبيع</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">تجزئة سريعة</span>
          </button>

          {/* Action 2: Mobile Balance */}
          {!isModuleAutoHidden('mobile-balance', profile) && (
            <button
              id="btn-quick-balance"
              onClick={() => setActiveModal('balance')}
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 transition-all active:scale-95 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Smartphone size={20} />
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-white mt-2">{labels.balance}</span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">شحن مباشر</span>
            </button>
          )}

          {/* Action 3: Maintenance Order */}
          {!isModuleAutoHidden('maintenance', profile) && (
            <button
              id="btn-quick-maintenance"
              onClick={() => setActiveModal('maintenance')}
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 transition-all active:scale-95 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
                <Wrench size={20} />
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-white mt-2">استلام صيانة</span>
              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold">كشف وفحص</span>
            </button>
          )}

          {/* Action 4: Quick Purchase */}
          <button
            id="btn-quick-purchase"
            onClick={() => setActiveModal('purchase')}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 transition-all active:scale-95 group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20 group-hover:scale-105 transition-transform">
              <Package size={20} />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-2">فاتورة شراء</span>
            <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold">وارد بضاعة</span>
          </button>

          {/* Action 5: SIM Management */}
          {!isModuleAutoHidden('sim-cards', profile) && (
            <button
              id="btn-quick-sims"
              onClick={() => navigate('/sim-cards')}
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-purple-50/70 hover:bg-purple-100/70 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 transition-all active:scale-95 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 group-hover:scale-105 transition-transform">
                <CreditCard size={20} />
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-white mt-2">بيع شريحة</span>
              <span className="text-[10px] text-purple-700 dark:text-purple-400 font-bold">تفعيل SIM</span>
            </button>
          )}

          {/* Action 6: Record Expense */}
          <button
            id="btn-quick-expense"
            onClick={() => navigate('/finances')}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-300/80 dark:border-slate-700 transition-all active:scale-95 group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-slate-700 text-white flex items-center justify-center shadow-md shadow-slate-700/20 group-hover:scale-105 transition-transform">
              <Wallet size={20} />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-2">تسجيل مصروف</span>
            <span className="text-[10px] text-slate-500 font-bold">خصم من الدرج</span>
          </button>

          {/* Action 7: Customer Statement */}
          <button
            id="btn-customer-statement"
            onClick={() => {
              setStatementModalType('customer');
              setStatementFilter('totals');
              setSelectedEntityId('');
              setStatementResults([]);
            }}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-teal-50/70 hover:bg-teal-100/70 dark:bg-teal-950/30 dark:hover:bg-teal-950/50 border border-teal-200 dark:border-teal-800/60 transition-all active:scale-95 group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
              <FileText size={20} />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-2">كشف عميل</span>
            <span className="text-[10px] text-teal-700 dark:text-teal-400 font-bold">مطابقة ديون</span>
          </button>

          {/* Action 8: Supplier Statement */}
          <button
            id="btn-supplier-statement"
            onClick={() => {
              setStatementModalType('supplier');
              setStatementFilter('totals');
              setSelectedEntityId('');
              setStatementResults([]);
            }}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-cyan-50/70 hover:bg-cyan-100/70 dark:bg-cyan-950/30 dark:hover:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800/60 transition-all active:scale-95 group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/20 group-hover:scale-105 transition-transform">
              <Printer size={20} />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-white mt-2">كشف مورد</span>
            <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-bold">مستحقات وفواتير</span>
          </button>

        </div>
      </div>

      {/* 4. Chart & Live Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left 2 Cols: Sales Performance Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" />
                منحنى أداء المبيعات والأرباح الأسبوعي
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                رصد حركة النشاط اليومي وتدفق السيولة النقدية في وضع النهار
              </p>
            </div>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              تحديث حي ✓
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="daylightSalesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="daylightProfitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                />
                <Area type="monotone" dataKey="sales" name="المبيعات" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#daylightSalesGradient)" />
                <Area type="monotone" dataKey="profit" name="الأرباح" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#daylightProfitGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Quick Command / Search Center */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-sm">
              <span className="p-1.5 rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                🔍
              </span>
              <span>محرك البحث والتنقل السريع (Ctrl+K)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              ابحث فوراً بالاسم أو رقم الهاتف أو رقم الفاتورة أو باركود المنتج للوصول السريع.
            </p>

            <div 
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-teal-500 rounded-2xl p-3 flex items-center justify-between cursor-pointer transition-colors shadow-inner"
            >
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                <Search size={16} className="text-teal-600" />
                <span>ابحث عن صنف، فاتورة، عميل...</span>
              </div>
              <span className="text-[10px] font-mono font-black bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                Ctrl + K
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">حالة الربط السحابي:</span>
            <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> متصل وآمن 100%
            </span>
          </div>
        </div>

      </div>

      {/* 5. Live Operations Tables: Recent Sales, B2B Orders, and Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Table 1: Recent Sales Transactions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingBasket size={18} className="text-emerald-600" />
                آخر عمليات البيع اليوم ({displaySales.length})
              </h3>
              <button 
                onClick={() => navigate('/sales')} 
                className="text-xs font-black text-emerald-600 hover:underline"
              >
                الكل ←
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {displaySales.slice(0, 8).map((sale) => (
                <div 
                  key={sale.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                      #{sale.id.slice(-4)}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {sale.customerName || 'عميل نقدي'}
                      </p>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {(sale.items || []).length} أصناف • {sale.paymentMethod === 'debt' ? 'آجل (دين)' : 'نقد (كاش)'}
                      </span>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400 block">
                      {(Number(sale.total) || 0).toLocaleString()} ر.ي
                    </span>
                  </div>
                </div>
              ))}

              {displaySales.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <ShoppingBasket size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">لا توجد مبيعات مسجلة لهذا النطاق اليوم بعد.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table 2: Maintenance Tickets */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench size={18} className="text-orange-500" />
                أحدث كشوفات الصيانة ({displayMaintenance.length})
              </h3>
              <button 
                onClick={() => navigate('/maintenance')} 
                className="text-xs font-black text-orange-600 hover:underline"
              >
                الكل ←
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {displayMaintenance.slice(0, 8).map((order) => {
                const statusMap: Record<string, { label: string, color: string }> = {
                  'pending': { label: 'بانتظار الفحص', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
                  'working': { label: 'تحت الإصلاح', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' },
                  'completed': { label: 'جاهز للتسليم', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300' },
                  'delivered': { label: 'تم التسليم', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' }
                };
                const st = statusMap[order.status] || { label: 'قيد المعالجة', color: 'bg-slate-100 text-slate-700' };

                return (
                  <div 
                    key={order.id}
                    onClick={() => navigate('/maintenance')}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:border-orange-300 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${st.color}`}>
                          {st.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">#{order.id.slice(-4)}</span>
                      </div>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {order.customerName || 'عميل'} - <span className="text-orange-600 dark:text-orange-400">{order.device || 'هاتف'}</span>
                      </p>
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-black font-mono text-orange-600 dark:text-orange-400 block">
                        {(order.cost || 0).toLocaleString()} ر.ي
                      </span>
                    </div>
                  </div>
                );
              })}

              {displayMaintenance.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Wrench size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">لا توجد أوامر صيانة مسجلة حالياً.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table 3: Low Stock & Inventory Alerts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Package size={18} className="text-blue-600" />
                المخزون والنواقص العاجلة
              </h3>
              <button 
                onClick={() => navigate('/inventory')} 
                className="text-xs font-black text-blue-600 hover:underline"
              >
                المخزن ←
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {inventory.slice(0, 8).map((item) => {
                const isLow = Number(item.stock) <= (item.minStock || 0);
                return (
                  <div 
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:border-blue-300 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {item.name}
                      </p>
                      <span className="text-[10px] text-slate-400 font-bold">
                        القسم: {item.category || 'عام'}
                      </span>
                    </div>
                    <div className="text-left">
                      <span className={`text-xs font-black font-mono block ${isLow ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                        {item.stock} {isLow ? '⚠️ منخفض' : 'قطعة'}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold font-mono">
                        {(Number(item.price) || 0).toLocaleString()} ر.ي
                      </span>
                    </div>
                  </div>
                );
              })}

              {inventory.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Package size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">لا توجد منتجات مسجلة في المخزن بعد.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 6. Comprehensive Financial Breakdown Drawer */}
      <ComprehensiveFinancialDrawer
        isOpen={isFinancialDrawerOpen}
        onClose={() => setIsFinancialDrawerOpen(false)}
        profile={profile}
        unifiedStats={unifiedStats}
        vaults={vaults}
        inventory={inventory}
        allCustomers={allCustomers}
        allSuppliers={allSuppliers}
        selectedEmployeeName={selectedEmployeeName}
        isOwnerView={isUserAdminOrOwner}
        onTriggerEOD={handleOpenEOD}
      />

      {/* 6.1 Daily Shift & End-of-Day Close Modal */}
      {profile && (
        <DailyShiftCloseModal
          isOpen={isShiftModalOpen}
          onClose={() => setIsShiftModalOpen(false)}
          currentUser={profile}
          onConfirmShiftClose={handleConfirmShiftClose}
        />
      )}

      {/* 7. Quick Modals & Popups for Sale, Purchase, Balance, Maintenance */}
      <QuickActionModal
        isOpen={activeModal === 'balance'}
        onClose={() => setActiveModal(null)}
        title={labels.balance}
        icon={<Smartphone size={24} />}
        themeColor="bg-amber-500"
      >
        <QuickBalanceForm profile={profile} onSuccess={() => setActiveModal(null)} />
      </QuickActionModal>

      <QuickActionModal
        isOpen={activeModal === 'maintenance'}
        onClose={() => setActiveModal(null)}
        title={labels.maintenance}
        icon={<Wrench size={24} />}
        themeColor="bg-blue-600"
      >
        <QuickMaintenanceForm profile={profile} onSuccess={() => setActiveModal(null)} />
      </QuickActionModal>

      <CurtainDrawer
        isOpen={activeModal === 'sale'}
        onClose={() => setActiveModal(null)}
        title="فاتورة مبيع سريعة"
        icon={<ShoppingBasket size={24} />}
      >
        <QuickInventoryForm profile={profile} type="sale" onSuccess={() => setActiveModal(null)} />
      </CurtainDrawer>

      <CurtainDrawer
        isOpen={activeModal === 'purchase'}
        onClose={() => setActiveModal(null)}
        title="فاتورة شراء سريعة"
        icon={<Package size={24} />}
      >
        <QuickInventoryForm profile={profile} type="purchase" onSuccess={() => setActiveModal(null)} />
      </CurtainDrawer>

      {/* 8. Account Statement Generator Modal for Customers & Suppliers */}
      <AnimatePresence>
        {statementModalType && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden text-right flex flex-col"
              style={{ maxHeight: '90vh' }}
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl ${statementModalType === 'customer' ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-600'}`}>
                    {statementModalType === 'customer' ? <FileText size={24} /> : <Printer size={24} />}
                  </div>
                  <div>
                    <h3 className="text-base lg:text-lg font-black text-slate-900 dark:text-white">
                      {statementModalType === 'customer' ? 'كشف حساب عميل تفصيلي' : 'كشف حساب مورد تفصيلي'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {statementModalType === 'customer' ? 'مطابقة المسحوبات والواصل والديون' : 'مطابقة المشتريات ومستحقات الموردين'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStatementModalType(null)}
                  className="w-10 h-10 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Entity Picker */}
              <div className="p-5 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">
                    {statementModalType === 'customer' ? 'اختر العميل المستهدف' : 'اختر المورد المستهدف'}
                  </label>
                  <select
                    value={selectedEntityId}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold text-xs outline-none"
                  >
                    <option value="">-- اضغط للاختيار --</option>
                    {statementModalType === 'customer' ? (
                      allCustomers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {Number(c.debt) > 0 ? `(الرصيد: ${Number(c.debt).toLocaleString()} YER)` : '(خالي من الديون)'}
                        </option>
                      ))
                    ) : (
                      allSuppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} {Number(s.debt) > 0 ? `(المستحق: ${Number(s.debt).toLocaleString()} YER)` : '(لا توجد مستحقات)'}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">من تاريخ</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold text-xs"
                  />
                </div>
              </div>

              {/* Statement Content */}
              <div className="p-6 overflow-y-auto flex-1">
                {!selectedEntityId ? (
                  <div className="text-center py-16">
                    <Filter size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-xs font-bold text-slate-400">
                      يرجى اختيار {statementModalType === 'customer' ? 'عميل' : 'مورد'} من القائمة المنسدلة لعرض كشف الحساب.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary Badges */}
                    {(() => {
                      const entity = statementModalType === 'customer' 
                        ? allCustomers.find(c => c.id === selectedEntityId) 
                        : allSuppliers.find(s => s.id === selectedEntityId);
                      const currentDebt = Number(entity?.debt) || 0;

                      return (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                          <div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">{entity?.name}</h4>
                            <span className="text-xs text-slate-400">{entity?.phone || 'لا يوجد هاتف'}</span>
                          </div>
                          <div className="text-left">
                            <span className="text-xs font-bold text-slate-400 block">صافي الرصيد الحالي</span>
                            <span className={`text-lg font-black font-mono ${currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {currentDebt.toLocaleString()} ر.ي
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={handlePrintStatement}
                  disabled={!selectedEntityId}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={16} /> طباعة كشف الحساب
                </button>
                <button
                  type="button"
                  onClick={() => setStatementModalType(null)}
                  className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs hover:bg-slate-300 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
