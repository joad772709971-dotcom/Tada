import React, { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  X, 
  Store, 
  DollarSign, 
  ShieldCheck, 
  Clock, 
  CreditCard, 
  Calendar,
  AlertTriangle,
  Send,
  Building2,
  Tag,
  MapPin,
  Landmark,
  Zap,
  MessageSquare
} from 'lucide-react';
import { b2bLinkageEngine } from '../services/b2bLinkageEngine';
import { B2BConnectionRequest, B2BPriceTier } from '../types';

interface B2BDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: B2BConnectionRequest | null;
  mode: 'accept' | 'reject';
  supplierProfile: any;
  onSuccess?: () => void;
}

const PRICE_TIERS: { id: B2BPriceTier; label: string; desc: string; badge: string }[] = [
  { 
    id: 'imported', 
    label: 'مستورد 🚢💎', 
    desc: 'سعر الاستيراد المباشر وأعلى نسبة خصم تجاري',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  },
  { 
    id: 'wholesale_wholesale', 
    label: 'جملة الجملة 📦👑', 
    desc: 'كبار الموزعين والكميات الكبرى والمستودعات',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
  },
  { 
    id: 'wholesale', 
    label: 'جملة 🏬', 
    desc: 'تجار الجملة المعتمدين والمحلات التجارية',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  },
  { 
    id: 'retail', 
    label: 'تجزئة 🛒', 
    desc: 'محلات التجزئة والمبيعات اليومية المنتظمة',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  }
];

const CREDIT_PRESETS = [200000, 500000, 1000000, 2000000, 5000000];

const PAYMENT_TERMS_OPTIONS = [
  { id: 'cash', label: 'نقداً فوري', desc: 'دفع فوري عند الاستلام أو الشحن', icon: DollarSign },
  { id: 'credit', label: 'آجل مفتوح', desc: 'سحب آجل حتى بلوغ سقف الائتمان', icon: CreditCard },
  { id: 'net7', label: 'أسبوعي', desc: 'سداد دوري نهاية كل أسبوع', icon: Calendar },
  { id: 'net30', label: 'شهري', desc: 'فوترة وسداد دوري نهاية كل شهر', icon: Clock }
];

