import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  X, 
  Trash2, 
  Clock, 
  ArrowRightLeft, 
  CheckCircle2,
  PlusSquare,
  CreditCard,
  DollarSign,
  Briefcase,
  Loader2
} from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, where, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { logActivity } from '../services/activityLogService';
import { UserProfile, MoneyTransfer } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { EnforcedReceiptModal } from './EnforcedReceiptModal';

interface BankTransferManagerProps {
  profile: UserProfile | null;
}

export default function BankTransferManager({ profile }: BankTransferManagerProps) {
  const [transfers, setTransfers] = useState<MoneyTransfer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedTransferForReceipt, setSelectedTransferForReceipt] = useState<MoneyTransfer | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFormData, setTransferFormData] = useState({
    senderName: '',
    amount: '',
    currency: 'YER',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>(null);

  useEffect(() => {
    if (!profile?.ownerId) return;

    const unsubTransfers = onSnapshot(
      query(collection(db, 'moneyTransfers'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setTransfers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MoneyTransfer)));
      },
      (error) => {
        console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubTransfers in BankTransferManager):", error.message);
        setTransfers([]);
      }
    );

    const unsubBanks = onSnapshot(
      query(collection(db, 'bank_accounts'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubBanks in BankTransferManager):", error.message);
        setBankAccounts([]);
      }
    );

    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'settings', profile.ownerId));
      if (docSnap.exists()) setShopSettings(docSnap.data());
    };
    fetchSettings();

    return () => {
      unsubTransfers();
      unsubBanks();
    };
  }, [profile]);

  const handleAddTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || !transferFormData.amount || isProcessing) return;

    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'moneyTransfers'), {
        ownerId: profile.ownerId,
        senderName: transferFormData.senderName,
        amount: Number(transferFormData.amount),
        currency: transferFormData.currency,
        status: 'pending',
        addedBy: profile.uid,
        addedByName: profile.name,
        notes: transferFormData.notes,
        createdAt: serverTimestamp()
      });
      setIsTransferModalOpen(false);
      setTransferFormData({ senderName: '', amount: '', currency: 'YER', notes: '' });
      await logActivity(profile, 'إضافة إيداع', `تم تسجيل إيداع من ${transferFormData.senderName} بمبلغ ${transferFormData.amount}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReceipt = async (destType: string, selectedBoxId: string, details: string) => {
    if (!selectedTransferForReceipt || !profile?.ownerId || isProcessing) return;

    setIsProcessing(true);
    try {
      const transfer = selectedTransferForReceipt;
      const rateObj = shopSettings?.currencyRates?.[transfer.currency];
      const rate = transfer.currency === 'YER' ? 1 : (rateObj?.buy || 1);
      const amountInYMN = transfer.amount * rate;

      // 1. Create actual income transaction first so we can save its ID
      const transRef = await addDoc(collection(db, 'transactions'), {
        ownerId: profile.ownerId,
        type: 'income',
        amount: amountInYMN,
        originalAmount: transfer.amount,
        currency: transfer.currency,
        exchangeRate: rate,
        category: 'إيداع مستلم',
        description: `استلام إيداع رقم (${transfer.id.slice(-4)}) من ${transfer.senderName} [المسار: ${destType}]`,
        userId: profile.uid,
        userName: profile.name,
        createdAt: serverTimestamp()
      });

      // 2. Mark transfer as received + save audit tracking info
      await updateDoc(doc(db, 'moneyTransfers', transfer.id), {
        status: 'received',
        receivedBy: profile.uid,
        receivedByName: profile.name,
        receivedAt: serverTimestamp(),
        destinationType: destType,
        destinationBoxId: selectedBoxId || destType,
        recipientDetails: details,
        transactionId: transRef.id
      });

      // 3. Increase Bank Account / Safe Balance if selected Box exists
      if (destType === 'BANK_ACCOUNT' && selectedBoxId) {
        const boxRef = doc(db, 'bank_accounts', selectedBoxId);
        const boxSnap = await getDoc(boxRef);
        if (boxSnap.exists()) {
          const currentBal = Number(boxSnap.data().balance || 0);
          await updateDoc(boxRef, {
            balance: currentBal + transfer.amount
          });
        }
      }

      // 4. Immutably log to auditLogs
      await addDoc(collection(db, 'auditLogs'), {
        userId: profile.uid,
        userName: profile.name,
        action: 'RECEIVE_REMITTANCE',
        amount: transfer.amount,
        targetAccount: selectedBoxId || destType,
        details: details,
        ownerId: profile.ownerId,
        timestamp: serverTimestamp()
      });

      await logActivity(profile, 'استلام إيداع', `تم استلام إيداع ${transfer.senderName} وإضافته للصندوق [رقابة: ${destType}]`);
      setSelectedTransferForReceipt(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelReceipt = async (transfer: MoneyTransfer) => {
    if (!profile?.ownerId || isProcessing) return;
    if (!window.confirm('هل أنت متأكد من إلغاء استلام هذا الإيداع وإعادته للحالة المعلقة؟ سيتم خصم المبلغ من الصندوق وحذف القيد المالي.')) return;

    setIsProcessing(true);
    try {
      // 1. Reverse balance increase
      if (transfer.destinationType === 'BANK_ACCOUNT' && transfer.destinationBoxId) {
        const boxRef = doc(db, 'bank_accounts', transfer.destinationBoxId);
        const boxSnap = await getDoc(boxRef);
        if (boxSnap.exists()) {
          const currentBal = Number(boxSnap.data().balance || 0);
          await updateDoc(boxRef, {
            balance: Math.max(0, currentBal - transfer.amount)
          });
        }
      }

      // 2. Delete transaction log
      const { getDocs } = await import('firebase/firestore');
      if (transfer.transactionId) {
        await deleteDoc(doc(db, 'transactions', transfer.transactionId));
      } else {
        // Fallback Search
        const qT = query(
          collection(db, 'transactions'),
          where('ownerId', '==', profile.ownerId),
          where('category', '==', 'إيداع مستلم')
        );
        const qSnap = await getDocs(qT);
        const shortId = transfer.id.slice(-4);
        for (const d of qSnap.docs) {
          const desc = d.data().description || '';
          if (desc.includes(shortId)) {
            await deleteDoc(d.ref);
          }
        }
      }

      // 3. Mark transfer as pending
      await updateDoc(doc(db, 'moneyTransfers', transfer.id), {
        status: 'pending',
        receivedBy: null,
        receivedByName: null,
        receivedAt: null,
        destinationType: null,
        destinationBoxId: null,
        recipientDetails: null,
        transactionId: null
      });

      // 4. Log to auditLogs
      await addDoc(collection(db, 'auditLogs'), {
        userId: profile.uid,
        userName: profile.name,
        action: 'CANCEL_REMITTANCE_RECEIPT',
        amount: transfer.amount,
        targetAccount: transfer.destinationBoxId || transfer.destinationType || 'N/A',
        details: `إلغاء استلام الإيداع رقم (${transfer.id.slice(-4)}) وإعادته للمعلقة`,
        ownerId: profile.ownerId,
        timestamp: serverTimestamp()
      });

      await logActivity(profile, 'إلغاء استلام إيداع', `تم إلغاء استلام إيداع ${transfer.senderName} وإعادته للمعلقة`);
      alert('✓ تم إلغاء استلام الإيداع وإعادته للحالة المعلقة بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('فشل في إلغاء استلام الإيداع: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTransfer = async (transfer: MoneyTransfer) => {
    if (!profile?.ownerId || isProcessing) return;
    if (!window.confirm('هل أنت متأكد من حذف هذا الإيداع نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.')) return;

    setIsProcessing(true);
    try {
      // If it was already received, reverse the cash box and transactions first
      if (transfer.status === 'received') {
        if (transfer.destinationType === 'BANK_ACCOUNT' && transfer.destinationBoxId) {
          const boxRef = doc(db, 'bank_accounts', transfer.destinationBoxId);
          const boxSnap = await getDoc(boxRef);
          if (boxSnap.exists()) {
            const currentBal = Number(boxSnap.data().balance || 0);
            await updateDoc(boxRef, {
              balance: Math.max(0, currentBal - transfer.amount)
            });
          }
        }

        const { getDocs } = await import('firebase/firestore');
        if (transfer.transactionId) {
          await deleteDoc(doc(db, 'transactions', transfer.transactionId));
        } else {
          // Fallback Search
          const qT = query(
            collection(db, 'transactions'),
            where('ownerId', '==', profile.ownerId),
            where('category', '==', 'إيداع مستلم')
          );
          const qSnap = await getDocs(qT);
          const shortId = transfer.id.slice(-4);
          for (const d of qSnap.docs) {
            const desc = d.data().description || '';
            if (desc.includes(shortId)) {
              await deleteDoc(d.ref);
            }
          }
        }
      }

      await deleteDoc(doc(db, 'moneyTransfers', transfer.id));
      await logActivity(profile, 'حذف إيداع', `تم حذف الإيداع الخاص بـ ${transfer.senderName} بقيمة ${transfer.amount}`);
      alert('✓ تم حذف الإيداع بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('فشل في حذف الإيداع: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredTransfers = transfers.filter(tr => 
    tr.senderName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tr.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-navy-800 p-8 rounded-[3rem] shadow-xl border border-gray-100 dark:border-navy-700">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-[1.5rem] flex items-center justify-center">
            <CreditCard size={32} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-navy-900 dark:text-white">إدارة الإيداعات البنكية المباشرة</h3>
            <p className="text-sm text-gray-500 font-bold">تتبع الإيداعات البنكية المباشرة من العملاء والموردين بشكل مستقل</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث في الإيداعات..." 
              className="pr-12 pl-4 py-3 bg-gray-50 dark:bg-navy-900 border-none rounded-2xl font-bold w-64 outline-none focus:ring-2 ring-brand-primary/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsTransferModalOpen(true)}
            className="px-8 py-3 bg-brand-primary text-white rounded-2xl font-black shadow-lg shadow-brand-primary/20 hover:scale-105 transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            إضافة إيداع / تحويل
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTransfers.map((tr) => (
          <motion.div 
            key={tr.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`card-glass p-8 border-r-8 ${tr.status === 'received' ? 'border-r-success' : 'border-r-warning'}`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tr.status === 'received' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                   <ArrowRightLeft size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">TRX #{tr.id.slice(-6).toUpperCase()}</p>
                    <button
                      onClick={() => handleDeleteTransfer(tr)}
                      title="حذف الإيداع نهائياً"
                      className="text-gray-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <h4 className="text-xl font-black text-navy-900 dark:text-white leading-none">{tr.senderName}</h4>
                </div>
              </div>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${tr.status === 'received' ? 'bg-success text-white' : 'bg-warning text-navy-900'}`}>
                {tr.status === 'received' ? 'Completed' : 'Pending'}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-navy-900/50 p-6 rounded-[2rem] mb-6 space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-gray-400 uppercase">Amount</span>
                <div className="text-right">
                  <span className="text-3xl font-black text-navy-900 dark:text-white tabular-nums">{tr.amount.toLocaleString()}</span>
                  <span className="text-xs font-bold text-gray-400 ms-2">{tr.currency}</span>
                </div>
              </div>
              <div className="h-px bg-gray-200 dark:bg-navy-700/50" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-navy-100 dark:bg-navy-800 rounded-full flex items-center justify-center text-navy-500">
                  <Briefcase size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Added By</p>
                  <p className="text-xs font-black text-navy-900 dark:text-white">{tr.addedByName}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {tr.notes && (
                <div className="p-4 bg-brand-primary/5 border border-brand-primary/10 rounded-2xl">
                   <p className="text-xs text-brand-primary font-bold italic leading-relaxed">"{tr.notes}"</p>
                </div>
              )}
              
              {tr.status === 'pending' ? (
                <button 
                  onClick={() => setSelectedTransferForReceipt(tr)}
                  disabled={isProcessing}
                  className="w-full py-4 bg-success text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-success/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                >
                  {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                  تأكيد استلام المبلغ
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-2 text-right" dir="rtl">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-[10px] text-gray-400 font-bold">
                        {tr.receivedAt ? (tr.receivedAt as Timestamp).toDate().toLocaleString('ar-EG') : ''}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-success">BY: {tr.receivedByName}</span>
                  </div>
                  <button
                    onClick={() => handleCancelReceipt(tr)}
                    disabled={isProcessing}
                    className="w-full mt-2 py-2.5 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-rose-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <X size={12} />
                    إلغاء الاستلام (تراجع)
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {filteredTransfers.length === 0 && (
          <div className="col-span-full py-20 text-center card-glass">
            <CreditCard size={64} className="mx-auto text-gray-200 mb-6 opacity-20" />
            <p className="text-gray-400 font-black text-xl">لا توجد إيداعات مطابقة للبحث</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isTransferModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTransferModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-navy-800 rounded-[3rem] shadow-2xl overflow-hidden border border-white/20">
              <div className="p-8 bg-navy-950 text-white flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-primary text-navy-950 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                    <PlusSquare size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">تسجيل إيداع / تحويل وارد لحساب المحل</h3>
                    <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest">Register Direct Account Deposit</p>
                  </div>
                </div>
                <button onClick={() => setIsTransferModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
              </div>

              <form onSubmit={handleAddTransfer} className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">اسم المرسل الكامل</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-lg focus:ring-4 ring-brand-primary/20 transition-all"
                    value={transferFormData.senderName} 
                    onChange={(e) => setTransferFormData({...transferFormData, senderName: e.target.value})} 
                    placeholder="مثلاً: محمد علي الأحمد"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">مبلغ الإيداع</label>
                    <input 
                      required 
                      type="number" 
                      className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-lg focus:ring-4 ring-brand-primary/20 transition-all tabular-nums"
                      value={transferFormData.amount} 
                      onChange={(e) => setTransferFormData({...transferFormData, amount: e.target.value})} 
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">العملة</label>
                    <select 
                      className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-lg focus:ring-4 ring-brand-primary/20 transition-all appearance-none"
                      value={transferFormData.currency} 
                      onChange={(e) => setTransferFormData({...transferFormData, currency: e.target.value})}
                    >
                      <option value="YER">ريال يمني (YER)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">ملاحظات إضافية</label>
                  <textarea 
                    className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-bold focus:ring-4 ring-brand-primary/20 transition-all"
                    rows={3}
                    value={transferFormData.notes} 
                    onChange={(e) => setTransferFormData({...transferFormData, notes: e.target.value})} 
                    placeholder="رقم المرجع، اسم البنك، الخ..."
                  />
                </div>

                <div className="flex gap-4 pt-4">
                   <button 
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="flex-1 py-5 bg-gray-100 dark:bg-navy-900 text-gray-500 rounded-2xl font-black hover:bg-gray-200 transition-all"
                  >
                    إلغاء الأمر
                  </button>
                  <button 
                    disabled={isProcessing}
                    type="submit" 
                    className="flex-[2] py-5 bg-navy-950 text-brand-primary border-2 border-brand-primary rounded-2xl font-black text-xl shadow-2xl shadow-brand-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <PlusSquare size={24} />}
                    حفظ وتسجيل الإيداع
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <EnforcedReceiptModal 
        isOpen={!!selectedTransferForReceipt}
        amount={selectedTransferForReceipt?.amount || 0}
        currency={selectedTransferForReceipt?.currency || 'YER'}
        remittanceNumber={selectedTransferForReceipt?.id || ''}
        availableBoxes={bankAccounts}
        onConfirm={handleConfirmReceipt}
        onClose={() => setSelectedTransferForReceipt(null)}
      />
    </div>
  );
}

function Loader2({ size, className }: { size: number, className?: string }) {
  return <Clock size={size} className={`animate-spin ${className}`} />;
}
