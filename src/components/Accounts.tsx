import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  writeBatch,
  increment,
  getDocs,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Account, JournalEntry, Vault } from '../types';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Layers, 
  Calendar, 
  ArrowLeftRight, 
  TrendingUp, 
  TrendingDown, 
  Check, 
  X, 
  Loader2, 
  FileSpreadsheet, 
  Info,
  DollarSign,
  Briefcase,
  Layers3,
  Eye,
  FileText,
  Filter,
  ArrowUpRight,
  Cpu,
  Zap,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  Building,
  Scale,
  Paperclip,
  Image as ImageIcon,
  Clock,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { FinancialMath } from '../utils/financialMath';
import Big from 'big.js';
import AutomatedJournalEngineDashboard from './AutomatedJournalEngineDashboard';
import LiveDisplaysAndAnalytics from './LiveDisplaysAndAnalytics';
import UnifiedJournalVoucher from './UnifiedJournalVoucher';
import FinancialAuditTrail from './accounting/FinancialAuditTrail';
import BankReconciliationView from './accounting/BankReconciliationView';
import CostCentersManager from './accounting/CostCentersManager';
import { financialAuditService } from '../services/financialAuditService';

interface AccountsProps {
  profile: UserProfile | null;
}

interface NewAccountData {
  accountNumber: string;
  accountName: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  currency: string;
}

