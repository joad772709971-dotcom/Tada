import { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus,
  Trash2, 
  Send, 
  Package, 
  Wrench, 
  Clock,
  X,
  AlertCircle,
  TrendingDown,
  Building,
  Check,
  ChevronLeft,
  ShoppingCart,
  DollarSign,
  Lock,
  Camera,
  Search,
  Barcode,
  Cpu,
  CheckCircle,
  AlertTriangle,
  Users,
  UserPlus,
  MessageSquare
} from 'lucide-react';
import { collection, addDoc, onSnapshot, query, deleteDoc, doc, updateDoc, serverTimestamp, where, Timestamp, getDocs, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ShortageItem, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { marketService } from '../services/marketService';
import BarcodeScanner from './BarcodeScanner';

interface OrdersAndShortagesProps {
  profile: UserProfile | null;
}

export default function OrdersAndShortages({ profile }: OrdersAndShortagesProps) {
  // 1. States for manual shortages, full inventory, and connected wholesalers
  const [manualShortages, setManualShortages] = useState<ShortageItem[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [b2bConnections, setB2bConnections] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'manual' | 'low_stock'>('all');
  
  // 🚀 Shortages Search and Barcode Camera state variables
  const [shortageSearchQuery, setShortageSearchQuery] = useState('');
  const [isScanningShortage, setIsScanningShortage] = useState(false);
  const [isScanningManualAdd, setIsScanningManualAdd] = useState(false);

  // 🚀 Brand-new states for Bulk Processing & Validation
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [activeQuickSelectCategory, setActiveQuickSelectCategory] = useState<'all' | 'phones' | 'spare_parts' | 'accessories' | 'shop'>('all');
  const [isBatchOrderModalOpen, setIsBatchOrderModalOpen] = useState(false);
  const [batchOrderFormData, setBatchOrderFormData] = useState({
    targetWholesalerId: '',
    paymentType: 'cash' as 'cash' | 'debt' | 'money_transfer',
    notes: ''
  });

  // Modal toggle states
  const [isAddManualModalOpen, setIsAddManualModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  
  // Form submission feedback states
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Automated Shortages Conversion Engine states
  const [isAutoConverting, setIsAutoConverting] = useState(false);
  const [autoConvertResult, setAutoConvertResult] = useState<{success?: boolean; message?: string; errors?: string[]} | null>(null);

  // 🚀 New states for Local Offline Suppliers & Shortages Diagnostic
  const [isAddLocalSupplierModalOpen, setIsAddLocalSupplierModalOpen] = useState(false);
  const [localSupplierFormData, setLocalSupplierFormData] = useState({ name: '', phone: '' });
  const [isShortagesDiagnosticModalOpen, setIsShortagesDiagnosticModalOpen] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<{
    totalCount: number;
    onlineItems: any[];
    offlineItems: any[];
    unlinkedItems: any[];
    sourceItems: any[];
  } | null>(null);
  const [diagnosticSelectedSupplierId, setDiagnosticSelectedSupplierId] = useState('');
  const [isSavingBulkLink, setIsSavingBulkLink] = useState(false);

  // Form states
  const [manualFormData, setManualFormData] = useState({
    name: '',
    quantity: 1,
    category: 'shop' as 'shop' | 'spare_part',
    supplierId: localStorage.getItem('default_shortage_supplier_id') || ''
  });

  const [orderFormData, setOrderFormData] = useState({
    name: '',
    quantity: 10,
    price: 0,
    targetWholesalerId: '',
    paymentType: 'cash' as 'cash' | 'debt' | 'money_transfer',
    notes: '',
    depositRefNum: '',
    selectedDepositWallet: 'AL_KURIMI'
  });

  // Track the shortage item undergoing purchase conversion
  const [activeShortage, setActiveShortage] = useState<any | null>(null);

  // Helper: check if service is explicitly allowed or banned for a supplier connection
  const isServiceAllowed = (conn: any, category: string) => {
    if (!conn) return false;
    
    let normalized = (category || 'shop').toLowerCase().trim();
    if (normalized === 'spare_parts') normalized = 'spare_part';

    // Default to allowed lists if not explicitly specified
    const allowed = conn.allowed_services ? conn.allowed_services.map((s: string) => s.toLowerCase().trim()) : ['shop', 'phones', 'spare_part', 'accessories'];
    const banned = conn.banned_services ? conn.banned_services.map((s: string) => s.toLowerCase().trim()) : [];

    if (banned.includes(normalized)) return false;
    if (conn.allowed_services && !allowed.includes(normalized)) return false;

    return true;
  };

  // Helper: check if a specific payment type (cash, debt, money_transfer) is allowed for a given connection
  const isPaymentTypeAllowed = (conn: any, type: string) => {
    if (!conn) return true; // Default to true if connection is unspecified
    
    // Check standard blocks
    if (type === 'debt' && (conn.deferredLocked === true || conn.debtWarning === true || conn.allowDebt === false)) {
      return false;
    }
    // Check explicitly configured payment restrictions
    const bannedPayments = conn.banned_payment_types ? conn.banned_payment_types.map((p: string) => p.toLowerCase().trim()) : [];
    const allowedPayments = conn.allowed_payment_types ? conn.allowed_payment_types.map((p: string) => p.toLowerCase().trim()) : [];
    
    if (bannedPayments.includes(type.toLowerCase())) return false;
    if (conn.allowed_payment_types && !allowedPayments.includes(type.toLowerCase())) return false;

    return true;
  };

  // Helper: Get explicitly linked merchants from the current user's profile
  const getFilteredConnections = () => {
    const list = profile?.connected_merchants || profile?.connectedMerchants || profile?.followedWholesalerIds || [];
    if (Array.isArray(list) && list.length > 0) {
      return b2bConnections.filter(conn => list.includes(conn.supplierId));
    }
    // If connected_merchants field or similar is explicitly configured in profile but empty, return empty list to enforce strict masking
    if (profile && ('connected_merchants' in profile || 'connectedMerchants' in profile || 'followedWholesalerIds' in profile)) {
      return [];
    }
    return b2bConnections;
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // 2. Real-time Firebase subscriptions
  useEffect(() => {
    if (!profile?.ownerId) return;

    // A. Sync this shop's manual shortages matching ownerId
    const qShortages = query(
      collection(db, 'shortages'), 
      where('ownerId', '==', profile.ownerId)
    );
    const unsubShortages = onSnapshot(qShortages, (snapshot) => {
      setManualShortages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShortageItem)));
    }, (error) => {
      console.error("JAM SYSTEM PRO - Locked Error Safely (manual shortages subscription):", error);
    });

    // B. Sync B2B active connections matching buyerId (connected wholesalers for this retailer)
    const qConnections = query(
      collection(db, 'b2bConnections'),
      where('buyerId', '==', profile.ownerId),
      where('status', '==', 'active')
    );
    const unsubConnections = onSnapshot(qConnections, (snapshot) => {
      setB2bConnections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("JAM SYSTEM PRO - Locked Error Safely (b2bConnections list subscription):", error);
    });

    // C. Sync full inventory of the retailer (to check live low stock & last_purchase_price)
    const qInventory = query(
      collection(db, 'inventory'),
      where('ownerId', '==', profile.ownerId)
    );
    const unsubInventory = onSnapshot(qInventory, (snapshot) => {
      setInventoryList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("JAM SYSTEM PRO - Locked Error Safely (inventory list subscription):", error);
    });

    return () => {
      unsubShortages();
      unsubConnections();
      unsubInventory();
    };
  }, [profile]);

  // 3. Handlers for manual shortages
  const handleAddManualShortage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;

    try {
      const selectedConn = b2bConnections.find(c => c.supplierId === manualFormData.supplierId);
      const sName = selectedConn?.supplierName || '';

      await addDoc(collection(db, 'shortages'), {
        name: manualFormData.name.trim(),
        quantity: Math.max(1, Number(manualFormData.quantity)),
        category: manualFormData.category,
        ownerId: profile.ownerId,
        senderName: profile.name || 'تاجر تجزئة',
        status: 'pending',
        supplierId: manualFormData.supplierId || '',
        supplierName: sName,
        createdAt: serverTimestamp()
      });
      
      if (manualFormData.supplierId) {
        localStorage.setItem('default_shortage_supplier_id', manualFormData.supplierId);
      }
      
      setIsAddManualModalOpen(false);
      setManualFormData({ 
        name: '', 
        quantity: 1, 
        category: 'shop',
        supplierId: localStorage.getItem('default_shortage_supplier_id') || ''
      });
    } catch (error) {
      console.error('Error adding shortage item:', error);
    }
  };

  const deleteShortage = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الناقص من السجل؟')) return;
    try {
      await deleteDoc(doc(db, 'shortages', id));
    } catch (error) {
      console.error('Error deleting shortage:', error);
    }
  };

  // 4. Conversion trigger setup (fetches automated cost)
  const handleOpenConversionModal = (shortage: any) => {
    setActiveShortage(shortage);

    // Dynamic historical price fetching from inventory ledger data
    const matchedItem = inventoryList.find(
      i => i.name?.trim().toLowerCase() === shortage.name?.trim().toLowerCase()
    );

    // Prioritize the exact cost of the user's last recorded purchase transaction (last_purchase_price)
    const lastPurchasePrice = matchedItem?.last_purchase_price || matchedItem?.lastBuyPrice || matchedItem?.cost || shortage.price || 0;

    // Qty planning
    const inheritedQty = shortage.quantity || (shortage.minStock ? Math.max(5, shortage.minStock * 2) : 10);

    setOrderFormData({
      name: shortage.name,
      quantity: inheritedQty,
      price: lastPurchasePrice,
      targetWholesalerId: getFilteredConnections()[0]?.supplierId || '',
      paymentType: 'cash',
      notes: `طلب تموين فوري لتغطية نقص المخزون لصنف: ${shortage.name}`
    });

    setIsOrderModalOpen(true);
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  // 5. Submit B2B Order satisfying strict marketplace laws (executeAtomicMarketCheckout)
  const handlePlaceB2BOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !profile.ownerId) return;

    if (!orderFormData.targetWholesalerId) {
      setSubmitError('يرجى تحديد جهة الطلب والتاجر المرتبط أولاً.');
      return;
    }

    const linkedSupplier = b2bConnections.find(conn => conn.supplierId === orderFormData.targetWholesalerId);
    if (!linkedSupplier) {
      setSubmitError('عذراً، الشريك التجاري المحدد غير مرتبط بحسابك التجاري الموثق.');
      return;
    }

    // التحقق الصارم من صلاحية نوع الدفع المحدد بناءً على شروط المورد
    const paymentAllowed = isPaymentTypeAllowed(linkedSupplier, orderFormData.paymentType);
    if (!paymentAllowed) {
      setSubmitError(`عذراً، طريقة الدفع المحددة غير مفتوحة لك أو غير مصرح بها مع هذا المورد.`);
      return;
    }

    // Axis 5: Mandatory Deposit Reference Validation when payment is not debt
    if (orderFormData.paymentType !== 'debt' && !orderFormData.depositRefNum.trim()) {
      setSubmitError('⚠️ [المحور 5] إلزامية إدخال رقم سند التحويل أو مرجع الإيداع قبل إرسال الطلبية للمورد.');
      return;
    }

    setIsSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      // Rule 5 Marketplace validation & compliance: 
      // Ensure the transaction product has a secure path in wholesaleProducts catalog.
      // Lookup if there's a matching supplier product, if not, bootstrap a marketplace-compliant entry automatically
      const productQuery = query(
        collection(db, 'wholesaleProducts'),
        where('wholesalerId', '==', linkedSupplier.supplierId),
        where('name', '==', orderFormData.name)
      );
      const productSnap = await getDocs(productQuery);
      let targetWholesalerProductId = '';
      let targetPhotos: string[] = [];

      // Find matching local inventory product to get its images!
      const localInvItem = inventoryList.find(
        i => i.name?.trim().toLowerCase() === orderFormData.name?.trim().toLowerCase()
      );
      const originalPhotos = localInvItem?.imageUrl ? [localInvItem.imageUrl] : (localInvItem?.photos || localInvItem?.imageUrls || []);
      if (originalPhotos.length > 0) {
        targetPhotos = originalPhotos;
      }

      if (!productSnap.empty) {
        targetWholesalerProductId = productSnap.docs[0].id;
        const existingData = productSnap.docs[0].data();
        if (existingData.photos && existingData.photos.length > 0) {
          targetPhotos = existingData.photos;
        }
      } else {
        // Create matching wholesaleProduct dynamically under that wholesaler's catalog
        // to conform to marketplace rules & satisfy runTransaction checks perfectly without race conditions
        const customProductRef = doc(collection(db, 'wholesaleProducts'));
        targetWholesalerProductId = customProductRef.id;
        await setDoc(customProductRef, {
          id: customProductRef.id,
          wholesalerId: linkedSupplier.supplierId,
          wholesalerName: linkedSupplier.supplierName || 'مورد بازار معتمد',
          name: orderFormData.name,
          description: `تم إدراج هذا الصنف آلياً تلبيةً لطلب نقص التوريد الشبكي من تاجر التجزئة`,
          price: Number(orderFormData.price), 
          cost: Number(orderFormData.price) * 0.9,
          stock: Number(orderFormData.quantity) + 1000, // safety high stock level to prevent immediate rollback trigger
          isActive: true,
          category: 'طلبيات نواقص فورية',
          photos: targetPhotos.length > 0 ? targetPhotos : ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80'],
          createdAt: serverTimestamp()
        });
      }

      // Execute compliant marketplace contract parameters
      const checkoutParams = {
        buyerProfile: {
          uid: profile.uid || 'guest_user',
          ownerId: profile.ownerId || 'demo_store',
          name: profile.name || 'تاجر التجزئة المعرّف',
          phone: profile.phone || ''
        },
        supplierId: linkedSupplier.supplierId,
        supplierName: linkedSupplier.supplierName,
        cartItems: [{
          productId: targetWholesalerProductId,
          name: orderFormData.name,
          quantity: Number(orderFormData.quantity),
          price: Number(orderFormData.price),
          selectedColor: '',
          imageUrl: targetPhotos[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80',
          photos: targetPhotos.length > 0 ? targetPhotos : ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80']
        }],
        paymentType: orderFormData.paymentType,
        notes: orderFormData.notes,
        depositWallet: orderFormData.selectedDepositWallet || 'AL_KURIMI',
        depositWalletName: 'بنك الكريمي (حاسب / مميز)',
        depositRefNum: orderFormData.depositRefNum,
        transferRefNum: orderFormData.depositRefNum
      };

      // Submit direct transaction payload, standard checking, and security handshake
      const result = await marketService.executeAtomicMarketCheckout(checkoutParams);

      if (result.success && result.orderId) {
        // Update shortage commitments appropriately
        if (activeShortage?.id) {
          // Update status in manual shortages
          await updateDoc(doc(db, 'shortages', activeShortage.id), {
            status: 'ordered',
            updatedAt: serverTimestamp()
          });
        } else {
          // Dynamic low safety stock replenishment logged into shortages database
          await addDoc(collection(db, 'shortages'), {
            ownerId: profile.ownerId,
            name: orderFormData.name,
            quantity: Number(orderFormData.quantity),
            category: 'shop',
            status: 'ordered',
            createdAt: serverTimestamp()
          });
        }

        setSubmitSuccess(`تم تحويل الصنف الناقص إلى طلب شراء معتمد رقم #${result.orderId.slice(-6)} وتقديمه بنجاح للتجهيز المحاسبي والمستودعات!`);
        
        setTimeout(() => {
          setIsOrderModalOpen(false);
          setActiveShortage(null);
          setSubmitSuccess(null);
        }, 3000);
      } else {
        setSubmitError(result.error || 'عذراً، فشلت المعاملة الذرية لطلب الشراء بسبب تضارب بروتوكول المستودعات.');
      }

    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || 'خطأ فني في التحقق من أرصدة وقيود بوابة البازار.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // 5B. Submit B2B Batch Order satisfying system permissions & whitelist rules
  const handlePlaceBatchB2BOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !profile.ownerId) return;

    if (!batchOrderFormData.targetWholesalerId) {
      setSubmitError('يرجى تحديد جهة الطلب والتاجر المرتبط أولاً.');
      return;
    }

    const linkedSupplier = b2bConnections.find(conn => conn.supplierId === batchOrderFormData.targetWholesalerId);
    if (!linkedSupplier) {
      setSubmitError('عذراً، الشريك التجاري المحدد غير مرتبط بحسابك التجاري الموثق.');
      return;
    }

    // التحقق الصارم من صلاحية نوع الدفع المحدد بناءً على شروط المورد
    const paymentAllowed = isPaymentTypeAllowed(linkedSupplier, batchOrderFormData.paymentType);
    if (!paymentAllowed) {
      setSubmitError(`عذراً، طريقة الدفع المحددة غير مفتوحة لك أو غير مصرح بها مع هذا المورد.`);
      return;
    }

    setIsSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const compiledCartItems: any[] = [];

      for (const item of batchSelectedItems) {
        // Look up historical pricing
        const matchedItem = inventoryList.find(
          i => i.name?.trim().toLowerCase() === item.name?.trim().toLowerCase()
        );
        const activePrice = matchedItem?.last_purchase_price || matchedItem?.lastBuyPrice || matchedItem?.cost || item.price || 0;
        const currentQty = item.quantity || 1;

        // Query or create wholesaleProduct catalog path dynamically under that vendor
        const productQuery = query(
          collection(db, 'wholesaleProducts'),
          where('wholesalerId', '==', linkedSupplier.supplierId),
          where('name', '==', item.name)
        );
        const productSnap = await getDocs(productQuery);
        let targetWholesalerProductId = '';
        let targetPhotos: string[] = [];

        const originalPhotos = matchedItem?.imageUrl ? [matchedItem.imageUrl] : (matchedItem?.photos || matchedItem?.imageUrls || []);
        if (originalPhotos.length > 0) {
          targetPhotos = originalPhotos;
        }

        if (!productSnap.empty) {
          targetWholesalerProductId = productSnap.docs[0].id;
          const existingData = productSnap.docs[0].data();
          if (existingData.photos && existingData.photos.length > 0) {
            targetPhotos = existingData.photos;
          }
        } else {
          const customProductRef = doc(collection(db, 'wholesaleProducts'));
          targetWholesalerProductId = customProductRef.id;
          await setDoc(customProductRef, {
            id: customProductRef.id,
            wholesalerId: linkedSupplier.supplierId,
            wholesalerName: linkedSupplier.supplierName || 'مورد بازار معتمد',
            name: item.name,
            description: `تم إدراج هذا الصنف آلياً تلبيةً لطلب نقص التوريد دفعةً واحدة من تاجر التجزئة`,
            price: Number(activePrice), 
            cost: Number(activePrice) * 0.9,
            stock: Number(currentQty) + 1000,
            isActive: true,
            category: 'طلبيات نواقص فورية دفعة',
            photos: targetPhotos.length > 0 ? targetPhotos : ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80'],
            createdAt: serverTimestamp()
          });
        }

        compiledCartItems.push({
          productId: targetWholesalerProductId,
          name: item.name,
          quantity: Number(currentQty),
          price: Number(activePrice),
          selectedColor: '',
          imageUrl: targetPhotos[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80',
          photos: targetPhotos || []
        });
      }

      // Execute compliant marketplace contract parameters
      const checkoutParams = {
        buyerProfile: {
          uid: profile.uid || 'guest_user',
          ownerId: profile.ownerId || 'demo_store',
          name: profile.name || 'تاجر التجزئة المعرّف',
          phone: profile.phone || ''
        },
        supplierId: linkedSupplier.supplierId,
        supplierName: linkedSupplier.supplierName,
        cartItems: compiledCartItems,
        paymentType: batchOrderFormData.paymentType,
        notes: batchOrderFormData.notes
      };

      const result = await marketService.executeAtomicMarketCheckout(checkoutParams);

      if (result.success && result.orderId) {
        // Update all manual/automated shortage statuses in the database
        for (const item of batchSelectedItems) {
          if (item.sourceType === 'manual') {
            await updateDoc(doc(db, 'shortages', item.id), {
              status: 'ordered',
              updatedAt: serverTimestamp()
            });
          } else {
            await addDoc(collection(db, 'shortages'), {
              ownerId: profile.ownerId,
              name: item.name,
              quantity: Number(item.quantity),
              category: 'shop',
              status: 'ordered',
              createdAt: serverTimestamp()
            });
          }
        }

        setSubmitSuccess(`تم تحويل دفعة النواقص لطلب شراء معتمد بنجاح رقم #${result.orderId.slice(-6)}!`);
        setSelectedItemIds([]); // reset checked checkboxes
        
        setTimeout(() => {
          setIsBatchOrderModalOpen(false);
          setSubmitSuccess(null);
        }, 3000);
      } else {
        setSubmitError(result.error || 'عذراً، فشلت المعاملة الذرية لطلب الدُّفعة.');
      }

    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || 'خطأ فني في تجميع وحفظ الدُّفعة بالبازار.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // 5C. Smart Shortage-to-Order Diagnostic & Routing Engine
  const runShortagesDiagnostic = (items: any[]) => {
    const onlineItems: any[] = [];
    const offlineItems: any[] = [];
    const unlinkedItems: any[] = [];

    items.forEach(item => {
      const matchedItem = inventoryList.find(
        i => i.name?.trim().toLowerCase() === item.name?.trim().toLowerCase()
      );
      
      let supplierId = item.supplierId || matchedItem?.supplierId;
      
      // Fallback if only 1 connection
      if (!supplierId && b2bConnections.length === 1) {
        supplierId = b2bConnections[0].supplierId;
      }

      if (!supplierId) {
        unlinkedItems.push(item);
      } else {
        const connection = b2bConnections.find(conn => conn.supplierId === supplierId);
        if (connection && (connection.offline === true || connection.hasAccount === false)) {
          const sName = connection.supplierName || item.supplierName || 'مورد محلي';
          const sPhone = connection.supplierPhone || '';
          offlineItems.push({ 
            ...item, 
            resolvedSupplierId: supplierId, 
            resolvedSupplierName: sName, 
            resolvedSupplierPhone: sPhone,
            isOfflineSupplier: true
          });
        } else if (connection) {
          onlineItems.push({ 
            ...item, 
            resolvedSupplierId: supplierId, 
            resolvedSupplierName: connection.supplierName || 'مورد بازار معتمد',
            isOfflineSupplier: false
          });
        } else {
          // If no active system connection was found, treat as an offline supplier
          offlineItems.push({ 
            ...item, 
            resolvedSupplierId: supplierId, 
            resolvedSupplierName: item.supplierName || 'مورد محلي مخصص', 
            resolvedSupplierPhone: '',
            isOfflineSupplier: true
          });
        }
      }
    });

    setDiagnosticReport({
      totalCount: items.length,
      onlineItems,
      offlineItems,
      unlinkedItems,
      sourceItems: items
    });
    setDiagnosticSelectedSupplierId('');
    setIsShortagesDiagnosticModalOpen(true);
  };

  const handleConvertShortagesToAutoOrders = async () => {
    if (!profile || !profile.ownerId) return;

    // Get all combined pending/not ordered shortages
    const pendingShortages = getItemsByCategory('all').filter(
      item => item.displayStatus !== 'ordered' && item.displayStatus !== 'received'
    );

    if (pendingShortages.length === 0) {
      alert("لا توجد نواقص معلقة لتحويلها حالياً.");
      return;
    }

    runShortagesDiagnostic(pendingShortages);
  };

  const handleBulkLinkShortages = async () => {
    if (!diagnosticSelectedSupplierId || !diagnosticReport) return;
    setIsSavingBulkLink(true);
    
    try {
      const selectedConn = b2bConnections.find(conn => conn.supplierId === diagnosticSelectedSupplierId);
      const supplierName = selectedConn?.supplierName || '';

      const updatedSourceItems = [...diagnosticReport.sourceItems];

      for (const item of diagnosticReport.unlinkedItems) {
        if (item.id && item.sourceType === 'manual') {
          await updateDoc(doc(db, 'shortages', item.id), {
            supplierId: diagnosticSelectedSupplierId,
            supplierName: supplierName,
            updatedAt: serverTimestamp()
          });
        }
        item.supplierId = diagnosticSelectedSupplierId;
        item.supplierName = supplierName;
      }

      // Re-run diagnostic
      runShortagesDiagnostic(updatedSourceItems);
      alert('تم ربط وتحديث الأصناف بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء الربط: ' + err.message);
    } finally {
      setIsSavingBulkLink(false);
    }
  };

  const handleExecuteOnlineCheckout = async (itemsToConvert: any[]) => {
    if (!profile || !profile.ownerId) return;
    setIsAutoConverting(true);
    setAutoConvertResult(null);

    let ordersCreatedCount = 0;
    const errors: string[] = [];

    try {
      // Group items by supplier
      const groupedBySupplier: { [supplierId: string]: { supplierName: string, items: any[] } } = {};

      for (const item of itemsToConvert) {
        const matchedItem = inventoryList.find(
          i => i.name?.trim().toLowerCase() === item.name?.trim().toLowerCase()
        );
        const supplierId = item.supplierId || item.resolvedSupplierId;
        const sName = item.supplierName || item.resolvedSupplierName || 'مورد بازار معتمد';

        if (!supplierId) continue;

        if (!groupedBySupplier[supplierId]) {
          groupedBySupplier[supplierId] = {
            supplierName: sName,
            items: []
          };
        }
        groupedBySupplier[supplierId].items.push({ item, matchedItem });
      }

      // For each group, create a separate Purchase Order
      for (const [supplierId, group] of Object.entries(groupedBySupplier)) {
        const compiledCartItems: any[] = [];

        for (const entry of group.items) {
          const { item, matchedItem } = entry;
          const activePrice = matchedItem?.last_purchase_price || matchedItem?.lastBuyPrice || matchedItem?.cost || item.price || 0;
          const currentQty = item.quantity || 1;

          // Search or create wholesaleProduct dynamically under the target wholesaler
          const productQuery = query(
            collection(db, 'wholesaleProducts'),
            where('wholesalerId', '==', supplierId),
            where('name', '==', item.name)
          );
          const productSnap = await getDocs(productQuery);
          let targetWholesalerProductId = '';
          let targetPhotos: string[] = [];

          const originalPhotos = matchedItem?.imageUrl ? [matchedItem.imageUrl] : (matchedItem?.photos || matchedItem?.imageUrls || []);
          if (originalPhotos.length > 0) {
            targetPhotos = originalPhotos;
          }

          if (!productSnap.empty) {
            targetWholesalerProductId = productSnap.docs[0].id;
            const existingData = productSnap.docs[0].data();
            if (existingData.photos && existingData.photos.length > 0) {
              targetPhotos = existingData.photos;
            }
          } else {
            const customProductRef = doc(collection(db, 'wholesaleProducts'));
            targetWholesalerProductId = customProductRef.id;
            await setDoc(customProductRef, {
              id: customProductRef.id,
              wholesalerId: supplierId,
              wholesalerName: group.supplierName,
              name: item.name,
              description: `تم إدراج هذا الصنف آلياً تلبيةً لطلب نقص التوريد دفعةً واحدة من تاجر التجزئة`,
              price: Number(activePrice),
              cost: Number(activePrice) * 0.9,
              stock: Number(currentQty) + 1000,
              isActive: true,
              category: 'طلبيات نواقص فورية آلي',
              photos: targetPhotos.length > 0 ? targetPhotos : ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80'],
              createdAt: serverTimestamp()
            });
          }

          compiledCartItems.push({
            productId: targetWholesalerProductId,
            name: item.name,
            quantity: Number(currentQty),
            price: Number(activePrice),
            selectedColor: '',
            imageUrl: targetPhotos[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80',
            photos: targetPhotos || []
          });
        }

        if (compiledCartItems.length === 0) continue;

        const checkoutParams = {
          buyerProfile: {
            uid: profile.uid || 'guest_user',
            ownerId: profile.ownerId || 'demo_store',
            name: profile.name || 'تاجر التجزئة المعرّف',
            phone: profile.phone || ''
          },
          supplierId: supplierId,
          supplierName: group.supplierName,
          cartItems: compiledCartItems,
          paymentType: 'cash' as const,
          notes: `طلب تموين تلقائي ذكي للنواقص تم توليده عبر محرك النواقص الذكي - ${new Date().toLocaleDateString('ar-EG')}`
        };

        const result = await marketService.executeAtomicMarketCheckout(checkoutParams);

        if (result.success && result.orderId) {
          ordersCreatedCount++;
          // Update status in database for items in this group
          for (const entry of group.items) {
            const { item } = entry;
            if (item.id && item.sourceType === 'manual') {
              await updateDoc(doc(db, 'shortages', item.id), {
                status: 'ordered',
                updatedAt: serverTimestamp()
              });
            } else if (item.id) {
              // Automatically register shortage status for other items
              await updateDoc(doc(db, 'shortages', item.id), {
                status: 'ordered',
                updatedAt: serverTimestamp()
              });
            }
          }
        } else {
          errors.push(`فشل إنشاء الطلب للمورد "${group.supplierName}": ${result.error || 'خطأ غير معروف'}`);
        }
      }

      if (ordersCreatedCount > 0) {
        alert(`تم تشغيل المحرك بنجاح وتوليد وبث عدد (${ordersCreatedCount}) طلبات توريد مستقلة للموردين النشطين بنجاح!`);
        setIsShortagesDiagnosticModalOpen(false);
        setSelectedItemIds([]); // reset checked checkboxes
      } else {
        alert(`فشل المحرك في تجميع وتحويل النواقص لعدم وجود موردين نشطين أو بسبب أخطاء فنية.\n${errors.join('\n')}`);
      }

    } catch (err: any) {
      console.error(err);
      alert(`حدث خطأ غير متوقع أثناء تجميع وحفظ النواقص بالبازار: ${err.message}`);
    } finally {
      setIsAutoConverting(false);
    }
  };

  const handleSendOfflineSupplierOrder = (supplierName: string, phone: string, items: any[], type: 'whatsapp' | 'sms') => {
    let message = `*📊 طلب توريد بضاعة ونواقص عاجل*\n`;
    message += `*إلى المورد:* ${supplierName}\n`;
    message += `*من متجر:* ${profile?.shopName || 'تاجر التجزئة'}\n`;
    message += `*التاريخ:* ${new Date().toLocaleDateString('ar-EG')}\n\n`;
    message += `*الأصناف المطلوبة:*\n`;
    
    items.forEach((entry, idx) => {
      message += `${idx + 1}. الصنف: ${entry.name} | الكمية: ${entry.quantity} حبة\n`;
    });
    
    message += `\nيرجى تأكيد تجهيز الطلب وإرسال التكلفة الإجمالية في أقرب وقت. شكراً لكم!`;

    const encodedText = encodeURIComponent(message);
    
    if (type === 'whatsapp') {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const url = `https://wa.me/${cleanPhone || ''}?text=${encodedText}`;
      window.open(url, '_blank');
    } else {
      const url = `sms:${phone || ''}?body=${encodedText}`;
      window.open(url, '_blank');
    }
  };

  const handleMarkOfflineAsOrdered = async (items: any[]) => {
    try {
      for (const item of items) {
        if (item.id && item.sourceType === 'manual') {
          await updateDoc(doc(db, 'shortages', item.id), {
            status: 'ordered',
            updatedAt: serverTimestamp()
          });
        } else if (item.id) {
          await updateDoc(doc(db, 'shortages', item.id), {
            status: 'ordered',
            updatedAt: serverTimestamp()
          });
        }
      }
      alert('تم تحديث حالة الأصناف بنجاح إلى "مطلوبة"!');
      if (diagnosticReport) {
        // Re-calculate diagnostic
        const recheckItems = diagnosticReport.sourceItems.map(si => {
          const matched = items.find(it => it.id === si.id);
          if (matched) {
            return { ...si, displayStatus: 'ordered' };
          }
          return si;
        });
        runShortagesDiagnostic(recheckItems);
      }
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء التحديث: ' + err.message);
    }
  };

  const handleAddLocalSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    if (!localSupplierFormData.name.trim() || !localSupplierFormData.phone.trim()) {
      alert('يرجى كتابة الاسم ورقم الهاتف.');
      return;
    }

    try {
      const docId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await setDoc(doc(db, 'b2bConnections', docId), {
        id: docId,
        buyerId: profile.ownerId,
        supplierId: docId,
        supplierName: localSupplierFormData.name.trim(),
        supplierPhone: localSupplierFormData.phone.trim(),
        offline: true,
        hasAccount: false,
        status: 'active',
        createdAt: serverTimestamp()
      });
      
      alert('تم تسجيل المورد المحلي بنجاح!');
      setIsAddLocalSupplierModalOpen(false);
      setLocalSupplierFormData({ name: '', phone: '' });
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء تسجيل المورد المحلي: ' + err.message);
    }
  };

  // 6. WhatsApp logistics dispatch compiler (Manual + Auto)
  const handleExportWhatsAppLogs = () => {
    const pendingManuals = manualShortages.filter(i => i.status === 'pending');
    const dynamicLowStock = inventoryList.filter(item => item.stock <= (item.minStock || 0));

    if (pendingManuals.length === 0 && dynamicLowStock.length === 0) {
      alert("سجل النواقص نظيف تماماً ومكتمل الفحص حالياً.");
      return;
    }

    let message = `*📊 محرك النواقص الشامل لمتجر: ${profile?.shopName || 'Jam System Pro'}*\n`;
    message += `تاريخ الجرد: ${new Date().toLocaleDateString('ar-EG')} | الموظف: ${profile?.name || 'المدير'}\n\n`;

    if (pendingManuals.length > 0) {
      message += `*📝 أصناف النواقص المسجلة يدوياً:*\n`;
      pendingManuals.forEach((item, idx) => {
        message += `  ${idx + 1}. الصنف: ${item.name} | الكمية: ${item.quantity} حبة\n`;
      });
      message += `\n`;
    }

    if (dynamicLowStock.length > 0) {
      message += `*⚠️ تنبيهات السلع منخفضة المخزون آلياً:*\n`;
      dynamicLowStock.forEach((item, idx) => {
        message += `  ${idx + 1}. السلعة: ${item.name} | المتوفر: ${item.stock} حبة (حد الأمان الأني: ${item.minStock})\n`;
      });
    }

    window.open(`https://wa.me/967772315106?text=${encodeURIComponent(message)}`, '_blank');
  };

  // 7. Render combined list
  const getItemCategoryKey = (item: any): string => {
    return (item.category || '').toLowerCase().trim();
  };

  const getItemsByCategory = (cat: string) => {
    const initialMatched = [
      ...manualShortages.map(item => ({
        ...item,
        sourceType: 'manual' as const,
        displayStatus: item.status
      })),
      ...inventoryList
        .filter(item => item.stock <= (item.minStock || 0))
        // Filter out low stock items that are already in manualShortages to prevent visualization clutter
        .filter(item => !manualShortages.some(s => s.name?.trim().toLowerCase() === item.name?.trim().toLowerCase()))
        .map(item => ({
          id: `auto_${item.id}`,
          name: item.name,
          quantity: Math.max(1, (item.minStock || 0) * 2 - item.stock),
          category: (item.category === 'spare_part' ? 'spare_part' : 'shop') as 'shop' | 'spare_part',
          status: 'pending' as const,
          sourceType: 'automated' as const,
          displayStatus: 'pending' as const,
          currentStock: item.stock,
          minStock: item.minStock,
          price: item.price || 0,
          cost: item.cost || 0,
          lastBuyPrice: item.lastBuyPrice || 0,
          createdAt: item.createdAt
        }))
    ].filter(item => {
      if (activeTab === 'all') return true;
      if (activeTab === 'manual') return item.sourceType === 'manual';
      if (activeTab === 'low_stock') return item.sourceType === 'automated';
      return true;
    });

    if (cat === 'all') return initialMatched;
    return initialMatched.filter(item => {
      const itemCat = getItemCategoryKey(item);
      if (cat === 'phones') {
        return ['phones', 'phone', 'جوالات', 'جوال', 'smartphones'].includes(itemCat);
      }
      if (cat === 'spare_parts') {
        return ['spare_part', 'spare_parts', 'قطع غيار', 'قطع', 'صيانة', 'wrench'].includes(itemCat);
      }
      if (cat === 'accessories') {
        return ['accessories', 'accessory', 'اكسسوارات', 'اكسسوار'].includes(itemCat);
      }
      if (cat === 'shop') {
        return ['shop', 'نواقص محل', 'محل'].includes(itemCat);
      }
      return false;
    });
  };

  const combinedShortageItems = getItemsByCategory(activeQuickSelectCategory).filter(item => {
    if (!shortageSearchQuery) return true;
    return item.name.toLowerCase().includes(shortageSearchQuery.toLowerCase());
  });

  const batchSelectedItems = combinedShortageItems.filter(item => selectedItemIds.includes(item.id));

  const getBatchTotal = () => {
    return batchSelectedItems.reduce((total, item) => {
      const matchedItem = inventoryList.find(
        i => i.name?.trim().toLowerCase() === item.name?.trim().toLowerCase()
      );
      const activePrice = matchedItem?.last_purchase_price || matchedItem?.lastBuyPrice || matchedItem?.cost || item.price || 0;
      const quantity = item.quantity || 1;
      return total + (quantity * activePrice);
    }, 0);
  };

  const handleQuickSelectCategoryClick = (cat: 'all' | 'phones' | 'spare_parts' | 'accessories' | 'shop') => {
    setActiveQuickSelectCategory(cat);
    const isolated = getItemsByCategory(cat);
    // Automatically update the selected selection to all currently isolated pending products
    setSelectedItemIds(isolated.filter(item => item.displayStatus !== 'ordered' && item.displayStatus !== 'received').map(x => x.id));
  };

  const handleOpenBatchConversionModal = () => {
    setBatchOrderFormData({
      targetWholesalerId: getFilteredConnections()[0]?.supplierId || '',
      paymentType: 'cash',
      notes: `طلب تموين فوري شامل لدفعة نواقص (${batchSelectedItems.length} أصناف) لمتجر: ${profile?.shopName || 'Jam System Pro'}`
    });
    setIsBatchOrderModalOpen(true);
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  return (
    <div className="space-y-6">
      {/* 👑 Elegant Royal Corporate Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-right">
          <div className="w-14 h-14 bg-navy-950 text-[#cf8a3c] rounded-[1.3rem] flex items-center justify-center shadow-2xl border border-[#cf8a3c]/20">
            <TrendingDown size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-navy-950 dark:text-white tracking-tight leading-tight">محرك النواقص وإدارة نفاد المخزون (صفحة النواقص)</h2>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Shortages & Out-of-Stock Management Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <button 
            disabled={isAutoConverting}
            onClick={handleConvertShortagesToAutoOrders}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600/10 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-2xl font-black hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-navy-950 transition-all shadow-sm ${
              isAutoConverting ? 'animate-pulse cursor-not-allowed opacity-50' : ''
            }`}
            title="تحويل كافة النواقص المعلقة تلقائياً إلى طلبات شراء موجهة لكل مورد معتمد ومسجل بالبازار"
          >
            <Cpu size={18} />
            <span>{isAutoConverting ? 'جاري التحويل...' : 'تحويل النواقص آلياً'}</span>
          </button>
          <button 
            onClick={handleExportWhatsAppLogs}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl font-black hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
          >
            <Send size={18} />
            تصدير واتساب
          </button>
          <button 
            onClick={() => setIsAddManualModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-[#cf8a3c] text-[#020512] rounded-2xl font-black shadow-[0_10px_25px_rgba(207,138,60,0.25)] hover:scale-105 transition-all"
          >
            <Plus size={18} />
            تسجيل ناقص يدوي
          </button>
        </div>
      </div>

      {/* 🚀 QUICK SCAN & SEARCH BAR FOR SHORTAGES */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-navy-900 p-4 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-md">
        <div className="relative flex-1 group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-primary transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="بحث سريع في النواقص أو مسح الباركود..." 
            className="w-full pr-12 pl-12 py-3 bg-gray-50 dark:bg-navy-950 rounded-xl border border-transparent focus:border-[#cf8a3c] outline-none shadow-sm transition-all font-bold text-sm"
            value={shortageSearchQuery}
            onChange={(e) => setShortageSearchQuery(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setIsScanningShortage(true)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#cf8a3c] hover:scale-105 transition-transform p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
            title="افتح الكاميرا لمسح باركود الناقص"
          >
            <Barcode size={20} />
          </button>
        </div>
        <button 
          onClick={() => setIsScanningShortage(true)}
          className="px-6 py-3 bg-[#cf8a3c]/10 text-[#cf8a3c] border border-[#cf8a3c]/20 rounded-xl hover:bg-[#cf8a3c] hover:text-white transition-all flex items-center justify-center gap-2 font-black text-xs"
          title="افتح الكاميرا لمسح باركود الناقص"
        >
          <Camera size={20} />
          <span>مسح بالكاميرا</span>
        </button>
      </div>

      {autoConvertResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-3xl border text-right space-y-3 ${
            autoConvertResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              autoConvertResult.success ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'
            }`}>
              {autoConvertResult.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            </div>
            <div>
              <h4 className="font-black text-sm">{autoConvertResult.success ? 'تمت المعالجة التلقائية الذكية بنجاح!' : 'تنبيه من محرك النواقص'}</h4>
              <p className="text-xs font-semibold mt-1">{autoConvertResult.message}</p>
            </div>
          </div>
          {autoConvertResult.errors && autoConvertResult.errors.length > 0 && (
            <div className="bg-black/5 dark:bg-black/20 p-4 rounded-xl space-y-1 text-xs font-mono">
              <p className="font-bold text-gray-500 dark:text-gray-400 mb-1">تفاصيل الأصناف المستبعدة أو غير المكتملة:</p>
              {autoConvertResult.errors.map((err, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={() => setAutoConvertResult(null)}
              className="text-[10px] font-black underline hover:opacity-85"
            >
              إغلاق هذا الإشعار
            </button>
          </div>
        </motion.div>
      )}

      {/* Structured Category Navigation Tabs */}
      <div className="flex p-1.5 bg-white dark:bg-navy-900 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-xl max-w-lg">
        {[
          { id: 'all', label: 'الكل بالشاشات', count: combinedShortageItems.length },
          { id: 'manual', label: 'النواقص اليدوية', count: manualShortages.length },
          { id: 'low_stock', label: 'تنبيهات انخفاض المخزون', count: inventoryList.filter(item => item.stock <= (item.minStock || 0)).length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex flex-col items-center py-3 rounded-2xl transition-all relative ${
              activeTab === tab.id 
                ? 'bg-[#cf8a3c] text-[#020512] font-black shadow-md' 
                : 'text-gray-400 hover:text-navy-900 dark:hover:text-white'
            }`}
          >
            <span className="text-xs font-black">{tab.label}</span>
            <span className={`text-[10px] font-bold mt-0.5 ${activeTab === tab.id ? 'text-[#020512]/70' : 'text-gray-400'}`}>
              ({tab.count})
            </span>
          </button>
        ))}
      </div>

      {/* 🚀 QUICK SELECT / BATCH PROCESSING BAR */}
      <div className="p-6 bg-[#cf8a3c]/5 dark:bg-navy-900/40 rounded-[2rem] border border-[#cf8a3c]/30 text-right space-y-4 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Label and core count state */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#cf8a3c]/20 flex items-center justify-center text-[#cf8a3c]">
              <Check size={20} />
            </div>
            <div>
              <h4 className="font-black text-sm text-navy-950 dark:text-white">تحديد سريع للتحويل الشامل واللوجستي (شريط التحكم)</h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-0.5">
                قنوات معالجة سريعة لفرز النواقص وترحيلها لطلبيات البازار فوراً
              </p>
            </div>
          </div>

          {/* Master selection triggers */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                // Select all currently filtered combined shortages
                const currentFiltered = getItemsByCategory(activeQuickSelectCategory).filter(item => item.displayStatus !== 'ordered' && item.displayStatus !== 'received');
                setSelectedItemIds(currentFiltered.map(x => x.id));
              }}
              className="px-4 py-2 bg-navy-950 text-white dark:bg-white/10 dark:text-white rounded-xl text-[10.5px] font-bold hover:bg-[#cf8a3c] hover:text-[#020512] transition-all"
            >
              تحديد الكل في العرض
            </button>
            <button
              onClick={() => setSelectedItemIds([])}
              className="px-4 py-2 border border-dashed border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 rounded-xl text-[10.5px] font-bold hover:bg-rose-500/10 hover:text-rose-500 transition-all"
            >
              إلغاء تحديد الكل
            </button>
          </div>
        </div>

        {/* Customization Matrix Department Toggles */}
        <div className="border-t border-[#cf8a3c]/20 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-gray-400 font-black">تصنيفات الأقسام للتحديد الذكي:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'جميع الأقسام' },
                { id: 'phones', label: 'جوالات' },
                { id: 'spare_parts', label: 'قطع غيار' },
                { id: 'accessories', label: 'اكسسوارات' },
                { id: 'shop', label: 'نواقص محل' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleQuickSelectCategoryClick(cat.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black transition-all ${
                    activeQuickSelectCategory === cat.id
                      ? 'bg-[#cf8a3c] text-[#020512] font-black shadow-sm'
                      : 'bg-white dark:bg-navy-950 border border-gray-100 dark:border-white/5 text-gray-400 hover:text-[#cf8a3c]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Core batch checkout conversion trigger */}
          <div>
            <button
              onClick={() => {
                if (selectedItemIds.length === 0) {
                  alert("يرجى تحديد صنف واحد على الأقل للتحويل.");
                  return;
                }
                const selectedItems = combinedShortageItems.filter(item => selectedItemIds.includes(item.id));
                runShortagesDiagnostic(selectedItems);
              }}
              disabled={selectedItemIds.length === 0}
              className={`w-full md:w-auto px-6 py-3 rounded-2xl text-[11px] font-black flex items-center justify-center gap-2 transition-all ${
                selectedItemIds.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-navy-800'
                  : 'bg-[#cf8a3c] hover:bg-[#d4af37] text-navy-950 shadow-lg shadow-[#cf8a3c]/15 hover:scale-[1.02]'
              }`}
            >
              <ShoppingCart size={14} />
              تحويل الدفعة المختارة ({selectedItemIds.length} أصناف) لطلب شراء
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {combinedShortageItems.map((item: any) => {
            const isManual = item.sourceType === 'manual';
            const hasMatchedInv = inventoryList.some(i => i.name?.trim().toLowerCase() === item.name?.trim().toLowerCase());
            
            return (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card-glass p-6 rounded-[2.2rem] space-y-4 relative overflow-hidden group hover:border-[#cf8a3c]/30 transition-all shadow-lg border border-slate-200/50 dark:border-white/5"
              >
                {/* Granular Checkbox Selection Terminal */}
                <div className="absolute top-4 left-4 z-20 flex items-center justify-center">
                  <input
                    type="checkbox"
                    id={`checkbox_${item.id}`}
                    disabled={item.displayStatus === 'ordered' || item.displayStatus === 'received'}
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleSelectItem(item.id)}
                    className="w-[18px] h-[18px] rounded border border-gray-300 dark:border-white/20 text-[#cf8a3c] bg-white dark:bg-navy-900 focus:ring-[#cf8a3c]/50 cursor-pointer transition-all accent-[#cf8a3c] disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Micro source tag */}
                <div className={`absolute top-0 right-0 px-4 py-1 text-[8.5px] font-black uppercase rounded-bl-xl shadow-sm ${
                  isManual ? 'bg-indigo-500 text-white' : 'bg-[#cf8a3c]/20 text-[#cf8a3c]'
                }`}>
                  {isManual ? 'تسجيل يدوي' : 'مخزون حرج آلي'}
                </div>

                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                  item.displayStatus === 'ordered' ? 'bg-[#cf8a3c] animate-pulse' : 
                  item.displayStatus === 'received' ? 'bg-success' : 'bg-gray-300 dark:bg-navy-700'
                }`} />

                <div className="flex justify-between items-start pt-2">
                  <div className="flex items-center gap-3 text-right">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner ${
                      item.category === 'spare_part' ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-600' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600'
                    }`}>
                      {item.category === 'spare_part' ? <Wrench size={20} /> : <Package size={20} />}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-navy-900 dark:text-white leading-tight">{item.name}</h3>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
                        {item.category === 'spare_part' ? 'صيانة وقطع غيار' : 'نواقص التجزئة والمبيعات'}
                      </p>
                    </div>
                  </div>

                  <div className="text-left bg-gray-50 dark:bg-navy-900/50 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-white/5">
                    <p className="text-lg font-black text-navy-900 dark:text-[#cf8a3c]/85 tabular-nums leading-none">
                      {isManual ? item.quantity : `${item.currentStock} / ${item.minStock}`}
                    </p>
                    <p className="text-[8px] text-gray-400 font-bold uppercase mt-1">
                      {isManual ? 'الكمية' : 'المتوفر/الأمان'}
                    </p>
                  </div>
                </div>

                {/* Pricing Intelligence Indicators */}
                <div className="bg-slate-50 dark:bg-navy-950/40 p-3 rounded-2xl border border-dashed border-gray-100 dark:border-white/5 text-right space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-black">
                    <span className="text-gray-400">حالة الربط بالمستودعات المحلية:</span>
                    <span className={hasMatchedInv ? 'text-success' : 'text-amber-500'}>
                      {hasMatchedInv ? '✓ مطابق لكود محلي' : '✖ صنف مجهول التشفير'}
                    </span>
                  </div>
                  {hasMatchedInv && (
                    <div className="flex justify-between items-center text-[10px] font-black">
                      <span className="text-gray-400">آخر تكلفة شراء مسجلة:</span>
                      <span className="text-[#cf8a3c] num-mono">
                        {(inventoryList.find(i => i.name?.trim().toLowerCase() === item.name?.trim().toLowerCase())?.lastBuyPrice || 
                          inventoryList.find(i => i.name?.trim().toLowerCase() === item.name?.trim().toLowerCase())?.cost || 0).toLocaleString()} ر.ي
                      </span>
                    </div>
                  )}
                </div>

                {/* Dominant Conversion Action and Controls & commits */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-navy-800/60">
                  <div className="flex gap-2">
                    {item.displayStatus !== 'ordered' && item.displayStatus !== 'received' ? (
                      <button 
                        onClick={() => runShortagesDiagnostic([item])}
                        className="px-4 py-2 bg-gradient-to-r from-[#cf8a3c] to-[#d4af37] text-[#020512] rounded-xl text-[10.5px] font-black shadow-md hover:scale-[1.03] active:scale-95 transition-all"
                        title="تحويل المعاملة لطلب فوري معتمد"
                      >
                        تحويل إلى طلب شراء فوري
                      </button>
                    ) : (
                      <span className="px-3 py-2 bg-amber-500/10 text-amber-500 rounded-xl text-[10px] font-black flex items-center gap-1.5">
                        <Clock size={12} className="animate-spin" />
                        صادر للتموين
                      </span>
                    )}

                    {isManual && (
                      <button 
                        onClick={() => deleteShortage(item.id)}
                        className="p-2 bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-rose-500/20 hover:text-rose-500 rounded-xl transition-all"
                        title="شطب الناقص"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <span className="text-[9px] text-gray-400 font-bold tabular-nums">
                    {item.createdAt instanceof Timestamp 
                      ? item.createdAt.toDate().toLocaleDateString('ar-EG') 
                      : (item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-EG') : 'نشط')}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty State visual feedback */}
      {combinedShortageItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-28 bg-white/30 dark:bg-navy-900/30 rounded-[3rem] border border-dashed border-gray-200 dark:border-white/10 space-y-4">
          <div className="w-16 h-16 bg-[#cf8a3c]/10 text-[#cf8a3c] rounded-full flex items-center justify-center animate-pulse">
            <Check size={32} />
          </div>
          <div className="text-center">
            <h4 className="text-lg font-black text-navy-900 dark:text-gray-300">مستويات المخزون مثالية بالكامل</h4>
            <p className="text-xs font-bold text-gray-400 mt-2">لا توجد نواقص مسجلة أو أصناف تحت حد الأمان حالياً.</p>
          </div>
        </div>
      )}

      {/* Modal A: Add Manual Shortage */}
      <AnimatePresence>
        {isAddManualModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddManualModalOpen(false)} className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 15 }} className="relative w-full max-w-md bg-[#020512] text-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden text-right">
              
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between border-b border-white/5">
                <div>
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <Plus className="text-[#cf8a3c]" size={20} />
                    تسجيل صنف ناقص جديد
                  </h3>
                  <p className="text-[9px] font-bold text-[#cf8a3c]/80 uppercase tracking-widest mt-0.5">Register shortage manually</p>
                </div>
                <button onClick={() => setIsAddManualModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all border border-white/5"><X size={18} /></button>
              </div>

              <form onSubmit={handleAddManualShortage} className="p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400">اسم الصنف المعطل / الناقص</label>
                  <div className="relative">
                    <input 
                      required 
                      autoFocus
                      type="text" 
                      className="w-full bg-navy-950/50 border border-white/10 pr-4 pl-12 py-3 rounded-xl text-white font-black text-sm focus:border-[#cf8a3c] outline-none transition-all text-right" 
                      placeholder="مثال: بطارية جالاكسي S23"
                      value={manualFormData.name} 
                      onChange={(e) => setManualFormData({...manualFormData, name: e.target.value})} 
                    />
                    <button
                      type="button"
                      onClick={() => setIsScanningManualAdd(true)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#cf8a3c] transition-colors p-1.5 hover:bg-white/5 rounded-lg border border-white/5"
                      title="مسح باركود الصنف بالكاميرا"
                    >
                      <Camera size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400">الكمية المقدرة</label>
                    <input 
                      required 
                      type="number" 
                      min="1"
                      className="w-full bg-navy-950/50 border border-white/10 px-4 py-3 rounded-xl text-white font-black text-sm text-center focus:border-[#cf8a3c] outline-none transition-all num-mono" 
                      value={manualFormData.quantity} 
                      onChange={(e) => setManualFormData({...manualFormData, quantity: Number(e.target.value)})} 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400">التصنيف اللوجستي</label>
                    <select 
                      className="w-full bg-navy-950 border border-white/10 px-4 py-3 rounded-xl text-white font-black text-xs focus:border-[#cf8a3c] outline-none text-right"
                      value={manualFormData.category}
                      onChange={(e) => setManualFormData({...manualFormData, category: e.target.value as any})}
                    >
                      <option value="shop">نواقص محل</option>
                      <option value="spare_part">قطع غيار وصيانة</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <button 
                      type="button" 
                      onClick={() => setIsAddLocalSupplierModalOpen(true)}
                      className="text-[9px] font-black text-[#cf8a3c] hover:underline"
                    >
                      + إضافة مورد محلي جديد
                    </button>
                    <label className="text-[10px] font-black text-gray-400">المورد المعتمد (اختياري)</label>
                  </div>
                  <select 
                    className="w-full bg-navy-950 border border-white/10 px-4 py-3 rounded-xl text-white font-black text-xs focus:border-[#cf8a3c] outline-none text-right"
                    value={manualFormData.supplierId}
                    onChange={(e) => setManualFormData({...manualFormData, supplierId: e.target.value})}
                  >
                    <option value="">-- بدون مورد (يمكن تحديده لاحقاً) --</option>
                    {getFilteredConnections().map((conn) => (
                      <option key={conn.supplierId} value={conn.supplierId}>
                        {conn.supplierName} {conn.offline ? '(مورد محلي أوفلاين)' : '(تاجر جملة بالبازار)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-[#cf8a3c] text-[#020512] rounded-xl font-black text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">
                    تسجيل الناقص في السجل
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Add Local Supplier */}
      <AnimatePresence>
        {isAddLocalSupplierModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddLocalSupplierModalOpen(false)} className="absolute inset-0 bg-black/75 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 15 }} className="relative w-full max-w-sm bg-[#0a0f24] text-white rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden text-right p-6 space-y-5">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <UserPlus className="text-[#cf8a3c]" size={18} />
                  إضافة مورد محلي جديد
                </h3>
                <button onClick={() => setIsAddLocalSupplierModalOpen(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
              </div>

              <form onSubmit={handleAddLocalSupplier} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400">اسم المورد / الشركة</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-navy-950 border border-white/10 px-4 py-2.5 rounded-xl text-white font-bold text-xs focus:border-[#cf8a3c] outline-none text-right"
                    placeholder="مثال: محلات الباشا للجملة"
                    value={localSupplierFormData.name}
                    onChange={(e) => setLocalSupplierFormData({ ...localSupplierFormData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400">رقم الهاتف (واتساب / اتصال)</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-navy-950 border border-white/10 px-4 py-2.5 rounded-xl text-white font-bold text-xs text-center focus:border-[#cf8a3c] outline-none num-mono"
                    placeholder="77xxxxxxx أو 967xxxxxxx"
                    value={localSupplierFormData.phone}
                    onChange={(e) => setLocalSupplierFormData({ ...localSupplierFormData, phone: e.target.value })}
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-3 bg-[#cf8a3c] text-[#020512] rounded-xl font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-md"
                >
                  حفظ المورد المحلي
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Smart Shortages Diagnostic Report & Dispatcher */}
      <AnimatePresence>
        {isShortagesDiagnosticModalOpen && diagnosticReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsShortagesDiagnosticModalOpen(false)} className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 15 }} className="relative w-full max-w-2xl bg-[#020512] text-white rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden text-right flex flex-col max-h-[90vh]">
              
              <div className="p-6 bg-navy-900 border-b border-white/5 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Cpu className="text-[#cf8a3c]" size={20} />
                    تقرير فحص وتوجيه النواقص الذكي
                  </h3>
                  <p className="text-[9px] font-bold text-[#cf8a3c]/80 uppercase mt-0.5">Shortage Routing Intelligence & Diagnostic</p>
                </div>
                <button onClick={() => setIsShortagesDiagnosticModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all border border-white/5"><X size={18} /></button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                
                {/* Stats Overview card */}
                <div className="grid grid-cols-4 gap-2 text-center bg-navy-950/60 p-4 rounded-2xl border border-white/5">
                  <div className="p-2">
                    <p className="text-gray-400 font-bold text-[9px]">إجمالي الأصناف</p>
                    <p className="text-base font-black text-white mt-1">{diagnosticReport.totalCount}</p>
                  </div>
                  <div className="p-2 border-r border-white/5">
                    <p className="text-emerald-400 font-bold text-[9px]">موردين بالبرنامج</p>
                    <p className="text-base font-black text-emerald-400 mt-1">{diagnosticReport.onlineItems.length}</p>
                  </div>
                  <div className="p-2 border-r border-white/5">
                    <p className="text-blue-400 font-bold text-[9px]">موردين محليين</p>
                    <p className="text-base font-black text-blue-400 mt-1">{diagnosticReport.offlineItems.length}</p>
                  </div>
                  <div className="p-2 border-r border-white/5">
                    <p className="text-rose-400 font-bold text-[9px]">غير مربوطة بمورد</p>
                    <p className="text-base font-black text-rose-400 mt-1">{diagnosticReport.unlinkedItems.length}</p>
                  </div>
                </div>

                {/* 1. Unlinked items handler */}
                {diagnosticReport.unlinkedItems.length > 0 && (
                  <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-3 text-right">
                    <div className="flex items-center gap-2 text-rose-400 font-black">
                      <AlertTriangle size={18} />
                      <h4>تنبيه: يوجد ({diagnosticReport.unlinkedItems.length}) أصناف غير مرتبطة بمورد!</h4>
                    </div>
                    <p className="text-[10px] text-gray-300 font-medium">
                      لا يمكن تحويل هذه الأصناف لطلبات شراء آلية لعدم معرفة المورد الخاص بها. يرجى اختيار مورد للأصناف أو تصديرها.
                    </p>
                    <div className="bg-black/30 p-3 rounded-xl max-h-[120px] overflow-y-auto space-y-1 font-mono text-gray-300">
                      {diagnosticReport.unlinkedItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-0.5 border-b border-white/5 last:border-0">
                          <span className="text-gray-500">الكمية: {item.quantity}</span>
                          <span className="font-bold text-white">{item.name}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-navy-950 p-3.5 rounded-xl border border-white/5 space-y-2">
                      <p className="text-[10px] font-black text-gray-400">ربط دفعة النواقص غير المربوطة بمورد محدد دفعة واحدة:</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleBulkLinkShortages}
                          disabled={isSavingBulkLink || !diagnosticSelectedSupplierId}
                          className="px-4 py-2 bg-[#cf8a3c] text-[#020512] font-black rounded-lg text-[10.5px] hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isSavingBulkLink ? 'جاري الحفظ...' : 'ربط وتحديث الآن'}
                        </button>
                        <select
                          className="flex-1 bg-navy-900 border border-white/10 px-3 py-2 rounded-lg text-white font-bold text-[11px] outline-none text-right"
                          value={diagnosticSelectedSupplierId}
                          onChange={(e) => setDiagnosticSelectedSupplierId(e.target.value)}
                        >
                          <option value="">-- اختر مورد للربط --</option>
                          {getFilteredConnections().map(conn => (
                            <option key={conn.supplierId} value={conn.supplierId}>{conn.supplierName}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Online Items handler */}
                {diagnosticReport.onlineItems.length > 0 && (
                  <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3 text-right">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-black">جاهز للتحويل الفوري</span>
                      <div className="flex items-center gap-2 text-emerald-400 font-black text-xs">
                        <CheckCircle size={18} />
                        <h4>أصناف مرتبطة بموردي البازار ({diagnosticReport.onlineItems.length})</h4>
                      </div>
                    </div>
                    
                    <div className="bg-black/30 p-3 rounded-xl max-h-[120px] overflow-y-auto space-y-1 font-mono text-gray-300">
                      {diagnosticReport.onlineItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-0.5 border-b border-white/5 last:border-0">
                          <span className="text-gray-500">المورد: {item.resolvedSupplierName || 'مورد البازار'}</span>
                          <span className="font-bold text-white">{item.name} (x{item.quantity})</span>
                        </div>
                      ))}
                    </div>

                    <button
                      disabled={isAutoConverting}
                      onClick={() => handleExecuteOnlineCheckout(diagnosticReport.onlineItems)}
                      className="w-full py-3 bg-emerald-600 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all shadow-md"
                    >
                      <Cpu size={16} />
                      <span>{isAutoConverting ? 'جاري بث طلبات الشراء...' : 'بث طلبات الشراء آلياً عبر شبكة البازار'}</span>
                    </button>
                  </div>
                )}

                {/* 3. Offline/Local Items handler */}
                {diagnosticReport.offlineItems.length > 0 && (() => {
                  // Group offline items by supplierId
                  const grouped: { [supplierId: string]: { supplierName: string, phone: string, items: any[] } } = {};
                  diagnosticReport.offlineItems.forEach(item => {
                    const sid = item.resolvedSupplierId;
                    if (!grouped[sid]) {
                      grouped[sid] = {
                        supplierName: item.resolvedSupplierName,
                        phone: item.resolvedSupplierPhone,
                        items: []
                      };
                    }
                    grouped[sid].items.push(item);
                  });

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-blue-400 font-black text-xs text-right justify-end">
                        <Users size={18} />
                        <h4>أصناف مرتبطة بموردين محليين أوفلاين ({diagnosticReport.offlineItems.length})</h4>
                      </div>

                      {Object.entries(grouped).map(([sid, grp]) => (
                        <div key={sid} className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-3 text-right">
                          <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <span className="text-[10px] text-gray-400 font-mono">رقم الهاتف: {grp.phone || 'غير مسجل'}</span>
                            <span className="font-black text-white text-sm">{grp.supplierName}</span>
                          </div>

                          <div className="p-3 bg-blue-950/20 border border-blue-500/10 rounded-xl text-[10px] text-blue-300 font-bold space-y-1 leading-relaxed">
                            <p>⚠️ هذا المورد محلي وليس لديه حساب نشط في البرنامج حالياً.</p>
                            <p>💡 اطلب منه الاشتراك في البرنامج لتسهيل المعاملات الإلكترونية والربط الآلي!</p>
                          </div>

                          <div className="bg-black/30 p-3 rounded-xl space-y-1 font-mono text-gray-300">
                            {grp.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center py-0.5 border-b border-white/5 last:border-0">
                                <span className="text-gray-500">الكمية: {item.quantity}</span>
                                <span className="font-bold text-white">{item.name} {item.displayStatus === 'ordered' && ' (مطلوبة)'}</span>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => handleSendOfflineSupplierOrder(grp.supplierName, grp.phone, grp.items, 'whatsapp')}
                              className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all"
                            >
                              <Send size={12} />
                              واتساب
                            </button>
                            <button
                              onClick={() => handleSendOfflineSupplierOrder(grp.supplierName, grp.phone, grp.items, 'sms')}
                              className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all"
                            >
                              <MessageSquare size={12} />
                              رسالة SMS
                            </button>
                            <button
                              onClick={() => handleMarkOfflineAsOrdered(grp.items)}
                              className="py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-black rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all"
                            >
                              <CheckCircle size={12} />
                              {grp.items.every(it => it.displayStatus === 'ordered') ? 'مكتمل الطلب' : 'تم الطلب'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>

              <div className="p-6 bg-navy-900 border-t border-white/5 flex justify-end shrink-0">
                <button
                  onClick={() => setIsShortagesDiagnosticModalOpen(false)}
                  className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white font-black rounded-xl text-xs transition-all"
                >
                  إغلاق التقرير
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal B: Conversion & Order Checkout Drawer (Connected Merchant Routing Mask) */}
      <AnimatePresence>
        {isOrderModalOpen && activeShortage && (() => {
          const selectedConnectionSingle = getFilteredConnections().find(conn => conn.supplierId === orderFormData.targetWholesalerId);
          const isWholesalerAllowedForActiveService = !orderFormData.targetWholesalerId || 
            isServiceAllowed(selectedConnectionSingle, activeShortage.category);

          const isWholesalerPaymentAllowedSingle = !orderFormData.targetWholesalerId || !selectedConnectionSingle ||
            isPaymentTypeAllowed(selectedConnectionSingle, orderFormData.paymentType);
          const isAllowed = isWholesalerAllowedForActiveService && isWholesalerPaymentAllowedSingle;
          const isDebtBlockedSingle = selectedConnectionSingle?.deferredLocked === true || selectedConnectionSingle?.debtWarning === true || selectedConnectionSingle?.allowDebt === false;

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOrderModalOpen(false)} className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 15 }} className="relative w-full max-w-lg bg-[#020512] text-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 overflow-hidden text-right">
                
                <div className="p-6 bg-navy-900 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <ShoppingCart className="text-[#cf8a3c]" size={20} />
                      تحويل الناقص إلى طلب شراء فوري بالبازار
                    </h3>
                    <p className="text-[9px] font-bold text-[#cf8a3c]/80 uppercase mt-0.5">Automated B2B Purchase Ingestion Protocol</p>
                  </div>
                  <button onClick={() => setIsOrderModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all border border-white/5"><X size={18} /></button>
                </div>

                <form onSubmit={handlePlaceB2BOrder} className="p-8 space-y-5">
                  
                  {submitSuccess && (
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-emerald-500/15 border border-emerald-500/30 p-4 rounded-2xl text-emerald-400 text-xs font-black leading-relaxed">
                      {submitSuccess}
                    </motion.div>
                  )}

                  {submitError && (
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-rose-500/15 border border-rose-500/30 p-4 rounded-2xl text-rose-400 text-xs font-black leading-relaxed">
                      {submitError}
                    </motion.div>
                  )}

                  {/* Masked Connected Traders List Selector */}
                  <div className="space-y-2">
                    <label className="text-[10.5px] font-black text-gray-400 flex items-center gap-1.5 justify-start">
                      <Building size={14} className="text-[#cf8a3c]" />
                      سلكت الشريك التجاري (جهة الطلب للبازار)
                    </label>
                    {getFilteredConnections().length > 0 ? (
                      <select
                        required
                        className="w-full bg-navy-950 border border-white/10 px-4 py-3 rounded-xl text-white font-black text-xs focus:border-[#cf8a3c] outline-none text-right"
                        value={orderFormData.targetWholesalerId}
                        onChange={(e) => setOrderFormData({ ...orderFormData, targetWholesalerId: e.target.value })}
                      >
                        <option value="">-- حدد المورد المرتبط الموثق --</option>
                        {getFilteredConnections().map(conn => (
                          <option key={conn.id} value={conn.supplierId}>
                            {conn.supplierName} 🔗 (وكيل مفتاح: {conn.supplierKey || 'JAM-B2B'})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold rounded-2xl line-clamp-3 leading-relaxed text-right">
                        ⚠️ لا يظهر أي تاجر جملة كشريك تجاري مرتبط أو مصرح به بحسابك حالياً في هذا القسم. يرجى مراجعة إدارة الارتباط في دليل سوق الموزعين المعتمدين.
                      </div>
                    )}
                  </div>

                  {/* 📄 REPLICA WHOLESALE MARKET CART & PREVIEW INVOICE */}
                  <div className="p-4 bg-[#070c1b] border border-amber-500/20 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-[10px] text-gray-400 font-bold">معاينة سلة وفاتورة السوق (بازار جملة)</span>
                      <span className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-black">جاهز للتحويل</span>
                    </div>

                    <div className="p-3 bg-[#020512] border border-white/5 rounded-xl flex items-center justify-between gap-3 text-right text-[11px]">
                      <div>
                        <p className="text-white font-black">{orderFormData.name}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[9px] text-gray-400 font-bold">الكمية: {orderFormData.quantity} قطع</span>
                          <span className="text-[9px] text-amber-500 font-bold">سعر القطعة: {Number(orderFormData.price).toLocaleString()} ر.ي</span>
                        </div>
                      </div>
                      <span className="text-white font-black text-xs">{(Number(orderFormData.price) * Number(orderFormData.quantity)).toLocaleString()} ر.ي</span>
                    </div>

                    <div className="bg-black/45 p-3 rounded-xl border border-white/5 text-[11px] text-right space-y-1 mt-1 font-bold">
                      <div className="flex justify-between items-center text-gray-400">
                        <span>إجمالي عدد العناصر:</span>
                        <span className="text-white">1 سلع</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5 mt-1">
                        <span className="text-gray-400">القيمة الإجمالية للثمن:</span>
                        <span className="text-amber-500 font-black text-sm">{(Number(orderFormData.price) * Number(orderFormData.quantity)).toLocaleString()} ر.ي</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Quantity manual tuning */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[#cf8a3c]">الكمية المطلوبة</label>
                      <div className="flex items-center bg-navy-950/50 border border-white/10 rounded-xl overflow-hidden">
                        <button 
                          type="button" 
                          onClick={() => setOrderFormData(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))} 
                          className="px-3 py-2.5 text-gray-400 hover:text-white"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          required
                          type="number"
                          min="1"
                          className="flex-1 bg-transparent text-center font-black text-sm text-white outline-none focus:none border-0 py-2 num-mono"
                          value={orderFormData.quantity}
                          onChange={(e) => setOrderFormData({ ...orderFormData, quantity: Math.max(1, Number(e.target.value)) })}
                        />
                        <button 
                          type="button" 
                          onClick={() => setOrderFormData(f => ({ ...f, quantity: f.quantity + 1 }))} 
                          className="px-3 py-2.5 text-gray-400 hover:text-white"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Unit price with automated cost pre-population fallback */}
                    <div className="space-y-2">
                      <label className="text-[10.5px] font-black text-[#cf8a3c] flex items-center gap-1 justify-start">
                        <DollarSign size={13} />
                        سعر الطبيلة / القطعة للجملة
                      </label>
                      <input
                        required
                        type="number"
                        min="0"
                        className="w-full bg-navy-950/50 border border-white/10 px-4 py-3 rounded-xl text-white font-black text-sm text-center focus:border-[#cf8a3c] outline-none transition-all num-mono"
                        value={orderFormData.price}
                        onChange={(e) => setOrderFormData({ ...orderFormData, price: Number(e.target.value) })}
                      />
                      <span className="text-[8.5px] text-gray-400 block mt-1 tracking-tight">
                        * السعر مجلوب آلياً من سجل آخر شراء لك.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2 select-none font-sans">
                      <label className="text-[10px] font-black text-gray-400 block text-right">بروتوكول السداد الميداني والافتراضي</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setOrderFormData({ ...orderFormData, paymentType: 'cash' })}
                          className={`py-2 rounded-xl text-[11px] font-black transition-all border ${
                            orderFormData.paymentType === 'cash' 
                              ? 'bg-[#cf8a3c] border-[#cf8a3c] text-[#020512]' 
                              : 'bg-navy-950 border-white/10 text-gray-400'
                          }`}
                        >
                          نقدي (كاش)
                        </button>
                        <button
                          type="button"
                          disabled={isDebtBlockedSingle}
                          onClick={() => {
                            if (!isDebtBlockedSingle) {
                              setOrderFormData({ ...orderFormData, paymentType: 'debt' });
                            }
                          }}
                          className={`py-2 rounded-xl text-[11px] font-black transition-all border ${
                            isDebtBlockedSingle
                              ? 'bg-rose-500/10 border-rose-500/25 text-rose-500/50 cursor-not-allowed opacity-50'
                              : orderFormData.paymentType === 'debt' 
                                ? 'bg-[#cf8a3c] border-[#cf8a3c] text-[#020512]' 
                                : 'bg-navy-950 border-white/10 text-gray-400'
                          }`}
                        >
                          {isDebtBlockedSingle ? 'آجل (🔒 مقفل)' : 'ذمم (حساب آجل)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderFormData({ ...orderFormData, paymentType: 'money_transfer' })}
                          className={`py-2 rounded-xl text-[11px] font-black transition-all border ${
                            orderFormData.paymentType === 'money_transfer' 
                              ? 'bg-[#cf8a3c] border-[#cf8a3c] text-[#020512]' 
                              : 'bg-navy-950 border-white/10 text-gray-400'
                          }`}
                        >
                          إيداع بنكي / صرافة
                        </button>
                      </div>

                      {/* الخدمات المحافظ الإلكترونية المباشرة للربط الفوري للطلب الفردي */}
                      <div className="space-y-1.5 pt-2">
                        <span className="block text-[10px] font-bold text-[#cf8a3c] text-right">💳 المحافظ الرقمية المعتمدة الخمس (Deposit Wallets):</span>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'AL_KURIMI', name: 'الكريمي جوال', desc: 'حاسب / مميز' },
                            { id: 'JEEB', name: 'محفظة جيب', desc: 'بنك اليمن والكويت' },
                            { id: 'ONE_CASH', name: 'ون كاش', desc: 'OneCash' },
                            { id: 'JAWALI', name: 'جوالي', desc: 'كاك بنك' },
                            { id: 'FLOOSAK', name: 'فلوسك', desc: 'البحرين الشامل' }
                          ].map(wallet => {
                            const isWalletAllowed = isPaymentTypeAllowed(selectedConnectionSingle, wallet.id);
                            return (
                              <button
                                key={wallet.id}
                                type="button"
                                disabled={!isWalletAllowed && orderFormData.targetWholesalerId}
                                onClick={() => {
                                  setOrderFormData({ 
                                    ...orderFormData, 
                                    selectedDepositWallet: wallet.id,
                                    paymentType: orderFormData.paymentType === 'debt' ? 'money_transfer' : orderFormData.paymentType 
                                  });
                                }}
                                className={`p-2 rounded-xl text-[10px] font-black transition-all border text-right flex flex-col justify-center cursor-pointer ${
                                  !isWalletAllowed && orderFormData.targetWholesalerId
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-500/40 cursor-not-allowed opacity-50'
                                    : orderFormData.selectedDepositWallet === wallet.id
                                      ? 'bg-[#cf8a3c] border-[#cf8a3c] text-[#020512] shadow-md font-sans'
                                      : 'bg-navy-950 border-white/10 text-gray-400 hover:border-white/20'
                                }`}
                              >
                                <span>{wallet.name} {!isWalletAllowed && orderFormData.targetWholesalerId && '🔒'}</span>
                                <span className={`text-[8px] font-semibold mt-0.5 ${orderFormData.selectedDepositWallet === wallet.id ? 'text-[#020512]/80' : 'text-gray-500'}`}>
                                  {wallet.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mandatory Deposit Reference Number Input */}
                      {orderFormData.paymentType !== 'debt' && (
                        <div className="space-y-1.5 pt-2 text-right">
                          <label className="block text-[10px] font-black text-rose-400">
                            رقم سند التحويل / مرجع الإيداع الإلزامي <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            className="w-full bg-navy-950 border border-[#cf8a3c]/40 px-4 py-2.5 rounded-xl text-white font-mono font-bold text-[11px] text-right focus:border-[#cf8a3c] outline-none"
                            placeholder="أدخل رقم الحوالة أو سند الإيداع..."
                            value={orderFormData.depositRefNum}
                            onChange={(e) => setOrderFormData({ ...orderFormData, depositRefNum: e.target.value })}
                          />
                        </div>
                      )}

                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400">ملاحظات وشهادة الفحص</label>
                      <input
                        type="text"
                        className="w-full bg-navy-950 border border-white/10 px-4 py-2.5 rounded-xl text-white font-black text-[11px] text-right focus:border-[#cf8a3c] outline-none"
                        placeholder="تعليمات إضافية للمستلم"
                        value={orderFormData.notes}
                        onChange={(e) => setOrderFormData({ ...orderFormData, notes: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    {!isAllowed ? (
                      <div className="w-full py-4 bg-rose-950/40 border border-rose-500/30 text-rose-400 rounded-xl font-black text-xs flex items-center justify-center gap-2">
                        <Lock size={14} className="animate-pulse" />
                        <span>
                          {!isWholesalerAllowedForActiveService 
                            ? 'عذراً، هذه الخدمة غير مصرح بها أو محظورة حالياً من قِبل التاجر' 
                            : 'عذراً، طريقة السداد المحددة ممنوعة أو مغلقة معك حالياً للمشتريات آجل الدفع من هذا التاجر'}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitLoading || b2bConnections.length === 0 || !orderFormData.targetWholesalerId}
                        className={`w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
                          isSubmitLoading || b2bConnections.length === 0 || !orderFormData.targetWholesalerId
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-[#cf8a3c] to-[#d4af37] text-[#020512] shadow-xl hover:scale-[1.02] active:scale-95'
                        }`}
                      >
                        {isSubmitLoading ? 'جاري معالجة القيود وتأصيل الطلب...' : 'تأكيد التسوية وإرسال الطلب فوراً'}
                      </button>
                    )}
                    <p className="text-center text-[8.5px] font-black text-gray-500 mt-4 uppercase tracking-[0.2em] italic">
                      JAM SYSTEM REALTIME SECURE DISPATCH COMPLIANCE
                    </p>
                  </div>

                </form>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Modal C: Bulk Processing & Dynamic Category-Specific Batch Checkout Modal */}
      <AnimatePresence>
        {isBatchOrderModalOpen && batchSelectedItems.length > 0 && (() => {
          const selectedConnectionBatch = getFilteredConnections().find(conn => conn.supplierId === batchOrderFormData.targetWholesalerId);
          // Check security access whitelist & bans for every single item in the batch
          const isWholesalerAllowedForBatch = !batchOrderFormData.targetWholesalerId || 
            batchSelectedItems.every(item => isServiceAllowed(selectedConnectionBatch, item.category));

          const isWholesalerPaymentAllowedForBatch = !batchOrderFormData.targetWholesalerId || !selectedConnectionBatch ||
            isPaymentTypeAllowed(selectedConnectionBatch, batchOrderFormData.paymentType);
          const isBatchAllowed = isWholesalerAllowedForBatch && isWholesalerPaymentAllowedForBatch;
          
          const isDebtBlockedBatch = selectedConnectionBatch?.deferredLocked === true || selectedConnectionBatch?.debtWarning === true || selectedConnectionBatch?.allowDebt === false;

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBatchOrderModalOpen(false)} className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 15 }} className="relative w-full max-w-2xl bg-[#020512] text-white rounded-[2.5rem] shadow-[0_25px_65px_rgba(0,0,0,0.65)] border border-[#cf8a3c]/25 overflow-hidden text-right flex flex-col max-h-[90vh]">
                
                <div className="p-6 bg-navy-900 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <ShoppingCart className="text-[#cf8a3c]" size={20} />
                      المعالجة الشاملة وتحويل دفعة النواقص ({batchSelectedItems.length} سلع) إلى البازار
                    </h3>
                    <p className="text-[9px] font-bold text-amber-500 uppercase mt-0.5">High-Efficiency Bulk Classification & Checkout Engine</p>
                  </div>
                  <button onClick={() => setIsBatchOrderModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all border border-white/5"><X size={18} /></button>
                </div>

                <form onSubmit={handlePlaceBatchB2BOrder} className="p-8 space-y-5 overflow-y-auto flex-1">
                  
                  {submitSuccess && (
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-emerald-500/15 border border-emerald-500/30 p-4 rounded-2xl text-emerald-400 text-xs font-black leading-relaxed">
                      {submitSuccess}
                    </motion.div>
                  )}

                  {submitError && (
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-rose-500/15 border border-rose-500/30 p-4 rounded-2xl text-rose-400 text-xs font-black leading-relaxed">
                      {submitError}
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Trader Selector */}
                    <div className="space-y-2">
                      <label className="text-[10.5px] font-black text-gray-400 flex items-center gap-1.5 justify-start">
                        <Building size={14} className="text-[#cf8a3c]" />
                        سلكت الشريك التجاري المستهدف لدُفعة البازار
                      </label>
                      {getFilteredConnections().length > 0 ? (
                        <select
                          required
                          className="w-full bg-navy-950 border border-[#cf8a3c]/20 px-4 py-3 rounded-xl text-white font-black text-xs focus:border-[#cf8a3c] outline-none text-right"
                          value={batchOrderFormData.targetWholesalerId}
                          onChange={(e) => setBatchOrderFormData({ ...batchOrderFormData, targetWholesalerId: e.target.value })}
                        >
                          <option value="">-- حدد الشريك الموثق --</option>
                          {getFilteredConnections().map(conn => (
                            <option key={conn.id} value={conn.supplierId}>
                              {conn.supplierName} 🔗 (معاملات: {conn.supplierKey || 'JAM-B2B'})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold rounded-2xl text-right">
                          ⚠️ لا يظهر أي تاجر جملة كشريك تجاري مرتبط أو مصرح به بحسابك حالياً في هذا القسم. يرجى الارتباط بالمزودين بمفاتيحهم الرقمية أولاً.
                        </div>
                      )}
                    </div>

                    {/* Payment option */}
                    <div className="space-y-2 select-none">
                      <label className="text-[10px] font-black text-gray-400 block text-right">طريقة تسوية الدفعة الموحدة</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBatchOrderFormData({ ...batchOrderFormData, paymentType: 'cash' })}
                          className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                            batchOrderFormData.paymentType === 'cash' 
                              ? 'bg-[#cf8a3c] border-[#cf8a3c] text-[#020512]' 
                              : 'bg-navy-950 border-white/10 text-gray-400'
                          }`}
                        >
                          نقدي (كاش)
                        </button>
                        <button
                          type="button"
                          disabled={isDebtBlockedBatch}
                          onClick={() => {
                            if (!isDebtBlockedBatch) {
                              setBatchOrderFormData({ ...batchOrderFormData, paymentType: 'debt' });
                            }
                          }}
                          className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                            isDebtBlockedBatch
                              ? 'bg-rose-500/10 border-rose-500/25 text-rose-500/50 cursor-not-allowed opacity-50'
                              : batchOrderFormData.paymentType === 'debt' 
                                ? 'bg-[#cf8a3c] border-[#cf8a3c] text-[#020512]' 
                                : 'bg-navy-950 border-white/10 text-gray-400'
                          }`}
                        >
                          {isDebtBlockedBatch ? 'آجل (🔒 مقفل)' : 'آجل / ذمم'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchOrderFormData({ ...batchOrderFormData, paymentType: 'money_transfer' })}
                          className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                            batchOrderFormData.paymentType === 'money_transfer' 
                              ? 'bg-[#cf8a3c] border-[#cf8a3c] text-[#020512]' 
                              : 'bg-navy-950 border-white/10 text-gray-400'
                          }`}
                        >
                          إيداع بنكي / صرافة
                        </button>
                      </div>

                      {/* الخدمات المحافظ الإلكترونية المباشرة للربط الفوري للدُّفعة الشاملة */}
                      <div className="space-y-1.5 pt-2">
                        <span className="block text-[10px] font-bold text-gray-400 text-right">الدفع الإلكتروني (JAM Pay):</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: 'kuraimi', name: 'الكريمي جوال', desc: 'الكريمي المباشر' },
                            { id: 'mfloos', name: 'إم فلوس (TIB)', desc: 'محفظة التضامن الذكية' },
                            { id: 'onepay', name: 'ون باي (OnePay)', desc: 'سداد سريع فوري' },
                            { id: 'jamwallet', name: 'محفظة JAM الذهبية', desc: 'رصيد الفئات المعتمد' }
                          ].map(wallet => {
                            const isWalletAllowed = isPaymentTypeAllowed(selectedConnectionBatch, wallet.id);
                            return (
                              <button
                                key={wallet.id}
                                type="button"
                                disabled={!isWalletAllowed && batchOrderFormData.targetWholesalerId}
                                onClick={() => {
                                  if (isWalletAllowed || !batchOrderFormData.targetWholesalerId) {
                                    setBatchOrderFormData({ ...batchOrderFormData, paymentType: wallet.id as any });
                                  }
                                }}
                                className={`p-2 rounded-xl text-[10px] font-black transition-all border text-right flex flex-col justify-center ${
                                  !isWalletAllowed && batchOrderFormData.targetWholesalerId
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-500/40 cursor-not-allowed opacity-50'
                                    : batchOrderFormData.paymentType === wallet.id
                                      ? 'bg-[#cf8a3c] border-[#cf8a3c] text-[#020512] shadow-md font-sans'
                                      : 'bg-navy-950 border-white/10 text-gray-400 hover:border-white/20'
                                }`}
                              >
                                <span>{wallet.name} {!isWalletAllowed && batchOrderFormData.targetWholesalerId && '🔒'}</span>
                                <span className={`text-[8px] font-semibold mt-0.5 ${batchOrderFormData.paymentType === wallet.id ? 'text-[#020512]/80' : 'text-gray-500'}`}>
                                  {wallet.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* 📄 EXACT WHOLESALE MARKET CART REPLICA */}
                  <div className="p-4 bg-[#070c1b] border-2 border-amber-500/20 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-1.5">
                        <ShoppingCart size={14} className="text-amber-500" />
                        <span className="text-xs text-white font-black">سلة طلبيات التوريد الشاملة للدفعة المضمومة</span>
                      </div>
                      <span className="text-[10px] text-amber-500 font-extrabold">{batchSelectedItems.length} أصناف تحت الفحص</span>
                    </div>

                    {/* Scrollable list of replica items */}
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {batchSelectedItems.map(item => {
                        // calculate historical purchase lookup
                        const matchedItem = inventoryList.find(
                          i => i.name?.trim().toLowerCase() === item.name?.trim().toLowerCase()
                        );
                        const activePrice = matchedItem?.lastBuyPrice || matchedItem?.cost || item.price || 0;
                        const isAllowed = isServiceAllowed(selectedConnectionBatch, item.category);

                        return (
                          <div
                            key={item.id}
                            className={`p-3 bg-[#020512] border rounded-xl flex items-center justify-between gap-3 text-right text-xs transition-all ${
                              !isAllowed && batchOrderFormData.targetWholesalerId 
                                ? 'border-rose-500/40 bg-rose-950/20' 
                                : 'border-white/5'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white font-black truncate">{item.name}</span>
                                <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-black ${
                                  item.category === 'spare_part' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                                }`}>
                                  {item.category === 'spare_part' ? 'قطع غيار' : 'نواقص محل'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-gray-500 font-bold">الكمية المقدرة: {item.quantity || 1} حبة</span>
                                <span className="text-[9px] text-gray-400">سعر الوحدة المقدر: {activePrice.toLocaleString()} ر.ي</span>
                              </div>
                            </div>

                            {/* Service Verification Check Row Block Badge */}
                            <div className="text-left shrink-0">
                              <span className="text-white font-black block leading-none">
                                {((item.quantity || 1) * activePrice).toLocaleString()} ر.ي
                              </span>
                              {batchOrderFormData.targetWholesalerId && (
                                <span className={`text-[8px] font-black inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.2 rounded ${
                                  isAllowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  {isAllowed ? '✓ متاح' : '✖ محظور حالياً'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Totals panel from invoice card */}
                    <div className="bg-black/45 p-3 rounded-xl border border-white/5 text-[11px] text-right space-y-1.5 font-bold">
                      <div className="flex justify-between items-center text-gray-400">
                        <span>إجمالي عدد العناصر:</span>
                        <span className="text-white">{batchSelectedItems.length} سلع</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-white/5 mt-1.5">
                        <span className="text-gray-400">المجموع الموحد للفاتورة:</span>
                        <span className="text-amber-500 font-black text-sm">{getBatchTotal().toLocaleString()} ر.ي</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400">ملاحظات وشهادة فحص الشحنة الموحدة</label>
                    <input
                      type="text"
                      className="w-full bg-navy-950 border border-[#cf8a3c]/10 px-4 py-2.5 rounded-xl text-white font-black text-xs text-right focus:border-[#cf8a3c] outline-none"
                      placeholder="تواريخ الشحن لجهة المتلقي..."
                      value={batchOrderFormData.notes}
                      onChange={(e) => setBatchOrderFormData({ ...batchOrderFormData, notes: e.target.value })}
                    />
                  </div>

                  {/* Compliant Secure Gate Verification Panel */}
                  <div className="pt-4 shrink-0">
                    {!isBatchAllowed ? (
                      <div className="w-full py-4 bg-rose-950/40 border border-rose-500/30 text-rose-400 rounded-xl font-black text-xs flex items-center justify-center gap-2">
                        <Lock size={14} className="animate-pulse" />
                        <span>
                          {!isWholesalerAllowedForBatch
                            ? 'عذراً، بعض هذه الخدمات غير مصرح بها أو محظورة حالياً من قِبل التاجر'
                            : 'عذراً، طريقة السداد المحددة ممنوعة أو مغلقة معك حالياً للمشتريات آجل الدفع من هذا التاجر'}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitLoading || b2bConnections.length === 0 || !batchOrderFormData.targetWholesalerId}
                        className={`w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
                          isSubmitLoading || b2bConnections.length === 0 || !batchOrderFormData.targetWholesalerId
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-[#cf8a3c] to-[#d4af37] text-navy-950 shadow-xl hover:scale-[1.02] active:scale-95'
                        }`}
                      >
                        {isSubmitLoading ? 'جاري تمرير الدفعة وإبرام العقود...' : 'تأكيد التسوية الشاملة وإرسال الدفعة فوراً'}
                      </button>
                    )}
                    <p className="text-center text-[8.5px] font-black text-gray-500 mt-4 uppercase tracking-[0.2em] italic">
                      JAM SYSTEM BATCH SECURE ROUTING GATEWAY
                    </p>
                  </div>

                </form>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {isScanningShortage && (
        <div className="fixed inset-0 z-[5000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-navy-900 rounded-3xl p-6 w-full max-w-lg relative border border-white/10">
            <button 
              onClick={() => setIsScanningShortage(false)} 
              className="absolute left-4 top-4 text-gray-400 hover:text-white p-2 rounded-full z-[5100]"
            >
              <X size={20} />
            </button>
            <BarcodeScanner 
              onScan={(code) => {
                setShortageSearchQuery(code);
                setIsScanningShortage(false);
              }}
              onClose={() => setIsScanningShortage(false)}
            />
          </div>
        </div>
      )}

      {isScanningManualAdd && (
        <div className="fixed inset-0 z-[5000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-navy-900 rounded-3xl p-6 w-full max-w-lg relative border border-white/10 text-right">
            <button 
              onClick={() => setIsScanningManualAdd(false)} 
              className="absolute left-4 top-4 text-gray-400 hover:text-white p-2 rounded-full z-[5100]"
            >
              <X size={20} />
            </button>
            <BarcodeScanner 
              onScan={async (code) => {
                setIsScanningManualAdd(false);
                // Search inventory first
                const matched = inventoryList.find(i => i.barcode === code);
                if (matched) {
                  setManualFormData(prev => ({ ...prev, name: matched.name }));
                } else {
                  try {
                    const res = await marketService.discoverGlobalPrice({ barcode: code, ownerId: profile?.ownerId });
                    if (res && res.name) {
                      setManualFormData(prev => ({ ...prev, name: res.name }));
                    } else {
                      setManualFormData(prev => ({ ...prev, name: code }));
                    }
                  } catch (e) {
                    setManualFormData(prev => ({ ...prev, name: code }));
                  }
                }
              }}
              onClose={() => setIsScanningManualAdd(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
