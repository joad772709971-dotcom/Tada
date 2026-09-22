import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Package, 
  Truck, 
  ShieldAlert, 
  FileLock2, 
  UserCheck,
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Search,
  User,
  ClipboardList,
  RefreshCw,
  Box,
  Plus,
  MapPin,
  Save,
  Trash2,
  Bell,
  Activity,
  ArrowRight,
  Upload,
  Camera,
  FileSpreadsheet,
  Layers,
  Send,
  History,
  ShoppingCart,
  TrendingDown,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc,
  arrayUnion, 
  writeBatch, 
  increment 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, WarehousePrepOrder, ShortageItem } from '../types';

// Import child utilities & screens
import DeliveryAgentPortal from './DeliveryAgentPortal';
import SmartImport from './SmartImport';
import InvoiceScanner from './InvoiceScanner';
import ReturnTestingAndMatching from './ReturnTestingAndMatching';

interface WorkforceWorkspaceProps {
  profile: UserProfile | null;
}

export default function WorkforceWorkspace({ profile }: WorkforceWorkspaceProps) {
  // Tabs: prep (Warehouse Prep), delivery (Driver Panel), returns (Returns)
  const [activeTab, setActiveTab] = useState<'prep' | 'delivery' | 'returns'>('prep');

  // Enforce server-side role check simulation and RBAC fences
  const isManagerOrAdmin = 
    profile?.role === 'manager' || 
    profile?.role === 'superadmin' || 
    profile?.role === 'owner';

  const isDriver = 
    profile?.email?.includes('driver') || 
    profile?.name?.includes('سائق') || 
    profile?.name?.includes('مندوب') || 
    window.location.hash.includes('delivery');

  const isPreparer = 
    profile?.email?.includes('prep') || 
    profile?.name?.includes('محضر') || 
    profile?.name?.includes('مخزن') || 
    window.location.hash.includes('warehouse');

  // Load default tab based on roles
  useEffect(() => {
    if (isDriver && !isManagerOrAdmin) {
      setActiveTab('delivery');
    } else if (isPreparer && !isManagerOrAdmin) {
      setActiveTab('prep');
    }
  }, [isDriver, isPreparer, isManagerOrAdmin]);

  const canAccessPrep = isManagerOrAdmin || isPreparer || (!isDriver);
  const canAccessDelivery = isManagerOrAdmin || isDriver || (!isPreparer);

  return (
    <div className="space-y-6 pt-4 text-right" dir="rtl">
      {/* 🚀 LUXX CONSOLIDATED OPERATIONAL EXECUTIVE MODULE HEADER */}
      <div className="p-6 rounded-[2rem] bg-gradient-to-r from-slate-900 via-[#0f1530] to-indigo-950 border border-white/10 shadow-xl flex flex-col xl:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-right self-stretch md:self-auto">
          <div className="w-14 h-14 bg-gradient-to-tr from-[#cf8a3c] to-amber-500 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Users size={26} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              مركز إدارة الطلبيات اللوجستي الموحد
              <span className="text-[9px] bg-amber-500/20 text-[#cf8a3c] px-2 py-0.5 rounded-full font-black border border-amber-500/20">JAM PRO LOGISTICS</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-bold">
              البوابة الشاملة لتجهيز الطلبيات بالتكامل مع مناديب التوصيل وموظفي المستودع
            </p>
          </div>
        </div>

        {/* Dynamic Responsive Tab Controls */}
        <div className="flex bg-slate-950/40 p-1.5 rounded-2xl border border-white/5 gap-1 shadow-inner max-w-full justify-center">
          {canAccessPrep && (
            <button
              onClick={() => setActiveTab('prep')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 border-none outline-none cursor-pointer ${
                activeTab === 'prep' 
                  ? 'bg-[#cf8a3c] text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package size={14} />
              غرفة التجهيز والجاهزية (Prep)
            </button>
          )}

          {canAccessDelivery && (
            <button
              onClick={() => setActiveTab('delivery')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 border-none outline-none cursor-pointer ${
                activeTab === 'delivery' 
                  ? 'bg-[#cf8a3c] text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Truck size={14} />
              مناديب التوصيل (Delivery)
            </button>
          )}

          <button
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 border-none outline-none cursor-pointer ${
              activeTab === 'returns' 
                ? 'bg-[#cf8a3c] text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <RotateCcw size={14} />
            المرتجعات والتجربة والمطابقة (Returns)
          </button>
        </div>
      </div>

      {/* Access Gatekeeper Layout and Routing Screen Containers */}
      <div className="min-h-[600px] transition-all duration-300">
        
        {/* TAB 1: Warehouse Prep / Picking Sheets */}
        {activeTab === 'prep' && (
          <div className="h-full">
            {canAccessPrep ? (
              <WarehousePrep profile={profile} />
            ) : (
              <AccessBannedRole />
            )}
          </div>
        )}

        {/* TAB 2: Delivery Agent / Driver Portal */}
        {activeTab === 'delivery' && (
          <div className="h-full">
            {canAccessDelivery ? (
              <DeliveryAgentPortal profile={profile} />
            ) : (
              <AccessBannedRole />
            )}
          </div>
        )}

        {/* TAB 3: Return Testing and Warranty Matching Module */}
        {activeTab === 'returns' && (
          <div className="h-full">
            <ReturnTestingAndMatching profile={profile} />
          </div>
        )}

      </div>
    </div>
  );
}

// Reusable role boundary notice component
function AccessBannedRole() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card-glass border-red-500/20 p-12 text-center flex flex-col items-center justify-center space-y-4 rounded-[2rem] bg-slate-950/40"
    >
      <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center animate-pulse">
        <FileLock2 size={32} />
      </div>
      <h3 className="text-lg font-black text-red-400">حظر أمني - صلاحية غير كافية للوصول</h3>
      <p className="text-xs text-slate-400 max-w-md font-bold leading-relaxed">
        عذراً، دورك الوظيفي الحالي يمنعك من الاطلاع على هذه البيانات الفنية أو تعديلها. تمت حماية وتأمين الميزة لحماية أصول وسلامة "JAM System Pro".
      </p>
    </motion.div>
  );
}

// =========================================================================
// WAREHOUSE PREPARATION COMPONENT (picking orders & driver assignments)
// =========================================================================
interface WarehousePrepProps {
  profile: UserProfile | null;
}

function WarehousePrep({ profile }: WarehousePrepProps) {
  const [prepOrders, setPrepOrders] = useState<WarehousePrepOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'management'>('pending');
  const [categories, setCategories] = useState<string[]>(['المحل', 'spare_part', 'accessories_shop', 'sim_cards']);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [liveLogNotifications, setLiveLogNotifications] = useState<{ id: string; text: string; time: Date }[]>([]);
  
  // Real-time Delivery Agents List
  const [deliveryAgents, setDeliveryAgents] = useState<any[]>([]);
  
  const [confirmingPrepOrder, setConfirmingPrepOrder] = useState<WarehousePrepOrder | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedDriverName, setSelectedDriverName] = useState<string>('');

  useEffect(() => {
    if (!profile?.ownerId) return;

    // Fetch Delivery Agents
    const qAgents = query(collection(db, 'users'), where('role', '==', 'delivery_agent'));
    getDocs(qAgents).then(snap => {
      setDeliveryAgents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }).catch(err => console.error("Error loading delivery agents:", err));

    // Listen to prep sheets for this branch
    const qPreps = query(collection(db, 'warehousePreps'), where('ownerId', '==', profile.ownerId));
    const unsubPreps = onSnapshot(qPreps, (snapshot) => {
      setPrepOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarehousePrepOrder)));
    }, error => handleFirestoreError(error, OperationType.GET, 'warehousePreps'));

    // Listen to Settings to get custom warehouses
    const settingsDocRef = doc(db, 'settings', profile.ownerId);
    const unsubSettings = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const cats = new Set(['المحل', 'spare_part', 'accessories_shop', 'sim_cards']);
        if (data.productCategories) {
          data.productCategories.forEach((cat: string) => cats.add(cat));
        }
        setCategories(Array.from(cats));
      }
    });

    // Simulated broadcast live synchronization
    const unsubPrepsLive = onSnapshot(qPreps, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const prepData = change.doc.data();
          const pName = prepData.customerName || 'عميل';
          const itemsList = prepData.items?.map((i: any) => i.name).join(', ') || '';
          
          setLiveLogNotifications(prev => [
            {
               id: change.doc.id + '-added',
               text: `🔔 تلقي طلب تجهيز وارد: [${pName}] يشمل أصناف: ${itemsList}`,
               time: new Date()
            },
            ...prev
          ].slice(0, 5));
        }
      });
    });

    return () => {
      unsubPreps();
      unsubSettings();
      unsubPrepsLive();
    };
  }, [profile]);

  const handlePrepToggle = async (orderId: string, itemId: string, status: 'ready' | 'missing') => {
    const order = prepOrders.find(o => o.id === orderId);
    if (!order) return;

    if (order.preppedBy && order.preppedBy !== profile?.name && profile?.role !== 'manager' && profile?.role !== 'superadmin') {
      alert(`عذراً، هذا الطلب يتم تجهيزه حالياً بواسطة ${order.preppedBy}.`);
      return;
    }

    const newItems = order.items.map(item => {
      if (item.itemId === itemId) {
        return { 
          ...item, 
          status: status,
          preparedQty: status === 'ready' ? item.requestedQty : 0
        };
      }
      return item;
    });

    const somePending = newItems.some(i => i.status === 'pending');
    const allReady = newItems.every(i => i.status === 'ready');
    const someMissing = newItems.some(i => i.status === 'missing');
    
    let prepStatus: WarehousePrepOrder['prepStatus'] = 'in_progress';
    if (!somePending) {
      prepStatus = allReady ? 'completed' : (someMissing ? 'with_issues' : 'completed');
    }

    await updateDoc(doc(db, 'warehousePreps', orderId), {
      items: newItems,
      prepStatus: prepStatus,
      preppedBy: profile?.name || 'مجهول',
      updatedAt: serverTimestamp()
    });
  };

  const handleStartPrep = async (orderId: string) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'warehousePreps', orderId), {
        prepStatus: 'in_progress',
        preppedBy: profile.name,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinishPrep = (prep: WarehousePrepOrder) => {
    setConfirmingPrepOrder(prep);
    // Reset driver fields for this ticket
    setSelectedDriverId('');
    setSelectedDriverName('');
  };

  const executeFinishPrep = async (prep: WarehousePrepOrder) => {
    try {
      // Find the network order to get full item details
      const orderDocs = await getDocs(query(collection(db, 'networkOrders'), where('__name__', '==', prep.orderId)));
      if (orderDocs.empty) {
        alert("تعذر العثور على طلب الشبكة المرفق لتجهيز الشحنة.");
        return;
      }
      
      const orderData = orderDocs.docs[0].data();
      const networkOrderRef = doc(db, 'networkOrders', prep.orderId);
      
      // Calculate adjusted items and total based on prep report
      const updatedItems = orderData.items.map((item: any) => {
        const prepped = prep.items.find((pi: any) => pi.itemId === item.productId);
        if (prepped) {
          return { 
            ...item, 
            shippedQuantity: prepped.preparedQty,
            status: prepped.status === 'missing' ? 'shortage' : 'available'
          };
        }
        return item;
      });

      const newTotal = updatedItems.reduce((acc: number, item: any) => {
        return acc + (item.price * (item.shippedQuantity || 0));
      }, 0);

      // Decrement prepped products from general inventory stock and specific warehouse stocks
      const batch = writeBatch(db);
      for (const prepped of prep.items) {
        if (prepped.preparedQty > 0) {
          const itemId = prepped.itemId;
          const invDocRef = doc(db, 'inventory', itemId);
          const invSnap = await getDoc(invDocRef);
          let category = 'المحل';
          if (invSnap.exists()) {
            const invData = invSnap.data();
            if (invData && invData.category) {
              category = invData.category;
            }
          }

          // 1. Deduct from general stock
          batch.update(invDocRef, {
            stock: increment(-prepped.preparedQty)
          });

          // 2. Deduct from specific category/warehouse stock representation
          const stockDocId = `${itemId}_${category}`;
          const stockRef = doc(db, 'warehouseStocks', stockDocId);
          batch.set(stockRef, {
            productId: itemId,
            warehouseId: category,
            stock: increment(-prepped.preparedQty),
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }
      await batch.commit();

      // Update Warehouse Prep status
      await updateDoc(doc(db, 'warehousePreps', prep.id), {
        prepStatus: 'completed',
        updatedAt: serverTimestamp()
      });

      // Update Network Order with matched items, total, AND assigned driver info
      await updateDoc(networkOrderRef, {
        status: 'matched',
        items: updatedItems,
        total: newTotal,
        prepFinishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deliveryAgentId: selectedDriverId || '',
        deliveryAgentName: selectedDriverName || ''
      });

      // Synchronize Orders collection for the Driver Portal to listen
      const ordersColRef = collection(db, 'orders');
      const ordersSnap = await getDocs(query(ordersColRef, where('networkOrderId', '==', prep.orderId)));
      
      if (!ordersSnap.empty) {
        // Update existing orders document with driver info
        const orderDocId = ordersSnap.docs[0].id;
        await updateDoc(doc(db, 'orders', orderDocId), {
          deliveryAgentId: selectedDriverId || '',
          deliveryAgentName: selectedDriverName || '',
          status: 'shipped', 
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new orders document so driver sees and acts on it
        const newOrderDocRef = doc(collection(db, 'orders'));
        const newOrderData = {
          id: newOrderDocRef.id,
          networkOrderId: prep.orderId,
          retailerName: prep.customerName || 'عميل معتمد',
          items: updatedItems.map((it: any) => ({
            productId: it.productId || it.itemId || 'item_id',
            name: it.name,
            quantity: it.shippedQuantity || it.requestedQty || 1,
            price: it.price || 0
          })),
          total: newTotal,
          status: 'shipped',
          deliveryAgentId: selectedDriverId || '',
          deliveryAgentName: selectedDriverName || '',
          ownerId: profile?.ownerId || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await setDoc(newOrderDocRef, newOrderData);
      }

      alert('🎉 تم إغلاق التجهيز، ترحيل رصيد المخازن، وتعيين السائق المكلف وتمرير الشحنة فوراً السائق!');
      setConfirmingPrepOrder(null);
    } catch (err) {
      console.error(err);
      alert('خطأ أثناء إغلاق التجهيز ومزامنة السائق.');
    }
  };

  const handleAddNewWarehouse = async () => {
    if (!profile?.ownerId || !newWarehouseName.trim()) return;
    setIsAddingCategory(true);
    try {
      const settingsRef = doc(db, 'settings', profile.ownerId);
      const settingsSnap = await getDoc(settingsRef);
      
      let existingCategories: string[] = ['المحل', 'spare_part', 'accessories_shop', 'sim_cards'];
      if (settingsSnap.exists() && settingsSnap.data().productCategories) {
        existingCategories = [...existingCategories, ...settingsSnap.data().productCategories];
      }

      if (existingCategories.some(cat => cat.toLowerCase() === newWarehouseName.trim().toLowerCase())) {
        alert('هذا المخزن أو التصنيف موجود بالفعل في النظام!');
        setIsAddingCategory(false);
        return;
      }

      await updateDoc(settingsRef, {
        productCategories: arrayUnion(newWarehouseName.trim()),
        updatedAt: serverTimestamp()
      });

      setLiveLogNotifications(prev => [
        {
          id: 'new-wh-' + Date.now(),
          text: `🎉 تم بنجاح إنشاء المخزن الجديد: [ ${newWarehouseName.trim()} ] وبث التحديث للنظام!`,
          time: new Date()
        },
        ...prev
      ]);

      setNewWarehouseName('');
      alert('تم إضافة المخزن الجديد بنجاح وبث التحديث للنظام تلقائياً!');
    } catch (e: any) {
      console.error(e);
      alert('خطأ أثناء إضافة المخزن الجديد في النظام: ' + e.message);
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteWarehouse = async (catToDelete: string) => {
    if (!profile?.ownerId) return;
    if (['المحل', 'spare_part', 'accessories_shop', 'sim_cards'].includes(catToDelete)) {
      alert('عذراً، هذا المخزن افتراضي وهيكلي للنظام ولا يمكن حذفه.');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف المخزن "${catToDelete}"؟`)) return;

    try {
      const settingsRef = doc(db, 'settings', profile.ownerId);
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const currentCats: string[] = settingsSnap.data().productCategories || [];
        const filtered = currentCats.filter(cat => cat !== catToDelete);
        await updateDoc(settingsRef, {
          productCategories: filtered,
          updatedAt: serverTimestamp()
        });

        setCategories(prev => prev.filter(cat => cat !== catToDelete));
        alert('تم حذف المخزن وتحديث النظام حياً!');
      }
    } catch (e: any) {
      console.error(e);
      alert('خطأ أثناء حذف المخزن: ' + e.message);
    }
  };

  const filteredOrders = prepOrders.filter(o => 
    (activeTab === 'pending' ? o.prepStatus !== 'completed' : o.prepStatus === 'completed') &&
    (o.customerName.includes(searchTerm) || o.orderId.includes(searchTerm))
  );

  const isManagerOrOwner = profile?.role === 'manager' || profile?.role === 'superadmin' || profile?.role === 'wholesaler' || profile?.role === 'owner';

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <Package size={18} />
            </span>
            تجهيز الطلبيات ومطابقة المخازن
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">شيت العمل اللوجستي اليومي للتحميل والتأكيد وحسم الأرصدة</p>
        </div>

        <div className="flex flex-wrap bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl gap-1 border border-slate-205 dark:border-white/5">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 border-none outline-none cursor-pointer rounded-xl font-black text-xs transition-all ${activeTab === 'pending' ? 'bg-white dark:bg-slate-800 text-[#cf8a3c] shadow-sm' : 'text-gray-400'}`}
          >
            جاري التجهيز ({prepOrders.filter(o => o.prepStatus !== 'completed').length})
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 border-none outline-none cursor-pointer rounded-xl font-black text-xs transition-all ${activeTab === 'completed' ? 'bg-white dark:bg-slate-800 text-[#cf8a3c] shadow-sm' : 'text-gray-400'}`}
          >
            الطلبات المكتملة
          </button>
          {isManagerOrOwner && (
            <button 
              onClick={() => setActiveTab('management')}
              className={`px-4 py-2 border-none outline-none cursor-pointer rounded-xl font-black text-xs transition-all flex items-center gap-1 bg-[#cf8a3c]/15 text-[#cf8a3c] hover:bg-[#cf8a3c]/25`}
            >
              <MapPin size={12} />
              إدارة المستودعات حياً
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <input 
          type="text"
          placeholder="ابحث باسم العميل أو رقم الفاتورة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl text-xs outline-none focus:border-[#cf8a3c] text-slate-900 dark:text-white font-bold"
        />
      </div>

      {activeTab === 'management' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="card-glass p-6 space-y-4 rounded-3xl border border-white/5 bg-slate-950/20 text-right">
              <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/5 pb-2">
                <Plus size={16} className="text-[#cf8a3c]" />
                صياغة وتأسيس مخزن جديد
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold block">اسم المخزن والمستودع المقترح:</label>
                  <input
                    type="text"
                    value={newWarehouseName}
                    onChange={(e) => setNewWarehouseName(e.target.value)}
                    placeholder="مستودع الأجهزة الذكية..."
                    className="w-full bg-slate-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <button
                  onClick={handleAddNewWarehouse}
                  disabled={isAddingCategory || !newWarehouseName.trim()}
                  className="py-2.5 px-4 bg-[#cf8a3c] hover:bg-[#b0732e] text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1 border-none cursor-pointer disabled:opacity-50"
                >
                  حفظ وتأسيس المستودع
                </button>
              </div>
            </div>

            <div className="card-glass p-6 space-y-4 rounded-3xl border border-white/5 bg-slate-950/20 text-right">
              <h3 className="text-xs font-black text-white flex items-center gap-2">
                <MapPin size={16} className="text-[#cf8a3c]" />
                صوامع المستودعات والأقسام النشطة بالشركة
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map(cat => {
                  const isDefault = ['المحل', 'spare_part', 'accessories_shop', 'sim_cards'].includes(cat);
                  return (
                    <div key={cat} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-extrabold text-white">{cat}</p>
                        <p className="text-[9px] text-gray-500">{isDefault ? 'مستودع هيكلي افتراضي' : 'مستودع فرعي مخصص'}</p>
                      </div>
                      {!isDefault && (
                        <button
                          onClick={() => handleDeleteWarehouse(cat)}
                          className="p-1 px-2 text-red-500 rounded bg-red-500/10 hover:bg-red-500/20 text-[10px] border-none"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card-glass p-6 space-y-4 border-l-4 border-l-[#cf8a3c] rounded-3xl border border-white/5 bg-slate-950/20">
              <h4 className="text-xs font-black text-white flex items-center gap-1">
                <Activity size={16} className="text-green-500 animate-pulse" />
                شاشات البث الميداني اللحظي (Live Sync)
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {liveLogNotifications.map((notif, idx) => (
                  <div key={idx} className="p-2.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10 text-[10px] text-emerald-400">
                    <p className="leading-relaxed">{notif.text}</p>
                    <span className="block text-[8px] text-left opacity-40 mt-1 font-mono">{notif.time.toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredOrders.length === 0 ? (
            <div className="col-span-2 py-16 text-center space-y-2">
              <Box size={44} className="mx-auto text-slate-700 animate-bounce" />
              <p className="text-slate-400 text-xs font-bold">لا توجد شيتات طلبيات مطابقة لهذا البحث.</p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} className="card-glass p-5 rounded-3xl border border-white/5 bg-slate-950/20 flex flex-col justify-between space-y-4 text-right">
                <div>
                  <div className="flex justify-between items-start border-b border-white/5 pb-3">
                    <div>
                      <h4 className="font-black text-sm text-white">{order.customerName}</h4>
                      <p className="text-[10px] text-gray-500 mt-1">معرّف الطلب: #{order.orderId.substring(0, 10)}</p>
                    </div>
                    <span className={`px-2 py-1 text-[9px] font-black rounded-lg ${order.prepStatus === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-[#cf8a3c]'}`}>
                      {order.prepStatus === 'completed' ? 'جاهز وتم التسليم السائق' : 'قيد الفرز والمطابقة'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                        <div>
                          <p className="font-bold text-white">{it.name}</p>
                          <p className="text-[10px] text-gray-500">الكمية المطلوبة: {it.requestedQty}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePrepToggle(order.id, it.itemId, 'missing')}
                            className={`px-2 py-1 text-[10px] font-black rounded-lg cursor-pointer ${it.status === 'missing' ? 'bg-red-500 text-slate-950' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                          >
                            غير متوفر ❌
                          </button>
                          <button
                            onClick={() => handlePrepToggle(order.id, it.itemId, 'ready')}
                            className={`px-2 py-1 text-[10px] font-black rounded-lg cursor-pointer ${it.status === 'ready' ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                          >
                            متوفر وجاهز ✓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[11px] font-bold">
                  <span className="text-gray-500 flex items-center gap-1 font-mono">
                    <ClipboardList size={14} />
                    المسؤول: {order.preppedBy || '---'}
                  </span>

                  {order.prepStatus !== 'completed' && (
                    <button
                      onClick={() => handleFinishPrep(order)}
                      className="px-4 py-2 bg-[#cf8a3c] hover:bg-[#b0732e] text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-amber-500/5 animate-pulse"
                    >
                      إنهاء التجهيز والمطابقة 🚀
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Driver Assignment subroutine Confirming Modal */}
      <AnimatePresence>
        {confirmingPrepOrder && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setConfirmingPrepOrder(null)} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#0c1020] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 text-right font-sans"
              dir="rtl"
            >
              <div className="flex items-center gap-3.5 justify-start">
                <span className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                  <Truck size={24} />
                </span>
                <div>
                  <h3 className="text-base font-black text-white">إسناد وتعيين السائق الميداني 🚒</h3>
                  <p className="text-[10px] text-gray-400">توجيه الشحنة فوراً لغرفة ملاحة السائق التابع</p>
                </div>
              </div>

              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-[11px] leading-relaxed text-slate-300 space-y-3">
                <p className="font-bold text-white">العميل المستلم: {confirmingPrepOrder.customerName}</p>
                
                {/* 🔴 DRIVER SELECTION ASSIGN ROUTINE FOR INVENTORY PROTECTION */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-[10px] text-amber-400 font-extrabold block">اختر السائق المكلف بنقل وتسليم الطرد:</label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedDriverId(id);
                      if (id === 'manual') {
                        setSelectedDriverName('تسليم يدوي');
                      } else {
                        const drv = deliveryAgents.find(d => d.id === id);
                        setSelectedDriverName(drv ? drv.name : 'يدوي / بدون سائق');
                      }
                    }}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-yellow-400 font-bold focus:outline-none focus:border-amber-500/40"
                  >
                    <option value="">-- اضغط لتحديد سائق التوصيل --</option>
                    {deliveryAgents.map(drv => (
                      <option key={drv.id} value={drv.id}>{drv.name || drv.displayName || drv.email}</option>
                    ))}
                    <option value="manual">تسليم يدوي بواسطة الزبون نفسه</option>
                  </select>
                </div>

                <p className="text-[10.5px] text-gray-500">
                  عند النقر على تأكيد، يتم حسم المخازن، وتمرير الشحنة فوراً إلى حساب السائق المختار لطلب التحصيل وإثبات التسليم الميداني.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => executeFinishPrep(confirmingPrepOrder)}
                  disabled={!selectedDriverId}
                  className="flex-1 py-3 bg-[#cf8a3c] hover:bg-[#b0732e] disabled:opacity-50 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-lg border-none cursor-pointer"
                >
                  تأكيد التجهيز وتعيين السائق ✓
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingPrepOrder(null)}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-2xl text-xs border-none cursor-pointer"
                >
                  تراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =========================================================================
// SHORTAGES & DEFICITS SCREEN PIPELINE IMPLEMENTATION
// =========================================================================
interface ShortagesFulfillmentTabProps {
  profile: UserProfile | null;
}

function ShortagesFulfillmentTab({ profile }: ShortagesFulfillmentTabProps) {
  const [shortages, setShortages] = useState<ShortageItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Quick inputs to add shortages manually
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState<'shop' | 'spare_part' | 'accessories_shop' | 'sim_cards'>('shop');

  useEffect(() => {
    if (!profile?.ownerId) return;

    // Listen only to active pending shortages
    const q = query(
      collection(db, 'shortages'), 
      where('ownerId', '==', profile.ownerId),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(q, (snap) => {
      setShortages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShortageItem)));
    }, error => handleFirestoreError(error, OperationType.GET, 'shortages'));

    return () => unsub();
  }, [profile]);

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedItems.length === shortages.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(shortages.map(s => s.id));
    }
  };

  const handleAddNewShortage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || !itemName.trim()) return;

    try {
      await addDoc(collection(db, 'shortages'), {
        name: itemName.trim(),
        quantity: Math.max(1, quantity),
        category: category,
        ownerId: profile.ownerId,
        senderName: profile.name || 'محضر الفروع',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setItemName('');
      setQuantity(1);
      alert('تم إدراج العجز بصفحة النواقص بنجاح.');
    } catch (err: any) {
      alert('فشل إضافة النقص: ' + err.message);
    }
  };

  // 🚀 INTER-INTEGRATIVE PIPELINE ROUTING ACTION
  const handleRouteShortagesToFulfillment = async () => {
    if (selectedItems.length === 0 || !profile?.ownerId) return;

    setIsProcessing(true);
    try {
      const itemsToRoute = shortages.filter(s => selectedItems.includes(s.id));
      const batch = writeBatch(db);

      // Create a unique identifier for this shortage pick sheet
      const uniqueOrderId = `SHORTAGE_PICK_${Date.now()}`;
      
      // 1. Prepare picking sheet
      const prepDocRef = doc(collection(db, 'warehousePreps'));
      const prepData = {
        ownerId: profile.ownerId,
        orderId: uniqueOrderId,
        customerName: 'إنقاذ النواقص العاجل (مرحل تلقائياً)',
        items: itemsToRoute.map(it => ({
          itemId: it.id, // using shortage document id or reference
          name: it.name,
          requestedQty: it.quantity,
          preparedQty: it.quantity,
          status: 'pending'
        })),
        prepStatus: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(prepDocRef, prepData);

      // 2. Prepare order ticket
      const prepOrderRef = doc(db, 'warehousePrepOrders', prepDocRef.id);
      batch.set(prepOrderRef, {
        id: prepDocRef.id,
        ownerId: profile.ownerId,
        orderId: uniqueOrderId,
        customerName: 'إنقاذ النواقص العاجل (مرحل تلقائياً)',
        items: itemsToRoute.map(it => ({
          itemId: it.id,
          name: it.name,
          requestedQty: it.quantity,
          preparedQty: it.quantity,
          status: 'pending'
        })),
        prepStatus: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3. Mark shortage items inside the database as processing/sent_to_prep
      itemsToRoute.forEach(it => {
        const shortageDocRef = doc(db, 'shortages', it.id);
        batch.update(shortageDocRef, {
          status: 'sent_to_prep',
          routedOrderId: uniqueOrderId,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      alert('🚀 تم بنجاح تجميع وسحب النواقص المحددة وحقنها آلياً في "غرفة التجهيز والمطابقة بالمستودع"!');
      setSelectedItems([]);
    } catch (err: any) {
      alert('خطأ أثناء سحب وتوطين النواقص: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = shortages.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="card-glass p-6 rounded-[2rem] border border-white/5 bg-slate-950/20 text-right space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between border-b border-white/5 pb-4 gap-4">
        <div>
          <h3 className="text-base font-black text-[#cf8a3c] flex items-center gap-2">
            <TrendingDown size={18} />
            شلال النواقص وعجز الرفوف الجاري
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">سحب مصفوفة العجز وتمريرها فوراً لغرفة التحضير اللوجستية</p>
        </div>

        <button
          onClick={handleRouteShortagesToFulfillment}
          disabled={selectedItems.length === 0 || isProcessing}
          className="px-5 py-3 bg-[#cf8a3c] text-slate-950 hover:bg-[#b0732e] disabled:opacity-40 font-black text-xs rounded-xl shadow-lg shadow-amber-500/5 transition-all flex items-center gap-2 border-none cursor-pointer"
        >
          <Send size={14} />
          ترحيل المحددة لغرفة التجهيز بالمستودع ({selectedItems.length}) 🚀
        </button>
      </div>

      {/* Manual Add Quick Form */}
      <form onSubmit={handleAddNewShortage} className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-xs font-bold leading-relaxed">
        <div className="space-y-1">
          <label className="text-gray-400 block pb-1">اسم الصنف:</label>
          <input
            type="text"
            required
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="مثلاً: كابل شاحن Type-C، شاشة آيفون 11..."
            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block pb-1">الكمية الناقصة:</label>
          <input
            type="number"
            min="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-center text-white font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block pb-1">التصنيف/المستودع الهدف:</label>
          <select
            value={category}
            onChange={(e: any) => setCategory(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-yellow-400 font-bold"
          >
            <option value="shop">المحل / صيانة</option>
            <option value="spare_part">مخزن قطع الغيار</option>
            <option value="accessories_shop">مستودع الاكسسوارات</option>
            <option value="sim_cards">الخطوط والبطائق</option>
          </select>
        </div>
        <button
          type="submit"
          className="py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all font-black border-none cursor-pointer"
        >
          رصد عجز جديد
        </button>
      </form>

      {/* Search shortages */}
      <div className="relative">
        <input
          type="text"
          placeholder="ابحث بالنقص..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-sm bg-slate-900 border border-white/10 px-4 py-2 text-xs rounded-xl outline-none focus:border-[#cf8a3c] text-white"
        />
      </div>

      {/* shortages table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-white/5 text-gray-400 font-bold">
              <th className="pb-3 w-12 text-center">
                <input
                  type="checkbox"
                  checked={shortages.length > 0 && selectedItems.length === shortages.length}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="pb-3 pr-2">البند الناقص</th>
              <th className="pb-3 pl-2 text-center w-24">الكمية المطلوبة</th>
              <th className="pb-3 pl-2">المستودع الهدف</th>
              <th className="pb-3 pl-2">الراصد للطلب</th>
              <th className="pb-3 pl-2 text-left">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500 font-bold">
                  لا توجد نواقص معلّقة أو مسجلة حالياً بالملف التجريبي.
                </td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id} className="border-b border-white/[0.02]">
                  <td className="py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="py-3 pr-2 font-black text-white">{item.name}</td>
                  <td className="py-3 pl-2 text-center text-[#cf8a3c] font-black font-mono">{item.quantity}</td>
                  <td className="py-3 pl-2 font-bold text-gray-300">
                    {item.category === 'spare_part' ? 'قطع الغيار' : 
                     item.category === 'accessories_shop' ? 'مستودع الاكسسوارات' :
                     item.category === 'sim_cards' ? 'الخطوط والبطائق' : 'المحل العام'}
                  </td>
                  <td className="py-3 pl-2 text-slate-400 font-medium">{item.senderName || 'الفرع الرئيسي'}</td>
                  <td className="py-3 pl-2 text-left text-gray-500 font-mono">
                    {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('ar-YE') : 'مؤخراً'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
