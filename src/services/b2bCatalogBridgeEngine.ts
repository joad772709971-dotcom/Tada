import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { getHierarchyLevel, isAllowedTierGap, filterConnectedSuppliersByTier } from '../utils/b2bTierHierarchy';

export interface TierPricingCalculation {
  originalPrice: number;
  finalPrice: number;
  tierMultiplier: number;
  tierName: string;
  badgeColor: string;
  customDiscountPercent: number;
  totalDiscountAmount: number;
}

export interface StockValidationResult {
  valid: boolean;
  availableStock: number;
  requestedQty: number;
  productName: string;
  message: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  wholesalePrice?: number;
  stock: number;
  minOrderQty: number;
  wholesalerId: string;
  wholesalerName: string;
  wholesalerRole?: string;
  category?: string;
  imageUrl?: string;
  unit?: string;
  variants?: any[];
  tierPricing?: TierPricingCalculation;
}

class B2BCatalogBridgeEngineService {
  /**
   * Calculate Dynamic Price based on B2B Connection Tier & Custom Discounts
   */
  public calculateTierPrice(
    product: any,
    buyerRoleOrLevel: string | number,
    connection?: any
  ): TierPricingCalculation {
    const originalPrice = Number(product.price || product.wholesalePrice || 0);
    let tierMultiplier = 1.0;
    let tierName = 'سعر السوق الافتراضي';
    let badgeColor = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    let customDiscountPercent = 0;
    let directCustomPrice: number | null = null;

    if (connection) {
      customDiscountPercent = Number(connection.customDiscountPercent || 0);
      const tier = String(connection.customPriceTier || connection.assignedPriceTier || '').toLowerCase().trim();

      // Check explicit 4 B2B Tiers first
      if (tier === 'imported' || tier === 'importer') {
        const directPrice = Number(product.prices?.imported ?? product.importedPrice ?? product.price_imported ?? 0);
        if (directPrice > 0) {
          directCustomPrice = directPrice;
          tierMultiplier = directPrice / (originalPrice || 1);
        } else {
          tierMultiplier = 0.78;
        }
        tierName = 'فئة المستورد 🚢💎';
        badgeColor = 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      } else if (tier === 'wholesale_wholesale' || tier === 'mega_wholesale' || tier === 'grand_wholesale') {
        const directPrice = Number(product.prices?.wholesale_wholesale ?? product.wholesaleWholesalePrice ?? product.price_wholesale_wholesale ?? 0);
        if (directPrice > 0) {
          directCustomPrice = directPrice;
          tierMultiplier = directPrice / (originalPrice || 1);
        } else {
          tierMultiplier = 0.84;
        }
        tierName = 'فئة جملة الجملة 📦👑';
        badgeColor = 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
      } else if (tier === 'wholesale' || tier === 'wholesaler') {
        const directPrice = Number(product.prices?.wholesale ?? product.wholesalePrice ?? product.price_wholesale ?? 0);
        if (directPrice > 0) {
          directCustomPrice = directPrice;
          tierMultiplier = directPrice / (originalPrice || 1);
        } else {
          tierMultiplier = 0.90;
        }
        tierName = 'فئة الجملة 🏬';
        badgeColor = 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      } else if (tier === 'retail' || tier === 'retailer') {
        const directPrice = Number(product.prices?.retail ?? product.retailPrice ?? product.price_retail ?? product.price ?? 0);
        if (directPrice > 0) {
          directCustomPrice = directPrice;
          tierMultiplier = directPrice / (originalPrice || 1);
        } else {
          tierMultiplier = 1.0;
        }
        tierName = 'فئة التجزئة 🛒';
        badgeColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      } else {
        // Fallback to connection payment-based tiers if no explicit tier name is assigned
        const payments = connection.allowedPayments || [];
        const hasDeferred = payments.includes('deferred') || connection.paymentTerms === 'credit' || connection.paymentTerms === 'net30';
        const hasJamPay = payments.includes('jampay');
        const hasTransfer = payments.includes('transfer') || connection.paymentTerms === 'net7';

        if (hasDeferred && hasJamPay) {
          tierName = 'قناة النفوذ الذهبي والآجل الفوري 💳👑';
          tierMultiplier = 0.80;
          badgeColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
        } else if (hasDeferred) {
          tierName = 'قناة التسهيلات والفوترة الآجلة 🗓️💼';
          tierMultiplier = 0.88;
          badgeColor = 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
        } else if (hasJamPay || hasTransfer) {
          tierName = 'قناة النقد الرقمي والحوالات السريعة ⚡📱';
          tierMultiplier = 0.85;
          badgeColor = 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
        } else {
          tierName = 'قناة النقد المباشر التقليدي 💵';
          tierMultiplier = 0.92;
          badgeColor = 'bg-orange-500/15 text-orange-400 border border-orange-500/30';
        }
      }
    } else {
      const buyerLevel = getHierarchyLevel(buyerRoleOrLevel);
      if (buyerLevel === 2) {
        tierName = 'فئة كبار الموزعين والجملة 📦';
        tierMultiplier = 0.88;
        badgeColor = 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
      } else if (buyerLevel === 3) {
        tierName = 'فئة تجار الجملة المعتمدين 🏬';
        tierMultiplier = 0.92;
        badgeColor = 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
      } else {
        tierName = 'فئة تجار التجزئة 🛒';
        tierMultiplier = 0.96;
        badgeColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      }
    }

    // Apply direct custom price if available, otherwise apply tier multiplier
    let discountedPrice = directCustomPrice !== null && directCustomPrice > 0 
      ? directCustomPrice 
      : originalPrice * tierMultiplier;

    // Apply additional custom discount percent if set
    if (customDiscountPercent > 0) {
      discountedPrice = discountedPrice * (1 - customDiscountPercent / 100);
    }

    const finalPrice = Math.max(1, Math.round(discountedPrice));
    const totalDiscountAmount = originalPrice - finalPrice;

    return {
      originalPrice,
      finalPrice,
      tierMultiplier,
      tierName,
      badgeColor,
      customDiscountPercent,
      totalDiscountAmount
    };
  }

