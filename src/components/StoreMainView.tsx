import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMockData } from '../context/MockDataContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  Gavel, 
  Activity, 
  Search, 
  Gift, 
  ArrowRight, 
  Phone, 
  MapPin, 
  Clock, 
  Coins, 
  CheckCircle, 
  AlertTriangle, 
  Sparkles,
  Send,
  Zap,
  TrendingUp,
  Award,
  Plus,
  Video,
  Heart,
  Volume2,
  VolumeX,
  Share2,
  Play,
  Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EntertainmentHub from './EntertainmentHub';
import PhoneDoctorKnowledgeView from './PhoneDoctorKnowledgeView';

function getEmbeddingUrl(url: string) {
  if (!url) return '';
  url = url.trim();
  
  // 1. YouTube
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&controls=1&loop=1&playlist=${ytMatch[1]}`;
  }

  // 2. Vimeo
  const vimeoRegex = /(?:vimeo\.com\/)(?:video\/)?([0-9]+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1&loop=1`;
  }

  return url;
}

interface StoreMainViewProps {
  storeId: string;
  onBackToPortal: () => void;
  currentUser: any;
  onLoginTrigger: () => void;
}

type TabType = 'auction' | 'doctor' | 'tracker' | 'giveaways' | 'entertainment' | 'reels';

