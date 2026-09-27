import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send, 
  MessageCircle, 
  Phone, 
  Sparkles, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { Customer, UserProfile } from '../types';
import { b2bOnboardingService } from '../services/b2bOnboardingService';

interface B2BInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  profile: UserProfile | null;
}

export default function B2BInvitationModal({
  isOpen,
  onClose,
  customer,
  profile
}: B2BInvitationModalProps) {
  const [supportPhone, setSupportPhone] = useState(
    profile?.shopPhone || profile?.phone || '777503191'
  );
  const [customNote, setCustomNote] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !customer || !mounted) return null;

  const eligibility = b2bOnboardingService.isEligibleForB2BInvite(profile, customer);
  const messageText = b2bOnboardingService.generateInvitationText(profile, customer, {
    supportPhone,
    customNote: customNote.trim() || undefined
  });

  const handleWhatsAppSend = () => {
    b2bOnboardingService.sendWhatsAppInvite(customer.phone, messageText);
    setFeedback('تم فتح تطبيق واتساب لإرسال الدعوة بنجاح.');
    setTimeout(() => onClose(), 1500);
  };

  const handleSMSSend = async () => {
    setIsSendingSMS(true);
    try {
      await b2bOnboardingService.sendSMSInvite(customer.phone, messageText);
      setFeedback('تم تجهيز وإرسال رسالة الـ SMS بنجاح.');
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setFeedback(err.message || 'فشل إرسال رسالة SMS');
    } finally {
      setIsSendingSMS(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-navy-950/80 backdrop-blur-md overflow-hidden">
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
          className="relative bg-white dark:bg-navy-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-navy-700 z-10 text-right overflow-hidden"
          dir="rtl"
        >
          {/* Header */}
          <div className="shrink-0 p-5 sm:p-6 border-b border-gray-100 dark:border-navy-800 bg-white dark:bg-navy-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-navy-900 dark:text-white flex items-center gap-2">
                  <span>دعوة انضمام الشريك التجاري (B2B Onboarding)</span>
                </h3>
                <p className="text-xs text-gray-400 font-bold mt-0.5">
                  إرسال رابط الكتالوج، كود العميل، وبيانات الدخول للطلب المباشر
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="p-2 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-full text-gray-400 hover:text-navy-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {feedback && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-black text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={16} />
                <span>{feedback}</span>
              </div>
            )}

            {/* Target Partner Summary Card */}
            <div className="p-4 bg-gray-50 dark:bg-navy-950/80 rounded-2xl border border-gray-200 dark:border-navy-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div>
                  <span className="text-xs font-black text-navy-900 dark:text-white block">
                    {customer.name} {customer.shopName ? `(${customer.shopName})` : ''}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold font-mono">
                    هاتف: {customer.phone} | كود: {customer.code || 'غير محدد'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {customer.tier || 'عميل تجاري B2B'}
              </span>
            </div>

            {/* Generated Message Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <MessageCircle size={14} className="text-brand-primary" />
                  <span>نص الرسالة الترحيبية التلقائية:</span>
                </label>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[11px] font-black text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {isCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{isCopied ? 'تم النسخ بنجاح' : 'نسخ النص'}</span>
                </button>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-2xl text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
                {messageText}
              </div>
            </div>

            {/* Custom note option */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-700 dark:text-gray-300">
                ملاحظة إضافية خاصة تظهر بالرسالة (اختياري):
              </label>
              <input
                type="text"
                placeholder="مثال: خصم خاص 5% على أول طلبية هذا الأسبوع..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-bold outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 p-4 sm:p-5 border-t border-gray-100 dark:border-navy-800 bg-gray-50/90 dark:bg-navy-950/90 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleWhatsAppSend}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle size={16} />
              <span>إرسال عبر واتساب (WhatsApp)</span>
            </button>

            <button
              type="button"
              onClick={handleSMSSend}
              disabled={isSendingSMS}
              className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send size={15} />
              <span>{isSendingSMS ? 'جاري الإرسال...' : 'إرسال SMS'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-gray-200 dark:bg-navy-800 text-gray-700 dark:text-gray-300 font-black text-xs rounded-2xl hover:bg-gray-300 dark:hover:bg-navy-700 transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
