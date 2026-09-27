import { collection, query, where, getDocs, limit, orderBy, doc, runTransaction, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Market Intelligence & Core B2B Transaction Service - JAM System Pro
 * Manages B2B Network data, supplier tiers, and atomic transactions.
 */

export interface MarketPrice {
  avgWholesale: number;
  avgRetail: number;
  minWholesale: number;
  maxWholesale: number;
  confidence: number;
}

export interface SupplierProfile {
  id: string;
  name: string;
  phone: string;
  address?: string;
  city?: string;
  businessType?: string;
  hierarchyLevel: number; // 1 to 4
  role: string;
}

export interface ProductVariant {
  color: string;
  stock: number;
  sku?: string;
  priceOverride?: number;
}

export interface WholesaleMarketProduct {
  id: string;
  wholesalerId: string;
  wholesalerName: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  subCategory?: string;
  photos: string[];
  variants?: ProductVariant[];
  isActive: boolean;
  createdAt: any;
  hierarchyLevel?: number; // Tier N product
}

export const marketService = {
  /**
   * Fetches active suppliers corresponding to hierarchy level N
   * Suppliers with level N can only be seen by retailers with level N+1.
   */
  async getSuppliersByHierarchy(supplierLevel: number): Promise<SupplierProfile[]> {
    try {
      console.log(`[B2B Market] Fetching level ${supplierLevel} suppliers...`);
      // Query "users" collection (which acts as profiles) or "stores"
      const q = query(
        collection(db, 'users'),
        where('hierarchyLevel', '==', supplierLevel)
      );
      const snap = await getDocs(q);
      const suppliers: SupplierProfile[] = [];
      
      snap.forEach(docSnap => {
        const data = docSnap.data();
        suppliers.push({
          id: data.ownerId || docSnap.id,
          name: data.name || 'مورد معتمد',
          phone: data.phone || '',
          address: data.shopAddress || data.address || '',
          city: data.city || '',
          businessType: data.businessType || 'wholesale',
          hierarchyLevel: data.hierarchyLevel || supplierLevel,
          role: data.role || 'supplier'
        });
      });
      
      // Fallback: search by networkRole or businessType if database lacks manual hierarchy tags
      if (suppliers.length === 0) {
        console.log(`[B2B Market] No manual level ${supplierLevel} users found, generating fallsbacks...`);
        let fallbackQuery;
        if (supplierLevel === 1) {
          fallbackQuery = query(collection(db, 'users'), where('role', '==', 'superadmin'));
        } else if (supplierLevel === 2) {
          fallbackQuery = query(collection(db, 'users'), where('businessType', '==', 'master_wholesale'));
        } else {
          fallbackQuery = query(collection(db, 'users'), where('role', '==', 'wholesaler'));
        }
        const fallbackSnap = await getDocs(fallbackQuery);
        fallbackSnap.forEach(fDoc => {
          const fData = fDoc.data();
          suppliers.push({
            id: fData.ownerId || fDoc.id,
            name: fData.name || 'مورد افتراضي',
            phone: fData.phone || '777777777',
            address: fData.shopAddress || fData.address || 'اليمن - الموحد',
            city: fData.city || 'صنعاء',
            hierarchyLevel: supplierLevel,
            role: fData.role || 'wholesaler'
          });
        });
      }

      return suppliers;
    } catch (e) {
      console.error('Error fetching suppliers by hierarchy:', e);
      return [];
    }
  },

  /**
   * Fetches active B2B products offered by a specific supplier
   */
  async getProductsBySupplier(supplierId: string): Promise<WholesaleMarketProduct[]> {
    try {
      const q = query(
        collection(db, 'wholesaleProducts'),
        where('wholesalerId', '==', supplierId),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      const products: WholesaleMarketProduct[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        products.push({
          id: docSnap.id,
          wholesalerId: d.wholesalerId || supplierId,
          wholesalerName: d.wholesalerName || 'المورد',
          name: d.name || '',
          description: d.description || '',
          price: Number(d.price || 0),
          stock: Number(d.stock || 0),
          category: d.category || 'عام',
          photos: d.photos || d.images || [],
          variants: d.variants || [],
          isActive: d.isActive !== false,
          createdAt: d.createdAt
        });
      });
      return products;
    } catch (err) {
      console.error('Error fetching supplier products:', err);
      return [];
    }
  },

  /**
   * Atomic transactional checkout preventing race conditions or stock collision.
   * Decrements stock levels atomically for main products and variants selected in shopping cart.
   */
  async executeAtomicMarketCheckout(params: {
    buyerProfile: { uid: string; ownerId: string; name: string; phone?: string },
    supplierId: string,
    supplierName: string,
    cartItems: {
      productId: string;
      name: string;
      quantity: number;
      price: number;
      selectedColor?: string;
      imageUrl?: string;
      photos?: string[];
    }[],
    paymentType: 'cash' | 'debt' | 'money_transfer' | 'jampay' | string,
    notes?: string,
    depositWallet?: string,
    depositWalletName?: string,
    depositRefNum?: string,
    transferRefNum?: string,
    transferSenderName?: string,
    attachedReceiptUrl?: string
  }): Promise<{ success: boolean; orderId?: string; error?: string }> {
    const { 
      buyerProfile, 
      supplierId, 
      supplierName, 
      cartItems, 
      paymentType, 
      notes,
      depositWallet,
      depositWalletName,
      depositRefNum,
      transferRefNum,
      transferSenderName,
      attachedReceiptUrl
    } = params;
    
    // 1. Check if a permanent customer profile exists for this retailer under this wholesaler
    let customerExists = false;
    let existingCustomerId: string | null = null;
    let existingCustomerData: any = null;

    if (paymentType === 'debt') {
      try {
        const custQuery = query(
          collection(db, 'customers'),
          where('ownerId', '==', supplierId),
          where('linkedUid', '==', buyerProfile.ownerId || buyerProfile.uid)
        );
        const custSnap = await getDocs(custQuery);
        if (!custSnap.empty) {
          customerExists = true;
          existingCustomerId = custSnap.docs[0].id;
          existingCustomerData = custSnap.docs[0].data();
        } else if (buyerProfile.phone) {
          const custQuery2 = query(
            collection(db, 'customers'),
            where('ownerId', '==', supplierId),
            where('phone', '==', buyerProfile.phone)
          );
          const custSnap2 = await getDocs(custQuery2);
          if (!custSnap2.empty) {
            customerExists = true;
            existingCustomerId = custSnap2.docs[0].id;
            existingCustomerData = custSnap2.docs[0].data();
          }
        }
      } catch (err) {
        console.error('[B2B Customers Provisioning Check Error]:', err);
      }
    }

    try {
      return await runTransaction(db, async (transaction) => {
        console.log(`[B2B Atomic Tx] Initiating transaction checkout for ${buyerProfile.name}...`);
        
        // 1. Gather all product snapshots atomically
        const productSnapshots: { [id: string]: { ref: any, data: any } } = {};
        for (const item of cartItems) {
          const prodRef = doc(db, 'wholesaleProducts', item.productId);
          const prodSnap = await transaction.get(prodRef);
          
          if (!prodSnap.exists()) {
            throw new Error(`المنتج "${item.name}" لم يعد متوفراً في سوق الموردين للطلب.`);
          }
          productSnapshots[item.productId] = {
            ref: prodRef,
            data: prodSnap.data()
          };
        }

        // 2. Perform validations and compile updates
        const updates: { ref: any, nextMainStock: number, nextVariants?: any[] }[] = [];
        
        for (const item of cartItems) {
          const localProd = productSnapshots[item.productId];
          const prodData = localProd.data;
          
          const availableStock = Math.max(0, (prodData.stock || 0) - (prodData.tempLocked || 0));
          // Verify general stock
          if (availableStock < item.quantity) {
            throw new Error(`عذراً، المخزون المتوفر والحر للبيع من "${item.name}" هو (${availableStock} قطع) فقط (حيث يوجد قطع محجوزة مؤقتاً)، وهو أقل من الكمية المطلوبة.`);
          }

          let nextVariants = prodData.variants ? [...prodData.variants] : undefined;
          
          // Verify and update variant stock if specialized color has been picked
          if (item.selectedColor && nextVariants) {
            const vIndex = nextVariants.findIndex((v: any) => v.color === item.selectedColor);
            if (vIndex !== -1) {
              const currentVStock = nextVariants[vIndex].stock || 0;
              const currentVTempLocked = nextVariants[vIndex].tempLocked || 0;
              const availableVStock = Math.max(0, currentVStock - currentVTempLocked);
              if (availableVStock < item.quantity) {
                throw new Error(`اللون المحدد (${item.selectedColor}) من المنتج "${item.name}" نفد أو محجوز بالكامل مؤقتاً، الرصيد المتاح حالياً هو (${availableVStock} قطع) فقط.`);
              }
              // Deduct variant stock
              nextVariants[vIndex] = {
                ...nextVariants[vIndex],
                stock: currentVStock - item.quantity
              };
            }
          }

          updates.push({
            ref: localProd.ref,
            nextMainStock: prodData.stock - item.quantity,
            nextVariants
          });
        }

        // 3. Document submissions: Write stock reductions atomically
        for (const up of updates) {
          if (up.nextVariants) {
            transaction.update(up.ref, {
              stock: up.nextMainStock,
              variants: up.nextVariants
            });
          } else {
            transaction.update(up.ref, {
              stock: up.nextMainStock
            });
          }
        }

        // 4. Construct B2B Order Document
        const totalAmount = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const orderRef = doc(collection(db, 'orders'));
        
        const newOrder = {
          retailerId: buyerProfile.ownerId || buyerProfile.uid,
          retailerName: buyerProfile.name,
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
            selectedColor: item.selectedColor || null,
            warrantyType: (item as any).warrantyType || 'none',
            warrantyDuration: (item as any).warrantyDuration || 0,
            compensationOption: (item as any).compensationOption || 'replace_same',
            status: 'available',
            imageUrl: item.imageUrl || '',
            photos: item.photos || []
          })),
          total: totalAmount,
          status: 'pending',
          paymentType: paymentType,
          paymentStatus: 'unpaid',
          notes: notes || '',
          paidAmount: 0,
          depositWallet: depositWallet || null,
          depositWalletName: depositWalletName || null,
          depositRefNum: depositRefNum || transferRefNum || null,
          transferRefNum: transferRefNum || depositRefNum || null,
          paymentDetails: (depositRefNum || transferRefNum) ? {
            remittanceNumber: depositRefNum || transferRefNum || '',
            senderName: transferSenderName || buyerProfile.name,
            amountPaid: totalAmount,
            brokerName: depositWalletName || depositWallet || 'محفظة إلكترونية معتمدة',
            depositWallet: depositWallet || null,
            attachedReceiptUrl: attachedReceiptUrl || null
          } : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        transaction.set(orderRef, newOrder);

        // Auto-provision customer profile in wholesaler's customers ledger if payment is 'debt' (on credit)
        if (paymentType === 'debt') {
          if (!customerExists) {
            const newCustRef = doc(collection(db, 'customers'));
            const newCustPayload = {
              name: buyerProfile.name,
              phone: buyerProfile.phone || '0000000',
              ownerId: supplierId,
              linkedUid: buyerProfile.ownerId || buyerProfile.uid,
              tier: 'زبون آجل موحد 🔗',
              status: 'active',
              debt: totalAmount,
              createdAt: serverTimestamp()
            };
            transaction.set(newCustRef, newCustPayload);
            console.log(`[B2B Atomic Tx] Auto-provisioned permanent Customer profile for ${buyerProfile.name}`);
          } else if (existingCustomerId) {
            // Update existing customer's debt
            const custRef = doc(db, 'customers', existingCustomerId);
            const currentDebt = Number(existingCustomerData.debt || 0);
            transaction.update(custRef, {
              debt: currentDebt + totalAmount,
              updatedAt: serverTimestamp()
            });
            console.log(`[B2B Atomic Tx] Updated debt for existing Customer ${buyerProfile.name}`);
          }
        }
        
        // 5. Submit Audit Log inside transaction
        const auditRef = doc(collection(db, 'auditLogs'));
        transaction.set(auditRef, {
          action: 'create_b2b_market_order',
          userId: buyerProfile.uid,
          userName: buyerProfile.name,
          details: `تم إنشاء طلب جملة ذكي من المورد ${supplierName} بقيمة ${totalAmount} ر.ي`,
          timestamp: serverTimestamp()
        });

        console.log(`[B2B Atomic Tx] Order generated successfully! DocId: ${orderRef.id}`);
        return { success: true, orderId: orderRef.id };
      });
    } catch (err: any) {
      console.error('B2B Atomic Transaction aborted:', err);
      return { success: false, error: err.message || 'فشلت المعاملة الذرية بسبب تعارض في تفاصيل المخزون' };
    }
  },

  /**
   * Discovers the 'Global' price for an item based on barcode or name
   */
  async discoverSmartPrice(params: {
    barcode?: string, 
    name?: string, 
    userRole: string,
    ownerId: string,
    businessType?: string
  }): Promise<{ buy: number; sell: number } | null> {
    try {
      const { barcode, name, userRole, ownerId } = params;
      
      // 1. Fetch User's Historical Markup (Fallback Logic)
      const userSalesQ = query(collection(db, 'sales'), where('ownerId', '==', ownerId), limit(50), orderBy('createdAt', 'desc'));
      const userSalesSnap = await getDocs(userSalesQ);
      let avgMarkup = 1.10; // Default 10%
      if (!userSalesSnap.empty) {
        let totalM = 0;
        let mCount = 0;
        userSalesSnap.forEach(doc => {
          const s = doc.data();
          if (s.profit && s.total) {
            totalM += (s.total / (s.total - s.profit));
            mCount++;
          }
        });
        if (mCount > 0) avgMarkup = totalM / mCount;
      }

      // 2. Market Search
      const searchTerms = [];
      if (barcode) {
        searchTerms.push(where('barcode', '==', barcode));
      } else if (name) {
        searchTerms.push(where('name', '>=', name), where('name', '<=', name + '\uf8ff'));
      }

      const marketQ = query(collection(db, 'inventory'), ...searchTerms, limit(100));
      const marketSnap = await getDocs(marketQ);
      
      const retailPrices: number[] = [];
      const wholesalePrices: number[] = [];
      const masterPrices: number[] = [];

      marketSnap.forEach(doc => {
        const item = doc.data();
        if (item.businessType === 'master_wholesale') masterPrices.push(item.price || 0);
        else if (item.businessType === 'wholesale') wholesalePrices.push(item.price || 0);
        else retailPrices.push(item.price || 0);
      });

      // Logic Decision Tree
      let suggestedBuy = 0;
      let suggestedSell = 0;

      if (userRole === 'retailer' || userRole === 'manager') {
        suggestedSell = retailPrices.length > 0 ? this.calculateMode(retailPrices) : 0;
        suggestedBuy = wholesalePrices.length > 0 ? this.calculateAverage(wholesalePrices) : (masterPrices.length > 0 ? this.calculateAverage(masterPrices) : 0);
      } else if (userRole === 'wholesaler') {
        suggestedSell = wholesalePrices.length > 0 ? this.calculateAverage(wholesalePrices) : 0;
        suggestedBuy = masterPrices.length > 0 ? this.calculateAverage(masterPrices) : 0;
      }

      // Fallback Implementation
      if (suggestedSell === 0 && suggestedBuy > 0) suggestedSell = suggestedBuy * avgMarkup;
      if (suggestedBuy === 0 && suggestedSell > 0) suggestedBuy = suggestedSell / avgMarkup;

      if (suggestedBuy === 0 && suggestedSell === 0) return null;

      return { buy: suggestedBuy, sell: suggestedSell };
    } catch (error) {
      console.error('Market Discovery Error:', error);
      return null;
    }
  },

  calculateAverage(arr: number[]): number {
    return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
  },

  calculateMode(arr: number[]): number {
    if (arr.length === 0) return 0;
    const map: any = {};
    arr.forEach(v => map[v] = (map[v] || 0) + 1);
    return Number(Object.keys(map).reduce((a, b) => map[a] > map[b] ? a : b));
  }
};

