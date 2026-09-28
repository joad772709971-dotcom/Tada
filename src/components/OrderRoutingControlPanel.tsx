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
  FileSpreadsheet,
  Percent,
  Tag,
  Plus,
  Trash2,
  AlertTriangle,
  Store,
  Layers,
  Sparkles,
  ShoppingBag,
  Check
} from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';

export interface ShopPromoCoupon {
  code: string;
  discountPercent: number;
  minInvoiceValue: number;
  active: boolean;
}

export interface CustomSubstitutePair {
  originalItem: string;
  substituteItem: string;
  autoApply: boolean;
}

export interface OrderRoutingSettings {
  // Store Identification
  shopId?: string;
  shopName?: string;

  // 1. Order Routing & Workflows (مسارات الطلب)
  orderApprovalMode: 'auto_immediate' | 'manager_manual' | 'conditional_debt';
  orderPrepQueue: 'warehouse_packer' | 'cashier_direct' | 'auto_available_staff';
  fulfillmentPath: 'store_pickup' | 'local_courier' | 'shipping_company' | 'hybrid';
  cancellationPolicy: 'immediate_restock' | 'require_manager_reason' | 'restock_with_penalty';
  notifyCustomerOnStageChange: boolean;
  sendMode: 'immediate' | 'draft_batch';
  allowEditInPending: boolean;
  allowCancelBeforePrep: boolean;

  // Auto-Fallback Role Routing Shield & Timeout
  enableAutoRoleFallback: boolean;
  checkOnlinePresence: boolean;
  routingTimeoutMinutes: number;
  enableOrderProcessingLock: boolean;
  cashierFallbackRole: 'manager' | 'sales_agent';
  packerFallbackRole: 'manager' | 'sales_agent';
  deliveryFallbackRole: 'manager' | 'sales_agent';

  // 2. Discounts & Pricing Policies (الخصومات)
  enableDiscounts: boolean;
  maxCashierDiscountPercent: number; // e.g. 5%, 10%
  blockBelowCostDiscount: boolean; // Prevent selling below cost safeguard
  allowLineItemDiscount: boolean;
  allowInvoiceTotalDiscount: boolean;
  enableCustomerTierDiscount: boolean;
  vipDiscounts: {
    regular: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  shopCoupons: ShopPromoCoupon[];

  // 3. Substitutes & Alternatives Engine (البدائل)
  autoSuggestSubstitutes: boolean;
  substitutePriceRule: 'same_or_lower' | 'exact_price' | 'any_with_diff';
  substituteCategoryRule: 'same_category_only' | 'same_brand_preferred' | 'any';
  requireCustomerConsentForSubstitute: boolean;
  showSubstitutesInPackerScreen: boolean;
  customSubstitutePairs: CustomSubstitutePair[];

  // 4. Linkage, Currencies & Payment Rules
  requireValidLinkKey: boolean;
  enforceLinkKeyExpiration: boolean;
  linkKeyValidityDays: number;
  primaryCurrency: 'YER' | 'SAR' | 'USD';
  allowedCurrencies: ('YER' | 'SAR' | 'USD')[];
  allowedPaymentTypes: ('cash' | 'debt' | 'wallet' | 'transfer')[];

  // 5. Warehouse & Financial Settlement
  enableTransitFrozenExpense: boolean;
  autoIngestToStockOnVerify: boolean;
  autoUpdateStockCostPrice: boolean;
  autoPostLedgerExpenseOnVerify: boolean;

  // 6. Returns & Damaged Goods
  refundMethod: 'cash_refund' | 'supplier_ledger_credit' | 'replacement_dispatch';
  autoDispatchReplacementToPrep: boolean;
  deductFromSupplierLedgerImmediately: boolean;
}

export const DEFAULT_ORDER_ROUTING_SETTINGS: OrderRoutingSettings = {
  shopId: 'main_master_store',
  shopName: 'المتجر الرئيسي',

  // 1. Order Routing
  orderApprovalMode: 'auto_immediate',
  orderPrepQueue: 'warehouse_packer',
  fulfillmentPath: 'hybrid',
  cancellationPolicy: 'immediate_restock',
  notifyCustomerOnStageChange: true,
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

  // 2. Discounts
  enableDiscounts: true,
  maxCashierDiscountPercent: 10,
  blockBelowCostDiscount: true,
  allowLineItemDiscount: true,
  allowInvoiceTotalDiscount: true,
  enableCustomerTierDiscount: true,
  vipDiscounts: {
    regular: 0,
    silver: 3,
    gold: 5,
    platinum: 8,
  },
  shopCoupons: [
    { code: 'JAMVIP', discountPercent: 5, minInvoiceValue: 10000, active: true },
    { code: 'DISCOUNT10', discountPercent: 10, minInvoiceValue: 25000, active: true }
  ],

  // 3. Substitutes
  autoSuggestSubstitutes: true,
  substitutePriceRule: 'same_or_lower',
  substituteCategoryRule: 'same_category_only',
  requireCustomerConsentForSubstitute: true,
  showSubstitutesInPackerScreen: true,
  customSubstitutePairs: [
    { originalItem: 'شاحن أصلي تايب سي', substituteItem: 'شاحن أنكر 20W سريع', autoApply: false }
  ],

  // 4. Currencies & Payments
  requireValidLinkKey: true,
  enforceLinkKeyExpiration: true,
  linkKeyValidityDays: 90,
  primaryCurrency: 'YER',
  allowedCurrencies: ['YER', 'SAR', 'USD'],
  allowedPaymentTypes: ['cash', 'debt', 'wallet', 'transfer'],

  // 5. Warehouse & Settlement
  enableTransitFrozenExpense: true,
  autoIngestToStockOnVerify: true,
  autoUpdateStockCostPrice: true,
  autoPostLedgerExpenseOnVerify: true,

  // 6. Returns
  refundMethod: 'supplier_ledger_credit',
  autoDispatchReplacementToPrep: true,
  deductFromSupplierLedgerImmediately: true,
};

interface OrderRoutingControlPanelProps {
  initialShopId?: string;
  initialShopName?: string;
}

export default function OrderRoutingControlPanel({ 
  initialShopId, 
  initialShopName 
}: OrderRoutingControlPanelProps = {}) {
  // Active Shop identifier
  const [activeShopId, setActiveShopId] = useState<string>(() => {
    return initialShopId || localStorage.getItem('jam_active_store_id') || 'main_master_store';
  });

  const [activeShopName, setActiveShopName] = useState<string>(() => {
    return initialShopName || localStorage.getItem('jam_active_store_name') || 'المتجر الرئيسي';
  });

  // Available shops for selection
  const [availableShops, setAvailableShops] = useState<{ id: string; name: string }[]>([]);

  // Sub-tabs inside the routing control panel
  const [activePanelTab, setActivePanelTab] = useState<'routing' | 'discounts' | 'substitutes' | 'payments' | 'settlement'>('routing');

  // Coupon modal / state
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPercent, setNewCouponPercent] = useState<number>(5);
  const [newCouponMin, setNewCouponMin] = useState<number>(0);

