import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  getDoc,
  doc, 
  addDoc, 
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Transaction, MoneyTransfer, FixedAsset, AdjustmentVoucher } from '../types';
import { FinancialMath } from '../utils/financialMath';
import { 
  Plus, 
  Search, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Briefcase,
  History, 
  ShieldAlert, 
  Trash2, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  RotateCcw, 
  Layers, 
  ChevronRight,
  Info,
  DollarSign,
  Printer,
  X,
  Loader2,
  Lock,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { printReceipt } from '../services/printService';

export const CANONICAL_WALLETS = [
  { id: 'CASH_BOX', boxName: 'صندوق النقد الرئيسي (الكاش)', chartOfAccountsCode: '1101', type: 'cash', balance: 0, currency: 'YER' },
  { id: 'AL_KURIMI', boxName: 'بنك الكريمي الإسلامي', chartOfAccountsCode: '1102', type: 'bank', balance: 0, currency: 'YER' },
  { id: 'AL_TADHAMON', boxName: 'بنك التضامن الإسلامي', chartOfAccountsCode: '1103', type: 'bank', balance: 0, currency: 'YER' },
  { id: 'YKB', boxName: 'بنك اليمن والكويت', chartOfAccountsCode: '1104', type: 'bank', balance: 0, currency: 'YER' },
  { id: 'AL_NAJM', boxName: 'شركة النجم للصرافة والتحويلات', chartOfAccountsCode: '1105', type: 'remittance', balance: 0, currency: 'YER' },
  { id: 'AL_AMQI', boxName: 'شركة العمقي للصرافة والتحويلات', chartOfAccountsCode: '1106', type: 'remittance', balance: 0, currency: 'YER' },
  { id: 'JAWALI', boxName: 'محفظة جوالي الإلكترونية', chartOfAccountsCode: '1107', type: 'remittance', balance: 0, currency: 'YER' },
  { id: 'OWNER_CUSTODY', boxName: 'صندوق المالك للعهود والمسحوبات', chartOfAccountsCode: '1108', type: 'owner', balance: 0, currency: 'YER' }
];

interface FinancialCenterProps {
  profile: UserProfile | null;
}

export default function FinancialCenter({ profile }: FinancialCenterProps) {
  const [activeTab, setActiveTab] = useState<'safes' | 'adjustments' | 'assets' | 'transfers' | 'daily_audits'>('safes');
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [customBoxes, setCustomBoxes] = useState<any[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [adjustmentVouchers, setAdjustmentVouchers] = useState<AdjustmentVoucher[]>([]);
  const [transfers, setTransfers] = useState<MoneyTransfer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Daily detailed audit state variables
  const [auditClients, setAuditClients] = useState<any[]>([]);
  const [auditInventory, setAuditInventory] = useState<any[]>([]);
  const [auditTabSelected, setAuditTabSelected] = useState<'logs' | 'client' | 'box' | 'item' | 'warehouse' | 'bank' | 'income' | 'expense' | 'profits'>('logs');

  // Box creation state
  const [isAddBoxOpen, setIsAddBoxOpen] = useState(false);
  const [newBox, setNewBox] = useState({
    boxName: '',
    chartOfAccountsCode: '1109',
    type: 'cash',
    currency: 'YER',
    balance: ''
  });
  const [isSubmittingBox, setIsSubmittingBox] = useState(false);

  // Cashier Drawer reconciliation state (مطابقة جرد الصندوق)
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [selectedAuditBoxId, setSelectedAuditBoxId] = useState('CASH_BOX');
  const [physicalCashInput, setPhysicalCashInput] = useState('');
  const [auditNotes, setAuditNotes] = useState('');
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

  // Create adjustment state
  const [adjustmentForm, setAdjustmentForm] = useState({
    targetBoxId: 'CASH_BOX',
    amount: '',
    type: 'INCREMENT' as 'INCREMENT' | 'DECREMENT',
    reason: ''
  });
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);

  // Asset creation state
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: '',
    value: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    deductedFromBoxId: 'CASH_BOX'
  });
  const [isSubmittingAsset, setIsSubmittingAsset] = useState(false);

  // Transfer Between Safes Box State
  const [transferForm, setTransferForm] = useState({
    sourceBoxId: 'CASH_BOX',
    destBoxId: 'AL_KURIMI',
    amount: '',
    notes: ''
  });
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Fetch Core Data
  useEffect(() => {
    if (!profile?.ownerId) return;

    setLoading(true);

    // Seeding default wallets if not existing
    const seedDefaultWallets = async () => {
      try {
        const snap = await getDocs(collection(db, 'stores', profile.ownerId, 'customBoxes'));
        const existingIds = snap.docs.map(doc => doc.id);
        
        const batch = writeBatch(db);
        let seeded = false;
        for (const wallet of CANONICAL_WALLETS) {
          if (!existingIds.includes(wallet.id)) {
            const ref = doc(db, 'stores', profile.ownerId, 'customBoxes', wallet.id);
            batch.set(ref, {
              ...wallet,
              ownerId: profile.ownerId,
              createdAt: serverTimestamp()
            });
            seeded = true;
          }
        }
        if (seeded) await batch.commit();
      } catch (err) {
        console.warn("Seeding default wallets skipped or failed Safely:", err);
      }
    };
    seedDefaultWallets();

    // Listeners
    const unsubBoxes = onSnapshot(collection(db, 'stores', profile.ownerId, 'customBoxes'), (snap) => {
      setCustomBoxes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubEmployees = onSnapshot(
      query(collection(db, 'users'), where('ownerId', '==', profile.ownerId)),
      (snap) => {
        setEmployees(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      }
    );

    const unsubAssets = onSnapshot(
      query(collection(db, 'fixedAssets'), where('ownerId', '==', profile.ownerId)),
      (snap) => {
        setFixedAssets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FixedAsset)));
      }
    );

    const unsubAdjustments = onSnapshot(
      query(collection(db, 'adjustmentVouchers'), where('ownerId', '==', profile.ownerId)),
      (snap) => {
        setAdjustmentVouchers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdjustmentVoucher)));
      }
    );

    const unsubTransfers = onSnapshot(
      query(collection(db, 'moneyTransfers'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snap) => {
        setTransfers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MoneyTransfer)));
      }
    );

    const unsubTX = onSnapshot(
      query(collection(db, 'transactions'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snap) => {
        setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
        setLoading(false);
      }
    );

    const unsubAudClients = onSnapshot(
      query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId)),
      (snap) => {
        setAuditClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.warn("Audit clients snap warning safely:", err);
      }
    );

    const unsubAudInventory = onSnapshot(
      query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId)),
      (snap) => {
        setAuditInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.warn("Audit inventory snap warning safely:", err);
      }
    );

    return () => {
      unsubBoxes();
      unsubEmployees();
      unsubAssets();
      unsubAdjustments();
      unsubTransfers();
      unsubTX();
      unsubAudClients();
      unsubAudInventory();
    };
  }, [profile?.ownerId]);

  // Create Custom Box
  const handleCreateBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    if (!newBox.boxName) {
      alert("الرجاء إدخال اسم للصندوق.");
      return;
    }

    setIsSubmittingBox(true);
    try {
      const generatedId = `BOX_${Date.now()}`;
      await setDoc(doc(db, 'stores', profile.ownerId, 'customBoxes', generatedId), {
        id: generatedId,
        boxName: newBox.boxName,
        chartOfAccountsCode: newBox.chartOfAccountsCode,
        type: newBox.type,
        currency: newBox.currency,
        balance: Number(newBox.balance) || 0,
        ownerId: profile.ownerId,
        createdAt: serverTimestamp()
      });
      setIsAddBoxOpen(false);
      setNewBox({ boxName: '', chartOfAccountsCode: '1109', type: 'cash', currency: 'YER', balance: '' });
      alert("✓ تم تأسيس وإضافة الصندوق المالي الجديد بنجاح!");
    } catch (err) {
      console.error(err);
      alert("فشل إنشاء الصندوق الجديد.");
    } finally {
      setIsSubmittingBox(false);
    }
  };

  // Submit Audit Reconciliation
  const handleReconcileAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    const physical = Number(physicalCashInput);
    if (isNaN(physical) || physical < 0) {
      alert("الرجاء إدخال مبلغ جرد درج صحيح وعادل.");
      return;
    }

    const targetBox = customBoxes.find(b => b.id === selectedAuditBoxId);
    if (!targetBox) return;

    setIsSubmittingAudit(true);
    try {
      const currentDBBalance = Number(targetBox.balance || 0);
      const difference = physical - currentDBBalance;

      // 1. Post adjustment log
      await addDoc(collection(db, 'adjustmentVouchers'), {
        ownerId: profile.ownerId,
        targetBoxId: selectedAuditBoxId,
        amount: Math.abs(difference),
        type: difference >= 0 ? 'INCREMENT' : 'DECREMENT',
        reason: `تسوية جرد دفتري للدرج والعهد اليومية: ${auditNotes || 'تسوية تلقائية للجرد'}`,
        operatorName: profile.name || 'المدير المالي',
        timestamp: serverTimestamp()
      });

      // 2. Adjust target box balance to equal the physical reality directly!
      await updateDoc(doc(db, 'stores', profile.ownerId, 'customBoxes', selectedAuditBoxId), {
        balance: physical
      });

      // Also update v1 in vaults if CASH_BOX was adjusted to ensure dashboard matches perfectly
      if (selectedAuditBoxId === 'CASH_BOX') {
        try {
          const sId = profile.storeId || profile.ownerId || 'main_store';
          await setDoc(doc(db, 'stores', profile.ownerId, 'vaults', 'v1'), {
            id: 'v1',
            name: 'صندوق الكاش الرئيسي للبيع',
            type: 'cash',
            balance: physical,
            ownerId: profile.ownerId,
            storeId: sId
          }, { merge: true });

          await setDoc(doc(db, 'vaults', `${profile.ownerId}-v1`), {
            id: 'v1',
            name: 'صندوق الكاش الرئيسي للبيع',
            type: 'cash',
            balance: physical,
            ownerId: profile.ownerId,
            storeId: sId
          }, { merge: true });
        } catch (vaultErr) {
          console.warn("Could not sync with v1 vault in FinancialCenter:", vaultErr);
        }
      }

      alert(`✓ تم بنجاح مطابقة وجرد الصندوق [${targetBox.boxName}]! تم تصفير الفجوة وتحديث الرصيد الفعلي ليعادل الكاش المتواجد وهو ${physical.toLocaleString()} YER.`);
      setIsAuditModalOpen(false);
      setPhysicalCashInput('');
      setAuditNotes('');
    } catch (err) {
      console.error(err);
      alert("خطأ أثناء ترحيل قيد تسوية الجرد.");
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  // Submit Manual Adjustment Voucher
  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    const amount = Number(adjustmentForm.amount) || 0;
    if (amount <= 0) {
      alert("الرجاء إدخال قيمة السند بشكل صحيح.");
      return;
    }

    setIsSubmittingAdj(true);
    try {
      const isInc = adjustmentForm.type === 'INCREMENT';
      const balanceChange = isInc ? amount : -amount;

      // Record Adjustment Document
      await addDoc(collection(db, 'adjustmentVouchers'), {
        ownerId: profile.ownerId,
        targetBoxId: adjustmentForm.targetBoxId,
        amount,
        type: adjustmentForm.type,
        reason: adjustmentForm.reason,
        operatorName: profile.name || 'المدير المسؤول',
        timestamp: serverTimestamp()
      });

      // Update the targeted vault balance
      await updateDoc(doc(db, 'stores', profile.ownerId, 'customBoxes', adjustmentForm.targetBoxId), {
        balance: increment(balanceChange)
      });

      // Also update v1 in vaults if CASH_BOX was adjusted
      if (adjustmentForm.targetBoxId === 'CASH_BOX') {
        try {
          const sId = profile.storeId || profile.ownerId || 'main_store';
          await setDoc(doc(db, 'stores', profile.ownerId, 'vaults', 'v1'), {
            id: 'v1',
            name: 'صندوق الكاش الرئيسي للبيع',
            type: 'cash',
            balance: increment(balanceChange),
            ownerId: profile.ownerId,
            storeId: sId
          }, { merge: true });

          await setDoc(doc(db, 'vaults', `${profile.ownerId}-v1`), {
            id: 'v1',
            name: 'صندوق الكاش الرئيسي للبيع',
            type: 'cash',
            balance: increment(balanceChange),
            ownerId: profile.ownerId,
            storeId: sId
          }, { merge: true });
        } catch (vaultErr) {
          console.warn("Could not sync increment with v1 vault in FinancialCenter:", vaultErr);
        }
      }

      // Record a general transaction
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile.ownerId,
        type: isInc ? 'income' : 'expense',
        amount,
        category: 'تسوية محاسبية استثنائية',
        description: `سند تسوية الصناديق: ${adjustmentForm.reason}`,
        boxId: adjustmentForm.targetBoxId,
        createdAt: serverTimestamp(),
        addedBy: profile.uid || 'system'
      });

      alert("✓ تم ترحيل وقيد سند التسوية المالية وتعديل رصيد الخزنة فورياً!");
      setAdjustmentForm({ targetBoxId: 'CASH_BOX', amount: '', type: 'INCREMENT', reason: '' });
    } catch (err) {
      console.error(err);
      alert("فشل ترحيل سند التسوية.");
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  // Register New Capital Fixed Asset
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    const value = Number(assetForm.value) || 0;
    if (!assetForm.name || value <= 0) {
      alert("الرجاء استكمال بيانات الأصل الثابت وقيمته الشرائية عادلاً.");
      return;
    }

    const fundingBox = customBoxes.find(b => b.id === assetForm.deductedFromBoxId);
    if (fundingBox && Number(fundingBox.balance || 0) < value) {
      if (!window.confirm("تحذير: قيمة شراء الأصل تفوق رصيد الكاش المتواجد في هذا الصندوق المحدد. هل تود الاستمرار وتسجيل كاش بالسالب؟")) {
        return;
      }
    }

    setIsSubmittingAsset(true);
    try {
      // 1. Add Asset Record
      await addDoc(collection(db, 'fixedAssets'), {
        ownerId: profile.ownerId,
        name: assetForm.name,
        value,
        purchaseDate: assetForm.purchaseDate,
        deductedFromBoxId: assetForm.deductedFromBoxId,
        createdAt: serverTimestamp()
      });

      // 2. Subtract funding box balance
      await updateDoc(doc(db, 'stores', profile.ownerId, 'customBoxes', assetForm.deductedFromBoxId), {
        balance: increment(-value)
      });

      // 3. Register transaction
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile.ownerId,
        type: 'expense',
        amount: value,
        category: 'أصول رأسمالية وتطوير',
        description: `شراء أصل ثابت جديد: ${assetForm.name}`,
        boxId: assetForm.deductedFromBoxId,
        createdAt: serverTimestamp(),
        addedBy: profile.uid || 'system'
      });

      alert("✓ تم قيد وتسجيل الأصل الثابت وخصم قيمته الشرائية بالكامل من كاش الصندوق الممول!");
      setIsAddAssetOpen(false);
      setAssetForm({ name: '', value: '', purchaseDate: new Date().toISOString().split('T')[0], deductedFromBoxId: 'CASH_BOX' });
    } catch (err) {
      console.error(err);
      alert("فشل حفظ الأصل الثابت.");
    } finally {
      setIsSubmittingAsset(false);
    }
  };

  // Safe to Safe Money Transfer
  const handleTransferFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    const amount = Number(transferForm.amount) || 0;
    if (amount <= 0) {
      alert("الرجاء تبيين مبلغ التحويل.");
      return;
    }
    if (transferForm.sourceBoxId === transferForm.destBoxId) {
      alert("لا يمكن التحويل لنفس الصندوق المالي المحول منه.");
      return;
    }

    const srcBoxObj = customBoxes.find(b => b.id === transferForm.sourceBoxId);
    if (srcBoxObj && Number(srcBoxObj.balance || 0) < amount) {
      if (!window.confirm("تحذير: رصيد الصندوق المحول منه غير كاف لتغطية هذا المبلغ الدفتري. هل تريد إتمام تدوير المبلغ بالسالب؟")) {
        return;
      }
    }

    setIsSubmittingTransfer(true);
    try {
      const batch = writeBatch(db);

      // Decrement source
      const srcRef = doc(db, 'stores', profile.ownerId, 'customBoxes', transferForm.sourceBoxId);
      batch.update(srcRef, {
        balance: increment(-amount)
      });

      // Increment destination
      const destRef = doc(db, 'stores', profile.ownerId, 'customBoxes', transferForm.destBoxId);
      batch.update(destRef, {
        balance: increment(amount)
      });

      // Record transfer document
      const transferDocRef = doc(collection(db, 'moneyTransfers'));
      batch.set(transferDocRef, {
        ownerId: profile.ownerId,
        senderName: srcBoxObj?.boxName || 'الصندوق المرسل',
        receiverName: customBoxes.find(b => b.id === transferForm.destBoxId)?.boxName || 'الصندوق المستلم',
        amount,
        currency: srcBoxObj?.currency || 'YER',
        notes: transferForm.notes || 'مناقلة مالية بين الصناديق',
        createdAt: serverTimestamp(),
        operatorName: profile.name || 'أمين الصندوق'
      });

      await batch.commit();
      alert("✓ تمت عملية مناقلة وترحيل الأموال بنجاح وحدثت أرصدة الصناديق التزامنيّاً!");
      setTransferForm({ sourceBoxId: 'CASH_BOX', destBoxId: 'AL_KURIMI', amount: '', notes: '' });
    } catch (err) {
      console.error(err);
      alert("خطأ أثناء ترحيل تحويل الكاشير.");
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const totalCalculatedLiquidity = customBoxes.reduce((sum, b) => sum + (Number(b.balance) || 0), 0);

  return (
    <div className="space-y-6 dir-rtl text-right" dir="rtl">
      {/* Visual Header Banner */}
      <div className="bg-gradient-to-tr from-sky-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-sky-500/10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="p-1 px-3 bg-teal-500/20 text-teal-400 rounded-full text-xs font-black select-none tracking-wider">المالية والشركاء والعهود</span>
            <h1 className="text-2xl md:text-3xl font-black mt-2 text-white">إدارة الصناديق والأصول والتسويات الموحدة 🏦</h1>
            <p className="text-gray-400 text-xs md:text-sm mt-1">المحطة المتكاملة لمطابقة جرد الصناديق وتسليم وتسلم الأموال وتحصين الأصول التشغيلية</p>
          </div>
          
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => setIsAddBoxOpen(true)}
              className="p-3 px-4 bg-sky-500 hover:bg-sky-600 rounded-2xl flex items-center gap-2 font-black text-xs text-black shadow-md transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>تأسيس صندوق/خزنة</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                setSelectedAuditBoxId(customBoxes[0]?.id || 'CASH_BOX');
                setIsAuditModalOpen(true);
              }}
              className="p-3 px-4 bg-teal-500 hover:bg-teal-600 rounded-2xl flex items-center gap-2 font-black text-xs text-black shadow-md transition-all active:scale-95"
            >
              <Scale size={16} />
              <span>مطابقة جرد الصندوق</span>
            </button>
          </div>
        </div>

        {/* Unified cash overview across boxes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 border-t border-white/5 pt-6">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <span className="text-[11px] text-gray-400 block font-bold">إجمالي كاش السيولة (YER)</span>
            <span className="text-2xl font-black text-emerald-400 block mt-1 font-mono">{totalCalculatedLiquidity.toLocaleString()}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <span className="text-[11px] text-gray-400 block font-bold">صناديق نقد وخزائن نشطة</span>
            <span className="text-2xl font-black text-sky-400 block mt-1 font-mono text-center md:text-right">{customBoxes.length} <span className="text-xs text-gray-400">محافظ</span></span>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <span className="text-[11px] text-gray-400 block font-bold">إجمالي الأصول الرأسمالية</span>
            <span className="text-2xl font-black text-amber-500 block mt-1 font-mono">{fixedAssets.reduce((sum, a) => sum + (a.value || 0), 0).toLocaleString()} YER</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <span className="text-[11px] text-gray-400 block font-bold">أعداد سندات التسوية اليوم</span>
            <span className="text-2xl font-black text-purple-400 block mt-1 font-mono">{adjustmentVouchers.length} <span className="text-xs text-gray-400">سند</span></span>
          </div>
        </div>
      </div>

      {/* Primary Sub Tabs */}
      <div className="flex bg-slate-100 dark:bg-zinc-900 border border-slate-250 dark:border-zinc-805 p-1.5 rounded-2xl flex-nowrap overflow-x-auto gap-1">
        <button // Tab 1: treasury and wallets
          onClick={() => setActiveTab('safes')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none ${
            activeTab === 'safes' 
              ? 'bg-white dark:bg-zinc-800 text-sky-500 dark:text-sky-450 shadow-sm' 
              : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'
          }`}
        >
          <Wallet size={16} />
          <span>أرصدة الصناديق والخزائن</span>
        </button>

        <button // Tab 2: general financial adjustments vouchers
          onClick={() => setActiveTab('adjustments')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none ${
            activeTab === 'adjustments' 
              ? 'bg-white dark:bg-zinc-800 text-sky-500 dark:text-sky-450 shadow-sm' 
              : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'
          }`}
        >
          <Plus size={16} />
          <span>سندات التسويات المالية وعجز الجرد</span>
        </button>

        <button // Tab 3: Fixed Capital Assets
          onClick={() => setActiveTab('assets')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none ${
            activeTab === 'assets' 
              ? 'bg-white dark:bg-zinc-800 text-sky-500 dark:text-sky-450 shadow-sm' 
              : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'
          }`}
        >
          <Briefcase size={16} />
          <span>الأصول الثابتة وإهلاكها</span>
        </button>

        <button // Tab 4: Transfers and personnel delivery handovers
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none ${
            activeTab === 'transfers' 
              ? 'bg-white dark:bg-zinc-800 text-sky-500 dark:text-sky-450 shadow-sm' 
              : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'
          }`}
        >
          <ArrowRightLeft size={16} />
          <span>ترحيل ومناقلة الكاش والعهد</span>
        </button>

        <button // Tab 5: Detailed Auditing and Control
          onClick={() => setActiveTab('daily_audits')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none ${
            activeTab === 'daily_audits' 
              ? 'bg-white dark:bg-zinc-800 text-sky-500 dark:text-sky-450 shadow-sm' 
              : 'text-gray-500 hover:text-gray-750 dark:hover:text-gray-300'
          }`}
        >
          <Scale size={16} />
          <span>مركز الجرد والرقابة اليومية 🔎</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        
        {/* VIEW 1: Cash safes list and active transactions logs */}
        {activeTab === 'safes' && (
          <motion.div 
            key="safes"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Grid list of wallets */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {customBoxes.map((box) => (
                <div 
                  key={box.id} 
                  className="bg-white dark:bg-zinc-900 border border-slate-250 dark:border-zinc-805 p-5 rounded-3xl shadow-sm flex flex-col justify-between h-40 hover:border-slate-300 transition-all select-none relative"
                >
                  <div className="flex justify-between items-start">
                    <span className="p-1 px-2.5 bg-slate-100 dark:bg-zinc-950 text-gray-550 dark:text-gray-300 rounded-lg text-[9px] font-bold font-mono">
                      CODE: {box.chartOfAccountsCode || '1100'}
                    </span>
                    <span className="text-xl">
                      {box.type === 'bank' ? '🏦' : box.type === 'remittance' ? '✈️' : box.type === 'owner' ? '👑' : '🪙'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-xs font-black text-gray-450 truncate">{box.boxName}</h3>
                    <span className="text-2xl font-black font-mono text-gray-800 dark:text-white block mt-1 tracking-tight">
                      {Number(box.balance || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">{box.currency || 'YER'}</span>
                    </span>
                  </div>

                  <div className="absolute left-4 bottom-4 flex gap-1">
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedAuditBoxId(box.id);
                        setIsAuditModalOpen(true);
                      }}
                      className="p-1 px-2bg bg-slate-50/50 hover:bg-slate-100 border border-slate-205 dark:border-zinc-850 dark:hover:bg-zinc-800 rounded-md text-[9px] text-sky-500 font-bold"
                    >
                      مطابقة الجرد ⚖️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Direct receipts / transactions list */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-805 rounded-3xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 dark:bg-zinc-955 px-6 py-4 border-b border-slate-100 dark:border-zinc-850 flex items-center justify-between">
                <span className="font-black text-xs md:text-sm text-gray-850 dark:text-white">جدول الإيداعات والمقبوضات والمصاريف المباشرة الجارية</span>
                <span className="text-[10px] text-gray-400 font-bold">تزامن فوري</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-slate-50/50 dark:bg-zinc-950/20 text-[10px] text-gray-400 font-black tracking-wider uppercase border-b border-slate-100 dark:border-zinc-850">
                    <tr>
                      <th className="px-6 py-3.5">سجل رقم</th>
                      <th className="px-6 py-3.5">البيان / الوجه الاستهدافي</th>
                      <th className="px-6 py-3.5">تفريغ الصندوق للعملة</th>
                      <th className="px-6 py-3.5">القيمة المقيدة</th>
                      <th className="px-6 py-3.5">التاريخ والوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-400 font-bold">
                          لا توجد عمليات مقيدة للصناديق بالفترة الحالية.
                        </td>
                      </tr>
                    ) : (
                      transactions.slice(0, 15).map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-950/15">
                          <td className="px-6 py-3.5 font-mono text-[10px] text-gray-400">#{tx.id ? tx.id.slice(-6).toUpperCase() : 'AUTO'}</td>
                          <td className="px-6 py-3.5">
                            <div className="font-bold text-gray-800 dark:text-gray-200">{tx.category}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5 max-w-[220px] truncate" title={tx.description}>{tx.description}</div>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="p-1 px-2 bg-slate-100 dark:bg-zinc-950 text-gray-500 rounded-md text-[10px] font-bold font-mono">
                              {tx.boxId === 'CASH_BOX' || !tx.boxId ? 'الصندوق العام للمحل' : (customBoxes.find(b => b.id === tx.boxId)?.boxName || 'حساب مالي فرعي')}
                            </span>
                          </td>
                          <td className={`px-6 py-3.5 font-bold font-mono text-sm ${tx.type === 'income' ? 'text-success' : 'text-danger'}`}>
                            {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()} YER
                          </td>
                          <td className="px-6 py-3.5 text-gray-400 font-mono text-xs">
                            {tx.createdAt ? (
                              typeof tx.createdAt.toDate === 'function' ? tx.createdAt.toDate().toLocaleString('ar-EG') : 'الآن'
                            ) : 'الآن'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 2: General financial adjustment vouchers & cashier Desk audits history */}
        {activeTab === 'adjustments' && (
          <motion.div 
            key="adjustments"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Form */}
            <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-805 p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-gray-800 dark:text-white">سند تسوية الصناديق ⚖️</h3>
                <p className="text-gray-400 text-xs mt-1">ترحيل قيود الفائض أو العجوزات المكتشفة في النقدية دفترياً</p>
              </div>

              <form onSubmit={handleCreateAdjustment} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 block">الصندوق المطلوب ترحيل التسوية له *</label>
                  <select 
                    required
                    value={adjustmentForm.targetBoxId}
                    onChange={(e) => setAdjustmentForm({...adjustmentForm, targetBoxId: e.target.value})}
                    className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {customBoxes.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.boxName} [{Number(b.balance || 0).toLocaleString()} {b.currency || 'YER'}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 block">نوع القيد *</label>
                    <select
                      value={adjustmentForm.type}
                      onChange={(e) => setAdjustmentForm({...adjustmentForm, type: e.target.value as any})}
                      className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="INCREMENT">فائض / زيادة (+)</option>
                      <option value="DECREMENT">عجز / نقص (-)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 block">القيمة (YER) *</label>
                    <input 
                      type="number"
                      required
                      placeholder="0.00"
                      className="w-full text-center font-mono font-bold p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                      value={adjustmentForm.amount}
                      onChange={(e) => setAdjustmentForm({...adjustmentForm, amount: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 block">تفصيل والسبب للتسوية الدفترية *</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="بيان الفوارق أو فجوات التدقيق بالتفصيل..."
                    className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                    value={adjustmentForm.reason}
                    onChange={(e) => setAdjustmentForm({...adjustmentForm, reason: e.target.value})}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAdj}
                  className="w-full p-3.5 bg-sky-500 hover:bg-sky-600 rounded-2xl text-black font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1"
                >
                  {isSubmittingAdj ? <Loader2 className="animate-spin" size={16} /> : "قيد وترحيل قيد التسوية فورياً"}
                </button>
              </form>
            </div>

            {/* Vouchers Archive view */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-805 rounded-3xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 dark:bg-zinc-955 px-6 py-4 border-b border-slate-100 dark:border-zinc-850 flex items-center justify-between">
                <span className="font-black text-xs md:text-sm text-gray-800 dark:text-white">أرشيف الدفاتر وسندات التسوية المالية اليومية</span>
                <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full font-bold font-mono">ARCHIVE</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50/50 dark:bg-zinc-950/20 text-[10px] text-gray-450 font-black tracking-wider uppercase border-b border-slate-100 dark:border-zinc-850">
                    <tr>
                      <th className="p-3">صندوق التسوية</th>
                      <th className="p-3">نوع التعديل</th>
                      <th className="p-3">مبلغ القيد</th>
                      <th className="p-3">منفذها</th>
                      <th className="p-3">السبب الدفتري</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                    {adjustmentVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-gray-400 font-bold">
                          لا توجد سندات تسويات مقيدة بالأرشيف السنوي.
                        </td>
                      </tr>
                    ) : (
                      adjustmentVouchers.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50/30">
                          <td className="p-3 font-bold text-gray-700 dark:text-gray-300">
                            {customBoxes.find(b => b.id === v.targetBoxId)?.boxName || 'الصندوق العام للمحل'}
                          </td>
                          <td className="p-3 text-[10px]">
                            <span className={`p-1 px-2.5 rounded-full font-bold ${v.type === 'INCREMENT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-990/40' : 'bg-rose-100 text-rose-700'}`}>
                              {v.type === 'INCREMENT' ? 'زيادة / فائض' : 'عجز / نقص'}
                            </span>
                          </td>
                          <td className="p-3 font-black text-gray-800 dark:text-white">{v.amount.toLocaleString()} YER</td>
                          <td className="p-3 text-gray-500 font-bold">{v.operatorName}</td>
                          <td className="p-3 max-w-[150px] truncate text-gray-450" title={v.reason}>{v.reason}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 3: Capital fixed assets register depreciation */}
        {activeTab === 'assets' && (
          <motion.div 
            key="assets"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Form */}
            <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-805 p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-gray-800 dark:text-white">تسجيل أصل ثابت جديد 🏭</h3>
                <p className="text-gray-400 text-xs mt-1">قيد السيادية الرأسمالية (الأجهزة، الأراضي، العقار، السيارات)</p>
              </div>

              <form onSubmit={handleCreateAsset} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 block">اسم الوصف التفصيلي للأصل *</label>
                  <input 
                    type="text"
                    required
                    placeholder="مثال: سيارة توصيل شملان، حاسوب لوحي صراف..."
                    className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({...assetForm, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 block">القيمة الشرائية (YER) *</label>
                    <input 
                      type="number"
                      required
                      placeholder="0.00"
                      className="w-full text-center font-mono font-bold p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                      value={assetForm.value}
                      onChange={(e) => setAssetForm({...assetForm, value: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 block">تاريخ الشراء والامتلاك *</label>
                    <input 
                      type="date"
                      required
                      className="w-full text-center p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                      value={assetForm.purchaseDate}
                      onChange={(e) => setAssetForm({...assetForm, purchaseDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 block">الصندوق/الخزنة الممولة للشراء *</label>
                  <select 
                    required
                    value={assetForm.deductedFromBoxId}
                    onChange={(e) => setAssetForm({...assetForm, deductedFromBoxId: e.target.value})}
                    className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {customBoxes.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.boxName} [{Number(b.balance || 0).toLocaleString()} {b.currency || 'YER'}]
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAsset}
                  className="w-full p-3.5 bg-sky-500 hover:bg-sky-600 rounded-2xl text-black font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1"
                >
                  {isSubmittingAsset ? <Loader2 className="animate-spin" size={16} /> : "تسجيل وحفظ الكلفة الرأسمالية للاصل"}
                </button>
              </form>
            </div>

            {/* List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-805 p-5 rounded-3xl shadow-sm">
                <h3 className="font-black text-sm text-gray-800 dark:text-white">الأصول الثابتة الممتلكة (مستوى الميزانية الكلية)</h3>
                <p className="text-xs text-gray-450 mt-1">حساب ورصد إهلاكات وقيمة الأصول الرأسمالية المتزايدة أو المتآكلة</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {fixedAssets.map((asset) => (
                    <div key={asset.id} className="p-4 bg-slate-50 dark:bg-zinc-955 rounded-2xl border border-slate-100 dark:border-zinc-850 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-black text-gray-800 dark:text-gray-100">{asset.name}</h4>
                          <button 
                            type="button"
                            onClick={async () => {
                              if (window.confirm("🚨 هل أنت متأكد من رغبتك بحذف وشطب السجل لهذا الأصل؟ (ملاحظة: لن يسترد الكاش المسحوب تلقائياً)")) {
                                await deleteDoc(doc(db, 'fixedAssets', asset.id));
                              }
                            }}
                            className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <span className="text-lg font-black font-mono text-sky-500 block mt-2">
                          {Number(asset.value).toLocaleString()} <span className="text-xs font-normal">YER</span>
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-zinc-850/50 text-[10px] text-gray-400 flex justify-between font-bold">
                        <span>تاريخ الشراء: {asset.purchaseDate}</span>
                        <span>ممول عبر: {customBoxes.find(b => b.id === asset.deductedFromBoxId)?.boxName || 'الصندوق العام'}</span>
                      </div>
                    </div>
                  ))}

                  {fixedAssets.length === 0 && (
                    <div className="col-span-full py-10 text-center text-gray-400 font-bold text-xs">
                      لا توجد أصول مضافة أو ممتلكات مسجلة حالياً.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 4: Cash Handovers & Transfers Between Safes with Receipt Forms */}
        {activeTab === 'transfers' && (
          <motion.div 
            key="transfers"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Form */}
            <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-805 p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-gray-800 dark:text-white">تحويل كاش بين الصناديق 🔄</h3>
                <p className="text-gray-400 text-xs mt-1">تنفيذ مناقلة مالي فوري بين خزنتين أو الفروع البنكية</p>
              </div>

              <form onSubmit={handleTransferFunds} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 block">الصندوق المالي المحول منه *</label>
                  <select 
                    required
                    value={transferForm.sourceBoxId}
                    onChange={(e) => setTransferForm({...transferForm, sourceBoxId: e.target.value})}
                    className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {customBoxes.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.boxName} [{Number(b.balance || 0).toLocaleString()} YER]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 block">الصندوق المالي المحول إليه *</label>
                  <select 
                    required
                    value={transferForm.destBoxId}
                    onChange={(e) => setTransferForm({...transferForm, destBoxId: e.target.value})}
                    className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {customBoxes.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.boxName} [{Number(b.balance || 0).toLocaleString()} YER]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 block">المبلغ المراد تحويله (YER) *</label>
                  <input 
                    type="number"
                    required
                    placeholder="0.00"
                    className="w-full text-center font-mono font-bold p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({...transferForm, amount: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 block">ملاحظات المناقلة *</label>
                  <input 
                    type="text"
                    required
                    placeholder="مثال: إيداع الكريمي الأسبوعي، عهدة عمال المعرض..."
                    className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm({...transferForm, notes: e.target.value})}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="w-full p-3.5 bg-sky-500 hover:bg-sky-600 rounded-2xl text-black font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1"
                >
                  {isSubmittingTransfer ? <Loader2 className="animate-spin" size={16} /> : "ترحيل الحوالة وتأكيد تعديل رصيد الخزائن"}
                </button>
              </form>
            </div>

            {/* Transfer archives register */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-805 rounded-3xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 dark:bg-zinc-955 px-6 py-4 border-b border-slate-100 dark:border-zinc-850 flex items-center justify-between">
                <span className="font-black text-xs md:text-sm text-gray-800 dark:text-white">سجلات المناقلات المالية والعهد المحولة وتوزيع الصراف</span>
                <span className="text-[10px] bg-sky-500/10 text-sky-500 px-2 py-0.5 rounded-full font-bold font-mono">HISTORY</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50/50 dark:bg-zinc-955 text-[10px] text-gray-450 font-black tracking-wider uppercase border-b border-slate-100 dark:border-zinc-850">
                    <tr>
                      <th className="p-3">من صندوق</th>
                      <th className="p-3">إلى صندوق</th>
                      <th className="p-3">المبلغ المحول</th>
                      <th className="p-3">البيان المكتوب</th>
                      <th className="p-3">منفذها</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                    {transfers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-gray-400 font-bold">
                          لا توجد عمليات مناقلة أرصدة مسجلة في المتجر.
                        </td>
                      </tr>
                    ) : (
                      transfers.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/30">
                          <td className="p-3 font-bold text-gray-700 dark:text-gray-300">{t.senderName}</td>
                          <td className="p-3 font-bold text-sky-500">{t.receiverName}</td>
                          <td className="p-3 font-black text-emerald-500 font-mono">{t.amount.toLocaleString()} YER</td>
                          <td className="p-3 text-gray-450 truncate max-w-[150px]" title={t.notes}>{t.notes}</td>
                          <td className="p-3 text-gray-400">{t.operatorName}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 5: Comprehensive Interactive Daily Auditing Panel */}
        {activeTab === 'daily_audits' && (
          <motion.div 
            key="daily_audits"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* 9 Button Dashboard Selector for Detailed Daily Audits */}
            <div className="bg-slate-100 dark:bg-zinc-950 p-4 border border-slate-200 dark:border-zinc-800 rounded-3xl">
              <h3 className="text-xs font-black text-slate-500 mb-3 text-right">اختر قسم الجرد التفصيلي اليومي المطلوب تدقيقه ومطابقته:</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-2">
                <button
                  type="button"
                  onClick={() => setAuditTabSelected('logs')}
                  className={`p-3 rounded-2xl font-bold text-center text-xs transition-all active:scale-95 ${
                    auditTabSelected === 'logs'
                      ? 'bg-sky-500 text-black shadow-md'
                      : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg mb-1">📋</div>
                  <span className="block truncate">جرد اللوق والحركات</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTabSelected('client')}
                  className={`p-3 rounded-2xl font-bold text-center text-xs transition-all active:scale-95 ${
                    auditTabSelected === 'client'
                      ? 'bg-sky-500 text-black shadow-md'
                      : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg mb-1">👥</div>
                  <span className="block truncate">جرد حساب عاقل العميل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTabSelected('box')}
                  className={`p-3 rounded-2xl font-bold text-center text-xs transition-all active:scale-95 ${
                    auditTabSelected === 'box'
                      ? 'bg-sky-500 text-black shadow-md'
                      : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg mb-1">🪙</div>
                  <span className="block truncate">جرد نقدية الصناديق</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTabSelected('item')}
                  className={`p-3 rounded-2xl font-bold text-center text-xs transition-all active:scale-95 ${
                    auditTabSelected === 'item'
                      ? 'bg-sky-500 text-black shadow-md'
                      : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg mb-1">📦</div>
                  <span className="block truncate">جرد وعجز الأصناف</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTabSelected('warehouse')}
                  className={`p-3 rounded-2xl font-bold text-center text-xs transition-all active:scale-95 ${
                    auditTabSelected === 'warehouse'
                      ? 'bg-sky-500 text-black shadow-md'
                      : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg mb-1">🏭</div>
                  <span className="block truncate">جرد مستودعات الفروع</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTabSelected('bank')}
                  className={`p-3 rounded-2xl font-bold text-center text-xs transition-all active:scale-95 ${
                    auditTabSelected === 'bank'
                      ? 'bg-sky-500 text-black shadow-md'
                      : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg mb-1">🏦</div>
                  <span className="block truncate">جرد البنوك والشبكات</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTabSelected('income')}
                  className={`p-3 rounded-2xl font-bold text-center text-xs transition-all active:scale-95 ${
                    auditTabSelected === 'income'
                      ? 'bg-sky-500 text-black shadow-md'
                      : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg mb-1">📈</div>
                  <span className="block truncate">جرد المقبوضات والدخل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTabSelected('expense')}
                  className={`p-3 rounded-2xl font-bold text-center text-xs transition-all active:scale-95 ${
                    auditTabSelected === 'expense'
                      ? 'bg-sky-500 text-black shadow-md'
                      : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg mb-1">📉</div>
                  <span className="block truncate">جرد المصاريف والخرج</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTabSelected('profits')}
                  className={`p-3 rounded-2xl font-bold text-center text-xs transition-all active:scale-95 ${
                    auditTabSelected === 'profits'
                      ? 'bg-sky-500 text-black shadow-md'
                      : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg mb-1">💎</div>
                  <span className="block truncate">جرد أرباح وهوامش اليوم</span>
                </button>
              </div>
            </div>

            {/* Dashboard Content Container */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
              
              {/* Header with quick report printing */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-zinc-850 pb-4">
                <div>
                  <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                    <span>
                      {auditTabSelected === 'logs' && "التقرير التفصيلي: جرد لوق وحركات الدفاتر التشغيلية 📊"}
                      {auditTabSelected === 'client' && "التقرير التفصيلي: جرد أرصدة ومديونيات العملاء والموزعين 👥"}
                      {auditTabSelected === 'box' && "التقرير التفصيلي: جرد الصناديق المتواجدة والخزائن المعتمدة 🪙"}
                      {auditTabSelected === 'item' && "التقرير التفصيلي: جرد كميات وقيم الموديلات والأصناف 📦"}
                      {auditTabSelected === 'warehouse' && "التقرير التفصيلي: جرد كود ومواقع مستودعات الفروع 🏭"}
                      {auditTabSelected === 'bank' && "التقرير التفصيلي: جرد أرصدة وتداولات البنوك ومحافظ الصرافة 🏦"}
                      {auditTabSelected === 'income' && "التقرير التفصيلي: جرد المقبوضات والدخل الكلي المتولد 📈"}
                      {auditTabSelected === 'expense' && "التقرير التفصيلي: جرد الخرج المباشر والنفقات التشغيلية 📉"}
                      {auditTabSelected === 'profits' && "التقرير التفصيلي: جرد الأرباح الصافية والمطابقة المؤداة 💎"}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    يعرض هذا التقرير تفريغاً رقمياً حيّاً للبيانات المترابطة والمدققة اليومية. من فضلك تأكد من تطابق الأرقام مع الواقع الفعلي.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const reportTitle = 
                      auditTabSelected === 'logs' ? 'جرد حركات ودفاتر النظام التشغيلية' :
                      auditTabSelected === 'client' ? 'جرد مستحقات ومطالب العملاء والموزعين' :
                      auditTabSelected === 'box' ? 'جرد كاش الخزائن وصناديق الفروع يدوياً' :
                      auditTabSelected === 'item' ? 'جرد تصفية عجز وفائض موديلات المخزن الكلية' :
                      auditTabSelected === 'warehouse' ? 'جرد وتحويل عينات مستودعات المعارض' :
                      auditTabSelected === 'bank' ? 'مطابقة ومصادقة دفاتر البنوك والتسهيلات الإلكترونية' :
                      auditTabSelected === 'income' ? 'تحصيل مداخيل ومقبوضات الكاش اليومية الكلية' :
                      auditTabSelected === 'expense' ? 'سجل تصفية المصاريف والخوارج التشغيلية للمعرض' :
                      'تصفير الميزان اليومي وتقرير الأرباح وهوامش التجزئة';

                    const printWindow = window.open('', '_blank');
                    if (!printWindow) return;

                    printWindow.document.write(`
                      <html dir="rtl" lang="ar">
                      <head>
                        <title>تقرير جرد ${reportTitle}</title>
                        <style>
                          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; font-size: 13px; color: #333; }
                          .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 25px; }
                          .header h1 { margin: 0; font-size: 20px; }
                          .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 25px; border-bottom: 1px solid #ddd; padding-bottom: 15px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                          th { background-color: #f7f7f7; font-weight: bold; }
                          .total-box { background: #333; color: white; padding: 15px; text-align: center; border-radius: 8px; font-size: 16px; font-weight: bold; margin-top: 25px; }
                          .sig-line { margin-top: 60px; display: flex; justify-content: space-between; font-weight: bold; }
                          @media print { .no-print { display: none; } }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <h1>نظام JAM System Pro لإدارة المبيعات والصيانة</h1>
                          <h2>محضر جرد وتدقيق مالي رسمي: ${reportTitle}</h2>
                          <p>تاريخ وفت الجرد: ${new Date().toLocaleString('ar-EG')} | منفذ الجرد: ${profile?.name || 'أمين الصندوق'}</p>
                        </div>
                        
                        <div class="info-grid">
                          <div><strong>المتجر / الفرع:</strong> ${profile?.shopName || 'المستودع العام'}</div>
                          <div><strong>رقم الهوية التعريفية:</strong> STORE_ID_${profile?.ownerId?.slice(-6).toUpperCase() || 'MAIN_HQ'}</div>
                          <div><strong>نوع التدقيق:</strong> جرد رقابي تفصيلي يومي (تزامني مع قاعدة الكلاود)</div>
                          <div><strong>حالة الحسابات والعهد الكلية:</strong> مطابقة وخالية من فجوات الكسور العائمة</div>
                        </div>

                        <div id="print-table-container">
                          ${document.getElementById('audit-table-print-source')?.innerHTML || 'لا توجد بيانات قابلة للطباعة حالياً.'}
                        </div>

                        <div class="sig-line">
                          <div>توقيع أمين الصندوق / منفذ الجرد: ................................</div>
                          <div>اعتماد المراجع المالي / المدير: ................................</div>
                        </div>

                        <script>
                          window.onload = function() {
                            window.print();
                          }
                        </script>
                      </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="p-2.5 px-4 bg-slate-900 dark:bg-zinc-800 text-white rounded-2xl flex items-center gap-2 font-black text-xs hover:bg-slate-800 hover:shadow-md transition-all active:scale-95"
                >
                  <Printer size={14} className="text-teal-400" />
                  <span>طباعة تقرير ومحضر جرد رسمي 🖨️</span>
                </button>
              </div>

              {/* DYNAMIC CONTENT CONTAINER FOR PRINTING */}
              <div id="audit-table-print-source" className="space-y-6">

                {/* 1. LOGS / MOVEMENTS AUDIT */}
                {auditTabSelected === 'logs' && (
                  <div className="space-y-4">
                    {/* Stat panel */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">إجمالي أعداد قيود الحركات المقيدة</span>
                        <span className="text-xl font-mono font-black text-gray-800 dark:text-white mt-1 block">{transactions.length} حركة</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">حصر المقبوضات والإيداعات المباشرة</span>
                        <span className="text-xl font-mono font-black text-emerald-500 mt-1 block">
                          +{transactions.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString()} YER
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">حصر المصاريف والخرج المباشر</span>
                        <span className="text-xl font-mono font-black text-rose-500 mt-1 block">
                          -{transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString()} YER
                        </span>
                      </div>
                    </div>

                    <div className="border border-slate-150 dark:border-zinc-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 dark:bg-zinc-955 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3">رقم تتبع المعاملة</th>
                            <th className="p-3">التصنيف</th>
                            <th className="p-3">بيان الحركة ووصف الحركة</th>
                            <th className="p-3">الصندوق المحتوي</th>
                            <th className="p-3">مبلغ القيد الدفتري</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                          {transactions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-gray-400 font-bold">لا توجد قيود سجلات لمطابقتها حالياً.</td>
                            </tr>
                          ) : (
                            transactions.map((tx) => (
                              <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/20">
                                <td className="p-3 font-mono font-bold text-gray-400">#{tx.id ? tx.id.slice(-8).toUpperCase() : 'AUTO'}</td>
                                <td className="p-3 font-bold text-gray-700 dark:text-gray-300">{tx.category || 'تصنيف مالي عام'}</td>
                                <td className="p-3 max-w-[200px] truncate text-gray-500" title={tx.description}>{tx.description}</td>
                                <td className="p-3">
                                  <span className="p-1 px-2.5 bg-slate-100 dark:bg-zinc-955 text-gray-600 rounded-md text-[10px] font-bold">
                                    {tx.boxId === 'CASH_BOX' || !tx.boxId ? 'الصندوق الرئيسي للصالات' : (customBoxes.find(b => b.id === tx.boxId)?.boxName || 'حساب بنكي فرعي')}
                                  </span>
                                </td>
                                <td className={`p-3 font-mono font-black ${tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()} YER
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. CUSTOMERS / DEBTORS AUDIT */}
                {auditTabSelected === 'client' && (
                  <div className="space-y-4">
                    {/* Stat panel */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">إجمالي أعداد الزبائن بالمكينة</span>
                        <span className="text-xl font-mono font-black text-gray-800 dark:text-white mt-1 block">{auditClients.length} عميل</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">إجمالي أموال الديون القائمة بالخارج</span>
                        <span className="text-xl font-mono font-black text-amber-500 mt-1 block">
                          {auditClients.reduce((sum, c) => sum + (Number(c.debt) || 0), 0).toLocaleString()} YER
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">أعلى زبون مدين متأخر</span>
                        <span className="text-xs font-bold text-rose-500 mt-1 block truncate">
                          {(() => {
                            const debtors = auditClients.filter(c => Number(c.debt || 0) > 0);
                            if (debtors.length === 0) return 'لا يوجد مدينين';
                            const topD = debtors.reduce((prev, current) => (Number(prev.debt) > Number(current.debt)) ? prev : current);
                            return `${topD.name} (${Number(topD.debt).toLocaleString()} YER)`;
                          })()}
                        </span>
                      </div>
                    </div>

                    <div className="border border-slate-150 dark:border-zinc-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 dark:bg-zinc-955 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3">اسم الزبون / العميل</th>
                            <th className="p-3">رقم الهاتف النشط</th>
                            <th className="p-3">الديون المستحقة الذمة</th>
                            <th className="p-3">منفذ تسجيل العقد</th>
                            <th className="p-3">تفرقة عاجلة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                          {auditClients.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-gray-400 font-bold">لا يوجد قائمة من المسجلين بتاتاً.</td>
                            </tr>
                          ) : (
                            auditClients.map((c) => (
                              <tr key={c.id || c.phone} className="hover:bg-slate-50 dark:hover:bg-zinc-950/20">
                                <td className="p-3 font-bold text-gray-800 dark:text-gray-150">{c.name}</td>
                                <td className="p-3 font-mono font-bold text-gray-500">{c.phone || 'بدون رقم'}</td>
                                <td className="p-3 font-mono font-black text-rose-500">{Number(c.debt || 0).toLocaleString()} YER</td>
                                <td className="p-3 text-slate-500 font-bold">{c.operatorName || 'الصالات الرئيسية'}</td>
                                <td className="p-3">
                                  {Number(c.debt || 0) > 0 ? (
                                    <span className="p-1 px-2 bg-rose-500/10 text-rose-500 rounded-md text-[9px] font-black">مديون ذو ذمة</span>
                                  ) : (
                                    <span className="p-1 px-2 bg-emerald-500/10 text-emerald-500 rounded-md text-[9px] font-black">حسابه مصفى</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. BOX/CASHIER AUDIT */}
                {auditTabSelected === 'box' && (
                  <div className="space-y-4">
                    {/* Stat panel */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">إجمالي كاش الصناديق والخزائن</span>
                        <span className="text-xl font-mono font-black text-emerald-500 mt-1 block">
                          {customBoxes.reduce((sum, b) => sum + (Number(b.balance) || 0), 0).toLocaleString()} YER
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">سندات الفوارق وتسويات العجز الكلي اليومي</span>
                        <span className="text-xl font-mono font-black text-purple-400 mt-1 block">
                          {adjustmentVouchers.length} تسويات مقيدة
                        </span>
                      </div>
                    </div>

                    <div className="border border-slate-150 dark:border-zinc-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 dark:bg-zinc-955 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3">اسم الخزينة الكاش</th>
                            <th className="p-3">كود ربط الدفاتر</th>
                            <th className="p-3">المستوى الدفتري (YER)</th>
                            <th className="p-3">العملة الأساسية</th>
                            <th className="p-3">إجراءات تزامنية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                          {customBoxes.map((box) => (
                            <tr key={box.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/20">
                              <td className="p-3 font-bold text-gray-800 dark:text-gray-150">{box.boxName}</td>
                              <td className="p-3 font-mono font-bold text-gray-400">{box.chartOfAccountsCode || '1100'}</td>
                              <td className="p-3 font-mono font-black text-slate-800 dark:text-white">{Number(box.balance || 0).toLocaleString()} YER</td>
                              <td className="p-3 text-sky-500 font-bold font-mono text-[10px]">{box.currency || 'YER'}</td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAuditBoxId(box.id);
                                    setIsAuditModalOpen(true);
                                  }}
                                  className="p-1 px-3 bg-teal-500 text-black text-[9px] font-black rounded-lg hover:bg-teal-600 shadow-sm"
                                >
                                  عد الدرج ومطابقة الجرد اليومي ⚖️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. ITEMS/STOCK AUDIT */}
                {auditTabSelected === 'item' && (
                  <div className="space-y-4">
                    {/* Stat panel */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">إجمالي الموديلات الكتالوجية</span>
                        <span className="text-xl font-mono font-black text-gray-800 dark:text-white mt-1 block">{auditInventory.length} صنف</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">إجمالي أعداد حبات المخازن</span>
                        <span className="text-xl font-mono font-black text-sky-500 mt-1 block">
                          {auditInventory.reduce((sum, i) => sum + (Number(i.stock) || 0), 0).toLocaleString()} حبة
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">رأسمال البضائع بسعر الكلفة</span>
                        <span className="text-xl font-mono font-black text-purple-400 mt-1 block">
                          {auditInventory.reduce((sum, i) => sum + ((Number(i.cost) || 0) * (Number(i.stock) || 0)), 0).toLocaleString()} YER
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">إجمالي القيمة السوقية (بيع)</span>
                        <span className="text-xl font-mono font-black text-emerald-500 mt-1 block">
                          {auditInventory.reduce((sum, i) => sum + ((Number(i.price) || 0) * (Number(i.stock) || 0)), 0).toLocaleString()} YER
                        </span>
                      </div>
                    </div>

                    <div className="border border-slate-150 dark:border-zinc-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 dark:bg-zinc-955 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3">اسم الموديل/القطعة</th>
                            <th className="p-3">الباركود المسجل</th>
                            <th className="p-3">التصنيف</th>
                            <th className="p-3">الكمية القائمة</th>
                            <th className="p-3">سعر الكلفة</th>
                            <th className="p-3">إجمالي الكلفة الكلية</th>
                            <th className="p-3">الهامش التقديري</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                          {auditInventory.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-gray-400 font-bold">لا توجد أصناف جرد بالمخزن حالياً.</td>
                            </tr>
                          ) : (
                            auditInventory.slice(0, 50).map((item) => {
                              const costTotal = (Number(item.cost) || 0) * (Number(item.stock) || 0);
                              const priceTotal = (Number(item.price) || 0) * (Number(item.stock) || 0);
                              const marginTotal = priceTotal - costTotal;
                              return (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/20">
                                  <td className="p-3 font-bold text-gray-800 dark:text-gray-150">{item.name}</td>
                                  <td className="p-3 font-mono text-gray-500">{item.barcode || 'بدون باركود'}</td>
                                  <td className="p-3 text-slate-400 font-bold">{item.category}</td>
                                  <td className={`p-3 font-mono font-black ${Number(item.stock || 0) < 5 ? 'text-danger bg-red-500/10' : 'text-slate-800 dark:text-white'}`}>
                                    {Number(item.stock || 0)} حبة
                                  </td>
                                  <td className="p-3 font-mono text-gray-500">{Number(item.cost || 0).toLocaleString()} YER</td>
                                  <td className="p-3 font-mono font-black text-purple-400">{costTotal.toLocaleString()} YER</td>
                                  <td className="p-3 font-mono font-black text-emerald-500">+{marginTotal.toLocaleString()} YER</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. WAREHOUSE STOPS AUDIT */}
                {auditTabSelected === 'warehouse' && (
                  <div className="space-y-4">
                    {/* List warehouses and group assets */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from(new Set(auditInventory.map(i => i.warehouseName || 'المستودع الرئيسي للصالات'))).map(whName => {
                        const whItems = auditInventory.filter(i => (i.warehouseName || 'المستودع الرئيسي للصالات') === whName);
                        const totalUnits = whItems.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);
                        const totalCost = whItems.reduce((sum, item) => sum + ((Number(item.cost) || 0) * (Number(item.stock) || 0)), 0);

                        return (
                          <div key={whName} className="p-5 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-150 flex flex-col justify-between">
                            <div>
                              <span className="p-1 px-3 bg-indigo-500/10 text-indigo-400 rounded-full text-[9px] font-black">موقع مستودع معتمد</span>
                              <h4 className="text-sm font-black text-gray-800 dark:text-gray-100 mt-2">{whName}</h4>
                              
                              <div className="grid grid-cols-2 gap-2 mt-4">
                                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100">
                                  <span className="text-[9px] text-gray-400 block font-bold">الأصناف الفردية</span>
                                  <span className="text-base font-black font-mono mt-0.5 block text-gray-750 dark:text-white">{whItems.length} صنف</span>
                                </div>
                                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100">
                                  <span className="text-[9px] text-gray-400 block font-bold">القطع الإجمالية</span>
                                  <span className="text-base font-black font-mono mt-0.5 block text-sky-500">{totalUnits} قطعة</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-205/50 flex justify-between items-center">
                              <span className="text-[9px] text-gray-400 font-bold block">القيمة الرأسمالية المخزنة</span>
                              <span className="text-sm font-black font-mono text-purple-400">{totalCost.toLocaleString()} YER</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 6. BANK ACCOUNT AUDIT */}
                {auditTabSelected === 'bank' && (
                  <div className="space-y-4">
                    {/* Stat panel */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">إجمالي الأرصدة البنكية والشبكات الرقمية</span>
                        <span className="text-xl font-mono font-black text-sky-500 mt-1 block font-mono">
                          {customBoxes.filter(b => b.type === 'bank' || b.type === 'remittance').reduce((sum, b) => sum + (Number(b.balance) || 0), 0).toLocaleString()} YER
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">عدد البنوك النشطة الممتلكة</span>
                        <span className="text-xl font-mono font-black text-gray-800 dark:text-white mt-1 block">
                          {customBoxes.filter(b => b.type === 'bank' || b.type === 'remittance').length} فروع ومحافظ
                        </span>
                      </div>
                    </div>

                    <div className="border border-slate-150 dark:border-zinc-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 dark:bg-zinc-955 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3">اسم البنك / الشبكة المعتمدة</th>
                            <th className="p-3">الرمز التعريفي المحاسبي</th>
                            <th className="p-3">الرصيد الدفتري الحالي</th>
                            <th className="p-3">العملة الأساسية</th>
                            <th className="p-3">نوع القيد المحتوي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                          {customBoxes.filter(b => b.type === 'bank' || b.type === 'remittance').map((bank) => (
                            <tr key={bank.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/20">
                              <td className="p-3 font-bold text-gray-800 dark:text-gray-150">🏦 {bank.boxName}</td>
                              <td className="p-3 font-mono font-bold text-gray-400">{bank.chartOfAccountsCode || '1100'}</td>
                              <td className="p-3 font-mono font-black text-sky-500 text-sm">{Number(bank.balance || 0).toLocaleString()} YER</td>
                              <td className="p-3 text-slate-400 font-bold font-mono">{bank.currency || 'YER'}</td>
                              <td className="p-3">
                                <span className={`p-1 px-2.5 rounded-full text-[9px] font-black ${bank.type === 'bank' ? 'bg-sky-500/10 text-sky-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                  {bank.type === 'bank' ? 'حساب رسمي مصرفي' : 'شركة حوالات محلية'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 7. INCOME AUDIT */}
                {auditTabSelected === 'income' && (
                  <div className="space-y-4">
                    {/* Stat panel */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">إجمالي المقبوضات والدخل الكلي المتولد 📈</span>
                        <span className="text-xl font-mono font-black text-emerald-500 mt-1 block">
                          {transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0).toLocaleString()} YER
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">عدد المقبوضات المستحلمة</span>
                        <span className="text-xl font-mono font-black text-gray-800 dark:text-white mt-1 block">
                          {transactions.filter(t => t.type === 'income').length} عمليات دفع وإيداع مباشرة
                        </span>
                      </div>
                    </div>

                    <div className="border border-slate-150 dark:border-zinc-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 dark:bg-zinc-955 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3">البيان وسبب القبض والمبيعات</th>
                            <th className="p-3">رقم التتبع المالي</th>
                            <th className="p-3">الصندوق المحول إليه</th>
                            <th className="p-3">التاريخ والوقت المسجل</th>
                            <th className="p-3">قيمة المقبوض اليومي (YER)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                          {transactions.filter(t => t.type === 'income').map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/20">
                              <td className="p-3">
                                <div className="font-bold text-gray-800 dark:text-white">{tx.category || 'مقبوضات عامة'}</div>
                                <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[250px]" title={tx.description}>{tx.description}</div>
                              </td>
                              <td className="p-3 font-mono text-gray-400 font-bold">#{tx.id ? tx.id.slice(-6).toUpperCase() : 'AUTO'}</td>
                              <td className="p-3">
                                <span className="p-1 px-2.5 bg-emerald-500/10 text-emerald-500 rounded-md text-[10px] font-bold">
                                  {customBoxes.find(b => b.id === tx.boxId)?.boxName || 'الصندوق الرئيسي'}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-gray-500 text-[10px]">
                                {tx.createdAt ? (typeof tx.createdAt.toDate === 'function' ? tx.createdAt.toDate().toLocaleString('ar-EG') : 'الان') : 'الآن'}
                              </td>
                              <td className="p-3 font-mono font-black text-emerald-500 text-sm">+{Number(tx.amount).toLocaleString()} YER</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 8. EXPENSE AUDIT */}
                {auditTabSelected === 'expense' && (
                  <div className="space-y-4">
                    {/* Stat panel */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">إجمالي الخوارج والنفقات المصفاة الكلية 📉</span>
                        <span className="text-xl font-mono font-black text-rose-500 mt-1 block">
                          {transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0).toLocaleString()} YER
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-955 p-4 rounded-2xl border border-slate-150">
                        <span className="text-[10px] text-gray-400 font-bold block">نفقات ومشتريات الأصول المضافة التشغيلية</span>
                        <span className="text-xl font-mono font-black text-purple-400 mt-1 block">
                          {fixedAssets.reduce((sum, a) => sum + (Number(a.value) || 0), 0).toLocaleString()} YER
                        </span>
                      </div>
                    </div>

                    <div className="border border-slate-150 dark:border-zinc-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 dark:bg-zinc-955 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3">بيان النفقة ووصف الخرج</th>
                            <th className="p-3">رقم المستند المحاسبي</th>
                            <th className="p-3">صفي المحول منه الكاش</th>
                            <th className="p-3">التاريخ والوقت المسجل</th>
                            <th className="p-3">قيمة الخارجي المستهلك (YER)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                          {transactions.filter(t => t.type === 'expense').map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/20">
                              <td className="p-3">
                                <div className="font-bold text-gray-800 dark:text-white">{tx.category || 'مصاريف تشغيلية'}</div>
                                <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[250px]" title={tx.description}>{tx.description}</div>
                              </td>
                              <td className="p-3 font-mono text-gray-400 font-bold">#{tx.id ? tx.id.slice(-6).toUpperCase() : 'AUTO'}</td>
                              <td className="p-3">
                                <span className="p-1 px-2.5 bg-rose-500/10 text-rose-500 rounded-md text-[10px] font-bold">
                                  {customBoxes.find(b => b.id === tx.boxId)?.boxName || 'الصندوق الرئيسي'}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-gray-500 text-[10px]">
                                {tx.createdAt ? (typeof tx.createdAt.toDate === 'function' ? tx.createdAt.toDate().toLocaleString('ar-EG') : 'الان') : 'الآن'}
                              </td>
                              <td className="p-3 font-mono font-black text-rose-500 text-sm">-{Number(tx.amount).toLocaleString()} YER</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 9. NET PROFITS AUDIT */}
                {auditTabSelected === 'profits' && (
                  <div className="space-y-4">
                    {/* Visual margins, cost potentials, splits */}
                    {(() => {
                      const totalIncomes = transactions.filter(t => t.type === 'income').reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0);
                      const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => FinancialMath.add(sum, Number(t.amount) || 0), 0);
                      const netProfitMargin = FinancialMath.subtract(totalIncomes, totalExpenses);
                      
                      const totalStockSalesValue = auditInventory.reduce((sum, i) => FinancialMath.add(sum, FinancialMath.multiply(Number(i.price) || 0, Number(i.stock) || 0)), 0);
                      const totalStockCostValue = auditInventory.reduce((sum, i) => FinancialMath.add(sum, FinancialMath.multiply(Number(i.cost) || 0, Number(i.stock) || 0)), 0);
                      const stockEstimatedProfitPotential = FinancialMath.subtract(totalStockSalesValue, totalStockCostValue);

                      return (
                        <>
                          {/* Premium Profit Meter Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            <div className="p-6 bg-gradient-to-tr from-zinc-900 to-slate-950 dark:border-sky-500/10 rounded-3xl border border-slate-200 shadow-sm text-right text-white">
                              <span className="p-1 px-2.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black tracking-wider select-none">صافي الربح الفوري المكتسب</span>
                              <span className="text-3xl font-mono font-black text-emerald-400 block mt-4">{netProfitMargin.toLocaleString()} YER</span>
                              <p className="text-[10px] text-gray-400 mt-2">محسوب عبر طرح المصاريف التشغيلية الكلية المباشرة من إجمالي المقبوضات.</p>
                            </div>

                            <div className="p-6 bg-gradient-to-tr from-zinc-900 to-slate-950 dark:border-purple-500/10 rounded-3xl border border-slate-200 shadow-sm text-right text-white">
                              <span className="p-1 px-2.5 bg-purple-500/20 text-purple-400 rounded-full text-[9px] font-black tracking-wider select-none">هامش ربح كتالوج البضائع</span>
                              <span className="text-3xl font-mono font-black text-purple-400 block mt-4">{stockEstimatedProfitPotential.toLocaleString()} YER</span>
                              <p className="text-[10px] text-gray-400 mt-2">القيمة السوقية المتوقعة للأرباح المترقبة عند تمام بيع قطع الغيار والسلع المتواجدة.</p>
                            </div>

                            <div className="p-6 bg-gradient-to-tr from-zinc-900 to-slate-950 dark:border-amber-500/10 rounded-3xl border border-slate-200 shadow-sm text-right text-white">
                              <span className="p-1 px-2.5 bg-amber-500/20 text-amber-400 rounded-full text-[9px] font-black tracking-wider select-none">معدل السيولة النقدية اليومية</span>
                              <span className="text-3xl font-mono font-black text-amber-400 block mt-4">
                                {(((netProfitMargin / (totalIncomes || 1)) * 100).toFixed(1))}% <span className="text-xs font-bold">ربحية</span>
                              </span>
                              <p className="text-[10px] text-gray-400 mt-2">معدل تحول الإيرادات لسيولة نقدية صافية بعد سداد مصاريف المعرض والفرع اليومية.</p>
                            </div>

                          </div>

                          <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-2xl border border-slate-150 space-y-4">
                            <h4 className="text-xs font-black text-gray-800 dark:text-white">طريقة احتساب الموازنة المعتمدة بالكتلة المحاسبية لقفل اليومية ⚖️</h4>
                            <p className="text-xs text-gray-500 leading-relaxed">
                              تم تطهير الكسور العشرية لجميع التداولات المقيدة تزامنيّاً مع محرك <strong className="text-sky-500">FinancialMath</strong>. 
                              يتم ترحيل قيد الأرباح صافية إلى صندوق المالك الرئيسي عند نهاية كل تدوير ورقة عمل كقفل محاسبي قانوني لليومية.
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

              </div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* DYNAMIC MODAL: ADD BOX Vault */}
      <AnimatePresence>
        {isAddBoxOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-250 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative text-right"
            >
              <button 
                type="button"
                onClick={() => setIsAddBoxOpen(false)}
                className="absolute left-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-850 pb-3">
                  <span className="text-xl">🏢</span>
                  <div>
                    <h3 className="text-base font-black text-gray-800 dark:text-white">تأسيس صندوق مالي / خزنة للفرع</h3>
                    <p className="text-[11px] text-gray-400">يرجى تسجيل بيانات الخزنة الجديدة أو البنك لتوزيع عهد الصرافين</p>
                  </div>
                </div>

                <form onSubmit={handleCreateBox} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 block">اسم الصندوق المالي الفرعي *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="مثال: صندوق نقد الأمانات، صراف حضرموت..."
                      className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                      value={newBox.boxName}
                      onChange={(e) => setNewBox({...newBox, boxName: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 block">رمز ربط شجرة الحسابات (Ledger Link Code) *</label>
                    <input 
                      type="text" 
                      required
                      className="w-full text-center font-mono font-bold p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                      value={newBox.chartOfAccountsCode}
                      onChange={(e) => setNewBox({...newBox, chartOfAccountsCode: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 block">نوع الصندوق *</label>
                      <select
                        value={newBox.type}
                        onChange={(e) => setNewBox({...newBox, type: e.target.value})}
                        className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="cash">صندوق نقد كاش</option>
                        <option value="bank">حساب مصرفي (بنك)</option>
                        <option value="remittance">صندوق حوالات وصرافة</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 block">العملة الأساسية *</label>
                      <select
                        value={newBox.currency}
                        onChange={(e) => setNewBox({...newBox, currency: e.target.value})}
                        className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="YER">ريال يمني (YER)</option>
                        <option value="SAR">ريال سعودي (SAR)</option>
                        <option value="USD">دولار أمريكي (USD)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 block">رصيد الافتتاح الدفتري (YER) (اختياري)</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      className="w-full text-center font-mono font-bold p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                      value={newBox.balance}
                      onChange={(e) => setNewBox({...newBox, balance: e.target.value})}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingBox}
                    className="w-full p-3.5 bg-sky-500 hover:bg-sky-600 font-black text-black text-sm rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmittingBox ? "جاري الإنشاء بحسابات كلاود..." : "تأكيد تسجيل وتأسيس الصندوق"}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DYNAMIC MODAL: COMPREHENSIVE CASHIER DRAWER AUDIT AND RECONCILATION */}
      <AnimatePresence>
        {isAuditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-250 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative text-right"
            >
              <button 
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="absolute left-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-850 pb-3">
                  <span className="text-xl">⚖️</span>
                  <div>
                    <h3 className="text-base font-black text-gray-800 dark:text-white">جرد ومطابقة رصيد الصندوق الفعلي</h3>
                    <p className="text-[11px] text-gray-400">موازنة وتعديل فوارق الدرج اليومية وتدوين العجز أو الزيادة الفعلي</p>
                  </div>
                </div>

                <form onSubmit={handleReconcileAudit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 block">اختر الصندوق المراد جرده ومطابقته *</label>
                    <select 
                      value={selectedAuditBoxId}
                      onChange={(e) => setSelectedAuditBoxId(e.target.value)}
                      className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {customBoxes.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.boxName} [الرصيد الدفتري الحالي: {Number(b.balance || 0).toLocaleString()} {b.currency || 'YER'}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 block">مبلغ الكاشير الفعلي المتواجد بالدرج (YER) *</label>
                    <input 
                      type="number"
                      required
                      placeholder="أدخل ناتج عد الكاش والفلوس يدوياً..."
                      className="w-full text-center font-mono font-black text-lg p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500"
                      value={physicalCashInput}
                      onChange={(e) => setPhysicalCashInput(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 block">ملاحظات ومقررات الجرد (عجز/زيادة بالدرج) *</label>
                    <textarea 
                      required
                      rows={3}
                      placeholder="اكتب تفاصيل أو فحص أوراق الدرج وفروقات مبيعات الصرافين..."
                      className="w-full text-right p-3 bg-slate-50 dark:bg-zinc-955 border border-slate-205 dark:border-zinc-850 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingAudit}
                    className="w-full p-4 bg-sky-500 hover:bg-sky-600 font-black text-black text-xs rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {isSubmittingAudit ? <Loader2 className="animate-spin" size={16} /> : "تسوية الفارق وتثبيت الرصيد الفعلي بالدرج"}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
