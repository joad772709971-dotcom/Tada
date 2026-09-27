import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Clock, CheckCheck, Store, MessageSquare, Image as ImageIcon, Loader2, Ban, AlertTriangle } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, or, and } from 'firebase/firestore';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: Timestamp;
  read: boolean;
  mediaUrl?: string;
  contextType?: string;
  isCustomer?: boolean;
}

export default function CustomerChat({ lead, shopProfile }: { lead: any, shopProfile: any }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lead?.phone || !shopProfile?.id) return;

    // Listen to block status in real-time
    const blockedRef = collection(db, 'blocked_customers');
    const qBlocked = query(
      blockedRef,
      where('shopId', '==', shopProfile.id),
      where('customerPhone', '==', lead.phone),
      where('blocked', '==', true)
    );

    const unsubBlocked = onSnapshot(qBlocked, (snapshot) => {
      setIsBlocked(!snapshot.empty);
    });

    const messagesRef = collection(db, 'messages');
    // Strictly isolate messages between this specific customer and this specific shop
    const q = query(
      messagesRef,
      or(
        and(
          where('senderId', '==', lead.phone),
          where('receiverId', '==', shopProfile.id)
        ),
        and(
          where('senderId', '==', shopProfile.id),
          where('receiverId', '==', lead.phone)
        )
      ),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => {
      unsubscribe();
      unsubBlocked();
    };
  }, [lead, shopProfile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Calculate messages sent today by the customer
  const sentTodayCount = useMemo(() => {
    const today = new Date();
    return messages.filter(m => {
      if (!m.isCustomer) return false;
      if (!m.createdAt) return false;
      const date = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt.seconds * 1000);
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
    }).length;
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !mediaUrl) return;
    if (!lead || !shopProfile) return;
    if (isBlocked) {
      alert("عذراً، تم حظر حسابك من مراسلة هذا المحل.");
      return;
    }
    if (sentTodayCount >= 5) {
      alert("لقد استنفدت الحد اليومي الأقصى للمراسلة (5 رسائل في اليوم).");
      return;
    }

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: lead.phone,
        receiverId: shopProfile.id,
        customerUid: auth.currentUser?.uid || null,
        content: newMessage.trim(),
        mediaUrl: mediaUrl || null,
        createdAt: serverTimestamp(),
        read: false,
        customerName: lead.name,
        isCustomer: true
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isBlocked || sentTodayCount >= 5) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await handleSendMessage(undefined, base64);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-[#001122]/50 border-2 border-royal-gold/20 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 border-b border-royal-gold/10 bg-royal-gold/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-royal-gold border border-royal-gold/20">
            <Store size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">{shopProfile.shopName}</h3>
            <p className="text-[10px] text-royal-gold font-bold uppercase tracking-widest">الدعم الفني المباشر</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] bg-royal-gold/10 text-royal-gold px-3 py-1 rounded-full font-black">
            الرسائل اليومية: {sentTodayCount} / 5
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        {messages.map((msg, idx) => {
          const isMine = msg.senderId === lead.phone;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] p-4 rounded-[2rem] ${isMine ? 'bg-royal-gold text-deep-navy rounded-br-none' : 'bg-white/10 text-white border border-white/10 rounded-bl-none'}`}>
                {msg.mediaUrl && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-white/10">
                    <img src={msg.mediaUrl} alt="media" className="w-full max-h-48 object-cover" />
                  </div>
                )}
                <p className="text-sm font-bold leading-relaxed">{msg.content}</p>
                <div className={`flex items-center gap-1 mt-1 justify-end opacity-60`}>
                  <span className="text-[8px] font-black">
                    {msg.createdAt?.toDate && typeof msg.createdAt.toDate === 'function'
                      ? msg.createdAt.toDate().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) 
                      : msg.createdAt?.seconds
                        ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
                        : '...'}
                  </span>
                  {isMine && (
                    <span className={msg.read ? 'text-blue-500' : 'text-gray-400'}>
                      <CheckCheck size={12} className={msg.read ? 'text-deep-navy' : 'text-gray-400'} />
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <MessageSquare size={48} className="text-gray-500" />
            <p className="text-sm font-bold text-gray-500 px-12">أهلاً بك! يمكنك الاستفسار عن حالة طلبك أو إصلاح جهازك من هنا مباشرة.</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Warnings & Inputs */}
      <div className="p-4 bg-white/5 border-t border-royal-gold/10">
        {isBlocked ? (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-center">
            <Ban size={16} />
            <span>عذراً، لقد تم حظر حسابك من المراسلة من قبل إدارة المحل.</span>
          </div>
        ) : sentTodayCount >= 5 ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-center">
            <AlertTriangle size={16} />
            <span>لقد استهلكت الحد المسموح به اليوم (5 رسائل/يوم). يرجى الانتظار حتى الغد.</span>
          </div>
        ) : (
          <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-3">
            <label className="p-3 bg-white/5 text-royal-gold rounded-2xl border border-royal-gold/20 hover:bg-white/10 transition-colors cursor-pointer">
              <ImageIcon size={20} />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="اكتب استفسارك هنا..."
              className="flex-1 bg-deep-navy/50 border-2 border-royal-gold/10 p-4 rounded-2xl text-sm font-bold text-white focus:border-royal-gold transition-all outline-none"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim() && !isUploading}
              className="w-12 h-12 bg-royal-gold text-deep-navy rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
