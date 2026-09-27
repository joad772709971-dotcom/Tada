import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserCheck, 
  UserPlus, 
  Search, 
  AlertCircle, 
  CheckCircle, 
  DollarSign, 
  Calendar, 
  FileText,
  Smartphone,
  CreditCard,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import { collection, getDocs, query, where, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { CustomerDebtLinkPayload } from '../../types';
import { smartAccountingService } from '../../services/smartAccountingService';

interface CustomerDebtLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: { customerName: string; amount: number; newBalance: number }) => void;
  storeId: string;
  ownerId: string;
  initialData?: {
    amount: number;
    description: string;
    sourceType: 'telecom_operation' | 'purchase_invoice' | 'service';
    sourceReference: string;
    suggestedPhone?: string;
  };
}

export const CustomerDebtLinkModal: React.FC<CustomerDebtLinkModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  storeId,
  ownerId,
  initialData
}) => {
  const [searchTerm, setSearchTerm] = useState(initialData?.suggestedPhone || '');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // New customer quick-create state
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState(initialData?.suggestedPhone || '');

  // Form data
  const [amount, setAmount] = useState(initialData?.amount || 0);
  const [description, setDescription] = useState(initialData?.description || '');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setAmount(initialData.amount || 0);
      setDescription(initialData.description || '');
      if (initialData.suggestedPhone) {
        setSearchTerm(initialData.suggestedPhone);
        setNewPhone(initialData.suggestedPhone);
      }
    }
  }, [initialData]);

  // Search existing customers
  useEffect(() => {
    if (!isOpen || !ownerId) return;

    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, 'customers'),
          where('ownerId', '==', ownerId),
          limit(50)
        );
        const snap = await getDocs(q);
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setCustomers(list);

        // Auto-select if matches phone
        if (initialData?.suggestedPhone) {
          const match = list.find(c => c.phone === initialData.suggestedPhone);
          if (match) {
            setSelectedCustomer(match);
          }
        }
      } catch (err) {
        console.warn('Failed to load customers for debt link:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [isOpen, ownerId, initialData?.suggestedPhone]);

  if (!isOpen) return null;

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term))
    );
  });

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMsg('اسم العميل مطلوب');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const newCustRef = await addDoc(collection(db, 'customers'), {
        ownerId,
        storeId,
        name: newName.trim(),
        phone: newPhone.trim(),
        balance: 0,
        totalDebt: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const created = {
        id: newCustRef.id,
        name: newName.trim(),
        phone: newPhone.trim(),
        balance: 0,
        totalDebt: 0
      };

      setCustomers(prev => [created, ...prev]);
      setSelectedCustomer(created);
      setShowCreateNew(false);
    } catch (err: any) {
      setErrorMsg('فشل إنشاء العميل: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDebt = async () => {
    if (!selectedCustomer) {
      setErrorMsg('يرجى تحديد العميل الذي سيُقيد عليه الدين.');
      return;
    }
    if (amount <= 0) {
      setErrorMsg('مبلغ الدين يجب أن يكون أكبر من صفر.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload: CustomerDebtLinkPayload = {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        amount: Number(amount),
        date: new Date().toISOString().split('T')[0],
        description: description || `دين سداد/خدمة للعميل ${selectedCustomer.name}`,
        sourceType: initialData?.sourceType || 'telecom_operation',
        sourceReference: initialData?.sourceReference || `REF-${Date.now()}`,
        storeId,
        ownerId,
        notes
      };

      const result = await smartAccountingService.linkToCustomerDebt(payload);

      onSuccess({
        customerName: selectedCustomer.name,
        amount: Number(amount),
        newBalance: result.newBalance
      });
      onClose();
    } catch (err: any) {
      setErrorMsg('حدث خطأ أثناء تقييد الدين: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDebt = Number(selectedCustomer?.balance || selectedCustomer?.totalDebt || 0);
  const projectedDebt = currentDebt + Number(amount || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" dir="rtl">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">ربط العملية كدين على عميل</h3>
              <p className="text-xs text-slate-400">تقييد المبلغ آلياً في ذمة العميل وتحديث كشف حسابه</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Operation Details Card */}
          <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>مصدر العملية:</span>
              <span className="font-mono text-slate-300 bg-slate-700 px-2 py-0.5 rounded">
                {initialData?.sourceReference || 'عملية سداد / فاتورة'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">مبلغ الدين المطلوب تقييده:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-32 bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-1.5 text-left text-base font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs font-bold text-amber-400">ر.ي</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">بيان القيد:</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="مثال: تسديد باقة فورجي 10 جيجا آجل"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Customer Selection Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                تحديد العميل:
              </label>
              <button
                type="button"
                onClick={() => setShowCreateNew(!showCreateNew)}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {showCreateNew ? 'إلغاء وإظهار القائمة' : 'تسجيل عميل جديد سريعاً'}
              </button>
            </div>

            {showCreateNew ? (
              <form onSubmit={handleCreateCustomer} className="p-4 bg-slate-800/60 border border-cyan-500/30 rounded-xl space-y-3">
                <div className="text-xs font-bold text-cyan-300">إضافة عميل جديد لقاعدة البيانات:</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">اسم العميل *</label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="محمد علي..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="77xxxxxxx"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    حفظ واختيار العميل
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                {/* Search box */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث باسم العميل أو رقم الهاتف..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Customer List */}
                <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/80 bg-slate-900/50">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      لا يوجد عميل مطابق للبحث. اضغط على "تسجيل عميل جديد" لإضافته.
                    </div>
                  ) : (
                    filteredCustomers.map(cust => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => setSelectedCustomer(cust)}
                        className={`w-full text-right px-3 py-2.5 text-xs flex items-center justify-between transition-colors ${
                          selectedCustomer?.id === cust.id 
                            ? 'bg-cyan-500/15 border-r-2 border-cyan-400 text-white font-bold' 
                            : 'hover:bg-slate-800/70 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{cust.name}</span>
                          {cust.phone && <span className="text-[11px] text-slate-400 font-mono">({cust.phone})</span>}
                        </div>
                        <div className="text-left font-mono">
                          <span className="text-[11px] text-slate-400">الدين الحالي: </span>
                          <span className={`font-bold ${Number(cust.balance || cust.totalDebt || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {Number(cust.balance || cust.totalDebt || 0).toLocaleString()} ر.ي
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Account Impact Preview */}
          {selectedCustomer && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                أثر المعاملة على كشف حساب ({selectedCustomer.name}):
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                <div className="bg-slate-900/60 p-2 rounded-lg">
                  <span className="block text-[10px] text-slate-400">الرصيد السابق</span>
                  <span className="font-bold text-slate-200">{currentDebt.toLocaleString()} ر.ي</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg">
                  <span className="block text-[10px] text-amber-400">المبلغ المضاف</span>
                  <span className="font-bold text-amber-400">+{Number(amount).toLocaleString()} ر.ي</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-amber-500/30">
                  <span className="block text-[10px] text-rose-300">الرصيد الجديد</span>
                  <span className="font-bold text-rose-400">{projectedDebt.toLocaleString()} ر.ي</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">ملاحظات إضافية (اختياري):</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل تود تسجيلها في سند القيد..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!selectedCustomer || amount <= 0 || isSubmitting}
            onClick={handleConfirmDebt}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>جاري تقييد الدين...</span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>تأكيد وتقييد الدين على العميل</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
