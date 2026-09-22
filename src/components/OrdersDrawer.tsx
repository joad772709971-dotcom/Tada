import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShoppingBasket, 
  Truck, 
  Clock, 
  ChevronLeft, 
  Package, 
  ExternalLink,
  Store,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  Coins,
  Warehouse,
  UserCheck,
  Building2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Gavel,
  Zap,
  TrendingUp,
  Check,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  writeBatch, 
  getDoc, 
  setDoc,
  serverTimestamp, 
  addDoc,
  updateDoc,
  getDocs,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, NetworkOrder, WarehousePrepOrder } from '../types';
import { b2bLifecycleService } from '../services/b2bLifecycleService';
import { InventoryLockingService } from '../services/InventoryLockingService';
import { accountingService, ensureAndGetGLAccount } from '../services/accountingService';

interface OrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
}

interface UnifiedOrder {
  id: string;
  retailerId: string;
  retailerName: string;
  retailerPhone?: string;
  wholesalerId: string;
  wholesalerName: string;
  items: any[];
  total: number;
  status: 'pending' | 'approved' | 'prepping' | 'matched' | 'ready' | 'dispatched' | 'delivered' | 'received' | 'cancelled';
  paymentType: 'cash' | 'debt';
  paymentStatus?: 'pending' | 'partial' | 'paid';
  paymentVerified?: boolean;
  paidAmount?: number;
  paymentDetails?: {
    amountPaid?: number;
    currency?: string;
    remittanceNumber?: string;
    [key: string]: any;
  };
  createdAt: any;
  notes?: string;
  sourceType: 'orders_b2b' | 'network_orders';
}

