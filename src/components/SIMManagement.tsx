import { useState, useEffect, useRef, useMemo } from 'react';
import { DevicePermissionsService } from '../services/DevicePermissionsService';
import { 
  CreditCard, 
  Plus, 
  History, 
  Search, 
  X, 
  Barcode, 
  Smartphone,
  Banknote,
  DollarSign,
  Tag,
  Filter,
  TrendingUp,
  ArrowDownLeft,
  Zap,
  Camera,
  Layers,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  User,
  Users
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  where, 
  setDoc, 
  doc, 
  runTransaction,
  getDocs,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, SIMCard, Customer } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import BarcodeScanner from './BarcodeScanner';
import { InvisibleJournalEngine } from '../services/InvisibleJournalEngine';
import { employeeDebtGuardService } from '../services/employeeDebtGuardService';
import { draftVaultService } from '../services/draftVaultService';
import { UniversalReportButton } from './UniversalReportButton';
import { UniversalReportPayload } from '../services/UniversalReportService';

interface SIMManagementProps {
  profile: UserProfile | null;
}

export default function SIMManagement({ profile }: SIMManagementProps) {
  const [inventory, setInventory] = useState<SIMCard[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);

  const [generationMethod, setGenerationMethod] = useState<'sequential' | 'manual'>('sequential');
  const [manualSerials, setManualSerials] = useState<string[]>([]);
  const [currentManualInput, setCurrentManualInput] = useState('');
  const [autoAddPrefix, setAutoAddPrefix] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'sale' | 'batch_manual'>('sale');

  const handleAddManualSerial = () => {
    let cleanVal = currentManualInput.trim();
    if (!cleanVal) return;

    if (autoAddPrefix && !cleanVal.startsWith('8996711000')) {
      cleanVal = `8996711000${cleanVal}`;
    }

    if (manualSerials.includes(cleanVal)) {
      alert('تم إدخال هذا الرقم التسلسلي مسبقاً في القائمة');
      return;
    }

    // Check if it already exists in the local inventory to prevent duplicate keys in Firebase
    const isDuplicateInDb = inventory.some(s => s.serialNumber === cleanVal);
    if (isDuplicateInDb) {
      alert('هذا الرقم التسلسلي متواجد بالفعل في مخزن النظام مسبقاً');
      return;
    }

    setManualSerials([...manualSerials, cleanVal]);
    setCurrentManualInput('');
  };

  const handleCameraScan = (decodedText: string) => {
    if (cameraTarget === 'sale') {
      setSaleData(prev => ({ ...prev, simSerial: decodedText }));
    } else if (cameraTarget === 'batch_manual') {
      let cleanVal = decodedText.trim();
      if (!cleanVal) return;
      if (autoAddPrefix && !cleanVal.startsWith('8996711000')) {
        cleanVal = `8996711000${cleanVal}`;
      }
      if (manualSerials.includes(cleanVal)) {
        alert('تم إدخال هذا الرقم التسلسلي مسبقاً في القائمة');
        return;
      }
      const isDuplicateInDb = inventory.some(s => s.serialNumber === cleanVal);
      if (isDuplicateInDb) {
        alert('هذا الرقم التسلسلي متواجد بالفعل في مخزن النظام مسبقاً');
        return;
      }
      setManualSerials(prev => [...prev, cleanVal]);
    }
  };
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  
  const [batchConfig, setBatchConfig] = useState({
    type: 'NEW' as 'NEW' | 'REPLACEMENT',
    simType: '4G',
    provider: 'Yemen Mobile',
    purchasePrice: '',
    salesPrice: '',
    purchasePriceNew: '',
    purchasePriceReplacement: '',
    salesPriceNew: '',
    salesPriceReplacement: '',
    startVariableSerial: '',
    qty: 1
  });

  const [saleData, setSaleData] = useState({
    simSerial: '',
    isCash: true,
    buyerId: '',
    buyerType: 'customer' as 'customer' | 'employee',
  });

  // 💾 محرك استرجاع مسودة توريد الشرائح والبيع (DraftVault)
  useEffect(() => {
    const restoreSimDrafts = async () => {
      const storeId = profile?.ownerId || 'default_store';
      const userId = profile?.uid || 'default_user';
      try {
        const batchDraft = await draftVaultService.getDraft(storeId, userId, 'sim_batch_input_draft');
        if (batchDraft) {
          if (batchDraft.batchConfig) setBatchConfig(batchDraft.batchConfig);
          if (Array.isArray(batchDraft.manualSerials) && batchDraft.manualSerials.length > 0) {
            setManualSerials(batchDraft.manualSerials);
          }
          if (batchDraft.generationMethod) setGenerationMethod(batchDraft.generationMethod);
        }
      } catch (err) {
        console.warn('Could not restore SIM batch draft:', err);
      }
    };
    restoreSimDrafts();
  }, [profile]);

  // 💾 حفظ مسودة إدخال الشرائح لحظياً
  useEffect(() => {
    const storeId = profile?.ownerId || 'default_store';
    const userId = profile?.uid || 'default_user';
    if (manualSerials.length > 0 || batchConfig.startVariableSerial || batchConfig.purchasePrice) {
      draftVaultService.saveDraft(storeId, userId, 'sim_batch_input_draft', {
        batchConfig,
        manualSerials,
        generationMethod,
        updatedAt: Date.now()
      });
    } else {
      draftVaultService.clearDraft(storeId, userId, 'sim_batch_input_draft');
    }
  }, [batchConfig, manualSerials, generationMethod, profile]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'purchase') {
      setIsBatchModalOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!profile?.ownerId) return;

    // SIM Inventory
    const qInv = query(
      collection(db, 'sim_inventory'), 
      where('ownerId', '==', profile.ownerId),
      orderBy('createdAt', 'desc')
    );
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SIMCard)));
    });

    // SIM Transactions (Legacy/Log)
    const qTrans = query(
      collection(db, 'simTransactions'), 
      where('ownerId', '==', profile.ownerId),
      orderBy('createdAt', 'desc')
    );
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Customers
    const unsubCust = onSnapshot(query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId)), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    // Employees
    const unsubEmp = onSnapshot(query(collection(db, 'users'), where('ownerId', '==', profile.ownerId)), (snap) => {
      setEmployees(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    return () => {
      unsubInv();
      unsubTrans();
      unsubCust();
      unsubEmp();
    };
  }, [profile]);

  const availableCount = inventory.filter(s => s.status === 'AVAILABLE').length;
  const soldCount = inventory.filter(s => s.status === 'SOLD').length;
  
  const simFinancialStats = useMemo(() => {
    let availableCost = 0;
    let availablePrice = 0;
    let soldRevenue = 0;
    let soldProfit = 0;
    
    const providerCounts: { [key: string]: number } = {
      'Yemen Mobile': 0,
      'YOU': 0,
      'Sabafon': 0,
      'Y': 0,
    };

    inventory.forEach(sim => {
      const buy = parseFloat(sim.purchasePrice as any) || 0;
      const sell = parseFloat(sim.salesPrice as any) || 0;
      
      if (sim.status === 'AVAILABLE') {
        availableCost += buy;
        availablePrice += sell;
        
        const prov = sim.provider || 'Yemen Mobile';
        providerCounts[prov] = (providerCounts[prov] || 0) + 1;
      } else if (sim.status === 'SOLD') {
        soldRevenue += sell;
        soldProfit += (sell - buy);
      }
    });

    return { availableCost, availablePrice, soldRevenue, soldProfit, providerCounts };
  }, [inventory]);
  
  // Revised generateSimBatch supporting sequential or custom list modes
  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || isProcessing) return;
    
    const qty = generationMethod === 'sequential' ? Number(batchConfig.qty) : manualSerials.length;
    if (qty <= 0) {
      alert('الرجاء إدخال رقم تسلسلي واحد على الأقل أو تحديد كمية صالحة');
      return;
    }

    setIsProcessing(true);
    try {
      const prefix = "8996711000";
      const startNum = parseInt(batchConfig.startVariableSerial || '0');
      
      const purchasePriceNew = parseFloat(Number(batchConfig.purchasePriceNew || batchConfig.purchasePrice || 0).toFixed(4));
      const purchasePriceReplacement = parseFloat(Number(batchConfig.purchasePriceReplacement || batchConfig.purchasePrice || 0).toFixed(4));
      const salesPriceNew = parseFloat(Number(batchConfig.salesPriceNew || batchConfig.salesPrice || 0).toFixed(4));
      const salesPriceReplacement = parseFloat(Number(batchConfig.salesPriceReplacement || batchConfig.salesPrice || 0).toFixed(4));

      const purchasePrice = batchConfig.type === 'NEW' ? purchasePriceNew : purchasePriceReplacement;
      const salesPrice = batchConfig.type === 'NEW' ? salesPriceNew : salesPriceReplacement;
      
      const serialsToCreate = generationMethod === 'sequential' 
        ? Array.from({ length: qty }).map((_, i) => `${prefix}${(startNum + i).toString()}`)
        : manualSerials;

      for (const fullSerial of serialsToCreate) {
        const simDocRef = doc(db, "sim_inventory", fullSerial);

        await setDoc(simDocRef, {
          ownerId: profile.ownerId,
          serialNumber: fullSerial,
          barcode: fullSerial,
          type: batchConfig.type,
          simType: batchConfig.simType,
          provider: batchConfig.provider,
          purchasePrice,
          salesPrice,
          purchasePriceNew,
          purchasePriceReplacement,
          salesPriceNew,
          salesPriceReplacement,
          status: "AVAILABLE",
          createdAt: serverTimestamp()
        });
      }

      // Record as one big purchase transaction in accounts
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile.ownerId,
        type: 'expense',
        amount: purchasePrice * qty,
        category: 'sim_cards_purchase',
        description: `شراء دفعة شرائح (${qty}) - ${batchConfig.provider} ${batchConfig.simType}`,
        userId: profile.uid,
        userName: profile.name,
        createdAt: serverTimestamp()
      });

      // Trigger the Invisible Journal Engine to post double-entry ledger entries for SIM purchase
      if (profile?.ownerId) {
        const sId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
        InvisibleJournalEngine.postSIMTransactionToLedger({
          ownerId: profile.ownerId,
          type: 'purchase',
          qty,
          purchasePrice,
          salesPrice,
          provider: batchConfig.provider,
          simType: batchConfig.simType,
          paymentMethod: 'cash', // Standard purchase from cash box
          storeId: sId,
          isDryRun: false
        }).catch(err => console.warn('Invisible Journal failed to post SIM purchase:', err));
      }

      setIsBatchModalOpen(false);
      setBatchConfig({ ...batchConfig, startVariableSerial: '', qty: 1 });
      setManualSerials([]);
      alert('تم توليد وحفظ الدفعة بنجاح');
    } catch (error) {
      console.error(error);
      alert('فشل توليد الدفعة');
    } finally {
      setIsProcessing(false);
    }
  };

  // Revised processSimSale
  const handleProcessSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || !saleData.simSerial || isProcessing) return;

    const sim = inventory.find(s => s.serialNumber === saleData.simSerial || s.barcode === saleData.simSerial);
    if (!sim || sim.status !== 'AVAILABLE') {
      alert('الشريحة غير متوفرة أو تم بيعها مسبقاً');
      return;
    }

    if (!saleData.isCash && profile?.role !== 'manager' && profile?.role !== 'superadmin' && profile?.role !== 'owner') {
      const currentUsername = profile?.username || profile?.uid || 'employee';
      const debtGuardCheck = employeeDebtGuardService.canEmployeeIssueCredit(currentUsername, sim.salesPrice);
      if (!debtGuardCheck.allowed) {
        alert(`⛔ منع إدانة بيع الشريحة على مسؤولية الموظف:\n\n${debtGuardCheck.reason}`);
        return;
      }
    }

    setIsProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const simRef = doc(db, "sim_inventory", sim.id);
        const buyerRef = doc(db, saleData.buyerType === 'customer' ? 'customers' : 'users', saleData.buyerId);
        
        const price = sim.salesPrice;

        if (saleData.isCash) {
          // Record income transaction (Cash Sales)
          const transRef = doc(collection(db, 'transactions'));
          transaction.set(transRef, {
            ownerId: profile.ownerId,
            type: 'income',
            amount: price,
            category: 'sim_cards_sale',
            description: `بيع فوري شريحة (${sim.serialNumber}) - ${sim.provider}`,
            userId: profile.uid,
            userName: profile.name,
            createdAt: serverTimestamp()
          });
        } else {
          // Credit Sale: Update debt
          const buyerSnap = await transaction.get(buyerRef);
          if (!buyerSnap.exists()) throw new Error("الحساب المالي للطرف المشتري غير موجود");
          
          const currentDebt = buyerSnap.data().debt || 0;
          transaction.update(buyerRef, { debt: parseFloat((currentDebt + price).toFixed(4)) });
          
          // Still record a non-cash transaction for reporting
          const transRef = doc(collection(db, 'transactions'));
          transaction.set(transRef, {
            ownerId: profile.ownerId,
            type: 'income',
            amount: price,
            category: 'sim_cards_sale_credit',
            description: `بيع آجل شريحة (${sim.serialNumber}) لـ ${saleData.buyerType === 'customer' ? 'عميل' : 'موظف'} - ${sim.provider}`,
            userId: profile.uid,
            userName: profile.name,
            paymentMethod: 'debt',
            createdAt: serverTimestamp()
          });
        }

        // Update SIM
        transaction.update(simRef, { 
          status: "SOLD", 
          soldAt: serverTimestamp(), 
          buyerId: saleData.buyerId,
          buyerType: saleData.buyerType
        });
      });

      // Trigger the Invisible Journal Engine to post double-entry ledger entries for SIM sale
      if (profile?.ownerId) {
        const sId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
        InvisibleJournalEngine.postSIMTransactionToLedger({
          ownerId: profile.ownerId,
          type: 'sale',
          qty: 1,
          purchasePrice: sim.purchasePrice || 0,
          salesPrice: sim.salesPrice || 0,
          provider: sim.provider,
          simType: sim.type || 'NEW',
          serialNumber: sim.serialNumber,
          paymentMethod: saleData.isCash ? 'cash' : 'debt',
          storeId: sId,
          isDryRun: false
        }).catch(err => console.warn('Invisible Journal failed to post SIM sale:', err));
      }

      if (!saleData.isCash) {
        const currentUsername = profile?.username || profile?.uid || 'employee';
        employeeDebtGuardService.recordCreditIssued({
          employeeUsername: currentUsername,
          employeeName: profile?.name || currentUsername,
          customerName: saleData.buyerType === 'customer' ? 'عميل شريحة' : 'موظف',
          amount: sim.salesPrice,
          orderId: `SIM-${sim.serialNumber}`,
          notes: `بيع آجل شريحة (${sim.serialNumber}) - ${sim.provider}`
        });
      }

      setIsSaleModalOpen(false);
      setSaleData({ simSerial: '', isCash: true, buyerId: '', buyerType: 'customer' });
      alert('تمت عملية البيع بنجاح');
    } catch (error: any) {
      console.error(error);
      alert('فشل عملية البيع: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.serialNumber.includes(searchTerm) || 
    item.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Dynamic Master Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-navy-700 pb-6">
        <div className="text-right">
          <h2 className="text-2xl font-black text-navy-900 dark:text-white flex items-center gap-2">
            <Smartphone className="text-brand-primary animate-pulse" />
            منصة مبيعات ومخزن الشرائح الموحدة
          </h2>
          <p className="text-xs text-gray-500 mt-1">إدارة شاملة لعمليات مبيع شرائح الاتصال المباشر مع مستودع الحفظ الذكي</p>
        </div>
        
        {/* Quick Utilities */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsBatchModalOpen(true)}
            className="px-5 py-2.5 bg-brand-primary text-white text-xs font-black rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-105 transition-transform flex items-center gap-2"
          >
            <Layers size={16} />
            توليد دفعة شرائح تلقائية
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card-glass p-5 flex items-center justify-between border-r-4 border-r-brand-primary">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
              <Smartphone size={24} />
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-400 font-bold uppercase">المخزون المتوفر بالخزنة</p>
              <p className="text-xl font-black text-navy-900 dark:text-white mt-0.5">{availableCount} شريحة</p>
            </div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }} className="card-glass p-5 flex items-center justify-between border-r-4 border-r-success">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-success/10 text-success rounded-xl flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-400 font-bold uppercase">الشرائح المباعة سابقاً</p>
              <p className="text-xl font-black text-navy-900 dark:text-white mt-0.5">{soldCount} شريحة</p>
            </div>
          </div>
          <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded">كاش وآجل</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="card-glass p-5 flex items-center justify-between border-r-4 border-r-warning">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-warning/10 text-warning rounded-xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-400 font-bold uppercase">إجمالي قيود العمليات</p>
              <p className="text-xl font-black text-navy-900 dark:text-white mt-0.5">{inventory.length} شريحة</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-warning">{transactions.length} لوج</span>
        </motion.div>
      </div>

      {/* Side-by-Side Dual POS and Inventory Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (col-span-5): Live SIM Sales POS Panel (منصة البيع الفوري السريع للأربع تسعيرات) */}
        <div className="lg:col-span-5 card-glass border border-brand-primary/10 dark:border-white/5 shadow-xl p-6 space-y-6 text-right">
          <div className="border-b border-gray-100 dark:border-navy-700 pb-3 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded">لوحة تحكم POS</span>
            <h3 className="text-lg font-black text-navy-900 dark:text-white flex items-center gap-2">
              <Zap className="text-brand-primary animate-pulse" size={18} />
              منصة البيع والمبيع الفوري
            </h3>
          </div>

          <form onSubmit={handleProcessSale} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500">سيريال الشريحة المراد بيعها</label>
              <div className="relative flex items-center">
                <Barcode className="absolute right-4 text-gray-400" size={20} />
                <input 
                  autoFocus 
                  required 
                  type="text" 
                  className="w-full pr-12 pl-12 py-3 bg-gray-50 dark:bg-navy-900 border border-transparent focus:border-brand-primary/50 rounded-2xl outline-none font-mono font-bold text-sm text-right" 
                  placeholder="اختر شريحة من المخزن أو اكتب السيريال" 
                  value={saleData.simSerial} 
                  onChange={(e) => setSaleData({...saleData, simSerial: e.target.value})} 
                />
                <button
                  type="button"
                  onClick={async () => {
                    const granted = await DevicePermissionsService.requestOnDemand('camera');
                    if (granted) {
                      setCameraTarget('sale');
                      setIsCameraOpen(true);
                    }
                  }}
                  className="absolute left-3 p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg transition-colors cursor-pointer"
                  title="مسح باستخدام الكاميرا"
                >
                  <Camera size={20} />
                </button>
              </div>
              <p className="text-[10px] text-gray-400">💡 يمكنك النقر على زر الصاعقة ⚡ بجانب أي شريحة متوفرة لإدراجها هنا فوراً.</p>
            </div>

            {/* If selected or recognized, show details & pricing summary in Real-time */}
            {(() => {
              const matchedSim = inventory.find(s => s.serialNumber === saleData.simSerial || s.barcode === saleData.simSerial);
              if (!matchedSim) return null;
              return (
                <div className="p-4 bg-brand-primary/5 dark:bg-brand-primary/10 rounded-2xl border border-dashed border-brand-primary/30 space-y-2 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-brand-primary">{matchedSim.provider}</span>
                    <span className="text-gray-400 font-mono">تفاصيل الشريحة المختارة:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-black/5 dark:border-white/5">
                    <div>
                      <span className="text-gray-400">النوع: </span>
                      <span className="font-bold">{matchedSim.type === 'NEW' ? 'جديدة' : 'بدل فاقد'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">التكلفة: </span>
                      <span className="font-bold text-rose-500">{matchedSim.purchasePrice} ر.ي</span>
                    </div>
                    <div className="col-span-2 text-left pt-1 font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      سعر البيع: {matchedSim.salesPrice} ر.ي
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button" 
                onClick={() => setSaleData({...saleData, isCash: true})}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${saleData.isCash ? 'border-success bg-success/5 text-success' : 'border-gray-100 dark:border-navy-700 text-gray-400'}`}
              >
                <Banknote size={20} />
                <span className="text-xs font-black">بيع نقداً (كاش)</span>
              </button>
              <button 
                type="button" 
                onClick={() => setSaleData({...saleData, isCash: false})}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${!saleData.isCash ? 'border-warning bg-warning/5 text-warning' : 'border-gray-100 dark:border-navy-700 text-gray-400'}`}
              >
                <Tag size={20} />
                <span className="text-xs font-black">بيع آجل (دين)</span>
              </button>
            </div>

            {/* Buyer Account details if Credit */}
            {!saleData.isCash && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 text-right">
                <div className="flex gap-2 bg-gray-50 dark:bg-navy-900 p-1 rounded-xl">
                  <button 
                    type="button" 
                    onClick={() => setSaleData({...saleData, buyerType: 'customer', buyerId: ''})}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${saleData.buyerType === 'customer' ? 'bg-navy-900 text-white shadow-sm' : 'text-gray-400'}`}
                  >
                    أجل لعميل
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setSaleData({...saleData, buyerType: 'employee', buyerId: ''})}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${saleData.buyerType === 'employee' ? 'bg-navy-900 text-white shadow-sm' : 'text-gray-400'}`}
                  >
                    أجل لموظف
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-500">اختر حساب الدائن بالسيستم</label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select 
                      required 
                      className="w-full pr-10 pl-4 py-2.5 bg-gray-50 dark:bg-navy-900 border border-transparent rounded-xl outline-none text-xs font-bold" 
                      value={saleData.buyerId} 
                      onChange={(e) => setSaleData({...saleData, buyerId: e.target.value})}
                    >
                      <option value="">-- اختر الحساب الدائن --</option>
                      {saleData.buyerType === 'customer' ? (
                        customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                      ) : (
                        employees.map(e => <option key={e.uid} value={e.uid}>{e.name}</option>)
                      )}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Confirm Sale Button */}
            <button 
              disabled={isProcessing || !saleData.simSerial}
              type="submit" 
              className="w-full py-4 text-white bg-brand-primary disabled:opacity-40 rounded-2xl font-black text-sm transition-all hover:shadow-xl hover:shadow-brand-primary/20 flex items-center justify-center gap-2"
            >
              {isProcessing ? 'جاري ترحيل المبيع المباشر الحسابي...' : 'ترحيل وبث عملية البيع للحسابات'}
            </button>
          </form>
        </div>

        {/* Right Column (col-span-7): SIM Storage Vault (مخزن وخزنة حفظ وتوزيع الشرائح) */}
        <div className="lg:col-span-7 card-glass overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-navy-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-right">
              <h3 className="text-base font-black flex items-center gap-2">
                <Smartphone className="text-brand-primary animate-pulse" size={20} />
                مستودع وخزانة حفظ الشرائح الرقمية
              </h3>
              <span className="text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full inline-block mt-1">
                القسم المعزول: SIM Cards Warehouse 🔒
              </span>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <UniversalReportButton
                variant="emerald"
                buttonText="تقرير الشرائح"
                payload={{
                  title: 'تقرير خزانة ومخزون الشرائح الرقمية (SIM Cards)',
                  subtitle: 'كشف تفصيلي بحركة وسيريالات وأسعار الشرائح والشبكات',
                  currency: 'ر.ي',
                  summaryCards: [
                    { label: 'إجمالي الشرائح المسجلة', value: inventory.length, currency: 'شريحة', color: 'blue' },
                    { label: 'الشرائح المتوفرة للبيع', value: inventory.filter(s => s.status === 'AVAILABLE' || (s.status as string) === 'available').length, currency: 'شريحة', color: 'green' },
                    { label: 'الشرائح المباعة', value: inventory.filter(s => s.status === 'SOLD' || (s.status as string) === 'sold').length, currency: 'شريحة', color: 'purple' },
                    { label: 'إجمالي رأس مال الشرائح', value: inventory.reduce((sum, s) => sum + (Number(s.purchasePrice || (s as any).buyPrice) || 0), 0).toLocaleString(), currency: 'ر.ي', color: 'amber' }
                  ],
                  columns: [
                    { key: 'serialNumber', header: 'الرقم التسلسلي (السيريال)', type: 'text', width: 22 },
                    { key: 'provider', header: 'الشركة / الشبكة', type: 'text', width: 16 },
                    { key: 'type', header: 'نوع الخط', type: 'text', width: 14, formatter: (val) => val === 'NEW' ? 'جديدة' : val === 'REPLACEMENT' ? 'بدل فاقد' : val || '-' },
                    { key: 'purchasePrice', header: 'سعر الشراء والتكلفة', type: 'currency', width: 15 },
                    { key: 'salesPrice', header: 'سعر البيع المعتمد', type: 'currency', width: 15 },
                    { key: 'status', header: 'الحالة', type: 'text', width: 12, formatter: (val) => val === 'AVAILABLE' ? 'متوفرة بالخزنة' : 'مباعة' }
                  ],
                  data: filteredInventory.length > 0 ? filteredInventory : inventory
                }}
              />
              <div className="relative flex-1 md:w-64">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="بحث بسيريال الشريحة..." 
                  className="w-full pr-10 pl-4 py-2 bg-gray-50 dark:bg-navy-900 rounded-xl outline-none text-xs text-right"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50 dark:bg-navy-800 text-gray-400 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-4">السيريال / الباركود</th>
                  <th className="p-4">الشركة</th>
                  <th className="p-4">النوع</th>
                  <th className="p-4 text-left">الشراء</th>
                  <th className="p-4 text-left">البيع</th>
                  <th className="p-4 text-center">الحالة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs text-gray-400 font-bold">
                      لا توجد شرائح متطابقة في الخزنة حالياً
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((sim) => (
                    <tr key={sim.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Barcode size={14} className="text-gray-400" />
                          <span className="font-mono font-bold text-xs tracking-tighter text-navy-900 dark:text-white">{sim.serialNumber}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs font-bold text-gray-600 dark:text-gray-300">{sim.provider}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black ${sim.type === 'NEW' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-warning/10 text-warning'}`}>
                          {sim.type === 'NEW' ? 'جديدة' : 'بدل فاقد'} ({sim.simType})
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs text-danger text-left">{sim.purchasePrice} ر.ي</td>
                      <td className="p-4 font-mono text-xs font-bold text-success text-left">{sim.salesPrice} ر.ي</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${sim.status === 'AVAILABLE' ? 'bg-success/10 text-success animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
                          {sim.status === 'AVAILABLE' ? 'متوفرة بالدرج' : 'مباعة'}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-center">
                        {sim.status === 'AVAILABLE' && (
                          <button 
                            type="button"
                            onClick={() => {
                              setSaleData({ ...saleData, simSerial: sim.serialNumber });
                              // Highlight or focus the form input
                              const input = document.querySelector('input[placeholder*="اكتب السيريال"]');
                              if (input) (input as HTMLInputElement).focus();
                            }}
                            title="إدراج في لوحة المبيعات الفورية"
                            className="p-1.5 hover:bg-brand-primary/10 text-brand-primary rounded-lg transition-colors inline-flex justify-center items-center ml-1"
                          >
                            <Zap size={15} />
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={async () => {
                            if (window.confirm('حذف الشريحة نهائياً ومسحها من خزانة الحفظ؟')) {
                              await deleteDoc(doc(db, 'sim_inventory', sim.id));
                            }
                          }}
                          className="p-1.5 hover:bg-danger/10 text-danger rounded-lg transition-colors inline-flex justify-center items-center"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Batch Generation Modal */}
      <AnimatePresence>
        {isBatchModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBatchModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between font-black text-right">
                <h3 className="text-xl">توليد دفعة شرائح ذكية</h3>
                <button onClick={() => setIsBatchModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleGenerateBatch} className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-field">نوع الدفعة</label>
                    <select className="input-field" value={batchConfig.type} onChange={(e) => setBatchConfig({...batchConfig, type: e.target.value as any})}>
                      <option value="NEW">شرائح جديدة</option>
                      <option value="REPLACEMENT">بدل فاقد</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label-field">شركة الاتصالات</label>
                    <select className="input-field" value={batchConfig.provider} onChange={(e) => setBatchConfig({...batchConfig, provider: e.target.value})}>
                      <option>Yemen Mobile</option>
                      <option>Sabafon</option>
                      <option>YOU</option>
                      <option>Y</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label-field">طريقة توليد الدفعة</label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-navy-900 p-1 rounded-xl">
                    <button 
                      type="button" 
                      onClick={() => setGenerationMethod('sequential')}
                      className={`py-1.5 rounded-lg text-xs font-black transition-all ${generationMethod === 'sequential' ? 'bg-navy-900 text-white shadow-sm' : 'text-gray-400 hover:text-navy-900 dark:hover:text-white'}`}
                    >
                      توليد تسلسلي تلقائي 🔢
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setGenerationMethod('manual')}
                      className={`py-1.5 rounded-lg text-xs font-black transition-all ${generationMethod === 'manual' ? 'bg-navy-900 text-white shadow-sm' : 'text-gray-400 hover:text-navy-900 dark:hover:text-white'}`}
                    >
                      إدخال يدوي مخصص ✍️
                    </button>
                  </div>
                </div>

                {generationMethod === 'sequential' ? (
                  <>
                    <div className="space-y-2">
                      <label className="label-field">بداية السلسلة المتغيرة (بعد 8996711000)</label>
                      <input required type="text" className="input-field font-mono" placeholder="مثلاً: 0001" value={batchConfig.startVariableSerial} onChange={(e) => setBatchConfig({...batchConfig, startVariableSerial: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="label-field">الكمية</label>
                        <input required type="number" min="1" className="input-field" value={batchConfig.qty} onChange={(e) => setBatchConfig({...batchConfig, qty: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <label className="label-field">نوع الشبكة</label>
                        <select className="input-field" value={batchConfig.simType} onChange={(e) => setBatchConfig({...batchConfig, simType: e.target.value})}>
                          <option>4G</option>
                          <option>VolTE</option>
                          <option>3G</option>
                          <option>eSIM</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Manual entry view */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-bold">مجموع المدخلات: {manualSerials.length} شريحة</span>
                        <label className="label-field">إدخال الأرقام التسلسلية يدوياً</label>
                      </div>
                      <div className="relative flex items-center">
                        <Barcode className="absolute right-3 text-gray-400" size={18} />
                        <input 
                          type="text" 
                          className="input-field pr-10 pl-24 font-mono text-right font-bold" 
                          placeholder="اكتب السيريال واضغط Enter" 
                          value={currentManualInput} 
                          onChange={(e) => setCurrentManualInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddManualSerial();
                            }
                          }}
                        />
                        <div className="absolute left-1.5 flex gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              const granted = await DevicePermissionsService.requestOnDemand('camera');
                              if (granted) {
                                setCameraTarget('batch_manual');
                                setIsCameraOpen(true);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-brand-primary bg-gray-100 dark:bg-navy-700 rounded-lg transition-colors cursor-pointer"
                            title="مسح بالكاميرا"
                          >
                            <Camera size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={handleAddManualSerial}
                            className="px-2.5 py-1 text-[11px] bg-brand-primary text-white font-black rounded-lg transition-all hover:brightness-110 active:scale-95"
                          >
                            إضافة
                          </button>
                        </div>
                      </div>
                      
                      {/* Yemen mobile prefix helper toggle */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-[10px] text-gray-400">سيريال كامل أو بادئة</span>
                        <label className="flex items-center gap-1 cursor-pointer select-none">
                          <span className="text-[11px] text-gray-500 font-bold">تلقائي (8996711000)</span>
                          <input 
                            type="checkbox" 
                            checked={autoAddPrefix} 
                            onChange={(e) => setAutoAddPrefix(e.target.checked)}
                            className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Display entered serials list */}
                    {manualSerials.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <button 
                            type="button" 
                            onClick={() => {
                              if (window.confirm('هل تريد مسح جميع الأرقام المدخلة؟')) setManualSerials([]);
                            }}
                            className="text-[10px] text-rose-500 font-bold hover:underline"
                          >
                            حذف الكل
                          </button>
                          <span className="text-[11px] font-bold text-gray-500">قائمة الشرائح المضافة حالياً:</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto border border-gray-100 dark:border-navy-700 rounded-xl p-2 bg-gray-50/50 dark:bg-navy-900/30 space-y-1">
                          {manualSerials.map((serial, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white dark:bg-navy-800 px-3 py-1.5 rounded-lg border border-black/5 text-xs font-mono">
                              <button 
                                type="button" 
                                onClick={() => setManualSerials(manualSerials.filter((_, i) => i !== idx))}
                                className="text-rose-500 hover:text-rose-700 font-black"
                              >
                                ✕
                              </button>
                              <div className="flex items-center gap-1.5">
                                <span className="text-gray-400 text-[10px]">#{idx + 1}</span>
                                <span className="font-bold text-gray-700 dark:text-gray-200">{serial}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="label-field">نوع الشبكة</label>
                      <select className="input-field" value={batchConfig.simType} onChange={(e) => setBatchConfig({...batchConfig, simType: e.target.value})}>
                        <option>4G</option>
                        <option>VolTE</option>
                        <option>3G</option>
                        <option>eSIM</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="border border-white/10 dark:border-navy-700/50 rounded-2xl p-4 bg-gray-50/50 dark:bg-navy-900/40 space-y-4">
                  <span className="text-xs font-black text-brand-primary block text-right border-b border-black/5 dark:border-white/5 pb-1">أسعار وتكاليف الشرائح التفصيلية</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="label-field !text-[11px] text-emerald-500 font-bold">سعر الشراء جديد</label>
                      <input required type="number" step="0.01" className="input-field font-bold border-emerald-500/20 text-emerald-600 dark:text-emerald-400" placeholder="0" value={batchConfig.purchasePriceNew} onChange={(e) => setBatchConfig({...batchConfig, purchasePriceNew: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="label-field !text-[11px] text-amber-500 font-bold">سعر البيع جديد</label>
                      <input required type="number" step="0.01" className="input-field font-bold border-amber-500/20 text-amber-600 dark:text-amber-400" placeholder="0" value={batchConfig.salesPriceNew} onChange={(e) => setBatchConfig({...batchConfig, salesPriceNew: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="label-field !text-[11px] text-rose-500 font-bold">الشراء بدل فاقد</label>
                      <input required type="number" step="0.01" className="input-field font-bold border-rose-500/20 text-rose-600 dark:text-rose-400" placeholder="0" value={batchConfig.purchasePriceReplacement} onChange={(e) => setBatchConfig({...batchConfig, purchasePriceReplacement: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="label-field !text-[11px] text-yellow-500 font-bold">البيع بدل فاقد</label>
                      <input required type="number" step="0.01" className="input-field font-bold border-yellow-500/20 text-yellow-600 dark:text-yellow-400" placeholder="0" value={batchConfig.salesPriceReplacement} onChange={(e) => setBatchConfig({...batchConfig, salesPriceReplacement: e.target.value})} />
                    </div>
                  </div>
                </div>

                <button 
                  disabled={isProcessing}
                  type="submit" 
                  className="btn-primary w-full py-5 text-xl bg-navy-900 disabled:opacity-50"
                >
                  {isProcessing ? 'جاري التوليد...' : 'بدء التوليد التلقائي'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sale Modal */}
      <AnimatePresence>
        {isSaleModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSaleModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-brand-primary text-white flex items-center justify-between font-black text-right">
                <h3 className="text-xl">بيع شريحة فوري</h3>
                <button onClick={() => setIsSaleModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleProcessSale} className="p-8 space-y-6">
                <div className="space-y-2 text-right">
                  <label className="label-field">سكان الباركود / السيريال</label>
                  <div className="relative flex items-center">
                    <Barcode className="absolute right-4 text-gray-400" size={20} />
                    <input 
                      autoFocus 
                      required 
                      type="text" 
                      className="w-full pr-12 pl-12 py-3 bg-gray-50 dark:bg-navy-900 border border-transparent focus:border-brand-primary/50 rounded-2xl outline-none font-mono font-bold text-sm text-right" 
                      placeholder="سيريال الشريحة" 
                      value={saleData.simSerial} 
                      onChange={(e) => setSaleData({...saleData, simSerial: e.target.value})} 
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const granted = await DevicePermissionsService.requestOnDemand('camera');
                        if (granted) {
                          setCameraTarget('sale');
                          setIsCameraOpen(true);
                        }
                      }}
                      className="absolute left-3 p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg transition-colors cursor-pointer"
                      title="مسح باستخدام الكاميرا"
                    >
                      <Camera size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button" 
                    onClick={() => setSaleData({...saleData, isCash: true})}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${saleData.isCash ? 'border-success bg-success/5 text-success' : 'border-gray-100 text-gray-400'}`}
                  >
                    <Banknote size={24} />
                    <span className="font-bold">نقداً</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setSaleData({...saleData, isCash: false})}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${!saleData.isCash ? 'border-warning bg-warning/5 text-warning' : 'border-gray-100 text-gray-400'}`}
                  >
                    <Tag size={24} />
                    <span className="font-bold">آجل / دين</span>
                  </button>
                </div>

                {!saleData.isCash && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 text-right">
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => setSaleData({...saleData, buyerType: 'customer'})}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold ${saleData.buyerType === 'customer' ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-400'}`}
                      >
                        عميل
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setSaleData({...saleData, buyerType: 'employee'})}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold ${saleData.buyerType === 'employee' ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-400'}`}
                      >
                        موظف
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="label-field">اختيار {saleData.buyerType === 'customer' ? 'العميل' : 'الموظف'}</label>
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <select required className="input-field pr-10" value={saleData.buyerId} onChange={(e) => setSaleData({...saleData, buyerId: e.target.value})}>
                          <option value="">-- اختر الحساب --</option>
                          {saleData.buyerType === 'customer' ? (
                            customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                          ) : (
                            employees.map(e => <option key={e.uid} value={e.uid}>{e.name}</option>)
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  disabled={isProcessing}
                  type="submit" 
                  className="btn-primary w-full py-5 text-xl shadow-xl shadow-brand-primary/20"
                >
                  {isProcessing ? 'جاري المعالجة...' : 'تأكيد عملية البيع'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCameraOpen && (
          <BarcodeScanner 
            onScan={handleCameraScan} 
            onClose={() => setIsCameraOpen(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
