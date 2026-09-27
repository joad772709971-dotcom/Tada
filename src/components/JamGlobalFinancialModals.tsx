import React, { useState, useEffect } from 'react';
import { X, Check, ArrowDownLeft, ArrowUpRight, ShieldAlert, Wallet, UserCheck, Receipt, DollarSign, RefreshCw, Layers } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { employeeDebtGuardService } from '../services/employeeDebtGuardService';

interface Employee {
  uid: string;
  name: string;
  role: string;
}

interface Box {
  id: string;
  name: string;
}

interface JamGlobalFinancialModalsProps {
  profile: any;
  isOpen: boolean;
  type: 'receive' | 'send' | 'custody' | 'voucher' | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const JamGlobalFinancialModals: React.FC<JamGlobalFinancialModalsProps> = ({
  profile,
  isOpen,
  type,
  onClose,
  onSuccess
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('YER');
  const [remittanceNumber, setRemittanceNumber] = useState('');
  const [selectedBox, setSelectedBox] = useState('CASH_BOX');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('سند قبض مالي');

  // Load employees & custom boxes
  useEffect(() => {
    if (!profile?.ownerId || !isOpen) return;

    const loadData = async () => {
      try {
        // Load employees
        const empQuery = query(collection(db, 'users'), where('ownerId', '==', profile.ownerId));
        const empSnap = await getDocs(empQuery);
        const empList: Employee[] = [];
        empSnap.forEach(d => {
          const u = d.data();
          empList.push({ uid: d.id, name: u.name || '', role: u.role || '' });
        });
        setEmployees(empList);
        if (empList.length > 0) {
          setSelectedEmployee(empList[0].uid);
        }

        // Load custom boxes
        const boxList: Box[] = [{ id: 'CASH_BOX', name: 'الصندوق المالي الرئيسي' }];
        const boxesSnap = await getDocs(collection(db, 'stores', profile.ownerId, 'customBoxes'));
        boxesSnap.forEach(d => {
          boxList.push({ id: d.id, name: d.data().name || '' });
        });
        setBoxes(boxList);
        setSelectedBox('CASH_BOX');
      } catch (err) {
        console.error('Error loading metadata for financial modals:', err);
      }
    };

    loadData();
  }, [profile?.ownerId, isOpen]);

  // Reset fields on type change
  useEffect(() => {
    setSenderName('');
    setRecipientName('');
    setAmount('');
    setCurrency('YER');
    setRemittanceNumber('');
    setDescription('');
    if (type === 'custody') {
      setCategory('تسليم عهدة لموظف');
    } else if (type === 'receive') {
      setCategory('حوالة مستلمة');
    } else if (type === 'send') {
      setCategory('حوالة صادرة');
    } else {
      setCategory('سند قبض مباشر');
    }
  }, [type]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      alert('الرجاء إدخال مبلغ صحيح.');
      return;
    }

    setLoading(true);
    try {
      const parsedAmount = Number(amount);
      const isVaultOpen = localStorage.getItem(`jam_vault_open_${profile?.ownerId}`) === 'true';
      const selectedBoxName = boxes.find(b => b.id === selectedBox)?.name || 'الصندوق الرئيسي';

      if (type === 'receive') {
        // 1. استلام حوالة
        const transPayload = {
          type: 'income',
          category: 'حوالة مستلمة',
          amount: parsedAmount,
          currency: currency,
          exchangeRate: 1,
          boxId: selectedBox,
          description: `استلام حوالة رقم (${remittanceNumber || 'N/A'}) من المرسل ${senderName || 'غير مكتوب'} واردة إلى حساب [${selectedBoxName}]`,
          ownerId: profile?.ownerId,
          userId: profile?.uid,
          userName: profile?.name,
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp()
        };
        await addDoc(collection(db, 'transactions'), transPayload);

        // Optional logActivity
        await addDoc(collection(db, 'auditLogs'), {
          action: 'استلام حوالة خاطف',
          details: `تم ترحيل حوالة بقيمة ${parsedAmount} ${currency} رقم #${remittanceNumber || 'لا يوجد'} من ${senderName}`,
          userId: profile?.uid,
          userName: profile?.name,
          createdAt: serverTimestamp()
        });

        onSuccess(`✓ تم قبض واستلام الحوالة رقم ${remittanceNumber || 'بدون رقم'} بمبلغ ${parsedAmount} YER وتوريدها إلى ${selectedBoxName}.`);
      } 
      else if (type === 'send') {
        // 2. إرسال حوالة
        const transPayload = {
          type: 'expense',
          category: 'حوالة صادرة',
          amount: parsedAmount,
          currency: currency,
          exchangeRate: 1,
          boxId: selectedBox,
          description: `إرسال حوالة وتوريدها للشركة رقم (#${remittanceNumber || 'N/A'}) إلى المستلم ${recipientName || 'غير مكتوب'} مخصومة من حساب [${selectedBoxName}]`,
          ownerId: profile?.ownerId,
          userId: profile?.uid,
          userName: profile?.name,
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp()
        };
        await addDoc(collection(db, 'transactions'), transPayload);

        await addDoc(collection(db, 'auditLogs'), {
          action: 'إرسال حوالة صادرة',
          details: `تم تسجيل حوالة صادرة بمبلغ ${parsedAmount} ${currency} إلى ${recipientName} رقم #${remittanceNumber || 'لا يوجد'}`,
          userId: profile?.uid,
          userName: profile?.name,
          createdAt: serverTimestamp()
        });

        onSuccess(`✓ تم إرسال وتوريد الحوالة بنجاح بقيمة ${parsedAmount} ${currency} والخصم من ${selectedBoxName}.`);
      } 
      else if (type === 'custody') {
        // 3. تسليم عهدة
        const emp = employees.find(e => e.uid === selectedEmployee);
        const empName = emp ? emp.name : 'Unknown';

        const transPayload = {
          type: 'expense',
          category: 'تسليم عهدة لموظف',
          amount: parsedAmount,
          currency: currency,
          exchangeRate: 1,
          boxId: selectedBox,
          description: `تسليم وصرف عهدة للموظف/السائق (${empName}) بمبلغ ${parsedAmount} YER مخصومة من [${selectedBoxName}] - ملاحظات: ${description}`,
          ownerId: profile?.ownerId,
          userId: profile?.uid,
          userName: profile?.name,
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp()
        };
        await addDoc(collection(db, 'transactions'), transPayload);

        // Update employee's custodyBalance in the database
        const userRef = doc(db, 'users', selectedEmployee);
        await updateDoc(userRef, {
          custodyBalance: increment(parsedAmount)
        });

        await addDoc(collection(db, 'auditLogs'), {
          action: 'تسليم عهدة خاطف',
          details: `تم تسوية عهدة وتسليم مبلغ ${parsedAmount} YER للموظف: ${empName}`,
          userId: profile?.uid,
          userName: profile?.name,
          createdAt: serverTimestamp()
        });

        onSuccess(`✓ تم صرف وتسليم العهدة بمبلغ ${parsedAmount} YER للموظف (${empName}) وتحديث كشف حسابه آلياً.`);
      } 
      else if (type === 'voucher') {
        // 4. سند قبض مباشر
        const transPayload = {
          type: 'income',
          category: 'سند قبض نقدي',
          amount: parsedAmount,
          currency: currency,
          exchangeRate: 1,
          boxId: selectedBox,
          description: `سند قبض فوري من القباض/العميل (${senderName || 'غير محدد'}) - البيان: ${description || 'N/A'} - الصندوق المصادق: [${selectedBoxName}]`,
          ownerId: profile?.ownerId,
          userId: profile?.uid,
          userName: profile?.name,
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp()
        };
        await addDoc(collection(db, 'transactions'), transPayload);

        await addDoc(collection(db, 'auditLogs'), {
          action: 'سند قبض خاطف',
          details: `تحرير سند قبض نقدي مباشر من: ${senderName || 'N/A'} بقيمة ${parsedAmount} ${currency}`,
          userId: profile?.uid,
          userName: profile?.name,
          createdAt: serverTimestamp()
        });

        if (senderName.trim()) {
          employeeDebtGuardService.settleCustomerDebtsByPayment({
            customerName: senderName,
            paidAmount: parsedAmount,
            receivedByUsername: profile?.username || profile?.uid || 'cashier',
            receivedByName: profile?.fullName || profile?.name || 'مستلم الصندوق',
            receivedByRole: profile?.role || 'cashier',
            receiptVoucherId: `VOUCH-${Date.now().toString().slice(-5)}`
          });
        }

        onSuccess(`✓ تم توليد وترحيل سند القبض المباشر بقيمة ${parsedAmount} ${currency} إلى ${selectedBoxName} بنجاح.`);
      }

      onClose();
    } catch (err: any) {
      console.error('Error committing quick financial modal transaction:', err);
      alert('حدث خطأ في معالجة القيد السريع: ' + (err.message || 'مشكلة في الاتصال بالشبكة'));
    } finally {
      setLoading(false);
    }
  };

  // Listen to global handleKeyDown inside each form if active
  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Prevents submitting if typing inside long notes/description textarea
      if ((e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  if (!isOpen || !type) return null;

  const labels = {
    receive: {
      title: 'استلام وتوجيه حوالة ماليّة حية',
      desc: 'قيد سريع لإضافة حوالة مستلمة من صراف خارجي أو عميل وتوجيهها للصندوق المالي المعتمد.',
      icon: ArrowDownLeft,
      btnColor: 'bg-emerald-600 hover:bg-emerald-500',
      badge: 'Alt + R'
    },
    send: {
      title: 'إرسال وتوريد حوالة وصرفها',
      desc: 'قيد مالي فوري للخصم من المحل وصرف حوالة صادرة للشركات أو المغتربين.',
      icon: ArrowUpRight,
      btnColor: 'bg-red-600 hover:bg-red-500',
      badge: 'Alt + S'
    },
    custody: {
      title: 'صرف وتسليم عهدة للموظف / السائق',
      desc: 'صرف فوري وإضافة رصيد عهدة لمهندس صيانة أو سائق طلبات لضبط المديونية.',
      icon: UserCheck,
      btnColor: 'bg-amber-600 hover:bg-amber-500',
      badge: 'Alt + H'
    },
    voucher: {
      title: 'تحرير سند قبض نقدي فوري',
      desc: 'إنشاء سند قبض نقدي مباشر وإيداعه فوراً في الصناديق كعملية دخل مستقلة.',
      icon: Receipt,
      btnColor: 'bg-indigo-600 hover:bg-indigo-500',
      badge: 'Alt + V'
    }
  }[type];

  const CurrentIcon = labels.icon;

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" dir="rtl" onKeyDown={handleFormKeyDown}>
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg overflow-hidden border-2 border-[#cf8a3c] rounded-[2rem] shadow-2xl relative text-right"
        style={{
          background: 'linear-gradient(135deg, #0b1126, #020617)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
        }}
      >
        {/* Header decoration */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#cf8a3c]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#cf8a3c]/15 text-[#cf8a3c] flex items-center justify-center border border-[#cf8a3c]/30">
              <CurrentIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-[#cf8a3c]/20 text-[#f5d061] text-[9px] font-black rounded-md border border-[#cf8a3c]/30">مستند مالي سريع</span>
                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-mono rounded border border-white/5">{labels.badge}</span>
              </div>
              <h3 className="text-sm font-black text-white mt-1">{labels.title}</h3>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <div className="px-6 py-3 bg-slate-950/40 text-[11px] text-slate-400 font-medium leading-relaxed border-b border-white/5">
          {labels.desc}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 relative z-10 text-xs">
          
          {/* 1. Name Input depending on type */}
          {type === 'receive' && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">اسم المرسل (الشخص أو شبكة الصرافة):</label>
              <input 
                type="text"
                required
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="أدخل هنا اسم مرسل الحوالة..."
                className="w-full p-3 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-xl outline-none text-white placeholder-slate-600 font-bold"
                autoFocus
              />
            </div>
          )}

          {type === 'send' && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">اسم المستلم أو الشركة المستفيدة:</label>
              <input 
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="أدخل اسم الشخص أو الشركة..."
                className="w-full p-3 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-xl outline-none text-white placeholder-slate-600 font-bold"
                autoFocus
              />
            </div>
          )}

          {type === 'custody' && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">اختر الموظف / السائق المستهدف بالعهدة:</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-xl outline-none text-white font-bold"
              >
                {employees.map(emp => (
                  <option key={emp.uid} value={emp.uid}>
                    {emp.name} ({emp.role === 'manager' ? 'مدير' : emp.role === 'engineer' ? 'مهندس صيانة' : 'موظف'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === 'voucher' && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">اسم العميل / المقبوض منه النقدية:</label>
              <input 
                type="text"
                required
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="مثال: صالح محمد اليافعي..."
                className="w-full p-3 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-xl outline-none text-white placeholder-slate-600 font-bold"
                autoFocus
              />
            </div>
          )}

          {/* 2. Amount and Currency row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="font-bold text-slate-300 block">مبلغ الحركة الماليّة:</label>
              <input 
                type="number"
                required
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="أدخل القيمة العددية..."
                className="w-full p-3 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-xl outline-none text-white text-base font-black text-center text-[#f5d061]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">العملة المطبقة:</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-xl outline-none text-white text-center font-black"
              >
                <option value="YER">YER (ريال يمني)</option>
                <option value="SAR">SAR (ريال سعودي)</option>
                <option value="USD">USD (دولار أمريكي)</option>
              </select>
            </div>
          </div>

          {/* 3. Safe/Box Destination selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">
              {type === 'receive' || type === 'voucher' ? 'الصندوق أو الحساب وجهة التوجيه بالقبض:' : 'خصم المبلغ من الحساب / الصندوق المالي:'}
            </label>
            <select
              value={selectedBox}
              onChange={(e) => setSelectedBox(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-xl outline-none text-white font-bold"
            >
              {boxes.map(bx => (
                <option key={bx.id} value={bx.id}>
                  {bx.name} {bx.id === 'CASH_BOX' ? '⭐' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Remittance Number field (Only for remittance modes) */}
          {(type === 'receive' || type === 'send') && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">رقم الحوالة المستندى (تتبع):</label>
              <input 
                type="text"
                value={remittanceNumber}
                onChange={(e) => setRemittanceNumber(e.target.value)}
                placeholder="أدخل رقم الحوالة للتضمين ببيان كشف الحساب..."
                className="w-full p-3 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-xl outline-none text-white font-mono placeholder-slate-600"
              />
            </div>
          )}

          {/* 5. description/reason */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">ملاحظات توضيحية إضافية (أو بيان المعاملة للدفتر اليومي):</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب هنا أي تفاصيل تود إدراجها بالتقرير..."
              rows={2}
              className="w-full p-3 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-xl outline-none text-white resize-none"
            />
          </div>

          {/* 6. Form control Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-center cursor-pointer transition-all"
            >
              إلغاء المعاملة (Esc)
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-[1.5] py-3 ${labels.btnColor} text-slate-950 font-black rounded-xl text-center flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50`}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>جاري توريد القيد...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>تثبيت المعاملة المالية فوري (Enter)</span>
                </>
              )}
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
};