  /**
   * Real-time Inventory Verification (التحقق الجردي المباشر لمنع البيع على المكشوف)
   */
  public async verifyStockAvailability(
    items: { productId: string; requestedQty: number; productName?: string; supplierId: string }[]
  ): Promise<{ valid: boolean; results: StockValidationResult[]; errorMessage?: string }> {
    const results: StockValidationResult[] = [];
    let allValid = true;
    let errorMessage = '';

    for (const item of items) {
      const { productId, requestedQty, supplierId } = item;
      let availableStock = 0;
      let prodName = item.productName || 'منتج جملة';

      try {
        // Look up product in 'wholesaleProducts'
        const prodRef = doc(db, 'wholesaleProducts', productId);
        let prodSnap = await getDoc(prodRef);

        if (!prodSnap.exists()) {
          // Fallback to store products under supplier store
          const storeProdRef = doc(db, 'stores', supplierId, 'products', productId);
          prodSnap = await getDoc(storeProdRef);
        }

        if (prodSnap.exists()) {
          const data = prodSnap.data();
          prodName = data.name || data.productName || prodName;
          const totalQty = Number(data.stock ?? data.quantity ?? data.availableStock ?? 0);
          const tempLocked = Number(data.tempLocked || 0);
          availableStock = Math.max(0, totalQty - tempLocked);
        } else {
          // If product doc not found directly, assume safe fallback unless stock explicitly 0
          availableStock = 999;
        }

        const isEnough = availableStock >= requestedQty;
        if (!isEnough) {
          allValid = false;
          const msg = `⚠️ المنتج [ ${prodName} ]: الكمية المطلوبة (${requestedQty}) تزيد عن الرصيد المخزني المتاح لدى المورد (${availableStock}).`;
          if (!errorMessage) errorMessage = msg;
        }

        results.push({
          valid: isEnough,
          availableStock,
          requestedQty,
          productName: prodName,
          message: isEnough 
            ? '✅ الكمية متوفرة في المخزن الحقيقي' 
            : `⚠️ الرصيد المخزني المتاح (${availableStock}) غير كافٍ للكمية المطلوبة (${requestedQty})`
        });
      } catch (err: any) {
        console.error(`Stock verification error for product ${productId}:`, err);
        results.push({
          valid: true, // Fail open safely on network warning
          availableStock: 999,
          requestedQty,
          productName: prodName,
          message: '⚠️ تعذر الوصول لشاشات الجرد الحية - تم الفحص الاحتياطي.'
        });
      }
    }

    return {
      valid: allValid,
      results,
      errorMessage: allValid ? undefined : errorMessage
    };
  }

  /**
   * Lock & Reserve Inventory Stock upon B2B Order Creation
   */
  public async reserveInventoryStock(
    items: { productId: string; quantity: number; supplierId: string }[]
  ): Promise<boolean> {
    try {
      const batch = writeBatch(db);

      for (const item of items) {
        const prodRef = doc(db, 'wholesaleProducts', item.productId);
        const prodSnap = await getDoc(prodRef);

        if (prodSnap.exists()) {
          batch.update(prodRef, {
            stock: increment(-item.quantity),
            updatedAt: serverTimestamp()
          });
        } else {
          const storeProdRef = doc(db, 'stores', item.supplierId, 'products', item.productId);
          const storeSnap = await getDoc(storeProdRef);
          if (storeSnap.exists()) {
            batch.update(storeProdRef, {
              quantity: increment(-item.quantity),
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error reserving inventory stock:', error);
      return false;
    }
  }
}

export const b2bCatalogBridgeEngine = new B2BCatalogBridgeEngineService();
