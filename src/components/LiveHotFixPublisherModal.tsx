import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Send, RefreshCw, ShieldCheck, ShieldAlert, Code2, CheckCircle2, AlertCircle, Terminal, X, Lock, Cpu, Sparkles, Activity, Layers, Wifi, Info } from 'lucide-react';
import { liveHotFixEngine, HotFixPatchPayload, HotFixProgressUpdate } from '../services/LiveHotFixEngine';
import { hotPatchSecurityGuardService } from '../services/HotPatchSecurityGuard';

interface LiveHotFixPublisherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LiveHotFixPublisherModal({ isOpen, onClose }: LiveHotFixPublisherModalProps) {
  const [patchId, setPatchId] = useState('v4.0.1-hotfix-patch1');
  const [version, setVersion] = useState('4.0.1');
  const [title, setTitle] = useState('تحديث حار فوري: عزل الصيانة وتحديث سندات الاستلام وسرعة المزامنة');
  const [description, setDescription] = useState('إخفاء وحدات الصيانة والأرصدة لتجار جملة الجملة والمستوردين تلقائياً، وتحديث وضغط سندات الصيانة وتسهيل الإدخال السريع بدون تنزيل أي تطبيق جديد.');
  
  const [autoRecoverNetwork, setAutoRecoverNetwork] = useState(true);
  const [autoRecoverMath, setAutoRecoverMath] = useState(true);
  const [roundingMode, setRoundingMode] = useState<'standard' | 'floor' | 'ceil'>('standard');
  const [moduleActivationsStr, setModuleActivationsStr] = useState<string>('wholesale-pos, wholesale-purchases, owner-control');
  const [dynamicBundleCode, setDynamicBundleCode] = useState<string>(
`// Live Executable Hot-Patch Injection
console.log("⚡ Hot-Fix dynamic script bundle injected live across application!");
window.dispatchEvent(new CustomEvent('jam:profile_updated'));`
  );
  const [overrideCode, setOverrideCode] = useState<string>(
`// Dynamic JS function override snippet
if (args && args[0] && Array.isArray(args[0])) {
  // Overriding calculateCartTotal algorithm live
  const total = args[0].reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
  return Math.round(total * 100) / 100;
}`
  );

  const [isPushing, setIsPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const [diagnosticLogs, setDiagnosticLogs] = useState<HotFixProgressUpdate[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string; code?: string } | null>(null);
  const [activePatchOnServer, setActivePatchOnServer] = useState<HotFixPatchPayload | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = liveHotFixEngine.getCurrentPatch();
      setActivePatchOnServer(current);
      if (current) {
        setPatchId(current.patchId);
        setVersion(current.version);
        setTitle(current.title);
        setDescription(current.description);
        if (current.moduleActivations) {
          setModuleActivationsStr(current.moduleActivations.join(', '));
        }
        if (current.dynamicBundleCode) {
          setDynamicBundleCode(current.dynamicBundleCode);
        }
      }
      setPushProgress(0);
      setDiagnosticLogs([]);
      setStatusMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (diagnosticLogs.length > 0) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [diagnosticLogs]);

  if (!isOpen) return null;

  const handlePushHotFix = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPushing(true);
    setPushProgress(5);
    setCurrentStage('بدء تشغيل محرك الدفع الهوائي...');
    setDiagnosticLogs([]);
    setStatusMessage(null);

