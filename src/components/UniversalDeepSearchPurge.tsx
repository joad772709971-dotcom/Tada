import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, limit, query, Timestamp } from 'firebase/firestore';
import { 
  Search, RefreshCw, Layers, CheckSquare, Square, 
  Database, Sparkles, 
  Users, Package, Receipt, ShoppingBag, MessageSquare, 
  DollarSign, Wrench, Eye, X, Building, 
  ChevronDown, ChevronUp, Copy, Download, 
  SlidersHorizontal, Tag, Check
} from 'lucide-react';

export interface SearchCollectionDef {
  name: string;
  label: string;
  desc?: string;
}

export interface SearchCategoryConfig {
  id: string;
  name: string;
  desc: string;
  icon: any;
  colorClass: string;
  badgeBg: string;
  collections: SearchCollectionDef[];
}

export const UNIVERSAL_SEARCH_CATEGORIES: SearchCategoryConfig[] = [
  {
    id: 'users_accounts',
    name: 'المستخدمين والحسابات والمتاجر',
    desc: 'حسابات الملاك، مدراء الفروع، الموظفين، المهندسين، المتاجر وملفات B2B',
    icon: Users,
    colorClass: 'text-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    collections: [
      { name: 'users', label: 'حسابات المستخدمين' },
      { name: 'user_profiles', label: 'الملفات الشخصية' },
      { name: 'engineers', label: 'المهندسين والفنيين' },
      { name: 'employees', label: 'الموظفين والكادر' },
      { name: 'staff', label: 'طاقم العمل' },
      { name: 'shops', label: 'المتاجر والمحلات' },
      { name: 'b2bStoreProfiles', label: 'ملفات تجار B2B' },
      { name: 'maintenanceTechs', label: 'فنيي الصيانة' }
    ]
  },
  {
    id: 'products_inventory',
    name: 'المنتجات والمخازن والسيريلات',
    desc: 'أصناف المخزون، الباركود، المنتجات، المخازن، قطع الغيار، السيريلات والتالف',
    icon: Package,
    colorClass: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    collections: [
      { name: 'inventory', label: 'المخزون الرئيسي' },
      { name: 'products', label: 'المنتجات والأصناف' },
      { name: 'warehouses', label: 'المستودعات والمخازن' },
      { name: 'categories', label: 'التصنيفات والأقسام' },
      { name: 'serials', label: 'الأرقام التسلسلية والسيريلات' },
      { name: 'spareParts', label: 'قطع الغيار' },
      { name: 'damaged_goods', label: 'البضاعة التالفة' },
      { name: 'damagedItems', label: 'الأصناف الهالكة' },
      { name: 'warehouseStocks', label: 'أرصدة المستودعات' }
    ]
  },
  {
    id: 'sales_invoices',
    name: 'المبيعات والمشتريات والسندات',
    desc: 'فواتير المبيعات، المشتريات، المرتجعات، سندات الصرف والقبض وفواتير الانتظار',
    icon: Receipt,
    colorClass: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    collections: [
      { name: 'sales', label: 'فواتير المبيعات' },
      { name: 'invoices', label: 'الفواتير العامة' },
      { name: 'purchases', label: 'فواتير المشتريات' },
      { name: 'returns', label: 'مرتجعات المبيعات' },
      { name: 'bonds', label: 'السندات والقيود' },
      { name: 'vouchers', label: 'سندات الصرف والقبض' },
      { name: 'held_invoices', label: 'فواتير الانتظار والمعلقة' },
      { name: 'cart_drafts', label: 'مسودات السلة' },
      { name: 'settlementInvoices', label: 'فواتير التسوية' }
    ]
  },
  {
    id: 'market_orders',
    name: 'السوق الإلكتروني والطلبات و B2B',
    desc: 'طلبات الجملة، منتجات السوق المشترك، المعاملات، العروض والمزادات',
    icon: ShoppingBag,
    colorClass: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    collections: [
      { name: 'market_orders', label: 'طلبات السوق' },
      { name: 'market_products', label: 'منتجات السوق الإلكتروني' },
      { name: 'b2b_transactions', label: 'معاملات شبكة B2B' },
      { name: 'orders', label: 'الطلبات العامة' },
      { name: 'networkOrders', label: 'طلبات شبكة الجملة' },
      { name: 'wholesaleProducts', label: 'منتجات الجملة' },
      { name: 'auctions', label: 'المزادات والأوكازيون' },
      { name: 'b2bConnections', label: 'روابط الربط التجاري' }
    ]
  },
  {
    id: 'messages_complaints',
    name: 'الرسائل والمحادثات والشكاوى',
    desc: 'محادثات الدعم، رسائل الشات، التذاكر، الشكاوى والإشعارات وسجلات النظام',
    icon: MessageSquare,
    colorClass: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    collections: [
      { name: 'messages', label: 'رسائل النظام' },
      { name: 'chats', label: 'محادثات الشات' },
      { name: 'complaints', label: 'الشكاوى والبلاغات' },
      { name: 'tickets', label: 'تذاكر الدعم الفني' },
      { name: 'notifications', label: 'سجل الإشعارات' },
      { name: 'systemLogs', label: 'سجلات أحداث النظام' },
      { name: 'activity_logs', label: 'سجلات الأنشطة والعمليات' },
      { name: 'activityLogs', label: 'سجلات التتبع' }
    ]
  },
  {
    id: 'financial_ledger',
    name: 'العمليات المالية والقيود والخزائن',
    desc: 'حركات الصناديق، الأرصدة، الإقفالات اليومية، حركات البنوك والقيود المحاسبية',
    icon: DollarSign,
    colorClass: 'text-yellow-400',
    badgeBg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    collections: [
      { name: 'daily_closings', label: 'الإقفالات اليومية' },
      { name: 'vault_transactions', label: 'حركات الخزائن والصناديق' },
      { name: 'journal_entries', label: 'القيود المحاسبية المركزية' },
      { name: 'transactions', label: 'الحركات المالية' },
      { name: 'balanceTransactions', label: 'حركات الرصيد والتحويلات' },
      { name: 'vaults', label: 'الخزائن والصناديق الرئيسية' },
      { name: 'drawers', label: 'أدراج الكاشير' }
    ]
  },
  {
    id: 'customers_suppliers',
    name: 'العملاء والموردين والديون',
    desc: 'دليل العملاء، الموردين، حسابات الذمم، الديون وأرصدة الأطراف',
    icon: Building,
    colorClass: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    collections: [
      { name: 'customers', label: 'دليل الزبائن والعملاء' },
      { name: 'clients', label: 'العملاء المسجلين' },
      { name: 'suppliers', label: 'دليل الموردين' },
      { name: 'debts', label: 'سجلات الديون والذمم' },
      { name: 'accounts', label: 'دفاتر الحسابات' }
    ]
  },
  {
    id: 'maintenance_tickets',
    name: 'الصيانة وتذاكر فحص الأجهزة',
    desc: 'طلبات الصيانة، كروت الاستلام، الأجهزة المسجلة وتذاكر الفحص الفني',
    icon: Wrench,
    colorClass: 'text-orange-400',
    badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    collections: [
      { name: 'maintenanceOrders', label: 'طلبات الصيانة والاستلام' },
      { name: 'repairs', label: 'عمليات الإصلاح الفني' },
      { name: 'devices', label: 'سجلات أجهزة الصيانة' }
    ]
  }
];

