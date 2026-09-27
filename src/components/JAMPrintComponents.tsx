import React from 'react';

// واجهة البيانات المشتركة لضمان عدم التكرار أوفلاين
export interface BaseDocument {
  id: string;          // UUID v4 الفريد عالمياً لمنع التكرار عند المزامنة
  docNumber: string;   // الرقم التسلسلي المحلي (Branch-Device-Sequence)
  date: string;
  userId: string;      // الموظف المنفذ للعملية
}

// ==========================================
// 1 & 2. مكون فواتير البيع (جملة / تجزئة)
// ==========================================
interface SaleInvoiceProps {
  doc: BaseDocument;
  customerName: string;
  customerPhone: string;
  items: Array<{ id: string; name: string; qty: number; price: number; discount: number }>;
  isWholesale: boolean; // للتفريق بين الجملة والتجزئة بناءً على مستويات العزل
}

export const SaleInvoiceComponent: React.FC<SaleInvoiceProps> = ({ doc, customerName, customerPhone, items, isWholesale }) => {
  const totalBeforeDiscount = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0);
  const finalTotal = totalBeforeDiscount - totalDiscount;

  return (
    <div className="p-4 max-w-2xl mx-auto bg-white text-slate-900 border border-gray-300 font-sans shadow-sm printable text-right" dir="rtl">
      {/* الهيدر المحاسبي المطور مع الشعار ثلاثي الأبعاد الموحد */}
      <div className="text-center border-b-2 border-slate-900 pb-2 mb-4 flex flex-col items-center justify-center">
        <img 
          src="/assets/icons/merchant-app-icon.png" 
          onError={(e) => { e.currentTarget.src = "/assets/icons/merchant-app-icon.png" }} 
          alt="JAM 3D Logo" 
          className="w-24 h-auto object-contain mb-2 print:w-28" 
        />
        <h1 className="text-xl font-black tracking-wide">AL-THURAYA ERP / JAM SYSTEM PRO</h1>
        <p className="text-[11px] text-gray-500 font-bold">منظومة إدارة المبيعات والمخازن الذكية</p>
        <div className="mt-2 text-xs font-black bg-slate-100 py-1 inline-block px-4 rounded border border-slate-200">
          {isWholesale ? "📋 فاتورة مبيعات - جملة" : "🛒 فاتورة مبيعات - تجزئة"}
        </div>
      </div>

      {/* معلومات الفاتورة والعميل */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-4 bg-gray-50 p-3 rounded border border-dashed border-gray-200">
        <div><strong>رقم الفاتورة:</strong> {doc.docNumber}</div>
        <div className="text-left" dir="ltr"><strong>التاريخ:</strong> {doc.date}</div>
        <div><strong>العميل:</strong> {customerName}</div>
        <div className="text-left"><strong>رقم الهاتف:</strong> {customerPhone}</div>
        <div className="col-span-2 text-[10px] text-gray-400 break-all font-mono" dir="ltr"><strong>Protected UUID:</strong> {doc.id}</div>
      </div>

      {/* جدول المواد */}
      <table className="w-full text-right text-xs border-collapse border border-gray-300">
        <thead>
          <tr className="bg-slate-900 text-white text-[11px]">
            <th className="p-2 border border-gray-350 text-right">المادة / الصنف</th>
            <th className="p-2 border border-gray-355 text-center">الكمية</th>
            <th className="p-2 border border-gray-355 text-center">السعر</th>
            <th className="p-2 border border-gray-355 text-center">الخصم</th>
            <th className="p-2 border border-gray-355 text-left">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id || index} className="odd:bg-gray-50 hover:bg-slate-100 transition-colors">
              <td className="p-2 border border-gray-300 font-bold">{item.name}</td>
              <td className="p-2 border border-gray-300 text-center font-mono">{item.qty}</td>
              <td className="p-2 border border-gray-300 text-center font-mono">{item.price.toLocaleString()}</td>
              <td className="p-2 border border-gray-300 text-center font-mono text-rose-600">{item.discount.toLocaleString()}</td>
              <td className="p-2 border border-gray-300 text-left font-mono font-bold">{((item.qty * item.price) - item.discount).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* المجاميع والتوقيع */}
      <div className="mt-4 flex justify-between items-start text-xs">
        <div className="text-[10px] text-gray-500 max-w-[250px] leading-relaxed">
          * خاضع لقوانين الحماية وعزل أسعار الجملة عن التجزئة بنظام Diamond Isolation.
          <br />
          * يرجى الاحتفاظ بالفاتورة للمطالبة والضمان.
        </div>
        <div className="w-56 text-left space-y-1">
          <div className="flex justify-between border-b pb-1">
            <span>الإجمالي:</span> 
            <span className="font-mono font-bold">{totalBeforeDiscount.toLocaleString()} ر.ي</span>
          </div>
          <div className="flex justify-between border-b pb-1 text-rose-600">
            <span>إجمالي الخصم:</span> 
            <span className="font-mono font-bold">-{totalDiscount.toLocaleString()} ر.ي</span>
          </div>
          <div className="flex justify-between font-bold text-sm bg-slate-900 text-white p-2 rounded">
            <span>صافي الفاتورة:</span> 
            <span className="font-mono">{finalTotal.toLocaleString()} ر.ي</span>
          </div>
        </div>
      </div>

      {/* Universal elegant Copyright Footer for Invoices */}
      <div className="print-footer-branding text-xs text-gray-500 text-center mt-6 border-t border-gray-300 pt-2" dir="rtl">
        <div className="font-black">Powered by JAM System Pro</div>
        <div className="text-[10px]">م. عبد الغني المحفلي | 772315106</div>
      </div>
    </div>
  );
};

