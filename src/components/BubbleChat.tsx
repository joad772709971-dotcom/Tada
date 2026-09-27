import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, User, ChevronLeft, Phone, Maximize2, Minimize2, Mic, Volume2, Shield, Lock } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, limit, getDoc, doc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { playMessageAudioAlert } from '../utils/audioAlerts';

export default function BubbleChat({ profile }: { profile: UserProfile | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [shopEmployees, setShopEmployees] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);

  // Current logged in user ID and owner ID
  const currentUid = profile?.uid || '';
  const ownerId = profile?.ownerId || profile?.uid || '';
  const isOwnerOrManager = profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'superadmin' || currentUid === ownerId;

  // 1. Fetch employees belonging STRICTLY to this shop
  useEffect(() => {
    if (!profile?.uid || !isOpen) return;

    // Fetch users whose ownerId matches this shop owner
    const q = query(
      collection(db, 'users'),
      where('ownerId', '==', ownerId),
      limit(25)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((u: any) => u.id !== currentUid && u.status !== 'deleted' && u.deleted !== true && u.isDeleted !== true);

      // Add shop owner to list if current user is an employee
      if (!isOwnerOrManager && ownerId !== currentUid) {
        try {
          const ownerSnap = await getDoc(doc(db, 'users', ownerId));
          if (ownerSnap.exists()) {
            const oData = ownerSnap.data();
            list = [{ id: ownerId, name: oData.name || 'مدير المحل', shopName: oData.shopName || 'المالك', role: 'owner', isOwner: true }];
          }
        } catch (e) {
          console.error(e);
        }
      } else if (!isOwnerOrManager) {
        // Staff can ONLY see owner/manager
        list = list.filter((u: any) => u.role === 'owner' || u.role === 'manager' || u.id === ownerId);
      }

      setShopEmployees(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [profile, isOpen, ownerId, currentUid, isOwnerOrManager]);

  // 2. Fetch Isolated messages between current user and selected contact
  useEffect(() => {
    if (!currentUid || !selectedContact || !isOpen) return;

    const contactId = selectedContact.id || selectedContact.uid;

    const q = query(
      collection(db, 'messages'),
      where('senderId', 'in', [currentUid, contactId]),
      where('receiverId', 'in', [currentUid, contactId]),
      orderBy('createdAt', 'asc'),
      limit(40)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Sound notification on incoming new message
      if (newMsgs.length > prevMsgCountRef.current) {
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg && lastMsg.senderId !== currentUid && prevMsgCountRef.current > 0) {
          playMessageAudioAlert();
        }
      }
      prevMsgCountRef.current = newMsgs.length;

      setMessages(newMsgs);
      setTimeout(() => {
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [currentUid, selectedContact, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact || !profile) return;

    const contactId = selectedContact.id || selectedContact.uid;

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: currentUid,
        senderName: profile.name || profile.shopName || 'موظف المحل',
        receiverId: contactId,
        receiverName: selectedContact.name || selectedContact.shopName || 'الموظف',
        content: newMessage.trim(),
        type: 'shop_internal',
        createdAt: serverTimestamp(),
        status: 'sent'
      });
      setNewMessage('');
    } catch (error) {
      console.error('BubbleChat Error:', error);
    }
  };

  // Listen to global open/close events
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      const forceState = customEvent.detail?.open;
      setIsOpen(prev => forceState !== undefined ? forceState : !prev);
    };
    window.addEventListener('toggle-jam-chat', handleToggle);
    return () => window.removeEventListener('toggle-jam-chat', handleToggle);
  }, []);

  if (!profile) return null;
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', bottom: '96px', left: '24px', zIndex: 9999 }} dir="rtl" className="flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? '60px' : '520px',
              width: isMinimized ? '220px' : '360px'
            }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="bg-slate-900 border border-slate-800 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col text-right"
          >
            {/* Header */}
            <div className="p-3.5 bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 text-white flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2.5">
                {selectedContact ? (
                  <button onClick={() => setSelectedContact(null)} className="p-1 hover:bg-white/20 rounded-lg cursor-pointer">
                    <ChevronLeft size={18} />
                  </button>
                ) : (
                  <MessageCircle size={20} className="text-amber-300" />
                )}
                <div className="text-right">
                  <h4 className="text-xs font-black truncate max-w-[140px]">
                    {selectedContact ? (selectedContact.name || selectedContact.shopName) : 'مراسلات المحل المعزولة 💬'}
                  </h4>
                  <p className="text-[9px] text-indigo-200 font-bold flex items-center gap-1">
                    <Lock size={10} className="text-emerald-400" />
                    <span>مراسلة خاصة معزولة 100%</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/20 rounded-lg cursor-pointer">
                  {isMinimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
                </button>
                <button onClick={() => {
                  setIsOpen(false);
                  window.dispatchEvent(new CustomEvent('jam-tool-closed', { detail: { tool: 'chat' } }));
                }} className="p-1.5 hover:bg-white/20 rounded-lg cursor-pointer">
                  <X size={15} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
                {/* 📍 Horizontal Employee Selector Bar (شريط الموظفين للمحل فقط) */}
                <div className="p-2 bg-slate-900/90 border-b border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
                  <span className="text-[10px] font-black text-amber-400 shrink-0 px-1">الموظفين:</span>
                  {shopEmployees.length === 0 ? (
                    <span className="text-[9px] text-slate-400">لا يوجد موظفين مسجلين بالمحل</span>
                  ) : (
                    shopEmployees.map((emp) => {
                      const isSelected = selectedContact?.id === emp.id || selectedContact?.uid === emp.uid;
                      return (
                        <button
                          key={emp.id || emp.uid}
                          onClick={() => setSelectedContact(emp)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <div className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[9px] font-black">
                            {(emp.name || emp.shopName || 'E')[0]}
                          </div>
                          <span className="truncate max-w-[80px]">{emp.name || emp.shopName}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                {!selectedContact ? (
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 text-right flex flex-col items-center justify-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2">
                      <Shield size={28} />
                    </div>
                    <p className="text-xs font-black text-slate-200">مراسلات موظفي المحل المعزولة</p>
                    <p className="text-[10px] text-slate-400 text-center max-w-[240px] leading-relaxed">
                      اختر أي موظف من الشريط العلوي لمراسلته مباشرة. المحادثات معزولة بالكامل بين الموظف والمدير ولا يمكن لأي موظف آخر الاطلاع عليها.
                    </p>
                  </div>
                ) : (
                  <>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 custom-scrollbar">
                      {messages.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-[10px]">
                          بداية المحادثة المعزولة مع {selectedContact.name || selectedContact.shopName} 👋
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isMine = msg.senderId === currentUid;
                          return (
                            <div key={msg.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-[85%] p-2.5 rounded-2xl text-xs font-medium shadow-sm leading-relaxed ${
                                isMine 
                                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                                  : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                              }`}>
                                <div className="text-[9px] opacity-70 mb-0.5 font-bold">{msg.senderName}</div>
                                {msg.content}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <form onSubmit={handleSend} className="p-2.5 bg-slate-900 border-t border-slate-800 flex gap-2">
                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="اكتب رسالة خاصة للموظف..."
                        className="flex-1 py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
                      />
                      <button 
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center disabled:opacity-40 shadow-md shadow-indigo-600/30 transition-all cursor-pointer shrink-0"
                      >
                        <Send size={15} />
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
