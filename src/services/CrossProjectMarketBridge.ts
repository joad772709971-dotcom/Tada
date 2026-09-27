import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  Unsubscribe 
} from 'firebase/firestore';
import { FirebaseProjectRouter, ProjectTier } from './FirebaseProjectRouter';

export interface MarketProductOffer {
  id: string;
  productName: string;
  category?: string;
  wholesalePrice: number;
  minimumOrderQuantity: number;
  availableStock: number;
  supplierId: string;
  supplierName: string;
  supplierTier: ProjectTier;
  imageUrl?: string;
  isMarketPublished: boolean;
  publishedAt?: any;
}

export class CrossProjectMarketBridgeEngine {
  /**
   * Fetches public market products from a specified supplier project tier (e.g., 'importer' or 'wholesale_master')
   */
  public async fetchMarketProductsFromTier(
    tier: ProjectTier = 'importer',
    categoryFilter?: string
  ): Promise<MarketProductOffer[]> {
    try {
      const targetDb = FirebaseProjectRouter.getFirestoreForTier(tier);
      const colRef = collection(targetDb, 'wholesaleProducts');

      let q = query(colRef, where('isMarketPublished', '==', true));
      if (categoryFilter && categoryFilter !== 'all') {
        q = query(colRef, where('isMarketPublished', '==', true), where('category', '==', categoryFilter));
      }

      const snap = await getDocs(q);
      const products: MarketProductOffer[] = [];

      snap.forEach(d => {
        const data = d.data();
        products.push({
          id: d.id,
          productName: data.productName || data.name || 'منتج جملة',
          category: data.category || 'عام',
          wholesalePrice: Number(data.wholesalePrice || data.price || 0),
          minimumOrderQuantity: Number(data.minimumOrderQuantity || data.minQty || 1),
          availableStock: Number(data.availableStock || data.quantity || 0),
          supplierId: data.supplierId || data.ownerId || '',
          supplierName: data.supplierName || data.shopName || 'تاجر جملة معتمد',
          supplierTier: tier,
          imageUrl: data.imageUrl || data.image || '',
          isMarketPublished: true,
          publishedAt: data.publishedAt
        });
      });

      return products;
    } catch (err) {
      console.error(`[CrossProjectMarketBridge] Error fetching market products from tier ${tier}:`, err);
      return [];
    }
  }

  /**
   * Real-time subscription to public market items from a specific tier (e.g. Importer Tier joad7723)
   */
  public subscribeToTierMarketProducts(
    tier: ProjectTier,
    onProductsUpdated: (products: MarketProductOffer[]) => void
  ): Unsubscribe {
    const targetDb = FirebaseProjectRouter.getFirestoreForTier(tier);
    const colRef = collection(targetDb, 'wholesaleProducts');
    const q = query(colRef, where('isMarketPublished', '==', true));

    return onSnapshot(
      q,
      (snap) => {
        const list: MarketProductOffer[] = [];
        snap.forEach(d => {
          const data = d.data();
          list.push({
            id: d.id,
            productName: data.productName || data.name || 'منتج جملة',
            category: data.category || 'عام',
            wholesalePrice: Number(data.wholesalePrice || data.price || 0),
            minimumOrderQuantity: Number(data.minimumOrderQuantity || data.minQty || 1),
            availableStock: Number(data.availableStock || data.quantity || 0),
            supplierId: data.supplierId || data.ownerId || '',
            supplierName: data.supplierName || data.shopName || 'تاجر معتمد',
            supplierTier: tier,
            imageUrl: data.imageUrl || data.image || '',
            isMarketPublished: true,
            publishedAt: data.publishedAt
          });
        });
        onProductsUpdated(list);
      },
      (err) => {
        console.warn(`[CrossProjectMarketBridge] Snapshot error on tier ${tier}:`, err);
        onProductsUpdated([]);
      }
    );
  }

  /**
   * Publishes a product from a merchant's internal inventory to their tier's public B2B market catalog
   */
  public async publishProductToMarket(
    merchantProfile: any,
    productData: {
      name: string;
      category?: string;
      wholesalePrice: number;
      minQty?: number;
      stock: number;
      image?: string;
    }
  ): Promise<string> {
    const tier = FirebaseProjectRouter.resolveTier(merchantProfile?.role, merchantProfile);
    const targetDb = FirebaseProjectRouter.getFirestoreForTier(tier);

    const payload = {
      productName: productData.name,
      category: productData.category || 'عام',
      wholesalePrice: productData.wholesalePrice,
      minimumOrderQuantity: productData.minQty || 1,
      availableStock: productData.stock,
      supplierId: merchantProfile?.uid || merchantProfile?.ownerId,
      supplierName: merchantProfile?.shopName || merchantProfile?.displayName || 'مستورد/تاجر',
      supplierTier: tier,
      imageUrl: productData.image || '',
      isMarketPublished: true,
      publishedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(targetDb, 'wholesaleProducts'), payload);
    return docRef.id;
  }
}

export const CrossProjectMarketBridge = new CrossProjectMarketBridgeEngine();
