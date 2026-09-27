import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect } from 'react';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  themeColor?: string;
}

export default function QuickActionModal({
  isOpen,
  onClose,
  title,
  children,
  icon,
  themeColor = 'bg-navy-700'
}: QuickActionModalProps) {
  
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-navy-800 rounded-3xl shadow-2xl border border-white/10 w-full max-w-lg max-h-[95vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className={`p-3 ${themeColor} text-white flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                {icon && <div className="p-1.5 bg-white/20 rounded-xl">{icon}</div>}
                <h3 className="text-base font-black">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-black/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-3 lg:p-4 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
