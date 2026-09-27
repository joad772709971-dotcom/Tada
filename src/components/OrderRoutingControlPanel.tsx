import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  Key, 
  DollarSign, 
  Send, 
  Edit3, 
  ShieldCheck, 
  Users, 
  UserCheck, 
  Truck, 
  PackageCheck, 
  RotateCcw, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Wallet, 
  CreditCard, 
  ArrowLeftRight, 
  Clock, 
  Sliders, 
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface OrderRoutingSettings {
  // 1. Linkage & Payment Rules
  requireValidLinkKey: boolean;
  enforceLinkKeyExpiration: boolean;
  linkKeyValidityDays: number;
  primaryCurrency: 'YER' | 'SAR' | 'USD';
  allowedCurrencies: ('YER' | 'SAR' | 'USD')[];
  allowedPaymentTypes: ('cash' | 'debt' | 'wallet')[];
  
  // 2. Order Sending & Editing
  sendMode: 'immediate' | 'draft_batch';
  allowEditInPending: boolean;
  allowCancelBeforePrep: boolean;
  
  // 3. Auto-Fallback Role Routing Shield & Timeout Presence Guard
  enableAutoRoleFallback: boolean;
  checkOnlinePresence: boolean;
  routingTimeoutMinutes: number;
  enableOrderProcessingLock: boolean;
  cashierFallbackRole: 'manager' | 'sales_agent';
  packerFallbackRole: 'manager' | 'sales_agent';
  deliveryFallbackRole: 'manager' | 'sales_agent';
  
  // 4. Field Matching & Warehouse/Financial Settlement Engine
  enableTransitFrozenExpense: boolean;
  autoIngestToStockOnVerify: boolean;
  autoUpdateStockCostPrice: boolean;
  autoPostLedgerExpenseOnVerify: boolean;
  
  // 5. Returns, Damaged Goods, & Substitutes Management
  refundMethod: 'cash_refund' | 'supplier_ledger_credit' | 'replacement_dispatch';
  autoDispatchReplacementToPrep: boolean;
  deductFromSupplierLedgerImmediately: boolean;
}

export const DEFAULT_ORDER_ROUTING_SETTINGS: OrderRoutingSettings = {
  requireValidLinkKey: true,
  enforceLinkKeyExpiration: true,
  linkKeyValidityDays: 90,
  primaryCurrency: 'YER',
  allowedCurrencies: ['YER', 'SAR', 'USD'],
  allowedPaymentTypes: ['cash', 'debt', 'wallet'],
  
  sendMode: 'immediate',
  allowEditInPending: true,
  allowCancelBeforePrep: true,
  
  enableAutoRoleFallback: true,
  checkOnlinePresence: true,
  routingTimeoutMinutes: 5,
  enableOrderProcessingLock: true,
  cashierFallbackRole: 'manager',
  packerFallbackRole: 'manager',
  deliveryFallbackRole: 'manager',
  
  enableTransitFrozenExpense: true,
  autoIngestToStockOnVerify: true,
  autoUpdateStockCostPrice: true,
  autoPostLedgerExpenseOnVerify: true,
  
  refundMethod: 'supplier_ledger_credit',
  autoDispatchReplacementToPrep: true,
  deductFromSupplierLedgerImmediately: true,
};

