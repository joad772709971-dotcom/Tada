import { 
  doc, 
  writeBatch, 
  increment, 
  serverTimestamp, 
  collection, 
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';

export enum OrderStatus {
  Pending = 'pending',
  Preparing = 'prepping',
  ReadyTracked = 'ready',
  Completed = 'received'
}

export enum PaymentMethod {
  MainDrawer = 'MainDrawer',
  SubBank = 'SubBank',
  OwnerWallet = 'OwnerWallet'
}

export interface EngineLog {
  id: string;
  timestamp: any;
  engineType: 'inventory' | 'cashier' | 'purchase';
  message: string;
  details: string;
  amount?: number;
  quantity?: number;
}

export const InventoryAndCashEngine = {

  // =========================================================================
  // 1. محرك معالجة المخزن عند تجهيز الطلبيات والنواقص (ProcessStockOnStatusChange)
  // =========================================================================
  async processStockOnStatusChange(
    itemId: string,
    quantity: number,
    newStatus: OrderStatus,
    warehouseId: string = 'المستودع الرئيسي',
    ownerId: string
  ): Promise<string> {
    // تشغيل العمليات الكثيفة في الخلفية بشكل غير متزامن لتجنب تجميد الواجهة تفاعلياً
    setTimeout(async () => {
      try {
        const batch = writeBatch(db);
        const itemRef = doc(db, 'inventory', itemId);
        const itemSnap = await getDoc(itemRef);

        if (!itemSnap.exists()) {
          console.warn(`⚠️ [InventoryEngine]: Item not found: ${itemId}`);
          return;
        }

        const currentData = itemSnap.data();
        const itemName = currentData.name || 'صنف غير معروف';
        let logMessage = '';
        let logDetails = '';

        if (newStatus === OrderStatus.Preparing) {
          const reservedWarehouseKey = `reserved_warehouses.${warehouseId}`;
          
          batch.update(itemRef, {
            reservedStock: increment(quantity),
            [reservedWarehouseKey]: increment(quantity),
            updatedAt: serverTimestamp()
          });

          logMessage = `[المخزن] تم حجز ${quantity} قطع من الصنف "${itemName}" في المخزن: "${warehouseId}".`;
          logDetails = `حجز مؤقت لتجنب البيع المزدوج لحين تجهيز الطلبية بالكامل.`;
        } 
        else if (newStatus === OrderStatus.Completed) {
          const reservedWarehouseKey = `reserved_warehouses.${warehouseId}`;
          const warehouseKey = `warehouses.${warehouseId}`;

          batch.update(itemRef, {
            stock: increment(-quantity),
            [warehouseKey]: increment(-quantity),
            reservedStock: increment(-quantity),
            [reservedWarehouseKey]: increment(-quantity),
            updatedAt: serverTimestamp()
          });

          logMessage = `[المخزن] تم الخصم النهائي لـ ${quantity} قطع من الصنف "${itemName}" في المخزن: "${warehouseId}".`;
          logDetails = `تم قيد الشحن الفعلي للطلب المجهز بالكامل وأطلق رصيد الحجز المسبق بنجاح.`;
        }

        if (logMessage) {
          const logRef = doc(collection(db, 'engine_logs'));
          batch.set(logRef, {
            ownerId,
            engineType: 'inventory',
            message: logMessage,
            details: logDetails,
            quantity,
            timestamp: serverTimestamp()
          });

          await batch.commit();
        }
      } catch (err) {
        console.error('❌ Background Stock Engine Error:', err);
      }
    }, 0);

    return 'تتم معالجة تغيير حالة المخزون في الخلفية لتفادي تجميد الواجهة.';
  },

  // =========================================================================
  // 2. محرك استلام الحوالات والزلط وتأخير التجهيز لليوم التالي (ConfirmMoneyReceipt)
  // =========================================================================
  async confirmMoneyReceipt(params: {
    amount: number,
    currency: string,
    clientId: string,
    clientName: string,
    walletId: string, // CASH_BOX أو كود البنك الفرعي
    isOrderReadyToday: boolean,
    ownerId: string
  }): Promise<string> {
    const { amount, currency, clientId, clientName, walletId, isOrderReadyToday, ownerId } = params;

    // فصل ثقيل للتدقيق وعمليات المزامنة السحابية غير المتزامنة عن تتابع الرندر
    setTimeout(async () => {
      try {
        const batch = writeBatch(db);

        const finalWalletId = walletId || 'CASH_BOX';

        // 1. Update the targeted custom box balance (including CASH_BOX) with safe set merge true
        const customRef = doc(db, 'stores', ownerId, 'customBoxes', finalWalletId);
        batch.set(customRef, {
          id: finalWalletId,
          boxName: finalWalletId === 'CASH_BOX' ? 'صندوق النقد الرئيسي (الكاش)' : 'صندوق مالي',
          type: 'cash',
          balance: increment(amount),
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 2. Compatibility updates
        if (finalWalletId === 'CASH_BOX') {
          const defaultAccountQuery = query(
            collection(db, 'accounts'),
            where('ownerId', '==', ownerId),
            where('isDefault', '==', true)
          );
          const accSnap = await getDocs(defaultAccountQuery);
          if (!accSnap.empty) {
            batch.update(accSnap.docs[0].ref, {
              balance: increment(amount),
              updatedAt: serverTimestamp()
            });
          }
        } else {
          const bankRef = doc(db, 'bank_accounts', finalWalletId);
          const bankSnap = await getDoc(bankRef);
          if (bankSnap.exists()) {
            batch.update(bankRef, {
              balance: increment(amount),
              updatedAt: serverTimestamp()
            });
          }
        }

        const transactionRef = doc(collection(db, 'transactions'));
        let ledgerCategory = '';
        let ledgerNotes = '';
        let responseMsg = '';

        if (!isOrderReadyToday) {
          ledgerCategory = 'دفعات مقدمة معلقة (Prepaid)';
          ledgerNotes = 'الطلب غير مجهز اليوم. تم تعليق القيمة محاسبياً في حساب الدفعات المقدمة لحين توريد البضاعة.';
          responseMsg = `[الخزينة] تم تعليق مبلغ ${amount} ${currency} بحساب 'الدفعات المقدمة' للعميل [${clientName}] لأن التجهيز مبرمج غداً.`;

          const customerRef = doc(db, 'customers', clientId);
          const customerSnap = await getDoc(customerRef);
          if (customerSnap.exists()) {
            batch.update(customerRef, {
              prepaidBalance: increment(amount),
              updatedAt: serverTimestamp()
            });
          }
        } else {
          ledgerCategory = 'مبيعات نقدية فورية';
          ledgerNotes = 'مبيعات نقدية فورية وتجهيز فوري بنفس اليوم.';
          responseMsg = `[الخزينة] تم قيد بيع نقدي فوري مباشر بمبلغ ${amount} ${currency} بصندوق [${finalWalletId}].`;
        }

        batch.set(transactionRef, {
          ownerId,
          amount,
          currency,
          type: 'income',
          category: ledgerCategory,
          notes: ledgerNotes,
          boxId: finalWalletId,
          clientId,
          clientName,
          createdAt: serverTimestamp()
        });

        const logRef = doc(collection(db, 'engine_logs'));
        batch.set(logRef, {
          ownerId,
          engineType: 'cashier',
          message: responseMsg,
          details: ledgerNotes,
          amount,
          timestamp: serverTimestamp()
        });

        await batch.commit();
      } catch (err) {
        console.error('❌ Background Cashier Engine Error:', err);
      }
    }, 0);

    return `تجري معالجة استلام الحوالة بمبلغ ${amount} في الخلفية لتسريع الواجهة.`;
  },

  // =========================================================================
  // 3. محرك المشتريات وتحديد صندوق الخصم الذكي (ProcessPurchasePayment)
  // =========================================================================
  async processPurchasePayment(params: {
    invoiceTotal: number,
    currency: string,
    chosenMethod: PaymentMethod | null,
    subBankId?: string, // كود صندوق البنك المحدد عند السحب من حسابات البنوك الستة
    ownerId: string
  }): Promise<string> {
    const { invoiceTotal, currency, chosenMethod, subBankId, ownerId } = params;

    // معالجة متأخرة لكتابة الفاتورة وخصم الصناديق في الخلفية
    setTimeout(async () => {
      try {
        const batch = writeBatch(db);
        const finalMethod = chosenMethod || PaymentMethod.MainDrawer;
        let selectedBoxName = '';
        let boxIdToDeduct = 'CASH_BOX';
        let logMessage = '';
        let logDetails = '';

        switch (finalMethod) {
          case PaymentMethod.MainDrawer:
            const defaultAccountQuery = query(
              collection(db, 'accounts'),
              where('ownerId', '==', ownerId),
              where('isDefault', '==', true)
            );
            const accSnap = await getDocs(defaultAccountQuery);
            if (!accSnap.empty) {
              batch.update(accSnap.docs[0].ref, {
                balance: increment(-invoiceTotal),
                updatedAt: serverTimestamp()
              });
            }
            selectedBoxName = 'الصندوق الرئيسي للمحل';
            boxIdToDeduct = 'CASH_BOX';
            logMessage = `[المشتريات] تم الخصم تلقائياً من الصندوق الرئيسي بمبلغ ${invoiceTotal} ${currency}.`;
            logDetails = `خصم تلقائي لعدم تعيين وسيلة دفع بديلة أو اختيار الدفع النقدي العام.`;
            break;

          case PaymentMethod.SubBank:
            const bankId = subBankId || 'BANK-01';
            const bankRef = doc(db, 'bank_accounts', bankId);
            batch.update(bankRef, {
              balance: increment(-invoiceTotal),
              updatedAt: serverTimestamp()
            });
            selectedBoxName = `صندوق البنك البيني الرقمي [${bankId}]`;
            boxIdToDeduct = bankId;
            logMessage = `[المشتريات] تم الخصم من حساب الصندوق البنكي ${bankId} بمبلغ ${invoiceTotal} ${currency}.`;
            logDetails = `سحب وإرجاع مباشر ومطابقة سريعة من حسابات البنوك الستة.`;
            break;

          case PaymentMethod.OwnerWallet:
            const ownerWalletQuery = query(
              collection(db, 'bank_accounts'),
              where('ownerId', '==', ownerId),
              where('isOwnerWallet', '==', true)
            );
            const walletSnap = await getDocs(ownerWalletQuery);
            if (!walletSnap.empty) {
              batch.update(walletSnap.docs[0].ref, {
                balance: increment(-invoiceTotal),
                updatedAt: serverTimestamp()
              });
            }
            selectedBoxName = 'حقيبة المالك الشخصية (عهدة)';
            boxIdToDeduct = 'OWNER_WALLET';
            logMessage = `[المشتريات] تم الخصم من عهدة حساب المالك الشخصي الموجه بمبلغ ${invoiceTotal} ${currency}.`;
            logDetails = `تأمين حسابات عهدة الإدارة والمالكين مباشرة بنقابة الميزان المالي.`;
            break;
        }

        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          ownerId,
          amount: invoiceTotal,
          currency,
          type: 'expense',
          category: 'مشتريات خامات وبضائع',
          notes: logMessage,
          boxId: boxIdToDeduct,
          createdAt: serverTimestamp()
        });

        const logRef = doc(collection(db, 'engine_logs'));
        batch.set(logRef, {
          ownerId,
          engineType: 'purchase',
          message: logMessage,
          details: logDetails,
          amount: invoiceTotal,
          timestamp: serverTimestamp()
        });

        await batch.commit();
      } catch (err) {
        console.error('❌ Background Purchase Engine Error:', err);
      }
    }, 0);

    return `تجري معالجة سحب قيمة المشتريات (${invoiceTotal}) في الخلفية.`;
  }
};
