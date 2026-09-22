import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Package, 
  Search,
  Truck,
  User,
  ClipboardList,
  RefreshCw,
  Box,
  Minus,
  Plus,
  Coins,
  TrendingUp,
  ArrowRight,
  PlusCircle,
  X
} from 'lucide-react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp, getDocs, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, WarehousePrepOrder } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface WarehousePrepProps {
  profile: UserProfile | null;
}

export default function WarehousePrep({ profile }: WarehousePrepProps) {
  const [prepOrders, setPrepOrders] = useState<WarehousePrepOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // States for detailed Dual-Verification & Settlement overlay
  const [orderVerificationModes, setOrderVerificationModes] = useState<Record<string, 'fast' | 'manual'>>({});
  const [selectedSettlementPrep, setSelectedSettlementPrep] = useState<WarehousePrepOrder | null>(null);
  const [associatedOrderData, setAssociatedOrderData] = useState<any | null>(null);
  const [fetchingOrder, setFetchingOrder] = useState(false);
  const [substitutionItems, setSubstitutionItems] = useState<any[]>([]);
  const [searchProductTerm, setSearchProductTerm] = useState('');
  const [submittingSettlement, setSubmittingSettlement] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);

  // Subscribe to store inventory for substitutions
  useEffect(() => {
    if (!profile?.ownerId) return;
    const qInv = query(
      collection(db, 'inventory'),
      where('ownerId', '==', profile.ownerId)
    );
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error fetching inventory:", err));
    return unsubInv;
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    // Check if user is a manager, owner (wholesaler), or has specific prep roles
    const hasAccess = 
      profile.role === 'manager' || 
      profile.role === 'superadmin' || 
      profile.networkRole === 'wholesaler' || 
      profile.role === 'wholesaler' || 
      profile.role === 'employee' ||
      profile.role === 'staff';

    setIsAuthorized(hasAccess);

    if (!hasAccess || !profile.ownerId) return;

    // Query strictly filtered by the store ID (ownerId)
    // For employees, ownerId is their parent store's ID.
    const q = query(
      collection(db, 'warehousePreps'), 
      where('ownerId', '==', profile.ownerId)
    );

    return onSnapshot(q, (snapshot) => {
      setPrepOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarehousePrepOrder)));
    }, (error) => {
      console.error("Error fetching warehouse preps:", error);
    });
  }, [profile]);

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="p-6 bg-danger/10 text-danger rounded-full ring-8 ring-danger/5">
          <AlertTriangle size={64} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-navy-900 dark:text-white">عذراً، لا تملك صلاحية الوصول</h3>
          <p className="text-gray-500 max-w-md mx-auto">هذه الواجهة مخصصة لموظفي المستودع والمسؤولين عن تجهيز الطلبات في هذا المحل فقط.</p>
        </div>
      </div>
    );
  }

  const handlePrepToggle = async (orderId: string, itemId: string, status: 'ready' | 'missing') => {
    const order = prepOrders.find(o => o.id === orderId);
    if (!order) return;

    // الخصوصية: قفل الطلب لمن بدأ العمل عليه
    if (order.preppedBy && order.preppedBy !== profile?.name && profile?.role !== 'manager' && profile?.role !== 'superadmin') {
      alert(`عذراً، هذا الطلب يتم تجهيزه حالياً بواسطة ${order.preppedBy}. لا يمكنك التعديل عليه.`);
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

  const handleUpdatePreparedQty = async (orderId: string, itemId: string, newQty: number) => {
    const order = prepOrders.find(o => o.id === orderId);
    if (!order) return;

    if (order.preppedBy && order.preppedBy !== profile?.name && profile?.role !== 'manager' && profile?.role !== 'superadmin') {
      alert(`عذراً، هذا الطلب يتم تجهيزه حالياً بواسطة ${order.preppedBy}. لا يمكنك التعديل عليه.`);
      return;
    }

    const newItems = order.items.map(item => {
      if (item.itemId === itemId) {
        const qty = Math.max(0, Math.min(item.requestedQty, newQty));
        let status: 'pending' | 'ready' | 'missing' = item.status;
        if (qty === 0) {
          status = 'missing';
        } else if (qty > 0) {
          status = 'ready';
        }
        return { 
          ...item, 
          preparedQty: qty,
          status: status
        };
      }
      return item;
    });

    const somePending = newItems.some(i => i.status === 'pending');
    const allReady = newItems.every(i => i.status === 'ready');
    const someMissing = newItems.some(i => i.status === 'missing' || (i.preparedQty !== undefined && i.preparedQty < i.requestedQty));
    
    let prepStatus: WarehousePrepOrder['prepStatus'] = 'in_progress';
    if (!somePending) {
        prepStatus = allReady && !someMissing ? 'completed' : 'with_issues';
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

  const handleOpenSettlement = async (prep: WarehousePrepOrder) => {
    setSelectedSettlementPrep(prep);
    setFetchingOrder(true);
    setSubstitutionItems([]);
    setSearchProductTerm('');
    try {
      // Look up associated order in 'networkOrders' or 'orders'
      let orderSnap = await getDocs(query(collection(db, 'networkOrders'), where('__name__', '==', prep.orderId)));
      let orderCol = 'networkOrders';
      if (orderSnap.empty) {
        orderSnap = await getDocs(query(collection(db, 'orders'), where('__name__', '==', prep.orderId)));
        orderCol = 'orders';
      }

      if (!orderSnap.empty) {
        setAssociatedOrderData({
          id: orderSnap.docs[0].id,
          collection: orderCol,
          ...orderSnap.docs[0].data()
        });
      } else {
        alert('⚠️ تعذر العثور على الفاتورة الأصلية المقابلة لهذا الطلب في قاعدة البيانات.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingOrder(false);
    }
  };

  const calculatePrepMetrics = () => {
    if (!selectedSettlementPrep || !associatedOrderData) return { hasDeficit: false, deficitItems: [], deficitValue: 0 };

    const deficitItems: any[] = [];
    let deficitValue = 0;

    selectedSettlementPrep.items.forEach((pi: any) => {
      const orderItem = associatedOrderData.items?.find((oi: any) => oi.productId === pi.itemId || oi.itemId === pi.itemId);
      const price = orderItem ? (orderItem.price || orderItem.cost || 0) : 0;
      const requested = pi.requestedQty || 0;
      const prepared = pi.preparedQty !== undefined ? pi.preparedQty : (pi.status === 'ready' ? pi.requestedQty : 0);
      const deficitQty = requested - prepared;

      if (deficitQty > 0) {
        const totalCost = deficitQty * price;
        deficitValue += totalCost;
        deficitItems.push({
          itemId: pi.itemId,
          name: pi.name,
          price,
          requested,
          prepared,
          deficitQty,
          deficitTotal: totalCost
        });
      }
    });

    return {
      hasDeficit: deficitValue > 0,
      deficitItems,
      deficitValue
    };
  };

  const handleConfirmDebtSettlement = async () => {
    if (!selectedSettlementPrep || !associatedOrderData) return;
    setSubmittingSettlement(true);
    try {
      const { deficitValue } = calculatePrepMetrics();
      
      const updatedOrderItems = associatedOrderData.items.map((item: any) => {
        const prepItem = selectedSettlementPrep.items.find((pi: any) => pi.itemId === item.productId || pi.itemId === item.itemId);
        if (prepItem) {
          const prepared = prepItem.preparedQty !== undefined ? prepItem.preparedQty : (prepItem.status === 'ready' ? prepItem.requestedQty : 0);
          return {
            ...item,
            shippedQuantity: prepared,
            quantity: prepared,
            status: prepared === 0 ? 'shortage' : (prepared < prepItem.requestedQty ? 'shortage' : 'available')
          };
        }
        return item;
      }).filter((item: any) => (item.quantity || item.shippedQuantity || 0) >= 0);

      const newTotal = updatedOrderItems.reduce((acc: number, item: any) => {
        return acc + ((item.price || 0) * (item.quantity || item.shippedQuantity || 0));
      }, 0);

      // Adjust default account balance for the retailer (reduce their debt)
      if (deficitValue > 0 && associatedOrderData.retailerId) {
        const accountsQuery = query(
          collection(db, 'accounts'),
          where('ownerId', '==', associatedOrderData.retailerId),
          where('isDefault', '==', true)
        );
        const accSnap = await getDocs(accountsQuery);
        if (!accSnap.empty) {
          await updateDoc(accSnap.docs[0].ref, {
            balance: increment(deficitValue)
          });
        }
      }

      // Update main order doc
      await updateDoc(doc(db, associatedOrderData.collection, associatedOrderData.id), {
        status: 'matched',
        items: updatedOrderItems,
        total: newTotal,
        prepFinishedAt: serverTimestamp(),
        notes: (associatedOrderData.notes || '') + `\n[مطابقة المستودع - تسوية دين آجل]: تم خصم قيمة العجز المالي ومقدارها ${deficitValue.toLocaleString()} ر.ي من إجمالي مديونية العميل.`,
        updatedAt: serverTimestamp()
      });

      // Update warehouse preps status to completed
      await updateDoc(doc(db, 'warehousePreps', selectedSettlementPrep.id), {
        prepStatus: 'completed',
        items: selectedSettlementPrep.items,
        updatedAt: serverTimestamp()
      });

      // Update warehousePrepOrders if it exists
      try {
        const prepOrdersQuery = query(collection(db, 'warehousePrepOrders'), where('orderId', '==', selectedSettlementPrep.orderId));
        const prepOrdersSnap = await getDocs(prepOrdersQuery);
        for (const pDoc of prepOrdersSnap.docs) {
          await updateDoc(pDoc.ref, {
            prepStatus: 'completed',
            items: selectedSettlementPrep.items,
            updatedAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.warn('Silent warning updates:', err);
      }

      alert(`🎉 تم تسوية عجز الطلب الآجل بنجاح!\nتم خصم ${deficitValue.toLocaleString()} ر.ي من حساب العميل المالي وتحديث الفاتورة.`);
      setSelectedSettlementPrep(null);
    } catch (e: any) {
      console.error(e);
      alert('خطأ أثناء تسوية الحساب الآجل: ' + e.message);
    } finally {
      setSubmittingSettlement(false);
    }
  };

  const handleAddSubstitutionAndRouteBack = async () => {
    if (!selectedSettlementPrep || !associatedOrderData || substitutionItems.length === 0) return;
    setSubmittingSettlement(true);
    try {
      // 1. Lock matched quantities of original items and mark alternative additions as pending
      const updatedPrepItems = selectedSettlementPrep.items.map((pi: any) => {
        const prepared = pi.preparedQty !== undefined ? pi.preparedQty : (pi.status === 'ready' ? pi.requestedQty : 0);
        return {
          ...pi,
          requestedQty: prepared,
          preparedQty: prepared,
          status: prepared === 0 ? 'missing' : 'ready'
        };
      });

      const newAlternativePrepItems = substitutionItems.map((si: any) => ({
        itemId: si.id,
        name: si.name,
        requestedQty: si.quantity,
        preparedQty: 0,
        status: 'pending'
      }));

      const finalPrepItems = [...updatedPrepItems, ...newAlternativePrepItems];

      // 2. Prepare items list for main order
      const updatedOrderItems = associatedOrderData.items.map((item: any) => {
        const prepItem = selectedSettlementPrep.items.find((pi: any) => pi.itemId === item.productId || pi.itemId === item.itemId);
        if (prepItem) {
          const prepared = prepItem.preparedQty !== undefined ? prepItem.preparedQty : (prepItem.status === 'ready' ? prepItem.requestedQty : 0);
          return {
            ...item,
            quantity: prepared,
            shippedQuantity: prepared,
            status: prepared === 0 ? 'shortage' : (prepared < prepItem.requestedQty ? 'shortage' : 'available')
          };
        }
        return item;
      });

      const newAlternativeOrderItems = substitutionItems.map((si: any) => ({
        productId: si.id,
        name: si.name,
        price: si.price || si.cost || 0,
        quantity: si.quantity,
        status: 'pending'
      }));

      const finalOrderItems = [...updatedOrderItems, ...newAlternativeOrderItems].filter((item: any) => (item.quantity || item.shippedQuantity || 0) > 0);

      const newTotal = finalOrderItems.reduce((acc: number, item: any) => {
        return acc + ((item.price || 0) * (item.quantity || 0));
      }, 0);

      // 3. Update networkOrder to return to prepping state
      await updateDoc(doc(db, associatedOrderData.collection, associatedOrderData.id), {
        status: 'prepping',
        items: finalOrderItems,
        total: newTotal,
        notes: (associatedOrderData.notes || '') + `\n[توفية منتجات نقدي بديل]: تم تعويض العجز بأصناف بديلة بقيمة ${substitutionItems.reduce((a, b) => a + (b.price * b.quantity), 0).toLocaleString()} ر.ي وإعادة توجيه الطلب للمستودع.`,
        updatedAt: serverTimestamp()
      });

      // 4. Update warehousePreps status to in_progress
      await updateDoc(doc(db, 'warehousePreps', selectedSettlementPrep.id), {
        prepStatus: 'in_progress',
        items: finalPrepItems,
        updatedAt: serverTimestamp()
      });

      // 5. Update warehousePrepOrders if it exists
      try {
        const prepOrdersQuery = query(collection(db, 'warehousePrepOrders'), where('orderId', '==', selectedSettlementPrep.orderId));
        const prepOrdersSnap = await getDocs(prepOrdersQuery);
        for (const pDoc of prepOrdersSnap.docs) {
          await updateDoc(pDoc.ref, {
            prepStatus: 'in_progress',
            items: finalPrepItems,
            updatedAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.warn('Silent warning updates:', err);
      }

      alert(`🔄 تم بنجاح إضافة البدائل وإعادة توجيه الطلب إلى حالة "قيد التجهيز بالمستودع" لمطابقتها وتعبئتها!`);
      setSelectedSettlementPrep(null);
    } catch (e: any) {
      console.error(e);
      alert('خطأ أثناء تعيين البدائل وإعادة التوجيه: ' + e.message);
    } finally {
      setSubmittingSettlement(false);
    }
  };

  const handleConfirmDirectCashSettlement = async () => {
    if (!selectedSettlementPrep || !associatedOrderData) return;
    setSubmittingSettlement(true);
    try {
      const { deficitValue } = calculatePrepMetrics();
      
      const updatedOrderItems = associatedOrderData.items.map((item: any) => {
        const prepItem = selectedSettlementPrep.items.find((pi: any) => pi.itemId === item.productId || pi.itemId === item.itemId);
        if (prepItem) {
          const prepared = prepItem.preparedQty !== undefined ? prepItem.preparedQty : (prepItem.status === 'ready' ? prepItem.requestedQty : 0);
          return {
            ...item,
            shippedQuantity: prepared,
            quantity: prepared,
            status: prepared === 0 ? 'shortage' : (prepared < prepItem.requestedQty ? 'shortage' : 'available')
          };
        }
        return item;
      }).filter((item: any) => (item.quantity || item.shippedQuantity || 0) > 0);

      const newTotal = updatedOrderItems.reduce((acc: number, item: any) => {
        return acc + ((item.price || 0) * (item.quantity || 0));
      }, 0);

      // Update main order: matched
      await updateDoc(doc(db, associatedOrderData.collection, associatedOrderData.id), {
        status: 'matched',
        items: updatedOrderItems,
        total: newTotal,
        prepFinishedAt: serverTimestamp(),
        notes: (associatedOrderData.notes || '') + `\n[مطابقة المستودع - تسوية نقدي]: تم تسوية العجز النقدي وقدره ${deficitValue.toLocaleString()} ر.ي كمرتجع مستحق الدفع للعميل.`,
        updatedAt: serverTimestamp()
      });

      // Update prep docs to completed
      await updateDoc(doc(db, 'warehousePreps', selectedSettlementPrep.id), {
        prepStatus: 'completed',
        items: selectedSettlementPrep.items,
        updatedAt: serverTimestamp()
      });

      try {
        const prepOrdersQuery = query(collection(db, 'warehousePrepOrders'), where('orderId', '==', selectedSettlementPrep.orderId));
        const prepOrdersSnap = await getDocs(prepOrdersQuery);
        for (const pDoc of prepOrdersSnap.docs) {
          await updateDoc(pDoc.ref, {
            prepStatus: 'completed',
            items: selectedSettlementPrep.items,
            updatedAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.warn('Silent warning updates:', err);
      }

      alert(`🎉 تم تسوية الطلب النقدي بنجاح!\nتم اعتماد الكميات المتوفرة وتثبيت الفارق المالي ${deficitValue.toLocaleString()} ر.ي كمرتجع مستحق.`);
      setSelectedSettlementPrep(null);
    } catch (e: any) {
      console.error(e);
      alert('خطأ أثناء تسوية الحساب النقدي: ' + e.message);
    } finally {
      setSubmittingSettlement(false);
    }
  };

  const handleLogisticsRouting = async (prep: WarehousePrepOrder, mode: 'express_on_demand' | 'shared_courier') => {
    try {
      const expressPayloadCode = mode === 'express_on_demand' 
        ? `EXP-${Math.floor(1000 + Math.random() * 9000)}` 
        : '';

      // Update warehouse prep status
      await updateDoc(doc(db, 'warehousePreps', prep.id), {
        dispatched: true,
        shippingMode: mode,
        expressPayloadCode,
        updatedAt: serverTimestamp()
      });

      // Synchronize in warehousePrepOrders if it exists
      try {
        const prepOrdersQuery = query(collection(db, 'warehousePrepOrders'), where('orderId', '==', prep.orderId));
        const prepOrdersSnap = await getDocs(prepOrdersQuery);
        for (const pDoc of prepOrdersSnap.docs) {
          await updateDoc(pDoc.ref, {
            dispatched: true,
            shippingMode: mode,
            expressPayloadCode,
            updatedAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.warn('Silent warning update:', err);
      }

      // Route/Update networkOrders or orders to 'dispatched'
      let originalOrderRef = null;
      let orderColName = 'networkOrders';
      let originalOrderSnap = await getDocs(query(collection(db, 'networkOrders'), where('__name__', '==', prep.orderId)));
      if (originalOrderSnap.empty) {
        originalOrderSnap = await getDocs(query(collection(db, 'orders'), where('__name__', '==', prep.orderId)));
        orderColName = 'orders';
      }

      let orderData: any = {};
      if (!originalOrderSnap.empty) {
        const originalDoc = originalOrderSnap.docs[0];
        originalOrderRef = originalDoc.ref;
        orderData = originalDoc.data();
        await updateDoc(originalOrderRef, {
          status: 'dispatched',
          shippingMode: mode,
          expressPayloadCode,
          deliveryLocked: mode === 'express_on_demand',
          updatedAt: serverTimestamp()
        });
      }

      // Update/Create in the 'orders' collection (for DeliveryAgentPortal to listen to)
      const ordersColRef = collection(db, 'orders');
      const deliveryAgentOrdersSnap = await getDocs(query(ordersColRef, where('networkOrderId', '==', prep.orderId)));

      const expressDeliveryPayload = {
        networkOrderId: prep.orderId,
        wholesalerId: profile?.ownerId || orderData.wholesalerId || '',
        wholesalerName: orderData.wholesalerName || profile?.name || 'مرسل المستودع',
        retailerId: orderData.retailerId || prep.retailerId || '',
        retailerName: prep.customerName || orderData.retailerName || '',
        retailerPhone: orderData.retailerPhone || '',
        total: orderData.total || 0,
        items: prep.items || [],
        shippingMode: mode,
        expressPayloadCode,
        deliveryLocked: mode === 'express_on_demand',
        status: 'pending_dispatch',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (!deliveryAgentOrdersSnap.empty) {
        // Update existing delivery order
        await updateDoc(doc(db, 'orders', deliveryAgentOrdersSnap.docs[0].id), {
          shippingMode: mode,
          expressPayloadCode,
          deliveryLocked: mode === 'express_on_demand',
          status: 'pending_dispatch',
          updatedAt: serverTimestamp()
        });
      } else {
        // Create a new delivery order
        const newOrderDocRef = doc(collection(db, 'orders'));
        await setDoc(newOrderDocRef, {
          id: newOrderDocRef.id,
          ...expressDeliveryPayload
        });
      }

      alert(`🎉 تم ترحيل الشحنة بنجاح واختيار ${mode === 'express_on_demand' ? 'التوصيل السريع (طلب فوري مقفل)' : 'التوصيل المشترك (طلب مفتوح)'}!\nتمت إضافتها في "بوابة عامل التوصيل والسائق".`);
    } catch (e: any) {
      console.error(e);
      alert('حدث خطأ أثناء الترحيل اللوجستي: ' + e.message);
    }
  };

  const filteredOrders = prepOrders.filter(o => 
    (activeTab === 'pending' ? o.prepStatus !== 'completed' : o.prepStatus === 'completed') &&
    (o.customerName.includes(searchTerm) || o.orderId.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-2xl">
              <Truck size={28} />
           </div>
           <div>
              <h2 className="text-2xl font-black text-navy-900 dark:text-white">تجهيز الطلبيات (المستودع)</h2>
              <p className="text-xs text-gray-500 font-bold uppercase">Warehouse Prep & Order Verification</p>
           </div>
        </div>
        
        <div className="flex bg-navy-100 dark:bg-navy-900 p-1 rounded-xl">
           <button 
             onClick={() => setActiveTab('pending')}
             className={`px-6 py-2 rounded-lg font-black text-sm transition-all ${activeTab === 'pending' ? 'bg-white dark:bg-navy-800 text-brand-primary shadow-sm' : 'text-gray-400'}`}
           >
             قيد التجهيز
           </button>
           <button 
             onClick={() => setActiveTab('completed')}
             className={`px-6 py-2 rounded-lg font-black text-sm transition-all ${activeTab === 'completed' ? 'bg-white dark:bg-navy-800 text-brand-primary shadow-sm' : 'text-gray-400'}`}
           >
             المكتملة
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredOrders.length === 0 ? (
          <div className="col-span-2 py-20 text-center space-y-4">
             <Box size={64} className="mx-auto text-gray-100 dark:text-navy-800" />
             <p className="text-gray-400 font-bold">لا توجد طلبيات للتجهيز حالياً</p>
          </div>
        ) : filteredOrders.map((order) => (
          <motion.div 
            key={order.id}
            layout
            className="card-glass overflow-hidden flex flex-col"
          >
             <div className="p-6 bg-navy-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                      <User size={20} />
                   </div>
                   <div>
                      <h4 className="font-bold text-sm">{order.customerName}</h4>
                      <p className="text-[10px] text-gray-400">رقم الفاتورة: #{order.orderId.slice(-6)}</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   {!order.preppedBy && (
                      <button 
                       onClick={() => handleStartPrep(order.id)}
                       className="px-4 py-1.5 bg-brand-primary text-navy-900 text-[10px] font-black rounded-lg shadow-lg animate-pulse"
                      >
                         بدء التجهيز (قفل)
                      </button>
                   )}
                   <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                     order.prepStatus === 'completed' ? 'bg-success text-white' : 
                     order.prepStatus === 'with_issues' ? 'bg-danger text-white' : 'bg-warning text-navy-900'
                   }`}>
                      {order.prepStatus === 'completed' ? 'جاهز للتسليم' : 
                       order.prepStatus === 'with_issues' ? 'نقص رصيد/بضاعة' : 'جاري التجهيز'}
                   </div>
                </div>
             </div>

             {/* Toggle Mode inside card */}
             <div className="px-6 pt-4 border-b border-gray-100 dark:border-white/5 pb-3">
               <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-gray-50 dark:bg-navy-950/60 p-3 rounded-2xl border border-gray-200 dark:border-white/5">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-bold block">منهجية الفحص والمطابقة:</span>
                    <span className="text-xs font-black text-navy-900 dark:text-white">
                      {(orderVerificationModes[order.id] || 'fast') === 'fast' 
                        ? '⚡ المسار السريع (صح/خطأ للكمية)' 
                        : '⚙️ المسار الدقيق (الكمية والتوفر)'}
                    </span>
                  </div>
                  <div className="flex bg-gray-200 dark:bg-navy-900 p-0.5 rounded-xl border border-white/5">
                     <button
                       type="button"
                       onClick={() => setOrderVerificationModes(prev => ({ ...prev, [order.id]: 'fast' }))}
                       className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer border-none ${
                         (orderVerificationModes[order.id] || 'fast') === 'fast'
                           ? 'bg-brand-primary text-navy-900 shadow-sm font-black'
                           : 'text-gray-400 hover:text-white bg-transparent'
                       }`}
                     >
                       صح / خطأ سريع
                     </button>
                     <button
                       type="button"
                       onClick={() => setOrderVerificationModes(prev => ({ ...prev, [order.id]: 'manual' }))}
                       className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer border-none ${
                         (orderVerificationModes[order.id] || 'fast') === 'manual'
                           ? 'bg-brand-primary text-navy-900 shadow-sm font-black'
                           : 'text-gray-400 hover:text-white bg-transparent'
                       }`}
                     >
                       إدخال كمية وتعديل
                     </button>
                  </div>
               </div>
             </div>

             <div className="p-6 space-y-3 flex-1 overflow-y-auto max-h-[350px]">
                {order.items.map((item, itemIdx) => {
                  const preparedQuantity = item.preparedQty !== undefined ? item.preparedQty : (item.status === 'ready' ? item.requestedQty : 0);
                  const isDeficit = preparedQuantity < item.requestedQty;
                  const deficitAmount = item.requestedQty - preparedQuantity;
                  const isFastMode = (orderVerificationModes[order.id] || 'fast') === 'fast';

                  return (
                    <div 
                      key={`${order.id}-${item.itemId}-${itemIdx}`} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl transition-all gap-4 border ${
                        item.status === 'missing' 
                          ? 'bg-red-500/[0.03] border-red-500/20 dark:bg-red-950/10 dark:border-red-500/10' 
                          : isDeficit && item.status === 'ready'
                          ? 'bg-amber-500/[0.03] border-amber-500/20 dark:bg-amber-950/10 dark:border-amber-500/10'
                          : 'bg-gray-50 border-gray-100 dark:bg-navy-900/50 dark:border-white/5'
                      }`}
                    >
                       <div className="space-y-1 text-right flex-1">
                          <p className="font-bold text-sm text-navy-900 dark:text-white">{item.name}</p>
                          <div className="flex flex-wrap items-center gap-2 justify-start">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                              مطلوب: <strong className="text-navy-900 dark:text-white">{item.requestedQty}</strong>
                            </span>
                            <span className="text-xs text-gray-400">|</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                              متوفر حالياً: <strong className={item.status === 'missing' ? 'text-red-400' : isDeficit ? 'text-amber-500 font-black' : 'text-emerald-500 font-black'}>{preparedQuantity}</strong>
                            </span>
                            
                            {item.status === 'ready' && isDeficit && (
                              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-full animate-pulse">
                                ⚠️ عجز: -{deficitAmount} أجهزة
                              </span>
                            )}
                            {item.status === 'missing' && (
                              <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[10px] font-black rounded-full">
                                🚨 غير متوفر بالكامل
                              </span>
                            )}
                            {item.status === 'ready' && !isDeficit && (
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full">
                                ✅ جاهز بالكامل
                              </span>
                            )}
                          </div>
                       </div>

                       {/* Verification controls & interactive tally */}
                       <div className="flex items-center justify-end gap-3 self-end sm:self-auto">
                          
                          {/* Mode 2: Manual item/quantity entry */}
                          {!isFastMode ? (
                            <div className="flex items-center gap-2">
                              {/* Direct text input for exact quantities */}
                              <input
                                type="number"
                                min={0}
                                max={item.requestedQty}
                                value={preparedQuantity}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(item.requestedQty, parseInt(e.target.value) || 0));
                                  handleUpdatePreparedQty(order.id, item.itemId, val);
                                }}
                                className="w-14 px-1.5 py-1 text-center font-mono font-black text-xs text-white bg-navy-950 border border-white/15 rounded-lg outline-none text-right"
                              />

                              {/* Plus/Minus Buttons */}
                              <div className="flex items-center bg-black/10 dark:bg-navy-800/80 rounded-xl p-1 border border-white/5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePreparedQty(order.id, item.itemId, preparedQuantity - 1)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/20 dark:hover:bg-navy-700 text-gray-400 hover:text-white transition-all cursor-pointer border-none bg-transparent"
                                  title="تنقيص كمية الأجهزة"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="px-1.5 text-xs font-mono font-bold text-navy-900 dark:text-white min-w-[20px] text-center">
                                  {preparedQuantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePreparedQty(order.id, item.itemId, preparedQuantity + 1)}
                                  disabled={preparedQuantity >= item.requestedQty}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/20 dark:hover:bg-navy-700 text-gray-400 hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border-none bg-transparent"
                                  title="زيادة كمية الأجهزة"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {/* Mode 1 & 2 Fast Select buttons (✓ / ✗) */}
                          <div className="flex items-center gap-1.5 border-r border-gray-200 dark:border-white/5 pr-3">
                             <button 
                               type="button"
                               onClick={() => {
                                 handlePrepToggle(order.id, item.itemId, 'missing');
                                 handleUpdatePreparedQty(order.id, item.itemId, 0);
                               }}
                               className={`p-2 rounded-xl transition-all cursor-pointer border-none ${
                                 item.status === 'missing' 
                                   ? 'bg-red-500 text-white scale-105 shadow-lg shadow-red-500/20' 
                                   : 'bg-gray-200 hover:bg-red-500/15 text-gray-400 hover:text-red-500 dark:bg-navy-800'
                               }`}
                               title={isFastMode ? "غير متوفر بالكامل (خطأ)" : "تصفير الكمية المتوفرة"}
                             >
                                <XCircle size={18} />
                             </button>
                             <button 
                               type="button"
                               onClick={() => {
                                 handlePrepToggle(order.id, item.itemId, 'ready');
                                 handleUpdatePreparedQty(order.id, item.itemId, item.requestedQty);
                               }}
                               className={`p-2 rounded-xl transition-all cursor-pointer border-none ${
                                 item.status === 'ready' && !isDeficit
                                   ? 'bg-emerald-500 text-white scale-105 shadow-lg shadow-emerald-500/20' 
                                   : 'bg-gray-200 hover:bg-emerald-500/15 text-gray-400 hover:text-emerald-500 dark:bg-navy-800'
                               }`}
                               title={isFastMode ? "متوفر بالكامل (صح)" : "تعبئة الكمية بالكامل"}
                             >
                                <CheckCircle2 size={18} />
                             </button>
                          </div>
                       </div>
                    </div>
                  );
                })}

                {/* Real-time Deficit Recalculation Summary (Requirement 2) */}
                {(() => {
                  const totalRequested = order.items.reduce((acc, i) => acc + i.requestedQty, 0);
                  const totalPrepared = order.items.reduce((acc, i) => {
                    const prepared = i.preparedQty !== undefined ? i.preparedQty : (i.status === 'ready' ? i.requestedQty : 0);
                    return acc + prepared;
                  }, 0);
                  const totalDeficit = totalRequested - totalPrepared;

                  return totalDeficit > 0 ? (
                    <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl flex items-center justify-between text-xs text-amber-500 font-bold animate-pulse text-right" dir="rtl">
                      <span>🚨 رصد عجز إجمالي في التجهيز الميداني:</span>
                      <span className="font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg">-{totalDeficit} حبة ناقصة</span>
                    </div>
                  ) : (
                    <div className="mt-4 p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl flex items-center justify-between text-xs text-emerald-400 font-bold text-right" dir="rtl">
                      <span>✓ مطابقة مكتملة ومثالية للمنتجات:</span>
                      <span className="font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg">لا يوجد أي عجز</span>
                    </div>
                  );
                })()}
             </div>

             <div className="p-4 border-t border-gray-100 dark:border-navy-800 flex flex-col gap-4 bg-gray-50/50 dark:bg-navy-900/30">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                     <ClipboardList size={14} />
                     <span>المجهز: {order.preppedBy || '---'}</span>
                  </div>
                  {order.prepStatus !== 'completed' && order.prepStatus !== 'ready' && (
                    <button 
                      onClick={() => handleOpenSettlement(order)}
                      className="px-6 py-2 bg-brand-primary text-navy-900 rounded-xl text-xs font-black hover:scale-105 transition-all shadow-lg shadow-brand-primary/10 cursor-pointer border-none"
                    >
                      ✓ تأكيد مطابقة الفاتورة والتسوية
                    </button>
                  )}
                </div>

                {/* Logistics Routing Panel (Requirement 1) */}
                {order.prepStatus === 'completed' && !(order as any).dispatched && (
                  <div className="p-4 bg-navy-950/40 border border-white/5 rounded-2xl space-y-3 text-right w-full" dir="rtl">
                    <p className="text-xs text-amber-400 font-bold flex items-center gap-1.5 justify-end">
                      <Truck size={14} />
                      <span>🚚 نظام التوجيه والترحيل اللوجستي الفوري:</span>
                    </p>
                    <p className="text-[10px] text-gray-400 leading-relaxed font-bold">
                      يرجى استدعاء مندوب شحن فوري وتعيين رمز أمان مغلق لحماية الشحنة، أو ضم الفاتورة للطلبات المشتركة المفتوحة:
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLogisticsRouting(order, 'express_on_demand')}
                        className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-navy-950 font-black rounded-xl text-[10px] transition-all cursor-pointer border-none"
                      >
                        ⚡ استدعاء توصيل سريع
                      </button>
                      <button
                        onClick={() => handleLogisticsRouting(order, 'shared_courier')}
                        className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold rounded-xl text-[10px] transition-all cursor-pointer border-none"
                      >
                        👥 إضافة للتوصيل المشترك
                      </button>
                    </div>
                  </div>
                )}

                {order.prepStatus === 'completed' && (order as any).dispatched && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-2xl text-center text-xs space-y-1 w-full" dir="rtl">
                    <p className="font-black flex items-center gap-1 justify-center">
                      <CheckCircle2 size={14} />
                      <span>✓ تم ترحيل الشحنة بنجاح إلى بوابة السائقين</span>
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold">
                      نوع الشحن: {(order as any).shippingMode === 'express_on_demand' ? '⚡ توصيل سريع (طلب فوري مغلق)' : '👥 توصيل مشترك (مفتوح)'}
                      {(order as any).expressPayloadCode && ` | الرمز السري لشحنة السائق: ${(order as any).expressPayloadCode}`}
                    </p>
                  </div>
                )}
             </div>
          </motion.div>
        ))}
      </div>

      {/* Liability Disclaimer Footer */}
      <div className="mt-12 p-8 bg-gray-100 dark:bg-navy-900/50 rounded-[2rem] border border-gray-200 dark:border-navy-800 text-center">
         <div className="flex items-center justify-center gap-2 mb-4 text-gray-400">
            <AlertTriangle size={20} />
            <h4 className="text-sm font-black uppercase tracking-widest">إخلاء المسؤولية القانونية</h4>
         </div>
         <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto font-bold">
            نظام "غرفة التجهيز" هو أداة تقنية لتنظيم العمل الداخلي للمستودعات. إدارة البرنامج لا تتحمل أي مسؤولية عن الأخطاء في التجهيز، أو التلاعب في الكميات، أو النزاعات التي قد تنشأ بين الموظفين وأصحاب العمل. كافة العمليات مسجلة باسم المجهز للرجوع إليها مستقبلاً.
         </p>
      </div>

      {/* Post-Verification Settlement Overlay (Requirement 3) */}
      <AnimatePresence>
        {selectedSettlementPrep && associatedOrderData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-right"
            dir="rtl"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-navy-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-gray-100 dark:border-navy-800 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-navy-900 text-white flex justify-between items-center">
                <button 
                  onClick={() => setSelectedSettlementPrep(null)}
                  className="p-1 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all cursor-pointer border-none"
                >
                  <X size={18} />
                </button>
                <div className="flex items-center gap-2">
                  <Coins className="text-brand-primary w-5 h-5 animate-bounce" />
                  <h3 className="text-base font-black text-white">⚙️ تسوية ومطابقة عجز الفاتورة الميداني</h3>
                </div>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto flex-1 text-right">
                {/* Order Meta */}
                <div className="bg-navy-50/50 dark:bg-navy-950 p-4 rounded-2xl border border-gray-100 dark:border-navy-800 space-y-2 text-right">
                  <p className="text-xs text-gray-500 font-bold">معلومات الفاتورة الأصلية:</p>
                  <div className="grid grid-cols-2 gap-4 text-xs text-right">
                    <div>
                      <span className="text-gray-400">العميل: </span>
                      <span className="font-bold text-navy-900 dark:text-white">{associatedOrderData.retailerName}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">طريقة الدفع: </span>
                      <span className="font-black text-amber-500">{associatedOrderData.paymentType === 'debt' ? 'آجل (مديونية دفتري)' : 'نقدي / تحويل'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">رقم الفاتورة: </span>
                      <span className="font-mono text-gray-600 dark:text-gray-300">#{associatedOrderData.id.slice(-6)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">قيمة الفاتورة المعتمدة: </span>
                      <span className="font-black text-brand-primary">{(associatedOrderData.total || 0).toLocaleString()} YER</span>
                    </div>
                  </div>
                </div>

                {/* Deficit Recalculation Summary */}
                {(() => {
                  const { hasDeficit, deficitItems, deficitValue } = calculatePrepMetrics();
                  return (
                    <div className="space-y-4 text-right">
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-navy-800 pb-2 text-right">
                        <span className="text-xs text-rose-500 font-black">إجمالي قيمة العجز: {deficitValue.toLocaleString()} YER</span>
                        <span className="text-xs text-gray-400 font-bold">الأصناف التي بها عجز تجهيز:</span>
                      </div>

                      {deficitItems.length === 0 ? (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl text-center text-xs font-bold">
                          ✓ جميع المنتجات جاهزة ومتوفرة بالكامل! يمكنك المطابقة مباشرة بدون عجز مالي.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto text-right">
                          {deficitItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-xs font-semibold text-right">
                              <span className="font-bold text-rose-500">-{item.deficitTotal.toLocaleString()} YER</span>
                              <div className="text-right">
                                <span className="font-bold text-navy-900 dark:text-white">{item.name}</span>
                                <p className="text-[10px] text-gray-400 mt-0.5">العجز: {item.deficitQty} حبة × {item.price.toLocaleString()} ر.ي</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Dynamic Options depending on original paymentType (Requirement 3) */}
                      <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-navy-800 text-right">
                        <p className="text-xs text-gray-500 font-bold">مسار التسوية المقترح طبقاً لنوع الفاتورة:</p>
                        
                        {associatedOrderData.paymentType === 'debt' ? (
                          <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl space-y-4 text-right">
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold leading-relaxed">
                              🔗 بما أن العميل اشترى بـ "الدين الآجل"، فإن عجز التجهيز سيتم حسمه وقيده لصالحه مباشرة لتقليص ذمته المالية:
                            </p>
                            <button
                              disabled={submittingSettlement}
                              onClick={handleConfirmDebtSettlement}
                              className="w-full py-3 bg-brand-primary text-navy-900 font-black rounded-xl text-xs hover:scale-[1.02] transition-all cursor-pointer border-none"
                            >
                              {submittingSettlement ? 'جاري قيد وحسم الديون...' : '✓ خصم العجز من مديونية العميل آلياً'}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4 text-right">
                            {/* Option 1: Direct Cash Settlement */}
                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl space-y-3 text-right">
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold leading-relaxed text-right">
                                💸 خيار 1: إرجاع نقدي فوري للفارق المالي للعجز:
                              </p>
                              <button
                                disabled={submittingSettlement}
                                onClick={handleConfirmDirectCashSettlement}
                                className="w-full py-3 bg-emerald-500 text-white font-black rounded-xl text-xs hover:scale-[1.02] transition-all cursor-pointer border-none"
                              >
                                {submittingSettlement ? 'جاري معالجة الإرجاع...' : 'تسجيل وإثبات العجز كمرتجع مالي مستحق للعميل'}
                              </button>
                            </div>

                            {/* Option 2: Substitution & Route back */}
                            <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-2xl space-y-4 text-right">
                              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold leading-relaxed text-right">
                                🔄 خيار 2: "فاتورة توفية منتجات" - استبدال العجز بمنتجات أخرى متاحة في المخزن حالياً:
                              </p>

                              {/* Search local inventory */}
                              <div className="space-y-3 text-right">
                                <div className="relative">
                                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                  <input 
                                    type="text" 
                                    placeholder="البحث في مخزن المحل عن أصناف بديلة..."
                                    value={searchProductTerm}
                                    onChange={(e) => setSearchProductTerm(e.target.value)}
                                    className="w-full pr-10 pl-3 py-2 text-xs bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl outline-none focus:border-blue-500 text-right text-navy-900 dark:text-white"
                                  />
                                </div>

                                {/* Results list */}
                                {searchProductTerm.trim() && (
                                  <div className="bg-white dark:bg-navy-950 border border-gray-100 dark:border-navy-850 rounded-xl max-h-[150px] overflow-y-auto divide-y divide-gray-50 dark:divide-navy-800 text-right">
                                    {inventory.filter(p => p.name.includes(searchProductTerm)).slice(0, 5).map((prod) => (
                                      <div key={prod.id} className="p-2.5 flex justify-between items-center text-xs text-right">
                                        <button
                                          onClick={() => {
                                            const exists = substitutionItems.find(i => i.id === prod.id);
                                            if (exists) {
                                              const newQty = exists.quantity + 1;
                                              if (newQty > prod.stock) {
                                                alert("خطأ: الكمية المتاحة في المخزن غير كافية لإتمام التوفية");
                                                return;
                                              }
                                              setSubstitutionItems(prev => prev.map(i => i.id === prod.id ? { ...i, quantity: newQty } : i));
                                            } else {
                                              if (prod.stock < 1) {
                                                alert("خطأ: الكمية المتاحة في المخزن غير كافية لإتمام التوفية");
                                                return;
                                              }
                                              setSubstitutionItems(prev => [...prev, { ...prod, quantity: 1 }]);
                                            }
                                            setSearchProductTerm('');
                                          }}
                                          className="p-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 border-none cursor-pointer"
                                        >
                                          <PlusCircle size={16} />
                                        </button>
                                        <div className="text-right">
                                          <p className="font-bold text-navy-900 dark:text-white">{prod.name}</p>
                                          <p className="text-[10px] text-gray-400">المتوفر: {prod.stock} حبة | السعر: {prod.price} ر.ي</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Selected Substitutions */}
                                {substitutionItems.length > 0 && (
                                  <div className="space-y-2 text-right">
                                    <p className="text-[11px] text-gray-400 font-bold text-right">الأصناف البديلة المضافة للفاتورة التوفية:</p>
                                    {substitutionItems.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center bg-white dark:bg-navy-950 p-2.5 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-right">
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center gap-1">
                                            <button 
                                              onClick={() => setSubstitutionItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}
                                              className="p-1 bg-gray-100 dark:bg-navy-800 rounded-md border-none cursor-pointer text-navy-900 dark:text-white"
                                            >
                                              <Minus size={12} />
                                            </button>
                                            <span className="font-mono font-black px-2 text-navy-900 dark:text-white">{item.quantity}</span>
                                            <button 
                                              onClick={() => {
                                                 const newQty = item.quantity + 1;
                                                 if (newQty > item.stock) {
                                                   alert("خطأ: الكمية المتاحة في المخزن غير كافية لإتمام التوفية");
                                                   return;
                                                 }
                                                 setSubstitutionItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: newQty } : i));
                                               }}
                                              className="p-1 bg-gray-100 dark:bg-navy-800 rounded-md border-none cursor-pointer text-navy-900 dark:text-white"
                                            >
                                              <Plus size={12} />
                                            </button>
                                          </div>
                                          <button 
                                            onClick={() => setSubstitutionItems(prev => prev.filter(i => i.id !== item.id))}
                                            className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-md border-none cursor-pointer"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                        <div className="flex items-center gap-2 justify-end text-right">
                                          <span className="font-mono bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-md">{(item.price || item.cost || 0).toLocaleString()} ر.ي</span>
                                          <span className="font-bold text-navy-900 dark:text-white">{item.name}</span>
                                        </div>
                                      </div>
                                    ))}

                                    <div className="flex justify-between items-center text-xs font-bold border-t border-gray-100 dark:border-navy-800 pt-2 text-blue-500 text-right">
                                      <span>{substitutionItems.reduce((a, b) => a + ((b.price || b.cost || 0) * b.quantity), 0).toLocaleString()} YER</span>
                                      <span>إجمالي قيمة البدائل:</span>
                                    </div>

                                    <button
                                      disabled={submittingSettlement}
                                      onClick={handleAddSubstitutionAndRouteBack}
                                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                                    >
                                      <RefreshCw size={14} className={submittingSettlement ? "animate-spin" : ""} />
                                      <span>تأكيد الإبدال وإعادة التوجيه للتعبئة والتغليف بالمستودع</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-navy-850 flex justify-end gap-3 bg-gray-50/50 dark:bg-navy-950/30">
                <button
                  onClick={() => setSelectedSettlementPrep(null)}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-gray-500 dark:text-gray-300 font-bold rounded-xl text-xs transition-all border-none cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
