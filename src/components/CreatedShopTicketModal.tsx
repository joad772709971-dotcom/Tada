import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Printer, 
  Share2, 
  Copy, 
  Check, 
  Sparkles, 
  Store, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  Crown, 
  Smartphone, 
  Monitor, 
  KeyRound, 
  Mail, 
  Eye, 
  EyeOff, 
  QrCode, 
  ExternalLink, 
  Download, 
  Gift, 
  MessageCircle, 
  Send,
  Layers,
  Award,
  Lock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

export interface CreatedShopDetails {
  uid: string;
  shopName: string;
  ownerName: string;
  phone: string;
  shopPhone?: string;
  address?: string;
  businessType: 'importer' | 'mega_wholesale' | 'wholesale' | 'retailer';
  businessTypeLabel: string;
  email: string;
  password: string;
  subscriptionDurationLabel: string;
  subscriptionExpiryDate: string;
  planTierLabel: string;
  customerAppLicenseActive: boolean;
  customerAppDurationLabel: string;
  customerAppMaxClients: number;
  allowedPlatformsLabel: string;
  maxDevicesCount: number;
  supportPhone: string;
  customerPortalUrl: string;
  apkDownloadUrl: string;
  exeDownloadUrl: string;
  webAppUrl: string;
  referralOfferText?: string;
  createdAtText?: string;
}

interface CreatedShopTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopData: CreatedShopDetails | null;
}

