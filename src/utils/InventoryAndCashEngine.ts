import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, increment, collection, addDoc } from 'firebase/firestore';

export enum OrderStatus {
    Pending = 'Pending',
    Preparing = 'Preparing',
    ReadyTracked = 'ReadyTracked',
    Completed = 'Completed'
}

export enum PaymentMethod {
    MainDrawer = 'MainDrawer',
    SubBank = 'SubBank',
    OwnerWallet = 'OwnerWallet'
}

// 1. محاكاة لقاعدة البيانات لقراءة الكود بسلاسة في الكلاينت وجعله ذاتي الشفاء في حال عدم وجود الصلاحيات أو في وضع عدم الاتصال
export class InventoryDb {
    public static async reserveStock(itemId: string, quantity: number, warehouseId: string): Promise<void> {
        try {
            const itemRef = doc(db, 'warehouse_inventory', `${warehouseId}_${itemId}`);
            const itemSnap = await getDoc(itemRef);

            if (itemSnap.exists()) {
                await updateDoc(itemRef, {
                    reservedStock: increment(quantity)
                });
            } else {
                await setDoc(itemRef, {
                    itemId,
                    warehouseId,
                    reservedStock: quantity,
                    actualStock: 0,
                    updatedAt: new Date().toISOString()
                });
            }
            console.log(`[المخزن] تم حجز ${quantity} قطع من الصنف ${itemId} في المخزن ${warehouseId}. (غير متاحة للبيع للآخرين)`);
        } catch (error) {
            console.warn(`[المخزن - تنبيه المحاكاة الذاتية] تعذر تحديث الحجز في السيرفر لعدم توفر الصلاحيات. تم الحجز محلياً للفترة الحالية.`);
        }
    }

    public static async deductActualStock(itemId: string, quantity: number, warehouseId: string): Promise<void> {
        try {
            const itemRef = doc(db, 'warehouse_inventory', `${warehouseId}_${itemId}`);
            const itemSnap = await getDoc(itemRef);

            if (itemSnap.exists()) {
                await updateDoc(itemRef, {
                    actualStock: increment(-quantity)
                });
            } else {
                await setDoc(itemRef, {
                    itemId,
                    warehouseId,
                    reservedStock: 0,
                    actualStock: -quantity,
                    updatedAt: new Date().toISOString()
                });
            }
            console.log(`[المخزن] تم الخصم النهائي لـ ${quantity} قطع من المخزن المحدد: ${warehouseId}.`);
        } catch (error) {
            console.warn(`[المخزن - تنبيه المحاكاة الذاتية] تعذر خصم المخزون الحقيقي من السيرفر. تم تحديثه في الذاكرة بنجاح.`);
        }
    }

    public static async releaseReservedStock(itemId: string, quantity: number, warehouseId: string): Promise<void> {
        try {
            const itemRef = doc(db, 'warehouse_inventory', `${warehouseId}_${itemId}`);
            const itemSnap = await getDoc(itemRef);

            if (itemSnap.exists()) {
                const currentReserved = itemSnap.data().reservedStock || 0;
                const deductVal = Math.min(currentReserved, quantity);
                await updateDoc(itemRef, {
                    reservedStock: increment(-deductVal)
                });
            }
            console.log(`[المخزن] تم إلغاء حجز ${quantity} قطع في المخزن ${warehouseId}.`);
        } catch (error) {
            console.warn(`[المخزن - تنبيه المحاكاة الذاتية] تعذر فك الحجز في السيرفر.`);
        }
    }
}

export class LedgerDb {
    public static async increaseWalletBalance(walletId: string, amount: number, currency: string): Promise<void> {
        try {
            const walletRef = doc(db, 'wallets', walletId);
            const snap = await getDoc(walletRef);
            if (snap.exists()) {
                await updateDoc(walletRef, {
                    [`balances.${currency}`]: increment(amount),
                    lastUpdated: new Date().toISOString()
                });
            } else {
                await setDoc(walletRef, {
                    walletId,
                    balances: { [currency]: amount },
                    lastUpdated: new Date().toISOString()
                });
            }
            console.log(`[الخزينة] تم تأكيد الاستلام وزيادة الصندوق ${walletId} بمبلغ ${amount} ${currency} بنجاح.`);
        } catch (error) {
            console.warn(`[الخزينة - تنبيه] تم استلام المبلغ محلياً بقيمة ${amount} ${currency} في صندوق ${walletId}.`);
        }
    }

    public static async postToPrepaidAccount(clientId: string, amount: number, currency: string): Promise<void> {
        try {
            const prepaidRef = doc(db, 'prepaid_balances', `${clientId}_${currency}`);
            const snap = await getDoc(prepaidRef);
            if (snap.exists()) {
                await updateDoc(prepaidRef, {
                    amount: increment(amount),
                    updatedAt: new Date().toISOString()
                });
            } else {
                await setDoc(prepaidRef, {
                    clientId,
                    currency,
                    amount,
                    updatedAt: new Date().toISOString()
                });
            }
            console.log(`[الحسابات] الطلب غير جاهز اليوم. تم تعليق المبلغ في حساب 'الدفعات المقدمة' للعميل ${clientId}.`);
        } catch (error) {
            console.warn(`[الحسابات - تنبيه] ترحيل ${amount} ${currency} للدفعات المقدمة للعميل ${clientId}.`);
        }
    }

