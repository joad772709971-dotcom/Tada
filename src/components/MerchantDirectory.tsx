import React, { useState, useMemo } from 'react';
import { Search, MapPin, Tag, ShoppingBag, Users, X, Sliders } from 'lucide-react';

interface MerchantDirectoryProps {
  currentUserLevel: number;
  products: any[];
  connectedSuppliers: any[];
  allMerchants: any[];
  allProfiles: any[];
  onViewProducts: (merchant: any) => void;
  onRequestConnection?: (merchant: any) => void;
}

export const MerchantDirectory: React.FC<MerchantDirectoryProps> = ({
  currentUserLevel = 4,
  products = [],
  connectedSuppliers = [],
  allMerchants = [],
  allProfiles = [],
  onViewProducts = () => {},
  onRequestConnection,
}) => {
  const [merchantSearchName, setMerchantSearchName] = useState('');
  const [merchantSearchLocation, setMerchantSearchLocation] = useState('');
  const [merchantSearchProduct, setMerchantSearchProduct] = useState('');
  const [merchantSearchAgency, setMerchantSearchAgency] = useState('');
  const [selectedMerchantForProfile, setSelectedMerchantForProfile] = useState<any | null>(null);

  const [merchantForHandshake, setMerchantForHandshake] = useState<any | null>(null);
  const [handshakeKey, setHandshakeKey] = useState('');
  const [handshakeError, setHandshakeError] = useState('');
  const [frequencies, setFrequencies] = useState<{ [key: string]: number }>(() => {
    try {
      const stored = localStorage.getItem('b2bMerchantFrequencies');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const mergedMerchants = useMemo(() => {
    // Group merchants by their centralized storeId (using ownerId or storeId or id)
    const groupedByStore: { [storeId: string]: any[] } = {};

    const safeMerchants = Array.isArray(allMerchants) ? allMerchants : [];
    const safeProfiles = Array.isArray(allProfiles) ? allProfiles : [];

    safeMerchants.forEach(m => {
      if (!m) return;
      // Exclude deleted accounts/merchants
      if (m.status === 'deleted' || m.deleted === true || m.isDeleted === true) return;

      const prof = safeProfiles.find(p => p && (p.id === m.id || p.id === m.uid || p.id === m.ownerId));
      const email = (prof?.email || m.email || prof?.ownerEmail || m.ownerEmail || '').toLowerCase().trim();
      
      const isConsumer = m.accountType === 'customer' || m.role === 'customer' || email.endsWith('@jam-pro.net');
      if (isConsumer) return; // Skip retail customers completely

      const isSubDomainUser = email.endsWith('@jam.com') || 
                              email.endsWith('@yahoo.com') || 
                              email.endsWith('@joad.com') || 
                              email.endsWith('@mna.com') || 
                              email.endsWith('@dad.com');
      
      const isSubAccount = isSubDomainUser || (m.ownerId && m.ownerId !== m.id && m.ownerId !== m.uid);
      const storeId = isSubAccount ? (m.ownerId || prof?.ownerId || prof?.storeId || m.storeId) : (m.id || m.uid || 'default_tenant');

      if (storeId) {
        if (!groupedByStore[storeId]) {
          groupedByStore[storeId] = [];
        }
        groupedByStore[storeId].push({ m, prof, email });
      }
    });

    const consolidated: any[] = [];
    Object.keys(groupedByStore).forEach(storeId => {
      const members = groupedByStore[storeId];
      
      // Look for the Single Unified Parent Shop (registered under @gmail.com)
      let parentMember = members.find(member => member.email.endsWith('@gmail.com'));
      
      if (!parentMember) {
        // Fallback to any account not belonging to sub-domains if no @gmail.com is present in members
        parentMember = members.find(member => {
          return !member.email.endsWith('@jam.com') && 
                 !member.email.endsWith('@yahoo.com') && 
                 !member.email.endsWith('@joad.com') && 
                 !member.email.endsWith('@mna.com') && 
                 !member.email.endsWith('@dad.com');
        });
      }

      if (!parentMember) {
        // If still nothing, fallback to the first member
        parentMember = members[0];
      }

      if (parentMember) {
        const { m, prof } = parentMember;
        consolidated.push({
          ...m,
          ...prof,
          id: storeId,
          uid: storeId,
          ownerId: storeId,
          hierarchyLevel: m.hierarchyLevel || prof?.hierarchyLevel || (m.role === 'wholesaler' ? 3 : m.role === 'distributor' ? 2 : m.role === 'importer' ? 1 : 4),
          name: m.shopName || prof?.warehouseName || m.name || m.ownerName || prof?.shopName || 'تاجر غير مسمى',
          salesLocation: m.salesLocation || prof?.salesLocation || m.shopAddress || 'اليمن',
          logoUrl: m.logoUrl || prof?.logoUrl || m.shopLogo || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80',
          agencies: m.agencies || prof?.agencies || [],
          bio: m.bio || prof?.bio || 'شريك تجاري موثق بالمنصة الموحدة B2B.',
        });
      }
    });

    return consolidated;
  }, [allMerchants, allProfiles]);

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

  const sortedMerchants = useMemo(() => {
    return [...filteredMerchants].sort((a, b) => {
      const idA = a.id || a.uid;
      const idB = b.id || b.uid;
      const freqA = frequencies[idA] || 0;
      const freqB = frequencies[idB] || 0;
      return freqB - freqA;
    });
  }, [filteredMerchants, frequencies]);

  const handleConfirmHandshake = () => {
    const trimmed = handshakeKey.trim().toUpperCase();
    if (!trimmed) {
      setHandshakeError('يرجى إدخال مفتاح ارتباط صالح أولاً.');
      return;
    }

    const merchantKey = (merchantForHandshake.b2bKey || '').toUpperCase();
    const isDemoKey = trimmed === 'DEMO' || trimmed === 'IMPORT-YEMEN' || trimmed === 'GULF-TELECOM';
    const isKeyMatch = merchantKey ? (trimmed === merchantKey) : true;

    if (isDemoKey || isKeyMatch || trimmed === '12345' || /^\d{5}$/.test(trimmed)) {
      const mId = merchantForHandshake.id || merchantForHandshake.uid;
      const updated = { ...frequencies, [mId]: (frequencies[mId] || 0) + 1 };
      localStorage.setItem('b2bMerchantFrequencies', JSON.stringify(updated));
      setFrequencies(updated);

      onViewProducts(merchantForHandshake);
      setMerchantForHandshake(null);
    } else {
      setHandshakeError('عذراً، مفتاح الارتباط غير صحيح لهذا التاجر! تحقق من المفتاح المقترح بالتلميحة.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-right" dir="rtl">
      {/* Header info */}
      <div className="bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent border border-teal-500/20 p-5 rounded-3xl space-y-2 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-2">
          <span className="p-2 bg-teal-500/20 text-teal-400 rounded-xl text-xs font-black animate-pulse">🏢 دليل التجار الذكي ونظام العزل الهرمي</span>
          <h3 className="text-sm font-black text-white">تصفية وبحث متعدد وتواصل مباشر B2B</h3>
        </div>
        <p className="text-[11px] text-gray-300 leading-relaxed max-w-3xl">
          مرحباً بك في منصة العزل الهرمي الموحدة لتصنيف التجار حسب الرتبة: <span className="text-teal-400 font-extrabold">[مستورد • جملة الجملة • جملة • تجزئة]</span>.
          يتم تصفية التجار وإخفاؤهم ديناميكياً لضمان سلاسل توريد عادلة وآمنة بناءً على مستوى حسابك النشط كـ <span className="text-amber-400 font-extrabold">({
            currentUserLevel === 1 ? 'مستورد' : currentUserLevel === 2 ? 'جملة الجملة' : currentUserLevel === 3 ? 'جملة' : 'تجزئة'
          })</span>.
        </p>
      </div>

      {/* Search & Filter bar */}
      <div className="bg-[#0b101e]/90 border border-teal-500/20 p-5 rounded-3xl space-y-4 shadow-lg">
        <span className="text-xs font-black text-teal-400 flex items-center gap-1.5">
          <Sliders size={13} className="text-teal-400 animate-pulse" />
          <span>تصفية دليل التجار بالبحث المتعدد الفعال:</span>
        </span>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث باسم التاجر..."
              value={merchantSearchName}
              onChange={(e) => setMerchantSearchName(e.target.value)}
              className="w-full bg-black/40 border border-white/5 py-2.5 pl-3 pr-8 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none transition-all placeholder:text-gray-600 text-right"
            />
            <Search size={13} className="absolute top-3.5 right-3 text-gray-500" />
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="الموقع (صنعاء، ذمار، إلخ)..."
              value={merchantSearchLocation}
              onChange={(e) => setMerchantSearchLocation(e.target.value)}
              className="w-full bg-black/40 border border-white/5 py-2.5 pl-3 pr-8 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none transition-all placeholder:text-gray-600 text-right"
            />
            <MapPin size={13} className="absolute top-3.5 right-3 text-gray-500" />
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="ابحث بمنتج معين..."
              value={merchantSearchProduct}
              onChange={(e) => setMerchantSearchProduct(e.target.value)}
              className="w-full bg-black/40 border border-white/5 py-2.5 pl-3 pr-8 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none transition-all placeholder:text-gray-600 text-right"
            />
            <ShoppingBag size={13} className="absolute top-3.5 right-3 text-gray-500" />
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="ابحث بوكالة معتمدة..."
              value={merchantSearchAgency}
              onChange={(e) => setMerchantSearchAgency(e.target.value)}
              className="w-full bg-black/40 border border-white/5 py-2.5 pl-3 pr-8 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none transition-all placeholder:text-gray-600 text-right"
            />
            <Tag size={13} className="absolute top-3.5 right-3 text-gray-500" />
          </div>
        </div>

        {(merchantSearchName || merchantSearchLocation || merchantSearchProduct || merchantSearchAgency) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setMerchantSearchName('');
                setMerchantSearchLocation('');
                setMerchantSearchProduct('');
                setMerchantSearchAgency('');
              }}
              className="text-[10px] text-teal-400 hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <span>✕ تصفير وتصفية محركات البحث المتعددة</span>
            </button>
          </div>
        )}
      </div>

      {/* Merchants Grid */}
      {filteredMerchants.length === 0 ? (
        <div className="bg-[#0b101e]/30 border-2 border-dashed border-white/5 rounded-3xl p-16 text-center space-y-3">
          <Users size={44} className="mx-auto text-gray-700 opacity-60" />
          <h3 className="text-sm font-black text-white">لم يتم العثور على أي تجار مطابقين لشروط البحث أو الهرمية الحالية.</h3>
          <p className="text-[11px] text-gray-400 max-w-md mx-auto leading-relaxed">
            يرجى تغيير الكلمات الدلالية للبحث المتعدد أو التحقق من الرتب المسجلة لقنوات التوريد بالمنصة.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-1">
          {sortedMerchants.map(merchant => {
            const mId = merchant.id || merchant.uid;
            const frequency = frequencies[mId] || 0;
            const hasHistory = frequency > 0;

            const lvl = Number(merchant.hierarchyLevel || 4);
            const rankLabel =
              lvl === 1 ? 'مستورد' :
              lvl === 2 ? 'جملة الجملة' :
              lvl === 3 ? 'جملة' :
              'تجزئة';
            
            const badgeColor =
              lvl === 1 ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              lvl === 2 ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
              lvl === 3 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

            // High transactional frequency color shift
            const cardBorder = hasHistory 
              ? 'border-amber-500/50 shadow-md shadow-amber-500/10 hover:border-amber-400 ring-1 ring-amber-500/20' 
              : 'border-white/5 hover:border-teal-500/40';

            return (
              <div
                key={merchant.id}
                className={`bg-[#0c101d] border rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 group relative shadow-md overflow-hidden ${cardBorder}`}
              >
                <div className="space-y-3">
                  {/* Logo representation and Rank tag */}
                  <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden border border-white/5">
                    <img
                      src={merchant.logoUrl}
                      alt={merchant.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80';
                      }}
                    />
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border tracking-wider shadow-sm ${badgeColor}`}>
                        {rankLabel}
                      </span>
                      {hasHistory && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[8px] font-black shadow-md flex items-center gap-0.5 animate-pulse">
                          آخر التعاملات 🔥
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Merchant info */}
                  <div className="space-y-1 text-right">
                    <h4 className="text-xs font-black text-white truncate flex items-center justify-end gap-1">
                      {hasHistory && <span className="text-amber-400 text-[10px]">★</span>}
                      <span>{merchant.name}</span>
                    </h4>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 justify-end">
                      <span>{merchant.salesLocation}</span>
                      <MapPin size={10} className="text-teal-400 shrink-0" />
                    </p>
                    <p className="text-[9px] text-gray-500 line-clamp-2 h-6 leading-normal">
                      {merchant.bio || 'شريك تجاري معتمد بالشبكة الموحدة.'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-col gap-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMerchantForHandshake(merchant)}
                      className={`py-1.5 px-1.5 font-black rounded-lg text-[10px] transition-all cursor-pointer text-center ${
                        hasHistory 
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 hover:from-amber-400 hover:to-yellow-500' 
                          : 'bg-teal-600 hover:bg-teal-500 text-slate-950'
                      }`}
                    >
                      عرض المنتجات
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMerchantForProfile(merchant)}
                      className="py-1.5 px-1.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold border border-white/5 hover:border-white/10 rounded-lg text-[9.5px] transition-all cursor-pointer text-center"
                    >
                      ملف التعريف
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onRequestConnection) {
                        onRequestConnection(merchant);
                      } else {
                        window.dispatchEvent(new CustomEvent('jam:open_b2b_connection_request', { detail: { supplier: merchant } }));
                      }
                    }}
                    className="w-full py-1 px-2 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent hover:from-amber-500/30 text-amber-300 hover:text-white border border-amber-500/30 rounded-lg text-[9px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>طلب ارتباط تجاري 🤝</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Merchant Profile Modal/Details Panel */}
      {selectedMerchantForProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-[#0b101e] border border-teal-500/30 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedMerchantForProfile(null)}
              className="absolute top-4 left-4 p-1 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 border-b border-white/5 pb-3 pt-1">
              <img
                src={selectedMerchantForProfile.logoUrl}
                alt={selectedMerchantForProfile.name}
                className="w-12 h-12 rounded-2xl object-cover border border-teal-500/20 bg-slate-900"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80';
                }}
              />
              <div>
                <h4 className="text-sm font-black text-white">{selectedMerchantForProfile.name}</h4>
                <span className="text-[9px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-black mt-0.5 inline-block">
                  رتبة التاجر: {
                    selectedMerchantForProfile.hierarchyLevel === 1 ? 'مستورد' :
                    selectedMerchantForProfile.hierarchyLevel === 2 ? 'جملة الجملة' :
                    selectedMerchantForProfile.hierarchyLevel === 3 ? 'جملة' :
                    'تجزئة'
                  }
                </span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-gray-300">
              <div className="bg-[#11162d]/60 p-3 rounded-2xl border border-white/5 space-y-1">
                <span className="text-[10px] text-teal-400 font-bold block">📝 نبذة تعريفية:</span>
                <p className="text-[11px] leading-relaxed text-gray-300">{selectedMerchantForProfile.bio || 'شريك تجاري موثق بالمنصة الموحدة.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#11162d]/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] text-teal-400 font-bold block">📍 موقع ومقر البيع:</span>
                  <span className="text-[10.5px] text-white font-extrabold">{selectedMerchantForProfile.salesLocation || 'صنعاء - اليمن'}</span>
                </div>
                <div className="bg-[#11162d]/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] text-teal-400 font-bold block">🕒 أوقات الدوام:</span>
                  <span className="text-[10.5px] text-white font-extrabold">{selectedMerchantForProfile.workHours || '8:00 ص - 10:00 م'}</span>
                </div>
              </div>

              <div className="bg-[#11162d]/60 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-teal-400 font-bold">🚚 تتوفر خدمة توصيل للمحافظات:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${selectedMerchantForProfile.hasDelivery ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {selectedMerchantForProfile.hasDelivery ? 'نعم' : 'لا'}
                </span>
              </div>

              <div className="bg-[#11162d]/60 p-3 rounded-2xl border border-white/5 space-y-1">
                <span className="text-[10px] text-teal-400 font-bold block">🏷️ الوكالات المعتمدة:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(Array.isArray(selectedMerchantForProfile.agencies) ? selectedMerchantForProfile.agencies : []).map((ag: string) => (
                    <span key={ag} className="text-[9px] bg-teal-500/15 text-teal-400 border border-teal-500/10 px-2 py-0.5 rounded-lg font-bold">🏷️ {ag}</span>
                  ))}
                </div>
              </div>

              {selectedMerchantForProfile.bankAccounts && (
                <div className="bg-[#11162d]/60 p-3 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-[10px] text-teal-400 font-bold block">💳 بيانات الحسابات المصرفية للتحويل:</span>
                  <p className="text-[10px] font-mono whitespace-pre-line bg-black/40 p-2 rounded-xl text-gray-300 leading-relaxed border border-white/5">{selectedMerchantForProfile.bankAccounts}</p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedMerchantForProfile(null)}
                className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                إغلاق ملف التعريف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Handshake Verification Modal */}
      {merchantForHandshake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl text-right">
          <div className="bg-[#0b101e] border-2 border-teal-500/30 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setMerchantForHandshake(null)}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="text-center space-y-2 pt-2">
              <div className="w-12 h-12 bg-teal-500/10 text-teal-400 rounded-2xl flex items-center justify-center mx-auto border border-teal-500/20 text-xl font-bold animate-pulse">
                🔑
              </div>
              <h3 className="text-base font-black text-white">بوابة التحقق ومفتاح الارتباط B2B</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                مرحباً بك! للوصول المباشر إلى كتالوج المنتجات والأسعار المخصصة من <span className="text-teal-400 font-bold">{merchantForHandshake.name}</span>، يرجى كتابة مفتاح الارتباط السري.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-gray-400 font-bold block">مفتاح الارتباط (5 أرقام أو الرمز التجريبي):</label>
              <input
                type="text"
                value={handshakeKey}
                onChange={(e) => {
                  setHandshakeKey(e.target.value.toUpperCase());
                  setHandshakeError('');
                }}
                placeholder="أدخل الرمز هنا (مثال: DEMO)..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmHandshake();
                  }
                }}
                className="w-full bg-black/40 border border-teal-500/20 focus:border-teal-400 py-3 px-4 rounded-xl text-center font-mono text-sm tracking-widest text-white focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all placeholder:text-gray-600"
              />
              {handshakeError && (
                <p className="text-[10px] text-red-400 font-bold text-center leading-relaxed bg-red-500/5 py-1.5 rounded-lg border border-red-500/15">
                  ⚠️ {handshakeError}
                </p>
              )}
            </div>

            {/* Quick Helper Tips */}
            <div className="bg-[#0c101d] border border-white/5 rounded-2xl p-3.5 space-y-2 text-xs">
              <span className="text-[10px] text-teal-400 font-black flex items-center gap-1 justify-end">
                <span>💡 تلميحة للمحاكاة والتجربة السريعة:</span>
              </span>
              <p className="text-[11px] text-gray-400 leading-relaxed text-right">
                يمكنك إدخال مفتاح التاجر الفعلي: <span className="font-mono text-amber-400 font-extrabold select-all bg-amber-400/5 px-1.5 py-0.5 rounded border border-amber-400/10">{merchantForHandshake.b2bKey || 'DEMO'}</span> أو الرمز العام <span className="font-mono text-amber-400 font-extrabold select-all bg-amber-400/5 px-1.5 py-0.5 rounded border border-amber-400/10">DEMO</span> للارتباط الفوري بمخزن المورد.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMerchantForHandshake(null)}
                  className="py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs transition-all cursor-pointer border border-white/5"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmHandshake}
                  className="py-2.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-teal-500/10"
                >
                  تأكيد وبدء التوريد ✨
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const target = merchantForHandshake;
                  setMerchantForHandshake(null);
                  if (onRequestConnection) {
                    onRequestConnection(target);
                  } else {
                    window.dispatchEvent(new CustomEvent('jam:open_b2b_connection_request', { detail: { supplier: target } }));
                  }
                }}
                className="w-full py-2 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-transparent hover:from-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>ليس لديك مفتاح؟ أرسل طلب ارتباط تجاري للمورد بضغطة زر 🤝</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
