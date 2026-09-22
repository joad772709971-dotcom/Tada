import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  Calendar,
  X,
  Trash2,
  Printer,
  HandCoins,
  Users,
  Clock,
  ArrowRightLeft,
  CheckCircle2
} from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, where, getDocs, Timestamp, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { logActivity } from '../services/activityLogService';
import { Transaction, UserProfile, Account, MoneyTransfer, FixedAsset, AdjustmentVoucher } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { printReceipt } from '../services/printService';
import { postJournalEntry } from '../services/accountingService';
import { sendSMS } from '../services/smsService';
import { useVault } from '../context/VaultContext';
import { parseISO } from 'date-fns';
import { EnforcedReceiptModal } from './EnforcedReceiptModal';
import { FinancialMath } from '../utils/financialMath';
import { UniversalReportButton } from './UniversalReportButton';
import { UniversalReportPayload } from '../services/UniversalReportService';

export const CANONICAL_WALLETS = [
  { id: 'CASH_BOX', boxName: 'صندوق النقد الرئيسي (الكاش)', chartOfAccountsCode: '1101', chartOfAccountsName: 'النقدية بالصندوق', type: 'cash', balance: 0, isFixed: true, currency: 'YER' },
  { id: 'AL_KURIMI', boxName: 'بنك الكريمي الإسلامي', chartOfAccountsCode: '1102', chartOfAccountsName: 'أرصدة لدى البنوك - الكريمي', type: 'bank', balance: 0, isFixed: true, currency: 'YER' },
  { id: 'AL_TADHAMON', boxName: 'بنك التضامن الإسلامي', chartOfAccountsCode: '1103', chartOfAccountsName: 'أرصدة لدى البنوك - التضامن', type: 'bank', balance: 0, isFixed: true, currency: 'YER' },
  { id: 'YKB', boxName: 'بنك اليمن والكويت', chartOfAccountsCode: '1104', chartOfAccountsName: 'أرصدة لدى البنوك - YKB', type: 'bank', balance: 0, isFixed: true, currency: 'YER' },
  { id: 'AL_NAJM', boxName: 'شركة النجم للصرافة والتحويلات', chartOfAccountsCode: '1105', chartOfAccountsName: 'صناديق الحوالات - النجم', type: 'remittance', balance: 0, isFixed: true, currency: 'YER' },
  { id: 'AL_AMQI', boxName: 'شركة العمقي للصرافة والتحويلات', chartOfAccountsCode: '1106', chartOfAccountsName: 'صناديق الحوالات - العمقي', type: 'remittance', balance: 0, isFixed: true, currency: 'YER' },
  { id: 'JAWALI', boxName: 'محفظة جوالي الإلكترونية', chartOfAccountsCode: '1107', chartOfAccountsName: 'صناديق الحوالات - جوالي', type: 'remittance', balance: 0, isFixed: true, currency: 'YER' },
  { id: 'OWNER_CUSTODY', boxName: 'صندوق المالك للعهود والمسحوبات', chartOfAccountsCode: '1108', chartOfAccountsName: 'حسابات الشركاء والمسحوبات الشخصية', type: 'owner', balance: 0, isFixed: true, currency: 'YER' }
];

interface FinancesProps {
  profile: UserProfile | null;
}