    const parsedModules = moduleActivationsStr
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);

    const payload: HotFixPatchPayload = {
      patchId: patchId.trim() || `patch_${Date.now()}`,
      version: version.trim() || '2.5.1-hotfix',
      timestamp: new Date().toISOString(),
      title: title.trim() || 'تحديث حار سحابي عاجل',
      description: description.trim() || 'تحديث إصلاحي مباشر للأكواد الحساسة بدون تنزيل.',
      isMandatory: false,
      moduleActivations: parsedModules,
      dynamicBundleCode: dynamicBundleCode.trim() || undefined,
      functionOverrides: {
        calculateCartTotal: overrideCode
      },
      ruleModifiers: {
        roundingMode,
        autoRecoverNetworkErrors: autoRecoverNetwork,
        autoRecoverMathErrors: autoRecoverMath,
        forceOfflineQueueSyncOnPatch: true
      },
      active: true
    };

    const result = await liveHotFixEngine.pushHotFixPatch(payload, (update) => {
      setPushProgress(update.percent);
      setCurrentStage(update.stage);
      setDiagnosticLogs(prev => [...prev, update]);
    });

    setIsPushing(false);

    if (result.success) {
      setPushProgress(100);
      setCurrentStage('تم النشر الفوري بنجاح ✅');
      liveHotFixEngine.applyHotFixPatch(payload);
      await hotPatchSecurityGuardService.performIntegrityCheck(payload);

      setStatusMessage({
        type: 'success',
        text: `⚡ تم دفع التحديث الحار الفوري بنجاح خلال (${result.durationMs}ms)! تم بث التحديث فورياً لكافة أجهزة APK و EXE و Web المتصلة بالإنترنت الآن بدون تنزيل أو إيقاف المحل.`
      });
      setActivePatchOnServer(payload);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.errorMessage || '❌ فشل دفع التحديث إلى السحابة. يرجى التأكد من الاتصال وصلاحيات المشرف العام.',
        code: result.errorCode || 'ERR_PUSH_UNKNOWN'
      });
    }
  };

  const handleDeactivatePatch = async () => {
    setIsPushing(true);
    setPushProgress(10);
    setCurrentStage('إلغاء التحديثات الحارة وإعادة النواة...');
    setDiagnosticLogs([]);

    const payload: HotFixPatchPayload = {
      patchId: 'deactivated',
      version: '2.5.1',
      timestamp: new Date().toISOString(),
      title: 'إلغاء التحديثات الحارة',
      description: 'تم إيقاف التحديث الحار للعودة إلى النواة القياسية.',
      isMandatory: false,
      active: false
    };

    const result = await liveHotFixEngine.pushHotFixPatch(payload, (update) => {
      setPushProgress(update.percent);
      setCurrentStage(update.stage);
      setDiagnosticLogs(prev => [...prev, update]);
    });

    setIsPushing(false);
    if (result.success) {
      setPushProgress(100);
      liveHotFixEngine.applyHotFixPatch(payload);
      setActivePatchOnServer(null);
      setStatusMessage({
        type: 'success',
        text: '🛑 تم إلغاء وتعطيل التحديث الحار السحابي بنجاح وإعادة جميع التطبيقات للنواة القياسية.'
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: result.errorMessage || 'فشل تعطيل التحديث السحابي.',
        code: result.errorCode
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans dir-rtl text-right">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 text-white max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto scrollbar-none"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-sky-600 rounded-2xl text-slate-950 font-black shadow-lg shadow-emerald-500/20 animate-pulse">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-white m-0 flex items-center gap-2">
                <span>محرك دفع التحديثات الحارة المباشرة (Live Hot-Fix Push Engine)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">OTA LIVE</span>
              </h3>
              <p className="text-xs text-zinc-400 m-0 mt-0.5">
                دفع الإصلاحات والأكواد القادمة سحابياً مباشرة لتطبيقات APK و EXE والويب بدون تنزيل أو توقف المحل
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ACTIVE STATUS BANNER */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <Cpu size={18} className="text-emerald-400" />
            <div>
              <span className="text-zinc-400 font-bold block">حالة التحديث الحار السحابي حالياً:</span>
              <strong className="text-emerald-300 font-mono text-sm">
                {activePatchOnServer?.active ? `نشط: [${activePatchOnServer.patchId}] - ${activePatchOnServer.title}` : 'لا يوجد تحديث حار نشط حالياً (النواة القياسية)'}
              </strong>
            </div>
          </div>

          {activePatchOnServer?.active && (
            <button
              onClick={handleDeactivatePatch}
              disabled={isPushing}
              className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl font-bold text-[11px] transition-all cursor-pointer"
            >
              سحب وتوقيف التحديث 🛑
            </button>
          )}
        </div>

        {/* PRESET HOTFIX SELECTION */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <Sparkles size={14} className="text-emerald-400" />
            <span>اختر نمط التحديث السحابي الجاهز لدفعه للعملاء:</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setPatchId('v2.5.1-math-patch');
                setTitle('تحديث حار لتقريب الكسور والعملات وحساب المبيعات');
                setDescription('تعديل خوارزمية التقريب المالي وضمان حماية أخطاء NaN و Big.js عند إضافة المبيعات.');
                setAutoRecoverMath(true);
              }}
              className="p-3 bg-slate-950/60 hover:bg-slate-800/80 border border-white/10 rounded-2xl text-right transition-all cursor-pointer"
            >
              <div className="font-bold text-emerald-300">1. إصلاح تقريب المبيعات والكسور ⚡</div>
              <p className="text-[10px] text-zinc-400 m-0 mt-0.5">معالجة أخطاء تقريب المبيعات والعملات تلقائياً.</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setPatchId('v2.5.1-network-patch');
                setTitle('تحديث حار لحياد شبكة الأوفلاين والمزامنة السحابية');
                setDescription('استمرار العمل كلياً عند تقطع السيرفر ومعالجة استثناءات الشبكة تلقائياً خلف الكواليس.');
                setAutoRecoverNetwork(true);
              }}
              className="p-3 bg-slate-950/60 hover:bg-slate-800/80 border border-white/10 rounded-2xl text-right transition-all cursor-pointer"
            >
              <div className="font-bold text-sky-300">2. حماية انقطاع شبكة المزامنة 🌐</div>
              <p className="text-[10px] text-zinc-400 m-0 mt-0.5">منع توقف الكاشير عند انقطاع السيرفر المباشر.</p>
            </button>
          </div>
        </div>

        {/* PUSH FORM */}
        <form onSubmit={handlePushHotFix} className="space-y-4 pt-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">معرف التحديث (Patch ID):</label>
              <input
                type="text"
                value={patchId}
                onChange={(e) => setPatchId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-white/10 text-emerald-400 font-mono text-xs px-3.5 py-2 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">الإصدار المستهدف (Version):</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                required
                className="w-full bg-slate-950 border border-white/10 text-sky-300 font-mono text-xs px-3.5 py-2 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300">عنوان التحديث للعملاء (Patch Title):</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-slate-950 border border-white/10 text-white text-xs px-3.5 py-2 rounded-xl outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300">وصف الإصلاح والتحديث:</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 text-zinc-300 text-xs p-3 rounded-xl outline-none focus:border-emerald-500"
            />
          </div>

          {/* DYNAMIC SCRIPT BUNDLE / EXECUTABLE JS */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-sky-300 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Terminal size={14} />
                <span>حزمة الكود الديناميكي المباشر (Dynamic Script Bundle Injection):</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">OTA Dynamic Exec</span>
            </label>
            <textarea
              rows={3}
              value={dynamicBundleCode}
              onChange={(e) => setDynamicBundleCode(e.target.value)}
              placeholder="// JavaScript to execute live on all connected devices"
              className="w-full bg-slate-950 border border-sky-500/30 text-sky-300 font-mono text-[11px] p-3 rounded-xl ltr text-left outline-none focus:border-sky-500 leading-relaxed"
            />
          </div>

          {/* DYNAMIC MODULE ACTIVATIONS */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-amber-300 flex items-center gap-1">
              <Layers size={14} />
              <span>تفعيل وحدات وشاشات فوراً لجميع الأجهزة (Module IDs مفصولة بفاصلة):</span>
            </label>
            <input
              type="text"
              value={moduleActivationsStr}
              onChange={(e) => setModuleActivationsStr(e.target.value)}
              placeholder="wholesale-pos, wholesale-purchases, owner-control"
              className="w-full bg-slate-950 border border-amber-500/30 text-amber-300 font-mono text-xs px-3.5 py-2 rounded-xl outline-none focus:border-amber-500"
            />
          </div>

          {/* DYNAMIC CODE OVERRIDE SNIPPET */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-emerald-300 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Code2 size={14} />
                <span>كود وتجاوز الدالة البرمجية الحسابية (JS Override Code):</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Sandbox Function</span>
            </label>
            <textarea
              rows={3}
              value={overrideCode}
              onChange={(e) => setOverrideCode(e.target.value)}
              className="w-full bg-slate-950 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] p-3 rounded-xl ltr text-left outline-none focus:border-emerald-500 leading-relaxed"
            />
          </div>

          {/* CHECKBOX OPTIONS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-2xl border border-white/5 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
              <input
                type="checkbox"
                checked={autoRecoverNetwork}
                onChange={(e) => setAutoRecoverNetwork(e.target.checked)}
                className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span>اعتراض ومعالجة أخطاء الشبكة تلقائياً</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
              <input
                type="checkbox"
                checked={autoRecoverMath}
                onChange={(e) => setAutoRecoverMath(e.target.checked)}
                className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span>اعتراض أخطاء التقريب الرياضي</span>
            </label>
          </div>

          {/* REAL-TIME PROGRESS BAR & STAGE */}
          {(isPushing || pushProgress > 0) && (
            <div className="space-y-2 bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/30">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2 text-emerald-400">
                  <Activity size={14} className={isPushing ? 'animate-spin' : ''} />
                  <span>{currentStage || 'جاري معالجة وبث التحديث الهوائي...'}</span>
                </span>
                <span className="font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  {pushProgress}%
                </span>
              </div>
              
              {/* Progress Track */}
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 shadow-lg shadow-emerald-500/50"
                  initial={{ width: '0%' }}
                  animate={{ width: `${pushProgress}%` }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          {/* DIAGNOSTIC LOGS TERMINAL CONSOLE */}
          {diagnosticLogs.length > 0 && (
            <div className="space-y-1.5 bg-slate-950/90 border border-slate-800 rounded-2xl p-3 text-xs font-mono">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/5 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5 text-zinc-300 font-bold">
                  <Terminal size={13} className="text-emerald-400" />
                  <span>سجل العمليات والتشخيص الحقيقي (Live OTA Diagnostics Log)</span>
                </span>
                <span className="text-[10px] text-zinc-500">مباشر • Real-time</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-[11px] ltr text-left">
                {diagnosticLogs.map((log, index) => (
                  <div 
                    key={index}
                    className={`flex items-start gap-2 py-0.5 px-1.5 rounded ${
                      log.status === 'error' ? 'bg-rose-950/40 text-rose-300 border border-rose-500/30' :
                      log.status === 'success' ? 'bg-emerald-950/30 text-emerald-300' :
                      log.status === 'warning' ? 'bg-amber-950/30 text-amber-300' : 'text-zinc-400'
                    }`}
                  >
                    <span className="text-zinc-500 text-[10px] select-none">[{log.timestamp}]</span>
                    <span className="font-semibold select-none">[{log.percent}%]</span>
                    <span className="flex-1 rtl text-right font-sans">{log.stage}: <span className="text-zinc-400 font-mono text-[10px]">{log.detail}</span></span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {statusMessage && (
            <div className={`p-3.5 rounded-2xl text-xs font-bold space-y-1 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              <div className="flex items-center gap-2">
                {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{statusMessage.text}</span>
              </div>
              {statusMessage.code && (
                <div className="text-[10px] font-mono text-rose-200/80 bg-rose-950/50 p-1.5 rounded-lg border border-rose-500/20 ltr text-left">
                  Error Code: {statusMessage.code}
                </div>
              )}
            </div>
          )}

          {/* MAIN PUSH BUTTON ("زر للتحديث والدفع") */}
          <button
            type="submit"
            disabled={isPushing}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Send size={18} />
            <span>{isPushing ? `جاري دفع التحديث الحار السحابي (${pushProgress}%)...` : '🚀 دفع التحديث الحار فوري للسحابة ولجميع التطبيقات (Push Live Hot-Fix Patch)'}</span>
          </button>

        </form>
      </motion.div>
    </div>
  );
}
