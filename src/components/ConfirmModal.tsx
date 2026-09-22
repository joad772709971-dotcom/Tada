import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'success' | 'warning';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  type = 'warning'
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
        onClose();
      }
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onClose]);

  const colors = {
    danger: 'bg-danger text-white hover:bg-danger/90',
    success: 'bg-success text-white hover:bg-success/90',
    warning: 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20'
  };

  const icons = {
    danger: <AlertTriangle className="text-danger" size={40} />,
    success: <CheckCircle2 className="text-success" size={40} />,
    warning: <AlertTriangle className="text-brand-primary" size={40} />
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-navy-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/10 text-center space-y-6"
          >
            <div className="w-20 h-20 bg-gray-100 dark:bg-navy-900 rounded-full flex items-center justify-center mx-auto">
              {icons[type]}
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-navy-900 dark:text-white">{title}</h3>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button
                onClick={onClose}
                className="py-3 px-6 bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-navy-700 transition-all"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`py-3 px-6 rounded-xl font-bold transition-all shadow-lg ${colors[type]}`}
              >
                {confirmText}
              </button>
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-navy-900 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
