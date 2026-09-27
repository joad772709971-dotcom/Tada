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
  Calendar, 
  ShieldCheck, 
  Crown, 
  Smartphone, 
  QrCode, 
  ExternalLink, 
  Download, 
  MessageCircle, 
  Send,
  Users,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

export interface CustomerAppTicketDetails {
  storeId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  shopPhone?: string;
  address?: string;
  businessTypeLabel?: string;
  customerAppLicenseActive: boolean;
  durationLabel: string;
  expiryDate: string;
  maxClients: number;
  portalUrl: string;
  customerApkUrl?: string;
  paidAmount?: string;
  paymentMethod?: string;
  createdAtText?: string;
}

interface CustomerAppTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketData: CustomerAppTicketDetails | null;
}

export default function CustomerAppTicketModal({
  isOpen,
  onClose,
  ticketData
}: CustomerAppTicketModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && ticketData) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#10b981', '#d4af37', '#3b82f6', '#f59e0b', '#ffffff']
        });
      } catch (e) {
        console.log('Confetti effect skipped:', e);
      }
    }
  }, [isOpen, ticketData]);

  if (!isOpen || !ticketData) return null;

  const nowFormatted = ticketData.createdAtText || new Date().toLocaleString('ar-YE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const portalFullLink = ticketData.portalUrl.startsWith('http') 
    ? ticketData.portalUrl 
    : `${window.location.origin}${ticketData.portalUrl}`;

  const apkLink = ticketData.customerApkUrl || `${window.location.origin}/downloads/customer_portal.apk`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getFullTicketText = () => {
    return `━━━━━━━━━━━━━━━━━━━━━
👑 *سند تفعيل واشتراك تطبيق وبوابة الزبائن VIP*
منظومة JAM PRO الذكية
━━━━━━━━━━━━━━━━━━━━━
🏪 *بيانات المتجر والمالك:*
• اسم المحل: ${ticketData.shopName}
• اسم المالك: ${ticketData.ownerName}
• هاتف التواصل: ${ticketData.phone}${ticketData.shopPhone ? ` | ${ticketData.shopPhone}` : ''}
${ticketData.address ? `• العنوان: ${ticketData.address}\n` : ''}
⭐ *تفاصيل رخصة تطبيق الزبائن VIP:*
• حالة الرخصة: ${ticketData.customerAppLicenseActive ? 'مفعلة ونشطة بنجاح ✅' : 'غير مفعلة ⏸️'}
• مدة الاشتراك: ${ticketData.durationLabel}
• موعد الانتهاء الصلاحية: ${ticketData.expiryDate}
• السعة المصرح بها: ${ticketData.maxClients} زبون معتمد
${ticketData.paidAmount ? `• المبلغ المسدد: ${ticketData.paidAmount} (${ticketData.paymentMethod || 'نقداً'})\n` : ''}
📲 *روابط وصول وبوابة الزبائن:*
• رابط بوابة الزبائن المباشر (Web Portal):
${portalFullLink}

• رابط تحميل تطبيق الزبائن (Android APK):
${apkLink}

💡 *طريقة الاستخدام:*
يمكن لمالك المحل الدخول إلى قسم (الزبائن) وتوليد أكواد وبطاقات تفعيل فورية للعملاء لتمكينهم من استعراض المنتجات والأسعار وتقديم الطلبات إلكترونياً.

تاريخ التفعيل: ${nowFormatted}
━━━━━━━━━━━━━━━━━━━━━`;
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(getFullTicketText());
    const cleanPhone = ticketData.phone.replace(/[^0-9]/g, '');
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone.startsWith('967') ? cleanPhone : '967' + cleanPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleShareSMS = () => {
    const text = encodeURIComponent(`تم تفعيل رخصة تطبيق وبوابة الزبائن VIP لـ ${ticketData.shopName} بنجاح! مدة الاشتراك: ${ticketData.durationLabel} حتى ${ticketData.expiryDate}. سعة: ${ticketData.maxClients} زبون. رابط البوابة: ${portalFullLink}`);
    window.open(`sms:${ticketData.phone}?body=${text}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:m-0 print:static">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-navy-950/85 backdrop-blur-md transition-opacity print:hidden"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-slate-900 border border-emerald-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto text-right print:w-full print:max-w-none print:border-none print:shadow-none print:bg-white print:text-black print:rounded-none" dir="rtl">
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="p-4 bg-gradient-to-r from-navy-950 via-slate-900 to-navy-950 border-b border-white/10 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black text-emerald-400">سند تفعيل واشتراك رسمي معتمد</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action Buttons Toolbar (Hidden on Print) */}
        <div className="p-3 bg-slate-950/90 border-b border-white/5 flex flex-wrap items-center justify-center gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl font-black text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
          >
            <Printer size={15} />
            <span>طباعة السند حرارياً (80mm)</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition cursor-pointer"
          >
            <MessageCircle size={15} />
            <span>إرسال واتساب</span>
          </button>

          <button
            onClick={handleShareSMS}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-black text-xs active:scale-95 transition cursor-pointer"
          >
            <Send size={14} />
            <span>رسالة SMS</span>
          </button>

          <button
            onClick={() => copyToClipboard(getFullTicketText(), 'full_ticket')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs active:scale-95 transition cursor-pointer border border-white/10"
          >
            {copiedKey === 'full_ticket' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedKey === 'full_ticket' ? 'تم النسخ!' : 'نسخ السند'}</span>
          </button>
        </div>

        {/* Printable Ticket Content Container */}
        <div ref={ticketRef} className="p-5 sm:p-7 space-y-5 max-h-[75vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-4 print:text-black">
          
          {/* Ticket Header */}
          <div className="text-center space-y-2 border-b border-dashed border-slate-700 print:border-black pb-4">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-amber-500/20 to-teal-500/20 border border-emerald-500/30 print:border-black print:bg-none text-emerald-400 print:text-black">
              <Crown size={32} />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white print:text-black tracking-tight flex items-center justify-center gap-2">
              <span>سند ترخيص واشتراك تطبيق الزبائن VIP</span>
            </h2>
            <p className="text-xs text-slate-400 print:text-gray-600 font-mono">
              منظومة JAM PRO الذكية • بوابة الزبائن الرقمية
            </p>
            <div className="text-[11px] text-slate-500 print:text-gray-500 font-mono">
              رقم المرجع: <span className="font-bold text-slate-300 print:text-black">{ticketData.storeId.slice(0, 12)}</span> • {nowFormatted}
            </div>
          </div>

          {/* Shop & Owner Identity Box */}
          <div className="p-4 rounded-2xl bg-slate-950/60 print:bg-transparent border border-white/10 print:border-black space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store size={18} className="text-amber-400 print:text-black" />
                <span className="text-base font-black text-white print:text-black">{ticketData.shopName}</span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 print:border-black print:text-black">
                {ticketData.customerAppLicenseActive ? '✅ رخصة نشطة' : '⏸️ غير مفعلة'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 print:text-gray-800 pt-1">
              <div className="flex items-center gap-1.5">
                <User size={14} className="text-slate-400 print:text-black" />
                <span>المالك: <strong>{ticketData.ownerName}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone size={14} className="text-emerald-400 print:text-black" />
                <span>الجوال: <strong className="font-mono">{ticketData.phone}</strong></span>
              </div>
              {ticketData.shopPhone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={14} className="text-teal-400 print:text-black" />
                  <span>هاتف المحل: <strong className="font-mono">{ticketData.shopPhone}</strong></span>
                </div>
              )}
              {ticketData.address && (
                <div className="flex items-center gap-1.5">
                  <span>الموقع: <strong>{ticketData.address}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* License & Quota Details Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent print:bg-transparent border border-emerald-500/30 print:border-black space-y-3">
            <span className="text-xs font-black text-emerald-300 print:text-black block flex items-center gap-1.5">
              <ShieldCheck size={16} /> مواصفات وترخيص تطبيق وبوابة الزبائن:
            </span>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/80 print:bg-transparent border border-white/5 print:border-black space-y-0.5">
                <span className="text-[10px] text-slate-400 print:text-gray-600 block">مدة الاشتراك:</span>
                <span className="font-black text-amber-400 print:text-black">{ticketData.durationLabel}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 print:bg-transparent border border-white/5 print:border-black space-y-0.5">
                <span className="text-[10px] text-slate-400 print:text-gray-600 block">تاريخ انتهاء الصلاحية:</span>
                <span className="font-black text-emerald-400 print:text-black font-mono">{ticketData.expiryDate}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 print:bg-transparent border border-white/5 print:border-black space-y-0.5">
                <span className="text-[10px] text-slate-400 print:text-gray-600 block">سعة الزبائن المصرح بها:</span>
                <span className="font-black text-sky-400 print:text-black flex items-center gap-1">
                  <Users size={13} /> {ticketData.maxClients} زبون VIP
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 print:bg-transparent border border-white/5 print:border-black space-y-0.5">
                <span className="text-[10px] text-slate-400 print:text-gray-600 block">حالة الدفع والتسوية:</span>
                <span className="font-black text-slate-200 print:text-black">
                  {ticketData.paidAmount ? `${ticketData.paidAmount}` : 'مسدد ومعتمد ✅'}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Portal Link & QR Code Box */}
          <div className="p-4 rounded-2xl bg-slate-950/80 print:bg-transparent border border-amber-500/30 print:border-black space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-300 print:text-black flex items-center gap-1.5">
                <QrCode size={15} /> باركود ورابط دخول الزبائن المباشر (VIP Portal)
              </span>
              <button
                onClick={() => copyToClipboard(portalFullLink, 'portal_link')}
                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 print:hidden flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'portal_link' ? <Check size={12} /> : <Copy size={12} />}
                <span>نسخ الرابط</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              <div className="p-2.5 bg-white rounded-2xl shrink-0 shadow-lg border border-slate-300">
                <QRCodeSVG
                  value={portalFullLink}
                  size={100}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="space-y-2 flex-1 text-center sm:text-right">
                <p className="text-[11px] text-slate-300 print:text-gray-700 leading-relaxed">
                  امسح الباركود بالكاميرا أو شارك الرابط مع زبائنك لتمكينهم من تسجيل الدخول واستعراض العروض والأسعار وإرسال الطلبات مباشرة.
                </p>
                <div className="p-2 rounded-xl bg-slate-900 print:bg-gray-100 border border-white/5 print:border-black text-[11px] text-emerald-400 print:text-black font-mono break-all text-left dir-ltr">
                  {portalFullLink}
                </div>
              </div>
            </div>
          </div>

          {/* Operational Guidance Notice */}
          <div className="p-3.5 rounded-2xl bg-blue-500/10 print:bg-transparent border border-blue-500/30 print:border-black flex items-start gap-2.5 text-xs text-slate-300 print:text-gray-800">
            <CheckCircle2 size={18} className="text-blue-400 print:text-black shrink-0 mt-0.5" />
            <div className="space-y-1 text-right">
              <span className="font-black text-blue-300 print:text-black block">💡 دليل تفعيل زبائن المتجر:</span>
              <p className="text-[11px] text-slate-300 print:text-gray-700 leading-relaxed font-medium">
                يستطيع مالك المتجر من داخل حسابه الذهاب إلى قائمة <strong>(الزبائن VIP)</strong> والضغط على <strong>«توليد بطاقة تفعيل للزبون»</strong> أو مسح باركود هاتف الزبون للربط الفوري.
              </p>
            </div>
          </div>

          {/* Thermal Print Footer Receipt Note */}
          <div className="text-center text-[10px] text-slate-500 print:text-gray-500 font-mono pt-2 border-t border-dashed border-slate-700 print:border-black">
            منظومة JAM PRO الذكية • جميع الحقوق محفوظة • شكراً لثقتكم بنا
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden on Print) */}
        <div className="p-4 bg-slate-950 border-t border-white/10 flex items-center justify-between gap-3 print:hidden">
          <button
            onClick={onClose}
            className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-black text-sm transition cursor-pointer text-center"
          >
            إغلاق السند
          </button>
        </div>
      </div>
    </div>
  );
}
