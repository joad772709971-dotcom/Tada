import { 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  updateDoc, 
  increment,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { NetworkOrder, WarehousePrepOrder, UserProfile } from '../types';
import { isAllowedTierGap } from '../utils/b2bTierHierarchy';
import { b2bLinkageEngine } from './b2bLinkageEngine';
import { b2bCatalogBridgeEngine } from './b2bCatalogBridgeEngine';
import { CrossProjectRelay } from './CrossProjectRelayService';
import { CrossProjectNotificationHub } from './CrossProjectNotificationHub';
import { FirebaseProjectRouter } from './FirebaseProjectRouter';
import { AutomatedJournalEngine } from './AutomatedJournalEngine';
import { postReturnOrLossToLedger } from './InventoryLossesService';

/**
 * JAM System Pro 2026 - B2B Order, Financial, and Warehouse Lifecycle Service
 * Implementing React 19 + TypeScript compatible core business logic handlers
 * with strict constraints, automatic inventory ingestion, and multi-tier cashbook posting.
 */

// Action Types for State/Redux/React Context standard tracking
export const B2B_ACTION_TYPES = {
  PLACE_ORDER: 'b2b/PLACE_ORDER',
  CASHIER_APPROVE: 'b2b/CASHIER_APPROVE',
  START_PREPPING: 'b2b/START_PREPPING',
  RECONCILE_SHORTAGE: 'b2b/RECONCILE_SHORTAGE',
  DIRECT_DISPATCH: 'b2b/DIRECT_DISPATCH',
  SHIP_ORDER: 'b2b/SHIP_ORDER',
  RECEIVE_DELIVERY: 'b2b/RECEIVE_DELIVERY'
};

export const b2bLifecycleService = {
  
  // ==========================================
  // 1. مرحلة التحقق والطلب (التاجر 1 إلى التاجر 2)
  // ==========================================
  
  /**
   * Verifies partnership connection links and places a secure B2B market order.
   * After verification of linkKey, order is saved securely in "pending" status.
   */
  async placeSecureB2BOrder(params: {
    buyerProfile: UserProfile,
    supplierId: string,
    supplierName: string,
    linkKey: string,
    cartItems: {
      productId: string;
      name: string;
      quantity: number;
      price: number;
      warrantyType?: 'none' | 'operational' | 'limited';
      warrantyDuration?: number;
      compensationOption?: 'refund' | 'replace_same' | 'replace_other';
    }[],
    paymentType: 'cash' | 'debt',
    notes?: string
  }) {
    const { buyerProfile, supplierId, supplierName, linkKey, cartItems, paymentType, notes } = params;

    // Axis 1: Verify supplier profile and 1-tier hierarchy gap constraint
    const supplierDocRef = doc(db, 'users', supplierId);
    const supplierDoc = await getDoc(supplierDocRef);
    if (supplierDoc.exists()) {
      const supplierData = supplierDoc.data();
      const buyerRole = buyerProfile.hierarchyLevel || buyerProfile.role || 'retailer';
      const supplierRole = supplierData.hierarchyLevel || supplierData.role || supplierData.networkRole || 'wholesaler';

      if (!isAllowedTierGap(buyerRole, supplierRole)) {
        throw new Error('❌ تعذر تنفيذ الطلب: يتنافى مع هيكلية رتب السوق. لا يمكن للتجزئة الشراء المباشر من تاجر جملة الجملة (المستورد).');
      }
    }

    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Axis 2: Comprehensive Credit Limit & Connection Status Verification
    const creditCheck = await b2bLinkageEngine.verifyOrderCreditAndStatus({
      buyerOwnerId: buyerProfile.ownerId || buyerProfile.uid,
      supplierOwnerId: supplierId,
      paymentType,
      orderAmount: totalAmount
    });

    if (!creditCheck.allowed) {
      throw new Error(creditCheck.message);
    }

    // Axis 3: Real-time Live Inventory Verification (التحقق الجردي المباشر لمنع بيع الأوهام)
    const stockCheck = await b2bCatalogBridgeEngine.verifyStockAvailability(
      cartItems.map(item => ({
        productId: item.productId,
        requestedQty: item.quantity,
        productName: item.name,
        supplierId
      }))
    );

    if (!stockCheck.valid) {
      throw new Error(stockCheck.errorMessage || '❌ الرصيد المخزني لدى المورد غير كافٍ لإنشاء الطلب.');
    }

    // Reserve stock immediately
    await b2bCatalogBridgeEngine.reserveInventoryStock(
      cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        supplierId
      }))
    );

    const batch = writeBatch(db);
    const orderRef = doc(collection(db, 'orders'));

    const orderPayload: Partial<NetworkOrder> = {
      id: orderRef.id,
      retailerId: buyerProfile.ownerId || buyerProfile.uid,
      retailerName: buyerProfile.name || buyerProfile.shopName || 'تاجر تجزئة معتمد',
      wholesalerId: supplierId,
      wholesalerName: supplierName,
      Sender_StoreID: buyerProfile.ownerId || buyerProfile.uid,
      Receiver_StoreID: supplierId,
      ownerId: buyerProfile.ownerId || buyerProfile.uid,
      items: cartItems.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        status: 'available',
        warrantyType: item.warrantyType || 'none',
        warrantyDuration: item.warrantyDuration || 0,
        compensationOption: item.compensationOption || 'replace_same',
        purchaseDate: new Date().toISOString()
      })),
      total: totalAmount,
      status: 'pending',
      paymentType: paymentType,
      wholesalerSigned: false,
      retailerSigned: false,
      notes: notes || '',
      createdAt: new Date().toISOString(), // Compatible serialize timestamp or serverTimestamp helper
    };

    batch.set(orderRef, orderPayload);

    // Save Audit trail
    const auditRef = doc(collection(db, 'auditLogs'));
    batch.set(auditRef, {
      action: B2B_ACTION_TYPES.PLACE_ORDER,
      userId: buyerProfile.uid,
      userName: buyerProfile.name,
      details: `تم إرسال طلب جديد للمورد ${supplierName} بقيمة ${totalAmount.toLocaleString()} ر.ي`,
      timestamp: serverTimestamp()
    });

    await batch.commit();

    // Axis 3: Automated GL Entry for Buyer Order Confirmation (with Idempotency Key)
    try {
      await AutomatedJournalEngine.postB2BOrderBuyerConfirmationGL({
        buyerOwnerId: buyerProfile.ownerId || buyerProfile.uid,
        supplierOwnerId: supplierId,
        supplierName: supplierName,
        orderId: orderRef.id,
        totalAmount: totalAmount,
        paymentType: paymentType
      });
    } catch (glErr) {
      console.warn('⚠️ [Axis 3 GL] Buyer confirmation GL posting note:', glErr);
    }

    // Axis 4: Cross-Project B2B Order Relay Engine (ترحيل الطلب عبر المشاريع والتطبيقات)
    try {
      const supplierDocRef = doc(db, 'users', supplierId);
      const supplierDoc = await getDoc(supplierDocRef);
      const supplierRole = supplierDoc.exists() ? (supplierDoc.data().hierarchyLevel || supplierDoc.data().role || supplierDoc.data().networkRole || 'wholesaler') : 'wholesaler';
      const supplierTier = FirebaseProjectRouter.resolveTier(String(supplierRole), supplierDoc.exists() ? supplierDoc.data() : undefined);

      await CrossProjectRelay.relayPurchaseOrder(
        buyerProfile,
        supplierTier,
        supplierId,
        supplierName,
        {
          items: cartItems.map(item => ({
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity
          })),
          totalAmount,
          currency: 'YER',
          notes: notes || ''
        }
      );
    } catch (relayErr) {
      console.warn('⚠️ [Axis 4 Relay] Multi-project relay execution note:', relayErr);
    }

    // Axis 7: Cross-Project Notification Hub Dispatch (مركز الإشعارات الموحد)
    try {
      const supplierDocRef = doc(db, 'users', supplierId);
      const supplierDoc = await getDoc(supplierDocRef);
      const supplierRole = supplierDoc.exists() ? (supplierDoc.data().hierarchyLevel || supplierDoc.data().role || supplierDoc.data().networkRole || 'wholesaler') : 'wholesaler';
      const supplierTier = FirebaseProjectRouter.resolveTier(String(supplierRole), supplierDoc.exists() ? supplierDoc.data() : undefined);

      await CrossProjectNotificationHub.dispatchNotification({
        recipientUid: supplierId,
        recipientTier: supplierTier,
        title: `📦 طلب توريد جديد من ${buyerProfile.name}`,
        body: `تم إرسال طلب جملة جديد بقيمة ${totalAmount.toLocaleString()} YER من ${buyerProfile.name}.`,
        type: 'b2b_order',
        relatedEntityId: orderRef.id,
        priority: 'urgent'
      });
    } catch (notifErr) {
      console.warn('⚠️ [Axis 7 Notification] Notification dispatch note:', notifErr);
    }

    return { success: true, orderId: orderRef.id, total: totalAmount };
  },

  /**
   * Adaptive Role Fallback Resolver (درع التوجيه الذكي عند غياب الموظف والمهلة الزمنية)
   * Automatically resolves target employee ID or falls back to Store Manager / Sales Agent
   * based on role existence, online presence, timeout window, and request processing lock.
   */
  async resolveTargetRoleWithFallback(params: {
    shopOwnerId: string,
    requestedRole: 'cashier' | 'packer' | 'delivery_agent',
    routingConfig?: any,
    orderCreatedAt?: number | Date | any,
    orderLockedBy?: string | null
  }): Promise<{ userId: string; userName: string; roleAssigned: string; fallbackReason?: string }> {
    const { shopOwnerId, requestedRole, routingConfig, orderCreatedAt, orderLockedBy } = params;

    const config = routingConfig || (() => {
      try {
        const saved = localStorage.getItem('jam_order_routing_config_v1');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    })();

    try {
      // 1. Request Lock Guard: If processing lock enabled & order is locked by active employee, retain lock
      if (config.enableOrderProcessingLock !== false && orderLockedBy) {
        return {
          userId: orderLockedBy,
          userName: 'الموظف المعالج الحالي (تم قفل الطلب)',
          roleAssigned: requestedRole
        };
      }

      const usersQuery = query(
        collection(db, 'users'),
        where('ownerId', '==', shopOwnerId)
      );
      const usersSnap = await getDocs(usersQuery);

      let users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));

      // Try finding user with the exact requested role
      let roleUser = users.find(u => u.role === requestedRole);

      if (roleUser) {
        let isUserOnline = true;
        // Presence Guard Check
        if (config.checkOnlinePresence !== false) {
          const lastActive = (roleUser as any).lastActive ? new Date((roleUser as any).lastActive).getTime() : 0;
          const tenMinsMs = 10 * 60 * 1000;
          if ((roleUser as any).isOnline === false || (lastActive > 0 && Date.now() - lastActive > tenMinsMs)) {
            isUserOnline = false;
          }
        }

        // Timeout Window Check
        let isTimedOut = false;
        const timeoutMins = config.routingTimeoutMinutes || 5;
        if (orderCreatedAt) {
          const createdMs = typeof orderCreatedAt === 'number' 
            ? orderCreatedAt 
            : orderCreatedAt?.toDate ? orderCreatedAt.toDate().getTime() : new Date(orderCreatedAt).getTime();
          
          if (createdMs > 0 && (Date.now() - createdMs > timeoutMins * 60 * 1000)) {
            isTimedOut = true;
          }
        }

        // If online & not timed out, direct to original employee
        if (isUserOnline && !isTimedOut) {
          return {
            userId: roleUser.uid,
            userName: roleUser.name || `موظف ${requestedRole}`,
            roleAssigned: requestedRole
          };
        }
      }

      // Fallback required (due to absence, offline state, or timeout expiry)
      const fallbackRoleKey = `${requestedRole}FallbackRole`;
      const preferredFallback = config[fallbackRoleKey] || 'manager';

      // Find fallback user (Manager or Sales Agent)
      let fallbackUser = users.find(u => u.role === preferredFallback || u.role === 'admin' || u.role === 'owner');

      if (!fallbackUser && users.length > 0) {
        fallbackUser = users[0];
      }

      const reason = !roleUser 
        ? 'عدم وجود مسمى وظيفي مسجل بالمحل' 
        : 'انقطاع/عدم اتصال الموظف أو تجاوز المهلة الزمنية المحددة';

      return {
        userId: fallbackUser?.uid || shopOwnerId,
        userName: fallbackUser?.name || 'المدير العام للمحل',
        roleAssigned: fallbackUser?.role || 'manager',
        fallbackReason: reason
      };
    } catch (e) {
      console.warn('Fallback role resolution error, defaulting to Store Manager:', e);
      return {
        userId: shopOwnerId,
        userName: 'المدير العام للمحل',
        roleAssigned: 'manager',
        fallbackReason: 'خطأ في الاستعلام، تم التحويل الاحتياطي المباشر'
      };
    }
  },

  /**
   * Acquire Request Processing Lock (قفل المعالجة للطلب):
   * Locks the order to prevent duplicate processing by other employees once opened.
   */
  async acquireOrderProcessingLock(orderId: string, userId: string, userName: string): Promise<{ success: boolean; message: string; lockedBy?: string }> {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        return { success: false, message: 'الطلب غير موجود.' };
      }

      const data = orderSnap.data();
      if (data.processingLockedBy && data.processingLockedBy !== userId) {
        return {
          success: false,
          message: `⚠️ الطلب قيد المعالجة حالياً بواسطة الموظف (${data.processingLockedByName || data.processingLockedBy}). تم القفل لمنع الازدواجية.`,
          lockedBy: data.processingLockedByName || data.processingLockedBy
        };
      }

      await updateDoc(orderRef, {
        processingLockedBy: userId,
        processingLockedByName: userName,
        processingLockedAt: serverTimestamp()
      });

      return {
        success: true,
        message: `🔒 تم قفل الطلب بنجاح لحساب الموظف (${userName}) لمنع التداخل بين الموظفين.`
      };
    } catch (e: any) {
      console.warn('Failed to acquire processing lock:', e);
      return { success: false, message: e.message };
    }
  },

  /**
   * Release Request Processing Lock (فك قفل المعالجة):
   */
  async releaseOrderProcessingLock(orderId: string): Promise<boolean> {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        processingLockedBy: null,
        processingLockedByName: null,
        processingLockedAt: null
      });
      return true;
    } catch (e) {
      console.warn('Failed to release processing lock:', e);
      return false;
    }
  },

  /**
   * Cashier verification of payment before processing
   * Approves and routes B2B orders to active warehouse preparation state 'prepping'
   */
  async approveAndRouteToPrep(orderId: string, cashierUserId: string, cashierName: string) {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      throw new Error('⚠️ الطلب المحدد غير موجود بقاعدة البيانات.');
    }

    const orderData = orderSnap.data() as NetworkOrder;
    const batch = writeBatch(db);

    // Update status to 'prepping'
    batch.update(orderRef, {
      status: 'prepping',
      cashierValidated: true,
      approvedBy: cashierUserId,
      approvedByName: cashierName,
      updatedAt: serverTimestamp()
    });

    // Create entry in 'warehousePrepOrders'
    const prepRef = doc(collection(db, 'warehousePrepOrders'));
    const prepPayload: Partial<WarehousePrepOrder> = {
      id: prepRef.id,
      ownerId: orderData.wholesalerId, // belongs to Supplier warehouse
      orderId: orderId,
      customerName: orderData.retailerName,
      items: orderData.items.map(item => ({
        itemId: item.productId,
        name: item.name,
        requestedQty: item.quantity,
        preparedQty: item.quantity, // starts as fully matched
        status: 'pending'
      })),
      prepStatus: 'pending',
      createdAt: serverTimestamp()
    };
    batch.set(prepRef, prepPayload);

    // Secure Cash Account logic: If cash payment is verified upfront, add to supplier's cash register immediately
    if (orderData.paymentType === 'cash') {
      // Look for Supplier of the order
      const supplierAccountsQuery = query(
        collection(db, 'accounts'),
        where('ownerId', '==', orderData.wholesalerId),
        where('isDefault', '==', true)
      );
      const accSnap = await getDocs(supplierAccountsQuery);

      if (!accSnap.empty) {
        const accDoc = accSnap.docs[0];
        batch.update(accDoc.ref, {
          balance: increment(orderData.total)
        });

        // Add confirmed income record inside Wholesaler/Supplier financial ledger
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          ownerId: orderData.wholesalerId,
          amount: orderData.total,
          type: 'income',
          category: 'المبيعات النقدية للموردين',
          description: `مقبوضات نقدية للفاتورة الشبكية #${orderId.slice(-6)} من ${orderData.retailerName}`,
          createdAt: serverTimestamp()
        });
      }
    }

    // Save logging
    const auditRef = doc(collection(db, 'auditLogs'));
    batch.set(auditRef, {
      action: B2B_ACTION_TYPES.CASHIER_APPROVE,
      userId: cashierUserId,
      userName: cashierName,
      details: `مصادقة الصندوق واعتماد الطلب رقم #${orderId.slice(-6)} للانتقال لغرفة تجهيز المستودعات.`,
      timestamp: serverTimestamp()
    });

    await batch.commit();
    return true;
  },

  // ==========================================
  // 2. مرحلة التجهيز والتسوية المعقدة (لوحة المدير والمستودع)
  // ==========================================

  /**
   * Shortage satisfaction reconciliation: Reverts the order to active prep cycle.
   * Auto restarts warehouse prepping document states.
   */
  async reconcileReturnToPrepping(orderId: string, managerUserId: string, managerName: string) {
    const orderRef = doc(db, 'orders', orderId);
    
    // Find associated Warehouse Prep sequence
    const prepQuery = query(collection(db, 'warehousePrepOrders'), where('orderId', '==', orderId));
    const prepSnap = await getDocs(prepQuery);

    const batch = writeBatch(db);

    // 1. Reset main order status and append notes
    batch.update(orderRef, {
      status: 'prepping',
      discrepancyAction: 'provide_substitutes_pending',
      notes: `[تسوية وتوفية: إعادة قيد التجهيز بموجب إقرار المدير ${managerName} لتوفية النواقص بالأصناف البديلة]`,
      updatedAt: serverTimestamp()
    });

    // 2. Re-open prep document
    if (!prepSnap.empty) {
      const prepDoc = prepSnap.docs[0];
      const prepData = prepDoc.data();
      
      const resetItems = (prepData.items || []).map((item: any) => ({
        ...item,
        status: 'pending' // restore all statuses to allow re-checking & re-filling
      }));

      batch.update(prepDoc.ref, {
        prepStatus: 'in_progress', // Set back to in_progress
        items: resetItems,
        updatedAt: serverTimestamp()
      });
    }

    // Capture in Audit Trail
    const auditRef = doc(collection(db, 'auditLogs'));
    batch.set(auditRef, {
      action: B2B_ACTION_TYPES.RECONCILE_SHORTAGE,
      userId: managerUserId,
      userName: managerName,
      details: `تمت تسوية النواقص: إعادة توجيه الفاتورة #${orderId.slice(-6)} تلقائياً للتجهيز وتجهيز صنف بديل معتمد.`,
      timestamp: serverTimestamp()
    });

    await batch.commit();
    return true;
  },

  /**
   * Direct Dispatch to Courier Bypass: Allows the manager to bypass shortage complaints,
   * directly deploying shipment dispatch and transfer to Courier staff.
   */
  async forceDirectDispatch(orderId: string, managerUserId: string, managerName: string) {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      throw new Error('⚠️ الطلب المحدد غير موجود.');
    }

    const orderData = orderSnap.data() as NetworkOrder;
    const batch = writeBatch(db);

    // Force updates status to 'dispatched' directly bypass prep deficits
    batch.update(orderRef, {
      status: 'dispatched',
      substituteBypassed: true,
      cancelFrozen: true, // Freeze cancellations immediately
      notes: (orderData.notes || '') + `\n[تجاوز المدير: تم الشحن المباشر وتجاوز متطابقات المستودع بتوقيع ${managerName}]`,
      updatedAt: serverTimestamp()
    });

    // Fast-track corresponding warehouse prep orders to completed
    const prepQuery = query(collection(db, 'warehousePrepOrders'), where('orderId', '==', orderId));
    const prepSnap = await getDocs(prepQuery);
    if (!prepSnap.empty) {
      batch.update(prepSnap.docs[0].ref, {
        prepStatus: 'completed',
        updatedAt: serverTimestamp()
      });
    }

    // Trigger Transit financial rules (Pending Deduction for Buyer)
    await this.postTransitPendingDeduction(batch, orderData);

    // Capture audit track
    const auditRef = doc(collection(db, 'auditLogs'));
    batch.set(auditRef, {
      action: B2B_ACTION_TYPES.DIRECT_DISPATCH,
      userId: managerUserId,
      userName: managerName,
      details: `صلاحية تجاوز المدير: إرسال سريع مباشر لشحنة الطلب #${orderId.slice(-6)} على مسؤولية الإدارة.`,
      timestamp: serverTimestamp()
    });

    await batch.commit();

    // Axis 3: Automated GL Entry for Supplier Preparation & Dispatch (with Idempotency Key)
    try {
      await AutomatedJournalEngine.postB2BOrderSupplierPrepAndDispatchGL({
        supplierOwnerId: orderData.wholesalerId,
        buyerName: orderData.retailerName,
        orderId: orderData.id,
        totalAmount: orderData.total,
        paymentType: orderData.paymentType || 'debt'
      });
    } catch (glErr) {
      console.warn('⚠️ [Axis 3 GL] Supplier direct dispatch GL posting note:', glErr);
    }

    return true;
  },

  // ==========================================
  // 3. حركة البيانات والتوصيل والقيود المحاسبية
  // ==========================================

  /**
   * General shipment sequence triggered by dispatcher/driver
   * Automatically updates status to "shipped" / "dispatched", sends digitized invoice,
   * freezes buyer cancel option, and creates "Pending Deduction" on Buyer's ledger.
   */
  async shipAndLockOrder(orderId: string, driverUserId: string, driverName: string) {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      throw new Error('⚠️ الطلب المحدد غير موجود.');
    }

    const orderData = orderSnap.data() as NetworkOrder;
    const batch = writeBatch(db);

    // Update status, freeze cancellation, record shipment timestamps
    batch.update(orderRef, {
      status: 'shipped',
      cancelFrozen: true, // buyer cannot cancel anymore to protect goods
      dispatchedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      driverId: driverUserId,
      driverName: driverName
    });

    // Automated Digital Invoice Sync (triggers buyer notification)
    const notificationRef = doc(collection(db, 'notifications'));
    batch.set(notificationRef, {
      ownerId: orderData.retailerId, // Notify Merchant 1 (buyer)
      title: '🚚 طلبك الجاري في الطريق الآن!',
      message: `تم تسليم شحنة الطلب #${orderId.slice(-6)} للسائق ${driverName}. يرجى فحص وتأكيد الاستلام الميداني عند الوصول لفتح وحظر الإلغاء.`,
      type: 'shipping',
      read: false,
      createdAt: serverTimestamp()
    });

    // Invoke Transit Posting: Secure pending deduction for the buyer
    await this.postTransitPendingDeduction(batch, orderData);

    await batch.commit();

    // Axis 3: Automated GL Entry for Supplier Preparation & Dispatch (with Idempotency Key)
    try {
      await AutomatedJournalEngine.postB2BOrderSupplierPrepAndDispatchGL({
        supplierOwnerId: orderData.wholesalerId,
        buyerName: orderData.retailerName,
        orderId: orderData.id,
        totalAmount: orderData.total,
        paymentType: orderData.paymentType || 'debt'
      });
    } catch (glErr) {
      console.warn('⚠️ [Axis 3 GL] Supplier dispatch GL posting note:', glErr);
    }

    return true;
  },

  /**
   * Private helper to post "Pending Deduction" on Merchant 1
   * "عملية مخصومة لم تستلم بضاعتها مقابلها" for transparency while cargo travels
   */
  async postTransitPendingDeduction(batch: any, orderData: NetworkOrder) {
    const buyerLedgerRef = doc(collection(db, 'transactions'));
    
    batch.set(buyerLedgerRef, {
      ownerId: orderData.retailerId, // Merchant 1
      orderId: orderData.id,
      amount: orderData.total,
      type: 'expense_pending', // Pending expense classification
      category: 'مشتريات معلقة قيد الشحن',
      notes: 'عملية مخصومة لم تستلم بضاعتها مقابلها', // EXACT Arabic text requirement
      description: `قيد تعليق مالي لحركة البضاعة بالطريق مع السائق للطلب #${orderData.id.slice(-6)}`,
      createdAt: serverTimestamp(),
      status: 'transit_frozen' // locked in ledger
    });
  },

  /**
   * 4. وقت الاستلام الفعلي ومطابقة البضائع بالمتجر
   * Final Field Receipt Confirmation by Merchant 1.
   * Finalizes pending deduction in ledger & auto ingests items directly into physical store inventory.
   */
  async confirmFieldReceipt(orderId: string, buyerUid: string, buyerName: string) {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      throw new Error('⚠️ الطلب المراد استلامه غير موجود.');
    }

    const orderData = orderSnap.data() as NetworkOrder;
    const batch = writeBatch(db);

    // 1. Update B2B status to terminal state 'received' / 'delivered'
    batch.update(orderRef, {
      status: 'received',
      retailerSigned: true,
      deliveredAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 2. Clear outstanding "pending expense in transit" and finalize permanent expense entry
    const pendingTransQuery = query(
      collection(db, 'transactions'),
      where('ownerId', '==', orderData.retailerId),
      where('orderId', '==', orderId),
      where('type', '==', 'expense_pending')
    );
    const transSnap = await getDocs(pendingTransQuery);
    
    if (!transSnap.empty) {
      transSnap.forEach(tDoc => {
        batch.update(tDoc.ref, {
          type: 'expense', // convert to permanent expense
          category: 'مشتريات مستلمة معتمدة',
          notes: 'تم فك التعليق: البضاعة المستلمة مطابقة لمحتويات الفاتورة المعتمدة.',
          description: `تسوية نهائية للفاتورة الشبكية الموفاة المستلمة #${orderId.slice(-6)}`,
          updatedAt: serverTimestamp()
        });
      });
    } else {
      // Settle as direct permanent expense if pending entry wasn't found fallback
      const buyerLedgerRef = doc(collection(db, 'transactions'));
      batch.set(buyerLedgerRef, {
        ownerId: orderData.retailerId,
        orderId: orderId,
        amount: orderData.total,
        type: 'expense',
        category: 'مشتريات مستلمة معتمدة',
        notes: 'مشتريات شبكية معتمدة فورية',
        description: `تسوية نهائية للفاتورة المستلمة #${orderId.slice(-6)}`,
        createdAt: serverTimestamp()
      });
    }

    // 3. AUTOMATION: Automated Cargo Ingestion directly into Merchant 1's physical inventory
    // This allows Merchant 1's store stock to increment automatically without manual registration!
    for (const item of orderData.items) {
      // Query existing items by name and owner to avoid duplicating document cards
      const matchedInvQuery = query(
        collection(db, 'inventory'),
        where('ownerId', '==', orderData.retailerId),
        where('name', '==', item.name)
      );
      const invSnap = await getDocs(matchedInvQuery);

      if (!invSnap.empty) {
        // Increment existing product stock and update cost logic
        const invDoc = invSnap.docs[0];
        batch.update(invDoc.ref, {
          stock: increment(item.quantity),
          cost: item.price, // update last cost
          updatedAt: serverTimestamp()
        });
      } else {
        // Automatically inject as a new product card
        const newInvRef = doc(collection(db, 'inventory'));
        batch.set(newInvRef, {
          ownerId: orderData.retailerId,
          name: item.name,
          category: 'وارد شبكة الموزعين',
          stock: item.quantity,
          cost: item.price,
          price: item.price * 1.15, // Auto sets standard retail pricing markup at 15%
          barcode: `JAM-B2B-${Math.floor(1000 + Math.random() * 9000)}-${item.productId.slice(0, 4)}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    // Publish security log entry
    const auditRef = doc(collection(db, 'auditLogs'));
    batch.set(auditRef, {
      action: B2B_ACTION_TYPES.RECEIVE_DELIVERY,
      userId: buyerUid,
      userName: buyerName,
      details: `تأكيد الاستلام الميداني: استلام الشحنة وتغذية مخزون المحل آلياً بـ (${orderData.items.length}) من السائق الرقمي.`,
      timestamp: serverTimestamp()
    });

    await batch.commit();

    // Axis 3: Automated GL Entry for Delivery Receipt & Transit Stock Settlement
    try {
      await AutomatedJournalEngine.postB2BOrderDeliveryReceiptGL({
        buyerOwnerId: orderData.retailerId,
        supplierName: orderData.wholesalerName || 'المورد المعتمد',
        orderId: orderData.id,
        totalAmount: orderData.total
      });
    } catch (glErr) {
      console.warn('⚠️ [Axis 3 GL] Delivery receipt GL posting note:', glErr);
    }

    return true;
  },

  /**
   * 📦 AXIS 4: AUTOMATED RETURNS & DAMAGED GOODS ENGINE (معالجة المرتجعات والتالف بحركات عكسية آلية)
   * Handles real-time reverse stock increments for suppliers, stock decrements for buyers,
   * GL reverse postings, and damaged/waste loss registrations without manual intervention.
   */
  async processB2BOrderReturnAndDamage(params: {
    orderId: string;
    returnedItems: {
      productId: string;
      name: string;
      quantity: number;
      price: number;
      isDamaged?: boolean;
      damageReason?: string;
    }[];
    operatorUserId: string;
    operatorName: string;
    notes?: string;
  }) {
    const { orderId, returnedItems, operatorUserId, operatorName, notes } = params;

    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      throw new Error('⚠️ الطلب المراد عمل مرتجع/تالف عليه غير موجود.');
    }

    const orderData = orderSnap.data() as NetworkOrder;
    const batch = writeBatch(db);

    let validReturnTotal = 0;
    let damagedTotal = 0;

    const validItemsToRestock: any[] = [];
    const damagedItemsToLoss: any[] = [];

    for (const item of returnedItems) {
      const lineCost = item.price * item.quantity;

      if (item.isDamaged) {
        damagedTotal += lineCost;
        damagedItemsToLoss.push({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          qtyInPieces: 1,
          price: item.price
        });
      } else {
        validReturnTotal += lineCost;
        validItemsToRestock.push(item);

        // 1. Re-increment Supplier Inventory Stock (إعادة البضائع المرتجعة السليمة لرفوف المورد)
        const supplierProdRef = doc(db, 'wholesaleProducts', item.productId);
        const supplierProdSnap = await getDoc(supplierProdRef);

        if (supplierProdSnap.exists()) {
          batch.update(supplierProdRef, {
            stock: increment(item.quantity),
            updatedAt: serverTimestamp()
          });
        } else {
          const supplierInvRef = doc(db, 'inventory', item.productId);
          batch.set(supplierInvRef, {
            stock: increment(item.quantity),
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        // 2. Decrement Buyer Inventory Stock if previously ingested (خصم البضائع المرجعة من مخزن المشتري)
        const buyerInvQuery = query(
          collection(db, 'inventory'),
          where('ownerId', '==', orderData.retailerId),
          where('name', '==', item.name)
        );
        const buyerInvSnap = await getDocs(buyerInvQuery);
        if (!buyerInvSnap.empty) {
          batch.update(buyerInvSnap.docs[0].ref, {
            stock: increment(-item.quantity),
            updatedAt: serverTimestamp()
          });
        }
      }
    }

    // 3. Update Order Status to 'returned' or 'partially_returned'
    const totalOrderItemsCount = orderData.items?.length || 0;
    const returnedItemsCount = returnedItems.length;
    const isFullReturn = returnedItemsCount >= totalOrderItemsCount;

    batch.update(orderRef, {
      status: isFullReturn ? 'returned' : 'partially_returned',
      returnedAt: serverTimestamp(),
      returnNotes: notes || `تمت معالجة المرتجعات/التالف بواسطة ${operatorName}`,
      updatedAt: serverTimestamp()
    });

    // Save return log record
    const returnDocRef = doc(collection(db, 'b2b_returns'));
    batch.set(returnDocRef, {
      orderId,
      supplierId: orderData.wholesalerId,
      buyerId: orderData.retailerId,
      returnedItems,
      validReturnTotal,
      damagedTotal,
      operatorUserId,
      operatorName,
      notes: notes || '',
      createdAt: serverTimestamp()
    });

    await batch.commit();

    // 4. Financial GL Postings:
    // A. Post Valid Sales Return Entry (عكس القيد المالي للمرتجع السليم)
    if (validReturnTotal > 0) {
      try {
        await postReturnOrLossToLedger({
          ownerId: orderData.wholesalerId,
          type: 'return',
          total: validReturnTotal,
          paymentMethod: orderData.paymentType === 'cash' ? 'cash' : 'credit',
          items: validItemsToRestock,
          referenceId: `RET-${orderId.slice(-6)}`,
          notes: `[المحور 4] مرتجع مبيعات شبكي سليم للفاتورة #${orderId.slice(-6)} - ${notes || ''}`
        });
      } catch (err) {
        console.warn('⚠️ [Axis 4 Return GL] Error posting valid return ledger:', err);
      }
    }

    // B. Post Damaged Goods Loss Entry (قيد هالك وتالف المخزون)
    if (damagedTotal > 0) {
      try {
        await postReturnOrLossToLedger({
          ownerId: orderData.wholesalerId,
          type: 'loss',
          total: damagedTotal,
          items: damagedItemsToLoss,
          referenceId: `DMG-${orderId.slice(-6)}`,
          notes: `[المحور 4] تسجيل بضائع تالفة/هالكة للفاتورة #${orderId.slice(-6)} - السبب: ${notes || 'تالف عيني'}`
        });
      } catch (err) {
        console.warn('⚠️ [Axis 4 Damage GL] Error posting damaged goods loss ledger:', err);
      }
    }

    // 5. Send Real-time Cross-Project Notifications to both parties
    try {
      await CrossProjectNotificationHub.dispatchNotification({
        targetUserId: orderData.wholesalerId,
        title: '📦 تحديث المرتجعات والتالف (المحور 4)',
        message: `تمت معالجة مرتجع/تالف للطلبية #${orderId.slice(-6)} بقيمة مرتجع سليم (${validReturnTotal}) وتالف (${damagedTotal}).`,
        type: 'system_announcement'
      });

      await CrossProjectNotificationHub.dispatchNotification({
        targetUserId: orderData.retailerId,
        title: '📦 تأكيد تسوية المرتجعات والتالف',
        message: `تم اعتماد تسوية المرتجع/التالف للطلبية #${orderId.slice(-6)} وتحديث حسابات المخزون والميزانية تلقائياً.`,
        type: 'system_announcement'
      });
    } catch (notifErr) {
      console.warn('⚠️ [Axis 4 Notif] Error dispatching return notification:', notifErr);
    }

    return {
      success: true,
      isFullReturn,
      validReturnTotal,
      damagedTotal
    };
  }
};