export default function OrderRoutingControlPanel() {
  const [settings, setSettings] = useState<OrderRoutingSettings>(() => {
    const saved = localStorage.getItem('jam_order_routing_config_v1');
    if (saved) {
      try {
        return { ...DEFAULT_ORDER_ROUTING_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('Failed to parse order routing config from localStorage:', e);
      }
    }
    return DEFAULT_ORDER_ROUTING_SETTINGS;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const fetchRemoteSettings = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'order_routing_config');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const remoteData = snap.data();
          const merged = { ...DEFAULT_ORDER_ROUTING_SETTINGS, ...remoteData };
          setSettings(merged);
          localStorage.setItem('jam_order_routing_config_v1', JSON.stringify(merged));
        }
      } catch (err) {
        console.warn('Unable to load remote order routing config, using cached settings:', err);
      }
    };
    fetchRemoteSettings();
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      // 1. Save to localStorage
      localStorage.setItem('jam_order_routing_config_v1', JSON.stringify(settings));

      // 2. Broadcast custom system event
      window.dispatchEvent(new CustomEvent('jam_order_routing_updated', { detail: settings }));

      // 3. Persist to Firestore
      const docRef = doc(db, 'system_settings', 'order_routing_config');
      await setDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: 'Joad7723 (Master Owner)'
      }, { merge: true });

      setSaveMessage('✅ تم حفظ ونشر إعدادات مسارات الطلب والخصومات والتحويل التلقائي بنجاح في سحابة فايربيس!');
    } catch (err: any) {
      console.warn('Error saving order routing settings remotely:', err?.message);
      setSaveMessage('✅ تم حفظ الإعدادات محلياً بنجاح وسيعمل النظام أوفلاين بحسب القواعد المحدثة!');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 6000);
    }
  };

  const toggleCurrency = (currency: 'YER' | 'SAR' | 'USD') => {
    setSettings(prev => {
      const exists = prev.allowedCurrencies.includes(currency);
      if (exists && prev.allowedCurrencies.length === 1) {
        return prev; // At least one currency must remain allowed
      }
      const updated = exists 
        ? prev.allowedCurrencies.filter(c => c !== currency)
        : [...prev.allowedCurrencies, currency];
      return { ...prev, allowedCurrencies: updated };
    });
  };

  const togglePaymentType = (type: 'cash' | 'debt' | 'wallet') => {
    setSettings(prev => {
      const exists = prev.allowedPaymentTypes.includes(type);
      if (exists && prev.allowedPaymentTypes.length === 1) {
        return prev; // At least one payment type must remain
      }
      const updated = exists 
        ? prev.allowedPaymentTypes.filter(t => t !== type)
        : [...prev.allowedPaymentTypes, type];
      return { ...prev, allowedPaymentTypes: updated };
    });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-2 border-amber-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/40 text-amber-400">
                <GitFork size={32} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  صفحة إعدادات مسارات الطلب والخصومات والبدائل السيادية
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                    Order Lifecycle & Routing Panel
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  الضبط المركزي لمفاتيح B2B، التوجيه الذكي عند غياب الموظف، تجميد المصاريف أونلاين وأوفلاين، والتسوية المخزنية التلقائية.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={isSaving}
            type="button"
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            <span>حفظ واعتماد مسارات الطلبات</span>
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border-2 border-emerald-500 text-emerald-200 text-xs sm:text-sm font-black flex items-center gap-3 animate-fade-in shadow-xl">
          <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Section 1: Linkage & Payment Rules */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 shadow-xl space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
              <Key size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">1. شروط مفاتيح الارتباط والعملات</h3>
              <p className="text-xs text-slate-400">تحقق تلقائي من صلاحية مفاتيح B2B وتحديد خيارات الدفع والعملات</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Require Valid Link Key */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-amber-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">التحقق الإجباري من مفتاح B2B وسريانه</span>
                <span className="text-[11px] text-slate-400 block">حظر تمرير أي طلب بين المتاجر إلا بوجود مفتاح نشط وساري</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.requireValidLinkKey}
                onChange={e => setSettings(prev => ({ ...prev, requireValidLinkKey: e.target.checked }))}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </label>

            {/* Enforce Expiration */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-amber-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">إنهاء صلاحية المفاتيح المنتهية تلقائياً</span>
                <span className="text-[11px] text-slate-400 block">إيقاف طلبات B2B فور انتهاء فترة صلاحية مفتاح الشريك</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.enforceLinkKeyExpiration}
                onChange={e => setSettings(prev => ({ ...prev, enforceLinkKeyExpiration: e.target.checked }))}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </label>

            {/* Currency Multi-Select */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
              <span className="font-black text-white block">العملات المسموحة في التسوية والطلب:</span>
              <div className="flex gap-2">
                {[
                  { id: 'YER', label: 'ريال يمني (YER)' },
                  { id: 'SAR', label: 'ريال سعودي (SAR)' },
                  { id: 'USD', label: 'دولار أمريكي (USD)' }
                ].map(curr => (
                  <button
                    key={curr.id}
                    type="button"
                    onClick={() => toggleCurrency(curr.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-all cursor-pointer ${
                      settings.allowedCurrencies.includes(curr.id as any)
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {curr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method Allowed */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
              <span className="font-black text-white block">طرق السداد المعتمدة للطلبات:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'cash', label: 'نقداً من صندوق الكاشير' },
                  { id: 'debt', label: 'آجل ضمن سقف الدين' },
                  { id: 'wallet', label: 'محفظة إلكترونية' }
                ].map(pt => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => togglePaymentType(pt.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-all cursor-pointer ${
                      settings.allowedPaymentTypes.includes(pt.id as any)
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Order Sending & Editing */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-indigo-500/30 shadow-xl space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
              <Send size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">2. خيارات إرسال وتعديل الطلب</h3>
              <p className="text-xs text-slate-400">التحكم بإرسال الطلب فوراً أو تجميعه كمسودة وتعديله قبل التجهيز</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Immediate vs Draft mode */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
              <span className="font-black text-white block">نمط الإرسال الافتراضي للطلبات:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, sendMode: 'immediate' }))}
                  className={`p-2.5 rounded-xl text-center font-black transition-all cursor-pointer ${
                    settings.sendMode === 'immediate'
                      ? 'bg-emerald-600 text-white shadow-md border border-emerald-400'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Send size={14} className="inline ml-1" />
                  <span>إرسال فوري مباشر</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, sendMode: 'draft_batch' }))}
                  className={`p-2.5 rounded-xl text-center font-black transition-all cursor-pointer ${
                    settings.sendMode === 'draft_batch'
                      ? 'bg-purple-600 text-white shadow-md border border-purple-400'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Edit3 size={14} className="inline ml-1" />
                  <span>حفظ كمسودة للتعديل والإرسال</span>
                </button>
              </div>
            </div>

            {/* Edit while pending */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-indigo-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">السماح بتعديل الكميات بالطلب في حالة الانتظار (Pending)</span>
                <span className="text-[11px] text-slate-400 block">إمكانية الحذف والإضافة طالما لم يبدأ المورد بتجهيز الطلب</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.allowEditInPending}
                onChange={e => setSettings(prev => ({ ...prev, allowEditInPending: e.target.checked }))}
                className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
              />
            </label>

            {/* Cancel before prep */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-indigo-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">إمكانية إلغاء الطلب بالكامل من المشتري قبل موافقة التاجر</span>
                <span className="text-[11px] text-slate-400 block">فك تجميد المبلغ وإرجاعه فوراً للصندوق عند الإلغاء المبكر</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.allowCancelBeforePrep}
                onChange={e => setSettings(prev => ({ ...prev, allowCancelBeforePrep: e.target.checked }))}
                className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Section 3: Auto-Fallback Role Routing Shield */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-purple-500/30 shadow-xl space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div className="p-2 bg-purple-500/20 rounded-xl text-purple-400">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">3. درع التوجيه التكيفي عند غياب الموظف</h3>
              <p className="text-xs text-slate-400">تحويل مراحل الطلب تلقائياً للمدير أو المبيعات عند عدم وجود صراف أو سائق بالمحل</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Enable Auto Fallback */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-purple-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">تفعيل التوجيه التلقائي البديل (Auto-Fallback Shield)</span>
                <span className="text-[11px] text-slate-400 block">منع توقف أي طلب إطلاقاً عند غياب مسمى وظيفي محدد بالمحل المستهدف</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.enableAutoRoleFallback}
                onChange={e => setSettings(prev => ({ ...prev, enableAutoRoleFallback: e.target.checked }))}
                className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
              />
            </label>

            {/* Check Online Presence */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-purple-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">فحص الوجود الفعلي وحالة الاتصال للموظف (Online Presence Guard)</span>
                <span className="text-[11px] text-slate-400 block">التحقق من اتصال الموظف أو نشاطه الأخير قبل معالجة الطلب</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.checkOnlinePresence}
                onChange={e => setSettings(prev => ({ ...prev, checkOnlinePresence: e.target.checked }))}
                className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
              />
            </label>

            {/* Timeout Window */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-black text-white block">مهلة الانتظار الزمنية للتحويل البديل (Timeout Window):</span>
                <span className="text-[11px] text-slate-400">إذا لم يستجب الموظف الأصلي خلال هذا الوقت يتم التحويل فوراً</span>
              </div>
              <select
                value={settings.routingTimeoutMinutes}
                onChange={e => setSettings(prev => ({ ...prev, routingTimeoutMinutes: Number(e.target.value) }))}
                className="bg-slate-900 text-purple-300 font-black border border-purple-500/40 rounded-xl p-2 focus:outline-none"
              >
                <option value={1}>1 دقيقة (عاجل جداً)</option>
                <option value={3}>3 دقائق</option>
                <option value={5}>5 دقائق (موصى به)</option>
                <option value={10}>10 دقائق</option>
                <option value={15}>15 دقيقة</option>
                <option value={30}>30 دقيقة</option>
              </select>
            </div>

            {/* Request Processing Lock */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-purple-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">آلية قفل الطلب عند بدء معالجته (Request Lock Guard)</span>
                <span className="text-[11px] text-slate-400 block">قفل الطلب وحظر تحويله عند فتح الموظف للطلب وبدء العمل لتجنب الازدوادية</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.enableOrderProcessingLock}
                onChange={e => setSettings(prev => ({ ...prev, enableOrderProcessingLock: e.target.checked }))}
                className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
              />
            </label>

            {/* Cashier Fallback */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-black text-white block">بديل عامل الصندوق (Cashier):</span>
                <span className="text-[11px] text-slate-400">إذا لم يوجد عامل صندوق مسجل بالمحل</span>
              </div>
              <select
                value={settings.cashierFallbackRole}
                onChange={e => setSettings(prev => ({ ...prev, cashierFallbackRole: e.target.value as any }))}
                className="bg-slate-900 text-purple-300 font-black border border-purple-500/40 rounded-xl p-2 focus:outline-none"
              >
                <option value="manager">المدير العام (Manager)</option>
                <option value="sales_agent">مفوض المبيعات (Sales)</option>
              </select>
            </div>

            {/* Packer Fallback */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-black text-white block">بديل موظف المستودعات والتجهيز (Packer):</span>
                <span className="text-[11px] text-slate-400">إذا لم يوجد عامل مستودع بالمحل</span>
              </div>
              <select
                value={settings.packerFallbackRole}
                onChange={e => setSettings(prev => ({ ...prev, packerFallbackRole: e.target.value as any }))}
                className="bg-slate-900 text-purple-300 font-black border border-purple-500/40 rounded-xl p-2 focus:outline-none"
              >
                <option value="manager">المدير العام (Manager)</option>
                <option value="sales_agent">مفوض المبيعات (Sales)</option>
              </select>
            </div>

            {/* Delivery Fallback */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-black text-white block">بديل عامل التوصيل والسائق (Delivery):</span>
                <span className="text-[11px] text-slate-400">إذا لم يوجد سائق توصيل بالمحل</span>
              </div>
              <select
                value={settings.deliveryFallbackRole}
                onChange={e => setSettings(prev => ({ ...prev, deliveryFallbackRole: e.target.value as any }))}
                className="bg-slate-900 text-purple-300 font-black border border-purple-500/40 rounded-xl p-2 focus:outline-none"
              >
                <option value="manager">المدير العام (Manager)</option>
                <option value="sales_agent">مفوض المبيعات (Sales)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Matching & Warehouse/Financial Settlement Engine */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-xl space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
              <PackageCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">4. المطابقة الميدانية والتسوية الآلية</h3>
              <p className="text-xs text-slate-400">تجميد المبالغ المعلقة والتغذية الفورية للمخزن وتحديث الحسابات عند الاستلام</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Transit Frozen Expense */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-emerald-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">تجميد المبلغ أثناء الطريق (Transit Frozen Expense)</span>
                <span className="text-[11px] text-slate-400 block">حفظ المبلغ معلقاً لحين تأكيد وصول الشحنة ومطابقتها</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.enableTransitFrozenExpense}
                onChange={e => setSettings(prev => ({ ...prev, enableTransitFrozenExpense: e.target.checked }))}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </label>

            {/* Auto Ingest to Stock */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-emerald-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">التغذية الآلية الفورية للمخزن عند "تأكيد الاستلام"</span>
                <span className="text-[11px] text-slate-400 block">إضافة الكميات تلقائياً إلى مخزن المحل وإصدار كروت الأصناف</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.autoIngestToStockOnVerify}
                onChange={e => setSettings(prev => ({ ...prev, autoIngestToStockOnVerify: e.target.checked }))}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </label>

            {/* Auto Update Cost Price */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-emerald-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">تحديث سعر التكلفة النهائي بالكرت تلقائياً</span>
                <span className="text-[11px] text-slate-400 block">احتساب متوسط تكلفة الصنف بناءً على سعر الشراء الجديد من المورد</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.autoUpdateStockCostPrice}
                onChange={e => setSettings(prev => ({ ...prev, autoUpdateStockCostPrice: e.target.checked }))}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </label>

            {/* Post Ledger Expense */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-emerald-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">ترحيل القيد المعلق إلى مصروف فعلي/خصم الصندوق</span>
                <span className="text-[11px] text-slate-400 block">إقفال الحساب المعلق فور إجراء المطابقة وتأكيد العامل أو المدير</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.autoPostLedgerExpenseOnVerify}
                onChange={e => setSettings(prev => ({ ...prev, autoPostLedgerExpenseOnVerify: e.target.checked }))}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

      </div>

      {/* Section 5: Returns, Damaged Goods, & Substitutes Management */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-rose-500/30 shadow-xl space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-white/10">
          <div className="p-2 bg-rose-500/20 rounded-xl text-rose-400">
            <RotateCcw size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">5. سياسة المرتجعات والتالف والبدائل المقبولة</h3>
            <p className="text-xs text-slate-400">إدارة تسوية البضائع المرتجعة أو الخاطئة وكيفية رد المبالغ أو شحن البديل</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Refund Method Option Card 1: Cash Refund */}
          <div 
            onClick={() => setSettings(prev => ({ ...prev, refundMethod: 'cash_refund' }))}
            className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
              settings.refundMethod === 'cash_refund'
                ? 'bg-rose-950/60 border-rose-500 text-white shadow-lg'
                : 'bg-slate-950/80 border-white/5 text-slate-400 hover:border-rose-500/30'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-black text-sm text-white">رد نقدي للصندوق</span>
              <Wallet size={18} className="text-rose-400" />
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              تحويل قيمة المرتجع مباشرة إلى صندوق الكاشير الخاص بالتاجر المشتري نقداً.
            </p>
          </div>

          {/* Refund Method Option Card 2: Supplier Ledger Credit */}
          <div 
            onClick={() => setSettings(prev => ({ ...prev, refundMethod: 'supplier_ledger_credit' }))}
            className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
              settings.refundMethod === 'supplier_ledger_credit'
                ? 'bg-rose-950/60 border-rose-500 text-white shadow-lg'
                : 'bg-slate-950/80 border-white/5 text-slate-400 hover:border-rose-500/30'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-black text-sm text-white">خصم من دين المورد</span>
              <FileSpreadsheet size={18} className="text-amber-400" />
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              إضافة دائنية لصالح المشتري وتنزيل المبلغ المرتجع تلقائياً من دين المورد المعتمد.
            </p>
          </div>

          {/* Refund Method Option Card 3: Replacement Item Dispatch */}
          <div 
            onClick={() => setSettings(prev => ({ ...prev, refundMethod: 'replacement_dispatch' }))}
            className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
              settings.refundMethod === 'replacement_dispatch'
                ? 'bg-rose-950/60 border-rose-500 text-white shadow-lg'
                : 'bg-slate-950/80 border-white/5 text-slate-400 hover:border-rose-500/30'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-black text-sm text-white">طلب وإعادة شحن صنف بديل</span>
              <Truck size={18} className="text-indigo-400" />
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              إرسال طلب تجهيز بديل مباشرة لغرفة التجهيز لدى المورد لشحن الصنف السليم بدون مساس بالحسابات.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
          {/* Auto dispatch replacement */}
          <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-rose-500/30">
            <div className="space-y-0.5">
              <span className="font-black text-white block">التوجيه الآلي للبديل إلى غرفة تجهيز المورد فور الموافقة</span>
              <span className="text-[11px] text-slate-400 block">تحويل طلب البديل إلى قسم Packer للتاجر المورد مع إشعار عاجل</span>
            </div>
            <input 
              type="checkbox"
              checked={settings.autoDispatchReplacementToPrep}
              onChange={e => setSettings(prev => ({ ...prev, autoDispatchReplacementToPrep: e.target.checked }))}
              className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
            />
          </label>

          {/* Deduct from supplier immediately */}
          <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-rose-500/30">
            <div className="space-y-0.5">
              <span className="font-black text-white block">تطبيق الخصم الحسابي المباشر فور تسجيل المرتجع</span>
              <span className="text-[11px] text-slate-400 block">إجراء القيد المحاسبي الفوري بالدفاتر دون انتظار إرجاع الصنف فيزيائياً</span>
            </div>
            <input 
              type="checkbox"
              checked={settings.deductFromSupplierLedgerImmediately}
              onChange={e => setSettings(prev => ({ ...prev, deductFromSupplierLedgerImmediately: e.target.checked }))}
              className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
