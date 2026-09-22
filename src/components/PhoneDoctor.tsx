import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Stethoscope, ChevronRight, ChevronLeft, CreditCard, Clock, CheckCircle2, History, Loader2, Zap, BookOpen, Wrench, Sparkles } from 'lucide-react';
import { smartCommerceService } from '../services/smartCommerceService';
import { InventoryItem, Lead } from '../types';
import PhoneDoctorKnowledgeView from './PhoneDoctorKnowledgeView';

interface DiagnosisStep {
  id: string;
  question: string;
  options: { label: string; nextStep?: string; partId?: string; laborFee: number }[];
}

const DIAGNOSIS_FLOW: DiagnosisStep[] = [
  {
    id: 'start',
    question: 'ما هي المشكلة الأساسية في جهازك؟',
    options: [
      { label: 'كسر في الشاشة', nextStep: 'screen_type', laborFee: 1500 },
      { label: 'مشكلة في الشحن', nextStep: 'charging_type', laborFee: 2000 },
      { label: 'مشكلة في الصوت', nextStep: 'audio_issue', laborFee: 1500 },
      { label: 'مشكلة في الكاميرا', nextStep: 'camera_issue', laborFee: 2500 },
      { label: 'سوفت وير / تعليق', nextStep: 'software_issue', laborFee: 3000 },
      { label: 'الجهاز لا يعمل تماماً', nextStep: 'dead_check', laborFee: 3000 },
      { label: 'مشكلة في الشبكة', partId: 'network_chip', laborFee: 2500 }
    ]
  },
  {
    id: 'audio_issue',
    question: 'ما هو الجزء المتضرر في الصوت؟',
    options: [
      { label: 'سماعة الأذن (ضعيفة/مبحة)', partId: 'ear_speaker', laborFee: 1000 },
      { label: 'السبيكر الخارجي', partId: 'loud_speaker', laborFee: 1200 },
      { label: 'المايك (الآخرين لا يسمعونني)', partId: 'microphone', laborFee: 1500 }
    ]
  },
  {
    id: 'camera_issue',
    question: 'أي كاميرا معطلة؟',
    options: [
      { label: 'الكاميرا الخلفية (اهتزاز أو سواد)', partId: 'rear_camera', laborFee: 2000 },
      { label: 'الكاميرا الأمامية / فيس آي دي', partId: 'front_camera', laborFee: 3000 },
      { label: 'زجاج الكاميرا الخارجي مكسور', partId: 'camera_glass', laborFee: 1500 }
    ]
  },
  {
    id: 'software_issue',
    question: 'ما هي حالة التعليق؟',
    options: [
      { label: 'واقف على الشعار (تفاحة/أندرويد)', partId: 'flashing', laborFee: 3000 },
      { label: 'نسيت رمز القفل / الآيكلاود', partId: 'unlocking', laborFee: 5000 },
      { label: 'الذاكرة ممتلئة ويحتاج تهيئة', partId: 'format', laborFee: 2000 }
    ]
  },
  {
    id: 'screen_type',
    question: 'هل اللمس يعمل أم معطل؟',
    options: [
      { label: 'اللمس يعمل والكسر خارجي', partId: 'glass_only', laborFee: 2500 },
      { label: 'اللمس معطل تماماً', partId: 'screen_assembly', laborFee: 1500 }
    ]
  },
  {
    id: 'charging_type',
    question: 'ما هي حالة الشحن؟',
    options: [
      { label: 'قاعدة الشحن مكسورة', partId: 'charging_port', laborFee: 1000 },
      { label: 'البطارية لا تشحن', nextStep: 'battery_check', laborFee: 1000 },
      { label: 'لا يشحن سريعاً', nextStep: 'battery_check', laborFee: 1000 }
    ]
  },
  {
    id: 'battery_check',
    question: 'هل البطارية منتفخة أو نسبتها تقل بسرعة؟',
    options: [
      { label: 'نعم، أحتاج استراحة بطارية', partId: 'battery', laborFee: 800 },
      { label: 'لا، فقط لا يشحن', partId: 'charging_ic', laborFee: 3000 }
    ]
  },
  {
    id: 'dead_check',
    question: 'كيف توقف الجهاز؟',
    options: [
      { label: 'سقط في الماء', partId: 'water_clean', laborFee: 5000 },
      { label: 'توقف فجأة أثناء الاستخدام', partId: 'power_ic', laborFee: 4000 },
      { label: 'سقوط قوي', partId: 'cpu_reball', laborFee: 8000 }
    ]
  }
];

