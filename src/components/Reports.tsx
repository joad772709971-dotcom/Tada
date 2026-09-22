import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle, 
  CheckCircle2,
  Calendar,
  Download,
  Filter,
  Search,
  Users
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, where, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MaintenanceOrder, InventoryItem, Transaction, UserProfile, Customer } from '../types';
import { motion } from 'motion/react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { secureFileExport } from '../services/securityService';
import { downloadOrExportFile } from '../utils/fileDownloader';
import { UniversalReportButton } from './UniversalReportButton';
import { UniversalReportPayload } from '../services/UniversalReportService';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

interface ReportsProps {
  profile: UserProfile | null;
}

export default function Reports({ profile }: ReportsProps) {
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('today');
  const [isExporting, setIsExporting] = useState(false);

  // Currency & Exchange Rate State
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({ YER: 1, SAR: 140, USD: 530 });
  const [reportCurrency, setReportCurrency] = useState<'YER' | 'SAR' | 'USD'>('YER');

  // Local Converter State
  const [convertAmount, setConvertAmount] = useState<string>('100');
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('YER');
  const [conversionResult, setConversionResult] = useState<number>(53000);
  const [customRate, setCustomRate] = useState<string>('530');
  const [conversionLogs, setConversionLogs] = useState<string[]>([]);

  // Fetch settings dynamically from firestore for the active owner
  useEffect(() => {
    if (!profile?.ownerId) return;
    const unsubSettings = onSnapshot(doc(db, 'settings', profile.ownerId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.exchangeRates) {
          setExchangeRates({
            YER: 1,
            SAR: Number(data.exchangeRates.SAR) || 140,
            USD: Number(data.exchangeRates.USD) || 530,
          });
        }
      }
    });
    return () => unsubSettings();
  }, [profile?.ownerId]);

  // Handle changing from-currency to update default rate
  const handleFromCurrencyChange = (curr: string) => {
    setFromCurrency(curr);
    if (curr === 'USD') setCustomRate((exchangeRates.USD || 530).toString());
    else if (curr === 'SAR') setCustomRate((exchangeRates.SAR || 140).toString());
    else setCustomRate('1');
  };

  // Live conversion feedback effect
  useEffect(() => {
    const amt = Number(convertAmount) || 0;
    const rate = Number(customRate) || 1;

    let res = 0;
    if (fromCurrency === 'USD' && toCurrency === 'YER') {
      res = amt * rate;
    } else if (fromCurrency === 'YER' && toCurrency === 'USD') {
      res = amt / (rate || 1);
    } else if (fromCurrency === 'SAR' && toCurrency === 'YER') {
      res = amt * rate;
    } else if (fromCurrency === 'YER' && toCurrency === 'SAR') {
      res = amt / (rate || 1);
    } else if (fromCurrency === 'USD' && toCurrency === 'SAR') {
      const usdInYen = amt * (exchangeRates.USD || 530);
      res = usdInYen / (exchangeRates.SAR || 140);
    } else if (fromCurrency === 'SAR' && toCurrency === 'USD') {
      const sarInYen = amt * (exchangeRates.SAR || 140);
      res = sarInYen / (exchangeRates.USD || 530);
    } else {
      res = amt;
    }
    setConversionResult(res);
  }, [convertAmount, fromCurrency, toCurrency, customRate, exchangeRates]);

  const convertValue = (val: number) => {
    if (reportCurrency === 'YER') return val;
    const rate = exchangeRates[reportCurrency] || 1;
    return val / rate;
  };

  const formatValue = (val: number) => {
    const converted = convertValue(val);
    const symbol = reportCurrency === 'YER' ? 'ر.ي' : reportCurrency === 'SAR' ? 'سعودي' : 'دولار';
    return `${converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
  };

  const logConversion = () => {
    const amt = Number(convertAmount) || 0;
    const fromSymbol = fromCurrency === 'YER' ? 'ر.ي' : fromCurrency === 'SAR' ? 'سعودي' : 'دولار';
    const toSymbol = toCurrency === 'YER' ? 'ر.ي' : toCurrency === 'SAR' ? 'سعودي' : 'دولار';
    const formattedResult = conversionResult.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const logStr = `${amt.toLocaleString()} ${fromSymbol} ➔ ${formattedResult} ${toSymbol} (بسعر صرف ${customRate})`;
    setConversionLogs(prev => [logStr, ...prev.slice(0, 9)]);
  };

  const applyQuickConvert = (amt: number, from: string, to: string) => {
    setConvertAmount(amt.toString());
    setFromCurrency(from);
    setToCurrency(to);
    if (from === 'USD') setCustomRate((exchangeRates.USD || 530).toString());
    else if (from === 'SAR') setCustomRate((exchangeRates.SAR || 140).toString());
    else setCustomRate('1');
  };

  useEffect(() => {
    if (!profile?.ownerId) return;
    
    const isEmployee = profile?.role === 'employee';
    const isEngineer = profile?.role === 'engineer' || profile?.role === 'employee';
    const ownerFilter = where('ownerId', '==', profile.ownerId);

    const unsubUsers = onSnapshot(query(collection(db, 'users'), ownerFilter), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any)));
    });

    let qOrders = query(collection(db, 'maintenanceOrders'), ownerFilter);
    if (isEngineer) {
      qOrders = query(qOrders, where('engineerId', '==', profile.uid));
    }
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceOrder)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'maintenanceOrders');
    });

    const unsubInventory = onSnapshot(query(collection(db, 'inventory'), ownerFilter), (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    let qTransactions = query(collection(db, 'transactions'), ownerFilter);
    if (isEmployee) {
      qTransactions = query(qTransactions, where('addedBy', '==', profile.uid));
    }
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const unsubCustomers = onSnapshot(query(collection(db, 'customers'), ownerFilter), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    return () => {
      unsubUsers();
      unsubOrders();
      unsubInventory();
      unsubTransactions();
      unsubCustomers();
    };
  }, [profile?.ownerId, profile?.role, profile?.uid]);

  const exportToPDF = () => {
    setIsExporting(true);
    
    // Create a lightweight, clean HTML report container to prevent canvas thread freezing on APK
    const todayStr = new Date().toLocaleDateString('ar-YE');
    const currencyLabel = reportCurrency === 'YER' ? 'ريال يمني' : reportCurrency === 'SAR' ? 'ريال سعودي' : 'دولار أمريكي';
    const totalInventoryVal = formatValue(inventoryStats.totalValue);
    const totalDebtsVal = formatValue(inventoryStats.totalDebts);
    const netProfitVal = formatValue(profit);

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    tempContainer.style.width = '750px';
    tempContainer.style.padding = '25px';
    tempContainer.style.backgroundColor = '#ffffff';
    tempContainer.style.color = '#0f172a';
    tempContainer.style.fontFamily = 'Arial, sans-serif';
    tempContainer.style.direction = 'rtl';

    tempContainer.innerHTML = `
      <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; text-align: center;">
        <h1 style="font-size: 22px; margin: 0; color: #0284c7; font-weight: bold;">JAM SYSTEM PRO</h1>
        <p style="font-size: 14px; margin: 4px 0; color: #475569;">تقرير الجرد العام والمركز المالي الموحد</p>
        <p style="font-size: 12px; color: #64748b; margin: 0;">التاريخ: ${todayStr} | العملة: ${currencyLabel}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; text-align: center;">
          <span style="font-size: 11px; color: #64748b; display: block; font-weight: bold;">إجمالي قيمة المخزون</span>
          <strong style="font-size: 15px; color: #0284c7;">${totalInventoryVal}</strong>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; text-align: center;">
          <span style="font-size: 11px; color: #64748b; display: block; font-weight: bold;">إجمالي الديون القائمة</span>
          <strong style="font-size: 15px; color: #e11d48;">${totalDebtsVal}</strong>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; text-align: center;">
          <span style="font-size: 11px; color: #64748b; display: block; font-weight: bold;">صافي الأرباح الموقعة</span>
          <strong style="font-size: 15px; color: #059669;">${netProfitVal}</strong>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px;">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: right;">
            <th style="padding: 10px; border: 1px solid #cbd5e1;">اسم المنتج</th>
            <th style="padding: 10px; border: 1px solid #cbd5e1;">الكمية</th>
            <th style="padding: 10px; border: 1px solid #cbd5e1;">سعر التكلفة</th>
            <th style="padding: 10px; border: 1px solid #cbd5e1;">سعر البيع</th>
          </tr>
        </thead>
        <tbody>
          ${inventory.slice(0, 50).map(item => `
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${item.name || 'منتج غير مسمى'}</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${item.stock || 0}</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${formatValue(item.cost || 0)}</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${formatValue(item.price || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
        تم التوليد والتوثيق برمجياً عبر نظام JAM System Pro - كشف معتمد للأجهزة المحمولة والكمبيوتر
      </div>
    `;

    document.body.appendChild(tempContainer);

    setTimeout(() => {
      try {
        const filename = `تقرير_JAM_PRO_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.pdf`;
        const opt = secureFileExport.getProtectedHtml2PdfOptions(filename);

        html2pdf().set(opt).from(tempContainer).save().then(() => {
          setIsExporting(false);
          if (tempContainer.parentNode) document.body.removeChild(tempContainer);
        }).catch((pdfErr: any) => {
          console.warn('PDF export fallback:', pdfErr);
          setIsExporting(false);
          if (tempContainer.parentNode) document.body.removeChild(tempContainer);
          // Fallback to window print for total compatibility
          handlePrintReport('A4');
        });
      } catch (err) {
        console.error('PDF Generation exception:', err);
        setIsExporting(false);
        if (tempContainer.parentNode) document.body.removeChild(tempContainer);
        handlePrintReport('A4');
      }
    }, 100);
  };

  // Download Desktop-formatted interactive HTML Report suitable for PC browsers / Excel
  const exportToDesktopReport = () => {
    const todayStr = new Date().toLocaleDateString('ar-YE');
    const currencyLabel = reportCurrency === 'YER' ? 'ريال يمني' : reportCurrency === 'SAR' ? 'ريال سعودي' : 'دولار أمريكي';
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير الكمبيوتر المكتبي الشامل - JAM System Pro</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 30px; margin: 0; }
    .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 25px; margin-bottom: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { text-align: center; border-bottom: 2px solid #38bdf8; padding-bottom: 15px; margin-bottom: 20px; }
    .title { font-size: 26px; font-weight: 900; color: #38bdf8; margin: 0; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-top: 5px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px; }
    .stat-box { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 18px; text-align: center; }
    .stat-box span { font-size: 12px; color: #94a3b8; font-weight: bold; display: block; margin-bottom: 6px; }
    .stat-box strong { font-size: 20px; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
    th, td { border: 1px solid #334155; padding: 12px; text-align: right; }
    th { background-color: #0f172a; color: #f1f5f9; font-weight: bold; }
    tr:nth-child(even) { background-color: #1a2436; }
    .btn { background: linear-gradient(135deg, #0284c7, #0369a1); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    @media print { body { background: white; color: black; } .card { border: none; box-shadow: none; background: white; } .btn { display: none; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">🖥️ JAM SYSTEM PRO - تقرير الكمبيوتر المكتبي الشامل</h1>
      <p class="subtitle">نسخة مخصصة للعرض والطباعة على شاشات الحاسوب والمكائن المترابطة | التاريخ: ${todayStr} | العملة: ${currencyLabel}</p>
      <button class="btn" onclick="window.print()">🖨️ طباعة التقرير المكتبي</button>
    </div>

    <div class="stats-grid">
      <div class="stat-box">
        <span>إجمالي الأصناف بالكمية</span>
        <strong>${inventoryStats.totalItems.toLocaleString()} قطعة</strong>
      </div>
      <div class="stat-box">
        <span>إجمالي قيمة التكلفة للسلع</span>
        <strong>${formatValue(inventoryStats.totalValue)}</strong>
      </div>
      <div class="stat-box">
        <span>إجمالي الديون والمدينين</span>
        <strong style="color: #f43f5e;">${formatValue(inventoryStats.totalDebts)}</strong>
      </div>
      <div class="stat-box">
        <span>صافي الأرباح المحسوبة</span>
        <strong style="color: #10b981;">${formatValue(profit)}</strong>
      </div>
    </div>

    <h3 style="color: #f8fafc; font-size: 16px; margin-top: 25px;">📊 كشف جرد المنتجات الحالي للمحلات والورش</h3>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>اسم المنتج / الصنف</th>
          <th>الكتالوج / الفئة</th>
          <th>الكمية المتاحة</th>
          <th>سعر التكلفة</th>
          <th>سعر البيع</th>
          <th>إجمالي قيمة التكلفة</th>
        </tr>
      </thead>
      <tbody>
        ${inventory.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${item.name || 'بدون اسم'}</strong></td>
            <td>${item.category || 'عام'}</td>
            <td><b style="${item.stock <= (item.minStock || 1) ? 'color:#f43f5e;' : ''}">${item.stock || 0}</b></td>
            <td>${formatValue(item.cost || 0)}</td>
            <td>${formatValue(item.price || 0)}</td>
            <td>${formatValue((item.cost || 0) * (item.stock || 0))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
    `;

    const filename = `تقرير_الكمبيوتر_المكتبي_JAM_PRO_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.html`;
    await downloadOrExportFile(htmlContent, filename, 'text/html;charset=utf-8');
  };

  const shareOnWhatsApp = () => {
    const text = `تقرير جرد Jam system pro\nالتاريخ: ${new Date().toLocaleDateString('ar-EG')}\nإجمالي قيمة المخزون: ${formatValue(inventoryStats.totalValue)}\nصافي الأرباح: ${formatValue(profit)}\nإجمالي الديون: ${formatValue(inventoryStats.totalDebts)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Inventory Audit Data
  const inventoryStats = {
    totalItems: inventory.reduce((acc, i) => acc + i.stock, 0),
    lowStock: inventory.filter(i => i.stock <= i.minStock).length,
    totalValue: inventory.reduce((acc, i) => acc + (i.cost * i.stock), 0),
    potentialProfit: inventory.reduce((acc, i) => acc + ((i.price - i.cost) * i.stock), 0),
    totalDebts: customers.reduce((acc, c) => acc + (c.debt || 0), 0)
  };

  const categoryData = [
    { name: 'قطع غيار', value: inventory.filter(i => i.category === 'spare_part').length },
    { name: 'المعرض', value: inventory.filter(i => i.category === 'showroom').length },
  ];

  const COLORS = ['#4f46e5', '#334155', '#ef4444', '#f59e0b'];

  // Filter data based on selected employee
  const filteredTransactions = transactions.filter(t => selectedUserId === 'all' || t.addedBy === selectedUserId);
  const filteredOrders = orders.filter(o => selectedUserId === 'all' || o.engineerId === selectedUserId);

  const today = new Date().toISOString().split('T')[0];
  const todayTransactions = filteredTransactions.filter(t => {
    const tDate = (t.createdAt as any)?.toDate?.()?.toISOString().split('T')[0] || '';
    return tDate === today;
  });

  const dailyStats = {
    income: todayTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
    expense: todayTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0),
  };

  const handlePrintReport = (formatType: '80mm' | 'A4') => {
    const todayStr = new Date().toLocaleDateString('ar-YE');
    const timeStr = new Date().toLocaleTimeString('ar-YE');
    const rate = exchangeRates[reportCurrency] || 1;
    const currencyLabel = reportCurrency === 'YER' ? 'ريال يمني' : reportCurrency === 'SAR' ? 'ريال سعودي' : 'دولار أمريكي';
    const currencySuffix = reportCurrency === 'YER' ? 'YER' : reportCurrency === 'SAR' ? 'SAR' : 'USD';

    const rawCashSales = (transactions.filter(t => t.type === 'income' && t.boxId === 'CASH_BOX' && (t.createdAt as any)?.toDate?.()?.toISOString().split('T')[0] === today).reduce((acc, t) => acc + t.amount, 0));
    const rawDebtSales = customers.reduce((acc, c) => acc + (c.debt || 0), 0);
    const rawBankRemit = (transactions.filter(t => t.type === 'income' && t.boxId !== 'CASH_BOX' && (t.createdAt as any)?.toDate?.()?.toISOString().split('T')[0] === today).reduce((acc, t) => acc + t.amount, 0));
    const rawTodayExp = (transactions.filter(t => t.type === 'expense' && (t.createdAt as any)?.toDate?.()?.toISOString().split('T')[0] === today).reduce((acc, t) => acc + t.amount, 0));
    const rawEodDiff = (transactions.filter(t => t.category === 'reconciliation' && (t.createdAt as any)?.toDate?.()?.toISOString().split('T')[0] === today).reduce((acc, t) => acc + t.amount, 0));

    const cashSales = rawCashSales / rate;
    const debtSales = rawDebtSales / rate;
    const bankRemit = rawBankRemit / rate;
    const todayExp = rawTodayExp / rate;
    const eodDiff = rawEodDiff / rate;
    const netCenter = cashSales + bankRemit - todayExp + eodDiff;

    const is80 = formatType === '80mm';

    const pageCss = `
      @page {
        size: ${is80 ? '80mm auto' : 'A4 portrait'};
        margin: ${is80 ? '2mm' : '10mm'};
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
          padding: ${is80 ? '4px' : '16px'} !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        .no-print, aside, header, footer, button, nav, .sidebar {
          display: none !important;
        }
      }
    `;

    const reportContentHtml = is80 ? `
      <div style="font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; text-align: center; font-size: 11px; padding: 4px; width: 100%; max-width: 78mm; margin: 0 auto; color: #000000;">
        <div style="border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <h2 style="font-size: 15px; font-weight: 900; margin: 0 0 4px 0;">JAM SYSTEM PRO</h2>
          <p style="font-size: 11px; font-weight: bold; margin: 2px 0;">التقرير المحاسبي اليومي الفوري</p>
          <p style="font-size: 10px; margin: 2px 0;">العملة: <b>${currencyLabel}</b></p>
          <p style="font-size: 9px; color: #333; margin: 2px 0;">التاريخ: ${todayStr} - ${timeStr}</p>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;"><span>المبيعات النقدية:</span> <b>${cashSales.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</b></div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;"><span>المبيعات الآجلة:</span> <b>${debtSales.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</b></div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;"><span>الحوالات المستلمة:</span> <b>${bankRemit.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</b></div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;"><span>المصروفات والأجور:</span> <b>-${todayExp.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</b></div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;"><span>أثر جرد الخزائن:</span> <b>${eodDiff.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</b></div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 900; border-top: 2px dashed #000; padding-top: 6px; margin-top: 6px;">
          <span>صافي المركز اليومي:</span> 
          <span>${netCenter.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</span>
        </div>
        <div style="font-size: 9px; margin-top: 12px; border-top: 1px dashed #000; padding-top: 6px; color: #444;">
          <p style="margin: 2px 0;">نظام JAM المحاسبي الموحد</p>
          <p style="margin: 2px 0;">م. عبد الغني المحفلي | 772315106</p>
        </div>
      </div>
    ` : `
      <div style="font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; max-width: 800px; margin: 0 auto; padding: 20px; color: #000000; background: #ffffff;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 0 0 4px 0;">JAM SYSTEM PRO</h1>
            <p style="font-size: 13px; font-weight: bold; color: #475569; margin: 0;">التقرير المحاسبي الموحد والمركز المالي اليومي</p>
          </div>
          <div style="text-align: left; font-size: 11px; color: #475569; line-height: 1.5;">
            <div>التاريخ: <b>${todayStr}</b></div>
            <div>الوقت: <b>${timeStr}</b></div>
            <div>العملة: <b>${currencyLabel} (${currencySuffix})</b></div>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 10px 12px; text-align: right; font-weight: 900; color: #0f172a;">البند المحاسبي والإداري</th>
              <th style="padding: 10px 12px; text-align: left; font-weight: 900; color: #0f172a;">القيمة الصافية (${currencySuffix})</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;">المبيعات النقدية بالصناديق</td><td style="padding: 10px 12px; text-align: left; font-weight: bold; color: #15803d;">${cashSales.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;">المبيعات الآجلة (ذمم العملاء والمدينين)</td><td style="padding: 10px 12px; text-align: left; font-weight: bold;">${debtSales.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;">الحوالات البنكية المستلمة</td><td style="padding: 10px 12px; text-align: left; font-weight: bold;">${bankRemit.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;">المصروفات والأجور وسائر العمليات التشغيلية</td><td style="padding: 10px 12px; text-align: left; font-weight: bold; color: #b91c1c;">-${todayExp.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 12px;">أثر تسويات جرد الصناديق اليومي</td><td style="padding: 10px 12px; text-align: left; font-weight: bold;">${eodDiff.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencySuffix}</td></tr>
          </tbody>
        </table>
        
        <div style="margin-top: 24px; border: 2px solid #059669; border-radius: 8px; padding: 14px 18px; font-size: 15px; font-weight: 900; display: flex; justify-content: space-between; background-color: #f0fdf4;">
          <span style="color: #065f46;">صافي رصيد العمليات والمركز المالي اليومي:</span>
          <span style="color: #047857;">${netCenter.toLocaleString(undefined, {maximumFractionDigits: 2})} ${currencyLabel}</span>
        </div>
        
        <div style="text-align: center; margin-top: 40px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 14px;">
          <p style="margin: 3px 0;">نظام JAM المحاسبي الموحد - تقرير رسمي معتمد</p>
          <p style="margin: 3px 0;">إشراف وتطوير: م. عبد الغني المحفلي | هاتف: 772315106</p>
        </div>
      </div>
    `;

    // 1. Inject or update #printableArea in main DOM for direct window.print() (Ensures full Android WebView & PC support)
    let printArea = document.getElementById('printableArea');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'printableArea';
      printArea.className = 'printableArea';
      document.body.appendChild(printArea);
    }
    printArea.innerHTML = `
      <style>${pageCss}</style>
      ${reportContentHtml}
    `;

    // 2. Prepare hidden iframe
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
          <title>JAM Report - ${todayStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;700;900&display=swap');
            ${pageCss}
            body {
              visibility: visible !important;
              margin: 0;
              padding: ${is80 ? '4px' : '15px'};
              background: #ffffff;
              color: #000000;
              direction: rtl;
            }
            .no-print { display: none !important; }
          </style>
        </head>
        <body>
          <div id="printableArea">
            ${reportContentHtml}
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

    // 3. Dispatch native system print dialog (Windows/Mac/Linux & Android PrintManager)
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

  // Financial Summary
  const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const profit = income - expense;

  const currencyBreakdown = filteredTransactions.reduce((acc: any, t) => {
    const curr = t.currency || 'YER';
    const amt = t.originalAmount || t.amount;
    if (!acc[curr]) acc[curr] = { income: 0, expense: 0 };
    if (t.type === 'income') acc[curr].income += amt;
    else acc[curr].expense += amt;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Dynamic Daily Report (المطابق المحاسبي والتقرير الموحد) */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-navy-900 via-slate-900 to-black border border-amber-500/20 shadow-2xl relative overflow-hidden" dir="rtl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-white/5">
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-l from-amber-400 to-yellow-200 bg-clip-text text-transparent flex items-center gap-2">
              <span className="text-amber-500">📊</span> تقرير اليوم المحاسبي الموحد (Dynamic Daily Report)
            </h3>
            <p className="text-xs text-gray-400 mt-1">توليد وطباعة الكشف المحاسبي الفوري للمبيعات النقدية والحوالات والمصروفات وجرد الإغلاق</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => handlePrintReport('80mm')}
              className="px-4 py-2 bg-navy-800 hover:bg-navy-700 text-amber-400 font-bold rounded-xl border border-amber-500/15 flex items-center gap-2 transition-all cursor-pointer"
            >
              🖨️ طباعة حرارية 80mm
            </button>
            <button
              onClick={() => handlePrintReport('A4')}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black rounded-xl shadow-lg transition-all border-none cursor-pointer"
            >
              📑 طباعة ورقية A4
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-right space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block">مبيعات اليوم النقدية</span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              {formatValue(transactions.filter(t => t.type === 'income' && t.boxId === 'CASH_BOX' && (t.createdAt as any)?.toDate?.()?.toISOString().split('T')[0] === today).reduce((acc, t) => acc + t.amount, 0))}
            </span>
          </div>

          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-right space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block">إجمالي مبيعات الآجل (الديون)</span>
            <span className="text-lg font-black text-rose-400 font-mono">
              {formatValue(customers.reduce((acc, c) => acc + (c.debt || 0), 0))}
            </span>
          </div>

          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-right space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block">الحوالات المستلمة بنجاح</span>
            <span className="text-lg font-black text-amber-400 font-mono">
              {formatValue(transactions.filter(t => t.type === 'income' && t.boxId !== 'CASH_BOX' && (t.createdAt as any)?.toDate?.()?.toISOString().split('T')[0] === today).reduce((acc, t) => acc + t.amount, 0))}
            </span>
          </div>

          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-right space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block">المصروفات والأجور المدفوعة</span>
            <span className="text-lg font-black text-orange-400 font-mono">
              {formatValue(transactions.filter(t => t.type === 'expense' && (t.createdAt as any)?.toDate?.()?.toISOString().split('T')[0] === today).reduce((acc, t) => acc + t.amount, 0))}
            </span>
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl text-right space-y-1">
            <span className="text-[10px] text-amber-500 font-bold block">أثر مطابقة جرد الصناديق</span>
            <span className="text-lg font-black text-yellow-300 font-mono">
              {formatValue(transactions.filter(t => t.category === 'reconciliation' && (t.createdAt as any)?.toDate?.()?.toISOString().split('T')[0] === today).reduce((acc, t) => acc + t.amount, 0))}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-navy-900 dark:text-white flex items-center gap-3">
          <BarChart3 className="text-brand-primary" />
          التقارير والجرد العام
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {/* Currency Switcher */}
          <div className="flex items-center gap-2 bg-white dark:bg-navy-800 p-2 rounded-2xl border border-gray-100 dark:border-navy-700">
            <span className="text-gray-400 font-bold text-xs ml-1">عرض بالعملة:</span>
            <select 
              value={reportCurrency}
              onChange={(e) => setReportCurrency(e.target.value as any)}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-navy-900 dark:text-white"
            >
              <option value="YER">🇾🇪 ريال يمني (YER)</option>
              <option value="SAR">🇸🇦 ريال سعودي (SAR)</option>
              <option value="USD">💵 دولار أمريكي (USD)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-navy-800 p-2 rounded-2xl border border-gray-100 dark:border-navy-700">
            <Filter size={18} className="text-gray-400 mr-2" />
            <select 
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-navy-900 dark:text-white"
            >
              <option value="all">كافة الموظفين</option>
              {users.map(user => (
                <option key={user.uid} value={user.uid}>{user.name}</option>
              ))}
            </select>
          </div>
          <UniversalReportButton
            variant="emerald"
            buttonText="تصدير كشف الجرد المالي الشامل"
            payload={{
              title: 'التقرير المحاسبي وكشف الجرد العام الموحد',
              subtitle: `تقرير أداء المنظومة والجرد الشامل لجميع الأقسام (${currencyLabel})`,
              currency: currencySuffix,
              summaryCards: [
                { label: 'إجمالي قيمة المخزون', value: formatValue(inventoryStats.totalValue), currency: currencySuffix, color: 'blue' },
                { label: 'الأرباح المتوقعة', value: formatValue(inventoryStats.potentialProfit), currency: currencySuffix, color: 'green' },
                { label: 'إجمالي ديون العملاء', value: formatValue(inventoryStats.totalDebts), currency: currencySuffix, color: 'amber' },
                { label: 'قطع المخزون الإجمالية', value: inventoryStats.totalItems, currency: 'قطعة', color: 'purple' }
              ],
              columns: [
                { key: 'name', header: 'اسم الصنف / القطعة', type: 'text', width: 25 },
                { key: 'category', header: 'القسم', type: 'text', width: 16 },
                { key: 'stock', header: 'الكمية المتوفرة', type: 'number', width: 14 },
                { key: 'cost', header: 'سعر التكلفة', type: 'currency', width: 14, formatter: (val) => formatValue(val) },
                { key: 'price', header: 'سعر البيع', type: 'currency', width: 14, formatter: (val) => formatValue(val) },
                { key: 'totalValue', header: 'إجمالي القيمة', type: 'currency', width: 16, formatter: (_, row) => formatValue((row.cost || 0) * (row.stock || 0)) }
              ],
              data: inventory
            }}
          />
          <button 
            onClick={shareOnWhatsApp}
            className="btn-primary flex items-center gap-2 px-6 py-3 bg-success shadow-success/20"
          >
            <TrendingUp size={20} />
            مشاركة واتساب
          </button>
          <button 
            onClick={exportToPDF}
            disabled={isExporting}
            className="btn-secondary flex items-center gap-2 px-6 py-3"
          >
            <Download size={20} />
            {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
          </button>
          <button 
            onClick={exportToDesktopReport}
            className="btn-secondary flex items-center gap-2 px-6 py-3 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/20"
            title="تحميل كشف مخصص متوافق مع الكمبيوتر والمتصفحات المكتبية"
          >
            <Download size={20} />
            تنزيل تقرير للكمبيوتر 🖥️
          </button>
        </div>
      </div>

      <div id="report-content" className="space-y-8 p-4 bg-smoke-white dark:bg-navy-900 rounded-3xl">
        {/* Daily & Employee Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-6 bg-gradient-to-br from-navy-900 to-navy-800 rounded-[2rem] text-white shadow-xl relative overflow-hidden"
           >
              <div className="relative z-10 space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black">ملخص اليوم ({new Date().toLocaleDateString('ar-EG')})</h3>
                    <Calendar className="text-brand-primary" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl">
                       <p className="text-[10px] text-white/40 uppercase font-black">إجمالي وارد اليوم</p>
                       <p className="text-2xl font-black text-success">{formatValue(dailyStats.income)}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl">
                       <p className="text-[10px] text-white/40 uppercase font-black">إجمالي مصروف اليوم</p>
                       <p className="text-2xl font-black text-danger">{formatValue(dailyStats.expense)}</p>
                    </div>
                 </div>
                 <div className="pt-2">
                    <p className="text-xs text-brand-primary font-bold">صافي دخل اليوم: {formatValue(dailyStats.income - dailyStats.expense)}</p>
                 </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/20 blur-[60px]" />
           </motion.div>

           <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-6 bg-white dark:bg-navy-800 rounded-[2rem] border border-gray-100 dark:border-navy-700 shadow-xl"
           >
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-navy-900 dark:text-white">أداء الموظف المختار</h3>
                    <Users className="text-royal-gold" />
                 </div>
                 <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl">
                    <div className="w-12 h-12 bg-navy-900 rounded-xl flex items-center justify-center text-white font-black">
                       {selectedUserId === 'all' ? 'الكل' : users.find(u => u.uid === selectedUserId)?.name[0]}
                    </div>
                    <div>
                       <p className="font-bold text-navy-900 dark:text-white">{selectedUserId === 'all' ? 'جميع الموظفين' : users.find(u => u.uid === selectedUserId)?.name}</p>
                       <p className="text-[10px] text-gray-500 italic">بناءً على العمليات المسجلة باسم الموظف</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-2 bg-navy-50 dark:bg-navy-900/50 rounded-xl">
                       <p className="text-[10px] text-gray-400">عدد العمليات</p>
                       <p className="font-black text-navy-900 dark:text-white">{filteredTransactions.length}</p>
                    </div>
                    <div className="text-center p-2 bg-navy-50 dark:bg-navy-900/50 rounded-xl">
                       <p className="text-[10px] text-gray-400">إجمالي الوارد</p>
                       <p className="font-black text-success">{formatValue(income)}</p>
                    </div>
                 </div>
              </div>
           </motion.div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card-glass p-6 space-y-2">
            <p className="text-xs text-gray-500 font-bold uppercase">إجمالي قيمة المخزون (تكلفة)</p>
            <p className="text-3xl font-black text-navy-900 dark:text-white">{formatValue(inventoryStats.totalValue)}</p>
            <div className="flex items-center gap-1 text-xs text-success">
              <TrendingUp size={14} />
              <span>ربح متوقع: {formatValue(inventoryStats.potentialProfit)}</span>
            </div>
          </div>
          <div className="card-glass p-6 space-y-2">
            <p className="text-xs text-gray-500 font-bold uppercase">صافي الأرباح (الفترة)</p>
            <p className={`text-3xl font-black ${profit >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatValue(profit)}
            </p>
            <p className="text-xs text-gray-400">بعد خصم المصاريف</p>
          </div>
          <div className="card-glass p-6 space-y-2">
            <p className="text-xs text-gray-500 font-bold uppercase">إجمالي ديون العملاء</p>
            <p className="text-3xl font-black text-danger">{formatValue(inventoryStats.totalDebts)}</p>
            <p className="text-xs text-gray-400">مبالغ مستحقة للمحل</p>
          </div>
          <div className="card-glass p-6 space-y-2">
            <p className="text-xs text-gray-500 font-bold uppercase">حالة الجرد</p>
            <p className="text-3xl font-black text-danger">{inventoryStats.lowStock}</p>
            <p className="text-xs text-gray-400">أصناف تحت حد الطلب</p>
          </div>
        </div>

        {/* Currency Breakdown & Transfer Engine */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2/3: Currency Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-black text-navy-900 dark:text-white flex items-center gap-2">
              <span>💰</span> توزيع وتحليل الإيرادات حسب العملات الدفترية
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(currencyBreakdown).map(([curr, data]: [string, any], idx) => (
                <div key={`${curr}-${idx}`} className="card-glass p-6 border-t-4 border-t-brand-primary">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-black text-gray-500 uppercase">{curr}</span>
                    <div className="w-8 h-8 bg-brand-primary-light text-brand-primary rounded-lg flex items-center justify-center">
                      <TrendingUp size={16} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">إجمالي الوارد:</span>
                      <span className="text-success font-bold">{data.income.toFixed(2)} {curr}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">إجمالي المصروف:</span>
                      <span className="text-danger font-bold">{data.expense.toFixed(2)} {curr}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-100 dark:border-navy-700 flex justify-between">
                      <span className="font-black text-navy-900 dark:text-white">الصافي:</span>
                      <span className="text-brand-primary font-black">{(data.income - data.expense).toFixed(2)} {curr}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right 1/3: Currency Conversion Script Tool */}
          <div className="card-glass p-6 border-t-4 border-t-amber-500 flex flex-col justify-between" dir="rtl">
            <div>
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-navy-700">
                <h3 className="text-base font-black text-navy-900 dark:text-white flex items-center gap-2">
                  <span>🔄</span> سكريبت وأداة التحويل والتحليل المالي
                </h3>
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] rounded-full font-bold">Ymi / YER / SAR / USD</span>
              </div>

              {/* Dynamic Rates Banner */}
              <div className="grid grid-cols-2 gap-2 mb-4 text-[11px] bg-slate-50 dark:bg-navy-900 p-2.5 rounded-xl border border-gray-100 dark:border-navy-700">
                <div className="text-right">
                  <span className="text-gray-400">🇺🇸 دولار ➔ يمني:</span>
                  <span className="block font-black text-navy-900 dark:text-white">{exchangeRates.USD} ر.ي</span>
                </div>
                <div className="text-right border-r border-gray-200 dark:border-navy-700 pr-2">
                  <span className="text-gray-400">🇸🇦 سعودي ➔ يمني:</span>
                  <span className="block font-black text-navy-900 dark:text-white">{exchangeRates.SAR} ر.ي</span>
                </div>
              </div>

              {/* Input Form */}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 block mb-1">المبلغ المطلوب تحويله:</label>
                  <input
                    type="number"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-navy-900 border border-gray-150 dark:border-navy-700 rounded-xl px-3 py-2 text-sm font-bold focus:ring-amber-500 focus:border-amber-500"
                    placeholder="أدخل المبلغ..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 block mb-1">من عملة:</label>
                    <select
                      value={fromCurrency}
                      onChange={(e) => handleFromCurrencyChange(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-gray-150 dark:border-navy-700 rounded-xl px-2 py-2 text-xs font-bold"
                    >
                      <option value="USD">🇺🇸 دولار (USD)</option>
                      <option value="SAR">🇸🇦 سعودي (SAR)</option>
                      <option value="YER">🇾🇪 يمني (YER)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 block mb-1">إلى عملة:</label>
                    <select
                      value={toCurrency}
                      onChange={(e) => setToCurrency(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-gray-150 dark:border-navy-700 rounded-xl px-2 py-2 text-xs font-bold"
                    >
                      <option value="YER">🇾🇪 يمني (YER)</option>
                      <option value="USD">🇺🇸 دولار (USD)</option>
                      <option value="SAR">🇸🇦 سعودي (SAR)</option>
                    </select>
                  </div>
                </div>

                {/* Customizable Exchange Rate used for calculation */}
                {fromCurrency !== toCurrency && (fromCurrency === 'YER' || toCurrency === 'YER') && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 block mb-1">سعر الصرف المعتمد للعملية:</label>
                    <input
                      type="number"
                      value={customRate}
                      onChange={(e) => setCustomRate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-gray-150 dark:border-navy-700 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-500"
                      placeholder="سعر الصرف..."
                    />
                  </div>
                )}

                {/* Conversion Result Display */}
                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-amber-500 font-bold block">القيمة المحسوبة الفورية</span>
                  <span className="text-xl font-black text-amber-500 font-mono">
                    {conversionResult.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                    <span className="text-xs font-normal">
                      {toCurrency === 'YER' ? 'ر.ي' : toCurrency === 'SAR' ? 'سعودي' : 'دولار'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-navy-700 space-y-2">
              <button
                type="button"
                onClick={logConversion}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md border-none cursor-pointer"
              >
                📝 حفظ وتوثيق عملية التحويل الحالية
              </button>

              {/* Conversion Log History */}
              {conversionLogs.length > 0 && (
                <div className="space-y-1 mt-2">
                  <span className="text-[9px] text-gray-400 font-bold block">آخر عمليات التحويل الموثقة:</span>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-[10px] bg-slate-50 dark:bg-navy-950 p-2 rounded-xl border border-gray-100 dark:border-navy-900 font-mono">
                    {conversionLogs.map((log, index) => (
                      <div key={index} className="text-gray-400 border-b border-gray-100 dark:border-white/5 pb-1 last:border-none last:pb-0">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick convert shortcuts */}
              <div className="flex justify-between gap-1 text-[9px] text-gray-400 pt-1">
                <span>تحويل سريع:</span>
                <button type="button" onClick={() => applyQuickConvert(100, 'USD', 'YER')} className="hover:text-amber-500 font-bold bg-transparent border-none p-0 cursor-pointer">100$ ➔ يمني</button>
                <button type="button" onClick={() => applyQuickConvert(1000, 'SAR', 'YER')} className="hover:text-amber-500 font-bold bg-transparent border-none p-0 cursor-pointer">1000سعودي ➔ يمني</button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Inventory Distribution */}
          <div className="card-glass p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Package className="text-brand-primary" />
              توزيع المخزون حسب الفئة
            </h3>
            <div className="h-[300px] flex items-center justify-center">
              {(() => {
                const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
                if (isNative) {
                  const chartWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 48, 600) : 355;
                  return (
                    <PieChart width={chartWidth} height={280}>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>

          {/* Financial Performance */}
          <div className="card-glass p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <BarChart3 className="text-brand-primary" />
              مقارنة الإيرادات والمصروفات
            </h3>
            <div className="h-[300px] flex items-center justify-center">
              {(() => {
                const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
                const chartDataList = [
                  { name: 'الإيرادات', value: convertValue(income) },
                  { name: 'المصروفات', value: convertValue(expense) },
                  { name: 'الأرباح', value: convertValue(profit) },
                ];
                if (isNative) {
                  const chartWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 48, 600) : 355;
                  return (
                    <BarChart width={chartWidth} height={280} data={chartDataList}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        { [0, 1, 2].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#ef4444' : '#4f46e5'} />
                        ))}
                      </Bar>
                    </BarChart>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={chartDataList}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        { [0, 1, 2].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#ef4444' : '#4f46e5'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Inventory Audit List */}
        <div className="card-glass overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-navy-700 flex items-center justify-between">
            <h3 className="text-lg font-bold">تقرير الجرد التفصيلي</h3>
          </div>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50 dark:bg-navy-800 text-gray-500 text-sm">
                <tr>
                  <th className="p-4">الصنف</th>
                  <th className="p-4">الكمية الفعلية</th>
                  <th className="p-4">سعر التكلفة</th>
                  <th className="p-4">إجمالي القيمة</th>
                  <th className="p-4">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                    <td className="p-4 font-bold">{item.name}</td>
                    <td className="p-4">{item.stock} قطعة</td>
                    <td className="p-4">{formatValue(item.cost)}</td>
                    <td className="p-4 font-black">{formatValue(item.cost * item.stock)}</td>
                    <td className="p-4">
                      {item.stock <= item.minStock ? (
                        <span className="text-xs font-bold text-danger bg-danger-light px-2 py-1 rounded-full">نقص حاد</span>
                      ) : (
                        <span className="text-xs font-bold text-success bg-success-light px-2 py-1 rounded-full">جيد</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-navy-700">
            {inventory.map((item) => (
              <div key={item.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <p className="font-bold text-sm">{item.name}</p>
                  {item.stock <= item.minStock ? (
                    <span className="text-[10px] font-bold text-danger bg-danger-light px-2 py-0.5 rounded-full">نقص حاد</span>
                  ) : (
                    <span className="text-[10px] font-bold text-success bg-success-light px-2 py-0.5 rounded-full">جيد</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p className="text-gray-500">الكمية: <span className="text-navy-900 dark:text-white font-bold">{item.stock}</span></p>
                  <p className="text-gray-500">التكلفة: <span className="text-navy-900 dark:text-white font-bold">{formatValue(item.cost)}</span></p>
                  <p className="text-gray-500 col-span-2">إجمالي القيمة: <span className="text-brand-primary font-black">{formatValue(item.cost * item.stock)}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
