import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { isAllowedTierGap, getHierarchyLevel, TIER_NAMES_AR } from '../utils/b2bTierHierarchy';
import { networkGuardService } from './networkGuardService';
import { B2BConnectionRequest, B2BPriceTier } from '../types';

export interface ShopConnectionDoc {
  id: string; // targetShopId
  shopId: string;
  targetShopId: string;
  targetShopName?: string;
  targetShopPhone?: string;
  targetShopOwnerId?: string;
  status: 'active' | 'expired' | 'pending' | 'suspended' | 'blocked';
  expiryTimestamp: any; // Firestore Timestamp, Date, or string
  paymentTerms: 'cash' | 'net15' | 'net30' | 'credit' | 'open' | string;
  customPriceTier: 'tier1' | 'tier2' | 'tier3' | 'vip' | 'wholesale' | 'retail' | 'half_wholesale' | string;
  customDiscountPercent?: number;
  creditLimit: number;
  currentDebt?: number;
  connectionKey?: string;
  createdAt: any;
  updatedAt: any;
}

export interface B2BConnectionDoc {
  id: string; // `${retailerId}_${wholesalerId}`
  retailerId: string;
  retailerName: string;
  retailerPhone?: string;
  wholesalerId: string;
  wholesalerName: string;
  wholesalerPhone?: string;
  // Unified query aliases for backward/forward cross-compatibility
  buyerId?: string;
  buyerName?: string;
  supplierId?: string;
  supplierName?: string;
  supplierKey: string;
  status: 'active' | 'expired' | 'pending' | 'suspended' | 'blocked';
  expiryTimestamp?: any;
  paymentTerms?: string;
  customPriceTier?: string;
  creditLimit: number; // Maximum debt limit in YER
  currentDebt?: number; // Outstanding balance
  customDiscountPercent?: number; // Tier-based percentage discount (0 - 100%)
  createdAt: any;
  updatedAt: any;
}

export interface CreditVerificationResult {
  allowed: boolean;
  creditLimit: number;
  currentDebt: number;
  pendingOrdersDebt: number;
  totalDebt: number;
  availableCredit: number;
  status: 'active' | 'pending' | 'suspended' | 'blocked' | 'not_connected';
  message: string;
}

