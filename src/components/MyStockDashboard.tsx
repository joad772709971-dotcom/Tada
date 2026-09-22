import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, AlertTriangle, Layers, Plus, Edit3, Trash2, Archive, 
  EyeOff, Eye, Settings, Briefcase, Package, FolderPlus, ArrowUpRight, 
  Gavel, Sparkles, RefreshCw, Sliders, Check, Search, X, Shield, 
  ChevronDown, MapPin, DollarSign, Store, Tag, Users, Camera
} from 'lucide-react';
import { db } from '../firebase';
import BarcodeScanner from './BarcodeScanner';
import { compressImage } from '../utils/imageCompressor';
import { 
  collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, 
  query, where, serverTimestamp, getDocs, limit, writeBatch
} from 'firebase/firestore';

interface MyStockDashboardProps {
  currentUserLevel: number; // 1=Importer, 2=Distributor, 3=Wholesaler, 4=Retailer
  profile: any;
}

export const MyStockDashboard: React.FC<MyStockDashboardProps> = ({
  currentUserLevel,
  profile,
}) => {
  // Analytical view segment: 'warehouse' | 'agency' | 'product'
  const [segmentView, setSegmentView] = useState<'warehouse' | 'agency' | 'product'>('product');

  // Core Data Lists
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [selectedAgency, setSelectedAgency] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showHiddenOnly, setShowHiddenOnly] = useState<boolean>(false);

  // Modals & form state
  const [isBatchUpdateModalOpen, setIsBatchUpdateModalOpen] = useState<boolean>(false);
  const [isSourcingModalOpen, setIsSourcingModalOpen] = useState<boolean>(false);
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState<boolean>(false);
  const [selectedItemForAction, setSelectedItemForAction] = useState<any | null>(null);

  // Batch Update Form
  const [batchForm, setBatchForm] = useState({
    targetField: 'price', // 'price' | 'cost' | 'wholesalePrice'
    updateType: 'percentage', // 'percentage' | 'flat'
    updateValue: 10, // positive or negative
    categoryScope: 'all',
    warehouseScope: 'all',
  });
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);

  // Sourcing Form
  const [sourcingForm, setSourcingForm] = useState({
    shelfSection: 'جوالات', // 'جوالات' | 'إكسسوارات' | 'قطع غيار' | custom
    customShelf: '',
    allowWholesalePrice: true,
    customDescription: '',
    location: 'صنعاء'
  });

  // Auction Form
  const [auctionForm, setAuctionForm] = useState({
    customTitle: '',
    customPrice: 0,
    customDescription: '',
    imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80',
    auctionType: 'supplier_publish'
  });

  // Unique Lists derived from current inventory
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [agencies, setAgencies] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch Inventory & Orders
  useEffect(() => {
    if (!profile?.ownerId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // 1. Subscribe to local inventory
    const qInv = query(
      collection(db, 'inventory'),
      where('ownerId', '==', profile.ownerId)
    );

    const unsubInv = onSnapshot(qInv, (snap) => {
      const items: any[] = [];
      const whSet = new Set<string>();
      const agSet = new Set<string>();
      const catSet = new Set<string>();

      snap.forEach(docSnap => {
        const data = docSnap.data();
        items.push({ id: docSnap.id, ...data });
        
        if (data.warehouseName) whSet.add(data.warehouseName);
        if (data.agencyName) agSet.add(data.agencyName);
        if (data.category) catSet.add(data.category);
      });

      // Default fallback warehouse name if none
      if (whSet.size === 0) whSet.add('المستودع الرئيسي للمحل');

      setInventoryItems(items);
      setWarehouses(Array.from(whSet));
      setAgencies(Array.from(agSet));
      setCategories(Array.from(catSet));
      setIsLoading(false);
    }, (err) => {
      console.error('Error listening to inventory:', err);
      setIsLoading(false);
    });

    // 2. Subscribe to orders to capture velocity
    const qOrders = query(
      collection(db, 'orders'),
      where('wholesalerId', '==', profile.ownerId),
      limit(30)
    );

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const ords: any[] = [];
      snap.forEach(docSnap => {
        ords.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRecentOrders(ords);
    }, (err) => {
      console.warn('Orders permission/fetch warning (might be retail profile):', err);
    });

    return () => {
      unsubInv();
      unsubOrders();
    };
  }, [profile?.ownerId]);

  // Analytical Metrics Computations
  // A. "المنتجات الأكثر طلباً" (Most demanded products derived from actual order statistics + simulated fallback)
  const getMostDemandedProducts = () => {
    const counts: Record<string, { count: number; name: string; purchasers: Set<string>; itemPrice: number }> = {};
    
    // Aggregate from real orders if available
    recentOrders.forEach(order => {
      const items = order.items || [];
      const buyerName = order.buyerName || order.buyerBusinessName || 'عميل غير مسمى';
      items.forEach((item: any) => {
        if (!item.name) return;
        if (!counts[item.name]) {
          counts[item.name] = { 
            count: 0, 
            name: item.name, 
            purchasers: new Set<string>(), 
            itemPrice: Number(item.price) || 0 
          };
        }
        counts[item.name].count += Number(item.quantity) || 1;
        counts[item.name].purchasers.add(buyerName);
      });
    });

    const realList = Object.values(counts).map(c => ({
      name: c.name,
      quantitySold: c.count,
      purchasers: Array.from(c.purchasers).slice(0, 2).join(' و '),
      price: c.itemPrice
    }));

    if (realList.length === 0) {
      return [];
    }

    return realList.sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 3);
  };

  // B. "المنتجات المنخفضة" (Low-stock threshold alerts < 10)
  const getLowStockProducts = () => {
    return inventoryItems
      .filter(item => (Number(item.stock) || 0) < 15 && !item.isHidden)
      .sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0))
      .slice(0, 4);
  };

  // Filtered Inventory items
  const filteredInventory = inventoryItems.filter(item => {
    // 1. Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const nameMatch = item.name?.toLowerCase().includes(term);
      const barcodeMatch = item.barcode?.includes(term);
      const categoryMatch = item.category?.toLowerCase().includes(term);
      const agencyMatch = item.agencyName?.toLowerCase().includes(term);
      if (!nameMatch && !barcodeMatch && !categoryMatch && !agencyMatch) return false;
    }

    // 2. Warehouse
    if (selectedWarehouse !== 'all' && item.warehouseName !== selectedWarehouse) {
      return false;
    }

    // 3. Agency
    if (selectedAgency !== 'all' && item.agencyName !== selectedAgency) {
      return false;
    }

    // 4. Category
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }

    // 5. Hidden status
    if (showHiddenOnly && !item.isHidden) {
      return false;
    }

    return true;
  });

  // Group items by Warehouse for [المخزن] segment view
  const getWarehouseGrouping = () => {
    const groups: Record<string, any[]> = {};
    filteredInventory.forEach(item => {
      const wh = item.warehouseName || 'المستودع الرئيسي للمحل';
      if (!groups[wh]) groups[wh] = [];
      groups[wh].push(item);
    });
    return groups;
  };

  // Group items by Agency for [الوكالة] segment view
  const getAgencyGrouping = () => {
    const groups: Record<string, any[]> = {};
    filteredInventory.forEach(item => {
      const ag = item.agencyName || 'ماركة عامة / غير مصنفة';
      if (!groups[ag]) groups[ag] = [];
      groups[ag].push(item);
    });
    return groups;
  };

  // Toggle Visibility of a single item
  const toggleItemVisibility = async (item: any) => {
    try {
      const newStatus = !item.isHidden;
      await updateDoc(doc(db, 'inventory', item.id), {
        isHidden: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error toggling visibility:', err);
      alert('فشل تغيير حالة عرض الصنف.');
    }
  };

  // Execute Batch Update of Prices/Hidden State
  const handleExecuteBatchUpdate = async () => {
    if (filteredInventory.length === 0) {
      alert('لا توجد أصناف تطابق الفلاتر الحالية لتطبيق التحديث الجماعي عليها.');
      return;
    }

    if (!window.confirm(`⚠️ تحذير تعديل جماعي للأسعار!\n\nهل أنت متأكد من رغبتك في تعديل أسعار (${filteredInventory.length}) صنف دفعة واحدة؟\nسيتم تطبيق هذا التعديل في قاعدة البيانات السحابية فوراً.`)) {
      return;
    }

    setIsBatchProcessing(true);
    try {
      const batch = writeBatch(db);
      
      for (const item of filteredInventory) {
        const currentVal = Number(item[batchForm.targetField]) || 0;
        let newVal = currentVal;

        if (batchForm.updateType === 'percentage') {
          const delta = currentVal * (batchForm.updateValue / 100);
          newVal = Math.round(currentVal + delta);
        } else {
          newVal = Math.round(currentVal + batchForm.updateValue);
        }

        // Prevent negative prices
        if (newVal < 0) newVal = 0;

        const itemRef = doc(db, 'inventory', item.id);
        batch.update(itemRef, {
          [batchForm.targetField]: newVal,
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      alert(`تم تطبيق التحديث الجماعي بنجاح على (${filteredInventory.length}) صنف ✅`);
      setIsBatchUpdateModalOpen(false);
    } catch (err: any) {
      console.error('Batch update error:', err);
      alert('فشل تطبيق التعديل الجماعي: ' + err.message);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Trigger Hide All Filtered Products
  const handleBatchHideFiltered = async (hide: boolean) => {
    if (filteredInventory.length === 0) {
      alert('لا توجد منتجات لتعديل حالتها.');
      return;
    }

    const actionText = hide ? 'إخفاء' : 'إظهار';
    if (!window.confirm(`هل أنت متأكد من رغبتك في (${actionText}) جميع الأصناف المفلترة الحالية عدد (${filteredInventory.length}) صنف دفعة واحدة؟`)) {
      return;
    }

    setIsBatchProcessing(true);
    try {
      const batch = writeBatch(db);
      filteredInventory.forEach(item => {
        const itemRef = doc(db, 'inventory', item.id);
        batch.update(itemRef, {
          isHidden: hide,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      alert(`تم (${actionText}) جميع الأصناف المفلترة بنجاح ✅`);
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء التحديث الجماعي.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Trigger Sourcing Modal (Tab 3 to Tab 2 Publisher Feed)
  const openSourcingModal = (item: any) => {
    setSelectedItemForAction(item);
    setSourcingForm({
      shelfSection: item.category || 'جوالات',
      customShelf: '',
      allowWholesalePrice: true,
      customDescription: item.compatibilities || '',
      location: profile?.location || 'صنعاء'
    });
    setIsSourcingModalOpen(true);
  };

  const handleSourcingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAction) return;

    // Strict validation: Retailers (level 4) cannot publish wholesale products to the B2B trader feed
    if (currentUserLevel === 4) {
      alert('⚠️ عذراً، بصفتك تاجر تجزئة أنت غير مخول بنشر سلع الجملة على كشاف الموردين الموحد. يمكنك التصفح فقط.');
      return;
    }

    try {
      const section = sourcingForm.shelfSection === 'custom' ? sourcingForm.customShelf : sourcingForm.shelfSection;
      
      const payload = {
        name: selectedItemForAction.name,
        description: sourcingForm.customDescription || selectedItemForAction.compatibilities || '',
        category: section || 'أصناف عامة',
        location: sourcingForm.location,
        agencyName: selectedItemForAction.agencyName || 'عامة',
        publisherName: profile?.businessName || 'وكيل غير مسمى',
        wholesalerId: profile?.ownerId || 'unknown',
        hierarchyLevel: currentUserLevel, // Publisher's level tier
        isActive: true,
        productId: selectedItemForAction.id, // linked back to original local inventory item
        price: Number(selectedItemForAction.price) || 0,
        cost: Number(selectedItemForAction.cost) || 0,
        photos: selectedItemForAction.photos || ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&q=50'],
        createdAt: serverTimestamp(),
        publishedViaTab3: true
      };

      await addDoc(collection(db, 'wholesaleProducts'), payload);
      alert('🎉 تم بث ونشر صنف المخزن بنجاح إلى شبكة الموزعين العامة كصنف توريدي متاح للارتباط!');
      setIsSourcingModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء بث الصنف العام: ' + err.message);
    }
  };

  // Trigger Consumer Auction Tunnel push
  const openAuctionModal = (item: any) => {
    setSelectedItemForAction(item);
    setAuctionForm({
      customTitle: item.name,
      customPrice: Number(item.price) || 0,
      customDescription: item.compatibilities || '',
      imageUrl: item.photos?.[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80',
      auctionType: 'supplier_publish'
    });
    setIsAuctionModalOpen(true);
  };

  const handlePushToAuctionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAction) return;

    // Strict Rule Validation: Provided item price exceeds 5,000 YR.
    const priceVal = Number(auctionForm.customPrice) || 0;
    if (priceVal < 5000) {
      alert('⚠️ حظر الحراج العام للزبائن: يمنع منعاً باتاً نشر وتصدير السلع التي يقل سعرها عن 5,000 ريال يمني لحماية جودة المعروضات وتجنب إغراق كشاف المستهلكين بالمنتجات منخفضة القيمة.');
      return;
    }

    try {
      await addDoc(collection(db, 'public_auctions'), {
        storeId: profile.ownerId,
        title: auctionForm.customTitle.trim(),
        price: priceVal,
        description: auctionForm.customDescription.trim(),
        images: [auctionForm.imageUrl],
        type: auctionForm.auctionType, // 'supplier_publish'
        createdAt: serverTimestamp(),
        sourceInventoryId: selectedItemForAction.id
      });

      alert('🚀 تم دفع وتوجيه السلعة بنجاح إلى الحراج العام (متجر الزبائن السريع) وبشروط شفافية السعر!');
      setIsAuctionModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء النشر في الحراج: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* 1. TOP ANALYTICAL VIEW & CORE METRICS BENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Metric A: "المنتجات الأكثر طلباً" (Most Demanded Products and who purchased them) */}
        <div className="bg-gradient-to-br from-[#0c1224] to-[#121a36] border border-emerald-500/20 p-5 rounded-3xl space-y-3.5 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-400 font-extrabold bg-emerald-400/10 px-2.5 py-1 rounded-xl flex items-center gap-1">
              <TrendingUp size={11} className="animate-pulse" />
              <span>المنتجات الأكثر طلباً وحركة مبيعات</span>
            </span>
            <span className="text-[8px] text-gray-400 font-bold">بث مباشر للطلب</span>
          </div>
          
          <div className="space-y-2.5">
            {getMostDemandedProducts().map((p, idx) => (
              <div key={idx} className="p-2 bg-black/40 rounded-xl border border-white/5 space-y-1">
                <div className="flex justify-between items-center text-[11px] font-black">
                  <span className="text-white truncate max-w-[170px]">{p.name}</span>
                  <span className="text-emerald-400 font-mono">+{p.quantitySold} حبة</span>
                </div>
                <div className="flex justify-between items-center text-[9px] text-gray-400">
                  <span>المشترون: <strong className="text-gray-300 font-medium">{p.purchasers}</strong></span>
                  <span className="text-gray-500 font-mono">{p.price.toLocaleString()} YR</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metric B: "المنتجات المنخفضة" (Low Stock replenishment alerts) */}
        <div className="bg-gradient-to-br from-[#0c1224] to-[#121a36] border border-yellow-500/20 p-5 rounded-3xl space-y-3.5 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-yellow-500 font-extrabold bg-yellow-500/10 px-2.5 py-1 rounded-xl flex items-center gap-1">
              <AlertTriangle size={11} className="animate-bounce" />
              <span>أصناف شارفت على النفاد</span>
            </span>
            <span className="text-[8.5px] text-red-400 font-black animate-pulse">تنبيه إعادة الطلب ⚠️</span>
          </div>

          <div className="space-y-2.5">
            {getLowStockProducts().length === 0 ? (
              <div className="h-28 flex items-center justify-center text-center text-gray-500 text-[10px] leading-relaxed">
                لا توجد أصناف منخفضة المخزون حالياً.<br />مستويات التوريد آمنة ومستقرة! 👍
              </div>
            ) : (
              getLowStockProducts().map((p, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-black/40 rounded-xl border border-white/5">
                  <div className="space-y-0.5">
                    <h5 className="text-[11px] font-black text-white truncate max-w-[150px]">{p.name}</h5>
                    <p className="text-[9px] text-gray-500">الموقع: {p.warehouseName || 'المستودع الرئيسي'}</p>
                  </div>
                  <div className="text-left">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold ${
                      p.stock === 0 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-500'
                    }`}>
                      {p.stock} حبة متبقية
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dynamic Segment View Selector Widget */}
        <div className="bg-gradient-to-br from-[#0c1224] to-[#121a36] border border-white/5 p-5 rounded-3xl flex flex-col justify-between shadow-xl">
          <div className="space-y-1.5">
            <h4 className="text-xs font-black text-white flex items-center gap-1">
              <Sliders size={13} className="text-emerald-400" />
              <span>هيكلة وتحليل الأصول المحلية</span>
            </h4>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              اختر وضع التجميع لعرض السلع والمخزون وتحليل توزيعها في المستودعات أو الماركات المسجلة باسمك.
            </p>
          </div>

          {/* Quick Segment Buttons */}
          <div className="grid grid-cols-3 gap-2 mt-4 bg-black/40 p-1.5 rounded-2xl border border-white/5">
            <button
              onClick={() => setSegmentView('warehouse')}
              className={`py-2 rounded-xl text-[10px] font-black transition-all text-center cursor-pointer ${
                segmentView === 'warehouse'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Store size={12} className="mx-auto mb-1" />
              <span>المخزن</span>
            </button>
            <button
              onClick={() => setSegmentView('agency')}
              className={`py-2 rounded-xl text-[10px] font-black transition-all text-center cursor-pointer ${
                segmentView === 'agency'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Briefcase size={12} className="mx-auto mb-1" />
              <span>الوكالة</span>
            </button>
            <button
              onClick={() => setSegmentView('product')}
              className={`py-2 rounded-xl text-[10px] font-black transition-all text-center cursor-pointer ${
                segmentView === 'product'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Package size={12} className="mx-auto mb-1" />
              <span>المنتج</span>
            </button>
          </div>
        </div>

      </div>

      {/* 2. BATCH MANAGEMENT ENGINE PANEL */}
      <div className="bg-[#0b101e]/85 border border-white/5 p-4 rounded-3xl shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[9px] text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded-lg font-black">
              ⚡ محرك إدارة التدفق والعمليات الجماعية
            </span>
            <h4 className="text-xs font-black text-white">إجراءات جماعية فورية لتعديل الأسعار وإدارة الخصوصية</h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Batch Price Update Button */}
            <button
              onClick={() => setIsBatchUpdateModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:from-amber-400 hover:to-[#e8c046] text-slate-950 text-[10px] font-black rounded-xl transition-all flex items-center gap-1 shadow-md cursor-pointer"
            >
              <RefreshCw size={11} className="animate-spin" style={{ animationDuration: '6s' }} />
              <span>تحديث الأسعار جماعياً 💲</span>
            </button>

            {/* Batch Hide Button */}
            <button
              onClick={() => handleBatchHideFiltered(true)}
              className="px-3 py-2 bg-red-500/15 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-black rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            >
              <EyeOff size={11} />
              <span>إخفاء الأصناف المفلترة</span>
            </button>

            {/* Batch Unhide Button */}
            <button
              onClick={() => handleBatchHideFiltered(false)}
              className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-black rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            >
              <Eye size={11} />
              <span>إظهار المفلترة</span>
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2">
          {/* Search Input */}
          <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-white/5 text-xs">
            <Search size={12} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="البحث بالاسم، الباركود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-[11px] text-white outline-none w-full border-none"
            />
            <button
              type="button"
              onClick={() => setIsScanning(true)}
              className="p-1 text-[#fbbf24] hover:text-white bg-amber-500/10 hover:bg-amber-500/20 rounded-md border-none cursor-pointer transition-all shrink-0 flex items-center justify-center"
              title="البحث باستخدام الكاميرا (الباركود)"
            >
              <Camera size={13} />
            </button>
            {searchTerm && (
              <X size={12} className="text-gray-400 hover:text-white cursor-pointer" onClick={() => setSearchTerm('')} />
            )}
          </div>

          {/* Warehouse Selector */}
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="bg-black/40 text-[11px] font-black text-white px-3 py-2 rounded-xl border border-white/5 outline-none cursor-pointer"
          >
            <option value="all">كل مستودعاتك ({warehouses.length})</option>
            {warehouses.map(wh => (
              <option key={wh} value={wh}>{wh}</option>
            ))}
          </select>

          {/* Agency Selector */}
          <select
            value={selectedAgency}
            onChange={(e) => setSelectedAgency(e.target.value)}
            className="bg-black/40 text-[11px] font-black text-white px-3 py-2 rounded-xl border border-white/5 outline-none cursor-pointer"
          >
            <option value="all">كل الماركات والوكالات ({agencies.length})</option>
            {agencies.map(ag => (
              <option key={ag} value={ag}>{ag || 'ماركة عامة'}</option>
            ))}
          </select>

          {/* Toggle show hidden */}
          <button
            onClick={() => setShowHiddenOnly(!showHiddenOnly)}
            className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
              showHiddenOnly 
                ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' 
                : 'bg-black/40 text-gray-400 border-white/5 hover:text-white'
            }`}
          >
            <Archive size={11} />
            <span>عرض المحجوب والمهمل فقط</span>
          </button>
        </div>
      </div>

      {/* 3. DYNAMIC SEGMENT DISPLAYS */}
      {segmentView === 'warehouse' ? (
        // Warehouse Segment Grouped View
        <div className="space-y-6">
          {Object.entries(getWarehouseGrouping()).length === 0 ? (
            <div className="bg-[#0b101e]/80 border border-white/5 rounded-3xl p-16 text-center text-gray-400 text-xs">
              لا توجد أصول مضافة في أي من المستودعات حالياً.
            </div>
          ) : (
            Object.entries(getWarehouseGrouping()).map(([warehouseName, items]) => (
              <div key={warehouseName} className="bg-[#0b101e]/90 border border-white/5 rounded-3xl p-5 space-y-4 shadow-lg">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Store className="text-emerald-400" size={16} />
                    <h4 className="text-xs font-black text-white">{warehouseName}</h4>
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[9px] font-bold">
                      {items.length} صنف جرد
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-mono">
                    القيمة الإجمالية التقديرية: {items.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.stock) || 0)), 0).toLocaleString()} ريال
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(item => (
                    <div key={item.id} className="bg-black/30 p-3 rounded-2xl border border-white/5 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <h5 className="text-[11.5px] font-black text-white">{item.name}</h5>
                        <p className="text-[9.5px] text-gray-400">
                          الكمية: <strong className="text-white font-mono">{item.stock}</strong> • السعر: <strong className="text-emerald-400 font-mono">{Number(item.price).toLocaleString()} ريال</strong>
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => openSourcingModal(item)}
                          title="نشر صنف توريدي للشبكة"
                          className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 rounded-xl transition-all cursor-pointer"
                        >
                          <Plus size={11} />
                        </button>
                        <button
                          onClick={() => openAuctionModal(item)}
                          title="تصدير للحراج العام"
                          className="p-1.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500 hover:text-slate-950 rounded-xl transition-all cursor-pointer"
                        >
                          <Gavel size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : segmentView === 'agency' ? (
        // Agency Segment Grouped View
        <div className="space-y-6">
          {Object.entries(getAgencyGrouping()).length === 0 ? (
            <div className="bg-[#0b101e]/80 border border-white/5 rounded-3xl p-16 text-center text-gray-400 text-xs">
              لا توجد ماركات تجارية معينة مسجلة لأصناف مخزنك.
            </div>
          ) : (
            Object.entries(getAgencyGrouping()).map(([agencyName, items]) => (
              <div key={agencyName} className="bg-[#0b101e]/90 border border-white/5 rounded-3xl p-5 space-y-4 shadow-lg">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="text-teal-400" size={16} />
                    <h4 className="text-xs font-black text-white">{agencyName}</h4>
                    <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded-lg text-[9px] font-bold">
                      {items.length} صنف معتمد
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-400">تحليل محاذاة الماركات والامتياز التجاري</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(item => (
                    <div key={item.id} className="bg-black/30 p-3 rounded-2xl border border-white/5 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <h5 className="text-[11.5px] font-black text-white">{item.name}</h5>
                        <p className="text-[9.5px] text-gray-400">
                          الكمية: <strong className="text-white font-mono">{item.stock}</strong> • التكلفة: <strong className="text-gray-300 font-mono">{Number(item.cost).toLocaleString()} ريال</strong>
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => openSourcingModal(item)}
                          className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 rounded-xl transition-all cursor-pointer"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // Product Detail/Catalog Grid List (Main Tab UI)
        filteredInventory.length === 0 ? (
          <div className="bg-[#0b101e]/90 border border-white/5 rounded-3xl p-16 text-center space-y-3">
            <Package size={44} className="mx-auto text-gray-600 animate-pulse" />
            <h4 className="text-sm font-black text-white">لا توجد منتجات مسجلة في جردك الحالي تطابق التصفية</h4>
            <p className="text-[10px] text-gray-400 max-w-sm mx-auto leading-relaxed">
              قم بإضافة وتوريد السلع من "السوق العام" بضغطة زر واحدة لتظهر فوراً في مخزنك وتبدأ بإدارتها وإعادة تصديرها.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredInventory.map(item => {
              const isLowStock = (Number(item.stock) || 0) < 15;

              return (
                <div 
                  key={item.id} 
                  className={`bg-[#0b101e]/95 border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative group overflow-hidden ${
                    item.isHidden 
                      ? 'border-yellow-500/20 opacity-70 bg-[#0d0d12]' 
                      : 'border-white/5 hover:border-emerald-500/30 shadow-lg hover:-translate-y-1'
                  }`}
                >
                  {/* Top Status Indicators */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex gap-1 items-center">
                    {item.isHidden && (
                      <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[8px] font-black">
                        مخفي 🔒
                      </span>
                    )}
                    {isLowStock && (
                      <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[8px] font-black animate-pulse">
                        منخفض ⚠️
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 bg-white/5 text-gray-400 rounded-lg text-[9px] font-bold">
                        📁 {item.category || 'عام'}
                      </span>
                      <span className="text-[8px] text-gray-500 font-mono">#{item.barcode}</span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-white group-hover:text-emerald-400 transition-all truncate">
                        {item.name}
                      </h4>
                      {item.agencyName && (
                        <p className="text-[9px] text-emerald-400 font-medium">ماركة/وكالة: {item.agencyName}</p>
                      )}
                      <p className="text-[10px] text-gray-400 line-clamp-2 h-7 leading-snug">
                        {item.compatibilities || 'لا يوجد مواصفات أو تفاصيل ربط مضافة.'}
                      </p>
                    </div>

                    {/* Financial Matrix for this item */}
                    <div className="grid grid-cols-2 gap-1.5 p-2 bg-black/40 rounded-xl border border-white/5 text-[10px]">
                      <div className="space-y-0.5">
                        <span className="text-gray-500 block">التكلفة:</span>
                        <span className="text-white font-mono font-bold">{(item.cost || 0).toLocaleString()} ريال</span>
                      </div>
                      <div className="space-y-0.5 text-left">
                        <span className="text-gray-500 block">سعر التجزئة:</span>
                        <span className="text-emerald-400 font-mono font-black">{(item.price || 0).toLocaleString()} ريال</span>
                      </div>
                    </div>

                    {/* Warehouse Placement and Stock */}
                    <div className="flex justify-between items-center text-[10px] bg-[#11162d]/40 p-2 rounded-xl">
                      <span className="text-gray-400 flex items-center gap-0.5">
                        <Store size={10} />
                        <span className="truncate max-w-[80px]">{item.warehouseName || 'المستودع الرئيسي'}</span>
                      </span>
                      <span className={`font-mono font-black ${isLowStock ? 'text-red-400' : 'text-white'}`}>
                        المخزون: {item.stock || 0} حبة
                      </span>
                    </div>
                  </div>

                  {/* Operational Action Buttons footer */}
                  <div className="pt-3 border-t border-white/5 mt-4 flex items-center justify-between">
                    {/* Toggle hide action */}
                    <button
                      onClick={() => toggleItemVisibility(item)}
                      title={item.isHidden ? "إظهار الصنف في كتل التصفح" : "إخفاء الصنف من العملاء والتقارير العامة"}
                      className="text-[9px] font-bold text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer transition-all"
                    >
                      {item.isHidden ? <Eye size={11} /> : <EyeOff size={11} />}
                      <span>{item.isHidden ? 'إظهار الصنف' : 'إخفاء'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {/* Broadcast Sourcing Button (Wholesale Catalog Feed) */}
                      {currentUserLevel < 4 && (
                        <button
                          onClick={() => openSourcingModal(item)}
                          className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 text-[10px] font-black rounded-lg transition-all flex items-center gap-0.5 cursor-pointer border border-emerald-500/10"
                        >
                          <ArrowUpRight size={10} />
                          <span>بث للتجار 📣</span>
                        </button>
                      )}

                      {/* Consumer Auction Tunnel Button (price > 5000 YR) */}
                      <button
                        onClick={() => openAuctionModal(item)}
                        className="px-2.5 py-1.5 bg-yellow-500/10 hover:bg-yellow-500 hover:text-slate-950 text-yellow-500 text-[10px] font-black rounded-lg transition-all flex items-center gap-0.5 cursor-pointer border border-yellow-500/10"
                      >
                        <Gavel size={10} />
                        <span>الحراج العام 🚀</span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )
      )}

      {/* 4. MODAL: Batch Price Update */}
      {isBatchUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-white/10 rounded-3xl max-w-md w-full p-6 text-right space-y-4 animate-scale-in relative">
            
            <button 
              onClick={() => setIsBatchUpdateModalOpen(false)}
              className="absolute top-4 left-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <RefreshCw className="text-amber-400" size={18} />
              <h3 className="text-sm font-black text-white">تعديل وتحديث الأسعار جماعياً</h3>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-[10px] text-gray-300 leading-relaxed">
                سيقوم هذا المعالج بتطبيق تعديل فوري في الأسعار لجميع الأصناف المفلترة الحالية عدد <strong className="text-emerald-400 font-mono">({filteredInventory.length})</strong> صنف.
              </p>

              {/* Field Target */}
              <div className="space-y-1.5">
                <label className="text-gray-400 block font-bold">الحقل المستهدف بالتعديل:</label>
                <select
                  value={batchForm.targetField}
                  onChange={(e) => setBatchForm({ ...batchForm, targetField: e.target.value })}
                  className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none cursor-pointer"
                >
                  <option value="price">سعر التجزئة للمستهلك (Retail Price)</option>
                  <option value="cost">سعر التكلفة (Cost Price)</option>
                  <option value="wholesalePrice">سعر الجملة للشركاء (Wholesale Price)</option>
                </select>
              </div>

              {/* Update Type */}
              <div className="space-y-1.5">
                <label className="text-gray-400 block font-bold">طريقة الاحتساب:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchForm({ ...batchForm, updateType: 'percentage' })}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      batchForm.updateType === 'percentage'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-black/40 text-gray-400 border-white/5'
                    }`}
                  >
                    نسبة مئوية (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchForm({ ...batchForm, updateType: 'flat' })}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      batchForm.updateType === 'flat'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-black/40 text-gray-400 border-white/5'
                    }`}
                  >
                    قيمة ثابتة (ريال يمني)
                  </button>
                </div>
              </div>

              {/* Delta Value */}
              <div className="space-y-1.5">
                <label className="text-[#D4AF37] block font-bold">قيمة التعديل (أدخل رقماً سالباً للتخفيض):</label>
                <div className="relative">
                  <input
                    type="number"
                    value={batchForm.updateValue}
                    onChange={(e) => setBatchForm({ ...batchForm, updateValue: Number(e.target.value) })}
                    className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none font-mono focus:border-amber-500"
                  />
                  <span className="absolute left-3.5 top-2.5 text-gray-500 text-[10px]">
                    {batchForm.updateType === 'percentage' ? '%' : 'YR'}
                  </span>
                </div>
                <span className="text-[9px] text-gray-500 block">مثال: 10 للزيادة بـ 10%، أو -5 لخصم 5%.</span>
              </div>

              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={handleExecuteBatchUpdate}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black rounded-xl transition-all hover:scale-[1.01] shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isBatchProcessing ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    <span>جاري تطبيق التعديل بالشبكة...</span>
                  </>
                ) : (
                  <span>تطبيق وإعادة الحساب فوراً ⚡</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. MODAL: Inventory Sourcing (Publish to Wholesale Trader Feed) */}
      {isSourcingModalOpen && selectedItemForAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-white/10 rounded-3xl max-w-md w-full p-6 text-right space-y-4 animate-scale-in relative">
            
            <button 
              onClick={() => setIsSourcingModalOpen(false)}
              className="absolute top-4 left-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Sparkles className="text-emerald-400" size={18} />
              <h3 className="text-sm font-black text-white">بث الصنف لشبكة الموزعين والشركاء العامة</h3>
            </div>

            <form onSubmit={handleSourcingSubmit} className="space-y-4 text-xs">
              
              <div className="bg-[#11162d] p-3 rounded-2xl border border-white/5 space-y-1">
                <span className="text-[9px] text-emerald-400 font-extrabold block">الصنف المحلي المراد بثه:</span>
                <h4 className="text-xs font-black text-white">{selectedItemForAction.name}</h4>
                <div className="flex justify-between text-[9px] text-gray-400">
                  <span>التكلفة الحالية: {selectedItemForAction.cost?.toLocaleString()} YR</span>
                  <span>سعر التجزئة: {selectedItemForAction.price?.toLocaleString()} YR</span>
                </div>
              </div>

              {/* Shelf Category Selection */}
              <div className="space-y-1.5">
                <label className="text-gray-400 block font-bold">تحديد قسم الصنف في شبكة الموزعين:</label>
                <select
                  value={sourcingForm.shelfSection}
                  onChange={(e) => setSourcingForm({ ...sourcingForm, shelfSection: e.target.value })}
                  className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none cursor-pointer"
                >
                  <option value="جوالات">جوالات</option>
                  <option value="إكسسوارات">إكسسوارات</option>
                  <option value="قطع غيار">قطع غيار</option>
                  <option value="شواحن">شواحن</option>
                  <option value="custom">[قسم مخصص جديد...]</option>
                </select>
              </div>

              {sourcingForm.shelfSection === 'custom' && (
                <div className="space-y-1.5">
                  <label className="text-[#D4AF37] block font-bold">اسم القسم المخصص الجديد:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: ساعات ذكية"
                    value={sourcingForm.customShelf}
                    onChange={(e) => setSourcingForm({ ...sourcingForm, customShelf: e.target.value })}
                    className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Custom Description */}
              <div className="space-y-1.5">
                <label className="text-gray-400 block">مواصفات ترويجية إضافية للشركاء (اختياري):</label>
                <textarea
                  rows={2}
                  placeholder="اكتب ميزات، فترة الضمان، أو الكود المرجعي للسلعة التوريدية..."
                  value={sourcingForm.customDescription}
                  onChange={(e) => setSourcingForm({ ...sourcingForm, customDescription: e.target.value })}
                  className="w-full bg-navy-950/60 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-gray-400 block">مدينة التوريد:</label>
                <input
                  type="text"
                  value={sourcingForm.location}
                  onChange={(e) => setSourcingForm({ ...sourcingForm, location: e.target.value })}
                  className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none"
                />
              </div>

              <div className="bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/10 space-y-1 text-[9.5px]">
                <div className="flex items-center gap-1 text-emerald-400 font-bold">
                  <Shield size={11} />
                  <span>بروتوكول حماية سرية الأسعار:</span>
                </div>
                <p className="text-gray-300 leading-tight">
                  البث سيقوم بنشر الصنف والماركة دون إفشاء سعر البيع لغير التجار المرتبطين بك رسمياً. أسعار المستهلكين محجوبة ومؤمنة تماماً.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <span>بث فوري في كشاف الشركاء والمشتركين 🚀</span>
              </button>

            </form>

          </div>
        </div>
      )}

      {/* 6. MODAL: Push to Consumer Public Auction Tunnel */}
      {isAuctionModalOpen && selectedItemForAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-white/10 rounded-3xl max-w-md w-full p-6 text-right space-y-4 animate-scale-in relative">
            
            <button 
              onClick={() => setIsAuctionModalOpen(false)}
              className="absolute top-4 left-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Gavel className="text-yellow-500" size={18} />
              <h3 className="text-sm font-black text-white">دفع وتصدير السلعة للحراج العام للزبائن</h3>
            </div>

            <form onSubmit={handlePushToAuctionSubmit} className="space-y-4 text-xs">
              
              <div className="bg-[#11162d] p-3 rounded-2xl border border-white/5 space-y-1">
                <span className="text-[9px] text-yellow-500 font-extrabold block">الصنف المحلي المستهدف:</span>
                <h4 className="text-xs font-black text-white">{selectedItemForAction.name}</h4>
                <div className="flex justify-between text-[9px] text-gray-400">
                  <span>التكلفة: {selectedItemForAction.cost?.toLocaleString()} YR</span>
                  <span>سعر التجزئة المقترح: {selectedItemForAction.price?.toLocaleString()} YR</span>
                </div>
              </div>

              {/* Check and display strict rule warnings inside form */}
              {Number(auctionForm.customPrice) < 5000 && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl space-y-1 text-[10px] leading-relaxed">
                  <span className="font-extrabold block">⚠️ حظر الحد الأدنى للسعر النشط:</span>
                  يجب أن تكون قيمة السلعة المعروضة في حراج الزبائن مساوية أو أعلى من 5,000 ريال يمني. يرجى تعديل السعر بالأسفل للمتابعة.
                </div>
              )}

              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-gray-400 block font-bold">عنوان الإعلان للزبائن:</label>
                <input
                  type="text"
                  required
                  value={auctionForm.customTitle}
                  onChange={(e) => setAuctionForm({ ...auctionForm, customTitle: e.target.value })}
                  className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-yellow-500"
                />
              </div>

              {/* Price input */}
              <div className="space-y-1.5">
                <label className="text-[#D4AF37] block font-bold">السعر النهائي للجمهور (يجب أن يتجاوز 5,000 ريال):</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={auctionForm.customPrice}
                    onChange={(e) => setAuctionForm({ ...auctionForm, customPrice: Number(e.target.value) })}
                    className={`w-full bg-navy-950/60 border rounded-xl px-3.5 py-2.5 text-white outline-none font-mono focus:border-yellow-500 ${
                      Number(auctionForm.customPrice) < 5000 ? 'border-red-500' : 'border-white/10'
                    }`}
                  />
                  <span className="absolute left-3.5 top-2.5 text-gray-400 font-mono text-[9.5px]">YR</span>
                </div>
              </div>

              {/* Description input */}
              <div className="space-y-1.5">
                <label className="text-gray-400 block">وصف تفصيلي للزبائن (حالة الجهاز والملحقات):</label>
                <textarea
                  rows={3}
                  required
                  placeholder="اكتب حالة السلعة بكل وضوح لزبائن التجزئة والمستهدفين..."
                  value={auctionForm.customDescription}
                  onChange={(e) => setAuctionForm({ ...auctionForm, customDescription: e.target.value })}
                  className="w-full bg-navy-950/60 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-yellow-500"
                />
              </div>

              {/* Image Input */}
              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2">
                <label className="text-amber-500 font-bold block text-xs">رفع صورة السلعة مباشرة من جهازك (سيتم ضغط الحجم تلقائياً لتوفير المساحة):</label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const compressedBase64 = await compressImage(file, 600, 600, 0.6);
                        setAuctionForm({ ...auctionForm, imageUrl: compressedBase64 });
                      } catch (err: any) {
                        console.error('Compression failed:', err);
                      }
                    }
                  }}
                  className="block w-full text-xs text-gray-400 file:ml-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-amber-500 file:text-black hover:file:bg-amber-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 block">أو أدخل رابط صورة المعاينة الفورية للسلعة:</label>
                <input
                  type="text"
                  value={auctionForm.imageUrl}
                  onChange={(e) => setAuctionForm({ ...auctionForm, imageUrl: e.target.value })}
                  className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none font-mono focus:border-yellow-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={Number(auctionForm.customPrice) < 5000}
                  className="flex-1 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-black rounded-xl transition-all shadow-md hover:scale-[1.01] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  تصدير ودفع للحراج العام 🚀
                </button>
                <button
                  type="button"
                  onClick={() => setIsAuctionModalOpen(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold cursor-pointer transition-all"
                >
                  إلغاء
                </button>
              </div>

            </form>

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

    </div>
  );
};
