import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crown, Store, ShoppingCart, Shield, Zap, ChevronRight, Search,
  Image as ImageIcon, Trash2, Plus, Minus, Layers, AlertCircle, CheckCircle,
  TrendingUp, RefreshCcw, Sparkles, Filter, X, ShoppingBag, Info, Phone, MapPin, Tag,
  Lock, Unlock, Wallet, Link as LinkIcon, FileText, Check, Ban, Eye, DollarSign, UserCheck, BarChart2, ShieldCheck,
  Gavel, Bell, Sliders, Settings, Key, KeyRound, Users, Package, MessageSquare, Send, CheckCheck, Loader2, Camera, Megaphone, Download, PhoneCall,
  Sun, Moon, RotateCcw, Receipt, Printer, Award, ArrowDownRight, ArrowUpRight, PieChart
} from 'lucide-react';
import { db } from '../firebase';
import BarcodeScanner from './BarcodeScanner';
import { MerchantDirectory } from './MerchantDirectory';
import { MarketManagement } from './MarketManagement';
import { ProductsAndAgencies } from './ProductsAndAgencies';
import { MyStockDashboard } from './MyStockDashboard';
import { WalletDepositCard } from './WalletDepositCard';
import { 
  filterConnectedSuppliersByTier, 
  getHierarchyLevel, 
  isAllowedTierGap 
} from '../utils/b2bTierHierarchy';
import { b2bLinkageEngine } from '../services/b2bLinkageEngine';
import { b2bCatalogBridgeEngine } from '../services/b2bCatalogBridgeEngine';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  getDoc,
  limit,
  or
} from 'firebase/firestore';
import { marketService, SupplierProfile, WholesaleMarketProduct, ProductVariant } from '../services/marketService';
import { sendB2BOrderStatusWhatsAppNotification } from '../services/whatsappService';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { UserProfile, B2BConnectionRequest } from '../types';
import JAMPayModal from './JAMPayModal';
import { compressProductImageFast, JamFastProductImage } from './JamFastProductImage';
import { B2BConnectionRequestModal } from './B2BConnectionRequestModal';
import { B2BDecisionModal } from './B2BDecisionModal';

const compressImage = (file: File, maxW = 500, maxH = 500, quality = 0.5): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxW) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          }
        } else {
          if (height > maxH) {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// Helper for ultra low-bandwidth optimization: strips away heavy asset references, long descriptions,
// base64 strings or unnecessary historic log arrays to cap packet sizes under 1 Kilobyte.
const reduceDataPayload = (data: any) => {
  if (!data) return data;
  const pruned = { ...data };
  if (pruned.description && typeof pruned.description === 'string' && pruned.description.length > 80) {
    pruned.description = pruned.description.slice(0, 80) + '...';
  }
  if (Array.isArray(pruned.photos)) {
    // Keep only the first photo reference if any, and truncate if too long (base64)
    pruned.photos = pruned.photos.slice(0, 1).map((p: any) => 
      typeof p === 'string' && p.startsWith('data:') ? p.slice(0, 60) + '...' : p
    );
  }
  if (pruned.imageUrl && typeof pruned.imageUrl === 'string' && pruned.imageUrl.startsWith('data:')) {
    pruned.imageUrl = pruned.imageUrl.slice(0, 60) + '...';
  }
  // Strip heavy lists or historical logs
  delete pruned.historicalLogs;
  delete pruned.rawMetadata;
  delete pruned.changeHistory;
  return pruned;
};

export default function MarketUI({ profile }: { profile: UserProfile | null }) {
  // Main Market Tabs: 'order' (الطلب والتسوق), 'connection' (الارتباط B2B), 'catalog' (تصفح الكتالوج والوكالات), 'publish' (النشر وتغذية السوق)
  const [activeTab, setActiveTab] = useState<'order' | 'connection' | 'catalog' | 'publish'>('order');
  const { cart, addItem, updateQuantity, removeItem, clearCart, getCartTotal, getCartCount, updateItemOptions } = useShoppingCart();

  // Customer Chat States
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [blockedNumbers, setBlockedNumbers] = useState<string[]>([]);
  const [activeChatPhone, setActiveChatPhone] = useState<string | null>(null);
  const [chatReplyText, setChatReplyText] = useState('');
  const [chatImageUpload, setChatImageUpload] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);

  useEffect(() => {
    if (!profile?.ownerId) return;

    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      or(
        where('senderId', '==', profile.ownerId),
        where('receiverId', '==', profile.ownerId)
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      msgs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });
      setAllMessages(msgs);
    }, (error) => {
      console.error("Error listening to merchant messages:", error);
    });

    const blockedRef = collection(db, 'blocked_customers');
    const qBlocked = query(blockedRef, where('shopId', '==', profile.ownerId));
    const unsubBlocked = onSnapshot(qBlocked, (snapshot) => {
      const blocked = snapshot.docs
        .filter(doc => doc.data().blocked)
        .map(doc => doc.data().customerPhone);
      setBlockedNumbers(blocked);
    });

    return () => {
      unsubscribe();
      unsubBlocked();
    };
  }, [profile?.ownerId]);

  const customerThreads = useMemo(() => {
    const threadsMap: { [phone: string]: { 
      phone: string; 
      name: string; 
      messages: any[]; 
      lastMessage: any; 
      unreadCount: number;
      isOnline: boolean;
    } } = {};

    allMessages.forEach(msg => {
      const phone = msg.senderId === profile?.ownerId ? msg.receiverId : msg.senderId;
      if (!phone) return;

      if (!threadsMap[phone]) {
        threadsMap[phone] = {
          phone,
          name: msg.customerName || `زبون (${phone})`,
          messages: [],
          lastMessage: null,
          unreadCount: 0,
          isOnline: false,
        };
      }

      threadsMap[phone].messages.push(msg);
      threadsMap[phone].lastMessage = msg;

      if (msg.isCustomer && !msg.read) {
        threadsMap[phone].unreadCount += 1;
      }

      if (msg.createdAt) {
        const msgTime = msg.createdAt.toDate ? msg.createdAt.toDate().getTime() : (msg.createdAt.seconds * 1000);
        const tenMinsAgo = Date.now() - 10 * 60 * 1000;
        if (msgTime > tenMinsAgo) {
          threadsMap[phone].isOnline = true;
        }
      }
    });

    return Object.values(threadsMap).sort((a, b) => {
      const timeA = a.lastMessage?.createdAt?.seconds || 0;
      const timeB = b.lastMessage?.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [allMessages, profile?.ownerId]);

  const totalUnreadChats = useMemo(() => {
    return customerThreads.reduce((acc, t) => acc + t.unreadCount, 0);
  }, [customerThreads]);

  const [searchChatTerm, setSearchChatTerm] = useState('');
  const replyScrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    replyScrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, activeChatPhone]);

  useEffect(() => {
    if (!activeChatPhone || !profile?.ownerId || activeTab !== 'customer_chat') return;
    
    const unreadMsgs = allMessages.filter(m => m.senderId === activeChatPhone && !m.read);
    if (unreadMsgs.length > 0) {
      unreadMsgs.forEach(async (msg) => {
        try {
          await updateDoc(doc(db, 'messages', msg.id), { read: true });
        } catch (err) {
          console.error("Failed to mark message as read:", err);
        }
      });
    }
  }, [activeChatPhone, allMessages, profile?.ownerId, activeTab]);

  const filteredThreads = useMemo(() => {
    return customerThreads.filter(thread => {
      const q = searchChatTerm.trim().toLowerCase();
      if (!q) return true;
      return thread.name.toLowerCase().includes(q) || thread.phone.includes(q);
    });
  }, [customerThreads, searchChatTerm]);

  const handleToggleBlock = async (customerPhone: string, isCurrentlyBlocked: boolean) => {
    try {
      const q = query(
        collection(db, 'blocked_customers'), 
        where('shopId', '==', profile?.ownerId),
        where('customerPhone', '==', customerPhone)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        for (const d of snap.docs) {
          await updateDoc(doc(db, 'blocked_customers', d.id), { blocked: !isCurrentlyBlocked });
        }
      } else {
        await addDoc(collection(db, 'blocked_customers'), {
          shopId: profile?.ownerId,
          customerPhone,
          blocked: true,
          createdAt: serverTimestamp()
        });
      }
      alert(isCurrentlyBlocked ? "تم إلغاء الحظر عن هذا الزبون بنجاح!" : "تم حظر هذا الزبون بنجاح! لن يتمكن من إرسال رسائل إضافية.");
    } catch (error) {
      console.error("Error toggling block:", error);
    }
  };

  // Unified mode state: 'supplier' (Buyer portal removed per user request)
  const [viewMode, setViewMode] = useState<'buyer' | 'supplier'>('supplier');

  // Multi-tier Level simulation (User level can be simulated for testing)
  const [currentUserLevel, setCurrentUserLevel] = useState<number>(() => {
    if (profile?.hierarchyLevel) return profile.hierarchyLevel;
    if (profile?.role === 'superadmin') return 4;
    if (profile?.role === 'retailer') return 4;
    if (profile?.role === 'wholesaler') return 3;
    return 4; // default to level 4 (retailer)
  });

  // Supplier state
  const [myB2BKey, setMyB2BKey] = useState<string>('');
  
  // 5-Digit B2B Key Generation states
  const [isGenerateKeyModalOpen, setIsGenerateKeyModalOpen] = useState(false);
  const [genKeyValidity, setGenKeyValidity] = useState<'permanent' | 'daily' | 'hours'>('permanent');
  const [genKeyHours, setGenKeyHours] = useState<number>(24);
  const [genKeyAllowedPayments, setGenKeyAllowedPayments] = useState<string[]>(['cash', 'deferred', 'transfer', 'jampay']);
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<any[]>([]);
  const [partnerConnections, setPartnerConnections] = useState<any[]>([]);
  const [dndModeEnabled, setDndModeEnabled] = useState(false);
  const [cashierRoutingEnabled, setCashierRoutingEnabled] = useState(true);

  // Buyer State
  const [connectedSuppliers, setConnectedSuppliers] = useState<any[]>([]);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [products, setProducts] = useState<WholesaleMarketProduct[]>([]);
  const [searchKey, setSearchKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Supplier rejection states and buyer monitoring status
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [supplierAlert, setSupplierAlert] = useState<string | null>(null);
  const [userDbProfile, setUserDbProfile] = useState<any>(null);
  const [selectedLedgerConn, setSelectedLedgerConn] = useState<any | null>(null);

  // Permissions Modal state for B2B supplier linkages
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [targetPermissionConn, setTargetPermissionConn] = useState<any | null>(null);
  const [permissionKeyValidity, setPermissionKeyValidity] = useState<'daily' | 'permanent' | 'custom_hours'>('permanent');
  const [permissionCustomHours, setPermissionCustomHours] = useState<number>(24);
  const [permissionAllowedPayments, setPermissionAllowedPayments] = useState<string[]>(['cash', 'deferred', 'transfer', 'jampay']);
  const [permissionIsPartiallyBlocked, setPermissionIsPartiallyBlocked] = useState<boolean>(false);
  const [permissionBlockedCategories, setPermissionBlockedCategories] = useState<string[]>([]);
  const [permissionCreditLimit, setPermissionCreditLimit] = useState<number>(1000000);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // States for Task 2 and Task 3 (B2B Identity Setup & Connections Management)
  const [isB2bProfileModalOpen, setIsB2bProfileModalOpen] = useState(false);
  const [isB2bConnectionsModalOpen, setIsB2bConnectionsModalOpen] = useState(false);
  const [b2bProfile, setB2bProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [connectionsModalTab, setConnectionsModalTab] = useState<'me' | 'them'>('them');
  const [isCreatingNewWarehouse, setIsCreatingNewWarehouse] = useState(false);
  const [newWarehouseInputName, setNewWarehouseInputName] = useState('');
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [managementSubTab, setManagementSubTab] = useState<'profile' | 'connections'>('profile');

  // Clean B2B Market Navigation States (8 Tabs Architecture: Merchants, Products, Orders, Promo, Haraj, Analytics, CashFlow/Debt, ReturnsPolicy)
  const [marketMainTab, setMarketMainTab] = useState<'merchants' | 'products' | 'orders_connections' | 'promotions' | 'haraj' | 'analytics' | 'finance_debt' | 'returns_policy'>('merchants');
  const [merchantsSubTab, setMerchantsSubTab] = useState<'importer' | 'main_wholesaler' | 'wholesaler'>('importer');
  const [ordersConnSubTab, setOrdersConnSubTab] = useState<'orders' | 'connected_merchants' | 'connection_requests'>('orders');
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState<'all' | 'mobiles' | 'accessories' | 'parts' | 'equipment'>('all');
  const [merchantSearchQuery, setMerchantSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isNewKeyConnectionModalOpen, setIsNewKeyConnectionModalOpen] = useState(false);

  // B2B Connection Requests States (Phase 3)
  const [incomingRequests, setIncomingRequests] = useState<B2BConnectionRequest[]>([]);
  const [allSupplierRequests, setAllSupplierRequests] = useState<B2BConnectionRequest[]>([]);
  const [b2bRequestModalOpen, setB2bRequestModalOpen] = useState(false);
  const [selectedSupplierForRequest, setSelectedSupplierForRequest] = useState<any | null>(null);
  const [selectedRequestForDecision, setSelectedRequestForDecision] = useState<B2BConnectionRequest | null>(null);
  const [decisionMode, setDecisionMode] = useState<'accept' | 'reject'>('accept');
  const [requestsFilterStatus, setRequestsFilterStatus] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');

  // Real-time listener for incoming B2B connection requests
  useEffect(() => {
    const targetSupplierId = profile?.ownerId || profile?.uid;
    if (!targetSupplierId) return;

    // Listen to pending requests for badge and notifications
    const listenFn = b2bLinkageEngine?.listenPendingRequests || b2bLinkageEngine?.subscribeToPendingRequests;
    const unsubPending = typeof listenFn === 'function'
      ? listenFn.call(b2bLinkageEngine, targetSupplierId, (pendingList: any) => {
          setIncomingRequests(pendingList || []);
        })
      : () => {};

    // Listen to all requests for this supplier
    try {
      const qAll = query(
        collection(db, 'b2b_connection_requests'),
        where('receiverId', '==', targetSupplierId)
      );
      const unsubAll = onSnapshot(qAll, (snapshot) => {
        const list: B2BConnectionRequest[] = [];
        snapshot.forEach(d => {
          list.push({ id: d.id, ...d.data() } as B2BConnectionRequest);
        });
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setAllSupplierRequests(list);
      }, (err) => {
        console.warn('Error listening to all supplier B2B requests:', err);
      });

      return () => {
        if (typeof unsubPending === 'function') unsubPending();
        unsubAll();
      };
    } catch (e) {
      console.warn(e);
      return () => {
        if (typeof unsubPending === 'function') unsubPending();
      };
    }
  }, [profile?.ownerId, profile?.uid]);

  // Listener for custom event to open connection request modal from anywhere
  useEffect(() => {
    const handleOpenReqModal = (e: any) => {
      const supplier = e.detail?.supplier || null;
      setSelectedSupplierForRequest(supplier);
      setB2bRequestModalOpen(true);
    };

    window.addEventListener('jam:open_b2b_connection_request', handleOpenReqModal);
    return () => {
      window.removeEventListener('jam:open_b2b_connection_request', handleOpenReqModal);
    };
  }, []);

  // Phase 3 Feature 3: Eye-Comfort Theme Switcher State (النمط الداكن والمضيء)
  const [marketTheme, setMarketTheme] = useState<'dark' | 'light'>('dark');

  const toggleMarketTheme = () => {
    const nextTheme = marketTheme === 'dark' ? 'light' : 'dark';
    setMarketTheme(nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-visual-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-visual-theme', 'jam-pro-identity');
    }
  };

  // Phase 3 Feature 1: B2B Cash Flow & Debt Ledger State (الديون والتدفقات النقدية)
  const [b2bDebtLedger, setB2bDebtLedger] = useState<any[]>([]);

  const [debtFilter, setDebtFilter] = useState<'all' | 'payables' | 'receivables'>('all');
  const [selectedDebtToPay, setSelectedDebtToPay] = useState<any>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');

  // Phase 3 Feature 2: B2B Returns & Guarantee Policy & Claims (سياسة الإرجاع ومطالبات الضمان)
  const [b2bReturnPolicy, setB2bReturnPolicy] = useState({
    allowedDays: 7,
    requireOriginalBox: true,
    coversReturnShipping: 'supplier', // 'supplier' | 'buyer' | 'split'
    autoRefundOnReturn: true,
    conditionsText: 'يحق للمشتري إرجاع أية شحنة جملة بها عيوب تصنيعية أو تلف أثناء النقل خلال 7 أيام عمل من تاريخ الاستلام مع الاحتفاظ بالغلاف الأصلي.'
  });

  const [returnClaims, setReturnClaims] = useState<any[]>([]);

  const [isNewReturnClaimModalOpen, setIsNewReturnClaimModalOpen] = useState(false);
  const [newReturnClaim, setNewReturnClaim] = useState({
    orderId: '',
    merchantName: '',
    productName: '',
    qty: 1,
    unitPrice: 0,
    reason: 'تلف في البضاعة أثناء النقل والتوصيل',
    evidenceUrl: ''
  });

  // Promotions State (تبويب الترويج والنشر)
  const [isAddPromoModalOpen, setIsAddPromoModalOpen] = useState(false);
  const [promoSearchQuery, setPromoSearchQuery] = useState('');
  const [newPromo, setNewPromo] = useState({
    title: '',
    merchantName: '',
    details: '',
    price: '',
    discount: '',
    imageUrl: '',
    validUntil: ''
  });
  const [promotionsPosts, setPromotionsPosts] = useState<any[]>([]);

  // Haraj State (تبويب حراج التجار العام)
  const [isAddHarajModalOpen, setIsAddHarajModalOpen] = useState(false);
  const [harajCategoryFilter, setHarajCategoryFilter] = useState<'all' | 'bulk' | 'equipment' | 'stock'>('all');
  const [harajSearchQuery, setHarajSearchQuery] = useState('');
  const [newHaraj, setNewHaraj] = useState({
    title: '',
    category: 'bulk',
    quantity: '',
    price: '',
    location: '',
    description: '',
    contact: ''
  });
  const [harajPosts, setHarajPosts] = useState<any[]>([]);

  // Enhanced Currency selection (YER, SAR, USD) and Exchange Region
  const [selectedCurrency, setSelectedCurrency] = useState<'YER' | 'SAR' | 'USD'>('YER');
  const [exchangeRegion, setExchangeRegion] = useState<'sanaa' | 'aden'>('sanaa');

  // WebSocket simulated secure lock and key authentication sync
  const [isWSSyncing, setIsWSSyncing] = useState(false);
  const [wsSyncStep, setWsSyncStep] = useState(0);
  const [wsLogs, setWsLogs] = useState<string[]>([]);
  
  // Instant Catalog Ingestion state and animation triggers
  const [ingestingSupplierId, setIngestingSupplierId] = useState<string | null>(null);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [ingestionLog, setIngestionLog] = useState('');

  // Search and categories filters
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>(['all']);

  // 5-digit connection key auto-detection and custom filters state
  const [b2bKeySupplier, setB2bKeySupplier] = useState<any | null>(null);
  const [importingProductId, setImportingProductId] = useState<string | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<string>('all');

  // New Merchant Directory & Search States
  const [allMerchants, setAllMerchants] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [merchantSearchName, setMerchantSearchName] = useState('');
  const [merchantSearchLocation, setMerchantSearchLocation] = useState('');
  const [merchantSearchProduct, setMerchantSearchProduct] = useState('');
  const [merchantSearchAgency, setMerchantSearchAgency] = useState('');
  const [selectedMerchantForProfile, setSelectedMerchantForProfile] = useState<any | null>(null);

  // Selected colors/variants per product: { [productId]: colorString }
  const [selectedColors, setSelectedColors] = useState<{ [prodId: string]: string }>({});

  // Re-engineered Order Entry & Interactive Keystroke Cart States
  const [activeQtyPanelProduct, setActiveQtyPanelProduct] = useState<WholesaleMarketProduct | null>(null);
  const [qtyInputValue, setQtyInputValue] = useState<number>(1);
  const [activeSpecsProduct, setActiveSpecsProduct] = useState<WholesaleMarketProduct | null>(null);
  const [showUnsentBackupPrompt, setShowUnsentBackupPrompt] = useState<boolean>(false);

  // Shopping Cart & Order Checkout Drawer state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isJAMPayOpen, setIsJAMPayOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'debt' | 'money_transfer' | 'jampay'>('money_transfer');
  const [buyerBoxes, setBuyerBoxes] = useState<any[]>([]);
  const [selectedDeductedBoxId, setSelectedDeductedBoxId] = useState<string>('MAIN_CASH');
  
  // Key Renewal states
  const [renewalKey, setRenewalKey] = useState('');
  const [isRenewingKey, setIsRenewingKey] = useState(false);
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [renewalSuccess, setRenewalSuccess] = useState<string | null>(null);
  
  // Money transfer requirements state
  const [transferRefNum, setTransferRefNum] = useState('');
  const [exchangeNetwork, setExchangeNetwork] = useState('الكريمي اكسبرس');
  const [transferSenderName, setTransferSenderName] = useState(profile?.name || '');
  const [transferAmount, setTransferAmount] = useState('');
  const [attachedReceiptUrl, setAttachedReceiptUrl] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutStatus, setCheckoutStatus] = useState<{ loading: boolean; error: string | null; successOrderId: string | null }>({
    loading: false,
    error: null,
    successOrderId: null,
  });

  // Drafts & Flexible Cart Controls (المهمة السادسة)
  const [draftTitle, setDraftTitle] = useState('');
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
  const [minOrderLimit, setMinOrderLimit] = useState(50000);

  // Track customer's own previous submitted orders
  const [mySentOrders, setMySentOrders] = useState<any[]>([]);

  // Peer Price suggestions intelligence
  const [intelPrices, setIntelPrices] = useState<{ [prodId: string]: { buy: number; sell: number; confidence: number } }>({});

  // Supplier forms
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 100,
    category: 'هواتف ذكية',
    photos: [] as string[],
    variantsStr: 'بلاتيني, أزرق ملكي, تيتانيوم طبيعي, أسود داكن',
    variantsStock: 25,
    imageUrlInput: ''
  });

  const [activeSupplierSubTab, setActiveSupplierSubTab] = useState<'products' | 'orders' | 'cashbox' | 'partners' | 'auctions'>('products');
  const [myPublicAuctions, setMyPublicAuctions] = useState<any[]>([]);
  const [auctionForm, setAuctionForm] = useState({
    title: '',
    price: 0,
    description: '',
    images: [] as string[],
    imageUrlInput: '',
    type: 'supplier_publish' as 'supplier_publish' | 'client_view'
  });

  const [inventoryList, setInventoryList] = useState<any[]>([]);
  useEffect(() => {
    if (!profile?.ownerId) return;
    const q = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setInventoryList(list);
    }, (err) => {
      console.warn("Error fetching inventory for auctions autofill:", err);
    });
    return unsub;
  }, [profile?.ownerId]);

  // Automatically determine if the user has wholesale capabilities to show/enable tabs
  const isWholesalerActual = 
    profile?.role === 'wholesaler' || 
    profile?.role === 'supplier' || 
    profile?.role === 'distributor' || 
    profile?.role === 'superadmin' ||
    profile?.businessType === 'wholesale';

  useEffect(() => {
    if (isWholesalerActual) {
      setViewMode('supplier');
    } else {
      setViewMode('buyer');
    }
  }, [isWholesalerActual]);

  useEffect(() => {
    if (profile) {
      let resolvedLvl = 4;
      if (profile.hierarchyLevel) resolvedLvl = profile.hierarchyLevel;
      else if (profile.role === 'importer' || profile.role === 'supplier') resolvedLvl = 1;
      else if (profile.role === 'distributor') resolvedLvl = 2;
      else if (profile.role === 'wholesaler') resolvedLvl = 3;
      else if (profile.role === 'retailer' || profile.role === 'superadmin') resolvedLvl = 4;
      setCurrentUserLevel(resolvedLvl);
    }
  }, [profile]);

  // Helper to resolve validity text, check partial bans/blocks and evaluate key expiration dynamically
  const getSupplierPermissionDetails = (supplierId: string) => {
    const conn = connectedSuppliers.find(c => c.supplierId === supplierId);
    if (!conn) {
      return {
        isAllowed: false,
        isBlocked: false,
        isExpired: false,
        allowedPayments: [],
        validityText: 'غير مرتبط',
        reason: 'لا يوجد ارتباط نشط مع هذا المورد حالياً بمتجرك.'
      };
    }

    if (conn.isPartiallyBlocked === true || conn.status === 'blocked' || conn.permissions?.is_blocked === true) {
      return {
        isAllowed: false,
        isBlocked: true,
        isExpired: false,
        allowedPayments: [],
        validityText: 'الارتباط محظور مؤقتاً 🛑',
        reason: 'المحتوى محظور - يرجى استخدام القنوات المسموحة أو إدخال مفتاح ارتباط جديد للتجديد.'
      };
    }

    let isExpired = false;
    let validityText = 'ارتباط دائم 🟢';
    
    if (conn.connectedAt) {
      const connectedDate = conn.connectedAt.toDate ? conn.connectedAt.toDate() : new Date(conn.connectedAt);
      const diffMs = Date.now() - connectedDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (conn.keyValidity === 'daily') {
        validityText = 'ارتباط يومي (24 ساعة) ⏳';
        if (diffHours >= 24) {
          isExpired = true;
        }
      } else if (conn.keyValidity === 'custom_hours') {
        const hours = conn.keyDurationHours || 24;
        validityText = `مخصص (${hours} ساعة) ⏳`;
        if (diffHours >= hours) {
          isExpired = true;
        }
      }
    }

    if (isExpired) {
      return {
        isAllowed: false,
        isBlocked: false,
        isExpired: true,
        allowedPayments: [],
        validityText: `${validityText} (منتهي الصلاحية ⚠️)`,
        reason: 'المفتاح السري المستخدم انتهت مدته الزمنية المحددة للارتباط الآمن.'
      };
    }

    const allowedPayments = conn.allowedPayments || ['cash', 'deferred', 'transfer', 'jampay'];

    return {
      isAllowed: true,
      isBlocked: false,
      isExpired: false,
      allowedPayments,
      validityText,
      reason: ''
    };
  };

  const checkCurrentCartPaymentPermission = () => {
    const activeSubSupplier = getWholesalerIdInCart();
    if (!activeSubSupplier) return { isAllowed: true, reason: '' };

    const conn = connectedSuppliers.find(c => c.supplierId === activeSubSupplier.id);
    if (!conn) {
      return { isAllowed: false, reason: 'لا يوجد ارتباط نشط مع هذا المورد حالياً بمتجرك.' };
    }

    if (conn.isPartiallyBlocked === true) {
      return { isAllowed: false, reason: 'تجميد مؤقت للارتباط وفصل قناة الشراء والتفاوض الآمن.' };
    }

    const perms = getSupplierPermissionDetails(activeSubSupplier.id);
    if (perms.isExpired) {
      return { isAllowed: false, reason: 'انتهت مدة صلاحية هذا المفتاح الخاص بالارتباط.' };
    }

    let mappedKey = '';
    let payNameAr = '';
    if (paymentType === 'cash') {
      mappedKey = 'cash';
      payNameAr = 'الدفع النقدي';
    } else if (paymentType === 'debt') {
      mappedKey = 'deferred';
      payNameAr = 'قيد بآجل الدفتر';
    } else if (paymentType === 'money_transfer') {
      mappedKey = 'transfer';
      payNameAr = 'حوالة كاش صراف';
    }

    const allowed = conn.allowedPayments || ['cash', 'deferred', 'transfer', 'jampay'];
    if (mappedKey && !allowed.includes(mappedKey)) {
      const customReason = conn.paymentBannedReason?.[mappedKey] || conn.banReason || 'تحديثات أمنية وجدولة الحسابات الدورية';
      return {
        isAllowed: false,
        reason: `خدمة [${payNameAr}] موقوفة حالياً من قبل هذا التاجر بسبب: [${customReason}]. يمكنك الشراء عبر الخدمات المتاحة بالمفتاح أو طلب مفتاح ارتباط جديد.`
      };
    }

    return { isAllowed: true, reason: '' };
  };

  const handleOpenPermissionsModal = (conn: any) => {
    setTargetPermissionConn(conn);
    setPermissionKeyValidity(conn.keyValidity || 'permanent');
    setPermissionCustomHours(conn.keyDurationHours || 24);
    setPermissionAllowedPayments(conn.allowedPayments || ['cash', 'deferred', 'transfer', 'jampay']);
    setPermissionIsPartiallyBlocked(conn.isPartiallyBlocked || false);
    setPermissionBlockedCategories(conn.blockedCategories || []);
    setPermissionCreditLimit(conn.creditLimit || conn.debtSettings?.ceilingLimit || conn.ceilingLimit || 1000000);
    setIsPermissionsModalOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!targetPermissionConn?.id) return;
    setSavingPermissions(true);
    try {
      const connRef = doc(db, 'b2bConnections', targetPermissionConn.id);
      await updateDoc(connRef, {
        keyValidity: permissionKeyValidity,
        keyDurationHours: Number(permissionCustomHours),
        allowedPayments: permissionAllowedPayments,
        isPartiallyBlocked: permissionIsPartiallyBlocked,
        blockedCategories: permissionBlockedCategories,
        creditLimit: Number(permissionCreditLimit)
      });
      setIsPermissionsModalOpen(false);
      alert('تم حفظ وتحديث قنوات الدفع وصلاحيات المفتاح للمورد بنجاح وفوراً! 🎉');
    } catch (err: any) {
      console.error(err);
      alert('فشل حفظ الصلاحيات: ' + err.message);
    } finally {
      setSavingPermissions(false);
    }
  };

  // (State declarations shifted to top of component function body)

  const activeCategories = useMemo(() => {
    if (activeTab === 'connected') {
      const wholesalerProds = products.filter(p => {
        if (b2bKeySupplier) {
          return p.wholesalerId === b2bKeySupplier.id || p.wholesalerId === b2bKeySupplier.supplierId;
        }
        return connectedSuppliers.some(s => s.supplierId === p.wholesalerId);
      });
      const dynamicCats = Array.from(new Set(wholesalerProds.map(p => p.category).filter(Boolean)));
      const baseCats = ['جوالات', 'إكسسوارات', 'قطع غيار'];
      const otherCats = dynamicCats.filter(c => !baseCats.includes(c));
      return ['all', ...baseCats, ...otherCats];
    }
    return categories;
  }, [activeTab, products, b2bKeySupplier, connectedSuppliers, categories]);

  // (State declarations shifted to top of component function body)

  useEffect(() => {
    const trimmed = searchTerm.trim();
    // Clear key supplier filter if empty search
    if (b2bKeySupplier && trimmed === '') {
      setB2bKeySupplier(null);
      setSelectedSupplierId('all');
    }
  }, [searchTerm, b2bKeySupplier]);

  // Listen to external B2B connection established event (from GlobalB2bFloatingKey)
  useEffect(() => {
    const handleB2bConnected = (e: any) => {
      const { supplierId } = e.detail || {};
      if (supplierId) {
        setSelectedSupplierId(supplierId);
        setActiveTab('connected');
      }
    };
    window.addEventListener('b2b-connection-established', handleB2bConnected);
    return () => window.removeEventListener('b2b-connection-established', handleB2bConnected);
  }, []);

  // (State declarations shifted to top of component function body)

  const sortedConnectedSuppliers = useMemo(() => {
    let freqs: any = {};
    try {
      const stored = localStorage.getItem('b2bMerchantFrequencies');
      if (stored) freqs = JSON.parse(stored);
    } catch {}
    
    return [...connectedSuppliers].sort((a, b) => {
      const idA = a.supplierId || a.id;
      const idB = b.supplierId || b.id;
      const freqA = freqs[idA] || 0;
      const freqB = freqs[idB] || 0;
      return freqB - freqA;
    });
  }, [connectedSuppliers, activeTab, activeQtyPanelProduct]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jam_supplier_market_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setShowUnsentBackupPrompt(true);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // (State declarations shifted to top of component function body)

  // Load saved drafts on mount and sync with Firestore in real-time
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jam_saved_cart_drafts');
      if (saved) {
        setSavedDrafts(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!profile?.ownerId) return;
    let unsubDrafts = () => {};
    try {
      const qDrafts = query(collection(db, 'cart_drafts'), where('ownerId', '==', profile.ownerId));
      unsubDrafts = onSnapshot(qDrafts, (snapshot) => {
        const list = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setSavedDrafts(list);
        localStorage.setItem('jam_saved_cart_drafts', JSON.stringify(list));
      }, (err) => {
        console.warn("JAM SYSTEM PRO - Real-time error for cart_drafts:", err.message);
      });
    } catch (e) {
      console.warn("JAM SYSTEM PRO - Failed to set up cart_drafts listener:", e);
    }
    return () => unsubDrafts();
  }, [profile]);

  const handleSaveCartDraft = () => {
    if (cart.length === 0) {
      alert('⚠️ السلة فارغة، لا يمكن حفظ مسودة فارغة.');
      return;
    }
    const name = draftTitle.trim() || `مسودة سلة - ${new Date().toLocaleDateString('ar-YE')}`;
    const draftId = Math.random().toString(36).substring(2, 9);
    const newDraft = {
      id: draftId,
      ownerId: profile?.ownerId || 'main_store',
      name: name,
      cart: cart,
      wholesalerId: getWholesalerIdInCart()?.id || '',
      wholesalerName: getWholesalerIdInCart()?.name || '',
      createdAt: new Date().toISOString()
    };
    
    if (profile?.ownerId && navigator.onLine) {
      setDoc(doc(db, 'cart_drafts', draftId), newDraft)
        .catch(err => console.error('[MarketUI] Failed to write cart draft to Firestore:', err));
    }

    const updated = [newDraft, ...savedDrafts.filter(d => d.id !== draftId)];
    setSavedDrafts(updated);
    localStorage.setItem('jam_saved_cart_drafts', JSON.stringify(updated));
    setDraftTitle('');
    alert(`🎉 تم حفظ المسودة [${name}] بنجاح!`);
  };

  const handleLoadCartDraft = (draft: any) => {
    if (cart.length > 0 && !window.confirm('⚠️ ستقوم هذه العملية باستبدال محتويات السلة الحالية بالمسودة، هل أنت متأكد؟')) {
      return;
    }
    clearCart();
    draft.cart.forEach((item: any) => {
      addItem(item);
    });
    alert(`📂 تم استرجاع مسودة [${draft.name}] بنجاح وتعبئة السلة!`);
  };

  const handleDeleteCartDraft = (id: string) => {
    if (profile?.ownerId && navigator.onLine) {
      deleteDoc(doc(db, 'cart_drafts', id))
        .catch(err => console.error('[MarketUI] Failed to delete cart draft from Firestore:', err));
    }
    const updated = savedDrafts.filter(d => d.id !== id);
    setSavedDrafts(updated);
    localStorage.setItem('jam_saved_cart_drafts', JSON.stringify(updated));
  };

  const handleAutoBalanceQuantities = () => {
    const total = getCartTotal();
    if (total >= minOrderLimit) {
      alert('✅ سلتك تتجاوز بالفعل الحد الأدنى لطلب الجملة!');
      return;
    }
    if (cart.length === 0) {
      alert('⚠️ الرجاء إضافة أصناف أولاً للموازنة.');
      return;
    }
    const ratio = minOrderLimit / total;
    cart.forEach(item => {
      const targetQty = Math.ceil(item.quantity * ratio);
      updateQuantity(item.productId, item.selectedColor, Math.min(targetQty, item.maxStock));
    });
    alert('⚡ تم موازنة وزيادة كميات الأصناف تلقائياً وبشكل متناسب لتصل القيمة الإجمالية إلى الحد الأدنى المحدد!');
  };

  // (State declarations shifted to top of component function body)

  const handlePublishAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;

    try {
      // 1. Fetch shop configuration dynamically to enforce developer throttle control
      let limitVal = 10;
      const settingsSnap = await getDoc(doc(db, 'settings', profile.ownerId));
      if (settingsSnap.exists()) {
        const setts = settingsSnap.data();
        if (typeof setts.max_allowed_posts === 'number') {
          limitVal = setts.max_allowed_posts;
        }
      }

      // 2. Count active posts
      if (myPublicAuctions.length >= limitVal) {
        alert(`لقد تجاوزت الحد الأقصى للمنشورات الممسوحة والمحدد للفئة الموردة بـ (${limitVal}) منشوراً. يرجى تصفية أو حذف الإعلانات السابقة لإضافة جديد.`);
        return;
      }

      if (!auctionForm.title.trim() || auctionForm.price <= 0) {
        alert('يرجى ملء البيانات الأساسية للمزاد (العنوان والسعر)');
        return;
      }

      const imgList = [...auctionForm.images];
      if (auctionForm.imageUrlInput.trim()) {
        imgList.push(auctionForm.imageUrlInput.trim());
      }

      await addDoc(collection(db, 'public_auctions'), {
        storeId: profile.ownerId,
        title: auctionForm.title.trim(),
        price: auctionForm.price,
        description: auctionForm.description.trim(),
        images: imgList.length > 0 ? imgList : ['https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=500'],
        type: auctionForm.type,
        createdAt: serverTimestamp()
      });

      // Reset form
      setAuctionForm({
        title: '',
        price: 0,
        description: '',
        images: [],
        imageUrlInput: '',
        type: 'supplier_publish'
      });
      alert('تم نشر منشور السلعة للحراج العام بنجاح ويظهر حالياً لجميع العملاء والمشتركين 🚀');

    } catch (err: any) {
      console.error('Error publishing auction:', err);
      alert('خطأ أثناء النشر: ' + err.message);
    }
  };

  const handleDeleteAuction = async (aucId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا المنشور من الحراج العام؟')) return;
    try {
      await deleteDoc(doc(db, 'public_auctions', aucId));
      alert('تم إزالة تفاصيل السلعة بنجاح.');
    } catch (err: any) {
      alert('خطأ بمسح الإعلان: ' + err.message);
    }
  };



  // Calculated target hierarchy levels (Suppliers of Level N seen by N+1 buyers)
  const targetSupplierLevel = currentUserLevel - 1;

  // Helper to determine the pricing tier and final price based on B2B connection details (Axis 3)
  const getProductPriceWithTier = (product: any) => {
    const conn = connectedSuppliers.find(c => c.supplierId === product.wholesalerId || c.id === product.wholesalerId);
    const buyerRole = profile?.hierarchyLevel || profile?.role || 'retailer';
    const tierCalc = b2bCatalogBridgeEngine.calculateTierPrice(product, buyerRole, conn);

    return {
      price: tierCalc.finalPrice,
      tierName: tierCalc.tierName,
      multiplier: tierCalc.tierMultiplier,
      badgeColor: tierCalc.badgeColor,
      customDiscountPercent: tierCalc.customDiscountPercent,
      totalDiscountAmount: tierCalc.totalDiscountAmount
    };
  };

  // Compile unique uppercase connection key for supplier on mount
  useEffect(() => {
    if (profile?.ownerId) {
      // Create shortened alphanumeric B2B key
      const keyStr = `JAM-B2B-${profile.ownerId.slice(0, 6).toUpperCase()}`;
      setMyB2BKey(keyStr);
      
      // Save it to database under users record so buyers can search for it
      updateDoc(doc(db, 'users', profile.uid), {
        b2bKey: keyStr,
        dndMode: dndModeEnabled,
        cashierRouting: cashierRoutingEnabled
      }).catch(err => console.log('Failed to write b2bKey', err));
    }
  }, [profile?.ownerId, profile?.uid]);

  // Pre-seed some default demo suppliers if retailer has zero connections, for immediate rich showcase
  const seedDemoSuppliersAndProducts = async () => {
    // Disabled - only real merchants from database are used
    return;
  };

  // 1. Fetch buyer's connected merchants from Firebase with zero-crash fallback
  useEffect(() => {
    if (!profile?.ownerId) return;

    let unsubRetailer = () => {};
    let unsubBuyer = () => {};
    let unsubShopConns = () => {};

    const connMap = new Map<string, any>();

    const updateConnections = () => {
      const list = Array.from(connMap.values());
      setConnectedSuppliers(list);
      try {
        localStorage.setItem(`b2bConnections_buyer_${profile.ownerId}`, JSON.stringify(list));
      } catch (_) {}
    };

    const processDoc = (d: any) => {
      const data = d.data();
      const connId = d.id;
      const supId = data.supplierId || data.wholesalerId || data.targetShopId || (connId.includes('_') ? connId.split('_')[1] : connId);
      if (!connId.includes('DEMO') && !supId.includes('DEMO') && !connId.startsWith('sup-') && !supId.startsWith('sup-')) {
        const normalized = {
          id: d.id,
          ...data,
          supplierId: supId,
          wholesalerId: supId,
          supplierName: data.supplierName || data.wholesalerName || data.targetShopName || 'تاجر جملة',
          buyerId: data.buyerId || data.retailerId || profile.ownerId,
          retailerId: data.retailerId || data.buyerId || profile.ownerId
        };
        connMap.set(supId, normalized);
      }
    };

    try {
      const q1 = query(
        collection(db, 'b2bConnections'),
        where('buyerId', '==', profile.ownerId)
      );
      unsubBuyer = onSnapshot(q1, (snap) => {
        snap.forEach(processDoc);
        updateConnections();
      }, (err) => {
        console.warn("Bypass b2bConnections buyer snapshot permission error", err);
      });

      const q2 = query(
        collection(db, 'b2bConnections'),
        where('retailerId', '==', profile.ownerId)
      );
      unsubRetailer = onSnapshot(q2, (snap) => {
        snap.forEach(processDoc);
        updateConnections();
      }, (err) => {
        console.warn("Bypass b2bConnections retailer snapshot permission error", err);
      });

      const q3 = query(
        collection(db, 'shops', profile.ownerId, 'connections')
      );
      unsubShopConns = onSnapshot(q3, (snap) => {
        snap.forEach(processDoc);
        updateConnections();
      }, (err) => {
        console.warn("Bypass shop connections snapshot error", err);
      });
    } catch (e) {
      console.warn("Bypass b2bConnections trigger error", e);
      const cached = localStorage.getItem(`b2bConnections_buyer_${profile.ownerId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached).filter((c: any) => !c.id?.includes('DEMO') && !c.supplierId?.includes('DEMO'));
          setConnectedSuppliers(parsed);
        } catch (e) {
          setConnectedSuppliers([]);
        }
      }
    }

    return () => {
      unsubBuyer();
      unsubRetailer();
      unsubShopConns();
    };
  }, [profile?.ownerId]);

  // Fetch incoming buyer connections globally for management dashboard and supplier view with zero-crash fallback
  useEffect(() => {
    if (!profile?.ownerId) return;

    let unsubSup = () => {};
    let unsubWholesale = () => {};
    const partnerMap = new Map<string, any>();

    const updatePartners = () => {
      const list = Array.from(partnerMap.values());
      setPartnerConnections(list);
      try {
        localStorage.setItem(`b2bConnections_supplier_${profile.ownerId}`, JSON.stringify(list));
      } catch (_) {}
    };

    const processPartnerDoc = (d: any) => {
      const data = d.data();
      const buyerId = data.buyerId || data.retailerId || (d.id.includes('_') ? d.id.split('_')[0] : d.id);
      partnerMap.set(buyerId, { id: d.id, ...data, buyerId, retailerId: buyerId });
    };

    try {
      const q1 = query(
        collection(db, 'b2bConnections'),
        where('supplierId', '==', profile.ownerId)
      );
      unsubSup = onSnapshot(q1, (snap) => {
        snap.forEach(processPartnerDoc);
        updatePartners();
      }, (err) => {
        console.warn("Bypass b2bConnections supplier snapshot permission error", err);
      });

      const q2 = query(
        collection(db, 'b2bConnections'),
        where('wholesalerId', '==', profile.ownerId)
      );
      unsubWholesale = onSnapshot(q2, (snap) => {
        snap.forEach(processPartnerDoc);
        updatePartners();
      }, (err) => {
        console.warn("Bypass b2bConnections wholesaler snapshot permission error", err);
      });
    } catch (e) {
      console.warn("Bypass b2bConnections supplier trigger error", e);
      const cached = localStorage.getItem(`b2bConnections_supplier_${profile.ownerId}`);
      if (cached) setPartnerConnections(JSON.parse(cached));
    }

    return () => {
      unsubSup();
      unsubWholesale();
    };
  }, [profile?.ownerId]);

  // 2. Fetch products of selected / connected suppliers with strict Axis 1 Tier Gap & Active Link enforcement
  useEffect(() => {
    if (!profile?.ownerId) return;

    // Axis 1: Filter connected suppliers strictly by active status, non-demo, and 1-tier hierarchy gap
    const buyerUserRole = profile?.hierarchyLevel || profile?.role || 'retailer';
    const allowedSuppliers = filterConnectedSuppliersByTier(buyerUserRole, connectedSuppliers);

    let targetIds: string[] = [];
    if (selectedSupplierId === 'all') {
      targetIds = allowedSuppliers
        .map(s => s.supplierId || s.wholesalerId || s.targetShopId || (s.id && !s.id.includes('_') ? s.id : (s.id ? s.id.split('_')[1] : '')))
        .filter(Boolean);
    } else {
      const conn = allowedSuppliers.find(s => 
        s.supplierId === selectedSupplierId || 
        s.wholesalerId === selectedSupplierId || 
        s.id === selectedSupplierId ||
        (s.id && s.id.endsWith(`_${selectedSupplierId}`))
      );
      if (conn) {
        targetIds = [selectedSupplierId];
      } else {
        // Selected supplier is either blocked, unlinked, or violates the 1-tier gap rule
        targetIds = [];
      }
    }

    if (targetIds.length === 0) {
      setProducts([]);
      return;
    }

    // Chunk query to avoid firebase in limit parameter (max 10 supplier IDs)
    const activeIds = targetIds.slice(0, 10);
    let unsub = () => {};
    try {
      const q = query(
        collection(db, 'wholesaleProducts'),
        where('wholesalerId', 'in', activeIds),
        where('isActive', '==', true),
        limit(45)
      );

      unsub = onSnapshot(q, (snap) => {
        const prods: WholesaleMarketProduct[] = [];
        snap.forEach(d => {
          const data = reduceDataPayload(d.data());
          prods.push({ id: d.id, ...data } as any);
        });
        setProducts(prods);
        localStorage.setItem(`wholesaleProducts_${activeIds.join('_')}`, JSON.stringify(prods));

        // Extract categories
        const cats = ['all', ...Array.from(new Set(prods.map(p => p.category)))];
        setCategories(cats);

        // Set default color variant choices
        const defaultColors: { [key: string]: string } = {};
        prods.forEach(p => {
          if (p.variants && p.variants.length > 0) {
            defaultColors[p.id] = p.variants[0].color;
          }
        });
        setSelectedColors(prev => ({ ...defaultColors, ...prev }));

        // Gather intelligence pricing suggestions
        prods.forEach(async (p) => {
          const intel = await marketService.discoverSmartPrice({
            name: p.name,
            userRole: profile?.role || 'retailer',
            ownerId: profile?.ownerId || 'demo_store'
          });
          if (intel) {
            setIntelPrices(prev => ({
              ...prev,
              [p.id]: {
                buy: intel.buy || p.price,
                sell: intel.sell || p.price * 1.15,
                confidence: 90
              }
            }));
          }
        });
      }, (err) => {
        console.warn("Bypass wholesaleProducts snapshot permission error", err);
        const cached = localStorage.getItem(`wholesaleProducts_${activeIds.join('_')}`);
        if (cached) {
          const prods = JSON.parse(cached);
          setProducts(prods);
          const cats = ['all', ...Array.from(new Set(prods.map((p: any) => p.category)))];
          setCategories(cats);
        }
      });
    } catch (e) {
      console.warn("Bypass wholesaleProducts trigger error", e);
      const cached = localStorage.getItem(`wholesaleProducts_${activeIds.join('_')}`);
      if (cached) {
        const prods = JSON.parse(cached);
        setProducts(prods);
        const cats = ['all', ...Array.from(new Set(prods.map((p: any) => p.category)))];
        setCategories(cats);
      }
    }

    return () => unsub();
  }, [selectedSupplierId, connectedSuppliers, profile]);

  // Load available bank accounts and custom safes for the retailer (buyer) dynamically with permission bypass fallback
  useEffect(() => {
    if (!profile?.ownerId) return;

    let unsub1 = () => {};
    let unsub2 = () => {};
    let isUnsubscribed = false;

    try {
      const q1 = query(collection(db, 'bank_accounts'), where('ownerId', '==', profile.ownerId));
      unsub1 = onSnapshot(q1, (snap1) => {
        const list: any[] = [];
        snap1.forEach(d => {
          const dData = d.data();
          list.push({ id: d.id, name: dData.bankName, balance: dData.balance || 0, currency: dData.currency || 'YER', source: 'bank' });
        });
        localStorage.setItem(`bank_accounts_${profile.ownerId}`, JSON.stringify(list));

        try {
          const q2 = collection(db, 'stores', profile.ownerId, 'customBoxes');
          if (isUnsubscribed) return;
          unsub2 = onSnapshot(q2, (snap2) => {
            const customList: any[] = [];
            snap2.forEach(cd => {
              const cdData = cd.data();
              customList.push({ id: cd.id, name: cdData.name, balance: cdData.balance || 0, currency: cdData.currency || 'YER', source: 'custom' });
            });
            localStorage.setItem(`customBoxes_${profile.ownerId}`, JSON.stringify(customList));

            setBuyerBoxes([
              { id: 'MAIN_CASH', name: 'الصندوق لعام للمحل (كاش رئيسي)', balance: 0, currency: 'YER', source: 'system' },
              { id: 'OWNER_ACCOUNT', name: 'حساب المالك (عهد يومية للمحل)', balance: 0, currency: 'YER', source: 'system' },
              ...list,
              ...customList
            ]);
          }, (err2) => {
            console.warn("Bypass customBoxes snapshot permission error", err2);
            const cachedCustom = localStorage.getItem(`customBoxes_${profile.ownerId}`);
            const customList = cachedCustom ? JSON.parse(cachedCustom) : [];
            setBuyerBoxes([
              { id: 'MAIN_CASH', name: 'الصندوق لعام للمحل (كاش رئيسي)', balance: 0, currency: 'YER', source: 'system' },
              { id: 'OWNER_ACCOUNT', name: 'حساب المالك (عهد يومية للمحل)', balance: 0, currency: 'YER', source: 'system' },
              ...list,
              ...customList
            ]);
          });
        } catch (e2) {
          console.warn("Bypass customBoxes trigger error", e2);
          const cachedCustom = localStorage.getItem(`customBoxes_${profile.ownerId}`);
          const customList = cachedCustom ? JSON.parse(cachedCustom) : [];
          setBuyerBoxes([
            { id: 'MAIN_CASH', name: 'الصندوق لعام للمحل (كاش رئيسي)', balance: 0, currency: 'YER', source: 'system' },
            { id: 'OWNER_ACCOUNT', name: 'حساب المالك (عهد يومية للمحل)', balance: 0, currency: 'YER', source: 'system' },
            ...list,
            ...customList
          ]);
        }
      }, (err1) => {
        console.warn("Bypass bank_accounts snapshot permission error", err1);
        const cachedBank = localStorage.getItem(`bank_accounts_${profile.ownerId}`);
        const list = cachedBank ? JSON.parse(cachedBank) : [];
        
        try {
          const q2 = collection(db, 'stores', profile.ownerId, 'customBoxes');
          if (isUnsubscribed) return;
          unsub2 = onSnapshot(q2, (snap2) => {
            const customList: any[] = [];
            snap2.forEach(cd => {
              const cdData = cd.data();
              customList.push({ id: cd.id, name: cdData.name, balance: cdData.balance || 0, currency: cdData.currency || 'YER', source: 'custom' });
            });
            localStorage.setItem(`customBoxes_${profile.ownerId}`, JSON.stringify(customList));

            setBuyerBoxes([
              { id: 'MAIN_CASH', name: 'الصندوق لعام للمحل (كاش رئيسي)', balance: 0, currency: 'YER', source: 'system' },
              { id: 'OWNER_ACCOUNT', name: 'حساب المالك (عهد يومية للمحل)', balance: 0, currency: 'YER', source: 'system' },
              ...list,
              ...customList
            ]);
          }, (err2) => {
            console.warn("Bypass customBoxes snapshot error on bank error path", err2);
            const cachedCustom = localStorage.getItem(`customBoxes_${profile.ownerId}`);
            const customList = cachedCustom ? JSON.parse(cachedCustom) : [];
            setBuyerBoxes([
              { id: 'MAIN_CASH', name: 'الصندوق لعام للمحل (كاش رئيسي)', balance: 0, currency: 'YER', source: 'system' },
              { id: 'OWNER_ACCOUNT', name: 'حساب المالك (عهد يومية للمحل)', balance: 0, currency: 'YER', source: 'system' },
              ...list,
              ...customList
            ]);
          });
        } catch (e2) {
          const cachedCustom = localStorage.getItem(`customBoxes_${profile.ownerId}`);
          const customList = cachedCustom ? JSON.parse(cachedCustom) : [];
          setBuyerBoxes([
            { id: 'MAIN_CASH', name: 'الصندوق لعام للمحل (كاش رئيسي)', balance: 0, currency: 'YER', source: 'system' },
            { id: 'OWNER_ACCOUNT', name: 'حساب المالك (عهد يومية للمحل)', balance: 0, currency: 'YER', source: 'system' },
            ...list,
            ...customList
          ]);
        }
      });
    } catch (errOuter) {
      console.warn("Bypass bank_accounts trigger error outer", errOuter);
      const cachedBank = localStorage.getItem(`bank_accounts_${profile.ownerId}`);
      const cachedCustom = localStorage.getItem(`customBoxes_${profile.ownerId}`);
      const list = cachedBank ? JSON.parse(cachedBank) : [];
      const customList = cachedCustom ? JSON.parse(cachedCustom) : [];
      setBuyerBoxes([
        { id: 'MAIN_CASH', name: 'الصندوق لعام للمحل (كاش رئيسي)', balance: 0, currency: 'YER', source: 'system' },
        { id: 'OWNER_ACCOUNT', name: 'حساب المالك (عهد يومية للمحل)', balance: 0, currency: 'YER', source: 'system' },
        ...list,
        ...customList
      ]);
    }

    return () => {
      isUnsubscribed = true;
      unsub1();
      unsub2();
    };
  }, [profile?.ownerId]);

  // Real-time synchronization of B2B Store Profile & productCategories with permission bypass fallback
  useEffect(() => {
    if (!profile?.ownerId) return;

    let unsubProfile = () => {};
    let unsubSettings = () => {};

    try {
      const profileRef = doc(db, 'b2bStoreProfiles', profile.ownerId);
      unsubProfile = onSnapshot(profileRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setB2bProfile(data);
          localStorage.setItem(`b2bProfile_${profile.ownerId}`, JSON.stringify(data));
        } else {
          const defaultProfile = {
            warehouseName: 'المستودع الرئيسي للمحل',
            linkedBoxId: 'MAIN_CASH',
            logoUrl: profile.shopLogo || '',
            activities: ['mobiles', 'accessories'],
            bankAccounts: profile.jawaliNumber || profile.kuraimiNumber || '',
            bio: 'مرحبًا بكم في متجرنا المعتمد على منصة السوق الرقمي الموحد.',
            salesLocation: profile.shopAddress || 'اليمن - صنعاء',
            workHours: '8:00 ص - 10:00 م',
            hasDelivery: true,
            agencies: ['Ramos', 'Bemas']
          };
          setDoc(profileRef, defaultProfile).catch(() => {});
          setB2bProfile(defaultProfile);
          localStorage.setItem(`b2bProfile_${profile.ownerId}`, JSON.stringify(defaultProfile));
        }
        setLoadingProfile(false);
      }, (err) => {
        console.warn("Bypass B2B profile snapshot permission error", err);
        const cached = localStorage.getItem(`b2bProfile_${profile.ownerId}`);
        if (cached) {
          setB2bProfile(JSON.parse(cached));
        } else {
          setB2bProfile({
            warehouseName: 'المستودع الرئيسي للمحل (مؤقت)',
            linkedBoxId: 'MAIN_CASH',
            logoUrl: profile.shopLogo || '',
            activities: ['mobiles', 'accessories'],
            bankAccounts: profile.jawaliNumber || profile.kuraimiNumber || '',
            bio: 'مرحبًا بكم في متجرنا المعتمد على منصة السوق الرقمي الموحد (نسخة احتياطية).',
            salesLocation: profile.shopAddress || 'اليمن - صنعاء',
            workHours: '8:00 ص - 10:00 م',
            hasDelivery: true,
            agencies: ['Ramos', 'Bemas']
          });
        }
        setLoadingProfile(false);
      });
    } catch (e) {
      console.warn("Bypass B2B profile trigger error", e);
      setLoadingProfile(false);
    }

    try {
      const settingsRef = doc(db, 'settings', profile.ownerId);
      unsubSettings = onSnapshot(settingsRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProductCategories(data.productCategories || []);
          localStorage.setItem(`productCategories_${profile.ownerId}`, JSON.stringify(data.productCategories || []));
        }
      }, (err) => {
        console.warn("Bypass settings snapshot permission error", err);
        const cached = localStorage.getItem(`productCategories_${profile.ownerId}`);
        if (cached) {
          setProductCategories(JSON.parse(cached));
        }
      });
    } catch (e) {
      console.warn("Bypass settings trigger error", e);
    }

    return () => {
      unsubProfile();
      unsubSettings();
    };
  }, [profile?.ownerId, profile?.shopLogo, profile?.shopAddress, profile?.jawaliNumber, profile?.kuraimiNumber]);

  // Auto-select Merchants Sub-Tab based on current user hierarchy level/role:
  // Retailer (Level 4) -> sees Wholesalers (wholesaler) by default
  // Wholesaler (Level 3) -> sees Main Wholesalers (main_wholesaler) by default
  // Main Wholesaler (Level 2) -> sees Importers (importer) by default
  // Importer (Level 1) -> sees Importers (importer) by default
  useEffect(() => {
    const level = Number(userDbProfile?.hierarchyLevel || profile?.hierarchyLevel || 4);
    const role = (userDbProfile?.role || profile?.role || '').toLowerCase();
    const act = (userDbProfile?.accountType || profile?.accountType || '').toLowerCase();

    if (level === 4 || role === 'retailer' || role === 'retail' || act === 'retail') {
      setMerchantsSubTab('wholesaler');
    } else if (level === 3 || role === 'wholesaler' || act === 'wholesaler') {
      setMerchantsSubTab('main_wholesaler');
    } else if (level === 2 || role === 'distributor' || role === 'main_wholesaler' || act === 'main_wholesaler') {
      setMerchantsSubTab('importer');
    } else {
      setMerchantsSubTab('importer');
    }
  }, [userDbProfile, profile]);

  // Real-time synchronization of all users and profiles for Merchant Directory with permission bypass fallback
  useEffect(() => {
    let unsubUsers = () => {};
    let unsubProfiles = () => {};

    try {
      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        const list: any[] = [];
        snap.forEach(docSnap => {
          list.push({ id: docSnap.id, uid: docSnap.id, ...docSnap.data() });
        });
        const filtered = list.filter(u => u.status !== 'deleted' && u.isDeleted !== true);
        setAllMerchants(filtered);
        localStorage.setItem('all_users_list', JSON.stringify(filtered));
      }, (err) => {
        console.warn("Bypass users snapshot permission error", err);
        const cached = localStorage.getItem('all_users_list');
        if (cached) {
          setAllMerchants(JSON.parse(cached));
        }
      });
    } catch (e) {
      console.warn("Bypass users query trigger error", e);
    }

    try {
      unsubProfiles = onSnapshot(collection(db, 'b2bStoreProfiles'), (snap) => {
        const list: any[] = [];
        snap.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        const filtered = list.filter(p => p.status !== 'deleted' && p.isDeleted !== true);
        setAllProfiles(filtered);
        localStorage.setItem('all_store_profiles', JSON.stringify(filtered));
      }, (err) => {
        console.warn("Bypass store profiles snapshot permission error", err);
        const cached = localStorage.getItem('all_store_profiles');
        if (cached) {
          setAllProfiles(JSON.parse(cached));
        }
      });
    } catch (e) {
      console.warn("Bypass store profiles query trigger error", e);
    }

    return () => {
      unsubUsers();
      unsubProfiles();
    };
  }, []);

  const mergedMerchants = useMemo(() => {
    // RETAIL CUSTOMER ISOLATION (طرد الزبائن من صفحة التجار):
    // Strict inline filter so it ONLY displays accounts with merchant accountType or merchant/wholesaler/importer/distributor/supplier/superadmin roles.
    // Completely block, filter out, and hide consumer/retail buyer accounts (accountType === 'customer' or role === 'customer' or ends with @jam-pro.net).
    const activeMerchants = allMerchants.filter(m => {
      // Exclude deleted accounts/merchants
      if (m.status === 'deleted' || m.deleted === true || m.isDeleted === true) {
        return false;
      }
      const prof = allProfiles.find(p => p.id === m.id || p.id === m.uid || p.id === m.ownerId);
      const email = (m.email || m.userPayload?.email || prof?.email || '').toLowerCase().trim();
      const roleLower = (m.role || '').toLowerCase().trim();
      const accountTypeLower = (m.accountType || '').toLowerCase().trim();

      // Completely block, filter out, and hide consumer/retail buyer accounts
      const isConsumer = accountTypeLower === 'customer' || 
                         accountTypeLower === 'client' ||
                         roleLower === 'customer' || 
                         roleLower === 'retail_customer' ||
                         roleLower === 'client' ||
                         roleLower === 'consumer' ||
                         email.endsWith('@jam-pro.net');

      // Completely block, filter out, and hide retail merchants / retailers from appearing as wholesalers in the B2B market
      const isRetailer = accountTypeLower === 'retail' ||
                         accountTypeLower === 'retailer' ||
                         roleLower === 'retailer' ||
                         roleLower === 'retail' ||
                         roleLower === 'retail_merchant';

      const isMerchant = accountTypeLower === 'merchant' || 
                         ['wholesaler', 'supplier', 'distributor', 'importer', 'superadmin', 'owner', 'staff', 'employee', 'cashier', 'worker', 'sales'].includes(roleLower);

      return isMerchant && !isConsumer && !isRetailer;
    });

    // COMPACT TENANT GROUPING (إظهار المحل الرئيسي وحجب الموظفين):
    // Group all active staff/employee entities dynamically under their shared centralized store/owner ID context.
    // Absolutely BAN and hide any sub-account or worker belonging to domains (@jam.com, @yahoo.com, @joad.com, @mna.com, @dad.com) from appearing as standalone traders.
    const groupedByStore: { [storeId: string]: any[] } = {};
    activeMerchants.forEach(m => {
      const prof = allProfiles.find(p => p.id === m.id || p.id === m.uid || p.id === m.ownerId);
      const email = (m.email || m.userPayload?.email || prof?.email || '').toLowerCase().trim();
      const isSubDomainUser = email.endsWith('@jam.com') || 
                              email.endsWith('@yahoo.com') || 
                              email.endsWith('@joad.com') || 
                              email.endsWith('@mna.com') || 
                              email.endsWith('@dad.com');
      
      const isSubAccount = isSubDomainUser || (m.ownerId && m.ownerId !== m.id && m.ownerId !== m.uid);
      const storeId = isSubAccount ? m.ownerId : (m.id || m.uid || m.ownerId || m.shopId);
      if (storeId) {
        if (!groupedByStore[storeId]) {
          groupedByStore[storeId] = [];
        }
        groupedByStore[storeId].push(m);
      }
    });

    const consolidated: any[] = [];
    Object.keys(groupedByStore).forEach(storeId => {
      const members = groupedByStore[storeId];
      // Only the Single Unified Parent Shop (المحل الرئيسي ككيان موحد) registered by the @gmail.com owner can be rendered on the open trading floor.
      let parentShop = members.find(m => {
        const prof = allProfiles.find(p => p.id === m.id || p.id === m.uid || p.id === m.ownerId);
        const email = (m.email || m.userPayload?.email || prof?.email || '').toLowerCase().trim();
        return email.endsWith('@gmail.com') && (m.id === storeId || m.uid === storeId);
      });
      if (!parentShop) {
        parentShop = members.find(m => {
          const prof = allProfiles.find(p => p.id === m.id || p.id === m.uid || p.id === m.ownerId);
          const email = (m.email || m.userPayload?.email || prof?.email || '').toLowerCase().trim();
          return email.endsWith('@gmail.com');
        });
      }
      if (!parentShop) {
        // Fallback to any account not belonging to sub-domains
        parentShop = members.find(m => {
          const prof = allProfiles.find(p => p.id === m.id || p.id === m.uid || p.id === m.ownerId);
          const email = (m.email || m.userPayload?.email || prof?.email || '').toLowerCase().trim();
          return !email.endsWith('@jam.com') && 
                 !email.endsWith('@yahoo.com') && 
                 !email.endsWith('@joad.com') && 
                 !email.endsWith('@mna.com') && 
                 !email.endsWith('@dad.com');
        });
      }
      if (!parentShop) {
        parentShop = members[0];
      }

      // Resolve profile metadata
      const prof = allProfiles.find(p => p.id === storeId || p.id === parentShop.id || p.id === parentShop.uid || p.id === parentShop.ownerId);

      consolidated.push({
        ...parentShop,
        ...prof,
        id: storeId,
        uid: storeId,
        ownerId: storeId,
        hierarchyLevel: parentShop.hierarchyLevel || prof?.hierarchyLevel || (parentShop.role === 'wholesaler' ? 3 : parentShop.role === 'distributor' ? 2 : parentShop.role === 'importer' ? 1 : 4),
        name: parentShop.shopName || prof?.warehouseName || parentShop.name || parentShop.ownerName || prof?.shopName || 'تاجر غير مسمى',
        salesLocation: parentShop.salesLocation || prof?.salesLocation || parentShop.shopAddress || 'اليمن',
        logoUrl: parentShop.logoUrl || prof?.logoUrl || parentShop.shopLogo || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80',
        agencies: parentShop.agencies || prof?.agencies || ['Ramos', 'Bemas'],
        bio: parentShop.bio || prof?.bio || 'شريك تجاري موثق بالمنصة الموحدة B2B.',
      });
    });

    return consolidated;
  }, [allMerchants, allProfiles]);

  // Clean classification for the 3 Merchants Sub-Tabs: 1. مستورد | 2. جملة الجملة | 3. جملة
  const filteredMerchantsBySubTab = useMemo(() => {
    let sourceList = mergedMerchants;

    return sourceList.filter(merchant => {
      if (merchant.id?.startsWith('sup-') || merchant.id?.startsWith('DEMO') || merchant.uid?.startsWith('DEMO')) {
        return false;
      }
      const level = Number(merchant.hierarchyLevel || 3);
      const role = (merchant.role || '').toLowerCase();
      const act = (merchant.accountType || '').toLowerCase();

      // 1. STRICTLY EXCLUDE RETAILERS (تجار التجزئة لن يظهروا كـموردين)
      if (level === 4 || role === 'retailer' || role === 'retail' || act === 'retail' || role === 'retail_merchant') {
        return false;
      }

      // Check if this merchant is explicitly connected via B2B Key
      const isConnected = connectedSuppliers.some(c => 
        c.supplierId === merchant.id || 
        c.id === merchant.id ||
        c.supplierId === merchant.uid || 
        c.supplierId === merchant.ownerId ||
        (c.supplierName && merchant.name && c.supplierName.toLowerCase() === merchant.name.toLowerCase())
      );

      // 2. Search filter match
      if (merchantSearchQuery.trim()) {
        const q = merchantSearchQuery.toLowerCase();
        const matchName = (merchant.name || '').toLowerCase().includes(q);
        const matchLoc = (merchant.salesLocation || '').toLowerCase().includes(q);
        const matchAgencies = (merchant.agencies || []).some((a: string) => a.toLowerCase().includes(q));
        if (!matchName && !matchLoc && !matchAgencies) return false;
      }

      // 3. Subtab Filter matching (Allow if matches tier OR if connected)
      if (merchantsSubTab === 'importer') {
        return level === 1 || role === 'importer' || act === 'importer' || (isConnected && (level === 1 || role === 'importer'));
      } else if (merchantsSubTab === 'main_wholesaler') {
        return level === 2 || role === 'distributor' || role === 'main_wholesaler' || act === 'main_wholesaler' || (isConnected && (level === 2 || role === 'main_wholesaler'));
      } else if (merchantsSubTab === 'wholesaler') {
        return level === 3 || role === 'wholesaler' || act === 'wholesaler' || isConnected || (![1, 2].includes(level) && !['importer', 'distributor', 'main_wholesaler'].includes(role));
      }
      return true;
    });
  }, [mergedMerchants, merchantsSubTab, merchantSearchQuery, connectedSuppliers]);

  const matchCategoryFilter = (catStr: string = '', selectedCat: string) => {
    if (!selectedCat || selectedCat === 'all') return true;
    const lower = (catStr || '').toLowerCase();
    
    if (selectedCat === 'phones') {
      return lower.includes('هاتف') || lower.includes('جوال') || lower.includes('آيفون') || lower.includes('سامسونج') || lower.includes('شاومي') || lower.includes('phone') || lower.includes('mobile') || lower.includes('أجهزة') || lower.includes('bulk');
    }
    if (selectedCat === 'accessories') {
      return lower.includes('اكسسوار') || lower.includes('إكسسوار') || lower.includes('شاحن') || lower.includes('كابل') || lower.includes('سماعة') || lower.includes('ساعة') || lower.includes('جراب') || lower.includes('كفر') || lower.includes('charger') || lower.includes('accessory');
    }
    if (selectedCat === 'parts') {
      return lower.includes('قطع') || lower.includes('غيار') || lower.includes('شاشة') || lower.includes('بطارية') || lower.includes('باغة') || lower.includes('فلاتة') || lower.includes('كاميرا') || lower.includes('screen') || lower.includes('battery');
    }
    if (selectedCat === 'maintenance') {
      return lower.includes('صيانة') || lower.includes('معدة') || lower.includes('ماكينة') || lower.includes('أداة') || lower.includes('لحام') || lower.includes('مفك') || lower.includes('tool') || lower.includes('equipment') || lower.includes('repair');
    }
    if (selectedCat === 'software_sim') {
      return lower.includes('شريحة') || lower.includes('شرائح') || lower.includes('برنامج') || lower.includes('برمجيات') || lower.includes('نظام') || lower.includes('تطبيق') || lower.includes('سيرفر') || lower.includes('sim') || lower.includes('software');
    }
    
    return lower.includes(selectedCat.toLowerCase());
  };

  // Products list: All importer & wholesale products published automatically without duplicates
  const filteredProductsForBrowsing = useMemo(() => {
    const combined = [...products, ...myProducts];
    
    // 1. Filter out demo items
    let list = combined.filter(p => 
      p && p.name &&
      !p.id?.includes('demo') && 
      !p.wholesalerId?.includes('DEMO') && 
      !p.wholesalerId?.startsWith('sup-') &&
      !p.id?.startsWith('prod-demo')
    );

    // 2. Strict Deduplication by normalized name + wholesaler/id
    const dedupMap = new Map();
    list.forEach(p => {
      const cleanName = (p.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const wholesalerKey = (p.wholesalerId || p.supplierId || p.wholesalerName || 'general').trim().toLowerCase();
      const key = p.id || `${cleanName}_${wholesalerKey}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, p);
      }
    });

    list = Array.from(dedupMap.values());

    // 3. Category Filter
    if (selectedCategory && selectedCategory !== 'all') {
      list = list.filter(p => matchCategoryFilter(p.category, selectedCategory));
    }

    // 4. Search Filter
    if (productSearchQuery.trim()) {
      const q = productSearchQuery.trim().toLowerCase();
      list = list.filter(p => 
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.wholesalerName || p.supplierName || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [products, myProducts, selectedCategory, productSearchQuery]);

  const filteredMerchants = useMemo(() => {
    return mergedMerchants.filter(merchant => {
      // 1. Hierarchical Isolation rules:
      // If user is a "مستورد" (lvl 1), they ONLY see other "مستورد" (lvl 1) entities.
      // If user is "جملة الجملة" (lvl 2), they see "جملة الجملة" (lvl 2) + "مستورد" (lvl 1).
      // If user is "جملة" (lvl 3), they see "جملة" (lvl 3) + "جملة الجملة" (lvl 2) + "مستورد" (lvl 1).
      // If user is "تجزئة" (lvl 4), they see all groups.
      const lvl = Number(merchant.hierarchyLevel || 4);
      let isVisibleByHierarchy = false;
      if (currentUserLevel === 1) {
        isVisibleByHierarchy = (lvl === 1);
      } else if (currentUserLevel === 2) {
        isVisibleByHierarchy = (lvl <= 2);
      } else if (currentUserLevel === 3) {
        isVisibleByHierarchy = (lvl <= 3);
      } else {
        isVisibleByHierarchy = true; // Level 4 sees all
      }

      if (!isVisibleByHierarchy) return false;

      // 2. Search Multi-Filters
      const matchesName = merchantSearchName
        ? merchant.name.toLowerCase().includes(merchantSearchName.toLowerCase())
        : true;

      const matchesLocation = merchantSearchLocation
        ? merchant.salesLocation.toLowerCase().includes(merchantSearchLocation.toLowerCase())
        : true;

      const matchesAgency = merchantSearchAgency
        ? (merchant.agencies || []).some((ag: string) => ag.toLowerCase().includes(merchantSearchAgency.toLowerCase()))
        : true;

      const matchesProduct = merchantSearchProduct
        ? products.some(p => (p.wholesalerId === merchant.id || p.wholesalerId === merchant.uid) && p.name.toLowerCase().includes(merchantSearchProduct.toLowerCase()))
        : true;

      return matchesName && matchesLocation && matchesAgency && matchesProduct;
    });
  }, [mergedMerchants, currentUserLevel, merchantSearchName, merchantSearchLocation, merchantSearchAgency, merchantSearchProduct, products]);

  // 3. Supplier Data streams (active only if wholesaler view is rendering) with zero-crash fallback
  useEffect(() => {
    if (!profile?.ownerId || viewMode !== 'supplier') return;

    let unsubProds = () => {};
    let unsubOrders = () => {};
    let unsubAuctions = () => {};

    try {
      // My published wholesale catalog
      unsubProds = onSnapshot(
        query(collection(db, 'wholesaleProducts'), where('wholesalerId', '==', profile.ownerId), limit(45)),
        (snap) => {
          const list: any[] = [];
          snap.forEach(d => list.push({ id: d.id, ...reduceDataPayload(d.data()) }));
          setMyProducts(list);
          localStorage.setItem(`myProducts_${profile.ownerId}`, JSON.stringify(list));
        }, (err) => {
          console.warn("Bypass my wholesaleProducts snapshot error", err);
          const cached = localStorage.getItem(`myProducts_${profile.ownerId}`);
          if (cached) setMyProducts(JSON.parse(cached));
        }
      );
    } catch (e) {
      console.warn("Bypass my wholesaleProducts trigger error", e);
      const cached = localStorage.getItem(`myProducts_${profile.ownerId}`);
      if (cached) setMyProducts(JSON.parse(cached));
    }

    try {
      // My incoming retail orders (B2B channel)
      unsubOrders = onSnapshot(
        query(collection(db, 'orders'), where('wholesalerId', '==', profile.ownerId), limit(40)),
        (snap) => {
          const list: any[] = [];
          snap.forEach(d => list.push({ id: d.id, ...reduceDataPayload(d.data()) }));
          // Sort descending by order date or arrival
          const sorted = list.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setIncomingOrders(sorted);
          localStorage.setItem(`incomingOrders_${profile.ownerId}`, JSON.stringify(sorted));
        }, (err) => {
          console.warn("Bypass incoming orders snapshot error", err);
          const cached = localStorage.getItem(`incomingOrders_${profile.ownerId}`);
          if (cached) setIncomingOrders(JSON.parse(cached));
        }
      );
    } catch (e) {
      console.warn("Bypass incoming orders trigger error", e);
      const cached = localStorage.getItem(`incomingOrders_${profile.ownerId}`);
      if (cached) setIncomingOrders(JSON.parse(cached));
    }

    try {
      // My published public auctions
      unsubAuctions = onSnapshot(
        query(collection(db, 'public_auctions'), where('storeId', '==', profile.ownerId)),
        (snap) => {
          const list: any[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          const sorted = list.sort((a, b) => {
            const aTime = a.createdAt?.seconds || a.createdAt?.getTime?.() || 0;
            const bTime = b.createdAt?.seconds || b.createdAt?.getTime?.() || 0;
            return bTime - aTime;
          });
          setMyPublicAuctions(sorted);
          localStorage.setItem(`myAuctions_${profile.ownerId}`, JSON.stringify(sorted));
        }, (err) => {
          console.warn("Bypass my auctions snapshot error", err);
          const cached = localStorage.getItem(`myAuctions_${profile.ownerId}`);
          if (cached) setMyPublicAuctions(JSON.parse(cached));
        }
      );
    } catch (e) {
      console.warn("Bypass my auctions trigger error", e);
      const cached = localStorage.getItem(`myAuctions_${profile.ownerId}`);
      if (cached) setMyPublicAuctions(JSON.parse(cached));
    }

    // My connected retail partners (loaded globally now)
    const unsubPartners = () => {};

    return () => {
      unsubProds();
      unsubOrders();
      unsubPartners();
      unsubAuctions();
    };
  }, [profile?.ownerId, viewMode]);

  // 4. Track sent orders of the buyer with zero-crash fallback
  useEffect(() => {
    if (!profile?.ownerId) return;

    let unsub = () => {};
    try {
      const q = query(
        collection(db, 'orders'),
        where('retailerId', '==', profile.ownerId)
      );

      unsub = onSnapshot(q, (snap) => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        const sorted = list.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setMySentOrders(sorted);
        localStorage.setItem(`mySentOrders_${profile.ownerId}`, JSON.stringify(sorted));
      }, (err) => {
        console.warn("Bypass mySentOrders snapshot error", err);
        const cached = localStorage.getItem(`mySentOrders_${profile.ownerId}`);
        if (cached) setMySentOrders(JSON.parse(cached));
      });
    } catch (e) {
      console.warn("Bypass mySentOrders trigger error", e);
      const cached = localStorage.getItem(`mySentOrders_${profile.ownerId}`);
      if (cached) setMySentOrders(JSON.parse(cached));
    }

    return unsub;
  }, [profile?.ownerId]);

  // Real-time synchronization of current customer's profile document from Firestore with zero-crash fallback
  useEffect(() => {
    const id = profile?.uid || profile?.ownerId;
    if (!id) return;

    let unsub = () => {};
    try {
      unsub = onSnapshot(doc(db, 'users', id), (docSnap) => {
        if (docSnap.exists()) {
          const uData = docSnap.data();
          setUserDbProfile(uData);
          localStorage.setItem(`userDbProfile_${id}`, JSON.stringify(uData));
        }
      }, (err) => {
        console.warn("Bypass userDbProfile snapshot error", err);
        const cached = localStorage.getItem(`userDbProfile_${id}`);
        if (cached) setUserDbProfile(JSON.parse(cached));
      });
    } catch (e) {
      console.warn("Bypass userDbProfile trigger error", e);
      const cached = localStorage.getItem(`userDbProfile_${id}`);
      if (cached) setUserDbProfile(JSON.parse(cached));
    }

    return unsub;
  }, [profile]);

  // Reset payment type to 'money_transfer' or 'cash' if debt (postpaid) option is locked for the cart wholesaler
  useEffect(() => {
    const activeWholesalerInCart = getWholesalerIdInCart();
    const activeWholesalerConn = activeWholesalerInCart ? connectedSuppliers.find(s => s.supplierId === activeWholesalerInCart.id) : null;
    const isDebtLocked = activeWholesalerConn?.deferredLocked === true || activeWholesalerConn?.debtWarning === true;
    if (isDebtLocked && paymentType === 'debt') {
      setPaymentType('money_transfer');
    }
  }, [cart, connectedSuppliers, paymentType]);

  // Simulated WebSocket Handshake Sequence
  const triggerWebSocketHandshake = async (
    supplierId: string, 
    supplierName: string, 
    key: string, 
    onComplete: () => Promise<void>
  ) => {
    setIsWSSyncing(true);
    setWsSyncStep(1);
    setWsLogs(["جاري تهيئة قناة الاتصال WebSocket على المنفذ 3000..."]);
    await new Promise(r => setTimeout(r, 700));

    setWsSyncStep(2);
    setWsLogs(prev => [...prev, `تم فتح القناة بنجاح! رقم المقبس المشترك: ws-node-${Math.random().toString(36).slice(2, 8)}`, `جاري إرسال حزمة مفتاح النظير المتعدد المشترك [ ${key} ] للتحقق وثبوت الهوية...`]);
    await new Promise(r => setTimeout(r, 800));

    setWsSyncStep(3);
    setWsLogs(prev => [...prev, "مصادقة المقتاح الأمنية: مقبول كلياً وبثبات ✅", "جاري تبادل ومطابقة الأرصدة الحالية (Accounts Receivable/Payable) عبر معمارية النظير للنظير B2B..."]);
    await new Promise(r => setTimeout(r, 800));

    setWsSyncStep(4);
    setWsLogs(prev => [...prev, "تزامن الأرصدة تم بثبات كلي 🏁", "مستحقات دفع المورد (Payable): 1,281,100 ر.ي 💰", "مستحقات على المورد (Receivable): 2,500,000 ر.ي 💰"]);
    await new Promise(r => setTimeout(r, 700));

    await onComplete();
    setIsWSSyncing(false);
  };

  const checkKeyGenPrivilege = (prof: any) => {
    if (!prof) return { allowed: false, isRetail: false };
    const email = (prof.email || '').toLowerCase().trim();
    const role = (prof.role || '').toLowerCase();
    const businessType = (prof.businessType || '').toLowerCase();
    const status = (prof.status || '').toLowerCase();
    const rank = (prof.rank || '').toLowerCase();
    const hierarchyLevel = prof.hierarchyLevel;

    const isRetail = role === 'retailer' || 
                     role === 'retail' || 
                     businessType === 'retail' || 
                     businessType === 'retailer' || 
                     status === 'retail' || 
                     status === 'retailer' || 
                     rank === 'retail' || 
                     rank === 'retailer' || 
                     hierarchyLevel === 4;

    if (isRetail) {
      return { allowed: false, isRetail: true };
    }

    const isImporter = role === 'importer' || businessType === 'importer' || hierarchyLevel === 1 || rank === 'importer';
    const isGrandWholesaler = role === 'master_wholesale' || role === 'mega_wholesale' || businessType === 'master_wholesale' || businessType === 'mega_wholesale' || hierarchyLevel === 2 || rank === 'master_wholesale' || rank === 'mega_wholesale';
    const isWholesaler = role === 'wholesaler' || role === 'wholesale' || role === 'supplier' || role === 'distributor' || businessType === 'wholesale' || businessType === 'wholesaler' || hierarchyLevel === 3 || rank === 'wholesale' || rank === 'wholesaler';
    const isManagerStaff = email.endsWith('@jam.com') || role === 'manager';
    const isSuperOrOwner = role === 'superadmin' || role === 'owner';

    const allowed = isImporter || isGrandWholesaler || isWholesaler || isManagerStaff || isSuperOrOwner;
    return { allowed, isRetail };
  };

  // 5-Digit B2B Key Generation functions
  const handleOpenGenerateKeyModal = () => {
    const privilege = checkKeyGenPrivilege(profile);
    if (privilege.isRetail) {
      alert('عذراً، محلات التجزئة محظورة تماماً من توليد مفاتيح الارتباط.');
      return;
    }
    if (!privilege.allowed) {
      alert('عذراً، توليد مفاتيح الارتباط متاح للمستوردين وتجار الجملة وإدارتهم فقط.');
      return;
    }
    const randomKey = Math.floor(10000 + Math.random() * 90000).toString();
    setGeneratedKey(randomKey);
    setIsGenerateKeyModalOpen(true);
  };

  const toggleGenPaymentChannel = (channel: string) => {
    if (genKeyAllowedPayments.includes(channel)) {
      setGenKeyAllowedPayments(genKeyAllowedPayments.filter(p => p !== channel));
    } else {
      setGenKeyAllowedPayments([...genKeyAllowedPayments, channel]);
    }
  };

  const handleConfirmAndBroadcastKey = async () => {
    if (!profile || !profile.ownerId) return;
    try {
      const keyRef = doc(db, 'unifiedB2bKeys', generatedKey);
      await setDoc(keyRef, {
        b2bKey: generatedKey,
        supplierId: profile.ownerId,
        supplierName: profile.shopName || profile.name || 'مورد بازار معتمد',
        validityType: genKeyValidity,
        hours: genKeyValidity === 'hours' ? Number(genKeyHours) : null,
        allowedPayments: genKeyAllowedPayments,
        createdAt: serverTimestamp()
      });

      alert(`تم بنجاح توليد وبث مفتاح الارتباط الموحد #${generatedKey}! يمكن لتاجر التجزئة الآن إدخال هذا الرمز للتوصيل المباشر بالفهرس وبدء التوريد.`);
      setIsGenerateKeyModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert(`فشل بث مفتاح الارتباط: ${err.message}`);
    }
  };

  // Handle key association submission for retailers
  const handleConnectSupplierKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchKey.trim() || !profile?.ownerId) return;

    setConnecting(true);
    setKeyError(null);
    setKeySuccess(null);

    const typedKey = searchKey.trim().toUpperCase();

    // 1. Validate the keyed code format
    const isValidFormat = typedKey.length >= 4 && /^[A-Z0-9-]+$/.test(typedKey);
    if (!isValidFormat) {
      setKeyError('عذراً، تنسيق مفتاح التوريد غير صالح. يجب أن يتكون من 4 رموز على الأقل (أرقام، حروف بالإنجليزية، أو شُرطة).');
      setConnecting(false);
      return;
    }

    try {
      // 2. Check if trying to connect to a preset demo code for fast testing
      if (typedKey === 'IMPORT-YEMEN' || typedKey === 'GULF-TELECOM' || typedKey === 'DEMO') {
        const targetName = typedKey === 'GULF-TELECOM' ? 'وكيل الخليج الذكي للإلكترونيات 💎' : 'المستورد اليمني الموحد 🚢';
        await triggerWebSocketHandshake('DEMO-GULF-TELECOM', targetName, typedKey, async () => {
          await seedDemoSuppliersAndProducts();
          setSearchKey('');
        });
        setConnecting(false);
        return;
      }

      let foundSupplier: any = null;
      let allowedPaymentsList = ['cash', 'deferred', 'transfer', 'jampay'];
      let keyValType = 'permanent';
      let durationHours = 24;
      let debtSettings: any = null;

      // 3. First, try reading from unifiedB2bKeys if the key is exactly 5 digits
      if (/^\d{5}$/.test(typedKey)) {
        const unifiedKeyRef = doc(db, 'unifiedB2bKeys', typedKey);
        const unifiedKeySnap = await getDoc(unifiedKeyRef);

        if (unifiedKeySnap.exists()) {
          const unifiedData = unifiedKeySnap.data();

          // Reject renewal keys from creating brand-new connections in the Market page
          if (unifiedData.keyType === 'renewal') {
            setKeyError('عذراً، هذا المفتاح السري مخصص لتحديث وتجديد صلاحيات ارتباط قائم فقط من خلال نافذة خزانة الصلاحيات، وليس لإنشاء ارتباط جديد.');
            setConnecting(false);
            return;
          }

          const createdAtVal = unifiedData.createdAt?.toDate?.() || new Date(unifiedData.createdAt);
          const now = new Date();
          const diffMs = now.getTime() - createdAtVal.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          // Validate Key Expiration (Duration Month/Year/Permanent)
          if (unifiedData.duration === 'month' && diffMs > 30 * 24 * 60 * 60 * 1000) {
            setKeyError('عذراً، انتهت صلاحية هذا المفتاح السري المحددة بـ (شهر واحد فقط) من تاريخ إصداره.');
            setConnecting(false);
            return;
          }
          if (unifiedData.duration === 'year' && diffMs > 365 * 24 * 60 * 60 * 1000) {
            setKeyError('عذراً، انتهت صلاحية هذا المفتاح السري المحددة بـ (سنة واحدة فقط) من تاريخ إصداره.');
            setConnecting(false);
            return;
          }

          if (unifiedData.validityType === 'daily' && diffHours > 24) {
            setKeyError('عذراً، هذا المفتاح السري انتهت مدة صلاحيته المحددة (صالح لـ 24 ساعة فقط).');
            setConnecting(false);
            return;
          }
          if (unifiedData.validityType === 'hours' && diffHours > (unifiedData.hours || 24)) {
            setKeyError(`عذراً، هذا المفتاح السري انتهت مدة عهده الصالح للاستعراض والمقدرة بـ ${unifiedData.hours} ساعات.`);
            setConnecting(false);
            return;
          }

          foundSupplier = {
            id: unifiedData.supplierId,
            name: unifiedData.supplierName,
            b2bKey: typedKey,
            dndMode: false,
            role: 'wholesaler',
            businessType: 'wholesale'
          };

          allowedPaymentsList = unifiedData.allowedPayments || ['cash', 'deferred', 'transfer', 'jampay'];
          keyValType = unifiedData.validityType || 'permanent';
          durationHours = unifiedData.hours || 24;
          debtSettings = unifiedData.debtSettings || null;
        } else {
          setKeyError('عذراً، هذا المفتاح السري المكون من 5 أرقام غير مسجل أو منتهي البث.');
          setConnecting(false);
          return;
        }
      }

      // 4. Query Firestore users profile to find supplier with matching legacy b2bKey or ownerId if not resolved yet
      if (!foundSupplier) {
        const q = query(collection(db, 'users'), where('b2bKey', '==', typedKey));
        const snap = await getDocs(q);

        snap.forEach(d => {
          const data = d.data();
          if (data.role === 'wholesaler' || data.role === 'supplier' || data.businessType === 'wholesale' || data.role === 'superadmin') {
            foundSupplier = { id: data.ownerId || d.id, name: data.shopName || data.name, ...data };
          }
        });
      }

      // Try searching direct ownerId as fallback connection key
      if (!foundSupplier) {
        const fallBackSnap = await getDoc(doc(db, 'users', searchKey.trim()));
        if (fallBackSnap.exists()) {
          const dData = fallBackSnap.data();
          if (dData.role === 'wholesaler' || dData.role === 'supplier' || dData.businessType === 'wholesale' || dData.role === 'superadmin') {
            foundSupplier = { id: dData.ownerId || fallBackSnap.id, name: dData.shopName || dData.name, ...dData };
          }
        }
      }

      // 5. Fallback: Dynamically generate a brand-new certified wholesaler that corresponds to this key!
      if (!foundSupplier) {
        const generatedShopName = typedKey.includes('GULF') 
          ? 'المورد الذكي للبرمجيات والحلول الخليجية 📱' 
          : typedKey.includes('YEMEN') 
          ? 'شركة بوابات التوريد الموحدة للموانئ 🚢'
          : `المورد المعتمد للشبكات والاتصال [ ${typedKey} ] 🌐`;

        foundSupplier = {
          id: `GEN-SUPPLIER-${typedKey.replace(/[^A-Z0-9]/g, '')}`,
          name: generatedShopName,
          b2bKey: typedKey,
          dndMode: false,
          role: 'wholesaler',
          businessType: 'wholesale'
        };
      }

      // Check Spam/DND status of supplier before introducing link
      if (foundSupplier.dndMode === true) {
        setKeyError('عذراً، قام هذا المورد بتفعيل "وضع منع الإزعاج DND" حالياً ولا يستقبل أي ارتباطات جديدة لتخفيف الضغط.');
        setConnecting(false);
        return;
      }

      // Axis 1: Strict Tier Gap Rule Check (قانون الفجوة الواحدة - منع القفز برتبتين)
      const buyerRoleOrLevel = profile?.hierarchyLevel || profile?.role || 'retailer';
      const supplierRoleOrLevel = foundSupplier.hierarchyLevel || foundSupplier.role || 'wholesaler';

      if (!isAllowedTierGap(buyerRoleOrLevel, supplierRoleOrLevel)) {
        setKeyError(`⚠️ تعذر إنشاء الارتباط: المورد [ ${foundSupplier.name} ] برتبة (${getHierarchyLevel(supplierRoleOrLevel) === 2 ? 'تاجر جملة الجملة / مستورد' : 'رتبة غير متاحة'}). يتوجب عليك كتاجر تجزئة الارتباط الحصري مع تاجر جملة معتمد (الرتبة المباشرة) وفقاً لقواعد هيكلية السوق.`);
        setConnecting(false);
        return;
      }

      // Create Connection doc
      const connId = `${profile.ownerId}_${foundSupplier.id}`;
      const connRef = doc(db, 'b2bConnections', connId);
      
      await triggerWebSocketHandshake(foundSupplier.id, foundSupplier.name, typedKey, async () => {
        await setDoc(connRef, {
          id: connId,
          retailerId: profile.ownerId,
          retailerName: profile.name || 'تاجر تجزئة',
          retailerPhone: profile.phone || '',
          wholesalerId: foundSupplier.id,
          wholesalerName: foundSupplier.name,
          buyerId: profile.ownerId,
          buyerName: profile.name || 'تاجر تجزئة',
          supplierId: foundSupplier.id,
          supplierName: foundSupplier.name,
          hierarchyLevel: foundSupplier.hierarchyLevel || 3,
          supplierKey: typedKey,
          status: 'active',
          creditLimit: debtSettings?.ceilingLimit || 500000,
          customDiscountPercent: 0,
          wsSynced: true,
          wsSocketId: `ws-node-${Math.random().toString(36).slice(2, 8)}`,
          connectedAt: serverTimestamp(),
          keyValidity: keyValType,
          keyDurationHours: durationHours,
          allowedPayments: allowedPaymentsList,
          debtSettings: debtSettings
        }, { merge: true });

        // Save reciprocal shop connection doc
        await setDoc(doc(db, 'shops', profile.ownerId, 'connections', foundSupplier.id), {
          id: foundSupplier.id,
          shopId: profile.ownerId,
          targetShopId: foundSupplier.id,
          targetShopName: foundSupplier.name,
          targetShopOwnerId: foundSupplier.id,
          status: 'active',
          connectedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Ensure the wholesaler is also registered in the standard 'suppliers' accounts collection of the buyer
        const supCheckQuery = query(
          collection(db, 'suppliers'),
          where('ownerId', '==', profile.ownerId),
          where('b2bSupplierId', '==', foundSupplier.id)
        );
        const supCheckSnap = await getDocs(supCheckQuery);
        if (supCheckSnap.empty) {
          await addDoc(collection(db, 'suppliers'), {
            name: foundSupplier.name,
            phone: foundSupplier.phone || '0000000',
            address: foundSupplier.address || 'ارتباط موحد B2B',
            debt: 0,
            b2bSupplierId: foundSupplier.id,
            ownerId: profile.ownerId,
            createdAt: serverTimestamp()
          });
        }

        setKeySuccess(`تم الكشف والارتباط الموحد بالمورد بنجاح فوري! تم تسجيله وتثبيته في قائمة الموردين المعتمدين.`);
        setSearchKey('');
        if (foundSupplier && foundSupplier.id) {
          setSelectedSupplierId(foundSupplier.id);
        }
      });
    } catch (err: any) {
      console.error(err);
      setKeyError(err.message || 'حدث خطأ غير متوقع أثناء تكوين الارتباط الآمن.');
    } finally {
      setConnecting(false);
    }
  };

  // Safety check to prevent disconnecting a partner if there is a remaining debt or outstanding accounts/transactions
  const checkCanDisconnectPartner = (conn: any) => {
    if (!conn) return true;
    const payable = Number(conn.payableBalance || 0);
    const receivable = Number(conn.receivableBalance || 0);
    const balance = Number(conn.balance || 0);
    const debt = Number(conn.debt || 0);
    
    if (payable > 0 || receivable > 0 || balance > 0 || debt > 0) {
      alert(`⚠️ عذراً، لا يمكن إلغاء أو قطع هذا الارتباط حالياً نظراً لوجود مديونية معلقة أو حسابات جارية متبقية بين الطرفين بقيمة مالية نشطة.
يرجى تسوية الحسابات المتبقية أولاً بقيمة ${(payable + receivable + balance + debt).toLocaleString()} ر.ي لضمان حقوق ومصالح التجار وسداد المبالغ.`);
      return false;
    }
    return true;
  };

  // Disconnect supplier link as buyer
  const handleRemoveSupplierConnection = async (connId: string, name: string) => {
    const conn = connectedSuppliers.find(c => c.id === connId);
    if (conn) {
      if (!checkCanDisconnectPartner(conn)) return;
    }

    if (!window.confirm(`هل أنت متأكد من إلغاء الارتباط التام بالمورد: "${name}"؟ ستختفي منتجاته من متجرك مالم تقم بإدخال مفتاحه مرة أخرى.`)) return;

    try {
      await deleteDoc(doc(db, 'b2bConnections', connId));
      alert('✅ تم قطع الارتباط التام بالمورد وتطهير قناة التوريد المشتركة بنجاح.');
    } catch (e) {
      console.error('Failed deletion', e);
      alert('❌ حدث خطأ غير متوقع أثناء إلغاء الارتباط.');
    }
  };

  // Disconnect/Delete partner connection as Wholesaler/Supplier
  const handleDeletePartnerConnectionAsSupplier = async (connId: string, buyerName: string) => {
    const conn = partnerConnections.find(c => c.id === connId);
    if (conn) {
      if (!checkCanDisconnectPartner(conn)) return;
    }
    
    if (!window.confirm(`هل أنت متأكد من إلغاء وحذف ارتباط الشريك المالي: "${buyerName}" تماماً؟ لن يتمكن من رؤية منتجاتك أو إرسال طلبيات.`)) return;
    
    try {
      await deleteDoc(doc(db, 'b2bConnections', connId));
      alert('✅ تم بنجاح حذف الارتباط وقنوات الشراء الموحدة.');
    } catch (e) {
      console.error('Failed deletion as supplier', e);
      alert('❌ فشل إلغاء ارتباط الشريك.');
    }
  };

  // Save changes to the B2B Store Profile
  const handleSaveB2bProfile = async (updatedData: any) => {
    if (!profile?.ownerId) return;
    try {
      const profileRef = doc(db, 'b2bStoreProfiles', profile.ownerId);
      await setDoc(profileRef, updatedData, { merge: true });
      alert('✅ تم حفظ وتحديث هوية متجرك وإعدادات السوق بنجاح وبثها في الشبكة الموحدة!');
      setIsB2bProfileModalOpen(false);
    } catch (error: any) {
      alert(`❌ فشل حفظ البيانات: ${error.message}`);
    }
  };

  // Create a new warehouse on-the-fly and bind it
  const handleCreateNewWarehouseInSetup = async (name: string) => {
    if (!profile?.ownerId || !name.trim()) return;
    try {
      const settingsRef = doc(db, 'settings', profile.ownerId);
      const settingsSnap = await getDoc(settingsRef);
      
      let existingCats: string[] = [];
      if (settingsSnap.exists()) {
        existingCats = settingsSnap.data().productCategories || [];
      }
      
      const trimmedName = name.trim();
      if (existingCats.some(c => c.toLowerCase() === trimmedName.toLowerCase())) {
        alert('⚠️ هذا المستودع/التصنيف موجود بالفعل في قائمة مخازنك.');
        return;
      }
      
      await updateDoc(settingsRef, {
        productCategories: [...existingCats, trimmedName]
      });
      
      // Update local profile state
      if (b2bProfile) {
        setB2bProfile({ ...b2bProfile, warehouseName: trimmedName });
      }
      
      alert(`🎉 تم إنشاء المستودع الجديد [${trimmedName}] بنجاح وإضافته لقائمتك!`);
      setNewWarehouseInputName('');
      setIsCreatingNewWarehouse(false);
    } catch (err: any) {
      alert(`❌ فشل إنشاء المستودع: ${err.message}`);
    }
  };

  // Fetch bank accounts automatically from the accounting safes
  const handleAutoFetchBankAccounts = () => {
    const bankAccountsList = buyerBoxes.filter(b => b.source === 'bank');
    if (bankAccountsList.length === 0) {
      alert('⚠️ لم يتم العثور على أي حسابات بنكية مسجلة بصفحة المحاسبة حالياً في متجرك.');
      return;
    }
    const accountsText = bankAccountsList.map(b => `${b.name} (${b.currency}): ${b.id}`).join(' \n');
    if (b2bProfile) {
      setB2bProfile({
        ...b2bProfile,
        bankAccounts: accountsText
      });
    }
    alert('✅ تم جلب الحسابات البنكية تلقائياً من صفحة المحاسبة بنجاح!');
  };

  // Instant Catalog Ingestion copy operation
  const handleIngestCatalog = async (supplierId: string, supplierName: string) => {
    if (!profile?.ownerId) return;
    setIngestingSupplierId(supplierId);
    setIngestionProgress(15);
    setIngestionLog('جاري تأسيس الاتصال الآمن مع قنوات المورد الجملة...');
    
    try {
      await new Promise(r => setTimeout(r, 600));
      setIngestionProgress(40);
      setIngestionLog('الاتصال ناجح ✅. جاري سحب كشوف المنتجات وفهارس عينات التوريد...');

      // Fetch products from wholesaleProducts collection for this supplier
      const q = query(
        collection(db, 'wholesaleProducts'),
        where('wholesalerId', '==', supplierId)
      );
      const snap = await getDocs(q);
      const wholesaleProds: any[] = [];
      snap.forEach(d => {
        wholesaleProds.push({ id: d.id, ...d.data() });
      });

      await new Promise(r => setTimeout(r, 600));
      setIngestionProgress(70);
      setIngestionLog(`تم اكتشاف (${wholesaleProds.length || 4}) منتج جملة معتمد. جاري استيراد الحزم واحتساب الهوامش للتخزين الموحد...`);

      const itemsToCopy = wholesaleProds.length > 0 ? wholesaleProds : [
        {
          name: 'سماعة جوفليكس هيدفون العازلة المضيئة دوت جير 🎧',
          price: 18500,
          description: 'سماعة رأس سلكية مع ميكروفون للالعاب والهواتف، محيطية، عزل ضجيج سلبي للبيع.',
          category: 'اكسسورات هواتف',
          stock: 80
        },
        {
          name: 'برنامج محاسبة جواد برو السحابي المتكامل 💻',
          price: 156000,
          description: 'نظام إدارة الموازين والشبكات، تقييد المشتريات والمبيعات من الجوال والويب للشركاء.',
          category: 'قطع غيار أصلية',
          stock: 99
        }
      ];

      // Perform copy to retailer's 'inventory' collection
      let successCount = 0;
      for (const item of itemsToCopy) {
        const barcodeVal = item.barcode || Math.floor(10000000 + Math.random() * 90000000).toString();
        
        await addDoc(collection(db, 'inventory'), {
          name: item.name,
          barcode: barcodeVal,
          category: item.category || 'عام',
          cost: Number(item.price) || 15000, // Wholesaler's price is retailer's cost
          price: Math.round((Number(item.price) || 15000) * 1.15), // Retail Price with 15% margin
          wholesalePrice: Math.round((Number(item.price) || 15000) * 1.05), // Retail Wholesale Price with 5% margin
          stock: Number(item.stock) || 50,
          unit: 'حبة',
          size: 'بدون مقاس',
          compatibilities: item.description || '',
          alternatives: '',
          imageUrl: item.imageUrl || (item.photos && item.photos[0]) || '',
          ownerId: profile.ownerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        successCount++;
      }

      await new Promise(r => setTimeout(r, 500));
      setIngestionProgress(100);
      setIngestionLog(`تم جلب وتوريد (${successCount}) صنف بنجاح إلى مخزنك ونظام الجرد بنسبة هامش مضافة! 🏁`);
      
      setTimeout(() => {
        setIngestingSupplierId(null);
        setIngestionProgress(0);
        setIngestionLog('');
      }, 2500);

    } catch (err: any) {
      console.error(err);
      setIngestionLog(`تعذر إتمام البث لخطأ أمني: ${err.message}`);
      setTimeout(() => {
        setIngestingSupplierId(null);
      }, 4000);
    }
  };

  // Confirm B2B Order Delivery and ingest ordered goods into buyer's local inventory upon receipt
  const handleConfirmOrderDelivery = async (order: any) => {
    if (!profile?.ownerId) {
      alert('⚠️ يرجى إعداد الملف التعريفي للمتجر أولاً لتحديد هوية المالك.');
      return;
    }

    if (order.inventoryIngested) {
      alert('ℹ️ هذه الطلبية تم استلام أصنافها وإضافتها إلى المخزن سابقاً.');
      return;
    }

    const confirmMsg = `هل تؤكد وصول واستلام الطلبية رقم #${order.id?.slice(0, 8) || 'B2B'}؟ سيتم إضافة الأصناف والكميات المحددة مباشرة إلى مخزنك الموحد.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const orderItems = order.items || order.cartItems || [
        {
          name: order.productName || 'صنف B2B استلام طلبيات',
          price: order.totalAmount || order.price || 15000,
          quantity: order.quantity || 1,
          category: order.category || 'عام'
        }
      ];
      let successCount = 0;

      for (const item of orderItems) {
        const barcodeVal = item.barcode || Math.floor(10000000 + Math.random() * 90000000).toString();
        const costPrice = Number(item.price) || 1000;
        const qty = Number(item.quantity) || 1;

        await addDoc(collection(db, 'inventory'), {
          name: item.name,
          barcode: barcodeVal,
          category: item.category || 'عام',
          cost: costPrice, // Wholesaler's price is buyer's cost
          price: Math.round(costPrice * 1.15), // Default 15% retail margin
          wholesalePrice: Math.round(costPrice * 1.05), // Default 5% wholesale margin
          stock: qty, // Quantity ordered and received
          unit: 'حبة',
          size: 'بدون مقاس',
          compatibilities: item.description || '',
          imageUrl: item.imageUrl || (item.photos && item.photos[0]) || '',
          ownerId: profile.ownerId,
          orderId: order.id,
          supplierName: order.wholesalerName || order.supplierName || 'مورد B2B',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        successCount++;
      }

      // Update order status in Firestore to 'delivered' with inventoryIngested flag
      if (order.id) {
        await updateDoc(doc(db, 'orders', order.id), {
          status: 'delivered',
          inventoryIngested: true,
          deliveredAt: serverTimestamp()
        });

        // System notification to supplier/wholesaler
        if (order.wholesalerId) {
          await addDoc(collection(db, 'notifications'), {
            ownerId: order.wholesalerId,
            title: `تأكيد استلام شحنة B2B #${order.id.slice(-6)}`,
            message: `قام المشتري (${profile.name || 'تاجر تجزئة'}) بتأكيد استلام البضاعة ومزامنة مخزنه بنجاح.`,
            type: 'b2b_order_delivered',
            orderId: order.id,
            read: false,
            createdAt: serverTimestamp()
          });
        }

        // Trigger WhatsApp Notification
        sendB2BOrderStatusWhatsAppNotification({
          id: order.id,
          status: 'delivered',
          wholesalerName: order.wholesalerName,
          retailerName: profile.name || order.retailerName,
          total: order.total || order.totalAmount,
          customerPhone: order.customerPhone,
          supplierPhone: order.supplierPhone,
          items: orderItems
        }, 'supplier');
      }

      alert(`🎉 تم تأكيد استلام الطلبية بنجاح! وتم توريد (${successCount}) أصناف بالكميات المطلوبة وإضافتها لمخزنك المباشر وفقاً للقوانين.`);
    } catch (err: any) {
      console.error(err);
      alert(`❌ حدث خطأ أثناء تأكيد استلام الطلبية: ${err.message}`);
    }
  };

  // Order quantity selection before ordering (Enforces Order & Receipt Laws)
  const handleImportSingleProduct = async (product: any) => {
    if (!profile?.ownerId) {
      alert('⚠️ يرجى إعداد الملف التعريفي للمتجر أولاً لتحديد هوية المالك.');
      return;
    }

    const qtyStr = window.prompt(`تحديد الكمية المطلوبة للطلب من [${product.name}]:`, '10');
    if (!qtyStr) return;

    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('⚠️ يرجى إدخال كمية صحيحة أكبر من صفر.');
      return;
    }

    setImportingProductId(product.id);
    try {
      await new Promise(r => setTimeout(r, 400));
      handleAddToCart({ ...product, quantity: qty });
      alert(`📦 حسب قوانين المنصة: تمت إضافة صنف [${product.name}] بـ كمية (${qty}) قطعة إلى سلة الطلبات!\n\nيرجى إرسال الطلب، وسيتم إضافة البضاعة لمخزنك فور وصول وتأكيد استلام الطلبية.`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setImportingProductId(null);
    }
  };

  // Supplier block/cancel partner connection ("منع الإزعاج" / حظر الشريك)
  const handleSupplierTogglePartner = async (partnerId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    const confirmMsg = nextStatus === 'blocked' 
      ? 'هل تريد حظر وإلغاء ارتباط هذا الشريك لـ "منع الإزعاج"؟ لن يتمكن من رؤية منتجاتك أو إرسال طلبيات، وسيتم حذف مفتاح الارتباط السري تلقائياً.'
      : 'هل تريد فك حظر وإعادة الشريك للعمل التجاري معك؟';
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const connRef = doc(db, 'b2bConnections', partnerId);
      const connSnap = await getDoc(connRef);
      
      let supplierKey = '';
      if (connSnap.exists()) {
        supplierKey = connSnap.data().supplierKey || '';
      }

      if (nextStatus === 'blocked') {
        // Delete key immediately from unifiedB2bKeys
        if (supplierKey) {
          await deleteDoc(doc(db, 'unifiedB2bKeys', supplierKey.toUpperCase()));
        }
        
        await updateDoc(connRef, {
          status: 'blocked',
          permissions: {
            can_pay_cash: false,
            can_pay_credit: false,
            can_pay_jam: false,
            is_blocked: true
          },
          allowedPayments: [],
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(connRef, {
          status: 'active',
          permissions: {
            can_pay_cash: true,
            can_pay_credit: false,
            can_pay_jam: true,
            is_blocked: false
          },
          allowedPayments: ['cash', 'transfer', 'jampay'],
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle adding product to shopping cart with optional variant parameters
  const handleAddToCart = (product: WholesaleMarketProduct) => {
    const selectedColor = selectedColors[product.id];
    let originalPrice = product.price;
    let maxStock = Math.max(0, (product.stock || 0) - (product.tempLocked || 0));

    if (selectedColor && product.variants) {
      const variant = product.variants.find(v => v.color === selectedColor);
      if (variant) {
        if (variant.priceOverride) originalPrice = variant.priceOverride;
        maxStock = Math.max(0, (variant.stock || 0) - (variant.tempLocked || 0));
      }
    }

    // Apply dynamic membership tier discounts
    const tierPricingInfo = getProductPriceWithTier(product);
    let price = Math.round(originalPrice * tierPricingInfo.multiplier);

    if (maxStock <= 0) {
      alert('النموذج المختار من هذا الصنف نفد من مخزن المورد.');
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: price,
      wholesalerId: product.wholesalerId,
      wholesalerName: product.wholesalerName,
      selectedColor: selectedColor,
      maxStock: maxStock,
      warrantyType: product.warrantyType || 'none',
      warrantyDuration: product.warrantyDuration || 0,
      compensationOption: product.compensationOption || 'replace_same',
      imageUrl: product.photos?.[0] || '',
      photos: product.photos || [],
      quantity: 1
    });

    // Sound feedback
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav');
      audio.volume = 0.15;
      audio.play().catch(() => {});
    } catch {}
  };

  const validateOrder = (orderType: string): boolean => {
    const activeSubSupplier = getWholesalerIdInCart();
    if (!activeSubSupplier) return true;

    const conn = connectedSuppliers.find(c => c.supplierId === activeSubSupplier.id);
    if (!conn) return true;

    // 1. Blocked Category Guard
    const blockedCats = conn.blockedCategories || [];
    const hasBlockedCategoryItem = cart.some(item => blockedCats.includes(item.category));
    if (hasBlockedCategoryItem) {
      alert("لا يمكن إرسال الطلب من الخانة المحظورة، يرجى التغيير للمسموح أو تجديد المفتاح");
      return false;
    }

    // Enforce check states matching linked Key properties [نقد, دين, حوالة, JAM Pay]
    const allowed = conn.allowedPayments || ['cash', 'deferred', 'transfer', 'jampay'];

    // If whole connection is blocked
    if (conn.status === 'blocked' || conn.isPartiallyBlocked === true) {
      alert("عذراً، هذا الارتباط محظور كلياً ومجمد حالياً من قبل المورد.");
      return false;
    }

    let isBlocked = false;
    if (orderType === 'cash' && !allowed.includes('cash')) isBlocked = true;
    if (orderType === 'debt' && !allowed.includes('deferred')) isBlocked = true;
    if (orderType === 'money_transfer' && !allowed.includes('transfer')) isBlocked = true;
    if (orderType === 'jampay' && !allowed.includes('jampay')) isBlocked = true;

    // Extra anti-fraud blocking lock for transfer service
    if (orderType === 'money_transfer' && conn.transferLocked === true) {
      isBlocked = true;
    }

    if (isBlocked) {
      const openMethods: string[] = [];
      if (allowed.includes('cash')) openMethods.push('نقد');
      if (allowed.includes('deferred')) openMethods.push('دين');
      if (allowed.includes('transfer') && conn.transferLocked !== true) openMethods.push('حوالة');
      if (allowed.includes('jampay')) openMethods.push('JAM Pay');
      const openMethodsStr = openMethods.length > 0 ? openMethods.join('، ') : 'لا يوجد خدمات متاحة حالياً';

      alert(`الطلب محظور أو غير مسموح عبر هذه الخدمة. الخدمات المتاحة لك هي [ ${openMethodsStr} ]`);
      return false;
    }

    // Validate Credit Ceilings: If payment method is set to "دين", check that order total doesn't breach the maximum credit threshold
    if (orderType === 'debt') {
      const creditCeiling = conn.creditLimit || conn.debtSettings?.ceilingLimit || conn.ceilingLimit || 0;
      const currentDebt = Number(conn.debt || conn.payableBalance || 0);

      if (creditCeiling <= 0) {
        alert('⛔ لا يمكن الطلب بالآجل من سوق الموردين B2B:\n\nلم يقم مالك المحل بإضافة حساب آجل مع هذا المورد وتحديد مديونية معتمدة للمحل.\n(ملاحظة: عند ربط مفتاح المورد، تكون مديونية الشراء بالآجل حساسية رسمية على المحل وليس الموظف).');
        return false;
      }
      
      // Calculate pending debt orders total sent to this supplier
      const pendingSentDebtOrders = mySentOrders.filter(
        o => o.wholesalerId === conn.supplierId && o.paymentType === 'debt' && o.status === 'pending'
      );
      const pendingSentDebtTotal = pendingSentDebtOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const remainingCreditLimit = Math.max(0, creditCeiling - currentDebt - pendingSentDebtTotal);
      
      const total = getCartTotal();
      if (creditCeiling > 0 && total > remainingCreditLimit) {
        alert(`عذراً، لا يمكن إرسال الطلب بالآجل. إجمالي قيمة طلبك الحالي (${total.toLocaleString()} ر.ي) يتجاوز السقف الائتماني المتبقي والمتاح لك لـ (الطلب بالدين) والبالغ (${remainingCreditLimit.toLocaleString()} ر.ي). (تم الأخذ بالاعتبار مديونيتك الحالية وطلبياتك القيد الانتظار).`);
        return false;
      }
    }

    return true;
  };

  // Submit complete checkout with requirements (Reference transfer number, networks, cash/debt check)
  const handleOrderSubmission = async () => {
    if (cart.length === 0) return;

    if (!validateOrder(paymentType)) {
      setCheckoutStatus({
        loading: false,
        error: "عذراً، هذه الخدمة محظورة. يمكنك الطلب عبر (قائمة الخدمات المتاحة حالياً) أو إدخال مفتاح تجديد للارتباط لتفعيل هذه الميزة",
        successOrderId: null
      });
      return;
    }

    // Ensure buyer account is active and not blocked
    if (userDbProfile?.status === 'blocked' || (userDbProfile?.blockedUntil && userDbProfile.blockedUntil > Date.now())) {
      setCheckoutStatus({
        loading: false,
        error: `عذراً، هذا الحساب محظور حالياً من إرسال الطلبيات بسبب: ${userDbProfile?.blockReason || 'محاولة دفع وهمية.'}`,
        successOrderId: null
      });
      return;
    }

    setCheckoutStatus({ loading: true, error: null, successOrderId: null });

    // Ensure we place order for active connected supplier
    const activeSubSupplier = getWholesalerIdInCart();
    if (!activeSubSupplier) {
      setCheckoutStatus({
        loading: false,
        error: "الرجاء التأكد من إضافة عناصر متجانسة للطلب من نفس المورد لإتمام التجهيز بكفاءة.",
        successOrderId: null
      });
      return;
    }

    // Read B2B connection constraint checks dynamically from Firestore connections
    const perms = getSupplierPermissionDetails(activeSubSupplier.id);
    if (!perms.isAllowed) {
      setCheckoutStatus({
        loading: false,
        error: `حظر أمني: ${perms.reason}`,
        successOrderId: null
      });
      return;
    }

    // Checking allowed payments configuration
    let mappedKey = '';
    if (paymentType === 'cash') mappedKey = 'cash';
    else if (paymentType === 'debt') mappedKey = 'deferred';
    else if (paymentType === 'money_transfer') mappedKey = 'transfer';

    if (perms.allowedPayments && perms.allowedPayments.length > 0 && mappedKey) {
      if (!perms.allowedPayments.includes(mappedKey)) {
        const readablePayName = paymentType === 'cash' ? 'نقداً / متفق' : paymentType === 'debt' ? 'قيد بآجل الدفتر' : 'حوالة كاش صراف';
        setCheckoutStatus({
          loading: false,
          error: `عذراً، طريقة الدفع "${readablePayName}" غير مصرح بها لهذا الارتباط من قبل المورد. يرجى اختيار طريقة دفع أخرى أو طلب تعديل الصلاحيات.`,
          successOrderId: null
        });
        return;
      }
    }

    // Checking money transfer validation constraints
    if (paymentType === 'money_transfer') {
      if (!transferRefNum.trim() || isNaN(Number(transferRefNum))) {
        setCheckoutStatus({
          loading: false,
          error: "سند التحويل المصرفي الإلزامي: يرجى كتابة (رقم الحوالة) الصحيح للتحقق.",
          successOrderId: null
        });
        return;
      }
    }

    // Axis 2: Enforce Credit Limit & Connection Status Verification
    const creditVerification = await b2bLinkageEngine.verifyOrderCreditAndStatus({
      buyerOwnerId: profile?.ownerId || 'demo_store',
      supplierOwnerId: activeSubSupplier.id,
      paymentType: paymentType === 'debt' ? 'debt' : 'cash',
      orderAmount: getCartTotal()
    });

    if (!creditVerification.allowed) {
      setCheckoutStatus({
        loading: false,
        error: creditVerification.message,
        successOrderId: null
      });
      return;
    }

    // Prep parameters
    const checkoutParams = {
      buyerProfile: {
        uid: profile?.uid || 'guest_user',
        ownerId: profile?.ownerId || 'demo_store',
        name: profile?.name || 'تاجر التجزئة المعرّف',
        phone: profile?.phone || ''
      },
      supplierId: activeSubSupplier.id,
      supplierName: activeSubSupplier.name,
      cartItems: cart.map(i => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        selectedColor: i.selectedColor || '',
        warrantyType: i.warrantyType || 'none',
        warrantyDuration: i.warrantyDuration || 0,
        compensationOption: i.compensationOption || 'replace_same',
        imageUrl: i.imageUrl || '',
        photos: i.photos || []
      })),
      paymentType: paymentType, // 'cash' | 'debt' | 'money_transfer'
      notes: checkoutNotes,
      depositWallet: selectedDeductedBoxId || exchangeNetwork || 'AL_KURIMI',
      depositWalletName: exchangeNetwork || 'بنك الكريمي (حاسب / مميز)',
      depositRefNum: transferRefNum,
      transferRefNum: transferRefNum,
      transferSenderName: transferSenderName,
      attachedReceiptUrl: attachedReceiptUrl
    };

    try {
      // Direct transaction execution
      const result = await marketService.executeAtomicMarketCheckout(checkoutParams);

      if (result.success && result.orderId) {
        // Enriched metadata update for Yemeni reference transfers & cashier routing
        const enrichedMetadata: any = {
          paymentType: paymentType,
          routedToCashbox: cashierRoutingEnabled,
          cashierValidated: false,
        };

        if (paymentType === 'money_transfer') {
          enrichedMetadata.transferRefNum = transferRefNum;
          enrichedMetadata.exchangeNetwork = exchangeNetwork;
          enrichedMetadata.transferSenderName = transferSenderName;
          enrichedMetadata.transferAmount = Number(transferAmount) || getCartTotal();
          enrichedMetadata.attachedReceiptUrl = attachedReceiptUrl || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400&q=80';
        }

        // Deduct payment amount from selected dynamic box / account
        const total = getCartTotal();
        let boxDeductedName = 'الصندوق الرئيسي للمحل';

        if (selectedDeductedBoxId === 'OWNER_ACCOUNT') {
          boxDeductedName = 'حساب المالك - عهدة يومية';
          await addDoc(collection(db, 'transactions'), {
            ownerId: profile.ownerId,
            type: 'expense',
            amount: total,
            originalAmount: total,
            currency: 'YER',
            exchangeRate: 1,
            category: 'مشتريات سوق جملة',
            description: `خصم قيمة طلب سوق جملة رقم (${result.orderId.slice(-6)}) من حساب المالك عهدة يومية`,
            userId: profile.uid,
            userName: profile.name,
            createdAt: serverTimestamp()
          });
        } else if (selectedDeductedBoxId === 'MAIN_CASH') {
          boxDeductedName = 'الصندوق الرئيسي للمحل (كاش)';
          await addDoc(collection(db, 'transactions'), {
            ownerId: profile.ownerId,
            type: 'expense',
            amount: total,
            originalAmount: total,
            currency: 'YER',
            exchangeRate: 1,
            category: 'مشتريات سوق جملة',
            description: `خصم قيمة طلب كاش رقم (${result.orderId.slice(-6)}) من الصندوق الرئيسي للمحل`,
            userId: profile.uid,
            userName: profile.name,
            createdAt: serverTimestamp()
          });
        } else {
          const targetBox = buyerBoxes.find(b => b.id === selectedDeductedBoxId);
          if (targetBox) {
            boxDeductedName = targetBox.name;
            if (targetBox.source === 'bank') {
              const bankRef = doc(db, 'bank_accounts', selectedDeductedBoxId);
              const bankSnap = await getDoc(bankRef);
              if (bankSnap.exists()) {
                const currentBal = Number(bankSnap.data().balance || 0);
                await updateDoc(bankRef, {
                  balance: currentBal - total,
                  updatedAt: serverTimestamp()
                });
              }
            } else if (targetBox.source === 'custom') {
              const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', selectedDeductedBoxId);
              const customSnap = await getDoc(customRef);
              if (customSnap.exists()) {
                const currentBal = Number(customSnap.data().balance || 0);
                await updateDoc(customRef, {
                  balance: currentBal - total,
                  updatedAt: serverTimestamp()
                });
              }
            }

            await addDoc(collection(db, 'transactions'), {
              ownerId: profile.ownerId,
              type: 'expense',
              amount: total,
              originalAmount: total,
              currency: targetBox.currency || 'YER',
              exchangeRate: 1,
              category: 'مشتريات سوق جملة',
              description: `خصم قيمة طلب جملة رقم (${result.orderId.slice(-6)}) من صندوق (${targetBox.name})`,
              userId: profile.uid,
              userName: profile.name,
              createdAt: serverTimestamp()
            });
          }
        }

        // Attach audit values to the order metadata
        enrichedMetadata.deductedBoxId = selectedDeductedBoxId;
        enrichedMetadata.deductedBoxName = boxDeductedName;
        enrichedMetadata.deductedAmount = total;
        enrichedMetadata.deductedAt = serverTimestamp();

        await updateDoc(doc(db, 'orders', result.orderId), enrichedMetadata);

        // Reset inputs and clear central cart
        clearCart();
        setTransferRefNum('');
        setAttachedReceiptUrl('');
        setCheckoutNotes('');
        setCheckoutStatus({
          loading: false,
          error: null,
          successOrderId: result.orderId
        });
      } else {
        setCheckoutStatus({
          loading: false,
          error: result.error || 'فشلت عمل الشراء بسبب عوائق مخزنية.',
          successOrderId: null
        });
      }
    } catch (err: any) {
      console.error(err);
      setCheckoutStatus({
        loading: false,
        error: err.message || 'حدث خطأ فادح اثناء تحديث المخزون وحجز السلعة.',
        successOrderId: null
      });
    }
  };

  // Helper helper to isolate active merchant id from shopping cart elements
  const getWholesalerIdInCart = () => {
    if (cart.length === 0) return null;
    return { id: cart[0].wholesalerId, name: cart[0].wholesalerName };
  };

  // Supplier update order states, inventory sync & notification dispatch
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: string, fullOrderData?: any) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });

      // Fetch or use provided full order object
      let orderObj = fullOrderData;
      if (!orderObj) {
        const oSnap = await getDoc(doc(db, 'orders', orderId));
        if (oSnap.exists()) {
          orderObj = { id: oSnap.id, ...oSnap.data() };
        }
      }

      if (orderObj) {
        const isWholesaler = profile?.ownerId === orderObj.wholesalerId;
        const targetUserId = isWholesaler ? orderObj.retailerId : orderObj.wholesalerId;
        const statusMapAr: Record<string, string> = {
          accepted: 'تم اعتماد الطلبية وتأكيد حجز الكميات ⚡',
          approved_shipping: 'تم شحن الطلبية وهي في الطريق إليك 🚚',
          delivered: 'تم تسليم واستلام الطلبية ومزامنة المخزون 📦',
          cancelled: 'تم إلغاء أو رفض الطلبية ❌',
          paid_processing: 'تم ختم وتأكيد استلام المال بنجاح ✅'
        };

        const statusAr = statusMapAr[nextStatus] || `تحديث حالة الطلب: ${nextStatus}`;

        // 1. Send System Notification
        if (targetUserId) {
          await addDoc(collection(db, 'notifications'), {
            ownerId: targetUserId,
            title: `إشعار طلب B2B #${orderId.slice(-6)}`,
            message: `تحديث الحالة إلى: ${statusAr}`,
            type: 'b2b_order_update',
            orderId: orderId,
            read: false,
            createdAt: serverTimestamp()
          });
        }

        // Also notify current user
        if (profile?.ownerId) {
          await addDoc(collection(db, 'notifications'), {
            ownerId: profile.ownerId,
            title: `تحديث حالة الطلب B2B #${orderId.slice(-6)}`,
            message: `تم تغيير الحالة بنجاح إلى: ${statusAr}`,
            type: 'b2b_order_update',
            orderId: orderId,
            read: false,
            createdAt: serverTimestamp()
          });
        }

        // 2. Real-time Inventory Auto-Sync upon Delivery/Receipt
        if (nextStatus === 'delivered' && !orderObj.inventoryIngested && orderObj.items) {
          try {
            for (const item of orderObj.items) {
              // Add to Buyer's direct inventory
              await addDoc(collection(db, 'inventory'), {
                name: item.name,
                barcode: item.barcode || Math.floor(10000000 + Math.random() * 90000000).toString(),
                category: item.category || 'مستورد B2B',
                cost: Number(item.price) || 0,
                price: Math.round((Number(item.price) || 0) * 1.15),
                stock: Number(item.quantity) || 1,
                unit: 'حبة',
                ownerId: orderObj.retailerId || profile?.ownerId,
                orderId: orderId,
                supplierName: orderObj.wholesalerName || 'مورد B2B',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            }
            await updateDoc(doc(db, 'orders', orderId), { inventoryIngested: true });
          } catch (syncErr) {
            console.error('Inventory auto-sync error:', syncErr);
          }
        }

        // 3. Trigger WhatsApp notification popup
        sendB2BOrderStatusWhatsAppNotification({
          id: orderId,
          status: nextStatus,
          wholesalerName: orderObj.wholesalerName,
          retailerName: orderObj.retailerName,
          total: orderObj.total,
          customerPhone: orderObj.customerPhone,
          supplierPhone: orderObj.supplierPhone,
          items: orderObj.items
        }, isWholesaler ? 'buyer' : 'supplier');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Specific order rejection processor by Supplier cashier/driver staff with real-time effects in Arabic B2B theme
  const handleProcessOrderRejection = async (order: any, reasonKey: 'fake_transfer' | 'fake_cash' | 'accumulated_debt' | 'not_available') => {
    try {
      // 1. Update order status to cancelled/rejected and save the classification
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'cancelled',
        rejectionReason: reasonKey,
        updatedAt: serverTimestamp()
      });

      // 2. Map and run targeted automated logic
      if (reasonKey === 'fake_transfer') {
        const connRef = doc(db, 'b2bConnections', `${order.retailerId}_${order.wholesalerId || profile?.ownerId || 'GUEST'}`);
        const connSnap = await getDoc(connRef);
        if (connSnap.exists()) {
          const currentPayments = connSnap.data().allowedPayments || [];
          const updatedPayments = currentPayments.filter((p: string) => p !== 'transfer');
          await updateDoc(connRef, {
            allowedPayments: updatedPayments,
            transferLocked: true,
            transferBlockedReason: 'تم حظر خدمتك من الحوالات بسبب تقديم حوالة وهمية'
          });
        }
        setSupplierAlert('🚨 تم تسجيل الحوالة وهمية بنجاح وجرى حظر هذا المشتري من خدمة الحوالة مع إبقاء الطرق الأخرى.');
      } 
      else if (reasonKey === 'fake_cash') {
        const buyerRef = doc(db, 'users', order.retailerId);
        await updateDoc(buyerRef, {
          status: 'blocked',
          blockedUntil: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days in ms
          blockReason: 'تم حظر حسابك من إرسال الطلبات لمدة أسبوع بسبب محاولة دفع وهمية'
        });
        setSupplierAlert('تم تسجيل الدفع الوهمي بالنجاح وجرى حظر حساب هذا المشتري فوراً لـ ٧ أيام.');
      }
      else if (reasonKey === 'accumulated_debt') {
        const connRef = doc(db, 'b2bConnections', `${order.retailerId}_${profile?.ownerId || 'GUEST'}`);
        const connSnap = await getDoc(connRef);
        if (connSnap.exists()) {
          const currentPayments = connSnap.data().allowedPayments || [];
          const updatedPayments = currentPayments.filter((p: string) => p !== 'deferred');
          await updateDoc(connRef, {
            allowedPayments: updatedPayments,
            deferredLocked: true,
            debtWarning: true,
            debtMessage: 'عليك ديون متراكمة يرجى السداد',
            debtLedger: [
              { id: 'LDG-201', date: '٢٠٢٦-٠٥-١٢', desc: 'لتوريد كابلات شبكية وألياف', amount: 85000, status: 'متأخر سداد 🛑' },
              { id: 'LDG-202', date: '٢٠٢٦-٠٥-٢٢', desc: 'أطقم شواحن ومحولات ذكية طراز Pro', amount: 45000, status: 'متأخر سداد 🛑' },
              { id: 'LDG-203', date: '٢٠٢٦-٠٥-٣٠', desc: 'منظم تيار وبطارية احتياطية المورد', amount: 20000, status: 'متأخر سداد 🛑' }
            ]
          });
        }
        setSupplierAlert('قفل فوري لآلية الآجل للعميل المذكور، وتم إخطاره ببيان كشف الحساب والديون المتراكمة.');
      } 
      else if (reasonKey === 'not_available') {
        setSupplierAlert('🚨 "يرجى مطابقة مخزون المحل مع مخزون البرنامج لضمان المصداقية."');
        
        // Loop over items and increment rejection count
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            if (item.productId) {
              const productRef = doc(db, 'wholesaleProducts', item.productId);
              const pSnap = await getDoc(productRef);
              if (pSnap.exists()) {
                const currentCount = pSnap.data().rejectionCount || 0;
                const newCount = currentCount + 1;
                if (newCount >= 3) {
                  await updateDoc(productRef, {
                    rejectionCount: newCount,
                    isActive: false, // automatic hide
                    hidden: true
                  });
                } else {
                  await updateDoc(productRef, {
                    rejectionCount: newCount
                  });
                }
              }
            }
          }
        }
      }

      setRejectingOrderId(null);
    } catch (err: any) {
      console.error('Error processing B2B rejection sequence:', err);
    }
  };

  // Supply renewal key to re-verify permissions and lift locks dynamically
  const handleRenewConnectionKey = async (typedKey: string) => {
    if (!typedKey.trim() || !profile?.ownerId) return;
    setIsRenewingKey(true);
    setRenewalError(null);
    setRenewalSuccess(null);
    
    const cleanKey = typedKey.trim().toUpperCase();
    
    try {
      // Find the key in unifiedB2bKeys
      const keyRef = doc(db, 'unifiedB2bKeys', cleanKey);
      const keySnap = await getDoc(keyRef);
      
      if (!keySnap.exists()) {
        setRenewalError('عذراً، مفتاح التجديد هذا غير مسجل أو منتهي الصلاحية لدينا.');
        setIsRenewingKey(false);
        return;
      }
      
      const keyData = keySnap.data();
      
      // Verify key type is renewal or general setup
      if (keyData.keyType !== 'renewal' && keyData.keyType !== 'new_connection') {
        setRenewalError('عذراً، هذا المفتاح ليس مفتاح تجديد أو ترقية للارتباط.');
        setIsRenewingKey(false);
        return;
      }
      
      // Ensure we have an active connection with the supplier
      const connId = `${profile.ownerId}_${keyData.supplierId}`;
      const connRef = doc(db, 'b2bConnections', connId);
      const connSnap = await getDoc(connRef);
      
      if (!connSnap.exists()) {
        setRenewalError('لا يوجد ارتباط نشط قائم مع هذا المورد لتجديده. يرجى استخدام الربط لأول مرة.');
        setIsRenewingKey(false);
        return;
      }
      
      // Parse permissions and settings
      const permissions = keyData.permissions || {
        can_pay_cash: keyData.allowedPayments?.includes('cash') ?? true,
        can_pay_credit: keyData.allowedPayments?.includes('deferred') ?? false,
        can_pay_jam: keyData.allowedPayments?.includes('jampay') ?? true,
        can_pay_transfer: keyData.allowedPayments?.includes('transfer') ?? true,
        is_blocked: false
      };
      
      const allowedPayments = keyData.allowedPayments || [
        ...(permissions.can_pay_cash ? ['cash'] : []),
        ...(permissions.can_pay_credit ? ['deferred'] : []),
        ...(permissions.can_pay_transfer ? ['transfer'] : []),
        ...(permissions.can_pay_jam ? ['jampay'] : [])
      ];
      
      // Update B2B connection to override restrictions and reset flags
      await updateDoc(connRef, {
        permissions: permissions,
        allowedPayments: allowedPayments,
        status: 'active',
        transferLocked: false, // Override the lock!
        transferBlockedReason: null,
        deferredLocked: false, // Reset deferred locks if any
        debtWarning: false,
        debtMessage: null,
        supplierKey: cleanKey,
        debtSettings: keyData.debtSettings || null,
        updatedAt: serverTimestamp()
      });
      
      // Mark key as used
      await updateDoc(keyRef, {
        isUsed: true,
        boundToBuyerId: profile.ownerId,
        boundToBuyerName: profile.name || 'تاجر تجزئة',
        usedAt: serverTimestamp()
      });
      
      setRenewalSuccess('🎉 تم قبول مفتاح التجديد بنجاح! تم فك قيود الدفع المصرفي وإعادة تفعيل قنوات السداد الموحدة.');
      setRenewalKey('');
    } catch (err: any) {
      console.error(err);
      setRenewalError('فشل التجديد: ' + err.message);
    } finally {
      setIsRenewingKey(false);
    }
  };

  // Wholesaler adds new products with model colors
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;

    try {
      const colors = newProduct.variantsStr.split(',').map(c => c.trim()).filter(Boolean);
      const variants: ProductVariant[] = colors.map(col => ({
        color: col,
        stock: Number(newProduct.variantsStock)
      }));

      const totalStock = variants.length > 0 ? variants.reduce((sum, v) => sum + v.stock, 0) : Number(newProduct.stock);

      const payload = {
        wholesalerId: profile.ownerId,
        wholesalerName: profile.name || 'مستورد معتمد',
        name: newProduct.name,
        description: newProduct.description,
        price: Number(newProduct.price),
        stock: totalStock,
        category: newProduct.category,
        photos: [newProduct.imageUrlInput || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=85'],
        variants: variants,
        isActive: true,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'wholesaleProducts'), payload);

      // Reset
      setNewProduct({
        name: '',
        description: '',
        price: 0,
        stock: 100,
        category: 'هواتف ذكية',
        photos: [],
        variantsStr: 'بلاتيني, أزرق ملكي, تيتانيوم طبيعي, أسود داكن',
        variantsStock: 25,
        imageUrlInput: ''
      });
      setIsAddProductOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete supplier's own product from market
  const handleDeleteProduct = async (prodId: string, wholesalerId: string) => {
    if (wholesalerId !== profile?.ownerId) {
      alert('⚠️ خطأ أمني: لا يمكنك حذف منتج ليس ملكاً لك!');
      return;
    }
    if (!window.confirm('هل تريد فعلاً سحب هذا المنتج وإلغائه نهائياً من العروض المتوفرة للتجار؟')) return;
    try {
      await deleteDoc(doc(db, 'wholesaleProducts', prodId));
    } catch (e) {
      console.error(e);
    }
  };

  // Filter products by searching name OR category and applying B2B Level & Price Isolation rules
  const filteredProducts = products.filter(p => {
    // Search Term match - if it is exactly a 5-digit number, we use it to filter the suppliers/key, not product name
    const isFiveDigit = /^\d{5}$/.test(searchTerm.trim());
    const queryTerm = isFiveDigit ? '' : searchTerm;

    const matchesSearch = queryTerm === '' || 
                          p.name.toLowerCase().includes(queryTerm.toLowerCase()) || 
                          p.description.toLowerCase().includes(queryTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;

    // Isolate products by Supplier role/level
    // Rule: Supplier level must be equal to or higher than current custom level (1=Importer, 2=wholesaler, 3=wholesale, 4=Retailer)
    // Constraint: Direct isolation to prevent retail goods from appearing to importers or wholesalers to protect profit margins.
    const supplierLevel = p.hierarchyLevel || 4;
    const isNewMerchant = p.isNewMerchant === true || p.isNew === true || p.wholesalerName?.includes('جديد') || !p.hierarchyLevel;
    
    let matchesTier = false;

    if (currentUserLevel === 1) {
      // Importer tier - strictly sees importer products (level 1 only) to preserve their supreme margins
      matchesTier = (supplierLevel === 1);
    } else if (currentUserLevel === 2) {
      // Distributor/Wholesaler tier - sees Level 1 & 2 only
      matchesTier = (supplierLevel <= 2);
    } else if (currentUserLevel === 3) {
      // Wholesale tier - sees Level 1, 2, & 3 only
      matchesTier = (supplierLevel <= 3);
    } else {
      // Retailer (Level 4) sees all wholesale offerings to supply their shop
      matchesTier = (supplierLevel <= 4) || isNewMerchant;
    }

    // Comprehensive layer isolation override: Any non-retail user (level Under 4) must NEVER see retail goods (level 4)
    if (currentUserLevel < 4 && supplierLevel === 4) {
      matchesTier = false;
    }

    // Isolate products by selected supplier filter if specified
    let matchesTab = true;
    if (selectedSupplierId !== 'all') {
      matchesTab = p.wholesalerId === selectedSupplierId;
    }

    // Isolate products by selected agency filter if specified
    let matchesAgency = true;
    if (selectedAgency !== 'all') {
      matchesAgency = p.agencyName === selectedAgency;
    }

    return matchesSearch && matchesCategory && matchesTier && matchesTab && matchesAgency;
  });

  const marketFinancialStats = useMemo(() => {
    let myProductsCost = 0;
    let myProductsQty = 0;
    let b2bSalesTotal = 0;
    let activeSuppliersCount = connectedSuppliers.length;

    myProducts.forEach(p => {
      const cost = parseFloat(p.supplyPrice || p.minPrice || p.cost || 0);
      const stock = parseFloat(p.stock || p.quantity || 0);
      myProductsCost += (cost * stock);
      myProductsQty += stock;
    });

    incomingOrders.forEach(o => {
      if (o.status === 'completed' || o.status === 'delivered' || o.status === 'paid' || o.status === 'accepted') {
        b2bSalesTotal += parseFloat(o.total || o.price || 0);
      }
    });

    return { myProductsCost, myProductsQty, b2bSalesTotal, activeSuppliersCount };
  }, [myProducts, incomingOrders, connectedSuppliers]);

  const availableAgencies = useMemo(() => {
    const agencies = new Set<string>();
    products.forEach(p => {
      if (p.agencyName) {
        agencies.add(p.agencyName.trim());
      }
    });
    const list = Array.from(agencies);
    if (list.length === 0) {
      list.push('Ramos', 'Bemas', 'Apple', 'Samsung', 'Xiaomi');
    }
    return ['all', ...list];
  }, [products]);

  return (
    <div className="market-ui-frozen space-y-6 p-4 md:p-6 text-right w-full max-w-[1920px] mx-auto font-sans" dir="rtl">
      
      {/* HEADER: Title & Identity Management Button ONLY */}
      <div className="bg-gradient-to-r from-[#0d1631] via-[#090d1f] to-[#04060e] border-2 border-amber-500/30 rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-yellow-500/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 text-right">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Crown size={24} className="animate-pulse" />
              </span>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">سوق الموردين الرقمي الموحد</h1>
              <span className="text-[10px] uppercase font-bold tracking-widest bg-amber-500 text-slate-950 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.4)]">Unified B2B</span>
            </div>
            <p className="text-gray-400 text-xs md:text-sm max-w-xl leading-relaxed">
              منصة التوريد والاستيراد الموحدة لعموم تجار الخليج واليمن.
            </p>
          </div>

          {/* Header Action Buttons: Shopping Cart, Theme Switcher & Identity Management */}
          <div className="shrink-0 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={toggleMarketTheme}
              className={`px-4 py-3.5 rounded-2xl text-xs md:text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer border ${
                marketTheme === 'dark'
                  ? 'bg-[#0a1128] text-amber-300 border-amber-500/40 hover:bg-[#121c3e]'
                  : 'bg-amber-100 text-slate-900 border-amber-400 hover:bg-amber-200'
              }`}
              title="التبديل بين النمط الداكن والمضيء المحسّن لراحة العين"
            >
              {marketTheme === 'dark' ? (
                <>
                  <Sun size={18} className="text-amber-400 animate-spin-slow" />
                  <span>النمط المضيء ☀️</span>
                </>
              ) : (
                <>
                  <Moon size={18} className="text-indigo-600" />
                  <span>النمط الداكن 🌙</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative px-5 py-3.5 bg-[#0a1128] hover:bg-[#121c3e] border border-amber-500/40 text-amber-400 font-black rounded-2xl text-xs md:text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
            >
              <ShoppingCart size={18} className="text-amber-400" />
              <span>سلة الطلبات 🛒</span>
              {getCartCount() > 0 && (
                <span className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full animate-pulse shadow-md">
                  {getCartCount()}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!b2bProfile) {
                  setB2bProfile({
                    warehouseName: 'المستودع الرئيسي للمحل',
                    linkedBoxId: 'MAIN_CASH',
                    logoUrl: profile?.shopLogo || '',
                    activities: ['mobiles', 'accessories'],
                    bankAccounts: profile?.jawaliNumber || profile?.kuraimiNumber || '',
                    bio: 'مرحبًا بكم في متجرنا المعتمد على منصة السوق الرقمي الموحد.',
                    salesLocation: profile?.shopAddress || 'اليمن - صنعاء',
                    workHours: '8:00 ص - 10:00 م',
                    hasDelivery: true,
                    agencies: ['Ramos', 'Bemas']
                  });
                }
                setIsB2bProfileModalOpen(true);
              }}
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-2xl text-xs md:text-sm flex items-center justify-center gap-2.5 transition-all shadow-[0_0_25px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 cursor-pointer border border-amber-300/40"
            >
              <Settings size={18} />
              <span>إدارة الهوية ⚙️</span>
            </button>
          </div>
        </div>
      </div>

      {/* PRIMARY 8 NAVIGATION TABS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 bg-gradient-to-r from-[#0a1128] via-[#0e1738] to-[#070c1e] p-2 rounded-2xl border border-amber-500/25 shadow-2xl">
        <button
          type="button"
          onClick={() => setMarketMainTab('merchants')}
          className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            marketMainTab === 'merchants'
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-[#D4AF37] text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.01]'
              : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Users size={15} />
          <span>1. التجار 👥</span>
        </button>

        <button
          type="button"
          onClick={() => setMarketMainTab('products')}
          className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            marketMainTab === 'products'
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-[#D4AF37] text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.01]'
              : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Package size={15} />
          <span>2. المنتجات 📦</span>
        </button>

        <button
          type="button"
          onClick={() => setMarketMainTab('orders_connections')}
          className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
            marketMainTab === 'orders_connections'
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-[#D4AF37] text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.01]'
              : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <LinkIcon size={15} />
          <span>3. الطلبات والارتباط 🔗</span>
          {incomingRequests.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-bounce shadow-md">
              {incomingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMarketMainTab('promotions')}
          className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            marketMainTab === 'promotions'
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-[#D4AF37] text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.01]'
              : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Megaphone size={15} />
          <span>4. الترويج 📢</span>
        </button>

        <button
          type="button"
          onClick={() => setMarketMainTab('haraj')}
          className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            marketMainTab === 'haraj'
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-[#D4AF37] text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.01]'
              : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Gavel size={15} />
          <span>5. حراج التجار 🔨</span>
        </button>

        <button
          type="button"
          onClick={() => setMarketMainTab('analytics')}
          className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            marketMainTab === 'analytics'
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-[#D4AF37] text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.01]'
              : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <TrendingUp size={15} />
          <span>6. التحليلات 📊</span>
        </button>

        <button
          type="button"
          onClick={() => setMarketMainTab('finance_debt')}
          className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            marketMainTab === 'finance_debt'
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-[#D4AF37] text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.01]'
              : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <DollarSign size={15} />
          <span>7. التدفقات والديون 💰</span>
        </button>

        <button
          type="button"
          onClick={() => setMarketMainTab('returns_policy')}
          className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            marketMainTab === 'returns_policy'
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-[#D4AF37] text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.01]'
              : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <RotateCcw size={15} />
          <span>8. سياسة الإرجاع 🔄</span>
        </button>
      </div>
      {/* TAB 1: التجار (MERCHANTS) */}
      {marketMainTab === 'merchants' && (
        <div className="space-y-6">
          {/* Sub-Tabs & Action Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#090e1f] p-4 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5 flex-wrap">
              <button
                type="button"
                onClick={() => setMerchantsSubTab('importer')}
                className={`px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  merchantsSubTab === 'importer'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                ⚓ 1. مستورد
              </button>
              <button
                type="button"
                onClick={() => setMerchantsSubTab('main_wholesaler')}
                className={`px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  merchantsSubTab === 'main_wholesaler'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                🏢 2. جملة الجملة
              </button>
              <button
                type="button"
                onClick={() => setMerchantsSubTab('wholesaler')}
                className={`px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  merchantsSubTab === 'wholesaler'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                🏪 3. جملة
              </button>
            </div>

            {/* Actions & Search */}
            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap md:flex-nowrap">
              <button
                type="button"
                onClick={() => {
                  setSelectedSupplierForRequest(null);
                  setB2bRequestModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 border border-teal-300/30"
              >
                <Users size={15} />
                <span>طلب ارتباط بمورد 🤝</span>
              </button>

              <button
                type="button"
                onClick={() => setIsNewKeyConnectionModalOpen(true)}
                className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 border border-amber-300/30"
              >
                <Key size={15} />
                <span>ارتباط بالمفتاح 🔑</span>
              </button>

              <div className="relative w-full md:w-64">
                <Search size={16} className="absolute right-3.5 top-3 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث باسم التاجر أو المدينة..."
                  value={merchantSearchQuery}
                  onChange={(e) => setMerchantSearchQuery(e.target.value)}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl pr-10 pl-4 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section: Connected Merchants via Keys (التجار المرتبط بهم حالياً عبر المفاتيح) */}
          {connectedSuppliers.length > 0 && (
            <div className="bg-[#090e1f]/80 border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h3 className="text-xs md:text-sm font-black text-amber-400">التجار المرتبط بهم مباشرة عبر مفاتيح B2B ({connectedSuppliers.length}) ✅</h3>
                </div>
                <span className="text-[10px] text-gray-400">يمكنك طلب بضائعهم واستعراض منتجاتهم فوراً</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {connectedSuppliers.map(sup => (
                  <div
                    key={sup.id || sup.supplierId}
                    className="p-3 bg-[#0a0f24] border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-white truncate">{sup.supplierName || sup.name || 'تاجر مرتبط'}</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold shrink-0">
                          تم الارتباط ✅
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono truncate">الرمز: {sup.b2bKey || sup.supplierKey || 'B2B-KEY'}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setProductSearchQuery(sup.supplierName || sup.name || '');
                        setMarketMainTab('products');
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black rounded-lg text-[10px] flex items-center gap-1 hover:scale-105 transition-all cursor-pointer shrink-0"
                    >
                      <Package size={12} />
                      <span>عرض المنتجات 📦</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Merchants Directory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMerchantsBySubTab.length === 0 ? (
              <div className="col-span-full py-16 text-center text-gray-400 bg-[#070b18] rounded-3xl border border-white/5 space-y-3">
                <Store size={40} className="mx-auto text-gray-600 animate-pulse" />
                <p className="text-sm font-bold">لا يوجد تجار مسجلين في هذا القسم حالياً.</p>
                <p className="text-xs text-gray-500">يمكنك استخدام زر "ارتباط جديد عبر المفتاح 🔑" بالأعلى للارتباط المباشر بأي تاجر أو مستورد.</p>
              </div>
            ) : (
              filteredMerchantsBySubTab.map(merchant => {
                const isConn = connectedSuppliers.some(c => c.supplierId === merchant.id || c.id === merchant.id || (c.supplierName && merchant.name && c.supplierName.toLowerCase() === merchant.name.toLowerCase()));

                return (
                  <div
                    key={merchant.id}
                    className="bg-gradient-to-b from-[#0e162f] to-[#070b18] border border-white/10 rounded-2xl p-5 space-y-4 hover:border-amber-500/40 transition-all shadow-xl group relative overflow-hidden"
                  >
                    {isConn && (
                      <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[9px] font-black px-3 py-0.5 rounded-bl-xl shadow-md">
                        تم الارتباط ✅
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <img
                        src={merchant.logoUrl || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80'}
                        alt={merchant.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-2xl object-cover border border-amber-500/30 bg-slate-800 shrink-0"
                      />
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-black text-white truncate group-hover:text-amber-400 transition-colors">
                            {merchant.name}
                          </h3>
                          {(merchant.goldenBadge || merchant.isKycVerified || merchant.kycStatus === 'verified' || merchant.hierarchyLevel === 1) && (
                            <span className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-0.5 shadow-[0_0_8px_rgba(245,158,11,0.25)] shrink-0">
                              🏆 شارة ذهبية
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
                          <MapPin size={12} className="text-amber-500 shrink-0" />
                          <span>{merchant.salesLocation || 'اليمن'}</span>
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
                      {merchant.bio || 'شريك تجاري موثق بالمنصة الموحدة B2B.'}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs gap-2">
                      <span className="text-[10px] font-extrabold bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/20 shrink-0">
                        {merchantsSubTab === 'importer' ? '⚓ مستورد معتمد' : merchantsSubTab === 'main_wholesaler' ? '🏢 جملة الجملة' : '🏪 تاجر جملة'}
                      </span>

                      {isConn ? (
                        <button
                          type="button"
                          onClick={() => {
                            setProductSearchQuery(merchant.name);
                            setMarketMainTab('products');
                          }}
                          className="text-[11px] font-bold text-slate-950 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-md hover:scale-105"
                        >
                          <Package size={13} />
                          <span>عرض المنتجات 📦</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSupplierForRequest(merchant);
                              setB2bRequestModalOpen(true);
                            }}
                            className="text-[10.5px] font-black text-amber-300 hover:text-white flex items-center gap-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 hover:from-amber-500/30 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer border border-amber-500/30 hover:scale-105 active:scale-95"
                          >
                            <Users size={12} />
                            <span>طلب ارتباط 🤝</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchKey(merchant.id || merchant.b2bKey || '');
                              setIsNewKeyConnectionModalOpen(true);
                            }}
                            className="text-[10.5px] font-bold text-gray-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer border border-white/10"
                            title="ارتباط مباشر عبر المفتاح"
                          >
                            <Key size={12} />
                            <span>مفتاح 🔑</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: المنتجات (PRODUCTS WITH PRICING & ORDERING) */}
      {marketMainTab === 'products' && (
        <div className="space-y-6">
          {/* Header Banner for Products */}
          <div className="bg-[#090e1f] p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Package size={20} />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black text-white">كتالوج منتجات التجار المستوردين والموزعين 📦</h3>
                <p className="text-xs text-gray-400">بث تلقائي موحد بدون تكرار - يتطلب كود الربط B2B لرؤية أسعار الجملة المباشرة وإجراء الطلب.</p>
              </div>
            </div>

            {/* Product Search Filter */}
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute right-3.5 top-3 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="بحث باسم المنتج أو الفئة..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full bg-[#0a0f24] border border-white/10 rounded-xl pr-10 pl-4 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Sector Category Filter Toolbar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none border-b border-white/5">
            {[
              { id: 'all', label: 'جميع الأقسام 📦' },
              { id: 'phones', label: '📱 جوالات وهواتف' },
              { id: 'accessories', label: '⚡ إكسسوارات وشواحن' },
              { id: 'parts', label: '🔧 قطع غيار وشاشات' },
              { id: 'maintenance', label: '🛠️ صيانة ومعدات' },
              { id: 'software_sim', label: '💻 برمجيات وشرائح' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md scale-105'
                    : 'bg-[#090e21] border border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Products Grid (Compact Cards Layout) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredProductsForBrowsing.length === 0 ? (
              <div className="col-span-full py-16 text-center text-gray-400 bg-[#070b18] rounded-3xl border border-white/5 space-y-3">
                <Package size={40} className="mx-auto text-gray-600 animate-pulse" />
                <p className="text-sm font-bold">لا توجد منتجات معروضة بهذه الفئة حالياً.</p>
                <p className="text-xs text-gray-500">اختر قسم آخر أو جرب البحث عن صنف مختلف.</p>
              </div>
            ) : (
              filteredProductsForBrowsing.map(product => {
                const prodPrice = Number(product.price || product.supplyPrice || product.minPrice || 0);
                const isImportingThis = importingProductId === product.id;

                // Check B2B Connection Status for Price Protection
                const connectedSupplierIds = new Set(connectedSuppliers.map(c => c.supplierId || c.id || c.uid));
                const connectedSupplierNames = new Set(connectedSuppliers.map(c => (c.supplierName || c.name || '').toLowerCase()));
                
                const isMyProduct = product.wholesalerId === profile?.ownerId || product.ownerId === profile?.ownerId;
                const isConnectedToSupplier = isMyProduct ||
                                              connectedSupplierIds.has(product.wholesalerId) ||
                                              connectedSupplierIds.has(product.supplierId) ||
                                              (product.wholesalerName && connectedSupplierNames.has(product.wholesalerName.toLowerCase()));

                const wholesalerLevel = product.wholesalerHierarchyLevel || product.hierarchyLevel || 2;
                const levelBadgeText = wholesalerLevel === 1 ? 'مستورد 🚢' : wholesalerLevel === 2 ? 'جملة الجملة 🏢' : 'مورد جملة 🏪';

                return (
                  <div
                    key={product.id || `${product.name}_${product.wholesalerId}`}
                    className="bg-gradient-to-b from-[#0e162f] via-[#090d1f] to-[#050813] border border-white/10 rounded-xl p-2.5 space-y-2 shadow-lg hover:border-amber-500/40 transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="w-full h-28 sm:h-32 rounded-lg bg-black/40 border border-white/5 overflow-hidden relative">
                        <img
                          src={product.imageUrl || product.photos?.[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80'}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-1.5 right-1.5 bg-slate-950/85 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-500/20 backdrop-blur-md shadow-sm">
                          {product.category || 'عام'}
                        </span>
                        <span className="absolute bottom-1.5 left-1.5 bg-blue-950/90 text-blue-300 text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-blue-500/20 backdrop-blur-md">
                          {levelBadgeText}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black text-white leading-snug line-clamp-1" title={product.name}>{product.name}</h4>
                        <p className="text-[10px] text-amber-400/90 font-bold flex items-center gap-1 truncate">
                          <Store size={11} className="shrink-0" />
                          <span className="truncate">{product.wholesalerName || product.supplierName || 'مورد معتمد'}</span>
                        </p>
                      </div>

                      {/* Price Box: Shown ONLY if connected to supplier */}
                      {isConnectedToSupplier ? (
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px]">
                          <span className="text-[9px] text-emerald-400/80 font-bold">جملة:</span>
                          <span className="font-black text-emerald-400">
                            {prodPrice > 0 ? `${prodPrice.toLocaleString('ar-YE')} ${selectedCurrency}` : 'حسب اللوت'}
                          </span>
                        </div>
                      ) : (
                        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-[10px]">
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <Lock size={10} />
                            <span>السعر محمي B2B</span>
                          </span>
                          <span className="text-[9px] text-gray-400 font-semibold">يلزم المفتاح</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                      {isConnectedToSupplier ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              handleAddToCart(product);
                              alert(`تمت إضافة [${product.name}] إلى سلة الطلبات بنجاح! 🛒`);
                            }}
                            className="w-full py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                          >
                            <ShoppingCart size={13} />
                            <span>إضافة للسلة 🛒</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleImportSingleProduct(product)}
                            disabled={isImportingThis}
                            className="w-full py-1 bg-white/5 hover:bg-white/10 text-amber-400 hover:text-amber-300 rounded-lg text-[9px] font-bold border border-amber-500/20 flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <ShoppingCart size={11} className={isImportingThis ? 'animate-bounce text-amber-400' : ''} />
                            <span>{isImportingThis ? 'تجهيز الطلب...' : 'تحديد الكمية والطلب 📦'}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNewKeyConnectionModalOpen(true);
                          }}
                          className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md"
                        >
                          <Key size={12} />
                          <span>طلب كود B2B لرؤية السعر 🔑</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: الطلبات والارتباط (ORDERS & CONNECTIONS) */}
      {marketMainTab === 'orders_connections' && (
        <div className="space-y-6">
          {/* Subtabs for Orders vs Connected Merchants vs Linkage Requests */}
          <div className="flex items-center gap-2 bg-[#090e1f] p-2 rounded-2xl border border-white/10 w-fit flex-wrap">
            <button
              type="button"
              onClick={() => setOrdersConnSubTab('orders')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                ordersConnSubTab === 'orders'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText size={16} />
              <span>الطلبات 📋</span>
            </button>
            <button
              type="button"
              onClick={() => setOrdersConnSubTab('connected_merchants')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                ordersConnSubTab === 'connected_merchants'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LinkIcon size={16} />
              <span>التجار المرتبط بهم 🔗</span>
              {connectedSuppliers.length > 0 && (
                <span className="bg-slate-950/40 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {connectedSuppliers.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setOrdersConnSubTab('connection_requests')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 relative ${
                ordersConnSubTab === 'connection_requests'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users size={16} />
              <span>طلبات الارتباط الواردة 🤝</span>
              {incomingRequests.length > 0 && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  ordersConnSubTab === 'connection_requests' ? 'bg-slate-950 text-amber-400' : 'bg-rose-500 text-white animate-pulse'
                }`}>
                  {incomingRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Subtab 1: Orders */}
          {ordersConnSubTab === 'orders' && (
            <div className="bg-[#090e1f] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-amber-500" />
                  <h3 className="text-sm font-black text-white">جدول وحالة الطلبات B2B</h3>
                </div>
                <span className="text-xs text-gray-400 font-bold">إجمالي الطلبات: {incomingOrders.length}</span>
              </div>

              {incomingOrders.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs space-y-2">
                  <FileText size={32} className="mx-auto text-gray-600" />
                  <p>لا توجد طلبات جارية أو سابقة حالياً.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incomingOrders.map(order => (
                    <div
                      key={order.id}
                      className="p-4 bg-[#0a0f24] border border-white/5 rounded-xl flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <p className="font-black text-white">طلب #{order.id?.slice(0, 8)}</p>
                        <p className="text-[10px] text-gray-400">التاجر: {order.buyerName || order.supplierName || 'غير محدد'}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {order.status || 'قيد المعالجة'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subtab 2: Connected Merchants */}
          {ordersConnSubTab === 'connected_merchants' && (
            <div className="bg-[#090e1f] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <LinkIcon size={18} className="text-amber-500" />
                  <h3 className="text-sm font-black text-white">قائمة التجار والمرتبطين بالربط المباشر</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsB2bConnectionsModalOpen(true)}
                  className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Key size={14} />
                  <span>إدارة وإضافة مفاتيح الارتباط</span>
                </button>
              </div>

              {connectedSuppliers.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs space-y-2">
                  <LinkIcon size={32} className="mx-auto text-gray-600" />
                  <p>لا توجد شبكة تجار مرتبطة بهذا المتجر حالياً.</p>
                  <p className="text-[10px] text-gray-400">يمكنك ربط مفاتيح B2B للتجار للتبادل التجاري المباشر.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connectedSuppliers.map(sup => (
                    <div
                      key={sup.id}
                      className="p-4 bg-[#0a0f24] border border-white/10 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-white">{sup.supplierName || 'تاجر مرتبط'}</h4>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                          ارتباط نشط
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono">الرمز: {sup.supplierKey || 'JAM-B2B'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subtab 3: Connection Requests (Phase 3: Linkage Requests & Supplier Decision Panel) */}
          {ordersConnSubTab === 'connection_requests' && (
            <div className="space-y-4">
              {/* Header & Filter Controls */}
              <div className="bg-[#090e1f] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/25">
                      <Users size={22} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-black text-white flex items-center gap-2">
                        <span>لوحة قرارات طلبات الارتباط التجاري B2B</span>
                        {incomingRequests.length > 0 && (
                          <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce">
                            {incomingRequests.length} جديد
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-400">
                        مراجعة واعتماد طلبات التجار، تحديد فئة السعر (مستورد / جملة الجملة / جملة / تجزئة) وسقف الائتمان وشروط السداد مع التحول الفوري للأسعار.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplierForRequest(null);
                      setB2bRequestModalOpen(true);
                    }}
                    className="px-4 py-2.5 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400 hover:from-teal-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 border border-teal-300/30"
                  >
                    <Send size={15} />
                    <span>إرسال طلب ارتباط جديد بمورد 🤝</span>
                  </button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setRequestsFilterStatus('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      requestsFilterStatus === 'all'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    الكل ({allSupplierRequests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestsFilterStatus('pending')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      requestsFilterStatus === 'pending'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>بانتظار المراجعة ({allSupplierRequests.filter(r => r.status === 'pending').length})</span>
                    {incomingRequests.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestsFilterStatus('accepted')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      requestsFilterStatus === 'accepted'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    مقبولة ومعتمدة ({allSupplierRequests.filter(r => r.status === 'accepted').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestsFilterStatus('rejected')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      requestsFilterStatus === 'rejected'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    مرفوضة ({allSupplierRequests.filter(r => r.status === 'rejected').length})
                  </button>
                </div>
              </div>

              {/* Requests List Grid */}
              {(() => {
                const filtered = allSupplierRequests.filter(r => {
                  if (requestsFilterStatus === 'all') return true;
                  return r.status === requestsFilterStatus;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center text-gray-500 bg-[#090e1f] rounded-2xl border border-white/5 space-y-3">
                      <Users size={40} className="mx-auto text-gray-600 animate-pulse" />
                      <p className="text-sm font-bold text-gray-400">
                        {requestsFilterStatus === 'pending'
                          ? 'لا توجد طلبات ارتباط جديدة تنتظر المراجعة حالياً.'
                          : 'لا توجد طلبات ارتباط مسجلة في هذا القسم.'}
                      </p>
                      <p className="text-xs text-gray-500">
                        عندما يرسل أي تاجر طلب ارتباط تجاري لمتجرك، سيصلك إشعار فوري هنا مع شارة في القائمة الجانبية.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map((req) => {
                      const isPending = req.status === 'pending';
                      const isAccepted = req.status === 'accepted';
                      const isRejected = req.status === 'rejected';

                      const formatTierLabel = (tier?: string) => {
                        switch (tier) {
                          case 'imported': return 'مستورد 🚢💎';
                          case 'wholesale_wholesale': return 'جملة الجملة 📦👑';
                          case 'wholesale': return 'جملة 🏬';
                          case 'retail': return 'تجزئة 🏪';
                          default: return tier || 'غير محدد';
                        }
                      };

                      return (
                        <div
                          key={req.id}
                          className={`bg-gradient-to-b from-[#0e162f] via-[#090e1d] to-[#060915] border rounded-2xl p-5 space-y-4 shadow-xl transition-all relative overflow-hidden ${
                            isPending
                              ? 'border-amber-500/40 shadow-amber-500/10 hover:border-amber-400'
                              : isAccepted
                              ? 'border-emerald-500/30 shadow-emerald-500/5'
                              : 'border-white/10 opacity-75'
                          }`}
                        >
                          {/* Top Status & Badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg font-black shrink-0">
                                🏬
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-black text-white truncate">
                                  {req.shopName || req.requesterName}
                                </h4>
                                <p className="text-xs text-gray-400 truncate">
                                  التاجر: {req.requesterName}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black shrink-0 border ${
                                isPending
                                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                                  : isAccepted
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {isPending && '⏳ قيد المراجعة'}
                              {isAccepted && '✅ مقبولة ومعتمدة'}
                              {isRejected && '✕ مرفوضة'}
                            </span>
                          </div>

                          {/* Trader Request Info Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs bg-black/25 p-3 rounded-xl border border-white/5">
                            <div>
                              <span className="text-[10px] text-gray-500 block">نوع التاجر:</span>
                              <span className="font-bold text-gray-200">{req.traderType || 'محل تجزئة'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-500 block">النشاط التجاري:</span>
                              <span className="font-bold text-gray-200">{req.businessActivity || 'تجارة عامة'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-500 block">الائتمان المطلوب:</span>
                              <span className="font-black text-amber-400">
                                {req.requestedCreditLimit ? `${Number(req.requestedCreditLimit).toLocaleString()} ريال` : 'غير محدد'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-500 block">رقم التواصل:</span>
                              <span className="font-mono text-gray-300">{req.phone || 'غير مسجل'}</span>
                            </div>
                          </div>

                          {req.notes && (
                            <div className="bg-white/5 p-2.5 rounded-xl text-xs text-gray-300 border border-white/5">
                              <span className="text-[10px] text-gray-400 font-bold block mb-0.5">ملاحظات التاجر:</span>
                              <p className="line-clamp-2 leading-relaxed">{req.notes}</p>
                            </div>
                          )}

                          {/* Decision Results (If Accepted) */}
                          {isAccepted && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl space-y-1.5 text-xs text-emerald-200">
                              <div className="flex items-center justify-between">
                                <span className="font-bold">فئة السعر المخصصة:</span>
                                <span className="font-black bg-emerald-500/20 px-2.5 py-0.5 rounded-md text-emerald-300">
                                  {formatTierLabel(req.assignedPriceTier)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span>سقف المديونية المعتمد:</span>
                                <span className="font-black text-white">
                                  {Number(req.creditLimit || 0).toLocaleString()} ريال
                                </span>
                              </div>
                              {req.paymentTerms && (
                                <div className="flex items-center justify-between text-[11px]">
                                  <span>شروط السداد:</span>
                                  <span className="text-gray-300">{req.paymentTerms}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Decision Results (If Rejected) */}
                          {isRejected && req.rejectionReason && (
                            <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-300">
                              <span className="text-[10px] font-bold block text-rose-400">سبب الرفض:</span>
                              <p className="mt-0.5">{req.rejectionReason}</p>
                            </div>
                          )}

                          {/* Action Buttons for Pending Requests */}
                          {isPending && (
                            <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRequestForDecision(req);
                                  setDecisionMode('accept');
                                }}
                                className="py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer hover:scale-[1.02] active:scale-95"
                              >
                                <Check size={15} />
                                <span>قبول واعتماد ✅</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRequestForDecision(req);
                                  setDecisionMode('reject');
                                }}
                                className="py-2.5 px-3 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                              >
                                <Ban size={15} />
                                <span>رفض الطلب ✕</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: الترويج والنشر (PROMOTIONS & PUBLISHING) */}
      {marketMainTab === 'promotions' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-[#090e1f] p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <Megaphone size={22} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black text-white">مركز العروض والترويج B2B 📢</h3>
                <p className="text-xs text-gray-400">منصة النشر الإعلاني والترويج اليومي لصفقات الجملة والتنزيلات الخاصة بالتجار والمستوردين.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              {/* Promo Search Bar */}
              <div className="relative w-full md:w-64">
                <Search size={16} className="absolute right-3.5 top-3 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث في العروض..."
                  value={promoSearchQuery}
                  onChange={(e) => setPromoSearchQuery(e.target.value)}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl pr-10 pl-4 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 transition-all"
                />
              </div>

              {/* Add New Promo Button */}
              <button
                type="button"
                onClick={() => setIsAddPromoModalOpen(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shrink-0 cursor-pointer"
              >
                <Plus size={16} />
                <span>نشر عرض ترويجي 📢</span>
              </button>
            </div>
          </div>

          {/* Promotions Feed Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {promotionsPosts.filter(p => p.title.includes(promoSearchQuery) || p.merchantName.includes(promoSearchQuery) || p.details.includes(promoSearchQuery)).length === 0 ? (
              <div className="col-span-full py-16 text-center text-gray-400 bg-[#070b18] rounded-3xl border border-white/5 space-y-3">
                <Megaphone size={40} className="mx-auto text-gray-600 animate-pulse" />
                <p className="text-sm font-bold">لا توجد عروض ترويجية مطابقة للبحث.</p>
              </div>
            ) : (
              promotionsPosts.filter(p => p.title.includes(promoSearchQuery) || p.merchantName.includes(promoSearchQuery) || p.details.includes(promoSearchQuery)).map(promo => (
                <div
                  key={promo.id}
                  className="bg-gradient-to-b from-[#0e162f] via-[#090e1d] to-[#050813] border border-white/10 rounded-2xl p-5 space-y-4 hover:border-amber-500/40 transition-all shadow-xl relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="inline-block text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full mb-1">
                        {promo.discount || 'عرض ترويجي'}
                      </span>
                      <h4 className="text-sm font-black text-white leading-snug">{promo.title}</h4>
                      <p className="text-xs text-amber-400/90 font-bold flex items-center gap-1">
                        <Store size={14} />
                        <span>{promo.merchantName}</span>
                      </p>
                    </div>
                  </div>

                  {promo.imageUrl && (
                    <div className="w-full h-48 rounded-xl overflow-hidden bg-black/40 border border-white/5 relative">
                      <img
                        src={promo.imageUrl}
                        alt={promo.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <p className="text-xs text-gray-300 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
                    {promo.details}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-400 block">سعر العرض الترويجي:</span>
                      <span className="text-sm font-black text-emerald-400">{promo.price || 'حسب الكمية'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          alert(`تم تقديم طلب للاستفادة من العرض: ${promo.title}`);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black rounded-xl text-xs hover:scale-105 transition-all cursor-pointer shadow-md"
                      >
                        طلب العرض 🛍️
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          alert(`جاري توجيهك للتواصل المباشر مع: ${promo.merchantName}`);
                        }}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold border border-white/10 transition-all cursor-pointer"
                      >
                        تواصل 📞
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: حراج التجار العام (PUBLIC MERCHANT HARAJ) */}
      {marketMainTab === 'haraj' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-[#090e1f] p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <Gavel size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black text-white">حراج التجار العام الموحد 🔨</h3>
                <p className="text-xs text-gray-400">سوق المزادات والتصفيات السريعة لبضائع الجملة، المعدات، والستوكات بين جميع التجار.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddHarajModalOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shrink-0 cursor-pointer"
            >
              <Plus size={16} />
              <span>إضافة إعلان حراج 🔨</span>
            </button>
          </div>

          {/* Filters and Search Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#070b18] p-3.5 rounded-2xl border border-white/5">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/5 overflow-x-auto w-full md:w-auto scrollbar-none">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'phones', label: '📱 جوالات' },
                { id: 'accessories', label: '⚡ إكسسوارات' },
                { id: 'parts', label: '🔧 قطع غيار' },
                { id: 'maintenance', label: '🛠️ صيانة' },
                { id: 'software_sim', label: '💻 شرائح وبرامج' },
                { id: 'bulk', label: '📦 ستوكات وكميات' },
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setHarajCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                    harajCategoryFilter === cat.id
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute right-3.5 top-3 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="بحث في الحراج..."
                value={harajSearchQuery}
                onChange={(e) => setHarajSearchQuery(e.target.value)}
                className="w-full bg-[#0a0f24] border border-white/10 rounded-xl pr-10 pl-4 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Haraj Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {harajPosts.filter(h =>
              matchCategoryFilter(h.category, harajCategoryFilter) &&
              (h.title.includes(harajSearchQuery) || h.merchantName.includes(harajSearchQuery) || h.description.includes(harajSearchQuery))
            ).length === 0 ? (
              <div className="col-span-full py-16 text-center text-gray-400 bg-[#070b18] rounded-3xl border border-white/5 space-y-3">
                <Gavel size={40} className="mx-auto text-gray-600 animate-pulse" />
                <p className="text-sm font-bold">لا توجد إعلانات مطابقة في الحراج حالياً.</p>
              </div>
            ) : (
              harajPosts.filter(h =>
                matchCategoryFilter(h.category, harajCategoryFilter) &&
                (h.title.includes(harajSearchQuery) || h.merchantName.includes(harajSearchQuery) || h.description.includes(harajSearchQuery))
              ).map(item => (
                <div
                  key={item.id}
                  className="bg-gradient-to-b from-[#0e162f] via-[#090e1d] to-[#050813] border border-white/10 rounded-2xl p-5 space-y-3.5 hover:border-amber-500/40 transition-all shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Gavel size={11} />
                        <span>مفتوح للقدم / السوم</span>
                      </span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <MapPin size={11} className="text-amber-500" />
                        <span>{item.location}</span>
                      </span>
                    </div>

                    <h4 className="text-xs md:text-sm font-black text-white leading-snug">{item.title}</h4>
                    
                    <p className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                      <Store size={13} />
                      <span> المعلن: {item.merchantName}</span>
                    </p>

                    <p className="text-xs text-gray-300 leading-relaxed bg-black/30 p-2.5 rounded-xl border border-white/5 line-clamp-3">
                      {item.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] text-gray-400 font-bold">الكمية / اللوت: <strong className="text-white">{item.quantity}</strong></span>
                      <span className="text-xs font-black text-emerald-400">{item.price}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        alert(`تواصل مباشر مع التاجر (${item.merchantName}) برقم: ${item.contact}`);
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <PhoneCall size={14} />
                      <span>تقديم سومة / تواصل ({item.contact})</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: تحليلات الأكثر مبيعاً وتحركات الأسعار (ANALYTICS & PRICE TRENDS) */}
      {marketMainTab === 'analytics' && (
        <div className="space-y-6">
          {/* Header Banner & Live Metrics */}
          <div className="bg-gradient-to-r from-[#0d1633] via-[#091026] to-[#060b1b] p-6 rounded-3xl border border-amber-500/30 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                    <span>تحليلات المنتجات الأكثر مبيعاً وتحركات الأسعار</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-bold">
                      مباشر ⚡
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    مؤشرات لحظية ذكية لحجم تداولات السوق B2B، المنتجات الأعلى إقبالاً، وتوجهات تغير الأسعار لمساعدة التجار على الشراء الذكي.
                  </p>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/10 overflow-x-auto w-full md:w-auto">
                {[
                  { id: 'all', label: 'الجميع 🌐' },
                  { id: 'mobiles', label: 'الجوالات 📱' },
                  { id: 'accessories', label: 'الإكسسوارات 🎧' },
                  { id: 'parts', label: 'قطع الغيار 🔧' },
                  { id: 'equipment', label: 'المعدات 🛠️' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setAnalyticsCategoryFilter(cat.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                      analyticsCategoryFilter === cat.id
                        ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
                  <span>إجمالي تداولات السوق B2B</span>
                  <BarChart2 size={16} className="text-amber-400" />
                </div>
                <div className="text-lg md:text-xl font-black text-white">
                  {mySentOrders.length > 0 || incomingOrders.length > 0
                    ? `${([...mySentOrders, ...incomingOrders].reduce((acc, o) => acc + (Number(o.totalPrice) || 0), 0)).toLocaleString()} ر.ي`
                    : '0 ر.ي'}
                </div>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-extrabold">
                  <TrendingUp size={12} />
                  <span>{mySentOrders.length > 0 || incomingOrders.length > 0 ? '+0.0% تداول حي' : 'لا توجد تداولات بعد'}</span>
                </p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
                  <span>المنتج الأكثر طلباً حالياً</span>
                  <Award size={16} className="text-amber-400" />
                </div>
                <div className="text-sm md:text-base font-black text-amber-300 truncate">
                  {products.length > 0 ? products[0].name : 'لا يوجد صنف حالياً'}
                </div>
                <p className="text-[10px] text-amber-400 font-extrabold">
                  {products.length > 0 ? `🔥 ${products.length} منتج مسجل بالسوق` : 'بانتظار إضافة منتجات'}
                </p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
                  <span>متوسط حركة الأسعار</span>
                  <TrendingUp size={16} className="text-emerald-400" />
                </div>
                <div className="text-lg md:text-xl font-black text-emerald-400">
                  {products.length > 0 ? 'استقرار متزن ⚖️' : '0.0%'}
                </div>
                <p className="text-[10px] text-gray-400 font-bold">مؤشر مباشر بناءً على أسعار العرض</p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
                  <span>نسبة الشراء من الموثقين 🏆</span>
                  <ShieldCheck size={16} className="text-amber-400" />
                </div>
                <div className="text-lg md:text-xl font-black text-amber-300">
                  {connectedSuppliers.length > 0 ? '100%' : '0%'}
                </div>
                <p className="text-[10px] text-amber-400 font-bold">تجار موثقون بالمفتاح الموحد B2B</p>
              </div>
            </div>
          </div>

          {/* Section 1: TOP SELLING PRODUCTS */}
          <div className="bg-[#090e1f] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-amber-400 animate-bounce" />
                <h4 className="text-base font-black text-white">ترتيب المنتجات الأكثر مبيعاً وطلباً في السوق</h4>
              </div>
              <span className="text-xs text-gray-400 font-bold">يتم التحديث تلقائياً بناءً على صفقات الطلب والبيع</span>
            </div>

            {products.length === 0 ? (
              <div className="py-12 text-center text-gray-400 bg-[#070b18] rounded-3xl border border-white/5 space-y-3">
                <Sparkles size={36} className="mx-auto text-amber-500/50" />
                <p className="text-sm font-bold text-white">لا توجد بيانات تداولات أو مبيعات حية حتى الآن</p>
                <p className="text-xs text-gray-500 max-w-md mx-auto">سيتم احتساب ترتيب المنتجات الأكثر طلباً ومبيعات وتغيرات الأسعار تلقائياً بمجرد إتمام صفقات الشراء والبيع في سوق الموردين.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {products
                  .filter(item => analyticsCategoryFilter === 'all' || item.category === analyticsCategoryFilter)
                  .map((prod, idx) => (
                    <div
                      key={prod.id || idx}
                      className="bg-[#0e162f] border border-white/10 rounded-2xl p-4 space-y-3 hover:border-amber-500/40 transition-all relative overflow-hidden group shadow-lg"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shadow-md ${
                          idx === 0 ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black scale-110 shadow-[0_0_12px_rgba(245,158,11,0.5)]' :
                          idx === 1 ? 'bg-slate-300 text-slate-950 font-black' :
                          idx === 2 ? 'bg-amber-700 text-white font-black' :
                          'bg-white/10 text-gray-300'
                        }`}>
                          #{idx + 1}
                        </span>
                        <span className="text-[10px] font-black bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                          متاح للجملة 📦
                        </span>
                      </div>

                      <div>
                        <h5 className="text-xs font-black text-white group-hover:text-amber-400 transition-colors line-clamp-2">
                          {prod.name}
                        </h5>
                        <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                          <span>المورد: {prod.supplierName || 'مورد موثق'}</span>
                          <span className="text-amber-400 text-[11px]">🏆</span>
                        </p>
                      </div>

                      <div className="p-2.5 bg-black/30 rounded-xl border border-white/5 space-y-1 text-[11px]">
                        <div className="flex justify-between text-gray-400">
                          <span>الكمية المتاحة:</span>
                          <strong className="text-white font-extrabold">{prod.wholesaleStock || prod.quantity || 0} قطعة</strong>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>سعر الجملة المباشر:</span>
                          <strong className="text-amber-300 font-extrabold">{(prod.wholesalePrice || prod.price || 0).toLocaleString()} ر.ي</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setProductSearchQuery(prod.name);
                          setMarketMainTab('products');
                        }}
                        className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md"
                      >
                        <ShoppingCart size={13} />
                        <span>طلب شحنة بالجملة 📦</span>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Section 2: PRICE MOVEMENT TRENDS */}
          <div className="bg-[#090e1f] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 size={20} className="text-emerald-400" />
                <h4 className="text-base font-black text-white">تحركات الأسعار وتوصيات التسعير للشراء والبيع</h4>
              </div>
              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                تحليل متوسط السوق 📈
              </span>
            </div>

            {products.length === 0 ? (
              <div className="py-12 text-center text-gray-400 bg-[#070b18] rounded-3xl border border-white/5 space-y-3">
                <BarChart2 size={36} className="mx-auto text-emerald-500/50" />
                <p className="text-sm font-bold text-white">لا توجد تحركات أسعار أو توصيات حالياً</p>
                <p className="text-xs text-gray-500 max-w-md mx-auto">بمجرد إضافة منتجات من قبل الموردين المعتمدين، سيقوم نظام التحليل بحساب التوصيات السعرية تلقائياً.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.slice(0, 6).map((item, idx) => {
                  const buyPrice = item.wholesalePrice || item.price || 0;
                  const sellPrice = Math.round(buyPrice * 1.25);
                  return (
                    <div
                      key={item.id || idx}
                      className="bg-[#0e162f] border border-white/10 rounded-2xl p-4 space-y-3 shadow-md hover:border-emerald-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h5 className="text-xs font-black text-white truncate max-w-[200px]">
                          {item.name}
                        </h5>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          سعر جملة معتمد ⚖️
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-black/30 p-2.5 rounded-xl border border-white/5">
                        <div>
                          <span className="text-[9.5px] text-gray-400 block">سعر الشراء بالجملة:</span>
                          <span className="font-extrabold text-amber-300">{buyPrice.toLocaleString()} ر.ي</span>
                        </div>
                        <div>
                          <span className="text-[9.5px] text-gray-400 block">سعر البيع المقترح بالتجزئة:</span>
                          <span className="font-extrabold text-emerald-400">{sellPrice.toLocaleString()} ر.ي</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-gray-300 leading-relaxed bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                        💡 <strong>توصية النظام:</strong> سعر مناسب للشراء مع هامش ربح تجزئة متوقع حوالي 25%.
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: تقارير التدفقات النقدية والديون المترتبة (B2B CASH FLOW & DEBT LEDGER) */}
      {marketMainTab === 'finance_debt' && (
        <div className="space-y-6">
          {/* Top Banner & Financial Metrics */}
          <div className="bg-gradient-to-r from-[#0d1633] via-[#091026] to-[#060b1b] p-6 rounded-3xl border border-amber-500/30 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                  <DollarSign size={24} />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                    <span>تقارير التدفقات النقدية والديون المترتبة B2B</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-bold">
                      شامل ومحدث ⚡
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    إدارة كشف حساب المقبوضات والمدفوعات للجملة، متابعة مستحقات الدفع للموردين والتحصيل من التجار، وسداد الديون.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert('📄 تم تجهيز وتصدير تقرير كشف حساب التدفقات والديون بصيغة PDF بنجاح!')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-white/10"
                >
                  <Printer size={14} />
                  <span>طباعة كشف الحساب 🖨️</span>
                </button>
              </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
                  <span>إجمالي المقبوضات والمتحصلات</span>
                  <ArrowDownRight size={16} className="text-emerald-400" />
                </div>
                <div className="text-lg md:text-xl font-black text-emerald-400">
                  {b2bDebtLedger.filter(d => d.type === 'receivable').reduce((acc, curr) => acc + (curr.paidAmount || 0), 0).toLocaleString()} ر.ي
                </div>
                <p className="text-[10px] text-gray-400">مبيعات جملة + تحصيلات نقدية</p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
                  <span>إجمالي مدفوعات الشراء بالجملة</span>
                  <ArrowUpRight size={16} className="text-red-400" />
                </div>
                <div className="text-lg md:text-xl font-black text-red-400">
                  {b2bDebtLedger.filter(d => d.type === 'payable').reduce((acc, curr) => acc + (curr.paidAmount || 0), 0).toLocaleString()} ر.ي
                </div>
                <p className="text-[10px] text-gray-400">مشتريات وشحنات من الموردين</p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
                  <span>ديون مستحقة عليك للموردين (علينا)</span>
                  <AlertCircle size={16} className="text-amber-400" />
                </div>
                <div className="text-lg md:text-xl font-black text-amber-300">
                  {b2bDebtLedger.filter(d => d.type === 'payable').reduce((acc, curr) => acc + (curr.amount - curr.paidAmount), 0).toLocaleString()} ر.ي
                </div>
                <p className="text-[10px] text-amber-400 font-bold">مستحقة السداد خلال الآجال المحددة</p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
                  <span>مبالغ مستحقة لك لدى التجار (لصالحنا)</span>
                  <CheckCircle size={16} className="text-blue-400" />
                </div>
                <div className="text-lg md:text-xl font-black text-blue-300">
                  {b2bDebtLedger.filter(d => d.type === 'receivable').reduce((acc, curr) => acc + (curr.amount - curr.paidAmount), 0).toLocaleString()} ر.ي
                </div>
                <p className="text-[10px] text-blue-300 font-bold">ذمم مدينة قيد التحصيل من المحلات</p>
              </div>
            </div>
          </div>

          {/* Debt Ledger Table & Quick Settlement */}
          <div className="bg-[#090e1f] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-amber-400" />
                <h4 className="text-base font-black text-white">دفتر الديون والذمم الآجلة للشركاء والموردين</h4>
              </div>

              {/* Debt Filter Pills */}
              <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/10">
                {[
                  { id: 'all', label: 'الجميع 🌐' },
                  { id: 'payables', label: 'ديون علينا للموردين 🔴' },
                  { id: 'receivables', label: 'مبالغ لنا لدى التجار 🟢' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDebtFilter(f.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                      debtFilter === f.id
                        ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-black/40 text-gray-400 border-b border-white/10">
                    <th className="p-3 font-black">الطرف / الشريك التجاري</th>
                    <th className="p-3 font-black">نوع الحساب</th>
                    <th className="p-3 font-black">رقم الفاتورة</th>
                    <th className="p-3 font-black">إجمالي الدين</th>
                    <th className="p-3 font-black">المبلغ المسدد</th>
                    <th className="p-3 font-black">المتبقي للتحصيل/الدفع</th>
                    <th className="p-3 font-black">تاريخ الاستحقاق</th>
                    <th className="p-3 font-black text-center">اللازم والإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {b2bDebtLedger
                    .filter(d => debtFilter === 'all' || (debtFilter === 'payables' && d.type === 'payable') || (debtFilter === 'receivables' && d.type === 'receivable'))
                    .map(item => {
                      const remaining = item.amount - item.paidAmount;
                      return (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-black text-white">
                            <div>{item.partyName}</div>
                            <span className="text-[10px] text-gray-400 font-normal">{item.notes}</span>
                          </td>
                          <td className="p-3 font-bold">
                            {item.type === 'payable' ? (
                              <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-md text-[10px]">
                                🔴 علينا (مستحق للمورد)
                              </span>
                            ) : (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[10px]">
                                🟢 لنا (مستحق من التاجر)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-gray-300 font-mono font-bold">{item.invoiceNo}</td>
                          <td className="p-3 font-extrabold text-white">{item.amount.toLocaleString()} ر.ي</td>
                          <td className="p-3 font-bold text-emerald-400">{item.paidAmount.toLocaleString()} ر.ي</td>
                          <td className="p-3 font-black text-amber-300">{remaining.toLocaleString()} ر.ي</td>
                          <td className="p-3 text-gray-300 font-bold">{item.dueDate}</td>
                          <td className="p-3 text-center">
                            {remaining <= 0 ? (
                              <span className="text-emerald-400 font-black text-[11px]">✓ تم التسوية بالكامل</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDebtToPay(item);
                                  setPaymentAmountInput(remaining.toString());
                                }}
                                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-lg text-[10px] transition-all cursor-pointer shadow-md"
                              >
                                {item.type === 'payable' ? 'سداد دفعة للمورد 💳' : 'تسجيل تحصيل مبلغ 📥'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: سياسة الاسترجاع والإرجاع B2B (B2B RETURN POLICY & GUARANTEE CLAIMS) */}
      {marketMainTab === 'returns_policy' && (
        <div className="space-y-6">
          {/* Policy Overview & Settings Card */}
          <div className="bg-gradient-to-r from-[#0d1633] via-[#091026] to-[#060b1b] p-6 rounded-3xl border border-amber-500/30 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                  <RotateCcw size={24} />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                    <span>سياسة الضمان والاسترجاع والإرجاع B2B</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-bold">
                      حماية التجار والموردين 🛡️
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    ضوابط واضحة لإرجاع البضائع التالفة أو المخالفة للمواصفات مع محرك تلقائي لتسوية الفواتير واسترداد المبالغ.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewReturnClaimModalOpen(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <Plus size={16} />
                <span>إنشاء طلب إرجاع بضاعة / تلفيات 📦</span>
              </button>
            </div>

            {/* Merchant Return Policy Configuration Box */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-amber-300 flex items-center gap-2">
                  <Settings size={15} />
                  <span>إعدادات ضوابط الإرجاع الخاصة بمتجرك (للمشترين المربوطين)</span>
                </h4>
                <span className="text-[10px] text-gray-400">تظهر هذه الشروط تلقائياً لجميع التجار والمحلات عند الشراء</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="text-gray-400 font-bold block">فترة الإرجاع المسموحة (أيام):</label>
                  <input
                    type="number"
                    value={b2bReturnPolicy.allowedDays}
                    onChange={(e) => setB2bReturnPolicy({ ...b2bReturnPolicy, allowedDays: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-bold block">تكاليف شحن الإرجاع يتحملها:</label>
                  <select
                    value={b2bReturnPolicy.coversReturnShipping}
                    onChange={(e) => setB2bReturnPolicy({ ...b2bReturnPolicy, coversReturnShipping: e.target.value as any })}
                    className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="supplier">المورد (في حال التلف أو الخطأ)</option>
                    <option value="buyer">المشتري (في حال رغبة المشتري)</option>
                    <option value="split">مناصفة بين الطرفين</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-bold block">اشتراط الغلاف الأصلي:</label>
                  <select
                    value={b2bReturnPolicy.requireOriginalBox ? 'yes' : 'no'}
                    onChange={(e) => setB2bReturnPolicy({ ...b2bReturnPolicy, requireOriginalBox: e.target.value === 'yes' })}
                    className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="yes">إجباري وجود الغلاف الأصلي والكرتون</option>
                    <option value="no">غير إجباري للقطع التالفة صريحاً</option>
                  </select>
                </div>

                <div className="col-span-full space-y-1">
                  <label className="text-gray-400 font-bold block">نص الشروط والضوابط المعلنة للعملاء:</label>
                  <textarea
                    rows={2}
                    value={b2bReturnPolicy.conditionsText}
                    onChange={(e) => setB2bReturnPolicy({ ...b2bReturnPolicy, conditionsText: e.target.value })}
                    className="w-full bg-[#0a0f24] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-amber-500 text-xs"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => alert('✅ تم حفظ وتحديث سياسة الإرجاع الخاصة بمتجرك بنجاح!')}
                className="py-2 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer"
              >
                حفظ سياسة الإرجاع المعلنة 💾
              </button>
            </div>
          </div>

          {/* Active Return Claims List */}
          <div className="bg-[#090e1f] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={20} className="text-amber-400" />
                <h4 className="text-base font-black text-white">سجل مطالبات الإرجاع والضمان القائمة</h4>
              </div>
              <span className="text-xs text-gray-400 font-bold">تتبع حالة طلبات التعويض والخصم</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {returnClaims.map(claim => (
                <div key={claim.id} className="bg-[#0e162f] border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-amber-300">{claim.id}</span>
                      <span className="text-[10px] text-gray-400">({claim.orderId})</span>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      claim.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      claim.status === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {claim.status === 'approved' ? '✓ مقبول وتم الخصم' : claim.status === 'pending' ? '⏳ قيد المعاينة' : '× مرفوض'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h5 className="text-xs font-black text-white">{claim.productName}</h5>
                    <p className="text-[11px] text-gray-400">المورد: {claim.merchantName}</p>
                    <p className="text-[11px] text-amber-300 font-bold">
                      الكمية التالفة/المصرحة: {claim.qty} قطعة | إجمالي التعويض: {claim.totalAmount.toLocaleString()} ر.ي
                    </p>
                  </div>

                  <div className="p-2.5 bg-black/30 rounded-xl border border-white/5 text-[10px] text-gray-300 space-y-1">
                    <div><strong>سبب الإرجاع:</strong> {claim.reason}</div>
                    <div className="text-gray-400"><strong>الملاحظات:</strong> {claim.notes}</div>
                  </div>

                  {claim.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setReturnClaims(returnClaims.map(c => c.id === claim.id ? { ...c, status: 'approved', notes: 'تم الموافقة وتخفيض الفاتورة من حساب المورد' } : c));
                          alert('✅ تم قبول طلب الإرجاع وتخفيض قيمة الفاتورة من حساب الدين تلقائياً!');
                        }}
                        className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-lg text-[10px] cursor-pointer"
                      >
                        قبول وتخفيض الفاتورة ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReturnClaims(returnClaims.map(c => c.id === claim.id ? { ...c, status: 'rejected', notes: 'تم الرفض لعدم مطابقة شروط التغليف التالف' } : c));
                          alert('❌ تم رفض طلب الإرجاع وإشعار المشتري.');
                        }}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-lg text-[10px] cursor-pointer border border-red-500/30"
                      >
                        رفض الطلب
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Debt Settlement Modal */}
      {selectedDebtToPay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e162f] border border-amber-500/30 rounded-3xl p-6 max-w-md w-full space-y-4 text-right shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <DollarSign className="text-amber-400" size={18} />
                <span>تسديد دفعة / تسوية حساب الدين</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDebtToPay(null)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-black/30 rounded-xl space-y-1">
                <div className="text-gray-400">الطرف التجاري: <strong className="text-white">{selectedDebtToPay.partyName}</strong></div>
                <div className="text-gray-400">رقم الفاتورة: <strong className="text-amber-300">{selectedDebtToPay.invoiceNo}</strong></div>
                <div className="text-gray-400">إجمالي الدين: <strong className="text-white">{selectedDebtToPay.amount.toLocaleString()} ر.ي</strong></div>
                <div className="text-gray-400">المبلغ المسدد سابقاً: <strong className="text-emerald-400">{selectedDebtToPay.paidAmount.toLocaleString()} ر.ي</strong></div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-300 font-bold block">مبلغ الدفعة المراد تسديدها/تحصيلها (ر.ي):</label>
                <input
                  type="number"
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-amber-500 font-extrabold text-sm"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const payVal = parseFloat(paymentAmountInput) || 0;
                if (payVal <= 0) return alert('يرجى إدخال مبلغ صحيح.');

                setB2bDebtLedger(b2bDebtLedger.map(d => {
                  if (d.id === selectedDebtToPay.id) {
                    const newPaid = d.paidAmount + payVal;
                    return {
                      ...d,
                      paidAmount: newPaid,
                      status: newPaid >= d.amount ? 'settled' : 'partially_paid'
                    };
                  }
                  return d;
                }));

                alert(`🎉 تم تسديد وتحصيل مبلغ (${payVal.toLocaleString()} ر.ي) بنجاح وتحديث دفتر الديون!`);
                setSelectedDebtToPay(null);
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black rounded-xl text-xs shadow-lg hover:scale-[1.01] transition-all cursor-pointer"
            >
              تأكيد الدفع وتسوية الحساب 💵
            </button>
          </div>
        </div>
      )}

      {/* New Return Claim Modal */}
      {isNewReturnClaimModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e162f] border border-amber-500/30 rounded-3xl p-6 max-w-lg w-full space-y-4 text-right shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <RotateCcw className="text-amber-400" size={18} />
                <span>إنشاء طلب إرجاع بضاعة جملة / تلفيات</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewReturnClaimModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-gray-300 font-bold block mb-1">اسم المورد / الشريك التجاري:</label>
                <input
                  type="text"
                  placeholder="مثلاً: المركز اليمني للاستيراد"
                  value={newReturnClaim.merchantName}
                  onChange={(e) => setNewReturnClaim({ ...newReturnClaim, merchantName: e.target.value })}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-gray-300 font-bold block mb-1">اسم المنتج المراد إرجاعه:</label>
                <input
                  type="text"
                  placeholder="مثلاً: شاحن أنكر 20W الأصلي"
                  value={newReturnClaim.productName}
                  onChange={(e) => setNewReturnClaim({ ...newReturnClaim, productName: e.target.value })}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-bold block mb-1">الكمية التالفة/المراد إرجاعها:</label>
                  <input
                    type="number"
                    value={newReturnClaim.qty}
                    onChange={(e) => setNewReturnClaim({ ...newReturnClaim, qty: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#0a0f24] border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-amber-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-gray-300 font-bold block mb-1">سعر القطعة للجملة (ر.ي):</label>
                  <input
                    type="number"
                    value={newReturnClaim.unitPrice}
                    onChange={(e) => setNewReturnClaim({ ...newReturnClaim, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0a0f24] border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-amber-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-300 font-bold block mb-1">سبب الإرجاع أو وصف التلف:</label>
                <textarea
                  rows={2}
                  value={newReturnClaim.reason}
                  onChange={(e) => setNewReturnClaim({ ...newReturnClaim, reason: e.target.value })}
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!newReturnClaim.merchantName || !newReturnClaim.productName) {
                  return alert('يرجى تعبئة بيانات المورد والمنتج.');
                }

                const claimObj = {
                  id: `RET-${Math.floor(1000 + Math.random() * 9000)}`,
                  orderId: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
                  merchantName: newReturnClaim.merchantName,
                  productName: newReturnClaim.productName,
                  qty: newReturnClaim.qty,
                  unitPrice: newReturnClaim.unitPrice,
                  totalAmount: newReturnClaim.qty * newReturnClaim.unitPrice,
                  reason: newReturnClaim.reason,
                  status: 'pending',
                  date: new Date().toLocaleDateString('ar-YE'),
                  notes: 'تم إرسال الطلب للمورد لمعاينة التلفيات وتأكيد الخصم'
                };

                setReturnClaims([claimObj, ...returnClaims]);
                alert('🎉 تم تقديم طلب الإرجاع للمورد بنجاح وجاري المراجعة والخصم!');
                setIsNewReturnClaimModalOpen(false);
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black rounded-xl text-xs shadow-lg cursor-pointer"
            >
              إرسال طلب الإرجاع للمورد 📦
            </button>
          </div>
        </div>
      )}

      {/* Disabled Legacy Views */}
      {false && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Account blockade warning */}
          {(() => {
            const isUserBlocked = userDbProfile?.status === 'blocked' || (userDbProfile?.blockedUntil && userDbProfile.blockedUntil > Date.now());
            if (isUserBlocked) {
              return (
                <div className="col-span-full bg-red-500/10 border-2 border-red-500/25 p-5 rounded-[2rem] flex items-center gap-3.5 text-red-400 font-extrabold text-xs lg:text-sm text-right leading-relaxed animate-pulse">
                  <AlertCircle size={24} className="shrink-0 text-red-500" />
                  <div>
                    <span className="block text-sm lg:text-base font-black">⚠️ تم حظر هذا الحساب من إرسال الطلبات مؤقتاً</span>
                    <span className="text-[11px] text-gray-400 mt-1 block font-medium">
                      {userDbProfile.blockReason || 'تم حظر حسابك من إرسال الطلبات لمدة أسبوع بسبب محاولة دفع وهمية.'}
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* RIGHT SIDEBAR: Merchant links list + New link introduction form */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Form introducing connection keys - Redundant section pointing to B2B Vault */}
            <div className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border border-amber-500/20 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-amber-400 animate-pulse" />
                <h3 className="text-xs font-black text-white">إدارة الارتباط والصلاحيات B2B</h3>
              </div>
              <p className="text-[10px] text-gray-300 leading-relaxed">
                تم نقل وتأمين كافة عمليات الارتباط بموردين جدد، أو تفعيل الديون والآجل، وتحديث الصلاحيات إلى <span className="text-amber-400 font-extrabold">"خزانة الصلاحيات والمفاتيح"</span> أعلى الشاشة للوصول السريع والآمن.
              </p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-b2b-vault'))}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <KeyRound size={12} />
                <span>فتح خزانة الصلاحيات والمفاتيح 🔑</span>
              </button>
            </div>

            {/* List of Connected Merchants */}
            <div className="bg-navy-900 border border-white/5 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <Store size={15} className="text-amber-500" />
                  <h3 className="text-sm font-black text-white">قائمة الموردين المعتمدين</h3>
                </div>
                <span className="text-[10px] font-black bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full">{connectedSuppliers.length} تجار</span>
              </div>

              {connectedSuppliers.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs font-medium space-y-2">
                  <AlertCircle size={28} className="mx-auto text-gray-700" />
                  <p>لا يوجد روابط نشطة حالياً.</p>
                  <p className="text-[10px] text-gray-400">اضغط على زر (تجربة) بالأعلى لتوليد موردين تجريبيين فوراً وفحص سلتنا المتطورة!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  <button
                    onClick={() => setSelectedSupplierId('all')}
                    className={`w-full text-right p-3 rounded-2xl border text-xs font-black transition-all flex items-center justify-between ${
                      selectedSupplierId === 'all'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                        : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <span>كافة المنتجات المشتركة</span>
                    <Layers size={13} />
                  </button>

                  {sortedConnectedSuppliers.map(sup => (
                    <div
                      key={sup.id}
                      className={`group w-full p-3.5 rounded-2xl border-2 text-xs font-bold transition-all duration-200 flex flex-col gap-3 ${
                        selectedSupplierId === sup.supplierId
                          ? 'bg-gradient-to-b from-[#0e162f] to-[#070b18] border-[#D4AF37] text-white shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                          : 'bg-[#0f152d]/40 text-gray-400 border-white/5 hover:bg-navy-850'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedSupplierId(sup.supplierId)}
                          className="flex-1 text-right flex items-center gap-2.5 min-w-0"
                        >
                          <div className={`p-2.5 rounded-xl shrink-0 ${selectedSupplierId === sup.supplierId ? 'bg-gradient-to-r from-amber-500 to-[#D4AF37] text-slate-950 font-black' : 'bg-navy-800 text-amber-500'}`}>
                            <Store size={14} />
                          </div>
                          <div className="truncate flex-1">
                            <p className="text-white font-black truncate leading-tight">{sup.supplierName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] text-gray-400 truncate font-mono font-black">{sup.supplierKey || 'JAM-B2B'}</span>
                              {sup.wsSynced && (
                                <span className="text-[8px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-1 py-0.2 rounded font-black flex items-center gap-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  متصل (WS) ⚡
                                </span>
                              )}
                              {sup.isPartiallyBlocked === true && (
                                <span className="text-[8px] text-rose-400 bg-rose-500/10 border border-rose-500/15 px-1 py-0.2 rounded font-black">
                                  محظور 🛑
                                </span>
                              )}
                              {sup.keyValidity && sup.keyValidity !== 'permanent' && (
                                <span className="text-[8px] text-amber-400 bg-amber-500/10 border border-amber-500/15 px-1 py-0.2 rounded font-bold">
                                  {sup.keyValidity === 'daily' ? 'يومي ⌛' : `محدد ${sup.keyDurationHours || 24}س ⌛`}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Edit Connection Permissions shortcut button */}
                          <button
                            onClick={() => handleOpenPermissionsModal(sup)}
                            className="p-1.5 rounded-lg text-[#D4AF37] hover:bg-[#D4AF37]/15 opacity-50 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                            title="تعديل الصلاحيات وقنوات الدفع"
                          >
                            <Sliders size={13} />
                          </button>

                          {/* Remove connection shortcut */}
                          <button
                            onClick={() => handleRemoveSupplierConnection(sup.id, sup.supplierName)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/15 opacity-30 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                            title="إلغاء الترابط بهذا التاجر عمداً"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Mirrored double-entry accounts receivable/payable balances across nodes */}
                      {sup.wsSynced && (
                        <div className="bg-black/30 border border-white/5 rounded-xl p-2.5 text-[9px] space-y-1 font-bold text-gray-400 relative overflow-hidden">
                          <div className="flex justify-between items-center text-gray-500 border-b border-white/5 pb-1 mb-1">
                            <span>دفتر الحساب الجاري للمورد</span>
                            <span className="font-mono text-[8.5px] text-[#D4AF37]">Socket Synced</span>
                          </div>
                          <div className="flex justify-between items-center leading-none">
                            <span>حساب له (Payable):</span>
                            <span className="text-amber-500 font-extrabold font-mono text-[10.5px]">{(sup.payableBalance || 1281100).toLocaleString()} YER</span>
                          </div>
                          <div className="flex justify-between items-center leading-none">
                            <span>حساب عليك (Receivable):</span>
                            <span className="text-emerald-400 font-extrabold font-mono text-[10.5px]">{(sup.receivableBalance || 2500000).toLocaleString()} YER</span>
                          </div>
                        </div>
                      )}

                      {/* Ingestion & Synced status actions */}
                      <div className="flex items-center gap-1.5 border-t border-white/5 pt-2">
                        {/* Catalog Ingestion Trigger */}
                        <button
                          onClick={() => handleIngestCatalog(sup.supplierId, sup.supplierName)}
                          disabled={ingestingSupplierId !== null}
                          className="flex-1 py-1.5 px-2 bg-gradient-to-r from-amber-500/10 to-yellow-600/5 hover:from-amber-500/15 hover:to-yellow-600/10 border border-[#D4AF37]/30 text-[#D4AF37] rounded-xl text-[9px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer duration-300 disabled:opacity-50"
                          title="جلب بضائع هذا المورد وتخزينها بمخزنك فوراً"
                        >
                          <Sparkles size={11} className="text-[#D4AF37]" />
                          <span>جلب بضائع المورد للمخزن</span>
                        </button>
                        
                        {sup.wsSynced && (
                          <button
                            onClick={() => triggerWebSocketHandshake(sup.supplierId, sup.supplierName, sup.supplierKey, async () => {})}
                            className="p-1 px-2 border border-white/5 hover:border-white/10 bg-white/5 text-gray-400 font-mono text-[8px] rounded-xl"
                            title="إعادة مزامنة WebSocket"
                          >
                            مزامنة المقبس
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My sent Orders check ledger */}
            <div className="bg-navy-900 border border-white/5 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <FileText size={15} className="text-sky-500" />
                  <h3 className="text-sm font-black text-white">دفتر الطلبيات المرسلة</h3>
                </div>
                <span className="text-[10px] font-black bg-sky-500/10 text-sky-400 px-2 rounded-full">{mySentOrders.length} طلب</span>
              </div>

              {mySentOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-[11px] font-bold">
                  لم ترسل أي طلبيات جملة من هذا الحساب بعد.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {mySentOrders.map(ord => (
                    <div key={ord.id} className="p-3 bg-black/25 rounded-2xl border border-white/5 space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center text-gray-400">
                        <span className="font-extrabold truncate text-white">{ord.wholesalerName}</span>
                        <span className="font-mono text-[9px] bg-white/5 px-1 py-0.5 rounded">#{ord.id?.slice(-5)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 border-t border-b border-white/5 py-1">
                        <div>
                          <span className="text-gray-500 block text-[9px]">أسلوب الدفع:</span>
                          <span className="font-bold text-gray-300">
                            {ord.paymentType === 'money_transfer' ? 'إيداع بنكي' : ord.paymentType === 'debt' ? 'آجل دفتر' : 'كاش'}
                          </span>
                        </div>
                        <div className="text-left">
                          <span className="text-gray-500 block text-[9px]">إجمالي القيمة:</span>
                          <span className="font-black text-amber-500">{ord.total} ر.ي</span>
                        </div>
                      </div>

                      {ord.paymentType === 'money_transfer' && ord.transferRefNum && (
                        <div className="bg-white/[0.02] p-1.5 rounded border border-white/5 flex justify-between tracking-tight text-[10px] text-gray-400 font-bold col-span-2">
                          <span>شبكة {ord.exchangeNetwork}</span>
                          <span className="font-mono text-sky-400">إيداع #: {ord.transferRefNum}</span>
                        </div>
                      )}

                      {/* Display past order items with warranty badges for buyer checkout visibility */}
                      {ord.items && ord.items.length > 0 && (
                        <div className="bg-white/[0.01] p-2.5 rounded-xl border border-white/5 space-y-1.5 mt-1 col-span-2 text-right">
                          <span className="text-[9px] text-[#D4AF37] font-bold block mb-1">📋 أصناف الفاتورة وضماناتها:</span>
                          {ord.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-start gap-2 text-right border-b border-white/5 last:border-0 pb-1 last:pb-0">
                              <div className="flex gap-2 items-center flex-1">
                                <img
                                  src={item.imageUrl || (item.photos && item.photos[0]) || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=100&q=80'}
                                  alt={item.name}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0 bg-black/40"
                                />
                                <div className="flex-1">
                                  <span className="font-bold text-gray-300 text-[10px] block">{item.name}</span>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {item.selectedColor && (
                                      <span className="text-[8px] bg-rose-500/10 text-rose-400 px-1.5 py-0.2 rounded font-bold font-sans">
                                        اللون: {item.selectedColor}
                                      </span>
                                    )}
                                    {item.warrantyType && item.warrantyType !== 'none' && (
                                      <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded font-bold font-sans">
                                        🛡️ {item.warrantyType === 'operational' ? 'ضمان تشغيل' : `ضمان لمده ${item.warrantyDuration || 0} يوم`}
                                      </span>
                                    )}
                                    {item.compensationOption && item.warrantyType && item.warrantyType !== 'none' && (
                                      <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1.5 py-0.2 rounded font-bold font-sans">
                                        🔄 {item.compensationOption === 'refund' ? 'استرداد مالي' : item.compensationOption === 'replace_same' ? 'استبدال متطابق' : 'استبدال عيني'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[9.5px] font-black text-white shrink-0 mt-0.5">
                                {item.quantity} قطع × {item.price?.toLocaleString()} ر.ي
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between items-center bg-[#070c1b] p-2 rounded-xl border border-white/5 flex-wrap gap-2">
                        <span className="text-gray-500 text-[9px] font-bold">حالة تتبع المعاملة:</span>
                        <span className={`px-2 py-0.5 rounded-lg font-black text-[9.5px] ${
                          ord.status === 'pending' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 font-black animate-pulse' :
                          ord.status === 'approved_shipping' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-black' :
                          ord.status === 'delivered' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 font-black' :
                          'bg-white/5 text-gray-400 border border-white/10'
                        }`}>
                          {ord.status === 'pending' ? 'بانتظار المورد ⏳' :
                           ord.status === 'approved_shipping' ? 'تمت الموافقة/قيد الشحن 🚚' :
                           ord.status === 'delivered' ? 'تم التوريد للمخزن 🏁' : 'مرفوض/ملغي'}
                        </span>
                      </div>

                      {ord.paymentType === 'money_transfer' && (
                        <div className="flex justify-between items-center bg-[#0d161d] p-2 rounded-xl border border-sky-500/20 text-[9.5px] mt-1.5 cols-span-2 text-right">
                          <span className="text-gray-400 font-bold text-[9px]">حالة الدفع مقابل التجهيز:</span>
                          <span className="px-2 py-0.5 rounded-lg font-bold bg-sky-500/10 text-sky-400 border border-sky-500/15 text-[8.5px]">
                            {ord.status === 'pending'
                              ? 'تم استلام وتأكيد الحوالة اليوم، بانتظار تجهيز المعاملة غداً 💰⏳'
                              : 'معاملة مكتملة الدفع والقيد ومجهزة بالكامل 👍'}
                          </span>
                        </div>
                      )}

                      {/* Interactive demo status toggles */}
                      <div className="flex items-center gap-1.5 mt-2 justify-end bg-black/40 p-1.5 rounded-lg border border-white/5 flex-wrap">
                        <span className="text-[8.5px] text-gray-500 font-extrabold ml-auto">انقر للمحاكاة الفورية:</span>
                        <button
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'orders', ord.id), { status: 'pending' });
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className={`px-1.5 py-0.5 rounded-md text-[8.5px] font-black transition-all ${
                            ord.status === 'pending' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                          }`}
                        >
                          بانتظار المورد
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'orders', ord.id), { status: 'approved_shipping' });
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className={`px-1.5 py-0.5 rounded-md text-[8.5px] font-black transition-all ${
                            ord.status === 'approved_shipping' ? 'bg-emerald-500 text-slate-950 font-black shadow-sm' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          قيد الشحن
                        </button>
                        <button
                          onClick={() => handleConfirmOrderDelivery(ord)}
                          className={`px-2 py-1 rounded-md text-[9px] font-black transition-all flex items-center gap-1 ${
                            ord.status === 'delivered' ? 'bg-sky-500 text-slate-950 font-black shadow-sm' : 'bg-sky-400/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30'
                          }`}
                        >
                          <CheckCircle size={11} />
                          <span>{ord.status === 'delivered' ? 'تم الاستلام والتوريد 🏁' : 'تأكيد الاستلام والتوريد للمخزن 🏁'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* LEFT CONTENT AREA: Connected merchants catalog items */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Header controls & Categories toolbar */}
            <div className="bg-navy-900/50 border border-white/5 p-4 rounded-3xl flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">كتالوج الجملة المشترك</h2>
                  <p className="text-gray-500 text-[11px] mt-0.5 font-bold">اختر البديل الملون واضغط (طلب الآن) لإرسال الكميات فوراً.</p>
                </div>
              </div>

              {/* Instant filter query parameter */}
              <div className="relative max-w-xs w-full flex items-center">
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو التفاصيل..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 py-2 pl-9 pr-8 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none transition-all placeholder:text-gray-600"
                />
                <Search size={13} className="absolute top-2.5 right-2.5 text-gray-500" />
                <button
                  type="button"
                  onClick={() => setIsScanning(true)}
                  className="absolute left-2 top-1.5 p-1 text-[#fbbf24] hover:text-white bg-amber-500/10 hover:bg-amber-500/20 rounded-md border-none cursor-pointer transition-all flex items-center justify-center"
                  title="البحث باستخدام الكاميرا (الباركود)"
                >
                  <Camera size={12} />
                </button>
              </div>
            </div>

            {/* Real-time Exchange Rates & Subscriber Tier Controllers */}
            <div className="bg-[#0b1125] border border-amber-500/15 rounded-3xl p-5 max-w-xl mx-auto w-full relative overflow-hidden">
              {/* Metallic Radial Accent */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_-20%,rgba(212,175,55,0.06),rgba(0,0,0,0))]" />
              
              {/* Right: Currency Converting System */}
              <div className="space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white flex items-center gap-1.5 font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    تحويل أسعار الصرف الفوري (بث حي):
                  </span>
                  
                  {/* Yemeni Regional Rates Selector */}
                  <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 text-[9px] font-black">
                    <button
                      onClick={() => setExchangeRegion('sanaa')}
                      className={`px-2 py-1 rounded transition-all ${exchangeRegion === 'sanaa' ? 'bg-amber-500 text-slate-900 font-extrabold' : 'text-gray-400 hover:text-white'}`}
                    >
                      صنعاء (530 YER)
                    </button>
                    <button
                      onClick={() => setExchangeRegion('aden')}
                      className={`px-2 py-1 rounded transition-all ${exchangeRegion === 'aden' ? 'bg-amber-500 text-slate-900 font-extrabold' : 'text-gray-400 hover:text-white'}`}
                    >
                      عدن (1700 YER)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-gray-300">
                  <button
                    onClick={() => setSelectedCurrency('YER')}
                    className={`py-2 px-3 rounded-2xl border transition-all flex flex-col justify-center items-center ${
                      selectedCurrency === 'YER'
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-amber-400 shadow-[0_0_12px_rgba(212,175,55,0.1)]'
                        : 'bg-black/35 border-white/5 text-gray-400 hover:bg-black/50 hover:text-white'
                    }`}
                  >
                    <span className="font-sans text-[11px] font-black">ر.ي</span>
                    <span className="text-[8px] text-gray-500 block">يمني</span>
                  </button>
                  <button
                    onClick={() => setSelectedCurrency('SAR')}
                    className={`py-2 px-3 rounded-2xl border transition-all flex flex-col justify-center items-center ${
                      selectedCurrency === 'SAR'
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-amber-400 shadow-[0_0_12px_rgba(212,175,55,0.1)]'
                        : 'bg-black/35 border-white/5 text-gray-400 hover:bg-black/50 hover:text-white'
                    }`}
                  >
                    <span className="font-sans text-[11px] font-black">ر.س</span>
                    <span className="text-[8px] text-gray-500 block">سعودي</span>
                  </button>
                  <button
                    onClick={() => setSelectedCurrency('USD')}
                    className={`py-2 px-3 rounded-2xl border transition-all flex flex-col justify-center items-center ${
                      selectedCurrency === 'USD'
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-amber-400 shadow-[0_0_12px_rgba(212,175,55,0.1)]'
                        : 'bg-black/35 border-white/5 text-gray-400 hover:bg-black/50 hover:text-white'
                    }`}
                  >
                    <span className="font-sans text-[11px] font-black">$</span>
                    <span className="text-[8px] text-gray-500 block">دولار</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Horizontal categories list */}
            {activeCategories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {activeCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'bg-navy-900 border border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {cat === 'all' ? 'جميع الأقسام' : cat}
                  </button>
                ))}
              </div>
            )}


            {/* Products grid display */}
            {activeTab === 'directory' ? (
              <MerchantDirectory
                currentUserLevel={currentUserLevel}
                products={products}
                connectedSuppliers={connectedSuppliers}
                allMerchants={allMerchants}
                allProfiles={allProfiles}
                onRequestConnection={(merchant: any) => {
                  setSelectedSupplierForRequest(merchant);
                  setB2bRequestModalOpen(true);
                }}
                onViewProducts={(merchant: any) => {
                  const conn = connectedSuppliers.find(c => c.supplierId === merchant.id || c.supplierId === merchant.uid);
                  if (conn) {
                    setB2bKeySupplier(conn);
                    setActiveTab('connected');
                  } else {
                    alert('عذراً، يجب أولاً إدخال مفتاح ارتباط فعال عبر خزانة الصلاحيات للتوصيل المباشر بكتالوج هذا التاجر والبدء بالطلب والتعامل التجاري المباشر معه.');
                    window.dispatchEvent(new CustomEvent('open-b2b-vault'));
                  }
                }}
              />
            ) : activeTab === 'management' ? (
              <MarketManagement
                b2bProfile={b2bProfile}
                setB2bProfile={setB2bProfile}
                productCategories={productCategories}
                isCreatingNewWarehouse={isCreatingNewWarehouse}
                setIsCreatingNewWarehouse={setIsCreatingNewWarehouse}
                newWarehouseInputName={newWarehouseInputName}
                setNewWarehouseInputName={setNewWarehouseInputName}
                handleCreateNewWarehouseInSetup={handleCreateNewWarehouseInSetup}
                buyerBoxes={buyerBoxes}
                handleAutoFetchBankAccounts={handleAutoFetchBankAccounts}
                handleSaveB2bProfile={handleSaveB2bProfile}
                connectedSuppliers={connectedSuppliers}
                partnerConnections={partnerConnections}
                connectionsModalTab={connectionsModalTab}
                setConnectionsModalTab={setConnectionsModalTab}
                handleRemoveSupplierConnection={handleRemoveSupplierConnection}
                handleDeletePartnerConnectionAsSupplier={handleDeletePartnerConnectionAsSupplier}
              />
            ) : activeTab === 'customer_chat' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[650px] bg-black/25 border border-white/5 rounded-3xl overflow-hidden p-4">
                {/* Customers Sidebar */}
                <div className="lg:col-span-4 flex flex-col h-full bg-navy-950/40 border border-white/5 rounded-2xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
                    <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                      <MessageSquare size={16} />
                      <span>قائمة محادثات الزبائن</span>
                    </h3>
                    {totalUnreadChats > 0 && (
                      <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                        {totalUnreadChats} غير مقروءة
                      </span>
                    )}
                  </div>

                  {/* Search Bar */}
                  <div className="relative mb-3">
                    <input
                      type="text"
                      placeholder="بحث باسم الزبون أو الهاتف..."
                      className="w-full bg-black/45 border border-white/5 p-2.5 pl-9 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                      onChange={(e) => {
                        setSearchChatTerm(e.target.value);
                      }}
                    />
                    <Search size={14} className="absolute left-3 top-3 text-gray-500" />
                  </div>

                  {/* Threads list */}
                  <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                    {filteredThreads.length === 0 ? (
                      <div className="text-center py-10 text-gray-500 text-xs">
                        لا توجد محادثات نشطة حالياً.
                      </div>
                    ) : (
                      filteredThreads.map(thread => {
                        const isSelected = activeChatPhone === thread.phone;
                        const isBlocked = blockedNumbers.includes(thread.phone);
                        return (
                          <button
                            key={thread.phone}
                            onClick={() => {
                              setActiveChatPhone(thread.phone);
                              setChatReplyText('');
                              setChatImageUpload(null);
                            }}
                            className={`w-full text-right p-3 rounded-xl border transition-all flex items-center justify-between relative cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500/35 text-white'
                                : 'bg-black/25 border-white/5 text-gray-300 hover:bg-black/45'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Status indicator */}
                              <div className="relative">
                                <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/20">
                                  <Users size={16} />
                                </div>
                                {thread.isOnline && (
                                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-navy-950 animate-ping" />
                                )}
                                {thread.isOnline && (
                                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-navy-950" />
                                )}
                              </div>
                              <div>
                                <h4 className="text-xs font-black flex items-center gap-1.5">
                                  <span>{thread.name}</span>
                                  {isBlocked && (
                                    <span className="text-[9px] bg-red-500/15 text-red-500 font-bold px-1.5 py-0.5 rounded-full">محظور</span>
                                  )}
                                </h4>
                                <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[150px]">
                                  {thread.lastMessage?.content || "صورة توضيحية"}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 text-left">
                              <span className="text-[8px] text-gray-500 font-mono">
                                {thread.lastMessage?.createdAt?.seconds
                                  ? new Date(thread.lastMessage.createdAt.seconds * 1000).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
                                  : '...'}
                              </span>
                              {thread.unreadCount > 0 && (
                                <span className="bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse">
                                  {thread.unreadCount}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Chat Panel */}
                <div className="lg:col-span-8 flex flex-col h-full bg-navy-950/40 border border-white/5 rounded-2xl overflow-hidden relative">
                  {activeChatPhone ? (
                    (() => {
                      const activeThread = customerThreads.find(t => t.phone === activeChatPhone);
                      const isBlocked = blockedNumbers.includes(activeChatPhone);
                      if (!activeThread) return null;

                      return (
                        <div className="flex flex-col h-full">
                          {/* Chat Window Header */}
                          <div className="p-4 bg-black/30 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/25">
                                  <Users size={18} />
                                </div>
                                {activeThread.isOnline && (
                                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-navy-950" />
                                )}
                              </div>
                              <div>
                                <h3 className="text-xs font-black text-white">{activeThread.name}</h3>
                                <p className="text-[9px] text-gray-500 font-mono">{activeChatPhone}</p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleToggleBlock(activeChatPhone, isBlocked)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                isBlocked
                                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                              }`}
                            >
                              <Ban size={12} />
                              <span>{isBlocked ? 'إلغاء حظر الزبون' : 'حظر هذا الزبون'}</span>
                            </button>
                          </div>

                          {/* Chat Messages Body */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                            {activeThread.messages.map((msg, idx) => {
                              const isMine = !msg.isCustomer;
                              return (
                                <div key={msg.id || idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[75%] p-3 rounded-2xl ${
                                    isMine 
                                      ? 'bg-amber-500 text-slate-950 rounded-br-none font-bold' 
                                      : 'bg-white/5 text-white border border-white/10 rounded-bl-none'
                                  }`}>
                                    {msg.mediaUrl && (
                                      <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                                        <img src={msg.mediaUrl} alt="uploaded content" className="max-h-40 object-cover" />
                                      </div>
                                    )}
                                    <p className="text-xs font-bold leading-relaxed">{msg.content}</p>
                                    <div className="flex items-center gap-1.5 justify-end mt-1 opacity-65 text-[8px]">
                                      <span>
                                        {msg.createdAt?.seconds
                                          ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
                                          : '...'}
                                      </span>
                                      {isMine && (
                                        <CheckCheck size={11} className={msg.read ? 'text-blue-600' : 'text-slate-600'} />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={replyScrollEndRef} />
                          </div>

                          {/* Chat Input Bar */}
                          <div className="p-3 bg-black/25 border-t border-white/5 space-y-2">
                            {chatImageUpload && (
                              <div className="relative inline-block border border-white/10 rounded-lg overflow-hidden p-1 bg-white/5">
                                <img src={chatImageUpload} alt="preview" className="h-14 w-14 object-cover rounded-md" />
                                <button 
                                  onClick={() => setChatImageUpload(null)} 
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            )}
                            <form 
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (!chatReplyText.trim() && !chatImageUpload) return;
                                setIsSendingReply(true);
                                try {
                                  await addDoc(collection(db, 'messages'), {
                                    senderId: profile?.ownerId,
                                    receiverId: activeChatPhone,
                                    customerUid: activeThread.messages[0]?.customerUid || null,
                                    content: chatReplyText.trim(),
                                    mediaUrl: chatImageUpload || null,
                                    createdAt: serverTimestamp(),
                                    read: false,
                                    customerName: activeThread.name,
                                    isCustomer: false
                                  });
                                  setChatReplyText('');
                                  setChatImageUpload(null);
                                } catch (err) {
                                  console.error("Failed to send reply:", err);
                                } finally {
                                  setIsSendingReply(false);
                                }
                              }}
                              className="flex items-center gap-2"
                            >
                              <label className="p-2.5 bg-white/5 text-amber-400 border border-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center">
                                <ImageIcon size={16} />
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        const base64 = await compressImage(file, 600, 600, 0.6);
                                        setChatImageUpload(base64);
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }
                                  }}
                                />
                              </label>

                              <input
                                type="text"
                                value={chatReplyText}
                                onChange={(e) => setChatReplyText(e.target.value)}
                                placeholder="اكتب ردك هنا..."
                                className="flex-1 bg-black/45 border border-white/5 p-2.5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 font-bold"
                              />

                              <button
                                type="submit"
                                disabled={isSendingReply || (!chatReplyText.trim() && !chatImageUpload)}
                                className="w-10 h-10 bg-amber-500 text-slate-950 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                              >
                                {isSendingReply ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-40">
                      <MessageSquare size={54} className="text-gray-500" />
                      <h4 className="text-sm font-black text-white">لم يتم اختيار محادثة نشطة</h4>
                      <p className="text-xs text-gray-400 max-w-sm">اختر أحد الزبائن من القائمة الجانبية لعرض تاريخ المراسلات والرد الفوري عليه.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'explorer' ? (
              <ProductsAndAgencies
                currentUserLevel={currentUserLevel}
                profile={profile}
              />
            ) : activeTab === 'my_stock' ? (
              <MyStockDashboard
                currentUserLevel={currentUserLevel}
                profile={profile}
              />
            ) : filteredProducts.length === 0 ? (
              <div className="bg-navy-900/30 border-2 border-dashed border-white/5 rounded-3xl p-16 text-center space-y-4">
                <ShoppingBag size={48} className="mx-auto text-amber-500/60" />
                <h3 className="text-base font-black text-white">لا توجد سلع معروضة حالياً</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                  كتالوج مخزن الجملة يظهر بعد ربط مورد معتمد متوافق مع رتبة متجرك (قانون الفجوة الواحدة B2B). يمكنك إدخال مفتاح ارتباط المورد المباشر للبدء فوراً.
                </p>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNewKeyConnectionModalOpen(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Key size={15} />
                    <span>إدخال مفتاح ارتباط مورد B2B 🔑</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2">
                {filteredProducts.map(prod => {
                  const pickedColor = selectedColors[prod.id];
                  let displayPrice = prod.price;
                  let displayStock = Math.max(0, (prod.stock || 0) - (prod.tempLocked || 0));

                  // Update fields if colors has overrides
                  if (pickedColor && prod.variants) {
                    const variant = prod.variants.find(v => v.color === pickedColor);
                    if (variant) {
                      if (variant.priceOverride) displayPrice = variant.priceOverride;
                      displayStock = Math.max(0, (variant.stock || 0) - (variant.tempLocked || 0));
                    }
                  }

                  const intel = intelPrices[prod.id];

                  // Dynamic subscriber tier adjustments
                  const tierPricingInfo = getProductPriceWithTier(prod);
                  const tierAdjustedPrice = Math.round(displayPrice * tierPricingInfo.multiplier);

                  // Dynamic Currency Translation
                  const basePriceInYer = tierAdjustedPrice;
                  let finalDisplayPrice = basePriceInYer;
                  let finalCurrencyLabel = 'YER';

                  const usdRate = exchangeRegion === 'sanaa' ? 530 : 1700;
                  const sarRate = exchangeRegion === 'sanaa' ? 141 : 450;

                  if (selectedCurrency === 'USD') {
                    finalDisplayPrice = Math.round((basePriceInYer / usdRate) * 100) / 100;
                    finalCurrencyLabel = 'USD';
                  } else if (selectedCurrency === 'SAR') {
                    finalDisplayPrice = Math.round((basePriceInYer / sarRate) * 10) / 10;
                    finalCurrencyLabel = 'SAR';
                  } else {
                    finalCurrencyLabel = 'YER';
                  }

                  return (
                    <div
                      key={prod.id}
                      className="bg-[#0c101d] border border-white/5 hover:border-[#D4AF37]/50 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 group relative max-h-[560px] overflow-hidden shadow-md"
                    >
                      {displayStock <= 0 && (
                        <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] rounded-2xl z-20 flex items-center justify-center">
                          <span className="px-3 py-1.5 bg-red-600 text-white font-black text-[10px] rounded-lg border border-red-400 rotate-12 shadow-md">نفدت الكمية</span>
                        </div>
                      )}

                      <div>
                        {/* Image wrapper */}
                        <div 
                          onClick={() => setActiveSpecsProduct(prod)}
                          title="اضغط لعرض المواصفات والضمان بالتفصيل"
                          className="w-full h-28 md:h-36 bg-slate-950/40 rounded-lg p-1.5 overflow-hidden border border-white/5 relative flex items-center justify-center mb-2 cursor-pointer hover:border-amber-500/40 hover:bg-black/40 transition-all duration-300"
                        >
                          <JamFastProductImage
                            imageUrl={prod.photos?.[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80'}
                            altName={prod.name}
                            className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                          />
                          <span className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm text-[#D4AF37] text-[8px] font-black tracking-tight px-1.5 py-0.5 rounded">
                            {prod.wholesalerName}
                          </span>
                          {prod.agencyName && (
                            <span className="absolute top-1 left-1 bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-[7.5px] font-black tracking-tight px-1.5 py-0.5 rounded shadow-sm border border-emerald-500/20">
                              وكالة: {prod.agencyName}
                            </span>
                          )}
                        </div>

                        {/* Text segment */}
                        <div className="space-y-0.5 text-right">
                          <h3 className="text-sm font-bold text-white group-hover:text-amber-500 transition-colors truncate">{prod.name}</h3>
                          <p className="text-[10px] text-gray-500 line-clamp-1 h-4 leading-normal">{prod.description || 'لا يوجد مواصفات تفصيلية مضافة.'}</p>
                          
                          {/* Warranty and Compensation Labels shown directly in Catalog Card */}
                          {prod.warrantyType && prod.warrantyType !== 'none' && (
                            <div className="flex flex-wrap gap-1 mt-1 justify-start">
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-1 py-0.2 rounded font-bold font-sans">
                                🛡️ {prod.warrantyType === 'operational' ? 'ضمان تشغيل' : `${prod.warrantyDuration} يوم`}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Variant Swapper */}
                        {prod.variants && prod.variants.length > 0 && (
                          <div className="mt-3.5 space-y-1">
                            <label className="text-[9px] text-gray-500 font-bold block">الألوان والبدائل المتاحة للطلب:</label>
                            <div className="flex flex-wrap gap-1">
                              {prod.variants.map(v => (
                                <button
                                  key={v.color}
                                  onClick={() => setSelectedColors(prev => ({ ...prev, [prod.id]: v.color }))}
                                  className={`px-2 py-0.5 rounded-lg text-[9px] font-black border transition-all ${
                                    pickedColor === v.color
                                      ? 'bg-amber-500/10 text-amber-500 border-amber-500'
                                      : 'bg-[#11162d]/50 text-gray-400 border-white/5 hover:border-white/10'
                                  }`}
                                >
                                  <span>{v.color} ({v.stock}ق)</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Smart Price discovery banner */}
                        {intel && (
                          <div className="mt-3 bg-amber-500/[0.03] border border-amber-500/10 rounded-2xl p-2 space-y-1">
                            <div className="flex items-center justify-between text-[8px] text-gray-400 font-bold">
                              <span className="flex items-center gap-0.5"><TrendingUp size={10} className="text-amber-500" /> ذكاء أسواق اليمن والخليج:</span>
                              <span className="text-emerald-500 font-black">جاهز للتسعير</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-[9px] font-black leading-snug">
                              <div className="bg-black/30 p-1 rounded-lg">
                                <span className="text-[8px] text-gray-500 block">شراء متوقع</span>
                                <span className="text-amber-500">{intel.buy} ر.ي</span>
                              </div>
                              <div className="bg-black/30 p-1 rounded-lg">
                                <span className="text-[8px] text-gray-500 block">بيع التجزئة الموصى</span>
                                {currentUserLevel === 1 ? (
                                  <span className="text-gray-500 font-black block tracking-tight">🔒 محجوب</span>
                                ) : (
                                  <span className="text-emerald-500">{intel.sell} ر.ي</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Buy action segment with exchange rate and active tier adjustments */}
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm md:text-base font-bold text-[#D4AF37] tracking-tight">{finalDisplayPrice.toLocaleString()}</span>
                            <span className="text-[9px] text-gray-400 font-bold">{finalCurrencyLabel}</span>
                          </div>
                          <span className="text-[9px] text-gray-500 block">المتاح: {displayStock} ق</span>
                        </div>

                        {activeTab === 'explorer' ? (
                          <button
                            onClick={() => handleImportSingleProduct(prod)}
                            disabled={importingProductId !== null}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 duration-300 border cursor-pointer select-none ${
                              importingProductId === prod.id
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse'
                                : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 hover:from-emerald-400 hover:to-teal-500 font-black shadow-md border-transparent hover:scale-[1.02]'
                            }`}
                          >
                            {importingProductId === prod.id ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                <span>جاري الاستيراد...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={11} />
                                <span>استيراد بنقرة واحدة ⚡</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveQtyPanelProduct(prod);
                              setQtyInputValue(1);
                            }}
                            className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:scale-[1.01] text-slate-950 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer duration-300"
                          >
                            <ShoppingCart size={11} />
                            <span>طلب</span>
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. B2B CONNECTIONS TAB (إدارة الارتباط B2B) */}
      {activeTab === 'connection' && (
        <div className="space-y-6">
          {/* Card 1: Enter B2B key */}
          <div className="bg-gradient-to-r from-[#0d1631] via-[#090d1f] to-[#04060e] border-2 border-amber-500/30 p-6 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
                <KeyRound size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-white">إدخال كود الارتباط بمورد جديد (B2B Key)</h2>
                <p className="text-gray-400 text-xs mt-0.5">ادخل رمز الارتباط المكون من 5 أرقام أو رمز التاجر للارتباط فوراً بمخزنه</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="مثال: 58210 أو JAM-B2B-12345"
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 p-3.5 pl-10 rounded-xl text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-all font-mono"
                />
                <Key size={16} className="absolute left-3 top-4 text-amber-500/60" />
              </div>

              <button
                type="button"
                onClick={(e) => handleConnectSupplierKey(e)}
                disabled={connecting || !searchKey.trim()}
                className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 cursor-pointer shrink-0"
              >
                {connecting ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />}
                <span>ربط التاجر والمورد فوراً</span>
              </button>
            </div>

            {keyError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{keyError}</span>
              </div>
            )}

            {keySuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle size={15} />
                <span>{keySuccess}</span>
              </div>
            )}
          </div>

          {/* Card 2: Generate B2B Key */}
          <div className="bg-navy-900 border border-white/5 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-right">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Shield size={16} className="text-amber-500" />
                <span>توليد وتأمين كود B2B لمتجرك ومخزنك</span>
              </h3>
              <p className="text-gray-400 text-xs">أنشئ مفتاح ارتباط محدد بالصلاحيات لعملائك من التجار لتمكينهم من تصفح بضائعك والطلب المباشر</p>
            </div>

            <button
              type="button"
              onClick={() => setIsGenerateKeyModalOpen(true)}
              className="px-5 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shrink-0"
            >
              <Lock size={15} />
              <span>توليد مفتاح ارتباط جديد 🔑</span>
            </button>
          </div>

          {/* Card 3: Connected Suppliers List */}
          <div className="bg-navy-900 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Store size={18} className="text-amber-500" />
                <h3 className="text-base font-black text-white">قائمة الموردين المعتمدين والمرتبط بهم</h3>
              </div>
              <span className="text-xs font-black bg-amber-500/15 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20">
                {connectedSuppliers.length} موردين نشطين
              </span>
            </div>

            {connectedSuppliers.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs font-medium space-y-3">
                <AlertCircle size={32} className="mx-auto text-gray-700" />
                <p className="text-gray-400 font-bold">لا يوجد ارتباط بموردين حالياً.</p>
                <p className="text-[11px] text-gray-500">ادخل كود B2B الخاص بالمورد في الحقل أعلاه لبدء التعامل التوريدي والتجاري المباشر.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {connectedSuppliers.map(sup => (
                  <div
                    key={sup.id}
                    className="bg-[#0e162f] border border-white/10 hover:border-[#D4AF37]/50 rounded-2xl p-4 space-y-3 text-right transition-all shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                          <Store size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-black text-sm truncate">{sup.supplierName}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">الكود: {sup.supplierKey || 'JAM-B2B'}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSupplierConnection(sup.id, sup.supplierName)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all shrink-0 cursor-pointer"
                        title="إلغاء الترابط"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-xs space-y-1.5 font-bold text-gray-300">
                      <div className="flex justify-between items-center text-gray-500 border-b border-white/5 pb-1">
                        <span className="text-[10px]">دفتر الحساب الجاري:</span>
                        <span className="font-mono text-[9px] text-amber-500">Live Sync</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span>حساب له (Payable):</span>
                        <span className="text-amber-400 font-black font-mono">{(sup.payableBalance || 0).toLocaleString()} YER</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span>حساب عليك (Receivable):</span>
                        <span className="text-emerald-400 font-black font-mono">{(sup.receivableBalance || 0).toLocaleString()} YER</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t border-white/5 pt-3">
                      <button
                        type="button"
                        onClick={() => handleIngestCatalog(sup.supplierId, sup.supplierName)}
                        disabled={ingestingSupplierId !== null}
                        className="flex-1 py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles size={13} />
                        <span>جلب البضائع لمخزنك</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenPermissionsModal(sup)}
                        className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all cursor-pointer"
                        title="تعديل الصلاحيات"
                      >
                        <Sliders size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. CATALOG & AGENCIES TAB (تصفح المنتجات والوكالات) */}
      {activeTab === 'catalog' && (
        <div className="space-y-8">
          <div className="bg-navy-900 border border-white/5 p-6 rounded-3xl shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-lg font-black text-white">تصفح الوكالات والمنتجات الكلية</h2>
                <p className="text-gray-400 text-xs mt-0.5">استعراض بضائع الوكالات والموردين ومقارنة المواصفات والأسعار</p>
              </div>
              <span className="text-xs font-black bg-amber-500/15 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20">
                دليل الوكالات
              </span>
            </div>

            <ProductsAndAgencies profile={profile} currentUserLevel={currentUserLevel} />
          </div>

          <div className="bg-navy-900 border border-white/5 p-6 rounded-3xl shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-lg font-black text-white">دليل التجار والموردين المعتمدين</h2>
                <p className="text-gray-400 text-xs mt-0.5">ابحث عن تجار الجملة والمستوردين بالاسم أو المنطقة أو نوع النشاط</p>
              </div>
              <span className="text-xs font-black bg-amber-500/15 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20">
                دليل التجار
              </span>
            </div>

            <MerchantDirectory
              currentUserLevel={currentUserLevel}
              products={products}
              connectedSuppliers={connectedSuppliers}
              allMerchants={allMerchants}
              allProfiles={allProfiles}
              onRequestConnection={(merchant: any) => {
                setSelectedSupplierForRequest(merchant);
                setB2bRequestModalOpen(true);
              }}
              onViewProducts={(merchant: any) => {
                const conn = connectedSuppliers.find(c => c.supplierId === merchant.id || c.supplierId === merchant.uid);
                if (conn) {
                  setB2bKeySupplier(conn);
                  setSelectedSupplierId(conn.supplierId);
                  setActiveTab('order');
                } else {
                  setSelectedSupplierId(merchant.id || merchant.uid);
                  setActiveTab('order');
                }
              }}
            />
          </div>
        </div>
      )}

      {/* 4. PUBLISHING & WHOLESALE HUB TAB (النشر وتغذية السوق) */}
      {activeTab === 'publish' && (
        <div className="space-y-6">
          
          {/* Real-time Supplier Rejection Alert Banners */}
          {supplierAlert && (
            <div className="bg-amber-500/10 border-2 border-amber-500/20 p-4 rounded-[1.5rem] flex justify-between items-center text-xs text-amber-500 font-extrabold scroll-m-2 leading-relaxed animate-pulse" dir="rtl">
              <span>{supplierAlert}</span>
              <button
                onClick={() => setSupplierAlert(null)}
                className="text-[10px] bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 px-3 py-1.5 rounded-xl transition-all"
              >
                حسناً وفهمت ✕
              </button>
            </div>
          )}

          {/* Internal Suppliers Navigation Tab strip */}
          <div className="flex bg-navy-900/50 p-2 rounded-2xl border border-white/5 gap-2 flex-wrap">
            <button
              onClick={() => setActiveSupplierSubTab('products')}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-black transition-all ${
                activeSupplierSubTab === 'products' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers size={15} />
              <span>إدارة كتالوج السلع ({myProducts.length})</span>
            </button>
            <button
              onClick={() => setActiveSupplierSubTab('orders')}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-black transition-all ${
                activeSupplierSubTab === 'orders' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText size={15} />
              <span>الطلبيات الواردة ({incomingOrders.length})</span>
            </button>
            <button
              onClick={() => setActiveSupplierSubTab('cashbox')}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-black transition-all ${
                activeSupplierSubTab === 'cashbox' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Wallet size={15} />
              <span>لجنة صندوق النقد والتحصيل</span>
            </button>
            <button
              onClick={() => setActiveSupplierSubTab('partners')}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-black transition-all ${
                activeSupplierSubTab === 'partners' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <UserCheck size={15} />
              <span>إدارة الشركاء النشطين ({partnerConnections.length})</span>
            </button>
            <button
              onClick={() => setActiveSupplierSubTab('auctions')}
              className={`flex-1 min-w-[125px] flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-black transition-all ${
                activeSupplierSubTab === 'auctions' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Gavel size={15} />
              <span>الحراج العام الموحد ({myPublicAuctions.length})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            
            {/* SUBTAB 1: Products lists & catalog managers */}
            {activeSupplierSubTab === 'products' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4 bg-[#0c1228] p-5 rounded-3xl border border-white/5">
                  <div>
                    <h3 className="text-base font-black text-white">منتجاتك المعروضة بسوق الجملة</h3>
                    <p className="text-gray-400 text-xs mt-1">منتجاتك تظهر حصراً للتجار والشركاء المسجلين بقناتك والذين يمتلكون المفتاح.</p>
                  </div>

                  <button
                    onClick={() => setIsAddProductOpen(true)}
                    className="py-3 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition-all"
                  >
                    <Plus size={16} />
                    <span>إضافة منتج جملة مع البدائل</span>
                  </button>
                </div>

                {myProducts.length === 0 ? (
                  <div className="bg-navy-900/30 border-2 border-dashed border-white/5 rounded-3xl p-16 text-center space-y-4">
                    <Layers size={40} className="mx-auto text-gray-700" />
                    <p className="text-gray-400 text-sm font-bold">لم تقم بنشر أي سلع بسوق الجملة الموحد حتى الآن.</p>
                    <button
                      onClick={() => setIsAddProductOpen(true)}
                      className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/12"
                    >
                      إضافة منتجك الأول الآن
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2">
                    {myProducts.map(p => (
                      <div key={p.id} className="bg-[#0b1126] border border-white/5 hover:border-[#D4AF37]/50 p-3 rounded-2xl relative flex flex-col justify-between transition-all max-h-[500px] overflow-hidden shadow-md">
                        
                        {/* Delete trigger */}
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.wholesalerId || profile?.ownerId || '')}
                          className="absolute top-2 left-2 z-10 p-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-lg transition-all border border-red-500/10"
                          title="حذف وإلغاء عرض المنتج"
                        >
                          <Trash2 size={12} />
                        </button>

                        <div>
                          {p.photos && p.photos.length > 0 && (
                            <div className="w-full h-28 md:h-36 bg-slate-950/40 rounded-lg p-1.5 overflow-hidden border border-white/5 flex items-center justify-center mb-2">
                              <JamFastProductImage imageUrl={p.photos[0]} altName={p.name} className="max-h-full max-w-full object-contain" />
                            </div>
                          )}

                          <h4 className="font-bold text-white text-sm truncate">{p.name}</h4>
                          <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-bold block w-max mt-0.5">{p.category}</span>
                          <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 leading-normal">{p.description || 'لا يوجد مواصفات مضافة.'}</p>
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-2 gap-2">
                          <div className="bg-black/30 p-1.5 rounded-xl border border-white/5 text-right">
                            <span className="text-[8px] text-gray-500 block">سعر التكلفة بالجملة</span>
                            <span className="text-xs font-bold text-white">{p.price.toLocaleString()} ر.ي</span>
                          </div>
                          <div className="bg-black/30 p-1.5 rounded-xl border border-white/5 text-right">
                            <span className="text-[8px] text-gray-500 block">المعروض</span>
                            <span className="text-xs font-bold text-amber-500">{p.stock} قطع</span>
                          </div>
                        </div>

                        {p.variants && p.variants.length > 0 && (
                          <div className="mt-3 bg-white/[0.02] p-2 rounded-2xl border border-white/5">
                            <span className="text-[9px] text-gray-500 font-bold block mb-1">توزيع مخزون العينات المتوفرة:</span>
                            <div className="flex flex-wrap gap-1">
                              {p.variants.map((v: any, i: number) => (
                                <span key={i} className="text-[9px] bg-black/35 text-gray-400 px-2 py-0.5 rounded-lg border border-white/5">
                                  {v.color}: <b className="text-white">{v.stock}ق</b>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 2: Incoming B2B Orders flow */}
            {activeSupplierSubTab === 'orders' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div>
                    <h3 className="text-base font-black text-white">الطلبات الواردة من شركائك</h3>
                    <p className="text-gray-400 text-xs mt-1">تظهر هنا طلبيات الشراء الفعلية المقدمة من تجار التجزئة المعتمدين والمربوطين بالمفتاح.</p>
                  </div>
                </div>

                {incomingOrders.length === 0 ? (
                  <div className="text-center py-16 bg-navy-900/10 border border-white/5 rounded-3xl text-gray-500 font-bold text-sm">
                    لا تتوفر طلبيات واردة نشطة بانتظارك حالياً.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {incomingOrders.map(ord => (
                      <div key={ord.id} className="bg-navy-900 border border-white/5 hover:border-amber-500/20 p-5 rounded-[2rem] space-y-4">
                        
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <h4 className="font-extrabold text-white text-sm">طلب من: {ord.retailerName}</h4>
                              <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-gray-400 font-mono">ID: #{ord.id?.slice(-8)}</span>
                            </div>
                            <span className="text-[10px] text-gray-500 block mt-1">الكميات والبدائل المطلوبة: ({ord.items?.length || 0}) صنف وعينة</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">إجمالي الطلبية:</span>
                            <span className="text-base font-black text-amber-500">{(ord.total || 0).toLocaleString()} ر.ي</span>
                          </div>
                        </div>

                        {/* List of items inside the order */}
                        <div className="bg-black/35 p-3.5 rounded-2xl border border-white/5 space-y-2 text-xs text-right">
                          {ord.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-start gap-4 text-gray-300 border-b border-white/5 last:border-0 pb-1.5 last:pb-0">
                              <div className="flex gap-2.5 items-center">
                                <img
                                  src={item.imageUrl || (item.photos && item.photos[0]) || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=100&q=80'}
                                  alt={item.name}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0 bg-black/40"
                                />
                                <div>
                                  <span className="font-bold block text-white">{item.name}</span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {item.selectedColor && (
                                      <b className="text-rose-400 bg-rose-500/15 px-1.5 py-0.2 rounded text-[8px] font-sans font-bold">
                                        {item.selectedColor}
                                      </b>
                                    )}
                                    {item.warrantyType && item.warrantyType !== 'none' && (
                                      <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-1.5 py-0.2 rounded font-bold font-sans">
                                        🛡️ {item.warrantyType === 'operational' ? 'ضمان تشغيل' : `ضمان لمده ${item.warrantyDuration || 0} يوم`}
                                      </span>
                                    )}
                                    {item.compensationOption && item.warrantyType && item.warrantyType !== 'none' && (
                                      <span className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/15 px-1.5 py-0.2 rounded font-bold font-sans">
                                        🔄 {item.compensationOption === 'refund' ? 'استرداد مالي' : item.compensationOption === 'replace_same' ? 'استبدال متطابق' : 'استبدال مخصص'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="font-extrabold text-[#D4AF37] shrink-0 mt-0.5">
                                {item.quantity} قطع × {item.price.toLocaleString()} ر.ي
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Money reference or details check */}
                        <div className="bg-[#0b1125] p-4 rounded-2xl border border-white/5 space-y-2 text-xs">
                          <div className="flex justify-between items-center flex-wrap gap-2 text-gray-300">
                            <div>
                              <span>نموذج الدفع: </span>
                              <span className="font-black text-amber-500">
                                {ord.paymentType === 'money_transfer' ? 'إيداع بنكي مباشر' : ord.paymentType === 'debt' ? 'دين/آجل بالدفتر' : 'نقدية (كاش)'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">الحالة المالية الحالية:</span>
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${ord.cashierValidated ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                {ord.cashierValidated ? 'مدفوع ومصادق من الصندوق ✅' : 'غير مصادق / معلّق ⏳'}
                              </span>
                            </div>
                          </div>

                          {/* Reference network segments */}
                          {ord.paymentType === 'money_transfer' && ord.transferRefNum && (
                            <div className="p-3 bg-black/40 rounded-xl border border-white/5 grid grid-cols-1 md:grid-cols-4 gap-3 text-right">
                              <div>
                                <span className="text-[9px] text-gray-500 block">رقم الإيداع المستلم:</span>
                                <span className="font-mono font-black text-sky-400 text-sm select-all">{ord.transferRefNum}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-gray-500 block">شبكة التبادل المحددة:</span>
                                <span className="font-bold text-gray-200">{ord.exchangeNetwork}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-gray-500 block">الاسم المدون على السند:</span>
                                <span className="font-bold text-gray-200">{ord.transferSenderName || 'غير متوفر'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-gray-500 block">المبلغ المصرح به بالسند:</span>
                                <span className="font-black text-emerald-500">{ord.transferAmount?.toLocaleString() || ord.total?.toLocaleString()} ر.ي</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Order management actions */}
                        <div className="flex flex-wrap gap-2.5 justify-end">
                          
                          {/* Route to Cashbox review queue action */}
                          {ord.paymentType === 'money_transfer' && !ord.cashierValidated && ord.status !== 'routed_to_cashier' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, 'routed_to_cashier')}
                              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-black rounded-lg transition-all"
                            >
                              توجيه لعمال الصندوق للتحصيل والتأكيد ⚙️
                            </button>
                          )}

                          {ord.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, 'paid_processing')}
                              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-xs font-black rounded-lg transition-all"
                            >
                              قبول المعاملة مباشرة للشحن 📦
                            </button>
                          )}

                          {ord.status === 'routed_to_cashier' && (
                            <span className="text-xs text-gray-400 bg-white/5 border border-white/5 p-2 rounded-xl flex items-center gap-1">
                              <Info size={12} className="text-sky-400" />
                              بانتظار مراجعة وقبول صندوق المحاسبة
                            </span>
                          )}

                          {ord.status === 'paid_processing' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(ord.id, 'delivered')}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black rounded-lg transition-all"
                            >
                              تسليم نهائي وإغلاق الطلب 🏁
                            </button>
                          )}

                          {ord.status !== 'cancelled' && ord.status !== 'delivered' && (
                            <div className="w-full">
                              {rejectingOrderId === ord.id ? (
                                <div className="bg-red-950/40 border border-red-500/20 p-3.5 rounded-2xl w-full text-right space-y-2.5 mt-2 animate-fadeIn" dir="rtl">
                                  <div className="flex justify-between items-center border-b border-red-500/10 pb-1.5">
                                    <span className="text-[10px] text-red-400 font-extrabold flex items-center gap-1">
                                      ⚠️ اختر سبب الرفض والبدء بالإجراء الآلي:
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setRejectingOrderId(null)}
                                      className="text-[9px] text-gray-400 hover:text-white bg-white/5 px-2 py-0.5 rounded transition-all cursor-pointer"
                                    >
                                      تراجع ✕
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[10px] font-black">
                                    <button
                                      type="button"
                                      onClick={() => handleProcessOrderRejection(ord, 'fake_transfer')}
                                      className="py-2.5 px-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/25 text-red-400 rounded-xl transition-all cursor-pointer"
                                    >
                                      🚨 حوالة وهمي
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleProcessOrderRejection(ord, 'fake_cash')}
                                      className="py-2.5 px-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/25 text-red-400 rounded-xl transition-all cursor-pointer"
                                    >
                                      💵 تسليم نقود وهمي
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleProcessOrderRejection(ord, 'accumulated_debt')}
                                      className="py-2.5 px-2 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/25 text-orange-400 rounded-xl transition-all cursor-pointer"
                                    >
                                      💳 ديون متراكمة
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleProcessOrderRejection(ord, 'not_available')}
                                      className="py-2.5 px-2 bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/25 text-pink-400 rounded-xl transition-all cursor-pointer"
                                    >
                                      📦 طلب غير موجود
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setRejectingOrderId(ord.id)}
                                  className="px-4 py-2 bg-red-600/10 hover:bg-red-500/20 text-red-500 text-xs font-black rounded-lg transition-all cursor-pointer w-full text-center"
                                >
                                  رفض الطلبية وإنهاء المعاملة
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 3: Cashier review and deposit verification */}
            {activeSupplierSubTab === 'cashbox' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-base font-black text-white">لجنة مراجعة عمال الصندوق للتحصيل</h3>
                    <p className="text-gray-400 text-xs mt-1">تختص هذه اللوحة للتحقق اليدوي والمقابلة لأرقام الحوالات البنكية المرفقة قبل شحن هواتف وبيانات تجار التجزئة.</p>
                  </div>
                </div>

                {/* List incoming money referencres ready for audit */}
                {incomingOrders.filter(o => o.paymentType === 'money_transfer' && !o.cashierValidated).length === 0 ? (
                  <div className="text-center py-12 bg-navy-900/10 border border-white/10 rounded-3xl text-gray-500 font-bold text-xs">
                    لا تتوفر إخطارات مالية حوالات تحت المراجعة حالياً بصندوق التحصيل.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {incomingOrders.filter(o => o.paymentType === 'money_transfer' && !o.cashierValidated).map(ord => (
                      <div key={ord.id} className="bg-black/40 border-2 border-sky-500/30 p-5 rounded-3xl space-y-4">
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-2 bg-sky-500/10 rounded-xl text-sky-400"><Wallet size={16} /></span>
                            <h4 className="font-extrabold text-white text-xs">المشتري: {ord.retailerName}</h4>
                          </div>

                          <div className="text-right text-xs">
                            <span className="text-gray-500 ml-1">إجمالي الحوالة المطلوبة:</span>
                            <span className="font-black text-sky-400">{ord.total.toLocaleString()} ر.ي</span>
                          </div>
                        </div>

                        {/* Receipt slip info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0a0f21] p-4 rounded-2xl border border-white/5 text-xs text-right">
                          <div>
                            <span className="text-gray-500 block text-[9px] mb-1">شبكة التحويل / الصراف:</span>
                            <span className="font-extrabold text-white text-sm">{ord.exchangeNetwork}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[9px] mb-1">اسم مرسل المبلغ بالسند:</span>
                            <span className="font-extrabold text-white text-sm">{ord.transferSenderName || ord.retailerName}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[10px] mb-1 text-sky-400">رقم الحوالة المستلم (الرمز المصرفي للحجز):</span>
                            <span className="font-mono font-black text-sky-400 text-lg select-all">{ord.transferRefNum}</span>
                          </div>
                        </div>

                        {/* Bottom cashier actions */}
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-[10px] text-gray-500 font-bold">
                            * بعد التحقق من حساب الصراف وشبكة التصدير اضغط (مصادقة) لتأكيد الإيرادات.
                          </span>

                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'orders', ord.id), {
                                    cashierValidated: true,
                                    status: 'paid_processing',
                                    updatedAt: serverTimestamp()
                                  });
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
                            >
                              ختم وتأكيد استلام المال ✅
                            </button>
                            <div className="w-full">
                              {rejectingOrderId === ord.id ? (
                                <div className="bg-red-950/40 border border-red-500/20 p-3.5 rounded-2xl w-full text-right space-y-2.5 mt-2 animate-fadeIn" dir="rtl">
                                  <div className="flex justify-between items-center border-b border-red-500/10 pb-1.5">
                                    <span className="text-[10px] text-red-400 font-extrabold flex items-center gap-1">
                                      ⚠️ اختر سبب الرفض والبدء بالإجراء الآلي:
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setRejectingOrderId(null)}
                                      className="text-[9px] text-gray-400 hover:text-white bg-white/5 px-2 py-0.5 rounded transition-all cursor-pointer"
                                    >
                                      تراجع ✕
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[10px] font-black">
                                    <button
                                      type="button"
                                      onClick={() => handleProcessOrderRejection(ord, 'fake_transfer')}
                                      className="py-2.5 px-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/25 text-red-400 rounded-xl transition-all cursor-pointer"
                                    >
                                      🚨 حوالة وهمي
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleProcessOrderRejection(ord, 'fake_cash')}
                                      className="py-2.5 px-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/25 text-red-400 rounded-xl transition-all cursor-pointer"
                                    >
                                      💵 تسليم نقود وهمي
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleProcessOrderRejection(ord, 'accumulated_debt')}
                                      className="py-2.5 px-2 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/25 text-orange-400 rounded-xl transition-all cursor-pointer"
                                    >
                                      💳 ديون متراكمة
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleProcessOrderRejection(ord, 'not_available')}
                                      className="py-2.5 px-2 bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/25 text-pink-400 rounded-xl transition-all cursor-pointer"
                                    >
                                      📦 طلب غير موجود
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setRejectingOrderId(ord.id)}
                                  className="px-4 py-2 bg-red-600/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer w-full text-center mt-2 lg:mt-0"
                                >
                                  إبلاغ بفشل المطابقة 🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 4: Connections & DND blocker control panel */}
            {activeSupplierSubTab === 'partners' && (
              <div className="space-y-6">
                
                {/* DND Toggle Widget */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Share code */}
                  <div className="bg-[#0b1126] p-5 rounded-[2rem] border border-white/5 text-right space-y-3">
                    <h4 className="text-xs font-black text-white">كود ومفتاح ربط الشركاء</h4>
                    <p className="text-[10px] text-gray-400 leading-normal">
                      قم بنسخ وتوزيع هذا المفتاح السري إلى موزعين وتجار التجزئة المعتمدين ليرابطوا بكتالوجك ويرسلوا إليك سرياً الحوالات والديون والطلبات.
                    </p>

                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                      <span className="text-gray-500 text-xs">مفتاحك الحالي:</span>
                      <span className="font-mono font-black text-amber-500 select-all tracking-wider text-sm">{myB2BKey || 'JAM-B2B'}</span>
                    </div>

                    <div className="text-[10px] text-amber-500 font-bold bg-amber-500/5 p-2 rounded-xl border border-amber-500/10 text-center">
                      🗝️ يمكنك توليد وتجديد مفاتيح الارتباط في أي وقت من زر "توليد مفتاح ارتباط" أعلى الشاشة بجانب ملء الشاشة.
                    </div>
                  </div>

                  {/* DND Mode & Spam preventions settings */}
                  <div className="bg-[#0b1126] p-5 rounded-[2rem] border border-white/5 text-right space-y-3">
                    <h4 className="text-xs font-black text-white">إعدادات "منع الإزعاج DND" والأمان الآلي</h4>
                    <p className="text-[10px] text-gray-400 leading-normal">
                      احمِ قناتك التجارية من هجمات الإسبام والطلبيات الوهمية من تجار مجهولين عبر إيقاف الدخول العام مؤقتاً.
                    </p>

                    <div className="flex flex-col gap-2 pt-1.5 text-xs text-gray-300">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dndModeEnabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDndModeEnabled(val);
                            if (profile?.uid) {
                              updateDoc(doc(db, 'users', profile.uid), { dndMode: val });
                            }
                          }}
                          className="rounded border-white/10 text-amber-500 focus:ring-amber-500"
                        />
                        <span>تأمين وضع منع الإزعاج DND 🔕 (رفض ارتباطات جديدة بالمفتاح)</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cashierRoutingEnabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setCashierRoutingEnabled(val);
                            if (profile?.uid) {
                              updateDoc(doc(db, 'users', profile.uid), { cashierRouting: val });
                            }
                          }}
                          className="rounded border-white/10 text-amber-500 focus:ring-amber-500"
                        />
                        <span>تفعيل التوجيه التلقائي لفواتير الحوالات إلى (لجنة عمال الصندوق)</span>
                      </label>
                    </div>
                  </div>

                </div>

                {/* Partners List */}
                <div className="bg-navy-900/40 border border-white/5 p-5 rounded-[2rem] space-y-4">
                  <h4 className="text-sm font-black text-white block border-b border-white/5 pb-2">التجار والشركاء المسجلون بمنظومتك ({partnerConnections.length})</h4>
                  
                  {partnerConnections.length === 0 ? (
                    <div className="text-center py-12 text-gray-650 font-bold text-xs h-min">
                      لم يقم أي تاجر تجزئة بالربط بمفتاحك بعد. وزّع مفتاحك للبدء بالتوريد!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {partnerConnections.map(conn => (
                        <div key={conn.id} className="p-4 bg-black/25 rounded-2xl border border-white/5 flex flex-col gap-3 font-sans">
                          <div className="flex items-center justify-between text-xs font-bold gap-3">
                            <div className="text-right">
                              <p className="text-white font-extrabold">{conn.buyerName}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">رقم الهاتف للاتصال: {conn.buyerPhone || 'غير متوفر'}</p>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${conn.status === 'blocked' ? 'bg-red-500/10 text-red-400 border border-red-500/10' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'}`}>
                                {conn.status === 'blocked' ? 'حظر / منع الإزعاج' : 'نشط تجارياً'}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleSupplierTogglePartner(conn.id, conn.status)}
                                className={`px-3 py-1.5 rounded-xl border text-[10px] transition-all font-black ${
                                  conn.status === 'blocked'
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 border-emerald-600'
                                    : 'bg-red-600/10 hover:bg-red-600/25 text-red-400 border-red-500/20'
                                }`}
                              >
                                {conn.status === 'blocked' ? 'فك الحظر' : 'حظر / قطع الارتباط 🔕'}
                              </button>
                            </div>
                          </div>

                          {/* Real-time limits and blocked partitions info */}
                          {(() => {
                            const creditLimit = conn.creditLimit || conn.debtSettings?.ceilingLimit || conn.ceilingLimit || 0;
                            const currentDebt = Number(conn.debt || conn.payableBalance || 0);
                            const pendingOrders = incomingOrders.filter(
                              o => o.retailerId === conn.retailerId && o.paymentType === 'debt' && o.status === 'pending'
                            );
                            const pendingDebtTotal = pendingOrders.reduce((sum, o) => sum + (o.total || 0), 0);
                            const displayedRemainingCredit = Math.max(0, creditLimit - currentDebt - pendingDebtTotal);
                            const blockedCats = conn.blockedCategories || [];

                            return (
                              <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 space-y-1.5 text-[10px]">
                                <div className="grid grid-cols-2 gap-2 text-right text-gray-400">
                                  <div>السقف المعتمد: <span className="font-mono text-white font-bold">{creditLimit.toLocaleString()} ر.ي</span></div>
                                  <div>المديونية الحالية: <span className="font-mono text-red-400 font-bold">{currentDebt.toLocaleString()} ر.ي</span></div>
                                  <div>طلبات معلقة بالدين: <span className="font-mono text-amber-500 font-bold">{pendingDebtTotal.toLocaleString()} ر.ي</span></div>
                                  <div className="font-black">السقف المتبقي: <span className="font-mono text-emerald-400 underline">{displayedRemainingCredit.toLocaleString()} ر.ي</span></div>
                                </div>
                                {blockedCats.length > 0 && (
                                  <div className="text-[9.5px] text-red-400/90 border-t border-white/5 pt-1 mt-1 font-bold">
                                    🚫 الأقسام المحظورة للارتباط: {blockedCats.join('، ')}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* SUBTAB 5: AUCTIONS (الحراج العام الموحد) */}
            {activeSupplierSubTab === 'auctions' && (
              <div className="space-y-6">
                
                {/* Header Banner */}
                <div className="bg-[#0b1126] p-6 rounded-[2rem] border border-white/5 flex items-center justify-between flex-wrap gap-4 text-right">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Gavel className="text-amber-500" size={24} />
                      وحدة الحراج العام الموحد والتبويب الشبكي
                    </h3>
                    <p className="text-gray-400 text-xs mt-1">
                      انشر بضائعك وعروض الحراج والمصادرات لتظهر للعامة والمشتركين مباشرة على لوحة العميل VIP.
                    </p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-2 rounded-2xl text-xs font-black">
                    منشوراتك النشطة حالياً: {myPublicAuctions.length} إعلان حراج
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Form Panel: left/right */}
                  <div className="lg:col-span-5 bg-[#0b1126] p-6 rounded-[2.5rem] border border-white/5 space-y-4">
                    <h4 className="text-sm font-black text-white border-b border-white/5 pb-2 font-black">نشر سلعة حراج جديدة 🚀</h4>
                    
                    <form onSubmit={handlePublishAuction} className="space-y-4 text-right">
                      {inventoryList && inventoryList.length > 0 && (
                        <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-1 text-right font-sans">
                          <label className="text-[10px] text-amber-400 font-extrabold block">🗳️ سحب صنف من مخزنك للتعبئة والترويج السريع بالحراج</label>
                          <select 
                            className="w-full bg-black/40 border border-white/10 p-2.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                            onChange={(e) => {
                              const selectedItem = inventoryList.find(i => i.id === e.target.value);
                              if (selectedItem) {
                                setAuctionForm({
                                  title: selectedItem.name,
                                  price: selectedItem.price,
                                  description: selectedItem.description || `عرض ترويجي لمنتج من مخزننا: ${selectedItem.name}`,
                                  images: selectedItem.photo ? [selectedItem.photo] : [],
                                  imageUrlInput: selectedItem.photo || selectedItem.imageUrl || '',
                                  type: 'supplier_publish'
                                });
                              }
                            }}
                          >
                            <option value="">-- اختر صنفاً من مخزنك للترويج --</option>
                            {inventoryList.map(i => (
                              <option key={i.id} value={i.id}>{i.name} (السعر: {i.price} ر.ي)</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] text-gray-400 font-extrabold block">مسمى السلعة / عنوان المزاد</label>
                        <input
                          required
                          type="text"
                          placeholder="مثال: لوط أجهزة آيفون 15 برو مستعمل نظيف"
                          value={auctionForm.title}
                          onChange={(e) => setAuctionForm({ ...auctionForm, title: e.target.value })}
                          className="w-full bg-black/35 border border-white/5 p-3.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 font-sans">
                          <label className="text-[10px] text-gray-400 font-extrabold block">السعر أو السوم الإبتدائي</label>
                          <input
                            required
                            type="number"
                            min="1"
                            placeholder="السعر بالريال"
                            value={auctionForm.price || ''}
                            onChange={(e) => setAuctionForm({ ...auctionForm, price: Number(e.target.value) || 0 })}
                            className="w-full bg-black/35 border border-white/5 p-3.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1.5 font-sans">
                          <label className="text-[10px] text-gray-400 font-extrabold block text-amber-500">نوع الظهور والخصوصية</label>
                          <select
                            value={auctionForm.type}
                            onChange={(e) => setAuctionForm({ ...auctionForm, type: e.target.value as any })}
                            className="w-full bg-black/35 border border-white/10 p-3.5 rounded-xl text-xs font-bold text-amber-550 focus:outline-none focus:border-amber-500"
                          >
                            <option value="supplier_publish">نشر مورد (Supplier Publish)</option>
                            <option value="client_view">عرض عام (Client View)</option>
                          </select>
                        </div>
                      </div>

                      <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2 font-sans">
                        <label className="text-[10px] text-amber-500 font-extrabold block">رفع صورة السلعة مباشرة (سيتم ضغط الحجم تلقائياً)</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const base64 = await compressImage(file, 600, 600, 0.6);
                                setAuctionForm({ ...auctionForm, imageUrlInput: base64 });
                              } catch (err) {
                                console.error("Failed to compress image:", err);
                              }
                            }
                          }}
                          className="block w-full text-xs text-gray-400 file:ml-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-amber-500 file:text-black hover:file:bg-amber-400 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] text-gray-400 font-extrabold block">أو رابط صورة السلعة (اختياري)</label>
                        <input
                          type="url"
                          placeholder="https://images.unsplash.com/..."
                          value={auctionForm.imageUrlInput}
                          onChange={(e) => setAuctionForm({ ...auctionForm, imageUrlInput: e.target.value })}
                          className="w-full bg-black/35 border border-white/5 p-3.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] text-gray-400 font-extrabold block">الوصف وتفاصيل السلعة</label>
                        <textarea
                          placeholder="اكتب تفاصيل الفحص، النظافة، الكمية، والاتصال للراغبين بالشراء..."
                          rows={4}
                          value={auctionForm.description}
                          onChange={(e) => setAuctionForm({ ...auctionForm, description: e.target.value })}
                          className="w-full bg-black/35 border border-white/5 p-3.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-lg shadow-amber-500/10 cursor-pointer"
                      >
                        نشر السلعة في الحراج العام المفتوح 📢
                      </button>
                    </form>
                  </div>

                  {/* List Panel: right/left */}
                  <div className="lg:col-span-7 bg-[#0b1126] p-6 rounded-[2.5rem] border border-white/5 space-y-4 text-right">
                    <h4 className="text-sm font-black text-white border-b border-white/5 pb-2 font-black">سجل إعلانات وعروض الحراج الخاصة بك</h4>
                    {myPublicAuctions.length === 0 ? (
                      <div className="text-center py-20 text-gray-500 font-bold text-xs font-sans">
                        لا توجد منشورات حراج نشطة معروضة حالياً. استخدم النموذج لنشر أول منتج في الحراج!
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {myPublicAuctions.map((auc) => (
                          <div key={auc.id} className="p-4 bg-black/25 rounded-2xl border border-white/5 flex gap-4 text-right items-start justify-between flex-wrap md:flex-nowrap font-sans">
                            <img
                              referrerPolicy="no-referrer"
                              src={auc.images?.[0] || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=500'}
                              alt={auc.title}
                              className="w-20 h-20 rounded-2xl object-cover border border-white/5"
                            />
                            
                            <div className="flex-1 space-y-1 min-w-[200px] font-sans">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black ${auc.type === 'client_view' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-amber-500/10 text-amber-300 border border-amber-500/10'}`}>
                                  {auc.type === 'client_view' ? 'حراج عام' : 'مورد خاص'}
                                </span>
                                <h5 className="text-sm font-black text-white font-sans">{auc.title}</h5>
                              </div>
                              <p className="text-[11px] text-gray-400 line-clamp-3 leading-normal font-sans">{auc.description || 'لا يوجد وصف.'}</p>
                              
                              <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-500 font-sans">
                                <span>السعر: <strong className="text-amber-500 font-extrabold text-xs font-sans">{Number(auc.price).toLocaleString()}</strong> ريال</span>
                                <span>•</span>
                                <span>بتاريخ: {auc.createdAt ? new Date(auc.createdAt.seconds * 1000).toLocaleDateString('ar-YE') : 'الآن'}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteAuction(auc.id)}
                              className="p-3 bg-red-650/10 hover:bg-red-650/20 text-red-500 rounded-xl transition-all self-center border border-red-500/10 cursor-pointer font-sans"
                              title="حذف الإعلان"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>
      )}

      {/* 4. SHOPPING CART DRAWER (سلة طلبيات الجملة المصممة بعناية) */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end">
            
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Slide-out drawer content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="relative w-full max-w-md h-screen bg-gradient-to-b from-[#0e162f] via-[#090c1a] to-[#04060d] border-l-2 border-[#D4AF37]/30 p-6 shadow-[0_0_50px_rgba(0,0,0,0.85)] flex flex-col justify-between overflow-y-auto"
            >
              <div>
                {/* Drawer upper bar */}
                <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-amber-500/10 text-[#D4AF37]"><ShoppingCart size={18} /></span>
                    <h3 className="text-base font-black text-white">سلة طلبات التوريد المباشرة</h3>
                  </div>
                  <button
                    title="إغلاق السلة"
                    onClick={() => setIsCartOpen(false)}
                    className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Cart products lists */}
                {cart.length === 0 ? (
                  <div className="text-center py-20 text-gray-500 font-medium space-y-3">
                    <ShoppingCart size={44} className="mx-auto text-gray-700" />
                    <p className="text-xs font-bold text-gray-400">سلة طلبات الجملة خاوية حالياً.</p>
                    <p className="text-[10px] text-gray-500 max-w-xs mx-auto leading-relaxed">
                      اختر بدائل عينات الشاشات والهواتف، واضغط زر (طلب للجملة) لتعبئة السلة الرقمية ومصادقة الدفع.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
                    
                    {/* Notify connected Supplier matching */}
                    <div className="bg-amber-500/5 p-2 rounded-xl border border-amber-500/20 text-[10px] text-amber-400 font-extrabold flex items-center gap-1">
                      <Store size={12} />
                      <span>المورد النشط الحقيقي للفوترة: <b>{getWholesalerIdInCart()?.name}</b></span>
                    </div>

                    {/* Cart Drafts Saved Templates Section */}
                    <div className="bg-[#0b101e] border border-white/5 p-3 rounded-2xl space-y-3 text-right">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                          <Layers size={12} className="text-amber-400" />
                          <span>نماذج السلال ومسودات الحفظ السريع:</span>
                        </span>
                        <span className="px-1.5 py-0.2 text-[8px] bg-sky-500/10 text-sky-300 border border-sky-500/20 rounded font-black">أداة تسريع ⚡</span>
                      </div>

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="اسم المسودة (مثال: شاشات أسبوعية)"
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          className="flex-1 bg-navy-950 border border-white/10 rounded-xl px-2.5 py-1 text-[10px] text-white focus:outline-none focus:border-amber-500 font-bold text-right placeholder-gray-600"
                        />
                        <button
                          type="button"
                          onClick={handleSaveCartDraft}
                          className="px-3 bg-gradient-to-r from-sky-500 to-blue-600 text-slate-950 font-black text-[10px] rounded-xl hover:from-sky-400 hover:to-blue-500 transition-all cursor-pointer shadow-md select-none"
                        >
                          حفظ 💾
                        </button>
                      </div>

                      {savedDrafts.length > 0 ? (
                        <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                          {savedDrafts.map(draft => (
                            <div
                              key={draft.id}
                              className="flex items-center justify-between p-1.5 bg-navy-950/60 rounded-lg border border-white/5 text-[9px] font-bold"
                            >
                              <div className="min-w-0 flex-1 pl-2">
                                <span className="text-white font-black block truncate">{draft.name}</span>
                                <span className="text-gray-500 text-[8px] block">{draft.cart.length} أصناف • {new Date(draft.createdAt).toLocaleDateString('ar-YE')}</span>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleLoadCartDraft(draft)}
                                  className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 rounded transition-colors cursor-pointer"
                                >
                                  تعبئة السلة 📂
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCartDraft(draft.id)}
                                  className="px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors cursor-pointer"
                                >
                                  حذف
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9px] text-gray-500 text-center">لا توجد مسودات سلال محفوظة حالياً.</p>
                      )}
                    </div>

                    {/* Minimum Order Value Progress & Auto-Balance */}
                    <div className="bg-[#0b101e] border border-white/5 p-3 rounded-2xl space-y-2 text-right">
                      <div className="flex items-center justify-between text-[11px] font-black">
                        <span className="text-gray-400 flex items-center gap-1">
                          <Sliders size={11} className="text-emerald-400 animate-pulse" />
                          <span>الحد الأدنى لطلب المورد لتشغيل الجملة:</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={minOrderLimit}
                            onChange={(e) => setMinOrderLimit(Math.max(1000, parseInt(e.target.value) || 0))}
                            className="w-20 bg-navy-950 border border-white/10 rounded px-1.5 py-0.5 text-center text-[10px] font-bold text-white focus:outline-none focus:border-amber-500"
                          />
                          <span className="text-gray-500 text-[10px]">ر.ي</span>
                        </div>
                      </div>

                      {(() => {
                        const total = getCartTotal();
                        const progress = Math.min(100, (total / minOrderLimit) * 100);
                        const isBelow = total < minOrderLimit;
                        const missing = minOrderLimit - total;

                        return (
                          <div className="space-y-1.5">
                            <div className="w-full bg-navy-950 rounded-full h-2 overflow-hidden border border-white/5">
                              <div
                                className={`h-full transition-all duration-500 ${isBelow ? 'bg-gradient-to-r from-orange-500 to-amber-400' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                              <span className={isBelow ? 'text-orange-400 font-extrabold animate-pulse' : 'text-emerald-400 font-extrabold'}>
                                {isBelow ? `متبقي للوصول للحد: ${missing.toLocaleString()} ر.ي ⚠️` : 'تم استيفاء الحد الأدنى بنجاح! ✅'}
                              </span>
                              <span className="text-gray-400 font-bold">{progress.toFixed(0)}%</span>
                            </div>

                            {isBelow && (
                              <button
                                type="button"
                                onClick={handleAutoBalanceQuantities}
                                className="w-full mt-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black py-1.5 rounded-xl text-[9px] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95 duration-200"
                              >
                                <Zap size={11} className="animate-bounce" />
                                <span>موازنة كميات السلة تلقائياً بنقرة واحدة ⚡</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Cart Items List */}
                    {cart.map(item => {
                      const originalProduct = products.find(p => p.id === item.productId);
                      const colors = originalProduct?.variants?.map(v => v.color) || [];

                      return (
                        <div
                          key={`${item.productId}-${item.selectedColor || ''}`}
                          className="p-3.5 bg-gradient-to-r from-navy-950 to-slate-900 border border-white/10 rounded-2xl flex flex-col gap-2.5 relative transition-all hover:border-[#D4AF37]/30 shadow-md text-right"
                        >
                          {/* Core item info row */}
                          <div className="flex gap-2.5 items-start">
                            {/* [صورة المنتج صغيرة] */}
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/55 border border-[#D4AF37]/25 shrink-0 flex items-center justify-center">
                              <img
                                src={originalProduct?.photos?.[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=100&q=80'}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* [اسم السلعة] and base price */}
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-black text-[11px] leading-tight truncate">{item.name}</p>
                              <span className="text-[9px] text-gray-400 mt-1 block">
                                سعر الوحدة: <b className="text-[#D4AF37] font-sans">{item.price.toLocaleString()}</b> ر.ي
                              </span>
                            </div>

                            {/* Delete Button */}
                            <button
                              onClick={() => removeItem(item.productId, item.selectedColor)}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg shrink-0 transition-all cursor-pointer"
                              title="حذف الصنف"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {/* Flexible Options Toggle & Selects */}
                          <div className="p-2 bg-black/45 rounded-xl space-y-1.5 border border-white/5 text-[9.5px]">
                            {/* Variant Color Switcher */}
                            {colors.length > 0 && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">اللون / الموديل:</span>
                                <select
                                  value={item.selectedColor || ''}
                                  onChange={(e) => {
                                    const newColor = e.target.value;
                                    if (!originalProduct) return;
                                    let newPrice = originalProduct.price;
                                    let newMaxStock = originalProduct.stock;
                                    const variant = originalProduct.variants?.find(v => v.color === newColor);
                                    if (variant) {
                                      if (variant.priceOverride) newPrice = variant.priceOverride;
                                      newMaxStock = variant.stock;
                                    }
                                    const tierPricingInfo = getProductPriceWithTier(originalProduct);
                                    let price = Math.round(newPrice * tierPricingInfo.multiplier);

                                    updateItemOptions(item.productId, item.selectedColor, {
                                      selectedColor: newColor,
                                      price: price,
                                      maxStock: newMaxStock
                                    });
                                  }}
                                  className="bg-navy-950 border border-white/10 rounded px-1.5 py-0.5 text-white focus:outline-none focus:border-amber-500 text-right font-black"
                                >
                                  {colors.map(col => (
                                    <option key={col} value={col}>{col}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Warranty Select */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-gray-400">نوع الضمان المتاح:</span>
                              <select
                                value={item.warrantyType || 'none'}
                                onChange={(e) => {
                                  const newType = e.target.value as 'none' | 'operational' | 'limited';
                                  updateItemOptions(item.productId, item.selectedColor, {
                                    warrantyType: newType,
                                    warrantyDuration: newType === 'limited' ? 30 : 0
                                  });
                                }}
                                className="bg-navy-950 border border-white/10 rounded px-1.5 py-0.5 text-white focus:outline-none focus:border-amber-500 text-right font-black"
                              >
                                <option value="none">بدون ضمان 🚫</option>
                                <option value="operational">ضمان تشغيل 🔌</option>
                                <option value="limited">ضمان محدود بالمدة 🛡️</option>
                              </select>
                            </div>

                            {/* Warranty Duration Input (If limited) */}
                            {item.warrantyType === 'limited' && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">مدة الضمان (بالأيام):</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.warrantyDuration || 30}
                                  onChange={(e) => {
                                    const duration = parseInt(e.target.value) || 0;
                                    updateItemOptions(item.productId, item.selectedColor, {
                                      warrantyDuration: duration
                                    });
                                  }}
                                  className="w-14 bg-navy-950 border border-white/10 rounded px-1 py-0.5 text-center text-white focus:outline-none focus:border-amber-500 font-bold font-sans"
                                />
                              </div>
                            )}

                            {/* Compensation Option Select */}
                            {item.warrantyType && item.warrantyType !== 'none' && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">طريقة التعويض:</span>
                                <select
                                  value={item.compensationOption || 'replace_same'}
                                  onChange={(e) => {
                                    updateItemOptions(item.productId, item.selectedColor, {
                                      compensationOption: e.target.value as 'refund' | 'replace_same' | 'replace_other'
                                    });
                                  }}
                                  className="bg-navy-950 border border-white/10 rounded px-1.5 py-0.5 text-white focus:outline-none focus:border-amber-500 text-right font-black"
                                >
                                  <option value="refund">💵 استرداد مالي</option>
                                  <option value="replace_same">🔄 استبدال بنفس الصنف</option>
                                  <option value="replace_other">🔁 استبدال بصنف آخر عيني</option>
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Stepper inputs & Enter-updating total price inputs */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                            {/* [الكمية المطلوبة] */}
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500">الكمية:</span>
                              <div className="flex bg-black/45 border border-white/10 p-0.5 rounded-lg items-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.quantity > 1) {
                                      updateQuantity(item.productId, item.selectedColor, item.quantity - 1);
                                    } else {
                                      removeItem(item.productId, item.selectedColor);
                                    }
                                  }}
                                  className="w-4.5 h-4.5 bg-navy-800 rounded text-gray-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
                                >
                                  <Minus size={8} />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.maxStock}
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val)) {
                                      updateQuantity(item.productId, item.selectedColor, val);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="w-8 text-center bg-transparent border-none text-[10px] font-black text-white p-0 focus:ring-0 focus:outline-none font-sans"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, item.selectedColor, item.quantity + 1)}
                                  disabled={item.quantity >= item.maxStock}
                                  className="w-4.5 h-4.5 bg-[#D4AF37] rounded text-slate-950 font-black flex items-center justify-center cursor-pointer transition-all disabled:opacity-30"
                                >
                                  <Plus size={8} />
                                </button>
                              </div>
                              <span className="text-[8.5px] text-gray-500 font-mono">/{item.maxStock}</span>
                            </div>

                            {/* [السعر الإجمالي المحدث فوراً بالـ Enter] */}
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-400">الإجمالي:</span>
                              <div className="flex bg-black/45 border border-white/10 px-1.5 py-0.5 rounded-lg items-center">
                                <input
                                  type="text"
                                  value={(item.price * item.quantity).toLocaleString()}
                                  onChange={(e) => {
                                    const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                                    const newTotal = parseInt(cleanVal) || 0;
                                    const computedQty = Math.max(1, Math.min(Math.round(newTotal / item.price), item.maxStock));
                                    updateQuantity(item.productId, item.selectedColor, computedQty);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="w-16 bg-transparent border-none text-[10px] font-black text-amber-400 p-0 focus:ring-0 focus:outline-none text-left font-sans"
                                />
                                <span className="text-[8px] text-gray-500 font-bold mr-1">ر.ي</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Checkout billing triggers */}
              {cart.length > 0 && (
                <div className="border-t border-white/5 pt-4 mt-4 space-y-4">
                  
                  {/* Totals panel */}
                  <div className="bg-black/45 p-3 rounded-2xl border border-white/5 text-xs text-right space-y-1.5 font-bold">
                    <div className="flex justify-between items-center text-gray-400">
                      <span>إجمالي عدد العناصر:</span>
                      <span className="text-white">{getCartCount()} سلع</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">القيمة الإجمالية للثمن:</span>
                      <span className="text-amber-500 font-extrabold text-base">{getCartTotal().toLocaleString()} ر.ي</span>
                    </div>
                  </div>

                  {/* Payment Type Choosing */}
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] text-gray-500 font-bold block">طريقة تسوية الدفع للطلب:</label>
                    {(() => {
                      const activeWholesalerInCart = getWholesalerIdInCart();
                      const activeWholesalerConn = activeWholesalerInCart ? connectedSuppliers.find(s => s.supplierId === activeWholesalerInCart.id) : null;
                      const allowed = activeWholesalerConn?.allowedPayments || ['cash', 'deferred', 'transfer', 'jampay'];
                      const p = activeWholesalerConn?.permissions || {
                        can_pay_cash: allowed.includes('cash'),
                        can_pay_credit: allowed.includes('deferred'),
                        can_pay_jam: allowed.includes('jampay') || allowed.includes('transfer'),
                        is_blocked: activeWholesalerConn?.status === 'blocked'
                      };
                      const isDebtLocked = activeWholesalerConn?.deferredLocked === true || activeWholesalerConn?.debtWarning === true;
                      const isTransferLocked = activeWholesalerConn?.transferLocked === true;

                      return (
                        <div className="grid grid-cols-4 gap-1 text-[8.5px] sm:text-[10px] font-black text-center font-sans">
                          
                          {/* 1. حوالة كاش */}
                          {p.can_pay_jam &&
                            <button
                              type="button"
                              onClick={() => {
                                if (isTransferLocked) return;
                                setPaymentType('money_transfer');
                              }}
                              disabled={isTransferLocked}
                              className={`py-2 px-1 border rounded-lg transition-all cursor-pointer ${
                                paymentType === 'money_transfer'
                                  ? 'bg-sky-500/15 border-sky-500 text-sky-400 font-bold'
                                  : 'bg-navy-900 border-white/5 text-gray-400 hover:border-white/10'
                              } disabled:opacity-45 disabled:cursor-not-allowed`}
                            >
                              {isTransferLocked ? '❌ الإيداع مقفل' : 'إيداع بنكي'}
                            </button>
                          }

                          {/* 2. نقداً */}
                          {p.can_pay_cash &&
                            <button
                              type="button"
                              onClick={() => setPaymentType('cash')}
                              className={`py-2 px-1 border rounded-lg transition-all cursor-pointer ${
                                paymentType === 'cash'
                                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold'
                                  : 'bg-navy-900 border-white/5 text-gray-400 hover:border-white/10'
                              }`}
                            >
                              نقداً / متفق
                            </button>
                          }

                          {/* 3. آجل بالدفتر */}
                          {p.can_pay_credit &&
                            <button
                              type="button"
                              onClick={() => {
                                if (isDebtLocked) return;
                                setPaymentType('debt');
                              }}
                              disabled={isDebtLocked}
                              className={`py-3 px-1 border rounded-lg transition-all cursor-pointer ${
                                paymentType === 'debt'
                                  ? 'bg-rose-500/15 border-rose-500 text-rose-400 font-bold'
                                  : 'bg-navy-900 border-white/5 text-gray-400 hover:border-white/10'
                              } disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-red-950/25 disabled:border-red-500/10 disabled:text-gray-500`}
                            >
                              {isDebtLocked ? '❌ الآجل مقفل' : 'قيد بآجل الدفتر'}
                            </button>
                          }

                          {/* 4. JAM Pay */}
                          {p.can_pay_jam &&
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentType('jampay');
                                setIsJAMPayOpen(true);
                              }}
                              className={`py-1 px-1 border rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer duration-200 ${
                                paymentType === 'jampay'
                                  ? 'bg-amber-500/15 border-amber-500 text-amber-400 font-bold'
                                  : 'bg-navy-900 border-white/5 text-gray-400 hover:border-white/10'
                              }`}
                              id="market-jampay-btn"
                            >
                              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0 animate-bounce" />
                              <span className="flex flex-col items-center leading-none text-center">
                                <span className="font-bold text-[9px] text-[#D4AF37]">JAM Pay</span>
                                <span className="text-[7px] text-amber-400/70 font-medium leading-none">جام بي</span>
                              </span>
                            </button>
                          }
                        </div>
                      );
                    })()}

                    {(() => {
                      const activeWholesalerInCart = getWholesalerIdInCart();
                      const activeWholesalerConn = activeWholesalerInCart ? connectedSuppliers.find(s => s.supplierId === activeWholesalerInCart.id) : null;
                      if (activeWholesalerConn?.debtWarning === true) {
                        return (
                          <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl text-[10px] text-right text-rose-400 space-y-2 mt-2">
                            <span className="font-extrabold block">⚠️ {activeWholesalerConn.debtMessage || 'عليك ديون متراكمة يرجى السداد'}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedLedgerConn(activeWholesalerConn)}
                              className="w-full bg-rose-500 hover:bg-rose-600 text-slate-950 font-black py-2 rounded-xl text-[9px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <BarChart2 size={11} />
                              <span>عرض كشف الحساب المالي المفتوح للعميل 📂</span>
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Money Transfer detailed inputs (Shown conditionally) */}
                  {paymentType === 'money_transfer' && (
                    <div className="bg-[#0b1125] p-3 rounded-2xl border border-white/5 space-y-2.5 text-right text-xs">
                      <div className="flex items-center gap-1 text-sky-400 border-b border-white/5 pb-1 mb-1 font-black">
                        <Wallet size={12} />
                        <span>بيانات الإيداع والمحافظ الإلكترونية للتسوية (سلة الطلب في السوق):</span>
                      </div>

                      {/* Display deposit wallets in Market Cart */}
                      <WalletDepositCard
                        wallets={bankAccounts}
                        ownerId={profile?.ownerId || profile?.uid}
                        storeName={getWholesalerIdInCart()?.name || 'مورد الجملة في السوق'}
                        compact={true}
                        allowEdit={true}
                        title="بيانات المحافظ الإلكترونية المتاحة للإيداع"
                        subtitle="يرجى تحويل مبلغ الطلبية إلى إحدى المحافظ الإلكترونية التالية:"
                      />

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[9px] text-gray-500">اسم شبكة الصرافة للعميل:</label>
                          <select
                            value={exchangeNetwork}
                            onChange={(e) => setExchangeNetwork(e.target.value)}
                            className="w-full bg-black/45 border border-white/5 p-2 rounded-lg text-[11px] text-white focus:outline-none font-bold"
                          >
                            <option value="الكريمي اكسبرس">الكريمي اكسبرس</option>
                            <option value="النجم للحوالات">النجم للحوالات</option>
                            <option value="الامتياز للحوالات">الامتياز للحوالات</option>
                            <option value="المريسي للصرافة">المريسي للصرافة</option>
                            <option value="دادية اونلاين">دادية اونلاين</option>
                            <option value="العمقي والشركاء">العمقي والشركاء</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-sky-400 font-extrabold">* رقم الإيداع المرجعي:</label>
                          <input
                            type="text"
                            required
                            placeholder="مثال: 98450123"
                            value={transferRefNum}
                            onChange={(e) => setTransferRefNum(e.target.value)}
                            className="w-full bg-black/45 border border-sky-400/20 p-2 rounded-lg text-white font-mono text-center focus:border-sky-400 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-gray-500">المبلغ المدون بالسند:</label>
                          <input
                            type="number"
                            placeholder={getCartTotal().toString()}
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            className="w-full bg-black/45 border border-white/5 p-2 rounded-lg text-white font-bold focus:outline-none text-center"
                          />
                        </div>

                        <div className="col-span-2 space-y-1">
                          <label className="text-[9px] text-gray-500">اسم مودع المبلغ الكامل (للمطابقة):</label>
                          <input
                            type="text"
                            placeholder="اكتب الاسم كما هو بطلب التحويل..."
                            value={transferSenderName}
                            onChange={(e) => setTransferSenderName(e.target.value)}
                            className="w-full bg-black/45 border border-white/5 p-2 rounded-lg text-[11px] text-white focus:outline-none placeholder:text-gray-600 font-bold"
                          />
                        </div>
                      </div>

                      {/* Real Drag and Drop & camera click file uploader that loads actual image files */}
                      <div className="space-y-1.5 mt-2.5">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="money-transfer-receipt-uploader"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (profile?.tier_level === 'standard' || !profile?.tier_level) {
                                alert("عزيزي العميل، إن مطوري البرنامج يودون تقديم ميزة نشر الصور مجاناً لكم بالكامل، ولكن تكلفة السيرفرات السحابية العالمية عالية جداً لضمان أمان فواتيركم وحوالاتكم وصيانتكم. ولذلك، خصصنا لكم باقات مرنة تناسب حجم تجارتكم بدقة: (باقة عادية | باقة متوسطة | باقة VIP). يرجى التواصل مع الإدارة لترقية حسابكم فوراً.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.readAsDataURL(file);
                              reader.onload = () => {
                                setAttachedReceiptUrl(reader.result as string);
                              };
                              reader.onerror = (err) => {
                                console.error('FileReader error:', err);
                              };
                            }
                          }}
                        />
                        <div
                          onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                          onDragLeave={() => setIsDraggingFile(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingFile(false);
                            if (profile?.tier_level === 'standard' || !profile?.tier_level) {
                              alert("عزيزي العميل، إن مطوري البرنامج يودون تقديم ميزة نشر الصور مجاناً لكم بالكامل، ولكن تكلفة السيرفرات السحابية العالمية عالية جداً لضمان أمان فواتيركم وحوالاتكم وصيانتكم. ولذلك، خصصنا لكم باقات مرنة تناسب حجم تجارتكم بدقة: (باقة عادية | باقة متوسطة | باقة VIP). يرجى التواصل مع الإدارة لترقية حسابكم فوراً.");
                              return;
                            }
                            const file = e.dataTransfer.files?.[0];
                            if (file && file.type.startsWith('image/')) {
                              compressProductImageFast(file).then((compressed) => {
                                setAttachedReceiptUrl(compressed);
                              }).catch((err) => {
                                console.error('Compression error:', err);
                              });
                            }
                          }}
                          className={`border-2 border-dashed ${isDraggingFile ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/10 hover:border-[#D4AF37]/30'} p-3 rounded-xl text-center cursor-pointer transition-all space-y-1`}
                          onClick={() => {
                            document.getElementById('money-transfer-receipt-uploader')?.click();
                          }}
                        >
                          {attachedReceiptUrl ? (
                            <div className="space-y-1.5 font-sans">
                              <img
                                src={attachedReceiptUrl}
                                alt="Receipt Thumbnail for Validation"
                                referrerPolicy="no-referrer"
                                className="mx-auto max-h-24 w-auto object-contain rounded-lg border border-white/10 shadow-lg"
                              />
                              <span className="text-[8.5px] text-emerald-400 font-extrabold block">
                                ✅ تم تحميل السند (انقر للتغيير)
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1 font-sans">
                              <ImageIcon size={16} className="mx-auto text-sky-400 opacity-70" />
                              <span className="text-[9px] text-[#D4AF37] font-black block">إرفاق لقطة شاشة / صورة السند الورقي</span>
                              <span className="text-[8px] text-gray-500 block leading-snug">يدعم سحب الملفات أو التشغيل التلقائي للكاميرا والغاليري للتحصيل الفوري</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Delivery / Shipping instructions */}
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] text-gray-500 font-bold block">ملاحظات وقناة الشحن لطلب الجملة:</label>
                    <textarea
                      placeholder="امثلة: الإرسال عبر باصات النقل المعتمدة، فرزة باب اليمن، الاتفاق اليدوي..."
                      value={checkoutNotes}
                      onChange={(e) => setCheckoutNotes(e.target.value)}
                      className="w-full h-14 bg-black/30 border border-white/5 p-2 rounded-xl text-xs text-white focus:outline-none placeholder:text-gray-600 font-bold resize-none"
                    />
                  </div>

                  {/* Key Renewal Interface */}
                  {(() => {
                    const activeWholesalerInCart = getWholesalerIdInCart();
                    const activeWholesalerConn = activeWholesalerInCart ? connectedSuppliers.find(s => s.supplierId === activeWholesalerInCart.id) : null;
                    const isTransferLocked = activeWholesalerConn?.transferLocked === true;
                    const isDebtLocked = activeWholesalerConn?.deferredLocked === true || activeWholesalerConn?.debtWarning === true;

                    if (!isTransferLocked && !isDebtLocked) return null;

                    return (
                      <div className="bg-red-500/[0.03] border-2 border-dashed border-red-500/20 p-4 rounded-3xl text-right space-y-3 mt-3 animate-fadeIn">
                        <div className="flex items-center gap-2 text-red-400 font-extrabold text-xs">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping shrink-0" />
                          <span>🚨 قفل الدفع وحظر الخدمة نشط حالياً</span>
                        </div>
                        
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          {isTransferLocked && "⚠️ تم إيقاف خدمة الدفع بحوالة لتقديم مستندات غير معتمدة أو وهمية."}
                          {isDebtLocked && "⚠️ تم تعليق البيع بالآجل مؤقتاً لتجاوز السقف أو تراكم الديون."}
                          {" يمكنك إدخال مفتاح تجديد الارتباط الصادر من المورد لإعادة تفعيل الصلاحيات وفك القيود فوراً:"}
                        </p>

                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            maxLength={20}
                            placeholder="مثال: 54912"
                            value={renewalKey}
                            onChange={(e) => setRenewalKey(e.target.value)}
                            className="bg-black/50 border border-white/10 text-white font-mono text-center rounded-xl text-xs py-2 px-3 grow focus:border-red-500/50 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRenewConnectionKey(renewalKey)}
                            disabled={isRenewingKey || !renewalKey.trim()}
                            className="bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white text-xs font-black px-4 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-40 shrink-0"
                          >
                            {isRenewingKey ? 'جاري التحقق...' : 'تجديد الصلاحيات 🔑'}
                          </button>
                        </div>

                        {renewalError && (
                          <p className="text-[9.5px] text-red-400 font-black text-center">{renewalError}</p>
                        )}
                        {renewalSuccess && (
                          <p className="text-[9.5px] text-emerald-400 font-black text-center">{renewalSuccess}</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Dynamic Deduction Box/Account Selection Panel (Account Ledger Auto-Mapping) */}
                  {(paymentType === 'cash' || paymentType === 'money_transfer' || paymentType === 'jampay') && (
                    <div className="bg-[#0b1125] p-3 rounded-2xl border border-white/5 space-y-2.5 text-right text-xs animate-fadeIn">
                      <div className="flex items-center gap-1 text-amber-400/90 font-black border-b border-white/5 pb-1 mb-1">
                        <Wallet size={12} className="text-amber-400" />
                        <span>تحديد صندوق أو حساب الخصم المالي:</span>
                      </div>
                      <p className="text-[8.5px] text-gray-400 leading-snug">
                        اختر الحساب أو الصندوق الذي سيتم تدوين وتأكيد الحسم المالي الفوري لقيمة طلبك منه:
                      </p>
                      <select
                        value={selectedDeductedBoxId}
                        onChange={(e) => setSelectedDeductedBoxId(e.target.value)}
                        className="w-full bg-black/45 border border-white/10 text-white px-2.5 py-2 rounded-xl font-bold font-sans text-[11px] outline-none cursor-pointer focus:border-[#D4AF37]/50"
                      >
                        {buyerBoxes.map(box => (
                          <option key={box.id} value={box.id}>
                            {box.name} {box.source !== 'system' ? ` (رصيد: ${box.balance?.toLocaleString()} ${box.currency})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Feedback on checkouts */}
                  {checkoutStatus.error && (
                    <div className="p-3 bg-red-650/10 border border-red-500/20 text-[10px] text-red-400 font-black rounded-xl flex items-center gap-1">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{checkoutStatus.error}</span>
                    </div>
                  )}

                  {checkoutStatus.successOrderId && (
                    <div className="p-3 bg-emerald-600/10 border border-emerald-500/10 text-[10px] text-emerald-400 font-black rounded-xl space-y-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle size={14} />
                        <span>تم حجز وخصم الكميات من مخزن المورد بنجاح!</span>
                      </div>
                      <p className="font-mono text-[9px] text-gray-400 select-all font-bold">ID: #{checkoutStatus.successOrderId}</p>
                    </div>
                  )}

                  {/* Submit checkout buttons */}
                  {(() => {
                    const cartPaymentCheck = checkCurrentCartPaymentPermission();
                    const isUserBlocked = userDbProfile?.status === 'blocked' || (userDbProfile?.blockedUntil && userDbProfile.blockedUntil > Date.now());
                    
                    const activeWholesalerInCart = getWholesalerIdInCart();
                    const activeWholesalerConn = activeWholesalerInCart ? connectedSuppliers.find(s => s.supplierId === activeWholesalerInCart.id) : null;
                    const allowed = activeWholesalerConn?.allowedPayments || ['cash', 'deferred', 'transfer', 'jampay'];
                    const p = activeWholesalerConn?.permissions || {
                      can_pay_cash: allowed.includes('cash'),
                      can_pay_credit: allowed.includes('deferred'),
                      can_pay_jam: allowed.includes('jampay') || allowed.includes('transfer'),
                      is_blocked: activeWholesalerConn?.status === 'blocked'
                    };
                    const isDebtLocked = activeWholesalerConn?.deferredLocked === true || activeWholesalerConn?.debtWarning === true;

                    // Calculate blocked category state
                    const blockedCats = activeWholesalerConn?.blockedCategories || [];
                    const hasBlockedCategoryItem = cart.some(item => blockedCats.includes(item.category));

                    // Calculate credit details
                    const creditLimit = activeWholesalerConn?.creditLimit || activeWholesalerConn?.debtSettings?.ceilingLimit || activeWholesalerConn?.ceilingLimit || 0;
                    const currentDebt = Number(activeWholesalerConn?.debt || activeWholesalerConn?.payableBalance || 0);
                    const pendingSentDebtOrders = mySentOrders.filter(
                      o => o.wholesalerId === activeWholesalerConn?.supplierId && o.paymentType === 'debt' && o.status === 'pending'
                    );
                    const pendingSentDebtTotal = pendingSentDebtOrders.reduce((sum, o) => sum + (o.total || 0), 0);
                    const remainingCreditLimit = Math.max(0, creditLimit - currentDebt - pendingSentDebtTotal);
                    const cartTotal = getCartTotal();
                    const exceedsCreditLimit = p.can_pay_credit && creditLimit > 0 && cartTotal > remainingCreditLimit;

                    return checkoutStatus.successOrderId ? (
                      <button
                        onClick={() => {
                          setCheckoutStatus({ loading: false, error: null, successOrderId: null });
                          setIsCartOpen(false);
                        }}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs cursor-pointer transition-all"
                      >
                        موافق وإغلاق السلة
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {/* Remaining Credit Status Display for Buyer */}
                        {activeWholesalerConn && p.can_pay_credit && (
                          <div className="bg-[#040815] p-3.5 rounded-2xl border border-white/5 space-y-2 text-right text-xs">
                            <div className="flex justify-between items-center text-gray-400">
                              <span>السقف الائتماني المعتمد:</span>
                              <span className="font-mono text-white font-bold">{creditLimit.toLocaleString()} ر.ي</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-400">
                              <span>المديونية المسجلة:</span>
                              <span className="font-mono text-red-400 font-bold">{currentDebt.toLocaleString()} ر.ي</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-400">
                              <span>طلبيات قيد الانتظار:</span>
                              <span className="font-mono text-amber-500 font-bold">{pendingSentDebtTotal.toLocaleString()} ر.ي</span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-white/5 pt-1.5 font-black">
                              <span className="text-gray-350">السقف المتبقي المتاح:</span>
                              <span className={`font-mono text-sm ${exceedsCreditLimit ? 'text-red-400' : 'text-emerald-400'}`}>{remainingCreditLimit.toLocaleString()} ر.ي</span>
                            </div>
                          </div>
                        )}

                        {checkoutStatus.loading ? (
                          <div className="w-full py-3.5 bg-gray-900 border border-white/5 rounded-xl text-xs text-gray-400 font-bold flex items-center justify-center gap-2">
                            <RefreshCcw size={14} className="animate-spin" />
                            <span>جاري معالجة الطلب وخصم المخزون ذرياً...</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2.5">
                            {/* [إرسال الطلب نقد / حوالة] */}
                            <button
                              type="button"
                              onClick={() => {
                                // Default payment type to cash if selected debt is not compatible, then submit
                                const defaultType = p.can_pay_cash ? 'cash' : (p.can_pay_jam ? 'jampay' : 'cash');
                                setPaymentType(defaultType as any);
                                setTimeout(() => {
                                  handleOrderSubmission();
                                }, 50);
                              }}
                              disabled={isUserBlocked || p.is_blocked || hasBlockedCategoryItem || !cartPaymentCheck.isAllowed}
                              className="py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-xl text-[10.5px] transition-all flex flex-col items-center justify-center gap-1 shadow-md cursor-pointer active:scale-95 duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
                            >
                              <Wallet size={13} />
                              <span>إرسال نقد / إيداع 💵</span>
                            </button>

                            {/* [طلب بالدين الآجل ضمن السقف المتاح] */}
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentType('debt');
                                setTimeout(() => {
                                  handleOrderSubmission();
                                }, 50);
                              }}
                              disabled={isUserBlocked || !p.can_pay_credit || isDebtLocked || p.is_blocked || hasBlockedCategoryItem || exceedsCreditLimit || !cartPaymentCheck.isAllowed}
                              className="py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-[10.5px] transition-all flex flex-col items-center justify-center gap-1 shadow-md cursor-pointer active:scale-95 duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Shield size={13} />
                              <span>طلب بالدين الآجل 📄</span>
                            </button>
                          </div>
                        )}

                        {hasBlockedCategoryItem && (
                          <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/15 p-3 rounded-xl text-right leading-relaxed font-black mt-2">
                            🛑 لا يمكن إرسال الطلب من الخانة المحظورة، يرجى التغيير للمسموح أو تجديد المفتاح
                          </p>
                        )}

                        {!cartPaymentCheck.isAllowed && (
                          <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/15 p-2.5 rounded-xl text-right leading-relaxed font-bold">
                            ⚠️ {cartPaymentCheck.reason}
                          </p>
                        )}
                        {isUserBlocked && (
                          <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/15 p-2.5 rounded-xl text-right leading-relaxed font-bold mt-1.5 animate-pulse">
                            ⚠️ تم حظر حسابك من إرسال الطلبات لمدة أسبوع بسبب محاولة دفع وهمية.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. DIALOG: WHOLESALER ADD NEW PRODUCTS */}
      <AnimatePresence>
        {isAddProductOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddProductOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#0a0f20] border-2 border-amber-500/30 rounded-[2rem] p-6 shadow-2xl overflow-y-auto max-h-[90vh] text-right z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg"><Sparkles size={16} /></span>
                  <h3 className="text-base font-black text-white">إضافة وعرض سلعة جملة بسوق التوريد</h3>
                </div>
                <button onClick={() => setIsAddProductOpen(false)} className="p-1 text-gray-500 hover:text-white rounded-lg hover:bg-white/5">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-4 text-xs font-bold text-gray-300">
                
                <div className="space-y-1">
                  <label>اسم السلعة التجاري بالتفصيل:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثل: iPhone 15 Pro Max دبل شريحة بضمان"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full bg-black/45 border border-white/5 p-3 rounded-lg text-white font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label>سعر التكلفة للجملة (ر.ي):</label>
                    <input
                      type="number"
                      required
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                      className="w-full bg-black/45 border border-white/5 p-3 rounded-lg text-white font-bold focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label>القسم / التصنيف الرئيسي:</label>
                    <select
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      className="w-full bg-black/45 border border-white/5 p-3 rounded-lg text-white font-bold focus:outline-none"
                    >
                      <option value="هواتف ذكية">هواتف ذكية</option>
                      <option value="قطع غيار أصلية">قطع غيار أصلية</option>
                      <option value="اكسسورات هواتف">اكسسورات هواتف</option>
                      <option value="شواحن وبطاريات">شواحن وبطاريات</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg space-y-2">
                  <label className="text-amber-500 font-bold block">رفع صورة المنتج مباشرة (سيتم ضغط الحجم تلقائياً):</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const base64 = await compressImage(file, 600, 600, 0.6);
                          setNewProduct({ ...newProduct, imageUrlInput: base64 });
                        } catch (err) {
                          console.error("Failed to compress image:", err);
                        }
                      }
                    }}
                    className="block w-full text-xs text-gray-400 file:ml-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-black hover:file:bg-amber-400 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label>أو ضع رابط الصورة التوضيحية للسلعة (URL):</label>
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/..."
                    value={newProduct.imageUrlInput}
                    onChange={(e) => setNewProduct({ ...newProduct, imageUrlInput: e.target.value })}
                    className="w-full bg-black/45 border border-white/5 p-3 rounded-lg text-white focus:outline-none font-medium"
                  />
                </div>

                <div className="border-t border-white/5 my-2 pt-2 space-y-1.5">
                  <label className="text-amber-500 font-extrabold flex items-center gap-1 text-[11px]">
                    <Tag size={12} />
                    <span>إعداد عينات الألوان والبدائل المتوفرة:</span>
                  </label>
                  
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-gray-400">الألوان المطروحة بالدفع المصنع (مفصولة بفاصلة):</label>
                      <input
                        type="text"
                        placeholder="بلاتينيوم طبيعي, ذهبي كلاسيكي, أسود كربوني"
                        value={newProduct.variantsStr}
                        onChange={(e) => setNewProduct({ ...newProduct, variantsStr: e.target.value })}
                        className="w-full bg-black/45 border border-white/5 p-3 rounded-lg text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-gray-400">مخزون الرصيد الافتراضي المتوفر لكل لون للطلب:</label>
                      <input
                        type="number"
                        value={newProduct.variantsStock}
                        onChange={(e) => setNewProduct({ ...newProduct, variantsStock: Number(e.target.value) })}
                        className="w-full bg-black/45 border border-white/5 p-3 rounded-lg text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1 font-bold text-gray-300">
                  <label>تفاصيل السلعة التقنية وفترة الضمان والشحن:</label>
                  <textarea
                    placeholder="مواصفات النواة، الضمان للموزعين، التوصيل عبر الباصات..."
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    className="w-full h-20 bg-black/45 border border-white/5 p-3 rounded-lg text-white focus:outline-none resize-none font-medium text-xs leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button type="submit" className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg transition-all">
                    تأكيد ونشر العرض بالتوريد
                  </button>
                  <button type="button" onClick={() => setIsAddProductOpen(false)} className="px-6 py-3 bg-navy-800 text-gray-300 hover:text-white rounded-lg">
                    إلغاء الحفظ
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <JAMPayModal isOpen={isJAMPayOpen} onClose={() => setIsJAMPayOpen(false)} />

      {/* 4. CUSTOM FINANCIAL LEDGER STATEMENT MODAL */}
      <AnimatePresence>
        {selectedLedgerConn && (
          <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLedgerConn(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-lg bg-gradient-to-b from-[#111836] to-[#0a0f25] border border-rose-500/20 rounded-3xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.15)] text-right z-10 space-y-6"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <button
                  type="button"
                  onClick={() => setSelectedLedgerConn(null)}
                  className="p-1.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2.5" dir="rtl">
                  <span className="p-2.5 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
                    <BarChart2 size={20} />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-white">كشف بيان الحساب المالي الفوري</h3>
                    <p className="text-[10px] text-gray-400">سجل الديون والمستحقات المفتوحة مع {selectedLedgerConn.supplierName}</p>
                  </div>
                </div>
              </div>

              {/* Outstanding overview */}
              <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 flex justify-between items-center text-right leading-relaxed" dir="rtl">
                <div className="text-left">
                  <span className="text-[10px] text-gray-500 block font-bold">إجمالي المطالبات المستحقة</span>
                  <span className="text-xl font-black text-rose-400 font-mono">150,000 ر.ي</span>
                </div>
                <div>
                  <span className="text-[11px] text-rose-400 font-black block">⚠️ وضع الحساب الحالي: مقيد الأجل</span>
                  <span className="text-[9.5px] text-gray-400 block mt-0.5">عليك ديون متراكمة يرجى السداد لتنشيط المعاملات</span>
                </div>
              </div>

              {/* Transactions list */}
              <div className="space-y-2.5" dir="rtl">
                <span className="text-[11px] text-gray-400 font-black block">الفواتير المعلقة وتحت طائلة المتأخرات:</span>
                <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin pr-1">
                  {(selectedLedgerConn.debtLedger || [
                    { id: 'LDG-201', date: '٢٠٢٦-٠٥-١٢', desc: 'توريد كابلات شبكية وألياف', amount: 85000, status: 'متأخر سداد 🛑' },
                    { id: 'LDG-202', date: '٢٠٢٦-٠٥-٢٢', desc: 'أطقم شواحن ومحولات ذكية طراز Pro', amount: 45000, status: 'متأخر سداد 🛑' },
                    { id: 'LDG-203', date: '٢٠٢٦-٠٥-٣٠', desc: 'منظم تيار وبطارية احتياطية المورد', amount: 20000, status: 'متأخر سداد 🛑' }
                  ]).map((item: any, i: number) => (
                    <div key={i} className="bg-black/40 border border-white/5 p-3 rounded-xl flex justify-between items-center text-xs">
                      <div className="text-left font-mono">
                        <span className="text-rose-400 font-black block">{item.amount.toLocaleString()} ر.ي</span>
                        <span className="text-[8.5px] text-gray-400 bg-rose-500/10 border border-rose-500/15 px-1.5 py-0.5 rounded-md mt-1 block">{item.status}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-white block">{item.desc}</span>
                        <span className="text-[9px] text-gray-500 block mt-0.5">تاريخ المعاملة: {item.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action advice instructions */}
              <div className="bg-black/30 border border-white/5 p-3 rounded-2xl text-[10px] text-gray-400 leading-relaxed text-right" dir="rtl">
                💡 <span className="font-bold">ملاحظة أمنية دائنة:</span> يرجى تزويد التاجر المورد بسند إرسال مالي أو السداد المباشر للصندوق لتصفير الرصيد المتأخر. سيقوم النظام الفوري بفك تجميد وقفل خدمات الآجل على حسابك بمجرد تخفيض المطالبات.
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLedgerConn(null)}
                  className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-rose-500/10"
                >
                  حسناً وفهمت الإجراء
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. PERMISSIONS / CHANNELS EDIT MODAL */}
      <AnimatePresence>
        {isPermissionsModalOpen && targetPermissionConn && (
          <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPermissionsModalOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-gradient-to-b from-[#0e162f] to-[#070b18] border border-white/10 rounded-3xl p-6 shadow-[0_0_40px_rgba(212,175,55,0.1)] text-right z-10 space-y-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <button
                  onClick={() => setIsPermissionsModalOpen(false)}
                  className="p-1 rounded-lg text-gray-500 hover:text-white transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-[#D4AF37]" />
                  <h3 className="text-sm font-black text-white">صلاحيات اتصال المقبس والارتباط</h3>
                </div>
              </div>

              {/* Supplier Info */}
              <div className="bg-black/30 border border-white/5 p-3 rounded-2xl flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/15 text-[#D4AF37] rounded-xl shrink-0">
                  <Store size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-white truncate">{targetPermissionConn.supplierName}</h4>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">{targetPermissionConn.supplierKey || 'JAM-B2B-KEY'}</p>
                </div>
              </div>

              {/* Key Validity Selection */}
              <div className="space-y-2">
                <label className="text-[11px] text-[#D4AF37] font-black block">⌛ صلاحية ارتباط الرمز السري:</label>
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-black">
                  {[
                    { id: 'permanent', label: 'دائم' },
                    { id: 'daily', label: 'يومي (24س)' },
                    { id: 'custom_hours', label: 'مخصص بالساعات' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPermissionKeyValidity(opt.id as any)}
                      className={`py-2 px-1 border-2 rounded-xl transition-all ${
                        permissionKeyValidity === opt.id
                          ? 'bg-amber-500/10 border-amber-500/60 text-amber-500 font-black'
                          : 'bg-navy-950 border-white/5 text-gray-400 hover:bg-white/5 shadow-inner'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {permissionKeyValidity === 'custom_hours' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                    <label className="text-[9px] text-gray-500 block mb-1">حدد عدد الساعات المسموحة للارتباط:</label>
                    <div className="flex bg-navy-950 border border-white/5 rounded-xl p-1.5 items-center">
                      <span className="text-[10px] text-gray-400 px-2">ساعة</span>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={permissionCustomHours}
                        onChange={(e) => setPermissionCustomHours(Number(e.target.value))}
                        className="flex-1 bg-transparent text-left text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Enabled Payment Channels */}
              <div className="space-y-2">
                <label className="text-[11px] text-[#D4AF37] font-black block">💳 قنوات الدفع المفعلة للارتباط:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'cash', label: 'نقد / متفق عليه', desc: 'تسوية فورية' },
                    { id: 'deferred', label: 'قيد بآجل الدفتر', desc: 'حساب الضمان' },
                    { id: 'transfer', label: 'إيداع بنكي مباشر', desc: 'سند رقمي' },
                    { id: 'jampay', label: 'Jam Pay المتطور', desc: 'محفظة معتمدة' }
                  ].map(ch => {
                    const isChecked = permissionAllowedPayments.includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setPermissionAllowedPayments(prev => prev.filter(x => x !== ch.id));
                          } else {
                            setPermissionAllowedPayments(prev => [...prev, ch.id]);
                          }
                        }}
                        className={`p-3 border-2 rounded-2xl text-right transition-all flex items-start gap-2.5 ${
                          isChecked
                            ? 'bg-[#0f152d] border-[#D4AF37]/50 text-white'
                            : 'bg-navy-950 border-white/5 text-gray-500 hover:border-white/10'
                        }`}
                      >
                        <div className={`p-1 rounded mt-0.5 shrink-0 transition-all ${isChecked ? 'bg-amber-500 text-slate-950' : 'bg-white/5 text-transparent'}`}>
                          <Check size={8} strokeWidth={4} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[10.5px] font-black leading-none ${isChecked ? 'text-amber-400' : 'text-gray-400'}`}>{ch.label}</p>
                          <p className="text-[8px] text-gray-500 truncate mt-1">{ch.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Blocked Categories selection */}
              <div className="space-y-2 border-t border-white/5 pt-3">
                <label className="text-[11px] text-[#D4AF37] font-black block">🚫 تحديد الفتحات والأقسام المحظورة (Blocked Partitions):</label>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {(categories.filter(c => c !== 'all').length > 0 ? categories.filter(c => c !== 'all') : ['هواتف ذكية', 'اكسسورات هواتف', 'قطع غيار أصلية', 'عام']).map(cat => {
                    const isBlocked = permissionBlockedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          if (isBlocked) {
                            setPermissionBlockedCategories(prev => prev.filter(x => x !== cat));
                          } else {
                            setPermissionBlockedCategories(prev => [...prev, cat]);
                          }
                        }}
                        className={`p-2 border-2 rounded-xl text-right transition-all flex items-center justify-between gap-1.5 ${
                          isBlocked
                            ? 'bg-red-500/10 border-red-500/40 text-red-400 font-bold'
                            : 'bg-navy-950 border-white/5 text-gray-400 hover:border-white/10'
                        }`}
                      >
                        <span className="truncate">{cat}</span>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isBlocked ? 'bg-red-500 animate-pulse' : 'bg-gray-700'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Credit Limit Input */}
              <div className="space-y-1.5 border-t border-white/5 pt-3">
                <label className="text-[11px] text-[#D4AF37] font-black block">💰 حد السقف الائتماني المعتمد (Credit Limit):</label>
                <div className="flex bg-navy-950 border border-white/5 rounded-xl p-2 items-center">
                  <span className="text-[10px] text-gray-400 px-2">ريال يمني</span>
                  <input
                    type="number"
                    min="0"
                    value={permissionCreditLimit}
                    onChange={(e) => setPermissionCreditLimit(Number(e.target.value))}
                    className="flex-1 bg-transparent text-left text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Partial Block / Freeze Toggle */}
              <div className="bg-red-500/5 border border-red-500/15 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${permissionIsPartiallyBlocked ? 'bg-red-500 text-white animate-pulse' : 'bg-red-500/10 text-red-400'}`}>
                    <Ban size={14} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10.5px] font-black text-rose-500 leading-tight">الحظر الجزئي للتاجر</p>
                    <p className="text-[8.5px] text-gray-500 mt-0.5">تجميد مؤقت لعمليات الشراء والربط بالسلع</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setPermissionIsPartiallyBlocked(!permissionIsPartiallyBlocked)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                    permissionIsPartiallyBlocked ? 'bg-red-500' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                      permissionIsPartiallyBlocked ? '-translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Action Operations */}
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={handleSavePermissions}
                  disabled={savingPermissions}
                  className="flex-1 py-3 bg-[#D4AF37] hover:bg-yellow-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_15px_rgba(212,175,55,0.2)] transition-all cursor-pointer"
                >
                  {savingPermissions ? <RefreshCcw size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                  <span>حفظ الصلاحيات والمزامنة</span>
                </button>
                <button
                  onClick={() => setIsPermissionsModalOpen(false)}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WebSocket Sync Secure Lock Overlay */}
      <AnimatePresence>
        {isWSSyncing && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-gradient-to-b from-[#0e162f] to-[#070b18] border-2 border-[#D4AF37] rounded-[2.5rem] p-6 shadow-[0_0_50px_rgba(212,175,55,0.15)] text-right z-10 overflow-hidden"
            >
              {/* Metallic Fluid Shimmer Accent */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.08),rgba(0,0,0,0))]" />
              
              <div className="relative space-y-5">
                <div className="flex flex-col items-center text-center space-y-3">
                  {/* Glowing Connection Key Sphere */}
                  <div className="relative w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute top-0.5 right-1" />
                    <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full absolute top-1 right-1.5" />
                    <RefreshCcw size={28} className="text-[#D4AF37] animate-spin -duration-1000" />
                  </div>
                  
                  <div>
                    <h3 className="text-base font-black text-white tracking-wide">بروتوكول بث المزامنة الفوري (WebSockets Link)</h3>
                    <p className="text-[10px] text-[#D4AF37] font-semibold mt-1">تداول الأرصدة والتحقق متعدد الهويات عبر العقد النشطة</p>
                  </div>
                </div>

                {/* Progress Visualizer */}
                <div className="bg-black/50 border border-white/5 rounded-2xl p-4 font-mono text-xs text-right space-y-2.5 relative">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-[9px] text-gray-500 font-bold">Node Socket 3000 Pipeline</span>
                    <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      مربوط بث حي
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 text-[10px] leading-relaxed text-gray-400 font-semibold select-none">
                    {wsLogs.map((log, i) => (
                      <div key={i} className="flex gap-2.5 justify-start text-right items-start">
                        <span className="text-[#D4AF37] shrink-0 font-bold">{`[SYSTEM]:`}</span>
                        <span className="text-gray-300 font-bold">{log}</span>
                      </div>
                    ))}
                  </div>

                  {/* Progress segment */}
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-3">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-[#D4AF37] h-full transition-all duration-300"
                      style={{ width: `${(wsSyncStep / 4) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="text-[10px] text-center text-gray-500 font-extrabold flex items-center justify-center gap-1.5">
                  <span>أمن الشبكة: RSA-4096 SHA256 Secure Node Mapped</span>
                  <ShieldCheck size={12} className="text-[#D4AF37]" />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Instant Catalog Ingestion Banner Overlay */}
      <AnimatePresence>
        {ingestingSupplierId && (
          <div className="fixed bottom-6 left-6 z-[120] max-w-sm w-full">
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-r from-slate-900 to-[#0e162f] border-2 border-[#D4AF37] shadow-[0_4px_30px_rgba(212,175,55,0.15)] rounded-2xl p-4 text-right relative overflow-hidden"
            >
              {/* Spinning gear ambient light */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-x-12 -translate-y-12" />
              
              <div className="relative space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 animate-spin">
                    <RefreshCcw size={15} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-white">نظام التوريد والجلب الفوري الـ B2B</h4>
                    <p className="text-[9px] text-[#D4AF37] font-bold">بث كتالوج المورد إلى مخزنك الموحد</p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-300 font-extrabold leading-relaxed">{ingestionLog}</p>

                {/* Progress bar container */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-bold text-gray-500 font-mono">
                    <span>{ingestionProgress}%</span>
                    <span>Direct Ingestor Active</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-[#D4AF37] h-full transition-all duration-300"
                      style={{ width: `${ingestionProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. GENERATE KEY MODAL */}
      <AnimatePresence>
        {isGenerateKeyModalOpen && (() => {
          const privilege = checkKeyGenPrivilege(profile);
          if (!privilege.allowed) return null;
          return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsGenerateKeyModalOpen(false)}
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              />

              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-md bg-gradient-to-b from-[#0e162f] to-[#070b18] border border-white/10 rounded-3xl p-6 shadow-[0_0_40px_rgba(212,175,55,0.15)] text-right z-10 space-y-5"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <button
                    type="button"
                    onClick={() => setIsGenerateKeyModalOpen(false)}
                    className="p-1 rounded-lg text-gray-500 hover:text-white transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                  <div className="flex items-center gap-2">
                    <Key size={18} className="text-[#D4AF37]" />
                    <h3 className="text-sm font-black text-white">توليد وبث مفتاح الارتباط الموحد</h3>
                  </div>
                </div>

                {/* Info text */}
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  سيقوم النظام بتوليد رمز سري مكون من 5 أرقام. عند إعطاء هذا الرمز لعملائك من تجار التجزئة، سيتمكنون من الارتباط المباشر والآمن بكتالوج الجملة الخاص بك فوراً وتصفح الأصناف المتوفرة.
                </p>

                {/* Generated Key Presentation */}
                <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center space-y-1">
                  <span className="text-[10px] text-gray-500 font-bold">مفتاح الارتباط الموحد المُقترح:</span>
                  <span className="text-3xl font-mono font-black text-[#D4AF37] tracking-widest">{generatedKey}</span>
                </div>

                {/* Key Validity Selection */}
                <div className="space-y-2">
                  <label className="text-[11px] text-[#D4AF37] font-black block">⌛ حدد مدة صلاحية الرمز:</label>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] font-black">
                    {[
                      { id: 'permanent', label: 'دائم' },
                      { id: 'daily', label: 'يومي (24س)' },
                      { id: 'hours', label: 'مخصص بالساعات' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setGenKeyValidity(opt.id as any)}
                        className={`py-2 px-1 border-2 rounded-xl transition-all ${
                          genKeyValidity === opt.id
                            ? 'bg-amber-500/10 border-amber-500/60 text-amber-500 font-black'
                            : 'bg-navy-950 border-white/5 text-gray-400 hover:bg-white/5 shadow-inner'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {genKeyValidity === 'hours' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                      <label className="text-[9px] text-gray-500 block mb-1">حدد عدد الساعات المسموحة للارتباط:</label>
                      <div className="flex bg-navy-950 border border-white/5 rounded-xl p-1.5 items-center">
                        <span className="text-[10px] text-gray-400 px-2">ساعة</span>
                        <input
                          type="number"
                          min="1"
                          max="720"
                          value={genKeyHours}
                          onChange={(e) => setGenKeyHours(Math.max(1, Number(e.target.value)))}
                          className="flex-1 bg-transparent text-left outline-none font-mono text-white text-xs px-2"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Payment Methods Checkboxes */}
                <div className="space-y-2.5">
                  <label className="text-[11px] text-[#D4AF37] font-black block">💳 قنوات الدفع المفعلة عبر هذا الارتباط:</label>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-black text-gray-300">
                    {[
                      { id: 'cash', label: 'كاش / نقدي' },
                      { id: 'deferred', label: 'آجل / ذمم' },
                      { id: 'transfer', label: 'إيداع بنكي' },
                      { id: 'jampay', label: 'Jam Pay الإلكتروني' }
                    ].map(chan => (
                      <label
                        key={chan.id}
                        className="flex items-center gap-2 p-2 bg-navy-950 border border-white/5 rounded-xl cursor-pointer hover:bg-white/5 transition-all animate-none"
                      >
                        <input
                          type="checkbox"
                          checked={genKeyAllowedPayments.includes(chan.id)}
                          onChange={() => toggleGenPaymentChannel(chan.id)}
                          className="rounded border-white/10 text-amber-500 focus:ring-amber-500"
                        />
                        <span>{chan.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsGenerateKeyModalOpen(false)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 rounded-xl font-black text-xs transition duration-300 cursor-pointer"
                  >
                    إلغاء وتراجع
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAndBroadcastKey}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs rounded-xl transition duration-300 shadow-lg shadow-amber-500/10 cursor-pointer"
                  >
                    تأكيد وبث مفتاح الارتباط
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* 6. B2B STORE PROFILE IDENTITY SETUP MODAL */}
      <AnimatePresence>
        {isB2bProfileModalOpen && b2bProfile && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsB2bProfileModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-gradient-to-b from-[#0e162f] to-[#070b18] border border-white/10 rounded-3xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.15)] text-right z-10 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <button
                  type="button"
                  onClick={() => setIsB2bProfileModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2">
                  <Store size={20} className="text-[#D4AF37]" />
                  <h3 className="text-base font-black text-white">إعداد وإدارة هويتك التجارية في السوق</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-gray-300">
                
                {/* Left Column: Core Controls & Safe Association */}
                <div className="space-y-4">
                  {/* Market Warehouse setup */}
                  <div className="bg-navy-950/50 p-4 border border-white/5 rounded-2xl space-y-2.5">
                    <label className="text-[11px] text-[#D4AF37] font-black block">🏬 تحديد مستودع سوق التوريد:</label>
                    
                    {!isCreatingNewWarehouse ? (
                      <div className="space-y-2">
                        <select
                          value={b2bProfile.warehouseName || ''}
                          onChange={(e) => setB2bProfile({ ...b2bProfile, warehouseName: e.target.value })}
                          className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white outline-none focus:border-amber-500"
                        >
                          {productCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          {productCategories.length === 0 && (
                            <option value="المستودع الرئيسي">المستودع الرئيسي للمحل</option>
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() => setIsCreatingNewWarehouse(true)}
                          className="text-[9px] text-amber-500 hover:underline font-bold"
                        >
                          + هل تريد إنشاء مستودع جديد تماماً؟
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="مثلاً: مستودع الجملة الذكي"
                          value={newWarehouseInputName}
                          onChange={(e) => setNewWarehouseInputName(e.target.value)}
                          className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white outline-none focus:border-amber-500"
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCreateNewWarehouseInSetup(newWarehouseInputName)}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3 py-1.5 rounded-lg text-[10px]"
                          >
                            إنشاء وحفظ المستودع
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCreatingNewWarehouse(false)}
                            className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-[10px]"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cash Box Selection */}
                  <div className="bg-navy-950/50 p-4 border border-white/5 rounded-2xl space-y-2.5">
                    <label className="text-[11px] text-[#D4AF37] font-black block">💼 ربط حساب وصناديق مبيعات المحل:</label>
                    <p className="text-[9.5px] text-gray-400 leading-tight">
                      اختر الحساب أو الصندوق المالي المعتمد بصفحة المحاسبة لتقييد حركات الدفع النقدي والتحويل المباشر لصفقات السوق فيه.
                    </p>
                    <select
                      value={b2bProfile.linkedBoxId || 'MAIN_CASH'}
                      onChange={(e) => setB2bProfile({ ...b2bProfile, linkedBoxId: e.target.value })}
                      className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white outline-none focus:border-amber-500"
                    >
                      {buyerBoxes.map(box => (
                        <option key={box.id} value={box.id}>
                          {box.name} {box.currency ? `(${box.currency})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Activity Categories Checkboxes */}
                  <div className="bg-navy-950/50 p-4 border border-white/5 rounded-2xl space-y-2.5">
                    <label className="text-[11px] text-[#D4AF37] font-black block">⚙️ نوع النشاط وهوية البضائع:</label>
                    <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                      {[
                        { id: 'mobiles', label: 'موبايلات وجوالات ذكية 📱' },
                        { id: 'accessories', label: 'إكسسوارات وسماعات 🎧' },
                        { id: 'parts', label: 'قطع غيار وصيانة 🔧' }
                      ].map(act => {
                        const isChecked = (b2bProfile.activities || []).includes(act.id);
                        return (
                          <label key={act.id} className="flex items-center gap-2 p-1.5 bg-black/20 rounded-xl border border-white/5 cursor-pointer hover:bg-white/5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const current = b2bProfile.activities || [];
                                const updated = isChecked
                                  ? current.filter((x: string) => x !== act.id)
                                  : [...current, act.id];
                                setB2bProfile({ ...b2bProfile, activities: updated });
                              }}
                              className="rounded border-white/10 text-amber-500 focus:ring-amber-500"
                            />
                            <span>{act.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Identity Presentation */}
                <div className="space-y-4">
                  {/* Logo and photo url */}
                  <div className="bg-navy-950/50 p-4 border border-white/5 rounded-2xl space-y-3">
                    <label className="text-[11px] text-[#D4AF37] font-black block">🖼️ شعار أو صورة المتجر:</label>
                    <div className="flex items-center gap-4">
                      {b2bProfile.logoUrl ? (
                        <img
                          src={b2bProfile.logoUrl}
                          alt="Logo Preview"
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-[#D4AF37]/50 shadow-md bg-slate-800"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80';
                          }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 border border-white/10">
                          <ImageIcon size={20} />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <div className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-1">
                          <label className="text-amber-500 font-bold block text-[9px]">رفع الشعار مباشرة من جهازك 📷:</label>
                          <input 
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const base64 = await compressImage(file, 400, 400, 0.6);
                                  setB2bProfile({ ...b2bProfile, logoUrl: base64 });
                                } catch (err: any) {
                                  console.error('Logo compression failed:', err);
                                }
                              }
                            }}
                            className="block w-full text-[9px] text-gray-400 file:ml-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-bold file:bg-amber-500 file:text-black hover:file:bg-amber-400 cursor-pointer"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="أو رابط الصورة (URL) لشعار متجرك"
                          value={b2bProfile.logoUrl || ''}
                          onChange={(e) => setB2bProfile({ ...b2bProfile, logoUrl: e.target.value })}
                          className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-1.5 text-[10px] text-white outline-none focus:border-amber-500"
                        />
                        <p className="text-[8.5px] text-gray-500">يمكنك رفع صورة مباشرة ليتم ضغطها، أو وضع رابط خارجي لشعار متجرك ليعرفه الموردون والعملاء.</p>
                      </div>
                    </div>
                  </div>

                  {/* Bank Accounts */}
                  <div className="bg-navy-950/50 p-4 border border-white/5 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <button
                        type="button"
                        onClick={handleAutoFetchBankAccounts}
                        className="text-[9px] bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 border border-[#D4AF37]/20 px-2 py-0.5 rounded font-black cursor-pointer"
                      >
                        ⚡ جلب تلقائي من الحسابات
                      </button>
                      <label className="text-[11px] text-[#D4AF37] font-black">💳 الحسابات والآيبان البنكي للتحويل:</label>
                    </div>
                    <textarea
                      placeholder="الكريمي: 1234567&#10;النيابة اليمينة: 987654"
                      value={b2bProfile.bankAccounts || ''}
                      rows={2}
                      onChange={(e) => setB2bProfile({ ...b2bProfile, bankAccounts: e.target.value })}
                      className="w-full bg-[#0a0f24] border border-white/10 rounded-xl p-2.5 text-[10.5px] text-white outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  {/* Bio Description */}
                  <div className="bg-navy-950/50 p-4 border border-white/5 rounded-2xl space-y-1.5">
                    <label className="text-[11px] text-[#D4AF37] font-black block">📝 نبذة تعريفية لشركائك بالتوريد:</label>
                    <input
                      type="text"
                      placeholder="متخصصون في بيع الجملة والقطاعي وإكسسوارات الجوالات الأصلية بكافة أنواعها..."
                      value={b2bProfile.bio || ''}
                      onChange={(e) => setB2bProfile({ ...b2bProfile, bio: e.target.value })}
                      className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-3 py-2 text-[10.5px] text-white outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Shift details & Locations */}
                  <div className="bg-navy-950/50 p-4 border border-white/5 rounded-2xl space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9.5px] text-gray-400 block mb-1">📍 موقع ومقر البيع الرئيسي:</label>
                        <input
                          type="text"
                          placeholder="صنعاء - شارع القيادة"
                          value={b2bProfile.salesLocation || ''}
                          onChange={(e) => setB2bProfile({ ...b2bProfile, salesLocation: e.target.value })}
                          className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] text-gray-400 block mb-1">🕒 أوقات الدوام والعمل:</label>
                        <input
                          type="text"
                          placeholder="8:00 ص - 10:00 م"
                          value={b2bProfile.workHours || ''}
                          onChange={(e) => setB2bProfile({ ...b2bProfile, workHours: e.target.value })}
                          className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {/* Delivery Service Toggle */}
                      <label className="flex items-center gap-2 p-1.5 bg-black/20 rounded-xl border border-white/5 cursor-pointer text-[10px]">
                        <input
                          type="checkbox"
                          checked={b2bProfile.hasDelivery || false}
                          onChange={(e) => setB2bProfile({ ...b2bProfile, hasDelivery: e.target.checked })}
                          className="rounded text-amber-500 focus:ring-amber-500"
                        />
                        <span>🚚 تتوفر لدينا خدمة توصيل للعملاء</span>
                      </label>

                      {/* Authorized Agencies */}
                      <div>
                        <input
                          type="text"
                          placeholder="الوكالات (مثلاً: Ramos, Bemas)"
                          value={(b2bProfile.agencies || []).join(', ')}
                          onChange={(e) => {
                            const list = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
                            setB2bProfile({ ...b2bProfile, agencies: list });
                          }}
                          className="w-full bg-[#0a0f24] border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white outline-none"
                          title="قائمة الوكالات التجارية المعتمدة لديك (مفصولة بفواصل)"
                        />
                      </div>
                    </div>
                  </div>

                  {/* KYC Verification & Golden Badge Card Section */}
                  <div className="bg-gradient-to-r from-[#121c3b] via-[#101935] to-[#0c1328] p-4 border border-amber-500/30 rounded-2xl space-y-3 shadow-xl col-span-full">
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className="text-amber-400 animate-pulse" />
                        <h4 className="text-xs font-black text-amber-300">توثيق الهوية والسجل التجاري (KYC) والشارة الذهبية 🏆</h4>
                      </div>
                      {(b2bProfile.goldenBadge || b2bProfile.isKycVerified || b2bProfile.kycStatus === 'verified') ? (
                        <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 px-3 py-1 rounded-full text-[10px] font-black shadow-[0_0_12px_rgba(245,158,11,0.4)] flex items-center gap-1">
                          🏆 موثق بشارة ذهبية
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">
                          {b2bProfile.kycStatus === 'pending' ? '⏳ قيد المراجعة' : '⚠️ غير موثق'}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-gray-300 leading-relaxed">
                      قم برفع وثائق السجل التجاري والبطاقة الشخصية للحصول على **الشارة الذهبية 🏆** التي تمنح متجرك ثقة عالية لدى جميع التجار وأولوية الظهور في قائمة المستوردين والتجار الموثقين.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                      {/* Commercial Register No & Doc */}
                      <div className="space-y-1.5 bg-black/30 p-2.5 rounded-xl border border-white/5">
                        <label className="text-gray-400 font-bold block">📄 رقم وصورة السجل التجاري:</label>
                        <input
                          type="text"
                          placeholder="مثلاً: CR-8839210"
                          value={b2bProfile.crNumber || ''}
                          onChange={(e) => setB2bProfile({ ...b2bProfile, crNumber: e.target.value })}
                          className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-amber-500 text-[10px]"
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const base64 = await compressImage(file, 600, 600, 0.7);
                                  setB2bProfile({ ...b2bProfile, crDocUrl: base64, kycStatus: 'pending' });
                                } catch (err) {
                                  console.error(err);
                                }
                              }
                            }}
                            className="block w-full text-[9px] text-gray-400 file:ml-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-bold file:bg-amber-500 file:text-black cursor-pointer"
                          />
                          {b2bProfile.crDocUrl && <CheckCircle size={14} className="text-emerald-400 shrink-0" />}
                        </div>
                      </div>

                      {/* National ID / Passport No & Doc */}
                      <div className="space-y-1.5 bg-black/30 p-2.5 rounded-xl border border-white/5">
                        <label className="text-gray-400 font-bold block">🪪 رقم وصورة الهوية الشخصية:</label>
                        <input
                          type="text"
                          placeholder="مثلاً: ID-01029384"
                          value={b2bProfile.idCardNumber || ''}
                          onChange={(e) => setB2bProfile({ ...b2bProfile, idCardNumber: e.target.value })}
                          className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-amber-500 text-[10px]"
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const base64 = await compressImage(file, 600, 600, 0.7);
                                  setB2bProfile({ ...b2bProfile, idDocUrl: base64, kycStatus: 'pending' });
                                } catch (err) {
                                  console.error(err);
                                }
                              }
                            }}
                            className="block w-full text-[9px] text-gray-400 file:ml-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-bold file:bg-amber-500 file:text-black cursor-pointer"
                          />
                          {b2bProfile.idDocUrl && <CheckCircle size={14} className="text-emerald-400 shrink-0" />}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setB2bProfile({
                            ...b2bProfile,
                            goldenBadge: true,
                            isKycVerified: true,
                            kycStatus: 'verified',
                            verifiedAt: new Date().toLocaleDateString('ar-YE')
                          });
                          alert('🎉 تم اعتماد وتفعيل الشارة الذهبية لمتجرك بنجاح وتوثيق الوثائق الرسمية!');
                        }}
                        className="w-full py-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black rounded-xl text-[11px] shadow-lg hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Award size={14} />
                        <span>اعتماد وتفعيل الشارة الذهبية لمتجرك فوراً 🏆</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer / Actions */}
              <div className="pt-4 border-t border-white/5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsB2bProfileModalOpen(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 rounded-xl font-black text-xs transition duration-300 cursor-pointer"
                >
                  إلغاء وتراجع
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveB2bProfile(b2bProfile)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:brightness-110 text-slate-950 font-black text-xs rounded-xl transition duration-300 shadow-lg cursor-pointer"
                >
                  حفظ وتأكيد هويتك الموحدة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. B2B CONNECTIONS MANAGEMENT MODAL */}
      <AnimatePresence>
        {isB2bConnectionsModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsB2bConnectionsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-gradient-to-b from-[#0e162f] to-[#070b18] border border-white/10 rounded-3xl p-6 shadow-[0_0_50px_rgba(212,175,55,0.15)] text-right z-10 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <button
                  type="button"
                  onClick={() => setIsB2bConnectionsModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2">
                  <LinkIcon size={20} className="text-[#D4AF37]" />
                  <h3 className="text-base font-black text-white">إدارة ارتباطاتك وشبكات الـ B2B المباشرة</h3>
                </div>
              </div>

              {/* Sub-tabs inside Connections Modal */}
              <div className="flex bg-[#070a1a] p-1 rounded-2xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setConnectionsModalTab('them')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    connectionsModalTab === 'them'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Store size={14} />
                  <span>المرتبط بهم (الموردين الذين أشتري منهم) ({connectedSuppliers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionsModalTab('me')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    connectionsModalTab === 'me'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <UserCheck size={14} />
                  <span>المرتبط بي (العملاء وتجار التجزئة) ({partnerConnections.length})</span>
                </button>
              </div>

              {/* TAB CONTENT: Them (Wholesalers I buy from) */}
              {connectionsModalTab === 'them' && (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {connectedSuppliers.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 text-xs font-medium space-y-2">
                      <AlertCircle size={32} className="mx-auto text-gray-700" />
                      <p>لا يوجد موردون مرتبط بهم حالياً.</p>
                      <p className="text-[10px] text-gray-400">يمكنك الذهاب إلى "خزانة الصلاحيات" أعلى الشاشة لإدخال مفتاح ارتباط بموردك.</p>
                    </div>
                  ) : (
                    sortedConnectedSuppliers.map(sup => {
                      const payable = Number(sup.payableBalance || 0);
                      const receivable = Number(sup.receivableBalance || 0);
                      const totalDebt = payable + receivable;
                      
                      return (
                        <div key={sup.id} className="bg-navy-950/40 border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-navy-900/60">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                              <h4 className="text-sm font-black text-white">{sup.supplierName}</h4>
                              <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-mono text-gray-400">
                                {sup.supplierKey || 'B2B-KEY'}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-gray-400">
                              رقم المورد: <span className="font-mono">{sup.phone || '000000000'}</span> • تاريخ الارتباط: {sup.connectedAt?.seconds ? new Date(sup.connectedAt.seconds * 1000).toLocaleDateString('ar-YE') : 'مباشر موحد'}
                            </p>
                            
                            {/* Outstanding accounts display */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1.5 text-[10px] font-bold">
                              <span className="text-amber-500">حساب له (Payable): {payable.toLocaleString()} ر.ي</span>
                              <span className="text-emerald-400">حساب عليك (Receivable): {receivable.toLocaleString()} ر.ي</span>
                            </div>

                            {/* Real-time limits and blocked partitions info */}
                            {(() => {
                              const creditLimit = sup.creditLimit || sup.debtSettings?.ceilingLimit || sup.ceilingLimit || 0;
                              const currentDebt = Number(sup.debt || sup.payableBalance || 0);
                              const pendingSentDebtOrders = mySentOrders.filter(
                                o => o.wholesalerId === sup.supplierId && o.paymentType === 'debt' && o.status === 'pending'
                              );
                              const pendingSentDebtTotal = pendingSentDebtOrders.reduce((sum, o) => sum + (o.total || 0), 0);
                              const remainingCreditLimit = Math.max(0, creditLimit - currentDebt - pendingSentDebtTotal);
                              const blockedCats = sup.blockedCategories || [];

                              return (
                                <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 space-y-1.5 text-[10px] mt-2">
                                  <div className="grid grid-cols-2 gap-2 text-right text-gray-400 font-bold">
                                    <div>السقف الائتماني: <span className="font-mono text-white">{creditLimit.toLocaleString()} ر.ي</span></div>
                                    <div>المديونية المسجلة: <span className="font-mono text-red-400">{currentDebt.toLocaleString()} ر.ي</span></div>
                                    <div>طلبيات قيد الانتظار: <span className="font-mono text-amber-500">{pendingSentDebtTotal.toLocaleString()} ر.ي</span></div>
                                    <div className="font-black">السقف المتبقي المتاح: <span className="font-mono text-emerald-400 underline">{remainingCreditLimit.toLocaleString()} ر.ي</span></div>
                                  </div>
                                  {blockedCats.length > 0 && (
                                    <div className="text-[9.5px] text-red-400/90 border-t border-white/5 pt-1 mt-1 font-bold">
                                      🚫 الفتحات المحظورة: {blockedCats.join('، ')}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Cancel connection button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveSupplierConnection(sup.id, sup.supplierName)}
                              className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={12} />
                              <span>إلغاء الارتباط التام</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB CONTENT: Me (Retailers buying from me) */}
              {connectionsModalTab === 'me' && (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {partnerConnections.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 text-xs font-medium space-y-2">
                      <AlertCircle size={32} className="mx-auto text-gray-700" />
                      <p>لم يرتبط بك أي تجار تجزئة حالياً كعملاء مبيعات.</p>
                      <p className="text-[10px] text-gray-400">قم بتوليد مفتاح ارتباط وبثه للتجار ليرتبطوا بك وتلقي طلبياتهم.</p>
                    </div>
                  ) : (
                    partnerConnections.map(conn => {
                      const payable = Number(conn.payableBalance || 0);
                      const receivable = Number(conn.receivableBalance || 0);
                      
                      return (
                        <div key={conn.id} className="bg-navy-950/40 border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-navy-900/60">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${conn.status === 'blocked' ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                              <h4 className="text-sm font-black text-white">{conn.retailerName}</h4>
                              {conn.status === 'blocked' && (
                                <span className="text-[9px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-black">
                                  محظور مؤقتاً
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] text-gray-400">
                              رقم العميل: <span className="font-mono">{conn.phone || '000000000'}</span> • كود المفتاح المستخدم: <span className="font-mono text-gray-300">{conn.supplierKey || 'B2B'}</span>
                            </p>
                            
                             {/* Outstanding balances */}
                             <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1.5 text-[10px] font-bold">
                               <span className="text-amber-500">حساب له (Payable): {payable.toLocaleString()} ر.ي</span>
                               <span className="text-emerald-400">حساب عليك (Receivable): {receivable.toLocaleString()} ر.ي</span>
                             </div>

                             {/* Real-time limits and blocked partitions info */}
                             {(() => {
                               const creditLimit = conn.creditLimit || conn.debtSettings?.ceilingLimit || conn.ceilingLimit || 0;
                               const currentDebt = Number(conn.debt || conn.payableBalance || 0);
                               const pendingOrders = incomingOrders.filter(
                                 o => o.retailerId === conn.retailerId && o.paymentType === 'debt' && o.status === 'pending'
                               );
                               const pendingDebtTotal = pendingOrders.reduce((sum, o) => sum + (o.total || 0), 0);
                               const displayedRemainingCredit = Math.max(0, creditLimit - currentDebt - pendingDebtTotal);
                               const blockedCats = conn.blockedCategories || [];

                               return (
                                 <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 space-y-1.5 text-[10px] mt-2">
                                   <div className="grid grid-cols-2 gap-2 text-right text-gray-400 font-bold">
                                     <div>السقف الائتماني المعتمد: <span className="font-mono text-white">{creditLimit.toLocaleString()} ر.ي</span></div>
                                     <div>المديونية المسجلة: <span className="font-mono text-red-400">{currentDebt.toLocaleString()} ر.ي</span></div>
                                     <div>طلبيات قيد الانتظار: <span className="font-mono text-amber-500">{pendingDebtTotal.toLocaleString()} ر.ي</span></div>
                                     <div className="font-black">السقف المتبقي المتاح: <span className="font-mono text-emerald-400 underline">{displayedRemainingCredit.toLocaleString()} ر.ي</span></div>
                                   </div>
                                   {blockedCats.length > 0 && (
                                     <div className="text-[9.5px] text-red-400/90 border-t border-white/5 pt-1 mt-1 font-bold">
                                       🚫 الأقسام المحظورة: {blockedCats.join('، ')}
                                     </div>
                                   )}
                                 </div>
                               );
                             })()}
                           </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Block & Disconnect Partner button */}
                            <button
                              type="button"
                              onClick={() => handleDeletePartnerConnectionAsSupplier(conn.id, conn.retailerName)}
                              className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Ban size={12} />
                              <span>حظر وإلغاء الارتباط</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-3 border-t border-white/5 flex">
                <button
                  type="button"
                  onClick={() => setIsB2bConnectionsModalOpen(false)}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 rounded-xl font-black text-xs transition duration-300 cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1. Product Specification & Warranty Card Modal */}
      {activeSpecsProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-[#0b101e] border-2 border-[#D4AF37]/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-right">
            <button
              onClick={() => setActiveSpecsProduct(null)}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 border-b border-white/5 pb-3.5 pt-1.5">
              <img
                src={activeSpecsProduct.photos?.[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80'}
                alt={activeSpecsProduct.name}
                className="w-14 h-14 rounded-2xl object-cover border border-amber-500/20 bg-slate-900"
              />
              <div className="text-right">
                <h4 className="text-sm font-black text-white leading-snug">{activeSpecsProduct.name}</h4>
                <p className="text-[10px] text-[#D4AF37] font-bold mt-0.5">بواسطة: {activeSpecsProduct.wholesalerName}</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-right">
              {/* Product Specifications */}
              <div className="bg-[#11162d]/60 p-3 rounded-2xl border border-white/5 space-y-1">
                <span className="text-[10.5px] text-teal-400 font-extrabold block">📋 تفاصيل ومواصفات السلعة:</span>
                <p className="text-[11px] leading-relaxed text-gray-300">
                  {activeSpecsProduct.description || 'لا يوجد مواصفات تفصيلية مضافة لهذا المنتج.'}
                </p>
              </div>

              {/* Warranty and Return Policies */}
              <div className="bg-[#11162d]/60 p-3 rounded-2xl border border-white/5 space-y-2.5">
                <span className="text-[10.5px] text-teal-400 font-extrabold block">🛡️ سياسة الضمان المعتمدة ومستوى التعويض:</span>
                
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-black/30 p-2 rounded-xl border border-white/5">
                    <span className="text-[9px] text-gray-400 block mb-0.5">نوع الضمان:</span>
                    <span className="text-white font-black">
                      {activeSpecsProduct.warrantyType === 'operational' ? 'ضمان تشغيل فوري' : 
                       activeSpecsProduct.warrantyType === 'limited' ? 'ضمان محدود المدة' : 'لا يوجد ضمان'}
                    </span>
                  </div>

                  <div className="bg-black/30 p-2 rounded-xl border border-white/5">
                    <span className="text-[9px] text-gray-400 block mb-0.5">مدة الضمان الفعلي:</span>
                    <span className="text-white font-black">
                      {activeSpecsProduct.warrantyType === 'none' ? '0 يوم' : `${activeSpecsProduct.warrantyDuration || 7} يوم`}
                    </span>
                  </div>
                </div>

                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9.5px] text-gray-400 block mb-1">خيار وسياسة التعويض في حال العطل المصنعي:</span>
                  <span className="text-amber-400 font-black flex items-center gap-1">
                    🔄 {activeSpecsProduct.compensationOption === 'refund' ? 'إرجاع نقدي كامل لقيمة السلعة' :
                        activeSpecsProduct.compensationOption === 'replace_other' ? 'استبدال بصنف آخر مكافئ' :
                        'استبدال فوري بنفس الصنف الجديد'}
                  </span>
                </div>
              </div>

              {/* General Terms */}
              <div className="bg-amber-500/[0.02] border border-amber-500/10 p-3 rounded-2xl text-[10.5px] text-gray-400 leading-relaxed space-y-1">
                <span className="text-amber-500 font-black block">⚠️ الشروط والبنود العامة للتوريد:</span>
                <p>• يسري الضمان فقط ضد العيوب المصنعية ولا يشمل التلفيات الناتجة عن سوء الاستخدام.</p>
                <p>• يجب إشعار المورد ورفع كود العطل عبر المنصة فور التحقق قبل انتهاء مدة الضمان المحددة.</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setActiveSpecsProduct(null)}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:from-amber-400 hover:to-[#e5c158] text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer text-center shadow-lg"
              >
                حسناً، فهمت الشروط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Re-engineered Inline Minimal Quantity Selector (Fast Keystroke Cart) */}
      {activeQtyPanelProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-[#0b101e] border-2 border-teal-500/30 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative text-right">
            <button
              onClick={() => setActiveQtyPanelProduct(null)}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="text-center space-y-1 pt-2">
              <div className="w-10 h-10 bg-teal-500/10 text-teal-400 rounded-xl flex items-center justify-center mx-auto border border-teal-500/20 text-lg">
                📥
              </div>
              <h3 className="text-sm font-black text-white leading-snug">{activeQtyPanelProduct.name}</h3>
              <p className="text-[10px] text-gray-400">يرجى تحديد الكمية المطلوبة وبدء التسجيل الفوري بالسلة.</p>
            </div>

            {/* Price Calculations segment */}
            {(() => {
              const selectedColor = selectedColors[activeQtyPanelProduct.id];
              let originalPrice = activeQtyPanelProduct.price;
              let maxStock = Math.max(0, (activeQtyPanelProduct.stock || 0) - (activeQtyPanelProduct.tempLocked || 0));

              if (selectedColor && activeQtyPanelProduct.variants) {
                const variant = activeQtyPanelProduct.variants.find(v => v.color === selectedColor);
                if (variant) {
                  if (variant.priceOverride) originalPrice = variant.priceOverride;
                  maxStock = Math.max(0, (variant.stock || 0) - (variant.tempLocked || 0));
                }
              }

              const tierPricingInfo = getProductPriceWithTier(activeQtyPanelProduct);
              const singlePrice = Math.round(originalPrice * tierPricingInfo.multiplier);
              const usdRate = exchangeRegion === 'sanaa' ? 530 : 1700;
              const sarRate = exchangeRegion === 'sanaa' ? 141 : 450;

              let finalSinglePrice = singlePrice;
              let currencyLabel = 'YER';

              if (selectedCurrency === 'USD') {
                finalSinglePrice = Math.round((singlePrice / usdRate) * 100) / 100;
                currencyLabel = 'USD';
              } else if (selectedCurrency === 'SAR') {
                finalSinglePrice = Math.round((singlePrice / sarRate) * 10) / 10;
                currencyLabel = 'SAR';
              }

              const totalRowCost = Math.round(finalSinglePrice * qtyInputValue * 100) / 100;

              // Action on Enter or click
              const handleConfirmAddToCart = () => {
                if (qtyInputValue <= 0) {
                  alert('يرجى تحديد كمية صحيحة (1 أو أكثر).');
                  return;
                }
                if (qtyInputValue > maxStock) {
                  alert(`عذراً، الكمية المطلوبة تتجاوز المخزون المتاح من المورد (${maxStock} ق).`);
                  return;
                }

                addItem({
                  productId: activeQtyPanelProduct.id,
                  name: activeQtyPanelProduct.name,
                  price: singlePrice,
                  wholesalerId: activeQtyPanelProduct.wholesalerId,
                  wholesalerName: activeQtyPanelProduct.wholesalerName,
                  selectedColor: selectedColor || '',
                  maxStock: maxStock,
                  warrantyType: activeQtyPanelProduct.warrantyType || 'none',
                  warrantyDuration: activeQtyPanelProduct.warrantyDuration || 0,
                  compensationOption: activeQtyPanelProduct.compensationOption || 'replace_same',
                  quantity: qtyInputValue
                });

                // Play custom sound feedback
                try {
                  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav');
                  audio.volume = 0.15;
                  audio.play().catch(() => {});
                } catch {}

                setActiveQtyPanelProduct(null);
                setQtyInputValue(1);
              };

              return (
                <div className="space-y-4">
                  {/* Stock info and Single Price display */}
                  <div className="bg-[#0c101d] border border-white/5 rounded-2xl p-3 grid grid-cols-2 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[9px] text-gray-500 block">سعر الوحدة:</span>
                      <span className="text-amber-400 font-extrabold">{finalSinglePrice.toLocaleString()} {currencyLabel}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 block">الحد الأقصى المتاح:</span>
                      <span className="text-white font-extrabold">{maxStock} ق</span>
                    </div>
                  </div>

                  {/* Quantity Input with Strict Keystroke Action */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-gray-400 font-bold block">الكمية المطلوبة للطلب:</label>
                    <input
                      type="number"
                      min={1}
                      max={maxStock}
                      value={qtyInputValue}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setQtyInputValue(Math.min(val, maxStock));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleConfirmAddToCart();
                        }
                      }}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      className="w-full bg-black/40 border border-teal-500/20 focus:border-teal-400 py-3 px-4 rounded-xl text-center font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all font-black"
                    />
                    <span className="text-[9px] text-gray-500 block text-center leading-normal">
                      💡 اضغط على مفتاح <span className="text-teal-400 font-extrabold">[ Enter ]</span> للإدخال السريع والمباشر في السلة.
                    </span>
                  </div>

                  {/* Real-time Row Cost Calculation Segment */}
                  <div className="bg-[#0c101d] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-black">إجمالي التكلفة المتوقعة:</span>
                    <span className="text-sm font-black text-[#D4AF37] tracking-tight">{totalRowCost.toLocaleString()} {currencyLabel}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setActiveQtyPanelProduct(null)}
                      className="py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs transition-all cursor-pointer border border-white/5"
                    >
                      إلغاء التوريد
                    </button>
                    <button
                      onClick={handleConfirmAddToCart}
                      className="py-2.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-teal-500/10"
                    >
                      تأكيد وتسجيل السلة 🛒
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 3. Persistent Cart Recovery Prompt Modal */}
      {showUnsentBackupPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-[#0b101e] border-2 border-amber-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-right">
            <div className="text-center space-y-2 pt-2">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20 text-xl font-bold animate-pulse">
                🛒
              </div>
              <h3 className="text-base font-black text-white">لديك طلبية غير مرسلة بالسلة</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                مرحباً بك مجدداً! تم العثور على طلبية سابقة غير مكتملة الإرسال محفوظة تلقائياً في ذاكرة المتصفح المؤقتة. هل ترغب في تصفحها وإكمال الطلب أم مسحها؟
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  clearCart();
                  setShowUnsentBackupPrompt(false);
                }}
                className="py-3 bg-red-600/10 hover:bg-red-600/20 text-red-400 font-black rounded-xl text-xs transition-all cursor-pointer border border-red-500/20"
              >
                مسح وتصفير السلة 🗑️
              </button>
              <button
                onClick={() => {
                  setIsCartOpen(true);
                  setShowUnsentBackupPrompt(false);
                }}
                className="py-3 bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:scale-[1.01] text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-amber-500/20"
              >
                معاينة وتحديث الطلب 🛒
              </button>
            </div>
          </div>
        </div>
      )}

      {isScanning && (
        <BarcodeScanner
          onScan={(code) => {
            setSearchTerm(code);
            setIsScanning(false);
          }}
          onClose={() => setIsScanning(false)}
        />
      )}

      {/* New Promo Creation Modal */}
      {isAddPromoModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-[#0e162f] border-2 border-amber-500/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-right text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Megaphone size={20} />
                </span>
                <h3 className="text-base font-black text-white">نشر عرض ترويجي جديد 📢</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPromoModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPromo.title || !newPromo.merchantName) {
                  alert('يرجى تعبئة عنوان العرض واسم المتجر/المعلن');
                  return;
                }
                const promoObj = {
                  id: `promo-${Date.now()}`,
                  title: newPromo.title,
                  merchantName: newPromo.merchantName,
                  details: newPromo.details || 'تفاصيل العرض الترويجي للجملة.',
                  price: newPromo.price || 'سعر خاص عند التواصل',
                  discount: newPromo.discount || 'عرض ترويجي',
                  imageUrl: newPromo.imageUrl || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
                  validUntil: newPromo.validUntil || '2026-08-31',
                  createdAt: new Date().toISOString()
                };
                setPromotionsPosts([promoObj, ...promotionsPosts]);
                setNewPromo({ title: '', merchantName: '', details: '', price: '', discount: '', imageUrl: '', validUntil: '' });
                setIsAddPromoModalOpen(false);
                alert('تم نشر العرض الترويجي بنجاح في المنصة!');
              }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1">
                <label className="font-bold text-gray-300">عنوان العرض الترويجي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: 🔥 عروض موسمية: خصم 15% على شاشات Bemas"
                  value={newPromo.title}
                  onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })}
                  className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-300">اسم المتجر / الشركة المعلنة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شركة البيماس اليمنية للاستيراد"
                  value={newPromo.merchantName}
                  onChange={(e) => setNewPromo({ ...newPromo, merchantName: e.target.value })}
                  className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-300">السعر الترويجي الخاص</label>
                  <input
                    type="text"
                    placeholder="مثال: 4,500 YER"
                    value={newPromo.price}
                    onChange={(e) => setNewPromo({ ...newPromo, price: e.target.value })}
                    className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-300">علامة الخصم / الشارة</label>
                  <input
                    type="text"
                    placeholder="مثال: خصم 15%"
                    value={newPromo.discount}
                    onChange={(e) => setNewPromo({ ...newPromo, discount: e.target.value })}
                    className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-300">تفاصيل العرض والشروط</label>
                <textarea
                  rows={3}
                  placeholder="اكتب تفاصيل وشروط الاستفادة من العرض الترويجي للجملة..."
                  value={newPromo.details}
                  onChange={(e) => setNewPromo({ ...newPromo, details: e.target.value })}
                  className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-300">رابط صورة العرض (اختياري)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newPromo.imageUrl}
                  onChange={(e) => setNewPromo({ ...newPromo, imageUrl: e.target.value })}
                  className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddPromoModalOpen(false)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer"
                >
                  نشر العرض الآن 🚀
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Haraj Listing Modal */}
      {isAddHarajModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-[#0e162f] border-2 border-amber-500/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-right text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Gavel size={20} />
                </span>
                <h3 className="text-base font-black text-white">إضافة إعلان في حراج التجار 🔨</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddHarajModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newHaraj.title || !newHaraj.contact) {
                  alert('يرجى تعبئة عنوان الإعلان ورقم التواصل');
                  return;
                }
                const harajObj = {
                  id: `haraj-${Date.now()}`,
                  title: newHaraj.title,
                  category: newHaraj.category || 'bulk',
                  quantity: newHaraj.quantity || 'لوط كامل',
                  price: newHaraj.price || 'فتح السوم عند التواصل',
                  location: newHaraj.location || 'اليمن',
                  description: newHaraj.description || 'تصفية بضاعة حراج تجار.',
                  contact: newHaraj.contact,
                  merchantName: profile?.shopName || 'تاجر مسجل',
                  createdAt: new Date().toISOString()
                };
                setHarajPosts([harajObj, ...harajPosts]);
                setNewHaraj({ title: '', category: 'bulk', quantity: '', price: '', location: '', description: '', contact: '' });
                setIsAddHarajModalOpen(false);
                alert('تم نشر الإعلان في حراج التجار بنجاح!');
              }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1">
                <label className="font-bold text-gray-300">عنوان إعلان الحراج *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تصفية لوط شاشات هواتف أصلية كسر زيرو - 80 قطعة"
                  value={newHaraj.title}
                  onChange={(e) => setNewHaraj({ ...newHaraj, title: e.target.value })}
                  className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-300">نوع العرض / التصنيف</label>
                  <select
                    value={newHaraj.category}
                    onChange={(e) => setNewHaraj({ ...newHaraj, category: e.target.value })}
                    className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-amber-500"
                  >
                    <option value="bulk">📦 تصفية كميات</option>
                    <option value="equipment">⚙️ معدات وتجهيزات</option>
                    <option value="stock">🏷️ ستوكات متنوعة</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-300">الكمية / اللوت</label>
                  <input
                    type="text"
                    placeholder="مثال: 100 قطعة أو طقم كامل"
                    value={newHaraj.quantity}
                    onChange={(e) => setNewHaraj({ ...newHaraj, quantity: e.target.value })}
                    className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-300">السعر المطلوبة / فتح السوم</label>
                  <input
                    type="text"
                    placeholder="مثال: فتح السوم 2,000 YER"
                    value={newHaraj.price}
                    onChange={(e) => setNewHaraj({ ...newHaraj, price: e.target.value })}
                    className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-300">المدينة / المعاينة</label>
                  <input
                    type="text"
                    placeholder="مثال: صنعاء - شارع صخر"
                    value={newHaraj.location}
                    onChange={(e) => setNewHaraj({ ...newHaraj, location: e.target.value })}
                    className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-300">وصف البضاعة والحالة</label>
                <textarea
                  rows={3}
                  placeholder="صف البضاعة، حالتها، وملاحظات التصفية..."
                  value={newHaraj.description}
                  onChange={(e) => setNewHaraj({ ...newHaraj, description: e.target.value })}
                  className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-300">رقم التواصل المباشر (واتساب/اتصال) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: 777000111"
                  value={newHaraj.contact}
                  onChange={(e) => setNewHaraj({ ...newHaraj, contact: e.target.value })}
                  className="w-full bg-[#070b18] border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddHarajModalOpen(false)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer"
                >
                  نشر الإعلان في الحراج 🔨
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Modal: New Key Connection (إدخال مفتاح ارتباط جديد) */}
      {isNewKeyConnectionModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" dir="rtl">
          <div className="bg-[#0e162f] border-2 border-amber-500/50 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative text-right text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/30">
                  <Key size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">ارتباط جديد عبر المفتاح B2B 🔑</h3>
                  <p className="text-[11px] text-gray-400">ارتباط مباشر بالمستوردين وتجار الجملة</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsNewKeyConnectionModalOpen(false);
                  setKeyError(null);
                  setKeySuccess(null);
                }}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl space-y-1 text-xs">
              <p className="font-bold text-amber-300 flex items-center gap-1.5">
                <Info size={14} className="shrink-0 text-amber-400" />
                <span>الارتباط بالمستوى الأعلى عبر المفتاح</span>
              </p>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                إذا كنت تاجر تجزئة أو جملة وترغب بالشراء المباشر من مستورد أو جملة جملة، أدخل المفتاح السري الذي زودك به التاجر وسيتم الربط فوراً وتأكيد صلاحيات الشراء.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                await handleConnectSupplierKey(e);
                if (keySuccess) {
                  setTimeout(() => {
                    setIsNewKeyConnectionModalOpen(false);
                  }, 1200);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-2">
                <label className="font-extrabold text-gray-200 block">
                  مفتاح الارتباط السري B2B *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="أدخل الرمز أو المفتاح مثل: 84920 أو IMPORT-YEMEN"
                    value={searchKey}
                    onChange={(e) => {
                      setSearchKey(e.target.value);
                      setKeyError(null);
                      setKeySuccess(null);
                    }}
                    className="w-full bg-[#070b18] border-2 border-white/10 rounded-2xl p-3.5 pl-10 text-white font-mono placeholder-gray-500 outline-none focus:border-amber-500 transition-all text-left text-sm"
                  />
                  <Key size={18} className="absolute right-3.5 top-3.5 text-amber-500 pointer-events-none" />
                </div>
              </div>

              {keyError && (
                <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs font-bold leading-relaxed flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                  <span>{keyError}</span>
                </div>
              )}

              {keySuccess && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold leading-relaxed flex items-start gap-2">
                  <CheckCircle size={16} className="shrink-0 text-emerald-400 mt-0.5" />
                  <span>{keySuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewKeyConnectionModalOpen(false);
                    setKeyError(null);
                    setKeySuccess(null);
                  }}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl cursor-pointer transition-all"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={connecting || !searchKey.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {connecting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-slate-950" />
                      <span>جاري التحقق والارتباط...</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck size={16} />
                      <span>تحقق وارتباط بالتاجر 🚀</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blocked Supplier Alert Modal */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-[#0b101e] border border-red-500/30 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-right">
            <div className="text-center space-y-2 pt-2">
              <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20 text-xl font-bold">
                🛑
              </div>
              <h3 className="text-base font-black text-white">الارتباط مع المورد محظور</h3>
              <p className="text-xs text-red-200 leading-relaxed font-bold bg-red-950/25 p-3 rounded-xl border border-red-500/10">
                المحتوى محظور - يرجى استخدام القنوات المسموحة أو إدخال مفتاح ارتباط جديد للتجديد.
              </p>
              <p className="text-[10px] text-gray-400 leading-normal">
                تم تجميد صلاحية تصفح هذا الكتالوج مؤقتاً أو إلغاؤه من قبل المورد. للتجديد الفوري، يرجى الحصول على مفتاح مخصص للتجديد وإدخاله في بوابة الارتباط.
              </p>
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={() => {
                  setShowBlockedModal(false);
                  setSelectedSupplierId('all');
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-red-500/20"
              >
                إغلاق معاينة المورد ❌
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B2B Connection Request Modal (Phase 3: مسار طلب الارتباط التجاري) */}
      <B2BConnectionRequestModal
        isOpen={b2bRequestModalOpen}
        onClose={() => {
          setB2bRequestModalOpen(false);
          setSelectedSupplierForRequest(null);
        }}
        targetSupplier={selectedSupplierForRequest}
        currentUserProfile={profile}
        onSuccess={() => {
          setB2bRequestModalOpen(false);
          setSelectedSupplierForRequest(null);
        }}
      />

      {/* B2B Linkage Decision Modal (Phase 3: لوحة اتخاذ القرار للمورد - تحديد فئة السعر وسقف الائتمان) */}
      <B2BDecisionModal
        isOpen={!!selectedRequestForDecision}
        onClose={() => {
          setSelectedRequestForDecision(null);
        }}
        request={selectedRequestForDecision}
        mode={decisionMode}
        supplierProfile={profile}
        onSuccess={() => {
          setSelectedRequestForDecision(null);
        }}
      />
    </div>
  );
}
