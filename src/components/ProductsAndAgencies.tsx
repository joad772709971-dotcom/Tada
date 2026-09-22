import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Filter, MapPin, Sparkles, Plus, Image as ImageIcon, 
  Trash2, Edit3, Globe, Shield, RefreshCw, X, Link as LinkIcon, 
  Layers, ChevronDown, Check, AlertTriangle, Eye, EyeOff
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, 
  query, where, serverTimestamp, getDocs
} from 'firebase/firestore';
import { StoreQueueEngine } from '../services/StoreQueueEngine';

interface ProductsAndAgenciesProps {
  currentUserLevel: number; // 1=Importer, 2=Distributor, 3=Wholesaler, 4=Retailer
  profile: any;
}

export const ProductsAndAgencies: React.FC<ProductsAndAgenciesProps> = ({
  currentUserLevel,
  profile,
}) => {
  // State for tab toggle: 'products' | 'agencies'
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'agencies'>('products');
  
  // Lists fetched from Firestore
  const [marketProducts, setMarketProducts] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  // Interactive modals / states
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [agencyFlowType, setAgencyFlowType] = useState<'auto' | 'manual' | null>(null);

  // Publish Form State
  const [publishForm, setPublishForm] = useState({
    id: '', // for edit mode
    name: '',
    description: '',
    category: 'موبايلات وجوالات',
    imageUrl: '',
    agencyName: '',
    location: 'صنعاء',
    publisherName: profile?.businessName || 'وكيل رسمي',
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCustomAgency, setIsCustomAgency] = useState(false);

  // Agency Form State
  const [agencyForm, setAgencyForm] = useState({
    name: '',
    logoUrl: '',
    storeLink: '',
  });

  // Pre-populated default categories for selector
  const productCategories = [
    'موبايلات وجوالات',
    'إكسسوارات شواحن وكوابل',
    'ساعات ذكية وسماعات',
    'قطع غيار وشاشات',
    'بطاريات وقواعد طاقة'
  ];

  // Pre-populated default locations for filter
  const locations = [
    'صنعاء',
    'عدن',
    'تعز',
    'الحديدة',
    'إب',
    'حضر موت'
  ];

  // Map level to Arabic names
  const getLevelLabel = (level: number) => {
    switch (level) {
      case 1: return 'مستورد رئيسي';
      case 2: return 'موزع جملة الجملة';
      case 3: return 'تاجر جملة معتمد';
      case 4: return 'تاجر تجزئة';
      default: return 'تاجر';
    }
  };

  // Fetch products and agencies
  useEffect(() => {
    setIsLoading(true);

    // Listen to wholesaleProducts
    const qProducts = query(
      collection(db, 'wholesaleProducts'),
      where('isActive', '==', true)
    );

    const unsubProducts = onSnapshot(qProducts, (snap) => {
      const prods: any[] = [];
      snap.forEach(docSnap => {
        prods.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMarketProducts(prods);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching market products:", err);
      setIsLoading(false);
    });

    // Listen to b2bAgencies
    const qAgencies = collection(db, 'b2bAgencies');
    const unsubAgencies = onSnapshot(qAgencies, (snap) => {
      const ags: any[] = [];
      snap.forEach(docSnap => {
        ags.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAgencies(ags);
    });

    return () => {
      unsubProducts();
      unsubAgencies();
    };
  }, []);

  // Filter logic based on Tiered Visibility Rules
  const visibleProducts = marketProducts.filter(p => {
    // 1. Category Filter
    if (selectedCategory !== 'all' && p.category !== selectedCategory) {
      return false;
    }

    // 2. Location Filter
    if (selectedLocation !== 'all' && p.location !== selectedLocation) {
      return false;
    }

    // 3. Tiered Visibility Rules:
    const publisherLevel = p.hierarchyLevel || 4;

    if (currentUserLevel === 1) {
      // Imports (المستورد) can only view items published by other importers (level 1).
      return publisherLevel === 1;
    } else if (currentUserLevel === 2 || currentUserLevel === 3) {
      // Wholesalers (جملة الجملة / تاجر جملة) can see wholesaler and importer items (level <= 3)
      return publisherLevel <= 3;
    } else if (currentUserLevel === 4) {
      // Retailers (التجزئة) can browse everyone's items
      return publisherLevel <= 4;
    }

    return true;
  });

  // Handle Publish/Add Product
  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishForm.name) {
      alert('يرجى كتابة اسم المنتج');
      return;
    }

    // Strict rule validation: Retailers (level 4) are strictly prohibited from publishing onto this public tab.
    if (currentUserLevel === 4) {
      alert('عذراً، بصفتك تاجر تجزئة أنت غير مخول بنشر السلع على هذا الكتالوج العام الخاص بالموردين.');
      return;
    }

    try {
      const payload = {
        name: publishForm.name,
        description: publishForm.description || '',
        category: publishForm.category,
        location: publishForm.location,
        agencyName: publishForm.agencyName || 'عامة',
        publisherName: profile?.businessName || 'وكيل غير مسمى',
        wholesalerId: profile?.ownerId || 'unknown_publisher',
        hierarchyLevel: currentUserLevel, // Publisher's tier
        isActive: true,
        // All catalog images must use a single, highly-compressed light thumbnail
        photos: [publishForm.imageUrl || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&q=50'],
        createdAt: serverTimestamp(),
        publishedViaTab2: true
      };

      if (isEditMode && publishForm.id) {
        await updateDoc(doc(db, 'wholesaleProducts', publishForm.id), payload);
        alert('تم تعديل مواصفات صنف الكتالوج بنجاح ✅');
      } else {
        await addDoc(collection(db, 'wholesaleProducts'), payload);
        alert('تم نشر صنف الكتالوج بنجاح وهو متاح للمستويات المستهدفة ✅');
      }

      // ⚡ Enqueue to StoreQueueEngine for 0ms Deduplication & Math Audit
      StoreQueueEngine.enqueueTask(
        profile?.ownerId || 'importer_agency',
        'importer_catalog_publish',
        'wholesaleProducts',
        payload,
        profile
      ).catch(err => console.warn('Importer catalog enqueue notice:', err));

      // Universal Post-Execution Clear & Instant 0ms release
      setPublishForm({
        id: '',
        name: '',
        description: '',
        category: 'موبايلات وجوالات',
        imageUrl: '',
        agencyName: '',
        location: 'صنعاء',
        publisherName: profile?.businessName || 'وكيل رسمي',
      });
      setIsPublishModalOpen(false);
      setIsEditMode(false);
    } catch (err) {
      console.error(err);
      alert('فشل حفظ البيانات بالشبكة.');
    }
  };

  // Trigger edit product
  const startEditProduct = (prod: any) => {
    setIsEditMode(true);
    const hasAgency = prod.agencyName && prod.agencyName !== '';
    const isKnown = agencies.some(a => a.name === prod.agencyName);
    setIsCustomAgency(!!(hasAgency && !isKnown));
    setPublishForm({
      id: prod.id,
      name: prod.name,
      description: prod.description || '',
      category: prod.category || 'موبايلات وجوالات',
      imageUrl: prod.photos?.[0] || '',
      agencyName: prod.agencyName || '',
      location: prod.location || 'صنعاء',
      publisherName: prod.publisherName || profile?.businessName || 'وكيل رسمي',
    });
    setIsPublishModalOpen(true);
  };

  // Delete Product Flow
  // Strict Note: Deleting an item from this market catalog must NOT affect or remove the item from the local store physical inventory.
  const handleDeleteProduct = async (prodId: string, wholesalerId: string) => {
    if (wholesalerId !== profile?.ownerId) {
      alert('⚠️ خطأ أمني: لا يمكنك حذف منتج ليس ملكاً لك!');
      return;
    }
    if (!window.confirm('⚠️ هل أنت متأكد من رغبتك في سحب وإلغاء هذا الصنف من الكشاف العام المفتوح للشركاء؟\n\nتنويه هام: هذا الإجراء يسحب العرض العام فقط، ولن يؤثر أو يحذف الصنف من جرد مخزنك المحلي الفعلي.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'wholesaleProducts', prodId));
      alert('تم حذف الصنف من كشاف السوق العام بنجاح.');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء محاولة الحذف.');
    }
  };

  // Add Agency Flow
  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyForm.name) {
      alert('يرجى إدخال اسم الوكالة/الماركة');
      return;
    }

    try {
      const payload = {
        name: agencyForm.name,
        logoUrl: agencyForm.logoUrl || 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?auto=format&fit=crop&w=150&q=80',
        isAutomatic: agencyFlowType === 'auto',
        storeLink: agencyFlowType === 'auto' ? agencyForm.storeLink : '',
        publisherId: profile?.ownerId || 'demo_user',
        publisherName: profile?.businessName || 'الوكيل الإداري',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'b2bAgencies'), payload);
      alert('تم إدراج الوكالة الجديدة وحفظها في قاعدة الكشافات الفورية بنجاح 🌐');

      // ⚡ Enqueue to StoreQueueEngine for 0ms Deduplication & Math Audit
      StoreQueueEngine.enqueueTask(
        profile?.ownerId || 'agency_importer',
        'create_agency',
        'b2bAgencies',
        payload,
        profile
      ).catch(err => console.warn('Agency creation enqueue notice:', err));

      // Universal Post-Execution Clear & Instant 0ms release
      setAgencyForm({ name: '', logoUrl: '', storeLink: '' });
      setAgencyFlowType(null);
      setIsAgencyModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('خطأ في إرسال البيانات للشبكة.');
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* 1. Header Banner with Core Stats & Concept */}
      <div className="bg-gradient-to-r from-emerald-600/10 via-teal-600/5 to-transparent border border-emerald-500/20 p-5 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-black animate-pulse">
                🛡️ بوابـة المنتجات والوكالات التوريدية العامة
              </span>
              <span className="px-2 py-0.5 bg-white/5 text-gray-400 border border-white/5 rounded-lg text-[9px] font-bold">
                مستواك التجاري الحالي: {getLevelLabel(currentUserLevel)}
              </span>
            </div>
            <h3 className="text-sm font-black text-white">كشاف الاكتشاف والتصفح الموحد للماركات والمستوردين</h3>
            <p className="text-[10px] text-gray-300 leading-relaxed max-w-3xl">
              تصفح السلع الفورية دون إفشاء الأسعار أو إمكانية الطلب المباشر. تهدف هذه البوابة للتعارف التجاري المتبادل وحماية هوامش الربح بين المستورد والموزع قبل بناء الارتباط الرسمي الآمن في قائمة الأصدقاء.
            </p>
          </div>
          
          {/* Main Action Buttons */}
          <div className="flex gap-2 self-start md:self-center">
            {currentUserLevel < 4 ? (
              <button
                onClick={() => {
                  setIsEditMode(false);
                  setPublishForm({
                    id: '',
                    name: '',
                    description: '',
                    category: 'موبايلات وجوالات',
                    imageUrl: '',
                    agencyName: '',
                    location: 'صنعاء',
                    publisherName: profile?.businessName || 'وكيل رسمي',
                  });
                  setIsPublishModalOpen(true);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
              >
                <Plus size={14} />
                <span>نشر صنف جديد للكتالوج ✨</span>
              </button>
            ) : (
              <div className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[9px] font-bold rounded-xl max-w-[200px] leading-tight">
                ⚠️ بصفتك تاجر تجزئة، تصفح المنتجات متاح بحرية كاملة، لكن النشر محجوز للموردين والمستوردين فقط.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Management Toolbar & Filter Utilities */}
      <div className="bg-[#0b101e]/85 border border-white/5 p-4 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Sub-Tabs: [المنتجات] and [الوكالات] */}
          <div className="flex bg-navy-950/80 p-1 rounded-xl border border-white/5 w-fit gap-1.5 shrink-0">
            <button
              onClick={() => setActiveSubTab('products')}
              className={`px-5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'products'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers size={13} />
              <span>أصناف المنتجات ({visibleProducts.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('agencies')}
              className={`px-5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'agencies'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Briefcase size={13} />
              <span>الوكالات والماركات ({agencies.length})</span>
            </button>
          </div>

          {/* Filters Area */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* [تحديد الفئة لتصفية المستويات أعلى منك] */}
            <div className="flex items-center gap-1.5 bg-navy-950/40 px-3 py-1.5 rounded-2xl border border-white/5">
              <Filter size={12} className="text-emerald-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-[11px] font-black text-white outline-none cursor-pointer border-none"
              >
                <option value="all" className="bg-[#0b101e] text-white">كل تصنيفات السوق</option>
                {productCategories.map(cat => (
                  <option key={cat} value={cat} className="bg-[#0b101e] text-white">{cat}</option>
                ))}
              </select>
            </div>

            {/* [زر تحديد الموقع] */}
            <div className="flex items-center gap-1.5 bg-navy-950/40 px-3 py-1.5 rounded-2xl border border-white/5">
              <MapPin size={12} className="text-emerald-400" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-transparent text-[11px] font-black text-white outline-none cursor-pointer border-none"
              >
                <option value="all" className="bg-[#0b101e] text-white">كل المدن والمحافظات</option>
                {locations.map(loc => (
                  <option key={loc} value={loc} className="bg-[#0b101e] text-white">{loc}</option>
                ))}
              </select>
            </div>

            {/* Direct Action: Add Product to Agency Flow */}
            <button
              onClick={() => setIsAgencyModalOpen(true)}
              className="text-[10px] bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 border border-teal-500/20 px-3 py-1.5 rounded-2xl font-black transition-all flex items-center gap-1 cursor-pointer"
            >
              <Globe size={11} />
              <span>إضافة منتجات لوكالة موجودة 🔗</span>
            </button>
          </div>

        </div>

        {/* Visible Product level warning banner */}
        <div className="p-2.5 bg-navy-950/80 rounded-2xl border border-white/5 flex items-center justify-between flex-wrap gap-2 text-[10px]">
          <span className="text-gray-400 font-medium">
            💡 نظام العزل النشط: معروضات السوق تخضع لمستوى الأمان. أنت الآن تتصفح المنتجات المناسبة لطبقتك التجارية لحماية سرية الأسواق.
          </span>
          <span className="text-emerald-400 font-bold">
            مستواك: {currentUserLevel} ({getLevelLabel(currentUserLevel)})
          </span>
        </div>
      </div>

      {/* 3. Main Display Segment */}
      {activeSubTab === 'products' ? (
        // Grid View of Published Products
        visibleProducts.length === 0 ? (
          <div className="bg-[#0b101e]/90 border border-white/5 rounded-3xl p-16 text-center space-y-4">
            <Layers size={48} className="mx-auto text-emerald-500/40 animate-pulse" />
            <h4 className="text-sm font-black text-white">لا توجد معروضات منشورة ضمن الفلاتر المحددة لمستواك</h4>
            <p className="text-[11px] text-gray-400 max-w-md mx-auto leading-relaxed">
              المستوردين والموزعين يمكنهم نشر الأصناف والكتالوجات من الزر العلوي "نشر صنف جديد للكتالوج" بكل سهولة لتصل فوراً للتجار.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {visibleProducts.map(prod => {
              const isOwner = prod.wholesalerId === profile?.ownerId;

              return (
                <div 
                  key={prod.id} 
                  className="bg-[#0b101e]/95 border border-white/5 hover:border-emerald-500/30 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 shadow-lg relative group overflow-hidden"
                >
                  {/* Top Header Badge indicating level */}
                  <div className="absolute top-2 left-2 z-10 flex gap-1">
                    <span className="px-1.5 py-0.5 bg-black/60 backdrop-blur-[2px] text-white rounded-lg text-[8px] font-black">
                      مستوى {prod.hierarchyLevel || 1}
                    </span>
                  </div>

                  {/* Product Thumbnail (Highly-compressed/Small for catalog performance) */}
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-white/5 shrink-0">
                    <img 
                      src={prod.photos?.[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&q=50'} 
                      alt={prod.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    />
                  </div>

                  {/* Body Info */}
                  <div className="mt-3.5 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[8.5px] text-emerald-400 font-extrabold bg-emerald-400/5 px-2 py-0.5 rounded-lg">
                          📁 {prod.category || 'عام'}
                        </span>
                        <span className="text-[8px] text-gray-500 flex items-center gap-0.5">
                          <MapPin size={8} />
                          {prod.location || 'صنعاء'}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-white mt-1.5 line-clamp-1">{prod.name}</h4>
                      <p className="text-[10px] text-gray-400 leading-snug line-clamp-2 mt-1 h-7">
                        {prod.description || 'لا يوجد مواصفات تفصيلية مضافة لهذا الصنف العام.'}
                      </p>
                    </div>

                    {/* Footer Segment */}
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      {/* Price Lock Indicator - No disclosure allowed on public discovery */}
                      <div className="flex items-center justify-between text-[10px] bg-black/30 p-2 rounded-xl border border-white/5">
                        <span className="text-gray-400">سعر الصنف:</span>
                        <span className="text-yellow-500 font-black flex items-center gap-1 text-[9.5px]">
                          <Shield size={10} />
                          <span>يتطلب ارتباط رسمي</span>
                        </span>
                      </div>

                      {/* Publisher business name (MANDATORY REQUIREMENT) */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[8.5px] text-gray-400 font-bold">
                          الناشر: <span className="text-gray-200">{prod.publisherName || 'مورد معتمد'}</span>
                        </div>
                        
                        {/* Owner/Publisher actions [تعديل / حذف] */}
                        {isOwner && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => startEditProduct(prod)}
                              title="تعديل"
                              className="p-1 bg-white/5 text-gray-300 hover:text-emerald-400 rounded-lg cursor-pointer transition-all border border-white/5 hover:bg-white/10"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id, prod.wholesalerId)}
                              title="حذف"
                              className="p-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg cursor-pointer transition-all border border-red-500/20"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // Grid View of Agencies/Brands
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agencies.map(agency => (
            <div 
              key={agency.id}
              className="bg-[#0b101e]/95 border border-white/5 rounded-3xl p-5 flex items-center gap-4 hover:border-emerald-500/20 transition-all duration-300 relative group overflow-hidden"
            >
              {/* Agency Logo Thumbnail */}
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 border border-white/5 shrink-0">
                <img 
                  src={agency.logoUrl || 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?auto=format&fit=crop&w=150&q=80'} 
                  alt={agency.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-all"
                />
              </div>

              {/* Agency Details */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-xs font-black text-white">{agency.name}</h4>
                  {agency.isAutomatic ? (
                    <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded text-[8px] font-black">
                      مزامنة تلقائية ⚡
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded text-[8px] font-black">
                      ماركة مسجلة 🌐
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">الناشر: {agency.publisherName || 'المستورد الرسمي'}</p>
                
                {agency.storeLink && (
                  <p className="text-[8px] text-gray-500 font-mono truncate max-w-[200px]" dir="ltr">
                    🔗 {agency.storeLink}
                  </p>
                )}
              </div>

              {/* Strict Rule Notice: No prices/quantities on agencies view */}
              <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-lg text-[7px] text-gray-400">
                ماركة محمية
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. MODAL: Publish / Edit Catalog Item */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-white/10 rounded-3xl max-w-lg w-full p-6 text-right space-y-4 animate-scale-in relative">
            
            <button 
              onClick={() => setIsPublishModalOpen(false)}
              className="absolute top-4 left-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Sparkles className="text-emerald-400 animate-pulse" size={18} />
              <h3 className="text-sm font-black text-white">
                {isEditMode ? 'تعديل صنف في كتالوج الاكتشاف' : 'نشر صنف جديد للكتالوج العام'}
              </h3>
            </div>

            <form onSubmit={handlePublishSubmit} className="space-y-4 text-xs">
              
              <div className="space-y-1.5">
                <label className="text-[#D4AF37] font-bold block">اسم الصنف المعروض:</label>
                <input 
                  type="text"
                  required
                  placeholder="مثال: شاحن Ramos الذكي 65 واط"
                  value={publishForm.name}
                  onChange={(e) => setPublishForm({ ...publishForm, name: e.target.value })}
                  className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-gray-400 block">فئة الصنف:</label>
                  <select
                    value={publishForm.category}
                    onChange={(e) => setPublishForm({ ...publishForm, category: e.target.value })}
                    className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none cursor-pointer"
                  >
                    {productCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400 block">الموقع / المدينة التوريدية:</label>
                  <select
                    value={publishForm.location}
                    onChange={(e) => setPublishForm({ ...publishForm, location: e.target.value })}
                    className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none cursor-pointer"
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 block">الوكالة أو الماركة المتبوعة (اختياري):</label>
                <select
                  value={isCustomAgency ? "__custom__" : publishForm.agencyName}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__custom__") {
                      setIsCustomAgency(true);
                      setPublishForm({ ...publishForm, agencyName: "" });
                    } else {
                      setIsCustomAgency(false);
                      setPublishForm({ ...publishForm, agencyName: val });
                    }
                  }}
                  className="w-full bg-[#0d101d] border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">لا توجد وكالة / عامة</option>
                  {agencies.map(a => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                  <option value="__custom__">✍️ كتابة ماركة مخصصة أخرى...</option>
                </select>
              </div>

              {isCustomAgency && (
                <div className="space-y-1.5">
                  <label className="text-[#D4AF37] block font-bold">اسم الماركة المخصصة:</label>
                  <input 
                    type="text"
                    required
                    placeholder="مثال: Ramos أو Bemas"
                    value={publishForm.agencyName}
                    onChange={(e) => setPublishForm({ ...publishForm, agencyName: e.target.value })}
                    className="w-full bg-[#0d101d] border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-gray-400 block">رابط صورة المعاينة (سيتم ضغطها تلقائياً):</label>
                <input 
                  type="text"
                  placeholder="https://..."
                  value={publishForm.imageUrl}
                  onChange={(e) => setPublishForm({ ...publishForm, imageUrl: e.target.value })}
                  className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[9px] text-gray-500 block">⚠️ نوصي برابط صورة خفيفة ومضغوطة لسرعة التصفح.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-400 block">تفاصيل أو ميزات الصنف:</label>
                <textarea 
                  rows={2}
                  placeholder="اكتب مواصفات المنتج دون ذكر الأسعار أو الكميات..."
                  value={publishForm.description}
                  onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                  className="w-full bg-navy-950/60 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/10 space-y-1 text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-400 font-black">
                  <Shield size={11} />
                  <span>معايير الأمان والتصفيات النشطة:</span>
                </div>
                <p className="text-gray-300 leading-tight">
                  كافة المعروضات في هذا التبويب خاضعة لقفل الأسعار الفوري، مما يسمح بعرض قوة تشكيلة منتجاتك دون التأثير على عملائك النشطين في السوق المغلق.
                </p>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <span>حفظ ونشر فوري بالشبكة 🚀</span>
              </button>

            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Add Product to Agency Flow / Choices */}
      {isAgencyModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-white/10 rounded-3xl max-w-xl w-full p-6 text-right space-y-4 animate-scale-in relative">
            
            <button 
              onClick={() => {
                setIsAgencyModalOpen(false);
                setAgencyFlowType(null);
              }}
              className="absolute top-4 left-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Globe className="text-emerald-400" size={18} />
              <h3 className="text-sm font-black text-white">إضافة منتجات لوكالة / ماركة موجودة</h3>
            </div>

            {agencyFlowType === null ? (
              <div className="space-y-4">
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  الرجاء تحديد نوع تدفق ربط وإدراج الوكالة والماركة التجارية الخاصة بكم في الكشاف العام:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  
                  {/* Choice 1: Automatic Stored Link */}
                  <div 
                    onClick={() => setAgencyFlowType('auto')}
                    className="bg-[#11162d]/50 hover:bg-[#11162d]/90 border border-white/5 hover:border-emerald-500/30 p-5 rounded-2xl cursor-pointer transition-all space-y-2 text-right group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-all">
                      <LinkIcon size={18} />
                    </div>
                    <h4 className="text-xs font-black text-white">[جلب وكالة مخزنة برابط مخزنها التلقائي]</h4>
                    <p className="text-[9.5px] text-gray-400 leading-snug">
                      توصيل آلي بالـ API الخاص بمخزن المورد ليقوم بجلب شعار وبيانات الوكالة ومزامنتها في كشاف الأصناف دورياً تلقائياً.
                    </p>
                  </div>

                  {/* Choice 2: New Manual Brand without prices */}
                  <div 
                    onClick={() => setAgencyFlowType('manual')}
                    className="bg-[#11162d]/50 hover:bg-[#11162d]/90 border border-white/5 hover:border-emerald-500/30 p-5 rounded-2xl cursor-pointer transition-all space-y-2 text-right group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center group-hover:scale-105 transition-all">
                      <Plus size={18} />
                    </div>
                    <h4 className="text-xs font-black text-white">[إنشاء وكالة جديدة باسمها وصورتها]</h4>
                    <p className="text-[9.5px] text-gray-400 leading-snug">
                      إدراج ماركة تجارية جديدة مخصصة بالكامل للعرض والتعارف، بدون تحديد أسعار أو كميات وبأقل حجم صور للمحافظة على الأداء الفوري.
                    </p>
                  </div>

                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateAgency} className="space-y-4 text-xs pt-2">
                
                <div className="space-y-1.5">
                  <label className="text-[#D4AF37] font-bold block">اسم الوكالة / الماركة:</label>
                  <input 
                    type="text"
                    required
                    placeholder="مثال: Ramos Yemen"
                    value={agencyForm.name}
                    onChange={(e) => setAgencyForm({ ...agencyForm, name: e.target.value })}
                    className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400 block">رابط شعار الوكالة (Thumbnail URL):</label>
                  <input 
                    type="text"
                    placeholder="https://..."
                    value={agencyForm.logoUrl}
                    onChange={(e) => setAgencyForm({ ...agencyForm, logoUrl: e.target.value })}
                    className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                {agencyFlowType === 'auto' && (
                  <div className="space-y-1.5">
                    <label className="text-emerald-400 font-bold block">رابط المزامنة التلقائي للمخزن (Store Link):</label>
                    <input 
                      type="text"
                      required
                      placeholder="https://my-store.com/b2b/sync-endpoint"
                      value={agencyForm.storeLink}
                      onChange={(e) => setAgencyForm({ ...agencyForm, storeLink: e.target.value })}
                      className="w-full bg-navy-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                )}

                <div className="bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/10 space-y-1 text-[9.5px] leading-relaxed text-gray-300">
                  <span className="text-emerald-400 font-black block">💡 قواعد الالتزام بالكشاف:</span>
                  ممنوع منعا باتاً عرض أي أسعار نهائية للجمهور أو تجار التجزئة المارة بغير ارتباط رسمي. الصور مضغوطة تلقائياً.
                </div>

                <div className="flex gap-2">
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 text-xs font-black rounded-xl transition-all hover:scale-[1.01] shadow-md cursor-pointer"
                  >
                    حفظ وإدراج 💾
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAgencyFlowType(null)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-all text-xs font-bold cursor-pointer"
                  >
                    رجوع
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
