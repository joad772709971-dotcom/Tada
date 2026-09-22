import React, { useState } from 'react';
import { useMockData } from '../context/MockDataContext';
import { Plus, Phone, MapPin, Sparkles, LogIn, RefreshCw, Key, ShieldCheck, Award, TrendingUp, Gavel, Stethoscope, ShoppingBag, Gift, ArrowLeftRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PortalHubProps {
  onSelectStore: (storeId: string) => void;
  currentUser: any;
  onLoginTrigger: () => void;
}

export default function PortalHub({ onSelectStore, currentUser, onLoginTrigger }: PortalHubProps) {
  const { 
    stores, 
    points, 
    checkImeiLocally, 
    setActiveStoreById 
  } = useMockData();
  
  const [isCreating, setIsCreating] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  
  // Custom store form state
  const [customId, setCustomId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customColor, setCustomColor] = useState('#fbbf24'); // default elite amber/gold
  const [customPhone, setCustomPhone] = useState('+966 50 111 2222');
  const [customAddress, setCustomAddress] = useState('المملكة العربية السعودية، الخبر');
  const [formError, setFormError] = useState('');

  // IMEI diagnostic state
  const [imeiInput, setImeiInput] = useState('');
  const [imeiResult, setImeiResult] = useState<{ success: boolean; status: string; device: string; message: string } | null>(null);
  const [imeiLoading, setImeiLoading] = useState(false);

  // Quick info modal for bento selections
  const [bentoPromo, setBentoPromo] = useState<{ title: string; desc: string; colorClass: string; isVisible: boolean }>({
    title: '',
    desc: '',
    colorClass: '',
    isVisible: false
  });

  const handleImeiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imeiInput.trim()) return;
    setImeiLoading(true);
    setImeiResult(null);
    setTimeout(() => {
      const res = checkImeiLocally(imeiInput);
      setImeiResult(res);
      setImeiLoading(false);
    }, 900);
  };

  const handleCreateStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanId = customId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanId || cleanId.length < 3) {
      setFormError('يرجى إدخال معرف فريد باللغة الإنجليزية (على الأقل 3 أحرف، وبدون رموز خاصة).');
      return;
    }

    if (!customName.trim()) {
      setFormError('اسم الماركة مطلوب.');
      return;
    }

    // Direct registration inside mock context
    setActiveStoreById(cleanId);
    onSelectStore(cleanId);
  };

  const triggerBentoAction = (title: string, desc: string, colorClass: string) => {
    setBentoPromo({
      title,
      desc,
      colorClass,
      isVisible: true
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 text-right select-none" dir="rtl" id="portal-hub-container">
      
      {/* 1. TOP Welcome Header & Points Widget exact match to the user's requested layout */}
      <div className="text-center mb-8" id="portal-header">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-yellow-500 rounded-full text-[11px] font-bold mb-3">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>منظومة JAM-Market-VIP لإدارة عملاء النخبة</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
          المنصة الملكية الموحدة للزبائن
        </h1>
        <p className="text-slate-400 mt-2 text-xs md:text-sm max-w-xl mx-auto">
          مرحباً بكم في البوابة الشاملة متعددة الهويات لتتبع كشوف الصيانة والمشاركة بالمزادات والحراجات الحية لكافة الفروع.
        </p>
      </div>

      {/* 2. THE PREMIUM ROYAL VIP ACCOUNT STATUS CARD (From the uploaded high-end layout) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0c1c38] to-[#040e1c] border-2 border-amber-500/20 rounded-3xl p-6 mb-8 shadow-2xl neon-glow-gold" id="premium-status-panel">
        <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -z-10"></div>
        
        {/* Card header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base text-white">رويال بريميوم VIP</span>
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] uppercase rounded-md tracking-wider">Level 4</span>
              </div>
              <span className="text-[10px] text-amber-500/80 font-mono tracking-wider block">ID: {currentUser ? currentUser.uid.substring(0, 10).toUpperCase() : 'DE_GUEST_USER'}</span>
            </div>
          </div>
          
          <div className="text-left">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">النقاط النشطة حالياً</span>
            <span className="text-2xl font-black text-amber-500 tracking-tight font-mono">{points.toLocaleString()}</span>
          </div>
        </div>

        {/* Custom Progress gauge bar */}
        <div className="bg-slate-950/80 border border-white/[0.05] p-4 rounded-2xl mb-5">
          <div className="flex justify-between items-center mb-2 text-[10px] text-slate-400 font-bold">
            <span>اللقب القادم: رويال ماستر</span>
            <span className="text-amber-400">NEXT LEVEL: 1,500</span>
          </div>
          <div className="w-full bg-slate-900 h-2 py-0.5 px-0.5 rounded-full overflow-hidden border border-white/[0.03]">
            <div 
              className="bg-gradient-to-r from-amber-600 to-yellow-400 h-full rounded-full transition-all duration-1000"
              style={{ width: `${(points / 1500) * 100}%` }}
            ></div>
          </div>
          <p className="text-[9px] text-slate-500 mt-2">
            * كل مزايدة حية تشارك بها تمنحك +30 نقطة رصيد. وكل حجز في القرعات والجوائز يهبك +50 نقطة فورية لترقية حسابك.
          </p>
        </div>

        {/* Action triggers matching image buttons "نظام النقاط" and "لوحة الحساب" */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => triggerBentoAction("بنك النقاط الملكي", "أهلاً بك في خدمات بنك النقاط. يمكنك تحويل نقاطك الملكية واستبدالها بكوبونات ترويجية وأعمال صيانة من شاشات المتاجر الفرعية.", "from-amber-500 to-yellow-400 text-slate-950")}
            className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-slate-950 font-extrabold text-xs py-2.5 rounded-xl hover:brightness-110 active:scale-95 transition shadow-lg shadow-amber-500/10"
          >
            استعراض نظام النقاط
          </button>
          <button 
            onClick={() => {
              if (currentUser) {
                alert(`أهلاً بك ${currentUser.displayName}. حسابك مفعل ونشط برتبة رويال بريميوم.`);
              } else {
                onLoginTrigger();
              }
            }}
            className="bg-slate-900/80 border border-white/[0.1] hover:bg-slate-900 text-white font-extrabold text-xs py-2.5 rounded-xl active:scale-95 transition"
          >
            {currentUser ? 'تفاصيل لوحة الحساب' : 'تفعيل العضوية / دخول'}
          </button>
        </div>
      </div>

      {/* 3. CENTER OF OPERATIONS: "مرئيات التجارة الذكية" */}
      <div className="mb-8" id="operations-center">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-black text-white">مركز التجارة الذكية</h2>
        </div>
        
        {/* Device Status IMEI unlocker block from user image */}
        <form onSubmit={handleImeiSubmit} className="bg-slate-900/50 border border-white/[0.05] p-5 rounded-2xl" id="imei-form">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 text-right w-full">
              <label className="block text-xs font-bold text-slate-300 mb-2">
                تتبع أو فك ارتباط الأجهزة والشبكات ⚡ أدخل رقم الكود أو IMEI للهاتف:
              </label>
              <input 
                type="text" 
                value={imeiInput}
                onChange={(e) => setImeiInput(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={15}
                placeholder="رقم الكود أو IMEI (مثال: 358902115566778)" 
                className="w-full bg-[#030914] text-amber-400 border border-white/[0.08] focus:border-amber-500/50 rounded-xl px-4 py-3 text-sm text-center font-mono tracking-widest outline-none"
              />
            </div>
            <button 
              type="submit"
              disabled={imeiLoading || !imeiInput.trim()}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-xl text-xs hover:brightness-110 transition shrink-0 tracking-wide"
            >
              {imeiLoading ? 'جاري التحقق...' : 'تتبع وحالة القفل'}
            </button>
          </div>

          <AnimatePresence>
            {imeiResult && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mt-4 p-4 rounded-xl text-xs font-semibold ${
                  imeiResult.status === 'unlocked' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">🖥️ نوع الهاتف المسجل: {imeiResult.device}</span>
                  <span className="uppercase text-[9px] tracking-widest px-2 py-0.5 bg-white/10 rounded font-bold">{imeiResult.status}</span>
                </div>
                <p className="mt-1 leading-relaxed">{imeiResult.message}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>

      {/* 4. THE EXQUISITE BENTO GRID (Bespoke Luxury Layout from the user’s picture) */}
      <div className="grid grid-cols-2 gap-4 mb-8" id="bento-navigation-grid">
        
        {/* Bento Cell 1: Phone Doctor */}
        <div 
          onClick={() => triggerBentoAction("طبيب الصيانة الذكي", "خدمة ممتازة لك وفحص مجاني فوري! تصفح طرازات الصيانة، كشوف وتكاليف تبديل الشاشات، صيانة الشحن وتحديث البطاريات لدى أي فرع تختاره.", "border-cyan-500/30 text-cyan-400")}
          className="group relative overflow-hidden bg-gradient-to-br from-[#071529]/80 to-[#020914]/90 border border-white/[0.04] p-5 rounded-2xl cursor-pointer hover:border-cyan-500/30 transition-all duration-300 neon-glow-cyan flex flex-col justify-between h-36"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Stethoscope className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
          </div>
          <div>
            <h3 className="font-black text-sm text-white group-hover:text-cyan-300 transition-colors">طبيب الهاتف</h3>
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">لوحة كشف الأعطال وتسعير القطع</p>
          </div>
        </div>

        {/* Bento Cell 2: Smart Store */}
        <div 
          onClick={() => triggerBentoAction("المتجر الذكي والمبيعات", "عروض حصرية لزبائن VIP من شركة منظومة JAM، نوفر نوادر الأجهزة، ملحقات أبل وسامسونج، بضمانات حقيقية وأسعار تنافسية لا تضاهى.", "border-yellow-500/30 text-yellow-400")}
          className="group relative overflow-hidden bg-gradient-to-br from-[#121307]/80 to-[#020914]/90 border border-white/[0.04] p-5 rounded-2xl cursor-pointer hover:border-yellow-500/30 transition-all duration-300 neon-glow-gold flex flex-col justify-between h-36"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-yellow-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="px-2 py-0.5 bg-yellow-500 text-slate-950 text-[8px] font-black rounded-md uppercase">VIP Offer</span>
          </div>
          <div>
            <h3 className="font-black text-sm text-white group-hover:text-yellow-300 transition-colors">المتجر الذكي</h3>
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">بوابات عروض الهواتف والإكسسوارات الحصرية</p>
          </div>
        </div>

        {/* Bento Cell 3: Live Auctions */}
        <div 
          onClick={() => triggerBentoAction("المزايدات والحراج الحي المباشر", "بوابة حماسية ومفتوحة! المزايدة الحية مستمرة وتتحدث فورياً لجميع المتابعين بأحدث الصفقات. اضغط على أي متجر أدناه للدخول والمشاركة فوراً.", "border-amber-500/30 text-amber-400")}
          className="group relative overflow-hidden bg-gradient-to-br from-[#181102]/80 to-[#020914]/90 border border-white/[0.04] p-5 rounded-2xl cursor-pointer hover:border-amber-500/30 transition-all duration-300 neon-glow-gold flex flex-col justify-between h-36"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-amber-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Gavel className="w-5 h-5 text-amber-500" />
            </div>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
          </div>
          <div>
            <h3 className="font-black text-sm text-white group-hover:text-amber-300 transition-colors">المزايدات الحية</h3>
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">لايف وحماس الحراج المستمر على النوادر</p>
          </div>
        </div>

        {/* Bento Cell 4: Points Bank */}
        <div 
          onClick={() => triggerBentoAction("بنك النقاط الترويجي", "حول نقاطك الملكية لهدايا فورية وسعيدة! بمجرد تخطي مستوى النقاط المطلوب، ستفعل لك خيارات الاستبدال التلقائية بقسائم وجوائز بالفرع.", "border-emerald-500/30 text-emerald-400")}
          className="group relative overflow-hidden bg-gradient-to-br from-[#041611]/80 to-[#020914]/90 border border-white/[0.04] p-5 rounded-2xl cursor-pointer hover:border-emerald-500/30 transition-all duration-300 neon-glow-emerald flex flex-col justify-between h-36"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Gift className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="font-black text-sm text-white group-hover:text-emerald-300 transition-colors">بنك النقاط</h3>
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">حول نقاطك مباشرة إلى هدايا وكوبونات</p>
          </div>
        </div>

      </div>

      {/* A Dynamic bento preview modal for clean feedback */}
      <AnimatePresence>
        {bentoPromo.isVisible && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`bg-[#061224] border-2 border-slate-700/60 p-5 rounded-2xl mb-8 relative text-right flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-amber-400 text-sm">💡 معلومات الخدمة</span>
                <button 
                  onClick={() => setBentoPromo(prev => ({ ...prev, isVisible: false }))} 
                  className="font-mono text-slate-500 hover:text-white font-extrabold text-[11px] px-2 py-0.5 rounded border border-white/5 bg-white/5 cursor-pointer"
                >
                  إغلاق x
                </button>
              </div>
              <h4 className="font-extrabold text-white text-base mb-1">{bentoPromo.title}</h4>
              <p className="text-slate-300 text-xs leading-relaxed">{bentoPromo.desc}</p>
            </div>
            
            <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-amber-500">
              <span>* تصفح المتاجر الشريكة بالأسفل للدخول واستخدام هذه الخدمة فورياً.</span>
              <button 
                onClick={() => {
                  setBentoPromo(prev => ({ ...prev, isVisible: false }));
                  // Auto scroll to stores
                  document.getElementById('stores-list-heading')?.scrollIntoView({ behavior: 'smooth' });
                }} 
                className="font-bold underline text-white"
              >
                انتقل للمتاجر الآن ←
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. MULTI-IDENTITY STORES LIST PANEL */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-white/[0.04] pb-3" id="stores-list-heading">
        <h2 className="font-black text-white text-lg flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-amber-500" />
          <span>المتاجر النشطة بهويات بصرية مستقلة</span>
        </h2>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsCreating(!isCreating)}
            className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            id="create-store-toggler"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>تسجيل ماركة جديدة</span>
          </button>
        </div>
      </div>

      {/* Form: White-Label Custom Tenant registration */}
      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6 bg-[#040e1b] border border-amber-500/20 rounded-2xl p-5"
            id="create-store-form-accordion"
          >
            <form onSubmit={handleCreateStoreSubmit} className="space-y-4">
              <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                <span>إضافة متجر فرعي فوري مخصص للبرمجة الهندسية</span>
              </h3>
              
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 text-rose-400 p-2.5 rounded-xl text-xs font-bold text-center">
                  ⚠️ {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-400 mb-1.5">معرف المتجر باللغة الإنجليزية (SLUG ID) *</label>
                  <input 
                    type="text" 
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                    placeholder="مثال: fuji-smart" 
                    className="w-full bg-[#020712] text-white border border-white/5 rounded-xl px-3 py-2 outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5">اسم الماركة / الفرع الموجه المباشر *</label>
                  <input 
                    type="text" 
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="مثال: صيانة ومزاد الفوجي بلاس" 
                    className="w-full bg-[#020712] text-white border border-white/5 rounded-xl px-3 py-2 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)} 
                  className="px-4 py-2 border border-white/10 text-xs text-slate-400 hover:text-white rounded-xl transition"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 rounded-xl text-xs font-black hover:brightness-110 transition"
                >
                  حفظ وتوليد السيرفر التلقائي والمزاد
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stores rendering list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans" id="stores-grid">
        {stores.map((st) => (
          <motion.div 
            key={st.id}
            onClick={() => onSelectStore(st.id)}
            whileHover={{ y: -3, transition: { duration: 0.15 } }}
            className="group block bg-[#061224]/80 border border-white/[0.04] p-5 rounded-2xl cursor-pointer hover:border-amber-500/20 transition-all flex flex-col justify-between"
            id={`store-card-${st.id}`}
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-white/10 overflow-hidden shrink-0">
                    <img src={st.logoUrl} alt={st.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white group-hover:text-amber-400 transition-colors line-clamp-1">{st.name}</h3>
                    <span className="text-[10px] text-amber-500/80 font-mono tracking-wider">ID: {st.id}</span>
                  </div>
                </div>
                
                {/* Visual Accent indicator */}
                <span 
                  className="w-3.5 h-3.5 rounded-full border-2 border-slate-900 shadow" 
                  style={{ backgroundColor: st.primaryColor }}
                ></span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 mb-3">
                {st.description}
              </p>
            </div>

            <div className="border-t border-white/[0.03] pt-3 mt-1 flex items-center justify-between text-slate-500 text-[10px]">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                <span className="line-clamp-1">{st.address}</span>
              </div>
              <span className="text-amber-400 font-bold font-sans shrink-0 hover:underline">أدخل المتجر ←</span>
            </div>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
