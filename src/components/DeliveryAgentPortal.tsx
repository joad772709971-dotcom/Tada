import { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  MapPin, 
  Phone, 
  Calendar, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Hash, 
  DollarSign, 
  User,
  Power,
  Zap
} from 'lucide-react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface DeliveryAgentPortalProps {
  profile: UserProfile | null;
}

export default function DeliveryAgentPortal({ profile }: DeliveryAgentPortalProps) {
  const [deliveryOrders, setDeliveryOrders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [passcodeInputs, setPasscodeInputs] = useState<Record<string, string>>({});
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'delivered'>('pending');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!profile?.uid) return;

    // Listen to delivery orders and apply store isolation filtering
    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const storeOwner = profile?.ownerId || profile?.shopId || profile?.uid;
      const isSuperAdmin = profile?.role === 'superadmin' || storeOwner === 'master' || storeOwner === 'joad7723';
      
      const filtered = ordersData.filter(ord => {
        if (isSuperAdmin) return true;
        const ordStore = ord.ownerId || ord.store_id || ord.wholesalerId || ord.retailerId || ord.storeId;
        const isAssigned = ord.deliveryAgentId === profile?.uid;
        const isMyStore = ordStore && (ordStore === storeOwner || ordStore === profile?.uid);
        return isAssigned || isMyStore || (!ordStore && !ord.deliveryAgentId);
      });

      setDeliveryOrders(filtered);
    }, (error) => {
      console.error("Error fetching delivery orders:", error);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleClaimOrder = async (orderId: string) => {
    try {
      setLoadingOrderId(orderId);
      const { dbConcurrencyService } = await import('../services/dbConcurrencyService');
      await dbConcurrencyService.runTransactionLock(
        'orders',
        orderId,
        {
          deliveryAgentId: profile?.uid || '',
          deliveryAgentName: profile?.name || 'سائق التوصيل السريع',
          status: 'shipped',
          cancelFrozen: true,
          dispatchedAt: new Date()
        },
        profile?.uid || ''
      );

      // Synchronize back to networkOrders or orders status as shipped
      let originalOrderRef = null;
      let originalOrderSnap = await getDocs(query(collection(db, 'networkOrders'), where('__name__', '==', orderId)));
      if (originalOrderSnap.empty) {
        originalOrderSnap = await getDocs(query(collection(db, 'orders'), where('__name__', '==', orderId)));
      }
      if (!originalOrderSnap.empty) {
        await updateDoc(originalOrderSnap.docs[0].ref, {
          status: 'shipped',
          deliveryAgentId: profile?.uid || '',
          deliveryAgentName: profile?.name || 'سائق التوصيل السريع',
          updatedAt: serverTimestamp()
        });
      }

      setStatusMsg({ type: 'success', text: '📦 تم بنجاح استلام الشحنة وتأمينها في عهدتك! تحرك بأمان.' });
    } catch (e: any) {
      console.error(e);
      setStatusMsg({ type: 'error', text: e.message || 'فشل في استلام الشحنة وتعيين السائق.' });
    } finally {
      setLoadingOrderId(null);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleUnlockAndDeliver = async (orderId: string, expectedCode: string) => {
    const inputCode = passcodeInputs[orderId] || '';
    if (inputCode.trim().toUpperCase() !== expectedCode.trim().toUpperCase()) {
      setStatusMsg({ type: 'error', text: 'رمز الطلب السريع (Payload Code) غير صحيح! يرجى مراجعة المشرف.' });
      return;
    }

    try {
      setLoadingOrderId(orderId);
      const { dbConcurrencyService } = await import('../services/dbConcurrencyService');
      await dbConcurrencyService.runTransactionLock(
        'orders',
        orderId,
        {
          deliveryLocked: false,
          status: 'delivered',
          deliveredAt: new Date()
        },
        profile?.uid || ''
      );

      setStatusMsg({ type: 'success', text: 'تم بنجاح فك قفل الشحنة وتوصيل الطلب الفوري!' });
      setPasscodeInputs(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    } catch (error: any) {
      console.error(error);
      setStatusMsg({ type: 'error', text: error.message || 'حدث خطأ أثناء فك القفل وتحديث حالة الشحن.' });
    } finally {
      setLoadingOrderId(null);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleStandardDeliver = async (orderId: string) => {
    try {
      setLoadingOrderId(orderId);
      const { dbConcurrencyService } = await import('../services/dbConcurrencyService');
      await dbConcurrencyService.runTransactionLock(
        'orders',
        orderId,
        {
          status: 'delivered',
          deliveredAt: new Date()
        },
        profile?.uid || ''
      );
      setStatusMsg({ type: 'success', text: 'تم تسجيل التوصيل بنجاح!' });
    } catch (e: any) {
      console.error(e);
      setStatusMsg({ type: 'error', text: e.message || 'خطأ في تحديث حالة التوصيل.' });
    } finally {
      setLoadingOrderId(null);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleStartDispatch = async (orderId: string) => {
    try {
      setLoadingOrderId(orderId);
      const { dbConcurrencyService } = await import('../services/dbConcurrencyService');
      await dbConcurrencyService.runTransactionLock(
        'orders',
        orderId,
        {
          status: 'shipped',
          cancelFrozen: true,
          dispatchedAt: new Date()
        },
        profile?.uid || ''
      );
      setStatusMsg({ type: 'success', text: 'تم بدء الشحن والتحرك! تم تأمين الشحنة وإقفال خيار الإلغاء للمشتري تماماً 🔒' });
    } catch (e: any) {
      console.error(e);
      setStatusMsg({ type: 'error', text: e.message || 'فشل في بدء الشحن وتأمين الطلب.' });
    } finally {
      setLoadingOrderId(null);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Filter based on selected tab & search query (only assigned to this driver)
  const filteredOrders = deliveryOrders.filter(order => {
    const isAssigned = order.deliveryAgentId === profile?.uid;
    if (!isAssigned) return false;

    const matchesTab = activeTab === 'pending' 
      ? order.status !== 'delivered' 
      : order.status === 'delivered';

    const matchesSearch = 
      order.retailerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.wholesalerName?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesTab && matchesSearch;
  });

  // Filter unassigned courier requests dispatched from warehouse
  const unassignedOrders = deliveryOrders.filter(order => {
    const isUnassigned = !order.deliveryAgentId;
    const isPendingDispatch = order.status === 'pending_dispatch' || order.status === 'dispatched';
    return isUnassigned && isPendingDispatch;
  });

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-navy-900/50 p-6 rounded-3xl border border-white/5">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-amber-500/10 text-amber-500 rounded-2xl">
            <Truck size={36} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">بوابة عامل التوصيل والسائق (Express Delivery)</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Delivery Agent Dispatch & Real-Time Tracking</p>
          </div>
        </div>

        <div className="flex bg-navy-950 p-1.5 rounded-2xl border border-white/5">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'pending' ? 'bg-amber-500 text-navy-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            توصيلات قيد الانتظار ({deliveryOrders.filter(o => o.deliveryAgentId === profile?.uid && o.status !== 'delivered').length})
          </button>
          <button 
            onClick={() => setActiveTab('delivered')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'delivered' ? 'bg-amber-500 text-navy-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            الشحنات الموصلة ({deliveryOrders.filter(o => o.deliveryAgentId === profile?.uid && o.status === 'delivered').length})
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-2xl text-xs font-bold text-center ${statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Unassigned Courier Jobs Pool (Requirement 1) */}
      {unassignedOrders.length > 0 && (
        <div className="space-y-4 p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl text-right" dir="rtl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold px-2.5 py-0.5 rounded-full select-none">POOL</span>
            <div className="flex items-center gap-2">
              <Zap className="text-amber-500 animate-pulse" size={16} />
              <h3 className="text-sm font-black text-amber-400">📦 طلبات التوصيل السريع والمشترك المتاحة للالتقاط:</h3>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 font-bold leading-relaxed">
            تم تجهيز ومطابقة الفواتير التالية داخل المستودعات وهي جاهزة حالياً للشحن اللوجستي الفوري. اضغط على "قبول الشحنة وتثبيت السائق" لإضافتها لعهدتك وبدء الرحلة:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unassignedOrders.map((order) => (
              <div key={order.id} className="p-4 bg-navy-950 border border-white/5 rounded-2xl flex flex-col justify-between gap-4 text-right">
                <div className="flex justify-between items-start gap-4">
                  <div className="text-left font-mono">
                    <p className="text-[10px] text-gray-500">القيمة المالية</p>
                    <p className="text-sm font-black text-brand-primary">{(order.total || 0).toLocaleString()} ر.ي</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] bg-amber-500/10 text-amber-500 font-black px-2 py-0.5 rounded">
                      {order.shippingMode === 'express_on_demand' ? '⚡ شحن سريع فوري' : '👥 شحن مشترك'}
                    </span>
                    <h5 className="font-black text-xs text-white mt-2">#{order.id.slice(-6)} | {order.retailerName}</h5>
                    <p className="text-[10px] text-gray-400 mt-1">المرسل: {order.wholesalerName || 'المستودع الرئيسي'}</p>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span className="font-bold text-white">{order.items?.length || 0} صنف</span>
                    <span>تفاصيل المنتجات:</span>
                  </div>
                  <div className="max-h-16 overflow-y-auto text-[9px] text-gray-500 space-y-1 text-right">
                    {order.items?.map((item: any, i: number) => (
                      <p key={i}>- {item.name || item.productName} ({item.quantity || item.requestedQty || 0} حبة)</p>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loadingOrderId === order.id}
                  onClick={() => handleClaimOrder(order.id)}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-navy-950 font-black rounded-xl text-xs transition-all cursor-pointer border-none flex items-center justify-center gap-1.5"
                >
                  {loadingOrderId === order.id ? 'جاري الاستلام...' : <><Power size={14} /> قبول الشحنة وبدء التوصيل 🚚</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Quick Filters */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
        <input 
          type="text"
          placeholder="البحث برقم الطلب، أو اسم العميل..."
          className="w-full pr-12 pl-4 py-4 bg-navy-900/40 border border-white/5 rounded-2xl font-bold text-white outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Deliveries Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredOrders.length === 0 ? (
          <div className="col-span-2 py-20 text-center space-y-4 bg-navy-900/20 rounded-3xl border border-white/5">
            <Truck size={64} className="mx-auto text-gray-600 animate-pulse" />
            <p className="text-gray-400 font-bold">لا توجد شحنات مطابقة في هذا القسم حالياً</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const isPayloadLocked = (order.shippingMode === 'ship_delivery' || order.shippingMode === 'express_on_demand') && order.deliveryLocked !== false;
            return (
              <motion.div 
                key={order.id}
                layout
                className={`card-glass border-t-4 transition-all overflow-hidden flex flex-col ${isPayloadLocked ? 'border-t-rose-500' : 'border-t-emerald-500'}`}
              >
                {/* Order Meta Header */}
                <div className="p-5 bg-navy-950/40 flex justify-between items-start gap-4 border-b border-white/5 text-right">
                  <div>
                    <span className="text-[10px] font-black tracking-widest text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md uppercase">
                      ID: #{order.id.slice(-6)}
                    </span>
                    <h4 className="font-black text-sm text-white mt-1.5 flex items-center gap-1.5 text-right">
                      <User size={14} className="text-gray-400" />
                      {order.wholesalerName || 'مرسل البضائع'} 👤
                    </h4>
                  </div>
                  <div className="text-left font-mono">
                    <p className="text-xs text-gray-400">الإجمالي المالي</p>
                    <p className="text-lg font-black text-brand-primary">{(order.total || 0).toLocaleString()} ر.ي</p>
                  </div>
                </div>

                {/* Shipping Details */}
                <div className="p-6 space-y-4 flex-1 text-right">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                      <MapPin size={18} className="text-amber-500" />
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">وجهة العميل المستلم (تاجر التجزئة)</p>
                        <p className="text-xs font-black text-white">{order.retailerName || 'تاجر تجزئة غير مسجل'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                      <Phone size={18} className="text-indigo-400" />
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">هاتف المستلم</p>
                        <p className="text-xs font-mono font-bold text-white">{order.retailerPhone || 'لا يوجد هاتف'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                      <Calendar size={18} className="text-teal-400" />
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">تاريخ بدء الشحن</p>
                        <p className="text-xs font-bold text-white">
                          {order.updatedAt?.seconds ? new Date(order.updatedAt.seconds * 1000).toLocaleString('ar-YE') : 'غير محدد'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cancel status / Freeze dispatch button */}
                  <div className="mb-4">
                    {order.cancelFrozen ? (
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl flex items-center justify-between text-right">
                        <div className="flex items-center gap-2 text-indigo-400 text-[11px] font-black">
                          <Lock size={14} className="text-indigo-400 animate-pulse" />
                          <span>🔒 تم إقفال خيار الإلغاء للمشتري (الطلب مؤمن في الطريق)</span>
                        </div>
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-mono font-bold px-2.5 py-0.5 rounded-full select-none">FROZEN</span>
                      </div>
                    ) : (
                      order.status !== 'delivered' && (
                        <button
                          type="button"
                          disabled={loadingOrderId === order.id}
                          onClick={() => handleStartDispatch(order.id)}
                          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-lg shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-2 border-none outline-none"
                        >
                          <Truck size={14} />
                          تم الشحن وتحرك السائق (قفل إمكانية إلغاء الطلب) 🚀
                        </button>
                      )
                    )}
                  </div>

                  {/* Lock Indicator for Fast Delivery Payload */}
                  {isPayloadLocked ? (
                    <div className="p-4 bg-rose-500/15 border border-rose-500/20 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-rose-400">
                        <Lock size={16} className="animate-bounce" />
                        <span className="text-xs font-bold font-sans">تنبيه: رحلة السائق مجدولة كـ "طلب توصيل فوري" ومغلقة!</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed font-semibold">
                        لحماية حقوق التاجر والزبون الماليّة، لن يتم التنازل أو تأكيد تسليم السحنة إلا بإدخال رمز الطلب السريع (Express Delivery Payload) الذي يقوم المالك بتزويدك به فور الانطلاق.
                      </p>

                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="أدخل رمز الشحن السريع (e.g., EXP-XXXX)"
                          className="flex-1 bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white text-center outline-none focus:border-rose-500 font-mono"
                          value={passcodeInputs[order.id] || ''}
                          onChange={(e) => setPasscodeInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                        />
                        <button 
                          disabled={loadingOrderId === order.id}
                          onClick={() => handleUnlockAndDeliver(order.id, order.expressPayloadCode || '')}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1"
                        >
                          {loadingOrderId === order.id ? 'جاري فك القفل...' : <><Unlock size={14} /> فك القفل وتسليم</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 size={16} />
                        <span>الشحنة مفتوحة وقابلة للتسليم الميداني مباشرة</span>
                      </div>
                      {order.status !== 'delivered' && (
                        <button
                          disabled={loadingOrderId === order.id}
                          onClick={() => handleStandardDeliver(order.id)}
                          className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black hover:bg-emerald-500 transition-all"
                        >
                          تأكيد التوصيل ✓
                        </button>
                      )}
                    </div>
                  )}

                  {order.status === 'delivered' && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-center text-blue-400 text-xs font-bold">
                      🏆 تم إنجاز التوصيل الميداني بنجاح واكتمال الدورة اللوجستية!
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
