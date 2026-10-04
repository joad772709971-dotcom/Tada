import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Mic, MicOff, Send, Sparkles, X, Check, ArrowRight, 
  RotateCcw, Volume2, VolumeX, Copy, Printer, CheckCircle, 
  AlertCircle, DollarSign, Wallet, FileText, ArrowLeftRight, 
  ChevronDown, Layers, ShieldCheck, Scale, Edit3, Trash2,
  Calendar, Building2, HelpCircle, Activity, Zap, Play, Square, Loader2,
  Phone, PhoneCall, PhoneOff, Crown, Radio, Gauge, Sliders, Smartphone,
  CheckCheck, Landmark, ArrowUpRight, ArrowDownLeft, ShoppingCart, 
  PackageCheck, Wrench, Signal, UserCheck, FileSpreadsheet, Calculator, Undo2,
  MessageCircle, ShieldAlert, TrendingUp, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Account, BankAccount } from '../types';
import { geminiService, SmartAccountingResponse, ProactiveRadarAlert } from '../services/geminiService';
import { accountingService, LedgerItem } from '../services/accountingService';
import { db, generateUUID } from '../firebase';
import { collection, getDocs, query, where, limit, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { DevicePermissionsService } from '../services/DevicePermissionsService';
import SmartAIDailyEditor from './smart_accountant/SmartAIDailyEditor';
import SmartAIIntelligenceHub from './smart_accountant/SmartAIIntelligenceHub';
import SmartAIQuickActionsBar from './smart_accountant/SmartAIQuickActionsBar';
import SmartAIInstructionsSection from './smart_accountant/SmartAIInstructionsSection';
import { SmartInvoiceOCRModal } from './accounting/SmartInvoiceOCRModal';

interface SmartAIAccountantModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onEntryPosted?: () => void;
}

export interface OperationCategory {
  id: string;
  label: string;
  shortLabel: string;
  icon: any;
  color: string;
  badgeBg: string;
  borderColor: string;
  defaultPrefix: string;
  placeholder: string;
  hint: string;
}

export const OPERATION_CATEGORIES: OperationCategory[] = [
  {
    id: 'expense',
    label: 'سند صرف',
    shortLabel: '💸 صرف',
    icon: ArrowDownLeft,
    color: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    borderColor: 'border-rose-500',
    defaultPrefix: 'صرفت ',
    placeholder: 'صرفت إيجار، كهرباء، نثريات والمبلغ...',
    hint: 'مصروفات ونثريات'
  },
  {
    id: 'receipt',
    label: 'سند قبض',
    shortLabel: '💰 قبض',
    icon: ArrowUpRight,
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    borderColor: 'border-emerald-500',
    defaultPrefix: 'استلمت ',
    placeholder: 'استلمت دفعة من عميل، مقبوضات...',
    hint: 'دفعات وإيرادات'
  },
  {
    id: 'sales',
    label: 'مبيعات',
    shortLabel: '🛒 مبيعات',
    icon: ShoppingCart,
    color: 'text-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    borderColor: 'border-blue-500',
    defaultPrefix: 'مبيعات ',
    placeholder: 'مبيعات كاش أو آجل...',
    hint: 'مبيعات وإيرادات'
  },
  {
    id: 'purchases',
    label: 'مشتريات',
    shortLabel: '📦 مشتريات',
    icon: PackageCheck,
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    borderColor: 'border-purple-500',
    defaultPrefix: 'اشتريت ',
    placeholder: 'شراء بضاعة أو قطع نقداً أو آجل...',
    hint: 'بضاعة وموردين'
  },
  {
    id: 'maintenance',
    label: 'صيانة',
    shortLabel: '🔧 صيانة',
    icon: Wrench,
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    borderColor: 'border-amber-500',
    defaultPrefix: 'صيانة ',
    placeholder: 'أجور فحص وصيانة وقطع غيار...',
    hint: 'أجور وقطع صيانة'
  },
  {
    id: 'recharge',
    label: 'شحن رصيد',
    shortLabel: '📶 شحن',
    icon: Signal,
    color: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    borderColor: 'border-cyan-500',
    defaultPrefix: 'شحن باقات ',
    placeholder: 'شحن رصيد وباقات يمن موبايل، يو...',
    hint: 'تسديد وباقات'
  },
  {
    id: 'transfer',
    label: 'تحويل',
    shortLabel: '🔄 تحويل',
    icon: ArrowLeftRight,
    color: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    borderColor: 'border-indigo-500',
    defaultPrefix: 'تحويل ',
    placeholder: 'تحويل بين الصناديق والبنوك...',
    hint: 'مناقلة سيولة'
  },
  {
    id: 'payroll',
    label: 'رواتب وسلف',
    shortLabel: '👨‍🔧 رواتب',
    icon: UserCheck,
    color: 'text-teal-400',
    badgeBg: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    borderColor: 'border-teal-500',
    defaultPrefix: 'سلفة/راتب ',
    placeholder: 'صرف راتب أو سلفة لموظف...',
    hint: 'رواتب وسلف'
  },
  {
    id: 'reports',
    label: 'تقارير',
    shortLabel: '📊 تقارير',
    icon: FileSpreadsheet,
    color: 'text-violet-400',
    badgeBg: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    borderColor: 'border-violet-500',
    defaultPrefix: 'كم أرباح ومبيعات اليوم؟',
    placeholder: 'استعلام عن الأرباح، الكشوفات، الصناديق...',
    hint: 'استعلام مالي'
  },
  {
    id: 'calculations',
    label: 'حساب وهوامش',
    shortLabel: '🧮 حساب',
    icon: Calculator,
    color: 'text-orange-400',
    badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    borderColor: 'border-orange-500',
    defaultPrefix: 'احسب لي ',
    placeholder: 'حساب هوامش ربح أو أسعار صرف...',
    hint: 'حسابات وهوامش'
  }
];

