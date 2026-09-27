import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  UserPlus, 
  Building2, 
  MapPin, 
  Phone, 
  CreditCard, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  Check, 
  Store,
  Layers,
  FileText,
  DollarSign,
  Printer
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Customer, UserProfile } from '../types';
import { smartCommerceService } from '../services/smartCommerceService';
import { unifiedOfflineStoreEngine } from '../services/UnifiedOfflineStoreEngine';

interface CustomerQuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (newCustomer: Customer, shouldInvite?: boolean) => void;
  profile: UserProfile | null;
  defaultTier?: 'retail' | 'wholesale' | 'mega_wholesale' | 'importer' | 'individual';
}

export default function CustomerQuickAddModal({
  isOpen,
  onClose,
  onCustomerCreated,
  profile,
  defaultTier = 'retail'
}: CustomerQuickAddModalProps) {
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [code, setCode] = useState(() => `CUST-${Math.floor(1000 + Math.random() * 9000)}`);
  const [businessTier, setBusinessTier] = useState<'retail' | 'wholesale' | 'mega_wholesale' | 'importer' | 'individual'>(defaultTier);
  const [allowCredit, setAllowCredit] = useState(false);
  const [creditLimit, setCreditLimit] = useState<number>(500000);
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [balanceType, setBalanceType] = useState<'debit' | 'credit' | 'zero'>('zero'); // مدين (عليه) أو دائن (له)
  const [sendB2BInvite, setSendB2BInvite] = useState(businessTier !== 'individual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleRegenerateCode = () => {
    setCode(`CUST-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        const elements = Array.from(form.elements) as HTMLElement[];
        const currentIndex = elements.indexOf(e.currentTarget);
        for (let i = currentIndex + 1; i < elements.length; i++) {
          const el = elements[i];
          if (el.tagName === 'INPUT' && !el.hasAttribute('disabled') && (el as HTMLInputElement).type !== 'hidden') {
            el.focus();
            break;
          }
        }
      }
    }
  };

  const handleTierChange = (tier: 'retail' | 'wholesale' | 'mega_wholesale' | 'importer' | 'individual') => {
    setBusinessTier(tier);
    if (tier === 'individual') {
      setSendB2BInvite(false);
    } else {
      setSendB2BInvite(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setErrorMsg('يرجى كتابة اسم العميل ورقم الهاتف على الأقل');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const ownerId = profile?.ownerId || profile?.uid || 'main_store';
      const cleanPhone = phone.trim();

      // Check if phone already exists in local DB
      const localCustomers = await unifiedOfflineStoreEngine.searchCustomersLocal(cleanPhone, ownerId);
      const exactMatch = localCustomers.find(c => (c.phone || '').trim() === cleanPhone);

      if (exactMatch) {
        onCustomerCreated(exactMatch, sendB2BInvite);
        onClose();
        return;
      }

      // Generate random PIN for portal
      const portalPassword = Math.floor(100000 + Math.random() * 900000).toString();

      // Tier label
      const tierLabels: Record<string, string> = {
        retail: 'تاجر تجزئة معتمد 🏪',
        wholesale: 'شريك جملة 📦',
        mega_wholesale: 'جملة الجملة 🏛️',
        importer: 'وكيل / مستورد 🚢',
        individual: 'زبون عادي 👤'
      };

      const calculatedDebt = balanceType === 'debit' ? (Number(initialBalance) || 0) : 0;

      const customerPayload: Partial<Customer> = {
        ownerId,
        shopId: profile?.shopId || ownerId,
        createdBy: profile?.uid || ownerId,
        createdByName: profile?.name || 'المالك',
        name: name.trim(),
        shopName: shopName.trim() || undefined,
        phone: cleanPhone,
        address: address.trim() || undefined,
        code: code.trim(),
        businessTier,
        tier: tierLabels[businessTier] || 'عميل معتمد',
        allowCredit,
        creditLimit: allowCredit ? creditLimit : 0,
        isB2BClient: businessTier !== 'individual',
        portalPassword,
        debt: calculatedDebt,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 1. Instant Save in Unified Offline Store Engine (IndexedDB + LocalStorage)
      const savedLocalCustomer = await unifiedOfflineStoreEngine.saveCustomerLocal(customerPayload as Customer, true);

      // 2. Direct online sync to Firestore store subcollection & root registry
      if (navigator.onLine) {
        Promise.allSettled([
          setDoc(doc(db, 'stores', ownerId, 'customers', savedLocalCustomer.id), {
            ...customerPayload,
            id: savedLocalCustomer.id,
            storeId: ownerId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true }),
          setDoc(doc(db, 'customers', savedLocalCustomer.id), {
            ...customerPayload,
            id: savedLocalCustomer.id,
            storeId: ownerId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true }),
          setDoc(doc(db, 'users', cleanPhone), {
            userId: cleanPhone,
            uid: cleanPhone,
            phone: cleanPhone,
            name: name.trim(),
            role: 'CUSTOMER',
            status: 'ACTIVE',
            associatedStores: [ownerId],
            primaryStoreId: ownerId,
            updatedAt: serverTimestamp()
          }, { merge: true })
        ]).catch(err => console.warn('Online sync deferred to queue:', err));
      }

      // 3. Sync with smart commerce lead engine in background
      smartCommerceService.getOrCreateLead(
        cleanPhone,
        ownerId,
        name.trim(),
        portalPassword
      ).catch(err => console.warn('SmartCommerce lead sync notice:', err));

      onCustomerCreated(savedLocalCustomer, sendB2BInvite);
      onClose();
    } catch (err: any) {
      console.error('Error adding customer:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ بيانات العميل');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <AnimatePresence>
      <div 
        id="jam-customer-quick-add-overlay"
        className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-navy-950/80 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-pointer"
        />

        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 15 }}
          className="relative bg-white dark:bg-navy-900 rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[94vh] sm:max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 dark:border-navy-700 z-10 text-right overflow-hidden my-auto"
          dir="rtl"
        >
          {/* STICKY HEADER */}
          <div className="shrink-0 p-3.5 sm:p-5 border-b border-gray-100 dark:border-navy-800 bg-white dark:bg-navy-900 flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-navy-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                  <span>سند قيد وإضافة عميل جديد</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Offline Ready ⚡
                  </span>
                </h3>
                <p className="text-[10px] sm:text-xs text-gray-400 font-bold mt-0.5">
                  تسجيل بيانات العميل، فئة التسعير والرصيد الافتتاحي
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-full text-gray-400 hover:text-navy-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* SCROLLABLE FORM BODY */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-4.5 overscroll-contain">
            {errorMsg && (
              <div className="p-2.5 sm:p-3 bg-danger/10 border border-danger/30 rounded-xl sm:rounded-2xl text-danger text-xs font-black text-center">
                {errorMsg}
              </div>
            )}

            {/* Business Tier Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] sm:text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Layers size={13} className="text-brand-primary" />
                <span>رتبة النشاط وفئة التسعير (Business Tier):</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
                {[
                  { id: 'retail', label: 'تجزئة 🏪' },
                  { id: 'wholesale', label: 'جملة 📦' },
                  { id: 'mega_wholesale', label: 'جملة الجملة 🏛️' },
                  { id: 'importer', label: 'مستورد 🚢' },
                  { id: 'individual', label: 'أفراد 👤' }
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => handleTierChange(tier.id as any)}
                    className={`py-2 px-1 sm:px-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer border text-center ${
                      businessTier === tier.id
                        ? 'bg-brand-primary text-white border-brand-primary shadow-sm ring-2 ring-brand-primary/20'
                        : 'bg-gray-50 dark:bg-navy-950 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-navy-800 hover:border-brand-primary'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Core Info: Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <label className="text-[11px] sm:text-xs font-black text-gray-700 dark:text-gray-300">
                  اسم العميل / المسؤول <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: يحيى صالح أحمد"
                  value={name}
                  onKeyDown={handleInputKeyDown}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-black outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] sm:text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Phone size={12} className="text-gray-400" />
                  <span>رقم الهاتف / الواتساب <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="777000000"
                  value={phone}
                  onKeyDown={handleInputKeyDown}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-mono font-black outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition text-left"
                />
              </div>
            </div>

            {/* Shop Name & Address (Dynamically conditioned on Business Tier) */}
            {businessTier !== 'individual' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] sm:text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <Store size={12} className="text-brand-primary" />
                    <span>اسم المحل / المنشأة التجارية</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: مركز الأمل للاتصالات"
                    value={shopName}
                    onKeyDown={handleInputKeyDown}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full p-2.5 sm:p-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-bold outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] sm:text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <MapPin size={12} className="text-gray-400" />
                    <span>العنوان / موقع المحل</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: صنعاء - شارع تعز"
                    value={address}
                    onKeyDown={handleInputKeyDown}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-2.5 sm:p-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-bold outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[11px] sm:text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <MapPin size={12} className="text-gray-400" />
                  <span>العنوان / السكن (اختياري)</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: صنعاء - الحي السياسي"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 sm:p-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-bold outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition"
                />
              </div>
            )}

            {/* Code */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] sm:text-xs font-black text-gray-700 dark:text-gray-300">
                  كود العميل الفريد:
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="text-[10px] sm:text-[11px] font-black text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={11} />
                  <span>توليد تلقائي</span>
                </button>
              </div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full p-2.5 sm:p-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-mono font-black text-amber-500 outline-none focus:border-brand-primary text-left uppercase"
              />
            </div>

            {/* Initial Balance / Opening Voucher Card */}
            <div className="p-3 sm:p-4 bg-gray-50 dark:bg-navy-950/80 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-navy-800 space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-black text-navy-900 dark:text-white flex items-center gap-1.5">
                  <FileText size={15} className="text-brand-primary" />
                  الرصيد الافتتاحي وسند القيد
                </span>
                <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold">
                  تثبيت الرصيد السابق إن وجد
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {[
                  { id: 'zero', label: 'رصيد صفر' },
                  { id: 'debit', label: 'مدين (عليه)' },
                  { id: 'credit', label: 'دائن (له)' }
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBalanceType(b.id as any)}
                    className={`py-1.5 sm:py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition border ${
                      balanceType === b.id
                        ? 'bg-navy-900 dark:bg-white text-white dark:text-navy-950 border-navy-900 dark:border-white font-black'
                        : 'bg-white dark:bg-navy-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-navy-700'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {balanceType !== 'zero' && (
                <div className="pt-1.5 flex items-center gap-2 animate-fadeIn">
                  <div className="flex-1">
                    <label className="text-[10px] sm:text-[11px] font-black text-gray-600 dark:text-gray-300 block mb-1">
                      {balanceType === 'debit' ? 'مبلغ الدين السابق (ر.ي):' : 'مبلغ الرصيد الدائن (ر.ي):'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(Number(e.target.value))}
                      className="w-full p-2 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-mono font-black outline-none focus:border-brand-primary text-left"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Credit Account & Limit Box */}
            <div className="p-3 sm:p-4 bg-gray-50 dark:bg-navy-950/80 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-navy-800 space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-brand-primary" />
                  <div>
                    <span className="text-[11px] sm:text-xs font-black text-navy-900 dark:text-white block">
                      فتح حساب آجل وتسهيلات ائتمانية
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold">
                      السماح للعميل بالشراء الآجل
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowCredit}
                  onChange={(e) => setAllowCredit(e.target.checked)}
                  className="w-5 h-5 accent-brand-primary rounded cursor-pointer"
                />
              </div>

              {allowCredit && (
                <div className="pt-2 border-t border-gray-200 dark:border-navy-800 space-y-1 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] sm:text-xs font-black text-gray-700 dark:text-gray-300">
                      سقف المديونية (Credit Limit):
                    </label>
                    <span className="text-xs font-mono font-black text-brand-primary">
                      {creditLimit.toLocaleString()} ر.ي
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value))}
                    className="w-full p-2.5 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-mono font-black outline-none focus:border-brand-primary text-left"
                  />
                </div>
              )}
            </div>

            {/* Smart B2B Invitation Trigger */}
            <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl sm:rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500 shrink-0" />
                <div>
                  <span className="text-[11px] sm:text-xs font-black text-navy-900 dark:text-white block">
                    إرسال دعوة الانضمام والكتالوج (B2B)
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold">
                    {businessTier === 'individual'
                      ? 'معطل للأفراد (يمكن التفعيل يدوياً)'
                      : 'إرسال رابط الكتالوج والطلب المباشر'}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sendB2BInvite}
                onChange={(e) => setSendB2BInvite(e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </form>

          {/* STICKY FOOTER */}
          <div className="shrink-0 p-3 sm:p-4 border-t border-gray-100 dark:border-navy-800 bg-gray-50/95 dark:bg-navy-950/95 flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-3 sm:py-3.5 bg-brand-primary hover:bg-brand-primary-dark text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check size={16} />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ واختيار العميل'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-3 sm:py-3.5 px-4 sm:px-5 bg-gray-200 dark:bg-navy-800 text-gray-700 dark:text-gray-300 font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl hover:bg-gray-300 dark:hover:bg-navy-700 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
