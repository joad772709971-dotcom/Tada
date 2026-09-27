import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  writeBatch, 
  limit, 
  orderBy, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  onSnapshot
} from 'firebase/firestore';
import { 
  ShieldAlert, 
  Cpu, 
  Layers, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCcw, 
  TrendingUp, 
  Database,
  Sliders,
  ChevronRight,
  Sparkles,
  Sun,
  Moon,
  Plus,
  Trash2,
  Edit,
  Search,
  Package,
  Settings,
  X,
  FileCheck,
  Briefcase,
  Layers3,
  HelpCircle,
  Tag,
  ToggleLeft,
  ToggleRight,
  Globe,
  Loader2,
  Camera,
  Truck
} from 'lucide-react';
import { InventoryCore } from './InventoryCoreView';
import BarcodeScanner from './BarcodeScanner';
import { logActivity, logStateChange, logActivityDetailed } from '../services/activityLogService';
import { UniversalReportButton } from './UniversalReportButton';
import { UniversalReportPayload } from '../services/UniversalReportService';
import { TieredPricingManager } from './TieredPricingManager';

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

// schema for database items
interface InventoryItemData {
  id?: string;
  name: string;
  barcode: string;
  category: string;
  price: number;         // Retail
  wholesalePrice: number; // Wholesale
  cost: number;
  stock: number;
  unit: string;
  size: string;
  compatibilities: string;
  alternatives: string;
  ownerId: string;
  warrantyType?: 'none' | 'operational' | 'limited';
  warrantyDuration?: number; // in days
  compensationOption?: 'refund' | 'replace_same' | 'replace_other';
  status?: string;
  subscriberPricingTier?: string;
  price_imported?: number; // سعر المستورد
  price_wholesale_wholesale?: number; // سعر جملة الجملة
  price_wholesale?: number; // سعر الجملة
  price_retail?: number; // سعر التجزئة
}