// ==========================================
// 3. مكون كرت واستلام الصيانة
// ==========================================
interface MaintenanceProps {
  doc: BaseDocument;
  customerName: string;
  customerPhone: string;
  deviceType: string;
  serialNumber: string;
  reportedFault: string;
  initialInspection: string;
  estimatedCost: number;
}

export const MaintenanceInvoiceComponent: React.FC<MaintenanceProps> = ({ 
  doc, 
  customerName, 
  customerPhone, 
  deviceType, 
  serialNumber, 
  reportedFault, 
  initialInspection, 
  estimatedCost 
}) => {
  return (
    <div className="p-4 max-w-2xl mx-auto bg-white text-slate-900 border-2 border-dashed border-slate-400 font-sans printable text-right" dir="rtl">
      <div className="text-center border-b pb-2 mb-3 flex flex-col items-center justify-center">
        <img 
          src="/assets/icons/merchant-app-icon.png" 
          onError={(e) => { e.currentTarget.src = "/assets/icons/merchant-app-icon.png" }} 
          alt="JAM 3D Logo" 
          className="w-24 h-auto object-contain mb-2 print:w-28" 
        />
        <h2 className="text-lg font-black text-slate-900">AL-THURAYA ERP - قسم الصيانة والدعم الفني</h2>
        <p className="text-xs text-gray-500 font-bold">إيصال استلام جهاز وإدخال صيانة</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3 bg-slate-50 p-2 rounded border border-gray-200">
        <div><strong>رقم الإيصال:</strong> {doc.docNumber}</div>
        <div className="text-left" dir="ltr"><strong>التاريخ:</strong> {doc.date}</div>
        <div><strong>العميل:</strong> {customerName}</div>
        <div className="text-left"><strong>رقم العميل:</strong> {customerPhone}</div>
      </div>

      <div className="border border-gray-300 rounded p-3 bg-gray-50 space-y-2 text-xs mb-4">
        <h3 className="font-bold border-b pb-1 text-slate-800">🛠️ مواصفات الجهاز والفحص المبدئي</h3>
        <div className="grid grid-cols-2 gap-2 leading-relaxed">
          <div><strong>نوع وموديل الجهاز:</strong> {deviceType}</div>
          <div><strong>الرقم التسلسلي (S/N):</strong> {serialNumber}</div>
          <div className="col-span-2"><strong>العطل المذكور من العميل:</strong> <span className="text-rose-600 font-bold">{reportedFault}</span></div>
          <div className="col-span-2"><strong>الفحص المهني الأولي:</strong> {initialInspection}</div>
          <div className="col-span-2 border-t pt-2 font-black text-slate-900 text-sm">
            التكلفة التقديرية للصيانة: 
            <span className="font-mono text-base text-emerald-700 mr-2">{estimatedCost.toLocaleString()} ر.ي</span>
          </div>
        </div>
      </div>

      {/* الشروط القانونية لحماية صاحب المحل */}
      <div className="text-[9px] text-gray-500 bg-gray-150 p-3 rounded border border-gray-200 mb-4 leading-relaxed">
        <strong>⚠️ شروط إخلاء المسؤولية القانونية للصيانة:</strong><br />
        1. المحل غير مسؤول عن فقدان أي بيانات أو معلومات داخل الجهاز المستلم، وعلى العميل أخذ نسخة احتياطية.<br />
        2. إذا لم يقم العميل باستلام جهازه خلال 30 يوماً من تاريخ إشعار الإصلاح، يحق للمحل التصرف بالجهاز لتغطية التكاليف كتعويض عادل.<br />
        3. الضمان يشمل فقط القطع المستبدلة والعطل المصلح والموثق في الفاتورة الرسمية اللاحقة.
      </div>

      <div className="flex justify-between items-center pt-4 text-xs">
        <div className="text-center w-36 border-t border-gray-400 pt-2">توقيع المستلم للعملية</div>
        <div className="text-center w-36 border-t border-gray-400 pt-2 font-bold">توقيع وموافقة العميل</div>
      </div>

      {/* Universal elegant Copyright Footer for Maintenance */}
      <div className="print-footer-branding text-xs text-gray-500 text-center mt-6 border-t border-gray-300 pt-2" dir="rtl">
        <div className="font-black">Powered by JAM System Pro</div>
        <div className="text-[10px]">م. عبد الغني المحفلي | 772315106</div>
      </div>
    </div>
  );
};

