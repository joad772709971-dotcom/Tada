import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  Timestamp,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Account, JournalEntry, InventoryItem } from '../types';
import QuickAccountingDashboard from './QuickAccountingDashboard';
import { 
  initializeChartOfAccounts, 
  getProfitAndLoss 
} from '../services/accountingService';
import { realtimeSyncService } from '../services/realtimeSyncService';
import { 
  Book, 
  List, 
  PieChart, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Calendar,
  Search,
  ArrowLeftRight,
  Plus,
  Loader2,
  Undo,
  AlertCircle,
  Trash2,
  RefreshCcw,
  Activity,
  Wallet,
  Coins,
  Wrench,
  Smartphone,
  CreditCard,
  Headphones,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingCart,
  Lock,
  FileText,
  Landmark,
  ShieldCheck,
  Bot,
  Sparkles,
  Mic
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import SmartAIAccountantModal from './SmartAIAccountantModal';

interface AccountingProps {
  profile: UserProfile | null;
}

// معالج العكس البرمجي المتوازي (Parallel Rollback Handler)
export const handleInvoiceRollbackAndSync = async (
  invoiceId: string,
  storeCode: string,
  payload: {
    itemsToReturn: Array<{ productId: string; warehouseId: string; quantity: number }>;
    moneyToWithdraw: { boxId: string; amount: number };
  },
  onExecutionComplete: () => void
) => {
  try {
    console.log(`🚨 بدء عملية التراجع والإلغاء الصارم للفاتورة: ${invoiceId}`);

    // الخطوة 1 مالياً: عكس القيد وسحب الفلوس من الصندوق المحدد الذي دخلت فيه
    console.log(`💰 جاري خصم وتصفية ${payload.moneyToWithdraw.amount} من الصندوق: ${payload.moneyToWithdraw.boxId}`);
    
    await runTransaction(db, async (transaction) => {
      // 1. Subtract money from box
      const boxId = payload.moneyToWithdraw.boxId || 'CASH_BOX';
      const bankRef = doc(db, 'bank_accounts', boxId);
      const customRef = doc(db, 'stores', storeCode, 'customBoxes', boxId);
      const bankSnap = await transaction.get(bankRef);
      const customSnap = await transaction.get(customRef);

      if (bankSnap.exists()) {
        const currentBal = Number(bankSnap.data().balance || 0);
        transaction.update(bankRef, {
          balance: parseFloat((currentBal - payload.moneyToWithdraw.amount).toFixed(4)),
          updatedAt: serverTimestamp()
        });
      } else if (customSnap.exists()) {
        const currentBal = Number(customSnap.data().balance || 0);
        transaction.update(customRef, {
          balance: parseFloat((currentBal - payload.moneyToWithdraw.amount).toFixed(4))
        });

        // If linked to a bank account, also subtract from that bank account in full synchrony!
        const customData = customSnap.data();
        if (customData.isLinkedToBank && customData.bankAccountId) {
          const linkedBankRef = doc(db, 'bank_accounts', customData.bankAccountId);
          const linkedBankSnap = await transaction.get(linkedBankRef);
          if (linkedBankSnap.exists()) {
            const currentBankBal = Number(linkedBankSnap.data().balance || 0);
            transaction.update(linkedBankRef, {
              balance: parseFloat((currentBankBal - payload.moneyToWithdraw.amount).toFixed(4)),
              updatedAt: serverTimestamp()
            });
          }
        }
      } else {
        // Fallback for customBoxes or CASH_BOX to prevent errors
        transaction.set(customRef, {
          id: boxId,
          boxName: boxId === 'CASH_BOX' ? 'صندوق النقد الرئيسي (الكاش)' : 'صندوق مالي فرعي',
          type: 'cash',
          balance: parseFloat((-payload.moneyToWithdraw.amount).toFixed(4)),
          ownerId: storeCode,
          createdAt: serverTimestamp()
        }, { merge: true });
      }

      // 2. Add quantities back into the main products structure
      for (const item of payload.itemsToReturn) {
        if (!item.productId) continue;
        const productRef = doc(db, 'inventory', item.productId);
        const productSnap = await transaction.get(productRef);
        if (productSnap.exists()) {
          const currentStock = Number(productSnap.data().stock || 0);
          transaction.update(productRef, {
            stock: parseFloat((currentStock + item.quantity).toFixed(4)),
            updatedAt: serverTimestamp()
          });

          // update subcollection/nested warehouse stock
          const whId = item.warehouseId || productSnap.data().category || 'المحل';
          const whStockRef = doc(db, 'warehouses', whId, 'stock', item.productId);
          const whStockSnap = await transaction.get(whStockRef);
          let currentWhStock = 0;
          if (whStockSnap.exists()) {
            currentWhStock = Number(whStockSnap.data().stock || 0);
          }
          transaction.set(whStockRef, {
            productId: item.productId,
            warehouseId: whId,
            stock: parseFloat((currentWhStock + item.quantity).toFixed(4)),
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }

      // 3. Mark the sale voucher as cancelled
      const saleRef = doc(db, 'sales', invoiceId);
      const saleSnap = await transaction.get(saleRef);
      if (saleSnap.exists()) {
        transaction.update(saleRef, {
          status: 'cancelled',
          isVoided: true,
          updatedAt: serverTimestamp()
        });
      }

      const orderRef = doc(db, 'orders', invoiceId);
      const orderSnap = await transaction.get(orderRef);
      if (orderSnap.exists()) {
        transaction.update(orderRef, {
          status: 'cancelled',
          updatedAt: serverTimestamp()
        });
      }

      // 4. Post journal cancellation
      const cancelJournalRef = doc(collection(db, 'journalEntries'));
      const journalItems = [];
      if (payload.moneyToWithdraw.amount > 0) {
        journalItems.push({
          accountName: 'صندوق التسويات / المرتجعات',
          debit: payload.moneyToWithdraw.amount,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: payload.moneyToWithdraw.amount
        });
        journalItems.push({
          accountName: boxId === 'CASH_BOX' ? 'الصندوق العام للمحل' : 'الحساب المصرفي المستهدف',
          debit: 0,
          credit: payload.moneyToWithdraw.amount,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: payload.moneyToWithdraw.amount
        });
      }

      transaction.set(cancelJournalRef, {
        ownerId: storeCode,
        description: `إلغاء وعكس قيد مالي للفاتورة رقم: ${invoiceId}`,
        items: journalItems,
        date: serverTimestamp(),
        referenceId: invoiceId,
        type: 'VOID_ROLLBACK'
      });

      // 5. Create a transaction of type expense/refund to balance the registry
      const transRef = doc(collection(db, 'transactions'));
      transaction.set(transRef, {
        ownerId: storeCode,
        type: 'expense',
        amount: payload.moneyToWithdraw.amount,
        originalAmount: payload.moneyToWithdraw.amount,
        currency: 'YER',
        exchangeRate: 1,
        category: 'مرتجع مبيعات / إلغاء فاتورة',
        description: `تراجع مالي فوري وإلغاء القيود للفاتورة ${invoiceId}`,
        boxId: boxId === 'CASH_BOX' ? '' : boxId,
        createdAt: serverTimestamp()
      });
    });

    console.log(`✓ تم تصفية الأموال وإرجاع المنتجات لمستودعها الأصلي للفاتورة: ${invoiceId}`);

    // أمر تحديث جرد المخازن وصحيفة الصندوق اللحظي في واجهة المستخدم (Force Re-fetch)
    onExecutionComplete();
    
    return { success: true, message: "تم إلغاء الفاتورة وعكس كافة القيود ماليّاً ومخزنيّاً بنجاح!" };
  } catch (error) {
    console.error("فشل التراجع عن الفاتورة:", error);
    return { success: false, error: (error as Error).message || error };
  }
};

export default function Accounting({ profile }: AccountingProps) {
  const [isAIAccountantOpen, setIsAIAccountantOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick_accounting' | 'accounts' | 'ledger' | 'reports' | 'rollback'>('quick_accounting');
  const [quickTab, setQuickTab] = useState<'income_expense' | 'daily_summaries'>('income_expense');
  const [selectedCardForm, setSelectedCardForm] = useState<string | null>(null);
  const [submittedLoading, setSubmittedLoading] = useState(false);

  // States for Tab 2 summaries
  const [salesList, setSalesList] = useState<any[]>([]);
  const [transactionsList, setTransactionsList] = useState<any[]>([]);
  const [maintenanceList, setMaintenanceList] = useState<any[]>([]);
  const [bookingsList, setBookingsList] = useState<any[]>([]);

  // Manual values overrides state (to allow Eng. Abu Jawad to adjust daily counts manually)
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
  const [generalExpenseForm, setGeneralExpenseForm] = useState({ amount: '', boxId: 'CASH_BOX', category: 'مصاريف عامة', description: '' });
  const [assetsForm, setAssetsForm] = useState({ amount: '', boxId: 'CASH_BOX', subCategory: 'كهرباء', description: '' });
  const [receiptForm, setReceiptForm] = useState({ amount: '', receivedFrom: '', boxId: 'CASH_BOX', description: '' });
  const [cashPurchaseForm, setCashPurchaseForm] = useState({ amount: '', purchaseType: 'رصيد', itemName: '', boxId: 'CASH_BOX', description: '' });
  const [receiveTransferForm, setReceiveTransferForm] = useState({ amount: '', senderName: '', network: 'الكريمي', boxId: 'CASH_BOX', description: '' });
  const [payrollForm, setPayrollForm] = useState({ amount: '', employeeName: '', month: '', boxId: 'CASH_BOX', description: '' });
  const [returnValueForm, setReturnValueForm] = useState({ amount: '', customerName: '', boxId: 'CASH_BOX', invoiceId: '', description: '' });
  const [commissionForm, setCommissionForm] = useState({ amount: '', recipientName: '', commissionType: 'عمولة مبيعات', boxId: 'CASH_BOX', description: '' });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [pnL, setPnL] = useState<{ totalRevenue: number, totalExpenses: number, netProfit: number, exchangeDiff: number } | null>(null);

  // Rollback System States
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [customBoxes, setCustomBoxes] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingRollback, setLoadingRollback] = useState(false);
  
  const [rollbackForm, setRollbackForm] = useState({
    invoiceId: '',
    boxId: 'CASH_BOX',
    amount: '',
    items: [] as Array<{ productId: string; warehouseId: string; quantity: number }>
  });

  const [newItemToReturn, setNewItemToReturn] = useState({
    productId: '',
    warehouseId: 'المحل',
    quantity: ''
  });

  useEffect(() => {
    if (!profile?.ownerId) return;

    // Initialize accounts if they don't exist
    initializeChartOfAccounts(profile.ownerId);

    // Listen to accounts
    const qAccounts = query(
      collection(db, 'accounts'),
      where('ownerId', '==', profile.ownerId),
      orderBy('accountNumber', 'asc')
    );

    const unsubscribeAccounts = onSnapshot(qAccounts, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
      setLoading(false);
    }, (error) => {
      console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubscribeAccounts):", error.message);
      setAccounts([]);
      setLoading(false);
    });

    // Listen to ledger entries
    const qLedger = query(
      collection(db, 'journalEntries'),
      where('ownerId', '==', profile.ownerId),
      orderBy('date', 'desc')
    );

    const unsubscribeLedger = onSnapshot(qLedger, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry)));
    }, (error) => {
      console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubscribeLedger):", error.message);
      setEntries([]);
    });

    // Listen to bank/treasury boxes
    const qBanks = query(
      collection(db, 'bank_accounts'),
      where('ownerId', '==', profile.ownerId)
    );

    const unsubscribeBanks = onSnapshot(qBanks, (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubscribeBanks):", error.message);
      setBankAccounts([]);
    });

    const unsubscribeCustomBoxes = onSnapshot(
      collection(db, 'stores', profile.ownerId, 'customBoxes'),
      (snapshot) => {
        setCustomBoxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubscribeCustomBoxes):", error.message);
        setCustomBoxes([]);
      }
    );

    // Listen to inventory for rollback lists
    const qInventory = query(
      collection(db, 'inventory'),
      where('ownerId', '==', profile.ownerId)
    );

    const unsubscribeInventory = onSnapshot(qInventory, (snapshot) => {
      setInventoryItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    }, (error) => {
      console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubscribeInventory):", error.message);
      setInventoryItems([]);
    });

    // Listen to Sales for Tab 2
    const qSales = query(
      collection(db, 'sales'),
      where('ownerId', '==', profile.ownerId)
    );
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      setSalesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("JAM SYSTEM PRO - Locked Sales Error Safely:", err.message);
      setSalesList([]);
    });

    // Listen to Transactions with Multi-Tenant Isolation via realtimeSyncService
    const shopId = profile.shopId || profile.ownerId || 'main_store';
    const unsubscribeTransactions = realtimeSyncService.listenToTransactions(
      shopId,
      (items) => {
        setTransactionsList(items as any);
      },
      (err) => {
        console.warn("JAM SYSTEM PRO - Locked Transactions Error Safely:", err.message);
        setTransactionsList([]);
      }
    );

    // Listen to Maintenance Orders
    const qMaintenance = query(
      collection(db, 'maintenanceOrders'),
      where('ownerId', '==', profile.ownerId)
    );
    const unsubscribeMaintenance = onSnapshot(qMaintenance, (snapshot) => {
      setMaintenanceList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("JAM SYSTEM PRO - Locked Maintenance Error Safely:", err.message);
      setMaintenanceList([]);
    });

    // Listen to Bookings (reservations)
    const qBookings = query(
      collection(db, 'bookings'),
      where('ownerId', '==', profile.ownerId)
    );
    const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
      setBookingsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("JAM SYSTEM PRO - Locked Bookings Error Safely:", err.message);
      setBookingsList([]);
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeLedger();
      unsubscribeBanks();
      unsubscribeCustomBoxes();
      unsubscribeInventory();
      unsubscribeSales();
      unsubscribeTransactions();
      unsubscribeMaintenance();
      unsubscribeBookings();
    };
  }, [profile?.ownerId]);

  useEffect(() => {
    if (!profile?.ownerId) return;
    
    const fetchPnL = async () => {
      const data = await getProfitAndLoss(
        profile.ownerId, 
        new Date(dateRange.start), 
        new Date(dateRange.end)
      );
      setPnL(data);
    };

    fetchPnL();
  }, [profile?.ownerId, dateRange]);

  const filteredAccounts = accounts.filter(acc => 
    acc.accountName.includes(searchTerm) || acc.accountNumber.includes(searchTerm)
  );

  // ==========================================
  // CALCULATIONS FOR TAB 2 - REAL-TIME SUMMARIES with MANUAL ADJUSTMENTS OVERRIDES
  // ==========================================
  
  // 1. إجمالي مبيع رصيد (Recharge / Balance Sales)
  const totalBalanceSales = (manualAdjustments['totalBalanceSales'] !== undefined ? manualAdjustments['totalBalanceSales'] : 
    (
      transactionsList
        .filter(t => t.type === 'income' && (t.category?.includes('رصيد') || t.description?.includes('رصيد')))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0) +
      salesList.reduce((sum, s) => {
        const itemSum = (s.items || []).filter((item: any) => 
          (item.productName || item.name || '').includes('رصيد') || 
          (item.productName || item.name || '').includes('شحن') ||
          (item.productName || item.name || '').includes('كارت') ||
          (item.productName || item.name || '').includes('كرت')
        ).reduce((pSum: number, item: any) => pSum + (Number(item.price) * Number(item.quantity) || 0), 0);
        
        const catSum = (s.category || '').includes('رصيد') && s.totalAmount ? Number(s.totalAmount) : 0;
        return sum + itemSum + catSum;
      }, 0)
    )
  );

  // 2. إجمالي صيانة (Repair & Maintenance Sales)
  const totalMaintenance = (manualAdjustments['totalMaintenance'] !== undefined ? manualAdjustments['totalMaintenance'] : 
    (
      maintenanceList
        .reduce((sum, m) => sum + (Number(m.totalCost || m.price || m.cost || 0)), 0) +
      transactionsList
        .filter(t => t.type === 'income' && t.category === 'إجمالي صيانة')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    )
  );

  // 3. إجمالي شرايح (SIM Cards Sales)
  const totalSimSales = (manualAdjustments['totalSimSales'] !== undefined ? manualAdjustments['totalSimSales'] : 
    (
      transactionsList
        .filter(t => t.type === 'income' && (t.category?.includes('شرايح') || t.category?.includes('شريحة')))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0) +
      salesList.reduce((sum, s) => {
        const itemSum = (s.items || []).filter((item: any) => 
          (item.productName || item.name || '').includes('شريحة') || 
          (item.productName || item.name || '').includes('شرايح') ||
          (item.productName || item.name || '').includes('شفرة') ||
          (item.productName || item.name || '').includes('SIM')
        ).reduce((pSum: number, item: any) => pSum + (Number(item.price) * Number(item.quantity) || 0), 0);
        return sum + itemSum;
      }, 0)
    )
  );

  // 4. إجمالي إكسسوارات (Accessories Sales)
  const totalAccessoriesSales = (manualAdjustments['totalAccessoriesSales'] !== undefined ? manualAdjustments['totalAccessoriesSales'] : 
    (
      transactionsList
        .filter(t => t.type === 'income' && (t.category?.includes('إكسسوار') || t.description?.includes('اكسسوار')))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0) +
      salesList.reduce((sum, s) => {
        const itemSum = (s.items || []).filter((item: any) => 
          (item.productName || item.name || '').includes('إكسسوار') || 
          (item.productName || item.name || '').includes('اكسسوار') ||
          (item.productName || item.name || '').includes('سماعة') ||
          (item.productName || item.name || '').includes('شاحن') ||
          (item.productName || item.name || '').includes('لاصق') ||
          (item.productName || item.name || '').includes('حماية')
        ).reduce((pSum: number, item: any) => pSum + (Number(item.price) * Number(item.quantity) || 0), 0);
        return sum + itemSum;
      }, 0)
    )
  );

  // 5. إجمالي جوالات (Mobile Phone Sales)
  const totalPhoneSales = (manualAdjustments['totalPhoneSales'] !== undefined ? manualAdjustments['totalPhoneSales'] : 
    (
      transactionsList
        .filter(t => t.type === 'income' && (t.category?.includes('جوال') || t.category?.includes('هاتف') || t.description?.includes('تلفون') || t.description?.includes('موبايل')))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0) +
      salesList.reduce((sum, s) => {
        const itemSum = (s.items || []).filter((item: any) => 
          (item.productName || item.name || '').includes('جوال') || 
          (item.productName || item.name || '').includes('هاتف') ||
          (item.productName || item.name || '').includes('تلفون') ||
          (item.productName || item.name || '').includes('موبايل') ||
          (item.productName || item.name || '').includes('iPhone') ||
          (item.productName || item.name || '').includes('Samsung') ||
          (item.productName || item.name || '').includes('هواتف')
        ).reduce((pSum: number, item: any) => pSum + (Number(item.price) * Number(item.quantity) || 0), 0);
        return sum + itemSum;
      }, 0)
    )
  );

  // 6. إجمالي حجوزات مدفوعة (Paid Bookings / Reservations)
  const totalPaidReservations = (manualAdjustments['totalPaidReservations'] !== undefined ? manualAdjustments['totalPaidReservations'] : 
    (
      bookingsList
        .filter(b => b.status === 'completed' || b.status === 'paid' || b.depositPaid)
        .reduce((sum, b) => sum + (Number(b.paymentAmount || b.deposit || b.price || b.cost || 0)), 0) +
      transactionsList
        .filter(t => t.type === 'income' && t.category === 'إجمالي حجوزات مدفوعة')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    )
  );

  // 7. بيع السوق - جوالات
  const marketPhoneSales = (manualAdjustments['marketPhoneSales'] !== undefined ? manualAdjustments['marketPhoneSales'] : 
    transactionsList
      .filter(t => t.type === 'income' && t.category === 'بيع السوق - جوالات')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  );

  // 8. بيع السوق - إكسسوارات
  const marketAccessingSales = (manualAdjustments['marketAccessingSales'] !== undefined ? manualAdjustments['marketAccessingSales'] : 
    transactionsList
      .filter(t => t.type === 'income' && t.category === 'بيع السوق - إكسسوارات')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  );

  // 9. بيع السوق - قطع غيار
  const marketPartsSales = (manualAdjustments['marketPartsSales'] !== undefined ? manualAdjustments['marketPartsSales'] : 
    transactionsList
      .filter(t => t.type === 'income' && t.category === 'بيع السوق - قطع غيار')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  );

  // 10. بيع السوق - أخرى
  const marketOtherSales = (manualAdjustments['marketOtherSales'] !== undefined ? manualAdjustments['marketOtherSales'] : 
    transactionsList
      .filter(t => t.type === 'income' && t.category === 'بيع السوق - أخرى')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  );

  // ==========================================
  // UNIFIED HANDLER TO REGISTER ANY ACCOUNTING MOVE WITH ATOMIC MULTI-DOC TRANS
  // ==========================================
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
          finalDescription = formData.description || 'صرف ومصروفات عامة للمحل';
          break;
        case 'assets_taxes_zakat':
          transType = 'expense';
          databaseCategory = 'أصول، ضرائب وزكاة';
          finalDescription = `[فئة: ${formData.subCategory || 'كهرباء'}] ${formData.description || 'مصاريف أصول/زكاة'}`;
          break;
        case 'receipt_voucher':
          transType = 'income';
          databaseCategory = 'سند قبض';
          finalDescription = `مستلم من: ${formData.receivedFrom || 'عميل'} - ${formData.description || 'تلقي سند مالي'}`;
          break;
        case 'cash_purchases':
          transType = 'expense';
          databaseCategory = 'مشتريات نقدية';
          finalDescription = `[شراء: ${formData.purchaseType || 'رصيد'} - صنف: ${formData.itemName || 'عام'}] ${formData.description || ''}`;
          break;
        case 'receive_transfer':
          transType = 'income';
          databaseCategory = 'استلام إيداع';
          finalDescription = `استلام إيداع من: ${formData.senderName || 'غير معروف'} عبر: ${formData.network || 'الكريمي'} - ${formData.description || ''}`;
          break;
        case 'staff_payroll':
          transType = 'expense';
          databaseCategory = 'تسليم رواتب';
          finalDescription = `رواتب وتسليم الموظف: ${formData.employeeName || 'عامل'} لشهر: ${formData.month || 'الجاري'} - ${formData.description || ''}`;
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

      await runTransaction(db, async (transaction) => {
        // 1. Write the transaction with Multi-Tenant Isolation
        const shopId = profile.shopId || profile.ownerId || 'main_store';
        const transColRef = doc(collection(db, 'transactions'));
        const txPayload = {
          ownerId: profile.ownerId,
          shopId: shopId,
          type: transType,
          amount: amountNum,
          totalAmount: amountNum,
          originalAmount: amountNum,
          currency: 'YER',
          exchangeRate: 1,
          category: databaseCategory,
          description: finalDescription,
          boxId: boxId === 'CASH_BOX' ? '' : boxId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        transaction.set(transColRef, txPayload);

        const isolatedTxRef = doc(db, 'shops', shopId, 'transactions', transColRef.id);
        transaction.set(isolatedTxRef, txPayload);

        // 2. Adjust target box balance (Double entry and Cash flow adjustment)
        const targetBoxId = boxId || 'CASH_BOX';
        const bankRef = doc(db, 'bank_accounts', targetBoxId);
        const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', targetBoxId);
        
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

          // Sync linked bank if applicable
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
        } else {
          // Fallback create/merge for customBox or CASH_BOX to guarantee balance update
          transaction.set(customRef, {
            id: targetBoxId,
            boxName: targetBoxId === 'CASH_BOX' ? 'صندوق النقد الرئيسي (الكاش)' : 'صندوق مالي فرعي',
            type: 'cash',
            balance: parseFloat(diff.toFixed(4)),
            ownerId: profile.ownerId,
            createdAt: serverTimestamp()
          }, { merge: true });
        }

        // 3. Post to primary accounting Ledger list as a journal entry
        const journalRef = doc(collection(db, 'journalEntries'));
        const debtAccName = transType === 'income' ? (boxId === 'CASH_BOX' ? 'الصندوق العام للمحل' : 'الحساب المصرفي المستهدف') : databaseCategory;
        const credAccName = transType === 'income' ? databaseCategory : (boxId === 'CASH_BOX' ? 'الصندوق العام للمحل' : 'الحساب المصرفي المستهدف');
        
        transaction.set(journalRef, {
          ownerId: profile.ownerId,
          description: `جام برو المحاسبي - مرجع [${databaseCategory}]: ${finalDescription}`,
          date: serverTimestamp(),
          referenceId: transColRef.id,
          type: transType.toUpperCase(),
          items: [
            {
              accountName: debtAccName,
              debit: amountNum,
              credit: 0,
              currency: 'YER',
              exchangeRate: 1,
              baseAmount: amountNum
            },
            {
              accountName: credAccName,
              debit: 0,
              credit: amountNum,
              currency: 'YER',
              exchangeRate: 1,
              baseAmount: amountNum
            }
          ]
        });
      });

      alert(`✓ تم تسجيل حركة [${databaseCategory}] بقيمة ${amountNum.toLocaleString()} ر.ي بنجاح وتحديث أرصدة الخزائن تلقائياً!`);
      setSelectedCardForm(null);
    } catch (error: any) {
      console.error("Error committing accounting move:", error);
      alert(`فشل إدخال البيانات في الخادم: ${error.message || error}`);
    } finally {
      setSubmittedLoading(false);
    }
  };

  const combinedBoxesForSelect = [
    ...bankAccounts.map(b => ({
      id: b.id,
      name: b.bankName || b.boxName || 'حساب مالي عام',
      balance: b.balance,
      currency: b.currency
    })),
    ...customBoxes.map(c => ({
      id: c.id,
      name: c.boxName,
      balance: c.balance,
      currency: c.currency || 'YER'
    }))
  ];

  return (
    <div className={`space-y-6 animate-fade-in p-4 rounded-3xl min-h-screen transition-colors ${profile?.visualTheme === 'light' ? 'light-accounting' : ''}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-navy-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-navy-700">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-navy-700 rounded-2xl flex items-center justify-center text-brand-primary shadow-lg">
            <Book size={24} />
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-black text-navy-900 dark:text-white">النظام المحاسبي الذكي</h1>
            <p className="text-navy-950 dark:text-brand-primary font-black">JAM System Pro - المحاسبة المبسطة</p>
          </div>
        </div>

        <div className="flex bg-gray-100 dark:bg-navy-900 p-1 rounded-2xl flex-wrap gap-1 items-center">
          <button 
            type="button"
            id="open-smart-ai-accountant-btn"
            onClick={() => setIsAIAccountantOpen(true)}
            className="px-4 py-2 rounded-xl font-black transition-all flex items-center gap-2 bg-gradient-to-r from-brand-primary to-cyan-500 text-white shadow-md shadow-brand-primary/30 hover:scale-105 active:scale-95 animate-pulse"
          >
            <Bot size={18} />
            <span>المحاسب الذكي</span>
          </button>
          <button 
            onClick={() => setActiveTab('quick_accounting')}
            className={`px-4 py-2 rounded-xl font-black transition-all flex items-center gap-2 ${activeTab === 'quick_accounting' ? 'bg-[#3498db] text-white shadow-sm' : 'text-gray-500 hover:text-navy-700 dark:hover:text-white'}`}
          >
            <Activity size={18} />
            الدخل والجرد اليومي
          </button>
          <button 
            onClick={() => setActiveTab('rollback')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'rollback' ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-navy-700'}`}
          >
            <Undo size={18} />
            عكس القيود وإلغاء الفواتير
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'reports' ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-navy-700'}`}
          >
            <PieChart size={18} />
            التقارير
          </button>
          <button 
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'ledger' ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-navy-700'}`}
          >
            <ArrowLeftRight size={18} />
            الأستاذ العام
          </button>
          <button 
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'accounts' ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-navy-700'}`}
          >
            <List size={18} />
            دليل الحسابات
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'quick_accounting' && (
          <motion.div
            key="quick_accounting"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-4"
          >
            <QuickAccountingDashboard 
              profile={profile}
              combinedBoxesForSelect={combinedBoxesForSelect}
              inventoryItems={inventoryItems}
            />
          </motion.div>
        )}

        {activeTab === 'accounts' && (
          <motion.div 
            key="accounts"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text"
                  placeholder="بحث عن حساب (اسم أو رقم)..."
                  className="input-field pr-12 text-right"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="btn-primary flex items-center gap-2 px-6">
                <Plus size={20} />
                إضافة حساب جديد
              </button>
            </div>

            <div className="bg-white dark:bg-navy-800 rounded-3xl shadow-sm border border-gray-100 dark:border-navy-700 overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-gray-50 dark:bg-navy-900/50">
                  <tr>
                    <th className="px-6 py-4 font-black text-navy-900 dark:text-white">رقم الحساب</th>
                    <th className="px-6 py-4 font-black text-navy-900 dark:text-white">اسم الحساب</th>
                    <th className="px-6 py-4 font-black text-navy-900 dark:text-white">النوع</th>
                    <th className="px-6 py-4 font-black text-navy-900 dark:text-white">العملة</th>
                    <th className="px-6 py-4 font-black text-navy-900 dark:text-white">الرصيد الحالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-navy-700" />
                      </td>
                    </tr>
                  ) : filteredAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-navy-700 dark:text-brand-primary">{acc.accountNumber}</td>
                      <td className="px-6 py-4 font-bold">{acc.accountName}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          acc.type === 'asset' ? 'bg-blue-100 text-blue-700' :
                          acc.type === 'liability' ? 'bg-orange-100 text-orange-700' :
                          acc.type === 'revenue' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {acc.type === 'asset' ? 'أصل' :
                           acc.type === 'liability' ? 'خصم' :
                           acc.type === 'revenue' ? 'إيراد' :
                           acc.type === 'expense' ? 'مصروف' : 'حقوق ملكية'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold">{acc.currency}</td>
                      <td className={`px-6 py-4 font-black ${acc.balance >= 0 ? 'text-success' : 'text-danger'}`}>
                        {acc.balance.toLocaleString()} {acc.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'ledger' && (
          <motion.div 
            key="ledger"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="bg-white dark:bg-navy-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-navy-700">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar size={20} className="text-gray-400" />
                  <input 
                    type="date" 
                    className="input-field py-2"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  />
                  <span className="text-gray-400">إلى</span>
                  <input 
                    type="date" 
                    className="input-field py-2"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {entries.map((entry) => (
                <div key={entry.id} className="bg-white dark:bg-navy-800 rounded-3xl shadow-sm border border-gray-100 dark:border-navy-700 overflow-hidden">
                  <div className="bg-gray-50 dark:bg-navy-900/50 px-6 py-3 flex items-center justify-between border-b border-gray-100 dark:border-navy-700">
                    <div className="flex items-center gap-4">
                      <span className="font-black text-navy-900 dark:text-white">قيد رقم: {entry.id.slice(-6).toUpperCase()}</span>
                      <span className="text-gray-500 text-sm font-bold">
                        {entry.date instanceof Timestamp ? format(entry.date.toDate(), 'PPP', { locale: ar }) : '...'}
                      </span>
                    </div>
                    <span className="text-navy-700 dark:text-brand-primary font-bold">{entry.description}</span>
                  </div>
                  <table className="w-full text-right">
                  <thead className="text-xs text-navy-950 dark:text-white uppercase font-black">
                    <tr>
                      <th className="px-6 py-3">الحساب</th>
                      <th className="px-6 py-3">مدين</th>
                      <th className="px-6 py-3">دائن</th>
                      <th className="px-6 py-3">العملة</th>
                      <th className="px-6 py-3">سعر الصرف</th>
                      <th className="px-6 py-3">المعادل (يمني)</th>
                    </tr>
                  </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-navy-700/50">
                      {entry.items.map((item, idx) => (
                        <tr key={`entry-item-${idx}`}>
                          <td className="px-6 py-3 font-bold">{item.accountName}</td>
                          <td className="px-6 py-3 text-success font-black">{item.debit > 0 ? item.debit.toLocaleString() : ''}</td>
                          <td className="px-6 py-3 text-danger font-black">{item.credit > 0 ? item.credit.toLocaleString() : ''}</td>
                          <td className="px-6 py-3 text-gray-500 font-bold">{item.currency}</td>
                          <td className="px-6 py-3 text-gray-400 text-xs">{item.exchangeRate}</td>
                          <td className="px-6 py-3 font-mono text-navy-700 dark:text-white">{item.baseAmount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'rollback' && (
          <motion.div 
            key="rollback"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Header Description */}
            <div className="bg-navy-900 text-white p-6 rounded-3xl relative overflow-hidden shadow-xl">
              <div className="relative z-10 space-y-2">
                <span className="bg-brand-primary/20 text-brand-primary px-3 py-1 rounded-full text-[10px] font-black uppercase">
                  تأمين القيود التزامنية
                </span>
                <h3 className="text-xl font-black">نظام التراجع التزامني وإلغاء فواتير المبيعات وعكس الحركات</h3>
                <p className="text-xs opacity-75 max-w-2xl leading-relaxed">
                  يتيح لك هذا المعالج المتطور إلغاء أو تعديل الفواتير وعكس القيود المالية وسحب الأرصدة وإرجاع كميات الأصناف لمخازنها الأصلية دفعة واحدة تزامناً دون تصفير الحالات لمنع العبث المالي.
                </p>
              </div>
              <div className="absolute right-0 bottom-0 translate-y-1/3 translate-x-1/4 w-60 h-60 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Input Section */}
              <div className="lg:col-span-5 bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-navy-700 space-y-6 shadow-sm">
                <div className="flex items-center gap-3 border-b border-gray-100 dark:border-navy-700 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                    <Undo size={16} />
                  </div>
                  <h4 className="font-black text-navy-900 dark:text-white text-sm">تفاصيل قيد التراجع والعكس</h4>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-400">رقم الفاتورة أو رمز المعاملة (Invoice/Sale ID)</label>
                    <input 
                      required
                      type="text" 
                      placeholder="مثال: SL-103945"
                      className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-navy-800 outline-none text-xs font-bold text-navy-900 dark:text-white font-mono"
                      value={rollbackForm.invoiceId}
                      onChange={(e) => setRollbackForm({...rollbackForm, invoiceId: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400">الصندوق المستهدف بالخصم</label>
                      <select 
                        required
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-navy-800 outline-none text-xs font-bold cursor-pointer text-navy-900 dark:text-white font-sans"
                        value={rollbackForm.boxId}
                        onChange={(e) => setRollbackForm({...rollbackForm, boxId: e.target.value})}
                      >
                        <option value="CASH_BOX">الصندوق العام للمحل</option>
                        {combinedBoxesForSelect.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} [الرصيد: {b.balance?.toLocaleString() || 0} {b.currency}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400">المبلغ المراد سحبه/عكسه (ر.ي)</label>
                      <input 
                        required
                        type="number" 
                        placeholder="0.00"
                        className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-navy-800 outline-none text-xs font-black text-navy-900 dark:text-white"
                        value={rollbackForm.amount}
                        onChange={(e) => setRollbackForm({...rollbackForm, amount: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Add returning products */}
                  <div className="border border-dashed border-gray-200 dark:border-navy-700/50 p-4 rounded-2xl bg-gray-50/50 dark:bg-navy-900/20 space-y-3">
                    <span className="text-[11px] font-black text-navy-900 dark:text-brand-primary block">
                      إضافة المنتجات المسترجعة للتعديل/الرد التلقائي:
                    </span>

                    <div className="space-y-3">
                      <div className="space-y-1 bg-white dark:bg-navy-800 p-2 rounded-xl">
                        <label className="text-[10px] text-gray-400 font-bold block">اختر الصنف من المخزن المحلي</label>
                        <select 
                          className="w-full bg-transparent outline-none text-xs font-bold text-navy-950 dark:text-white cursor-pointer"
                          value={newItemToReturn.productId}
                          onChange={(e) => setNewItemToReturn({...newItemToReturn, productId: e.target.value})}
                        >
                          <option value="">-- اضغط للاختيار --</option>
                          {inventoryItems.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} [الجرد الحالي: {item.stock || 0} {item.unit || 'قطعة'}]
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 bg-white dark:bg-navy-800 p-2 rounded-xl">
                          <label className="text-[10px] text-gray-400 font-bold block">الكمية المسترجعة</label>
                          <input 
                            type="number" 
                            placeholder="0"
                            className="w-full bg-transparent outline-none text-xs font-bold text-navy-950 dark:text-white"
                            value={newItemToReturn.quantity}
                            onChange={(e) => setNewItemToReturn({...newItemToReturn, quantity: e.target.value})}
                          />
                        </div>

                        <div className="space-y-1 bg-white dark:bg-navy-800 p-2 rounded-xl">
                          <label className="text-[10px] text-gray-400 font-bold block">المخزن/الفرع الهدف</label>
                          <select 
                            className="w-full bg-transparent outline-none text-xs font-bold text-navy-950 dark:text-white cursor-pointer"
                            value={newItemToReturn.warehouseId}
                            onChange={(e) => setNewItemToReturn({...newItemToReturn, warehouseId: e.target.value})}
                          >
                            <option value="المحل">المستودع الرئيسي (المحل)</option>
                            <option value="المخزن 1">المخزن التجاري 1</option>
                            <option value="المخزن 2">المستودع الجمركي 2</option>
                            <option value="صنعاء">فرع صنعاء</option>
                          </select>
                        </div>
                      </div>

                      <button 
                        type="button"
                        onClick={() => {
                          if (!newItemToReturn.productId || !newItemToReturn.quantity) {
                            alert('الرجاء اختيار المنتج والكمية لإضافته للائحة الرد!');
                            return;
                          }
                          const qty = Number(newItemToReturn.quantity) || 0;
                          if (qty <= 0) {
                            alert('الرجاء كتابة كمية صحيحة أكبر من الصفر');
                            return;
                          }
                          setRollbackForm({
                            ...rollbackForm,
                            items: [
                              ...rollbackForm.items,
                              {
                                productId: newItemToReturn.productId,
                                quantity: qty,
                                warehouseId: newItemToReturn.warehouseId
                              }
                            ]
                          });
                          setNewItemToReturn({
                            productId: '',
                            warehouseId: 'المحل',
                            quantity: ''
                          });
                        }}
                        className="w-full py-2 bg-navy-800 hover:bg-navy-900 border border-gray-200 dark:border-navy-700 text-white dark:text-brand-primary font-black rounded-lg text-[10px] flex items-center justify-center gap-2"
                      >
                        <Plus size={14} />
                        تأكيد وإضافة الصنف للائحة
                      </button>
                    </div>
                  </div>

                  <button 
                    type="button"
                    disabled={loadingRollback}
                    onClick={async () => {
                      if (!rollbackForm.invoiceId) {
                        alert('يرجى تحديد رقم الفاتورة للبدء!');
                        return;
                      }
                      if (!profile?.ownerId) return;

                      if (window.confirm('🚨 هل أنت متأكد من تنفيذ قيد العكس وعكس القيود التزامنية ماليّاً ومخزنيّاً لهذه الفاتورة؟ سيتم تحديث أرصدة الخزينة والمنتجات فورياً.')) {
                        setLoadingRollback(true);
                        const payload = {
                          itemsToReturn: rollbackForm.items,
                          moneyToWithdraw: {
                            boxId: rollbackForm.boxId,
                            amount: Number(rollbackForm.amount) || 0
                          }
                        };
                        const res = await handleInvoiceRollbackAndSync(
                          rollbackForm.invoiceId,
                          profile.ownerId,
                          payload,
                          () => {
                            console.log('Sync complete');
                          }
                        );

                        if (res.success) {
                          alert(res.message);
                          setRollbackForm({
                            invoiceId: '',
                            boxId: 'CASH_BOX',
                            amount: '',
                            items: []
                          });
                        } else {
                          alert(`فشل العكس: ${res.error}`);
                        }
                        setLoadingRollback(false);
                      }
                    }}
                    className="w-full py-4 rounded-xl bg-danger hover:scale-[1.01] text-white font-extrabold text-xs transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {loadingRollback ? (
                      <>
                        <RefreshCcw className="animate-spin" size={16} />
                        جاري تهيئة البيانات وقفل الحركات...
                      </>
                    ) : (
                      <>
                        <Undo size={16} />
                        تنفيذ إلغاء الفاتورة وعكس القيود كليّاً
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Items returning list & Recent Journal Entries */}
              <div className="lg:col-span-7 space-y-6">
                {/* Rollback queue */}
                <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-navy-700 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-extrabold text-xs text-navy-950 dark:text-white">لائحة الأصناف المستهدفة بالإرجاع المالي والمخزني ({rollbackForm.items.length})</h4>
                    {rollbackForm.items.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setRollbackForm({...rollbackForm, items: []})}
                        className="text-[10px] text-danger font-black hover:underline"
                      >
                        مسح القائمة
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {rollbackForm.items.map((it, index) => {
                      const prod = inventoryItems.find(p => p.id === it.productId);
                      return (
                        <div key={index} className="flex justify-between items-center bg-gray-50 dark:bg-navy-900/50 p-3 rounded-xl border border-gray-100 dark:border-navy-800">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] bg-red-100 text-red-700 font-extrabold w-5 h-5 rounded-full flex items-center justify-center">{index + 1}</span>
                            <div className="text-right">
                              <p className="text-xs font-black text-navy-950 dark:text-white">{prod?.name || 'صنف غير معرف ID'}</p>
                              <p className="text-[9px] text-gray-400">كود: <span className="font-mono">{it.productId}</span></p>
                            </div>
                          </div>

                          <div className="text-left font-sans text-xs">
                            <span className="font-black text-navy-950 dark:text-white">+{it.quantity}</span> <span className="text-gray-400 font-bold text-[10px]">({it.warehouseId})</span>
                          </div>
                        </div>
                      );
                    })}

                    {rollbackForm.items.length === 0 && (
                      <div className="text-center py-6 text-gray-400 text-xs font-bold italic">
                        لا يوجد أي صنف مضاف لقائمة الإرجاع حتى الآن.
                      </div>
                    )}
                  </div>
                </div>

                {/* Intelligent prefill selector list */}
                <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-navy-700 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 dark:border-navy-700 pb-3">
                    <h4 className="font-black text-xs text-navy-950 dark:text-white flex items-center gap-2">
                      <AlertCircle className="text-brand-primary" size={16} />
                      تعبئة تلقائية ذكية من الحركات الأخيرة
                    </h4>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto space-y-2 divide-y divide-gray-100 dark:divide-navy-700 font-sans">
                    {entries.slice(0, 10).map((entry) => {
                      const entryRefId = entry.referenceId || entry.id;
                      // Estimate a total debit/credit pattern
                      const totalEntryAmount = entry.items.find(it => it.debit > 0)?.debit || 0;
                      return (
                        <div key={entry.id} className="pt-2 flex items-center justify-between text-xs">
                          <div className="text-right">
                            <p className="font-black text-navy-950 dark:text-white">{entry.description}</p>
                            <p className="text-[9px] text-gray-400 font-bold">القيد: <span className="font-mono">{entry.id.slice(-6).toUpperCase()}</span> • المرجع: {entryRefId.slice(-10)}</p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-black text-brand-primary">{totalEntryAmount.toLocaleString()} YER</span>
                            <button
                              type="button"
                              onClick={() => {
                                setRollbackForm({
                                  invoiceId: entryRefId,
                                  boxId: 'CASH_BOX',
                                  amount: String(totalEntryAmount),
                                  items: []
                                });
                                alert(`✓ تم تحميل معلومات القيد ${entry.id.slice(-6).toUpperCase()} في قالب العكس التلقائي!`);
                              }}
                              className="px-2 py-1.5 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white rounded-lg font-black text-[10px] transition-colors"
                            >
                              اختيار للرد
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {entries.length === 0 && (
                      <div className="text-center py-8 text-gray-400 font-bold text-xs italic">
                        لا يوجد قيود محاسبية مسجلة لاستخراج القوالب.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div 
            key="reports"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* P&L Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-navy-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-navy-700 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                <div className="relative flex items-center justify-between">
                  <div className="text-right">
                    <p className="text-navy-950 dark:text-white font-black mb-1">إجمالي الإيرادات</p>
                    <h3 className="text-4xl font-black text-success">
                      {pnL?.totalRevenue.toLocaleString() || 0}
                      <span className="text-sm mr-2 font-black">ريال</span>
                    </h3>
                  </div>
                  <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center text-success">
                    <TrendingUp size={28} strokeWidth={3} />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-navy-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-navy-700 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-danger/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                <div className="relative flex items-center justify-between">
                  <div className="text-right">
                    <p className="text-navy-950 dark:text-white font-black mb-1">إجمالي المصروفات</p>
                    <h3 className="text-4xl font-black text-danger">
                      {pnL?.totalExpenses.toLocaleString() || 0}
                      <span className="text-sm mr-2 font-black">ريال</span>
                    </h3>
                  </div>
                  <div className="w-14 h-14 bg-danger/10 rounded-2xl flex items-center justify-center text-danger">
                    <TrendingDown size={28} strokeWidth={3} />
                  </div>
                </div>
              </div>

              <div className="bg-navy-700 p-8 rounded-[2rem] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                <div className="relative flex items-center justify-between">
                  <div className="text-right">
                    <p className="text-white/60 font-bold mb-1">صافي الربح</p>
                    <h3 className="text-3xl font-black text-brand-primary">
                      {pnL?.netProfit.toLocaleString() || 0}
                      <span className="text-sm mr-2">ريال</span>
                    </h3>
                  </div>
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-brand-primary">
                    <DollarSign size={28} />
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed P&L Table */}
            <div className="bg-white dark:bg-navy-800 rounded-3xl shadow-sm border border-gray-100 dark:border-navy-700 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-navy-700">
                <h3 className="text-xl font-black text-navy-900 dark:text-white">تقرير الأرباح والخسائر التفصيلي</h3>
              </div>
              <div className="p-6 space-y-8">
                {/* Revenues Section */}
                <div className="space-y-4">
                  <h4 className="font-black text-success flex items-center gap-2">
                    <TrendingUp size={18} />
                    الإيرادات
                  </h4>
                  <div className="space-y-2">
                    {accounts.filter(a => a.type === 'revenue').map(acc => (
                      <div key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-navy-900/30 rounded-xl">
                        <span className="font-bold">{acc.accountName}</span>
                        <span className="font-black text-navy-700 dark:text-white">{acc.balance.toLocaleString()} ريال</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expenses Section */}
                <div className="space-y-4">
                  <h4 className="font-black text-danger flex items-center gap-2">
                    <TrendingDown size={18} />
                    المصروفات
                  </h4>
                  <div className="space-y-2">
                    {accounts.filter(a => a.type === 'expense').map(acc => (
                      <div key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-navy-900/30 rounded-xl">
                        <span className="font-bold">{acc.accountName}</span>
                        <span className="font-black text-navy-700 dark:text-white">{acc.balance.toLocaleString()} ريال</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary Footer */}
                <div className="pt-6 border-t border-gray-100 dark:border-navy-700 flex justify-between items-center">
                  <span className="text-xl font-black text-navy-900 dark:text-white">صافي الربح النهائي</span>
                  <span className={`text-3xl font-black ${pnL && pnL.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                    {pnL?.netProfit.toLocaleString() || 0} ريال
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart AI Accountant Drawer */}
      <AnimatePresence>
        {isAIAccountantOpen && (
          <SmartAIAccountantModal
            isOpen={isAIAccountantOpen}
            onClose={() => setIsAIAccountantOpen(false)}
            profile={profile}
            onEntryPosted={() => {
              // Trigger any refresh if needed
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
