import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMockData } from '../context/MockDataContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, addDoc, deleteDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { 
  BarChart3, 
  Users, 
  Settings, 
  TrendingUp, 
  Trash2, 
  Plus, 
  CheckCircle, 
  LogOut, 
  Terminal, 
  Clock, 
  Gavel, 
  ShieldAlert, 
  Phone,
  MonitorCheck,
  Crown,
  Wrench,
  PlusCircle,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  Smartphone,
  Video
} from 'lucide-react';
import { AuctionItem, RepairPrice } from '../types';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { 
    stores, 
    repairs, 
    auctions, 
    repairPrices,
    clientUser,
    toggleStoreStatus,
    addVIPCustomerAndCode,
    addStoreRepairPrice,
    deleteStoreRepairPrice,
    addStoreAuctionItem,
    deleteStoreAuctionItem,
    updateRepairTicketStatus,
    triggerManualRepeatNotification,
    proofNotifs
  } = useMockData();

  const [adminUser, setAdminUser] = useState<string>('مصعب (المالك الرئيسي)');
  const [adminRole, setAdminRole] = useState<'developer' | 'owner'>('developer');
  const [adminStoreId, setAdminStoreId] = useState<string>('');

  // Local state for logging
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'SYSTEM: البدء في تشغيل نواة بروتوكول JAM Multitenancy...',
    'SYSTEM: تم تحميل الفروع والشبكات الشريكة سحابياً بنجاح.',
    'SECURITY: تفعيل قواعد الدخول السحابي المزدوج وحقن الأكواد المقفلة.'
  ]);

  // Form states for Store Owner (VIP Customer activation)
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [activationLoading, setActivationLoading] = useState(false);

  // Form states for Repair Price CRUD
  const [newRepairDevice, setNewRepairDevice] = useState('');
  const [newRepairIssue, setNewRepairIssue] = useState('');
  const [newRepairPriceVal, setNewRepairPriceVal] = useState<number>(150);
  const [newRepairTime, setNewRepairTime] = useState('1 ساعة');

  // Form states for Auction Item CRUD
  const [newAuctionTitle, setNewAuctionTitle] = useState('');
  const [newAuctionDesc, setNewAuctionDesc] = useState('');
  const [newAuctionPrice, setNewAuctionPrice] = useState<number>(400);
  const [newAuctionIncrement, setNewAuctionIncrement] = useState<number>(50);
  const [newAuctionImage, setNewAuctionImage] = useState('https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=300');

  // Device policy states
  const [ownerMaxPCs, setOwnerMaxPCs] = useState<number>(5);
  const [ownerMaxMobiles, setOwnerMaxMobiles] = useState<number>(5);
  const [employeeMaxPCs, setEmployeeMaxPCs] = useState<number>(2);
  const [employeeMaxMobiles, setEmployeeMaxMobiles] = useState<number>(2);
  const [customerMaxPCs, setCustomerMaxPCs] = useState<number>(1);
  const [customerMaxMobiles, setCustomerMaxMobiles] = useState<number>(1);
  const [policySaveLoading, setPolicySaveLoading] = useState<boolean>(false);
  const [policySaveSuccess, setPolicySaveSuccess] = useState<string | null>(null);

  // Reels-style Promo Video states
  const [promoVideoEnabled, setPromoVideoEnabled] = useState<boolean>(false);
  const [promoVideos, setPromoVideos] = useState<any[]>([]);
  const [newPromoTitle, setNewPromoTitle] = useState('');
  const [newPromoUrl, setNewPromoUrl] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  // Load Policies on component mount
  useEffect(() => {
    async function loadDevicePolicies() {
      try {
        const policySnap = await getDoc(doc(db, 'role_policies', 'device_policy'));
        if (policySnap.exists()) {
          const data = policySnap.data();
          if (data) {
            if (data.owner) {
              setOwnerMaxPCs(Number(data.owner.max_allowed_pcs ?? 5));
              setOwnerMaxMobiles(Number(data.owner.max_allowed_mobiles ?? 5));
            }
            if (data.employee) {
              setEmployeeMaxPCs(Number(data.employee.max_allowed_pcs ?? 2));
              setEmployeeMaxMobiles(Number(data.employee.max_allowed_mobiles ?? 2));
            }
            if (data.customer) {
              setCustomerMaxPCs(Number(data.customer.max_allowed_pcs ?? 1));
              setCustomerMaxMobiles(Number(data.customer.max_allowed_mobiles ?? 1));
            }
          }
        }
      } catch (err) {
        console.error("Error loading system policies:", err);
      }
    }
    loadDevicePolicies();
  }, []);

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    setPolicySaveLoading(true);
    setPolicySaveSuccess(null);
    try {
      await setDoc(doc(db, 'role_policies', 'device_policy'), {
        owner: {
          max_allowed_pcs: ownerMaxPCs,
          max_allowed_mobiles: ownerMaxMobiles
        },
        employee: {
          max_allowed_pcs: employeeMaxPCs,
          max_allowed_mobiles: employeeMaxMobiles
        },
        customer: {
          max_allowed_pcs: customerMaxPCs,
          max_allowed_mobiles: customerMaxMobiles
        },
        updatedAt: new Date()
      });
      setPolicySaveSuccess("تم حفظ سياسة الأجهزة بنجاح وتعميمها على الأنظمة الأمنية!");
      setTerminalLogs(prev => [...prev, `SECURITY: تم تعميم وتشفير حدود الأجهزة الجديدة حياً: Owner[PC:${ownerMaxPCs}, Mob:${ownerMaxMobiles}], Employee[PC:${employeeMaxPCs}, Mob:${employeeMaxMobiles}]`]);
    } catch (err) {
      console.error("Failed to save device policies:", err);
      alert("خطأ أثناء حفظ السياسة: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPolicySaveLoading(false);
    }
  };

  useEffect(() => {
    const isLogged = localStorage.getItem('jam_admin_logged');
    if (isLogged !== 'true') {
      navigate('/login');
      return;
    }

    const cachedName = localStorage.getItem('jam_admin_username');
    if (cachedName) {
      setAdminUser(cachedName);
    }

    const role = localStorage.getItem('jam_admin_role') as any;
    const storeId = localStorage.getItem('jam_admin_store_id') || '';
    if (role) {
      setAdminRole(role);
      setAdminStoreId(storeId);
    }
  }, [navigate]);

  // Let's also prioritize the context user info if updated
  useEffect(() => {
    if (clientUser) {
      if (clientUser.role === 'developer') {
        setAdminUser(clientUser.name || 'المطور الرئيسي');
        setAdminRole('developer');
        setAdminStoreId('');
      } else if (clientUser.role === 'owner') {
        setAdminUser(clientUser.name || 'مالك المتجر');
        setAdminRole('owner');
        setAdminStoreId(clientUser.storeId || '');
      }
    }
  }, [clientUser]);

  // Reels-style Promo Video listeners & database handlers
  useEffect(() => {
    if (!adminStoreId) return;

    // A. Query if promo video is enabled for this store
    const loadPromoEnabledState = async () => {
      try {
        const storeRef = doc(db, 'stores', adminStoreId);
        const storeSnap = await getDoc(storeRef);
        if (storeSnap.exists()) {
          setPromoVideoEnabled(!!storeSnap.data().is_promo_video_enabled);
        } else {
          // fallback to checking the user Profile
          const userRef = doc(db, 'users', adminStoreId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setPromoVideoEnabled(!!userSnap.data().is_promo_video_enabled);
          }
        }
      } catch (err) {
        console.error("Error loading promo video configuration:", err);
      }
    };
    loadPromoEnabledState();

    // B. Real-time synchronizer for videos with strict multi-tenant isolation
    const currentStoreId = localStorage.getItem('CURRENT_STORE_ID') || adminStoreId;
    const qVideos = query(
      collection(db, 'promo_videos'),
      where('store_id', '==', currentStoreId)
    );
    const unsubscribe = onSnapshot(qVideos, (snapshot) => {
      const vids: any[] = [];
      snapshot.forEach((snap) => {
        vids.push({ id: snap.id, ...snap.data() });
      });
      vids.sort((a, b) => {
        const secsA = a.createdAt?.seconds || 0;
        const secsB = b.createdAt?.seconds || 0;
        return secsB - secsA;
      });
      setPromoVideos(vids);
    }, (err) => {
      console.error("Error loading promo videos live stream:", err);
    });

    return () => unsubscribe();
  }, [adminStoreId]);

  const handleAddPromoVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoTitle.trim() || !newPromoUrl.trim()) {
      alert("فضلاً أدخل العنوان ورابط الفيديو.");
      return;
    }

    setPromoLoading(true);
    try {
      const payload = {
        store_id: adminStoreId,
        storeId: adminStoreId,
        title: newPromoTitle.trim(),
        videoUrl: newPromoUrl.trim(),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'promo_videos'), payload);
      setNewPromoTitle('');
      setNewPromoUrl('');
      setTerminalLogs(logs => [
        `REELS_ENGINE: تم رفع وحفظ مقطع الفيديو الترويجي الجديد [${newPromoTitle}] بنجاح حياً بالخادم.`,
        ...logs
      ]);
    } catch (err: any) {
      console.error("Error adding promo video:", err);
      alert("خطأ أثناء إضافة الفيديو: " + err.message);
    } finally {
      setPromoLoading(false);
    }
  };

  const handleDeletePromoVideo = async (videoId: string, title: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف الفيديو "${title}"؟`)) return;

    try {
      await deleteDoc(doc(db, 'promo_videos', videoId));
      setTerminalLogs(logs => [
        `REELS_ENGINE: تم حذف مقطع الفيديو الترويجي [${title}] بنظام المتجر حياً.`,
        ...logs
      ]);
    } catch (err: any) {
      console.error("Error deleting video:", err);
      alert("فشل حذف الفيديو: " + err.message);
    }
  };

  const handleAdminSignout = () => {
    localStorage.removeItem('jam_admin_logged');
    localStorage.removeItem('jam_admin_username');
    localStorage.removeItem('jam_admin_role');
    localStorage.removeItem('jam_admin_store_id');
    navigate('/login');
  };

  const handleToggleStoreLive = async (storeId: string, currentStatus: string) => {
    const res = await toggleStoreStatus(storeId, currentStatus);
    if (res.success) {
      setTerminalLogs(logs => [
        `TENANT_MANAGER: تم تحديث حالة الفرع [${storeId.toUpperCase()}] إلى [${res.nextStatus.toUpperCase()}] حياً بالسيرفر`,
        ...logs
      ]);
    } else {
      setTerminalLogs(logs => [
        `⚠️ ERROR: فشل تحديث حالة المتجر للفرع [${storeId.toUpperCase()}]`,
        ...logs
      ]);
    }
  };

  const handleGenerateVIPCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      alert('فضلاً أدخل اسم ورقم الزبون بالكامل.');
      return;
    }

    setActivationLoading(true);
    const targetStore = adminStoreId || 'al-fuji';
    
    // Call cross-project dual Firestore activation workflows
    const res = await addVIPCustomerAndCode(targetStore, newCustomerName, newCustomerPhone);
    setActivationLoading(false);
    
    if (res.success && res.code) {
      setGeneratedCode(res.code);
      setTerminalLogs(logs => [
        `VIP_ENGINE: تم تسجيل العميل [${newCustomerName}] بنجاح وتوليد رمز التنشيط المستقل [${res.code}]`,
        ...logs
      ]);
    } else {
      alert('حدث خطأ أثناء الاتصال وتوليد الكود بالخادم.');
    }
  };

  const handleSendWhatsApp = () => {
    if (!newCustomerPhone || !generatedCode) return;
    
    const storeName = stores.find(s => s.id === adminStoreId)?.name || 'متجر JAM الشريك';
    const cleanPhone = newCustomerPhone.trim().replace(/[^0-9]/g, '');
    
    const msg = `أهلاً بك يا من عهدناهم كراماً 👑، تم تفعيل عضويتك الـ VIP بنجاح في ${storeName}. كود تفعيل الفرع الملكي المكون من 8 خانات هو: ${generatedCode}. يرجى الدخول للمنصة وتفعيله لربح 1250 نقطة ترحيبية!`;
    
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // CRUD handlers for Repair Prices
  const handleAddRepairPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepairDevice.trim() || !newRepairIssue.trim()) return;

    const newPriceItem: RepairPrice = {
      id: `rp_${adminStoreId || 'al-fuji'}_${Date.now()}`,
      device: newRepairDevice,
      issue: newRepairIssue,
      price: Number(newRepairPriceVal),
      timeEstimated: newRepairTime
    };

    const success = await addStoreRepairPrice(adminStoreId || 'al-fuji', newPriceItem);
    if (success) {
      setNewRepairDevice('');
      setNewRepairIssue('');
      setTerminalLogs(logs => [
        `PRICING_ENGINE: تم إضافة سعر صيانة جديد لجهاز [${newRepairDevice}] بنجاح في المتجر`,
        ...logs
      ]);
    }
  };

  const handleDeleteRepairPrice = async (priceId: string) => {
    const success = await deleteStoreRepairPrice(adminStoreId || 'al-fuji', priceId);
    if (success) {
      setTerminalLogs(logs => [
        `PRICING_ENGINE: تم إقصاء بند الصيانة ذو المعرف [${priceId}] من المتجر حياً`,
        ...logs
      ]);
    }
  };

  // CRUD handlers for Auction Inventory Items
  const handleAddAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuctionTitle.trim() || !newAuctionDesc.trim()) return;

    const newItem: AuctionItem = {
      id: `auc_${adminStoreId || 'al-fuji'}_${Date.now()}`,
      title: newAuctionTitle,
      description: newAuctionDesc,
      currentBid: Number(newAuctionPrice),
      minIncrement: Number(newAuctionIncrement),
      imageUrl: newAuctionImage,
      endsAt: new Date(Date.now() + 1000 * 60 * 1440 * 7).toISOString(), // 7 days from now
      status: 'active',
      highestBidder: 'لا يوجد مزايدين بعد',
      highestBidderUid: 'none'
    };

    const success = await addStoreAuctionItem(adminStoreId || 'al-fuji', newItem);
    if (success) {
      setNewAuctionTitle('');
      setNewAuctionDesc('');
      setTerminalLogs(logs => [
        `AUCTION_ENGINE: تم إدراج هاتف للمزاد المكتنز [${newAuctionTitle}] بنجاح حياً`,
        ...logs
      ]);
    }
  };

  const handleDeleteAuction = async (aucId: string) => {
    const success = await deleteStoreAuctionItem(adminStoreId || 'al-fuji', aucId);
    if (success) {
      setTerminalLogs(logs => [
        `AUCTION_ENGINE: تم إقصاء المزاد ذو المعرف [${aucId}] من مخزن المحل بنجاح`,
        ...logs
      ]);
    }
  };

  // Filter collections by store scope if logged in as store owner
  const currentStoreData = stores.find(s => s.id === adminStoreId);
  const storeRepairs = adminRole === 'owner' 
    ? repairs.filter(r => r.storeId === adminStoreId || !r.storeId) 
    : repairs;
  const storeAuctions = adminRole === 'owner'
    ? auctions.filter(a => a.id.includes(adminStoreId) || a.storeId === adminStoreId || !a.storeId)
    : auctions;
  const storeRepairPrices = adminRole === 'owner'
    ? repairPrices.filter(rp => rp.id.includes(adminStoreId) || rp.storeId === adminStoreId || !rp.storeId)
    : repairPrices;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-right select-none font-sans" dir="rtl" id="saas-portal-view">
      
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-amber-500/15 pb-6 mb-8" id="saas-main-header">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-550 to-yellow-600 flex items-center justify-center text-slate-950 text-2xl shadow-xl">
            🔱
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-black text-white">
                {adminRole === 'developer' ? 'بوابة التحكم والتدقيق الموحدة (SaaS Portal)' : `لوحة الإدارة والحراج الخاص: ${currentStoreData?.name || 'الفرع الملكي'}`}
              </h1>
              <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-yellow-500 text-[9px] uppercase font-black rounded-full tracking-wider">
                {adminRole === 'developer' ? 'DEVELOPER ROOT CONTROL' : 'AUTHORIZED TENANT OWNER'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              مرحباً بك {adminUser}. لديك تحكم مخصص لإثراء الفواتير، المزادات، والتراخيص المذهبة.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleAdminSignout}
            className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/25 text-rose-400 px-4.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج الموثوقية الخارجي</span>
          </button>
        </div>
      </div>

      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" id="saas-stats-hud">
        <div className="bg-[#0b0c10] border border-white/[0.04] p-4.5 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex justify-between items-start text-slate-400 text-[10px] font-bold">
            <span>عدد الشبكات المتاحة</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          </div>
          <span className="text-2xl font-black text-white mt-2 block font-mono">
            {adminRole === 'developer' ? stores.length : 1}
          </span>
          <p className="text-[9.5px] text-slate-500 mt-1">الهويات التفاعلية المتصلة</p>
        </div>

        <div className="bg-[#0b0c10] border border-white/[0.04] p-4.5 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex justify-between items-start text-slate-400 text-[10px] font-bold">
            <span>تذاكر صيانة الهاتف</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          </div>
          <span className="text-2xl font-black text-white mt-2 block font-mono">
            {storeRepairs.length}
          </span>
          <p className="text-[9.5px] text-slate-500 mt-1">تراخيص معلقة ومستلمة</p>
        </div>

        <div className="bg-[#0b0c10] border border-white/[0.04] p-4.5 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex justify-between items-start text-slate-400 text-[10px] font-bold">
            <span>عروض المزاد والمخزن</span>
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
          </div>
          <span className="text-2xl font-black text-white mt-2 block font-mono">
            {storeAuctions.length}
          </span>
          <p className="text-[9.5px] text-slate-500 mt-1">سعر المزايدة الحالية للجهاز</p>
        </div>

        <div className="bg-[#0b0c10] border border-white/[0.04] p-4.5 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex justify-between items-start text-slate-400 text-[10px] font-bold">
            <span>البنود والتسعيرات بمحلك</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <span className="text-2xl font-black text-white mt-2 block font-mono">
            {storeRepairPrices.length}
          </span>
          <p className="text-[9.5px] text-slate-500 mt-1">قائمة طبيب الصيانة المعزز</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="saas-dashboard-grid">
        
        
        <div className="lg:col-span-2 space-y-8">
          
          
          {adminRole === 'owner' && (
            <div className="bg-gradient-to-b from-[#111116] to-[#07070a] border-2 border-amber-500/20 p-6 rounded-3xl shadow-xl space-y-6">
              <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
                <Crown className="w-5 h-5 text-amber-500 animate-bounce" />
                <h3 className="font-extrabold text-[#ffffff] text-sm">إضافة وتفعيل عملاء VIP بالفرع (توليد كود التفعيل المذهب)</h3>
              </div>

              <form onSubmit={handleGenerateVIPCode} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 px-1">اسم الزبون الكريم:</label>
                  <input
                    type="text"
                    placeholder="مثال: يزن محمد شرف"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full bg-[#13131a] border border-white/5 focus:border-amber-400 rounded-xl px-4 py-3 text-xs text-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 px-1">رقم الهاتف للزبون (تفعيل الواتساب):</label>
                  <input
                    type="tel"
                    placeholder="مثال: 777000000"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-[#13131a] border border-white/5 focus:border-amber-400 rounded-xl px-4 py-3 text-xs text-white text-center font-mono outline-none"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={activationLoading}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-xs rounded-xl hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2"
                  >
                    {activationLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    ) : 'توليد كود التنشيط وحجز الهوية بـ Firestore ✓'}
                  </button>
                </div>
              </form>

              {generatedCode && (
                <div className="p-5 bg-amber-950/20 border-2 border-dashed border-amber-500/40 rounded-2xl text-center space-y-3.5 animate-fade-in">
                  <span className="text-amber-500 font-black text-xs block">تم إدراج كود الزبون بنجاح في الحساب السحابي المزدوج!</span>
                  <div className="font-mono text-3xl font-black text-white tracking-widest bg-black/40 py-2 rounded-xl inline-block px-8 border border-white/5">
                    {generatedCode}
                  </div>
                  <p className="text-[10.5px] text-slate-450 leading-relaxed max-w-sm mx-auto">
                    تم توثيق الكود لـ ({newCustomerName}) بقيمة 1250 نقطة مجانية. بإمكانك الضغط فوراً لإرساله عبر الواتساب.
                  </p>
                  
                  <button
                    onClick={handleSendWhatsApp}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>إرسال البيانات عبر الواتساب ◄</span>
                  </button>
                </div>
              )}
            </div>
          )}

          
          {adminRole === 'owner' && (
            <div className="bg-gradient-to-b from-[#111116] to-[#07070a] border border-white/[0.03] p-6 rounded-3xl shadow-xl space-y-6">
              <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
                <Wrench className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-white text-sm">طبيب الهاتف: تعديل أسعار الصيانة الفورية بالفرع</h3>
              </div>

              
              <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                {storeRepairPrices.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-6">لا يوجد بنود تسعير بالمتجر حالياً، يرجى ملء الحقول بالأسفل لتلقيح دليل الصيانة.</p>
                ) : (
                  storeRepairPrices.map((rp: any) => (
                    <div key={rp.id} className="bg-black/35 border border-white/[0.02] p-4 rounded-2xl flex justify-between items-center gap-4 text-xs">
                      <div>
                        <h4 className="font-extrabold text-amber-100">{rp.device}</h4>
                        <p className="text-slate-400 text-[10.5px] mt-1">مشكلة: {rp.issue} • الوقت: {rp.timeEstimated || '1 ساعة'}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-black text-emerald-400">{rp.price} ر.س</span>
                        <button
                          onClick={() => handleDeleteRepairPrice(rp.id)}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              
              <form onSubmit={handleAddRepairPrice} className="bg-[#050508] p-4 rounded-2xl border border-white/[0.04] space-y-4">
                <span className="text-[10px] font-black text-amber-500 uppercase block">أضف خيار خدمات صيانة جديد:</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="اسم الهاتف (مثال: iPhone 15 Pro Max)"
                    value={newRepairDevice}
                    onChange={(e) => setNewRepairDevice(e.target.value)}
                    className="bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none"
                    required
                  />

                  <input
                    type="text"
                    placeholder="وصف المشكلة (مثال: تغيير زجاج الهاتف الليزري)"
                    value={newRepairIssue}
                    onChange={(e) => setNewRepairIssue(e.target.value)}
                    className="bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none"
                    required
                  />

                  <input
                    type="number"
                    placeholder="التكلفة (ر.س)"
                    value={newRepairPriceVal}
                    onChange={(e) => setNewRepairPriceVal(Number(e.target.value))}
                    className="bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none font-mono"
                    required
                  />

                  <input
                    type="text"
                    placeholder="الوقت المقدر (مثال: 45 دقيقة)"
                    value={newRepairTime}
                    onChange={(e) => setNewRepairTime(e.target.value)}
                    className="bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none"
                    required
                  />

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#1b1509] border border-amber-500/30 text-amber-400 hover:bg-[#2e230f] rounded-xl text-xs font-black transition"
                    >
                      + إرفاق الخيار وحفظ كحقل سحابي حي
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          
          {adminRole === 'owner' && promoVideoEnabled && (
            <div className="bg-gradient-to-b from-[#111116] to-[#07070a] border border-amber-500/20 p-6 rounded-3xl shadow-xl space-y-6">
              <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
                <Video className="w-5 h-5 text-amber-500 animate-pulse" />
                <h3 className="font-extrabold text-white text-sm">إدارة العروض المرئية (Reels Feed Manager)</h3>
              </div>

              
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {promoVideos.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-6">لم يتم إضافة أي عروض ترويجية حتى الآن. أضف روابط الفيديو بالأسفل لتظهر لعملائك.</p>
                ) : (
                  promoVideos.map((vid) => (
                    <div key={vid.id} className="bg-black/35 border border-white/[0.02] p-4 rounded-2xl flex justify-between items-center gap-4 text-xs">
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-amber-100 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          {vid.title}
                        </h4>
                        <p className="text-slate-400 text-[10px] font-mono select-all break-all">{vid.videoUrl || vid.url}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <a 
                          href={vid.videoUrl || vid.url} 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          rel="noopener noreferrer" 
                          className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] transition font-bold font-sans"
                        >
                          استعراض ↗
                        </a>
                        <button
                          onClick={() => handleDeletePromoVideo(vid.id, vid.title)}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition"
                          title="حذف الفيديو"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              
              <form onSubmit={handleAddPromoVideo} className="bg-[#050508] p-4 rounded-2xl border border-white/[0.04] space-y-4">
                <span className="text-[10px] font-black text-amber-500 uppercase block">إضافة فيديو ترويجي جديد:</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 block px-1">عنوان العرض الترويجي</label>
                    <input
                      type="text"
                      placeholder="مثال: استعراض آيفون 15 المذهب المتكامل"
                      value={newPromoTitle}
                      onChange={(e) => setNewPromoTitle(e.target.value)}
                      className="w-full bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 block px-1">رابط الفيديو الخارجي (YouTube / Vimeo / Direct Link)</label>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=... أو رابط مباشر"
                      value={newPromoUrl}
                      onChange={(e) => setNewPromoUrl(e.target.value)}
                      className="w-full bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none font-mono text-left"
                      required
                    />
                  </div>

                  <div className="md:col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={promoLoading}
                      className="w-full py-3 bg-[#1b1509] border border-amber-500/30 text-amber-400 hover:bg-[#2e230f] rounded-xl text-xs font-black transition flex items-center justify-center gap-2"
                    >
                      {promoLoading ? (
                        <span className="inline-block w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        '💾 حفظ العرض وتعميمه على بوابة الزبائن الحية'
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-gray-500 bg-amber-500/[0.02] p-3 rounded-xl border border-amber-500/5 leading-relaxed">
                  💡 <b className="text-amber-400 font-bold">تنبيه أمني وصناعي:</b> يمنع رفع مقاطع الفيديو مباشرة للسيرفر لتخفيض استهلاك الموارد المحدودة. يرجى الاكتفاء بتضمين الروابط الخارجية للفيديوهات المرفوعة مسبقاً على منصات الفيديو كـ YouTube أو Vimeo أو روابط البث المباشرة.
                </div>
              </form>
            </div>
          )}

          
          {adminRole === 'owner' && (
            <div className="bg-gradient-to-b from-[#111116] to-[#07070a] border border-white/[0.03] p-6 rounded-3xl shadow-xl space-y-6">
              <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
                <Gavel className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-white text-sm">مخزن الحراج: إضافة وإدارة معروضات المزاد بالمحل</h3>
              </div>

              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {storeAuctions.length === 0 ? (
                  <p className="col-span-2 text-center text-slate-500 text-xs py-4">مخزن الحراج خالٍ تماماً في هويتك الحالية.</p>
                ) : (
                  storeAuctions.map((auc: any) => (
                    <div key={auc.id} className="bg-black/40 border border-white/[0.03] p-4.5 rounded-2xl flex gap-3 relative overflow-hidden">
                      <div className="w-16 h-16 bg-slate-900 rounded-xl overflow-hidden border border-white/5 shrink-0">
                        <img src={auc.imageUrl} alt={auc.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="text-xs space-y-1 flex-1">
                        <h4 className="font-extrabold text-white line-clamp-1">{auc.title}</h4>
                        <p className="text-[10.5px] text-slate-400 line-clamp-2 leading-relaxed">{auc.description}</p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="font-mono text-amber-400 font-bold">{auc.currentBid} ر.س</span>
                          <button
                            onClick={() => handleDeleteAuction(auc.id)}
                            className="text-rose-400 hover:text-rose-300 font-extrabold text-[10px]"
                          >
                            حذف العرض ⚠️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              
              <form onSubmit={handleAddAuction} className="bg-[#050508] p-4 rounded-2xl border border-white/[0.04] space-y-4">
                <span className="text-[10px] font-black text-amber-500 uppercase block">أضف جهاز جديد في حراسة الحراج والمخزن:</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="اسم الجوال الملكي أو الإكسسوار"
                    value={newAuctionTitle}
                    onChange={(e) => setNewAuctionTitle(e.target.value)}
                    className="bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none"
                    required
                  />

                  <input
                    type="text"
                    placeholder="صورة الجهاز (رابط مباشر)"
                    value={newAuctionImage}
                    onChange={(e) => setNewAuctionImage(e.target.value)}
                    className="bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none font-mono text-left"
                    required
                  />

                  <input
                    type="number"
                    placeholder="سعر البداية الأصلي (ر.س)"
                    value={newAuctionPrice}
                    onChange={(e) => setNewAuctionPrice(Number(e.target.value))}
                    className="bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none font-mono"
                    required
                  />

                  <input
                    type="number"
                    placeholder="الارتفاع الأدنى للمزايدة (ر.س)"
                    value={newAuctionIncrement}
                    onChange={(e) => setNewAuctionIncrement(Number(e.target.value))}
                    className="bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none font-mono"
                    required
                  />

                  <div className="md:col-span-2">
                    <textarea
                      placeholder="وصف تفصيلي دقيق للمنتج ومواصفاته الفنية ونظافته..."
                      value={newAuctionDesc}
                      onChange={(e) => setNewAuctionDesc(e.target.value)}
                      className="w-full bg-[#121217] text-white border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none h-20"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#1b1509] border border-amber-500/30 text-amber-400 hover:bg-[#2e230f] rounded-xl text-xs font-black transition"
                    >
                      + إرفاق المعروض الملكي وإطلاقه للمزاد
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          
          {adminRole === 'developer' && (
            <div className="bg-gradient-to-[#071324] border border-white/[0.04] p-6 rounded-3xl shadow-xl space-y-6">
              <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
                <div className="flex items-center gap-1.5">
                  <Settings className="w-5 h-5 text-amber-500" />
                  <h3 className="font-extrabold text-sm text-white">إدارة الفروع والشبكات الشريكة (Multi-Tenant Master)</h3>
                </div>
                <span className="text-[10px] text-slate-500">منظومة موحدة عابرة للمشاريع</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stores.map(st => (
                  <div key={st.id} className="bg-slate-950/45 p-4 rounded-2xl border border-white/[0.03] space-y-3">
                    <div className="flex justify-between items-start text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 overflow-hidden text-2xl flex items-center justify-center">
                          {st.logoUrl && st.logoUrl.startsWith('http') ? (
                            <img src={st.logoUrl} alt={st.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{st.logo || '🏪'}</span>
                          )}
                        </div>
                        <div>
                          <span className="font-extrabold text-white truncate max-w-[135px] block">{st.name}</span>
                          <span className="text-[10px] font-mono text-slate-500 block">UID: {st.id}</span>
                        </div>
                      </div>

                      <span 
                        className="px-2 py-0.5 rounded text-[8.5px] font-bold font-sans text-slate-950 shrink-0 capitalize"
                        style={{ backgroundColor: st.primaryColor }}
                      >
                        {st.id}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 h-8">{st.description}</p>
                    
                    <div className="flex items-center justify-between border-t border-white/[0.03] pt-2.5 mt-2">
                      <span className="text-[10px] font-bold text-slate-450">
                        الحالة: {st.storeStatus === 'suspended' ? '🚫 موقوف' : '🟢 نشط وسحابي'}
                      </span>
                      <button
                        onClick={() => handleToggleStoreLive(st.id, st.storeStatus || 'withdrawn')}
                        className={`px-3 py-1 bg-[#221010] border rounded-lg text-[9.5px] font-extrabold transition-all duration-300 active:scale-95 ${
                          st.storeStatus === 'suspended'
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {st.storeStatus === 'suspended' ? 'تنشيط الفرع بالكامل' : 'تجميد وايقاف الفرع'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          
          <div className="bg-gradient-to-b from-[#111116] to-[#07070a] border border-amber-500/15 p-6 rounded-3xl shadow-xl space-y-6 text-right">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-white text-sm">إعدادات سياسة الأجهزة (Device Policy Settings)</h3>
              </div>
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-black">الحماية السيبرانية</span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              قم بتهيئة الحد الأقصى المسموح به للأجهزة المرتبطة بكل دور وظيفي بالمنظومة (المالك، الموظف، العميل) للحد من استغلال التراخيص واختراق الجلسات المتزامنة. يتم تطبيق هذه الحدود تلقائياً فور محاولة الدخول.
            </p>

            <form onSubmit={handleSavePolicies} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
                
                
                <div className="bg-[#0c0c10] border border-white/[0.03] p-4 rounded-2xl space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-white/[0.02] pb-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-white text-xs">حساب المالك (Owner)</span>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-450 block font-bold">حد أجهزة الكمبيوتر (max_allowed_pcs)</label>
                      <input 
                        type="number"
                        min="1"
                        max="20"
                        value={ownerMaxPCs}
                        onChange={(e) => setOwnerMaxPCs(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#121217] text-white border border-white/5 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-450 block font-bold">حد أجهزة الجوال (max_allowed_mobiles)</label>
                      <input 
                        type="number"
                        min="1"
                        max="20"
                        value={ownerMaxMobiles}
                        onChange={(e) => setOwnerMaxMobiles(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#121217] text-white border border-white/5 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                
                <div className="bg-[#0c0c10] border border-white/[0.03] p-4 rounded-2xl space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-white/[0.02] pb-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-white text-xs">الموظفون (Employee)</span>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-450 block font-bold">حد أجهزة الكمبيوتر (max_allowed_pcs)</label>
                      <input 
                        type="number"
                        min="1"
                        max="20"
                        value={employeeMaxPCs}
                        onChange={(e) => setEmployeeMaxPCs(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#121217] text-white border border-white/5 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-450 block font-bold">حد أجهزة الجوال (max_allowed_mobiles)</label>
                      <input 
                        type="number"
                        min="1"
                        max="20"
                        value={employeeMaxMobiles}
                        onChange={(e) => setEmployeeMaxMobiles(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#121217] text-white border border-white/5 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                
                <div className="bg-[#0c0c10] border border-white/[0.03] p-4 rounded-2xl space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-white/[0.02] pb-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">العملاء (Customer)</span>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-450 block font-bold">حد أجهزة الكمبيوتر (max_allowed_pcs)</label>
                      <input 
                        type="number"
                        min="1"
                        max="20"
                        value={customerMaxPCs}
                        onChange={(e) => setCustomerMaxPCs(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#121217] text-white border border-white/5 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-450 block font-bold">حد أجهزة الجوال (max_allowed_mobiles)</label>
                      <input 
                        type="number"
                        min="1"
                        max="20"
                        value={customerMaxMobiles}
                        onChange={(e) => setCustomerMaxMobiles(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#121217] text-white border border-white/5 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

              </div>

              {policySaveSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs font-black">
                  ✓ {policySaveSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={policySaveLoading}
                className="w-full py-2.5 bg-[#1b1509] border border-amber-500/30 text-amber-400 hover:bg-[#2e230f] disabled:opacity-50 rounded-xl text-xs font-black transition relative overflow-hidden flex items-center justify-center gap-1.5"
              >
                {policySaveLoading ? "جاري تشفير وتعميم السياسة..." : "حفظ السياسة وتكبير جدار الحماية السيبراني 🛡️"}
              </button>
            </form>
          </div>

          
          <div className="bg-[#02050a] border border-white/[0.1] rounded-3xl overflow-hidden shadow-inner">
            <div className="bg-[#051124] px-5 py-3 border-b border-white/[0.04] flex justify-between items-center">
              <span className="text-[10.5px] text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                <span>JAM Live Console Stream • node_0@accountingDb</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            </div>

            <div className="p-4 font-mono text-[10px] text-emerald-400/90 space-y-2 h-36 overflow-y-auto bg-black/85">
              {terminalLogs.map((log, idx) => (
                <div key={idx} className="flex gap-2 text-right justify-start" dir="ltr">
                  <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                  <span className="leading-relaxed whitespace-pre-wrap">{log}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        
        <div className="space-y-8">
          
          
          {adminRole === 'owner' && currentStoreData && (
            <div className="bg-gradient-to-b from-[#181104] via-[#0b0f14] to-[#040810] border-2 border-amber-500/35 p-6 rounded-3xl shadow-xl relative overflow-hidden text-right" id="store-profile-doc">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-3xl -z-10"></div>
              
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-amber-500/20 overflow-hidden flex items-center justify-center text-amber-500 text-3xl mb-4">
                {currentStoreData.logoUrl && currentStoreData.logoUrl.startsWith('http') ? (
                  <img src={currentStoreData.logoUrl} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  <span>🏪</span>
                )}
              </div>

              <h3 className="font-extrabold text-white text-base leading-tight">{currentStoreData.name}</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">{currentStoreData.description}</p>
              
              <div className="h-px bg-white/[0.04] my-4"></div>

              <div className="space-y-2.5 text-xs text-slate-400 font-medium">
                <div className="flex items-center justify-between">
                  <span>هاتف لفرع للاتصال:</span>
                  <span className="font-mono text-amber-100">{currentStoreData.phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>المدينة والعنوان:</span>
                  <span className="text-amber-100">{currentStoreData.address}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>لون الهوية المعتمد:</span>
                  <span className="font-mono" style={{ color: currentStoreData.primaryColor }}>
                    {currentStoreData.primaryColor}
                  </span>
                </div>
              </div>

              <div className="mt-5 p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[10.5px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                <span>جميع الأجهزة والإدراجات محمية بتشفير SSL عابر للشبكات.</span>
              </div>
            </div>
          )}

          
          <div className="bg-[#0b0c10] border border-white/[0.04] p-5 rounded-3xl shadow-lg">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 mb-4 border-b border-white/[0.04] pb-2.5 flex items-center gap-1.5">
              <MonitorCheck className="w-4 h-4 text-amber-500" />
              <span>تذاكر وأجهزة الصيانة والخدمات بالمتجر ({storeRepairs.length})</span>
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {storeRepairs.length === 0 ? (
                <p className="text-center text-slate-500 text-xs py-4">مستقر وخالٍ من أعطال الصيانة الفورية حالياً.</p>
              ) : (
                storeRepairs.map((tk: any) => (
                  <div key={tk.id} className="bg-black/30 border border-white/[0.02] p-4 rounded-2xl space-y-3 transition hover:border-amber-500/20">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-black tracking-wider shadow">
                          {tk.ticketNumber}
                        </span>
                        <span className="font-bold text-white mb-0.5">{tk.customerName} ({tk.customerPhone || 'بدون جوال'})</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        tk.status === 'ready' ? 'bg-emerald-500/15 text-emerald-400' :
                        tk.status === 'delivered' ? 'bg-slate-500/10 text-slate-500' :
                        tk.status === 'failed_repair' ? 'bg-rose-500/15 text-rose-400' :
                        'bg-amber-500/15 text-amber-400 animate-pulse'
                      }`}>
                        {tk.status === 'ready' ? 'جاهز للاستلام ✓' :
                         tk.status === 'delivered' ? 'تم التسليم والمطابقة' : 
                         tk.status === 'failed_repair' ? 'تعذر الإصلاح ❌' : 'قيد اللحام والعمل الفني'}
                      </span>
                    </div>

                    <p className="text-[10.5px] text-slate-450 leading-relaxed">الجهاز: {tk.device} • العطل: {tk.issue}</p>
                    <p className="text-[9px] text-slate-550 italic bg-black/20 p-2 rounded-lg border border-white/[0.01]">الملاحظة: {tk.notes || 'لا يوجد ملحوظة مسجلة'}</p>

                    
                    <div className="text-[9.5px] text-slate-400 bg-rose-500/5 border border-rose-500/10 p-2 rounded-xl flex flex-col gap-1 leading-relaxed">
                      <span className="font-black text-rose-400">🛡️ تنبيه الحماية القانوني المعتمد:</span>
                      <span>"يرجى استلام جهازك، الإدارة تخلي مسؤوليتها تماماً عن فقدان أو تلف الهاتف بعد مرور المدة القانونية."</span>
                    </div>

                    
                    <div className="pt-2 border-t border-white/[0.03] flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateRepairTicketStatus(adminStoreId || 'al-fuji', tk.id, 'ready')}
                          className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[9.5px] font-bold transition"
                        >
                          جاهز للتسليم ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRepairTicketStatus(adminStoreId || 'al-fuji', tk.id, 'repairing')}
                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[9.5px] font-bold transition"
                        >
                          قيد الإصلاح ⏳
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRepairTicketStatus(adminStoreId || 'al-fuji', tk.id, 'failed_repair')}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[9.5px] font-bold transition"
                        >
                          تعذر الإصلاح ❌
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRepairTicketStatus(adminStoreId || 'al-fuji', tk.id, 'delivered')}
                          className="px-2 py-1 bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 rounded-lg text-[9.5px] font-bold transition"
                        >
                          تم تسليمه 📦
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => triggerManualRepeatNotification(tk.id)}
                        className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-[9.5px] hover:brightness-110 active:scale-95 transition shadow-sm"
                      >
                        تذكير جوال يدوي (SMS) 🚨
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          
          <div className="bg-[#0a0f18]/30 border border-amber-500/10 p-5 rounded-3xl text-xs space-y-3.5 text-slate-400">
            <span className="font-extrabold text-[#cca825] flex items-center gap-1">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              توجيهات فنية وتحذيرات:
            </span>
            <p className="leading-relaxed text-[11px]">
              طبيب الهاتف يعتمد على إعدادات تسعير فوري حية يتم تقديمها لحساب الزبائن VIP فور تشغيل التطبيق. أي تعديل يتم حفظه حياً في الـ Firestore.
            </p>
            <p className="leading-relaxed text-[11px]">
              يرجى التأكد من تسليم الهواتف بعد مطابقة الكود المكتسح والمطابق لرمز الفاتورة JAM لضمان سلامة الأرصدة والولاء ببروتوكول النقاط المذهب.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