export default function PhoneDoctor({ lead, ownerId, inventory, tips = [] }: { lead: Lead | null; ownerId: string; inventory: InventoryItem[]; tips?: any[] }) {
  const [activeDoctorTab, setActiveDoctorTab] = useState<'knowledge' | 'interactive'>('knowledge');
  const [currentStep, setCurrentStep] = useState('start');
  const [history, setHistory] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<{ part?: InventoryItem; labor: number } | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [selectedTip, setSelectedTip] = useState<any>(null);

  const handleOption = (option: any) => {
    if (option.nextStep) {
      setHistory([...history, currentStep]);
      setCurrentStep(option.nextStep);
    } else if (option.partId) {
      const part = inventory.find(i => 
        i.name.toLowerCase().includes(option.partId.toLowerCase()) || 
        i.barcode?.includes(option.partId)
      );
      setEstimate({ part, labor: option.laborFee });
    }
  };

  const handleBook = async () => {
    if (!lead || !estimate) return;
    setIsBooking(true);
    try {
      await smartCommerceService.createBooking({
        ownerId,
        leadId: lead.id,
        customerName: lead.name,
        customerPhone: lead.phone,
        itemId: estimate.part?.id || 'manual_service',
        itemName: estimate.part?.name || 'خدمة صيانة مشخصة',
        promoPrice: (estimate.part?.price || 0) + estimate.labor
      });
      setBookingSuccess(true);
    } catch (err) {
      console.error('Booking error:', err);
      alert('حدث خطأ أثناء الحجز');
    } finally {
      setIsBooking(false);
    }
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setCurrentStep(prev);
    setEstimate(null);
  };

  const step = DIAGNOSIS_FLOW.find(s => s.id === currentStep);

  if (bookingSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-10 text-center space-y-6 backdrop-blur-xl"
      >
        <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(34,197,94,0.2)]">
          <CheckCircle2 size={40} />
        </div>
        <h3 className="text-2xl font-black text-white">تم استلام طلب الصيانة بنجاح!</h3>
        <p className="text-slate-300 font-bold leading-relaxed px-6">
          لقد تم تسجيل موعد صيانة تقديري. سنتواصل معك قريباً لتأكيد الموعد واستلام الجهاز في الفرع.
        </p>
        <button 
          onClick={() => { setBookingSuccess(false); setEstimate(null); setCurrentStep('start'); setActiveDoctorTab('knowledge'); }}
          className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold transition-all text-white cursor-pointer"
        >
          العودة لطبيب الهاتف
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top View Selector Buttons */}
      <div className="flex items-center justify-center gap-3 p-1.5 bg-slate-900/90 border border-white/10 rounded-2xl max-w-lg mx-auto shadow-lg">
        <button
          onClick={() => setActiveDoctorTab('knowledge')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeDoctorTab === 'knowledge'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen size={16} />
          <span>موسوعة النصائح والتحذيرات (60)</span>
        </button>

        <button
          onClick={() => setActiveDoctorTab('interactive')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeDoctorTab === 'interactive'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Stethoscope size={16} />
          <span>الفحص التفاعلي وحجز الصيانة</span>
        </button>
      </div>

      {activeDoctorTab === 'knowledge' ? (
        <PhoneDoctorKnowledgeView
          isMerchantView={false}
          customAdvices={tips}
        />
      ) : (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400 border border-cyan-500/20">
                <Stethoscope size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">طبيب الهاتف الذكي • الفحص التفاعلي</h3>
                <p className="text-xs text-slate-400">شخص عطل جهازك خطوة بخطوة واحصل على سعر تقديري معتمد</p>
              </div>
            </div>

            {history.length > 0 && !estimate && (
              <button 
                onClick={goBack}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5"
              >
                <span>السابق</span>
                <ChevronLeft size={16} />
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!estimate ? (
              <motion.div 
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 pt-4 border-t border-white/10"
              >
                <h4 className="text-lg font-bold text-cyan-300 mb-6 text-right leading-relaxed">
                  {step?.question}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {step?.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleOption(opt)}
                      className="flex items-center justify-between p-4 bg-slate-950/60 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-2xl transition-all group text-right cursor-pointer"
                    >
                      <ChevronLeft size={18} className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-all" />
                      <span className="font-bold text-white group-hover:text-cyan-300">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center p-6 bg-gradient-to-br from-cyan-950/30 to-slate-950 border border-cyan-500/30 rounded-3xl"
              >
                <div className="w-16 h-16 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/30">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-xl font-black text-white mb-2">التشخيص والتقرير التقديري</h4>
                
                <div className="space-y-3 my-6 text-right">
                  <div className="flex justify-between items-center p-3 bg-slate-950/80 rounded-xl border border-white/5">
                    <span className="text-cyan-400 font-mono font-bold">{estimate.labor.toLocaleString()} ر.س</span>
                    <span className="text-slate-400 text-sm">أجرة اليد والتركيب</span>
                  </div>
                  {estimate.part ? (
                    <div className="flex justify-between items-center p-3 bg-slate-950/80 rounded-xl border border-white/5">
                      <span className="text-cyan-400 font-mono font-bold">{estimate.part.price.toLocaleString()} ر.س</span>
                      <span className="text-slate-400 text-sm">سعر القطعة ({estimate.part.name})</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-400 font-bold bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-center">القطعة المطلوبة ستوفر حسب الطلب بأفضل جودة وسعر منافس</p>
                  )}
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center bg-cyan-500/10 p-4 rounded-2xl border border-cyan-500/20">
                      <span className="text-2xl font-black text-cyan-300 font-mono">
                        {((estimate.part?.price || 0) + estimate.labor).toLocaleString()} ر.س
                      </span>
                      <span className="text-white font-bold">المبلغ الإجمالي التقريبي</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={handleBook}
                    disabled={isBooking}
                    className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isBooking ? <Loader2 className="animate-spin" /> : <Clock size={20} />}
                    <span>حجز موعد صيانة الآن</span>
                  </button>
                  <button 
                    onClick={() => { setEstimate(null); setCurrentStep('start'); }}
                    className="px-6 py-4 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                  >
                    إعادة التشخيص
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
