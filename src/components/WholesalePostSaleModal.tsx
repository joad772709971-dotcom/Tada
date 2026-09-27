import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Printer, 
  Send, 
  MessageSquare, 
  Phone, 
  Truck, 
  Package, 
  ExternalLink, 
  Check, 
  Copy, 
  Sparkles, 
  Clock, 
  User, 
  CreditCard, 
  ArrowRight,
  Share2,
  FileText,
  Layers,
  X
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { sendSMS, sendWhatsApp } from '../services/smsService';
import { UserProfile, Customer } from '../types';

export type PrintFormatType = 'thermal_80' | 'thermal_58' | 'a4' | 'a5';
export type SendChannelType = 'whatsapp' | 'sms' | 'jam_hub';

export interface PostSaleInvoiceData {
  saleId: string;
  transactionId?: string;
  dispatchCode?: string;
  prepOrderId?: string;
  customer: Customer | any | null;
  customerName: string;
  customerPhone: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    unitType?: string;
    qtyInPieces?: number;
    discount?: number;
    agency?: string;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentDetails?: {
    cashAmount?: number;
    debtAmount?: number;
    depositAmount?: number;
    bankAccountName?: string;
    transferRefNo?: string;
  };
  sellerName?: string;
  createdAt?: string;
  notes?: string;
}

interface WholesalePostSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewSale: () => void;
  invoiceData: PostSaleInvoiceData | null;
  profile: UserProfile | null;
  onNavigateToWarehouse?: () => void;
}

