import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gavel, Clock, Trophy, Users, Info, TrendingUp, DollarSign, Tag, MapPin, Phone, ShoppingBag, Globe } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Auction, Bid, Lead } from '../types';
import { smartCommerceService } from '../services/smartCommerceService';

export default function LiveAuction({ lead, ownerId }: { lead: Lead | null; ownerId: string }) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [bids, setBids] = useState<Record<string, Bid[]>>({});
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [publicAuctions, setPublicAuctions] = useState<any[]>([]);
  const [globalMarketplaceItems, setGlobalMarketplaceItems] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'global' | 'store'>('global');

  // Load Global Marketplace listings
  useEffect(() => {
    const currentStoreId = localStorage.getItem('CURRENT_STORE_ID') || ownerId;
    const qGlobal = query(
      collection(db, 'global_marketplace'),
      where('active', '==', true),
      where('store_id', '==', currentStoreId),
      limit(50)
    );
    const unsubGlobal = onSnapshot(qGlobal, (snap) => {
      const items: any[] = [];
      snap.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      // Sort items by createdAt if available
      setGlobalMarketplaceItems(items.sort((a, b) => {
        const aT = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const bT = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return bT - aT;
      }));
    }, (error) => {
      console.warn("⚠️ Firestore info: error reading global_marketplace:", error.message);
      setGlobalMarketplaceItems([]);
    });

    return () => unsubGlobal();
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    const pq = ownerId === 'global'
      ? query(collection(db, 'public_auctions'), limit(50))
      : query(collection(db, 'public_auctions'), where('storeId', '==', ownerId));
    const unsubPublic = onSnapshot(pq, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPublicAuctions(list.sort((a,b) => {
        const aT = a.createdAt?.seconds || 0;
        const bT = b.createdAt?.seconds || 0;
        return bT - aT;
      }));
    });
    return unsubPublic;
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;

    let systemConfig: any = null;
    const unsubConfig = onSnapshot(doc(db, 'system', 'config'), (configSnap) => {
      if (configSnap.exists()) {
        systemConfig = configSnap.data();
      }
    });

    const q = ownerId === 'global' 
      ? query(collection(db, 'auctions'), where('status', '==', 'active'), limit(20))
      : query(collection(db, 'auctions'), where('ownerId', '==', ownerId), where('status', '==', 'active'));

    const unsub = onSnapshot(q, (snap) => {
      const activeAuctions = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Auction))
        .filter(auc => {
          if (systemConfig?.suspendAllAuctions) return false;
          if (systemConfig?.auctionsApprovalRequired && auc.moderationStatus !== 'approved') return false;
          return auc.moderationStatus !== 'hidden' && auc.moderationStatus !== 'suspended';
        });
      setAuctions(activeAuctions);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'auctions');
      setLoading(false);
    });

    return () => {
      unsubConfig();
      unsub();
    };
  }, [ownerId]);

  useEffect(() => {
    const unsubs = auctions.map(auction => {
      const bq = query(
        collection(db, 'bids'),
        where('auctionId', '==', auction.id),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      return onSnapshot(bq, (snap) => {
        setBids(prev => ({
          ...prev,
          [auction.id]: snap.docs.map(d => ({ id: d.id, ...d.data() } as Bid))
        }));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'bids');
      });
    });

    return () => unsubs.forEach(u => u());
  }, [auctions]);

  const handleBid = async (auction: Auction) => {
    if (!lead) {
      alert('يرجى تسجيل الدخول أولاً للمزايدة');
      return;
    }

    const minRequired = (auction.currentPrice || 0) + (auction.minStep || 0);
    if (bidAmount < minRequired) {
      alert(`أقل مزايدة مقبولة هي ${minRequired}`);
      return;
    }

    try {
      await smartCommerceService.placeBid({
        auctionId: auction.id,
        ownerId: auction.ownerId, // Use the specific auction's owner
        amount: bidAmount,
        bidderName: lead?.name || lead?.phone || 'عميل مجهول',
        bidderPhone: lead?.phone || ''
      });
      setBidAmount(0);
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) return null;

  if (auctions.length === 0 && publicAuctions.length === 0 && globalMarketplaceItems.length === 0) {
    return (
      <div className="text-center py-20 bg-navy-900/40 border-2 border-white/5 rounded-[2.5rem] p-8 space-y-4">
        <Gavel className="text-royal-gold/40 mx-auto animate-bounce" size={48} />
        <h4 className="text-xl font-bold text-white">لا توجد لوائح حراج أو مزادات متوفرة حالياً</h4>
        <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed font-bold">تفضل بزيارة لوحة العميل VIP بانتظام لمتابعة المزادات الحية والمنتجات الحصرية المصادرة بأسعار تشجيعية.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 overflow-hidden text-right">
      
      {/* 🌐 Modern Sub-Segment Navigation Tab */}
      <div className="flex bg-[#001122]/60 p-2.5 rounded-[2rem] border-2 border-white/5 max-w-md mx-auto gap-2">
        <button
          onClick={() => setActiveSubTab('global')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${activeSubTab === 'global' ? 'bg-royal-gold text-deep-navy shadow-lg shadow-royal-gold/15 scale-[1.02]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <Globe size={14} className={activeSubTab === 'global' ? 'animate-spin-slow' : ''} />
          <span>شبكة الحراج العام الموحد</span>
        </button>

        <button
          onClick={() => setActiveSubTab('store')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${activeSubTab === 'store' ? 'bg-royal-gold text-deep-navy shadow-lg shadow-royal-gold/15 scale-[1.02]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <ShoppingBag size={14} />
          <span>مزادات وعروض المحل</span>
        </button>
      </div>

      {activeSubTab === 'global' && (
        <div className="space-y-6 pt-4 text-right animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 flex-row-reverse justify-start">
            <div className="p-3 bg-royal-gold/10 rounded-2xl text-royal-gold">
              <Globe size={24} className="animate-spin-slow" />
            </div>
            <div className="text-right">
              <h3 className="text-xl font-black text-white px-2">الحراج العام والتبادلات البينية</h3>
              <p className="text-xs text-royal-gold px-2">البورصة الرقمية الموحدة لتبادل وتصفية الهواتف الذكية ومصادرات B2B</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2">
            {globalMarketplaceItems.map((item) => (
              <div
                key={item.id}
                className="bg-navy-900 border border-white/5 rounded-2xl overflow-hidden flex flex-col justify-between text-right relative group shadow-md max-h-[480px]"
              >
                <div>
                  <div className="w-full h-28 md:h-36 bg-slate-950/40 rounded-lg p-1.5 overflow-hidden border border-white/5 relative flex items-center justify-center">
                    <img
                      referrerPolicy="no-referrer"
                      src={item.images?.[0] || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=500'}
                      alt={item.title}
                      className="max-h-full max-w-full object-contain transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2 z-10 flex gap-1 flex-row-reverse">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-royal-gold text-deep-navy">
                        صفقة مشتركة
                      </span>
                    </div>
                  </div>

                  <div className="p-3 text-right space-y-1">
                    <h4 className="text-sm font-bold text-white group-hover:text-royal-gold transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-gray-400 line-clamp-1 leading-normal">
                      {item.description || 'لا توجد تفاصيل إضافية مضافة.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-1 justify-start flex-row-reverse border-t border-white/5 pt-1.5">
                      {item.storeName && (
                        <div className="flex items-center gap-0.5 bg-white/5 py-0.5 px-2 rounded-full text-[9px] font-bold text-royal-gold">
                          <ShoppingBag size={8} />
                          <span>{item.storeName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 border-t border-white/5 bg-black/20 flex flex-col items-stretch gap-2">
                  <div className="text-right flex justify-between items-baseline">
                    <span className="text-[8px] text-gray-500 font-extrabold uppercase tracking-wider">المطلوب:</span>
                    <strong className="text-xs md:text-sm font-bold text-royal-gold tabular-nums font-mono">
                      {(Number(item.price) || 0).toLocaleString()}{' '}
                      <span className="text-[8px] text-royal-gold font-normal">ر.ي</span>
                    </strong>
                  </div>

                  <a
                    href={`tel:${item.phone || '772315106'}`}
                    className="w-full py-1.5 bg-gradient-to-r from-royal-gold to-gold-glow text-deep-navy rounded-lg text-[10px] font-bold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Phone size={10} />
                    <span>اطلب</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
          {globalMarketplaceItems.length === 0 && (
            <div className="text-center py-16 bg-white/5 rounded-[2.5rem] border border-white/5 p-6">
              <Globe className="text-gray-500 mx-auto animate-pulse mb-3" size={32} />
              <p className="text-xs text-gray-400 font-bold">يجري تحديث قائمة الحراج العام المشترك الآن...</p>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'store' && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* SECTION 1: LIVE BIDDABLE AUCTIONS */}
          {auctions.length > 0 && (
            <div className="space-y-6 text-right">
              <div className="flex items-center gap-3 flex-row-reverse">
                <div className="p-3 bg-red-500/10 rounded-2xl text-red-500 animate-pulse">
                  <Gavel size={24} />
                </div>
                <div className="text-right">
                  <h3 className="text-xl font-black text-white">المزادات المباشرة الجارية</h3>
                  <p className="text-xs text-red-400">تفاعل حي ومزايدة تفاعلية بالثانية</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {auctions.map(auction => {
                  const auctionBids = bids[auction.id] || [];
                  const getAuctionDate = (ts: any) => {
                    if (!ts) return new Date();
                    if (typeof ts.toDate === 'function') return ts.toDate();
                    if (ts.seconds) return new Date(ts.seconds * 1000);
                    return new Date(ts);
                  };
                  const endTime = getAuctionDate(auction.endTime);
                  const timeRemaining = endTime.getTime() - Date.now();
                  const isEndingSoon = timeRemaining < 3600000; // less than 1 hour

                  return (
                    <motion.div 
                      key={auction.id}
                      layout
                      className="bg-navy-900 border-2 border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-4">
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isEndingSoon ? 'bg-red-500 text-white animate-pulse' : 'bg-royal-gold/20 text-royal-gold border border-royal-gold/30'}`}>
                          <Clock size={12} />
                          {isEndingSoon ? 'يوشك على الانتهاء' : 'مزاد جاري'}
                        </div>
                      </div>

                      <div className="mb-6 pt-8">
                        {auction.category && (
                          <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-lg text-[10px] font-black mb-2 inline-block">
                            {auction.category}
                          </span>
                        )}
                        <h4 className="text-2xl font-black text-white mb-2 text-right">{auction.title}</h4>
                        <p className="text-sm text-gray-400 text-right line-clamp-2">{auction.description}</p>
                        {auction.details && <p className="text-[10px] text-gray-500 text-right mt-2 border-t border-white/5 pt-2">{auction.details}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white/5 rounded-3xl p-4 border border-white/10 text-center">
                          <p className="text-[10px] text-gray-400 font-bold mb-1 col-span-2">السعر الحالي</p>
                          <p className="text-2xl font-black text-royal-gold tabular-nums">{(auction.currentPrice ?? 0).toLocaleString()}</p>
                          <p className="text-[8px] text-royal-gold/50">ريال يمني</p>
                        </div>
                        <div className="bg-white/5 rounded-3xl p-4 border border-white/10 text-center">
                          <p className="text-[10px] text-gray-400 font-bold mb-1 col-span-2">المزايد الأخير</p>
                          <p className="text-sm font-black text-white truncate px-2">{auction.highestBidderName || '—'}</p>
                          <p className="text-[8px] text-gray-450">{auction.highestBidderPhone ? `...${auction.highestBidderPhone.slice(-4)}` : 'في انتظار أول مزايد'}</p>
                        </div>
                      </div>

                      {/* Bidding History Mini List */}
                      <div className="space-y-2 mb-6 text-right">
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[10px] text-gray-400 font-bold">آخر المزايدات</span>
                          <TrendingUp size={12} className="text-royal-gold" />
                        </div>
                        <AnimatePresence mode="popLayout">
                          {auctionBids.map((bid, i) => (
                            <motion.div 
                              key={bid.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex items-center justify-between p-3 rounded-2xl text-xs font-bold border ${i === 0 ? 'bg-royal-gold/10 border-royal-gold/30 text-royal-gold' : 'bg-white/5 border-transparent text-gray-400'}`}
                            >
                              <span className="tabular-nums">{(bid.amount ?? 0).toLocaleString()} ر.ي</span>
                              <span className="truncate max-w-[100px]">{bid.bidderName}</span>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {auctionBids.length === 0 && (
                          <p className="text-[10px] text-gray-400 text-center py-2 italic font-bold">كن أول من يضع بصمته في هذا المزاد!</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input 
                          type="number"
                          placeholder={`أضف ${auction.minStep}+`}
                          className="w-1/3 bg-white/5 border border-white/10 rounded-2xl px-4 text-center font-bold text-white outline-none focus:border-royal-gold transition-all"
                          value={bidAmount || ''}
                          onChange={(e) => setBidAmount(Number(e.target.value))}
                        />
                        <button 
                          onClick={() => handleBid(auction)}
                          className="flex-1 py-4 bg-royal-gold text-deep-navy font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-gold-glow shadow-[0_10px_30px_rgba(212,175,55,0.2)] active:scale-95 transition-all cursor-pointer"
                        >
                          <DollarSign size={18} />
                          مزايدة الآن
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: PUBLIC GENERAL AUCTIONS & DEALS */}
          {publicAuctions.length > 0 && (
            <div className="space-y-6 pt-4 text-right">
              <div className="flex items-center gap-3 flex-row-reverse">
                <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 font-bold">
                  <Gavel size={24} />
                </div>
                <div className="text-right">
                  <h3 className="text-xl font-black text-white">الحراج والمنشورات العامة للمحل</h3>
                  <p className="text-xs text-amber-400">بضائع، لوطات، تصفية عروض، ومصادرات المتجر المتاحة للطلب</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2">
                {publicAuctions.map((auc) => (
                  <div
                    key={auc.id}
                    className="bg-navy-900 border border-white/5 rounded-2xl overflow-hidden flex flex-col justify-between text-right max-h-[460px] shadow-md"
                  >
                    <div>
                      <div className="w-full h-28 md:h-36 bg-slate-950/40 rounded-lg p-1.5 overflow-hidden border border-white/5 relative flex items-center justify-center">
                        <img
                          referrerPolicy="no-referrer"
                          src={auc.images?.[0] || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=500'}
                          alt={auc.title}
                          className="max-h-full max-w-full object-contain"
                        />
                        <div className="absolute top-2 right-2">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${auc.type === 'client_view' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-slate-950'}`}>
                            {auc.type === 'client_view' ? 'حراج' : 'لوط تصفية'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 text-right space-y-1">
                        <h4 className="text-sm font-bold text-white truncate">{auc.title}</h4>
                        <p className="text-[10px] text-gray-400 line-clamp-1 leading-normal">{auc.description || 'لا توجد تفاصيل إضافية مضافة.'}</p>
                      </div>
                    </div>

                    <div className="p-3 border-t border-white/5 bg-black/15 flex flex-col items-stretch gap-2">
                      <div className="text-right flex justify-between items-baseline">
                        <span className="text-[8px] text-gray-500 font-extrabold text-right uppercase tracking-wider">المطلوب:</span>
                        <strong className="text-xs md:text-sm font-bold text-amber-500 tabular-nums">{(Number(auc.price) || 0).toLocaleString()} <span className="text-[8px] text-amber-100 font-normal">ر.ي</span></strong>
                      </div>
                      
                      <a
                        href={`tel:${auc.phone || '777000000'}`}
                        className="w-full py-1.5 bg-[#0b1126] hover:bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>اترك طلباً</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {auctions.length === 0 && publicAuctions.length === 0 && (
            <div className="text-center py-20 bg-navy-900/40 border-2 border-white/5 rounded-[2.5rem] p-8 space-y-4">
              <Gavel className="text-royal-gold/40 mx-auto animate-bounce" size={48} />
              <h4 className="text-xl font-bold text-white">لا توجد لوائح حراج أو مزادات خاصة بالمتجر متوفرة حالياً</h4>
              <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">يرجى الانتقال لتبويب "شبكة الحراج العام الموحد" لمتابعة المنتجات والصفقات العامة المشتركة بين المتاجر الشريكة.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