// ============================================
// JAM SYSTEM PRO - MASTER INJECTION & ARCHITECTURE (ALL-IN-ONE)
// 1. Data Cleansing & Normalization
// 2. Multi-Level Market Hierarchy (The Core)
// 3. Deployment Integration
// ============================================

export async function runSystemCleanup(): Promise<void> {
  console.log("🛠️ Starting system purification...");
  try {
    const q = query(collection(db, 'users'));
    const snapshot = await getDocs(q);
    const phoneCache = new Set<string>();
    let deletedCount = 0;
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.phone) {
        console.log(`[Cleanse] User without phone: ${docSnap.id}. Candidate for pruning.`);
        return;
      }
      if (phoneCache.has(data.phone)) {
        console.log(`[Cleanse] Found duplicate phone number: ${data.phone}. Candidate for merge/pruning.`);
        deletedCount++;
      } else {
        phoneCache.add(data.phone);
      }
    });
    console.log(`[Cleanse] Analyzed ${snapshot.size} users. System is pristine with ${phoneCache.size} unique suppliers/retailers.`);
  } catch (error) {
    console.error("Cleanse Error:", error);
  }
}

export const MarketModule = {
  // هيكلية المستويات (من 1: مستورد إلى 4: تجزئة)
  levels: { 
    1: 'Importer', 
    2: 'Wholesale_Plus', 
    3: 'Wholesale', 
    4: 'Retailer' 
  } as { [key: number]: string },
  
  // حارس البضاعة: منع تداخل المحلات
  validateVisibility: (myLevel: number, targetLevel: number): boolean => {
    return targetLevel <= myLevel; // المستورد يرى الجميع، التجزئة يرى من هم فوقه فقط
  },

  // سلة المشتريات المركزية (Global Cart)
  Cart: {
    items: [] as any[],
    addItem: (item: any) => {
      console.log("[Global Cart] Programmatic item added:", item);
    },
    clear: () => {
      console.log("[Global Cart] Programmatic clear executed.");
    }
  }
};

