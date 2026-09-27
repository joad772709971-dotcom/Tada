import { 
  doc, 
  runTransaction, 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * INVENTORY ROW LOCKING SERVICE (MISSION CORE SECURE COMPONENT)
 * Absolute transaction isolation for Warehouse Prep and Return Testing.
 * Uses Firebase Firestore Transactions to prevent race conditions or double allocation.
 */
export const InventoryLockingService = {

  /**
   * LOCK: Enters Warehouse Prep (غرفة التجهيز) or Return Testing (قيد الفحص والمطابقة)
   * Increments 'tempLocked' of the product and corresponding variant in the Master Catalog & B2B Marketplace.
   */
  async lockInventory(params: {
    ownerId: string;
    items: {
      productId: string;
      quantity: number;
      selectedColor?: string;
    }[];
    sourceType: 'prep' | 'return_testing';
    referenceId: string;
  }): Promise<{ success: boolean; message: string }> {
    const { ownerId, items, sourceType, referenceId } = params;

    try {
      await runTransaction(db, async (transaction) => {
        console.log(`[InventoryLocking - TRANSACTION START] Locking for ${sourceType}, ref: ${referenceId}`);

        for (const item of items) {
          if (!item.productId) continue;

          // 1. Fetch & Lock Root Inventory document
          const rootInvRef = doc(db, 'inventory', item.productId);
          const rootSnap = await transaction.get(rootInvRef);

          if (rootSnap.exists()) {
            const currentTempLocked = Number(rootSnap.data().tempLocked || 0);
            transaction.update(rootInvRef, {
              tempLocked: currentTempLocked + item.quantity,
              updatedAt: new Date()
            });
            console.log(`[InventoryLocking] Locked ${item.quantity} in root inventory for product ${item.productId}`);
          }

          // 2. Fetch & Lock Stores Sub-collection Inventory document
          const storeInvRef = doc(db, 'stores', ownerId, 'inventory', item.productId);
          const storeSnap = await transaction.get(storeInvRef);
          if (storeSnap.exists()) {
            const currentTempLocked = Number(storeSnap.data().tempLocked || 0);
            transaction.update(storeInvRef, {
              tempLocked: currentTempLocked + item.quantity,
              updatedAt: new Date()
            });
          }

          // 3. Fetch & Lock public B2B marketplace catalog document (wholesaleProducts)
          const wpRef = doc(db, 'wholesaleProducts', item.productId);
          const wpSnap = await transaction.get(wpRef);
          if (wpSnap.exists()) {
            const wpData = wpSnap.data();
            const currentWPTempLocked = Number(wpData.tempLocked || 0);
            const updates: any = {
              tempLocked: currentWPTempLocked + item.quantity,
              updatedAt: new Date()
            };

            // Lock specialized variant if color is selected
            if (item.selectedColor && wpData.variants) {
              const updatedVariants = wpData.variants.map((v: any) => {
                if (v.color === item.selectedColor) {
                  return {
                    ...v,
                    tempLocked: Number(v.tempLocked || 0) + item.quantity
                  };
                }
                return v;
              });
              updates.variants = updatedVariants;
            }

            transaction.update(wpRef, updates);
            console.log(`[InventoryLocking] Locked ${item.quantity} in B2B wholesaleProducts for product ${item.productId}`);
          }
        }
      });

      return { success: true, message: 'تم تجميد وحجز رصيد السلع بنجاح بعزل تام لقاعدة البيانات.' };
    } catch (error: any) {
      console.error('[InventoryLocking Error]:', error);
      return { success: false, message: error.message || 'فشل حجز وتأمين الأصناف.' };
    }
  },

  /**
   * RELEASE: Reverts or releases the lock without final consumption (e.g. Cancelled, Rejected, or Defective)
   * Decrements 'tempLocked' back to original.
   */
  async releaseInventoryLock(params: {
    ownerId: string;
    items: {
      productId: string;
      quantity: number;
      selectedColor?: string;
    }[];
    referenceId: string;
  }): Promise<{ success: boolean; message: string }> {
    const { ownerId, items, referenceId } = params;

    try {
      await runTransaction(db, async (transaction) => {
        console.log(`[InventoryLocking - TRANSACTION START] Releasing lock, ref: ${referenceId}`);

        for (const item of items) {
          if (!item.productId) continue;

          // 1. Root Inventory release
          const rootInvRef = doc(db, 'inventory', item.productId);
          const rootSnap = await transaction.get(rootInvRef);
          if (rootSnap.exists()) {
            const currentTempLocked = Number(rootSnap.data().tempLocked || 0);
            transaction.update(rootInvRef, {
              tempLocked: Math.max(0, currentTempLocked - item.quantity),
              updatedAt: new Date()
            });
          }

          // 2. Sub-collection Inventory release
          const storeInvRef = doc(db, 'stores', ownerId, 'inventory', item.productId);
          const storeSnap = await transaction.get(storeInvRef);
          if (storeSnap.exists()) {
            const currentTempLocked = Number(storeSnap.data().tempLocked || 0);
            transaction.update(storeInvRef, {
              tempLocked: Math.max(0, currentTempLocked - item.quantity),
              updatedAt: new Date()
            });
          }

          // 3. Wholesale products release
          const wpRef = doc(db, 'wholesaleProducts', item.productId);
          const wpSnap = await transaction.get(wpRef);
          if (wpSnap.exists()) {
            const wpData = wpSnap.data();
            const currentWPTempLocked = Number(wpData.tempLocked || 0);
            const updates: any = {
              tempLocked: Math.max(0, currentWPTempLocked - item.quantity),
              updatedAt: new Date()
            };

            if (item.selectedColor && wpData.variants) {
              const updatedVariants = wpData.variants.map((v: any) => {
                if (v.color === item.selectedColor) {
                  return {
                    ...v,
                    tempLocked: Math.max(0, Number(v.tempLocked || 0) - item.quantity)
                  };
                }
                return v;
              });
              updates.variants = updatedVariants;
            }

            transaction.update(wpRef, updates);
            console.log(`[InventoryLocking] Released ${item.quantity} in B2B wholesaleProducts for product ${item.productId}`);
          }
        }
      });

      return { success: true, message: 'تم فك الحجز وإلغاء تجميد السلع بأمان تام.' };
    } catch (error: any) {
      console.error('[InventoryLocking Release Error]:', error);
      return { success: false, message: error.message || 'فشل فك حجز السلع.' };
    }
  },

  /**
   * PERMANENT CONVERT: Transitions locked units to active/deducted state (Order prep completed)
   * Decrements both 'stock' and 'tempLocked' by the prepped quantity.
   */
  async finalizeConsumption(params: {
    ownerId: string;
    items: {
      productId: string;
      quantity: number;
      selectedColor?: string;
    }[];
    referenceId: string;
  }): Promise<{ success: boolean; message: string }> {
    const { ownerId, items, referenceId } = params;

    try {
      await runTransaction(db, async (transaction) => {
        console.log(`[InventoryLocking - TRANSACTION START] Finalizing consumption for ref: ${referenceId}`);

        for (const item of items) {
          if (!item.productId) continue;

          // 1. Root Inventory update
          const rootInvRef = doc(db, 'inventory', item.productId);
          const rootSnap = await transaction.get(rootInvRef);
          if (rootSnap.exists()) {
            const rootData = rootSnap.data();
            const currentStock = Number(rootData.stock || 0);
            const currentTempLocked = Number(rootData.tempLocked || 0);

            transaction.update(rootInvRef, {
              stock: Math.max(0, currentStock - item.quantity),
              tempLocked: Math.max(0, currentTempLocked - item.quantity),
              updatedAt: new Date()
            });
          }

          // 2. Sub-collection Inventory update
          const storeInvRef = doc(db, 'stores', ownerId, 'inventory', item.productId);
          const storeSnap = await transaction.get(storeInvRef);
          if (storeSnap.exists()) {
            const storeData = storeSnap.data();
            const currentStock = Number(storeData.stock || 0);
            const currentTempLocked = Number(storeData.tempLocked || 0);

            transaction.update(storeInvRef, {
              stock: Math.max(0, currentStock - item.quantity),
              tempLocked: Math.max(0, currentTempLocked - item.quantity),
              updatedAt: new Date()
            });
          }

          // 3. Wholesale products update
          const wpRef = doc(db, 'wholesaleProducts', item.productId);
          const wpSnap = await transaction.get(wpRef);
          if (wpSnap.exists()) {
            const wpData = wpSnap.data();
            const currentStock = Number(wpData.stock || 0);
            const currentTempLocked = Number(wpData.tempLocked || 0);

            const updates: any = {
              stock: Math.max(0, currentStock - item.quantity),
              tempLocked: Math.max(0, currentTempLocked - item.quantity),
              updatedAt: new Date()
            };

            if (item.selectedColor && wpData.variants) {
              const updatedVariants = wpData.variants.map((v: any) => {
                if (v.color === item.selectedColor) {
                  const currentVStock = Number(v.stock || 0);
                  const currentVTempLocked = Number(v.tempLocked || 0);
                  return {
                    ...v,
                    stock: Math.max(0, currentVStock - item.quantity),
                    tempLocked: Math.max(0, currentVTempLocked - item.quantity)
                  };
                }
                return v;
              });
              updates.variants = updatedVariants;
            }

            transaction.update(wpRef, updates);
            console.log(`[InventoryLocking] Consumed and released ${item.quantity} in B2B wholesaleProducts for product ${item.productId}`);
          }
        }
      });

      return { success: true, message: 'تم ترحيل وخصم الكميات المحجوزة نهائياً بنجاح.' };
    } catch (error: any) {
      console.error('[InventoryLocking Finalize Error]:', error);
      return { success: false, message: error.message || 'فشل الخصم النهائي للسلع.' };
    }
  },

  /**
   * PERMANENT ADD TO STOCK: Re-shelves tested return units into active stock
   * Increments 'stock' and decrements 'tempLocked'.
   */
  async finalizeReturnToActive(params: {
    ownerId: string;
    items: {
      productId: string;
      quantity: number;
      selectedColor?: string;
    }[];
    referenceId: string;
  }): Promise<{ success: boolean; message: string }> {
    const { ownerId, items, referenceId } = params;

    try {
      await runTransaction(db, async (transaction) => {
        console.log(`[InventoryLocking - TRANSACTION START] Finalizing return to active stock for ref: ${referenceId}`);

        for (const item of items) {
          if (!item.productId) continue;

          // 1. Root Inventory update
          const rootInvRef = doc(db, 'inventory', item.productId);
          const rootSnap = await transaction.get(rootInvRef);
          if (rootSnap.exists()) {
            const rootData = rootSnap.data();
            const currentStock = Number(rootData.stock || 0);
            const currentTempLocked = Number(rootData.tempLocked || 0);

            transaction.update(rootInvRef, {
              stock: currentStock + item.quantity,
              tempLocked: Math.max(0, currentTempLocked - item.quantity),
              updatedAt: new Date()
            });
          }

          // 2. Sub-collection Inventory update
          const storeInvRef = doc(db, 'stores', ownerId, 'inventory', item.productId);
          const storeSnap = await transaction.get(storeInvRef);
          if (storeSnap.exists()) {
            const storeData = storeSnap.data();
            const currentStock = Number(storeData.stock || 0);
            const currentTempLocked = Number(storeData.tempLocked || 0);

            transaction.update(storeInvRef, {
              stock: currentStock + item.quantity,
              tempLocked: Math.max(0, currentTempLocked - item.quantity),
              updatedAt: new Date()
            });
          }

          // 3. Wholesale products update
          const wpRef = doc(db, 'wholesaleProducts', item.productId);
          const wpSnap = await transaction.get(wpRef);
          if (wpSnap.exists()) {
            const wpData = wpSnap.data();
            const currentStock = Number(wpData.stock || 0);
            const currentTempLocked = Number(wpData.tempLocked || 0);

            const updates: any = {
              stock: currentStock + item.quantity,
              tempLocked: Math.max(0, currentTempLocked - item.quantity),
              updatedAt: new Date()
            };

            if (item.selectedColor && wpData.variants) {
              const updatedVariants = wpData.variants.map((v: any) => {
                if (v.color === item.selectedColor) {
                  const currentVStock = Number(v.stock || 0);
                  const currentVTempLocked = Number(v.tempLocked || 0);
                  return {
                    ...v,
                    stock: currentVStock + item.quantity,
                    tempLocked: Math.max(0, currentVTempLocked - item.quantity)
                  };
                }
                return v;
              });
              updates.variants = updatedVariants;
            }

            transaction.update(wpRef, updates);
            console.log(`[InventoryLocking] Re-shelved and released ${item.quantity} in B2B wholesaleProducts for product ${item.productId}`);
          }
        }
      });

      return { success: true, message: 'تم نقل بنود المرتجع المقبولة إلى الرفوف والمخزون النشط بنجاح.' };
    } catch (error: any) {
      console.error('[InventoryLocking Return Finalize Error]:', error);
      return { success: false, message: error.message || 'فشل خصم النهائي للسلع.' };
    }
  }
};
