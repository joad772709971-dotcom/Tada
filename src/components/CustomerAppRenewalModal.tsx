import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  X, 
  Clock, 
  Calendar, 
  Users, 
  ShieldCheck, 
  Zap, 
  Loader2, 
  AlertCircle, 
  Store, 
  User, 
  Phone, 
  CheckCircle2, 
  Sparkles, 
  DollarSign, 
  Video, 
  HelpCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { 
  doc, 
  writeBatch, 
  Timestamp, 
  serverTimestamp, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { CustomerAppTicketDetails } from './CustomerAppTicketModal';

interface CustomerAppRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: any;
  onSuccess: (ticketData: CustomerAppTicketDetails) => void;
}

export default function CustomerAppRenewalModal({
  isOpen,
  onClose,
  shop,
  onSuccess
}: CustomerAppRenewalModalProps) {
  const [licenseStatus, setLicenseStatus] = useState<'active' | 'inactive'>('active');
  const [duration, setDuration] = useState<'1month' | '3months' | '6months' | '1year' | 'lifetime' | 'custom'>('1year');
  const [customDate, setCustomDate] = useState('');
  const [maxClients, setMaxClients] = useState<number>(100);
  const [customMaxClients, setCustomMaxClients] = useState<string>('');
  const [isPromoVideoEnabled, setIsPromoVideoEnabled] = useState(true);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقداً');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const targetUid = shop?.user?.uid || shop?.uid || shop?.id || shop?.ownerId;
  const shopName = shop?.shopName || shop?.name || shop?.user?.shopName || 'المتجر';
  const ownerName = shop?.ownerName || shop?.user?.name || 'مالك المتجر';
  const phone = shop?.phone || shop?.user?.phone || '';
  const shopPhone = shop?.shopPhone || shop?.user?.shopPhone || '';
  const address = shop?.address || shop?.user?.shopAddress || shop?.user?.address || '';
  const businessType = shop?.businessType || shop?.user?.businessType || 'importer';

  // Initialize initial values from shop on open
  useEffect(() => {
    if (isOpen && shop) {
      const user = shop.user || shop;
      const isCurrentlyActive = 
        user.customer_app_license === 'active' || 
        user.customerAppLicenseActive === true || 
        user.vipSubscriptionActive === true || 
        user.isCustomerPortalActive === true;

      setLicenseStatus(isCurrentlyActive ? 'active' : 'active'); // Default to active on renewal
      setMaxClients(Number(user.vipClientsLimit || user.customerAppMaxClients) || 100);
      setIsPromoVideoEnabled(user.is_promo_video_enabled !== false);
      setPaidAmount('');
      setErrorMessage('');

      // Set default 1 year custom date if needed
      const oneYearAhead = new Date();
      oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
      setCustomDate(oneYearAhead.toISOString().split('T')[0]);
    }
  }, [isOpen, shop]);

  if (!isOpen || !shop) return null;

  const currentLicenseActive = 
    shop?.user?.customer_app_license === 'active' || 
    shop?.user?.customerAppLicenseActive === true || 
    shop?.customer_app_license === 'active' ||
    shop?.vipSubscriptionActive === true;

  const calculateExpiry = (): { expiryDate: Date; durationLabel: string } => {
    const now = new Date();
    let expiry = new Date();
    let label = 'سنة كاملة (12 شهر)';

    switch (duration) {
      case '1month':
        expiry.setDate(now.getDate() + 30);
        label = 'شهر واحد (30 يوماً)';
        break;
      case '3months':
        expiry.setDate(now.getDate() + 90);
        label = '3 شهور (ربع سنوي)';
        break;
      case '6months':
        expiry.setDate(now.getDate() + 180);
        label = '6 شهور (نصف سنوي)';
        break;
      case '1year':
        expiry.setFullYear(now.getFullYear() + 1);
        label = 'سنة كاملة (12 شهر)';
        break;
      case 'lifetime':
        expiry.setFullYear(now.getFullYear() + 99);
        label = 'مدى الحياة (ترخيص مفتوح)';
        break;
      case 'custom':
        if (customDate) {
          expiry = new Date(customDate);
          label = `حتى تاريخ مخصص: ${customDate}`;
        } else {
          expiry.setFullYear(now.getFullYear() + 1);
          label = 'سنة كاملة';
        }
        break;
    }

    return { expiryDate: expiry, durationLabel: label };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUid) {
      setErrorMessage('تعذر تحديد هوية المتجر (ID missing)');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const { expiryDate, durationLabel } = calculateExpiry();
      const isActive = licenseStatus === 'active';
      const effectiveMaxClients = customMaxClients ? (Number(customMaxClients) || 100) : maxClients;
      const expiryTimestamp = Timestamp.fromDate(expiryDate);

      const batch = writeBatch(db);

      // Clean payload for updates
      const licensePayload = {
        customer_app_license: isActive ? 'active' : 'inactive',
        customerAppLicenseActive: isActive,
        isCustomerPortalActive: isActive,
        vipSubscriptionActive: isActive,
        vipClientsLimit: effectiveMaxClients,
        customerAppMaxClients: effectiveMaxClients,
        customerAppDuration: duration,
        customerAppLicenseExpiry: expiryTimestamp,
        vipExpiry: expiryTimestamp,
        is_promo_video_enabled: isPromoVideoEnabled,
        updatedAt: serverTimestamp()
      };

      // 1. Update user profile doc
      batch.set(doc(db, 'users', targetUid), licensePayload, { merge: true });

      // 2. Update settings doc
      batch.set(doc(db, 'settings', targetUid), licensePayload, { merge: true });

      // 3. Update stores doc
      batch.set(doc(db, 'stores', targetUid), licensePayload, { merge: true });

      // 4. Update b2bStoreProfiles doc
      batch.set(doc(db, 'b2bStoreProfiles', targetUid), licensePayload, { merge: true });

      // 5. Update any matching doc in shops collection
      try {
        const shopsQuery = query(collection(db, 'shops'), where('ownerId', '==', targetUid));
        const shopsSnap = await getDocs(shopsQuery);
        shopsSnap.docs.forEach(d => {
          batch.set(d.ref, licensePayload, { merge: true });
        });
      } catch (err) {
        console.warn('Could not query shops collection for batch update:', err);
      }

      await batch.commit();

      // Formulate Ticket Details
      const formattedExpiry = duration === 'lifetime' 
        ? 'ترخيص دائم مدى الحياة ♾️'
        : expiryDate.toLocaleDateString('ar-YE', { year: 'numeric', month: 'long', day: 'numeric' });

      const ticketDetails: CustomerAppTicketDetails = {
        storeId: targetUid,
        shopName,
        ownerName,
        phone,
        shopPhone,
        address,
        businessTypeLabel: businessType === 'importer' ? 'محل مستورد' : businessType === 'mega_wholesale' ? 'جملة الجملة' : businessType === 'wholesale' ? 'محل جملة' : 'محل تجزئة',
        customerAppLicenseActive: isActive,
        durationLabel,
        expiryDate: formattedExpiry,
        maxClients: effectiveMaxClients,
        portalUrl: `/portal?store=${targetUid}`,
        customerApkUrl: `${window.location.origin}/downloads/customer_portal.apk`,
        paidAmount: paidAmount ? `${paidAmount} ر.ي` : undefined,
        paymentMethod: paidAmount ? paymentMethod : undefined,
        createdAtText: new Date().toLocaleString('ar-YE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      onClose();
      onSuccess(ticketDetails);
    } catch (err: any) {
      console.error('Error activating customer app license:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ ترخيص تطبيق الزبائن');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="fixed inset-0 bg-navy-950/80 backdrop-blur-md" 
      />

      {/* Modal Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 10 }} 
        className="relative w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden my-auto text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-navy-950 via-slate-900 to-navy-950 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500/30 to-emerald-500/30 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10">
              <Crown size={24} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>تفعيل وتجديد رخصة تطبيق الزبائن VIP</span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">إصدار وترقية اشتراك بوابة وتطبيق الزبائن وتحديد سعة العملاء</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          
          {/* Shop Identification Banner */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store size={18} className="text-amber-400" />
                <span className="text-sm sm:text-base font-black text-white">{shopName}</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${
                currentLicenseActive 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {currentLicenseActive ? '✅ حالياً: رخصة نشطة' : '🔒 حالياً: غير مفعل'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="flex items-center gap-1"><User size={13} className="text-slate-400" /> المالك: {ownerName}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Phone size={13} className="text-emerald-400 font-mono" /> {phone}</span>
            </div>
          </div>

          {/* License Status Toggle (Active vs Inactive) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between">
            <div className="space-y-0.5 text-right">
              <span className="text-xs sm:text-sm font-black text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck size={16} /> تفعيل تطبيق وبوابة الزبائن VIP للمتجر
              </span>
              <p className="text-[11px] text-slate-300">السماح لزبائن هذا المتجر بفتح الحسابات وتصفح المنتجات والطلب أونلاين وأوفلاين.</p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={licenseStatus === 'active'}
                onChange={(e) => setLicenseStatus(e.target.checked ? 'active' : 'inactive')}
              />
              <div className="w-12 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {licenseStatus === 'active' && (
            <div className="space-y-4">
              {/* Duration Selection */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-amber-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <Clock size={15} /> مدة اشتراك رخصة الزبائن
                  </span>
                  <span className="text-[10px] text-slate-400">اختر فترة التجديد والتفعيل</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: '1month', label: '📅 شهر واحد', desc: '30 يوماً' },
                    { id: '3months', label: '📅 3 شهور', desc: 'ربع سنوي' },
                    { id: '6months', label: '📅 6 شهور', desc: 'نصف سنوي' },
                    { id: '1year', label: '👑 سنة كاملة', desc: '12 شهر (موصى به)' },
                    { id: 'lifetime', label: '♾️ مدى الحياة', desc: 'ترخيص مفتوح' },
                    { id: 'custom', label: '⚙️ تاريخ مخصص', desc: 'تحديد موعد' },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setDuration(item.id as any)}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                        duration === item.id 
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10 font-black' 
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="text-xs font-bold block">{item.label}</span>
                      <span className="text-[10px] opacity-70 block">{item.desc}</span>
                    </button>
                  ))}
                </div>

                {duration === 'custom' && (
                  <div className="space-y-1 pt-1">
                    <label className="text-xs text-amber-300 font-bold block">اختر تاريخ الانتهاء المخصص:</label>
                    <input 
                      type="date"
                      required
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="input-field text-xs sm:text-sm bg-navy-950 border-amber-500/40 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* VIP Clients Capacity */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-sky-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-sky-300 flex items-center gap-1.5">
                    <Users size={15} /> الحد الأقصى لسعة حسابات الزبائن (VIP Quota)
                  </span>
                  <span className="text-[10px] text-slate-400">عدد الزبائن المصرح بربطهم</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[50, 100, 250, 500, 1000, 5000].map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => {
                        setMaxClients(num);
                        setCustomMaxClients('');
                      }}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        maxClients === num && !customMaxClients
                          ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-black shadow-md' 
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-black block">{num}</span>
                      <span className="text-[9px] opacity-70 block">زبون</span>
                    </button>
                  ))}
                </div>

                {/* Custom clients number input */}
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-xs text-slate-400 whitespace-nowrap">أو إدخال سعة مخصصة:</span>
                  <input 
                    type="number"
                    min={1}
                    max={100000}
                    placeholder="مثال: 300"
                    value={customMaxClients}
                    onChange={(e) => setCustomMaxClients(e.target.value)}
                    className="input-field text-xs py-1.5 font-mono bg-navy-950 border-slate-700 text-sky-300"
                  />
                </div>
              </div>

              {/* Promo Video Feed (Reels) Toggle */}
              <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex items-center justify-between">
                <div className="text-right">
                  <span className="text-xs font-black block text-amber-400 flex items-center gap-1.5">
                    <Video size={14} /> تفعيل خلاصة العروض المرئية (Reels)
                  </span>
                  <span className="text-[10px] text-slate-400 block">السماح لمالك المتجر بإضافة مواد وفيديوهات ترويجية تظهر لزبائنه.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isPromoVideoEnabled}
                    onChange={(e) => setIsPromoVideoEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Optional Payment Settlement Note */}
              <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-white/5 space-y-2">
                <span className="text-xs font-bold text-slate-300 block flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-400" /> توثيق التسوية والمبلغ المسدد (اختياري للسند):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="المبلغ (مثال: 50,000 ر.ي أو 100$)"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="input-field text-xs bg-navy-950 border-slate-700"
                  />
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="input-field text-xs bg-navy-950 border-slate-700"
                  >
                    <option value="نقداً">💵 نقداً (كاش)</option>
                    <option value="حوالة كريمي">🏦 حوالة كريمي / بنكية</option>
                    <option value="شيك">📑 شيك معتمد</option>
                    <option value="آجل">⏳ قيد الحساب / آجل</option>
                    <option value="مجاني ترويجي">🎁 ترقية ترويجية مجانية</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              إلغاء
            </button>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <Zap size={18} />
                  <span>⚡ تفعيل وتجديد رخصة الزبائن وإصدار السند</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
