import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Video, Trash2, PlusCircle, MonitorPlay, Clapperboard, Sparkles, Film, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface ReelsManagerProps {
  profile?: UserProfile | any;
}

interface PromoVideo {
  id: string;
  title: string;
  videoUrl: string;
  storeId?: string;
  store_id?: string;
  createdAt?: any;
}

export default function ReelsManager({ profile }: ReelsManagerProps) {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<PromoVideo[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isDark = profile?.visualTheme !== 'light';
  const storeId = localStorage.getItem('CURRENT_STORE_ID') || profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';

  useEffect(() => {
    if (!storeId) return;

    // Real-time listener for current store reels with strict multi-tenant isolation
    const currentStoreId = localStorage.getItem('CURRENT_STORE_ID') || storeId;
    const q = query(
      collection(db, 'promo_videos'),
      where('store_id', '==', currentStoreId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vids: PromoVideo[] = [];
      snapshot.forEach(docSnap => {
        vids.push({ id: docSnap.id, ...docSnap.data() } as PromoVideo);
      });
      // Sort by creation date
      vids.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA; // Newest first
      });
      setVideos(vids);
    }, (err) => {
      console.error("Error loading promo videos:", err);
      setError("فشل تحميل العروض المرئية.");
    });

    return () => unsubscribe();
  }, [storeId]);

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) {
      setError("الرجاء إدخال العنوان ورابط الفيديو.");
      return;
    }

    // Basic URL validation
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      setError("يجب أن يبدأ رابط الفيديو بـ http:// أو https://");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        store_id: storeId,
        storeId: storeId,
        title: newTitle.trim(),
        videoUrl: newUrl.trim(),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'promo_videos'), payload);
      setNewTitle('');
      setNewUrl('');
      setSuccess("تمت إضافة عرض الفيديو الترويجي بنجاح!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error adding video:", err);
      setError("فشل حفظ العرض: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVideo = async (videoId: string, title: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف العرض "${title}" نهائياً؟`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'promo_videos', videoId));
      setSuccess("تم حذف عرض الفيديو بنجاح.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error deleting promo video:", err);
      setError("فشل حذف الفيديو من الخادم.");
    }
  };

  // Helper to get video provider representation
  const getProviderBadge = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return { label: 'YouTube', color: 'bg-red-500/10 text-red-500 border-red-500/20' };
    }
    if (url.includes('vimeo.com')) {
      return { label: 'Vimeo', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
    }
    return { label: 'Direct MP4 / Web', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  };

  return (
    <div id="reels-manager-root" className={`min-h-screen p-4 md:p-8 font-sans ${isDark ? 'bg-[#0b1329] text-white' : 'bg-slate-50 text-slate-900'}`} dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Breadcrumbs & Visual Welcome */}
        <div id="reels-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs md:text-sm">
              <Clapperboard size={14} className="animate-spin text-amber-400" />
              <span>نظام العروض التفاعلية الذكي</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              إدارة العروض المرئية <span className="text-amber-400">Reels</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              ارفع ووجه عروض فيديو لزبائنك تظهر في واجهة المحل كعروض متتابعة وجذابة.
            </p>
          </div>
          
          <button 
            id="back-to-dashboard-btn"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/5 transition-all text-sm self-start"
          >
            <span>لوحة التحكم الرئيسية</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Status Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-xs md:text-sm font-bold flex items-center gap-2"
            >
              <span>⚠️</span>
              <p>{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs md:text-sm font-bold flex items-center gap-2"
            >
              <Sparkles size={16} className="text-emerald-400 animate-pulse" />
              <p>{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Right: Upload Section */}
          <div className="lg:col-span-1">
            <div className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-200'} shadow-xl space-y-6`}>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <PlusCircle size={18} className="text-amber-500" />
                  <span>إضافة فيديو جديد</span>
                </h2>
                <p className="text-xs text-slate-400">املاً الحقول لحفظ رابط الفيديو بالمتجر حياً.</p>
              </div>

              <form onSubmit={handleAddVideo} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">عنوان العرض المرئي (مثال: استعراض آيفون 15)</label>
                  <input 
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="اكتب عنواناً جذاباً وقصيراً..."
                    className="w-full px-4 py-3 bg-black/40 border border-white/5 hover:border-amber-500/30 focus:border-amber-500 rounded-xl text-white outline-none transition-all text-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">رابط الفيديو المباشر (MP4, YouTube, Vimeo)</label>
                  <input 
                    type="url"
                    required
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://example.com/video.mp4"
                    className="w-full px-4 py-3 bg-black/40 border border-white/5 hover:border-amber-500/30 focus:border-amber-500 rounded-xl text-white outline-none transition-all text-sm font-medium text-left"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    * يفضل استخدام روابط فيديو MP4 مباشرة من استضافة سحابية سريعة لتجربة مستخدم مثالية.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 text-slate-950 font-black rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-500/10"
                >
                  {isLoading ? 'جاري الحفظ والرفع...' : (
                    <>
                      <Video size={16} />
                      <span>نشر العرض المرئي حياً 🚀</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Left: Interactive Reels Grid & Preview */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Film size={18} className="text-amber-500" />
                <span>العروض المعروضة للزبائن ({videos.length})</span>
              </h2>
            </div>

            {videos.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center space-y-4">
                <span className="text-4xl text-slate-500">🎬</span>
                <div className="space-y-1">
                  <p className="font-bold text-white text-base">لا توجد عروض ترويجية نشطة</p>
                  <p className="text-xs text-slate-400">ابدأ بإضافة أول فيديو ترويجي لزيادة تفاعل العملاء وتنشيط المبيعات!</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {videos.map((vid) => {
                  const badge = getProviderBadge(vid.videoUrl);
                  return (
                    <div 
                      key={vid.id}
                      className="p-4 rounded-3xl border border-white/5 bg-slate-900/40 hover:bg-slate-900/70 transition-all duration-300 flex flex-col justify-between space-y-4 group relative overflow-hidden shadow-md"
                    >
                      {/* Video Preview Container */}
                      <div className="relative w-full aspect-video rounded-2xl bg-black/60 overflow-hidden border border-white/5 flex items-center justify-center">
                        {vid.videoUrl.match(/\.(mp4|webm|ogg)/i) ? (
                          <video 
                            src={vid.videoUrl} 
                            controls 
                            className="w-full h-full object-cover" 
                            preload="metadata"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-center p-4 space-y-2">
                            <MonitorPlay size={36} className="text-amber-400 mx-auto animate-pulse" />
                            <span className="text-[10px] text-slate-400 block break-all font-mono px-2">{vid.title}</span>
                          </div>
                        )}
                        <span className={`absolute top-2 right-2 px-2.5 py-1 text-[9px] font-black tracking-wider uppercase border rounded-md ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Header & Delete Button */}
                      <div className="flex items-start justify-between gap-4 mt-2">
                        <div className="space-y-1 flex-1">
                          <h4 className="font-bold text-white text-sm line-clamp-2 leading-relaxed">{vid.title}</h4>
                          <span className="text-[10px] text-slate-400 font-mono block break-all" dir="ltr">{vid.videoUrl}</span>
                        </div>
                        
                        <button
                          onClick={() => handleDeleteVideo(vid.id, vid.title)}
                          className="p-2.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/10 hover:border-rose-500/30 text-rose-500 rounded-xl transition-all self-end"
                          title="حذف هذا الفيديو"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
