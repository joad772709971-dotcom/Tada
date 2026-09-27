import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Unlock, ShieldAlert, KeyRound } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: string;
}

export default function VaultModal({ isOpen, onClose, ownerId }: VaultModalProps) {
  const { isVaultOpen, vaultPassword } = useVault();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== vaultPassword) {
      setError('كلمة السر غير صحيحة');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'settings', ownerId), {
        isVaultOpen: !isVaultOpen
      });
      setPassword('');
      onClose();
    } catch (err) {
      console.error('Error toggling vault:', err);
      setError('حدث خطأ أثناء تحديث حالة الخزنة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-navy-900/80 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10"
          >
            <div className={`p-8 text-center space-y-6 ${isVaultOpen ? 'bg-brand-primary/10' : 'bg-danger/10'}`}>
              <div className={`w-24 h-24 rounded-3xl mx-auto flex items-center justify-center shadow-lg ${
                isVaultOpen ? 'bg-brand-primary text-white' : 'bg-danger text-white'
              }`}>
                {isVaultOpen ? <Unlock size={48} /> : <Lock size={48} />}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-navy-900 dark:text-white">
                  {isVaultOpen ? 'خزنة الطوارئ مفتوحة' : 'خزنة الطوارئ (The Time Vault)'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isVaultOpen 
                    ? 'النظام يسمح الآن بإدخال عمليات بتاريخ قديم. يرجى الإغلاق بعد الانتهاء.'
                    : 'هذه الخزنة تسمح لك بإدخال مبيعات أو سحبيات بتاريخ قديم للتعويض عن أوقات الانقطاع.'}
                </p>
              </div>

              <form onSubmit={handleToggleVault} className="space-y-4">
                <div className="relative">
                  <input 
                    type="password" 
                    placeholder="أدخل كلمة سر الخزنة..." 
                    className="input-field pr-12 text-center text-xl tracking-[0.5em]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  <KeyRound size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>

                {error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-xs font-bold text-danger flex items-center justify-center gap-2"
                  >
                    <ShieldAlert size={14} />
                    {error}
                  </motion.p>
                )}

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-4 bg-gray-100 dark:bg-navy-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting || !password}
                    className={`flex-1 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg ${
                      isVaultOpen 
                        ? 'bg-danger text-white hover:bg-danger/90 shadow-danger/20' 
                        : 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-brand-primary/20'
                    }`}
                  >
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-4 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {isVaultOpen ? <Lock size={20} /> : <Unlock size={20} />}
                        {isVaultOpen ? 'إغلاق الخزنة' : 'فتح الخزنة'}
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="pt-4 border-t border-gray-100 dark:border-navy-700">
                <p className="text-[10px] text-gray-400">
                  في حال نسيان كلمة السر، يرجى التواصل مع المدير العام لاستعادتها.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
