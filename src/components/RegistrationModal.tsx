import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Store, Briefcase, Phone, UserPlus, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, MapPin, Lock, Layers, HelpCircle } from 'lucide-react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { getBrowserHWID } from '../services/securityService';
import { checkPhoneUniqueness } from '../services/OfflineCore';
import { fallbackDatabaseSeedForUser } from '../services/accountingService';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to determine enabled modules dynamically based on user selections
function getInitialModules(businessLevel: string, tradeType: string): string[] {
  const modules = new Set<string>([
    'dashboard',
    'sales',
    'invoice-scanner',
    'operations-customers',
    'inventory',
    'shortages',
    'inventory-match',
    'finances',
    'accounts',
    'chat',
    'customers',
    'settings',
    'users',
    'activity-logs',
    'reports',
    'owner-control',
    'ai-assistant',
  ]);

  // Wholesale level specific modules
  if (['importer', 'mega_wholesale', 'wholesale'].includes(businessLevel)) {
    modules.add('wholesale-pos');
    modules.add('wholesale-purchases');
    modules.add('warehouse');
    modules.add('delivery');
    modules.add('smart-import');
    modules.add('suppliers');
  } else {
    // Retailer specific modules
    modules.add('mobile-balance');
    modules.add('sim-cards');
    modules.add('cashier');
  }

  // Trade type specific modules
  if (tradeType === 'parts' || tradeType === 'all') {
    modules.add('maintenance');
    modules.add('damaged');
    modules.add('factory'); // خطوط الإنتاج والورش
  }

  if (tradeType === 'mobiles' || tradeType === 'all') {
    modules.add('mobile-balance');
    modules.add('sim-cards');
  }

  return Array.from(modules);
}

