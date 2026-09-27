import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  orderBy, 
  onSnapshot, 
  Unsubscribe,
  serverTimestamp 
} from 'firebase/firestore';
import { MultiDatabaseRouter } from './MultiDatabaseRouter';

export interface MarketFeedItem {
  id: string;
  storeId: string;
  storeName: string;
  productName: string;
  category: string;
  price: number;
  currency: string;
  minQuantity: number;
  availableStock: number;
  imageUrl?: string;
  sellerPhone?: string;
  publishedAt: number;
  isActive: boolean;
  tags?: string[];
}

export interface RelayedOrder {
  id: string;
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'accepted' | 'processing' | 'delivered' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

class CoreRelayEngineService {
  /**
   * Publish product card silently to public market feed in default primary DB
   */
  public async publishToMarketFeed(feedItem: Omit<MarketFeedItem, 'id' | 'publishedAt'>): Promise<{ success: boolean; id: string }> {
    try {
      const primaryDb = MultiDatabaseRouter.getPrimaryDb();
      const feedRef = doc(collection(primaryDb, 'public_market_feed'));
      const id = feedRef.id;

      const newItem: MarketFeedItem = {
        ...feedItem,
        id,
        publishedAt: Date.now(),
        isActive: true
      };

      await setDoc(feedRef, newItem);
      console.log(`⚡ [Core Relay] Published product ${id} to public market feed.`);
      return { success: true, id };
    } catch (error) {
      console.error('❌ [Core Relay] Failed to publish product feed:', error);
      return { success: false, id: '' };
    }
  }

  /**
   * Fetch light market feed items without pulling heavy store inventory
   */
  public async getMarketFeed(category?: string, fetchLimit: number = 30): Promise<MarketFeedItem[]> {
    try {
      const primaryDb = MultiDatabaseRouter.getPrimaryDb();
      let q = query(
        collection(primaryDb, 'public_market_feed'),
        where('isActive', '==', true),
        orderBy('publishedAt', 'desc'),
        limit(fetchLimit)
      );

      if (category && category !== 'ALL') {
        q = query(
          collection(primaryDb, 'public_market_feed'),
          where('isActive', '==', true),
          where('category', '==', category),
          limit(fetchLimit)
        );
      }

      const snapshot = await getDocs(q);
      const items: MarketFeedItem[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as MarketFeedItem);
      });
      return items;
    } catch (error) {
      console.error('❌ [Core Relay] Error fetching market feed:', error);
      return [];
    }
  }

  /**
   * Relay order silently between stores in primary DB relay collection
   */
  public async relayOrderBetweenStores(orderData: Omit<RelayedOrder, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<{ success: boolean; orderId: string }> {
    try {
      const primaryDb = MultiDatabaseRouter.getPrimaryDb();
      const orderRef = doc(collection(primaryDb, 'relayed_b2b_orders'));
      const orderId = orderRef.id;

      const fullOrder: RelayedOrder = {
        ...orderData,
        id: orderId,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(orderRef, fullOrder);
      console.log(`🚀 [Core Relay] Relayed B2B order ${orderId} from ${orderData.fromStoreId} to ${orderData.toStoreId}`);
      return { success: true, orderId };
    } catch (error) {
      console.error('❌ [Core Relay] Error relaying B2B order:', error);
      return { success: false, orderId: '' };
    }
  }

  /**
   * Listen for incoming relayed orders for a specific store in real time
   */
  public subscribeToIncomingRelayedOrders(
    storeId: string, 
    onUpdate: (orders: RelayedOrder[]) => void
  ): Unsubscribe {
    const primaryDb = MultiDatabaseRouter.getPrimaryDb();
    const q = query(
      collection(primaryDb, 'relayed_b2b_orders'),
      where('toStoreId', '==', storeId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    return onSnapshot(q, (snapshot) => {
      const orders: RelayedOrder[] = [];
      snapshot.forEach(d => {
        orders.push(d.data() as RelayedOrder);
      });
      onUpdate(orders);
    }, (err) => {
      console.warn('⚠️ [Core Relay] Orders listener error:', err);
    });
  }
}

export const CoreRelayEngine = new CoreRelayEngineService();