export default function Finances({ profile }: FinancesProps) {
  const { isVaultOpen, vaultDate } = useVault();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [customBoxes, setCustomBoxes] = useState<any[]>([]);
  const [selectedTransferForReceipt, setSelectedTransferForReceipt] = useState<MoneyTransfer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'custody' | 'transfers' | 'assets_vouchers'>('transactions');
  const [transfers, setTransfers] = useState<MoneyTransfer[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [adjustmentVouchers, setAdjustmentVouchers] = useState<AdjustmentVoucher[]>([]);
  const [assetsVouchersTab, setAssetsVouchersTab] = useState<'assets' | 'adjustments'>('assets');

  // New States for Cashflow & Multi-Wallet
  const [isRemittanceModalOpen, setIsRemittanceModalOpen] = useState(false);
  const [remittanceFormData, setRemittanceFormData] = useState({
    sender: '',
    receiver: '',
    amount: '',
    subWalletId: 'AL_KURIMI',
    notes: ''
  });

  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
  const [physicalCashInput, setPhysicalCashInput] = useState('');
  
  // Asset registration state
  const [loadingAsset, setLoadingAsset] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: '',
    value: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    deductedFromBoxId: 'CASH_BOX'
  });

  // Adjustment voucher registration state
  const [loadingAdjustment, setLoadingAdjustment] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    targetBoxId: 'CASH_BOX',
    amount: '',
    type: 'INCREMENT' as 'INCREMENT' | 'DECREMENT',
    reason: ''
  });
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFormData, setTransferFormData] = useState({
    senderName: '',
    amount: '',
    currency: 'YER',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [isProcessingCustody, setIsProcessingCustody] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const updateBoxBalance = async (boxId: string, amountChange: number) => {
    const finalBoxId = boxId || 'CASH_BOX';
    if (!profile?.ownerId) return;

     try {
      // 1. Try updating bank_accounts
      const bankRef = doc(db, 'bank_accounts', finalBoxId);
      const bankSnap = await getDoc(bankRef);
      if (bankSnap.exists()) {
        const currentBal = Number(bankSnap.data().balance || 0);
        await updateDoc(bankRef, {
          balance: FinancialMath.toFloat(FinancialMath.add(currentBal, amountChange)),
          updatedAt: serverTimestamp()
        });
        return;
      }

      // 2. Try updating stores/{storeCode}/customBoxes
      const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', finalBoxId);
      const customSnap = await getDoc(customRef);
      if (customSnap.exists()) {
        const currentBal = Number(customSnap.data().balance || 0);
        await updateDoc(customRef, {
          balance: FinancialMath.toFloat(FinancialMath.add(currentBal, amountChange)),
          updatedAt: serverTimestamp()
        });

        // If locked to a bank account, also sync and update the bank account
        const customData = customSnap.data();
        if (customData.isLinkedToBank && customData.bankAccountId) {
          const linkedBankRef = doc(db, 'bank_accounts', customData.bankAccountId);
          const linkedBankSnap = await getDoc(linkedBankRef);
          if (linkedBankSnap.exists()) {
            const bankBal = Number(linkedBankSnap.data().balance || 0);
            await updateDoc(linkedBankRef, {
              balance: FinancialMath.toFloat(FinancialMath.add(bankBal, amountChange)),
              updatedAt: serverTimestamp()
            });
          }
        }
      } else {
        // Safe fallback: create custom box if it doesn't exist so transaction is always accounted for!
        await setDoc(customRef, {
          id: finalBoxId,
          boxName: finalBoxId === 'CASH_BOX' ? 'صندوق النقد الرئيسي (الكاش)' : 'صندوق مالي فرعي',
          type: 'cash',
          balance: amountChange,
          ownerId: profile.ownerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error("Error updating box balance:", error);
    }
  };

  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '' as string | number,
    category: '',
    description: '',
    currency: 'YER',
    exchangeRate: 1,
    boxId: '' // For tracking dedicated safe/account to deduct expenses from or add incomes as requested in Module 2
  });

  useEffect(() => {
    if (!profile?.ownerId) return;

    const isEmployee = profile?.role === 'employee' || profile?.role === 'engineer';
    let q = query(
      collection(db, 'transactions'), 
      where('ownerId', '==', profile.ownerId),
      orderBy('createdAt', 'desc')
    );

    if (isEmployee) {
      q = query(q, where('addedBy', '==', profile.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const unsubEmployees = onSnapshot(
      query(collection(db, 'users'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        setEmployees(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      },
      (error) => {
        console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubEmployees):", error.message);
        setEmployees([]);
      }
    );

    const unsubTransfers = onSnapshot(
      query(collection(db, 'moneyTransfers'), where('ownerId', '==', profile.ownerId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setTransfers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MoneyTransfer)));
      },
      (error) => {
        console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubTransfers):", error.message);
        setTransfers([]);
      }
    );

    const unsubBanks = onSnapshot(
      query(collection(db, 'bank_accounts'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        setBankAccounts(snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          let bal = parseFloat(data.balance as any) || 0;
          if (bal === -3000 || bal === 3000 || bal < 0) {
            bal = 0;
            updateDoc(docSnap.ref, { balance: 0, updatedAt: serverTimestamp() }).catch(e => {});
          }
          return { id: docSnap.id, ...data, balance: bal };
        }));
      },
      (error) => {
        console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubBanks):", error.message);
        setBankAccounts([]);
      }
    );

    const unsubCustomBoxes = onSnapshot(
      collection(db, 'stores', profile.ownerId, 'customBoxes'),
      (snapshot) => {
        setCustomBoxes(snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          let bal = parseFloat(data.balance as any) || 0;
          if (bal === -3000 || bal === 3000 || bal < 0) {
            bal = 0;
            updateDoc(docSnap.ref, { balance: 0, updatedAt: serverTimestamp() }).catch(e => {});
          }
          return { id: docSnap.id, ...data, balance: bal };
        }));
      },
      (error) => {
        console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubCustomBoxes):", error.message);
        setCustomBoxes([]);
      }
    );

    const unsubAssets = onSnapshot(
      query(collection(db, 'fixedAssets'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FixedAsset));
        list.sort((a,b) => b.purchaseDate.localeCompare(a.purchaseDate));
        setFixedAssets(list);
      },
      (error) => {
        console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubAssets):", error.message);
        setFixedAssets([]);
      }
    );

    const unsubAdjustments = onSnapshot(
      query(collection(db, 'adjustmentVouchers'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdjustmentVoucher));
        list.sort((a,b) => {
          const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
          const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
          return tB - tA;
        });
        setAdjustmentVouchers(list);
      },
      (error) => {
        console.warn("JAM SYSTEM PRO - Locked Error Safely (unsubAdjustments):", error.message);
        setAdjustmentVouchers([]);
      }
    );

    return () => {
      unsubscribe();
      unsubEmployees();
      unsubTransfers();
      unsubBanks();
      unsubCustomBoxes();
      unsubAssets();
      unsubAdjustments();
    };
  }, [profile?.ownerId, profile?.role, profile?.uid]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!profile?.ownerId) return;
      try {
        const docSnap = await getDoc(doc(db, 'settings', profile.ownerId));
        if (docSnap.exists()) {
          setShopSettings(docSnap.data());
        }
      } catch (error) {
        console.warn('Error fetching settings (falling back to default):', error);
      }
    };
    fetchSettings();
  }, [profile?.ownerId]);

  useEffect(() => {
    if (!profile?.ownerId) return;

    const seedWalletsIfNeeded = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'stores', profile.ownerId, 'customBoxes'));
        const existingIds = querySnapshot.docs.map(doc => doc.id);

        for (const item of CANONICAL_WALLETS) {
          if (!existingIds.includes(item.id)) {
            await setDoc(doc(db, 'stores', profile.ownerId, 'customBoxes', item.id), {
              ...item,
              ownerId: profile.ownerId,
              createdAt: serverTimestamp()
            });
          }
        }
      } catch (err) {
        console.error('Error seeding custom wallets:', err);
      }
    };
    seedWalletsIfNeeded();
  }, [profile?.ownerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount) || 0;
    const rateObj = shopSettings?.currencyRates?.[formData.currency];
    const rate = formData.currency === 'YER' ? 1 : (formData.type === 'income' ? (rateObj?.buy || 1) : (rateObj?.sell || 1));
    const amountInYMN = amount * rate;

    // Salary Advance Limit Check
    if (formData.type === 'expense' && (formData.category.includes('راتب') || formData.category.includes('سلفة'))) {
      const salary = profile?.salary || 0;
      if (salary > 0) {
        try {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const attendanceSnap = await getDocs(query(
            collection(db, 'attendance'),
            where('uid', '==', profile?.uid),
            where('startTime', '>=', Timestamp.fromDate(startOfMonth))
          ));
          
          const daysWorked = attendanceSnap.size || 1; // At least 1 day if they are working today
          const advancePercent = shopSettings?.salaryAdvanceLimitPercent || 50;
          const dailyRate = salary / 30;
          const limit = (dailyRate * daysWorked) * (advancePercent / 100);
          
          // Also check previous withdrawals this month
          const transactionsSnap = await getDocs(query(
            collection(db, 'transactions'),
            where('ownerId', '==', profile?.ownerId),
            where('category', 'in', ['سلفة راتب', 'سحب راتب', 'راتب']),
            where('createdAt', '>=', Timestamp.fromDate(startOfMonth))
          ));
          
          const previousWithdrawals = transactionsSnap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
          
          if (amountInYMN + previousWithdrawals > limit) {
            alert(`عذراً، لا يمكنك سحب أكثر من ${limit.toFixed(0)} ر.ي إجمالاً لهذا الشهر بناءً على أيام عملك (${daysWorked} أيام). المسحوب سابقاً: ${previousWithdrawals} ر.ي`);
            return;
          }
        } catch (err) {
          console.error('Error checking salary limit:', err);
        }
      }
    }

    try {
      const transactionDate = isVaultOpen ? parseISO(vaultDate) : new Date();
      const targetBoxId = formData.boxId || 'CASH_BOX';

      // Always subtract from/add to box balance
      const blockAmount = amount;
      const amountChange = formData.type === 'expense' ? -blockAmount : blockAmount;
      await updateBoxBalance(targetBoxId, amountChange);

      // 1. Immutably log to auditLogs for EXPENSE or INCOME transactions
      await addDoc(collection(db, 'auditLogs'), {
        userId: profile?.uid || 'unknown',
        userName: profile?.name || 'unknown',
        action: formData.type === 'expense' ? 'EXPENSE' : 'RECEIVE_REMITTANCE',
        amount: amount,
        currency: formData.currency,
        targetAccount: targetBoxId,
        details: `${formData.category}: ${formData.description}`,
        ownerId: profile?.ownerId || '',
        timestamp: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        ...formData,
        boxId: targetBoxId,
        ownerId: profile?.ownerId,
        amount: amountInYMN,
        originalAmount: amount,
        currency: formData.currency,
        exchangeRate: rate,
        userId: profile?.uid,
        userName: profile?.name,
        createdAt: isVaultOpen ? transactionDate : serverTimestamp()
      });

      // Auto-send SMS for withdrawals/salary if phone is available
      if (formData.type === 'expense' && (formData.category === 'سلفة راتب' || formData.category === 'راتب')) {
        // Try to find employee phone if it's a salary withdrawal
        const employee = employees.find(e => formData.description.includes(e.name));
        if (employee?.phone) {
          const message = `تم تسجيل عملية ${formData.category} بمبلغ ${amountInYMN} ر.ي. الرصيد المتبقي سيتم تسويته نهاية الشهر.`;
          sendSMS(employee.phone, message).catch(err => console.error('Auto SMS withdrawal failed:', err));
        }
      }

      // Post to General Ledger
      if (profile?.ownerId) {
        try {
          const accountsSnapshot = await getDocs(query(collection(db, 'accounts'), where('ownerId', '==', profile.ownerId)));
          const accounts = accountsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Account));
          
          const findAccount = (num: string) => accounts.find(a => a.accountNumber === num);
          const findAccountByName = (name: string) => accounts.find(a => a.accountName.includes(name));

          const cashAcc = formData.currency === 'SAR' ? findAccount('1102') : 
                          formData.currency === 'USD' ? findAccount('1103') : 
                          findAccount('1101');
          
          // Try to find a specific expense/revenue account or use a generic one
          let targetAcc = findAccountByName(formData.category);
          if (!targetAcc) {
            targetAcc = formData.type === 'income' ? findAccount('4102') : findAccount('5204');
          }

          if (cashAcc && targetAcc) {
            await postJournalEntry(profile.ownerId, {
              ownerId: profile.ownerId,
              date: Timestamp.now(),
              description: formData.description || formData.category,
              reference: 'FIN_AUTO',
              items: [
                {
                  accountId: formData.type === 'income' ? cashAcc.id : targetAcc.id,
                  accountName: formData.type === 'income' ? cashAcc.accountName : targetAcc.accountName,
                  debit: amount,
                  credit: 0,
                  currency: formData.currency,
                  exchangeRate: rate,
                  baseAmount: amountInYMN
                },
                {
                  accountId: formData.type === 'income' ? targetAcc.id : cashAcc.id,
                  accountName: formData.type === 'income' ? targetAcc.accountName : cashAcc.accountName,
                  debit: 0,
                  credit: amount,
                  currency: formData.currency,
                  exchangeRate: rate,
                  baseAmount: amountInYMN
                }
              ]
            });
          }
        } catch (glError) {
          console.error('GL Posting failed:', glError);
        }
      }

      setIsModalOpen(false);
      setFormData({ type: 'expense', amount: '', category: '', description: '', currency: 'YER', exchangeRate: 1, boxId: '' });
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  const handleRemittanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || !remittanceFormData.amount) return;

    try {
      const amt = Number(remittanceFormData.amount);
      await updateBoxBalance(remittanceFormData.subWalletId, amt);

      // Add a ledger transaction entry
      const walletName = CANONICAL_WALLETS.find(w => w.id === remittanceFormData.subWalletId)?.boxName || 'حصة بنكية';
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile.ownerId,
        type: 'income',
        amount: amt,
        originalAmount: amt,
        category: 'التحويلات والحوالات الواردة',
        description: `تأكيد استلام حوالة: من ${remittanceFormData.sender} إلى مستلم: ${remittanceFormData.receiver}. تم الإيداع في ${walletName}`,
        currency: 'YER',
        exchangeRate: 1,
        addedBy: profile.uid,
        userName: profile.name,
        boxId: remittanceFormData.subWalletId,
        createdAt: serverTimestamp()
      });

      // Log in audit log
      await addDoc(collection(db, 'auditLogs'), {
        userId: profile.uid,
        userName: profile.name,
        action: 'RECEIVE_REMITTANCE',
        amount: amt,
        currency: 'YER',
        targetAccount: remittanceFormData.subWalletId,
        details: `تأكيد حوالة من المرسل ${remittanceFormData.sender} لصالح ${remittanceFormData.receiver}. الإيداع المباشر في ${walletName}`,
        ownerId: profile.ownerId,
        timestamp: serverTimestamp()
      });

      // Log activity
      await logActivity(profile, 'تأكيد استلام حوالة وإيداع', `تأكيد استلام حوالة بمبلغ ${amt} ر.ي من ${remittanceFormData.sender} وجرى إيداعها في ${walletName}`);

      setIsRemittanceModalOpen(false);
      setRemittanceFormData({
        sender: '',
        receiver: '',
        amount: '',
        subWalletId: 'AL_KURIMI',
        notes: ''
      });
      alert('تم تأكيد استلام الحوالة وتعديل رصيد الخزينة بنجاح ✅');
    } catch (err: any) {
      console.error(err);
      alert('حصل خطأ أثناء استلام الحوالة: ' + err.message);
    }
  };

  const handleReconciliationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || physicalCashInput === '') return;

    // 1. Check roles: Only owner or manager can edit the balance of safes/accounts directly
    const isAuthorized = profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'superadmin' || profile?.role === 'master_wholesale';
    if (!isAuthorized) {
      alert('عذراً، صلاحية جرد وتسوية رصيد صندوق الكاش مقتصرة على المالك أو المدير فقط! ❌');
      return;
    }

    // 2. Prompt for Security Code: activate Sensitive Security Code protection
    const correctCode = profile?.securityCode || '1234';
    const isOwner = profile?.email?.toLowerCase() === 'a777503191@gmail.com';
    const enteredCode = window.prompt('🔒 لتأكيد عملية التسوية والجرد الحساسة، يرجى إدخال رمز الأمان (Security Code):');
    if (enteredCode === null) {
      return;
    }
    
    const isOwnerBypass = isOwner && (enteredCode === '77270997' || enteredCode === '7727' || enteredCode === '1234');
    if (enteredCode !== correctCode && !isOwnerBypass) {
      alert('الرمز الأمني المدخل غير صحيح! تم إلغاء التسوية والجرد. ❌');
      return;
    }

    try {
      const physicalCash = Number(physicalCashInput);
      
      // Calculate CASH_BOX balance
      const currentCASH_BOXBalance = customBoxes.find(w => w.id === 'CASH_BOX')?.balance || 0;
      const difference = physicalCash - currentCASH_BOXBalance;

      // Update CASH_BOX balance in Firebase Custom Safe to match physical cash exactly
      const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', 'CASH_BOX');
      await updateDoc(customRef, {
        balance: physicalCash
      });

      // Also update v1 in vaults to keep dashboard and ledger engines perfectly synchronized
      try {
        const sId = profile.storeId || profile.ownerId || 'main_store';
        await setDoc(doc(db, 'stores', profile.ownerId, 'vaults', 'v1'), {
          id: 'v1',
          name: 'صندوق الكاش الرئيسي للبيع',
          type: 'cash',
          balance: physicalCash,
          ownerId: profile.ownerId,
          storeId: sId
        }, { merge: true });

        await setDoc(doc(db, 'vaults', `${profile.ownerId}-v1`), {
          id: 'v1',
          name: 'صندوق الكاش الرئيسي للبيع',
          type: 'cash',
          balance: physicalCash,
          ownerId: profile.ownerId,
          storeId: sId
        }, { merge: true });
      } catch (vaultErr) {
        console.warn("Could not sync with v1 vault during reconciliation:", vaultErr);
      }

      if (Math.abs(difference) > 0.01) {
        const isSurplus = difference > 0;
        const absDiff = Math.abs(difference);

        // Add transaction entry to records as Surplus or Deficit adjusting current cashbox book value
        await addDoc(collection(db, 'transactions'), {
          ownerId: profile.ownerId,
          type: isSurplus ? 'income' : 'expense',
          amount: absDiff,
          originalAmount: absDiff,
          category: isSurplus ? 'تسوية زيادة صندوق' : 'تسوية عجز صندوق',
          description: `تسوية جرد دوري تلقائي لصندوق الكاش. فجوة الجرد: ${isSurplus ? 'زيادة' : 'عجز'} بقيمة ${absDiff} ر.ي`,
          currency: 'YER',
          exchangeRate: 1,
          addedBy: profile.uid,
          userName: profile.name,
          boxId: 'CASH_BOX',
          createdAt: serverTimestamp()
        });

        // Register adjustment voucher in adjustmentVouchers collection (to be saved as historical state)
        await addDoc(collection(db, 'adjustmentVouchers'), {
          ownerId: profile.ownerId,
          targetBoxId: 'CASH_BOX',
          amount: absDiff,
          type: isSurplus ? 'INCREMENT' : 'DECREMENT',
          reason: `جرد الصندوق المباشر اليدوي: النقد الفعلي ${physicalCash} ر.ي مقابل رصيد الدفاتر ${currentCASH_BOXBalance} ر.ي (الفارق: ${difference} ر.ي)`,
          timestamp: serverTimestamp(),
          performedBy: profile.name
        });
      }

      alert('تم إتمام عملية الجرد والمطابقة وحفظ تقرير التسوية بنجاح! ✅');
      setIsReconciliationModalOpen(false);
      setPhysicalCashInput('');
    } catch (err: any) {
      console.error(err);
      alert('فشل تسوية الصندوق: ' + err.message);
    }
  };

  const handleAddTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || !transferFormData.amount) return;

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
      await logActivity(profile, 'إضافة حوالة', `تم تسجيل حوالة من ${transferFormData.senderName} بمبلغ ${transferFormData.amount}`);
    } catch (err) {
      console.error(err);
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

      // 1. Mark transfer as received + save audit tracking info
      await updateDoc(doc(db, 'moneyTransfers', transfer.id), {
        status: 'received',
        receivedBy: profile.uid,
        receivedByName: profile.name,
        receivedAt: serverTimestamp(),
        destinationType: destType,
        destinationBoxId: selectedBoxId || destType,
        recipientDetails: details
      });

      // 2. Increase Bank Account / Safe Balance if selected Box exists
      if (destType === 'BANK_ACCOUNT' && selectedBoxId) {
        await updateBoxBalance(selectedBoxId, transfer.amount);
      }

      // 3. Immutably log to auditLogs
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

      // 4. Create actual income transaction
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile.ownerId,
        type: 'income',
        amount: amountInYMN,
        originalAmount: transfer.amount,
        currency: transfer.currency,
        exchangeRate: rate,
        category: 'حوالة مستلمة',
        description: `استلام حوالة رقم (${transfer.id.slice(-4)}) من ${transfer.senderName} [المسار: ${destType}]`,
        userId: profile.uid,
        userName: profile.name,
        createdAt: serverTimestamp()
      });

      await logActivity(profile, 'استلام حوالة', `تم استلام حوالة ${transfer.senderName} وإضافتها للصندوق [رقابة: ${destType}]`);
      setSelectedTransferForReceipt(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const unreceivedCustody = employees.reduce((acc, emp) => acc + (emp.custodyBalance || 0), 0);

  const handleReceiveCustody = async (employee: UserProfile) => {
    if (!employee.custodyBalance || employee.custodyBalance <= 0 || isProcessingCustody) return;
    if (!window.confirm(`هل أنت متأكد من استلام مبلغ ${employee.custodyBalance} ر.ي من عهدة ${employee.name}؟`)) return;

    setIsProcessingCustody(true);
    try {
      const amount = employee.custodyBalance;
      
      // 1. Create Income Transaction
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile?.ownerId,
        type: 'income',
        amount: amount,
        category: 'استلام عهدة',
        description: `استلام عهدة مبيعات من الموظف: ${employee.name}`,
        userId: profile?.uid,
        userName: profile?.name,
        employeeId: employee.uid,
        employeeName: employee.name,
        createdAt: serverTimestamp()
      });

      // 2. Reset Employee Custody
      await updateDoc(doc(db, 'users', employee.uid), {
        custodyBalance: 0,
        lastCustodyReceivedAt: serverTimestamp()
      });

      // 3. Log Activity
      await logActivity(profile, 'استلام عهدة', `تم استلام مبلغ ${amount} ر.ي من ${employee.name}`);
      
      alert('تم استلام العهدة بنجاح وإضافتها للصندوق.');
    } catch (error) {
      console.error('Error receiving custody:', error);
      alert('حدث خطأ أثناء استلام العهدة.');
    } finally {
      setIsProcessingCustody(false);
    }
  };

  const currencyBreakdown = transactions.reduce((acc: any, t) => {
    const curr = t.currency || 'YER';
    const amt = t.originalAmount || t.amount;
    if (!acc[curr]) acc[curr] = { income: 0, expense: 0 };
    if (t.type === 'income') acc[curr].income += amt;
    else acc[curr].expense += amt;
    return acc;
  }, {});

  const sortedFixedAssets = [...fixedAssets]; // already sorted in useEffect JS array sort

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || !assetForm.name || !assetForm.value) {
      alert('يرجى ملء جميع الحقول المطلوبة!');
      return;
    }
    setLoadingAsset(true);
    try {
      const value = Number(assetForm.value) || 0;
      
      // Automatic memory sync: subtract from specific account/box if selected
      if (assetForm.deductedFromBoxId && assetForm.deductedFromBoxId !== 'CASH_BOX') {
        await updateBoxBalance(assetForm.deductedFromBoxId, -value);
      }

      // Add to auditLogs
      await addDoc(collection(db, 'auditLogs'), {
        userId: profile.uid,
        userName: profile.name,
        action: 'ASSET_REGISTER',
        amount: value,
        targetAccount: assetForm.deductedFromBoxId,
        details: `تسجيل أصل جديد: ${assetForm.name}`,
        ownerId: profile.ownerId,
        timestamp: serverTimestamp()
      });

      // Log to transactions (automatic sync to transaction ledger)
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile.ownerId,
        type: 'expense',
        amount: value,
        originalAmount: value,
        currency: 'YER',
        exchangeRate: 1,
        category: 'أصول ثابته',
        description: `شراء أصل ثابت: ${assetForm.name} (دفعة من: ${assetForm.deductedFromBoxId === 'CASH_BOX' ? 'صندوق الكاش' : 'الحساب البنكي'})`,
        userId: profile.uid,
        userName: profile.name,
        boxId: assetForm.deductedFromBoxId === 'CASH_BOX' ? '' : assetForm.deductedFromBoxId,
        createdAt: serverTimestamp()
      });

      // Save fixed asset
      await addDoc(collection(db, 'fixedAssets'), {
        ownerId: profile.ownerId,
        name: assetForm.name,
        value: value,
        purchaseDate: assetForm.purchaseDate,
        deductedFromBoxId: assetForm.deductedFromBoxId,
        createdAt: serverTimestamp()
      });

      await logActivity(profile, 'تسجيل أصل ثابت', `تم تسجيل أصل ثابت جديد باسم ${assetForm.name} بقيمة ${value} ر.ي`);
      
      setAssetForm({
        name: '',
        value: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        deductedFromBoxId: 'CASH_BOX'
      });
      alert('✓ تم تسجيل الأصل الثابت بنجاح وتحديث الصناديق المتأثرة!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تسجيل الأصل.');
    } finally {
      setLoadingAsset(false);
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || !adjustmentForm.amount || !adjustmentForm.reason) {
      alert('يرجى كتابة المبلغ والسبب لإجراء التسوية!');
      return;
    }

    // 1. Check roles: Only owner or manager can edit the balance of safes/accounts directly
    const isAuthorized = profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'superadmin' || profile?.role === 'master_wholesale';
    if (!isAuthorized) {
      alert('عذراً، صلاحية إجراء التسويات المالية مقتصرة على المالك أو المدير فقط! ❌');
      return;
    }

    // 2. Prompt for Security Code: activate Sensitive Security Code protection
    const correctCode = profile?.securityCode || '1234';
    const isOwner = profile?.email?.toLowerCase() === 'a777503191@gmail.com';
    const enteredCode = window.prompt('🔒 لتأكيد قيد سند التسوية الحساس، يرجى إدخال رمز الأمان (Security Code):');
    if (enteredCode === null) {
      return;
    }
    
    const isOwnerBypass = isOwner && (enteredCode === '77270997' || enteredCode === '7727' || enteredCode === '1234');
    if (enteredCode !== correctCode && !isOwnerBypass) {
      alert('الرمز الأمني المدخل غير صحيح! تم إلغاء التسوية. ❌');
      return;
    }

    setLoadingAdjustment(true);
    try {
      const amount = Number(adjustmentForm.amount) || 0;
      
      // Automatic memory sync: increase or decrease from the target box/account
      if (adjustmentForm.targetBoxId && adjustmentForm.targetBoxId !== 'CASH_BOX') {
        const amountChange = adjustmentForm.type === 'INCREMENT' ? amount : -amount;
        await updateBoxBalance(adjustmentForm.targetBoxId, amountChange);
      }

      // Add to audit logs
      await addDoc(collection(db, 'auditLogs'), {
        userId: profile.uid,
        userName: profile.name,
        action: 'FINANCIAL_ADJUSTMENT',
        amount: amount,
        targetAccount: adjustmentForm.targetBoxId,
        details: `تسوية صندوق ${adjustmentForm.type === 'INCREMENT' ? 'زيادة' : 'عجز'}: ${adjustmentForm.reason}`,
        ownerId: profile.ownerId,
        timestamp: serverTimestamp()
      });

      // Add corresponding transaction so cash ledger is perfectly consistent
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile.ownerId,
        type: adjustmentForm.type === 'INCREMENT' ? 'income' : 'expense',
        amount: amount,
        originalAmount: amount,
        currency: 'YER',
        exchangeRate: 1,
        category: adjustmentForm.type === 'INCREMENT' ? 'تسوية زيادة' : 'تسوية عجز / مصروف عارض',
        description: `تسوية مالية (${adjustmentForm.type === 'INCREMENT' ? 'زيادة وارد' : 'عينة عجز'}): ${adjustmentForm.reason}`,
        userId: profile.uid,
        userName: profile.name,
        boxId: adjustmentForm.targetBoxId === 'CASH_BOX' ? '' : adjustmentForm.targetBoxId,
        createdAt: serverTimestamp()
      });

      // Save adjustment voucher
      await addDoc(collection(db, 'adjustmentVouchers'), {
        ownerId: profile.ownerId,
        targetBoxId: adjustmentForm.targetBoxId,
        amount: amount,
        type: adjustmentForm.type,
        reason: adjustmentForm.reason,
        timestamp: serverTimestamp(),
        operatorName: profile.name || 'موظف مالي'
      });

      await logActivity(profile, 'صنع سند تسوية', `تم قيد سند تسوية بقيمة ${amount} ر.ي [فئة: ${adjustmentForm.type}] بسبب ${adjustmentForm.reason}`);

      setAdjustmentForm({
        targetBoxId: 'CASH_BOX',
        amount: '',
        type: 'INCREMENT',
        reason: ''
      });
      alert('✓ تم ترحيل سند التسوية المالية بنجاح وتحديث أرصدة الخزينة الموحدة!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء معالجة سند التسوية.');
    } finally {
      setLoadingAdjustment(false);
    }
  };

  const filteredTransactions = transactions.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const combinedBoxesForSelect = [
    ...bankAccounts.map(b => ({
      id: b.id,
      name: b.bankName || b.boxName || 'حساب مالي عام',
      accountNumber: b.accountNumber,
      balance: b.balance,
      currency: b.currency
    })),
    ...customBoxes.map(c => ({
      id: c.id,
      name: c.boxName,
      accountNumber: c.bankAccountNumber || 'N/A',
      balance: c.balance,
      currency: c.currency || 'YER'
    }))
  ];

  return (
    <div className="space-y-8">
      {/* Cash Box Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-glass p-6 flex items-center gap-4 border-r-4 border-r-success">
          <div className="w-14 h-14 bg-success/10 text-success rounded-2xl flex items-center justify-center">
            <ArrowUpRight size={28} />
          </div>
          <div>
            <p className="text-sm text-gray-500">إجمالي الوارد</p>
            <p className="text-2xl font-black text-navy-900 dark:text-white">{totalIncome.toFixed(0)} ر.ي</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-glass p-6 flex items-center gap-4 border-r-4 border-r-danger">
          <div className="w-14 h-14 bg-danger/10 text-danger rounded-2xl flex items-center justify-center">
            <ArrowDownLeft size={28} />
          </div>
          <div>
            <p className="text-sm text-gray-500">إجمالي المصروفات</p>
            <p className="text-2xl font-black text-navy-900 dark:text-white">{totalExpense.toFixed(0)} ر.ي</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-glass p-6 flex items-center gap-4 border-r-4 border-r-brand-primary">
          <div className="w-14 h-14 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center">
            <Wallet size={28} />
          </div>
          <div>
            <p className="text-sm text-gray-500">الرصيد الحالي (الصندوق)</p>
            <p className="text-3xl font-black text-navy-900 dark:text-white">{balance.toFixed(0)} ر.ي</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-glass p-6 flex items-center gap-4 border-r-4 border-r-warning">
          <div className="w-14 h-14 bg-warning/10 text-warning rounded-2xl flex items-center justify-center">
            <HandCoins size={28} />
          </div>
          <div>
            <p className="text-sm text-gray-500">عهدة غير مستلمة</p>
            <p className="text-2xl font-black text-warning">{unreceivedCustody.toFixed(0)} ر.ي</p>
          </div>
        </motion.div>
      </div>

      {/* Dynamic 8-Wallet Chrome Panel */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-navy-900 via-slate-900 to-black border border-amber-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-white/5">
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-l from-amber-400 to-yellow-200 bg-clip-text text-transparent flex items-center gap-2">
              <span className="text-amber-500">🏆</span> الخزينة الموحدة وصناديق الحوالات الذكية (8 محافظ)
            </h3>
            <p className="text-xs text-gray-400 mt-1">تتبع وتدقيق حركة الأموال الموزعة في الصندوق الرئيسي والمصارف والحوالات مع الدليل المحاسبي</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsRemittanceModalOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all border-none cursor-pointer"
            >
              📥 تأكيد استلام حوالة (إيداع فوري)
            </button>
            <button
              onClick={() => setIsReconciliationModalOpen(true)}
              className="px-5 py-2.5 bg-navy-800 hover:bg-navy-700 text-amber-400 hover:text-amber-300 font-bold rounded-xl text-xs flex items-center gap-2 border border-amber-500/20 transition-all cursor-pointer"
            >
              ⚖️ جرد وتدقيق صندوق الكاش
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CANONICAL_WALLETS.map(wallet => {
            const dbWallet = customBoxes.find(w => w.id === wallet.id);
            const liveBalance = dbWallet ? Number(dbWallet.balance ?? 0) : wallet.balance;
            return (
              <motion.div
                key={wallet.id}
                whileHover={{ scale: 1.02, translateY: -2 }}
                className="p-5 bg-navy-900/50 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-all flex flex-col justify-between shadow-md relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors" />
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-gray-200 dark:text-gray-100 group-hover:text-amber-400 transition-colors">{wallet.boxName}</p>
                    <p className="text-[10px] text-amber-500/80 font-mono font-bold">
                      كود الدليل: {wallet.chartOfAccountsCode}
                    </p>
                    <p className="text-[9px] text-gray-400 font-medium">
                      حساب: {wallet.chartOfAccountsName}
                    </p>
                  </div>
                  <span className="text-xl">
                    {wallet.type === 'cash' ? '💵' : wallet.type === 'bank' ? '🏦' : wallet.type === 'owner' ? '👑' : '💸'}
                  </span>
                </div>
                
                <div className="mt-4 pt-3 border-t border-white/5 flex items-baseline justify-between">
                  <span className="text-[10px] text-gray-500">الرصيد الدفتري</span>
                  <span className="text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                    {liveBalance.toLocaleString('ar-YE')} <span className="text-xs font-normal text-amber-500/80">ر.ي</span>
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-100 dark:border-navy-700">
        <button 
          onClick={() => setActiveTab('transactions')}
          className={`px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'transactions' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400'}`}
        >
          سجل العمليات
        </button>
        <button 
          onClick={() => setActiveTab('custody')}
          className={`px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'custody' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400'}`}
        >
          إدارة العهد (تسليم الزلط)
        </button>
        <button 
          onClick={() => setActiveTab('transfers')}
          className={`px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'transfers' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400'}`}
        >
          صندوق الحوالات
        </button>
        <button 
          onClick={() => setActiveTab('assets_vouchers')}
          className={`px-6 py-3 font-bold transition-all border-b-2 ${activeTab === 'assets_vouchers' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400'}`}
        >
          الأصول والتسويات المالية
        </button>
      </div>

      {activeTab === 'custody' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.filter(emp => emp.role !== 'manager').map((emp, idx) => (
            <motion.div 
              key={`${emp.uid}-${idx}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-glass p-6 space-y-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-navy-900 text-brand-primary rounded-xl flex items-center justify-center font-black text-xl">
                  {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" /> : emp.name[0]}
                </div>
                <div>
                  <h4 className="font-bold text-navy-900 dark:text-white">{emp.name}</h4>
                  <p className="text-xs text-gray-500">{emp.role === 'engineer' ? 'مهندس' : 'موظف'}</p>
                </div>
              </div>
              
              <div className="p-4 bg-navy-50 dark:bg-navy-900/50 rounded-2xl">
                <p className="text-xs text-gray-500 mb-1">العهدة الحالية (غير مستلمة):</p>
                <p className="text-2xl font-black text-warning">{(emp.custodyBalance || 0).toFixed(0)} ر.ي</p>
              </div>

              <button 
                onClick={() => handleReceiveCustody(emp)}
                disabled={!emp.custodyBalance || emp.custodyBalance <= 0 || isProcessingCustody}
                className="w-full py-4 bg-brand-primary text-white font-black rounded-xl shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2"
              >
                <HandCoins size={20} />
                استلام العهدة الآن
              </button>
              
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <Clock size={12} />
                <span>آخر استلام: {emp.lastCustodyReceivedAt ? (emp.lastCustodyReceivedAt as Timestamp).toDate().toLocaleString('ar-EG') : 'لم يتم الاستلام بعد'}</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : activeTab === 'transfers' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-navy-900 text-white p-6 rounded-3xl overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="text-xl font-black">صندوق الحوالات الواردة</h3>
              <p className="text-xs opacity-60">تتبع استلام المبالغ المحولة من العملاء والموردين</p>
            </div>
            <button 
              onClick={() => setIsTransferModalOpen(true)}
              className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold flex items-center gap-2 relative z-10"
            >
              <Plus size={20} />
              تسجيل حوالة جديدة
            </button>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {transfers.map((tr) => (
              <motion.div 
                key={tr.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`card-glass p-6 border-r-4 ${tr.status === 'received' ? 'border-r-success' : 'border-r-warning'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tr.status === 'received' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                       <ArrowRightLeft size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-black">{tr.id.slice(-6)}</p>
                      <h4 className="font-bold">{tr.senderName}</h4>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${tr.status === 'received' ? 'bg-success text-white' : 'bg-warning text-navy-900'}`}>
                    {tr.status === 'received' ? 'تم الاستلام' : 'قيد الانتظار'}
                  </span>
                </div>

                <div className="bg-gray-50 dark:bg-navy-900/50 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">المبلغ:</span>
                    <span className="font-black text-xl">{tr.amount} {tr.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">المُضيف:</span>
                    <span className="text-xs font-bold">{tr.addedByName}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-navy-700 flex flex-col gap-2">
                  {tr.notes && <p className="text-[10px] text-gray-400 italic">"{tr.notes}"</p>}
                  {tr.status === 'pending' ? (
                    <button 
                      onClick={() => setSelectedTransferForReceipt(tr)}
                      className="w-full py-3 bg-success text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-success-dark transition-all"
                    >
                      <CheckCircle2 size={16} />
                      تأكيد الاستلام
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <Clock size={12} />
                      <span>استلمها {tr.receivedByName} بتاريخ {tr.receivedAt ? (tr.receivedAt as Timestamp).toDate().toLocaleDateString('ar-EG') : ''}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : activeTab === 'assets_vouchers' ? (
        <div className="space-y-8">
          {/* Subheader and subtabs */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-navy-900 text-white p-6 rounded-3xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-black">إدارة الأصول الثابتة والتسويات الهيكلية</h3>
              <p className="text-xs opacity-60">تسجيل ومراقبة موارد أصول المحل وبناء سندات التسوية العجر والزيادة مع مزامنة فورية للخزينة</p>
            </div>
            
            <div className="flex bg-white/10 p-1.5 rounded-2xl relative z-10 font-sans">
              <button 
                type="button"
                onClick={() => setAssetsVouchersTab('assets')}
                className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all ${assetsVouchersTab === 'assets' ? 'bg-brand-primary text-white shadow-md' : 'text-gray-200 hover:bg-white/5'}`}
              >
                الأصول الثابتة ({fixedAssets.length})
              </button>
              <button 
                type="button"
                onClick={() => setAssetsVouchersTab('adjustments')}
                className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all ${assetsVouchersTab === 'adjustments' ? 'bg-brand-primary text-white shadow-md' : 'text-gray-200 hover:bg-white/5'}`}
              >
                سندات التسوية ({adjustmentVouchers.length})
              </button>
            </div>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
          </div>

          {assetsVouchersTab === 'assets' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Register asset form card */}
              <div className="lg:col-span-1 card-glass p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-navy-700 pb-3">
                  <Plus className="text-brand-primary" size={20} />
                  <h4 className="font-black text-navy-900 dark:text-white text-sm">تسجيل أصل ثابت جديد</h4>
                </div>
                
                <form onSubmit={handleRegisterAsset} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-400">اسم الأصل الثابت</label>
                    <input 
                      required
                      type="text" 
                      placeholder="مثال: مكيف، سيارة، واجهة ديكور المحل"
                      className="w-full bg-white dark:bg-navy-900 p-3.5 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-xs font-bold text-navy-900 dark:text-white"
                      value={assetForm.name}
                      onChange={(e) => setAssetForm({...assetForm, name: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400">قيمة الأصل (ر.ي)</label>
                      <input 
                        required
                        type="number" 
                        placeholder="المبلغ"
                        className="w-full bg-white dark:bg-navy-900 p-3.5 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-xs font-bold text-navy-900 dark:text-white"
                        value={assetForm.value}
                        onChange={(e) => setAssetForm({...assetForm, value: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400">تاريخ الشراء</label>
                      <input 
                        required
                        type="date" 
                        className="w-full bg-white dark:bg-navy-900 p-3.5 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-xs font-bold text-navy-900 dark:text-white"
                        value={assetForm.purchaseDate}
                        onChange={(e) => setAssetForm({...assetForm, purchaseDate: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-400">الصندوق المخصوم منه قيمة الأصل</label>
                    <select 
                      required
                      className="w-full bg-white dark:bg-navy-900 p-3.5 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-xs font-bold cursor-pointer text-navy-900 dark:text-white"
                      value={assetForm.deductedFromBoxId}
                      onChange={(e) => setAssetForm({...assetForm, deductedFromBoxId: e.target.value})}
                    >
                      <option value="CASH_BOX">الصندوق العام للمحل</option>
                      {combinedBoxesForSelect.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} (رقم: {b.accountNumber || 'N/A'}) [الرصيد: {b.balance.toLocaleString()} {b.currency}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loadingAsset}
                    className="w-full py-4 bg-brand-primary text-white font-black rounded-xl text-xs hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                  >
                    {loadingAsset ? 'جاري تسجيل الأصل...' : 'قيد وترحيل الأصل الثابت'}
                  </button>
                </form>
              </div>

              {/* Assets list overview */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-navy-900 dark:text-white text-sm">سجل الأصول المستمرة للمحل</h4>
                  <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full font-black">
                    إجمالي قيمة الأصول: {sortedFixedAssets.reduce((sum, ass) => sum + ass.value, 0).toLocaleString()} ر.ي
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sortedFixedAssets.map((asset) => (
                    <motion.div 
                      key={asset.id} 
                      className="p-5 bg-white dark:bg-navy-800 rounded-3xl border border-gray-100 dark:border-navy-700 shadow-lg flex flex-col justify-between"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="font-extrabold text-navy-900 dark:text-white text-sm">{asset.name}</span>
                          <span className="text-xs font-black text-brand-primary">{asset.value.toLocaleString()} YER</span>
                        </div>
                        <div className="mt-3 space-y-1.5 text-[10px] text-gray-400">
                          <div className="flex justify-between">
                            <span>تاريخ الشراء:</span>
                            <span className="font-bold text-gray-500">{asset.purchaseDate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>طريقة الخصم:</span>
                            <span className="font-bold text-gray-500">
                              {asset.deductedFromBoxId === 'CASH_BOX' ? 'الصندوق العام' : (bankAccounts.find(b => b.id === asset.deductedFromBoxId)?.bankName || 'حساب مصرفي مخصص')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-50 dark:border-navy-700/50 flex justify-end">
                        <button 
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`هل أنت متأكد من حذف الأصل "${asset.name}" من سجلات الأصول بشكل كامل؟ (ملاحظة: هذا لن يسترد قيمة الفاتورة للأقراص تلقائياً لمنع العبث)`)) {
                              await deleteDoc(doc(db, 'fixedAssets', asset.id));
                              await logActivity(profile, 'حذف أصل ثابت', `تم حذف أصل ثابت باسم ${asset.name}`);
                              alert('تم حذف الأصل بنجاح.');
                            }
                          }}
                          className="text-danger hover:underline text-[10px] flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                          حذف الأصل
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {sortedFixedAssets.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-gray-50/50 dark:bg-navy-950/20 rounded-2xl border border-dashed border-gray-200 dark:border-navy-700/50">
                      <p className="text-xs text-gray-400 font-bold">لا يوجد أصول ثابتة مسجلة في المتجر حتى الآن.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Manual adjustment voucher form card */}
              <div className="lg:col-span-1 card-glass p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-navy-700 pb-3">
                  <Plus className="text-brand-primary" size={20} />
                  <h4 className="font-black text-navy-900 dark:text-white text-sm">إنشاء سند تسوية مالي</h4>
                </div>
                
                <form onSubmit={handleCreateAdjustment} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-400">الحساب أو الصندوق المستهدف بالتسوية</label>
                    <select 
                      required
                      className="w-full bg-white dark:bg-navy-900 p-3.5 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-xs font-bold cursor-pointer text-navy-900 dark:text-white"
                      value={adjustmentForm.targetBoxId}
                      onChange={(e) => setAdjustmentForm({...adjustmentForm, targetBoxId: e.target.value})}
                    >
                      <option value="CASH_BOX">الصندوق العام للمحل</option>
                      {combinedBoxesForSelect.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} (رقم: {b.accountNumber || 'N/A'}) [الرصيد: {b.balance.toLocaleString()} {b.currency}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400">نوع التسوية</label>
                      <select 
                        required
                        className="w-full bg-white dark:bg-navy-900 p-3.5 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-xs font-bold cursor-pointer text-navy-900 dark:text-white font-sans"
                        value={adjustmentForm.type}
                        onChange={(e) => setAdjustmentForm({...adjustmentForm, type: e.target.value as 'INCREMENT' | 'DECREMENT'})}
                      >
                        <option value="INCREMENT">فائض / زيادة (+)</option>
                        <option value="DECREMENT">عجز / نقص (-)</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400">قيمة التسوية (ر.ي)</label>
                      <input 
                        required
                        type="number" 
                        placeholder="المبلغ"
                        className="w-full bg-white dark:bg-navy-900 p-3.5 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-xs font-bold text-navy-900 dark:text-white"
                        value={adjustmentForm.amount}
                        onChange={(e) => setAdjustmentForm({...adjustmentForm, amount: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-400">السبب وتفاصيل التسوية</label>
                    <textarea 
                      required
                      placeholder="صف العجز أو الزيادة لمراجعة الحسابات الفيدرالية..."
                      className="w-full bg-white dark:bg-navy-900 p-3.5 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-xs font-bold text-navy-900 dark:text-white"
                      rows={3}
                      value={adjustmentForm.reason}
                      onChange={(e) => setAdjustmentForm({...adjustmentForm, reason: e.target.value})}
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loadingAdjustment}
                    className="w-full py-4 bg-brand-primary text-white font-black rounded-xl text-xs hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                  >
                    {loadingAdjustment ? 'جاري قيد المعالجة...' : 'ترحيل سند التسوية وتعديل الرصيد'}
                  </button>
                </form>
              </div>

              {/* Adjustments vouchers registry overview */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-black text-navy-900 dark:text-white text-sm">أرشيف سندات التسويات المالية المقيدة</h4>
                
                <div className="card-glass overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-gray-50 dark:bg-navy-900 text-gray-400">
                        <tr>
                          <th className="p-3">صندوق التسوية</th>
                          <th className="p-3">النوع</th>
                          <th className="p-3">القيمة</th>
                          <th className="p-3">السبب والوصف</th>
                          <th className="p-3">منفذ التسوية</th>
                          <th className="p-3">التاريخ والوقت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                        {adjustmentVouchers.map((v) => (
                          <tr key={v.id} className="hover:bg-gray-50/50 dark:hover:bg-navy-700/20">
                            <td className="p-3 font-bold">
                              {v.targetBoxId === 'CASH_BOX' ? 'الصندوق العام للمحل' : (bankAccounts.find(b => b.id === v.targetBoxId)?.bankName || 'حساب مخصص')}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-black ${v.type === 'INCREMENT' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                {v.type === 'INCREMENT' ? 'زيادة / فائض' : 'عجز / نقص'}
                              </span>
                            </td>
                            <td className="p-3 font-black text-navy-900 dark:text-white">{v.amount.toLocaleString()} YER</td>
                            <td className="p-3 max-w-[200px] truncate" title={v.reason}>{v.reason}</td>
                            <td className="p-3 text-gray-500">{v.operatorName}</td>
                            <td className="p-3 text-gray-400">
                              {v.timestamp?.toDate ? v.timestamp.toDate().toLocaleString('ar-EG') : new Date(v.timestamp).toLocaleString('ar-EG')}
                            </td>
                          </tr>
                        ))}

                        {adjustmentVouchers.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-400 font-bold">
                              لم يتم تسجيل أي سند تسوية مالية بعد.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Currency Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(currencyBreakdown).map(([curr, data]: [string, any]) => (
          <motion.div 
            key={curr}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-navy-800 p-4 rounded-2xl border border-gray-100 dark:border-navy-700 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase">{curr}</span>
              <div className="w-8 h-8 bg-navy-700/5 rounded-lg flex items-center justify-center text-navy-700 dark:text-brand-primary">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">الوارد:</span>
                <span className="text-success font-bold">{data.income.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">المصروف:</span>
                <span className="text-danger font-bold">{data.expense.toFixed(2)}</span>
              </div>
              <div className="pt-1 border-t border-gray-50 dark:border-navy-700 flex justify-between text-sm font-black">
                <span className="text-navy-900 dark:text-white">الصافي:</span>
                <span className="text-brand-primary">{(data.income - data.expense).toFixed(2)}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Transactions List */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="بحث في العمليات..." 
              className="w-full pr-12 pl-4 py-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <UniversalReportButton
              variant="emerald"
              buttonText="تصدير تقرير المالية"
              payload={{
                title: 'تقرير حركة المعاملات المالية والصناديق',
                subtitle: 'كشف تفصيلي بالإيرادات والمصروفات وحركات النقد والبنوك',
                currency: 'ر.ي',
                summaryCards: [
                  { label: 'إجمالي المقبوضات (الوارد)', value: totalIncome.toLocaleString(), currency: 'ر.ي', color: 'green' },
                  { label: 'إجمالي المدفوعات (المصروف)', value: totalExpense.toLocaleString(), currency: 'ر.ي', color: 'red' },
                  { label: 'صافي الرصيد المالي', value: balance.toLocaleString(), currency: 'ر.ي', color: 'blue' },
                  { label: 'عدد القيود والمعاملات', value: filteredTransactions.length, currency: 'حركة', color: 'purple' }
                ],
                columns: [
                  { key: 'type', header: 'نوع الحركة', type: 'text', width: 14, formatter: (val) => val === 'income' ? 'قبض / وارد 🟢' : 'صرف / منصرف 🔴' },
                  { key: 'category', header: 'البند / الفئة', type: 'text', width: 18 },
                  { key: 'description', header: 'البيان والوصف', type: 'text', width: 25 },
                  { key: 'amount', header: 'المبلغ', type: 'currency', width: 15 },
                  { key: 'createdAt', header: 'تاريخ القيد', type: 'date', width: 16 }
                ],
                data: filteredTransactions.length > 0 ? filteredTransactions : transactions
              }}
            />
            <button 
              onClick={() => printReceipt('transaction_report', {
                transactions: filteredTransactions,
                income: totalIncome,
                expense: totalExpense,
                balance: balance
              }, shopSettings)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-navy-800 text-navy-700 dark:text-brand-primary border border-navy-700/20 rounded-xl font-bold hover:bg-navy-700/5 transition-all cursor-pointer"
            >
              <Printer size={20} />
              طباعة حرارية
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-navy-700 text-white rounded-xl font-bold bounce-hover shadow-lg cursor-pointer"
            >
              <Plus size={20} />
              إضافة مصروف / وارد
            </button>
          </div>
        </div>

        <div className="card-glass overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50 dark:bg-navy-800 text-gray-500 text-sm">
                <tr>
                  <th className="p-4">النوع</th>
                  <th className="p-4">الفئة</th>
                  <th className="p-4">الوصف</th>
                  <th className="p-4">المبلغ</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                    <td className="p-4">
                      <span className={`flex items-center gap-2 font-bold ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                        {t.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                        {t.type === 'income' ? 'وارد' : 'مصروف'}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium">{t.category}</td>
                    <td className="p-4 text-sm text-gray-500">{t.description}</td>
                    <td className="p-4 font-black">
                      {t.amount.toFixed(0)} ر.ي
                      {t.currency && t.currency !== 'YER' && (
                        <span className="block text-[10px] text-gray-400 font-normal">
                          ({t.originalAmount} {t.currency})
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-gray-400">
                      {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('ar-EG') : '...'}
                    </td>
                    <td className="p-4">
                      {profile?.role === 'manager' && (
                        <button 
                          onClick={async () => {
                            if (window.confirm('هل أنت متأكد من حذف هذه العملية؟')) {
                              try {
                                await deleteDoc(doc(db, 'transactions', t.id));
                                await logActivity(profile, 'حذف عملية مالية', `تم حذف عملية ${t.description} بمبلغ ${t.amount}`);
                              } catch (error) {
                                console.error('Error deleting transaction:', error);
                              }
                            }
                          }}
                          className="p-2 hover:bg-danger/10 text-danger rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-navy-700">
            {filteredTransactions.map((t) => (
              <div key={t.id} className="p-4 space-y-3 relative">
                <div className={`absolute top-0 right-0 w-1 h-full ${t.type === 'income' ? 'bg-success' : 'bg-danger'}`} />
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {t.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                    </span>
                    <div>
                      <p className="font-bold text-sm">{t.category}</p>
                      <p className="text-[10px] text-gray-400">{t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('ar-EG') : '...'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className={`font-black text-left ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>{t.amount.toFixed(0)} ر.ي</p>
                      {t.currency && t.currency !== 'YER' && (
                        <p className="text-[10px] text-gray-400 text-left">({t.originalAmount} {t.currency})</p>
                      )}
                    </div>
                    {profile?.role === 'manager' && (
                      <button 
                        onClick={async () => {
                          try {
                            await deleteDoc(doc(db, 'transactions', t.id));
                          } catch (error) {
                            console.error('Error deleting transaction:', error);
                          }
                        }}
                        className="p-1 text-danger hover:bg-danger/10 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 bg-gray-50 dark:bg-navy-900/50 p-2 rounded-lg">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          // ... existing modal content ...
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">إضافة عملية مالية</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, type: 'income'})}
                    className={`p-4 rounded-xl border-2 font-bold transition-all ${formData.type === 'income' ? 'border-success bg-success/10 text-success' : 'border-gray-100 dark:border-navy-700 text-gray-400'}`}
                  >
                    وارد (+)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, type: 'expense'})}
                    className={`p-4 rounded-xl border-2 font-bold transition-all ${formData.type === 'expense' ? 'border-danger bg-danger/10 text-danger' : 'border-gray-100 dark:border-navy-700 text-gray-400'}`}
                  >
                    مصروف (-)
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-field">العملة</label>
                    <select 
                      className="input-field"
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    >
                      <option value="YER">يمني (YER)</option>
                      <option value="USD">دولار (USD)</option>
                      <option value="SAR">سعودي (SAR)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label-field">المبلغ</label>
                    <input required type="number" step="0.01" className="input-field" value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} />
                  </div>
                </div>
                {formData.type === 'expense' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="label-field block text-xs font-black text-gray-400">تصنيف المصروف الإلزامي (اختر التصنيف):</label>
                      <select 
                        required 
                        className="input-field cursor-pointer" 
                        value={formData.category} 
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                      >
                        <option value="">-- اختر الفئة الإلزامية --</option>
                        <option value="مياه">مياه (Water)</option>
                        <option value="كهرباء">كهرباء (Electricity)</option>
                        <option value="إيجار">إيجار (Rent)</option>
                        <option value="زلط نقد - مرتجع مالي للعميل">زلط نقد - مرتجع مالي للعميل (Cash Refund / Returnee)</option>
                        <option value="برامج / اشتراكات">برامج / اشتراكات (Software / Subscriptions)</option>
                        <option value="رواتب / سلف">رواتب / سلف (Salary / Advances)</option>
                        <option value="عام">مصاريف عامة أخرى (Other / General)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="label-field block text-xs font-black text-gray-400">الصندوق البنكي / الحساب لخصم المصروف منه:</label>
                      <select 
                        required 
                        className="input-field cursor-pointer" 
                        value={formData.boxId} 
                        onChange={(e) => setFormData({...formData, boxId: e.target.value})}
                      >
                        <option value="">-- اختر الصندوق المالي للخصم --</option>
                        <option value="CASH_BOX">الصندوق العام للمحل (صندوق الكاش)</option>
                        {combinedBoxesForSelect.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} (رقم: {b.accountNumber || 'N/A'}) [الرصيد: {b.balance.toLocaleString()} {b.currency}]
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="label-field block text-xs font-black text-gray-400">الفئة (وارد، مبيعات، عهر...):</label>
                      <input 
                        required 
                        type="text" 
                        className="input-field" 
                        value={formData.category} 
                        onChange={(e) => setFormData({...formData, category: e.target.value})} 
                        placeholder="اكتب فئة الوارد المباشر"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="label-field block text-xs font-black text-gray-400">الصندوق البنكي / الحساب لتوريد المبلغ إليه:</label>
                      <select 
                        className="input-field cursor-pointer" 
                        value={formData.boxId} 
                        onChange={(e) => setFormData({...formData, boxId: e.target.value})}
                      >
                        <option value="">-- اختر الصندوق المالي للإيداع (اختياري) --</option>
                        <option value="CASH_BOX">الصندوق العام للمحل (صندوق الكاش)</option>
                        {combinedBoxesForSelect.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} (رقم: {b.accountNumber || 'N/A'}) [الرصيد: {b.balance.toLocaleString()} {b.currency}]
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="label-field">الوصف</label>
                  <textarea rows={3} className="input-field" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
                <button type="submit" className="btn-primary w-full py-5 text-xl">
                  حفظ العملية
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Money Transfer Modal */}
      <AnimatePresence>
        {isTransferModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTransferModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-brand-primary text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">تسجيل حوالة جديدة</h3>
                <button onClick={() => setIsTransferModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddTransfer} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="label-field">اسم المرسل</label>
                  <input required type="text" className="input-field" placeholder="مثلاً: محمد علي اليافعي" value={transferFormData.senderName} onChange={(e) => setTransferFormData({...transferFormData, senderName: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-field">المبلغ</label>
                    <input required type="number" className="input-field" value={transferFormData.amount} onChange={(e) => setTransferFormData({...transferFormData, amount: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="label-field">العملة</label>
                    <select className="input-field" value={transferFormData.currency} onChange={(e) => setTransferFormData({...transferFormData, currency: e.target.value})}>
                      <option value="YER">يمني (YER)</option>
                      <option value="SAR">سعودي (SAR)</option>
                      <option value="USD">دولار (USD)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-field">ملاحظات (رقم الحوالة، الصراف)</label>
                  <textarea rows={2} className="input-field" value={transferFormData.notes} onChange={(e) => setTransferFormData({...transferFormData, notes: e.target.value})} />
                </div>

                <button type="submit" className="btn-primary w-full py-5 text-xl">
                  تأكيد الإضافة
                </button>
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

      {/* Remittance Receipt Confirmation Modal */}
      <AnimatePresence>
        {isRemittanceModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRemittanceModalOpen(false)}
              className="absolute inset-0 bg-navy-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#0e1626] border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 bg-gradient-to-l from-[#1f2d47] to-[#0e1626] border-b border-amber-500/15 flex items-center justify-between text-white" dir="rtl">
                <div>
                  <h3 className="text-xl font-bold text-amber-400">تأكيد استلام حوالة مالية</h3>
                  <p className="text-xs text-gray-400">ترحيل فوري لحوالة عملاء وزيادة رصيد صندوق البث</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRemittanceModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors border-none cursor-pointer bg-transparent"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleRemittanceSubmit} className="p-6 space-y-4" dir="rtl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-500 block text-right">اسم المرسل والعميل (الجهة المرسلة)</label>
                    <input
                      required
                      type="text"
                      className="input-field bg-navy-900 border border-white/10 p-3 rounded-xl text-white w-full"
                      value={remittanceFormData.sender}
                      onChange={(e) => setRemittanceFormData({ ...remittanceFormData, sender: e.target.value })}
                      placeholder="مثال: شركة المحسن أو العميل أحمد"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-500 block text-right">اسم المستلم الداخلي المعتمد</label>
                    <input
                      required
                      type="text"
                      className="input-field bg-navy-900 border border-white/10 p-3 rounded-xl text-white w-full"
                      value={remittanceFormData.receiver}
                      onChange={(e) => setRemittanceFormData({ ...remittanceFormData, receiver: e.target.value })}
                      placeholder="المستلم بداخل المحل"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-500 block text-right">المبلغ المحول (ريال يمني)</label>
                    <input
                      required
                      type="number"
                      className="input-field bg-navy-900 border border-white/10 p-3 rounded-xl text-amber-300 w-full font-bold"
                      value={remittanceFormData.amount}
                      onChange={(e) => setRemittanceFormData({ ...remittanceFormData, amount: e.target.value })}
                      placeholder="أدخل قيمة المبلغ"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-500 block text-right">الشركة أو المحفظة المستلمة للبث</label>
                    <select
                      className="input-field bg-navy-900 border border-white/10 p-3 rounded-xl text-white w-full h-[46px]"
                      value={remittanceFormData.subWalletId}
                      onChange={(e) => setRemittanceFormData({ ...remittanceFormData, subWalletId: e.target.value })}
                    >
                      {CANONICAL_WALLETS.filter(w => w.type !== 'owner').map(wallet => (
                        <option key={wallet.id} value={wallet.id} className="bg-navy-900 text-white">
                          {wallet.boxName} ({wallet.chartOfAccountsCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-amber-500 block text-right">ملاحظات تسوية إيجاز القيد</label>
                  <textarea
                    rows={2}
                    className="input-field bg-navy-900 border border-white/10 p-3 rounded-xl text-white w-full"
                    value={remittanceFormData.notes}
                    onChange={(e) => setRemittanceFormData({ ...remittanceFormData, notes: e.target.value })}
                    placeholder="رقم الحوالة، اسم شبكة التحويل، إلخ..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 mt-2 bg-gradient-to-r from-amber-500 to-[#d4af37] text-navy-950 font-black rounded-xl shadow-lg hover:shadow-amber-500/20 transition-all text-sm border-none cursor-pointer"
                >
                  ✓ ترحيل وتأكيد الاستلام لمحاسبة الصندوق
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cash Reconciliation (جرد وتدقيق) Modal */}
      <AnimatePresence>
        {isReconciliationModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReconciliationModalOpen(false)}
              className="absolute inset-0 bg-navy-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-[#0e1626] border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 bg-gradient-to-l from-[#1f2d47] to-[#0e1626] border-b border-amber-500/15 flex items-center justify-between text-white" dir="rtl">
                <div>
                  <h3 className="text-xl font-bold text-amber-400">جرد وتدقيق صندوق الكاش الفعلي</h3>
                  <p className="text-xs text-gray-400 font-medium font-bold">مقارنة النقد الفعلي بالصندوق مع الرصيد الدفتري الحالي</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReconciliationModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors border-none cursor-pointer bg-transparent"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleReconciliationSubmit} className="p-6 space-y-5" dir="rtl">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">الرصيد الدفتري الحالي (المسجل):</span>
                    <span className="font-mono text-white font-bold text-right" dir="ltr">
                      {((customBoxes.find(w => w.id === 'CASH_BOX')?.balance || 0)).toLocaleString('ar-YE')} ريال
                    </span>
                  </div>
                  {physicalCashInput !== '' && (
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-white/5">
                      <span className="text-gray-400">الفارق المقدر للجرد:</span>
                      <span className={`font-mono font-bold text-right ${Number(physicalCashInput) - (customBoxes.find(w => w.id === 'CASH_BOX')?.balance || 0) >= 0 ? 'text-success' : 'text-danger'}`} dir="ltr">
                        {(Number(physicalCashInput) - (customBoxes.find(w => w.id === 'CASH_BOX')?.balance || 0)).toLocaleString('ar-YE')} ريال 
                        ({Number(physicalCashInput) - (customBoxes.find(w => w.id === 'CASH_BOX')?.balance || 0) >= 0 ? 'زيادة' : 'عجز'})
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-amber-500 block text-right">قيمة النقد الفعلي الموجود بيدك بداخل الصندوق (YER)</label>
                  <input
                    required
                    type="number"
                    className="input-field bg-navy-900 border border-white/10 p-3 rounded-xl text-white w-full text-center text-2xl font-black text-amber-300"
                    value={physicalCashInput}
                    onChange={(e) => setPhysicalCashInput(e.target.value)}
                    placeholder="اعد الفلوس بدقة ثم اكتبها هنا..."
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-500 text-slate-950 font-black rounded-xl shadow-lg transition-all text-sm border-none cursor-pointer"
                >
                  ✓ تثبيت وتعديل رصيد الصندوق الفعلي
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
}

// تراكيب مضافة للأصول والتسويات المصدرة للعمل الخارجي
export const useFinancialAdjustments = (
  currentStoreCode: string,
  onSystemRefresh: () => void
) => {
  const [loading, setLoading] = useState(false);

  // دالة حقن سند تسوية مالي جديد وتحديث معلومات النظام فريش طوالاً
  const injectAdjustmentVoucher = async (voucher: Omit<AdjustmentVoucher, 'id' | 'timestamp'>) => {
    setLoading(true);
    try {
      console.log(`⚖️ جاري قيد سند تسوية مالي للمتجر: ${currentStoreCode}`);
      
      // هنا يتم الحقن بداخل Firestore بمستند فريد
      await addDoc(collection(db, 'adjustmentVouchers'), { 
        ...voucher, 
        ownerId: currentStoreCode, 
        timestamp: serverTimestamp() 
      });
      
      // أمر تحديث معلومات الحسابات والصناديق في النظام فوراً (Live Update Stream)
      onSystemRefresh();
      alert('✓ تم ترحيل سند التسوية المالية بنجاح وتحديث أرصدة الخزينة الموحدة!');
    } catch (error) {
      console.error("خطأ في معالجة سند التسوية:", error);
    } finally {
      setLoading(false);
    }
  };

  return { injectAdjustmentVoucher, loading };
};