export default function RegistrationModal({ isOpen, onClose }: RegistrationModalProps) {
  const [formData, setFormData] = useState({
    ownerName: '',
    shopName: '',
    location: '',
    phone: '',
    password: '',
    businessLevel: 'retailer' as 'importer' | 'mega_wholesale' | 'wholesale' | 'retailer',
    tradeType: 'all' as 'mobiles' | 'parts' | 'accessories' | 'all',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset and clear error upon opening, closing, or unmounting
  React.useEffect(() => {
    setError('');
    setLoading(false);
    if (!isOpen) {
      setSuccess(false);
    }
    return () => {
      setError('');
    };
  }, [isOpen]);

  const handleClose = () => {
    setError('');
    setLoading(false);
    setSuccess(false);
    onClose();
  };

  const handleFieldChange = (field: string, val: any) => {
    if (error) setError('');
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const hwid = getBrowserHWID();
    const cleanPhone = formData.phone.replace(/[\s\-\(\)]/g, '').trim();

    try {
      // 1. Basic input validation
      if (!cleanPhone || cleanPhone.length < 9) {
        throw new Error('يرجى إدخال رقم هاتف صحيح ومكتمل (9 أرقام على الأقل).');
      }

      if (!formData.password || formData.password.length < 6) {
        throw new Error('يجب أن تكون كلمة مور مكونة من 6 خانات على الأقل.');
      }

      // 2. Anti-fraud check: Prevent multiple registrations from the same device (Local storage check)
      const hasRegistered = localStorage.getItem('jam_pro_device_registered_flag') === 'true';
      if (hasRegistered) {
        throw new Error('⚠️ عذراً، لا يمكن إنشاء أكثر من حساب من نفس الجهاز. يرجى تسجيل الدخول إلى حسابك الحالي.');
      }

      // 3. Prevent multiple registrations from the same device (Firestore HWID check)
      if (hwid) {
        const qHwid = query(collection(db, 'users'), where('hwid', '==', hwid));
        const snapHwid = await getDocs(qHwid);
        if (!snapHwid.empty) {
          throw new Error('⚠️ عذراً، هذا الجهاز مرتبط بالفعل بحساب متجر آخر في قاعدة البيانات. لا يمكنك إنشاء حساب جديد من نفس الجهاز.');
        }
      }

      // 4. Check phone number uniqueness in users collection
      await checkPhoneUniqueness(cleanPhone, { allowExistingClients: true, allowExistingLeads: true });

      // 5. Register Account
      // We generate email based on phone number to serve as unique identifier for Firebase Auth
      const email = `${cleanPhone}@jampro.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
      const uid = userCredential.user.uid;
      
      const enabledModules = getInitialModules(formData.businessLevel, formData.tradeType);
      const lifetimeEndDate = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // Lifetime (100 Years)

      // 6. Create User Profile with all specified fields in users collection
      await setDoc(doc(db, 'users', uid), {
        uid: uid,
        ownerId: uid,
        name: formData.ownerName,
        email: email,
        role: 'manager', // Program owners are managers of their own data
        status: 'active', 
        isProgramUser: true,
        programUserStatus: 'active',
        shopName: formData.shopName,
        shopAddress: formData.location, // Location
        phone: cleanPhone,
        shopPhone: cleanPhone,
        hwid: hwid,
        businessType: formData.businessLevel, // مستوى العمل (importer / mega_wholesale / wholesale / retailer)
        businessLevel: formData.businessLevel, // مستوى العمل
        tradeType: formData.tradeType, // نوع التجارة
        isActivated: true,
        joinDate: serverTimestamp(),
        lastRegistrationDate: serverTimestamp(),
        currentPassword: formData.password,
        subscriptionType: 'lifetime', // Lifetime license
        isLifetime: true,
        planTier: 'vip',
        customer_app_license: 'active',
        isCustomerPortalActive: true,
        vipSubscriptionActive: true,
        vipClientsLimit: 999999999, // Unlimited VIP customer accounts
        trialStartDate: serverTimestamp(),
        trialEndDate: lifetimeEndDate,
        subscriptionEndDate: lifetimeEndDate, // 100 years lifetime
        vipExpiry: lifetimeEndDate,
        enabledModules: enabledModules, // Personalized visible modules
      });

      // 7. Create Shop document in shops collection (So it is categorized correctly in SuperAdmin panel)
      await setDoc(doc(db, 'shops', uid), {
        ownerId: uid,
        shopName: formData.shopName,
        ownerName: formData.ownerName,
        email: email,
        phone: cleanPhone,
        address: formData.location,
        businessType: formData.businessLevel,
        enabledModules: enabledModules,
        createdAt: serverTimestamp()
      });

      // 8. Create entry in settings collection
      await setDoc(doc(db, 'settings', uid), {
        shopName: formData.shopName,
        shopPhone: cleanPhone,
        businessType: formData.businessLevel,
        enabledModules: enabledModules,
        updatedAt: serverTimestamp()
      });

      // 9. Create entry in stores collection
      await setDoc(doc(db, 'stores', uid), {
        id: uid,
        ownerId: uid,
        name: formData.shopName,
        shopName: formData.shopName,
        ownerName: formData.ownerName,
        email: email,
        phone: cleanPhone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 10. Force fallback database seed to auto-generate absolute-zero structures for dynamic wallets, safes, and ledger frameworks
      await fallbackDatabaseSeedForUser(uid, formData.shopName, 'main_store');

      // Mark the device as registered to prevent further sign-ups
      localStorage.setItem('jam_pro_device_registered_flag', 'true');

      setSuccess(true);
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 3000);
    } catch (err: any) {
      console.error('Registration failed:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('رقم الهاتف هذا مسجل بالفعل بحساب آخر.');
      } else {
        setError(err.message || 'حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة لاحقاً.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-xl bg-gradient-to-b from-[#1c2236] via-[#0e1220] to-[#05070f] rounded-[2.5rem] shadow-2xl overflow-hidden border-2 border-yellow-500/30 my-8"
          >
            {/* Top Shiny Border */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600" />

            <div className="p-6 sm:p-10">
              <div className="flex justify-between items-center mb-6">
                <button 
                  type="button"
                  onClick={handleClose} 
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                >
                  <X size={24} />
                </button>
                <div className="text-right">
                  <h2 className="text-2xl font-black text-white flex items-center gap-2 justify-end">
                    <span>إنشاء حساب تجار جديد</span>
                    <span className="text-yellow-400 text-3xl">💎</span>
                  </h2>
                  <p className="text-xs text-gray-400 font-bold mt-1">سجل بياناتك الشخصية وبيانات محلّك للانضمام فوراً</p>
                </div>
              </div>

              {success ? (
                <div className="text-center py-12 space-y-6">
                  <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle2 size={48} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-white">تم إنشاء حسابك بنجاح!</h3>
                    <p className="text-emerald-400 font-bold text-sm">جاري تهيئة الحساب وتفعيله بفترة تجريبية كاملة...</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5 text-right">
                  
                  {/* Grid layout for fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* الاسم الكامل للمالك */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                        الاسم الكامل للمالك
                        <UserPlus size={14} className="text-yellow-400" />
                      </label>
                      <input
                        required
                        type="text"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-right text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                        placeholder="مثال: أحمد عبد الله اليماني"
                        value={formData.ownerName}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, ownerName: val }));
                        }}
                      />
                    </div>

                    {/* اسم المحل / العلامة التجارية */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                        اسم المحل / العلامة التجارية
                        <Store size={14} className="text-yellow-400" />
                      </label>
                      <input
                        required
                        type="text"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-right text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                        placeholder="مثال: آفاق تليكوم"
                        value={formData.shopName}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, shopName: val }));
                        }}
                      />
                    </div>

                    {/* الموقع (المحافظة/المدينة) */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                        الموقع (المحافظة / المدينة)
                        <MapPin size={14} className="text-yellow-400" />
                      </label>
                      <input
                        required
                        type="text"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-right text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors"
                        placeholder="مثال: صنعاء - شارع حدة"
                        value={formData.location}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, location: val }));
                        }}
                      />
                    </div>

                    {/* رقم الهاتف (اسم المستخدم) */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                        رقم الهاتف (اسم المستخدم للدخول)
                        <Phone size={14} className="text-yellow-400" />
                      </label>
                      <input
                        required
                        type="tel"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-right text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors font-mono"
                        placeholder="مثال: 772315106"
                        value={formData.phone}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, phone: val }));
                        }}
                      />
                    </div>

                  </div>

                  {/* كلمة المرور */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                      كلمة المرور الخاصة بك
                      <Lock size={14} className="text-yellow-400" />
                    </label>
                    <input
                      required
                      type="password"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-right text-sm text-white placeholder-white/30 outline-none focus:border-yellow-400 transition-colors font-mono"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData(prev => ({ ...prev, password: val }));
                      }}
                    />
                  </div>

                  {/* مستوى العمل */}
                  <div className="space-y-2 p-4 bg-yellow-500/5 rounded-2xl border border-yellow-500/15">
                    <div className="flex items-center gap-2 justify-end text-right">
                      <span className="text-[11px] font-black text-yellow-300">اختر مستوى عملك بصراحة لتحصل على نسخة ترتاح بها وتناسب عملك</span>
                      <HelpCircle size={14} className="text-yellow-400 shrink-0" />
                    </div>
                    <label className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-1.5 justify-end mt-2">
                      مستوى العمل الحالي
                      <Layers size={14} className="text-yellow-400" />
                    </label>
                    <select
                      required
                      className="w-full bg-black/80 border border-white/15 rounded-xl px-4 py-3.5 text-right text-sm text-white outline-none focus:border-yellow-400 transition-colors font-bold cursor-pointer"
                      value={formData.businessLevel}
                      onChange={e => {
                        const val = e.target.value as any;
                        setFormData(prev => ({ ...prev, businessLevel: val }));
                      }}
                    >
                      <option value="importer">🚢 مستورد (حصري ومستويات أسعار خاصة)</option>
                      <option value="mega_wholesale">🏭 جملة الجملة (كبار الموردين)</option>
                      <option value="wholesale">📦 تاجر جملة (موزع معتمد)</option>
                      <option value="retailer">🏪 تجزئة (محل بيع وصيانة)</option>
                    </select>
                  </div>

                  {/* نوع التجارة */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                      نوع التجارة والنشاط الرئيسي
                      <Briefcase size={14} className="text-yellow-400" />
                    </label>
                    <select
                      required
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-right text-sm text-white outline-none focus:border-yellow-400 transition-colors font-bold cursor-pointer"
                      value={formData.tradeType}
                      onChange={e => {
                        const val = e.target.value as any;
                        setFormData(prev => ({ ...prev, tradeType: val }));
                      }}
                    >
                      <option value="mobiles">📱 تجارة جوالات فقط</option>
                      <option value="parts">🛠️ قطع غيار جوالات وصيانة</option>
                      <option value="accessories">🔌 إكسسوارات وملحقات</option>
                      <option value="all">🌟 الكل (جوالات + قطع غيار + إكسسوارات)</option>
                    </select>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl flex items-center gap-2 justify-end"
                    >
                      <span>{error}</span>
                      <AlertTriangle size={16} className="shrink-0" />
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-600 hover:brightness-110 active:scale-[0.99] text-black font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer text-base mt-2"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin text-black w-5 h-5" />
                    ) : (
                      <>
                        <span>تسجيل الحساب والبدء فوراً</span>
                        <UserPlus size={18} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
