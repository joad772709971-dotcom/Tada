import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Calendar, 
  Filter, 
  Download, 
  History, 
  Wrench, 
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2, 
  AlertCircle, 
  X,
  Loader2,
  AlertTriangle,
  FileSpreadsheet,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  UserCheck,
  ShieldCheck,
  PieChart,
  BarChart3,
  Wallet,
  Box,
  Layers,
  Landmark,
  HardDrive,
  Printer,
  RefreshCw,
  FileText,
  Scale,
  Cpu,
  Share2,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Sparkles,
  AlertOctagon,
  Award,
  PackageCheck,
  Monitor,
  Check,
  Code
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp, 
  doc, 
  deleteDoc, 
  increment, 
  updateDoc,
  getDocs,
  serverTimestamp,
  runTransaction 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MaintenanceOrder, Transaction, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import { secureFileExport } from '../services/securityService';
import { transactionLockService } from '../services/transactionLockService';
import { UniversalReportService, UniversalReportPayload } from '../services/UniversalReportService';

interface ArchiveProps {
  profile: UserProfile | null;
}

type TabType = 
  | 'unified_archive' 
  | 'cashier_sales' 
  | 'inventory_audit' 
  | 'profit_loss' 
  | 'vaults_balances' 
  | 'maintenance_engineers' 
  | 'trial_balance' 
  | 'pricing_credit' 
  | 'exe_desktop_export';