export interface SearchResultItem {
  id: string;
  docId: string;
  collectionName: string;
  collectionLabel: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: any;
  title: string;
  subtitle: string;
  ownerId?: string;
  shopName?: string;
  phone?: string;
  amount?: number;
  dateStr?: string;
  dateTimestamp?: number;
  rawData: Record<string, any>;
  matchedFields: string[];
}

export type FilterFieldType = 'all' | 'name' | 'phone' | 'id' | 'code' | 'amount';

export default function UniversalDeepSearchPurge() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterField, setFilterField] = useState<FilterFieldType>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [docsPerCollectionLimit, setDocsPerCollectionLimit] = useState<number>(200);
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [inspectedItem, setInspectedItem] = useState<SearchResultItem | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const [searchStats, setSearchStats] = useState<{
    scannedCollections: number;
    scannedDocs: number;
    matchedDocs: number;
    durationMs: number;
  } | null>(null);

  const [currentScanningCollection, setCurrentScanningCollection] = useState<string | null>(null);
  const [scanProgressPercent, setScanProgressPercent] = useState<number>(0);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Quick Preset Searches
  const PRESET_QUERIES = [
    { label: '🧑‍💼 المستخدمين (77)', query: '77', cat: 'users_accounts', field: 'all' as FilterFieldType },
    { label: '📱 هاتف (7)', query: '7', cat: 'all', field: 'phone' as FilterFieldType },
    { label: '💰 مبيعات اليوم', query: 'sale', cat: 'sales_invoices', field: 'all' as FilterFieldType },
    { label: '🔧 صيانة أجهزة', query: 'صيانة', cat: 'maintenance_tickets', field: 'all' as FilterFieldType },
    { label: '🛒 منتجات السوق', query: 'منتج', cat: 'market_orders', field: 'all' as FilterFieldType },
    { label: '🏢 زبائن وعملاء', query: 'عميل', cat: 'customers_suppliers', field: 'all' as FilterFieldType }
  ];

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Safe string normalization for Arabic & case-insensitive matching
  const normalizeText = (txt: any): string => {
    if (txt === null || txt === undefined) return '';
    return String(txt)
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F]/g, ''); // Remove Arabic diacritics
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const executeDeepSearch = async (overrideTerm?: string, overrideCategory?: string, overrideField?: FilterFieldType) => {
    const termToUse = overrideTerm !== undefined ? overrideTerm : searchTerm;
    const catToUse = overrideCategory !== undefined ? overrideCategory : selectedCategory;
    const fieldToUse = overrideField !== undefined ? overrideField : filterField;

    const term = termToUse.trim();
    if (!term) {
      alert('الرجاء إدخال كلمة أو رقم هاتف أو اسم أو معرف للبحث الشامل في كافة قواعد بيانات فايربيس!');
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setSelectedResultIds([]);
    setScanProgressPercent(0);

    const startTime = performance.now();
    const normalizedTerm = normalizeText(term);

    const categoriesToScan = catToUse === 'all' 
      ? UNIVERSAL_SEARCH_CATEGORIES 
      : UNIVERSAL_SEARCH_CATEGORIES.filter(c => c.id === catToUse);

    let totalCols = 0;
    categoriesToScan.forEach(c => totalCols += c.collections.length);

    const resultsAccumulator: SearchResultItem[] = [];
    let scannedCollectionsCount = 0;
    let scannedDocsCount = 0;

    for (const cat of categoriesToScan) {
      for (const colCfg of cat.collections) {
        scannedCollectionsCount++;
        setCurrentScanningCollection(colCfg.label);
        setScanProgressPercent(Math.round((scannedCollectionsCount / totalCols) * 100));

        try {
          const colRef = collection(db, colCfg.name);
          const snap = await getDocs(query(colRef, limit(docsPerCollectionLimit)));
          scannedDocsCount += snap.size;

          snap.docs.forEach(docSnap => {
            const data = docSnap.data();
            const docId = docSnap.id;
            const matchedFields: string[] = [];

            // Owner ID filter check if specified
            if (ownerFilter.trim()) {
              const normOwnerFilter = normalizeText(ownerFilter.trim());
              const docOwner = normalizeText(data.ownerId || data.storeId || data.userId || data.uid || '');
              if (docOwner && !docOwner.includes(normOwnerFilter)) {
                return;
              }
            }

            // 1. Check ID / Doc ID matching
            if (fieldToUse === 'all' || fieldToUse === 'id' || fieldToUse === 'code') {
              if (normalizeText(docId).includes(normalizedTerm)) {
                matchedFields.push(`معرف المستند (ID): ${docId}`);
              }
            }

            // 2. Inspect data fields according to active filter
            for (const [key, value] of Object.entries(data)) {
              if (value === null || value === undefined) continue;

              const normKey = key.toLowerCase();

              // Check if key matches field filter intention
              if (fieldToUse === 'name') {
                const isNameKey = normKey.includes('name') || normKey.includes('title') || normKey.includes('label');
                if (!isNameKey) continue;
              } else if (fieldToUse === 'phone') {
                const isPhoneKey = normKey.includes('phone') || normKey.includes('mobile') || normKey.includes('tel');
                if (!isPhoneKey) continue;
              } else if (fieldToUse === 'code') {
                const isCodeKey = normKey.includes('barcode') || normKey.includes('code') || normKey.includes('serial') || normKey.includes('invoiceno') || normKey.includes('sku');
                if (!isCodeKey) continue;
              } else if (fieldToUse === 'amount') {
                const isAmountKey = normKey.includes('amount') || normKey.includes('total') || normKey.includes('price') || normKey.includes('cost') || normKey.includes('balance') || normKey.includes('paid');
                if (!isAmountKey) continue;
              }

              // Value Matching Logic
              if (typeof value === 'string' || typeof value === 'number') {
                const normVal = normalizeText(value);
                if (normVal.includes(normalizedTerm)) {
                  matchedFields.push(`${key}: ${String(value).slice(0, 50)}`);
                }
              } else if (Array.isArray(value)) {
                value.forEach((elem, arrIdx) => {
                  if (typeof elem === 'string' || typeof elem === 'number') {
                    if (normalizeText(elem).includes(normalizedTerm)) {
                      matchedFields.push(`${key}[${arrIdx}]: ${String(elem).slice(0, 40)}`);
                    }
                  } else if (typeof elem === 'object' && elem !== null) {
                    for (const [subKey, subVal] of Object.entries(elem)) {
                      if (typeof subVal === 'string' || typeof subVal === 'number') {
                        if (normalizeText(subVal).includes(normalizedTerm)) {
                          matchedFields.push(`${key}.${subKey}: ${String(subVal).slice(0, 40)}`);
                        }
                      }
                    }
                  }
                });
              } else if (typeof value === 'object' && !(value instanceof Timestamp)) {
                for (const [subKey, subVal] of Object.entries(value)) {
                  if (typeof subVal === 'string' || typeof subVal === 'number') {
                    if (normalizeText(subVal).includes(normalizedTerm)) {
                      matchedFields.push(`${key}.${subKey}: ${String(subVal).slice(0, 40)}`);
                    }
                  }
                }
              }
            }

            if (matchedFields.length > 0) {
              const title = data.name || data.shopName || data.title || data.customerName || data.productName || data.clientName || data.deviceModel || data.item || data.message || `مستند: ${docId.slice(0, 10)}`;
              const subtitle = data.phone || data.email || data.invoiceNo || data.barcode || data.notes || data.details || data.code || `ID: ${docId}`;
              let dateStr = '';
              let dateTimestamp = 0;

              if (data.createdAt) {
                try {
                  const d = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt);
                  if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleString('ar-YE');
                    dateTimestamp = d.getTime();
                  }
                } catch(e){}
              } else if (data.timestamp) {
                try {
                  const d = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp);
                  if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleString('ar-YE');
                    dateTimestamp = d.getTime();
                  }
                } catch(e){}
              } else if (data.date) {
                try {
                  const d = new Date(data.date);
                  if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleString('ar-YE');
                    dateTimestamp = d.getTime();
                  }
                } catch(e){}
              }

              resultsAccumulator.push({
                id: `${colCfg.name}___${docId}`,
                docId,
                collectionName: colCfg.name,
                collectionLabel: colCfg.label,
                categoryId: cat.id,
                categoryName: cat.name,
                categoryIcon: cat.icon,
                title: String(title),
                subtitle: String(subtitle),
                ownerId: data.ownerId || data.storeId || data.userId || data.uid,
                shopName: data.shopName || data.storeName,
                phone: data.phone || data.customerPhone || data.shopPhone || data.mobile,
                amount: data.total || data.amount || data.price || data.cost || data.balance,
                dateStr,
                dateTimestamp,
                rawData: { ...data, _docId: docId, _collection: colCfg.name, _scannedAt: new Date().toISOString() },
                matchedFields
              });
            }
          });

        } catch (err: any) {
          console.warn(`Safe skip error during search in ${colCfg.name}:`, err.message);
        }
      }
    }

    const duration = Math.round(performance.now() - startTime);
    setSearchResults(resultsAccumulator);
    setSearchStats({
      scannedCollections: scannedCollectionsCount,
      scannedDocs: scannedDocsCount,
      matchedDocs: resultsAccumulator.length,
      durationMs: duration
    });

    const newExpandedState: Record<string, boolean> = {};
    resultsAccumulator.forEach(r => {
      newExpandedState[r.categoryId] = true;
    });
    setExpandedCategories(newExpandedState);

    setCurrentScanningCollection(null);
    setScanProgressPercent(100);
    setIsSearching(false);
  };

  const toggleSelectResult = (compositeId: string) => {
    if (selectedResultIds.includes(compositeId)) {
      setSelectedResultIds(selectedResultIds.filter(x => x !== compositeId));
    } else {
      setSelectedResultIds([...selectedResultIds, compositeId]);
    }
  };

  const toggleSelectAllCategory = (catId: string) => {
    const itemsInCat = searchResults.filter(r => r.categoryId === catId).map(r => r.id);
    const allSelected = itemsInCat.every(id => selectedResultIds.includes(id));

    if (allSelected) {
      setSelectedResultIds(selectedResultIds.filter(id => !itemsInCat.includes(id)));
    } else {
      setSelectedResultIds(Array.from(new Set([...selectedResultIds, ...itemsInCat])));
    }
  };

  const toggleSelectAll = () => {
    if (selectedResultIds.length === searchResults.length) {
      setSelectedResultIds([]);
    } else {
      setSelectedResultIds(searchResults.map(r => r.id));
    }
  };

  const exportResultsJSON = () => {
    const dataToExport = selectedResultIds.length > 0 
      ? searchResults.filter(r => selectedResultIds.includes(r.id)).map(r => r.rawData)
      : searchResults.map(r => r.rawData);
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `universal-search-results-${searchTerm}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupedResults = useMemo(() => {
    return UNIVERSAL_SEARCH_CATEGORIES.map(cat => ({
      category: cat,
      items: searchResults.filter(r => r.categoryId === cat.id)
    })).filter(g => g.items.length > 0);
  }, [searchResults]);

  return (
    <div id="universal-deep-search-root" className="space-y-6 text-right font-sans" dir="rtl">
      {/* Top Banner & Control Deck */}
      <div id="universal-search-banner" className="bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 p-6 md:p-8 rounded-[2.5rem] border border-brand-primary/30 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-brand-primary/20 text-brand-primary rounded-2xl border border-brand-primary/30 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
              <Search size={32} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl md:text-2xl font-black text-white">
                  مركز البحث الشامل والتنظيف (Universal Deep Search & Purge)
                </h2>
                <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black rounded-full shadow-md">
                  المرحلة الأولى: محرك البحث الشامل والمتعدد 🚀
                </span>
              </div>
              <p className="text-xs text-gray-400 font-bold mt-1 max-w-3xl">
                محرك موحد فوري ومباشر 100% لفحص كافة جداول ومجموعات Firebase Firestore والنظام: المستخدمين، المخازن، المنتجات، المبيعات، السوق الإلكتروني، القيود المالية، والعملاء.
              </p>
            </div>
          </div>
        </div>

        {/* Search Input Bar & Trigger */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col md:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary" size={22} />
              <input
                id="deep-search-input"
                type="text"
                placeholder="ابحث عن: اسم عميل، رقم هاتف، كود UID، اسم صنف، باركود، رقم فاتورة، قيد مالي، كلمة في رسالة..."
                className="w-full pr-12 pl-10 py-4 bg-navy-900/90 border border-navy-700/80 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary text-sm text-white placeholder-gray-500 font-bold shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeDeepSearch();
                }}
              />
              {searchTerm && (
                <button
                  id="btn-clear-search"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <button
              id="btn-start-deep-search"
              onClick={() => executeDeepSearch()}
              disabled={isSearching || !searchTerm.trim()}
              className={`px-8 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl ${
                isSearching || !searchTerm.trim()
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-slate-950 hover:scale-105 shadow-amber-500/20 active:scale-95'
              }`}
            >
              {isSearching ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  <span>جاري فحص فايربيس...</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>بدء البحث الشامل 🚀</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Filter Presets */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
            <span className="text-gray-400 font-bold flex items-center gap-1 shrink-0">
              <Tag size={13} /> استعلامات سريعة:
            </span>
            {PRESET_QUERIES.map((preset, idx) => (
              <button
                key={idx}
                id={`btn-preset-query-${idx}`}
                onClick={() => {
                  setSearchTerm(preset.query);
                  if (preset.cat) setSelectedCategory(preset.cat);
                  if (preset.field) setFilterField(preset.field);
                  executeDeepSearch(preset.query, preset.cat, preset.field);
                }}
                className="px-3 py-1 bg-navy-900/80 hover:bg-navy-800 text-gray-300 hover:text-white rounded-xl border border-white/5 font-bold transition-all shrink-0 hover:border-brand-primary/40 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Advanced Multi-Filters Deck */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {/* 1. Target Field Filter */}
            <div className="bg-navy-900/60 p-3 rounded-2xl border border-white/5 space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                <SlidersHorizontal size={13} className="text-brand-primary" />
                <span>حقل الاستهداف المحدد (Field Type):</span>
              </label>
              <select
                id="select-filter-field"
                value={filterField}
                onChange={(e) => setFilterField(e.target.value as FilterFieldType)}
                className="w-full bg-navy-950 border border-navy-700/80 text-white font-bold text-xs p-2.5 rounded-xl outline-none focus:border-brand-primary"
              >
                <option value="all">🌐 فحص شامل في كافة الحقول</option>
                <option value="name">👤 الاسم والعنوان فقط (Name / Title)</option>
                <option value="phone">📞 رقم الهاتف فقط (Phone / Mobile)</option>
                <option value="id">🆔 المعرف الفريد والـ UID (Doc ID / UID)</option>
                <option value="code">🏷️ الباركود والأكواد المرجعية (Barcode / Code)</option>
                <option value="amount">💰 المبالغ والعمليات المالية (Amounts)</option>
              </select>
            </div>

            {/* 2. Store / Owner ID Filter */}
            <div className="bg-navy-900/60 p-3 rounded-2xl border border-white/5 space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                <Building size={13} className="text-brand-primary" />
                <span>حصر البحث بمتجر/مالك محدد (اختياري):</span>
              </label>
              <input
                id="input-owner-filter"
                type="text"
                placeholder="أدخل ownerId أو storeId أو اتركه فارغاً للكل..."
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="w-full bg-navy-950 border border-navy-700/80 text-white font-bold text-xs p-2.5 rounded-xl outline-none focus:border-brand-primary placeholder-gray-600"
              />
            </div>

            {/* 3. Document Scan Depth Limit */}
            <div className="bg-navy-900/60 p-3 rounded-2xl border border-white/5 space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                <Database size={13} className="text-brand-primary" />
                <span>عمق الفحص لكل مجموعة (Scan Depth Limit):</span>
              </label>
              <select
                id="select-scan-depth"
                value={docsPerCollectionLimit}
                onChange={(e) => setDocsPerCollectionLimit(Number(e.target.value))}
                className="w-full bg-navy-950 border border-navy-700/80 text-white font-bold text-xs p-2.5 rounded-xl outline-none focus:border-brand-primary"
              >
                <option value={50}>⚡ فحص سريع (50 مستنداً لكل كوليكشن)</option>
                <option value={200}>📊 فحص متوازن قياسي (200 مستند)</option>
                <option value={500}>🔍 فحص عميق مكثف (500 مستند)</option>
                <option value={1000}>🚀 فحص أقصى (1000 مستند لكل كوليكشن)</option>
              </select>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="pt-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              <button
                id="filter-category-all"
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg scale-105'
                    : 'bg-navy-900/70 text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                <Layers size={14} />
                <span>الكل (فحص كافة المجموعات السحابية)</span>
              </button>
              {UNIVERSAL_SEARCH_CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    id={`filter-category-${cat.id}`}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0 ${
                      isSelected
                        ? 'bg-brand-primary text-slate-950 shadow-lg scale-105'
                        : 'bg-navy-900/70 text-gray-400 hover:text-white border border-white/5'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Scanner Progress Bar */}
        {isSearching && (
          <div id="search-progress-bar" className="space-y-2 p-4 bg-navy-900/90 border border-brand-primary/40 rounded-2xl animate-pulse">
            <div className="flex items-center justify-between text-xs font-bold text-gray-300">
              <div className="flex items-center gap-2 text-brand-primary">
                <RefreshCw size={16} className="animate-spin" />
                <span>جاري فحص مجموعة: <strong className="text-white">{currentScanningCollection || '...'}</strong></span>
              </div>
              <span className="font-mono text-brand-primary">{scanProgressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-navy-950 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300 rounded-full"
                style={{ width: `${scanProgressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Search Stats & Bulk Actions Bar */}
      {searchStats && (
        <div id="search-stats-panel" className="bg-navy-900/70 p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-lg">
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
            <span className="text-gray-400">
              📊 تم فحص <span className="text-brand-primary font-black">{searchStats.scannedCollections}</span> مجموعة فايربيس
            </span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">
              📑 تم تحليل <span className="text-white font-black">{searchStats.scannedDocs}</span> مستنداً
            </span>
            <span className="text-gray-600">•</span>
            <span className="text-emerald-400">
              🎯 تم العثور على <span className="font-black text-sm">{searchStats.matchedDocs}</span> نتيجة مطابقة
            </span>
            <span className="text-gray-600">•</span>
            <span className="font-mono text-gray-400">
              ⏱️ استغرق: {searchStats.durationMs}ms
            </span>
          </div>

          {searchResults.length > 0 && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                id="btn-toggle-select-all"
                onClick={toggleSelectAll}
                className="px-3.5 py-1.5 bg-navy-800 hover:bg-navy-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/10 cursor-pointer"
              >
                {selectedResultIds.length === searchResults.length ? (
                  <CheckSquare size={14} className="text-brand-primary" />
                ) : (
                  <Square size={14} />
                )}
                <span>{selectedResultIds.length === searchResults.length ? 'إلغاء تحديد الكل' : 'تحديد جميع النتائج'}</span>
              </button>

              <button
                id="btn-export-results-json"
                onClick={exportResultsJSON}
                className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={14} />
                <span>تصدير النتائج (JSON)</span>
              </button>

              <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary border border-brand-primary/30 rounded-xl text-xs font-black">
                المحدد: {selectedResultIds.length} من {searchResults.length}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Results Groups View */}
      {searchResults.length > 0 ? (
        <div id="search-results-container" className="space-y-4">
          {groupedResults.map(({ category, items }) => {
            const Icon = category.icon;
            const isExpanded = expandedCategories[category.id] !== false;
            const itemsInCatSelected = items.filter(it => selectedResultIds.includes(it.id)).length;

            return (
              <div key={category.id} id={`category-card-${category.id}`} className="bg-navy-950/80 rounded-2xl border border-navy-700/60 overflow-hidden shadow-xl">
                {/* Category Header */}
                <div className="p-4 bg-navy-900/90 border-b border-navy-700/60 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      id={`btn-expand-cat-${category.id}`}
                      onClick={() => toggleCategoryExpand(category.id)}
                      className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <div className={`p-2.5 rounded-xl ${category.badgeBg}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm md:text-base text-white">{category.name}</h3>
                        <span className={`px-2.5 py-0.5 text-xs font-black rounded-full border ${category.badgeBg}`}>
                          {items.length} مطابقة
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{category.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id={`btn-select-cat-${category.id}`}
                      onClick={() => toggleSelectAllCategory(category.id)}
                      className="px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-gray-300 text-xs font-bold rounded-xl transition-all border border-navy-700 flex items-center gap-2 cursor-pointer"
                    >
                      {itemsInCatSelected === items.length ? (
                        <CheckSquare size={14} className="text-brand-primary" />
                      ) : (
                        <Square size={14} />
                      )}
                      <span>تحديد هذا القسم ({itemsInCatSelected}/{items.length})</span>
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {isExpanded && (
                  <div className="divide-y divide-navy-800/60">
                    {items.map((item) => {
                      const isSelected = selectedResultIds.includes(item.id);
                      return (
                        <div 
                          key={item.id} 
                          id={`result-row-${item.id}`}
                          className={`p-4 transition-all flex items-center justify-between gap-4 flex-wrap hover:bg-navy-900/50 ${
                            isSelected ? 'bg-brand-primary/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-[280px] flex-1">
                            <button
                              id={`btn-select-item-${item.id}`}
                              onClick={() => toggleSelectResult(item.id)}
                              className="p-1 mt-0.5 text-gray-400 hover:text-brand-primary transition-colors cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare size={20} className="text-brand-primary" />
                              ) : (
                                <Square size={20} />
                              )}
                            </button>

                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm md:text-base text-white">{item.title}</span>
                                <span className="px-2 py-0.5 bg-navy-800 text-amber-400 font-mono text-[10px] rounded-md border border-navy-700 font-bold">
                                  {item.collectionLabel} ({item.collectionName})
                                </span>
                                {item.shopName && (
                                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 font-bold text-[10px] rounded-md border border-blue-500/20">
                                    المتجر: {item.shopName}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-gray-400 font-medium">{item.subtitle}</p>

                              {/* Highlighted Match Pills */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[10px] text-gray-500 font-bold">الحقول المطابقة:</span>
                                {item.matchedFields.slice(0, 4).map((mf, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] rounded-md font-mono font-bold">
                                    ✓ {mf}
                                  </span>
                                ))}
                                {item.matchedFields.length > 4 && (
                                  <span className="text-[10px] text-gray-500">+{item.matchedFields.length - 4} حقول أخرى</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Meta Actions & Inspection */}
                          <div className="flex items-center gap-3 text-xs">
                            {item.amount !== undefined && (
                              <div className="text-right">
                                <span className="text-[10px] text-gray-500 block">المبلغ:</span>
                                <span className="font-black text-amber-400 font-mono text-sm">
                                  {Number(item.amount).toLocaleString('ar-YE')} ر.ي
                                </span>
                              </div>
                            )}

                            {item.dateStr && (
                              <div className="text-right hidden sm:block">
                                <span className="text-[10px] text-gray-500 block">التاريخ:</span>
                                <span className="text-[11px] text-gray-400 font-mono">
                                  {item.dateStr}
                                </span>
                              </div>
                            )}

                            <button
                              id={`btn-inspect-${item.id}`}
                              onClick={() => setInspectedItem(item)}
                              className="px-3 py-2 bg-navy-800 hover:bg-brand-primary hover:text-slate-950 text-gray-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-navy-700 cursor-pointer shadow-md"
                              title="معاينة المستند الخام من فايربيس"
                            >
                              <Eye size={14} />
                              <span>فحص المستند</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : isSearching ? (
        <div className="card-glass p-16 text-center space-y-4 rounded-3xl">
          <RefreshCw size={52} className="mx-auto text-brand-primary animate-spin" />
          <h3 className="text-xl font-bold text-white">جاري فحص كافة مجموعات فايربيس مباشرة...</h3>
          <p className="text-xs text-gray-400 font-mono">يتم تحليل الوثائق واستخراج الحقول المطابقة في الوقت الفعلي</p>
        </div>
      ) : searchStats && searchResults.length === 0 ? (
        <div className="card-glass p-16 text-center space-y-4 rounded-3xl border border-dashed border-white/10">
          <Database size={52} className="mx-auto text-gray-600" />
          <h3 className="text-lg font-bold text-white">لم يتم العثور على أي نتائج مطابقة لكلمة البحث في فايربيس</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            تأكد من كتابة الكلمة بشكل صحيح، أو جرب اختيار <strong>«فحص شامل في كافة الحقول»</strong> أو تغيير عمق الفحص.
          </p>
        </div>
      ) : (
        <div className="card-glass p-14 text-center space-y-4 rounded-3xl border border-dashed border-white/10">
          <Search size={52} className="mx-auto text-brand-primary opacity-60" />
          <h3 className="text-lg font-black text-white">محرك البحث الشامل جاهز للعمل وفحص السيرفر</h3>
          <p className="text-xs text-gray-400 max-w-xl mx-auto leading-relaxed">
            أدخل أي كلمة أو اسم عميل أو رقم هاتف أو كود UID أو باركود في الخانة أعلاه واضغط على <strong>«بدء البحث الشامل 🚀»</strong> لفحص جميع جداول ومجموعات Firebase Firestore في ثوانٍ معدودة.
          </p>
        </div>
      )}

      {/* Raw Document Inspection Modal */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md" dir="rtl">
          <div className="bg-navy-900 border border-navy-700/80 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleIn">
            <div className="p-5 bg-navy-950 border-b border-navy-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-primary/20 text-brand-primary rounded-2xl border border-brand-primary/30">
                  <Database size={22} />
                </div>
                <div>
                  <h3 className="font-black text-sm md:text-base text-white">بيانات المستند الخام في Firebase Firestore</h3>
                  <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                    المجموعة: <span className="text-emerald-400 font-bold">{inspectedItem.collectionName}</span> / المعرف: <span className="text-amber-400 font-bold">{inspectedItem.docId}</span>
                  </p>
                </div>
              </div>

              <button
                id="btn-close-inspect-modal"
                onClick={() => setInspectedItem(null)}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 text-xs">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3.5 bg-navy-950/70 rounded-2xl border border-navy-800 font-mono">
                <div>
                  <span className="text-gray-500 text-[10px] block">المجموعة (Collection):</span>
                  <span className="text-emerald-400 font-bold text-xs">{inspectedItem.collectionName}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">معرف الوثيقة (Doc ID):</span>
                  <span className="text-amber-400 font-bold text-xs">{inspectedItem.docId}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">مالك المستند (Owner):</span>
                  <span className="text-blue-400 font-bold text-xs">{inspectedItem.ownerId || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">التاريخ:</span>
                  <span className="text-gray-300 font-bold text-xs">{inspectedItem.dateStr || 'غير مسجل'}</span>
                </div>
              </div>

              {/* JSON Code Viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-300 flex items-center gap-1.5">
                    <span>محتوى المستند (JSON Document):</span>
                  </span>
                  <button
                    id="btn-copy-doc-json"
                    onClick={() => copyToClipboard(JSON.stringify(inspectedItem.rawData, null, 2), 'json')}
                    className="px-3 py-1 bg-navy-800 hover:bg-navy-700 text-gray-300 hover:text-white rounded-lg border border-navy-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {copySuccess === 'json' ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>نسخ JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 bg-navy-950 rounded-2xl border border-navy-800/80 font-mono text-[11px] text-emerald-300 max-h-[350px] overflow-auto custom-scrollbar" dir="ltr">
                  <pre>{JSON.stringify(inspectedItem.rawData, null, 2)}</pre>
                </div>
              </div>
            </div>

            <div className="p-4 bg-navy-950 border-t border-navy-800 flex justify-end">
              <button
                id="btn-close-inspect-bottom"
                onClick={() => setInspectedItem(null)}
                className="px-6 py-2 bg-navy-800 hover:bg-navy-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