  // Substitute pair state
  const [newOrigItem, setNewOrigItem] = useState('');
  const [newSubItem, setNewSubItem] = useState('');

  // Main settings state
  const [settings, setSettings] = useState<OrderRoutingSettings>(() => {
    const shopKey = `jam_order_routing_config_${activeShopId}`;
    const saved = localStorage.getItem(shopKey) || localStorage.getItem('jam_order_routing_config_v1');
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

  // Fetch shops list for multi-store selection
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const snap = await getDocs(collection(db, 'shops'));
        const list = snap.docs.map(d => ({
          id: d.id,
          name: d.data().shopName || d.data().name || `محل #${d.id.substring(0, 6)}`
        }));
        if (list.length > 0) {
          setAvailableShops(list);
        } else {
          setAvailableShops([{ id: 'main_master_store', name: initialShopName || 'المتجر الرئيسي' }]);
        }
      } catch (e) {
        setAvailableShops([{ id: 'main_master_store', name: initialShopName || 'المتجر الرئيسي' }]);
      }
    };
    fetchShops();
  }, [initialShopName]);

  // Load store-specific settings when activeShopId changes
  useEffect(() => {
    const fetchRemoteSettings = async () => {
      const shopKey = `jam_order_routing_config_${activeShopId}`;
      const cached = localStorage.getItem(shopKey);
      if (cached) {
        try {
          setSettings({ ...DEFAULT_ORDER_ROUTING_SETTINGS, ...JSON.parse(cached) });
        } catch (e) {}
      }

      try {
        // Attempt store-specific doc first
        let snap = await getDoc(doc(db, 'stores', activeShopId, 'settings', 'order_routing_config'));
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'shops', activeShopId, 'order_routing_config', 'config'));
        }
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'system_settings', `order_routing_config_${activeShopId}`));
        }
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'system_settings', 'order_routing_config'));
        }

        if (snap.exists()) {
          const remoteData = snap.data();
          const merged = { ...DEFAULT_ORDER_ROUTING_SETTINGS, ...remoteData, shopId: activeShopId };
          setSettings(merged);
          localStorage.setItem(shopKey, JSON.stringify(merged));
        }
      } catch (err) {
        console.warn('Unable to load remote order routing config, using cached settings:', err);
      }
    };

    fetchRemoteSettings();
  }, [activeShopId]);

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const shopKey = `jam_order_routing_config_${activeShopId}`;
      const payload = {
        ...settings,
        shopId: activeShopId,
        shopName: activeShopName,
        updatedAt: serverTimestamp(),
      };

      // 1. Save to local storage
      localStorage.setItem(shopKey, JSON.stringify(payload));
      localStorage.setItem('jam_order_routing_config_v1', JSON.stringify(payload));

      // 2. Broadcast custom system event
      window.dispatchEvent(new CustomEvent('jam_order_routing_updated', { 
        detail: { shopId: activeShopId, settings: payload } 
      }));

      // 3. Persist to Firestore under store-specific paths
      try {
        await setDoc(doc(db, 'system_settings', `order_routing_config_${activeShopId}`), payload, { merge: true });
        await setDoc(doc(db, 'system_settings', 'order_routing_config'), payload, { merge: true });
      } catch (remoteErr) {
        console.warn('Firestore remote persist notice:', remoteErr);
      }

      setSaveMessage(`✅ تم بنجاح حفظ وتثبيت مسارات الطلب والخصومات والبدائل الخاصة بـ (${activeShopName})!`);
    } catch (err: any) {
      console.warn('Error saving order routing settings:', err?.message);
      setSaveMessage('✅ تم حفظ الإعدادات محلياً بنجاح وسيعمل النظام أوفلاين بحسب القواعد المحدثة!');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 5000);
    }
  };

  const handleAddCoupon = () => {
    if (!newCouponCode.trim()) return;
    const coupon: ShopPromoCoupon = {
      code: newCouponCode.trim().toUpperCase(),
      discountPercent: Number(newCouponPercent) || 5,
      minInvoiceValue: Number(newCouponMin) || 0,
      active: true
    };
    setSettings(prev => ({
      ...prev,
      shopCoupons: [...(prev.shopCoupons || []), coupon]
    }));
    setNewCouponCode('');
    setNewCouponPercent(5);
    setNewCouponMin(0);
  };

  const handleDeleteCoupon = (index: number) => {
    setSettings(prev => ({
      ...prev,
      shopCoupons: prev.shopCoupons.filter((_, i) => i !== index)
    }));
  };

  const handleAddSubstitutePair = () => {
    if (!newOrigItem.trim() || !newSubItem.trim()) return;
    const pair: CustomSubstitutePair = {
      originalItem: newOrigItem.trim(),
      substituteItem: newSubItem.trim(),
      autoApply: false
    };
    setSettings(prev => ({
      ...prev,
      customSubstitutePairs: [...(prev.customSubstitutePairs || []), pair]
    }));
    setNewOrigItem('');
    setNewSubItem('');
  };

  const handleDeleteSubstitutePair = (index: number) => {
    setSettings(prev => ({
      ...prev,
      customSubstitutePairs: prev.customSubstitutePairs.filter((_, i) => i !== index)
    }));
  };

  const toggleCurrency = (currency: 'YER' | 'SAR' | 'USD') => {
    setSettings(prev => {
      const exists = prev.allowedCurrencies.includes(currency);
      if (exists && prev.allowedCurrencies.length === 1) return prev;
      const updated = exists 
        ? prev.allowedCurrencies.filter(c => c !== currency)
        : [...prev.allowedCurrencies, currency];
      return { ...prev, allowedCurrencies: updated };
    });
  };

  const togglePaymentType = (type: 'cash' | 'debt' | 'wallet' | 'transfer') => {
    setSettings(prev => {
      const exists = prev.allowedPaymentTypes.includes(type);
      if (exists && prev.allowedPaymentTypes.length === 1) return prev;
      const updated = exists 
        ? prev.allowedPaymentTypes.filter(t => t !== type)
        : [...prev.allowedPaymentTypes, type];
      return { ...prev, allowedPaymentTypes: updated };
    });
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-2 border-amber-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/40 text-amber-400">
                <GitFork size={30} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>مسارات الطلب والخصومات والبدائل</span>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                    ضبط مستقل لكل محل
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  تحكم متكامل في دورة حياة الطلبات، سياسات الخصم وسقف الربح، قواعد البدائل الذكية عند نفاد المخزون، وشروط الدفع والتسوية.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Shop Selector Dropdown */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/30 p-1.5 px-3 rounded-2xl shadow-inner">
              <Store className="w-4 h-4 text-cyan-400" />
              <div className="text-xs text-slate-300">
                <span className="text-[10px] text-slate-400 block font-bold">المحل النشط:</span>
                <select
                  value={activeShopId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setActiveShopId(selectedId);
                    const found = availableShops.find(s => s.id === selectedId);
                    if (found) setActiveShopName(found.name);
                  }}
                  className="bg-transparent text-white font-black text-xs outline-none cursor-pointer"
                >
                  {availableShops.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {s.name}
                    </option>
                  ))}
                  {!availableShops.some(s => s.id === activeShopId) && (
                    <option value={activeShopId} className="bg-slate-900 text-white">
                      {activeShopName}
                    </option>
                  )}
                </select>
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={isSaving}
              type="button"
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shrink-0"
            >
              {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              <span>حفظ وتثبيت إعدادات المحل</span>
            </button>
          </div>
        </div>
      </div>

      {saveMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border-2 border-emerald-500 text-emerald-200 text-xs sm:text-sm font-black flex items-center gap-3 animate-fade-in shadow-xl">
          <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        <button
          onClick={() => setActivePanelTab('routing')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activePanelTab === 'routing'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-lg'
              : 'text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <GitFork size={16} className="text-amber-400" />
          <span>1. مسارات وسير الطلبات</span>
        </button>

        <button
          onClick={() => setActivePanelTab('discounts')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activePanelTab === 'discounts'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-lg'
              : 'text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <Percent size={16} className="text-emerald-400" />
          <span>2. سياسات الخصومات والكوبونات</span>
        </button>

        <button
          onClick={() => setActivePanelTab('substitutes')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activePanelTab === 'substitutes'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-lg'
              : 'text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <Sparkles size={16} className="text-indigo-400" />
          <span>3. البدائل الذكية عند النفاد</span>
        </button>

        <button
          onClick={() => setActivePanelTab('payments')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activePanelTab === 'payments'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-lg'
              : 'text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <DollarSign size={16} className="text-cyan-400" />
          <span>4. العملات وشروط الدفع</span>
        </button>

        <button
          onClick={() => setActivePanelTab('settlement')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activePanelTab === 'settlement'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-lg'
              : 'text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <RotateCcw size={16} className="text-rose-400" />
          <span>5. المرتجعات والمستودع</span>
        </button>
      </div>

      {/* TAB 1: ORDER ROUTING & WORKFLOWS */}
      {activePanelTab === 'routing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Box 1: Order Acceptance & Approval Path */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 shadow-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <Send size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">مسار اعتماد وقبول الطلبات بالمحل</h3>
                <p className="text-xs text-slate-400">تحديد آلية انتقال الطلب الجديد من الاستقبال إلى مرحلة التجهيز</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'auto_immediate', title: 'اعتماد فوري تلقائي', desc: 'يمر الطلب مباشرة إلى غرفة التجهيز فور تقديمه دون انتظار موافقة يدوية.' },
                  { id: 'manager_manual', title: 'موافقة يدوية إجبارية من المدير', desc: 'يتطلب كل طلب اعتماداً صريحاً من مدير الفرع قبل بدء التجهيز.' },
                  { id: 'conditional_debt', title: 'اعتماد مشروط بنوع الدفع', desc: 'فوري للطلبات النقدية والمحافظ، وموافقة يدوية لطلبات الآجل والذمم.' }
                ].map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => setSettings(prev => ({ ...prev, orderApprovalMode: opt.id as any }))}
                    className={`p-3 rounded-2xl border transition cursor-pointer space-y-1 ${
                      settings.orderApprovalMode === opt.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-slate-950/80 border-white/5 text-slate-400 hover:border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between font-black text-white">
                      <span>{opt.title}</span>
                      {settings.orderApprovalMode === opt.id && <Check size={16} className="text-amber-400" />}
                    </div>
                    <p className="text-[11px] text-slate-300">{opt.desc}</p>
                  </div>
                ))}
              </div>

              {/* Prep Queue Routing */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <label className="font-black text-white block">مسار التوجيه لقسم التجهيز:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'warehouse_packer', label: 'غرفة المستودع (Packer)' },
                    { id: 'cashier_direct', label: 'الكاشير بنقطة البيع' },
                    { id: 'auto_available_staff', label: 'أول موظف متصل' },
                  ].map(q => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, orderPrepQueue: q.id as any }))}
                      className={`p-2.5 rounded-xl border text-[11px] font-bold text-center transition cursor-pointer ${
                        settings.orderPrepQueue === q.id
                          ? 'bg-amber-500/30 border-amber-500 text-white'
                          : 'bg-slate-950/80 border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Box 2: Fulfillment & Cancellation */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 shadow-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                <Truck size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">مسارات التسليم والإلغاء وتفريغ الحجز</h3>
                <p className="text-xs text-slate-400">توجيه التوصيل، الإشعارات، وإرجاع المخزون المحجوز</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-black text-white block mb-1.5">مسار التسليم والشحن المعتمد بالمحل:</label>
                <select
                  value={settings.fulfillmentPath}
                  onChange={e => setSettings(prev => ({ ...prev, fulfillmentPath: e.target.value as any }))}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/10 text-white outline-none focus:border-amber-500"
                >
                  <option value="hybrid">مسار هجين (يتيح للزبون الاختيار بين الاستلام أو التوصيل)</option>
                  <option value="store_pickup">استلام حصري مباشر من الفرع (Store Pickup)</option>
                  <option value="local_courier">مندوب التوصيل الداخلي الخاص بالمحل</option>
                  <option value="shipping_company">شركات الشحن والنقل الخارجي</option>
                </select>
              </div>

              {/* Checkboxes */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-amber-500/30">
                <div className="space-y-0.5">
                  <span className="font-black text-white block">إرسال إشعار للعميل عند تغير مسار الطلب</span>
                  <span className="text-[11px] text-slate-400 block">إشعار فوري عند (تم الاستلام، جاري التجهيز، خرج للتوصيل، تم التسليم)</span>
                </div>
                <input 
                  type="checkbox"
                  checked={settings.notifyCustomerOnStageChange}
                  onChange={e => setSettings(prev => ({ ...prev, notifyCustomerOnStageChange: e.target.checked }))}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-amber-500/30">
                <div className="space-y-0.5">
                  <span className="font-black text-white block">تفريغ فوري للمخزون المحجوز عند الإلغاء</span>
                  <span className="text-[11px] text-slate-400 block">إرجاع كميات الأصناف الممسوكة للبيع الفوري أوتوماتيكياً دون تعليق الرفوف</span>
                </div>
                <input 
                  type="checkbox"
                  checked={settings.cancellationPolicy === 'immediate_restock'}
                  onChange={e => setSettings(prev => ({ ...prev, cancellationPolicy: e.target.checked ? 'immediate_restock' : 'require_manager_reason' }))}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-amber-500/30">
                <div className="space-y-0.5">
                  <span className="font-black text-white block">السماح بالإلغاء قبل البدء بالتجهيز فقط</span>
                  <span className="text-[11px] text-slate-400 block">قفل إمكانية إلغاء الطلب بمجرد بدء العامل في تعبئة السلع</span>
                </div>
                <input 
                  type="checkbox"
                  checked={settings.allowCancelBeforePrep}
                  onChange={e => setSettings(prev => ({ ...prev, allowCancelBeforePrep: e.target.checked }))}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DISCOUNTS & PRICING POLICIES */}
      {activePanelTab === 'discounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Discount Rules & Below-cost Shield */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                <Percent size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">قواعد وسياسات الخصومات للمحل</h3>
                <p className="text-xs text-slate-400">التحكم في سقف الخصومات المسموحة وحماية أرباح المتجر</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Enable Discounts Toggle */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-emerald-500/30">
                <div className="space-y-0.5">
                  <span className="font-black text-white block">تفعيل نظام الخصومات في هذا المحل</span>
                  <span className="text-[11px] text-slate-400 block">إظهار حقول الخصم في نقطة البيع وفواتير المبيعات</span>
                </div>
                <input 
                  type="checkbox"
                  checked={settings.enableDiscounts}
                  onChange={e => setSettings(prev => ({ ...prev, enableDiscounts: e.target.checked }))}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              {/* Max Cashier Discount % */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-black text-white">الحد الأقصى للخصم المسموح للكاشير بدون إذن:</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">{settings.maxCashierDiscountPercent}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={settings.maxCashierDiscountPercent}
                  onChange={e => setSettings(prev => ({ ...prev, maxCashierDiscountPercent: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">أي خصم يتجاوز هذه النسبة سيتطلب إدخال رمز المشرف أو موافقة المدير المباشرة.</p>
              </div>

              {/* Anti-Loss Below-Cost Safeguard */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 cursor-pointer hover:border-amber-500/60">
                <div className="space-y-0.5">
                  <span className="font-black text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-amber-400" />
                    <span>صمام أمان الأرباح (منع البيع بأقل من سعر التكلفة)</span>
                  </span>
                  <span className="text-[11px] text-slate-300 block">حظر قطعي لأي خصم يجعل السعر النهائي أقل من سعر تكلفة شراء الصنف.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={settings.blockBelowCostDiscount}
                  onChange={e => setSettings(prev => ({ ...prev, blockBelowCostDiscount: e.target.checked }))}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </label>

              {/* Granular Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-white/5 cursor-pointer">
                  <span className="text-[11px] font-bold text-white">خصم على بند الصنف الفردي</span>
                  <input 
                    type="checkbox"
                    checked={settings.allowLineItemDiscount}
                    onChange={e => setSettings(prev => ({ ...prev, allowLineItemDiscount: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-white/5 cursor-pointer">
                  <span className="text-[11px] font-bold text-white">خصم إجمالي على الفاتورة</span>
                  <input 
                    type="checkbox"
                    checked={settings.allowInvoiceTotalDiscount}
                    onChange={e => setSettings(prev => ({ ...prev, allowInvoiceTotalDiscount: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>
              </div>

              {/* VIP Tier Auto-Discounts */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
                <span className="font-black text-white block">خصومات شرائح الزبائن التلقائية (VIP Loyalty):</span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { key: 'regular', label: 'عادي', val: settings.vipDiscounts.regular },
                    { key: 'silver', label: 'فضي', val: settings.vipDiscounts.silver },
                    { key: 'gold', label: 'ذهبي', val: settings.vipDiscounts.gold },
                    { key: 'platinum', label: 'بلاتيني', val: settings.vipDiscounts.platinum }
                  ].map(tier => (
                    <div key={tier.key} className="bg-slate-900 p-2 rounded-xl border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-bold">{tier.label}</span>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <input 
                          type="number"
                          value={tier.val}
                          onChange={e => {
                            const v = Number(e.target.value) || 0;
                            setSettings(prev => ({
                              ...prev,
                              vipDiscounts: { ...prev.vipDiscounts, [tier.key]: v }
                            }));
                          }}
                          className="w-10 text-center bg-slate-950 border border-emerald-500/40 rounded text-emerald-300 font-bold text-xs"
                        />
                        <span className="text-[10px] text-slate-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Shop Promo Coupons */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                  <Tag size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">كوبونات وأكواد الخصم الخاصة بالمحل</h3>
                  <p className="text-xs text-slate-400">إنشاء وتفعيل أكواد ترويجية يطبقها الكاشير أو الزبون في التطبيق</p>
                </div>
              </div>
            </div>

            {/* Add Coupon Form */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-white/10 space-y-2 text-xs">
              <span className="font-bold text-slate-300 block">إضافة كود خصم جديد:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input 
                  type="text"
                  placeholder="رمز الكود (مثلاً: EID2026)"
                  value={newCouponCode}
                  onChange={e => setNewCouponCode(e.target.value)}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs uppercase"
                />
                <input 
                  type="number"
                  placeholder="نسبة الخصم %"
                  value={newCouponPercent || ''}
                  onChange={e => setNewCouponPercent(Number(e.target.value))}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddCoupon}
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus size={16} />
                  <span>إضافة الكود</span>
                </button>
              </div>
            </div>

            {/* Coupons List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(settings.shopCoupons || []).length > 0 ? (
                settings.shopCoupons.map((coupon, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 hover:border-emerald-500/30 transition text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-black text-sm">
                        {coupon.code}
                      </div>
                      <div>
                        <span className="font-black text-white block">خصم {coupon.discountPercent}%</span>
                        {coupon.minInvoiceValue > 0 && (
                          <span className="text-[10px] text-slate-400 block">الحد الأدنى: {coupon.minInvoiceValue} ر.ي</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                        نشط
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCoupon(idx)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs">
                  لا توجد أكواد خصم مسجلة حالياً لهذا المحل. يمكنك إضافة كود جديد بالأعلى.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SMART SUBSTITUTES & ALTERNATIVES */}
      {activePanelTab === 'substitutes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Substitution Rules */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-indigo-500/30 shadow-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">سياسات البدائل الذكية عند نفاد المخزون</h3>
                <p className="text-xs text-slate-400">اقتراح واستبدال السلع المنتهية ببدائل مكافئة لمنع ضياع المبيعات</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-indigo-500/30">
                <div className="space-y-0.5">
                  <span className="font-black text-white block">تفعيل اقتراح البدائل الذكية عند الصفر</span>
                  <span className="text-[11px] text-slate-400 block">اقتراح بدائل مكافئة فورياً في نقطة البيع وعند طلب الزبون</span>
                </div>
                <input 
                  type="checkbox"
                  checked={settings.autoSuggestSubstitutes}
                  onChange={e => setSettings(prev => ({ ...prev, autoSuggestSubstitutes: e.target.checked }))}
                  className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
                />
              </label>

              {/* Price Rule for Substitutes */}
              <div>
                <label className="font-black text-white block mb-1.5">شرط سعر الصنف البديل:</label>
                <select
                  value={settings.substitutePriceRule}
                  onChange={e => setSettings(prev => ({ ...prev, substitutePriceRule: e.target.value as any }))}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/10 text-white outline-none focus:border-indigo-500"
                >
                  <option value="same_or_lower">بديل بنفس السعر أو أقل فقط (لعدم تحميل الزبون أي فارق)</option>
                  <option value="exact_price">بديل مطابق تماماً في السعر فقط</option>
                  <option value="any_with_diff">أي بديل متوفر مع حساب فارق السعر أوتوماتيكياً</option>
                </select>
              </div>

              {/* Customer Consent */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-indigo-500/30">
                <div className="space-y-0.5">
                  <span className="font-black text-white block">اشتراط موافقة العميل قبل تفعيل التبديل</span>
                  <span className="text-[11px] text-slate-400 block">إرسال إشعار للعميل لتأكيد البديل المقترح قبل شحن الفاتورة</span>
                </div>
                <input 
                  type="checkbox"
                  checked={settings.requireCustomerConsentForSubstitute}
                  onChange={e => setSettings(prev => ({ ...prev, requireCustomerConsentForSubstitute: e.target.checked }))}
                  className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
                />
              </label>

              {/* Show in Packer Queue */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-indigo-500/30">
                <div className="space-y-0.5">
                  <span className="font-black text-white block">إظهار البدائل في شاشة التجهيز بالمستودع</span>
                  <span className="text-[11px] text-slate-400 block">تمكين موظف التعبئة من اختيار الصنف البديل المعتمد بنقرة واحدة</span>
                </div>
                <input 
                  type="checkbox"
                  checked={settings.showSubstitutesInPackerScreen}
                  onChange={e => setSettings(prev => ({ ...prev, showSubstitutesInPackerScreen: e.target.checked }))}
                  className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Right: Custom Substitute Pairs */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-indigo-500/30 shadow-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                <ArrowLeftRight size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">قائمة البدائل المعتمدة المباشرة للمحل</h3>
                <p className="text-xs text-slate-400">ربط أصناف معينة ببدائلها الدقيقة المعتمدة لدى المحل</p>
              </div>
            </div>

            {/* Add Pair Form */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-white/10 space-y-2 text-xs">
              <span className="font-bold text-slate-300 block">ربط صنف بديل معتمد:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input 
                  type="text"
                  placeholder="اسم الصنف الأصلي"
                  value={newOrigItem}
                  onChange={e => setNewOrigItem(e.target.value)}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                />
                <input 
                  type="text"
                  placeholder="اسم الصنف البديل المعتمد"
                  value={newSubItem}
                  onChange={e => setNewSubItem(e.target.value)}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleAddSubstitutePair}
                className="w-full p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus size={16} />
                <span>اعتماد زوج البديل للصنف</span>
              </button>
            </div>

            {/* Pairs List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(settings.customSubstitutePairs || []).length > 0 ? (
                settings.customSubstitutePairs.map((pair, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 hover:border-indigo-500/30 transition text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{pair.originalItem}</span>
                      <ArrowLeftRight size={14} className="text-indigo-400" />
                      <span className="font-black text-indigo-300">{pair.substituteItem}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSubstitutePair(idx)}
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs">
                  لا توجد أزواج بدائل مخصصة مضافة حالياً.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CURRENCIES & PAYMENT TYPES */}
      {activePanelTab === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Linkage & Currencies */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-cyan-500/30 shadow-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="p-2 bg-cyan-500/20 rounded-xl text-cyan-400">
                <Key size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">شروط مفاتيح الارتباط B2B والعملات</h3>
                <p className="text-xs text-slate-400">صلاحية الربط بين المحلات والموردين والعملات المعتمدة</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-cyan-500/30">
                <div className="space-y-0.5">
                  <span className="font-black text-white block">التحقق الإجباري من مفتاح الربط وسريانه</span>
                  <span className="text-[11px] text-slate-400 block">حظر تمرير أي طلب بين الفروع والموردين إلا بوجود مفتاح نشط</span>
                </div>
                <input 
                  type="checkbox"
                  checked={settings.requireValidLinkKey}
                  onChange={e => setSettings(prev => ({ ...prev, requireValidLinkKey: e.target.checked }))}
                  className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                />
              </label>

              {/* Currencies */}
              <div className="space-y-2 pt-2">
                <label className="font-black text-white block">العملات المسموح بها في هذا المحل:</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'YER', label: 'ريال يمني (YER)' },
                    { id: 'SAR', label: 'ريال سعودي (SAR)' },
                    { id: 'USD', label: 'دولار أمريكي (USD)' }
                  ].map(c => {
                    const isAllowed = settings.allowedCurrencies.includes(c.id as any);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCurrency(c.id as any)}
                        className={`p-3 rounded-2xl border font-bold text-center transition cursor-pointer ${
                          isAllowed 
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                            : 'bg-slate-950/80 border-white/5 text-slate-500'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-cyan-500/30 shadow-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="p-2 bg-cyan-500/20 rounded-xl text-cyan-400">
                <Wallet size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">طرق الدفع والتسوية المعتمدة</h3>
                <p className="text-xs text-slate-400">تحديد قنوات تحصيل الأموال المسموح للكاشير والزبائن استخدامها</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { id: 'cash', label: 'دفع نقدي (Cash)', icon: DollarSign, desc: 'تحصيل فوري بصندوق الكاشير' },
                { id: 'debt', label: 'آجل وذمم (Credit)', icon: FileSpreadsheet, desc: 'تسجيل على حساب ودين العميل' },
                { id: 'wallet', label: 'محافظ إلكترونية', icon: Wallet, desc: 'كريمي جوال، كاش، جيب وغيرها' },
                { id: 'transfer', label: 'حوالات بنكية', icon: CreditCard, desc: 'إيداع بنكي وسند حوالة مباشر' }
              ].map(p => {
                const isSelected = settings.allowedPaymentTypes.includes(p.id as any);
                return (
                  <div
                    key={p.id}
                    onClick={() => togglePaymentType(p.id as any)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-1 ${
                      isSelected 
                        ? 'bg-cyan-500/20 border-cyan-500 text-white' 
                        : 'bg-slate-950/80 border-white/5 text-slate-500 hover:border-cyan-500/30'
                    }`}
                  >
                    <div className="flex justify-between items-center font-black">
                      <span>{p.label}</span>
                      <p.icon size={16} className={isSelected ? 'text-cyan-400' : 'text-slate-600'} />
                    </div>
                    <p className="text-[10px] text-slate-400">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RETURNS & SETTLEMENT */}
      {activePanelTab === 'settlement' && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-rose-500/30 shadow-xl space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div className="p-2 bg-rose-500/20 rounded-xl text-rose-400">
              <RotateCcw size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">سياسة المرتجعات، التوالف، والتسوية المخزنية</h3>
              <p className="text-xs text-slate-400">إدارة تسوية السلع المرتجعة، مطابقة الأرصدة، وتجميد المصروفات المؤقتة</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div 
              onClick={() => setSettings(prev => ({ ...prev, refundMethod: 'cash_refund' }))}
              className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
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
                تحويل قيمة المرتجع مباشرة إلى صندوق الكاشير الخاص بالزبون نقداً.
              </p>
            </div>

            <div 
              onClick={() => setSettings(prev => ({ ...prev, refundMethod: 'supplier_ledger_credit' }))}
              className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
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

            <div 
              onClick={() => setSettings(prev => ({ ...prev, refundMethod: 'replacement_dispatch' }))}
              className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
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
                إرسال طلب تجهيز بديل مباشرة لغرفة التجهيز لدى المورد لشحن الصنف السليم.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/5 cursor-pointer hover:border-rose-500/30">
              <div className="space-y-0.5">
                <span className="font-black text-white block">التوجيه الآلي للبديل إلى غرفة تجهيز المورد</span>
                <span className="text-[11px] text-slate-400 block">تحويل طلب البديل إلى قسم Packer للتاجر المورد مع إشعار عاجل</span>
              </div>
              <input 
                type="checkbox"
                checked={settings.autoDispatchReplacementToPrep}
                onChange={e => setSettings(prev => ({ ...prev, autoDispatchReplacementToPrep: e.target.checked }))}
                className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
              />
            </label>

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
      )}
    </div>
  );
}
