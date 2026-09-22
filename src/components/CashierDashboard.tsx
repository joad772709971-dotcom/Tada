import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Search, 
  PiggyBank, 
  Key, 
  Coins, 
  ArrowRightLeft, 
  HelpCircle,
  Hash,
  User,
  RefreshCw,
  MapPin,
  FileSpreadsheet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  Printer,
  FileText,
  Filter,
  Layers,
  Sparkles,
  Receipt,
  Building,
  Check
} from 'lucide-react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, getDocs, addDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { DecimalPrecisionService } from '../services/decimalPrecisionService';
import { DesktopStandaloneWrapper } from '../services/DesktopStandaloneWrapper';

interface CashierDashboardProps {
  profile: UserProfile | null;
}

export default function CashierDashboard({ profile }: CashierDashboardProps) {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [customBoxes, setCustomBoxes] = useState<any[]>([]);
  const [pendingRemittances, setPendingRemittances] = useState<any[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBoxIds, setSelectedBoxIds] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalPending: 0, countPending: 0 });
  const [tab, setTab] = useState<'pending' | 'verified' | 'exchangers' | 'currency_diff'>('pending');
  const [filterType, setFilterType] = useState<'all' | 'orders' | 'transfers'>('all');
  
  // Modal states for Cashier Operations
  const [showDirectDepositModal, setShowDirectDepositModal] = useState(false);
  const [showShiftCloseModal, setShowShiftCloseModal] = useState(false);
  const [showExchangeTransferModal, setShowExchangeTransferModal] = useState(false);
  
  // Direct Deposit Form
  const [depositForm, setDepositForm] = useState({
    senderName: '',
    amount: '',
    boxId: '',
    exchangerName: 'شركة الكريمي للصرافة',
    remittanceNumber: '',
    notes: ''
  });

  // Transfer Between Boxes Form
  const [transferForm, setTransferForm] = useState({
    fromBoxId: '',
    toBoxId: '',
    amount: '',
    notes: ''
  });

  useEffect(() => {
    if (!profile?.ownerId) return;

    // 1. Fetch bank/cashier boxes belonging to this store
    const qBoxes = query(collection(db, 'bank_accounts'), where('ownerId', '==', profile.ownerId));
    const unsubBoxes = onSnapshot(qBoxes, (snap) => {
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (profile.role !== 'owner' && profile.role !== 'superadmin' && profile.shopId) {
        docs = docs.filter((d: any) => d.shopId === profile.shopId || d.storeId === profile.shopId || d.store_id === profile.shopId);
      }
      setBankAccounts(docs);
    });

    const unsubCustom = onSnapshot(
      collection(db, 'stores', profile.ownerId, 'customBoxes'),
      (snap) => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (profile.role !== 'owner' && profile.role !== 'superadmin' && profile.shopId) {
          docs = docs.filter((d: any) => d.shopId === profile.shopId || d.storeId === profile.shopId || d.store_id === profile.shopId);
        }
        setCustomBoxes(docs);
      }
    );

    // 2. Fetch pending orders with remittances that aren't verified yet
    const qOrders = query(
      collection(db, 'orders'),
      where('wholesalerId', '==', profile.ownerId)
    );

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      let allOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (profile.role !== 'owner' && profile.role !== 'superadmin' && profile.shopId) {
        allOrders = allOrders.filter((o: any) => o.shopId === profile.shopId || o.storeId === profile.shopId || o.store_id === profile.shopId);
      }
      const unverified = allOrders.filter(o => {
        const hasPaymentInfo = o.paymentDetails?.remittanceNumber || o.paymentType === 'cash';
        return hasPaymentInfo;
      });
      setPendingRemittances(unverified);
    });

    // 3. Fetch moneyTransfers (Remittances and Bank Transfers)
    const qTransfers = query(
      collection(db, 'moneyTransfers'),
      where('ownerId', '==', profile.ownerId)
    );

    const unsubTransfers = onSnapshot(qTransfers, (snap) => {
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (profile.role !== 'owner' && profile.role !== 'superadmin' && profile.shopId) {
        docs = docs.filter((d: any) => d.shopId === profile.shopId || d.storeId === profile.shopId || d.store_id === profile.shopId);
      }
      setPendingTransfers(docs);
    });

    return () => {
      unsubBoxes();
      unsubCustom();
      unsubOrders();
      unsubTransfers();
    };
  }, [profile]);

  // Combine orders and bank transfers into a single list
  const combinedList = [
    ...pendingRemittances.map(o => ({
      ...o,
      isOrder: true,
      amount: o.paymentDetails?.amountPaid || o.total || 0,
      senderName: o.retailerName || 'عميل مبيعات المعرض',
      remittanceNumber: o.paymentDetails?.remittanceNumber || 'كاش يدوي',
      isVerified: o.paymentVerified === true,
      displayType: 'طلب مبيعات شبكة / عميل',
      createdAt: o.createdAt
    })),
    ...pendingTransfers.map(tr => ({
      ...tr,
      isTransfer: true,
      amount: tr.amount,
      senderName: tr.senderName || 'حوالة واردة',
      remittanceNumber: tr.id,
      isVerified: tr.status === 'received',
      displayType: tr.notes?.includes('شراء') ? 'مشتريات سوق' : (tr.notes?.includes('مبيعات') ? 'مبيعات معرض' : 'حوالة مستندات'),
      createdAt: tr.createdAt
    }))
  ];

  // Dynamically compute stats from combined list
  useEffect(() => {
    const pendingItems = combinedList.filter(item => !item.isVerified);
    const total = pendingItems.reduce((acc, cur) => DecimalPrecisionService.add(acc, cur.amount || 0), 0);
    setStats({
      totalPending: total,
      countPending: pendingItems.length
    });
  }, [pendingRemittances, pendingTransfers]);

  const handleRouteAndVerify = async (item: any, overrideBoxId?: string) => {
    const boxId = overrideBoxId || selectedBoxIds[item.id];
    if (!boxId) {
      alert('يرجى اختيار الصندوق المراد توجيه المبلغ له أولاً (مثلاً: الكريمي، النجم، أو كاش المحل)');
      return;
    }

    try {
      setIsSubmitting(item.id);
      const batch = writeBatch(db);

      const amountToDeposit = Number(item.amount || 0);

      // Fetch the selected cash box / wallet
      const boxRef = doc(db, 'bank_accounts', boxId);
      const customRef = doc(db, 'stores', profile?.ownerId, 'customBoxes', boxId);
      const boxSnap = await getDoc(boxRef);
      const customSnap = await getDoc(customRef);

      let boxName = '';

      if (boxSnap.exists()) {
        const currentBalance = Number(boxSnap.data().balance || 0);
        boxName = boxSnap.data().boxName || boxSnap.data().bankName || 'صندوق كاش';
        batch.update(boxRef, {
          balance: DecimalPrecisionService.add(currentBalance, amountToDeposit),
          updatedAt: serverTimestamp()
        });
      } else if (customSnap.exists()) {
        const currentBalance = Number(customSnap.data().balance || 0);
        boxName = customSnap.data().boxName;
        batch.update(customRef, {
          balance: DecimalPrecisionService.add(currentBalance, amountToDeposit)
        });

        // Sync linked bank account if applicable
        const customData = customSnap.data();
        if (customData.isLinkedToBank && customData.bankAccountId) {
          const linkedBankRef = doc(db, 'bank_accounts', customData.bankAccountId);
          const linkedBankSnap = await getDoc(linkedBankRef);
          if (linkedBankSnap.exists()) {
            const currentBankBal = Number(linkedBankSnap.data().balance || 0);
            batch.update(linkedBankRef, {
              balance: DecimalPrecisionService.add(currentBankBal, amountToDeposit),
              updatedAt: serverTimestamp()
            });
          }
        }
      } else {
        alert('حساب الصندوق المختار غير موجود.');
        setIsSubmitting(null);
        return;
      }

      if (item.isTransfer) {
        // Create actual income transaction first so we can save its ID in the transfer
        const transRef = doc(collection(db, 'transactions'));
        batch.set(transRef, {
          ownerId: profile?.ownerId,
          shopId: profile?.shopId || '',
          amount: amountToDeposit,
          type: 'income',
          boxId: boxId,
          boxName: boxName,
          category: 'حوالة مستلمة وصندوق',
          description: `تأكيد استلام حوالة (${item.id.slice(-4)}) من ${item.senderName}. المسار: ${boxName}. المصادقة عبر الصراف.`,
          createdAt: serverTimestamp()
        });

        // Update MoneyTransfer document
        const transferRef = doc(db, 'moneyTransfers', item.id);
        batch.update(transferRef, {
          status: 'received',
          receivedBy: profile?.uid || 'cashier',
          receivedByName: profile?.name || 'صراف الصندوق',
          receivedAt: serverTimestamp(),
          destinationType: 'BANK_ACCOUNT',
          destinationBoxId: boxId,
          recipientDetails: `توجيه وقبض عبر الصراف إلى: ${boxName}`,
          transactionId: transRef.id,
          updatedAt: serverTimestamp()
        });

        // Immutable log to auditLogs
        const auditRef = doc(collection(db, 'auditLogs'));
        batch.set(auditRef, {
          userId: profile?.uid || 'cashier',
          userName: profile?.name || 'صراف الصندوق',
          action: 'CONFIRM_REMITTANCE_RECEIPT_ROUTED',
          targetAccount: boxId,
          exactAmount: amountToDeposit,
          details: `تأكيد استلام حوالة رقم ${item.id.slice(-4)} بقيمة ${amountToDeposit} ر.ي وتوجيهها بمسار صندوق (${boxName})`,
          ownerId: profile?.ownerId,
          shopId: profile?.shopId || '',
          timestamp: serverTimestamp()
        });
      } else {
        // Update Order to verify payment
        const orderRef = doc(db, 'orders', item.id);
        batch.update(orderRef, {
          paymentVerified: true,
          paymentVerifiedAt: serverTimestamp(),
          paymentVerifiedBy: profile?.name || 'صراف الصندوق',
          remittanceRoutingBoxId: boxId,
          remittanceRoutingBoxName: boxName,
          remittanceRoutingType: 'CASHIER_VERIFIED',
          updatedAt: serverTimestamp()
        });

        // Create a ledger in Transactions
        const transRef = doc(collection(db, 'transactions'));
        batch.set(transRef, {
          ownerId: profile?.ownerId,
          shopId: profile?.shopId || '',
          amount: amountToDeposit,
          type: 'income',
          boxId: boxId,
          boxName: boxName,
          category: 'حوالات مستلمة وصندوق',
          description: `تأكيد وصول حوالة للطلب #${item.id.slice(-6)} رقم الحوالة: ${item.paymentDetails?.remittanceNumber || 'N/A'}. المصادقة عبر عامل صندوق المحل.`,
          createdAt: serverTimestamp()
        });
      }

      // Commit batch
      await batch.commit();

      // Clear selection
      setSelectedBoxIds(prev => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });

      alert(`تم بنجاح ربط الحوالة بقيمة ${amountToDeposit.toLocaleString()} ر.ي بمسار صندوق (${boxName}) وتأكيدها مالياً!`);
    } catch (e: any) {
      console.error(e);
      alert('حدث خطأ أثناء فك الحوالة وتأكيد الصندوق: ' + e.message);
    } finally {
      setIsSubmitting(null);
    }
  };

  // Submit Direct Manual Remittance / Cash Deposit
  const handleSaveDirectDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    if (!depositForm.amount || !depositForm.boxId) {
      alert('يرجى ملء المبلغ واختيار الصندوق المستهدف.');
      return;
    }

    try {
      setIsSubmitting('direct_deposit');
      const amountNum = Number(depositForm.amount);
      const batch = writeBatch(db);

      // Fetch box
      const boxRef = doc(db, 'bank_accounts', depositForm.boxId);
      const boxSnap = await getDoc(boxRef);
      let boxName = 'الصندوق';

      if (boxSnap.exists()) {
        boxName = boxSnap.data().boxName || boxSnap.data().bankName || 'صندوق كاش';
        batch.update(boxRef, {
          balance: DecimalPrecisionService.add(Number(boxSnap.data().balance || 0), amountNum),
          updatedAt: serverTimestamp()
        });
      }

      // Create Transaction
      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        ownerId: profile.ownerId,
        shopId: profile.shopId || '',
        amount: amountNum,
        type: 'income',
        boxId: depositForm.boxId,
        boxName: boxName,
        category: 'تسوية صرافة يدوية',
        description: `إيداع تسوية صرافة عبر (${depositForm.exchangerName}) رقم: ${depositForm.remittanceNumber || 'بدون'} من: ${depositForm.senderName || 'مباشر'}. ${depositForm.notes}`,
        createdAt: serverTimestamp()
      });

      // Record in MoneyTransfers as received
      const transferRef = doc(collection(db, 'moneyTransfers'));
      batch.set(transferRef, {
        ownerId: profile.ownerId,
        shopId: profile.shopId || '',
        amount: amountNum,
        senderName: depositForm.senderName || 'عميل / شبكة صرافة',
        remittanceNumber: depositForm.remittanceNumber || '',
        exchangerName: depositForm.exchangerName,
        status: 'received',
        receivedBy: profile.uid || 'cashier',
        receivedByName: profile.name || 'صراف الصندوق',
        receivedAt: serverTimestamp(),
        destinationType: 'BANK_ACCOUNT',
        destinationBoxId: depositForm.boxId,
        recipientDetails: `إيداع تسوية وقبض مباشر في: ${boxName}`,
        notes: depositForm.notes,
        createdAt: serverTimestamp()
      });

      await batch.commit();

      alert(`✅ تم قيد وتسوية الحوالة بقيمة ${amountNum.toLocaleString()} ر.ي في صندوق (${boxName}) بنجاح!`);
      setShowDirectDepositModal(false);
      setDepositForm({ senderName: '', amount: '', boxId: '', exchangerName: 'شركة الكريمي للصرافة', remittanceNumber: '', notes: '' });
    } catch (err: any) {
      console.error(err);
      alert('خطأ في إتمام التسوية: ' + err.message);
    } finally {
      setIsSubmitting(null);
    }
  };

  // Submit Box to Box Inter-Transfer
  const handleSaveBoxTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    if (!transferForm.fromBoxId || !transferForm.toBoxId || !transferForm.amount) {
      alert('يرجى تحديد الصندوق المحول منه والصندوق المحول إليه والمبلغ.');
      return;
    }
    if (transferForm.fromBoxId === transferForm.toBoxId) {
      alert('لا يمكن التحويل لنفس الصندوق.');
      return;
    }

    try {
      setIsSubmitting('box_transfer');
      const amountNum = Number(transferForm.amount);
      const batch = writeBatch(db);

      const fromRef = doc(db, 'bank_accounts', transferForm.fromBoxId);
      const toRef = doc(db, 'bank_accounts', transferForm.toBoxId);
      const fromSnap = await getDoc(fromRef);
      const toSnap = await getDoc(toRef);

      if (!fromSnap.exists() || !toSnap.exists()) {
        alert('أحد الصناديق غير موجود.');
        return;
      }

      const fromBal = Number(fromSnap.data().balance || 0);
      const toBal = Number(toSnap.data().balance || 0);
      const fromName = fromSnap.data().boxName || fromSnap.data().bankName || 'صندوق';
      const toName = toSnap.data().boxName || toSnap.data().bankName || 'صندوق';

      if (fromBal < amountNum) {
        if (!confirm(`رصيد الصندوق (${fromName}) الحالي هو ${fromBal.toLocaleString()} ر.ي وهو أقل من المبلغ المراد تحويله. هل ترغب بمتابعة التحويل بالسالب؟`)) {
          return;
        }
      }

      batch.update(fromRef, {
        balance: DecimalPrecisionService.sub(fromBal, amountNum),
        updatedAt: serverTimestamp()
      });

      batch.update(toRef, {
        balance: DecimalPrecisionService.add(toBal, amountNum),
        updatedAt: serverTimestamp()
      });

      // Transfer Log
      const transLogRef = doc(collection(db, 'transactions'));
      batch.set(transLogRef, {
        ownerId: profile.ownerId,
        shopId: profile.shopId || '',
        amount: amountNum,
        type: 'transfer',
        category: 'مناقلة صناديق وتسوية صرافة',
        description: `مناقلة من صندوق (${fromName}) إلى صندوق (${toName}) بقيمة ${amountNum.toLocaleString()} ر.ي. ${transferForm.notes}`,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      alert(`✅ تمت المناقلة بنجاح بقيمة ${amountNum.toLocaleString()} ر.ي من (${fromName}) إلى (${toName})!`);
      setShowExchangeTransferModal(false);
      setTransferForm({ fromBoxId: '', toBoxId: '', amount: '', notes: '' });
    } catch (err: any) {
      console.error(err);
      alert('خطأ في تنفيذ المناقلة: ' + err.message);
    } finally {
      setIsSubmitting(null);
    }
  };

  // Print Comprehensive Cashier Settlement Sheet
  const handlePrintCashierReport = () => {
    const activeBoxes = combinedBoxesForSelect.map(b => `${b.name}: ${Number(b.balance || 0).toLocaleString()} ر.ي`).join(' | ');
    const printHtml = `
      <div style="font-family: Cairo, sans-serif; direction: rtl; text-align: right; padding: 20px;">
        <h2 style="text-align: center; color: #d4af37; margin-bottom: 5px;">تقرير تسويات الصراف وإغلاق العهد</h2>
        <p style="text-align: center; font-size: 12px; color: #666;">التاريخ: ${new Date().toLocaleString('ar-EG')}</p>
        <hr style="border: 1px solid #ddd; margin: 15px 0;" />
        
        <h3>أرصدة الصناديق والمحافظ البنكية:</h3>
        <p style="font-size: 14px; font-weight: bold;">${activeBoxes}</p>
        <p style="font-size: 16px; color: green; font-weight: bold; margin-top: 10px;">إجمالي رصيد الخزينة: ${totalTreasuryBalance.toLocaleString()} ر.ي</p>
        
        <hr style="border: 1px solid #ddd; margin: 15px 0;" />
        <h3>ملخص الحوالات المعلقة (${stats.countPending}):</h3>
        <p style="font-size: 14px; color: red;">إجمالي المبالغ المعلقة للترحيل: ${stats.totalPending.toLocaleString()} ر.ي</p>
        
        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
          <p>توقيع مسؤول الصندوق / الصراف: .....................</p>
          <p>توقيع المشرف العام: .....................</p>
        </div>
      </div>
    `;
    DesktopStandaloneWrapper.sendDirectThermalPrintJob(printHtml);
  };

  const filteredRemittances = combinedList.filter(item => {
    const isVerifiedTab = tab === 'verified' ? item.isVerified === true : item.isVerified !== true;
    const matchesFilterType = 
      filterType === 'all' ? true :
      filterType === 'orders' ? item.isOrder :
      filterType === 'transfers' ? item.isTransfer : true;

    const matchesSearch = 
      item.senderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.remittanceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return isVerifiedTab && matchesFilterType && matchesSearch;
  });

  const combinedBoxesForSelect = [
    ...bankAccounts.map(b => ({
      id: b.id,
      name: b.boxName || b.bankName || 'حساب بنكي',
      balance: b.balance
    })),
    ...customBoxes.map(c => ({
      id: c.id,
      name: c.boxName,
      balance: c.balance
    }))
  ];

  const totalTreasuryBalance = [...bankAccounts, ...customBoxes].reduce((acc, cur) => DecimalPrecisionService.add(acc, cur.balance || 0), 0);

  return (
    <div className="space-y-6 text-right font-sans select-none" dir="rtl">
      
      {/* 🌟 Top Action Bar with Cashier Operations */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-navy-950/60 rounded-3xl border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 rounded-2xl shadow-lg">
            <Coins size={24} className="stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>تسويات الصراف والصناديق اليومية</span>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">نشط وحي</span>
            </h2>
            <p className="text-xs text-gray-400">إدارة شبكات الصرافة (الكريمي، النجم، العمقي) والترحيل الفوري المباشر</p>
          </div>
        </div>

        {/* Action Buttons for Cashier Operations */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Button 1: Add Manual Remittance / Deposit */}
          <button
            type="button"
            onClick={() => setShowDirectDepositModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={15} />
            <span>تسجيل حوالة / إيداع صرافة</span>
          </button>

          {/* Button 2: Inter-Box Transfers */}
          <button
            type="button"
            onClick={() => setShowExchangeTransferModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <ArrowRightLeft size={15} />
            <span>مناقلة بين الصناديق</span>
          </button>

          {/* Button 3: Print Settlement Report */}
          <button
            type="button"
            onClick={handlePrintCashierReport}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-black flex items-center gap-2 border border-white/10 transition-all active:scale-95 cursor-pointer"
          >
            <Printer size={15} />
            <span>طباعة كشف التسوية</span>
          </button>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-glass p-6 border-b-4 border-b-emerald-500 overflow-hidden relative rounded-3xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-bold">الحوالات المعلقة الموجهة للصناديق</p>
              <h4 className="text-2xl font-black text-white mt-1">{stats.totalPending.toLocaleString()} <span className="text-sm font-normal text-gray-400">ر.ي</span></h4>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
              <Coins size={28} />
            </div>
          </div>
          <p className="text-[11px] text-emerald-400/90 font-semibold mt-4">بانتظار التحقق من كشف الحساب وتأكيد المسار ماليّاً</p>
        </div>

        <div className="card-glass p-6 border-b-4 border-b-indigo-500 overflow-hidden relative rounded-3xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-bold">عدد المعاملات قيد التدقيق</p>
              <h4 className="text-2xl font-black text-white mt-1">{stats.countPending} <span className="text-sm font-normal text-gray-400">حوالة</span></h4>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
              <Clock size={28} />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-4">يتم ربط كل حوالة بحساب الصندوق المقابل لحظياً</p>
        </div>

        <div className="card-glass p-6 border-b-4 border-b-amber-500 overflow-hidden relative rounded-3xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-bold">إجمالي الأرصدة المتوفرة بالصناديق</p>
              <h4 className="text-2xl font-black text-white mt-1">
                {totalTreasuryBalance.toLocaleString()} <span className="text-sm font-normal text-gray-400">ر.ي</span>
              </h4>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
              <PiggyBank size={28} />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-4">موزعة على المحفظة البنكية والتحصيلات اليدوية الكاش</p>
        </div>
      </div>

      {/* Main Container */}
      <div className="card-glass p-6 md:p-8 space-y-6 rounded-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <DollarSign className="text-brand-primary" />
              أعمال وتدقيق الصناديق المالية (الترحيل الفوري)
            </h3>
            <p className="text-xs text-gray-400 mt-1">مراجعة الحوالات البنكية المعلقة (الكريمي، النجم، كاش المحل) وتأكيد المسار ماليّاً لتنزيلها بالصناديق المعنية.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pill by Tab */}
            <div className="flex bg-navy-950 p-1 rounded-2xl border border-white/10">
              <button 
                onClick={() => setTab('pending')}
                className={`px-5 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${tab === 'pending' ? 'bg-[#d4af37] text-slate-950 shadow-md font-black' : 'text-gray-400 hover:text-white'}`}
              >
                الحوالات المعلقة ({stats.countPending})
              </button>
              <button 
                onClick={() => setTab('verified')}
                className={`px-5 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${tab === 'verified' ? 'bg-[#d4af37] text-slate-950 shadow-md font-black' : 'text-gray-400 hover:text-white'}`}
              >
                تم ترحيلها وتأكيدها
              </button>
            </div>

            {/* Quick Filter: All vs Orders vs Transfers */}
            <div className="flex bg-navy-950 p-1 rounded-2xl border border-white/10">
              <button 
                onClick={() => setFilterType('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterType === 'all' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                الكل
              </button>
              <button 
                onClick={() => setFilterType('orders')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterType === 'orders' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                طلبات مبيعات
              </button>
              <button 
                onClick={() => setFilterType('transfers')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterType === 'transfers' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                حوالات واردة
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="البحث برقم الحوالة، اسم العميل، اسم المرسل، أو الملاحظات..."
            className="w-full pr-12 pl-4 py-3.5 bg-navy-950 border border-white/10 rounded-2xl text-xs sm:text-sm text-white outline-none focus:ring-2 focus:ring-[#d4af37]/50 placeholder-gray-500 font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Transactions Table / List */}
        <div className="space-y-4">
          {filteredRemittances.length === 0 ? (
            <div className="py-16 text-center text-gray-400 space-y-3 bg-navy-950/40 rounded-3xl border border-white/5">
              <PiggyBank size={56} className="mx-auto opacity-30 animate-pulse text-[#d4af37]" />
              <p className="text-base font-bold text-gray-300">لا توجد سجلات مالية مطابقة للطلب الحالي</p>
              <p className="text-xs text-gray-500">يمكنك إضافة حوالة أو إيداع يدوي عبر زر (تسجيل حوالة / إيداع صرافة) بالأعلى</p>
            </div>
          ) : (
            filteredRemittances.map(rem => {
              const amount = rem.amount || 0;
              const hasRemNumber = rem.isTransfer ? true : !!rem.paymentDetails?.remittanceNumber;
              return (
                <motion.div 
                  key={rem.id}
                  layout
                  className="p-5 sm:p-6 bg-navy-950/60 rounded-3xl border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-[#d4af37]/40 transition-all text-right shadow-lg"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-black font-mono text-gray-300 bg-white/10 px-3 py-1 rounded-lg">
                        {rem.isTransfer ? `حوالة مستند: #${rem.id.slice(-6)}` : `طلب مبيعات: #${rem.id.slice(-6)}`}
                      </span>
                      {hasRemNumber ? (
                        <span className="text-[11px] font-black font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-lg flex items-center gap-1">
                          <Hash size={12} />
                          {rem.isTransfer ? `رقم TRX: ${rem.id.slice(-6).toUpperCase()}` : `حوالة: ${rem.paymentDetails?.remittanceNumber}`}
                        </span>
                      ) : (
                        <span className="text-[11px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg">
                          استلام كاش يدوي
                        </span>
                      )}
                      
                      <span className="text-[11px] font-black bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 px-3 py-1 rounded-lg">
                        {rem.senderName || 'اسم المرسل غير معرّف'}
                      </span>

                      <span className="text-[11px] font-black bg-navy-800 text-gray-300 px-3 py-1 rounded-lg border border-white/10">
                        {rem.displayType}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-300">
                      <p>المبلغ المحول: <span className="font-mono text-emerald-400 font-black text-base sm:text-lg">{amount.toLocaleString()}</span> <span className="text-xs text-gray-400 font-normal">ر.ي</span></p>
                      <p className="text-xs text-gray-400">
                        • تاريخ القيد: {rem.createdAt?.seconds ? new Date(rem.createdAt.seconds * 1000).toLocaleString('ar-EG') : (rem.createdAt ? new Date(rem.createdAt).toLocaleString('ar-EG') : '---')}
                      </p>
                    </div>

                    {rem.notes && (
                      <p className="text-xs text-amber-200/80 bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/10 inline-block">
                        ملاحظات: {rem.notes}
                      </p>
                    )}
                  </div>

                  {/* Operational Controls for Destination Route */}
                  {rem.isVerified ? (
                    <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl">
                      <div className="text-left font-sans">
                        <p className="text-[10px] text-gray-400">تم التوجيه والمطابقة مسبقاً</p>
                        <p className="text-xs font-black text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
                          <CheckCircle2 size={14} /> {rem.remittanceRoutingBoxName || rem.recipientDetails || 'الصندوق المستودع'}
                        </p>
                      </div>
                      <div className="text-left font-mono border-r border-white/10 pr-3">
                        <p className="text-[9px] text-gray-500">مرحل بواسطة</p>
                        <p className="text-[11px] text-gray-300 font-bold">{rem.paymentVerifiedBy || rem.receivedByName || '---'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 w-full lg:w-auto text-right">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="space-y-1 w-full sm:w-64">
                          <label className="text-[10px] font-bold text-gray-300 block">الصندوق المالي المستهدف (المستودع):</label>
                          <select 
                            className="bg-navy-950 border-2 border-white/15 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#d4af37] w-full font-bold"
                            value={selectedBoxIds[rem.id] || ''}
                            onChange={(e) => setSelectedBoxIds(prev => ({ ...prev, [rem.id]: e.target.value }))}
                          >
                            <option value="">-- اختر الصندوق المناسب --</option>
                            {combinedBoxesForSelect.map(b => (
                              <option key={b.id} value={b.id} className="bg-navy-950 text-white font-bold">
                                {b.name} (الرصيد: {Number(b.balance || 0).toLocaleString()} ر.ي)
                              </option>
                            ))}
                          </select>
                        </div>

                        <button 
                          disabled={isSubmitting === rem.id}
                          onClick={() => handleRouteAndVerify(rem)}
                          className="py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 self-end sm:self-auto cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                        >
                          {isSubmitting === rem.id ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" />
                              <span>جاري الترحيل...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={16} />
                              <span>تأكيد وقبض الحوالة</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Quick Route Buttons */}
                      {combinedBoxesForSelect.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-amber-400 font-extrabold ml-1">⚡ ترحيل سريع بنقرة واحدة:</span>
                          {combinedBoxesForSelect.map(b => (
                            <button
                              key={b.id}
                              type="button"
                              disabled={isSubmitting === rem.id}
                              onClick={() => handleRouteAndVerify(rem, b.id)}
                              className="px-3 py-1.5 bg-[#d4af37]/15 hover:bg-[#d4af37]/30 text-[#d4af37] border border-[#d4af37]/30 hover:border-[#d4af37] rounded-xl text-[11px] font-black transition-all cursor-pointer active:scale-95"
                            >
                              {b.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* 💳 Modal 1: Direct Manual Remittance / Deposit */}
      {showDirectDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-navy-950 border-2 border-[#d4af37] rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">تسجيل حوالة / إيداع صرافة يدوي</h3>
                  <p className="text-[11px] text-gray-400">إيداع فوري من شبكات الصرافة وقيدها بالصندوق</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowDirectDepositModal(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDirectDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">جهة الصرافة / البنك:</label>
                <select
                  value={depositForm.exchangerName}
                  onChange={(e) => setDepositForm({ ...depositForm, exchangerName: e.target.value })}
                  className="w-full bg-navy-900 border border-white/15 rounded-xl px-4 py-3 text-xs sm:text-sm text-white font-bold outline-none focus:border-[#d4af37]"
                >
                  <option value="شركة الكريمي للصرافة">شركة الكريمي للصرافة</option>
                  <option value="شركة النجم للحوالات والصرافة">شركة النجم للحوالات والصرافة</option>
                  <option value="شركة العمقي وإخوانه للصرافة">شركة العمقي وإخوانه للصرافة</option>
                  <option value="شركة المريسي للصرافة">شركة المريسي للصرافة</option>
                  <option value="بنك التضامن الإسلامي">بنك التضامن الإسلامي</option>
                  <option value="بنك اليمن والكويت">بنك اليمن والكويت</option>
                  <option value="صرافة أخرى">صرافة أخرى</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">المبلغ (ر.ي):</label>
                  <input
                    type="number"
                    required
                    value={depositForm.amount}
                    onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                    className="w-full bg-navy-900 border border-white/15 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-[#d4af37]"
                    placeholder="مثال: 50000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">رقم الحوالة (اختياري):</label>
                  <input
                    type="text"
                    value={depositForm.remittanceNumber}
                    onChange={(e) => setDepositForm({ ...depositForm, remittanceNumber: e.target.value })}
                    className="w-full bg-navy-900 border border-white/15 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-[#d4af37]"
                    placeholder="رقم السند أو الحوالة"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اسم المرسل / العميل:</label>
                <input
                  type="text"
                  value={depositForm.senderName}
                  onChange={(e) => setDepositForm({ ...depositForm, senderName: e.target.value })}
                  className="w-full bg-navy-900 border border-white/15 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-[#d4af37]"
                  placeholder="اسم الشخص المرسل للحوالة"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">الصندوق المالي المستودع:</label>
                <select
                  required
                  value={depositForm.boxId}
                  onChange={(e) => setDepositForm({ ...depositForm, boxId: e.target.value })}
                  className="w-full bg-navy-900 border border-white/15 rounded-xl px-4 py-3 text-xs sm:text-sm text-white font-bold outline-none focus:border-[#d4af37]"
                >
                  <option value="">-- اختر الصندوق المالي --</option>
                  {combinedBoxesForSelect.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} (الرصيد: {Number(b.balance || 0).toLocaleString()} ر.ي)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">ملاحظات وبيان العملية:</label>
                <input
                  type="text"
                  value={depositForm.notes}
                  onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                  className="w-full bg-navy-900 border border-white/15 rounded-xl px-4 py-3 text-xs sm:text-sm text-white font-bold outline-none focus:border-[#d4af37]"
                  placeholder="مثال: تسوية دفعة حساب أو إيداع نقدي..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowDirectDepositModal(false)}
                  className="px-5 py-3 rounded-xl bg-white/10 text-gray-300 hover:text-white text-xs font-black cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting === 'direct_deposit'}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs sm:text-sm font-black shadow-lg cursor-pointer hover:brightness-110 active:scale-95"
                >
                  {isSubmitting === 'direct_deposit' ? 'جاري القيد والتسوية...' : 'تأكيد التسوية والقيد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔄 Modal 2: Box to Box Inter-Transfer */}
      {showExchangeTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-navy-950 border-2 border-blue-500 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">مناقلة وتسوية بين الصناديق</h3>
                  <p className="text-[11px] text-gray-400">تحويل رصيد من صندوق كاش لحساب بنكي أو صراف</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowExchangeTransferModal(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBoxTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">من صندوق (المصدر):</label>
                <select
                  required
                  value={transferForm.fromBoxId}
                  onChange={(e) => setTransferForm({ ...transferForm, fromBoxId: e.target.value })}
                  className="w-full bg-navy-900 border border-white/15 rounded-xl px-4 py-3 text-xs sm:text-sm text-white font-bold outline-none focus:border-blue-500"
                >
                  <option value="">-- اختر الصندوق المحول منه --</option>
                  {combinedBoxesForSelect.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} (الرصيد: {Number(b.balance || 0).toLocaleString()} ر.ي)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">إلى صندوق (المستلم):</label>
                <select
                  required
                  value={transferForm.toBoxId}
                  onChange={(e) => setTransferForm({ ...transferForm, toBoxId: e.target.value })}
                  className="w-full bg-navy-900 border border-white/15 rounded-xl px-4 py-3 text-xs sm:text-sm text-white font-bold outline-none focus:border-blue-500"
                >
                  <option value="">-- اختر الصندوق المحول إليه --</option>
                  {combinedBoxesForSelect.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} (الرصيد: {Number(b.balance || 0).toLocaleString()} ر.ي)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">المبلغ المراد تحويله (ر.ي):</label>
                <input
                  type="number"
                  required
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  className="w-full bg-navy-900 border border-white/15 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-blue-500"
                  placeholder="أدخل المبلغ..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">البيان والملاحظات:</label>
                <input
                  type="text"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  className="w-full bg-navy-900 border border-white/15 rounded-xl px-4 py-3 text-xs sm:text-sm text-white font-bold outline-none focus:border-blue-500"
                  placeholder="مثال: تغذية صندوق المحل من حساب الكريمي..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowExchangeTransferModal(false)}
                  className="px-5 py-3 rounded-xl bg-white/10 text-gray-300 hover:text-white text-xs font-black cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting === 'box_transfer'}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs sm:text-sm font-black shadow-lg cursor-pointer hover:brightness-110 active:scale-95"
                >
                  {isSubmitting === 'box_transfer' ? 'جاري التحويل...' : 'تنفيذ المناقلة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
