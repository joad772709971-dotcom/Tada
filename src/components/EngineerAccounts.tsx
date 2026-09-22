import { useState, useEffect } from 'react';
import { 
  User, 
  TrendingUp, 
  ArrowDownLeft, 
  Wallet, 
  Plus, 
  History, 
  Search, 
  X, 
  CheckCircle2,
  DollarSign,
  UserPlus
} from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, orderBy, getDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, EngineerTransaction, MaintenanceOrder, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface EngineerAccountsProps {
  profile: UserProfile | null;
}

export default function EngineerAccounts({ profile }: EngineerAccountsProps) {
  const [engineers, setEngineers] = useState<UserProfile[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<EngineerTransaction[]>([]);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isAddEngineerModalOpen, setIsAddEngineerModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDesc, setWithdrawDesc] = useState('');
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [businessType, setBusinessType] = useState('mobiles');

  // New Engineer Form
  const [newEngData, setNewEngData] = useState({
    name: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    if (!profile?.ownerId) return;

    const isEmployee = profile?.role === 'employee' || profile?.role === 'engineer';
    
    let qUsers = query(collection(db, 'users'), where('ownerId', '==', profile.ownerId));
    if (profile.role !== 'owner' && profile.role !== 'superadmin' && profile.shopId) {
      qUsers = query(qUsers, where('shopId', '==', profile.shopId));
    }
    if (isEmployee) {
      qUsers = query(qUsers, where('uid', '==', profile.uid));
    }

    const unsubEngineers = onSnapshot(qUsers, (snapshot) => {
      const engs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setEngineers(engs);
      if (engs.length > 0 && !selectedEngineer) {
        setSelectedEngineer(engs[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubEngineers();
  }, [profile]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!profile?.ownerId) return;
      try {
        const docSnap = await getDoc(doc(db, 'settings', profile.ownerId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setShopSettings(data);
          setBusinessType(data.businessType || 'mobiles');
        }
      } catch (error) {
        console.warn('Error fetching settings (falling back to default):', error);
      }
    };
    fetchSettings();
  }, [profile]);

  useEffect(() => {
    if (selectedEngineer && profile?.ownerId) {
      const q = query(
        collection(db, 'engineerTransactions'), 
        where('ownerId', '==', profile.ownerId),
        where('engineerId', '==', selectedEngineer.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubTransactions = onSnapshot(q, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngineerTransaction)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'engineerTransactions');
      });
      return () => unsubTransactions();
    }
  }, [selectedEngineer, profile]);

  const totalProfit = transactions.filter(t => t.type === 'profit').reduce((acc, t) => acc + t.amount, 0);
  const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalProfit - totalWithdrawals;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEngineer || !withdrawAmount) return;

    try {
      await addDoc(collection(db, 'engineerTransactions'), {
        ownerId: profile?.ownerId,
        engineerId: selectedEngineer.uid,
        type: 'withdrawal',
        amount: Number(withdrawAmount),
        description: withdrawDesc || 'سحب نقدي',
        createdAt: serverTimestamp()
      });

      // Also record in main finances as expense
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile?.ownerId,
        type: 'expense',
        amount: Number(withdrawAmount),
        category: 'engineer_withdrawal',
        description: `سحب مهندس: ${selectedEngineer.name} - ${withdrawDesc}`,
        createdAt: serverTimestamp()
      });

      setIsWithdrawModalOpen(false);
      setWithdrawAmount('');
      setWithdrawDesc('');
    } catch (error) {
      console.error('Error recording withdrawal:', error);
    }
  };

  const handleAddEngineer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'users'), {
        ownerId: profile?.ownerId,
        name: newEngData.name,
        email: newEngData.email,
        role: 'employee' as UserRole,
        password: newEngData.password,
        createdAt: serverTimestamp()
      });
      setIsAddEngineerModalOpen(false);
      setNewEngData({ name: '', email: '', password: '' });
    } catch (error) {
      console.error('Error adding engineer:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:h-[calc(100vh-160px)]">
      {/* Engineers List */}
      <div className="lg:col-span-1 card-glass flex flex-col overflow-hidden max-h-[400px] lg:max-h-none">
        <div className="p-6 bg-navy-900 text-white flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <User className="text-brand-primary" />
            {businessType === 'mobiles' ? 'المهندسين والموظفين' : 'الموظفين'}
          </h3>
          {profile?.role === 'manager' && (
            <button 
              onClick={() => setIsAddEngineerModalOpen(true)}
              className="p-2 bg-white/10 hover:bg-brand-primary hover:text-white rounded-lg transition-all"
              title={businessType === 'mobiles' ? 'إضافة مهندس/موظف جديد' : 'إضافة موظف جديد'}
            >
              <UserPlus size={18} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {engineers.map((eng) => (
            <button
              key={eng.uid}
              onClick={() => setSelectedEngineer(eng)}
              className={`w-full p-4 rounded-2xl text-right transition-all flex items-center gap-3 border ${
                selectedEngineer?.uid === eng.uid 
                  ? 'bg-navy-700 text-white border-navy-700 shadow-lg' 
                  : 'bg-white dark:bg-navy-800 border-gray-100 dark:border-navy-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-navy-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                selectedEngineer?.uid === eng.uid ? 'bg-brand-primary text-white' : 'bg-navy-700/10 text-navy-700 dark:text-brand-primary'
              }`}>
                {eng.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{eng.name}</p>
                <p className="text-[10px] opacity-60 truncate">{eng.email}</p>
              </div>
            </button>
          ))}
          {engineers.length === 0 && (
            <div className="p-10 text-center text-gray-400 italic text-sm">
              لا يوجد مهندسين مسجلين حالياً
            </div>
          )}
        </div>
      </div>

      {/* Account Details */}
      <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden">
        {selectedEngineer ? (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-glass p-6 flex items-center gap-4 border-r-4 border-r-success">
                <div className="w-14 h-14 bg-success/10 text-success rounded-2xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={28} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">إجمالي الفوائد</p>
                  <p className="text-2xl font-black text-navy-900 dark:text-white">{totalProfit.toFixed(0)} ر.ي</p>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-glass p-6 flex items-center gap-4 border-r-4 border-r-danger">
                <div className="w-14 h-14 bg-danger/10 text-danger rounded-2xl flex items-center justify-center flex-shrink-0">
                  <ArrowDownLeft size={28} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">إجمالي السحبيات</p>
                  <p className="text-2xl font-black text-navy-900 dark:text-white">{totalWithdrawals.toFixed(0)} ر.ي</p>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-glass p-6 flex items-center gap-4 border-r-4 border-r-brand-primary">
                <div className="w-14 h-14 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Wallet size={28} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">الرصيد المتبقي</p>
                  <p className="text-3xl font-black text-navy-900 dark:text-white">{balance.toFixed(0)} ر.ي</p>
                </div>
              </motion.div>
            </div>

            {/* Transactions List */}
            <div className="card-glass flex-1 flex flex-col overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-navy-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <History className="text-brand-primary" />
                  سجل العمليات لـ {selectedEngineer.name}
                </h3>
                <button 
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-danger text-white rounded-lg text-sm font-bold hover:bg-danger/90 transition-all shadow-lg shadow-danger/20"
                >
                  <Plus size={16} />
                  تسجيل سحب جديد
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <table className="w-full text-right">
                    <thead className="bg-gray-50 dark:bg-navy-800 text-gray-500 text-xs uppercase sticky top-0 z-10">
                      <tr>
                        <th className="p-4">التاريخ</th>
                        <th className="p-4">النوع</th>
                        <th className="p-4">المبلغ</th>
                        <th className="p-4">البيان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                      {transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                          <td className="p-4 text-xs text-gray-400">
                            {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('ar-EG') : '...'}
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                              t.type === 'profit' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                            }`}>
                              {t.type === 'profit' ? (businessType === 'mobiles' ? 'فائدة صيانة' : 'راتب/مكافأة') : 'سحب نقدي'}
                            </span>
                          </td>
                          <td className={`p-4 font-black ${t.type === 'profit' ? 'text-success' : 'text-danger'}`}>
                            {t.type === 'profit' ? '+' : '-'}{t.amount.toFixed(0)} ر.ي
                          </td>
                          <td className="p-4 text-sm text-gray-500">{t.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-100 dark:divide-navy-700">
                  {transactions.map((t) => (
                    <div key={t.id} className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.type === 'profit' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                          }`}>
                            {t.type === 'profit' ? (businessType === 'mobiles' ? 'فائدة صيانة' : 'راتب/مكافأة') : 'سحب نقدي'}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('ar-EG') : '...'}
                          </p>
                        </div>
                        <p className={`font-black ${t.type === 'profit' ? 'text-success' : 'text-danger'}`}>
                          {t.type === 'profit' ? '+' : '-'}{t.amount.toFixed(0)} ر.ي
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">{t.description}</p>
                    </div>
                  ))}
                </div>

                {transactions.length === 0 && (
                  <div className="p-20 text-center text-gray-400 italic">
                    لا توجد عمليات مسجلة لهذا المهندس
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 opacity-50">
            <User size={64} />
            <p className="text-xl font-bold">يرجى اختيار مهندس لعرض حسابه</p>
          </div>
        )}
      </div>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsWithdrawModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-danger text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">تسجيل سحب نقدي</h3>
                <button onClick={() => setIsWithdrawModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleWithdraw} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="label-field">المبلغ (ر.ي)</label>
                  <input 
                    required 
                    type="number" 
                    className="input-field" 
                    value={withdrawAmount} 
                    onChange={(e) => setWithdrawAmount(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="label-field">البيان / السبب</label>
                  <input 
                    type="text" 
                    placeholder="مثال: سلفة، مصاريف شخصية..."
                    className="input-field" 
                    value={withdrawDesc} 
                    onChange={(e) => setWithdrawDesc(e.target.value)} 
                  />
                </div>
                <button type="submit" className="btn-primary w-full py-5 text-xl bg-danger shadow-danger/20">
                  تأكيد السحب
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Engineer Modal */}
      <AnimatePresence>
        {isAddEngineerModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddEngineerModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <UserPlus className="text-brand-primary" />
                  {businessType === 'mobiles' ? 'إضافة مهندس/موظف جديد' : 'إضافة موظف جديد'}
                </h3>
                <button onClick={() => setIsAddEngineerModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddEngineer} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="label-field">الاسم الكامل</label>
                  <input required type="text" className="input-field" value={newEngData.name} onChange={(e) => setNewEngData({...newEngData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="label-field">البريد الإلكتروني</label>
                  <input required type="email" className="input-field" value={newEngData.email} onChange={(e) => setNewEngData({...newEngData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="label-field">كلمة المرور</label>
                  <input required type="password" placeholder="كلمة مرور الدخول" className="input-field" value={newEngData.password} onChange={(e) => setNewEngData({...newEngData, password: e.target.value})} />
                </div>
                <button type="submit" className="btn-primary w-full py-5 text-xl">
                  إنشاء حساب المهندس
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