export default function StoreMainView({ storeId, onBackToPortal, currentUser, onLoginTrigger }: StoreMainViewProps) {
  const navigate = useNavigate();
  const [isPromoVideoEnabled, setIsPromoVideoEnabled] = useState(false);
  const [promoVideos, setPromoVideos] = useState<any[]>([]);

  // Promo video listeners
  useEffect(() => {
    if (!storeId) return;
    const checkPromoFlag = async () => {
      try {
        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (storeDoc.exists()) {
          setIsPromoVideoEnabled(!!storeDoc.data().is_promo_video_enabled);
        } else {
          const userDoc = await getDoc(doc(db, 'users', storeId));
          if (userDoc.exists()) {
            setIsPromoVideoEnabled(!!userDoc.data().is_promo_video_enabled);
          }
        }
      } catch (e) {
        console.error("Error loading promo video flag in main view:", e);
      }
    };
    checkPromoFlag();

    // Setup real-time listener for current store reels with strict multi-tenant isolation
    const currentStoreId = localStorage.getItem('CURRENT_STORE_ID') || storeId;
    const qVideos = query(
      collection(db, 'promo_videos'),
      where('store_id', '==', currentStoreId)
    );
    const unsubscribe = onSnapshot(qVideos, (snapshot) => {
      const vids: any[] = [];
      snapshot.forEach(docSnap => {
        vids.push({ id: docSnap.id, ...docSnap.data() });
      });
      vids.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      setPromoVideos(vids);
    }, (error) => {
      console.error("Error loading customer reels feed:", error);
    });

    return () => unsubscribe();
  }, [storeId]);
  const {
    activeStore,
    auctions,
    repairPrices,
    repairs,
    giveaways,
    bidActivities,
    placeBidLocally,
    joinGiveawayLocally,
    searchTicketLocally,
    checkImeiLocally
  } = useMockData();

  const [activeTab, setActiveTab] = useState<TabType>('auction');

  // Interactive Countdown state
  // We want to calculate a real-time TICK for all auctions
  const [timeRemaining, setTimeRemaining] = useState<{ [id: string]: string }>({});

  // Bidding states
  const [customBidAmount, setCustomBidAmount] = useState<{ [id: string]: number }>({});
  const [successBidMessages, setSuccessBidMessages] = useState<{ [id: string]: string }>({});
  const [errorBidMessages, setErrorBidMessages] = useState<{ [id: string]: string }>({});
  const [explodingBidId, setExplodingBidId] = useState<string | null>(null);

  // IMEI check state inside operations area
  const [storeImeiInput, setStoreImeiInput] = useState('');
  const [storeImeiResult, setStoreImeiResult] = useState<any>(null);
  const [storeImeiLoading, setStoreImeiLoading] = useState(false);

  // Maintenance Tracker states
  const [ticketNoInput, setTicketNoInput] = useState('');
  const [searchedTicket, setSearchedTicket] = useState<any>(null);
  const [trackerError, setTrackerError] = useState('');
  const [trackerLoading, setTrackerLoading] = useState(false);

  // Giveaways states
  const [joinedGivs, setJoinedGivs] = useState<{ [id: string]: boolean }>({});

  // Reels social states
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [likesCount, setLikesCount] = useState<{ [id: string]: number }>({});
  const [muted, setMuted] = useState(true);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});

  const handleLikeReel = (reelId: string) => {
    setLikesCount(prev => ({
      ...prev,
      [reelId]: (prev[reelId] || 0) + 1
    }));

    // Spawn floating heart elements at random lower positions
    const newHearts = Array.from({ length: 5 }).map(() => ({
      id: Date.now() + Math.random(),
      x: Math.floor(Math.random() * 80) + 10, // random percentage X offset
      y: Math.floor(Math.random() * 20) + 60, // random percentage Y offset
    }));

    setFloatingHearts(prev => [...prev, ...newHearts]);

    // Cleanup heart widgets after 1s
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => !newHearts.some(nh => nh.id === h.id)));
    }, 1000);
  };

  const handleShareReel = (reel: any) => {
    const shareLink = reel.videoUrl || reel.url || window.location.href;
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopiedId(reel.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  // Repair catalogue search state
  const [catalogSearch, setCatalogSearch] = useState('');

  // 1. Live Countdown Clock ticking every 1 second
  useEffect(() => {
    const updateCountdowns = () => {
      const formatMap: { [id: string]: string } = {};
      auctions.forEach(auc => {
        const timeDiff = new Date(auc.endsAt).getTime() - Date.now();
        if (timeDiff <= 0) {
          formatMap[auc.id] = 'الحراج منتهي ⏱️';
          return;
        }

        const totalSecs = Math.floor(timeDiff / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        const pad = (num: number) => String(num).padStart(2, '0');
        formatMap[auc.id] = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
      });
      setTimeRemaining(formatMap);
    };

    updateCountdowns(); // first call immediately
    const ticker = setInterval(updateCountdowns, 1000);
    return () => clearInterval(ticker);
  }, [auctions]);

  if (!activeStore) {
    return (
      <div className="max-w-md mx-auto px-4 py-32 text-center" dir="rtl" id="store-loading-screen">
        <div className="inline-block w-8 h-8 border-4 border-amber-500/10 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-semibold text-xs">جاري التعرف والاتصال بالهوية المحددة والمزادات المشتركة...</p>
      </div>
    );
  }

  // Active Store palettes
  const primaryColor = activeStore.primaryColor || '#fbbf24';
  const customStoreStyles = {
    color: primaryColor,
    borderColor: `${primaryColor}40`,
    backgroundColor: `${primaryColor}10`
  };

  // Submit Bid Locally with glorious micro-animation trigger
  const triggerPlaceBid = (auctionId: string, amount: number) => {
    setSuccessBidMessages(prev => ({ ...prev, [auctionId]: '' }));
    setErrorBidMessages(prev => ({ ...prev, [auctionId]: '' }));

    if (!currentUser) {
      setErrorBidMessages(prev => ({ ...prev, [auctionId]: 'الرجاء تسجيل الدخول أولاً كعضو VIP لتتمكن من تقديم عروض حية.' }));
      return;
    }

    const res = placeBidLocally(auctionId, amount, currentUser.displayName || currentUser.email || 'أنت (متسابق)');
    if (res.success) {
      setExplodingBidId(auctionId);
      setTimeout(() => setExplodingBidId(null), 1000);
      setSuccessBidMessages(prev => ({ ...prev, [auctionId]: res.message }));
      setCustomBidAmount(prev => ({ ...prev, [auctionId]: 0 }));
    } else {
      setErrorBidMessages(prev => ({ ...prev, [auctionId]: res.message }));
    }
  };

  // Quick Addition Bidding Button helper
  const handleQuickIncrement = (auc: any, increment: number) => {
    const nextAmount = auc.currentBid + increment;
    triggerPlaceBid(auc.id, nextAmount);
  };

  // Submit Giveaway entry
  const triggerJoinGiveaway = (givId: string) => {
    const ok = joinGiveawayLocally(givId);
    if (ok) {
      setJoinedGivs(prev => ({ ...prev, [givId]: true }));
    }
  };

  // Submit check IMEI locally
  const handleStoreImeiCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeImeiInput.trim()) return;
    setStoreImeiLoading(true);
    setStoreImeiResult(null);
    setTimeout(() => {
      const res = checkImeiLocally(storeImeiInput);
      setStoreImeiResult(res);
      setStoreImeiLoading(false);
    }, 800);
  };

  // Search local repair ticket code
  const handleLocalTicketSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setTrackerError('');
    setSearchedTicket(null);

    const cleanNo = ticketNoInput.trim().toUpperCase();
    if (!cleanNo) {
      setTrackerError('الرجاء كتابة رقم الفاتورة أو الصيانة.');
      return;
    }

    setTrackerLoading(true);
    setTimeout(() => {
      const match = searchTicketLocally(cleanNo);
      if (match) {
        setSearchedTicket(match);
      } else {
        setTrackerError(`لا تتوفر تذكرة بهذا الرقم حالياً لـ ${activeStore.name}. يرجى محاكاة رقم صحيح مثل: ${storeId === 'al-fuji' ? 'JAM-2001' : storeId === 'shammari' ? 'JAM-3001' : 'JAM-9999'}`);
      }
      setTrackerLoading(false);
    }, 700);
  };

  // Filter Repair Prices catalogue
  const filteredCatalog = repairPrices.filter(rp => 
    rp.device.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    rp.issue.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 py-4 text-right selection:bg-amber-500/20 selection:text-amber-300" dir="rtl" id="store-app-main">
      
      
      <div className="flex items-center justify-between mb-5" id="store-top-bar">
        <button 
          onClick={onBackToPortal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/5 bg-[#071324] hover:bg-slate-900 transition rounded-xl text-xs font-bold text-slate-300 cursor-pointer"
          id="back-to-portal-btn"
        >
          <ArrowRight className="w-4 h-4 text-amber-500" />
          <span>العودة للمنصة الرئيسية</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] text-slate-400 font-mono">طراز مخصص {primaryColor}</span>
        </div>
      </div>

      
      <div 
        className="bg-gradient-to-br from-[#0b1424]/90 via-[#040e1b] to-[#02050b] border border-white/[0.04] rounded-3xl overflow-hidden shadow-2xl p-6 mb-6 flex flex-col md:flex-row gap-6 relative"
        id="store-hero-banner"
      >
        <div className="absolute top-4 left-4 bg-amber-500/5 text-amber-500 border border-amber-500/10 text-[9px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
          {activeStore.id} VIP Partner
        </div>

        
        <div className="flex items-center gap-4 flex-1">
          <div 
            className="w-16 h-16 rounded-2xl bg-[#030914] border-2 flex items-center justify-center p-0.5 overflow-hidden shadow-xl"
            style={{ borderColor: primaryColor }}
          >
            <img src={activeStore.logoUrl} alt={activeStore.name} className="w-full h-full object-cover rounded-xl" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest block mb-0.5" style={{ color: primaryColor }}>
              مجموعات هويات JAM ومزادات الـ VIP
            </span>
            <h1 className="text-xl md:text-2xl font-black text-white">{activeStore.name}</h1>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">{activeStore.description}</p>
          </div>
        </div>

        
        <div className="border-t md:border-t-0 md:border-r border-white/[0.05] pt-4 md:pt-0 md:pr-6 flex flex-col justify-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-mono">{activeStore.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="line-clamp-1">{activeStore.address}</span>
          </div>
        </div>
      </div>

      
      <div className={`flex overflow-x-auto sm:overflow-x-visible no-scrollbar sm:grid ${isPromoVideoEnabled ? 'sm:grid-cols-6' : 'sm:grid-cols-5'} gap-1.5 bg-[#051125] border border-white/[0.04] p-1.5 rounded-2xl mb-8 max-w-full flex-nowrap`} id="store-tabs">
        {[
          { key: 'auction', label: 'حراج ومزاد حي', icon: Gavel },
          { key: 'doctor', label: 'طبيب الأعطال', icon: Activity },
          { key: 'tracker', label: 'تتبع الصيانة', icon: Search },
          { key: 'giveaways', label: 'القرعة والجوائز', icon: Gift },
          ...(isPromoVideoEnabled ? [{ key: 'reels', label: 'عروض الفيديو Reels', icon: Video }] : []),
          { key: 'entertainment', label: 'صالة الترفيه', icon: Sparkles }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`flex-shrink-0 flex flex-row items-center justify-center gap-1.5 py-2.5 px-4 sm:px-0 rounded-xl text-xs font-black transition-all cursor-pointer ${
                isSelected 
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-extrabold shadow' 
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
              }`}
              id={`tab-btn-${tab.key}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="inline whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="min-h-96"
          id="tab-view-content"
        >
          
          {activeTab === 'auction' && (
            <div id="panel-auctions" className="space-y-6">
              
              
              <div className="flex justify-between items-center bg-[#071324]/60 border border-white/[0.04] p-4 rounded-2xl">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500 animate-bounce" />
                    <span>مزايدات الحراج الحي الفاخر</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">متر التنازل والتصادم مستمر مباشرة وثواني. زايد بذكاء لتفوز بالصفقة.</p>
                </div>
                
                <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-1.5 rounded-full font-bold animate-pulse">
                  🔴 المزاد متصل ومباشر
                </span>
              </div>

              {auctions.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/45 border border-white/[0.05] rounded-3xl">
                  <Gavel className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-400 text-xs font-bold">لا تتوفر مزادات نشطة لدى المتجر حالياً.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {auctions.map((auc) => {
                    const requiredMin = auc.currentBid + auc.minIncrement;
                    const remainingStr = timeRemaining[auc.id] || 'جلب المتر...';
                    const isExploding = explodingBidId === auc.id;

                    return (
                      <div 
                        key={auc.id}
                        className={`bg-gradient-to-br from-[#0c1c38]/90 to-[#040e1c] border-2 rounded-2xl overflow-hidden transition-all flex flex-col justify-between h-full ${
                          isExploding ? 'border-amber-500 scale-[1.01]' : 'border-white/[0.04]'
                        }`}
                        id={`auction-card-${auc.id}`}
                      >
                        <div className="p-5">
                          
                          
                          <div className="flex gap-4">
                            <div className="w-20 h-20 rounded-xl bg-slate-900 overflow-hidden relative border border-white/5 shrink-0">
                              <img src={auc.imageUrl} alt={auc.title} className="w-full h-full object-cover" />
                              <div className="absolute bottom-1 right-1 bg-black/70 text-[8px] font-bold text-amber-400 px-1 py-0.5 rounded">
                                {auc.id.substring(0, 8).toUpperCase()}
                              </div>
                            </div>
                            
                            <div className="flex-1 text-right">
                              <div className="flex justify-between items-start gap-1">
                                <span className="inline-block px-2 py-0.5 bg-amber-500/15 text-amber-400 font-bold rounded text-[8px] tracking-wider font-sans mb-1 animate-pulse">
                                  🔴 مزاد حي نشط
                                </span>
                                
                                <span className="text-[10px] text-yellow-500 font-bold font-mono bg-[#030a15] border border-yellow-500/20 px-2 py-0.5 rounded">
                                  {remainingStr}
                                </span>
                              </div>
                              <h3 className="font-extrabold text-sm text-white line-clamp-1">{auc.title}</h3>
                              <p className="text-[10.5px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{auc.description}</p>
                            </div>
                          </div>

                          
                          <div className="grid grid-cols-2 gap-3 mt-4 bg-slate-950/80 p-3 rounded-2xl border border-white/[0.04]">
                            <div>
                              <span className="text-[9px] text-slate-500 block font-bold">المتصدر الحالي</span>
                              <span className="text-white font-extrabold text-xs block mt-1 truncate">
                                👤 {auc.highestBidder || 'لا يوجد مزايد'}
                              </span>
                            </div>
                            <div className="text-left font-mono">
                              <span className="text-[9px] text-slate-500 block font-bold text-right">أعلى سومه</span>
                              <span className="text-amber-400 text-base font-black tracking-tight block mt-0.5">
                                {auc.currentBid.toLocaleString()} <span className="text-[9.5px] font-sans mr-0.5 text-slate-400">ر.س</span>
                              </span>
                            </div>
                          </div>

                          
                          <div className="mt-4 pt-4 border-t border-white/[0.03]">
                            {currentUser ? (
                              <div className="space-y-3">
                                <div className="text-[10.5px] font-bold text-slate-400">مزايدة كبس سريعة بفروقات معتمدة:</div>
                                
                                
                                <div className="grid grid-cols-3 gap-2">
                                  {[50, 100, 200].map(inc => (
                                    <button
                                      key={inc}
                                      onClick={() => handleQuickIncrement(auc, inc)}
                                      className="py-1.5 bg-[#0e2142] border border-white/[0.04] hover:bg-[#132c58] hover:border-amber-500/30 text-white hover:text-amber-400 font-bold text-xs rounded-xl active:scale-95 transition"
                                    >
                                      +{inc} ر.س
                                    </button>
                                  ))}
                                </div>

                                <div className="flex gap-2 items-center mt-3">
                                  <input 
                                    type="number" 
                                    defaultValue={requiredMin}
                                    placeholder={`رقم مخصص >= ${requiredMin}`}
                                    className="flex-1 bg-slate-950/80 border border-white/[0.06] text-amber-400 font-mono text-center text-xs py-2 rounded-xl outline-none"
                                    id={`custom-input-${auc.id}`}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setCustomBidAmount(prev => ({ ...prev, [auc.id]: val }));
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      const inputAmt = customBidAmount[auc.id] || requiredMin;
                                      triggerPlaceBid(auc.id, inputAmt);
                                    }}
                                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 rounded-xl font-black text-xs transition"
                                  >
                                    مزايد لـ VIP
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-[#030a15] border border-white/[0.05] p-3 rounded-xl text-center">
                                <p className="text-[10px] text-slate-400 mb-2">يحتاج المنافسة تقديم عرضك للتسجيل بالمنظومة.</p>
                                <button
                                  onClick={() => navigate(`/store/${storeId}/login`)}
                                  className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-lg text-[10px]"
                                >
                                  دخول نظام المزايدين VIP
                                </button>
                              </div>
                            )}

                            
                            <AnimatePresence>
                              {successBidMessages[auc.id] && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg p-2.5 text-[10.5px] mt-2.5"
                                >
                                  {successBidMessages[auc.id]}
                                </motion.div>
                              )}
                              {errorBidMessages[auc.id] && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="bg-red-500/10 border border-red-500/30 text-rose-300 rounded-lg p-2.5 text-[10.5px] mt-2.5"
                                >
                                  ⚠️ {errorBidMessages[auc.id]}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                        </div>

                        
                        <div className="bg-[#040e1b]/40 border-t border-white/[0.04] px-5 py-2.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>الحد الأدنى للزيادة: {auc.minIncrement} ر.س</span>
                          <span>ينتهي المزاد في: {new Date(auc.endsAt).toLocaleDateString('ar-SA')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              
              <div className="bg-gradient-to-br from-[#071324] to-[#030914] border border-white/[0.04] p-5 rounded-2xl">
                <h3 className="font-extrabold text-sm text-yellow-500 flex items-center gap-1.5 mb-3">
                  <TrendingUp className="w-4 h-4" />
                  <span>لوحة السجل المباشر للمزايدات بالشبكة</span>
                </h3>
                <div className="space-y-2 h-36 overflow-y-auto pr-1">
                  {bidActivities.map((act) => (
                    <div key={act.id} className="bg-black/35 border border-white/[0.03] p-2.5 rounded-xl flex justify-between items-center text-[11px] font-sans">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                        <span className="text-slate-300 truncate max-w-[120px]">👤 {act.bidder}</span>
                        <span className="text-slate-500">قدم أعلى سومة على</span>
                        <span className="text-amber-400 font-bold line-clamp-1 max-w-[120px]">{act.itemName}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-yellow-500 font-bold font-mono">{act.amount.toLocaleString()} ر.س</span>
                        <span className="text-slate-500 text-[10px] block font-mono">{act.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          
          {activeTab === 'doctor' && (
            <div id="panel-doctor" className="space-y-8">
              {/* Phone Doctor 60 Tips & Warnings Encyclopedia */}
              <PhoneDoctorKnowledgeView isMerchantView={false} />

              {/* Maintenance & Parts Catalog */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <div className="bg-[#071324]/60 border border-white/[0.04] p-5 rounded-2xl">
                  <h2 className="text-base font-black text-white">كتالوج أسعار الصيانة والقطع بالفرع</h2>
                  <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">
                    تصفح طرازات الصيانة، كشوف وتكاليف تبديل الشاشات التالفة والبطاريات وأعطال الشحن بأسعار معتمدة ودقة هندسية عالية بالفرع المختار.
                  </p>

                  
                  <div className="relative">
                    <input 
                      type="text" 
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="ابحث بموديل جوالك أو نوع العطل (مثال: شاشة، بطارية، آيفون)..." 
                      className="w-full bg-slate-950/80 border border-white/[0.06] text-white rounded-xl pr-10 pl-4 py-2.5 text-xs outline-none focus:border-cyan-500/50"
                    />
                    <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                  </div>
                </div>

                {filteredCatalog.length === 0 ? (
                  <div className="text-center py-12 bg-[#030a15] border border-white/[0.03] rounded-2xl text-slate-500 text-xs">
                    عذراً، لم يتوفر كشوفات توافق كلمات البحث في كتالوج الفرع الحالي.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredCatalog.map((rp) => (
                      <div 
                        key={rp.id}
                        className="bg-gradient-to-br from-[#071324] to-[#030914] border border-white/[0.04] hover:border-cyan-500/20 transition p-5 rounded-xl flex justify-between items-center"
                      >
                        <div>
                          <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 font-bold rounded text-[9px] font-sans">
                            📱 {rp.device}
                          </span>
                          <h4 className="font-extrabold text-sm text-white mt-1.5">{rp.issue}</h4>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">الموعد الزمني المقدر: {rp.timeEstimated}</div>
                        </div>

                        <div className="text-left font-mono shrink-0">
                          <span className="text-[9px] text-slate-500 block">تكلفة شاملة</span>
                          <span className="text-cyan-400 font-black text-base tracking-tight">{rp.price}</span>
                          <span className="text-[11px] text-slate-500 mr-0.5">ر.س</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          
          {activeTab === 'tracker' && (
            <div id="panel-tracker" className="max-w-xl mx-auto space-y-6">
              
              <div className="bg-[#071324]/60 border border-white/[0.04] p-5 rounded-2xl">
                <h2 className="text-base font-black text-white mb-1">تتبع تذكرة صيانة وهندسة الموبايل</h2>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  فضلاً دون رقم التذكرة المتواجدة على فاتورتك بالفرع لتتبع مراحل تشخيص وعمل مهندس الصيانة حتى التسليم والقبض.
                </p>

                <form onSubmit={handleLocalTicketSearch} className="flex gap-2">
                  <input 
                    type="text" 
                    value={ticketNoInput}
                    onChange={(e) => setTicketNoInput(e.target.value)}
                    placeholder="رقم تذكرة الصيانة (مثال: JAM-2001)"
                    className="flex-1 bg-slate-950/80 border border-white/[0.06] text-amber-500 font-mono text-center tracking-widest uppercase rounded-xl px-3 text-xs outline-none focus:border-amber-500/50"
                  />
                  <button
                    type="submit"
                    disabled={trackerLoading}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-xl text-xs hover:brightness-110 active:scale-95 transition"
                  >
                    {trackerLoading ? 'جاري الفحص...' : 'استعلام'}
                  </button>
                </form>

                {trackerError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-rose-400 text-[11px] p-2.5 rounded-xl font-bold mt-4 text-center">
                    ⚠️ {trackerError}
                  </div>
                )}
              </div>

              
              {searchedTicket && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-br from-[#0c1c38] to-[#040e1c] border border-amber-500/20 rounded-2xl p-5 shadow-2xl relative"
                  id="ticket-details-box"
                >
                  <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -z-10"></div>
                  
                  <div className="flex justify-between items-center border-b border-white/[0.04] pb-4 mb-4 font-sans">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">كود ورقم الفاتورة</span>
                      <span className="text-base font-extrabold font-mono tracking-widest text-white leading-none">{searchedTicket.ticketNumber}</span>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="text-[9px] text-slate-400 block font-bold">الحالة العامة</span>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black tracking-tight mt-1 ${
                        searchedTicket.status === 'ready' ? 'bg-emerald-500/15 text-emerald-300' :
                        searchedTicket.status === 'repairing' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-slate-500/15 text-slate-300'
                      }`}>
                        {searchedTicket.status === 'ready' ? '✅ جاهز للتسليم الفوري' : '⏳ قيد الإصلاح الميكانيكي'}
                      </span>
                    </div>
                  </div>

                  
                  <div className="flex justify-between items-center px-4 py-5 mb-5 bg-black/45 rounded-xl relative overflow-hidden">
                    <div className="absolute top-[48%] left-8 right-8 h-[2px] bg-white/[0.06] -translate-y-[50%] z-0" />
                    
                    {[
                      { key: 'pending', label: 'كشف وفحص' },
                      { key: 'repairing', label: 'صيانة فنية' },
                      { key: 'ready', label: 'تسليم وقبض' }
                    ].map((step, idx) => {
                      const stages = ['pending', 'repairing', 'ready', 'delivered'];
                      const currentIdx = stages.indexOf(searchedTicket.status);
                      const targetIdx = stages.indexOf(step.key);
                      const isActive = currentIdx >= targetIdx;

                      return (
                        <div key={step.key} className="relative z-10 flex flex-col items-center">
                          <div 
                            className={`w-7 h-7 rounded-full flex items-center justify-center border text-[11px] font-black font-mono transition-all ${
                              isActive ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black border-transparent shadow' : 'bg-[#020712] border-white/5 text-slate-500'
                            }`}
                          >
                            {isActive ? '✓' : idx + 1}
                          </div>
                          <span className="text-[9.5px] font-bold mt-2 text-slate-400 block">{step.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-3.5 text-xs text-slate-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-500 block">صاحب الهاتف الكريم</span>
                        <span className="font-extrabold text-white">{searchedTicket.customerName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">الجهاز للهواتف</span>
                        <span className="font-extrabold text-white">{searchedTicket.device}</span>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.03] pt-3">
                      <span className="text-[10px] text-slate-500 block">العطل المطلوب إصلاحه</span>
                      <span>{searchedTicket.issue}</span>
                    </div>

                    {searchedTicket.notes && (
                      <div className="bg-white/[0.01] border-r-4 border-amber-500/40 p-3 rounded-l-xl text-[11px] text-slate-400">
                        <span className="font-bold text-white block mb-0.5">ملاحظات فني الصيانة:</span>
                        {searchedTicket.notes}
                      </div>
                    )}

                    <div className="border-t border-white/[0.03] pt-3 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-slate-500 block">التكلفة النهائية شاملة القطعة</span>
                        <span className="text-yellow-400 font-black text-lg font-mono">{searchedTicket.cost}</span>
                        <span className="text-slate-500 text-xs mr-0.5">ر.س</span>
                      </div>
                    </div>
                  </div>

                </motion.div>
              )}

            </div>
          )}

          
          {activeTab === 'giveaways' && (
            <div id="panel-giveaways" className="space-y-6">
              
              <div className="bg-[#071324]/60 border border-white/[0.04] p-5 rounded-2xl">
                <h2 className="text-base font-black text-white">بوابة ولاء الزبائن: القرعات والسحوبات المفتوحة</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  تمنحك العضوية VIP القدرة على حجز أرقام الدخول التلقائي في السحوبات مجاناً والاستفادة من نقاطك لترقية حسابك بالفرع.
                </p>
              </div>

              {giveaways.length === 0 ? (
                <div className="text-center py-16 bg-[#030a15] border border-white/[0.03] rounded-2xl text-slate-500 text-xs">
                  لا تتوفر سحوبات جوائز نشطة حالياً لدى الفرع.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {giveaways.map((giv) => {
                    const hasJoined = joinedGivs[giv.id];
                    return (
                      <div 
                        key={giv.id} 
                        className="bg-gradient-to-br from-[#0c1c38] to-[#040e1c] border border-white/[0.04] p-5 rounded-2xl flex flex-col justify-between"
                        id={`giveaway-card-${giv.id}`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">القرعة الكبرى</span>
                            <span className="text-[10px] text-slate-500 font-bold">⏰ سحب مباشر</span>
                          </div>

                          <h3 className="font-extrabold text-sm text-white mb-1">{giv.title}</h3>
                          <p className="text-[10.5px] text-slate-400 mb-4 h-12 leading-relaxed overflow-hidden line-clamp-3">{giv.description}</p>

                          <div className="bg-slate-950/80 p-3 rounded-xl border border-white/[0.03] mb-4">
                            <span className="text-[9px] text-slate-500 block">محتوى الجائزة للفائز</span>
                            <span className="text-white text-xs font-black mt-1 block">🏆 {giv.prize}</span>
                          </div>
                        </div>

                        <div>
                          {currentUser ? (
                            hasJoined ? (
                              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-2.5 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                                <span>تم الحجز للدخول بنجاح! +50 نقطة</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => triggerJoinGiveaway(giv.id)}
                                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-xl text-xs hover:brightness-110 active:scale-95 transition"
                              >
                                اضغط لحجز رقمك مجاناً بالقرعة
                              </button>
                            )
                          ) : (
                            <div className="bg-[#030a15] border border-white/[0.04] p-3 rounded-xl text-center">
                              <p className="text-[10px] text-slate-400 mb-2">تسجيل دخولك يمنحك تأكيد الحجز فورا بكود المنظومة.</p>
                              <button
                                onClick={() => navigate(`/store/${storeId}/login`)}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-lg text-[9.5px]"
                              >
                                دخول فوري لحجز الجائزة
                              </button>
                            </div>
                          )}

                          <div className="border-t border-white/[0.03] pt-3 mt-4 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                            <span>عدد البطاقات المحجوزة: {giv.participantsCount}</span>
                            <span>تاريخ السحب: {new Date(giv.endsAt).toLocaleDateString('ar-SA')}</span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          
          {activeTab === 'reels' && isPromoVideoEnabled && (
            <div id="panel-reels" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <Video className="text-amber-500" />
                    عروض متجري المرئية (Reels)
                  </h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">تابع أحدث إعلانات وعروض من ممثلي المتجر بالفيديو التفاعلي</p>
                </div>
              </div>

              {promoVideos.length === 0 ? (
                <div className="text-center py-20 bg-[#030a15] border border-white/[0.03] rounded-2xl text-slate-500 text-xs">
                  لا تتوفر عروض مرئية Reels حالياً لدى المتجر.
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
                  
                  
                  <div className="hidden lg:flex flex-col gap-3 max-h-[500px] overflow-y-auto w-64 pr-2">
                    <span className="text-[10px] font-black text-amber-500 block">العروض المتوفرة ({promoVideos.length})</span>
                    {promoVideos.map((vid, idx) => (
                      <button
                        key={vid.id}
                        onClick={() => setActiveReelIndex(idx)}
                        className={`p-3.5 rounded-2xl text-right transition border text-xs font-black ${
                          activeReelIndex === idx 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow' 
                          : 'bg-black/35 text-slate-400 border-white/[0.02] hover:text-white hover:bg-white/[0.01]'
                        }`}
                      >
                        <span className="block truncate">{vid.title}</span>
                        <span className="block text-[8px] font-sans font-normal text-slate-500 mt-1">Reel #{idx + 1}</span>
                      </button>
                    ))}
                  </div>

                  
                  <div className="relative w-full max-w-[360px] aspect-[9/16] bg-slate-950 rounded-[2.5rem] border-4 border-slate-800 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col justify-between">
                    
                    
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-slate-900 rounded-full z-30 flex items-center justify-center">
                      <div className="w-12 h-1 bg-slate-800 rounded-full"></div>
                      <div className="w-2.5 h-2.5 bg-blue-950 rounded-full ml-1 border border-blue-900"></div>
                    </div>

                    
                    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                      {floatingHearts.map((h) => (
                        <motion.div
                          key={h.id}
                          initial={{ opacity: 1, scale: 0.5, y: '80%' }}
                          animate={{ opacity: 0, scale: 1.5, y: '20%', x: `${h.x - 30}px` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className="absolute text-rose-500 text-3xl"
                          style={{ left: `${h.x}%`, bottom: '15%' }}
                        >
                          ❤️
                        </motion.div>
                      ))}
                    </div>

                    
                    <div className="absolute inset-0 bg-[#020612] flex items-center justify-center z-10 p-4 text-center">
                      {(() => {
                        const activeReel = promoVideos[activeReelIndex];
                        if (!activeReel) return null;
                        const srcUrl = activeReel.videoUrl || activeReel.url || '';

                        if (videoErrors[activeReel.id] || !srcUrl.trim().startsWith('http')) {
                          return (
                            <div className="flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
                              <Video size={40} className="text-amber-500 animate-bounce" />
                              <h3 className="text-xs font-black">تعذر تشغيل العرض كمقطع مرئي مباشر</h3>
                              <p className="text-[10px] text-gray-400 max-w-xs leading-relaxed font-bold">
                                قد يكون الرابط عبارة عن صفحة ويب أو يحتاج إلى تشغيل خارجي. يمكنك فتح الرابط مباشرة لمشاهدة العرض.
                              </p>
                              <a 
                                href={srcUrl || '#'} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 rounded-xl text-[10px] font-black text-white transition-all shadow-lg cursor-pointer"
                              >
                                مشاهدة العرض بالخارج 🌐
                              </a>
                            </div>
                          );
                        }

                        const embedding = getEmbeddingUrl(srcUrl);
                        const isIframe = embedding.includes('youtube.com') || embedding.includes('player.vimeo.com');

                        if (isIframe) {
                          return (
                            <iframe 
                              className="w-full h-full pointer-events-auto"
                              src={embedding} 
                              allow="autoplay; encrypted-media" 
                              allowFullScreen 
                              referrerPolicy="no-referrer"
                              title={activeReel.title}
                            />
                          );
                        } else {
                          // direct mp4 player
                          return (
                            <video 
                              key={srcUrl}
                              src={srcUrl} 
                              className="w-full h-full object-cover"
                              controls
                              autoPlay
                              loop
                              muted={muted}
                              playsInline
                              onError={() => setVideoErrors(prev => ({ ...prev, [activeReel.id]: true }))}
                            />
                          );
                        }
                      })()}
                    </div>

                    
                    {!(promoVideos[activeReelIndex]?.videoUrl || promoVideos[activeReelIndex]?.url || '').includes('youtube.com') && !(promoVideos[activeReelIndex]?.videoUrl || promoVideos[activeReelIndex]?.url || '').includes('vimeo.com') && (
                      <button 
                        onClick={() => setMuted(!muted)}
                        className="absolute top-12 right-4 bg-black/40 hover:bg-black/60 p-2.5 rounded-full text-white transition-all z-20 cursor-pointer"
                      >
                        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                    )}

                    
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/40 to-transparent p-5 pt-16 text-right text-xs z-20 pointer-events-none">
                      <div className="pointer-events-auto flex flex-col gap-2 max-w-[80%]">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span className="text-white font-extrabold text-[13px]">{activeStore.name}</span>
                        </div>
                        <h4 className="text-amber-100 font-bold text-xs truncate leading-snug">{promoVideos[activeReelIndex]?.title}</h4>
                      </div>
                    </div>

                    
                    <div className="absolute right-4 bottom-16 flex flex-col gap-4 z-25 text-center pointer-events-auto">
                      <button
                        onClick={() => handleLikeReel(promoVideos[activeReelIndex].id)}
                        className="w-10 h-10 bg-black/50 hover:bg-black/70 border border-white/10 rounded-full flex items-center justify-center text-white transition active:scale-90"
                      >
                        <Heart size={18} className="text-rose-500 fill-rose-500" />
                      </button>
                      <span className="text-[10px] text-white font-mono font-bold -mt-3.5 bg-black/30 rounded px-1 self-center">
                        {likesCount[promoVideos[activeReelIndex].id] || 0}
                      </span>

                      <button
                        onClick={() => handleShareReel(promoVideos[activeReelIndex])}
                        className="w-10 h-10 bg-black/50 hover:bg-black/70 border border-white/10 rounded-full flex items-center justify-center text-white transition active:scale-90"
                      >
                        <Share2 size={18} className="text-blue-400" />
                      </button>
                      <span className="text-[9px] text-white -mt-3 text-center self-center bg-black/30 px-1 rounded truncate">
                        {copiedId === promoVideos[activeReelIndex].id ? 'تم النسخ!' : 'مشاركة'}
                      </span>
                    </div>

                    
                    <div className="absolute bottom-4 left-4 flex gap-2 z-25 pointer-events-auto">
                      <button
                        disabled={activeReelIndex === 0}
                        onClick={() => setActiveReelIndex(prev => prev - 1)}
                        className="px-3.5 py-1.5 bg-black/60 hover:bg-black/80 border border-white/10 rounded-xl text-white text-[10px] font-black transition disabled:opacity-30 disabled:pointer-events-none"
                      >
                        ▲ السابق
                      </button>
                      <button
                        disabled={activeReelIndex === promoVideos.length - 1}
                        onClick={() => setActiveReelIndex(prev => prev + 1)}
                        className="px-3.5 py-1.5 bg-black/60 hover:bg-black/80 border border-white/10 rounded-xl text-white text-[10px] font-black transition disabled:opacity-30 disabled:pointer-events-none"
                      >
                        التالي ▼
                      </button>
                    </div>

                  </div>

                </div>
              )}
            </div>
          )}

          
          {activeTab === 'entertainment' && (
            <div id="panel-entertainment" className="flex justify-center">
              <EntertainmentHub />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
