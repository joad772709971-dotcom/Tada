import { 
  collection, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  doc, 
  getDoc,
  serverTimestamp,
  Unsubscribe 
} from 'firebase/firestore';
import { FirebaseProjectRouter, ProjectTier } from './FirebaseProjectRouter';

export interface B2CCustomerProfile {
  uid: string;
  fullName: string;
  phoneNumber: string;
  address?: string;
  customerTier: 'customer';
  createdAt?: any;
}

export interface RetailShopCatalogItem {
  id: string;
  shopId: string;
  shopName: string;
  productName: string;
  retailPrice: number;
  availableQuantity: number;
  category?: string;
  imageUrl?: string;
  shopTier: ProjectTier;
}

export interface B2CCustomerOrder {
  id?: string;
  orderNumber: string;
  customerUid: string;
  customerName: string;
  customerPhone: string;
  shopId: string;
  shopName: string;
  shopTier: ProjectTier;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'accepted' | 'delivering' | 'completed' | 'cancelled';
  deliveryAddress?: string;
  createdAt?: any;
}

export interface CustomerShopBalanceSummary {
  shopId: string;
  shopName: string;
  totalDebt: number;
  totalPaid: number;
  remainingBalance: number;
  currency: string;
  lastTransactionDate?: any;
}

export class CustomerPortalEngine {
  private customerTier: ProjectTier = 'customer'; // Dedicated joad772315106

  /**
   * Retrieves Firestore database instance explicitly pinned to the Customer Tier (joad772315106)
   */
  public getCustomerDb() {
    return FirebaseProjectRouter.getFirestoreForTier(this.customerTier);
  }

  /**
   * Registers or updates a customer profile safely inside the customer project
   */
  public async registerCustomerProfile(profile: B2CCustomerProfile): Promise<void> {
    const db = this.getCustomerDb();
    await addDoc(collection(db, 'customer_profiles'), {
      ...profile,
      customerTier: 'customer',
      createdAt: serverTimestamp()
    });
  }

  /**
   * Browse published retail products from retailer project tier (joad7723151)
   */
  public async fetchAvailableRetailProducts(category?: string): Promise<RetailShopCatalogItem[]> {
    try {
      const retailerDb = FirebaseProjectRouter.getFirestoreForTier('retailer');
      const colRef = collection(retailerDb, 'retail_products');
      
      let q = query(colRef, where('isPublishedForB2C', '==', true));
      if (category && category !== 'all') {
        q = query(colRef, where('isPublishedForB2C', '==', true), where('category', '==', category));
      }

      const snap = await getDocs(q);
      const items: RetailShopCatalogItem[] = [];

      snap.forEach(d => {
        const data = d.data();
        items.push({
          id: d.id,
          shopId: data.shopId || data.ownerId || '',
          shopName: data.shopName || 'متجر التجزئة',
          productName: data.productName || data.name || 'منتج',
          retailPrice: Number(data.retailPrice || data.price || 0),
          availableQuantity: Number(data.availableQuantity || data.quantity || 0),
          category: data.category || 'عام',
          imageUrl: data.imageUrl || data.image || '',
          shopTier: 'retailer'
        });
      });

      return items;
    } catch (err) {
      console.error('[CustomerPortalEngine] Error fetching retail catalog:', err);
      return [];
    }
  }

