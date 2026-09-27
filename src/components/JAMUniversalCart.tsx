import React from 'react';

export type IndustryType = 'POULTRY' | 'PHONES' | 'GROCERY' | 'CLOTHING' | 'PARTS' | 'ELECTRONICS';
export type TransactionType = 'SALE' | 'PURCHASE' | 'RETURN';

interface JAMUniversalCartProps {
  industry: IndustryType;
  txType: TransactionType;
  items: any[];
  onAction: (finalData: any) => void;
}

export const JAMUniversalCart: React.FC<JAMUniversalCartProps> = ({ industry, txType, items, onAction }) => {
  
  // تخصيص المسميات والمظهر بناءً على نوع العملية والنشاط
  const renderDynamicFields = (item: any) => {
    switch (industry) {
      case 'PHONES':
        return (
          <div className="text-xs text-blue-400 font-mono">
            📱 معرف الجهاز (HWID): {item.hardwareId || 'لم يتم الربط'} | IMEI: {item.imei}
          </div>
        );
      case 'GROCERY':
        return (
          <div className="text-xs text-amber-400">
            ⏳ تاريخ الانتهاء: {item.expiryDate} | باركود الوحدة: {item.unitBarcode}
          </div>
        );
      case 'CLOTHING':
        return (
          <div className="text-xs text-purple-400">
            📏 المقاس: <span className="font-bold">{item.size}</span> | 🎨 اللون: {item.color}
          </div>
        );
      case 'PARTS':
        return (
          <div className="text-xs text-slate-400 font-mono">
            ⚙️ رقم القطعة المصنعي: {item.partNumber} | الموديلات المتوافقة: {item.compatibility}
          </div>
        );
      case 'ELECTRONICS':
        return (
          <div className="text-xs text-cyan-400">
            ⚡ القدرة: {item.watts} واط | {item.amps} أمبير | 🛡️ الضمان: {item.warrantyMonths} شهر
          </div>
        );
      case 'POULTRY':
        return (
          <div className="text-xs text-emerald-400">
            🥚 تصنيف البيض: {item.eggGrade} | دفعة المزرعة: {item.batchId}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 rounded-xl border bg-zinc-900 border-zinc-800 text-white shadow-2xl">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {txType === 'SALE' && '🧾 شاشة البيع الفوري المعزز'}
            {txType === 'PURCHASE' && '📦 أمر التوريد والمشتريات الثابت'}
            {txType === 'RETURN' && '🔄 كشف المرتجعات المالية المخزنية'}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">نظام JAM System Pro - محرك إدارة الأنشطة المتعددة</p>
        </div>
        <span className="px-3 py-1 text-xs rounded-full font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
          نشاط: {industry}
        </span>
      </div>

      {/* قائمة المواد في السلة */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 text-right" dir="rtl">
        {items.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-lg">
            السلة فارغة حالياً. أضف عناصر من لوحة التحكم أدناه لتأكيد مصفوفة النشاط.
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col gap-2 hover:border-zinc-700 transition-colors text-right">
              <div className="flex justify-between items-center flex-row-reverse">
                <span className="font-medium text-zinc-200">{item.name}</span>
                <div className="text-sm text-zinc-350 font-sans" dir="ltr">
                  Qty: <span className="font-bold text-white">{item.quantity}</span> | 
                  Price: <span className="text-emerald-400 font-mono">{(Number(item.priceMicroUnits) / 1000).toLocaleString()} YER</span>
                </div>
              </div>
              
              {/* ضخ الحقول التخصصية للنشاط المختار */}
              <div className="mt-1" dir="ltr">
                {renderDynamicFields(item)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* زر الاعتماد والترحيل للدورة الحسابية المكونة من 5 مراحل */}
      <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
        <button 
          onClick={() => onAction(items)}
          disabled={items.length === 0}
          className={`px-6 py-3 rounded-lg font-bold text-sm transition-all shadow-lg ${
            items.length > 0
              ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-amber-500/10 cursor-pointer"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          }`}
        >
          {txType === 'RETURN' ? 'تأكيد وحساب تسوية المرتجع 2FA' : 'ترحيل العملية إلى مرحلة الفحص والمطابقة'}
        </button>
      </div>
    </div>
  );
};