export default function Archive({ profile }: ArchiveProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTabFromUrl = searchParams.get('tab') as TabType;

  const [activeTab, setActiveTab] = useState<TabType>(initialTabFromUrl || 'unified_archive');
  const [archiveSubTab, setArchiveSubTab] = useState<'sales' | 'maintenance' | 'purchases' | 'expenses'>('sales');
  
  // Date Range Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  // Entity Data Collections
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [damagedItems, setDamagedItems] = useState<any[]>([]);

  // UI Modal & Notification States
  const [status, setStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [maintStatusFilter, setMaintStatusFilter] = useState<string>('all');
  const [selectedCashier, setSelectedCashier] = useState<string>('all');
  const [selectedEngineer, setSelectedEngineer] = useState<string>('all');

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Quick Date Range Setters
  const setQuickDate = (type: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    if (type === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === 'week') {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(lastWeek.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (type === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (type === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Firestore Real-time Listeners
  useEffect(() => {
    if (!profile?.ownerId) return;

    const isEmployee = profile?.role === 'employee';
    const ownerFilter = where('ownerId', '==', profile.ownerId);

    // Queries setup
    let qMaintenance = query(
      collection(db, 'maintenanceOrders'), 
      ownerFilter,
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc')
    );
    let qSales = query(
      collection(db, 'sales'), 
      ownerFilter,
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc')
    );
    let qPurchases = query(
      collection(db, 'purchases'),
      ownerFilter,
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc')
    );
    let qInventory = query(collection(db, 'inventory'), ownerFilter);
    let qTransactions = query(collection(db, 'transactions'), ownerFilter, orderBy('createdAt', 'desc'));
    let qAccounts = query(collection(db, 'accounts'), ownerFilter);
    let qUsers = query(collection(db, 'users'), ownerFilter);
    let qCustomers = query(collection(db, 'customers'), ownerFilter);
    let qSuppliers = query(collection(db, 'suppliers'), ownerFilter);
    let qDamaged = query(collection(db, 'damaged_items'), ownerFilter);

    if (isEmployee) {
      qMaintenance = query(qMaintenance, where('engineerId', '==', profile?.uid));
      qSales = query(qSales, where('addedBy', '==', profile?.uid));
      qPurchases = query(qPurchases, where('addedBy', '==', profile?.uid));
    }

    if (startDate && endDate) {
      const start = Timestamp.fromDate(new Date(startDate));
      const end = Timestamp.fromDate(new Date(endDate + 'T23:59:59'));
      
      qMaintenance = query(
        collection(db, 'maintenanceOrders'), 
        ownerFilter,
        where('isDeleted', '==', false),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc')
      );
      
      qSales = query(
        collection(db, 'sales'), 
        ownerFilter,
        where('isDeleted', '==', false),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc')
      );

      qPurchases = query(
        collection(db, 'purchases'),
        ownerFilter,
        where('isDeleted', '==', false),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc')
      );

      if (isEmployee) {
        qMaintenance = query(qMaintenance, where('engineerId', '==', profile?.uid));
        qSales = query(qSales, where('addedBy', '==', profile?.uid));
        qPurchases = query(qPurchases, where('addedBy', '==', profile?.uid));
      }
    }

    const unsubMaintenance = onSnapshot(qMaintenance, (snapshot) => {
      setMaintenanceOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceOrder)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'maintenanceOrders'));

    const unsubSales = onSnapshot(qSales, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales'));

    const unsubPurchases = onSnapshot(qPurchases, (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'purchases'));

    const unsubInventory = onSnapshot(qInventory, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.warn('Inventory fetch warning:', error));

    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.warn('Transactions fetch warning:', error));

    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.warn('Accounts fetch warning:', error));

    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.warn('Staff fetch warning:', error));

    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.warn('Customers fetch warning:', error));

    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.warn('Suppliers fetch warning:', error));

    const unsubDamaged = onSnapshot(qDamaged, (snapshot) => {
      setDamagedItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.warn('Damaged items fetch warning:', error));

    return () => {
      unsubMaintenance();
      unsubSales();
      unsubPurchases();
      unsubInventory();
      unsubTransactions();
      unsubAccounts();
      unsubUsers();
      unsubCustomers();
      unsubSuppliers();
      unsubDamaged();
    };
  }, [startDate, endDate, profile]);

  // Soft Delete Transaction Handler
  const handleRequestDelete = (item: any) => {
    const isSuperAdmin = profile?.role === 'superadmin';
    const lockCheck = transactionLockService.canDelete(item.createdAt || item.date);
    if (!lockCheck.allowed && !isSuperAdmin) {
      setStatus({ type: 'error', message: lockCheck.message });
      return;
    }
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const handleRequestEdit = (item: any) => {
    const isSuperAdmin = profile?.role === 'superadmin';
    const lockCheck = transactionLockService.canEdit(item.createdAt || item.date);
    if (!lockCheck.allowed && !isSuperAdmin) {
      setStatus({ type: 'error', message: lockCheck.message });
      return;
    }
    setStatus({ type: 'success', message: 'ميزة التعديل السريع من الأرشيف متوفرة ضمن النافذة الزمنية المسموح بها.' });
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    const isSuperAdmin = profile?.role === 'superadmin';
    const lockCheck = transactionLockService.canDelete(itemToDelete.createdAt || itemToDelete.date);
    if (!lockCheck.allowed && !isSuperAdmin) {
      setStatus({ type: 'error', message: lockCheck.message });
      setItemToDelete(null);
      setShowDeleteConfirm(false);
      return;
    }

    try {
      const collectionName = archiveSubTab === 'maintenance' ? 'maintenanceOrders' : 
                            archiveSubTab === 'sales' ? 'sales' : 'purchases';

      const qTrans = query(
        collection(db, 'transactions'),
        where('referenceId', '==', itemToDelete.id)
      );
      const transSnap = await getDocs(qTrans);

      await runTransaction(db, async (transaction) => {
        for (const tDoc of transSnap.docs) {
          transaction.delete(tDoc.ref);
        }

        if (archiveSubTab === 'purchases') {
          if (itemToDelete.itemId && itemToDelete.quantity) {
            const invRef = doc(db, 'inventory', itemToDelete.itemId);
            transaction.update(invRef, {
              stock: increment(-itemToDelete.quantity)
            });
          }
        } else if (archiveSubTab === 'sales') {
          if (itemToDelete.items && Array.isArray(itemToDelete.items)) {
            for (const item of itemToDelete.items) {
              const invRef = doc(db, 'inventory', item.id);
              transaction.update(invRef, {
                stock: increment(item.quantity)
              });
            }
          }
          if (itemToDelete.paymentMethod === 'debt' && itemToDelete.customerId) {
            const custRef = doc(db, 'customers', itemToDelete.customerId);
            transaction.update(custRef, {
              debt: increment(-itemToDelete.total)
            });
          }
        }

        transaction.update(doc(db, collectionName, itemToDelete.id), {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: profile?.uid
        });
      });

      setStatus({ type: 'success', message: 'تم التراجع عن المعاملة بنجاح وتحديث المخزون والأرصدة' });
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      setStatus({ type: 'error', message: 'فشل التراجع: ' + error.message });
    }
  };

  // Direct file downloader utility helper
  const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 500);
  };

  // --- DERIVED METRICS COMPUTATIONS ---
  // 1. Cashier Performance Metrics
  const cashierMetrics = useMemo(() => {
    const map: { [key: string]: any } = {};
    sales.forEach(sale => {
      const cName = sale.addedByName || sale.cashierName || sale.addedBy || 'كاشير غير محدد';
      if (!map[cName]) {
        map[cName] = {
          cashierName: cName,
          totalInvoices: 0,
          totalRevenue: 0,
          cashTotal: 0,
          debtTotal: 0,
          cardTotal: 0,
          totalDiscount: 0,
          totalItemsSold: 0
        };
      }
      map[cName].totalInvoices += 1;
      map[cName].totalRevenue += Number(sale.total) || 0;
      map[cName].totalDiscount += Number(sale.discount) || 0;
      
      const pMethod = (sale.paymentMethod || 'cash').toLowerCase();
      if (pMethod === 'cash') map[cName].cashTotal += Number(sale.total) || 0;
      else if (pMethod === 'debt') map[cName].debtTotal += Number(sale.total) || 0;
      else map[cName].cardTotal += Number(sale.total) || 0;

      if (Array.isArray(sale.items)) {
        sale.items.forEach((it: any) => {
          map[cName].totalItemsSold += Number(it.quantity) || 1;
        });
      }
    });
    return Object.values(map);
  }, [sales]);

  // 2. Inventory Audit Valuation Metrics
  const inventoryMetrics = useMemo(() => {
    let totalItems = inventory.length;
    let totalStockQty = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    inventory.forEach(item => {
      const stock = Number(item.stock) || 0;
      const cost = Number(item.cost) || 0;
      const price = Number(item.price) || 0;

      totalStockQty += stock;
      totalCostValuation += stock * cost;
      totalRetailValuation += stock * price;

      if (stock === 0) outOfStockCount++;
      else if (stock <= 5) lowStockCount++;
    });

    const potentialGrossProfit = totalRetailValuation - totalCostValuation;
    const profitMarginPct = totalCostValuation > 0 ? ((potentialGrossProfit / totalCostValuation) * 100).toFixed(1) : '0';

    return {
      totalItems,
      totalStockQty,
      totalCostValuation,
      totalRetailValuation,
      potentialGrossProfit,
      profitMarginPct,
      lowStockCount,
      outOfStockCount
    };
  }, [inventory]);

  // 3. Profit & Loss & Balance Sheet Metrics
  const financialMetrics = useMemo(() => {
    const totalSalesRevenue = sales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const totalMaintenanceRevenue = maintenanceOrders.reduce((acc, m) => acc + (Number(m.cost) || 0), 0);
    const grossRevenue = totalSalesRevenue + totalMaintenanceRevenue;

    // Cost of Goods Sold
    let cogsSales = 0;
    sales.forEach(s => {
      if (Array.isArray(s.items)) {
        s.items.forEach((it: any) => {
          cogsSales += (Number(it.cost) || Number(it.price) * 0.8) * (Number(it.quantity) || 1);
        });
      }
    });

    let sparePartsCostMaint = 0;
    maintenanceOrders.forEach(m => {
      if (Array.isArray(m.sparePartsUsed)) {
        m.sparePartsUsed.forEach((part: any) => {
          sparePartsCostMaint += Number(part.cost) || Number(part.price) || 0;
        });
      }
    });

    const totalCOGS = cogsSales + sparePartsCostMaint;
    const grossProfit = grossRevenue - totalCOGS;

    // Operating Expenses & Purchases Outflows
    const totalPurchasesCost = purchases.reduce((acc, p) => acc + ((Number(p.cost) || 0) * (Number(p.quantity) || 1)), 0);
    const totalExpenseTransactions = transactions
      .filter(t => t.type === 'outflow' || t.category === 'expense' || t.category === 'salary')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const damagedItemsLoss = damagedItems.reduce((acc, d) => acc + ((Number(d.cost) || 0) * (Number(d.quantity) || 1)), 0);

    const totalOperatingExpenses = totalExpenseTransactions + damagedItemsLoss;
    const netProfit = grossProfit - totalOperatingExpenses;

    // Assets
    const totalCashVaultsBalance = accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    const totalCustomerDebts = customers.reduce((acc, c) => acc + (Number(c.debt) || 0), 0);
    const totalInventoryValue = inventoryMetrics.totalCostValuation;
    const totalAssets = totalCashVaultsBalance + totalCustomerDebts + totalInventoryValue;

    // Liabilities & Equity
    const totalSupplierPayables = suppliers.reduce((acc, sup) => acc + (Number(sup.balance) || 0), 0);
    const netEquity = totalAssets - totalSupplierPayables;

    return {
      grossRevenue,
      totalSalesRevenue,
      totalMaintenanceRevenue,
      totalCOGS,
      grossProfit,
      totalOperatingExpenses,
      totalPurchasesCost,
      damagedItemsLoss,
      netProfit,
      totalAssets,
      totalCashVaultsBalance,
      totalCustomerDebts,
      totalInventoryValue,
      totalSupplierPayables,
      netEquity
    };
  }, [sales, maintenanceOrders, purchases, transactions, accounts, customers, inventoryMetrics, suppliers, damagedItems]);

  // 4. Engineer & Maintenance Performance Metrics
  const engineerMetrics = useMemo(() => {
    const map: { [key: string]: any } = {};
    maintenanceOrders.forEach(ord => {
      const engId = ord.engineerId || 'default';
      const engName = ord.engineerName || 'مهندس عام';
      if (!map[engId]) {
        map[engId] = {
          engineerId: engId,
          engineerName: engName,
          totalOrders: 0,
          deliveredOrders: 0,
          readyOrders: 0,
          inProgressOrders: 0,
          totalRevenue: 0,
          partsCost: 0,
          netServiceProfit: 0
        };
      }
      map[engId].totalOrders += 1;
      if (ord.status === 'delivered') map[engId].deliveredOrders += 1;
      else if (ord.status === 'ready') map[engId].readyOrders += 1;
      else map[engId].inProgressOrders += 1;

      const rev = Number(ord.cost) || 0;
      let pCost = 0;
      if (Array.isArray(ord.sparePartsUsed)) {
        ord.sparePartsUsed.forEach((p: any) => {
          pCost += Number(p.cost) || Number(p.price) || 0;
        });
      }
      map[engId].totalRevenue += rev;
      map[engId].partsCost += pCost;
      map[engId].netServiceProfit += (rev - pCost);
    });
    return Object.values(map);
  }, [maintenanceOrders]);

  // Filtered Archive List
  const filteredMaintenance = maintenanceOrders.filter(o => {
    const matchesSearch = 
      (o.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.deviceModel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.id || '').includes(searchTerm);
    const matchesStatus = maintStatusFilter === 'all' || o.status === maintStatusFilter;
    const matchesEng = selectedEngineer === 'all' || o.engineerId === selectedEngineer;
    return matchesSearch && matchesStatus && matchesEng;
  });

  const filteredSales = sales.filter(s => {
    const matchesSearch = 
      s.items?.some((i: any) => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.id || '').includes(searchTerm) ||
      (s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCashier = selectedCashier === 'all' || s.addedBy === selectedCashier || s.cashierName === selectedCashier;
    return matchesSearch && matchesCashier;
  });

  const filteredPurchases = purchases.filter(p => 
    (p.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode || '').includes(searchTerm) ||
    (p.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dynamic Report Payload for Current Active Tab
  const getCurrentTabReportPayload = (): UniversalReportPayload => {
    const storeName = profile?.shopName || localStorage.getItem('jam_last_logged_in_shop_name') || 'المحل التجاري';
    const currentUser = profile?.name || profile?.email || 'المسؤول';
    const userPhone = profile?.phone || '';
    const currency = 'ر.ي';

    switch (activeTab) {
      case 'unified_archive': {
        if (archiveSubTab === 'sales') {
          return {
            title: 'سجل وأرشيف فواتير المبيعات',
            subtitle: `الفترة: ${startDate || 'البداية'} إلى ${endDate || 'اليوم'} | إجمالي الفواتير: ${filteredSales.length}`,
            storeName,
            currency,
            summaryCards: [
              { label: 'إجمالي المبيعات المفلترة', value: filteredSales.reduce((a, s) => a + (Number(s.total) || 0), 0).toLocaleString(), currency, color: 'green' },
              { label: 'عدد الفواتير', value: filteredSales.length, currency: 'فاتورة', color: 'blue' },
              { label: 'إجمالي الخصومات', value: filteredSales.reduce((a, s) => a + (Number(s.discount) || 0), 0).toLocaleString(), currency, color: 'amber' }
            ],
            columns: [
              { key: 'invoiceNumber', header: 'رقم الفاتورة', type: 'text' },
              { key: 'dateStr', header: 'التاريخ', type: 'text' },
              { key: 'customerName', header: 'العميل', type: 'text' },
              { key: 'cashierName', header: 'الكاشير / الموظف', type: 'text' },
              { key: 'paymentMethodAr', header: 'طريقة الدفع', type: 'text' },
              { key: 'total', header: 'الإجمالي', type: 'currency' },
              { key: 'discount', header: 'الخصم', type: 'currency' },
              { key: 'finalTotal', header: 'الصافي المدفوع', type: 'currency' }
            ],
            data: filteredSales.map((s, idx) => ({
              invoiceNumber: s.invoiceNumber || s.id?.slice(0, 8) || `#${idx + 1}`,
              dateStr: s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString('ar-YE') : new Date().toLocaleDateString('ar-YE'),
              customerName: s.customerName || 'عميل نقدي',
              cashierName: s.addedByName || s.cashierName || 'كاشير',
              paymentMethodAr: s.paymentMethod === 'cash' ? 'نقداً 💵' : s.paymentMethod === 'debt' ? 'آجل 📜' : 'تحويل/بطاقة 💳',
              total: Number(s.total) || 0,
              discount: Number(s.discount) || 0,
              finalTotal: (Number(s.total) || 0) - (Number(s.discount) || 0)
            }))
          };
        }
        if (archiveSubTab === 'maintenance') {
          return {
            title: 'سجل وأرشيف كروت الصيانة والأجهزة',
            subtitle: `الفترة: ${startDate || 'البداية'} إلى ${endDate || 'اليوم'} | إجمالي الكروت: ${filteredMaintenance.length}`,
            storeName,
            currency,
            summaryCards: [
              { label: 'إجمالي أجور الصيانة', value: filteredMaintenance.reduce((a, m) => a + (Number(m.cost) || 0), 0).toLocaleString(), currency, color: 'green' },
              { label: 'عدد الكروت', value: filteredMaintenance.length, currency: 'كرت', color: 'blue' }
            ],
            columns: [
              { key: 'ticketId', header: 'رقم الكرت', type: 'text' },
              { key: 'dateStr', header: 'التاريخ', type: 'text' },
              { key: 'customerName', header: 'اسم العميل', type: 'text' },
              { key: 'customerPhone', header: 'رقم الهاتف', type: 'text' },
              { key: 'deviceModel', header: 'الجهاز والموديل', type: 'text' },
              { key: 'engineerName', header: 'المهندس المشرف', type: 'text' },
              { key: 'statusAr', header: 'حالة الصيانة', type: 'badge' },
              { key: 'cost', header: 'التكلفة والأجور', type: 'currency' }
            ],
            data: filteredMaintenance.map((m, idx) => ({
              ticketId: m.ticketNumber || m.id?.slice(0, 8) || `#${idx + 1}`,
              dateStr: m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString('ar-YE') : new Date().toLocaleDateString('ar-YE'),
              customerName: m.customerName || 'عميل',
              customerPhone: m.customerPhone || '-',
              deviceModel: m.deviceModel || m.deviceType || 'جهاز',
              engineerName: m.engineerName || 'المهندس المسؤول',
              statusAr: m.status === 'delivered' ? 'تم التسليم ✅' : m.status === 'ready' ? 'جاهز للاستلام 📦' : m.status === 'in_progress' ? 'قيد الصيانة ⚙️' : 'مستلم 📥',
              cost: Number(m.cost) || 0
            }))
          };
        }
        return {
          title: 'سجل وأرشيف فواتير المشتريات والتوريد',
          subtitle: `الفترة: ${startDate || 'البداية'} إلى ${endDate || 'اليوم'} | عدد الفواتير: ${filteredPurchases.length}`,
          storeName,
          currency,
          summaryCards: [
            { label: 'إجمالي المشتريات', value: filteredPurchases.reduce((a, p) => a + ((Number(p.cost) || 0) * (Number(p.quantity) || 1)), 0).toLocaleString(), currency, color: 'blue' },
            { label: 'عدد الفواتير', value: filteredPurchases.length, currency: 'فاتورة', color: 'purple' }
          ],
          columns: [
            { key: 'invoiceNumber', header: 'رقم الفاتورة / الباركود', type: 'text' },
            { key: 'dateStr', header: 'التاريخ', type: 'text' },
            { key: 'itemName', header: 'اسم الصنف المورد', type: 'text' },
            { key: 'supplierName', header: 'المورد والشركة', type: 'text' },
            { key: 'quantity', header: 'الكمية', type: 'number' },
            { key: 'cost', header: 'سعر الوحدة', type: 'currency' },
            { key: 'total', header: 'إجمالي التوريد', type: 'currency' }
          ],
          data: filteredPurchases.map((p, idx) => ({
            invoiceNumber: p.barcode || p.id?.slice(0, 8) || `#${idx + 1}`,
            dateStr: p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('ar-YE') : new Date().toLocaleDateString('ar-YE'),
            itemName: p.itemName || 'صنف',
            supplierName: p.supplierName || 'مورد',
            quantity: Number(p.quantity) || 1,
            cost: Number(p.cost) || 0,
            total: (Number(p.cost) || 0) * (Number(p.quantity) || 1)
          }))
        };
      }

      case 'cashier_sales': {
        return {
          title: 'تقرير أداء وإنتاجية الكاشير والموظفين',
          storeName,
          currency,
          summaryCards: [
            { label: 'إجمالي مبيعات الكاشير', value: cashierMetrics.reduce((a, c) => a + c.totalRevenue, 0).toLocaleString(), currency, color: 'green' },
            { label: 'عدد الفواتير الإجمالي', value: cashierMetrics.reduce((a, c) => a + c.totalInvoices, 0), currency: 'فاتورة', color: 'blue' },
            { label: 'إجمالي الخصومات الممنوحة', value: cashierMetrics.reduce((a, c) => a + c.totalDiscount, 0).toLocaleString(), currency, color: 'amber' }
          ],
          columns: [
            { key: 'cashierName', header: 'اسم الموظف / الكاشير', type: 'text' },
            { key: 'totalInvoices', header: 'عدد الفواتير', type: 'number' },
            { key: 'totalItemsSold', header: 'القطع المباعة', type: 'number' },
            { key: 'cashTotal', header: 'مبيعات كاش 💵', type: 'currency' },
            { key: 'debtTotal', header: 'مبيعات آجل 📜', type: 'currency' },
            { key: 'totalRevenue', header: 'إجمالي الإيراد', type: 'currency' },
            { key: 'avgInvoice', header: 'متوسط الفاتورة', type: 'currency' }
          ],
          data: cashierMetrics.map(cm => ({
            cashierName: cm.cashierName,
            totalInvoices: cm.totalInvoices,
            totalItemsSold: cm.totalItemsSold,
            cashTotal: cm.cashTotal,
            debtTotal: cm.debtTotal,
            totalRevenue: cm.totalRevenue,
            avgInvoice: cm.totalInvoices > 0 ? Math.round(cm.totalRevenue / cm.totalInvoices) : 0
          }))
        };
      }

      case 'inventory_audit': {
        return {
          title: 'كشف جرد المخزون والتقييم المالي الشامل',
          storeName,
          currency,
          summaryCards: [
            { label: 'إجمالي الأصناف', value: inventoryMetrics.totalItems, currency: 'صنف', color: 'blue' },
            { label: 'تقييم التكلفة (رأس المال)', value: inventoryMetrics.totalCostValuation.toLocaleString(), currency, color: 'amber' },
            { label: 'القيمة البيعية المتوقعة', value: inventoryMetrics.totalRetailValuation.toLocaleString(), currency, color: 'green' },
            { label: 'الربح المتوقع للمخزون', value: inventoryMetrics.potentialGrossProfit.toLocaleString(), currency, color: 'purple' }
          ],
          columns: [
            { key: 'name', header: 'اسم الصنف', type: 'text' },
            { key: 'barcode', header: 'الباركود', type: 'text' },
            { key: 'category', header: 'التصنيف', type: 'text' },
            { key: 'stock', header: 'الكمية الحالية', type: 'number' },
            { key: 'cost', header: 'سعر التكلفة', type: 'currency' },
            { key: 'price', header: 'سعر البيع', type: 'currency' },
            { key: 'totalCost', header: 'إجمالي التكلفة', type: 'currency' },
            { key: 'totalPrice', header: 'إجمالي البيع', type: 'currency' },
            { key: 'profit', header: 'هامش الربح المتوقع', type: 'currency' }
          ],
          data: inventory.map(item => {
            const stock = Number(item.stock) || 0;
            const cost = Number(item.cost) || 0;
            const price = Number(item.price) || 0;
            return {
              name: item.name,
              barcode: item.barcode || '-',
              category: item.category || 'عام',
              stock,
              cost,
              price,
              totalCost: stock * cost,
              totalPrice: stock * price,
              profit: (price - cost) * stock
            };
          })
        };
      }

      case 'profit_loss': {
        return {
          title: 'تقرير الأرباح والميزانية العمومية وقائمة الدخل',
          storeName,
          currency,
          summaryCards: [
            { label: 'مجمل الإيرادات', value: financialMetrics.grossRevenue.toLocaleString(), currency, color: 'blue' },
            { label: 'تكلفة البضائع المباعة', value: financialMetrics.totalCOGS.toLocaleString(), currency, color: 'red' },
            { label: 'المصروفات والتوالف', value: financialMetrics.totalOperatingExpenses.toLocaleString(), currency, color: 'amber' },
            { label: 'صافي الربح التجاري', value: financialMetrics.netProfit.toLocaleString(), currency, color: 'green' }
          ],
          columns: [
            { key: 'statement', header: 'البند المالي / البيان', type: 'text' },
            { key: 'type', header: 'التصنيف المحاسبي', type: 'text' },
            { key: 'amount', header: 'القيمة المالية', type: 'currency' }
          ],
          data: [
            { statement: 'إيراد المبيعات', type: 'إيرادات تشغيلية', amount: financialMetrics.totalSalesRevenue },
            { statement: 'إيراد الصيانة وخدمات اليد', type: 'إيرادات تشغيلية', amount: financialMetrics.totalMaintenanceRevenue },
            { statement: 'مجمل الإيرادات الكلية', type: 'إجمالي الإيراد', amount: financialMetrics.grossRevenue },
            { statement: 'تكلفة البضائع وقطع الغيار (COGS)', type: 'تكاليف المبيعات', amount: financialMetrics.totalCOGS },
            { statement: 'مجمل الربح الإجمالي', type: 'الربح الإجمالي', amount: financialMetrics.grossProfit },
            { statement: 'المصروفات التشغيلية والتوالف', type: 'مصاريف عامة', amount: financialMetrics.totalOperatingExpenses },
            { statement: 'صافي الربح / الخسارة النهائي', type: 'صافي الربح', amount: financialMetrics.netProfit }
          ]
        };
      }

      case 'vaults_balances': {
        return {
          title: 'تقرير حركة النقدية والصناديق والحسابات المالية',
          storeName,
          currency,
          summaryCards: [
            { label: 'إجمالي السيولة بالصناديق', value: financialMetrics.totalCashVaultsBalance.toLocaleString(), currency, color: 'green' },
            { label: 'ديون العملاء المعلقة', value: financialMetrics.totalCustomerDebts.toLocaleString(), currency, color: 'amber' },
            { label: 'مستحقات الموردين', value: financialMetrics.totalSupplierPayables.toLocaleString(), currency, color: 'red' }
          ],
          columns: [
            { key: 'name', header: 'اسم الحساب / الصندوق', type: 'text' },
            { key: 'type', header: 'النوع', type: 'text' },
            { key: 'balance', header: 'الرصيد الحالي', type: 'currency' }
          ],
          data: accounts.map(a => ({
            name: a.name || 'حساب',
            type: a.type === 'cash' ? 'صندوق نقدي (كاش)' : a.type === 'bank' ? 'حساب بنكي' : 'محفظة إلكترونية',
            balance: Number(a.balance) || 0
          }))
        };
      }

      case 'maintenance_engineers': {
        return {
          title: 'تقرير أداء وإنتاجية المهندسين والفنيين',
          storeName,
          currency,
          summaryCards: [
            { label: 'إجمالي أجور الصيانة', value: engineerMetrics.reduce((a, e) => a + e.totalRevenue, 0).toLocaleString(), currency, color: 'green' },
            { label: 'الأجهزة المنجزة', value: engineerMetrics.reduce((a, e) => a + e.deliveredOrders, 0), currency: 'جهاز', color: 'blue' }
          ],
          columns: [
            { key: 'engineerName', header: 'اسم المهندس', type: 'text' },
            { key: 'totalOrders', header: 'إجمالي الأجهزة', type: 'number' },
            { key: 'deliveredOrders', header: 'تم تسليمها', type: 'number' },
            { key: 'readyOrders', header: 'جاهزة للاستلام', type: 'number' },
            { key: 'totalRevenue', header: 'إجمالي الإيراد', type: 'currency' },
            { key: 'partsCost', header: 'تكلفة قطع الغيار', type: 'currency' },
            { key: 'netServiceProfit', header: 'صافي ربح أجور العمل', type: 'currency' }
          ],
          data: engineerMetrics
        };
      }

      case 'trial_balance': {
        return {
          title: 'ميزان المراجعة المحاسبي العام (Trial Balance)',
          storeName,
          currency,
          summaryCards: [
            { label: 'إجمالي الأصول والسيولة', value: financialMetrics.totalAssets.toLocaleString(), currency, color: 'blue' },
            { label: 'صافي حقوق الملكية', value: financialMetrics.netEquity.toLocaleString(), currency, color: 'purple' }
          ],
          columns: [
            { key: 'accountCode', header: 'رمز الحساب', type: 'text' },
            { key: 'accountName', header: 'اسم الحساب', type: 'text' },
            { key: 'nature', header: 'طبيعة الحساب', type: 'text' },
            { key: 'debit', header: 'الأرصدة المدينة (Debit)', type: 'currency' },
            { key: 'credit', header: 'الأرصدة الدائنة (Credit)', type: 'currency' },
            { key: 'net', header: 'الرصيد الصافي', type: 'currency' }
          ],
          data: [
            { accountCode: '1001', accountName: 'صندوق النقدية الكاش', nature: 'أصول متداولة', debit: financialMetrics.totalCashVaultsBalance, credit: 0, net: financialMetrics.totalCashVaultsBalance },
            { accountCode: '1002', accountName: 'ذمم العملاء (الديون)', nature: 'أصول متداولة', debit: financialMetrics.totalCustomerDebts, credit: 0, net: financialMetrics.totalCustomerDebts },
            { accountCode: '1003', accountName: 'مخزون البضائع المتاحة', nature: 'أصول متداولة', debit: financialMetrics.totalInventoryValue, credit: 0, net: financialMetrics.totalInventoryValue },
            { accountCode: '2001', accountName: 'مستحقات الموردين والشركات', nature: 'التزامات متداولة', debit: 0, credit: financialMetrics.totalSupplierPayables, net: -financialMetrics.totalSupplierPayables },
            { accountCode: '4001', accountName: 'إيراد المبيعات والصيانة', nature: 'إيرادات النشاط', debit: 0, credit: financialMetrics.grossRevenue, net: financialMetrics.grossRevenue }
          ]
        };
      }

      case 'pricing_credit': {
        return {
          title: 'تحليل هوامش الأسعار وتقييم مخاطر الائتمان',
          storeName,
          currency,
          columns: [
            { key: 'name', header: 'الصنف / العميل', type: 'text' },
            { key: 'detail', header: 'التفاصيل / الهاتف', type: 'text' },
            { key: 'costOrDebt', header: 'التكلفة / الدين المستحق', type: 'currency' },
            { key: 'priceOrStatus', header: 'سعر البيع / مستوى المخاطرة', type: 'text' },
            { key: 'margin', header: 'هامش الربح', type: 'text' }
          ],
          data: [
            ...inventory.slice(0, 20).map(it => {
              const cost = Number(it.cost) || 1;
              const price = Number(it.price) || 1;
              return {
                name: it.name,
                detail: `باركود: ${it.barcode || '-'}`,
                costOrDebt: cost,
                priceOrStatus: `${price} ر.ي`,
                margin: `+${(((price - cost) / cost) * 100).toFixed(0)}%`
              };
            }),
            ...customers.filter(c => Number(c.debt) > 0).map(cust => ({
              name: cust.name,
              detail: cust.phone || '-',
              costOrDebt: Number(cust.debt),
              priceOrStatus: 'مخاطرة معتدلة',
              margin: 'آجل'
            }))
          ]
        };
      }

      default:
      case 'exe_desktop_export': {
        return {
          title: 'التقرير المالي والمخزني الشامل الموحد',
          subtitle: 'شامل لكافة المعاملات المالية والمخزنية ومؤشرات الأداء وميزان المراجعة',
          storeName,
          currency,
          summaryCards: [
            { label: 'مجمل الإيرادات الكلية', value: financialMetrics.grossRevenue.toLocaleString(), currency, color: 'blue' },
            { label: 'صافي الربح التجاري', value: financialMetrics.netProfit.toLocaleString(), currency, color: 'green' },
            { label: 'قيمة المخزون الإجمالية', value: financialMetrics.totalInventoryValue.toLocaleString(), currency, color: 'purple' },
            { label: 'السيولة المتاحة', value: financialMetrics.totalCashVaultsBalance.toLocaleString(), currency, color: 'cyan' }
          ],
          columns: [
            { key: 'statement', header: 'البيان المالي / المحاسبي', type: 'text' },
            { key: 'value', header: 'القيمة المالية المسجلة', type: 'text' }
          ],
          data: [
            { statement: 'إجمالي إيرادات المبيعات', value: `${financialMetrics.totalSalesRevenue.toLocaleString()} ر.ي` },
            { statement: 'إجمالي إيرادات الصيانة', value: `${financialMetrics.totalMaintenanceRevenue.toLocaleString()} ر.ي` },
            { statement: 'مجمل الإيرادات الكلية', value: `${financialMetrics.grossRevenue.toLocaleString()} ر.ي` },
            { statement: 'تكلفة البضائع وقطع الغيار (COGS)', value: `${financialMetrics.totalCOGS.toLocaleString()} ر.ي` },
            { statement: 'مجمل الربح التجاري', value: `${financialMetrics.grossProfit.toLocaleString()} ر.ي` },
            { statement: 'المصروفات والتوالف', value: `${financialMetrics.totalOperatingExpenses.toLocaleString()} ر.ي` },
            { statement: 'صافي الربح النهائي', value: `${financialMetrics.netProfit.toLocaleString()} ر.ي` },
            { statement: 'إجمالي السيولة بالصناديق والحسابات', value: `${financialMetrics.totalCashVaultsBalance.toLocaleString()} ر.ي` },
            { statement: 'إجمالي ديون العملاء المعلقة', value: `${financialMetrics.totalCustomerDebts.toLocaleString()} ر.ي` },
            { statement: 'تقييم المخزون بسعر التكلفة', value: `${financialMetrics.totalInventoryValue.toLocaleString()} ر.ي` },
            { statement: 'إجمالي الأصول والسيولة', value: `${financialMetrics.totalAssets.toLocaleString()} ر.ي` },
            { statement: 'مستحقات الموردين والشركات', value: `${financialMetrics.totalSupplierPayables.toLocaleString()} ر.ي` },
            { statement: 'صافي رأس المال وحقوق الملكية', value: `${financialMetrics.netEquity.toLocaleString()} ر.ي` }
          ]
        };
      }
    }
  };

  // Universal Cross-Platform PDF & Printable Preview Trigger
  const exportToPDF = () => {
    setIsExporting(true);
    setShowDeleteConfirm(false);
    setExpandedItems([]);

    try {
      const payload = getCurrentTabReportPayload();
      UniversalReportService.printReport(payload);
      setStatus({ type: 'success', message: 'تم فتح معاينة وطباعة التقرير الذكية بنجاح 🖨️' });
    } catch (err: any) {
      console.error('PDF report error:', err);
      setStatus({ type: 'error', message: 'فشل استدعاء التقرير: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Universal Cross-Platform Excel Exporter
  const exportToExcel = async (data?: any[], fileNameStr?: string) => {
    try {
      setIsExporting(true);
      const payload = getCurrentTabReportPayload();
      const success = await UniversalReportService.exportToExcel(payload, fileNameStr);
      if (success) {
        setStatus({ type: 'success', message: `تم تصدير وحفظ التقرير بنجاح عبر نظام الملفات والمشاركة 📊` });
      }
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      setStatus({ type: 'error', message: 'فشل تصدير ملف اكسل: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Master Comprehensive Desktop Multi-Sheet Report Exporter
  const exportMasterDesktopReport = async () => {
    try {
      setIsExporting(true);
      const wb = XLSX.utils.book_new();

      // 1. Summary Sheet
      const summaryData = [
        { 'البيان': 'إجمالي إيرادات المبيعات', 'القيمة': `${financialMetrics.totalSalesRevenue.toLocaleString()} ر.ي` },
        { 'البيان': 'إجمالي إيرادات الصيانة', 'القيمة': `${financialMetrics.totalMaintenanceRevenue.toLocaleString()} ر.ي` },
        { 'البيان': 'مجمل الإيرادات الكلية', 'القيمة': `${financialMetrics.grossRevenue.toLocaleString()} ر.ي` },
        { 'البيان': 'تكلفة البضائع وقطع الغيار (COGS)', 'القيمة': `${financialMetrics.totalCOGS.toLocaleString()} ر.ي` },
        { 'البيان': 'مجمل الربح التجاري', 'القيمة': `${financialMetrics.grossProfit.toLocaleString()} ر.ي` },
        { 'البيان': 'المصروفات والتوالف', 'القيمة': `${financialMetrics.totalOperatingExpenses.toLocaleString()} ر.ي` },
        { 'البيان': 'صافي الربح / الخسارة النهائي', 'القيمة': `${financialMetrics.netProfit.toLocaleString()} ر.ي` },
        { 'البيان': 'إجمالي السيولة بالصناديق والحسابات', 'القيمة': `${financialMetrics.totalCashVaultsBalance.toLocaleString()} ر.ي` },
        { 'البيان': 'إجمالي ديون العملاء', 'القيمة': `${financialMetrics.totalCustomerDebts.toLocaleString()} ر.ي` },
        { 'البيان': 'تقييم المخزون بسعر التكلفة', 'القيمة': `${financialMetrics.totalInventoryValue.toLocaleString()} ر.ي` },
        { 'البيان': 'إجمالي الأصول والسيولة', 'القيمة': `${financialMetrics.totalAssets.toLocaleString()} ر.ي` },
        { 'البيان': 'مستحقات الموردين والشركات', 'القيمة': `${financialMetrics.totalSupplierPayables.toLocaleString()} ر.ي` },
        { 'البيان': 'صافي رأس المال وحقوق الملكية', 'القيمة': `${financialMetrics.netEquity.toLocaleString()} ر.ي` },
        { 'البيان': 'تاريخ ووقت استخراج التقرير', 'القيمة': new Date().toLocaleString('ar-YE') }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص الأداء المالي");

      // 2. Sales Invoices Sheet
      const salesSheetData = sales.map((s, idx) => ({
        'رقم': idx + 1,
        'رقم الفاتورة': s.id || '',
        'تاريخ الفاتورة': s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString('ar-EG') : '',
        'العميل': s.customerName || 'عميل نقدي',
        'الكاشير / الموظف': s.addedByName || s.cashierName || 'كاشير',
        'طريقة الدفع': s.paymentMethod === 'cash' ? 'نقداً' : s.paymentMethod === 'debt' ? 'آجل' : 'تحويل/بطاقة',
        'الإجمالي': Number(s.total) || 0,
        'الخصم': Number(s.discount) || 0,
        'عدد الأصناف': Array.isArray(s.items) ? s.items.length : 0
      }));
      const wsSales = XLSX.utils.json_to_sheet(salesSheetData.length > 0 ? salesSheetData : [{ 'تنبيه': 'لا توجد فواتير' }]);
      XLSX.utils.book_append_sheet(wb, wsSales, "أرشيف المبيعات");

      // 3. Maintenance Orders Sheet
      const maintSheetData = maintenanceOrders.map((m, idx) => ({
        'رقم': idx + 1,
        'رقم الكرت': m.id || '',
        'تاريخ الدخول': m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString('ar-EG') : '',
        'اسم العميل': m.customerName || '',
        'هاتف العميل': m.customerPhone || '',
        'نوع وموديل الجهاز': m.deviceModel || '',
        'العطل المطلوب': m.issueDescription || '',
        'المهندس المشرف': m.engineerName || 'عام',
        'حالة الجهاز': m.status === 'delivered' ? 'تم التسليم' : m.status === 'ready' ? 'جاهز' : m.status === 'in_progress' ? 'قيد الصيانة' : 'مستلم',
        'أجور وتكلفة الصيانة': Number(m.cost) || 0
      }));
      const wsMaint = XLSX.utils.json_to_sheet(maintSheetData.length > 0 ? maintSheetData : [{ 'تنبيه': 'لا توجد كروت صيانة' }]);
      XLSX.utils.book_append_sheet(wb, wsMaint, "أرشيف الصيانة");

      // 4. Inventory Audit Sheet
      const invSheetData = inventory.map((i, idx) => ({
        'رقم': idx + 1,
        'اسم الصنف': i.name || '',
        'الباركود': i.barcode || '',
        'التصنيف': i.category || 'عام',
        'الكمية الحالية': Number(i.stock) || 0,
        'سعر التكلفة': Number(i.cost) || 0,
        'سعر البيع': Number(i.price) || 0,
        'إجمالي التكلفة بالمخزن': (Number(i.stock) || 0) * (Number(i.cost) || 0),
        'إجمالي قيمة البيع المتوقعة': (Number(i.stock) || 0) * (Number(i.price) || 0),
        'هامش الربح المتوقع': ((Number(i.price) || 0) - (Number(i.cost) || 0)) * (Number(i.stock) || 0)
      }));
      const wsInv = XLSX.utils.json_to_sheet(invSheetData.length > 0 ? invSheetData : [{ 'تنبيه': 'لا توجد أصناف بالمخزن' }]);
      XLSX.utils.book_append_sheet(wb, wsInv, "جرد وتقييم المخزون");

      // 5. Cashier Performance Sheet
      const wsCashier = XLSX.utils.json_to_sheet(cashierMetrics.map((c, idx) => ({
        'رقم': idx + 1,
        'اسم الموظف / الكاشير': c.cashierName,
        'عدد الفواتير': c.totalInvoices,
        'القطع المباعة': c.totalItemsSold,
        'مبيعات نقداً': c.cashTotal,
        'مبيعات آجل': c.debtTotal,
        'مبيعات إلكتروني/بطاقة': c.cardTotal,
        'إجمالي الإيراد': c.totalRevenue,
        'إجمالي الخصومات': c.totalDiscount
      })));
      XLSX.utils.book_append_sheet(wb, wsCashier, "أداء الكاشير");

      // 6. Engineer Performance Sheet
      const wsEng = XLSX.utils.json_to_sheet(engineerMetrics.map((e, idx) => ({
        'رقم': idx + 1,
        'اسم المهندس': e.engineerName,
        'إجمالي الأجهزة المستلمة': e.totalOrders,
        'الأجهزة المسلمة': e.deliveredOrders,
        'الأجهزة الجاهزة': e.readyOrders,
        'إيراد الصيانة': e.totalRevenue,
        'تكلفة قطع الغيار': e.partsCost,
        'صافي ربح أجور اليد': e.netServiceProfit
      })));
      XLSX.utils.book_append_sheet(wb, wsEng, "أداء المهندسين");

      // 7. Trial Balance Sheet
      const trialBalanceData = [
        { 'رمز الحساب': '1001', 'اسم الحساب': 'صندوق النقدية الكاش', 'طبيعة الحساب': 'أصول دائنة/مدينة', 'الرصيد المدين': financialMetrics.totalCashVaultsBalance, 'الرصيد الدائن': 0, 'الصافي': financialMetrics.totalCashVaultsBalance },
        { 'رمز الحساب': '1002', 'اسم الحساب': 'ذمم العملاء (الديون)', 'طبيعة الحساب': 'أصول متداولة', 'الرصيد المدين': financialMetrics.totalCustomerDebts, 'الرصيد الدائن': 0, 'الصافي': financialMetrics.totalCustomerDebts },
        { 'رمز الحساب': '1003', 'اسم الحساب': 'مخزون البضائع المتاحة', 'طبيعة الحساب': 'أصول متداولة', 'الرصيد المدين': financialMetrics.totalInventoryValue, 'الرصيد الدائن': 0, 'الصافي': financialMetrics.totalInventoryValue },
        { 'رمز الحساب': '2001', 'اسم الحساب': 'مستحقات الموردين والشركات', 'طبيعة الحساب': 'التزامات متداولة', 'الرصيد المدين': 0, 'الرصيد الدائن': financialMetrics.totalSupplierPayables, 'الصافي': -financialMetrics.totalSupplierPayables },
        { 'رمز الحساب': '4001', 'اسم الحساب': 'إيراد المبيعات والصيانة', 'طبيعة الحساب': 'إيرادات النشاط', 'الرصيد المدين': 0, 'الرصيد الدائن': financialMetrics.grossRevenue, 'الصافي': financialMetrics.grossRevenue }
      ];
      const wsTrial = XLSX.utils.json_to_sheet(trialBalanceData);
      XLSX.utils.book_append_sheet(wb, wsTrial, "ميزان المراجعة");

      // Write and deliver multi-sheet master excel file universally
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const masterFileName = `التقرير_الشامل_الموحد_للكمبيوتر_${new Date().toISOString().slice(0, 10)}.xlsx`;
      
      await UniversalReportService.saveAndDeliverFile(
        excelBuffer,
        masterFileName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      setStatus({ type: 'success', message: 'تم بنجاح تصدير التقرير الشامل للكمبيوتر (ملف إكسل متعدد التبويبات) 📊' });
    } catch (err: any) {
      console.error('Master Desktop Report Export Error:', err);
      setStatus({ type: 'error', message: 'فشل تصدير التقرير الشامل: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const canEdit = profile?.role === 'manager' || profile?.role === 'superadmin' || profile?.role === 'owner';

  return (
    <div className="space-y-6 pb-12 font-sans select-none text-right" dir="rtl">
      
      {/* Dynamic Header & System Status Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-navy-900 to-slate-900 p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <PieChart size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                محرك التقارير الشاملة والأرشيف والبيانات الختامية 📊
              </h1>
              <p className="text-xs text-gray-400 font-medium">
                مراجعة الحركة المالية والمخزنية، أرباح الكاشير والمهندسين، والميزانية الختامية مع التصدير لسطح المكتب
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="relative z-10 flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button 
            onClick={() => setQuickDate('today')} 
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold border border-white/10 transition-all"
          >
            اليوم 🗓️
          </button>
          <button 
            onClick={() => setQuickDate('week')} 
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold border border-white/10 transition-all"
          >
            هذا الأسبوع 📅
          </button>
          <button 
            onClick={() => setQuickDate('month')} 
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold border border-white/10 transition-all"
          >
            هذا الشهر 📊
          </button>
          <button 
            onClick={() => setQuickDate('all')} 
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-amber-400 rounded-xl text-xs font-bold border border-amber-500/20 transition-all"
          >
            الكل 🌐
          </button>

          <div className="h-6 w-px bg-white/10 mx-1 hidden md:block" />

          <button 
            onClick={exportToPDF}
            disabled={isExporting}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-60"
          >
            <Printer size={16} />
            <span>{isExporting ? 'جاري تجهيز PDF...' : 'طباعة ومعاينة PDF 📄'}</span>
          </button>

          <button 
            onClick={() => exportToExcel()}
            disabled={isExporting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-60"
          >
            <FileSpreadsheet size={16} />
            <span>{isExporting ? 'جاري تجهيز الإكسل...' : 'تصدير إكسل 📊'}</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tab Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 p-1.5 bg-slate-900/80 rounded-2xl border border-white/10 shadow-lg">
        {[
          { id: 'unified_archive', label: 'أرشيف الفواتير', icon: History, color: 'text-amber-400' },
          { id: 'cashier_sales', label: 'مبيعات الكاشير', icon: ShoppingCart, color: 'text-emerald-400' },
          { id: 'inventory_audit', label: 'جرد المخزون', icon: Box, color: 'text-sky-400' },
          { id: 'profit_loss', label: 'الأرباح والميزانية', icon: TrendingUp, color: 'text-emerald-300' },
          { id: 'vaults_balances', label: 'حركة الأرصدة', icon: Wallet, color: 'text-cyan-400' },
          { id: 'maintenance_engineers', label: 'تقارير المهندسين', icon: Wrench, color: 'text-orange-400' },
          { id: 'trial_balance', label: 'ميزان المراجعة', icon: Scale, color: 'text-indigo-400' },
          { id: 'pricing_credit', label: 'التسعير والائتمان', icon: BarChart3, color: 'text-purple-400' },
          { id: 'exe_desktop_export', label: 'تقرير الكمبيوتر الشامل', icon: Monitor, color: 'text-amber-300' },
        ].map(tab => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-[11px] font-black transition-all gap-1.5 cursor-pointer ${
                isActive 
                  ? 'bg-gradient-to-b from-amber-500/20 to-amber-600/30 border border-amber-500/50 text-white shadow-lg scale-105' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <IconComp size={18} className={tab.color} />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date & Filter Toolbar Container */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-900/60 rounded-2xl border border-white/5 shadow-inner">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar size={18} className="text-amber-400" />
          <span className="text-xs font-bold text-gray-300">نطاق التاريخ:</span>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-950 text-white text-xs px-3 py-1.5 rounded-xl border border-white/10 outline-none focus:border-amber-500"
          />
          <span className="text-xs text-gray-500">إلى</span>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-950 text-white text-xs px-3 py-1.5 rounded-xl border border-white/10 outline-none focus:border-amber-500"
          />
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث باسم الصنف، العميل، أو الفاتورة..."
            className="w-full bg-slate-950 text-white text-xs pr-9 pl-3 py-2 rounded-xl border border-white/10 outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Export Printable Container wrapper */}
      <div id="report-export-container" className="space-y-6">

        {/* TAB 1: UNIFIED ARCHIVE */}
        {activeTab === 'unified_archive' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-2xl border border-white/5">
              <div className="flex gap-2">
                {[
                  { id: 'sales', label: 'أرشيف المبيعات 🛒', count: sales.length },
                  { id: 'maintenance', label: 'أرشيف الصيانة 🛠️', count: maintenanceOrders.length },
                  { id: 'purchases', label: 'أرشيف المشتريات 📦', count: purchases.length },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setArchiveSubTab(sub.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      archiveSubTab === sub.id ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{sub.label}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-950/40 text-[10px] font-mono">{sub.count}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => exportToExcel(
                    archiveSubTab === 'sales' ? filteredSales : archiveSubTab === 'maintenance' ? filteredMaintenance : filteredPurchases,
                    `أرشيف_${archiveSubTab}`
                  )}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>تصدير اكسل 📊</span>
                </button>
              </div>
            </div>

            {/* Archive Data Table */}
            <div className="bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-gray-400 font-bold border-b border-white/10">
                    {archiveSubTab === 'maintenance' ? (
                      <tr>
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">العميل والجوال</th>
                        <th className="p-3">الجهاز والعطل</th>
                        <th className="p-3">المهندس</th>
                        <th className="p-3">الحالة</th>
                        <th className="p-3">التكلفة</th>
                        <th className="p-3 text-center">الإجراءات</th>
                      </tr>
                    ) : archiveSubTab === 'sales' ? (
                      <tr>
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">رقم الفاتورة</th>
                        <th className="p-3">الأصناف والتفاصيل</th>
                        <th className="p-3">طريقة الدفع</th>
                        <th className="p-3">الكاشير / الموظف</th>
                        <th className="p-3">الإجمالي</th>
                        <th className="p-3 text-center">الإجراءات</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">اسم الصنف</th>
                        <th className="p-3">الكمية</th>
                        <th className="p-3">سعر التكلفة</th>
                        <th className="p-3">المورد</th>
                        <th className="p-3">الإجمالي</th>
                        <th className="p-3 text-center">الإجراءات</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {archiveSubTab === 'maintenance' ? (
                      filteredMaintenance.map(order => (
                        <tr key={order.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 text-gray-400">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('ar-EG') : '...'}</td>
                          <td className="p-3 font-bold text-white">
                            <div>{order.customerName}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{order.customerPhone}</div>
                          </td>
                          <td className="p-3 text-amber-300">
                            <div>{order.deviceModel}</div>
                            <div className="text-[10px] text-gray-400">{order.issue}</div>
                          </td>
                          <td className="p-3 text-gray-300">{order.engineerName || 'عام'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              order.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              order.status === 'ready' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                              'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {order.status === 'delivered' ? 'تم التسليم ✅' : order.status === 'ready' ? 'جاهز 🎯' : 'قيد العمل 🛠️'}
                            </span>
                          </td>
                          <td className="p-3 font-black text-emerald-400">{Number(order.cost).toLocaleString()} ر.ي</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => toggleExpand(order.id)} className="p-1.5 hover:bg-white/10 rounded-lg text-amber-400 cursor-pointer">
                                <Eye size={14} />
                              </button>
                              {canEdit && (
                                <button onClick={() => handleRequestDelete(order)} className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg cursor-pointer">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : archiveSubTab === 'sales' ? (
                      filteredSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 text-gray-400">{sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleDateString('ar-EG') : '...'}</td>
                          <td className="p-3 font-mono font-bold text-amber-400">#{(sale.id || '').slice(-6)}</td>
                          <td className="p-3 text-gray-300">
                            {sale.items?.slice(0, 2).map((it: any, i: number) => (
                              <span key={i} className="inline-block bg-slate-950 px-1.5 py-0.5 rounded text-[10px] ml-1">
                                {it.name} (×{it.quantity})
                              </span>
                            ))}
                            {sale.items?.length > 2 && <span className="text-[10px] text-gray-500">+{sale.items.length - 2} أصناف</span>}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-950 rounded text-[10px] text-gray-300 font-bold border border-white/10">
                              {sale.paymentMethod === 'cash' ? 'نقدي 💵' : sale.paymentMethod === 'card' ? 'بطاقة 💳' : 'دين 📜'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-300">{sale.addedByName || sale.cashierName || 'كاشير العامة'}</td>
                          <td className="p-3 font-black text-emerald-400">{Number(sale.total).toLocaleString()} ر.ي</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => toggleExpand(sale.id)} className="p-1.5 hover:bg-white/10 rounded-lg text-amber-400 cursor-pointer">
                                <Eye size={14} />
                              </button>
                              {canEdit && (
                                <button onClick={() => handleRequestDelete(sale)} className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg cursor-pointer">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      filteredPurchases.map(p => (
                        <tr key={p.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 text-gray-400">{p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('ar-EG') : '...'}</td>
                          <td className="p-3 font-bold text-white">{p.itemName}</td>
                          <td className="p-3 font-mono text-amber-300">{p.quantity}</td>
                          <td className="p-3 font-mono">{Number(p.cost).toLocaleString()} ر.ي</td>
                          <td className="p-3 text-gray-300">{p.supplierName || 'مورد عام'}</td>
                          <td className="p-3 font-black text-emerald-400">{(Number(p.quantity) * Number(p.cost)).toLocaleString()} ر.ي</td>
                          <td className="p-3 text-center">
                            {canEdit && (
                              <button onClick={() => handleRequestDelete(p)} className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg cursor-pointer">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CASHIER SALES REPORT */}
        {activeTab === 'cashier_sales' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 p-5 rounded-2xl border border-emerald-500/20 shadow-xl">
                <p className="text-xs text-gray-400 font-bold">إجمالي مبيعات الكاشير</p>
                <p className="text-2xl font-black text-emerald-400 mt-2">
                  {financialMetrics.totalSalesRevenue.toLocaleString()} <span className="text-xs">ر.ي</span>
                </p>
                <div className="text-[10px] text-gray-500 mt-1">من إجمالي {sales.length} عملية بيع</div>
              </div>

              <div className="bg-slate-900/80 p-5 rounded-2xl border border-sky-500/20 shadow-xl">
                <p className="text-xs text-gray-400 font-bold">المبالغ النقدية الكاش 💵</p>
                <p className="text-2xl font-black text-sky-400 mt-2">
                  {cashierMetrics.reduce((a, c) => a + c.cashTotal, 0).toLocaleString()} <span className="text-xs">ر.ي</span>
                </p>
                <div className="text-[10px] text-gray-500 mt-1">صناديق الكاشير المباشرة</div>
              </div>

              <div className="bg-slate-900/80 p-5 rounded-2xl border border-amber-500/20 shadow-xl">
                <p className="text-xs text-gray-400 font-bold">المبيعات الآجلة (الديون) 📜</p>
                <p className="text-2xl font-black text-amber-400 mt-2">
                  {cashierMetrics.reduce((a, c) => a + c.debtTotal, 0).toLocaleString()} <span className="text-xs">ر.ي</span>
                </p>
                <div className="text-[10px] text-gray-500 mt-1">مرحلة لحسابات العملاء</div>
              </div>

              <div className="bg-slate-900/80 p-5 rounded-2xl border border-purple-500/20 shadow-xl">
                <p className="text-xs text-gray-400 font-bold">إجمالي الخصومات الممنوحة 🏷️</p>
                <p className="text-2xl font-black text-purple-400 mt-2">
                  {cashierMetrics.reduce((a, c) => a + c.totalDiscount, 0).toLocaleString()} <span className="text-xs">ر.ي</span>
                </p>
                <div className="text-[10px] text-gray-500 mt-1">تخفيضات الفواتير الممنوحة للعملاء</div>
              </div>
            </div>

            {/* Cashier Table */}
            <div className="bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <UserCheck size={18} className="text-amber-400" />
                  أداء الموظفين والكاشير التفصيلي
                </h3>
                <button 
                  onClick={() => exportToExcel(cashierMetrics, 'تقارير_الكاشير')}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>تصدير تقرير الكاشير 📊</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-gray-400 font-bold border-b border-white/10">
                    <tr>
                      <th className="p-3">اسم الموظف / الكاشير</th>
                      <th className="p-3">عدد الفواتير</th>
                      <th className="p-3">عدد القطع المباعة</th>
                      <th className="p-3">مبيعات كاش 💵</th>
                      <th className="p-3">مبيعات آجل 📜</th>
                      <th className="p-3">إجمالي الإيراد</th>
                      <th className="p-3">متوسط الفاتورة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {cashierMetrics.map((cm, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-bold text-amber-300 flex items-center gap-2">
                          <Award size={14} className="text-amber-400" />
                          <span>{cm.cashierName}</span>
                        </td>
                        <td className="p-3 font-mono">{cm.totalInvoices} فاتورة</td>
                        <td className="p-3 font-mono">{cm.totalItemsSold} قطعة</td>
                        <td className="p-3 font-mono text-emerald-400">{cm.cashTotal.toLocaleString()} ر.ي</td>
                        <td className="p-3 font-mono text-amber-400">{cm.debtTotal.toLocaleString()} ر.ي</td>
                        <td className="p-3 font-black text-white">{cm.totalRevenue.toLocaleString()} ر.ي</td>
                        <td className="p-3 font-mono text-sky-400">
                          {cm.totalInvoices > 0 ? Math.round(cm.totalRevenue / cm.totalInvoices).toLocaleString() : 0} ر.ي
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: INVENTORY AUDIT & VALUATION */}
        {activeTab === 'inventory_audit' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 p-5 rounded-2xl border border-sky-500/20 shadow-xl">
                <p className="text-xs text-gray-400 font-bold">إجمالي الأصناف بالمخزن</p>
                <p className="text-2xl font-black text-sky-400 mt-2">
                  {inventoryMetrics.totalItems} <span className="text-xs">صنف</span>
                </p>
                <div className="text-[10px] text-gray-500 mt-1">إجمالي القطع: {inventoryMetrics.totalStockQty.toLocaleString()} قطعة</div>
              </div>

              <div className="bg-slate-900/80 p-5 rounded-2xl border border-amber-500/20 shadow-xl">
                <p className="text-xs text-gray-400 font-bold">تقييم المخزون بسعر التكلفة 💰</p>
                <p className="text-2xl font-black text-amber-400 mt-2">
                  {inventoryMetrics.totalCostValuation.toLocaleString()} <span className="text-xs">ر.ي</span>
                </p>
                <div className="text-[10px] text-gray-500 mt-1">رأس المال المستثمر بالمخزون</div>
              </div>

              <div className="bg-slate-900/80 p-5 rounded-2xl border border-emerald-500/20 shadow-xl">
                <p className="text-xs text-gray-400 font-bold">تقييم المخزون بسعر البيع (المتوقع)</p>
                <p className="text-2xl font-black text-emerald-400 mt-2">
                  {inventoryMetrics.totalRetailValuation.toLocaleString()} <span className="text-xs">ر.ي</span>
                </p>
                <div className="text-[10px] text-gray-500 mt-1">إجمالي القيمة السوقية متوقعة</div>
              </div>

              <div className="bg-slate-900/80 p-5 rounded-2xl border border-indigo-500/20 shadow-xl">
                <p className="text-xs text-gray-400 font-bold">الربح المتوقع للمخزون (هامش الربح)</p>
                <p className="text-2xl font-black text-indigo-400 mt-2">
                  {inventoryMetrics.potentialGrossProfit.toLocaleString()} <span className="text-xs">ر.ي ({inventoryMetrics.profitMarginPct}%)</span>
                </p>
                <div className="text-[10px] text-gray-500 mt-1">نواقص: {inventoryMetrics.lowStockCount} | منتهي: {inventoryMetrics.outOfStockCount}</div>
              </div>
            </div>

            {/* Inventory Valuation Sheet Table */}
            <div className="bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <PackageCheck size={18} className="text-sky-400" />
                  جدول كشف جرد المخزون والتقييم المالي
                </h3>
                <button 
                  onClick={() => exportToExcel(inventory.map(i => ({
                    'اسم الصنف': i.name,
                    'الباركود': i.barcode || '',
                    'الكمية المتوفرة': i.stock || 0,
                    'سعر التكلفة': i.cost || 0,
                    'سعر البيع': i.price || 0,
                    'إجمالي التكلفة': (i.stock || 0) * (i.cost || 0),
                    'إجمالي قيمة البيع': (i.stock || 0) * (i.price || 0)
                  })), 'جرد_المخزون')}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>تصدير كشف الجرد (Excel) 📊</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-gray-400 font-bold border-b border-white/10">
                    <tr>
                      <th className="p-3">الصنف والباركود</th>
                      <th className="p-3">الفئة</th>
                      <th className="p-3">الكمية بالمخزن</th>
                      <th className="p-3">سعر التكلفة</th>
                      <th className="p-3">سعر البيع</th>
                      <th className="p-3">إجمالي قيم التكلفة</th>
                      <th className="p-3">هامش الربح المتوقع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {inventory.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map((item, idx) => {
                      const stock = Number(item.stock) || 0;
                      const cost = Number(item.cost) || 0;
                      const price = Number(item.price) || 0;
                      const totalCost = stock * cost;
                      const totalProfit = (price - cost) * stock;

                      return (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-bold text-white">
                            <div>{item.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{item.barcode}</div>
                          </td>
                          <td className="p-3 text-gray-400">{item.category || 'عام'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              stock === 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                              stock <= 5 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {stock} حبة
                            </span>
                          </td>
                          <td className="p-3 font-mono text-gray-300">{cost.toLocaleString()} ر.ي</td>
                          <td className="p-3 font-mono text-amber-400">{price.toLocaleString()} ر.ي</td>
                          <td className="p-3 font-mono font-bold text-sky-400">{totalCost.toLocaleString()} ر.ي</td>
                          <td className="p-3 font-mono text-emerald-400">{totalProfit.toLocaleString()} ر.ي</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROFIT & LOSS AND BALANCE SHEET */}
        {activeTab === 'profit_loss' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Profit & Loss Statement Card */}
              <div className="bg-slate-900/80 p-6 rounded-3xl border border-emerald-500/30 shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <TrendingUp className="text-emerald-400" size={22} />
                    قائمة الأرباح والخسائر الشاملة (P&L Statement)
                  </h3>
                  <span className="text-xs text-gray-400 font-mono">البيانات الحالية</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between p-2.5 bg-slate-950/60 rounded-xl">
                    <span className="text-gray-300 font-bold">إجمالي مبيعات البضائع 🛒</span>
                    <span className="font-mono font-bold text-emerald-400">{financialMetrics.totalSalesRevenue.toLocaleString()} ر.ي</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950/60 rounded-xl">
                    <span className="text-gray-300 font-bold">إجمالي إيرادات الصيانة والخدمات 🛠️</span>
                    <span className="font-mono font-bold text-emerald-400">{financialMetrics.totalMaintenanceRevenue.toLocaleString()} ر.ي</span>
                  </div>
                  <div className="flex justify-between p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <span className="text-white font-black">إجمالي الإيرادات الكلية</span>
                    <span className="font-mono font-black text-emerald-300 text-sm">{financialMetrics.grossRevenue.toLocaleString()} ر.ي</span>
                  </div>

                  <div className="h-px bg-white/10 my-2" />

                  <div className="flex justify-between p-2.5 bg-slate-950/60 rounded-xl">
                    <span className="text-gray-300 font-bold">تكلفة البضائع المباعة (COGS)</span>
                    <span className="font-mono font-bold text-rose-400">-{financialMetrics.totalCOGS.toLocaleString()} ر.ي</span>
                  </div>
                  <div className="flex justify-between p-3 bg-sky-500/10 rounded-xl border border-sky-500/20">
                    <span className="text-white font-black">مجمل الربح (Gross Profit)</span>
                    <span className="font-mono font-black text-sky-300 text-sm">{financialMetrics.grossProfit.toLocaleString()} ر.ي</span>
                  </div>

                  <div className="h-px bg-white/10 my-2" />

                  <div className="flex justify-between p-2.5 bg-slate-950/60 rounded-xl">
                    <span className="text-gray-300 font-bold">المصروفات التشغيلية والرواتب 💸</span>
                    <span className="font-mono font-bold text-rose-400">-{financialMetrics.totalOperatingExpenses.toLocaleString()} ر.ي</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950/60 rounded-xl">
                    <span className="text-gray-300 font-bold">خسائر التالف والتخريد ⚠️</span>
                    <span className="font-mono font-bold text-rose-400">-{financialMetrics.damagedItemsLoss.toLocaleString()} ر.ي</span>
                  </div>

                  <div className={`flex justify-between p-4 rounded-2xl border shadow-xl ${
                    financialMetrics.netProfit >= 0 
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-gradient-to-r from-rose-500/20 to-red-500/30 border-rose-500/40 text-rose-300'
                  }`}>
                    <span className="font-black text-sm">صافي الربح / الخسارة النهائي 🏁</span>
                    <span className="font-mono font-black text-lg">{financialMetrics.netProfit.toLocaleString()} ر.ي</span>
                  </div>
                </div>
              </div>

              {/* Balance Sheet Statement Card */}
              <div className="bg-slate-900/80 p-6 rounded-3xl border border-sky-500/30 shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Scale className="text-sky-400" size={22} />
                    الميزانية العمومية والمركز المالي (Balance Sheet)
                  </h3>
                  <span className="text-xs text-gray-400 font-mono">الأصول والالتزامات</span>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-amber-400 font-bold">1. الأصول (Assets):</p>
                  <div className="flex justify-between p-2.5 bg-slate-950/60 rounded-xl">
                    <span className="text-gray-300">السيولة النقدية والسناديق 🏦</span>
                    <span className="font-mono font-bold text-sky-400">{financialMetrics.totalCashVaultsBalance.toLocaleString()} ر.ي</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950/60 rounded-xl">
                    <span className="text-gray-300">ذمم العملاء الديون المستحقة 📜</span>
                    <span className="font-mono font-bold text-sky-400">{financialMetrics.totalCustomerDebts.toLocaleString()} ر.ي</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950/60 rounded-xl">
                    <span className="text-gray-300">بضاعة المخزون بسعر التكلفة 📦</span>
                    <span className="font-mono font-bold text-sky-400">{financialMetrics.totalInventoryValue.toLocaleString()} ر.ي</span>
                  </div>
                  <div className="flex justify-between p-3 bg-sky-500/10 rounded-xl border border-sky-500/20">
                    <span className="text-white font-black">مجموع الأصول والسيولة الكلي</span>
                    <span className="font-mono font-black text-sky-300 text-sm">{financialMetrics.totalAssets.toLocaleString()} ر.I</span>
                  </div>

                  <div className="h-px bg-white/10 my-2" />

                  <p className="text-rose-400 font-bold">2. الالتزامات (Liabilities):</p>
                  <div className="flex justify-between p-2.5 bg-slate-950/60 rounded-xl">
                    <span className="text-gray-300">مستحقات الموردين والشركات 🚚</span>
                    <span className="font-mono font-bold text-rose-400">{financialMetrics.totalSupplierPayables.toLocaleString()} ر.ي</span>
                  </div>

                  <div className="h-px bg-white/10 my-2" />

                  <p className="text-emerald-400 font-bold">3. حقوق الملكية والصافي (Equity):</p>
                  <div className="flex justify-between p-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/30 rounded-2xl border border-indigo-500/40 text-indigo-300">
                    <span className="font-black text-sm">صافي رأس المال العقيق بالمتجر</span>
                    <span className="font-mono font-black text-lg">{financialMetrics.netEquity.toLocaleString()} ر.ي</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 5: VAULTS & BALANCE MOVEMENT */}
        {activeTab === 'vaults_balances' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map(acc => (
                <div key={acc.id} className="bg-slate-900/80 p-5 rounded-2xl border border-white/10 shadow-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-300">{acc.name}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-bold">
                      {acc.type === 'bank' ? 'بنكي / محفظة 💳' : 'صندوق كاش 💵'}
                    </span>
                  </div>
                  <p className="text-2xl font-black text-emerald-400 mt-2">
                    {Number(acc.balance || 0).toLocaleString()} <span className="text-xs">ر.ي</span>
                  </p>
                  <p className="text-[10px] text-gray-500">حساب رقم: {acc.id?.slice(0, 8)}</p>
                </div>
              ))}
            </div>

            {/* Transactions Log */}
            <div className="bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl p-4 space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Wallet size={18} className="text-cyan-400" />
                سجل حركة الأرصدة والتحويلات المالية
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-gray-400 font-bold border-b border-white/10">
                    <tr>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">نوع الحركة</th>
                      <th className="p-3">النوع / الفئة</th>
                      <th className="p-3">التفاصيل والبيان</th>
                      <th className="p-3">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.slice(0, 30).map(t => (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-gray-400">{t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('ar-EG') : '...'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.type === 'inflow' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {t.type === 'inflow' ? 'قبض / توريد 🟢' : 'صرف / دفع 🔴'}
                          </span>
                        </td>
                        <td className="p-3 text-amber-300">{t.category || 'عام'}</td>
                        <td className="p-3 text-gray-300">{t.details || t.description || 'معاملة مالية'}</td>
                        <td className={`p-3 font-mono font-black ${t.type === 'inflow' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.type === 'inflow' ? '+' : '-'}{Number(t.amount).toLocaleString()} ر.ي
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: MAINTENANCE & ENGINEERS REPORT */}
        {activeTab === 'maintenance_engineers' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Wrench size={18} className="text-orange-400" />
                  تقارير وإحصائيات أداء المهندسين والفنيين
                </h3>
                <button 
                  onClick={() => exportToExcel(engineerMetrics, 'تقارير_المهندسين')}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>تصدير تقرير المهندسين 📊</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-gray-400 font-bold border-b border-white/10">
                    <tr>
                      <th className="p-3">اسم المهندس</th>
                      <th className="p-3">إجمالي الأجهزة</th>
                      <th className="p-3">تم تسليمها</th>
                      <th className="p-3">جاهزة للاستلام</th>
                      <th className="p-3">إجمالي إيراد الصيانة</th>
                      <th className="p-3">تكلفة قطع الغيار المستهلكة</th>
                      <th className="p-3">صافي ربح أجور العمل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {engineerMetrics.map((eng, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-bold text-amber-300 flex items-center gap-2">
                          <Wrench size={14} className="text-orange-400" />
                          <span>{eng.engineerName}</span>
                        </td>
                        <td className="p-3 font-mono">{eng.totalOrders} جهاز</td>
                        <td className="p-3 font-mono text-emerald-400">{eng.deliveredOrders}</td>
                        <td className="p-3 font-mono text-sky-400">{eng.readyOrders}</td>
                        <td className="p-3 font-mono font-bold text-white">{eng.totalRevenue.toLocaleString()} ر.ي</td>
                        <td className="p-3 font-mono text-rose-400">{eng.partsCost.toLocaleString()} ر.ي</td>
                        <td className="p-3 font-black text-emerald-400">{eng.netServiceProfit.toLocaleString()} ر.ي</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: TRIAL BALANCE & GENERAL LEDGER */}
        {activeTab === 'trial_balance' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Scale size={18} className="text-indigo-400" />
                  ميزان المراجعة المحاسبي العام (Trial Balance)
                </h3>
                <div className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold">
                  توازن الميزان: متوازن ⚖️
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-gray-400 font-bold border-b border-white/10">
                    <tr>
                      <th className="p-3">رمز / اسم الحساب</th>
                      <th className="p-3">طبيعة الحساب</th>
                      <th className="p-3">الأرصدة المدينة (Debit)</th>
                      <th className="p-3">الأرصدة الدائنة (Credit)</th>
                      <th className="p-3">الرصيد الصافي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">1001 - صندوق النقدية الكاش</td>
                      <td className="p-3 text-sky-400">أصول دائنة/مدينة</td>
                      <td className="p-3 font-mono text-emerald-400">{financialMetrics.totalCashVaultsBalance.toLocaleString()} ر.ي</td>
                      <td className="p-3 font-mono text-gray-500">0 ر.ي</td>
                      <td className="p-3 font-mono font-bold text-emerald-300">{financialMetrics.totalCashVaultsBalance.toLocaleString()} ر.ي</td>
                    </tr>
                    <tr className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">1002 - ذمم العملاء (الديون)</td>
                      <td className="p-3 text-sky-400">أصول متداولة</td>
                      <td className="p-3 font-mono text-emerald-400">{financialMetrics.totalCustomerDebts.toLocaleString()} ر.ي</td>
                      <td className="p-3 font-mono text-gray-500">0 ر.ي</td>
                      <td className="p-3 font-mono font-bold text-emerald-300">{financialMetrics.totalCustomerDebts.toLocaleString()} ر.ي</td>
                    </tr>
                    <tr className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">1003 - مخزون البضائع المتاحة</td>
                      <td className="p-3 text-sky-400">أصول متداولة</td>
                      <td className="p-3 font-mono text-emerald-400">{financialMetrics.totalInventoryValue.toLocaleString()} ر.ي</td>
                      <td className="p-3 font-mono text-gray-500">0 ر.ي</td>
                      <td className="p-3 font-mono font-bold text-emerald-300">{financialMetrics.totalInventoryValue.toLocaleString()} ر.ي</td>
                    </tr>
                    <tr className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">2001 - مستحقات الموردين والشركات</td>
                      <td className="p-3 text-rose-400">التزامات متداولة</td>
                      <td className="p-3 font-mono text-gray-500">0 ر.ي</td>
                      <td className="p-3 font-mono text-rose-400">{financialMetrics.totalSupplierPayables.toLocaleString()} ر.ي</td>
                      <td className="p-3 font-mono font-bold text-rose-300">-{financialMetrics.totalSupplierPayables.toLocaleString()} ر.ي</td>
                    </tr>
                    <tr className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">4001 - إيراد المبيعات والصيانة</td>
                      <td className="p-3 text-purple-400">إيرادات النشاط</td>
                      <td className="p-3 font-mono text-gray-500">0 ر.ي</td>
                      <td className="p-3 font-mono text-purple-400">{financialMetrics.grossRevenue.toLocaleString()} ر.ي</td>
                      <td className="p-3 font-mono font-bold text-purple-300">{financialMetrics.grossRevenue.toLocaleString()} ر.ي</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: PRICING & CREDIT ANALYTICS */}
        {activeTab === 'pricing_credit' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Product Pricing Margins */}
              <div className="bg-slate-900/80 p-5 rounded-2xl border border-purple-500/30 shadow-xl space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <BarChart3 size={18} className="text-purple-400" />
                  تحليل هامش الربح وتوازن الأسعار بالأصناف
                </h3>

                <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
                  {inventory.slice(0, 10).map((it, idx) => {
                    const cost = Number(it.cost) || 1;
                    const price = Number(it.price) || 1;
                    const marginPct = (((price - cost) / cost) * 100).toFixed(0);
                    return (
                      <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-950/80 rounded-xl border border-white/5 text-xs">
                        <div>
                          <p className="font-bold text-white">{it.name}</p>
                          <p className="text-[10px] text-gray-400">تكلفة: {cost} ر.ي | بيع: {price} ر.ي</p>
                        </div>
                        <span className={`px-2 py-1 rounded font-mono font-bold text-xs ${
                          Number(marginPct) >= 20 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          هامش: +{marginPct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Customer Debt Risk Assessment */}
              <div className="bg-slate-900/80 p-5 rounded-2xl border border-amber-500/30 shadow-xl space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <AlertOctagon size={18} className="text-amber-400" />
                  تقييم مخاطر الائتمان لديون العملاء
                </h3>

                <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
                  {customers.filter(c => Number(c.debt) > 0).map((cust, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-950/80 rounded-xl border border-white/5 text-xs">
                      <div>
                        <p className="font-bold text-white">{cust.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{cust.phone}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-black text-rose-400 font-mono">{Number(cust.debt).toLocaleString()} ر.ي</p>
                        <span className="text-[10px] text-amber-400 font-bold">مخاطرة متوسطة</span>
                      </div>
                    </div>
                  ))}
                  {customers.filter(c => Number(c.debt) > 0).length === 0 && (
                    <p className="text-xs text-gray-500 italic p-4 text-center">لا توجد ديون مستحقة على العملاء حالياً 🎉</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 9: DESKTOP COMPREHENSIVE MASTER REPORT */}
        {activeTab === 'exe_desktop_export' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-900 via-navy-900 to-slate-950 p-6 md:p-8 rounded-3xl border border-amber-500/30 shadow-2xl space-y-6">
              
              {/* Header section */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-500/30 to-amber-600/10 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/40 shadow-xl shrink-0">
                    <Monitor size={30} />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                      التقرير المالي والمخزني الشامل لشاشات الكمبيوتر والطباعة 🖥️
                    </h2>
                    <p className="text-xs text-gray-300 mt-1">
                      ملف تنفيذي وبياني فائق الدقة يجمع كل مؤشرات المحل (المبيعات، الصيانة، المخزون، الحسابات، الأرباح وميزان المراجعة) في مستند موحد.
                    </p>
                  </div>
                </div>

                {/* Primary Export Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                  <button 
                    onClick={exportMasterDesktopReport}
                    disabled={isExporting}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                  >
                    <FileSpreadsheet size={16} />
                    <span>تصدير ملف إكسل شامل متعدد الجداول 📊</span>
                  </button>

                  <button 
                    onClick={exportToPDF}
                    disabled={isExporting}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                  >
                    <Printer size={16} />
                    <span>طباعة التقرير الكامل / PDF 🖨️</span>
                  </button>
                </div>
              </div>

              {/* High-level KPI grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-[11px] text-gray-400 font-bold">إجمالي الإيرادات الكلية</span>
                  <p className="text-lg md:text-xl font-black text-emerald-400 font-mono">
                    {financialMetrics.grossRevenue.toLocaleString()} <span className="text-xs font-sans">ر.ي</span>
                  </p>
                </div>

                <div className="bg-slate-950/70 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-[11px] text-gray-400 font-bold">صافي الربح التجاري</span>
                  <p className="text-lg md:text-xl font-black text-emerald-300 font-mono">
                    {financialMetrics.netProfit.toLocaleString()} <span className="text-xs font-sans">ر.ي</span>
                  </p>
                </div>

                <div className="bg-slate-950/70 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-[11px] text-gray-400 font-bold">قيمة المخزون الإجمالية</span>
                  <p className="text-lg md:text-xl font-black text-sky-400 font-mono">
                    {financialMetrics.totalInventoryValue.toLocaleString()} <span className="text-xs font-sans">ر.ي</span>
                  </p>
                </div>

                <div className="bg-slate-950/70 p-4 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-[11px] text-gray-400 font-bold">ديون العملاء المعلقة</span>
                  <p className="text-lg md:text-xl font-black text-rose-400 font-mono">
                    {financialMetrics.totalCustomerDebts.toLocaleString()} <span className="text-xs font-sans">ر.ي</span>
                  </p>
                </div>
              </div>

              {/* Master Visual Summary Sheet Preview */}
              <div className="bg-slate-950/90 rounded-2xl border border-white/10 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <FileText size={18} className="text-amber-400" />
                    معاينة البيانات المالية الشاملة للمؤسسة
                  </h3>
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date().toLocaleDateString('ar-YE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Revenue & Profit column */}
                  <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-white/5">
                    <p className="font-black text-amber-400 border-b border-white/10 pb-1.5 flex items-center gap-1.5">
                      <TrendingUp size={14} />
                      قائمة الإيرادات والأرباح التشغيلية
                    </p>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-300">مبيعات المنتجات والكاشير:</span>
                      <span className="font-mono text-emerald-400 font-bold">{financialMetrics.totalSalesRevenue.toLocaleString()} ر.ي</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-300">إيرادات كروت الصيانة والخدمات:</span>
                      <span className="font-mono text-emerald-400 font-bold">{financialMetrics.totalMaintenanceRevenue.toLocaleString()} ر.ي</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-300">تكلفة البضائع وقطع الغيار (COGS):</span>
                      <span className="font-mono text-rose-400 font-bold">-{financialMetrics.totalCOGS.toLocaleString()} ر.ي</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-300">المصروفات والتوالف التشغيلية:</span>
                      <span className="font-mono text-rose-400 font-bold">-{financialMetrics.totalOperatingExpenses.toLocaleString()} ر.ي</span>
                    </div>
                    <div className="flex justify-between pt-2 text-white font-black text-sm">
                      <span>صافي الأرباح المحققة:</span>
                      <span className="font-mono text-emerald-300">{financialMetrics.netProfit.toLocaleString()} ر.ي</span>
                    </div>
                  </div>

                  {/* Balance Sheet & Asset column */}
                  <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-white/5">
                    <p className="font-black text-sky-400 border-b border-white/10 pb-1.5 flex items-center gap-1.5">
                      <Landmark size={14} />
                      المركز المالي والأرصدة والمخزون
                    </p>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-300">النقدية بالخزن والحسابات البنكية:</span>
                      <span className="font-mono text-emerald-400 font-bold">{financialMetrics.totalCashVaultsBalance.toLocaleString()} ر.ي</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-300">قيمة البضاعة المخزنة (سعر التكلفة):</span>
                      <span className="font-mono text-sky-300 font-bold">{financialMetrics.totalInventoryValue.toLocaleString()} ر.ي</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-300">أرصدة ديون العملاء (الذمم المدينة):</span>
                      <span className="font-mono text-amber-300 font-bold">{financialMetrics.totalCustomerDebts.toLocaleString()} ر.ي</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-300">مستحقات الموردين والشركات (الدائنة):</span>
                      <span className="font-mono text-rose-400 font-bold">-{financialMetrics.totalSupplierPayables.toLocaleString()} ر.ي</span>
                    </div>
                    <div className="flex justify-between pt-2 text-white font-black text-sm">
                      <span>صافي رأس المال وحقوق الملكية:</span>
                      <span className="font-mono text-cyan-300">{financialMetrics.netEquity.toLocaleString()} ر.ي</span>
                    </div>
                  </div>
                </div>

                {/* Sub-tables breakdown chips */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-gray-400 font-bold">الأقسام المشمولة في التقرير الشامل:</span>
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-lg">🛒 {sales.length} فاتورة مبيعات</span>
                    <span className="px-2.5 py-1 bg-sky-500/10 text-sky-300 border border-sky-500/20 rounded-lg">🛠️ {maintenanceOrders.length} كرت صيانة</span>
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-lg">📦 {inventory.length} صنف بالمخزن</span>
                    <span className="px-2.5 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-lg">💳 {accounts.length} حساب مالي</span>
                  </div>

                  <button 
                    onClick={exportMasterDesktopReport}
                    className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download size={14} />
                    <span>تنزيل التقرير الموحد (.xlsx)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Item Details Drawer Modal */}
      <AnimatePresence>
        {expandedItems.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl max-w-xl w-full space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="font-black text-white text-sm flex items-center gap-2">
                  <FileText size={18} className="text-amber-400" />
                  معاينة التفاصيل الكاملة للمعاملة
                </h3>
                <button onClick={() => setExpandedItems([])} className="p-1 hover:bg-white/10 rounded-full text-gray-400">
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-gray-300">تم جلب كافة تفاصيل المعاملة بنجاح من الأرشيف الموحد.</p>

              <div className="pt-2 flex justify-end">
                <button 
                  onClick={() => setExpandedItems([])}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
                >
                  إغلاق ✖️
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDelete}
        title="تأكيد الحذف والتراجع"
        message={`هل أنت متأكد من الحذف؟ سيتم التراجع عن التأثيرات المالية والتوريدية تلقائياً وإعادة الكميات للمخزن.`}
        confirmText="تأكيد التراجع والحذف"
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-xs ${
              status.type === 'success' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{status.message}</span>
            <button onClick={() => setStatus(null)} className="p-1 hover:bg-black/10 rounded-full">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