class B2BLinkageEngineService {
  /**
   * Send Commercial Linkage Request from Buyer to Supplier (الطلب المباشر دون تعقيد)
   */
  public async sendConnectionRequest(params: {
    senderProfile: any;
    receiverSupplier: {
      id: string;
      shopName?: string;
      phone?: string;
      name?: string;
    };
    notes?: string;
    connectionMethod?: 'in_app_request' | 'qr_code' | 'invitation_key';
  }): Promise<{ success: boolean; requestId?: string; message: string }> {
    const { senderProfile, receiverSupplier, notes = '', connectionMethod = 'in_app_request' } = params;

    const netCheck = networkGuardService.requireOnline('market_link');
    if (!netCheck.allowed) {
      return { success: false, message: netCheck.message || 'الارتباط بالسوق يتطلب اتصالاً بالإنترنت.' };
    }

    const senderId = senderProfile?.ownerId || senderProfile?.uid;
    const receiverId = receiverSupplier?.id;

    if (!senderId || !receiverId) {
      return { success: false, message: '⚠️ بيانات التاجر أو المورد غير مكتملة.' };
    }

    if (senderId === receiverId) {
      return { success: false, message: '⚠️ لا يمكنك إرسال طلب ارتباط لمتجرك الخاص.' };
    }

    try {
      // 1. Check if already actively connected
      const existingConnCheck = await this.isConnectionActive(senderId, receiverId);
      if (existingConnCheck.active) {
        return { success: false, message: '✅ لديك ارتباط تجاري نشط بالفعل مع هذا المورد.' };
      }

      // 2. Check if a pending request already exists between them
      const requestsRef = collection(db, 'b2b_connection_requests');
      const qExisting = query(
        requestsRef,
        where('senderId', '==', senderId),
        where('receiverId', '==', receiverId),
        where('status', '==', 'pending')
      );
      const existingDocs = await getDocs(qExisting);
      if (!existingDocs.empty) {
        return { success: false, message: '⏳ يوجد طلب ارتباط قيد المراجعة مرسل مسبقاً لهذا المورد.' };
      }

      // 3. Create connection request document
      const reqDocRef = doc(requestsRef);
      const newRequest: B2BConnectionRequest = {
        id: reqDocRef.id,
        senderId,
        senderShopName: senderProfile.shopName || senderProfile.name || 'تاجر تجزئة',
        senderOwnerName: senderProfile.name || '',
        senderPhone: senderProfile.phone || senderProfile.shopPhone || '',
        senderLocation: senderProfile.salesLocation || senderProfile.city || senderProfile.location || '',
        senderBusinessType: senderProfile.businessType || 'عام',
        senderRole: senderProfile.role || senderProfile.networkRole || 'retailer',
        receiverId,
        receiverShopName: receiverSupplier.shopName || receiverSupplier.name || 'المورد',
        receiverPhone: receiverSupplier.phone || '',
        status: 'pending',
        notes,
        connectionMethod,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(reqDocRef, newRequest);

      return {
        success: true,
        requestId: reqDocRef.id,
        message: '✅ تم إرسال طلب الارتباط التجاري بنجاح! سيصل إشعار فوري للمورد في لوحة تحكمه.'
      };
    } catch (error: any) {
      console.error('Error in sendConnectionRequest:', error);
      return { success: false, message: `⚠️ تعذر إرسال طلب الارتباط: ${error.message}` };
    }
  }

  /**
   * Supplier Responds to Connection Request (قبول مع تحديد الفئة وسقف الائتمان / أو رفض)
   */
  public async respondToConnectionRequest(params: {
    requestId: string;
    action: 'accept' | 'reject';
    supplierProfile: any;
    assignedPriceTier?: B2BPriceTier; // 'imported' | 'wholesale_wholesale' | 'wholesale' | 'retail'
    creditLimit?: number; // سقف الائتمان بالريال
    paymentTerms?: string; // 'cash' | 'net7' | 'net15' | 'net30' | 'credit'
    allowedOrderTypes?: ('cash' | 'credit' | 'deposit' | 'jampay')[]; // نقد، آجل، إيداع، jam pay
    supplierNotes?: string; // الملاحظات التجارية والشروط من المورد
    rejectionReason?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { 
      requestId, 
      action, 
      supplierProfile, 
      assignedPriceTier = 'wholesale', 
      creditLimit = 500000, 
      paymentTerms = 'net30',
      allowedOrderTypes = ['cash'],
      supplierNotes = '',
      rejectionReason = ''
    } = params;

    const netCheck = networkGuardService.requireOnline('market_link');
    if (!netCheck.allowed) {
      return { success: false, message: netCheck.message || 'العملية تتطلب اتصالاً بالإنترنت.' };
    }

    try {
      const reqRef = doc(db, 'b2b_connection_requests', requestId);
      const reqSnap = await getDoc(reqRef);

      if (!reqSnap.exists()) {
        return { success: false, message: '⚠️ لم يتم العثور على طلب الارتباط المحدد.' };
      }

      const reqData = reqSnap.data() as B2BConnectionRequest;
      const supplierId = supplierProfile.ownerId || supplierProfile.uid;

      if (reqData.receiverId !== supplierId) {
        return { success: false, message: '⛔ غير مصرح لك باتخاذ إجراء على هذا الطلب.' };
      }

      if (action === 'reject') {
        await updateDoc(reqRef, {
          status: 'rejected',
          rejectionReason: rejectionReason || 'تم رفض الطلب من قبل المورد',
          respondedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        return {
          success: true,
          message: 'تم رفض طلب الارتباط بنجاح.'
        };
      }

      // Action: Accept
      const defaultExpiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const expiryTimestamp = Timestamp.fromDate(defaultExpiryDate);

      // 1. Update request status to accepted
      await updateDoc(reqRef, {
        status: 'accepted',
        assignedPriceTier,
        creditLimit: Number(creditLimit) || 0,
        paymentTerms,
        allowedOrderTypes,
        supplierNotes,
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Create mutual B2B Connection in b2bConnections
      const connId = `${reqData.senderId}_${supplierId}`;
      const connRef = doc(db, 'b2bConnections', connId);
      const connPayload: B2BConnectionDoc = {
        id: connId,
        retailerId: reqData.senderId,
        retailerName: reqData.senderShopName,
        retailerPhone: reqData.senderPhone || '',
        wholesalerId: supplierId,
        wholesalerName: supplierProfile.shopName || supplierProfile.name || 'مورد جملة',
        wholesalerPhone: supplierProfile.phone || '',
        buyerId: reqData.senderId,
        buyerName: reqData.senderShopName,
        supplierId: supplierId,
        supplierName: supplierProfile.shopName || supplierProfile.name || 'مورد جملة',
        supplierKey: reqData.connectionMethod || 'direct_request',
        status: 'active',
        expiryTimestamp,
        paymentTerms,
        customPriceTier: assignedPriceTier,
        creditLimit: Number(creditLimit) || 0,
        allowedPayments: allowedOrderTypes,
        allowedOrderTypes,
        supplierNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(connRef, connPayload, { merge: true });

      // 3. Buyer's connection doc under shops/{buyerId}/connections/{supplierId}
      const buyerConnRef = doc(db, 'shops', reqData.senderId, 'connections', supplierId);
      const buyerConnDoc: ShopConnectionDoc = {
        id: supplierId,
        shopId: reqData.senderId,
        targetShopId: supplierId,
        targetShopName: supplierProfile.shopName || supplierProfile.name || 'مورد جملة',
        targetShopPhone: supplierProfile.phone || '',
        targetShopOwnerId: supplierId,
        status: 'active',
        expiryTimestamp,
        paymentTerms,
        customPriceTier: assignedPriceTier,
        creditLimit: Number(creditLimit) || 0,
        allowedPayments: allowedOrderTypes,
        allowedOrderTypes,
        supplierNotes,
        connectionKey: reqData.connectionMethod || 'direct_request',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(buyerConnRef, buyerConnDoc, { merge: true });

      // 4. Supplier's connection doc under shops/{supplierId}/connections/{buyerId}
      const supplierConnRef = doc(db, 'shops', supplierId, 'connections', reqData.senderId);
      const supplierConnDoc: ShopConnectionDoc = {
        id: reqData.senderId,
        shopId: supplierId,
        targetShopId: reqData.senderId,
        targetShopName: reqData.senderShopName,
        targetShopPhone: reqData.senderPhone || '',
        targetShopOwnerId: reqData.senderId,
        status: 'active',
        expiryTimestamp,
        paymentTerms,
        customPriceTier: assignedPriceTier,
        creditLimit: Number(creditLimit) || 0,
        connectionKey: reqData.connectionMethod || 'direct_request',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(supplierConnRef, supplierConnDoc, { merge: true });

      // Cache locally
      try {
        localStorage.setItem(`b2b_conn_${reqData.senderId}_${supplierId}`, JSON.stringify(buyerConnDoc));
        localStorage.setItem(`b2b_conn_${supplierId}_${reqData.senderId}`, JSON.stringify(supplierConnDoc));
      } catch (e) {
        // Safe fallback
      }

      return {
        success: true,
        message: `✅ تم قبول طلب الارتباط بنجاح! تم اعتماد التاجر [ ${reqData.senderShopName} ] بفئة [ ${assignedPriceTier} ].`
      };
    } catch (error: any) {
      console.error('Error in respondToConnectionRequest:', error);
      return { success: false, message: `⚠️ حدث خطأ أثناء معالجة الطلب: ${error.message}` };
    }
  }

  /**
   * Subscribe to Incoming Pending Connection Requests for Supplier Sidebar notifications
   */
  public subscribeToPendingRequests(
    supplierId: string, 
    callback: (requests: B2BConnectionRequest[]) => void
  ): () => void {
    if (!supplierId) return () => {};

    try {
      const q = query(
        collection(db, 'b2b_connection_requests'),
        where('receiverId', '==', supplierId),
        where('status', '==', 'pending')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: B2BConnectionRequest[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as B2BConnectionRequest);
        });
        callback(list);
      }, (err) => {
        console.warn('Subscription error on pending connection requests:', err);
      });

      return unsubscribe;
    } catch (err) {
      console.warn('Failed to subscribe to pending requests:', err);
      return () => {};
    }
  }

  /**
   * Alias for subscribeToPendingRequests - Real-time listener for incoming pending B2B connection requests
   */
  public listenPendingRequests(
    supplierId: string, 
    callback: (requests: B2BConnectionRequest[]) => void
  ): () => void {
    return this.subscribeToPendingRequests(supplierId, callback);
  }

  /**
   * Validate Linkage Key and Create/Request Mutual B2B Connection
   */
  public async requestLinkageWithKey(params: {
    buyerProfile: any;
    typedKey: string;
  }): Promise<{ success: boolean; connection?: B2BConnectionDoc; message: string }> {
    const { buyerProfile, typedKey } = params;

    const netCheck = networkGuardService.requireOnline('market_link');
    if (!netCheck.allowed) {
      return { success: false, message: netCheck.message || 'الارتباط بالسوق يتطلب اتصالاً بالإنترنت.' };
    }

    if (!buyerProfile?.ownerId) {
      return { success: false, message: '⚠️ لم يتم التعرف على حساب المشتري.' };
    }

    const cleanKey = typedKey.trim().toUpperCase();
    if (!cleanKey || cleanKey.length < 3) {
      return { success: false, message: '⚠️ يرجى إدخال كود ربط صحيح مكون من 3 أحرف/أرقام على الأقل.' };
    }

    try {
      // 1. Search for matching supplier by b2bKey, supplierKey, phone, or ownerId
      const usersRef = collection(db, 'users');
      let supplierDoc: any = null;

      // Query by b2bKey
      const qKey = query(usersRef, where('b2bKey', '==', cleanKey));
      let snap = await getDocs(qKey);

      if (snap.empty) {
        // Query by supplierKey
        const qSupplierKey = query(usersRef, where('supplierKey', '==', cleanKey));
        snap = await getDocs(qSupplierKey);
      }

      if (snap.empty) {
        // Query by phone or ID directly
        const qPhone = query(usersRef, where('phone', '==', cleanKey));
        snap = await getDocs(qPhone);
      }

      if (snap.empty) {
        // Check direct document ID lookup
        const directDoc = await getDoc(doc(db, 'users', cleanKey));
        if (directDoc.exists()) {
          supplierDoc = { id: directDoc.id, ...directDoc.data() };
        }
      } else {
        supplierDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
      }

      if (!supplierDoc) {
        return {
          success: false,
          message: `❌ لم يتم العثور على أي مورد مسجل بكود الربط: [ ${cleanKey} ]. يرجى التأكد من المورد.`
        };
      }

      // Self connection guard
      if (supplierDoc.id === buyerProfile.ownerId || supplierDoc.ownerId === buyerProfile.ownerId) {
        return { success: false, message: '⚠️ لا يمكنك إنشاء طلب ارتباط بمتجرك الخاص.' };
      }

      // 2. Axis 1 Tier Gap Rule Enforcement (قانون الفجوة الواحدة)
      const buyerRole = buyerProfile.hierarchyLevel || buyerProfile.role || 'retailer';
      const supplierRole = supplierDoc.hierarchyLevel || supplierDoc.role || supplierDoc.networkRole || 'wholesaler';

      if (!isAllowedTierGap(buyerRole, supplierRole)) {
        const buyerLevelNum = getHierarchyLevel(buyerRole);
        const supplierLevelNum = getHierarchyLevel(supplierRole);
        const buyerTierName = TIER_NAMES_AR[buyerLevelNum] || 'تاجر تجزئة';
        const supplierTierName = TIER_NAMES_AR[supplierLevelNum] || 'تاجر جملة الجملة';

        return {
          success: false,
          message: `⛔ غير مسموح بالارتباط: أنت مسجل كـ (${buyerTierName}) والمورد [ ${supplierDoc.shopName || supplierDoc.name} ] مسجل كـ (${supplierTierName}). يتوجب عليك الارتباط حصرياً بالرتبة المباشرة القادمة طبقاً لقواعد هيكلية السوق B2B.`
        };
      }

      // 3. Create or Update Connection document
      const connId = `${buyerProfile.ownerId}_${supplierDoc.id}`;
      const connRef = doc(db, 'b2bConnections', connId);
      const existingSnap = await getDoc(connRef);

      const defaultExpiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Default 1 year validity
      const expiryTimestamp = Timestamp.fromDate(defaultExpiryDate);

      const connPayload: B2BConnectionDoc = {
        id: connId,
        retailerId: buyerProfile.ownerId,
        retailerName: buyerProfile.shopName || buyerProfile.name || 'مشتري تجزئة',
        retailerPhone: buyerProfile.phone || '',
        wholesalerId: supplierDoc.id,
        wholesalerName: supplierDoc.shopName || supplierDoc.name || 'مورد جملة',
        wholesalerPhone: supplierDoc.phone || '',
        buyerId: buyerProfile.ownerId,
        buyerName: buyerProfile.shopName || buyerProfile.name || 'مشتري تجزئة',
        supplierId: supplierDoc.id,
        supplierName: supplierDoc.shopName || supplierDoc.name || 'مورد جملة',
        supplierKey: cleanKey,
        status: 'active', // Approved upon valid linkage key match
        expiryTimestamp,
        paymentTerms: 'net30',
        customPriceTier: 'wholesale',
        creditLimit: existingSnap.exists() ? Number(existingSnap.data().creditLimit || 500000) : 500000,
        customDiscountPercent: existingSnap.exists() ? Number(existingSnap.data().customDiscountPercent || 0) : 0,
        createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(connRef, connPayload, { merge: true });

      // Save to shops/{shopId}/connections/{targetShopId} for Buyer
      const buyerConnRef = doc(db, 'shops', buyerProfile.ownerId, 'connections', supplierDoc.id);
      const buyerConnDoc: ShopConnectionDoc = {
        id: supplierDoc.id,
        shopId: buyerProfile.ownerId,
        targetShopId: supplierDoc.id,
        targetShopName: supplierDoc.shopName || supplierDoc.name || 'مورد جملة',
        targetShopPhone: supplierDoc.phone || '',
        targetShopOwnerId: supplierDoc.id,
        status: 'active',
        expiryTimestamp,
        paymentTerms: 'net30',
        customPriceTier: 'wholesale',
        customDiscountPercent: connPayload.customDiscountPercent,
        creditLimit: connPayload.creditLimit,
        connectionKey: cleanKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(buyerConnRef, buyerConnDoc, { merge: true });

      // Save to shops/{shopId}/connections/{targetShopId} for Supplier
      const supplierConnRef = doc(db, 'shops', supplierDoc.id, 'connections', buyerProfile.ownerId);
      const supplierConnDoc: ShopConnectionDoc = {
        id: buyerProfile.ownerId,
        shopId: supplierDoc.id,
        targetShopId: buyerProfile.ownerId,
        targetShopName: buyerProfile.shopName || buyerProfile.name || 'مشتري تجزئة',
        targetShopPhone: buyerProfile.phone || '',
        targetShopOwnerId: buyerProfile.ownerId,
        status: 'active',
        expiryTimestamp,
        paymentTerms: 'net30',
        customPriceTier: 'wholesale',
        customDiscountPercent: connPayload.customDiscountPercent,
        creditLimit: connPayload.creditLimit,
        connectionKey: cleanKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(supplierConnRef, supplierConnDoc, { merge: true });

      // Cache locally for offline availability
      try {
        localStorage.setItem(`b2b_conn_${buyerProfile.ownerId}_${supplierDoc.id}`, JSON.stringify(buyerConnDoc));
        localStorage.setItem(`b2b_conn_${supplierDoc.id}_${buyerProfile.ownerId}`, JSON.stringify(supplierConnDoc));
      } catch (e) {
        // Safe fallback for private browsing / quota
      }

      return {
        success: true,
        connection: connPayload,
        message: `✅ تم الاعتماد والمصادقة المتبادلة بنجاح مع المورد [ ${connPayload.wholesalerName} ]!`
      };
    } catch (error: any) {
      console.error('Error in requestLinkageWithKey:', error);
      return { success: false, message: `⚠️ حدث خطأ أثناء تنفيذ عملية الربط: ${error.message}` };
    }
  }

  /**
   * Comprehensive Order Credit Limit & Connection Status Verifier
   */
  public async verifyOrderCreditAndStatus(params: {
    buyerOwnerId: string;
    supplierOwnerId: string;
    paymentType: 'cash' | 'debt';
    orderAmount: number;
  }): Promise<CreditVerificationResult> {
    const { buyerOwnerId, supplierOwnerId, paymentType, orderAmount } = params;

    try {
      // 1. Fetch b2bConnection doc
      const connId = `${buyerOwnerId}_${supplierOwnerId}`;
      const connRef = doc(db, 'b2bConnections', connId);
      const connSnap = await getDoc(connRef);

      if (!connSnap.exists()) {
        return {
          allowed: false,
          creditLimit: 0,
          currentDebt: 0,
          pendingOrdersDebt: 0,
          totalDebt: 0,
          availableCredit: 0,
          status: 'not_connected',
          message: '⛔ لا يوجد ارتباط نشط مع هذا المورد. يرجى إدخال كود الربط أولاً.'
        };
      }

      const connData = connSnap.data() as B2BConnectionDoc;
      let connStatus = connData.status || 'active';

      // Verify expiration from connData or shops/{buyerOwnerId}/connections/{supplierOwnerId}
      const activeCheck = await this.isConnectionActive(buyerOwnerId, supplierOwnerId);
      if (!activeCheck.active) {
        return {
          allowed: false,
          creditLimit: Number(connData.creditLimit || 0),
          currentDebt: 0,
          pendingOrdersDebt: 0,
          totalDebt: 0,
          availableCredit: 0,
          status: (activeCheck.connection?.status as any) || 'expired',
          message: activeCheck.reason || '⛔ الارتباط التجاري مع هذا المورد غير نشط أو منتهي الصلاحية.'
        };
      }

      if (connStatus === 'blocked' || connStatus === 'suspended' || connStatus === 'expired') {
        return {
          allowed: false,
          creditLimit: Number(connData.creditLimit || 0),
          currentDebt: 0,
          pendingOrdersDebt: 0,
          totalDebt: 0,
          availableCredit: 0,
          status: connStatus,
          message: connStatus === 'blocked'
            ? '⛔ تم حظر التعامل مع هذا المورد بقرار إداري.'
            : (connStatus === 'expired' 
                ? '⛔ انتهت صلاحية الارتباط التجاري B2B. يرجى تجديد التعاقد مع المورد.'
                : '⏸️ تم إيقاف الحساب مؤقتاً لدى هذا المورد. يرجى مراجعة المورد للتنشيط.')
        };
      }

      // If payment is CASH, connection active is sufficient
      if (paymentType === 'cash') {
        return {
          allowed: true,
          creditLimit: Number(connData.creditLimit || 500000),
          currentDebt: 0,
          pendingOrdersDebt: 0,
          totalDebt: 0,
          availableCredit: Number(connData.creditLimit || 500000),
          status: 'active',
          message: '✅ طريقة الدفع نقداً (كاش) - المعاملة معتمدة.'
        };
      }

      // 2. Evaluate DEBT payment against strict Credit Limit
      const creditLimit = Number(connData.creditLimit || 0);

      // Fetch posted customer/account debt
      let currentDebt = 0;
      try {
        const custRef = doc(db, 'stores', supplierOwnerId, 'customers', buyerOwnerId);
        const custSnap = await getDoc(custRef);
        if (custSnap.exists()) {
          currentDebt = Number(custSnap.data().balance || custSnap.data().debt || 0);
        }
      } catch (err) {
        console.warn('Customer debt fetch warning:', err);
      }

      // Fetch pending debt orders not yet posted to account balance
      let pendingOrdersDebt = 0;
      try {
        const ordersRef = collection(db, 'orders');
        const qPending = query(
          ordersRef,
          where('retailerId', '==', buyerOwnerId),
          where('wholesalerId', '==', supplierOwnerId),
          where('paymentType', '==', 'debt'),
          where('status', 'in', ['pending', 'approved', 'prepping', 'ready'])
        );
        const pendingSnap = await getDocs(qPending);
        pendingOrdersDebt = pendingSnap.docs.reduce((acc, doc) => {
          const data = doc.data();
          return acc + Number(data.total || data.amount || 0);
        }, 0);
      } catch (err) {
        console.warn('Pending orders debt fetch warning:', err);
      }

      const totalDebt = currentDebt + pendingOrdersDebt;
      const projectedDebt = totalDebt + orderAmount;
      const availableCredit = Math.max(0, creditLimit - totalDebt);

      if (projectedDebt > creditLimit) {
        const excess = projectedDebt - creditLimit;
        return {
          allowed: false,
          creditLimit,
          currentDebt,
          pendingOrdersDebt,
          totalDebt,
          availableCredit,
          status: 'active',
          message: `⛔ الطلب بالآجل يتجاوز السقف الائتماني المعتمد بـ (${excess.toLocaleString()} ر.ي). السقف المتاح حالياً: (${availableCredit.toLocaleString()} ر.ي).`
        };
      }

      return {
        allowed: true,
        creditLimit,
        currentDebt,
        pendingOrdersDebt,
        totalDebt,
        availableCredit: availableCredit - orderAmount,
        status: 'active',
        message: '✅ طلب الشراء بالآجل متوافق تماماً مع السقف الائتماني المعتمد.'
      };
    } catch (error: any) {
      console.error('Error in verifyOrderCreditAndStatus:', error);
      return {
        allowed: false,
        creditLimit: 0,
        currentDebt: 0,
        pendingOrdersDebt: 0,
        totalDebt: 0,
        availableCredit: 0,
        status: 'blocked',
        message: `⚠️ فشلت عملية التحقق من الرصيد والربط: ${error.message}`
      };
    }
  }

  /**
   * Update Connection Settings (Credit Limit, Status, Special Discount) by Wholesaler
   */
  public async updateConnectionSettings(params: {
    retailerId: string;
    wholesalerId: string;
    creditLimit?: number;
    status?: 'active' | 'suspended' | 'blocked';
    customDiscountPercent?: number;
  }): Promise<{ success: boolean; message: string }> {
    const { retailerId, wholesalerId, creditLimit, status, customDiscountPercent } = params;
    const connId = `${retailerId}_${wholesalerId}`;
    const connRef = doc(db, 'b2bConnections', connId);

    try {
      const updates: any = { updatedAt: serverTimestamp() };
      if (typeof creditLimit === 'number') updates.creditLimit = Math.max(0, creditLimit);
      if (status) updates.status = status;
      if (typeof customDiscountPercent === 'number') updates.customDiscountPercent = Math.min(100, Math.max(0, customDiscountPercent));

      await updateDoc(connRef, updates);

      // Mirror update in shops/{wholesalerId}/connections/{retailerId}
      const shopConnRef1 = doc(db, 'shops', wholesalerId, 'connections', retailerId);
      await setDoc(shopConnRef1, updates, { merge: true }).catch(() => {});

      // Mirror update in shops/{retailerId}/connections/{wholesalerId}
      const shopConnRef2 = doc(db, 'shops', retailerId, 'connections', wholesalerId);
      await setDoc(shopConnRef2, updates, { merge: true }).catch(() => {});

      return {
        success: true,
        message: '✅ تم تحديث بيانات واعتمادات العميل بنجاح!'
      };
    } catch (error: any) {
      console.error('Error updating connection settings:', error);
      return { success: false, message: `⚠️ تعذر تحديث بيانات الربط: ${error.message}` };
    }
  }

  /**
   * Directly get Shop Connection from Firestore or local cache
   */
  public async getShopConnection(
    shopId: string,
    targetShopId: string
  ): Promise<ShopConnectionDoc | null> {
    if (!shopId || !targetShopId) return null;
    const cacheKey = `b2b_conn_${shopId}_${targetShopId}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const connRef = doc(db, 'shops', shopId, 'connections', targetShopId);
        const snap = await getDoc(connRef);
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as ShopConnectionDoc;
          try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) {}
          return data;
        }
      }
    } catch (err) {
      console.warn('Network read failed for shop connection, reading cache:', err);
    }

    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) return JSON.parse(raw) as ShopConnectionDoc;
    } catch (_) {}

    return null;
  }

  /**
   * Offline-friendly verification: check if connection is active and not expired
   * before rendering products or executing operations with partner shop.
   */
  public async isConnectionActive(
    shopId: string,
    targetShopId: string
  ): Promise<{ active: boolean; connection?: ShopConnectionDoc; reason?: string }> {
    if (!shopId || !targetShopId) {
      return { active: false, reason: 'معرفات المتاجر غير مكتملة' };
    }

    const cacheKey = `b2b_conn_${shopId}_${targetShopId}`;
    let cached: ShopConnectionDoc | null = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cached = JSON.parse(raw);
    } catch (_) {}

    // Helper to evaluate expiry timestamp safely
    const evaluateExpiry = (expiry: any): boolean => {
      if (!expiry) return false; // If no expiry specified, consider not expired
      let expiryMillis = 0;
      if (typeof expiry.toMillis === 'function') {
        expiryMillis = expiry.toMillis();
      } else if (expiry.seconds) {
        expiryMillis = expiry.seconds * 1000;
      } else if (typeof expiry === 'number') {
        expiryMillis = expiry;
      } else {
        expiryMillis = new Date(expiry).getTime();
      }
      return expiryMillis > 0 && expiryMillis < Date.now();
    };

    // 1. If online, check fresh Firestore state
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const connRef = doc(db, 'shops', shopId, 'connections', targetShopId);
        const snap = await getDoc(connRef);

        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as ShopConnectionDoc;
          const isExpired = evaluateExpiry(data.expiryTimestamp);

          if (isExpired || data.status === 'expired') {
            if (data.status !== 'expired') {
              updateDoc(connRef, { status: 'expired', updatedAt: serverTimestamp() }).catch(() => {});
            }
            const expiredData: ShopConnectionDoc = { ...data, status: 'expired' };
            try { localStorage.setItem(cacheKey, JSON.stringify(expiredData)); } catch (_) {}
            return {
              active: false,
              connection: expiredData,
              reason: '⛔ انتهت صلاحية الارتباط التجاري B2B مع هذا المتجر. يرجى تجديد التعاقد مع المورد.'
            };
          }

          if (data.status !== 'active') {
            try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) {}
            return {
              active: false,
              connection: data,
              reason: `⛔ حالة الارتباط مع المتجر غير نشطة (${data.status === 'suspended' ? 'معلق مؤقتاً' : data.status}).`
            };
          }

          // Active and valid!
          try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) {}
          return { active: true, connection: data };
        } else {
          // Check fallback legacy collection
          const legacyRef = doc(db, 'b2bConnections', `${shopId}_${targetShopId}`);
          const legSnap = await getDoc(legacyRef);
          if (legSnap.exists()) {
            const leg = legSnap.data();
            const upgradedDoc: ShopConnectionDoc = {
              id: targetShopId,
              shopId,
              targetShopId,
              targetShopName: leg.wholesalerName || 'متجر معتمد',
              status: (leg.status as any) || 'active',
              expiryTimestamp: leg.expiryTimestamp || Timestamp.fromDate(new Date(Date.now() + 180 * 86400000)),
              paymentTerms: leg.paymentTerms || 'net30',
              customPriceTier: leg.customPriceTier || 'wholesale',
              customDiscountPercent: Number(leg.customDiscountPercent || 0),
              creditLimit: Number(leg.creditLimit || 500000),
              createdAt: leg.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            setDoc(connRef, upgradedDoc, { merge: true }).catch(() => {});
            try { localStorage.setItem(cacheKey, JSON.stringify(upgradedDoc)); } catch (_) {}
            return { active: upgradedDoc.status === 'active', connection: upgradedDoc };
          }
        }
      } catch (err) {
        console.warn('Network error checking connection status, falling back to offline cache:', err);
      }
    }

    // 2. Offline Mode: verify with local storage cache
    if (cached) {
      const isExpired = evaluateExpiry(cached.expiryTimestamp);
      if (isExpired || cached.status === 'expired') {
        return {
          active: false,
          connection: { ...cached, status: 'expired' },
          reason: '⛔ انتهت صلاحية الارتباط التجاري B2B (فحص دون اتصال). يرجى الاتصال بالإنترنت للتحديث.'
        };
      }

      if (cached.status === 'active') {
        return { active: true, connection: cached };
      }

      return {
        active: false,
        connection: cached,
        reason: `⛔ حالة الارتباط مع المتجر غير نشطة (${cached.status}).`
      };
    }

    return {
      active: false,
      reason: '⚠️ لا يوجد ارتباط نشط مسجل مع هذا المتجر.'
    };
  }

  /**
   * Create or update Shop B2B Connection under shops/{shopId}/connections/{targetShopId}
   */
  public async createOrUpdateShopConnection(params: {
    shopId: string;
    targetShopId: string;
    targetShopName?: string;
    targetShopPhone?: string;
    status?: 'active' | 'expired' | 'suspended' | 'pending';
    expiryDays?: number;
    expiryTimestamp?: any;
    paymentTerms?: string;
    customPriceTier?: string;
    customDiscountPercent?: number;
    creditLimit?: number;
    connectionKey?: string;
  }): Promise<{ success: boolean; connection: ShopConnectionDoc; message: string }> {
    const {
      shopId,
      targetShopId,
      targetShopName = 'متجر شريك',
      targetShopPhone = '',
      status = 'active',
      expiryDays = 365,
      expiryTimestamp,
      paymentTerms = 'net30',
      customPriceTier = 'wholesale',
      customDiscountPercent = 0,
      creditLimit = 500000,
      connectionKey = ''
    } = params;

    try {
      const expiry = expiryTimestamp || Timestamp.fromDate(new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000));

      const connectionDoc: ShopConnectionDoc = {
        id: targetShopId,
        shopId,
        targetShopId,
        targetShopName,
        targetShopPhone,
        status,
        expiryTimestamp: expiry,
        paymentTerms,
        customPriceTier,
        customDiscountPercent,
        creditLimit,
        connectionKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // 1. Primary path: shops/{shopId}/connections/{targetShopId}
      const primaryRef = doc(db, 'shops', shopId, 'connections', targetShopId);
      await setDoc(primaryRef, connectionDoc, { merge: true });

      // 2. Inverse mirror path: shops/{targetShopId}/connections/{shopId}
      const inverseRef = doc(db, 'shops', targetShopId, 'connections', shopId);
      await setDoc(inverseRef, {
        id: shopId,
        shopId: targetShopId,
        targetShopId: shopId,
        targetShopName: 'المتجر الشريك',
        status,
        expiryTimestamp: expiry,
        paymentTerms,
        customPriceTier,
        customDiscountPercent,
        creditLimit,
        connectionKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});

      // 3. Local Cache for offline-friendly usage
      try {
        localStorage.setItem(`b2b_conn_${shopId}_${targetShopId}`, JSON.stringify(connectionDoc));
      } catch (_) {}

      return {
        success: true,
        connection: connectionDoc,
        message: '✅ تم حفظ واعتماد ارتباط المتجرين وتعيين شروط الدفع والفئة بنجاح!'
      };
    } catch (error: any) {
      console.error('Error in createOrUpdateShopConnection:', error);
      return {
        success: false,
        connection: {} as any,
        message: `⚠️ فشل حفظ الارتباط: ${error.message}`
      };
    }
  }

  /**
   * Dynamic Custom Price Override based on active customPriceTier
   */
  public calculateCustomTierPrice(
    originalPrice: number,
    customPriceTier: string = 'wholesale',
    customDiscountPercent: number = 0
  ): { finalPrice: number; discountPercent: number; discountAmount: number; tierLabel: string } {
    const basePrice = Math.max(0, Number(originalPrice) || 0);
    let tierDiscount = 0;
    let tierLabel = 'سعر الجملة الافتراضي';

    const cleanTier = (customPriceTier || '').toLowerCase().trim();
    switch (cleanTier) {
      case 'vip':
      case 'tier0':
        tierDiscount = 20;
        tierLabel = 'فئة كبار الشركاء VIP 👑 (خصم 20%)';
        break;
      case 'tier1':
      case 'distributor':
      case 'wholesale_plus':
        tierDiscount = 15;
        tierLabel = 'فئة الموزعين الحصريين Tier 1 📦 (خصم 15%)';
        break;
      case 'tier2':
      case 'wholesale':
        tierDiscount = 10;
        tierLabel = 'فئة تجار الجملة المعتمدين Tier 2 🏬 (خصم 10%)';
        break;
      case 'tier3':
      case 'half_wholesale':
        tierDiscount = 5;
        tierLabel = 'فئة نصف الجملة والتوزيع Tier 3 🚚 (خصم 5%)';
        break;
      case 'retail':
        tierDiscount = 0;
        tierLabel = 'سعر التجزئة العام 🛒';
        break;
      default:
        tierDiscount = 10;
        tierLabel = `فئة خاصة [${customPriceTier}]`;
        break;
    }

    const totalDiscountPercent = Math.min(60, Math.max(tierDiscount, Number(customDiscountPercent) || 0));
    const finalPrice = Math.max(1, Math.round(basePrice * (1 - totalDiscountPercent / 100)));
    const discountAmount = Math.max(0, basePrice - finalPrice);

    return {
      finalPrice,
      discountPercent: totalDiscountPercent,
      discountAmount,
      tierLabel
    };
  }

  /**
   * Transforms a partner product for catalog rendering:
   * 1. Overrides default price with the custom calculated price using Shop B's customPriceTier.
   * 2. Completely hides physical inventory quantity numbers.
   * 3. Dynamically provides binary badge: "متوفر" (if stock > 0) or "غير متوفر" (if stock <= 0).
   */
  public transformPartnerProductForCatalog(
    product: any,
    customPriceTier: string = 'wholesale',
    customDiscountPercent: number = 0
  ) {
    const rawPrice = Number(product.wholesalePrice || product.wholesale_price || product.price || 0);
    const tierPricing = this.calculateCustomTierPrice(rawPrice, customPriceTier, customDiscountPercent);
    const actualStock = Number(product.stock ?? product.quantity ?? product.availableStock ?? 0);
    const isAvailable = actualStock > 0;

    return {
      id: product.id,
      name: product.name || product.productName || 'صنف جملة شريك',
      originalPrice: rawPrice,
      price: tierPricing.finalPrice,
      currency: product.currency || 'ر.ي',
      isAvailable,
      availabilityBadge: isAvailable ? 'متوفر' : 'غير متوفر',
      badgeColor: isAvailable ? 'emerald' : 'rose',
      tierLabel: tierPricing.tierLabel,
      discountPercent: tierPricing.discountPercent,
      category: product.category || 'عام',
      imageUrl: product.imageUrl,
      barcode: product.barcode,
      minQuantity: product.minQuantity || product.minOrderQty || 1,
      storeId: product.storeId || product.wholesalerId || product.ownerId,
      storeName: product.storeName || product.wholesalerName || 'المتجر الشريك',
      units: product.units || []
      // ⚠️ Notice: numeric stock property is strictly omitted for partner presentation privacy!
    };
  }
}

export const b2bLinkageEngine = new B2BLinkageEngineService();
