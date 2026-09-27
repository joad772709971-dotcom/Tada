import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Store, Users, Wallet, Search, LayoutDashboard, Key, Power, PowerOff, X, ShieldCheck, Clock, CreditCard } from 'lucide-react';

interface DistributorDashboardProps {
  profile: UserProfile | null;
}

export default function DistributorDashboard({ profile }: DistributorDashboardProps) {
  const [shops, setShops] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModulesModalOpen, setIsModulesModalOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [selectedShopModules, setSelectedShopModules] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const AVAILABLE_MODULES = [
    { id: 'maintenance', label: 'الصيانة' },
    { id: 'inventory', label: 'المخازن والجرد' },
    { id: 'sales', label: 'المبيعات' },
    { id: 'mobile-balance', label: 'عمليات الرصيد' },
    { id: 'sim-cards', label: 'شرائح SIM' },
    { id: 'customers', label: 'العملاء' },
    { id: 'shortages', label: 'الطلبيات' },
    { id: 'engineer-accounts', label: 'حسابات المهندسين' },
    { id: 'finances', label: 'المصروفات والصندوق' },
    { id: 'reports', label: 'التقارير' },
    { id: 'suppliers', label: 'الموردين' },
    { id: 'archive', label: 'الأرشيف' },
  ];

  useEffect(() => {
    if (!profile?.uid) return;

    // In a real app, shops would have a 'distributorId' field
    // For now, we'll assume the distributor can see shops they created or are assigned to
    // Since we don't have distributorId yet, let's just fetch all shops for the demo
    // but in production we would filter by distributorId
    const q = query(collection(db, 'shops'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any })).filter(s => s.status !== 'deleted' && s.isDeleted !== true));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shops');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleUpdateModules = async () => {
    if (!selectedShop || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Update the shop owner's user profile
      await updateDoc(doc(db, 'users', selectedShop.ownerId), {
        enabledModules: selectedShopModules,
        updatedAt: serverTimestamp()
      });
      
      // Also update settings collection
      await updateDoc(doc(db, 'settings', selectedShop.ownerId), {
        enabledModules: selectedShopModules,
        updatedAt: serverTimestamp()
      });

      setStatus({ type: 'success', message: 'تم تحديث الوحدات بنجاح!' });
      setTimeout(() => {
        setIsModulesModalOpen(false);
        setStatus(null);
      }, 1500);
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredShops = shops.filter(s => 
    s.shopName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-glass p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary">
            <Store size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500">إجمالي المحلات</p>
            <p className="text-2xl font-black">{shops.length}</p>
          </div>
        </div>
        <div className="card-glass p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500">العمولات المستحقة</p>
            <p className="text-2xl font-black">0 ر.ي</p>
          </div>
        </div>
        <div className="card-glass p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center text-danger">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500">الديون المتأخرة</p>
            <p className="text-2xl font-black">0 ر.ي</p>
          </div>
        </div>
        <div className="card-glass p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center text-warning">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500">اشتراكات تنتهي قريباً</p>
            <p className="text-2xl font-black">0</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-black flex items-center gap-2">
          <Users className="text-brand-primary" />
          إدارة المحلات التابعة
        </h2>
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="بحث عن محل..." 
            className="w-full pr-12 pl-4 py-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredShops.map((shop) => (
          <motion.div
            layout
            key={shop.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-glass p-6 space-y-4 relative overflow-hidden group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-navy-700 rounded-2xl flex items-center justify-center text-brand-primary shadow-inner group-hover:scale-110 transition-transform">
                <Store size={32} />
              </div>
              <div>
                <h3 className="font-black text-xl">{shop.shopName}</h3>
                <p className="text-sm text-gray-500">{shop.ownerName}</p>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-navy-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">الحالة:</span>
                <span className="px-2 py-1 bg-success/10 text-success rounded-lg font-bold text-[10px]">نشط</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">تاريخ الاشتراك:</span>
                <span className="font-bold">{shop.createdAt?.toDate ? shop.createdAt.toDate().toLocaleDateString('ar-YE') : '...'}</span>
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <button 
                onClick={() => {
                  setSelectedShop(shop);
                  setSelectedShopModules(shop.enabledModules || AVAILABLE_MODULES.map(m => m.id));
                  setIsModulesModalOpen(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20"
              >
                <LayoutDashboard size={18} />
                إدارة الوحدات
              </button>
              <button className="p-3 bg-navy-700/10 text-navy-700 dark:text-brand-primary rounded-xl hover:bg-navy-700/20 transition-all">
                <Wallet size={18} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modules Management Modal */}
      <AnimatePresence>
        {isModulesModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModulesModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-2xl bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <LayoutDashboard className="text-brand-primary" />
                  تخصيص وحدات المحل
                </h3>
                <button onClick={() => setIsModulesModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="p-4 bg-navy-50 dark:bg-navy-900/50 rounded-xl">
                  <p className="text-xs text-gray-500">تخصيص الوحدات للمحل:</p>
                  <p className="font-bold text-navy-900 dark:text-white text-lg">{selectedShop?.shopName}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AVAILABLE_MODULES.map((module) => (
                    <button
                      key={module.id}
                      onClick={() => {
                        setSelectedShopModules(prev => 
                          prev.includes(module.id) 
                            ? prev.filter(id => id !== module.id)
                            : [...prev, module.id]
                        );
                      }}
                      className={`p-4 rounded-xl border-2 transition-all text-center font-bold text-sm ${
                        selectedShopModules.includes(module.id)
                          ? 'bg-brand-primary/10 border-brand-primary text-navy-900 dark:text-brand-primary'
                          : 'bg-gray-50 dark:bg-navy-900/30 border-transparent text-gray-400'
                      }`}
                    >
                      {module.label}
                    </button>
                  ))}
                </div>

                {status && (
                  <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    <ShieldCheck size={16} />
                    {status.message}
                  </div>
                )}

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsModulesModalOpen(false)}
                    className="flex-1 py-4 bg-gray-100 dark:bg-navy-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={handleUpdateModules}
                    disabled={isSubmitting}
                    className="flex-[2] btn-primary py-4 text-lg"
                  >
                    {isSubmitting ? <div className="w-6 h-6 border-4 border-current border-t-transparent rounded-full animate-spin mx-auto" /> : 'حفظ التغييرات'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
