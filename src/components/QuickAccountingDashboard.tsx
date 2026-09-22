import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc, 
  runTransaction, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, InventoryItem } from '../types';
import { FinancialMath } from '../utils/financialMath';
import { StoreQueueEngine } from '../services/StoreQueueEngine';
import { 
  Wallet, 
  Coins, 
  Wrench, 
  Smartphone, 
  CreditCard, 
  Headphones, 
  Users, 
  ArrowDownLeft, 
  ArrowLeftRight,
  ShoppingCart, 
  Receipt, 
  Landmark, 
  DollarSign, 
  Activity, 
  Lock, 
  Plus, 
  ShieldCheck, 
  RefreshCcw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface QuickAccountingDashboardProps {
  profile: UserProfile | null;
  combinedBoxesForSelect: any[];
  inventoryItems: InventoryItem[];
}

export default function QuickAccountingDashboard({ 
  profile, 
  combinedBoxesForSelect, 
  inventoryItems 
}: QuickAccountingDashboardProps) {
  const [quickTab, setQuickTab] = useState<'income_expense' | 'daily_summaries'>('income_expense');
  const [selectedCardForm, setSelectedCardForm] = useState<string | null>(null);
  const [submittedLoading, setSubmittedLoading] = useState(false);

  // States for real-time summaries in Tab 2
  const [salesList, setSalesList] = useState<any[]>([]);
  const [transactionsList, setTransactionsList] = useState<any[]>([]);
  const [maintenanceList, setMaintenanceList] = useState<any[]>([]);
  const [bookingsList, setBookingsList] = useState<any[]>([]);

  // Local storage adjustments state
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('jam_accounting_adjustments');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const updateManualAdjustment = (key: string, amount: number) => {
    const updated = { ...manualAdjustments, [key]: amount };
    setManualAdjustments(updated);
    localStorage.setItem('jam_accounting_adjustments', JSON.stringify(updated));
  };

  const [adjustingCategory, setAdjustingCategory] = useState<{ key: string; name: string } | null>(null);
  const [tempAdjustValue, setTempAdjustValue] = useState('');

  // Form states
  const [generalExpenseForm, setGeneralExpenseForm] = useState({ amount: '', boxId: 'CASH_BOX', category: 'مصاريف عامة', outflowPeriod: 'يومي (تشغيلي)', description: '' });
  const [assetsForm, setAssetsForm] = useState({ amount: '', boxId: 'CASH_BOX', subCategory: 'كهرباء', outflowPeriod: 'أصول / شهري (تثبيت)', description: '' });
  const [receiptForm, setReceiptForm] = useState({ amount: '', receivedFrom: '', boxId: 'CASH_BOX', description: '' });
  const [cashPurchaseForm, setCashPurchaseForm] = useState({ amount: '', purchaseType: 'رصيد', itemName: '', supplierName: '', supplierId: '', invoiceId: '', boxId: 'CASH_BOX', description: '' });
  const [receiveTransferForm, setReceiveTransferForm] = useState({ amount: '', senderName: '', network: 'الكريمي', boxId: 'CASH_BOX', description: '' });
  const [payrollForm, setPayrollForm] = useState({ amount: '', employeeUid: '', employeeName: '', payrollType: 'راتب شهري', month: format(new Date(), 'MMMM yyyy', { locale: ar }), boxId: 'CASH_BOX', description: '' });
  const [returnValueForm, setReturnValueForm] = useState({ amount: '', customerName: '', boxId: 'CASH_BOX', invoiceId: '', description: '' });
  const [commissionForm, setCommissionForm] = useState({ amount: '', recipientName: '', commissionType: 'عمولة مبيعات', boxId: 'CASH_BOX', description: '' });

  // Additional lists for unified outflow forms
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  // Load real-time data
  useEffect(() => {
    if (!profile?.ownerId) return;

    const qSales = query(collection(db, 'sales'), where('ownerId', '==', profile.ownerId));
    const unsubscribeSales = onSnapshot(qSales, (snap) => {
      setSalesList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, () => setSalesList([]));

    const qTransactions = query(collection(db, 'transactions'), where('ownerId', '==', profile.ownerId));
    const unsubscribeTransactions = onSnapshot(qTransactions, (snap) => {
      setTransactionsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, () => setTransactionsList([]));

    const qMaintenance = query(collection(db, 'maintenanceOrders'), where('ownerId', '==', profile.ownerId));
    const unsubscribeMaintenance = onSnapshot(qMaintenance, (snap) => {
      setMaintenanceList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, () => setMaintenanceList([]));

    const qBookings = query(collection(db, 'bookings'), where('ownerId', '==', profile.ownerId));
    const unsubscribeBookings = onSnapshot(qBookings, (snap) => {
      setBookingsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, () => setBookingsList([]));

    // Load Suppliers for Purchases Sheet
    const qSuppliers = query(collection(db, 'suppliers'), where('ownerId', '==', profile.ownerId));
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snap) => {
      setSuppliersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, () => setSuppliersList([]));

    // Load Employees for Staff Payroll & File Sheet
    const qEmployees = query(collection(db, 'users'), where('ownerId', '==', profile.ownerId));
    const unsubscribeEmployees = onSnapshot(qEmployees, (snap) => {
      setEmployeesList(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    }, () => setEmployeesList([]));

    return () => {
      unsubscribeSales();
      unsubscribeTransactions();
      unsubscribeMaintenance();
      unsubscribeBookings();
      unsubscribeSuppliers();
      unsubscribeEmployees();
    };
  }, [profile?.ownerId]);

  // Calculations for Totals in Tab 2
  const totalBalanceSales = (manualAdjustments['totalBalanceSales'] !== undefined ? manualAdjustments['totalBalanceSales'] : 
    (
      transactionsList
        .filter(t => t.type === 'income' && (t.category?.includes('رصيد') || t.description?.includes('رصيد')))
        .reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0) +
      salesList.reduce((sum, s) => {
        const itemSum = (s.items || []).filter((item: any) => 
          (item.productName || item.name || '').includes('رصيد') || 
          (item.productName || item.name || '').includes('شحن') ||
          (item.productName || item.name || '').includes('كارت') ||
          (item.productName || item.name || '').includes('كرت')
        ).reduce((pSum: number, item: any) => FinancialMath.add(pSum, FinancialMath.multiply(Number(item.price) || 0, Number(item.quantity) || 0)), 0);
        const catSum = (s.category || '').includes('رصيد') && s.totalAmount ? Number(s.totalAmount) : 0;
        return FinancialMath.add(sum, FinancialMath.add(itemSum, catSum));
      }, 0)
    )
  );

  const totalMaintenance = (manualAdjustments['totalMaintenance'] !== undefined ? manualAdjustments['totalMaintenance'] : 
    (
      maintenanceList
        .reduce((sum, m) => FinancialMath.add(sum, Number(m.totalCost || m.price || m.cost || m.totalAmount || 0)), 0) +
      transactionsList
        .filter(t => t.type === 'income' && (t.category?.includes('صيانة') || t.description?.includes('صيانة')))
        .reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0)
    )
  );

  const totalSimSales = (manualAdjustments['totalSimSales'] !== undefined ? manualAdjustments['totalSimSales'] : 
    (
      transactionsList
        .filter(t => t.type === 'income' && (t.category?.includes('شرايح') || t.category?.includes('شريحة')))
        .reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0) +
      salesList.reduce((sum, s) => {
        const itemSum = (s.items || []).filter((item: any) => 
          (item.productName || item.name || '').includes('شريحة') || 
          (item.productName || item.name || '').includes('شرايح') ||
          (item.productName || item.name || '').includes('شفرة') ||
          (item.productName || item.name || '').includes('SIM')
        ).reduce((pSum: number, item: any) => FinancialMath.add(pSum, FinancialMath.multiply(Number(item.price) || 0, Number(item.quantity) || 0)), 0);
        return FinancialMath.add(sum, itemSum);
      }, 0)
    )
  );

  const totalAccessoriesSales = (manualAdjustments['totalAccessoriesSales'] !== undefined ? manualAdjustments['totalAccessoriesSales'] : 
    (
      transactionsList
        .filter(t => t.type === 'income' && (t.category?.includes('إكسسوار') || t.description?.includes('اكسسوار')))
        .reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0) +
      salesList.reduce((sum, s) => {
        const itemSum = (s.items || []).filter((item: any) => 
          (item.productName || item.name || '').includes('إكسسوار') || 
          (item.productName || item.name || '').includes('اكسسوار') ||
          (item.productName || item.name || '').includes('سماعة') ||
          (item.productName || item.name || '').includes('شاحن') ||
          (item.productName || item.name || '').includes('حماية')
        ).reduce((pSum: number, item: any) => FinancialMath.add(pSum, FinancialMath.multiply(Number(item.price) || 0, Number(item.quantity) || 0)), 0);
        return FinancialMath.add(sum, itemSum);
      }, 0)
    )
  );

  const totalPhoneSales = (manualAdjustments['totalPhoneSales'] !== undefined ? manualAdjustments['totalPhoneSales'] : 
    (
      transactionsList
        .filter(t => t.type === 'income' && (t.category?.includes('جوال') || t.category?.includes('هاتف') || t.description?.includes('تلفون')))
        .reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0) +
      salesList.reduce((sum, s) => {
        const itemSum = (s.items || []).filter((item: any) => 
          (item.productName || item.name || '').includes('جوال') || 
          (item.productName || item.name || '').includes('هاتف') ||
          (item.productName || item.name || '').includes('तلفون') ||
          (item.productName || item.name || '').includes('موبايل') ||
          (item.productName || item.name || '').includes('iPhone') ||
          (item.productName || item.name || '').includes('Samsung')
        ).reduce((pSum: number, item: any) => FinancialMath.add(pSum, FinancialMath.multiply(Number(item.price) || 0, Number(item.quantity) || 0)), 0);
        return FinancialMath.add(sum, itemSum);
      }, 0)
    )
  );

  const totalPaidReservations = (manualAdjustments['totalPaidReservations'] !== undefined ? manualAdjustments['totalPaidReservations'] : 
    (
      bookingsList
        .filter(b => b.status === 'completed' || b.status === 'paid' || b.depositPaid)
        .reduce((sum, b) => FinancialMath.add(sum, Number(b.paymentAmount || b.deposit || b.price || b.cost || 0)), 0) +
      transactionsList
        .filter(t => t.type === 'income' && t.category === 'إجمالي حجوزات مدفوعة')
        .reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0)
    )
  );

  const marketPhoneSales = (manualAdjustments['marketPhoneSales'] !== undefined ? manualAdjustments['marketPhoneSales'] : 
    transactionsList
      .filter(t => t.type === 'income' && t.category === 'بيع السوق - جوالات')
      .reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0)
  );

  const marketAccessingSales = (manualAdjustments['marketAccessingSales'] !== undefined ? manualAdjustments['marketAccessingSales'] : 
    transactionsList
      .filter(t => t.type === 'income' && t.category === 'بيع السوق - إكسسوارات')
      .reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0)
  );

  const marketPartsSales = (manualAdjustments['marketPartsSales'] !== undefined ? manualAdjustments['marketPartsSales'] : 
    transactionsList
      .filter(t => t.type === 'income' && t.category === 'بيع السوق - قطع غيار')
      .reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0)
  );

  const marketOtherSales = (manualAdjustments['marketOtherSales'] !== undefined ? manualAdjustments['marketOtherSales'] : 
    transactionsList
      .filter(t => t.type === 'income' && t.category === 'بيع السوق - أخرى')
      .reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0)
  );

  // Submit Handler
  const handleRegisterAccountingMove = async (cardType: string, formData: any) => {
    if (!profile?.ownerId) return;
    setSubmittedLoading(true);
    try {
      const amountNum = parseFloat(formData.amount) || 0;
      if (amountNum <= 0) {
        alert("الرجاء إدخال مبلغ صحيح أكبر من الصفر.");
        setSubmittedLoading(false);
        return;
      }

      let transType: 'income' | 'expense' = 'expense';
      let databaseCategory = '';
      let finalDescription = formData.description || '';
      const boxId = formData.boxId || 'CASH_BOX';

      switch (cardType) {
        case 'general_expense':
          transType = 'expense';
          databaseCategory = 'خرج عام';
          finalDescription = `[طبيعة الخرج: ${formData.outflowPeriod || 'يومي (تشغيلي)'}] ${formData.description || 'صرف ومصروفات عامة للمحل'}`;
          break;
        case 'assets_taxes_zakat':
          transType = 'expense';
          databaseCategory = 'أصول، ضرائب وزكاة';
          finalDescription = `[طبيعة الخرج: ${formData.outflowPeriod || 'أصول / شهري (تثبيت)'}] [فئة: ${formData.subCategory || 'كهرباء'}] ${formData.description || 'مصاريف أصول/زكاة'}`;
          break;
        case 'receipt_voucher':
          transType = 'income';
          databaseCategory = 'سند قبض';
          finalDescription = `مستلم من: ${formData.receivedFrom || 'عميل'} - ${formData.description || 'تلقي سند مالي'}`;
          break;
        case 'cash_purchases':
          transType = 'expense';
          databaseCategory = 'مشتريات نقدية';
          finalDescription = `[شراء: ${formData.purchaseType || 'رصيد'} - صنف: ${formData.itemName || 'عام'}] [المورد: ${formData.supplierName || 'غير محدد'}] ${formData.invoiceId ? '[فاتورة المخزن: ' + formData.invoiceId + ']' : ''} - ${formData.description || ''}`;
          break;
        case 'receive_transfer':
          transType = 'income';
          databaseCategory = 'استلام حوالة';
          finalDescription = `استلام حوالة من: ${formData.senderName || 'غير معروف'} عبر: ${formData.network || 'الكريمي'} - ${formData.description || ''}`;
          break;
        case 'staff_payroll':
          transType = 'expense';
          databaseCategory = 'تسليم رواتب';
          finalDescription = `[ملف الموظف: ${formData.employeeName || 'عام'}] [نوع المستحق: ${formData.payrollType || 'راتب شهري'}] لشهر: ${formData.month || 'الجاري'} - ${formData.description || ''}`;
          break;
        case 'return_value':
          transType = 'expense';
          databaseCategory = 'تسليم قيمة مرتجع';
          finalDescription = `مرتجع للعميل: ${formData.customerName || 'مجهول'} ${formData.invoiceId ? '[فاتورة: '+formData.invoiceId+']' : ''} - ${formData.description || ''}`;
          break;
        case 'commissions':
          transType = 'expense';
          databaseCategory = 'تسليم عمولات';
          finalDescription = `صرف عمولة لـ: ${formData.recipientName || 'مندوب'} لفئة: ${formData.commissionType || 'مبيعات'} - ${formData.description || ''}`;
          break;
        default:
          break;
      }

      // ⚡ Enqueue task to StoreQueueEngine for 0ms Deduplication & Offline Math Guard check
      StoreQueueEngine.enqueueTask(
        profile.ownerId,
        `voucher_${cardType}`,
        'transactions',
        {
          ownerId: profile.ownerId,
          type: transType,
          amount: amountNum,
          category: databaseCategory,
          description: finalDescription,
          boxId: boxId === 'CASH_BOX' ? '' : boxId
        },
        profile
      ).catch(err => console.warn('Financial Voucher StoreQueueEngine enqueue notice:', err));

      await runTransaction(db, async (transaction) => {
        // 1. Transaction collection log
        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          ownerId: profile.ownerId,
          type: transType,
          amount: amountNum,
          category: databaseCategory,
          description: finalDescription,
          boxId: boxId === 'CASH_BOX' ? '' : boxId,
          createdAt: serverTimestamp()
        });

        // 2. Adjust budget boxes
        if (boxId !== 'CASH_BOX') {
          const bankRef = doc(db, 'bank_accounts', boxId);
          const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', boxId);
          
          const bankSnap = await transaction.get(bankRef);
          const customSnap = await transaction.get(customRef);

          const diff = transType === 'income' ? amountNum : -amountNum;

          if (bankSnap.exists()) {
            const currentBal = Number(bankSnap.data().balance || 0);
            transaction.update(bankRef, {
              balance: parseFloat((currentBal + diff).toFixed(4)),
              updatedAt: serverTimestamp()
            });
          } else if (customSnap.exists()) {
            const currentBal = Number(customSnap.data().balance || 0);
            transaction.update(customRef, {
              balance: parseFloat((currentBal + diff).toFixed(4))
            });

            const customData = customSnap.data();
            if (customData.isLinkedToBank && customData.bankAccountId) {
              const linkedBankRef = doc(db, 'bank_accounts', customData.bankAccountId);
              const linkedBankSnap = await transaction.get(linkedBankRef);
              if (linkedBankSnap.exists()) {
                const currentBankBal = Number(linkedBankSnap.data().balance || 0);
                transaction.update(linkedBankRef, {
                  balance: parseFloat((currentBankBal + diff).toFixed(4)),
                  updatedAt: serverTimestamp()
                });
              }
            }
          }
        }

        // 3. Double-entry Journal Ledger
        const journalRef = doc(collection(db, 'journalEntries'));
        const debtAcc = transType === 'income' ? (boxId === 'CASH_BOX' ? 'الصندوق العام للمحل' : 'الحساب البنكي الهدف') : databaseCategory;
        const credAcc = transType === 'income' ? databaseCategory : (boxId === 'CASH_BOX' ? 'الصندوق العام للمحل' : 'الحساب البنكي الهدف');

        transaction.set(journalRef, {
          ownerId: profile.ownerId,
          description: `جام برو الذكي - [${databaseCategory}]: ${finalDescription}`,
          date: serverTimestamp(),
          referenceId: transRef.id,
          type: transType.toUpperCase(),
          items: [
            { accountName: debtAcc, debit: amountNum, credit: 0, currency: 'YER', exchangeRate: 1, baseAmount: amountNum },
            { accountName: credAcc, debit: 0, credit: amountNum, currency: 'YER', exchangeRate: 1, baseAmount: amountNum }
          ]
        });
      });

      alert(`✓ تم تقييد حركة [${databaseCategory}] بقيمة ${amountNum.toLocaleString()} ر.ي بنجاح وتحديث الحسابات والأستاذ!`);
      // Universal Post-Execution Clear: Reset all forms
      setGeneralExpenseForm({ amount: '', boxId: 'CASH_BOX', category: 'مصاريف عامة', description: '' });
      setAssetsForm({ amount: '', boxId: 'CASH_BOX', subCategory: 'كهرباء', description: '' });
      setReceiptForm({ amount: '', receivedFrom: '', boxId: 'CASH_BOX', description: '' });
      setCashPurchaseForm({ amount: '', purchaseType: 'رصيد', itemName: '', boxId: 'CASH_BOX', description: '' });
      setReceiveTransferForm({ amount: '', senderName: '', network: 'الكريمي', boxId: 'CASH_BOX', description: '' });
      setPayrollForm({ amount: '', employeeName: '', month: '', boxId: 'CASH_BOX', description: '' });
      setReturnValueForm({ amount: '', customerName: '', boxId: 'CASH_BOX', invoiceId: '', description: '' });
      setCommissionForm({ amount: '', recipientName: '', commissionType: 'عمولة مبيعات', boxId: 'CASH_BOX', description: '' });
      setSelectedCardForm(null);
    } catch (e: any) {
      console.error(e);
      alert(`عذراً، لم تصرح العملية في السحابة: ${e.message}`);
    } finally {
      setSubmittedLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* QUICK DOUBLE ENTRY JOURNAL SHORTCUT BANNER */}
      <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 p-5 px-6 rounded-3xl border border-indigo-500/30 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-5 text-right dir-rtl" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="p-3.5 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/40 shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex flex-wrap items-center gap-2">
              <span>اختصار سريع: الشاشة النظيفة للقيود المزدوجة والإشعارات اللحظية</span>
              <span className="p-1 px-2.5 bg-amber-500/20 text-amber-300 rounded-lg text-[10px] font-mono border border-amber-500/30">سلف • تسديد عميل • تسديد مورد • تسوية • عهدة</span>
            </h3>
            <p className="text-xs text-zinc-300 mt-0.5">
              افتح الشاشة النظيفة فوراً لتسجيل القيود المزدوجة والربط بالموظفين، العملاء، والموردين وإرسال إشعارات أونلاين لحظية وواتساب وSMS.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0 justify-end">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open_clean_journal_modal', { detail: { preset: 'outflow' } }))}
            className="p-3 px-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/40 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <span>💸 خرج ومصروف مباشر</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open_clean_journal_modal', { detail: { preset: 'emp_payment' } }))}
            className="p-3 px-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/40 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <span>💵 تسليم للموظف/المهندس</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open_clean_journal_modal', { detail: { preset: 'customer_payment' } }))}
            className="p-3 px-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-xs rounded-xl border border-purple-500/40 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <span>👤 تسديد العميل</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open_clean_journal_modal', { detail: { preset: 'supplier_payment' } }))}
            className="p-3 px-4 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold text-xs rounded-xl border border-teal-500/40 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <span>🏭 تسديد المورد</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open_clean_journal_modal'))}
            className="p-3 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer border-none shrink-0 active:scale-95"
          >
            <Zap size={16} />
            <span>الشاشة النظيفة المباشرة</span>
          </button>
        </div>
      </div>

      {/* Quick Tab Selectors */}
      <div className="flex bg-white dark:bg-navy-800 p-2 rounded-[2rem] border border-gray-100 dark:border-navy-700 shadow-sm overflow-hidden gap-2">
        <button
          onClick={() => setQuickTab('income_expense')}
          className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
            quickTab === 'income_expense'
              ? 'bg-gradient-to-r from-navy-700 to-navy-900 text-white shadow-md'
              : 'text-gray-500 hover:text-navy-950 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-navy-900/50'
          }`}
        >
          <Wallet size={20} />
          التبويب الأول: الدخل والخرج (المصروفات والسندات والرواتب)
        </button>
        <button
          onClick={() => setQuickTab('daily_summaries')}
          className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
            quickTab === 'daily_summaries'
              ? 'bg-gradient-to-r from-navy-700 to-navy-900 text-white shadow-md'
              : 'text-gray-500 hover:text-navy-950 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-navy-900/50'
          }`}
        >
          <Activity size={20} />
          التبويب الثاني: الجرد اليومي والمبيعات (لوحة الإجماليات اليومية)
        </button>
      </div>

      {/* Tab 1 Frame Layout */}
      {quickTab === 'income_expense' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-navy-700 pb-2">
            <h3 className="text-sm font-black text-navy-950 dark:text-white">قائمة سندات الدخل والمخرجات النقدية اليومية (بطاقات 4×6 ملونة)</h3>
            <p className="text-[11px] text-gray-400 font-bold hidden sm:block">انقر على أي كرت لتسجيل قيد مالي فوري وتحديث الأرصدة</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 font-sans">
            {/* Card 1 */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open_clean_journal_modal', { detail: { preset: 'outflow' } }));
              }}
              className="aspect-[4/5.5] rounded-[2rem] bg-gradient-to-br from-red-500 to-rose-600 text-white p-5 justify-between flex flex-col shadow-lg shadow-red-500/10 cursor-pointer overflow-hidden relative group"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                  <Coins size={22} />
                </div>
                <h4 className="text-sm font-black tracking-tight">إضافة خرج وسحب مباشر</h4>
                <p className="text-[10px] text-red-50/90 mt-1 line-clamp-3 leading-relaxed">المصروفات النثرية والخرج التشغيلي المباشر عبر إنشاء قيد مزدوج نظيف</p>
              </div>
              <span className="text-[10px] font-black text-red-100 mt-auto flex items-center gap-1">
                فتح الشاشة النظيفة للقيد ⚡
              </span>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              onClick={() => {
                setAssetsForm({ amount: '', boxId: 'CASH_BOX', subCategory: 'كهرباء', description: '' });
                setSelectedCardForm('assets_taxes_zakat');
              }}
              className="aspect-[4/5.5] rounded-[2rem] bg-gradient-to-br from-rose-600 to-pink-700 text-white p-5 justify-between flex flex-col shadow-lg shadow-pink-600/10 cursor-pointer overflow-hidden relative group"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                  <Landmark size={22} />
                </div>
                <h4 className="text-sm font-black tracking-tight">الأصول والزكاة والضرائب</h4>
                <p className="text-[10px] text-pink-50/90 mt-1 line-clamp-3 leading-relaxed">كهرباء، عقارات، صيانة محلات، صيانة معدات، نقل، جمارك وتحسين ودعاية</p>
              </div>
              <span className="text-[10px] font-black text-pink-100 mt-auto flex items-center gap-1">
                تسجيل ومتابعة الأصول +
              </span>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              onClick={() => {
                setReceiptForm({ amount: '', receivedFrom: '', boxId: 'CASH_BOX', description: '' });
                setSelectedCardForm('receipt_voucher');
              }}
              className="aspect-[4/5.5] rounded-[2rem] bg-gradient-to-br from-emerald-500 to-green-600 text-white p-5 justify-between flex flex-col shadow-lg shadow-green-500/10 cursor-pointer overflow-hidden relative group"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                  <Receipt size={22} />
                </div>
                <h4 className="text-sm font-black tracking-tight">سند قبض نقدية</h4>
                <p className="text-[10px] text-green-50/90 mt-1 line-clamp-3 leading-relaxed">توثيق واستلام الأموال والمبالغ النقدية المقبوضة</p>
              </div>
              <span className="text-[10px] font-black text-green-100 mt-auto flex items-center gap-1">
                قبض وتثبيت سند +
              </span>
            </motion.div>

            {/* Card 4 */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              onClick={() => {
                setCashPurchaseForm({ amount: '', purchaseType: 'رصيد', itemName: '', boxId: 'CASH_BOX', description: '' });
                setSelectedCardForm('cash_purchases');
              }}
              className="aspect-[4/5.5] rounded-[2rem] bg-gradient-to-br from-amber-500 to-orange-500 text-white p-5 justify-between flex flex-col shadow-lg shadow-orange-500/10 cursor-pointer overflow-hidden relative group"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                  <ShoppingCart size={22} />
                </div>
                <h4 className="text-sm font-black tracking-tight">مشتريات نقدية</h4>
                <p className="text-[10px] text-orange-50/90 mt-1 line-clamp-3 leading-relaxed">شراء فوري كاش: رصيد، كروت الباقات، شرايح، إكسسوارات وهواتف</p>
              </div>
              <span className="text-[10px] font-black text-orange-100 mt-auto flex items-center gap-1">
                تقييد شراء كاش +
              </span>
            </motion.div>

            {/* Card 5 */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              onClick={() => {
                setReceiveTransferForm({ amount: '', senderName: '', network: 'الكريمي', boxId: 'CASH_BOX', description: '' });
                setSelectedCardForm('receive_transfer');
              }}
              className="aspect-[4/5.5] rounded-[2rem] bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-5 justify-between flex flex-col shadow-lg shadow-purple-500/10 cursor-pointer overflow-hidden relative group"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                  <ArrowLeftRight size={22} />
                </div>
                <h4 className="text-sm font-black tracking-tight">استلام حوالة خارجية</h4>
                <p className="text-[10px] text-purple-50/90 mt-1 line-clamp-3 leading-relaxed">استلام حوالات الصرافة (الكريمي، النجم، إلخ) وتفريغها بالحساب</p>
              </div>
              <span className="text-[10px] font-black text-purple-100 mt-auto flex items-center gap-1">
                استلام وتفريغ الحوالة +
              </span>
            </motion.div>

            {/* Card 6 */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              onClick={() => {
                setPayrollForm({ amount: '', employeeName: '', month: format(new Date(), 'MMMM yyyy', { locale: ar }), boxId: 'CASH_BOX', description: '' });
                setSelectedCardForm('staff_payroll');
              }}
              className="aspect-[4/5.5] rounded-[2rem] bg-gradient-to-br from-teal-500 to-cyan-600 text-white p-5 justify-between flex flex-col shadow-lg shadow-cyan-500/10 cursor-pointer overflow-hidden relative group"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                  <Users size={22} />
                </div>
                <h4 className="text-sm font-black tracking-tight">رواتب وأجور الموظفين</h4>
                <p className="text-[10px] text-teal-50/90 mt-1 line-clamp-3 leading-relaxed">صرف الرواتب الشهرية كاملة أو دفعات وسلف تحت الحساب للموظفين</p>
              </div>
              <span className="text-[10px] font-black text-teal-100 mt-auto flex items-center gap-1">
                صرف معاش موظف +
              </span>
            </motion.div>

            {/* Card 7 */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              onClick={() => {
                setReturnValueForm({ amount: '', customerName: '', boxId: 'CASH_BOX', invoiceId: '', description: '' });
                setSelectedCardForm('return_value');
              }}
              className="aspect-[4/5.5] rounded-[2rem] bg-gradient-to-br from-slate-600 to-slate-800 text-white p-5 justify-between flex flex-col shadow-lg shadow-slate-500/10 cursor-pointer overflow-hidden relative group"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                  <ArrowDownLeft size={22} />
                </div>
                <h4 className="text-sm font-black tracking-tight">تسليم قيمة مرتجع</h4>
                <p className="text-[10px] text-slate-100 mt-1 line-clamp-3 leading-relaxed">إعادة وتسليم مبالغ نقدية للعملاء عن سلع وفواتير مرتجعة</p>
              </div>
              <span className="text-[10px] font-black text-slate-200 mt-auto flex items-center gap-1">
                صرف قيمة المرتجع +
              </span>
            </motion.div>

            {/* Card 8 */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              onClick={() => {
                setCommissionForm({ amount: '', recipientName: '', commissionType: 'عمولة مبيعات', boxId: 'CASH_BOX', description: '' });
                setSelectedCardForm('commissions');
              }}
              className="aspect-[4/5.5] rounded-[2rem] bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-5 justify-between flex flex-col shadow-lg shadow-indigo-500/10 cursor-pointer overflow-hidden relative group"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                  <DollarSign size={22} />
                </div>
                <h4 className="text-sm font-black tracking-tight">تسليم عمولات وحوافز</h4>
                <p className="text-[10px] text-indigo-50/90 mt-1 line-clamp-3 leading-relaxed">صرف العمولات المستحقة للفنيين، السعاة ومناديب بيع الأرصدة</p>
              </div>
              <span className="text-[10px] font-black text-indigo-100 mt-auto flex items-center gap-1">
                صرف عمولة فورية +
              </span>
            </motion.div>
          </div>
        </div>
      )}

      {/* Tab 2 Daily inventory and sales summaries */}
      {quickTab === 'daily_summaries' && (() => {
        // Helper function for computing cash vs bank metrics for the 7 specialized screens
        const getScreenMetrics = (keywords: string[]) => {
          let incomeTotal = 0;
          let expenseTotal = 0;
          let cashIncome = 0;
          let cashExpense = 0;
          let bankIncome = 0;
          let bankExpense = 0;

          transactionsList.forEach(t => {
            const cat = (t.category || '').toLowerCase();
            const desc = (t.description || '').toLowerCase();
            const isMatch = keywords.some(kw => cat.includes(kw.toLowerCase()) || desc.includes(kw.toLowerCase()));
            if (isMatch) {
              const amt = Number(t.amount) || 0;
              const isCash = !t.boxId || t.boxId === 'CASH_BOX';
              if (t.type === 'income') {
                incomeTotal = FinancialMath.add(incomeTotal, amt);
                if (isCash) cashIncome = FinancialMath.add(cashIncome, amt);
                else bankIncome = FinancialMath.add(bankIncome, amt);
              } else if (t.type === 'expense') {
                expenseTotal = FinancialMath.add(expenseTotal, amt);
                if (isCash) cashExpense = FinancialMath.add(cashExpense, amt);
                else bankExpense = FinancialMath.add(bankExpense, amt);
              }
            }
          });

          salesList.forEach(s => {
            const isMatch = (s.items || []).some((item: any) => {
              const pName = (item.productName || item.name || item.category || '').toLowerCase();
              return keywords.some(kw => pName.includes(kw.toLowerCase()));
            });
            if (isMatch) {
              const amt = Number(s.finalAmount || s.totalAmount) || 0;
              const isCash = !s.paymentMethod || s.paymentMethod === 'نقدي' || s.paymentMethod === 'كاش' || s.boxId === 'CASH_BOX';
              incomeTotal = FinancialMath.add(incomeTotal, amt);
              if (isCash) cashIncome = FinancialMath.add(cashIncome, amt);
              else bankIncome = FinancialMath.add(bankIncome, amt);
            }
          });

          const cashRemaining = FinancialMath.subtract(cashIncome, cashExpense);
          const bankRemaining = FinancialMath.subtract(bankIncome, bankExpense);
          const totalRemaining = FinancialMath.add(cashRemaining, bankRemaining);

          return { incomeTotal, expenseTotal, cashRemaining, bankRemaining, totalRemaining };
        };

        const screensData = [
          {
            id: 'b2b_market',
            title: 'شاشة مبيعات ومشتريات السوق B2B',
            icon: ShoppingCart,
            color: 'from-blue-600 to-indigo-700',
            keywords: ['سوق', 'b2b', 'جملة', 'مورد'],
            manualIncome: marketPhoneSales + marketAccessingSales + marketPartsSales + marketOtherSales,
          },
          {
            id: 'maintenance',
            title: 'شاشة مركز الصيانة والورشة الفنية',
            icon: Wrench,
            color: 'from-amber-600 to-orange-700',
            keywords: ['صيانة', 'قطع غيار', 'ورشة', 'مهندس'],
            manualIncome: totalMaintenance,
          },
          {
            id: 'balance_recharge',
            title: 'شاشة مبيعات وشحن الرصيد وباقات الهاتف',
            icon: Coins,
            color: 'from-emerald-600 to-teal-700',
            keywords: ['رصيد', 'باقات', 'تفعيل', 'شحن'],
            manualIncome: totalBalanceSales,
          },
          {
            id: 'sim_cards',
            title: 'شاشة شرايح الهاتف والأرقام والتنازلات',
            icon: CreditCard,
            color: 'from-purple-600 to-indigo-800',
            keywords: ['شرايح', 'شريحة', 'أرقام', 'تشفير'],
            manualIncome: totalSimSales,
          },
          {
            id: 'phones_warehouse',
            title: 'شاشة مستودع ومخزن الجوالات',
            icon: Smartphone,
            color: 'from-slate-700 to-navy-900',
            keywords: ['جوال', 'هاتف', 'آيفون', 'سامسونج', 'شاومي'],
            manualIncome: totalPhoneSales,
          },
          {
            id: 'accessories_warehouse',
            title: 'شاشة مستودع ومخزن الإكسسوارات',
            icon: Headphones,
            color: 'from-cyan-600 to-blue-800',
            keywords: ['إكسسوار', 'اكسسوار', 'شاحن', 'سماعة', 'جراب'],
            manualIncome: totalAccessoriesSales,
          },
          {
            id: 'spare_parts_warehouse',
            title: 'شاشة مستودع ومخزن قطع الغيار',
            icon: Package,
            color: 'from-rose-600 to-red-800',
            keywords: ['قطع غيار', 'شاشة', 'بطارية', 'لوحة', 'فلاتة'],
            manualIncome: marketPartsSales,
          },
        ];

        return (
        <div className="space-y-6">
          {/* Section 1: 7 Specialized Screens Financial Summary Cards */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-navy-700 pb-2">
              <div>
                <h3 className="text-sm font-black text-navy-950 dark:text-white flex items-center gap-2">
                  <PieChart className="text-brand-primary" size={18} />
                  الـ 7 شاشات التخصصية: إجمالي المبيعات والخرج والباقي في الخزنة (الكاش) والمصرف
                </h3>
                <p className="text-[11px] text-gray-400 font-bold mt-0.5">تفصيل دقيق لكافة القطاعات والورش والمستودعات السبعة مع رصيد الصندوق الحقيقي</p>
              </div>
              <span className="text-[10px] bg-brand-primary/10 text-brand-primary font-black px-2.5 py-1 rounded-full">تحديث فوري ⚡</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {screensData.map((screen) => {
                const IconComp = screen.icon;
                const metrics = getScreenMetrics(screen.keywords);
                const displayIncome = Math.max(metrics.incomeTotal, screen.manualIncome);
                const displayExpense = metrics.expenseTotal;
                const cashBal = metrics.cashRemaining;
                const bankBal = metrics.bankRemaining;
                const netBal = FinancialMath.subtract(displayIncome, displayExpense);

                return (
                  <motion.div
                    key={screen.id}
                    whileHover={{ y: -2 }}
                    className="bg-white dark:bg-navy-800 rounded-2xl p-4 border border-gray-150 dark:border-navy-700 shadow-sm space-y-3 font-sans"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-navy-700 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${screen.color} text-white flex items-center justify-center shadow-xs`}>
                          <IconComp size={18} />
                        </div>
                        <h4 className="text-xs font-black text-navy-950 dark:text-white">{screen.title}</h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-right text-[11px]">
                      <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-2 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30">
                        <span className="text-gray-400 font-bold text-[9px] block">🟢 إجمالي المبيعات / الدخل</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
                          {displayIncome.toLocaleString()} <span className="text-[9px]">ر.ي</span>
                        </span>
                      </div>

                      <div className="bg-rose-50/60 dark:bg-rose-950/20 p-2 rounded-xl border border-rose-100/50 dark:border-rose-900/30">
                        <span className="text-gray-400 font-bold text-[9px] block">🔴 إجمالي الخرج / المشتريات</span>
                        <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs">
                          {displayExpense.toLocaleString()} <span className="text-[9px]">ر.ي</span>
                        </span>
                      </div>

                      <div className="bg-blue-50/60 dark:bg-blue-950/20 p-2 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                        <span className="text-gray-400 font-bold text-[9px] block">💵 المتبقي في صندوق (الكاش)</span>
                        <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-xs">
                          {cashBal.toLocaleString()} <span className="text-[9px]">ر.ي</span>
                        </span>
                      </div>

                      <div className="bg-purple-50/60 dark:bg-purple-950/20 p-2 rounded-xl border border-purple-100/50 dark:border-purple-900/30">
                        <span className="text-gray-400 font-bold text-[9px] block">🏦 المتبقي في الحساب (البنك)</span>
                        <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-xs">
                          {bankBal.toLocaleString()} <span className="text-[9px]">ر.ي</span>
                        </span>
                      </div>
                    </div>

                    <div className="bg-navy-900 text-white p-2.5 rounded-xl flex justify-between items-center text-xs font-mono">
                      <span className="text-[10px] font-sans font-extrabold text-navy-200">💰 إجمالي المتبقي الكلي في الخزنة والمصرف:</span>
                      <span className="font-black text-brand-primary text-sm tracking-tight">
                        {netBal.toLocaleString()} <span className="text-[9px] text-white">ر.ي</span>
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Sales summaries */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-navy-700 pb-2">
              <h3 className="text-sm font-black text-navy-950 dark:text-white flex items-center gap-2">
                <Coins className="text-brand-primary" size={18} />
                ثانياً: شيت المبيعات النقدية وتفصيل الإيجابيات (العدّادات اليومية 4×6)
              </h3>
              <p className="text-[11px] text-gray-400 font-bold hidden md:block">يتم احتساب القيم تلقائياً وتحديث الإجماليات في السجلات واللوحة فورا</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {/* Card 1: إجمالي رصيد */}
              <motion.div
                whileHover={{ y: -4 }}
                className="aspect-[4/6] rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-4 justify-between flex flex-col shadow-md relative overflow-hidden group"
              >
                <div>
                  <div className="w-9 h-9 bg-white/12 rounded-xl flex items-center justify-center mb-2">
                    <Coins size={18} />
                  </div>
                  <h4 className="text-xs font-black">إجمالي مبيع رصيد</h4>
                  <p className="text-[9px] text-blue-100 leading-relaxed mt-0.5 font-bold">مبيعات كروت وتحويل شحن باقات الهواتف</p>
                </div>
                <div className="space-y-2 mt-auto">
                  <div className="bg-black/20 rounded-2xl p-2.5 text-center font-mono">
                    <span className="block text-sm font-black tracking-tight">{totalBalanceSales.toLocaleString()}</span>
                    <span className="text-[9px] text-blue-100 font-black">ريال يمني</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAdjustValue(String(totalBalanceSales));
                      setAdjustingCategory({ key: 'totalBalanceSales', name: 'إجمالي مبيع رصيد' });
                    }}
                    className="w-full py-1 text-[9px] bg-white/15 hover:bg-white/25 rounded-lg font-black transition-colors"
                  >
                    تعديل القيمة ✏️
                  </button>
                </div>
              </motion.div>

              {/* Card 2: إجمالي صيانة */}
              <motion.div
                whileHover={{ y: -4 }}
                className="aspect-[4/6] rounded-[2rem] bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-4 justify-between flex flex-col shadow-md relative overflow-hidden group"
              >
                <div>
                  <div className="w-9 h-9 bg-white/12 rounded-xl flex items-center justify-center mb-2">
                    <Wrench size={18} />
                  </div>
                  <h4 className="text-xs font-black">إجمالي الصيانة اليومية</h4>
                  <p className="text-[9px] text-indigo-100 leading-relaxed mt-0.5 font-bold">تكاليف الصيانات السريعة والورشة الفنية</p>
                </div>
                <div className="space-y-2 mt-auto">
                  <div className="bg-black/20 rounded-2xl p-2.5 text-center font-mono">
                    <span className="block text-sm font-black tracking-tight">{totalMaintenance.toLocaleString()}</span>
                    <span className="text-[9px] text-indigo-100 font-black">ريال يمني</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAdjustValue(String(totalMaintenance));
                      setAdjustingCategory({ key: 'totalMaintenance', name: 'إجمالي مبيعات الصيانة' });
                    }}
                    className="w-full py-1 text-[9px] bg-white/15 hover:bg-white/25 rounded-lg font-black transition-colors"
                  >
                    تعديل القيمة ✏️
                  </button>
                </div>
              </motion.div>

              {/* Card 3: إجمالي شرايح */}
              <motion.div
                whileHover={{ y: -4 }}
                className="aspect-[4/6] rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-4 justify-between flex flex-col shadow-md relative overflow-hidden group"
              >
                <div>
                  <div className="w-9 h-9 bg-white/12 rounded-xl flex items-center justify-center mb-2">
                    <CreditCard size={18} />
                  </div>
                  <h4 className="text-xs font-black">إجمالي شرايح الهاتف</h4>
                  <p className="text-[9px] text-purple-100 leading-relaxed mt-0.5 font-bold">مبيعات شفرات وتفعيل الأرقام والتنازل</p>
                </div>
                <div className="space-y-2 mt-auto">
                  <div className="bg-black/20 rounded-2xl p-2.5 text-center font-mono">
                    <span className="block text-sm font-black tracking-tight">{totalSimSales.toLocaleString()}</span>
                    <span className="text-[9px] text-purple-100 font-black">ريال يمني</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAdjustValue(String(totalSimSales));
                      setAdjustingCategory({ key: 'totalSimSales', name: 'إجمالي شرايح الهاتف' });
                    }}
                    className="w-full py-1 text-[9px] bg-white/15 hover:bg-white/25 rounded-lg font-black transition-colors"
                  >
                    تعديل القيمة ✏️
                  </button>
                </div>
              </motion.div>

              {/* Card 4: إجمالي إكسسوارات */}
              <motion.div
                whileHover={{ y: -4 }}
                className="aspect-[4/6] rounded-[2rem] bg-gradient-to-br from-blue-600 to-sky-600 text-white p-4 justify-between flex flex-col shadow-md relative overflow-hidden group"
              >
                <div>
                  <div className="w-9 h-9 bg-white/12 rounded-xl flex items-center justify-center mb-2">
                    <Headphones size={18} />
                  </div>
                  <h4 className="text-xs font-black">إجمالي الإكسسوارات</h4>
                  <p className="text-[9px] text-blue-100 leading-relaxed mt-0.5 font-bold">شواحن، واقي شاشات، سماعات وكابلات</p>
                </div>
                <div className="space-y-2 mt-auto">
                  <div className="bg-black/20 rounded-2xl p-2.5 text-center font-mono">
                    <span className="block text-sm font-black tracking-tight">{totalAccessoriesSales.toLocaleString()}</span>
                    <span className="text-[9px] text-blue-100 font-black">ريال يمني</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAdjustValue(String(totalAccessoriesSales));
                      setAdjustingCategory({ key: 'totalAccessoriesSales', name: 'إجمالي الإكسسوارات' });
                    }}
                    className="w-full py-1 text-[9px] bg-white/15 hover:bg-white/25 rounded-lg font-black transition-colors"
                  >
                    تعديل القيمة ✏️
                  </button>
                </div>
              </motion.div>

              {/* Card 5: إجمالي جوالات */}
              <motion.div
                whileHover={{ y: -4 }}
                className="aspect-[4/6] rounded-[2rem] bg-gradient-to-br from-indigo-700 to-blue-850 text-white p-4 justify-between flex flex-col shadow-md relative overflow-hidden group"
              >
                <div>
                  <div className="w-9 h-9 bg-white/12 rounded-xl flex items-center justify-center mb-2">
                    <Smartphone size={18} />
                  </div>
                  <h4 className="text-xs font-black">إجمالي مبيع جوالات</h4>
                  <p className="text-[9px] text-blue-100 leading-relaxed mt-0.5 font-bold">مبيعات أجهزة سامسونج وآيفون وعلاجات مستعملة</p>
                </div>
                <div className="space-y-2 mt-auto">
                  <div className="bg-black/20 rounded-2xl p-2.5 text-center font-mono">
                    <span className="block text-sm font-black tracking-tight">{totalPhoneSales.toLocaleString()}</span>
                    <span className="text-[9px] text-blue-100 font-black">ريال يمني</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAdjustValue(String(totalPhoneSales));
                      setAdjustingCategory({ key: 'totalPhoneSales', name: 'إجمالي مبيع جوالات' });
                    }}
                    className="w-full py-1 text-[9px] bg-white/15 hover:bg-white/25 rounded-lg font-black transition-colors"
                  >
                    تعديل القيمة ✏️
                  </button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Section 2: Bookings & Markets */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-navy-700 pb-2">
              <h3 className="text-sm font-black text-navy-950 dark:text-white flex items-center gap-2">
                <ShoppingCart className="text-brand-primary" size={18} />
                ثانياً: المبيعات والحجوزات وسحابة سوق الهواتف والإكسسوارات الخارجية
              </h3>
              <p className="text-[11px] text-gray-400 font-bold hidden md:block">تتبع عمليات بيع الجملة الخارجية وتلقي المقبوضات لصالح السجلات</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {/* Card 1 */}
              <motion.div
                whileHover={{ y: -4 }}
                className="aspect-[4/6] rounded-[2rem] bg-gradient-to-br from-slate-700 to-slate-900 text-white p-4 justify-between flex flex-col shadow-md relative overflow-hidden"
              >
                <div>
                  <div className="w-9 h-9 bg-white/12 rounded-xl flex items-center justify-center mb-2">
                    <Lock size={18} />
                  </div>
                  <h4 className="text-xs font-black">إجمالي الباكجات والحجوزات</h4>
                  <p className="text-[9px] text-slate-100 leading-relaxed mt-0.5 font-bold">الحجوزات والتعابين المدفوعة مسبقاً</p>
                </div>
                <div className="space-y-2 mt-auto">
                  <div className="bg-black/25 rounded-2xl p-2 text-center font-mono">
                    <span className="block text-xs font-black">{totalPaidReservations.toLocaleString()}</span>
                    <span className="text-[8px] text-slate-200">ريال</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAdjustValue(String(totalPaidReservations));
                      setAdjustingCategory({ key: 'totalPaidReservations', name: 'إجمالي حجوزات مدفوعة' });
                    }}
                    className="w-full py-1 text-[8px] bg-white/15 hover:bg-white/25 rounded-md font-black"
                  >
                    تعديل ✏️
                  </button>
                </div>
              </motion.div>

              {/* Card 2 */}
              <motion.div
                whileHover={{ y: -4 }}
                className="aspect-[4/6] rounded-[2rem] bg-gradient-to-br from-slate-800 to-[#1e272e] text-white p-4 justify-between flex flex-col shadow-md relative overflow-hidden"
              >
                <div>
                  <div className="w-9 h-9 bg-white/12 rounded-xl flex items-center justify-center mb-2">
                    <Smartphone size={18} />
                  </div>
                  <h4 className="text-xs font-black">بيع السوق - جوالات</h4>
                  <p className="text-[9px] text-slate-100 leading-relaxed mt-0.5 font-bold">حساب الجوالات المنقضية خارجياً بسوق الجوالات</p>
                </div>
                <div className="space-y-2 mt-auto">
                  <div className="bg-black/25 rounded-2xl p-2 text-center font-mono">
                    <span className="block text-xs font-black">{marketPhoneSales.toLocaleString()}</span>
                    <span className="text-[8px] text-slate-200">ريال</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAdjustValue(String(marketPhoneSales));
                      setAdjustingCategory({ key: 'marketPhoneSales', name: 'بيع السوق - جوالات' });
                    }}
                    className="w-full py-1 text-[8px] bg-white/15 hover:bg-white/25 rounded-md font-black"
                  >
                    تعديل ✏️
                  </button>
                </div>
              </motion.div>

              {/* Card 3 */}
              <motion.div
                whileHover={{ y: -4 }}
                className="aspect-[4/6] rounded-[2rem] bg-gradient-to-br from-slate-900 to-[#0f1418] text-white p-4 justify-between flex flex-col shadow-md relative overflow-hidden"
              >
                <div>
                  <div className="w-9 h-9 bg-white/12 rounded-xl flex items-center justify-center mb-2">
                    <Headphones size={18} />
                  </div>
                  <h4 className="text-xs font-black">بيع السوق - إكسسوارات</h4>
                  <p className="text-[9px] text-slate-100 leading-relaxed mt-0.5 font-bold font-sans">تداول وبيع ملحقات الجوالات ميدانيّاً كاش</p>
                </div>
                <div className="space-y-2 mt-auto">
                  <div className="bg-black/25 rounded-2xl p-2 text-center font-mono">
                    <span className="block text-xs font-black">{marketAccessingSales.toLocaleString()}</span>
                    <span className="text-[8px] text-slate-200">ريال</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAdjustValue(String(marketAccessingSales));
                      setAdjustingCategory({ key: 'marketAccessingSales', name: 'بيع السوق - إكسسوارات' });
                    }}
                    className="w-full py-1 text-[8px] bg-white/15 hover:bg-white/25 rounded-md font-black"
                  >
                    تعديل ✏️
                  </button>
                </div>
              </motion.div>

              {/* Card 4 */}
              <motion.div
                whileHover={{ y: -4 }}
                className="aspect-[4/6] rounded-[2rem] bg-gradient-to-br from-orange-600 to-amber-700 text-white p-4 justify-between flex flex-col shadow-md relative overflow-hidden"
              >
                <div>
                  <div className="w-9 h-9 bg-white/12 rounded-xl flex items-center justify-center mb-2">
                    <Wrench size={18} />
                  </div>
                  <h4 className="text-xs font-black">بيع السوق - قطع غيار</h4>
                  <p className="text-[9px] text-slate-100 leading-relaxed mt-0.5 font-bold">أجور وتوريد القطع للورش الأخرى والوكلاء</p>
                </div>
                <div className="space-y-2 mt-auto">
                  <div className="bg-black/25 rounded-2xl p-2 text-center font-mono">
                    <span className="block text-xs font-black">{marketPartsSales.toLocaleString()}</span>
                    <span className="text-[8px] text-slate-200 font-sans">ريال</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAdjustValue(String(marketPartsSales));
                      setAdjustingCategory({ key: 'marketPartsSales', name: 'بيع السوق - قطع غيار' });
                    }}
                    className="w-full py-1 text-[8px] bg-white/15 hover:bg-white/25 rounded-md font-black"
                  >
                    تعديل ✏️
                  </button>
                </div>
              </motion.div>

              {/* Card 5 */}
              <motion.div
                whileHover={{ y: -4 }}
                className="aspect-[4/6] rounded-[2rem] bg-gradient-to-br from-slate-600 to-slate-800 text-white p-4 justify-between flex flex-col shadow-md relative overflow-hidden"
              >
                <div>
                  <div className="w-9 h-9 bg-white/12 rounded-xl flex items-center justify-center mb-2">
                    <Plus size={18} />
                  </div>
                  <h4 className="text-xs font-black">بيع السوق - خدمات أخرى</h4>
                  <p className="text-[9px] text-slate-100 leading-relaxed mt-0.5 font-bold">برمجيات، تفعيلات، تخليص باقات سريعة</p>
                </div>
                <div className="space-y-2 mt-auto">
                  <div className="bg-black/25 rounded-2xl p-2 text-center font-mono">
                    <span className="block text-xs font-black">{marketOtherSales.toLocaleString()}</span>
                    <span className="text-[8px] text-slate-200">ريال</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAdjustValue(String(marketOtherSales));
                      setAdjustingCategory({ key: 'marketOtherSales', name: 'بيع السوق - أخرى' });
                    }}
                    className="w-full py-1 text-[8px] bg-white/15 hover:bg-white/25 rounded-md font-black"
                  >
                    تعديل ✏️
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      ); })()}

      {/* Forms overlay Drawer Modals */}
      <AnimatePresence>
        {selectedCardForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 shadow-2xl p-4 animate-fade-in backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="bg-white dark:bg-navy-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 dark:border-navy-700 flex flex-col font-sans"
            >
              <div className="p-5 bg-navy-900 text-white flex justify-between items-center">
                <div className="text-right">
                  <span className="text-[9px] bg-brand-primary/20 text-brand-primary font-black px-2 py-0.5 rounded-md uppercase">JAM system Pro</span>
                  <h2 className="text-base font-black mt-1">
                    {selectedCardForm === 'general_expense' && '💵 تسجيل خرج ومصروف عام للمحل'}
                    {selectedCardForm === 'assets_taxes_zakat' && '🏢 الأصول والضرائب والزكاة والرسوم'}
                    {selectedCardForm === 'receipt_voucher' && '📄 إصدار وتثبيت سند قبض مالي'}
                    {selectedCardForm === 'cash_purchases' && '🛒 تقييد ومزمنة مشتريات كاش'}
                    {selectedCardForm === 'receive_transfer' && '📥 استلام وثيقة حوالة خارجية'}
                    {selectedCardForm === 'staff_payroll' && '👥 صرف رواتب وأجور موظفي المحل'}
                    {selectedCardForm === 'return_value' && '🔄 تسليم مرتجع مالي لزبون'}
                    {selectedCardForm === 'commissions' && '💰 تسليم وصرف عمولة مستحقة'}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedCardForm(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-extrabold text-sm"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (selectedCardForm === 'general_expense') handleRegisterAccountingMove('general_expense', generalExpenseForm);
                  if (selectedCardForm === 'assets_taxes_zakat') handleRegisterAccountingMove('assets_taxes_zakat', assetsForm);
                  if (selectedCardForm === 'receipt_voucher') handleRegisterAccountingMove('receipt_voucher', receiptForm);
                  if (selectedCardForm === 'cash_purchases') handleRegisterAccountingMove('cash_purchases', cashPurchaseForm);
                  if (selectedCardForm === 'receive_transfer') handleRegisterAccountingMove('receive_transfer', receiveTransferForm);
                  if (selectedCardForm === 'staff_payroll') handleRegisterAccountingMove('staff_payroll', payrollForm);
                  if (selectedCardForm === 'return_value') handleRegisterAccountingMove('return_value', returnValueForm);
                  if (selectedCardForm === 'commissions') handleRegisterAccountingMove('commissions', commissionForm);
                }}
                className="p-5 space-y-4 max-h-[75vh] overflow-y-auto"
              >
                {/* 1. General Expense Form */}
                {selectedCardForm === 'general_expense' && (
                  <div className="space-y-3 text-right">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">مبلغ المصروف (ريال يمني)</label>
                      <input
                        required
                        type="number"
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                        value={generalExpenseForm.amount}
                        onChange={(e) => setGeneralExpenseForm({ ...generalExpenseForm, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">تحديد فترة وطبيعة الخرج</label>
                      <select
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                        value={generalExpenseForm.outflowPeriod}
                        onChange={(e) => setGeneralExpenseForm({ ...generalExpenseForm, outflowPeriod: e.target.value })}
                      >
                        <option value="يومي (تشغيلي)">خرج يومي (مصاريف تشغيلية نثرية)</option>
                        <option value="أصول / شهري (تثبيت)">خرج أصول / شهري (إيجار، كهرباء، تثبيت ثري)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">الصندوق الصارف</label>
                      <select
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                        value={generalExpenseForm.boxId}
                        onChange={(e) => setGeneralExpenseForm({ ...generalExpenseForm, boxId: e.target.value })}
                      >
                        <option value="CASH_BOX">الصندوق الرئيسي للمحل</option>
                        {combinedBoxesForSelect.map(box => (
                          <option key={box.id} value={box.id}>{box.name} [رصيد: {box.balance?.toLocaleString() || 0}]</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">الشرح والبيان</label>
                      <textarea
                        required
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold h-20"
                        value={generalExpenseForm.description}
                        onChange={(e) => setGeneralExpenseForm({ ...generalExpenseForm, description: e.target.value })}
                        placeholder="مثال: شراء مياه شرب ومستلزمات نظافة للمعرض"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Assets / Taxes / Zakat */}
                {selectedCardForm === 'assets_taxes_zakat' && (
                  <div className="space-y-3 text-right">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">المبلغ المنفق (ر.ي)</label>
                      <input
                        required
                        type="number"
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                        value={assetsForm.amount}
                        onChange={(e) => setAssetsForm({ ...assetsForm, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">طبيعة الخرج</label>
                        <select
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                          value={assetsForm.outflowPeriod}
                          onChange={(e) => setAssetsForm({ ...assetsForm, outflowPeriod: e.target.value })}
                        >
                          <option value="أصول / شهري (تثبيت)">أصول / شهري (تثبيت ثري)</option>
                          <option value="يومي (تشغيلي)">خرج يومي تشغيلي</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">نوع الفئة المصروفة بالتفصيل</label>
                        <select
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                          value={assetsForm.subCategory}
                          onChange={(e) => setAssetsForm({ ...assetsForm, subCategory: e.target.value })}
                        >
                          <option value="كهرباء">كهرباء وطاقة شمسية</option>
                          <option value="عقارات">إيجار عقارات ومتاجر المحل</option>
                          <option value="صيانة محلات">صيانة محلات وتزيين المعرض</option>
                          <option value="صيانة معدات">صيانة معدات، أجهزة الكبس والحواسب</option>
                          <option value="نقل">تكاليف نقل بري وشحن داخلي</option>
                          <option value="جمارك">جمارك ورسوم تخليص الموانئ</option>
                          <option value="تحسين">رسوم حكومية ومجالس بلدية (تحسين)</option>
                          <option value="دعاية وإعلان">حملات تسويقية ودعاية وإعلان ومطبوعات</option>
                          <option value="ضرائب ورسوم">الضرائب المفروضة والتخليص القانوني</option>
                          <option value="زكاة">فريضة الزكاة للأنصبة والحول السنوي</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">تسجيل الصرف من صندوق</label>
                      <select
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                        value={assetsForm.boxId}
                        onChange={(e) => setAssetsForm({ ...assetsForm, boxId: e.target.value })}
                      >
                        <option value="CASH_BOX">الصندوق الرئيسي للمحل</option>
                        {combinedBoxesForSelect.map(box => (
                          <option key={box.id} value={box.id}>{box.name} [رصيد: {box.balance?.toLocaleString() || 0}]</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">البيان الواضح والتفسير</label>
                      <textarea
                        required
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold h-20"
                        value={assetsForm.description}
                        onChange={(e) => setAssetsForm({ ...assetsForm, description: e.target.value })}
                        placeholder="الرجاء توضيح أي تفاصيل تخدم المراجعة والتدقيق"
                      />
                    </div>
                  </div>
                )}

                {/* 3. Receipt Voucher */}
                {selectedCardForm === 'receipt_voucher' && (
                  <div className="space-y-3 text-right">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">مبلغ السند المقبوض (ر.ي)</label>
                      <input
                        required
                        type="number"
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                        value={receiptForm.amount}
                        onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">استلمنا وقبضنا من السيد/الشركة</label>
                      <input
                        required
                        type="text"
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                        value={receiptForm.receivedFrom}
                        onChange={(e) => setReceiptForm({ ...receiptForm, receivedFrom: e.target.value })}
                        placeholder="اسم العميل أو الجهة الموردة للمال"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">الصندوق المستلم المستهدف</label>
                      <select
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                        value={receiptForm.boxId}
                        onChange={(e) => setReceiptForm({ ...receiptForm, boxId: e.target.value })}
                      >
                        <option value="CASH_BOX">الصندوق الرئيسي للمحل</option>
                        {combinedBoxesForSelect.map(box => (
                          <option key={box.id} value={box.id}>{box.name} [رصيد: {box.balance?.toLocaleString() || 0}]</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">شرح وتوضيح سبب القبض</label>
                      <textarea
                        required
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold h-20"
                        value={receiptForm.description}
                        onChange={(e) => setReceiptForm({ ...receiptForm, description: e.target.value })}
                        placeholder="مثال: دفعة تحت الحساب لتأكيد شراء جوالات"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Cash purchases (Updated with Supplier & Invoice Number) */}
                {selectedCardForm === 'cash_purchases' && (
                  <div className="space-y-3 text-right">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">قيمة المشتريات (ريال يمني)</label>
                      <input
                        required
                        type="number"
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                        value={cashPurchaseForm.amount}
                        onChange={(e) => setCashPurchaseForm({ ...cashPurchaseForm, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">اسم المورد (المستودع/التاجر)</label>
                        <select
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black cursor-pointer"
                          value={cashPurchaseForm.supplierName}
                          onChange={(e) => setCashPurchaseForm({ ...cashPurchaseForm, supplierName: e.target.value })}
                        >
                          <option value="">-- اختار المورد من القائمة --</option>
                          {suppliersList.map(sup => (
                            <option key={sup.id} value={sup.name || sup.supplierName}>
                              {sup.name || sup.supplierName} {sup.phone ? `(${sup.phone})` : ''}
                            </option>
                          ))}
                          <option value="مورد مباشر / كاش">مورد مباشر / شراء كاش من السوق</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">رقم فاتورة المشتريات بالمخزن</label>
                        <input
                          type="text"
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                          value={cashPurchaseForm.invoiceId}
                          onChange={(e) => setCashPurchaseForm({ ...cashPurchaseForm, invoiceId: e.target.value })}
                          placeholder="مثال: INV-98214"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">نوع السلعة المشتراة</label>
                        <select
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black cursor-pointer"
                          value={cashPurchaseForm.purchaseType}
                          onChange={(e) => setCashPurchaseForm({ ...cashPurchaseForm, purchaseType: e.target.value })}
                        >
                          <option value="رصيد">رصيد (شحن وتفعيل باقات)</option>
                          <option value="شرايح">شرايح وفك تشفير الجيل الخامس</option>
                          <option value="إكسسوارات">إكسسوارات ونظارات وسماعات</option>
                          <option value="قطع غيار">شاشات، بطاريات، لوحات صيانة</option>
                          <option value="جوالات">هواتف سامسونج، شاومي، إل جي</option>
                          <option value="هواتف">هواتف آيفون وأجهزة أصلية</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">اسم صنف وموديل السلعة</label>
                        <input
                          required
                          type="text"
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                          value={cashPurchaseForm.itemName}
                          onChange={(e) => setCashPurchaseForm({ ...cashPurchaseForm, itemName: e.target.value })}
                          placeholder="الرجاء كتابة اسم البضاعة"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">الدفع كاش من صندوق</label>
                      <select
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                        value={cashPurchaseForm.boxId}
                        onChange={(e) => setCashPurchaseForm({ ...cashPurchaseForm, boxId: e.target.value })}
                      >
                        <option value="CASH_BOX">الصندوق الرئيسي للمحل</option>
                        {combinedBoxesForSelect.map(box => (
                          <option key={box.id} value={box.id}>{box.name} [رصيد: {box.balance?.toLocaleString() || 0}]</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">البيان والملاحظات</label>
                      <textarea
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold h-16"
                        value={cashPurchaseForm.description}
                        onChange={(e) => setCashPurchaseForm({ ...cashPurchaseForm, description: e.target.value })}
                        placeholder="تفاصيل فاتورة الشراء وطريقة التوريد للمستودع"
                      />
                    </div>
                  </div>
                )}

                {/* 5. Receive Transfer */}
                {selectedCardForm === 'receive_transfer' && (
                  <div className="space-y-3 text-right">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">المبلغ المستقبل بالحوالة (ر.ي)</label>
                      <input
                        required
                        type="number"
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                        value={receiveTransferForm.amount}
                        onChange={(e) => setReceiveTransferForm({ ...receiveTransferForm, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">اسم مرسل الحوالة بالتفسير</label>
                        <input
                          required
                          type="text"
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                          value={receiveTransferForm.senderName}
                          onChange={(e) => setReceiveTransferForm({ ...receiveTransferForm, senderName: e.target.value })}
                          placeholder="من السيد"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">الشبكة أو البنك الصارف</label>
                        <select
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold cursor-pointer"
                          value={receiveTransferForm.network}
                          onChange={(e) => setReceiveTransferForm({ ...receiveTransferForm, network: e.target.value })}
                        >
                          <option value="الكريمي">بنك الكريمي الإسلامي</option>
                          <option value="النجم">شبكة النجم للحوالات</option>
                          <option value="الحزمي">رابط الحزمي المحاسبي</option>
                          <option value="المريسي">سند شبكة المريسي</option>
                          <option value="دادي">منظومة دادي للاتصالات</option>
                          <option value="النخبة">شبكة النخبة لتبادل الأموال</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">إيداع وقيد الحساب المستهدف للشبكة</label>
                      <select
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold cursor-pointer"
                        value={receiveTransferForm.boxId}
                        onChange={(e) => setReceiveTransferForm({ ...receiveTransferForm, boxId: e.target.value })}
                      >
                        <option value="CASH_BOX">الصندوق الرئيسي للمحل</option>
                        {combinedBoxesForSelect.map(box => (
                          <option key={box.id} value={box.id}>{box.name} [رصيد: {box.balance?.toLocaleString() || 0}]</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">رقم الحوالة أو معلومات إضافية</label>
                      <textarea
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold h-16"
                        value={receiveTransferForm.description}
                        onChange={(e) => setReceiveTransferForm({ ...receiveTransferForm, description: e.target.value })}
                        placeholder="كتابة كود الاستلام المؤلف من أرقام للشبكة"
                      />
                    </div>
                  </div>
                )}

                {/* 6. Staff Payroll Form (Updated with Employee Dropdown & Payout Type) */}
                {selectedCardForm === 'staff_payroll' && (
                  <div className="space-y-3 text-right">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">المبلغ المدفوع (ريال يمني)</label>
                      <input
                        required
                        type="number"
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                        value={payrollForm.amount}
                        onChange={(e) => setPayrollForm({ ...payrollForm, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">اختر الموظف / ملف الفني</label>
                        <select
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                          value={payrollForm.employeeName}
                          onChange={(e) => {
                            const emp = employeesList.find(u => (u.displayName || u.name) === e.target.value);
                            setPayrollForm({ 
                              ...payrollForm, 
                              employeeName: e.target.value,
                              employeeUid: emp ? emp.uid : ''
                            });
                          }}
                        >
                          <option value="">-- اختر الموظف من السجل --</option>
                          {employeesList.map(emp => (
                            <option key={emp.uid} value={emp.displayName || emp.name || emp.email}>
                              {emp.displayName || emp.name || emp.email} ({emp.role === 'engineer' ? 'مهندس' : 'موظف'})
                            </option>
                          ))}
                          <option value="موظف عام / عهدة">موظف عام / عهدة ميدانية</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">نوع المستحق والخرج</label>
                        <select
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                          value={payrollForm.payrollType}
                          onChange={(e) => setPayrollForm({ ...payrollForm, payrollType: e.target.value })}
                        >
                          <option value="راتب شهري">راتب شهري أساسي</option>
                          <option value="سلفة / سحب شخصي">سلفة مالية / سحب شخصي</option>
                          <option value="بدل / مكافأة">بدل سكن/مكافأة إنجاز</option>
                          <option value="حساب عهود">حساب عهود ومشتريات</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">رواتب وأجور عن شهر</label>
                        <input
                          required
                          type="text"
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold text-center"
                          value={payrollForm.month}
                          onChange={(e) => setPayrollForm({ ...payrollForm, month: e.target.value })}
                          placeholder="الرجاء توضيح الشهر المستحق"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">يصرف من صندوق مالي</label>
                        <select
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                          value={payrollForm.boxId}
                          onChange={(e) => setPayrollForm({ ...payrollForm, boxId: e.target.value })}
                        >
                          <option value="CASH_BOX">الصندوق الرئيسي للمحل</option>
                          {combinedBoxesForSelect.map(box => (
                            <option key={box.id} value={box.id}>{box.name} [رصيد: {box.balance?.toLocaleString() || 0}]</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">البيان والملحوظات</label>
                      <textarea
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold h-16"
                        value={payrollForm.description}
                        onChange={(e) => setPayrollForm({ ...payrollForm, description: e.target.value })}
                        placeholder="راتب أساسي، عهدة تشغيلية، سلفة مالية"
                      />
                    </div>
                  </div>
                )}

                {/* 7. Cash outflow return */}
                {selectedCardForm === 'return_value' && (
                  <div className="space-y-3 text-right">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">المبلغ المصروف المردود (ر.ي)</label>
                      <input
                        required
                        type="number"
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                        value={returnValueForm.amount}
                        onChange={(e) => setReturnValueForm({ ...returnValueForm, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">اسم الزبون/المستلم</label>
                        <input
                          required
                          type="text"
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                          value={returnValueForm.customerName}
                          onChange={(e) => setReturnValueForm({ ...returnValueForm, customerName: e.target.value })}
                          placeholder="الاسم"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">كود الفاتورة الأصلية (اختياري)</label>
                        <input
                          type="text"
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                          value={returnValueForm.invoiceId}
                          onChange={(e) => setReturnValueForm({ ...returnValueForm, invoiceId: e.target.value })}
                          placeholder="الرمز التعريفي"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">خصم وصرف من صندوق</label>
                      <select
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold cursor-pointer"
                        value={returnValueForm.boxId}
                        onChange={(e) => setReturnValueForm({ ...returnValueForm, boxId: e.target.value })}
                      >
                        <option value="CASH_BOX">الصندوق الرئيسي للمحل</option>
                        {combinedBoxesForSelect.map(box => (
                          <option key={box.id} value={box.id}>{box.name} [رصيد: {box.balance?.toLocaleString() || 0}]</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">السبب وراء المرتجع ماليّاً ومخزنيّاً</label>
                      <textarea
                        required
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold h-16"
                        value={returnValueForm.description}
                        onChange={(e) => setReturnValueForm({ ...returnValueForm, description: e.target.value })}
                        placeholder="تلف بالمرتجع، خلاف فني إلخ"
                      />
                    </div>
                  </div>
                )}

                {/* 8. Paid Commission Outflow */}
                {selectedCardForm === 'commissions' && (
                  <div className="space-y-3 text-right">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">المبلغ المخصوم والصارف (ر.ي)</label>
                      <input
                        required
                        type="number"
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black"
                        value={commissionForm.amount}
                        onChange={(e) => setCommissionForm({ ...commissionForm, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">اسم المندوب أو المستفيد المستلم</label>
                        <input
                          required
                          type="text"
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold"
                          value={commissionForm.recipientName}
                          onChange={(e) => setCommissionForm({ ...commissionForm, recipientName: e.target.value })}
                          placeholder="المندوب للتصفير"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-black text-gray-400 block">فئة العمولة</label>
                        <select
                          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold cursor-pointer"
                          value={commissionForm.commissionType}
                          onChange={(e) => setCommissionForm({ ...commissionForm, commissionType: e.target.value })}
                        >
                          <option value="عمولة مبيعات">عمولة مبيعات وتجارة</option>
                          <option value="عمولة باقات تفويض">عمولة باقات شحن المنظومة</option>
                          <option value="عمولة مهندس صيانة">عمولة المهندس والفنيين</option>
                          <option value="حوافز ترويجية">حافز ترويجي وجلب زبائن</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">الصندوق الصارف</label>
                      <select
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold cursor-pointer"
                        value={commissionForm.boxId}
                        onChange={(e) => setCommissionForm({ ...commissionForm, boxId: e.target.value })}
                      >
                        <option value="CASH_BOX">الصندوق الرئيسي للمحل</option>
                        {combinedBoxesForSelect.map(box => (
                          <option key={box.id} value={box.id}>{box.name} [رصيد: {box.balance?.toLocaleString() || 0}]</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-gray-400 block">تفصيل وبيان الحركة المحاسبية</label>
                      <textarea
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-bold h-16"
                        value={commissionForm.description}
                        onChange={(e) => setCommissionForm({ ...commissionForm, description: e.target.value })}
                        placeholder="تفاصيل العمولات المرتبطة بحركة أو أمر بيع"
                      />
                    </div>
                  </div>
                )}

                {/* Submits and action controls */}
                <div className="pt-3 border-t border-gray-100 dark:border-navy-700 flex gap-3 font-sans">
                  <button
                    type="button"
                    onClick={() => setSelectedCardForm(null)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-navy-900/50 hover:bg-gray-200 dark:hover:bg-navy-900 text-gray-500 dark:text-white font-extrabold rounded-xl text-xs transition-colors"
                  >
                    إلغاء وخروج
                  </button>
                  <button
                    type="submit"
                    disabled={submittedLoading}
                    className="flex-1 py-3 bg-success hover:scale-[1.01] text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                  >
                    {submittedLoading ? (
                      <>
                        <RefreshCcw className="animate-spin text-white" size={14} />
                        ترحيل القيد...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={14} />
                        تأكيد وإثبات القيد ✓
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual value adjust popup overlay */}
      <AnimatePresence>
        {adjustingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 shadow-2xl p-4 backdrop-blur-sm font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-navy-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 border border-gray-150 dark:border-navy-700 space-y-4"
            >
              <div className="text-right">
                <h3 className="text-sm font-black text-navy-950 dark:text-white">✏️ ضبط وتعديل العداد محاسبيّاً</h3>
                <p className="text-[10px] text-gray-400 font-bold mt-1">يرجى تعديل قيمة كرت [{adjustingCategory.name}] يدويّاً لتعدية فروق السجلات لليوم</p>
              </div>

              <div className="space-y-1 text-right">
                <label className="text-[11px] font-black text-gray-400 block select-none">القيمة الحالية (ر.ي)</label>
                <input
                  type="number"
                  className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-150 dark:border-navy-800 text-xs text-navy-950 dark:text-white font-black"
                  value={tempAdjustValue}
                  onChange={(e) => setTempAdjustValue(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...manualAdjustments };
                    delete updated[adjustingCategory.key];
                    setManualAdjustments(updated);
                    localStorage.setItem('jam_accounting_adjustments', JSON.stringify(updated));
                    setAdjustingCategory(null);
                  }}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-danger border border-red-100 rounded-xl text-[10px] font-black"
                >
                  العودة للعد التلقائي 🔄
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustingCategory(null)}
                  className="px-3 py-2 bg-gray-100 dark:bg-navy-950 hover:bg-gray-200 text-gray-500 rounded-xl text-[10px] font-black mr-auto"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const val = parseFloat(tempAdjustValue);
                    if (!isNaN(val)) {
                      updateManualAdjustment(adjustingCategory.key, val);
                    }
                    setAdjustingCategory(null);
                  }}
                  className="px-4 py-2 bg-success text-white rounded-xl text-[10px] font-black"
                >
                  حفظ ✓
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