  /**
   * Places a customer purchase order from B2C App into both Customer Project (joad772315106) and Retailer Project (joad7723151)
   */
  public async placeCustomerOrder(
    customer: B2CCustomerProfile,
    targetShopId: string,
    targetShopName: string,
    targetShopTier: ProjectTier = 'retailer',
    orderItems: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }>,
    totalAmount: number,
    deliveryAddress?: string
  ): Promise<{ orderId: string; orderNumber: string }> {
    const customerDb = this.getCustomerDb();
    const shopDb = FirebaseProjectRouter.getFirestoreForTier(targetShopTier);

    const orderNumber = `CUST-${Date.now().toString().slice(-6)}`;

    const orderPayload: Omit<B2CCustomerOrder, 'id'> = {
      orderNumber,
      customerUid: customer.uid,
      customerName: customer.fullName,
      customerPhone: customer.phoneNumber,
      shopId: targetShopId,
      shopName: targetShopName,
      shopTier: targetShopTier,
      items: orderItems,
      totalAmount,
      currency: 'YER',
      status: 'pending',
      deliveryAddress: deliveryAddress || customer.address || '',
      createdAt: serverTimestamp()
    };

    // 1. Record in Customer Dedicated Firebase Project (joad772315106)
    const custOrderRef = await addDoc(collection(customerDb, 'b2c_customer_orders'), orderPayload);

    // 2. Relay into Retail Shop Firebase Project (joad7723151) for Merchant Processing
    await addDoc(collection(shopDb, 'b2c_incoming_orders'), {
      ...orderPayload,
      customerPortalOrderId: custOrderRef.id
    });

    // 3. Trigger alert in Retailer's Notification Queue
    await addDoc(collection(shopDb, 'notifications'), {
      recipientUid: targetShopId,
      title: 'طلب زبون جديد 🛒',
      body: `وصلك طلب شراء جديد من الزبون: ${customer.fullName} برقم (${orderNumber}) بقيمة ${totalAmount} YER`,
      type: 'b2c_order',
      relatedOrderId: custOrderRef.id,
      isRead: false,
      createdAt: serverTimestamp()
    });

    return { orderId: custOrderRef.id, orderNumber };
  }

  /**
   * Safely monitors customer balance / debt summary with a shop stored in customer project
   */
  public subscribeToCustomerDebtSummary(
    customerUid: string,
    onSummaryUpdated: (summaries: CustomerShopBalanceSummary[]) => void
  ): Unsubscribe {
    const customerDb = this.getCustomerDb();
    const q = query(
      collection(customerDb, 'customer_ledger_balances'),
      where('customerUid', '==', customerUid)
    );

    return onSnapshot(
      q,
      (snap) => {
        const summaries: CustomerShopBalanceSummary[] = [];
        snap.forEach(d => {
          const data = d.data();
          summaries.push({
            shopId: data.shopId,
            shopName: data.shopName || 'المتجر',
            totalDebt: Number(data.totalDebt || 0),
            totalPaid: Number(data.totalPaid || 0),
            remainingBalance: Number(data.remainingBalance || 0),
            currency: data.currency || 'YER',
            lastTransactionDate: data.lastTransactionDate
          });
        });
        onSummaryUpdated(summaries);
      },
      (err) => {
        console.error('[CustomerPortalEngine] Error reading debt summary:', err);
        onSummaryUpdated([]);
      }
    );
  }

  /**
   * Fetches B2C customer orders placed by a specific customer
   */
  public async fetchCustomerOrders(customerUid: string): Promise<B2CCustomerOrder[]> {
    try {
      const customerDb = this.getCustomerDb();
      const q = query(
        collection(customerDb, 'b2c_customer_orders'),
        where('customerUid', '==', customerUid)
      );
      const snap = await getDocs(q);
      const orders: B2CCustomerOrder[] = [];
      snap.forEach(d => {
        orders.push({ id: d.id, ...d.data() } as B2CCustomerOrder);
      });
      return orders;
    } catch (err) {
      console.error('[CustomerPortalEngine] Error fetching customer orders:', err);
      return [];
    }
  }

  /**
   * Updates status of a B2C customer order across both Customer project and Retailer project
   */
  public async updateB2COrderStatus(
    customerPortalOrderId: string,
    targetShopTier: ProjectTier,
    newStatus: 'pending' | 'accepted' | 'delivering' | 'completed' | 'cancelled'
  ): Promise<boolean> {
    try {
      const customerDb = this.getCustomerDb();
      const custOrderRef = doc(customerDb, 'b2c_customer_orders', customerPortalOrderId);
      await updateDoc(custOrderRef, { status: newStatus, updatedAt: serverTimestamp() });

      const shopDb = FirebaseProjectRouter.getFirestoreForTier(targetShopTier);
      const qShop = query(
        collection(shopDb, 'b2c_incoming_orders'),
        where('customerPortalOrderId', '==', customerPortalOrderId)
      );
      const snap = await getDocs(qShop);
      snap.forEach(async (d) => {
        await updateDoc(doc(shopDb, 'b2c_incoming_orders', d.id), {
          status: newStatus,
          updatedAt: serverTimestamp()
        });
      });

      return true;
    } catch (err) {
      console.error('[CustomerPortalEngine] Error updating B2C order status:', err);
      return false;
    }
  }
}

export const CustomerPortal = new CustomerPortalEngine();