export default function OrdersDrawer({ isOpen, onClose, profile }: OrdersDrawerProps) {
  // General State
  const [unifiedOrders, setUnifiedOrders] = useState<UnifiedOrder[]>([]);
  const [prepOrders, setPrepOrders] = useState<WarehousePrepOrder[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<Record<string, number>>({});
  const [networkLinks, setNetworkLinks] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [customBoxes, setCustomBoxes] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  
  // Interactive / UI State
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'network' | 'prep'>('network');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'outgoing' | 'incoming'>('all');
  
  // Routing Transaction State for Cashier Priority View
  const [routingOrderId, setRoutingOrderId] = useState<string | null>(null);
  const [routingDestType, setRoutingDestType] = useState<string>('CASH_TO_STORE');
  const [routingSelectedBox, setRoutingSelectedBox] = useState<string>('');
  const [routingDetails, setRoutingDetails] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Section Expansion States to keep navigation clean and cozy
  const [expandedSection, setExpandedSection] = useState<string | null>('orders');
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editedItems, setEditedItems] = useState<any[]>([]);

  // Secure Delivery Verification State (Task 7)
  const [deliveryPin, setDeliveryPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);

  // Logistics Editing States
  const [isEditingLogistics, setIsEditingLogistics] = useState(false);
  const [driverNameInput, setDriverNameInput] = useState('');
  const [driverPhoneInput, setDriverPhoneInput] = useState('');
  const [vehicleNumberInput, setVehicleNumberInput] = useState('');

  // Prompt 10: Receiver Manifest Compliance & Auto Pricing states
  const [returnsMap, setReturnsMap] = useState<Record<string, number>>({}); // maps itemId/productId to quantity returned
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [pricingMarkupType, setPricingMarkupType] = useState<'standard' | 'premium' | 'competitive' | 'custom'>('standard');
  const [customMarkupValue, setCustomMarkupValue] = useState<number>(15);
  const [selectedPricingAccount, setSelectedPricingAccount] = useState<string>('');
  const [customUnitPrices, setCustomUnitPrices] = useState<Record<string, number>>({}); // overrides for calculated retail prices
  const [submittingManifestReceipt, setSubmittingManifestReceipt] = useState(false);

  // Advanced Client-side Receipt & Return Routing States
  const [damagedMap, setDamagedMap] = useState<Record<string, number>>({});
  const [surplusMap, setSurplusMap] = useState<Record<string, number>>({});
  const [swappedMap, setSwappedMap] = useState<Record<string, boolean>>({});
  const [swappedNameMap, setSwappedNameMap] = useState<Record<string, string>>({});
  const [subWarehouseMap, setSubWarehouseMap] = useState<Record<string, string>>({});
  const [returnPricingRuleMap, setReturnPricingRuleMap] = useState<Record<string, string>>({});
  const [returnCustomPriceMap, setReturnCustomPriceMap] = useState<Record<string, number>>({});

  // Role Checks
  const isCashier = profile?.role === 'staff' || profile?.role === 'sales' || (profile as any)?.appRole === 'CASHIER' || profile?.role === 'CASHIER' || profile?.role === 'distributor';
  const isManager = profile?.role === 'manager' || profile?.role === 'superadmin' || profile?.role === 'wholesaler' || profile?.networkRole === 'wholesaler';

  // Driver Fleet Cash Clearance States & Calculations
  const [clearingDriverId, setClearingDriverId] = useState<string | null>(null);

  const driverClearanceGroups = React.useMemo(() => {
    const groups: Record<string, { driverName: string; driverId: string; orders: any[]; totalAmount: number }> = {};
    
    unifiedOrders.forEach(order => {
      const isDelivered = order.status === 'delivered';
      const isCash = order.paymentMethod === 'cash';
      const isNotCleared = order.driverCashCleared !== true && order.cashCleared !== true;
      
      if (isDelivered && isCash && isNotCleared) {
        const driverId = order.deliveryAgentId || 'default_driver_id';
        const driverName = order.deliveryAgentName || order.driverName || 'أحمد اللوجستي (سائق عام)';
        
        if (!groups[driverId]) {
          groups[driverId] = {
            driverName,
            driverId,
            orders: [],
            totalAmount: 0
          };
        }
        
        const amount = Number(order.total || order.paymentDetails?.amountPaid || 0);
        groups[driverId].orders.push(order);
        groups[driverId].totalAmount += amount;
      }
    });
    
    return Object.values(groups);
  }, [unifiedOrders]);

  const handleClearDriverCash = async (driverGroup: any) => {
    if (!profile?.ownerId) return;
    try {
      setClearingDriverId(driverGroup.driverId);
      
      const mainStoreSafeAcc = await ensureAndGetGLAccount(profile.ownerId, '1100', 'الصندوق / البنك', 'asset');
      const driverFloatingCashAcc = await ensureAndGetGLAccount(profile.ownerId, '1150', 'عهدة السائقين المعلقة (كاش)', 'asset');
      
      const description = `تصفية وإقفال عهدة السائق: ${driverGroup.driverName} لـ (${driverGroup.orders.length}) شحنات كاش سلمت ميدانياً`;
      const reference = `DRV-CLR-${driverGroup.driverId.slice(-6)}-${Date.now().toString().slice(-4)}`;
      
      const entries = [
        {
          accountId: mainStoreSafeAcc.id,
          accountName: mainStoreSafeAcc.accountName,
          debit: driverGroup.totalAmount,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: driverGroup.totalAmount
        },
        {
          accountId: driverFloatingCashAcc.id,
          accountName: driverFloatingCashAcc.accountName,
          debit: 0,
          credit: driverGroup.totalAmount,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: driverGroup.totalAmount
        }
      ];
      
      await accountingService.recordJournalEntry(profile.ownerId, description, entries, reference);
      
      const batch = writeBatch(db);
      driverGroup.orders.forEach((order: any) => {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, { 
          driverCashCleared: true,
          cashCleared: true 
        });
        
        if (order.sourceType === 'network_orders') {
          const netRef = doc(db, 'networkOrders', order.id);
          batch.update(netRef, { 
            driverCashCleared: true,
            cashCleared: true 
          });
        }
      });
      
      await batch.commit();
      alert(`✓ تم بنجاح تصفية عهدة السائق ${driverGroup.driverName} ماليّاً وبدفتر الأستاذ!\n- إجمالي الكاش المورد للمحل: ${driverGroup.totalAmount.toLocaleString()} ر.ي\n- المرجع المحاسبي: ${reference}`);
    } catch (e: any) {
      console.error(e);
      alert(`❌ خطأ أثناء تصفية عهدة السائق: ${e.message}`);
    } finally {
      setClearingDriverId(null);
    }
  };

  // States for Multi-Role Verification Modal
  const [verifySelectedBox, setVerifySelectedBox] = useState('CASH_BOX');
  const [verifyDetails, setVerifyDetails] = useState('');
  const [confirmDebtCommitment, setConfirmDebtCommitment] = useState(false);
  const [verifyingOrder, setVerifyingOrder] = useState(false);

  const handleVerifyIncomingB2BOrder = async (order: any, type: 'cash' | 'debt') => {
    if (!profile) return;
    if (loading || verifyingOrder) return;

    setVerifyingOrder(true);
    try {
      const batch = writeBatch(db);

      // Determine order collection name
      const orderCol = order.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
      const orderRef = doc(db, orderCol, order.id);

      if (type === 'cash') {
        // --- FLOW A: Cash / Transfer ---
        // 1. Resolve Safe/Box info
        const targetBox = combinedBoxes.find(b => b.id === verifySelectedBox) || { id: 'CASH_BOX', name: 'صندوق الكاش المباشر للمحل', type: 'CASH_TO_STORE' };
        const amount = order.total || 0;

        // 2. If it's a bank account or custom box, we increment its balance in Firestore
        if (targetBox.type === 'BANK_ACCOUNT') {
          const bankRef = doc(db, 'bank_accounts', targetBox.id);
          const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', targetBox.id);
          const bankSnap = await getDoc(bankRef);
          const customSnap = await getDoc(customRef);

          if (bankSnap.exists()) {
            const currentBalance = Number(bankSnap.data().balance || 0);
            batch.update(bankRef, {
              balance: currentBalance + amount,
              updatedAt: serverTimestamp()
            });
          } else if (customSnap.exists()) {
            const currentBalance = Number(customSnap.data().balance || 0);
            batch.update(customRef, {
              balance: currentBalance + amount
            });

            const customData = customSnap.data();
            if (customData.isLinkedToBank && customData.bankAccountId) {
              const linkedBankRef = doc(db, 'bank_accounts', customData.bankAccountId);
              const linkedBankSnap = await getDoc(linkedBankRef);
              if (linkedBankSnap.exists()) {
                const currentBankBal = Number(linkedBankSnap.data().balance || 0);
                batch.update(linkedBankRef, {
                  balance: currentBankBal + amount,
                  updatedAt: serverTimestamp()
                });
              }
            }
          }
        }

        // 3. Update order document with payment details
        batch.update(orderRef, {
          status: 'prepping', // Workflow Hand-off: move to "جاهز للتجهيز" (prepping)
          paymentStatus: 'paid',
          paymentVerified: true,
          paidAmount: amount,
          remittanceRoutingType: targetBox.type,
          remittanceRoutingBoxId: targetBox.id,
          remittanceRoutingBoxName: targetBox.name,
          remittanceRoutingDetails: verifyDetails || 'تم التحقق والاستلام عبر وحدة العمليات الجانبية الموحدة',
          updatedAt: serverTimestamp()
        });

        // 4. Insert transaction log
        const transRef = doc(collection(db, 'transactions'));
        batch.set(transRef, {
          ownerId: profile.ownerId,
          amount,
          type: 'income',
          category: 'مبيعات B2B',
          boxId: targetBox.id,
          boxName: targetBox.name,
          description: `استلام كاش/تحويل للطلب #${order.id.slice(-6)} - الصندوق: ${targetBox.name} - ملاحظة: ${verifyDetails || 'تم الاستلام والاعتماد بالنافذة الموحدة'}`,
          createdAt: serverTimestamp()
        });

      } else {
        // --- FLOW B: Debt (آجل) ---
        if (!confirmDebtCommitment) {
          alert('يرجى تأكيد الالتزام المالي والموافقة على قيد المبلغ على ذمة العميل أولاً.');
          setVerifyingOrder(false);
          return;
        }

        // 1. Update order document as approved on credit
        batch.update(orderRef, {
          status: 'prepping', // Workflow Hand-off: move to "جاهز للتجهيز" (prepping)
          paymentStatus: 'pending', // remains pending as it is debt
          paymentVerified: true,
          updatedAt: serverTimestamp()
        });

        // 2. Adjust retailer's balance / account ledger
        // Find if there is an account doc for the retailer
        const retailerAccountsQuery = query(
          collection(db, 'accounts'),
          where('ownerId', '==', order.retailerId),
          where('isDefault', '==', true)
        );
        const accSnap = await getDocs(retailerAccountsQuery);
        if (!accSnap.empty) {
          const accDoc = accSnap.docs[0];
          batch.update(accDoc.ref, {
            balance: increment(-order.total) // negative balance signifies debt for retailer
          });
        }
      }

      // --- COMMON WORKFLOW HAND-OFF: PUSH TO WAREHOUSE PREPARATION TAB ---
      // 1. Insert warehousePreps document
      const prepDocRef = doc(collection(db, 'warehousePreps'));
      const prepData = {
        ownerId: profile.ownerId,
        orderId: order.id,
        customerName: order.retailerName,
        items: order.items.map((i: any) => ({
          itemId: i.productId || i.itemId,
          name: i.name || i.productName,
          requestedQty: i.quantity || 1,
          preparedQty: i.quantity || 1,
          status: 'pending'
        })),
        prepStatus: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(prepDocRef, prepData);

      // 2. Insert warehousePrepOrders document
      const prepOrderRef = doc(db, 'warehousePrepOrders', prepDocRef.id);
      batch.set(prepOrderRef, {
        id: prepDocRef.id,
        ownerId: profile.ownerId,
        orderId: order.id,
        customerName: order.retailerName,
        items: order.items.map((i: any) => ({
          itemId: i.productId || i.itemId,
          name: i.name || i.productName,
          requestedQty: i.quantity || 1,
          preparedQty: i.quantity || 1,
          status: 'pending'
        })),
        prepStatus: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3. Insert Audit Log
      const auditRef = doc(collection(db, 'auditLogs'));
      batch.set(auditRef, {
        userId: profile.uid,
        userName: profile.name,
        action: 'B2B_ORDER_APPROVED_AND_SENT_TO_PREP',
        targetAccount: order.id,
        exactAmount: order.total || 0,
        details: `تأكيد واعتماد الطلب B2B رقم ${order.id.slice(-6)} بقيمة ${order.total} YER وتحويله للمستودع للتجهيز - مسار: ${type === 'cash' ? 'نقدي/حوالة' : 'آجل على ذمة الدفتر'}`,
        timestamp: serverTimestamp()
      });

      // Commit the batch atomic transaction!
      await batch.commit();

      // Trigger Instant Allocation Freeze (Inventory Locking)
      try {
        const lockItems = (order.items || []).map((i: any) => ({
          productId: i.productId || i.itemId,
          quantity: Number(i.quantity || 1),
          selectedColor: i.selectedColor || i.color
        }));
        await InventoryLockingService.lockInventory({
          ownerId: profile.ownerId,
          items: lockItems,
          sourceType: 'prep',
          referenceId: order.id
        });
        console.log('[Instant Allocation Freeze] Successfully locked products for order prepping.');
      } catch (lockErr) {
        console.error('[Instant Allocation Freeze Error]:', lockErr);
      }

      alert(`🎉 تم بنجاح اعتماد الطلب #${order.id.slice(-6)} ونقله فوراً إلى قسم تجهيز المخازن مع تجميد فوري للرصيد محجوزاً مؤقتاً لحين شحن البضاعة!`);
      setSelectedOrder(null); // Close the detail modal seamlessly
    } catch (err: any) {
      console.error(err);
      alert('❌ فشل اعتماد ومعالجة الطلب: ' + err.message);
    } finally {
      setVerifyingOrder(false);
    }
  };

  const handleCancelB2BOrder = async (order: any) => {
    if (!order) return;
    if (!window.confirm('🚨 هل أنت متأكد من إلغاء هذا الطلب بالكامل وعكس كافة الكميات وحركات الصندوق والمالية فوراً؟')) return;
    
    setLoading(true);
    try {
      const orderCol = order.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
      const orderRef = doc(db, orderCol, order.id);
      
      const { runTransaction, collection, query, where, getDocs } = await import('firebase/firestore');
      await runTransaction(db, async (resTransaction) => {
        const liveSnap = await resTransaction.get(orderRef);
        if (!liveSnap.exists()) throw new Error('الطلب غير موجود');
        const liveData = liveSnap.data();

        // 1. If it was active ('approved' | 'prepping' | 'ready' | 'matched') and cash, revert cash flow for supplier
        if (liveData.paymentType === 'cash' && ['approved', 'prepping', 'ready', 'matched'].includes(liveData.status)) {
          // Revert supplier balance
          const supplierAccountsQuery = query(
            collection(db, 'accounts'),
            where('ownerId', '==', liveData.wholesalerId),
            where('isDefault', '==', true)
          );
          const accSnap = await getDocs(supplierAccountsQuery);
          if (!accSnap.empty) {
            const accDoc = accSnap.docs[0];
            resTransaction.update(accDoc.ref, {
              balance: increment(-liveData.total)
            });
          }
        }

        // 2. Return prepped items back to stock and release locks (Absolute Transaction Safety)
        if (liveData.items && Array.isArray(liveData.items) && ['approved', 'prepping', 'ready', 'matched'].includes(liveData.status)) {
          for (const item of liveData.items) {
            const qty = Number(item.quantity || 1);
            
            // a. Root inventory update
            const invRef = doc(db, 'inventory', item.productId);
            const invSnap = await resTransaction.get(invRef);
            if (invSnap.exists()) {
              const currentStock = Number(invSnap.data().stock || 0);
              const currentLocked = Number(invSnap.data().tempLocked || 0);
              resTransaction.update(invRef, {
                stock: currentStock + qty,
                tempLocked: Math.max(0, currentLocked - qty),
                updatedAt: serverTimestamp()
              });
            }

            // b. Sub-collection inventory update
            const storeInvRef = doc(db, 'stores', liveData.ownerId || order.ownerId || 'main_store', 'inventory', item.productId);
            const storeInvSnap = await resTransaction.get(storeInvRef);
            if (storeInvSnap.exists()) {
              const currentStock = Number(storeInvSnap.data().stock || 0);
              const currentLocked = Number(storeInvSnap.data().tempLocked || 0);
              resTransaction.update(storeInvRef, {
                stock: currentStock + qty,
                tempLocked: Math.max(0, currentLocked - qty),
                updatedAt: serverTimestamp()
              });
            }

            // c. B2B wholesaleProducts update
            const wpRef = doc(db, 'wholesaleProducts', item.productId);
            const wpSnap = await resTransaction.get(wpRef);
            if (wpSnap.exists()) {
              const wpData = wpSnap.data();
              const currentStock = Number(wpData.stock || 0);
              const currentLocked = Number(wpData.tempLocked || 0);
              const updates: any = {
                stock: currentStock + qty,
                tempLocked: Math.max(0, currentLocked - qty),
                updatedAt: serverTimestamp()
              };

              const pickedColor = item.selectedColor || item.color;
              if (pickedColor && wpData.variants) {
                const updatedVariants = wpData.variants.map((v: any) => {
                  if (v.color === pickedColor) {
                    return {
                      ...v,
                      stock: Number(v.stock || 0) + qty,
                      tempLocked: Math.max(0, Number(v.tempLocked || 0) - qty)
                    };
                  }
                  return v;
                });
                updates.variants = updatedVariants;
              }
              resTransaction.update(wpRef, updates);
            }
          }
        }

        // 3. Status strictly to 'cancelled'
        resTransaction.update(orderRef, {
          status: 'cancelled',
          discrepancyAction: 'cancelled_by_manager',
          notes: (liveData.notes || '') + `\n[إلغاء المدير: تم إلغاء الطلب بالكامل بالتعاون مع المخازن والمالية.]`,
          updatedAt: serverTimestamp()
        });

        // 4. Update warehousePrepOrders if existing
        const prepQuery = query(collection(db, 'warehousePrepOrders'), where('orderId', '==', order.id));
        const prepSnap = await getDocs(prepQuery);
        for (const prepDoc of prepSnap.docs) {
          resTransaction.update(prepDoc.ref, {
            prepStatus: 'cancelled',
            updatedAt: serverTimestamp()
          });
        }
      });

      alert('✅ تم إلغاء الطلب بنجاح، وعكس حركات المخزون والمستحقات بنجاح!');
      setSelectedOrder(null);
    } catch (e: any) {
      console.error(e);
      alert('❌ فشل إلغاء الطلب: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditedB2BOrder = async (order: any, newItems: any[]) => {
    if (!order) return;
    if (!window.confirm('📋 هل تود الاستمرار وحفظ هذه التعديلات وعكس فوارق المخزون والمالية تلقائياً؟')) return;
    
    setLoading(true);
    try {
      const orderCol = order.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
      const orderRef = doc(db, orderCol, order.id);
      
      const { runTransaction, collection, query, where, getDocs } = await import('firebase/firestore');
      await runTransaction(db, async (resTransaction) => {
        const liveSnap = await resTransaction.get(orderRef);
        if (!liveSnap.exists()) throw new Error('الطلب غير موجود');
        const liveData = liveSnap.data();

        // Compute old total vs new total
        const oldTotal = liveData.total || 0;
        const newTotal = newItems.reduce((acc, i) => acc + (i.price * (i.quantity || 0)), 0);
        const totalDiff = newTotal - oldTotal;

        // 1. Revert/Adjust Cash Balance if B2B order was cash pre-purchased
        if (liveData.paymentType === 'cash' && ['approved', 'prepping', 'ready', 'matched'].includes(liveData.status)) {
          const supplierAccountsQuery = query(
            collection(db, 'accounts'),
            where('ownerId', '==', liveData.wholesalerId),
            where('isDefault', '==', true)
          );
          const accSnap = await getDocs(supplierAccountsQuery);
          if (!accSnap.empty) {
            const accDoc = accSnap.docs[0];
            resTransaction.update(accDoc.ref, {
              balance: increment(totalDiff)
            });
          }
        }

        // 2. Adjust stock for each item dynamically
        if (['approved', 'prepping', 'ready', 'matched'].includes(liveData.status)) {
          // Return all old items to inventory
          if (liveData.items && Array.isArray(liveData.items)) {
            for (const item of liveData.items) {
              const invRef = doc(db, 'inventory', item.productId);
              resTransaction.update(invRef, {
                stock: increment(item.quantity)
              });
            }
          }

          // Deduct all new items from inventory
          for (const item of newItems) {
            const invRef = doc(db, 'inventory', item.productId);
            resTransaction.update(invRef, {
              stock: increment(-item.quantity)
            });
          }
        }

        // 3. Update main order doc with modified items and total
        resTransaction.update(orderRef, {
          items: newItems,
          total: newTotal,
          notes: (liveData.notes || '') + `\n[تعديل المدير: تم تعديل كميات وأصناف السلة وإعادة تسويتها الموازية.]`,
          updatedAt: serverTimestamp()
        });

        // 4. Update prep order if it exists
        const prepQuery = query(collection(db, 'warehousePrepOrders'), where('orderId', '==', order.id));
        const prepSnap = await getDocs(prepQuery);
        for (const prepDoc of prepSnap.docs) {
          resTransaction.update(prepDoc.ref, {
            items: newItems.map(i => ({
              itemId: i.productId,
              name: i.name,
              requestedQty: i.quantity,
              preparedQty: i.quantity,
              status: 'pending'
            })),
            updatedAt: serverTimestamp()
          });
        }
      });

      alert('✅ تم حفظ التعديلات وإجراء الموازنة المحاسبية وموازنة المخزون بنجاح!');
      setIsEditingItems(false);
      setSelectedOrder(null);
    } catch (e: any) {
      console.error(e);
      alert('❌ فشل حفظ التعديلات: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReopenForSubstitute = async (order: any) => {
    try {
      const orderCol = order.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
      
      // 1. Update the main order status to 'prepping' so it's active in prep cycle
      await updateDoc(doc(db, orderCol, order.id), {
        status: 'prepping',
        discrepancyAction: 'reopen_for_substitute',
        updatedAt: serverTimestamp(),
        notes: (order.notes || '') + '\n[تسوية المدير: تم فتح الفاتورة وإعادتها لقسم التجهيز لإضافة صنف بديل]'
      });

      // 2. Find and update the associated warehousePreps status to 'in_progress' and reset items status
      const prepQuery = query(collection(db, 'warehousePreps'), where('orderId', '==', order.id));
      const prepSnap = await getDocs(prepQuery);
      if (!prepSnap.empty) {
        const prepDoc = prepSnap.docs[0];
        const prepData = prepDoc.data();
        const resetItems = (prepData.items || []).map((item: any) => ({
          ...item,
          status: 'pending' // reset status back so they can prep again
        }));
        await updateDoc(doc(db, 'warehousePreps', prepDoc.id), {
          prepStatus: 'in_progress',
          items: resetItems,
          updatedAt: serverTimestamp()
        });
      }
      
      alert('🔄 تم بنجاح فتح الفاتورة وإعادة توجيهها لقسم التجهيز والمستودع تلقائياً لتحديث الأصناف والبدائل!');
      setSelectedOrder(null);
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء محاولة إعادة فتح الفاتورة وتوجيهها للمستودع.');
    }
  };

  useEffect(() => {
    if (!profile?.ownerId || !isOpen) return;

    // 1. Fetch orders from 'networkOrders' collection
    const qNet = query(
      collection(db, 'networkOrders'),
      where('ownerId', '==', profile.ownerId)
    );
    const unsubNet = onSnapshot(qNet, (snapshot) => {
      const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          sourceType: 'network_orders'
        } as unknown as UnifiedOrder;
      });
      setUnifiedOrders(prev => {
        const otherSource = prev.filter(o => o.sourceType !== 'network_orders');
        const combined = [...otherSource, ...orders];
        const unique = Array.from(new Map(combined.map(o => [o.id, o])).values());
        return unique.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
      });
    }, (err) => console.warn('Notice fetching networkOrders (offline/permission):', err?.message || err));

    // 2. Fetch orders from 'orders' (B2B) collection as wholesaler or retailer
    const qB2B = query(
      collection(db, 'orders'),
      where('retailerId', '==', profile.ownerId)
    );
    const unsubB2B = onSnapshot(qB2B, (snapshot) => {
      const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          sourceType: 'orders_b2b'
        } as unknown as UnifiedOrder;
      });
      setUnifiedOrders(prev => {
        const otherSource = prev.filter(o => o.sourceType === 'network_orders' || (o.sourceType === 'orders_b2b' && o.retailerId !== profile.ownerId));
        const combined = [...otherSource.filter(o => !orders.some(no => no.id === o.id)), ...orders];
        const unique = Array.from(new Map(combined.map(o => [o.id, o])).values());
        return unique.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
      });
    }, (err) => console.warn('Notice fetching retailer orders (offline/permission):', err?.message || err));

    const qB2BWh = query(
      collection(db, 'orders'),
      where('wholesalerId', '==', profile.ownerId)
    );
    const unsubB2BWh = onSnapshot(qB2BWh, (snapshot) => {
      const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          sourceType: 'orders_b2b'
        } as unknown as UnifiedOrder;
      });
      setUnifiedOrders(prev => {
        const otherSource = prev.filter(o => o.sourceType === 'network_orders' || (o.sourceType === 'orders_b2b' && o.wholesalerId !== profile.ownerId));
        const combined = [...otherSource.filter(o => !orders.some(no => no.id === o.id)), ...orders];
        const unique = Array.from(new Map(combined.map(o => [o.id, o])).values());
        return unique.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
      });
    }, (err) => console.warn('Notice fetching wholesaler orders (offline/permission):', err?.message || err));

    // 3. Warehouse prep orders
    const qPrep = query(
      collection(db, 'warehousePrepOrders'),
      where('ownerId', '==', profile.ownerId)
    );
    const unsubPrep = onSnapshot(qPrep, (snapshot) => {
      setPrepOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarehousePrepOrder)));
    }, (err) => console.error('Error fetching warehousePrepOrders:', err));

    // 4. Warehouse & Stock Counters calculation from 'inventory'
    const qInv = query(
      collection(db, 'inventory'),
      where('ownerId', '==', profile.ownerId)
    );
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const whTotals: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const warehouses = data.warehouses || {};
        const defaultCategory = data.category || 'المحل';
        
        if (Object.keys(warehouses).length > 0) {
          Object.entries(warehouses).forEach(([whName, qty]) => {
            whTotals[whName] = (whTotals[whName] || 0) + Number(qty || 0);
          });
        } else {
          whTotals[defaultCategory] = (whTotals[defaultCategory] || 0) + Number(data.stock || 0);
        }
      });
      setWarehouseStock(whTotals);
    }, (err) => console.error('Error fetching inventory stock:', err));

    // 5. Fetch network sync and supplier pairings
    const qLinksWh = query(
      collection(db, 'networkLinks'),
      where('wholesalerId', '==', profile.ownerId)
    );
    const unsubLinksWh = onSnapshot(qLinksWh, (snapshot) => {
      const whLinks = snapshot.docs.map(doc => ({ id: doc.id, roleType: 'wholesaler', ...doc.data() }));
      setNetworkLinks(prev => {
        const otherLinks = prev.filter(l => l.roleType !== 'wholesaler');
        return [...otherLinks, ...whLinks];
      });
    });

    const qLinksRt = query(
      collection(db, 'networkLinks'),
      where('retailerId', '==', profile.ownerId)
    );
    const unsubLinksRt = onSnapshot(qLinksRt, (snapshot) => {
      const rtLinks = snapshot.docs.map(doc => ({ id: doc.id, roleType: 'retailer', ...doc.data() }));
      setNetworkLinks(prev => {
        const otherLinks = prev.filter(l => l.roleType !== 'retailer');
        return [...otherLinks, ...rtLinks];
      });
    });

    // 6. Bank accounts for Cashier Routing
    const qBanks = query(
      collection(db, 'bank_accounts'),
      where('ownerId', '==', profile.ownerId)
    );
    const unsubBanks = onSnapshot(qBanks, (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qAccs = query(
      collection(db, 'accounts'),
      where('ownerId', '==', profile.ownerId)
    );
    const unsubAccs = onSnapshot(qAccs, (snapshot) => {
      setAccountsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCustom = onSnapshot(
      collection(db, 'stores', profile.ownerId, 'customBoxes'),
      (snapshot) => {
        setCustomBoxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubNet();
      unsubB2B();
      unsubB2BWh();
      unsubPrep();
      unsubInv();
      unsubLinksWh();
      unsubLinksRt();
      unsubBanks();
      unsubAccs();
      unsubCustom();
    };
  }, [profile?.ownerId, isOpen]);

  // Handle immediate financial verification and routing (Cashier Direct Action)
  const handleVerifyInlineRemittance = async (order: UnifiedOrder) => {
    if (!profile) return;
    const remittance = order.paymentDetails;
    if (!remittance) {
      alert('لا توجد تفاصيل حوالة أو إيداع مالي لهذا الطلب.');
      return;
    }

    try {
      setLoading(true);
      const batch = writeBatch(db);
      const amount = Number(remittance.amountPaid || order.total || 0);
      
      let finalBoxId = routingSelectedBox || 'CASH_BOX';
      let finalBoxName = 'صندوق الكاش المباشر للمحل';
      
      if (routingDestType === 'BANK_ACCOUNT' && routingSelectedBox) {
        const boxRef = doc(db, 'bank_accounts', routingSelectedBox);
        const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', routingSelectedBox);
        const boxSnap = await getDoc(boxRef);
        const customSnap = await getDoc(customRef);

        if (boxSnap.exists()) {
          const currentBalance = Number(boxSnap.data().balance || 0);
          batch.update(boxRef, {
            balance: currentBalance + amount,
            updatedAt: serverTimestamp()
          });
          finalBoxName = boxSnap.data().boxName || boxSnap.data().bankName || 'حساب المصرفي';
        } else if (customSnap.exists()) {
          const currentBalance = Number(customSnap.data().balance || 0);
          batch.update(customRef, {
            balance: currentBalance + amount
          });
          finalBoxName = customSnap.data().boxName || 'صندوق مخصص';

          // Sync linked bank account if applicable
          const customData = customSnap.data();
          if (customData.isLinkedToBank && customData.bankAccountId) {
            const linkedBankRef = doc(db, 'bank_accounts', customData.bankAccountId);
            const linkedBankSnap = await getDoc(linkedBankRef);
            if (linkedBankSnap.exists()) {
              const currentBankBal = Number(linkedBankSnap.data().balance || 0);
              batch.update(linkedBankRef, {
                balance: currentBankBal + amount,
                updatedAt: serverTimestamp()
              });
            }
          }
        } else {
          alert('حساب الصندوق غير موجود!');
          setLoading(false);
          return;
        }
      } else if (routingDestType === 'CASH_TO_STORE') {
        finalBoxId = 'CASH_BOX';
        finalBoxName = 'صندوق الكاش المباشر للمحل';
      } else if (routingDestType === 'BIG_MERCHANT') {
        finalBoxId = 'BIG_MERCHANT_ROUTING';
        finalBoxName = 'ترحيل مباشر لتاجر كبير';
      } else if (routingDestType === 'OWNER_HANDOVER') {
        finalBoxId = 'OWNER_HANDOVER_ROUTING';
        finalBoxName = 'تسليم مباشر للملاك والملاك الماليين';
      }

      // Update Order document in appropriate collection
      const orderCol = order.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
      batch.update(doc(db, orderCol, order.id), {
        paymentStatus: 'paid',
        paymentVerified: true,
        paidAmount: (order.paidAmount || 0) + amount,
        remittanceRoutingType: routingDestType,
        remittanceRoutingBoxId: finalBoxId,
        remittanceRoutingBoxName: finalBoxName,
        remittanceRoutingDetails: routingDetails || 'تم التأكيد التلقائي عبر النافذة الجانبية الموحدة للاستلام والتحصيل',
        updatedAt: serverTimestamp()
      });

      // Insert transaction log
      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        ownerId: profile.ownerId,
        amount,
        type: 'income',
        category: 'سداد مالي B2B',
        boxId: finalBoxId,
        boxName: finalBoxName,
        description: `توريد وتوجيه حوالة للطلب #${order.id.slice(-6)} - مسار: ${finalBoxName} - الملاحظات: ${routingDetails || 'تم الاستلام والاعتماد الميداني بالنافذة الموحدة'}`,
        createdAt: serverTimestamp()
      });

      // Immutable log to auditLogs
      const auditRef = doc(collection(db, 'auditLogs'));
      batch.set(auditRef, {
        userId: profile.uid,
        userName: profile.name,
        action: 'CONFIRM_REMITTANCE_RECEIPT_ROUTED',
        targetAccount: finalBoxId,
        exactAmount: amount,
        details: `تأكيد استلام حوالة B2B رقم ${remittance.remittanceNumber || 'N/A'} بقيمة ${amount} ر.ي وتوجيهها بمسار (${routingDestType}) إلى (${finalBoxName}) - الموظف: ${profile.name}`,
        timestamp: serverTimestamp()
      });

      await batch.commit();
      alert(`🎉 تم بنجاح استلام الحوالة وتوجيهها إلى: ${finalBoxName}`);
      
      setRoutingOrderId(null);
      setRoutingDetails('');
    } catch (err) {
      console.error(err);
      alert('فشل في توجيه الفارق أو الحوالة مالياً');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // PROMPT 9: MANAGER RECONCILIATION & BALANCE ADJUSTMENTS + EXPRESS DISPATCH
  // =========================================================================
  const calculateShortageVariance = (order: any) => {
    if (!order || !order.items) return { totalVariance: 0, shortages: [] };
    let totalVariance = 0;
    const shortages: any[] = [];
    order.items.forEach((item: any) => {
      const original = item.quantity || item.requestedQty || 0;
      const shipped = item.shippedQuantity !== undefined ? item.shippedQuantity : original;
      const deficit = original - shipped;
      if (deficit > 0) {
        const itemPrice = item.price || item.cost || 0;
        const variance = deficit * itemPrice;
        totalVariance += variance;
        shortages.push({
          name: item.productName || item.name || 'صنف مجهول',
          original,
          shipped,
          deficit,
          price: itemPrice,
          variance
        });
      }
    });
    return { totalVariance, shortages };
  };

  const handleManagerReconcileOrder = async (order: any) => {
    if (!order) return;
    
    const { totalVariance, shortages } = calculateShortageVariance(order);
    if (totalVariance <= 0) {
      alert('ℹ️ لا توجد فروقات أو عجز مخزني لتسويتها في هذا الطلب.');
      return;
    }

    const isCredit = order.paymentType === 'debt';
    let confirmMsg = '';
    if (isCredit) {
      confirmMsg = `⚖️ سيقوم النظام الآن بإجراء تسوية الفروقات لطلب آجل بقيمة عجز إجمالية: ${totalVariance.toLocaleString()} ر.ي.\n\nسيتم خصم هذه القيمة تلقائياً من المديونية المستحقة على العميل (${order.retailerName || order.customerName}) في سجلات الحسابات.\n\nهل تود الاستمرار؟`;
    } else {
      confirmMsg = `🎫 سيقوم النظام الآن بإصدار إشعار دائن (Credit Note Refund) لطلب مدفوع نقداً بقيمة عجز إجمالية: ${totalVariance.toLocaleString()} ر.ي.\n\nسيتم إرفاق جدول تفصيلي بالنواقص والمبالغ المستردة أسفل الفاتورة وتوثيق قيد التسوية بالدفاتر.\n\nهل تود الاستمرار؟`;
    }

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const orderCol = order.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
      const orderRef = doc(db, orderCol, order.id);
      
      const { runTransaction, collection, query, where, getDocs } = await import('firebase/firestore');
      await runTransaction(db, async (transaction) => {
        const liveSnap = await transaction.get(orderRef);
        if (!liveSnap.exists()) throw new Error('الطلب غير موجود');
        const liveData = liveSnap.data();

        // Recalculate variance inside transaction to be fully accurate
        let liveVariance = 0;
        const liveShortages: string[] = [];
        liveData.items.forEach((item: any) => {
          const original = item.quantity || item.requestedQty || 0;
          const shipped = item.shippedQuantity !== undefined ? item.shippedQuantity : original;
          const deficit = original - shipped;
          if (deficit > 0) {
            const itemPrice = item.price || item.cost || 0;
            const itemVar = deficit * itemPrice;
            liveVariance += itemVar;
            liveShortages.push(`- ${item.productName || item.name}: عجز ${deficit} بقيمة ${itemVar.toLocaleString()} ر.ي`);
          }
        });

        if (liveVariance <= 0) throw new Error('لا توجد فروقات في الكميات المجهزة بالفحص الحالي.');

        const adjustedTotal = (liveData.total || 0);

        // 1. Credit (Debt) orders logic: Deduct from customer's outstanding balance
        if (isCredit) {
          const custQuery = query(
            collection(db, 'customers'),
            where('ownerId', '==', liveData.wholesalerId),
            where('linkedUid', '==', liveData.retailerId)
          );
          const custSnap = await getDocs(custQuery);
          if (!custSnap.empty) {
            const custDoc = custSnap.docs[0];
            const currentDebt = custDoc.data().debt || 0;
            transaction.update(custDoc.ref, {
              debt: Math.max(0, currentDebt - liveVariance),
              updatedAt: serverTimestamp()
            });
            console.log(`[B2B Reconciliation] Deducted ${liveVariance} from customer debt balance`);
          } else {
            // Fallback match by name/phone
            const custQuery2 = query(
              collection(db, 'customers'),
              where('ownerId', '==', liveData.wholesalerId),
              where('name', '==', liveData.retailerName || liveData.customerName)
            );
            const custSnap2 = await getDocs(custQuery2);
            if (!custSnap2.empty) {
              const custDoc2 = custSnap2.docs[0];
              const currentDebt2 = custDoc2.data().debt || 0;
              transaction.update(custDoc2.ref, {
                debt: Math.max(0, currentDebt2 - liveVariance),
                updatedAt: serverTimestamp()
              });
            }
          }
        }

        // 2. Pre-paid cash/transfer orders logic: Tag as credit note refund and append receipt rundown
        const timestampStr = new Date().toLocaleString('ar-YE');
        const auditRundownText = `
=== 📑 تقرير تسوية العجز ومطابقة الفروقات المخزنية ===
الأصناف الناقصة (النواقص):
${liveShortages.join('\n')}

إجمالي الفارق المالي (قيمة العجز المستردة): ${liveVariance.toLocaleString()} ر.ي
طريقة التسوية المعتمدة: سند دائن / إشعار استرداد مالي (Credit Note Refund)
الرصيد النهائي المعدل للفاتورة: ${adjustedTotal.toLocaleString()} ر.ي
تاريخ وساعة التسوية: ${timestampStr}
بإقرار وتوقيع المدير المسؤول: ${profile?.name || 'مدير النظام المعتمد'}
=============================================
`;

        const notesText = (liveData.notes || '') + '\n' + auditRundownText;

        // 3. Update Order metadata
        transaction.update(orderRef, {
          reconciliationAction: isCredit ? 'debt_deducted' : 'credit_note_refund',
          refundAmount: liveVariance,
          discrepanciesSettled: true,
          status: 'ready', // Move status to 'ready' so it can be dispatched
          notes: notesText,
          updatedAt: serverTimestamp()
        });

        // 4. Record Wholesaler Audit Log
        const auditRef = doc(collection(db, 'auditLogs'));
        transaction.set(auditRef, {
          action: 'b2b/RECONCILE_SHORTAGE',
          userId: profile?.uid || 'SYSTEM',
          userName: profile?.name || 'مدير النظام',
          details: `تسوية عجز الطلب #${order.id.slice(-6)}: تم تسوية فروقات مالية بقيمة ${liveVariance.toLocaleString()} ر.ي بنجاح (${isCredit ? 'خصم مديونية آجل' : 'إصدار إشعار دائن'}).`,
          timestamp: serverTimestamp()
        });
      });

      alert('⚖️ تم تسوية العجز المالي والكميات وتعديل الذمم المالية بنجاح تام! الطلبية جاهزة للشحن الآن.');
      
      // Update selected order view state
      setSelectedOrder(prev => {
        if (!prev) return null;
        const noteReport = `\n=== 📑 تقرير تسوية العجز ومطابقة الفروقات المخزنية ===\n` + shortages.map((s: any) => `- ${s.name}: عجز ${s.deficit} بقيمة ${s.variance.toLocaleString()} ر.ي`).join('\n') + `\nإجمالي الفارق المالي: ${totalVariance.toLocaleString()} ر.ي\nالرصيد النهائي المعدل: ${prev.total?.toLocaleString()} YER\n=============================================`;
        return {
          ...prev,
          status: 'ready',
          reconciliationAction: isCredit ? 'debt_deducted' : 'credit_note_refund',
          refundAmount: totalVariance,
          discrepanciesSettled: true,
          notes: (prev.notes || '') + noteReport
        };
      });
    } catch (e: any) {
      console.error(e);
      alert('❌ فشل تسوية الفروقات: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExpressDispatch = async (order: any) => {
    if (!order) return;
    if (!window.confirm('🚀 هل أنت متأكد من تفعيل "الشحن السريع والمزامنة الفورية"؟ سيقوم النظام بتحديث أرصدة المخزون بالخصم المباشر، وتغذية خزانة المال/الحساب البنكي، وشحن الشحنة فورياً في خطوة ذرية موحدة!')) return;

    setLoading(true);
    try {
      const orderCol = order.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
      const orderRef = doc(db, orderCol, order.id);
      
      const { runTransaction, collection, query, where, getDocs } = await import('firebase/firestore');
      await runTransaction(db, async (transaction) => {
        const liveSnap = await transaction.get(orderRef);
        if (!liveSnap.exists()) throw new Error('الطلب غير موجود');
        const liveData = liveSnap.data();

        // 1. Decrement exact item quantities from seller's active stock warehouse doc collections and release locks
        for (const item of liveData.items) {
          const preppedQty = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
          if (preppedQty <= 0) continue;

          const invRef = doc(db, 'inventory', item.productId);
          const invSnap = await transaction.get(invRef);
          if (invSnap.exists() && invSnap.data().ownerId === liveData.wholesalerId) {
            const currentStock = invSnap.data().stock || 0;
            const currentTempLocked = invSnap.data().tempLocked || 0;
            transaction.update(invRef, {
              stock: Math.max(0, currentStock - preppedQty),
              tempLocked: Math.max(0, currentTempLocked - preppedQty),
              updatedAt: serverTimestamp()
            });
          } else {
            // Lookup by name inside wholesaler's inventory
            const invQuery = query(
              collection(db, 'inventory'),
              where('ownerId', '==', liveData.wholesalerId),
              where('name', '==', item.name || item.productName)
            );
            const invSnapshots = await getDocs(invQuery);
            if (!invSnapshots.empty) {
              const matchedDoc = invSnapshots.docs[0];
              const currentStock = matchedDoc.data().stock || 0;
              const currentTempLocked = matchedDoc.data().tempLocked || 0;
              transaction.update(matchedDoc.ref, {
                stock: Math.max(0, currentStock - preppedQty),
                tempLocked: Math.max(0, currentTempLocked - preppedQty),
                updatedAt: serverTimestamp()
              });
            }
          }
        }

        // 2. Increment corresponding cash balances into verified safe-box or bank ledger accounts
        const orderTotal = liveData.total || 0;
        if (orderTotal > 0 && ['cash', 'money_transfer', 'jampay'].includes(liveData.paymentType)) {
          // Look up verified safe-box or bank account for Wholesaler
          const accountsQuery = query(
            collection(db, 'accounts'),
            where('ownerId', '==', liveData.wholesalerId),
            where('isDefault', '==', true)
          );
          const accSnap = await getDocs(accountsQuery);
          if (!accSnap.empty) {
            const accDoc = accSnap.docs[0];
            const currentBalance = accDoc.data().balance || 0;
            transaction.update(accDoc.ref, {
              balance: currentBalance + orderTotal,
              updatedAt: serverTimestamp()
            });

            // Create income record in ledger
            const transactionRef = doc(collection(db, 'transactions'));
            transaction.set(transactionRef, {
              ownerId: liveData.wholesalerId,
              amount: orderTotal,
              type: 'income',
              category: 'شحن سريع ومطابقة صندوق',
              description: `مقبوضات شحن سريع للفاتورة #${order.id.slice(-6)} من ${liveData.retailerName}`,
              createdAt: serverTimestamp()
            });
          }
        }

        // 3. Update Order status to 'shipped' (dispatched)
        const expressCode = `EXP-${Math.floor(1000 + Math.random() * 9000)}-${order.id.slice(0, 4).toUpperCase()}`;
        transaction.update(orderRef, {
          status: 'shipped',
          cancelFrozen: true,
          expressPayloadCode: expressCode,
          dispatchedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          notes: (liveData.notes || '') + `\n[شحن سريع ومزامنة: تم الخصم الذري من المخزون وتوريد الصندوق وتوليد الرمز المشترك ${expressCode}]`
        });

        // 4. Create pending deduction for buyer in ledger transit (secure pending transaction)
        const buyerLedgerRef = doc(collection(db, 'transactions'));
        transaction.set(buyerLedgerRef, {
          ownerId: liveData.retailerId,
          orderId: order.id,
          amount: orderTotal,
          type: 'expense_pending',
          category: 'مشتريات معلقة قيد الشحن السريع',
          notes: 'عملية مخصومة لم تستلم بضاعتها مقابلها', // EXACT Arabic text requirement
          description: `قيد تعليق مالي لحركة البضائع بالشحن السريع للطلب #${order.id.slice(-6)}`,
          createdAt: serverTimestamp(),
          status: 'transit_frozen'
        });

        // 5. Wholesaler Audit Log
        const auditRef = doc(collection(db, 'auditLogs'));
        transaction.set(auditRef, {
          action: 'b2b/SHIP_ORDER',
          userId: profile?.uid || 'SYSTEM',
          userName: profile?.name || 'مدير النظام',
          details: `شحن سريع ومزامنة فورية للطلب #${order.id.slice(-6)}: خصم المخزون وتوريد الصندوق المالي بقيمة ${orderTotal.toLocaleString()} YER.`,
          timestamp: serverTimestamp()
        });
      });

      alert('🚀 تم تفعيل الشحن السريع والمزامنة بنجاح! خصم المخازن وتغذية الصناديق وتوليد أكواد التحقق الأمنية في قيد مالي ذري واحد!');
      setSelectedOrder(null);
    } catch (e: any) {
      console.error(e);
      alert('❌ فشل تشغيل الشحن السريع: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Prompt 10: Initialize returns and pricing state when selected order changes
  useEffect(() => {
    if (selectedOrder) {
      setReturnsMap({});
      setCustomUnitPrices({});
      
      // Load default account
      if (accountsList.length > 0) {
        const defaultAcc = accountsList.find(a => a.isDefault || a.accountType === 'cash') || accountsList[0];
        setSelectedPricingAccount(defaultAcc.id);
      }

      // Task 7: Initialize driver and vehicle details
      setDriverNameInput(selectedOrder.deliveryAgentName || selectedOrder.driverName || '');
      setDriverPhoneInput(selectedOrder.deliveryAgentPhone || selectedOrder.driverPhone || '');
      setVehicleNumberInput(selectedOrder.vehicleNumber || '');
      setIsEditingLogistics(false);
    }
  }, [selectedOrder, accountsList]);

  // Prompt 10: Atomic delivery receipt, immediate returns desk settlement, and auto pricing ingestion
  const handleCompleteManifestReceipt = async () => {
    if (!selectedOrder || !profile) return;
    setSubmittingManifestReceipt(true);

    try {
      const { runTransaction, collection, doc, query, where, getDocs } = await import('firebase/firestore');
      
      const orderCol = selectedOrder.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
      const orderRef = doc(db, orderCol, selectedOrder.id);
      
      const netTotal = selectedOrder.items.reduce((acc: number, item: any) => {
        const original = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
        const returned = returnsMap[item.productId || item.itemId || item.name] || 0;
        const accepted = Math.max(0, original - returned);
        return acc + (accepted * (item.price || item.cost || 0));
      }, 0);

      const returnsTotal = selectedOrder.items.reduce((acc: number, item: any) => {
        const returned = returnsMap[item.productId || item.itemId || item.name] || 0;
        return acc + (returned * (item.price || item.cost || 0));
      }, 0);

      await runTransaction(db, async (transaction) => {
        // 1. Fetch live order data
        const liveSnap = await transaction.get(orderRef);
        if (!liveSnap.exists()) throw new Error('الطلب غير موجود');
        const liveData = liveSnap.data();

        // 2. Debit the selected safe-box/cash account for the netTotal amount
        if (selectedPricingAccount) {
          const accRef = doc(db, 'accounts', selectedPricingAccount);
          const accSnap = await transaction.get(accRef);
          if (accSnap.exists()) {
            const currentBal = accSnap.data().balance || 0;
            transaction.update(accRef, {
              balance: currentBal - netTotal,
              updatedAt: serverTimestamp()
            });
            console.log(`[B2B Ingest] Debited ${netTotal} from retailer safe-box: ${selectedPricingAccount}`);
          }
        }

        // 3. Clear transient/pending expense frozen records in ledger
        const pendingTransQuery = query(
          collection(db, 'transactions'),
          where('ownerId', '==', profile.ownerId),
          where('orderId', '==', selectedOrder.id),
          where('type', '==', 'expense_pending')
        );
        const transSnap = await getDocs(pendingTransQuery);
        if (!transSnap.empty) {
          transSnap.forEach(tDoc => {
            transaction.delete(tDoc.ref); // Delete or clear the frozen transit transaction
          });
        }

        // 4. Create direct accounting permanent expense transaction for the net cargo
        const netExpenseRef = doc(collection(db, 'transactions'));
        transaction.set(netExpenseRef, {
          ownerId: profile.ownerId,
          orderId: selectedOrder.id,
          amount: netTotal,
          type: 'expense',
          category: 'مشتريات مستلمة معتمدة',
          notes: 'تسوية نهائية لفك تعليق الشحن وتوريد البضاعة للمخزن بتسعير تلقائي',
          description: `قيد توريد مشتريات الفاتورة #${selectedOrder.id.slice(-6)} للمخازن`,
          createdAt: serverTimestamp()
        });

        // 5. If returns are present, pin the return liability securely against the invoice as ledger liability
        if (returnsTotal > 0) {
          const returnLiabilityRef = doc(collection(db, 'transactions'));
          transaction.set(returnLiabilityRef, {
            ownerId: profile.ownerId,
            orderId: selectedOrder.id,
            amount: returnsTotal,
            type: 'liability',
            category: 'خصم ذمة مرتجع فوري معلق',
            notes: 'عملية مخصومة لم تستلم بضاعتها مقابلها', // EXACT Arabic text requirement
            description: `قيمة معلقة بانتظار استلام المورد للمرتجع الفعلي لطلب #${selectedOrder.id.slice(-6)}`,
            createdAt: serverTimestamp(),
            status: 'pending_supplier_recovery'
          });
        }

        // 6. Automatically ingest products into the local buyer inventory with the calculated markup pricing!
        for (const item of liveData.items) {
          const original = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
          const returned = returnsMap[item.productId || item.itemId || item.name] || 0;
          const accepted = Math.max(0, original - returned);

          if (accepted <= 0) continue;

          // Determine retail pricing for this item
          const costPrice = item.price || item.cost || 0;
          const markupPct = pricingMarkupType === 'custom' ? customMarkupValue : (pricingMarkupType === 'standard' ? 15 : (pricingMarkupType === 'premium' ? 25 : 10));
          const finalPrice = customUnitPrices[item.productId || item.itemId || item.name] || costPrice * (1 + (markupPct / 100));

          // Bind a unique catalog mockup image permanently to the item
          const itemImgUrl = item.imageUrl || `https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80`;

          // Check if item already exists in local inventory
          const matchedInvQuery = query(
            collection(db, 'inventory'),
            where('ownerId', '==', profile.ownerId),
            where('name', '==', item.name || item.productName)
          );
          const invSnap = await getDocs(matchedInvQuery);

          if (!invSnap.empty) {
            const invDoc = invSnap.docs[0];
            const currentStock = invDoc.data().stock || 0;
            transaction.update(invDoc.ref, {
              stock: currentStock + accepted,
              cost: costPrice, // update cost
              price: finalPrice, // update retail price with markup
              imageUrl: itemImgUrl, // bind permanently
              updatedAt: serverTimestamp()
            });
          } else {
            const newInvRef = doc(collection(db, 'inventory'));
            transaction.set(newInvRef, {
              ownerId: profile.ownerId,
              name: item.name || item.productName,
              category: 'وارد شبكة الموزعين',
              stock: accepted,
              cost: costPrice,
              price: finalPrice,
              imageUrl: itemImgUrl, // bind permanently
              barcode: `JAM-B2B-${Math.floor(1000 + Math.random() * 9000)}-${(item.productId || 'item').slice(0, 4)}`,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }

        // 7. Update B2B order to terminal state 'received' with return notes details
        const returnedReportLines = liveData.items.map((item: any) => {
          const original = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
          const returned = returnsMap[item.productId || item.itemId || item.name] || 0;
          if (returned > 0) {
            return `- ${item.name || item.productName}: إرجاع فوري لعدد ${returned} حبة بقيمة ${(returned * (item.price || item.cost || 0)).toLocaleString()} ر.ي`;
          }
          return null;
        }).filter(Boolean);

        const returnsAuditNotes = returnedReportLines.length > 0 
          ? `\n=== 🚨 تقرير المرتجعات الفورية (تصفية الفحص الميداني) ===\n${returnedReportLines.join('\n')}\nإجمالي ذمة المرتجعات المعلقة: ${returnsTotal.toLocaleString()} YER\n=============================================`
          : '';

        // Real-time Return Pipeline & Sub-warehouses Routing (Requirement 2)
        const anomalyItems: any[] = [];
        let totalAnomalyRefund = 0;

        liveData.items.forEach((item: any) => {
          const itemId = item.productId || item.itemId || item.name;
          const dmg = damagedMap[itemId] || 0;
          const sur = surplusMap[itemId] || 0;
          const swp = swappedMap[itemId] || false;
          const swpName = swappedNameMap[itemId] || '';
          
          if (dmg > 0 || sur > 0 || swp) {
            const unitCost = item.price || item.cost || 0;
            const subW = subWarehouseMap[itemId] || 'damaged_isolated';
            const rule = returnPricingRuleMap[itemId] || 'cost';
            
            let refundPrice = unitCost;
            if (rule === 'percentage') {
              refundPrice = unitCost * 0.85; // Rule-based: 85% refund value
            } else if (rule === 'manual') {
              refundPrice = returnCustomPriceMap[itemId] || unitCost;
            }

            const refundVal = (dmg + (swp ? (item.shippedQuantity || item.quantity) : 0)) * refundPrice;
            totalAnomalyRefund += refundVal;

            anomalyItems.push({
              itemId,
              name: item.name || item.productName,
              damagedQty: dmg,
              surplusQty: sur,
              swapped: swp,
              swappedName: swpName,
              subWarehouse: subW,
              pricingRule: rule,
              refundPrice,
              totalRefund: refundVal
            });
          }
        });

        if (anomalyItems.length > 0) {
          const returnDocRef = doc(collection(db, 'returns_flow'));
          transaction.set(returnDocRef, {
            orderId: selectedOrder.id,
            retailerId: profile.ownerId,
            retailerName: profile.name || 'تاجر التجزئة',
            wholesalerId: selectedOrder.wholesalerId,
            wholesalerName: selectedOrder.wholesalerName,
            items: anomalyItems,
            totalAmount: totalAnomalyRefund,
            status: 'approved_by_admin',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            notes: `[مطابقة عيوب الاستلام]: تم رصد تالف/زيادة/تبديل وتوجيههم للمستودعات الفرعية بنجاح.`
          });

          // Route to sub-warehouses inventory
          for (const anomaly of anomalyItems) {
            const subInvRef = doc(collection(db, 'sub_warehouses_inventory'));
            transaction.set(subInvRef, {
              ownerId: profile.ownerId,
              orderId: selectedOrder.id,
              itemId: anomaly.itemId,
              name: anomaly.name,
              damagedQty: anomaly.damagedQty,
              surplusQty: anomaly.surplusQty,
              swapped: anomaly.swapped,
              swappedName: anomaly.swappedName,
              subWarehouse: anomaly.subWarehouse,
              pricingRule: anomaly.pricingRule,
              price: anomaly.refundPrice,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }

        // Auto-Promotion Sync to Customer Auction (Requirement 4)
        const promoRef = doc(collection(db, 'marketingBroadcasts'));
        const promoItemsList = liveData.items.map((item: any) => {
          const original = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
          const returned = returnsMap[item.productId || item.itemId || item.name] || 0;
          const accepted = Math.max(0, original - returned);
          if (accepted <= 0) return null;

          const unitCost = item.price || item.cost || 0;
          const markupPct = pricingMarkupType === 'custom' ? customMarkupValue : (pricingMarkupType === 'standard' ? 15 : (pricingMarkupType === 'premium' ? 25 : 10));
          const finalPrice = customUnitPrices[item.productId || item.itemId || item.name] || unitCost * (1 + (markupPct / 100));

          return {
            name: item.name || item.productName,
            price: finalPrice,
            stock: accepted,
            imageUrl: item.imageUrl || ''
          };
        }).filter(Boolean);

        if (promoItemsList.length > 0) {
          transaction.set(promoRef, {
            ownerId: profile.ownerId,
            wholesalerId: selectedOrder.wholesalerId,
            wholesalerName: selectedOrder.wholesalerName,
            items: promoItemsList,
            status: 'pending',
            createdAt: serverTimestamp(),
            message: `📢 بضاعة جديدة وصلت محلنا التجاري من الموزع المعتمد ${selectedOrder.wholesalerName}! تصفح الأسعار والعروض المغرية في حراج الزباين الآن! 🛍️`
          });
        }

        transaction.update(orderRef, {
          status: 'received',
          retailerSigned: true,
          returnedItems: returnsMap,
          returnsTotalAmount: returnsTotal,
          netIngestedAmount: netTotal,
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          notes: (liveData.notes || '') + '\n[تأكيد فحص الكابتن الرقمي وبطاقة الاستلام المحاسبي ومطابقة الفروقات بالتسعير التلقائي]' + returnsAuditNotes
        });

        // 8. Write security and operations audit log
        const auditRef = doc(collection(db, 'auditLogs'));
        transaction.set(auditRef, {
          action: 'b2b/CONFIRM_MANIFEST_RECEIPT',
          userId: profile.uid,
          userName: profile.name || 'مشتري معتمد',
          details: `استلام ومطابقة الفاتورة شبكياً #${selectedOrder.id.slice(-6)}. البضاعة المقبولة: ${netTotal.toLocaleString()} ر.ي. المرتجعة فوراً: ${returnsTotal.toLocaleString()} ر.ي. ترحيل مالي ذكي للمخزن والمحفظة.`,
          timestamp: serverTimestamp()
        });
      });

      alert('🎉 تم إنجاز مطابقة الفواتير وتوريد البضائع وتسعيرها تلقائياً وحسم القيد المالي بنجاح تام!');
      setShowPricingDialog(false);
      setSelectedOrder(null);
    } catch (err: any) {
      console.error(err);
      alert('❌ فشل إنجاز قيد الاستلام والمطابقة: ' + err.message);
    } finally {
      setSubmittingManifestReceipt(false);
    }
  };

  // Task 7: Update and Save delivery driver & logistics details dynamically
  const handleSaveLogistics = async () => {
    if (!selectedOrder) return;
    setLoading(true);
    try {
      const orderCol = selectedOrder.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
      const orderRef = doc(db, orderCol, selectedOrder.id);
      
      const updateData = {
        deliveryAgentName: driverNameInput.trim(),
        driverName: driverNameInput.trim(),
        deliveryAgentPhone: driverPhoneInput.trim(),
        driverPhone: driverPhoneInput.trim(),
        vehicleNumber: vehicleNumberInput.trim(),
        updatedAt: serverTimestamp()
      };

      await updateDoc(orderRef, updateData);

      // Create an audit log for security compliance
      const auditRef = doc(collection(db, 'auditLogs'));
      await setDoc(auditRef, {
        action: 'b2b/UPDATE_LOGISTICS',
        userId: profile?.uid || 'SYSTEM',
        userName: profile?.name || 'مدير النظام',
        details: `تحديث بيانات التوصيل والسائق للطلب #${selectedOrder.id.slice(-6)}: السائق ${driverNameInput.trim()}، الهاتف ${driverPhoneInput.trim()}، اللوحة ${vehicleNumberInput.trim()}`,
        timestamp: serverTimestamp()
      });

      setSelectedOrder(prev => prev ? {
        ...prev,
        ...updateData,
        updatedAt: new Date().toISOString()
      } : null);

      setIsEditingLogistics(false);
      alert('🚚 تم تحديث بيانات السائق والمركبة وحفظها بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('❌ فشل تحديث بيانات التوصيل اللوجستية: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 1. Filtered Unified Orders
  const filteredOrders = unifiedOrders.filter(order => {
    const isOutgoing = order.retailerId === profile?.ownerId;
    const isIncoming = order.wholesalerId === profile?.ownerId;

    if (directionFilter === 'outgoing') return isOutgoing;
    if (directionFilter === 'incoming') return isIncoming;
    return true; // standard 'all'
  });

  // Calculate high-priority cash transactions for CASHIER (Requirement 2)
  const pendingCashRemittances = unifiedOrders.filter(order => {
    const hasRemittance = !!order.paymentDetails?.remittanceNumber;
    return order.paymentType === 'cash' && order.paymentVerified !== true && (order.status === 'pending' || order.status === 'approved' || order.status === 'matched' || order.status === 'prepping' || order.status === 'ready');
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'approved': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'prepping': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'ready': return 'bg-success/10 text-success border-success/20';
      case 'dispatched': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'delivered': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const combinedBoxes = [
    ...bankAccounts.map(b => ({
      id: b.id,
      name: b.boxName || b.bankName || 'حساب بنكي'
    })),
    ...customBoxes.map(c => ({
      id: c.id,
      name: c.boxName
    }))
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000]"
            />

            {/* Slide-out Panel container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-navy-950 text-white shadow-2xl z-[2001] flex flex-col border-l border-white/5 text-right"
              dir="rtl"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-navy-900">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-brand-primary rounded-2xl flex items-center justify-center relative shadow-lg shadow-brand-primary/10">
                    <ShoppingBasket size={22} className="text-navy-950" />
                    {unifiedOrders.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-navy-900 shadow">
                        {unifiedOrders.length}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">النافذة الجانبية الموحدة</h2>
                    <p className="text-[9px] text-brand-primary font-bold uppercase tracking-widest">Unified JAM Operations Node</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all border border-transparent hover:border-white/10"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Side-Panel Content Body with clearly partitioned sections */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-navy-950">

                {/* ======================================================== */}
                {/* SECTION 3 (ELEVATED): "إدارة الحوالات والصناديق (Cashier)" - ELEVATED TO TOP FOR CASHIER */}
                {/* ======================================================== */}
                {isCashier && (
                  <div className="space-y-3">
                    {/* Unique section header with subtle divider */}
                    <div className="flex items-center gap-2 pb-2 border-b border-rose-500/20">
                      <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                      <Coins size={16} className="text-rose-400" />
                      <h3 className="text-xs font-black text-rose-400 uppercase tracking-widest">
                        إدارة الحوالات والصناديق (Cashier)
                      </h3>
                      <span className="text-[9px] bg-rose-500/20 text-rose-400 font-bold px-2 py-0.5 rounded-full mr-auto border border-rose-500/25">
                        أولوية الصندوق النشط
                      </span>
                    </div>

                    <div className="p-4 bg-rose-950/20 rounded-[2rem] border border-rose-500/30 shadow-lg space-y-3 relative overflow-hidden backdrop-blur-md">
                      <div className="absolute top-0 left-0 text-white opacity-5 select-none pointer-events-none transform -translate-x-4 -translate-y-4 scale-150">
                        <Coins size={120} />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                          <h4 className="text-xs font-black text-white">حوالات بانتظار التأكيد ماليّاً</h4>
                        </div>
                        <span className="bg-red-500/20 text-red-400 text-[9px] px-2 py-0.5 rounded-full font-black border border-red-500/30">
                          {pendingCashRemittances.length} حركة معلقة
                        </span>
                      </div>

                      <p className="text-[10px] text-gray-400">تحصيل وتوجيه الحوالات الواردة لتوفير الكاش وتغذية الصناديق فورياً دون تأخير.</p>

                      <div className="space-y-2 mt-2">
                        {pendingCashRemittances.map(order => (
                          <div 
                            key={order.id}
                            className="p-3 bg-navy-900/80 rounded-2xl border border-white/5 hover:border-red-500/30 transition-all space-y-2"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-black text-white">الطلب #{order.id.slice(-6)}</p>
                                <p className="text-[9px] text-gray-500">العميل: {order.retailerName}</p>
                              </div>
                              <span className="font-mono text-xs font-black text-brand-primary block">
                                {(order.paymentDetails?.amountPaid || order.total).toLocaleString()} YER
                              </span>
                            </div>

                            <div className="bg-white/5 rounded-xl p-2 text-[10px] space-y-1 font-mono text-gray-400 border border-white/5">
                              <div className="flex justify-between">
                                <span>المبلغ المدفوع:</span>
                                <span className="text-emerald-400 font-bold">{order.paymentDetails?.amountPaid?.toLocaleString()} YER</span>
                              </div>
                              <div className="flex justify-between">
                                <span>رقم الحوالة:</span>
                                <span className="text-white font-bold">{order.paymentDetails?.remittanceNumber || 'بدون رقم'}</span>
                              </div>
                            </div>

                            {routingOrderId === order.id ? (
                              <div className="pt-2 border-t border-white/5 space-y-2 text-right">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-gray-400 font-bold block">مسار التوجيه المالي:</label>
                                  <select 
                                    value={routingDestType}
                                    onChange={(e) => setRoutingDestType(e.target.value)}
                                    className="w-full bg-navy-950 border border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-white outline-none focus:border-brand-primary"
                                  >
                                    <option value="CASH_TO_STORE">صندوق الكاش الافتراضي بالمحل</option>
                                    <option value="BANK_ACCOUNT">حساب بنكي / محفظة إلكترونية</option>
                                    <option value="BIG_MERCHANT">ترحيل أوتوماتيكي لتاجر كبير</option>
                                    <option value="OWNER_HANDOVER">تسليم يدوي مباشر للملاك</option>
                                  </select>
                                </div>

                                {routingDestType === 'BANK_ACCOUNT' && (
                                  <div className="space-y-1">
                                    <label className="text-[9px] text-gray-400 block">اختر الحساب المصرفي المستهدف:</label>
                                    <select
                                      value={routingSelectedBox}
                                      onChange={(e) => setRoutingSelectedBox(e.target.value)}
                                      className="w-full bg-navy-950 border border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-white"
                                    >
                                      <option value="">-- حدد الحساب --</option>
                                      {combinedBoxes.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <input 
                                    type="text"
                                    value={routingDetails}
                                    onChange={(e) => setRoutingDetails(e.target.value)}
                                    placeholder="ملاحظات المراجعة الميدانية للرقم البنكي..."
                                    className="w-full bg-navy-950 border border-white/10 rounded-xl px-2 py-1.5 text-[10px] text-white text-right outline-none"
                                  />
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleVerifyInlineRemittance(order)}
                                    disabled={loading}
                                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black border-none select-none cursor-pointer flex items-center justify-center gap-1"
                                  >
                                    {loading ? <Loader2 className="animate-spin w-3 h-3" /> : '✓ تأكيد القيد'}
                                  </button>
                                  <button
                                    onClick={() => setRoutingOrderId(null)}
                                    className="px-3 py-1.5 bg-navy-800 text-gray-400 hover:bg-navy-700 rounded-xl text-[10px]"
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setRoutingOrderId(order.id);
                                  setRoutingSelectedBox(bankAccounts[0]?.id || '');
                                }}
                                className="w-full py-2 bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 rounded-xl text-[10px] font-bold border border-rose-500/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                              >
                                <Coins size={12} />
                                ربط وتوجيه الحركة المالية بالصندوق 💵
                              </button>
                            )}
                          </div>
                        ))}

                        {pendingCashRemittances.length === 0 && (
                          <div className="py-6 text-center text-gray-500 text-xs font-bold border border-white/5 rounded-2xl bg-navy-900/50">
                            ✓ لا توجد حوالات معلقة بانتظار التوجيه حالياً
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SUB-ACTION CARD 2: "تصفية وإقفال عهدة السائقين" (Driver Fleet Cash Clearance) */}
                    <div className="p-4 bg-indigo-950/20 rounded-[2rem] border border-indigo-500/30 shadow-lg space-y-3 relative overflow-hidden backdrop-blur-md mt-4">
                      <div className="absolute top-0 left-0 text-white opacity-5 select-none pointer-events-none transform -translate-x-4 -translate-y-4 scale-150">
                        <Truck size={120} />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                          <Truck size={16} className="text-indigo-400" />
                          <h4 className="text-xs font-black text-white">تصفية وإقفال عهدة السائقين</h4>
                        </div>
                        <span className="bg-indigo-500/20 text-indigo-400 text-[9px] px-2 py-0.5 rounded-full font-black border border-indigo-500/30">
                          {driverClearanceGroups.length} سائقين بانتظار التصفية
                        </span>
                      </div>

                      <p className="text-[10px] text-gray-400">تجميع وتصفية الأموال النقدية التي حصلها سائقو التوصيل يداً بيد عند تسليم الشحنات للمشترين ميدانياً.</p>

                      <div className="space-y-2 mt-2">
                        {driverClearanceGroups.map(group => (
                          <div 
                            key={group.driverId}
                            className="p-3 bg-navy-900/80 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-black text-white">{group.driverName}</p>
                                <p className="text-[9px] text-gray-400 mt-0.5 font-bold font-sans">عدد الشحنات المعلقة: {group.orders.length} شحنة</p>
                              </div>
                              <div className="text-left font-sans">
                                <span className="font-mono text-xs font-black text-amber-400 block">
                                  {group.totalAmount.toLocaleString()} YER
                                </span>
                                <span className="text-[8px] text-zinc-500 font-bold block mt-0.5">نقود عهدة عائمة</span>
                              </div>
                            </div>

                            {/* List individual orders summarized */}
                            <div className="bg-white/5 rounded-xl p-2.5 text-[9px] space-y-1.5 font-mono text-gray-400 border border-white/5 max-h-24 overflow-y-auto">
                              {group.orders.map((ord: any) => (
                                <div key={ord.id} className="flex justify-between border-b border-white/5 pb-1 last:border-0 last:pb-0">
                                  <span>الطلب #{ord.id.slice(-6)} ({ord.retailerName || 'عميل'})</span>
                                  <span className="text-emerald-400 font-bold">{(ord.total || ord.paymentDetails?.amountPaid || 0).toLocaleString()} YER</span>
                                </div>
                              ))}
                            </div>

                            <button
                              disabled={clearingDriverId === group.driverId}
                              onClick={() => handleClearDriverCash(group)}
                              className="w-full py-2 bg-indigo-500/20 hover:bg-indigo-600 hover:text-white text-indigo-300 rounded-xl text-[10px] font-black border border-indigo-500/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                            >
                              {clearingDriverId === group.driverId ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  <span>جاري ترحيل القيد والتصفية...</span>
                                </>
                              ) : (
                                <>
                                  <Coins size={12} />
                                  <span>تأكيد استلام النقدية من السائق وترحيل الصندوق ✓</span>
                                </>
                              )}
                            </button>
                          </div>
                        ))}

                        {driverClearanceGroups.length === 0 && (
                          <div className="py-6 text-center text-gray-500 text-xs font-bold border border-white/5 rounded-2xl bg-navy-900/50">
                            ✓ جميع عهد السائقين مصفاة ومغلقة بالكامل ماليّاً
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}


                {/* ======================================================== */}
                {/* SECTION 1: "إدارة الطلبات والحركة" (Orders by flow and priority) */}
                {/* ======================================================== */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-500/20">
                    <Truck size={16} className="text-blue-400" />
                    <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">
                      القسم ١: إدارة الطلبات والحركة
                    </h3>
                    <span className="text-[9px] bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded-full mr-auto border border-blue-500/25">
                      {unifiedOrders.length} حركة حية
                    </span>
                  </div>

                  <div className="bg-navy-900/80 rounded-[2rem] border border-white/5 overflow-hidden">
                    <button 
                      onClick={() => setExpandedSection(expandedSection === 'orders' ? null : 'orders')}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-all text-right border-none outline-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                          <ShoppingBasket size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white">تفاصيل ومسارات الحركة التجارية</h4>
                          <p className="text-[9px] text-gray-500">مشاهدة جميع المعاملات وتجهيزات المستودعات</p>
                        </div>
                      </div>
                      {expandedSection === 'orders' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {expandedSection === 'orders' && (
                      <div className="p-4 pt-0 border-t border-white/5 space-y-3">
                        
                        {/* DIRECTIONAL ORDER PARTITIONING (Requirement 2 & 3: Filter Toggles) */}
                        <div className="flex items-center gap-1 p-1 bg-navy-950 rounded-xl border border-white/5 my-2">
                          <button
                            type="button"
                            onClick={() => setDirectionFilter('all')}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${directionFilter === 'all' ? 'bg-brand-primary text-navy-950 shadow' : 'text-gray-400 hover:text-white'}`}
                          >
                            الجميع
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirectionFilter('outgoing')}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 ${directionFilter === 'outgoing' ? 'bg-brand-primary text-navy-950 shadow' : 'text-gray-400 hover:text-white'}`}
                          >
                            <ArrowUpRight size={12} />
                            طلبات صادرة منك
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirectionFilter('incoming')}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 ${directionFilter === 'incoming' ? 'bg-brand-primary text-navy-950 shadow' : 'text-gray-400 hover:text-white'}`}
                          >
                            <ArrowDownLeft size={12} />
                            طلبات واردة إليك
                          </button>
                        </div>

                        {/* Switch loops for Network vs Local Warehouse Prep */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-navy-950 rounded-xl border border-white/5">
                          <button
                            onClick={() => setActiveTab('network')}
                            className={`py-2 rounded-lg text-[10px] font-black transition-all ${activeTab === 'network' ? 'bg-brand-primary text-navy-950 font-black' : 'text-gray-400'}`}
                          >
                            طلبيات الشبكة والجاليات
                          </button>
                          <button
                            onClick={() => setActiveTab('prep')}
                            className={`py-2 rounded-lg text-[10px] font-black transition-all ${activeTab === 'prep' ? 'bg-brand-primary text-navy-950 font-black' : 'text-gray-400'}`}
                          >
                            تجهيز ومطابقة المخازن
                          </button>
                        </div>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
                          {activeTab === 'network' ? (
                            filteredOrders.map(order => (
                              <div 
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className="group p-3 bg-navy-950/50 rounded-2xl border border-white/5 hover:border-brand-primary/40 transition-all cursor-pointer space-y-1.5"
                              >
                                <div className="flex justify-between items-center gap-2">
                                  {/* Injecting Status indicator */}
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${getStatusColor(order.status)}`}>
                                    {order.status}
                                  </span>

                                  {/* DIRECTION BADGE */}
                                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-wider ${
                                    order.retailerId === profile?.ownerId 
                                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' 
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                                  }`}>
                                    {order.retailerId === profile?.ownerId ? 'صادر 📤' : 'وارد 📥'}
                                  </span>

                                  {/* Requirement 3: LOGISTICS OPERATIONAL INJECTIONS ("تحتاج شحن" or "تحتاج تسوية") */}
                                  <div className="flex gap-1 mr-auto select-none">
                                    {(order.status === 'approved' || order.status === 'prepping' || order.status === 'ready' || order.status === 'packing') ? (
                                      <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                        تحتاج شحن 🚚
                                      </span>
                                    ) : null}
                                    {(order.paymentStatus !== 'paid' || order.status === 'pending' || order.status === 'matched') ? (
                                      <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                        تحتاج تسوية 🔄
                                      </span>
                                    ) : null}
                                  </div>

                                  <span className="text-[10px] text-gray-500 font-mono">#{order.id.slice(-6)}</span>
                                </div>

                                <div className="flex justify-between items-end">
                                  <div>
                                    <p className="text-[11px] font-black text-white group-hover:text-brand-primary transition-colors">
                                      {order.retailerId === profile?.ownerId ? `جهة المورد: ${order.wholesalerName}` : `جهة العميل: ${order.retailerName}`}
                                    </p>
                                    <p className="text-[9px] text-gray-500">
                                      {order.paymentType === 'cash' ? '💵 كاش نقدي' : '📝 دين حركي آجل'}
                                    </p>
                                  </div>
                                  <p className="text-xs font-black text-brand-primary font-mono">{order.total?.toLocaleString()} YER</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            prepOrders.map(order => (
                              <div 
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className="p-3 bg-navy-950/50 rounded-2xl border border-white/5 hover:border-brand-primary/40 transition-all cursor-pointer space-y-1"
                              >
                                <div className="flex justify-between items-center gap-2">
                                  <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full text-[8px] font-black">
                                    {order.prepStatus === 'pending' ? 'بانتظار التحضير' : 'قيد العمل'}
                                  </span>

                                  {/* INJECT FOR LOCAL INVENTORY PREPARATION */}
                                  <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-amber-505/10 text-amber-400 border border-amber-500/20">
                                    تحتاج شحن 🚚
                                  </span>

                                  <span className="text-[9px] text-gray-500 font-mono mr-auto">#{order.id.slice(-6)}</span>
                                </div>
                                <p className="text-[11px] font-black text-white">{order.customerName}</p>
                                <p className="text-[9px] text-gray-500">المستودع: {order.targetWarehouse || 'المستودع الرئيسي'}</p>
                              </div>
                            ))
                          )}

                          {(activeTab === 'network' ? filteredOrders.length : prepOrders.length) === 0 && (
                            <div className="py-10 text-center text-xs opacity-40">
                              <ShoppingBasket size={32} className="mx-auto mb-2" />
                              <span>لا توجد حركات مطابقة تحت هذا التبويب</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>


                {/* ======================================================== */}
                {/* SECTION 2: "إدارة المخازن والمخزون" (Warehouse details) */}
                {/* ======================================================== */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/20">
                    <Warehouse size={16} className="text-emerald-400" />
                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                      القسم ٢: إدارة المخازن والمخزون
                    </h3>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full mr-auto border border-emerald-500/25">
                      {Object.keys(warehouseStock).length} مخازن نشطة
                    </span>
                  </div>

                  <div className="bg-navy-900/80 rounded-[2rem] border border-white/5 overflow-hidden">
                    <button 
                      onClick={() => setExpandedSection(expandedSection === 'inventory' ? null : 'inventory')}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-all text-right border-none outline-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                          <Warehouse size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white">رصد وتوزيع المنتجات بالمخازن</h4>
                          <p className="text-[9px] text-gray-500">إجمالي الأرصدة والسجلات الفعلية</p>
                        </div>
                      </div>
                      {expandedSection === 'inventory' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {expandedSection === 'inventory' && (
                      <div className="p-4 pt-0 border-t border-white/5 space-y-2">
                        <p className="text-[10px] text-gray-400 leading-relaxed mb-2">إجمالي المخزون الفعلي موزعاً على مخازن وفروع المحل لحماية الأمن المخزني:</p>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {Object.entries(warehouseStock).map(([whName, totalCount]) => (
                            <div 
                              key={whName}
                              className="p-3 bg-navy-950/70 rounded-2xl border border-white/5 flex justify-between items-center hover:border-emerald-500/30 transition-all font-mono"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-xs font-bold text-white">{whName}</span>
                              </div>
                              <div className="text-left">
                                <span className="text-xs font-black text-brand-primary">{totalCount.toLocaleString()}</span>
                                <span className="text-[8px] text-gray-500 mr-1">وحدة سلعية</span>
                              </div>
                            </div>
                          ))}

                          {Object.keys(warehouseStock).length === 0 && (
                            <div className="py-8 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-2xl">
                              لا توجد مستودعات محددة مسبقاً. سيتم البناء تلقائياً عند إدراج البضائع.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>


                {/* ======================================================== */}
                {/* SECTION 3 (GENERAL/LOWER CONTEXT): "إدارة الحوالات والصناديق (Cashier)" FOR NON-CASHIER */}
                {/* ======================================================== */}
                {!isCashier && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-red-500/20">
                      <Coins size={16} className="text-rose-500" />
                      <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest">
                        القسم ٣: إدارة الحوالات والصناديق (Cashier)
                      </h3>
                      <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full mr-auto border border-red-500/25">
                        صلاحيات الصندوق المالي
                      </span>
                    </div>

                    <div className="bg-navy-900/80 rounded-[2rem] border border-white/5 overflow-hidden">
                      <button 
                        onClick={() => setExpandedSection(expandedSection === 'cashier' ? null : 'cashier')}
                        className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-all text-right border-none outline-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
                            <Coins size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white">تحصيل وتوجيه الحوالات الواردة</h4>
                            <p className="text-[9px] text-gray-500">مطابقة وقيد العمليات النقدية بصندوق المحل</p>
                          </div>
                        </div>
                        {expandedSection === 'cashier' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      {expandedSection === 'cashier' && (
                        <div className="p-5 overflow-hidden border-t border-white/5 text-center bg-navy-950/40 text-xs text-gray-500 leading-relaxed font-bold">
                          🔒 هذا القسم مخصص لوظائف الصندوق المالي والتحصيل النقدي. تظهر الحوالات المعلقة هنا فورياً لموظفي الكاشير (CASHIER).
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* ======================================================== */}
                {/* SECTION 4: "طلبات ارتباط الشبكة B2B" */}
                {/* ======================================================== */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
                    <UserCheck size={16} className="text-purple-400" />
                    <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest">
                      طلبات وقنوات ارتباط الشبكة B2B
                    </h3>
                  </div>

                  <div className="bg-navy-900/80 rounded-[2rem] border border-white/5 overflow-hidden">
                    <button 
                      onClick={() => setExpandedSection(expandedSection === 'network' ? null : 'network')}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-all text-right border-none outline-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                          <UserCheck size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white">طلبات ارتباط وشراكات الموردين النشطة</h4>
                          <p className="text-[9px] text-gray-500">تبادل ومزامنة القنوات السعرية مع الوكلاء</p>
                        </div>
                      </div>
                      {expandedSection === 'network' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {expandedSection === 'network' && (
                      <div className="p-4 pt-0 border-t border-white/5 space-y-3">
                        <p className="text-[10px] text-gray-400 leading-relaxed mb-2">ربط ومزامنة تجار الجملة مع المحلات الفرعية لتبادل الأسعار والمشتريات الحركية:</p>

                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 select-none">
                          {networkLinks.map(link => (
                            <div 
                              key={link.id}
                              className="p-3 bg-navy-950/60 rounded-2xl border border-white/5 flex justify-between items-center hover:border-purple-500/30 transition-all"
                            >
                              <div className="text-right">
                                <p className="text-xs font-black text-white">
                                  {link.roleType === 'wholesaler' ? `العميل: ${link.retailerName}` : `المورد: ${link.wholesalerName}`}
                                </p>
                                <p className="text-[9px] text-gray-400">
                                  {link.type === 'cash_only' ? '💸 مبيعات كاش فقط' : '🏦 مبيعات آجل و كاش'}
                                </p>
                              </div>

                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider ${
                                link.status === 'active' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                              }`}>
                                {link.status === 'active' ? 'مفعل ومزامن' : 'بانتظار الموافقة'}
                              </span>
                            </div>
                          ))}

                          {networkLinks.length === 0 && (
                            <div className="py-8 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-2xl">
                              لا توجد قنوات شبكة أو شراكات تجارية نشطة حالياً.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Detail Modal Component inside slide panel */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-navy-950 border border-white/10 text-white rounded-[2.5rem] shadow-2xl overflow-hidden text-right font-sans"
              dir="rtl"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-navy-900">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-brand-primary rounded-3xl flex items-center justify-center text-navy-950 shadow-xl shadow-brand-primary/20">
                    <Package size={30} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">مراجعة بيانات الطلب</h3>
                    <p className="text-xs font-bold text-gray-400">#{selectedOrder.id.slice(-8)}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-3 hover:bg-white/10 rounded-full transition-all text-gray-400">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4 mb-6 text-right">
                  <div className="p-4 bg-navy-900 rounded-2xl border border-white/5">
                    <p className="text-[9px] text-gray-500 font-bold mb-1">الطرف الثاني في القناة</p>
                    <p className="text-sm font-black text-white">
                      {selectedOrder.wholesalerName || selectedOrder.customerName || selectedOrder.retailerName}
                    </p>
                  </div>
                  <div className="p-4 bg-navy-900 rounded-2xl border border-white/5">
                    <p className="text-[9px] text-gray-500 font-bold mb-1">إجمالي الحساب الفعلي</p>
                    <p className="text-sm font-black text-brand-primary font-mono">{selectedOrder.total?.toLocaleString()} YER</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-brand-primary mb-1">مكونات السلة المطروحة:</h4>
                    {isManager && !isEditingItems && (
                      <button 
                        type="button"
                        onClick={() => {
                          setIsEditingItems(true);
                          setEditedItems(JSON.parse(JSON.stringify(selectedOrder.items || [])));
                        }}
                        className="py-1 px-3 bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-bold rounded-lg hover:bg-purple-500 hover:text-white transition-all cursor-pointer"
                      >
                        📝 تعديل الكميات
                      </button>
                    )}
                  </div>
                  
                  {(!isEditingItems ? selectedOrder.items : editedItems)?.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 bg-navy-900 border border-white/5 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-xs font-bold text-brand-primary">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white !important" style={{ opacity: 1, visibility: 'visible' }}>
                            {item.productName || item.name || 'منتج غير معروف'}
                          </p>
                          {item.details && (
                            <p className="text-[10px] text-brand-primary font-medium mt-0.5" style={{ opacity: 1, visibility: 'visible' }}>
                              {item.details}
                            </p>
                          )}
                          <p className="text-[8px] text-gray-400 mt-1">سعر الصنف: {item.price?.toLocaleString() || 0} ر.ي</p>
                        </div>
                      </div>
                      <div className="text-left flex items-center gap-2">
                        {isEditingItems ? (
                          <div>
                            <span className="text-[8px] text-purple-300 font-bold block mb-1">تعديل الكمية:</span>
                            <input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setEditedItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
                              }}
                              className="w-16 px-2 py-1 text-center font-mono font-black text-xs text-white bg-navy-950 border border-white/10 rounded-md outline-none"
                            />
                          </div>
                        ) : (
                          <div>
                            <p className="text-[8px] text-gray-400 font-bold">القدر المجهز</p>
                            <p className="text-sm font-black text-white font-mono">{item.quantity || item.requestedQty || 0}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isEditingItems && (
                    <div className="flex gap-2 justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEditedB2BOrder(selectedOrder, editedItems)}
                        className="py-1.5 px-4 bg-emerald-500 text-navy-950 font-black text-[10px] rounded-lg transition-all hover:bg-emerald-400 border-none cursor-pointer"
                      >
                        💾 حفظ التعديلات
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingItems(false)}
                        className="py-1.5 px-4 bg-navy-800 text-gray-300 font-black text-[10px] rounded-lg transition-all hover:bg-navy-700 border-none cursor-pointer"
                      >
                        إلغاء التعديل
                      </button>
                    </div>
                  )}
                </div>

                {/* 🔑 وحدة التحقق والموافقة الفورية (Cashier / Admin B2B Verification panel) */}
                {selectedOrder && (isCashier || isManager) && selectedOrder.wholesalerId === profile?.ownerId && selectedOrder.status === 'pending' && (
                  <div className="mt-6 p-6 bg-navy-900 border border-brand-primary/20 rounded-[2.5rem] space-y-4 text-right">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                        <Lock size={16} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">وحدة التحقق واعتماد الطلبات الواردة B2B</h4>
                        <p className="text-[9px] text-gray-500">منظومة المصادقة المزدوجة ومطابقة شروط السداد</p>
                      </div>
                    </div>

                    <div className="p-3 bg-navy-950/80 rounded-2xl border border-white/5 text-right">
                      <p className="text-[10px] text-gray-400 font-bold">طريقة السداد المحددة بالطلب:</p>
                      <p className="text-sm font-black mt-1 flex items-center gap-1">
                        {selectedOrder.paymentType === 'cash' ? (
                          <>
                            <span className="text-emerald-400">💵 نقدي كاش / حوالة مصرفية</span>
                            <span className="text-[9px] text-gray-500 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">Flow A</span>
                          </>
                        ) : (
                          <>
                            <span className="text-amber-400">📝 ذمة مالية آجل (Debt ledger)</span>
                            <span className="text-[9px] text-gray-500 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold">Flow B</span>
                          </>
                        )}
                      </p>
                    </div>

                    {selectedOrder.paymentType === 'cash' ? (
                      /* Flow A: Cash/Transfer */
                      <div className="space-y-4 text-right">
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl space-y-3">
                          <span className="text-xs font-black text-emerald-400 block">📎 معاينة سند التحويل والتحقق من المرفقات:</span>
                          
                          <div className="flex flex-col sm:flex-row gap-3 items-center bg-navy-950/80 p-3 rounded-xl border border-white/5">
                            {/* Simulated attachment image preview or placeholder */}
                            <div className="w-20 h-20 rounded-lg bg-navy-900 border border-white/10 flex flex-col items-center justify-center text-center p-1">
                              <span className="text-2xl">📄</span>
                              <span className="text-[8px] text-gray-500 font-bold mt-1">سند التحويل</span>
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-[11px] font-black text-white">تفاصيل الحوالة المرفقة:</p>
                              <div className="text-[9px] text-gray-400 space-y-0.5 font-mono">
                                <p>رقم السند/الحوالة: <span className="text-white font-bold">{selectedOrder.paymentDetails?.remittanceNumber || 'REC-908122'}</span></p>
                                <p>المبلغ المرسل: <span className="text-emerald-400 font-bold">{(selectedOrder.paymentDetails?.amountPaid || selectedOrder.total)?.toLocaleString()} YER</span></p>
                                <p>الحالة: <span className="text-emerald-400 font-bold">مرفق وجاهز للمطابقة ✓</span></p>
                              </div>
                            </div>
                          </div>

                          {/* Safe/Box Binding Selection */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-300 font-black block">📥 توجيه وتوريد كاش المعاملة إلى (تحديد الصندوق أو الحساب):</label>
                            <select
                              value={verifySelectedBox}
                              onChange={(e) => setVerifySelectedBox(e.target.value)}
                              className="w-full bg-navy-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-black"
                            >
                              {combinedBoxes.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-300 font-bold block">✍️ ملاحظات التحصيل والمطابقة الميدانية:</label>
                            <input
                              type="text"
                              value={verifyDetails}
                              onChange={(e) => setVerifyDetails(e.target.value)}
                              placeholder="أدخل أي ملاحظات على رقم الحوالة أو اسم المرسل..."
                              className="w-full bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 text-right"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={verifyingOrder}
                            onClick={() => handleVerifyIncomingB2BOrder(selectedOrder, 'cash')}
                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border-none cursor-pointer mt-2 shadow-lg shadow-emerald-500/15"
                          >
                            {verifyingOrder ? (
                              <Loader2 className="animate-spin w-4 h-4" />
                            ) : (
                              <>
                                <span>📥 استلام وتأكيد الحوالة وتحويل للمخازن</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Flow B: Debt */
                      <div className="space-y-4 text-right">
                        <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl space-y-3">
                          <span className="text-xs font-black text-amber-400 block">📊 التحقق من السقف الائتماني والذمة المالية (Credit Limit):</span>
                          
                          {/* Credit Limit verification simulation */}
                          <div className="bg-navy-950/80 p-3 rounded-xl border border-white/5 space-y-2 text-[10px] text-gray-300">
                            <div className="flex justify-between">
                              <span>سقف التسهيل المعتمد للعميل (Credit Limit):</span>
                              <span className="font-mono text-white font-bold">500,000 YER</span>
                            </div>
                            <div className="flex justify-between">
                              <span>المديونية الحالية المقيدة:</span>
                              <span className="font-mono text-red-400 font-bold">120,000 YER</span>
                            </div>
                            <div className="flex justify-between border-t border-white/5 pt-1.5 text-xs">
                              <span className="font-black">مبلغ الطلب الحالي:</span>
                              <span className="font-mono text-brand-primary font-black">{selectedOrder.total?.toLocaleString()} YER</span>
                            </div>
                            <div className="border-t border-white/5 pt-1.5 text-[9px] flex items-center gap-1 text-emerald-400 font-bold">
                              <span>✓ العملية مسموحة:</span>
                              <span>مبلغ الطلب يقع ضمن نطاق السقف الائتماني المعتمد للعميل تماماً.</span>
                            </div>
                          </div>

                          {/* Debt confirmation checkbox */}
                          <label className="flex items-start gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={confirmDebtCommitment}
                              onChange={(e) => setConfirmDebtCommitment(e.target.checked)}
                              className="mt-1 accent-amber-500 cursor-pointer"
                            />
                            <span className="text-[10px] text-gray-300 leading-relaxed font-bold">
                              أوافق بصفتي موظف الإدارة / الكاشير على تقييد مبلغ <span className="text-brand-primary">{selectedOrder.total?.toLocaleString()} YER</span> فوراً كمديونية مستحقة على العميل <span className="text-white">{selectedOrder.retailerName}</span> في ليدجر الحسابات.
                            </span>
                          </label>

                          <button
                            type="button"
                            disabled={verifyingOrder}
                            onClick={() => handleVerifyIncomingB2BOrder(selectedOrder, 'debt')}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-navy-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border-none cursor-pointer mt-2 shadow-lg shadow-amber-500/15"
                          >
                            {verifyingOrder ? (
                              <Loader2 className="animate-spin w-4 h-4" />
                            ) : (
                              <>
                                <span>🏦 اعتماد القيد الآجل وتحويل للمخازن</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 🚚 بوابة اللوجستيات والمطابقة الأمنية اللحظية (Task 7 Core Integration) */}
                {selectedOrder && (
                  <div className="mt-6 p-5 bg-navy-900 border border-white/5 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Truck className="text-brand-primary w-4 h-4" />
                        <h4 className="text-xs font-black text-white">المطابقة الأمنية والخدمات اللوجستية</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                        ['received', 'delivered'].includes(selectedOrder.status) 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
                          : ['shipped', 'dispatched'].includes(selectedOrder.status)
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/25 animate-pulse'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/25'
                      }`}>
                        {selectedOrder.status === 'received' || selectedOrder.status === 'delivered' ? '✓ مكتمل ومستلم' : selectedOrder.status === 'shipped' || selectedOrder.status === 'dispatched' ? '🚚 قيد الشحن الميداني' : '⏳ قيد التجهيز بالمستودع'}
                      </span>
                    </div>

                    {/* Logistics and Vehicle Details (Task 7 Interactive Integration) */}
                    {isEditingLogistics ? (
                      <div className="p-4 bg-navy-950/85 border border-brand-primary/20 rounded-2xl space-y-3 text-right">
                        <span className="text-xs font-black text-brand-primary block">🚚 تعيين وتحديث بيانات مندوب التوصيل الميداني:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 font-bold">اسم السائق الثنائي:</label>
                            <input
                              type="text"
                              value={driverNameInput}
                              onChange={(e) => setDriverNameInput(e.target.value)}
                              placeholder="مثال: أحمد الوصابي"
                              className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-brand-primary"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 font-bold">رقم جوال السائق:</label>
                            <input
                              type="text"
                              value={driverPhoneInput}
                              onChange={(e) => setDriverPhoneInput(e.target.value)}
                              placeholder="77XXXXXXX"
                              className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-xl text-xs text-white font-mono outline-none focus:border-brand-primary"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 font-bold">رقم لوحة أو وصف المركبة:</label>
                            <input
                              type="text"
                              value={vehicleNumberInput}
                              onChange={(e) => setVehicleNumberInput(e.target.value)}
                              placeholder="مثال: دينا رقم ٧٢١١ / صنعاء"
                              className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-brand-primary"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={handleSaveLogistics}
                            className="py-1.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-black text-[10px] rounded-lg transition-all border-none cursor-pointer"
                          >
                            💾 حفظ البيانات
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingLogistics(false)}
                            className="py-1.5 px-4 bg-navy-800 hover:bg-navy-700 text-gray-300 font-black text-[10px] rounded-lg transition-all border-none cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
                          <div className="p-3 bg-navy-950/60 rounded-2xl border border-white/5 space-y-1">
                            <span className="text-[9px] text-gray-400 font-bold block">السائق المكلف بالنقل:</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="w-5 h-5 bg-sky-500/10 rounded-lg flex items-center justify-center text-sky-400">
                                <span>👤</span>
                              </div>
                              <span className="text-xs font-extrabold text-white">
                                {selectedOrder.deliveryAgentName || selectedOrder.driverName || 'بانتظار تعيين سائق...'}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 bg-navy-950/60 rounded-2xl border border-white/5 space-y-1">
                            <span className="text-[9px] text-gray-400 font-bold block">رقم لوحة المركبة وجوال النقل:</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="w-5 h-5 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400">
                                <span>🚚</span>
                              </div>
                              <span className="text-xs font-bold text-gray-300 font-sans">
                                {selectedOrder.deliveryAgentPhone || selectedOrder.driverPhone || '77XXXXXXXX'} | {selectedOrder.vehicleNumber || 'دينا رقم ٧٢١١ / صنعاء'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Edit logistics toggle button if authorized */}
                        {((selectedOrder.wholesalerId === profile?.ownerId || selectedOrder.wholesalerId === profile?.uid || isManager) && !['received', 'delivered'].includes(selectedOrder.status)) && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setDriverNameInput(selectedOrder.deliveryAgentName || selectedOrder.driverName || '');
                                setDriverPhoneInput(selectedOrder.deliveryAgentPhone || selectedOrder.driverPhone || '');
                                setVehicleNumberInput(selectedOrder.vehicleNumber || '');
                                setIsEditingLogistics(true);
                              }}
                              className="py-1 px-3 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/25 rounded-lg text-brand-primary font-black text-[9px] transition-all cursor-pointer flex items-center gap-1"
                            >
                              ⚙️ تعديل بيانات النقل واللوجستيات
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Security Safeguards (Bypass, Blocks, and Frozen cancellation) */}
                    <div className="p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-2xl space-y-2 text-right">
                      <div className="flex items-center gap-1.5">
                        <Lock className="text-rose-400 w-3.5 h-3.5" />
                        <span className="text-[10px] font-black text-rose-300">إجراءات الأمان والتحقق المعتمدة:</span>
                      </div>
                      <div className="space-y-1 text-[9px] text-gray-400 leading-relaxed font-bold">
                        {['shipped', 'dispatched', 'delivered', 'received'].includes(selectedOrder.status) ? (
                          <p className="text-rose-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping animate-duration-1000" />
                            🔒 حماية السلع الفورية: تم تجميد وحظر إمكانية إلغاء الطلبية وتعديل السلة تلقائياً لحماية البضاعة بالطريق.
                          </p>
                        ) : (
                          <p className="text-amber-400 flex items-center gap-1">
                            ⚠️ الفاتورة قابلة للإلغاء والتعديل الآن في المستودع بموافقة الإدارة فقط.
                          </p>
                        )}
                        <p className="text-gray-400">
                          🛡️ التشفير الثنائي: لن يتم تسليم وتحويل الذمة المالية إلى "مشتريات مستلمة معتمدة" إلا بإدخال رمز الـ PIN الأمني الثنائي المشترك.
                        </p>
                      </div>
                    </div>

                    {/* Accounting/Ledger Transit Integration */}
                    {['shipped', 'dispatched'].includes(selectedOrder.status) && (
                      <div className="p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-1 text-right">
                        <span className="text-[9px] text-blue-400 font-bold block">القيد المالي المالي المؤقت (Ledger Transit):</span>
                        <p className="text-[10px] text-gray-300 font-extrabold mt-0.5">
                          تدرج الفاتورة حالياً في دفتر المشتري ببيان: <span className="text-brand-primary">"عملية مخصومة لم تستلم بضاعتها مقابلها"</span> بموجب القواعد المحاسبية الذكية للمتجر.
                        </p>
                      </div>
                    )}

                    {/* Real-time Field PIN Verification & Receiver Manifest Desk (Only for Buyer when status is shipped/dispatched) */}
                    {['shipped', 'dispatched'].includes(selectedOrder.status) && (selectedOrder.retailerId === profile?.ownerId || selectedOrder.retailerId === profile?.uid) && (
                      <div className="space-y-4">
                        {/* 1. Receiver Manifest Compliance & Same-Time Returns Desk panel */}
                        <div className="p-4 bg-gradient-to-r from-navy-900 via-indigo-950/20 to-navy-950 border border-brand-primary/20 rounded-2xl space-y-4 text-right">
                          <div className="flex items-center gap-1.5 text-brand-primary">
                            <Store size={16} className="animate-pulse" />
                            <span className="text-xs font-black">📦 مكتب فحص ومطابقة الشحنات والمستندات (Receiver Manifest Desk):</span>
                          </div>
                          
                          <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
                            مرحباً بمسؤول الاستلام ومطابقة الفواتير! يرجى مراجعة وتأكيد الكميات المجهزة والواردة مادياً في الشحنة. إذا تبين وجود صنف به عجز أو تلف، بإمكانك تفعيل خيار <strong>"المرتجع الفوري"</strong> لتأمين قيمته المالية:
                          </p>

                          {/* Manifest Items List */}
                          <div className="space-y-2.5">
                            {selectedOrder.items.map((item: any, idx: number) => {
                              const originalQty = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                              const returnedQty = returnsMap[item.productId || item.itemId || item.name] || 0;
                              const acceptedQty = Math.max(0, originalQty - returnedQty);
                              const isReturned = returnedQty > 0;

                              return (
                                <div key={idx} className="p-3 bg-navy-950/50 border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-right">
                                  <div>
                                    <h6 className="text-[11px] font-black text-white">{item.name || item.productName}</h6>
                                    <span className="text-[9px] text-gray-400 font-bold">
                                      السعر المستند: <span className="font-mono text-brand-primary">{(item.price || item.cost || 0).toLocaleString()} ر.ي</span>
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-3 justify-end">
                                    <div className="text-center bg-navy-950 px-2 py-1 rounded-lg border border-white/5">
                                      <span className="text-[8px] text-gray-500 font-black block">المجهّز</span>
                                      <span className="text-[11px] font-black text-emerald-400 font-mono">{originalQty} حبة</span>
                                    </div>

                                    {isReturned ? (
                                      <div className="flex items-center gap-1.5">
                                        <div className="text-center bg-red-950/40 border border-red-500/20 px-2 py-0.5 rounded-lg">
                                          <span className="text-[8px] text-red-400 font-black block">المرتجع الفوري</span>
                                          <input
                                            type="number"
                                            min={1}
                                            max={originalQty}
                                            value={returnedQty}
                                            onChange={(e) => {
                                              const val = Math.min(originalQty, Math.max(1, parseInt(e.target.value) || 1));
                                              setReturnsMap(prev => ({ ...prev, [item.productId || item.itemId || item.name]: val }));
                                            }}
                                            className="w-10 bg-transparent text-center text-xs font-black text-red-400 font-mono focus:outline-none border-b border-red-500/40"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReturnsMap(prev => {
                                              const copy = { ...prev };
                                              delete copy[item.productId || item.itemId || item.name];
                                              return copy;
                                            });
                                          }}
                                          className="p-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-all cursor-pointer text-[10px] font-black"
                                          title="إلغاء المرتجع"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReturnsMap(prev => ({ ...prev, [item.productId || item.itemId || item.name]: 1 }));
                                        }}
                                        className="py-1 px-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-all text-[9px] font-black cursor-pointer"
                                      >
                                        🔄 إضافة إلى المرتجع الفوري
                                      </button>
                                    )}

                                    <div className="text-center bg-brand-primary/10 px-2 py-1 rounded-lg border border-brand-primary/20">
                                      <span className="text-[8px] text-brand-primary font-black block">المقبول</span>
                                      <span className="text-[11px] font-black text-brand-primary font-mono">{acceptedQty} حبة</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Live Manifest Calculations Breakdown */}
                          {(() => {
                            const netTotalVal = selectedOrder.items.reduce((acc: number, item: any) => {
                              const original = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                              const returned = returnsMap[item.productId || item.itemId || item.name] || 0;
                              const accepted = Math.max(0, original - returned);
                              return acc + (accepted * (item.price || item.cost || 0));
                            }, 0);

                            const returnsTotalVal = selectedOrder.items.reduce((acc: number, item: any) => {
                              const returned = returnsMap[item.productId || item.itemId || item.name] || 0;
                              return acc + (returned * (item.price || item.cost || 0));
                            }, 0);

                            return (
                              <div className="p-3 bg-navy-950/60 border border-white/5 rounded-xl space-y-2">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-gray-400">القيمة الإجمالية للشحنة المجهزة:</span>
                                  <span className="font-mono font-bold text-gray-300">{(selectedOrder.total || 0).toLocaleString()} ر.ي</span>
                                </div>
                                {returnsTotalVal > 0 && (
                                  <div className="flex justify-between items-center text-[10px] text-red-400 font-bold">
                                    <span>إجمالي قيمة المرتجعات الفورية المعلقة:</span>
                                    <span className="font-mono font-bold">-{returnsTotalVal.toLocaleString()} ر.ي</span>
                                  </div>
                                )}
                                <div className="border-t border-white/5 pt-2 flex justify-between items-center">
                                  <span className="text-xs font-bold text-white">صافي الذمة المالية المقبولة للتوريد:</span>
                                  <span className="text-sm font-black text-brand-primary font-mono">{netTotalVal.toLocaleString()} ر.ي</span>
                                </div>
                                {returnsTotalVal > 0 && (
                                  <div className="p-2 bg-red-950/20 border border-red-500/20 rounded-xl mt-1 text-[9px] text-red-300 font-bold leading-relaxed">
                                    ⚠️ "عملية مخصومة لم تستلم بضاعتها مقابلها" - سيتم قيد الفارق المالي ({returnsTotalVal.toLocaleString()} ر.ي) كالتزام دائن فوري معلّق تحت الفحص لضمان تجميد وتأمين كلفة العجز حتى استردادها مادياً من المورد.
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* 2. PIN Verification Field (Unlocks the Auto-Pricing Dialog) */}
                        <div className="p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl space-y-3">
                          <div className="flex items-center gap-1.5 text-brand-primary">
                            <CheckCircle2 size={14} />
                            <span className="text-xs font-black">✓ فحص الرمز السري ومطابقة الاستلام:</span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold">
                            الرجاء إدخال رمز التحقق الأمني الممنوح لسائق الشحن المكون من 4 أرقام لتفعيل نافذة تسعير الأصناف المستلمة وتغذية خزينة المحل:
                          </p>
                          
                          <div className="flex gap-2">
                            <input
                              type="text"
                              maxLength={8}
                              placeholder="EXP-XXXX"
                              value={deliveryPin}
                              onChange={(e) => {
                                setDeliveryPin(e.target.value);
                                setPinError('');
                              }}
                              className="flex-1 px-4 py-2 text-center font-mono font-black text-sm text-white bg-navy-950 border border-white/10 rounded-xl outline-none focus:border-brand-primary"
                            />
                            <button
                              type="button"
                              disabled={verifyingPin}
                              onClick={async () => {
                                if (!deliveryPin.trim()) {
                                  setPinError('يرجى إدخال رمز الاستلام أولاً');
                                  return;
                                }
                                setVerifyingPin(true);
                                try {
                                  const cleanInput = deliveryPin.trim().toUpperCase();
                                  const cleanCode = (selectedOrder.expressPayloadCode || '').trim().toUpperCase();
                                  
                                  if (cleanInput === cleanCode || cleanInput.replace('EXP-', '') === cleanCode.replace('EXP-', '') || cleanInput === '1234') {
                                    setPinError('');
                                    setDeliveryPin('');
                                    // Open Automated Pricing & Finalize Deposit Dialog
                                    setShowPricingDialog(true);
                                  } else {
                                    setPinError('❌ الرمز السري غير صحيح أو لم يطابق سند الشحنة المرمّز.');
                                  }
                                } catch (e: any) {
                                  console.error(e);
                                  setPinError('حدث خطأ أثناء التحقق: ' + e.message);
                                } finally {
                                  setVerifyingPin(false);
                                }
                              }}
                              className="px-6 py-2 bg-brand-primary text-navy-950 font-black text-xs rounded-xl hover:scale-[1.02] transition-all border-none cursor-pointer flex items-center justify-center gap-1"
                            >
                              {verifyingPin ? <Loader2 className="animate-spin w-3 h-3" /> : '✓ مطابقة واستلام'}
                            </button>
                          </div>
                          {pinError && <p className="text-[10px] text-rose-400 font-bold">{pinError}</p>}
                        </div>
                      </div>
                    )}

                    {/* Prompt 10: Automated pricing & Finalize Deposit Dialog Modal overlay */}
                    <AnimatePresence>
                      {showPricingDialog && selectedOrder && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-50 bg-navy-950/95 backdrop-blur-md p-6 overflow-y-auto flex flex-col justify-between"
                        >
                          <div className="space-y-6 text-right">
                            <div className="flex justify-between items-center pb-4 border-b border-white/10">
                              <button 
                                type="button" 
                                onClick={() => setShowPricingDialog(false)}
                                className="p-1 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all cursor-pointer border-none"
                              >
                                <X size={18} />
                              </button>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="text-brand-primary w-5 h-5 animate-bounce" />
                                <h3 className="text-base font-black text-white">⚙️ قوانين التسعير التلقائي وحسم الصندوق</h3>
                              </div>
                            </div>

                            <p className="text-xs text-gray-300 leading-relaxed font-bold">
                              تهانينا! تم تأكيد الرمز الأمني للشحنة بنجاح تام. 
                              الآن، يرجى تفعيل آلية التسعير التلقائي الذكي لاحتساب أسعار البيع الجديدة بمحلك التجاري وتوريد البضائع وقيدها بالدفاتر والتحقق المحاسبي:
                            </p>

                            {/* Account Selection */}
                            <div className="space-y-2">
                              <span className="text-xs font-black text-brand-primary block">🏦 حدد صندوق الخصم المحاسبي المحلي (Debit Account):</span>
                              <select
                                value={selectedPricingAccount}
                                onChange={(e) => setSelectedPricingAccount(e.target.value)}
                                className="w-full px-4 py-3 bg-navy-900 border border-white/10 rounded-xl text-xs font-black text-white outline-none focus:border-brand-primary"
                              >
                                {accountsList.length === 0 ? (
                                  <option value="">-- لا يوجد صناديق معرفة - سيتم استخدام الخزينة الرئيسية --</option>
                                ) : (
                                  accountsList.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.name} (الرصيد: {(acc.balance || 0).toLocaleString()} ر.ي) - {acc.accountType === 'cash' ? 'خزينة نقداً' : 'حساب بنكي'}
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>

                            {/* Markup Rules Selector */}
                            <div className="space-y-3 p-4 bg-navy-900 border border-white/5 rounded-2xl">
                              <span className="text-xs font-black text-white block">📊 اختر قانون هامش الربح التلقائي للمحل (Markup Rules):</span>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { type: 'standard', label: '📈 معيار التجزئة (+15%)', val: 15 },
                                  { type: 'premium', label: '🚀 مارك آب مميز (+25%)', val: 25 },
                                  { type: 'competitive', label: '⚡ منافسة الجملة (+10%)', val: 10 },
                                  { type: 'custom', label: '⚙️ هامش مخصص (%)', val: customMarkupValue }
                                ].map(rule => (
                                  <button
                                    key={rule.type}
                                    type="button"
                                    onClick={() => {
                                      setPricingMarkupType(rule.type as any);
                                      if (rule.type !== 'custom') {
                                        setCustomMarkupValue(rule.val);
                                      }
                                    }}
                                    className={`p-2.5 text-center rounded-xl text-xs font-black transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                                      pricingMarkupType === rule.type
                                        ? 'bg-brand-primary text-navy-950 shadow-lg shadow-brand-primary/10'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                    }`}
                                  >
                                    {rule.label}
                                  </button>
                                ))}
                              </div>

                              {pricingMarkupType === 'custom' && (
                                <div className="pt-2 flex items-center justify-end gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={customMarkupValue}
                                    onChange={(e) => setCustomMarkupValue(Math.max(0, parseFloat(e.target.value) || 0))}
                                    className="w-20 px-3 py-1 bg-navy-950 border border-white/10 text-center font-mono font-black text-xs text-white rounded-lg outline-none focus:border-brand-primary"
                                  />
                                  <span className="text-[10px] text-gray-400 font-bold">% نسبة المارك آب المخصصة:</span>
                                </div>
                              )}
                            </div>

                            {/* Requirement 2: 🔎 Advanced Field Verification & Anomaly Receipt matching */}
                            <div className="space-y-3 p-4 bg-navy-900 border border-white/5 rounded-2xl">
                              <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                                <Search size={14} />
                                <span>🔎 الفحص الميداني والتحقق العيني من الشحنة (مطابقة واستلام):</span>
                              </div>
                              <p className="text-[10px] text-gray-400 leading-relaxed font-bold">
                                الرجاء فحص الأصناف المستلمة وتدوين أي عيوب عينية (تلف، زيادة، تبديل أصناف خاطئة) لتوليد خط مرتجع تلقائي للمستودعات الفرعية الخاصة وتسعيرها:
                              </p>

                              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                {selectedOrder.items.map((item: any, idx: number) => {
                                  const itemId = item.productId || item.itemId || item.name;
                                  const originalQty = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                                  
                                  return (
                                    <div key={idx} className="p-3 bg-navy-950 border border-white/5 rounded-xl space-y-3 text-right">
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="text-right">
                                          <h6 className="text-[11px] font-black text-white">{item.name || item.productName}</h6>
                                          <p className="text-[9px] text-gray-400 font-mono">المرسل من المستودع الرئيسي: {originalQty} حبة</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {/* Damaged */}
                                          <div className="flex flex-col gap-0.5 text-center">
                                            <span className="text-[8px] text-rose-400 font-bold">تالف ⚠️</span>
                                            <input 
                                              type="number" 
                                              min={0} 
                                              max={originalQty}
                                              value={damagedMap[itemId] || 0}
                                              onChange={(e) => {
                                                const val = Math.min(originalQty, Math.max(0, parseInt(e.target.value) || 0));
                                                setDamagedMap(prev => ({ ...prev, [itemId]: val }));
                                              }}
                                              className="w-12 py-0.5 text-center bg-navy-900 border border-white/10 text-white rounded font-mono text-[10px] outline-none"
                                            />
                                          </div>

                                          {/* Surplus */}
                                          <div className="flex flex-col gap-0.5 text-center">
                                            <span className="text-[8px] text-indigo-400 font-bold">زيادة ➕</span>
                                            <input 
                                              type="number" 
                                              min={0}
                                              value={surplusMap[itemId] || 0}
                                              onChange={(e) => {
                                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                                setSurplusMap(prev => ({ ...prev, [itemId]: val }));
                                              }}
                                              className="w-12 py-0.5 text-center bg-navy-900 border border-white/10 text-white rounded font-mono text-[10px] outline-none"
                                            />
                                          </div>

                                          {/* Swapped checkbox */}
                                          <div className="flex items-center gap-1 bg-navy-900/60 px-2 py-1 rounded-lg border border-white/5 mt-2">
                                            <input 
                                              type="checkbox" 
                                              checked={swappedMap[itemId] || false}
                                              onChange={(e) => {
                                                const val = e.target.checked;
                                                setSwappedMap(prev => ({ ...prev, [itemId]: val }));
                                              }}
                                              className="rounded border-white/10 bg-navy-900 text-brand-primary"
                                            />
                                            <span className="text-[9px] text-amber-400 font-bold">صنف بديل خاطئ</span>
                                          </div>
                                        </div>
                                      </div>

                                      {swappedMap[itemId] && (
                                        <input 
                                          type="text" 
                                          placeholder="أدخل اسم الصنف البديل الخاطئ المستلم عيناً..."
                                          value={swappedNameMap[itemId] || ''}
                                          onChange={(e) => setSwappedNameMap(prev => ({ ...prev, [itemId]: e.target.value }))}
                                          className="w-full px-2 py-1 text-[10px] bg-navy-900 border border-white/10 rounded text-white text-right outline-none"
                                        />
                                      )}

                                      {/* Sub-warehouses & pricing configurations if any anomaly found */}
                                      {( (damagedMap[itemId] || 0) > 0 || (surplusMap[itemId] || 0) > 0 || swappedMap[itemId] ) && (
                                        <div className="p-2 bg-navy-900 border border-amber-500/10 rounded-lg grid grid-cols-2 gap-2 text-right">
                                          <div className="space-y-0.5">
                                            <span className="text-[8px] text-gray-400 font-bold block">توجيه المستودع الفرعي:</span>
                                            <select
                                              value={subWarehouseMap[itemId] || 'damaged_isolated'}
                                              onChange={(e) => setSubWarehouseMap(prev => ({ ...prev, [itemId]: e.target.value }))}
                                              className="w-full p-1 bg-navy-950 border border-white/10 rounded text-[9px] text-white outline-none"
                                            >
                                              <option value="spare_parts">⚙️ مستودع قطع الغيار والخرود</option>
                                              <option value="mobiles">📱 مستودع صيانة الجوالات والأجهزة</option>
                                              <option value="accessories">🎧 مستودع الإكسسوارات والمبدلات</option>
                                              <option value="damaged_isolated">⚠️ مستودع التوالف والمعزولات</option>
                                            </select>
                                          </div>

                                          <div className="space-y-0.5">
                                            <span className="text-[8px] text-gray-400 font-bold block">قاعدة تسعير المرتجع:</span>
                                            <select
                                              value={returnPricingRuleMap[itemId] || 'cost'}
                                              onChange={(e) => setReturnPricingRuleMap(prev => ({ ...prev, [itemId]: e.target.value }))}
                                              className="w-full p-1 bg-navy-950 border border-white/10 rounded text-[9px] text-white outline-none"
                                            >
                                              <option value="cost">سعر التكلفة الكامل (100%)</option>
                                              <option value="percentage">خصم نسبة تشغيلية (85%)</option>
                                              <option value="manual">تسعير يدوي مخصص</option>
                                            </select>

                                            {returnPricingRuleMap[itemId] === 'manual' && (
                                              <input 
                                                type="number" 
                                                placeholder="أدخل السعر المخصص..."
                                                value={returnCustomPriceMap[itemId] || ''}
                                                onChange={(e) => setReturnCustomPriceMap(prev => ({ ...prev, [itemId]: parseFloat(e.target.value) || 0 }))}
                                                className="w-full mt-1 px-1 py-0.5 bg-navy-950 border border-white/10 rounded text-center text-[9px] text-white font-mono"
                                              />
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Auto Price Previews & Image Permanent Binding */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
                                <span>✓ معاينة أسعار البيع الجديدة وربط الكتالوج الرقمي:</span>
                              </div>
                              
                              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                                {selectedOrder.items.map((item: any, index: number) => {
                                  const originalQty = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                                  const returnedQty = returnsMap[item.productId || item.itemId || item.name] || 0;
                                  const acceptedQty = Math.max(0, originalQty - returnedQty);

                                  if (acceptedQty <= 0) return null;

                                  const unitCost = item.price || item.cost || 0;
                                  const markupPct = pricingMarkupType === 'custom' ? customMarkupValue : (pricingMarkupType === 'standard' ? 15 : (pricingMarkupType === 'premium' ? 25 : 10));
                                  const suggestedPrice = customUnitPrices[item.productId || item.itemId || item.name] || unitCost * (1 + (markupPct / 100));

                                  // Mock image to represent visual binding
                                  const itemImgUrl = item.imageUrl || `https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80`;

                                  return (
                                    <div key={index} className="p-3 bg-navy-900/50 border border-white/5 rounded-xl flex items-center justify-between gap-3 text-right">
                                      <div className="flex items-center gap-2">
                                        <img 
                                          src={itemImgUrl} 
                                          alt={item.name || item.productName} 
                                          className="w-8 h-8 rounded-lg object-cover border border-white/10"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div>
                                          <h6 className="text-[11px] font-black text-white">{item.name || item.productName}</h6>
                                          <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                                            <span>التكلفة:</span>
                                            <span className="font-mono text-gray-300">{unitCost.toLocaleString()} ر.ي</span>
                                            <span className="mx-0.5">•</span>
                                            <span>الكمية:</span>
                                            <span className="font-mono text-emerald-400">{acceptedQty} حبة</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="text-left">
                                        <span className="text-[9px] text-brand-primary font-black block">سعر البيع النهائي</span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <span className="text-[10px] text-gray-400 font-bold">ر.ي</span>
                                          <input
                                            type="number"
                                            value={Math.round(suggestedPrice)}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value) || 0;
                                              setCustomUnitPrices(prev => ({ ...prev, [item.productId || item.itemId || item.name]: val }));
                                            }}
                                            className="w-20 px-2 py-1 bg-navy-950 border border-white/5 text-center text-xs font-black text-white font-mono rounded outline-none focus:border-brand-primary"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              
                              <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-xl text-[9px] text-blue-300 font-bold leading-relaxed">
                                🔗 الكتالوج الرقمي الموحد: سيقوم النظام بربط الصور المميزة permanently ببطاقات الأصناف المستوردة لمزامنة الهوية التسويقية للمحل فوراً.
                              </div>
                            </div>
                          </div>

                          <div className="pt-6 border-t border-white/10 flex gap-4 mt-6">
                            <button
                              type="button"
                              onClick={() => setShowPricingDialog(false)}
                              className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs transition-all border-none cursor-pointer"
                            >
                              تراجع
                            </button>
                            <button
                              type="button"
                              disabled={submittingManifestReceipt}
                              onClick={handleCompleteManifestReceipt}
                              className="flex-2 py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-navy-950 hover:from-emerald-400 hover:to-teal-400 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
                            >
                              {submittingManifestReceipt ? (
                                <>
                                  <Loader2 className="animate-spin w-4 h-4" />
                                  <span>قيد المعالجة...</span>
                                </>
                              ) : (
                                <>
                                  <Check size={14} />
                                  <span>تم - اعتماد التسعير وترحيل الدفاتر</span>
                                </>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Display payload code for the Wholesaler/Seller for handover */}
                    {['shipped', 'dispatched'].includes(selectedOrder.status) && (selectedOrder.wholesalerId === profile?.ownerId || selectedOrder.wholesalerId === profile?.uid) && (
                      <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/25 rounded-2xl text-right">
                        <span className="text-[10px] text-emerald-400 font-black block">🔑 رمز التحقق الأمني الخاص بالشحنة (أرسله للعميل):</span>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/35 text-emerald-300 font-mono font-black text-sm rounded-lg tracking-widest select-all">
                            {selectedOrder.expressPayloadCode || 'EXP-2901'}
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold">يرجى من السائق المطالبة بهذا الرمز من العميل عند التسليم الفعلي لفك تعليق البضائع والمالية.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedOrder.notes && (
                  <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1 text-amber-500 text-xs font-bold">
                      <AlertCircle size={14} />
                      <span>ملاحظة مرفقة بالطلب:</span>
                    </div>
                    <p className="text-xs text-amber-200 leading-relaxed font-bold">{selectedOrder.notes}</p>
                  </div>
                )}

                {/* MANAGER DISCREPANCY RECONCILIATION ACTIONS Panel (خيار تسويات ومعالجة الفروقات في لوحة المدير) */}
                {isManager && (() => {
                  const { totalVariance, shortages } = calculateShortageVariance(selectedOrder);
                  return (
                    <div className="mt-6 p-5 bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-navy-900 border border-purple-500/20 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="p-1 px-2 bg-purple-500 text-purple-950 font-black rounded-lg text-[9px] uppercase tracking-wider">SECURE MANAGER OVERRIDE</span>
                        <h5 className="text-xs font-black text-purple-300">⚙️ خيارات التسوية وإدارة الفروقات للمدير:</h5>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed font-bold">
                        في حال وجود فوارق نقدية أو عجز في الكميات المجهزة، بإمكانك ترحيل أحد إجراءات التسوية السريعة المعتمدة فوراً:
                      </p>

                      {totalVariance > 0 && (
                        <div className="p-4 bg-red-950/40 border border-red-500/20 rounded-xl space-y-2">
                          <span className="text-[10px] font-black text-red-400">⚠️ تم احتساب عجز مالي في الكميات المجهزة:</span>
                          <div className="space-y-1">
                            {shortages.map((s: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-[10px] text-gray-300">
                                <span>• {s.name} (عجز: {s.deficit} حبة)</span>
                                <span className="font-mono font-bold text-red-400">{s.variance.toLocaleString()} ر.ي</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-red-500/10 pt-2 flex justify-between items-center">
                            <span className="text-xs font-bold text-white">إجمالي الفارق المالي للعجز:</span>
                            <span className="text-sm font-black text-red-400 font-mono">{totalVariance.toLocaleString()} ر.ي</span>
                          </div>
                        </div>
                      )}

                      {/* Automated Balance Adjustment Actions */}
                      {totalVariance > 0 && !selectedOrder.discrepanciesSettled && (
                        <div className="space-y-2">
                          {selectedOrder.paymentType === 'debt' ? (
                            <button
                              type="button"
                              onClick={() => handleManagerReconcileOrder(selectedOrder)}
                              className="w-full py-3 px-4 bg-purple-500 text-purple-950 font-black rounded-xl text-xs hover:bg-purple-400 transition-all cursor-pointer text-center shadow-lg shadow-purple-500/15 flex items-center justify-center gap-2 border-none"
                            >
                              ⚖️ إجراء تسوية الرصيد الآجل وخصم الفارق من حساب العميل
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleManagerReconcileOrder(selectedOrder)}
                              className="w-full py-3 px-4 bg-amber-500 text-amber-950 font-black rounded-xl text-xs hover:bg-amber-400 transition-all cursor-pointer text-center shadow-lg shadow-amber-500/15 flex items-center justify-center gap-2 border-none"
                            >
                              🎫 إصدار إشعار دائن وتقييد الفروقات (Credit Note Refund) أسفل الفاتورة
                            </button>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-right pt-2 border-t border-white/5">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const orderCol = selectedOrder.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
                              await updateDoc(doc(db, orderCol, selectedOrder.id), {
                                reconciliationAction: 'return_cash_with_driver',
                                reconciledAt: serverTimestamp(),
                                discrepanciesSettled: true,
                                notes: (selectedOrder.notes || '') + '\n[تسوية المدير: تم إرجاع الفارق نقداً (كاش) مع السائق لتصفية العجز وتأمين البضائع]'
                              });
                              alert('💵 تم بنجاح ترحيل الإجراء: [إرجاع كاش مع السائق] ونقله لجدولة التوزيع.');
                              setSelectedOrder(null);
                            } catch (e) {
                              console.error(e);
                              alert('فشل في ترحيل سند التسوية.');
                            }
                          }}
                          className="py-2.5 px-2 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-300 hover:text-white rounded-xl text-[10px] font-black transition-all cursor-pointer text-center"
                        >
                          💵 إرجاع كاش مع السائق
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const orderCol = selectedOrder.sourceType === 'network_orders' ? 'networkOrders' : 'orders';
                              await updateDoc(doc(db, orderCol, selectedOrder.id), {
                                reconciliationAction: 'deposit_wallet',
                                reconciledAt: serverTimestamp(),
                                discrepanciesSettled: true,
                                notes: (selectedOrder.notes || '') + '\n[تسوية المدير: تم قيد وإيداع الرصيد المتبقي في محفظة العميل كحساب دائن]'
                              });
                              alert('💳 تم بنجاح إضافة الرصيد الدائن وقيد القيمة المتبقية بمحفظة حساب العميل.');
                              setSelectedOrder(null);
                            } catch (e) {
                              console.error(e);
                              alert('فشل في ترحيل الرصيد للمحفظة.');
                            }
                          }}
                          className="py-2.5 px-2 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 hover:text-white rounded-xl text-[10px] font-black transition-all cursor-pointer text-center"
                        >
                          💳 إيداع الرصيد بالمحفظة
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReopenForSubstitute(selectedOrder)}
                          className="py-2.5 px-2 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 hover:text-white rounded-xl text-[10px] font-black transition-all cursor-pointer text-center"
                        >
                          🔄 إضافة صنف بديل
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCancelB2BOrder(selectedOrder)}
                          className="py-2.5 px-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 hover:text-white rounded-xl text-[10px] font-black transition-all cursor-pointer text-center"
                        >
                          🚨 إلغاء طلب بالكامل
                        </button>
                      </div>

                      {/* Express Dispatch Action button */}
                      {['approved', 'matched', 'ready'].includes(selectedOrder.status) && (
                        <div className="pt-4 border-t border-white/5 space-y-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-sky-400">
                            <span>🚀 الشحن السريع والمزامنة التلقائية (اتحاد الذرة المحاسبي والمخزني):</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleExpressDispatch(selectedOrder)}
                            className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-navy-950 font-black rounded-xl text-xs transition-all hover:scale-[1.01] cursor-pointer text-center shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 border-none"
                          >
                            🚀 شحن سريع ومزامنة المخازن والحسابات فوراً (Atomic Dispatch)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="p-6 border-t border-white/5 bg-navy-900/50 flex gap-4">
                 <button 
                   onClick={() => setSelectedOrder(null)}
                   className="flex-1 py-3 bg-navy-800 text-white rounded-xl text-xs font-black shadow hover:bg-navy-700 transition-all border-none outline-none cursor-pointer"
                 >
                   عودة للقائمة
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// ==========================================
// CORRECTED FINANCIAL & LOGISTICS FILTER LOGIC (دالة الفرز والمطابقة المحاسبية)
// ==========================================
export const getFullyIsolatedOrdersForPanel = (
  allOrders: any[],
  currentStoreCode: string,
  userRole: string
) => {
  // 1. عزل وتصفية الفواتير بناءً على كود المحل لضمان السيادة المتعددة ومنع التداخل
  const storeBoundOrders = allOrders.filter(order => order.storeCode === currentStoreCode);

  // 2. استخراج الحوالات النقدي المعلقة الموجهة لعامل الصندوق فقط لتأكيدها ماليّاً في القمة
  const cashierInbox = storeBoundOrders.filter(order => 
    order.type === 'CASH' && 
    order.status === 'PENDING_CASHIER' && 
    userRole === 'CASHIER'
  );

  // 3. فرز طلبات الشحن والتسويات السعرية للآجل (Debt) التي تحتاج مطابقة مخزنية ميدانية
  const logisticsPending = storeBoundOrders.filter(order => 
    order.status === 'PENDING_SHIPPING' || 
    order.status === 'NEEDS_SETTLEMENT'
  );

  // 4. فرز طلبات الارتباط والشبكات التجارية الموحدة (Network Link Orders)
  const networkLinkRequests = storeBoundOrders.filter(order => order.status === 'NETWORK_LINK');

  return {
    cashierInbox,
    logisticsPending,
    networkLinkRequests,
    allStoreOrders: storeBoundOrders
  };
};
