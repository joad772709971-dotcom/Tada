import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, Gavel, Package, TrendingUp, Zap, Link as LinkIcon, 
  ShoppingCart, CreditCard, Plus, Search, ShoppingBasket, X, 
  Loader2, ChevronRight, Image, FileText, CheckCircle2, 
  MapPin, MessageSquare, PlusCircle, History, Users, 
  Banknote, Trash2, ArrowLeft, ArrowRight, ShieldCheck,
  AlertTriangle, ExternalLink, RefreshCcw, Filter,
  Layers, Wallet, Send, Download, Camera, User, Share2,
  Lock, Unlock, AlertCircle, Coins, Undo
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, doc, updateDoc, getDoc, 
  writeBatch, getDocs, limit, orderBy, Timestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { filterConnectedSuppliersByTier, getHierarchyLevel, isAllowedTierGap } from '../utils/b2bTierHierarchy';
import { b2bLinkageEngine } from '../services/b2bLinkageEngine';
import LiveAuction from './LiveAuction';
import { EnforcedReceiptModal } from './EnforcedReceiptModal';
import { handleInvoiceRollbackAndSync } from './Accounting';
import { useConnectivity } from '../hooks/useConnectivity';

interface WholesaleProduct {
  id: string;
  wholesalerId: string;
  wholesalerName: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  isActive: boolean;
  imageUrl?: string;
  description?: string;
}

interface Order {
  id: string;
  retailerId: string;
  retailerName: string;
  wholesalerId: string;
  wholesalerName: string;
  items: any[];
  total: number;
  status: 'pending' | 'approved' | 'prepping' | 'ready' | 'shipped' | 'received' | 'cancelled';
  paymentType: 'cash' | 'debt';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paidAmount?: number;
  createdAt: any;
  updatedAt: any;
  notes?: string;
  shippingDetails?: string;
}

