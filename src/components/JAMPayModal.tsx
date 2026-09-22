import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

interface JAMPayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JAMPayModal({ isOpen, onClose }: JAMPayModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" dir="rtl" id="jampay-modal-overlay">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md overflow-hidden border bg-gradient-to-b from-[#111827] to-[#030712] border-amber-500/35 rounded-[2rem] text-right p-6 text-white shadow-[0_0_50px_rgba(245,158,11,0.15)]"
          id="jampay-modal-container"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5 select-none">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-black shadow-lg shadow-amber-500/20">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-black text-amber-400 font-cairo">جـام بــاي | JAM Pay</h3>
                <p className="text-[10px] text-amber-500/70 font-black tracking-wider font-mono">بوابة الدفع الإلكتروني المباشر</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body with the specific User Request message */}
          <div className="py-6 text-center space-y-5" id="jampay-announcement-body">
            <div className="mx-auto w-16 h-16 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center border border-amber-500/30 shadow-lg shadow-amber-500/5">
              <AlertCircle size={32} className="animate-pulse" />
            </div>
            
            <div className="space-y-3">
              <h4 className="text-lg font-black text-yellow-400 font-cairo leading-relaxed">
                تنويه بخصوص الخدمة
              </h4>
              
              <p className="text-sm font-bold text-gray-200 px-2 leading-relaxed bg-white/5 py-4 rounded-2xl border border-white/5">
                عزيز العميل خدمة jam pay مازلنا علا قيد العمل من أجلها وستتوفر في التحديثات القادمة هدفنا خدمتكم
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all text-sm shadow-lg shadow-amber-500/15 cursor-pointer"
            >
              فهمت، شكراً لكم
            </button>
          </div>

          {/* Footer Safe Guard */}
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-[9px] text-gray-500 font-bold select-none">
            <ShieldCheck size={12} className="text-amber-500" />
            <span>نظام دفع آمن مشفر ومحمي بموجب معايير الأمان الدولية لمؤسسة JAM</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