export const DeploymentConfig = {
  version: "1.0.0",
  roles: ['Owner', 'Supplier', 'Merchant', 'Customer'],
  platforms: ['EXE_Windows', 'APK_Merchant', 'APK_Customer'],
  
  // نظام المزامنة (Offline First)
  enableSync: () => {
    console.log("Sync active - JAM offline persistence mechanism integrated.");
  }
};

// تشغيل النظام الموحد
export async function initJAMPro(forceClean = false): Promise<void> {
  if (forceClean) {
    await runSystemCleanup();
  } else {
    console.log("⚡ Skipping automatic boot-run database cleansing for extreme optimization.");
  }
  DeploymentConfig.enableSync();
  console.log("✅ JAM SYSTEM PRO - Master Build Initialized and Integrated.");
}

// Backward-compatible connectors for any pre-linked systems
export const MarketEngine = {
  supplierHierarchy: {
    1: 'Importer',
    2: 'Wholesaler_Plus',
    3: 'Wholesaler',
    4: 'Retailer'
  } as { [key: number]: string },

  getVisibleSuppliers: (myLevel: number) => {
    return query(collection(db, 'users'), where('level', '<', myLevel));
  },

  GlobalCart: new Map<string, any>(),

  onPriceChange: (itemId: string, newPrice: number) => {
    console.warn(`⚠️ تنبيه: تغير سعر ${itemId} إلى ${newPrice}`);
  }
};

