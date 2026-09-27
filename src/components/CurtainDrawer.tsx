import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ShieldCheck } from 'lucide-react';

interface CurtainDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export default function CurtainDrawer({
  isOpen,
  onClose,
  title,
  icon,
  children
}: CurtainDrawerProps) {
  const [showSuccessWave, setShowSuccessWave] = useState(false);

  // Keyboard listeners: ESC to close, F8 to submit the form under the curtain drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'F8') {
        e.preventDefault();
        // Target the submit button inside our curtain drawer and click it
        const submitBtn = document.querySelector('.curtain-drawer-content button[type="submit"]') as HTMLButtonElement;
        if (submitBtn) {
          submitBtn.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Intercepting success callback to show the luxury checkmark wave
  const handleTriggerSuccess = () => {
    setShowSuccessWave(true);
    // Auto-collapse curtain sequence after 1.6s
    setTimeout(() => {
      setShowSuccessWave(false);
      onClose();
    }, 1600);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex flex-col justify-start overflow-hidden">
          {/* Dynamic backdrop blur at 12px over the background workspace */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-[12px]"
          />

          {/* Curtain Drawer slides down from top of viewport (negative-Y index space) */}
          <motion.div
            initial={{ y: '-100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            className="absolute top-0 inset-x-0 w-full max-h-[90vh] bg-[#faf7f0] dark:bg-[#020617]/95 text-slate-900 dark:text-white border-b-2 border-amber-500/30 rounded-b-[3.5rem] shadow-[0_20px_80px_rgba(0,0,0,0.8)] z-10 overflow-hidden flex flex-col"
          >
            {/* Liquid brushed metal accent bar */}
            <div className="h-1 bg-gradient-to-r from-amber-500/10 via-[#D4AF37]/80 to-amber-500/10 w-full" />

            {/* Header Terminal */}
            <div className="max-w-4xl mx-auto w-full px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                {icon && <div className="p-2.5 bg-amber-500/10 text-[#D4AF37] rounded-2xl border border-amber-500/20">{icon}</div>}
                <div className="text-right">
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                    {title}
                  </h3>
                  <p className="text-[9px] text-[#D4AF37] font-extrabold tracking-widest uppercase">JAM CURTAIN SELLING ENGINE • F8 לתזמון</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white rounded-full transition-colors cursor-pointer"
                  title="إغلاق الترس مبيعات"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Form Body Wrapper */}
            <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-6 pb-8 custom-scrollbar curtain-drawer-content">
              {/* Clone children to inject handleTriggerSuccess as the native callback override */}
              {React.isValidElement(children)
                ? React.cloneElement(children as React.ReactElement<any>, { onSuccess: handleTriggerSuccess })
                : children}
            </div>

            {/* Bottom guide rails */}
            <div className="py-2.5 bg-black/40 border-t border-white/5 text-center text-[10px] text-gray-500 font-bold flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>مؤمن ببروتوكولات التصفية الفورية لمصفوفة البازار المحلي • اضغط [F8] للتسوية</span>
            </div>

            {/* Success Checkmark Wave Overlay */}
            <AnimatePresence>
              {showSuccessWave && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#020617]/95 z-20 flex flex-col items-center justify-center p-6 text-center font-sans"
                >
                  {/* Glowing success circle wave rings */}
                  <div className="relative flex items-center justify-center mb-6">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: [1, 1.6, 2], opacity: [0.5, 0.2, 0] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
                      className="absolute w-24 h-24 rounded-full border-2 border-emerald-500/40"
                    />
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: [1, 1.4, 1.8], opacity: [0.6, 0.3, 0] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut', delay: 0.4 }}
                      className="absolute w-24 h-24 rounded-full border-4 border-[#D4AF37]/30"
                    />
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                      className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.5)] border-2 border-[#D4AF37]"
                    >
                      <Check size={40} className="text-[#020617] stroke-[4]" />
                    </motion.div>
                  </div>

                  <motion.h4
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xl sm:text-2xl font-black text-white"
                  >
                    تم قيد المعاملة لدفاتر الصناديق بنجاح! 🎉
                  </motion.h4>
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xs text-amber-500 font-extrabold mt-2"
                  >
                    يتم تحصيل وطباعة المستند والمزامنة فورياً...
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
