import React, { useState } from 'react';
import { MessageSquare, Send, ThumbsUp, ShieldAlert, Cpu } from 'lucide-react';
import { smartCommerceService } from '../services/smartCommerceService';
import { Lead } from '../types';
import { motion } from 'motion/react';

export default function ComplaintsCenter({ lead, ownerId }: { lead: Lead | null; ownerId: string }) {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'complaint' | 'suggestion' | 'dev_suggestion'>('complaint');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !message) return;
    setSubmitting(true);
    try {
      await smartCommerceService.submitComplaint({
        ownerId,
        userName: lead.name || 'عميل',
        userPhone: lead.phone,
        message,
        type
      });
      setSent(true);
      setMessage('');
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!lead) return null;

  return (
    <div className="bg-navy-900 border border-white/5 rounded-[2.5rem] p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-royal-gold/10 rounded-2xl text-royal-gold">
          <MessageSquare size={24} />
        </div>
        <div>
          <h3 className="text-xl font-black text-white">صندوق التواصل الذكي</h3>
          <p className="text-xs text-gray-400">صوتك مسموع.. للمدير أو للمطور مباشرة</p>
        </div>
      </div>

      {!sent ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setType('complaint')}
              className={`p-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-2 ${type === 'complaint' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-white/5 border-white/10 text-gray-400'}`}
            >
              <ShieldAlert size={18} />
              شكوى
            </button>
            <button
              type="button"
              onClick={() => setType('suggestion')}
              className={`p-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-2 ${type === 'suggestion' ? 'bg-royal-gold/10 border-royal-gold/50 text-royal-gold' : 'bg-white/5 border-white/10 text-gray-400'}`}
            >
              <ThumbsUp size={18} />
              اقتراح
            </button>
            <button
              type="button"
              onClick={() => setType('dev_suggestion')}
              className={`p-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-2 ${type === 'dev_suggestion' ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' : 'bg-white/5 border-white/10 text-gray-400'}`}
            >
              <Cpu size={18} />
              للمطور
            </button>
          </div>

          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={type === 'dev_suggestion' ? 'لديك فكرة لتطوير نظام JAM؟ شاركها مع المبرمج..' : 'اكتب رسالتك لمدير المحل هنا..'}
            className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-right outline-none focus:border-royal-gold transition-all"
          />

          <button
            disabled={submitting}
            className="w-full py-4 bg-royal-gold text-deep-navy font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-gold-glow disabled:opacity-50 transition-all shadow-xl"
          >
            {submitting ? 'جاري الإرسال...' : (
              <>
                <Send size={18} />
                إرسال الرسالة
              </>
            )}
          </button>
        </form>
      ) : (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-8"
        >
          <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ThumbsUp size={40} className="text-success" />
          </div>
          <h4 className="text-xl font-bold text-white mb-2">تم استلام رسالتك!</h4>
          <p className="text-gray-400 text-sm mb-6">شكراً لمشاركتنا رأيك، سيتم مراجعة الرسالة في أقرب وقت.</p>
          <button 
            onClick={() => setSent(false)}
            className="text-royal-gold font-bold hover:underline"
          >
            إرسال رسالة أخرى
          </button>
        </motion.div>
      )}
    </div>
  );
}
