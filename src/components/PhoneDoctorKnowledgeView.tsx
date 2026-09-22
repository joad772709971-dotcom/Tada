import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  AlertTriangle, 
  ShieldAlert, 
  Cpu, 
  Flame, 
  BatteryCharging, 
  Sun, 
  Volume2, 
  WifiOff, 
  Sparkles, 
  Wrench, 
  Stethoscope, 
  Zap, 
  Check, 
  Copy, 
  Share2,
  Info,
  Layers,
  Filter
} from 'lucide-react';
import { PHONE_DOCTOR_KNOWLEDGE_BASE, PhoneDoctorItem } from '../data/phoneDoctorKnowledgeBase';

interface PhoneDoctorKnowledgeViewProps {
  isMerchantView?: boolean;
  onOpenCustomAdviceModal?: () => void;
  customAdvices?: any[];
  onEditCustomAdvice?: (adv: any) => void;
  onDeleteCustomAdvice?: (id: string) => void;
}

export const PhoneDoctorKnowledgeView: React.FC<PhoneDoctorKnowledgeViewProps> = ({
  isMerchantView = false,
  onOpenCustomAdviceModal,
  customAdvices = [],
  onEditCustomAdvice,
  onDeleteCustomAdvice
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const categories = [
    { id: 'all', label: 'الكل (60 معلومة)', icon: Layers, count: 60 },
    { id: 'charging_safety', label: '⚡ تحذيرات أمان الشحن', icon: AlertTriangle, count: 5 },
    { id: 'hardware_fault', label: '🔧 تشخيص أعطال الموبايل', icon: Cpu, count: 4 },
    { id: 'battery', label: '🔋 البطارية والشحن', icon: BatteryCharging, count: 12 },
    { id: 'screen', label: '📱 حماية الشاشة والهيكل', icon: Sparkles, count: 7 },
    { id: 'security', label: '🔒 الأمان والنظام', icon: ShieldAlert, count: 10 },
    { id: 'warning', label: '⚠️ تحذيرات السلامة', icon: Flame, count: 8 },
    { id: 'performance', label: '⚡ الأداء والعناية', icon: Wrench, count: 14 }
  ];

  const filteredItems = useMemo(() => {
    return PHONE_DOCTOR_KNOWLEDGE_BASE.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.title.toLowerCase().includes(q) || 
        item.content.toLowerCase().includes(q) || 
        item.id.toString() === q ||
        item.categoryLabel.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    }).sort((a, b) => a.priority - b.priority);
  }, [selectedCategory, searchQuery]);

  const handleCopy = (item: PhoneDoctorItem) => {
    const textToCopy = `📌 [طبيب الهاتف] #${item.id}: ${item.title}\n${item.content}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d1b2a] to-slate-950 border border-cyan-500/20 p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 left-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold">
              <Stethoscope size={14} className="text-cyan-400" />
              <span>طبيب الهاتف الذكي • الدليل الإرشادي والتحذيرات الشاملة</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              موسوعة الصيانة، تحذيرات الأمان، وتشخيص الأعطال
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              دليل متكامل يضم 60 نصيحة ذهبية، تحذيرات أمان الشحن المباشر والكهرباء، وأسباب الأعطال الهندسية الشائعة وطرق الوقاية منها.
            </p>
          </div>

          {isMerchantView && onOpenCustomAdviceModal && (
            <button
              onClick={onOpenCustomAdviceModal}
              className="px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 rounded-2xl font-black text-sm shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
            >
              <Sparkles size={18} />
              <span>إضافة نصيحة / تنبيه مخصص</span>
            </button>
          )}
        </div>

        {/* Search Input and Live Counter */}
        <div className="mt-6 pt-6 border-t border-white/10 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالنصيحة، العطل، الشاحن، الشاشة، البطارية..."
              className="w-full bg-slate-950/80 border border-white/10 text-white rounded-2xl pr-11 pl-4 py-3 text-xs outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3 text-[10px] text-slate-400 hover:text-white px-2 py-0.5 bg-white/5 rounded-md"
              >
                مسح
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 self-end md:self-auto">
            <Filter size={14} className="text-cyan-400" />
            <span>المعروض: <b className="text-white font-mono">{filteredItems.length}</b> من أصل 60 معلومة</span>
          </div>
        </div>
      </div>

      {/* Category Pills (Filter bar) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20 scale-102'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/5 hover:border-white/10'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-slate-950' : 'text-cyan-400'} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Merchant Custom Advices Section (If any) */}
      {customAdvices.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
            <span>📢 تنبيهات ونصائح مخصصة من المتجر</span>
            <span className="text-xs font-normal text-slate-400">({customAdvices.length})</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customAdvices.map((adv) => (
              <div 
                key={adv.id}
                className="bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 border border-amber-500/30 p-5 rounded-2xl flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      adv.type === 'alert' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {adv.type === 'alert' ? '🚨 تنبيه سلامة خاص' : '💡 نصيحة المتجر'}
                    </span>

                    {isMerchantView && (
                      <div className="flex gap-2">
                        {onEditCustomAdvice && (
                          <button
                            onClick={() => onEditCustomAdvice(adv)}
                            className="text-[10px] px-2 py-0.5 bg-white/5 hover:bg-white/10 text-cyan-400 rounded transition"
                          >
                            تعديل
                          </button>
                        )}
                        {onDeleteCustomAdvice && (
                          <button
                            onClick={() => onDeleteCustomAdvice(adv.id)}
                            className="text-[10px] px-2 py-0.5 bg-white/5 hover:bg-rose-500/20 text-rose-400 rounded transition"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <h4 className="text-base font-black text-white mb-1.5">{adv.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{adv.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid of 60 Knowledge Base Cards */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/40 border border-white/5 rounded-3xl">
          <Info size={40} className="mx-auto text-slate-500 mb-3" />
          <p className="text-sm font-bold text-slate-400">لم يتم العثور على نصائح مطابقة لكلمات البحث</p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
            className="mt-3 text-xs text-cyan-400 hover:underline"
          >
            عرض كافة النصائح والتحذيرات
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredItems.map((item) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`relative group bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 border rounded-2xl p-4.5 transition-all duration-300 hover:shadow-xl hover:border-cyan-500/30 flex flex-col justify-between gap-3.5 ${
                  item.category === 'charging_safety' 
                    ? 'border-rose-500/30 hover:border-rose-500/50 bg-rose-950/10' 
                    : item.category === 'hardware_fault'
                    ? 'border-cyan-500/30 hover:border-cyan-500/50 bg-cyan-950/10'
                    : 'border-white/5'
                }`}
              >
                <div>
                  {/* Top Bar: Badge, ID, and Copy button */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        #{item.id}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopy(item)}
                      title="نسخ النصيحة"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition flex items-center gap-1 text-[10px] cursor-pointer"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400 font-bold">تم النسخ</span>
                        </>
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>

                  {/* Main Content Area: Mini Image + Title & Description */}
                  <div className="flex items-start gap-3.5">
                    {/* Small compact illustrative image */}
                    <div className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-slate-950 group-hover:border-cyan-500/40 transition-colors shadow-inner">
                      <img
                        src={item.image}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          // Fallback to placeholder if offline
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent pointer-events-none" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-cyan-300 transition-colors leading-snug mb-1">
                        {item.title}
                      </h4>
                      <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed font-sans">
                        {item.content}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom category tag */}
                <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="text-slate-400 font-bold">{item.categoryLabel}</span>
                  <span className="text-slate-600">طبيب الهاتف 🩺</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default PhoneDoctorKnowledgeView;
