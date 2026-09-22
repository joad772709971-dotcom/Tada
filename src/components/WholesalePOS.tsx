import { useState, useEffect, useRef, useMemo } from 'react';
import { DevicePermissionsService } from '../services/DevicePermissionsService';
import { 
  Search, Package, ShoppingCart, Zap, Save, Trash2, Plus, Minus, 
  Barcode, Calculator, User, AlertCircle, CheckCircle2, Loader2,
  Maximize2, Minimize2, Settings, Truck, CreditCard, ChevronDown, ChevronUp, FileText, ShoppingBag,
  Camera, RotateCcw, ArrowLeft, ArrowRight, Tag, Building2, Image as ImageIcon, ImageOff, Filter, Check,
  PauseCircle, Play, Keyboard, Sparkles, Smartphone, Monitor, Wifi, WifiOff, RefreshCw, History
} from 'lucide-react';
import { 
  collection, query, where, getDocs, addDoc, serverTimestamp, 
  doc, updateDoc, increment, writeBatch, getDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, InventoryItem, Customer, Sale, Supplier, PaymentMatrixMethod, PaymentSplitDetails, OrderExecutionMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { idbService, CachedItem } from '../services/idbService';
import { unifiedOfflineStoreEngine } from '../services/UnifiedOfflineStoreEngine';
import { draftVaultService } from '../services/draftVaultService';
import { generateTransactionId } from '../lib/shopUtils';
import { postSaleToGL, postPurchaseToGL } from '../services/accountingService';
import JAMPayModal from './JAMPayModal';
import BarcodeScanner from './BarcodeScanner';
import CustomerSearchSelector from './CustomerSearchSelector';
import AdvancedPaymentMatrix from './AdvancedPaymentMatrix';
import WholesalePostSaleModal, { PostSaleInvoiceData } from './WholesalePostSaleModal';
import HeldBillsModal, { HeldBill } from './HeldBillsModal';
import { employeeDebtGuardService } from '../services/employeeDebtGuardService';
import { StoreQueueEngine } from '../services/StoreQueueEngine';
import { generateOpenBillUUID } from '../utils/uuid';
import { multiNetworkSyncEngine } from '../services/MultiNetworkSyncEngine';
import { UniversalReportButton } from './UniversalReportButton';
import { UniversalReportPayload } from '../services/UniversalReportService';
import { audioService } from '../services/audioService';
import { StrictPrecisionEngine } from '../services/StrictPrecisionEngine';
import { b2bLinkageEngine } from '../services/b2bLinkageEngine';

interface WholesalePOSProps {
  profile: UserProfile | null;
  initialMode?: 'sales' | 'purchases' | 'returns';
  onNavigateToWarehouse?: () => void;
}

export default function WholesalePOS({ profile, initialMode, onNavigateToWarehouse }: WholesalePOSProps) {
  // القوائم والبيانات الأساسية
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [localSearchResults, setLocalSearchResults] = useState<CachedItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [networkLinks, setNetworkLinks] = useState<any[]>([]);
  const [shopSettings, setShopSettings] = useState<any>(null);
  
  // وضعية العمل (مبيعات الجملة مقابل مشتريات الجملة)
  const [posMode, setPosMode] = useState<'sales' | 'purchases' | 'returns'>(initialMode || 'sales');
  
  // السلتين المنفصلتين
  const [salesCart, setSalesCart] = useState<any[]>([]);
  const [purchasesCart, setPurchasesCart] = useState<any[]>([]);
  const [returnsCart, setReturnsCart] = useState<any[]>([]);
  
  // لمرتجع الجملة الفرعي
  const [returnsSubMode, setReturnsSubMode] = useState<'sales_return' | 'purchase_return'>('sales_return');
  const [returnsPaymentMethod, setReturnsPaymentMethod] = useState<'cash' | 'credit'>('cash');
  
  // العملاء والموردين المحددين
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  
  // البحث والكتالوج والتحميل
  const [searchQuery, setSearchQuery] = useState('');
  const [showCatalog, setShowCatalog] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncingData, setIsSyncingData] = useState(false);
  
  // الخصومات وطرق الدفع المنفصلة
  const [discount, setDiscount] = useState(0);
  const [salesPaymentMethod, setSalesPaymentMethod] = useState<'cash' | 'credit' | 'money_transfer'>('cash');
  const [purchasesPaymentMethod, setPurchasesPaymentMethod] = useState<'cash' | 'credit' | 'money_transfer'>('cash');
  const [isScanning, setIsScanning] = useState(false);
  
  // خيارات البيع/الشراء الآجل (نقابة الذكاء المالي)
  const [salesCreditOption, setSalesCreditOption] = useState<'open' | 'installment'>('open');
  const [purchasesCreditOption, setPurchasesCreditOption] = useState<'open' | 'installment'>('open');
  const [installmentMonths, setInstallmentMonths] = useState<number>(3);
  
  // وسائل دفع خارجية متوافقة
  const isJAMPayOpenState = useRef(false);
  const [isJAMPayOpen, setIsJAMPayOpen] = useState(false);
  const [dispatchSuccessData, setDispatchSuccessData] = useState<{
    saleId: string;
    dispatchCode: string;
    customerName: string;
    items: any[];
    total: number;
    paymentMethod: string;
    createdAt: string;
  } | null>(null);

  // المحور الرابع: نافذة ما بعد البيع ومسار المستودع
  const [postSaleModalData, setPostSaleModalData] = useState<PostSaleInvoiceData | null>(null);
  const [isPostSaleModalOpen, setIsPostSaleModalOpen] = useState<boolean>(false);

  // نظام الفواتير المعلقة (Held Bills System)
  const [heldBills, setHeldBills] = useState<HeldBill[]>(() => {
    try {
      const raw = localStorage.getItem('jam_held_bills');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [isHeldBillsModalOpen, setIsHeldBillsModalOpen] = useState<boolean>(false);
  const [stockAlertToast, setStockAlertToast] = useState<string | null>(null);

  // المحور الأول: تبويبات كاشير الجملة الـ 3 (المنتجات، السلة، تفاصيل الفاتورة)
  const [activeWholesaleTab, setActiveWholesaleTab] = useState<'catalog' | 'cart' | 'checkout'>('catalog');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState<string>('all');
  const [demandStockFilter, setDemandStockFilter] = useState<'all' | 'high_demand' | 'low_demand' | 'high_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'price' | 'stock' | 'salesCount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showProductImages, setShowProductImages] = useState<boolean>(false);
  const [showAdvancedCheckout, setShowAdvancedCheckout] = useState(true);
  const [wholesaleCartWidth, setWholesaleCartWidth] = useState<'standard' | 'wide'>(() => {
    return (localStorage.getItem('jam_wholesale_cart_width') as any) || 'standard';
  });

  useEffect(() => {
    localStorage.setItem('jam_wholesale_cart_width', wholesaleCartWidth);
  }, [wholesaleCartWidth]);
  const searchRef = useRef<HTMLInputElement>(null);

  // 💾 نظام الحفظ التلقائي ومسودة الفاتورة الفورية (Auto-Draft Engine with DraftVault)
  useEffect(() => {
    const restoreDraft = async () => {
      const storeId = profile?.ownerId || 'default_store';
      const userId = profile?.uid || 'default_user';
      try {
        const savedDraft = await draftVaultService.getDraft(storeId, userId, 'pos_wholesale_active_cart');
        if (savedDraft) {
          if (Array.isArray(savedDraft.salesCart) && savedDraft.salesCart.length > 0 && salesCart.length === 0) {
            setSalesCart(savedDraft.salesCart);
          }
          if (savedDraft.selectedCustomer && !selectedCustomer) {
            setSelectedCustomer(savedDraft.selectedCustomer);
          }
          if (typeof savedDraft.discount === 'number' && discount === 0) {
            setDiscount(savedDraft.discount);
          }
        }
      } catch (e) {
        console.error('Error restoring auto-draft from vault', e);
      }
    };
    restoreDraft();
  }, [profile]);

  // حفظ المسودة الحالية لحظياً عند أي تعديل في سلة الجملة
  useEffect(() => {
    const storeId = profile?.ownerId || 'default_store';
    const userId = profile?.uid || 'default_user';
    if (posMode === 'sales') {
      if (salesCart.length > 0 || selectedCustomer || discount > 0) {
        draftVaultService.saveDraft(storeId, userId, 'pos_wholesale_active_cart', {
          salesCart,
          selectedCustomer,
          discount,
          updatedAt: Date.now()
        });
      } else {
        draftVaultService.clearDraft(storeId, userId, 'pos_wholesale_active_cart');
      }
    }
  }, [salesCart, selectedCustomer, discount, posMode, profile]);

  // دالة احتساب الرصيد المخزني الفعلي المتبقي للصنف بعد خصم ما في السلة
  const getAvailableStockPieces = (product: any, excludeCartId?: string): number => {
    const totalStock = Number(product?.stock) || 0;
    if (posMode !== 'sales') return totalStock;
    const piecesInSalesCart = salesCart.reduce((sum, item) => {
      if (item.id === product.id && item.cartId !== excludeCartId) {
        return sum + ((Number(item.quantity) || 1) * (Number(item.qtyInPieces) || 1));
      }
      return sum;
    }, 0);
    return Math.max(0, totalStock - piecesInSalesCart);
  };

  const triggerStockAlert = (msg: string) => {
    setStockAlertToast(msg);
    setTimeout(() => {
      setStockAlertToast(null);
    }, 5000);
  };

  // أنظمة حماية الموثوقية والأوفلاين والثروتلينغ اللامركزي
  const [flatOfflineAlert, setFlatOfflineAlert] = useState<string | null>(null);
  const lastClickTimeRef = useRef<{ [key: string]: number }>({});

  const throttleUI = (key: string, action: () => void) => {
    const now = Date.now();
    const last = lastClickTimeRef.current[key] || 0;
    if (now - last < 100) return; // تصفية النبضات المتتالية في غضون 100 ملي ثانية
    lastClickTimeRef.current[key] = now;
    action();
  };

  const showOfflineToast = () => {
    setFlatOfflineAlert('تم إرسال الفاتورة بأمان إلى سجل المزامنة اللامركزي (وضع الأوفلاين 30 يوماً).');
    setTimeout(() => {
      setFlatOfflineAlert(null);
    }, 6000);
  };

  const queueOfflineOperations = (ops: { operation: 'addDoc' | 'setDoc' | 'updateDoc'; path: string; data: any }[]) => {
    try {
      const queueStr = localStorage.getItem('jam_offline_write_queue') || '[]';
      const queue = JSON.parse(queueStr);
      const now = Date.now();
      ops.forEach(op => {
        const id = crypto.randomUUID();
        queue.push({
          id,
          operation: op.operation,
          path: op.path,
          data: op.data,
          timestamp: now
        });
      });
      localStorage.setItem('jam_offline_write_queue', JSON.stringify(queue));
      console.log('[Offline Support] Successfully queued', ops.length, 'operations offline');
    } catch (err) {
      console.error('Failed to save operations to offline write queue:', err);
    }
  };

  // مزامنة البحث المحلي الذكي
  useEffect(() => {
    if (searchQuery.length > 0) {
      idbService.searchItems(searchQuery).then(results => {
        setLocalSearchResults(results as any);
      });
    } else {
      setLocalSearchResults([]);
    }
  }, [searchQuery]);

  // مراقبة حالة الاتصال بالإنترنت والشبكة (Online/Offline Monitor)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (profile?.ownerId) {
        fetchData();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [profile?.ownerId]);

  // 🚀 الإنعاش والتحميل المحلي الفوري 0ms (Instant Offline-First Hydration)
  useEffect(() => {
    let isMounted = true;
    const hydrateFromLocalCache = async () => {
      try {
        const localProdsStr = localStorage.getItem('jam_offline_products');
        const localCustsStr = localStorage.getItem('jam_offline_customers');
        const localSuppsStr = localStorage.getItem('jam_offline_suppliers');
        const localSettingsStr = localStorage.getItem('jam_offline_settings');

        let hasLocalData = false;

        if (localProdsStr) {
          try {
            const parsed = JSON.parse(localProdsStr);
            if (Array.isArray(parsed) && parsed.length > 0 && isMounted) {
              setItems(parsed);
              hasLocalData = true;
            }
          } catch (e) {}
        }

        if (localCustsStr) {
          try {
            const parsed = JSON.parse(localCustsStr);
            if (Array.isArray(parsed) && parsed.length > 0 && isMounted) {
              setCustomers(parsed);
            }
          } catch (e) {}
        }

        if (localSuppsStr) {
          try {
            const parsed = JSON.parse(localSuppsStr);
            if (Array.isArray(parsed) && parsed.length > 0 && isMounted) {
              setSuppliers(parsed);
            }
          } catch (e) {}
        }

        if (localSettingsStr) {
          try {
            const parsed = JSON.parse(localSettingsStr);
            if (parsed && isMounted) {
              setShopSettings(parsed);
            }
          } catch (e) {}
        }

        // إذا كان الجهاز بدون إنترنت أو توفرت بيانات محلية، أوقف شاشة الانتظار فوراً وبدون أي تأخير
        if (hasLocalData || !navigator.onLine) {
          if (isMounted) setLoading(false);
        }

        // قراءة إضافية مساندة من IndexedDB إذا كانت الذاكرة المحلية فارغة
        if (!hasLocalData) {
          const idbItems = await idbService.searchItems('');
          if (Array.isArray(idbItems) && idbItems.length > 0 && isMounted) {
            setItems(idbItems as any);
            if (isMounted) setLoading(false);
          }
        }
      } catch (err) {
        console.warn('⚡ Local offline hydration notice:', err);
      } finally {
        // حماية قصوى: لا تبق الشاشة معلقة لأكثر من 1.5 ثانية مطلقاً
        setTimeout(() => {
          if (isMounted) setLoading(false);
        }, 1500);
      }
    };

    hydrateFromLocalCache();
    return () => {
      isMounted = false;
    };
  }, []);

  // تحميل قواعد بيانات الجملة مع حماية قاطعة ضد التعليق وبمهلة زمنية أقصاها 2.8 ثانية
  const fetchData = async () => {
    if (!profile?.ownerId) {
      setLoading(false);
      return;
    }

    // إذا كان الجهاز أوفلاين صراحة، لا تفتح اتصالات Firebase
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    setIsSyncingData(true);

    try {
      // مؤقت أمان زمني يمنع تجمد الشاشة عند ضعف أو انقطاع الإنترنت
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Cloud fetch timeout - fallback to offline cache')), 2800)
      );

      const fetchPromise = Promise.all([
        getDocs(query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId))),
        getDocs(query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId))),
        getDocs(query(collection(db, 'networkLinks'), where('wholesalerId', '==', profile.ownerId), where('status', '==', 'active'))),
        getDocs(query(collection(db, 'suppliers'), where('ownerId', '==', profile.ownerId))),
        getDoc(doc(db, 'settings', profile.ownerId))
      ]);

      const [invSnap, custSnap, linksSnap, suppSnap, settingsSnap] = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as any[];
      
      const userShopId = profile?.shopId || profile?.storeId;
      let inventoryData = invSnap.docs.map((d: any) => {
        const docData = { id: d.id, ...d.data() } as InventoryItem;
        if (profile?.role === 'sales' || profile?.role === 'customer') {
          delete docData.cost;
          delete docData.supplierId;
          // @ts-ignore
          delete docData.lastBuyPrice;
        }
        return docData;
      });

      if (profile?.role !== 'owner' && profile?.role !== 'superadmin' && userShopId) {
        inventoryData = inventoryData.filter((d: any) => d.shopId === userShopId || d.storeId === userShopId || d.store_id === userShopId);
      }

      setItems(inventoryData);

      let customersData = custSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Customer));
      if (profile?.role !== 'owner' && profile?.role !== 'superadmin' && userShopId) {
        customersData = customersData.filter((c: any) => c.shopId === userShopId || c.storeId === userShopId || c.store_id === userShopId);
      }
      setCustomers(customersData);

      setNetworkLinks(linksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })));

      let suppliersData = suppSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Supplier));
      if (profile?.role !== 'owner' && profile?.role !== 'superadmin' && userShopId) {
        suppliersData = suppliersData.filter((s: any) => s.shopId === userShopId || s.storeId === userShopId || s.store_id === userShopId);
      }
      setSuppliers(suppliersData);
      
      if (settingsSnap?.exists && settingsSnap.exists()) {
        const setts = settingsSnap.data();
        setShopSettings(setts);
        try {
          localStorage.setItem('jam_offline_settings', JSON.stringify(setts));
        } catch (e) {}
      }

      // 💾 حفظ فوري في الكاش المحلي و IndexedDB للأوفلاين
      try {
        localStorage.setItem('jam_offline_products', JSON.stringify(inventoryData));
        localStorage.setItem('jam_offline_customers', JSON.stringify(customersData));
        localStorage.setItem('jam_offline_suppliers', JSON.stringify(suppliersData));
        idbService.syncInventory(inventoryData as any).catch(() => {});
      } catch (storageErr) {
        console.warn('Offline cache storage quota notice:', storageErr);
      }

    } catch (e) {
      console.warn('⚡ تم استخدام النسخة المخزنة محلياً لكاشير الجملة (وضع أوفلاين/بطء اتصال):', e);
    } finally {
      setLoading(false);
      setIsSyncingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile?.ownerId]);

  // دمج شركاء الشبكة والعملاء
  const allPartners = [
    ...customers.map(c => ({ ...c, source: 'manual' })),
    ...networkLinks.map(l => ({ 
      id: l.retailerId, 
      name: l.retailerName, 
      linkId: l.id, 
      source: 'network',
      creditLimit: l.creditLimit,
      balance: l.balance,
      type: l.type
    }))
  ].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

  // السلة الحالية والخصومات بحسب الوضعية المحددة للـ POS
  const activeCart = posMode === 'sales' ? salesCart : (posMode === 'purchases' ? purchasesCart : returnsCart);
  const activePaymentMethod = posMode === 'sales' ? salesPaymentMethod : (posMode === 'purchases' ? purchasesPaymentMethod : returnsPaymentMethod);
  const activeCreditOption = posMode === 'sales' ? salesCreditOption : (posMode === 'purchases' ? purchasesCreditOption : 'open');

  // المجموع الإجمالي المحسوب بدقة الفلس الصارمة (Strict Financial Precision)
  const subtotal = useMemo(() => {
    return activeCart.reduce((acc, item) => {
      const price = Number(posMode === 'sales' ? item.price : (posMode === 'purchases' ? item.buyPrice : item.price)) || 0;
      const qty = StrictPrecisionEngine.parseFractionOrDecimal(item.quantity || item.qty || (item as any).count || 1);
      const lineTotal = StrictPrecisionEngine.financialRound(price * qty, 2);
      return StrictPrecisionEngine.safeAdd(acc, lineTotal, 2);
    }, 0);
  }, [activeCart, posMode]);

  const finalTotal = useMemo(() => {
    const effectiveDiscount = (posMode === 'sales' || (posMode === 'returns' && returnsSubMode === 'sales_return')) 
      ? StrictPrecisionEngine.financialRound(discount, 2) 
      : 0;
    const total = StrictPrecisionEngine.safeSub(subtotal, effectiveDiscount, 2);
    return Math.max(0, total);
  }, [subtotal, discount, posMode, returnsSubMode]);

  const selectedLink = posMode === 'sales'
    ? networkLinks.find(l => l.retailerId === (selectedCustomer as any)?.id)
    : networkLinks.find(l => l.wholesalerId === selectedSupplier?.id);

  const isCreditBlocked = selectedLink?.deferredLocked === true || selectedLink?.debtWarning === true;

  // Reset credit payment if blocked
  useEffect(() => {
    if (isCreditBlocked) {
      if (posMode === 'sales' && salesPaymentMethod === 'credit') {
        setSalesPaymentMethod('cash');
      } else if (posMode === 'purchases' && purchasesPaymentMethod === 'credit') {
        setPurchasesPaymentMethod('cash');
      }
    }
  }, [isCreditBlocked, posMode, salesPaymentMethod, purchasesPaymentMethod]);

  // استخراج التصنيفات والوكالات
  const categories = useMemo(() => {
    return Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[];
  }, [items]);

  const agencies = useMemo(() => {
    return Array.from(new Set(items.map(i => (i as any).agency || (i as any).agencyName || (i as any).brand).filter(Boolean))) as string[];
  }, [items]);

  // المنتجات المفلترة حسب البحث والتصنيف والوكالة وحركة الطلب والترتيب
  const filteredWholesaleItems = useMemo(() => {
    let filtered = items.filter(item => {
      const nameLower = (item?.name || '').toLowerCase();
      const barcode = (item?.barcode || '').toLowerCase();
      const queryLower = (searchQuery || '').toLowerCase();
      const matchesSearch = !searchQuery || nameLower.includes(queryLower) || barcode.includes(queryLower);
      const matchesCategory = selectedCategoryFilter === 'all' || item.category === selectedCategoryFilter;
      const itemAgency = (item as any).agency || (item as any).agencyName || (item as any).brand;
      const matchesAgency = selectedAgencyFilter === 'all' || itemAgency === selectedAgencyFilter;

      let matchesDemandStock = true;
      const stock = Number(item.stock) || 0;
      const minStock = Number(item.minStock) || 5;
      const salesCount = Number((item as any).salesCount) || Number((item as any).soldCount) || 0;

      if (demandStockFilter === 'high_demand') {
        matchesDemandStock = salesCount >= 5;
      } else if (demandStockFilter === 'low_demand') {
        matchesDemandStock = salesCount < 5;
      } else if (demandStockFilter === 'high_stock') {
        matchesDemandStock = stock > minStock * 2;
      } else if (demandStockFilter === 'low_stock') {
        matchesDemandStock = stock > 0 && stock <= minStock;
      } else if (demandStockFilter === 'out_of_stock') {
        matchesDemandStock = stock <= 0;
      }

      return matchesSearch && matchesCategory && matchesAgency && matchesDemandStock;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '', 'ar');
      } else if (sortBy === 'price') {
        const priceA = Number(a.wholesalePrice || a.price) || 0;
        const priceB = Number(b.wholesalePrice || b.price) || 0;
        comparison = priceA - priceB;
      } else if (sortBy === 'stock') {
        const stockA = Number(a.stock) || 0;
        const stockB = Number(b.stock) || 0;
        comparison = stockA - stockB;
      } else if (sortBy === 'salesCount') {
        const countA = Number((a as any).salesCount) || 0;
        const countB = Number((b as any).salesCount) || 0;
        comparison = countA - countB;
      } else if (sortBy === 'createdAt') {
        const timeA = a.createdAt ? new Date((a as any).createdAt?.seconds ? (a as any).createdAt.seconds * 1000 : a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date((b as any).createdAt?.seconds ? (b as any).createdAt.seconds * 1000 : b.createdAt).getTime() : 0;
        comparison = timeA - timeB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [items, searchQuery, selectedCategoryFilter, selectedAgencyFilter, demandStockFilter, sortBy, sortOrder]);

  // المحور الثالث: معالج مسح الباركود الفوري لأجهزة قراءة الباركود والماسحات اليدوية
  const handleBarcodeScan = (rawCode: string, unitType: 'piece' | 'dozen' | 'carton' = 'piece') => {
    const code = (rawCode || '').trim();
    if (!code) return;

    // البحث عن الصنف بمطابقة الباركود الدقيق أو المعرف أو الكود
    const matched = items.find(i => 
      (i.barcode && i.barcode.trim().toLowerCase() === code.toLowerCase()) || 
      i.id === code ||
      ((i as any).sku && (i as any).sku.trim().toLowerCase() === code.toLowerCase()) ||
      ((i as any).code && (i as any).code.toString().trim() === code)
    );

    if (matched) {
      // فحص توفر المخزون في وضع المبيعات
      if (posMode === 'sales') {
        const available = getAvailableStockPieces(matched);
        const piecesNeeded = unitType === 'carton' ? 24 : unitType === 'dozen' ? 12 : 1;
        if (available < piecesNeeded || (matched.stock || 0) <= 0) {
          audioService.playError();
          triggerStockAlert(`⛔ نفد المخزون: الصنف [${matched.name}] لا يتوفر منه كمية كافية بالمخزن (${available} حبة)!`);
          return;
        }
      }

      addToCart(matched, unitType);
      audioService.playSuccess();
      triggerStockAlert(`⚡ تم قراءة الباركود وإضافة: [${matched.name}] (${unitType === 'carton' ? 'كرتون' : unitType === 'dozen' ? 'درزن' : 'حبة'})`);
    } else {
      audioService.playError();
      triggerStockAlert(`⚠️ لم يتم العثور على أي صنف بالباركود: [${code}]`);
    }
  };

  // المحور الثالث: ماسح الباركود السلكي واللاسلكي الخارجي (Hardware Barcode Scanner Listener)
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTimestamp = 0;

    const handleHardwareScan = (e: KeyboardEvent) => {
      // تجاهل مفاتيح النظام ومفاتيح الوظائف F1-F12
      if (e.key.startsWith('F') && e.key.length <= 3) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const interval = now - lastKeyTimestamp;
      lastKeyTimestamp = now;

      // أجهزة قارئ الباركود ترسل الأحرف بسرعة فائقة (أقل من 75 ميلي ثانية بين كل حرف)
      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3 && interval < 120) {
          e.preventDefault();
          const scanned = barcodeBuffer.trim();
          barcodeBuffer = '';
          handleBarcodeScan(scanned);
          if (searchRef.current) {
            setSearchQuery('');
          }
        } else {
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        if (interval > 150) {
          barcodeBuffer = e.key;
        } else {
          barcodeBuffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleHardwareScan);
    return () => window.removeEventListener('keydown', handleHardwareScan);
  }, [items, posMode, salesCart, purchasesCart, returnsCart]);

  // اختصارات لوحة المفاتيح الاحترافية للمحاور الثلاثة ونظام الفواتير المعلقة
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'F1') { 
        e.preventDefault(); 
        setActiveWholesaleTab('catalog');
        searchRef.current?.focus(); 
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveWholesaleTab('cart');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveWholesaleTab('checkout');
      } else if (e.key === 'F4' || (e.ctrlKey && e.key === 'Enter') || e.key === 'F12') { 
        e.preventDefault(); 
        if (posMode === 'sales') {
          handleSaveSale();
        } else if (posMode === 'purchases') {
          handleSavePurchase();
        } else {
          handleSaveReturn();
        }
      } else if (e.key === 'F9' || (e.ctrlKey && e.key.toLowerCase() === 'h')) {
        e.preventDefault();
        setIsHeldBillsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [salesCart, purchasesCart, returnsCart, selectedCustomer, selectedSupplier, discount, salesPaymentMethod, purchasesPaymentMethod, returnsPaymentMethod, returnsSubMode, posMode]);

  // إدارة الفواتير المعلقة (Held Bills Handlers)
  const handleSaveCurrentAsHeld = async (customTag?: string) => {
    const currentItems = posMode === 'sales' ? salesCart : posMode === 'purchases' ? purchasesCart : returnsCart;
    if (currentItems.length === 0) {
      triggerStockAlert('⚠️ لا توجد سلع في السلة الحالية لتعليقها!');
      return;
    }

    const defaultTag = selectedCustomer 
      ? `فاتورة: ${selectedCustomer.name}` 
      : `فاتورة ${posMode === 'sales' ? 'مبيعات' : posMode === 'purchases' ? 'مشتريات' : 'مرتجع'} - ${new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}`;

    const heldId = generateOpenBillUUID();
    const storeId = profile?.ownerId || 'master_shop';

    const newHeld: HeldBill = {
      id: heldId,
      tag: customTag || defaultTag,
      customer: selectedCustomer,
      customerName: selectedCustomer?.name,
      items: [...currentItems],
      posMode,
      returnsSubMode,
      discount,
      subtotal,
      finalTotal,
      currency: 'YER',
      heldAt: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: Date.now()
    };

    const updated = [newHeld, ...heldBills];
    setHeldBills(updated);
    localStorage.setItem('jam_held_bills', JSON.stringify(updated));

    // Share across Local LAN Network with other cashiers
    multiNetworkSyncEngine.holdSharedOpenBill(storeId, {
      id: heldId,
      cashierId: profile?.id || 'cashier_01',
      cashierName: profile?.name || 'كاشير المحل',
      tableOrRef: customTag || defaultTag,
      items: currentItems.map(i => ({
        productId: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        barcode: i.barcode
      })),
      subtotal,
      total: finalTotal,
      customerName: selectedCustomer?.name,
      customerPhone: selectedCustomer?.phone,
      notes: customTag
    }).catch(console.error);

    // تفريغ السلة الحالية بعد التعليق
    if (posMode === 'sales') setSalesCart([]);
    else if (posMode === 'purchases') setPurchasesCart([]);
    else setReturnsCart([]);

    setSelectedCustomer(null);
    setSelectedSupplier(null);
    setDiscount(0);
    setIsHeldBillsModalOpen(false);
    triggerStockAlert(`✅ تم تعليق الفاتورة بنجاح باسم [${newHeld.tag}] ومشاركتها في الشبكة.`);
  };

  const handleRestoreHeldBill = (bill: HeldBill) => {
    setPosMode(bill.posMode);
    if (bill.returnsSubMode) setReturnsSubMode(bill.returnsSubMode);

    if (bill.posMode === 'sales') {
      setSalesCart(bill.items);
    } else if (bill.posMode === 'purchases') {
      setPurchasesCart(bill.items);
    } else {
      setReturnsCart(bill.items);
    }

    setSelectedCustomer(bill.customer || null);
    setDiscount(bill.discount || 0);

    const updated = heldBills.filter(b => b.id !== bill.id);
    setHeldBills(updated);
    localStorage.setItem('jam_held_bills', JSON.stringify(updated));
    setIsHeldBillsModalOpen(false);
    setActiveWholesaleTab('cart');
    triggerStockAlert(`⚡ تم استعادة الفاتورة المعلقة بنجاح!`);
  };

  const handleDeleteHeldBill = (id: string) => {
    const updated = heldBills.filter(b => b.id !== id);
    setHeldBills(updated);
    localStorage.setItem('jam_held_bills', JSON.stringify(updated));
  };

  const handleClearAllHeld = () => {
    if (window.confirm('هل أنت متأكد من حذف جميع الفواتير المعلقة نهائياً؟')) {
      setHeldBills([]);
      localStorage.removeItem('jam_held_bills');
    }
  };

  // إضافة منتج إلى السلة المناسبة مع التحقق الصارم من المخزون
  const addToCart = (product: any, unitType: 'piece' | 'dozen' | 'carton' = 'piece') => {
    try {
      if (!product || !product.id) {
        console.warn('⚡ WholesalePOS: Attempted to add invalid product to cart', product);
        return;
      }

      const cartId = `${product.id}-${unitType}`;
      
      if (posMode === 'sales') {
        const basePrice = product.wholesalePrice || product.wholesale_price || product.price || (product as any).price || 0;
        let price = basePrice;
        let qtyInPieces = 1;
        
        if (unitType === 'dozen') {
          const dozenUnit = Array.isArray(product.units) ? product.units.find((u: any) => u && (u.name?.includes('درزن') || u.factor === 12)) : null;
          price = dozenUnit?.price || (basePrice * 11);
          qtyInPieces = dozenUnit?.factor || 12;
        } else if (unitType === 'carton') {
          const cartonUnit = Array.isArray(product.units) ? product.units.find((u: any) => u && (u.name?.includes('كرتون') || u.factor >= 24)) : null;
          const safeCost = product.cost || product.buy_price || (product as any).purchase_price || 0;
          price = cartonUnit?.price || (safeCost * 1.05);
          qtyInPieces = cartonUnit?.factor || 24;
        }

        // 🛑 التحقق الصارم من المخزون ومنع الإضافة عند نفاذ الكمية
        const availablePieces = getAvailableStockPieces(product);
        if (availablePieces < qtyInPieces || (product.stock || 0) <= 0) {
          triggerStockAlert(`⛔ منع إضافة الصنف [${product.name}]: الرصيد المتوفر بالمخزن (${availablePieces} حبة) غير كافٍ للكمية المطلوبة (${qtyInPieces} حبة)!`);
          return;
        }

        const existingIdx = salesCart.findIndex(c => c.cartId === cartId);
        if (existingIdx > -1) {
          if (availablePieces < qtyInPieces) {
            triggerStockAlert(`⛔ لا يمكن زيادة الكمية: تم الوصول للحد الأقصى المتوفر بالمخزن (${product.stock} حبة)!`);
            return;
          }
          const updated = [...salesCart];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: (Number(updated[existingIdx].quantity) || Number(updated[existingIdx].qty) || 1) + 1
          };
          setSalesCart(updated);
        } else {
          setSalesCart([...salesCart, { 
            cartId, 
            id: product.id, 
            name: product.name || product.productName || 'غير معروف', 
            productName: product.productName || product.name || '',
            details: product.details || product.description || '',
            price: price || 0, 
            quantity: 1, 
            unitType, 
            qtyInPieces,
            originalProduct: product 
          }]);
        }
      } else if (posMode === 'purchases') {
        const baseCost = product.cost || product.buy_price || (product as any).purchase_price || 0;
        let buyPrice = baseCost;
        let qtyInPieces = 1;
        
        if (unitType === 'dozen') {
          const dozenUnit = Array.isArray(product.units) ? product.units.find((u: any) => u && (u.name?.includes('درزن') || u.factor === 12)) : null;
          qtyInPieces = dozenUnit?.factor || 12;
          buyPrice = dozenUnit?.price || (baseCost * qtyInPieces);
        } else if (unitType === 'carton') {
          const cartonUnit = Array.isArray(product.units) ? product.units.find((u: any) => u && (u.name?.includes('كرتون') || u.factor >= 24)) : null;
          qtyInPieces = cartonUnit?.factor || 24;
          buyPrice = cartonUnit?.price || (baseCost * qtyInPieces);
        }

        const existingIdx = purchasesCart.findIndex(c => c.cartId === cartId);
        if (existingIdx > -1) {
          const updated = [...purchasesCart];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: (Number(updated[existingIdx].quantity) || Number(updated[existingIdx].qty) || 1) + 1
          };
          setPurchasesCart(updated);
        } else {
          setPurchasesCart([...purchasesCart, { 
            cartId, 
            id: product.id, 
            name: product.name || product.productName || 'غير معروف', 
            productName: product.productName || product.name || '',
            details: product.details || product.description || '',
            buyPrice: buyPrice || 0, 
            quantity: 1, 
            unitType, 
            qtyInPieces,
            originalProduct: product 
          }]);
        }
      } else {
        const defaultSalesPrice = product.wholesalePrice || product.wholesale_price || product.price || 0;
        const defaultCostPrice = product.cost || product.buy_price || (product as any).purchase_price || 0;
        const basePrice = returnsSubMode === 'sales_return' ? defaultSalesPrice : defaultCostPrice;
        let price = basePrice;
        let qtyInPieces = 1;

        if (unitType === 'dozen') {
          const dozenUnit = Array.isArray(product.units) ? product.units.find((u: any) => u && (u.name?.includes('درزن') || u.factor === 12)) : null;
          qtyInPieces = dozenUnit?.factor || 12;
          price = dozenUnit?.price || (returnsSubMode === 'sales_return' ? defaultSalesPrice * 11 : defaultCostPrice * 12);
        } else if (unitType === 'carton') {
          const cartonUnit = Array.isArray(product.units) ? product.units.find((u: any) => u && (u.name?.includes('كرتون') || u.factor >= 24)) : null;
          qtyInPieces = cartonUnit?.factor || 24;
          price = cartonUnit?.price || (returnsSubMode === 'sales_return' ? defaultSalesPrice * 22 : defaultCostPrice * 24);
        }

        const existingIdx = returnsCart.findIndex(c => c.cartId === cartId);
        if (existingIdx > -1) {
          const updated = [...returnsCart];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: (Number(updated[existingIdx].quantity) || Number(updated[existingIdx].qty) || 1) + 1
          };
          setReturnsCart(updated);
        } else {
          setReturnsCart([...returnsCart, {
            cartId,
            id: product.id,
            name: product.name || product.productName || 'غير معروف',
            productName: product.productName || product.name || '',
            details: product.details || product.description || '',
            price: price || 0,
            quantity: 1,
            unitType,
            qtyInPieces,
            originalProduct: product
          }]);
        }
      }
    } catch (error) {
      console.error('❌ Error during addToCart execution:', error);
    }
  };

  // إزالة منتج من السلة المناسبة
  const removeFromCart = (cartId: string) => {
    if (posMode === 'sales') {
      setSalesCart(salesCart.filter(c => c.cartId !== cartId));
    } else if (posMode === 'purchases') {
      setPurchasesCart(purchasesCart.filter(c => c.cartId !== cartId));
    } else {
      setReturnsCart(returnsCart.filter(c => c.cartId !== cartId));
    }
  };

  // تعديل كمية العناصر في السلة مع تدقيق المخزون
  const updateQuantity = (cartId: string, delta: number) => {
    try {
      if (posMode === 'sales') {
        if (delta > 0) {
          const targetItem = salesCart.find(c => c.cartId === cartId);
          if (targetItem) {
            const product = items.find(i => i.id === targetItem.id) || targetItem.originalProduct;
            if (product) {
              const availablePieces = getAvailableStockPieces(product, cartId);
              const additionalPiecesNeeded = delta * (Number(targetItem.qtyInPieces) || 1);
              if (availablePieces < additionalPiecesNeeded) {
                triggerStockAlert(`⛔ لا يمكن زيادة الكمية: تم استهلاك كامل المخزون المتوفر (${product.stock || 0} حبة)!`);
                return;
              }
            }
          }
        }
        setSalesCart(salesCart.map(c => {
          if (c.cartId === cartId) {
            const currentQty = Number(c.quantity) || Number(c.qty) || 1;
            const newQty = Math.max(0.1, currentQty + delta);
            return { ...c, quantity: newQty };
          }
          return c;
        }).filter(c => (Number(c.quantity) || 0) > 0));
      } else if (posMode === 'purchases') {
        setPurchasesCart(purchasesCart.map(c => {
          if (c.cartId === cartId) {
            const currentQty = Number(c.quantity) || Number(c.qty) || 1;
            const newQty = Math.max(0.1, currentQty + delta);
            return { ...c, quantity: newQty };
          }
          return c;
        }).filter(c => (Number(c.quantity) || 0) > 0));
      } else {
        setReturnsCart(returnsCart.map(c => {
          if (c.cartId === cartId) {
            const currentQty = Number(c.quantity) || Number(c.qty) || 1;
            const newQty = Math.max(0.1, currentQty + delta);
            return { ...c, quantity: newQty };
          }
          return c;
        }).filter(c => (Number(c.quantity) || 0) > 0));
      }
    } catch (error) {
      console.error('❌ Error during updateQuantity execution:', error);
    }
  };

  // المحور الثالث: تبديل وحدة الصنف مباشرة داخل السلة (حبة / درزن / كرتون) مع إعادة احتساب الأسعار وتدقيق المخزون
  const handleSwitchCartUnit = (cartId: string, targetUnit: 'piece' | 'dozen' | 'carton') => {
    try {
      if (posMode === 'sales') {
        const itemIdx = salesCart.findIndex(c => c.cartId === cartId);
        if (itemIdx === -1) return;
        const currentItem = salesCart[itemIdx];
        if (currentItem.unitType === targetUnit) return;

        const product = items.find(i => i.id === currentItem.id) || currentItem.originalProduct;
        if (!product) return;

        const basePrice = product.wholesalePrice || product.wholesale_price || product.price || 0;
        let newPrice = basePrice;
        let newQtyInPieces = 1;

        if (targetUnit === 'dozen') {
          const dozenUnit = Array.isArray(product.units) ? product.units.find((u: any) => u && (u.name?.includes('درزن') || u.factor === 12)) : null;
          newPrice = dozenUnit?.price || (basePrice * 11);
          newQtyInPieces = dozenUnit?.factor || 12;
        } else if (targetUnit === 'carton') {
          const cartonUnit = Array.isArray(product.units) ? product.units.find((u: any) => u && (u.name?.includes('كرتون') || u.factor >= 24)) : null;
          const safeCost = product.cost || product.buy_price || (product as any).purchase_price || 0;
          newPrice = cartonUnit?.price || (safeCost * 1.05);
          newQtyInPieces = cartonUnit?.factor || 24;
        }

        const totalPiecesNeeded = (Number(currentItem.quantity) || 1) * newQtyInPieces;
        const availablePieces = getAvailableStockPieces(product, cartId);

        if (availablePieces < totalPiecesNeeded) {
          audioService.playError();
          triggerStockAlert(`⛔ لا يمكن التحويل لوحدة (${targetUnit === 'carton' ? 'كرتون' : 'درزن'}): الكمية المتوفرة بالمخزن (${availablePieces} حبة) غير كافية!`);
          return;
        }

        const newCartId = `${currentItem.id}-${targetUnit}`;
        const updated = [...salesCart];
        updated[itemIdx] = {
          ...currentItem,
          cartId: newCartId,
          unitType: targetUnit,
          price: newPrice,
          qtyInPieces: newQtyInPieces
        };
        setSalesCart(updated);
        audioService.playSuccess();
        triggerStockAlert(`⚡ تم تحويل وحدة [${currentItem.name}] إلى (${targetUnit === 'carton' ? 'كرتون' : targetUnit === 'dozen' ? 'درزن' : 'حبة'})`);
      } else if (posMode === 'purchases') {
        const itemIdx = purchasesCart.findIndex(c => c.cartId === cartId);
        if (itemIdx === -1) return;
        const currentItem = purchasesCart[itemIdx];
        if (currentItem.unitType === targetUnit) return;

        const product = items.find(i => i.id === currentItem.id) || currentItem.originalProduct;
        if (!product) return;

        const baseCost = product.cost || product.buy_price || (product as any).purchase_price || 0;
        let newBuyPrice = baseCost;
        let newQtyInPieces = 1;

        if (targetUnit === 'dozen') {
          const dozenUnit = Array.isArray(product.units) ? product.units.find((u: any) => u && (u.name?.includes('درزن') || u.factor === 12)) : null;
          newQtyInPieces = dozenUnit?.factor || 12;
          newBuyPrice = dozenUnit?.price || (baseCost * newQtyInPieces);
        } else if (targetUnit === 'carton') {
          const cartonUnit = Array.isArray(product.units) ? product.units.find((u: any) => u && (u.name?.includes('كرتون') || u.factor >= 24)) : null;
          newQtyInPieces = cartonUnit?.factor || 24;
          newBuyPrice = cartonUnit?.price || (baseCost * newQtyInPieces);
        }

        const newCartId = `${currentItem.id}-${targetUnit}`;
        const updated = [...purchasesCart];
        updated[itemIdx] = {
          ...currentItem,
          cartId: newCartId,
          unitType: targetUnit,
          buyPrice: newBuyPrice,
          qtyInPieces: newQtyInPieces
        };
        setPurchasesCart(updated);
        audioService.playSuccess();
      } else {
        const itemIdx = returnsCart.findIndex(c => c.cartId === cartId);
        if (itemIdx === -1) return;
        const currentItem = returnsCart[itemIdx];
        if (currentItem.unitType === targetUnit) return;

        const product = items.find(i => i.id === currentItem.id) || currentItem.originalProduct;
        if (!product) return;

        const defaultSalesPrice = product.wholesalePrice || product.wholesale_price || product.price || 0;
        const defaultCostPrice = product.cost || product.buy_price || (product as any).purchase_price || 0;
        const basePrice = returnsSubMode === 'sales_return' ? defaultSalesPrice : defaultCostPrice;
        let newPrice = basePrice;
        let newQtyInPieces = 1;

        if (targetUnit === 'dozen') {
          newQtyInPieces = 12;
          newPrice = returnsSubMode === 'sales_return' ? defaultSalesPrice * 11 : defaultCostPrice * 12;
        } else if (targetUnit === 'carton') {
          newQtyInPieces = 24;
          newPrice = returnsSubMode === 'sales_return' ? defaultSalesPrice * 22 : defaultCostPrice * 24;
        }

        const newCartId = `${currentItem.id}-${targetUnit}`;
        const updated = [...returnsCart];
        updated[itemIdx] = {
          ...currentItem,
          cartId: newCartId,
          unitType: targetUnit,
          price: newPrice,
          qtyInPieces: newQtyInPieces
        };
        setReturnsCart(updated);
        audioService.playSuccess();
      }
    } catch (e) {
      console.error('Error switching cart unit:', e);
    }
  };

  // تعديل سعر شراء صنف محدد يدويًا
  const updatePurchasePrice = (cartId: string, newPrice: number) => {
    if (posMode === 'purchases') {
      setPurchasesCart(purchasesCart.map(c => c.cartId === cartId ? { ...c, buyPrice: newPrice } : c));
    } else {
      setReturnsCart(returnsCart.map(c => c.cartId === cartId ? { ...c, price: newPrice } : c));
    }
  };

  // تفريغ السلة النشطة بالكامل بعد تأكيد المستخدم
  const clearActiveCart = () => {
    if (activeCart.length === 0) return;
    if (window.confirm('⚠️ هل أنت متأكد من رغبتك في تفريغ محتويات هذه السلة بالكامل؟')) {
      if (posMode === 'sales') {
        setSalesCart([]);
        setSelectedCustomer(null);
        setDiscount(0);
      } else if (posMode === 'purchases') {
        setPurchasesCart([]);
        setSelectedSupplier(null);
      } else {
        setReturnsCart([]);
      }
    }
  };

  // معالجة وحفظ مرتجع الجملة
  const handleSaveReturn = async () => {
    if (returnsCart.length === 0 || !profile?.ownerId) return;

    if (returnsSubMode === 'sales_return' && returnsPaymentMethod === 'credit' && !selectedCustomer) {
      alert('يرجى اختيار العميل لخصم مرتجع الآجل من مديونيته');
      return;
    }
    if (returnsSubMode === 'purchase_return' && !selectedSupplier) {
      alert('يرجى اختيار المورد لإرجاع المعتمد له');
      return;
    }

    setIsSubmitting(true);
    // Sleek micro-visual state switch to absorb finger bounces
    await new Promise((resolve) => setTimeout(resolve, 300));

    const isOffline = !navigator.onLine;
    const txId = generateTransactionId();
    // Unique ID derived directly from transaction ID for total server-side single-execution (Idempotency)
    const returnId = `ret_${txId}`;
    const returnTotal = finalTotal;

    const returnData = {
      ownerId: profile.ownerId,
      shopId: profile?.shopId || profile?.storeId || '',
      transactionId: txId,
      operatorId: profile.uid,
      operatorName: profile.name,
      operated_by_employee_name: profile.name || 'غير معروف',
      employee_uid: profile.uid || 'غير معروف',
      type: 'wholesale_return',
      returnsSubMode,
      paymentMethod: returnsPaymentMethod,
      items: returnsCart,
      subtotal: subtotal,
      discount: returnsSubMode === 'sales_return' ? discount : 0,
      total: returnTotal,
      createdAt: new Date().toISOString()
    };

    const transId = `tr_ret_${txId}`;
    const transData = {
      ownerId: profile.ownerId,
      shopId: profile?.shopId || profile?.storeId || '',
      type: returnsSubMode === 'sales_return' ? 'expense' : 'income',
      amount: returnTotal,
      category: returnsSubMode === 'sales_return' ? 'sales_return' : 'purchase_return',
      description: `مرتجع جملة (${returnsSubMode === 'sales_return' ? 'مبيعات لعميل: ' + (selectedCustomer?.name || 'عابر') : 'مشتريات لمورد: ' + (selectedSupplier?.name || 'مورد')}) - رقم المعاملة ${txId}`,
      createdAt: new Date().toISOString()
    };

    const ops: any[] = [];
    ops.push({
      operation: 'setDoc',
      path: `returns/${returnId}`,
      data: returnData
    });

    ops.push({
      operation: 'setDoc',
      path: `transactions/${transId}`,
      data: transData
    });

    for (const item of returnsCart) {
      const deltaQty = item.quantity * item.qtyInPieces;
      ops.push({
        operation: 'updateDoc',
        path: `inventory/${item.id}`,
        data: {
          stock: increment(returnsSubMode === 'sales_return' ? deltaQty : -deltaQty),
          updatedAt: new Date().toISOString()
        }
      });
    }

    if (returnsSubMode === 'sales_return') {
      const isNetwork = (selectedCustomer as any)?.source === 'network';
      if (isNetwork && (selectedCustomer as any)?.linkId) {
        ops.push({
          operation: 'updateDoc',
          path: `networkLinks/${(selectedCustomer as any).linkId}`,
          data: {
            balance: increment(-returnTotal),
            updatedAt: new Date().toISOString()
          }
        });
      } else if (selectedCustomer?.id && returnsPaymentMethod === 'credit') {
        ops.push({
          operation: 'updateDoc',
          path: `customers/${selectedCustomer.id}`,
          data: {
            debt: increment(-returnTotal),
            updatedAt: new Date().toISOString()
          }
        });
      }
    } else {
      if (selectedSupplier?.id) {
        if (returnsPaymentMethod === 'credit') {
          ops.push({
            operation: 'updateDoc',
            path: `suppliers/${selectedSupplier.id}`,
            data: {
              debt: increment(-returnTotal),
              updatedAt: new Date().toISOString()
            }
          });
        }
      }
    }

    const applyLocalStateChanges = () => {
      setItems(prevItems => {
        const updated = prevItems.map(item => {
          const cartItem = returnsCart.find(c => c.id === item.id);
          if (cartItem) {
            const deltaQty = cartItem.quantity * cartItem.qtyInPieces;
            return { 
              ...item, 
              stock: item.stock + (returnsSubMode === 'sales_return' ? deltaQty : -deltaQty) 
            };
          }
          return item;
        });
        try {
          localStorage.setItem('jam_offline_products', JSON.stringify(updated));
          idbService.syncInventory(updated as any).catch(() => {});
        } catch (e) {}
        return updated;
      });
      setReturnsCart([]);
      setDiscount(0);
      setIsSubmitting(false);
      showOfflineToast();
    };

    if (isOffline) {
      queueOfflineOperations(ops);
      applyLocalStateChanges();
      return;
    }

    try {
      const batch = writeBatch(db);
      const returnRef = doc(db, 'returns', returnId);
      batch.set(returnRef, {
        ...returnData,
        createdAt: serverTimestamp()
      }, { merge: true });

      for (const item of returnsCart) {
        const itemRef = doc(db, 'inventory', item.id);
        if (returnsSubMode === 'sales_return') {
          batch.update(itemRef, {
            stock: increment(item.quantity * item.qtyInPieces),
            updatedAt: serverTimestamp()
          });
        } else {
          batch.update(itemRef, {
            stock: increment(-(item.quantity * item.qtyInPieces)),
            updatedAt: serverTimestamp()
          });
        }
      }

      if (returnsSubMode === 'sales_return') {
        const isNetwork = (selectedCustomer as any)?.source === 'network';
        if (isNetwork && (selectedCustomer as any)?.linkId) {
          const linkRef = doc(db, 'networkLinks', (selectedCustomer as any).linkId);
          batch.update(linkRef, {
            balance: increment(-returnTotal),
            updatedAt: serverTimestamp()
          });
        } else if (selectedCustomer?.id && returnsPaymentMethod === 'credit') {
          const custRef = doc(db, 'customers', selectedCustomer.id);
          batch.update(custRef, {
            debt: increment(-returnTotal),
            updatedAt: serverTimestamp()
          });
        }
      } else {
        if (selectedSupplier?.id) {
          const supplierRef = doc(db, 'suppliers', selectedSupplier.id);
          if (returnsPaymentMethod === 'credit') {
            batch.update(supplierRef, {
              debt: increment(-returnTotal),
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      const effectiveShopId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
      const fullTransData = {
        ...transData,
        ownerId: profile?.ownerId,
        shopId: effectiveShopId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const transRef = doc(db, 'transactions', transId);
      batch.set(transRef, fullTransData, { merge: true });

      const isolatedTransRef = doc(db, 'shops', effectiveShopId, 'transactions', transId);
      batch.set(isolatedTransRef, fullTransData, { merge: true });

      await batch.commit();

      if (profile?.ownerId) {
        if (returnsSubMode === 'sales_return') {
          const retCost = returnsCart.reduce((sum, item) => {
            const cost = item.originalProduct.cost || item.originalProduct.lastBuyPrice || 0;
            return sum + (cost * item.quantity * item.qtyInPieces);
          }, 0);
          postSaleToGL(profile.ownerId, {
            id: returnId,
            total: returnTotal,
            cost: retCost,
            paymentMethod: returnsPaymentMethod,
            type: 'wholesale_return'
          }, effectiveShopId);
        } else {
          postPurchaseToGL(profile.ownerId, {
            id: returnId,
            total: returnTotal,
            paymentMethod: returnsPaymentMethod,
            type: 'purchase_return'
          }, effectiveShopId);
        }
      }

      setReturnsCart([]);
      setDiscount(0);
      alert('تم حفظ وتسجيل مرتجع الجملة بنجاح وتحديث الحسابات والمخزن.');
    } catch (e: any) {
      const errStr = String(e).toLowerCase();
      const isNetworkIssue = !navigator.onLine || errStr.includes('network') || errStr.includes('offline') || errStr.includes('unavailable') || errStr.includes('connection');
      if (isNetworkIssue) {
        queueOfflineOperations(ops);
        applyLocalStateChanges();
      } else {
        handleFirestoreError(e, OperationType.WRITE, 'returns');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // معالجة وحفظ عملية مبيعات الجملة
  const handleSaveSale = async (
    executionMode: OrderExecutionMode = 'final_sale',
    matrixMethod?: PaymentMatrixMethod,
    splitDetails?: PaymentSplitDetails
  ) => {
    if (salesCart.length === 0 || !profile?.ownerId) return;

    const methodToUse = matrixMethod || (salesPaymentMethod as any);
    const isCreditUsed = methodToUse === 'credit' || methodToUse === 'split_cash_debt' || methodToUse === 'split_deposit_debt';
    const debtAmount = methodToUse === 'credit' 
      ? finalTotal 
      : (splitDetails?.debtAmount || 0);
    const cashAmount = methodToUse === 'cash'
      ? finalTotal
      : (splitDetails?.cashAmount || (methodToUse === 'split_cash_debt' || methodToUse === 'split_deposit_cash' ? (splitDetails?.cashAmount || 0) : 0));
    const depositAmount = methodToUse === 'transfer'
      ? finalTotal
      : (splitDetails?.depositAmount || (methodToUse === 'split_deposit_cash' || methodToUse === 'split_deposit_debt' ? (splitDetails?.depositAmount || 0) : 0));
    
    if (isCreditUsed && debtAmount > 0 && !selectedCustomer) {
       alert('يرجى اختيار عميل لتسجيل البيع الآجل / المديونية');
       return;
    }

    if (isCreditUsed && debtAmount > 0 && selectedCustomer) {
      if ((selectedCustomer as any)?.source === 'network') {
        const partner = selectedCustomer as any;
        if (partner.type === 'cash_only') {
          alert('هذا الحساب مرتبط كـ (نقدي فقط) ولا يسمح بالبيع الآجل له.');
          return;
        }
        const currentBalance = Number(partner.balance) || 0;
        const limit = Number(partner.creditLimit) || 0;
        if (limit > 0 && currentBalance + debtAmount > limit) {
          alert(`لقد تجاوز العميل سقف المديونية المسموح به (${limit.toLocaleString()}). المتبقي له فقط: ${(limit - currentBalance).toLocaleString()} ر.ي`);
          return;
        }
      } else {
        const custLimit = selectedCustomer.creditLimit || (selectedCustomer.allowCredit ? 1000000 : 0);
        const currentDebt = selectedCustomer.debt || 0;
        if (selectedCustomer.allowCredit === false || (custLimit > 0 && currentDebt + debtAmount > custLimit)) {
          alert(`لقد تجاوز العميل سقف المديونية المسموح به (${custLimit.toLocaleString()}). المديونية الحالية: ${currentDebt.toLocaleString()} ر.ي`);
          return;
        }
      }
    }

    // Validate Employee Debt Ceiling on Wholesale Credit Sale
    if (isCreditUsed && debtAmount > 0 && profile?.role !== 'manager' && profile?.role !== 'superadmin' && profile?.role !== 'owner') {
       const currentUsername = profile?.username || 'employee';
       const debtGuardCheck = employeeDebtGuardService.canEmployeeIssueCredit(currentUsername, debtAmount);

       if (!debtGuardCheck.allowed) {
          alert(`⛔ منع إدانة العملاء على مسؤولية الموظف في الجملة:\n\n${debtGuardCheck.reason}`);
          return;
       }
    }

    // 🛑 Enforce Inventory Limits Validation (التحقق الصارم من المخزون لمنع البيع الزائد وتجاوز الكميات المتوفرة)
    for (const item of salesCart) {
      const product = items.find(i => i.id === item.id) || item.originalProduct || item;
      const requestedPieces = (Number(item.quantity) || 1) * (Number(item.qtyInPieces) || 1);
      const actualAvailableStock = Number(product.stock ?? product.quantity ?? product.availableStock ?? 0);

      if (actualAvailableStock < requestedPieces) {
        const itemDisplayName = item.productName || item.name || product.name || 'الصنف';
        triggerStockAlert(`⛔ تم إيقاف المعاملة: الكمية المطلوبة للصنف [${itemDisplayName}] (${requestedPieces} حبة) تتجاوز المخزون الفعلي المتوفر (${actualAvailableStock} حبة)!`);
        alert(`⛔ رفض المعاملة وتجاوز المخزون المتاح:\n\nالكمية المطلوبة للصنف [ ${itemDisplayName} ] هي (${requestedPieces}) حبة، بينما الرصيد الفعلي المتوفر بالمستودع هو (${actualAvailableStock}) حبة فقط.\n\nيرجى تعديل الكمية في السلة للمتابعة.`);
        return;
      }
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const isOffline = !navigator.onLine;
    const txId = generateTransactionId();
    const saleId = `sale_${txId}`;
    const dispatchCode = executionMode === 'hold_dispatch' ? `DSP-${Math.floor(100000 + Math.random() * 900000)}` : undefined;

    const saleData: any = {
      ownerId: profile.ownerId,
      shopId: profile?.shopId || profile?.storeId || '',
      transactionId: txId,
      sellerId: profile.uid,
      sellerName: profile.name,
      operated_by_employee_name: profile.name || 'غير معروف',
      employee_uid: profile.uid || 'غير معروف',
      customerId: (selectedCustomer as any)?.id || 'walking_wholesale',
      customerName: selectedCustomer?.name || 'زبون جملة عابر',
      customerPhone: selectedCustomer?.phone || '',
      networkLinkId: (selectedCustomer as any)?.linkId || null,
      saleType: (selectedCustomer as any)?.source === 'network' ? 'network' : 'direct',
      items: salesCart,
      total: finalTotal,
      subtotal: subtotal,
      profit: (subtotal - discount) - salesCart.reduce((s, i) => s + (i.originalProduct.cost * i.quantity * i.qtyInPieces), 0),
      discount,
      paymentMethod: methodToUse,
      paymentDetails: splitDetails || {
        cashAmount,
        debtAmount,
        depositAmount
      },
      orderStatus: executionMode === 'hold_dispatch' ? 'held_for_dispatch' : 'completed',
      dispatchCode,
      creditOption: isCreditUsed ? salesCreditOption : null,
      installmentMonths: salesCreditOption === 'installment' ? installmentMonths : null,
      type: 'wholesale',
      createdAt: new Date().toISOString()
    };

    if (isCreditUsed && debtAmount > 0) {
      const currentUsername = profile?.username || profile?.uid || 'employee';
      employeeDebtGuardService.recordCreditIssued({
        employeeUsername: currentUsername,
        employeeName: profile?.name || currentUsername,
        customerName: selectedCustomer?.name || 'زبون جملة آجل',
        amount: debtAmount,
        orderId: saleId,
        notes: `فاتورة جملة آجل #${saleId}`
      });
    }

    // Enqueue to StoreQueueEngine
    StoreQueueEngine.enqueueTask(
      profile.ownerId,
      'wholesale_sale',
      'sales',
      saleData,
      profile
    ).catch(err => console.warn('Wholesale StoreQueueEngine enqueue notice:', err));

    const finalDispatchCode = dispatchCode || `DSP-${txId.slice(-6)}`;
    const prepDocId = `prep_${saleId}`;
    const prepData = {
      id: prepDocId,
      ownerId: profile.ownerId,
      shopId: profile?.shopId || profile?.storeId || '',
      orderId: saleId,
      saleId: saleId,
      customerName: selectedCustomer?.name || 'زبون جملة عابر',
      customerPhone: selectedCustomer?.phone || '',
      dispatchCode: finalDispatchCode,
      prepStatus: 'pending',
      items: salesCart.map(item => ({
        itemId: item.id,
        name: item.name,
        requestedQty: item.quantity * (item.qtyInPieces || 1),
        preparedQty: 0,
        status: 'pending',
        unit: item.unitType === 'carton' ? 'كرتون' : item.unitType === 'dozen' ? 'درزن' : 'حبة',
        notes: `طلب جملة: ${item.quantity} ${item.unitType === 'carton' ? 'كرتون' : 'حبة'}`
      })),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const ops: any[] = [];
    ops.push({
      operation: 'setDoc',
      path: `sales/${saleId}`,
      data: saleData
    });

    ops.push({
      operation: 'setDoc',
      path: `warehousePreps/${prepDocId}`,
      data: { ...prepData, createdAt: new Date().toISOString() }
    });

    for (const item of salesCart) {
      ops.push({
        operation: 'updateDoc',
        path: `inventory/${item.id}`,
        data: {
          stock: increment(-(item.quantity * item.qtyInPieces))
        }
      });
    }

    if (isCreditUsed && debtAmount > 0) {
      if ((selectedCustomer as any)?.linkId) {
        ops.push({
          operation: 'updateDoc',
          path: `networkLinks/${(selectedCustomer as any).linkId}`,
          data: {
            balance: increment(debtAmount),
            updatedAt: new Date().toISOString()
          }
        });
      } else if (selectedCustomer?.id) {
        ops.push({
          operation: 'updateDoc',
          path: `customers/${selectedCustomer.id}`,
          data: {
            debt: increment(debtAmount),
            updatedAt: new Date().toISOString()
          }
        });
      }
    }

    const applyLocalStateChanges = () => {
      setItems(prevItems => {
        const updated = prevItems.map(item => {
          const cartItem = salesCart.find(c => c.id === item.id);
          if (cartItem) {
            return { ...item, stock: Math.max(0, (item.stock || 0) - (cartItem.quantity * cartItem.qtyInPieces)) };
          }
          return item;
        });
        try {
          localStorage.setItem('jam_offline_products', JSON.stringify(updated));
          idbService.syncInventory(updated as any).catch(() => {});
        } catch (e) {}
        return updated;
      });

      if (isCreditUsed && debtAmount > 0 && selectedCustomer?.id) {
        setCustomers(prev => {
          const updatedCusts = prev.map(c => c.id === selectedCustomer.id ? { ...c, debt: (c.debt || 0) + debtAmount } : c);
          try {
            localStorage.setItem('jam_offline_customers', JSON.stringify(updatedCusts));
          } catch (e) {}
          return updatedCusts;
        });
      }

      // Record offline invoice to UnifiedOfflineStoreEngine
      try {
        unifiedOfflineStoreEngine.saveInvoiceLocal({
          id: saleId,
          invoiceNumber: txId,
          customerId: (selectedCustomer as any)?.id || 'walking_wholesale',
          customerName: selectedCustomer?.name || 'زبون جملة عابر',
          customerPhone: selectedCustomer?.phone || '',
          items: salesCart.map(c => ({
            productId: c.id,
            name: c.name,
            quantity: c.quantity,
            unitPrice: c.price,
            total: c.price * c.quantity
          })),
          subtotal: subtotal,
          discount: discount,
          total: finalTotal,
          paymentMethod: methodToUse,
          paidAmount: methodToUse === 'credit' ? 0 : finalTotal,
          remainingAmount: methodToUse === 'credit' ? finalTotal : 0,
          type: 'wholesale',
          status: 'completed',
          createdAt: new Date().toISOString()
        } as any).catch(() => {});
      } catch (e) {}

      const completedCart = [...salesCart];
      const completedCustomer = selectedCustomer;
      const completedCustomerName = selectedCustomer?.name || 'زبون جملة عابر';
      const completedCustomerPhone = selectedCustomer?.phone || '';

      setPostSaleModalData({
        saleId,
        transactionId: txId,
        dispatchCode: finalDispatchCode,
        prepOrderId: prepDocId,
        customer: completedCustomer,
        customerName: completedCustomerName,
        customerPhone: completedCustomerPhone,
        items: completedCart.map(c => ({
          id: c.id,
          name: c.name,
          quantity: c.quantity,
          price: c.price,
          unitType: c.unitType,
          qtyInPieces: c.qtyInPieces,
          discount: c.discount || 0,
          agency: c.agency
        })),
        subtotal: subtotal,
        discount: discount,
        total: finalTotal,
        paymentMethod: methodToUse,
        paymentDetails: splitDetails || {
          cashAmount,
          debtAmount,
          depositAmount,
          bankAccountName: splitDetails?.bankAccountName,
          transferRefNo: splitDetails?.transferRefNo
        },
        sellerName: profile.name,
        createdAt: new Date().toLocaleString('ar-YE')
      });
      setIsPostSaleModalOpen(true);

      setSalesCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setIsSubmitting(false);

      showOfflineToast();
    };

    if (isOffline) {
      queueOfflineOperations(ops);
      applyLocalStateChanges();
      return;
    }

    try {
      const batch = writeBatch(db);
      const saleRef = doc(db, 'sales', saleId);
      
      batch.set(saleRef, {
        ...saleData,
        createdAt: serverTimestamp()
      }, { merge: true });

      // إضافة أمر التجهيز والفرز اللوجستي للمستودع
      const prepRef = doc(db, 'warehousePreps', prepDocId);
      batch.set(prepRef, prepData, { merge: true });

      // تحديث مخزون المنتجات المباعة
      for (const item of salesCart) {
        const itemRef = doc(db, 'inventory', item.id);
        batch.update(itemRef, {
          stock: increment(-(item.quantity * item.qtyInPieces))
        });
      }

      // زيادة مديونية العميل الشبكي أو العميل العادي
      if (isCreditUsed && debtAmount > 0) {
        if ((selectedCustomer as any)?.linkId) {
          const linkRef = doc(db, 'networkLinks', (selectedCustomer as any).linkId);
          batch.update(linkRef, {
            balance: increment(debtAmount),
            updatedAt: serverTimestamp()
          });
        } else if (selectedCustomer?.id) {
          const custRef = doc(db, 'customers', selectedCustomer.id);
          batch.update(custRef, {
            debt: increment(debtAmount),
            updatedAt: serverTimestamp()
          });
        }
      }

      // تسجيل تلقائي في الحوالات البنكية للمطابقة عبر الصراف
      if (depositAmount > 0) {
        const transferRef = doc(collection(db, 'moneyTransfers'));
        batch.set(transferRef, {
          ownerId: profile.ownerId,
          shopId: profile?.shopId || profile?.storeId || '',
          senderName: selectedCustomer?.name || 'زبون جملة عابر',
          amount: Number(depositAmount),
          currency: 'YER',
          status: 'pending',
          bankAccountName: splitDetails?.bankAccountName || 'حساب بنكي / صراف',
          transferRefNo: splitDetails?.transferRefNo || '',
          addedBy: profile.uid,
          addedByName: profile.name,
          notes: `فاتورة جملة #${saleId.slice(-6)} - إيداع: ${depositAmount.toLocaleString()} ر.ي`,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();

      if (profile?.ownerId && executionMode === 'final_sale') {
        const effectiveShopId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
        const saleCost = salesCart.reduce((sum, item) => {
          const cost = item.originalProduct.cost || item.originalProduct.lastBuyPrice || 0;
          return sum + (cost * item.quantity * item.qtyInPieces);
        }, 0);
        postSaleToGL(profile.ownerId, {
          id: saleId,
          total: finalTotal,
          cost: saleCost,
          paymentMethod: methodToUse,
          type: 'wholesale'
        }, effectiveShopId);
      }

      if (isCreditUsed && debtAmount > 0 && selectedCustomer?.id) {
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, debt: (c.debt || 0) + debtAmount } : c));
      }

      const completedCart = [...salesCart];
      const completedCustomer = selectedCustomer;
      const completedCustomerName = selectedCustomer?.name || 'زبون جملة عابر';
      const completedCustomerPhone = selectedCustomer?.phone || '';

      // فتح نافذة ما بعد البيع ومسار المستودع المتكاملة
      setPostSaleModalData({
        saleId,
        transactionId: txId,
        dispatchCode: finalDispatchCode,
        prepOrderId: prepDocId,
        customer: completedCustomer,
        customerName: completedCustomerName,
        customerPhone: completedCustomerPhone,
        items: completedCart.map(c => ({
          id: c.id,
          name: c.name,
          quantity: c.quantity,
          price: c.price,
          unitType: c.unitType,
          qtyInPieces: c.qtyInPieces,
          discount: c.discount || 0,
          agency: c.agency
        })),
        subtotal: subtotal,
        discount: discount,
        total: finalTotal,
        paymentMethod: methodToUse,
        paymentDetails: splitDetails || {
          cashAmount,
          debtAmount,
          depositAmount,
          bankAccountName: splitDetails?.bankAccountName,
          transferRefNo: splitDetails?.transferRefNo
        },
        sellerName: profile.name,
        createdAt: new Date().toLocaleString('ar-YE')
      });
      setIsPostSaleModalOpen(true);

      setSalesCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
    } catch (e: any) {
      const errStr = String(e).toLowerCase();
      const isNetworkIssue = !navigator.onLine || errStr.includes('network') || errStr.includes('offline') || errStr.includes('unavailable') || errStr.includes('connection');
      if (isNetworkIssue) {
        queueOfflineOperations(ops);
        applyLocalStateChanges();
      } else {
        handleFirestoreError(e, OperationType.WRITE, 'sales');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // معالجة وحفظ عملية مشتريات الجملة
  const handleSavePurchase = async () => {
    if (purchasesCart.length === 0 || !profile?.ownerId) return;
    if (!selectedSupplier) {
       alert('يرجى اختيار المورد أولاً');
       return;
    }

    setIsSubmitting(true);
    // Sleek micro-visual state switch to absorb finger bounces
    await new Promise((resolve) => setTimeout(resolve, 300));

    const isOffline = !navigator.onLine;
    const txId = generateTransactionId();
    // Unique ID derived directly from transaction ID for total server-side single-execution (Idempotency)
    const purchaseId = `pur_${txId}`;

    // Construct purchaseData
    const purchaseData = {
      ownerId: profile.ownerId,
      shopId: profile?.shopId || profile?.storeId || '',
      transactionId: txId,
      buyerId: profile.uid,
      buyerName: profile.name,
      operated_by_employee_name: profile.name || 'غير معروف',
      employee_uid: profile.uid || 'غير معروف',
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      items: purchasesCart,
      total: finalTotal,
      paymentMethod: purchasesPaymentMethod,
      creditOption: purchasesPaymentMethod === 'credit' ? purchasesCreditOption : null,
      installmentMonths: purchasesCreditOption === 'installment' ? installmentMonths : null,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    // ⚡ Enqueue to StoreQueueEngine for 0ms Deduplication & Offline Math Guard Audit
    StoreQueueEngine.enqueueTask(
      profile.ownerId,
      'wholesale_purchase',
      'purchases',
      purchaseData,
      profile
    ).catch(err => console.warn('Wholesale Purchase StoreQueueEngine enqueue notice:', err));

    const ops: any[] = [];
    ops.push({
      operation: 'setDoc',
      path: `purchases/${purchaseId}`,
      data: purchaseData
    });

    for (const item of purchasesCart) {
      const qtyInPieces = Number(item.qtyInPieces) || 1;
      const qtyNew = StrictPrecisionEngine.convertMajorToBaseUnit(item.quantity, qtyInPieces);
      const costNew = StrictPrecisionEngine.safeDiv(item.buyPrice, qtyInPieces, 4);
      const currentStock = Math.max(0, item.originalProduct?.stock || 0);
      const currentCost = item.originalProduct?.cost || item.originalProduct?.lastBuyPrice || 0;
      const weightedCost = StrictPrecisionEngine.calculateWeightedAverageCost(
        currentStock,
        currentCost,
        qtyNew,
        costNew
      );

      let newPrice = item.originalProduct?.price || 0;
      if (shopSettings?.autoPricingEnabled) {
        const margin = shopSettings.autoPricingProfitMargin || 15;
        newPrice = StrictPrecisionEngine.financialRound(weightedCost * (1 + margin / 100), 2);
      }

      ops.push({
        operation: 'updateDoc',
        path: `inventory/${item.id}`,
        data: {
          stock: increment(qtyNew),
          lastBuyPrice: costNew,
          cost: weightedCost,
          price: newPrice,
          updatedAt: new Date().toISOString()
        }
      });
    }

    const applyLocalStateChanges = () => {
      setItems(prevItems => {
        const updated = prevItems.map(item => {
          const cartItem = purchasesCart.find(c => c.id === item.id);
          if (cartItem) {
            const qtyPieces = StrictPrecisionEngine.convertMajorToBaseUnit(cartItem.quantity, cartItem.qtyInPieces || 1);
            return { ...item, stock: item.stock + qtyPieces };
          }
          return item;
        });
        try {
          localStorage.setItem('jam_offline_products', JSON.stringify(updated));
          idbService.syncInventory(updated as any).catch(() => {});
        } catch (e) {}
        return updated;
      });
      setPurchasesCart([]);
      setSelectedSupplier(null);
      setIsSubmitting(false);
      showOfflineToast();
    };

    if (isOffline) {
      queueOfflineOperations(ops);
      applyLocalStateChanges();
      return;
    }

    try {
      const batch = writeBatch(db);
      const purchaseRef = doc(db, 'purchases', purchaseId);
      batch.set(purchaseRef, {
        ...purchaseData,
        createdAt: serverTimestamp()
      }, { merge: true });

      for (const item of purchasesCart) {
        const itemRef = doc(db, 'inventory', item.id);
        const qtyInPieces = Number(item.qtyInPieces) || 1;
        const qtyNew = StrictPrecisionEngine.convertMajorToBaseUnit(item.quantity, qtyInPieces);
        const costNew = StrictPrecisionEngine.safeDiv(item.buyPrice, qtyInPieces, 4);
        const currentStock = Math.max(0, item.originalProduct?.stock || 0);
        const currentCost = item.originalProduct?.cost || item.originalProduct?.lastBuyPrice || 0;
        const weightedCost = StrictPrecisionEngine.calculateWeightedAverageCost(
          currentStock,
          currentCost,
          qtyNew,
          costNew
        );

        let newPrice = item.originalProduct?.price || 0;
        if (shopSettings?.autoPricingEnabled) {
          const margin = shopSettings.autoPricingProfitMargin || 15;
          newPrice = StrictPrecisionEngine.financialRound(weightedCost * (1 + margin / 100), 2);
        }

        batch.update(itemRef, {
          stock: increment(qtyNew),
          lastBuyPrice: costNew,
          cost: weightedCost,
          price: newPrice,
          updatedAt: serverTimestamp()
        });
      }

      // تسجيل تلقائي في الحوالات البنكية للمطابقة عبر الصراف
      const bankWalletMethods = ['money_transfer', 'kuraimi', 'mfloos', 'onepay', 'jamwallet'];
      if (bankWalletMethods.includes(purchasesPaymentMethod)) {
        const transferRef = doc(collection(db, 'moneyTransfers'));
        batch.set(transferRef, {
          ownerId: profile.ownerId,
          shopId: profile?.shopId || profile?.storeId || '',
          senderName: selectedSupplier?.name || 'مورد خارجي',
          amount: Number(finalTotal),
          currency: 'YER',
          status: 'pending',
          addedBy: profile.uid,
          addedByName: profile.name,
          notes: `فاتورة مشتريات رقم #${purchaseId.slice(-6)} طريقة الدفع: ${purchasesPaymentMethod === 'money_transfer' ? 'حوالة صرافة' : purchasesPaymentMethod}`,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();

      if (profile?.ownerId) {
        postPurchaseToGL(profile.ownerId, {
          id: purchaseId,
          total: finalTotal,
          paymentMethod: purchasesPaymentMethod,
          type: 'purchase'
        });
      }

      setPurchasesCart([]);
      setSelectedSupplier(null);
      alert('تم تسجيل فاتورة المشتريات وتحديث مخازن التوريد بنجاح');
    } catch (e: any) {
      const errStr = String(e).toLowerCase();
      const isNetworkIssue = !navigator.onLine || errStr.includes('network') || errStr.includes('offline') || errStr.includes('unavailable') || errStr.includes('connection');
      if (isNetworkIssue) {
        queueOfflineOperations(ops);
        applyLocalStateChanges();
      } else {
        handleFirestoreError(e, OperationType.WRITE, 'purchases');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 bg-slate-50 dark:bg-[#07090e]">
      <Loader2 className="animate-spin text-[#d4af37]" size={48} />
      <p className="font-black animate-pulse text-[#d4af37]">جاري تحميل منصة الجملة والربط الشبكي...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#07090e] text-slate-800 dark:text-slate-100 overflow-hidden">
      
      {/* 1. الشريط العلوي واختيار وضعية الجملة والفواتير المعلقة */}
      <header className="p-3 sm:p-4 bg-white dark:bg-[#0d1117] border-b border-slate-200 dark:border-white/[0.05] flex flex-wrap items-center justify-between gap-3 shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-[#d4af37]/20 to-amber-500/10 rounded-xl border border-[#d4af37]/30">
            <Calculator className="text-[#d4af37]" size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-800 dark:text-white uppercase">بوابة الجملة والتجزئة</h1>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/20">JAM Pro</span>
              {/* مؤشر حالة الأوفلاين والسحابة */}
              {isOnline ? (
                <button
                  type="button"
                  onClick={() => fetchData()}
                  disabled={isSyncingData}
                  className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-600 dark:text-emerald-400 text-[10px] font-bold transition-all cursor-pointer"
                  title="متصل بالسحابة - اضغط للتحديث"
                >
                  <Wifi size={11} className={isSyncingData ? 'animate-pulse' : ''} />
                  <span className="hidden md:inline">متصل بالسحابة</span>
                  {isSyncingData && <RefreshCw size={10} className="animate-spin text-emerald-500" />}
                </button>
              ) : (
                <div 
                  className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 rounded-full text-amber-600 dark:text-amber-400 text-[10px] font-bold animate-pulse"
                  title="وضع الأوفلاين نشط - يتم الحفظ محلياً بسرعة 0ms"
                >
                  <WifiOff size={11} />
                  <span>أوفلاين 0ms</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-[#d4af37] font-bold hidden sm:block">كاشير متجاوب • فواتير معلقة • ربط لوجستي للمستودع • حفظ تلقائي</p>
          </div>
        </div>

        {/* أزرار التبديل الفاخرة لوضعيات البيع والشراء والمرتجع */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-[#161b22] rounded-[1.25rem] border border-slate-200 dark:border-white/[0.05]">
            <button 
              type="button"
              onClick={() => {
                setPosMode('sales');
                setSearchQuery('');
              }}
              className={`px-3.5 sm:px-5 py-2 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-1.5 ${
                posMode === 'sales'
                  ? 'bg-[#d4af37] text-slate-950 font-black shadow-lg shadow-[#d4af37]/20'
                  : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              id="tab-wholesale-sales"
            >
              <ShoppingCart size={15} />
              <span>مبيعات</span>
              {salesCart.length > 0 && (
                <span className="bg-slate-950 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                  {salesCart.length}
                </span>
              )}
            </button>
            
            <button 
              type="button"
              onClick={() => {
                setPosMode('purchases');
                setSearchQuery('');
              }}
              className={`px-3.5 sm:px-5 py-2 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-1.5 ${
                posMode === 'purchases'
                  ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20'
                  : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              id="tab-wholesale-purchases"
            >
              <Truck size={15} />
              <span>مشتريات</span>
              {purchasesCart.length > 0 && (
                <span className="bg-white text-blue-600 text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                  {purchasesCart.length}
                </span>
              )}
            </button>
   
            <button 
              type="button"
              onClick={() => {
                setPosMode('returns');
                setSearchQuery('');
              }}
              className={`px-3.5 sm:px-5 py-2 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-1.5 ${
                posMode === 'returns'
                  ? 'bg-rose-600 text-white font-black shadow-lg shadow-rose-600/20'
                  : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              id="tab-wholesale-returns"
            >
              <RotateCcw size={15} />
              <span>مرتجع</span>
              {returnsCart.length > 0 && (
                <span className="bg-white text-rose-600 text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                  {returnsCart.length}
                </span>
              )}
            </button>
          </div>

          {/* تقارير وتصدير الجملة الشامل */}
          <UniversalReportButton
            variant="emerald"
            buttonText={activeCart.length > 0 ? "تصدير فاتورة الجملة" : "تقرير أسعار الجملة"}
            payload={activeCart.length > 0 ? {
              title: posMode === 'sales' ? 'فاتورة / مسودة مبيعات الجملة' : posMode === 'purchases' ? 'فاتورة / مسودة مشتريات الجملة' : 'فاتورة مردودات الجملة',
              subtitle: posMode === 'sales' ? (selectedCustomer ? `العميل: ${selectedCustomer.name} (${selectedCustomer.phone || '-'})` : 'عميل جملة نقدي') : 'مسودة فواتير الجملة والتوريد',
              currency: 'ر.ي',
              summaryCards: [
                { label: 'عدد بنود الفاتورة', value: activeCart.length, currency: 'صنف', color: 'blue' },
                { label: 'إجمالي الكميات', value: activeCart.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0), currency: 'وحدة', color: 'green' },
                { label: 'إجمالي الفاتورة', value: activeCart.reduce((sum, item) => sum + (Number(item.price || item.unitPrice || 0) * (Number(item.quantity) || 1)), 0).toLocaleString(), currency: 'ر.ي', color: 'purple' }
              ],
              columns: [
                { key: 'name', header: 'اسم الصنف / البيان', type: 'text', width: 25 },
                { key: 'barcode', header: 'الباركود', type: 'text', width: 16 },
                { key: 'quantity', header: 'الكمية', type: 'number', width: 12 },
                { key: 'price', header: 'سعر الوحدة', type: 'currency', width: 14, formatter: (val, row) => row.price || row.unitPrice || 0 },
                { key: 'total', header: 'الإجمالي الفرعي', type: 'currency', width: 14, formatter: (_, row) => (Number(row.price || row.unitPrice || 0) * (Number(row.quantity) || 1)) }
              ],
              data: activeCart
            } : {
              title: 'تقرير أصناف وأسعار الجملة المتاحة',
              subtitle: 'كشف تفصيلي بأسعار بيع وشراء الجملة والكميات المتوفرة بالمخازن',
              currency: 'ر.ي',
              summaryCards: [
                { label: 'عدد أصناف الجملة', value: items.length, currency: 'صنف', color: 'blue' },
                { label: 'إجمالي القطع المتوفرة', value: items.reduce((acc, it) => acc + (Number(it.stock) || 0), 0), currency: 'قطعة', color: 'green' }
              ],
              columns: [
                { key: 'name', header: 'اسم الصنف والمواصفات', type: 'text', width: 25 },
                { key: 'category', header: 'القسم', type: 'text', width: 15 },
                { key: 'barcode', header: 'الباركود', type: 'text', width: 15 },
                { key: 'stock', header: 'الكمية بالمخزن', type: 'number', width: 12 },
                { key: 'wholesalePrice', header: 'سعر بيع الجملة', type: 'currency', width: 14 },
                { key: 'price', header: 'سعر التجزئة', type: 'currency', width: 14 }
              ],
              data: items
            }}
          />

          {/* نظام الفواتير المعلقة (Held Bills Controls) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSaveCurrentAsHeld()}
              disabled={activeCart.length === 0}
              className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="تعليق الفاتورة الحالية مؤقتاً للعودة إليها لاحقاً (F9 أو Ctrl+H)"
            >
              <PauseCircle size={15} />
              <span className="hidden sm:inline">تعليق الفاتورة</span>
              <span className="text-[10px] opacity-70 font-mono hidden md:inline">(F9)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsHeldBillsModalOpen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#161b22] dark:hover:bg-[#1c222b] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-black text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer relative"
              title="عرض واستعادة الفواتير المعلقة"
            >
              <History size={15} />
              <span>المعلقة</span>
              {heldBills.length > 0 && (
                <span className="w-5 h-5 bg-[#d4af37] text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center shadow-sm animate-bounce">
                  {heldBills.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* متحكم مساحة العمل المطور لجدول الأصناف (Desktop Viewport Control) */}
        <div className="hidden xl:flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#161b22] rounded-[1.25rem] border border-slate-200 dark:border-white/[0.05]">
          <span className="text-[9px] font-black text-gray-400 px-1.5">تقسيم الشاشة:</span>
          <button
            type="button"
            onClick={() => setWholesaleCartWidth('standard')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer border-none ${
              wholesaleCartWidth === 'standard'
                ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-sm'
                : 'text-gray-400'
            }`}
            title="الحجم القياسي لتقسيم الشاشة (70% - 30%)"
          >
            قياسي (70%)
          </button>
          <button
            type="button"
            onClick={() => setWholesaleCartWidth('wide')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer border-none ${
              wholesaleCartWidth === 'wide'
                ? 'bg-[#d4af37] text-slate-950 font-extrabold shadow-sm'
                : 'text-gray-400'
            }`}
            title="عرض واسع لجدول السلع والباركود (80% - 20%)"
          >
            عريض (80%)
          </button>
        </div>
      </header>
 
      {/* شريط خيارات فرعي لمرتجع الجملة عند تفعيله */}
      {posMode === 'returns' && (
        <div className="mx-4 lg:mx-6 mt-4 p-3 bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-200 dark:border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-rose-500">توجيه نوع مرتجع الجملة:</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setReturnsSubMode('sales_return');
                setSelectedCustomer(null);
                setSelectedSupplier(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                returnsSubMode === 'sales_return'
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                  : 'bg-slate-50 dark:bg-[#161b22] text-gray-400'
              }`}
            >
              إرجاع مبيعات (من زبون/عميل جملة)
            </button>
            <button
              type="button"
              onClick={() => {
                setReturnsSubMode('purchase_return');
                setSelectedCustomer(null);
                setSelectedSupplier(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                returnsSubMode === 'purchase_return'
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                  : 'bg-slate-50 dark:bg-[#161b22] text-gray-400'
              }`}
            >
              إرجاع مشتريات (إلى مورد خارجي)
            </button>
          </div>
        </div>
      )}

      {/* 🌟 3-Tab Segmented Switcher for Wholesale POS (يظهر على شاشات الجوال والتابلت الصغير فقط) */}
      <div className="mx-3 sm:mx-4 mt-2 bg-white dark:bg-[#0d1117] p-2 rounded-2xl border border-slate-200 dark:border-white/[0.05] shadow-sm shrink-0 lg:hidden">
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-[#161b22] p-1 rounded-xl border border-slate-200 dark:border-white/[0.05]">
          <button
            type="button"
            onClick={() => setActiveWholesaleTab('catalog')}
            className={`py-2 px-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeWholesaleTab === 'catalog'
                ? 'bg-[#d4af37] text-slate-950 shadow-md font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
            id="wholesale-tab-catalog-btn"
          >
            <Package size={14} />
            <span>1. الكتالوج</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWholesaleTab('cart')}
            className={`py-2 px-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 relative ${
              activeWholesaleTab === 'cart'
                ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-md font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
            id="wholesale-tab-cart-btn"
          >
            <ShoppingCart size={14} />
            <span>2. السلة ({activeCart.length})</span>
            {activeCart.length > 0 && (
              <span className="w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {activeCart.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveWholesaleTab('checkout')}
            className={`py-2 px-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5 relative ${
              activeWholesaleTab === 'checkout'
                ? 'bg-emerald-600 text-white shadow-md font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
            id="wholesale-tab-checkout-btn"
          >
            <CreditCard size={14} />
            <span>3. الدفع</span>
          </button>
        </div>
      </div>

      {/* 2. بيئة العمل المركبة والشاملة (Desktop/Tablet Split View & Mobile 3-Tabs) */}
      <main className="flex-1 overflow-hidden p-2 sm:p-4 lg:p-5 lg:grid lg:grid-cols-12 lg:gap-4">
        
        {/* ========================================================================= */}
        {/* اللوحة الأولى: الكتالوج والبحث السريع وإضافة الأصناف (العمود الأول) */}
        {/* ========================================================================= */}
        <section className={`${
          activeWholesaleTab === 'catalog' ? 'flex' : 'hidden'
        } lg:flex lg:col-span-4 flex-col h-full overflow-hidden space-y-3`}>
          
          {/* محرك البحث وتصفية الأصناف */}
          <div className="bg-white dark:bg-[#0d1117] p-3.5 rounded-2xl border border-slate-200 dark:border-white/[0.05] shadow-sm shrink-0 space-y-2.5">
            <div className="relative w-full group">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#d4af37] transition-colors" size={18} />
              <input 
                ref={searchRef}
                type="text" 
                placeholder={
                  posMode === 'sales' 
                    ? "ابحث بالاسم أو الباركود (F1)..." 
                    : posMode === 'purchases'
                      ? "ابحث عن صنف لشرائه (F1)..."
                      : "ابحث عن صنف لمرتجعه (F1)..."
                } 
                className="w-full pr-10 pl-10 py-2.5 bg-slate-50 dark:bg-[#161b22] rounded-xl border border-transparent focus:border-[#d4af37] outline-none shadow-inner transition-all font-bold text-xs tracking-wide text-slate-800 dark:text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const q = searchQuery.trim();
                    if (!q) return;

                    // 1. فحص هل هو باركود مطابق تماماً
                    const exactBarcode = items.find(i => 
                      (i.barcode && i.barcode.trim().toLowerCase() === q.toLowerCase()) || 
                      i.id === q
                    );
                    if (exactBarcode) {
                      handleBarcodeScan(q);
                      setSearchQuery('');
                      return;
                    }

                    // 2. إذا كانت نتائج البحث صنفاً واحداً فقط، أضفه مباشرة
                    if (filteredWholesaleItems.length === 1) {
                      const singleItem = filteredWholesaleItems[0];
                      const available = getAvailableStockPieces(singleItem);
                      if (posMode === 'sales' && available <= 0) {
                        audioService.playError();
                        triggerStockAlert(`⛔ الصنف [${singleItem.name}] نفد من المخزن!`);
                        return;
                      }
                      addToCart(singleItem, 'piece');
                      audioService.playSuccess();
                      triggerStockAlert(`⚡ تم إضافة [${singleItem.name}]`);
                      setSearchQuery('');
                      return;
                    }

                    // 3. إذا كان هناك أكثر من صنف، أضف أول صنف
                    if (filteredWholesaleItems.length > 1) {
                      const firstItem = filteredWholesaleItems[0];
                      const available = getAvailableStockPieces(firstItem);
                      if (posMode === 'sales' && available <= 0) {
                        audioService.playError();
                        triggerStockAlert(`⛔ الصنف [${firstItem.name}] نفد من المخزن!`);
                        return;
                      }
                      addToCart(firstItem, 'piece');
                      audioService.playSuccess();
                      triggerStockAlert(`⚡ تم إضافة [${firstItem.name}]`);
                      setSearchQuery('');
                      return;
                    }

                    // لم يتم العثور
                    audioService.playError();
                    triggerStockAlert(`⚠️ لا يوجد صنف مطابق للبحث: "${q}"`);
                  }
                }}
              />
              <button
                type="button"
                onClick={async () => {
                  const granted = await DevicePermissionsService.requestOnDemand('camera');
                  if (granted) setIsScanning(true);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#d4af37] transition-colors p-1 hover:bg-slate-200 dark:hover:bg-[#0d1117] rounded-lg cursor-pointer"
                title="مسح باركود بالكاميرا"
              >
                <Camera size={16} />
              </button>
            </div>

            {/* أدوات التصفية والتصنيف المتقدمة للكتالوج */}
            <div className="space-y-2 pt-1.5 border-t border-slate-100 dark:border-white/[0.05]">
              {/* 1. أقسام المخزن */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5 text-xs">
                <span className="text-[9px] font-black text-gray-400 shrink-0 ml-1">القسم:</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('all')}
                  className={`px-2 py-0.5 rounded-lg font-bold text-[10px] shrink-0 transition-all ${
                    selectedCategoryFilter === 'all'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-[#161b22] text-gray-400 hover:text-slate-200'
                  }`}
                >
                  الكل ({items.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-2 py-0.5 rounded-lg font-bold text-[10px] shrink-0 transition-all flex items-center gap-1 ${
                      selectedCategoryFilter === cat
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-[#161b22] text-gray-400 hover:text-slate-200'
                    }`}
                  >
                    <Tag size={10} className="opacity-70" />
                    <span>{cat}</span>
                  </button>
                ))}
              </div>

              {/* 2. الوكالات والماركات */}
              {agencies.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5 text-xs">
                  <span className="text-[9px] font-black text-gray-400 shrink-0 ml-1">الوكالة:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAgencyFilter('all')}
                    className={`px-2 py-0.5 rounded-lg font-bold text-[10px] shrink-0 transition-all ${
                      selectedAgencyFilter === 'all'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-[#161b22] text-gray-400 hover:text-slate-200'
                    }`}
                  >
                    الكل
                  </button>
                  {agencies.map((agency) => (
                    <button
                      key={agency}
                      type="button"
                      onClick={() => setSelectedAgencyFilter(agency)}
                      className={`px-2 py-0.5 rounded-lg font-bold text-[10px] shrink-0 transition-all flex items-center gap-1 ${
                        selectedAgencyFilter === agency
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-[#161b22] text-gray-400 hover:text-slate-200'
                      }`}
                    >
                      <Building2 size={10} className="opacity-70" />
                      <span>{agency}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 3. حركة الطلب والفرز */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-dashed border-slate-100 dark:border-white/[0.05]">
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5">
                  {[
                    { key: 'all', label: 'الجميع' },
                    { key: 'high_demand', label: '🔥 الأكثر طلباً' },
                    { key: 'low_demand', label: 'الأقل مبيعاً' },
                    { key: 'high_stock', label: '📦 الأكثر كمية' },
                    { key: 'low_stock', label: '⚠️ قارب على النفاد' },
                    { key: 'out_of_stock', label: '❌ نفدت' }
                  ].map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setDemandStockFilter(f.key as any)}
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-black whitespace-nowrap transition-all cursor-pointer border ${
                        demandStockFilter === f.key
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-extrabold'
                          : 'bg-slate-50 dark:bg-[#161b22] text-gray-400 border-transparent hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-100 dark:bg-[#161b22] text-slate-800 dark:text-white text-[10px] font-bold py-0.5 px-1.5 rounded-md border border-slate-200 dark:border-white/10 outline-none cursor-pointer"
                  >
                    <option value="createdAt">تاريخ الإدخال</option>
                    <option value="name">الاسم</option>
                    <option value="price">السعر</option>
                    <option value="stock">الكمية</option>
                    <option value="salesCount">المبيعات</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-1 bg-slate-100 dark:bg-[#161b22] hover:bg-[#d4af37] hover:text-slate-950 rounded-md text-[10px] font-black transition-all border border-slate-200 dark:border-white/10 cursor-pointer text-slate-700 dark:text-gray-300"
                    title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
                  >
                    {sortOrder === 'asc' ? '⬆️' : '⬇️'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowProductImages(!showProductImages)}
                    className={`p-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer border shrink-0 ${
                      showProductImages
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-slate-100 dark:bg-[#161b22] text-gray-400 border-transparent'
                    }`}
                    title="إظهار / إخفاء الصور"
                  >
                    {showProductImages ? <ImageIcon size={12} /> : <ImageOff size={12} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* شبكة السلع والكتالوج مع حظر النفاد اللوني والمنطقي */}
          <div className="bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-200 dark:border-white/[0.05] shadow-sm flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <Package size={15} className="text-[#d4af37]" />
                <h3 className="font-black text-xs">قائمة السلع المتاحة</h3>
              </div>
              <span className="text-[10px] text-gray-400 font-bold">
                {filteredWholesaleItems.length} صنف
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2.5">
              {filteredWholesaleItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                  <Package size={32} className="opacity-30 mb-2" />
                  <p className="text-xs font-bold">لا توجد سلع مطابقة للبحث الحالي</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5">
                  {filteredWholesaleItems.map((item, idx) => {
                    const availableStock = getAvailableStockPieces(item);
                    const isOutOfStock = posMode === 'sales' && availableStock <= 0;
                    const isPartnerItem = Boolean((item as any).isPartnerProduct || (item as any).source === 'partner' || (item as any).source === 'network' || ((item as any).wholesalerId && (item as any).wholesalerId !== profile?.ownerId));
                    const defaultWholesalePrice = item.wholesalePrice || item.wholesale_price || item.price || 0;
                    const defaultCostPrice = item.cost || item.buy_price || (item as any).purchase_price || 0;
                    const displayPrice = posMode === 'sales' ? defaultWholesalePrice : (posMode === 'purchases' ? defaultCostPrice : defaultWholesalePrice);

                    return (
                      <div 
                        key={`catalog-item-${item.id}-${idx}`}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                          isOutOfStock
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 opacity-75'
                            : 'bg-slate-50 dark:bg-[#161b22] border-slate-100 dark:border-white/[0.04] hover:border-[#d4af37]/40 hover:shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1.5 mb-1">
                            <h4 className={`font-black text-xs leading-snug line-clamp-1 ${isOutOfStock ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
                              {item.name}
                            </h4>
                            {isOutOfStock ? (
                              <span className="text-[8px] bg-rose-500 text-white font-extrabold px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-white"></span>
                                غير متوفر
                              </span>
                            ) : isPartnerItem ? (
                              <span className="text-[8px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                متوفر
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-extrabold shrink-0">
                                {availableStock} حبة
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold mb-2">
                            <span>السعر: <strong className="text-[#d4af37] font-mono text-xs">{displayPrice.toLocaleString()}</strong></span>
                            <span className="font-mono text-[9px] opacity-70">{item.barcode ? item.barcode.slice(-5) : ''}</span>
                          </div>
                        </div>
                        
                        {/* أزرار إضافة الوحدات السريعة مع التعطيل عند نفاد الرصيد */}
                        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-200/50 dark:border-white/[0.04]">
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => {
                              if (isOutOfStock) {
                                triggerStockAlert(`⛔ الصنف (${item.name}) نفذ من المخزن بالكامل!`);
                                return;
                              }
                              addToCart(item, 'piece');
                            }}
                            className={`py-1.5 font-black rounded-lg text-[9px] border transition-all cursor-pointer ${
                              isOutOfStock
                                ? 'bg-slate-200 dark:bg-slate-800 text-gray-400 border-transparent cursor-not-allowed'
                                : 'bg-white dark:bg-[#0d1117] hover:bg-[#d4af37] hover:text-slate-950 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/5'
                            }`}
                            title="إضافة حبة واحدة"
                          >
                            حبة
                          </button>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => {
                              if (isOutOfStock) {
                                triggerStockAlert(`⛔ الصنف (${item.name}) نفذ من المخزن بالكامل!`);
                                return;
                              }
                              addToCart(item, 'dozen');
                            }}
                            className={`py-1.5 font-black rounded-lg text-[9px] border transition-all cursor-pointer ${
                              isOutOfStock
                                ? 'bg-slate-200 dark:bg-slate-800 text-gray-400 border-transparent cursor-not-allowed'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white border-blue-500/20'
                            }`}
                            title="إضافة درزن (12 حبة)"
                          >
                            درزن
                          </button>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => {
                              if (isOutOfStock) {
                                triggerStockAlert(`⛔ الصنف (${item.name}) نفذ من المخزن بالكامل!`);
                                return;
                              }
                              addToCart(item, 'carton');
                            }}
                            className={`py-1.5 font-black rounded-lg text-[9px] border transition-all cursor-pointer ${
                              isOutOfStock
                                ? 'bg-slate-200 dark:bg-slate-800 text-gray-400 border-transparent cursor-not-allowed'
                                : 'bg-amber-500/10 text-[#d4af37] hover:bg-[#d4af37] hover:text-slate-950 border-amber-500/20'
                            }`}
                            title="إضافة كرتون كامل"
                          >
                            كرتون
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* اللوحة الثانية: جدول سلة الفاتورة الحالية (العمود الثاني) */}
        {/* ========================================================================= */}
        <section className={`${
          activeWholesaleTab === 'cart' ? 'flex' : 'hidden'
        } lg:flex lg:col-span-5 flex-col h-full overflow-hidden space-y-3`}>
          
          <div className="bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-200 dark:border-white/[0.05] shadow-sm flex flex-col h-full overflow-hidden">
            {/* ترويسة السلة */}
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-white/[0.05] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${posMode === 'sales' ? 'bg-[#d4af37]/10 text-[#d4af37]' : (posMode === 'purchases' ? 'bg-blue-500/10 text-blue-500' : 'bg-rose-500/10 text-rose-500')}`}>
                  {posMode === 'sales' ? <ShoppingCart size={16} /> : (posMode === 'purchases' ? <Truck size={16} /> : <RotateCcw size={16} />)}
                </div>
                <div>
                  <h3 className="font-black text-xs sm:text-sm">
                    {posMode === 'sales' 
                      ? 'سلة مبيعات الجملة' 
                      : posMode === 'purchases' 
                        ? 'أصناف وارد المشتريات' 
                        : 'أصناف مرتجع الصفقة'}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-bold">{activeCart.length} أصناف مدرجة</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={clearActiveCart}
                disabled={activeCart.length === 0}
                className="text-[11px] text-rose-500 hover:text-rose-600 disabled:opacity-40 transition-colors font-black flex items-center gap-1 cursor-pointer"
                title="تفريغ جميع عناصر السلة"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">إفراغ</span>
              </button>
            </div>

            {/* جدول محتويات السلة الفعلي */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 custom-scrollbar">
              {activeCart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-12 h-12 bg-slate-50 dark:bg-[#161b22] rounded-full flex items-center justify-center mb-2 border border-slate-100 dark:border-white/[0.03]">
                    <ShoppingCart size={20} className="text-gray-300" />
                  </div>
                  <h4 className="font-black text-xs text-slate-800 dark:text-slate-100 mb-1">السلة فارغة حالياً</h4>
                  <p className="text-[10px] text-gray-400 font-bold max-w-xs leading-relaxed">
                    انقر على أزرار (حبة / درزن / كرتون) من قائمة الكتالوج لإضافة السلع.
                  </p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/[0.05] text-slate-500 dark:text-slate-400 font-extrabold text-[11px]">
                        <th className="py-2 text-right">الصنف</th>
                        <th className="py-2 text-center">الوحدة</th>
                        <th className="py-2 text-center">الكمية</th>
                        <th className="py-2 text-center">السعر</th>
                        <th className="py-2 text-left">الإجمالي</th>
                        <th className="py-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.03]">
                      {activeCart.map((item, idx) => {
                        const rate = posMode === 'sales' ? item.price : (posMode === 'purchases' ? item.buyPrice : item.price);
                        const quantityVal = item.quantity ?? (item as any).qty ?? 1;
                        const rowTotal = rate * quantityVal;
                        
                        return (
                          <tr key={`cart-row-${item.cartId}-${idx}`} className="group hover:bg-slate-50 dark:hover:bg-[#161b22]/50 transition-colors">
                            {/* اسم الصنف */}
                            <td className="py-2.5 text-right">
                              <span className="block font-black text-slate-900 dark:text-white text-xs leading-tight">
                                {item.productName || item.name || 'منتج غير معروف'}
                              </span>
                              <span className="block font-mono text-[8px] text-[#d4af37] font-bold mt-0.5">
                                {item.originalProduct?.barcode || ''}
                              </span>
                            </td>

                            {/* نوع الوحدة مع التبديل التفاعلي الفوري (المحور الثالث) */}
                            <td className="py-2.5 text-center">
                              <div className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-[#161b22] p-0.5 rounded-lg border border-slate-200 dark:border-white/[0.05]">
                                <button
                                  type="button"
                                  onClick={() => handleSwitchCartUnit(item.cartId, 'piece')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all cursor-pointer ${
                                    item.unitType === 'piece'
                                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                  }`}
                                  title="تحويل لحبة"
                                >
                                  حبة
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSwitchCartUnit(item.cartId, 'dozen')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all cursor-pointer ${
                                    item.unitType === 'dozen'
                                      ? 'bg-blue-500 text-white shadow-xs'
                                      : 'text-slate-400 hover:text-blue-500'
                                  }`}
                                  title="تحويل لدرزن (12 حبة)"
                                >
                                  درزن
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSwitchCartUnit(item.cartId, 'carton')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all cursor-pointer ${
                                    item.unitType === 'carton'
                                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow-xs'
                                      : 'text-slate-400 hover:text-amber-500'
                                  }`}
                                  title="تحويل لكرتون (24 حبة)"
                                >
                                  كرتون
                                </button>
                              </div>
                            </td>

                            {/* أزرار التحكم بالكمية */}
                            <td className="py-2.5 text-center">
                              <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-[#161b22] px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-white/[0.05]">
                                <button 
                                  type="button"
                                  onClick={() => updateQuantity(item.cartId, -1)}
                                  className="p-1 hover:bg-white dark:hover:bg-[#0d1117] text-slate-900 dark:text-slate-300 hover:text-rose-500 rounded transition-colors font-black cursor-pointer"
                                >
                                  <Minus size={11} />
                                </button>
                                <span className="font-extrabold text-amber-500 dark:text-amber-400 text-xs min-w-6 text-center select-none font-mono">
                                  {quantityVal}
                                </span>
                                <button 
                                  type="button"
                                  onClick={() => updateQuantity(item.cartId, 1)}
                                  className="p-1 hover:bg-white dark:hover:bg-[#0d1117] text-slate-900 dark:text-slate-300 hover:text-[#d4af37] rounded transition-colors font-black cursor-pointer"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>

                            {/* سعر الوحدة */}
                            <td className="py-2.5 text-center font-mono text-xs font-black text-slate-800 dark:text-slate-200">
                              {posMode === 'purchases' ? (
                                <input 
                                  type="number"
                                  value={item.buyPrice}
                                  onChange={(e) => updatePurchasePrice(item.cartId, Number(e.target.value))}
                                  className="w-16 text-center bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-white/[0.05] rounded py-0.5 font-bold text-blue-500 text-xs outline-none"
                                />
                              ) : posMode === 'returns' ? (
                                <input 
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => updatePurchasePrice(item.cartId, Number(e.target.value))}
                                  className="w-16 text-center bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-white/[0.05] rounded py-0.5 font-bold text-rose-500 text-xs outline-none"
                                />
                              ) : (
                                rate.toLocaleString()
                              )}
                            </td>

                            {/* الإجمالي */}
                            <td className="py-2.5 text-left font-mono font-black text-xs text-[#d4af37]">
                              {rowTotal.toLocaleString()}
                            </td>

                            {/* زر الحذف */}
                            <td className="py-2.5 text-center">
                              <button 
                                type="button"
                                onClick={() => removeFromCart(item.cartId)}
                                className="p-1 text-slate-400 hover:text-rose-500 rounded transition-all cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* شريط الإجمالي المصغر أسفل جدول السلة */}
            <div className="p-3 bg-slate-50 dark:bg-[#161b22]/50 border-t border-slate-200 dark:border-white/[0.05] flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-gray-400">إجمالي السلة:</span>
              <span className="text-base font-black text-[#d4af37] font-mono">
                {subtotal.toLocaleString()} ر.ي
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* اللوحة الثالثة: بوابة الفوترة وتفاصيل الدفع (العمود الثالث) */}
        {/* ========================================================================= */}
        <section className={`${
          activeWholesaleTab === 'checkout' ? 'flex' : 'hidden'
        } lg:flex lg:col-span-3 flex-col h-full overflow-hidden space-y-3`}>
          
          <div className="bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-200 dark:border-white/[0.05] shadow-xl flex flex-col h-full overflow-hidden">
            
            {/* ترويسة الفوترة */}
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-white/[0.05] bg-slate-50/50 dark:bg-[#161b22]/30 flex items-center justify-between shrink-0">
              <h3 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                <CreditCard size={15} className="text-emerald-500" />
                <span>بوابة الدفع والفوترة</span>
              </h3>
              <span className="text-[9px] bg-[#d4af37]/10 text-[#d4af37] px-2 py-0.5 rounded-lg font-bold border border-[#d4af37]/20 uppercase">
                {posMode === 'sales' ? 'مبيعات' : (posMode === 'purchases' ? 'مشتريات' : 'مرتجع')}
              </span>
            </div>

            {/* جسم الفوترة والبيانات */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 custom-scrollbar text-right">
              {/* اختيار العميل أو المورد */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase">
                  {posMode === 'sales' || (posMode === 'returns' && returnsSubMode === 'sales_return') ? 'العميل المستلم:' : 'المورد المجهز:'}
                </label>
                {(posMode === 'sales' || (posMode === 'returns' && returnsSubMode === 'sales_return')) ? (
                  <CustomerSearchSelector
                    customers={allPartners}
                    selectedCustomer={selectedCustomer}
                    onSelectCustomer={setSelectedCustomer}
                    profile={profile}
                    placeholder="ابحث بالاسم / رقم الجوال..."
                    defaultTier="wholesale"
                  />
                ) : (
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <select 
                      className="w-full pr-8 pl-3 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-white/[0.05] rounded-xl font-bold text-xs outline-none focus:border-blue-500 appearance-none cursor-pointer"
                      value={selectedSupplier?.id || ''}
                      onChange={(e) => {
                        const s = suppliers.find(supp => supp.id === e.target.value);
                        setSelectedSupplier(s || null);
                      }}
                    >
                      <option value="">اختر المورد...</option>
                      {suppliers.map((s, idx) => (
                        <option key={`supp-opt-${s.id}-${idx}`} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* ملخص الحساب الإجمالي والخصم */}
              <div className="p-3 bg-slate-50 dark:bg-[#161b22] rounded-xl space-y-2 border border-slate-200/50 dark:border-white/[0.02]">
                <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                  <span>المجموع الفرعي:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono font-black">{subtotal.toLocaleString()}</span>
                </div>

                {(posMode === 'sales' || (posMode === 'returns' && returnsSubMode === 'sales_return')) && (
                  <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                    <span>قيمة الخصم:</span>
                    <div className="relative w-20">
                      <input 
                        type="number" 
                        className="w-full text-left bg-transparent border-b border-slate-300 dark:border-navy-700 outline-none font-black text-rose-500 font-mono text-xs pr-1"
                        value={discount}
                        onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 dark:border-white/[0.05] flex justify-between items-center">
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">الصافي النهائي:</span>
                  <span className="text-xl font-extrabold text-[#d4af37] font-mono leading-none">
                    {finalTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* بوابة ومصفوفة الدفع المتقدمة */}
              {posMode === 'sales' ? (
                <div className="pt-1">
                  <AdvancedPaymentMatrix
                    totalAmount={finalTotal}
                    customer={selectedCustomer}
                    profile={profile}
                    onCompleteSale={(mode, method, splitDetails) => {
                      handleSaveSale(mode, method, splitDetails);
                    }}
                    onOpenJAMPay={() => setIsJAMPayOpen(true)}
                    onUpdateCreditLimit={(newLimit) => {
                      if (selectedCustomer?.id) {
                        setSelectedCustomer(prev => prev ? { ...prev, creditLimit: newLimit, allowCredit: true } : null);
                        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, creditLimit: newLimit, allowCredit: true } : c));
                      }
                    }}
                    isSubmitting={isSubmitting}
                  />
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase">طريقة التسوية:</label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => {
                        if (posMode === 'purchases') setPurchasesPaymentMethod('cash');
                        else setReturnsPaymentMethod('cash');
                      }}
                      className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                        activePaymentMethod === 'cash' 
                          ? 'bg-slate-900 border-[#d4af37] text-white shadow-md dark:bg-slate-800' 
                          : 'bg-slate-50 dark:bg-[#161b22] border-transparent text-gray-400 hover:text-slate-700 dark:hover:text-white'
                      }`}
                    >
                      <Calculator size={14} />
                      <span>نقدي / فوري</span>
                    </button>

                    <button 
                      type="button"
                      disabled={isCreditBlocked}
                      onClick={() => {
                        if (isCreditBlocked) return;
                        if (posMode === 'purchases') setPurchasesPaymentMethod('credit');
                        else setReturnsPaymentMethod('credit');
                      }}
                      className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                        isCreditBlocked 
                          ? 'bg-red-500/10 border-red-500/20 text-red-500/60 cursor-not-allowed opacity-60' 
                          : activePaymentMethod === 'credit' 
                            ? 'bg-slate-900 border-[#d4af37] text-white shadow-md dark:bg-slate-800' 
                            : 'bg-slate-50 dark:bg-[#161b22] border-transparent text-gray-400 hover:text-slate-700 dark:hover:text-white'
                      }`}
                      id="btn-wholesale-credit"
                    >
                      <CreditCard size={14} />
                      <span>آجل</span>
                    </button>
                  </div>

                  {/* زر الحفظ المباشر للمشتريات والمرتجع */}
                  <div className="pt-3 border-t border-slate-200 dark:border-white/[0.05]">
                    <button 
                      type="button"
                      disabled={activeCart.length === 0 || isSubmitting}
                      onClick={posMode === 'purchases' ? handleSavePurchase : handleSaveReturn}
                      className={`w-full py-3 text-white rounded-xl font-black text-xs shadow-lg active:scale-95 disabled:grayscale disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        posMode === 'purchases'
                          ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10'
                          : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'
                      }`}
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <>
                          <Save size={15} />
                          <span>{posMode === 'purchases' ? 'حفظ فاتورة الشراء (F12)' : 'حفظ المرتجع (F12)'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
        
      </main>

      <JAMPayModal isOpen={isJAMPayOpen} onClose={() => setIsJAMPayOpen(false)} />

      {/* المحور الرابع: نافذة ما بعد البيع ومسار المستودع المتكاملة */}
      <WholesalePostSaleModal
        isOpen={isPostSaleModalOpen}
        onClose={() => setIsPostSaleModalOpen(false)}
        onNewSale={() => {
          setIsPostSaleModalOpen(false);
          clearActiveCart();
          setSelectedCustomer(null);
          setActiveWholesaleTab('catalog');
          if (searchRef.current) {
            searchRef.current.focus();
          }
        }}
        invoiceData={postSaleModalData}
        profile={profile}
        onNavigateToWarehouse={() => {
          setIsPostSaleModalOpen(false);
          if (onNavigateToWarehouse) {
            onNavigateToWarehouse();
          } else {
            window.location.hash = '#/warehouse';
          }
        }}
      />

      {/* إشعار الأوفلاين السلس في الزاوية */}
      <AnimatePresence>
        {flatOfflineAlert && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-[#d4af37]/30 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 font-semibold text-xs text-right max-w-sm"
          >
            <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping shrink-0" />
            <span>{flatOfflineAlert}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isScanning && (
          <BarcodeScanner 
            onScan={(code) => {
              setSearchQuery(code);
              setIsScanning(false);
            }} 
            onClose={() => setIsScanning(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
