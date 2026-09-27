import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, 
  TrendingDown, 
  Scale, 
  Plus, 
  Trash2, 
  Check, 
  Loader2, 
  Zap, 
  Search, 
  Calendar, 
  Building, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRightLeft,
  DollarSign,
  Tag,
  Paperclip,
  Camera,
  Image as ImageIcon,
  X,
  Eye,
  ShieldCheck,
  Clock,
  Briefcase,
  UploadCloud
} from 'lucide-react';
import { Account, Vault, UserProfile, VoucherAttachment } from '../types';
import { accountingService } from '../services/accountingService';
import { draftVaultService } from '../services/draftVaultService';

export interface JournalLineItem {
  accountId: string;
  accountName: string;
  accountNumber?: string;
  debit: string;
  credit: string;
  costCenter?: string;
  currency?: string;
}

export interface QuickTemplate {
  label: string;
  icon?: string;
  type: 'outflow' | 'double_entry';
  category?: string;
  note: string;
  amount?: number;
  debitAccountKeyword?: string;
  creditAccountKeyword?: string;
  costCenter?: string;
  color?: string;
}

interface UnifiedJournalVoucherProps {
  profile?: UserProfile;
  accounts: Account[];
  vaults: Vault[];
  employees?: any[];
  suppliers?: any[];
  customers?: any[];
  onSubmitOutflow?: (data: {
    amount: number;
    category: string;
    vaultId: string;
    targetAccountId?: string;
    details: string;
    reference?: string;
    date: string;
    costCenter?: string;
    status?: 'approved' | 'pending_approval';
    attachments?: VoucherAttachment[];
  }) => Promise<void>;
  onSubmitJournal?: (data: {
    note: string;
    reference: string;
    date: string;
    status?: 'approved' | 'pending_approval';
    costCenter?: string;
    attachments?: VoucherAttachment[];
    lines: {
      accountId: string;
      accountName: string;
      debit: number;
      credit: number;
      costCenter?: string;
      currency?: string;
    }[];
  }) => Promise<void>;
  isSubmitting?: boolean;
  onSuccess?: () => void;
  initialMode?: 'quick_expense' | 'double_entry';
}

const DEFAULT_COST_CENTERS = [
  'المركز الرئيسي / الإدارة العامة',
  'قسم المبيعات والتجزئة (المحل)',
  'قسم الصيانة وقطع الغيار',
  'قسم البرمجة والسيرفرات',
  'المستودع والمخزن الرئيسي',
  'خدمات التوصيل والشحن',
  'فرع المعلا / المنصورة',
  'مشروع التطوير والتحسين'
];

