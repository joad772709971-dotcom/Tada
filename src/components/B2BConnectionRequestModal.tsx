import React, { useState } from 'react';
import { 
  Building2, 
  Send, 
  X, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Store,
  Sparkles,
  Layers
} from 'lucide-react';
import { b2bLinkageEngine } from '../services/b2bLinkageEngine';

interface B2BConnectionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSupplier: any | null;
  currentUserProfile: any;
  onSuccess?: (supplierName: string) => void;
}

const TRADER_TYPES = [
  { id: 'retail_shop', label: 'محل تجزئة', desc: 'بيع مباشر وتجزئة للمستهلكين', icon: '🛒' },
  { id: 'wholesaler', label: 'تاجر جملة', desc: 'توريد للمحلات ومنافذ التجزئة', icon: '🏬' },
  { id: 'importer', label: 'مستورد', desc: 'استيراد وتوزيع مباشر', icon: '🚢' },
  { id: 'wholesale_wholesale', label: 'جملة الجملة', desc: 'مستودعات وتوريد كبرى', icon: '📦' },
];

export const B2BConnectionRequestModal: React.FC<B2BConnectionRequestModalProps> = ({
  isOpen,
  onClose,
  targetSupplier,
  currentUserProfile,
  onSuccess
}) => {
  // Auto-detect trader type based on shop profile
  const getInitialTraderType = () => {
    const lvl = Number(currentUserProfile?.hierarchyLevel);
    const role = String(currentUserProfile?.networkRole || currentUserProfile?.role || '');
    if (lvl === 1 || role === 'importer') return 'importer';
    if (lvl === 2 || role === 'master_wholesale' || role === 'wholesale_wholesale') return 'wholesale_wholesale';
    if (lvl === 3 || role === 'wholesaler') return 'wholesaler';
    return 'retail_shop';
  };

  const [traderType, setTraderType] = useState(getInitialTraderType());
  const [shopName, setShopName] = useState(
    currentUserProfile?.shopName || currentUserProfile?.name || ''
  );
  const [salesLocation, setSalesLocation] = useState(
    currentUserProfile?.salesLocation || currentUserProfile?.city || currentUserProfile?.address || ''
  );
  const [contactPhone, setContactPhone] = useState(
    currentUserProfile?.phone || currentUserProfile?.shopPhone || ''
  );
  const [commercialNotes, setCommercialNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen || !targetSupplier) return null;

  const supplierId = targetSupplier.id || targetSupplier.uid || targetSupplier.ownerId;
  const supplierName = targetSupplier.name || targetSupplier.shopName || 'المورد المعتمد';
  const supplierLocation = targetSupplier.salesLocation || targetSupplier.city || 'الجمهورية اليمنية';
  const supplierLvl = Number(targetSupplier.hierarchyLevel || 3);
  const supplierRank = 
    supplierLvl === 1 ? 'مستورد رئيسي 🚢' : 
    supplierLvl === 2 ? 'جملة الجملة 📦' : 
    'تاجر جملة 🏬';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!shopName.trim()) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال اسم المحل أو المنشأة التجارية.' });
      return;
    }
    if (!salesLocation.trim()) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال موقع البيع (المدينة / الشارع / السوق).' });
      return;
    }
    if (!contactPhone.trim()) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال رقم الهاتف للتواصل والتحقق.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedTypeObj = TRADER_TYPES.find(t => t.id === traderType);
      const businessTypeLabel = selectedTypeObj?.label || 'محل تجزئة';

      const res = await b2bLinkageEngine.sendConnectionRequest({
        senderProfile: {
          ...currentUserProfile,
          shopName: shopName.trim(),
          phone: contactPhone.trim(),
          salesLocation: salesLocation.trim(),
          businessType: businessTypeLabel,
          ownerId: currentUserProfile?.ownerId || currentUserProfile?.uid
        },
        receiverSupplier: {
          id: supplierId,
          name: supplierName,
          shopName: supplierName,
          phone: targetSupplier.phone || ''
        },
        notes: commercialNotes.trim(),
        connectionMethod: 'in_app_request'
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: '✅ تم إرسال طلب الارتباط التجاري بنجاح! سيصل إشعار فوري للمورد في قائمته الجانبية لتحديد شروط التعامل.'
        });
        if (onSuccess) {
          onSuccess(supplierName);
        }
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'تعذر إرسال الطلب، يرجى المحاولة لاحقاً.' });
      }
    } catch (err: any) {
      console.error('Submit connection request failed:', err);
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ غير متوقع أثناء إرسال الطلب.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in"
      dir="rtl"
    >
      <div 
        className="relative w-full max-w-xl bg-[#0a0e1c] border border-amber-500/30 rounded-3xl shadow-[0_0_50px_rgba(217,119,6,0.15)] overflow-hidden text-right my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Glow */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-white/5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">طلب ارتباط تجاري رسمي B2B</h3>
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles size={11} />
                  <span>اعتماد مباشر</span>
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                تأكيد بيانات المنشأة وموقع البيع لإرسال الطلب واعتماد فئة التسعير ونوع التعامل
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

        {/* Target Supplier Summary Card */}
        <div className="mx-6 mt-5 p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 to-navy-950/80 border border-white/5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-sm">
              <Store size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white">{supplierName}</span>
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-bold">
                  {supplierRank}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin size={11} className="text-teal-400" />
                  {supplierLocation}
                </span>
                {targetSupplier.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={11} className="text-sky-400" />
                    {targetSupplier.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-left">
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg font-black flex items-center gap-1">
              <ShieldCheck size={12} />
              <span>مورد معتمد</span>
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Trader Activity Type Selection according to user prompt */}
          <div className="space-y-2">
            <label className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <Layers size={14} />
              <span>1. نوع النشاط حسب حساب المحل <span className="text-amber-400">*</span>:</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TRADER_TYPES.map((type) => {
                const isSelected = traderType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setTraderType(type.id)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/40 scale-[1.02]'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className="text-lg">{type.icon}</span>
                    <span className="text-xs font-black">{type.label}</span>
                    <span className="text-[9.5px] text-gray-400 line-clamp-1">{type.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shop Name & Sales Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-200 flex items-center gap-1">
                <span>اسم المحل / المنشأة</span>
                <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: مركز الأمل التجاري"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-500 focus:border-amber-500 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-200 flex items-center gap-1">
                <span>موقع البيع (المدينة / الشارع)</span>
                <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: صنعاء - شارع حدة / جوار البنك"
                value={salesLocation}
                onChange={(e) => setSalesLocation(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-500 focus:border-amber-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Contact Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-200 flex items-center gap-1">
              <span>رقم الهاتف المعتمد</span>
              <span className="text-amber-400">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="77XXXXXXX"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-500 focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>

          {/* Commercial Notes by Trader */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-amber-300 flex items-center gap-1">
              <span>الملاحظات التجارية (يدخلها التاجر الطالب):</span>
            </label>
            <textarea
              rows={2}
              placeholder="اكتب ملاحظاتك التجارية، أصناف السحب المطلوبة، أو مواعيد التوريد المفضلة..."
              value={commercialNotes}
              onChange={(e) => setCommercialNotes(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:border-amber-500 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Security Notice */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 flex items-center gap-2">
            <ShieldCheck size={16} className="shrink-0 text-amber-400" />
            <span>
              سيتولى المورد عند مراجعة الطلب تحديد نوعية الطلبات (نقد / آجل / إيداع / JAM Pay)، وفئة السعر وسقف الدين المعتمد.
            </span>
          </div>

          {/* Submit Action Button */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-6 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
            >
              <Send size={15} className={isSubmitting ? 'animate-bounce' : ''} />
              <span>{isSubmitting ? 'جاري إرسال الطلب...' : 'إرسال طلب الارتباط بضغطة زر 🚀'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
