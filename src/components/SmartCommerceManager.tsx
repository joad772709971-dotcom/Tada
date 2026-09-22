import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Trophy, 
  Gift, 
  ShoppingBasket, 
  Users, 
  Plus, 
  Trash2, 
  Share2, 
  Clock, 
  Eye, 
  Check, 
  X,
  Smartphone,
  Search,
  Loader2,
  MessageSquare,
  Settings as SettingsIcon
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, setDoc, orderBy, limit, addDoc, serverTimestamp, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Lead, Quiz, PromoOffer, Complaint, Referral, InventoryItem, Booking, Auction, WholesaleProduct, MaintenanceOrder } from '../types';
import { smartCommerceService } from '../services/smartCommerceService';
import { JamFastProductImage } from './JamFastProductImage';
import PhoneDoctorKnowledgeView from './PhoneDoctorKnowledgeView';

interface SmartCommerceManagerProps {
  profile: UserProfile | null;
}

export default function SmartCommerceManager({ profile }: SmartCommerceManagerProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profile) return;
    const hasAccess = 
      profile.role === 'manager' || 
      profile.role === 'superadmin' || 
      profile.networkRole === 'wholesaler' || 
      profile.role === 'wholesaler' || 
      profile.role === 'employee' ||
      profile.role === 'distributor';
    
    setIsAuthorized(hasAccess);
  }, [profile]);

  const isWholesaler = profile?.role === 'wholesaler' || profile?.businessType === 'wholesale';
  const [activeTab, setActiveTab] = useState<string>(isWholesaler ? 'wholesale-market' : 'analytics');

  const [marketSales, setMarketSales] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.ownerId || !isWholesaler) return;
    // For wholesalers, we want to see completed orders/sales from other retailers
    const unsubSales = onSnapshot(
      query(collection(db, 'networkOrders'), where('wholesalerId', '==', profile.ownerId), where('status', '==', 'delivered')),
      (snap) => {
        setMarketSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsubSales();
  }, [profile, isWholesaler]);

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="p-6 bg-danger/10 text-danger rounded-full ring-8 ring-danger/5">
          <Zap size={64} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-navy-900 dark:text-white">عذراً، لا تملك صلاحية الوصول</h3>
          <p className="text-gray-500 max-w-md mx-auto">هذه الواجهة مخصصة للمدراء والمشرفين على العمليات التجارية في هذا المحل فقط.</p>
        </div>
      </div>
    );
  }
  
  const [offers, setOffers] = useState<PromoOffer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [wholesaleProducts, setWholesaleProducts] = useState<WholesaleProduct[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(profile);
  const [searchPhone, setSearchPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [searchMaintenance, setSearchMaintenance] = useState<MaintenanceOrder[]>([]);
  const [marketingTips, setMarketingTips] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [tipForm, setTipForm] = useState({ title: '', content: '', category: 'تقني' });
  const [quizForm, setQuizForm] = useState({ question: '', options: ['', '', ''], correctIndex: 0, points: 50 });

  // ----------------- CUSTOMER CHAT SYSTEM STATES -----------------
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [blockedPhones, setBlockedPhones] = useState<string[]>([]);
  const [activeChatPhone, setActiveChatPhone] = useState<string | null>(null);
  const [chatReplyText, setChatReplyText] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.ownerId) return;

    // Listen to messages received by the store (where receiverId is store's ownerId)
    const unsubReceived = onSnapshot(
      query(collection(db, 'messages'), where('receiverId', '==', profile.ownerId)),
      (snap) => {
        setReceivedMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    // Listen to messages sent by the store (where senderId is store's ownerId)
    const unsubSent = onSnapshot(
      query(collection(db, 'messages'), where('senderId', '==', profile.ownerId)),
      (snap) => {
        setSentMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    // Listen to blocked customers
    const unsubBlocked = onSnapshot(
      query(collection(db, 'blocked_customers'), where('shopId', '==', profile.ownerId)),
      (snap) => {
        setBlockedPhones(snap.docs.filter(d => d.data().blocked).map(d => d.data().customerPhone));
      }
    );

    return () => {
      unsubReceived();
      unsubSent();
      unsubBlocked();
    };
  }, [profile?.ownerId]);

  // Combine and sort messages
  const chatMessages = useMemo(() => {
    const combined = [...receivedMessages];
    sentMessages.forEach(sm => {
      if (!combined.some(rm => rm.id === sm.id)) {
        combined.push(sm);
      }
    });
    return combined.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeA - timeB;
    });
  }, [receivedMessages, sentMessages]);

  // Group messages by customer phone number
  const chats = useMemo(() => {
    const groups: { [phone: string]: {
      customerPhone: string;
      customerName: string;
      messages: any[];
      lastMessageTime: any;
      unreadCount: number;
      isOnline: boolean;
    } } = {};

    chatMessages.forEach(msg => {
      const phone = msg.isCustomer ? msg.senderId : msg.receiverId;
      if (!phone) return;

      if (!groups[phone]) {
        groups[phone] = {
          customerPhone: phone,
          customerName: msg.customerName || 'زبون غير معروف',
          messages: [],
          lastMessageTime: null,
          unreadCount: 0,
          isOnline: false
        };
      }

      groups[phone].messages.push(msg);

      if (msg.isCustomer && msg.customerName && groups[phone].customerName === 'زبون غير معروف') {
        groups[phone].customerName = msg.customerName;
      }

      if (msg.isCustomer && !msg.read) {
        groups[phone].unreadCount++;
      }
    });

    const sortedChats = Object.values(groups).map(chat => {
      chat.messages.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });

      const lastMsg = chat.messages[chat.messages.length - 1];
      chat.lastMessageTime = lastMsg?.createdAt || null;

      // Simulate online status (active in the last 15 minutes)
      const lastMsgDate = lastMsg?.createdAt?.toDate ? lastMsg.createdAt.toDate() : new Date((lastMsg?.createdAt?.seconds || 0) * 1000);
      const diffMs = new Date().getTime() - lastMsgDate.getTime();
      chat.isOnline = diffMs < 15 * 60 * 1000;

      return chat;
    });

    sortedChats.sort((a, b) => {
      const timeA = a.lastMessageTime?.seconds || 0;
      const timeB = b.lastMessageTime?.seconds || 0;
      return timeB - timeA;
    });

    return sortedChats;
  }, [chatMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (activeChatPhone) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChatPhone, chatMessages]);

  const handleSelectChat = async (phone: string) => {
    setActiveChatPhone(phone);
    
    // Mark customer messages as read in Firestore
    const unreadMsgs = chatMessages.filter(m => m.isCustomer && m.senderId === phone && !m.read);
    for (const msg of unreadMsgs) {
      try {
        await updateDoc(doc(db, 'messages', msg.id), { read: true });
      } catch (e) {
        console.error('Failed to mark message as read:', e);
      }
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatReplyText.trim() || !activeChatPhone || !profile?.ownerId) return;

    try {
      const textToSend = chatReplyText.trim();
      setChatReplyText('');

      await addDoc(collection(db, 'messages'), {
        senderId: profile.ownerId,
        receiverId: activeChatPhone,
        content: textToSend,
        createdAt: serverTimestamp(),
        read: false,
        isCustomer: false,
        customerName: chats.find(c => c.customerPhone === activeChatPhone)?.customerName || 'زبون'
      });
    } catch (error) {
      console.error('Failed to send reply:', error);
    }
  };

  const handleToggleBlock = async (phone: string, isCurrentlyBlocked: boolean) => {
    if (!profile?.ownerId) return;
    const confirmMsg = isCurrentlyBlocked 
      ? `هل أنت متأكد من إلغاء حظر الزبون ذو الرقم ${phone}؟`
      : `هل أنت متأكد من حظر الزبون ذو الرقم ${phone}؟ لن يتمكن من مراسلتك بعد الآن.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const blockedRef = doc(db, 'blocked_customers', `${profile.ownerId}_${phone}`);
      if (isCurrentlyBlocked) {
        await deleteDoc(blockedRef);
      } else {
        await setDoc(blockedRef, {
          shopId: profile.ownerId,
          customerPhone: phone,
          blocked: true,
          blockedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error('Failed to toggle block:', e);
    }
  };
  // ----------------- END OF CUSTOMER CHAT SYSTEM -----------------

  useEffect(() => {
    if (!profile?.ownerId) return;

    const unsubTips = onSnapshot(
      query(collection(db, 'phoneDoctorTips'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snap) => setMarketingTips(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'phoneDoctorTips')
    );

    const unsubQuizzes = onSnapshot(
      query(collection(db, 'quizzes'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snap) => setQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'quizzes')
    );

    return () => {
      unsubTips();
      unsubQuizzes();
    };
  }, [profile?.ownerId]);

  const handleCreateTip = async () => {
    if (!tipForm.title || !tipForm.content) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'phoneDoctorTips'), {
        ...tipForm,
        ownerId: profile?.ownerId,
        createdAt: serverTimestamp()
      });
      setTipForm({ title: '', content: '', category: 'تقني' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (!quizForm.question || quizForm.options.some(o => !o)) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'quizzes'), {
        ...quizForm,
        ownerId: profile?.ownerId,
        createdAt: serverTimestamp(),
        active: true
      });
      setQuizForm({ question: '', options: ['', '', ''], correctIndex: 0, points: 50 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTip = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه النصيحة؟')) return;
    try {
      await deleteDoc(doc(db, 'phoneDoctorTips', id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المسابقة؟')) return;
    try {
      await deleteDoc(doc(db, 'quizzes', id));
    } catch (err) {
      console.error(err);
    }
  };

  const stats = {
    totalLeads: leads.length,
    activeOffers: offers.filter(o => o.status === 'active').length,
    pendingBookings: bookings.filter(b => b.status === 'pending').length,
    totalPointsGiven: leads.reduce((acc, curr) => acc + (curr.points || 0), 0)
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Wholesale publishing state
  const [publishingItem, setPublishingItem] = useState<InventoryItem | null>(null);
  const [wholesaleForm, setWholesaleForm] = useState({ price: 0, description: '', stock: 0 });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isBulkPublish, setIsBulkPublish] = useState(false);
  const [bulkMode, setBulkMode] = useState<'category' | 'all' | 'select'>('select');
  const [selectedBulkCategory, setSelectedBulkCategory] = useState('');

  const handleBulkPublish = async () => {
    if (!profile?.ownerId) return;
    setLoading(true);
    try {
      let itemsToPublish = [];
      if (selectedItems.size > 0) {
        itemsToPublish = inventory.filter(i => selectedItems.has(i.id));
      } else if (bulkMode === 'all') {
        itemsToPublish = inventory;
      } else {
        itemsToPublish = inventory.filter(i => i.category === selectedBulkCategory);
      }

      if (itemsToPublish.length === 0) {
        alert('يرجى اختيار أصناف للنشر أولاً');
        setLoading(false);
        return;
      }

      const isStandardTier = profile?.tier_level === 'standard' || !profile?.tier_level;
      const limit = isStandardTier ? 20 : 100;
      let brandNewCount = 0;
      for (const item of itemsToPublish) {
        const existing = wholesaleProducts.find(wp => wp.originalItemId === item.id);
        if (!existing) brandNewCount++;
      }

      if (wholesaleProducts.length + brandNewCount > limit) {
        alert("لقد استنفدت الحد الأقصى المسموح به للصور.");
        setLoading(false);
        return;
      }

      if (!window.confirm(`هل أنت متأكد من نشر ${itemsToPublish.length} صنف إلى السوق العام؟`)) {
        setLoading(false);
        return;
      }

      for (const item of itemsToPublish) {
        // Check if already published
        const existing = wholesaleProducts.find(wp => wp.originalItemId === item.id);
        if (existing) {
          // Update existing product
          await updateDoc(doc(db, 'wholesaleProducts', existing.id), {
            price: item.price,
            stock: item.stock,
            updatedAt: serverTimestamp()
          });
          continue;
        }

        await addDoc(collection(db, 'wholesaleProducts'), {
          name: item.name,
          description: '',
          price: item.price,
          stock: item.stock,
          category: item.category || 'عام',
          agencyName: item.agencyName || '',
          photos: item.images || (item.photo ? [item.photo] : []),
          subCategory: '',
          wholesalerId: profile.ownerId,
          wholesalerName: profile.shopName || profile.name,
          originalItemId: item.id,
          isActive: true,
          createdAt: serverTimestamp()
        });
      }

      alert(`تم بنجاح نشر/تحديث الأصناف المختارة في سوق الموردين!`);
      setSelectedItems(new Set());
      setIsModalOpen(false);
      setIsBulkPublish(false);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء النشر الجماعي');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  };

  useEffect(() => {
    if (!profile?.uid) return;
    const unsubProfile = onSnapshot(doc(db, 'users', profile.uid), (snap) => {
       if (snap.exists()) setCurrentProfile(snap.data() as UserProfile);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${profile.uid}`);
    });
    return () => unsubProfile();
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile?.ownerId) return;

    const unsubOffers = onSnapshot(
      query(collection(db, 'offers'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snap) => setOffers(snap.docs.map(d => ({ id: d.id, ...d.data() } as PromoOffer))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'offers')
    );

    const unsubBookings = onSnapshot(
      query(collection(db, 'bookings'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snap) => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'bookings')
    );

    const unsubLeads = onSnapshot(
      query(collection(db, 'leads'), where('ownerId', '==', profile.ownerId), orderBy('points', 'desc')),
      (snap) => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'leads')
    );

    const unsubStaff = onSnapshot(
      query(collection(db, 'users'), where('ownerId', '==', profile.ownerId)),
      (snap) => setStaff(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    const unsubInv = onSnapshot(
      query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId)),
      (snap) => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'inventory')
    );

    const unsubWP = onSnapshot(
      query(collection(db, 'wholesaleProducts'), where('wholesalerId', '==', profile.ownerId)),
      (snap) => setWholesaleProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as WholesaleProduct))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'wholesaleProducts')
    );

    return () => {
      unsubOffers();
      unsubBookings();
      unsubLeads();
      unsubStaff();
      unsubInv();
      unsubWP();
    };
  }, [profile]);

  const handlePublishToMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishingItem || !profile) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'wholesaleProducts'), {
        name: publishingItem.name,
        description: wholesaleForm.description || '',
        price: wholesaleForm.price,
        stock: wholesaleForm.stock,
        category: publishingItem.category || 'عام',
        agencyName: publishingItem.agencyName || '',
        photos: publishingItem.images || (publishingItem.photo ? [publishingItem.photo] : []),
        subCategory: '',
        wholesalerId: profile.ownerId,
        wholesalerName: profile.shopName || profile.name,
        originalItemId: publishingItem.id,
        createdAt: serverTimestamp(),
        isActive: true
      });
      alert('تم نشر الصنف في سوق الموردين بنجاح!');
      setIsModalOpen(false);
      setPublishingItem(null);
    } catch (err) {
      console.error(err);
      alert('فشل في النشر');
    } finally {
      setLoading(false);
    }
  };

  const removeFromMarket = async (id: string) => {
    if (!window.confirm('هل تريد سحب هذا الصنف من السوق؟')) return;
    try {
      await deleteDoc(doc(db, 'wholesaleProducts', id));
    } catch (err) { console.error(err); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'text-amber-500 bg-amber-500/10';
      case 'working': return 'text-blue-500 bg-blue-500/10';
      case 'ready': return 'text-emerald-500 bg-emerald-500/10';
      case 'delivered': return 'text-navy-400 bg-navy-400/10';
      case 'failed': return 'text-rose-500 bg-rose-500/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting': return 'في الانتظار';
      case 'working': return 'قيد الإصلاح';
      case 'ready': return 'جاهز للاستلام';
      case 'delivered': return 'تم التسليم';
      case 'failed': return 'تعذر الإصلاح';
      default: return status;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header with Role Indicator */}
      <div className="bg-navy-900 border border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 blur-[100px] -z-10" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className={`w-16 h-16 ${isWholesaler ? 'bg-orange-500' : 'bg-brand-primary'} rounded-[1.5rem] flex items-center justify-center shadow-lg`}>
              <Zap className="text-navy-950 font-black" size={32} />
            </div>
            <div className="text-right">
              <h2 className="text-4xl font-black text-white tracking-tight">
                {isWholesaler ? 'غرفة العمليات (الجملة)' : 'غرفة التجارة الذكية (التجزئة)'}
              </h2>
              <p className="text-brand-primary font-black uppercase tracking-[0.2em] text-xs">
                {isWholesaler ? 'Wholesale Control Center' : 'Retail Smart Trade Engine'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
             <button 
              onClick={() => {
                setPublishingItem(null);
                setIsModalOpen(true);
              }}
              className="px-8 py-4 bg-brand-primary text-navy-950 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-3"
             >
                <Plus size={20} />
                {isWholesaler ? 'نشر صنف' : 'إطلاق عرض ذكي'}
             </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-navy-900/50 p-2 rounded-2xl border border-white/5 gap-2">
        {isWholesaler ? (
          <>
            <button onClick={() => setActiveTab('wholesale-market')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${activeTab === 'wholesale-market' ? 'bg-orange-500 text-navy-950 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
              <ShoppingBasket size={18} /><span>نشر السوق</span>
            </button>
            <button onClick={() => setActiveTab('orders')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${activeTab === 'orders' ? 'bg-orange-500 text-navy-950 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
              <Clock size={18} /><span>طلبات التجار</span>
            </button>
            <button onClick={() => setActiveTab('market-reports')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${activeTab === 'market-reports' ? 'bg-orange-500 text-navy-950 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
              <Trophy size={18} /><span>تقارير المبيعات</span>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setActiveTab('analytics')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${activeTab === 'analytics' ? 'bg-brand-primary text-navy-950 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
              <Zap size={18} /><span>نظرة ذكية</span>
            </button>
            <button onClick={() => setActiveTab('chamber')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${activeTab === 'chamber' ? 'bg-royal-gold text-navy-950 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
              <Trophy size={18} /><span>الغرفة الذكية</span>
            </button>
            <button onClick={() => setActiveTab('orders')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${activeTab === 'orders' ? 'bg-brand-primary text-navy-950 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
              <Clock size={18} /><span>طلبات الزبائن</span>
            </button>
            <button onClick={() => setActiveTab('offers')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${activeTab === 'offers' ? 'bg-brand-primary text-navy-950 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
              <ShoppingBasket size={18} /><span>العروض الذكية</span>
            </button>
          </>
        )}
        <button onClick={() => setActiveTab('customers')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${activeTab === 'customers' ? (isWholesaler ? 'bg-orange-500' : 'bg-brand-primary') + ' text-navy-950 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
          <Users size={18} /><span>البيانات والعملاء</span>
        </button>
        <button onClick={() => setActiveTab('customer-chat')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all relative ${activeTab === 'customer-chat' ? (isWholesaler ? 'bg-orange-500' : 'bg-brand-primary') + ' text-navy-950 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
          <MessageSquare size={18} />
          <span>دردشة العملاء</span>
          {chats.reduce((acc, curr) => acc + (curr.unreadCount > 0 ? 1 : 0), 0) > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-lg">
              {chats.reduce((acc, curr) => acc + (curr.unreadCount > 0 ? 1 : 0), 0)}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="wait">
          {activeTab === 'market-reports' && isWholesaler && (
            <motion.div key="market-reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="card-glass p-8 col-span-1">
                    <h4 className="text-xl font-black text-white mb-6">إجمالي مبيعات السوق</h4>
                    <div className="text-5xl font-black text-orange-500">
                      {marketSales.reduce((acc, curr) => acc + (curr.total || 0), 0).toLocaleString()} <span className="text-sm text-white/40">ر.ي</span>
                    </div>
                    <p className="mt-4 text-xs text-white/40">تم الحساب من واقع فواتير الطلبات الواردة المنفذة من تجار التجزئة.</p>
                 </div>

                 <div className="card-glass p-8 lg:col-span-2 space-y-6">
                    <h4 className="text-xl font-black text-white">المشتريات لكل عميل (تاجر تجزئة)</h4>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                      {Array.from(new Set(marketSales.map(s => s.retailerId))).map(rid => {
                        const retailerOrders = marketSales.filter(s => s.retailerId === rid);
                        const retailerName = retailerOrders[0]?.retailerName || 'تاجر مجهول';
                        const totalSpent = retailerOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
                        return (
                          <div key={rid} className="flex items-center justify-between p-5 bg-white/5 rounded-3xl group hover:bg-white/10 transition-all border border-transparent hover:border-orange-500/30">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-orange-500">
                                <Users size={24} />
                              </div>
                              <div>
                                <h5 className="font-black text-white">{retailerName}</h5>
                                <p className="text-[10px] text-white/40">{retailerOrders.length} طلبيات ناجحة</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-white/40 uppercase font-black tracking-tighter">إجمالي المشتريات</p>
                              <p className="text-xl font-black text-orange-500">{totalSpent.toLocaleString()} ر.ي</p>
                            </div>
                          </div>
                        );
                      })}
                      {marketSales.length === 0 && (
                        <div className="text-center py-10 opacity-20 italic">لا توجد مبيعات مسجلة في السوق حالياً</div>
                      )}
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'chamber' && (
            <motion.div key="chamber" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Phone Doctor Management */}
                <div className="card-glass p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-2xl">
                        <Smartphone size={24} />
                      </div>
                      <h3 className="text-xl font-black text-white">طبيب الهاتف (نصائح وأعطال)</h3>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="عنوان النصيحة أو العطل"
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white font-bold"
                      value={tipForm.title}
                      onChange={(e) => setTipForm({ ...tipForm, title: e.target.value })}
                    />
                    <textarea 
                      placeholder="وصف العطل أو النصيحة وكيفية التعامل معها..."
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white font-bold h-32"
                      value={tipForm.content}
                      onChange={(e) => setTipForm({ ...tipForm, content: e.target.value })}
                    />
                    <div className="flex items-center gap-4">
                      <select 
                        className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl text-white font-bold"
                        value={tipForm.category}
                        onChange={(e) => setTipForm({ ...tipForm, category: e.target.value })}
                      >
                        <option value="تقني">نصيحة تقنية</option>
                        <option value="صيانة">حل عطل</option>
                        <option value="تطبيقات">تطبيقات مفيدة</option>
                        <option value="حماية">أمن وحماية</option>
                      </select>
                      <button 
                        onClick={handleCreateTip}
                        disabled={loading}
                        className="px-8 py-4 bg-brand-primary text-navy-950 rounded-2xl font-black hover:scale-105 transition-all flex items-center gap-2"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
                        نشر النصيحة
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-4">
                    <h4 className="text-sm font-black text-white/60">النصائح المنشورة مؤخراً</h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {marketingTips.map(tip => (
                        <div key={tip.id} className="p-4 bg-white/5 rounded-2xl flex items-center justify-between">
                          <div>
                            <h5 className="font-bold text-white">{tip.title}</h5>
                            <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded-full">{tip.category}</span>
                          </div>
                          <button onClick={() => handleDeleteTip(tip.id)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-all">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quiz Management */}
                <div className="card-glass p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-royal-gold/10 text-royal-gold rounded-2xl">
                        <Trophy size={24} />
                      </div>
                      <h3 className="text-xl font-black text-white">مسابقات وجوائز الزبائن</h3>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="السؤال المطروح..."
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white font-bold"
                      value={quizForm.question}
                      onChange={(e) => setQuizForm({ ...quizForm, question: e.target.value })}
                    />
                    <div className="grid grid-cols-1 gap-2">
                      {quizForm.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input 
                            type="text"
                            placeholder={`الخيار ${idx + 1}`}
                            className={`flex-1 bg-white/5 border p-3 rounded-xl text-white text-sm ${quizForm.correctIndex === idx ? 'border-success/50' : 'border-white/10'}`}
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...quizForm.options];
                              newOpts[idx] = e.target.value;
                              setQuizForm({ ...quizForm, options: newOpts });
                            }}
                          />
                          <button 
                            onClick={() => setQuizForm({ ...quizForm, correctIndex: idx })}
                            className={`p-3 rounded-xl transition-all ${quizForm.correctIndex === idx ? 'bg-success text-navy-950' : 'bg-white/5 text-white/40'}`}
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 p-3 rounded-2xl">
                        <Gift size={16} className="text-royal-gold" />
                        <span className="text-xs text-white/60">النقاط:</span>
                        <input 
                          type="number"
                          className="bg-transparent border-none text-white font-black w-16"
                          value={quizForm.points}
                          onChange={(e) => setQuizForm({ ...quizForm, points: Number(e.target.value) })}
                        />
                      </div>
                      <button 
                        onClick={handleCreateQuiz}
                        disabled={loading}
                        className="px-8 py-4 bg-royal-gold text-navy-950 rounded-2xl font-black hover:scale-105 transition-all flex items-center gap-2"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : <Trophy size={20} />}
                        نشر المسابقة
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-4">
                    <h4 className="text-sm font-black text-white/60">المسابقات المنشورة</h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {quizzes.map(quiz => (
                        <div key={quiz.id} className="p-4 bg-white/5 rounded-2xl flex items-center justify-between">
                          <div>
                            <h5 className="font-bold text-white text-sm">{quiz.question}</h5>
                            <p className="text-[10px] text-royal-gold">{quiz.points} نقطة للمشاركة</p>
                          </div>
                          <button onClick={() => handleDeleteQuiz(quiz.id)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-all">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comprehensive Phone Doctor Knowledge Base & Advice Management */}
              <div className="card-glass p-6 md:p-8">
                <PhoneDoctorKnowledgeView
                  isMerchantView={true}
                  customAdvices={marketingTips}
                  onDeleteCustomAdvice={handleDeleteTip}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                 {[
                   { label: 'إجمالي العملاء', value: stats.totalLeads, icon: Users, color: 'text-brand-primary' },
                   { label: 'طلبات معلقة', value: stats.pendingBookings, icon: Clock, color: 'text-warning' },
                   { label: 'عروض نشطة', value: stats.activeOffers, icon: Gift, color: 'text-success' },
                   { label: 'نقاط موزعة', value: stats.totalPointsGiven, icon: Trophy, color: 'text-royal-gold' },
                 ].map((stat, i) => (
                   <div key={i} className="card-glass p-6 space-y-4">
                      <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center ${stat.color}`}>
                        <stat.icon size={24} />
                      </div>
                      <div>
                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
                        <p className="text-2xl font-black text-white">{stat.value.toLocaleString()}</p>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="card-glass p-8 space-y-6">
                    <h4 className="text-lg font-black text-white flex items-center gap-3">
                      <Trophy className="text-royal-gold" />
                      أكثر العملاء تفاعلاً
                    </h4>
                    <div className="space-y-4">
                       {leads.slice(0, 5).map((lead, i) => (
                         <div key={lead.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-full bg-royal-gold/10 flex items-center justify-center text-royal-gold font-black">#{i+1}</div>
                               <div>
                                  <p className="text-sm font-black text-white">{lead.name}</p>
                                  <p className="text-[10px] text-white/40">{lead.phone}</p>
                               </div>
                            </div>
                            <span className="text-royal-gold font-black">{lead.points} نقطة</span>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="card-glass p-8 flex flex-col justify-center items-center text-center space-y-6">
                    <div className="w-24 h-24 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary">
                       <Zap size={48} />
                    </div>
                    <div>
                       <h4 className="text-2xl font-black text-white">تحسين المبيعات الذكي</h4>
                       <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                          نظام JAM PRO يحلل بيانات عملائك ويقترح عليك العروض المناسبة لزيادة التفاعل بنسبة تصل إلى 40% بناءً على سلوك الشراء السابق.
                       </p>
                    </div>
                    <button className="px-8 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black hover:bg-white/10 transition-all">تفعيل الذكاء الاصطناعي</button>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'wholesale-market' && isWholesaler ? (
            <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-black text-white">المنتجات المنشورة في السوق العام</h3>
                <p className="text-white/40 text-xs">اجذب تجار التجزئة بأسعار منافسة</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Published Products */}
                {wholesaleProducts.map((p, idx) => (
                  <div key={`${p.id}-${idx}`} className="card-glass p-6 group relative">
                    <div className="absolute top-4 left-4 flex gap-2">
                      <button onClick={() => removeFromMarket(p.id)} className="p-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {p.photos && p.photos.length > 0 && (
                      <div className="aspect-[4/3] w-full bg-white/5 rounded-xl mb-4 overflow-hidden border border-white/5">
                        <JamFastProductImage imageUrl={p.photos[0]} altName={p.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <h4 className="font-black text-white text-lg leading-tight">{p.name}</h4>
                    {p.agencyName && <p className="text-[10px] font-black text-orange-500 uppercase mt-1">وكالة: {p.agencyName}</p>}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="p-3 bg-navy-950 rounded-xl">
                        <p className="text-[10px] text-white/40">سعر الجملة</p>
                        <p className="text-lg font-black text-success">{p.price} ر.ي</p>
                      </div>
                      <div className="p-3 bg-navy-950 rounded-xl">
                        <p className="text-[10px] text-white/40">الكمية المسوقة</p>
                        <p className="text-lg font-black text-white">{p.stock}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add from Inventory Button */}
                <div className="card-glass p-6 border-dashed border-2 border-white/10 flex flex-col items-center justify-center gap-4 text-center group cursor-pointer hover:border-brand-primary/50 transition-all"
                  onClick={() => {
                    setPublishingItem(null); // Reset
                    setIsModalOpen(true);
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="text-brand-primary" />
                  </div>
                  <div>
                    <p className="font-black text-white">نشر صنف جديد من المخزن</p>
                    <p className="text-[10px] text-white/40">اختر من مخزنك الشخصي واعرضه للجميع</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'orders' ? (
                  <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                     <h3 className="text-2xl font-black text-white px-2 border-r-4 border-brand-primary">
                       {isWholesaler ? 'طلبات تجار التجزئة' : 'حجوزات الزبائن الواردة'}
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {bookings.map(booking => (
                           <div key={booking.id} className="card-glass p-6 space-y-4 group">
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <ShoppingBasket className="text-brand-primary" />
                                    <div>
                                       <p className="font-black text-white">{booking.itemName || 'طلب منتج'}</p>
                                       <p className="text-[10px] text-white/40">{booking.customerName}</p>
                                    </div>
                                 </div>
                                 <div className={`px-3 py-1 rounded-full text-[10px] font-black ${booking.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                                    {booking.status === 'pending' ? 'جديد' : 'مقبول'}
                                 </div>
                              </div>
                              <div className="bg-navy-950/50 p-4 rounded-xl space-y-2 text-sm">
                                 <div className="flex justify-between"><span className="text-white/40">الهاتف:</span><span className="text-white font-black">{booking.customerPhone}</span></div>
                                 <div className="flex justify-between"><span className="text-white/40">السعر المتفق:</span><span className="text-success font-black">{booking.promoPrice} ر.ي</span></div>
                              </div>
                              {booking.status === 'pending' && (
                                 <button onClick={() => updateDoc(doc(db, 'bookings', booking.id), { status: 'accepted', updatedAt: serverTimestamp() })} className="w-full py-3 bg-brand-primary text-navy-950 rounded-xl font-black text-xs">قبول الطلب</button>
                              )}
                           </div>
                        ))}
                        {bookings.length === 0 && <p className="col-span-full text-center py-20 text-white/20 font-black italic">لا توجد طلبات نشطة</p>}
                     </div>
                  </motion.div>
          ) : activeTab === 'offers' ? (
             <motion.div key="offers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-2xl font-black text-white px-2 border-r-4 border-brand-primary">العروض والخصومات الذكية النشطة</h3>
                   <button 
                    onClick={() => {
                      setPublishingItem(null);
                      setIsModalOpen(true);
                    }}
                    className="px-6 py-2 bg-brand-primary/10 text-brand-primary rounded-xl font-black text-xs border border-brand-primary/20 hover:bg-brand-primary/20 transition-all flex items-center gap-2"
                   >
                     <Plus size={16} />
                     إنشاء عرض جديد
                   </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {offers.map(offer => (
                      <div key={offer.id} className="card-glass p-6 space-y-4 group relative overflow-hidden">
                         <div className="absolute top-4 left-4">
                            <button 
                              onClick={async () => {
                                if(confirm('هل أنت متأكد من إيقاف هذا العرض؟')) {
                                  await deleteDoc(doc(db, 'offers', offer.id));
                                }
                              }}
                              className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-all"
                            >
                               <Trash2 size={16} />
                            </button>
                         </div>
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-brand-primary">
                               <Gift size={24} />
                            </div>
                            <div>
                               <h4 className="font-black text-white">{offer.itemName}</h4>
                               <p className="text-[10px] text-brand-primary font-bold uppercase">{offer.occasion}</p>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-navy-950/50 rounded-xl">
                               <p className="text-[10px] text-white/40">السعر الحالي</p>
                               <p className="text-lg font-black text-white line-through opacity-30">{offer.originalPrice} ر.ي</p>
                            </div>
                            <div className="p-3 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
                               <p className="text-[10px] text-brand-primary font-black">سعر العرض</p>
                               <p className="text-xl font-black text-brand-primary">{offer.promoPrice} ر.ي</p>
                            </div>
                         </div>
                         <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                            <span className="text-[10px] text-white/40 font-mono">ينتهي في: {offer.endTime ? new Date((offer.endTime as any).seconds * 1000).toLocaleDateString() : '---'}</span>
                            <span className="px-2 py-0.5 bg-success/20 text-success rounded text-[9px] font-black uppercase">نشط حالياً</span>
                         </div>
                      </div>
                   ))}
                   {offers.length === 0 && (
                      <div className="col-span-full card-glass p-20 text-center border-dashed border-2 border-white/5 opacity-50">
                         <Gift size={48} className="mx-auto mb-4 text-white/10" />
                         <p className="font-black text-white/40 italic">لا توجد عروض نشطة حالياً. ابدأ بجذب الزبائن الآن!</p>
                      </div>
                   )}
                </div>
             </motion.div>
          ) : activeTab === 'customers' ? (
             <motion.div key="customers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex gap-3 max-w-md">
                   <input className="input-field text-right" placeholder="ابحث برقم الهاتف عن بيانات الزبون أو الصيانة..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)} />
                   <button onClick={async () => {
                     if(!searchPhone) return;
                     setIsSearching(true);
                     try {
                        const q = query(collection(db, 'leads'), where('phone', '==', searchPhone));
                        const snap = await getDocs(q);
                        setSearchResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));

                        // Also search maintenance
                        const mq = query(collection(db, 'maintenanceOrders'), where('customerPhone', '==', searchPhone), orderBy('createdAt', 'desc'));
                        const mSnap = await getDocs(mq);
                        setSearchMaintenance(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
                     } catch (err) {
                        console.error(err);
                     } finally {
                        setIsSearching(false);
                     }
                   }} className="p-4 bg-brand-primary text-navy-950 rounded-xl">{isSearching ? <Loader2 className="animate-spin" /> : <Search />}</button>
                </div>

                {searchMaintenance.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-xl font-black text-white px-3 border-r-4 border-emerald-500">سجل الصيانة المكتشف</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {searchMaintenance.map(order => (
                        <div key={order.id} className="card-glass p-6 group relative overflow-hidden">
                          <div className={`absolute top-0 right-0 w-1.5 h-full ${order.status === 'ready' ? 'bg-emerald-500' : 'bg-brand-primary'}`} />
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="text-[10px] text-white/40 font-mono">#{order.id.slice(-6)}</p>
                              <h5 className="font-black text-white">{order.deviceBrand} {order.deviceModel}</h5>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-white/60"><span>العطل:</span><span className="text-white font-bold">{order.issue}</span></div>
                            <div className="flex justify-between text-white/60"><span>التكلفة:</span><span className="text-brand-primary font-black">{order.cost} ر.ي</span></div>
                            <div className="flex justify-between text-white/60"><span>منذ:</span><span className="text-white/40 font-mono text-[10px]">
                              {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : '---'}
                            </span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                   <h4 className="text-xl font-black text-white px-3 border-r-4 border-brand-primary">بيانات العملاء والنقاط</h4>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(searchResults.length > 0 ? searchResults : leads).map((lead, idx) => (
                         <div key={`${lead.id}-${idx}`} className="card-glass p-4 text-center">
                            <div className="w-12 h-12 bg-navy-950 rounded-full mx-auto flex items-center justify-center text-brand-primary font-black mb-2">{lead.phone.slice(-3)}</div>
                            <p className="text-white font-black text-xs">{lead.phone}</p>
                            <p className="text-brand-primary text-[10px] font-bold">{lead.points || 0} نقطة</p>
                         </div>
                      ))}
                   </div>
                </div>
             </motion.div>
          ) : activeTab === 'customer-chat' ? (
              <motion.div key="customer-chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[600px] text-right">
                 {/* Right Panel: Chats list (4 cols) */}
                 <div className="lg:col-span-4 bg-navy-900/40 border border-white/5 rounded-[2rem] flex flex-col overflow-hidden h-full">
                    <div className="p-5 border-b border-white/5 bg-navy-950/20">
                       <h4 className="text-sm font-black text-white">محادثات العملاء المباشرة</h4>
                       <p className="text-[10px] text-gray-400 mt-1">تواصل مع زوار تطبيق العملاء والزبائن في الوقت الفعلي.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 no-scrollbar">
                       {chats.length === 0 ? (
                          <div className="text-center py-16 text-xs text-gray-500 font-bold">
                             لا توجد محادثات نشطة مع الزبائن حالياً.
                          </div>
                       ) : (
                          chats.map(chat => {
                             const isBlocked = blockedPhones.includes(chat.customerPhone);
                             const isSelected = activeChatPhone === chat.customerPhone;
                             const lastMsg = chat.messages[chat.messages.length - 1];
                             return (
                                <button
                                   key={chat.customerPhone}
                                   onClick={() => handleSelectChat(chat.customerPhone)}
                                   className={`w-full text-right p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                      isSelected
                                         ? 'bg-brand-primary text-navy-950 border-brand-primary shadow-lg shadow-brand-primary/15'
                                         : 'bg-navy-950/40 border-white/5 text-white hover:bg-white/5'
                                   }`}
                                >
                                   <div className="flex items-center gap-3 min-w-0">
                                      <div className="relative shrink-0">
                                         <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-black ${
                                            isSelected ? 'bg-navy-950 text-brand-primary' : 'bg-white/5 text-white/60'
                                         }`}>
                                            {chat.customerPhone.slice(-3)}
                                         </div>
                                         {chat.isOnline && (
                                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-navy-900 rounded-full" />
                                         )}
                                      </div>
                                      <div className="min-w-0">
                                         <h5 className={`font-black text-xs truncate ${isSelected ? 'text-navy-950' : 'text-white'}`}>
                                            {chat.customerName}
                                         </h5>
                                         <p className={`text-[9px] truncate mt-0.5 ${isSelected ? 'text-navy-950/80' : 'text-gray-400'}`}>
                                            {lastMsg ? lastMsg.content : chat.customerPhone}
                                         </p>
                                      </div>
                                   </div>

                                   <div className="flex flex-col items-end gap-1.5 shrink-0">
                                      {chat.unreadCount > 0 && (
                                         <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                            {chat.unreadCount}
                                         </span>
                                      )}
                                      {isBlocked && (
                                         <span className="text-red-500 text-[10px]" title="محظور">🔒</span>
                                      )}
                                   </div>
                                </button>
                             );
                          })
                       )}
                    </div>
                 </div>

                 {/* Left Panel: Active conversation chat (8 cols) */}
                 <div className="lg:col-span-8 bg-navy-900/40 border border-white/5 rounded-[2rem] flex flex-col overflow-hidden h-full relative">
                    {activeChatPhone ? (
                       (() => {
                          const currentChat = chats.find(c => c.customerPhone === activeChatPhone);
                          const isBlocked = blockedPhones.includes(activeChatPhone);
                          // Sent today messages by customer (limit check)
                          const today = new Date();
                          const sentTodayCount = currentChat?.messages.filter((m: any) => {
                             if (!m.isCustomer) return false;
                             if (!m.createdAt) return false;
                             const date = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt.seconds * 1000);
                             return date.getDate() === today.getDate() &&
                                    date.getMonth() === today.getMonth() &&
                                    date.getFullYear() === today.getFullYear();
                          }).length || 0;

                          return (
                             <>
                                {/* Chat Header */}
                                <div className="p-4 bg-navy-950/40 border-b border-white/5 flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/80 font-black">
                                         {activeChatPhone.slice(-3)}
                                      </div>
                                      <div>
                                         <h4 className="text-xs font-black text-white">{currentChat?.customerName || 'زبون غير معروف'}</h4>
                                         <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${currentChat?.isOnline ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                                            <span className="text-[9px] text-gray-400 font-bold">{currentChat?.isOnline ? 'نشط الآن' : 'غير متصل'}</span>
                                            <span className="text-[9px] text-orange-400 font-bold px-2 py-0.5 bg-orange-500/10 rounded font-sans shrink-0 mr-3">
                                               رسائل اليوم للزبون: {sentTodayCount} / 5
                                            </span>
                                         </div>
                                      </div>
                                   </div>

                                   <button
                                      onClick={() => handleToggleBlock(activeChatPhone, isBlocked)}
                                      className={`px-3 py-1.5 rounded-xl font-black text-[10px] transition-all flex items-center gap-1 ${
                                         isBlocked
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                                      }`}
                                   >
                                      {isBlocked ? 'إلغاء الحظر' : 'حظر هذا الزبون'}
                                   </button>
                                </div>

                                {/* Messages History */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar bg-black/15">
                                   {currentChat?.messages.map((msg: any) => {
                                      const isStore = !msg.isCustomer;
                                      return (
                                         <div key={msg.id} className={`flex ${isStore ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] p-4 rounded-2xl text-xs leading-relaxed ${
                                               isStore
                                                  ? 'bg-brand-primary text-navy-950 rounded-br-none font-bold'
                                                  : 'bg-white/5 border border-white/10 text-white rounded-bl-none'
                                            }`}>
                                               {msg.mediaUrl && (
                                                  <div className="mb-2 rounded-lg overflow-hidden border border-white/5 max-w-xs">
                                                     <img src={msg.mediaUrl} alt="Media upload" className="max-h-36 object-cover" />
                                                  </div>
                                               )}
                                               <p className="whitespace-pre-wrap">{msg.content}</p>
                                               <div className="flex items-center justify-end gap-1 mt-1.5 opacity-50 text-[8px] font-mono font-bold">
                                                  <span>
                                                     {msg.createdAt?.seconds 
                                                        ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
                                                        : '...'}
                                                  </span>
                                                  {isStore && (
                                                     msg.read ? (
                                                        <span className="text-[#3b82f6]" title="تمت القراءة">✓✓</span>
                                                     ) : (
                                                        <span className="text-gray-500" title="تم الإرسال">✓</span>
                                                     )
                                                  )}
                                               </div>
                                            </div>
                                         </div>
                                      );
                                   })}
                                   <div ref={chatBottomRef} />
                                </div>

                                {/* Reply Input bar */}
                                <form onSubmit={handleSendReply} className="p-3 bg-navy-950/50 border-t border-white/5 flex gap-2">
                                   <input
                                      type="text"
                                      value={chatReplyText}
                                      onChange={e => setChatReplyText(e.target.value)}
                                      placeholder={isBlocked ? "لا يمكنك الرد على زبون محظور..." : "اكتب ردك للزبون هنا..."}
                                      disabled={isBlocked}
                                      className="flex-1 bg-navy-900 border border-white/10 px-4 py-3.5 rounded-xl text-xs text-white outline-none focus:border-brand-primary disabled:opacity-40 text-right"
                                   />
                                   <button
                                      type="submit"
                                      disabled={!chatReplyText.trim() || isBlocked}
                                      className="px-6 bg-brand-primary text-navy-950 font-black text-xs rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-40 shrink-0"
                                   >
                                      إرسال
                                   </button>
                                </form>
                             </>
                          );
                       })()
                    ) : (
                       <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                          <MessageSquare size={48} className="text-gray-500 animate-pulse" />
                          <p className="text-xs font-black text-gray-500">اختر محادثة زبون من القائمة للبدء بالرد والمتابعة.</p>
                       </div>
                    )}
                 </div>
              </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Publishing Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-navy-950/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="relative w-full max-w-lg bg-navy-900 rounded-[2.5rem] border border-white/10 p-8 shadow-2xl">
               <div className="flex justify-between mb-8">
                  <h3 className="text-xl font-black text-white">
                    {isWholesaler ? (isBulkPublish ? 'نشر جماعي للمخزن' : 'نشر صنف للجملة') : 'إنشاء عرض تجزئة'}
                  </h3>
                  <div className="flex gap-2">
                    {isWholesaler && (
                       <button 
                        onClick={() => setIsBulkPublish(!isBulkPublish)}
                        className="text-[10px] font-black text-brand-primary px-3 py-1 bg-brand-primary/10 rounded-lg"
                       >
                         {isBulkPublish ? 'العودة للصنف الواحد' : 'نشر جماعي بالعشرات'}
                       </button>
                    )}
                    <button onClick={() => setIsModalOpen(false)}><X /></button>
                  </div>
               </div>
               
               {isWholesaler && isBulkPublish ? (
                 <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                       <button 
                        onClick={() => setBulkMode('select')}
                        className={`py-4 rounded-2xl font-black transition-all ${bulkMode === 'select' ? 'bg-orange-500 text-navy-950' : 'bg-white/5 text-white/40'}`}
                       >
                         تحديد أصناف
                       </button>
                       <button 
                        onClick={() => setBulkMode('category')}
                        className={`py-4 rounded-2xl font-black transition-all ${bulkMode === 'category' ? 'bg-orange-500 text-navy-950' : 'bg-white/5 text-white/40'}`}
                       >
                         حسب القسم
                       </button>
                       <button 
                        onClick={() => setBulkMode('all')}
                        className={`py-4 rounded-2xl font-black transition-all ${bulkMode === 'all' ? 'bg-orange-500 text-navy-950' : 'bg-white/5 text-white/40'}`}
                       >
                         الكل
                       </button>
                    </div>

                    {bulkMode === 'select' && (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto p-2 bg-navy-950/50 rounded-2xl">
                        {inventory.map(item => {
                          const isPublished = wholesaleProducts.some(wp => wp.originalItemId === item.id);
                          return (
                            <label key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10">
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={selectedItems.has(item.id)} 
                                  onChange={() => toggleSelectItem(item.id)}
                                  className="w-5 h-5 accent-orange-500"
                                />
                                <div>
                                  <p className="text-sm font-black text-white">{item.name}</p>
                                  <p className="text-[10px] text-white/40">{item.category}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-orange-500">{item.price} ر.ي</p>
                                {isPublished && <span className="text-[9px] bg-success/20 text-success px-1 rounded">منشور</span>}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {bulkMode === 'category' && (
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-white/40 text-right block">اختر القسم لنشر جميع أصنافه</label>
                          <select 
                            className="input-field text-right"
                            value={selectedBulkCategory}
                            onChange={(e) => setSelectedBulkCategory(e.target.value)}
                          >
                             <option value="">-- اختر قسماً --</option>
                             {Array.from(new Set(inventory.map(i => i.category))).filter(Boolean).map(cat => (
                               <option key={cat} value={cat}>{cat}</option>
                             ))}
                          </select>
                       </div>
                    )}

                    <div className="bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20">
                       <p className="text-xs text-orange-500 font-bold leading-relaxed text-right">
                         {bulkMode === 'select' ? `سيتم نشر ${selectedItems.size} صنف مختار.` : 'سيتم سحب الأسعار والكميات الحالية من مخزنك ونشرها في السوق العام فوراً.'}
                       </p>
                    </div>

                    <button 
                      disabled={loading}
                      onClick={handleBulkPublish}
                      className="w-full py-4 bg-orange-500 text-navy-950 rounded-2xl font-black shadow-xl shadow-orange-500/20"
                    >
                      {loading ? <Loader2 className="animate-spin mx-auto" /> : (bulkMode === 'all' ? 'نشر المخزن بالكامل' : 'بدء النشر الجماعي الآن')}
                    </button>
                 </div>
               ) : (
                 <form 
                   onSubmit={async (e) => {
                     e.preventDefault();
                     if (!profile) return;
                     setLoading(true);
                     try {
                        if (isWholesaler) {
                          if (!publishingItem) return;
                          const isStandardTier = profile?.tier_level === 'standard' || !profile?.tier_level;
                          const limit = isStandardTier ? 20 : 100;
                          if (wholesaleProducts.length >= limit) {
                            alert("لقد استنفدت الحد الأقصى المسموح به للصور.");
                            setLoading(false);
                            return;
                          }
                          await addDoc(collection(db, 'wholesaleProducts'), {
                            name: publishingItem.name,
                            description: wholesaleForm.description || '',
                            price: wholesaleForm.price,
                            stock: wholesaleForm.stock,
                            category: publishingItem.category || 'عام',
                            wholesalerId: profile.ownerId,
                            wholesalerName: profile.shopName || profile.name,
                            originalItemId: publishingItem.id,
                            createdAt: serverTimestamp()
                          });
                        } else {
                          // Retail offer
                          const item = inventory.find(i => i.id === publishingItem?.id);
                          if (!item) return;
                          await smartCommerceService.createOffer({
                            itemId: item.id,
                            itemName: item.name,
                            promoPrice: wholesaleForm.price,
                            description: wholesaleForm.description,
                            occasion: 'عرض خاص',
                            originalPrice: item.price,
                            specs: item.specs || {},
                            ownerId: profile.ownerId,
                            endTime: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
                            status: 'active'
                          });
                        }
                        alert('تم النشر بنجاح!');
                        setIsModalOpen(false);
                     } catch (err) {
                        console.error(err);
                        alert('خطأ في النشر');
                     } finally {
                        setLoading(false);
                     }
                   }} 
                   className="space-y-4"
                 >
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-white/40 text-right block">اختيار الصنف من المخزن</label>
                     <select 
                        className="input-field text-right" 
                        required 
                        onChange={e => {
                          const item = inventory.find(i => i.id === e.target.value);
                          if (item) {
                            setPublishingItem(item);
                            setWholesaleForm({ price: item.price, description: '', stock: item.stock });
                          }
                        }}
                      >
                        <option value="">اختر صنفاً...</option>
                        {inventory.map(i => <option key={i.id} value={i.id}>{i.name} (متوفر: {i.stock})</option>)}
                     </select>
                  </div>
                  
                  {publishingItem && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-white/40 text-right block">السعر المعروض</label>
                          <input type="number" required className="input-field text-right" value={wholesaleForm.price} onChange={e => setWholesaleForm({...wholesaleForm, price: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-white/40 text-right block">الكمية للنشر</label>
                          <input type="number" required className="input-field text-right" value={wholesaleForm.stock} onChange={e => setWholesaleForm({...wholesaleForm, stock: Number(e.target.value)})} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-white/40 text-right block">وصف إضافي للمشترين</label>
                        <textarea className="input-field text-right" rows={3} value={wholesaleForm.description} onChange={e => setWholesaleForm({...wholesaleForm, description: e.target.value})} />
                      </div>
                      <button disabled={loading} className={`w-full py-4 text-sm font-black rounded-2xl transition-all ${isWholesaler ? 'bg-orange-500 text-navy-950 shadow-orange-500/20' : 'bg-brand-primary text-navy-950 shadow-brand-primary/20'} shadow-xl`}>
                        {loading ? <Loader2 className="animate-spin mx-auto" /> : 'تأكيد النشر الآن'}
                      </button>
                    </>
                  )}
                 </form>
               )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

