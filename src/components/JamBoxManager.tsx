import React, { useState, useEffect } from 'react';
import { 
  collection, 
  setDoc, 
  getDocs, 
  doc, 
  onSnapshot, 
  deleteDoc, 
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { CustomFinancialBox, BankAccount } from '../types';
import { 
  Plus, 
  Trash2, 
  Link, 
  Link2, 
  Wallet, 
  Coins, 
  AlertCircle 
} from 'lucide-react';

interface JamBoxManagerProps {
  storeCode: string;
  onSyncBoxes?: () => void;
  profile?: any;
}

export const JamBoxManager: React.FC<JamBoxManagerProps> = ({ storeCode, onSyncBoxes, profile }) => {
  const [newBoxName, setNewBoxName] = useState('');
  const [isBank, setIsBank] = useState(false);
  const [accNum, setAccNum] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [currency, setCurrency] = useState<'YER' | 'SAR' | 'USD'>('YER');
  const [initialBalance, setInitialBalance] = useState('');

  const [customBoxes, setCustomBoxes] = useState<CustomFinancialBox[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const isAuthorized = profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'superadmin' || profile?.role === 'master_wholesale';

  // Subscribe to bank accounts
  useEffect(() => {
    if (!storeCode) return;
    const q = query(collection(db, 'bank_accounts'), where('ownerId', '==', storeCode));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount)));
    }, (error) => {
      console.warn("JAM SYSTEM PRO - Locked Error Safely (JamBoxManager bank_accounts):", error.message);
      setBankAccounts([]);
    });
    return () => unsubscribe();
  }, [storeCode]);

  // Subscribe to custom boxes inside stores/{storeCode}/customBoxes
  useEffect(() => {
    if (!storeCode) return;
    const q = collection(db, 'stores', storeCode, 'customBoxes');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomBoxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomFinancialBox)));
    }, (error) => {
      console.warn("JAM SYSTEM PRO - Locked Error Safely (JamBoxManager customBoxes):", error.message);
      setCustomBoxes([]);
    });
    return () => unsubscribe();
  }, [storeCode]);

  const handleAddNewCustomBox = async () => {
    if (!newBoxName.trim()) {
      alert('يرجى كتابة اسم الصندوق المالي أولاً!');
      return;
    }

    // 1. Check roles: Only owner or manager can create/modify boxes
    if (!isAuthorized) {
      alert('عذراً، صلاحية إنشاء صندوق مالي مخصص مقتصرة على المالك أو المدير فقط! ❌');
      return;
    }

    // 2. Prompt for Security Code: activate Sensitive Security Code protection
    const correctCode = profile?.securityCode || '1234';
    const isOwner = profile?.email?.toLowerCase() === 'a777503191@gmail.com';
    const enteredCode = window.prompt('🔒 لتأكيد عملية إضافة صندوق مالي جديد، يرجى إدخال رمز الأمان (Security Code):');
    if (enteredCode === null) return;

    const isOwnerBypass = isOwner && (enteredCode === '77270997' || enteredCode === '7727' || enteredCode === '1234');
    if (enteredCode !== correctCode && !isOwnerBypass) {
      alert('الرمز الأمني المدخل غير صحيح! تم إلغاء الإجراء. ❌');
      return;
    }

    setLoading(true);
    try {
      const boxId = `BOX_${Date.now()}`;
      const bal = Number(initialBalance) || 0;

      // Find selected bank details if any
      const linkedBankObj = bankAccounts.find(b => b.id === selectedBankId);

      const newBoxPayload: CustomFinancialBox = {
        id: boxId,
        boxName: newBoxName,
        balance: bal,
        isLinkedToBank: isBank,
        bankAccountNumber: isBank ? (linkedBankObj?.accountNumber || accNum) : undefined,
        bankAccountId: isBank ? selectedBankId : undefined,
        currency: currency,
        createdAt: new Date().toISOString()
      };

      console.log(`🏗️ حقن صندوق مالي مخصص جديد لـ ${storeCode}:`, newBoxPayload);
      
      // Save custom box under stores/{storeCode}/customBoxes
      await setDoc(doc(db, 'stores', storeCode, 'customBoxes', boxId), newBoxPayload);

      // Also support linking bank accounts balance or syncing
      if (isBank && selectedBankId) {
        // If linked to bank, update the bank account or copy its balance
        const bankRef = doc(db, 'bank_accounts', selectedBankId);
        // Optionally update the bank if balance was specified or leave bank balance
        if (bal > 0) {
          await updateDoc(bankRef, { balance: bal });
        }
      }

      if (onSyncBoxes) {
        onSyncBoxes();
      }
      
      // Reset form
      setNewBoxName('');
      setAccNum('');
      setSelectedBankId('');
      setInitialBalance('');
      setIsBank(false);
      alert('✓ تم اعتماد وحقن الصندوق المالي في متجرك بنجاح!');
    } catch (err: any) {
      console.error('Error saving custom box:', err);
      alert(`فشل الحفظ: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBox = async (boxId: string) => {
    // 1. Check roles: Only owner or manager can delete custom boxes
    if (!isAuthorized) {
      alert('عذراً، صلاحية حذف صندوق مالي مقتصرة على المالك أو المدير فقط! ❌');
      return;
    }

    if (!window.confirm('🚨 هل أنت متأكد من حذف هذا الصندوق المالي؟ وسيتم فك أي ارتباط بنكي له.')) return;

    // 2. Prompt for Security Code: activate Sensitive Security Code protection
    const correctCode = profile?.securityCode || '1234';
    const isOwner = profile?.email?.toLowerCase() === 'a777503191@gmail.com';
    const enteredCode = window.prompt('🔒 لتأكيد عملية حذف الصندوق المالي، يرجى إدخال رمز الأمان (Security Code):');
    if (enteredCode === null) return;

    const isOwnerBypass = isOwner && (enteredCode === '77270997' || enteredCode === '7727' || enteredCode === '1234');
    if (enteredCode !== correctCode && !isOwnerBypass) {
      alert('الرمز الأمني المدخل غير صحيح! تم إلغاء الإجراء. ❌');
      return;
    }

    try {
      await deleteDoc(doc(db, 'stores', storeCode, 'customBoxes', boxId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-gradient-to-r from-slate-900 to-navy-950 p-6 rounded-[2rem] border border-slate-800 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
            مصفوفة الصناديق التفاعلية
          </span>
          <h4 className="text-lg font-black text-amber-500 flex items-center gap-2">
            <Coins size={22} />
            🛠️ مهايئ الصناديق والتربيطات البنكية التلقائية
          </h4>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            قم بصناعة مصفوفة لا نهائية من الصناديق المالية وتسميتها بما يوافق طبيعة مبيعاتك وحوالاتك (كاش، شبكة، ذكي، الكريمي، النجم...) مع إمكانية الربط الأوتوماتيكي بأي حساب بنكي مضاف.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 translate-y-1/3 translate-x-1/4 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form component */}
        <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-navy-700/60 shadow-md space-y-4">
          <h5 className="text-xs font-black text-navy-950 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-navy-700 pb-3">
            <Plus size={16} className="text-amber-500" />
            إنشاء صندوق مالي مخصص ومربوط
          </h5>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 block px-1">اسم الصندوق المالي الجديد</label>
              <input 
                type="text" 
                placeholder="مثلاً: صندوق مبيعات الكاشير، كاش النجم للتحويلات" 
                value={newBoxName} 
                onChange={(e) => setNewBoxName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 text-xs text-navy-900 dark:text-white font-bold rounded-xl border border-gray-100 dark:border-navy-800 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 block px-1">الرصيد الافتتاحي (ر.ي)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={initialBalance} 
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 text-xs text-navy-900 dark:text-white font-black rounded-xl border border-gray-100 dark:border-navy-800 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 block px-1">عملة الصندوق الأساسية</label>
                <select 
                  value={currency} 
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full bg-gray-50 dark:bg-navy-900/50 p-3.5 text-xs text-navy-900 dark:text-white font-bold rounded-xl border border-gray-100 dark:border-navy-800 outline-none cursor-pointer"
                >
                  <option value="YER">ريال يمني YER</option>
                  <option value="SAR">ريال سعودي SAR</option>
                  <option value="USD">دولار أمريكي USD</option>
                </select>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-navy-900/40 p-4 rounded-xl border border-gray-100 dark:border-navy-800/80 space-y-3">
              <label className="text-xs text-navy-950 dark:text-white flex items-center gap-2 cursor-pointer font-bold">
                <input 
                  type="checkbox" 
                  checked={isBank} 
                  onChange={(e) => setIsBank(e.target.checked)}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-500 w-4 h-4" 
                />
                ربط هذا الصندوق بحساب بنكي / صرافة مضاف للنشاط
              </label>

              {isBank && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold block">اختر الحساب البنكي العام للارتباط</label>
                    <select 
                      value={selectedBankId} 
                      onChange={(e) => {
                        setSelectedBankId(e.target.value);
                        const bObj = bankAccounts.find(bk => bk.id === e.target.value);
                        if (bObj) {
                          setAccNum(bObj.accountNumber || '');
                        }
                      }}
                      className="w-full bg-white dark:bg-navy-800 p-3 text-xs text-navy-950 dark:text-white font-bold rounded-xl border border-gray-200 dark:border-navy-700 outline-none cursor-pointer"
                    >
                      <option value="">-- اضغط للاختيار والربط بالفولدر --</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} ({b.accountNumber}) - رصيد: {b.balance.toLocaleString()} {b.currency}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold block">رقم الحساب اليدوي (أو المخصص)</label>
                    <input 
                      type="text" 
                      placeholder="رقم الحساب أو رقم المحفظة الافتراضية" 
                      value={accNum} 
                      onChange={(e) => setAccNum(e.target.value)}
                      className="w-full bg-white dark:bg-navy-800 p-3 text-xs text-navy-950 dark:text-white font-bold rounded-xl border border-gray-200 dark:border-navy-700 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <button 
              type="button"
              disabled={loading}
              onClick={handleAddNewCustomBox}
              className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl transition-all shadow-md hover:scale-[1.01] flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              اعتماد وترحيل الصندوق المالي المخصص
            </button>
          </div>
        </div>

        {/* Custom financial boxes listing and bank accounts mapping view */}
        <div className="bg-white dark:bg-navy-800 p-6 rounded-[2rem] border border-gray-100 dark:border-navy-700/60 shadow-md space-y-4">
          <h5 className="text-xs font-black text-navy-950 dark:text-white border-b border-gray-100 dark:border-navy-700 pb-3 flex justify-between items-center">
            <span>الصناديق المالية النشطة للمتجر ({customBoxes.length})</span>
            <span className="text-[9px] text-gray-400 font-bold">بث تزامني للتثبيت</span>
          </h5>

          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {customBoxes.map((box) => {
              const matchedBank = bankAccounts.find(b => b.id === box.bankAccountId);

              return (
                <div key={box.id} className="p-4 bg-gray-50 dark:bg-navy-900/40 rounded-2xl border border-gray-100 dark:border-navy-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${box.isLinkedToBank ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                      <Wallet size={18} />
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-navy-950 dark:text-white">{box.boxName}</p>
                      {box.isLinkedToBank ? (
                        <p className="text-[9px] text-blue-500 font-bold flex items-center gap-1 mt-0.5">
                          <Link2 size={10} />
                          مربوط بـ: {matchedBank?.bankName || 'حساب بنكي'} ({box.bankAccountNumber || matchedBank?.accountNumber})
                        </p>
                      ) : (
                        <p className="text-[9px] text-gray-400 font-bold mt-0.5">صندوق كاش محلي منفصل</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-sans">
                    <div className="text-left">
                      <p className="text-xs font-black text-navy-950 dark:text-white">
                        {box.balance.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">{box.currency || 'YER'}</p>
                    </div>

                    <button 
                      type="button"
                      onClick={() => handleDeleteBox(box.id)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/10 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {customBoxes.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-xs font-bold leading-relaxed space-y-2">
                <AlertCircle size={28} className="mx-auto text-gray-300" />
                <p>لا يوجد صناديق مخصصة إضافية مضافة بعد.</p>
                <p className="text-[10px] text-gray-400">جميع مبيعات ومتحصلات النشاط الحالي ستورّد تلقائياً للخزائن الافتراضية.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
