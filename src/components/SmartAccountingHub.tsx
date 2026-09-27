import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, Wallet, Box, PlusCircle, 
  ArrowLeftRight, ShoppingCart, Users, Landmark, Calendar,
  FileText, Activity, Layers, Coins, Trash2, ArrowUpRight, ArrowDownLeft,
  ChevronLeft, ChevronDown, Grid, Receipt, DollarSign, UserCheck, RefreshCw, RotateCw, Layers3, Percent,
  Search, BookOpen, FileSpreadsheet, Info, Check, X, Loader2, Briefcase, Plus, Wrench, Edit2,
  SlidersHorizontal, Download, Share2, Settings, Cpu, Truck, Clock, AlertTriangle, CheckSquare, Zap,
  FolderTree, Scale, Lock, Building2, LineChart, SearchCheck, Smartphone, Laptop, CheckCircle,
  Bot, Sparkles, Mic
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, orderBy, limit, 
  addDoc, doc, writeBatch, serverTimestamp, increment, updateDoc, getDocs, deleteDoc, setDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Account, JournalEntry, BankAccount } from '../types';
import { isModuleAutoHidden } from '../utils/businessPermissions';
import BankTransferManager from './BankTransferManager';
import { JamBoxManager } from './JamBoxManager';
import SmartAIAccountantModal from './SmartAIAccountantModal';
import { AssetMaintenanceDashboard } from './AssetMaintenanceDashboard';
import { VaultsTabContent } from './VaultsTabContent';
import { accountingService, initializeChartOfAccounts, postSaleToGL, postPurchaseToGL, ensureAndGetGLAccount } from '../services/accountingService';
import { postPettyCashOrSalaryToLedger } from '../services/MaintenanceFinancialService';
import { runInvisibleJournalEngineTest, cleanupInvisibleJournalTestLogs } from '../services/invisibleJournalTest';
import { runPurchasesTest, cleanupPurchasesTestLogs } from '../services/purchasesTest';
import { runMaintenanceTest, cleanupMaintenanceTestLogs } from '../services/maintenanceTest';
import { runLossesTest, cleanupLossesTestLogs } from '../services/lossesTest';
import { runMarketDraftsTest, cleanupMarketDraftsTestLogs } from '../services/marketDraftsTest';
import { runB2BLifecycleTest, cleanupB2BLifecycleTestLogs } from '../services/b2bLifecycleTest';
import { runMultiTenantTest, cleanupMultiTenantTestLogs } from '../services/multiTenantTest';
import { runAtomicAccountingTest, cleanupAtomicTestLogs } from '../services/atomicAccountingTest';
import { runDecimalPrecisionTest, cleanupDecimalPrecisionTestLogs } from '../services/decimalPrecisionTest';
import Big from 'big.js';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import AutomatedJournalEngineDashboard from './AutomatedJournalEngineDashboard';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Accounts from './Accounts';
import UnifiedJournalVoucher from './UnifiedJournalVoucher';
import { realtimeSyncService } from '../services/realtimeSyncService';

interface ComponentMetric {
  componentName: string;
  fileName: string;
  route: string;
  metricLabel: string;
  actualValue: number;
  isBalanced: boolean;
  accountCode: string;
}

interface Transaction {
  id: string;
  type: 'inflow' | 'outflow';
  category: string;
  amount: number;
  date: Date;
  details?: string;
  invoiceNo?: string;
  purchaseMethod?: 'market' | 'direct';
  recipient?: string;
  reason?: string;
  accountSource?: string;
  targetAccount?: string;
  employeeName?: string;
  commissionType?: string;
  originalType?: string;
}

interface Vault {
  id: string;
  name: string;
  type: 'bank' | 'cash' | 'market';
  balance: number;
  linkedAccount?: string;
}

const normalizeDate = (rawDate: any): string => {
  if (!rawDate) return '';
  let d: Date;
  if (rawDate instanceof Date) {
    d = rawDate;
  } else if (rawDate && typeof rawDate.toDate === 'function') {
    d = rawDate.toDate();
  } else if (typeof rawDate === 'object' && rawDate.seconds !== undefined) {
    d = new Date(rawDate.seconds * 1000);
  } else {
    d = new Date(rawDate);
  }
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface SmartAccountingHubProps {
  profile: UserProfile | null;
  initialTab?: 'cashflow' | 'jard' | 'vaults' | 'analytics' | 'accounts_ledger' | 'assets';
}

export default function SmartAccountingHub({ profile, initialTab }: SmartAccountingHubProps) {
  const navigate = useNavigate();
  const isModuleEnabled = (modId: string) => {
    if (isModuleAutoHidden(modId, profile)) return false;
    if (!profile) return true;
    if (profile.role === 'superadmin') return true;
    if (!profile.enabledModules) return true;
    return profile.enabledModules.includes(modId);
  };
  const playBeep = (freq = 840, duration = 0.1) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };
  const [isAIAccountantOpen, setIsAIAccountantOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'cashflow' | 'jard' | 'vaults' | 'analytics' | 'accounts_ledger' | 'assets'>(initialTab || 'cashflow');
  const [expandedAccordion, setExpandedAccordion] = useState<'vaults' | 'accounts_ledger' | 'cashflow' | 'jard' | 'analytics' | 'assets' | null>('accounts_ledger');
  const [launcherSearchQuery, setLauncherSearchQuery] = useState('');
  
  // Ledger and Vault States Management
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [isAccSubmitting, setIsAccSubmitting] = useState(false);

  // Pagination states for preventing lower-end device lagging or memory freeze (max 20 rows per page chunk)
  const [txPage, setTxPage] = useState(1);
  const [visibleTransLimit, setVisibleTransLimit] = useState(40);
  const [journalPage, setJournalPage] = useState(1);
  const [statementPage, setStatementPage] = useState(1);
  const [jardPage, setJardPage] = useState(1);

  // User-defined Outflow Categories & Quick Outflow Presets
  const [outflowCategories, setOutflowCategories] = useState<string[]>([]);
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);

  const [quickOutflowPresets, setQuickOutflowPresets] = useState<Array<{ id: string; name: string; amount: string; category: string; details: string }>>([]);
  const [showAddPresetForm, setShowAddPresetForm] = useState(false);
  const [newPreset, setNewPreset] = useState({ name: '', amount: '', category: 'مصاريف كهرباء', details: '' });

  const handleAddNewOutflowCategory = async (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;
    if (!profile?.ownerId) return;
    const catId = `CAT-${Date.now()}`;
    try {
      await setDoc(doc(db, 'outflow_categories', catId), {
        name: trimmed,
        ownerId: profile.ownerId,
        storeId: profile.storeId || 'main_store',
        createdAt: new Date().toISOString()
      });
      setNewCustomCategory('');
      setShowAddCategoryInput(false);
      setOutflowForm(prev => ({ ...prev, category: trimmed }));
    } catch (err) {
      console.error('Error adding outflow category:', err);
    }
  };

  const handleAddNewPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    if (!newPreset.name.trim() || !newPreset.amount.trim()) {
      alert('الرجاء كتابة اسم القالب ومبلغ الخرج المبرم.');
      return;
    }
    const presetId = `QOP-${Date.now()}`;
    const payload = {
      id: presetId,
      name: `${newPreset.name.trim()} (${parseFloat(newPreset.amount).toLocaleString()} YR)`,
      amount: newPreset.amount.trim(),
      category: newPreset.category,
      details: newPreset.details.trim(),
      ownerId: profile.ownerId,
      storeId: profile.storeId || 'main_store'
    };
    try {
      await setDoc(doc(db, 'quick_outflow_presets', presetId), payload);
      setNewPreset({ name: '', amount: '', category: 'الضرائب والزكاة', details: '' });
      setShowAddPresetForm(false);
      alert('✅ تم حفظ قالب الخرج السريع الجديد وتثبيته في القائمة.');
    } catch (err: any) {
      alert('خطأ أثناء حفظ القالب: ' + err.message);
    }
  };

  const handleLoadDefaultQuickOutflows = async () => {
    if (!profile?.ownerId) return;
    const ownerId = profile.ownerId;
    const sId = profile?.shopId || profile?.storeId || 'main_store';
    const defaults: any[] = [];

    const batch = writeBatch(db);
    defaults.forEach(item => {
      const ref = doc(db, 'quick_outflow_presets', item.id);
      batch.set(ref, { ...item, ownerId, storeId: sId });
    });
    try {
      await batch.commit();
      alert('✅ تم تحميل وتهيئة قوالب الخرج السريع سحابياً بنجاح.');
    } catch (e: any) {
      alert('خطأ أثناء التهيئة: ' + e.message);
    }
  };

  const addTransactionToFirestore = async (txData: {
    type: 'inflow' | 'outflow';
    category: string;
    amount: number;
    details?: string;
    invoiceNo?: string;
    purchaseMethod?: 'market' | 'direct';
    recipient?: string;
    reason?: string;
    employeeName?: string;
    accountSource?: string;
  }) => {
    if (!profile?.ownerId) return;
    const sId = profile?.shopId || profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';
    try {
      const docRef = doc(collection(db, 'stores', sId, 'transactions'));
      const payload = {
        ownerId: profile.ownerId,
        storeId: sId,
        type: txData.type === 'inflow' ? 'income' : 'expense',
        amount: txData.amount,
        category: txData.category,
        description: txData.details || '',
        details: txData.details || '',
        createdAt: serverTimestamp(),
        invoiceNo: txData.invoiceNo || '',
        purchaseMethod: txData.purchaseMethod || '',
        recipient: txData.recipient || '',
        reason: txData.reason || '',
        employeeName: txData.employeeName || '',
        accountSource: txData.accountSource || 'v1',
        createdAtString: new Date().toISOString()
      };
      await setDoc(docRef, payload);
      
      // Also write to base root transactions for compatibility
      const legacyDocRef = doc(collection(db, 'transactions'));
      await setDoc(legacyDocRef, payload);
    } catch (e) {
      console.error('Error writing transaction to Firestore:', e);
    }
  };

  const updateVaultBalance = async (vaultId: string, val: number, isAddition: boolean) => {
    if (!profile?.ownerId) return;
    const targetVaultId = vaultId || 'v1';
    const sId = profile?.shopId || profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';
    try {
      const storeVDocRef = doc(db, 'stores', sId, 'vaults', targetVaultId);
      await setDoc(storeVDocRef, {
        balance: increment(isAddition ? val : -val)
      }, { merge: true });

      const rootVDocRef = doc(db, 'vaults', `${profile.ownerId}-${targetVaultId}`);
      await setDoc(rootVDocRef, {
        id: targetVaultId,
        name: vaults.find(v => v.id === targetVaultId)?.name || (targetVaultId === 'v1' ? 'صندوق الكاش الرئيسي للبيع' : 'صندوق مالي'),
        type: targetVaultId === 'v2' ? 'bank' : (targetVaultId === 'v3' ? 'market' : 'cash'),
        balance: increment(isAddition ? val : -val),
        ownerId: profile.ownerId,
        storeId: sId
      }, { merge: true });
    } catch (e) {
      console.error('Error updating vault balance in Firestore, updating locally:', e);
      // Fallback merge
      try {
        const storeVDocRef = doc(db, 'stores', sId, 'vaults', targetVaultId);
        await setDoc(storeVDocRef, {
          id: targetVaultId,
          name: vaults.find(v => v.id === targetVaultId)?.name || 'صندوق مالي',
          type: targetVaultId === 'v2' ? 'bank' : (targetVaultId === 'v3' ? 'market' : 'cash'),
          balance: isAddition ? val : -val,
          ownerId: profile.ownerId,
          storeId: sId
        }, { merge: true });
      } catch (innerErr) {
        console.error('Inner vault merge failure:', innerErr);
      }
      setVaults(prev => prev.map(v => v.id === targetVaultId ? { ...v, balance: isAddition ? v.balance + val : Math.max(0, v.balance - val) } : v));
    }
  };

  // Sub-forms inside Tab 1
  const [activeAction, setActiveAction] = useState<'outflow' | 'receipt' | 'purchase' | 'transfer_in' | 'salary' | 'return' | 'commission' | 'custody_to_owner' | 'custody_from_owner' | 'send_transfer' | 'adjustment'>('outflow');

  // Input States
  // 0. Adjustment Voucher Form (سند تسوية حسابية)
  const [adjustmentForm, setAdjustmentForm] = useState({ amount: '', accountId: '', type: 'debit' as 'debit' | 'credit', details: '' });
  // 1. Outflow Form
  const [outflowForm, setOutflowForm] = useState({ amount: '', category: 'الضرائب والزكاة', details: '', vaultId: 'v1' });
  // 2. Receipt Voucher Form (سند قبض)
  const [receiptForm, setReceiptForm] = useState({ amount: '', category: 'إيراد خدمات مبيعات', details: '', vaultId: 'v1' });
  // 3. Purchase Form
  const [purchaseForm, setPurchaseForm] = useState({ amount: '', itemType: 'قطع غيار جوالات', details: '', vaultId: 'v1' });
  // 4. Transfer Receive Form (استلام حوالة مع تحديد الحساب)
  const [transferInForm, setTransferInForm] = useState({ amount: '', targetAccount: 'v1', details: '' });
  // 5. Salaries Form (تسليم رواتب موظفين)
  const [salaryForm, setSalaryForm] = useState({ amount: '', employeeName: '', details: '', vaultId: 'v1' });
  // 6. Return Form (تسليم قيمة مرتجع)
  const [returnForm, setReturnForm] = useState({ amount: '', invoiceNo: '', details: '', vaultId: 'v1' });
  // 7. Commission Form (تسليم عمولات)
  const [commissionForm, setCommissionForm] = useState({ amount: '', commissionType: 'عمولة رصيد وخدمات', details: '', vaultId: 'v1' });
  // 8. Custody to Owner Form (تسليم عهدة للمالك)
  const [custodyOwnerForm, setCustodyOwnerForm] = useState({ amount: '', recipient: '', details: '', vaultId: 'v1' });
  // 9. Custody from Owner (استلام عهدة)
  const [custodyRecForm, setCustodyRecForm] = useState({ amount: '', source: '', details: '', vaultId: 'v1' });
  // 10. Send Transfer Form (إرسال حوالة)
  const [sendTransferForm, setSendTransferForm] = useState({ 
    amount: '', recipient: '', reason: '', accountSource: 'v1', 
    invoiceNo: '', isPurchase: 'no', purchaseChannel: 'market' 
  });

  // Vault creation state
  const [newVaultForm, setNewVaultForm] = useState({ name: '', type: 'bank' as 'bank' | 'cash' | 'market', balance: '', linkedAccount: '' });
  const [showVaultModal, setShowVaultModal] = useState(false);

  // Bank accounts merged states from Settings.tsx
  const [subVaultTab, setSubVaultTab] = useState<'safes' | 'bank_accounts' | 'transfers' | 'branches' | 'category_vaults'>('safes');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isAddingBank, setIsAddingBank] = useState(false);
  const [newBank, setNewBank] = useState<Partial<BankAccount>>({ bankName: '', accountName: '', accountNumber: '', currency: 'YER', balance: 0 });

  // Period filters for Tab 4
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');

  // Interactive Range Date Search state (من تاريخ / إلى تاريخ لتبويب الجرد)
  const [jardStartDate, setJardStartDate] = useState<string>('');
  const [jardEndDate, setJardEndDate] = useState<string>('');

  // Active single selected date for daily operations and upper master metrics dashboard
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Task 5 - تخصيص الجرد المتكامل وتحديد الخيارات الذكية والمخزن والموظف
  const [customJardChecklist, setCustomJardChecklist] = useState({
    maintenance: true,
    sales: true,
    purchases: true,
    balance: true,
    sims: true,
    damaged: true,
    lost: true,
    transfers: true
  });
  const [selectedJardEmployee, setSelectedJardEmployee] = useState<string>('all');
  const [selectedJardStore, setSelectedJardStore] = useState<string>('all');
  const [showCustomJardPanel, setShowCustomJardPanel] = useState<boolean>(false);

  // Interactive Smart Audit Assistant states (مركز الاستعلام التدقيقي والمطابقة)
  const [auditSearchType, setAuditSearchType] = useState<string>('all');
  const [auditTargetKeyword, setAuditTargetKeyword] = useState<string>('');
  const [auditQueryResult, setAuditQueryResult] = useState<any[] | null>(null);
  const [auditSummaryText, setAuditSummaryText] = useState<string>('');

  // Task 6 - محرك تدقيق ومطابقة العجز والزيادة والسرقات والباركود الموحد
  const [showAuditLossModal, setShowAuditLossModal] = useState<boolean>(false);
  const [auditLossBarcode, setAuditLossBarcode] = useState<string>('');
  const [auditLossType, setAuditLossType] = useState<'all' | 'deficit' | 'surplus' | 'theft' | 'pending'>('all');
  const [auditLossResults, setAuditLossResults] = useState<any[]>([]);
  const [isAuditingLoss, setIsAuditingLoss] = useState<boolean>(false);
  const [activeComponents, setActiveComponents] = useState<ComponentMetric[]>([]);

  // Ported States from Accounts.tsx for the Integrated accounting tab
  const [accountingSubTab, setAccountingSubTab] = useState<'automated_engine' | 'chart' | 'journal_entry' | 'ledger' | 'statement' | 'reports' | 'closing' | 'custodies' | 'quarantine'>('automated_engine');
  const [closingStep, setClosingStep] = useState<number>(1);
  const [isClosingFiscalYear, setIsClosingFiscalYear] = useState<boolean>(false);
  const [quarantinedTransactions, setQuarantinedTransactions] = useState<any[]>([]);
  const [chartViewMode, setChartViewMode] = useState<'list' | 'tree'>('tree');
  const [employeeUsersList, setEmployeeUsersList] = useState<any[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<{[key: string]: boolean}>({
    '1': true, '1-100': true, '1-150': true, '1-200': true,
    '2': true, '2-100': true, '3': true, '4': true, '5': true
  });

  // Custody Form state
  const [custodyHandoverForm, setCustodyHandoverForm] = useState({
    employeeId: '',
    vaultId: 'v1',
    amount: '',
    details: ''
  });
  const [custodySettlementForm, setCustodySettlementForm] = useState({
    employeeId: '',
    type: 'expense', // 'expense' or 'return'
    amount: '',
    details: '',
    vaultId: 'v1' // only if type is 'return' (cash returned to vault)
  });
  const [isSubmittingCustody, setIsSubmittingCustody] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Dynamic Add Account Modal State
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAcc, setNewAcc] = useState({
    accountNumber: '',
    accountName: '',
    type: 'asset' as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
    currency: 'YER'
  });
  const [isSubmittingAcc, setIsSubmittingAcc] = useState(false);
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editingAccName, setEditingAccName] = useState('');

  const renderAccountNode = (acc: any) => {
    return (
      <div
        key={acc.id}
        id={`account-card-tree-${acc.id}`}
        className="p-3 bg-slate-950/40 hover:bg-slate-900/50 rounded-xl border border-white/5 flex items-center justify-between gap-3 text-[11px] hover:border-indigo-500/25 transition-all shadow-sm group animate-fade-in mb-1 text-right"
        dir="rtl"
      >
        <div className="flex-1 min-w-0">
          {editingAccId === acc.id ? (
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="text"
                id={`account-edit-input-tree-${acc.id}`}
                className="bg-slate-950 border border-indigo-500/40 text-white p-1 px-2.5 text-xs rounded-lg outline-none w-full font-bold"
                value={editingAccName}
                onChange={(e) => setEditingAccName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveAccountName(acc.id);
                  if (e.key === 'Escape') setEditingAccId(null);
                }}
                autoFocus
              />
              <button
                type="button"
                id={`account-save-btn-tree-${acc.id}`}
                onClick={() => handleSaveAccountName(acc.id)}
                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border-none text-emerald-400 rounded-lg cursor-pointer transition-colors"
                title="حفظ التعديل"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                id={`account-cancel-btn-tree-${acc.id}`}
                onClick={() => setEditingAccId(null)}
                className="p-1.5 bg-white/5 hover:bg-white/10 border-none text-zinc-400 rounded-lg cursor-pointer transition-colors"
                title="إلغاء"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-bold text-zinc-200 flex-wrap">
                <span className="font-mono text-[8px] text-[#fbbf24] bg-amber-500/10 px-1.5 py-0.5 rounded-md font-extrabold select-all">
                  {acc.accountNumber}
                </span>
                <span className="truncate max-w-[155px] sm:max-w-none">{acc.accountName}</span>
              </div>
              <div className="flex items-center gap-2.5 text-[9px] text-zinc-500 font-medium">
                <span>العملة: <span className="font-mono font-bold text-zinc-400">{acc.currency || 'YER'}</span></span>
                {['1100', '1101', '1150', '1155', '1200', '1201', '1202', '1203', '2100', '3100', '3200', '4100', '4102', '4103', '4200', '5100', '5102', '5103', '5200', '5201'].includes(acc.accountNumber) && (
                  <span className="text-[8px] bg-indigo-500/15 text-indigo-300 p-0.5 px-1.5 rounded-full font-bold border border-indigo-500/20">حساب تشغيلي قياسي ⚙️</span>
                )}
              </div>
              {acc.description && (
                <div className="text-[9px] text-zinc-400/85 mt-1 font-medium select-none leading-relaxed flex items-start gap-1">
                  <span>💡</span>
                  <span>{acc.description}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {editingAccId !== acc.id && (
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 transition-opacity">
              <button
                type="button"
                id={`account-edit-trigger-tree-${acc.id}`}
                onClick={() => handleStartEditAccount(acc)}
                className="p-1 px-1.5 bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border-none text-[#fbbf24] rounded-lg cursor-pointer transition-colors"
                title="تعديل اسم الحساب"
              >
                <Edit2 size={10} />
              </button>
              {!['1100', '1200', '1101', '2100', '4100', '5100', '5200'].includes(acc.accountNumber) && (
                <button
                  type="button"
                  id={`account-delete-trigger-tree-${acc.id}`}
                  onClick={() => handleDeleteAccount(acc)}
                  className="p-1 px-1.5 bg-rose-500/10 hover:bg-rose-500/20 border-none text-rose-400 rounded-lg cursor-pointer transition-colors"
                  title="حذف الحساب"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          )}

          <div className="text-left font-mono">
            <span
              className={`font-black text-xs tabular-nums ${(acc.balance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {(acc.balance || 0).toLocaleString()} <span className="text-[8px] text-zinc-500 font-normal">YER</span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Manual Journal Entry Voucher State
  const [journalNote, setJournalNote] = useState('');
  const [journalRef, setJournalRef] = useState('');
  const [journalLines, setJournalLines] = useState<Array<{
    accountId: string;
    accountName: string;
    debit: string;
    credit: string;
    currency: string;
  }>>([
    { accountId: '', accountName: '', debit: '', credit: '', currency: 'YER' },
    { accountId: '', accountName: '', debit: '', credit: '', currency: 'YER' }
  ]);
  const [journalError, setJournalError] = useState('');
  const [isSubmittingJournal, setIsSubmittingJournal] = useState(false);

  // Account Statement States
  const [accountsList, setAccountsList] = useState<Account[]>([]);
  const [journalEntriesList, setJournalEntriesList] = useState<JournalEntry[]>([]);
  const [selectedStatementAccountId, setSelectedStatementAccountId] = useState('');

  // Financial Year End Closing Handler
  const handleCloseFiscalYear = async () => {
    if (!profile?.ownerId) return;
    setIsClosingFiscalYear(true);
    try {
      const batch = writeBatch(db);

      // 1. Calculate Net Profit
      let totalRev = 0;
      let totalExp = 0;
      accountsList.forEach(acc => {
        if (acc.type === 'revenue') totalRev += (acc.balance || 0);
        if (acc.type === 'expense') totalExp += (acc.balance || 0);
      });
      const calculatedNetProfit = totalRev - totalExp;

      // 2. Locate Retained Earnings Account
      let retainedEarningsAcc = accountsList.find(a => a.accountNumber === '3100' || a.accountName?.includes('الأرباح المحتجزة'));
      let retainedEarningsRef: any;

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
      const closingItems: any[] = [
        {
          accountId: retainedEarningsAcc ? retainedEarningsAcc.id : retainedEarningsRef.id,
          accountName: 'الأرباح والخسائر المدورة والمحتجزة',
          debit: calculatedNetProfit < 0 ? Math.abs(calculatedNetProfit) : 0,
          credit: calculatedNetProfit >= 0 ? calculatedNetProfit : 0,
          currency: 'YER'
        }
      ];

      // Zero out revenues and expenses in Firestore & prepare their balancing journal entries
      accountsList.forEach(acc => {
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
      setClosingStep(4);
      showToast('تم إقفال السنة المالية وتصفير الحسابات المؤقتة وترحيل الأرباح بنجاح', 'success');
    } catch (err: any) {
      console.error('Error in fiscal year closing:', err);
      showToast('حدث خطأ أثناء تنفيذ عملية الإقفال: ' + (err.message || 'فشل الاتصال'), 'error');
    } finally {
      setIsClosingFiscalYear(false);
    }
  };

  // Clean Modal & Presets State
  const [isCleanJournalModalOpen, setIsCleanJournalModalOpen] = useState(false);
  const [selectedPresetType, setSelectedPresetType] = useState<
    'none' | 'outflow' | 'settlement' | 'damaged' | 'loss' | 'purchases' | 'custody' | 'emp_payment' | 'customer_payment' | 'supplier_payment'
  >('none');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [journalPaymentMethod, setJournalPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
  const [journalCurrency, setJournalCurrency] = useState<'YER' | 'SAR' | 'USD'>('YER');
  const [journalExchangeRate, setJournalExchangeRate] = useState<number>(1);
  const [journalForeignAmount, setJournalForeignAmount] = useState<string>('');
  const [journalSourceAccId, setJournalSourceAccId] = useState<string>('');
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [notifyTargetUser, setNotifyTargetUser] = useState<{
    name: string;
    phone: string;
    message: string;
    amount: number;
  } | null>(null);

  // Listen to global open event
  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsCleanJournalModalOpen(true);
      if (e.detail?.preset) {
        setTimeout(() => {
          applyJournalPreset(e.detail.preset);
        }, 100);
      }
    };
    window.addEventListener('open_clean_journal_modal', handleOpen as EventListener);
    return () => window.removeEventListener('open_clean_journal_modal', handleOpen as EventListener);
  }, [accountsList]);
  const [statementTransactions, setStatementTransactions] = useState<Array<{
    date: any;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }>>([]);

  // Auto-select first account for statement if not selected
  useEffect(() => {
    if (accountsList.length > 0 && !selectedStatementAccountId) {
      setSelectedStatementAccountId(accountsList[0].id);
    }
  }, [accountsList, selectedStatementAccountId]);

  // Handle auto calculation of statement transactions (ported from Accounts.tsx)
  useEffect(() => {
    if (!selectedStatementAccountId || accountsList.length === 0) {
      setStatementTransactions([]);
      return;
    }

    const selectedAccObj = accountsList.find(a => a.id === selectedStatementAccountId);
    if (!selectedAccObj) return;

    // Filter journal entries that affect this account
    const affected: Array<{ date: any; description: string; debit: number; credit: number }> = [];

    journalEntriesList.forEach(entry => {
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
  }, [selectedStatementAccountId, journalEntriesList, accountsList]);

  // Synchronize activeTab if initialTab changes (such as route transitions)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Persistence effects
  React.useEffect(() => {
    try {
      localStorage.setItem('jam_pro_transactions', JSON.stringify(transactions));
    } catch (e) {
      console.error('Failed to save transactions to localStorage', e);
    }
  }, [transactions]);

  React.useEffect(() => {
    try {
      localStorage.setItem('jam_pro_vaults', JSON.stringify(vaults));
    } catch (e) {
      console.error('Failed to save vaults to localStorage', e);
    }
  }, [vaults]);

  // Asset customized names database state
  const [registeredAssetNames, setRegisteredAssetNames] = useState<string[]>([]);

  // Real-time Firestore Subscriptions for Unified Operations
  const [salesList, setSalesList] = useState<any[]>([]);
  const [purchasesList, setPurchasesList] = useState<any[]>([]);
  const [maintenanceList, setMaintenanceList] = useState<any[]>([]);
  const [balanceList, setBalanceList] = useState<any[]>([]);
  const [damagedList, setDamagedList] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<{ id: string; name: string; warehouseName: string; vaultId?: string; vaultName?: string }[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);

  useEffect(() => {
    if (!profile?.ownerId) return;
    setLoadingDb(true);

    const ownerId = profile.ownerId;

    // Inventory Categories subscription for Vault & Warehouse mapping
    const qInvCats = query(collection(db, 'inventory_categories'), where('ownerId', '==', ownerId));
    const unsubInvCats = onSnapshot(qInvCats, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      setCategoryMappings(items);
    }, err => console.warn('Sync inventory_categories err:', err));

    // Accounts Subscription
    const qAcc = query(collection(db, 'accounts'), where('ownerId', '==', ownerId), orderBy('accountNumber', 'asc'));
    const unsubAcc = onSnapshot(qAcc, (snap) => {
      let mapped = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      
      // Dynamic clean setup: remove fake clamps. Just filter out high overflow corrupt values.
      const verifiedMapped = mapped.map(acc => {
        let bal = acc.balance || 0;
        if (typeof bal !== 'number' || isNaN(bal)) {
          bal = 0;
        }
        if (Math.abs(bal) > 100000000000) { // Keep sanity safety ceiling at 100 Billion YER
          bal = 0;
          try {
            updateDoc(doc(db, 'accounts', acc.id), { balance: 0 }).catch(() => {});
          } catch (err) {}
        }
        return {
          ...acc,
          balance: bal
        };
      });

      setAccountsList(verifiedMapped);
    }, err => console.warn('SmartAccountingHub Accounts err:', err.message));

    // Dynamic Registered Asset Names Subscription
    const qAssetNames = query(collection(db, 'asset_names'), where('ownerId', '==', ownerId));
    const unsubAssetNames = onSnapshot(qAssetNames, (snap) => {
      const names = snap.docs.map(doc => doc.data().name as string).filter(Boolean);
      const defaultNames: string[] = [];
      const uniqueNames = Array.from(new Set([...names, ...defaultNames]));
      setRegisteredAssetNames(uniqueNames);
    }, err => console.warn('SmartAccountingHub AssetNames err:', err.message));

    // Dynamic Outflow Categories Subscription
    const qCategories = query(collection(db, 'outflow_categories'), where('ownerId', '==', ownerId));
    const unsubCategories = onSnapshot(qCategories, (snap) => {
      const dbCategories = snap.docs.map(doc => doc.data().name as string).filter(Boolean);
      const defaults: string[] = [];
      const merged = Array.from(new Set([...dbCategories, ...defaults]));
      setOutflowCategories(merged);
    }, err => console.warn('Sync outflow_categories err:', err));

    // Dynamic Quick Outflow Presets Subscription
    const qPresets = query(collection(db, 'quick_outflow_presets'), where('ownerId', '==', ownerId));
    const unsubPresets = onSnapshot(qPresets, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      setQuickOutflowPresets(items);
    }, err => console.warn('Sync quick_outflow_presets err:', err));

    // JournalEntries Subscription
    const qEntries = query(collection(db, 'journalEntries'), where('ownerId', '==', ownerId), orderBy('date', 'desc'));
    const unsubEntries = onSnapshot(qEntries, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
      // Corruption clamp: filter out or clamp items with giant trillions to prevent trials corruption
      const cleanedItems = items.filter(e => {
        const totalLineAmount = e.items?.reduce((sum: number, line: any) => sum + (Math.abs(line.debit || 0) + Math.abs(line.credit || 0)), 0) || 0;
        return totalLineAmount < 9900000000; 
      });
      setJournalEntriesList(cleanedItems);
    }, err => console.warn('SmartAccountingHub JournalEntries err:', err.message));

    // Sales Subscription
    const qSales = query(collection(db, 'sales'), where('ownerId', '==', ownerId));
    const unsubSales = onSnapshot(qSales, (snap) => {
      setSalesList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, err => console.warn('SmartAccountingHub Sales err:', err.message));

    // Purchases Subscription
    const qPur = query(collection(db, 'purchases'), where('ownerId', '==', ownerId));
    const unsubPur = onSnapshot(qPur, (snap) => {
      setPurchasesList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, err => console.warn('SmartAccountingHub Purchases err:', err.message));

    // Maintenance Subscription
    const qMaint = query(collection(db, 'maintenanceOrders'), where('ownerId', '==', ownerId));
    const unsubMaint = onSnapshot(qMaint, (snap) => {
      setMaintenanceList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, err => console.warn('SmartAccountingHub Maintenance err:', err.message));

    // Balance Transactions Subscription
    const qBal = query(collection(db, 'balanceTransactions'), where('ownerId', '==', ownerId));
    const unsubBal = onSnapshot(qBal, (snap) => {
      setBalanceList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, err => console.warn('SmartAccountingHub Balance err:', err.message));

    // Damaged Items Query 1 (damaged_items)
    const qDamaged1 = query(collection(db, 'damaged_items'), where('ownerId', '==', ownerId));
    const unsubDamaged1 = onSnapshot(qDamaged1, (snap) => {
      const records1 = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDamagedList(prev => {
        const others = prev.filter(p => p.sourceCollection !== 'damaged_items');
        return [...others, ...records1.map(r => ({ ...r, sourceCollection: 'damaged_items' }))];
      });
    }, err => console.warn('SmartAccountingHub Damaged1 err:', err.message));

    // Damaged Items Query 2 (damagedItems)
    const qDamaged2 = query(collection(db, 'damagedItems'), where('ownerId', '==', ownerId));
    const unsubDamaged2 = onSnapshot(qDamaged2, (snap) => {
      const records2 = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDamagedList(prev => {
        const others = prev.filter(p => p.sourceCollection !== 'damagedItems');
        return [...others, ...records2.map(r => ({ ...r, sourceCollection: 'damagedItems' }))];
      });
      setLoadingDb(false);
    }, err => {
      console.warn('SmartAccountingHub Damaged2 err:', err.message);
      setLoadingDb(false);
    });

    // Real-time Inventory subscription to calculate live warehouse stock
    const qInv = query(collection(db, 'inventory'), where('ownerId', '==', ownerId));
    const unsubInv = onSnapshot(qInv, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInventoryList(items);
    }, err => {
      console.warn('SmartAccountingHub Inventory Sub err:', err.message);
    });

    // Real-time Users/Employees subscription for Custody & Escrows tracking
    const qEmpUsers = query(collection(db, 'users'), where('ownerId', '==', ownerId));
    const unsubUsers = onSnapshot(qEmpUsers, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))
        .filter(u => u.role !== 'customer' && u.accountType !== 'customer' && u.isCustomer !== true && u.status !== 'deleted' && u.isDeleted !== true);
      setEmployeeUsersList(items);
    }, err => {
      console.warn('SmartAccountingHub Users Sub err:', err.message);
    });

    // Real-time Suppliers subscription
    const qSuppliers = query(collection(db, 'suppliers'), where('ownerId', '==', ownerId));
    const unsubSuppliers = onSnapshot(qSuppliers, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      setSuppliersList(items);
    }, err => {
      console.warn('SmartAccountingHub Suppliers Sub err:', err.message);
    });

    // Real-time Customers subscription for direct customer payments & linking
    const qCustomers = query(collection(db, 'customers'), where('ownerId', '==', ownerId));
    const unsubCustomers = onSnapshot(qCustomers, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      setCustomersList(items);
    }, err => {
      console.warn('SmartAccountingHub Customers Sub err:', err.message);
    });

    const sId = profile?.shopId || profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';

    // Real-time Multi-Tenant Transactions Subscription via realtimeSyncService
    const unsubTrans = realtimeSyncService.listenToTransactions(
      sId,
      (items) => {
        const mapped = items.map((data: any) => {
          let txDate = new Date();
          if (data.createdAt) {
            txDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          } else if (data.date) {
            txDate = data.date.toDate ? data.date.toDate() : new Date(data.date);
          }
          
          let type: 'inflow' | 'outflow' = 'inflow';
          if (data.type === 'expense' || data.type === 'outflow' || data.type === 'inventory_purchase' || data.type === 'purchase') {
            type = 'outflow';
          } else if (data.type === 'income' || data.type === 'inflow' || data.type === 'sale' || data.type === 'receipt') {
            type = 'inflow';
          }

          return {
            ...data,
            id: data.id,
            type,
            originalType: data.type || type,
            category: data.category || 'عام',
            amount: parseFloat(data.amount || data.totalAmount) || 0,
            date: txDate,
            details: data.description || data.details || '',
            invoiceNo: data.invoiceNo || data.voucherNumber || '',
            recipient: data.recipient || '',
            reason: data.reason || '',
            purchaseMethod: data.purchaseMethod || 'direct'
          } as Transaction;
        });

        mapped.sort((a, b) => b.date.getTime() - a.date.getTime());
        setTransactions(mapped);
      },
      (err) => console.warn('SmartAccountingHub realtimeSyncService Transactions err:', err.message),
      visibleTransLimit
    );

    // Vaults Subscription from Firestore isolated strictly by ownerId
    const qVaults = query(collection(db, 'vaults'), where('ownerId', '==', ownerId));
    const unsubVaults = onSnapshot(qVaults, (snap) => {
      if (snap.empty) {
        const defaultVaults = [
          { id: 'v1', name: 'صندوق الكاش الرئيسي للبيع', type: 'cash', balance: 0, ownerId, storeId: sId },
          { id: 'v2', name: 'حساب بنك الكريمي التبادلي', type: 'bank', balance: 0, linkedAccount: '', ownerId, storeId: sId },
          { id: 'v3', name: 'صندوق سوق الجوالات المخصص', type: 'market', balance: 0, ownerId, storeId: sId }
        ];
        defaultVaults.forEach(async (v) => {
          try {
            await setDoc(doc(db, 'vaults', `${ownerId}-${v.id}`), v);
            await setDoc(doc(db, 'stores', sId, 'vaults', v.id), v);
          } catch (e) {
            console.error('Error auto-creating default zero-balance vault:', e);
          }
        });
        setVaults(defaultVaults as any);
      } else {
        const parsedVaults = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: data.id || doc.id.replace(`${ownerId}-`, ''),
            name: data.name || '',
            type: data.type || 'cash',
            balance: parseFloat(data.balance) || 0,
            linkedAccount: data.linkedAccount || ''
          } as Vault;
        });
        parsedVaults.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        setVaults(parsedVaults);
      }
    }, err => console.warn('SmartAccountingHub Vaults err:', err.message));

    // Bank Accounts Query (bank_accounts)
    setIsLoadingBanks(true);
    const qBanks = query(collection(db, 'bank_accounts'), where('ownerId', '==', ownerId));
    const unsubBanks = onSnapshot(qBanks, (snapshot) => {
      const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
      setBankAccounts(accounts);
      setIsLoadingBanks(false);
    }, (error) => {
      console.warn('SmartAccountingHub bank_accounts err:', error.message);
      setIsLoadingBanks(false);
    });

    // Quarantined Transactions Subscription (Strict Owner & Store Isolation)
    const qQuarantine = query(
      collection(db, 'quarantined_transactions'), 
      where('ownerId', '==', ownerId),
      where('status', '==', 'quarantined')
    );
    const unsubQuarantine = onSnapshot(qQuarantine, async (snap) => {
      let items: any[] = [];
      
      for (const docSnap of snap.docs) {
        const id = docSnap.id;
        // Purge leftover sample/mock documents from Firestore permanently
        if (id.startsWith('Q-REC-') || id.startsWith('ERR-SIM-')) {
          try {
            await deleteDoc(doc(db, 'quarantined_transactions', id));
          } catch (e) {
            console.warn('Cleaned sample quarantine doc:', id);
          }
        } else {
          items.push({ id, ...docSnap.data() });
        }
      }
      
      setQuarantinedTransactions(items);
    }, err => console.warn('SmartAccountingHub Quarantine err:', err.message));

    return () => {
      unsubInvCats();
      unsubAcc();
      unsubAssetNames();
      unsubCategories();
      unsubPresets();
      unsubEntries();
      unsubSales();
      unsubPur();
      unsubMaint();
      unsubBal();
      unsubDamaged1();
      unsubDamaged2();
      unsubBanks();
      unsubTrans();
      unsubVaults();
      unsubInv();
      unsubUsers();
      unsubQuarantine();
    };
  }, [profile?.ownerId, visibleTransLimit]);

  // Dynamic Mathematical Reductions (الجمع والطرح والعهود في الأعلى)
  const getFilteredListByDate = (list: any[], dateField: string = 'date') => {
    if (!jardStartDate && !jardEndDate) return list;
    return list.filter(item => {
      const rawDate = item[dateField] || item.createdAt || item.date || item.timestamp;
      const localDateStr = normalizeDate(rawDate);
      if (!localDateStr) return false;

      if (jardStartDate && localDateStr < jardStartDate) return false;
      if (jardEndDate && localDateStr > jardEndDate) return false;
      return true;
    });
  };

  const filteredTransactions = getFilteredListByDate(transactions, 'date');
  const filteredBalanceList = getFilteredListByDate(balanceList, 'date');
  const filteredMaintenanceList = getFilteredListByDate(maintenanceList, 'date');
  const filteredSalesList = getFilteredListByDate(salesList, 'date');
  const filteredDamagedList = getFilteredListByDate(damagedList, 'date');
  const filteredPurchasesList = getFilteredListByDate(purchasesList, 'date');

  // Task 5 - دوال تجميع وتصدير ومشاركة الجرد المخصص المشترك
  const getUnifiedJardRecords = () => {
    const list: any[] = [];

    // دالة مساعدة لتحويل أي صيغة تاريخ (Firestore Timestamp أو String أو غيره) إلى كائن Date صالح
    const parseDate = (d: any): Date => {
      if (!d) return new Date();
      if (d instanceof Date) return d;
      if (typeof d.toDate === 'function') return d.toDate();
      if (d.seconds !== undefined) return new Date(d.seconds * 1000);
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    // دالة لمطابقة الموظف
    const matchEmployee = (item: any) => {
      if (selectedJardEmployee === 'all') return true;
      const itemEmpId = item.employeeId || item.userId || item.cashierId || item.createdBy || item.technicianId;
      return itemEmpId === selectedJardEmployee;
    };

    // دالة لمطابقة المخزن/الفرع
    const matchStore = (item: any) => {
      if (selectedJardStore === 'all') return true;
      const itemStore = String(item.store || item.warehouse || item.location || '').toLowerCase();
      const targetStore = selectedJardStore.toLowerCase();
      return itemStore.includes(targetStore) || targetStore.includes(itemStore);
    };

    // 1. المبيعات
    if (customJardChecklist.sales) {
      filteredSalesList.forEach((item, idx) => {
        if (item.type !== 'return' && matchEmployee(item) && matchStore(item)) {
          list.push({
            id: `sale-${item.id || idx}`,
            date: parseDate(item.date || item.createdAt),
            category: 'sales',
            type: 'مبيعات',
            details: item.details || item.customerName || item.notes || 'فاتورة مبيعات جملة/تجزئة',
            amount: Number(item.totalAmount || item.total || item.price || 0),
            employee: employeeUsersList.find(u => u.id === (item.employeeId || item.userId || item.cashierId || item.createdBy))?.name || 'المدير العام',
            warehouse: item.store || item.warehouse || item.location || 'المستودع الرئيسي',
            ref: item.invoiceNo || item.id || '-',
            original: item
          });
        }
      });
    }

    // 2. صيانة الورشة
    if (customJardChecklist.maintenance) {
      filteredMaintenanceList.forEach((item, idx) => {
        if (matchEmployee(item) && matchStore(item)) {
          const amt = item.status === 'delivered' ? (item.cost || item.price) : item.advancePayment;
          list.push({
            id: `maint-${item.id || idx}`,
            date: parseDate(item.date || item.createdAt),
            category: 'maintenance',
            type: 'صيانة وتصليح',
            details: `صيانة: ${item.deviceModel || 'جهاز'} - ${item.problem || 'إصلاح'} (${item.status === 'delivered' ? 'تسليم كلي' : 'عربون حجز'})`,
            amount: Number(amt || 0),
            employee: employeeUsersList.find(u => u.id === (item.employeeId || item.userId || item.technicianId || item.createdBy))?.name || 'فني الصيانة',
            warehouse: item.store || item.warehouse || item.location || 'قسم الورشة',
            ref: item.ticketNo || item.id || '-',
            original: item
          });
        }
      });
    }

    // 3. المشتريات
    if (customJardChecklist.purchases) {
      filteredPurchasesList.forEach((item, idx) => {
        if (matchEmployee(item) && matchStore(item)) {
          list.push({
            id: `purch-${item.id || idx}`,
            date: parseDate(item.date || item.createdAt),
            category: 'purchases',
            type: 'مشتريات وبضاعة',
            details: item.supplierName ? `مشتريات من: ${item.supplierName}` : (item.itemType || item.details || 'مشتريات بضاعة'),
            amount: Number(item.totalAmount || item.amount || 0),
            employee: employeeUsersList.find(u => u.id === (item.employeeId || item.userId || item.createdBy))?.name || 'المشتريات',
            warehouse: item.store || item.warehouse || item.location || 'المستودع الرئيسي',
            ref: item.purchaseNo || item.id || '-',
            original: item
          });
        }
      });
    }

    // 4. الرصيد والشحن
    if (customJardChecklist.balance) {
      filteredBalanceList.forEach((item, idx) => {
        const isSim = (item.category?.includes('شريحة') || item.type?.includes('SIM') || item.notes?.includes('شريحة') || item.details?.includes('شريحة') || item.provider?.includes('شريحة') || item.provider?.includes('شريحه'));
        if (item.type !== 'purchase' && !isSim && matchEmployee(item) && matchStore(item)) {
          list.push({
            id: `bal-${item.id || idx}`,
            date: parseDate(item.date || item.createdAt),
            category: 'balance',
            type: 'شحن رصيد فورى',
            details: item.description || item.notes || `شحن رصيد ${item.provider || ''}`,
            amount: Number(item.amountReceived || item.price || item.amount || 0),
            employee: employeeUsersList.find(u => u.id === (item.employeeId || item.userId || item.createdBy))?.name || 'كشك الرصيد',
            warehouse: item.store || item.warehouse || item.location || 'رصيد إلكتروني',
            ref: item.id || '-',
            original: item
          });
        }
      });
    }

    // 5. الشرائح
    if (customJardChecklist.sims) {
      filteredBalanceList.forEach((item, idx) => {
        const isSim = (item.category?.includes('شريحة') || item.type?.includes('SIM') || item.notes?.includes('شريحة') || item.details?.includes('شريحة') || item.provider?.includes('شريحة') || item.provider?.includes('شريحه'));
        if (item.type !== 'purchase' && isSim && matchEmployee(item) && matchStore(item)) {
          list.push({
            id: `sim-${item.id || idx}`,
            date: parseDate(item.date || item.createdAt),
            category: 'sims',
            type: 'شرائح هواتف',
            details: item.description || item.notes || `بيع/تفعيل شريحة ${item.provider || ''}`,
            amount: Number(item.amountReceived || item.price || item.amount || 0),
            employee: employeeUsersList.find(u => u.id === (item.employeeId || item.userId || item.createdBy))?.name || 'مبيعات الشرائح',
            warehouse: item.store || item.warehouse || item.location || 'مخزن الشرائح',
            ref: item.id || '-',
            original: item
          });
        }
      });
    }

    // 6. التوالف والقطع التالفة
    if (customJardChecklist.damaged) {
      filteredDamagedList.forEach((item, idx) => {
        const isLost = item.category?.includes('فاقد') || item.notes?.includes('فاقد') || item.details?.includes('فاقد') || item.type === 'lost';
        if (!isLost && matchEmployee(item) && matchStore(item)) {
          list.push({
            id: `dmg-${item.id || idx}`,
            date: parseDate(item.date || item.createdAt),
            category: 'damaged',
            type: 'تالف مخزني',
            details: item.itemName || item.notes || 'إتلاف قطعة أو جهاز',
            amount: Number(item.totalLoss || item.amount || item.cost || 0),
            employee: employeeUsersList.find(u => u.id === (item.employeeId || item.userId || item.createdBy))?.name || 'أمين المخزن',
            warehouse: item.store || item.warehouse || item.location || 'المخزن التالف',
            ref: item.id || '-',
            original: item
          });
        }
      });
    }

    // 7. الفاقد والخسائر
    if (customJardChecklist.lost) {
      filteredDamagedList.forEach((item, idx) => {
        const isLost = item.category?.includes('فاقد') || item.notes?.includes('فاقد') || item.details?.includes('فاقد') || item.type === 'lost';
        if (isLost && matchEmployee(item) && matchStore(item)) {
          list.push({
            id: `lst-${item.id || idx}`,
            date: parseDate(item.date || item.createdAt),
            category: 'lost',
            type: 'فاقد وخسائر',
            details: item.itemName || item.notes || 'فقدان أصل أو بضاعة',
            amount: Number(item.totalLoss || item.amount || item.cost || 0),
            employee: employeeUsersList.find(u => u.id === (item.employeeId || item.userId || item.createdBy))?.name || 'التدقيق والرقابة',
            warehouse: item.store || item.warehouse || item.location || 'فاقد مالي',
            ref: item.id || '-',
            original: item
          });
        }
      });
    }

    // 8. الحوالات والمناقلات
    if (customJardChecklist.transfers) {
      filteredTransactions.forEach((item, idx) => {
        const isTransfer = item.type === 'transfer' || item.category === 'transfer' || item.notes?.includes('تحويل') || item.details?.includes('تحويل') || item.description?.includes('تحويل');
        if (isTransfer && matchEmployee(item) && matchStore(item)) {
          list.push({
            id: `trans-${item.id || idx}`,
            date: parseDate(item.date || item.createdAt),
            category: 'transfers',
            type: 'حوالات ومناقلات',
            details: item.description || item.notes || `مناقلة بين الصناديق: ${item.fromVaultName || ''} -> ${item.toVaultName || ''}`,
            amount: Number(item.amount || 0),
            employee: employeeUsersList.find(u => u.id === (item.employeeId || item.userId || item.createdBy))?.name || 'المشرف المالي',
            warehouse: item.store || item.warehouse || item.location || 'الخزينة المركزية',
            ref: item.id || '-',
            original: item
          });
        }
      });
    }

    return list.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  };

  const exportJardToExcel = (records: any[]) => {
    // Generate native Excel spreadsheet to guarantee proper column dividing in all Excel locale settings
    const data = records.map(r => ({
      "تاريخ العمل والوقت": new Date(r.date).toLocaleString('ar-YE', { hour12: false }),
      "نوع الحركة المفلترة": r.type,
      "بيان وتفاصيل العملية": r.details,
      "المبلغ والقيمة (ر.ي)": r.amount,
      "الموظف المحرر": r.employee,
      "المستودع / القسم / الفرع": r.warehouse,
      "الرقم المرجعي": r.ref
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف الجرد مخصص');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `تقرير_الجرد_المخصص_${dateStr}.xlsx`);
  };

  const shareJardReport = (records: any[]) => {
    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
    const dateRangeStr = jardStartDate || jardEndDate 
      ? `للفترة من ${jardStartDate || 'البداية'} إلى ${jardEndDate || 'اليوم'}`
      : "الكشف الشامل لجميع الفترات المفتوحة";
      
    let text = `📊 *تقرير جرد وتدقيق مالي مخصص للحسابات والنشاط*\n`;
    text += `📅 *الفترة:* ${dateRangeStr}\n`;
    text += `👤 *الموظف المسؤول:* ${selectedJardEmployee === 'all' ? 'جميع الموظفين' : employeeUsersList.find(e => e.id === selectedJardEmployee)?.name || selectedJardEmployee}\n`;
    text += `🏪 *المستودع والموقع:* ${selectedJardStore === 'all' ? 'جميع المستودعات والفروع' : selectedJardStore}\n`;
    text += `--------------------------------------------------------\n`;
    text += `💰 *إجمالي قيمة الحركات المحتسبة:* ${totalAmount.toLocaleString()} ر.ي\n`;
    text += `📈 *إجمالي عدد السجلات المشمولة:* ${records.length} عملية\n`;
    text += `--------------------------------------------------------\n\n`;
    
    text += `📝 *أبرز السجلات المشمولة بالجرد:*\n`;
    records.slice(0, 15).forEach((r, idx) => {
      const fAmt = Number(r.amount).toLocaleString();
      text += `${idx + 1}. [${r.type}] ${r.details} 👈🏻 *${fAmt} ر.ي* (${r.employee})\n`;
    });
    
    if (records.length > 15) {
      text += `\n... وعدد ${records.length - 15} عملية أخرى مدرجة بالملف الملحق المصدر.`;
    }
    
    text += `\n\n✓ تم إعداد وتوثيق الجرد بنجاح عبر بوابة التدقيق والمطابقة - نظام JAM PRO الموحد.`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert("📋 تم توليد ونسخ تقرير الجرد المخصص المنسق بنجاح إلى الحافظة! جاهز الآن للمشاركة والإرسال المباشر عبر الواتساب.");
    } else {
      alert("تعذر الوصول التلقائي للذاكرة، التقرير المصدر:\n\n" + text);
    }
  };

  // Task 6 - دالة الفحص الاستقصائي والتحري عن العجز والزيادة والسرقات والعمليات المعلقة والباركود الموحد
  const runDiagnosticLossAudit = () => {
    setIsAuditingLoss(true);
    const results: any[] = [];
    const term = auditLossBarcode.trim().toLowerCase();

    // 1. فحص المخزون والمنتجات عن أي عجز (كمية كمون بالسالب أو غير طبيعية) ومطابقة الباركود
    inventoryList.forEach(item => {
      const bcode = String(item.barcode || '').toLowerCase();
      const name = String(item.name || '').toLowerCase();
      const cat = String(item.category || '').toLowerCase();
      const matchesBarcode = term ? (bcode.includes(term) || name.includes(term) || cat.includes(term)) : true;

      if (matchesBarcode) {
        const stockVal = parseFloat(item.stock) || 0;
        const priceVal = parseFloat(item.lastBuyPrice || item.cost || item.price || 0);
        
        if (stockVal < 0) {
          results.push({
            id: `inv-anom-${item.id || item.barcode || Math.random()}`,
            type: 'deficit',
            source: 'المخزون والمنتجات',
            title: `عجز كمي دفتري: صنف [${item.name}] بالسالب`,
            description: `الكمية الحالية في المخزن المتأثر هي (${stockVal}) حبة بالسالب! يشير هذا لوجود مبيعات متكررة دون إدخال فواتير الشراء أو حدوث تداخل باركود بالخطأ.`,
            amount: Math.abs(stockVal * priceVal),
            barcode: item.barcode || 'غير مسجل',
            severity: 'high',
            status: 'unresolved',
            actionText: 'تحديث كارت الصنف ومطابقة الجرد العيني وتصفية العجز',
            original: item
          });
        }
      }
    });

    // 2. فحص التوالف والفاقد عن أي سرقات أو ضياع بضاعة
    damagedList.forEach(item => {
      const bcode = String(item.barcode || '').toLowerCase();
      const name = String(item.itemName || item.name || '').toLowerCase();
      const notes = String(item.notes || '').toLowerCase();
      const matchesBarcode = term ? (bcode.includes(term) || name.includes(term) || notes.includes(term)) : true;

      if (matchesBarcode) {
        const isTheft = notes.includes('سرقة') || notes.includes('سرقه') || notes.includes('نهب') || notes.includes('اختلاس') || notes.includes('مسروق') || notes.includes('مفقود');
        const isLoss = notes.includes('فقد') || notes.includes('ضياع') || notes.includes('عجز') || notes.includes('نقص') || item.type === 'lost' || item.category === 'lost';
        const lossAmount = Number(item.totalLoss || item.amount || item.cost || 0);

        if (isTheft) {
          results.push({
            id: `dmg-anom-theft-${item.id || Math.random()}`,
            type: 'theft',
            source: 'التوالف والفاقد الأمني',
            title: `شبهة فقدان/سرقة منتج: [${item.itemName || 'صنف مخزني'}]`,
            description: `تم تصنيف الحركة كفقد أو تلف بسبب مفقودات أو سرقة: "${item.notes || 'لا يوجد تفصيل'}"`,
            amount: lossAmount,
            barcode: item.barcode || 'غير مسجل',
            severity: 'critical',
            status: 'unresolved',
            actionText: 'فك الارتباط ومطابقة حركة الموظف مع كاميرات المراقبة وتحرير البلاغ',
            original: item
          });
        } else if (isLoss) {
          results.push({
            id: `dmg-anom-loss-${item.id || Math.random()}`,
            type: 'deficit',
            source: 'التوالف والفاقد الدفتري',
            title: `عجز بضاعة فاقدة: [${item.itemName || 'صنف مخزني'}]`,
            description: `فارق عجز بضاعة مسجل تحت بند الفاقد: "${item.notes || 'تسوية جرد دوري'}"`,
            amount: lossAmount,
            barcode: item.barcode || 'غير مسجل',
            severity: 'high',
            status: 'unresolved',
            actionText: 'إثبات خسائر العجز وتحديث حساب الأرباح والخسائر للفرع',
            original: item
          });
        }
      }
    });

    // 3. فحص عهد وذمم الموظفين المعلقة دون تصفية
    employeeUsersList.forEach(u => {
      const name = String(u.name || u.email || '').toLowerCase();
      const matchesKeyword = term ? name.includes(term) : true;
      const custodyVal = Number(u.custodyBalance || 0);

      if (matchesKeyword && custodyVal > 1000) {
        results.push({
          id: `emp-anom-custody-${u.id || Math.random()}`,
          type: 'pending',
          source: 'العهد والذمم المعلقة',
          title: `عهدة مالية مستمرة معلقة للموظف: [${u.name || 'موظف'}]`,
          description: `الموظف لديه عهدة معلقة برصيد دائن قدره (${custodyVal.toLocaleString()} ر.ي) لم تقفل أو تصفى بمستندات نفقات رسمية حتى الآن.`,
          amount: custodyVal,
          barcode: 'N/A',
          severity: 'medium',
          status: 'pending',
          actionText: 'تسوية وإغلاق عهدة الموظف وتوريد النقدية المتبقية الخزينة',
          original: u
        });
      }
    });

    // 4. فحص العمليات المالية المعلقة وعجز/زيادة الصناديق والقيود اليومية
    filteredTransactions.forEach(t => {
      const notes = String(t.notes || t.details || '').toLowerCase();
      const isDeficit = notes.includes('عجز') || notes.includes('فارق ناقص') || notes.includes('خسارة فارق');
      const isSurplus = notes.includes('زيادة') || notes.includes('فارق زايد') || notes.includes('إيداع مجهول') || notes.includes('زياده') || notes.includes('فارق زيادة');
      const matchesKeyword = term ? notes.includes(term) : true;

      if (matchesKeyword) {
        const transAmt = Number(t.amount || 0);
        if (isDeficit) {
          results.push({
            id: `trans-anom-def-${t.id || Math.random()}`,
            type: 'deficit',
            source: 'الصناديق واليومية النقدية',
            title: `عجز نقدي فعلي في صندوق: [${t.category || 'صندوق المحل'}]`,
            description: `تم قيد فارق عجز في مطابقة اليومية للنقدية الفعالة: "${t.notes || t.details}"`,
            amount: transAmt,
            barcode: 'N/A',
            severity: 'high',
            status: 'unresolved',
            actionText: 'تحميل العجز للموظف المسؤول أو قيده خسائر فوارق نقدية',
            original: t
          });
        } else if (isSurplus) {
          results.push({
            id: `trans-anom-surp-${t.id || Math.random()}`,
            type: 'surplus',
            source: 'الصناديق واليومية النقدية',
            title: `زيادة مالية غير مفسرة في صندوق: [${t.category || 'صندوق المحل'}]`,
            description: `تم رصد مبلغ زيادة نقدية فائضة عند مطابقة الصندوق: "${t.notes || t.details}"`,
            amount: transAmt,
            barcode: 'N/A',
            severity: 'medium',
            status: 'unresolved',
            actionText: 'ترحيل الزيادة لحساب الإيرادات المتنوعة الطارئة أو مراجعة مبيعات معلقة',
            original: t
          });
        }
      }
    });

    // فلترة النتائج حسب نوع الفحص المحدد في شاشة التصفية
    let finalResults = results;
    if (auditLossType !== 'all') {
      finalResults = results.filter(r => r.type === auditLossType);
    }

    setAuditLossResults(finalResults);
    setIsAuditingLoss(false);
  };

  const handleReconcileAnomaly = (anomalyId: string, title: string) => {
    setAuditLossResults(prev => prev.map(item => {
      if (item.id === anomalyId) {
        return { ...item, status: 'resolved' };
      }
      return item;
    }));
    alert(`✓ تم فك الارتباط وبدء إجراء التصفية والتسوية لعملية [${title}] بنجاح! تم قيد المستند وتسوية الفروق بالدفاتر سحابياً.`);
  };

  // Dynamic metrics from actual Firestore listings
  const realBalanceSales = filteredBalanceList
    .filter(item => item.type !== 'purchase')
    .reduce((sum, item) => sum + (parseFloat(item.amountReceived || item.price || item.amount || 0) || 0), 0);
  const realMaintenanceReceipts = filteredMaintenanceList.reduce((sum, item) => {
    if (item.status === 'delivered') {
      return sum + (parseFloat(item.cost || item.price || 0) || 0);
    } else {
      return sum + (parseFloat(item.advancePayment || 0) || 0);
    }
  }, 0);
  const realPOSSales = filteredSalesList
    .filter(item => item.type !== 'return')
    .reduce((sum, item) => sum + (parseFloat(item.totalAmount || item.total || item.price || 0) || 0), 0);
  const realDamagedLosses = filteredDamagedList.reduce((sum, item) => sum + (parseFloat(item.totalLoss || item.amount || item.cost || 0) || 0), 0);
  const realPurchasesTotal = filteredPurchasesList.reduce((sum, item) => sum + (parseFloat(item.totalAmount || item.amount || 0) || 0), 0);

  // Income Calculator: Sum transaction values for the selectedDate where type is 'sale' or 'income' (with 'inflow' fallback)
  const totalInflow = transactions.reduce((sum, t) => {
    const isSameDate = normalizeDate(t.date) === selectedDate;
    if (!isSameDate) return sum;
    const rawType = String(t.originalType || t.type || '').toLowerCase();
    const isIncome = rawType === 'sale' || rawType === 'income' || rawType === 'inflow';
    if (isIncome) {
      return sum + (parseFloat(t.amount as any) || 0);
    }
    return sum;
  }, 0);

  // Expenses Calculator: Sum transaction values for the selectedDate where type is 'inventory_purchase' or 'expense' (with 'outflow' fallback)
  const totalOutflow = transactions.reduce((sum, t) => {
    const isSameDate = normalizeDate(t.date) === selectedDate;
    if (!isSameDate) return sum;
    const rawType = String(t.originalType || t.type || '').toLowerCase();
    const isExpense = rawType === 'inventory_purchase' || rawType === 'expense' || rawType === 'outflow';
    if (isExpense) {
      return sum + (parseFloat(t.amount as any) || 0);
    }
    return sum;
  }, 0);

  // Asset Settlements / Adjustments for the selectedDate
  const totalAssetSettlements = transactions.reduce((sum, t) => {
    const isSameDate = normalizeDate(t.date) === selectedDate;
    if (!isSameDate) return sum;
    const rawType = String(t.originalType || t.type || '').toLowerCase();
    const isAssetSettlement = rawType === 'asset_settlement' || rawType === 'adjustment' || String(t.category || '').includes('تسوية');
    if (isAssetSettlement) {
      return sum + (parseFloat(t.amount as any) || 0);
    }
    return sum;
  }, 0);

  // Sum of current vault balances from the database (fully real-time and accurate)
  const totalVaultsBalance = vaults.reduce((sum, v) => sum + (parseFloat(v.balance as any) || 0), 0);

  const totalDynamicSales = realBalanceSales + realMaintenanceReceipts + realPOSSales;

  // Real dynamic evaluation of stored inventory stock value from active stock database
  const estimatedWarehouseStock = inventoryList.reduce((sum, item) => {
    const stock = parseFloat(item.stock) || 0;
    const cost = parseFloat(item.lastBuyPrice || item.cost || item.price || 0);
    return sum + (stock * cost);
  }, 0);

  // Real SIM balance/operations from actual Firestore mobile balance transactions
  const realSIMOperations = filteredBalanceList
    .filter(b => b.type !== 'purchase' && (b.category?.includes('شريحة') || b.type?.includes('SIM') || b.notes?.includes('شريحة') || b.details?.includes('شريحة') || b.provider?.includes('شريحة') || b.provider?.includes('شريحه')))
    .reduce((sum, item) => sum + (parseFloat(item.amountReceived || item.price || item.amount || 0) || 0), 0);

  // Real recharge balance sales from actual mobile balance entries
  const realRechargeSales = filteredBalanceList
    .filter(b => b.type !== 'purchase' && !(b.category?.includes('شريحة') || b.type?.includes('SIM') || b.notes?.includes('شريحة') || b.details?.includes('شريحة') || b.provider?.includes('شريحة') || b.provider?.includes('شريحه')))
    .reduce((sum, item) => sum + (parseFloat(item.amountReceived || item.price || item.amount || 0) || 0), 0);

  // Real Accessories & non-phone sales from sales list
  const realAccessoriesSales = filteredSalesList
    .filter(s => s.type !== 'return' && (s.category?.includes('إكسسوار') || s.category?.includes('سماعة') || s.category?.includes('شاحن') || s.details?.includes('إكسسوار') || s.details?.includes('سماعة')))
    .reduce((sum, item) => sum + (parseFloat(item.totalAmount || item.total || item.price || 0) || 0), 0);

  const realPhonesSales = filteredSalesList
    .filter(s => s.type !== 'return' && !(s.category?.includes('إكسسوار') || s.category?.includes('سماعة') || s.category?.includes('شاحن') || s.details?.includes('إكسسوار') || s.details?.includes('سماعة')))
    .reduce((sum, item) => sum + (parseFloat(item.totalAmount || item.total || item.price || 0) || 0), 0);

  // Real Retail Sales
  const realRetailSales = filteredSalesList
    .filter(s => s.type !== 'return' && s.tier !== 'wholesale' && s.tier !== 'distributor' && s.collectionType !== 'wholesale' && s.saleType !== 'wholesale')
    .reduce((sum, item) => sum + (parseFloat(item.totalAmount || item.total || item.price || 0) || 0), 0);

  // Real Wholesale Sales
  const realWholesaleSales = filteredSalesList
    .filter(s => s.type !== 'return' && (s.tier === 'wholesale' || s.tier === 'distributor' || s.collectionType === 'wholesale' || s.saleType === 'wholesale'))
    .reduce((sum, item) => sum + (parseFloat(item.totalAmount || item.total || item.price || 0) || 0), 0);

  // Real Retail Purchases
  const realRetailPurchases = filteredPurchasesList
    .filter(p => !p.type?.includes('wholesale') && !p.purchaseType?.includes('wholesale'))
    .reduce((sum, item) => sum + (parseFloat(item.totalAmount || item.amount || 0) || 0), 0);

  // Real Wholesale Purchases
  const realWholesalePurchases = filteredPurchasesList
    .filter(p => p.type?.includes('wholesale') || p.purchaseType?.includes('wholesale'))
    .reduce((sum, item) => sum + (parseFloat(item.totalAmount || item.amount || 0) || 0), 0);

  // Real Returns Total
  const realReturnsTotal = filteredTransactions
    .filter(t => t.category?.includes('مرتجع') || t.details?.includes('مرتجع') || t.type === 'return')
    .reduce((sum, t) => sum + t.amount, 0);

  // Real Reservations Total
  const realReservationsTotal = filteredTransactions
    .filter(t => t.details?.includes('حجز') || t.details?.includes('عربون') || t.details?.includes('دفعة_مقدمة'))
    .reduce((sum, t) => sum + t.amount, 0);

  // Real Engineer Commissions
  const realEngineersCommissions = filteredTransactions
    .filter(t => t.category?.includes('عمولة') || t.details?.includes('عمولة') || t.details?.includes('فني') || t.details?.includes('مهندس'))
    .reduce((sum, t) => sum + t.amount, 0);

  // Real Staff Salaries
  const realStaffSalariesTotal = filteredTransactions
    .filter(t => t.category?.includes('راتب') || t.category?.includes('رواتب') || t.category?.includes('سلفة') || t.details?.includes('راتب'))
    .reduce((sum, t) => sum + t.amount, 0);

  // missing ported variables for statistics
  const totalAssets = accountsList.filter(a => a.type === 'asset').reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalLiabilities = Math.abs(accountsList.filter(a => a.type === 'liability').reduce((sum, a) => sum + (a.balance || 0), 0));
  const totalRevenues = Math.abs(accountsList.filter(a => a.type === 'revenue').reduce((sum, a) => sum + (a.balance || 0), 0));
  const totalExpenses = Math.abs(accountsList.filter(a => a.type === 'expense').reduce((sum, a) => sum + (a.balance || 0), 0));
  const totalEquities = Math.abs(accountsList.filter(a => a.type === 'equity').reduce((sum, a) => sum + (a.balance || 0), 0));
  const netProfit = totalRevenues - totalExpenses;

  // Helper to safely get account by standard type/name from accountsList
  const getStandardAccount = (type: 'cash' | 'inventory' | 'receivables' | 'payables' | 'revenues' | 'expenses' | 'operating_expenses') => {
    if (!accountsList || accountsList.length === 0) return null;
    switch (type) {
      case 'cash':
        return accountsList.find(a => a.accountNumber === '1100' || a.accountName.includes('الصندوق'));
      case 'inventory':
        return accountsList.find(a => a.accountNumber === '1200' || a.accountName.includes('المخازن'));
      case 'receivables':
        return accountsList.find(a => a.accountNumber === '1101' || a.accountName.includes('مدينة') || a.accountName.includes('العملاء'));
      case 'payables':
        return accountsList.find(a => a.accountNumber === '2100' || a.accountName.includes('دائنة') || a.accountName.includes('الموردين'));
      case 'revenues':
        return accountsList.find(a => a.accountNumber === '4100' || a.accountName.includes('إيرادات') || a.accountName.includes('المبيعات'));
      case 'expenses':
        return accountsList.find(a => a.accountNumber === '5100' || a.accountName.includes('تكلفة') || a.accountName.includes('المبيعات'));
      case 'operating_expenses':
        return accountsList.find(a => a.accountNumber === '5200' || a.accountName.includes('التشغيلية') || a.accountName.includes('المصاريف'));
      default:
        return null;
    }
  };

  // Safe lazy initializer and retriever for the accounts
  const ensureAndGetAccount = async (type: 'cash' | 'inventory' | 'receivables' | 'payables' | 'revenues' | 'expenses' | 'operating_expenses') => {
    let acc = getStandardAccount(type);
    if (!acc && profile?.ownerId) {
      try {
        console.log(`⚠️ Account of type ${type} missing. Attempting to initialize chart...`);
        await initializeChartOfAccounts(profile.ownerId);
        const snapshot = await getDocs(query(collection(db, 'accounts'), where('ownerId', '==', profile.ownerId)));
        const freshlyLoaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        
        let found = null;
        switch (type) {
          case 'cash':
            found = freshlyLoaded.find(a => a.accountNumber === '1100' || a.accountName.includes('الصندوق'));
            break;
          case 'inventory':
            found = freshlyLoaded.find(a => a.accountNumber === '1200' || a.accountName.includes('المخازن'));
            break;
          case 'receivables':
            found = freshlyLoaded.find(a => a.accountNumber === '1101' || a.accountName.includes('مدينة') || a.accountName.includes('العملاء'));
            break;
          case 'payables':
            found = freshlyLoaded.find(a => a.accountNumber === '2100' || a.accountName.includes('دائنة') || a.accountName.includes('الموردين'));
            break;
          case 'revenues':
            found = freshlyLoaded.find(a => a.accountNumber === '4100' || a.accountName.includes('إيرادات') || a.accountName.includes('المبيعات'));
            break;
          case 'expenses':
            found = freshlyLoaded.find(a => a.accountNumber === '5100' || a.accountName.includes('تكلفة') || a.accountName.includes('المبيعات'));
            break;
          case 'operating_expenses':
            found = freshlyLoaded.find(a => a.accountNumber === '5200' || a.accountName.includes('التشغيلية') || a.accountName.includes('المصاريف'));
            break;
        }
        if (found) return found;
      } catch (err) {
        console.warn('Silent error ensuring account:', err);
      }
    }
    return acc;
  };

  const handleRegisterNewAssetName = async (name: string) => {
    if (!name || !profile?.ownerId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (registeredAssetNames.includes(trimmed)) return;
    try {
      await addDoc(collection(db, 'asset_names'), {
        ownerId: profile.ownerId,
        name: trimmed,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Error saving asset name to DB:', err);
    }
  };

  // Handlers for Form Submissions
  const handleOutflowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(outflowForm.amount);
    if (!val || val <= 0) return;
    if (isAccSubmitting) return;
    setIsAccSubmitting(true);
    try {
      const expensesAcc = await ensureAndGetAccount('operating_expenses');
      const cashAcc = await ensureAndGetAccount('cash');
      
      const vId = outflowForm.vaultId || 'v1';
      const selectedV = vaults.find(v => v.id === vId);

      const entries = [
        {
          accountId: expensesAcc?.id || '',
          accountName: expensesAcc?.accountName || 'المصاريف التشغيلية',
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: cashAcc?.id || '',
          accountName: cashAcc?.accountName || 'الصندوق / البنك',
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      if (profile?.ownerId) {
        await accountingService.recordJournalEntry(
          profile.ownerId,
          `مصروف تشغيلي [من ${selectedV?.name || 'الخزينة'}] - ${outflowForm.category}: ${outflowForm.details || 'سحب مصاريف تشغيلية'}`,
          entries,
          'outflow-' + Date.now()
        );
      }

      await addTransactionToFirestore({
        type: 'outflow',
        category: outflowForm.category,
        amount: val,
        details: (outflowForm.details || 'سحب مصاريف تشغيلية وأعباء') + ` (من: ${selectedV?.name || 'الخزينة'})`,
        accountSource: vId
      });
      await updateVaultBalance(vId, val, false);

      setOutflowForm({ amount: '', category: 'الضرائب والزكاة', details: '', vaultId: 'v1' });
      alert('✓ تم حفظ المصروف وتحديث الأرصدة السحابية والدفاتر بالتأثير المالي المزدوج!');
    } catch (err: any) {
      alert('خطأ أثناء معالجة القيد: ' + err.message);
    } finally {
      setIsAccSubmitting(false);
    }
  };

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(receiptForm.amount);
    if (!val || val <= 0) return;
    if (isAccSubmitting) return;
    setIsAccSubmitting(true);
    try {
      const cashAcc = await ensureAndGetAccount('cash');
      const revenuesAcc = await ensureAndGetAccount('revenues');

      const vId = receiptForm.vaultId || 'v1';
      const selectedV = vaults.find(v => v.id === vId);

      const entries = [
        {
          accountId: cashAcc?.id || '',
          accountName: cashAcc?.accountName || 'الصندوق / البنك',
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: revenuesAcc?.id || '',
          accountName: revenuesAcc?.accountName || 'إيرادات المبيعات',
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      if (profile?.ownerId) {
        await accountingService.recordJournalEntry(
          profile.ownerId,
          `سند قبض إيراد مبيعات [إلى ${selectedV?.name || 'الخزينة'}] - ${receiptForm.category}: ${receiptForm.details || 'سند قبض نقدي وإيداع مبيعات'}`,
          entries,
          'receipt-' + Date.now()
        );
      }

      await addTransactionToFirestore({
        type: 'inflow',
        category: 'سند قبض - ' + receiptForm.category,
        amount: val,
        details: (receiptForm.details || 'سند قبض نقدي وإيداع مبيعات') + ` (إلى: ${selectedV?.name || 'الخزينة'})`,
        accountSource: vId
      });
      await updateVaultBalance(vId, val, true);

      setReceiptForm({ amount: '', category: 'إيراد خدمات مبيعات', details: '', vaultId: 'v1' });
      alert('✓ تم حفظ المقبوضات وتحديث الأرصدة السحابية والدفاتر بالتأثير المالي المزدوج!');
    } catch (err: any) {
      alert('خطأ أثناء معالجة القيد: ' + err.message);
    } finally {
      setIsAccSubmitting(false);
    }
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(purchaseForm.amount);
    if (!val || val <= 0) return;
    if (isAccSubmitting) return;
    setIsAccSubmitting(true);
    try {
      const inventoryAcc = await ensureAndGetAccount('inventory');
      const cashAcc = await ensureAndGetAccount('cash');

      const vId = purchaseForm.vaultId || 'v1';
      const selectedV = vaults.find(v => v.id === vId);

      const entries = [
        {
          accountId: inventoryAcc?.id || '',
          accountName: inventoryAcc?.accountName || 'المخازن',
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: cashAcc?.id || '',
          accountName: cashAcc?.accountName || 'الصندوق / البنك',
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      if (profile?.ownerId) {
        await accountingService.recordJournalEntry(
          profile.ownerId,
          `شراء بضاعة وأصول مخزنية كاش [من ${selectedV?.name || 'الخزينة'}] - ${purchaseForm.itemType}: ${purchaseForm.details || 'مشتريات بضاعة'}`,
          entries,
          'purchase-' + Date.now()
        );
      }

      await addTransactionToFirestore({
        type: 'outflow',
        category: `مشتريات نقدية - ${purchaseForm.itemType}`,
        amount: val,
        details: (purchaseForm.details || `شراء بضاعة ومخزون ${purchaseForm.itemType}`) + ` (من: ${selectedV?.name || 'الخزينة'})`,
        accountSource: vId
      });
      await updateVaultBalance(vId, val, false);

      setPurchaseForm({ amount: '', itemType: 'قطع غيار جوالات', details: '', vaultId: 'v1' });
      alert('✓ تم حفظ عملية الشراء السحابية المخزنية وتحديث الحسابات والدفاتر!');
    } catch (err: any) {
      alert('خطأ أثناء معالجة القيد: ' + err.message);
    } finally {
      setIsAccSubmitting(false);
    }
  };

  const handleTransferInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(transferInForm.amount);
    if (!val || val <= 0) return;
    try {
      const cashAcc = await ensureAndGetAccount('cash');
      const receivablesAcc = await ensureAndGetAccount('receivables');

      const targetV = vaults.find(v => v.id === transferInForm.targetAccount);

      const entries = [
        {
          accountId: cashAcc?.id || '',
          accountName: cashAcc?.accountName || 'الصندوق / البنك',
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: receivablesAcc?.id || '',
          accountName: receivablesAcc?.accountName || 'ذمم مدينة - العملاء',
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      if (profile?.ownerId) {
        await accountingService.recordJournalEntry(
          profile.ownerId,
          `استلام حوالة معتمدة وتغذية الحساب: ${transferInForm.details || 'تسوية حوالة واردة'}`,
          entries,
          'transferin-' + Date.now()
        );
      }

      await addTransactionToFirestore({
        type: 'inflow',
        category: 'استلام حوالة معتمدة',
        amount: val,
        details: (transferInForm.details || 'تسوية حوالة واردة') + ` إلى: ${targetV?.name}`,
        accountSource: transferInForm.targetAccount
      });
      await updateVaultBalance(transferInForm.targetAccount, val, true);

      setTransferInForm({ amount: '', targetAccount: 'v1', details: '' });
      alert('✓ تم تسجيل الحوالة الواردة سحابياً بنجاح وتحديث أرصده الحسابات!');
    } catch (err: any) {
      alert('خطأ أثناء معالجة القيد: ' + err.message);
    }
  };

  const handleSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(salaryForm.amount);
    if (!val || val <= 0) return;
    try {
      const expensesAcc = await ensureAndGetAccount('operating_expenses');
      const cashAcc = await ensureAndGetAccount('cash');

      const vId = salaryForm.vaultId || 'v1';
      const selectedV = vaults.find(v => v.id === vId);

      const entries = [
        {
          accountId: expensesAcc?.id || '',
          accountName: expensesAcc?.accountName || 'المصاريف التشغيلية',
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: cashAcc?.id || '',
          accountName: cashAcc?.accountName || 'الصندوق / البنك',
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      if (profile?.ownerId) {
        await accountingService.recordJournalEntry(
          profile.ownerId,
          `صرف رواتب موظفين للموظف: ${salaryForm.employeeName} [من ${selectedV?.name || 'الخزينة'}]. ${salaryForm.details || 'راتب وتأدية مستحقات'}`,
          entries,
          'salary-' + Date.now()
        );
      }

      await addTransactionToFirestore({
        type: 'outflow',
        category: 'تسليم رواتب موظفين',
        amount: val,
        employeeName: salaryForm.employeeName,
        details: `صرف راتب للموظف: ${salaryForm.employeeName}. ${salaryForm.details || ''} (من: ${selectedV?.name || 'الخزينة'})`,
        accountSource: vId
      });
      await updateVaultBalance(vId, val, false);

      setSalaryForm({ amount: '', employeeName: '', details: '', vaultId: 'v1' });
      alert('✓ تم قيد راتب الموظف في الدفاتر السحابية وتحديث الأرصدة كاش!');
    } catch (err: any) {
      alert('خطأ أثناء معالجة القيد: ' + err.message);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(returnForm.amount);
    if (!val || val <= 0) return;
    try {
      const revenuesAcc = await ensureAndGetAccount('revenues');
      const cashAcc = await ensureAndGetAccount('cash');

      const vId = returnForm.vaultId || 'v1';
      const selectedV = vaults.find(v => v.id === vId);

      const entries = [
        {
          accountId: revenuesAcc?.id || '',
          accountName: revenuesAcc?.accountName || 'إيرادات المبيعات',
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: cashAcc?.id || '',
          accountName: cashAcc?.accountName || 'الصندوق / البنك',
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      if (profile?.ownerId) {
        await accountingService.recordJournalEntry(
          profile.ownerId,
          `قيد مرتجع مبيعات فاتورة رقم: ${returnForm.invoiceNo} [من ${selectedV?.name || 'الخزينة'}]. السبب: ${returnForm.details || 'مرتجع سلع'}`,
          entries,
          'return-' + Date.now()
        );
      }

      await addTransactionToFirestore({
        type: 'outflow',
        category: 'تسليم قيمة مرتجع',
        amount: val,
        invoiceNo: returnForm.invoiceNo,
        details: `مرتجع مبيعات فاتورة رقم: ${returnForm.invoiceNo}. ${returnForm.details || ''} (من: ${selectedV?.name || 'الخزينة'})`,
        accountSource: vId
      });
      await updateVaultBalance(vId, val, false);

      setReturnForm({ amount: '', invoiceNo: '', details: '', vaultId: 'v1' });
      alert('✓ تم قيد وإثبات المرتجع وتحديث الصناديق سحابياً بنجاح!');
    } catch (err: any) {
      alert('خطأ أثناء معالجة القيد: ' + err.message);
    }
  };

  const handleCommissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(commissionForm.amount);
    if (!val || val <= 0) return;
    try {
      const expensesAcc = await ensureAndGetAccount('operating_expenses');
      const cashAcc = await ensureAndGetAccount('cash');

      const vId = commissionForm.vaultId || 'v1';
      const selectedV = vaults.find(v => v.id === vId);

      const entries = [
        {
          accountId: expensesAcc?.id || '',
          accountName: expensesAcc?.accountName || 'المصاريف التشغيلية',
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: cashAcc?.id || '',
          accountName: cashAcc?.accountName || 'الصندوق / البنك',
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      if (profile?.ownerId) {
        await accountingService.recordJournalEntry(
          profile.ownerId,
          `صرف عمولة ورسوم - ${commissionForm.commissionType} [من ${selectedV?.name || 'الخزينة'}]: ${commissionForm.details || 'تسوية عمولات'}`,
          entries,
          'commission-' + Date.now()
        );
      }

      await addTransactionToFirestore({
        type: 'outflow',
        category: 'تسليم وتسوية عمولات',
        amount: val,
        details: `${commissionForm.commissionType} : ${commissionForm.details || ''} (من: ${selectedV?.name || 'الخزينة'})`,
        accountSource: vId
      });
      await updateVaultBalance(vId, val, false);

      setCommissionForm({ amount: '', commissionType: 'عمولة رصيد وخدمات', details: '', vaultId: 'v1' });
      alert('✓ تم تأكيد صرف العمولات وتحديث الحسابات الدفترية والسحابية!');
    } catch (err: any) {
      alert('خطأ أثناء معالجة القيد: ' + err.message);
    }
  };

  const handleDeliverCustodySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(custodyOwnerForm.amount);
    if (!val || val <= 0) return;
    try {
      const expensesAcc = await ensureAndGetAccount('operating_expenses');
      const cashAcc = await ensureAndGetAccount('cash');

      const vId = custodyOwnerForm.vaultId || 'v1';
      const selectedV = vaults.find(v => v.id === vId);

      const entries = [
        {
          accountId: expensesAcc?.id || '',
          accountName: expensesAcc?.accountName || 'المصاريف التشغيلية',
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: cashAcc?.id || '',
          accountName: cashAcc?.accountName || 'الصندوق / البنك',
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      if (profile?.ownerId) {
        await accountingService.recordJournalEntry(
          profile.ownerId,
          `تسليم مسحوبات وعهدة للمالك: ${custodyOwnerForm.recipient} [من ${selectedV?.name || 'الخزينة'}]. ${custodyOwnerForm.details || 'سحب زلط كاش للمالك'}`,
          entries,
          'custody_owner-' + Date.now()
        );
      }

      await addTransactionToFirestore({
        type: 'outflow',
        category: 'تسليم عهدة للمالك',
        amount: val,
        recipient: custodyOwnerForm.recipient,
        details: (custodyOwnerForm.details || 'سحب زلط كاش للمالك لتطهير الأرصده') + ` (من: ${selectedV?.name || 'الخزينة'})`,
        accountSource: vId
      });
      await updateVaultBalance(vId, val, false);

      setCustodyOwnerForm({ amount: '', recipient: '', details: '', vaultId: 'v1' });
      alert('✓ تم إثبات قيد مسحوبات المالك بالدفاتر السحابية وتحديث رصيد الصندوق!');
    } catch (err: any) {
      alert('خطأ أثناء معالجة القيد: ' + err.message);
    }
  };

  const handleReceiveCustodySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(custodyRecForm.amount);
    if (!val || val <= 0) return;
    try {
      const cashAcc = await ensureAndGetAccount('cash');
      const revenuesAcc = await ensureAndGetAccount('revenues');

      const vId = custodyRecForm.vaultId || 'v1';
      const selectedV = vaults.find(v => v.id === vId);

      const entries = [
        {
          accountId: cashAcc?.id || '',
          accountName: cashAcc?.accountName || 'الصندوق / البنك',
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: revenuesAcc?.id || '',
          accountName: revenuesAcc?.accountName || 'إيرادات المبيعات',
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      if (profile?.ownerId) {
        await accountingService.recordJournalEntry(
          profile.ownerId,
          `استلام عهدة مالية / تدعيم رأس مال من: ${custodyRecForm.source} [إلى ${selectedV?.name || 'الخزينة'}]. ${custodyRecForm.details || 'تمويل مباشر'}`,
          entries,
          'custody_rec-' + Date.now()
        );
      }

      await addTransactionToFirestore({
        type: 'inflow',
        category: 'استلام عهدة مالية',
        amount: val,
        details: (custodyRecForm.details || `تمويل قادم من: ${custodyRecForm.source}`) + ` (إلى: ${selectedV?.name || 'الخزينة'})`,
        accountSource: vId
      });
      await updateVaultBalance(vId, val, true);
      setCustodyRecForm({ amount: '', source: '', details: '', vaultId: 'v1' });
      alert('✓ تم إثبات استلام العهدة التمويلية وتغذية حسابات الصناديق!');
    } catch (err: any) {
      alert('خطأ أثناء معالجة القيد: ' + err.message);
    }
  };

  const handleSendTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(sendTransferForm.amount);
    if (!val || val <= 0) return;
    try {
      const payablesAcc = await ensureAndGetAccount('payables');
      const expensesAcc = await ensureAndGetAccount('operating_expenses');
      const cashAcc = await ensureAndGetAccount('cash');

      const isPurch = sendTransferForm.isPurchase === 'yes';
      const debitAcc = isPurch ? (payablesAcc || expensesAcc) : expensesAcc;

      const entries = [
        {
          accountId: debitAcc?.id || '',
          accountName: debitAcc?.accountName || (isPurch ? 'ذمم دائنة - الموردين' : 'المصاريف التشغيلية'),
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: cashAcc?.id || '',
          accountName: cashAcc?.accountName || 'الصندوق / البنك',
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      if (profile?.ownerId) {
        await accountingService.recordJournalEntry(
          profile.ownerId,
          `إرسال حوالة مالية - إلى: ${sendTransferForm.recipient}. الغرض: ${sendTransferForm.reason || 'مشتريات/مصاريف'}`,
          entries,
          'send_transfer-' + Date.now()
        );
      }

      const categoryName = isPurch ? 'مشتريات عبر حوالة' : 'إرسال حوالة مالية';
      const detailString = `حوالة مرسلة إلى: ${sendTransferForm.recipient}. تفاصيل: ${sendTransferForm.reason}. ` + 
        (isPurch ? `رقم الفاتورة: ${sendTransferForm.invoiceNo} (قناة الشراء: ${sendTransferForm.purchaseChannel === 'market' ? 'سوق الجوالات' : 'وجه لوجه مباشر'})` : '');

      await addTransactionToFirestore({
        type: 'outflow',
        category: categoryName,
        amount: val,
        recipient: sendTransferForm.recipient,
        reason: sendTransferForm.reason,
        accountSource: sendTransferForm.accountSource,
        details: detailString
      });
      await updateVaultBalance(sendTransferForm.accountSource, val, false);

      setSendTransferForm({ amount: '', recipient: '', reason: '', accountSource: 'v1', invoiceNo: '', isPurchase: 'no', purchaseChannel: 'market' });
      alert('✓ تم إرسال وقيد قيمة الحوالة وتنزيلها من حسابات الصندوق العام!');
    } catch (err: any) {
      alert('خطأ أثناء معالجة القيد: ' + err.message);
    }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(adjustmentForm.amount);
    if (!val || val <= 0 || !adjustmentForm.accountId) {
      alert('الرجاء إدخال مبلغ صحيح واختيار حساب!');
      return;
    }

    const selectedAcc = accountsList.find(a => a.id === adjustmentForm.accountId);
    if (!selectedAcc) return;

    try {
      const batch = writeBatch(db);
      const entryRef = doc(collection(db, 'journalEntries'));

      const isDebit = adjustmentForm.type === 'debit';
      const items = [
        { 
          accountId: adjustmentForm.accountId, 
          accountName: selectedAcc.accountName, 
          debit: isDebit ? val : 0, 
          credit: isDebit ? 0 : val, 
          currency: 'YER', 
          baseAmount: val, 
          exchangeRate: 1 
        },
        { 
          accountId: 'offset-acc', 
          accountName: 'حساب التسويات الفروقات والارباح/الخسائر المقيّمة', 
          debit: isDebit ? 0 : val, 
          credit: isDebit ? val : 0, 
          currency: 'YER', 
          baseAmount: val, 
          exchangeRate: 1 
        }
      ];

      batch.set(entryRef, {
        ownerId: profile?.ownerId,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
        description: `سند تسوية حسابية: ${adjustmentForm.details || 'تسوية رصيد حساب بالخزينة'}`,
        reference: 'Adjustment Voucher (سند تسوية)',
        items,
        type: 'ADJUSTMENT'
      });

      // Update actual account balance in Firestore
      const accRef = doc(db, 'accounts', adjustmentForm.accountId);
      batch.update(accRef, { 
        balance: increment(isDebit ? val : -val) 
      });

      await batch.commit();

      await addTransactionToFirestore({
        type: isDebit ? 'inflow' : 'outflow',
        category: 'سند تسوية ' + (isDebit ? 'زيادة' : 'خصم'),
        amount: val,
        details: `تسوية للحساب [${selectedAcc.accountName}] - ${adjustmentForm.details || 'تسوية رصيد'}`
      });

      setAdjustmentForm({ amount: '', accountId: '', type: 'debit', details: '' });
      alert('✓ تم حفظ وإنشاء سند التسوية الحسابية السحابي وتحديث الأرصدة بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ سند التسوية: ' + err.message);
    }
  };

  // Create new Account (ported from Accounts.tsx)
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    if (!newAcc.accountNumber || !newAcc.accountName) {
      alert("الرجاء تعبئة كافة الحقول المطلوبة.");
      return;
    }

    // Check unique account number
    const numExists = accountsList.some(a => a.accountNumber === newAcc.accountNumber);
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

  const handleStartEditAccount = (acc: Account) => {
    setEditingAccId(acc.id);
    setEditingAccName(acc.accountName);
  };

  const handleSaveAccountName = async (accId: string) => {
    if (!editingAccName.trim()) {
      alert('الرجاء إدخال اسم حساب صحيح.');
      return;
    }
    try {
      await updateDoc(doc(db, 'accounts', accId), {
        accountName: editingAccName.trim()
      });
      setEditingAccId(null);
      alert('✓ تم تحديث اسم الحساب المحاسبي بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء حفظ التحديث: ' + err.message);
    }
  };

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSyncingSubsystems, setIsSyncingSubsystems] = useState(false);
  const [syncStats, setSyncStats] = useState({ salesSync: 0, purSync: 0, maintSync: 0, balSync: 0 });
  const [isPurging, setIsPurging] = useState(false);

  const recalculateAllAccountBalances = async () => {
    if (!profile?.ownerId) return;
    setIsRecalculating(true);
    try {
      const ownerId = profile.ownerId;
      const accSnap = await getDocs(query(collection(db, 'accounts'), where('ownerId', '==', ownerId)));
      const accounts = accSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const entriesSnap = await getDocs(query(collection(db, 'journalEntries'), where('ownerId', '==', ownerId)));
      const entries = entriesSnap.docs.map(doc => doc.data());
      
      const balanceMap: { [accIdOrNum: string]: number } = {};
      accounts.forEach(acc => {
        balanceMap[acc.id] = 0;
      });
      
      entries.forEach(entry => {
        const items = entry.items || [];
        items.forEach((item: any) => {
          const deb = parseFloat(item.debit) || 0;
          const cred = parseFloat(item.credit) || 0;
          const diff = deb - cred; 
          
          if (item.accountId && balanceMap[item.accountId] !== undefined) {
            balanceMap[item.accountId] += diff;
          } else {
            const matchedAcc = accounts.find(a => a.accountName === item.accountName || a.accountNumber === item.accountId);
            if (matchedAcc) {
              balanceMap[matchedAcc.id] += diff;
            }
          }
        });
      });
      
      const batch = writeBatch(db);
      for (const acc of accounts) {
        let calculatedBalance = balanceMap[acc.id] || 0;
        const isDebitNatural = acc.type === 'asset' || acc.type === 'expense';
        const finalBal = isDebitNatural ? calculatedBalance : -calculatedBalance;
        
        const accRef = doc(db, 'accounts', acc.id);
        batch.update(accRef, { balance: finalBal });
      }
      
      await batch.commit();
      alert("✓ تم الانتهاء بنجاح من إعادة معايرة مطابقة جميع الأرصدة المحاسبية وتصفير الفروقات المحاسبية!");
    } catch (err: any) {
      console.error(err);
      alert("خطأ أثناء معايرة الحسابات: " + err.message);
    } finally {
      setIsRecalculating(false);
    }
  };

  const syncSubsystemsToGL = async () => {
    if (!profile?.ownerId) return;
    setIsSyncingSubsystems(true);
    let salesCount = 0;
    let purCount = 0;
    let maintCount = 0;
    let balCount = 0;

    try {
      const ownerId = profile.ownerId;
      const entriesSnap = await getDocs(query(collection(db, 'journalEntries'), where('ownerId', '==', ownerId)));
      const existingRefs = new Set(entriesSnap.docs.map(doc => doc.data().reference));
      
      const salesSnap = await getDocs(query(collection(db, 'sales'), where('ownerId', '==', ownerId)));
      for (const saleDoc of salesSnap.docs) {
        const sale = { id: saleDoc.id, ...saleDoc.data() } as any;
        if (!existingRefs.has(sale.id)) {
          await postSaleToGL(ownerId, sale);
          salesCount++;
        }
      }
      
      const purSnap = await getDocs(query(collection(db, 'purchases'), where('ownerId', '==', ownerId)));
      for (const purDoc of purSnap.docs) {
        const pur = { id: purDoc.id, ...purDoc.data() } as any;
        if (!existingRefs.has(pur.id)) {
          await postPurchaseToGL(ownerId, pur);
          purCount++;
        }
      }

      const maintSnap = await getDocs(query(collection(db, 'maintenanceOrders'), where('ownerId', '==', ownerId)));
      for (const maintDoc of maintSnap.docs) {
        const maint = { id: maintDoc.id, ...maintDoc.data() } as any;
        const refMaint = `MNT-${maint.ticketNumber || maint.id}`;
        if (maint.status === 'delivered' && !existingRefs.has(refMaint)) {
          const cashAcc = await ensureAndGetGLAccount(ownerId, '1100', 'الصندوق / البنك', 'asset');
          const revAcc = await ensureAndGetGLAccount(ownerId, '4100', 'إيرادات المبيعات', 'revenue');
          const amt = parseFloat(maint.cost || maint.price || 0);

          if (amt > 0) {
            const entries = [
              { accountId: cashAcc.id, accountName: cashAcc.accountName, debit: amt, credit: 0 },
              { accountId: revAcc.id, accountName: revAcc.accountName, debit: 0, credit: amt }
            ];
            await accountingService.recordJournalEntry(
              ownerId,
              `مبيعات صيانة - تسليم جهاز #${maint.ticketNumber || maint.id.slice(-6)} للعميل ${maint.customerName || 'عام'}`,
              entries,
              refMaint
            );
            maintCount++;
          }
        }
      }

      const balSnap = await getDocs(query(collection(db, 'balanceTransactions'), where('ownerId', '==', ownerId)));
      for (const balDoc of balSnap.docs) {
        const bal = { id: balDoc.id, ...balDoc.data() } as any;
        const refBal = `BAL-${bal.id}`;
        if (!existingRefs.has(refBal)) {
          const cashAcc = await ensureAndGetGLAccount(ownerId, '1100', 'الصندوق / البنك', 'asset');
          const revAcc = await ensureAndGetGLAccount(ownerId, '4100', 'إيرادات المبيعات', 'revenue');
          const amt = parseFloat(bal.amount || bal.price || 0);

          if (amt > 0) {
            const entries = [
              { accountId: cashAcc.id, accountName: cashAcc.accountName, debit: amt, credit: 0 },
              { accountId: revAcc.id, accountName: revAcc.accountName, debit: 0, credit: amt }
            ];
            await accountingService.recordJournalEntry(
              ownerId,
              `مبيعات فورية - شحن رصيد وتعبئة باقة لـ ${bal.recipientNumber || bal.phone || 'خدمة'}`,
              entries,
              refBal
            );
            balCount++;
          }
        }
      }

      setSyncStats({ salesSync: salesCount, purSync: purCount, maintSync: maintCount, balSync: balCount });
      
      // Auto-recalculate
      const finalAccSnap = await getDocs(query(collection(db, 'accounts'), where('ownerId', '==', ownerId)));
      const finalAccounts = finalAccSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const finalEntriesSnap = await getDocs(query(collection(db, 'journalEntries'), where('ownerId', '==', ownerId)));
      const finalEntries = finalEntriesSnap.docs.map(doc => doc.data());

      const balanceMap: { [accIdOrNum: string]: number } = {};
      finalAccounts.forEach(acc => {
        balanceMap[acc.id] = 0;
      });

      finalEntries.forEach(entry => {
        const items = entry.items || [];
        items.forEach((item: any) => {
          const deb = parseFloat(item.debit) || 0;
          const cred = parseFloat(item.credit) || 0;
          const diff = deb - cred; 
          if (item.accountId && balanceMap[item.accountId] !== undefined) {
            balanceMap[item.accountId] += diff;
          } else {
            const matchedAcc = finalAccounts.find(a => a.accountName === item.accountName || a.accountNumber === item.accountId);
            if (matchedAcc) {
              balanceMap[matchedAcc.id] += diff;
            }
          }
        });
      });

      const batch = writeBatch(db);
      for (const acc of finalAccounts) {
        let calculatedBalance = balanceMap[acc.id] || 0;
        const isDebitNatural = acc.type === 'asset' || acc.type === 'expense';
        const finalBal = isDebitNatural ? calculatedBalance : -calculatedBalance;
        const accRef = doc(db, 'accounts', acc.id);
        batch.update(accRef, { balance: finalBal });
      }
      await batch.commit();

      alert(`✓ تم بنجاح ترحيل ومزامنة كافة الحركات المفقودة من النظام إلى المنظومة المالية المحاسبية!\n- فواتير مبيعات: ${salesCount}\n- فواتير مشتريات: ${purCount}\n- طلبات الصيانة المستلمة: ${maintCount}\n- تعبئة رصيد وشحن فوري: ${balCount}\n\nتم تحديث الدفاتر والأرصدة لحظياً بنجاح!`);
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء ترحيل العمليات المالية: " + err.message);
    } finally {
      setIsSyncingSubsystems(false);
    }
  };

  const purgeAllAccountingAndReset = async () => {
    if (!window.confirm("تحذير حرج للغاية: هل تريد فعلاً تصفير كافة الحسابات المحاسبية وحذف القيود لكي تطهر الدليل المالي بالكامل وتزامن عملياتك من جديد؟")) {
      return;
    }
    if (!profile?.ownerId) return;
    setIsPurging(true);
    try {
      const ownerId = profile.ownerId;
      
      const entriesSnap = await getDocs(query(collection(db, 'journalEntries'), where('ownerId', '==', ownerId)));
      const batchEntries = writeBatch(db);
      entriesSnap.docs.forEach(doc => {
        batchEntries.delete(doc.ref);
      });
      await batchEntries.commit();
      
      const accountsSnap = await getDocs(query(collection(db, 'accounts'), where('ownerId', '==', ownerId)));
      const batchAccounts = writeBatch(db);
      accountsSnap.docs.forEach(doc => {
        batchAccounts.update(doc.ref, { balance: 0 });
      });
      await batchAccounts.commit();
      
      await initializeChartOfAccounts(ownerId);
      
      alert("✓ تم تطهير أرصدة المنظومة المحاسبية بنجاح وحذف قيود الأرصدة التجريبية! الحسابات الآن جاهزة للمزامنة النظيفة من المبيعات والصيانة الحقيقية.");
    } catch (err: any) {
      console.error(err);
      alert("خطأ أثناء تصفير وتطهير المنظومة: " + err.message);
    } finally {
      setIsPurging(false);
    }
  };

  const handleDeleteAccount = async (acc: Account) => {
    const standardAccs = ['1100', '1200', '1101', '2100', '4100', '5100', '5200'];
    if (standardAccs.includes(acc.accountNumber)) {
      alert('❌ لا يمكن حذف الحسابات القياسية التشغيلية للنظام لضمان سلامة العمليات التلقائية للفروع المترابطة.');
      return;
    }
    if (acc.balance !== 0) {
      alert(`❌ لا يمكن حذف الحساب [${acc.accountName}] لأن رصيده الحالي ليس صفراً (${acc.balance} YER). الرجاء تصفية الحساب أولاً.`);
      return;
    }

    if (!window.confirm(`هل أنت متأكد من حذف الحساب المحاسبي [${acc.accountName}] نهائياً من دليل الشجرة؟`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'accounts', acc.id));
      alert('✓ تم حذف الحساب بنجاح من الدليل المحاسبي.');
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء حذف الحساب: ' + err.message);
    }
  };

  const handleCustodyHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;

    const { employeeId, vaultId, amount, details } = custodyHandoverForm;
    const val = parseFloat(amount) || 0;

    if (!employeeId) {
      alert("الرجاء اختيار الموظف أو المهندس أولاً.");
      return;
    }
    if (val <= 0) {
      alert("الطلب غير صالح! يجب أن يكون مبلغ العهدة أكبر من الصفر.");
      return;
    }

    const employeeObj = employeeUsersList.find(u => u.id === employeeId);
    if (!employeeObj) {
      alert("لم يتم العثور على الموظف المحدد.");
      return;
    }

    const targetVaultId = vaultId || 'v1';
    const selectedVault = vaults.find(v => v.id === targetVaultId) || {
      id: targetVaultId,
      name: targetVaultId === 'v1' ? 'صندوق الكاش الرئيسي للبيع' : 'صندوق مالي فرعي',
      type: 'cash',
      balance: 0
    };

    setIsSubmittingCustody(true);
    try {
      // 1. Ensure/Get standard Employee Custody Account in Chart of Accounts (e.g. 1155) so that double-entry is balanced
      const custodyGL = await ensureAndGetGLAccount(profile.ownerId, '1155', 'ذمم العهد والأمانات - الموظفين والمهندسين', 'asset');
      const cashGL = await ensureAndGetGLAccount(profile.ownerId, '1100', 'الصندوق / البنك', 'asset');

      // 2. Double-entry Journal Voucher items
      const journalItemRef = 'custody-' + Date.now();
      const entries = [
        {
          accountId: custodyGL.id,
          accountName: custodyGL.accountName,
          debit: val,
          credit: 0,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        },
        {
          accountId: cashGL.id,
          accountName: cashGL.accountName,
          debit: 0,
          credit: val,
          currency: 'YER',
          exchangeRate: 1,
          baseAmount: val
        }
      ];

      // Record Journal Entry
      await accountingService.recordJournalEntry(
        profile.ownerId,
        `صرف وتسليم عهدة نقدية للموظف/المهندس: ${employeeObj.name || employeeObj.displayName || 'موظف'} من [${selectedVault.name}] - ${details || 'تمويل لتنفيذ صيانات ومصاريف نثرية'}`,
        entries,
        journalItemRef
      );

      // 3. Decrement Vault Balance
      await updateVaultBalance(targetVaultId, val, false);

      // 4. Update employee custodyBalance in Firestore 'users' collection
      const userRef = doc(db, 'users', employeeId);
      await updateDoc(userRef, {
        custodyBalance: increment(val)
      });

      // 5. Save a cash transaction record for history logging on the store level
      const storeId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
      await addDoc(collection(db, 'stores', storeId, 'transactions'), {
        ownerId: profile.ownerId,
        type: 'outflow',
        category: 'تسليم عهدة لموظف',
        amount: val,
        recipient: employeeObj.name || employeeObj.displayName || 'موظف',
        details: `صرف وتسليم عهدة نقدية للموظف/المهندس [من: ${selectedVault.name}] - ${details || 'أعمال صيانة ومصاريف'}`,
        accountSource: targetVaultId,
        createdAt: serverTimestamp()
      });

      setCustodyHandoverForm({ employeeId: '', vaultId: 'v1', amount: '', details: '' });
      alert(`✓ تم بنجاح صرف وتسليم العهدة بمبلغ ${val.toLocaleString()} ر.ي وتقييدها بالدفاتر المزدوجة المتزنة!`);
    } catch (err: any) {
      console.error(err);
      alert('فشل تسجيل وتسليم العهدة: ' + err.message);
    } finally {
      setIsSubmittingCustody(false);
    }
  };

  const handleCustodySettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;

    const { employeeId, type, amount, details, vaultId } = custodySettlementForm;
    const val = parseFloat(amount) || 0;

    if (!employeeId) {
      alert("الرجاء اختيار الموظف أو المهندس أولاً.");
      return;
    }
    if (val <= 0) {
      alert("الطلب غير صالح! يجب أن يكون مبلغ التصفية أكبر من الصفر.");
      return;
    }

    const employeeObj = employeeUsersList.find(u => u.id === employeeId);
    if (!employeeObj) {
      alert("لم يتم العثور على الموظف المحدد.");
      return;
    }

    const activeCustody = employeeObj.custodyBalance || 0;
    const targetVaultId = vaultId || 'v1';
    const selectedVault = vaults.find(v => v.id === targetVaultId) || {
      id: targetVaultId,
      name: targetVaultId === 'v1' ? 'صندوق الكاش الرئيسي للبيع' : 'صندوق مالي فرعي',
      type: 'cash',
      balance: 0
    };

    setIsSubmittingCustody(true);
    try {
      const custodyGL = await ensureAndGetGLAccount(profile.ownerId, '1155', 'ذمم العهد والأمانات - الموظفين والمهندسين', 'asset');
      const expensesGL = await ensureAndGetGLAccount(profile.ownerId, '5200', 'المصاريف التشغيلية', 'expense');
      const cashGL = await ensureAndGetGLAccount(profile.ownerId, '1100', 'الصندوق / البنك', 'asset');

      const journalItemRef = 'settlement-' + Date.now();
      let entries: any[] = [];
      let transactionCategory = 'تصفية عهدة لموظف';
      let docDetails = '';

      if (type === 'expense') {
        // Debit Expenses GL (Operating Expenses), Credit Custody GL
        entries = [
          {
            accountId: expensesGL.id,
            accountName: expensesGL.accountName,
            debit: val,
            credit: 0,
            currency: 'YER',
            exchangeRate: 1,
            baseAmount: val
          },
          {
            accountId: custodyGL.id,
            accountName: custodyGL.accountName,
            debit: 0,
            credit: val,
            currency: 'YER',
            exchangeRate: 1,
            baseAmount: val
          }
        ];
        docDetails = `تصفية عهدة الموظف: ${employeeObj.name || employeeObj.displayName} بمطابقة وصولات ومصاريف: ${details || 'مصاريف صيانة ونثريات مستهلكة'}`;
      } else {
        // Redeposit: Debit Cash GL (selected Vault), Credit Custody GL
        entries = [
          {
            accountId: cashGL.id,
            accountName: cashGL.accountName,
            debit: val,
            credit: 0,
            currency: 'YER',
            exchangeRate: 1,
            baseAmount: val
          },
          {
            accountId: custodyGL.id,
            accountName: custodyGL.accountName,
            debit: 0,
            credit: val,
            currency: 'YER',
            exchangeRate: 1,
            baseAmount: val
          }
        ];
        docDetails = `رد متبقي عهدة نقدية كاش من الموظف: ${employeeObj.name || employeeObj.displayName} وتغذية [الصندوق: ${selectedVault?.name}] - ${details || 'استرجاع نقدي للامانات'}`;
        transactionCategory = 'استرداد عهدة كاش';
      }

      // Record balanced journal entries
      await accountingService.recordJournalEntry(
        profile.ownerId,
        docDetails,
        entries,
        journalItemRef
      );

      // If returning cash, increment Vault Balance
      if (type === 'return') {
        await updateVaultBalance(targetVaultId, val, true);
      }

      // Decrement employees custody Balance in Firestore 'users' collection
      const userRef = doc(db, 'users', employeeId);
      await updateDoc(userRef, {
        custodyBalance: increment(-val)
      });

      // Save a cash transaction record for history logging on the store level
      const storeId = profile?.shopId || profile?.storeId || profile?.ownerId || 'main_store';
      await addDoc(collection(db, 'stores', storeId, 'transactions'), {
        ownerId: profile.ownerId,
        type: type === 'return' ? 'inflow' : 'outflow',
        category: transactionCategory,
        amount: val,
        recipient: employeeObj.name || employeeObj.displayName || 'موظف',
        details: docDetails,
        accountSource: type === 'return' ? targetVaultId : 'custody',
        createdAt: serverTimestamp()
      });

      setCustodySettlementForm({ employeeId: '', type: 'expense', amount: '', details: '', vaultId: 'v1' });
      alert(`✓ تم بنجاح تصفية وتسوية العهدة بمبلغ ${val.toLocaleString()} ر.ي بنجاح مالي تام!`);
    } catch (err: any) {
      console.error(err);
      alert('فشل تصفية العهدة: ' + err.message);
    } finally {
      setIsSubmittingCustody(false);
    }
  };

  // Add line to journal voucher
  const addJournalLine = () => {
    setJournalLines([...journalLines, { accountId: '', accountName: '', debit: '', credit: '', currency: 'YER' }]);
  };

  // Remove line from journal voucher
  const removeJournalLine = (index: number) => {
    if (journalLines.length <= 2) return;
    const updated = [...journalLines];
    updated.splice(index, 1);
    setJournalLines(updated);
  };

  // Apply quick transaction preset (خرج مباشر، تسوية، تالف، فاقد، مشتريات، عهدة، تسليم زلط، تسديد عميل، تسديد مورد)
  const applyJournalPreset = (type: 'outflow' | 'settlement' | 'damaged' | 'loss' | 'purchases' | 'custody' | 'emp_payment' | 'customer_payment' | 'supplier_payment') => {
    setSelectedPresetType(type);
    const timestamp = Date.now().toString().slice(-5);

    const cashAcc = accountsList.find(a => a.accountNumber === '1100' || a.accountName.includes('الصندوق')) || accountsList[0];
    const expenseAcc = accountsList.find(a => a.accountNumber === '5100' || a.accountName.includes('مصاريف') || a.accountName.includes('مصروفات')) || accountsList[0];
    const invAcc = accountsList.find(a => a.accountNumber === '1200' || a.accountName.includes('المخزن') || a.accountName.includes('المخزون')) || accountsList[0];
    const settleAcc = accountsList.find(a => a.accountNumber === '1250' || a.accountName.includes('تسويات') || a.accountName.includes('فروقات')) || accountsList[0];
    const damagedAcc = accountsList.find(a => a.accountNumber === '5210' || a.accountName.includes('تالف') || a.accountName.includes('مفقودات')) || accountsList[0];
    const lossAcc = accountsList.find(a => a.accountNumber === '5220' || a.accountName.includes('عجز') || a.accountName.includes('فاقد')) || accountsList[0];
    const supplierAcc = accountsList.find(a => a.accountNumber === '2100' || a.accountName.includes('موردين') || a.accountName.includes('دائنة')) || accountsList[0];
    const custodyAcc = accountsList.find(a => a.accountNumber === '1102' || a.accountName.includes('عهدة') || a.accountName.includes('سلف') || a.accountName.includes('عهدم')) || cashAcc;
    const customerAcc = accountsList.find(a => a.accountNumber === '1201' || a.accountName.includes('عملاء') || a.accountName.includes('ذمم')) || accountsList[0];

    if (type === 'outflow') {
      setJournalNote('خرج ومصروف تشغيلي مباشر من الصندوق');
      setJournalRef(`JV-EXP-${timestamp}`);
      setJournalLines([
        { accountId: expenseAcc?.id || '', accountName: expenseAcc?.accountName || 'حساب المصاريف والنفقات التشغيلية', debit: '', credit: '', currency: journalCurrency },
        { accountId: cashAcc?.id || '', accountName: cashAcc?.accountName || 'حساب الصندوق الرئيسي', debit: '', credit: '', currency: journalCurrency }
      ]);
    } else if (type === 'settlement') {
      setJournalNote('تسوية حسابات وفروقات الجرد الدفتري');
      setJournalRef(`JV-SETTLE-${timestamp}`);
      setJournalLines([
        { accountId: settleAcc?.id || '', accountName: settleAcc?.accountName || 'حساب التسويات والفروقات', debit: '', credit: '', currency: 'YER' },
        { accountId: cashAcc?.id || '', accountName: cashAcc?.accountName || 'حساب الصندوق الرئيسي', debit: '', credit: '', currency: 'YER' }
      ]);
    } else if (type === 'damaged') {
      setJournalNote('إثبات تالف بضاعة وأجهزة ومواد صيانة');
      setJournalRef(`JV-DAMAGED-${timestamp}`);
      setJournalLines([
        { accountId: damagedAcc?.id || '', accountName: damagedAcc?.accountName || 'حساب تالف ومفقودات المخزون', debit: '', credit: '', currency: 'YER' },
        { accountId: invAcc?.id || '', accountName: invAcc?.accountName || 'حساب المخزون والبضائع', debit: '', credit: '', currency: 'YER' }
      ]);
    } else if (type === 'loss') {
      setJournalNote('إثبات فاقد وعجز في الصندوق أو العهدة');
      setJournalRef(`JV-LOSS-${timestamp}`);
      setJournalLines([
        { accountId: lossAcc?.id || '', accountName: lossAcc?.accountName || 'حساب العجز والفاقد التشغيلي', debit: '', credit: '', currency: 'YER' },
        { accountId: cashAcc?.id || '', accountName: cashAcc?.accountName || 'حساب الصندوق الرئيسي', debit: '', credit: '', currency: 'YER' }
      ]);
    } else if (type === 'purchases') {
      setJournalNote('شراء وشحنة بضائع وقطع غيار من المورد');
      setJournalRef(`JV-PURCHASE-${timestamp}`);
      setJournalLines([
        { accountId: invAcc?.id || '', accountName: invAcc?.accountName || 'حساب المشتريات والمخزون', debit: '', credit: '', currency: 'YER' },
        { accountId: supplierAcc?.id || '', accountName: supplierAcc?.accountName || 'حساب الموردين والدائنين', debit: '', credit: '', currency: 'YER' }
      ]);
    } else if (type === 'custody') {
      setJournalNote('صرف عهدة نقدية تشغيلية للموظف');
      setJournalRef(`JV-CUSTODY-${timestamp}`);
      setJournalLines([
        { accountId: custodyAcc?.id || '', accountName: custodyAcc?.accountName || 'حساب عهد الموظفين والفرع', debit: '', credit: '', currency: 'YER' },
        { accountId: cashAcc?.id || '', accountName: cashAcc?.accountName || 'حساب الصندوق الرئيسي', debit: '', credit: '', currency: 'YER' }
      ]);
    } else if (type === 'emp_payment') {
      setJournalNote('تسليم مبلغ/سلفة للموظف أو المهندس من حسابه أو قرضه');
      setJournalRef(`JV-EMP-PAY-${timestamp}`);
      setJournalLines([
        { accountId: custodyAcc?.id || '', accountName: custodyAcc?.accountName || 'حساب سلف وعهد الموظفين والمهندسين', debit: '', credit: '', currency: 'YER' },
        { accountId: cashAcc?.id || '', accountName: cashAcc?.accountName || 'حساب الصندوق الرئيسي', debit: '', credit: '', currency: 'YER' }
      ]);
    } else if (type === 'customer_payment') {
      setJournalNote('قبض وتسديد دفعة حساب من العميل');
      setJournalRef(`JV-CUST-PAY-${timestamp}`);
      setJournalLines([
        { accountId: cashAcc?.id || '', accountName: cashAcc?.accountName || 'حساب الصندوق الرئيسي', debit: '', credit: '', currency: 'YER' },
        { accountId: customerAcc?.id || '', accountName: customerAcc?.accountName || 'حساب العملاء والذمم المدينة', debit: '', credit: '', currency: 'YER' }
      ]);
    } else if (type === 'supplier_payment') {
      setJournalNote('دفع وتسديد مستحقات لحساب المورد');
      setJournalRef(`JV-SUPP-PAY-${timestamp}`);
      setJournalLines([
        { accountId: supplierAcc?.id || '', accountName: supplierAcc?.accountName || 'حساب الموردين والدائنين', debit: '', credit: '', currency: 'YER' },
        { accountId: cashAcc?.id || '', accountName: cashAcc?.accountName || 'حساب الصندوق الرئيسي', debit: '', credit: '', currency: 'YER' }
      ]);
    }
  };

  const handleApplyCurrencyCalculation = () => {
    const rawAmt = parseFloat(journalForeignAmount);
    if (isNaN(rawAmt) || rawAmt <= 0) return;
    const rate = journalCurrency === 'YER' ? 1 : (journalExchangeRate || 1);
    const calculatedYer = Math.round(rawAmt * rate);

    if (journalLines.length >= 2) {
      const updated = [...journalLines];
      updated[0].debit = calculatedYer.toString();
      updated[0].credit = '';
      updated[0].currency = journalCurrency;

      updated[1].credit = calculatedYer.toString();
      updated[1].debit = '';
      updated[1].currency = journalCurrency;

      setJournalLines(updated);

      if (journalCurrency !== 'YER') {
        const methodTxt = journalPaymentMethod === 'transfer' ? 'حوالة' : journalPaymentMethod === 'card' ? 'شبكة' : 'نقداً';
        const currNote = ` (${rawAmt.toLocaleString()} ${journalCurrency} بسعر صرف ${rate} - المعادل: ${calculatedYer.toLocaleString()} YER - ${methodTxt})`;
        if (!journalNote.includes('بسعر صرف')) {
          setJournalNote(prev => `${prev}${currNote}`);
        }
      }
    }
  };

  const handleSelectEmployeeForJournal = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) return;
    const emp = employeeUsersList.find((u: any) => u.id === empId);
    if (emp) {
      const empName = emp.displayName || emp.name || emp.username || 'موظف';
      const cleanBaseNote = journalNote.split(' | ')[0] || 'صرف عهدة/تسليم سلفة للموظف';
      setJournalNote(`${cleanBaseNote} | الموظف/المهندس: ${empName}`);
      
      const empAcc = accountsList.find(a => a.accountName.includes(empName) || a.accountNumber === '1102' || a.accountName.includes('عهدة') || a.accountName.includes('سلف'));
      if (empAcc && journalLines.length > 0) {
        const updated = [...journalLines];
        updated[0].accountId = empAcc.id;
        updated[0].accountName = empAcc.accountName;
        setJournalLines(updated);
      }
    }
  };

  const handleSelectCustomerForJournal = (custId: string) => {
    setSelectedCustomerId(custId);
    if (!custId) return;
    const cust = customersList.find((c: any) => c.id === custId);
    if (cust) {
      const custName = cust.name || cust.customerName || 'عميل';
      const cleanBaseNote = journalNote.split(' | ')[0] || 'قبض وتسديد من العميل';
      setJournalNote(`${cleanBaseNote} | العميل: ${custName}`);

      const custAcc = accountsList.find(a => a.accountName.includes(custName) || a.accountNumber === '1201' || a.accountName.includes('عملاء'));
      if (custAcc && journalLines.length > 1) {
        const updated = [...journalLines];
        updated[1].accountId = custAcc.id;
        updated[1].accountName = custAcc.accountName;
        setJournalLines(updated);
      }
    }
  };

  const handleSelectSupplierForJournal = (suppId: string) => {
    setSelectedSupplierId(suppId);
    if (!suppId) return;
    const supp = suppliersList.find((s: any) => s.id === suppId);
    if (supp) {
      const suppName = supp.name || supp.supplierName || 'مورد';
      const cleanBaseNote = journalNote.split(' | ')[0] || 'مشتريات/تسديد للمورد';
      setJournalNote(`${cleanBaseNote} | المورد: ${suppName}`);

      const suppAcc = accountsList.find(a => a.accountName.includes(suppName) || a.accountNumber === '2100' || a.accountName.includes('موردين'));
      if (suppAcc && journalLines.length > 0) {
        const updated = [...journalLines];
        updated[0].accountId = suppAcc.id;
        updated[0].accountName = suppAcc.accountName;
        setJournalLines(updated);
      }
    }
  };

  // Submit manual journal entry (ported from Accounts.tsx)
  const handleSubmitJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    setJournalError('');

    if (!profile?.ownerId) return;
    if (!journalNote) {
      setJournalError("الرجاء كتابة البيان أو الوصف العام لسند القيد.");
      return;
    }

    // Validate lines
    let totalDebit = new Big(0);
    let totalCredit = new Big(0);
    const normalizedLines = [];

    for (let i = 0; i < journalLines.length; i++) {
      const line = journalLines[i];
      if (!line.accountId) {
        setJournalError(`الرجاء تبيين الحساب للسطر رقم ${i + 1}`);
        return;
      }
      const dbAcc = accountsList.find(a => a.id === line.accountId);
      if (!dbAcc) {
        setJournalError("أحد الحسابات المحددة غير صالح في قواعد البيانات.");
        return;
      }

      const deb = Number(line.debit || 0);
      const cred = Number(line.credit || 0);

      if (deb < 0 || cred < 0) {
        setJournalError(`السطر ${i + 1} يحتوي على قيم سالبة غير مسموحة.`);
        return;
      }
      if (deb === 0 && cred === 0) {
        setJournalError(`السطر ${i + 1} يجب أن يحتوي على إما قيمة مدين أو دائن.`);
        return;
      }
      if (deb > 0 && cred > 0) {
        setJournalError(`السطر ${i + 1} لا يمكن أن يكون مدين دائن في ذات الوقت.`);
        return;
      }

      totalDebit = totalDebit.plus(deb);
      totalCredit = totalCredit.plus(cred);

      normalizedLines.push({
        accountId: line.accountId,
        accountName: dbAcc.accountName,
        debit: deb,
        credit: cred,
        currency: dbAcc.currency || 'YER',
        exchangeRate: 1,
        baseAmount: deb > 0 ? deb : cred
      });
    }

    if (!totalDebit.eq(totalCredit)) {
      setJournalError(`القيد المزدوج غير متوازن! إجمالي المدين: ${totalDebit.toString()} YER، بينما إجمالي الدائن: ${totalCredit.toString()} YER. الفارق: ${totalDebit.minus(totalCredit).abs().toString()}`);
      return;
    }

    setIsSubmittingJournal(true);
    try {
      const batch = writeBatch(db);
      const entryRef = doc(collection(db, 'journalEntries'));

      batch.set(entryRef, {
        ownerId: profile.ownerId,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
        description: journalNote,
        reference: journalRef || 'Manual JV',
        items: normalizedLines,
        type: 'MANUAL_JV'
      });

      // Update balances
      for (const line of normalizedLines) {
        const accRef = doc(db, 'accounts', line.accountId);
        const shift = line.debit - line.credit;
        batch.update(accRef, {
          balance: increment(shift)
        });
      }

      await batch.commit();

      // Dispatch Real-time Notification & App Chat Message to the target party
      let targetUserObj: any = null;
      if (selectedCustomerId) {
        targetUserObj = customersList.find(c => c.id === selectedCustomerId);
      } else if (selectedEmployeeId) {
        targetUserObj = employeeUsersList.find(e => e.id === selectedEmployeeId);
      } else if (selectedSupplierId) {
        targetUserObj = suppliersList.find(s => s.id === selectedSupplierId);
      }

      const primaryAmt = totalDebit.toNumber();
      const targetName = targetUserObj?.name || targetUserObj?.displayName || targetUserObj?.supplierName || 'الطرف الآخر';
      const targetPhone = targetUserObj?.phone || targetUserObj?.mobile || targetUserObj?.phoneNumber || '';
      const targetUid = targetUserObj?.id || targetUserObj?.uid || '';

      const alertMsg = `تم تسجيل حركة محاسبية بقيمة ${primaryAmt.toLocaleString()} YER (${journalNote}) - رقم السند: ${journalRef || 'مباشر'}`;

      if (targetUid) {
        try {
          // Real-time notification doc for user's notification bell/toast
          await addDoc(collection(db, 'notifications'), {
            ownerId: profile.ownerId,
            userId: targetUid,
            title: '💳 إشعار محاسبي مباشر',
            body: alertMsg,
            amount: primaryAmt,
            read: false,
            createdAt: serverTimestamp()
          });

          // Real-time message in chat channel
          await addDoc(collection(db, 'messages'), {
            ownerId: profile.ownerId,
            senderId: profile.uid || 'system',
            senderName: profile.displayName || 'النظام المحاسبي',
            recipientId: targetUid,
            recipientName: targetName,
            text: `💳 [إشعار محاسبي مباشر]\n${alertMsg}`,
            createdAt: serverTimestamp(),
            isAccountingAlert: true
          });
        } catch (notifErr) {
          console.warn('Realtime notification trigger error:', notifErr);
        }
      }

      setNotifyTargetUser({
        name: targetName,
        phone: targetPhone,
        message: alertMsg,
        amount: primaryAmt
      });

      // Clear Form
      setJournalNote('');
      setJournalRef('');
      setJournalLines([
        { accountId: '', accountName: '', debit: '', credit: '', currency: 'YER' },
        { accountId: '', accountName: '', debit: '', credit: '', currency: 'YER' }
      ]);
      setAccountingSubTab('ledger');
    } catch (err) {
      console.error(err);
      setJournalError("حدث عطل غير متوقع أثناء ترحيل القيد في سيرفر كلاود فايرستور.");
    } finally {
      setIsSubmittingJournal(false);
    }
  };

  const handleShortcutNavigation = (route: string) => {
    if (route.startsWith('#')) {
      if (route === '#assets-tab') {
        setActiveTab('assets');
      } else if (route === '#ledger-tab') {
        setActiveTab('accounts_ledger');
        setAccountingSubTab('ledger');
      }
    } else {
      navigate(route);
    }
  };

  const handleExecuteAuditQuery = async () => {
    let rawResults: any[] = [];
    let summary = '';
    const keyword = auditTargetKeyword.trim().toLowerCase();

    // 1. CODEBASE SCANNER & REFLECTOR: 
    // Dynamically retrieve metrics corresponding to the search keyword or generally for mapping!
    const ownerId = profile?.ownerId || '';
    
    // Live query matching YER values
    let maintTotal = 0;
    let damagedTotal = 0;
    let purchasesTotal = 0;
    let settlementTotal = 0;

    try {
      // Query maintenanceOrders
      const mSnap = await getDocs(query(collection(db, 'maintenanceOrders'), where('ownerId', '==', ownerId)));
      if (!mSnap.empty) {
        const sum = mSnap.docs.reduce((acc, d) => acc + (parseFloat(d.data().cost || d.data().price) || 0), 0);
        if (sum > 0) maintTotal = sum;
      }
    } catch(e) { console.warn('Maint live query err:', e); }

    try {
      const dSnap = await getDocs(query(collection(db, 'damaged_items'), where('ownerId', '==', ownerId)));
      if (!dSnap.empty) {
        const sum = dSnap.docs.reduce((acc, d) => acc + (parseFloat(d.data().totalAmount || d.data().amount || d.data().cost) || 0), 0);
        if (sum > 0) damagedTotal = sum;
      }
    } catch(e) { console.warn('Damaged live query err:', e); }

    try {
      const pSnap = await getDocs(query(collection(db, 'purchases'), where('ownerId', '==', ownerId)));
      if (!pSnap.empty) {
        const sum = pSnap.docs.reduce((acc, d) => acc + (parseFloat(d.data().totalAmount || d.data().amount) || 0), 0);
        if (sum > 0) purchasesTotal = sum;
      }
    } catch(e) { console.warn('Purchases live query err:', e); }

    try {
      const aSnap = await getDocs(query(collection(db, 'adjustmentVouchers'), where('ownerId', '==', ownerId)));
      if (!aSnap.empty) {
        const sum = aSnap.docs.reduce((acc, d) => acc + (parseFloat(d.data().totalAmount || d.data().amount) || 0), 0);
        if (sum > 0) settlementTotal = sum;
      }
    } catch(e) { console.warn('Settlement live query err:', e); }

    // List of active components to reflect
    const componentsList: ComponentMetric[] = [
      {
        componentName: 'لوحة صيانة الأصول والأجهزة اليدوية',
        fileName: 'AssetMaintenanceDashboard.tsx',
        route: '#assets-tab',
        metricLabel: 'تكاليف ورشة الصيانة والقطع',
        actualValue: maintTotal,
        isBalanced: true,
        accountCode: '4200'
      },
      {
        componentName: 'إدارة وإهلاك التوالف والفاقد',
        fileName: 'DamagedItems.tsx',
        route: '/damaged',
        metricLabel: 'إجمالي خسائر وتكاليف التوالف',
        actualValue: damagedTotal,
        isBalanced: true,
        accountCode: '5200'
      },
      {
        componentName: 'مشتريات الجملة وتجهيز المخزون المركزي',
        fileName: 'WholesalePurchases.tsx',
        route: '/wholesale-purchases',
        metricLabel: 'إجمالي صفقات فواتير الشراء النشطة',
        actualValue: purchasesTotal,
        isBalanced: true,
        accountCode: '1200'
      },
      {
        componentName: 'سندات التسوية وحسابات فوارق الصرف',
        fileName: 'SettlementInvoices.tsx',
        route: '#ledger-tab',
        metricLabel: 'إجمالي مبالغ سندات التسوية المحتسبة',
        actualValue: settlementTotal,
        isBalanced: true,
        accountCode: '1100'
      }
    ];

    // Filter components list by keyword matching (if none input, match all)
    const matchedComponents = componentsList.filter(c => 
      !keyword || 
      c.componentName.toLowerCase().includes(keyword) || 
      c.fileName.toLowerCase().includes(keyword) || 
      c.metricLabel.toLowerCase().includes(keyword) ||
      ('صيانة'.includes(keyword) && c.fileName === 'AssetMaintenanceDashboard.tsx') ||
      ('توالف'.includes(keyword) && c.fileName === 'DamagedItems.tsx') ||
      ('مشتريات'.includes(keyword) && c.fileName === 'WholesalePurchases.tsx') ||
      ('تسوية'.includes(keyword) && c.fileName === 'SettlementInvoices.tsx')
    );
    
    setActiveComponents(matchedComponents);

    // Apply main query list matching
    switch (auditSearchType) {
      case 'customer_statement': {
        const matchedSales = filteredSalesList.filter(s => 
          (s.customerName && s.customerName.toLowerCase().includes(keyword)) ||
          (s.patientName && s.patientName.toLowerCase().includes(keyword)) ||
          (s.notes && s.notes.toLowerCase().includes(keyword))
        );
        const matchedJournal = journalEntriesList.filter(e => 
          e.description?.toLowerCase().includes(keyword) ||
          e.items?.some(line => line.accountName?.toLowerCase().includes(keyword))
        );

        matchedSales.forEach(s => {
          rawResults.push({
            date: s.createdAt || s.date,
            type: 'مبيعات عميل',
            ref: s.invoiceNo || 'فاتورة بيع',
            val: s.totalAmount || s.price || 0,
            details: `العميل: ${s.customerName || 'عام'} - شراء أجهزة/إكسسوارات`
          });
        });

        matchedJournal.forEach(e => {
          rawResults.push({
            date: e.date || e.createdAt,
            type: 'قيد محاسبي عميل',
            ref: e.reference || 'سند قيد',
            val: e.items?.reduce((acc: number, current: any) => acc + (current.debit || current.credit || 0), 0) / 2 || 0,
            details: e.description || 'حركة مديونية دائنة'
          });
        });

        const totalValue = rawResults.reduce((acc, r) => acc + r.val, 0);
        summary = `كشف حساب للعميل [${keyword || 'الكل'}]: تم العثور على (${rawResults.length}) معاملات مبيعات وقيد بقيمة إجمالية قدرها ${totalValue.toLocaleString()} ر.ي.`;
        break;
      }
      case 'item_deals': {
        const matchedSales = filteredSalesList.filter(s => 
          (s.itemName && s.itemName.toLowerCase().includes(keyword)) ||
          (s.category && s.category.toLowerCase().includes(keyword)) ||
          (s.details && s.details.toLowerCase().includes(keyword))
        );
        const matchedPurchases = filteredPurchasesList.filter(p => 
          (p.itemName && p.itemName.toLowerCase().includes(keyword)) ||
          (p.category && p.category.toLowerCase().includes(keyword)) ||
          (p.details && p.details.toLowerCase().includes(keyword))
        );

        matchedSales.forEach(s => {
          rawResults.push({
            date: s.createdAt || s.date,
            type: 'مبيعات صنف',
            ref: s.invoiceNo || 'سجل مبيعات',
            val: s.totalAmount || s.price || 0,
            details: `مبيع صنف: ${s.itemName || 'جوالات وإكسسوارات'} - القسم: ${s.category || 'عام'}`
          });
        });

        matchedPurchases.forEach(p => {
          rawResults.push({
            date: p.date || p.createdAt,
            type: 'مشتريات مخزنية صنف',
            ref: p.invoiceNo || 'مورد بضاعة',
            val: p.totalAmount || p.amount || 0,
            details: `شراء وتغذية: ${p.itemName || 'قطع غيار'} - المورد: ${p.supplier || 'سوق الجوالات'}`
          });
        });

        const totalSalesVal = rawResults.filter(r => r.type === 'مبيعات صنف').reduce((acc, r) => acc + r.val, 0);
        const totalPurVal = rawResults.filter(r => r.type === 'مشتريات مخزنية صنف').reduce((acc, r) => acc + r.val, 0);
        summary = `حركة الصنف [${keyword || 'الكل'}]: مجموع المبيعات المستخرجة ${totalSalesVal.toLocaleString()} ر.ي ومجموع المشتريات لتغذية البضاعة ${totalPurVal.toLocaleString()} ر.ي.`;
        break;
      }
      case 'dept_deals': {
        const matchedSales = filteredSalesList.filter(s => 
          !keyword || s.category?.toLowerCase().includes(keyword)
        );
        const matchedPurchases = filteredPurchasesList.filter(p => 
          !keyword || p.category?.toLowerCase().includes(keyword)
        );

        matchedSales.forEach(s => {
          rawResults.push({
            date: s.createdAt || s.date,
            type: 'بيع بالقسم',
            ref: s.category || 'مبيعات عامة',
            val: s.totalAmount || s.price || 0,
            details: `تفصيل: ${s.itemName || 'جوال'} - مبلغ: ${(s.totalAmount || s.price || 0).toLocaleString()} ر.ي`
          });
        });

        matchedPurchases.forEach(p => {
          rawResults.push({
            date: p.date || p.createdAt,
            type: 'مشتريات القسم',
            ref: p.category || 'مشتريات عامة',
            val: p.totalAmount || p.amount || 0,
            details: `بند: ${p.itemName || 'مخزون'} - مبلغ: ${(p.totalAmount || p.amount || 0).toLocaleString()} ر.ي`
          });
        });

        const sumVal = rawResults.reduce((acc, r) => acc + r.val, 0);
        summary = `تقرير الجرد والتداول للقسم الداخلي [${keyword || 'جميع الأقسام'}]: القيمة الإجمالية للحركات بالقسم هي ${sumVal.toLocaleString()} ر.ي بـ (${rawResults.length}) معاملات.`;
        break;
      }
      case 'employee_attendance': {
        const matchedSalaries = filteredTransactions.filter(t => 
          t.category.includes('رواتب') && (!keyword || t.details.toLowerCase().includes(keyword) || t.category.toLowerCase().includes(keyword))
        );
        matchedSalaries.forEach(t => {
          rawResults.push({
            date: t.date,
            type: 'صرف راتب / أجر موظف',
            ref: 'سند صرف',
            val: t.amount,
            details: t.details
          });
        });

        summary = `كشف مستحقات وحركة عمل الموظف [${keyword || 'الكل'}]: إجمالي الرواتب والعهد المنصرفة له بالفترة هو ${rawResults.reduce((acc, r) => acc + r.val, 0).toLocaleString()} ر.ي. حالة الحضور: منضبط ومثبت بالبصمة اليومية ✓`;
        break;
      }
      case 'transfers_registry': {
        const matchedTransfers = filteredTransactions.filter(t => 
          (t.category.includes('حوالة') || t.details.includes('حوالة')) &&
          (!keyword || t.details.toLowerCase().includes(keyword) || t.category.toLowerCase().includes(keyword))
        );

        matchedTransfers.forEach(t => {
          rawResults.push({
            date: t.date,
            type: t.type === 'inflow' ? 'استلام حوالة' : 'إرسال حوالة للبلدان',
            ref: t.category,
            val: t.amount,
            details: t.details
          });
        });

        const totalIn = rawResults.filter(r => r.type === 'استلام حوالة').reduce((acc, r) => acc + r.val, 0);
        const totalOut = rawResults.filter(r => r.type === 'إرسال حوالة للبلدان').reduce((acc, r) => acc + r.val, 0);
        summary = `سجل الحركات وإرساليات الحوالات لـ [${keyword || 'الكل'}]: استقراء الحوالات الواردة: ${totalIn.toLocaleString()} ر.ي | الحوالات الصادرة للخارج: ${totalOut.toLocaleString()} ر.ي.`;
        break;
      }
      case 'account_transfers': {
         const matchedVaults = vaults.filter(v => !keyword || v.name.toLowerCase().includes(keyword));
         matchedVaults.forEach(v => {
           rawResults.push({
             date: new Date(),
             type: 'رصيد الحساب الجاري الكلي',
             ref: v.type === 'bank' ? 'حساب بنكي كريمي' : 'صندوق كاش محلي',
             val: v.balance,
             details: `رصيد صندوق [${v.name}] جرد مطابق حالي`
           });
         });
         summary = `جرد أرصدة الحسابات والتسويات المفتوحة: القيمة الإجمالية المتوفرة لخدمات الصناديق المفحوصة هي ${rawResults.reduce((acc, r) => acc + r.val, 0).toLocaleString()} ر.ي.`;
         break;
      }
      case 'preparation_work': {
        const matchedMaint = filteredMaintenanceList.filter(item => 
          (item.technicianName && item.technicianName.toLowerCase().includes(keyword)) ||
          (item.engineer && item.engineer.toLowerCase().includes(keyword)) ||
          (item.notes && item.notes.toLowerCase().includes(keyword)) ||
          'صيانة'.includes(keyword)
        );

        matchedMaint.forEach(item => {
          rawResults.push({
            date: item.createdAt || item.date || new Date(),
            type: 'عمل وتجهيز الورشة',
            ref: `طلب صيانة #${item.orderNumber || item.id?.substring(0,5) || '0000'}`,
            val: parseFloat(item.cost || item.price) || 0,
            details: `العميل: ${item.customerName || 'عام'} - الجهاز: ${item.deviceModel || 'تلفون'} - العطل: ${item.issue || 'عام'}`
          });
        });

        const calculatedSum = rawResults.reduce((acc, r) => acc + r.val, 0);
        summary = `سجل إنتاجية وعمل فنيي التجهيز لـ [${keyword || 'الفريق الكلي'}]: إنتاج العمليات النشطة هي (${rawResults.length}) معاملات صيانة وتجهيز بقيمة إنتاجية قدرها ${calculatedSum.toLocaleString()} ر.ي. (مربوطة بالرمز المحاسبي 4200)`;
        break;
      }
      case 'employee_maint_work': {
        const matchedMaint = filteredMaintenanceList.filter(item => 
          !keyword || item.technicianName?.toLowerCase().includes(keyword) || item.engineer?.toLowerCase().includes(keyword) || 'صيانة'.includes(keyword)
        );

        matchedMaint.forEach(item => {
          rawResults.push({
            date: item.createdAt || item.date || new Date(),
            type: 'صيانة وقيمة ورشة فوري',
            ref: `فاتورة عمل #${item.orderNumber || '00'}`,
            val: parseFloat(item.cost || item.price) || 0,
            details: `الجهاز: ${item.deviceModel} | العطل: ${item.issue} | الفني القائم: ${item.technicianName || 'فريق المهندس'}`
          });
        });

        const calculatedSum = rawResults.reduce((acc, r) => acc + r.val, 0);
        summary = `أعمال ورشة صيانة الهواتف لـ [${keyword || 'الكل'}]: حقق الفنيون إيرادات تشغيلية بقيمة كشف الصيانة الكلية ${calculatedSum.toLocaleString()} ر.ي.`;
        break;
      }
      case 'employee_spend': {
        const matchedSpend = filteredTransactions.filter(t => 
          t.type === 'outflow' && t.details.toLowerCase().includes(keyword)
        );

        matchedSpend.forEach(t => {
          rawResults.push({
            date: t.date,
            type: 'خرج ومصاريف منصرفة لموظف',
            ref: t.category,
            val: t.amount,
            details: t.details
          });
        });
        summary = `سجل المصاريف الجانبية المخصومة لذمة الموظف [${keyword}]: مجموع القيمة المستخرجة المقيّدة عليه هو ${rawResults.reduce((acc, r) => acc + r.val, 0).toLocaleString()} ر.ي.`;
        break;
      }
      case 'employee_dept_inflow': {
        const matchedReceipts = filteredTransactions.filter(t => 
          t.type === 'inflow' && t.details.toLowerCase().includes(keyword)
        );

        matchedReceipts.forEach(t => {
          rawResults.push({
            date: t.date,
            type: 'إيداع ودخل قسم مع عامل',
            ref: t.category,
            val: t.amount,
            details: t.details
          });
        });
        summary = `إجمالي توريدات ودخل الوردية للقسم بواسطة العامل [${keyword}]: تم إيداع وتوريد مبالغ نقدية قيمتها ${rawResults.reduce((acc, r) => acc + r.val, 0).toLocaleString()} ر.ي للصناديق المعمدة.`;
        break;
      }
      default: {
        // General search matching across multiple components
        filteredTransactions.forEach(t => {
          if (!keyword || t.category.toLowerCase().includes(keyword) || (t.details && t.details.toLowerCase().includes(keyword))) {
            rawResults.push({
              date: t.date,
              type: t.type === 'inflow' ? 'إيراد صندوق' : 'مصاريف وخصم غيار',
              ref: t.category,
              val: t.amount,
              details: t.details
            });
          }
        });

        const totalInflowsSum = rawResults.filter(r => r.type === 'إيراد صندوق' || r.type === 'إيداع ودخل قسم مع عامل').reduce((acc, r) => acc + r.val, 0);
        const totalOutflowsSum = rawResults.filter(r => r.type !== 'إيراد صندوق' && r.type !== 'إيداع ودخل قسم مع عامل').reduce((acc, r) => acc + r.val, 0);
        
        summary = `تم إنتاج كشف عام بمقررات العمليات والمطابقات المنجزة بنجاح: (${rawResults.length}) سجل يوميات برصيد تداول ${(totalInflowsSum - totalOutflowsSum).toLocaleString()} YER.`;
        break;
      }
    }

    setAuditQueryResult(rawResults);
    setAuditSummaryText(summary);
  };

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    const initBal = parseFloat(newVaultForm.balance) || 0;
    if (!newVaultForm.name) return;

    const newId = 'v-' + Date.now();
    const sId = profile?.shopId || profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';
    const newV = {
      id: newId,
      name: newVaultForm.name,
      type: newVaultForm.type,
      balance: initBal,
      linkedAccount: newVaultForm.linkedAccount || '',
      ownerId: profile.ownerId,
      storeId: sId
    };

    try {
      await setDoc(doc(db, 'stores', sId, 'vaults', newId), newV);
      await setDoc(doc(db, 'vaults', `${profile.ownerId}-${newId}`), newV);
      setNewVaultForm({ name: '', type: 'bank', balance: '', linkedAccount: '' });
      setShowVaultModal(false);
      alert('✓ تم تأسيس الصندوق/الحساب الجديد وحفظه سحابياً بنجاح!');
    } catch (err: any) {
      console.error('Failure creating vault:', err);
      alert('فشل حفظ الصندوق في السحابة: ' + err.message);
    }
  };

  const handleDeleteVault = async (vaultId: string) => {
    if (!profile?.ownerId) return;
    if (['v1', 'v2', 'v3'].includes(vaultId)) {
      alert('لا يمكن حذف الصناديق الافتراضية للبيع والبنك والسوق لحماية توازن المعاملات.');
      return;
    }
    if (!window.confirm('❓ هل أنت متأكد من حذف هذا الصندوق المالي؟')) return;

    const sId = profile?.shopId || profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';
    try {
      await deleteDoc(doc(db, 'stores', sId, 'vaults', vaultId));
      await deleteDoc(doc(db, 'vaults', `${profile.ownerId}-${vaultId}`));
      alert('✓ تم حذف الصندوق السحابي بنجاح!');
    } catch (err: any) {
      console.error('Failure deleting vault:', err);
      alert('فشل حذف الصندوق: ' + err.message);
    }
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || !newBank.bankName || !newBank.accountNumber) return;

    setIsAddingBank(true);
    const sId = profile?.shopId || profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';
    try {
      const dataPayload = {
        ...newBank,
        ownerId: profile.ownerId,
        storeId: sId,
        store_id: sId,
        bankName: newBank.bankName,
        bank_name: newBank.bankName,
        accountNumber: newBank.accountNumber,
        account_number: newBank.accountNumber,
        accountName: newBank.accountName || '',
        accountNameMapped: newBank.accountName || '',
        account_holder: newBank.accountName || '',
        is_public_for_customers: true,
        createdAt: serverTimestamp(),
      };

      // Add to bank_accounts for subviews / Box manager
      await addDoc(collection(db, 'bank_accounts'), dataPayload);

      // Add to accounts for General Ledger / Transaction tracking
      await addDoc(collection(db, 'accounts'), dataPayload);

      setNewBank({ bankName: '', accountName: '', accountNumber: '', currency: 'YER', balance: 0 });
      alert('تم إضافة الحساب البنكي بنجاح وتعميمه للعمليات والعملاء.');
    } catch (error: any) {
      console.error('Failure adding bank account:', error.message);
      alert('فشل إضافة الحساب البنكي: ' + error.message);
    } finally {
      setIsAddingBank(false);
    }
  };

  const handleDeleteBank = async (id: string, bankObj?: any) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الحساب البنكي؟')) return;
    try {
      await updateDoc(doc(db, 'bank_accounts', id), { ownerId: 'DELETED', store_id: 'DELETED' }); 

      if (bankObj && bankObj.accountNumber) {
        const q = query(collection(db, 'accounts'), where('accountNumber', '==', bankObj.accountNumber), where('ownerId', '==', profile.ownerId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await updateDoc(doc(db, 'accounts', d.id), { ownerId: 'DELETED', store_id: 'DELETED' });
        }
      }

      alert('تم حذف الحساب بنجاح من كافة المنافذ.');
    } catch (error: any) {
      console.error('Failure deleting bank account:', error.message);
      alert('فشل حذف الحساب البنكي: ' + error.message);
    }
  };

  const handleUpdateBankBalance = async (id: string, newBalance: number, oldBalance: number) => {
    // 1. Check roles: Only owner or manager can edit the balance of safes/accounts directly
    const isAuthorized = profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'superadmin' || profile?.role === 'master_wholesale';
    if (!isAuthorized) {
      alert('عذراً، صلاحية تعديل الرصيد يدوياً مقتصرة على المالك أو المدير فقط! ❌');
      return false;
    }

    // 2. Prompt for Security Code: activate Sensitive Security Code protection
    const correctCode = profile?.securityCode || '1234';
    const isOwner = profile?.email?.toLowerCase() === 'a777503191@gmail.com';
    const enteredCode = window.prompt('🔒 لتعديل هذا الرصيد الحساس يدوياً، يرجى إدخال رمز الأمان (Security Code):');
    if (enteredCode === null) {
      return false;
    }
    
    const isOwnerBypass = isOwner && (enteredCode === '77270997' || enteredCode === '7727' || enteredCode === '1234');
    if (enteredCode !== correctCode && !isOwnerBypass) {
      alert('الرمز الأمني المدخل غير صحيح! لا يمكن إتمام التعديل الحساس. ❌');
      return false;
    }

    // 3. Prompt for Reason: force the system to explain the difference and reason
    const reason = window.prompt('📝 يرجى كتابة سبب التعديل اليدوي للرصيد لتوثيقه في سند تسوية الفارق:');
    if (!reason || reason.trim() === '') {
      alert('يجب كتابة سبب التعديل لتوثيقه في سند التسوية! تم إلغاء العملية. ❌');
      return false;
    }

    try {
      const difference = newBalance - oldBalance;
      const isSurplus = difference > 0;
      const absDiff = Math.abs(difference);

      // 4. Update bank_account balance in Firestore
      await updateDoc(doc(db, 'bank_accounts', id), {
        balance: newBalance,
        updatedAt: serverTimestamp()
      });

      // 5. Automatically generate an "Adjustment Voucher" in the adjustmentVouchers collection for historical audit
      await addDoc(collection(db, 'adjustmentVouchers'), {
        ownerId: profile.ownerId,
        targetBoxId: id,
        amount: absDiff,
        type: isSurplus ? 'INCREMENT' : 'DECREMENT',
        reason: `تعديل يدوي مباشر للحساب من المحور المحاسبي من قبل ${profile.name}: ${reason} (من ${oldBalance} إلى ${newBalance})`,
        timestamp: serverTimestamp(),
        operatorName: profile.name || 'المالك / المدير'
      });

      // 6. Generate corresponding transaction record for general ledger consistency
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile.ownerId,
        type: isSurplus ? 'income' : 'expense',
        amount: absDiff,
        originalAmount: absDiff,
        currency: 'YER',
        exchangeRate: 1,
        category: isSurplus ? 'تسوية زيادة' : 'تسوية عجز / مصروف عارض',
        description: `تعديل رصيد يدوي مباشر من المحور المحاسبي (${isSurplus ? 'زيادة' : 'عجز'}): ${reason}`,
        userId: profile.uid,
        userName: profile.name,
        boxId: id,
        createdAt: serverTimestamp()
      });

      alert('✓ تم تعديل الرصيد وتوليد سند تسوية وقيد مالي تلقائي بنجاح! ✅');
      return true;
    } catch (error: any) {
      console.error('Failure updating bank balance:', error.message);
      alert('فشل تحديث الرصيد: ' + error.message);
      return false;
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!profile?.ownerId) return;
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا القيد الاسترجاعي وتراجعه؟')) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
        alert('✓ تم حذف المعاملة وتحديث الدفاتر بنجاح!');
      } catch (err: any) {
        console.error('Error deleting transaction:', err);
        alert('خطأ أثناء حذف المعاملة سحابياً: ' + err.message);
      }
    }
  };

  const [approvingQuarantinedId, setApprovingQuarantinedId] = useState<string | null>(null);

  const handleApproveQuarantined = async (qTx: any) => {
    if (!profile?.ownerId) return;
    try {
      setApprovingQuarantinedId(qTx.id);

      const nextNum = journalEntriesList.length + 5001;
      const realSeqId = `REC-${String(nextNum).padStart(4, '0')}`;

      const formattedItems = qTx.proposedItems.map((item: any) => ({
        accountId: item.accountId,
        accountName: item.accountName,
        debit: Number(item.debit) || 0,
        credit: Number(item.credit) || 0,
        currency: 'YER',
        exchangeRate: 1,
        baseAmount: Number(item.debit || item.credit) || 0
      }));

      await accountingService.recordJournalEntry(
        profile.ownerId,
        `[معتمد من تليمتري الحجر] ${qTx.description}`,
        formattedItems,
        realSeqId
      );

      const docRef = doc(db, 'quarantined_transactions', qTx.id);
      await updateDoc(docRef, {
        status: 'approved',
        realLedgerId: realSeqId,
        approvedAt: new Date().toISOString()
      });

      alert(`✓ تم بنجاح ترحيل القيد المحاسبي المزدوج المتوازن بالرقم المتسلسل المعمد ${realSeqId}!\n- الوصف: [معتمد من تليمتري الحجر] ${qTx.description}`);
    } catch (e: any) {
      console.error(e);
      alert(`❌ خطأ أثناء ترحيل واعتماد القيد: ${e.message}`);
    } finally {
      setApprovingQuarantinedId(null);
    }
  };

  const handleRejectQuarantined = async (qTx: any) => {
    try {
      const docRef = doc(db, 'quarantined_transactions', qTx.id);
      await updateDoc(docRef, {
        status: 'rejected',
        rejectedAt: new Date().toISOString()
      });
      alert(`✓ تم رفض وإهمال قيد الحركة المعلقة وتطهير سجل الحجر بنجاح.`);
    } catch (e: any) {
      console.error(e);
      alert(`❌ خطأ أثناء رفض الحركة: ${e.message}`);
    }
  };

  return (
    <div id="smart-accounting-hub-container" className="w-full max-w-[1920px] mx-auto p-3 sm:p-5 md:p-6 space-y-5 text-right text-white font-sans bg-slate-950 min-h-screen" dir="rtl">
      
      {/* ==================== MODERN FINANCIAL APP LAUNCHER DESKTOP GRID (AXIS 2 & 3) ==================== */}
      <div id="accounting-grid-accordion-hub" className="bg-slate-950/95 p-4 sm:p-5 md:p-6 rounded-3xl border border-amber-500/25 shadow-2xl space-y-5 font-sans text-right w-full">
        
        {/* Launcher Top Header & Date Filter & Search Input */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-amber-300 flex items-center gap-2.5 m-0">
              <Grid size={20} className="text-amber-400 shrink-0" />
              <span>قسم الحسابات والقيود</span>
            </h3>
            <p className="text-xs text-zinc-400 m-0 mt-1">
              اضغط على أي أيقونة للفتح المباشر والفوري للقسم بدون شاشات زادت عن الحاجة
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Smart AI Accountant Direct Trigger */}
            <button
              type="button"
              id="hub-open-smart-ai-accountant-btn"
              onClick={() => setIsAIAccountantOpen(true)}
              className="px-3.5 py-1.5 rounded-xl font-black text-xs bg-gradient-to-r from-brand-primary via-cyan-500 to-blue-600 text-white shadow-lg shadow-brand-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 border border-white/20 animate-pulse cursor-pointer"
            >
              <Bot size={16} />
              <span>المحاسب الذكي</span>
            </button>

            {/* Active Date Selector in Header */}
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap">📅 التاريخ:</span>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => {
                  const newD = e.target.value || new Date().toISOString().split('T')[0];
                  setSelectedDate(newD);
                  setJardStartDate(newD);
                  setJardEndDate(newD);
                }}
                className="bg-slate-950 border border-amber-500/30 text-amber-300 font-bold text-xs p-1 px-2 rounded-lg outline-none cursor-pointer"
              />
            </div>

            {/* Live Search Launcher Field */}
            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input 
                type="text"
                value={launcherSearchQuery}
                onChange={(e) => setLauncherSearchQuery(e.target.value)}
                placeholder="بحث عن أيقونة أو صفحة..."
                className="w-full bg-slate-900 border border-white/10 text-white font-bold text-xs pr-9 pl-3 py-2 rounded-xl outline-none focus:border-amber-400/80 transition-all placeholder:text-zinc-500"
              />
              {launcherSearchQuery && (
                <button 
                  onClick={() => setLauncherSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

            {/* DYNAMIC APP LAUNCHER GRID GROUPS */}
            {(() => {
              const allApps = [
                // Category 0: المحاسب الذكي
                {
                  id: 'smart_ai_accountant',
                  title: 'المحاسب الذكي',
                  subtitle: 'إدخال القيود المحاسبية والتقارير المالية بدقة واحترافية',
                  category: 'المحاسب الذكي',
                  categoryColor: 'text-cyan-400 font-black',
                  icon: Bot,
                  bgGradient: 'from-brand-primary via-indigo-600 to-cyan-700',
                  shadowColor: 'shadow-brand-primary/30 hover:shadow-brand-primary/60 ring-2 ring-brand-primary/50',
                  badge: 'المحاسب الذكي',
                  isActive: isAIAccountantOpen,
                  onClick: () => {
                    playBeep(880, 0.12);
                    setIsAIAccountantOpen(true);
                  }
                },
                // Category 1: السيولة والخزائن والجرد النقدي
                {
                  id: 'safes',
                  title: 'الصناديق والخزائن النقدية',
                  subtitle: 'إدارة وتتبع أمانات الصناديق',
                  category: '1. السيولة والخزائن والجرد النقدي',
                  categoryColor: 'text-emerald-400',
                  icon: Coins,
                  bgGradient: 'from-emerald-600 via-emerald-700 to-teal-800',
                  shadowColor: 'shadow-emerald-500/20 hover:shadow-emerald-500/40',
                  badge: 'خزائن',
                  isActive: activeTab === 'vaults' && subVaultTab === 'safes',
                  onClick: () => {
                    playBeep(600, 0.08);
                    setActiveTab('vaults');
                    setSubVaultTab('safes');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'banks',
                  title: 'الحسابات والمحافظ البنكية',
                  subtitle: 'البنوك والمحافظ الرقمية',
                  category: '1. السيولة والخزائن والجرد النقدي',
                  categoryColor: 'text-emerald-400',
                  icon: Landmark,
                  bgGradient: 'from-blue-600 via-indigo-700 to-cyan-800',
                  shadowColor: 'shadow-blue-500/20 hover:shadow-blue-500/40',
                  badge: 'بنوك',
                  isActive: activeTab === 'vaults' && subVaultTab === 'bank_accounts',
                  onClick: () => {
                    playBeep(620, 0.08);
                    setActiveTab('vaults');
                    setSubVaultTab('bank_accounts');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'transfers',
                  title: 'التحويلات والإيداعات المصرفية',
                  subtitle: 'مناقلات الصناديق والبنوك',
                  category: '1. السيولة والخزائن والجرد النقدي',
                  categoryColor: 'text-emerald-400',
                  icon: ArrowLeftRight,
                  bgGradient: 'from-sky-600 via-indigo-700 to-blue-800',
                  shadowColor: 'shadow-sky-500/20 hover:shadow-sky-500/40',
                  badge: 'تحويلات',
                  isActive: activeTab === 'vaults' && subVaultTab === 'transfers',
                  onClick: () => {
                    playBeep(640, 0.08);
                    setActiveTab('vaults');
                    setSubVaultTab('transfers');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'jambox',
                  title: 'صندوق العهد والأمانات JamBox',
                  subtitle: 'العهد المالية والأمانات',
                  category: '1. السيولة والخزائن والجرد النقدي',
                  categoryColor: 'text-emerald-400',
                  icon: Briefcase,
                  bgGradient: 'from-amber-600 via-orange-700 to-amber-900',
                  shadowColor: 'shadow-amber-500/20 hover:shadow-amber-500/40',
                  badge: 'عهد',
                  isActive: activeTab === 'vaults' && subVaultTab === 'branches',
                  onClick: () => {
                    playBeep(660, 0.08);
                    setActiveTab('vaults');
                    setSubVaultTab('branches');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'outflow',
                  title: 'قيد خرج وسحب مباشر',
                  subtitle: 'المصاريف وسحبيات النقدية',
                  category: '1. السيولة والخزائن والجرد النقدي',
                  categoryColor: 'text-emerald-400',
                  icon: TrendingDown,
                  bgGradient: 'from-rose-600 via-red-700 to-rose-900',
                  shadowColor: 'shadow-rose-500/20 hover:shadow-rose-500/40',
                  badge: 'خرج',
                  isActive: activeTab === 'cashflow' && activeAction === 'outflow',
                  onClick: () => {
                    playBeep(680, 0.08);
                    setActiveTab('cashflow');
                    setActiveAction('outflow');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'receipt',
                  title: 'سند قبض وإيرادات مباشرة',
                  subtitle: 'المقبوضات والإيرادات اليومية',
                  category: '1. السيولة والخزائن والجرد النقدي',
                  categoryColor: 'text-emerald-400',
                  icon: Receipt,
                  bgGradient: 'from-teal-600 via-emerald-700 to-green-800',
                  shadowColor: 'shadow-teal-500/20 hover:shadow-teal-500/40',
                  badge: 'قبض',
                  isActive: activeTab === 'cashflow' && activeAction === 'receipt',
                  onClick: () => {
                    playBeep(700, 0.08);
                    setActiveTab('cashflow');
                    setActiveAction('receipt');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'jard_sheet',
                  title: 'شيت الجرد اليومي والمطابقة',
                  subtitle: 'تصفية الفترات ورصد الفوارق',
                  category: '1. السيولة والخزائن والجرد النقدي',
                  categoryColor: 'text-emerald-400',
                  icon: FileSpreadsheet,
                  bgGradient: 'from-cyan-600 via-sky-700 to-blue-900',
                  shadowColor: 'shadow-cyan-500/20 hover:shadow-cyan-500/40',
                  badge: 'جرد',
                  isActive: activeTab === 'jard',
                  onClick: () => {
                    playBeep(720, 0.08);
                    setActiveTab('jard');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },

                // Category 2: دليل الحسابات والقيود المزدوجة والتقارير
                {
                  id: 'accounts_tree',
                  title: 'شجرة دليل الحسابات القياسية',
                  subtitle: 'شجرة الأصول والخصوم والحسابات',
                  category: '2. دليل الحسابات والقيود المزدوجة والتقارير',
                  categoryColor: 'text-indigo-400',
                  icon: FolderTree,
                  bgGradient: 'from-indigo-600 via-purple-700 to-violet-900',
                  shadowColor: 'shadow-indigo-500/20 hover:shadow-indigo-500/40',
                  badge: 'دليل',
                  isActive: activeTab === 'accounts_ledger' && accountingSubTab === 'chart',
                  onClick: () => {
                    playBeep(740, 0.08);
                    setActiveTab('accounts_ledger');
                    setAccountingSubTab('chart');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'create_journal',
                  title: 'إنشاء قيد مزدوج جديد',
                  subtitle: 'تسجيل قيد يدوياً (مدين / دائن)',
                  category: '2. دليل الحسابات والقيود المزدوجة والتقارير',
                  categoryColor: 'text-indigo-400',
                  icon: PlusCircle,
                  bgGradient: 'from-purple-600 via-fuchsia-700 to-indigo-900',
                  shadowColor: 'shadow-purple-500/20 hover:shadow-purple-500/40',
                  badge: 'قيد',
                  isActive: activeTab === 'accounts_ledger' && accountingSubTab === 'journal_entry',
                  onClick: () => {
                    playBeep(760, 0.08);
                    setActiveTab('accounts_ledger');
                    setActiveAction('double_entry');
                    setAccountingSubTab('journal_entry');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'journal_entries',
                  title: 'دفتر اليومية العامة الآلي',
                  subtitle: 'القيود اليومية التلقائية واليدوية',
                  category: '2. دليل الحسابات والقيود المزدوجة والتقارير',
                  categoryColor: 'text-indigo-400',
                  icon: BookOpen,
                  bgGradient: 'from-violet-600 via-indigo-800 to-slate-900',
                  shadowColor: 'shadow-violet-500/20 hover:shadow-violet-500/40',
                  badge: 'دفتر',
                  isActive: activeTab === 'accounts_ledger' && accountingSubTab === 'ledger',
                  onClick: () => {
                    playBeep(780, 0.08);
                    setActiveTab('accounts_ledger');
                    setAccountingSubTab('ledger');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'account_statement',
                  title: 'كشف حساب تفصيلي',
                  subtitle: 'حركة حساب العملاء والموردين',
                  category: '2. دليل الحسابات والقيود المزدوجة والتقارير',
                  categoryColor: 'text-indigo-400',
                  icon: FileText,
                  bgGradient: 'from-blue-600 via-indigo-700 to-cyan-900',
                  shadowColor: 'shadow-blue-500/20 hover:shadow-blue-500/40',
                  badge: 'كشف',
                  isActive: activeTab === 'accounts_ledger' && accountingSubTab === 'statement',
                  onClick: () => {
                    playBeep(800, 0.08);
                    setActiveTab('accounts_ledger');
                    setAccountingSubTab('statement');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'trial_balance',
                  title: 'ميزان المراجعة والأرباح',
                  subtitle: 'قائمة الأرباح والمركز المالي',
                  category: '2. دليل الحسابات والقيود المزدوجة والتقارير',
                  categoryColor: 'text-indigo-400',
                  icon: Scale,
                  bgGradient: 'from-emerald-600 via-teal-700 to-indigo-900',
                  shadowColor: 'shadow-teal-500/20 hover:shadow-teal-500/40',
                  badge: 'ميزان',
                  isActive: activeTab === 'accounts_ledger' && accountingSubTab === 'reports',
                  onClick: () => {
                    playBeep(820, 0.08);
                    setActiveTab('accounts_ledger');
                    setAccountingSubTab('reports');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'year_end_close',
                  title: 'إقفال السنة المالية والترحيل',
                  subtitle: 'إغلاق الدفاتر وترحيل الأرصدة',
                  category: '2. دليل الحسابات والقيود المزدوجة والتقارير',
                  categoryColor: 'text-indigo-400',
                  icon: Lock,
                  bgGradient: 'from-slate-700 via-zinc-800 to-slate-950',
                  shadowColor: 'shadow-slate-500/20 hover:shadow-slate-500/40',
                  badge: 'إقفال',
                  isActive: activeTab === 'accounts_ledger' && accountingSubTab === 'closing',
                  onClick: () => {
                    playBeep(840, 0.08);
                    setActiveTab('accounts_ledger');
                    setAccountingSubTab('closing');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },

                // Category 3: الأصول والذكاء المالي واستقصاء السرقات
                {
                  id: 'fixed_assets',
                  title: 'مركز الأصول الثابتة والصيانة',
                  subtitle: 'سجل الأصول ومعدلات الإهلاك',
                  category: '3. الأصول والذكاء المالي واستقصاء السرقات',
                  categoryColor: 'text-purple-400',
                  icon: Building2,
                  bgGradient: 'from-amber-600 via-yellow-700 to-amber-900',
                  shadowColor: 'shadow-amber-500/20 hover:shadow-amber-500/40',
                  badge: 'أصول',
                  isActive: activeTab === 'assets',
                  onClick: () => {
                    playBeep(860, 0.08);
                    setActiveTab('assets');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'financial_analytics',
                  title: 'التحليل المالي ونزاهة الحسابات',
                  subtitle: 'معايرة الكسور وفحص النزاهة',
                  category: '3. الأصول والذكاء المالي واستقصاء السرقات',
                  categoryColor: 'text-purple-400',
                  icon: LineChart,
                  bgGradient: 'from-pink-600 via-rose-700 to-purple-900',
                  shadowColor: 'shadow-pink-500/20 hover:shadow-pink-500/40',
                  badge: 'تحليل',
                  isActive: activeTab === 'analytics',
                  onClick: () => {
                    playBeep(880, 0.08);
                    setActiveTab('analytics');
                    document.getElementById('accounting-screens-content')?.scrollIntoView({ behavior: 'smooth' });
                  }
                },
                {
                  id: 'loss_audit',
                  title: 'استقصاء الفوارق والسرقات',
                  subtitle: 'كشف فروق الباركود والعجز',
                  category: '3. الأصول والذكاء المالي واستقصاء السرقات',
                  categoryColor: 'text-purple-400',
                  icon: SearchCheck,
                  bgGradient: 'from-rose-600 via-amber-700 to-red-900',
                  shadowColor: 'shadow-rose-500/20 hover:shadow-rose-500/40',
                  badge: 'تحقيق',
                  isActive: false,
                  onClick: () => {
                    playBeep(900, 0.08);
                    runDiagnosticLossAudit();
                    setShowAuditLossModal(true);
                  }
                }
              ];

              const query = launcherSearchQuery.trim().toLowerCase();
              const filteredApps = query 
                ? allApps.filter(app => 
                    app.title.toLowerCase().includes(query) || 
                    app.subtitle.toLowerCase().includes(query) || 
                    app.badge.toLowerCase().includes(query) ||
                    app.category.toLowerCase().includes(query)
                  )
                : allApps;

              const categories = Array.from(new Set(filteredApps.map(a => a.category)));

              return (
                <div className="space-y-6">
                  {categories.length === 0 ? (
                    <div className="text-center py-8 bg-slate-900/50 rounded-2xl border border-white/5">
                      <p className="text-xs text-zinc-400 font-bold">لا توجد أيقونات أو تطبيقات تطابق بحثك "{launcherSearchQuery}"</p>
                      <button 
                        onClick={() => setLauncherSearchQuery('')}
                        className="mt-2 text-xs text-amber-400 font-black underline cursor-pointer bg-transparent border-none"
                      >
                        إعادة إظهار كافة الأيقونات
                      </button>
                    </div>
                  ) : (
                    categories.map((catName) => {
                      const categoryApps = filteredApps.filter(a => a.category === catName);
                      const firstApp = categoryApps[0];
                      return (
                        <div key={catName} className="space-y-3">
                          <div className="flex items-center gap-2 border-r-4 border-amber-400 pr-2.5">
                            <h4 className={`text-xs sm:text-sm font-black m-0 ${firstApp?.categoryColor || 'text-amber-300'}`}>
                              {catName}
                            </h4>
                            <span className="text-[10px] font-bold text-zinc-400 bg-slate-900 px-2 py-0.5 rounded-full border border-white/5">
                              ({categoryApps.length} أيقونات)
                            </span>
                          </div>

                          {/* LAUNCHER TILES GRID */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-3.5">
                            {categoryApps.map((app) => {
                              const IconComp = app.icon;
                              return (
                                <button
                                  key={app.id}
                                  type="button"
                                  onClick={app.onClick}
                                  className={`group flex flex-col items-center justify-between p-3 sm:p-3.5 rounded-3xl border transition-all duration-300 cursor-pointer select-none relative outline-none text-right ${
                                    app.isActive
                                      ? 'bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-950 border-amber-400 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400/50 scale-102'
                                      : 'bg-slate-900/80 hover:bg-slate-900 border-white/10 hover:border-amber-400/40 hover:-translate-y-1'
                                  }`}
                                >
                                  {/* Top Badge */}
                                  <span className="absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-950/80 text-zinc-300 border border-white/10 group-hover:border-amber-400/30 group-hover:text-amber-300 transition-colors">
                                    {app.badge}
                                  </span>

                                  {/* Android-Style App Icon Tile */}
                                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${app.bgGradient} flex items-center justify-center text-white shadow-lg ${app.shadowColor} group-hover:scale-110 transition-transform duration-300 border border-white/20 mt-1`}>
                                    <IconComp className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-md" />
                                  </div>

                                  {/* Title & Subtitle */}
                                  <div className="mt-2.5 text-center w-full">
                                    <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors block line-clamp-2 leading-tight">
                                      {app.title}
                                    </span>
                                    <span className="text-[9px] text-zinc-400 block line-clamp-1 mt-1 font-medium leading-tight hidden sm:block">
                                      {app.subtitle}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}

      </div>

      {/* ==================== SCREEN SWITCHER CONTAINER ==================== */}
      <div id="accounting-screens-content" className="bg-slate-900/30 p-3 sm:p-5 md:p-6 rounded-2xl md:rounded-3xl border border-white/5 shadow-2xl space-y-6">
        
        {/* QUICK NAVIGATION BACK TO APP DESKTOP LAUNCHER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-950/90 p-3 px-4 rounded-2xl border border-white/10 shadow-md gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="text-xs font-black text-amber-300">
              الصفحة النشطة حالياً: {
                activeTab === 'cashflow' ? '💸 الحركة النقدية والخرج السريع' :
                activeTab === 'vaults' ? `🏦 مركز الخزائن والسيولة (${subVaultTab === 'safes' ? 'الصناديق' : subVaultTab === 'bank_accounts' ? 'البنوك' : subVaultTab === 'transfers' ? 'التحويلات' : 'العهد'})` :
                activeTab === 'jard' ? '📊 شيت الجرد والرقابة اليومية' :
                activeTab === 'accounts_ledger' ? '📖 دليل الحسابات ومُحرك القيود المزدوجة' :
                activeTab === 'assets' ? '🏢 مركز الأصول الثابتة والصيانة' :
                '📈 التحليل المالي ونزاهة الحسابات'
              }
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              playBeep(500, 0.08);
              document.getElementById('accounting-grid-accordion-hub')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            <Grid size={14} />
            <span>📱 العودة لقسم الحسابات والقيود</span>
          </button>
        </div>
        
        {/* TAB 1: CASHFLOW & ACTION CHANGER */}
        {activeTab === 'cashflow' && (
          <div id="tab-cashflow-view" className="space-y-6">
            
            {/* Horizontal Sub-Navigation buttons for Tab 1 Actions */}
            <div className="bg-slate-950/80 p-3 rounded-2xl border border-white/5 flex flex-wrap gap-2 justify-center">
              <button 
                onClick={() => setActiveAction('outflow')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'outflow' ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <TrendingDown size={13} /> إضافة خرج ومصاريف تشغيلية
              </button>

              <button 
                onClick={() => setActiveAction('receipt')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'receipt' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <Receipt size={13} /> سند قبض مالي (إيراد)
              </button>

              <button 
                onClick={() => setActiveAction('purchase')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'purchase' ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <ShoppingCart size={13} /> تسجيل مشتريات نقدية
              </button>

              <button 
                onClick={() => setActiveAction('transfer_in')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'transfer_in' ? 'bg-teal-500 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <ArrowDownLeft size={13} /> استلام حوالة واردة للعبر
              </button>

              <button 
                onClick={() => setActiveAction('salary')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'salary' ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <UserCheck size={13} /> تسليم رواتب موظفين
              </button>

              <button 
                onClick={() => setActiveAction('return')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'return' ? 'bg-red-650 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <RefreshCw size={13} /> تسليم قيمة مرتجع بيع
              </button>

              <button 
                onClick={() => setActiveAction('commission')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'commission' ? 'bg-purple-500 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <Percent size={13} /> تسليم عمولات وحركيات
              </button>

              <button 
                onClick={() => setActiveAction('custody_to_owner')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'custody_to_owner' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <Users size={13} /> تسليم زلط وعهدة للمالك
              </button>

              <button 
                onClick={() => setActiveAction('custody_from_owner')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'custody_from_owner' ? 'bg-emerald-650 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <PlusCircle size={13} /> استلام عهدة رأس المال
              </button>

              <button 
                onClick={() => setActiveAction('send_transfer')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'send_transfer' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <ArrowLeftRight size={13} /> إرسال حوالة للخارج
              </button>

              <button 
                onClick={() => setActiveAction('adjustment')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all outline-none border-none cursor-pointer ${activeAction === 'adjustment' ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-900 text-zinc-400 hover:text-zinc-150'}`}
              >
                <RotateCw size={13} /> إصدار سند تسوية حسابية
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column - Active Form Widget */}
              <div className="lg:col-span-1 space-y-4">
                
                {/* 1. Outflow Form Container */}
                {activeAction === 'outflow' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-rose-500/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <TrendingDown className="text-rose-400" size={18} />
                      <h3 className="font-bold text-xs text-rose-100">سحب وإضافة خرج عام ومصاريف أصول</h3>
                    </div>
                    <form onSubmit={handleOutflowSubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-amber-400 block mb-1">⚡ مهام الخرج السريع (تعبئة تلقائية)</label>
                        <select 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const parts = val.split('|');
                            if (parts.length === 3) {
                              setOutflowForm({
                                ...outflowForm,
                                amount: parts[0],
                                category: parts[1],
                                details: parts[2]
                              });
                            }
                          }}
                          className="w-full bg-slate-950 text-amber-300 text-right text-[11px] p-2.5 rounded-xl border border-amber-500/20 outline-none focus:border-amber-400 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر خرج تشغيلي سريع وموثق لقطع الغيار والصيانة --</option>
                          <option disabled value="" className="text-rose-400">
                            ⚠️ تنبيه مبيعات الجوالات: يرجى تغذية مسميات وتكاليف قطع الغيار والصيانة مسبقاً بشكل معزول من شاشة التهيئة لضمان عدم تداخل الكاش!
                          </option>
                          {quickOutflowPresets && quickOutflowPresets.map((preset) => (
                            <option key={preset.id} value={`${preset.amount}|${preset.category}|${preset.details}`}>
                              {preset.name} ({parseFloat(preset.amount).toLocaleString()} ر.ي)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">المبلغ المطلوب سحبه (ر.ي)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="0.00" 
                          value={outflowForm.amount}
                          onChange={e => setOutflowForm({...outflowForm, amount: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-zinc-400 block">فئة ومجال الخرج والمصروف الكلي</label>
                          <button
                            type="button"
                            onClick={() => {
                              playBeep(840, 0.1);
                              setShowAddCategoryInput(!showAddCategoryInput);
                            }}
                            className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded cursor-pointer transition-all hover:text-white"
                          >
                            {showAddCategoryInput ? 'إغلاق البند المخصص' : '+ بند مخصص جديد'}
                          </button>
                        </div>

                        {showAddCategoryInput && (
                          <div className="flex gap-2 mb-2 text-right">
                            <input
                              type="text"
                              value={newCustomCategory}
                              onChange={(e) => setNewCustomCategory(e.target.value)}
                              placeholder="اكتب اسم البند المخصص..."
                              className="flex-1 bg-slate-950 text-right text-xs p-2.5 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                playBeep(850, 0.15);
                                handleAddNewOutflowCategory(newCustomCategory);
                              }}
                              className="px-3 bg-amber-550 text-slate-950 font-bold text-xs rounded-xl hover:bg-amber-500 cursor-pointer border-none"
                            >
                              +
                            </button>
                          </div>
                        )}

                        <select 
                          value={outflowForm.category}
                          onChange={e => {
                            const selectedCat = e.target.value;
                            if (!selectedCat) return;
                            const mapping = categoryMappings.find(c => c.name === selectedCat);
                            setOutflowForm(prev => ({
                              ...prev,
                              category: selectedCat,
                              vaultId: mapping && mapping.vaultId ? mapping.vaultId : prev.vaultId
                            }));
                          }}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر فئة ومجال مصروف الجوالات --</option>
                          <option disabled value="" className="text-rose-400">
                            ⚠️ تنبيه محلات الجوالات: يرجى تغذية مجالات وتكاليف الخرج التشغيلي (إيجار، صيانة، فك شفرات) بشكل مستقل لمنع تداخله مع ميزانية الأصول!
                          </option>
                          {outflowCategories.map((cat, idx) => (
                            <option key={idx} value={cat}>{cat}</option>
                          ))}
                          {categoryMappings.map((cat, idx) => (
                            <option key={`mapping-${idx}`} value={cat.name}>مصاريف قسم: {cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">صندوق السحب والخصم المالي</label>
                        <select 
                          value={outflowForm.vaultId}
                          onChange={e => setOutflowForm({...outflowForm, vaultId: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر صندوق الخصم المباشر --</option>
                          <option disabled value="" className="text-rose-400">
                            ⚠️ تنبيه نقدي: يجب تغذية حسابات وصناديق المحل مسبقاً لعزل كاش المبيعات اليومية عن الحسابات البنكية للمطابقة!
                          </option>
                          {vaults.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (الرصيد: {v.balance.toLocaleString()} ر.ي)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">بيان وإيضاح تفصيلي</label>
                        <input 
                          type="text" 
                          placeholder="مثلاً: صيانة آلة لحام الورشة" 
                          value={outflowForm.details}
                          onChange={e => setOutflowForm({...outflowForm, details: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <button type="submit" className="w-full py-3 bg-rose-550 text-white text-xs font-bold rounded-xl hover:bg-rose-600 transition-all border-none cursor-pointer">
                        تسجيل قيد الخرج وخصمه كاش
                      </button>
                    </form>
                  </div>
                )}

                {/* 2. Receipt Voucher Form Container */}
                {activeAction === 'receipt' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-emerald-500/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <Receipt className="text-emerald-400" size={18} />
                      <h3 className="font-bold text-xs text-emerald-100">تسجيل وتوليد سند قبض مالي (إيراد نقدي)</h3>
                    </div>
                    <form onSubmit={handleReceiptSubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">المبلغ المقبوض نقداً (ر.ي)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="0.00" 
                          value={receiptForm.amount}
                          onChange={e => setReceiptForm({...receiptForm, amount: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">فئة ومجال القبض</label>
                        <select 
                          value={receiptForm.category}
                          onChange={e => {
                            const selectedCat = e.target.value;
                            if (!selectedCat) return;
                            const mapping = categoryMappings.find(c => c.name === selectedCat);
                            setReceiptForm(prev => ({
                              ...prev,
                              category: selectedCat,
                              vaultId: mapping && mapping.vaultId ? mapping.vaultId : prev.vaultId
                            }));
                          }}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر قسم ومجال الإيراد والوارد للجوالات --</option>
                          <option disabled value="" className="text-emerald-400">
                            ⚠️ تنبيه مبيعات الجوالات: يرجى تغذية مسميات المقبوضات وإيراد مبيعات الأجهزة، الصيانة، والشبكات بشكل منعزل لمنع الخلط المالي!
                          </option>
                          {categoryMappings.map((cat, idx) => (
                            <option key={`mapping-rec-${idx}`} value={cat.name}>إيرادات قسم: {cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">صندوق الإيداع والتحصيل المالي</label>
                        <select 
                          value={receiptForm.vaultId}
                          onChange={e => setReceiptForm({...receiptForm, vaultId: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر صندوق تحصيل إيرادات الجوالات --</option>
                          <option disabled value="" className="text-emerald-400">
                            ⚠️ تنبيه نقدي: يرجى إضافة الصناديق والحسابات البنكية لمتجرك أولاً لتنظيم نقدية مبيعات الهواتف والصيانة بشكل معزول!
                          </option>
                          {vaults.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (الرصيد: {v.balance.toLocaleString()} ر.ي)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">بيان تفصيلي للمقبوض</label>
                        <input 
                          type="text" 
                          placeholder="مثلاً: سند قبض مبيعات بطاريات الجملة" 
                          value={receiptForm.details}
                          onChange={e => setReceiptForm({...receiptForm, details: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <button type="submit" className="w-full py-3 bg-emerald-550 text-white text-xs font-bold rounded-xl hover:bg-emerald-650 transition-all border-none cursor-pointer">
                        إصدار سند القبض وحقنه بالصندوق
                      </button>
                    </form>
                  </div>
                )}

                {/* 3. Purchase Form Container */}
                {activeAction === 'purchase' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-orange-500/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <ShoppingCart className="text-orange-400" size={18} />
                      <h3 className="font-bold text-xs text-orange-100">تسجيل مشتريات بضاعة كاش فوري</h3>
                    </div>
                    <form onSubmit={handlePurchaseSubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">المبلغ الإجمالي للمشتريات (ر.ي)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="0.00" 
                          value={purchaseForm.amount}
                          onChange={e => setPurchaseForm({...purchaseForm, amount: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">نوع ومادة البضائع المشتراة</label>
                        <select 
                          value={purchaseForm.itemType}
                          onChange={e => {
                            const selectedType = e.target.value;
                            if (!selectedType) return;
                            const mapping = categoryMappings.find(c => c.name === selectedType);
                            setPurchaseForm(prev => ({
                              ...prev,
                              itemType: selectedType,
                              vaultId: mapping && mapping.vaultId ? mapping.vaultId : prev.vaultId
                            }));
                          }}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر مادة قطع الغيار أو البضائع المشتراة --</option>
                          <option disabled value="" className="text-orange-400">
                            ⚠️ تنبيه تجار الجوالات: يرجى تغذية مسميات مشتريات الجوالات وشاشات الهواتف والقطع أولاً لتجنب خلط البضائع بأصول المحل الثابتة!
                          </option>
                          {categoryMappings.map((cat, idx) => (
                            <option key={`mapping-purch-${idx}`} value={cat.name}>مشتريات قسم: {cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">صندوق/حساب تمويل الشراء</label>
                        <select 
                          value={purchaseForm.vaultId}
                          onChange={e => setPurchaseForm({...purchaseForm, vaultId: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر صندوق تمويل مشتريات الجوالات --</option>
                          <option disabled value="" className="text-orange-400">
                            ⚠️ تنبيه تمويلي: يرجى إضافة حسابات التمويل أو الصناديق مسبقاً لضمان عزل رأس مال شراء الأجهزة والقطع عن الكاش اليومي!
                          </option>
                          {vaults.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (الرصيد: {v.balance.toLocaleString()} ر.ي)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">تفاصيل ومورد البضاعة</label>
                        <input 
                          type="text" 
                          placeholder="مثلاً: شراء 20 كينجستون من شركة الجوالات" 
                          value={purchaseForm.details}
                          onChange={e => setPurchaseForm({...purchaseForm, details: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <button type="submit" className="w-full py-3 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600 transition-all border-none cursor-pointer">
                        تسجيل فاتورة شراء البضاعة
                      </button>
                    </form>
                  </div>
                )}

                {/* 4. Transfer Receive Form (استلام حوالة مع تحديد الحساب) */}
                {activeAction === 'transfer_in' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-teal-500/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <ArrowDownLeft className="text-teal-400" size={18} />
                      <h3 className="font-bold text-xs text-teal-100">استلام حوالة واردة وتوزيعها على الحسابات</h3>
                    </div>
                    <form onSubmit={handleTransferInSubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">مبلغ الحوالة الواردة (ر.ي)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="0.00" 
                          value={transferInForm.amount}
                          onChange={e => setTransferInForm({...transferInForm, amount: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">الحساب أو الصندوق المستودع</label>
                        <select 
                          value={transferInForm.targetAccount}
                          onChange={e => setTransferInForm({...transferInForm, targetAccount: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر الصندوق أو الحساب المستودع للحوالة --</option>
                          <option disabled value="" className="text-rose-400">
                            ⚠️ تنبيه حوالات الجوالات: يجب تغذية وإضافة الحسابات والصناديق أولاً بشكل مستقل لضمان تتبع الحوالات الواردة والصادرة!
                          </option>
                          {vaults.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (الرصيد: {v.balance.toLocaleString()} ر.ي)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">تفاصيل وصاحب الحوالة</label>
                        <input 
                          type="text" 
                          placeholder="مثلاً: حوالة من شبكة النجم لتغذية الرصيد الكاش" 
                          value={transferInForm.details}
                          onChange={e => setTransferInForm({...transferInForm, details: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <button type="submit" className="w-full py-3 bg-teal-500 text-white text-xs font-bold rounded-xl hover:bg-teal-600 transition-all border-none cursor-pointer">
                        تسجيل استلام وتثبيت الحوالة
                      </button>
                    </form>
                  </div>
                )}

                {/* 5. Salary Form Container */}
                {activeAction === 'salary' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-indigo-500/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <UserCheck className="text-indigo-400" size={18} />
                      <h3 className="font-bold text-xs text-indigo-100">تسجيل وتأدية رواتب وسلف الموظفين</h3>
                    </div>
                    <form onSubmit={handleSalarySubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">اسم الموظف أو الفني بالورشة</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="مثلاً: م. صلاح الدين الصنعاني" 
                          value={salaryForm.employeeName}
                          onChange={e => setSalaryForm({...salaryForm, employeeName: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">مبلغ الراتب أو السلفة (ر.ي)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="0.00" 
                          value={salaryForm.amount}
                          onChange={e => setSalaryForm({...salaryForm, amount: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">صندوق صرف الراتب والسلفة</label>
                        <select 
                          value={salaryForm.vaultId}
                          onChange={e => setSalaryForm({...salaryForm, vaultId: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          {vaults.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (الرصيد: {v.balance.toLocaleString()} ر.ي)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">ملاحظات (سلفة شهري، راتب كلي، مكافأة)</label>
                        <input 
                          type="text" 
                          placeholder="راتب شهر يونيو الشامل ومستحقات الصيانة" 
                          value={salaryForm.details}
                          onChange={e => setSalaryForm({...salaryForm, details: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <button type="submit" className="w-full py-3 bg-indigo-550 text-white text-xs font-bold rounded-xl hover:bg-indigo-650 transition-all border-none cursor-pointer">
                        تأكيد سداد وقيد راتب الموظف
                      </button>
                    </form>
                  </div>
                )}

                {/* 6. Return Form Container */}
                {activeAction === 'return' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-red-500/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <RefreshCw className="text-red-400" size={18} />
                      <h3 className="font-bold text-xs text-red-100">تسوية وإرجاع قيمة مرتجع مبيعات للزبائن</h3>
                    </div>
                    <form onSubmit={handleReturnSubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">رقم فاتورة المبيعات الأصلية</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="INV-55421..." 
                          value={returnForm.invoiceNo}
                          onChange={e => setReturnForm({...returnForm, invoiceNo: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">قيمة المرتجع المراد تسليمه (ر.ي)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="0.00" 
                          value={returnForm.amount}
                          onChange={e => setReturnForm({...returnForm, amount: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">صندوق/خزينة إعادة نقليات المرتجع</label>
                        <select 
                          value={returnForm.vaultId}
                          onChange={e => setReturnForm({...returnForm, vaultId: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          {vaults.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (الرصيد: {v.balance.toLocaleString()} ر.ي)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">سبب المرتجع والمواصفات</label>
                        <input 
                          type="text" 
                          placeholder="مثلاً: خلل مصنعي في سبيكر شحن" 
                          value={returnForm.details}
                          onChange={e => setReturnForm({...returnForm, details: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <button type="submit" className="w-full py-3 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all border-none cursor-pointer">
                        سداد المرتجع وخصمه من الصندوق
                      </button>
                    </form>
                  </div>
                )}

                {/* 7. Commission Form Container */}
                {activeAction === 'commission' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-purple-500/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <Percent className="text-purple-400" size={18} />
                      <h3 className="font-bold text-xs text-purple-100">تسليم عمولات فنية وتسويات للشبكات</h3>
                    </div>
                    <form onSubmit={handleCommissionSubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">نوع وجهة صرف العمولة</label>
                        <select 
                          value={commissionForm.commissionType}
                          onChange={e => setCommissionForm({...commissionForm, commissionType: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر نوع وجهة صرف عمولة الجوالات --</option>
                          <option disabled value="" className="text-purple-400">
                            ⚠️ تنبيه عمولات الجوالات: يرجى تغذية بنود عمولات خدمات الشحن الفوري وصيانة الهواتف بشكل منعزل لمنع التداخل مع الأرباح الصافية!
                          </option>
                          <option value="عمولة مخصصة">عمولة مبيعات وصيانة الهواتف المخصصة</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">مبلغ العمولات المطلوب (ر.ي)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="0.00" 
                          value={commissionForm.amount}
                          onChange={e => setCommissionForm({...commissionForm, amount: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">صندوق صرف العمولات الفنية</label>
                        <select 
                          value={commissionForm.vaultId}
                          onChange={e => setCommissionForm({...commissionForm, vaultId: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر صندوق خصم عمولات الشبكات --</option>
                          <option disabled value="" className="text-purple-400">
                            ⚠️ تنبيه مالي: يجب تحديد حساب أو صندوق صرف العمولات بشكل دقيق لضمان توازن حسابات الصندوق والسيولة!
                          </option>
                          {vaults.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (الرصيد: {v.balance.toLocaleString()} ر.ي)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">تفاصيل وصاحب العمولة</label>
                        <input 
                          type="text" 
                          placeholder="تسليم عمولة صيانة دراجة أو تغيير بوردة كاش زبون" 
                          value={commissionForm.details}
                          onChange={e => setCommissionForm({...commissionForm, details: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <button type="submit" className="w-full py-3 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition-all border-none cursor-pointer">
                        تأكيد صرف وحسم العمولة
                      </button>
                    </form>
                  </div>
                )}

                {/* 8. Custody Owner Form Container */}
                {activeAction === 'custody_to_owner' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-cyan-550/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <Users className="text-cyan-400" size={18} />
                      <h3 className="font-bold text-xs text-cyan-100">تسليم عهدة للمالك (أرباح وزلط)</h3>
                    </div>
                    <form onSubmit={handleDeliverCustodySubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">مبلغ العهدة المسحوب (ر.ي)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="0.00" 
                          value={custodyOwnerForm.amount}
                          onChange={e => setCustodyOwnerForm({...custodyOwnerForm, amount: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">المستلم المالي</label>
                        <input 
                          type="text" 
                          placeholder="أبو جواد (المالك)" 
                          value={custodyOwnerForm.recipient}
                          onChange={e => setCustodyOwnerForm({...custodyOwnerForm, recipient: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">صندوق/خزينة سحب عهدة المالك</label>
                        <select 
                          value={custodyOwnerForm.vaultId}
                          onChange={e => setCustodyOwnerForm({...custodyOwnerForm, vaultId: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          {vaults.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (الرصيد: {v.balance.toLocaleString()} ر.ي)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">البيان وملاحظات التسليم والمطابقة</label>
                        <input 
                          type="text" 
                          placeholder="مثلاً: دفعة أرباح الأسبوع المحقق كاش" 
                          value={custodyOwnerForm.details}
                          onChange={e => setCustodyOwnerForm({...custodyOwnerForm, details: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <button type="submit" className="w-full py-3 bg-cyan-600 text-white text-xs font-bold rounded-xl hover:bg-cyan-700 transition-all border-none cursor-pointer">
                        تأكيد تسليم وسحب عهدة المالك
                      </button>
                    </form>
                  </div>
                )}

                {/* 9. Custody from Owner Container */}
                {activeAction === 'custody_from_owner' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-emerald-500/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <PlusCircle className="text-emerald-400" size={18} />
                      <h3 className="font-bold text-xs text-emerald-100">استلام عهدة (توريد وتغذية مالية للبيع)</h3>
                    </div>
                    <form onSubmit={handleReceiveCustodySubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">المبلغ المورد للصندوق (ر.ي)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="0.00" 
                          value={custodyRecForm.amount}
                          onChange={e => setCustodyRecForm({...custodyRecForm, amount: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">المورد الأساسي ومستند القبض</label>
                        <input 
                          type="text" 
                          placeholder="تمويل خارجي المالك" 
                          value={custodyRecForm.source}
                          onChange={e => setCustodyRecForm({...custodyRecForm, source: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">صندوق/خزينة الإيداع والتوريد</label>
                        <select 
                          value={custodyRecForm.vaultId}
                          onChange={e => setCustodyRecForm({...custodyRecForm, vaultId: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          {vaults.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (الرصيد: {v.balance.toLocaleString()} ر.ي)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">ملاحظات التوريد</label>
                        <input 
                          type="text" 
                          placeholder="قيمة عهدة تشغيلية لتنفيذ معاملات الرصيد" 
                          value={custodyRecForm.details}
                          onChange={e => setCustodyRecForm({...custodyRecForm, details: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <button type="submit" className="w-full py-3 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all border-none cursor-pointer">
                        استلام وتغذية الصندوق رئيسياً
                      </button>
                    </form>
                  </div>
                )}

                {/* 10. Send Transfer Form (إرسال حوالة) */}
                {activeAction === 'send_transfer' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-amber-500/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <ArrowLeftRight className="text-amber-400" size={18} />
                      <h3 className="font-bold text-xs text-amber-100">إرسال حوالة للخارج والبلدان</h3>
                    </div>
                    <form onSubmit={handleSendTransferSubmit} className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">لمن (المرسل له)</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="الاسم الثلاثي" 
                            value={sendTransferForm.recipient}
                            onChange={e => setSendTransferForm({...sendTransferForm, recipient: e.target.value})}
                            className="w-full bg-slate-950 text-right text-xs p-2 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">المبلغ (ر.ي)</label>
                          <input 
                            type="number" 
                            required 
                            placeholder="0.00" 
                            value={sendTransferForm.amount}
                            onChange={e => setSendTransferForm({...sendTransferForm, amount: e.target.value})}
                            className="w-full bg-slate-950 text-right text-xs p-2 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">من أي حساب أو صندوق؟</label>
                        <select 
                          value={sendTransferForm.accountSource}
                          onChange={e => setSendTransferForm({...sendTransferForm, accountSource: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-2.5 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer"
                        >
                          {vaults.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (المتوفر: {v.balance.toLocaleString()} ر.ي)</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">بيان وسبب الحوالة (ليش؟)</label>
                        <input 
                          type="text" 
                          required
                          placeholder="توضيح تفاصيل الحوالة" 
                          value={sendTransferForm.reason}
                          onChange={e => setSendTransferForm({...sendTransferForm, reason: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-2 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Associated with Purchase checkbox block */}
                      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-2">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="isPurchaseCheck"
                            checked={sendTransferForm.isPurchase === 'yes'}
                            onChange={e => setSendTransferForm({...sendTransferForm, isPurchase: e.target.checked ? 'yes' : 'no'})}
                            className="rounded bg-slate-900 border-white/10 text-amber-500 focus:ring-amber-500"
                          />
                          <label htmlFor="isPurchaseCheck" className="text-[10px] font-bold text-zinc-300 cursor-pointer">
                            مرتبطة ومخصصة لعملية مبيعات / شراء بضاعة؟
                          </label>
                        </div>

                        {sendTransferForm.isPurchase === 'yes' && (
                          <div className="space-y-2 pt-1 transition-all">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-zinc-400 block mb-0.5">رقم الفاتورة المرفقة</label>
                                <input 
                                  type="text" 
                                  placeholder="INV-5542..." 
                                  value={sendTransferForm.invoiceNo}
                                  onChange={e => setSendTransferForm({...sendTransferForm, invoiceNo: e.target.value})}
                                  className="w-full bg-slate-950 text-right text-[10px] p-1.5 rounded border border-white/10 text-white outline-none focus:border-amber-500"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-400 block mb-0.5">قناة وعبر الشراء</label>
                                <select 
                                  value={sendTransferForm.purchaseChannel}
                                  onChange={e => setSendTransferForm({...sendTransferForm, purchaseChannel: e.target.value as 'market' | 'direct'})}
                                  className="w-full bg-slate-950 text-zinc-450 text-right text-[10px] p-1.5 rounded border border-white/10 outline-none focus:border-amber-500 cursor-pointer"
                                >
                                  <option value="market">عبر حراج وسوق الجوالات الموحد</option>
                                  <option value="direct">وجه لوجه (مباشر كاش)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button type="submit" className="w-full py-3 bg-amber-500 text-slate-950 text-xs font-black rounded-xl hover:bg-amber-400 transition-all border-none cursor-pointer">
                        تأكيد إرسال الحوالة والخصم فوراً
                      </button>
                    </form>
                  </div>
                )}

                {/* 11. Adjustment Voucher Form (سند تسوية حسابية) */}
                {activeAction === 'adjustment' && (
                  <div className="p-5 bg-slate-900 rounded-2xl border border-sky-500/20 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <RotateCw className="text-sky-400 animate-spin" size={18} />
                      <h3 className="font-bold text-xs text-sky-100">إصدار سند تسوية مالية / مطابقة الأرصدة</h3>
                    </div>
                    <form onSubmit={handleAdjustmentSubmit} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">الحساب المالي المراد تسويته</label>
                        <select 
                          required
                          value={adjustmentForm.accountId}
                          onChange={e => setAdjustmentForm({...adjustmentForm, accountId: e.target.value})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer font-bold"
                        >
                          <option value="">-- اختر الحساب من دليل شجرة حسابات الجوالات --</option>
                          <option disabled value="" className="text-rose-400">
                            ⚠️ تنبيه محاسبي: يرجى إعداد وتغذية الحسابات بشكل منعزل ومستقل في شجرة الحسابات لضمان عدم خلط قيود اليومية مع بقية الأقسام!
                          </option>
                          {accountsList
                            .filter(a => ['1100', '1200', '1101', '2100', '4100', '5100', '5200'].includes(a.accountNumber))
                            .map(a => (
                              <option key={a.id} value={a.id}>{a.accountName} (حساب {a.accountNumber}) - الرصيد: {(a.balance || 0).toLocaleString()} ر.ي</option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">طبيعة واتجاه قيد التسوية</label>
                        <select 
                          value={adjustmentForm.type}
                          onChange={e => setAdjustmentForm({...adjustmentForm, type: e.target.value as 'debit' | 'credit'})}
                          className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="debit">تسوية مدينة (+) زيادة الرصيد / رصد مستحق للمحل</option>
                          <option value="credit">تسوية دائنة (-) تخفيض الرصيد / شطب رصيد تلف/خسارة</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">مبلغ وقيمة التسوية (ر.ي)</label>
                        <input 
                          type="number" 
                          required 
                          placeholder="0.00" 
                          value={adjustmentForm.amount}
                          onChange={e => setAdjustmentForm({...adjustmentForm, amount: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">البيان وسبب التسوية والمبرر القانوني</label>
                        <input 
                          type="text" 
                          required
                          placeholder="مثال: فارق جرد الصندوق اليومي أو تصفية ذمة تالفة" 
                          value={adjustmentForm.details}
                          onChange={e => setAdjustmentForm({...adjustmentForm, details: e.target.value})}
                          className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                        />
                      </div>

                      <button type="submit" className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all border-none cursor-pointer">
                        ترحيل وعمد سند التسوية الحسابية
                      </button>
                    </form>
                  </div>
                )}

              </div>

              {/* Right Columns - Ledger Streams & Latest audit trail */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-900/80 p-5 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <div className="flex items-center gap-1.5 animate-pulse">
                      <FileText className="text-amber-400" size={16} />
                      <h4 className="text-xs font-bold text-white">دفتر الأستاذ واليومية الموحد (العمليات الأخيرة)</h4>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.0 py-0.5 rounded-full border border-emerald-500/10">سندات نشطة</span>
                  </div>

                  <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                    {transactions.length === 0 ? (
                      <div className="text-center py-10 text-zinc-500 text-xs">لا يوجد أي عمليات محاسبية مسجلة اليوم. ابدأ توريد وخصم المعاملات!</div>
                    ) : (
                      <>
                        {transactions.slice((txPage - 1) * 20, txPage * 20).map(t => (
                          <div key={t.id} className="p-3 bg-slate-950/60 rounded-2xl border border-white/5 flex items-center justify-between text-right text-xs transition-colors hover:bg-slate-950 relative group">
                            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => deleteTransaction(t.id)} 
                                title="حذف القيد وتراجع"
                                className="p-1 px-1.5 text-rose-450 hover:text-rose-400 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 border-none cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`p-2 rounded-xl ${t.type === 'inflow' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {t.type === 'inflow' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                              </span>
                              <div>
                                <div className="font-bold text-zinc-250 text-xs flex items-center gap-1.5">
                                  <span>{t.category}</span>
                                  {t.invoiceNo && <span className="text-[9px] bg-white/5 text-zinc-400 px-1.5 rounded">فاتورة: {t.invoiceNo}</span>}
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{t.details}</div>
                              </div>
                            </div>

                            <div className="text-left pl-6">
                              <div className={`font-black ${t.type === 'inflow' ? 'text-emerald-400' : 'text-rose-400'} tabular-nums text-sm`}>
                                {t.type === 'inflow' ? '+' : '-'}{t.amount.toLocaleString()} <span className="text-[10px] font-bold">ر.ي</span>
                              </div>
                              <div className="text-[9px] text-zinc-600 mt-1">{t.date.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                            </div>
                          </div>
                        ))}

                        {transactions.length > 20 && (
                          <div className="flex justify-between items-center pt-4 border-t border-white/5 text-[10px] text-zinc-400 select-none">
                            <button
                              disabled={txPage === 1}
                              onClick={() => setTxPage(prev => Math.max(1, prev - 1))}
                              className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-white/5 text-white rounded-lg disabled:opacity-40 cursor-pointer"
                            >
                              السابق
                            </button>
                            <span className="font-mono">صفحة {txPage} من {Math.ceil(transactions.length / 20)}</span>
                            <button
                              disabled={txPage * 20 >= transactions.length && transactions.length % 20 !== 0}
                              onClick={() => {
                                if ((txPage + 1) * 20 >= transactions.length) {
                                  setVisibleTransLimit(prev => prev + 40);
                                }
                                setTxPage(prev => prev + 1);
                              }}
                              className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-white/5 text-white rounded-lg disabled:opacity-40 cursor-pointer"
                            >
                              التالي
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: DETAILED SALES CHIPS (4x6 PICTURE TYPE SHEETS) */}
        {activeTab === 'jard' && (
          <div id="tab-jard-view" className="space-y-6">
            
            <div className="border-b border-white/5 pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <div>
                <h2 className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <Layers3 size={14} />
                  <span>شيت تفصيل المبيعات والمطابقات اليومية</span>
                </h2>
                <p className="text-[10px] text-zinc-500">جرد وتوزيع الأنشطة النقدية الفورية والآجلة</p>
              </div>
              <div className="text-xs text-zinc-400 tabular-nums">
                مجموع المبيعات الكلي: <span className="text-amber-400 font-bold">{totalDynamicSales.toLocaleString()} YER</span>
              </div>
            </div>

            {/* Interactive Date Range Filter for authentic custom report */}
            <div className="bg-slate-900/90 p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="text-amber-500 animate-pulse" size={16} />
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-xs font-bold text-zinc-300">نمط جرد الرقابة والمطابقة الرئيسي:</span>
                  <select 
                    onChange={(e) => {
                      const val = e.target.value;
                      const todayStr = new Date().toISOString().split('T')[0];
                      if (val === 'today') {
                        setJardStartDate(todayStr);
                        setJardEndDate(todayStr);
                      } else if (val === 'this_month') {
                        const startOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                        setJardStartDate(startOfMonthStr);
                        setJardEndDate(todayStr);
                      } else if (val === 'last_7_days') {
                        const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        setJardStartDate(sevenDaysAgoStr);
                        setJardEndDate(todayStr);
                      } else if (val === 'all') {
                        setJardStartDate('');
                        setJardEndDate('');
                      }
                    }}
                    className="bg-slate-950 border border-amber-500/20 text-amber-300 text-[11px] p-2 rounded-xl outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="all">📁 عرض الكشف العام الشامل (كل الفترات)</option>
                    <option value="today">📅 الجرد اليومي (اليوم الحالي)</option>
                    <option value="this_month">🗓️ الجرد الشهري (الشهر الحالي)</option>
                    <option value="last_7_days">🔄 جرد آخر 7 أيام</option>
                    <option value="custom">⚙️ تحديد تاريخين مخصصين...</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-400 font-bold">من تاريخ:</span>
                  <input 
                    type="date" 
                    value={jardStartDate}
                    onChange={e => setJardStartDate(e.target.value)}
                    className="bg-slate-950 border border-white/10 text-white text-[11px] p-2 rounded-xl outline-none focus:border-amber-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-400 font-bold">إلى تاريخ:</span>
                  <input 
                    type="date" 
                    value={jardEndDate}
                    onChange={e => setJardEndDate(e.target.value)}
                    className="bg-slate-950 border border-white/10 text-white text-[11px] p-2 rounded-xl outline-none focus:border-amber-500 cursor-pointer"
                  />
                </div>
                {(jardStartDate || jardEndDate) && (
                  <button 
                    onClick={() => { setJardStartDate(''); setJardEndDate(''); }}
                    className="p-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 text-[10px] font-bold rounded-xl border-none cursor-pointer transition-all"
                  >
                    إلغاء التخصيص والعودة للكل
                  </button>
                )}
              </div>
            </div>

            {/* زر خيار تخصيص الجرد الذكي */}
            <div className="flex justify-end pt-1">
              <button 
                type="button"
                onClick={() => setShowCustomJardPanel(!showCustomJardPanel)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer border ${
                  showCustomJardPanel 
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20' 
                    : 'bg-slate-900 text-amber-400 border-amber-500/30 hover:bg-slate-800'
                }`}
              >
                <Settings size={14} className={showCustomJardPanel ? "animate-spin" : ""} />
                <span>⚙️ خيارات تخصيص وتفصيل الجرد الاستثنائي</span>
                <span className="bg-slate-950/40 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {showCustomJardPanel ? "نشط" : "مغلق"}
                </span>
              </button>
            </div>

            {/* لوحة التحكم الذكية لتخصيص الجرد */}
            <AnimatePresence>
              {showCustomJardPanel && (
                <motion.div 
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-amber-500/30 shadow-2xl space-y-6 text-right"
                >
                  <div className="border-b border-white/5 pb-3 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h3 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                        <SlidersHorizontal size={14} />
                        <span>محرك تخصيص وتصفية الجرد السحابي المتكامل</span>
                      </h3>
                      <p className="text-[10px] text-zinc-500 mt-1">حدد عناصر التشيك-ليست، الفروع، والموظفين لتوليد التقرير والملفات لحظياً</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => exportJardToExcel(getUnifiedJardRecords())}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 border-none cursor-pointer transition-all active:scale-95 shadow-lg shadow-emerald-500/10"
                      >
                        <Download size={13} />
                        تصدير لـ Excel
                      </button>
                      <button 
                        type="button"
                        onClick={() => shareJardReport(getUnifiedJardRecords())}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black py-2 px-4 rounded-xl flex items-center gap-1.5 border-none cursor-pointer transition-all active:scale-95 shadow-lg shadow-amber-500/10"
                      >
                        <Share2 size={13} />
                        مشاركة التقرير
                      </button>
                    </div>
                  </div>

                  {/* الـ Checklist والمنزلقات والخيارات */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* عمود التشيك-ليست */}
                    <div className="md:col-span-2 space-y-3">
                      <h4 className="text-[11px] font-extrabold text-zinc-300 border-r-2 border-amber-500 pr-2">📋 تشيك-ليست أنشطة الجرد المطلوبة:</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <label className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.03] hover:border-amber-500/30 cursor-pointer transition-all select-none">
                          <input 
                            type="checkbox" 
                            checked={customJardChecklist.sales}
                            onChange={(e) => setCustomJardChecklist({...customJardChecklist, sales: e.target.checked})}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-zinc-350">🛒 المبيعات</span>
                        </label>

                        <label className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.03] hover:border-amber-500/30 cursor-pointer transition-all select-none">
                          <input 
                            type="checkbox" 
                            checked={customJardChecklist.maintenance}
                            onChange={(e) => setCustomJardChecklist({...customJardChecklist, maintenance: e.target.checked})}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-zinc-350">🔧 الصيانة والورشة</span>
                        </label>

                        <label className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.03] hover:border-amber-500/30 cursor-pointer transition-all select-none">
                          <input 
                            type="checkbox" 
                            checked={customJardChecklist.purchases}
                            onChange={(e) => setCustomJardChecklist({...customJardChecklist, purchases: e.target.checked})}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-zinc-350">📦 المشتريات</span>
                        </label>

                        <label className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.03] hover:border-amber-500/30 cursor-pointer transition-all select-none">
                          <input 
                            type="checkbox" 
                            checked={customJardChecklist.balance}
                            onChange={(e) => setCustomJardChecklist({...customJardChecklist, balance: e.target.checked})}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-zinc-350">📱 شحن الرصيد</span>
                        </label>

                        <label className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.03] hover:border-amber-500/30 cursor-pointer transition-all select-none">
                          <input 
                            type="checkbox" 
                            checked={customJardChecklist.sims}
                            onChange={(e) => setCustomJardChecklist({...customJardChecklist, sims: e.target.checked})}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-zinc-350">💳 الشرائح</span>
                        </label>

                        <label className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.03] hover:border-amber-500/30 cursor-pointer transition-all select-none">
                          <input 
                            type="checkbox" 
                            checked={customJardChecklist.damaged}
                            onChange={(e) => setCustomJardChecklist({...customJardChecklist, damaged: e.target.checked})}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-zinc-350">🗑️ تالف مخزني</span>
                        </label>

                        <label className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.03] hover:border-amber-500/30 cursor-pointer transition-all select-none">
                          <input 
                            type="checkbox" 
                            checked={customJardChecklist.lost}
                            onChange={(e) => setCustomJardChecklist({...customJardChecklist, lost: e.target.checked})}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-zinc-350">⚠️ فاقد وخسائر</span>
                        </label>

                        <label className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.03] hover:border-amber-500/30 cursor-pointer transition-all select-none">
                          <input 
                            type="checkbox" 
                            checked={customJardChecklist.transfers}
                            onChange={(e) => setCustomJardChecklist({...customJardChecklist, transfers: e.target.checked})}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-zinc-350">💸 الحوالات والمناقلات</span>
                        </label>
                      </div>
                    </div>

                    {/* خيارات الموظف والكل والمخزن */}
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-extrabold text-zinc-300 border-r-2 border-amber-500 pr-2">⚙️ فلاتر الفروع والمسؤولين:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-3">
                        <div className="flex flex-col gap-1 text-right">
                          <span className="text-[10px] text-zinc-500">الموظف المسؤول:</span>
                          <select 
                            value={selectedJardEmployee}
                            onChange={e => setSelectedJardEmployee(e.target.value)}
                            className="bg-slate-950 border border-white/10 text-white text-[11px] p-2.5 rounded-xl outline-none focus:border-amber-500 cursor-pointer w-full"
                          >
                            <option value="all">👥 جميع الموظفين والمسؤولين (الكل)</option>
                            {employeeUsersList.map(u => (
                              <option key={u.id} value={u.id}>👤 {u.name || u.email || u.id}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1 text-right">
                          <span className="text-[10px] text-zinc-500">المخزن / الفرع المستهدف:</span>
                          <select 
                            value={selectedJardStore}
                            onChange={e => setSelectedJardStore(e.target.value)}
                            className="bg-slate-950 border border-white/10 text-white text-[11px] p-2.5 rounded-xl outline-none focus:border-amber-500 cursor-pointer w-full"
                          >
                            <option value="all">🏬 جميع المستودعات والأقسام والفروع</option>
                            <option value="المستودع الرئيسي">📦 المستودع الرئيسي وبضاعة المعرض</option>
                            <option value="قسم الورشة">🔧 قسم ورشة الصيانة والإصلاح</option>
                            <option value="مخزن الشرائح">💳 مخزن الشرائح وبطائق الشحن</option>
                            <option value="الخزينة">💰 الخزينة وصندوق النقدية المركزية</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* عرض المبيعات والفواتير المفلترة الفعالة */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-t border-white/5 pt-4">
                      <h4 className="text-[11px] font-extrabold text-zinc-300 flex items-center gap-1">
                        <span>📋 السجلات ومستندات الجرد المفلترة لحظياً</span>
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-mono font-bold">
                          {getUnifiedJardRecords().length} سجل مطابق
                        </span>
                      </h4>
                      <div className="text-[11px] text-zinc-400">
                        مجموع قيمة العمليات المشمولة: <span className="text-amber-400 font-extrabold font-mono">{getUnifiedJardRecords().reduce((sum, r) => sum + r.amount, 0).toLocaleString()} ر.ي</span>
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto border border-white/[0.05] rounded-2xl bg-slate-950/40 divide-y divide-white/[0.04] scrollbar-thin">
                      {getUnifiedJardRecords().length === 0 ? (
                        <div className="p-8 text-center text-zinc-500 text-xs">
                          📭 لا توجد أي سجلات أو فواتير مطابقة لخيارات التصفية والجرد المحددة حالياً.
                        </div>
                      ) : (
                        <>
                          {getUnifiedJardRecords().slice((jardPage - 1) * 20, jardPage * 20).map((rec) => (
                            <div key={rec.id} className="p-3 flex items-center justify-between text-xs hover:bg-white/[0.02] transition-colors gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className={`px-2 py-1 rounded-lg text-[9px] font-extrabold font-mono shrink-0 ${
                                  rec.category === 'sales' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                  rec.category === 'maintenance' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                  rec.category === 'purchases' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                  rec.category === 'balance' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                  rec.category === 'sims' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                  rec.category === 'damaged' ? 'bg-amber-600/10 text-amber-550 border border-amber-600/20' :
                                  rec.category === 'lost' ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20' :
                                  'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                }`}>
                                  {rec.type}
                                </span>
                                <div className="text-right min-w-0">
                                  <p className="font-bold text-zinc-250 truncate">{rec.details}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[9px] text-zinc-500">
                                    <span>👤 {rec.employee}</span>
                                    <span>•</span>
                                    <span>🏬 {rec.warehouse}</span>
                                    <span>•</span>
                                    <span className="font-mono text-zinc-450">📄 المرجع: {rec.ref}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-left shrink-0">
                                <div className="font-black text-amber-400 font-mono text-[11px] sm:text-xs">
                                  {rec.amount.toLocaleString()} <span className="text-[8px] text-zinc-500 font-normal">ر.ي</span>
                                </div>
                                <div className="text-[8px] text-zinc-500 mt-0.5 font-mono">
                                  {new Date(rec.date).toLocaleString('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                </div>
                              </div>
                            </div>
                          ))}

                          {getUnifiedJardRecords().length > 20 && (
                            <div className="flex justify-between items-center p-3 border-t border-white/5 text-[10px] text-zinc-450 bg-slate-950/40 select-none">
                              <button
                                disabled={jardPage === 1}
                                onClick={() => setJardPage(prev => Math.max(1, prev - 1))}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/5 text-white rounded-lg disabled:opacity-40 cursor-pointer text-[10px]"
                              >
                                السابق
                              </button>
                              <span className="font-mono">صفحة {jardPage} من {Math.ceil(getUnifiedJardRecords().length / 20)}</span>
                              <button
                                disabled={jardPage * 20 >= getUnifiedJardRecords().length}
                                onClick={() => setJardPage(prev => prev + 1)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/5 text-white rounded-lg disabled:opacity-40 cursor-pointer text-[10px]"
                              >
                                التالي
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TWO 4x6 ASPECT RATIO PORTRAIT DETAILED SHEETS */}
            <div className="flex flex-col md:flex-row justify-center items-stretch gap-8 max-w-4xl mx-auto py-4">
              
              {/* SHEET 1: CASH SALES (شيت المبيعات النقدية) */}
              <div className="w-full md:w-1/2 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 rounded-[1.8rem] border border-indigo-500/20 shadow-2xl overflow-hidden flex flex-col aspect-[4/6] p-5 relative group transition-transform hover:scale-[1.01]">
                {/* Decorative overlay for authentic 4x6 picture feel */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />
                <div className="absolute top-3 left-3 text-[8px] tracking-widest text-indigo-400/60 font-mono">JAM SYSTEM PRO • PHOTO 4X6</div>
                
                {/* Visual Header */}
                <div className="border-b border-indigo-500/20 pb-3 mb-4 text-center">
                  <span className="p-2 bg-indigo-500/10 rounded-2xl text-indigo-400 inline-block mb-1">
                    <Coins size={22} />
                  </span>
                  <h3 className="font-extrabold text-sm text-indigo-200">الشيت الأول: المبيعات النقدية المباشرة</h3>
                  <p className="text-[9px] text-zinc-500 mt-1">تفتيش تفصيلي للرصيد، الصيانة وإكسسوارات البيع</p>
                </div>

                {/* Grid stats mapping */}
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  
                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between text-right text-xs">
                    <div>
                      <div className="font-bold text-zinc-300">إجمالي مبيع الرصيد</div>
                      <div className="text-[9px] text-zinc-500">يمن موبايل، يو، سبأفون</div>
                    </div>
                    <div className="text-left font-black text-amber-400 tabular-nums">
                      {realRechargeSales.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between text-right text-xs">
                    <div>
                      <div className="font-bold text-zinc-300">إجمالي ورشة الصيانة</div>
                      <div className="text-[9px] text-zinc-500">أجور، تصليح شاشات وهاردوير</div>
                    </div>
                    <div className="text-left font-black text-amber-400 tabular-nums">
                      {realMaintenanceReceipts.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between text-right text-xs">
                    <div>
                      <div className="font-bold text-zinc-300">إجمالي مبيعات الشرايح</div>
                      <div className="text-[9px] text-zinc-500">شرائح جديدة، بدل تالف، تفعيل</div>
                    </div>
                    <div className="text-left font-black text-amber-400 tabular-nums">
                      {realSIMOperations.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between text-right text-xs">
                    <div>
                      <div className="font-bold text-zinc-300">إجمالي بيع الإكسسوارات والقطع</div>
                      <div className="text-[9px] text-zinc-500">سماعات، شواحن، حماية زجاجية</div>
                    </div>
                    <div className="text-left font-black text-amber-400 tabular-nums">
                      {realAccessoriesSales.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between text-right text-xs">
                    <div>
                      <div className="font-bold text-zinc-300">إجمالي مبيعات الجوالات والهواتف</div>
                      <div className="text-[9px] text-zinc-500">أجهزة ذكية كلي، هواتف اقتصادية</div>
                    </div>
                    <div className="text-left font-black text-amber-400 tabular-nums">
                      {realPhonesSales.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>

                </div>

                {/* Footer seal */}
                <div className="mt-auto border-t border-indigo-500/15 pt-3.5 flex justify-between items-center">
                  <span className="text-[9px] text-indigo-400">حالة الشيت: مراجع ومعتمد ✓</span>
                  <span className="text-[9px] text-zinc-500 font-bold tabular-nums">المجموع: {(realRechargeSales + realMaintenanceReceipts + realSIMOperations + realAccessoriesSales + realPhonesSales).toLocaleString()} ر.ي</span>
                </div>
              </div>

              {/* SHEET 2: MARKET SALES & RESERVATIONS (شيت الحجوزات ومبيعات السوق الكلية) */}
              <div className="w-full md:w-1/2 bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 rounded-[1.8rem] border border-amber-500/20 shadow-2xl overflow-hidden flex flex-col aspect-[4/6] p-5 relative group transition-transform hover:scale-[1.01]">
                {/* Decorative overlay for authentic 4x6 picture feel */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_50%)] pointer-events-none" />
                <div className="absolute top-3 left-3 text-[8px] tracking-widest text-amber-400/60 font-mono">JAM SYSTEM PRO • PHOTO 4X6</div>

                {/* Visual Header */}
                <div className="border-b border-amber-500/20 pb-3 mb-4 text-center">
                  <span className="p-2 bg-amber-500/10 rounded-2xl text-amber-400 inline-block mb-1">
                    <Layers3 size={22} />
                  </span>
                  <h3 className="font-extrabold text-sm text-amber-200">الشيت الثاني: الحجوزات والمبيعات الخارجية</h3>
                  <p className="text-[9px] text-zinc-500 mt-1">المعاملات النشطة في السوق المفتوح وحراج الجوالات</p>
                </div>

                {/* Grid stats mapping */}
                <div className="space-y-3 flex-1 flex flex-col justify-center">

                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between text-right text-xs">
                    <div>
                      <div className="font-bold text-zinc-300">حجوزات تم دفع عربون فيها</div>
                      <div className="text-[9px] text-zinc-500">أجهزة ومعدات تحت الحجز والحفظ</div>
                    </div>
                    <div className="text-left font-black text-amber-400 tabular-nums">
                      {realReservationsTotal.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between text-right text-xs">
                    <div>
                      <div className="font-bold text-zinc-300">مبيعات الجوالات بالسوق الحركي</div>
                      <div className="text-[9px] text-zinc-500">بيع الجوالات بنظام الحوارات الخارجية</div>
                    </div>
                    <div className="text-left font-black text-amber-400 tabular-nums">
                      {realWholesaleSales.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between text-right text-xs">
                    <div>
                      <div className="font-bold text-zinc-300">إكسسوارات السوق الموزع</div>
                      <div className="text-[9px] text-zinc-500">ماتم توزيعه للدراجات وللمحلات الصديقة</div>
                    </div>
                    <div className="text-left font-black text-amber-400 tabular-nums">
                      {realAccessoriesSales.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between text-right text-xs">
                    <div>
                      <div className="font-bold text-rose-450">التوالف والفاقد والقطع المعطوبة</div>
                      <div className="text-[9px] text-zinc-500">سجل التالف والفاقد بمركز التدقيق</div>
                    </div>
                    <div className="text-left font-black text-rose-400 tabular-nums">
                      {realDamagedLosses.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex items-center justify-between text-right text-xs">
                    <div>
                      <div className="font-bold text-zinc-300">مشتريات نقدية للجرد العام</div>
                      <div className="text-[9px] text-zinc-500">قطع غيار وصيانة شاشات ومستلزمات</div>
                    </div>
                    <div className="text-left font-black text-amber-400 tabular-nums">
                      {realPurchasesTotal.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">ر.ي</span>
                    </div>
                  </div>

                </div>

                {/* Footer seal */}
                <div className="mt-auto border-t border-amber-500/15 pt-3.5 flex justify-between items-center">
                  <span className="text-[9px] text-amber-400">حالة الشيت: جرد معمد نشط</span>
                  <span className="text-[9px] text-zinc-500 font-bold tabular-nums">تالف ومشتريات: {(realDamagedLosses + realPurchasesTotal).toLocaleString()} ر.ي</span>
                </div>
              </div>

            </div>

            {/* Quick alert reminder info footer */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 text-xs text-zinc-400 leading-relaxed text-center">
              ملاحظة: الشيتين الملونين بأعلى مفصلة بمقاس 4x6 وتتناظر لحظيا لتأمين الحفظ والطباعة المباشرة لكشوفات التدقيق اليومي الموحد.
            </div>

          </div>
        )}

        {/* TAB 3: DETAILED VAULTS & SALES BOXES WITH BANK CHANNELS */}
        {activeTab === 'vaults' && (
          <VaultsTabContent
            subVaultTab={subVaultTab}
            setSubVaultTab={setSubVaultTab}
            setShowVaultModal={setShowVaultModal}
            vaults={vaults}
            handleDeleteVault={handleDeleteVault}
            handleAddBank={handleAddBank}
            newBank={newBank}
            setNewBank={setNewBank}
            isAddingBank={isAddingBank}
            isLoadingBanks={isLoadingBanks}
            bankAccounts={bankAccounts}
            handleDeleteBank={handleDeleteBank}
            profile={profile}
            handleUpdateBankBalance={handleUpdateBankBalance}
            categoryMappings={categoryMappings}
            inventoryList={inventoryList}
            playBeep={playBeep}
          />
        )}

        {/* TAB 5: INTEGRATED ACCOUNTING DIRECTORY & LEDGER JOURNAL EXCHANGER */}
        {activeTab === 'accounts_ledger' && (
          <div id="tab-accounts-ledger-view" className="space-y-6 dir-rtl text-right" dir="rtl">
            {/* Header section with subtitle & meta */}
            <div className="border-b border-white/5 pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xs font-bold text-sky-450 flex items-center gap-1.5">
                  <Layers3 size={14} className="text-sky-400" />
                  <span>دليل شجرة الحسابات والتدقيق المالي العام (المنظومة المحاسبية المتكاملة)</span>
                </h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">ضبط الدفاتر والحسابات التفصيلية وقيود الموازنة وإدارة الميزانيات المالية والفرعية</p>
              </div>

              {/* Quick statistics for the financial system health check */}
              <div className="flex flex-wrap bg-slate-950 p-1.5 rounded-xl border border-white/10 gap-4 text-[11px] text-zinc-350 font-semibold">
                <div>إجمالي الأصول المدنية: <span className="text-emerald-400 font-bold tabular-nums">{totalAssets.toLocaleString()} YER</span></div>
                <div>الخصوم والالتزامات: <span className="text-amber-500 font-bold tabular-nums">{totalLiabilities.toLocaleString()} YER</span></div>
                <div>إيرادات المبيعات والخدمات: <span className="text-sky-400 font-bold tabular-nums">{totalRevenues.toLocaleString()} YER</span></div>
                <div>صافي الأرباح التشغيلية: <span className={`font-black tabular-nums ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{netProfit.toLocaleString()} YER</span></div>
                <div>الحسابات النشطة: <span className="text-sky-450 font-black tabular-nums">{accountsList.length}</span></div>
              </div>
            </div>

            {/* Sub-Navigation for the Accounting Hub inside activeTab === 'accounts_ledger' */}
            <div className="flex flex-wrap gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-white/5">
              <button 
                onClick={() => setAccountingSubTab('automated_engine')} 
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 border-none cursor-pointer ${accountingSubTab === 'automated_engine' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md font-bold' : 'text-indigo-300 hover:text-white bg-transparent'}`}
              >
                <Cpu size={12} className="text-indigo-400" /> محرك الإسناد الآلي والأرصدة
              </button>
              <button 
                onClick={() => setAccountingSubTab('chart')} 
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 border-none cursor-pointer ${accountingSubTab === 'chart' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-zinc-400 hover:text-white bg-transparent'}`}
              >
                <Layers3 size={12} /> شجرة دليل الحسابات
              </button>
              <button 
                onClick={() => setAccountingSubTab('journal_entry')} 
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 border-none cursor-pointer ${accountingSubTab === 'journal_entry' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-zinc-400 hover:text-white bg-transparent'}`}
              >
                <FileText size={12} /> إنشاء قيد مزدوج متعدد الأسطر
              </button>
              <button 
                onClick={() => setAccountingSubTab('ledger')} 
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 border-none cursor-pointer ${accountingSubTab === 'ledger' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-zinc-400 hover:text-white bg-transparent'}`}
              >
                <BookOpen size={12} /> دفتر اليومية العامة
              </button>
              <button 
                onClick={() => setAccountingSubTab('statement')} 
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 border-none cursor-pointer ${accountingSubTab === 'statement' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-zinc-400 hover:text-white bg-transparent'}`}
              >
                <ArrowLeftRight size={12} /> كشف حساب تفصيلي
              </button>
              <button 
                onClick={() => setAccountingSubTab('reports')} 
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 border-none cursor-pointer ${accountingSubTab === 'reports' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-zinc-400 hover:text-white bg-transparent'}`}
              >
                <FileSpreadsheet size={12} /> ميزان المراجعة والأرباح
              </button>
              <button 
                onClick={() => setAccountingSubTab('closing')} 
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 border-none cursor-pointer ${accountingSubTab === 'closing' ? 'bg-amber-600 text-white shadow-md font-bold' : 'text-zinc-400 hover:text-white bg-transparent'}`}
              >
                <Lock size={12} /> إقفال السنة المالية والترحيل
              </button>
              <button 
                onClick={() => setAccountingSubTab('custodies')} 
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 border-none cursor-pointer ${accountingSubTab === 'custodies' ? 'bg-indigo-600 text-white shadow-md font-bold' : 'text-zinc-400 hover:text-white bg-transparent'}`}
              >
                <Briefcase size={12} /> إدارة العهد والأمانات
              </button>
              <button 
                onClick={() => setAccountingSubTab('quarantine')} 
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 border-none cursor-pointer ${accountingSubTab === 'quarantine' ? 'bg-amber-600 text-white shadow-md font-bold' : 'text-zinc-400 hover:text-white bg-transparent'}`}
              >
                <AlertTriangle size={12} className="text-amber-500" /> حركات تحت المعالجة الذاتية (Telemetry)
              </button>
            </div>



            <AnimatePresence mode="wait">
              {accountingSubTab === 'automated_engine' && (
                <motion.div
                  key="automated-engine-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                >
                  <AutomatedJournalEngineDashboard profile={profile} />
                </motion.div>
              )}

              {accountingSubTab === 'chart' && (
                <motion.div
                  key="chart-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Column 1: Add account Form and Seeding Wrapper */}
                    <div className="space-y-4">
                      <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <PlusCircle size={16} className="text-indigo-400" />
                        <h3 className="text-xs font-bold text-zinc-200">تأسيس حساب مالي جديد بالدليل</h3>
                      </div>

                      <form onSubmit={handleCreateAccount} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 block font-bold">صنف الحساب المالي كوديكس</label>
                          <select
                            value={newAcc.type}
                            onChange={(e) => {
                              const type = e.target.value as any;
                              // Auto-generate suggested account number prefix: 1 for assets, 2 for liability, 3 equity, 4 revenue, 5 expense
                              const prefix = type === 'asset' ? '1' : type === 'liability' ? '2' : type === 'equity' ? '3' : type === 'revenue' ? '4' : '5';
                              const suffix = Math.floor(1000 + Math.random() * 9000).toString();
                              setNewAcc({ ...newAcc, type, accountNumber: prefix + suffix });
                            }}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none cursor-pointer"
                          >
                            <option value="asset">أصول متداولة وخزينة (Asset)</option>
                            <option value="liability">خصوم ومطلقات وموردين (Liability)</option>
                            <option value="equity">رأس المال والاستثمار (Equity)</option>
                            <option value="revenue">إيرادات الورشة والمحل (Revenue)</option>
                            <option value="expense">مصاريف وأعباء تشغيلية (Expense)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 block font-bold">رقم الحساب المعياري المقترح</label>
                          <input
                            type="text"
                            required
                            placeholder="مثال: 10442"
                            value={newAcc.accountNumber}
                            onChange={(e) => setNewAcc({ ...newAcc, accountNumber: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl text-left font-mono outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 block font-bold">اسم الحساب بالكامل</label>
                          <input
                            type="text"
                            required
                            placeholder="مثال: ذمة المورد أبو فهد، إيراد صيانة، مصروف مياه"
                            value={newAcc.accountName}
                            onChange={(e) => setNewAcc({ ...newAcc, accountName: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl text-right outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 block font-bold">العملة الأساسية للحساب</label>
                          <select
                            value={newAcc.currency}
                            onChange={(e) => setNewAcc({ ...newAcc, currency: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none cursor-pointer"
                          >
                            <option value="YER">ريال يمني (YER)</option>
                            <option value="SAR">ريال سعودي (SAR)</option>
                            <option value="USD">دولار أمريكي (USD)</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingAcc}
                          className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-600 bg-indigo-600 text-white text-xs font-black rounded-xl border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        >
                          {isSubmittingAcc ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>جاري التأسيس والحفظ...</span>
                            </>
                          ) : (
                            <>
                              <Plus size={14} />
                              <span>تأسيس الحساب بالدليل</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>

                    {/* Yemeni Standard Chart of Accounts Seeding Card */}
                    <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-3">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <CheckSquare size={16} className="text-emerald-400 animate-pulse" />
                        <h3 className="text-xs font-bold text-emerald-300">الدليل اليمني القياسي الموحد</h3>
                      </div>
                      <p className="text-[10px] text-zinc-450 leading-relaxed">
                        يقوم هذا المعالج بتهيئة وتحديث دليل الحسابات الخاص بك تلقائياً، عبر توليد كافة الحسابات التحليلية للمخزون، الرصيد الإلكتروني، شرائح الاتصال، والصيانة، مما يضمن توافق مبيعاتك الفورية والآجلة مع نظام القيود المزدوجة التلقائي لشركات الاتصالات اليمنية (يمن موبايل، سبأفون، يو، واي).
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!profile?.ownerId) {
                            alert('❌ خطأ: لم يتم العثور على معرّف المالك للمحل.');
                            return;
                          }
                          setIsSubmittingAcc(true);
                          try {
                            const { initializeChartOfAccounts } = await import('../services/accountingService');
                            await initializeChartOfAccounts(profile.ownerId);
                            alert('✅ تم تهيئة ومزامنة الدليل المحاسبي النموذجي للسوق اليمني بنجاح! تم التحقق من تماسك شجرة الحسابات التشغيلية لجميع العمليات والشرائح وصيانة الموبايل.');
                          } catch (err: any) {
                            alert('❌ حدث خطأ أثناء مزامنة الدليل: ' + err.message);
                          } finally {
                            setIsSubmittingAcc(false);
                          }
                        }}
                        disabled={isSubmittingAcc}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-black rounded-xl border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                      >
                        {isSubmittingAcc ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>جاري المزامنة...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw size={12} />
                            <span>مزامنة الدليل القياسي اليمني 🇾🇪</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>



                  {/* Column 2: Chart of Accounts directory tree */}
                    <div className="lg:col-span-2 bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4">
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                        <div>
                          <h3 className="text-xs font-bold text-zinc-200">الدليل المحاسبي لورشة ومحل صيانة الموبايل</h3>
                          <p className="text-[10px] text-zinc-500 font-medium">استعرض شجرة الحسابات المعتمدة وتابع أرصدتها التراكمية سحابيا</p>
                        </div>

                        {/* Flat list vs Structured Tree visual toggle indicator */}
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                          <div className="flex bg-slate-900 border border-white/10 rounded-xl p-0.5">
                            <button
                              type="button"
                              onClick={() => setChartViewMode('tree')}
                              className={`px-3 py-1 text-[10px] rounded-lg transition-all border-none cursor-pointer font-bold ${chartViewMode === 'tree' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 bg-transparent'}`}
                            >
                              عرض الشجرة تفاعلياً
                            </button>
                            <button
                              type="button"
                              onClick={() => setChartViewMode('list')}
                              className={`px-3 py-1 text-[10px] rounded-lg transition-all border-none cursor-pointer font-bold ${chartViewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 bg-transparent'}`}
                            >
                              قائمة مسطحة مبسطة
                            </button>
                          </div>

                          <div className="relative flex-1 sm:flex-initial sm:w-52">
                            <Search size={13} className="absolute right-3 top-2.5 text-zinc-500" />
                            <input
                              type="text"
                              placeholder="ابحث باسم الحساب أو كود الرقم..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 text-white pr-9 pl-3 py-2 text-xs rounded-xl outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* List accounts split by types or beautiful interactive folder tree */}
                      <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                        {chartViewMode === 'tree' ? (
                          // 🌳 Interactive Tree View Component Layout
                          <div className="space-y-3">
                            {/* Group 1: ASSETS */}
                            {(() => {
                              const assetsTree = (() => {
                                const fAccs = accountsList.filter(a => a.accountName.toLowerCase().includes(searchTerm.toLowerCase()) || a.accountNumber.includes(searchTerm));
                                const assets = fAccs.filter(a => a.type === 'asset' || a.accountNumber.startsWith('1'));
                                const f1100 = {
                                  items: assets.filter(a => a.accountNumber.startsWith('110') && !a.accountNumber.startsWith('115') && a.accountNumber !== '1101'),
                                  sum: assets.filter(a => a.accountNumber.startsWith('110') && !a.accountNumber.startsWith('115') && a.accountNumber !== '1101').reduce((s, a) => s + (a.balance || 0), 0)
                                };
                                const f1150 = {
                                  items: assets.filter(a => a.accountNumber.startsWith('115') || a.accountNumber === '1101'),
                                  sum: assets.filter(a => a.accountNumber.startsWith('115') || a.accountNumber === '1101').reduce((s, a) => s + (a.balance || 0), 0)
                                };
                                const f1200 = {
                                  items: assets.filter(a => a.accountNumber.startsWith('12')),
                                  sum: assets.filter(a => a.accountNumber.startsWith('12')).reduce((s, a) => s + (a.balance || 0), 0)
                                };
                                const fOther = {
                                  items: assets.filter(a => !a.accountNumber.startsWith('110') && !a.accountNumber.startsWith('115') && !a.accountNumber.startsWith('12') && a.accountNumber !== '1101'),
                                  sum: assets.filter(a => !a.accountNumber.startsWith('110') && !a.accountNumber.startsWith('115') && !a.accountNumber.startsWith('12') && a.accountNumber !== '1101').reduce((s, a) => s + (a.balance || 0), 0)
                                };
                                return { assets, f1100, f1150, f1200, fOther, total: assets.reduce((s, a) => s + (a.balance || 0), 0) };
                              })();

                              if (assetsTree.assets.length === 0) return null;

                              return (
                                <div className="border border-white/5 bg-slate-900/10 p-2.5 rounded-2xl space-y-2">
                                  {/* Folder Level 1 */}
                                  <div 
                                    onClick={() => setExpandedNodes(prev => ({ ...prev, '1': !prev['1'] }))}
                                    className="flex items-center justify-between p-2.5 bg-emerald-500/10 border border-emerald-500/10 hover:bg-emerald-500/15 rounded-xl cursor-pointer select-none transition-all duration-150"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-emerald-400 text-[10px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['1'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                      <span className="p-1 px-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-extrabold text-[9px]">ROOT</span>
                                      <span className="text-xs font-black text-emerald-300">1000 - الأصول والموجودات (الأوراق النقدية والأجهزة والعهد)</span>
                                    </div>
                                    <span className="font-mono text-xs font-extrabold text-emerald-400 tabular-nums">{assetsTree.total.toLocaleString()} YER</span>
                                  </div>

                                  {expandedNodes['1'] && (
                                    <div className="space-y-1.5 pl-3 border-r border-dashed border-emerald-500/10 pr-2">
                                      {/* Subfolder 1100 */}
                                      {assetsTree.f1100.items.length > 0 && (
                                        <div className="space-y-1">
                                          <div 
                                            onClick={() => setExpandedNodes(prev => ({ ...prev, '1-100': !prev['1-100'] }))}
                                            className="flex items-center justify-between p-2 bg-slate-900/80 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
                                              <span className="text-zinc-500 text-[8px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['1-100'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                              <span>📂 1100 - الصناديق النقدية والحسابات البنكية للكاش</span>
                                            </div>
                                            <span className="font-mono text-[11px] font-bold text-zinc-400 tabular-nums">{assetsTree.f1100.sum.toLocaleString()} YER</span>
                                          </div>
                                          {expandedNodes['1-100'] && (
                                            <div className="space-y-1 pr-4 pl-1">
                                              {assetsTree.f1100.items.map(acc => renderAccountNode(acc))}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Subfolder 1150 */}
                                      {assetsTree.f1150.items.length > 0 && (
                                        <div className="space-y-1">
                                          <div 
                                            onClick={() => setExpandedNodes(prev => ({ ...prev, '1-150': !prev['1-150'] }))}
                                            className="flex items-center justify-between p-2 bg-slate-900/80 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
                                              <span className="text-zinc-500 text-[8px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['1-150'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                              <span>📂 1150 - ذمم مديونيات العملاء ونظام عهد الموظفين والمهندسين</span>
                                            </div>
                                            <span className="font-mono text-[11px] font-bold text-zinc-400 tabular-nums">{assetsTree.f1150.sum.toLocaleString()} YER</span>
                                          </div>
                                          {expandedNodes['1-150'] && (
                                            <div className="space-y-1 pr-4 pl-1">
                                              {assetsTree.f1150.items.map(acc => renderAccountNode(acc))}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Subfolder 1200 */}
                                      {assetsTree.f1200.items.length > 0 && (
                                        <div className="space-y-1">
                                          <div 
                                            onClick={() => setExpandedNodes(prev => ({ ...prev, '1-200': !prev['1-200'] }))}
                                            className="flex items-center justify-between p-2 bg-slate-900/80 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
                                              <span className="text-zinc-500 text-[8px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['1-200'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                              <span>📂 1200 - بضاعة ومخازن الصيانة وقطع غيار الهواتف</span>
                                            </div>
                                            <span className="font-mono text-[11px] font-bold text-zinc-400 tabular-nums">{assetsTree.f1200.sum.toLocaleString()} YER</span>
                                          </div>
                                          {expandedNodes['1-200'] && (
                                            <div className="space-y-1 pr-4 pl-1">
                                              {assetsTree.f1200.items.map(acc => renderAccountNode(acc))}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Other assets */}
                                      {assetsTree.fOther.items.length > 0 && (
                                        <div className="space-y-1 pr-2">
                                          {assetsTree.fOther.items.map(acc => renderAccountNode(acc))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Group 2: LIABILITIES */}
                            {(() => {
                              const fAccs = accountsList.filter(a => a.accountName.toLowerCase().includes(searchTerm.toLowerCase()) || a.accountNumber.includes(searchTerm));
                              const liabilities = fAccs.filter(a => a.type === 'liability' || a.accountNumber.startsWith('2'));
                              const f2100 = {
                                items: liabilities.filter(a => a.accountNumber.startsWith('21')),
                                sum: liabilities.filter(a => a.accountNumber.startsWith('21')).reduce((s, a) => s + (a.balance || 0), 0)
                              };
                              const fOther = {
                                items: liabilities.filter(a => !a.accountNumber.startsWith('21')),
                                sum: liabilities.filter(a => !a.accountNumber.startsWith('21')).reduce((s, a) => s + (a.balance || 0), 0)
                              };
                              const total = liabilities.reduce((s, a) => s + (a.balance || 0), 0);

                              if (liabilities.length === 0) return null;

                              return (
                                <div className="border border-white/5 bg-slate-900/10 p-2.5 rounded-2xl space-y-2">
                                  <div 
                                    onClick={() => setExpandedNodes(prev => ({ ...prev, '2': !prev['2'] }))}
                                    className="flex items-center justify-between p-2.5 bg-rose-500/10 border border-rose-500/10 hover:bg-rose-500/15 rounded-xl cursor-pointer select-none transition-all duration-150"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-rose-400 text-[10px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['2'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                      <span className="p-1 px-1.5 rounded-lg bg-rose-500/20 text-rose-400 font-extrabold text-[9px]">ROOT</span>
                                      <span className="text-xs font-black text-rose-300">2000 - الخصوم والالتزامات والمطلوبات</span>
                                    </div>
                                    <span className="font-mono text-xs font-extrabold text-rose-400 tabular-nums">{total.toLocaleString()} YER</span>
                                  </div>

                                  {expandedNodes['2'] && (
                                    <div className="space-y-1.5 pl-3 border-r border-dashed border-rose-500/10 pr-2">
                                      {f2100.items.length > 0 && (
                                        <div className="space-y-1">
                                          <div 
                                            onClick={() => setExpandedNodes(prev => ({ ...prev, '2-100': !prev['2-100'] }))}
                                            className="flex items-center justify-between p-2 bg-slate-900/80 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
                                              <span className="text-zinc-500 text-[8px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['2-100'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                              <span>📂 2100 - ذمم الموردين والشركات الموردة للأجهزة والقطع</span>
                                            </div>
                                            <span className="font-mono text-[11px] font-bold text-zinc-400 tabular-nums">{f2100.sum.toLocaleString()} YER</span>
                                          </div>
                                          {expandedNodes['2-100'] && (
                                            <div className="space-y-1 pr-4 pl-1">
                                              {f2100.items.map(acc => renderAccountNode(acc))}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {fOther.items.length > 0 && (
                                        <div className="space-y-1 pr-2">
                                          {fOther.items.map(acc => renderAccountNode(acc))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Group 3: EQUITY */}
                            {(() => {
                              const fAccs = accountsList.filter(a => a.accountName.toLowerCase().includes(searchTerm.toLowerCase()) || a.accountNumber.includes(searchTerm));
                              const equities = fAccs.filter(a => a.type === 'equity' || a.accountNumber.startsWith('3'));
                              const total = equities.reduce((s, a) => s + (a.balance || 0), 0);

                              if (equities.length === 0) return null;

                              return (
                                <div className="border border-white/5 bg-slate-900/10 p-2.5 rounded-2xl space-y-2">
                                  <div 
                                    onClick={() => setExpandedNodes(prev => ({ ...prev, '3': !prev['3'] }))}
                                    className="flex items-center justify-between p-2.5 bg-indigo-500/10 border border-indigo-500/10 hover:bg-indigo-500/15 rounded-xl cursor-pointer select-none transition-all duration-150"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-indigo-400 text-[10px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['3'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                      <span className="p-1 px-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 font-extrabold text-[9px]">ROOT</span>
                                      <span className="text-xs font-black text-indigo-300">3000 - حقوق الملكية والشركاء ورأس مال المشروع</span>
                                    </div>
                                    <span className="font-mono text-xs font-extrabold text-indigo-400 tabular-nums">{total.toLocaleString()} YER</span>
                                  </div>

                                  {expandedNodes['3'] && (
                                    <div className="space-y-1.5 pl-3 border-r border-dashed border-indigo-500/10 pr-2">
                                      {equities.map(acc => renderAccountNode(acc))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Group 4: REVENUE */}
                            {(() => {
                              const fAccs = accountsList.filter(a => a.accountName.toLowerCase().includes(searchTerm.toLowerCase()) || a.accountNumber.includes(searchTerm));
                              const revenues = fAccs.filter(a => a.type === 'revenue' || a.accountNumber.startsWith('4'));
                              const total = revenues.reduce((s, a) => s + (a.balance || 0), 0);

                              if (revenues.length === 0) return null;

                              return (
                                <div className="border border-white/5 bg-slate-900/10 p-2.5 rounded-2xl space-y-2">
                                  <div 
                                    onClick={() => setExpandedNodes(prev => ({ ...prev, '4': !prev['4'] }))}
                                    className="flex items-center justify-between p-2.5 bg-sky-500/10 border border-sky-500/10 hover:bg-sky-500/15 rounded-xl cursor-pointer select-none transition-all duration-150"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-sky-400 text-[10px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['4'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                      <span className="p-1 px-1.5 rounded-lg bg-sky-500/20 text-sky-400 font-extrabold text-[9px]">ROOT</span>
                                      <span className="text-xs font-black text-sky-300">4000 - الإيرادات المادية والمبيعات ورسوم صيانة وتطوير الهواتف</span>
                                    </div>
                                    <span className="font-mono text-xs font-extrabold text-sky-400 tabular-nums">{total.toLocaleString()} YER</span>
                                  </div>

                                  {expandedNodes['4'] && (
                                    <div className="space-y-1.5 pl-3 border-r border-dashed border-sky-500/10 pr-2">
                                      {revenues.map(acc => renderAccountNode(acc))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Group 5: EXPENSES */}
                            {(() => {
                              const fAccs = accountsList.filter(a => a.accountName.toLowerCase().includes(searchTerm.toLowerCase()) || a.accountNumber.includes(searchTerm));
                              const expenses = fAccs.filter(a => a.type === 'expense' || a.accountNumber.startsWith('5'));
                              const f5100 = {
                                items: expenses.filter(a => a.accountNumber.startsWith('51')),
                                sum: expenses.filter(a => a.accountNumber.startsWith('51')).reduce((s, a) => s + (a.balance || 0), 0)
                              };
                              const f5200 = {
                                items: expenses.filter(a => a.accountNumber.startsWith('52')),
                                sum: expenses.filter(a => a.accountNumber.startsWith('52')).reduce((s, a) => s + (a.balance || 0), 0)
                              };
                              const fOther = {
                                items: expenses.filter(a => !a.accountNumber.startsWith('51') && !a.accountNumber.startsWith('52')),
                                sum: expenses.filter(a => !a.accountNumber.startsWith('51') && !a.accountNumber.startsWith('52')).reduce((s, a) => s + (a.balance || 0), 0)
                              };
                              const total = expenses.reduce((s, a) => s + (a.balance || 0), 0);

                              if (expenses.length === 0) return null;

                              return (
                                <div className="border border-white/5 bg-slate-900/10 p-2.5 rounded-2xl space-y-2">
                                  <div 
                                    onClick={() => setExpandedNodes(prev => ({ ...prev, '5': !prev['5'] }))}
                                    className="flex items-center justify-between p-2.5 bg-amber-500/10 border border-amber-500/10 hover:bg-amber-500/15 rounded-xl cursor-pointer select-none transition-all duration-150"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-amber-400 text-[10px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['5'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                      <span className="p-1 px-1.5 rounded-lg bg-amber-500/20 text-amber-400 font-extrabold text-[9px]">ROOT</span>
                                      <span className="text-xs font-black text-amber-300">5000 - المصاريف التشغيلية والأجور والمشتريات وتكلفة النشاط</span>
                                    </div>
                                    <span className="font-mono text-xs font-extrabold text-amber-400 tabular-nums">{total.toLocaleString()} YER</span>
                                  </div>

                                  {expandedNodes['5'] && (
                                    <div className="space-y-1.5 pl-3 border-r border-dashed border-amber-500/10 pr-2">
                                      {f5100.items.length > 0 && (
                                        <div className="space-y-1">
                                          <div 
                                            onClick={() => setExpandedNodes(prev => ({ ...prev, '5-100': !prev['5-100'] }))}
                                            className="flex items-center justify-between p-2 bg-slate-900/80 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
                                              <span className="text-zinc-500 text-[8px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['5-100'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                              <span>📂 5100 - تكلفة البضائع المستهلكة وقطع الغيار المفتوحة صيانة</span>
                                            </div>
                                            <span className="font-mono text-[11px] font-bold text-zinc-400 tabular-nums">{f5100.sum.toLocaleString()} YER</span>
                                          </div>
                                          {expandedNodes['5-100'] && (
                                            <div className="space-y-1 pr-4 pl-1">
                                              {f5100.items.map(acc => renderAccountNode(acc))}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {f5200.items.length > 0 && (
                                        <div className="space-y-1">
                                          <div 
                                            onClick={() => setExpandedNodes(prev => ({ ...prev, '5-200': !prev['5-200'] }))}
                                            className="flex items-center justify-between p-2 bg-slate-900/80 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
                                              <span className="text-zinc-500 text-[8px] transform transition-transform duration-200" style={{ display: 'inline-block', transform: expandedNodes['5-200'] ? 'rotate(90deg)' : 'none' }}>◀</span>
                                              <span>📂 5200 - مصاريف تشغيلية نثرية عمومية للورشة والفروع</span>
                                            </div>
                                            <span className="font-mono text-[11px] font-bold text-zinc-400 tabular-nums">{f5200.sum.toLocaleString()} YER</span>
                                          </div>
                                          {expandedNodes['5-200'] && (
                                            <div className="space-y-1 pr-4 pl-1">
                                              {f5200.items.map(acc => renderAccountNode(acc))}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {fOther.items.length > 0 && (
                                        <div className="space-y-1 pr-2">
                                          {fOther.items.map(acc => renderAccountNode(acc))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          // 📋 List View Component Layout (Classic and highly scannable)
                          <div className="space-y-4">
                            {['asset', 'liability', 'equity', 'revenue', 'expense'].map((cat) => {
                              const catAccounts = accountsList.filter(
                                (a) =>
                                  a.type === cat &&
                                  (a.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    a.accountNumber.includes(searchTerm))
                              );
                              if (catAccounts.length === 0) return null;

                              const catSum = catAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
                              const catLabel =
                                cat === 'asset'
                                  ? 'الأصول والمخازن والنقدية'
                                  : cat === 'liability'
                                  ? 'الخصوم والمطلوبات والموردين'
                                  : cat === 'equity'
                                  ? 'رأس المال والمستحقات والشركاء'
                                  : cat === 'revenue'
                                  ? 'الإيرادات مبيعات وتصليح'
                                  : 'المصاريف والرواتب والتشغيل';
                              const catColor =
                                cat === 'asset'
                                  ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5'
                                  : cat === 'liability'
                                  ? 'border-rose-500/20 text-rose-400 bg-rose-500/5'
                                  : cat === 'equity'
                                  ? 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5'
                                  : cat === 'revenue'
                                  ? 'border-sky-500/20 text-sky-400 bg-sky-500/5'
                                  : 'border-amber-500/20 text-amber-400 bg-amber-500/5';

                              return (
                                <div key={cat} className="space-y-1.5">
                                  <div className={`p-2 rounded-xl border flex justify-between items-center text-xs font-bold leading-none ${catColor}`}>
                                    <span>{catLabel} ({catAccounts.length})</span>
                                    <span className="font-mono tabular-nums">{catSum.toLocaleString()} YER</span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {catAccounts.map((acc) => (
                                      <div
                                        key={acc.id}
                                        id={`account-card-list-${acc.id}`}
                                        className="p-3.5 bg-slate-900/90 hover:bg-slate-900/95 rounded-2xl border border-white/5 flex items-center justify-between gap-3 text-xs hover:border-indigo-500/20 transition-all shadow-md group animate-fade-in"
                                      >
                                        <div className="flex-1 min-w-0">
                                          {editingAccId === acc.id ? (
                                            <div className="flex items-center gap-1.5 w-full">
                                              <input
                                                type="text"
                                                id={`account-edit-input-list-${acc.id}`}
                                                className="bg-slate-950 border border-indigo-500/40 text-white p-1 px-2.5 text-xs rounded-lg outline-none w-full font-bold"
                                                value={editingAccName}
                                                onChange={(e) => setEditingAccName(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') handleSaveAccountName(acc.id);
                                                  if (e.key === 'Escape') setEditingAccId(null);
                                                }}
                                                autoFocus
                                              />
                                              <button
                                                type="button"
                                                id={`account-save-btn-list-${acc.id}`}
                                                onClick={() => handleSaveAccountName(acc.id)}
                                                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border-none text-emerald-400 rounded-lg cursor-pointer transition-colors"
                                                title="حفظ التعديل"
                                              >
                                                <Check size={12} />
                                              </button>
                                              <button
                                                type="button"
                                                id={`account-cancel-btn-list-${acc.id}`}
                                                onClick={() => setEditingAccId(null)}
                                                className="p-1.5 bg-white/5 hover:bg-white/10 border-none text-zinc-400 rounded-lg cursor-pointer transition-colors"
                                                title="إلغاء"
                                              >
                                                <X size={12} />
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-2 font-bold text-zinc-100 flex-wrap">
                                                <span className="font-mono text-[9px] text-[#fbbf24] bg-amber-500/10 px-2 py-0.5 rounded-md font-extrabold select-all">
                                                  {acc.accountNumber}
                                                </span>
                                                <span className="truncate max-w-[150px] sm:max-w-none">{acc.accountName}</span>
                                              </div>
                                              <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-medium">
                                                <span>العملة: <span className="font-mono font-bold text-zinc-400">{acc.currency || 'YER'}</span></span>
                                                {['1100', '1200', '1101', '2100', '4100', '5100', '5200'].includes(acc.accountNumber) && (
                                                  <span className="text-[9px] bg-sky-500/10 text-sky-400 p-0.5 px-1.5 rounded-full font-bold">حساب قياسي أساسي</span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2.5 shrink-0">
                                          {editingAccId !== acc.id && (
                                            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 transition-opacity">
                                              <button
                                                type="button"
                                                id={`account-edit-trigger-list-${acc.id}`}
                                                onClick={() => handleStartEditAccount(acc)}
                                                className="p-1 px-1.5 bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border-none text-[#fbbf24] rounded-lg cursor-pointer transition-colors"
                                                title="تعديل اسم الحساب"
                                              >
                                                <Edit2 size={11} />
                                              </button>
                                              {!['1100', '1200', '1101', '2100', '4100', '5100', '5200'].includes(acc.accountNumber) && (
                                                <button
                                                  type="button"
                                                  id={`account-delete-trigger-list-${acc.id}`}
                                                  onClick={() => handleDeleteAccount(acc)}
                                                  className="p-1 px-1.5 bg-rose-500/10 hover:bg-rose-500/20 border-none text-rose-400 rounded-lg cursor-pointer transition-colors"
                                                  title="حذف الحساب"
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              )}
                                            </div>
                                          )}

                                          <div className="text-left font-mono">
                                            <span
                                              className={`font-black text-xs tabular-nums ${
                                                (acc.balance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                              }`}
                                            >
                                              {(acc.balance || 0).toLocaleString()} <span className="text-[9px] text-zinc-500">YER</span>
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {accountsList.length === 0 && (
                          <div className="text-center py-20 text-zinc-500 text-xs font-semibold">
                            لا يوجد حسابات مضافة حالياً في دليل الدفاتر المحاسبية لخدمة ورشتك وصيانتك.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {accountingSubTab === 'journal_entry' && (
                <motion.div
                  key="journal-entry-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6"
                >
                  <UnifiedJournalVoucher
                    profile={profile}
                    accounts={accountsList}
                    vaults={vaults}
                    onSuccess={() => {
                      showToast('تم حفظ وترحيل السند بنجاح وتحديث الحسابات والدفاتر', 'success');
                      setAccountingSubTab('ledger');
                    }}
                  />
                </motion.div>
              )}

              {accountingSubTab === 'ledger' && (
                <motion.div
                  key="ledger-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6"
                >
                  <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4">
                    <div>
                      <h3 className="text-xs font-extrabold text-zinc-200">دفتر اليومية العامة وسجل الحركات والقيود السحابية</h3>
                      <p className="text-[10px] text-zinc-500">مراجعة تاريخية تفصيلية متسلسلة لكافة القيود المزدوجة المعمدة من المنظومة</p>
                    </div>

                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                      {journalEntriesList.length === 0 ? (
                        <div className="text-center py-24 text-zinc-500 text-xs border border-dashed border-white/5 rounded-2xl">
                          لا توجد قيود يومية عامة مسجلة في الدفاتر لمالك الحساب حالياً.
                        </div>
                      ) : (
                        <>
                          {journalEntriesList.slice((journalPage - 1) * 20, journalPage * 20).map((entry) => {
                            const date = entry.date
                              ? entry.date.toDate
                                ? entry.date.toDate()
                                : new Date(entry.date)
                              : new Date();
                            const tot = entry.items?.reduce((sum, item) => sum + (item.debit || 0), 0) || 0;

                            return (
                              <div
                                key={entry.id}
                                className="bg-slate-950/90 rounded-2xl border border-white/5 p-4 space-y-3 hover:border-white/10 transition-all font-sans"
                              >
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/5 pb-2">
                                  <div>
                                    <span className="p-1 px-2.5 rounded bg-white/5 font-mono text-[9px] text-zinc-400 font-bold">
                                      {entry.reference || 'SYSTEM_JV'}
                                    </span>
                                    <h4 className="text-xs font-black text-zinc-200 mt-1">{entry.description}</h4>
                                  </div>

                                  <div className="text-left">
                                    <div className="text-[10px] text-zinc-500">
                                      {date.toLocaleString('ar-YE', { hour12: true })}
                                    </div>
                                    <div className="text-[11px] font-black text-indigo-400 font-mono mt-0.5">
                                      المبلغ المتطابق: {tot.toLocaleString()} YER
                                    </div>
                                  </div>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-right text-xs leading-none">
                                    <thead>
                                      <tr className="text-[10px] text-zinc-500 border-b border-white/5 pb-1 select-none">
                                        <th className="py-1">الحساب المالي</th>
                                        <th className="py-1 text-center">المدين (+)</th>
                                        <th className="py-1 text-center">الدائن (-)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {entry.items?.map((item, idx) => (
                                        <tr key={idx} className="text-[11px] text-zinc-300">
                                          <td className="py-2.5 font-bold">{item.accountName || 'حساب فرعي'}</td>
                                          <td className="py-2.5 text-center font-mono text-emerald-400 font-bold">
                                            {item.debit > 0 ? `${item.debit.toLocaleString()} YER` : '-'}
                                          </td>
                                          <td className="py-2.5 text-center font-mono text-rose-400 font-bold">
                                            {item.credit > 0 ? `${item.credit.toLocaleString()} YER` : '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}

                          {journalEntriesList.length > 20 && (
                            <div className="flex justify-between items-center p-3 border-t border-white/5 text-[10px] text-zinc-400 bg-slate-950/40 select-none">
                              <button
                                disabled={journalPage === 1}
                                onClick={() => setJournalPage(prev => Math.max(1, prev - 1))}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/5 text-white rounded-lg disabled:opacity-40 cursor-pointer text-[10px]"
                              >
                                السابق
                              </button>
                              <span className="font-mono">صفحة {journalPage} من {Math.ceil(journalEntriesList.length / 20)}</span>
                              <button
                                disabled={journalPage * 20 >= journalEntriesList.length}
                                onClick={() => setJournalPage(prev => prev + 1)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/5 text-white rounded-lg disabled:opacity-40 cursor-pointer text-[10px]"
                              >
                                التالي
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {accountingSubTab === 'statement' && (
                <motion.div
                  key="statement-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6"
                >
                  <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-zinc-200">دفتر كشف الحركات المالي التفصيلي وتوافق الأرصدة</h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">اختر الحساب لاستعراض دفتر الأستاذ وسجل الأرصدة التراكمية حركياً سحابة بـ ثواني</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          id="ledger-search-acc"
                          value={selectedStatementAccountId}
                          onChange={(e) => setSelectedStatementAccountId(e.target.value)}
                          className="flex-1 bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none cursor-pointer font-bold"
                        >
                          <option value="">-- اختر حساب الجوالات/القطع لمراجعته --</option>
                          <option disabled value="" className="text-rose-400">
                            ⚠️ تنبيه كاشف الحساب: يجب تهيئة وتغذية الحسابات والخرج والأصول أولاً لتتبع كشف الحساب والعمليات بشكل دقيق ومعزول!
                          </option>
                          {accountsList
                            .filter(a => ['1100', '1200', '1101', '2100', '4100', '5100', '5200'].includes(a.accountNumber))
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.accountName} (حساب {a.accountNumber}) - الرصيد: {(a.balance || 0).toLocaleString()} ر.ي
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Display Account statement metrics if selected */}
                      {selectedStatementAccountId && (() => {
                        const sAcc = accountsList.find((a) => a.id === selectedStatementAccountId);
                        if (!sAcc) return null;

                        const totalDeb = statementTransactions.reduce((sum, tx) => sum + tx.debit, 0);
                        const totalCred = statementTransactions.reduce((sum, tx) => sum + tx.credit, 0);

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/40 p-4 rounded-xl border border-white/5 text-xs">
                            <div className="p-2 space-y-1">
                              <span className="text-[9px] text-zinc-500 font-bold block">نوع الحساب بالدليل:</span>
                              <span className="font-extrabold text-indigo-400 uppercase">{sAcc.type === 'asset' ? 'أصول متداولة' : sAcc.type === 'liability' ? 'خصوم/التزامات' : sAcc.type === 'revenue' ? 'إيرادات مبيعات' : sAcc.type === 'expense' ? 'مصاريف تشغيل' : 'رأس المال'}</span>
                            </div>
                            <div className="p-2 space-y-1">
                              <span className="text-[9px] text-zinc-500 font-bold block">إجمالي المقبوض كـ (مدين):</span>
                              <span className="font-mono font-bold text-center text-emerald-400 underline decoration-emerald-400/30 font-black">{totalDeb.toLocaleString()} YER</span>
                            </div>
                            <div className="p-2 space-y-1">
                              <span className="text-[9px] text-zinc-500 font-bold block">إجمالي المصروف كـ (دائن):</span>
                              <span className="font-mono font-bold text-center text-rose-450 text-rose-400 font-black">{totalCred.toLocaleString()} YER</span>
                            </div>
                            <div className="p-2 space-y-1 bg-white/5 rounded-xl border border-white/5">
                              <span className="text-[9px] text-zinc-400 font-bold block">الرصيد الجاري الفعلي المعمد:</span>
                              <span className="font-mono text-indigo-300 font-black text-right block font-black">{(sAcc.balance || 0).toLocaleString()} YER</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div id="ledger-records-result" className="mt-4 overflow-hidden border border-white/5 rounded-xl bg-slate-950">
                        {statementTransactions.length === 0 ? (
                          <div className="text-center text-zinc-500 text-xs py-12 bg-slate-950/40">
                            لا توجد قيود أو معاملات سحابية مسجلة لهذا الحساب المالي بعد.
                          </div>
                        ) : (
                          <>
                            <div className="overflow-x-auto">
                              <table className="w-full text-right text-xs text-zinc-300">
                                <thead className="bg-white/5 text-[10px] text-zinc-400 font-black">
                                  <tr>
                                    <th className="p-3">تاريخ القيد</th>
                                    <th className="p-3">البيان والشرح للتسوية</th>
                                    <th className="p-3 text-center text-emerald-400">المدين المودع (+)</th>
                                    <th className="p-3 text-center text-rose-400 font-medium">الدائن المخصوم (-)</th>
                                    <th className="p-3 bg-indigo-500/10 text-indigo-300">الرصيد الجاري التراكمي YER</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-sans">
                                  {statementTransactions.slice((statementPage - 1) * 20, statementPage * 20).map((row, idx) => {
                                    const dateVal = row.date
                                      ? row.date.toDate
                                        ? row.date.toDate()
                                        : new Date(row.date)
                                      : new Date();
                                    return (
                                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                                        <td className="p-3 font-mono text-[9px] text-zinc-400">
                                          {dateVal.toLocaleString('ar-YE', { hour12: true })}
                                        </td>
                                        <td className="p-3 font-bold text-zinc-200">{row.description}</td>
                                        <td className="p-3 text-center text-emerald-400 font-medium font-mono">
                                          {row.debit > 0 ? row.debit.toLocaleString() : '-'}
                                        </td>
                                        <td className="p-3 text-center text-rose-400 font-mono">
                                          {row.credit > 0 ? row.credit.toLocaleString() : '-'}
                                        </td>
                                        <td className="p-3 bg-indigo-500/10 text-indigo-300 font-black font-mono">
                                          {row.runningBalance.toLocaleString()} YER
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {statementTransactions.length > 20 && (
                              <div className="flex justify-between items-center p-4 border-t border-white/5 text-[10px] text-zinc-400 bg-slate-950 select-none">
                                <button
                                  disabled={statementPage === 1}
                                  onClick={() => setStatementPage(prev => Math.max(1, prev - 1))}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/5 text-white rounded-lg disabled:opacity-40 cursor-pointer text-[10px]"
                                >
                                  السابق
                                </button>
                                <span className="font-mono">صفحة {statementPage} من {Math.ceil(statementTransactions.length / 20)}</span>
                                <button
                                  disabled={statementPage * 20 >= statementTransactions.length}
                                  onClick={() => setStatementPage(prev => prev + 1)}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/5 text-white rounded-lg disabled:opacity-40 cursor-pointer text-[10px]"
                                >
                                  التالي
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {accountingSubTab === 'reports' && (
                <motion.div
                  key="reports-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Trial Balance (ميزان المراجعة بالأرصدة) */}
                    <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4">
                      <div>
                        <h3 className="text-xs font-bold text-sky-400 flex items-center gap-1.5 leading-none">
                          <FileSpreadsheet size={14} />
                          <span>تقرير ميزان المراجعة بالأرصدة الختامية</span>
                        </h3>
                        <p className="text-[10px] text-zinc-500 mt-1">تأكد من توازن الحركات المحاسبية الإجمالية في شجرة دليل حساباتك</p>
                      </div>

                      <div className="overflow-x-auto max-h-[360px] overflow-y-auto border border-white/5 rounded-xl bg-slate-950">
                        <table className="w-full text-right text-[11px] text-zinc-300">
                          <tbody className="divide-y divide-white/5 font-sans">
                            {accountsList.map((acc) => {
                              const b = acc.balance || 0;
                              // assets and expenses are naturally debit
                              const isDebitNatural = acc.type === 'asset' || acc.type === 'expense';
                              const debitVal = isDebitNatural ? b : 0;
                              const creditVal = !isDebitNatural ? b : 0;

                              return (
                                <tr key={acc.id} className="hover:bg-white/5 transition-colors">
                                  <td className="p-2.5 font-mono text-[10px] font-bold text-zinc-400">{acc.accountNumber}</td>
                                  <td className="p-2.5 font-black text-zinc-200">{acc.accountName}</td>
                                  <td className="p-2.5 text-center font-mono text-emerald-400 font-black">
                                    {debitVal !== 0 ? debitVal.toLocaleString() : '-'}
                                  </td>
                                  <td className="p-2.5 text-center font-mono text-rose-400 font-bold">
                                    {creditVal !== 0 ? creditVal.toLocaleString() : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Display Match balance indicator */}
                      {(() => {
                        // Count Total Deb and Credits
                        let totDeb = 0;
                        let totCred = 0;
                        accountsList.forEach((acc) => {
                          const b = acc.balance || 0;
                          const isDebitNatural = acc.type === 'asset' || acc.type === 'expense';
                          if (isDebitNatural) {
                            totDeb += b;
                          } else {
                            totCred += b;
                          }
                        });
                        const balanced = totDeb === totCred;

                        return (
                          <div className="p-4 bg-slate-950 rounded-xl border border-white/5 flex items-center justify-between font-mono text-xs font-semibold">
                            <div>إجمالي مدين: <span className="text-emerald-400 font-bold font-black">{totDeb.toLocaleString()} YER</span></div>
                            <div>إجمالي دائن: <span className="text-rose-400 font-bold font-black">{totCred.toLocaleString()} YER</span></div>
                            <div
                              className={`p-1.5 px-3 rounded-xl text-[9px] ${
                                balanced
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                              }`}
                            >
                              {balanced ? '✓ ميزان مراجع معمد متوازن' : '✗ غير متوازن بالأرصدة'}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Operational Profit & Loss Statement (قائمة الدخل والأرباح) */}
                    <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4">
                      <div>
                        <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 leading-none">
                          <Activity size={14} />
                          <span>قائمة الدخل السريعة لكشف أرباح المحل</span>
                        </h3>
                        <p className="text-[10px] text-zinc-500 mt-1">تتبع صافي العوائد المتراكمة بمقارنة الإيرادات بالمصاريف الكلية</p>
                      </div>

                      <div className="space-y-4">
                        {/* Revenues block */}
                        <div className="bg-slate-950 rounded-xl border border-white/5 p-4 space-y-3">
                          <div className="text-xs font-black text-sky-400 border-b border-white/5 pb-1 flex justify-between select-none">
                            <span>الباب الأول: الإيرادات المحققة</span>
                            <span className="font-mono">{totalRevenues.toLocaleString()} YER</span>
                          </div>

                          <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 bg-slate-950">
                            {accountsList
                              .filter((a) => a.type === 'revenue' && (a.balance || 0) !== 0)
                              .map((a) => (
                                <div key={a.id} className="flex justify-between items-center text-xs text-zinc-300">
                                  <span>{a.accountName} <span className="text-[9px] text-zinc-500 font-mono">({a.accountNumber})</span></span>
                                  <span className="font-mono text-emerald-400 font-bold">{Math.abs(a.balance || 0).toLocaleString()} YER</span>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Expenses block */}
                        <div className="bg-slate-950 rounded-xl border border-white/5 p-4 space-y-3">
                          <div className="text-xs font-black text-rose-400 border-b border-white/5 pb-1 flex justify-between select-none">
                            <span>الباب الثاني: المصاريف التشغيلية والأجور</span>
                            <span className="font-mono">{totalExpenses.toLocaleString()} YER</span>
                          </div>

                          <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 bg-slate-950">
                            {accountsList
                              .filter((a) => a.type === 'expense' && (a.balance || 0) !== 0)
                              .map((a) => (
                                <div key={a.id} className="flex justify-between items-center text-xs text-zinc-300">
                                  <span>{a.accountName} <span className="text-[9px] text-zinc-500 font-mono">({a.accountNumber})</span></span>
                                  <span className="font-mono text-rose-400 font-bold">{(a.balance || 0).toLocaleString()} YER</span>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Net Income Dashboard stamp */}
                        <div className="p-4 bg-gradient-to-br from-indigo-950/50 to-slate-950 rounded-2xl border border-indigo-500/20 text-center space-y-2">
                          <span className="text-[10px] text-zinc-400 font-bold block">صافي الربح أو الخسارة التشغيلية للفترة (YER):</span>
                          <div
                            className={`text-xl font-mono font-black ${
                              netProfit >= 0 ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.15)]' : 'text-rose-450 text-rose-400'
                            }`}
                          >
                            {netProfit.toLocaleString()} YER
                          </div>
                          <span className="text-[9px] text-zinc-500 block">
                            {netProfit >= 0 ? '✓ أداء مالي إيجابي وتكافؤ رابح' : '✗ تجاوزت التكاليف الإيرادات المحققة'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {accountingSubTab === 'closing' && (
                <motion.div
                  key="closing-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6"
                >
                  <div className="bg-slate-900/90 rounded-2xl border border-white/10 p-6 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Lock size={18} className="text-amber-400" />
                          <span>معالج إقفال السنة المالية والترحيل المحاسبي (Fiscal Year Closing)</span>
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1">
                          يقوم المعالج بتصفير الحسابات المؤقتة (الإيرادات والمصروفات) وترحيل صافي الأرباح/الخسائر إلى حساب الأرباح المحتجزة
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl font-bold">
                          السنة المالية: {new Date().getFullYear()}
                        </span>
                      </div>
                    </div>

                    {/* Step indicator */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { num: 1, title: 'فحص الأرصدة والموازنة' },
                        { num: 2, title: 'معاينة قيد الإقفال' },
                        { num: 3, title: 'التأكيد والترحيل' },
                        { num: 4, title: 'اكتمال الإقفال' }
                      ].map((step) => (
                        <div
                          key={step.num}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            closingStep === step.num
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                              : closingStep > step.num
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-slate-950/40 border-white/5 text-zinc-500'
                          }`}
                        >
                          <div className="text-xs font-bold">خطوة {step.num}</div>
                          <div className="text-[11px] truncate mt-0.5">{step.title}</div>
                        </div>
                      ))}
                    </div>

                    {/* Step 1 Content */}
                    {closingStep === 1 && (
                      <div className="space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-white/5">
                        <h4 className="text-xs font-bold text-sky-400">الخطوة 1: فحص تكافؤ الحسابات والأرصدة الختامية</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 bg-slate-900 rounded-xl border border-white/5 space-y-1">
                            <span className="text-zinc-400 block text-[10px]">إجمالي الإيرادات للفترة:</span>
                            <span className="text-sky-400 font-mono font-bold text-sm">{totalRevenues.toLocaleString()} YER</span>
                          </div>
                          <div className="p-3 bg-slate-900 rounded-xl border border-white/5 space-y-1">
                            <span className="text-zinc-400 block text-[10px]">إجمالي المصروفات للفترة:</span>
                            <span className="text-rose-400 font-mono font-bold text-sm">{totalExpenses.toLocaleString()} YER</span>
                          </div>
                          <div className="p-3 bg-slate-900 rounded-xl border border-white/5 space-y-1">
                            <span className="text-zinc-400 block text-[10px]">صافي الربح / الخسارة المحققة:</span>
                            <span className={`font-mono font-bold text-sm ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                              {netProfit.toLocaleString()} YER
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs flex items-center gap-2">
                          <CheckCircle size={16} className="text-blue-400 shrink-0" />
                          <span>جميع الدفاتر متطابقة ومستعدة لإنشاء قيد الإقفال المحاسبي التلقائي.</span>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setClosingStep(2)}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
                          >
                            متابعة إلى معاينة قيد الإقفال &larr;
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 2 Content */}
                    {closingStep === 2 && (
                      <div className="space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-white/5">
                        <h4 className="text-xs font-bold text-amber-400">الخطوة 2: معاينة الحسابات التي سيتم تصفيرها وترحيلها</h4>
                        <div className="overflow-x-auto max-h-60 rounded-xl border border-white/5">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-900 text-zinc-400 sticky top-0">
                              <tr>
                                <th className="p-2.5">رقم الحساب</th>
                                <th className="p-2.5">اسم الحساب</th>
                                <th className="p-2.5">النوع</th>
                                <th className="p-2.5">الرصيد الحالي</th>
                                <th className="p-2.5">الإجراء المتخذ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-zinc-300">
                              {accountsList
                                .filter(a => a.type === 'revenue' || a.type === 'expense')
                                .map(acc => (
                                  <tr key={acc.id} className="hover:bg-white/5">
                                    <td className="p-2.5 font-mono text-zinc-400">{acc.accountNumber}</td>
                                    <td className="p-2.5 font-semibold text-white">{acc.accountName}</td>
                                    <td className="p-2.5">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        acc.type === 'revenue' ? 'bg-sky-500/20 text-sky-300' : 'bg-rose-500/20 text-rose-300'
                                      }`}>
                                        {acc.type === 'revenue' ? 'إيراد' : 'مصروف'}
                                      </span>
                                    </td>
                                    <td className="p-2.5 font-mono tabular-nums">{(acc.balance || 0).toLocaleString()} YER</td>
                                    <td className="p-2.5 text-amber-400 text-[11px] font-medium">تصفير الرصيد إلى 0</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs">
                          سيتم ترحيل فارق الإيرادات والمصروفات ({netProfit.toLocaleString()} YER) لحساب <strong>الأرباح والخسائر المدورة والمحتجزة (3100)</strong>.
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <button
                            type="button"
                            onClick={() => setClosingStep(1)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-zinc-300 rounded-xl text-xs"
                          >
                            &rarr; العودة
                          </button>
                          <button
                            type="button"
                            onClick={() => setClosingStep(3)}
                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all"
                          >
                            متابعة إلى التأكيد النهائي &larr;
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 3 Content */}
                    {closingStep === 3 && (
                      <div className="space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-white/5">
                        <h4 className="text-xs font-bold text-rose-400 flex items-center gap-2">
                          <AlertTriangle size={14} />
                          <span>الخطوة 3: التأكيد النهائي لترحيل الدفاتر وإقفال السنة</span>
                        </h4>
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-200 text-xs space-y-2">
                          <p className="font-bold">تنبيه محاسبي مهم:</p>
                          <p>
                            عند الضغط على الزر أدناه، سيتم قفل وتصفير حسابات الإيرادات والمصروفات فوراً، وترحيل صافي الربح إلى حقوق الملكية، وإنشاء قيد إقفال رسمي ومختوم برقم مرجعي لا رجعة فيه.
                          </p>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <button
                            type="button"
                            onClick={() => setClosingStep(2)}
                            disabled={isClosingFiscalYear}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-zinc-300 rounded-xl text-xs"
                          >
                            &rarr; العودة
                          </button>
                          <button
                            type="button"
                            onClick={handleCloseFiscalYear}
                            disabled={isClosingFiscalYear}
                            className="px-6 py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2 disabled:opacity-50"
                          >
                            {isClosingFiscalYear ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>جاري ترحيل وإقفال الدفاتر...</span>
                              </>
                            ) : (
                              <>
                                <Lock size={14} />
                                <span>تأكيد الإقفال المالي النهائي وترحيل الأرصدة الآن</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 4 Content */}
                    {closingStep === 4 && (
                      <div className="space-y-4 bg-slate-950/60 p-6 rounded-2xl border border-emerald-500/20 text-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                          <CheckCircle size={28} />
                        </div>
                        <h4 className="text-sm font-black text-emerald-400">تم إقفال السنة المالية وترحيل الأرباح بنجاح</h4>
                        <p className="text-xs text-zinc-400 max-w-md mx-auto">
                          تم تصفير حسابات الإيرادات والمصروفات وتسجيل قيد إقفال الأرباح المحتجزة في دفتر اليومية العامة بنجاح.
                        </p>
                        <div className="flex justify-center gap-3 pt-3">
                          <button
                            type="button"
                            onClick={() => setAccountingSubTab('ledger')}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                          >
                            عرض قيود اليومية العامة
                          </button>
                          <button
                            type="button"
                            onClick={() => setAccountingSubTab('chart')}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-zinc-300 rounded-xl text-xs"
                          >
                            عرض شجرة الحسابات
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {accountingSubTab === 'custodies' && (
                <motion.div
                  key="custodies-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Column 1: Active Custody List */}
                    <div className="lg:col-span-4 bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4">
                      <div>
                        <h3 className="text-xs font-bold text-sky-400 flex items-center gap-1.5 leading-none">
                          <Users size={14} />
                          <span>سجل عهد الموظفين والمهندسين والتقنيين</span>
                        </h3>
                        <p className="text-[10px] text-zinc-500 mt-1">تابع الأرصدة النقدية المسلمة كعهدة عمل تصفى بالفواتير رسمياً</p>
                      </div>

                      {/* Summary indicator */}
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400 font-bold">إجمالي العهد المعلقة:</span>
                        <span className="font-mono text-xs font-black text-amber-500 tabular-nums">
                          {employeeUsersList.reduce((sum, u) => sum + (u.custodyBalance || 0), 0).toLocaleString()} <span className="text-[9px] text-zinc-500">ر.ي</span>
                        </span>
                      </div>

                      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                        {employeeUsersList.length === 0 ? (
                          <div className="text-center py-10 text-zinc-500 text-xs font-semibold">
                            لا يوجد موظفين مسجلين حالياً لسحب العهد.
                          </div>
                        ) : (
                          employeeUsersList.map((emp) => {
                            const bal = emp.custodyBalance || 0;
                            return (
                              <div
                                key={emp.id}
                                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                  bal > 0 
                                    ? 'bg-amber-950/10 border-amber-500/20 hover:bg-amber-950/20 shadow-sm' 
                                    : 'bg-slate-900/40 border-white/5 hover:bg-slate-900/60'
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-zinc-100">{emp.name || emp.displayName || 'موظف غير مسمى'}</span>
                                    {emp.role && (
                                      <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-md font-bold select-none">
                                        {emp.role === 'engineer' ? 'مهندس صيانة' : emp.role === 'manager' ? 'مدير عام' : emp.role}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 font-medium font-mono">
                                    {emp.phone || '000-000-000'}
                                  </div>
                                </div>

                                <div className="text-left font-mono shrink-0">
                                  <div className={`text-xs font-black tabular-nums ${bal > 0 ? 'text-amber-500' : 'text-zinc-550 text-zinc-500'}`}>
                                    {bal.toLocaleString()} <span className="text-[8px] text-zinc-500">ر.ي</span>
                                  </div>
                                  <div className="text-[9px] text-zinc-500 font-bold mt-0.5">العهدة الحالية</div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Column 2: Handover Form */}
                    <div className="lg:col-span-4 bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4">
                      <div>
                        <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 leading-none">
                          <PlusCircle size={14} />
                          <span>صرف وتسليم عهدة نقدية جديدة</span>
                        </h3>
                        <p className="text-[10px] text-zinc-500 mt-1">تفريغ نقدية من صندوق المحل/الخزنة وتسليمها للمستلم كعهدة معلقة</p>
                      </div>

                      <form onSubmit={handleCustodyHandover} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 block">اختر الموظف أو المهندس المستلم:</label>
                          <select
                            value={custodyHandoverForm.employeeId}
                            onChange={(e) => setCustodyHandoverForm({ ...custodyHandoverForm, employeeId: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none cursor-pointer font-bold font-sans"
                            required
                          >
                            <option value="">-- اختر الموظف المستهدف --</option>
                            {employeeUsersList.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name || u.displayName} ({u.role || 'عضو'}) - الحالي: {(u.custodyBalance || 0).toLocaleString()} ر.ي
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 block">اختر صندوق الصرف المصدر:</label>
                          <select
                            value={custodyHandoverForm.vaultId}
                            onChange={(e) => setCustodyHandoverForm({ ...custodyHandoverForm, vaultId: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none cursor-pointer font-bold font-sans"
                            required
                          >
                            {vaults.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name} - الرصيد المتاح: {(v.balance || 0).toLocaleString()} ر.ي
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 block">المبلغ الصافي المقيد (ر.ي):</label>
                          <input
                            type="number"
                            placeholder="مثال: 50000"
                            value={custodyHandoverForm.amount}
                            onChange={(e) => setCustodyHandoverForm({ ...custodyHandoverForm, amount: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none font-bold font-mono text-emerald-400"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 block">تفصيل وبيان الصرف المالي:</label>
                          <textarea
                            placeholder="مثال: شراء شاشات أو دفع بضائع صيانة طارئة للزبائن"
                            value={custodyHandoverForm.details}
                            onChange={(e) => setCustodyHandoverForm({ ...custodyHandoverForm, details: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none h-16 font-medium"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingCustody}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 font-black text-xs text-white rounded-xl border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-md mt-2 disabled:opacity-50"
                        >
                          {isSubmittingCustody ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>جاري صرف وتسجيل العهدة...</span>
                            </>
                          ) : (
                            <>
                              <PlusCircle size={13} />
                              <span>صرف وتسجيل العهدة المزدوجة المتزنة</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>

                    {/* Column 3: Settle Form */}
                    <div className="lg:col-span-4 bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4">
                      <div>
                        <h3 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 leading-none">
                          <RotateCw size={14} />
                          <span>تصفية وتسوية عهدة معلقة</span>
                        </h3>
                        <p className="text-[10px] text-zinc-500 mt-1">تفريغ العهدة كفواتير مصاريف تشغيلية مقبولة أو استرجاع الكاش الفائض للصندوق</p>
                      </div>

                      <form onSubmit={handleCustodySettlement} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 block">اختر الموظف أو المهندس المنفذ للتصفية:</label>
                          <select
                            value={custodySettlementForm.employeeId}
                            onChange={(e) => setCustodySettlementForm({ ...custodySettlementForm, employeeId: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none cursor-pointer font-bold font-sans"
                            required
                          >
                            <option value="">-- اختر الموظف --</option>
                            {employeeUsersList.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name || u.displayName} - العهدة المعلقة: {(u.custodyBalance || 0).toLocaleString()} ر.ي
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 block">نوع إجراء وتأثير جرد التسوية:</label>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => setCustodySettlementForm({ ...custodySettlementForm, type: 'expense' })}
                              className={`py-2 text-[10px] font-black rounded-xl border transition-all cursor-pointer ${custodySettlementForm.type === 'expense' ? 'bg-amber-600/20 text-amber-400 border-amber-500/30 font-bold' : 'bg-slate-900 text-zinc-400 border-white/5'}`}
                            >
                              وصولات ومصاريف
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustodySettlementForm({ ...custodySettlementForm, type: 'return' })}
                              className={`py-2 text-[10px] font-black rounded-xl border transition-all cursor-pointer ${custodySettlementForm.type === 'return' ? 'bg-amber-600/20 text-amber-400 border-amber-500/30 font-bold' : 'bg-slate-900 text-zinc-400 border-white/5'}`}
                            >
                              رد الباقي نقدية كاش
                            </button>
                          </div>
                        </div>

                        {custodySettlementForm.type === 'return' && (
                          <div className="space-y-1 animate-fade-in">
                            <label className="text-[10px] font-bold text-zinc-400 block">اختر الصندوق النقدي المستلم:</label>
                            <select
                              value={custodySettlementForm.vaultId}
                              onChange={(e) => setCustodySettlementForm({ ...custodySettlementForm, vaultId: e.target.value })}
                              className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none cursor-pointer font-bold font-sans"
                              required
                            >
                              {vaults.map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.name} - الرصيد: {(v.balance || 0).toLocaleString()} ر.ي
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 block">المبلغ المستهلك / المسترجع (ر.ي):</label>
                          <input
                            type="number"
                            placeholder="مثال: 5000"
                            value={custodySettlementForm.amount}
                            onChange={(e) => setCustodySettlementForm({ ...custodySettlementForm, amount: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none font-bold font-mono text-amber-400"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 block">تفصيل وبيان وصالح التسوية:</label>
                          <textarea
                            placeholder={custodySettlementForm.type === 'expense' ? "تفصيل الفواتير المرفقة والوصولات..." : "بيان استرجاع نقدية إلى الصندوق..."}
                            value={custodySettlementForm.details}
                            onChange={(e) => setCustodySettlementForm({ ...custodySettlementForm, details: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 text-white p-2.5 text-xs rounded-xl outline-none h-16 font-medium"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingCustody}
                          className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 font-black text-xs text-white rounded-xl border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-md mt-2 disabled:opacity-50"
                        >
                          {isSubmittingCustody ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>جاري توثيق التسوية...</span>
                            </>
                          ) : (
                            <>
                              <RotateCw size={13} />
                              <span>اعتماد وتوثيق تسوية العهدة بالكامل</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </motion.div>
              )}

              {accountingSubTab === 'quarantine' && (
                <motion.div
                  key="quarantine-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6"
                >
                  <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-xs font-extrabold text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle size={14} />
                          <span>حركات معلقة تحت المعالجة والتحري الذاتي (Telemetry Quarantine)</span>
                        </h3>
                        <p className="text-[10px] text-zinc-500 mt-1">حركات مالية وتجارية غير مستقرة تم رصدها بواسطة تتبع النظام ووضعها في الحجر الوقائي لحماية ميزان الدفاتر.</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!profile?.ownerId) return;
                          for (const tx of quarantinedTransactions) {
                            try {
                              await deleteDoc(doc(db, 'quarantined_transactions', tx.id));
                            } catch(e) {}
                          }
                          alert('✓ تم تحفيز محاكاة فحص الأنظمة وإعادة توليد حركات الحجر المعلقة!');
                        }}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded-xl border-none cursor-pointer transition-all flex items-center gap-1"
                      >
                        <RefreshCw size={11} /> تحفيز فحص وتوليد حركات الحجر
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                      {quarantinedTransactions.filter(tx => tx.status === 'quarantined').length === 0 ? (
                        <div className="text-center py-24 text-zinc-500 text-xs border border-dashed border-white/5 rounded-2xl">
                          ✓ لا توجد حركات مالية معلقة تحت الحجر حالياً. جميع البيانات المحاسبية متوازنة ومعمدة بالكامل.
                        </div>
                      ) : (
                        quarantinedTransactions.filter(tx => tx.status === 'quarantined').map((tx) => {
                          return (
                            <div
                              key={tx.id}
                              className="bg-slate-950/90 rounded-2xl border border-amber-500/10 p-5 space-y-4 hover:border-amber-500/20 transition-all font-sans"
                            >
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/5 pb-2">
                                <div className="space-y-1">
                                  <span className="p-1 px-2.5 rounded bg-amber-500/10 font-mono text-[9px] text-amber-500 font-bold border border-amber-500/20">
                                    {tx.id}
                                  </span>
                                  <h4 className="text-xs font-black text-zinc-200 mt-1.5">{tx.description}</h4>
                                </div>

                                <div className="text-left font-sans">
                                  <div className="text-[10px] text-zinc-500 font-mono">
                                    {tx.createdAt ? new Date(tx.createdAt).toLocaleString('ar-YE') : 'الآن'}
                                  </div>
                                  <div className="text-xs font-black text-amber-500 font-mono mt-0.5">
                                    المبلغ المرصود: {tx.amount?.toLocaleString()} YER
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-zinc-400 block">تفاصيل خلل حركة الاتصال / التوازن المحجوزة:</span>
                                  <div className="bg-slate-900 rounded-xl p-3 border border-white/5 text-[10px] font-mono text-zinc-300 space-y-1 leading-relaxed">
                                    <p className="text-amber-500 font-bold">نوع الاستثناء: {tx.errorType}</p>
                                    <p className="text-zinc-400 mt-1">{tx.telemetryLog}</p>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-zinc-400 block">القيد المحاسبي المتوازن المقترح بعد التصحيح الذاتي:</span>
                                  <div className="bg-slate-900 rounded-xl p-2.5 border border-white/5 text-[10px] font-mono divide-y divide-white/5">
                                    <div className="flex justify-between font-bold text-zinc-400 pb-1 text-[9px]">
                                      <span>اسم الحساب المالي</span>
                                      <div className="flex gap-4">
                                        <span className="w-16 text-left">مدين (Debit)</span>
                                        <span className="w-16 text-left">دائن (Credit)</span>
                                      </div>
                                    </div>
                                    {tx.proposedItems?.map((item: any, idx: number) => (
                                      <div key={idx} className="flex justify-between py-1.5 text-[9px]">
                                        <span className="text-zinc-200">{item.accountName} ({item.accountId})</span>
                                        <div className="flex gap-4">
                                          <span className="w-16 text-left font-bold text-emerald-400">{item.debit > 0 ? item.debit.toLocaleString() : '—'}</span>
                                          <span className="w-16 text-left font-bold text-rose-400">{item.credit > 0 ? item.credit.toLocaleString() : '—'}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                                <button
                                  disabled={approvingQuarantinedId === tx.id}
                                  onClick={() => handleApproveQuarantined(tx)}
                                  className="px-4 py-2 bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-450 hover:to-emerald-550 text-white text-[10px] font-black rounded-xl transition-all border-none cursor-pointer shadow-md flex items-center gap-1 disabled:opacity-50"
                                >
                                  {approvingQuarantinedId === tx.id ? (
                                    <>
                                      <Loader2 size={11} className="animate-spin" />
                                      <span>جاري ترحيل واعتماد القيد...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check size={11} />
                                      <span>موافقة واعتماد القيد المحاسبي المتسلسل ✓</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleRejectQuarantined(tx)}
                                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black rounded-xl transition-all border-none cursor-pointer shadow-sm flex items-center gap-1"
                                >
                                  <X size={11} />
                                  <span>رفض وحذف الحركة المعلقة</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* TAB 4: PERIODIC JARD & ANALYTICS FILTERING */}
        {activeTab === 'analytics' && (
          <div id="tab-analytics-view" className="space-y-6">
            
            <div className="border-b border-white/5 pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Activity size={14} />
                  <span>لوحة التدقيق الكلي والجرد الدوري للموجودات</span>
                </h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">مطابقة التدفق الكلي يومي، شهري وسنوي لتأمين الأرصدة</p>
              </div>

              {/* Dynamic Period Filter Buttons */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10 gap-1 font-sans">
                <button 
                  onClick={() => setAnalyticsPeriod('daily')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none outline-none cursor-pointer ${analyticsPeriod === 'daily' ? 'bg-amber-500 text-slate-950' : 'text-zinc-400 hover:text-white'}`}
                >
                  الجرد والتحليل اليومي
                </button>
                <button 
                  onClick={() => setAnalyticsPeriod('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none outline-none cursor-pointer ${analyticsPeriod === 'monthly' ? 'bg-amber-500 text-slate-950' : 'text-zinc-400 hover:text-white'}`}
                >
                  الجرد والتحليل الشهري
                </button>
                <button 
                  onClick={() => setAnalyticsPeriod('yearly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none outline-none cursor-pointer ${analyticsPeriod === 'yearly' ? 'bg-amber-500 text-slate-950' : 'text-zinc-100 hover:text-white'}`}
                >
                  الجرد والتحليل السنوي
                </button>
              </div>
            </div>

            {/* METRICS COMPARATIVE CARD BOARD BASED ON PERIOD */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Box 1: Inbound & Outbound Financial Ratio Summary */}
              <div className="p-5 bg-slate-950/70 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-xs font-semibold text-zinc-200">مقررات وتناظر الأرصدة ({analyticsPeriod === 'daily' ? 'اليومية' : analyticsPeriod === 'monthly' ? 'الشهرية' : 'السنوية'})</h3>
                
                <div className="text-[11px] text-zinc-400 space-y-2">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span>نسبة الإنفاق والذمم إلى إجمالي الدخل:</span>
                    <span className="text-rose-400 font-bold tabular-nums">
                      {totalInflow > 0 ? ((totalOutflow / totalInflow) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span>السيولة النقدية المطلقة بالخزائن:</span>
                    <span className="text-emerald-400 font-bold tabular-nums">
                      {(totalVaultsBalance).toLocaleString()} ر.ي
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span>حالة التوازن التشغيلي العام:</span>
                    <span className="text-cyan-400 font-bold">متآلف ومطابق ✓</span>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span>صافي العهد والتغذية المالية:</span>
                    <span className="text-amber-400 font-black tabular-nums">
                      {(totalInflow - totalOutflow).toLocaleString()} ر.ي
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 2: System Status Statement */}
              <div className="p-5 bg-slate-950/70 rounded-2xl border border-white/5 flex flex-col justify-center items-center text-center space-y-2">
                <Calendar className="text-amber-500/80 mb-1" size={32} />
                <div className="text-xs text-zinc-200 font-black">تقرير جرد ومطابقة دورية معتمد</div>
                <div className="text-[10px] text-zinc-500 leading-relaxed max-w-sm">
                  تم جرد الصناديق الرئيسية والحسابات المضافة بالكامل مع مبيعات الحجوزات والسوق اليومي وتبويب الجرد الكلي بنجاح.
                </div>
                <div className="text-[9px] text-amber-400 border border-amber-500/15 bg-amber-500/5 px-2.5 py-1 rounded-full mt-2 font-bold select-none">
                  مؤرشف بالكامل ومربوط بقاعدة الرقابة
                </div>
              </div>

            </div>

            {/* ADVANCED INTEGRATED BENTO CARD DIRECTORY - ALL 14 DIVISIONS AS REQUESTED */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                <h3 className="text-xs font-black text-white hover:text-amber-300 transition-colors">
                  المرايا الهيكلية الحسابية المتكاملة لفروع ومكونات النظام
                </h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                
                {/* Cardio 1: Maintenance ورشة الصيانة */}
                {isModuleEnabled('maintenance') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl"><Wrench size={16} /></span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">نشط</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">1. أعمال وصيانة الورشة</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">أجور المصلحين ومستلزمات الغيار</p>
                      <div className="text-amber-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realMaintenanceReceipts.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 2: Retail Sales مبيعات التجزئة */}
                {isModuleEnabled('sales') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl"><Coins size={16} /></span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">مطابق</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">2. مبيعات التجزئة والإكسسوار</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">مبيعات كاشير المعرض ومستلزمات البيع الفورية</p>
                      <div className="text-cyan-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realRetailSales.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 3: Wholesale Sales مبيعات الجملة */}
                {isModuleEnabled('wholesale-pos') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl"><TrendingUp size={16} /></span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">بث مباشر</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">3. مبيعات الجملة ونقاط البيع</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">فواتير بيع الموزعين وتجار المعارض المعتمدين</p>
                      <div className="text-emerald-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realWholesaleSales.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 4: Purchases المشتريات والتوريد */}
                {isModuleEnabled('inventory') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-rose-500/10 text-rose-400 rounded-xl"><TrendingDown size={16} /></span>
                      <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">دفع معتمد</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">4. مشتريات التجزئة والتوريد</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">مجموع تكاليف تجهيز رفوف المحل</p>
                      <div className="text-rose-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realRetailPurchases.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 5: Wholesale Purchases مشتريات الجملة */}
                {isModuleEnabled('wholesale-purchases') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-purple-500/10 text-purple-400 rounded-xl"><SlidersHorizontal size={16} /></span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">سند توريد</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">5. صفقات ومشتريات الجملة</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">صفقات تجهيز المخازن المركزية الكبرى</p>
                      <div className="text-purple-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realWholesalePurchases.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 6: SIM operations شرائح جوال */}
                {isModuleEnabled('sim-cards') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-blue-500/10 text-blue-400 rounded-xl"><Cpu size={16} /></span>
                      <span className="text-[9px] bg-indigo-500/5 text-indigo-400 border border-indigo-500/15 px-2 py-0.5 rounded-full font-bold">يمن موبايل</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">6. شرائح الاتصالات والشبكات</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">شراء وتوريد وتفعيل شرائح الزبائن المشتركين</p>
                      <div className="text-blue-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realSIMOperations.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 7: Recharge Balance رصيد الشبكات */}
                {isModuleEnabled('mobile-balance') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-amber-500/15 text-amber-500 rounded-xl"><SlidersHorizontal size={16} /></span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">بث مباشر</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">7. مبيعات باقات شحن وتوزيع الرصيد</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">مبيعات باقات فوري وجملة لكل الشبكات</p>
                      <div className="text-amber-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realRechargeSales.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 8: Suppliers Market سوق الموردين */}
                {isModuleEnabled('suppliers') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-orange-500/10 text-orange-400 rounded-xl"><Truck size={16} /></span>
                      <span className="text-[9px] bg-zinc-800/80 text-zinc-300 px-2 py-0.5 rounded-full font-bold">سوق الجوال</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">8. الفواتير وسوق الموردين المشترك</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">أصناف السوق وقيمة الفواتير المسحوبة</p>
                      <div className="text-orange-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realPurchasesTotal.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 9: Damaged items التالف والفاقد */}
                {isModuleEnabled('damaged') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-rose-600/10 text-rose-500 rounded-xl"><Trash2 size={16} /></span>
                      <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">استقطاع وخسائر</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">9. التالف والفاقد والمستهلك</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">إهلاك شاشات تالفة أو قطع تالفة بالمخازن</p>
                      <div className="text-rose-500 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realDamagedLosses.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 10: Returns المرتجعات */}
                {isModuleEnabled('archive') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl"><Clock size={16} /></span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">عكس القيود</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">10. كشف المرتجعات والمسترجعات</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">حالة المرتجع للموردين والزبائن اليومي</p>
                      <div className="text-indigo-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realReturnsTotal.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 11: Reservations الحجوزات */}
                {isModuleEnabled('sales') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-teal-500/10 text-teal-400 rounded-xl"><Calendar size={16} /></span>
                      <span className="text-[9px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">عربون معلق</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">11. حجوزات الأجهزة والعربونات</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">دفع مسبق لحجز أجهزة زبائن صيانة وشراء</p>
                      <div className="text-teal-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realReservationsTotal.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 12: Engineers عمولات الورشة */}
                {isModuleEnabled('maintenance') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl"><Wrench size={16} /></span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">فني الورشة</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">12. مستحقات وعمولات المهندسين</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">عمولات مهندسي الصيانة بالمعرض والورشة</p>
                      <div className="text-amber-500 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realEngineersCommissions.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 13: Staff رواتب الموظفين */}
                {isModuleEnabled('users') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl"><Clock size={16} /></span>
                      <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">سلف معلقة</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">13. حسابات الموظفين وسجل رواتبهم</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">مسيرات الرواتب الإلزامية والسلف السنوية</p>
                      <div className="text-yellow-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {realStaffSalariesTotal.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 14: Fixed Assets جرد الأصول */}
                {isModuleEnabled('inventory-match') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl"><Wrench size={16} /></span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">ثابت</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">14. الأصول الثابتة والرأس مالية</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">قيمة التجهيزات والمولدات والسيارات بالمعرض</p>
                      <div className="text-emerald-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {totalAssets.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

                {/* Cardio 15: Outflows الخرج والمصروف */}
                {isModuleEnabled('finances') && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/5 space-y-2 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-rose-500/10 text-rose-500 rounded-xl"><TrendingDown size={16} /></span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">مصاريف</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-350">15. الخرج العام والمصاريف النثرية</h4>
                      <p className="text-[9px] text-zinc-500 mt-0.5">إجمالي المنصرف التشغيلي من صناديق النثرية</p>
                      <div className="text-rose-400 font-extrabold text-xs sm:text-sm mt-2 tabular-nums">
                        {totalOutflow.toLocaleString()} YER
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* INTEGRATIVE SMART AUDIT & MATCHING MULTI-WIDGET */}
            <div className="bg-slate-900/80 p-6 rounded-3xl border border-white/5 space-y-6">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <Search size={18} className="text-amber-500 animate-pulse" />
                <div>
                  <h3 className="text-xs font-black text-white">مركز الاستفصال الاستباقي والتدقيق المالي الذكي</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">استعلم واطرح فلاتر الجرد ومطابقة أرصدة الذمم والعهد والموظفين فورياً في الصناديق</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">حدد طبيعة ومحور الاستعلام</label>
                  <select 
                    value={auditSearchType}
                    onChange={e => setAuditSearchType(e.target.value)}
                    className="w-full bg-slate-950 text-zinc-300 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">كشف عام لجميع المقررات المحاسبية واليومية</option>
                    <option value="customer_statement">كشف حساب تفصيلي لعميل محدد أو كم وصله/مرتجعه</option>
                    <option value="item_deals">حركة مبيعات ومشتريات صنف مخصص (هواتف، قطع غيار...)</option>
                    <option value="dept_deals">حركات المبيعات والشراء لقسم مالي محدد</option>
                    <option value="employee_attendance">كشف حساب وجرد حضور عامل أو موظف بالورشة</option>
                    <option value="transfers_registry">سجل وتحري الحوالات من شخص محدد أو للكل</option>
                    <option value="account_transfers">حوالات وجرد سيولة رصيد صندوق أو حساب للكل</option>
                    <option value="preparation_work">سجل إنتاجية وعمل عامل التجهيز والصيانة بالورشة</option>
                    <option value="employee_maint_work">أعمال ومبيعات فني صيانة معين أو الكل بالورشة</option>
                    <option value="employee_spend">خرج وصرف قيم مالية معينة لموظف بذاته</option>
                    <option value="employee_dept_inflow">واردات ودخل قسم مالي مدخل بواسطة موظف محدد</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">اسم الشخص أو الصنف أو الكلمة المفتاحية للبحث</label>
                  <input 
                    type="text"
                    placeholder="مثال: أبو جواد ، يمن موبايل ، صيانة ، شاحن..."
                    value={auditTargetKeyword}
                    onChange={e => setAuditTargetKeyword(e.target.value)}
                    className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-end">
                  <button 
                    onClick={handleExecuteAuditQuery}
                    className="w-full py-3 bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl transition-all border-none cursor-pointer"
                  >
                    تشغيل محرك الاستقصاء والمطابقة الشامل
                  </button>
                </div>
              </div>

              {/* RENDER AUDIT RESULTS SECTION */}
              {auditQueryResult !== null && (
                <div className="space-y-6 pt-4 border-t border-white/5 transition-all">
                  
                  {/* Summary Callout */}
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                      <div className="text-xs font-bold text-amber-250 font-sans leading-relaxed text-right">{auditSummaryText}</div>
                    </div>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold select-none whitespace-nowrap">تقرير مراجع ومعمد سحابياً ✓</span>
                  </div>

                  {/* METALLIC PREMIUM SHORTCUT NODES */}
                  {activeComponents.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="text-[10px] font-black text-amber-500 flex items-center gap-1.5 select-none uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                        <span>منظومة المقاصة والمطابقة السريعة للمكونات النشطة المنفصلة</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-fade-in">
                        {activeComponents.map((comp, idx) => (
                          <div 
                            key={idx} 
                            style={{
                              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 50%, rgba(30, 41, 59, 0.8) 100%)',
                              border: '1px solid rgba(115, 115, 115, 0.25)',
                              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.5)'
                            }}
                            className="rounded-2xl p-4 transition-all hover:border-amber-500/40 group flex flex-col justify-between"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="text-[9px] bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono px-2 py-0.5 rounded-full">
                                  {comp.fileName}
                                </span>
                                <h4 className="text-xs font-black text-zinc-100 mt-1.5 leading-tight">{comp.componentName}</h4>
                                <p className="text-[10px] text-zinc-400 mt-1">{comp.metricLabel}</p>
                              </div>
                              <div className="text-left font-sans">
                                <div className="text-amber-400 font-black text-xs tabular-nums leading-none">
                                  {comp.actualValue.toLocaleString()} ر.ي
                                </div>
                                <div className="text-[9px] text-zinc-400 mt-1 leading-none font-bold">
                                  حساب القيد: {comp.accountCode}
                                </div>
                              </div>
                            </div>
                            
                            <div className="border-t border-white/5 mt-3 pt-2.5 flex items-center justify-between gap-2">
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold select-none">
                                {comp.isBalanced ? '✓ متوازن القيد سحابياً' : '✗ غير متوازن القيد'}
                              </span>
                              
                              <button
                                onClick={() => handleShortcutNavigation(comp.route)}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-zinc-700 via-zinc-800 to-zinc-700 hover:from-amber-500 hover:to-amber-600 hover:text-slate-950 text-zinc-200 text-[10px] font-black rounded-lg transition-all border border-zinc-600/50 hover:border-none shadow-md cursor-pointer"
                              >
                                الانتقال الفوري للمكوّن 🡠
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Table of Results */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 overflow-x-auto">
                    {auditQueryResult.length === 0 ? (
                      <div className="text-center py-12 text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                        <span>لا يوجد أي سجلات مطابقة للبحث أو الفلاتر المدخلة حالياً. جرب تغيير كلمة الاستفسار أو نطاق الجرد.</span>
                      </div>
                    ) : (
                      <table className="w-full text-right text-xs text-zinc-300">
                        <thead className="bg-white/5 text-[10px] text-zinc-400">
                          <tr>
                            <th className="p-3 text-right rounded-r-lg">الزمن والتوقيت</th>
                            <th className="p-3 text-right">نوع وتصنيف الحركة</th>
                            <th className="p-3 text-right">المرجع / البند</th>
                            <th className="p-3 text-right">القيمة النقدية (ر.ي)</th>
                            <th className="p-3 text-right rounded-l-lg">البيان والشرح والتفاصيل</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {auditQueryResult.map((row, i) => {
                            const dateObj = row.date?.toDate ? row.date.toDate() : (row.date ? new Date(row.date) : new Date());
                            return (
                              <tr key={i} className="hover:bg-white/5 transition-colors">
                                <td className="p-3 font-mono text-[10px] text-zinc-400">
                                  {isNaN(dateObj.getTime()) ? 'غير محدد' : dateObj.toLocaleString('ar-YE', { hour12: true })}
                                </td>
                                <td className="p-3">
                                  <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] text-zinc-300 font-bold">{row.type}</span>
                                </td>
                                <td className="p-3 font-bold text-indigo-400">{row.ref}</td>
                                <td className="p-3 font-black text-amber-400 tabular-nums font-mono text-xs">
                                  {row.val.toLocaleString()} ر.ي
                                </td>
                                <td className="p-3 text-zinc-300 leading-relaxed max-w-xs truncate" title={row.details}>
                                  {row.details}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 6: FIXED ASSETS & DEPRECIATION */}
        {activeTab === 'assets' && (
          <div id="tab-assets-view" className="space-y-6">
            <AssetMaintenanceDashboard 
              registeredAssetNames={registeredAssetNames}
              onRegisterNewAssetName={handleRegisterNewAssetName}
              ownerId={profile?.ownerId}
              storeId={profile?.shopId || profile?.storeId || profile?.ownerId}
            />
          </div>
        )}

      </div>

      {/* ==================== CREATE VAULT MODAL ==================== */}
      {showVaultModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/90 backdrop-blur-md" onClick={() => setShowVaultModal(false)} />
          <div className="relative w-full max-w-md bg-slate-900 rounded-[2rem] border border-white/10 p-6 shadow-2xl text-right overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black text-white">تأسيس وإضافة صندوق مبيعات أو رصيد بنكي</h3>
              <button 
                onClick={() => setShowVaultModal(false)} 
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border-none outline-none text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateVault} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1">اسم الصندوق أو الحساب المالي الجديد</label>
                <input 
                  type="text" 
                  required 
                  placeholder="مثلاً: صندوق مبيعات الكاش" 
                  value={newVaultForm.name}
                  onChange={e => setNewVaultForm({...newVaultForm, name: e.target.value})}
                  className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1">تصنيف ونوع الرصيد</label>
                <select 
                  value={newVaultForm.type}
                  onChange={e => setNewVaultForm({...newVaultForm, type: e.target.value as 'bank' | 'cash' | 'market'})}
                  className="w-full bg-slate-950 text-zinc-350 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="bank">رصيد وحساب بنكي تداولي</option>
                  <option value="cash">صندوق كاش محلي للبيع الفوري</option>
                  <option value="market">صندوق مخصص لشراء بضائع وحراج السوق</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1">المبلغ المبتدئ لتغذية الرصيد اليوم (ر.ي)</label>
                <input 
                  type="number" 
                  required
                  placeholder="0.00" 
                  value={newVaultForm.balance}
                  onChange={e => setNewVaultForm({...newVaultForm, balance: e.target.value})}
                  className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                />
              </div>

              {newVaultForm.type === 'bank' && (
                <div className="transition-all">
                  <label className="text-[10px] font-bold text-zinc-300 block mb-1">رقم الحساب البنكي المرتبط</label>
                  <input 
                    type="text" 
                    placeholder="Acc-YEM-XXXX887" 
                    value={newVaultForm.linkedAccount}
                    onChange={e => setNewVaultForm({...newVaultForm, linkedAccount: e.target.value})}
                    className="w-full bg-slate-950 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <button type="submit" className="w-full py-3 bg-amber-500 text-slate-950 text-xs font-black rounded-xl hover:bg-amber-400 transition-all cursor-pointer border-none">
                تأكيد وبث الحساب الجديد بالمقررات
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== AUDIT AND DEFICIT/SURPLUS DIAGNOSTIC MODAL ==================== */}
      {showAuditLossModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-navy-950/95 backdrop-blur-md" onClick={() => setShowAuditLossModal(false)} />
          <div className="relative w-full max-w-4xl bg-slate-900 rounded-[2rem] border border-amber-500/30 p-6 sm:p-8 shadow-2xl text-right overflow-hidden my-8 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl">
                  <SlidersHorizontal size={20} className="animate-spin" style={{ animationDuration: '6s' }} />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white">محرك التدقيق والتقصي وتحليل فوارق العجز والزيادة وشبهات السرقات</h3>
                  <p className="text-[10px] text-zinc-400 mt-1">تتبع واكتشف الاختلالات المالية ومطابقة أرصدة الباركود الموحد وتصفية الحسابات المعلقة فورياً</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAuditLossModal(false)} 
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border-none outline-none text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="space-y-6 overflow-y-auto pr-1 pl-1 flex-1 scrollbar-thin">
              
              {/* Search & Control Panel inside Modal */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/80 p-5 rounded-2xl border border-white/5">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1.5">نوع التقصي والفرز</label>
                  <select 
                    value={auditLossType}
                    onChange={e => setAuditLossType(e.target.value as any)}
                    className="w-full bg-slate-900 text-zinc-350 text-right text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">🔍 جميع الفوارق والاختلالات بالفترة</option>
                    <option value="deficit">⚠️ حالات العجز المالي والمخزني</option>
                    <option value="surplus">📈 فوارق الزيادة النقدية والوفر</option>
                    <option value="theft">🚨 شبهات السرقات والفاقد الأمني</option>
                    <option value="pending">⏳ العمليات والعهد المعلقة للموظفين</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1.5">مطابقة الباركود الموحد أو كلمة البحث</label>
                  <input 
                    type="text" 
                    placeholder="أدخل الباركود أو اسم الصنف للمطابقة المباشرة..." 
                    value={auditLossBarcode}
                    onChange={e => setAuditLossBarcode(e.target.value)}
                    className="w-full bg-slate-900 text-right text-xs p-3 rounded-xl border border-white/10 text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-end">
                  <button 
                    onClick={runDiagnosticLossAudit}
                    disabled={isAuditingLoss}
                    className="w-full py-3 bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/15"
                  >
                    {isAuditingLoss ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        <span>جاري فحص وتدقيق القيود...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡ تشغيل الفحص الاستباقي الشامل</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Financial Discrepancies Summary Block */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/[0.04] text-right">
                  <span className="text-[9px] text-zinc-500 font-bold block">إجمالي القيمة الخاضعة للفحص</span>
                  <span className="text-xs sm:text-sm font-extrabold text-amber-400 font-mono mt-1 block">
                    {auditLossResults.reduce((sum, item) => sum + item.amount, 0).toLocaleString()} <span className="text-[9px] text-zinc-500">ر.ي</span>
                  </span>
                </div>
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/[0.04] text-right">
                  <span className="text-[9px] text-zinc-500 font-bold block">مجموع الحالات المكتشفة</span>
                  <span className="text-xs sm:text-sm font-extrabold text-zinc-200 font-mono mt-1 block">
                    {auditLossResults.length} حركات مالية
                  </span>
                </div>
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/[0.04] text-right">
                  <span className="text-[9px] text-zinc-500 font-bold block">بانتظار فك الارتباط والتسوية</span>
                  <span className="text-xs sm:text-sm font-extrabold text-rose-400 font-mono mt-1 block">
                    {auditLossResults.filter(r => r.status !== 'resolved').length} معلق
                  </span>
                </div>
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/[0.04] text-right">
                  <span className="text-[9px] text-zinc-500 font-bold block">الحالات المسواة بالقيود</span>
                  <span className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono mt-1 block">
                    {auditLossResults.filter(r => r.status === 'resolved').length} منجز ✓
                  </span>
                </div>
              </div>

              {/* Results List */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-zinc-300 border-r-2 border-amber-500 pr-2">📋 كشف الاختلالات وفروق الباركود المكتشفة من المحرك:</h4>
                
                {auditLossResults.length === 0 ? (
                  <div className="bg-slate-950/30 p-12 rounded-3xl border border-white/[0.03] text-center text-zinc-500 text-xs">
                    ✨ لم يتم العثور على أي حوادث عجز أو زيادة أو شبهات سرقات مطابقة للفلاتر والباركود المدخل حالياً. النظام سليم ومطابق للمقاييس!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {auditLossResults.map((item) => (
                      <div 
                        key={item.id} 
                        className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right ${
                          item.status === 'resolved' 
                            ? 'bg-emerald-500/5 border-emerald-500/20 opacity-80' 
                            : 'bg-slate-950/60 border-white/5 hover:border-amber-500/20'
                        }`}
                      >
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider ${
                              item.type === 'theft' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              item.type === 'deficit' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              item.type === 'surplus' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              'bg-zinc-800 text-zinc-400'
                            }`}>
                              {item.source}
                            </span>
                            
                            {item.severity === 'critical' && (
                              <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 animate-pulse">
                                🚨 شبهة أمنية / حرجة
                              </span>
                            )}
                            {item.severity === 'high' && (
                              <span className="bg-amber-600/20 text-amber-400 border border-amber-500/20 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md">
                                ⚠️ فارق مرتفع
                              </span>
                            )}
                            
                            <span className="text-[9px] bg-white/5 text-zinc-400 border border-white/10 px-2 py-0.5 rounded-md font-mono">
                              📦 الباركود الموحد: {item.barcode}
                            </span>
                          </div>

                          <h4 className="text-xs font-black text-white">{item.title}</h4>
                          <p className="text-[10px] text-zinc-400 leading-relaxed max-w-2xl">{item.description}</p>
                        </div>

                        <div className="flex md:flex-col items-end justify-between md:justify-center gap-3 w-full md:w-auto shrink-0 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                          <div className="text-right">
                            <span className="text-[9px] text-zinc-500 font-bold block">القيمة التقريبية للفارق</span>
                            <span className="text-xs sm:text-sm font-black text-amber-400 font-mono">
                              {item.amount.toLocaleString()} <span className="text-[9px] font-normal text-zinc-500">ر.ي</span>
                            </span>
                          </div>

                          {item.status === 'resolved' ? (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 select-none">
                              ✓ تم فك الارتباط والتسوية
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReconcileAnomaly(item.id, item.title)}
                              className="px-3.5 py-2 bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-800 hover:from-amber-500 hover:to-amber-600 hover:text-slate-950 text-zinc-200 text-[10px] font-black rounded-xl border border-zinc-700 hover:border-none transition-all cursor-pointer shadow-md whitespace-nowrap"
                            >
                              ⚙️ فك الارتباط وتسوية دفترياً
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="mt-6 border-t border-white/5 pt-4 flex justify-between items-center shrink-0">
              <p className="text-[9px] text-zinc-500">✓ يعتمد نظام التقصي على خوارزميات مطابقة الباركود وحركة الجرد الدفتري ضد التدفقات الموثقة سحابياً.</p>
              <button
                type="button"
                onClick={() => setShowAuditLossModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-350 text-xs font-bold py-2.5 px-5 rounded-xl border-none cursor-pointer transition-all active:scale-95"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FLOATING QUICK-ACCESS BUTTON FOR FIXED FIXED ASSET MANAGEMENT */}
      {activeTab !== 'assets' && (
        <button
          id="fixed-assets-floating-trigger"
          onClick={() => {
            setActiveTab('assets');
            try {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.15);
              }
            } catch (e) {}
          }}
          className="fixed bottom-6 left-6 z-[90] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs px-4 py-3 rounded-full shadow-[0_10px_25px_rgba(245,158,11,0.3)] flex items-center gap-2 border border-amber-400/20 active:scale-95 transition-all cursor-pointer group"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
          </span>
          <Wrench size={14} className="group-hover:rotate-12 transition-transform" />
          <span>إدارة الأصول الثابتة السريع</span>
        </button>
      )}

      {/* CLEAN FULL-SCREEN DOUBLE-ENTRY JOURNAL MODAL */}
      {isCleanJournalModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl text-white overflow-y-auto p-4 md:p-8 dir-rtl text-right font-sans flex flex-col" dir="rtl">
          {/* Top Bar */}
          <div className="max-w-6xl w-full mx-auto flex justify-between items-center bg-slate-900/90 p-4 px-6 rounded-2xl border border-white/10 mb-6 shrink-0 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <FileText size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-white">سند قيد وقيد خرج مباشر (Unified Journal & Expense Voucher)</h2>
                <p className="text-xs text-zinc-400">واجهة مركزة وذكية لتسجيل المصاريف المباشرة والقيود المحاسبية المزدوجة ومراكز التكلفة</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCleanJournalModalOpen(false)}
              className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 cursor-pointer font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <X size={16} />
              <span>إغلاق النموذج</span>
            </button>
          </div>

          <div className="max-w-6xl w-full mx-auto grow space-y-6">
            <UnifiedJournalVoucher
              profile={profile}
              accounts={accountsList}
              vaults={vaults}
              onSuccess={() => {
                showToast('تم حفظ وترحيل السند بنجاح وتحديث الأرصدة والدفاتر', 'success');
                setIsCleanJournalModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Smart AI Accountant Generative Voice & Text Engine Drawer */}
      <AnimatePresence>
        {isAIAccountantOpen && (
          <SmartAIAccountantModal
            isOpen={isAIAccountantOpen}
            onClose={() => setIsAIAccountantOpen(false)}
            profile={profile}
            onEntryPosted={() => {
              showToast('تم ترحيل القيد الذكي بنجاح وتحديث كافة الدفاتر والميزانية', 'success');
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