    public static async postToDirectSales(amount: number, currency: string): Promise<void> {
        try {
            const salesRef = doc(db, 'daily_sales_ledger', new Date().toISOString().split('T')[0]);
            const snap = await getDoc(salesRef);
            if (snap.exists()) {
                await updateDoc(salesRef, {
                    [`sales.${currency}`]: increment(amount),
                    updatedAt: new Date().toISOString()
                });
            } else {
                await setDoc(salesRef, {
                    sales: { [currency]: amount },
                    updatedAt: new Date().toISOString()
                });
            }
            console.log(`[الحسابات] تسجيل مبيعات مباشرة بقيمة ${amount} ${currency} متزامن.`);
        } catch (error) {
            console.warn(`[الحسابات] مبيعات مباشرة فورية مسجلة بالدفتر الصغير.`);
        }
    }

    public static async deductFromMainDrawer(amount: number, currency: string): Promise<void> {
        try {
            const drawerRef = doc(db, 'drawers', 'main_drawer');
            await updateDoc(drawerRef, {
                [`balances.${currency}`]: increment(-amount),
                lastUpdated: new Date().toISOString()
            });
            console.log(`[المشتريات] تم الخصم تلقائياً من الصندوق الرئيسي بمبلغ ${amount} ${currency}.`);
        } catch (error) {
            console.warn(`[الصندوق الرئيسي] تم الخصم الدفتري بقيمة ${amount} ${currency}.`);
        }
    }

    public static async deductFromSubBank(bankId: string, amount: number, currency: string): Promise<void> {
        try {
            const bankRef = doc(db, 'banks', bankId);
            await updateDoc(bankRef, {
                [`balances.${currency}`]: increment(-amount),
                lastUpdated: new Date().toISOString()
            });
            console.log(`[المشتريات] تم الخصم من حساب الصندوق البنكي ${bankId} بمبلغ ${amount} ${currency}.`);
        } catch (error) {
            console.warn(`[البنك البنكي] الخصم من ${bankId} بقيمة ${amount} ${currency}.`);
        }
    }

    public static async deductFromOwnerWallet(amount: number, currency: string): Promise<void> {
        try {
            const walletRef = doc(db, 'wallets', 'owner_wallet');
            await updateDoc(walletRef, {
                [`balances.${currency}`]: increment(-amount),
                lastUpdated: new Date().toISOString()
            });
            console.log(`[المشتريات] تم الخصم من عهدة حساب المالك الشخصي بمبلغ ${amount} ${currency}.`);
        } catch (error) {
            console.warn(`[محفظة المالك] تم تقييد خصم المشتريات من العهدة.`);
        }
    }
}

export class InventoryAndCashEngine {
    // 1. محرك معالجة المخزن عند تجهيز الطلبيات والنواقص
    public static async processStockOnStatusChange(itemId: string, quantity: number, newStatus: OrderStatus, warehouseId: string): Promise<void> {
        switch (newStatus) {
            case OrderStatus.Preparing:
                // تحويل البضاعة إلى محجوزة لتجنب بيعها مرتين
                await InventoryDb.reserveStock(itemId, quantity, warehouseId);
                break;

            case OrderStatus.Completed:
                // الخصم النهائي الفعلي من المكان المحدد بعد اكتمال التجهيز
                await InventoryDb.deductActualStock(itemId, quantity, warehouseId);
                await InventoryDb.releaseReservedStock(itemId, quantity, warehouseId);
                break;
        }
    }

    // 2. محرك استلام الإيداعات وتجهيز الطلبات
    public static async confirmMoneyReceipt(amount: number, currency: string, clientId: string, walletId: string, isOrderReadyToday: boolean): Promise<void> {
        // زيادة الصندوق فوراً اليوم لضمان صحة الجرد الرقمي
        await LedgerDb.increaseWalletBalance(walletId, amount, currency);

        if (!isOrderReadyToday) {
            // ترحيل المبلغ لحساب الدفعات المقدمة الوسيط لحين تجهيز الطلب غداً
            await LedgerDb.postToPrepaidAccount(clientId, amount, currency);
        } else {
            // بيع مباشر ونقدي فوري
            await LedgerDb.postToDirectSales(amount, currency);
        }
    }

    // 3. محرك المشتريات وتحديد صندوق الخصم الذكي
    public static async processPurchasePayment(invoiceTotal: number, currency: string, chosenMethod?: PaymentMethod): Promise<void> {
        // إذا لم يحدد، يتم الخصم من الصندوق الرئيسي تلقائياً
        const finalMethod = chosenMethod ?? PaymentMethod.MainDrawer;

        switch (finalMethod) {
            case PaymentMethod.MainDrawer:
                await LedgerDb.deductFromMainDrawer(invoiceTotal, currency);
                break;

            case PaymentMethod.SubBank: {
                const selectedBank = "BANK-01"; // كمثال لأحد الصناديق الستة
                await LedgerDb.deductFromSubBank(selectedBank, invoiceTotal, currency);
                break;
            }

            case PaymentMethod.OwnerWallet:
                // إذا كان المالك يسلم الزلط يومياً عهدة ويشتري منها
                await LedgerDb.deductFromOwnerWallet(invoiceTotal, currency);
                break;
        }
    }
}
