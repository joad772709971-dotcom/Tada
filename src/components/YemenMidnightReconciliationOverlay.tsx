import React, { useState, useEffect } from 'react';
import { yemenTimeService, YemenTimeStatus } from '../services/yemenTimeReconciliation';
import { Clock, ShieldCheck, Landmark, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const YemenMidnightReconciliationOverlay: React.FC = () => {
  const [status, setStatus] = useState<YemenTimeStatus>(() => yemenTimeService.getStatus());

  useEffect(() => {
    const unsubscribe = yemenTimeService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  if (!status.isMidnightPauseActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 dir-rtl text-slate-100 select-none"
      >
        <div className="max-w-lg w-full bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 md:p-8 shadow-2xl shadow-emerald-950/50 text-center relative overflow-hidden">
          {/* Subtle glowing ambient background */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-6">
            <Landmark className="w-4 h-4 text-emerald-400" />
            <span>المواطنة المالية والتجميع اليومي • توقيت اليمن (صنعاء)</span>
          </div>

          {/* Animated Clock Ring */}
          <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping opacity-25" />
            <div className="w-24 h-24 rounded-full bg-slate-800/80 border-2 border-emerald-500/50 flex items-center justify-center shadow-inner">
              <Clock className="w-12 h-12 text-emerald-400 animate-pulse" />
            </div>
          </div>

          {/* Countdown Display */}
          <div className="mb-4">
            <span className="text-xs text-slate-400 block mb-1 font-medium">الوقت المتبقي حتى استئناف النظام</span>
            <div className="text-4xl md:text-5xl font-black text-emerald-400 tracking-wider font-mono">
              {status.formattedCountdown}
            </div>
          </div>

          {/* Yemen Time Status */}
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 mb-6 flex items-center justify-between px-4">
            <div className="text-right">
              <div className="text-xs text-slate-400">التوقيت الحالي في اليمن</div>
              <div className="text-sm font-bold text-slate-200">{status.yemenTimeString}</div>
            </div>
            <div className="text-left">
              <div className="text-xs text-slate-400">فترة التوقف المعتمدة</div>
              <div className="text-xs font-semibold text-emerald-400">11:59 م - 12:01 ص (دقيقتين)</div>
            </div>
          </div>

          {/* Explanation Text */}
          <p className="text-xs text-slate-300 leading-relaxed mb-6 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 text-right">
            يتم الآن إجراء الفرز المالي التلقائي وإغلاق صناديق النقدية والقيود المحاسبية لليوم المنتهي، وتجديد المحاولات والعمليات المجانية اليومية بنجاح. يستأنف البرنامج العمل التلقائي كاملاً فور انتهاء الدقيقتين.
          </p>

          {/* Status Badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>بياناتك محفوظة وآمنة بنسبة 100% وفي وضع الحفظ الأوفلاين</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default YemenMidnightReconciliationOverlay;