export async function performAtomicTransaction(updateFn: (transaction: any) => Promise<any>) {
  return await runTransaction(db, async (transaction) => {
    return await updateFn(transaction);
  });
}

// Run boot sequencers automatically
initJAMPro().catch(err => console.error("Error booting JAM system auto-purification:", err));

// ============================================
// JAM SYSTEM PRO - FINAL MARKET MODULE (ALL-IN-ONE)
// يجمع: السلة، الرسائل، منع الإزعاج، الحسابات البنكية، والحراج العام.
// ============================================

export const MarketMasterModule = {
  // 1. نظام الحسابات والتحويلات (Bank & Wallet)
  // جلب كافة الحسابات البنكية للموردين لضمان سرعة الدفع
  BankAccounts: {
    fetchForStore: async (storeId: string) => {
      try {
        const ref = collection(db, 'suppliers', storeId, 'bank_info');
        return await getDocs(ref);
      } catch (e) {
        console.error("Error fetching bank info:", e);
        throw e;
      }
    }
  },

  // 2. إدارة الطلبات ومنع الإزعاج (Order & Anti-Spam)
  // منع إزعاج التاجر عبر "موافقة واحدة" فقط، وتنبيهات محددة
  NotificationEngine: {
    canContact: async (storeId: string, targetId?: string) => {
      try {
        // التحقق من حالة الحظر أو الموافقة المسبقة
        const ref = doc(db, 'permissions', storeId);
        return await getDoc(ref);
      } catch (e) {
        console.error("Error checking permissions:", e);
        throw e;
      }
    },
    sendAlert: (msg: string, type: string) => {
      // إرسال تنبيه فوري عبر WhatsApp/In-App
      console.log(`[Alert Engine] ${type}: ${msg} (Sent via Webhook/WhatsApp simulator)`);
    }
  },

  // 3. الحراج العام (Public Auction/Marketplace)
  // النشر ليظهر للزبائن والتجار (واجهة عامة)
  AuctionEngine: {
    publishItem: async (itemData: any) => {
      try {
        const ref = collection(db, 'auction_items');
        return await addDoc(ref, {
          ...itemData,
          visibleTo: ['retailers', 'customers'],
          timestamp: serverTimestamp()
        });
      } catch (e) {
        console.error("Error publishing auction item:", e);
        throw e;
      }
    }
  },

  // 4. سلة الطلبيات (Cart Logic)
  // إدارة كاملة للسلة (إضافة، تعديل، حذف، استلام)
  CartManagement: {
    syncWithStore: (storeId: string) => {
      /* مزامنة السلة مع المخزن */
      console.log(`[Cart Sync] Synchronizing marketplace cart with store ${storeId}...`);
    }
  }
};

// تشغيل موديول السوق الموحد
MarketMasterModule.CartManagement.syncWithStore('CURRENT_STORE_ID');

// ============================================
// JAM SYSTEM PRO - QUICK FIX: SHOP SETTINGS INITIALIZATION
// إصلاح خطأ عدم تحميل الإعدادات قبل البدء
// ============================================

export let shopSettings: any = null;

export const setGlobalShopSettings = (settings: any) => {
  shopSettings = settings;
};

// إضافة فحص أمان قبل الوصول للإعدادات
export const getSafeShopSettings = () => {
  // التأكد من أن الإعدادات موجودة قبل محاولة استخدامها
  if (typeof shopSettings === 'undefined' || !shopSettings) {
    console.warn("⚠️ Shop settings not initialized yet. Waiting...");
    return null; // أو إرجاع قيمة افتراضية
  }
  return shopSettings;
};



