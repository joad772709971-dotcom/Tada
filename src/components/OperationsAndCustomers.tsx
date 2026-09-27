import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Users, 
  Plus, 
  Trash2, 
  Clock, 
  Search, 
  Loader2,
  Package,
  Wrench,
  Smartphone,
  LayoutDashboard,
  Truck,
  ArrowRightLeft,
  Activity,
  History,
  CheckCircle2,
  X,
  PlusCircle,
  Database,
  TrendingUp,
  ShieldAlert,
  Trophy,
  Stethoscope
} from 'lucide-react';
import PhoneDoctorKnowledgeView from './PhoneDoctorKnowledgeView';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  serverTimestamp,
  getDocs,
  Timestamp,
  limit
} from 'firebase/firestore';
import { PromoOffer, Booking, Lead, InventoryItem, UserProfile, Auction, WholesaleProduct, MaintenanceOrder } from '../types';
import { smartCommerceService } from '../services/smartCommerceService';

interface OperationsAndCustomersProps {
  profile: UserProfile | null;
}

export default function OperationsAndCustomers({ profile }: OperationsAndCustomersProps) {
  const navigate = useNavigate();
  const isWholesaler = profile?.role === 'wholesaler' || profile?.businessType === 'wholesale';
  const [activeTab, setActiveTab] = useState<string>(isWholesaler ? 'market-control' : 'smart-trade');
  
  const [offers, setOffers] = useState<PromoOffer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceOrder[]>([]);
  const [wholesaleProducts, setWholesaleProducts] = useState<WholesaleProduct[]>([]);
  const [searchPhone, setSearchPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [searchMaintenance, setSearchMaintenance] = useState<MaintenanceOrder[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<'store' | 'auction' | 'wholesale'>('store');
  const [loading, setLoading] = useState(false);

  // Phone Doctor state
  const [advices, setAdvices] = useState<any[]>([]);
  const [adviceForm, setAdviceForm] = useState({ title: '', content: '', type: 'advice' });
  const [editingAdviceId, setEditingAdviceId] = useState<string | null>(null);
  const [isAdviceModalOpen, setIsAdviceModalOpen] = useState(false);

  // Wholesale publishing state
  const [publishingItem, setPublishingItem] = useState<InventoryItem | null>(null);
  const [wholesaleForm, setWholesaleForm] = useState({ price: 0, description: '', stock: 0 });
  const [isBulkPublish, setIsBulkPublish] = useState(false);
  const [bulkMode, setBulkMode] = useState<'category' | 'all'>('category');
  const [selectedBulkCategory, setSelectedBulkCategory] = useState('');

  // Daily Game state for Merchant
  const [gameQuestion, setGameQuestion] = useState('اختر 3 بطاقات واكشف الجائزة لليوم! 🌟');
  const [selectedWinIndices, setSelectedWinIndices] = useState<number[]>([]); // exactly 3 winning indices out of 0-14
  const [prizes, setPrizes] = useState<string[]>([
    'خصم 50% على صيانة الشاشة 📱',
    'قسيمة بقيمة 5000 ر.ي 💵',
    'شاحن لاسلكي سريع مجاناً ⚡'
  ]);
  const [gameLoading, setGameLoading] = useState(false);

  useEffect(() => {
    if (!profile?.ownerId) return;

    const fetchGameConfig = async () => {
      try {
        const { getDoc } = await import('firebase/firestore');
        const configRef = doc(db, 'daily_games_config', profile.ownerId);
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const data = snap.data();
          setGameQuestion(data.question || 'اختر 3 بطاقات واكشف الجائزة لليوم! 🌟');
          setSelectedWinIndices(data.winningIndices || []);
          setPrizes(data.prizes || [
            'خصم 50% على صيانة الشاشة 📱',
            'قسيمة بقيمة 5000 ر.ي 💵',
            'شاحن لاسلكي سريع مجاناً ⚡'
          ]);
        }
      } catch (err) {
        console.error('Error fetching game config:', err);
      }
    };

    fetchGameConfig();
  }, [profile?.ownerId]);

  const handleSaveGameConfig = async () => {
    if (!profile?.ownerId) return;
    if (selectedWinIndices.length !== 3) {
      alert('الرجاء تحديد 3 بطاقات رابحة بالضبط من شبكة الـ 15 بطاقة!');
      return;
    }
    setGameLoading(true);
    try {
      const { setDoc } = await import('firebase/firestore');
      const configRef = doc(db, 'daily_games_config', profile.ownerId);
      await setDoc(configRef, {
        storeId: profile.ownerId,
        question: gameQuestion,
        winningIndices: selectedWinIndices,
        prizes: prizes,
        updatedAt: serverTimestamp()
      });
      alert('تم نشر مسابقة اليوم بنجاح لمشتركي وعملاء المتجر! 🎉');
    } catch (err) {
      console.error('Error saving game config:', err);
      alert('حدث خطأ أثناء نشر المسابقة.');
    } finally {
      setGameLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.ownerId) return;

    const unsubAdvices = onSnapshot(
      query(collection(db, 'phone_doctor'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snap) => setAdvices(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.warn('onSnapshot error in phone_doctor:', err);
        setAdvices([]);
      }
    );

    const unsubOffers = onSnapshot(
      query(collection(db, 'offers'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snap) => setOffers(snap.docs.map(d => ({ id: d.id, ...d.data() } as PromoOffer))),
      (err) => {
        console.warn('onSnapshot error in offers:', err);
        setOffers([]);
      }
    );

    const unsubBookings = onSnapshot(
      query(collection(db, 'bookings'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snap) => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking))),
      (err) => {
        console.warn('onSnapshot error in bookings:', err);
        setBookings([]);
      }
    );

    const unsubLeads = onSnapshot(
      query(collection(db, 'leads'), where('ownerId', '==', profile.ownerId), orderBy('points', 'desc'), limit(50)),
      (snap) => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead))),
      (err) => {
        console.warn('onSnapshot error in leads:', err);
        setLeads([]);
      }
    );

    const unsubInv = onSnapshot(
      query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId)),
      (snap) => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))),
      (err) => {
        console.warn('onSnapshot error in inventory:', err);
        setInventory([]);
      }
    );

    const unsubMaint = onSnapshot(
      query(collection(db, 'maintenanceOrders'), where('ownerId', '==', profile.ownerId), limit(50)),
      (snap) => setMaintenance(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceOrder))),
      (err) => {
        console.warn('onSnapshot error in maintenanceOrders:', err);
        setMaintenance([]);
      }
    );

    const unsubWP = onSnapshot(
      query(collection(db, 'wholesaleProducts'), where('wholesalerId', '==', profile.ownerId)),
      (snap) => setWholesaleProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as WholesaleProduct))),
      (err) => {
        console.warn('onSnapshot error in wholesaleProducts:', err);
        setWholesaleProducts([]);
      }
    );

    return () => {
      unsubAdvices();
      unsubOffers();
      unsubBookings();
      unsubLeads();
      unsubInv();
      unsubMaint();
      unsubWP();
    };
  }, [profile]);

  const handleBulkPublish = async () => {
    if (!profile?.ownerId) return;
    setLoading(true);
    try {
      let itemsToPublish = [];
      if (bulkMode === 'all') {
        itemsToPublish = inventory;
      } else {
        itemsToPublish = inventory.filter(i => i.category === selectedBulkCategory);
      }

      if (itemsToPublish.length === 0) {
        alert('لا توجد أصناف تطابق هذا التحديد في مخزنك');
        setLoading(false);
        return;
      }

      if (!window.confirm(`هل أنت متأكد من نشر ${itemsToPublish.length} صنف إلى السوق العام؟`)) {
        setLoading(false);
        return;
      }

      for (const item of itemsToPublish) {
        await addDoc(collection(db, 'wholesaleProducts'), {
          name: item.name,
          description: `متوفر في ${profile.shopName || profile.name}`,
          price: item.price,
          stock: item.stock,
          category: item.category || 'عام',
          wholesalerId: profile.ownerId,
          wholesalerName: profile.shopName || profile.name,
          originalItemId: item.id,
          createdAt: serverTimestamp()
        });
      }

      alert(`تم بنجاح نشر ${itemsToPublish.length} صنف في سوق الموردين!`);
      setIsModalOpen(false);
      setIsBulkPublish(false);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء النشر الجماعي');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchPhone) return;
    setIsSearching(true);
    try {
      const qL = query(collection(db, 'leads'), where('phone', '==', searchPhone));
      const snapL = await getDocs(qL);
      setSearchResults(snapL.docs.map(d => ({ id: d.id, ...d.data() } as Lead)));

      const qM = query(collection(db, 'maintenanceOrders'), where('customerPhone', '==', searchPhone));
      const snapM = await getDocs(qM);
      setSearchMaintenance(snapM.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceOrder)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const removeFromMarket = async (id: string) => {
    if (!window.confirm('هل تريد سحب هذا الصنف من السوق؟')) return;
    try {
      await deleteDoc(doc(db, 'wholesaleProducts', id));
    } catch (err) { console.error(err); }
  };

  const handleSaveAdvice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    setLoading(true);
    try {
      if (editingAdviceId) {
        await updateDoc(doc(db, 'phone_doctor', editingAdviceId), {
          title: adviceForm.title,
          content: adviceForm.content,
          type: adviceForm.type,
          updatedAt: serverTimestamp()
        });
        alert('تم تعديل المنشور بنجاح!');
      } else {
        await addDoc(collection(db, 'phone_doctor'), {
          title: adviceForm.title,
          content: adviceForm.content,
          type: adviceForm.type,
          ownerId: profile.ownerId,
          createdBy: profile.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        alert('تم نشر النصيحة للعملاء بنجاح!');
      }
      setAdviceForm({ title: '', content: '', type: 'advice' });
      setEditingAdviceId(null);
      setIsAdviceModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ المنشور');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdvice = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنشور؟')) return;
    try {
      await deleteDoc(doc(db, 'phone_doctor', id));
      alert('تم حذف المنشور بنجاح!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Dynamic Header */}
      <div className="bg-navy-900 border border-white/5 rounded-[3rem] p-10 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/10 blur-[120px] -z-10" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            <div className={`w-20 h-20 ${isWholesaler ? 'bg-orange-500' : 'bg-brand-primary'} rounded-[2rem] flex items-center justify-center shadow-2xl shadow-current/20`}>
              <LayoutDashboard className="text-navy-950" size={40} strokeWidth={2.5} />
            </div>
            <div className="text-right">
              <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                التجارة الذكية
              </h2>
              <div className="flex items-center gap-3 mt-2">
                 <div className={`w-3 h-3 rounded-full animate-pulse ${isWholesaler ? 'bg-orange-500' : 'bg-brand-primary'}`} />
                 <p className="text-white/60 font-black uppercase tracking-[0.4em] text-[10px]">
                   {isWholesaler ? 'Wholesale Management & CRM' : 'Retail Operations & Customer Hub'}
                 </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
             <button 
              onClick={() => {
                setPublishingItem(null);
                setIsModalOpen(true);
              }}
              className={`px-8 py-4 ${isWholesaler ? 'bg-orange-500' : 'bg-brand-primary'} text-navy-950 rounded-2xl font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-current/20 flex items-center gap-3`}
             >
                <PlusCircle size={22} />
                {isWholesaler ? 'نشر صنف من المستودع' : 'إطلاق حملة ذكية لزبون'}
             </button>
             <button 
              onClick={() => navigate('/suppliers')}
              className="px-8 py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black hover:bg-white/10 transition-all flex items-center gap-3"
             >
                <Truck size={22} />
                سوق الموردين
             </button>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex overflow-x-auto max-w-full scrollbar-none whitespace-nowrap p-2 bg-navy-900/40 rounded-[2rem] border border-white/5 backdrop-blur-xl gap-2 sticky top-0 z-30 shadow-2xl">
        <button 
          onClick={() => setActiveTab(isWholesaler ? 'market-control' : 'smart-trade')} 
          className={`flex-none md:flex-1 flex items-center justify-center gap-2 md:gap-3 px-5 md:px-0 py-4 md:py-5 rounded-2xl font-black transition-all ${activeTab === (isWholesaler ? 'market-control' : 'smart-trade') ? (isWholesaler ? 'bg-orange-500 text-navy-950' : 'bg-brand-primary text-navy-950') : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <Database size={20} />
          <span>{isWholesaler ? 'التحكم في السوق' : 'التجارة الذكية'}</span>
        </button>
        <button 
          onClick={() => setActiveTab('customers')} 
          className={`flex-none md:flex-1 flex items-center justify-center gap-2 md:gap-3 px-5 md:px-0 py-4 md:py-5 rounded-2xl font-black transition-all ${activeTab === 'customers' ? (isWholesaler ? 'bg-orange-500 text-navy-950' : 'bg-brand-primary text-navy-950') : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <Users size={20} />
          <span>بيانات الزبائن</span>
        </button>
        <button 
          onClick={() => setActiveTab('orders')} 
          className={`flex-none md:flex-1 flex items-center justify-center gap-2 md:gap-3 px-5 md:px-0 py-4 md:py-5 rounded-2xl font-black transition-all ${activeTab === 'orders' ? (isWholesaler ? 'bg-orange-500 text-navy-950' : 'bg-brand-primary text-navy-950') : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <Clock size={20} />
          <span>الطلبات الواردة</span>
        </button>
        <button 
          onClick={() => setActiveTab('phone-doctor')} 
          className={`flex-none md:flex-1 flex items-center justify-center gap-2 md:gap-3 px-5 md:px-0 py-4 md:py-5 rounded-2xl font-black transition-all ${activeTab === 'phone-doctor' ? (isWholesaler ? 'bg-orange-500 text-navy-950' : 'bg-brand-primary text-navy-950') : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <Smartphone size={20} />
          <span>طبيب الهاتف</span>
        </button>
        <button 
          onClick={() => setActiveTab('daily-game')} 
          className={`flex-none md:flex-1 flex items-center justify-center gap-2 md:gap-3 px-5 md:px-0 py-4 md:py-5 rounded-2xl font-black transition-all ${activeTab === 'daily-game' ? (isWholesaler ? 'bg-orange-500 text-navy-950' : 'bg-brand-primary text-navy-950') : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <Trophy size={20} />
          <span>المسابقة اليومية</span>
        </button>
      </div>

      {/* Main Feature Content */}
      <div className="grid grid-cols-1 gap-10">
        <AnimatePresence mode="wait">
          {activeTab === 'market-control' && isWholesaler ? (
            <motion.div key="market" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-glass p-8 bg-orange-500/5 border-orange-500/20">
                  <p className="text-white/40 font-black text-[10px] uppercase mb-1">المنتجات النشطة</p>
                  <h4 className="text-4xl font-black text-white">{wholesaleProducts.length}</h4>
                </div>
                <div className="card-glass p-8 bg-blue-500/5 border-blue-500/20">
                  <p className="text-white/40 font-black text-[10px] uppercase mb-1">إجمالي المنتجات في المخزن</p>
                  <h4 className="text-4xl font-black text-white">{inventory.length}</h4>
                </div>
                <div className="card-glass p-8 bg-success/5 border-success/20">
                  <p className="text-white/40 font-black text-[10px] uppercase mb-1">طلبات بانتظار الموافقة</p>
                  <h4 className="text-4xl font-black text-white">{bookings.filter(b => b.status === 'pending').length}</h4>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-black text-white">معروضاتك في سوق الجملة</h3>
                <button onClick={() => setIsBulkPublish(true)} className="text-xs font-black text-orange-500 hover:orange-400 transition-colors">نشر جماعي من المستودع ↑</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {wholesaleProducts.map((p, idx) => (
                  <motion.div layout key={`${p.id}-${idx}`} className="card-glass p-6 group relative hover:border-orange-500/30 transition-all">
                    <div className="absolute top-4 left-4 flex gap-2">
                      <button onClick={() => removeFromMarket(p.id)} className="p-2.5 bg-danger/10 text-danger rounded-xl hover:bg-danger/20 active:scale-90 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                       <Package className="text-orange-500" />
                    </div>
                    <h4 className="font-black text-white text-lg truncate">{p.name}</h4>
                    <p className="text-[10px] text-white/40 mt-1">{p.category}</p>
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="p-4 bg-navy-950 rounded-2xl text-center">
                        <p className="text-[9px] font-black text-white/40 mb-1">السعر</p>
                        <p className="text-base font-black text-white">{p.price.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-navy-950 rounded-2xl text-center">
                        <p className="text-[9px] font-black text-white/40 mb-1">المتوفر</p>
                        <p className="text-base font-black text-white">{p.stock}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                <button 
                  onClick={() => { setPublishingItem(null); setIsModalOpen(true); }}
                  className="card-glass p-6 border-dashed border-2 border-white/10 flex flex-col items-center justify-center gap-4 text-center group cursor-pointer hover:border-orange-500 transition-all"
                >
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:rotate-90 transition-all duration-500">
                    <Plus className="text-orange-500" size={32} />
                  </div>
                  <div>
                    <p className="font-black text-white">إضافة منتج للسوق</p>
                    <p className="text-[10px] text-white/40">اختر من مخزنك الشخصي</p>
                  </div>
                </button>
              </div>
            </motion.div>
          ) : activeTab === 'smart-trade' && !isWholesaler ? (
            <motion.div key="trade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
               <div className="card-glass p-10 bg-brand-primary/5 border-brand-primary/20">
                  <div className="flex items-center gap-6 mb-8 text-white">
                     <Zap className="text-brand-primary animate-pulse" size={40} />
                     <div>
                        <h3 className="text-2xl font-black">غرفة تجارة التجزئة الذكية</h3>
                        <p className="text-xs font-black text-white/40">حرك مخزنك واجذب الزبائن بعروض فورية</p>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="p-6 bg-navy-950/50 rounded-3xl border border-white/5">
                        <p className="text-[10px] font-black text-white/40 mb-1 uppercase">الأصناف الراكدة</p>
                        <p className="text-2xl font-black text-brand-primary">{inventory.filter(i => i.stock > 10).length}</p>
                     </div>
                     <div className="p-6 bg-navy-950/50 rounded-3xl border border-white/5">
                        <p className="text-[10px] font-black text-white/40 mb-1 uppercase">زبائن الأسبوع</p>
                        <p className="text-2xl font-black text-brand-primary">{leads.length}</p>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="card-glass p-8">
                     <h4 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                        <History size={20} className="text-brand-primary" />
                        آخر العروض الذكية المفعّلة
                     </h4>
                     <div className="space-y-4">
                        {offers.map((offer, idx) => (
                           <div key={`${offer.id}-${idx}`} className="p-5 bg-navy-950 rounded-2xl flex items-center justify-between border border-white/5">
                              <div className="text-right">
                                 <p className="font-black text-white">{offer.itemName}</p>
                                 <p className="text-[10px] text-success font-black">{offer.promoPrice} ر.ي بدل {offer.originalPrice}</p>
                              </div>
                              <div className="flex gap-2">
                                 <button onClick={() => deleteDoc(doc(db, 'offers', offer.id))} className="p-2 text-danger"><Trash2 size={16} /></button>
                              </div>
                           </div>
                        ))}
                        {offers.length === 0 && <p className="text-center py-10 text-white/20 italic">لا توجد عروض حالية</p>}
                     </div>
                  </div>

                  <div className="card-glass p-8">
                     <h4 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                        <CheckCircle2 size={20} className="text-brand-primary" />
                        طلبات الزبائن المهتمين
                     </h4>
                     <div className="space-y-4">
                        {bookings.slice(0, 5).map((b, idx) => (
                           <div key={`${b.id}-${idx}`} className="p-5 bg-white/5 rounded-2xl flex items-center justify-between">
                              <div>
                                 <p className="font-black text-white text-sm">{b.itemName}</p>
                                 <p className="text-[10px] text-brand-primary font-bold">{b.customerName} - {b.customerPhone}</p>
                              </div>
                              <span className="bg-brand-primary/10 text-brand-primary text-[10px] px-3 py-1 rounded-full font-black">قيد الانتظار</span>
                           </div>
                        ))}
                         {bookings.length === 0 && <p className="text-center py-10 text-white/20 italic">لا توجد حجوزات واردة</p>}
                     </div>
                  </div>
               </div>
            </motion.div>
          ) : activeTab === 'customers' ? (
            <motion.div key="customers" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="card-glass p-8 bg-brand-primary/5 border-brand-primary/20">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                    <input 
                      className="input-field pr-12 text-sm font-black text-right" 
                      placeholder="ابحث برقم هاتف الزبون (البيانات، الجوالات، الصيانة)..." 
                      value={searchPhone} 
                      onChange={e => setSearchPhone(e.target.value)} 
                    />
                  </div>
                  <button 
                    onClick={handleSearch} 
                    className="px-10 py-4 bg-brand-primary text-navy-950 rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    {isSearching ? <Loader2 className="animate-spin" /> : <>بحث شامل <ArrowRightLeft size={18} /></>}
                  </button>
                </div>
              </div>

              {(searchResults.length > 0 || searchMaintenance.length > 0) ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h5 className="text-xl font-black text-white flex items-center gap-3">
                       <Users size={20} className="text-brand-primary" /> ملف الزبون
                    </h5>
                    {searchResults.map((lead, idx) => (
                      <div key={`${lead.id}-${idx}`} className="card-glass p-8 flex items-center justify-between bg-white text-navy-950">
                        <div className="flex items-center gap-6">
                          <div className="w-20 h-20 bg-indigo-100 rounded-[2rem] flex items-center justify-center text-indigo-600 font-black text-2xl">
                             {lead.name?.[0] || lead.phone.slice(-1)}
                          </div>
                          <div className="text-right">
                             <h4 className="text-2xl font-black">{lead.name || 'زبون غير مسمى'}</h4>
                             <p className="text-gray-500 font-bold">{lead.phone}</p>
                             <div className="flex items-center gap-2 mt-2">
                                <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black">{lead.points || 0} نقطة ولاء</span>
                             </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-6">
                    <h5 className="text-xl font-black text-white flex items-center gap-3">
                       <Smartphone size={20} className="text-brand-primary" /> أجهزة وجوالات الزبون
                    </h5>
                    <div className="space-y-4">
                      {searchMaintenance.map((m, idx) => (
                        <div key={`${m.id}-${idx}`} className="card-glass p-6 border-brand-primary/10">
                           <div className="flex justify-between mb-4">
                              <p className="font-black text-white">{m.deviceModel}</p>
                              <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">{m.status}</span>
                           </div>
                           <div className="text-white/60 text-xs font-bold leading-relaxed">
                              {m.issue}
                           </div>
                           <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                              <p className="text-xs font-black text-white">#{m.id.slice(-6).toUpperCase()}</p>
                              <p className="text-indigo-400 font-black">{(m.cost + (m.laborCost || 0)).toLocaleString()} ر.ي</p>
                           </div>
                        </div>
                      ))}
                      {searchMaintenance.length === 0 && <p className="text-center py-10 text-white/20">لا يوجد سجل أجهزة لهذا الرقم</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
                   {leads.map((lead, idx) => (
                      <button 
                        key={`${lead.id}-${idx}`}
                        onClick={() => { setSearchPhone(lead.phone); handleSearch(); }}
                        className="card-glass p-6 text-center hover:border-brand-primary transition-all group"
                      >
                         <div className="w-14 h-14 bg-navy-950 rounded-2xl mx-auto flex items-center justify-center text-white/20 group-hover:text-brand-primary transition-colors font-black mb-3">
                            {lead.phone.slice(-3)}
                         </div>
                         <p className="text-white font-black text-xs">{lead.phone}</p>
                         <p className="text-brand-primary text-[10px] font-black mt-1 opacity-60 group-hover:opacity-100">{lead.points || 0} نقطة</p>
                      </button>
                   ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'orders' ? (
            <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                 <h3 className="text-3xl font-black text-white">
                    {isWholesaler ? 'الطلبيات الواردة من محلات التجزئة' : 'الحجوزات المباشرة من الزبائن'}
                 </h3>
                 <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl text-[10px] font-black text-white/60">
                       <Clock size={14} /> بانتظار التجهيز: {bookings.filter(b => b.status === 'pending').length}
                    </span>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {bookings.map((booking, idx) => (
                   <div key={`${booking.id}-${idx}`} className="card-glass p-8 space-y-6 group hover:translate-y-[-5px] transition-all">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
                             <Package size={28} />
                           </div>
                           <div>
                              <p className="font-black text-xl text-white">{booking.itemName || 'طلب منتج'}</p>
                              <p className="text-xs text-white/40 font-black">{booking.customerName}</p>
                           </div>
                         </div>
                         <div className={`px-4 py-1.5 rounded-full text-[10px] font-black ${booking.status === 'pending' ? 'bg-warning text-navy-950 font-black' : 'bg-success/10 text-success'}`}>
                            {booking.status === 'pending' ? 'طلب جديد' : 'تم القبول'}
                         </div>
                      </div>
                      
                      <div className="bg-navy-950/80 p-6 rounded-[2rem] space-y-4 shadow-inner border border-white/5">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-white/40">رقم التواصل:</span>
                            <span className="text-sm font-black text-white">{booking.customerPhone}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-white/40">السعر المعروض:</span>
                            <span className="text-xl font-black text-success tabular-nums">{booking.promoPrice.toLocaleString()} ر.ي</span>
                         </div>
                         {booking.bookingDate && (
                           <div className="flex justify-between items-center text-[10px] text-white/20">
                             <span>تاريخ الحجز:</span>
                             <span>{booking.bookingDate instanceof Timestamp ? booking.bookingDate.toDate().toLocaleDateString('ar-YE') : 'مباشر'}</span>
                           </div>
                         )}
                      </div>

                      {booking.status === 'pending' && (
                        <div className="flex gap-2">
                           <button 
                            onClick={() => updateDoc(doc(db, 'bookings', booking.id), { status: 'accepted', updatedAt: serverTimestamp() })} 
                            className="flex-1 py-4 bg-brand-primary text-navy-950 rounded-2xl font-black text-sm shadow-xl shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all"
                           >
                             اعتماد التجهيز
                           </button>
                           <button 
                             onClick={() => deleteDoc(doc(db, 'bookings', booking.id))}
                            className="p-4 bg-white/5 text-white/40 hover:text-danger rounded-2xl transition-all"
                           >
                             <Trash2 size={20} />
                           </button>
                        </div>
                      )}
                   </div>
                ))}
                {bookings.length === 0 && (
                  <div className="col-span-full py-40 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-30 grayscale invert">
                    <Database size={80} className="mb-6" />
                    <p className="text-2xl font-black italic">لا توجد سجلات طلبيات حالية</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'phone-doctor' ? (
            <motion.div key="phone-doctor" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-right">
              <PhoneDoctorKnowledgeView
                isMerchantView={true}
                customAdvices={advices}
                onOpenCustomAdviceModal={() => {
                  setEditingAdviceId(null);
                  setAdviceForm({ title: '', content: '', type: 'advice' });
                  setIsAdviceModalOpen(true);
                }}
                onEditCustomAdvice={(adv) => {
                  setEditingAdviceId(adv.id);
                  setAdviceForm({ title: adv.title, content: adv.content, type: adv.type });
                  setIsAdviceModalOpen(true);
                }}
                onDeleteCustomAdvice={(id) => handleDeleteAdvice(id)}
              />
            </motion.div>
          ) : activeTab === 'daily-game' ? (
            <motion.div key="daily-game" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-right">
              {/* Daily Game Merchant Control Panel */}
              <div className="card-glass p-8 border border-[#cf8a3c]/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[#cf8a3c]/5 blur-[100px] -z-10" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-white/5 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-tr from-[#cf8a3c] to-amber-500 text-navy-950 rounded-2xl flex items-center justify-center shadow-lg shadow-[#cf8a3c]/20">
                      <Trophy size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white flex items-center gap-2">
                        إدارة مسابقة "جائزة اليوم الذكية" 🏆
                      </h3>
                      <p className="text-white/60 text-xs mt-1">
                        قم بتهيئة مسابقة الـ 15 بطاقة وتحديد الـ 3 بطاقات الرابحة لزبائنك
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Active Question */}
                  <div className="space-y-2 text-right">
                    <label className="text-sm font-black text-white/60">عنوان أو سؤال المسابقة اليومية للعملاء</label>
                    <input
                      type="text"
                      className="input-field text-right w-full"
                      value={gameQuestion}
                      onChange={(e) => setGameQuestion(e.target.value)}
                      placeholder="مثال: اختر 3 بطاقات واكشف الجائزة لليوم! 🌟"
                    />
                  </div>

                  {/* Configured Prizes */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-white/60">الجوائز الثلاث للمربعات الرابحة</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {prizes.map((prize, idx) => (
                        <div key={idx} className="space-y-1">
                          <label className="text-xs text-white/40 block">الجائزة {idx + 1}</label>
                          <input
                            type="text"
                            className="input-field text-right text-xs"
                            value={prize}
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx] = e.target.value;
                              setPrizes(newPrizes);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 15 Card Grid setup */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-[#cf8a3c]">
                        {selectedWinIndices.length === 3 ? '✅ تم تحديد 3 خلايا بنجاح' : `حدد خلايا الفوز: المتبقي ${3 - selectedWinIndices.length}`}
                      </span>
                      <h4 className="text-sm font-black text-white/60">شبكة الخلايا والبطاقات الـ 15 (حدد بالضبط 3 بطاقات رابحة)</h4>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                      {Array.from({ length: 15 }).map((_, idx) => {
                        const isWinning = selectedWinIndices.includes(idx);
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (isWinning) {
                                setSelectedWinIndices(selectedWinIndices.filter(i => i !== idx));
                              } else {
                                if (selectedWinIndices.length >= 3) {
                                  alert('يمكنك اختيار 3 بطاقات رابحة فقط!');
                                  return;
                                }
                                setSelectedWinIndices([...selectedWinIndices, idx]);
                              }
                            }}
                            className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all select-none ${
                              isWinning 
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300' 
                                : 'bg-navy-950/80 border-white/5 hover:border-white/20 text-white/40'
                            }`}
                          >
                            <span className="text-sm font-black">بطاقة {idx + 1}</span>
                            {isWinning ? (
                              <span className="text-[10px] text-emerald-400 font-bold mt-1">🏆 رابحة</span>
                            ) : (
                              <span className="text-[10px] text-white/10 mt-1">فارغة</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-4 border-t border-white/5">
                    <button
                      onClick={handleSaveGameConfig}
                      disabled={gameLoading}
                      className={`px-12 py-4 rounded-2xl font-black text-navy-950 text-base shadow-xl transition-all hover:scale-105 active:scale-95 ${
                        selectedWinIndices.length === 3 
                          ? 'bg-emerald-500 shadow-emerald-500/10' 
                          : 'bg-white/10 text-white/40 cursor-not-allowed'
                      }`}
                    >
                      {gameLoading ? <Loader2 className="animate-spin mx-auto" /> : 'نشر مسابقة اليوم'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Modern Publishing Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-navy-950/95 backdrop-blur-2xl" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              className="relative w-full max-w-2xl bg-navy-900 rounded-[3rem] border border-white/10 p-10 lg:p-12 shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden"
            >
               <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-brand-primary via-blue-500 to-orange-500" />
               <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                     <div className={`p-4 rounded-2xl ${isWholesaler ? 'bg-orange-500' : 'bg-brand-primary'} text-navy-950 shadow-xl shadow-current/20`}>
                        <Zap size={24} />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-white">
                          {isWholesaler ? (isBulkPublish ? 'النشر الجماعي الاحترافي' : 'نشر صنف للجملة') : 'إنشاء حملة تسويق ذكية'}
                        </h3>
                        <p className="text-white/40 font-black text-[10px] uppercase tracking-widest mt-1">Smart Operation Engine v3.0</p>
                     </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"><X /></button>
               </div>
               
               {isWholesaler && isBulkPublish ? (
                 <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => setBulkMode('all')} className={`p-8 rounded-[2rem] font-black transition-all border-4 flex flex-col items-center gap-4 ${bulkMode === 'all' ? 'bg-orange-500 text-navy-950 border-orange-400' : 'bg-white/5 text-white/40 border-transparent hover:bg-white/10'}`}>
                         <Database size={40} />
                         <span>كل المخزن</span>
                       </button>
                       <button onClick={() => setBulkMode('category')} className={`p-8 rounded-[2rem] font-black transition-all border-4 flex flex-col items-center gap-4 ${bulkMode === 'category' ? 'bg-orange-500 text-navy-950 border-orange-400' : 'bg-white/5 text-white/40 border-transparent hover:bg-white/10'}`}>
                         <LayoutDashboard size={40} />
                         <span>حسب القسم</span>
                       </button>
                    </div>

                    {bulkMode === 'category' && (
                       <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                          <label className="text-xs font-black text-white/40 text-right block">اختر القسم المستهدف للنشر</label>
                          <select 
                            className="input-field text-right h-16 text-lg"
                            value={selectedBulkCategory}
                            onChange={(e) => setSelectedBulkCategory(e.target.value)}
                          >
                             <option value="">-- اختر قسماً من مخزنك --</option>
                             {Array.from(new Set(inventory.map(i => i.category))).filter(Boolean).map(cat => (
                               <option key={cat} value={cat}>{cat}</option>
                             ))}
                          </select>
                       </div>
                    )}

                    <div className="bg-orange-500/10 p-6 rounded-3xl border border-orange-500/20 flex gap-4">
                       <ShieldAlert className="text-orange-500 flex-shrink-0" size={24} />
                       <p className="text-xs text-orange-500 font-bold leading-relaxed text-right">
                         تنبيه: سيتم نشر الأسعار والكميات الحالية من سجلات المخزن لديك (Inventory) مباشرة إلى سوق الموردين العام. تأكد من دقة البيانات قبل المتتابعة.
                       </p>
                    </div>

                    <button 
                      disabled={loading || (bulkMode === 'category' && !selectedBulkCategory)}
                      onClick={handleBulkPublish}
                      className="w-full py-6 bg-orange-500 text-navy-950 rounded-3xl font-black text-xl shadow-2xl shadow-orange-500/20 hover:scale-[1.02] active:scale-98 transition-all disabled:opacity-30"
                    >
                      {loading ? <Loader2 className="animate-spin mx-auto" /> : 'تنفيذ النشر الجماعي الآن'}
                    </button>
                 </div>
                               ) : (
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!profile) return;
                      if (!publishingItem) return;
                      setLoading(true);
                      try {
                        const item = inventory.find(i => i.id === publishingItem.id);
                        if (!item) return;

                        if (promoteTarget === 'store') {
                          // 1. Update status in inventory
                          await updateDoc(doc(db, 'inventory', item.id), {
                            status: 'published_in_market',
                            isPromoted: true,
                            isPublished: true,
                            updatedAt: serverTimestamp()
                          });

                          // 2. Create offer
                          await smartCommerceService.createOffer({
                            itemId: item.id,
                            itemName: item.name,
                            promoPrice: wholesaleForm.price,
                            description: wholesaleForm.description || 'عرض ترويجي مميز وخاص لزبائن متجرنا الكرام!',
                            occasion: 'عرض ترويجي نشط 📣',
                            originalPrice: item.price,
                            specs: item.specs || {},
                            ownerId: profile.ownerId,
                            endTime: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
                            status: 'active'
                          });
                          alert('✓ تم بنجاح ترويج ونشر المنتج لزبائنك في المتجر الخاص!');
                        } else if (promoteTarget === 'auction') {
                          // 1. Save to public_auctions
                          await addDoc(collection(db, 'public_auctions'), {
                            storeId: profile.ownerId,
                            title: item.name,
                            price: wholesaleForm.price,
                            description: wholesaleForm.description || 'عرض ترويجي فريد في الحراج العام المفتوح للجميع!',
                            images: [item.photo || item.imageUrl || ''],
                            type: 'supplier_publish',
                            createdAt: serverTimestamp(),
                            sourceInventoryId: item.id
                          });
                          alert('✓ تم بنجاح نشر وترويج المنتج في الحراج العام المشترك لجميع الزبائن!');
                        } else if (promoteTarget === 'wholesale') {
                          // 1. Save to wholesaleProducts
                          await addDoc(collection(db, 'wholesaleProducts'), {
                            name: item.name,
                            description: wholesaleForm.description || '',
                            price: wholesaleForm.price,
                            stock: wholesaleForm.stock,
                            category: item.category || 'عام',
                            wholesalerId: profile.ownerId,
                            wholesalerName: profile.shopName || profile.name,
                            originalItemId: item.id,
                            createdAt: serverTimestamp()
                          });
                          alert('✓ تم بنجاح نشر وترويج المنتج في سوق الموردين للجملة!');
                        }
                        setIsModalOpen(false);
                      } catch (err) {
                        console.error(err);
                        alert('فشل في التنفيذ: ' + err.message);
                      } finally {
                        setLoading(false);
                      }
                    }} 
                    className="space-y-6"
                  >
                   <div className="space-y-2">
                      <label className="text-xs font-black text-white/40 text-right block">ربط العملية بسجل المخزن (Inventory)</label>
                      <select 
                         className="input-field text-right h-16 text-lg" 
                         required 
                         onChange={e => {
                           const item = inventory.find(i => i.id === e.target.value);
                           if (item) {
                             setPublishingItem(item);
                             setWholesaleForm({ price: item.price, description: '', stock: item.stock });
                           }
                         }}
                       >
                         <option value="">اكتشف الأصناف في مخزنك...</option>
                         {inventory.map(i => <option key={i.id} value={i.id}>{i.name} (المخزون: {i.stock}) - {i.category}</option>)}
                      </select>
                   </div>

                   {publishingItem && (
                     <div className="space-y-2">
                       <label className="text-xs font-black text-white/40 text-right block">وجهة الحملة الترويجية والترويج المستهدف</label>
                       <div className="grid grid-cols-3 gap-3">
                         <button 
                           type="button"
                           onClick={() => setPromoteTarget('store')}
                           className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                             promoteTarget === 'store' 
                               ? 'bg-brand-primary/20 border-brand-primary text-white font-black' 
                               : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                           }`}
                         >
                           <span className="text-xl">🔒</span>
                           <span className="text-[11px] font-black text-white">متجر زبائنك</span>
                           <span className="text-[8px] text-white/35 leading-normal">تطبيق زبائن متجرك الخاص</span>
                         </button>
                         <button 
                           type="button"
                           onClick={() => setPromoteTarget('auction')}
                           className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                             promoteTarget === 'auction' 
                               ? 'bg-brand-primary/20 border-brand-primary text-white font-black' 
                               : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                           }`}
                         >
                           <span className="text-xl">📢</span>
                           <span className="text-[11px] font-black text-white">الحراج العام</span>
                           <span className="text-[8px] text-white/35 leading-normal">يظهر لجميع زبائن المنصة</span>
                         </button>
                         <button 
                           type="button"
                           onClick={() => setPromoteTarget('wholesale')}
                           className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                             promoteTarget === 'wholesale' 
                               ? 'bg-brand-primary/20 border-brand-primary text-white font-black' 
                               : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                           }`}
                         >
                           <span className="text-xl">🏪</span>
                           <span className="text-[11px] font-black text-white">سوق الموردين</span>
                           <span className="text-[8px] text-white/35 leading-normal">عرض جملة لتجار السوق</span>
                         </button>
                       </div>
                     </div>
                   )}
                   
                   {publishingItem && (
                     <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                       <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2">
                           <label className="text-xs font-black text-white/40 text-right block">السعر المستهدف للتخفيض والترويج</label>
                           <input type="number" required className="input-field text-right h-14" value={wholesaleForm.price} onChange={e => setWholesaleForm({...wholesaleForm, price: Number(e.target.value)})} />
                         </div>
                         <div className="space-y-2">
                           <label className="text-xs font-black text-white/40 text-right block">الكمية المتاحة للترويج</label>
                           <input type="number" required className="input-field text-right h-14" value={wholesaleForm.stock} onChange={e => setWholesaleForm({...wholesaleForm, stock: Number(e.target.value)})} />
                         </div>
                       </div>
                       <div className="space-y-2">
                         <label className="text-xs font-black text-white/40 text-right block">ملاحظات وخصائص ترويجية إضافية (AI Optimized)</label>
                         <textarea className="input-field text-right p-6" rows={4} placeholder="اكتب تفاصيل جذابة تصف المنتج وتحفز على الشراء الفوري..." value={wholesaleForm.description} onChange={e => setWholesaleForm({...wholesaleForm, description: e.target.value})} />
                       </div>
                       <button type="submit" disabled={loading} className={`w-full py-6 text-xl font-black rounded-3xl transition-all shadow-2xl ${isWholesaler ? 'bg-orange-500 text-navy-950 shadow-orange-500/20' : 'bg-brand-primary text-navy-950 shadow-brand-primary/20'} hover:scale-[1.02] active:scale-98`}>
                         {loading ? <span className="animate-pulse text-white font-black text-sm block">جاري النشر والترويج...</span> : <span className="text-white font-black">إرسال وإطلاق الحملة الترويجية الذكية 🚀</span>}
                       </button>
                     </motion.div>
                   )}
                  </form>
               )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Phone Doctor Modal */}
      <AnimatePresence>
        {isAdviceModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdviceModalOpen(false)} className="absolute inset-0 bg-navy-950/95 backdrop-blur-2xl" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="relative w-full max-w-2xl bg-navy-900 rounded-[3rem] border border-white/10 p-10 lg:p-12 shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden"
            >
               <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-rose-500" />
               <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                     <div className="p-4 rounded-2xl bg-emerald-500 text-navy-950 shadow-xl shadow-current/20">
                        <Smartphone size={24} />
                     </div>
                     <div className="text-right">
                        <h3 className="text-2xl font-black text-white">
                          {editingAdviceId ? 'تعديل المنشور' : 'نشر إرشاد صيانة / سلامة جديد'}
                        </h3>
                        <p className="text-white/40 font-black text-[10px] uppercase tracking-widest mt-1">Phone Doctor Engine v1.0</p>
                     </div>
                  </div>
                  <button onClick={() => setIsAdviceModalOpen(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"><X /></button>
               </div>
               
               <form onSubmit={handleSaveAdvice} className="space-y-6 text-right">
                 <div className="space-y-2">
                   <label className="text-xs font-black text-white/40 block">نوع المنشور</label>
                   <div className="grid grid-cols-2 gap-4">
                     <button
                       type="button"
                       onClick={() => setAdviceForm({ ...adviceForm, type: 'advice' })}
                       className={`py-4 rounded-xl font-black transition-all ${adviceForm.type === 'advice' ? 'bg-emerald-500 text-navy-950' : 'bg-white/5 text-white'}`}
                     >
                       💡 نصيحة صيانة
                     </button>
                     <button
                       type="button"
                       onClick={() => setAdviceForm({ ...adviceForm, type: 'alert' })}
                       className={`py-4 rounded-xl font-black transition-all ${adviceForm.type === 'alert' ? 'bg-rose-500 text-navy-950' : 'bg-white/5 text-white'}`}
                     >
                       🚨 تنبيه سلامة
                     </button>
                   </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs font-black text-white/40 block">عنوان الإرشاد / التنبيه</label>
                   <input
                     type="text"
                     required
                     className="input-field text-right h-14"
                     placeholder="مثال: تحذير من استخدام الشواحن المقلدة"
                     value={adviceForm.title}
                     onChange={(e) => setAdviceForm({ ...adviceForm, title: e.target.value })}
                   />
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs font-black text-white/40 block">محتوى الإرشاد والتفاصيل</label>
                   <textarea
                     required
                     rows={5}
                     className="input-field text-right p-4"
                     placeholder="اكتب الإرشادات والخطوات بالتفصيل هنا لكي يستفيد منها العميل في الحفاظ على جهازه..."
                     value={adviceForm.content}
                     onChange={(e) => setAdviceForm({ ...adviceForm, content: e.target.value })}
                   />
                 </div>

                 <button
                   type="submit"
                   disabled={loading}
                   className="w-full py-5 text-lg font-black rounded-2xl transition-all shadow-xl bg-emerald-500 text-navy-950 hover:scale-[1.02] active:scale-98"
                 >
                   {loading ? <Loader2 className="animate-spin mx-auto" /> : (editingAdviceId ? 'حفظ التعديلات' : 'نشر الآن للعملاء')}
                 </button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
