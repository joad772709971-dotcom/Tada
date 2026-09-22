import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageCircle, Phone } from 'lucide-react';
import { sendWhatsApp } from '../services/smsService';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  initialMessage: string;
  title?: string;
}

export default function MessageModal({ isOpen, onClose, phone, initialMessage, title = 'إرسال رسالة' }: MessageModalProps) {
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    setMessage(initialMessage);
  }, [initialMessage]);

  const handleSend = () => {
    sendWhatsApp(phone, message);
    onClose();
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
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            className="relative w-full max-w-lg bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <MessageCircle className="text-brand-primary" />
                {title}
              </h3>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-navy-50 dark:bg-navy-900/50 rounded-xl">
                <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center">
                  <Phone size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">رقم الهاتف:</p>
                  <p className="font-bold text-lg">{phone}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="label-field">نص الرسالة</label>
                <textarea 
                  className="input-field min-h-[150px] text-sm leading-relaxed"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={onClose}
                  className="flex-1 py-4 bg-gray-100 dark:bg-navy-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleSend}
                  className="flex-1 py-4 bg-brand-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-primary/90 transition-colors shadow-lg shadow-brand-primary/20"
                >
                  <Send size={20} />
                  إرسال عبر واتساب
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