export default function WholesalePostSaleModal({
  isOpen,
  onClose,
  onNewSale,
  invoiceData,
  profile,
  onNavigateToWarehouse
}: WholesalePostSaleModalProps) {
  const [printFormat, setPrintFormat] = useState<PrintFormatType>('thermal_80');
  const [selectedChannel, setSelectedChannel] = useState<SendChannelType>('whatsapp');
  const [targetPhone, setTargetPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Real-time logistics status from warehousePreps
  const [prepStatus, setPrepStatus] = useState<'pending' | 'in_progress' | 'ready' | 'completed' | 'with_issues'>('pending');
  const [preppedByStaff, setPreppedByStaff] = useState<string | null>(null);

  useEffect(() => {
    if (invoiceData?.customerPhone) {
      setTargetPhone(invoiceData.customerPhone);
    } else {
      setTargetPhone('');
    }
  }, [invoiceData]);

  // Listen to the warehouse prep document in real-time
  useEffect(() => {
    if (!isOpen || !invoiceData?.saleId || !profile?.ownerId) return;

    const prepCol = collection(db, 'warehousePreps');
    const q = query(
      prepCol,
      where('ownerId', '==', profile.ownerId),
      where('orderId', '==', invoiceData.saleId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        if (docData.prepStatus) {
          setPrepStatus(docData.prepStatus);
        }
        if (docData.preppedBy) {
          setPreppedByStaff(docData.preppedBy);
        }
      }
    }, (err) => {
      console.warn('Error listening to warehouse prep status:', err);
    });

    return () => unsubscribe();
  }, [isOpen, invoiceData?.saleId, profile?.ownerId]);

  if (!isOpen || !invoiceData) return null;

  const shopName = profile?.shopName || 'مؤسسة تجارة الجملة';
  const supervisorName = profile?.name || 'الكاشير';

  // Construct formatted text message
  const buildInvoiceTextMessage = () => {
    const lines: string[] = [];
    lines.push(`🌟 *${shopName}* 🌟`);
    lines.push(`📋 *فاتورة مبيعات جملة رقم:* #${invoiceData.saleId.slice(-8)}`);
    if (invoiceData.dispatchCode) {
      lines.push(`📦 *كود الصرف والمستودع:* ${invoiceData.dispatchCode}`);
    }
    lines.push(`👤 *العميل:* ${invoiceData.customerName}`);
    lines.push(`📅 *التاريخ:* ${invoiceData.createdAt || new Date().toLocaleString('ar-YE')}`);
    lines.push(`--------------------------------`);
    lines.push(`📦 *الأصناف والكميات:*`);

    invoiceData.items.forEach((item, idx) => {
      const unitLabel = item.unitType === 'carton' ? 'كرتون' : item.unitType === 'dozen' ? 'درزن' : 'حبة';
      const itemTotal = (item.quantity * item.price) - (item.discount || 0);
      lines.push(`${idx + 1}. ${item.name} | ${item.quantity} ${unitLabel} × ${item.price.toLocaleString()} = ${itemTotal.toLocaleString()} ر.ي`);
    });

    lines.push(`--------------------------------`);
    if (invoiceData.discount > 0) {
      lines.push(`💰 *الإجمالي قبل الخصم:* ${invoiceData.subtotal.toLocaleString()} ر.ي`);
      lines.push(`🏷️ *الخصم الممنوح:* ${invoiceData.discount.toLocaleString()} ر.ي`);
    }
    lines.push(`💵 *صافي الفاتورة:* ${invoiceData.total.toLocaleString()} ر.ي`);

    if (invoiceData.paymentDetails) {
      const { cashAmount, debtAmount, depositAmount } = invoiceData.paymentDetails;
      if (cashAmount && cashAmount > 0) lines.push(`🟢 المدفوع نقداً: ${cashAmount.toLocaleString()} ر.ي`);
      if (depositAmount && depositAmount > 0) lines.push(`🏦 الحوالة / الإيداع: ${depositAmount.toLocaleString()} ر.ي`);
      if (debtAmount && debtAmount > 0) lines.push(`⚠️ المتبقي آجل (دين): ${debtAmount.toLocaleString()} ر.ي`);
    }

    lines.push(`--------------------------------`);
    lines.push(`🚚 *حالة التجهيز اللوجستي:* قيد التجهيز بالمستودع 📦`);
    lines.push(`✨ نسعد دائماً بخدمتكم وتلبية طلباتكم!`);

    return lines.join('\n');
  };

  // 1. Instant Print Handler
  const handleInstantPrint = () => {
    window.print();
  };

  // 2. Multi-Channel Dispatch Handler
  const handleSendMessage = async (silentToast = false) => {
    const phoneToUse = targetPhone.trim() || invoiceData.customerPhone || '';
    const textMsg = buildInvoiceTextMessage();

    setIsSending(true);
    setSendSuccessMsg(null);

    try {
      if (selectedChannel === 'whatsapp') {
        if (!phoneToUse) {
          alert('يرجى كتابة أو تحديد رقم هاتف العميل لإرسال الفاتورة عبر واتساب');
          setIsSending(false);
          return;
        }
        sendWhatsApp(phoneToUse, textMsg);
        setSendSuccessMsg('تم فتح محادثة WhatsApp لإرسال الفاتورة بنجاح 🟢');
      } else if (selectedChannel === 'sms') {
        if (!phoneToUse) {
          alert('يرجى كتابة رقم هاتف العميل لإرسال الرسالة القصيرة SMS');
          setIsSending(false);
          return;
        }
        await sendSMS(phoneToUse, textMsg);
        setSendSuccessMsg('تم إرسال الفاتورة عبر تطبيق الرسائل القصيرة (SMS) ✉️');
      } else if (selectedChannel === 'jam_hub') {
        // Internal JAM Hub direct chat message
        const receiverId = invoiceData.customer?.id || phoneToUse || invoiceData.saleId;
        const senderId = profile?.shopId || profile?.ownerId || 'jam_system';

        await addDoc(collection(db, 'messages'), {
          senderId,
          receiverId,
          content: textMsg,
          isCustomer: false,
          contextType: 'wholesale_invoice',
          saleId: invoiceData.saleId,
          dispatchCode: invoiceData.dispatchCode || null,
          total: invoiceData.total,
          read: false,
          createdAt: serverTimestamp()
        });

        setSendSuccessMsg('تم إرسال الفاتورة فوراً إلى محادثة العميل في شبكة JAM Hub 🌐');
      }

      if (silentToast) {
        setTimeout(() => setSendSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.error('Error dispatching message:', err);
      alert('حدث خطأ أثناء الإرسال: ' + (err.message || 'فشل الاتصال'));
    } finally {
      setIsSending(false);
    }
  };

  // 3. Print & Send Combined Handler
  const handlePrintAndSend = async () => {
    handleInstantPrint();
    await handleSendMessage(true);
  };

  const copyDispatchCode = () => {
    if (invoiceData.dispatchCode) {
      navigator.clipboard.writeText(invoiceData.dispatchCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const getMethodBadge = (m: string) => {
    switch (m) {
      case 'cash': return { label: 'نقدي (Cash)', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
      case 'credit': return { label: 'آجل / دين (Credit)', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
      case 'split_cash_debt': return { label: 'نقد + آجل (Split)', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
      case 'transfer': return { label: 'حوالة / إيداع بنكي', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
      case 'split_deposit_cash': return { label: 'إيداع + نقد', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' };
      case 'split_deposit_debt': return { label: 'إيداع + آجل', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
      case 'jam_pay': return { label: 'JAM Pay 💳', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
      default: return { label: 'معاملة مكتملة', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    }
  };

  const methodBadge = getMethodBadge(invoiceData.paymentMethod);

  return (
    <>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
        dir="rtl"
        id="wholesale-post-sale-modal"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="bg-white dark:bg-[#0c1017] border-2 border-[#d4af37]/40 rounded-[2.5rem] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-auto"
        >
          {/* 1. Header with Glowing Success Accent */}
          <div className="relative p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-[#131b26] to-slate-900 border-b border-[#d4af37]/20 text-white flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={26} className="stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black tracking-wide text-white">
                    تم اعتماد وتثبيت الفاتورة بنجاح
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30">
                    مبيعات جملة
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  رقم الفاتورة: <span className="font-mono text-emerald-400 font-bold">#{invoiceData.saleId.slice(-8)}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="إغلاق"
            >
              <X size={20} />
            </button>
          </div>

          {/* 2. Main Content Body */}
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar text-right">
            
            {/* Logistics Pipeline Step Tracker (مسار تجهيز الطلبيات والمستودع) */}
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#151c28] border border-slate-200 dark:border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="text-[#d4af37]" size={18} />
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    مسار تجهيز المستودع واللوجستيات (Logistics Pipeline)
                  </h4>
                </div>

                {invoiceData.dispatchCode && (
                  <button
                    type="button"
                    onClick={copyDispatchCode}
                    className="flex items-center gap-1.5 px-3 py-1 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 rounded-xl text-[11px] font-black font-mono transition-all"
                  >
                    <span>{invoiceData.dispatchCode}</span>
                    {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                )}
              </div>

              {/* Steps Progress Visualizer */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {/* Step 1: Received & Saved */}
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center text-center">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-black mb-1">
                    ✓
                  </div>
                  <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">1. استلام وتثبيت</span>
                  <span className="text-[9px] text-gray-400 font-bold">تم حفظ الفاتورة</span>
                </div>

                {/* Step 2: Warehouse Prep */}
                <div className={`p-2.5 rounded-2xl border flex flex-col items-center text-center transition-all ${
                  prepStatus === 'completed' || prepStatus === 'ready'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/40 text-amber-500 animate-pulse'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black mb-1 ${
                    prepStatus === 'completed' || prepStatus === 'ready'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-500 text-slate-950'
                  }`}>
                    {prepStatus === 'completed' || prepStatus === 'ready' ? '✓' : '2'}
                  </div>
                  <span className="text-[11px] font-black">2. قيد التجهيز</span>
                  <span className="text-[9px] opacity-80 font-bold">
                    {prepStatus === 'completed' ? 'تم الفرز بنجاح' : 'في المستودع 📦'}
                  </span>
                </div>

                {/* Step 3: Verified & Handed Over */}
                <div className={`p-2.5 rounded-2xl border flex flex-col items-center text-center ${
                  prepStatus === 'completed'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-white/5 text-gray-400'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black mb-1 ${
                    prepStatus === 'completed'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white'
                  }`}>
                    {prepStatus === 'completed' ? '✓' : '3'}
                  </div>
                  <span className="text-[11px] font-black">3. مطابقة وتسليم</span>
                  <span className="text-[9px] opacity-80 font-bold">التسليم النهائي</span>
                </div>
              </div>

              {/* Warehouse Quick Navigation Callout */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">
                  {preppedByStaff ? `المسؤول عن التجهيز بالمخزن: ${preppedByStaff}` : 'تم إدراج البضاعة آلياً في قائمة فرز المستودع.'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToWarehouse) {
                      onNavigateToWarehouse();
                    } else {
                      window.location.hash = '#/warehouse';
                    }
                    onClose();
                  }}
                  className="text-amber-500 hover:text-amber-400 font-black text-[11px] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span>فتح غرفة المستودع 📦</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            {/* Financial Summary & Customer Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#161c27] border border-slate-200 dark:border-white/[0.05] space-y-1.5">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                  <User size={14} />
                  <span>العميل:</span>
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {invoiceData.customerName}
                </p>
                {invoiceData.customerPhone && (
                  <p className="text-xs font-mono text-gray-400">
                    {invoiceData.customerPhone}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#161c27] border border-slate-200 dark:border-white/[0.05] space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <CreditCard size={14} />
                    <span>صافي الفاتورة:</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${methodBadge.color}`}>
                    {methodBadge.label}
                  </span>
                </div>
                <p className="text-lg font-black text-[#d4af37] font-mono">
                  {invoiceData.total.toLocaleString()} <span className="text-xs text-slate-400">ر.ي</span>
                </p>
              </div>
            </div>

            {/* 3. Printing Options Matrix (خيارات الطباعة الفورية) */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Printer size={14} className="text-[#d4af37]" />
                <span>اختر مقاس ونوع الطباعة:</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'thermal_80', label: 'حراري 80mm', icon: '🧾', desc: 'إيصال كاشير قياسي' },
                  { id: 'thermal_58', label: 'حراري 58mm', icon: '🧾', desc: 'طابعة جيب صغيرة' },
                  { id: 'a4', label: 'ورق قياسي A4', icon: '📄', desc: 'فاتورة رسمية كاملة' },
                  { id: 'a5', label: 'ورق مدمج A5', icon: '📄', desc: 'نصف صفحة تجارية' }
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setPrintFormat(fmt.id as PrintFormatType)}
                    className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      printFormat === fmt.id
                        ? 'bg-[#d4af37]/15 border-[#d4af37] text-slate-950 dark:text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-[#161c27] border-slate-200 dark:border-white/[0.05] text-slate-600 dark:text-slate-400 hover:border-[#d4af37]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">{fmt.icon}</span>
                      {printFormat === fmt.id && (
                        <span className="w-4 h-4 rounded-full bg-[#d4af37] text-slate-950 flex items-center justify-center text-[10px] font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-black block">{fmt.label}</span>
                    <span className="text-[9px] text-gray-400">{fmt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Multi-Channel Dispatch Options (خيارات الإرسال المباشرة) */}
            <div className="space-y-2.5 pt-1">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Share2 size={14} className="text-emerald-500" />
                <span>قناة الإرسال والمشاركة الإلكترونية:</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChannel('whatsapp')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    selectedChannel === 'whatsapp'
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black shadow-sm'
                      : 'bg-slate-50 dark:bg-[#161c27] border-slate-200 dark:border-white/[0.05] text-slate-600 dark:text-slate-400 hover:border-emerald-500/40'
                  }`}
                >
                  <span className="text-xl">🟢</span>
                  <span className="text-xs font-black">واتساب WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('sms')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    selectedChannel === 'sms'
                      ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 font-black shadow-sm'
                      : 'bg-slate-50 dark:bg-[#161c27] border-slate-200 dark:border-white/[0.05] text-slate-600 dark:text-slate-400 hover:border-blue-500/40'
                  }`}
                >
                  <span className="text-xl">📱</span>
                  <span className="text-xs font-black">رسالة SMS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('jam_hub')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    selectedChannel === 'jam_hub'
                      ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400 font-black shadow-sm'
                      : 'bg-slate-50 dark:bg-[#161c27] border-slate-200 dark:border-white/[0.05] text-slate-600 dark:text-slate-400 hover:border-purple-500/40'
                  }`}
                >
                  <span className="text-xl">💬</span>
                  <span className="text-xs font-black">دردشة JAM Hub</span>
                </button>
              </div>

              {/* Phone Input */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#161c27] p-2 rounded-2xl border border-slate-200 dark:border-white/[0.05]">
                <Phone size={16} className="text-gray-400 mr-1 shrink-0" />
                <input
                  type="text"
                  placeholder="رقم هاتف العميل للإرسال (مثال: 777123456)..."
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-mono font-bold text-slate-800 dark:text-white flex-1 text-right"
                />
              </div>

              {sendSuccessMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center"
                >
                  {sendSuccessMsg}
                </motion.div>
              )}
            </div>

            {/* 5. Master Action Buttons (طباعة فورية / طباعة وإرسال / إرسال فقط) */}
            <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                
                {/* 1. Instant Print Only */}
                <button
                  type="button"
                  onClick={handleInstantPrint}
                  className="py-3.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
                  id="post-sale-instant-print-btn"
                >
                  <Printer size={16} className="text-[#d4af37]" />
                  <span>طباعة فورية</span>
                </button>

                {/* 2. Print & Send Combined */}
                <button
                  type="button"
                  onClick={handlePrintAndSend}
                  disabled={isSending}
                  className="py-3.5 px-3 bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-500 hover:brightness-110 text-slate-950 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#d4af37]/20 active:scale-95 transition-all cursor-pointer"
                  id="post-sale-print-and-send-btn"
                >
                  <Printer size={16} />
                  <Send size={14} />
                  <span>طباعة وإرسال</span>
                </button>

                {/* 3. Send Only */}
                <button
                  type="button"
                  onClick={() => handleSendMessage(false)}
                  disabled={isSending}
                  className="py-3.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  id="post-sale-send-only-btn"
                >
                  <Send size={16} />
                  <span>إرسال فقط</span>
                </button>
              </div>

              {/* Bottom Quick Controls */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onNewSale();
                    onClose();
                  }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  id="post-sale-new-sale-btn"
                >
                  <Sparkles size={16} className="text-[#d4af37]" />
                  <span>بدء فاتورة بيع جملة جديدة (F1)</span>
                </button>
              </div>
            </div>

          </div>
        </motion.div>
      </div>

      {/* 6. Embedded Dedicated Printable Views (Thermal 80/58 & A4/A5 Standard) */}
      <div className="hidden print:block print:w-full" id="wholesale-print-view" dir="rtl">
        {printFormat === 'thermal_80' || printFormat === 'thermal_58' ? (
          /* Thermal POS Print Layout */
          <div className={`p-2 bg-white text-black font-mono text-xs mx-auto ${printFormat === 'thermal_58' ? 'max-w-[58mm] text-[10px]' : 'max-w-[80mm]'}`}>
            <div className="text-center border-b pb-2 mb-2">
              <h2 className="font-black text-sm">{shopName}</h2>
              <p className="text-[10px]">مبيعات الجملة والتوزيع</p>
              <div className="mt-1 font-bold text-xs bg-black text-white p-1 rounded">
                فاتورة مبيعات جملة
              </div>
            </div>

            <div className="text-[10px] space-y-0.5 border-b pb-2 mb-2">
              <div><strong>رقم الفاتورة:</strong> #{invoiceData.saleId.slice(-8)}</div>
              {invoiceData.dispatchCode && <div><strong>كود الصرف:</strong> {invoiceData.dispatchCode}</div>}
              <div><strong>العميل:</strong> {invoiceData.customerName}</div>
              <div><strong>التاريخ:</strong> {invoiceData.createdAt || new Date().toLocaleString('ar-YE')}</div>
              <div><strong>الموظف:</strong> {supervisorName}</div>
            </div>

            <table className="w-full text-right text-[10px] border-collapse border-b pb-2 mb-2">
              <thead>
                <tr className="border-b">
                  <th className="py-1">الصنف</th>
                  <th className="text-center py-1">الكمية</th>
                  <th className="text-left py-1">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((it, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-1 font-bold">{it.name}</td>
                    <td className="text-center py-1">{it.quantity} {it.unitType === 'carton' ? 'كرتون' : 'حبة'}</td>
                    <td className="text-left py-1">{((it.quantity * it.price) - (it.discount || 0)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 text-xs border-b pb-2 mb-2">
              {invoiceData.discount > 0 && (
                <div className="flex justify-between">
                  <span>الخصم:</span>
                  <span>-{invoiceData.discount.toLocaleString()} ر.ي</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm">
                <span>الصافي:</span>
                <span>{invoiceData.total.toLocaleString()} ر.ي</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>طريقة الدفع:</span>
                <span>{methodBadge.label}</span>
              </div>
            </div>

            <div className="text-center text-[9px] text-gray-500 pt-1">
              <p>شكرًا لتعاملكم معنا ✨</p>
              <p>JAM SYSTEM PRO - م. عبدالغني المحفلي</p>
            </div>
          </div>
        ) : (
          /* Standard A4 / A5 Commercial Invoice Layout */
          <div className={`p-8 bg-white text-slate-900 font-sans mx-auto border border-gray-300 ${printFormat === 'a5' ? 'max-w-xl text-xs' : 'max-w-4xl text-sm'}`}>
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900">{shopName}</h1>
                <p className="text-xs text-gray-500 font-bold">منظومة تجارة الجملة وتجهيز المستودعات الذكية</p>
                <div className="mt-2 inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black rounded">
                  📋 فاتورة مبيعات جملة رسمية
                </div>
              </div>
              <div className="text-left font-mono">
                <p className="font-bold">INVOICE: #{invoiceData.saleId.slice(-8)}</p>
                {invoiceData.dispatchCode && (
                  <p className="text-xs text-amber-600 font-bold">DISPATCH: {invoiceData.dispatchCode}</p>
                )}
                <p className="text-xs text-gray-500">{invoiceData.createdAt || new Date().toLocaleString('ar-YE')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <p><strong>اسم العميل:</strong> {invoiceData.customerName}</p>
                <p><strong>هاتف العميل:</strong> {invoiceData.customerPhone || 'غير مسجل'}</p>
              </div>
              <div className="text-left">
                <p><strong>طريقة السداد:</strong> {methodBadge.label}</p>
                <p><strong>الكاشير / الموظف:</strong> {supervisorName}</p>
              </div>
            </div>

            <table className="w-full text-right border-collapse border border-gray-300 mb-6">
              <thead>
                <tr className="bg-slate-900 text-white text-xs">
                  <th className="p-2 border border-gray-400">#</th>
                  <th className="p-2 border border-gray-400">المادة / الصنف</th>
                  <th className="p-2 border border-gray-400 text-center">الوحدة والكمية</th>
                  <th className="p-2 border border-gray-400 text-center">السعر</th>
                  <th className="p-2 border border-gray-400 text-center">الخصم</th>
                  <th className="p-2 border border-gray-400 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((it, idx) => (
                  <tr key={idx} className="odd:bg-gray-50 border-b border-gray-200">
                    <td className="p-2 border border-gray-300 font-mono">{idx + 1}</td>
                    <td className="p-2 border border-gray-300 font-bold">{it.name}</td>
                    <td className="p-2 border border-gray-300 text-center font-mono font-bold">
                      {it.quantity} {it.unitType === 'carton' ? 'كرتون' : it.unitType === 'dozen' ? 'درزن' : 'حبة'}
                    </td>
                    <td className="p-2 border border-gray-300 text-center font-mono">{it.price.toLocaleString()}</td>
                    <td className="p-2 border border-gray-300 text-center font-mono text-rose-600">{it.discount || 0}</td>
                    <td className="p-2 border border-gray-300 text-left font-mono font-bold">
                      {((it.quantity * it.price) - (it.discount || 0)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-start pt-4 border-t-2 border-slate-900">
              <div className="text-xs text-gray-500 max-w-sm">
                * البضاعة المباعة خاضعة لإذن التجهيز والفرز المخزني برقم الصرف {invoiceData.dispatchCode || invoiceData.saleId.slice(-6)}.
                <br />
                * يرجى الاحتفاظ بهذه الفاتورة لأغراض المطابقة والضمان.
              </div>
              <div className="w-64 space-y-1.5 text-xs text-left">
                <div className="flex justify-between border-b pb-1">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono font-bold">{invoiceData.subtotal.toLocaleString()} ر.ي</span>
                </div>
                {invoiceData.discount > 0 && (
                  <div className="flex justify-between border-b pb-1 text-rose-600">
                    <span>إجمالي الخصم:</span>
                    <span className="font-mono font-bold">-{invoiceData.discount.toLocaleString()} ر.ي</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm bg-slate-900 text-white p-2.5 rounded-xl">
                  <span>صافي الفاتورة:</span>
                  <span className="font-mono">{invoiceData.total.toLocaleString()} ر.ي</span>
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-gray-400 mt-8 pt-4 border-t border-gray-200">
              <p>Powered by JAM System Pro | منظومة م. عبدالغني المحفلي</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
