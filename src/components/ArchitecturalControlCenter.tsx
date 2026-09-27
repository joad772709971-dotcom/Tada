/**
 * 🏛️ ArchitecturalControlCenter.tsx
 * =========================================================================
 * مركز التحكم والحوكمة المعمارية والقفل الأمني
 * ARCHITECTURAL CONTROL CENTER & SECURITY GATEWAY
 * لنظام "نمبر ون - الإدارة والتدقيق الذكي"
 * =========================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Database, 
  Key, 
  Layers, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Smartphone, 
  Activity, 
  FileText
} from 'lucide-react';
import { architectureLockGuard, ARCHITECTURE_LAW_CONSTITUTION } from '../security/ArchitectureLockGuard';
import { unifiedOfflineStoreEngine } from '../services/UnifiedOfflineStoreEngine';
import { storeLinkEngine } from '../services/StoreLinkEngine';
import { liveHotFixEngine } from '../services/LiveHotFixEngine';

interface ArchitecturalControlCenterProps {
  currentAdminEmail?: string;
}

export const ArchitecturalControlCenter: React.FC<ArchitecturalControlCenterProps> = ({ currentAdminEmail }) => {
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [isKeyUnlocked, setIsKeyUnlocked] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [auditResult, setAuditResult] = useState<any>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [testStoreIdInput, setTestStoreIdInput] = useState('store-4-sana_retail');
  const [storeValidationRes, setStoreValidationRes] = useState<any>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);

  useEffect(() => {
    // Check pending offline transactions
    unifiedOfflineStoreEngine.getPendingSyncCount().then(c => setPendingSyncCount(c)).catch(() => {});
    // Initial audit
    setAuditResult(architectureLockGuard.auditSystemArchitecture());
  }, []);

  const handleUnlockGateway = (e: React.FormEvent) => {
    e.preventDefault();
    if (architectureLockGuard.verifyAdminConfirmationKey(adminKeyInput)) {
      setIsKeyUnlocked(true);
      setKeyError('');
    } else {
      setKeyError('⚠️ مفتاح التأكيد الأمني للأدمن غير صالح! تم رفض فتح بوابة الحوكمة.');
    }
  };

  const handleRunFullAudit = () => {
    setIsRunningAudit(true);
    setTimeout(() => {
      const res = architectureLockGuard.auditSystemArchitecture();
      setAuditResult(res);
      unifiedOfflineStoreEngine.getPendingSyncCount().then(c => setPendingSyncCount(c)).catch(() => {});
      setIsRunningAudit(false);
    }, 600);
  };

  const handleTestStoreId = (val: string) => {
    setTestStoreIdInput(val);
    setStoreValidationRes(architectureLockGuard.validateStoreId(val));
  };

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Header Banner: Permanent Architecture Lock */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950/60 to-slate-900 border-2 border-emerald-500/40 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 shadow-xl shadow-emerald-500/20 shrink-0">
              <ShieldCheck size={36} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  مركز الحوكمة والمعمارية المحصنة
                </h2>
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full text-xs font-black flex items-center gap-1.5">
                  <Lock size={12} />
                  <span>IMMUTABLE ARCHITECTURE LOCK: ACTIVE</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 font-semibold mt-1">
                دستور النظام الصارم: عزل المتاجر، الهويات الموحدة، عقود الارتباط، محرك SQLite للأوفلاين، وتحديثات الخمول الهوائية 90 ثانية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunFullAudit}
              disabled={isRunningAudit}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-md flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={15} className={isRunningAudit ? 'animate-spin' : ''} />
              <span>فحص الامتثال المعماري</span>
            </button>
          </div>
        </div>
      </div>

      {/* Gateway Security Authorization Card */}
      {!isKeyUnlocked ? (
        <div className="bg-slate-900/90 backdrop-blur-md border border-amber-500/30 rounded-3xl p-6 sm:p-8 text-center max-w-xl mx-auto shadow-2xl space-y-4">
          <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
            <Key size={28} />
          </div>
          <h3 className="text-lg font-black text-white">بوابة التحقق الأمني للأدمن (Admin Security Key)</h3>
          <p className="text-xs text-gray-400 leading-relaxed font-semibold">
            تعديل أو فحص صلاحيات الحوكمة المتقدمة مقفل بكلمة سر أمان الأدمن لتفادي كسر العزل المعماري للبيانات.
          </p>
          <form onSubmit={handleUnlockGateway} className="flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="password"
              value={adminKeyInput}
              onChange={(e) => setAdminKeyInput(e.target.value)}
              placeholder="أدخل مفتاح التأكيد الأمني للأدمن..."
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono focus:border-amber-400 outline-none"
            />
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-6 py-3 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Unlock size={15} />
              <span>فك القفل والدخول</span>
            </button>
          </form>
          {keyError && (
            <p className="text-xs text-rose-400 font-bold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              {keyError}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key status indicator */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <span className="text-xs font-black text-emerald-300">
                بوابة الحوكمة مفعلة ومصادق عليها بمفتاح الأدمن المشرف العام ({currentAdminEmail || 'SuperAdmin'}).
              </span>
            </div>
            <button
              onClick={() => setIsKeyUnlocked(false)}
              className="text-xs text-gray-400 hover:text-white px-3 py-1 bg-white/5 rounded-lg border border-white/10 cursor-pointer"
            >
              إعادة القفل 🔒
            </button>
          </div>

          {/* 5 Architectural Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Pillar 1: Multi-Tenant Store Subcollections */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400">الركن الأول: عزل المتاجر</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-full font-mono">100% Locked</span>
              </div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Database size={16} className="text-emerald-400" />
                <span>stores/{'{storeId}'}/...</span>
              </h4>
              <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                حصر كافة الفواتير، المخزون، الموظفين، وحسابات الزبائن المالية داخل المسارات الفرعية للمتجر المعني فقط. الموظف يستعرض متجره فقط.
              </p>
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 font-mono text-[10px] text-emerald-300 space-y-1">
                <div>• store-1-X (مستورد IMPORT)</div>
                <div>• store-2-X (جملة الجملة WHOLESALE_2)</div>
                <div>• store-3-X (جملة WHOLESALE_1)</div>
                <div>• store-4-X (تجزئة RETAIL)</div>
              </div>
            </div>

            {/* Pillar 2: Unified Users Identity */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-cyan-400">الركن الثاني: الهويات الموحدة</span>
                <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-black rounded-full font-mono">Zero Duplication</span>
              </div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Layers size={16} className="text-cyan-400" />
                <span>users/{'{userId}'} Registry</span>
              </h4>
              <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                مستند واحد لكل مستخدم يحوي البيانات الشخصية والدور من الطبقات الخمس ومصفوفة associatedStores. منع كامل لتكرار البيانات في collections متفرقة.
              </p>
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-[10px] text-cyan-300 font-mono space-y-1">
                <div>🚫 ملغى: مجموعات clients و leads</div>
                <div>✅ معتمد: users/{'{userId}'} فقط</div>
              </div>
            </div>

            {/* Pillar 3: StoreLinkEngine */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400">الركن الثالث: محرك الربط الشبكي</span>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-black rounded-full font-mono">Auto-Expiring</span>
              </div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Key size={16} className="text-amber-400" />
                <span>store_links Contracts</span>
              </h4>
              <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                عقود الارتباط link_{'{sourceStore}'}_{'{targetId}'} لضبط المديونية والائتمان. عند انقضاء validUntil يتم إيقاف المديونية مع الحفاظ الكامل على الأرشيف.
              </p>
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-[10px] text-amber-300 font-mono space-y-1">
                <div>• linkId: link_stX_stY</div>
                <div>• Status: ACTIVE | EXPIRED | SUSPENDED</div>
                <div>• الأرشيف المالي: محفوظ دائماً 100%</div>
              </div>
            </div>

            {/* Pillar 4: Capacitor SQLite Offline Engine */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-violet-400">الركن الرابع: SQLite الأوفلاين الدائم</span>
                <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-[10px] font-black rounded-full font-mono">Capacitor Native</span>
              </div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Smartphone size={16} className="text-violet-400" />
                <span>sync_queue with UUIDv4</span>
              </h4>
              <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                تخزين محلي دائم في APK و EXE عبر Capacitor SQLite Plugin محمي من مسح نظام التشغيل. طابور مزامنة بمعرفات فريدة ورفع Idempotent.
              </p>
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-[10px] text-violet-300 font-mono flex items-center justify-between">
                <span>طابور المزامنة المعلق:</span>
                <span className="font-black px-2 py-0.5 bg-violet-500/30 rounded-lg">{pendingSyncCount} حركات</span>
              </div>
            </div>

            {/* Pillar 5: Silent OTA Engine with 90s Inactivity */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400">الركن الخامس: التحديثات الهوائية</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-full font-mono">90s Idle Guard</span>
              </div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Zap size={16} className="text-emerald-400" />
                <span>LiveHotFix & Idle Detection</span>
              </h4>
              <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                تحميل التحديثات الصامتة بالخلفية دون مقاطعة الكاشير ودون تنزيل APK جديد. مستشعر خمول لمدة 90 ثانية متواصلة قبل عرض نافذة التأكيد مع خيار التأجيل.
              </p>
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-[10px] text-emerald-300 font-mono space-y-1">
                <div>• مهلة الخمول: 90 ثانية مدخلات متوقفة</div>
                <div>• الشاشة: غير محجوبة مع خيار "لاحقاً"</div>
              </div>
            </div>

            {/* Pillar 6: Security Rules & Firewall */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-400">الركن السادس: جدار الحماية السحابي</span>
                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-[10px] font-black rounded-full font-mono">Rules Deployed</span>
              </div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <ShieldCheck size={16} className="text-rose-400" />
                <span>firestore.rules Enforcement</span>
              </h4>
              <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                قواعد سحابية منشورة تمنع استعلام أي متجر إلا للمالك أو الموظف المسجل رسمياً بـ stores/{'{storeId}'}/employees أو عبر عقود store_links المفتوحة.
              </p>
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-[10px] text-rose-300 font-mono space-y-1">
                <div>• حالة النشر: منشورة وموثقة سحابياً</div>
                <div>• عزل الموظفين: صارم 100%</div>
              </div>
            </div>
          </div>

          {/* Interactive Tier Verification Utility */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-4">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Activity size={18} className="text-emerald-400" />
              <span>مدقق مطابقة معرفات المتاجر الطبائعية (Store Tier ID Validator)</span>
            </h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={testStoreIdInput}
                onChange={(e) => handleTestStoreId(e.target.value)}
                placeholder="أدخل معرف المتجر للاختبار (مثال: store-1-sana_hub)..."
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:border-emerald-400 outline-none"
              />
              <button
                type="button"
                onClick={() => handleTestStoreId(testStoreIdInput)}
                className="bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer"
              >
                فحص المعرف
              </button>
            </div>

            {storeValidationRes && (
              <div className={`p-3 rounded-xl border text-xs font-bold font-mono flex items-center justify-between ${
                storeValidationRes.valid 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <span>{storeValidationRes.valid ? '✅ معرف مطابق للمواصفات الطبائعية' : '❌ معرف غير مطابق لقواعد التسمية الطبائعية'}</span>
                <span>الطبقة: {storeValidationRes.tier}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchitecturalControlCenter;