export default function Inventory({ profile }: { profile: any }) {
  const currentOwnerId = profile?.ownerId || auth.currentUser?.uid || 'system';

  // --- Theme Mode State ---
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [storeCode, setStoreCode] = useState<string>('');
  
  // --- Inventory & Data Lists State ---
  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [categories, setCategories] = useState<string[]>([
    'أجهزة محمولة', 'شواحن واكسسوارات', 'قطع غيار شاشات', 'طاقة وبطاريات', 'سماعات وصوتيات', 'عام'
  ]);
  const [activeTab, setActiveTab] = useState<'lux_dashboard' | 'injected_sandbox'>('lux_dashboard');
  const [showTieredPricing, setShowTieredPricing] = useState<boolean>(false);

  // Load and Filter States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [pricingMode, setPricingMode] = useState<'retail' | 'wholesale'>('retail');

  // --- CRUD/Modal Form State ---
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItemData | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formBarcode, setFormBarcode] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('أجهزة محمولة');
  const [formCost, setFormCost] = useState<number>(0);
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formWholesalePrice, setFormWholesalePrice] = useState<number>(0);
  const [formStock, setFormStock] = useState<number>(10);
  const [formUnit, setFormUnit] = useState<string>('حبة');
  const [formSize, setFormSize] = useState<string>('بدون مقاس');
  const [formCompatibilities, setFormCompatibilities] = useState<string>('');
  const [formAlternatives, setFormAlternatives] = useState<string>('');
  const [formWarrantyType, setFormWarrantyType] = useState<'none' | 'operational' | 'limited'>('none');
  const [formWarrantyDuration, setFormWarrantyDuration] = useState<number>(0);
  const [formCompensationOption, setFormCompensationOption] = useState<'refund' | 'replace_same' | 'replace_other'>('replace_same');
  const [formIsPublished, setFormIsPublished] = useState<boolean>(false);
  const [formSubscriberPricingTier, setFormSubscriberPricingTier] = useState<string>('default');
  const [formWarehouseName, setFormWarehouseName] = useState<string>('المستودع الرئيسي للصالات');

  // Modal engine views representation
  const [modalTitle, setModalTitle] = useState<string>('');
  const [isEngineModalOpen, setIsEngineModalOpen] = useState<boolean>(false);
  const [modalItems, setModalItems] = useState<{ id: string; name: string; info: string }[]>([]);

  // Overlays / Flash Messages
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // --- Multi-Select, Bulk Operations & Promotion States ---
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState<boolean>(false);
  const [promoteForm, setPromoteForm] = useState({
    target: 'store' as 'store' | 'auction' | 'wholesale',
    title: '',
    description: 'عرض خاص ومميز ومحدود من متجرنا لزبائننا الكرام!',
    price: 0,
    imageUrl: ''
  });
  const [isPriceUpdateModalOpen, setIsPriceUpdateModalOpen] = useState<boolean>(false);
  const [priceUpdateForm, setPriceUpdateForm] = useState({
    type: 'pct_increase' as 'pct_increase' | 'fixed_increase' | 'pct_decrease' | 'fixed_decrease',
    value: 0
  });

  // --- Owner Permissions (multiImageAllowed) ---
  const [multiImageAllowed, setMultiImageAllowed] = useState<boolean>(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(20);

  // --- Operational parameters ---
  const [customWarehouse, setCustomWarehouse] = useState<string>('المستودع الرئيسي');
  const [warehousesList, setWarehousesList] = useState<{ name: string; count: number }[]>([
    { name: 'المستودع الرئيسي للصالات', count: 0 },
    { name: 'مستودع العينات وقطع الغيار', count: 0 },
    { name: 'مستودع المبيعات السريعة والفرع', count: 0 }
  ]);

  const [dbWarehouses, setDbWarehouses] = useState<string[]>([
    'المستودع الرئيسي للصالات',
    'مستودع العينات وقطع الغيار',
    'مستودع المبيعات السريعة والفرع'
  ]);

  // --- EXCEL QUICK INGESTION & DEFAULT SETUP STATES (المهمة 1) ---
  const [isExcelGridOpen, setIsExcelGridOpen] = useState<boolean>(false);
  const [setupWarehouse, setSetupWarehouse] = useState<string>(() => {
    return localStorage.getItem('jam_quick_setup_warehouse') || 'المستودع الرئيسي للصالات';
  });
  const [setupSupplier, setSetupSupplier] = useState<string>(() => {
    return localStorage.getItem('jam_quick_setup_supplier') || '';
  });
  const [setupInvoiceNumber, setSetupInvoiceNumber] = useState<string>(() => {
    return localStorage.getItem('jam_quick_setup_invoice_number') || '';
  });
  const [setupEntryType, setSetupEntryType] = useState<'initial_stock' | 'purchase'>(() => {
    return (localStorage.getItem('jam_quick_setup_entry_type') as 'initial_stock' | 'purchase') || 'initial_stock';
  });
  const [isWarehouseSystemActivated, setIsWarehouseSystemActivated] = useState<boolean>(() => {
    return localStorage.getItem(`jam_warehouse_activated_${currentOwnerId}`) === 'true';
  });
  const [isSetupLocked, setIsSetupLocked] = useState<boolean>(() => {
    return localStorage.getItem('jam_quick_setup_locked') === 'true';
  });
  
  // Modal invoice/entry states
  const [formInvoiceNumber, setFormInvoiceNumber] = useState<string>('');
  const [formEntryType, setFormEntryType] = useState<'initial_stock' | 'purchase'>('initial_stock');
  const [formSupplier, setFormSupplier] = useState<string>('');
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  // Quick Add Supplier Modal State (إضافة مورد جديد)
  const [isQuickAddSupplierModalOpen, setIsQuickAddSupplierModalOpen] = useState<boolean>(false);
  const [quickSupplierName, setQuickSupplierName] = useState<string>('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState<string>('');
  const [quickSupplierCompany, setQuickSupplierCompany] = useState<string>('');
  const [quickSupplierSourceContext, setQuickSupplierSourceContext] = useState<'setup' | 'form'>('setup');

  // --- GLOBAL WARRANTY SETTINGS STATES (المهمة 1) ---
  const [isGlobalWarrantyModalOpen, setIsGlobalWarrantyModalOpen] = useState<boolean>(false);
  const [globalWarrantyType, setGlobalWarrantyType] = useState<string>(() => {
    return localStorage.getItem('jam_global_warranty_type') || 'none';
  });
  const [globalWarrantyDuration, setGlobalWarrantyDuration] = useState<number>(() => {
    return Number(localStorage.getItem('jam_global_warranty_duration')) || 90;
  });
  const [globalCompensationOption, setGlobalCompensationOption] = useState<string>(() => {
    return localStorage.getItem('jam_global_compensation_option') || 'replace_same';
  });
  const [globalWarrantyScope, setGlobalWarrantyScope] = useState<'all' | 'new_only'>('new_only');

  // --- EXCEL GRID ROWS STATE (المهمة 2) ---
  const [gridRows, setGridRows] = useState<{
    barcode: string;
    name: string;
    quantity: string;
    cost: string;
    price: string;
    wholesalePrice: string;
    warrantyType: string;
  }[]>(() => {
    const saved = localStorage.getItem('jam_quick_grid_rows');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Error reading pre-saved Excel grid rows:", e);
      }
    }
    const defaultWarranty = localStorage.getItem('jam_global_warranty_type') || 'none';
    return [{
      barcode: '',
      name: '',
      quantity: '',
      cost: '',
      price: '',
      wholesalePrice: '',
      warrantyType: defaultWarranty
    }];
  });

  // Keep Excel grid rows synchronized to localStorage in real-time
  useEffect(() => {
    localStorage.setItem('jam_quick_grid_rows', JSON.stringify(gridRows));
  }, [gridRows]);

  // --- NEW ACTIONS MODAL STATES ---
  const [isAddWarehouseModalOpen, setIsAddWarehouseModalOpen] = useState<boolean>(false);
  const [newWhName, setNewWhName] = useState<string>('');

  // --- CUSTOM CATEGORIES & WAREHOUSE MAPPING ---
  const [categoryMappings, setCategoryMappings] = useState<{ id?: string; name: string; warehouseName: string }[]>([]);
  const [isCategoryMappingModalOpen, setIsCategoryMappingModalOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryWarehouse, setNewCategoryWarehouse] = useState<string>('المستودع الرئيسي للصالات');
  const [isMigrating, setIsMigrating] = useState<boolean>(false);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferProductId, setTransferProductId] = useState<string>('');
  const [transferSourceWh, setTransferSourceWh] = useState<string>('المستودع الرئيسي للصالات');
  const [transferTargetWh, setTransferTargetWh] = useState<string>('مستودع العينات وقطع الغيار');
  const [transferQty, setTransferQty] = useState<number>(1);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditWarehouseName, setAuditWarehouseName] = useState<string>('المستودع الرئيسي للصالات');
  const [auditAdjustments, setAuditAdjustments] = useState<Record<string, number>>({});

  const [isAddImagesModalOpen, setIsAddImagesModalOpen] = useState<boolean>(false);
  const [imgTargetProductId, setImgTargetProductId] = useState<string>('');
  const [productImgUrl, setProductImgUrl] = useState<string>('');
  const [imageSearchTerm, setImageSearchTerm] = useState('');
  const [imageFilterWarehouse, setImageFilterWarehouse] = useState('all');
  const [imageFilterCategory, setImageFilterCategory] = useState('all');
  const [imageShowLastInvoiceOnly, setImageShowLastInvoiceOnly] = useState(false);

  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState<boolean>(false);
  const [isOwnerGateModalOpen, setIsOwnerGateModalOpen] = useState<boolean>(false);
  const [barcodeTargetProductId, setBarcodeTargetProductId] = useState<string>('');

  const [transferTarget, setTransferTarget] = useState<string>('wh-default');
  const [sourceWarehouse, setSourceWarehouse] = useState<string>('wh-main');
  const [specificTransferQty, setSpecificTransferQty] = useState<number>(1);
  const [barcodeQty, setBarcodeQty] = useState<number>(5);

  // --- QUICK ENTRY STATE ---
  const [isQuickQtyModalOpen, setIsQuickQtyModalOpen] = useState<boolean>(false);
  const [quickQtyProductId, setQuickQtyProductId] = useState<string>('');
  const [quickQtyAdded, setQuickQtyAdded] = useState<number>(10);
  const [quickQtyWarehouse, setQuickQtyWarehouse] = useState<string>('المستودع الرئيسي للصالات');
  const [quickQtyNewCost, setQuickQtyNewCost] = useState<string>('');
  const [quickQtyNewPrice, setQuickQtyNewPrice] = useState<string>('');

  // --- Real Inventory Audit and Alternatives Modals State ---
  const [isInventoryAnalysisModalOpen, setIsInventoryAnalysisModalOpen] = useState<boolean>(false);
  const [analysisReport, setAnalysisReport] = useState<any>(null);
  const [isAlternativesModalOpen, setIsAlternativesModalOpen] = useState<boolean>(false);
  const [altLeftWarehouse, setAltLeftWarehouse] = useState<string>('المستودع الرئيسي للصالات');
  const [altRightWarehouse, setAltRightWarehouse] = useState<string>('المستودع الرئيسي للصالات');
  const [selectedLeftProductIds, setSelectedLeftProductIds] = useState<string[]>([]);
  const [selectedRightProductIds, setSelectedRightProductIds] = useState<string[]>([]);

  // Status Flasher Helper
  const triggerStatus = (type: 'success' | 'warning' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Switch Theme Dynamically
  const handleToggleTheme = (selectedTheme?: 'dark' | 'light') => {
    const nextTheme = selectedTheme || (themeMode === 'dark' ? 'light' : 'dark');
    setThemeMode(nextTheme);
    const container = document.getElementById('jam-app-container-pro');
    if (container) {
      if (nextTheme === 'light') {
        container.classList.remove('dark');
        container.classList.add('light');
      } else {
        container.classList.remove('light');
        container.classList.add('dark');
      }
    }
  };

  const handleMigrateCategoriesToOwnWarehouses = async () => {
    if (isWarehouseSystemActivated) {
      triggerStatus('warning', 'تم تفعيل نظام المستودعات الذكي مسبقاً لهذا المحل بالفعل.');
      return;
    }
    if (!confirm('⚠️ تنبيه أمان هام: تفعيل هذا النظام يتم لمرة واحدة فقط وهو آمن بنسبة 100%، لن يقوم بحذف أو مسح أو تعديل أي أسعار أو كميات بضاعة أو أقسام أو تصنيفات موجودة مسبقاً في حسابك!\n\nهل أنت متأكد من تفعيل نظام المستودعات المستقلة للأقسام؟')) return;
    
    setIsMigrating(true);
    try {
      for (const mapping of categoryMappings) {
        const catName = mapping.name.trim();
        if (!catName) continue;
        
        // A. Create the warehouse if it doesn't exist in dbWarehouses
        const warehouseExists = dbWarehouses.some(w => w.trim() === catName);
        if (!warehouseExists) {
          await addDoc(collection(db, 'warehouses'), {
            ownerId: currentOwnerId,
            name: catName,
            createdAt: serverTimestamp()
          });
          console.log(`Created warehouse: ${catName}`);
        }
        
        // B. Update or create the mapping
        if (mapping.id) {
          await updateDoc(doc(db, 'inventory_categories', mapping.id), {
            warehouseName: catName
          });
        } else {
          await addDoc(collection(db, 'inventory_categories'), {
            ownerId: currentOwnerId,
            name: catName,
            warehouseName: catName,
            createdAt: serverTimestamp()
          });
        }

        // C. Update items' warehouseName if they belong to this category and were linked to "المستودع الرئيسي للصالات"
        const itemsToUpdate = items.filter(it => 
          it.category === catName && 
          (!it.warehouseName || it.warehouseName === 'المستودع الرئيسي للصالات')
        );
        
        for (const item of itemsToUpdate) {
          if (item.id) {
            await updateDoc(doc(db, 'inventory', item.id), {
              warehouseName: catName
            });
          }
        }
      }
      
      // Save activation state permanently to Firestore
      try {
        await setDoc(doc(db, 'warehouse_configs', currentOwnerId), {
          activated: true,
          activatedAt: serverTimestamp(),
          ownerId: currentOwnerId
        }, { merge: true });
      } catch (saveErr) {
        console.warn("Failed saving state to Firestore:", saveErr);
      }

      setIsWarehouseSystemActivated(true);
      if (currentOwnerId) {
        localStorage.setItem(`jam_warehouse_activated_${currentOwnerId}`, 'true');
      }
      triggerStatus('success', '🚀 تم تفعيل المستودعات المستقلة وفصل ربط الصالات بنجاح! تم إنشاء مستودع مخصص لكل قسم وتحديث السلع دون أي تأثير على الأسعار أو الكميات.');
    } catch (err: any) {
      console.error('Migration error:', err);
      triggerStatus('error', `فشلت عملية تحديث المستودعات: ${err.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  // Fetch persistent warehouse activation status
  useEffect(() => {
    const checkWarehouseActivation = async () => {
      try {
        if (!currentOwnerId || currentOwnerId === 'system') return;
        const configDoc = await getDoc(doc(db, 'warehouse_configs', currentOwnerId));
        if (configDoc.exists() && configDoc.data().activated === true) {
          setIsWarehouseSystemActivated(true);
          localStorage.setItem(`jam_warehouse_activated_${currentOwnerId}`, 'true');
        } else {
          const localCheck = localStorage.getItem(`jam_warehouse_activated_${currentOwnerId}`) === 'true';
          if (localCheck) {
            setIsWarehouseSystemActivated(true);
          }
        }
      } catch (e) {
        console.warn("Error reading warehouse activation state:", e);
      }
    };
    if (currentOwnerId && currentOwnerId !== 'system') {
      checkWarehouseActivation();
    }
  }, [currentOwnerId]);

  // Real-time Firestore synchronizer
  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, 'inventory'),
      where('ownerId', '==', currentOwnerId),
      orderBy('createdAt', 'desc'),
      limit(visibleLimit)
    );

    // 1. Listen to items catalog
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: InventoryItemData[] = [];
      const cats = new Set<string>([
        'أجهزة محمولة', 'شواحن واكسسوارات', 'قطع غيار شاشات', 'طاقة وبطاريات', 'سماعات وصوتيات', 'عام'
      ]);

      let totalStockCount = 0;
      let piecesCount = 0;

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const item: InventoryItemData = {
          id: docSnap.id,
          name: d.name || '',
          barcode: d.barcode || '',
          category: d.category || 'عام',
          price: Number(d.price) || 0,
          wholesalePrice: Number(d.wholesalePrice) || Number(d.price) || 0,
          price_imported: Number(d.price_imported) || 0,
          price_wholesale_wholesale: Number(d.price_wholesale_wholesale) || 0,
          price_wholesale: Number(d.price_wholesale) || Number(d.wholesalePrice) || 0,
          price_retail: Number(d.price_retail) || Number(d.price) || 0,
          cost: Number(d.cost) || 0,
          stock: Number(d.stock) || 0,
          unit: d.unit || 'حبة',
          size: d.size || 'بدون مقاس',
          compatibilities: d.compatibilities || '',
          alternatives: d.alternatives || '',
          ownerId: d.ownerId || currentOwnerId,
          status: d.status || 'draft',
          imageUrl: d.imageUrl || '',
          imageUrls: d.imageUrls || [],
          warehouseName: d.warehouseName || 'المستودع الرئيسي للصالات'
        };
        fetched.push(item);
        if (d.category) cats.add(d.category);
        totalStockCount++;
        piecesCount += Number(d.stock) || 0;
      });

      setItems(fetched);
      setCategories(Array.from(cats));
      setIsLoading(false);
    }, (error) => {
      console.error("Critical firestore error:", error);
      setIsLoading(false);
    });

    // 2. Listen to warehouses list
    const qWh = query(
      collection(db, 'warehouses'),
      where('ownerId', '==', currentOwnerId)
    );
    const unsubscribeWh = onSnapshot(qWh, (snapshot) => {
      if (!snapshot.empty) {
        const dbWhs = snapshot.docs.map(doc => doc.data().name as string);
        setDbWarehouses(Array.from(new Set(dbWhs)));
      } else {
        setDbWarehouses([
          'المستودع الرئيسي للصالات',
          'مستودع العينات وقطع الغيار',
          'مستودع المبيعات السريعة والفرع'
        ]);
      }
    });

    // 2.5 Listen to suppliers list (المهمة 1)
    const qSup = query(
      collection(db, 'suppliers'),
      where('ownerId', '==', currentOwnerId),
      orderBy('name', 'asc')
    );
    const unsubscribeSup = onSnapshot(qSup, (snapshot) => {
      const sups = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || ''
      }));
      setSuppliers(sups);
    }, (error) => {
      console.warn("Error fetching suppliers:", error);
    });

    // 2.7 Listen to category mappings list
    const qCats = query(
      collection(db, 'inventory_categories'),
      where('ownerId', '==', currentOwnerId)
    );
    const unsubscribeCats = onSnapshot(qCats, async (snapshot) => {
      if (!snapshot.empty) {
        const mapped = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          name: docSnap.data().name as string,
          warehouseName: docSnap.data().warehouseName as string
        }));
        setCategoryMappings(mapped);
        setCategories(Array.from(new Set(mapped.map(m => m.name))));
      } else {
        // If empty, let's pre-populate with default categories mapped to 'المستودع الرئيسي للصالات'
        const defaultCats = [
          'أجهزة محمولة', 'شواحن واكسسوارات', 'قطع غيار شاشات', 'طاقة وبطاريات', 'سماعات وصوتيات', 'عام'
        ];
        
        if (currentOwnerId && currentOwnerId !== 'system') {
          try {
            const batch = writeBatch(db);
            defaultCats.forEach((catName) => {
              const docRef = doc(collection(db, 'inventory_categories'));
              batch.set(docRef, {
                ownerId: currentOwnerId,
                name: catName,
                warehouseName: 'المستودع الرئيسي للصالات',
                createdAt: serverTimestamp()
              });
            });
            await batch.commit();
          } catch (e) {
            console.warn("Failed to pre-populate default categories:", e);
          }
        }
        
        const localMapped = defaultCats.map(c => ({ name: c, warehouseName: 'المستودع الرئيسي للصالات' }));
        setCategoryMappings(localMapped);
        setCategories(defaultCats);
      }
    });

    // Check pre-saved owner gateway parameters
    const checkSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', currentOwnerId));
        if (docSnap.exists()) {
          setMultiImageAllowed(docSnap.data().multiImagePermission || false);
          setStoreCode(docSnap.data().storeCode || '');
        }
      } catch (err) {
        console.warn("Failed settings load:", err);
      }
    };
    checkSettings();

    return () => {
      unsubscribe();
      unsubscribeWh();
      unsubscribeSup();
      unsubscribeCats();
    };
  }, [currentOwnerId, visibleLimit]);

  // Update warehouses counts dynamically whenever items or dbWarehouses changes
  useEffect(() => {
    const calculated = dbWarehouses.map((whName) => {
      const matchItemsCount = items.filter(
        (it) => (it.warehouseName || 'المستودع الرئيسي للصالات') === whName
      ).length;
      return { name: whName, count: matchItemsCount };
    });
    setWarehousesList(calculated);
  }, [items, dbWarehouses]);

  // Unified execution targets
  const runTransfer = async (type: 'LAST_INVOICE' | 'FULL_WAREHOUSE' | 'CUSTOM' | 'QUANTITY_BASED') => {
    setIsProcessing(true);
    try {
      let params: any = { targetWarehouseId: transferTarget };
      if (type === 'FULL_WAREHOUSE') {
        params.sourceWarehouseId = sourceWarehouse;
        params.targetWarehouseId = transferTarget;
      } else if (type === 'QUANTITY_BASED') {
        params.items = items
          .filter(i => i.stock >= specificTransferQty)
          .map(i => ({ id: i.id, productId: i.id, quantity: specificTransferQty }));
      } else if (type === 'CUSTOM') {
        const filtered = filteredItems();
        if (filtered.length === 0) {
          triggerStatus('error', 'لا توجد عناصر مصفاة حالياً للتنفيذ.');
          setIsProcessing(false);
          return;
        }
        params.items = filtered.map(i => ({ id: i.id, productId: i.id, quantity: i.stock }));
      }

      const res = await InventoryCore.TransferEngine(type, params);
      if (res?.success) {
        triggerStatus('success', res.message || 'اكتملت حركة النقل والتحويل بنجاح!');
      } else {
        triggerStatus('error', res?.message || 'فشلت عملية التحويل التلقائية.');
      }
    } catch (err: any) {
      triggerStatus('error', err.message || 'خطأ أثناء النقل الفيدرالي.');
    } finally {
      setIsProcessing(false);
    }
  };

  const printBarcode = async (type: 'LAST_INVOICE' | 'LAST_MONTH' | 'PRODUCT' | 'WAREHOUSE' | 'SPECIFIC_COUNT', productTargetId?: string) => {
    setIsProcessing(true);
    try {
      const activeId = productTargetId || (items[0]?.id || '');
      const res = await InventoryCore.BarcodeEngine(type, {
        productId: activeId,
        count: barcodeQty,
        warehouseId: 'wh-default'
      });
      if (res?.success) {
        triggerStatus('success', res.message || 'تم إرسال الملصق بنجاح إلى طابعة الباركود.');
      } else {
        triggerStatus('error', res?.message || 'فشلت تهيئة خط الباركود.');
      }
    } catch (err: any) {
      triggerStatus('error', err.message || 'خطأ طباعة ملصقات الباركود.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleMultiImagePermission = async (status: boolean) => {
    setIsProcessing(true);
    try {
      const res = await InventoryCore.PermissionGate.toggleMultiImage(status);
      if (res?.success) {
        setMultiImageAllowed(status);
        triggerStatus('success', `تم تحديث أذونات الصور المتعددة بنجاح للتطبيق لتصبح: ${status ? 'مسموحة فعالاً' : 'ملغية ومحمية'}.`);
      } else {
        triggerStatus('error', res?.message || 'تعذر تغيير الإذن للمتجر.');
      }
    } catch (err: any) {
      triggerStatus('error', err.message || 'حدث خطأ بالاتصال ببوابة المالك.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFixPricingEngine = async () => {
    setIsProcessing(true);
    try {
      const res = await InventoryCore.Maintenance.fixPricingErrors();
      if (res?.success) {
        triggerStatus('success', res.message || 'اكتمل بنجاح إصلاح معاملات التسعير وهوامش الربح.');
      } else {
        triggerStatus('error', res?.message || 'تعذر استكشاف الأخطاء.');
      }
    } catch (err: any) {
      triggerStatus('error', err.message || 'خطأ في معالجة الأسعار.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuditEngine = async () => {
    setIsProcessing(true);
    try {
      const res = await InventoryCore.Maintenance.runFullAudit();
      if (res?.success) {
        setAnalysisReport(res.auditReport);
        setIsInventoryAnalysisModalOpen(true);
        triggerStatus('success', 'اكتمل تحليل الأرصدة وإعداد تقرير الجرد الشامل بنجاح.');
      } else {
        triggerStatus('error', 'تعذر استصدار تقارير الجرد الميداني.');
      }
    } catch (err: any) {
      triggerStatus('error', err.message || 'خطأ في معالجة الجرد وتحليل الأرصدة.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Global Warranty Policy Saver (المهمة 1)
  const handleSaveGlobalWarranty = async () => {
    try {
      setIsProcessing(true);
      // Save to localStorage
      localStorage.setItem('jam_global_warranty_type', globalWarrantyType);
      localStorage.setItem('jam_global_warranty_duration', globalWarrantyDuration.toString());
      localStorage.setItem('jam_global_compensation_option', globalCompensationOption);

      if (globalWarrantyScope === 'all') {
        // Apply to ALL current items in DB
        if (items.length === 0) {
          triggerStatus('warning', 'لا توجد أصناف حالية في الكتالوج لتطبيق الضمان عليها.');
          setIsGlobalWarrantyModalOpen(false);
          setIsProcessing(false);
          return;
        }

        const batch = writeBatch(db);
        items.forEach((item) => {
          const itemRef = doc(db, 'inventory', item.id);
          // Map global options to schema: 'none', 'operational', 'limited'
          let dbWType: 'none' | 'operational' | 'limited' = 'none';
          if (globalWarrantyType === 'replacement_same' || globalWarrantyType === 'replace_other') {
            dbWType = 'limited';
          } else if (globalWarrantyType === 'return_policy') {
            dbWType = 'operational';
          }

          batch.update(itemRef, {
            warrantyType: dbWType,
            warrantyDuration: Number(globalWarrantyDuration) || 0,
            compensationOption: globalCompensationOption
          });
        });
        await batch.commit();
        triggerStatus('success', `تم تطبيق وتثبيت سياسة الضمان الموحدة على جميع الـ ${items.length} صنفاً في مستودع المنتجات بنجاح.`);
      } else {
        triggerStatus('success', 'تم حفظ السياسة الافتراضية للضمان بنجاح، وستطبق تلقائياً على كل الأصناف الجديدة المضافة.');
      }
      setIsGlobalWarrantyModalOpen(false);
    } catch (err: any) {
      console.error(err);
      triggerStatus('error', err.message || 'فشل معالجة وتثبيت سياسة الضمان الفيدرالية.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Setup Panel Lock Helpers (المهمة 1)
  const handleLockSetup = () => {
    if (!setupWarehouse) {
      triggerStatus('warning', 'يرجى اختيار مستودع أولاً للتمكن من تثبيت الإعدادات الافتراضية.');
      return;
    }
    localStorage.setItem('jam_quick_setup_warehouse', setupWarehouse);
    localStorage.setItem('jam_quick_setup_supplier', setupSupplier);
    localStorage.setItem('jam_quick_setup_invoice_number', setupInvoiceNumber);
    localStorage.setItem('jam_quick_setup_entry_type', setupEntryType);
    localStorage.setItem('jam_quick_setup_locked', 'true');
    setIsSetupLocked(true);
    triggerStatus('success', 'تم تثبيت الإعدادات الافتراضية بنجاح! تم تفعيل جدول الإدخال السريع للسلع.');
  };

  const handleUnlockSetup = () => {
    localStorage.removeItem('jam_quick_setup_locked');
    setIsSetupLocked(false);
    triggerStatus('warning', 'تم إلغاء قفل الإعدادات. يرجى تعديل الخيارات الافتراضية ثم الضغط على تثبيت مجدداً.');
  };

  // --- EXCEL GRID WORKSPACE HELPERS (المهمة 2) ---
  const generateBarcodeValue = () => {
    // Generate standard unique barcode string with STORE CODE prefix if set, otherwise default prefix '690'
    const prefix = storeCode && storeCode.trim() ? `${storeCode.trim()}-` : '690';
    const timestampPart = Date.now().toString().slice(-6);
    const randPart = Math.floor(100000 + Math.random() * 900000).toString();
    return `${prefix}${timestampPart}${randPart}`;
  };

  const handleCellChange = (rowIndex: number, field: string, value: string) => {
    const updated = [...gridRows];
    updated[rowIndex] = {
      ...updated[rowIndex],
      [field]: value
    };
    setGridRows(updated);
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (gridRows.length === 1) {
      setGridRows([{
        barcode: '',
        name: '',
        quantity: '',
        cost: '',
        price: '',
        wholesalePrice: '',
        warrantyType: 'none'
      }]);
      return;
    }
    const updated = gridRows.filter((_, idx) => idx !== rowIndex);
    setGridRows(updated);
  };

  const handleAddRowManual = () => {
    setGridRows([...gridRows, {
      barcode: '',
      name: '',
      quantity: '',
      cost: '',
      price: '',
      wholesalePrice: '',
      warrantyType: globalWarrantyType
    }]);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    field: string
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (field === 'barcode') {
        const val = gridRows[rowIndex].barcode.trim();
        if (!val) {
          const generated = generateBarcodeValue();
          const updated = [...gridRows];
          updated[rowIndex].barcode = generated;
          setGridRows(updated);
          triggerStatus('success', `تم توليد باركود تلقائي: ${generated}`);
        }
        // Focus name field
        setTimeout(() => {
          const nextInput = document.getElementById(`grid-name-${rowIndex}`);
          if (nextInput) nextInput.focus();
        }, 50);
        return;
      }

      if (field === 'name') {
        const nextInput = document.getElementById(`grid-quantity-${rowIndex}`);
        if (nextInput) nextInput.focus();
      } else if (field === 'quantity') {
        const nextInput = document.getElementById(`grid-cost-${rowIndex}`);
        if (nextInput) nextInput.focus();
      } else if (field === 'cost') {
        const nextInput = document.getElementById(`grid-price-${rowIndex}`);
        if (nextInput) nextInput.focus();
      } else if (field === 'price') {
        const nextInput = document.getElementById(`grid-wholesalePrice-${rowIndex}`);
        if (nextInput) nextInput.focus();
      } else if (field === 'wholesalePrice') {
        // Last field in row: transition to next row
        if (rowIndex === gridRows.length - 1) {
          // Append new empty row automatically
          setGridRows([...gridRows, {
            barcode: '',
            name: '',
            quantity: '',
            cost: '',
            price: '',
            wholesalePrice: '',
            warrantyType: globalWarrantyType
          }]);
          // Focus new barcode input
          setTimeout(() => {
            const nextInput = document.getElementById(`grid-barcode-${rowIndex + 1}`);
            if (nextInput) nextInput.focus();
          }, 80);
        } else {
          const nextInput = document.getElementById(`grid-barcode-${rowIndex + 1}`);
          if (nextInput) nextInput.focus();
        }
      }
    }
  };

  const handleCommitBatch = async () => {
    // Filter out rows that are completely blank (no name, no barcode, and 0/empty quantity/prices)
    const activeRows = gridRows.filter(row => {
      const hasBarcode = row.barcode.trim() !== '';
      const hasName = row.name.trim() !== '';
      const hasQuantity = row.quantity.trim() !== '';
      const hasCost = row.cost.trim() !== '';
      const hasPrice = row.price.trim() !== '';
      return hasBarcode || hasName || hasQuantity || hasCost || hasPrice;
    });

    if (activeRows.length === 0) {
      triggerStatus('warning', 'الجدول فارغ! يرجى إدخال صنف واحد على الأقل قبل الحفظ والاعتماد.');
      return;
    }

    if (!currentOwnerId || currentOwnerId === 'system') {
      triggerStatus('error', '⚠️ خطأ في مزامنة السحابة: لم يتم التعرف على حساب المتجر المعتمد بعد. يرجى الانتظار بضع ثوانٍ حتى تكتمل مزامنة الجلسة السحابية مع السيرفر، ثم اضغط حفظ مجدداً.');
      return;
    }

    // Validate that all active rows have at least a Name
    for (let i = 0; i < gridRows.length; i++) {
      const row = gridRows[i];
      const isRowEmpty = row.barcode.trim() === '' && row.name.trim() === '' && row.quantity.trim() === '' && row.cost.trim() === '' && row.price.trim() === '';
      if (!isRowEmpty && row.name.trim() === '') {
        triggerStatus('error', `خطأ في الصف رقم [${i + 1}]: يرجى كتابة اسم الصنف قبل الحفظ والاعتماد.`);
        const errInput = document.getElementById(`grid-name-${i}`);
        if (errInput) errInput.focus();
        return;
      }
    }

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);

      activeRows.forEach((row) => {
        const itemRef = doc(collection(db, 'inventory'));
        const rowBarcode = row.barcode.trim() || generateBarcodeValue();
        
        // Map global warranty option (since item-specific select was removed)
        let dbWType: 'none' | 'operational' | 'limited' = 'none';
        let dbCompensation: 'refund' | 'replace_same' | 'replace_other' | '' = '';
        const dur = Number(globalWarrantyDuration) || 90;

        if (globalWarrantyType === 'replacement_same' || globalWarrantyType === 'limited') {
          dbWType = 'limited';
          dbCompensation = 'replace_same';
        } else if (globalWarrantyType === 'return_policy' || globalWarrantyType === 'operational') {
          dbWType = 'operational';
          dbCompensation = 'refund';
        } else if (globalWarrantyType === 'replace_other') {
          dbWType = 'limited';
          dbCompensation = 'replace_other';
        }

        const payload = {
          name: row.name.trim(),
          barcode: rowBarcode,
          category: categories[0] || 'عام',
          cost: Number(row.cost) || 0,
          price: Number(row.price) || 0,
          wholesalePrice: Number(row.wholesalePrice) || Number(row.price) || 0,
          stock: Number(row.quantity) || 0,
          unit: 'حبة',
          size: 'بدون مقاس',
          compatibilities: '',
          alternatives: '',
          ownerId: currentOwnerId,
          warehouseName: setupWarehouse,
          supplierName: setupSupplier || 'مورد عام',
          warrantyType: dbWType,
          warrantyDuration: dbWType === 'none' ? 0 : dur,
          compensationOption: dbCompensation,
          status: 'draft',
          subscriberPricingTier: 'default',
          entryType: setupEntryType || 'initial_stock',
          invoiceNumber: setupEntryType === 'purchase' ? (setupInvoiceNumber || '') : '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.set(itemRef, payload);
      });

      await batch.commit();

      // Clear local storage and reset state
      localStorage.removeItem('jam_quick_grid_rows');
      setGridRows([{
        barcode: '',
        name: '',
        quantity: '',
        cost: '',
        price: '',
        wholesalePrice: '',
        warrantyType: 'none'
      }]);

      triggerStatus('success', `تم حفظ واعتماد عدد ${activeRows.length} من الأصناف ونقلها مباشرة إلى مخزن المنتجات بالمستودع المحدد!`);
      setIsExcelGridOpen(false);
    } catch (err: any) {
      console.error("Error committing Excel batch:", err);
      triggerStatus('error', err.message || 'حدث خطأ غير متوقع أثناء معالجة وحفظ دفعة السلع.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Alternatives management manual notice
  const handleAlternativesManagement = () => {
    setSelectedLeftProductIds([]);
    setSelectedRightProductIds([]);
    setAltLeftSearch('');
    setAltRightSearch('');
    setIsAlternativesModalOpen(true);
  };

  const [altLeftSearch, setAltLeftSearch] = useState<string>('');
  const [altRightSearch, setAltRightSearch] = useState<string>('');

  const handleSaveAlternativesMapping = async () => {
    if (selectedLeftProductIds.length === 0 || selectedRightProductIds.length === 0) {
      triggerStatus('warning', 'الرجاء تحديد صنف واحد على الأقل في جدول الأصناف الأساسية وصنف واحد على الأقل في جدول الأصناف البديلة.');
      return;
    }
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      
      const leftItems = items.filter(i => selectedLeftProductIds.includes(i.id));
      const rightItems = items.filter(i => selectedRightProductIds.includes(i.id));

      // Append right items as alternatives to each left item
      leftItems.forEach(item => {
        const itemRef = doc(db, 'inventory', item.id);
        const existingAlts = item.alternatives ? item.alternatives.split('، ') : [];
        const newAlts = Array.from(new Set([...existingAlts, ...rightItems.map(i => i.name)]));
        batch.update(itemRef, {
          alternatives: newAlts.join('، '),
          updatedAt: serverTimestamp()
        });
      });

      // Append left items as alternatives to each right item
      rightItems.forEach(item => {
        const itemRef = doc(db, 'inventory', item.id);
        const existingAlts = item.alternatives ? item.alternatives.split('، ') : [];
        const newAlts = Array.from(new Set([...existingAlts, ...leftItems.map(i => i.name)]));
        batch.update(itemRef, {
          alternatives: newAlts.join('، '),
          updatedAt: serverTimestamp()
        });
      });

      // Record in commodity_alternatives
      const altMappingRef = doc(collection(db, 'commodity_alternatives'));
      batch.set(altMappingRef, {
        ownerId: currentOwnerId,
        primaryProducts: leftItems.map(i => ({ id: i.id, name: i.name, warehouse: i.warehouseName || 'المستودع الرئيسي للصالات' })),
        alternativeProducts: rightItems.map(i => ({ id: i.id, name: i.name, warehouse: i.warehouseName || 'المستودع الرئيسي للصالات' })),
        createdAt: serverTimestamp()
      });

      await batch.commit();
      triggerStatus('success', 'تم ربط وتعيين السلع البديلة وتحديث كتالوج المخزون بنجاح!');
      setIsAlternativesModalOpen(false);
      setSelectedLeftProductIds([]);
      setSelectedRightProductIds([]);
    } catch (err: any) {
      console.error(err);
      triggerStatus('error', err.message || 'فشل حفظ البدائل والتوافقات.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler to quickly add a new supplier and auto-select them
  const handleQuickAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierName.trim()) {
      triggerStatus('error', 'يرجى إدخال اسم المورد أو جهة التوريد.');
      return;
    }

    try {
      setIsProcessing(true);
      const supplierDoc = {
        name: quickSupplierName.trim(),
        phone: quickSupplierPhone.trim() || 'لا يوجد',
        company: quickSupplierCompany.trim() || quickSupplierName.trim(),
        ownerId: currentOwnerId,
        balance: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'suppliers'), supplierDoc);
      const newSup = { id: docRef.id, name: quickSupplierName.trim() };
      setSuppliers(prev => [newSup, ...prev.filter(s => s.id !== newSup.id)]);

      if (quickSupplierSourceContext === 'setup') {
        setSetupSupplier(newSup.name);
        localStorage.setItem('jam_quick_setup_supplier', newSup.name);
      } else {
        setFormSupplier(newSup.name);
      }

      await logActivityDetailed({
        type: 'add_supplier',
        userId: profile?.uid || 'system',
        userName: profile?.name || 'مدير المخزن',
        ownerId: currentOwnerId,
        details: `إضافة مورد جديد سريعاً "${newSup.name}" أثناء إدخال الأصناف`,
        oldValue: 0,
        newValue: 0
      });

      triggerStatus('success', `تمت إضافة المورد الجديد "${newSup.name}" بنجاح وتم تحديده تلقائياً.`);
      setIsQuickAddSupplierModalOpen(false);
      setQuickSupplierName('');
      setQuickSupplierPhone('');
      setQuickSupplierCompany('');
    } catch (err: any) {
      console.error('Error adding quick supplier:', err);
      triggerStatus('error', err.message || 'فشل إضافة المورد الجديد.');
    } finally {
      setIsProcessing(false);
    }
  };

  // CRUD Actions
  const handleOpenFormModal = (item?: InventoryItemData) => {
    if (item) {
      setEditingItem(item);
      setFormName(item.name);
      setFormBarcode(item.barcode);
      setFormCategory(item.category);
      setFormCost(item.cost);
      setFormPrice(item.price);
      setFormWholesalePrice(item.wholesalePrice || item.price);
      setFormStock(item.stock);
      setFormUnit(item.unit);
      setFormSize(item.size);
      setFormCompatibilities(item.compatibilities);
      setFormAlternatives(item.alternatives);
      setFormWarrantyType(item.warrantyType || 'none');
      setFormWarrantyDuration(item.warrantyDuration || 0);
      setFormCompensationOption(item.compensationOption || 'replace_same');
      setFormIsPublished(item.status === 'published_in_market');
      setFormSubscriberPricingTier(item.subscriberPricingTier || 'default');
      setFormWarehouseName(item.warehouseName || 'المستودع الرئيسي للصالات');
      setFormEntryType(item.entryType || 'initial_stock');
      setFormInvoiceNumber(item.invoiceNumber || '');
      setFormSupplier((item as any).supplier || (item as any).supplierName || '');
    } else {
      setEditingItem(null);
      setFormName('');
      setFormBarcode(Math.floor(10000000 + Math.random() * 90000000).toString());
      setFormCategory(categories[0] || 'عام');
      setFormCost(0);
      setFormPrice(0);
      setFormWholesalePrice(0);
      setFormStock(10);
      setFormUnit('حبة');
      setFormSize('بدون مقاس');
      setFormCompatibilities('');
      setFormAlternatives('');
      setFormSupplier(setupSupplier || '');

      // Apply Global Warranty settings as defaults (المهمة 3)
      let mappedType: 'none' | 'operational' | 'limited' = 'none';
      if (globalWarrantyType === 'replacement_same' || globalWarrantyType === 'replace_other') {
        mappedType = 'limited';
      } else if (globalWarrantyType === 'return_policy') {
        mappedType = 'operational';
      }
      setFormWarrantyType(mappedType);
      setFormWarrantyDuration(mappedType === 'none' ? 0 : globalWarrantyDuration);
      setFormCompensationOption(globalCompensationOption);

      setFormIsPublished(false);
      setFormSubscriberPricingTier('default');
      setFormWarehouseName(setupWarehouse || 'المستودع الرئيسي للصالات');
      
      // Auto tag with quick settings defaults
      setFormEntryType(setupEntryType || 'initial_stock');
      setFormInvoiceNumber(setupEntryType === 'purchase' ? (setupInvoiceNumber || 'PUR-' + Math.floor(1000 + Math.random() * 9000)) : '');
    }
    setIsFormModalOpen(true);
  };

  const handleOpenPurchaseInvoiceModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormBarcode(Math.floor(10000000 + Math.random() * 90000000).toString());
    setFormCategory(categories[0] || 'عام');
    setFormCost(0);
    setFormPrice(0);
    setFormWholesalePrice(0);
    setFormStock(10);
    setFormUnit('حبة');
    setFormSize('بدون مقاس');
    setFormCompatibilities('');
    setFormAlternatives('');

    let mappedType: 'none' | 'operational' | 'limited' = 'none';
    if (globalWarrantyType === 'replacement_same' || globalWarrantyType === 'replace_other') {
      mappedType = 'limited';
    } else if (globalWarrantyType === 'return_policy') {
      mappedType = 'operational';
    }
    setFormWarrantyType(mappedType);
    setFormWarrantyDuration(mappedType === 'none' ? 0 : globalWarrantyDuration);
    setFormCompensationOption(globalCompensationOption);

    setFormIsPublished(false);
    setFormSubscriberPricingTier('default');
    setFormWarehouseName(setupWarehouse || 'المستودع الرئيسي للصالات');
    
    // Explicit purchase tagging
    setFormEntryType('purchase');
    setFormInvoiceNumber(setupInvoiceNumber || 'PUR-' + Math.floor(1000 + Math.random() * 9000));
    setIsFormModalOpen(true);
  };

  const handleSaveItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      triggerStatus('error', 'يرجى كتابة الاسم لتحديد المنتج بوضوح.');
      return;
    }
    if (!currentOwnerId || currentOwnerId === 'system') {
      triggerStatus('error', '⚠️ خطأ في مزامنة السحابة: لم يتم التعرف على حساب المتجر المعتمد بعد. يرجى الانتظار بضع ثوانٍ حتى تكتمل مزامنة الجلسة السحابية مع السيرفر، ثم اضغط حفظ مجدداً.');
      return;
    }
    setIsProcessing(true);
    
    // Calculate global warranty values on submit
    let mappedType: 'none' | 'operational' | 'limited' = 'none';
    if (globalWarrantyType === 'replacement_same' || globalWarrantyType === 'replace_other') {
      mappedType = 'limited';
    } else if (globalWarrantyType === 'return_policy') {
      mappedType = 'operational';
    }
    const finalWarrantyType = mappedType;
    const finalWarrantyDuration = mappedType === 'none' ? 0 : (Number(globalWarrantyDuration) || 0);
    const finalCompensationOption = globalCompensationOption;

    const finalEntryType = formEntryType === 'purchase' || setupEntryType === 'purchase' ? 'purchase' : 'initial_stock';
    const finalInvoiceNumber = formInvoiceNumber || (finalEntryType === 'purchase' ? setupInvoiceNumber : '') || '';

    const payload = {
      name: formName,
      barcode: formBarcode || Math.floor(10000000 + Math.random() * 90000000).toString(),
      category: formCategory,
      cost: Number(formCost) || 0,
      price: Number(formPrice) || 0,
      wholesalePrice: Number(formWholesalePrice) || Number(formPrice) || 0,
      stock: Number(formStock) || 0,
      unit: formUnit || 'حبة',
      size: formSize || 'بدون مقاس',
      compatibilities: formCompatibilities || '',
      alternatives: formAlternatives || '',
      ownerId: currentOwnerId,
      operated_by_employee_name: profile?.name || 'غير معروف',
      employee_uid: profile?.uid || 'غير معروف',
      warrantyType: finalWarrantyType,
      warrantyDuration: finalWarrantyDuration,
      compensationOption: finalCompensationOption,
      status: formIsPublished ? 'published_in_market' : 'draft',
      subscriberPricingTier: formSubscriberPricingTier,
      warehouseName: formWarehouseName,
      supplier: formSupplier || setupSupplier || '',
      supplierName: formSupplier || setupSupplier || '',
      entryType: finalEntryType,
      invoiceNumber: finalInvoiceNumber,
      updatedAt: serverTimestamp()
    };

    try {
      let targetId = editingItem?.id || '';

      if (editingItem?.id) {
        const changes: string[] = [];
        let isPriceChanged = false;
        if (editingItem.price !== payload.price) {
          changes.push(`السعر: من ${editingItem.price} إلى ${payload.price}`);
          isPriceChanged = true;
        }
        if (editingItem.wholesalePrice !== payload.wholesalePrice) {
          changes.push(`سعر الجملة: من ${editingItem.wholesalePrice} إلى ${payload.wholesalePrice}`);
          isPriceChanged = true;
        }
        if (editingItem.cost !== payload.cost) {
          changes.push(`التكلفة: من ${editingItem.cost} إلى ${payload.cost}`);
        }
        const isQtyDecreased = Number(payload.stock) < Number(editingItem.stock);
        if (editingItem.stock !== payload.stock) {
          changes.push(`المخزون: من ${editingItem.stock} إلى ${payload.stock}`);
          if (isQtyDecreased) {
            changes.push(`👁️ [العين الساهرة: تخفيض الكمية بمقدار ${Number(editingItem.stock) - Number(payload.stock)}]`);
          }
        }
        if (editingItem.name !== payload.name) {
          changes.push(`الاسم: من "${editingItem.name}" إلى "${payload.name}"`);
        }

        const detailsText = changes.length > 0 ? changes.join(' | ') : 'تحديث البيانات دون تغيير في الأسعار أو المخزون';

        await logActivityDetailed({
          type: isQtyDecreased ? 'delete_item' : (isPriceChanged ? 'update_price' : 'update_item'),
          userId: profile?.uid || 'system',
          userName: profile?.name || 'مدير المخزن',
          ownerId: currentOwnerId,
          details: `تعديل الصنف "${formName}": ${detailsText}${isQtyDecreased ? ' [العين الساهرة: تخفيض مخزون 👁️]' : ''}`,
          oldValue: editingItem.stock,
          newValue: payload.stock,
          metadata: {
            surveillance: isQtyDecreased,
            decreaseQty: isQtyDecreased ? Number(editingItem.stock) - Number(payload.stock) : 0,
            itemName: formName,
            category: 'eye_monitoring'
          }
        });

        await updateDoc(doc(db, 'inventory', editingItem.id), payload);
        triggerStatus('success', `تم تحديث بيانات الصنف "${formName}" في النظام الموحد للتخزين.`);
      } else {
        const docRef = await addDoc(collection(db, 'inventory'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        targetId = docRef.id;

        await logActivityDetailed({
          type: 'add_item',
          userId: profile?.uid || 'system',
          userName: profile?.name || 'مدير المخزن',
          ownerId: currentOwnerId,
          details: `إضافة صنف جديد "${formName}" بباركود (${payload.barcode}) - المخزون: ${payload.stock}، التكلفة: ${payload.cost}، السعر: ${payload.price}`,
          oldValue: 0,
          newValue: payload.price
        });

        triggerStatus('success', `تم إضافة الصنف الجديد "${formName}" بنجاح وتوليد ملصق باركود له.`);
      }

      // Sync with wholesaleProducts marketplace collection
      if (targetId) {
        const qWholesale = query(
          collection(db, 'wholesaleProducts'),
          where('originalItemId', '==', targetId),
          where('wholesalerId', '==', currentOwnerId)
        );
        const wholesaleSnap = await getDocs(qWholesale);

        if (formIsPublished) {
          const wholesalePayload = {
            name: formName,
            description: `عرض وتوريد مباشر لمنتج جاهز ومخزن من ${profile?.shopName || profile?.name || 'الوكالة الرقمية المعتمدة'}`,
            price: Number(formWholesalePrice) || Number(formPrice),
            stock: Number(formStock),
            category: formCategory || 'عام',
            wholesalerId: currentOwnerId,
            wholesalerName: profile?.shopName || profile?.name || 'مورد معتمد في النظام',
            originalItemId: targetId,
            isActive: true,
            hierarchyLevel: profile?.hierarchyLevel || 3,
            warrantyType: finalWarrantyType,
            warrantyDuration: finalWarrantyDuration,
            compensationOption: finalCompensationOption,
            subscriberPricingTier: formSubscriberPricingTier,
            updatedAt: serverTimestamp()
          };

          if (wholesaleSnap.empty) {
            await addDoc(collection(db, 'wholesaleProducts'), {
              ...wholesalePayload,
              createdAt: serverTimestamp()
            });
          } else {
            const wholesaleDocId = wholesaleSnap.docs[0].id;
            await updateDoc(doc(db, 'wholesaleProducts', wholesaleDocId), wholesalePayload);
          }
        } else {
          // If unpublished, delete from wholesaleProducts catalog
          for (const docObj of wholesaleSnap.docs) {
            await deleteDoc(doc(db, 'wholesaleProducts', docObj.id));
          }
        }
      }

      setFormName('');
      setFormBarcode('');
      setFormCost(0);
      setFormPrice(0);
      setFormWholesalePrice(0);
      setFormStock(0);
      setFormCompatibilities('');
      setFormAlternatives('');
      setEditingItem(null);
      setIsFormModalOpen(false);
      triggerStatus('success', '✓ تم حفظ الصنف في المخزن وتصفير النموذج فوراً بنجاح!');
    } catch (err: any) {
      triggerStatus('error', `تعذر الحفظ: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickQtySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQtyProductId) {
      triggerStatus('error', 'يرجى اختيار المنتج أولاً.');
      return;
    }
    if (quickQtyAdded <= 0) {
      triggerStatus('error', 'يرجى إدخال كمية مضافة صحيحة (أكبر من صفر).');
      return;
    }
    
    setIsProcessing(true);
    try {
      const selectedItem = items.find(it => it.id === quickQtyProductId);
      if (!selectedItem) {
        throw new Error('المنتج المحدد غير موجود.');
      }
      
      const currentStock = selectedItem.stock || 0;
      const newStock = currentStock + Number(quickQtyAdded);
      
      const updatePayload: any = {
        stock: newStock,
        warehouseName: quickQtyWarehouse,
        updatedAt: serverTimestamp()
      };
      
      const changes: string[] = [];
      changes.push(`المخزون: من ${currentStock} إلى ${newStock} (+${quickQtyAdded})`);

      if (quickQtyNewCost.trim() !== '') {
        updatePayload.cost = Number(quickQtyNewCost);
        changes.push(`التكلفة: من ${selectedItem.cost} إلى ${quickQtyNewCost}`);
      }
      if (quickQtyNewPrice.trim() !== '') {
        updatePayload.price = Number(quickQtyNewPrice);
        updatePayload.wholesalePrice = Number(quickQtyNewPrice);
        changes.push(`السعر: من ${selectedItem.price} إلى ${quickQtyNewPrice}`);
      }

      await logActivityDetailed({
        type: quickQtyNewPrice.trim() !== '' ? 'update_price' : 'update_item',
        userId: profile?.uid || 'system',
        userName: profile?.name || 'مدير المخزن',
        ownerId: currentOwnerId,
        details: `تعديل سريع للصنف "${selectedItem.name}": ${changes.join(' | ')}`,
        oldValue: selectedItem.price,
        newValue: quickQtyNewPrice.trim() !== '' ? Number(quickQtyNewPrice) : selectedItem.price
      });
      
      await updateDoc(doc(db, 'inventory', quickQtyProductId), updatePayload);
      
      // Update wholesale too if published
      if (selectedItem.status === 'published_in_market') {
        const qWholesale = query(
          collection(db, 'wholesaleProducts'),
          where('originalItemId', '==', quickQtyProductId),
          where('wholesalerId', '==', currentOwnerId)
        );
        const wholesaleSnap = await getDocs(qWholesale);
        if (!wholesaleSnap.empty) {
          const wPayload: any = {
            stock: newStock,
            updatedAt: serverTimestamp()
          };
          if (quickQtyNewPrice.trim() !== '') {
            wPayload.price = Number(quickQtyNewPrice);
          }
          await updateDoc(doc(db, 'wholesaleProducts', wholesaleSnap.docs[0].id), wPayload);
        }
      }
      
      triggerStatus('success', `تمت إضافة ${quickQtyAdded} وحدات بنجاح للمنتج "${selectedItem.name}". الكمية الإجمالية الجديدة هي ${newStock}.`);
      setIsQuickQtyModalOpen(false);
      // Reset fields
      setQuickQtyAdded(10);
      setQuickQtyNewCost('');
      setQuickQtyNewPrice('');
    } catch (err: any) {
      triggerStatus('error', `تعذر الإدخال السريع: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`هل أنت واثق تماماً من حذف الصنف "${name}" من كتالوج السلع المخزنية نهائياً؟`)) return;
    setIsProcessing(true);
    try {
      const itemToDelete = items.find(it => it.id === id);
      const stockInfo = itemToDelete ? ` (المخزون الملغي: ${itemToDelete.stock}، التكلفة: ${itemToDelete.cost}، السعر: ${itemToDelete.price})` : '';

      await logActivityDetailed({
        type: 'delete_item',
        userId: profile?.uid || 'system',
        userName: profile?.name || 'مدير المخزن',
        ownerId: currentOwnerId,
        details: `شطب الصنف "${name}" نهائياً من سجلات الكتالوج المخزني${stockInfo}`,
        oldValue: itemToDelete?.price || 0,
        newValue: 0
      });

      await deleteDoc(doc(db, 'inventory', id));
      triggerStatus('success', `تم شطب السلعة "${name}" كلياً من السجلات الفيدرالية.`);
    } catch (err: any) {
      triggerStatus('error', `خطأ في محو الصنف: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const [publishingLoading, setPublishingLoading] = useState<string | null>(null);

  const handleToggleMarketPublish = async (item: InventoryItemData) => {
    if (!item.id) return;
    setPublishingLoading(item.id);
    try {
      const isCurrentlyPublished = item.status === 'published_in_market';
      const newStatus = isCurrentlyPublished ? 'draft' : 'published_in_market';

      // 1. Update status in inventory document
      const itemRef = doc(db, 'inventory', item.id);
      await updateDoc(itemRef, { status: newStatus });

      if (!isCurrentlyPublished) {
        // Publish to wholesaleProducts
        // Let's check if it already exists to avoid duplication
        const q = query(
          collection(db, 'wholesaleProducts'),
          where('originalItemId', '==', item.id),
          where('wholesalerId', '==', currentOwnerId)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          await addDoc(collection(db, 'wholesaleProducts'), {
            name: item.name,
            description: `عرض وتوريد مباشر لمنتج جاهز ومخزن من ${profile?.shopName || profile?.name || 'الوكالة الرقمية المعتمدة'}`,
            price: item.wholesalePrice || item.price,
            stock: item.stock,
            category: item.category || 'عام',
            wholesalerId: currentOwnerId,
            wholesalerName: profile?.shopName || profile?.name || 'مورد معتمد في النظام',
            originalItemId: item.id,
            isActive: true,
            hierarchyLevel: profile?.hierarchyLevel || 3,
            createdAt: serverTimestamp()
          });
        }
        triggerStatus('success', `تم تفعيل العرض ونشر المنتج "${item.name}" في سوق الموردين فوراً! 🚀`);
      } else {
        // Withdraw from wholesaleProducts
        const q = query(
          collection(db, 'wholesaleProducts'),
          where('originalItemId', '==', item.id),
          where('wholesalerId', '==', currentOwnerId)
        );
        const snap = await getDocs(q);
        for (const docObj of snap.docs) {
          await deleteDoc(doc(db, 'wholesaleProducts', docObj.id));
        }
        triggerStatus('success', `تم إلغاء العرض وسحب المنتج "${item.name}" من سوق الموردين.`);
      }
    } catch (err: any) {
      console.error(err);
      triggerStatus('error', `فشل في تعديل حالة نشر المنتج: ${err.message}`);
    } finally {
      setPublishingLoading(null);
    }
  };

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      triggerStatus('error', 'يرجى تحديد سلعة واحدة على الأقل للترويج.');
      return;
    }

    setIsProcessing(true);
    try {
      let successCount = 0;
      const targetIsAuction = promoteForm.target === 'auction';

      for (const sId of selectedIds) {
        const item = items.find(it => it.id === sId);
        if (!item) continue;

        const pPrice = Number(promoteForm.price) || item.price;
        const pTitle = promoteForm.title || item.name;
        const pDesc = promoteForm.description || "عرض خاص وحصري لزبائننا الكرام!";

        if (promoteForm.target === 'auction') {
          // --- General Public Auction ("الحراج العام للزبائن" - Global) ---
          if (pPrice < 5000) {
            triggerStatus('warning', `⚠️ تنبيه الحراج: الصنف "${item.name}" سعره أقل من 5,000 ر.ي. تم رفع السعر تلقائياً إلى 5,000 ر.ي لحماية جودة كشاف المستهلكين.`);
          }
          const finalPrice = Math.max(5000, pPrice);

          await addDoc(collection(db, 'public_auctions'), {
            storeId: currentOwnerId,
            title: pTitle,
            price: finalPrice,
            description: pDesc,
            images: [item.imageUrl || ''],
            type: 'supplier_publish',
            createdAt: serverTimestamp(),
            sourceInventoryId: item.id
          });

          await logActivityDetailed({
            type: 'add_sale',
            userId: profile?.uid || 'system',
            userName: profile?.name || 'مدير المخزن',
            ownerId: currentOwnerId,
            details: `[العين الساهرة 👁️] ترويج الصنف "${item.name}" في الحراج العام المفتوح للزبائن بسعر ترويجي: ${finalPrice} ر.ي`,
            oldValue: item.price,
            newValue: finalPrice,
            metadata: { surveillance: true, category: 'eye_monitoring', target: 'public_auctions' }
          });

        } else if (promoteForm.target === 'wholesale') {
          // --- Wholesale Products ---
          await addDoc(collection(db, 'wholesaleProducts'), {
            name: item.name,
            description: pDesc,
            price: pPrice,
            stock: item.stock || 1,
            category: item.category || 'عام',
            wholesalerId: currentOwnerId,
            wholesalerName: profile?.shopName || profile?.name || 'مورد معتمد',
            originalItemId: item.id,
            image: item.imageUrl || '',
            createdAt: serverTimestamp()
          });

          await logActivityDetailed({
            type: 'add_sale',
            userId: profile?.uid || 'system',
            userName: profile?.name || 'مدير المخزن',
            ownerId: currentOwnerId,
            details: `[العين الساهرة 👁️] ترويج الصنف "${item.name}" في سوق الموردين بالجملة بسعر: ${pPrice} ر.ي`,
            oldValue: item.price,
            newValue: pPrice,
            metadata: { surveillance: true, category: 'eye_monitoring', target: 'wholesale_products' }
          });

        } else {
          // --- Customer Store ("المتجر الخاص بالزبائن" - Isolated to this store only) ---
          // 1. Update status in inventory
          await updateDoc(doc(db, 'inventory', item.id), {
            status: 'published_in_market',
            isPromoted: true,
            isPublished: true,
            updatedAt: serverTimestamp()
          });

          // 2. Create offer
          await smartCommerceService.createOffer({
            itemId: item.id,
            itemName: item.name,
            promoPrice: pPrice,
            description: pDesc,
            occasion: 'عرض ترويجي نشط 📣',
            originalPrice: item.price,
            specs: item.specs || {},
            ownerId: currentOwnerId,
            endTime: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
            status: 'active'
          });

          await logActivityDetailed({
            type: 'add_sale',
            userId: profile?.uid || 'system',
            userName: profile?.name || 'مدير المخزن',
            ownerId: currentOwnerId,
            details: `[العين الساهرة 👁️] ترويج الصنف "${item.name}" في المتجر الخاص بزبائن المحل بسعر ترويجي: ${pPrice} ر.ي`,
            oldValue: item.price,
            newValue: pPrice,
            metadata: { surveillance: true, category: 'eye_monitoring', target: 'store_offers' }
          });
        }
        successCount++;
      }

      triggerStatus('success', `✓ تم بنجاح ترويج ونشر عدد (${successCount}) من البضائع في الوجهة المستهدفة!`);
      setIsPromoteModalOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      console.error(err);
      triggerStatus('error', `تعذر ترويج البضائع: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPriceUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      triggerStatus('error', 'يرجى تحديد سلعة واحدة على الأقل لتحديث سعرها.');
      return;
    }
    const updateVal = Number(priceUpdateForm.value);
    if (updateVal <= 0) {
      triggerStatus('error', 'يرجى إدخال قيمة أكبر من صفر للتحديث.');
      return;
    }

    setIsProcessing(true);
    try {
      let successCount = 0;
      for (const sId of selectedIds) {
        const item = items.find(it => it.id === sId);
        if (!item) continue;

        let newPrice = item.price;
        let newWholesale = item.wholesalePrice || item.price;

        if (priceUpdateForm.type === 'pct_increase') {
          newPrice = Math.round(item.price * (1 + updateVal / 100));
          newWholesale = Math.round((item.wholesalePrice || item.price) * (1 + updateVal / 100));
        } else if (priceUpdateForm.type === 'fixed_increase') {
          newPrice = item.price + updateVal;
          newWholesale = (item.wholesalePrice || item.price) + updateVal;
        } else if (priceUpdateForm.type === 'pct_decrease') {
          newPrice = Math.max(0, Math.round(item.price * (1 - updateVal / 100)));
          newWholesale = Math.max(0, Math.round((item.wholesalePrice || item.price) * (1 - updateVal / 100)));
        } else if (priceUpdateForm.type === 'fixed_decrease') {
          newPrice = Math.max(0, item.price - updateVal);
          newWholesale = Math.max(0, (item.wholesalePrice || item.price) - updateVal);
        }

        await updateDoc(doc(db, 'inventory', sId), {
          price: newPrice,
          wholesalePrice: newWholesale,
          updatedAt: serverTimestamp()
        });

        await logActivityDetailed({
          type: 'update_price',
          userId: profile?.uid || 'system',
          userName: profile?.name || 'مدير المخزن',
          ownerId: currentOwnerId,
          details: `[العين الساهرة - تعديل أسعار جماعي 👁️] تعديل سعر "${item.name}": من ${item.price} إلى ${newPrice} ر.ي (تعديل: ${priceUpdateForm.type.includes('pct') ? updateVal + '%' : updateVal + ' ريال'})`,
          oldValue: item.price,
          newValue: newPrice,
          metadata: { surveillance: true, category: 'eye_monitoring', bulkUpdate: true }
        });

        successCount++;
      }

      triggerStatus('success', `✓ تم بنجاح تحديث وتعديل أسعار عدد (${successCount}) من السلع وتدوينها في دفاتر المراقبة الساهرة.`);
      setIsPriceUpdateModalOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      console.error(err);
      triggerStatus('error', `فشل في تحديث الأسعار: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Search filter
  const filteredItems = () => {
    return items.filter(item => {
      const matchSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.barcode.includes(searchTerm) ||
        item.compatibilities.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.alternatives.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      return matchSearch && matchCat;
    });
  };

  // --- Dynamic modal view handler (openModal for E2E and Injectors) ---
  const handleOpenDynamicEngineModal = (type: string) => {
    setModalTitle(type);
    setIsEngineModalOpen(true);
    if (type === 'إدارة الصور') {
      setModalItems(items.slice(0, 15).map(i => ({
        id: i.id || '',
        name: i.name,
        info: `الرصيد: ${i.stock} | حجم الصور المرفوعة: 1 صورة معمارية مرخصة`
      })));
    } else if (type === 'توليد باركود') {
      setModalItems(items.slice(0, 15).map(i => ({
        id: i.id || '',
        name: i.name,
        info: `الرمز التسلسلي: ${i.barcode} | طباعة عددية افتراضية`
      })));
    } else {
      // جرد مخزن
      setModalItems(warehousesList.map((w, idx) => ({
        id: `wh-${idx}`,
        name: w.name,
        info: `مجموع الأصناف المسجلة: ${w.count} حبات فرز معتمد`
      })));
    }
  };

  // Wire Dynamic InventoryEngine & InventoryModule to Global Context for complete compatibility
  useEffect(() => {
    // Dynamically synchronize owner ID context with InventoryCore engine
    if ((window as any).InventoryCore) {
      (window as any).InventoryCore.config.ownerId = currentOwnerId;
    }
    // Set config on the imported object directly
    InventoryCore.config.ownerId = currentOwnerId;

    // 1. InventoryModule Engine
    const InventoryModule = {
      state: { theme: themeMode, multiImageAllowed: multiImageAllowed },
      toggleTheme: () => {
        const next = themeMode === 'dark' ? 'light' : 'dark';
        handleToggleTheme(next);
      },
      Actions: {
        manageItems: (action: 'add' | 'edit' | 'delete', data?: any) => {
          console.log("Injected manageItems triggered:", action, data);
          if (action === 'add') handleOpenFormModal();
          else if (action === 'edit' && data) handleOpenFormModal(data);
          else if (action === 'delete' && data?.id) handleDeleteItem(data.id, data.name);
        },
        runTransfer: (type: any, data?: any) => {
          console.log("Injected runTransfer triggered:", type, data);
          runTransfer(type);
        },
        printBarcode: (type: any, options?: any) => {
          console.log("Injected printBarcode triggered:", type, options);
          printBarcode(type);
        },
        ownerSettings: (shopId: string, status: boolean) => {
          console.log("Injected ownerSettings gate triggered:", shopId, status);
          handleToggleMultiImagePermission(status);
        }
      }
    };

    // 2. InventoryEngine Context
    const InventoryEngine = {
      state: { 
        theme: themeMode, 
        warehouses: warehousesList.map(w => ({ name: w.name, count: w.count })), 
        multiImagePermission: multiImageAllowed 
      },
      toggleTheme: () => {
        const next = themeMode === 'dark' ? 'light' : 'dark';
        handleToggleTheme(next);
      },
      renderWarehouseCards: () => {
        return warehousesList.map(w => `
          <div style="border:1px solid #d4af37; padding:15px; border-radius:8px; background:#1a1a1a; color:#d4af37;">
            <h4>${w.name}</h4>
            <p>الأصناف: ${w.count}</p>
          </div>
        `).join('');
      },
      openModal: (type: string) => {
        console.log("Injected openModal triggered:", type);
        handleOpenDynamicEngineModal(type);
      }
    };

    (window as any).InventoryModule = InventoryModule;
    (window as any).InventoryEngine = InventoryEngine;
  }, [themeMode, multiImageAllowed, items, warehousesList, currentOwnerId]);

  const latestInvoiceNum = (() => {
    const validInvoices = items
      .filter((it: any) => it.invoiceNumber && it.invoiceNumber !== '')
      .map((it: any) => it.invoiceNumber);
    if (validInvoices.length === 0) return '';
    return validInvoices[validInvoices.length - 1];
  })();

  const filteredImageSelectItems = items.filter(it => {
    if (imageSearchTerm.trim() !== '') {
      const q = imageSearchTerm.toLowerCase();
      const matchesName = it.name.toLowerCase().includes(q);
      const matchesBarcode = (it.barcode || '').toLowerCase().includes(q);
      if (!matchesName && !matchesBarcode) return false;
    }
    if (imageFilterWarehouse !== 'all') {
      if ((it.warehouseName || 'المستودع الرئيسي للصالات') !== imageFilterWarehouse) return false;
    }
    if (imageFilterCategory !== 'all') {
      if (it.category !== imageFilterCategory) return false;
    }
    if (imageShowLastInvoiceOnly) {
      if (latestInvoiceNum !== '' && (it as any).invoiceNumber !== latestInvoiceNum) return false;
    }
    return true;
  });

  return (
    <div 
      id="jam-app-container-pro" 
      className={`min-h-screen text-right transition-colors duration-300 font-sans ${
        themeMode === 'dark' ? 'bg-[#070708] text-gray-100' : 'bg-[#faf9f5] text-stone-900 border-none'
      }`}
      style={{ direction: 'rtl' }}
    >
      <style>{`
        /* Royal Gold Accent Layout styles */
        .color-gold-gradient {
          color: #fbbf24;
        }
        .bg-royal-card {
          background-color: ${themeMode === 'dark' ? '#0d0d0f' : '#ffffff'};
          border: 1px solid ${themeMode === 'dark' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(180, 83, 9, 0.1)'};
          box-shadow: ${themeMode === 'dark' ? 'none' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)'};
        }
        .royal-border {
          border-color: ${themeMode === 'dark' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(180, 83, 9, 0.2)'};
        }
        .royal-header {
          background: ${themeMode === 'dark' ? 'linear-gradient(135deg, #111113 0%, #070708 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f6f5ef 100%)'};
          border-bottom: 2px solid ${themeMode === 'dark' ? '#fbbf24' : '#b45309'};
        }
        .royal-btn-gold {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #000000;
          font-weight: 900;
        }
        .royal-btn-gold:hover {
          opacity: 0.95;
        }
        /* Hide scrollbars elegantly */
        .hide-scroll::-webkit-scrollbar {
          display: none;
        }
        .hide-scroll {
          -ms-overflow-style: none; 
          scrollbar-width: none;
        }
      `}</style>

      {/* --- PREMIUM STYLISH ROYAL HEADER (COMPACT & DENSE) --- */}
      <header className="royal-header sticky top-0 z-40 py-2.5 px-4 sm:px-6 shadow-md transition-all duration-300">
        <div className="w-full max-w-[1920px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-[#fbbf24] flex items-center justify-center shadow-md shadow-amber-500/10 shrink-0">
                <Package className="w-5 h-5 text-black" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-base sm:text-lg font-black text-amber-500 tracking-wide">نظام المخزون المتكامل - JAM PRO</h1>
                  <span className="text-[9px] bg-amber-500/20 text-yellow-500 px-1.5 py-0.5 rounded font-mono font-black border border-[#fbbf24]/10">CORE V4.0</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium">إدارة المعروضات الذكية، ترحيل الفواتير، معايرة الباركود ومقاسات السلع</p>
              </div>
            </div>

            <div className="sm:hidden flex items-center gap-1.5">
              <button
                id="theme-toggler-btn-mobile"
                onClick={() => handleToggleTheme()}
                className="p-1.5 rounded-lg border border-amber-500/20 bg-royal-card text-amber-400 font-bold"
              >
                {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-yellow-900" />}
              </button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            
            {/* Hidden elements to maintain E2E and script integrations without disrupting clean unified UI */}
            <div className="hidden">
              <button id="btn-switch-lux-dashboard" onClick={() => setActiveTab('lux_dashboard')}></button>
              <button id="btn-switch-injected-sandbox" onClick={() => setActiveTab('injected_sandbox')}></button>
            </div>

            <button
              onClick={() => setIsGlobalWarrantyModalOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-amber-500/20 bg-royal-card hover:border-amber-500/40 text-amber-500 hover:text-amber-400 transition-all font-black text-xs flex items-center gap-1 cursor-pointer"
              title="تحديد سياسة الضمان العامة للأصناف"
            >
              🛡️ الضمان
            </button>

            <button
              id="theme-toggler-btn"
              onClick={() => handleToggleTheme()}
              className="p-2 rounded-xl border border-amber-500/20 bg-royal-card hover:border-amber-500/40 transition-all font-bold cursor-pointer"
              title="اضغط لتحويل المظهر ليلي / نهاري"
            >
              {themeMode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-yellow-900" />}
            </button>

          </div>

        </div>
      </header>

      {/* --- STATUS FLASH ALERT LOG --- */}
      {statusMessage && (
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 mt-2.5 animate-fade-in">
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold shadow-md ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
              : statusMessage.type === 'warning'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-pulse shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="opacity-65 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'lux_dashboard' ? (
        <main className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 mt-3 sm:mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 pb-12 animate-fade-in">

          {/* ================= RIGHT COLUMN: QUICK SUMMARY STATS & WAREHOUSES ================= */}
          <section className="lg:col-span-4 space-y-3 sm:space-y-4">

            {/* Hidden legacy triggers to preserve E2E integration and automation scripts */}
            <div className="hidden">
              <button id="btn-pricing-retail" onClick={() => { setPricingMode('retail'); triggerStatus('success', 'تم التحويل إلى نمط بيع المفرد والتجزئة للمخزن.'); }}></button>
              <button id="btn-pricing-wholesale" onClick={() => { setPricingMode('wholesale'); triggerStatus('success', 'تم تفعيل نمط البيع بالجملة لكامل كتالوج السلع.'); }}></button>
              <button id="btn-maintenance-fix-prices" onClick={handleFixPricingEngine}></button>
              <button id="btn-maintenance-audit" onClick={handleAuditEngine}></button>
              <button id="btn-alternatives-trigger" onClick={handleAlternativesManagement}></button>
            </div>

            {/* Quick General Stats Card */}
            <div className="bg-royal-card p-3.5 sm:p-4 rounded-2xl transition-all bg-gradient-to-br from-amber-500/[0.02] to-transparent">
              <h2 className="text-xs sm:text-sm font-black text-amber-500 border-b border-amber-500/10 pb-2 mb-2.5 flex items-center justify-between">
                <span>📊 إحصائيات المخزون الجارية</span>
                <span className="text-[9px] bg-amber-500/20 text-yellow-500 px-1.5 py-0.5 rounded font-bold font-mono">JAM CORE</span>
              </h2>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex flex-col justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-gray-400 text-[11px] font-bold">الأصناف الفريدة:</span>
                  <span className="font-mono text-xs font-black text-white mt-1">{items.length} صنف</span>
                </div>
                <div className="flex flex-col justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-gray-400 text-[11px] font-bold">القطع بالمخازن:</span>
                  <span className="font-mono text-xs font-black text-amber-500 mt-1">
                    {items.reduce((acc, it) => acc + (it.stock || 0), 0)} قطعة
                  </span>
                </div>
                <div className="flex flex-col justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-gray-400 text-[11px] font-bold">الأصول بالتكلفة:</span>
                  <span className="font-mono text-xs font-black text-gray-300 mt-1 truncate">
                    {items.reduce((acc, it) => acc + ((it.stock || 0) * (it.cost || 0)), 0).toLocaleString()} ر.ي
                  </span>
                </div>
                <div className="flex flex-col justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-gray-400 text-[11px] font-bold">الأصول بسعر البيع:</span>
                  <span className="font-mono text-xs font-black text-emerald-400 font-bold mt-1 truncate">
                    {items.reduce((acc, it) => acc + ((it.stock || 0) * (it.price || 0)), 0).toLocaleString()} ر.ي
                  </span>
                </div>
              </div>
            </div>

            {/* Warehouse Cards dynamic block */}
            <div className="bg-royal-card p-3.5 sm:p-4 rounded-2xl transition-all">
              <h2 className="text-xs sm:text-sm font-black text-amber-500 border-b border-amber-500/10 pb-2 mb-2.5 flex items-center justify-between">
                <span>🏢 رصيد وجرد المستودعات والفروع</span>
                <span className="text-emerald-500 text-[9px] font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full">نشط</span>
              </h2>
              
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {warehousesList.map((w, index) => (
                  <div 
                    key={index} 
                    className="p-2 sm:p-2.5 border border-amber-500/15 rounded-xl bg-white/[0.02] flex justify-between items-center hover:bg-white/[0.04] transition-all"
                  >
                    <div>
                      <h4 className="text-xs font-black text-white">{w.name}</h4>
                      <span className="text-[9px] text-gray-400">مجموع السلع بالفرع</span>
                    </div>
                    <span className="font-mono text-xs font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                      {w.count} أصناف
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </section>

          {/* ================= LEFT COLUMN: CATALOGUE FILTER & INVENTORY LIST (8 COLS) ================= */}
          <section className="lg:col-span-8 space-y-6 animate-fade-in">

            {/* --- CORE USER DIRECTIVE: TASK ACTION BUTTONS BAR --- */}
            <div className="bg-royal-card p-6 rounded-3xl border-2 border-amber-500/35 shadow-xl transition-all relative overflow-hidden bg-gradient-to-br from-amber-500/[0.03] to-transparent">
              <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 border-b border-amber-500/10 pb-3">
                <div>
                  <h3 className="text-base font-black text-amber-500 flex items-center gap-2">
                    <span className="p-1 px-2 bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold font-mono">JAM CONTROL</span>
                    <span>شريط العمليات والمميزات السريعة للمخازن ⚙️</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">اضغط على أي زر لتنفيذ المهمة الفورية لإدارة الفروع ومستودعات السلع بيسر وسهولة بضغطة واحدة</p>
                </div>
                <span className="text-[10px] bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20 px-2 py-0.5 rounded-full font-bold">نشط بالكامل</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {/* 1. Add item */}
                <button
                  type="button"
                  id="btn-action-wh-add-item"
                  onClick={() => setIsExcelGridOpen(true)}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-amber-500/20 hover:border-amber-500/50 rounded-2xl transition-all text-center group flex flex-col justify-between h-24 shadow-md text-white select-none relative cursor-pointer"
                >
                  <div className="text-center w-full text-lg">➕</div>
                  <div className="mt-1">
                    <div className="text-xs font-black text-amber-500">إضافة صنف</div>
                    <div className="text-[9px] text-gray-400 truncate">تنزيل وإدخال سلعة</div>
                  </div>
                </button>

                {/* 1.5 Quick Quantity Entry */}
                <button
                  type="button"
                  id="btn-action-wh-quick-qty"
                  onClick={() => {
                    if (items.length === 0) {
                      triggerStatus('warning', 'لا توجد منتجات متوفرة حالياً لإضافة كمية لها.');
                      return;
                    }
                    setQuickQtyProductId(items[0]?.id || '');
                    setQuickQtyWarehouse(items[0]?.warehouseName || 'المستودع الرئيسي للصالات');
                    setIsQuickQtyModalOpen(true);
                  }}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-emerald-500/20 hover:border-emerald-550 rounded-2xl transition-all text-center group flex flex-col justify-between h-24 shadow-md text-white select-none relative cursor-pointer"
                >
                  <div className="text-center w-full text-lg relative">
                    ⚡
                    <span className="absolute -top-1 right-2 bg-emerald-500 text-slate-950 text-[8px] font-black px-1 rounded-sm">سريع</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-xs font-black text-emerald-400">توريد سريع كمية</div>
                    <div className="text-[9px] text-gray-400 truncate">تغذية كمية وتكلفة سريعة</div>
                  </div>
                </button>

                {/* 2. Add Warehouse */}
                <button
                  type="button"
                  id="btn-action-wh-add"
                  onClick={() => {
                    setNewWhName('');
                    setIsAddWarehouseModalOpen(true);
                  }}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-amber-500/20 hover:border-amber-500/50 rounded-2xl transition-all text-center group flex flex-col justify-between h-24 shadow-md text-white select-none relative cursor-pointer"
                >
                  <div className="text-center w-full text-lg">🏢</div>
                  <div className="mt-1">
                    <div className="text-xs font-black text-sky-400">إضافة مستودع</div>
                    <div className="text-[9px] text-gray-400 truncate">تأسيس فرع تخزين</div>
                  </div>
                </button>

                {/* 2.5 Manage Categories */}
                <button
                  type="button"
                  id="btn-action-categories-manage"
                  onClick={() => {
                    setNewCategoryName('');
                    setNewCategoryWarehouse(dbWarehouses[0] || 'المستودع الرئيسي للصالات');
                    setIsCategoryMappingModalOpen(true);
                  }}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-[#d4af37]/20 hover:border-[#d4af37]/55 rounded-2xl transition-all text-center group flex flex-col justify-between h-24 shadow-md text-white select-none relative cursor-pointer"
                >
                  <div className="text-center w-full text-lg">🏷️</div>
                  <div className="mt-1">
                    <div className="text-xs font-black text-[#d4af37]">إدارة الأقسام والربط</div>
                    <div className="text-[9px] text-gray-400 truncate">ربط الفئات بالمخازن</div>
                  </div>
                </button>

                {/* 3. Transfer stocks */}
                <button
                  type="button"
                  id="btn-action-wh-transfer"
                  onClick={() => {
                    if (items.length === 0) {
                      triggerStatus('warning', 'لا توجد منتجات متوفرة حالياً لإجراء عملية تحويل مخازن.');
                      return;
                    }
                    setTransferProductId(items[0]?.id || '');
                    setIsTransferModalOpen(true);
                  }}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-amber-500/20 hover:border-amber-500/50 rounded-2xl transition-all text-center group flex flex-col justify-between h-24 shadow-md text-white select-none relative cursor-pointer"
                >
                  <div className="text-center w-full text-lg">🔄</div>
                  <div className="mt-1">
                    <div className="text-xs font-black text-[#fbbf24]">تحويل كلي</div>
                    <div className="text-[9px] text-gray-400 truncate">نقل شحنات لفرع آخر</div>
                  </div>
                </button>

                {/* 4. Inventory Audit */}
                <button
                  type="button"
                  id="btn-action-wh-audit"
                  onClick={() => {
                    setAuditAdjustments({});
                    setIsAuditModalOpen(true);
                  }}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-amber-500/20 hover:border-amber-500/50 rounded-2xl transition-all text-center group flex flex-col justify-between h-24 shadow-md text-white select-none relative cursor-pointer"
                >
                  <div className="text-center w-full text-lg">📋</div>
                  <div className="mt-1">
                    <div className="text-xs font-black text-emerald-400">جرد المخازن</div>
                    <div className="text-[9px] text-gray-400 truncate">مطابقة البضاعة فعلياً</div>
                  </div>
                </button>

                {/* 5. Barcodes */}
                <button
                  type="button"
                  id="btn-action-wh-barcode"
                  onClick={() => {
                    if (items.length === 0) {
                      triggerStatus('warning', 'لا توجد منتجات متوفرة حالياً لتوليد ملصقات باركود.');
                      return;
                    }
                    setBarcodeTargetProductId(items[0]?.id || '');
                    setIsBarcodeModalOpen(true);
                  }}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-amber-500/20 hover:border-amber-500/50 rounded-2xl transition-all text-center group flex flex-col justify-between h-24 shadow-md text-white select-none relative cursor-pointer"
                >
                  <div className="text-center w-full text-lg">🖨️</div>
                  <div className="mt-1">
                    <div className="text-xs font-black text-indigo-400">طباعة الباركود</div>
                    <div className="text-[9px] text-gray-400 truncate">توليد وطباعة الملصقات</div>
                  </div>
                </button>

                {/* 6. Edit Images */}
                <button
                  type="button"
                  id="btn-action-wh-images"
                  onClick={() => {
                    if (items.length === 0) {
                      triggerStatus('warning', 'لا توجد منتجات متوفرة حالياً لإدراج صور لها.');
                      return;
                    }
                    setImgTargetProductId(items[0]?.id || '');
                    setProductImgUrl(items[0]?.imageUrl || '');
                    setIsAddImagesModalOpen(true);
                  }}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-amber-500/20 hover:border-amber-500/50 rounded-2xl transition-all text-center group flex flex-col justify-between h-24 shadow-md text-white select-none relative cursor-pointer"
                >
                  <div className="text-center w-full text-lg">📷</div>
                  <div className="mt-1">
                    <div className="text-xs font-black text-fuchsia-400">إضافة صور</div>
                    <div className="text-[9px] text-gray-400 truncate">تحديث معارض المنتج</div>
                  </div>
                </button>

                {/* 7. Owner Gate Settings */}
                <button
                  type="button"
                  id="btn-action-wh-owner-gate"
                  onClick={() => setIsOwnerGateModalOpen(true)}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-amber-500/20 hover:border-amber-500/50 rounded-2xl transition-all text-center group flex flex-col justify-between h-24 shadow-md text-white select-none relative cursor-pointer"
                >
                  <div className="text-center w-full text-lg">⚙️</div>
                  <div className="mt-1">
                    <div className="text-xs font-black text-amber-500">صيانة وصلاحيات</div>
                    <div className="text-[9px] text-gray-400 truncate">بوابة المالك والأسعار</div>
                  </div>
                </button>

                {/* 8. Tiered Pricing Section */}
                <button
                  type="button"
                  id="btn-action-wh-tiered-pricing"
                  onClick={() => setShowTieredPricing(prev => !prev)}
                  className={`p-3 rounded-2xl transition-all text-center group flex flex-col justify-between h-24 shadow-md select-none relative cursor-pointer border ${
                    showTieredPricing
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 border-amber-500/20 hover:border-amber-500/50 text-white'
                  }`}
                >
                  <div className="text-center w-full text-lg">💎</div>
                  <div className="mt-1">
                    <div className="text-xs font-black text-amber-400">تسعير الفئات</div>
                    <div className="text-[9px] text-gray-400 truncate">مستورد وجملة وتجزئة</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Control Filters Tab Box */}
            <div className="bg-royal-card p-5 rounded-2xl">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                
                {/* Scrollable Categories List */}
                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto py-1 scrollbar-none hide-scroll">
                  <button
                    id="btn-category-all"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      selectedCategory === 'all'
                        ? 'royal-btn-gold text-black shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-gray-400'
                    }`}
                  >
                    الكل ({items.length})
                  </button>
                  {categories.map((cat, idx) => {
                    const count = items.filter(it => it.category === cat).length;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                          selectedCategory === cat
                            ? 'royal-btn-gold text-black shadow-md'
                            : 'bg-white/5 hover:bg-white/10 text-gray-400'
                        }`}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Clear Primary Addition Button */}
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-center">
                  <UniversalReportButton
                    variant="emerald"
                    buttonText="تقرير المخزون"
                    payload={{
                      title: 'تقرير المخزون العام والسلع',
                      subtitle: selectedCategory !== 'all' ? `الأصناف المفلترة حسب قسم: ${selectedCategory}` : 'كشف تفصيلي بحركة وكميات وأسعار جميع البضائع بالمخازن',
                      currency: 'ر.ي',
                      summaryCards: [
                        { label: 'إجمالي عدد الأصناف', value: items.length, currency: 'صنف', color: 'blue' },
                        { label: 'إجمالي قطع المخزون', value: items.reduce((acc, it) => acc + (Number(it.stock) || 0), 0), currency: 'قطعة', color: 'green' },
                        { label: 'إجمالي قيمة التكلفة', value: items.reduce((acc, it) => acc + ((Number(it.stock) || 0) * (Number(it.cost || it.lastBuyPrice) || 0)), 0).toLocaleString(), currency: 'ر.ي', color: 'amber' },
                        { label: 'القيمة البيعية المتوقعة', value: items.reduce((acc, it) => acc + ((Number(it.stock) || 0) * (Number(it.price) || 0)), 0).toLocaleString(), currency: 'ر.ي', color: 'purple' }
                      ],
                      columns: [
                        { key: 'name', header: 'اسم الصنف والمواصفات', type: 'text', width: 25 },
                        { key: 'category', header: 'القسم / الفئة', type: 'text', width: 15 },
                        { key: 'barcode', header: 'الباركود / الرمز', type: 'text', width: 15 },
                        { key: 'stock', header: 'الكمية المتوفرة', type: 'number', width: 12 },
                        { key: 'minStock', header: 'حد الطلب الأدنى', type: 'number', width: 12 },
                        { key: 'cost', header: 'سعر التكلفة', type: 'currency', width: 14, formatter: (val, row) => row.cost || row.lastBuyPrice || 0 },
                        { key: 'price', header: 'سعر بيع التجزئة', type: 'currency', width: 14 },
                        { key: 'wholesalePrice', header: 'سعر الجملة', type: 'currency', width: 14 }
                      ],
                      data: filteredItems()
                    }}
                  />
                  <button
                    id="btn-inventory-add-init"
                    onClick={() => setIsExcelGridOpen(true)}
                    className="px-6 py-2.5 bg-gradient-to-l from-amber-500 to-[#fbbf24] hover:opacity-95 text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-black stroke-[3]" />
                    <span>إضافة صنف جديد</span>
                  </button>
                </div>

              </div>

              {/* Comprehensive Search Selector Inputs */}
              <div className="relative mt-4">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  id="input-catalog-main-search"
                  type="text"
                  placeholder="ابحث بالاسم، الباركود المانع، كود الرمز، بدائل المنتجات، التوافقات والتطبيقات للأصناف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#121316] text-white border border-white/5 hover:border-white/10 focus:border-amber-500 rounded-xl py-3 pr-10 pl-20 text-xs font-medium focus:outline-none transition-all"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-white transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => setShowScanner(true)} 
                    type="button"
                    className="text-amber-500 hover:text-amber-400 transition-colors p-1.5 rounded-md hover:bg-white/5 flex items-center justify-center"
                    title="مسح الباركود باستخدام الكاميرا"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {showScanner && (
                <BarcodeScanner
                  onScan={(decodedText) => {
                    setSearchTerm(decodedText);
                    setShowScanner(false);
                  }}
                  onClose={() => setShowScanner(false)}
                />
              )}
            </div>

            {/* Bulk Actions Floating Dashboard */}
            {selectedIds.length > 0 && (
              <div className="bg-gradient-to-l from-amber-950/40 to-yellow-950/30 border border-amber-500/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 mb-4 shadow-xl animate-fade-in" dir="rtl">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center bg-amber-500 text-black font-black w-6 h-6 rounded-full text-xs animate-bounce">
                    {selectedIds.length}
                  </span>
                  <span className="text-xs font-bold text-gray-200">سلعة محددة لإجراء عمليات جماعية:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Bulk Price Update Button */}
                  <button
                    onClick={() => setIsPriceUpdateModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sliders size={13} />
                    <span>تحديث الأسعار جماعياً ⚡</span>
                  </button>

                  {/* Bulk Promote Button */}
                  <button
                    onClick={() => {
                      setPromoteForm({
                        target: 'store',
                        price: 0,
                        title: `عرض ترويجي لـ ${selectedIds.length} منتج`,
                        description: 'تخفيضات وعروض خاصة ومباشرة من متجرنا لزبائننا الأوفياء!',
                        imageUrl: ''
                      });
                      setIsPromoteModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <TrendingUp size={13} />
                    <span>ترويج جماعي للزبائن 📢</span>
                  </button>

                  {/* Bulk Publish/Unpublish Button */}
                  <button
                    onClick={async () => {
                      if (!confirm(`هل أنت متأكد من تغيير حالة النشر في سوق الجملة لـ ${selectedIds.length} منتج محدد دفعة واحدة؟`)) return;
                      setIsProcessing(true);
                      try {
                        let publishedCount = 0;
                        for (const sId of selectedIds) {
                          const item = items.find(it => it.id === sId);
                          if (item) {
                            await handleToggleMarketPublish(item);
                            publishedCount++;
                          }
                        }
                        triggerStatus('success', `✓ تم بنجاح معالجة وتعديل حالة نشر ${publishedCount} منتج في سوق الموردين.`);
                        setSelectedIds([]);
                      } catch (err: any) {
                        triggerStatus('error', 'خطأ أثناء النشر الجماعي: ' + err.message);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles size={13} />
                    <span>نشر جماعي في السوق 🛜</span>
                  </button>

                  {/* Cancel selection */}
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    إلغاء التحديد ✕
                  </button>
                </div>
              </div>
            )}

            {/* View Mode Switcher: Standard Inventory vs Tiered Pricing Manager */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-1" dir="rtl">
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10 text-xs">
                <button
                  type="button"
                  id="btn-tab-general-catalog"
                  onClick={() => setShowTieredPricing(false)}
                  className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    !showTieredPricing
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md font-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Package size={15} />
                  <span>عرض المخزون العام والكتالوج</span>
                </button>
                <button
                  type="button"
                  id="btn-tab-tiered-pricing"
                  onClick={() => setShowTieredPricing(true)}
                  className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    showTieredPricing
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md font-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Layers size={15} />
                  <span>💎 قسم التسعير حسب الفئات</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                    المرحلة 4
                  </span>
                </button>
              </div>

              {showTieredPricing && (
                <span className="text-xs text-amber-400/90 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>إدارة تسعير الفئات (المستورد • جملة الجملة • الجملة • التجزئة)</span>
                </span>
              )}
            </div>

            {showTieredPricing ? (
              <TieredPricingManager
                items={items as any}
                categories={categories}
                ownerId={currentOwnerId}
                onClose={() => setShowTieredPricing(false)}
              />
            ) : (
              /* Products Interactive Catalog Table Grid */
              <div className="bg-royal-card rounded-2xl overflow-hidden shadow-xl">
              
              <div className="p-4 bg-white/[0.01] border-b border-white/5 flex justify-between items-center text-xs text-gray-400">
                <span className="font-bold text-amber-500">قائمة الأصناف المدرجة حالياً ({filteredItems().length})</span>
                <span>العملة الوطنية المعتمدة: <strong className="text-white">ر.ي</strong></span>
              </div>

              {filteredItems().length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <HelpCircle className="w-12 h-12 text-gray-500 mx-auto" />
                  <p className="text-gray-400 text-xs">لا تتوفر حالياً أي سلع مخزنية تطابق معايير وتصفية البحث الجاري.</p>
                  <button 
                    onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
                    className="text-xs text-amber-500 underline font-bold"
                  >
                    إعادة تصفير خيارات الفرز
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-white/[0.01] border-b border-white/5 text-gray-400 font-bold select-none text-[11px]">
                        <th className="p-4 w-10 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-white/10 bg-neutral-950 text-amber-500 focus:ring-amber-500 focus:ring-opacity-50 w-3.5 h-3.5 cursor-pointer"
                            checked={filteredItems().length > 0 && selectedIds.length === filteredItems().length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(filteredItems().map(it => it.id || '').filter(Boolean));
                              } else {
                                setSelectedIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="p-4 font-bold text-gray-400">اسم الصنف ومعايير الفرقة</th>
                        {!profile?.hideCostPrice && <th className="p-4 text-center">التكلفة</th>}
                        <th className="p-4 text-center">
                          {pricingMode === 'retail' ? 'المفرد (التجزئة)' : 'سعر الجملة'}
                        </th>
                        <th className="p-4 text-center">الرصيد المتاح</th>
                        <th className="p-4 text-center">التطبيقات والبدائل</th>
                        <th className="p-4 text-center text-amber-500">العرض في السوق</th>
                        <th className="p-4 text-left">خصائص السلعة</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/[0.03]">
                      {filteredItems().map((item) => {
                        const showPrice = pricingMode === 'retail' ? item.price : item.wholesalePrice;
                        const isStockLow = item.stock <= 3;
                        const markupProfit = showPrice - item.cost;
                        const markupPct = item.cost > 0 ? Math.round((markupProfit / item.cost) * 100) : 0;

                        return (
                          <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                            
                            {/* Checkbox cell */}
                            <td className="p-4 text-center w-10">
                              <input
                                type="checkbox"
                                className="rounded border-white/10 bg-neutral-950 text-amber-500 focus:ring-amber-500 focus:ring-opacity-50 w-3.5 h-3.5 cursor-pointer"
                                checked={selectedIds.includes(item.id || '')}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedIds(prev => [...prev, item.id || ''].filter(Boolean));
                                  } else {
                                    setSelectedIds(prev => prev.filter(id => id !== item.id));
                                  }
                                }}
                              />
                            </td>

                            {/* Product Basic Meta */}
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  <img 
                                    src={item.imageUrl} 
                                    alt={item.name} 
                                    className="w-10 h-10 object-cover rounded-xl border border-amber-500/20 bg-neutral-900 shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 text-amber-500/60 font-black font-mono">
                                    📦
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-white text-sm tracking-wide group-hover:text-amber-500 transition-colors">
                                    {item.name}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 px-0.5 text-[10px] text-gray-400">
                                    <span className="bg-white/5 px-1.5 py-0.5 rounded font-mono font-bold tracking-tight text-white">{item.barcode}</span>
                                    <span>•</span>
                                    <span className="text-amber-400 bg-amber-500/10 px-1 rounded font-bold">{item.category}</span>
                                    <span>•</span>
                                    <span>{item.unit || 'حبة'}</span>
                                    <span>•</span>
                                    <span className="text-gray-300 font-sans text-[10px] font-bold">{item.size}</span>
                                    <span>•</span>
                                    <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-black text-[9px] border border-emerald-500/20">{item.warehouseName || 'المستودع الرئيسي للصالات'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Cost Price */}
                            {!profile?.hideCostPrice && (
                              <td className="p-4 text-center font-mono font-bold text-gray-300">
                                {item.cost?.toLocaleString()} ر.ي
                              </td>
                            )}

                            {/* Retail Selling Price */}
                            <td className="p-4 text-center">
                              <div className="font-mono font-bold text-amber-500 text-sm">
                                {showPrice?.toLocaleString()} ر.ي
                              </div>
                              {!profile?.hideNetProfit && !profile?.hideCostPrice && (
                                <div className="text-[9px] text-emerald-400 font-bold mt-0.5">
                                  ربح المتجر +{markupPct}%
                                </div>
                              )}
                            </td>

                            {/* Stock quantities Status */}
                            <td className="p-4 text-center">
                              <div className={`inline-block px-3 py-1 rounded-full font-mono font-black text-xs ${
                                isStockLow 
                                  ? 'bg-rose-500/10 text-rose-400 animate-pulse' 
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {item.stock} {item.unit}
                              </div>
                              {item.stock <= 0 && (
                                <div className="text-[9px] text-rose-400 font-bold mt-1">نافذ ومطلوب للطلب</div>
                              )}
                            </td>

                            {/* Compatibilities / Alternatives description */}
                            <td className="p-4 max-w-[180px]">
                              {item.compatibilities && (
                                <div className="text-[10px] text-gray-400 line-clamp-1 truncate bg-white/5 p-1 rounded border border-white/5">
                                  <strong>يتوافق:</strong> {item.compatibilities}
                                </div>
                              )}
                              {item.alternatives && (
                                <div className="text-[10px] text-amber-400 line-clamp-1 truncate bg-amber-500/5 p-1 rounded border border-amber-500/5 mt-1">
                                  <strong>بديل:</strong> {item.alternatives}
                                </div>
                              )}
                            </td>

                            {/* Show in Market Toggle switch */}
                            <td className="p-4 text-center">
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                {publishingLoading === item.id ? (
                                  <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                                ) : item.status === 'published_in_market' ? (
                                  <button 
                                    onClick={() => handleToggleMarketPublish(item)}
                                    className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] hover:bg-emerald-500/20 transition-all font-bold cursor-pointer"
                                    title="انقر لسحب المنتج من السوق وإلغاء عرضه"
                                  >
                                    <Globe size={11} className="text-emerald-400 shrink-0" />
                                    <span>معروض بالسوق 🟢</span>
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleToggleMarketPublish(item)}
                                    className="flex items-center gap-1 bg-white/5 text-gray-400 border border-white/5 px-2.5 py-1 rounded-full text-[10px] hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/20 transition-all font-bold cursor-pointer"
                                    title="انقر لنشر وعرض هذا المنتج في السوق الرقمي الموحد فوراً دون فواتير"
                                  >
                                    <Globe size={11} className="text-gray-500 shrink-0" />
                                    <span>نشر في السوق 🛜</span>
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Controls actions */}
                            <td className="p-4 text-left">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedIds([item.id || '']);
                                    setPromoteForm({
                                      target: 'store',
                                      title: item.name,
                                      description: 'عرض ترويجي خاص وحصري لزبائننا الكرام على هذا المنتج المميز!',
                                      price: item.price,
                                      imageUrl: item.imageUrl || ''
                                    });
                                    setIsPromoteModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/5 hover:scale-105 active:scale-95 cursor-pointer"
                                  title="ترويج ونشر هذا الصنف للزبائن"
                                >
                                  <TrendingUp className="w-4 h-4" />
                                  <span>ترويج 📢</span>
                                </button>
                                <button
                                  onClick={() => handleOpenFormModal(item)}
                                  className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/5 hover:scale-105 active:scale-95 cursor-pointer"
                                  title="تعديل بيانات الصنف"
                                >
                                  <Edit className="w-4 h-4" />
                                  <span>تعديل الصنف</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id!, item.name)}
                                  className="p-2 rounded-xl border border-rose-500/10 bg-rose-500/5 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                                  title="حذف الصنف كلياً"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Strict Pagination Framework & Lazy Loading controls */}
                  {filteredItems().length >= visibleLimit && (
                    <div className="p-4 flex justify-center border-t border-white/[0.03] bg-black/10">
                      <button
                        id="btn-load-more-inventory"
                        onClick={() => setVisibleLimit(prev => prev + 20)}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 hover:text-amber-400 font-bold text-xs border border-amber-500/20 transition-all cursor-pointer"
                      >
                        🔄 عرض المزيد من الأصناف (أوفلاين/أونلاين)
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
            )}

          </section>

      </main>
      ) : (
        /* ================= INJECTED RAW SANDBOX VIEW v4.0 ================= */
        <div className="p-4 sm:p-8 w-full max-w-[1920px] mx-auto space-y-6 animate-fade-in text-right">
          
          <div 
            id="inventory-module" 
            className="bg-[#0a0a0a] text-[#fbbf24] p-8 border-2 border-[#fbbf24] rounded-3xl space-y-6 text-right shadow-2xl"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            <div className="flex justify-between items-center border-b border-[#fbbf24]/20 pb-4">
              <h1 className="text-3xl font-black">Inventory Core 4.0</h1>
              <span className="text-gray-400 text-xs font-mono">JAM CORE SYSTEM</span>
            </div>
            
            <div id="owner-panel" className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#fbbf24]/20 space-y-3">
              <h3 className="text-lg font-bold text-white">Owner Controls (Multi-Image Gate)</h3>
              <p className="text-xs text-gray-400">بوابة المالك لتغيير صلاحية رفع الصور المتعددة وتعديل فروع SHOP_01</p>
              <button 
                id="btn-legacy-owner-toggle"
                onClick={() => (window as any).InventoryModule.Actions.ownerSettings('SHOP_01', !multiImageAllowed)}
                className="bg-[#fbbf24] text-black hover:bg-amber-400 transition-colors font-black px-5 py-3 rounded-xl text-xs"
              >
                Toggle Multi-Image Permission (تغيير صلاحية الصور لـ SHOP_01)
              </button>
            </div>

            <div id="actions-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => (window as any).InventoryModule.Actions.runTransfer('FULL_WAREHOUSE')}
                className="bg-zinc-900 border border-zinc-800 text-[#fbbf24] p-5 rounded-2xl hover:bg-[#fbbf24]/10 transition-all font-bold text-sm text-right flex items-center justify-between"
              >
                <span>Full Warehouse Transfer</span>
                <Layers className="w-4 h-4 text-amber-500" />
              </button>
              
              <button 
                onClick={() => (window as any).InventoryModule.Actions.runTransfer('LAST_INVOICE')}
                className="bg-zinc-900 border border-zinc-800 text-[#fbbf24] p-5 rounded-2xl hover:bg-[#fbbf24]/10 transition-all font-bold text-sm text-right flex items-center justify-between"
              >
                <span>Last Invoice Transfer</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </button>
              
              <button 
                onClick={() => (window as any).InventoryModule.Actions.printBarcode('LAST_MONTH')}
                className="bg-zinc-900 border border-zinc-800 text-[#fbbf24] p-5 rounded-2xl hover:bg-[#fbbf24]/10 transition-all font-bold text-sm text-right flex items-center justify-between"
              >
                <span>Print Last Month Barcodes</span>
                <Printer className="w-4 h-4 text-indigo-400" />
              </button>
              
              <button 
                onClick={handleFixPricingEngine}
                className="bg-zinc-900 border border-zinc-800 text-[#fbbf24] p-5 rounded-2xl hover:bg-[#fbbf24]/10 transition-all font-bold text-sm text-right flex items-center justify-between"
              >
                <span>Fix Pricing Errors</span>
                <Sliders className="w-4 h-4 text-rose-400" />
              </button>
            </div>

            <div className="pt-4 border-t border-[#fbbf24]/10 flex justify-between items-center text-[10px] text-gray-500 font-mono">
              <span>JAM SYSTEM PRO • AGENT ENGINE 4.0</span>
              <span className="text-emerald-500 font-bold">✅ RUNNING</span>
            </div>
          </div>

          {/* Dynamic UI Builder Box (from initInventoryPage & renderWarehouseCards) */}
          <div className="bg-card-lux p-6 rounded-3xl border border-amber-500/10 space-y-4">
            <h3 className="text-sm font-black text-amber-500">مشاهد ومحاكاة المستودعات من محرك InventoryEngine</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="warehouse-cards-container">
              {warehousesList.map((wh, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-xl border border-[#fbbf24] bg-neutral-900 text-[#fbbf24] flex flex-col justify-between space-y-2 cursor-pointer hover:scale-[1.01] transition-transform"
                  onClick={() => (window as any).InventoryEngine.openModal('جرد مخزن')}
                >
                  <h4 className="font-bold text-white">{wh.name}</h4>
                  <p className="text-xs text-amber-400">عدد أصناف السلع: {wh.count}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => (window as any).InventoryEngine.openModal('إدارة الصور')}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white border border-white/5"
              >
                📷 فتح نافذة إدارة الصور
              </button>
              <button 
                onClick={() => (window as any).InventoryEngine.openModal('توليد باركود')}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white border border-white/5"
              >
                🖨️ فتح نافذة توليد الباركود
              </button>
              <button 
                onClick={() => (window as any).InventoryEngine.openModal('جرد مخزن')}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white border border-white/5"
              >
                📋 فتح وحدة جرد المخازن
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ================= MODAL: BARCODE GENERATOR AND COPIES PRINTING ================= */}
      {isBarcodeModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] z-50 flex items-center justify-center p-4" style={{ direction: 'rtl' }}>
          <div className="w-full max-w-xl bg-royal-card rounded-3xl border border-amber-500/30 overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="p-6 border-b border-amber-500/15 flex justify-between items-center bg-gradient-to-l from-amber-500/5 to-transparent">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-amber-500">
                  🖨️ طباعة ملصقات الباركود للمخزن
                </h3>
              </div>
              <button 
                onClick={() => setIsBarcodeModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-400">
                يمكنك توليد ملصقات باركود مجهزة مباشرة بالأسعار لكل قطعة من الأصناف المدرجة وبأي كمية نسخ ترغب بها:
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  id="btn-barcode-invoice-m"
                  onClick={() => { printBarcode('LAST_INVOICE'); setIsBarcodeModalOpen(false); }}
                  className="p-4 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-2xl text-center text-white font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-xs cursor-pointer"
                >
                  <FileCheck className="w-5 h-5 text-amber-400" />
                  <span className="font-sans">باركود آخر فاتورة مبيعات</span>
                  <span className="text-[9px] text-gray-500 font-normal">توليد ملصقات لآخر صفقة فورياً</span>
                </button>

                <button
                  id="btn-barcode-month-m"
                  onClick={() => { printBarcode('LAST_MONTH'); setIsBarcodeModalOpen(false); }}
                  className="p-4 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-2xl text-center text-white font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-xs cursor-pointer"
                >
                  <Briefcase className="w-5 h-5 text-indigo-400" />
                  <span className="font-sans">سجلات باركود الشهر الجاري</span>
                  <span className="text-[9px] text-gray-500 font-normal">طباعة كافة ملصقات سلع الشهر</span>
                </button>
              </div>

              <div className="pt-3 border-t border-white/5 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">حدد الصنف لتوليد ملصق مخصص له *</label>
                  <select 
                    value={barcodeTargetProductId}
                    onChange={(e) => setBarcodeTargetProductId(e.target.value)}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">-- اضغط لتحديد صنف من الكتالوج المتوفر --</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} [{it.barcode}] ({it.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">كمية النسخ المطلوبة للطباعة *</label>
                  <input 
                    type="number"
                    min="1"
                    max="150"
                    value={barcodeQty}
                    onChange={(e) => setBarcodeQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                    required
                  />
                </div>

                <button
                  id="btn-barcode-execute-labels-m"
                  onClick={() => { 
                    if (!barcodeTargetProductId) {
                      triggerStatus('error', 'يرجى اختيار الصنف أولاً للطباعة.');
                      return;
                    }
                    printBarcode('SPECIFIC_COUNT', barcodeTargetProductId);
                    setIsBarcodeModalOpen(false);
                  }}
                  className="w-full py-3 bg-gradient-to-l from-amber-500 to-amber-600 text-black font-black text-xs rounded-xl hover:opacity-95 transition-all cursor-pointer"
                >
                  تأكيد توليد وطباعة ملصقات الصنف المحدد
                </button>
              </div>
            </div>

            <div className="p-4 bg-white/[0.01] border-t border-white/5 flex justify-end">
              <button 
                onClick={() => setIsBarcodeModalOpen(false)}
                className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: QUICK QUANTITY ENTRY ================= */}
      {isQuickQtyModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ direction: 'rtl' }}>
          <div className="w-full max-w-lg bg-zinc-950 rounded-3xl border border-emerald-500/30 overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="p-6 border-b border-emerald-500/15 flex justify-between items-center bg-gradient-to-l from-emerald-500/5 to-transparent">
              <div className="flex items-center gap-2">
                <span className="text-xl animate-pulse">⚡</span>
                <h3 className="text-base font-black text-emerald-400">
                  إدخال وتوريد كمية صنف سريع (تغذية شحنات لمرة واحدة)
                </h3>
              </div>
              <button 
                onClick={() => setIsQuickQtyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/15 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickQtySubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-300 leading-relaxed">
                تُتيح لك هذه الواجهة إضافة كميات فورية إلى الأصناف وتوزيعها على مستودعاتك بسلاسة وسرعة فائقة دون كتابة تفاصيل المنتج كالباركود والضمان ونوع القطعة.
              </div>

              {/* Product selection */}
              <div>
                <label className="block text-xs font-black text-slate-300 mb-2">الأصناف المتاحة في مخازنك *</label>
                <select
                  value={quickQtyProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setQuickQtyProductId(pid);
                    const sel = items.find(it => it.id === pid);
                    if (sel) {
                      setQuickQtyWarehouse(sel.warehouseName || 'المستودع الرئيسي للصالات');
                    }
                  }}
                  className="w-full p-3 bg-zinc-900 border border-slate-850 rounded-xl text-xs font-bold text-white focus:border-emerald-500 outline-none"
                  required
                >
                  <option value="" disabled>-- اختر السلعة من المخزن --</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (المخزون الحالي: {item.stock} {item.unit} | {item.barcode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Added qty */}
              <div>
                <label className="block text-xs font-black text-slate-300 mb-2">الكمية المضافة حديثاً *</label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                  value={quickQtyAdded}
                  onChange={(e) => setQuickQtyAdded(Math.max(1, parseInt(e.target.value) || 0))}
                  placeholder="أدخل عدد الوحدات المضافة"
                  className="w-full p-3 bg-zinc-900 border border-slate-850 rounded-xl text-xs font-bold text-white focus:border-emerald-500 outline-none text-left"
                  required
                />
              </div>

              {/* Warehouse selector */}
              <div>
                <label className="block text-xs font-black text-slate-300 mb-2">مستودع الاستلام والتموين المستهدف *</label>
                <select
                  value={quickQtyWarehouse}
                  onChange={(e) => setQuickQtyWarehouse(e.target.value)}
                  className="w-full p-3 bg-zinc-900 border border-slate-850 rounded-xl text-xs font-bold text-white focus:border-emerald-500 outline-none"
                  required
                >
                  {dbWarehouses.map((wh) => (
                    <option key={wh} value={wh}>{wh}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Cost updates (Optional) */}
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">تعديل سعر التكلفة الجديد (اختياري)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={quickQtyNewCost}
                    onChange={(e) => setQuickQtyNewCost(e.target.value)}
                    placeholder="دون تعديل"
                    className="w-full p-3 bg-zinc-900 border border-slate-850 rounded-xl text-xs font-bold text-white focus:border-emerald-500 outline-none text-left"
                  />
                  <span className="text-[9px] text-gray-500 block mt-1">يترك فارغاً إذا ظلت التكلفة كما هي</span>
                </div>

                {/* Price updates (Optional) */}
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">تعديل سعر المبيع الجديد (اختياري)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={quickQtyNewPrice}
                    onChange={(e) => setQuickQtyNewPrice(e.target.value)}
                    placeholder="دون تعديل"
                    className="w-full p-3 bg-zinc-900 border border-slate-850 rounded-xl text-xs font-bold text-white focus:border-emerald-500 outline-none text-left"
                  />
                  <span className="text-[9px] text-gray-500 block mt-1">يترك فارغاً للاحتفاظ بسعر البيع الحالي</span>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl hover:bg-emerald-400 transition-all cursor-pointer shadow-lg active:scale-95 text-center flex items-center justify-center gap-1"
                >
                  {isProcessing ? 'جاري التوريد...' : '⚡ توريد فوري وإضافة شحنة'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickQtyModalOpen(false)}
                  className="py-3 px-5 bg-white/5 border border-white/10 text-gray-300 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: OWNER SETTINGS & MAINTENANCE GATE ================= */}
      {isOwnerGateModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] z-50 flex items-center justify-center p-4" style={{ direction: 'rtl' }}>
          <div className="w-full max-w-xl bg-royal-card rounded-3xl border border-amber-500/30 overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="p-6 border-b border-amber-500/15 flex justify-between items-center bg-gradient-to-l from-amber-500/5 to-transparent">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-amber-500">
                  ⚙️ إعدادات بوابة المالك وصيانة الفهرس الذكية
                </h3>
              </div>
              <button 
                onClick={() => setIsOwnerGateModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl hover:bg-amber-500/[0.08] transition-all">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="block text-xs font-black text-white">إذن صور المعروضات المتعددة</span>
                    <span className="block text-[10.5px] text-gray-400 mt-0.5">تمكين أو تعطيل إذن رفع صور متعددة للسلع لعملاء المتجر</span>
                  </div>
                  <button
                    id="btn-images-permission-gate-m"
                    type="button"
                    onClick={() => handleToggleMultiImagePermission(!multiImageAllowed)}
                    className="focus:outline-none focus:ring-0 active:scale-95 transition-all cursor-pointer p-1 rounded-lg"
                  >
                    {multiImageAllowed ? (
                      <ToggleRight className="w-10 h-10 text-amber-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 pt-3">
                <span className="block text-xs font-bold text-gray-300">أدوات ومعايرة الفهارس التلقائية:</span>
                
                <button
                  id="btn-maintenance-fix-prices-m"
                  onClick={() => { handleFixPricingEngine(); setIsOwnerGateModalOpen(false); }}
                  className="w-full p-4 bg-zinc-900 border border-white/5 rounded-2xl text-right hover:border-rose-500/30 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="block text-xs font-black text-rose-400">إصلاح وتصحيح انحرافات الأسعار</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">معالجة وتصحيح هوامش الأرباح الضعيفة أو غير المكتملة</span>
                  </div>
                  <Sliders className="w-5 h-5 text-rose-400" />
                </button>

                <button
                  id="btn-maintenance-audit-m"
                  onClick={() => { handleAuditEngine(); setIsOwnerGateModalOpen(false); }}
                  className="w-full p-4 bg-zinc-900 border border-white/5 rounded-2xl text-right hover:border-emerald-500/30 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="block text-xs font-black text-emerald-400">تشغيل تحليل الرصيد وإعداد الجرد</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">احتساب القيمة الدفترية الكلية بسعر التكلفة والبيع</span>
                  </div>
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </button>

                <button
                  id="btn-alternatives-trigger-m"
                  onClick={() => { handleAlternativesManagement(); setIsOwnerGateModalOpen(false); }}
                  className="w-full p-4 bg-zinc-900 border border-white/5 rounded-2xl text-right hover:border-indigo-500/30 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="block text-xs font-black text-indigo-400">محرك بدائل السلع والندرة</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5 font-sans">تجهيز ومقارنة الأصناف المتفوقة والبدائل عند الندرة</span>
                  </div>
                  <Sliders className="w-5 h-5 text-indigo-400" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-white/[0.01] border-t border-white/5 flex justify-end">
              <button 
                onClick={() => setIsOwnerGateModalOpen(false)}
                className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300 cursor-pointer"
              >
                إغلاق البوابة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PROMOTION TARGETED TARGET SPECIFICATION MODAL --- */}
      {isPromoteModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-[4px] z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-lg bg-[#111317] rounded-3xl border border-emerald-500/40 overflow-hidden shadow-2xl shadow-emerald-950/20 animate-fade-in flex flex-col">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-gradient-to-l from-emerald-500/5 to-transparent shrink-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="text-md font-black text-emerald-400 font-sans">ترويج واستهداف البضائع لزبائن المحل والمستهلكين</h3>
              </div>
              <button 
                onClick={() => {
                  setIsPromoteModalOpen(false);
                  setSelectedIds([]);
                }}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePromoteSubmit} className="p-6 space-y-4 text-right overflow-y-auto max-h-[80vh]">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl space-y-1">
                <p className="text-[11px] text-emerald-400 font-bold font-sans">📢 ترويج نشط لعدد ({selectedIds.length}) من المنتجات المحددة</p>
                <p className="text-[10px] text-gray-400 leading-relaxed font-sans">حدد وجهة العرض الترويجي. النظام يضمن عزل كامل للبيانات وتوجيهها حسب القناة المستهدفة.</p>
              </div>

              {/* Target Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-300 font-sans">اختر وجهة الترويج المستهدفة <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-3 gap-3">
                  <div 
                    onClick={() => setPromoteForm(prev => ({ ...prev, target: 'store' }))}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                      promoteForm.target === 'store' 
                        ? 'bg-emerald-500/10 border-emerald-500 text-white font-black' 
                        : 'bg-neutral-900 border-white/5 text-gray-400 hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-xl">🔒</span>
                    <span className="text-[11px] font-black font-sans">متجر زبائنك</span>
                    <span className="text-[8px] text-gray-400 leading-normal font-sans">تطبيق زبائن متجرك الخاص</span>
                  </div>
                  <div 
                    onClick={() => setPromoteForm(prev => ({ ...prev, target: 'auction' }))}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                      promoteForm.target === 'auction' 
                        ? 'bg-emerald-500/10 border-emerald-500 text-white font-black' 
                        : 'bg-neutral-900 border-white/5 text-gray-400 hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-xl">📢</span>
                    <span className="text-[11px] font-black font-sans">الحراج العام</span>
                    <span className="text-[8px] text-gray-400 leading-normal font-sans">عامة مستخدمي التطبيق</span>
                  </div>
                  <div 
                    onClick={() => setPromoteForm(prev => ({ ...prev, target: 'wholesale' }))}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                      promoteForm.target === 'wholesale' 
                        ? 'bg-emerald-500/10 border-emerald-500 text-white font-black' 
                        : 'bg-neutral-900 border-white/5 text-gray-400 hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-xl">🏪</span>
                    <span className="text-[11px] font-black font-sans">سوق الموردين</span>
                    <span className="text-[8px] text-gray-400 leading-normal font-sans">عرض جملة لتجار السوق</span>
                  </div>
                </div>
              </div>

              {/* Details (Shown only for single item) */}
              {selectedIds.length === 1 && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-300 font-sans">عنوان العرض الترويجي</label>
                    <input 
                      type="text" 
                      value={promoteForm.title}
                      onChange={(e) => setPromoteForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="اسم المنتج الترويجي المميز"
                      className="w-full bg-neutral-950 border border-white/5 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-300 font-sans">السعر الترويجي المقترح (ر.ي)</label>
                      <input 
                        type="number" 
                        value={promoteForm.price || ''}
                        onChange={(e) => setPromoteForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                        placeholder="السعر المقترح للتخفيض"
                        className="w-full bg-neutral-950 border border-white/5 p-2.5 rounded-xl text-xs font-mono font-bold text-amber-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-300 font-sans">رابط صورة الصنف</label>
                      <input 
                        type="text" 
                        value={promoteForm.imageUrl}
                        onChange={(e) => setPromoteForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                        placeholder="رابط الصورة المباشر"
                        className="w-full bg-neutral-950 border border-white/5 p-2.5 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-300 font-sans">الوصف أو الملاحظة الترويجية الفورية</label>
                <textarea 
                  value={promoteForm.description}
                  onChange={(e) => setPromoteForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="اكتب عبارات مبيعات ملهمة تجذب الزبائن للتسوق الفوري..."
                  className="w-full bg-neutral-950 border border-white/5 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
                />
              </div>

              <div className="pt-3 border-t border-white/5 flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsPromoteModalOpen(false);
                    setSelectedIds([]);
                  }}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-white/5 rounded-xl text-xs font-bold text-gray-300 transition-colors cursor-pointer font-sans"
                >
                  إلغاء التراجع
                </button>
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer font-sans"
                >
                  <span>نشر وترويج فوراً 🚀</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- BULK PRICE UPDATE TOOL MODAL --- */}
      {isPriceUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-[4px] z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-md bg-[#111317] rounded-3xl border border-amber-500/40 overflow-hidden shadow-2xl shadow-amber-950/20 animate-fade-in flex flex-col text-right">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-gradient-to-l from-amber-500/5 to-transparent shrink-0">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h3 className="text-md font-black text-amber-500 font-sans">أداة تحديث الأسعار والمستويات مجمّعاً</h3>
              </div>
              <button 
                onClick={() => {
                  setIsPriceUpdateModalOpen(false);
                  setSelectedIds([]);
                }}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleBulkPriceUpdateSubmit} className="p-6 space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl space-y-1">
                <p className="text-[11px] text-amber-500 font-bold font-sans">⚡ تحديث جماعي لعدد ({selectedIds.length}) من السلع المحددة</p>
                <p className="text-[10px] text-gray-400 leading-relaxed font-sans">سيقوم النظام بتحديث وتعديل أسعار بيع السلع الرسمية وحساب الفروقات وتدوينها تلقائياً في العين الساهرة للمراقبة.</p>
              </div>

              {/* Update Type Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-300 font-sans">نوع ومعيار التحديث السعري</label>
                <select
                  value={priceUpdateForm.type}
                  onChange={(e) => setPriceUpdateForm(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full bg-neutral-950 border border-white/5 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                >
                  <option value="pct_increase">زيادة بنسبة مئوية (%) فوق سعر البيع</option>
                  <option value="fixed_increase">زيادة بمبلغ مالي محدد (ريال) فوق سعر البيع</option>
                  <option value="pct_decrease">تخفيض بنسبة مئوية (%) من سعر البيع</option>
                  <option value="fixed_decrease">تخفيض بمبلغ مالي محدد (ريال) من سعر البيع</option>
                </select>
              </div>

              {/* Value Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-300 font-sans">القيمة المالية أو النسبة المئوية المضافة <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input 
                    type="number"
                    required
                    min="1"
                    value={priceUpdateForm.value || ''}
                    onChange={(e) => setPriceUpdateForm(prev => ({ ...prev, value: Number(e.target.value) }))}
                    placeholder={priceUpdateForm.type.includes('pct') ? "مثال: 10 للزيادة/النقص 10%" : "مثال: 1000 لريال يمني"}
                    className="w-full bg-neutral-950 border border-white/5 p-3 rounded-xl text-xs font-mono font-black text-amber-500 focus:outline-none focus:border-amber-500 text-right"
                  />
                  <span className="absolute left-3 top-3 text-[10px] text-gray-400 font-black font-sans">
                    {priceUpdateForm.type.includes('pct') ? '%' : 'ر.ي'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsPriceUpdateModalOpen(false);
                    setSelectedIds([]);
                  }}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-white/5 rounded-xl text-xs font-bold text-gray-300 transition-colors cursor-pointer font-sans"
                >
                  تراجع وإغلاق
                </button>
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-black text-xs font-black flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer font-sans"
                >
                  <span>تطبيق وتحديث جماعي ⚡</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- FORM MODAL OVERLAY (ADD/EDIT ITEM DATA) --- */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-royal-card rounded-3xl border border-amber-500/30 overflow-hidden shadow-2xl animate-fade-in text-right max-h-[90vh] flex flex-col">
            
            <div className="p-6 border-b border-amber-500/15 flex justify-between items-center bg-gradient-to-l from-amber-500/5 to-transparent shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-black text-amber-500">
                  {editingItem ? 'تعديل بيانات الصنف وبطاقة السلعة' : 'إضافة صنف جديد لكتالوج المحل'}
                </h3>
              </div>
              <button 
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItemSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">اسم الصنف بالكامل *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="مثال: شاشة هاتف آيفون 13 برو ماكس أصلية"
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">كود الباركود التسلسلي (تلقائي / يدوي)</label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">فئة وتصنيف المنتج</label>
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setFormCategory(newCat);
                      const mapping = categoryMappings.find(m => m.name === newCat);
                      if (mapping && mapping.warehouseName) {
                        setFormWarehouseName(mapping.warehouseName);
                      }
                    }}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold"
                  >
                    {categories.map((cat, index) => (
                      <option key={index} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">الوحدة الافتراضية</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="حبة">حبة (قطعة فردية)</option>
                    <option value="كرتون">كرتون (مجموعة)</option>
                    <option value="متر">متر (قياس طولي)</option>
                    <option value="باقة">باقة تفعيلية</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">الحجم / مقاس السلعة</label>
                  <select
                    value={formSize}
                    onChange={(e) => setFormSize(e.target.value)}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="بدون مقاس">بدون مقاس</option>
                    <option value="128GB">سعة 128 جيجابايت</option>
                    <option value="256GB">سعة 256 جيجابايت</option>
                    <option value="512GB">سعة 512 جيجابايت</option>
                    <option value="Standard">حجم قياسي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#fbbf24]/5 border border-[#fbbf24]/15 p-4 rounded-xl space-y-1.5">
                  <label className="block text-xs text-amber-500 mb-1 font-black">المستودع المعتمد المودع به الصنف</label>
                  <select
                    value={formWarehouseName}
                    onChange={(e) => setFormWarehouseName(e.target.value)}
                    className="w-full bg-[#111215] text-white border border-[#fbbf24]/30 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold"
                  >
                    {dbWarehouses.map((wh, idx) => (
                      <option key={idx} value={wh}>{wh}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400">توجيه الصنف للمستودع المطلوب لضبط الجرد.</p>
                </div>

                <div className="bg-[#fbbf24]/5 border border-[#fbbf24]/15 p-4 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs text-amber-500 font-black">المورد أو جهة التوريد</label>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSupplierSourceContext('form');
                        setQuickSupplierName('');
                        setQuickSupplierPhone('');
                        setQuickSupplierCompany('');
                        setIsQuickAddSupplierModalOpen(true);
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/20 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      <span>إضافة مورد جديد</span>
                    </button>
                  </div>
                  <select
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    className="w-full bg-[#111215] text-white border border-[#fbbf24]/30 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold"
                  >
                    <option value="">-- اختياري: تحديد مورد الصنف --</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.name}>{sup.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400">ربط السلعة بالمورد المسجل أو الضغط لإضافة مورد جديد فوراً.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">سعر الشراء والتكلفة (ر.ي) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    required
                    value={formCost}
                    onChange={(e) => setFormCost(Number(e.target.value))}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">سعر بيع المفرد (ر.ي) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">سعر بيع الجملة (ر.ي)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={formWholesalePrice}
                    onChange={(e) => setFormWholesalePrice(Number(e.target.value))}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">الرصيد الابتدائي المتوفر</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    step="1"
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">قائمة التوافقات والتطبيقات للأجهزة</label>
                  <textarea
                    rows={2}
                    value={formCompatibilities}
                    onChange={(e) => setFormCompatibilities(e.target.value)}
                    placeholder="مثال: صالح لأجهزة آبل آيفون 11، 12، 13 برو ماكس"
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-bold">البدائل المقترحة للسلعة (عند الندرة)</label>
                  <textarea
                    rows={2}
                    value={formAlternatives}
                    onChange={(e) => setFormAlternatives(e.target.value)}
                    placeholder="مثال: شاحن بيلكن ذكي بقوة ٢5 واط"
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Warranty Configurations Section (فترات ضمان المنتجات والتعويضات - المطبقة تلقائيا) */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-2">
                <h4 className="text-xs font-black text-amber-500 flex items-center gap-1.5 font-sans">
                  🛡️ سياسة الضمان المطبقة تلقائياً
                </h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  يتم تطبيق سياسة الضمان العامة للمحل المحددة من قبل صاحب العمل في أعلى شاشة إدارة المخزن تلقائياً على هذا المنتج عند حفظه.
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-amber-400/80 font-bold">
                  <span>نوع الضمان: {
                    globalWarrantyType === 'replacement_same' || globalWarrantyType === 'replace_other'
                      ? 'ضمان محدد بمدة زمنية مخصصة'
                      : globalWarrantyType === 'return_policy'
                        ? 'ضمان تشغيل عيني فور التوصيل'
                        : 'لا يوجد ضمان'
                  }</span>
                  {globalWarrantyType !== 'none' && (
                    <>
                      <span>• مدة الضمان الافتراضية: {globalWarrantyDuration} يوم</span>
                      <span>• آلية التعويض: {
                        globalCompensationOption === 'replace_same'
                          ? 'استبدال بنفس الصنف المرتجع'
                          : globalCompensationOption === 'replace_other'
                            ? 'استبدال بصنف آخر'
                            : 'استرداد مالي مباشر (كاش/رصيد دائن)'
                      }</span>
                    </>
                  )}
                </div>
              </div>

              {/* B2B Unified Market and Subscriber Pricing Section */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-4">
                <h4 className="text-xs font-black text-amber-500 flex items-center gap-1.5 border-b border-white/5 pb-2 font-sans">
                  <Globe size={13} className="text-amber-500 shrink-0" />
                  🌐 النشر الفوري في الجملة وتسعير المشتركين السوق الموحد B2B
                </h4>
                <div>
                  {/* Quick Publish Toggle */}
                  <div className="flex items-center justify-between bg-[#111215] p-3 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all text-right">
                    <div>
                      <span className="block text-xs font-black text-gray-200">الطلب والنشر التلقائي بالسوق</span>
                      <span className="block text-[10.5px] text-gray-500">تمكين ظهور وبناء السلعة بالمتجر الموحد للعملاء</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormIsPublished(!formIsPublished)}
                      className="focus:outline-none cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-all text-right"
                    >
                      {formIsPublished ? (
                        <div className="flex items-center gap-1 text-[#D4AF37] font-black text-xs font-sans">
                          <span>نشط ومتاح</span>
                          <ToggleRight className="w-8 h-8 text-[#D4AF37]" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400 font-black text-xs font-sans">
                          <span>مسودة داخلية</span>
                          <ToggleLeft className="w-8 h-8 text-gray-550" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs text-gray-300 font-bold hover:bg-white/10 transition-all font-sans"
                >
                  إلغاء التعديلات
                </button>
                <button
                  id="btn-save-item-submit"
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-[#fbbf24] text-black font-black text-xs hover:opacity-90 active:scale-95 transition-all"
                >
                  {isProcessing ? 'جاري ترحيل التعديلات...' : 'حفظ وتثبيت الصنف في المخزن'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= MODAL 1: ADD NEW WAREHOUSE (إضافة مستودع) ================= */}
      {isAddWarehouseModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" style={{ direction: 'rtl' }}>
          <div className="w-full max-w-md bg-royal-card border-2 border-amber-500 rounded-3xl overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="p-6 bg-gradient-to-l from-amber-500/10 to-transparent border-b border-amber-500/20 flex justify-between items-center">
              <h3 className="text-base font-black text-amber-500 flex items-center gap-2">
                <span>🏢</span>
                <span>تأسيس مستودع أو فرع تخزين جديد</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsAddWarehouseModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 text-white flex items-center justify-center hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newWhName.trim()) {
                triggerStatus('error', 'يرجى كتابة اسم المستودع بوضوح.');
                return;
              }
              setIsProcessing(true);
              try {
                await addDoc(collection(db, 'warehouses'), {
                  ownerId: currentOwnerId,
                  name: newWhName.trim(),
                  createdAt: serverTimestamp()
                });
                triggerStatus('success', `تم تأسيس المستودع الجديد "${newWhName}" بنجاح وربطه بالفروع.`);
                setIsAddWarehouseModalOpen(false);
                setNewWhName('');
              } catch (err: any) {
                triggerStatus('error', err.message || 'فشلت عملية الإضافة.');
              } finally {
                setIsProcessing(false);
              }
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-2">اسم المخزن أو الفرع المعتمد *</label>
                <input 
                  type="text"
                  placeholder="مثال: مستودع المعلا، فرع التواهي، المخزن المركزي..."
                  value={newWhName}
                  onChange={(e) => setNewWhName(e.target.value)}
                  className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button 
                  type="button"
                  onClick={() => setIsAddWarehouseModalOpen(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300"
                >
                  إلغاء التأسيس
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-l from-amber-500 to-amber-600 text-black font-black text-xs rounded-xl"
                >
                  حفظ وتأسيس المخزن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 1.5: CATEGORY MANAGEMENT & WAREHOUSE LINKER ================= */}
      {isCategoryMappingModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" style={{ direction: 'rtl' }}>
          <div className="w-full max-w-2xl bg-royal-card border-2 border-amber-500 rounded-3xl overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="p-6 bg-gradient-to-l from-amber-500/10 to-transparent border-b border-amber-500/20 flex justify-between items-center">
              <h3 className="text-base font-black text-amber-500 flex items-center gap-2">
                <span>🏷️</span>
                <span>إدارة الأقسام والربط التلقائي بالمخازن</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsCategoryMappingModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 text-white flex items-center justify-center hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info text */}
              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-xs text-amber-200/80 leading-relaxed">
                هنا يمكنك إضافة أقسام وتصنيفات جديدة للنظام (مثل قسم الجوالات، الإلكترونيات، إلخ) وتحديد مستودع تلقائي لكل قسم. عند تفعيل أو إضافة فواتير أو سلع جديدة تتبع هذا القسم، سيتم ربطها آلياً بالمخزن المحدد دون الحاجة للاختيار اليدوي في كل مرة!
              </div>

              {/* Independent Warehouse Migration Assistant Section */}
              {!isWarehouseSystemActivated && (
                <div className="p-4 bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <span className="text-xs font-black text-amber-400">إلغاء الربط بالمستودع الرئيسي وتأسيس مستودع مستقل لكل قسم</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    سيقوم هذا الخيار تلقائياً بإنشاء مستودعات مخصصة في النظام مطابقة تماماً لأسماء الأقسام الحالية (أجهزة محمولة، قطع غيار شاشات، طاقة وبطاريات، إلخ) وتحديث كود الربط التلقائي ونقل كافة السلع المرتبطة بالصالات إليها مباشرة ليكون لكل قسم مستودع مستقل تماماً!
                  </p>
                  <button
                    type="button"
                    disabled={isMigrating}
                    onClick={handleMigrateCategoriesToOwnWarehouses}
                    className="w-full py-2.5 bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-black font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    {isMigrating ? (
                      <>
                        <span className="animate-spin text-black">🌀</span>
                        <span>جاري التحديث والتوزيع الفوري...</span>
                      </>
                    ) : (
                      <>
                        <span>👑 تفعيل نظام المستودعات المستقلة لكل قسم (توزيع ذكي)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Add category mapping form */}
              <div className="bg-[#111215] p-4 rounded-2xl border border-white/5 space-y-4">
                <h4 className="text-xs font-black text-white">➕ إضافة قسم جديد وتعيين مخزنه</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">اسم القسم / الفئة *</label>
                    <input 
                      type="text"
                      placeholder="مثال: قسم الجوالات، إكسسوارات ممتازة..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full bg-[#1c1d22] text-white border border-white/10 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">المستودع أو المخزن المرتبط *</label>
                    <select
                      value={newCategoryWarehouse}
                      onChange={(e) => setNewCategoryWarehouse(e.target.value)}
                      className="w-full bg-[#1c1d22] text-white border border-white/10 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold"
                    >
                      {dbWarehouses.map((wh, idx) => (
                        <option key={idx} value={wh}>{wh}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button 
                    type="button"
                    onClick={async () => {
                      if (!newCategoryName.trim()) {
                        triggerStatus('error', 'يرجى إدخال اسم القسم بوضوح.');
                        return;
                      }
                      try {
                        await addDoc(collection(db, 'inventory_categories'), {
                          ownerId: currentOwnerId,
                          name: newCategoryName.trim(),
                          warehouseName: newCategoryWarehouse,
                          createdAt: serverTimestamp()
                        });
                        triggerStatus('success', `تمت إضافة قسم "${newCategoryName}" وربطه بـ "${newCategoryWarehouse}" بنجاح.`);
                        setNewCategoryName('');
                      } catch (err: any) {
                        triggerStatus('error', err.message || 'فشلت إضافة القسم.');
                      }
                    }}
                    className="px-4 py-2 bg-amber-500 text-black font-black text-xs rounded-xl hover:bg-amber-400 transition-all cursor-pointer"
                  >
                    إضافة وتفعيل القسم 💾
                  </button>
                </div>
              </div>

              {/* Mappings Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-gray-300">📋 قائمة الأقسام والربط الحالي</h4>
                <div className="max-h-56 overflow-y-auto border border-white/5 rounded-2xl bg-[#090a0c]">
                  <table className="w-full text-xs text-right text-white">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/5 text-gray-400">
                        <th className="p-3 font-bold">اسم القسم</th>
                        <th className="p-3 font-bold">المستودع الافتراضي</th>
                        <th className="p-3 font-bold text-center w-20">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {categoryMappings.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-gray-500">لا توجد أقسام مسجلة حالياً.</td>
                        </tr>
                      ) : (
                        categoryMappings.map((mapping, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02] text-gray-200">
                            <td className="p-3 font-black text-amber-500">{mapping.name}</td>
                            <td className="p-2">
                              {mapping.id ? (
                                <select
                                  value={mapping.warehouseName || 'المستودع الرئيسي للصالات'}
                                  onChange={async (e) => {
                                    const newWh = e.target.value;
                                    try {
                                      await updateDoc(doc(db, 'inventory_categories', mapping.id!), {
                                        warehouseName: newWh
                                      });
                                      triggerStatus('success', `تم تغيير ربط قسم "${mapping.name}" إلى "${newWh}" بنجاح.`);
                                    } catch (err: any) {
                                      triggerStatus('error', 'فشل تحديث ربط المخزن للقسم.');
                                    }
                                  }}
                                  className="bg-[#111215] text-white border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold cursor-pointer"
                                >
                                  {Array.from(new Set(['المستودع الرئيسي للصالات', ...dbWarehouses])).map((wh, wIdx) => (
                                    <option key={wIdx} value={wh}>{wh}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-gray-400 font-semibold">{mapping.warehouseName}</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {mapping.id ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`هل أنت متأكد من حذف قسم "${mapping.name}"؟`)) {
                                      try {
                                        await deleteDoc(doc(db, 'inventory_categories', mapping.id!));
                                        triggerStatus('success', `تم حذف القسم "${mapping.name}" بنجاح.`);
                                      } catch (err: any) {
                                        triggerStatus('error', 'فشل حذف القسم.');
                                      }
                                    }
                                  }}
                                  className="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                                  title="حذف هذا القسم"
                                >
                                  🗑️
                                </button>
                              ) : (
                                <span className="text-gray-600 text-[10px]">افتراضي</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
              <button 
                type="button"
                onClick={() => setIsCategoryMappingModalOpen(false)}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold text-white cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: STOCK TRANSFER BETWEEN WAREHOUSES (تحويل مخازن) ================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" style={{ direction: 'rtl' }}>
          <div className="w-full max-w-lg bg-royal-card border-2 border-amber-500 rounded-3xl overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="p-6 bg-gradient-to-l from-amber-500/10 to-transparent border-b border-amber-500/20 flex justify-between items-center">
              <h3 className="text-base font-black text-amber-500 flex items-center gap-2">
                <span>🔄</span>
                <span>تحويل المنتجات ونقل المخزونات بين الفروع</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsTransferModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 text-white flex items-center justify-center hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!transferProductId) {
                triggerStatus('error', 'يرجى تحديد سلعة للتحويل.');
                return;
              }
              if (transferSourceWh === transferTargetWh) {
                triggerStatus('error', 'خطأ: لا يمكن ترحيل البضاعة لنفس مستودعها الحالي!');
                return;
              }
              const sourceItem = items.find(i => i.id === transferProductId);
              if (!sourceItem) {
                triggerStatus('error', 'الصنف غير متاح في مخدم التخزين.');
                return;
              }
              if (sourceItem.stock < transferQty) {
                triggerStatus('error', `عذراً! الرصيد المتاح غير كافٍ. الرصيد الدفتري الحالي: ${sourceItem.stock} قطعة.`);
                return;
              }

              setIsProcessing(true);
              try {
                // Decrement from source
                await updateDoc(doc(db, 'inventory', sourceItem.id!), {
                  stock: Math.max(0, sourceItem.stock - transferQty)
                });

                // Find if target warehouse already contains this barcode
                const existingTargetCopy = items.find(
                  it => it.barcode === sourceItem.barcode && it.warehouseName === transferTargetWh
                );

                if (existingTargetCopy) {
                  // Add stock to matched target copy
                  await updateDoc(doc(db, 'inventory', existingTargetCopy.id!), {
                    stock: existingTargetCopy.stock + transferQty
                  });
                } else {
                  // Create copy document
                  await addDoc(collection(db, 'inventory'), {
                    name: sourceItem.name,
                    barcode: sourceItem.barcode,
                    category: sourceItem.category,
                    cost: sourceItem.cost,
                    price: sourceItem.price,
                    wholesalePrice: sourceItem.wholesalePrice || sourceItem.price,
                    stock: transferQty,
                    unit: sourceItem.unit || 'حبة',
                    size: sourceItem.size || 'بدون مقاس',
                    compatibilities: sourceItem.compatibilities || '',
                    alternatives: sourceItem.alternatives || '',
                    ownerId: currentOwnerId,
                    warehouseName: transferTargetWh,
                    imageUrl: sourceItem.imageUrl || '',
                    imageUrls: sourceItem.imageUrls || [],
                    createdAt: serverTimestamp()
                  });
                }

                await logActivity({
                  ownerId: currentOwnerId,
                  action: 'ترحيل بضائع داخلي',
                  description: `ترحيل ${transferQty} قطع من صنف "${sourceItem.name}" من "${transferSourceWh}" إلى "${transferTargetWh}".`,
                  operatedBy: profile?.name || 'مدير المخزن',
                  timestamp: new Date().toISOString()
                });

                triggerStatus('success', `اكتمل تحويل ونقل ${transferQty} حبات من صنف "${sourceItem.name}" إلى مستودع "${transferTargetWh}" بنجاح.`);
                setIsTransferModalOpen(false);
              } catch (err: any) {
                triggerStatus('error', err.message || 'فشل الترحيل.');
              } finally {
                setIsProcessing(false);
              }
            }} className="p-6 space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">اختر صنف و شحنة المنتج للترحيل *</label>
                <select 
                  value={transferProductId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setTransferProductId(selId);
                    const matchedItem = items.find(i => i.id === selId);
                    if (matchedItem) {
                      setTransferSourceWh(matchedItem.warehouseName || 'المستودع الرئيسي للصالات');
                    }
                  }}
                  className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">-- اضغط لاختيار منتج من الفهرس --</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} (المتوفر حالياً: {it.stock} حبة في {it.warehouseName || 'المستودع الرئيسي'}) - {it.barcode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">المستودع المصدر الحالي</label>
                  <input 
                    type="text"
                    value={transferSourceWh}
                    className="w-full bg-neutral-900 text-stone-300 border border-white/5 rounded-xl p-3 text-xs focus:outline-none font-bold select-none cursor-not-allowed"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">المخزن المستهدف وموقع النقل *</label>
                  <select 
                    value={transferTargetWh}
                    onChange={(e) => setTransferTargetWh(e.target.value)}
                    className="w-full bg-[#111215] text-white border border-[#fbbf24]/30 rounded-xl p-3 text-xs focus:outline-none font-bold"
                  >
                    {dbWarehouses.map((wh, idx) => (
                      <option key={idx} value={wh}>{wh}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">الكمية المستهدف نقلها وتحويلها (عدد) *</label>
                <input 
                  type="number"
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button 
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300"
                >
                  إلغاء العملية
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-l from-amber-500 to-amber-600 text-black font-black text-xs rounded-xl"
                >
                  تأكيد ترحيل وتحويل الشحنة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: WAREHOUSE AUDIT (جرد المخزن الفعلي) ================= */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" style={{ direction: 'rtl' }}>
          <div className="w-full max-w-2xl bg-royal-card border-2 border-amber-500 rounded-3xl overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="p-6 bg-gradient-to-l from-amber-500/10 to-transparent border-b border-amber-500/20 flex justify-between items-center">
              <h3 className="text-base font-black text-amber-500 flex items-center gap-2">
                <span>📋</span>
                <span>جرد وتسوية أرصدة وتكاليف المخازن</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsAuditModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 text-white flex items-center justify-center hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-3">
                <div className="w-full sm:w-1/2">
                  <label className="block text-xs font-bold text-gray-300 mb-1">اختر المستودع الجاري جرده لمعاينة أرصدته الفعلية</label>
                  <select 
                    value={auditWarehouseName}
                    onChange={(e) => {
                      setAuditWarehouseName(e.target.value);
                      setAuditAdjustments({});
                    }}
                    className="w-full bg-[#111215] text-white border border-[#fbbf24]/20 rounded-xl p-2.5 text-xs focus:outline-none font-bold"
                  >
                    {dbWarehouses.map((wh, idx) => (
                      <option key={idx} value={wh}>{wh}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-amber-500/10 text-[#fbbf24] px-4 py-2 rounded-xl text-[11px] font-bold border border-[#fbbf24]/10">
                  سيتم تسوية الفروقات وعرض الأثر دفترياً فور الضغط على حفظ.
                </div>
              </div>

              {/* Items in selected warehouse */}
              <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1 custom-scroll">
                {items.filter(it => (it.warehouseName || 'المستودع الرئيسي للصالات') === auditWarehouseName).length === 0 ? (
                  <div className="p-12 text-center text-gray-400 text-xs">
                    لا تتوفر في هذا المستودع أي بضائع حالياً لإجراء الجرد عليها. لترحيل بضاعة لهذا المستودع استخدم تحويل المخازن.
                  </div>
                ) : (
                  items
                    .filter(it => (it.warehouseName || 'المستودع الرئيسي للصالات') === auditWarehouseName)
                    .map((item) => {
                      const currentVal = auditAdjustments[item.id!] ?? item.stock;
                      return (
                        <div key={item.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-white/[0.04] transition-all">
                          <div>
                            <span className="font-bold text-white text-xs block">{item.name}</span>
                            <span className="text-[10px] text-gray-400 mt-0.5 block">الرمز: {item.barcode} | الكود التعريفي: {item.category}</span>
                          </div>

                          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                            <span className="text-gray-400 text-[11px]">دفيتري: <strong className="text-stone-300 font-mono">{item.stock}</strong></span>
                            
                            <div className="flex items-center gap-1.5 bg-neutral-900 border border-white/5 rounded-xl p-1">
                              <button 
                                type="button"
                                onClick={() => setAuditAdjustments(prev => ({ ...prev, [item.id!]: Math.max(0, currentVal - 1) }))}
                                className="w-7 h-7 bg-white/5 text-gray-300 rounded-lg flex items-center justify-center font-bold text-xs"
                              >
                                -
                              </button>
                              <input 
                                type="number"
                                value={currentVal}
                                onChange={(e) => {
                                  let val = Math.max(0, Number(e.target.value));
                                  setAuditAdjustments(prev => ({ ...prev, [item.id!]: val }));
                                }}
                                className="w-14 text-center bg-transparent border-none focus:outline-none text-xs text-amber-500 font-bold font-mono"
                              />
                              <button 
                                type="button"
                                onClick={() => setAuditAdjustments(prev => ({ ...prev, [item.id!]: currentVal + 1 }))}
                                className="w-7 h-7 bg-white/5 text-gray-300 rounded-lg flex items-center justify-center font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button 
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300"
                >
                  إلغاء وعودة
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    setIsProcessing(true);
                    try {
                      const auditedItems = items.filter(i => (i.warehouseName || 'المستودع الرئيسي للصالات') === auditWarehouseName);
                      let changed_count = 0;
                      
                      for (const item of auditedItems) {
                        const adjustedStock = auditAdjustments[item.id!];
                        if (adjustedStock !== undefined && adjustedStock !== item.stock) {
                          await updateDoc(doc(db, 'inventory', item.id!), {
                            stock: adjustedStock,
                            auditNotes: 'جرد وتحديث كميات يدوي دقيق'
                          });
                          changed_count++;
                        }
                      }

                      await logActivity({
                        ownerId: currentOwnerId,
                        action: 'جرد مستودعات',
                        description: `تم مطابقة كميات وجرد المستودع "${auditWarehouseName}" يدوياً، تم التلاعب/تسوية عدد ${changed_count} سلع مخزنية.`,
                        operatedBy: profile?.name || 'مدير الجرد والمخزن',
                        timestamp: new Date().toISOString()
                      });

                      triggerStatus('success', `تم حفظ وتثبيت جرد المستودع "${auditWarehouseName}" بنجاح، تفريع الأرصدة الفعلية لملفات البضائع المحدثة.`);
                      setIsAuditModalOpen(false);
                      setAuditAdjustments({});
                    } catch (err: any) {
                      triggerStatus('error', err.message || 'فشلت تسوية الجرد.');
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  className="px-5 py-2 bg-emerald-500 text-black font-black text-xs rounded-xl"
                  disabled={items.filter(it => (it.warehouseName || 'المستودع الرئيسي للصالات') === auditWarehouseName).length === 0}
                >
                  تأكيد تسوية وحفظ الجرد الفعلي
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: PRODUCT IMAGES MANAGEMENT (إضافة صور المنتجات) ================= */}
      {isAddImagesModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" style={{ direction: 'rtl' }}>
          <div className="w-full max-w-2xl bg-royal-card border-2 border-amber-500 rounded-3xl overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="p-6 bg-gradient-to-l from-amber-500/10 to-transparent border-b border-amber-500/20 flex justify-between items-center">
              <h3 className="text-base font-black text-amber-500 flex items-center gap-2">
                <span>📷</span>
                  <span>تحديث وإرفاق صور المنتجات والسلع</span>
                </h3>
                <button 
                  type="button" 
                  onClick={() => setIsAddImagesModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 text-white flex items-center justify-center hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!imgTargetProductId) {
                  triggerStatus('error', 'يرجى اختيار منتج لترحيل صوره.');
                  return;
                }
                setIsProcessing(true);
                try {
                  await updateDoc(doc(db, 'inventory', imgTargetProductId), {
                    imageUrl: productImgUrl || ''
                  });

                  await logActivity({
                    ownerId: currentOwnerId,
                    action: 'تحديث صور ومعارض سلع',
                    description: `تم إسناد صورة مميزة لسلعة المعروضات التخزينية المحددة.`,
                    operatedBy: profile?.name || 'محرر كتالوج الصور',
                    timestamp: new Date().toISOString()
                  });

                  triggerStatus('success', 'تم حفظ وتعميم صور المنتج بنجاح على الفروع وجهاز الكاشير وصالة البيع بالسوق.');
                  setIsAddImagesModalOpen(false);
                } catch (err: any) {
                  triggerStatus('error', err.message || 'فشلت أرشفة الصور.');
                } finally {
                  setIsProcessing(false);
                }
              }} className="p-6 space-y-4">
                
                <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/5">
                  <span className="block text-xs font-black text-amber-500">🔍 محرك البحث السريع وتصفية السلع:</span>
                  
                  {/* Search & Scan Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="🔍 اكتب اسم السلعة أو الباركود للبحث..."
                      value={imageSearchTerm}
                      onChange={(e) => setImageSearchTerm(e.target.value)}
                      className="w-full bg-[#111215] text-white border border-white/10 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                    <select
                      value={imageFilterWarehouse}
                      onChange={(e) => setImageFilterWarehouse(e.target.value)}
                      className="w-full bg-[#111215] text-white border border-white/10 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                    >
                      <option value="all">📍 كل المستودعات</option>
                      {dbWarehouses.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sub-Filters */}
                  <div className="flex flex-wrap gap-3 items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">القسم:</span>
                      <select
                        value={imageFilterCategory}
                        onChange={(e) => setImageFilterCategory(e.target.value)}
                        className="bg-[#111215] text-white border border-white/10 rounded-xl px-2 py-1 text-[10px] focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                      >
                        <option value="all">كل الأقسام</option>
                        {Array.from(new Set(items.map(it => it.category).filter(Boolean))).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Last Invoice Toggle */}
                    <label className="flex items-center gap-1.5 text-[10.5px] font-bold text-gray-300 cursor-pointer select-none hover:text-white transition-all">
                      <input
                        type="checkbox"
                        checked={imageShowLastInvoiceOnly}
                        onChange={(e) => setImageShowLastInvoiceOnly(e.target.checked)}
                        className="rounded border-white/10 bg-[#111215] text-amber-500 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>📦 عرض أصناف أحدث فاتورة توريد فقط ({latestInvoiceNum || 'لا يوجد'})</span>
                    </label>
                  </div>

                  {/* Filtered Products List */}
                  <div className="border border-white/5 rounded-xl bg-black/50 p-2 space-y-1.5 max-h-48 overflow-y-auto">
                    {filteredImageSelectItems.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-[11px] font-bold">
                        لا توجد نتائج مطابقة للفلاتر المحددة.
                      </div>
                    ) : (
                      filteredImageSelectItems.map((it) => {
                        const isSelected = imgTargetProductId === it.id;
                        return (
                          <div
                            key={it.id}
                            type="button"
                            onClick={() => {
                              setImgTargetProductId(it.id || '');
                              setProductImgUrl(it.imageUrl || '');
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer text-[11px] ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500 text-white font-black shadow-md'
                                : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/5 text-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-[12px] opacity-85">📦</span>
                              <div className="truncate text-right">
                                <span className="block font-bold truncate">{it.name}</span>
                                <span className="block text-[9px] text-gray-500 font-mono">
                                  باركود: {it.barcode || 'بدون'} | القسم: {it.category} | المستودع: {it.warehouseName || 'المستودع الرئيسي'} | الكمية: {it.stock} ق
                                </span>
                              </div>
                            </div>
                            
                            <span
                              className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all shrink-0 ${
                                isSelected
                                  ? 'bg-amber-500 text-black'
                                  : 'bg-white/5 text-amber-500'
                              }`}
                            >
                              {isSelected ? '✓ محدد' : 'تحديد'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-3">
                <label className="block text-xs font-bold text-amber-500">رفع صورة للمنتج مباشرة من جهازك (سيتم ضغط الحجم تلقائياً لتوفير المساحة) 📷</label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const compressedBase64 = await compressImage(file, 600, 600, 0.6);
                        setProductImgUrl(compressedBase64);
                      } catch (err: any) {
                        console.error('Compression failed:', err);
                      }
                    }
                  }}
                  className="block w-full text-xs text-gray-400 file:ml-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-black hover:file:bg-amber-400 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">أو أدخل رابط/مسار صورة المنتج المباشر *</label>
                <input 
                  type="text"
                  placeholder="رابط رابط الصورة، مثلاً: https://example.com/image.png ..."
                  value={productImgUrl}
                  onChange={(e) => setProductImgUrl(e.target.value)}
                  className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                  required
                />
              </div>

              {/* Suggestions Panel */}
              <div className="p-3.5 bg-neutral-900 border border-white/5 rounded-2xl">
                <span className="block text-[11px] font-bold text-amber-500 mb-2">💡 صور سريعة مقترحة لمنتجات JAM (اضغط للاختيار):</span>
                <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  <button 
                    type="button" 
                    onClick={() => setProductImgUrl('https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=320&auto=format&fit=crop&q=60')}
                    className="p-1 px-2 text-right bg-white/5 hover:bg-white/10 text-[9px] text-[#fbbf24] font-black border border-white/5 rounded-lg truncate block"
                  >
                    📱 هاتف ذكي ممتاز
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setProductImgUrl('https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=320&auto=format&fit=crop&q=60')}
                    className="p-1 px-2 text-right bg-white/5 hover:bg-white/10 text-[9px] text-[#fbbf24] font-black border border-white/5 rounded-lg truncate block"
                  >
                    🎧 سماعات بلوتوث رأسية
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setProductImgUrl('https://images.unsplash.com/photo-1583394838336-acd977736f90?w=320&auto=format&fit=crop&q=60')}
                    className="p-1 px-2 text-right bg-white/5 hover:bg-white/10 text-[9px] text-[#fbbf24] font-black border border-white/5 rounded-lg truncate block"
                  >
                    🔌 كابلات وشواحن طاقة
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setProductImgUrl('https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=320&auto=format&fit=crop&q=60')}
                    className="p-1 px-2 text-right bg-white/5 hover:bg-white/10 text-[9px] text-[#fbbf24] font-black border border-white/5 rounded-lg truncate block"
                  >
                    📺 شاشات وقطع تجميع غيار
                  </button>
                </div>
              </div>

              {/* Preview Box */}
              {productImgUrl && (
                <div className="flex flex-col items-center justify-center p-4 bg-black/40 border border-[#fbbf24]/20 rounded-2xl">
                  <span className="text-[10px] text-gray-400 mb-2 block">معاينة الصورة الحية للمنتج:</span>
                  <img 
                    src={productImgUrl} 
                    alt="معاينة المنتج" 
                    className="max-h-24 w-auto object-contain rounded-xl border border-amber-500/20"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as any).src = "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=320&auto=format&fit=crop&q=60";
                    }}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button 
                  type="button"
                  onClick={() => setIsAddImagesModalOpen(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-l from-amber-500 to-amber-600 text-black font-black text-xs rounded-xl"
                >
                  حفظ وتثبيت صور الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- INVENTORYENGINE EMULATED modal COMPONENT (Required by openModal type logic) --- */}
      {isEngineModalOpen && (
        <div id="modal-container" className="fixed inset-0 bg-black/85 backdrop-blur-[3px] z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-royal-card border-2 border-amber-500 rounded-3xl overflow-hidden shadow-2xl animate-fade-in text-right">
            
            <div className="p-6 bg-gradient-to-l from-amber-500/10 to-transparent border-b border-amber-500/20 flex justify-between items-center">
              <h3 className="text-base font-black text-amber-500">مشهد عملية محاكاة: {modalTitle}</h3>
              <button 
                onClick={() => setIsEngineModalOpen(false)}
                className="p-1 px-3 text-xs bg-white/10 text-white rounded-lg hover:bg-white/20"
              >
                إغلاق (X)
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-400">
                نافذة تخدم استدعاءات E2E المباشرة لـ <strong className="text-white">InventoryEngine.openModal</strong>:
              </p>

              <div className="space-y-2.5">
                {modalItems.map((mi) => (
                  <div key={mi.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white block">{mi.name}</span>
                      <span className="text-[10px] text-gray-400">{mi.info}</span>
                    </div>

                    {modalTitle === 'إدارة الصور' && (
                      <button 
                        onClick={() => alert(`تمت محاكاة تفعيل أو استيراد خيار الصور المتعددة للسلعة: ${mi.name}`)}
                        className="px-3 py-1.5 bg-[#fbbf24] text-black font-black rounded-lg text-[10px]"
                      >
                        📷 إضافة صورة إضافية
                      </button>
                    )}

                    {modalTitle === 'توليد باركود' && (
                      <button 
                        onClick={() => { printBarcode('PRODUCT', mi.id); setIsEngineModalOpen(false); }}
                        className="px-3 py-1.5 bg-gradient-to-l from-amber-500 to-amber-600 text-black font-black rounded-lg text-[10px]"
                      >
                        🖨️ طباعة ملصق
                      </button>
                    )}

                    {modalTitle === 'جرد مخزن' && (
                      <button 
                        onClick={() => { handleAuditEngine(); setIsEngineModalOpen(false); }}
                        className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 font-bold rounded-lg text-[10px]"
                      >
                        📋 بدء جرد تفصيلي
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white/[0.01] border-t border-white/5 flex justify-end">
              <button 
                onClick={() => setIsEngineModalOpen(false)}
                className="bg-[#1a1a1a] border border-[#fbbf24]/20 hover:bg-neutral-800 text-[#fbbf24] font-bold px-5 py-2.5 rounded-xl text-xs"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: REAL INVENTORY AUDIT & ANALYSIS ================= */}
      {isInventoryAnalysisModalOpen && analysisReport && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ direction: 'rtl' }}>
          <div className="w-full max-w-3xl bg-royal-card border-2 border-emerald-500 rounded-3xl overflow-hidden shadow-2xl animate-fade-in text-right">
            
            <div className="p-6 bg-gradient-to-l from-emerald-500/10 to-transparent border-b border-emerald-500/20 flex justify-between items-center">
              <h3 className="text-base font-black text-emerald-400 flex items-center gap-2">
                <span>📊</span>
                <span>تحليل الأرصدة والتقييم الدفتري الشامل</span>
              </h3>
              <button 
                onClick={() => setIsInventoryAnalysisModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl">
                  <span className="block text-[10px] text-gray-400">إجمالي الأصناف الموثقة</span>
                  <strong className="block text-xl text-white mt-1 font-mono">{analysisReport.totalItemsCount || analysisReport.totalProducts}</strong>
                  <span className="text-[9px] text-emerald-400">صنف مسجل في القالب</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl">
                  <span className="block text-[10px] text-gray-400">إجمالي كمية القطع</span>
                  <strong className="block text-xl text-white mt-1 font-mono">{analysisReport.totalStockQuantity || analysisReport.totalAggregateStock}</strong>
                  <span className="text-[9px] text-emerald-400">وحدة متوفرة فعلياً</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl">
                  <span className="block text-[10px] text-gray-400">عدد انحرافات التسعير</span>
                  <strong className="block text-xl text-amber-500 mt-1 font-mono">{analysisReport.anomalyCount !== undefined ? analysisReport.anomalyCount : analysisReport.anomaliesCount}</strong>
                  <span className="text-[9px] text-amber-400">تنبيهات بحاجة لمعاينة</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl">
                  <span className="block text-[10px] text-gray-400 font-sans">القيمة الدفترية بسعر التكلفة الكلية</span>
                  <strong className="block text-base text-emerald-400 mt-1 font-mono">
                    {(analysisReport.totalCostValue || analysisReport.inventoryAssetsCost || 0).toLocaleString()} <span className="text-xs">ر.ي</span>
                  </strong>
                  <span className="text-[9px] text-gray-400">رأس المال المخزن الجاري</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl">
                  <span className="block text-[10px] text-gray-400 font-sans">القيمة الدفترية بسعر البيع الكلية</span>
                  <strong className="block text-base text-indigo-400 mt-1 font-mono">
                    {(analysisReport.totalRetailValue || analysisReport.inventoryAssetsRetail || 0).toLocaleString()} <span className="text-xs">ر.ي</span>
                  </strong>
                  <span className="text-[9px] text-gray-400 font-sans">القيمة المتوقعة عند البيع</span>
                </div>

                <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl">
                  <span className="block text-[10px] text-gray-400 font-bold font-sans">هامش الأرباح الإجمالي الدفتري المتوقع</span>
                  <strong className="block text-base text-emerald-500 mt-1 font-mono">
                    {((analysisReport.totalRetailValue || analysisReport.inventoryAssetsRetail || 0) - (analysisReport.totalCostValue || analysisReport.inventoryAssetsCost || 0)).toLocaleString()} <span className="text-xs">ر.ي</span>
                  </strong>
                  <span className="text-[9px] text-emerald-500 font-bold font-sans">صافي الأرباح المقدرة للدفعة</span>
                </div>
              </div>

              {/* Anomalies List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className="text-amber-500">⚠️</span>
                  <span>الأرصدة السالبة وانحرافات هوامش الأرباح المكتشفة:</span>
                </h4>

                <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1 custom-scroll">
                  {((analysisReport.anomalies || analysisReport.anomaliesFoundList || [])).length === 0 ? (
                    <div className="p-4 text-center bg-emerald-500/10 border border-emerald-500/15 rounded-2xl text-emerald-400 text-xs font-bold">
                      🎉 لا توجد أي أرصدة سالبة أو هوامش أرباح ضعيفة في الكتالوج الحالي! جميع السلع مطابقة تماماً للقوانين المالية والمخزنية.
                    </div>
                  ) : (
                    (analysisReport.anomalies || analysisReport.anomaliesFoundList).map((anomaly: string, idx: number) => (
                      <div key={idx} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-red-400 text-[11px] font-bold font-sans flex items-center justify-between">
                        <span>{anomaly}</span>
                        <span className="text-[9px] bg-red-500/10 px-2 py-0.5 rounded">حالة خلل</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              {((analysisReport.anomalies || analysisReport.anomaliesFoundList || [])).length > 0 && (
                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="text-right">
                    <span className="block text-xs font-black text-[#fbbf24]">تصحيح تلقائي فوري لأسعار السلع</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">سيقوم معالج الصيانة بإضافة هامش ربح آمن 15% للأصناف الضعيفة والمعيبة.</span>
                  </div>
                  <button
                    onClick={() => {
                      handleFixPricingEngine();
                      setIsInventoryAnalysisModalOpen(false);
                    }}
                    className="px-4 py-2 bg-[#fbbf24] hover:bg-[#fbbf24]/90 text-black font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg whitespace-nowrap"
                  >
                    🚀 تصحيح تلقائي للكل
                  </button>
                </div>
              )}

            </div>

            <div className="p-4 bg-white/[0.01] border-t border-white/5 flex justify-end">
              <button 
                onClick={() => setIsInventoryAnalysisModalOpen(false)}
                className="px-5 py-2.5 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: COMMODITY ALTERNATIVES & SCARCITY ENGINE ================= */}
      {isAlternativesModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ direction: 'rtl' }}>
          <div className="w-full max-w-5xl bg-royal-card border-2 border-indigo-500 rounded-3xl overflow-hidden shadow-2xl animate-fade-in text-right">
            
            <div className="p-6 bg-gradient-to-l from-indigo-500/10 to-transparent border-b border-indigo-500/20 flex justify-between items-center">
              <h3 className="text-base font-black text-indigo-400 flex items-center gap-2">
                <span>🔄</span>
                <span>محرك بدائل السلع والتوافقات المتعددة</span>
              </h3>
              <button 
                onClick={() => setIsAlternativesModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 text-[11px] text-indigo-300 leading-relaxed font-sans">
                💡 <strong>آلية عمل محرك البدائل:</strong> قم بتحديد مستودع وبضائع في الجانب الأيمن (الأصناف الأساسية)، ثم اختر مستودعاً وبضائع بديلة متوافقة في الجانب الأيسر (الأصناف البديلة). فور الضغط على الربط، سيقوم المعالج التلقائي بربطهم كبدائل متكافئة وحفظها في كتالوج السلع والتحويلات لمواجهة النقص والندرة في صالات البيع!
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* RIGHT COLUMN: PRIMARY ITEMS (الأصناف الأساسية) */}
                <div className="space-y-3 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>الجدول الأول: الأصناف الأساسية / الشحيحة</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">حدد مستودع الصنف الأساسي:</label>
                      <select 
                        value={altLeftWarehouse}
                        onChange={(e) => {
                          setAltLeftWarehouse(e.target.value);
                          setSelectedLeftProductIds([]);
                        }}
                        className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-2 text-xs focus:outline-none font-bold"
                      >
                        {dbWarehouses.map((wh, idx) => (
                          <option key={idx} value={wh}>{wh}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">بحث في الأصناف الأساسية:</label>
                      <input 
                        type="text"
                        value={altLeftSearch}
                        onChange={(e) => setAltLeftSearch(e.target.value)}
                        placeholder="ابحث بالاسم أو الرمز..."
                        className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-2 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1 custom-scroll">
                    {items.filter(it => {
                      const matchWarehouse = (it.warehouseName || 'المستودع الرئيسي للصالات') === altLeftWarehouse;
                      const matchSearch = it.name.includes(altLeftSearch) || (it.barcode || '').includes(altLeftSearch);
                      return matchWarehouse && matchSearch;
                    }).length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-xs font-sans">لا توجد أصناف تطابق الفلاتر في هذا المستودع.</div>
                    ) : (
                      items.filter(it => {
                        const matchWarehouse = (it.warehouseName || 'المستودع الرئيسي للصالات') === altLeftWarehouse;
                        const matchSearch = it.name.includes(altLeftSearch) || (it.barcode || '').includes(altLeftSearch);
                        return matchWarehouse && matchSearch;
                      }).map((item) => {
                        const isChecked = selectedLeftProductIds.includes(item.id);
                        return (
                          <div 
                            key={item.id} 
                            onClick={() => {
                              setSelectedLeftProductIds(prev => 
                                isChecked ? prev.filter(id => id !== item.id) : [...prev, item.id]
                              );
                            }}
                            className={`p-2.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                              isChecked 
                                ? 'bg-emerald-500/10 border-emerald-500/30' 
                                : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => {}} // handled by click
                              className="rounded border-white/10 text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                            <div className="flex-1 text-right">
                              <span className="font-bold text-white text-xs block">{item.name}</span>
                              <span className="text-[9px] text-gray-400 block mt-0.5">
                                الرمز: {item.barcode} | المخزون: <strong className="text-gray-200">{item.stock} حبة</strong> | السعر: {item.price} ر.ي
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  <div className="text-[10px] text-gray-400 font-sans">
                    تم تحديد <strong className="text-emerald-400">{selectedLeftProductIds.length}</strong> أصناف رئيسية.
                  </div>
                </div>

                {/* LEFT COLUMN: ALTERNATIVE ITEMS (الأصناف البديلة) */}
                <div className="space-y-3 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <span>الجدول الثاني: التوافقات والبدائل الجاهزة</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">حدد مستودع الصنف البديل:</label>
                      <select 
                        value={altRightWarehouse}
                        onChange={(e) => {
                          setAltRightWarehouse(e.target.value);
                          setSelectedRightProductIds([]);
                        }}
                        className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-2 text-xs focus:outline-none font-bold"
                      >
                        {dbWarehouses.map((wh, idx) => (
                          <option key={idx} value={wh}>{wh}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">بحث في الأصناف البديلة:</label>
                      <input 
                        type="text"
                        value={altRightSearch}
                        onChange={(e) => setAltRightSearch(e.target.value)}
                        placeholder="ابحث بالاسم أو الرمز..."
                        className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-2 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1 custom-scroll">
                    {items.filter(it => {
                      const matchWarehouse = (it.warehouseName || 'المستودع الرئيسي للصالات') === altRightWarehouse;
                      const matchSearch = it.name.includes(altRightSearch) || (it.barcode || '').includes(altRightSearch);
                      return matchWarehouse && matchSearch;
                    }).length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-xs font-sans">لا توجد أصناف تطابق الفلاتر في هذا المستودع.</div>
                    ) : (
                      items.filter(it => {
                        const matchWarehouse = (it.warehouseName || 'المستودع الرئيسي للصالات') === altRightWarehouse;
                        const matchSearch = it.name.includes(altRightSearch) || (it.barcode || '').includes(altRightSearch);
                        return matchWarehouse && matchSearch;
                      }).map((item) => {
                        const isChecked = selectedRightProductIds.includes(item.id);
                        return (
                          <div 
                            key={item.id} 
                            onClick={() => {
                              setSelectedRightProductIds(prev => 
                                isChecked ? prev.filter(id => id !== item.id) : [...prev, item.id]
                              );
                            }}
                            className={`p-2.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                              isChecked 
                                ? 'bg-indigo-500/10 border-indigo-500/30' 
                                : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => {}} // handled by click
                              className="rounded border-white/10 text-indigo-500 focus:ring-0 cursor-pointer"
                            />
                            <div className="flex-1 text-right">
                              <span className="font-bold text-white text-xs block">{item.name}</span>
                              <span className="text-[9px] text-gray-400 block mt-0.5">
                                الرمز: {item.barcode} | المخزون: <strong className="text-gray-200">{item.stock} حبة</strong> | السعر: {item.price} ر.ي
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="text-[10px] text-gray-400 font-sans">
                    تم تحديد <strong className="text-indigo-400">{selectedRightProductIds.length}</strong> أصناف بديلة متوافقة.
                  </div>
                </div>

              </div>

            </div>

            <div className="p-4 bg-white/[0.01] border-t border-white/5 flex justify-between items-center">
              <span className="text-xs text-gray-400">
                الربط سينتج عنه علاقة بدائل متبادلة وتحديث فوري.
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsAlternativesModalOpen(false)}
                  className="px-5 py-2.5 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء وعودة
                </button>
                <button 
                  onClick={handleSaveAlternativesMapping}
                  className="px-5 py-2.5 bg-gradient-to-l from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-lg"
                >
                  <span>🔗</span>
                  <span>حفظ ومطابقة التوافقات والبدائل</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: GLOBAL WARRANTY SETTINGS (المهمة 1) ================= */}
      {isGlobalWarrantyModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-[3px] z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-royal-card rounded-3xl border border-amber-500/35 overflow-hidden shadow-2xl animate-fade-in text-right">
            
            <div className="p-6 border-b border-amber-500/15 flex justify-between items-center bg-gradient-to-l from-amber-500/5 to-transparent">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛡️</span>
                <h3 className="text-base font-black text-amber-500">سياسة الضمان العامة للأصناف والسلع</h3>
              </div>
              <button 
                onClick={() => setIsGlobalWarrantyModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-bold">نوع وضوابط الضمان الافتراضي</label>
                <select
                  value={globalWarrantyType}
                  onChange={(e) => setGlobalWarrantyType(e.target.value)}
                  className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-sans font-bold"
                >
                  <option value="none">بلا ضمان (افتراضي)</option>
                  <option value="replacement_same">ضمان استبدال بنفس الصنف</option>
                  <option value="return_policy">ضمان إرجاع واسترداد مالي</option>
                  <option value="replace_other">ضمان تبديل بصنف آخر</option>
                </select>
              </div>

              {globalWarrantyType !== 'none' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 font-bold">المدة الافتراضية للضمان (بالأيام)</label>
                  <input
                    type="number"
                    min="1"
                    value={globalWarrantyDuration}
                    onChange={(e) => setGlobalWarrantyDuration(Number(e.target.value))}
                    placeholder="مثال: 90 يوماً، 180 يوماً، 360 يوماً..."
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono font-bold"
                  />
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => setGlobalWarrantyDuration(90)}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] rounded"
                    >
                      3 أشهر (90 يوم)
                    </button>
                    <button 
                      onClick={() => setGlobalWarrantyDuration(180)}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] rounded"
                    >
                      6 أشهر (180 يوم)
                    </button>
                    <button 
                      onClick={() => setGlobalWarrantyDuration(365)}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] rounded"
                    >
                      سنة (365 يوم)
                    </button>
                  </div>
                </div>
              )}

              {globalWarrantyType !== 'none' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 font-bold">آلية التعويض الافتراضية</label>
                  <select
                    value={globalCompensationOption}
                    onChange={(e) => setGlobalCompensationOption(e.target.value)}
                    className="w-full bg-[#111215] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-sans font-bold"
                  >
                    <option value="replace_same">استبدال بنفس الصنف المرتجع</option>
                    <option value="replace_other">استبدال بصنف آخر بناءً على الطلب</option>
                    <option value="refund">استرداد مالي مباشر (كاش/رصيد دائن)</option>
                  </select>
                </div>
              )}

              <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl space-y-3">
                <label className="block text-xs text-amber-500 font-black">نطاق تطبيق السياسة</label>
                
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                    <input
                      type="radio"
                      name="globalWarrantyScope"
                      checked={globalWarrantyScope === 'new_only'}
                      onChange={() => setGlobalWarrantyScope('new_only')}
                      className="accent-amber-500"
                    />
                    <span>تطبيق على الأصناف الجديدة فقط (كقيمة افتراضية)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                    <input
                      type="radio"
                      name="globalWarrantyScope"
                      checked={globalWarrantyScope === 'all'}
                      onChange={() => setGlobalWarrantyScope('all')}
                      className="accent-amber-500"
                    />
                    <span className="text-amber-400 font-bold">تطبيق وتحديث جميع الأصناف الحالية في المخزن فوراً</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-900 border-t border-amber-500/10 flex justify-end gap-2 shrink-0">
              <button 
                onClick={() => setIsGlobalWarrantyModalOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-xs rounded-xl"
              >
                إلغاء
              </button>
              <button 
                onClick={handleSaveGlobalWarranty}
                className="px-5 py-2 royal-btn-gold text-black font-black text-xs rounded-xl"
              >
                حفظ وتطبيق السياسة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: EXCEL QUICK INGESTION WORKSPACE (المهمة 1) ================= */}
      {isExcelGridOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-[4px] z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-7xl bg-royal-card rounded-3xl border border-amber-500/35 overflow-hidden shadow-2xl animate-fade-in text-right flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-5 border-b border-amber-500/15 flex justify-between items-center bg-gradient-to-l from-amber-500/10 to-transparent shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h3 className="text-base font-black text-amber-500">منظومة الإدخال السريع للسلع والأصناف (Excel Ingest Tool)</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">إضافة سريعة ومتتالية لكافة محتويات مخزنك دفعة واحدة وبضغطة زر</p>
                </div>
              </div>
              <button 
                onClick={() => setIsExcelGridOpen(false)}
                className="p-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 hide-scroll flex-1">
              
              {/* 1. Setup Panel (لوحة الإعدادات الافتراضية) */}
              <div className="bg-[#111215] border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 bg-amber-500 h-full"></div>
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                      <span>⚙️</span>
                      <span>لوحة الإعدادات الافتراضية المسبقة للدفعة</span>
                    </h4>
                    <p className="text-[10px] text-gray-400">تحدد المخزن والمورد مرة واحدة فقط في البداية لتثبيت إدخال البيانات في الجدول بسرعة</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
                    {/* Warehouse Selection */}
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1 font-bold">المستودع المستهدف</label>
                      <select
                        disabled={isSetupLocked}
                        value={setupWarehouse}
                        onChange={(e) => setSetupWarehouse(e.target.value)}
                        className={`w-full bg-zinc-900 text-white border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans font-bold ${isSetupLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {dbWarehouses.map((wh) => (
                          <option key={wh} value={wh}>{wh}</option>
                        ))}
                      </select>
                    </div>

                    {/* Supplier Selection with Add New Supplier */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] text-gray-400 font-bold">المورد الافتراضي للدفعة</label>
                        {!isSetupLocked && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuickSupplierSourceContext('setup');
                              setQuickSupplierName('');
                              setQuickSupplierPhone('');
                              setQuickSupplierCompany('');
                              setIsQuickAddSupplierModalOpen(true);
                            }}
                            className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/20 transition-all"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>إضافة مورد جديد</span>
                          </button>
                        )}
                      </div>
                      <select
                        disabled={isSetupLocked}
                        value={setupSupplier}
                        onChange={(e) => setSetupSupplier(e.target.value)}
                        className={`w-full bg-zinc-900 text-white border border-white/10 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans font-bold ${isSetupLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="">-- اختر مورد الصنف --</option>
                        {suppliers.map((sup) => (
                          <option key={sup.id} value={sup.name}>{sup.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Fix/Lock Button */}
                  <div className="shrink-0">
                    {isSetupLocked ? (
                      <button
                        onClick={handleUnlockSetup}
                        className="px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl font-black text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        🔓 تعديل الإعدادات الافتراضية
                      </button>
                    ) : (
                      <button
                        onClick={handleLockSetup}
                        className="px-6 py-2.5 bg-gradient-to-l from-amber-500 to-amber-600 hover:opacity-95 text-black rounded-xl font-black text-xs shadow-lg shadow-amber-500/10 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        📌 تثبيت الإعدادات
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Excel-Like Grid Workspace (المهمة 2) */}
              <div className="space-y-4 text-right">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <span>📋</span>
                    <span>جدول الإدخال السريع الذكي (Excel-Grid View)</span>
                  </h4>
                  <span className="text-[10px] px-2.5 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono">
                    {isSetupLocked ? "منظومة الإدخال السريع نشطة وجاهزة" : "بانتظار تثبيت الإعدادات الافتراضية للدفعة"}
                  </span>
                </div>

                {!isSetupLocked ? (
                  <div className="border border-white/5 bg-white/[0.01] rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 min-h-[300px]">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-xl font-bold animate-pulse">🔒</div>
                    <div className="space-y-1">
                      <h5 className="text-xs font-black text-white">الجدول مقفل حالياً</h5>
                      <p className="text-[11px] text-gray-400 max-w-md mx-auto leading-relaxed">
                        يرجى تحديد المخزن والمورد من لوحة الإعدادات الافتراضية بالأعلى ثم الضغط على زر 
                        <strong className="text-amber-500"> "تثبيت الإعدادات" </strong> 
                        لتنشيط الجدول وفتح شبكة إدخال السلع فوراً.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    <div className="border border-amber-500/15 rounded-2xl overflow-hidden bg-[#121316] shadow-inner">
                      <div className="overflow-x-auto max-h-[480px] hide-scroll">
                        <table className="w-full text-right border-collapse text-[11px] min-w-[1000px]">
                          <thead className="bg-[#18191d] text-gray-400 border-b border-white/5 sticky top-0 z-10 select-none">
                            <tr>
                              <th className="p-3 text-center w-12 font-bold">#</th>
                              <th className="p-3 text-right min-w-[160px] font-bold">الباركود (Barcode)</th>
                              <th className="p-3 text-right min-w-[240px] font-bold">اسم الصنف (Product Name) <span className="text-rose-500">*</span></th>
                              <th className="p-3 text-center w-24 font-bold">الكمية (الرصيد)</th>
                              <th className="p-3 text-center w-28 font-bold">سعر الشراء (التكلفة)</th>
                              <th className="p-3 text-center w-28 font-bold">سعر التجزئة (البيع)</th>
                              <th className="p-3 text-center w-28 font-bold">سعر الجملة</th>
                              <th className="p-3 text-center w-32 font-bold">إضافة سطر</th>
                              <th className="p-3 text-center w-16 font-bold">إلغاء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {gridRows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-white/[0.015] transition-colors">
                                {/* Index */}
                                <td className="p-2 text-center text-gray-500 font-mono font-bold select-none bg-black/10">
                                  {idx + 1}
                                </td>

                                {/* Barcode */}
                                <td className="p-1">
                                  <input
                                    type="text"
                                    id={`grid-barcode-${idx}`}
                                    value={row.barcode}
                                    onChange={(e) => handleCellChange(idx, 'barcode', e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 'barcode')}
                                    placeholder="ادخل الباركود أو اضغط Enter للتوليد"
                                    className="w-full bg-[#16181c] border border-white/5 focus:border-amber-500/50 focus:bg-amber-500/[0.02] rounded-lg p-2 text-xs focus:outline-none font-mono text-white text-center transition-all"
                                  />
                                </td>

                                {/* Name */}
                                <td className="p-1">
                                  <input
                                    type="text"
                                    id={`grid-name-${idx}`}
                                    value={row.name}
                                    onChange={(e) => handleCellChange(idx, 'name', e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 'name')}
                                    placeholder="اسم السلعة / الموديل / اللون..."
                                    className="w-full bg-[#16181c] border border-white/5 focus:border-amber-500/50 focus:bg-amber-500/[0.02] rounded-lg p-2 text-xs focus:outline-none font-sans font-bold text-right text-white transition-all placeholder:text-gray-600"
                                  />
                                </td>

                                {/* Quantity */}
                                <td className="p-1">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    id={`grid-quantity-${idx}`}
                                    value={row.quantity}
                                    onChange={(e) => handleCellChange(idx, 'quantity', e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 'quantity')}
                                    placeholder="0"
                                    className="w-full bg-[#16181c] border border-white/5 focus:border-amber-500/50 focus:bg-amber-500/[0.02] rounded-lg p-2 text-xs focus:outline-none font-mono text-center text-white transition-all"
                                  />
                                </td>

                                {/* Cost */}
                                <td className="p-1">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    id={`grid-cost-${idx}`}
                                    value={row.cost}
                                    onChange={(e) => handleCellChange(idx, 'cost', e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 'cost')}
                                    placeholder="0"
                                    className="w-full bg-[#16181c] border border-white/5 focus:border-amber-500/50 focus:bg-amber-500/[0.02] rounded-lg p-2 text-xs focus:outline-none font-mono text-center text-amber-500 transition-all"
                                  />
                                </td>

                                {/* Price */}
                                <td className="p-1">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    id={`grid-price-${idx}`}
                                    value={row.price}
                                    onChange={(e) => handleCellChange(idx, 'price', e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 'price')}
                                    placeholder="0"
                                    className="w-full bg-[#16181c] border border-white/5 focus:border-amber-500/50 focus:bg-amber-500/[0.02] rounded-lg p-2 text-xs focus:outline-none font-mono text-center text-emerald-400 transition-all"
                                  />
                                </td>

                                {/* Wholesale Price */}
                                <td className="p-1">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    id={`grid-wholesalePrice-${idx}`}
                                    value={row.wholesalePrice}
                                    onChange={(e) => handleCellChange(idx, 'wholesalePrice', e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 'wholesalePrice')}
                                    placeholder="0"
                                    className="w-full bg-[#16181c] border border-white/5 focus:border-amber-500/50 focus:bg-amber-500/[0.02] rounded-lg p-2 text-xs focus:outline-none font-mono text-center text-emerald-500 transition-all"
                                  />
                                </td>

                                {/* Quick Add Row Action */}
                                <td className="p-1 text-center">
                                  <button
                                    type="button"
                                    onClick={handleAddRowManual}
                                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg text-[10px] font-black cursor-pointer transition-all border border-amber-500/20"
                                  >
                                    ➕ سطر جديد
                                  </button>
                                </td>

                                {/* Actions */}
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRow(idx)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                                    title="حذف هذا الصف"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Control Bar inside the grid */}
                      <div className="p-4 bg-[#14151a] border-t border-white/5 flex flex-row-reverse justify-between items-center text-[11px]">
                        <button
                          type="button"
                          onClick={handleAddRowManual}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors border border-white/10"
                        >
                          <span>➕</span>
                          <span>إضافة صف جديد يدوياً</span>
                        </button>
                        
                        <div className="text-gray-400">
                          عدد الصفوف النشطة حالياً بالجدول: <span className="text-amber-500 font-bold font-mono">{gridRows.length} صفّاً</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl flex items-center gap-3">
                      <span className="text-base">💡</span>
                      <p className="text-[10.5px] text-gray-300 leading-relaxed">
                        <strong className="text-amber-500">ملاحظة التنقل السريع:</strong> يمكنك التنقل بسلاسة وبسرعة بين الخانات بالضغط على زر <strong className="text-white">Enter</strong>. إذا كان حقل الباركود فارغاً، سيؤدي الضغط على Enter لتوليد باركود فريد بترميز المحل وتمرير التركيز لاسم السلعة مباشرة. عند الوصول لنهاية السطر، سيقوم الضغط على Enter بإنشاء سطر جديد والانتقال لبدايته فوراً.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-zinc-900 border-t border-amber-500/10 flex justify-end gap-2 shrink-0">
              <button 
                onClick={() => setIsExcelGridOpen(false)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                إلغاء وإغلاق الجدول
              </button>
              
              {isSetupLocked && (
                <button 
                  onClick={handleCommitBatch}
                  className="px-6 py-2.5 bg-gradient-to-l from-emerald-500 to-emerald-600 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/10 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  💾 حفظ واعتماد دفعة السلع ({gridRows.length})
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* --- Quick Add Supplier Modal (نافذة إضافة مورد جديد السريعة) --- */}
      {isQuickAddSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111215] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">إضافة مورد جديد</h3>
                  <p className="text-[11px] text-gray-400">إضافة مورد لدفتر الموردين واعتماده مباشرة للصنف</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAddSupplierModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSupplier} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1.5 font-bold">اسم المورد أو الشركة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شركة النجم للتوريدات"
                  value={quickSupplierName}
                  onChange={(e) => setQuickSupplierName(e.target.value)}
                  className="w-full bg-[#18191e] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1.5 font-bold">رقم الهاتف أو الواتساب</label>
                <input
                  type="tel"
                  placeholder="مثال: 777123456"
                  value={quickSupplierPhone}
                  onChange={(e) => setQuickSupplierPhone(e.target.value)}
                  className="w-full bg-[#18191e] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1.5 font-bold">اسم المؤسسة / المتجر (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: مؤسسة التقنية الحديثة"
                  value={quickSupplierCompany}
                  onChange={(e) => setQuickSupplierCompany(e.target.value)}
                  className="w-full bg-[#18191e] text-white border border-white/10 rounded-xl p-3 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddSupplierModalOpen(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-gradient-to-l from-amber-500 to-[#fbbf24] hover:opacity-95 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4 text-black stroke-[3]" />
                  <span>حفظ واعتماد المورد</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Processing overlay blocker --- */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-amber-500/15 border-t-amber-500 animate-spin"></div>
          <p className="text-amber-500 font-bold text-xs tracking-wider animate-pulse font-sans">
            جاري معالجة عمليات المخزن الفيدرالي لـ JAM SYSTEM PRO v4.0...
          </p>
        </div>
      )}

    </div>
  );
}
