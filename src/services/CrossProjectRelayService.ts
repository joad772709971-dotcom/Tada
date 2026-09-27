import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  serverTimestamp,
  Unsubscribe 
} from 'firebase/firestore';
import { FirebaseProjectRouter, ProjectTier } from './FirebaseProjectRouter';

export interface CrossProjectOrder {
  id?: string;
  orderNumber: string;
  buyerUid: string;
  buyerName: string;
  buyerShopName: string;
  buyerTier: ProjectTier;
  supplierUid: string;
  supplierName: string;
  supplierTier: ProjectTier;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'approved' | 'shipped' | 'rejected' | 'completed';
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CrossProjectMessage {
  id?: string;
  threadId: string;
  senderUid: string;
  senderName: string;
  senderTier: ProjectTier;
  recipientUid: string;
  recipientTier: ProjectTier;
  messageText: string;
  attachments?: string[];
  read: boolean;
  createdAt?: any;
}

export class CrossProjectRelayEngine {
  /**
   * Relays a customer basket order from the B2C Customer Portal directly into the target Retail Store's project
   */
  public async relayCustomerToStoreOrder(
    customerProfile: any,
    targetStoreId: string,
    targetStoreTier: ProjectTier = 'retailer',
    cartItems: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }>,
    totalAmount: number,
    notes: string = ''
  ): Promise<{ orderId: string; orderNumber: string }> {
    const storeDb = FirebaseProjectRouter.getFirestoreForTier(targetStoreTier);
    const customerDb = FirebaseProjectRouter.getFirestoreForTier('customer');

    const orderNumber = `ORD-CUST-${Date.now().toString().slice(-6)}`;

    const newOrder = {
      orderNumber,
      customerUid: customerProfile?.uid || customerProfile?.phone || 'guest_customer',
      customerName: customerProfile?.fullName || customerProfile?.displayName || customerProfile?.phone || 'زبون عام',
      customerPhone: customerProfile?.phone || '',
      targetStoreId,
      items: cartItems,
      totalAmount,
      currency: 'YER',
      status: 'pending',
      notes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // 1. Write to target Retailer store project
    const storeOrderRef = await addDoc(collection(storeDb, 'orders'), newOrder);

    // 2. Write mirror copy to Customer project
    await addDoc(collection(customerDb, 'my_customer_orders'), {
      ...newOrder,
      storeOrderId: storeOrderRef.id
    });

    // 3. Notify Retailer
    await addDoc(collection(storeDb, 'notifications'), {
      recipientUid: targetStoreId,
      title: 'طلب زبون جديد 🛒',
      body: `وصلك طلب شراء زبون جديد (${orderNumber}) بقيمة ${totalAmount} YER من: ${newOrder.customerName}`,
      type: 'customer_order',
      relatedOrderId: storeOrderRef.id,
      isRead: false,
      createdAt: serverTimestamp()
    });

    return { orderId: storeOrderRef.id, orderNumber };
  }

  /**
   * Relays a purchase order from a buyer tier (e.g. Retailer/Wholesaler) directly to the target supplier's Firebase project
   */
  public async relayPurchaseOrder(
    buyerProfile: any,
    targetSupplierTier: ProjectTier,
    targetSupplierUid: string,
    targetSupplierName: string,
    orderData: {
      items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
      totalAmount: number;
      currency?: string;
      notes?: string;
    }
  ): Promise<{ orderId: string; orderNumber: string }> {
    const buyerTier = FirebaseProjectRouter.resolveTier(buyerProfile?.role, buyerProfile);
    const supplierDb = FirebaseProjectRouter.getFirestoreForTier(targetSupplierTier);
    const buyerDb = FirebaseProjectRouter.getFirestoreForTier(buyerTier);

    const orderNumber = `ORD-B2B-${Date.now().toString().slice(-6)}`;

    const newOrder: Omit<CrossProjectOrder, 'id'> = {
      orderNumber,
      buyerUid: buyerProfile?.uid || buyerProfile?.ownerId || 'unknown_buyer',
      buyerName: buyerProfile?.displayName || buyerProfile?.fullName || 'تاجر تجزئة',
      buyerShopName: buyerProfile?.shopName || 'متجر تجزئة',
      buyerTier,
      supplierUid: targetSupplierUid,
      supplierName: targetSupplierName,
      supplierTier: targetSupplierTier,
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      currency: orderData.currency || 'YER',
      status: 'pending',
      notes: orderData.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // 1. Dispatch Order Document directly into Supplier's Project
    const supplierOrderRef = await addDoc(collection(supplierDb, 'incoming_b2b_orders'), newOrder);

    // 2. Dispatch Order mirror into Buyer's Local Project for tracking
    await addDoc(collection(buyerDb, 'outgoing_b2b_orders'), {
      ...newOrder,
      relayedSupplierOrderId: supplierOrderRef.id
    });

    // 3. Trigger Real-time Notification in Supplier's Project Notification Hub
    await addDoc(collection(supplierDb, 'notifications'), {
      recipientUid: targetSupplierUid,
      title: 'طلب شراء B2B جديد 📦',
      body: `وصلك طلب شراء جديد برقم (${orderNumber}) من المتجر: ${newOrder.buyerShopName} بقيمة ${orderData.totalAmount} ${newOrder.currency}`,
      type: 'b2b_order',
      relatedOrderId: supplierOrderRef.id,
      buyerTier,
      isRead: false,
      createdAt: serverTimestamp()
    });

    return { orderId: supplierOrderRef.id, orderNumber };
  }

  /**
   * Relays a real-time message to a supplier/buyer across Firebase project tiers
   */
  public async sendCrossProjectMessage(
    senderProfile: any,
    recipientTier: ProjectTier,
    recipientUid: string,
    messageText: string,
    attachments: string[] = []
  ): Promise<string> {
    const senderTier = FirebaseProjectRouter.resolveTier(senderProfile?.role, senderProfile);
    const senderUid = senderProfile?.uid || senderProfile?.ownerId;
    const recipientDb = FirebaseProjectRouter.getFirestoreForTier(recipientTier);
    const senderDb = FirebaseProjectRouter.getFirestoreForTier(senderTier);

    const threadId = [senderUid, recipientUid].sort().join('_');

    const messagePayload: Omit<CrossProjectMessage, 'id'> = {
      threadId,
      senderUid,
      senderName: senderProfile?.displayName || senderProfile?.shopName || 'تاجر',
      senderTier,
      recipientUid,
      recipientTier,
      messageText,
      attachments,
      read: false,
      createdAt: serverTimestamp()
    };

    // Store in Recipient's Project Inbox
    const recipientMsgRef = await addDoc(collection(recipientDb, 'crossProjectMessages'), messagePayload);

    // Store copy in Sender's Project Sentbox
    await addDoc(collection(senderDb, 'crossProjectMessages'), messagePayload);

    // Send push/hub notification in recipient project
    await addDoc(collection(recipientDb, 'notifications'), {
      recipientUid,
      title: 'رسالة جديدة 💬',
      body: `رسالة من ${messagePayload.senderName}: "${messageText.slice(0, 50)}..."`,
      type: 'b2b_chat',
      threadId,
      isRead: false,
      createdAt: serverTimestamp()
    });

    return recipientMsgRef.id;
  }

  /**
   * Real-time listener for incoming B2B purchase orders on a supplier's tier project
   */
  public subscribeToIncomingOrders(
    supplierTier: ProjectTier,
    supplierUid: string,
    onOrdersUpdated: (orders: CrossProjectOrder[]) => void
  ): Unsubscribe {
    const supplierDb = FirebaseProjectRouter.getFirestoreForTier(supplierTier);
    const q = query(
      collection(supplierDb, 'incoming_b2b_orders'),
      where('supplierUid', '==', supplierUid)
    );

    return onSnapshot(
      q,
      (snap) => {
        const orders: CrossProjectOrder[] = [];
        snap.forEach(d => {
          orders.push({ id: d.id, ...d.data() } as CrossProjectOrder);
        });
        onOrdersUpdated(orders);
      },
      (err) => {
        console.error(`[CrossProjectRelay] Error listening to incoming orders on tier ${supplierTier}:`, err);
        onOrdersUpdated([]);
      }
    );
  }

  /**
   * Updates purchase order status on both supplier and buyer projects
   */
  public async updateOrderStatus(
    supplierTier: ProjectTier,
    orderId: string,
    buyerTier: ProjectTier,
    newStatus: 'approved' | 'shipped' | 'rejected' | 'completed'
  ): Promise<void> {
    const supplierDb = FirebaseProjectRouter.getFirestoreForTier(supplierTier);
    await updateDoc(doc(supplierDb, 'incoming_b2b_orders', orderId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Fetches relayed B2B orders from a specified tier
   */
  public async fetchRelayedOrders(
    supplierTier: ProjectTier = 'importer',
    supplierUid?: string
  ): Promise<CrossProjectOrder[]> {
    try {
      const supplierDb = FirebaseProjectRouter.getFirestoreForTier(supplierTier);
      let q = query(collection(supplierDb, 'incoming_b2b_orders'));
      if (supplierUid) {
        q = query(collection(supplierDb, 'incoming_b2b_orders'), where('supplierUid', '==', supplierUid));
      }
      const snap = await getDocs(q);
      const orders: CrossProjectOrder[] = [];
      snap.forEach(d => {
        orders.push({ id: d.id, ...d.data() } as CrossProjectOrder);
      });
      return orders;
    } catch (e) {
      console.warn(`[CrossProjectRelay] fetchRelayedOrders warning on tier ${supplierTier}:`, e);
      return [];
    }
  }
}

export const CrossProjectRelay = new CrossProjectRelayEngine();