export default function CreatedShopTicketModal({
  isOpen,
  onClose,
  shopData
}: CreatedShopTicketModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && shopData) {
      // Fire festive confetti animation
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#d4af37', '#10b981', '#3b82f6', '#f59e0b', '#ffffff']
        });
      } catch (e) {
        console.log('Confetti effect skipped:', e);
      }
    }
  }, [isOpen, shopData]);

  if (!isOpen || !shopData) return null;

  const defaultSupportPhone = shopData.supportPhone || '+967777503191';
  const cleanSupportPhoneForWa = defaultSupportPhone.replace(/[^0-9]/g, '');
  const cleanRecipientPhoneForWa = shopData.phone ? shopData.phone.replace(/[^0-9]/g, '') : '';

  const referralOffer = shopData.referralOfferText || 
    'عند دعوة 5 من أصحاب المحلات للاشتراك في المنظومة، تحصل فوراً على اشتراك مجاني لمدة 6 شهور بكافة مميزات وخدمات النظام!';

  // Format full WhatsApp & Share text
  const fullShareText = `🎉 *تهانينا! تم إنشاء وتفعيل حساب متجركم بنجاح في منظومة JAM System Pro الذكية*

👑 *بيانات المتجر والمالك:*
• اسم المحل: ${shopData.shopName}
• اسم المالك: ${shopData.ownerName}
• رقم هاتف المالك: ${shopData.phone}${shopData.shopPhone ? `\n• رقم هاتف المحل: ${shopData.shopPhone}` : ''}
• العنوان والموقع: ${shopData.address || 'اليمن'}
• تصنيف المتجر: ${shopData.businessTypeLabel}

💳 *تفاصيل الاشتراك والتراخيص:*
• باقة المنظومة: ${shopData.planTierLabel}
• مدة الاشتراك: ${shopData.subscriptionDurationLabel} (ينتهي في: ${shopData.subscriptionExpiryDate})
• رخصة تطبيق الزبائن VIP: ${shopData.customerAppLicenseActive ? `مفعلة بنجاح ✅ (سعة: ${shopData.customerAppMaxClients} زبون - مدة: ${shopData.customerAppDurationLabel})` : 'غير مفعلة'}
• صلاحيات الأجهزة: ${shopData.allowedPlatformsLabel} (بحد أقصى ${shopData.maxDevicesCount} أجهزة)

🔐 *بيانات تسجيل الدخول:*
• اسم المستخدم / رقم الدخول: ${shopData.email}
• كلمة المرور: ${shopData.password}

📲 *روابط الوصول وتحميل التطبيقات:*
• رابط بوابة الزبائن VIP:
${shopData.customerPortalUrl}
• رابط تحميل تطبيق الجوال (Android APK):
${shopData.apkDownloadUrl}
• رابط تحميل برنامج الكمبيوتر (Windows EXE):
${shopData.exeDownloadUrl}
• رابط تسجيل الدخول السحابي المباشر (Web):
${shopData.webAppUrl}

🛡️ *ملاحظة التفعيل للعمل أوفلاين:*
عند تسجيل الدخول لأول مرة بالرقم وكلمة المرور مع توفر إنترنت، يتم حقن وتوثيق مدة الاشتراك في الجهاز ليعمل بعدها بكامل كفاءته أوفلاين دون إنترنت.

🎁 *عرض حصري خاص:*
${referralOffer}

📞 *للحصول على كافة مميزات البرنامج والدعم الفني المباشر:*
يرجى التواصل عبر الواتساب على الرقم: ${defaultSupportPhone}

🌟 نتمنى لكم تجارة ناجحة ومبيعات مباركة!`;

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    const encodedText = encodeURIComponent(fullShareText);
    const targetPhone = cleanRecipientPhoneForWa || cleanSupportPhoneForWa;
    const whatsappUrl = `https://wa.me/${targetPhone}?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSendSMS = () => {
    const shortText = `تم إنشاء حساب متجركم (${shopData.shopName}) بنجاح. اسم المستخدم: ${shopData.email} كلمة السر: ${shopData.password} - رابط النظام: ${shopData.webAppUrl} للدعم واتساب: ${defaultSupportPhone}`;
    const smsUrl = `sms:${shopData.phone}?body=${encodeURIComponent(shortText)}`;
    window.open(smsUrl, '_blank');
  };

  const handleGenericShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `كرت تفعيل متجر ${shopData.shopName} - JAM Pro`,
          text: fullShareText,
        });
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      copyToClipboard(fullShareText, 'full');
    }
  };

  return (
    <div 
      id="created-shop-ticket-modal-overlay"
      dir="rtl"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div 
        id="created-shop-ticket-modal-container"
        className="relative w-full max-w-3xl my-auto bg-gradient-to-b from-[#0e1726] via-[#090d16] to-[#04060a] border border-[#d4af37]/40 rounded-3xl shadow-[0_0_50px_rgba(212,175,55,0.25)] overflow-hidden text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-lg flex items-center justify-center">
              <div className="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center text-amber-400">
                <Crown size={22} className="animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
                وثيقة تفعيل وترخيص متجر جديد
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  معتمد رسمي ✅
                </span>
              </h2>
              <p className="text-xs text-slate-400">تم إنشاء وتأمين الحساب السحابي بنجاح</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
            title="إغلاق النافذة"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto" ref={ticketRef}>
          
          {/* Welcoming Greeting Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-amber-500/10 border border-emerald-500/30 text-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-black text-sm sm:text-base text-emerald-300">
              <Sparkles className="text-amber-400 animate-spin" style={{ animationDuration: '6s' }} size={20} />
              <span>مرحباً بكم في منظومة JAM System Pro الذكية! 🎉</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              يسعدنا انضمام متجر <strong>({shopData.shopName})</strong> إلى شبكة المنظومة. تم تأمين قاعدة بيانات Firestore سحابية مستقلة، وتجهيز كافة الصلاحيات والأدوات التجارية واللوجستية وفق الخيارات المحددة أدناه.
            </p>
          </div>

          {/* Printable Luxury Certificate Ticket */}
          <div 
            id="printable-shop-license-ticket"
            className="printableArea printable p-5 sm:p-6 rounded-3xl bg-slate-900/90 border-2 border-amber-500/40 shadow-inner relative overflow-hidden space-y-5"
          >
            {/* Watermark Logo / Decoration */}
            <div className="absolute top-2 left-4 opacity-5 pointer-events-none text-amber-400">
              <Crown size={220} />
            </div>

            {/* Ticket Header & QR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
              <div className="space-y-1 text-center sm:text-right">
                <span className="text-[10px] font-black text-amber-400 tracking-wider uppercase block">
                  JAM SYSTEM PRO • OFFICIAL COMMERCIAL LICENSE
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  {shopData.shopName}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><User size={13} className="text-amber-400" /> {shopData.ownerName}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Phone size={13} className="text-emerald-400" /> جوال المالك: {shopData.phone}</span>
                  {shopData.shopPhone && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Phone size={13} className="text-teal-400" /> هاتف المحل: {shopData.shopPhone}</span>
                    </>
                  )}
                  {shopData.address && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1"><MapPin size={13} className="text-sky-400" /> {shopData.address}</span>
                    </>
                  )}
                </div>
              </div>

              {/* QR Code Container */}
              <div className="p-2.5 rounded-2xl bg-white shadow-xl flex flex-col items-center shrink-0 border border-amber-300">
                <QRCodeSVG 
                  value={shopData.webAppUrl || window.location.origin} 
                  size={84}
                  level="H"
                />
                <span className="text-[9px] font-black text-slate-900 mt-1">امسح للدخول 📲</span>
              </div>
            </div>

            {/* Grid 1: Subscription & Package Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">تصنيف المتجر</span>
                <span className="text-xs font-black text-amber-300 block">{shopData.businessTypeLabel}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">باقة المنظومة</span>
                <span className="text-xs font-black text-yellow-300 block">{shopData.planTierLabel}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">مدة الاشتراك</span>
                <span className="text-xs font-black text-emerald-300 block">{shopData.subscriptionDurationLabel}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">تاريخ الانتهاء</span>
                <span className="text-xs font-mono font-black text-rose-300 block">{shopData.subscriptionExpiryDate}</span>
              </div>
            </div>

            {/* Grid 2: Licenses & Device Quotas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">رخصة تطبيق وبوابة الزبائن VIP</span>
                  <span className="text-xs font-black text-amber-300">
                    {shopData.customerAppLicenseActive ? `مفعلة (${shopData.customerAppMaxClients} زبون)` : 'غير مفعلة'}
                  </span>
                </div>
                <div className={`p-2 rounded-lg ${shopData.customerAppLicenseActive ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                  <Crown size={16} />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">صلاحيات الأجهزة والمنصات</span>
                  <span className="text-xs font-black text-sky-300">
                    {shopData.allowedPlatformsLabel} (حد {shopData.maxDevicesCount} أجهزة)
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                  <Monitor size={16} />
                </div>
              </div>
            </div>

            {/* Credentials Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-amber-400">
                <span className="flex items-center gap-1.5"><KeyRound size={15} /> بيانات تسجيل الدخول الرسمية للنظام</span>
                <span className="text-[10px] text-slate-400 font-normal">احتفظ بها في مكان آمن</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Username / Email */}
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5 overflow-hidden">
                    <span className="text-[10px] text-slate-400 block font-bold">اسم المستخدم / البريد</span>
                    <span className="text-xs font-mono font-black text-emerald-300 block truncate" dir="ltr">
                      {shopData.email}
                    </span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(shopData.email, 'email')}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 transition cursor-pointer"
                    title="نسخ اسم المستخدم"
                  >
                    {copiedKey === 'email' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>

                {/* Password */}
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5 overflow-hidden">
                    <span className="text-[10px] text-slate-400 block font-bold">كلمة المرور</span>
                    <span className="text-xs font-mono font-black text-amber-300 block truncate" dir="ltr">
                      {showPassword ? shopData.password : '••••••••••'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition cursor-pointer"
                      title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button 
                      onClick={() => copyToClipboard(shopData.password, 'pass')}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition cursor-pointer"
                      title="نسخ كلمة المرور"
                    >
                      {copiedKey === 'pass' ? <Check size={14} className="text-amber-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Support Phone Section */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-emerald-300 block">
                  للحصول على كافة مميزات وتحديثات البرنامج والدعم الفني المباشر
                </span>
                <span className="text-[11px] text-slate-400 block">
                  يرجى التواصل عبر الواتساب على الرقم المعتمد:
                </span>
              </div>
              <a 
                href={`https://wa.me/${cleanSupportPhoneForWa}`} 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95"
              >
                <MessageCircle size={15} />
                <span dir="ltr">{defaultSupportPhone}</span>
              </a>
            </div>

            {/* Download Links Accordion / Badges */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-black text-slate-400 block">
                روابط تحميل وتثبيت التطبيقات لكافة المنصات:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <a 
                  href={shopData.customerPortalUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-amber-500/20 flex items-center justify-between text-xs transition"
                >
                  <span className="text-amber-300 font-bold flex items-center gap-1.5"><Crown size={14} /> بوابة الزبائن VIP</span>
                  <ExternalLink size={13} className="text-slate-400" />
                </a>

                <a 
                  href={shopData.apkDownloadUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-emerald-500/20 flex items-center justify-between text-xs transition"
                >
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5"><Smartphone size={14} /> تطبيق الجوال (APK)</span>
                  <Download size={13} className="text-slate-400" />
                </a>

                <a 
                  href={shopData.exeDownloadUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-sky-500/20 flex items-center justify-between text-xs transition"
                >
                  <span className="text-sky-300 font-bold flex items-center gap-1.5"><Monitor size={14} /> برنامج الكمبيوتر (EXE)</span>
                  <Download size={13} className="text-slate-400" />
                </a>
              </div>
            </div>

            {/* Official Certification & Verification Footer */}
            <div className="pt-4 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
              <div className="flex items-center gap-2 text-xs text-amber-300 font-bold">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>وثيقة ترخيص رقمية معتمدة ومسجلة في السجل السحابي العام</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                الدعم الفني المباشر: <span className="text-amber-400 font-bold">{defaultSupportPhone}</span>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Action Bar (Buttons: Print, WhatsApp, SMS, Share, Copy, Close) */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* WhatsApp Button */}
            <button
              onClick={handleSendWhatsApp}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
            >
              <MessageCircle size={16} />
              <span>إرسال عبر الواتساب</span>
            </button>

            {/* SMS Button */}
            <button
              onClick={handleSendSMS}
              className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-sky-600/20 transition active:scale-95 cursor-pointer"
            >
              <Send size={15} />
              <span>إرسال SMS</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <Printer size={15} />
              <span>طباعة الكرت</span>
            </button>

            {/* Share / Copy Text */}
            <button
              onClick={handleGenericShare}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 border border-white/10 transition active:scale-95 cursor-pointer"
            >
              <Share2 size={15} />
              <span>مشاركة</span>
            </button>

            <button
              onClick={() => copyToClipboard(fullShareText, 'all')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 border border-white/10 transition active:scale-95 cursor-pointer"
            >
              {copiedKey === 'all' ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              <span>{copiedKey === 'all' ? 'تم نسخ كامل البيانات!' : 'نسخ كامل النص'}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs transition active:scale-95 cursor-pointer"
          >
            إغلاق ومتابعة
          </button>
        </div>

      </div>
    </div>
  );
}