export default function NetworkHub({ profile }: { profile: UserProfile | null }) {
  const isOnline = useConnectivity();
  const [activeTab, setActiveTab] = React.useState<'discover' | 'public_market' | 'products' | 'wholesale_dashboard' | 'operations' | 'links' | 'orders' | 'debts'>('public_market');
  const [wholesaleProducts, setWholesaleProducts] = React.useState<WholesaleProduct[]>([]);
  const [availableWholesalers, setAvailableWholesalers] = React.useState<UserProfile[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedWholesalerId, setSelectedWholesalerId] = React.useState<string | null>(null);
  
  const [cart, setCart] = React.useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('jam_network_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Persist cart
  React.useEffect(() => {
    localStorage.setItem('jam_network_cart', JSON.stringify(cart));
  }, [cart]);

  const [networkLinks, setNetworkLinks] = React.useState<any[]>([]);
  const [onlyShowLocalWholesalers, setOnlyShowLocalWholesalers] = React.useState<boolean>(false);

  // Load B2B partnerships
  React.useEffect(() => {
    if (!profile?.ownerId) return;
    const q = query(
      collection(db, 'networkLinks'),
      where('status', '==', 'active')
    );
    const unsub = onSnapshot(q, (snap) => {
      setNetworkLinks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, [profile]);

  const hasActiveLinkWithWholesaler = (wholesalerId: string) => {
    if (!profile?.ownerId || wholesalerId === profile.ownerId) return true;
    return networkLinks.some(link => 
      (link.wholesalerId === wholesalerId && link.retailerId === profile.ownerId) ||
      (link.retailerId === wholesalerId && link.wholesalerId === profile.ownerId)
    );
  };

  const changeTabSafely = (newTab: typeof activeTab) => {
    if (cart.length > 0 && activeTab === 'products' && newTab !== 'products') {
      const confirmLeave = window.confirm(
        '⚠️ تنبيه: لديك سلع معلقة في سلة المشتريات الجارية! هل أنت متأكد من مغادرة السوق والذهاب لقسم آخر؟'
      );
      if (!confirmLeave) return;
    }
    setActiveTab(newTab);
  };

  const [isPublishModalOpen, setIsPublishModalOpen] = React.useState(false);
  const [publishingType, setPublishingType] = React.useState<'product' | 'auction'>('product');
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = React.useState(false);
  
  const [auctionForm, setAuctionForm] = React.useState({
    title: '',
    description: '',
    startPrice: 0,
    minStep: 1000,
    durationHours: 24,
    category: 'هواتف',
    details: ''
  });

  // Treasury, Settings, and Flow control states
  const [bankAccounts, setBankAccounts] = React.useState<any[]>([]);
  const [customBoxes, setCustomBoxes] = React.useState<any[]>([]);
  const [shopSettings, setShopSettings] = React.useState<any>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = React.useState(false);
  const [checkoutPaymentType, setCheckoutPaymentType] = React.useState<'cash' | 'debt' | 'money_transfer'>('cash');
  const [checkoutNotes, setCheckoutNotes] = React.useState('');
  const [selectedDepositWallet, setSelectedDepositWallet] = React.useState<string>('AL_KURIMI');
  const [depositRefNum, setDepositRefNum] = React.useState<string>('');
  const [depositSenderName, setDepositSenderName] = React.useState<string>('');

  const [wholesalerBankAccounts, setWholesalerBankAccounts] = React.useState<any[]>([]);
  const [settlementAmountReceived, setSettlementAmountReceived] = React.useState<number>(0);
  const [settlementMode, setSettlementMode] = React.useState<'debt' | 'chat_alert'>('debt');

  // Load Wholesaler Bank Accounts automatically during checkout
  React.useEffect(() => {
    if (cart.length > 0 && isCheckoutModalOpen) {
      const queryWholesalerId = cart[0].wholesalerId;
      if (queryWholesalerId) {
        const q = query(collection(db, 'bank_accounts'), where('ownerId', '==', queryWholesalerId));
        getDocs(q).then(snap => {
          setWholesalerBankAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }).catch(err => console.error("Error fetching wholesaler banks:", err));
      }
    } else {
      setWholesalerBankAccounts([]);
    }
  }, [cart, isCheckoutModalOpen]);

  // Sync settlement default amount received when selectedOrder is modified
  React.useEffect(() => {
    if (selectedOrder) {
      setSettlementAmountReceived(selectedOrder.total || 0);
    }
  }, [selectedOrder]);

  const isCurrentlyBanned = () => {
    if (!profile) return false;
    if (profile.status !== 'blocked') return false;
    const now = Date.now();
    const bannedUntilVal = profile.bannedUntil?.toMillis 
      ? profile.bannedUntil.toMillis() 
      : (profile.bannedUntil ? new Date(profile.bannedUntil).getTime() : 0);
    
    if (bannedUntilVal && bannedUntilVal > now) {
      return true;
    }
    return false;
  };

  const handleDeclareFraudulentPayment = async (order: Order) => {
    if (!profile) return;
    const confirmReport = window.confirm(
      "⚠️ تحذير الحماية المالية: هل أنت متأكد من تصنيف هذا الإيداع كـ (إيداع غير مؤكد)؟ بموجب القوانين الهندسية للنظام، سيتم فحص سجل المشتري وفرض حظر تصاعدي تلقائي وحظر حسابه تماماً."
    );
    if (!confirmReport) return;

    try {
      setLoading(true);
      // Fetch retailer user profile
      const retailerUserRef = doc(db, 'users', order.retailerId);
      const retailerUserSnap = await getDoc(retailerUserRef);
      
      let infractions = 0;
      if (retailerUserSnap.exists()) {
        infractions = Number(retailerUserSnap.data().infractionsCount || 0);
      }
      
      const newInfractionsCount = infractions + 1;
      let banDurationMs = 24 * 60 * 60 * 1000; // 1st strike: 24h
      let banPeriodText = "24 ساعة";
      
      if (newInfractionsCount === 2) {
        banDurationMs = 7 * 24 * 60 * 60 * 1000; // 2nd strike: 1 week
        banPeriodText = "أسبوع واحد";
      } else if (newInfractionsCount >= 3) {
        banDurationMs = 30 * 24 * 60 * 60 * 1000; // 3rd strike: 1 month
        banPeriodText = "شهر كامل";
      }
      
      const bannedUntilTime = Date.now() + banDurationMs;
      
      const batch = writeBatch(db);
      
      // Update retailer user status to blocked
      batch.update(retailerUserRef, {
        status: 'blocked',
        banReason: `إرسال إيداع غير مؤكد للطلب #${order.id.slice(-6)}`,
        bannedUntil: new Date(bannedUntilTime),
        infractionsCount: newInfractionsCount,
        updatedAt: serverTimestamp()
      });
      
      // Cancel the order
      batch.update(doc(db, 'orders', order.id), {
        status: 'cancelled',
        paymentStatus: 'fraud_disputed',
        notes: `تم الإلغاء والحظر التلقائي بسبب إيداع غير مؤكد. المخالفة رقم ${newInfractionsCount}.`,
        updatedAt: serverTimestamp()
      });

      // Write warning to chat
      const warningMessageRef = doc(collection(db, 'messages'));
      batch.set(warningMessageRef, {
        senderId: profile.ownerId,
        senderName: profile.shopName || profile.name,
        receiverId: order.retailerId,
        message: `⚠️ تم حظر حسابك تلقائياً لمدة ${banPeriodText} بموجب بروتوكول مكافحة الإيداعات المضللة لتجاوز البوابة المالية بنظام JAM Pro للطلب #${order.id.slice(-6)}. عدد المخالفات المسجلة: ${newInfractionsCount}`,
        status: 'sent',
        createdAt: serverTimestamp()
      });

      // Log in audit log
      const auditRef = doc(collection(db, 'auditLogs'));
      batch.set(auditRef, {
        userId: profile.uid,
        userName: profile.name,
        action: 'REPORT_FRAUDULENT_REMITTANCE_BAN',
        targetAccount: order.retailerId,
        exactAmount: order.total,
        details: `مخالفة إيداع مضلل للمشتري ${order.retailerName} للطلب #${order.id.slice(-6)}. تم الحظر التلقائي لـ ${banPeriodText}.`,
        timestamp: serverTimestamp()
      });

      await batch.commit();
      alert(`🚨 تم بنجاح تطبيق القوانين المالية! تم حظر المشتري تلقائياً لـ ${banPeriodText} وتسجيل المخالفة #${newInfractionsCount} وإلغاء الطلب.`);
      setIsOrderModalOpen(false);
      setSelectedOrder(null);
    } catch (err) {
      console.error(err);
      alert('خطأ أثناء تقديم بلاغ الحوالة الوهمية');
    } finally {
      setLoading(false);
    }
  };
  
  // States for Payment Verification (Wholesaler side)
  const [isVerifyingPayment, setIsVerifyingPayment] = React.useState(false);
  const [selectedVerificationBox, setSelectedVerificationBox] = React.useState('');
  const [selectedRemittanceForVerification, setSelectedRemittanceForVerification] = React.useState<Order | null>(null);
  const [discoverSubTab, setDiscoverSubTab] = React.useState<'suppliers' | 'clients'>('suppliers');
  const [myClients, setMyClients] = React.useState<any[]>([]);
  
  // Sharing Triggers & Marketplace Routing
  const [sharingLoading, setSharingLoading] = React.useState<string | null>(null);

  const handleShareNewOnly = async () => {
    if (!profile) return;
    try {
      setSharingLoading('new_only');
      const targetMarket = profile.role === 'wholesaler' ? 'سوق الموردين B2B (Suppliers Marketplace)' : 'سوق المستهلكين والمزادات (Consumer Marketplace)';
      
      await addDoc(collection(db, 'auditLogs'), {
        ownerId: profile.ownerId,
        action: 'SHARE_NEW_ONLY',
        details: `مزامنة وتصدير المنتجات والمنشورات الجديدة بنجاح إلى ${targetMarket}`,
        createdAt: serverTimestamp()
      });

      alert(`✓ تمت مزامنة وتوجيه المنتجات الجديدة بنجاح إلى ${targetMarket}!`);
    } catch (err) {
      console.error(err);
      alert('خطأ أثناء المزامنة');
    } finally {
      setSharingLoading(null);
    }
  };

  const handleShareAll = async () => {
    if (!profile) return;
    try {
      setSharingLoading('all');
      const targetMarket = profile.role === 'wholesaler' ? 'سوق الموردين B2B (Suppliers Marketplace)' : 'سوق المستهلكين والمزادات (Consumer Marketplace)';
      
      await addDoc(collection(db, 'auditLogs'), {
        ownerId: profile.ownerId,
        action: 'SHARE_ALL_PRODUCTS',
        details: `مزامنة شاملة وإعادة نشر كافة السلع في ${targetMarket}`,
        createdAt: serverTimestamp()
      });

      alert(`✓ تم تحديث ومزامنة كافة المنتجات والمخزون بنجاح في ${targetMarket}!`);
    } catch (err) {
      console.error(err);
      alert('خطأ أثناء المزامنة الشاملة');
    } finally {
      setSharingLoading(null);
    }
  };
  
  // States for Remittance submission (Retailer side)
  const [isRemittanceModalOpen, setIsRemittanceModalOpen] = React.useState(false);
  const [remittanceForm, setRemittanceForm] = React.useState({
    remittanceNumber: '',
    senderName: '',
    amountPaid: 0,
    brokerName: '',
    invoiceDate: new Date().toISOString().split('T')[0]
  });

  // Flow control states for Settle/Pricing during Wholesaler final Dispatch
  const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);
  const [dispatchItemPrices, setDispatchItemPrices] = React.useState<Record<string, number>>({});
  const [dispatchRefundBox, setDispatchRefundBox] = React.useState('CASH_BOX');
  const [dispatchRefundDetails, setDispatchRefundDetails] = React.useState('');

  const [shippingMode, setShippingMode] = React.useState<'ship_only' | 'ship_delivery'>('ship_only');
  const [selectedDeliveryAgentId, setSelectedDeliveryAgentId] = React.useState('');
  const [selectedDeliveryAgentName, setSelectedDeliveryAgentName] = React.useState('');
  const [deliveryAgents, setDeliveryAgents] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!profile?.ownerId) return;
    const q = query(collection(db, 'users'), where('role', '==', 'delivery_agent'));
    getDocs(q).then(snap => {
      setDeliveryAgents(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
  }, [profile, isDispatchModalOpen]);

  // Flow control states for Stock Distribution during Retailer final receipt
  const [isDistributionModalOpen, setIsDistributionModalOpen] = React.useState(false);
  const [distributionType, setDistributionType] = React.useState<'ALL_TO_ONE' | 'SPLIT_HALF_QUARTER' | 'CUSTOM'>('ALL_TO_ONE');
  const [selectedWarehouse1, setSelectedWarehouse1] = React.useState('');
  const [selectedWarehouse2, setSelectedWarehouse2] = React.useState('');
  const [customAllocation, setCustomAllocation] = React.useState<Record<string, Record<string, number>>>({}); // productId -> warehouseId -> qty

  // 5-Tier automated Pricing Engine states
  const [pricingStrategy, setPricingStrategy] = React.useState<'market' | 'history' | 'manual' | 'percentage' | 'flat'>('manual');
  const [markupPercentage, setMarkupPercentage] = React.useState<number>(25);
  const [flatStepGoal, setFlatStepGoal] = React.useState<number>(150);
  const [receivingItemPrices, setReceivingItemPrices] = React.useState<Record<string, number>>({});
  const [localInventory, setLocalInventory] = React.useState<any[]>([]);

  // Fetch local inventory for Pricing Engine
  useEffect(() => {
    if (!profile?.ownerId) return;
    const q = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    const unsub = onSnapshot(q, (snap) => {
      setLocalInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, [profile]);

  const isWholesaler = profile?.role === 'wholesaler' || profile?.networkRole === 'wholesaler';
  const isDistributor = profile?.role === 'distributor';

  // Fetch shop settings
  useEffect(() => {
    if (!profile?.ownerId) return;
    const unsub = onSnapshot(doc(db, 'settings', profile.ownerId), (snap) => {
      if (snap.exists()) {
        setShopSettings(snap.data());
      }
    });
    return unsub;
  }, [profile]);

  // Sync calculated prices dynamically whenever parameters change
  useEffect(() => {
    if (!selectedOrder || !selectedOrder.items) return;
    
    const calculated = getCalculatedPrices(
      selectedOrder.items,
      pricingStrategy,
      {
        percentage: markupPercentage,
        flatStep: flatStepGoal,
        inventory: localInventory,
        wholesaleProducts: wholesaleProducts,
        manualPrices: receivingItemPrices
      }
    );

    const newPrices: Record<string, number> = {};
    selectedOrder.items.forEach((item: any) => {
      // For manual, preserve existing inputs if they are already defined by the user
      if (pricingStrategy === 'manual' && receivingItemPrices[item.productId] !== undefined) {
        newPrices[item.productId] = receivingItemPrices[item.productId];
      } else {
        newPrices[item.productId] = calculated[item.productId]?.price || (item.actualPrice || item.price) * 1.25;
      }
    });

    setReceivingItemPrices(newPrices);
  }, [
    selectedOrder,
    pricingStrategy,
    markupPercentage,
    flatStepGoal,
    localInventory.length,
    wholesaleProducts.length
  ]);

  // Fetch bank accounts / boxes
  useEffect(() => {
    if (!profile?.ownerId) return;
    const q = query(collection(db, 'bank_accounts'), where('ownerId', '==', profile.ownerId));
    const unsubBanks = onSnapshot(q, (snap) => {
      setBankAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCustom = onSnapshot(
      collection(db, 'stores', profile.ownerId, 'customBoxes'),
      (snap) => {
        setCustomBoxes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubBanks();
      unsubCustom();
    };
  }, [profile]);

  // Derived stats
  const pendingRequestsCount = orders.filter(o => o.wholesalerId === profile?.ownerId && o.status === 'pending').length;
  const incomingShipmentsCount = orders.filter(o => o.retailerId === profile?.ownerId && o.status === 'shipped').length;

  useEffect(() => {
    const q = query(collection(db, 'wholesaleProducts'), where('isActive', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      setWholesaleProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as WholesaleProduct)));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('networkRole', '==', 'wholesaler'));
    const unsub = onSnapshot(q, (snap) => {
      const buyerRole = profile?.hierarchyLevel || profile?.role || 'retailer';
      const filtered = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter(w => {
          const wholesalerRole = w.hierarchyLevel || w.role || w.networkRole || 'wholesaler';
          return isAllowedTierGap(buyerRole, wholesalerRole);
        });
      setAvailableWholesalers(filtered);
    });
    return unsub;
  }, [profile]);

  useEffect(() => {
    if (!profile?.ownerId) return;
    const q = query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId));
    const unsub = onSnapshot(q, (snap) => {
      setMyClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'orders'),
      where(isWholesaler ? 'wholesalerId' : 'retailerId', '==', profile.ownerId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });
    return unsub;
  }, [profile, isWholesaler]);

  const addToCart = (product: WholesaleProduct) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const handlePlaceB2BOrder = async () => {
    if (!profile || cart.length === 0) return;

    if (!isOnline) {
      alert("⚠️ لا يوجد اتصال بالإنترنت حالياً! إرسال الطلبيات والربط مع التاجر في السوق يتطلب اتصالاً بالإنترنت. يرجى الاتصال ثم إعادة المحاولة.");
      return;
    }
    
    // First verify if the customer has a progressive ban active
    if (isCurrentlyBanned()) {
      alert("⚠️ حسابك محظور مؤقتاً بموجب بروتوكول الحماية المالية الفورية! يرجى الانتظار حتى انتهاء فترة عقوبة الحظر.");
      return;
    }

    try {
      setLoading(true);
      const wholesalerId = cart[0].wholesalerId;
      const wholesalerName = cart[0].wholesalerName;

      // 1. Prevent duplicate pending orders with the same supplier
      const qPending = query(
        collection(db, 'orders'),
        where('retailerId', '==', profile.ownerId),
        where('wholesalerId', '==', wholesalerId),
        where('status', '==', 'pending')
      );
      const pendingSnap = await getDocs(qPending);
      if (!pendingSnap.empty) {
        alert('⚠️ توجيه أمني: لديك طلب جاري بالفعل قيد المراجعة مع هذا المورد حالياً! يرجى انتظار معالجة الطلب السابق لمنع تكرار الإيداعات.');
        setLoading(false);
        return;
      }

      // 2. Limit: Max 20 parallel processing orders
      const qAllActive = query(
        collection(db, 'orders'),
        where('retailerId', '==', profile.ownerId),
        where('status', 'in', ['pending', 'approved', 'prepping', 'ready', 'shipped'])
      );
      const activeSnap = await getDocs(qAllActive);
      if (activeSnap.size >= 20) {
        alert('⚠️ بروتوكول الحماية المالية: تم تجاوز الحد الأقصى للمشتريات المتوازية النشطة (20 طلب). يرجى تصفية وسداد فواتيرك السابقة أولاً لتجنب حظر المعاملات.');
        setLoading(false);
        return;
      }

      const orderTotal = cart.reduce((s, i) => s + ((i.price ?? 0) * (i.quantity ?? 0)), 0);

      // Axis 5: Enforce Mandatory Deposit Reference Number when submitting cash/deposit wallet orders
      if (checkoutPaymentType !== 'debt') {
        if (!depositRefNum.trim()) {
          alert('⚠️ [المحور 5] إلزامية إدخال رقم سند التحويل أو مرجع الإيداع المالي قبل إرسال الطلبية للمورد.');
          setLoading(false);
          return;
        }
      }

      // Axis 2: Credit Limit & Connection Status Verification
      const creditCheck = await b2bLinkageEngine.verifyOrderCreditAndStatus({
        buyerOwnerId: profile.ownerId,
        supplierOwnerId: wholesalerId,
        paymentType: checkoutPaymentType === 'debt' ? 'debt' : 'cash',
        orderAmount: orderTotal
      });

      if (!creditCheck.allowed) {
        alert(creditCheck.message);
        setLoading(false);
        return;
      }
      
      const orderItems = cart.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        actualPrice: item.price, 
        shippedQuantity: item.quantity,
      }));

      const walletNamesMap: Record<string, string> = {
        'AL_KURIMI': 'بنك الكريمي (حاسب / مميز)',
        'JEEB': 'محفظة جيب الإلكترونية',
        'ONE_CASH': 'محفظة ون كاش',
        'JAWALI': 'محفظة جوالي الإلكترونية',
        'FLOOSAK': 'محفظة فلوسك'
      };

      const newOrder = {
        store_id: profile.ownerId,
        ownerId: profile.ownerId,
        retailerId: profile.ownerId,
        retailerName: profile.shopName || profile.name,
        wholesalerId,
        wholesalerName,
        items: orderItems,
        total: orderTotal,
        status: 'pending',
        paymentType: checkoutPaymentType, // 'cash' | 'debt' | 'money_transfer'
        paymentStatus: 'unpaid',
        paidAmount: 0,
        depositWallet: selectedDepositWallet || 'AL_KURIMI',
        depositWalletName: walletNamesMap[selectedDepositWallet] || 'بنك الكريمي (حاسب / مميز)',
        depositRefNum: depositRefNum.trim() || null,
        transferRefNum: depositRefNum.trim() || null,
        paymentDetails: depositRefNum.trim() ? {
          remittanceNumber: depositRefNum.trim(),
          senderName: depositSenderName.trim() || profile.name,
          amountPaid: orderTotal,
          brokerName: walletNamesMap[selectedDepositWallet] || 'محفظة إلكترونية معتمدة',
          depositWallet: selectedDepositWallet
        } : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        notes: checkoutNotes
      };

      await addDoc(collection(db, 'orders'), newOrder);
      
      // Log the order immutably
      await addDoc(collection(db, 'auditLogs'), {
        userId: profile.uid,
        userName: profile.name,
        action: 'PLACE_B2B_ORDER',
        targetAccount: wholesalerId,
        exactAmount: orderTotal,
        details: `طلب مبيعات شبكي B2B بقيمة ${orderTotal} ر.ي بنظام ${checkoutPaymentType === 'cash' ? 'نقدي' : 'آجل'}`,
        timestamp: serverTimestamp()
      });

      alert('تم إرسال الطلبية بنجاح وهي قيد المراجعة والمطابقة!');
      setCart([]);
      setIsCheckoutModalOpen(false);
      setCheckoutNotes('');
      setActiveTab('orders');
    } catch (err) {
      console.error(err);
      alert('خطأ في إرسال الطلبية');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToWarehouse = async (order: Order) => {
    if (!profile) return;
    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      const prepDocRef = doc(collection(db, 'warehousePreps'));
      const prepData = {
        ownerId: profile.ownerId,
        orderId: order.id,
        customerName: order.retailerName,
        items: order.items.map(i => ({
          itemId: i.productId,
          name: i.name,
          requestedQty: i.quantity,
          preparedQty: i.quantity,
          status: 'pending'
        })),
        prepStatus: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      batch.set(prepDocRef, prepData);

      const prepOrderRef = doc(db, 'warehousePrepOrders', prepDocRef.id);
      batch.set(prepOrderRef, {
        id: prepDocRef.id,
        ownerId: profile.ownerId,
        orderId: order.id,
        customerName: order.retailerName,
        items: order.items.map(i => ({
          itemId: i.productId,
          name: i.name,
          requestedQty: i.quantity,
          preparedQty: i.quantity,
          status: 'pending'
        })),
        prepStatus: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      batch.update(doc(db, 'orders', order.id), {
        status: 'prepping',
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      await addDoc(collection(db, 'auditLogs'), {
        userId: profile.uid,
        userName: profile.name,
        action: 'SEND_TO_WAREHOUSE_PREP',
        targetAccount: order.id,
        exactAmount: order.total,
        details: `إرسال الطلب #${order.id.slice(-6)} للمستودع للمطابقة والتجهيز`,
        timestamp: serverTimestamp()
      });

      alert('تم إرسال الطلب للمستودع للمطابقة والتعبئة بنجاح!');
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder(prev => prev ? { ...prev, status: 'prepping' } : null);
      }
    } catch (err) {
      console.error(err);
      alert('خطأ في إرسال طلب المطابقة للمخزن');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyB2BPayment = async (order: Order, destType: string, selectedBox: string, details: string) => {
    if (!profile) {
      alert('الرجاء تسجيل الدخول أولاً');
      return;
    }
    const remittance = order.paymentDetails;
    if (!remittance) {
      alert('لم يتم تقديم إثبات سداد مالي أو إيداع من العميل بعد!');
      return;
    }

    const receivedAmountRaw = prompt(
      `مبلغ السداد الفعلي المستلم من هذا الإيداع (قيمة الإيداع المعلنة: ${Number(remittance.amountPaid || 0).toLocaleString()} ر.ي):`, 
      String(remittance.amountPaid || 0)
    );
    if (receivedAmountRaw === null) return;
    const amount = Number(receivedAmountRaw) || 0;

    try {
      setLoading(true);
      const batch = writeBatch(db);

      const difference = order.total - (order.paidAmount || 0) - amount;
      if (difference > 0) {
        const choice = prompt(
          `⚠️ العجز المالي المتبقي هو ${difference.toLocaleString()} ر.ي.\nأدخل (1) لترحيل الفرق كدين آجل في ذمة المشتري الحالي\nأدخل (2) لإرسال إشعار شات آلي يطالب المشتري فوراً بمسح سلع لتسوية الحساب:`, 
          "1"
        );
        if (choice === "1") {
          batch.update(doc(db, 'orders', order.id), {
            paymentStatus: 'partially_paid_debt',
            debtTransferredAmount: difference
          });
          const transRef = doc(collection(db, 'transactions'));
          batch.set(transRef, {
            ownerId: profile.ownerId,
            amount: difference,
            type: 'income',
            category: 'ديون مبيعات شبكية مؤجلة',
            description: `ترحيل مديونية معلقة للطلب #${order.id.slice(-6)} بمبلغ عجز قدره ${difference} ر.ي`,
            createdAt: serverTimestamp()
          });
          alert(`تم ترحيل مبلغ العجز كدين آجل بقيمة ${difference} ر.ي ✅`);
        } else if (choice === "2") {
          const warningMessageRef = doc(collection(db, 'messages'));
          batch.set(warningMessageRef, {
            senderId: profile.ownerId,
            senderName: profile.shopName || profile.name,
            receiverId: order.retailerId,
            message: `⚠️ تنبيه تسوية عاجل: لقد حصل عجز مالي قدره ${difference.toLocaleString()} ر.ي في مطابقة إيداعكم للطلب الجديد #${order.id.slice(-6)}. يرجى حذف أو تعديل سلع تطابق هذا العجز (${difference.toLocaleString()} ر.ي) لنتمكن من مطابقة الحساب فورا وتمرير الطلب للتجهيز الشحن.`,
            status: 'sent',
            createdAt: serverTimestamp()
          });
          alert(`تم إشعار المشتري عن طريق الشات لطلب حذف سلع العجز 💬`);
        }
      }
      
      let finalBoxId = selectedBox || 'CASH_BOX';
      let finalBoxName = 'صندوق الكاش المباشر للمحل';
      
      if (destType === 'BANK_ACCOUNT' && selectedBox) {
        const boxRef = doc(db, 'bank_accounts', selectedBox);
        const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', selectedBox);
        const boxSnap = await getDoc(boxRef);
        const customSnap = await getDoc(customRef);

        if (boxSnap.exists()) {
          const currentBalance = Number(boxSnap.data().balance || 0);
          const newBalance = currentBalance + amount;
          batch.update(boxRef, {
            balance: newBalance,
            updatedAt: serverTimestamp()
          });
          finalBoxName = boxSnap.data().boxName || boxSnap.data().bankName || 'حساب مالي';
        } else if (customSnap.exists()) {
          const currentBalance = Number(customSnap.data().balance || 0);
          const newBalance = currentBalance + amount;
          batch.update(customRef, {
            balance: newBalance
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
          alert('صندوق الحفظ المالي المحدد غير موجود!');
          setLoading(false);
          return;
        }
      } else if (destType === 'CASH_TO_STORE') {
        finalBoxId = 'CASH_BOX';
        finalBoxName = 'صندوق الكاش المباشر للمحل';
      } else if (destType === 'BIG_MERCHANT') {
        finalBoxId = 'BIG_MERCHANT_ROUTING';
        finalBoxName = 'ترحيل مباشر لتاجر كبير';
      } else if (destType === 'OWNER_HANDOVER') {
        finalBoxId = 'OWNER_HANDOVER_ROUTING';
        finalBoxName = 'تسليم مباشر للملاك';
      }

      // Update Order Status as Paid/Verified
      batch.update(doc(db, 'orders', order.id), {
        paymentStatus: 'paid',
        paymentVerified: true,
        paidAmount: (order.paidAmount || 0) + amount,
        remittanceRoutingType: destType,
        remittanceRoutingBoxId: finalBoxId,
        remittanceRoutingBoxName: finalBoxName,
        remittanceRoutingDetails: details,
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
        description: `توريد إيداع سداد للطلب #${order.id.slice(-6)} بموجب المسار المالي: ${finalBoxName} - تفاصيل: ${details}`,
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
        details: `تأكيد استلام إيداع B2B رقم ${remittance.remittanceNumber} بقيمة ${amount} ر.ي وتوجيهها بمسار (${destType}) إلى (${finalBoxName}) - الموثق: ${details}`,
        timestamp: serverTimestamp()
      });

      await batch.commit();
      alert(`تم بنجاح تأكيد استلام الإيداع وتوجيهه بمسار: ${finalBoxName}! تم إلغاء قفل شحن الطلب.`);
      
      setSelectedRemittanceForVerification(null);
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder(prev => prev ? { 
          ...prev, 
          paymentStatus: 'paid', 
          paymentVerified: true, 
          paidAmount: (prev.paidAmount || 0) + amount,
          remittanceRoutingType: destType,
          remittanceRoutingBoxId: finalBoxId,
          remittanceRoutingBoxName: finalBoxName,
          remittanceRoutingDetails: details
        } : null);
      }
    } catch (err) {
      console.error(err);
      alert('خطأ في تأكيد وتوجيه الحوالة مالياً');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRemittance = async (order: Order) => {
    if (!profile) return;
    if (!remittanceForm.remittanceNumber || remittanceForm.amountPaid <= 0 || !remittanceForm.senderName) {
      alert('يرجى تعبئة كافة الحقول بشكل صحيح!');
      return;
    }

    try {
      setLoading(true);
      await updateDoc(doc(db, 'orders', order.id), {
        paymentDetails: remittanceForm,
        updatedAt: serverTimestamp()
      });
      alert('تم إرسال تفاصيل السداد المالي بنجاح وبانتظار مراجعة وقبول المورد!');
      
      setIsRemittanceModalOpen(false);
      setRemittanceForm({
        remittanceNumber: '',
        senderName: '',
        amountPaid: 0,
        brokerName: '',
        invoiceDate: new Date().toISOString().split('T')[0]
      });

      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder(prev => prev ? { ...prev, paymentDetails: remittanceForm } : null);
      }
    } catch (err) {
      console.error(err);
      alert('خطأ في إرسال تفاصيل السداد');
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchAndSettleOrder = async (order: Order) => {
    if (!profile) return;

    if (shippingMode === 'ship_delivery' && !selectedDeliveryAgentId) {
      alert('من فضلك حدد السائق أو عامل التوصيل لتكليفه بالطلب الفوري!');
      return;
    }
    
    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      let newTotal = 0;
      const originalTotal = order.total;
      const isDebt = order.paymentType === 'debt';
      const itemsCopy = [...(order.items || [])];

      itemsCopy.forEach((item, idx) => {
        const itemPrice = dispatchItemPrices[item.productId] !== undefined ? dispatchItemPrices[item.productId] : item.price;
        itemsCopy[idx].actualPrice = itemPrice;
        newTotal += itemPrice * (item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity);
      });

      let expressPayloadCode = '';
      if (shippingMode === 'ship_delivery') {
        expressPayloadCode = 'EXP-' + Math.floor(1000 + Math.random() * 9000);
      }

      if (isDebt) {
        const diff = newTotal - originalTotal;
        batch.update(doc(db, 'orders', order.id), {
          items: itemsCopy,
          total: newTotal,
          originalTotal,
          priceFluctuationDifference: diff,
          status: 'shipped',
          shippingMode,
          deliveryAgentId: selectedDeliveryAgentId || null,
          deliveryAgentName: selectedDeliveryAgentName || null,
          deliveryLocked: shippingMode === 'ship_delivery',
          expressPayloadCode,
          updatedAt: serverTimestamp()
        });

        // automatic ledger adjustments if product items prices fluctuate during processing
        if (diff !== 0) {
          const custQ = query(
            collection(db, 'customers'),
            where('ownerId', '==', profile.ownerId),
            where('phone', '==', order.retailerPhone || '')
          );
          const custSnap = await getDocs(custQ);
          if (!custSnap.empty) {
            const custDoc = custSnap.docs[0];
            const currentDebt = Number(custDoc.data().debt || 0);
            batch.update(custDoc.ref, {
              debt: currentDebt + diff,
              updatedAt: serverTimestamp()
            });
            console.log(`Auto-adjusted debt record ledger by: ${diff} YER`);
          }
        }

        await addDoc(collection(db, 'auditLogs'), {
          userId: profile.uid,
          userName: profile.name,
          action: 'DEBT_PRICE_FLUCTUATION_SETTLEMENT',
          targetAccount: order.retailerId,
          exactAmount: Math.abs(diff),
          details: `تسوية فروق أسعار بالآجل للطلب #${order.id.slice(-6)} - فارق السعر الكلي: ${diff} ر.ي`,
          timestamp: serverTimestamp()
        });
      } else {
        const refundAmount = (order.paidAmount || 0) - newTotal;
        
        if (refundAmount > 0) {
          if (dispatchRefundBox === 'CASH_BOX') {
             await addDoc(collection(db, 'transactions'), {
               ownerId: profile.ownerId,
               amount: refundAmount,
               type: 'expense',
               category: 'إرجاع دفعات B2B',
               description: `استرجاع فارق نقدي (زلط نقد) للطلب #${order.id.slice(-6)} بسبب نقص الكمية المستلمة`,
               createdAt: serverTimestamp()
             });
          } else {
             const boxRef = doc(db, 'bank_accounts', dispatchRefundBox);
             const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', dispatchRefundBox);
             const boxSnap = await getDoc(boxRef);
             const customSnap = await getDoc(customRef);

             if (boxSnap.exists()) {
               const currentBal = Number(boxSnap.data().balance || 0);
               batch.update(boxRef, {
                 balance: currentBal - refundAmount,
                 updatedAt: serverTimestamp()
               });

               await addDoc(collection(db, 'transactions'), {
                 ownerId: profile.ownerId,
                 amount: refundAmount,
                 type: 'expense',
                 boxId: dispatchRefundBox,
                 boxName: boxSnap.data().boxName || boxSnap.data().bankName || 'حساب مالي',
                 category: 'إرجاع دفعات B2B',
                 description: `استرجاع فارق نقدي (زلط نقد) للطلب #${order.id.slice(-6)} من ${boxSnap.data().boxName || boxSnap.data().bankName || 'حساب مالي'}`,
                 createdAt: serverTimestamp()
               });
             } else if (customSnap.exists()) {
               const currentBal = Number(customSnap.data().balance || 0);
               batch.update(customRef, {
                 balance: currentBal - refundAmount
               });

               // Sync linked bank account if applicable
               const customData = customSnap.data();
               if (customData.isLinkedToBank && customData.bankAccountId) {
                 const linkedBankRef = doc(db, 'bank_accounts', customData.bankAccountId);
                 const linkedBankSnap = await getDoc(linkedBankRef);
                 if (linkedBankSnap.exists()) {
                   const currentBankBal = Number(linkedBankSnap.data().balance || 0);
                   batch.update(linkedBankRef, {
                     balance: currentBankBal - refundAmount,
                     updatedAt: serverTimestamp()
                   });
                 }
               }

               await addDoc(collection(db, 'transactions'), {
                 ownerId: profile.ownerId,
                 amount: refundAmount,
                 type: 'expense',
                 boxId: dispatchRefundBox,
                 boxName: customSnap.data().boxName,
                 category: 'إرجاع دفعات B2B',
                 description: `استرجاع فارق نقدي (زلط نقد) للطلب #${order.id.slice(-6)} من ${customSnap.data().boxName}`,
                 createdAt: serverTimestamp()
               });
             }
          }

          await addDoc(collection(db, 'auditLogs'), {
            userId: profile.uid,
            userName: profile.name,
            action: 'CASH_REFUND_SETTLEMENT',
            targetAccount: dispatchRefundBox,
            exactAmount: refundAmount,
            details: `إرجاع فارق زلط نقد للطلب #${order.id.slice(-6)} بقيمة ${refundAmount} ر.ي مخصوماً من الحساب المالي`,
            timestamp: serverTimestamp()
          });
        }

        batch.update(doc(db, 'orders', order.id), {
          items: itemsCopy,
          total: newTotal,
          originalTotal,
          refundedAmount: refundAmount > 0 ? refundAmount : 0,
          refundBoxId: dispatchRefundBox,
          status: 'shipped',
          shippingMode,
          deliveryAgentId: selectedDeliveryAgentId || null,
          deliveryAgentName: selectedDeliveryAgentName || null,
          deliveryLocked: shippingMode === 'ship_delivery',
          expressPayloadCode,
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();

      let successMsg = 'تم تحديث الفاتورة وتقدير التسويات وشحن الطلب بنجاح مالي ومطابقة كاملة!';
      if (shippingMode === 'ship_delivery') {
        successMsg += `\n\n📌 رمز الاستلام السريع (Payload Code) الخاص بالسائق للتسليم هو: ${expressPayloadCode}`;
      }
      alert(successMsg);

      setIsDispatchModalOpen(false);
      setDispatchItemPrices({});
      setIsOrderModalOpen(false);
      setSelectedOrder(null);
      setShippingMode('ship_only');
      setSelectedDeliveryAgentId('');
      setSelectedDeliveryAgentName('');
    } catch (err) {
      console.error(err);
      alert('خطأ أثناء شحن وتسوية الطلبية');
    } finally {
      setLoading(false);
    }
  };

  const distributeStockToWarehousesHelper = (
    items: any[],
    distType: 'ALL_TO_ONE' | 'SPLIT_HALF_QUARTER' | 'CUSTOM',
    targetWhs: string[],
    customAlloc: Record<string, Record<string, number>>
  ) => {
    const allocList: { productId: string; warehouseId: string; qty: number }[] = [];
    items.forEach(item => {
      const qty = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
      if (distType === 'ALL_TO_ONE') {
        allocList.push({
          productId: item.productId,
          warehouseId: targetWhs[0] || 'المحل',
          qty: qty
        });
      } else if (distType === 'SPLIT_HALF_QUARTER') {
        const firstWh = targetWhs[0] || 'المستودع الرئيسي';
        const secondWh = targetWhs[1] || 'المستودع الاحتياطي';
        
        const halfQty = Math.floor(qty * 0.5);
        const quarterQty = Math.floor(qty * 0.25);
        const remainingQty = qty - halfQty - quarterQty;
        
        if (halfQty > 0) allocList.push({ productId: item.productId, warehouseId: firstWh, qty: halfQty });
        if (quarterQty > 0) allocList.push({ productId: item.productId, warehouseId: secondWh, qty: quarterQty });
        if (remainingQty > 0) allocList.push({ productId: item.productId, warehouseId: firstWh, qty: remainingQty });
      } else if (distType === 'CUSTOM') {
        const itemAllocations = customAlloc[item.productId] || {};
        Object.entries(itemAllocations).forEach(([whId, quantity]) => {
          if (Number(quantity) > 0) {
            allocList.push({
              productId: item.productId,
              warehouseId: whId,
              qty: Number(quantity)
            });
          }
        });
      }
    });
    return allocList;
  };

  const handleSettleAndDistributeStock = async (order: Order) => {
    if (!profile) return;
    
    let targetWhs: string[] = [];
    if (distributionType === 'ALL_TO_ONE') {
      if (!selectedWarehouse1) {
        alert('يرجى اختيار المخزن المستهدف!');
        return;
      }
      targetWhs = [selectedWarehouse1];
    } else if (distributionType === 'SPLIT_HALF_QUARTER') {
      if (!selectedWarehouse1 || !selectedWarehouse2) {
        alert('يرجى تحديد المخزنين للتوزيع التناسبي للطلب!');
        return;
      }
      if (selectedWarehouse1 === selectedWarehouse2) {
        alert('يرجى اختيار مخزنين مختلفين بوضوح!');
        return;
      }
      targetWhs = [selectedWarehouse1, selectedWarehouse2];
    } else if (distributionType === 'CUSTOM') {
      for (const item of order.items) {
        const itemAlloc = customAllocation[item.productId] || {};
        const allocSum = Object.values(itemAlloc).reduce((s, q) => s + (Number(q) || 0), 0);
        const expectedQty = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
        if (allocSum !== expectedQty) {
          alert(`مجموع توزيع الكميات للصنف "${item.name}" (${allocSum}) لا يطابق الكمية المستلمة تفصيلياً (${expectedQty})!`);
          return;
        }
      }
    }

    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      const allocations = distributeStockToWarehousesHelper(
        order.items,
        distributionType,
        targetWhs,
        customAllocation
      );

      for (const item of order.items) {
        const itemAllocations = allocations.filter(a => a.productId === item.productId);
        
        const q = query(
          collection(db, 'inventory'),
          where('ownerId', '==', profile.ownerId),
          where('name', '==', item.name)
        );
        const invSnap = await getDocs(q);
        const receivedTotalQty = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;

        if (!invSnap.empty) {
          const invDoc = invSnap.docs[0];
          const invData = invDoc.data();
          const currentWarehouses = invData.warehouses || {};
          
          itemAllocations.forEach(alloc => {
            const wh = alloc.warehouseId || 'المحل';
            currentWarehouses[wh] = (currentWarehouses[wh] || 0) + Number(alloc.qty);
          });

          const calculatedPrice = receivingItemPrices[item.productId] ?? ((item.actualPrice || item.price) * 1.25);

          batch.update(invDoc.ref, {
            stock: (invData.stock || 0) + receivedTotalQty,
            warehouses: currentWarehouses,
            lastPurchasePrice: item.actualPrice || item.price,
            cost: item.actualPrice || item.price,
            price: calculatedPrice,
            updatedAt: serverTimestamp()
          });
        } else {
          const newWhObj: Record<string, number> = {};
          itemAllocations.forEach(alloc => {
            const wh = alloc.warehouseId || 'المحل';
            newWhObj[wh] = (newWhObj[wh] || 0) + Number(alloc.qty);
          });

          const calculatedPrice = receivingItemPrices[item.productId] ?? ((item.actualPrice || item.price) * 1.25);

          const newInvItemRef = doc(collection(db, 'inventory'));
          batch.set(newInvItemRef, {
            ownerId: profile.ownerId,
            name: item.name,
            category: itemAllocations[0]?.warehouseId || 'عام',
            stock: receivedTotalQty,
            warehouses: newWhObj,
            cost: item.actualPrice || item.price,
            price: calculatedPrice,
            barcode: `B2B-${Date.now()}-${item.productId?.slice(0, 4) || 'item'}`,
            type: 'product',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      const purchRef = doc(collection(db, 'purchases'));
      batch.set(purchRef, {
        ownerId: profile.ownerId,
        items: order.items.map(i => ({
          name: i.name,
          quantity: i.shippedQuantity !== undefined ? i.shippedQuantity : i.quantity,
          price: i.actualPrice || i.price
        })),
        total: order.total,
        supplierId: order.wholesalerId,
        supplierName: order.wholesalerName,
        paymentMethod: order.paymentType === 'debt' ? 'debt' : 'cash',
        status: 'received',
        createdAt: serverTimestamp()
      });

      batch.update(doc(db, 'orders', order.id), {
        status: 'received',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'auditLogs'), {
        userId: profile.uid,
        userName: profile.name,
        action: 'RECEIVE_AND_DISTRIBUTE_STOCK',
        targetAccount: order.id,
        exactAmount: order.total,
        details: `استلام ميداني للطلب #${order.id.slice(-6)} وتوزيع البضائع في المستودعات المحددة (${distributionType})`,
        timestamp: serverTimestamp()
      });

      await batch.commit();
      alert('تم تأكيد الاستلام الميداني وتوزيع البضائع في مستودعاتك بنجاح وسرعة!');
      
      setIsDistributionModalOpen(false);
      setSelectedWarehouse1('');
      setSelectedWarehouse2('');
      setCustomAllocation({});
      setIsOrderModalOpen(false);
      setSelectedOrder(null);
    } catch (err) {
      console.error(err);
      alert('خطأ أثناء تأكيد التوزيع والاستلام');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveOrder = async (order: Order) => {
    if (!profile || order.status !== 'shipped') return;

    if (order.deliveryLocked && order.expressPayloadCode) {
      const codeInput = prompt('⚠️ هذا الطلب مشحون بنظام (التوصيل الفوري المقفل). يرجى إدخال رمز الاستلام والتوصيل السريع (Express Payload Code) المستلم من السائق لتأكيد الفك:');
      if (!codeInput || codeInput.trim() !== order.expressPayloadCode.trim()) {
        alert('❌ رمز التحقق غير مطابق! لا يمكنك استلام هذا الطلب دون الحصول على الرمز الصحيح من سائق التوصيل.');
        return;
      }
    }

    const cats = shopSettings?.productCategories || ['المحل', 'المستودع الرئيسي'];
    setSelectedWarehouse1(cats[0] || 'المحل');
    setSelectedWarehouse2(cats[1] || 'المستودع الرئيسي');
    
    const initialAlloc: Record<string, Record<string, number>> = {};
    order.items.forEach(item => {
      const qty = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
      initialAlloc[item.productId] = {
        [cats[0] || 'المحل']: qty
      };
    });
    setCustomAllocation(initialAlloc);
    setIsDistributionModalOpen(true);
  };

  const handleCreatePublicAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      setLoading(true);
      const auctionData = {
        ownerId: 'global',
        creatorId: profile.ownerId,
        creatorName: profile.shopName || profile.name,
        title: auctionForm.title,
        description: auctionForm.description,
        category: auctionForm.category,
        details: auctionForm.details,
        currentPrice: auctionForm.startPrice,
        startPrice: auctionForm.startPrice,
        minStep: auctionForm.minStep,
        status: 'active',
        endTime: Timestamp.fromMillis(Date.now() + auctionForm.durationHours * 3600000),
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'auctions'), auctionData);
      alert('تم إطلاق المزاد بنجاح!');
      setIsPublishModalOpen(false);
      setAuctionForm({ title: '', description: '', startPrice: 0, minStep: 1000, durationHours: 24, category: 'هواتف', details: '' });
    } catch (err) {
      console.error(err);
      alert('خطأ في إطلاق المزاد');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePayment = async (orderId: string, amount: number) => {
    if (!profile || amount <= 0) return;
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) return;
      
      const orderData = orderSnap.data();
      const currentPaid = orderData.paidAmount || 0;
      const newPaid = currentPaid + amount;
      const isFullyPaid = newPaid >= orderData.total;

      await updateDoc(orderRef, {
        paidAmount: newPaid,
        paymentStatus: isFullyPaid ? 'paid' : 'partial',
        updatedAt: serverTimestamp()
      });
      
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, paidAmount: newPaid, paymentStatus: isFullyPaid ? 'paid' : 'partial' } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [selectedWholesaleCategory, setSelectedWholesaleCategory] = React.useState('الكل');

  const filteredWholesaleProducts = wholesaleProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWholesaler = selectedWholesalerId ? p.wholesalerId === selectedWholesalerId : true;
    const matchesCategory = selectedWholesaleCategory === 'الكل' ? true : p.category === selectedWholesaleCategory;
    return p.isActive && matchesSearch && matchesWholesaler && matchesCategory;
  });

  const availableCategories = ['الكل', ...Array.from(new Set(
    wholesaleProducts
      .filter(p => selectedWholesalerId ? p.wholesalerId === selectedWholesalerId : true)
      .map(p => p.category || 'عام')
  ))];

  const combinedBoxes = [
    ...bankAccounts.map(b => ({
      ...b,
      bankName: b.boxName || b.bankName || 'حساب مالي عام',
    })),
    ...customBoxes.map(c => ({
      id: c.id,
      bankName: c.boxName,
      boxName: c.boxName,
      balance: c.balance,
      currency: c.currency || 'YER'
    }))
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-navy-950 flex flex-col font-black" dir="rtl">
      {/* Dynamic Header Sidebar-ish */}
      <div className="bg-white dark:bg-navy-950 border-b dark:border-navy-900 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex bg-white dark:bg-navy-950 border-b dark:border-navy-900 flex items-center gap-4 px-6 overflow-x-auto no-scrollbar scroll-smooth">
            {[
              { id: 'discover', label: 'سوق المحلات', icon: Store, color: 'text-indigo-600' },
              { id: 'public_market', label: 'الحراج والمزادات', icon: Gavel, color: 'text-brand-primary' },
              { id: 'products', label: 'المنتجات العالمية', icon: Package, color: 'text-indigo-600' },
              { id: 'wholesale_dashboard', label: 'لوحة مبيعات الجملة', icon: TrendingUp, color: 'text-indigo-600', role: 'wholesaler' },
              { id: 'operations', label: 'غرفة العمليات', icon: Zap, color: 'text-amber-600' },
              { id: 'links', label: 'الروابط', icon: LinkIcon, color: 'text-indigo-600' },
              { id: 'orders', label: 'الطلبيات', icon: ShoppingCart, color: 'text-indigo-600', badge: isWholesaler ? pendingRequestsCount : incomingShipmentsCount },
              ...(isWholesaler ? [{ id: 'debts', label: 'مديونية التجزئة', icon: CreditCard, color: 'text-rose-600' }] : [])
            ].filter(t => !t.role || (t.role === 'wholesaler' ? isWholesaler : true)).map(tab => (
              <button 
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); if (tab.id !== 'products') setSelectedWholesalerId(null); }}
                className={`flex items-center gap-3 px-6 py-5 border-b-4 transition-all whitespace-nowrap relative font-black text-sm ${
                  activeTab === tab.id ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full animate-bounce shadow-lg border-2 border-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'public_market' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                 <div>
                   <h2 className="text-3xl font-black text-navy-950 dark:text-white flex items-center gap-3">
                     <Gavel className="text-brand-primary" size={32} />
                     حراج الموردين والمزادات العالمية
                   </h2>
                   <p className="text-gray-500 text-xs mt-2">سوق مفتوح لجميع التجار والموردين للنشر والمزايدة الحية</p>
                 </div>
                 <button 
                   onClick={() => setIsPublishModalOpen(true)}
                   className="px-8 py-5 bg-brand-primary text-navy-950 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-3 border-none outline-none"
                 >
                   <Plus size={20} />
                   نشر فوري في الحراج
                 </button>
               </div>

               {/* Live Auctions Section */}
               <div className="bg-navy-900/50 p-8 rounded-[3rem] border border-white/5">
                 <LiveAuction lead={profile as any} ownerId="global" />
               </div>

               {/* Public Marketplace Items */}
               <div className="bg-white dark:bg-navy-900/50 p-8 rounded-[3rem] border border-gray-100 dark:border-white/5 space-y-6 shadow-sm">
                 <div className="flex items-center justify-between">
                   <h3 className="text-xl font-black text-navy-950 dark:text-white flex items-center gap-3">
                     <ShoppingBasket className="text-brand-primary" />
                     أحدث المنتجات المعروضة
                   </h3>
                   <div className="flex gap-2">
                     <div className="relative">
                       <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                       <input 
                         type="text" 
                         placeholder="ابحث في الحراج العام..." 
                         className="bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-white/10 rounded-xl pr-10 pl-4 py-2 text-xs text-navy-950 dark:text-white outline-none focus:ring-1 ring-brand-primary/50"
                         value={searchTerm}
                         onChange={e => setSearchTerm(e.target.value)}
                       />
                     </div>
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {wholesaleProducts.filter(p => p.isActive && (p.name.toLowerCase().includes(searchTerm.toLowerCase()))).map(product => (
                      <div key={product.id} className="bg-white dark:bg-navy-950/40 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 group transition-all hover:border-brand-primary/30 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${product.wholesalerId === profile?.ownerId ? 'bg-orange-500/20 text-orange-500' : 'bg-brand-primary/20 text-brand-primary'}`}>
                            {product.wholesalerId === profile?.ownerId ? 'منتجك' : 'مورد'}
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">#{product.id.slice(-6)}</span>
                        </div>
                        <h4 className="font-black text-navy-950 dark:text-white group-hover:text-brand-primary transition-colors text-lg">{product.name}</h4>
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{product.wholesalerName}</p>
                        <div className="mt-8 flex items-center justify-between">
                            <div>
                              <p className="text-2xl font-black text-success tabular-nums">{product.price.toLocaleString()} <span className="text-[10px]">ر.ي</span></p>
                            </div>
                            <button 
                              onClick={() => addToCart(product)}
                              className="p-3 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-navy-950 rounded-2xl transition-all outline-none border-none"
                            >
                              <Plus size={20} />
                            </button>
                        </div>
                      </div>
                    ))}
                 </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'products' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-navy-950 p-6 rounded-[2rem] border border-gray-100 dark:border-navy-900 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
                       <ShoppingBasket size={24} />
                     </div>
                     <div>
                       <h3 className="text-xl font-black text-navy-950 dark:text-white">سوق الجملة والحراج</h3>
                       <p className="text-xs text-gray-500">تصفح بضائع الموردين وأسعار الجملة المباشرة</p>
                     </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                     {selectedWholesalerId && (
                       <button 
                         onClick={() => { setSelectedWholesalerId(null); setSelectedWholesaleCategory('الكل'); }}
                         className="px-4 py-2 bg-navy-100 dark:bg-navy-900 text-navy-950 dark:text-white rounded-xl text-[10px] font-black flex items-center gap-2"
                       >
                         عرض كل الموردين <X size={14} />
                       </button>
                     )}
                     <div className="relative">
                       <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                       <input 
                         type="text" 
                         placeholder="ابحث عن منتج..." 
                         className="bg-gray-50 dark:bg-navy-900/50 border border-transparent focus:border-brand-primary/30 rounded-2xl pr-12 pl-4 py-4 text-sm outline-none transition-all w-full md:w-80 text-right"
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                       />
                     </div>
                     {profile?.role === 'manager' && (
                       <button onClick={() => setIsPublishModalOpen(true)} className="px-6 py-4 bg-brand-primary text-navy-950 rounded-2xl font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-primary/20 flex items-center gap-2">
                         <Plus size={18} /> نشر عرضك
                       </button>
                     )}
                  </div>
               </div>

               {/* Category Filtering Tabs */}
               {selectedWholesalerId && (
                 <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                   {availableCategories.map(cat => (
                     <button
                       key={cat}
                       onClick={() => setSelectedWholesaleCategory(cat)}
                       className={`px-6 py-3 rounded-2xl text-[10px] font-black whitespace-nowrap transition-all border-none outline-none ${
                         selectedWholesaleCategory === cat ? 'bg-brand-primary text-navy-950 shadow-lg' : 'bg-white dark:bg-navy-950 text-gray-500 hover:text-brand-primary'
                       }`}
                     >
                       {cat}
                     </button>
                   ))}
                 </div>
               )}

               <div className="space-y-6">
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                    {filteredWholesaleProducts.map(product => (
                      <div key={product.id} className="bg-white dark:bg-navy-950/40 p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 dark:border-white/5 group transition-all hover:border-brand-primary/30 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2 sm:mb-4">
                            <div className={`px-2 py-0.5 sm:py-1 rounded-md text-[7px] sm:text-[8px] font-black uppercase ${product.wholesalerId === profile?.ownerId ? 'bg-orange-500/20 text-orange-500' : 'bg-brand-primary/20 text-brand-primary'}`}>
                              {product.wholesalerId === profile?.ownerId ? 'منتجك' : 'مورد'}
                            </div>
                            <span className="text-[8px] sm:text-[10px] text-gray-500 font-mono">#{product.id.slice(-4)}</span>
                          </div>
                          <h4 className="font-black text-navy-950 dark:text-white group-hover:text-brand-primary transition-colors text-sm sm:text-base line-clamp-2 leading-tight">{product.name}</h4>
                          <p className="text-[8px] sm:text-[10px] text-gray-500 mt-1 line-clamp-1">{product.wholesalerName}</p>
                        </div>
                        
                        <div className="mt-4 sm:mt-6 flex items-center justify-between">
                            <div>
                              <p className="text-base sm:text-lg font-black text-success tabular-nums">{product.price.toLocaleString()} <span className="text-[8px]">ر.ي</span></p>
                            </div>
                            {product.wholesalerId !== profile?.ownerId ? (
                              <button 
                                onClick={() => addToCart(product)}
                                className="p-2 sm:p-3 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-navy-950 rounded-xl sm:rounded-2xl transition-all outline-none border-none"
                              >
                                <Plus size={16} />
                              </button>
                            ) : (
                              <span className="text-[8px] font-black text-orange-500">منتجك</span>
                            )}
                        </div>
                      </div>
                    ))}
                 </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'discover' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 w-full">
               {/* Partition Selector */}
               <div className="flex bg-gray-100 dark:bg-navy-900/50 p-1.5 rounded-2xl max-w-md mx-auto mb-8 border border-gray-200 dark:border-white/5">
                 <button
                   onClick={() => setDiscoverSubTab('suppliers')}
                   className={`flex-1 py-3 text-xs font-black rounded-xl transition-all border-none outline-none cursor-pointer ${
                     discoverSubTab === 'suppliers' 
                       ? 'bg-brand-primary text-navy-950 shadow-md font-extrabold' 
                       : 'bg-transparent text-gray-400 hover:text-gray-600 dark:hover:text-white'
                   }`}
                 >
                   🤝 جهات أشتري منها (My Suppliers)
                 </button>
                 <button
                   onClick={() => setDiscoverSubTab('clients')}
                   className={`flex-1 py-3 text-xs font-black rounded-xl transition-all border-none outline-none cursor-pointer ${
                     discoverSubTab === 'clients' 
                       ? 'bg-brand-primary text-navy-950 shadow-md font-extrabold' 
                       : 'bg-transparent text-gray-400 hover:text-gray-600 dark:hover:text-white'
                   }`}
                 >
                   👥 جهات تشتري مني (My Clients)
                 </button>
               </div>

               {discoverSubTab === 'suppliers' ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {availableWholesalers.map((wholesaler, idx) => (
                      <div key={`${wholesaler.uid}-${idx}`} className="bg-white dark:bg-navy-950 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-900 group hover:shadow-xl transition-all">
                         <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                              <Store size={32} />
                            </div>
                            <div>
                               <h3 className="font-black text-navy-950 dark:text-white text-lg">{wholesaler.shopName || wholesaler.name}</h3>
                               <p className="text-xs text-gray-500">{wholesaler.shopAddress || wholesaler.phone || 'منطقة الحراج'}</p>
                            </div>
                         </div>
                         <div className="space-y-3">
                            <button 
                              onClick={() => { setSelectedWholesalerId(wholesaler.uid || wholesaler.ownerId); setActiveTab('products'); }}
                              className="w-full py-4 bg-navy-50 dark:bg-navy-900 text-brand-primary rounded-2xl text-xs font-black hover:bg-brand-primary hover:text-navy-950 transition-all border-none outline-none"
                            >
                              تصفح المنتجات
                            </button>
                            <button className="w-full py-4 border border-gray-100 dark:border-white/5 rounded-2xl text-xs font-black text-gray-500 hover:bg-gray-50 transition-all outline-none">
                              دردشة فورية
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   {myClients.length === 0 ? (
                     <div className="col-span-full text-center py-12 bg-white dark:bg-navy-950 p-8 rounded-[3rem] border border-dashed border-gray-300 dark:border-white/10">
                       <Users size={48} className="mx-auto text-gray-400 mb-2" />
                       <p className="text-gray-400 text-sm font-bold">لا يوجد عملاء/زبائن مسجلين حالياً في هذا المتجر.</p>
                     </div>
                   ) : (
                     myClients.map(client => (
                       <div key={client.id} className="bg-white dark:bg-navy-950 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-900 group hover:shadow-xl transition-all">
                         <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-[#e0f2fe] dark:bg-blue-950/40 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform font-bold">
                              <User size={32} />
                            </div>
                            <div>
                               <h3 className="font-black text-navy-950 dark:text-white text-lg">{client.name}</h3>
                               <p className="text-xs text-gray-500">{client.phone}</p>
                            </div>
                         </div>
                         <div className="space-y-2 text-right text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-3">
                           <p>الديون القائمة: <span className="font-black text-rose-500">{(client.debt || 0).toLocaleString()} ر.ي</span></p>
                           <p>تاريخ الانضمام: <span className="text-gray-400">{client.createdAt ? 'نشط' : 'جديد'}</span></p>
                         </div>
                         <div className="space-y-3 mt-4">
                            <a 
                              href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-4 bg-success/10 text-success rounded-2xl text-xs font-black hover:bg-success hover:text-white transition-all text-center block outline-none border-none cursor-pointer"
                            >
                              إرسال إشعار WhatsApp 💬
                            </a>
                         </div>
                       </div>
                     ))
                   )}
                 </div>
               )}
            </motion.div>
          )}

          {activeTab === 'wholesale_dashboard' && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="bg-white dark:bg-navy-950 p-8 rounded-[3rem] shadow-sm border border-gray-100 dark:border-navy-900">
                      <TrendingUp className="text-success mb-4" size={32} />
                      <p className="text-[10px] text-gray-400 font-black uppercase">إجمالي المبيعات الشبكية</p>
                      <p className="text-2xl font-black text-navy-950 dark:text-white mt-1">
                        {orders.filter(o => o.status === 'received').reduce((s, o) => s + (o.total ?? 0), 0).toLocaleString()} <span className="text-xs">ر.ي</span>
                      </p>
                   </div>
                   <div className="bg-white dark:bg-navy-950 p-8 rounded-[3rem] shadow-sm border border-gray-100 dark:border-navy-900">
                      <Banknote className="text-rose-500 mb-4" size={32} />
                      <p className="text-[10px] text-gray-400 font-black uppercase">الديون المستحقة</p>
                      <p className="text-2xl font-black text-rose-600 mt-1">
                        {orders.filter(o => o.paymentType === 'debt' && o.paymentStatus !== 'paid').reduce((s, o) => s + ((o.total ?? 0) - (o.paidAmount ?? 0)), 0).toLocaleString()} <span className="text-xs">ر.ي</span>
                      </p>
                   </div>
                </div>

                {/* B2B / CONSUMER MARKETPLACE ROUTING AND SYNCING DECK */}
                <div className="bg-gradient-to-br from-brand-primary/10 to-blue-500/10 dark:from-navy-950 dark:to-navy-900 p-8 rounded-[3rem] border border-brand-primary/20 space-y-6 mt-8">
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                         <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-brand-primary text-navy-950 text-[10px] font-black rounded-full uppercase">
                               {profile?.role === 'wholesaler' ? 'حساب مورد جملة B2B' : 'حساب تجزئة زبون'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold">توزيع ذكي وتوجيه فوري</span>
                         </div>
                         <h3 className="text-xl font-black text-navy-950 dark:text-white">أدوات توزيع الماركت بليس والمزامنة المباشرة (JAM Matrix Hub)</h3>
                         <p className="text-xs text-gray-400 mt-1">
                            بث ومزامنة أصناف متجرك ومخزونك للشركاء. يتم توجيه حسابات الجملة تلقائياً إلى <strong className="text-emerald-500">سوق الموردين (B2B)</strong> وحسابات التجزئة إلى <strong className="text-amber-500">سوق المستهلكين والمزادات</strong>.
                         </p>
                      </div>
                      
                      <div className="flex gap-3">
                         <button 
                            onClick={handleShareNewOnly}
                            disabled={!!sharingLoading}
                            className="px-6 py-3.5 bg-brand-primary hover:bg-brand-primary/90 text-navy-950 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                         >
                            {sharingLoading === 'new_only' ? <Loader2 className="animate-spin" size={14} /> : <Share2 size={14} />}
                            مشاركة المضاف حديثاً فقط "Share New Only"
                         </button>
                         
                         <button 
                            onClick={handleShareAll}
                            disabled={!!sharingLoading}
                            className="px-6 py-3.5 bg-navy-900 border border-white/10 hover:bg-navy-800 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                         >
                            {sharingLoading === 'all' ? <Loader2 className="animate-spin" size={14} /> : <Layers size={14} />}
                            مزامنة ونشر الكل "Share All"
                         </button>
                      </div>
                   </div>
                </div>
             </motion.div>
          )}

          {activeTab === 'orders' && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {orders.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()).map(order => (
                  <div key={order.id} onClick={() => { setSelectedOrder(order); setIsOrderModalOpen(true); }} className="bg-white dark:bg-navy-950 p-6 rounded-3xl border border-gray-100 dark:border-navy-900 flex items-center justify-between cursor-pointer hover:border-brand-primary/30 transition-all">
                     <div className="flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          order.status === 'received' ? 'bg-success/10 text-success' :
                          order.status === 'shipped' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-amber-500/10 text-amber-500'
                        }`}>
                           <ShoppingCart />
                        </div>
                        <div>
                           <h4 className="font-black text-navy-950 dark:text-white">طلبية #{order.id.slice(-6)}</h4>
                           <p className="text-xs text-gray-500">{order.retailerName} → {order.wholesalerName}</p>
                        </div>
                     </div>
                     <div className="text-left">
                        <p className="font-black text-navy-950 dark:text-white">{(order.total ?? 0).toLocaleString()} ر.ي</p>
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                          order.status === 'received' ? 'bg-success/20 text-success' :
                          order.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                          'bg-indigo-500/20 text-indigo-500'
                        }`}>
                          {order.status}
                        </span>
                     </div>
                  </div>
                ))}
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cart Sheet */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-white dark:bg-navy-900 border-2 border-brand-primary rounded-[2rem] p-4 shadow-2xl flex items-center gap-6 min-w-[350px]"
          >
             <div className="flex items-center gap-4 border-l border-gray-200 dark:border-navy-800 pl-6">
                <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-navy-950 shadow-lg">
                  <ShoppingBasket size={24} />
                </div>
                <div className="text-right px-4">
                   <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">إجمالي السلة</p>
                   <p className="text-xl font-black text-brand-primary tabular-nums">
                     {cart.reduce((s, i) => s + ((i.price ?? 0) * (i.quantity ?? 0)), 0).toLocaleString()} <span className="text-xs">ر.ي</span>
                   </p>
                </div>
             </div>
             <button onClick={() => setIsCheckoutModalOpen(true)} className="px-8 py-3 bg-brand-primary text-navy-950 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all outline-none border-none cursor-pointer">
               إرسال الطلبية ({cart.length})
             </button>
             <button onClick={() => setCart([])} className="p-3 text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
               <Trash2 size={24} />
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Axis 5: B2B Checkout & Canonical Deposit Wallets Modal */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 text-right" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCheckoutModalOpen(false)} className="absolute inset-0 bg-navy-950/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 20, opacity: 0 }} className="relative w-full max-w-xl bg-navy-900 rounded-[2.5rem] border border-white/10 p-8 shadow-2xl overflow-y-auto max-h-[90vh] z-10">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <ShoppingBag className="text-brand-primary" size={22} />
                    <span>تأكيد إرسال الطلبية وسداد الإيداع</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">تحديد طريقة التسوية وإرفاق مرجع التحويل المالي المعتمد</p>
                </div>
                <button onClick={() => setIsCheckoutModalOpen(false)} className="w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all border-none outline-none cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Order total */}
              <div className="p-4 bg-navy-950/60 rounded-2xl border border-white/5 mb-6 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400">إجمالي قيمة الفاتورة:</span>
                <span className="text-2xl font-black text-brand-primary font-mono">
                  {cart.reduce((s, i) => s + ((i.price ?? 0) * (i.quantity ?? 0)), 0).toLocaleString()} YER
                </span>
              </div>

              {/* Payment Type Switcher */}
              <div className="space-y-2 mb-6">
                <label className="text-xs font-black text-gray-300 block">طريقة التسوية المالية:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutPaymentType('cash')}
                    className={`py-3 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${checkoutPaymentType === 'cash' ? 'bg-brand-primary border-brand-primary text-navy-950' : 'bg-navy-950 border-white/10 text-gray-400'}`}
                  >
                    💵 تحويل / إيداع فوري
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutPaymentType('money_transfer')}
                    className={`py-3 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${checkoutPaymentType === 'money_transfer' ? 'bg-brand-primary border-brand-primary text-navy-950' : 'bg-navy-950 border-white/10 text-gray-400'}`}
                  >
                    🏦 محفظة إلكترونية
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutPaymentType('debt')}
                    className={`py-3 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${checkoutPaymentType === 'debt' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-navy-950 border-white/10 text-gray-400'}`}
                  >
                    📄 آجل / دفتر الذمم
                  </button>
                </div>
              </div>

              {/* 5 Canonical Approved Wallets Selection (When Payment is Cash/Money Transfer) */}
              {checkoutPaymentType !== 'debt' && (
                <div className="space-y-4 p-4 bg-navy-950/80 rounded-2xl border border-brand-primary/20 mb-6">
                  <span className="text-xs font-black text-brand-primary block">💳 المحافظ الرقمية المعتمدة الخمس (Axis 5):</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { id: 'AL_KURIMI', name: 'بنك الكريمي', sub: 'حاسب / مميز' },
                      { id: 'JEEB', name: 'محفظة جيب', sub: 'بنك اليمن والكويت' },
                      { id: 'ONE_CASH', name: 'ون كاش', sub: 'OneCash' },
                      { id: 'JAWALI', name: 'جوالي', sub: 'الشارقة / كاك بنك' },
                      { id: 'FLOOSAK', name: 'فلوسك', sub: 'مصرف اليمن البحرين' },
                    ].map(w => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedDepositWallet(w.id)}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                          selectedDepositWallet === w.id
                            ? 'bg-brand-primary/10 border-brand-primary text-white shadow-lg shadow-brand-primary/10'
                            : 'bg-navy-900 border-white/5 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        <span className="text-xs font-black block text-white">{w.name}</span>
                        <span className="text-[9px] text-gray-400 block">{w.sub}</span>
                      </button>
                    ))}
                  </div>

                  {/* Mandatory Deposit Reference Input */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[11px] font-black text-rose-400 block">
                      رقم سند التحويل / مرجع الإيداع الإلزامي <span className="text-red-500">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      value={depositRefNum}
                      onChange={(e) => setDepositRefNum(e.target.value)}
                      placeholder="أدخل رقم الحوالة أو مرجع الإيداع الفعلي..."
                      className="w-full bg-navy-900 border border-brand-primary/40 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-brand-primary font-mono font-bold"
                    />
                    {!depositRefNum.trim() && (
                      <p className="text-[10px] text-amber-400 font-bold">⚠️ يتعذر إرسال الطلبية بدون إدخال رقم سند أو مرجع الإيداع الصحيح.</p>
                    )}
                  </div>

                  {/* Sender Name */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-gray-300 block">اسم المحول / المودع:</label>
                    <input
                      type="text"
                      value={depositSenderName}
                      onChange={(e) => setDepositSenderName(e.target.value)}
                      placeholder="اسم صاحب الحساب أو المحول..."
                      className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5 mb-6">
                <label className="text-xs font-black text-gray-300 block">ملاحظات الطلبية:</label>
                <textarea
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="أية تعليمات خاصة للتجهيز أو الشحن..."
                  className="w-full bg-navy-950 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-brand-primary h-20 resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={loading || (checkoutPaymentType !== 'debt' && !depositRefNum.trim())}
                  onClick={() => handlePlaceOrder()}
                  className="flex-1 py-4 bg-brand-primary text-navy-950 font-black rounded-2xl text-xs hover:scale-[1.02] active:scale-95 transition-all border-none outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto text-navy-950" /> : '✓ تأكيد وإرسال الطلبية للمورد'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="px-6 py-4 bg-navy-950 border border-white/10 text-gray-400 rounded-2xl text-xs hover:bg-navy-800 transition-all outline-none cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Public Publishing Modal */}
      <AnimatePresence>
        {isPublishModalOpen && (
          <div className="fixed inset-0 z-[105] flex items-center justify-center p-4" dir="rtl">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPublishModalOpen(false)} className="absolute inset-0 bg-navy-950/90 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} className="relative w-full max-w-xl bg-navy-900 rounded-[3rem] border border-white/10 p-10 shadow-2xl overflow-hidden text-right">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 blur-[50px]" />
                <div className="flex justify-between items-center mb-8 relative z-10">
                   <div>
                     <h3 className="text-2xl font-black text-white">نشر فوري في الحراج</h3>
                     <p className="text-gray-500 text-xs mt-1">اختر نوع المنشور للوصول لآلاف التجار والزبائن</p>
                   </div>
                   <button onClick={() => setIsPublishModalOpen(false)} className="w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all border-none outline-none">
                     <X />
                   </button>
                </div>

                <div className="flex bg-navy-950/50 p-2 rounded-2xl border border-white/5 mb-8 relative z-10">
                    <button onClick={() => setPublishingType('product')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 outline-none border-none ${publishingType === 'product' ? 'bg-brand-primary text-navy-950 shadow-lg' : 'text-white/40 hover:text-white'}`}>
                      <ShoppingBasket size={14} /> عرض منتج ثابت
                    </button>
                    <button onClick={() => setPublishingType('auction')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 outline-none border-none ${publishingType === 'auction' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>
                      <Gavel size={14} /> إطلاق مزاد حي
                    </button>
                </div>

                {publishingType === 'product' ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!profile) return;
                    try {
                      setLoading(true);
                      const form = e.target as HTMLFormElement;
                      const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                      const price = Number((form.elements.namedItem('price') as HTMLInputElement).value);
                      const stock = Number((form.elements.namedItem('stock') as HTMLInputElement).value);
                      
                      await addDoc(collection(db, 'wholesaleProducts'), {
                        wholesalerId: profile.ownerId,
                        wholesalerName: profile.shopName || profile.name,
                        name,
                        price,
                        stock,
                        category: 'حراج عام',
                        isActive: true,
                        createdAt: serverTimestamp()
                      });
                      alert('تم نشر المنتج بنجاح!');
                      setIsPublishModalOpen(false);
                    } catch (err) { alert('خطأ في النشر'); }
                    finally { setLoading(false); }
                  }} className="space-y-4 relative z-10">
                    <div className="space-y-1 text-right">
                      <label className="text-[10px] font-black text-white/40 block uppercase tracking-widest text-right">اسم المنتج</label>
                      <input name="name" required className="bg-navy-950 border border-white/10 rounded-xl px-4 py-4 text-sm text-white w-full text-right outline-none focus:border-brand-primary transition-colors" placeholder="مثلاً: آيفون 15 برو ماكس" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 text-right">
                        <label className="text-[10px] font-black text-white/40 block uppercase tracking-widest text-right">السعر (ر.ي)</label>
                        <input name="price" type="number" required className="bg-navy-950 border border-white/10 rounded-xl px-4 py-4 text-sm text-white w-full text-right outline-none focus:border-brand-primary" placeholder="0" />
                      </div>
                      <div className="space-y-1 text-right">
                        <label className="text-[10px] font-black text-white/40 block uppercase tracking-widest text-right">الكمية</label>
                        <input name="stock" type="number" required className="bg-navy-950 border border-white/10 rounded-xl px-4 py-4 text-sm text-white w-full text-right outline-none focus:border-brand-primary" defaultValue="1" />
                      </div>
                    </div>
                    <button disabled={loading} className="w-full py-4 bg-brand-primary text-navy-950 rounded-2xl font-black shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all mt-4 border-none outline-none">
                      {loading ? <Loader2 className="animate-spin mx-auto" /> : 'تأكيد النشر'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleCreatePublicAuction} className="space-y-4 relative z-10">
                    <div className="space-y-1 text-right">
                      <label className="text-[10px] font-black text-white/40 block uppercase tracking-widest text-right">عنوان المزاد</label>
                      <input required className="bg-navy-950 border border-white/10 rounded-xl px-4 py-4 text-sm text-white w-full text-right outline-none focus:border-orange-500" value={auctionForm.title} onChange={e => setAuctionForm({...auctionForm, title: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1 text-right">
                         <label className="text-[10px] font-black text-white/40 block uppercase tracking-widest text-right">الصنف</label>
                         <select required className="bg-navy-950 border border-white/10 rounded-xl px-4 py-4 text-sm text-white w-full text-right outline-none focus:border-orange-500" value={auctionForm.category} onChange={e => setAuctionForm({...auctionForm, category: e.target.value})}>
                            <option value="هواتف">هواتف</option>
                            <option value="إكسسوارات">إكسسوارات</option>
                            <option value="قطع غيار">قطع غيار</option>
                            <option value="برمجيات">برمجيات</option>
                            <option value="أخرى">أخرى</option>
                         </select>
                       </div>
                       <div className="space-y-1 text-right">
                         <label className="text-[10px] font-black text-white/40 block uppercase tracking-widest text-right">أقل مزايدة</label>
                         <input type="number" required className="bg-navy-950 border border-white/10 rounded-xl px-4 py-4 text-sm text-white w-full text-right outline-none focus:border-orange-500" value={auctionForm.minStep} onChange={e => setAuctionForm({...auctionForm, minStep: Number(e.target.value)})} />
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1 text-right">
                          <label className="text-[10px] font-black text-white/40 block uppercase tracking-widest text-right">سعر البداية</label>
                          <input type="number" required className="bg-navy-950 border border-white/10 rounded-xl px-4 py-4 text-sm text-white w-full text-right outline-none focus:border-orange-500" value={auctionForm.startPrice} onChange={e => setAuctionForm({...auctionForm, startPrice: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-1 text-right">
                          <label className="text-[10px] font-black text-white/40 block uppercase tracking-widest text-right">تفاصيل إضافية</label>
                          <input className="bg-navy-950 border border-white/10 rounded-xl px-4 py-4 text-sm text-white w-full text-right outline-none focus:border-orange-500" placeholder="موديل، حالة، إلخ..." value={auctionForm.details} onChange={e => setAuctionForm({...auctionForm, details: e.target.value})} />
                        </div>
                     </div>
                     <button disabled={loading} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all mt-4 border-none outline-none">
                       {loading ? <Loader2 className="animate-spin mx-auto text-white" /> : 'إطلاق المزاد'}
                     </button>
                  </form>
                )}
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Details Modal (The one to fix) */}
      <AnimatePresence>
        {isOrderModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOrderModalOpen(false)} className="fixed inset-0 bg-navy-950/90 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} className="relative w-full max-w-4xl bg-white dark:bg-navy-900 rounded-[3rem] border border-gray-100 dark:border-white/10 p-10 shadow-3xl text-right my-8">
                <div className="flex justify-between items-center mb-8">
                   <div>
                     <h3 className="text-2xl font-black text-navy-950 dark:text-white">تفاصيل الطلبية #{selectedOrder.id.slice(-6)}</h3>
                     <p className="text-gray-500 text-xs mt-1">تاريخ الإنشاء: {selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleString() : '...'}</p>
                   </div>
                   <button onClick={() => setIsOrderModalOpen(false)} className="w-12 h-12 bg-gray-100 dark:bg-white/10 text-navy-950 dark:text-white rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/20 transition-all border-none outline-none">
                     <X />
                   </button>
                </div>

                 {/* 5-tier dynamic workflow stepper with role overrides */}
                 <div className="mb-8 p-6 bg-navy-50/50 dark:bg-navy-950/40 rounded-3xl border border-navy-100/50 dark:border-white/5 text-right">
                    <p className="text-xs font-black text-gray-400 mb-4 text-right">📌 دورة حياة ومراحل معالجة الطلب الموحد (بروتوكول المطابقة الهندسية)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-right">
                       {[
                         { key: 'pending', name: '1. مستند الصندوق 💰', desc: 'أمين صندوق / كاشير', color: 'bg-emerald-500' },
                         { key: 'approved', name: '2. موافقة المدير 👑', desc: 'سلطة القيادة والتحقق', color: 'bg-orange-500' },
                         { key: 'prepping', name: '3. تجهيز المخزن 📦', desc: 'الوزن والتغليف المادي', color: 'bg-indigo-600' },
                         { key: 'ready', name: '4. المطابقة الفنية 🔍', desc: 'تنزيل أرصدة وجرد البضاعة', color: 'bg-cyan-500' },
                         { key: 'shipped', name: '5. شحن للخارج 🚚', desc: 'المغادرة والتسليم للمشتري', color: 'bg-blue-600' }
                       ].map((step, idx) => {
                         const isCurrent = selectedOrder.status === step.key;
                         const isPassed = ['pending', 'approved', 'prepping', 'ready', 'shipped'].indexOf(selectedOrder.status) >= idx;
                         return (
                            <div key={step.key} className={`p-3 rounded-2xl border text-right transition-all ${
                              isCurrent 
                                ? 'bg-navy-950 border-brand-primary text-white shadow-lg' 
                                : (isPassed ? 'bg-navy-800/10 border-navy-500/20 text-navy-600' : 'bg-transparent border-gray-150 dark:border-white/5 text-gray-400')
                            }`}>
                               <p className="text-xs font-black text-right">{step.name}</p>
                               <p className="text-[9px] text-gray-400 mt-1 font-bold text-right">{step.desc}</p>
                               {isCurrent && (
                                 <span className={`inline-block mt-2 px-2 py-0.5 text-center text-[8px] font-black text-white ${step.color} rounded-full animate-pulse`}>
                                    الخطوة الحالية
                                 </span>
                               )}
                            </div>
                         );
                       })}
                    </div>

                    {/* Dynamic instant workflow release actions for Manager / Wholesaler Owner Bypass */}
                    {isWholesaler && (
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-white/5 justify-end">
                        <span className="text-[10px] text-gray-400 font-bold self-center">⚡ تجاوز الصلاحيات (أدمن/مدير):</span>
                        {['pending', 'approved', 'prepping', 'ready', 'shipped'].map((stKey) => (
                          <button
                            key={stKey}
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`هل تريد بالتأكيد نقل حالة الطلب #${selectedOrder.id.slice(-6)} إلى [${stKey}] وتجاوز أي قفل حماية؟`)) {
                                await updateDoc(doc(db, 'orders', selectedOrder.id), { status: stKey, updatedAt: serverTimestamp() });
                                setSelectedOrder(prev => prev ? { ...prev, status: stKey as any } : null);
                              }
                            }}
                            className="px-3 py-1 bg-navy-850 hover:bg-navy-700 text-white rounded-lg text-[10px] border border-white/10 font-black cursor-pointer"
                          >
                            توجيه لـ {stKey}
                          </button>
                        ))}
                      </div>
                    )}
                 </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                   <div className="p-6 bg-gray-50 dark:bg-navy-950 rounded-3xl border border-gray-100 dark:border-white/5">
                      <p className="text-[10px] text-gray-500 font-black uppercase mb-2">إجمالي الفاتورة</p>
                      <p className="text-3xl font-black text-brand-primary tabular-nums">{selectedOrder.total.toLocaleString()} <span className="text-sm">ر.ي</span></p>
                   </div>
                   <div className="p-6 bg-gray-50 dark:bg-navy-950 rounded-3xl border border-gray-100 dark:border-white/5">
                      <p className="text-[10px] text-gray-500 font-black uppercase mb-2">مبلغ تم سداده</p>
                      <p className="text-3xl font-black text-success tabular-nums">{(selectedOrder.paidAmount || 0).toLocaleString()} <span className="text-sm">ر.ي</span></p>
                   </div>
                   <div className="p-6 bg-gray-50 dark:bg-navy-950 rounded-3xl border border-gray-100 dark:border-white/5">
                      <p className="text-[10px] text-gray-500 font-black uppercase mb-2">نوع وطريقة الدفع</p>
                      <p className="text-xl font-black text-navy-900 dark:text-white">{selectedOrder.paymentType === 'debt' ? 'دين (آجل)' : 'نقدي (إيداع)'}</p>
                   </div>
                </div>

                {/* Order Items List */}
                <div className="bg-gray-50 dark:bg-navy-950 rounded-3xl border border-gray-100 dark:border-white/5 p-6 mb-8 text-right font-sans">
                   <p className="text-sm font-black text-navy-900 dark:text-white mb-4">أصناف الطلبية ومطابقة كميات المستودع:</p>
                   <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right border-collapse">
                         <thead>
                            <tr className="border-b border-gray-100 dark:border-white/5 text-[10px] uppercase font-black tracking-widest text-gray-400">
                               <th className="pb-3 pr-2">اسم الصنف</th>
                               <th className="pb-3 text-center">السعر المتفق</th>
                               <th className="pb-3 text-center">الكمية المطلوبة</th>
                               <th className="pb-3 text-center">الكمية المجهزة فعلياً</th>
                            </tr>
                         </thead>
                         <tbody>
                            {selectedOrder.items.map((item: any, idx: number) => {
                               return (
                                  <tr key={idx} className="border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                                     <td className="py-4 font-black text-navy-950 dark:text-white pr-2">{item.name}</td>
                                     <td className="py-4 text-center text-gray-400 tabular-nums">{(item.price || 0).toLocaleString()} ر.ي</td>
                                     <td className="py-4 text-center font-bold text-gray-400 text-sm tabular-nums">{item.quantity}</td>
                                     <td className="py-4 text-center tabular-nums">
                                        {item.actualPrepQuantity !== undefined ? (
                                           <span className="px-2 py-1 bg-success/20 text-success rounded-lg font-black">{item.actualPrepQuantity}</span>
                                        ) : (
                                           <span className="text-gray-500 font-bold">—</span>
                                        )}
                                     </td>
                                  </tr>
                               );
                            })}
                         </tbody>
                      </table>
                   </div>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Wholesaler accepts order */}
                  {isWholesaler && selectedOrder.status === 'pending' && (
                    <button 
                      onClick={() => updateDoc(doc(db, 'orders', selectedOrder.id), { status: 'approved', updatedAt: serverTimestamp() })}
                      className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black hover:scale-[1.02] transition-all border-none outline-none"
                    >
                      موافقة وقبول الطلبية المبدئي ✅
                    </button>
                  )}

                  {/* Wholesaler sends to warehouse prep */}
                  {isWholesaler && selectedOrder.status === 'approved' && (
                    <button 
                      onClick={() => handleSendToWarehouse(selectedOrder)}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:scale-[1.02] transition-all border-none outline-none"
                    >
                      إرسال للمستودع للمطابقة والتعبئة والتغليف 📦
                    </button>
                  )}

                  {/* Warehousing status indicator */}
                  {selectedOrder.status === 'prepping' && (
                    <div className="p-4 bg-amber-500/10 text-amber-500 rounded-2xl text-center font-bold text-sm border border-amber-500/20">
                      يجري حالياً مطابقة وتنزيل الكميات من قبل أمين المستودع... 🔍
                    </div>
                  )}

                  {/* Payment status and proof submit for Retailer */}
                  {!isWholesaler && !selectedOrder.paymentVerified && selectedOrder.paymentType === 'cash' && (
                    <div className="p-4 bg-navy-950/40 rounded-3xl border border-white/5 space-y-3 text-right">
                      <p className="text-xs text-white/60 font-black">إثبات سداد مالي / إرسال إيداع:</p>
                      {selectedOrder.paymentDetails ? (
                        <div className="text-xs space-y-1 bg-white/5 p-3 rounded-xl border border-white/5">
                          <p>رقم الإيداع: {selectedOrder.paymentDetails.remittanceNumber}</p>
                          <p>المرسل: {selectedOrder.paymentDetails.senderName}</p>
                          <p>المبلغ: {Number(selectedOrder.paymentDetails.amountPaid).toLocaleString()} ر.ي</p>
                          <p>البنك / الصندوق: {selectedOrder.paymentDetails.brokerName}</p>
                          <p className="text-amber-500 font-bold">بانتظار مطابقة وتأكيد المورد للصندوق المالي.</p>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setRemittanceForm({
                              remittanceNumber: '',
                              senderName: '',
                              amountPaid: selectedOrder.total,
                              brokerName: '',
                              invoiceDate: new Date().toISOString().split('T')[0]
                            });
                            setIsRemittanceModalOpen(true);
                          }}
                          className="w-full py-3 bg-brand-primary text-navy-950 rounded-xl font-black text-xs hover:scale-[1.02] transition-all border-none outline-none"
                        >
                          إرسال بيانات الإيداع المالي / السداد 💸
                        </button>
                      )}
                    </div>
                  )}

                  {/* Wholesaler financial matching panel */}
                  {isWholesaler && !selectedOrder.paymentVerified && selectedOrder.paymentType === 'cash' && (
                    <div className="p-6 bg-rose-500/10 rounded-3xl border border-rose-500/20 text-right space-y-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={20} />
                        <div>
                          <p className="font-black text-rose-500 text-sm">تأكيد سداد مالي / تحرير إيداع مغلق</p>
                          <p className="text-xs text-gray-400 mt-1">يجب تأكيد استلام الإيداع وإدراجه بالصندوق المالي أولاً لفك قفل شحن الطلب.</p>
                        </div>
                      </div>

                      {selectedOrder.paymentDetails ? (
                        <div className="bg-navy-950/40 p-4 rounded-2xl text-xs space-y-2 border border-white/5">
                          <p className="font-black border-b border-white/5 pb-1">بيانات الإيداع المرسلة من المشتري:</p>
                          <p>رقم الإيداع: <span className="font-mono text-white text-sm">{selectedOrder.paymentDetails.remittanceNumber}</span></p>
                          <p>اسم المرسل الكافي: <span className="text-white font-bold">{selectedOrder.paymentDetails.senderName}</span></p>
                          <p>المبلغ الفعلي: <span className="font-mono text-brand-primary text-sm font-black">{Number(selectedOrder.paymentDetails.amountPaid).toLocaleString()} ر.ي</span></p>
                          <p>البنك / الصراف: <span className="text-white">{selectedOrder.paymentDetails.brokerName}</span></p>
                          <p>التاريخ: <span className="text-white">{selectedOrder.paymentDetails.invoiceDate}</span></p>

                          <div className="space-y-2 mt-4 border-t border-white/5 pt-3">
                            <button 
                              disabled={loading}
                              onClick={() => setSelectedRemittanceForVerification(selectedOrder)}
                              className="w-full py-4 bg-success text-white rounded-2xl font-black text-xs hover:scale-[1.02] transition-all border-none flex items-center justify-center gap-2 mt-2 cursor-pointer"
                            >
                              <span>🚨 تأكيد الاستلام وتوجيه المسار المالي للإيداع</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-rose-500 bg-rose-500/5 p-3 rounded-xl border border-rose-500/10">بانتظار قيام العميل بتعبئة وإرسال إثبات السداد المالي (رقم الإيداع وتأكيد المبلغ)...</p>
                      )}
                    </div>
                  )}

                  {/* Wholesaler Shipped logic */}
                  {isWholesaler && (selectedOrder.status === 'pending' || selectedOrder.status === 'approved' || selectedOrder.status === 'matched' || selectedOrder.status === 'prepping') && (
                    <div className="space-y-2 mt-4">
                      {selectedOrder.status === 'pending' && (
                        <div className="p-3 bg-red-600/10 text-red-500 rounded-xl text-xs font-bold text-center border border-red-500/20 flex items-center justify-center gap-2">
                          <Lock size={14} /> حالة الطلب: قيد المراجعة والمطابقة المبدئية (Pending Approval). الشحن والتسليم مغلق بالكامل!
                        </div>
                      )}
                      {(!selectedOrder.paymentVerified && selectedOrder.paymentType === 'cash') && (
                        <div className="p-3 bg-red-600/10 text-red-500 rounded-xl text-xs font-bold text-center border border-red-500/20 flex items-center justify-center gap-2">
                          <Lock size={14} /> زر شحن البضاعة مغلق تماماً بموجب الضوابط المالية لحين إدخال الإيداع بالصندوق!
                        </div>
                      )}
                      <button 
                        disabled={(selectedOrder.status === 'pending') || (!selectedOrder.paymentVerified && selectedOrder.paymentType === 'cash') || loading}
                        onClick={() => {
                          const initialPrices: Record<string, number> = {};
                          selectedOrder.items.forEach(item => {
                            initialPrices[item.productId] = item.price;
                          });
                          setDispatchItemPrices(initialPrices);
                          setDispatchRefundBox(bankAccounts[0]?.id || 'CASH_BOX');
                          setIsDispatchModalOpen(true);
                        }}
                        className={`w-full py-4 text-white rounded-2xl font-black transition-all border-none outline-none flex items-center justify-center gap-2 ${
                          (selectedOrder.status === 'pending' || (!selectedOrder.paymentVerified && selectedOrder.paymentType === 'cash')) 
                            ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed opacity-50' 
                            : 'bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] cursor-pointer'
                        }`}
                      >
                        <Unlock size={18} /> تأكيد شحن وتسوية تسليم الطلبية / خروج البضاعة 🚚
                      </button>
                    </div>
                  )}

                  {/* Retailer receipt */}
                  {!isWholesaler && selectedOrder.status === 'shipped' && (
                    <button 
                      onClick={() => handleReceiveOrder(selectedOrder)}
                      className="w-full py-4 bg-success text-white rounded-2xl font-black hover:scale-[1.02] transition-all border-none outline-none flex items-center justify-center gap-2 mt-4"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={18} /> تأكيد الاستلام الميداني وتوزيع المخازن 🏢</>}
                    </button>
                  )}

                  {/* Debt payment for Wholesaler */}
                  {isWholesaler && (selectedOrder.total - (selectedOrder.paidAmount || 0) > 0) && (
                    <button 
                      onClick={() => {
                        const amount = prompt('أدخل مبلغ السداد المستلم من العميل:');
                        if (amount) handleUpdatePayment(selectedOrder.id, Number(amount));
                      }}
                      className="w-full py-3 bg-brand-primary text-navy-950 rounded-2xl font-black text-xs hover:scale-[1.02] transition-all border-none outline-none mt-4"
                    >
                      تسجيل سداد مالي / دفعة جارية للطلب  💵
                    </button>
                  )}

                  {/* Cancel Order and Rollback with full sync */}
                  {selectedOrder.status !== 'cancelled' && (
                    <button 
                      onClick={async () => {
                        if (window.confirm('🚨 هل أنت متأكد من إلغاء هذه الطلبية وعكس كافة الحركات المالية والمخزنية التابعة لها بشكل تزامني؟ لا يمكن التراجع عن هذا الإجراء.')) {
                          // Compile itemsToReturn
                          const itemsToReturn = selectedOrder.items.map((item: any) => ({
                            productId: item.productId || item.id,
                            warehouseId: item.warehouseId || 'المحل',
                            quantity: Number(item.actualPrepQuantity ?? item.quantity ?? 0)
                          }));

                          // Target box to retrieve refund money from
                          const boxId = selectedOrder.targetBoxId || 'CASH_BOX';
                          const amount = Number(selectedOrder.paidAmount || 0);

                          const res = await handleInvoiceRollbackAndSync(
                            selectedOrder.id,
                            profile?.ownerId || 'JAM_STORE_1',
                            {
                              itemsToReturn,
                              moneyToWithdraw: { boxId, amount }
                            },
                            () => {
                              setIsOrderModalOpen(false);
                            }
                          );

                          if (res.success) {
                            alert(res.message);
                            // If profile is wholesaler, let's track their cancellation counts to apply 3-day ban on repetitive rejections
                            if (profile?.role === 'wholesaler') {
                              try {
                                const storeRef = doc(db, 'users', profile.ownerId);
                                const storeSnap = await getDoc(storeRef);
                                let rejections = 0;
                                if (storeSnap.exists()) {
                                  rejections = Number(storeSnap.data().wholesalerRejectionsCount || 0);
                                }
                                const newRejectionsCount = rejections + 1;
                                if (newRejectionsCount >= 3) {
                                  const banUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                                  await updateDoc(storeRef, {
                                    status: 'blocked',
                                    banReason: 'مخالفة تكرار رفض وإلغاء طلبيات المشترين النشطين (التطهير التجاري 3 مرات)',
                                    bannedUntil: banUntil,
                                    wholesalerRejectionsCount: 0,
                                    updatedAt: serverTimestamp()
                                  });
                                  alert('⚠️ بروتوكول الحماية المالية: تم حظر حسابكم كمورد مؤقتاً لمدة 3 أيام لتكرار إلغاء ورفض طلبيات العملاء!');
                                } else {
                                  await updateDoc(storeRef, {
                                    wholesalerRejectionsCount: newRejectionsCount
                                  });
                                  alert(`تنبيه للمورد: تم تسجيل هذا الإلغاء. إجمالي المخالفات الحالية: ${newRejectionsCount} من أصل 3 قبل تطبيق حظر الـ 3 أيام.`);
                                }
                              } catch (err) {
                                console.warn("Could not record rejection metric:", err);
                              }
                            }
                          } else {
                            alert(`خطأ أثناء إلغاء الطلبية وعكس القيود: ${res.error}`);
                          }
                        }
                      }}
                      className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs hover:scale-[1.02] transition-all border-none flex items-center justify-center gap-2 mt-4 cursor-pointer"
                    >
                      <Undo size={16} />
                      إلغاء الطلبية وعكس المخزون والمالية كليّاً 🚨
                    </button>
                  )}

                  {/* Standard Close details */}
                  <button 
                    onClick={() => setIsOrderModalOpen(false)}
                    className="w-full py-4 border border-gray-100 dark:border-white/10 rounded-2xl text-gray-400 font-black hover:bg-gray-50 dark:hover:bg-white/5 transition-all outline-none border-none mt-4"
                  >
                     تراجع وإغلاق النافذة
                  </button>

                  <div className="mt-6 p-4 bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-white/5 rounded-2xl text-center text-[10px] text-gray-500 font-bold leading-relaxed">
                     ⚠️ تنويه قانوني: إن هذا النظام والمستندات والرسائل التابعة له يتم تشغيلها وإدارتها تقنياً وتحت إخلاء المسؤولية الكامل لمالك ومطور نظام JAM System Pro.
                  </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <EnforcedReceiptModal 
        isOpen={!!selectedRemittanceForVerification}
        amount={selectedRemittanceForVerification?.paymentDetails?.amountPaid || selectedRemittanceForVerification?.total || 0}
        currency={selectedRemittanceForVerification?.paymentDetails?.currency || 'YER'}
        remittanceNumber={selectedRemittanceForVerification?.paymentDetails?.remittanceNumber || ''}
        availableBoxes={combinedBoxes}
        onConfirm={(destType, selectedBoxId, details) => {
          if (selectedRemittanceForVerification) {
            handleVerifyB2BPayment(selectedRemittanceForVerification, destType, selectedBoxId, details);
          }
        }}
        onClose={() => setSelectedRemittanceForVerification(null)}
      />

      {/* Dispatch & Settlement Modal */}
      <AnimatePresence>
        {isDispatchModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-right" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDispatchModalOpen(false)} className="absolute inset-0 bg-navy-950/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 20, opacity: 0 }} className="relative w-full max-w-2xl bg-navy-900 rounded-[3rem] border border-white/10 p-8 shadow-2xl overflow-y-auto max-h-[90vh] z-10">
              <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2">
                <span>🚚 شحن وتسوية الطلبية #${selectedOrder.id.slice(-6)}</span>
              </h3>
              <p className="text-gray-400 text-xs mb-6 text-right">مراجعة الأسعار وتجهيز تسليم البضاعة مع تسوية الفروقات الناتجة عن تذبذب الأسعار.</p>

              <div className="space-y-4 mb-6 text-right">
                <p className="text-xs font-black text-brand-primary text-right">تطابق أسعار السوق الحالية وفروقات الأسعار:</p>
                {selectedOrder.items.map((item: any) => {
                  const itemPrice = dispatchItemPrices[item.productId] !== undefined ? dispatchItemPrices[item.productId] : item.price;
                  const qty = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                  const actualPrep = item.actualPrepQuantity !== undefined ? item.actualPrepQuantity : qty;
                  return (
                    <div key={item.productId} className="p-4 bg-navy-950/50 rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="text-right">
                        <h4 className="font-bold text-sm text-white">{item.name}</h4>
                        <p className="text-[10px] text-gray-500">الكمية المطلوبة: {item.quantity} | المجهزة فعلياً: <span className="font-black text-brand-primary">{actualPrep}</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">السعر الدفتري المعتمد:</span>
                        <input
                          type="number"
                          value={itemPrice}
                          onChange={(e) => {
                            setDispatchItemPrices(prev => ({
                              ...prev,
                              [item.productId]: Number(e.target.value)
                            }));
                          }}
                          className="bg-navy-900 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white text-center w-28 outline-none focus:border-brand-primary font-mono font-bold"
                        />
                        <span className="text-[10px] text-gray-500">ر.ي</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Price Fluctuation Summary */}
              {(() => {
                let calcTotal = 0;
                selectedOrder.items.forEach((item: any) => {
                  const itemPrice = dispatchItemPrices[item.productId] !== undefined ? dispatchItemPrices[item.productId] : item.price;
                  const qty = item.actualPrepQuantity !== undefined ? item.actualPrepQuantity : item.quantity;
                  calcTotal += itemPrice * qty;
                });
                const originalTotal = selectedOrder.total;
                return (
                  <>
                    <div className="p-4 rounded-2xl bg-black/35 mb-6 border border-white/5 space-y-2 text-right">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>إجمالي الطلب عند الاعتماد:</span>
                        <span className="font-mono text-white">{originalTotal.toLocaleString()} ر.ي</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>الإجمالي بعد تعديل أسعار السوق والتجهيز:</span>
                        <span className="font-mono text-brand-primary font-black">{calcTotal.toLocaleString()} ر.ي</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-white/5 pt-2 font-bold">
                        <span>فارق السعر التذبذبي:</span>
                        <span className={`font-mono ${difference >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {difference >= 0 ? `+${difference.toLocaleString()}` : difference.toLocaleString()} ر.ي
                        </span>
                      </div>

                      {selectedOrder.paymentType === 'debt' ? (
                        <div className="mt-3 p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-xs text-rose-400">
                          ⚠️ <strong>حالة السداد (آجل/دين):</strong> سيتم تسوية وإضافة الفارق المالي ({difference.toLocaleString()} ر.ي) تلقائياً في دفتر الحساب والذمم الجاري للعميل المالي.
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-xs text-emerald-400 bg-emerald-500/10">
                            ℹ️ <strong>حالة السداد (نقدي مسبق):</strong> الفارق المستحق للعميل في صندوق الترجيع: {Math.max(0, -difference).toLocaleString()} ر.ي. يرجى اختيار صندوق لخصم الفارق:
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-right">
                            <div className="space-y-1">
                              <label className="text-[9px] text-gray-400 font-bold block">صندوق استرجاع تسوية فارق النقدية</label>
                              <select
                                value={dispatchRefundBox}
                                onChange={(e) => setDispatchRefundBox(e.target.value)}
                                className="w-full bg-navy-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-brand-primary"
                              >
                                <option value="CASH_BOX">صندوق الكاش الافتراضي (زلط نقد باليد)</option>
                                {combinedBoxes.map(b => (
                                  <option key={b.id} value={b.id}>{b.bankName || 'حساب بنكي'}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-gray-400 font-bold block">ملاحظات تسوية الإرجاع</label>
                              <input
                                type="text"
                                value={dispatchRefundDetails}
                                onChange={(e) => setDispatchRefundDetails(e.target.value)}
                                className="w-full bg-navy-950 border border-white/10 text-right rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-brand-primary"
                                placeholder="ملاحظات الصرف والخصم اليدوي..."
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Delivery agents assignment */}
                    <div className="mt-4 p-4 rounded-2xl bg-black/25 mb-6 border border-white/5 space-y-3 text-right">
                      <p className="text-xs font-black text-brand-primary">طريقة التوزيع ونقل السلع اللوجستي:</p>
                      <p className="text-[10px] text-gray-400 font-bold">يرجى تحديد ما إذا كنت تريد شحن البضائع دون تكليف سائق، أو شحن طرد مغلق ومحمي مع تكليف سائق توصيل فوري بـ (طلب سريع):</p>
                      <div className="grid grid-cols-2 gap-3 pb-2">
                        <button
                          type="button"
                          onClick={() => setShippingMode('ship_only')}
                          className={`p-3 rounded-xl border text-center font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            shippingMode === 'ship_only'
                              ? 'bg-brand-primary text-navy-950 border-brand-primary font-black'
                              : 'bg-navy-950 border-white/10 text-gray-400 hover:text-white'
                          }`}
                        >
                          <span className="font-extrabold text-[11px]">📦 شحن وتوصيل عادي (دون قفل)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShippingMode('ship_delivery')}
                          className={`p-3 rounded-xl border text-center font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            shippingMode === 'ship_delivery'
                              ? 'bg-amber-500 text-navy-950 border-amber-500 font-black animate-pulse'
                              : 'bg-navy-950 border-white/10 text-gray-400 hover:text-white'
                          }`}
                        >
                          <span className="font-extrabold text-[11px]">⚡ شحن مقفل + توصيل سائق فوري</span>
                        </button>
                      </div>

                      {shippingMode === 'ship_delivery' && (
                        <div className="space-y-2 text-right">
                          <label className="text-[10px] text-gray-400 font-bold block">اختر السائق المكلف بالطلب الفوري لشحن السلعة:</label>
                          <select
                            value={selectedDeliveryAgentId}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              setSelectedDeliveryAgentId(selectedId);
                              const found = deliveryAgents.find(a => a.uid === selectedId);
                              setSelectedDeliveryAgentName(found ? (found.name || found.email) : '');
                            }}
                            className="w-full bg-navy-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-brand-primary font-bold"
                          >
                            <option value="">-- اختر السائق المكلف بالبث اللحظي --</option>
                            {deliveryAgents.map(agent => (
                              <option key={agent.uid} value={agent.uid} className="bg-navy-950 text-white font-bold">
                                {agent.name || agent.email} 👤 [{agent.phone || 'دون هاتف'}]
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              <div className="flex gap-3">
                <button
                  disabled={loading}
                  onClick={() => handleDispatchAndSettleOrder(selectedOrder)}
                  className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl text-xs hover:bg-emerald-500 transition-all border-none outline-none block cursor-pointer"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto text-white" /> : '✓ اعتماد شحن وتسوية البضائع في الحساب'}
                </button>
                <button
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="px-6 py-4 bg-navy-950 border border-white/10 text-gray-400 rounded-2xl text-xs hover:bg-navy-800 transition-all outline-none cursor-pointer"
                >
                  إلغاء التراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Distribution Modal */}
      <AnimatePresence>
        {isDistributionModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-right" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDistributionModalOpen(false)} className="absolute inset-0 bg-navy-950/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 20, opacity: 0 }} className="relative w-full max-w-2xl bg-navy-900 rounded-[3rem] border border-white/10 p-8 shadow-2xl overflow-y-auto max-h-[90vh] z-10">
              <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2">
                <span>🏢 تأكيد التوزيع المستودعي والاستلام الميداني للطلب</span>
              </h3>
              <p className="text-gray-400 text-xs mb-6 text-right">حدد طريقة تفريغ وتنزيل كميات أصناف الفاتورة المستلمة في مستودعات ومخازن المحل.</p>

              {/* Layout selection */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setDistributionType('ALL_TO_ONE')}
                  className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all text-center cursor-pointer ${
                    distributionType === 'ALL_TO_ONE'
                      ? 'bg-brand-primary border-brand-primary text-navy-950 font-black'
                      : 'bg-navy-950 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  <Store size={18} />
                  <span className="text-[10px] font-black">إيداع كامل بمخزن واحد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDistributionType('SPLIT_HALF_QUARTER')}
                  className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all text-center cursor-pointer ${
                    distributionType === 'SPLIT_HALF_QUARTER'
                      ? 'bg-brand-primary border-brand-primary text-navy-950 font-black'
                      : 'bg-navy-950 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  <Gavel size={18} />
                  <span className="text-[10px] font-black">تقسيم تلقائي تناسبي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDistributionType('CUSTOM')}
                  className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all text-center cursor-pointer ${
                    distributionType === 'CUSTOM'
                      ? 'bg-brand-primary border-brand-primary text-navy-950 font-black'
                      : 'bg-navy-950 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  <Package size={18} />
                  <span className="text-[10px] font-black">توزيع يدوي مخصص تفصيلي</span>
                </button>
              </div>

              {/* 5-Tier Automated Pricing Engine Interface */}
              <div className="mb-6 p-5 bg-navy-950/60 rounded-[2rem] border border-white/10 space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <h4 className="text-sm font-black text-brand-primary flex items-center gap-2">
                    <TrendingUp size={16} />
                    <span>⚙️ محرك تسعير السلع التلقائي الذكي (5-Tier Pricing)</span>
                  </h4>
                  <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full font-bold">نشط ومؤتمت</span>
                </div>
                
                <p className="text-gray-400 text-[11px] text-right">حدد استراتيجية احتساب أسعار البيع فور تلقي الشحنة وتنزيلها بالمخازن لإعادة تحديث الكتالوج فوراً:</p>

                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'market', name: 'سعر السوق الموحد', desc: 'مطابقة أسعار الموردين' },
                    { id: 'history', name: 'هامش الأرباح التاريخي', desc: 'مزامنة أرباحك السابقة' },
                    { id: 'manual', name: 'تسعير يدوي صرف', desc: 'إدخال مالي مخصص' },
                    { id: 'percentage', name: 'نسبة مئوية مضافة', desc: 'تكلفة + هامش مئوي' },
                    { id: 'flat', name: 'شريحة ربح مسطحة', desc: 'مبلغ ثابت لكل كتلة ١٠٠٠' }
                  ].map((strat) => (
                    <button
                      key={strat.id}
                      type="button"
                      onClick={() => setPricingStrategy(strat.id as any)}
                      className={`p-2.5 rounded-xl flex flex-col items-center justify-center text-center transition-all border ${
                        pricingStrategy === strat.id
                          ? 'bg-brand-primary border-brand-primary text-navy-950 font-black'
                          : 'bg-navy-900 border-white/5 text-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="text-[10px] font-black leading-tight">{strat.name}</span>
                      <span className="text-[8px] opacity-70 mt-1 line-clamp-1">{strat.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Additional Strategy Controls */}
                {pricingStrategy === 'percentage' && (
                  <div className="flex items-center gap-3 p-3 bg-navy-900 rounded-xl border border-white/5 text-right">
                    <span className="text-xs text-gray-300 whitespace-nowrap">نسبة هامش الربح الإضافية لمجموع التكلفة:</span>
                    <input
                      type="number"
                      value={markupPercentage}
                      onChange={(e) => setMarkupPercentage(Math.max(0, Number(e.target.value)))}
                      className="w-20 bg-navy-950 border border-white/10 text-center rounded-lg py-1.5 text-xs text-white font-mono font-black placeholder-white"
                    />
                    <span className="text-xs font-bold text-brand-primary">%</span>
                  </div>
                )}

                {pricingStrategy === 'flat' && (
                  <div className="flex items-center gap-3 p-3 bg-navy-900 rounded-xl border border-white/5 text-right">
                    <span className="text-xs text-gray-300 whitespace-nowrap">مبلغ دولار/ريال ربح حتمي لكل ١٠٠٠ قيمة تكلفة:</span>
                    <input
                      type="number"
                      value={flatStepGoal}
                      onChange={(e) => setFlatStepGoal(Math.max(0, Number(e.target.value)))}
                      className="w-24 bg-navy-950 border border-white/10 text-center rounded-lg py-1.5 text-xs text-white font-mono font-black"
                    />
                    <span className="text-xs font-bold text-brand-primary">ر.ي</span>
                  </div>
                )}

                {pricingStrategy === 'market' && (
                  <div className="p-3 bg-brand-primary/5 rounded-xl border border-brand-primary/10 text-right">
                    <span className="text-[10px] text-brand-primary block font-bold">💡 مطابقة الأسعار مع مستويات السوق:</span>
                    <span className="text-[9px] text-gray-400">سيتم تلقائياً ترحيل الأصناف غير المكتشفة في السوق لقمة القائمة لإعادة تسعيرها يدوياً لتفادي أي ثغرات مالية.</span>
                  </div>
                )}

                {/* Pricing Live Preview Grid */}
                <div className="space-y-2 mt-4 text-right">
                  <span className="text-[10px] text-gray-400 font-bold block">📊 معاينة أسعار البيع للوحدة المحتسبة:</span>
                  <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {selectedOrder.items.map((item: any) => {
                      const cost = item.actualPrice || item.price || 0;
                      const calculatedPrice = receivingItemPrices[item.productId] ?? (cost * 1.25);
                      const isUnmatchedMarket = pricingStrategy === 'market' && !wholesaleProducts.some(wp => wp.name?.trim() === item.name?.trim() || wp.id === item.productId);

                      return (
                        <div key={item.productId} className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                          isUnmatchedMarket ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5 bg-navy-900'
                        }`}>
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-bold text-[10px] text-white truncate max-w-[120px]">{item.name}</span>
                            {isUnmatchedMarket && (
                              <span className="bg-amber-500/20 text-amber-400 text-[8px] px-1.5 py-0.5 rounded font-black whitespace-nowrap">فلوت معلق</span>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5">
                            <span className="text-[9px] text-gray-500">تكلفة: <strong className="text-gray-300 font-mono">{cost.toLocaleString()} YER</strong></span>
                            
                            {pricingStrategy === 'manual' ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[8px] text-gray-400">سعر البيع:</span>
                                <input
                                  type="number"
                                  value={calculatedPrice}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setReceivingItemPrices(prev => ({
                                      ...prev,
                                      [item.productId]: val
                                    }));
                                  }}
                                  className="w-16 bg-navy-950 border border-white/10 text-center rounded py-0.5 text-[9px] text-white font-mono font-black"
                                />
                              </div>
                            ) : (
                              <span className="text-[9px] text-emerald-400 font-black">بيع: <strong className="font-mono">{calculatedPrice.toLocaleString()} YER</strong></span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Settings based on Selection */}
              {distributionType === 'ALL_TO_ONE' && (
                <div className="space-y-2 mb-6 p-4 bg-navy-950/40 rounded-2xl border border-white/5 text-right">
                  <label className="text-[10px] text-gray-400 font-bold block text-right">اختر المخزن المستودع لإيداع ١٠٠٪ من السلع:</label>
                  <select
                    value={selectedWarehouse1}
                    onChange={(e) => setSelectedWarehouse1(e.target.value)}
                    className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-brand-primary text-right"
                  >
                    {(shopSettings?.productCategories || ['المحل', 'المستودع الرئيسي', 'المستودع الاحتياطي']).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {distributionType === 'SPLIT_HALF_QUARTER' && (
                <div className="space-y-4 mb-6 p-4 bg-navy-950/40 rounded-2xl border border-white/5 text-right">
                  <p className="text-[10px] text-brand-primary font-black mb-2 text-right">أوزان التوزيع (50% مخزن رئيسي، 25% مخزن فرعي، 25% إضافي للمخزن الرئيسي)</p>
                  <div className="grid grid-cols-2 gap-4 text-right">
                    <div className="space-y-1 text-right">
                      <label className="text-[9px] text-gray-400 block text-right">مخزن التوزيع الأول (٧٥٪ من شحنة المنتجات):</label>
                      <select
                        value={selectedWarehouse1}
                        onChange={(e) => setSelectedWarehouse1(e.target.value)}
                        className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-white text-right"
                      >
                        {(shopSettings?.productCategories || ['المحل', 'المستودع الرئيسي']).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 text-right">
                      <label className="text-[9px] text-gray-400 block text-right">مخزن التوزيع الثاني (٢٥٪ المتبقية):</label>
                      <select
                        value={selectedWarehouse2}
                        onChange={(e) => setSelectedWarehouse2(e.target.value)}
                        className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-white text-right"
                      >
                        {(shopSettings?.productCategories || ['المستودع الاحتياطي', 'المستودع الرئيسي']).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {distributionType === 'CUSTOM' && (
                <div className="space-y-4 mb-6 max-h-[250px] overflow-y-auto pr-2 text-right">
                  <p className="text-[10px] text-emerald-500 font-black text-right">وزع كمية المستلم لكل صنف بدقة على قطاعات المستودعات:</p>
                  {selectedOrder.items.map((item: any) => {
                    const expectedQty = item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                    const itemAlloc = customAllocation[item.productId] || {};
                    const cats = shopSettings?.productCategories || ['المحل', 'المستودع الرئيسي'];
                    const firstCat = cats[0] || 'المحل';
                    const secondCat = cats[1] || 'المستودع الرئيسي';
                    const q1 = itemAlloc[firstCat] !== undefined ? itemAlloc[firstCat] : expectedQty;
                    const q2 = itemAlloc[secondCat] !== undefined ? itemAlloc[secondCat] : 0;

                    return (
                      <div key={item.productId} className="p-4 bg-navy-950/40 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-center text-right">
                          <span className="font-bold text-xs text-white">{item.name}</span>
                          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-lg text-gray-300">الكمية المستلمة: <strong className="text-white">{expectedQty}</strong></span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1 text-right">
                            <label className="text-[9px] text-gray-400 block text-right">{firstCat}:</label>
                            <input
                              type="number"
                              value={q1}
                              max={expectedQty}
                              min={0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setCustomAllocation(prev => {
                                  const itemPrev = prev[item.productId] || {};
                                  return {
                                    ...prev,
                                    [item.productId]: {
                                      ...itemPrev,
                                      [firstCat]: val
                                    }
                                  };
                                });
                              }}
                              className="w-full bg-navy-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white text-center font-mono font-black"
                            />
                          </div>
                          <div className="space-y-1 text-right">
                            <label className="text-[9px] text-gray-400 block text-right">{secondCat}:</label>
                            <input
                              type="number"
                              value={q2}
                              max={expectedQty}
                              min={0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setCustomAllocation(prev => {
                                  const itemPrev = prev[item.productId] || {};
                                  return {
                                    ...prev,
                                    [item.productId]: {
                                      ...itemPrev,
                                      [secondCat]: val
                                    }
                                  };
                                });
                              }}
                              className="w-full bg-navy-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white text-center font-mono font-black"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 text-right">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSettleAndDistributeStock(selectedOrder)}
                  className="flex-1 py-4 bg-success text-white font-black rounded-2xl text-xs hover:bg-success/90 transition-all border-none outline-none block cursor-pointer"
                >
                  {loading ? <Loader2 className="animate-spin" /> : '✓ تأكيد تفريغ وتنزيل البضاعة بالرفوف'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDistributionModalOpen(false)}
                  className="px-6 py-4 bg-navy-950 border border-white/10 text-gray-400 rounded-2xl text-xs hover:bg-navy-800 transition-all outline-none cursor-pointer"
                >
                  تراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 5-Tier Dynamic Pricing Switcher Utility (دالة الفرز والمطابقة للأسعار التلقائية)
 * Calculates target unit selling prices for incoming items based on 5 strategies
 */
export const getCalculatedPrices = (
  items: any[],
  strategy: 'market' | 'history' | 'manual' | 'percentage' | 'flat',
  options: {
    percentage?: number;
    flatStep?: number;
    inventory?: any[];
    wholesaleProducts?: any[];
    manualPrices?: Record<string, number>;
  }
) => {
  const calculated: Record<string, { cost: number; price: number; method: string; isMatched: boolean }> = {};

  items.forEach(item => {
    const cost = item.actualPrice || item.price || 0;
    let price = cost * 1.25; // fallback
    let method = 'تلقائي (+25%)';
    let isMatched = true;

    switch (strategy) {
      case 'market': {
        // Match current wholesale market rates
        const match = options.wholesaleProducts?.find(
          wp => wp.name?.trim() === item.name?.trim() || wp.id === item.productId
        );
        if (match && match.price) {
          price = match.price;
          method = 'سعر السوق الموحد';
          isMatched = true;
        } else {
          price = cost; // Non-matched, needs manual input
          method = 'سعر غير متقاطع (يدوي مطلوب)';
          isMatched = false;
        }
        break;
      }
      case 'history': {
        // Read historical profit margin (previous price - cost in local inventory)
        const localItem = options.inventory?.find(
          inv => inv.name?.trim() === item.name?.trim()
        );
        if (localItem && localItem.price && localItem.cost) {
          const margin = Math.max(0, localItem.price - localItem.cost);
          price = cost + margin;
          method = `هامش تاريخي (+${margin} ر.ي)`;
        } else {
          // match category average
          const cat = item.category || 'عام';
          const catItems = options.inventory?.filter(inv => inv.category === cat && inv.price && inv.cost);
          if (catItems && catItems.length > 0) {
            const sumMargin = catItems.reduce((acc, curr) => acc + Math.max(0, curr.price - curr.cost), 0);
            const avgMargin = Math.round(sumMargin / catItems.length);
            price = cost + avgMargin;
            method = `متوسط الفئة تاريخياً (+${avgMargin} ر.ي)`;
          } else {
            price = cost + 200; // default for e.g. headphones
            method = 'تلقائي افتراضي (+200 ر.ي)';
          }
        }
        break;
      }
      case 'percentage': {
        const pct = options.percentage !== undefined ? options.percentage : 25;
        price = Math.round(cost * (1 + pct / 100));
        method = `هامش نسبة مئوية ربحية (+${pct}%)`;
        break;
      }
      case 'flat': {
        const step = options.flatStep !== undefined ? options.flatStep : 100;
        const multiplier = Math.floor(cost / 1000) || 1;
        const profit = step * multiplier;
        price = cost + profit;
        method = `هامش شريحة مسطحة (+${profit} ر.ي)`;
        break;
      }
      case 'manual':
      default: {
        const manualVal = options.manualPrices?.[item.productId];
        price = manualVal !== undefined ? manualVal : Math.round(cost * 1.25);
        method = 'تعديل يدوي مباشر';
        break;
      }
    }

    calculated[item.productId] = { cost, price, method, isMatched };
  });

  return calculated;
};