const ORDER_PAYMENT_TYPES = [
  { id: 'cash' as const, label: 'نقد (Cash)', desc: 'دفع نقدي فوري عند الطلب أو الاستلام', icon: DollarSign, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { id: 'credit' as const, label: 'آجل / دين (Credit)', desc: 'سحب آجل بحد مديونية محدد وفترة سداد', icon: CreditCard, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { id: 'deposit' as const, label: 'إيداع بنكي / حوالة', desc: 'إيداع بالحساب (كريمي / ون كاش / جوالي)', icon: Landmark, color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  { id: 'jampay' as const, label: 'JAM Pay (قريباً)', desc: 'دفع إلكتروني لحظي ذكي ومؤمن', icon: Zap, color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' }
];

export const B2BDecisionModal: React.FC<B2BDecisionModalProps> = ({
  isOpen,
  onClose,
  request,
  mode,
  supplierProfile,
  onSuccess
}) => {
  const [assignedTier, setAssignedTier] = useState<B2BPriceTier>('wholesale');
  const [selectedOrderTypes, setSelectedOrderTypes] = useState<('cash' | 'credit' | 'deposit' | 'jampay')[]>(['cash']);
  const [creditLimit, setCreditLimit] = useState<number>(500000);
  const [paymentTerms, setPaymentTerms] = useState<string>('net30');
  const [supplierNotes, setSupplierNotes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !request) return null;

  const isCreditEnabled = selectedOrderTypes.includes('credit');

  const toggleOrderType = (typeId: 'cash' | 'credit' | 'deposit' | 'jampay') => {
    if (selectedOrderTypes.includes(typeId)) {
      if (selectedOrderTypes.length === 1) return; // keep at least one
      setSelectedOrderTypes(selectedOrderTypes.filter(t => t !== typeId));
    } else {
      setSelectedOrderTypes([...selectedOrderTypes, typeId]);
    }
  };

  const handleConfirmDecision = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      if (mode === 'accept') {
        const res = await b2bLinkageEngine.respondToConnectionRequest({
          requestId: request.id,
          action: 'accept',
          supplierProfile: {
            ...supplierProfile,
            id: supplierProfile?.ownerId || supplierProfile?.uid,
            name: supplierProfile?.shopName || supplierProfile?.name || 'المورد'
          },
          assignedPriceTier: assignedTier,
          creditLimit: isCreditEnabled ? (Number(creditLimit) || 0) : 0,
          paymentTerms: isCreditEnabled ? paymentTerms : 'cash',
          allowedOrderTypes: selectedOrderTypes,
          supplierNotes: supplierNotes.trim()
        });

        if (res.success) {
          window.dispatchEvent(new CustomEvent('jam:b2b_connection_updated', {
            detail: { 
              requestId: request.id, 
              status: 'accepted', 
              assignedTier, 
              creditLimit: isCreditEnabled ? creditLimit : 0,
              allowedOrderTypes: selectedOrderTypes
            }
          }));
          if (onSuccess) onSuccess();
          onClose();
        } else {
          setErrorMessage(res.message || 'تعذر اعتماد الطلب، يرجى المحاولة لاحقاً.');
        }
      } else {
        // Reject
        const res = await b2bLinkageEngine.respondToConnectionRequest({
          requestId: request.id,
          action: 'reject',
          supplierProfile: {
            ...supplierProfile,
            id: supplierProfile?.ownerId || supplierProfile?.uid,
            name: supplierProfile?.shopName || supplierProfile?.name || 'المورد'
          },
          rejectionReason: rejectionReason.trim()
        });

        if (res.success) {
          window.dispatchEvent(new CustomEvent('jam:b2b_connection_updated', {
            detail: { requestId: request.id, status: 'rejected' }
          }));
          if (onSuccess) onSuccess();
          onClose();
        } else {
          setErrorMessage(res.message || 'تعذر رفض الطلب، يرجى المحاولة لاحقاً.');
        }
      }
    } catch (err: any) {
      console.error('Error in respondToConnectionRequest:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء معالجة الطلب.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in"
      dir="rtl"
    >
      <div 
        className="relative w-full max-w-xl bg-[#0a0e1c] border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden text-right my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Highlight Stripe */}
        <div 
          className={`absolute top-0 right-0 left-0 h-1.5 ${
            mode === 'accept'
              ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
              : 'bg-gradient-to-r from-rose-500 via-red-500 to-rose-700'
          }`}
        />

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-white/5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div 
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${
                mode === 'accept'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
              }`}
            >
              {mode === 'accept' ? <CheckCircle size={26} /> : <XCircle size={26} />}
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {mode === 'accept' ? 'اعتماد طلب الارتباط التجاري B2B' : 'رفض طلب الارتباط التجاري'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {mode === 'accept'
                  ? 'حدد فئة السعر وسقف المديونية وشروط الدفع لتفعيل الحساب فوراً'
                  : 'إغلاق الطلب مع إمكانية توضيح سبب الرفض للتاجر'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Trader Card Summary */}
        <div className="mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 to-navy-950/80 border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store size={18} className="text-amber-400" />
              <span className="text-sm font-black text-white">{request.senderShopName}</span>
              {request.senderOwnerName && (
                <span className="text-xs text-gray-400">({request.senderOwnerName})</span>
              )}
            </div>
            <span className="text-[11px] text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md font-bold">
              {request.senderBusinessType || 'تاجر تجزئة'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400 pt-1 flex-wrap">
            {request.senderLocation && (
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-teal-400" />
                <span>الموقع: <strong className="text-white">{request.senderLocation}</strong></span>
              </span>
            )}
            {request.senderPhone && (
              <span>الهاتف: <strong className="text-white font-mono">{request.senderPhone}</strong></span>
            )}
            {request.createdAt && (
              <span>
                تاريخ الطلب:{' '}
                <strong className="text-gray-300">
                  {request.createdAt?.toDate 
                    ? request.createdAt.toDate().toLocaleDateString('ar-YE') 
                    : new Date(request.createdAt).toLocaleDateString('ar-YE')}
                </strong>
              </span>
            )}
          </div>

          {/* Commercial Notes from Trader */}
          {request.notes && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/95 mt-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px] mb-1">
                <MessageSquare size={13} />
                <span>الملاحظات التجارية (أدخلها التاجر الطالب):</span>
              </div>
              <p className="italic leading-relaxed">"{request.notes}"</p>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-bold text-rose-300 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Form Content */}
        <div className="p-6 space-y-5">
          {mode === 'accept' ? (
            <>
              {/* 1. Price Tier Selection */}
              <div className="space-y-2">
                <label className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Tag size={14} />
                  <span>1. فئة السعر المخصصة للتاجر (تحديد فوري):</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {PRICE_TIERS.map((tier) => {
                    const isSelected = assignedTier === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setAssignedTier(tier.id)}
                        className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                            {tier.label}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black border ${tier.badge}`}>
                            {tier.id === 'imported' ? 'خصم استيرادي' : tier.id === 'wholesale_wholesale' ? 'جملة كبرى' : tier.id === 'wholesale' ? 'جملة معتمدة' : 'تجزئة'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {tier.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Order Payment Types (نوع الطلبات: نقد أو آجل أو إيداع أو JAM Pay) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <CreditCard size={14} />
                  <span>2. نوع الطلبات والتعامل المسموح به للتاجر:</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ORDER_PAYMENT_TYPES.map((opt) => {
                    const isSelected = selectedOrderTypes.includes(opt.id);
                    const IconComp = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleOrderType(opt.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 relative ${
                          isSelected
                            ? `${opt.color} ring-2 ring-amber-500/30 shadow-md scale-[1.02]`
                            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                        <IconComp size={16} />
                        <span className="text-xs font-black">{opt.label}</span>
                        <span className="text-[9px] text-gray-400 line-clamp-1">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Debt & Credit Limit (إذا كان نوع الطلبات يتضمن "آجل / دين") */}
              {isCreditEnabled ? (
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <ShieldCheck size={14} />
                      <span>3. سقف الدين والمديونية المسموح به (بالريال اليمني):</span>
                    </label>
                    <span className="text-xs font-mono font-black text-emerald-400">
                      {creditLimit.toLocaleString()} ر.ي
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {CREDIT_PRESETS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCreditLimit(amt)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black border transition-all cursor-pointer ${
                          creditLimit === amt
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30'
                            : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {(amt / 1000).toLocaleString()} ألف
                      </button>
                    ))}
                  </div>

                  <div className="relative mt-1">
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none transition-all pl-16 text-left"
                      placeholder="أدخل سقف الائتمان..."
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">
                      ر.ي
                    </span>
                  </div>

                  {/* Payment terms options */}
                  <div className="pt-2 border-t border-white/5">
                    <label className="text-[11px] font-bold text-gray-300 block mb-1.5">
                      فترة سداد المديونية وشروط الاستحقاق:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {PAYMENT_TERMS_OPTIONS.map((term) => {
                        const isSelected = paymentTerms === term.id;
                        return (
                          <button
                            key={term.id}
                            type="button"
                            onClick={() => setPaymentTerms(term.id)}
                            className={`p-2 rounded-lg border text-center text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-blue-500/20 border-blue-500/60 text-blue-300 ring-1 ring-blue-500/30'
                                : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                          >
                            {term.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  <span>
                    التعامل محدد حالياً كـ (دفع فوري / نقد / إيداع)، بدون فتح حساب آجل أو سقف مديونية.
                  </span>
                </div>
              )}

              {/* 4. Supplier Commercial Terms & Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Building2 size={14} />
                  <span>4. الملاحظات التجارية والشروط من المورد:</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="اكتب أي شروط خاصة بالتوريد أو التسليم، مواعيد استلام البضائع، أو حسابات التحويل..."
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:border-amber-500 focus:outline-none transition-all resize-none"
                />
              </div>
            </>
          ) : (
            /* Rejection Form */
            <div className="space-y-3">
              <label className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>سبب الرفض (اختياري):</span>
              </label>
              <textarea
                rows={3}
                placeholder="مثال: الاكتفاء في المنطقة الجغرافية، أو عدم استيفاء شروط التوريد حالياً..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-500 focus:border-rose-500 focus:outline-none transition-all resize-none"
              />
              <p className="text-[11px] text-gray-400 leading-relaxed">
                سيتم إخطار التاجر برفض الطلب، ويمكنه إعادة تقديم طلب جديد لاحقاً في حال استيفاء المتطلبات.
              </p>
            </div>
          )}

          {/* Action Footer Buttons */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirmDecision}
              disabled={isProcessing}
              className={`flex-1 py-3 px-6 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none ${
                mode === 'accept'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-500/20'
              }`}
            >
              {mode === 'accept' ? (
                <>
                  <CheckCircle size={16} className={isProcessing ? 'animate-spin' : ''} />
                  <span>{isProcessing ? 'جاري الاعتماد والتفعيل...' : 'اعتماد الارتباط وتفعيل التسعير الفوري ✅'}</span>
                </>
              ) : (
                <>
                  <XCircle size={16} className={isProcessing ? 'animate-spin' : ''} />
                  <span>{isProcessing ? 'جاري الرفض...' : 'تأكيد رفض الطلب وإغلاقه ✕'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
