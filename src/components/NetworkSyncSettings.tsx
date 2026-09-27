import React, { useState, useEffect } from 'react';
import { 
  Wifi, WifiOff, Cloud, HardDrive, RefreshCw, ShieldCheck, CheckCircle2, 
  AlertCircle, Server, Smartphone, Laptop, Activity, Zap, Check, ArrowRightLeft,
  QrCode, Network, Link, Copy, Layers, Database, Lock, AlertTriangle, Play, HelpCircle,
  ShoppingCart, FileText, CheckCheck, Clock, Box, Key, ArrowRight, ShieldAlert, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  multiNetworkSyncEngine, 
  SyncOperatingMode, 
  LanNodeRole, 
  SyncFrequency, 
  MultiSyncConfig, 
  SyncEngineStats,
  SharedOpenBill
} from '../services/MultiNetworkSyncEngine';
import { UserProfile } from '../types';
import { generateOpenBillUUID } from '../utils/uuid';

interface NetworkSyncSettingsProps {
  profile: UserProfile | null;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
}

export const NetworkSyncSettings: React.FC<NetworkSyncSettingsProps> = ({ profile, onShowToast }) => {
  const storeId = profile?.ownerId || 'master_shop';
  const [config, setConfig] = useState<MultiSyncConfig>(multiNetworkSyncEngine.getConfig());
  const [stats, setStats] = useState<SyncEngineStats>({
    mode: config.mode,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lanHostReachable: false,
    lanHostLatencyMs: null,
    firebaseLatencyMs: null,
    pendingLocalHostCount: 0,
    pendingFirebaseCount: 0,
    totalSyncedToday: 0,
    preventedDuplicatesCount: 0,
    lastSuccessfulSyncTime: null
  });

  const [isTestingLan, setIsTestingLan] = useState(false);
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPairingQr, setShowPairingQr] = useState(false);
  const [openBills, setOpenBills] = useState<SharedOpenBill[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [lockTestProductId, setLockTestProductId] = useState('PROD-SAMPLE-01');
  const [lockTestStatus, setLockTestStatus] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Subscribe to engine stats
  useEffect(() => {
    const unsubscribe = multiNetworkSyncEngine.subscribe((newStats) => {
      setStats(newStats);
    });
    return () => unsubscribe();
  }, [storeId]);

  // Subscribe to Open Bills across LAN
  useEffect(() => {
    const unsubBills = multiNetworkSyncEngine.subscribeToOpenBills((bills) => {
      setOpenBills(bills);
    });
    return () => unsubBills();
  }, [storeId]);

  // Handle Mode Change
  const handleModeSelect = (mode: SyncOperatingMode) => {
    const updated = multiNetworkSyncEngine.saveConfig({ mode });
    setConfig(updated);
    if (onShowToast) {
      const modeNames: Record<SyncOperatingMode, string> = {
        offline_standard: 'نمط أوفلاين فردي - Offline Standard',
        local_lan: 'نمط شبكة المحل الداخلية - Local LAN Network',
        firebase_cloud: 'نمط السحاب المباشر - Firebase Cloud'
      };
      onShowToast(`تم تفعيل: ${modeNames[mode]} بنجاح`, 'success');
    }
  };

  // Update LAN Settings
  const handleUpdateLan = (fields: Partial<MultiSyncConfig['lanSettings']>) => {
    const updated = multiNetworkSyncEngine.saveConfig({
      lanSettings: { ...config.lanSettings, ...fields }
    });
    setConfig(updated);
  };

  // Test LAN Connection
  const handleTestLan = async () => {
    setIsTestingLan(true);
    setSyncFeedback(null);
    try {
      const res = await multiNetworkSyncEngine.testLanHostConnection();
      if (res.reachable) {
        setSyncFeedback({
          type: 'success',
          message: `✅ تم الاتصال بنجاح بسيرفر المحل (${config.lanSettings.serverHostIp}:${config.lanSettings.serverPort}) - سرعة الاستجابة: ${res.latencyMs}ms`
        });
      } else {
        setSyncFeedback({
          type: 'error',
          message: `⚠️ تعذر الوصول لخادم المحل: ${res.error || 'تأكد من تشغيل السيرفر واتصال الجهازين بنفس شبكة Wi-Fi'}`
        });
      }
    } catch (e: any) {
      setSyncFeedback({ type: 'error', message: 'فشل اختبار الشبكة: ' + e.message });
    } finally {
      setIsTestingLan(false);
    }
  };

  // Test Firebase Cloud
  const handleTestCloud = async () => {
    setIsTestingCloud(true);
    try {
      const res = await multiNetworkSyncEngine.testCloudConnection();
      if (res.reachable) {
        setSyncFeedback({
          type: 'success',
          message: `☁️ سحاب Firebase متصل ونشط - زمن الاستجابة: ${res.latencyMs}ms`
        });
      } else {
        setSyncFeedback({
          type: 'error',
          message: '❌ لا يوجد اتصال بالإنترنت أو تعذر الوصول لخوادم السحاب'
        });
      }
    } finally {
      setIsTestingCloud(false);
    }
  };

  // Trigger Immediate Full Sync
  const handleTriggerSyncNow = async () => {
    setIsSyncingNow(true);
    setSyncFeedback({ type: 'info', message: 'جاري فحص الطابور والمزامنة الهرمية ومنع التكرار...' });
    try {
      const res = await multiNetworkSyncEngine.triggerFullSync(storeId);
      setSyncFeedback({
        type: 'success',
        message: `✨ اكتملت المزامنة: (محلي: ${res.syncedLocal} | سحابي: ${res.syncedFirebase} | منع تكرار: ${res.preventedDuplicates} | أخطاء: ${res.failed})`
      });
      if (onShowToast) {
        onShowToast('تمت مزامنة العمليات بنجاح', 'success');
      }
    } catch (err: any) {
      setSyncFeedback({ type: 'error', message: 'تعثرت المزامنة: ' + (err?.message || err) });
    } finally {
      setIsSyncingNow(false);
    }
  };

  // Create Sample Held Bill for testing
  const handleCreateSampleHeldBill = async () => {
    setIsLoadingBills(true);
    try {
      const sample = await multiNetworkSyncEngine.holdSharedOpenBill(storeId, {
        cashierId: profile?.id || 'cashier_01',
        cashierName: profile?.name || 'كاشير الصالة',
        tableOrRef: `طاولة #${Math.floor(Math.random() * 20 + 1)}`,
        items: [
          { productId: 'PRD-101', name: 'شاشة سامسونج A12 أصلية', price: 25000, quantity: 1 },
          { productId: 'PRD-202', name: 'كيبل شحن سريع Type-C', price: 3000, quantity: 2 }
        ],
        subtotal: 31000,
        total: 31000,
        customerName: 'محمد عبد الله',
        customerPhone: '777123456',
        notes: 'بانتظار تأكيد استلام القطعة'
      });
      if (onShowToast) {
        onShowToast(`تم تعليق الفاتورة [${sample.id.slice(-8)}] ومشاركتها في الشبكة`, 'success');
      }
    } finally {
      setIsLoadingBills(false);
    }
  };

  // Claim and complete open bill
  const handleClaimBill = async (billId: string) => {
    await multiNetworkSyncEngine.claimAndCompleteOpenBill(storeId, billId, profile?.id || 'cashier_me');
    if (onShowToast) {
      onShowToast('تم سحب الفاتورة المعلقة وتحصيلها بنجاح', 'success');
    }
  };

  // Test Real-time stock lock
  const handleTestStockLock = async () => {
    setLockTestStatus('جاري فحص وحجز المنتج في الشبكة...');
    const res = await multiNetworkSyncEngine.checkAndLockStock(storeId, lockTestProductId, 1, profile?.id || 'cashier_test');
    if (res.locked) {
      setLockTestStatus(`✅ تم حجز المنتج بنجاح ومنع الكاشيرات الآخرين من بيعه مؤقتاً (${res.message})`);
    } else {
      setLockTestStatus(`⚠️ تنبيه: ${res.message} (بواسطة: ${res.holder || 'كاشير آخر'})`);
    }
    setTimeout(() => setLockTestStatus(null), 5000);
  };

  const pairingPayload = JSON.stringify({
    storeId,
    hostIp: config.lanSettings.serverHostIp,
    port: config.lanSettings.serverPort,
    token: config.lanSettings.authToken
  });

  const handleCopyPairingCode = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(pairingPayload);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-navy-900 via-brand-navy to-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-brand-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 text-brand-primary">
              <Network size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-2xl font-black">إعدادات المزامنة والربط الشبكي المتعدد</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-primary/30 text-sky-200 border border-brand-primary/40">
                  JAM Multi-Sync v2.5
                </span>
              </div>
              <p className="text-sm text-gray-300">
                التحكم بأنماط التشغيل (أوفلاين فردي / شبكة المحل LAN / السحاب) مع المزامنة الهرمية ومنع تكرار المبيعات.
              </p>
            </div>
          </div>

          {/* Quick Action Sync Button */}
          <button
            onClick={handleTriggerSyncNow}
            disabled={isSyncingNow || config.mode === 'offline_standard'}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-2xl shadow-lg shadow-brand-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncingNow ? 'animate-spin' : ''}`} />
            <span>{isSyncingNow ? 'جاري المزامنة...' : 'مزامنة الطابور الآن'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Feedback Alert */}
      {syncFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border flex items-center gap-3 ${
            syncFeedback.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : syncFeedback.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
          }`}
        >
          {syncFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : syncFeedback.type === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          ) : (
            <Activity className="w-5 h-5 shrink-0 text-sky-400 animate-spin" />
          )}
          <p className="text-xs font-bold leading-relaxed flex-1">{syncFeedback.message}</p>
          <button 
            onClick={() => setSyncFeedback(null)} 
            className="text-xs font-mono opacity-70 hover:opacity-100 p-1"
          >
            ✕
          </button>
        </motion.div>
      )}

      {/* 1️⃣ SECTION 1: OPERATING MODE SELECTION (Three Cards) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-base font-black text-navy-900 dark:text-white flex items-center gap-2">
            <Layers className="text-brand-primary" size={20} />
            <span>1️⃣ اختيار نمط تشغيل النظام في هذا الجهاز (Operating Mode)</span>
          </label>
          <span className="text-xs font-bold text-gray-500">اختر النمط المناسب لبيئة العمل</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Option 1: Offline Standard */}
          <div
            onClick={() => handleModeSelect('offline_standard')}
            className={`relative p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              config.mode === 'offline_standard'
                ? 'bg-amber-500/10 border-amber-500 shadow-xl shadow-amber-500/10'
                : 'bg-white dark:bg-navy-800 border-gray-100 dark:border-navy-700 hover:border-amber-500/40'
            }`}
          >
            {config.mode === 'offline_standard' && (
              <div className="absolute top-4 left-4 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-md">
                <Check size={14} className="stroke-[3]" />
              </div>
            )}
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                <HardDrive size={26} />
              </div>
              <h4 className="text-lg font-black text-navy-900 dark:text-white mb-2">
                نمط أوفلاين فردي
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                تشغيل مستقل 100% بدون أي اتصال شبكي أو إنترنت. حفظ فوري في الذاكرة المحلية (0ms استجابة).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-navy-700 flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">مناسب للأكشاك المستقلة</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-lg font-mono">Offline-First</span>
            </div>
          </div>

          {/* Option 2: Local LAN Network */}
          <div
            onClick={() => handleModeSelect('local_lan')}
            className={`relative p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              config.mode === 'local_lan'
                ? 'bg-sky-500/10 border-sky-500 shadow-xl shadow-sky-500/10'
                : 'bg-white dark:bg-navy-800 border-gray-100 dark:border-navy-700 hover:border-sky-500/40'
            }`}
          >
            {config.mode === 'local_lan' && (
              <div className="absolute top-4 left-4 w-6 h-6 bg-sky-500 text-white rounded-full flex items-center justify-center shadow-md">
                <Check size={14} className="stroke-[3]" />
              </div>
            )}
            <div>
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-4">
                <Server size={26} />
              </div>
              <h4 className="text-lg font-black text-navy-900 dark:text-white mb-2">
                شبكة المحل الداخلية (LAN)
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                ربط أجهزة الكاشير والعمال بجهاز المالك المركزي عبر واي فاي المحل بدون إنترنت، ثم ترحيل المالك للسحاب لاحقاً.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-navy-700 flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">مزامنة هرمية ثنائية</span>
              <span className="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-lg font-mono">LAN Relay</span>
            </div>
          </div>

          {/* Option 3: Firebase Cloud Direct */}
          <div
            onClick={() => handleModeSelect('firebase_cloud')}
            className={`relative p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              config.mode === 'firebase_cloud'
                ? 'bg-emerald-500/10 border-emerald-500 shadow-xl shadow-emerald-500/10'
                : 'bg-white dark:bg-navy-800 border-gray-100 dark:border-navy-700 hover:border-emerald-500/40'
            }`}
          >
            {config.mode === 'firebase_cloud' && (
              <div className="absolute top-4 left-4 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md">
                <Check size={14} className="stroke-[3]" />
              </div>
            )}
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                <Cloud size={26} />
              </div>
              <h4 className="text-lg font-black text-navy-900 dark:text-white mb-2">
                السحاب المباشر (Firebase)
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                مزامنة سحابية فورية ومباشرة لكافة الفروع والأجهزة مع منع التكرار التلقائي والتشفير الشامل.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-navy-700 flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">مزامنة لحظية مباشرة</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-lg font-mono">Cloud Sync</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2️⃣ SECTION 2: LAN SPECIFIC CONFIGURATION (Shown when LAN mode active) */}
      {config.mode === 'local_lan' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-navy-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-navy-700 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-navy-700 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <Server size={22} />
              </div>
              <div>
                <h4 className="text-lg font-black text-navy-900 dark:text-white">
                  إعدادات وتفاصيل شبكة المحل الداخلية (Local LAN)
                </h4>
                <p className="text-xs text-gray-500">
                  تحديد دور هذا الجهاز وإعدادات السيرفر المحلي لمزامنة العمال بدون إنترنت
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPairingQr(!showPairingQr)}
              className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-bold rounded-xl transition-all"
            >
              <QrCode size={16} />
              <span>{showPairingQr ? 'إخفاء كود الاقتران' : 'إظهار كود الاقتران السريع'}</span>
            </button>
          </div>

          {/* Quick Pairing Modal / Card */}
          {showPairingQr && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 bg-slate-950 border border-sky-500/30 rounded-2xl text-white space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="text-sky-400" size={20} />
                  <span className="text-sm font-bold">كود الاقتران السريع لأجهزة العمال والكاشير</span>
                </div>
                <button
                  onClick={handleCopyPairingCode}
                  className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-bold rounded-lg transition-all"
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? 'تم النسخ' : 'نسخ كود الربط'}</span>
                </button>
              </div>
              <p className="text-xs text-gray-400">
                الصق هذا الكود في أجهزة العمال لربطها فوراً بهذا السيرفر بدون إدخال يدوي للـ IP.
              </p>
              <div className="bg-slate-900 p-3 rounded-xl font-mono text-xs text-sky-300 break-all select-all border border-white/5">
                {pairingPayload}
              </div>
            </motion.div>
          )}

          {/* Role Selection (Host vs Client) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => handleUpdateLan({ nodeRole: 'host_server' })}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                config.lanSettings.nodeRole === 'host_server'
                  ? 'bg-sky-500/10 border-sky-500 text-navy-900 dark:text-white'
                  : 'bg-gray-50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 text-gray-500'
              }`}
            >
              <div className="p-3 bg-sky-500/20 text-sky-500 rounded-xl mt-1">
                <Laptop size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-sm">الجهاز الرئيسي (سيرفر المالك / Host Server)</span>
                  {config.lanSettings.nodeRole === 'host_server' && (
                    <span className="text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded-full font-bold">نشط</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  هذا الجهاز يستقبل عمليات وفواتير العمال داخل المحل بدون إنترنت، ثم يرفعها للسحاب عند توفر الشبكة.
                </p>
              </div>
            </div>

            <div
              onClick={() => handleUpdateLan({ nodeRole: 'client_node' })}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                config.lanSettings.nodeRole === 'client_node'
                  ? 'bg-sky-500/10 border-sky-500 text-navy-900 dark:text-white'
                  : 'bg-gray-50 dark:bg-navy-900/50 border-gray-200 dark:border-navy-700 text-gray-500'
              }`}
            >
              <div className="p-3 bg-sky-500/20 text-sky-500 rounded-xl mt-1">
                <Smartphone size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-sm">جهاز طرفي (كاشير الموظف / Client Node)</span>
                  {config.lanSettings.nodeRole === 'client_node' && (
                    <span className="text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded-full font-bold">نشط</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  هذا الجهاز يسجل العمليات ويرسلها فوراً إلى سيرفر المالك عبر شبكة الواي فاي المحلية.
                </p>
              </div>
            </div>
          </div>

          {/* Host IP & Port Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-navy-900 dark:text-white flex items-center gap-1.5">
                <Link size={14} className="text-sky-500" />
                <span>عنوان IP لسيرفر المحل المحلي (Local Server IP):</span>
              </label>
              <input
                type="text"
                value={config.lanSettings.serverHostIp}
                onChange={(e) => handleUpdateLan({ serverHostIp: e.target.value })}
                placeholder="192.168.1.100"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl font-mono text-sm outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-navy-900 dark:text-white">منفذ الاتصال (Port):</label>
              <input
                type="number"
                value={config.lanSettings.serverPort}
                onChange={(e) => handleUpdateLan({ serverPort: parseInt(e.target.value) || 8080 })}
                placeholder="8080"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl font-mono text-sm outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Test & Frequency Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-navy-700">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestLan}
                disabled={isTestingLan}
                className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                <Activity size={16} className={isTestingLan ? 'animate-spin' : ''} />
                <span>{isTestingLan ? 'جاري الفحص...' : 'فحص الاتصال بسيرفر المحل'}</span>
              </button>

              <button
                onClick={handleTestCloud}
                disabled={isTestingCloud}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-navy-900 hover:bg-gray-200 text-navy-900 dark:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                <Cloud size={16} />
                <span>فحص السحاب</span>
              </button>
            </div>

            {/* Sync Frequency Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-gray-500 shrink-0">تردد المزامنة:</span>
              <select
                value={config.lanSettings.syncFrequency}
                onChange={(e) => handleUpdateLan({ syncFrequency: e.target.value as SyncFrequency })}
                className="px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-bold outline-none"
              >
                <option value="realtime">⚡ فوري عند كل عملية (Real-time)</option>
                <option value="every_1min">⏱️ كل دقيقة تلقائياً</option>
                <option value="every_5min">⏳ كل 5 دقائق</option>
                <option value="manual">🖐️ يدوي عند الطلب فقط</option>
              </select>
            </div>
          </div>
        </motion.div>
      )}

      {/* 3️⃣ SECTION 3: REAL-TIME LAN SHARED OPEN BILLS & INVENTORY LOCK HUB */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card A: Shared Open Bills (استكمال الفواتير المفتوحة والمعلقة بين الكاشيرات) */}
        <div className="bg-white dark:bg-navy-800 p-6 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-navy-700 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-navy-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <ShoppingCart size={20} />
              </div>
              <div>
                <h4 className="text-base font-black text-navy-900 dark:text-white">
                  الفواتير المفتوحة والمعلقة المشتركة (LAN Open Bills)
                </h4>
                <p className="text-[11px] text-gray-500">
                  إمكانية إنشاء فاتورة من كاشير واستكمالها أو تحصيلها من كاشير آخر
                </p>
              </div>
            </div>

            <button
              onClick={handleCreateSampleHeldBill}
              disabled={isLoadingBills}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <Clock size={14} />
              <span>+ تعليق تجريبي</span>
            </button>
          </div>

          {openBills.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-navy-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-navy-700">
              <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-gray-500">لا توجد فواتير معلقة حالياً في شبكة المحل</p>
              <p className="text-[10px] text-gray-400 mt-1">عند تعليق أي سلة من الكاشير ستظهر هنا فوراً لكافة الأجهزة</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {openBills.map((bill) => (
                <div
                  key={bill.id}
                  className="p-3.5 bg-gray-50 dark:bg-navy-900/60 rounded-xl border border-gray-200 dark:border-navy-700 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-navy-900 dark:text-white">
                        {bill.customerName || bill.tableOrRef || 'فاتورة معلقة'}
                      </span>
                      <span className="text-[9px] font-mono bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                        {bill.items.length} أصناف
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500">
                      الكاشير: <span className="text-gray-400">{bill.cashierName}</span> | المبلغ:{' '}
                      <span className="font-mono text-emerald-400 font-bold">{bill.total.toLocaleString()} ر.ي</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleClaimBill(bill.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
                  >
                    <CheckCheck size={14} />
                    <span>سحب وتحصيل</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card B: Real-time Inventory Quantity Lock (منع بيع نفس المنتج من كاشيرين مختلفين) */}
        <div className="bg-white dark:bg-navy-800 p-6 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-navy-700 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-navy-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h4 className="text-base font-black text-navy-900 dark:text-white">
                  القفل اللحظي للمخزون (Real-time Stock Lock)
                </h4>
                <p className="text-[11px] text-gray-500">
                  منع بيع نفس الصنف عند قلة الكمية من كاشيرين مختلفين في نفس الثانية
                </p>
              </div>
            </div>

            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Active Protection
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              يقوم النظام بحجز مؤقت لمدة 60 ثانية للصنف لحظة إضافته لسلة أي كاشير، ويبث الكمية المحجوزة فوراً لجميع الأجهزة الأخرى عبر الشبكة المحلية لمنع البيع المزدوج أو التضارب.
            </p>

            <div className="p-4 bg-gray-50 dark:bg-navy-900/60 rounded-2xl border border-gray-200 dark:border-navy-700 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-navy-900 dark:text-white">تجربة حجز صنف عبر الشبكة:</span>
                <input
                  type="text"
                  value={lockTestProductId}
                  onChange={(e) => setLockTestProductId(e.target.value)}
                  className="px-2.5 py-1 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg text-xs font-mono w-40 text-left outline-none"
                />
              </div>

              <button
                onClick={handleTestStockLock}
                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock size={14} />
                <span>فحص وتفعيل حجز الصنف في الشبكة المحلية الآن</span>
              </button>

              {lockTestStatus && (
                <p className="text-xs font-bold text-sky-400 bg-sky-500/10 p-2 rounded-lg text-center animate-fade-in">
                  {lockTestStatus}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4️⃣ SECTION 4: HIERARCHICAL SYNC & DE-DUPLICATION DASHBOARD */}
      <div className="bg-white dark:bg-navy-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-navy-700 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-navy-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="text-lg font-black text-navy-900 dark:text-white">
                حالة المزامنة الهرمية ومنع التكرار (Data Sync & De-duplication)
              </h4>
              <p className="text-xs text-gray-500">
                متابعة الحركات عبر المستويين (المستوى 1: المحطة المحلية | المستوى 2: السحاب المباشر)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${stats.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-xs font-bold text-gray-500">
              {stats.isOnline ? 'الإنترنت متصل' : 'في وضع الأوفلاين'}
            </span>
          </div>
        </div>

        {/* Hierarchical Flow Diagram */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-navy-950 to-slate-900 rounded-2xl border border-white/10 text-white space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-300 font-bold mb-1">
            <span>مسار المزامنة الهرمي الآمن (Hierarchical Hub Flow):</span>
            <span className="text-emerald-400 font-mono">Zero Data Loss Protocol</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-1">
                <Smartphone size={16} />
              </div>
              <p className="text-xs font-bold">1. أجهزة العمال</p>
              <p className="text-[10px] text-gray-400">تسجيل مبيعات أوفلاين فوري</p>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-1">
                <Server size={16} />
              </div>
              <p className="text-xs font-bold">2. سيرفر المالك المحلي (LAN)</p>
              <p className="text-[10px] text-gray-400">تجميع فوري بدون إنترنت</p>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1">
                <Cloud size={16} />
              </div>
              <p className="text-xs font-bold">3. سحاب Firebase</p>
              <p className="text-[10px] text-gray-400">رفع نهائي وتأمين سحابي</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Metric 1 */}
          <div className="p-4 bg-gray-50 dark:bg-navy-900/60 rounded-2xl border border-gray-100 dark:border-navy-700">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-[11px] font-bold">بانتظار سيرفر المحل</span>
              <Server size={16} className="text-sky-500" />
            </div>
            <p className="text-2xl font-black text-navy-900 dark:text-white font-mono">
              {stats.pendingLocalHostCount}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">المستوى 1 (LAN)</p>
          </div>

          {/* Metric 2 */}
          <div className="p-4 bg-gray-50 dark:bg-navy-900/60 rounded-2xl border border-gray-100 dark:border-navy-700">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-[11px] font-bold">بانتظار رفع السحاب</span>
              <Cloud size={16} className="text-brand-primary" />
            </div>
            <p className="text-2xl font-black text-navy-900 dark:text-white font-mono">
              {stats.pendingFirebaseCount}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">المستوى 2 (Firebase)</p>
          </div>

          {/* Metric 3: Deduplication counter */}
          <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <div className="flex items-center justify-between text-emerald-500 mb-2">
              <span className="text-[11px] font-bold">تكرارات تم منعها</span>
              <ShieldCheck size={16} />
            </div>
            <p className="text-2xl font-black text-emerald-500 font-mono">
              {stats.preventedDuplicatesCount}
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">حماية UUID v4 فريدة</p>
          </div>

          {/* Metric 4: Synced Today */}
          <div className="p-4 bg-gray-50 dark:bg-navy-900/60 rounded-2xl border border-gray-100 dark:border-navy-700">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-[11px] font-bold">إجمالي المتزامن</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-navy-900 dark:text-white font-mono">
              {stats.totalSyncedToday}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              آخر مزامنة: {stats.lastSuccessfulSyncTime || 'الآن'}
            </p>
          </div>
        </div>

        {/* 5️⃣ STORE ISOLATION ARCHITECTURE & OFFLINE-FIRST COMPLIANCE CARD */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-gradient-to-r from-navy-900/40 via-slate-900/30 to-navy-900/40 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-brand-primary/20 text-brand-primary rounded-xl shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">معمارية العزل الصارم للمتجر (Store Isolation)</span>
                  <span className="px-2 py-0.5 text-[9px] font-mono bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                    Enforced
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  كافة العمليات مشفرة ومقيدة بالمعرف: <span className="font-mono text-sky-300">{storeId}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 bg-gradient-to-r from-navy-900/40 via-slate-900/30 to-navy-900/40 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                <Cpu size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">نظام توليد UUID v4 القياسي</span>
                  <span className="px-2 py-0.5 text-[9px] font-mono bg-sky-500/20 text-sky-300 rounded-full border border-sky-500/30">
                    RFC4122 v4
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  إلغاء تام للأرقام المتسلسلة لضمان استحالة التصادم أثناء الدمج
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
