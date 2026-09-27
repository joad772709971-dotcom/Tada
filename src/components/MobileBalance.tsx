import { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  ArrowDownLeft, 
  Plus, 
  History, 
  Search, 
  X, 
  CheckCircle2,
  Smartphone,
  Banknote,
  DollarSign,
  AlertTriangle,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import { collection, onSnapshot, query, addDoc, serverTimestamp, orderBy, limit, where, Timestamp, writeBatch, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, BalanceTransaction } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { InvisibleJournalEngine } from '../services/InvisibleJournalEngine';
import { UniversalReportButton } from './UniversalReportButton';
import { UniversalReportPayload } from '../services/UniversalReportService';

interface MobileBalanceProps {
  profile: UserProfile | null;
}

export default function MobileBalance({ profile }: MobileBalanceProps) {
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'purchase' | 'sale'>('sale');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [formData, setFormData] = useState({
    amount: '',
    cost: '',
    price: '',
    deductedFromProgram: '',
    amountReceived: '',
    provider: 'Yemen Mobile'
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!profile?.ownerId) return;

    setIsSyncing(true);
    const isEmployee = profile?.role === 'employee' || profile?.role === 'engineer';
    let q = query(
      collection(db, 'balanceTransactions'), 
      where('ownerId', '==', profile.ownerId)
    );

    if (isEmployee) {
      q = query(q, where('addedBy', '==', profile.uid));
    }

    const unsubscribe = onSnapshot(query(q, limit(100)), (snapshot) => {
      setIsSyncing(false);
      const sorted = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as BalanceTransaction))
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
          const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
          return dateB - dateA;
        });
      setTransactions(sorted);
    }, (error) => {
      setIsSyncing(false);
      handleFirestoreError(error, OperationType.LIST, 'balanceTransactions');
    });
    return () => unsubscribe();
  }, [profile]);

  const stats = useMemo(() => {
    const sales = transactions.filter(t => t.type === 'sale').reduce((acc, t) => acc + (t.amountReceived || t.price || 0), 0);
    const purchases = transactions.filter(t => t.type === 'purchase').reduce((acc, t) => acc + (t.cost || 0), 0);
    const profit = transactions.filter(t => t.type === 'sale').reduce((acc, t) => acc + (t.profit || 0), 0);
    const balance = transactions.reduce((acc, t) => {
      if (t.type === 'purchase') return acc + (t.amount || 0);
      return acc - (t.amount || 0);
    }, 0);
    return { sales, purchases, profit, balance };
  }, [transactions]);

  const dailyBalanceStats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let todaySales = 0;
    let todayProfit = 0;
    let todayCount = 0;
    let todayPurchases = 0;

    const providerStocks: { [key: string]: number } = {
      'Yemen Mobile': 0,
      'YOU': 0,
      'Sabafon': 0,
      'Y': 0,
    };

    transactions.forEach(t => {
      let tDate: Date | null = null;
      if (t.createdAt) {
        if (typeof (t.createdAt as any).toDate === 'function') {
          tDate = (t.createdAt as any).toDate();
        } else if (t.createdAt instanceof Date) {
          tDate = t.createdAt;
        } else {
          tDate = new Date(t.createdAt as any);
        }
      }

      const isToday = tDate && tDate >= startOfToday;

      if (isToday) {
        if (t.type === 'sale') {
          todaySales += Number(t.amountReceived || t.price || 0);
          todayProfit += Number(t.profit || 0);
          todayCount += 1;
        } else if (t.type === 'purchase') {
          todayPurchases += Number(t.cost || 0);
        }
      }

      const p = t.provider || 'Yemen Mobile';
      if (!(p in providerStocks)) {
        providerStocks[p] = 0;
      }
      if (t.type === 'purchase') {
        providerStocks[p] += Number(t.amount || 0);
      } else {
        providerStocks[p] -= Number(t.amount || 0);
      }
    });

    return { todaySales, todayProfit, todayCount, todayPurchases, providerStocks };
  }, [transactions]);

  const getLatestUnitCost = (provider: string) => {
    const lastPurchase = transactions.find(t => t.type === 'purchase' && t.provider === provider);
    if (!lastPurchase) return 1;
    if (lastPurchase.amount <= 0 || lastPurchase.cost <= 0) return 1;
    return lastPurchase.cost / lastPurchase.amount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const amount = Number(formData.amount);
      const cost = Number(formData.cost);
      const price = modalType === 'purchase' ? 0 : Number(formData.price);
      const deducted = Number(formData.deductedFromProgram || amount);
      const received = Number(formData.amountReceived || price);
      
      let profit = 0;
      if (modalType === 'sale') {
        const unitCost = getLatestUnitCost(formData.provider);
        profit = received - (deducted * unitCost);
      }

      const batch = writeBatch(db);
      
      const balanceRef = doc(collection(db, 'balanceTransactions'));
      batch.set(balanceRef, {
        ownerId: profile?.ownerId,
        type: modalType,
        amount,
        cost,
        price,
        deductedFromProgram: deducted,
        amountReceived: received,
        profit: modalType === 'sale' ? profit : 0,
        provider: formData.provider,
        addedBy: profile?.uid,
        createdAt: serverTimestamp()
      });

      // Record in main finances
      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        ownerId: profile?.ownerId,
        type: modalType === 'sale' ? 'income' : 'expense',
        amount: modalType === 'sale' ? received : cost,
        category: 'mobile_balance',
        description: `${modalType === 'sale' ? 'بيع' : 'شراء'} رصيد ${formData.provider} - ${amount} وحدة`,
        createdAt: serverTimestamp()
      });

      // Synchronize to vaults and customBoxes collections dynamically inside the batch!
      try {
        const sId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
        const diff = modalType === 'sale' ? received : -cost;

        // 1. Update stores/{sId}/vaults/v1
        const storeVDocRef = doc(db, 'stores', sId, 'vaults', 'v1');
        batch.set(storeVDocRef, {
          balance: increment(diff),
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 2. Update root vaults/ownerId-v1
        const rootVDocRef = doc(db, 'vaults', `${profile.ownerId}-v1`);
        batch.set(rootVDocRef, {
          id: 'v1',
          name: 'صندوق النقد الرئيسي (الكاش)',
          type: 'cash',
          balance: increment(diff),
          ownerId: profile.ownerId,
          storeId: sId,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 3. Update stores/{ownerId}/customBoxes/CASH_BOX
        const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', 'CASH_BOX');
        batch.set(customRef, {
          id: 'CASH_BOX',
          boxName: 'صندوق النقد الرئيسي (الكاش)',
          type: 'cash',
          balance: increment(diff),
          ownerId: profile.ownerId,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (vaultErr) {
        console.warn('Failed to stage vault sync inside MobileBalance batch:', vaultErr);
      }

      await batch.commit();

      // Trigger the Invisible Journal Engine to post double-entry ledger entries in background
      if (profile?.ownerId) {
        const sId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
        InvisibleJournalEngine.postBalanceTransactionToLedger({
          ownerId: profile.ownerId,
          type: modalType,
          amount,
          cost,
          price: received,
          provider: formData.provider,
          paymentMethod: 'cash', // Since it updates the cash box directly in this modal
          storeId: sId,
          isDryRun: false
        }).catch(err => console.warn('Invisible Journal failed to post balance transaction:', err));
      }

      setIsModalOpen(false);
      setFormData({ amount: '', cost: '', price: '', deductedFromProgram: '', amountReceived: '', provider: 'Yemen Mobile' });
      setStatus({ type: 'success', message: 'تم حفظ العملية بنجاح' });
    } catch (error) {
      console.error('Error recording balance transaction:', error);
      setStatus({ type: 'error', message: 'فشل حفظ العملية' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRepair = async () => {
    if (!profile?.ownerId) return;
    if (!confirm('هل تريد فعلاً إعادة تدقيق كافة أرباح الرصيد السابقة بناءً على آخر أسعار الشراء؟')) return;

    setIsSubmitting(true);
    try {
      const { financialService } = await import('../services/financialService');
      const count = await financialService.repairBalanceHistoricalData(profile.ownerId);
      setStatus({ type: 'success', message: `تم تدقيق وإصلاح ${count} عملية بنجاح.` });
    } catch (error) {
      console.error('Repair failed:', error);
      setStatus({ type: 'error', message: 'فشل في عملية التدقيق والإصلاح.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Notifications and Sync Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-navy-950 dark:text-white flex items-center gap-3">
          <Smartphone className="text-brand-primary" />
          عمليات الرصيد والتحويل الفوري
        </h2>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold ${
            isOnline ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}>
            {isSyncing ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : isOnline ? (
              <Cloud size={12} />
            ) : (
              <CloudOff size={12} />
            )}
            {isSyncing ? 'جاري المزامنة...' : isOnline ? 'متصل' : 'أوفلاين - حفظ محلي'}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-bold ${
              status.type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'
            }`}
          >
            {status.message}
            <button onClick={() => setStatus(null)}><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-metallic p-6 flex items-center gap-4 border-r-4 border-r-brand-primary">
          <div className="w-14 h-14 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center shadow-inner">
            <Smartphone size={28} />
          </div>
          <div>
            <p className="text-sm text-gray-500">الرصيد المتبقي (وحدات)</p>
            <p className="text-2xl font-black text-navy-900 dark:text-white num-mono">{stats.balance.toFixed(0)}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-metallic p-6 flex items-center gap-4 border-r-4 border-r-success">
          <div className="w-14 h-14 bg-success/10 text-success rounded-2xl flex items-center justify-center shadow-inner">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-sm text-gray-500">إجمالي المبيعات (الدرج)</p>
            <p className="text-2xl font-black text-navy-900 dark:text-white num-mono">{stats.sales.toFixed(0)} ر.ي</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-metallic p-6 flex items-center gap-4 border-r-4 border-r-danger">
          <div className="w-14 h-14 bg-danger/10 text-danger rounded-2xl flex items-center justify-center shadow-inner">
            <ArrowDownLeft size={28} />
          </div>
          <div>
            <p className="text-sm text-gray-500">إجمالي المشتريات</p>
            <p className="text-2xl font-black text-navy-900 dark:text-white num-mono">{stats.purchases.toFixed(0)} ر.ي</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-metallic p-6 flex items-center gap-4 border-r-4 border-r-warning">
          <div className="w-14 h-14 bg-warning/10 text-warning rounded-2xl flex items-center justify-center shadow-inner">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-sm text-gray-500">صافي الأرباح</p>
            <p className="text-2xl font-black text-navy-900 dark:text-white num-mono">{stats.profit.toFixed(0)} ر.ي</p>
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <button 
          onClick={() => { setModalType('sale'); setIsModalOpen(true); }}
          className="flex-1 py-5 btn-metallic-copper rounded-2xl flex items-center justify-center gap-2 text-xl"
        >
          <Plus size={24} />
          تسجيل عملية بيع رصيد
        </button>
        <button 
          onClick={() => { setModalType('purchase'); setIsModalOpen(true); }}
          className="flex-1 py-5 btn-metallic-cobalt rounded-2xl flex items-center justify-center gap-2 text-xl"
        >
          <Plus size={24} />
          شراء رصيد جديد (تغذية)
        </button>
        
        {profile?.role === 'manager' && (
          <button 
            onClick={handleRepair}
            className="p-4 bg-warning/10 text-warning rounded-2xl hover:bg-warning/20 transition-colors flex items-center justify-center gap-2"
            title="تدقيق وإصلاح الأرباح"
          >
            <AlertTriangle size={24} />
          </button>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="card-metallic overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-navy-700 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <History className="text-brand-primary" />
            سجل عمليات الرصيد
          </h3>
          <UniversalReportButton
            variant="emerald"
            buttonText="تصدير كشف حركة الرصيد"
            payload={{
              title: 'كشف وسجل عمليات بيع وشحن الرصيد الفوري',
              subtitle: 'تقرير تفصيلي بعمليات التغذية، مبيعات الرصيد، والأرباح المحققة',
              currency: 'ر.ي',
              summaryCards: [
                { label: 'إجمالي المبيعات (الدرج)', value: stats.sales.toLocaleString(), currency: 'ر.ي', color: 'green' },
                { label: 'إجمالي المشتريات (التغذية)', value: stats.purchases.toLocaleString(), currency: 'ر.ي', color: 'blue' },
                { label: 'صافي أرباح الرصيد', value: stats.profit.toLocaleString(), currency: 'ر.ي', color: 'amber' },
                { label: 'إجمالي العمليات', value: transactions.length, currency: 'عملية', color: 'purple' }
              ],
              columns: [
                { key: 'createdAt', header: 'تاريخ ووقت العملية', type: 'date', width: 18, formatter: (val) => val?.toDate ? val.toDate().toLocaleString('ar-EG') : '-' },
                { key: 'type', header: 'نوع العملية', type: 'text', width: 14, formatter: (val) => val === 'sale' ? 'بيع رصيد' : 'شراء وتغذية' },
                { key: 'provider', header: 'الشركة / المزود', type: 'text', width: 16 },
                { key: 'amount', header: 'الكمية المشحونة', type: 'number', width: 14 },
                { key: 'deductedFromProgram', header: 'المخصوم من البرنامج', type: 'number', width: 16, formatter: (val, row) => val || row.amount || 0 },
                { key: 'amountReceived', header: 'المستلم نقداً', type: 'currency', width: 14, formatter: (val, row) => val || row.price || 0 },
                { key: 'profit', header: 'الربح المحقق', type: 'currency', width: 14 }
              ],
              data: transactions
            }}
          />
        </div>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-100/50 dark:bg-navy-900 text-gray-500 text-xs uppercase">
              <tr>
                <th className="p-4">التاريخ</th>
                <th className="p-4">النوع</th>
                <th className="p-4">الشركة</th>
                <th className="p-4">الكمية</th>
                <th className="p-4">المخصوم</th>
                <th className="p-4">المستلم</th>
                <th className="p-4">الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-navy-700">
              {transactions.map((t, idx) => (
                <tr key={`${t.id}-${idx}`} className="hover:bg-brand-primary/5 transition-colors">
                  <td className="p-4 text-xs text-gray-400 num-mono">
                    {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('ar-EG') : '...'}
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                      t.type === 'sale' ? 'bg-success/10 text-success' : 'bg-navy-700/10 text-navy-700 dark:text-brand-primary'
                    }`}>
                      {t.type === 'sale' ? 'عملية بيع' : 'شراء رصيد'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-sm">{t.provider}</td>
                  <td className="p-4 num-mono">{t.amount} وحدة</td>
                  <td className="p-4 num-mono">{(t.deductedFromProgram || t.amount)} وحدة</td>
                  <td className="p-4 font-black num-mono">{(t.amountReceived || t.price)} ر.ي</td>
                  <td className="p-4 font-black text-success num-mono">{t.profit > 0 ? `+${t.profit.toFixed(0)}` : '---'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200 dark:divide-navy-700">
          {transactions.map((t, idx) => (
            <div key={`m-tx-${t.id}-${idx}`} className="p-4 space-y-3 relative group">
              <div className={`absolute top-0 right-0 w-1 h-full ${t.type === 'sale' ? 'bg-success' : 'bg-navy-900 group-hover:bg-brand-primary'}`} />
              <div className="flex justify-between items-start text-right">
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    t.type === 'sale' ? 'bg-success/10 text-success' : 'bg-navy-700/10 text-navy-700 dark:text-brand-primary'
                  }`}>
                    {t.type === 'sale' ? 'عملية بيع' : 'شراء رصيد'}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-1 num-mono">{t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('ar-EG') : '...'}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">{t.provider}</p>
                  <p className="text-[10px] text-gray-500 num-mono">{t.amount} وحدة</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-gray-100 dark:border-navy-700">
                <div>
                  <p className="text-gray-400 mb-1">المخصوم</p>
                  <p className="font-bold num-mono">{(t.deductedFromProgram || t.amount)}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">المستلم</p>
                  <p className="font-black num-mono">{(t.amountReceived || t.price)}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">الربح</p>
                  <p className="font-black text-success num-mono">{t.profit > 0 ? `+${t.profit.toFixed(0)}` : '---'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {transactions.length === 0 && (
          <div className="p-20 text-center text-gray-400 italic">
            لا توجد عمليات رصيد مسجلة حالياً
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden card-metallic">
              <div className={`p-6 ${modalType === 'sale' ? 'btn-metallic-copper rounded-b-3xl' : 'btn-metallic-cobalt rounded-b-3xl'} flex items-center justify-between`}>
                <h3 className="text-xl font-bold">{modalType === 'sale' ? 'تسجيل بيع رصيد' : 'شراء رصيد جديد'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="label-field !text-sm">شركة الاتصالات</label>
                  <select 
                    className="input-field !text-sm !p-4"
                    value={formData.provider}
                    onChange={(e) => setFormData({...formData, provider: e.target.value})}
                  >
                    <option>Yemen Mobile</option>
                    <option>Sabafon</option>
                    <option>MTN / YOU</option>
                    <option>Y</option>
                    <option>Aden Net</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="label-field !text-sm">الكمية المطلوبة (وحدات)</label>
                  <input required type="number" className="input-field !text-sm !p-4 num-mono" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
                </div>
                
                {modalType === 'sale' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="label-field !text-sm">المخصوم</label>
                        <input type="number" className="input-field !text-sm !p-4 num-mono" placeholder={formData.amount} value={formData.deductedFromProgram} onChange={(e) => setFormData({...formData, deductedFromProgram: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="label-field !text-sm">المستلم</label>
                        <input type="number" className="input-field !text-sm !p-4 num-mono" placeholder="0" value={formData.amountReceived} onChange={(e) => setFormData({...formData, amountReceived: e.target.value})} />
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-dashed border-gray-200 dark:border-navy-700 shadow-inner">
                      <div className="flex justify-between items-center text-right">
                        <span className="text-sm font-bold text-gray-500">الربح المتوقع:</span>
                        <span className="text-xl font-black text-success num-mono">
                          {(Number(formData.amountReceived || 0) - (Number(formData.deductedFromProgram || formData.amount || 0) * getLatestUnitCost(formData.provider))).toFixed(0)} ر.ي
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`grid ${modalType === 'purchase' ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                    <div className="space-y-2">
                      <label className="label-field !text-sm">التكلفة</label>
                      <input required type="number" className="input-field !text-sm !p-4 num-mono" value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})} />
                    </div>
                    {modalType !== 'purchase' && (
                      <div className="space-y-2">
                        <label className="label-field !text-sm">سعر البيع</label>
                        <input required type="number" className="input-field !text-sm !p-4 num-mono" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                      </div>
                    )}
                  </div>
                )}
                
                <button type="submit" disabled={isSubmitting} className={`w-full py-5 text-xl rounded-2xl ${modalType === 'sale' ? 'btn-metallic-copper' : 'btn-metallic-cobalt'} disabled:opacity-50`}>
                  {isSubmitting ? 'جاري الحفظ...' : (modalType === 'sale' ? 'تأكيد البيع' : 'تأكيد الشراء')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