export const UnifiedJournalVoucher: React.FC<UnifiedJournalVoucherProps> = ({
  profile,
  accounts = [],
  vaults = [],
  employees = [],
  suppliers = [],
  customers = [],
  onSubmitOutflow,
  onSubmitJournal,
  isSubmitting: externalIsSubmitting = false,
  onSuccess,
  initialMode = 'quick_expense'
}) => {
  // Mode switcher: 'quick_expense' (خرج وصرف مباشر) or 'double_entry' (قيد مزدوج)
  const [entryMode, setEntryMode] = useState<'quick_expense' | 'double_entry'>(initialMode);

  // Approval status state: 'approved' (معتمد ومرحل) or 'pending_approval' (مسودة بانتظار الاعتماد)
  const [voucherStatus, setVoucherStatus] = useState<'approved' | 'pending_approval'>('approved');

  // Common Header fields
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [generalNote, setGeneralNote] = useState<string>('');
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('');

  // Attachments State
  const [attachments, setAttachments] = useState<VoucherAttachment[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick Expense Mode Form
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [creditVaultId, setCreditVaultId] = useState<string>(vaults[0]?.id || '');
  const [debitAccountId, setDebitAccountId] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<string>('مصاريف تشغيلية ونثرية');

  // Double Entry Mode Form
  const [journalLines, setJournalLines] = useState<JournalLineItem[]>([
    { accountId: '', accountName: '', debit: '', credit: '', costCenter: '' },
    { accountId: '', accountName: '', debit: '', credit: '', costCenter: '' }
  ]);

  // 💾 محرك استرجاع مسودة السندات المحاسبية اليومية (DraftVault)
  React.useEffect(() => {
    const restoreJournalDraft = async () => {
      const storeId = profile?.ownerId || profile?.storeId || 'default_store';
      const userId = profile?.uid || 'default_user';
      try {
        const draft = await draftVaultService.getDraft(storeId, userId, 'accounting_unified_voucher_draft');
        if (draft) {
          if (draft.entryMode) setEntryMode(draft.entryMode);
          if (draft.generalNote) setGeneralNote(draft.generalNote);
          if (draft.selectedCostCenter) setSelectedCostCenter(draft.selectedCostCenter);
          if (draft.expenseAmount) setExpenseAmount(draft.expenseAmount);
          if (draft.expenseCategory) setExpenseCategory(draft.expenseCategory);
          if (draft.creditVaultId) setCreditVaultId(draft.creditVaultId);
          if (draft.debitAccountId) setDebitAccountId(draft.debitAccountId);
          if (Array.isArray(draft.journalLines) && draft.journalLines.length > 0) {
            setJournalLines(draft.journalLines);
          }
        }
      } catch (e) {
        console.warn('Could not restore journal voucher draft:', e);
      }
    };
    restoreJournalDraft();
  }, [profile]);

  // 💾 حفظ مسودة السند الجاري كتابته لحظياً
  React.useEffect(() => {
    const storeId = profile?.ownerId || profile?.storeId || 'default_store';
    const userId = profile?.uid || 'default_user';
    const hasData = generalNote || expenseAmount || debitAccountId || journalLines.some(l => l.accountId || l.debit || l.credit);
    if (hasData) {
      draftVaultService.saveDraft(storeId, userId, 'accounting_unified_voucher_draft', {
        entryMode,
        generalNote,
        selectedCostCenter,
        expenseAmount,
        expenseCategory,
        creditVaultId,
        debitAccountId,
        journalLines,
        updatedAt: Date.now()
      });
    } else {
      draftVaultService.clearDraft(storeId, userId, 'accounting_unified_voucher_draft');
    }
  }, [entryMode, generalNote, selectedCostCenter, expenseAmount, expenseCategory, creditVaultId, debitAccountId, journalLines, profile]);

  // Account search filter states
  const [accountSearchQuery, setAccountSearchQuery] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);

  const isSubmitting = externalIsSubmitting || internalLoading;

  // Filtered accounts for search
  const filteredAccounts = useMemo(() => {
    if (!accountSearchQuery.trim()) return accounts;
    const query = accountSearchQuery.toLowerCase().trim();
    return accounts.filter(
      acc =>
        acc.accountName.toLowerCase().includes(query) ||
        (acc.accountNumber && acc.accountNumber.includes(query)) ||
        (acc.type && acc.type.toLowerCase().includes(query))
    );
  }, [accounts, accountSearchQuery]);

  // Calculations for double entry balance
  const { totalDebit, totalCredit, difference, isBalanced } = useMemo(() => {
    const d = journalLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const c = journalLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    const diff = Math.abs(d - c);
    return {
      totalDebit: d,
      totalCredit: c,
      difference: diff,
      isBalanced: diff < 0.001 && d > 0
    };
  }, [journalLines]);

  // Quick Templates library
  const quickTemplates: QuickTemplate[] = [
    {
      label: '💸 مصاريف تشغيلية ونثرية',
      type: 'outflow',
      category: 'مصاريف تشغيلية ونثرية',
      note: 'صرف مصاريف ونثريات تشغيلية يومية للمحل',
      amount: 5000,
      debitAccountKeyword: 'مصاريف',
      costCenter: 'قسم المبيعات والتجزئة (المحل)',
      color: 'hover:border-rose-500/50 text-rose-300 bg-rose-500/10'
    },
    {
      label: '👤 تصفية وسداد سلفة موظف',
      type: 'outflow',
      category: 'سلف ورواتب موظفين',
      note: 'تسليم سلفة على الحساب للموظف',
      amount: 20000,
      debitAccountKeyword: 'سلف',
      costCenter: 'المركز الرئيسي / الإدارة العامة',
      color: 'hover:border-emerald-500/50 text-emerald-300 bg-emerald-500/10'
    },
    {
      label: '🏢 إيجار وكهرباء وماء',
      type: 'outflow',
      category: 'إيجار ومرافق',
      note: 'سداد فاتورة الإيجار / خدمات الكهرباء والإنترنت',
      amount: 35000,
      debitAccountKeyword: 'إيجار',
      costCenter: 'المركز الرئيسي / الإدارة العامة',
      color: 'hover:border-amber-500/50 text-amber-300 bg-amber-500/10'
    },
    {
      label: '🛠️ قطع غيار ومستلزمات صيانة',
      type: 'outflow',
      category: 'مشتريات صيانة فورية',
      note: 'شراء أدوات وقطع صيانة عاجلة نقداً',
      amount: 15000,
      debitAccountKeyword: 'مشتريات',
      costCenter: 'قسم الصيانة وقطع الغيار',
      color: 'hover:border-sky-500/50 text-sky-300 bg-sky-500/10'
    },
    {
      label: '🚚 سداد دفعة حساب مورد',
      type: 'double_entry',
      note: 'سداد دفعة نقدية لحساب المورد المعتمد',
      amount: 50000,
      debitAccountKeyword: 'مورد',
      creditAccountKeyword: 'صندوق',
      costCenter: 'المستودع والمخزن الرئيسي',
      color: 'hover:border-indigo-500/50 text-indigo-300 bg-indigo-500/10'
    },
    {
      label: '⚖️ تسوية عجز/توالف بضاعة',
      type: 'double_entry',
      note: 'إثبات قيد تسوية تلف وفوارق جرد المخزون',
      amount: 12000,
      debitAccountKeyword: 'خسائر',
      creditAccountKeyword: 'مخزون',
      costCenter: 'المستودع والمخزن الرئيسي',
      color: 'hover:border-purple-500/50 text-purple-300 bg-purple-500/10'
    }
  ];

  // Helper to compress image client-side to ensure lightweight storage
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
            resolve(compressedBase64);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => resolve(event.target?.result as string);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle File Upload & Compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let dataUrl = '';
        if (file.type.startsWith('image/')) {
          dataUrl = await compressImage(file);
        } else {
          // Read as data url for PDF/documents
          dataUrl = await new Promise((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.readAsDataURL(file);
          });
        }

        const newAttachment: VoucherAttachment = {
          id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          type: file.type,
          dataUrl,
          size: file.size,
          uploadedAt: new Date().toISOString()
        };

        setAttachments(prev => [...prev, newAttachment]);
      }
    } catch (err) {
      console.warn("File attachment processing warning:", err);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Apply Quick Template
  const applyTemplate = (tpl: QuickTemplate) => {
    setStatusMessage(null);
    setGeneralNote(tpl.note);
    setReferenceNo(`REF-${Date.now().toString().slice(-6)}`);
    if (tpl.costCenter) setSelectedCostCenter(tpl.costCenter);

    if (tpl.type === 'outflow') {
      setEntryMode('quick_expense');
      if (tpl.amount) setExpenseAmount(tpl.amount.toString());
      if (tpl.category) setExpenseCategory(tpl.category);

      if (tpl.debitAccountKeyword) {
        const found = accounts.find(
          a =>
            a.accountName.includes(tpl.debitAccountKeyword!) ||
            (a.type === 'expense')
        );
        if (found) setDebitAccountId(found.id);
      }
    } else {
      setEntryMode('double_entry');
      const amtStr = tpl.amount ? tpl.amount.toString() : '0';

      const dAcc = accounts.find(a => tpl.debitAccountKeyword && a.accountName.includes(tpl.debitAccountKeyword)) || accounts[0];
      const cAcc = accounts.find(a => tpl.creditAccountKeyword && a.accountName.includes(tpl.creditAccountKeyword)) || accounts[1] || accounts[0];

      setJournalLines([
        { accountId: dAcc?.id || '', accountName: dAcc?.accountName || '', debit: amtStr, credit: '', costCenter: tpl.costCenter || selectedCostCenter },
        { accountId: cAcc?.id || '', accountName: cAcc?.accountName || '', debit: '', credit: amtStr, costCenter: tpl.costCenter || selectedCostCenter }
      ]);
    }
  };

  // Add line to journal
  const addJournalLine = () => {
    setJournalLines(prev => [
      ...prev,
      { accountId: '', accountName: '', debit: '', credit: '', costCenter: selectedCostCenter }
    ]);
  };

  // Remove line from journal
  const removeJournalLine = (index: number) => {
    if (journalLines.length <= 2) return;
    setJournalLines(prev => prev.filter((_, i) => i !== index));
  };

  // Handle Quick Expense Submit
  const handleQuickExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const amt = parseFloat(expenseAmount);
    if (!amt || amt <= 0) {
      setStatusMessage({ type: 'error', text: 'يرجى إدخال مبلغ صحيح للصرف (أكبر من الصفر).' });
      return;
    }

    if (!creditVaultId) {
      setStatusMessage({ type: 'error', text: 'يرجى تحديد الصندوق أو الخزينة الدائنة المسحوب منها المبلغ.' });
      return;
    }

    if (!generalNote.trim()) {
      setStatusMessage({ type: 'error', text: 'يرجى كتابة بيان وسبب الصرف بشكل واضح.' });
      return;
    }

    setInternalLoading(true);
    try {
      if (onSubmitOutflow) {
        await onSubmitOutflow({
          amount: amt,
          category: expenseCategory,
          vaultId: creditVaultId,
          targetAccountId: debitAccountId || undefined,
          details: generalNote.trim(),
          reference: referenceNo.trim() || undefined,
          date: entryDate,
          costCenter: selectedCostCenter || undefined,
          status: voucherStatus,
          attachments
        });
      } else {
        // Direct execution via accountingService
        const ownerId = profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';
        const selectedVault = vaults.find(v => v.id === creditVaultId);
        const creditAccountName = selectedVault ? selectedVault.name : 'الصندوق الرئيسي (الكاش)';
        const expenseAcc = accounts.find(a => a.id === debitAccountId);
        const debitAccountName = expenseAcc ? expenseAcc.accountName : `مصروفات - ${expenseCategory}`;

        const lines = [
          {
            accountId: debitAccountId || '5101',
            accountName: debitAccountName,
            debit: amt,
            credit: 0,
            currency: 'YER',
            exchangeRate: 1,
            baseAmount: amt,
            costCenter: selectedCostCenter || undefined
          },
          {
            accountId: creditVaultId,
            accountName: creditAccountName,
            debit: 0,
            credit: amt,
            currency: 'YER',
            exchangeRate: 1,
            baseAmount: amt,
            costCenter: selectedCostCenter || undefined
          }
        ];

        await accountingService.recordJournalEntry(
          ownerId,
          `[سند صرف خرج] ${generalNote.trim()}`,
          lines,
          referenceNo.trim() || `EXP-${Date.now().toString().slice(-6)}`,
          {
            status: voucherStatus,
            costCenter: selectedCostCenter || undefined,
            attachments,
            createdBy: {
              uid: profile?.uid || 'admin',
              name: profile?.displayName || profile?.name || 'المحاسب',
              role: profile?.role || 'محاسب'
            },
            type: 'QUICK_EXPENSE'
          }
        );
      }

      setStatusMessage({ 
        type: 'success', 
        text: voucherStatus === 'approved' 
          ? 'تم بنجاح تسجيل سند الصرف وترحيله وتحديث الأرصدة والدفاتر المالية!'
          : 'تم بنجاح حفظ سند الصرف كمسودة (بانتظار مراجعة واعتماد المشرف).'
      });
      const storeId = profile?.ownerId || profile?.storeId || 'default_store';
      const userId = profile?.uid || 'default_user';
      draftVaultService.clearDraft(storeId, userId, 'accounting_unified_voucher_draft');
      setExpenseAmount('');
      setGeneralNote('');
      setReferenceNo('');
      setAttachments([]);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'فشل في حفظ السند: ' + (err?.message || err) });
    } finally {
      setInternalLoading(false);
    }
  };

  // Handle Double Entry Submit
  const handleDoubleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!generalNote.trim()) {
      setStatusMessage({ type: 'error', text: 'يرجى كتابة البيان العام لوصف القيد المحاسبي.' });
      return;
    }

    if (!isBalanced) {
      setStatusMessage({
        type: 'error',
        text: `القيد غير متوازن! إجمالي المدين (${totalDebit.toLocaleString()}) لا يساوي إجمالي الدائن (${totalCredit.toLocaleString()}). الفارق: ${difference.toLocaleString()} ر.ي.`
      });
      return;
    }

    // Validate each line
    for (let i = 0; i < journalLines.length; i++) {
      const line = journalLines[i];
      if (!line.accountId) {
        setStatusMessage({ type: 'error', text: `يرجى اختيار الحساب للطرف رقم ${i + 1}.` });
        return;
      }
      const deb = parseFloat(line.debit) || 0;
      const cred = parseFloat(line.credit) || 0;
      if (deb === 0 && cred === 0) {
        setStatusMessage({ type: 'error', text: `الطرف رقم ${i + 1} يجب أن يحتوي على مبلغ مدين أو دائن.` });
        return;
      }
    }

    const payloadLines = journalLines.map(line => {
      const acc = accounts.find(a => a.id === line.accountId);
      const deb = parseFloat(line.debit) || 0;
      const cred = parseFloat(line.credit) || 0;
      return {
        accountId: line.accountId,
        accountName: acc?.accountName || line.accountName || 'حساب',
        debit: deb,
        credit: cred,
        costCenter: line.costCenter || selectedCostCenter || undefined,
        currency: acc?.currency || 'YER',
        exchangeRate: 1,
        baseAmount: deb > 0 ? deb : cred
      };
    });

    setInternalLoading(true);
    try {
      if (onSubmitJournal) {
        await onSubmitJournal({
          note: generalNote.trim(),
          reference: referenceNo.trim() || `JV-${Date.now().toString().slice(-6)}`,
          date: entryDate,
          status: voucherStatus,
          costCenter: selectedCostCenter || undefined,
          attachments,
          lines: payloadLines
        });
      } else {
        // Direct execution via accountingService
        const ownerId = profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';
        await accountingService.recordJournalEntry(
          ownerId,
          generalNote.trim(),
          payloadLines,
          referenceNo.trim() || `JV-${Date.now().toString().slice(-6)}`,
          {
            status: voucherStatus,
            costCenter: selectedCostCenter || undefined,
            attachments,
            createdBy: {
              uid: profile?.uid || 'admin',
              name: profile?.displayName || profile?.name || 'المحاسب',
              role: profile?.role || 'محاسب'
            },
            type: 'MANUAL_JV'
          }
        );
      }

      setStatusMessage({ 
        type: 'success', 
        text: voucherStatus === 'approved'
          ? 'تم بنجاح اعتماد وترحيل قيد اليومية المزدوج إلى سجلات الأستاذ العام.'
          : 'تم بنجاح حفظ قيد اليومية كمسودة بانتظار المراجعة والاعتماد.'
      });
      const storeId = profile?.ownerId || profile?.storeId || 'default_store';
      const userId = profile?.uid || 'default_user';
      draftVaultService.clearDraft(storeId, userId, 'accounting_unified_voucher_draft');
      setGeneralNote('');
      setReferenceNo('');
      setAttachments([]);
      setJournalLines([
        { accountId: '', accountName: '', debit: '', credit: '', costCenter: selectedCostCenter },
        { accountId: '', accountName: '', debit: '', credit: '', costCenter: selectedCostCenter }
      ]);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'فشل ترحيل القيد: ' + (err?.message || err) });
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-7 shadow-2xl space-y-6 text-right font-sans" dir="rtl">
      
      {/* 1️⃣ Header & Smart Mode Toggle Switch */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1 px-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-black">
              النموذج المحاسبي الموحد
            </span>
            <span className="p-1 px-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full text-[11px] font-bold flex items-center gap-1">
              <ShieldCheck size={12} />
              <span>رقابة وتدقيق مزدوج</span>
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 mt-2">
            <FileText className="text-amber-400" size={24} />
            <span>سند قيد وقيد خرج مباشر</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            تسجيل المصروفات والخرج السريع أو إنشاء قيود اليومية المزدوجة مع دعم مراكز التكلفة وإرفاق المستندات والاعتماد الرقابي.
          </p>
        </div>

        {/* Smart Mode Switcher Toggle */}
        <div className="bg-slate-950 p-1.5 rounded-2xl border border-white/10 flex items-center gap-1.5 shadow-inner w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              setEntryMode('quick_expense');
              setStatusMessage(null);
            }}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border-none ${
              entryMode === 'quick_expense'
                ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingDown size={16} />
            <span>💸 خرج ومصروف مباشر</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEntryMode('double_entry');
              setStatusMessage(null);
            }}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border-none ${
              entryMode === 'double_entry'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Scale size={16} />
            <span>⚖️ قيد يومية مزدوج</span>
          </button>
        </div>
      </div>

      {/* 2️⃣ Quick Operational Presets Bar */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
          <Zap size={14} className="text-amber-400 animate-pulse" />
          <span>قوالب وتوجيهات محاسبية سريعة:</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {quickTemplates.map((tpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all text-center cursor-pointer active:scale-95 border-white/10 ${tpl.color || 'bg-white/5 text-gray-300'}`}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3️⃣ Universal Header Fields: Date, Reference, Cost Center & Approval Status */}
      <div className="bg-slate-950/80 p-4 md:p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="text-xs font-black text-sky-400 flex items-center gap-2 border-b border-white/5 pb-2">
          <Layers size={14} />
          <span>بيانات التوجيه والرقابة ومراكز التكلفة</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Entry Date */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400 font-bold flex items-center gap-1">
              <Calendar size={13} className="text-sky-400" />
              <span>تاريخ العملية / السند:</span>
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl font-mono font-bold outline-none focus:border-sky-500 cursor-pointer"
            />
          </div>

          {/* Reference Number */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400 font-bold flex items-center gap-1">
              <Tag size={13} className="text-amber-400" />
              <span>الرقم المرجعي / رقم السند:</span>
            </label>
            <input
              type="text"
              placeholder="مثال: JV-2026-08-01"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 text-amber-300 p-2.5 text-xs rounded-xl font-mono font-bold outline-none focus:border-amber-500"
            />
          </div>

          {/* 3️⃣ Cost Center Engine (مراكز التكلفة) */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400 font-bold flex items-center gap-1">
              <Building size={13} className="text-purple-400" />
              <span>مركز التكلفة / الفرع / المشروع:</span>
            </label>
            <select
              value={selectedCostCenter}
              onChange={(e) => setSelectedCostCenter(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 text-purple-300 p-2.5 text-xs rounded-xl font-bold outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="">-- اختياري: حدد مركز الكلفة --</option>
              {DEFAULT_COST_CENTERS.map((cc, i) => (
                <option key={i} value={cc}>🏢 {cc}</option>
              ))}
            </select>
          </div>

          {/* 1️⃣ Approval System Switch (نظام اعتماد ومراجعة القيود) */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400 font-bold flex items-center gap-1">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>حالة اعتماد السند:</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setVoucherStatus('approved')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer border-none flex items-center justify-center gap-1 ${
                  voucherStatus === 'approved'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <CheckCircle2 size={12} />
                <span>معتمد فوراً</span>
              </button>

              <button
                type="button"
                onClick={() => setVoucherStatus('pending_approval')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer border-none flex items-center justify-center gap-1 ${
                  voucherStatus === 'pending_approval'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Clock size={12} />
                <span>مسودة / للمراجعة</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4️⃣ Document & Invoice Attachments Section */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
              <Paperclip size={13} className="text-sky-400" />
              <span>إرفاق صور المستندات والفواتير والسندات الورقية:</span>
              <span className="text-[10px] text-gray-500 font-normal">(مضغوطة ومحفوظة مع القيد)</span>
            </label>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              {isProcessingFile ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>جاري معالجة المستند...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={13} />
                  <span>رفع مستند / التقاط صورة 📸</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Attachments List / Thumbnails */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {attachments.map((att) => (
                <div 
                  key={att.id} 
                  className="group relative bg-slate-900 border border-white/10 hover:border-sky-500/40 p-1.5 rounded-xl flex items-center gap-2 shadow-md transition-all"
                >
                  {att.type.startsWith('image/') ? (
                    <img 
                      src={att.dataUrl} 
                      alt={att.name} 
                      className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80"
                      onClick={() => setPreviewModalImg(att.dataUrl)}
                    />
                  ) : (
                    <div className="w-10 h-10 bg-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center font-bold text-[10px]">
                      PDF
                    </div>
                  )}
                  <div className="max-w-[120px] text-right">
                    <span className="text-[11px] font-bold text-gray-200 block truncate">{att.name}</span>
                    <span className="text-[9px] text-gray-400 font-mono">
                      {att.size ? `${Math.round(att.size / 1024)} KB` : 'مستند'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg transition-all cursor-pointer"
                    title="حذف المرفق"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Lightbox Modal */}
      {previewModalImg && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewModalImg(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 p-2 rounded-2xl border border-white/20 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewModalImg(null)}
              className="absolute top-4 left-4 p-2 bg-rose-500 text-white rounded-full cursor-pointer hover:bg-rose-600 shadow-lg"
            >
              <X size={18} />
            </button>
            <img src={previewModalImg} alt="معاينة المستند" className="max-h-[80vh] w-auto mx-auto rounded-xl object-contain" />
          </div>
        </div>
      )}

      {/* Status Alert Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${
          statusMessage.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
        }`}>
          {statusMessage.type === 'error' ? <AlertCircle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🚀 MODE 1: QUICK EXPENSE & OUTFLOW FORM (خرج ومصروف مباشر) */}
      {/* ======================================================== */}
      {entryMode === 'quick_expense' && (
        <form onSubmit={handleQuickExpenseSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 block">
                المبلغ المصروف بالريال اليمني <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-rose-500/30 focus:border-rose-500 text-rose-400 font-mono font-black text-lg p-3 rounded-2xl text-left outline-none"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs pointer-events-none">
                  YER
                </span>
              </div>
            </div>

            {/* Credit Vault (الصندوق الدائن / المسحوب منه) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 block">
                الصندوق / الحساب الدائن (المسحوب منه) <span className="text-rose-400">*</span>
              </label>
              <select
                required
                value={creditVaultId}
                onChange={(e) => setCreditVaultId(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 text-white p-3.5 text-xs rounded-2xl font-bold outline-none focus:border-sky-500 cursor-pointer"
              >
                {vaults.map((v) => (
                  <option key={v.id} value={v.id}>
                    💰 {v.name} - الرصيد: {(v.balance || 0).toLocaleString()} ر.ي
                  </option>
                ))}
              </select>
            </div>

            {/* Expense Category / Debit Account */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-bold text-gray-300 block">
                فئة المصروف / الحساب المدين:
              </label>
              <select
                value={debitAccountId}
                onChange={(e) => setDebitAccountId(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 text-amber-300 p-3.5 text-xs rounded-2xl font-bold outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">-- تلقائي (مصروفات عمومية وتشغيلية) --</option>
                {accounts
                  .filter(a => a.type === 'expense' || a.accountNumber.startsWith('5'))
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      🏷️ {acc.accountName} ({acc.accountNumber})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Details / Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-300 block">
              البيان والسبب التفصيلي لسند الصرف <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: شراء قرطاسية وأدوات مكتبية، دفع صيانة مكيفات المحل، نقل بضائع..."
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 focus:border-sky-500 text-white p-3 text-xs rounded-2xl outline-none font-bold text-right"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs md:text-sm rounded-2xl shadow-xl shadow-rose-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 border-none active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>جاري حفظ وترحيل سند الصرف...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>
                  {voucherStatus === 'approved' 
                    ? 'اعتماد وترحيل سند الخرج فورا في الدفاتر المحاسبية' 
                    : 'حفظ سند الخرج كمسودة (بانتظار اعتماد المشرف)'}
                </span>
              </>
            )}
          </button>
        </form>
      )}

      {/* ======================================================== */}
      {/* ⚖️ MODE 2: DOUBLE ENTRY JOURNAL VOUCHER (قيد يومية مزدوج) */}
      {/* ======================================================== */}
      {entryMode === 'double_entry' && (
        <form onSubmit={handleDoubleEntrySubmit} className="space-y-5">
          
          {/* General Note */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-300 block">
              البيان العام وشرح القيد المحاسبي المزدوج <span className="text-indigo-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: إثبات تسوية حسابات الموردين، تسليم أمانات، قيود تسوية الأصول..."
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 focus:border-indigo-500 text-white p-3 text-xs rounded-2xl outline-none font-bold text-right"
            />
          </div>

          {/* Account Fast Filter / Search */}
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="تصفية الحسابات بالاسم أو رقم الحساب لتسريع الاختيار..."
              value={accountSearchQuery}
              onChange={(e) => setAccountSearchQuery(e.target.value)}
              className="w-full bg-slate-950/70 border border-white/10 text-white pr-10 pl-4 py-2 text-xs rounded-xl outline-none focus:border-sky-500 font-bold"
            />
          </div>

          {/* Dynamic Lines Table */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-gray-300 flex items-center justify-between">
              <span>أطراف القيد المحاسبي المزدوج (المدين والدائن):</span>
              <span className="text-[11px] text-gray-500">الحد الأدنى طرفان متوازنان</span>
            </div>

            {journalLines.map((line, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-slate-950/90 p-3 md:p-4 rounded-2xl border border-white/10 items-center shadow-lg transition-all"
              >
                {/* Account Selection */}
                <div className="md:col-span-5 space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold block md:hidden">حساب الدليل:</span>
                  <select
                    required
                    value={line.accountId}
                    onChange={(e) => {
                      const updated = [...journalLines];
                      const matched = accounts.find(a => a.id === e.target.value);
                      updated[idx].accountId = e.target.value;
                      updated[idx].accountName = matched ? matched.accountName : '';
                      updated[idx].accountNumber = matched ? matched.accountNumber : '';
                      setJournalLines(updated);
                    }}
                    className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs font-bold rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">-- حدد الحساب ({idx + 1}) --</option>
                    {filteredAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} ({acc.accountNumber}) - [{acc.type}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Line Cost Center */}
                <div className="md:col-span-2 space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold block md:hidden">مركز الكلفة:</span>
                  <select
                    value={line.costCenter || ''}
                    onChange={(e) => {
                      const updated = [...journalLines];
                      updated[idx].costCenter = e.target.value;
                      setJournalLines(updated);
                    }}
                    className="w-full bg-slate-900 border border-white/10 text-purple-300 p-2.5 text-xs rounded-xl outline-none cursor-pointer font-bold"
                  >
                    <option value="">-- مركز الكلفة --</option>
                    {DEFAULT_COST_CENTERS.map((cc, i) => (
                      <option key={i} value={cc}>{cc}</option>
                    ))}
                  </select>
                </div>

                {/* Debit Amount */}
                <div className="md:col-span-2 space-y-1">
                  <span className="text-[10px] text-emerald-400 font-bold block md:hidden">مدين (+):</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="مدين (+)"
                    value={line.debit}
                    onChange={(e) => {
                      const updated = [...journalLines];
                      updated[idx].debit = e.target.value;
                      if (e.target.value && parseFloat(e.target.value) > 0) {
                        updated[idx].credit = '';
                      }
                      setJournalLines(updated);
                    }}
                    className="w-full bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 p-2.5 text-xs font-mono font-black rounded-xl text-left outline-none disabled:opacity-30"
                  />
                </div>

                {/* Credit Amount */}
                <div className="md:col-span-2 space-y-1">
                  <span className="text-[10px] text-rose-400 font-bold block md:hidden">دائن (-):</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="دائن (-)"
                    value={line.credit}
                    onChange={(e) => {
                      const updated = [...journalLines];
                      updated[idx].credit = e.target.value;
                      if (e.target.value && parseFloat(e.target.value) > 0) {
                        updated[idx].debit = '';
                      }
                      setJournalLines(updated);
                    }}
                    className="w-full bg-rose-950/20 border border-rose-500/30 text-rose-400 p-2.5 text-xs font-mono font-black rounded-xl text-left outline-none disabled:opacity-30"
                  />
                </div>

                {/* Delete line */}
                <div className="md:col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => removeJournalLine(idx)}
                    disabled={journalLines.length <= 2}
                    title="حذف الطرف"
                    className="p-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl transition-all disabled:opacity-20 cursor-pointer border border-rose-500/20"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Row Button */}
          <div className="flex justify-start">
            <button
              type="button"
              onClick={addJournalLine}
              className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded-xl text-xs font-black transition-all border border-indigo-500/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>إضافة طرف جديد +</span>
            </button>
          </div>

          {/* Live Balance Checker & Equilibrium Verification */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-gray-400 font-sans text-[11px] block font-bold">إجمالي المدين:</span>
                <span className="text-emerald-400 font-black text-base md:text-lg">
                  {totalDebit.toLocaleString()} ر.ي
                </span>
              </div>

              <div className="h-8 w-px bg-white/10" />

              <div>
                <span className="text-gray-400 font-sans text-[11px] block font-bold">إجمالي الدائن:</span>
                <span className="text-rose-400 font-black text-base md:text-lg">
                  {totalCredit.toLocaleString()} ر.ي
                </span>
              </div>
            </div>

            {/* Equilibrium Alert Pill */}
            <div>
              {isBalanced ? (
                <div className="p-2.5 px-4 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl flex items-center gap-2 font-black font-sans text-xs">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>✓ القيد متوازن ومطابق</span>
                </div>
              ) : (
                <div className="p-2.5 px-4 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl flex items-center gap-2 font-black font-sans text-xs">
                  <AlertCircle size={16} className="text-rose-400" />
                  <span>⚠️ غير متوازن (الفارق: {difference.toLocaleString()} ر.ي)</span>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button with Balanced Constraint */}
          <button
            type="submit"
            disabled={!isBalanced || isSubmitting}
            className={`w-full py-3.5 rounded-2xl font-black text-xs md:text-sm shadow-xl transition-all flex items-center justify-center gap-2 border-none ${
              isBalanced && !isSubmitting
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white cursor-pointer shadow-indigo-600/20'
                : 'bg-slate-800 text-gray-500 cursor-not-allowed opacity-60'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>جاري حفظ وترحيل القيد...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>
                  {voucherStatus === 'approved' 
                    ? (isBalanced ? 'اعتماد وترحيل قيد اليومية العامة الشامل' : 'القيد غير متوازن - يجب توازن الطرفين للترحيل')
                    : 'حفظ قيد اليومية كمسودة بانتظار اعتماد المشرف'}
                </span>
              </>
            )}
          </button>
        </form>
      )}

    </div>
  );
};

export default UnifiedJournalVoucher;
