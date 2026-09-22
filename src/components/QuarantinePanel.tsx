import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { accountingService } from '../services/accountingService';
import { useWebSocketTelemetry } from '../services/websocketService';
import { 
  Check, 
  Loader2, 
  X, 
  ShieldAlert, 
  Sparkles, 
  RefreshCw, 
  Radio, 
  Cpu, 
  Layers, 
  Terminal, 
  Zap, 
  CheckCircle2, 
  Eye, 
  HelpCircle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuarantinePanelProps {
  profile: any;
  mode?: 'all' | 'prevention' | 'quarantine';
}

export const QuarantinePanel: React.FC<QuarantinePanelProps> = ({ profile, mode = 'all' }) => {
  const [quarantinedIssues, setQuarantinedIssues] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeHotfixes, setActiveHotfixes] = useState<any[]>([]);
  const [hotfixVersion, setHotfixVersion] = useState<number | null>(null);
  const [isPatching, setIsPatching] = useState(false);

  // Modals visibility states to save dashboard space
  const [isHotfixModalOpen, setIsHotfixModalOpen] = useState(false);
  const [isQuarantineModalOpen, setIsQuarantineModalOpen] = useState(false);

  // Real-time WebSocket connection to receive instant AI Correction Plans
  const { livePushedIssues, setLivePushedIssues } = useWebSocketTelemetry(profile?.ownerId);

  // Listen to global hotfixes updates from local script triggers
  useEffect(() => {
    const handleUpdated = (e: any) => {
      setActiveHotfixes(e.detail.hotfixes || []);
      setHotfixVersion(e.detail.version || null);
    };
    window.addEventListener('JAM_HOTFIXES_UPDATED', handleUpdated);
    
    if ((window as any).__JAM_GLOBAL_HOTFIX_REGISTRY__) {
      setActiveHotfixes((window as any).__JAM_GLOBAL_HOTFIX_REGISTRY__);
      setHotfixVersion((window as any).__JAM_GLOBAL_HOTFIX_VERSION__);
    }
    
    return () => window.removeEventListener('JAM_HOTFIXES_UPDATED', handleUpdated);
  }, []);

  const triggerManualHotfixReload = async () => {
    setIsPatching(true);
    try {
      const { AccountingTelemetry } = await import('../services/telemetryInterceptor');
      await AccountingTelemetry.fetchAndApplyHotfixes();
    } catch (e) {
      console.error("Failed to manual load hotfixes:", e);
    } finally {
      setTimeout(() => setIsPatching(false), 800);
    }
  };

  // Listen to real-time quarantined transactions from Firestore
  useEffect(() => {
    if (!profile?.ownerId) return;

    const q = query(
      collection(db, 'quarantined_transactions'),
      where('ownerId', '==', profile.ownerId),
      where('status', '==', 'quarantined')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const items: any[] = [];
      for (const docSnap of snapshot.docs) {
        const id = docSnap.id;
        if (id.startsWith('Q-REC-') || id.startsWith('ERR-SIM-')) {
          try {
            await deleteDoc(doc(db, 'quarantined_transactions', id));
          } catch (e) {
            console.warn("Deleted sample item:", id);
          }
        } else {
          items.push({ id, ...docSnap.data() });
        }
      }
      setQuarantinedIssues(items);
    }, (error) => {
      console.warn("Telemetry Quarantine Listener Error:", error.message);
    });

    return () => unsubscribe();
  }, [profile]);

  // Combine both real-time streams
  const combinedIssues = [...quarantinedIssues];
  for (const pushed of livePushedIssues) {
    if (!combinedIssues.some(item => item.id === pushed.id)) {
      combinedIssues.push(pushed);
    }
  }

  // Apply safe automated repair
  const handleApplyFix = async (qTx: any) => {
    if (!profile?.ownerId) return;
    if (loadingId === qTx.id) return;
    setLoadingId(qTx.id);
    
    try {
      const docRef = doc(db, 'quarantined_transactions', qTx.id);
      
      const runResult = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (docSnap.exists()) {
          const currentData = docSnap.data();
          if (currentData.status && currentData.status !== 'quarantined') {
            throw new Error('STATUS_ALREADY_PROCESSED');
          }
        }
        
        const nextNum = Math.floor(Math.random() * 8000) + 1000;
        const realSeqId = `REC-TEL-${nextNum}`;
        
        transaction.set(docRef, {
          ...qTx,
          status: 'approved',
          realLedgerId: realSeqId,
          approvedAt: new Date().toISOString()
        }, { merge: true });
        
        return { realSeqId };
      });

      const { realSeqId } = runResult;

      const formattedItems = qTx.proposedItems.map((item: any) => ({
        accountId: item.accountId,
        accountName: item.accountName,
        debit: Number(item.debit) || 0,
        credit: Number(item.credit) || 0,
        currency: 'YER',
        exchangeRate: 1,
        baseAmount: Number(item.debit || item.credit) || 0
      }));

      await accountingService.recordJournalEntry(
        profile.ownerId,
        `[معتمد ومعافى ذاتياً من Telemetry] ${qTx.description}`,
        formattedItems,
        realSeqId
      );

      const hCode = qTx.hotfixJSCode || qTx.aiCorrectionPlan?.hotfixJSCode;
      if (hCode) {
        const hId = qTx.bugTriggerName || qTx.aiCorrectionPlan?.bugTriggerName || `patch_${qTx.id}`;
        const hRef = doc(db, 'global_hotfixes', hId);
        await setDoc(hRef, {
          id: hId,
          errorCode: qTx.errorType || 'unknown_telemetry_bug',
          bugTriggerName: qTx.bugTriggerName || qTx.aiCorrectionPlan?.bugTriggerName || 'generic_prevention_patch',
          hotfixCode: hCode,
          descriptionAr: qTx.telemetryLog || qTx.description || 'إصلاح كودي تلقائي مجهول',
          deployedAt: new Date().toISOString(),
          version: Date.now()
        }, { merge: true });
      }

      setLivePushedIssues(prev => prev.filter(i => i.id !== qTx.id));
      alert(`✓ تم تطبيق الإصلاح الذكي المحاسبي وتأمين ميزان المراجعة بنجاح!\nالسند: ${realSeqId}`);
    } catch (err: any) {
      console.error("Quarantine Fix Error:", err);
      if (err.message === 'STATUS_ALREADY_PROCESSED') {
        alert('⚠️ تنبيه: تم معالجة هذا الخلل مسبقاً من جهاز مستخدم موازي.');
      } else {
        alert(`خطأ أثناء الإصلاح: ${err.message}`);
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handleRejectFix = async (qTx: any) => {
    if (!window.confirm('هل أنت متأكد من استبعاد وتجاهل الحركة؟')) return;
    try {
      const docRef = doc(db, 'quarantined_transactions', qTx.id);
      await setDoc(docRef, {
        ...qTx,
        status: 'rejected',
        rejectedAt: new Date().toISOString()
      }, { merge: true });

      setLivePushedIssues(prev => prev.filter(i => i.id !== qTx.id));
    } catch (err: any) {
      alert('خطأ أثناء الاستبعاد: ' + err.message);
    }
  };

  return (
    <>
      {/* 1. Card: "درع الوقاية وغزو الأخطاء" (Compact Square-like 4x6 shape) */}
      {(mode === 'all' || mode === 'prevention') && (
        <div className={`${mode === 'prevention' ? 'bg-gradient-to-br from-slate-900/40 via-slate-900/60 to-slate-950 border border-indigo-500/15 rounded-2xl md:rounded-[2.2rem] p-4 sm:p-6 shadow-lg h-auto min-h-[180px]' : 'lg:col-span-3 bg-gradient-to-br from-slate-900/40 via-slate-900/60 to-slate-950 border border-indigo-500/15 rounded-3xl p-4.5 h-[180px]'} flex flex-col justify-between text-right group relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="space-y-1 relative z-10">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 text-[8.5px] bg-indigo-500/10 text-indigo-400 font-extrabold rounded-full border border-indigo-500/20">
                نشط وآمن ●
              </span>
              <div className="flex items-center gap-1.5 text-indigo-400 font-black">
                <span className="text-xs">🛡️</span>
                <h3 className="text-[12.5px] tracking-tight">درع وقاية الأخطاء</h3>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed font-bold mt-1">
              حماية كود المعاملات وتواقيع التخزين لمنع حدوث الكسور أو الأخطاء البرمجية تلقائياً بالخلفية.
            </p>
          </div>

          <div className="flex items-center justify-between gap-1.5 relative z-10 pt-1.5 border-t border-slate-800/40">
            <span className="text-[8.5px] text-slate-500 font-black">
              الترقيعات: {activeHotfixes.length} نشط
            </span>
            <button
              onClick={() => setIsHotfixModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-950/40 text-indigo-300 hover:text-indigo-200 text-[9.5px] font-black rounded-lg transition-all border border-slate-700/60 flex items-center gap-1 cursor-pointer"
            >
              <Eye size={10} />
              <span>معاينة الترقيعات</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Card: "نظام الفحص الوقائي" (Compact Square-like 4x6 shape) */}
      {(mode === 'all' || mode === 'quarantine') && (
        <div className={`${mode === 'quarantine' ? 'lg:col-span-6 bg-gradient-to-br from-slate-900/40 via-slate-900/60 to-slate-950 border border-slate-800 rounded-3xl p-4.5' : 'lg:col-span-3 bg-gradient-to-br from-slate-900/40 via-slate-900/60 to-slate-950 border border-slate-800 rounded-3xl p-4.5'} flex flex-col justify-between shadow-lg h-[180px] text-right group relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="space-y-1 relative z-10">
            <div className="flex items-center justify-between">
              {combinedIssues.length > 0 ? (
                <span className="px-2 py-0.5 text-[8.5px] bg-amber-500 text-slate-950 font-black rounded-full animate-bounce flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" />
                  {combinedIssues.length} معزول
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[8.5px] bg-emerald-500/10 text-emerald-400 font-black rounded-full border border-emerald-500/20">
                  مكتمل ومطابق ✓
                </span>
              )}
              <div className="flex items-center gap-1.5 text-teal-400 font-black">
                <span className="text-xs">⚙️</span>
                <h3 className="text-[12.5px] tracking-tight">نظام الفحص الوقائي</h3>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed font-bold mt-1">
              {combinedIssues.length > 0 
                ? `تم رصد وعزل عدد ${combinedIssues.length} حركة غير متطابقة قبل الترحيل لضمان سلامة الأرصدة الموحدة.`
                : 'فحص فوري ومستمر لسلامة ومطابقة الأرصدة والقيود المحاسبية بالوقت الفعلي.'
              }
            </p>
          </div>

          <div className="flex items-center justify-end gap-1.5 relative z-10 pt-1.5 border-t border-slate-800/40">
            <button
              onClick={() => setIsQuarantineModalOpen(true)}
              className={`px-3 py-1.5 text-[9.5px] font-black rounded-lg transition-all border cursor-pointer flex items-center gap-1 ${
                combinedIssues.length > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-600/30'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700/60'
              }`}
            >
              <span>{combinedIssues.length > 0 ? 'معالجة العزل' : 'فتح الفحص'}</span>
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL 1: Active Hotfixes & System Architecture --- */}
      {(mode === 'all' || mode === 'prevention') && (
        <AnimatePresence>
          {isHotfixModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHotfixModalOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-right overflow-hidden max-h-[85vh] flex flex-col"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <Cpu size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">ترقيعات الذاكرة وحماية كود العمليات</h3>
                    <p className="text-[10px] text-slate-400">فحص وضمان تواقيع التخزين المحاسبية ومنع الـ Race Conditions</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHotfixModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                {/* Manual Check bar */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-indigo-400 block">فحص وتحديث التوقيع السحابي الموحد:</span>
                    <p className="text-[10px] text-slate-400">سحب الترقيعات الوقائية المعتمدة والمشفرة من مستودع الأمان.</p>
                  </div>
                  <button
                    onClick={triggerManualHotfixReload}
                    disabled={isPatching}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5 transition-all border-none"
                  >
                    {isPatching ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>جاري الاستدعاء...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={12} />
                        <span>تحديث فوري للمستودع</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Hotfixes List */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-400" />
                    الترقيعات النشطة حالياً في الجلسة:
                  </h4>
                  
                  {activeHotfixes.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                      <CheckCircle2 className="mx-auto text-emerald-500/80 mb-2" size={28} />
                      <p className="text-xs text-slate-400 font-bold">مستودع الكود نظيف تماماً!</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">تعمل جميع الكلاسات والعمليات بأقصى كفاءة بدون الحاجة لأية استثناءات تجميلية.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeHotfixes.map((patch) => (
                        <div key={patch.id} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 relative overflow-hidden group">
                          <div className="absolute top-2 left-2 p-1 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <Zap size={11} />
                          </div>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[9px] font-black">
                            {patch.bugTriggerName}
                          </span>
                          <h5 className="text-[11px] font-black text-white">{patch.descriptionAr}</h5>
                          <pre className="bg-slate-900 p-2 rounded-xl font-mono text-[9px] text-emerald-400 max-h-[60px] overflow-y-auto border border-slate-800/80 leading-tight">
                            <code>{patch.hotfixCode}</code>
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Telemetry Architecture FAQ */}
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60 text-xs text-slate-300 space-y-3">
                  <h4 className="font-black text-white text-[11px] flex items-center gap-1">
                    <Terminal size={14} className="text-indigo-400" />
                    كيف تضمن المنظومة موثوقية العمليات؟
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10.5px] leading-relaxed">
                    <div className="space-y-1.5">
                      <span className="text-indigo-400 font-black">1. حماية النقرات المتزامنة:</span>
                      <p className="text-slate-400">
                        تستخدم المنظومة قفل المعاملات الذري <strong className="text-slate-200">Firestore Transactions (runTransaction)</strong> لضمان حماية الترحيل عند نقر موظفين متعددين على نفس الحساب بالملي ثانية.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-teal-400 font-black">2. الحفظ غير المتزامن والتواقيع:</span>
                      <p className="text-slate-400">
                        عند انقطاع الإنترنت، يتم تشفير البيانات وتخزينها محلياً في جهازك بتوقيع آمن، وبمجرد عودة الاتصال، تتم مزامنتها بسلاسة دون التسبب في تكرار الترحيل.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setIsHotfixModalOpen(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-750 text-white text-xs font-black rounded-xl border-none cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      )}

      {/* --- MODAL 2: Quarantine & Telemetry Issues Center --- */}
      {(mode === 'all' || mode === 'quarantine') && (
        <AnimatePresence>
          {isQuarantineModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQuarantineModalOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-right overflow-hidden max-h-[85vh] flex flex-col"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">مركز التدقيق المالي وفحص القيود المعزولة</h3>
                    <p className="text-[10px] text-slate-400">عزل وتطهير الحسابات المزدوجة المتضررة لضمان توازن ميزان المراجعة</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsQuarantineModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                {combinedIssues.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 size={36} />
                    </div>
                    <h4 className="text-xs font-black text-white">النظام المالي متطابق ومتوازن 100%</h4>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                      لا توجد أية فوارق نقدية أو ترحيلات خاطئة معلقة حالياً. نظام الفحص الوقائي يراقب الصناديق في الوقت الحقيقي بكل سلاسة.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl">
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                        <Sparkles size={14} className="animate-pulse" />
                        <span>يوجد {combinedIssues.length} حركات معزولة تتطلب مراجعتك الأمنية:</span>
                      </div>
                      <span className="text-[9.5px] text-slate-400">انقر على الزر لإعادة دمج القيد معالَجاً</span>
                    </div>

                    <div className="space-y-3">
                      {combinedIssues.map((issue) => (
                        <div key={issue.id} className="bg-slate-950 border border-amber-500/15 p-4 rounded-2xl space-y-3 transition-all hover:border-amber-500/30 relative">
                          {issue.isRealTimePushed && (
                            <span className="absolute top-3 left-3 flex items-center gap-1 text-[8px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                              <Radio size={8} className="animate-pulse" /> بث فوري
                            </span>
                          )}

                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 font-mono text-[9px] text-amber-500 font-extrabold border border-amber-500/20">
                                {issue.id}
                              </span>
                              <h4 className="text-xs font-black text-white mt-1">{issue.description}</h4>
                            </div>
                            <div className="text-left shrink-0">
                              <span className="text-[10px] text-slate-500 font-mono">
                                {issue.createdAt ? new Date(issue.createdAt).toLocaleString('ar-YE') : 'الآن'}
                              </span>
                              <p className="text-xs font-black text-amber-500 font-mono mt-0.5">
                                القيمة المعزولة: {issue.amount?.toLocaleString()} ر.ي
                              </p>
                            </div>
                          </div>

                          <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/10 text-[10.5px] text-slate-300 leading-relaxed">
                            <span className="text-amber-400 font-black block mb-1">🤖 تشخيص الخلل والموازنة المحاسبية:</span>
                            <p className="text-slate-400 text-[10px]">{issue.telemetryLog}</p>
                            
                            {issue.hotfixJSCode && (
                              <div className="mt-2.5 pt-2 border-t border-amber-500/10">
                                <span className="text-[9.5px] font-bold text-amber-400 flex items-center gap-1 mb-1">
                                  <Terminal size={10} />
                                  ترقية الكود لمنع هذا العيب مستقبلاً:
                                </span>
                                <pre className="bg-slate-900 p-2 rounded text-[8.5px] text-emerald-400 font-mono max-h-[60px] overflow-y-auto border border-slate-800 leading-tight select-all">
                                  <code>{issue.hotfixJSCode}</code>
                                </pre>
                              </div>
                            )}
                          </div>

                          {issue.proposedItems && issue.proposedItems.length > 0 && (
                            <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800 text-[10px] font-mono">
                              <span className="text-[9.5px] font-black text-slate-400 block mb-2">تأثير القيد المحاسبي المزدوج المقترح:</span>
                              <div className="divide-y divide-slate-800 space-y-1.5">
                                <div className="flex justify-between font-bold text-slate-500 pb-1 text-[8.5px]">
                                  <span>الحساب المالي</span>
                                  <div className="flex gap-4">
                                    <span className="w-14 text-left">مدين (Dr)</span>
                                    <span className="w-14 text-left">دائن (Cr)</span>
                                  </div>
                                </div>
                                {issue.proposedItems.map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between py-1 text-[9px]">
                                    <span className="text-slate-300">{item.accountName} ({item.accountId})</span>
                                    <div className="flex gap-4">
                                      <span className="w-14 text-left font-black text-emerald-400">
                                        {item.debit > 0 ? `${item.debit.toLocaleString()} ر.ي` : '—'}
                                      </span>
                                      <span className="w-14 text-left font-black text-rose-500">
                                        {item.credit > 0 ? `${item.credit.toLocaleString()} ر.ي` : '—'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-start gap-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => handleApplyFix(issue)}
                              disabled={loadingId === issue.id}
                              className="px-4 py-2 bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 text-slate-950 text-[10.5px] font-black rounded-xl transition-all border-none cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {loadingId === issue.id ? (
                                <>
                                  <Loader2 size={11} className="animate-spin" />
                                  <span>جاري الموازنة الآمنة...</span>
                                </>
                              ) : (
                                <>
                                  <Check size={11} />
                                  <span>تطبيق الإصلاح الآلي وإعادة الدمج بالدفاتر</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleRejectFix(issue)}
                              disabled={loadingId === issue.id}
                              className="px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 text-[10.5px] font-black rounded-xl transition-all border-none cursor-pointer"
                              title="حذف واستبعاد الحركة المعزولة"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setIsQuarantineModalOpen(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-750 text-white text-xs font-black rounded-xl border-none cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      )}
    </>
  );
};
