import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMockData } from '../context/MockDataContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getStoresList, fetchExternalStoreData } from '../utils/firebaseHelpers';
import { 
  Crown, 
  Sparkles, 
  Store, 
  ArrowLeft, 
  ShieldCheck, 
  Check, 
  LogOut, 
  MapPin, 
  Phone,
  ArrowUpRight,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

export default function SelectStore() {
  const navigate = useNavigate();
  const { 
    stores, 
    clientUser, 
    setClientUser, 
    loadStoreSettings, 
    points, 
    activateStoreWithCode 
  } = useMockData();
  
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [discoveredStores, setDiscoveredStores] = useState<any[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [hasRepairsFilter, setHasRepairsFilter] = useState(false);

  // Activation Modal States
  const [activationStoreId, setActivationStoreId] = useState<string>('');
  const [activationCode, setActivationCode] = useState<string>('');
  const [activationError, setActivationError] = useState<string>('');
  const [activationSuccessMsg, setActivationSuccessMsg] = useState<string>('');
  const [isActivating, setIsActivating] = useState<boolean>(false);

  // Verify that client user is actually logged in. If not, fallback instantly to gate /login
  useEffect(() => {
    if (!clientUser) {
      navigate('/login');
    }
  }, [clientUser, navigate]);

  useEffect(() => {
    if (!clientUser) return;

    const findClientStores = async () => {
      setLoadingStores(true);
      try {
        const clientPhone = clientUser.phone.trim();
        
        // 1. Fetch live multi-tenant store directory
        const allStores = await getStoresList();

        // Filter out suspended stores completely from client view
        const activeStores = allStores.filter(st => st.storeStatus !== 'suspended');

        // 2. Call the newly created cross-project utility to find real matched store ids 
        // linked in the secondary billing/accounting database
        const matchedExternalIds = await fetchExternalStoreData(clientPhone);

        // Filter and map stores according to cross-project relationships
        const matched = activeStores.filter(st => matchedExternalIds.includes(st.id)).map(st => ({
          ...st,
          hasActiveRepair: true,
          repairCount: 1
        }));

        if (matched.length > 0) {
          setDiscoveredStores(matched);
          setHasRepairsFilter(true);
          
          // Match default selected store to first activated one if possible
          const alreadyOwned = matched.find(st => clientUser?.activated_stores?.includes(st.id));
          setSelectedStoreId(alreadyOwned ? alreadyOwned.id : matched[0].id);
        } else {
          // Fallback: If no repairs found for this phone in either account, display all stores for flawless VIP exploration!
          setDiscoveredStores(activeStores.map(st => ({
            ...st,
            hasActiveRepair: false
          })));
          setHasRepairsFilter(false);
          
          if (activeStores.length > 0) {
            const alreadyOwned = activeStores.find(st => clientUser?.activated_stores?.includes(st.id));
            setSelectedStoreId(alreadyOwned ? alreadyOwned.id : activeStores[0].id);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.toLowerCase().includes('offline')) {
          console.warn('Handling offline storage fallback directory seamlessly.');
        } else {
          console.warn('Failed to query client stores via cross-project system (normal if offline/unconfigured):', err);
        }
        // Fallback to local default stores list of context to prevent any loading lockouts
        const localActive = stores.filter(st => st.storeStatus !== 'suspended');
        setDiscoveredStores(localActive.map(st => ({
          ...st,
          hasActiveRepair: st.id === 'al-fuji'
        })));
        if (localActive.length > 0) {
          const alreadyOwned = localActive.find(st => clientUser?.activated_stores?.includes(st.id));
          setSelectedStoreId(alreadyOwned ? alreadyOwned.id : localActive[0].id);
        }
      } finally {
        setLoadingStores(false);
      }
    };

    findClientStores();
  }, [clientUser?.phone, stores, JSON.stringify(clientUser?.activated_stores || [])]);

  const handleLogout = () => {
    localStorage.removeItem('jam_client_logged_user');
    setClientUser(null);
    navigate('/login');
  };

  const handleStoreCardClick = (st: any) => {
    const isAlreadyActivated = clientUser?.activated_stores?.includes(st.id);
    if (isAlreadyActivated) {
      setSelectedStoreId(st.id);
    } else {
      // Trigger golden activation code popup dialog
      setActivationStoreId(st.id);
      setActivationCode('');
      setActivationError('');
      setActivationSuccessMsg('');
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activationCode.length !== 8) {
      setActivationError('برجاء كتابة كود تفعيل صحيح مكوّن من 8 أرقام.');
      return;
    }

    setActivationError('');
    setActivationSuccessMsg('');
    setIsActivating(true);

    try {
      const res = await activateStoreWithCode(activationStoreId, activationCode, clientUser.phone);
      if (res.success) {
        setActivationSuccessMsg(res.message);
        
        // Wait and dismiss modal, and select newly activated store
        setTimeout(() => {
          setSelectedStoreId(activationStoreId);
          setActivationStoreId('');
        }, 1800);
      } else {
        setActivationError(res.message);
      }
    } catch (err) {
      setActivationError('حدث خطأ أثناء الاتصال للتحقق السحابي. حاول ثانية.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleRoyalEntrySubmit = () => {
    if (!selectedStoreId) return;

    // Check if store selected is activated
    const isAlreadyActivated = clientUser?.activated_stores?.includes(selectedStoreId);
    if (!isAlreadyActivated) {
      setActivationStoreId(selectedStoreId);
      setActivationCode('');
      setActivationError('');
      setActivationSuccessMsg('');
      return;
    }
    
    // Load store context dynamically to synchronize themes and prices
    loadStoreSettings(selectedStoreId);
    
    // Smooth navigation directly to selected white-label store route
    navigate(`/store/${selectedStoreId}`);
  };

  if (!clientUser) {
    return (
      <div className="min-h-screen bg-[#02050b] flex items-center justify-center p-4 text-center text-slate-400 font-semibold text-xs text-right" dir="rtl">
        <div className="w-8 h-8 border-4 border-amber-500/10 border-t-amber-500 rounded-full animate-spin mb-2 mx-auto"></div>
        <span>جاري التحقق من ترخيص الدخول...</span>
      </div>
    );
  }

  return (
    <div className="min-h-[90vh] bg-[#02050b] flex flex-col items-center justify-center p-6 select-none font-sans text-right" dir="rtl">
      
      {/* Dynamic top safety labels */}
      <div className="w-full max-w-[620px] flex items-center justify-between mb-6 px-1" id="select-store-meta-top">
        <button 
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>تبديل الحساب / خروج</span>
        </button>
        <div className="flex items-center gap-2 bg-[#091529] px-3.5 py-1.5 rounded-full border border-amber-500/10 shadow-lg shadow-amber-500/5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] text-amber-400 font-extrabold font-mono text-center tracking-wider">
            مرحبا بك VIP: {clientUser.phone}
          </span>
        </div>
      </div>

      <div className="w-full max-w-[620px] bg-gradient-to-b from-[#061225] to-[#02050b] border border-amber-500/20 rounded-[42px] p-8 md:p-10 shadow-2xl relative overflow-hidden" id="select-store-main-card">
        {/* Decorative Golden-Yellow aura background */}
        <div className="absolute top-0 left-12 w-48 h-48 rounded-full bg-gradient-to-br from-amber-500/10 to-transparent blur-3xl -z-10"></div>
        <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-gradient-to-br from-yellow-500/5 to-transparent blur-3xl -z-10"></div>

        {/* Central visual header area */}
        <div className="text-center flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#030914] border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl mb-4 animate-pulse">
            <Crown className="w-8 h-8" />
          </div>
          <span className="text-[10.5px] font-bold text-amber-500 uppercase tracking-widest block">
            بوابة التوطين الملكي والتوجيه الموحد
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white mt-2 leading-tight">
            اختر المتجر أو الفرع الموجه المباشر
          </h2>
          <p className="text-slate-400 text-xs mt-2 max-w-md mx-auto leading-relaxed">
            تمت قراءة كود الزبون وتأمين رتبتك بنجاح. الرجاء تحديد أي من الهويات والشركاء التاليين ترغب بالدخول إليه للاطلاع على حراجه اليوم وصيانته الفورية.
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-yellow-500 rounded-full text-[10.5px] font-bold mt-4">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>رصيد التفعيل والولاء: {points || 1250} نقطة مضافة لحسابك</span>
          </div>
        </div>

        {/* The beautiful two golden-yellow store items */}
        {hasRepairsFilter && (
          <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-2xl text-[11px] text-amber-300 font-bold mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 animate-bounce" />
            <span>تم العثور على أجهزة صيانة حية تابعة لهاتفك في الفروع المذهبة التالية:</span>
          </div>
        )}

        {!hasRepairsFilter && !loadingStores && (
          <div className="p-3.5 bg-blue-950/30 border border-blue-500/20 rounded-2xl text-[10.5px] text-slate-300 font-bold mb-4 flex items-center gap-2 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
            <span>أهلاً بك كعضو VIP جديد! لم تعثر قاعدة البيانات على تذاكر سابقة لشهادتك؛ لتسهيل التجربة تم فتح الفروع المتاحة بكامل المزايا.</span>
          </div>
        )}

        {loadingStores ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
            <div className="w-8 h-8 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-3"></div>
            <span>جاري مسح وقراءة فواتير الصيانة والأجهزة النشطة...</span>
          </div>
        ) : (
          <div className="space-y-4 my-6" id="gold-stores-list">
            {discoveredStores.map((st) => {
              const isSelected = selectedStoreId === st.id;
              const isActivated = clientUser?.activated_stores?.includes(st.id);
              
              // Generate visual styles based on selection
              const cardBg = isSelected 
                ? 'bg-gradient-to-l from-[#1f190a]/90 to-[#050e1b]/98 border-amber-500/60 shadow-lg shadow-amber-500/10 scale-[1.01]' 
                : 'bg-[#030914]/80 border-white/[0.04] text-slate-300 hover:border-amber-500/20';

              return (
                <div
                  key={st.id}
                  onClick={() => handleStoreCardClick(st)}
                  className={`p-5 rounded-3xl border-2 cursor-pointer transition-all duration-300 relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${cardBg}`}
                  id={`royal-selector-card-${st.id}`}
                >
                  {/* Side glow indicator */}
                  {isSelected && (
                    <div className="absolute right-0 top-1/4 bottom-1/4 w-1.5 bg-gradient-to-b from-amber-400 to-yellow-600 rounded-l-full"></div>
                  )}

                  <div className="flex items-center gap-3 w-full">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/10 overflow-hidden relative shrink-0 flex items-center justify-center text-3xl">
                      {st.logoUrl && st.logoUrl.startsWith('http') ? (
                        <img src={st.logoUrl} alt={st.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{st.logo || st.logoUrl || '👑'}</span>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-amber-500/10 flex items-center justify-center">
                          <span className="text-amber-400 font-bold text-xs">VIP</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-[#ffffff] text-xs sm:text-sm line-clamp-1">{st.name}</span>
                        {isSelected && (
                          <span className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                            مختار
                          </span>
                        )}
                        {isActivated ? (
                          <span className="bg-amber-500/10 border border-amber-500/25 text-yellow-500 font-bold text-[8.5px] px-1.5 py-0.5 rounded">
                            عضوية مفعّلة ✓
                          </span>
                        ) : (
                          <span className="bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 font-bold text-[8.5px] px-1.5 py-0.5 rounded animate-pulse select-none">
                            تنشيط بالكود 🔒
                          </span>
                        )}
                        {st.hasActiveRepair && (
                          <span className="bg-emerald-500 text-slate-950 font-bold text-[8.5px] px-1.5 py-0.5 rounded">
                            {st.repairCount} أجهزة صيانة
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 leading-relaxed">
                        {st.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-[9.5px] text-slate-500 font-semibold flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-500" />
                          {st.address ? (st.address.includes('،') ? st.address.split('،')[1] : st.address) : 'الفرع الرئيسي'}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-amber-500" />
                          {st.phone}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Selection circle */}
                  <div className="flex items-center justify-center self-end sm:self-auto shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition ${
                      isSelected ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-white/10 bg-slate-950/40 text-transparent'
                    }`}>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Royal Active Submit Button */}
        <button
          onClick={handleRoyalEntrySubmit}
          disabled={!selectedStoreId}
          className="w-full py-4 mt-4 bg-gradient-to-r from-amber-300 via-amber-500 to-yellow-600 text-[#02050b] font-black text-xs md:text-sm rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2 text-center"
          style={{ 
            boxShadow: `0 8px 32px -4px rgba(245, 158, 11, 0.35)`
          }}
          id="royal-entry-action-trigger"
        >
          <Crown className="w-4 h-4" />
          <span>
            {selectedStoreId && !clientUser?.activated_stores?.includes(selectedStoreId)
              ? 'تنشيط وتفعيل العضوية بالكود'
              : 'تأكيد الموثوقية والدخول الملكي الحصري'}
          </span>
          <ArrowUpRight className="w-4 h-4" />
        </button>

        {/* Protective cybersecurity info note */}
        <div className="mt-6 pt-5 border-t border-white/[0.04] text-[10px] text-slate-500 flex items-center justify-between">
          <span>* سيتم تفعيل الهوية البصرية والثيم المعتمد للمتجر فورياً.</span>
          <span className="font-mono text-[9px]">SSL Encrypted Connection</span>
        </div>

      </div>

      {/* Footer System Credits */}
      <span className="mt-8 text-[10px] text-slate-600">
        المنصة مؤمنة بالكامل كلياً © JAM Security & Multi-Tenant Infrastructure.
      </span>

      {/* Ultra-Luxurious Golden Frosted Glass Modal Overlay */}
      {activationStoreId && (
        <div className="fixed inset-0 bg-[#02050bcc]/90 backdrop-blur-md flex items-center justify-center z-50 p-4" dir="rtl" id="golden-glass-activation-modal">
          <div className="w-full max-w-[460px] bg-gradient-to-b from-[#141006] via-[#09101b] to-[#040810] border-2 border-amber-500/55 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
            {/* Glowing yellow aura */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -z-10"></div>
            
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#1c1404] border border-amber-500/40 flex items-center justify-center text-amber-400 text-2xl mx-auto mb-3">
                🔑
              </div>
              <h3 className="text-lg font-black text-white">تفعيل العضوية وتنشيط الفرع الملكي</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                هذا الفرع يتطلب إدخال كود التفعيل المخصص لحسابك (8 أرقام) من الإدارة لتنشيط رصيدك والبدء.
              </p>
              <div className="inline-block mt-2 font-mono text-[10.5px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-amber-400 rounded-full font-bold">
                تلميح بر بروفايل: كود فرع الشمراني هو 12345678 للجوال 777000000
              </div>
            </div>

            <form onSubmit={handleActivationSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-500/85 font-black mb-1.5 px-1">
                  كود تفعيل المتجر الملكي (8 أرقام)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="مثال: 12345678"
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full py-3.5 px-4 bg-slate-950/90 border-2 border-amber-500/30 font-mono tracking-widest text-center text-lg text-white font-bold rounded-xl focus:border-amber-400 outline-none transition"
                  disabled={isActivating || !!activationSuccessMsg}
                />
              </div>

              {activationError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/25 text-rose-400 text-xs rounded-xl font-bold leading-relaxed text-center animate-pulse">
                  ⚠️ {activationError}
                </div>
              )}

              {activationSuccessMsg && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs rounded-xl font-bold leading-relaxed text-center">
                  👑 {activationSuccessMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isActivating || activationCode.length !== 8 || !!activationSuccessMsg}
                className="w-full py-3.5 bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-600 text-slate-950 font-black text-xs rounded-xl hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                {isActivating ? (
                  <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                ) : 'التحقق السحابي وتنشيط الفرع ✓'}
              </button>

              <button
                type="button"
                onClick={() => setActivationStoreId('')}
                className="w-full py-2.5 bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] text-slate-400 text-[11px] font-bold rounded-lg transition"
              >
                إلغاء والعودة لقائمة المتاجر
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