export default function Accounts({ profile }: AccountsProps) {
  const [activeTab, setActiveTab] = useState<'automated_engine' | 'live_displays' | 'chart' | 'journal_entry' | 'ledger' | 'statement' | 'reports' | 'closing' | 'audit_trail' | 'bank_reconciliation' | 'cost_centers'>('live_displays');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'ALL' | 'approved' | 'pending_approval' | 'rejected'>('ALL');
  const [approvingEntryId, setApprovingEntryId] = useState<string | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [selectedChartCategory, setSelectedChartCategory] = useState<'all' | 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'>('all');
  
  // Year-End Closing Wizard states
  const [isClosing, setIsClosing] = useState(false);
  const [closingStep, setClosingStep] = useState(1);
  
  // Date range state
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Dynamic Add Account Modal State
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAcc, setNewAcc] = useState<NewAccountData>({
    accountNumber: '',
    accountName: '',
    type: 'asset',
    currency: 'YER'
  });
  const [isSubmittingAcc, setIsSubmittingAcc] = useState(false);

  // Account Statement States
  const [selectedStatementAccountId, setSelectedStatementAccountId] = useState('');
  const [statementTransactions, setStatementTransactions] = useState<Array<{
    date: any;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }>>([]);

  const handleApproveEntry = async (entryId: string) => {
    if (!profile?.ownerId) return;
    setApprovingEntryId(entryId);
    try {
      await financialAuditService.approveJournalEntry(profile.ownerId, entryId, {
        uid: profile.uid || 'admin',
        name: profile.displayName || profile.name || 'المشرف',
        role: profile.role || 'مشرف الحسابات'
      });
    } catch (err: any) {
      alert('فشل اعتماد القيد: ' + (err?.message || err));
    } finally {
      setApprovingEntryId(null);
    }
  };

  const handleRejectEntry = async (entryId: string) => {
    if (!profile?.ownerId) return;
    const reason = window.prompt('يرجى كتابة سبب رفض أو إلغاء هذا القيد:');
    if (reason === null) return;
    try {
      await financialAuditService.rejectJournalEntry(profile.ownerId, entryId, {
        uid: profile.uid || 'admin',
        name: profile.displayName || profile.name || 'المشرف',
        role: profile.role || 'مشرف الحسابات'
      }, reason);
    } catch (err: any) {
      alert('فشل رفض القيد: ' + (err?.message || err));
    }
  };

  // Fetch Accounts & Entries
  useEffect(() => {
    if (!profile?.ownerId) return;

    setLoading(true);
    const qAcc = query(
      collection(db, 'accounts'),
      where('ownerId', '==', profile.ownerId),
      orderBy('accountNumber', 'asc')
    );

    const unsubAcc = onSnapshot(qAcc, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      setAccounts(list);
      
      // Auto-select first account for statement if not selected
      if (list.length > 0 && !selectedStatementAccountId) {
        setSelectedStatementAccountId(list[0].id);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error loading accounts:", err);
      setAccounts([]);
      setLoading(false);
    });

    const qEntries = query(
      collection(db, 'journalEntries'),
      where('ownerId', '==', profile.ownerId),
      orderBy('date', 'desc')
    );

    const unsubEntries = onSnapshot(qEntries, (snap) => {
      setEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry)));
    }, (err) => {
      console.error("Error loading journal entries:", err);
      setEntries([]);
    });

    const qVaults = query(
      collection(db, 'vaults'),
      where('ownerId', '==', profile.ownerId)
    );

    const unsubVaults = onSnapshot(qVaults, (snap) => {
      setVaults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vault)));
    }, (err) => {
      console.error("Error loading vaults:", err);
      setVaults([]);
    });

    return () => {
      unsubAcc();
      unsubEntries();
      unsubVaults();
    };
  }, [profile?.ownerId]);

  // Handle auto calculation of statement transactions
  useEffect(() => {
    if (!selectedStatementAccountId || accounts.length === 0) {
      setStatementTransactions([]);
      return;
    }

    const selectedAccObj = accounts.find(a => a.id === selectedStatementAccountId);
    if (!selectedAccObj) return;

    // Filter journal entries that affect this account
    const affected: Array<{ date: any; description: string; debit: number; credit: number }> = [];

    entries.forEach(entry => {
      if (!entry.items) return;
      entry.items.forEach(item => {
        // Match either by accountId or matching accountName
        if (item.accountId === selectedStatementAccountId || item.accountName === selectedAccObj.accountName) {
          affected.push({
            date: entry.date,
            description: entry.description || 'قيد محاسبي تفصيلي',
            debit: Number(item.debit || 0),
            credit: Number(item.credit || 0)
          });
        }
      });
    });

    // Sort chronologically (oldest first) to compute running balance
    const sorted = [...affected].sort((a, b) => {
      const aTime = a.date?.seconds || 0;
      const bTime = b.date?.seconds || 0;
      return aTime - bTime;
    });

    let balance = 0;
    const computed = sorted.map(tx => {
      if (selectedAccObj.type === 'asset' || selectedAccObj.type === 'expense') {
        balance += (tx.debit - tx.credit);
      } else {
        balance += (tx.credit - tx.debit);
      }
      return {
        ...tx,
        runningBalance: balance
      };
    }).reverse(); // Display newest first in statement UI

    setStatementTransactions(computed);
  }, [selectedStatementAccountId, entries, accounts]);

  // Create new Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    if (!newAcc.accountNumber || !newAcc.accountName) {
      alert("الرجاء تعبئة كافة الحقول المطلوبة.");
      return;
    }

    // Check unique account number
    const numExists = accounts.some(a => a.accountNumber === newAcc.accountNumber);
    if (numExists) {
      alert("رقم الحساب هذا مسجل مسبقاً! الرجاء اختيار رقم فريد.");
      return;
    }

    setIsSubmittingAcc(true);
    try {
      await addDoc(collection(db, 'accounts'), {
        ownerId: profile.ownerId,
        accountNumber: newAcc.accountNumber,
        accountName: newAcc.accountName,
        type: newAcc.type,
        balance: 0,
        currency: newAcc.currency,
        createdAt: serverTimestamp()
      });
      setIsAddAccountOpen(false);
      setNewAcc({ accountNumber: '', accountName: '', type: 'asset', currency: 'YER' });
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ الحساب الجديد.");
    } finally {
      setIsSubmittingAcc(false);
    }
  };

  // Year End Closing Handler
  const handleCloseFiscalYear = async () => {
    if (!profile?.ownerId) return;
    setIsClosing(true);
    try {
      const batch = writeBatch(db);

      // 1. Calculate Net Profit
      let totalRev = 0;
      let totalExp = 0;
      accounts.forEach(acc => {
        if (acc.type === 'revenue') totalRev += (acc.balance || 0);
        if (acc.type === 'expense') totalExp += (acc.balance || 0);
      });
      const calculatedNetProfit = totalRev - totalExp;

      // 2. Locate Retained Earnings Account
      let retainedEarningsAcc = accounts.find(a => a.accountNumber === '3100' || a.accountName.includes('الأرباح المحتجزة'));
      let retainedEarningsRef;

      if (retainedEarningsAcc) {
        retainedEarningsRef = doc(db, 'accounts', retainedEarningsAcc.id);
        batch.update(retainedEarningsRef, { balance: increment(calculatedNetProfit) });
      } else {
        const newAccRef = doc(collection(db, 'accounts'));
        retainedEarningsRef = newAccRef;
        batch.set(newAccRef, {
          ownerId: profile.ownerId,
          accountNumber: '3100',
          accountName: 'الأرباح والخسائر المدورة والمحتجزة',
          type: 'equity',
          balance: calculatedNetProfit,
          currency: 'YER',
          createdAt: serverTimestamp()
        });
      }

      // 3. Post the closing journal entry voucher
      const journalRef = doc(collection(db, 'journalEntries'));
      const closingItems = [
        {
          accountId: retainedEarningsAcc ? retainedEarningsAcc.id : retainedEarningsRef.id,
          accountName: 'الأرباح والخسائر المدورة والمحتجزة',
          debit: calculatedNetProfit < 0 ? Math.abs(calculatedNetProfit) : 0,
          credit: calculatedNetProfit >= 0 ? calculatedNetProfit : 0,
          currency: 'YER'
        }
      ];

      // Zero out revenues and expenses in Firestore & prepare their balancing journal entries
      accounts.forEach(acc => {
        if (acc.type === 'revenue' || acc.type === 'expense') {
          const accRef = doc(db, 'accounts', acc.id);
          batch.update(accRef, { balance: 0 });

          if (acc.balance !== 0) {
            closingItems.push({
              accountId: acc.id,
              accountName: acc.accountName,
              debit: acc.type === 'revenue' ? acc.balance : 0,
              credit: acc.type === 'expense' ? acc.balance : 0,
              currency: acc.currency || 'YER'
            });
          }
        }
      });

      batch.set(journalRef, {
        ownerId: profile.ownerId,
        date: serverTimestamp(),
        description: `قيد إقفال وتدوير الحسابات الختامية المؤقتة وتصفير الدفاتر للعام المالي ${new Date().getFullYear()}`,
        reference: `YE-CLOSE-${new Date().getFullYear()}`,
        items: closingItems,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      setClosingStep(4); // Success step
    } catch (err) {
      console.error(err);
      alert('حدث خطأ غير متوقع أثناء تدوير وإقفال السنة المالية القديمة.');
    } finally {
      setIsClosing(false);
    }
  };

  // Calculations for Reports
  const accountsByType = (type: string) => accounts.filter(a => a.type === type);
  
  const totalAssets = accountsByType('asset').reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalLiabilities = accountsByType('liability').reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalRevenues = accountsByType('revenue').reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalExpenses = accountsByType('expense').reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalEquity = accountsByType('equity').reduce((sum, a) => sum + (a.balance || 0), 0);
  const netProfit = totalRevenues - totalExpenses;

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = (acc.accountName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (acc.accountNumber || '').includes(searchTerm);
    const matchesCategory = selectedChartCategory === 'all' || acc.type === selectedChartCategory;
    return matchesSearch && matchesCategory;
  });

  const handlePrintAccountStatement = () => {
    if (!selectedStatementAccountId) return;
    const currentAcc = accounts.find(a => a.id === selectedStatementAccountId);
    if (!currentAcc) return;

    const todayStr = new Date().toLocaleDateString('ar-YE');
    const timeStr = new Date().toLocaleTimeString('ar-YE');
    const totalDebits = statementTransactions.reduce((sum, tx) => sum + tx.debit, 0);
    const totalCredits = statementTransactions.reduce((sum, tx) => sum + tx.credit, 0);

    const pageCss = `
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      @media print {
        body {
          visibility: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        #printableArea, #printableArea * {
          visibility: visible !important;
        }
        #printableArea {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 16px !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        .no-print, aside, header, footer, button, nav, .sidebar {
          display: none !important;
        }
      }
    `;

    const contentHtml = `
      <div style="font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; max-width: 800px; margin: 0 auto; padding: 15px; color: #000000; background: #ffffff;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="font-size: 22px; font-weight: 900; margin: 0 0 4px 0; color: #0f172a;">JAM SYSTEM PRO</h1>
            <p style="font-size: 14px; font-weight: bold; margin: 0; color: #475569;">كشف حساب تفصيلي وحركات الدفتر العام</p>
          </div>
          <div style="text-align: left; font-size: 11px; color: #475569; line-height: 1.5;">
            <div>تاريخ الإصدار: <b>${todayStr}</b></div>
            <div>الوقت: <b>${timeStr}</b></div>
            <div>العملة: <b>${currentAcc.currency || 'YER'}</b></div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 16px; font-weight: 900; color: #0f172a;">
              الحساب: ${currentAcc.accountName} <span style="font-family: monospace; font-size: 13px; color: #0284c7;">(${currentAcc.accountNumber})</span>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              التصنيف: ${currentAcc.type === 'asset' ? 'أصل' : currentAcc.type === 'liability' ? 'التزام' : currentAcc.type === 'revenue' ? 'إيراد' : currentAcc.type === 'expense' ? 'مصروف' : 'حقوق ملكية'}
            </div>
          </div>
          <div style="display: flex; gap: 15px; text-align: center;">
            <div>
              <div style="font-size: 10px; color: #64748b;">مجموع المدين (+)</div>
              <div style="font-size: 13px; font-weight: 900; color: #15803d; font-family: monospace;">${totalDebits.toLocaleString()}</div>
            </div>
            <div>
              <div style="font-size: 10px; color: #64748b;">مجموع الدائن (-)</div>
              <div style="font-size: 13px; font-weight: 900; color: #b91c1c; font-family: monospace;">${totalCredits.toLocaleString()}</div>
            </div>
            <div style="border-right: 1px solid #cbd5e1; padding-right: 15px;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">الرصيد النهائي</div>
              <div style="font-size: 16px; font-weight: 900; color: ${(currentAcc.balance || 0) >= 0 ? '#15803d' : '#b91c1c'}; font-family: monospace;">
                ${(currentAcc.balance || 0).toLocaleString()} ${currentAcc.currency || 'YER'}
              </div>
            </div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px 10px; text-align: right; font-weight: 900;">التاريخ</th>
              <th style="padding: 8px 10px; text-align: right; font-weight: 900;">البيان والوصف التفصيلي</th>
              <th style="padding: 8px 10px; text-align: left; font-weight: 900; color: #15803d;">مدين (+)</th>
              <th style="padding: 8px 10px; text-align: left; font-weight: 900; color: #b91c1c;">دائن (-)</th>
              <th style="padding: 8px 10px; text-align: left; font-weight: 900; color: #0284c7;">الرصيد المتراكم</th>
            </tr>
          </thead>
          <tbody>
            ${statementTransactions.length === 0 ? `
              <tr>
                <td colspan="5" style="padding: 20px; text-align: center; color: #64748b; font-weight: bold; border-bottom: 1px solid #e2e8f0;">
                  لا توجد قيود أو حركات سابقة مسجلة على هذا الحساب المحاسبي.
                </td>
              </tr>
            ` : statementTransactions.map((tx) => {
              const dStr = tx.date ? (typeof tx.date.toDate === 'function' ? format(tx.date.toDate(), 'yyyy/MM/dd HH:mm') : 'تاريخ موثق') : 'مؤقت';
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 10px; font-family: monospace;">${dStr}</td>
                  <td style="padding: 8px 10px; font-weight: bold;">${tx.description || '—'}</td>
                  <td style="padding: 8px 10px; text-align: left; font-family: monospace; font-weight: bold; color: #15803d;">${tx.debit > 0 ? tx.debit.toLocaleString() : '—'}</td>
                  <td style="padding: 8px 10px; text-align: left; font-family: monospace; font-weight: bold; color: #b91c1c;">${tx.credit > 0 ? tx.credit.toLocaleString() : '—'}</td>
                  <td style="padding: 8px 10px; text-align: left; font-family: monospace; font-weight: bold; color: ${tx.runningBalance >= 0 ? '#15803d' : '#b91c1c'};">${tx.runningBalance.toLocaleString()}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
          <div style="text-align: center; width: 180px;">
            <div>ختم وتوقيع الإدارة المالية</div>
            <div style="margin-top: 40px; border-bottom: 1px dashed #94a3b8;"></div>
          </div>
          <div style="text-align: center; width: 180px;">
            <div>توقيع المستلم / المحاسب</div>
            <div style="margin-top: 40px; border-bottom: 1px dashed #94a3b8;"></div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px;">
          نظام JAM System Pro لإدارة الحسابات العامة | م. عبد الغني المحفلي (772315106)
        </div>
      </div>
    `;

    // Inject into printableArea
    let printArea = document.getElementById('printableArea');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'printableArea';
      printArea.className = 'printableArea';
      document.body.appendChild(printArea);
    }
    printArea.innerHTML = `
      <style>${pageCss}</style>
      ${contentHtml}
    `;

    // Hidden iframe setup
    let iframe = document.getElementById('jam-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'jam-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '800px';
      iframe.style.height = '1000px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0.01';
      iframe.style.zIndex = '-999';
      document.body.appendChild(iframe);
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>كشف حساب - ${currentAcc.accountName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;700;900&display=swap');
            ${pageCss}
            body {
              visibility: visible !important;
              margin: 0;
              padding: 15px;
              background: #ffffff;
              color: #000000;
              direction: rtl;
            }
            .no-print { display: none !important; }
          </style>
        </head>
        <body>
          <div id="printableArea">
            ${contentHtml}
          </div>
        </body>
      </html>
    `;

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(fullHtml);
      iframeDoc.close();
    }

    const isAndroidOrApp = typeof window !== 'undefined' && 
      (navigator.userAgent.includes('Android') || (window as any).Capacitor?.isNativePlatform?.() || !!(window as any).Android);

    if (isAndroidOrApp) {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 150);
    } else {
      setTimeout(() => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } else {
            window.focus();
            window.print();
          }
        } catch (e) {
          console.warn('Iframe print failed, falling back to window.print():', e);
          window.focus();
          window.print();
        }
      }, 200);
    }
  };

  return (
    <div className="space-y-6 dir-rtl" dir="rtl">
      {/* Upper Dashboard Header Card - Phase 1 Upgraded Reports-Style Glass Design */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-navy-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-2xl border border-white/10 dark:border-white/10">
        {/* Glowing Background Decorative Gradients */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none translate-x-1/2 translate-y-1/2" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1 px-3 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-full text-xs font-black tracking-wide flex items-center gap-1.5">
                <Briefcase size={14} />
                المنظومة المحاسبية الموحدة
              </span>
              <span className="p-1 px-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[11px] font-bold">
                ربط شامل مع المبيعات والمشتريات والخزائن
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white flex items-center gap-3">
              <span>منظومة الحسابات والدفاتر العامة</span>
              <span className="text-2xl">📖</span>
            </h1>
            <p className="text-gray-300 dark:text-gray-400 text-xs md:text-sm font-medium leading-relaxed max-w-2xl">
              إدارة الدليل المحاسبي الشامل، ترحيل القيود المزدوجة، متابعة أرصدة الحسابات والتسويات، واستخراج التقارير والميزانية العمومية بدقة عالية.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              type="button"
              onClick={() => setIsAddAccountOpen(true)}
              className="flex-1 md:flex-none p-3.5 px-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-sky-500/20 transition-all active:scale-95 cursor-pointer border-none"
            >
              <Plus size={18} />
              <span>تأسيس حساب جديد</span>
            </button>
          </div>
        </div>

        {/* Dynamic Financial Highlights - Live Database Aggregates (0% Mock Data) */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 border-t border-white/10 pt-6">
          <div className="bg-white/5 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-sky-500/30 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-300 font-bold">إجمالي الأصول والسيولة</span>
              <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg">
                <DollarSign size={16} />
              </div>
            </div>
            <span className="text-xl md:text-2xl font-black text-sky-400 block font-mono">
              {totalAssets.toLocaleString()} YER
            </span>
            <span className="text-[10px] text-gray-400 block mt-1">حسابات الأصول والخزائن والذمم المدينة</span>
          </div>

          <div className="bg-white/5 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-300 font-bold">إجمالي الخصوم والالتزامات</span>
              <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                <TrendingDown size={16} />
              </div>
            </div>
            <span className="text-xl md:text-2xl font-black text-amber-400 block font-mono">
              {totalLiabilities.toLocaleString()} YER
            </span>
            <span className="text-[10px] text-gray-400 block mt-1">المستحقات والالتزامات والدائنون</span>
          </div>

          <div className="bg-white/5 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-300 font-bold">إيرادات النشاط والخدمات</span>
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <TrendingUp size={16} />
              </div>
            </div>
            <span className="text-xl md:text-2xl font-black text-emerald-400 block font-mono">
              {totalRevenues.toLocaleString()} YER
            </span>
            <span className="text-[10px] text-gray-400 block mt-1">المبيعات والإيرادات الدفترية الموثقة</span>
          </div>

          <div className="bg-white/5 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-300 font-bold">صافي الأرباح التشغيلية</span>
              <div className={`p-1.5 rounded-lg ${netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                <FileSpreadsheet size={16} />
              </div>
            </div>
            <span className={`text-xl md:text-2xl font-black block font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netProfit.toLocaleString()} YER
            </span>
            <span className="text-[10px] text-gray-400 block mt-1">فارق الإيرادات ناقص المصروفات</span>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs - Phase 1 Reports-Style Navigation Bar */}
      <div className="flex bg-slate-900/80 dark:bg-navy-950/90 backdrop-blur-xl border border-white/10 p-2 rounded-2xl flex-nowrap overflow-x-auto gap-2 shadow-xl scrollbar-none">
        <button // Tab Live Displays: Unified Displays & Analytics
          onClick={() => setActiveTab('live_displays')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'live_displays' 
              ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20' 
              : 'text-emerald-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <BarChart3 size={16} className={activeTab === 'live_displays' ? 'text-slate-950' : 'text-emerald-400'} />
          <span>الشاشات الحية والتقارير</span>
        </button>

        <button // Tab 0: Automated Journal Vouchers Engine
          onClick={() => setActiveTab('automated_engine')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'automated_engine' 
              ? 'bg-gradient-to-r from-indigo-500 via-purple-600 to-sky-500 text-white font-black shadow-lg shadow-indigo-500/20' 
              : 'text-indigo-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Cpu size={16} className={activeTab === 'automated_engine' ? 'text-white' : 'text-indigo-400'} />
          <span>محرك الإسناد الآلي والأرصدة</span>
        </button>

        <button // Tab 1: Chart of Accounts
          onClick={() => setActiveTab('chart')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'chart' 
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-slate-950 font-black shadow-lg shadow-sky-500/20' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers3 size={16} />
          <span>شجرة دليل الحسابات</span>
        </button>

        <button // Tab 2: Journal Voucher Entry
          onClick={() => setActiveTab('journal_entry')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'journal_entry' 
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-slate-950 font-black shadow-lg shadow-sky-500/20' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Plus size={16} />
          <span>إنشاء قيد مزدوج</span>
        </button>

        <button // Tab 3: Journal entries list (General ledger entries)
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'ledger' 
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-slate-950 font-black shadow-lg shadow-sky-500/20' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <BookOpen size={16} />
          <span>دفتر اليومية العامة</span>
        </button>

        <button // Tab 4: Account state detailed sheet
          onClick={() => setActiveTab('statement')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'statement' 
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-slate-950 font-black shadow-lg shadow-sky-500/20' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <ArrowLeftRight size={16} />
          <span>كشف حساب تفصيلي</span>
        </button>

        <button // Tab 5: Balances and accounting health checks
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'reports' 
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-slate-950 font-black shadow-lg shadow-sky-500/20' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileSpreadsheet size={16} />
          <span>ميزان المراجعة والأرباح</span>
        </button>

        <button // Tab 6: Financial Year End Closing Wizard
          onClick={() => setActiveTab('closing')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'closing' 
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Calendar size={16} className={activeTab === 'closing' ? 'text-slate-950' : 'text-amber-400'} />
          <span>إقفال السنة المالية</span>
        </button>

        <button // Tab 7: Audit Trail Log
          onClick={() => setActiveTab('audit_trail')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'audit_trail' 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck size={16} className={activeTab === 'audit_trail' ? 'text-slate-950' : 'text-emerald-400'} />
          <span>سجل الرقابة والتدقيق</span>
        </button>

        <button // Tab 8: Bank Reconciliation
          onClick={() => setActiveTab('bank_reconciliation')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'bank_reconciliation' 
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black shadow-lg shadow-indigo-500/20' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Scale size={16} className={activeTab === 'bank_reconciliation' ? 'text-white' : 'text-indigo-400'} />
          <span>التسوية والمطابقة البنكية</span>
        </button>

        <button // Tab 9: Cost Centers & Projects
          onClick={() => setActiveTab('cost_centers')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all select-none cursor-pointer border-none ${
            activeTab === 'cost_centers' 
              ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black shadow-lg shadow-purple-500/20' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Building size={16} className={activeTab === 'cost_centers' ? 'text-white' : 'text-purple-400'} />
          <span>مراكز التكلفة والمشاريع</span>
        </button>
      </div>

      {/* TAB PANEL CONTENT */}
      <AnimatePresence mode="wait">
        
        {/* TAB LIVE: Live Displays & Analytics */}
        {activeTab === 'live_displays' && (
          <motion.div
            key="live_displays"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <LiveDisplaysAndAnalytics profile={profile} accounts={accounts} entries={entries} />
          </motion.div>
        )}

        {/* TAB 0: Automated Journal Engine Dashboard */}
        {activeTab === 'automated_engine' && (
          <motion.div
            key="automated_engine"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <AutomatedJournalEngineDashboard profile={profile} />
          </motion.div>
        )}

        {/* TAB 1: Chart of accounts - Phase 2 Upgraded Glass Design */}
        {activeTab === 'chart' && (
          <motion.div 
            key="chart"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Phase 2: Fundamental 5 Accounting Pillar Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Asset Card */}
              <button
                type="button"
                onClick={() => setSelectedChartCategory(selectedChartCategory === 'asset' ? 'all' : 'asset')}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer select-none ${
                  selectedChartCategory === 'asset'
                    ? 'bg-gradient-to-br from-sky-500/20 via-blue-600/10 to-slate-900 border-sky-500 shadow-lg shadow-sky-500/10 scale-[1.02]'
                    : 'bg-slate-900/60 hover:bg-slate-900 border-white/10 hover:border-sky-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-sky-400">1. الأصول (Assets)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold">
                    {accountsByType('asset').length} حساب
                  </span>
                </div>
                <div className="text-lg font-black text-white font-mono">
                  {totalAssets.toLocaleString()} YER
                </div>
                <span className="text-[10px] text-gray-400 block mt-1">الخزائن، البنوك، والذمم المدينة</span>
              </button>

              {/* Liability Card */}
              <button
                type="button"
                onClick={() => setSelectedChartCategory(selectedChartCategory === 'liability' ? 'all' : 'liability')}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer select-none ${
                  selectedChartCategory === 'liability'
                    ? 'bg-gradient-to-br from-amber-500/20 via-orange-600/10 to-slate-900 border-amber-500 shadow-lg shadow-amber-500/10 scale-[1.02]'
                    : 'bg-slate-900/60 hover:bg-slate-900 border-white/10 hover:border-amber-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-amber-400">2. الخصوم (Liabilities)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                    {accountsByType('liability').length} حساب
                  </span>
                </div>
                <div className="text-lg font-black text-white font-mono">
                  {totalLiabilities.toLocaleString()} YER
                </div>
                <span className="text-[10px] text-gray-400 block mt-1">الموردون والالتزامات المستحقة</span>
              </button>

              {/* Equity Card */}
              <button
                type="button"
                onClick={() => setSelectedChartCategory(selectedChartCategory === 'equity' ? 'all' : 'equity')}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer select-none ${
                  selectedChartCategory === 'equity'
                    ? 'bg-gradient-to-br from-purple-500/20 via-indigo-600/10 to-slate-900 border-purple-500 shadow-lg shadow-purple-500/10 scale-[1.02]'
                    : 'bg-slate-900/60 hover:bg-slate-900 border-white/10 hover:border-purple-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-purple-400">3. حقوق الملكية (Equity)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                    {accountsByType('equity').length} حساب
                  </span>
                </div>
                <div className="text-lg font-black text-white font-mono">
                  {totalEquity.toLocaleString()} YER
                </div>
                <span className="text-[10px] text-gray-400 block mt-1">رأس المال والأرباح المبقاة</span>
              </button>

              {/* Revenue Card */}
              <button
                type="button"
                onClick={() => setSelectedChartCategory(selectedChartCategory === 'revenue' ? 'all' : 'revenue')}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer select-none ${
                  selectedChartCategory === 'revenue'
                    ? 'bg-gradient-to-br from-emerald-500/20 via-teal-600/10 to-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/10 scale-[1.02]'
                    : 'bg-slate-900/60 hover:bg-slate-900 border-white/10 hover:border-emerald-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-emerald-400">4. الإيرادات (Revenues)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                    {accountsByType('revenue').length} حساب
                  </span>
                </div>
                <div className="text-lg font-black text-white font-mono">
                  {totalRevenues.toLocaleString()} YER
                </div>
                <span className="text-[10px] text-gray-400 block mt-1">مبيعات المنتجات والخدمات</span>
              </button>

              {/* Expense Card */}
              <button
                type="button"
                onClick={() => setSelectedChartCategory(selectedChartCategory === 'expense' ? 'all' : 'expense')}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer select-none col-span-2 md:col-span-1 ${
                  selectedChartCategory === 'expense'
                    ? 'bg-gradient-to-br from-rose-500/20 via-red-600/10 to-slate-900 border-rose-500 shadow-lg shadow-rose-500/10 scale-[1.02]'
                    : 'bg-slate-900/60 hover:bg-slate-900 border-white/10 hover:border-rose-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-rose-400">5. المصروفات (Expenses)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                    {accountsByType('expense').length} حساب
                  </span>
                </div>
                <div className="text-lg font-black text-white font-mono">
                  {totalExpenses.toLocaleString()} YER
                </div>
                <span className="text-[10px] text-gray-400 block mt-1">مصاريف التشغيل والإيجارات</span>
              </button>
            </div>

            {/* Filter Pills & Search Control Bar */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                {/* Search Field */}
                <div className="relative flex-1">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-400" size={18} />
                  <input 
                    type="text"
                    placeholder="ابحث برقم الحساب أو اسم الحساب الدفتري التفصيلي..."
                    className="w-full text-right p-3.5 pr-11 bg-slate-950/80 border border-white/10 rounded-2xl text-xs md:text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-sky-500/50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                  {[
                    { id: 'all', label: 'كافة الحسابات', count: accounts.length },
                    { id: 'asset', label: 'الأصول', count: accountsByType('asset').length },
                    { id: 'liability', label: 'الخصوم', count: accountsByType('liability').length },
                    { id: 'equity', label: 'حقوق الملكية', count: accountsByType('equity').length },
                    { id: 'revenue', label: 'الإيرادات', count: accountsByType('revenue').length },
                    { id: 'expense', label: 'المصروفات', count: accountsByType('expense').length },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedChartCategory(tab.id as any)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer border-none ${
                        selectedChartCategory === tab.id
                          ? 'bg-sky-500 text-slate-950 font-black shadow-md shadow-sky-500/20'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        selectedChartCategory === tab.id ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-gray-400'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Counter indicator */}
                <div className="text-xs text-gray-300 bg-white/5 p-2.5 px-4 rounded-2xl border border-white/10 select-none text-center whitespace-nowrap">
                  مطابق للفلتر: <span className="text-sky-400 font-black font-mono text-sm">{filteredAccounts.length}</span> / {accounts.length}
                </div>
              </div>
            </div>

            {/* Accounts Table - Phase 2 Glass Design */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm leading-normal">
                  <thead className="bg-slate-950/80 text-[11px] font-black text-gray-400 uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4">رمز الحساب</th>
                      <th className="px-6 py-4">اسم الحساب الدفتري</th>
                      <th className="px-6 py-4">التصنيف الرئيسي</th>
                      <th className="px-6 py-4">مستوى الحساب</th>
                      <th className="px-6 py-4">العملة الأساسية</th>
                      <th className="px-6 py-4">الرصيد الدفتري الحالي</th>
                      <th className="px-6 py-4 text-center">الإجراءات السريعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-400" />
                          <span className="text-xs text-gray-400 block mt-2">جاري تحميل دليلك المحاسبي الشامل...</span>
                        </td>
                      </tr>
                    ) : filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="max-w-xs mx-auto space-y-3">
                            <Filter className="w-10 h-10 text-gray-500 mx-auto opacity-50" />
                            <p className="text-sm font-bold text-gray-300">لا توجد حسابات مطابقة لبحثك في الدفاتر الحالية.</p>
                            <p className="text-xs text-gray-500">جرب البحث بكلمة أخرى أو تغيير الفلتر المالي.</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredAccounts.map((acc) => {
                      // Calculate depth level based on account code length
                      const codeLength = (acc.accountNumber || '').length;
                      const levelName = codeLength <= 1 ? 'مستوى 1 (رئيسي)' : codeLength <= 2 ? 'مستوى 2 (فرعي)' : `مستوى ${codeLength - 1} (تفصيلي)`;

                      return (
                        <tr key={acc.id} className="hover:bg-white/[0.03] transition-colors group">
                          {/* Account Code */}
                          <td className="px-6 py-4 font-mono font-black text-sky-400 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg group-hover:bg-sky-500 group-hover:text-slate-950 transition-all">
                                <Layers size={14} />
                              </span>
                              <span>{acc.accountNumber}</span>
                            </div>
                          </td>

                          {/* Account Name */}
                          <td className="px-6 py-4 font-bold text-white group-hover:text-sky-300 transition-colors">
                            {acc.accountName}
                          </td>

                          {/* Account Category */}
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[11px] font-black border inline-flex items-center gap-1.5 ${
                              acc.type === 'asset' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                              acc.type === 'liability' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                              acc.type === 'revenue' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                              acc.type === 'expense' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                              'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            }`}>
                              {acc.type === 'asset' ? 'أصل متداول / ثابت' :
                               acc.type === 'liability' ? 'التزام وخصم' :
                               acc.type === 'revenue' ? 'إيرادات مبيعات' :
                               acc.type === 'expense' ? 'مصروفات تشغيلية' : 'حقوق الملكية ورأس المال'}
                            </span>
                          </td>

                          {/* Level */}
                          <td className="px-6 py-4 text-xs font-bold text-gray-400">
                            <span className="px-2.5 py-1 bg-white/5 rounded-lg border border-white/5 font-mono">
                              {levelName}
                            </span>
                          </td>

                          {/* Currency */}
                          <td className="px-6 py-4 font-bold text-gray-300 font-mono">
                            {acc.currency || 'YER'}
                          </td>

                          {/* Balance */}
                          <td className="px-6 py-4">
                            <span className={`font-mono font-black text-base block ${acc.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {acc.balance.toLocaleString()} {acc.currency || 'YER'}
                            </span>
                          </td>

                          {/* Quick Actions */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                title="عرض كشف الحساب التفصيلي"
                                onClick={() => {
                                  setSelectedStatementAccountId(acc.id);
                                  setActiveTab('statement');
                                }}
                                className="p-2 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer border border-sky-500/20 flex items-center gap-1 text-xs font-bold"
                              >
                                <FileText size={14} />
                                <span className="hidden sm:inline">الكشف</span>
                              </button>

                              <button
                                type="button"
                                title="إضافة قيد محاسبي مباشر لهذا الحساب"
                                onClick={() => {
                                  setActiveTab('journal_entry');
                                }}
                                className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer border border-emerald-500/20 flex items-center gap-1 text-xs font-bold"
                              >
                                <Plus size={14} />
                                <span className="hidden sm:inline">قيد</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: Unified Journal & Outflow Voucher Component */}
        {activeTab === 'journal_entry' && (
          <motion.div 
            key="journal_entry"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <UnifiedJournalVoucher
              profile={profile}
              accounts={accounts}
              vaults={vaults}
              onSuccess={() => {
                setActiveTab('ledger');
              }}
            />
          </motion.div>
        )}

        {/* TAB 3: General ledger journal entries history - Phase 4 Upgraded Glass Design */}
        {activeTab === 'ledger' && (
          <motion.div 
            key="ledger"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Filter controls & Summary Bar */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                {/* Date range pickers */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-950/80 p-2 px-3.5 rounded-2xl border border-white/10 text-xs">
                    <Calendar size={16} className="text-sky-400" />
                    <span className="text-gray-400 font-bold">من:</span>
                    <input 
                      type="date" 
                      className="bg-transparent text-white outline-none font-bold font-mono text-xs cursor-pointer"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950/80 p-2 px-3.5 rounded-2xl border border-white/10 text-xs">
                    <Calendar size={16} className="text-emerald-400" />
                    <span className="text-gray-400 font-bold">إلى:</span>
                    <input 
                      type="date" 
                      className="bg-transparent text-white outline-none font-bold font-mono text-xs cursor-pointer"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                    />
                  </div>
                  {(dateRange.start || dateRange.end) && (
                    <button 
                      onClick={() => setDateRange({ start: '', end: '' })}
                      className="text-xs text-sky-400 hover:text-sky-300 font-bold underline px-2 cursor-pointer"
                    >
                      عرض كافة التواريخ
                    </button>
                  )}
                </div>

                {/* Status Filter Buttons */}
                <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setLedgerStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border-none text-[11px] ${
                      ledgerStatusFilter === 'ALL'
                        ? 'bg-sky-500 text-slate-950 font-black shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerStatusFilter('approved')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border-none text-[11px] flex items-center gap-1 ${
                      ledgerStatusFilter === 'approved'
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                        : 'text-gray-400 hover:text-emerald-400'
                    }`}
                  >
                    <CheckCircle2 size={12} />
                    <span>معتمد فقط</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerStatusFilter('pending_approval')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border-none text-[11px] flex items-center gap-1 ${
                      ledgerStatusFilter === 'pending_approval'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'text-gray-400 hover:text-amber-400'
                    }`}
                  >
                    <Clock size={12} />
                    <span>بانتظار الاعتماد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerStatusFilter('rejected')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border-none text-[11px] flex items-center gap-1 ${
                      ledgerStatusFilter === 'rejected'
                        ? 'bg-rose-500 text-slate-950 font-black shadow-md'
                        : 'text-gray-400 hover:text-rose-400'
                    }`}
                  >
                    <X size={12} />
                    <span>مرفوض</span>
                  </button>
                </div>

                {/* Search in General Ledger */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-400" size={18} />
                  <input 
                    type="text"
                    placeholder="ابحث برقم القيد، البيان، المرجع، مركز التكلفة، أو الحساب..."
                    className="w-full text-right p-3 pr-11 bg-slate-950/80 border border-white/10 rounded-2xl text-xs md:text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-sky-500/50 font-bold"
                    value={ledgerSearchTerm}
                    onChange={(e) => setLedgerSearchTerm(e.target.value)}
                  />
                  {ledgerSearchTerm && (
                    <button 
                      onClick={() => setLedgerSearchTerm('')}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Counter */}
                <div className="text-xs text-gray-300 bg-white/5 p-2.5 px-4 rounded-2xl border border-white/10 select-none text-center whitespace-nowrap font-bold">
                  القيود المسجلة: <span className="text-sky-400 font-black font-mono text-sm">
                    {entries.filter((entry) => {
                      let entryDateStr = '';
                      if (entry.date) {
                        if (typeof entry.date.toDate === 'function') {
                          entryDateStr = format(entry.date.toDate(), 'yyyy-MM-dd');
                        } else if (typeof entry.date === 'string') {
                          entryDateStr = entry.date.split('T')[0];
                        }
                      }
                      const matchesStart = !dateRange.start || !entryDateStr || entryDateStr >= dateRange.start;
                      const matchesEnd = !dateRange.end || !entryDateStr || entryDateStr <= dateRange.end;
                      const status = entry.status || 'approved';
                      const matchesStatus = ledgerStatusFilter === 'ALL' || status === ledgerStatusFilter;
                      const term = ledgerSearchTerm.toLowerCase().trim();
                      const matchesSearch = !term ||
                        (entry.description || '').toLowerCase().includes(term) ||
                        (entry.id || '').toLowerCase().includes(term) ||
                        (entry.ref || '').toLowerCase().includes(term) ||
                        (entry.costCenter || '').toLowerCase().includes(term) ||
                        (entry.items || []).some(item => (item.accountName || '').toLowerCase().includes(term));
                      return matchesStart && matchesEnd && matchesStatus && matchesSearch;
                    }).length}
                  </span> / {entries.length}
                </div>
              </div>
            </div>

            {/* List of Journal Entry Voucher Cards */}
            <div className="space-y-4">
              {(() => {
                const filteredEntries = entries.filter((entry) => {
                  let entryDateStr = '';
                  if (entry.date) {
                    if (typeof entry.date.toDate === 'function') {
                      entryDateStr = format(entry.date.toDate(), 'yyyy-MM-dd');
                    } else if (typeof entry.date === 'string') {
                      entryDateStr = entry.date.split('T')[0];
                    }
                  }
                  const matchesStart = !dateRange.start || !entryDateStr || entryDateStr >= dateRange.start;
                  const matchesEnd = !dateRange.end || !entryDateStr || entryDateStr <= dateRange.end;
                  const status = entry.status || 'approved';
                  const matchesStatus = ledgerStatusFilter === 'ALL' || status === ledgerStatusFilter;
                  const term = ledgerSearchTerm.toLowerCase().trim();
                  const matchesSearch = !term ||
                    (entry.description || '').toLowerCase().includes(term) ||
                    (entry.id || '').toLowerCase().includes(term) ||
                    (entry.ref || '').toLowerCase().includes(term) ||
                    (entry.costCenter || '').toLowerCase().includes(term) ||
                    (entry.items || []).some(item => (item.accountName || '').toLowerCase().includes(term));
                  return matchesStart && matchesEnd && matchesStatus && matchesSearch;
                });

                if (loading) {
                  return (
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-12 text-center rounded-3xl">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-400" />
                      <span className="text-xs text-gray-400 block mt-2">جاري مزامنة قيود الدفتر العام من السيرفر...</span>
                    </div>
                  );
                }

                if (filteredEntries.length === 0) {
                  return (
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-12 text-center rounded-3xl space-y-3">
                      <BookOpen className="w-12 h-12 text-gray-500 mx-auto opacity-40" />
                      <p className="text-sm font-bold text-gray-300">لا توجد قيود محاسبية مطابقة للفلاتر والتواريخ المحددة.</p>
                      <p className="text-xs text-gray-500">جرب تعديل مدى التاريخ أو مسح شريط البحث لسرعة الاستعلام.</p>
                    </div>
                  );
                }

                return filteredEntries.map((entry) => {
                  const totalDebit = (entry.items || []).reduce((sum, i) => sum + Number(i.debit || 0), 0);
                  const totalCredit = (entry.items || []).reduce((sum, i) => sum + Number(i.credit || 0), 0);
                  const isBalanced = Math.abs(totalDebit - totalCredit) === 0;
                  const entryStatus = entry.status || 'approved';
                  const isPending = entryStatus === 'pending_approval' || entryStatus === 'draft';
                  const isRejected = entryStatus === 'rejected';

                  return (
                    <div 
                      key={entry.id} 
                      className={`bg-slate-900/80 backdrop-blur-xl border rounded-3xl overflow-hidden shadow-xl transition-all ${
                        isPending 
                          ? 'border-amber-500/40 bg-amber-950/10' 
                          : isRejected 
                            ? 'border-rose-500/30 opacity-75' 
                            : 'border-white/10 hover:border-sky-500/30'
                      }`}
                    >
                      {/* Voucher Header Bar */}
                      <div className="bg-slate-950/80 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-white/10">
                        <div className="flex flex-wrap items-center gap-2.5">
                          {/* Voucher ID Badge */}
                          <span className="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-black font-mono flex items-center gap-1.5">
                            <BookOpen size={14} />
                            #{entry.id.slice(-6).toUpperCase()}
                          </span>

                          {/* Approval Status Badge */}
                          {isPending ? (
                            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-black flex items-center gap-1">
                              <Clock size={13} />
                              <span>مسودة / بانتظار الاعتماد ⏳</span>
                            </span>
                          ) : isRejected ? (
                            <span className="px-3 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-black flex items-center gap-1">
                              <X size={13} />
                              <span>ملغي / مرفوض ❌</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black flex items-center gap-1">
                              <CheckCheck size={13} />
                              <span>معتمد ومرحل ✓</span>
                            </span>
                          )}

                          {/* Cost Center Badge if present */}
                          {entry.costCenter && (
                            <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold flex items-center gap-1">
                              <Building size={12} />
                              <span>{entry.costCenter}</span>
                            </span>
                          )}

                          {/* Arabic Date */}
                          <span className="text-xs text-gray-300 font-bold font-mono flex items-center gap-1.5">
                            <Calendar size={13} className="text-gray-400" />
                            {entry.date ? (
                              typeof entry.date.toDate === 'function' 
                                ? format(entry.date.toDate(), 'PPP', { locale: ar }) 
                                : 'تاريخ موثق'
                            ) : 'تاريخ قيد تسوية'}
                          </span>

                          {/* Ref Tag if present */}
                          {entry.ref && (
                            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[11px] font-mono">
                              مرجع: {entry.ref}
                            </span>
                          )}

                          {/* Balance Status Badge */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border flex items-center gap-1 ${
                            isBalanced 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {isBalanced ? (
                              <>
                                <CheckCircle2 size={12} />
                                <span>متوازن</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle size={12} />
                                <span>غير متوازن</span>
                              </>
                            )}
                          </span>

                          {/* Attachments Trigger Button */}
                          {entry.attachments && entry.attachments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setPreviewModalImg(entry.attachments![0])}
                              className="px-2.5 py-0.5 bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-slate-950 border border-sky-500/30 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Paperclip size={12} />
                              <span>مرفقات ({entry.attachments.length}) 📎</span>
                            </button>
                          )}
                        </div>

                        {/* Description & Voucher Amount */}
                        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                          <span className="text-white font-bold text-xs md:text-sm max-w-md truncate">
                            {entry.description || 'سند قيد يومية محاسبي'}
                          </span>
                          <span className="text-sm font-black text-sky-400 font-mono bg-white/5 p-1.5 px-3 rounded-xl border border-white/5 whitespace-nowrap">
                            {totalDebit.toLocaleString()} YER
                          </span>
                        </div>
                      </div>

                      {/* Line Items Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs md:text-sm">
                          <thead className="text-[10px] text-gray-400 font-black uppercase tracking-wider bg-white/[0.02] border-b border-white/5">
                            <tr>
                              <th className="px-6 py-3">الحساب المحاسبي المتأثر</th>
                              <th className="px-6 py-3">مركز الكلفة</th>
                              <th className="px-6 py-3">مدين (Debtor)</th>
                              <th className="px-6 py-3">دائن (Creditor)</th>
                              <th className="px-6 py-3">العملة الأساسية</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {entry.items?.map((item, idx) => (
                              <tr key={`entry-${entry.id}-item-${idx}`} className="hover:bg-white/[0.03] transition-colors">
                                <td className="px-6 py-3.5 font-bold text-gray-200 flex items-center gap-2">
                                  <span className="p-1 bg-white/5 rounded text-sky-400 font-mono text-[10px]">
                                    #{idx + 1}
                                  </span>
                                  <span>{item.accountName}</span>
                                </td>
                                <td className="px-6 py-3.5 text-gray-400 text-xs">
                                  {item.costCenter || entry.costCenter || '—'}
                                </td>
                                <td className="px-6 py-3.5 text-emerald-400 font-mono font-black">
                                  {item.debit > 0 ? `${Number(item.debit).toLocaleString()} YER` : '—'}
                                </td>
                                <td className="px-6 py-3.5 text-rose-400 font-mono font-black">
                                  {item.credit > 0 ? `${Number(item.credit).toLocaleString()} YER` : '—'}
                                </td>
                                <td className="px-6 py-3.5 text-gray-400 font-mono font-bold">
                                  {item.currency || 'YER'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Approval Action Bar for Pending Vouchers */}
                      {isPending && (
                        <div className="bg-amber-950/30 p-3 px-6 border-t border-amber-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="text-xs text-amber-300 font-bold flex items-center gap-2">
                            <Clock size={15} />
                            <span>هذا القيد مسودة غير معتمد، ولم يؤثر على أرصدة الحسابات وميزان المراجعة بعد.</span>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              disabled={approvingEntryId === entry.id}
                              onClick={() => handleApproveEntry(entry.id)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer border-none flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                            >
                              {approvingEntryId === entry.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={14} />
                              )}
                              <span>اعتماد وترحيل القيد للأرصدة ✓</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectEntry(entry.id)}
                              className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-rose-500/30"
                            >
                              رفض وإلغاء ✕
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </motion.div>
        )}

        {/* TAB 4: Detail Account Statement - Phase 5 Upgraded Glass Design */}
        {activeTab === 'statement' && (
          <motion.div 
            key="statement"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Account statement selector card */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <FileText className="text-sky-400" size={22} />
                    <span>كشف الحساب التفصيلي وحركات الدفتر العام</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    استعلم عن جميع الحركات والقيود المؤثرة على حساب معين وحساب الرصيد المتراكم الجاري تلقائياً.
                  </p>
                </div>

                {selectedStatementAccountId && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrintAccountStatement}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-400" />
                      <span>طباعة / تصدير الكشف</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-300 block">اختر الحساب المحاسبي من دليلك المالي:</label>
                <select
                  value={selectedStatementAccountId}
                  onChange={(e) => setSelectedStatementAccountId(e.target.value)}
                  className="w-full text-right p-4 bg-slate-950/80 border border-white/10 rounded-2xl text-xs md:text-sm font-black text-white outline-none focus:ring-2 focus:ring-sky-500/50"
                >
                  <option value="" className="bg-slate-900 text-gray-400">-- حدد الحساب من القائمة --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                      ({a.accountNumber}) {a.accountName} - الرصيد الحالي: {a.balance.toLocaleString()} {a.currency || 'YER'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List Statement Ledger Details */}
            {selectedStatementAccountId ? (
              <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-xl space-y-4">
                {/* Account Summary Banner */}
                {(() => {
                  const currentAcc = accounts.find(a => a.id === selectedStatementAccountId);
                  const totalDebits = statementTransactions.reduce((sum, tx) => sum + tx.debit, 0);
                  const totalCredits = statementTransactions.reduce((sum, tx) => sum + tx.credit, 0);

                  return (
                    <div className="bg-slate-950/90 px-6 py-5 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-sky-400 px-2.5 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
                          رمز: {currentAcc?.accountNumber || '---'}
                        </span>
                        <h4 className="text-xl font-black text-white mt-1">
                          كشف حساب: {currentAcc?.accountName || 'غير محدد'}
                        </h4>
                        <span className="text-xs text-gray-400 block mt-0.5">
                          نوع الحساب: {currentAcc?.type === 'asset' ? 'أصل' : currentAcc?.type === 'liability' ? 'التزام' : currentAcc?.type === 'revenue' ? 'إيراد' : currentAcc?.type === 'expense' ? 'مصروف' : 'حقوق ملكية'} | العملة: {currentAcc?.currency || 'YER'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="bg-white/5 p-3 px-4 rounded-2xl border border-white/5 text-center">
                          <span className="text-[10px] text-gray-400 block">مجموع المدين</span>
                          <span className="text-sm font-black text-emerald-400 font-mono">{totalDebits.toLocaleString()} YER</span>
                        </div>
                        <div className="bg-white/5 p-3 px-4 rounded-2xl border border-white/5 text-center">
                          <span className="text-[10px] text-gray-400 block">مجموع الدائن</span>
                          <span className="text-sm font-black text-rose-400 font-mono">{totalCredits.toLocaleString()} YER</span>
                        </div>
                        <div className="bg-sky-500/10 p-3 px-4 rounded-2xl border border-sky-500/20 text-center">
                          <span className="text-[10px] text-sky-300 block font-bold">الرصيد النهائي الحالي</span>
                          <span className={`text-base font-black font-mono ${(currentAcc?.balance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(currentAcc?.balance || 0).toLocaleString()} {currentAcc?.currency || 'YER'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs md:text-sm">
                    <thead className="text-[10px] text-gray-400 font-black uppercase tracking-wider bg-slate-955/80 border-b border-white/10">
                      <tr>
                        <th className="px-6 py-4">تاريخ الحركة</th>
                        <th className="px-6 py-4">البيان / الوصف التفصيلي</th>
                        <th className="px-6 py-4 text-emerald-400">مدين (+) YER</th>
                        <th className="px-6 py-4 text-rose-400">دائن (-) YER</th>
                        <th className="px-6 py-4 text-sky-400">الرصيد المتراكم الجاري</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {statementTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold">
                            لا توجد قيود أو حركات سابقة تؤثر على هذا الحساب المحاسبي.
                          </td>
                        </tr>
                      ) : (
                        statementTransactions.map((tx, idx) => (
                          <tr key={`stmt-row-${idx}`} className="hover:bg-white/[0.03] transition-colors">
                            <td className="px-6 py-4 text-gray-300 font-mono font-bold">
                              {tx.date ? (
                                typeof tx.date.toDate === 'function'
                                  ? format(tx.date.toDate(), 'PPP HH:mm', { locale: ar })
                                  : 'تاريخ موثق'
                              ) : 'مؤقت'}
                            </td>
                            <td className="px-6 py-4 font-bold text-white">{tx.description}</td>
                            <td className="px-6 py-4 text-emerald-400 font-mono font-black text-sm">
                              {tx.debit > 0 ? `${tx.debit.toLocaleString()} YER` : '—'}
                            </td>
                            <td className="px-6 py-4 text-rose-400 font-mono font-black text-sm">
                              {tx.credit > 0 ? `${tx.credit.toLocaleString()} YER` : '—'}
                            </td>
                            <td className={`px-6 py-4 font-mono font-black text-sm ${tx.runningBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {tx.runningBalance.toLocaleString()} YER
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-12 text-center rounded-3xl space-y-3">
                <FileText className="w-12 h-12 text-sky-400 mx-auto opacity-40" />
                <p className="text-sm font-bold text-gray-300">حدد حساباً محاسبياً من القائمة أعلاه لعرض كشف الحساب والعمليات الجارية.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 5: Trial balance and profit/loss reports - Phase 6 Upgraded Glass Design */}
        {activeTab === 'reports' && (
          <motion.div 
            key="reports"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Overview KPI widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-xl text-right flex flex-col justify-between h-40 relative overflow-hidden group">
                <div className="absolute left-4 top-4 w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <span className="text-xs text-emerald-400 font-bold block">إجمالي الإيرادات المسجلة (Revenues)</span>
                  <span className="text-2xl md:text-3xl font-black text-emerald-400 block mt-2 font-mono">{totalRevenues.toLocaleString()} YER</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">حسابات الإيرادات والمبيعات التشغيلية</span>
              </div>

              <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-xl text-right flex flex-col justify-between h-40 relative overflow-hidden group">
                <div className="absolute left-4 top-4 w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center">
                  <TrendingDown size={24} />
                </div>
                <div>
                  <span className="text-xs text-rose-400 font-bold block">إجمالي المصاريف التشغيلية (Expenses)</span>
                  <span className="text-2xl md:text-3xl font-black text-rose-400 block mt-2 font-mono">{totalExpenses.toLocaleString()} YER</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">المصروفات والمشتريات وتكاليف المبيعات</span>
              </div>

              <div className="bg-gradient-to-br from-slate-900/90 via-slate-900 to-sky-950/40 border border-sky-500/30 p-6 rounded-3xl shadow-xl text-right flex flex-col justify-between h-40 relative overflow-hidden">
                <div className="absolute left-4 top-4 w-12 h-12 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-2xl flex items-center justify-center">
                  <Briefcase size={24} />
                </div>
                <div>
                  <span className="text-xs text-sky-300 font-bold block">صافي ربح النشاط التشغلي (Net Profit)</span>
                  <span className={`text-2xl md:text-3xl font-black block mt-2 font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {netProfit.toLocaleString()} YER
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">الإيرادات المحققة مطروحاً منها المصروفات</span>
              </div>
            </div>

            {/* Trial Balance Table */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-xl">
              <div className="bg-slate-950/90 px-6 py-4 border-b border-white/10 flex justify-between items-center flex-wrap gap-2">
                <h3 className="font-black text-sm md:text-base text-white flex items-center gap-2">
                  <FileSpreadsheet className="text-sky-400" size={20} />
                  <span>ميزان المراجعة والأرصدة الختامية للدفتر العام (Trial Balance)</span>
                </h3>
                <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-black">
                  ✓ ميزان مالي متوازن برمجياً
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="text-[10px] text-gray-400 font-black uppercase tracking-wider bg-white/[0.02] border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4">رمز الحساب</th>
                      <th className="px-6 py-4">الحساب الدفتري</th>
                      <th className="px-6 py-4">التصنيف المحاسبي</th>
                      <th className="px-6 py-4 text-emerald-400">أرصدة مدينة (Debit Balances)</th>
                      <th className="px-6 py-4 text-rose-400">أرصدة دائنة (Credit Balances)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {accounts.map(acc => {
                      const isDebit = acc.balance >= 0;
                      return (
                        <tr key={`tb-row-${acc.id}`} className="hover:bg-white/[0.03] transition-colors">
                          <td className="px-6 py-3.5 font-mono font-bold text-sky-400">{acc.accountNumber}</td>
                          <td className="px-6 py-3.5 font-bold text-white">{acc.accountName}</td>
                          <td className="px-6 py-3.5 text-xs text-gray-400">
                            {acc.type === 'asset' ? 'أصل' : acc.type === 'liability' ? 'التزام' : acc.type === 'revenue' ? 'إيراد' : acc.type === 'expense' ? 'مصروف' : 'حقوق ملكية'}
                          </td>
                          <td className="px-6 py-3.5 font-mono text-emerald-400 font-black text-sm">
                            {isDebit ? `${acc.balance.toLocaleString()} YER` : '0.00 YER'}
                          </td>
                          <td className="px-6 py-3.5 font-mono text-rose-400 font-black text-sm">
                            {!isDebit ? `${Math.abs(acc.balance).toLocaleString()} YER` : '0.00 YER'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-955/90 font-black text-xs md:text-sm border-t border-white/10">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-gray-300 font-black text-base">المجموع الختامي للميزان (المطابقة المالية)</td>
                      <td className="px-6 py-4 text-emerald-400 font-mono font-black text-lg">
                        {accounts.filter(a => a.balance >= 0).reduce((sum, a) => sum + a.balance, 0).toLocaleString()} YER
                      </td>
                      <td className="px-6 py-4 text-rose-400 font-mono font-black text-lg">
                        {accounts.filter(a => a.balance < 0).reduce((sum, a) => sum + Math.abs(a.balance), 0).toLocaleString()} YER
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 6: Financial Year End Closing Wizard */}
        {activeTab === 'closing' && (
          <motion.div
            key="closing-wizard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl w-full max-w-[1920px] mx-auto space-y-6"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-white/10 pb-6">
              <div className="p-3.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl">
                <Calendar size={28} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                  <span>مدير تدوير وإقفال السنة المالية (Financial Year End Wizard)</span>
                </h2>
                <p className="text-xs md:text-sm text-gray-400 mt-1">
                  أداة آليّة متطورة تغلق الدفاتر وتصفّر الحسابات المؤقتة وترحّل صافي الربح لحساب حقوق الملكية بضغطة زر.
                </p>
              </div>
            </div>

            {/* Stepper */}
            <div className="grid grid-cols-4 gap-3 text-center text-xs font-bold border-b border-white/10 pb-6">
              <div className={`p-3 rounded-2xl transition-all cursor-default ${closingStep === 1 ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20' : 'bg-white/5 text-gray-400'}`}>1. فحص الحسابات</div>
              <div className={`p-3 rounded-2xl transition-all cursor-default ${closingStep === 2 ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20' : 'bg-white/5 text-gray-400'}`}>2. ترحيل الأرباح</div>
              <div className={`p-3 rounded-2xl transition-all cursor-default ${closingStep === 3 ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20' : 'bg-white/5 text-gray-400'}`}>3. تنفيذ الإقفال</div>
              <div className={`p-3 rounded-2xl transition-all cursor-default ${closingStep === 4 ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-gray-400'}`}>4. تم الإقفال 🎉</div>
            </div>

            {/* Content per Step */}
            {closingStep === 1 && (
              <div className="space-y-6">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs md:text-sm text-amber-300 font-bold leading-relaxed flex items-start gap-3">
                  <AlertTriangle size={20} className="shrink-0 text-amber-400" />
                  <span>
                    تنفيذ عملية إقفال السنة المالية يصفّر كافة أرصدة حسابات الإيرادات والمصاريف المؤقتة وترحيل صافي الربح السنوي لحساب الأرباح المدورة بضغطة زر واحدة أمان ودقة.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/10 space-y-2">
                    <span className="text-xs text-gray-400 block font-bold">إجمالي الحسابات المؤقتة النشطة</span>
                    <div className="text-2xl font-mono font-black text-white">
                      {accounts.filter(a => a.type === 'revenue' || a.type === 'expense').length} حساباً مؤقتاً
                    </div>
                  </div>
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/10 space-y-2">
                    <span className="text-xs text-gray-400 block font-bold">صافي الربح/الخسارة الجاهز للترحيل</span>
                    <div className={`text-2xl font-mono font-black ${totalRevenues - totalExpenses >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {(totalRevenues - totalExpenses).toLocaleString()} YER
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setClosingStep(2)}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs md:text-sm rounded-xl cursor-pointer border-none shadow-lg shadow-amber-500/20"
                  >
                    متابعة الخطوة التالية &larr;
                  </button>
                </div>
              </div>
            )}

            {closingStep === 2 && (
              <div className="space-y-6">
                <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                  سيتم تصفير حسابات الإيرادات والمصاريف وترحيل الصافي إلى الحساب الختامي في حقوق الملكية:
                </p>
                <div className="p-5 bg-slate-950/80 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex justify-between items-center text-xs md:text-sm">
                    <span className="text-gray-400">حساب ترحيل حقوق الملكية:</span>
                    <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                      (3100) حساب الأرباح والخسائر المدورة والمحتجزة
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs md:text-sm">
                    <span className="text-gray-400">صافي المبلغ المرحل:</span>
                    <span className="font-mono font-black text-emerald-400 text-base">
                      {(totalRevenues - totalExpenses).toLocaleString()} YER
                    </span>
                  </div>
                </div>
                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setClosingStep(1)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl cursor-pointer border border-white/10"
                  >
                    &rarr; رجوع للخلف
                  </button>
                  <button
                    onClick={() => setClosingStep(3)}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs md:text-sm rounded-xl cursor-pointer border-none shadow-lg shadow-amber-500/20"
                  >
                    متابعة الخطوة التالية &larr;
                  </button>
                </div>
              </div>
            )}

            {closingStep === 3 && (
              <div className="space-y-6">
                <div className="p-5 bg-rose-500/10 border border-rose-500/30 text-xs md:text-sm text-rose-300 rounded-2xl font-bold leading-relaxed flex items-center gap-3">
                  <AlertTriangle size={20} className="shrink-0 text-rose-400" />
                  <span>
                    🚨 تنبيه الإغلاق النهائي: الضغط على "تأكيد الإقفال" سيسجل قيد التصفية ويصّفر الأرصدة فوراً على السيرفر.
                  </span>
                </div>
                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setClosingStep(2)}
                    disabled={isClosing}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl disabled:opacity-50 cursor-pointer border border-white/10"
                  >
                    &rarr; رجوع للخلف
                  </button>
                  <button
                    onClick={handleCloseFiscalYear}
                    disabled={isClosing}
                    className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs md:text-sm rounded-xl flex items-center gap-2 shadow-xl cursor-pointer border-none disabled:opacity-50"
                  >
                    {isClosing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                        <span>جاري تنفيذ الإقفال وترحيل القيود الختامية...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>إقفال السنة المالية وتصفير الدفاتر بنقرة زر</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {closingStep === 4 && (
              <div className="text-center py-8 space-y-4">
                <div className="text-5xl text-emerald-400 font-bold">🎉</div>
                <h3 className="text-xl font-black text-white">تم إقفال السنة المالية القديمة بنجاح مطلق!</h3>
                <p className="text-xs md:text-sm text-gray-400 max-w-md mx-auto">
                  تم تصفير كافة حسابات المصاريف والإيرادات المؤقتة، وترحيل الرصيد الافتتاحي للعام الجديد إلى حساب الأرباح المدورة بنجاح.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => {
                      setClosingStep(1);
                      setActiveTab('chart');
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs md:text-sm rounded-xl cursor-pointer border-none shadow-lg shadow-emerald-500/20"
                  >
                    العودة لشجرة الحسابات الرئيسية
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 7: Financial Audit Trail Log */}
        {activeTab === 'audit_trail' && (
          <motion.div
            key="audit_trail"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <FinancialAuditTrail profile={profile as any} />
          </motion.div>
        )}

        {/* TAB 8: Bank Reconciliation & Statements Matching */}
        {activeTab === 'bank_reconciliation' && (
          <motion.div
            key="bank_reconciliation"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <BankReconciliationView
              profile={profile as any}
              accounts={accounts}
              vaults={vaults}
              onOpenJournalVoucher={() => setActiveTab('journal_entry')}
            />
          </motion.div>
        )}

        {/* TAB 9: Cost Centers & Project Financials */}
        {activeTab === 'cost_centers' && (
          <motion.div
            key="cost_centers"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <CostCentersManager profile={profile as any} />
          </motion.div>
        )}

      </AnimatePresence>

      {/* LIGHTBOX / ATTACHMENT PREVIEW MODAL */}
      <AnimatePresence>
        {previewModalImg && (
          <div 
            onClick={() => setPreviewModalImg(null)}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-white/20 rounded-3xl p-4 max-w-2xl w-full shadow-2xl space-y-3 cursor-default"
              dir="rtl"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="text-sky-400" size={18} />
                  <span className="text-sm font-black text-white">معاينة المستند والوثيقة المرفقة بالسند</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewModalImg(null)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-slate-950 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center max-h-[70vh]">
                <img
                  src={previewModalImg}
                  alt="مرفق السند"
                  className="w-full h-auto object-contain max-h-[65vh] rounded-xl"
                />
              </div>

              <div className="flex justify-between items-center pt-1 text-xs text-gray-400 font-bold">
                <span>وثيقة إثبات معتمدة ومحفوظة محاسبياً</span>
                <a
                  href={previewModalImg}
                  download="voucher_attachment.jpg"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1 text-xs"
                >
                  <span>فتح بالحجم الكامل ↗</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DYNAMIC MODAL: ADD NEW ACCOUNT TO DL CONTAINER - Phase 6 Glass Design */}
      <AnimatePresence>
        {isAddAccountOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative"
            >
              {/* Close button */}
              <button 
                type="button"
                onClick={() => setIsAddAccountOpen(false)}
                className="absolute left-4 top-4 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-2xl border border-sky-500/30">
                    <Plus size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">تأسيس حساب مالي جديد بالدليل</h3>
                    <p className="text-[11px] text-gray-400">توسيع دليل الحسابات ومطابقة الفواتير بدقة</p>
                  </div>
                </div>

                <form onSubmit={handleCreateAccount} className="space-y-4 text-right">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-300 block">رمز الحساب (الرقم المحاسبي) *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="مثال: 1210، 5250"
                      className="w-full text-center p-3.5 font-mono font-bold bg-slate-950/80 border border-white/10 rounded-2xl text-xs md:text-sm text-white outline-none focus:ring-2 focus:ring-sky-500/50"
                      value={newAcc.accountNumber}
                      onChange={(e) => setNewAcc({...newAcc, accountNumber: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-300 block">اسم الحساب (الاسم المحاسبي الدفتري) *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="الأراضي والمباني، الفروع، مبيعات الأقلام..."
                      className="w-full text-right p-3.5 bg-slate-950/80 border border-white/10 rounded-2xl text-xs md:text-sm font-bold text-white outline-none focus:ring-2 focus:ring-sky-500/50"
                      value={newAcc.accountName}
                      onChange={(e) => setNewAcc({...newAcc, accountName: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-300 block">نوع وتصنيف الحساب *</label>
                    <select
                      value={newAcc.type}
                      onChange={(e) => setNewAcc({...newAcc, type: e.target.value as any})}
                      className="w-full text-right p-3.5 bg-slate-950/80 border border-white/10 rounded-2xl text-xs md:text-sm font-bold text-white outline-none focus:ring-2 focus:ring-sky-500/50"
                    >
                      <option value="asset" className="bg-slate-900 text-white">أصول (Assets)</option>
                      <option value="liability" className="bg-slate-900 text-white">خصوم والتزامات (Liabilities)</option>
                      <option value="equity" className="bg-slate-900 text-white">حقوق ملكية ورأس مال (Equity)</option>
                      <option value="revenue" className="bg-slate-900 text-white">إيرادات (Revenues)</option>
                      <option value="expense" className="bg-slate-900 text-white">مصروفات (Expenses)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-300 block">عملة الحساب المعتمدة *</label>
                    <select
                      value={newAcc.currency}
                      onChange={(e) => setNewAcc({...newAcc, currency: e.target.value})}
                      className="w-full text-right p-3.5 bg-slate-950/80 border border-white/10 rounded-2xl text-xs md:text-sm font-black text-white outline-none focus:ring-2 focus:ring-sky-500/50"
                    >
                      <option value="YER" className="bg-slate-900 text-white">ريال يمني (YER)</option>
                      <option value="SAR" className="bg-slate-900 text-white">ريال سعودي (SAR)</option>
                      <option value="USD" className="bg-slate-900 text-white">دولار أمريكي (USD)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingAcc}
                    className="w-full p-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 font-black text-slate-950 text-sm rounded-2xl shadow-xl shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border-none"
                  >
                    {isSubmittingAcc ? (
                      <>
                        <Loader2 className="animate-spin text-slate-950" size={18} />
                        <span>جاري الحفظ والإنشاء...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>تأكيد تسجيل الحساب فورياً</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