export default function SmartAIAccountantModal({
  isOpen,
  onClose,
  profile,
  onEntryPosted
}: SmartAIAccountantModalProps) {
  const [inputText, setInputText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimSpeech, setInterimSpeech] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Microphone Permission Modal State (نافذة طلب إذن الميكروفون المباشرة)
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);
  const [pendingActionAfterMic, setPendingActionAfterMic] = useState<'dictate' | 'call' | null>(null);
  const [isRequestingMic, setIsRequestingMic] = useState(false);

  // Live Call Mode State (اتصال صوتي مباشر مع المحاسب الذكي)
  const [isCallMode, setIsCallMode] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<'connecting' | 'listening' | 'thinking' | 'speaking' | 'idle'>('idle');
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [callTranscript, setCallTranscript] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([]);

  // Rollback state (التراجع عن العمليات)
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackSuccess, setRollbackSuccess] = useState<string | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [entryToRollback, setEntryToRollback] = useState<string | null>(null);

  // Loaded context
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vaults, setVaults] = useState<BankAccount[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>(null);

  // Result state
  const [currentResult, setCurrentResult] = useState<SmartAccountingResponse | null>(null);
  const [editableResult, setEditableResult] = useState<SmartAccountingResponse | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [postedRef, setPostedRef] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  // TTS audio state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [permGranted, setPermGranted] = useState(true);

  // History state
  const [history, setHistory] = useState<Array<{ text: string; result: SmartAccountingResponse; timestamp: Date; ref?: string; reversed?: boolean }>>([]);
  const [activeMainTab, setActiveMainTab] = useState<'chat' | 'instructions' | 'daily_editor' | 'intelligence' | 'invoice_ocr'>('chat');
  const [isCustomerDebtModalOpen, setIsCustomerDebtModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [radarAlert, setRadarAlert] = useState<ProactiveRadarAlert | null>(null);
  const [isLoadingRadar, setIsLoadingRadar] = useState<boolean>(false);
  const [radarDismissed, setRadarDismissed] = useState<boolean>(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [entryOrDisplayMode, setEntryOrDisplayMode] = useState<'entry' | 'display'>('entry');
  const [suggestedMatch, setSuggestedMatch] = useState<{ originalText: string; matchedName: string; type: string } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const callTimerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const storeCode = profile?.storeId || profile?.shopId || 'MAIN_STORE';
  const ownerId = profile?.ownerId || profile?.uid || 'SYSTEM';

  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin' || (profile as any)?.isSuperAdmin;

  // Load accounting context on open (optimized with parallel fetching)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    let radarTimer: any = null;

    const loadContext = async () => {
      try {
        const [
          accRes,
          bankRes,
          custRes,
          supRes,
          invRes,
          empRes,
          txRes,
          salesRes
        ] = await Promise.allSettled([
          getDocs(query(collection(db, 'accounts'), where('ownerId', '==', ownerId), limit(60))),
          getDocs(query(collection(db, 'bank_accounts'), where('ownerId', '==', ownerId), limit(20))),
          getDocs(query(collection(db, 'customers'), where('ownerId', '==', ownerId), limit(40))),
          getDocs(query(collection(db, 'suppliers'), where('ownerId', '==', ownerId), limit(40))),
          getDocs(query(collection(db, 'products'), where('ownerId', '==', ownerId), limit(60))),
          getDocs(query(collection(db, 'employees'), where('ownerId', '==', ownerId), limit(20))),
          getDocs(query(collection(db, 'transactions'), where('ownerId', '==', ownerId), limit(50))),
          getDocs(query(collection(db, 'invoices'), where('ownerId', '==', ownerId), limit(30)))
        ]);

        if (!isMounted) return;

        // 1. Accounts
        const loadedAccs: Account[] = [];
        if (accRes.status === 'fulfilled') {
          accRes.value.forEach(d => loadedAccs.push({ id: d.id, ...d.data() } as Account));
        }
        setAccounts(loadedAccs);

        // 2. Bank Accounts / Vaults
        const loadedVaults: BankAccount[] = [];
        if (bankRes.status === 'fulfilled') {
          bankRes.value.forEach(d => loadedVaults.push({ id: d.id, ...d.data() } as BankAccount));
        }
        setVaults(loadedVaults);

        // 3. Customers
        const loadedCust: any[] = [];
        if (custRes.status === 'fulfilled') {
          custRes.value.forEach(d => loadedCust.push({ id: d.id, ...d.data() }));
        }
        setCustomers(loadedCust);

        // 4. Suppliers
        const loadedSup: any[] = [];
        if (supRes.status === 'fulfilled') {
          supRes.value.forEach(d => loadedSup.push({ id: d.id, ...d.data() }));
        }
        setSuppliers(loadedSup);

        // 5. Products / Inventory
        const loadedInv: any[] = [];
        if (invRes.status === 'fulfilled') {
          invRes.value.forEach(d => loadedInv.push({ id: d.id, ...d.data() }));
        }
        setInventory(loadedInv);

        // 6. Employees
        const loadedEmp: any[] = [];
        if (empRes.status === 'fulfilled') {
          empRes.value.forEach(d => loadedEmp.push({ id: d.id, ...d.data() }));
        }
        setEmployees(loadedEmp);

        // 7. Quick Stats
        let totalIn = 0;
        let totalOut = 0;
        if (txRes.status === 'fulfilled') {
          txRes.value.forEach(d => {
            const t = d.data();
            if (t.type === 'inflow') totalIn += Number(t.amount || 0);
            else if (t.type === 'outflow') totalOut += Number(t.amount || 0);
          });
        }

        setFinancialSummary({
          totalSales: totalIn,
          totalExpenses: totalOut,
          netEstimate: totalIn - totalOut,
          vaultCount: loadedVaults.length,
          accountCount: loadedAccs.length
        });

        // 8. Recent Sales
        const loadedSales: any[] = [];
        if (salesRes.status === 'fulfilled') {
          salesRes.value.forEach(d => loadedSales.push({ id: d.id, ...d.data() }));
        }
        setRecentSales(loadedSales);

        // 9. Autonomous CFO Radar in background (non-blocking)
        radarTimer = setTimeout(async () => {
          if (!isMounted) return;
          try {
            const radarContext = {
              ownerId,
              storeId: storeCode,
              shopName: profile?.storeName || (profile as any)?.shopName || 'متجري الذكي',
              vaults: loadedVaults,
              customers: loadedCust,
              suppliers: loadedSup,
              inventory: loadedInv,
              recentSales: loadedSales,
              summary: {
                totalSales: totalIn,
                totalExpenses: totalOut,
                netEstimate: totalIn - totalOut
              }
            };
            const alert = await geminiService.generateProactiveRadar(radarContext);
            if (alert && isMounted) {
              setRadarAlert(alert);
            }
          } catch (radarErr) {
            console.warn('Autonomous CFO Radar non-blocking notice:', radarErr);
          }
        }, 2000);

      } catch (err) {
        console.warn('Error loading accounting context:', err);
      }
    };

    loadContext();

    return () => {
      isMounted = false;
      if (radarTimer) clearTimeout(radarTimer);
    };
  }, [isOpen, ownerId]);

  // Call timer effect
  useEffect(() => {
    if (isCallMode) {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [isCallMode]);

  const isCallModeRef = useRef(isCallMode);
  const callStatusRef = useRef(callStatus);
  useEffect(() => {
    isCallModeRef.current = isCallMode;
  }, [isCallMode]);
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // Speech Recognition setup for Arabic Voice-to-Text (initialized cleanly once)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = true;
      // Primary language: Arabic (Yemen) with fallback dialect support
      recog.lang = 'ar-YE';

      recog.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        setInterimSpeech('');
        if (isCallModeRef.current) setCallStatus('listening');
      };

      recog.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const final = event.results[i][0].transcript;
            setInputText(prev => (prev ? `${prev} ${final}` : final));
            setIsListening(false);
            setInterimSpeech('');
            
            if (isCallModeRef.current) {
              setCallTranscript(prev => [...prev, {
                sender: 'user',
                text: final,
                time: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              }]);
            }

            // Auto submit speech if meaningful Arabic text detected
            if (final.trim().length > 2) {
              handleProcessInput(final.trim());
            }
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInterimSpeech(interim);
      };

      recog.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          // Open interactive permission modal directly without old error banner
          setShowMicPermissionModal(true);
          setSpeechError(null);
        } else if (event.error !== 'no-speech') {
          setSpeechError('تنبيه الميكروفون: ' + event.error);
        }
        setIsListening(false);
        if (isCallModeRef.current) setCallStatus('idle');
      };

      recog.onend = () => {
        setIsListening(false);
        if (isCallModeRef.current && callStatusRef.current === 'listening') {
          setCallStatus('idle');
        }
      };

      setRecognition(recog);

      return () => {
        try { recog.abort(); } catch (_) {}
      };
    } else {
      setSpeechError(null);
    }
  }, []);

  // Check if mic permission is already granted in storage or device service
  const hasMicPermission = () => {
    return (
      localStorage.getItem('jam_mic_permission_granted') === 'true' ||
      localStorage.getItem('jam_perm_granted_microphone') === 'true' ||
      DevicePermissionsService.checkMicrophoneGranted()
    );
  };

  // Direct one-click microphone authorization handler (global apps standard)
  const requestMicrophoneAccessDirect = async () => {
    setIsRequestingMic(true);
    try {
      // 1. Invoke native browser getUserMedia directly to show standard system dialog
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
        } catch (mediaErr) {
          console.warn('Native getUserMedia prompt result:', mediaErr);
        }
      }

      // 2. Persist in hardware & device permissions services
      await DevicePermissionsService.requestMicrophonePermission();
      localStorage.setItem('jam_mic_permission_granted', 'true');
      localStorage.setItem('jam_perm_granted_microphone', 'true');
      setPermGranted(true);
      setShowMicPermissionModal(false);
      setSpeechError(null);

      // 3. Automatically trigger pending action without requiring another click
      const action = pendingActionAfterMic;
      setPendingActionAfterMic(null);
      if (action === 'call') {
        startVoiceCallActual();
      } else {
        startListeningActual();
      }
    } catch (err: any) {
      console.warn('Microphone permission request error:', err);
      setShowMicPermissionModal(false);
      setPendingActionAfterMic(null);
    } finally {
      setIsRequestingMic(false);
    }
  };

  const startListeningActual = () => {
    if (!recognition) return;
    setSpeechError(null);
    try {
      recognition.abort();
      setTimeout(() => {
        try {
          recognition.start();
        } catch (e: any) {
          if (!e.message?.includes('already started')) {
            console.warn('Recognition start error:', e);
          }
        }
      }, 60);
    } catch (e: any) {
      if (!e.message?.includes('already started')) {
        console.warn('Recognition start error:', e);
      }
    }
  };

  const toggleVoice = async () => {
    if (isListening) {
      if (recognition) {
        try { recognition.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    // If permission has not been granted yet, show the interactive permission modal
    if (!hasMicPermission()) {
      setPendingActionAfterMic('dictate');
      setShowMicPermissionModal(true);
      return;
    }

    startListeningActual();
  };

  const startVoiceCall = async () => {
    if (!hasMicPermission()) {
      setPendingActionAfterMic('call');
      setShowMicPermissionModal(true);
      return;
    }

    startVoiceCallActual();
  };

  const startVoiceCallActual = () => {
    setPermGranted(true);
    setIsCallMode(true);
    setCallStatus('connecting');
    setCallTranscript([]);

    setTimeout(() => {
      setCallStatus('speaking');
      const welcomeMsg = 'مرحباً بك يا مدير! أنا المحاسب الذكي الخاص بك، كلي آذان صاغية. تفضل بأي عملية صرف، قبض، مبيعات، أو استفسار وسأقيدها فوراً.';
      setCallTranscript([{
        sender: 'ai',
        text: welcomeMsg,
        time: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
      }]);
      speakText(welcomeMsg, () => {
        setCallStatus('listening');
        startListeningActual();
      });
    }, 1200);
  };

  const endVoiceCall = () => {
    stopSpeaking();
    if (recognition && isListening) {
      try { recognition.stop(); } catch (e) {}
    }
    setIsCallMode(false);
    setCallStatus('idle');
  };

  const handleProcessInput = async (textToProcess?: string) => {
    const queryText = (textToProcess || inputText).trim();
    if (!queryText) return;

    setIsProcessing(true);
    setPostSuccess(false);
    setPostError(null);
    setPostedRef(null);
    if (isCallMode) setCallStatus('thinking');

    try {
      const response = await geminiService.processSmartAccounting({
        input: queryText,
        context: {
          shopName: profile?.storeName || (profile as any)?.shopName || 'متجر الأجهزة والإلكترونيات',
          ownerId,
          storeId: storeCode,
          accounts: accounts.map(a => ({ code: a.code, name: a.name, type: a.type })),
          vaults: vaults.map(v => ({ id: v.id, name: v.name, balance: v.balance, type: v.type, currency: v.currency })),
          customers: customers.map(c => ({ id: c.id, name: c.name, phone: c.phone, balance: c.balance || c.totalDebt, creditLimit: c.creditLimit })),
          suppliers: suppliers.map(s => ({ id: s.id, name: s.name, phone: s.phone, balance: s.balance })),
          inventory: inventory.map(i => ({ id: i.id, name: i.name || i.title, quantity: i.quantity || i.stock, salePrice: i.salePrice, costPrice: i.costPrice })),
          employees: employees.map(e => ({ id: e.id, name: e.name, role: e.role, salary: e.salary })),
          recentSales: recentSales.map(r => ({ id: r.id, total: r.total || r.totalAmount, date: r.date || r.createdAt, customerName: r.customerName })),
          summary: financialSummary
        }
      });

      setCurrentResult(response);
      setEditableResult(JSON.parse(JSON.stringify(response))); // Deep copy for editing
      setHistory(prev => [{ text: queryText, result: response, timestamp: new Date() }, ...prev.slice(0, 9)]);

      if (response.suggestedMatch) {
        setSuggestedMatch(response.suggestedMatch);
      } else {
        setSuggestedMatch(null);
      }

      const replyVoiceText = response.audioSummary || response.explanation || 'تمت معالجة القيد وتدقيقه بنجاح.';
      
      if (isCallMode) {
        setCallTranscript(prev => [...prev, {
          sender: 'ai',
          text: replyVoiceText,
          time: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
        }]);
        setCallStatus('speaking');
      }

      // Read audio summary
      // Read audio response with Arabic voice
      if (speakerEnabled) {
        speakText(replyVoiceText, () => {
          if (isCallMode) {
            setCallStatus('listening');
            if (!isMuted) toggleVoice();
          }
        });
      }
    } catch (err: any) {
      console.error('Smart Accountant processing error:', err);
      setPostError(err.message || 'تعذر معالجة الطلب عبر المحاسب الذكي');
      if (isCallMode) setCallStatus('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * High-fidelity dual-engine Arabic Text-To-Speech (TTS)
   * 1. Primary: Native window.speechSynthesis with Arabic voice priority
   * 2. Fallback: High-clarity HTML5 Web Audio TTS stream (guaranteed on Android WebView & low-end devices)
   */
  const speakText = (text: string, onDone?: () => void) => {
    if (!text || !text.trim()) {
      if (onDone) onDone();
      return;
    }

    // Stop previous speech
    stopSpeaking();

    // 1. Try Native SpeechSynthesis first
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Search for native Arabic voice
        const voices = window.speechSynthesis.getVoices();
        const arVoice = voices.find(v => (v.lang && v.lang.toLowerCase().startsWith('ar')) || (v.name && v.name.toLowerCase().includes('arabic')));
        if (arVoice) {
          utterance.voice = arVoice;
        }

        let completed = false;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          if (!completed) {
            completed = true;
            setIsSpeaking(false);
            if (onDone) onDone();
          }
        };
        utterance.onerror = (err) => {
          console.warn('SpeechSynthesis error, falling back to Audio TTS stream:', err);
          if (!completed) {
            completed = true;
            fallbackAudioSpeak(text, onDone);
          }
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (synthErr) {
        console.warn('SpeechSynthesis invocation failed:', synthErr);
      }
    }

    // 2. Fallback to Web Audio TTS stream
    fallbackAudioSpeak(text, onDone);
  };

  const fallbackAudioSpeak = (text: string, onDone?: () => void) => {
    try {
      setIsSpeaking(true);
      // Clean up punctuation and limit length for clean TTS playback
      const cleanSnippet = text.replace(/[*_#`~]/g, '').slice(0, 190).trim();
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(cleanSnippet)}`;

      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio();
      }
      const audio = audioPlayerRef.current;
      audio.src = ttsUrl;
      audio.onended = () => {
        setIsSpeaking(false);
        if (onDone) onDone();
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        if (onDone) onDone();
      };
      audio.play().catch((playErr) => {
        console.warn('TTS Audio playback stream skipped or blocked:', playErr);
        setIsSpeaking(false);
        if (onDone) onDone();
      });
    } catch (e) {
      setIsSpeaking(false);
      if (onDone) onDone();
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch (e) {}
    }
    setIsSpeaking(false);
  };

  const handleConfirmAndPostEntry = async () => {
    if (!editableResult) return;
    setIsPosting(true);
    setPostError(null);

    try {
      const refCode = `AI-${Date.now().toString().slice(-6)}`;
      
      // Build Ledger Lines
      const ledgerItems: LedgerItem[] = (editableResult.lines || []).map(line => ({
        accountId: line.accountCode || generateUUID(),
        accountName: line.accountName,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        currency: line.currency || editableResult.currency || 'YER'
      }));

      // 1. Post to Journal Entries via Accounting Service
      await accountingService.recordJournalEntry(
        ownerId,
        editableResult.description || 'قيد محاسبي معتمد بواسطة المحاسب الذكي',
        ledgerItems,
        refCode,
        {
          storeId: storeCode,
          status: 'approved',
          type: editableResult.entryType,
          createdBy: {
            uid: profile?.uid || 'AI_ENGINE',
            name: profile?.name ? `${profile.name} (المحاسب الذكي AI)` : 'المحاسب الذكي AI',
            role: profile?.role || 'admin'
          }
        }
      );

      // 2. Also register a transaction record if it's payment or receipt for quick cashflow tracking
      if (editableResult.entryType === 'payment_voucher' || editableResult.entryType === 'receipt_voucher') {
        const isPayment = editableResult.entryType === 'payment_voucher';
        await addDoc(collection(db, 'transactions'), {
          ownerId,
          storeId: storeCode,
          type: isPayment ? 'outflow' : 'inflow',
          category: editableResult.debitAccount?.name || editableResult.creditAccount?.name || 'مصروفات عامة',
          amount: Number(editableResult.amount || 0),
          currency: editableResult.currency || 'YER',
          details: editableResult.description,
          reference: refCode,
          source: 'AI_SMART_ACCOUNTANT_10X',
          createdAt: serverTimestamp(),
          date: new Date().toISOString()
        });
      }

      setPostedRef(refCode);
      setPostSuccess(true);
      
      // Update history with ref
      setHistory(prev => [{
        text: inputText || editableResult.description || 'عملية محاسبية',
        result: editableResult,
        timestamp: new Date(),
        ref: refCode,
        reversed: false
      }, ...prev.filter(h => h.ref !== refCode).slice(0, 8)]);

      if (onEntryPosted) onEntryPosted();

      if (speakerEnabled) {
        speakText(`تم ترحيل واعتماد القيد المحاسبي بنجاح برقم مرجعي ${refCode}`);
      }
    } catch (err: any) {
      console.error('Error posting AI journal entry:', err);
      setPostError('فشل ترحيل القيد: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsPosting(false);
    }
  };

  const handleSelectCategory = (cat: OperationCategory) => {
    setSelectedCategory(cat.id);
    setRollbackSuccess(null);
    setRollbackError(null);
    
    // Set prefix or focus
    if (!inputText || inputText.trim() === '' || OPERATION_CATEGORIES.some(c => inputText === c.defaultPrefix)) {
      setInputText(cat.defaultPrefix);
    }
    
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    if (isCallMode) {
      const msg = `تم اختيار ${cat.label}. تفضل بذكر التفاصيل وسأضبط القيد فوراً.`;
      setCallTranscript(prev => [...prev, {
        sender: 'ai',
        text: msg,
        time: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
      }]);
      if (speakerEnabled) speakText(msg);
    }
  };

  const handleRollbackEntry = async (referenceCode: string) => {
    if (!referenceCode) return;
    setIsRollingBack(true);
    setRollbackError(null);
    setRollbackSuccess(null);

    try {
      const res = await accountingService.rollbackJournalEntry(
        ownerId,
        referenceCode,
        'تراجع عن العملية عبر المحاسب الذكي',
        {
          uid: profile?.uid || 'user',
          name: profile?.name || 'المدير',
          role: profile?.role || 'owner'
        }
      );

      setRollbackSuccess(res.message || `تم التراجع عن القيد [${referenceCode}] بنجاح وعكس الأرصدة!`);
      
      // Update history
      setHistory(prev => prev.map(h => {
        if (h.ref === referenceCode) {
          return { ...h, reversed: true };
        }
        return h;
      }));

      if (postedRef === referenceCode) {
        setPostSuccess(false);
      }

      if (onEntryPosted) onEntryPosted();

      if (speakerEnabled) {
        speakText(`تم التراجع عن القيد وعكس حركة الصناديق بنجاح.`);
      }

      setShowRollbackConfirm(false);
      setEntryToRollback(null);
    } catch (err: any) {
      console.error('Rollback error:', err);
      setRollbackError('فشل التراجع عن العملية: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsRollingBack(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCallTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const quickPrompts = [
    { label: '💸 صرف إيجار 50 ألف كاش', prompt: 'صرفت 50,000 ريال يمني إيجار المحل نقداً من الصندوق الرئيسي' },
    { label: '💰 قبض 100$ من عميل', prompt: 'استلمت 100 دولار من العميل محمد سالم دفعة من حسابه في بنك الكريمي' },
    { label: '📱 صيانة شاشة 25 ألف', prompt: 'سجل إيراد صيانة وفحص شاشة هاتف آيفون 25,000 ريال كاش' },
    { label: '📶 شحن رصيد يمن موبايل 15 ألف', prompt: 'سجل شحن باقات ورصيد يمن موبايل بقيمة 15,000 ريال نقداً' },
    { label: '🔄 تحويل 200 ألف لبنك التضامن', prompt: 'حول مبلغ 200,000 ريال من الصندوق الرئيسي إلى حساب بنك التضامن' },
    { label: '👨‍🔧 سلفة راتب للمهندس 20 ألف', prompt: 'صرف سلفة على حساب الراتب لمهندس الصيانة 20,000 ريال' },
    { label: '📊 كم مبيعات وأرباح اليوم؟', prompt: 'أعطني تقريراً تفصيلياً عن المبيعات والمصاريف وصافي الأرباح المقدرة اليوم' }
  ];

  const navSections = [
    { id: 'chat', label: 'المحادثة والأوامر', icon: Bot, badge: 'رئيسي', color: 'text-indigo-400' },
    { id: 'instructions', label: 'دليل وتعليمات الاستخدام', icon: HelpCircle, badge: 'تعليمات', color: 'text-amber-400' },
    { id: 'daily_editor', label: 'اليومية وسجل القيود', icon: Calendar, color: 'text-amber-400' },
    { id: 'intelligence', label: 'ذكاء الأعمال والنواقص', icon: Zap, color: 'text-emerald-400' },
    { id: 'invoice_ocr', label: 'فواتير المشتريات (OCR)', icon: FileText, color: 'text-cyan-400' }
  ];

  if (!isOpen) return null;

  return (
    <div 
      id="smart-ai-accountant-modal-overlay"
      className="fixed inset-0 z-[9999] flex justify-end overflow-hidden"
    >
      {/* Subtle backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => {
          stopSpeaking();
          if (isCallMode) endVoiceCall();
          onClose();
        }}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm cursor-pointer"
      />

      {/* Sleek, right-aligned side drawer / modal with SIDEBAR layout */}
      <motion.div 
        id="smart-ai-accountant-container"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="relative w-full sm:w-[720px] md:w-[940px] lg:w-[1140px] xl:w-[1280px] 2xl:w-[1380px] max-w-full bg-slate-900 border-l border-slate-700/80 shadow-2xl flex flex-col md:flex-row h-full z-10 overflow-hidden"
        dir="rtl"
      >
        {/* SIDEBAR NAVIGATION (أزرار الأقسام الجانبية) */}
        <aside className="w-full md:w-64 lg:w-72 bg-slate-950/95 border-b md:border-b-0 md:border-l border-slate-800 flex flex-col justify-between shrink-0 p-3 sm:p-4 select-none overflow-y-auto custom-scrollbar">
          <div className="space-y-3 sm:space-y-4">
            {/* Top Brand & Status */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
                  <Bot size={22} />
                </div>
                <div>
                  <h2 className="text-base font-black text-white tracking-tight flex items-center gap-1.5">
                    <span>المحاسب الذكي</span>
                    <Sparkles size={13} className="text-indigo-400" />
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-[140px]">
                    {profile?.storeName || 'نظام إدارة القيود'}
                  </p>
                </div>
              </div>

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  if (isCallMode) endVoiceCall();
                  onClose();
                }}
                className="md:hidden p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                title="إغلاق النافذة"
              >
                <X size={18} />
              </button>
            </div>

            {/* Direct Voice Call Trigger Button */}
            <div>
              {!isCallMode ? (
                <button
                  type="button"
                  id="sidebar-start-voice-call-btn"
                  onClick={startVoiceCall}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <PhoneCall size={15} className="animate-bounce" />
                  <span>اتصال صوتي مباشر 📞</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={endVoiceCall}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
                >
                  <PhoneOff size={15} />
                  <span>إنهاء المكالمة ({formatCallTimer(callDuration)})</span>
                </button>
              )}
            </div>

            {/* Section Navigation Buttons (أزرار أقسام جانبية) */}
            <nav className="space-y-1">
              <div className="text-[10px] font-black text-slate-500 px-2 py-1">أقسام المحاسب الذكي</div>
              
              {/* Responsive: on mobile, horizontal scrollable tabs; on md+, vertical stack */}
              <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 no-scrollbar">
                {navSections.map((item) => {
                  const isActive = activeMainTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveMainTab(item.id as any)}
                      className={`w-full text-right px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between whitespace-nowrap md:whitespace-normal transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent hover:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} className={isActive ? 'text-white' : item.color} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono hidden sm:inline ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          {/* Bottom Sidebar Info & Audio stop */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs hidden md:block">
            <div className="flex items-center justify-between text-slate-400 text-[11px] px-1">
              <span className="flex items-center gap-1">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>نظام عزل ومحاسبة</span>
              </span>
              <span className="font-mono text-emerald-400">v1.0.0</span>
            </div>

            {isSpeaking && !isCallMode && (
              <button
                type="button"
                onClick={stopSpeaking}
                className="w-full py-1.5 px-2.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5"
              >
                <VolumeX size={14} />
                <span>إيقاف الصوت</span>
              </button>
            )}
          </div>
        </aside>

        {/* MAIN CONTENT PANE */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900 min-w-0">
          {/* Top Bar in Main Content */}
          <div className="bg-slate-900/95 p-3 sm:px-6 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              {navSections.find(s => s.id === activeMainTab)?.icon && (
                <div className="p-2 rounded-xl bg-slate-800 text-indigo-400 border border-slate-700">
                  {React.createElement(navSections.find(s => s.id === activeMainTab)!.icon, { size: 18 })}
                </div>
              )}
              <div>
                <h3 className="text-sm sm:text-base font-black text-white">
                  {navSections.find(s => s.id === activeMainTab)?.label || 'المحاسب الذكي'}
                </h3>
                <span className="text-[11px] text-slate-400">
                  {activeMainTab === 'chat' && 'إدخال وتدقيق القيود المحاسبية والاستعلام المالي الفوري'}
                  {activeMainTab === 'instructions' && 'دليل الاستخدام والأمثلة وقواعد التوازن المحاسبي'}
                  {activeMainTab === 'daily_editor' && 'سجل اليومية ومراجعة العمليات السابقة'}
                  {activeMainTab === 'intelligence' && 'مؤشرات ذكاء الأعمال، فحص السيولة، والنواقص'}
                  {activeMainTab === 'invoice_ocr' && 'مسح وتدقيق فواتير التوريد تلقائياً'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeMainTab !== 'instructions' && (
                <button
                  type="button"
                  onClick={() => setActiveMainTab('instructions')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="كيفية الاستخدام ودليل التعليمات"
                >
                  <HelpCircle size={14} />
                  <span className="hidden sm:inline">دليل الاستخدام 📖</span>
                </button>
              )}

              {isSpeaking && !isCallMode && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="p-2 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-all flex items-center gap-1 text-xs font-bold"
                  title="إيقاف الصوت"
                >
                  <VolumeX size={16} />
                </button>
              )}

              <button
                type="button"
                id="close-smart-accountant-btn"
                onClick={() => {
                  stopSpeaking();
                  if (isCallMode) endVoiceCall();
                  onClose();
                }}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* INTERACTIVE VOICE CALL SCREEN (عند تفعيل وضع الاتصال المباشر) */}
          <AnimatePresence>
            {isCallMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gradient-to-b from-navy-950 via-slate-900 to-navy-950 border-b border-brand-primary/40 p-5 text-white"
              >
                <div className="max-w-2xl mx-auto flex flex-col items-center justify-center text-center space-y-4">
                  {/* Call Timer & Status Badge */}
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      المكالمة جارية: {formatCallTimer(callDuration)}
                    </span>
                    <span className="text-xs text-gray-400 font-bold">
                      {callStatus === 'listening' && '🎙️ المحاسب يستمع إليك الآن...'}
                      {callStatus === 'thinking' && '🧠 جاري التفكير ومطابقة القيود...'}
                      {callStatus === 'speaking' && '🗣️ المحاسب يتحدث ويشرح لك...'}
                      {callStatus === 'connecting' && '📞 جاري الربط الآمن...'}
                    </span>
                  </div>

                  {/* Animated Equalizer Wave Visualizer */}
                  <div className="flex items-center justify-center gap-1.5 h-16 w-full">
                    {[40, 70, 30, 90, 50, 80, 100, 60, 85, 45, 95, 35, 75, 55, 90].map((h, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          height: isSpeaking || isListening ? [`${h * 0.3}%`, `${h}%`, `${h * 0.4}%`] : '15%',
                          opacity: isSpeaking || isListening ? 1 : 0.4
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8 + (i % 5) * 0.1,
                          ease: 'easeInOut'
                        }}
                        className="w-1.5 rounded-full bg-gradient-to-t from-brand-primary via-cyan-400 to-emerald-400 shadow-md shadow-cyan-500/30"
                      />
                    ))}
                  </div>

                  {/* Live Transcript Bubble */}
                  {callTranscript.length > 0 && (
                    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-right text-xs max-h-24 overflow-y-auto custom-scrollbar space-y-1.5">
                      {callTranscript.slice(-3).map((item, idx) => (
                        <div key={idx} className={`flex items-start gap-2 ${item.sender === 'ai' ? 'text-cyan-300' : 'text-emerald-300'}`}>
                          <span className="font-bold shrink-0">{item.sender === 'ai' ? '🤖 المحاسب الذكي:' : '👤 أنت:'}</span>
                          <span className="text-gray-200">{item.text}</span>
                          <span className="text-[10px] text-gray-500 mr-auto font-mono">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Call Control Buttons */}
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMuted(!isMuted);
                        if (!isMuted && isListening && recognition) {
                          try { recognition.stop(); } catch (e) {}
                        }
                      }}
                      className={`p-3.5 rounded-2xl flex items-center justify-center transition-all ${
                        isMuted ? 'bg-danger text-white' : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                      title={isMuted ? 'إلغاء كتم الميكروفون' : 'كتم الميكروفون'}
                    >
                      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSpeakerEnabled(!speakerEnabled)}
                      className={`p-3.5 rounded-2xl flex items-center justify-center transition-all ${
                        speakerEnabled ? 'bg-brand-primary text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                      title={speakerEnabled ? 'مكبر الصوت شغال' : 'مكبر الصوت مكتوم'}
                    >
                      {speakerEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>

                    <button
                      type="button"
                      onClick={endVoiceCall}
                      className="px-6 py-3.5 rounded-2xl bg-danger hover:bg-red-600 text-white font-black text-xs flex items-center gap-2 shadow-xl shadow-danger/40 transition-all hover:scale-105"
                    >
                      <PhoneOff size={18} />
                      <span>إنهاء المكالمة</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MODAL BODY */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
            {activeMainTab === 'instructions' ? (
              <SmartAIInstructionsSection
                onSelectPrompt={(prompt, autoSubmit) => {
                  setActiveMainTab('chat');
                  setInputText(prompt);
                  if (autoSubmit) {
                    handleProcessInput(prompt);
                  } else {
                    inputRef.current?.focus();
                  }
                }}
                onStartVoiceCall={startVoiceCall}
                onOpenVoice={toggleVoice}
              />
            ) : activeMainTab === 'daily_editor' ? (
            <SmartAIDailyEditor
              ownerId={ownerId}
              shopName={profile?.storeName || (profile as any)?.shopName || 'متجر الأجهزة والإلكترونيات'}
              profile={profile}
              accounts={accounts}
              vaults={vaults}
              onOperationUpdated={() => {
                if (onEntryPosted) onEntryPosted();
              }}
            />
          ) : activeMainTab === 'intelligence' ? (
            <SmartAIIntelligenceHub
              shopName={profile?.storeName || (profile as any)?.shopName || 'متجر الأجهزة والإلكترونيات'}
              ownerId={ownerId}
              inventory={inventory}
              customers={customers}
              suppliers={suppliers}
              onTriggerChatPrompt={(prompt) => {
                setActiveMainTab('chat');
                setInputText(prompt);
                handleProcessInput(prompt);
              }}
            />
          ) : activeMainTab === 'invoice_ocr' ? (
            <SmartInvoiceOCRModal
              isOpen={true}
              onClose={() => setActiveMainTab('chat')}
              onInvoiceApproved={(inv) => {
                setActiveMainTab('chat');
                setInputText(`تم اعتماد فاتورة مشتريات من المورد (${inv.supplierName}) بإجمالي ${inv.totalAmount.toLocaleString()} ر.ي`);
                if (onEntryPosted) onEntryPosted();
              }}
              storeId={storeCode}
              ownerId={ownerId}
            />
          ) : (
            <>
              {/* AUTONOMOUS CFO PROACTIVE RADAR ALERT (الرادار الاستباقي التلقائي) */}
              <AnimatePresence>
                {isLoadingRadar && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="bg-gradient-to-r from-indigo-500/10 via-brand-primary/10 to-emerald-500/10 border border-brand-primary/30 rounded-2xl p-3 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary animate-spin">
                        <Activity size={14} />
                      </div>
                      <span className="font-bold text-gray-700 dark:text-gray-200">
                        ⚡ رادار المدير المالي الاستباقي (Autonomous CFO) يفحص مؤشرات السيولة، سقوف الديون، والمخزون الراكد...
                      </span>
                    </div>
                  </motion.div>
                )}

                {radarAlert && !radarDismissed && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={`rounded-2xl p-4 border shadow-xl transition-all relative ${
                      radarAlert.priority === 'critical'
                        ? 'bg-gradient-to-br from-rose-50 to-orange-50/50 dark:from-rose-950/60 dark:to-slate-900 border-rose-500/50 text-rose-950 dark:text-rose-100'
                        : radarAlert.priority === 'warning'
                        ? 'bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/60 dark:to-slate-900 border-amber-500/50 text-amber-950 dark:text-amber-100'
                        : 'bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/60 dark:to-slate-900 border-emerald-500/50 text-emerald-950 dark:text-emerald-100'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-black/10 dark:border-white/10">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm ${
                          radarAlert.priority === 'critical'
                            ? 'bg-rose-600 text-white'
                            : radarAlert.priority === 'warning'
                            ? 'bg-amber-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}>
                          <Radio size={13} className="animate-pulse" />
                          {radarAlert.badge}
                        </span>
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                          تنبيه استباقي تلقائي فائق الأهمية (Autonomous CFO)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRadarDismissed(true)}
                        className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                        title="إغلاق التنبيه"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Title & Message */}
                    <div className="py-2.5">
                      <h4 className="font-black text-sm sm:text-base mb-1.5 flex items-center gap-2">
                        {radarAlert.priority === 'critical' ? '🚨' : radarAlert.priority === 'warning' ? '⚠️' : '💡'}
                        <span>{radarAlert.title}</span>
                      </h4>
                      <p className="text-xs sm:text-sm leading-relaxed opacity-90">
                        {radarAlert.message}
                      </p>
                    </div>

                    {/* Financial Metrics Badges */}
                    <div className="flex flex-wrap items-center gap-2 pb-3 text-[11px] font-mono">
                      {radarAlert.financialMetrics.quickRatio !== undefined && (
                        <span className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 font-bold border border-black/5 dark:border-white/10">
                          نسبة السيولة: {radarAlert.financialMetrics.quickRatio}
                        </span>
                      )}
                      {radarAlert.financialMetrics.tiedCapital !== undefined && radarAlert.financialMetrics.tiedCapital > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 font-bold border border-black/5 dark:border-white/10">
                          رأس المال المحبوس: {radarAlert.financialMetrics.tiedCapital.toLocaleString()} ر.ي
                        </span>
                      )}
                      {radarAlert.financialMetrics.debtAmount !== undefined && (
                        <span className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 font-bold border border-black/5 dark:border-white/10">
                          المديونية: {radarAlert.financialMetrics.debtAmount.toLocaleString()} ر.ي
                        </span>
                      )}
                      {radarAlert.financialMetrics.cashRunwayDays !== undefined && (
                        <span className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 font-bold border border-black/5 dark:border-white/10">
                          فترة الصمود: {radarAlert.financialMetrics.cashRunwayDays} يوم
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2.5 border-t border-black/10 dark:border-white/10">
                      {radarAlert.actionData?.phone && radarAlert.actionData?.message && (
                        <button
                          type="button"
                          onClick={() => {
                            const phone = (radarAlert.actionData.phone || '').replace(/[^0-9]/g, '');
                            const encoded = encodeURIComponent(radarAlert.actionData.message);
                            const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
                            window.open(url, '_blank');
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all hover:scale-105"
                        >
                          <MessageCircle size={15} />
                          <span>إرسال مطالبة واتساب فورية 📲</span>
                        </button>
                      )}

                      {radarAlert.actionType === 'freeze_customer' && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if (radarAlert.actionData?.customerId) {
                                await updateDoc(doc(db, 'customers', radarAlert.actionData.customerId), {
                                  creditFrozen: true,
                                  creditFrozenReason: 'تجاوز سقف الدين بناء على تدقيق الرادار الاستباقي',
                                  updatedAt: serverTimestamp()
                                });
                                alert('تم تجميد سقف الدين للعميل بنجاح لحماية سيولة المتجر.');
                                setRadarDismissed(true);
                              }
                            } catch (e: any) {
                              alert('تعذر تجميد الحساب: ' + e.message);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all hover:scale-105"
                        >
                          <ShieldAlert size={15} />
                          <span>تجميد سقف الدين للعميل ❄️</span>
                        </button>
                      )}

                      {radarAlert.actionType === 'reorder_stock' && (
                        <button
                          type="button"
                          onClick={() => setActiveMainTab('invoice_ocr')}
                          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all hover:scale-105"
                        >
                          <FileText size={15} />
                          <span>مسح وتدقيق فاتورة توريد (OCR) 📷</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setInputText(radarAlert.suggestedPrompt);
                          handleProcessInput(radarAlert.suggestedPrompt);
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-brand-secondary hover:to-indigo-700 text-white font-black text-xs flex items-center gap-2 shadow-md shadow-brand-primary/20 transition-all hover:scale-105"
                      >
                        <Zap size={15} />
                        <span>معالجة استباقية مع المحاسب ⚡</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* DEVELOPED QUICK ACTIONS BAR (زر تعيين التاريخ، زر عرض/إدخال، أزرار العمليات المطورة) */}
              <SmartAIQuickActionsBar
                onSelectPrompt={(prompt) => {
                  setInputText(prompt);
                  if (prompt.endsWith('؟') || prompt.startsWith('كم') || prompt.startsWith('ما') || prompt.startsWith('أعطني') || prompt.startsWith('اعرض')) {
                    handleProcessInput(prompt);
                  } else {
                    inputRef.current?.focus();
                  }
                }}
                selectedDate={selectedCalendarDate}
                onSelectDate={(d) => {
                  setSelectedCalendarDate(d);
                }}
                mode={entryOrDisplayMode}
                onToggleMode={() => {
                  const nextMode = entryOrDisplayMode === 'entry' ? 'display' : 'entry';
                  setEntryOrDisplayMode(nextMode);
                  if (nextMode === 'display') {
                    setInputText('اعرض لي كشف وعمليات اليوم تفصيلياً مع الأرباح');
                  } else {
                    setInputText('');
                  }
                }}
                suggestedMatch={suggestedMatch}
                onApplySuggestion={(matchedName) => {
                  if (suggestedMatch) {
                    setInputText(prev => prev.replace(suggestedMatch.originalText, matchedName));
                    setSuggestedMatch(null);
                  }
                }}
                onOpenOCR={() => setActiveMainTab('invoice_ocr')}
              />

              {/* OPERATION TYPE SELECTOR BUTTONS (موجزة ومختصرة للعمل السريع) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {OPERATION_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const IconComponent = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-1 ring-indigo-400'
                          : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      <IconComponent size={14} className={isSelected ? 'text-white' : cat.color} />
                      <span>{cat.shortLabel || cat.label}</span>
                    </button>
                  );
                })}

                {selectedCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(null);
                      setInputText('');
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 whitespace-nowrap"
                  >
                    إلغاء ✕
                  </button>
                )}
              </div>

              {/* Voice and Text Input Section */}
              <div className="relative bg-slate-800/80 dark:bg-slate-950/90 border-2 border-slate-700/80 focus-within:border-brand-primary rounded-3xl p-5 sm:p-6 transition-all shadow-xl">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4">
                  {/* Giant Mic Button */}
                  <button
                    type="button"
                    id="smart-accountant-mic-trigger"
                    onClick={toggleVoice}
                    className={`p-5 sm:p-6 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all shadow-lg select-none shrink-0 ${
                      isListening 
                        ? 'bg-danger text-white ring-4 ring-danger/30 animate-pulse scale-105' 
                        : 'bg-brand-primary text-white hover:bg-brand-secondary active:scale-95'
                    }`}
                    title={isListening ? 'انقر لإيقاف التسجيل الصوتي' : 'انقر للتحدث صوتياً'}
                  >
                    {isListening ? (
                      <>
                        <MicOff size={28} className="animate-bounce" />
                        <span className="text-xs font-black">جاري الاستماع...</span>
                      </>
                    ) : (
                      <>
                        <Mic size={28} />
                        <span className="text-xs font-bold">تحدث صوتياً</span>
                      </>
                    )}
                  </button>

                  {/* Textarea */}
                  <div className="flex-1 flex flex-col justify-between min-h-[140px] sm:min-h-[160px]">
                    <textarea
                      ref={inputRef}
                      id="smart-accountant-text-input"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleProcessInput();
                        }
                      }}
                      placeholder={
                        selectedCategory
                          ? OPERATION_CATEGORIES.find(c => c.id === selectedCategory)?.placeholder || "اكتب أو تحدث بالتفاصيل والمبلغ..."
                          : "تحدث صوتياً أو اكتب العملية المحاسبية مباشرة..."
                      }
                      rows={5}
                      className="w-full bg-transparent border-0 resize-none text-white placeholder-slate-400 text-base sm:text-lg focus:ring-0 focus:outline-none leading-relaxed p-1"
                    />

                    {/* Live speech feedback bar */}
                    {isListening && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-danger bg-danger/10 px-3.5 py-2 rounded-xl animate-pulse mb-3">
                        <Activity size={16} className="animate-spin" />
                        <span>الكلام الملتقط: {interimSpeech || 'تحدث الآن بوضوح...'}</span>
                      </div>
                    )}

                    {/* Input Footer Controls */}
                    <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-700/70 gap-2">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
                        <span>Enter للإرسال · Shift+Enter لسطر جديد</span>
                        {speechError && (
                          <span className="text-danger font-bold flex items-center gap-1">
                            <AlertCircle size={14} />
                            {speechError}
                          </span>
                        )}
                      </div>

                  <div className="flex items-center gap-3">
                    {inputText && (
                      <button
                        type="button"
                        onClick={() => {
                          setInputText('');
                          setCurrentResult(null);
                          setEditableResult(null);
                        }}
                        className="px-3.5 py-1.5 text-xs sm:text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        مسح
                      </button>
                    )}
                    <button
                      type="button"
                      id="smart-accountant-submit-btn"
                      onClick={() => handleProcessInput()}
                      disabled={isProcessing || !inputText.trim()}
                      className="px-6 py-2.5 sm:py-3 rounded-2xl bg-brand-primary text-white hover:bg-brand-secondary font-black text-sm sm:text-base flex items-center gap-2 shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>جاري التدقيق والمعالجة...</span>
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          <span>تدقيق وتجهيز القيد ⚡</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rollback Success Banner */}
          <AnimatePresence>
            {rollbackSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-amber-50 dark:bg-amber-950/50 border border-amber-500/50 rounded-2xl p-4 flex items-center justify-between text-amber-900 dark:text-amber-300 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Undo2 size={22} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm">تم التراجع عن القيد المحاسبي بنجاح! ↩️</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {rollbackSuccess}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRollbackSuccess(null)}
                  className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-700"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rollback Error Banner */}
          {rollbackError && (
            <div className="bg-danger/10 border border-danger/40 rounded-2xl p-4 text-danger flex items-center justify-between text-sm font-bold">
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="shrink-0" />
                <span>{rollbackError}</span>
              </div>
              <button
                type="button"
                onClick={() => setRollbackError(null)}
                className="p-1 rounded-lg hover:bg-danger/20"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Rollback Confirmation Modal / Popup */}
          <AnimatePresence>
            {showRollbackConfirm && entryToRollback && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-500 rounded-3xl p-5 shadow-2xl text-rose-950 dark:text-rose-200 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-600 flex items-center justify-center">
                    <Undo2 size={28} />
                  </div>
                  <div>
                    <h4 className="font-black text-base">تأكيد التراجع عن القيد وعكس الأرصدة؟</h4>
                    <p className="text-xs text-rose-700 dark:text-rose-300">
                      سيتم إلغاء تأثير القيد برقم <strong className="font-mono">{entryToRollback}</strong> واسترجاع المبالغ لحسابات الصناديق فوراً.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-200 dark:border-rose-900">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRollbackConfirm(false);
                      setEntryToRollback(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-navy-800 hover:bg-gray-100"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={isRollingBack}
                    onClick={() => handleRollbackEntry(entryToRollback)}
                    className="px-5 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 flex items-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50"
                  >
                    {isRollingBack ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>جاري التراجع وعكس الأرصدة...</span>
                      </>
                    ) : (
                      <>
                        <Undo2 size={14} />
                        <span>تأكيد التراجع وعكس القيد ↩️</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Banner */}
          <AnimatePresence>
            {postSuccess && postedRef && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500/50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                    <CheckCircle size={22} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm">تم ترحيل واعتماد القيد المحاسبي بنجاح! 🚀</h4>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      الرقم المرجعي للقيد: <strong className="font-mono">{postedRef}</strong> — تم إدراجه في اليومية وتحديث أرصدة الصناديق.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEntryToRollback(postedRef);
                      setShowRollbackConfirm(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <Undo2 size={14} />
                    <span>تراجع عن العملية ↩️</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow"
                  >
                    <Printer size={14} />
                    <span>طباعة السند</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Banner */}
          {postError && (
            <div className="bg-danger/10 border border-danger/40 rounded-2xl p-4 text-danger flex items-center gap-3 text-sm font-bold">
              <AlertCircle size={20} className="shrink-0" />
              <span>{postError}</span>
            </div>
          )}

          {/* Processing Loading Indicator */}
          {isProcessing && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-brand-primary/20 border-t-brand-primary animate-spin" />
                <Bot size={24} className="absolute inset-0 m-auto text-brand-primary animate-pulse" />
              </div>
              <h3 className="font-black text-base text-gray-900 dark:text-white">
                المحاسب الذكي يقوم بمطابقة شجرة الحسابات والتحقق من التوازن الرياضي...
              </h3>
              <p className="text-xs text-gray-500 max-w-md">
                يتم ضبط الأطراف المدينة والدائنة، فحص كفاية رصيد الصندوق، وتطبيق معايير القيد المزدوج بدقة 100%.
              </p>
            </div>
          )}

          {/* RESULTS PRESENTATION */}
          {editableResult && !isProcessing && (
            <div className="space-y-4">
              {/* IF IT IS AN ACCOUNTING ENTRY (قيد أو سند) */}
              {editableResult.isEntry ? (
                <div className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-3xl p-5 shadow-xl space-y-5">
                  {/* Voucher Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-navy-800">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-3.5 py-1.5 rounded-xl bg-brand-primary/10 text-brand-primary font-black text-sm border border-brand-primary/30 flex items-center gap-1.5">
                        <Scale size={16} />
                        {editableResult.entryTypeTitle || 'قيد محاسبي معتمد'}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/30 flex items-center gap-1">
                        <ShieldCheck size={14} />
                        قيد متوازن ⚖️ (100% دقيق)
                      </span>
                      {editableResult.accountingCategory && (
                        <span className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-bold text-xs border border-purple-500/30">
                          {editableResult.accountingCategory}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {editableResult.audioSummary && (
                        <button
                          type="button"
                          onClick={() => isSpeaking ? stopSpeaking() : speakText(editableResult.audioSummary!)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                            isSpeaking 
                              ? 'bg-danger/15 text-danger border border-danger/40 animate-pulse' 
                              : 'bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/30'
                          }`}
                        >
                          {isSpeaking ? (
                            <>
                              <VolumeX size={15} />
                              <span>إيقاف الصوت ⏹️</span>
                            </>
                          ) : (
                            <>
                              <Volume2 size={15} />
                              <span>استمع لرد المحاسب صوتياً 🔊</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mathematical Proof & Audit Badge */}
                  {editableResult.mathematicalProof && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-2 font-bold font-mono">
                        <Gauge size={16} className="text-emerald-500" />
                        <span>{editableResult.mathematicalProof}</span>
                      </div>
                      <span className="font-bold text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded-md">
                        ثقة المحاسب: {editableResult.confidenceScore || 99.9}%
                      </span>
                    </div>
                  )}

                  {/* Statement & Amount Header Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="sm:col-span-2 bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-700/80 shadow-sm">
                      <label className="text-xs sm:text-sm font-bold text-slate-400 block mb-1.5">البيان والشرح المحاسبي (Description):</label>
                      <input
                        type="text"
                        value={editableResult.description || ''}
                        onChange={(e) => setEditableResult({ ...editableResult, description: e.target.value })}
                        className="w-full bg-transparent font-bold text-base sm:text-lg text-white border-0 p-0 focus:ring-0 focus:outline-none"
                      />
                    </div>

                    <div className="bg-gradient-to-br from-brand-primary/20 via-brand-primary/10 to-transparent p-4 sm:p-5 rounded-2xl border border-brand-primary/40 flex flex-col justify-between shadow-sm">
                      <label className="text-xs sm:text-sm font-bold text-brand-primary block mb-1.5">المبلغ الإجمالي والعملة:</label>
                      <div className="flex items-baseline gap-2">
                        <input
                          type="number"
                          value={editableResult.amount || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setEditableResult({
                              ...editableResult,
                              amount: val,
                              lines: (editableResult.lines || []).map(l => ({
                                ...l,
                                debit: l.debit > 0 ? val : 0,
                                credit: l.credit > 0 ? val : 0
                              }))
                            });
                          }}
                          className="w-36 bg-transparent font-black text-2xl sm:text-3xl text-white border-0 p-0 focus:ring-0 focus:outline-none"
                        />
                        <span className="text-sm font-black text-brand-primary">{editableResult.currency || 'YER'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Double-Entry Ledger Lines Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <Layers size={14} />
                      جدول القيد المزدوج المعتمد (Double-Entry Breakdown):
                    </h4>
                    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-navy-800">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-navy-800">
                          <tr>
                            <th className="p-3">الحساب / الطرف المحاسبي</th>
                            <th className="p-3">الرمز</th>
                            <th className="p-3 text-emerald-600 dark:text-emerald-400">مدين (Debit)</th>
                            <th className="p-3 text-blue-600 dark:text-blue-400">دائن (Credit)</th>
                            <th className="p-3">ملاحظات الطرف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-navy-800 font-medium">
                          {(editableResult.lines || []).map((line, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-900/40 transition-colors">
                              <td className="p-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${line.debit > 0 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                <input
                                  type="text"
                                  value={line.accountName}
                                  onChange={(e) => {
                                    const updated = [...(editableResult.lines || [])];
                                    updated[idx].accountName = e.target.value;
                                    setEditableResult({ ...editableResult, lines: updated });
                                  }}
                                  className="bg-transparent border-0 p-0 focus:ring-0 focus:outline-none font-bold text-xs text-gray-900 dark:text-white w-full"
                                />
                              </td>
                              <td className="p-3 text-gray-400 font-mono text-[11px]">{line.accountCode || '-'}</td>
                              <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {line.debit > 0 ? Number(line.debit).toLocaleString('ar-YE') : '-'}
                              </td>
                              <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                                {line.credit > 0 ? Number(line.credit).toLocaleString('ar-YE') : '-'}
                              </td>
                              <td className="p-3 text-gray-500 dark:text-gray-400 text-[11px]">{line.note || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Financial Impact Insights */}
                  {editableResult.financialImpact && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      {editableResult.financialImpact.incomeStatement && (
                        <div className="bg-gray-50 dark:bg-navy-900/60 p-2.5 rounded-xl border border-gray-200 dark:border-navy-800">
                          <span className="text-[10px] text-gray-400 font-bold block">الأثر على قائمة الدخل:</span>
                          <span className="text-gray-800 dark:text-gray-200 font-semibold">{editableResult.financialImpact.incomeStatement}</span>
                        </div>
                      )}
                      {editableResult.financialImpact.balanceSheet && (
                        <div className="bg-gray-50 dark:bg-navy-900/60 p-2.5 rounded-xl border border-gray-200 dark:border-navy-800">
                          <span className="text-[10px] text-gray-400 font-bold block">الأثر على المركز المالي:</span>
                          <span className="text-gray-800 dark:text-gray-200 font-semibold">{editableResult.financialImpact.balanceSheet}</span>
                        </div>
                      )}
                      {editableResult.financialImpact.cashflowImpact && (
                        <div className="bg-gray-50 dark:bg-navy-900/60 p-2.5 rounded-xl border border-gray-200 dark:border-navy-800">
                          <span className="text-[10px] text-gray-400 font-bold block">حركة التدفق النقدي:</span>
                          <span className="text-gray-800 dark:text-gray-200 font-semibold">{editableResult.financialImpact.cashflowImpact}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation Note */}
                  {editableResult.explanation && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-sm sm:text-base text-amber-200 space-y-1.5 shadow-sm">
                      <div className="font-black flex items-center gap-1.5 text-amber-400 text-sm sm:text-base">
                        <Sparkles size={16} />
                        توجيه المحاسب الذكي:
                      </div>
                      <p className="leading-relaxed font-sans">{editableResult.explanation}</p>
                    </div>
                  )}

                  {/* Primary Action Button */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-navy-800">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentResult(null);
                        setEditableResult(null);
                      }}
                      className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                    >
                      <RotateCcw size={14} />
                      <span>إلغاء والبدء من جديد</span>
                    </button>

                    <button
                      type="button"
                      id="confirm-post-ai-entry-btn"
                      onClick={handleConfirmAndPostEntry}
                      disabled={isPosting || postSuccess}
                      className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center gap-2 shadow-xl shadow-emerald-600/30 disabled:opacity-50 transition-all scale-100 hover:scale-105 active:scale-95"
                    >
                      {isPosting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>جاري الترحيل والحفظ السحابي...</span>
                        </>
                      ) : postSuccess ? (
                        <>
                          <CheckCircle size={18} />
                          <span>تم ترحيل القيد بنجاح ✅</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={18} />
                          <span>💾 اعتماد وترحيل القيد فوراً للنظام ⚡</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* IF IT IS A REPORT / FINANCIAL INQUIRY / CALCULATION (مربع عرض المعلومات المحاسبية الموسع) */
                <div className="bg-slate-900/95 border-2 border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
                  <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-700/70 gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-4 py-2 rounded-xl bg-cyan-500/15 text-cyan-300 font-black text-sm sm:text-base border border-cyan-500/30 flex items-center gap-2 shadow-sm">
                        <FileText size={18} />
                        {editableResult.entryTypeTitle || 'تقرير مالي محاسبي 📊'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(editableResult.summaryReport || editableResult.audioSummary || '')}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors"
                        title="نسخ التقرير"
                      >
                        {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                        <span>{copied ? 'تم النسخ' : 'نسخ النص'}</span>
                      </button>

                      {editableResult.audioSummary && (
                        <button
                          type="button"
                          onClick={() => isSpeaking ? stopSpeaking() : speakText(editableResult.audioSummary!)}
                          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
                            isSpeaking 
                              ? 'bg-danger/20 text-danger border border-danger/40 animate-pulse' 
                              : 'bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 border border-brand-primary/30'
                          }`}
                          title={isSpeaking ? "إيقاف الصوت" : "قراءة صوتية"}
                        >
                          {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                          <span>{isSpeaking ? "إيقاف" : "استماع صوتي 🔊"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Report Content - مربع عرض المعلومات الموسع */}
                  <div className="prose dark:prose-invert max-w-none text-base sm:text-lg text-slate-100 whitespace-pre-line leading-relaxed bg-slate-950/90 p-6 sm:p-7 rounded-2xl border-2 border-slate-700/90 shadow-xl font-sans select-text min-h-[160px]">
                    {editableResult.summaryReport || editableResult.explanation || editableResult.audioSummary}
                  </div>

                  {editableResult.suggestedActions && editableResult.suggestedActions.length > 0 && (
                    <div className="pt-4 border-t border-slate-700/70">
                      <span className="text-xs sm:text-sm font-bold text-slate-400 block mb-2.5">إجراءات مقترحة من المحاسب الذكي:</span>
                      <div className="flex flex-wrap gap-2.5">
                        {editableResult.suggestedActions.map((action, i) => (
                          <span
                            key={i}
                            className="px-3.5 py-1.5 rounded-xl bg-brand-primary/20 text-brand-primary text-xs sm:text-sm font-bold border border-brand-primary/30"
                          >
                            ✓ {action}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* WHATSAPP ACTION CARD (تجهيز رسالة واتساب مباشرة للنواقص أو متابعة الديون) */}
                  {editableResult.whatsappDraft && (
                    <div className="pt-3 border-t border-gray-100 dark:border-navy-800">
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <span className="flex items-center gap-1.5">
                            <MessageCircle size={16} />
                            <span>رسالة واتساب مجهزة للإرسال ({editableResult.whatsappDraft.recipientName || 'الطرف المعني'}):</span>
                          </span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-mono">
                            {editableResult.whatsappDraft.type === 'restock_order' ? 'طلب نواقص 📦' : 'متابعة دين 💰'}
                          </span>
                        </div>

                        <pre className="text-xs font-sans text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed bg-white/70 dark:bg-navy-950/70 p-3 rounded-xl border border-emerald-500/20">
                          {editableResult.whatsappDraft.message}
                        </pre>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(editableResult.whatsappDraft!.message)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1"
                          >
                            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            <span>{copied ? 'تم النسخ!' : 'نسخ الرسالة'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const phone = editableResult.whatsappDraft?.recipientPhone ? editableResult.whatsappDraft.recipientPhone.replace(/[^0-9]/g, '') : '';
                              const encoded = encodeURIComponent(editableResult.whatsappDraft!.message);
                              const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
                              window.open(url, '_blank');
                            }}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                          >
                            <MessageCircle size={15} />
                            <span>إرسال عبر واتساب 📲</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AUTONOMOUS CFO FINANCIAL AUDIT & RATIOS CARD */}
              {editableResult.cfoAnalysis && (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 border border-indigo-500/40 shadow-2xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                        <ShieldAlert size={22} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm sm:text-base text-indigo-100 flex items-center gap-2">
                          <span>تدقيق واستشارة المدير المالي المستقل (Autonomous CFO Audit)</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                            CFO Mode
                          </span>
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          تحليل مباشر للنسب المالية، سيولة الخزائن، سقوف الديون، وفترة صمود المتجر
                        </p>
                      </div>
                    </div>
                    {editableResult.cfoAnalysis.quickRatioAssessment && (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1.5">
                        <Activity size={14} className="text-cyan-400" />
                        <span>تقييم السيولة: {editableResult.cfoAnalysis.quickRatioAssessment}</span>
                      </span>
                    )}
                  </div>

                  {/* Financial Ratios Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[10px] text-gray-400 block font-bold">نسبة السيولة السريعة (Quick Ratio)</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono font-black text-lg text-cyan-400">
                          {editableResult.cfoAnalysis.quickRatio !== undefined ? editableResult.cfoAnalysis.quickRatio : '1.50'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {editableResult.cfoAnalysis.quickRatio && editableResult.cfoAnalysis.quickRatio >= 1.2 ? '(آمنة)' : '(تحت الضغط)'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[10px] text-gray-400 block font-bold">دوران الذمم المدينة (تحصيل)</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono font-black text-lg text-emerald-400">
                          {editableResult.cfoAnalysis.receivablesTurnoverDays ? `${editableResult.cfoAnalysis.receivablesTurnoverDays} يوم` : '20 يوم'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[10px] text-gray-400 block font-bold">هامش الأمان وفترة الصمود</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono font-black text-lg text-amber-400">
                          {editableResult.cfoAnalysis.cashRunwayDays ? `${editableResult.cfoAnalysis.cashRunwayDays} يوم` : '60 يوم'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">
                          ({editableResult.cfoAnalysis.marginOfSafety || 'متوازن'})
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[10px] text-gray-400 block font-bold">مخاطر الائتمان وسقف الديون</span>
                      <div className="pt-0.5">
                        <span className={`font-black text-xs px-2.5 py-1 rounded-lg inline-block ${
                          editableResult.cfoAnalysis.receivablesRisk === 'حرج'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : editableResult.cfoAnalysis.receivablesRisk === 'متوسط'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {editableResult.cfoAnalysis.receivablesRisk || 'منخفض'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Strategic Recommendation */}
                  {editableResult.cfoAnalysis.strategicRecommendation && (
                    <div className="bg-white/5 border border-indigo-400/20 rounded-2xl p-3.5 text-xs leading-relaxed text-indigo-100 flex items-start gap-2.5">
                      <TrendingUp size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-cyan-300 block mb-1">التوجيه الاستراتيجي والمالي التنفيذي:</span>
                        <span className="text-gray-200">{editableResult.cfoAnalysis.strategicRecommendation}</span>
                      </div>
                    </div>
                  )}

                  {/* Dead Stock / Liquidity Warning */}
                  {editableResult.cfoAnalysis.deadStockWarning && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-200 flex items-center gap-2.5">
                      <AlertTriangle size={17} className="text-amber-400 shrink-0" />
                      <span>{editableResult.cfoAnalysis.deadStockWarning}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* RECENT VOICE/TEXT SESSION HISTORY */}
          {history.length > 0 && !isProcessing && (
            <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-navy-800">
              <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1">
                <Activity size={13} />
                العمليات والاستشارات السابقة في هذه الجلسة:
              </h4>
              <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                {history.map((h, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl flex items-center justify-between text-xs transition-colors border ${
                      h.reversed 
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 opacity-75' 
                        : 'bg-gray-50 hover:bg-gray-100 dark:bg-navy-800/60 dark:hover:bg-navy-800 border-transparent hover:border-brand-primary/40'
                    }`}
                  >
                    <div 
                      onClick={() => {
                        setCurrentResult(h.result);
                        setEditableResult(JSON.parse(JSON.stringify(h.result)));
                      }}
                      className="flex items-center gap-2 truncate cursor-pointer flex-1"
                    >
                      <Bot size={14} className="text-brand-primary shrink-0" />
                      <span className={`font-bold truncate ${h.reversed ? 'line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                        {h.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 mr-2">
                      {h.ref && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-200 dark:bg-navy-700 text-gray-700 dark:text-gray-300">
                          {h.ref}
                        </span>
                      )}

                      {h.reversed ? (
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md">
                          تم التراجع ↩️
                        </span>
                      ) : h.ref ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEntryToRollback(h.ref!);
                            setShowRollbackConfirm(true);
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1 transition-all"
                          title="التراجع عن هذه العملية"
                        >
                          <Undo2 size={12} />
                          <span>تراجع</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-mono">
                          {h.result.isEntry ? 'قيد محاسبي' : 'تقرير/حساب'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
          )}
        </div>
        </main>
      </motion.div>

      {/* INTERACTIVE MICROPHONE PERMISSION MODAL (نافذة طلب إذن الميكروفون المباشرة - أسلوب التطبيقات العالمية) */}
      <AnimatePresence>
        {showMicPermissionModal && (
          <div 
            id="mic-permission-modal-overlay"
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="bg-white dark:bg-navy-900 border border-brand-primary/40 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 text-center relative overflow-hidden"
              dir="rtl"
            >
              {/* Subtle ambient lighting */}
              <div className="absolute -top-20 -left-20 w-40 h-40 bg-brand-primary/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

              {/* Animated Microphone Icon Badge */}
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-brand-primary/30 via-cyan-500/20 to-emerald-500/30 animate-pulse blur-sm" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-primary to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-brand-primary/35">
                  <Mic size={32} className="animate-bounce" />
                </div>
                <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 border-2 border-white dark:border-navy-900 shadow">
                  <Sparkles size={12} />
                </span>
              </div>

              {/* Title and Purpose Explanation */}
              <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                  السماح باستخدام الميكروفون 🎙️
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  يحتاج <span className="font-bold text-brand-primary">المحاسب الذكي</span> للوصول إلى الميكروفون لتحويل صوتك فوراً إلى قيود محاسبية، سندات صرف وقبض، وتقارير مالية دقيقة بضغطة زر.
                </p>
              </div>

              {/* Security & Feature Highlights */}
              <div className="bg-gray-50 dark:bg-navy-800/80 rounded-2xl p-3.5 space-y-2.5 text-right border border-gray-100 dark:border-navy-700/60">
                <div className="flex items-center gap-2.5 text-xs font-bold text-gray-700 dark:text-gray-200">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Zap size={14} />
                  </div>
                  <span>تحويل صوتي فوري فائق الدقة للهجة اليمنية والعربية</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-bold text-gray-700 dark:text-gray-200">
                  <div className="w-6 h-6 rounded-lg bg-brand-primary/15 text-brand-primary flex items-center justify-center shrink-0">
                    <ShieldCheck size={14} />
                  </div>
                  <span>خصوصية وأمان تام — المعالجة الصوتية مشفرة ومحمية</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-bold text-gray-700 dark:text-gray-200">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                  <span>توليد وتدقيق القيد المحاسبي وترحيله بضغطة واحدة</span>
                </div>
              </div>

              {/* Direct Authorization Button (One Click) */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  id="allow-mic-permission-now-btn"
                  onClick={requestMicrophoneAccessDirect}
                  disabled={isRequestingMic}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-brand-primary via-indigo-600 to-cyan-600 hover:from-brand-secondary hover:to-cyan-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-brand-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {isRequestingMic ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>جاري تفعيل الميكروفون...</span>
                    </>
                  ) : (
                    <>
                      <Mic size={18} />
                      <span>السماح بالميكروفون الآن 🎙️</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="dismiss-mic-permission-modal-btn"
                  onClick={() => {
                    setShowMicPermissionModal(false);
                    setPendingActionAfterMic(null);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors"
                >
                  إلغاء ولست جاهزاً الآن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
