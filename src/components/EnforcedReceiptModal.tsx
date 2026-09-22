import React, { useState } from 'react';
import { Shield, Sparkles, X, CheckCircle } from 'lucide-react';

interface FinancialBox {
  id: string;
  bankName: string;
  accountNumber?: string;
  balance: number;
  currency: string;
}

interface EnforcedReceiptModalProps {
  isOpen: boolean;
  amount: number;
  currency: string;
  remittanceNumber: string;
  availableBoxes: FinancialBox[];
  onConfirm: (destType: string, selectedBoxId: string, details: string) => void;
  onClose: () => void;
}

export const EnforcedReceiptModal: React.FC<EnforcedReceiptModalProps> = ({ 
  isOpen, 
  amount, 
  currency,
  remittanceNumber, 
  availableBoxes, 
  onConfirm,
  onClose
}) => {
  const [destType, setDestType] = useState('BANK_ACCOUNT');
  const [selectedBox, setSelectedBox] = useState('');
  const [recipientDetails, setRecipientDetails] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (destType === 'BANK_ACCOUNT' && !selectedBox) {
      alert('الرجاء اختيار الحساب البنكي / الصندوق!');
      return;
    }
    if (!recipientDetails.trim()) {
      alert('الرجاء كتابة تفاصيل المستلم الفعلي لإثبات الترحيل المالي!');
      return;
    }
    onConfirm(destType, selectedBox, recipientDetails);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-navy-950 dark:bg-navy-950 border border-brand-primary/20 text-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in my-8">
        {/* Header decoration */}
        <div className="bg-gradient-to-l from-brand-primary/20 to-brand-primary/5 p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-primary/20 text-brand-primary rounded-2xl">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-wide text-brand-primary">🚨 نافذة إجبارية: تأكيد استلام الإيداع / التحويل</h3>
              <p className="text-xs text-gray-400 font-bold mt-0.5">سجل الرقابة المشفر - توثيق المعاملة المالية</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Remittance Detail summary */}
          <div className="bg-navy-900 border border-white/5 rounded-2xl p-5 space-y-2">
            <div className="flex justify-between text-xs font-bold text-gray-400">
              <span>رقم العملية / الإيداع:</span>
              <span className="font-mono text-brand-primary">{remittanceNumber}</span>
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-3">
              <span className="text-sm font-bold">المبلغ المراد إيداعه:</span>
              <span className="text-2xl font-black text-[#d4af37] font-mono">{amount.toLocaleString()} {currency}</span>
            </div>
          </div>

          {/* Action Destination Input */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-wider block">
              مسار الإيداع والتحويل (تحديد حساب المحل):
            </label>
            <select 
              value={destType} 
              onChange={(e) => {
                setDestType(e.target.value);
                if (e.target.value !== 'BANK_ACCOUNT') {
                  setSelectedBox('');
                }
              }} 
              className="w-full bg-navy-900 border-none text-white px-4 py-3 rounded-xl font-bold focus:ring-2 ring-brand-primary/50 transition-all text-sm outline-none cursor-pointer"
            >
              <option value="BANK_ACCOUNT">إيداع مباشر في حساب بنكي / صرافة للمحل</option>
              <option value="CASH_TO_STORE">استلام نقدي مباشر للمحل (صندوق الكاش)</option>
              <option value="BIG_MERCHANT">تحويل مباشر لحساب تاجر (تصفية حساب)</option>
              <option value="OWNER_HANDOVER">تسليم مباشر للمالك</option>
            </select>
          </div>

          {/* Bank Account Selection (conditional) */}
          {destType === 'BANK_ACCOUNT' && (
            <div className="space-y-2 animate-slide-up">
              <label className="text-xs font-black text-gray-400 uppercase tracking-wider block">
                اختر الحساب البنكي/الصندوق الذي تم إيداع المبلغ فيه لزيادة رصيده:
              </label>
              <select 
                value={selectedBox} 
                onChange={(e) => setSelectedBox(e.target.value)} 
                className="w-full bg-navy-900 border-none text-white px-4 py-3 rounded-xl font-bold focus:ring-2 ring-brand-primary/50 transition-all text-sm outline-none cursor-pointer"
              >
                <option value="">-- اختر الحساب المالي --</option>
                {availableBoxes.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} (رقم: {b.accountNumber || 'N/A'}) [رصيد: {b.balance.toLocaleString()} {b.currency}]
                  </option>
                ))}
              </select>
              {availableBoxes.length === 0 && (
                <p className="text-xs text-[#e74c3c] font-black mt-1">
                  * لم يتم تهيئة أي حسابات بنكية مسبقاً! يرجى تهيئتها أولاً من إعدادات الحسابات البنكية.
                </p>
              )}
            </div>
          )}

          {/* Recipient Details (Required text area as verification control) */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-wider block">
              تدوين اسم المستلم الفعلي ومكان تحويل المبلغ بالتفصيل:
            </label>
            <textarea 
              value={recipientDetails} 
              onChange={(e) => setRecipientDetails(e.target.value)} 
              rows={3}
              required
              className="w-full bg-navy-900 border-none text-white p-4 rounded-xl font-bold focus:ring-2 ring-brand-primary/50 transition-all text-sm outline-none placeholder:text-gray-500"
              placeholder="اكتب اسم الموظف المستلم أو التفاصيل للتسوية الرقابية المباشرة لتوثيقها في سجل الرقابة..."
            />
          </div>

          {/* Actions button */}
          <div className="border-t border-white/5 pt-6 flex gap-4">
            <button 
              type="submit" 
              className="flex-1 bg-brand-primary text-white font-black py-4 rounded-2xl hover:bg-brand-primary-hover transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-primary/20"
            >
              <CheckCircle size={18} />
              تأكيد الترحيل وحفظ في سجل الرقابة
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="px-6 bg-navy-900 hover:bg-navy-850 text-gray-400 hover:text-white font-black py-4 rounded-2xl transition-all text-sm"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