// ==========================================
// 4. لاصق الصيانة الصغير (ملصق الباركود الحراري)
// ==========================================
export const MaintenanceStickerComponent: React.FC<{ docNumber: string; customerName: string; deviceType: string; reportedFault: string }> = ({ 
  docNumber, 
  customerName, 
  deviceType, 
  reportedFault 
}) => {
  return (
    <div className="w-[50mm] h-[30mm] p-2 bg-white text-black font-sans border-2 border-black flex flex-col justify-between text-center select-none shadow-sm" style={{ fontSize: '9px' }} dir="rtl">
      <div className="font-black border-b border-black pb-0.5 text-[10px] tracking-tight">JAM SYSTEM PRO - MAINTENANCE</div>
      <div className="text-right px-0.5 space-y-0.5 font-bold">
        <div><strong>الرقم:</strong> <span className="font-mono">{docNumber}</span></div>
        <div className="truncate"><strong>العميل:</strong> {customerName}</div>
        <div className="truncate"><strong>الجهاز:</strong> {deviceType}</div>
        <div className="truncate text-red-600"><strong>العطل:</strong> {reportedFault}</div>
      </div>
      {/* تمثيل الباركود البرمي المدمج لليزر الهاردوير */}
      <div className="mt-1 bg-black h-5 w-full flex items-center justify-center text-white text-[8px] font-mono tracking-widest leading-none">
        *M-{docNumber}*
      </div>
    </div>
  );
};

// ==========================================
// 5. سند إنشاء حساب عميل جديد (بطاقة تعريف وقيد)
// ==========================================
interface CreateCustomerProps {
  doc: BaseDocument;
  accountName: string;
  phone: string;
  creditLimit: number;
  initialBalance: number;
  customerTier: 'RETAIL' | 'WHOLESALE'; // فئة التاجر لحظر وحماية الأسرار
}

export const CreateCustomerVoucherComponent: React.FC<CreateCustomerProps> = ({ 
  doc, 
  accountName, 
  phone, 
  creditLimit, 
  initialBalance, 
  customerTier 
}) => {
  return (
    <div className="p-4 max-w-xl mx-auto bg-white text-slate-900 border-2 border-slate-900 font-sans shadow-sm printable text-right" dir="rtl">
      <div className="text-center border-b pb-2 mb-4 bg-slate-900 text-white p-2 rounded-t flex flex-col items-center justify-center">
        <img 
          src="/assets/icons/merchant-app-icon.png" 
          onError={(e) => { e.currentTarget.src = "/assets/icons/merchant-app-icon.png" }} 
          alt="JAM 3D Logo" 
          className="w-20 h-auto object-contain mb-2 invert brightness-200" 
        />
        <h2 className="text-md font-black tracking-wider">سند قيد وإنشاء حساب عميل جديد</h2>
        <p className="text-[10px] text-gray-300">دليل الحسابات - الترابط الشبكي والعمل أوفلاين</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <div><strong>رقم القيد الآلي:</strong> <span className="font-mono font-black text-brand-primary">{doc.docNumber}</span></div>
        <div className="text-left" dir="ltr"><strong>تاريخ الإنشاء:</strong> {doc.date}</div>
        <div className="col-span-2 border-t my-1"></div>
        <div><strong>اسم الحساب (العميل):</strong> <span className="text-sm font-black text-slate-900">{accountName}</span></div>
        <div className="text-left"><strong>رقم الهاتف المعتمد للطلب:</strong> <span className="font-mono font-bold">{phone}</span></div>
      </div>

      <div className="border border-gray-300 rounded p-3 bg-gray-50 text-xs space-y-2 mb-4">
        <div className="flex justify-between border-b pb-1">
          <span>فئة التعامل والتسعير المقفلة:</span>
          <span className={`font-black px-2.5 py-0.5 rounded-lg text-[10px] ${customerTier === 'WHOLESALE' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-blue-500/10 text-blue-700'}`}>
            {customerTier === 'WHOLESALE' ? "💎 تاجر جملة معتمد" : "🛒 عميل تجزئة / مفرق"}
          </span>
        </div>
        <div className="flex justify-between border-b pb-1">
          <span>السقف الائتماني المسموح به للدين:</span>
          <span className="font-mono font-black text-rose-600">{creditLimit.toLocaleString()} ر.ي</span>
        </div>
        <div className="flex justify-between font-black text-slate-800">
          <span>الرصيد الافتتاحي المقيد:</span>
          <span className="font-mono text-sm">{initialBalance.toLocaleString()} ر.ي</span>
        </div>
      </div>

      <div className="text-[9px] text-center text-gray-400 border-t pt-2 break-all font-mono" dir="ltr">
        Offline Protected UUID: {doc.id}
      </div>

      {/* Universal elegant Copyright Footer for Customer Voucher */}
      <div className="print-footer-branding text-xs text-gray-550 text-center mt-6 border-t border-gray-300 pt-2" dir="rtl">
        <div className="font-black">Powered by JAM System Pro</div>
        <div className="text-[10px]">م. عبد الغني المحفلي | 772315106</div>
      </div>
    </div>
  );
};
