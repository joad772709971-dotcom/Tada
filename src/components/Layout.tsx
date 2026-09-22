import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isRemoteMode, getRemainingOfflineHours } from '../services/securityService';
import { SYSTEM_LOGO } from '../constants/assets';
import ChromeZoomControl from './ChromeZoomControl';
import { 
  LayoutDashboard, 
  Wrench, 
  ShoppingCart, 
  Smartphone,
  Video,
  ShoppingBag,
  CreditCard,
  LogOut, 
  Menu, 
  ChevronDown,
  Settings as SettingsIcon,
  HelpCircle,
  Zap,
  ShoppingBasket,
  ChevronUp,
  Unlock,
  Lock,
  ArrowRightLeft,
  Sun,
  Moon,
  MessageSquare,
  Download,
  ShieldCheck,
  Send,
  Minus,
  Plus,
  RotateCcw,
  History,
  BarChart3,
  PieChart,
  AlertCircle,
  Database,
  User,
  Users,
  Bell,
  Maximize2,
  Minimize2,
  Activity,
  Cloud,
  Clock,
  Monitor,
  Camera,
  Truck,
  WifiOff,
  Printer,
  RefreshCw,
  DollarSign,
  Package,
  Coins,
  ArrowUpRight,
  ExternalLink,
  Check,
  Crown,
  ClipboardList,
  Landmark,
  KeyRound,
  X,
  Layers,
  Building2,
  Wallet,
  Boxes,
  FileText,
  Sparkles,
  UserCheck,
  Scale,
  Store,
  Cpu
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { isModuleAutoHidden } from '../utils/businessPermissions';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, collection, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import { useVault } from '../context/VaultContext';
import { useFullscreen } from '../hooks/useFullscreen';
import { useLoading } from '../context/LoadingContext';
import VaultModal from './VaultModal';
import NotificationManager from './NotificationManager';
import OrdersDrawer from './OrdersDrawer';
import BubbleChat from './BubbleChat';
import { JamQuickScratchPad } from './JamQuickScratchPad';
import JamFloatingActionDock from './JamFloatingActionDock';
import VipActivationModal from './VipActivationModal';
import TrialExpirationNoticeModal from './TrialExpirationNoticeModal';
import { BUSINESS_LABELS } from '../constants/labels';
import { useNavigate } from 'react-router-dom';
import { FirebaseProjectRouter } from '../services/FirebaseProjectRouter';

import { applyShopBranding, formatSmartBarcode, generateTransactionId } from '../lib/shopUtils';
import { idbService } from '../services/idbService';
import { runDailyBackupDaemon } from '../services/backupService';
import { JamSidebarItemRender, sidebarLuxuryStyles } from './JamSidebarItemRender';
import { b2bLinkageEngine } from '../services/b2bLinkageEngine';
import { preloadPriorityRoutes } from '../services/routePreloader';
import { JamSidePanelWithNotifications } from './JamSidePanelWithNotifications';
import { JamLuxuryUnifiedHeader } from './JamLuxuryUnifiedHeader';
import { CinematicTitleTerminal } from './CinematicTitleTerminal';
import { JamGlobalFinancialModals } from './JamGlobalFinancialModals';
import { useJamUniversalKeyboardShortcuts } from '../hooks/useJamUniversalKeyboardShortcuts';
import OnboardingGuide from './OnboardingGuide';
import JAMUltimateOptimizer from './JAMUltimateOptimizer';
import JAMSmartAssistant from './JAMSmartAssistant';
import CommandPalette from './CommandPalette';
import DailyShiftCloseModal, { ShiftCloseReport } from './DailyShiftCloseModal';
import CrossB2BWholesaleMarketModal from './CrossB2BWholesaleMarketModal';
import AppVariantsSelectorModal from './AppVariantsSelectorModal';
import HotPatchSecurityGuard from './HotPatchSecurityGuard';
import SequentialPermissionWizardModal from './SequentialPermissionWizardModal';
import SmartAIAccountantModal from './SmartAIAccountantModal';
import { liveHotFixEngine } from '../services/LiveHotFixEngine';

interface LayoutProps {
  children: React.ReactNode;
  profile: UserProfile | null;
  isSecured?: boolean;
}

export const getPageTitleByPath = (path: string): string => {
  if (!path) return 'لوحة التحكم الرئيسية';
  const cleanPath = path.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';

  const routeTitleMap: Record<string, string> = {
    '/': 'لوحة التحكم الرئيسية',
    '/dashboard': 'لوحة التحكم الرئيسية',
    '/sales': 'كاشير التجزئة',
    '/maintenance': 'الصيانة والورشة',
    '/inventory': 'إدارة المخزن',
    '/wholesale-pos': 'مبيعات الجملة',
    '/wholesale-purchases': 'مشتريات الجملة',
    '/operations-customers': 'التجارة الذكية',
    '/smart-commerce': 'التجارة الذكية',
    '/mobile-balance': 'عمليات الرصيد',
    '/sim-cards': 'مخزن الشرائح والبطائق',
    '/invoice-scanner': 'ماسح الفواتير',
    '/warehouse-prep': 'تجهيز المستودع 📦',
    '/delivery': 'توصيلات السائقين',
    '/shortages': 'النواقص والعجز',
    '/inventory-match': 'الجرد والرقابة المخزنية',
    '/damaged': 'التالف والفاقد',
    '/reports': 'التقارير الشاملة 📊',
    '/archive': 'أرشيف الفواتير 📂',
    '/finances': 'الصناديق والخزائن',
    '/bank-transfers': 'الإيداعات البنكية 🏦',
    '/cashier': 'تسويات الصراف والشيفتات',
    '/accounts': 'الحسابات والقيود',
    '/smart-accounting': 'التدقيق والمحاسبة ⚖️',
    '/market': 'سوق الموردين 💎',
    '/chat': 'الدردشة والتواصل',
    '/customers': 'العملاء ومديونياتهم',
    '/suppliers': 'الموردين ومستحقاتهم',
    '/users': 'شؤون الموظفين والصلاحيات',
    '/engineer-accounts': 'عقود وحسابات المهندسين',
    '/reels-manager': 'العروض المرئية للزبائن (فيديو)',
    '/owner-control': 'سجل النشاطات والرقابة',
    '/attendance': 'سجل الدوام والحضور',
    '/activity-logs': 'سجل النشاط والرقابة',
    '/smart-import': 'الاستيراد الذكي',
    '/settings': 'الإعدادات العامة للمحل',
    '/help': 'المساعدة والتعليمات',
    '/super-admin': 'لوحة التحكم للمبرمج (SuperAdmin)',
    '/warehouse': 'مستودعات وورش العمل',
    '/orders': 'إدارة الطلبيات',
    '/portal': 'بوابة العملاء',
    '/cp': 'بوابة العملاء',
    '/client-login': 'بوابة العملاء'
  };

  if (routeTitleMap[cleanPath]) {
    return routeTitleMap[cleanPath];
  }

  // Check prefix match if dynamic params or nested subroutes exist
  for (const [route, title] of Object.entries(routeTitleMap)) {
    if (route !== '/' && cleanPath.startsWith(route)) {
      return title;
    }
  }

  return 'لوحة التحكم الرئيسية';
};

const ClockDisplay = () => {
  const [time, setTime] = useState(new Date());
  const { isVaultOpen, vaultDate, setVaultDate } = useVault();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Convert current time to Asia/Aden
  const yemenTime = new Date(time.toLocaleString('en-US', { timeZone: 'Asia/Aden' }));

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-8">
        {isVaultOpen && (
          <div className="flex items-center gap-3 px-4 py-1.5 bg-brand-primary/10 border border-brand-primary/30 rounded-xl">
            <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">التاريخ المحاسبي:</span>
            <input 
              type="date" 
              style={{ color: 'var(--clock-text)' }}
              className="bg-transparent text-sm font-black outline-none border-b-2 border-brand-primary focus:border-white transition-all tabular-nums"
              value={vaultDate}
              onChange={(e) => setVaultDate(e.target.value)}
            />
          </div>
        )}
        
        <div className="flex items-baseline gap-2">
          <span 
            style={{ color: 'var(--clock-text)' }}
            className="text-4xl font-black tracking-[0.1em] tabular-nums drop-shadow-[0_0_10px_rgba(79,70,229,0.6)]"
          >
            {yemenTime.getHours().toString().padStart(2, '0')}
            <span className="animate-pulse opacity-50">:</span>
            {yemenTime.getMinutes().toString().padStart(2, '0')}
            <span className="animate-pulse opacity-50 relative top-[-2px]">
              <span className="text-sm ml-1 opacity-60">{yemenTime.getSeconds().toString().padStart(2, '0')}</span>
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-px w-6 bg-brand-primary/30" />
        <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.4em]">
          {time.toLocaleDateString('ar-YE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Aden' })}
        </span>
        <div className="h-px w-6 bg-brand-primary/30" />
      </div>
    </div>
  );
};

interface NavItem {
  id: string;
  path: string;
  icon: any;
  label: string;
  color: string;
  iconColor?: string;
  managerOnly?: boolean;
  hideIfNotMobile?: boolean;
  hideIfWholesale?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const SIDEBAR_DESCRIPTIONS: Record<string, string> = {
  'dashboard': 'لوحة الإحصائيات والأرباح الفورية للنشاط',
  'sales': 'صالة مبيعات التجزئة السريعة والباركود',
  'orders': 'إدارة طلبات الزبائن وحالة التجهيز الشاملة',
  'maintenance': 'قسم الصيانة للأجهزة والهواتف والضمان',
  'wholesale-pos': 'فاتورة كبار التجار ومبيعات الجملة الفائقة',
  'wholesale-purchases': 'شراء الكميات وتحديث متوسط التكاليف',
  'operations-customers': 'تحليلات المبيعات وعروض السلع الذكية',
  'mobile-balance': 'عمليات الرصيد والتحويل الفوري للشبكات',
  'inventory': 'جرد المستودعات وتحديث أسعار السلع السريع',
  'invoice-scanner': 'قراءة الفواتير الورقية وتحليلها آلياً',
  'warehouse-prep': 'تجهيز السلع بالمستودع وتحضير الشحنات',
  'delivery': 'توزيع السائقين وتوصيل البضائع للعملاء',
  'shortages': 'مراقبة النواقص والسلع التي أوشكت على النفاد',
  'inventory-match': 'مطابقة الجرد الفعلي وكشف العجز والزيادة',
  'damaged': 'إهلاك السلع التالفة أو المفقودة محاسبياً',
  'archive': 'أرشيف جميع الفواتير التاريخية والعمليات',
  'sim-cards': 'إدارة وتفعيل وبيع كروت وشرائح الاتصال',
  'finances': 'التحكم بالصناديق والخزائن المالية والمحافظ',
  'bank-transfers': 'إدارة الإيداعات البنكية المباشرة بين البنوك والصناديق',
  'cashier': 'تصفية الصناديق وتسوية عهد الصرافين اليومية',
  'accounts': 'شجرة الحسابات والمنظومة المحاسبية المتكاملة',
  'smart-accounting': 'التدقيق الذكي لكشف الأخطاء المحاسبية آلياً',
  'market': 'سوق الموردين الموحد لطلب وتغذية المخازن',
  'chat': 'الدردشة والتواصل الآمن مع الفروع والموظفين',
  'customers': 'حسابات العملاء الأجل وكشوف المديونيات والقبض',
  'suppliers': 'مدفوعات الموردين والأرصدة وسندات الصرف',
  'reels-manager': 'إدارة عروض الفيديو القصير الترويجية للسلع',
  'owner-control': 'مراقبة المالك السرية لأداء الفروع والأرباح',
  'smart-import': 'تهيئة المحل باستيراد البيانات من ملفات Excel',
  'users': 'حسابات الموظفين وإسناد الصلاحيات والأدوار الأمنية',
  'attendance': 'متابعة سجل حضور وانصراف الموظفين والدوام',
  'activity-logs': 'الرقابة الأمنية الصارمة وتتبع حركات الحذف والتعديل',
  'help': 'مركز المساعدة وطلب الدعم الفني وأدلة التشغيل',
  'settings': 'إعدادات المحل، العملات، الضرائب وتخصيص الفواتير',
  'super-admin': 'لوحة تحكم مطوري النظام ومراقبة الاشتراكات',
  'gemini-monitoring': 'متابعة كفاءة وأداء خوارزميات الذكاء الاصطناعي'
};

interface NavLinkProps {
  item: NavItem;
  pathname: string;
  unreadMessages: number;
  pendingB2bRequestsCount?: number;
  fontSize: number;
  onClick?: () => void;
  showGuide?: boolean;
}

const NavLink = ({ item, pathname, unreadMessages, pendingB2bRequestsCount = 0, fontSize, onClick }: NavLinkProps) => {
  const isActive = pathname === item.path;
  const ColorIcon = item.icon;
  const isMarket = item.id === 'market';
  
  return (
    <div className="flex flex-col gap-1 w-full">
      <JamSidebarItemRender
        to={item.path}
        icon={<ColorIcon size={16} />}
        label={item.label}
        isActive={isActive}
        iconColor={item.iconColor}
        hasNotification={
          (item.id === 'chat' && unreadMessages > 0) || 
          (isMarket && pendingB2bRequestsCount > 0) ||
          !!item.id?.includes('notif')
        }
        notifCount={
          item.id === 'chat' ? unreadMessages : 
          isMarket && pendingB2bRequestsCount > 0 ? pendingB2bRequestsCount : 
          undefined
        }
        currentFontSize={fontSize}
        onClick={onClick}
      />
    </div>
  );
};

const MobileLayoutClock = () => {
  const [layoutTime, setLayoutTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setLayoutTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="lg:hidden flex items-center justify-center py-2 px-3 border-b border-gray-100 dark:border-white/5 bg-slate-50 dark:bg-[#090d16] text-[10px] sm:text-xs gap-3 font-sans select-all font-black text-center relative z-[40]">
      <span className="text-amber-500 font-black flex items-center gap-1 select-none">🕒 الوقت:</span>
      <span className="text-[#cf8a3c] font-black tracking-wide">
        {layoutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
      </span>
      <span className="text-slate-300 dark:text-slate-800">|</span>
      <span className="text-emerald-500 font-extrabold">
        📅 {new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(layoutTime)} هـ
      </span>
      <span className="text-slate-300 dark:text-slate-800">|</span>
      <span className="text-indigo-400 font-extrabold">
        {new Intl.DateTimeFormat('ar-YE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(layoutTime)} م
      </span>
    </div>
  );
};

export default function Layout({ children, profile, isSecured = true }: LayoutProps) {
  const isDark = true;
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    '⚡ عمليات البيع والصيانة السريعة',
    '📦 المخازن والخدمات اللوجستية',
    '🌐 منظومة التجارة والتواصل B2B',
    '💼 منظومة الحسابات والإدارة المالية',
    '👥 شؤون الموظفين والمهندسين',
    '🛡️ الرقابة والأرشيف والجرد',
    '🤖 الخدمات والإعدادات الذكية',
    '👑 قسم المبرمج والتحكم الفائق'
  ]);
  const [sidebarGuide, setSidebarGuide] = useState(() => {
    if (localStorage.getItem('jam_sidebar_guide_active') === null) {
      return true; // Default to true for new visitors to guide them
    }
    return localStorage.getItem('jam_sidebar_guide_active') === 'true';
  });

  const [isWithinOneDay, setIsWithinOneDay] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isDailyShiftModalOpen, setIsDailyShiftModalOpen] = useState(false);
  const [isCrossB2BMarketOpen, setIsCrossB2BMarketOpen] = useState(false);
  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setForceUpdate(n => n + 1);
    };
    const handleHotFixApplied = () => {
      setForceUpdate(n => n + 1);
    };
    window.addEventListener('jam:profile_updated', handleProfileUpdate);
    window.addEventListener('jam:hotfix_applied', handleHotFixApplied);
    window.addEventListener('jam:soft_reload_state', handleProfileUpdate);
    return () => {
      window.removeEventListener('jam:profile_updated', handleProfileUpdate);
      window.removeEventListener('jam:hotfix_applied', handleHotFixApplied);
      window.removeEventListener('jam:soft_reload_state', handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    const handleOpenB2BMarket = () => setIsCrossB2BMarketOpen(true);
    window.addEventListener('jam-open-cross-b2b-market', handleOpenB2BMarket);
    return () => window.removeEventListener('jam-open-cross-b2b-market', handleOpenB2BMarket);
  }, []);

  const handleConfirmShiftClose = async (report: ShiftCloseReport) => {
    try {
      if (profile?.ownerId) {
        await addDoc(collection(db, 'shift_closings'), {
          ...report,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.warn('Shift report recorded locally:', e);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const openPalette = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', openPalette);
    return () => window.removeEventListener('open-command-palette', openPalette);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const uid = profile.uid || 'guest';
    const key = `jam_first_entry_${uid}`;
    const stored = localStorage.getItem(key);
    const now = Date.now();
    let entryTime = now;

    if (!stored) {
      localStorage.setItem(key, now.toString());
      entryTime = now;
    } else {
      entryTime = parseInt(stored, 10);
    }

    if (profile.trialStartDate) {
      const t = profile.trialStartDate.toDate ? profile.trialStartDate.toDate() : new Date(profile.trialStartDate);
      entryTime = Math.min(entryTime, t.getTime());
    } else if (profile.joinDate) {
      const j = profile.joinDate.toDate ? profile.joinDate.toDate() : new Date(profile.joinDate);
      entryTime = Math.min(entryTime, j.getTime());
    }

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (now - entryTime > ONE_DAY_MS) {
      setIsWithinOneDay(false);
    } else {
      setIsWithinOneDay(true);
    }
  }, [profile]);

  useEffect(() => {
    const handleGuideChange = () => {
      const val = localStorage.getItem('jam_sidebar_guide_active');
      if (val === null) {
        setSidebarGuide(true);
      } else {
        setSidebarGuide(val === 'true');
      }
    };
    window.addEventListener('jam_sidebar_guide_changed', handleGuideChange);
    return () => {
      window.removeEventListener('jam_sidebar_guide_changed', handleGuideChange);
    };
  }, []);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const sidebarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isSidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        const target = event.target as HTMLElement;
        if (target.closest('[class*="toggle-sidebar-btn"]') || target.closest('button[title*="فت"]') || target.closest('button[title*="قائ"]')) {
          return;
        }
        setIsSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);
  const [showSystemHub, setShowSystemHub] = useState(false);
  const [isRemote] = useState(isRemoteMode());
  const location = useLocation();

  // Reactive State Synchronization for Header Page Title on Route Change
  const [currentTitle, setCurrentTitle] = useState<string>(() => getPageTitleByPath(location.pathname));

  useEffect(() => {
    // Force sync and update page title immediately on route change without relying on state cache
    const updatedTitle = getPageTitleByPath(location.pathname);
    setCurrentTitle(updatedTitle);
  }, [location.pathname]);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const { isVaultOpen } = useVault();
  const { isProcessing, processingMessage, showLegacyUIBorders, showLegacyLoadingSpinners, globalActionTimeout } = useLoading();
  const navigate = useNavigate();
  const [fontSize, setFontSize] = useState(() => {
    return Number(localStorage.getItem('jam-font-size')) || 13;
  });
  const [isJamPanelOpen, setIsJamPanelOpen] = useState(false);
  const [lastNotificationId, setLastNotificationId] = useState<string>('');
  const [transientToast, setTransientToast] = useState<{ show: boolean; message: string } | null>(null);

  const [jamGlobalModalType, setJamGlobalModalType] = useState<'receive' | 'send' | 'custody' | 'voucher' | null>(null);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);

  useJamUniversalKeyboardShortcuts({
    toggleSidePanel: () => setIsJamPanelOpen(prev => !prev),
    navigateToWallet: () => navigate('/finances'),
    navigateToChat: () => navigate('/chat'),
    navigateToInventory: () => navigate('/inventory'),
    navigateToMarket: () => navigate('/wholesale-pos'),
    navigateToPortal: () => navigate('/portal'),
    openReceiveRemittance: () => setJamGlobalModalType('receive'),
    openSendRemittance: () => setJamGlobalModalType('send'),
    openHandoverCustody: () => setJamGlobalModalType('custody'),
    openCashReceiptVoucher: () => setJamGlobalModalType('voucher'),
    activeModalIsOpen: jamGlobalModalType !== null,
    onGlobalConfirm: () => {
      const activeForm = document.querySelector('form');
      if (activeForm) {
        activeForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    },
    onGlobalCancel: () => setJamGlobalModalType(null),
  });

  const toggleTheme = async () => {
    // Force night mode/dark theme permanently as requested
  };

  useEffect(() => {
    document.documentElement.classList.add('dark');
    preloadPriorityRoutes();
  }, []);

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };
  const [lastOperations, setLastOperations] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!profile?.uid) return;
    const qMessages = query(
      collection(db, 'messages'),
      where('receiverId', '==', profile.uid),
      where('status', '!=', 'read')
    );
    return onSnapshot(qMessages, (snapshot) => {
      setUnreadMessages(snapshot.size);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });
  }, [profile?.uid]);

  const [todaySales, setTodaySales] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [globalAlerts, setGlobalAlerts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [pendingB2bRequestsCount, setPendingB2bRequestsCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOrdersDrawer, setShowOrdersDrawer] = useState(false);

  // B2B Connection Key Generator States (Prompt 1)
  const [isKeyGenOpen, setIsKeyGenOpen] = useState(false);
  const [keyTaskType, setKeyTaskType] = useState('new'); // 'new' | 'renew'
  const [keyDuration, setKeyDuration] = useState('month'); // 'month' | 'year' | 'unlimited'
  const [keyPermissions, setKeyPermissions] = useState({
    credit: false,
    cash: true,
    transfer: false,
    jamPay: false,
  });
  const [approveClientAccount, setApproveClientAccount] = useState(false);
  const [creditLimit, setCreditLimit] = useState('');
  const [installmentSystem, setInstallmentSystem] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const handleGenerateKey = async () => {
    try {
      const newKey = `JAM-CONN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      await addDoc(collection(db, 'b2bConnectionKeys'), {
        key: newKey,
        taskType: keyTaskType,
        duration: keyDuration,
        permissions: keyPermissions,
        approveClientAccount: keyPermissions.credit ? approveClientAccount : false,
        creditLimit: keyPermissions.credit ? (Number(creditLimit) || 0) : 0,
        installmentSystem: keyPermissions.credit ? installmentSystem : false,
        createdAt: serverTimestamp(),
        createdBy: profile?.uid || 'system',
        status: 'active'
      });
      setGeneratedKey(newKey);
    } catch (e) {
      console.error(e);
      const newKey = `JAM-CONN-OFFLINE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      setGeneratedKey(newKey);
    }
  };
  const { isFullscreen, isFakeFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen();
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showNetworkToast, setShowNetworkToast] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [activeToast, setActiveToast] = useState<{ type: 'offline' | 'online', message: string } | null>(null);
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);
  const [isSmartAccountantOpen, setIsSmartAccountantOpen] = useState(false);

  useEffect(() => {
    const handleOpenAccountant = () => setIsSmartAccountantOpen(true);
    window.addEventListener('open-smart-ai-accountant', handleOpenAccountant);
    return () => window.removeEventListener('open-smart-ai-accountant', handleOpenAccountant);
  }, []);
  const barcodeBufferRef = useRef('');
  const lastBarcodeTimeRef = useRef(0);

  // Custom navigation ordering states
  const [isCustomizingNav, setIsCustomizingNav] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedFromGroup, setDraggedFromGroup] = useState<string | null>(null);

  const [navStructure, setNavStructure] = useState<{ title: string; items: string[] }[]>(() => {
    const defaultStruct = [
      {
        title: '⚡ عمليات البيع والصيانة السريعة',
        items: ['sales', 'maintenance', 'mobile-balance', 'sim-cards', 'wholesale-purchases', 'wholesale-pos']
      },
      {
        title: '📦 المخازن والخدمات اللوجستية',
        items: ['inventory', 'sim-cards-wh', 'shortages', 'damaged']
      },
      {
        title: '🌐 منظومة التجارة والتواصل B2B',
        items: ['market', 'operations-customers', 'reels-manager', 'warehouse-prep', 'delivery', 'chat', 'customers', 'suppliers']
      },
      {
        title: '💼 منظومة الحسابات والإدارة المالية',
        items: ['finances', 'bank-transfers', 'cashier', 'accounts', 'smart-accounting', 'reports', 'archive']
      },
      {
        title: '👥 شؤون الموظفين والمهندسين',
        items: ['users', 'engineer-accounts', 'attendance']
      },
      {
        title: '🛡️ الرقابة والأرشيف والجرد',
        items: ['inventory-match', 'owner-control', 'activity-logs']
      },
      {
        title: '⚙️ إعدادات النظام',
        items: ['invoice-scanner', 'smart-import', 'settings', 'help']
      },
      {
        title: '👑 قسم المبرمج والتحكم الفائق',
        items: ['superadmin']
      }
    ];
    const saved = localStorage.getItem('jam-side-nav-structure-v3');
    if (!saved) {
      return defaultStruct;
    }
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return defaultStruct;
      }
      // Ensure reels-manager is not missing from saved navigation
      const hasReels = parsed.some((g: any) => Array.isArray(g.items) && g.items.includes('reels-manager'));
      if (!hasReels) {
        const b2bGroup = parsed.find((g: any) => g.title?.includes('التجارة') || g.title?.includes('B2B') || g.title?.includes('العمليات'));
        if (b2bGroup && Array.isArray(b2bGroup.items)) {
          b2bGroup.items.push('reels-manager');
        } else if (parsed[0] && Array.isArray(parsed[0].items)) {
          parsed[0].items.push('reels-manager');
        }
      }
      return parsed;
    } catch (e) {
      return defaultStruct;
    }
  });

  const handleDragStart = (e: React.DragEvent, itemId: string, groupTitle: string) => {
    setDraggedItemId(itemId);
    setDraggedFromGroup(groupTitle);
    e.dataTransfer.setData('text/plain', itemId);
  };

  const handleDragOverGroup = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const moveItemToGroup = (itemId: string, sourceGroup: string, targetGroup: string) => {
    setNavStructure(prev => {
      const next = prev.map(g => {
        if (g.title === sourceGroup) {
          return { ...g, items: g.items.filter(i => i !== itemId) };
        }
        return g;
      });
      const updated = next.map(g => {
        if (g.title === targetGroup) {
          if (g.items.includes(itemId)) return g;
          return { ...g, items: [...g.items, itemId] };
        }
        return g;
      });
      localStorage.setItem('jam-side-nav-structure', JSON.stringify(updated));
      return updated;
    });
    setDraggedItemId(null);
    setDraggedFromGroup(null);
  };

  const moveItemToGroupAndIndex = (itemId: string, sourceGroup: string, targetGroup: string, targetIndex: number) => {
    setNavStructure(prev => {
      let cleanPrev = prev.map(g => {
        if (g.title === sourceGroup) {
          return { ...g, items: g.items.filter(i => i !== itemId) };
        }
        return g;
      });

      const updated = cleanPrev.map(g => {
        if (g.title === targetGroup) {
          const itemsCopy = [...g.items];
          const finalIndex = Math.min(Math.max(0, targetIndex), itemsCopy.length);
          itemsCopy.splice(finalIndex, 0, itemId);
          return { ...g, items: itemsCopy };
        }
        return g;
      });
      
      localStorage.setItem('jam-side-nav-structure', JSON.stringify(updated));
      return updated;
    });
    setDraggedItemId(null);
    setDraggedFromGroup(null);
  };

  const handleDropOnGroup = (e: React.DragEvent, targetGroupTitle: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
    const sourceGroup = draggedFromGroup;
    if (!itemId || !sourceGroup) return;
    if (sourceGroup === targetGroupTitle) return;
    moveItemToGroup(itemId, sourceGroup, targetGroupTitle);
  };

  const handleDropOnItem = (e: React.DragEvent, targetGroupTitle: string, targetIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
    const sourceGroup = draggedFromGroup;
    if (!itemId || !sourceGroup) return;
    moveItemToGroupAndIndex(itemId, sourceGroup, targetGroupTitle, targetIndex);
  };

  const shiftItemIndex = (itemId: string, groupTitle: string, direction: 'up' | 'down') => {
    setNavStructure(prev => {
      const updated = prev.map(g => {
        if (g.title === groupTitle) {
          const items = [...g.items];
          const curIndex = items.indexOf(itemId);
          if (curIndex === -1) return g;
          const targetIndex = direction === 'up' ? curIndex - 1 : curIndex + 1;
          if (targetIndex < 0 || targetIndex >= items.length) return g;
          
          const temp = items[curIndex];
          items[curIndex] = items[targetIndex];
          items[targetIndex] = temp;
          return { ...g, items };
        }
        return g;
      });
      localStorage.setItem('jam-side-nav-structure', JSON.stringify(updated));
      return updated;
    });
  };

  const resetNavStructure = () => {
    if (!window.confirm('هل أنت متأكد من إعادة ضبط ترتيب القوائم إلى الوضع الافتراضي؟')) return;
    const defaultStruct = [
      {
        title: 'العمليات الأساسية',
        items: ['sales', 'orders', 'maintenance', 'wholesale-pos', 'wholesale-purchases', 'operations-customers', 'mobile-balance']
      },
      {
        title: 'المخزون والمستودع',
        items: ['inventory', 'invoice-scanner', 'delivery', 'shortages', 'inventory-match', 'damaged', 'archive', 'sim-cards']
      },
      {
        title: 'المالية والشركاء',
        items: ['finances', 'cashier', 'accounts', 'market', 'chat', 'customers', 'suppliers']
      },
      {
        title: 'الرقابة والإدارة',
        items: ['reels-manager', 'smart-import']
      }
    ];
    setNavStructure(defaultStruct);
    localStorage.removeItem('jam-side-nav-structure');
  };

  useEffect(() => {
    const handleGlobalBarcode = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const now = Date.now();
      const diff = now - lastBarcodeTimeRef.current;

      if (e.key === 'Enter') {
        if (barcodeBufferRef.current.length > 2) {
          // It's a scanned barcode
          navigate(`/sales?search=${barcodeBufferRef.current}`);
          barcodeBufferRef.current = '';
        }
        return;
      }

      // Ignore modifier keys
      if (e.key.length > 1) return;

      if (diff > 100) {
        // New scan session
        barcodeBufferRef.current = e.key;
      } else {
        barcodeBufferRef.current += e.key;
      }
      lastBarcodeTimeRef.current = now;
    };

    window.addEventListener('keydown', handleGlobalBarcode);
    return () => window.removeEventListener('keydown', handleGlobalBarcode);
  }, [navigate]);

  useEffect(() => {
    let timer: any;
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkStatus('online');
      setActiveToast({
        type: 'online',
        message: 'تمت إعادة الاتصال بالشبكة بنجاح وعودة المزامنة التلقائية.'
      });
      clearTimeout(timer);
      timer = setTimeout(() => setActiveToast(null), 5000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setNetworkStatus('offline');
      setActiveToast({
        type: 'offline',
        message: 'النظام يعمل دون اتصال بالإنترنت. يرجى المزامنة وتفعيل شبكة الإنترنت لضمان استقرار دفاتركم.'
      });
      clearTimeout(timer);
      timer = setTimeout(() => setActiveToast(null), 7000);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check: if offline on boot, show warning toast
    if (!navigator.onLine) {
      setActiveToast({
        type: 'offline',
        message: 'النظام يعمل دون اتصال بالإنترنت. يرجى المزامنة وتفعيل شبكة الإنترنت لضمان استقرار دفاتركم.'
      });
      timer = setTimeout(() => setActiveToast(null), 8000);
    }

    // Run the automated daily encrypted backup daemon background task has been disabled to prevent unrequested download popups on layout mount
    // runDailyBackupDaemon();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!profile?.ownerId) return;
    const unsub = onSnapshot(doc(db, 'settings', profile.ownerId), (docSnap) => {
      if (docSnap.exists()) {
        setShopSettings(docSnap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `settings/${profile.ownerId}`);
    });
    return () => unsub();
  }, [profile?.ownerId]);

  useEffect(() => {
    if (shopSettings) {
      applyShopBranding({
        primaryColor: shopSettings.primaryColor,
        secondaryColor: shopSettings.secondaryColor,
        shopName: shopSettings.shopName
      });
    }
  }, [shopSettings]);

  useEffect(() => {
    if (!profile?.ownerId || profile?.role === 'customer' || profile?.role === 'guest' || profile?.role === 'Guest') return;
    const q = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      idbService.syncInventory(items).catch(err => console.error('IDB Sync Error:', err));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });
    return () => unsub();
  }, [profile?.ownerId]);

  useEffect(() => {
    const unsubMaster = onSnapshot(doc(db, 'system', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalAlerts(docSnap.data().globalAlerts || []);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system/config');
    });

    let unsubNotifications = () => {};
    if (profile?.ownerId && profile?.role !== 'customer' && profile?.role !== 'guest' && profile?.role !== 'Guest') {
      const q = query(
        collection(db, 'notifications'),
        where('ownerId', '==', profile.ownerId),
        limit(50)
      );
      unsubNotifications = onSnapshot(q, (snapshot) => {
        const sorted = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => {
            const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
            const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
            return dateB - dateA;
          });
        setNotifications(sorted.slice(0, 20));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      });
    }

    return () => {
      unsubMaster();
      unsubNotifications();
    };
  }, [profile?.ownerId]);

  useEffect(() => {
    if (!profile?.ownerId || profile?.role === 'customer' || profile?.role === 'guest' || profile?.role === 'Guest') return;

    let netCount = 0;
    let prepCount = 0;

    // Listen for network orders + prep orders to update badge
    const qNet = query(
      collection(db, 'networkOrders'),
      where('ownerId', '==', profile.ownerId),
      where('status', 'in', ['pending', 'approved', 'prepping', 'ready'])
    );
    const unsubNet = onSnapshot(qNet, (snap) => {
      netCount = snap.size;
      setPendingOrdersCount(netCount + prepCount);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'networkOrders');
    });

    const qPrep = query(
      collection(db, 'warehousePrepOrders'),
      where('ownerId', '==', profile.ownerId),
      where('prepStatus', 'in', ['pending', 'in_progress'])
    );
    const unsubPrep = onSnapshot(qPrep, (prepSnap) => {
      prepCount = prepSnap.size;
      setPendingOrdersCount(netCount + prepCount);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'warehousePrepOrders');
    });

    return () => {
      unsubNet();
      unsubPrep();
    };
  }, [profile?.ownerId]);

  // Real-time B2B Connection Requests listener for supplier sidebar badge
  useEffect(() => {
    const targetSupplierId = profile?.ownerId || profile?.uid;
    if (!targetSupplierId || profile?.role === 'customer' || profile?.role === 'guest' || profile?.role === 'Guest') return;

    const listenFn = b2bLinkageEngine?.listenPendingRequests || b2bLinkageEngine?.subscribeToPendingRequests;
    const unsubRequests = typeof listenFn === 'function'
      ? listenFn.call(b2bLinkageEngine, targetSupplierId, (requests: any) => {
          setPendingB2bRequestsCount(requests?.length || 0);
        })
      : () => {};

    const handleCustomUpdate = () => {
      // Trigger a re-sync if custom event fired
    };
    window.addEventListener('jam:b2b_connection_updated', handleCustomUpdate);

    return () => {
      if (typeof unsubRequests === 'function') unsubRequests();
      window.removeEventListener('jam:b2b_connection_updated', handleCustomUpdate);
    };
  }, [profile?.ownerId, profile?.uid]);

  useEffect(() => {
    if (!profile?.ownerId || profile?.role === 'customer' || profile?.role === 'guest' || profile?.role === 'Guest') return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const qSales = query(
      collection(db, 'sales'),
      where('ownerId', '==', profile.ownerId),
      where('createdAt', '>=', todayTimestamp)
    );

    const unsubSales = onSnapshot(qSales, (snapshot) => {
      let total = 0;
      let profit = 0;
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        total += (data.total || 0);
        profit += (data.profit || 0);
      });
      setTodaySales(total);
      setTodayProfit(profit);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    });

    const unsubVault = onSnapshot(doc(db, 'vaults', profile.ownerId), (doc) => {
      if (doc.exists()) {
        setVaultBalance(doc.data().balance || 0);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `vaults/${profile.ownerId}`);
    });

    return () => {
      unsubSales();
      unsubVault();
    };
  }, [profile?.ownerId]);

  useEffect(() => {
    document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    localStorage.setItem('jam-font-size', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    const unread = notifications.find((n: any) => !n.read);
    if (unread && unread.id !== lastNotificationId) {
      setLastNotificationId(unread.id);
      // [MUTED & SILENCED FOR FOCUS BLOCK]
      // Incoming signals only push data silently into local states & database arrays
    }
  }, [notifications, lastNotificationId]);

  useEffect(() => {
    if (!profile?.ownerId || profile?.role === 'customer' || profile?.role === 'guest' || profile?.role === 'Guest') return;
    const q = query(
      collection(db, 'transactions'),
      where('ownerId', '==', profile.ownerId),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const sorted = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => {
          const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
          const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
          return dateB - dateA;
        });
      setLastOperations(sorted.slice(0, 5));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });
  }, [profile]);

  const handleUndo = async (operation: any) => {
    if (!window.confirm('هل أنت متأكد من التراجع عن هذه العملية؟ سيتم عكس الأثر المالي.')) return;
    try {
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile?.ownerId,
        type: operation.type === 'income' ? 'expense' : 'income',
        amount: operation.amount,
        category: 'undo',
        description: `تراجع عن: ${operation.description}`,
        isUndo: true,
        originalId: operation.id,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'transactions', operation.id), {
        isUndo: true
      });

      alert('تم التراجع بنجاح');
    } catch (error) {
      console.error('Error undoing operation:', error);
    }
  };

  const handleFontSize = (delta: number) => {
    setFontSize(prev => Math.min(Math.max(prev + delta, 9), 24));
  };

  useEffect(() => {
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useEffect(() => {
    // Follow the theme set by App.tsx (Day Mode default)
    // No longer forcing dark mode here
    document.documentElement.removeAttribute('data-visual-theme');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        navigate('/dashboard');
      }
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!profile?.ownerId) return;
      try {
        const docSnap = await getDoc(doc(db, 'settings', profile.ownerId));
        if (docSnap.exists()) {
          setShopSettings(docSnap.data() as any);
        }
      } catch (error) {
        console.warn('Error fetching settings (falling back to default):', error);
      }
    };
    fetchSettings();
  }, [profile?.ownerId]);

  const businessType = profile?.businessType || 'mobiles';
  const labels = BUSINESS_LABELS[businessType as keyof typeof BUSINESS_LABELS] || BUSINESS_LABELS.mobiles;

  const ALL_NAV_ITEMS_MAP: Record<string, NavItem> = {
    'sales': { id: 'sales', path: '/sales', icon: ShoppingCart, label: 'كاشير التجزئة', color: 'bg-emerald-500', iconColor: 'text-emerald-400' },
    'orders': { id: 'orders', path: '/orders', icon: ShoppingBag, label: 'إدارة الطلبيات', color: 'bg-indigo-500', iconColor: 'text-indigo-400' },
    'maintenance': { id: 'maintenance', path: '/maintenance', icon: Wrench, label: 'الصيانة والورشة', color: 'bg-orange-600', iconColor: 'text-amber-400' },
    'wholesale-pos': { id: 'wholesale-pos', path: '/wholesale-pos', icon: Store, label: 'مبيعات الجملة', color: 'bg-amber-600', iconColor: 'text-yellow-400' },
    'wholesale-purchases': { id: 'wholesale-purchases', path: '/wholesale-purchases', icon: ShoppingBasket, label: 'مشتريات الجملة', color: 'bg-blue-600', iconColor: 'text-sky-400' },
    'operations-customers': { id: 'operations-customers', path: '/operations-customers', icon: Sparkles, label: 'التجارة الذكية', color: 'bg-indigo-500', iconColor: 'text-cyan-400' },
    'mobile-balance': { id: 'mobile-balance', path: '/mobile-balance', icon: Smartphone, label: labels.balance, color: 'bg-sky-500', iconColor: 'text-sky-400', hideIfNotMobile: true, hideIfWholesale: true },
    'inventory': { id: 'inventory', path: '/inventory', icon: Package, label: 'إدارة المخزن', color: 'bg-amber-500', iconColor: 'text-amber-400' },
    'sim-cards-wh': { id: 'sim-cards-wh', path: '/sim-cards', icon: Cpu, label: 'مخزن الشرائح والبطائق', color: 'bg-purple-500', iconColor: 'text-purple-400' },
    'invoice-scanner': { id: 'invoice-scanner', path: '/invoice-scanner', icon: Camera, label: 'ماسح الفواتير', color: 'bg-indigo-500', iconColor: 'text-violet-400' },
    'warehouse-prep': { id: 'warehouse-prep', path: '/warehouse-prep', icon: ClipboardList, label: 'تجهيز المستودع 📦', color: 'bg-indigo-650', iconColor: 'text-indigo-400' },
    'delivery': { id: 'delivery', path: '/delivery', icon: Truck, label: 'توصيلات السائقين', color: 'bg-amber-500', iconColor: 'text-emerald-400' },
    'shortages': { id: 'shortages', path: '/shortages', icon: AlertCircle, label: 'النواقص والعجز', color: 'bg-rose-600', iconColor: 'text-rose-400' },
    'inventory-match': { id: 'inventory-match', path: '/inventory-match', icon: ShieldCheck, label: 'الجرد والرقابة المخزنية', color: 'bg-emerald-500', iconColor: 'text-teal-400' },
    'damaged': { id: 'damaged', path: '/damaged', icon: AlertCircle, label: 'التالف والفاقد', color: 'bg-rose-500', iconColor: 'text-red-400' },
    'reports': { id: 'reports', path: '/reports', icon: BarChart3, label: 'التقارير الشاملة 📊', color: 'bg-amber-500', iconColor: 'text-blue-400' },
    'archive': { id: 'archive', path: '/archive', icon: History, label: 'أرشيف الفواتير 📂', color: 'bg-slate-500', iconColor: 'text-slate-400' },
    'sim-cards': { id: 'sim-cards', path: '/sim-cards', icon: Smartphone, label: 'الشرائح ورصيد الباقات', color: 'bg-purple-500', iconColor: 'text-purple-400', hideIfNotMobile: true, hideIfWholesale: true },
    'finances': { id: 'finances', path: '/finances', icon: Wallet, label: 'الصناديق والخزائن', color: 'bg-blue-600', iconColor: 'text-emerald-400' },
    'bank-transfers': { id: 'bank-transfers', path: '/bank-transfers', icon: ArrowRightLeft, label: 'الإيداعات البنكية 🏦', color: 'bg-emerald-600', iconColor: 'text-teal-400' },
    'cashier': { id: 'cashier', path: '/cashier', icon: Coins, label: 'تسويات الصراف والشيفتات', color: 'bg-emerald-600', iconColor: 'text-amber-400' },
    'accounts': { id: 'accounts', path: '/accounts', icon: Landmark, label: 'الحسابات والقيود', color: 'bg-cyan-600', iconColor: 'text-cyan-400' },
    'smart-accounting': { id: 'smart-accounting', path: '/smart-accounting', icon: Scale, label: 'التدقيق والمحاسبة ⚖️', color: 'bg-amber-600', iconColor: 'text-amber-400' },
    'market': { id: 'market', path: '/market', icon: Crown, label: 'سوق الموردين 💎', color: 'bg-amber-600', iconColor: 'text-amber-300' },
    'chat': { id: 'chat', path: '/chat', icon: MessageSquare, label: 'الدردشة والتواصل', color: 'bg-pink-600', iconColor: 'text-pink-400' },
    'customers': { id: 'customers', path: '/customers', icon: UserCheck, label: 'العملاء ومديونياتهم', color: 'bg-teal-500', iconColor: 'text-sky-400' },
    'suppliers': { id: 'suppliers', path: '/suppliers', icon: Building2, label: 'الموردين ومستحقاتهم', color: 'bg-cyan-500', iconColor: 'text-cyan-400' },
    'users': { id: 'users', path: '/users', icon: Users, label: 'شؤون الموظفين والصلاحيات', color: 'bg-indigo-500', iconColor: 'text-indigo-400', managerOnly: true },
    'engineer-accounts': { id: 'engineer-accounts', path: '/engineer-accounts', icon: Wrench, label: 'عقود وحسابات المهندسين', color: 'bg-indigo-600', iconColor: 'text-orange-400' },
    'reels-manager': { id: 'reels-manager', path: '/reels-manager', icon: Video, label: 'العروض المرئية للزبائن (فيديو)', color: 'bg-rose-400', iconColor: 'text-rose-400' },
    'owner-control': { id: 'owner-control', path: '/owner-control', icon: Activity, label: 'سجل النشاطات والرقابة', color: 'bg-rose-600', iconColor: 'text-red-500', managerOnly: true },
    'attendance': { id: 'attendance', path: '/attendance', icon: Clock, label: 'سجل الدوام والحضور', color: 'bg-blue-700', iconColor: 'text-blue-400', managerOnly: true },
    'activity-logs': { id: 'activity-logs', path: '/activity-logs', icon: ShieldCheck, label: 'سجل النشاط والرقابة', color: 'bg-slate-700', iconColor: 'text-slate-400', managerOnly: true },
    'smart-import': { id: 'smart-import', path: '/smart-import', icon: Database, label: 'الاستيراد الذكي', color: 'bg-brand-primary', iconColor: 'text-cyan-400', managerOnly: true },
    'settings': { id: 'settings', path: '/settings', icon: SettingsIcon, label: 'الإعدادات العامة للمحل', color: 'bg-slate-500', iconColor: 'text-slate-400' },
    'help': { id: 'help', path: '/help', icon: HelpCircle, label: 'المساعدة والتعليمات', color: 'bg-sky-500', iconColor: 'text-sky-400' },
    'superadmin': { id: 'superadmin', path: '/super-admin', icon: ShieldCheck, label: 'لوحة التحكم للمبرمج (SuperAdmin)', color: 'bg-rose-500', iconColor: 'text-rose-400', superAdminOnly: true },
  };

  const navGroups: NavGroup[] = navStructure.map(group => {
    return {
      title: group.title,
      items: group.items
        .map(itemId => ALL_NAV_ITEMS_MAP[itemId])
        .filter(Boolean)
    };
  });

  const checkPermission = (item: NavItem, profile: any) => {
    if (!profile) return false;

    const roleLower = (profile.role || profile.userRole || '').toLowerCase();
    const tierLower = (profile.businessTier || profile.userTier || profile.tier || '').toLowerCase();

    // 1. إذا كان الحساب المصنف "زبون" (customer) يتم حجب كافة اللوحات الإدارية فوراً
    if (roleLower === 'customer' || roleLower === 'retail_customer' || roleLower === 'client') return false;

    // Define owner/manager/shop admin roles & tiers
    const isOwnerOrManager = [
      'manager', 'superadmin', 'owner', 'wholesaler', 'wholesale', 
      'distributor', 'retailer', 'retail', 'importer', 
      'master_wholesale', 'mega_wholesale', 'admin', 'developer'
    ].includes(roleLower) || 
    ['wholesale', 'mega_wholesale', 'importer', 'master_wholesale', 'wholesale_master'].includes(tierLower) ||
    ['a777503191@gmail.com'].includes((profile.email || '').toLowerCase());

    // Check if item is explicitly activated by OTA HotFix Patch
    const hotfixActiveModules = liveHotFixEngine.getActiveModuleOverrides();
    if (hotfixActiveModules.includes(item.id)) {
      return true;
    }

    // 2. إدارة شؤون الموظفين والصلاحيات والمستخدمين (users) تظهر للمدير والمشرف العام وصاحب المحل
    if (item.id === 'users') {
      return isOwnerOrManager;
    }

    // 3. إدارة الديون والزبائن وكشوف الحسابات (customers) تظهر لإدارة المبيعات والمدراء والمشرفين والشركاء
    if (item.id === 'customers') {
      const allowedRoles = ['manager', 'superadmin', 'sales', 'wholesaler', 'wholesale', 'distributor', 'importer'];
      return isOwnerOrManager || allowedRoles.includes(roleLower);
    }

    // 4. حماية وتأمين العمليات الحساسة كالخزنة، الحسابات، والموردين والتحكم المالي
    const sensitiveFinanceItems = ['finances', 'accounts', 'suppliers', 'owner-control', 'smart-import'];
    if (sensitiveFinanceItems.includes(item.id)) {
      return isOwnerOrManager;
    }

    // الموظفين العاديين يظهر لهم الفواتير، الجرد، والصيانة بشكل افتراضي
    return true;
  };

  const isUserOwnerOrManager = profile ? (
    [
      'manager', 'superadmin', 'owner', 'wholesaler', 'wholesale', 
      'distributor', 'retailer', 'retail', 'importer', 
      'master_wholesale', 'mega_wholesale', 'admin', 'developer'
    ].includes(((profile.role || profile.userRole || '') as string).toLowerCase()) ||
    ['wholesale', 'mega_wholesale', 'importer', 'master_wholesale', 'wholesale_master'].includes(((profile.businessTier || profile.userTier || profile.tier || '') as string).toLowerCase()) ||
    ['a777503191@gmail.com', 'joad7723@gmail.com', 'mm@gmail.com', 'qq77@gmail.com'].includes(profile.email?.toLowerCase() || '')
  ) : false;

  const filteredGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter((item: NavItem) => {
      // 0. Customer Restriction: Customers only see specific modules if allowed, or nothing in main layout
      const roleLower = (profile?.role || '').toLowerCase();
      if (roleLower === 'customer' || roleLower === 'retail_customer' || roleLower === 'client') return false;
      if (!checkPermission(item, profile)) return false;

      // 0.5. Automatic Business Type Hiding Rule (خاصية الاختفاء التلقائي)
      if (isModuleAutoHidden(item.id, profile)) return false;

      // Master Developer & SuperAdmin Page Protection: Visible ONLY to project owner/master developer
      if (item.id === 'superadmin' || item.superAdminOnly) {
        const masterEmails = ['a777503191@gmail.com'];
        const isMaster = masterEmails.includes((profile?.email || '').toLowerCase().trim()) ||
                         ['superadmin', 'developer', 'master_developer'].includes((profile?.role || '').toLowerCase().trim());
        if (!isMaster) return false;
      }

      // 1. الخصوصية: هل الوحدة مفعلة لهذا المستخدم/المحل؟
      if (item.id === 'reels-manager') {
        const hasReelsAccess = profile?.is_promo_video_enabled !== false || isUserOwnerOrManager;
        if (!hasReelsAccess) return false;
      } else if (item.id === 'owner-control' || item.id === 'smart-import') {
        // لوحة رقابة المالك والاستيراد الذكي تظهر دائماً للملاك والمدراء
        if (!isUserOwnerOrManager) return false;
      } else {
        // إذا تم تحديد وحدات مخصصة بدقة من لوحة المبرمج
        if (profile?.enabledModules && profile.enabledModules.length > 0 && !profile.enabledModules.includes(item.id)) return false;
      }
      
      // 3. JAM Isolation & Role Hierarchy
      if (!isUserOwnerOrManager && item.managerOnly) return false;

      // Sales Role Restrictions: Only sales and related modules
      if (roleLower === 'sales') {
        const allowedSalesItems = ['sales', 'wholesale-pos', 'operations-customers', 'customers', 'chat'];
        if (!allowedSalesItems.includes(item.id)) return false;
      }

      // Delivery Agent Restrictions: Only delivery and chat
      if (roleLower === 'delivery_agent') {
        const allowedDeliveryItems = ['delivery', 'chat'];
        if (!allowedDeliveryItems.includes(item.id)) return false;
      }

      // Cashier Restrictions: Only cashier, finances and chat
      if (roleLower === 'cashier') {
        const allowedCashierItems = ['cashier', 'finances', 'chat'];
        if (!allowedCashierItems.includes(item.id)) return false;
      }

      // Staff Role Restrictions: Only preparation and inventory
      if (roleLower === 'staff') {
        const allowedStaffItems = ['warehouse', 'warehouse-prep', 'shortages', 'inventory', 'archive', 'chat', 'finances'];
        if (!allowedStaffItems.includes(item.id)) return false;
      }

      // General Employee/Engineer Restrictions
      const sensitiveFinanceItems = ['finances', 'accounts', 'suppliers', 'inventory-match', 'owner-control', 'smart-import'];
      if (!isUserOwnerOrManager) {
        if (roleLower !== 'staff' && sensitiveFinanceItems.includes(item.id)) return false;
      }
      
      // 4. Interface Customization (SuperAdmin Control)
      if (profile?.interfaceCustomization?.desktopPages && profile.interfaceCustomization.desktopPages.length > 0) {
        // Map the IDs if they don't match exactly. 
        // SuperAdmin uses IDs like 'full_dashboard', 'bulk_sales', etc.
        // We will map those to our navigation item IDs.
        const mapping: Record<string, string[]> = {
          'full_dashboard': ['dashboard'],
          'bulk_sales': ['wholesale-pos', 'wholesale-purchases'],
          'analytics': ['reports'],
          'hr_management': ['users', 'attendance'],
          'settings': ['settings'],
          'financial_center': ['finances', 'accounts', 'customers', 'suppliers'],
          'warehouse_control': ['inventory', 'warehouse', 'shortages', 'inventory-match', 'archive'],
          'system_logs': ['activity-logs']
        };

        const allowedNavIds = profile.interfaceCustomization.desktopPages.flatMap(customId => mapping[customId] || [customId]);
        
        // If customization is set, restrict to only those pages
        if (!allowedNavIds.includes(item.id)) return false;
      }

      return true;
    })
  })).filter(group => group.items.length > 0);

  const rawAllNavItems = [
    { id: 'dashboard', path: '/dashboard', label: 'لوحة التحكم الرئيسية', icon: LayoutDashboard, color: 'bg-brand-primary' },
    ...filteredGroups.flatMap(group => group.items)
  ];

  const allNavItems = rawAllNavItems.filter((item, index, self) => 
    index === self.findIndex(t => t.id === item.id)
  );

  const handleLogout = () => {
    // Extensive cleanup for security lockdown & session clearing
    FirebaseProjectRouter.clearUserSessionFast();
    localStorage.removeItem('jam_guest_recovery_force_owner');
    localStorage.removeItem('customerPhone');
    localStorage.removeItem('customerName');
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('current_shop_id');
    localStorage.removeItem('jam_session_verified');
    localStorage.removeItem('jam_remembered_username');
    localStorage.removeItem('jam_remembered_password');
    localStorage.removeItem('jam_remember_me');
    localStorage.setItem('jam_user_logged_out', 'true');
    
    sessionStorage.clear();
    sessionStorage.setItem('just_logged_out', 'true');
    
    auth.signOut().then(() => {
      const shopParam = new URLSearchParams(window.location.search).get('shop');
      if (shopParam) {
        window.location.href = `${window.location.origin}${window.location.pathname}?shop=${shopParam}#/login`;
      } else {
        window.location.href = `${window.location.origin}${window.location.pathname}#/login`;
      }
      window.location.reload();
    });
  };

  const [pinnedShortcuts, setPinnedShortcuts] = useState<string[]>(() => {
    const saved = localStorage.getItem('jam-pinned-shortcuts');
    return saved ? JSON.parse(saved) : ['sales', 'inventory', 'maintenance', 'smart-import'];
  });

  const availableShortcuts = allNavItems.filter(item => 
    !['dashboard', 'settings', 'help', 'super-admin'].includes(item.id)
  );

  const activeShortcuts = pinnedShortcuts
    .map(id => allNavItems.find(item => item.id === id))
    .filter(Boolean) as NavItem[];

  const toggleShortcut = (id: string) => {
    setPinnedShortcuts(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id].slice(-4);
      localStorage.setItem('jam-pinned-shortcuts', JSON.stringify(next));
      return next;
    });
  };

  const activeShopId = profile?.ownerId || (profile as any)?.shopId || shopSettings?.shopId || shopSettings?.ownerId || profile?.uid || '';

  const mappedNotifications = notifications
    .filter((notif: any) => {
      if (!notif) return false;
      if (notif.ownerId && activeShopId && notif.ownerId !== activeShopId) return false;
      if (notif.shopId && activeShopId && notif.shopId !== activeShopId) return false;
      return true;
    })
    .map((notif: any) => {
      let category: 'FINANCIAL' | 'LOGISTICS' | 'NETWORK' = 'LOGISTICS';
      const typeLower = (notif.type || '').toLowerCase();
      const msgLower = (notif.message || '').toLowerCase();
      if (typeLower === 'payment' || msgLower.includes('حوالة') || msgLower.includes('دفع') || msgLower.includes('سداد') || msgLower.includes('صرف')) {
        category = 'FINANCIAL';
      } else if (msgLower.includes('شبك') || msgLower.includes('توصيل') || msgLower.includes('سيرفر') || msgLower.includes('تحديث')) {
        category = 'NETWORK';
      } else {
        category = 'LOGISTICS';
      }

      return {
        id: notif.id,
        title: notif.title || 'إشعار نظام',
        message: notif.message || '',
        category,
        isRead: !!notif.read || notif.status === 'read' || !!notif.isRead,
        createdAt: notif.createdAt
      };
    });

  const counters = {
    financial: mappedNotifications.filter(n => n.category === 'FINANCIAL' && !n.isRead).length,
    logistics: mappedNotifications.filter(n => n.category === 'LOGISTICS' && !n.isRead).length,
    network: mappedNotifications.filter(n => n.category === 'NETWORK' && !n.isRead).length,
    total: mappedNotifications.filter(n => !n.isRead).length
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const notifRef = doc(db, 'notifications', id);
      await updateDoc(notifRef, { read: true });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const isPortal = location.pathname === '/portal';
  const isCustomer = profile?.role === 'customer' || 
                     profile?.role === 'RETAIL_CUSTOMER' || 
                     profile?.role === 'Customer/Client' || 
                     profile?.role === 'Client' || 
                     profile?.role?.toLowerCase() === 'customer' || 
                     profile?.role?.toLowerCase() === 'client';

  const getPageThemeClass = () => {
    // Unify all layouts under the strict dual-mode theme to eliminate random colors and contrast issues
    return '';
  };

  if (isPortal || isCustomer) {
    return (
      <div className={`min-h-screen bg-[#0e1116] text-white overflow-x-hidden select-none jam-app-shell ${!showLegacyUIBorders ? 'hide-global-borders' : ''} ${!showLegacyLoadingSpinners ? 'kill-global-spinners' : ''} ${globalActionTimeout === 0 ? 'instant-mode' : ''}`}>
        {children}
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans rtl bg-app-bg ${(isFakeFullscreen || isFullscreen) ? '!fixed !inset-0 !z-[999999] !w-screen !h-screen !max-w-none !max-h-none bg-app-bg' : ''} ${getPageThemeClass()} jam-app-shell ${!showLegacyUIBorders ? 'hide-global-borders' : ''} ${!showLegacyLoadingSpinners ? 'kill-global-spinners' : ''} ${globalActionTimeout === 0 ? 'instant-mode' : ''}`}>
      {/* [DELETED] Global Connection Toast removed to satisfy global silence rule */}

      {/* 🔴 Consolidated Luxury Title Bar - Replaces legacy scattered headers */}
      {profile && (
        <JamLuxuryUnifiedHeader 
          profile={profile}
          shopSettings={shopSettings}
          storeName={shopSettings?.shopName || profile?.shopName || 'نظام المحفلي الرئيسي'}
          userRole={profile.role || 'SALES_STAFF'}
          currentPageTitle={currentTitle}
          totalPendingTasks={counters.total}
          onMasterBellClick={() => setIsJamPanelOpen(!isJamPanelOpen)}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onToggleOrdersDrawer={() => setShowOrdersDrawer(!showOrdersDrawer)}
          pendingOrdersCount={pendingOrdersCount}
          isFullscreen={isFullscreen || isFakeFullscreen}
          onToggleFullscreen={toggleFullscreen}
          isOrdersDrawerOpen={showOrdersDrawer}
          isJamPanelOpen={isJamPanelOpen}
          onLogout={handleLogout}
          onOpenDailyShiftClose={() => setIsDailyShiftModalOpen(true)}
          onOpenVariantsSelector={() => setIsVariantsModalOpen(true)}
          onOpenSmartAccountant={() => setIsSmartAccountantOpen(true)}
          onOpenKeyGen={() => {
            const email = (profile?.email || '').toLowerCase().trim();
            const role = (profile?.role || '').toLowerCase();
            const businessType = (profile?.businessType || '').toLowerCase();
            const status = (profile?.status || '').toLowerCase();
            const rank = (profile?.rank || '').toLowerCase();
            const hierarchyLevel = profile?.hierarchyLevel;

            const isRetail = role === 'retailer' || 
                             role === 'retail' || 
                             role === 'customer' || 
                             businessType === 'retail' || 
                             businessType === 'retailer' || 
                             status === 'retail' || 
                             status === 'retailer' || 
                             rank === 'retail' || 
                             rank === 'retailer' || 
                             hierarchyLevel === 4;

            if (isRetail) {
              alert('عذراً، محلات التجزئة محظورة تماماً من توليد مفاتيح الارتباط.');
              return;
            }

            const isImporter = role === 'importer' || businessType === 'importer' || hierarchyLevel === 1 || rank === 'importer';
            const isGrandWholesaler = role === 'master_wholesale' || role === 'mega_wholesale' || businessType === 'master_wholesale' || businessType === 'mega_wholesale' || hierarchyLevel === 2 || rank === 'master_wholesale' || rank === 'mega_wholesale';
            const isWholesaler = role === 'wholesaler' || role === 'wholesale' || role === 'supplier' || role === 'distributor' || businessType === 'wholesale' || businessType === 'wholesaler' || hierarchyLevel === 3 || rank === 'wholesale' || rank === 'wholesaler';
            const isManagerStaff = email.endsWith('@jam.com') || role === 'manager';
            const isSuperOrOwner = role === 'superadmin' || role === 'owner';

            if (isImporter || isGrandWholesaler || isWholesaler || isManagerStaff || isSuperOrOwner) {
              setIsKeyGenOpen(true);
            } else {
              alert('عذراً، توليد مفاتيح الارتباط متاح للمستوردين وتجار الجملة وإدارتهم فقط.');
            }
          }}
        />
      )}

      {/* Golden Hijri and Gregorian DateTime Row for Mobile */}
      {profile && <MobileLayoutClock />}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Floating Menu Button - Ergonomic Golden FAB for both Mobile & Desktop Screens */}
        {isSecured && (
          <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[250] flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className={`p-3 sm:p-3.5 bg-gradient-to-r from-[#d4af37] via-yellow-400 to-[#ffd700] text-slate-950 rounded-2xl shadow-[0_8px_25px_rgba(212,175,55,0.45)] border-2 border-yellow-200 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center gap-2 group ${
                !isSidebarOpen ? 'animate-pulse' : ''
              }`}
              title={isSidebarOpen ? "إغلاق القائمة الجانبية" : "فتح القائمة الجانبية (مثل الأندرويد)"}
            >
              <Menu size={22} className="stroke-[3]" />
              <span className="hidden md:inline-block text-xs font-black tracking-tight text-slate-950">
                {isSidebarOpen ? "إغلاق القائمة ✕" : "القائمة الرئيسية ☰"}
              </span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full mb-3 right-0 hidden group-hover:flex items-center z-[110] pointer-events-none">
                <div className="bg-slate-950 text-white text-xs font-black rounded-xl px-3 py-1.5 shadow-2xl border border-brand-primary/40 whitespace-nowrap">
                  {isSidebarOpen ? "إغلاق القائمة الجانبية (Ctrl+B)" : "فتح القائمة الجانبية (مثل الأندرويد) ☰"}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Collapsed Narrow Sidebar Icons (Sleek vertical desktop strip when sidebar is closed) */}
        {!isSidebarOpen && isSecured && (
          <aside 
            style={{
              background: isDark ? '#090d16' : '#ffffff',
              borderLeft: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0'
            }}
            className="fixed inset-y-0 right-0 z-[85] w-14 md:w-16 flex flex-col items-center py-3 gap-2 flex-shrink-0 border-l border-white/5 hidden sm:flex justify-between overflow-hidden"
          >
            {/* Top Section: Toggle button to expand list */}
            <div className="flex flex-col items-center gap-3 w-full">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-r from-[#d4af37]/20 via-yellow-400/10 to-[#ffd700]/20 border-2 border-yellow-500/30 text-[#ffd700] hover:scale-105 hover:border-yellow-400 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center group relative"
                title="فتح القائمة الجانبية (نظام الكمبيوتر)"
              >
                <Menu size={18} className="stroke-[2.5]" />
                
                {/* Tooltip */}
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-[110] pointer-events-none">
                  <div className="w-1.5 h-1.5 bg-slate-950 border-r border-t border-brand-primary/30 rotate-45 -mr-[4px] z-10" />
                  <div className="bg-slate-950 text-white text-[10px] md:text-xs font-black rounded-xl px-3 py-1.5 shadow-[0_4px_25px_rgba(0,0,0,0.6)] border border-brand-primary/40 whitespace-nowrap">
                    فتح القائمة الجانبية (نظام الكمبيوتر) ☰
                  </div>
                </div>
              </button>

              <div className="h-px w-8 bg-slate-800" />
            </div>

            {/* Middle Section: Scrollable active menu icons */}
            <div className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-2.5 py-2 px-1">
              {allNavItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const isMarket = item.id === 'market';
                const hasB2bBadge = isMarket && pendingB2bRequestsCount > 0;
                return (
                  <div key={item.id} className="relative group flex items-center justify-center">
                    <button
                      onClick={() => navigate(item.path)}
                      className={`relative w-10 h-10 md:w-11 md:h-11 rounded-xl transition-all duration-250 flex items-center justify-center border-2 active:scale-95 cursor-pointer ${
                        isActive
                          ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-[0_0_12px_rgba(212,175,55,0.25)] font-black'
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 hover:border-slate-700'
                      }`}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      {hasB2bBadge && (
                        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[17px] h-[17px] px-1 bg-gradient-to-r from-red-600 to-amber-500 text-white text-[9px] font-mono font-black rounded-full border border-white/20 animate-pulse shadow-md">
                          {pendingB2bRequestsCount}
                        </span>
                      )}
                    </button>
                    
                    {/* Tooltip */}
                    <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-[110] pointer-events-none">
                      <div className="w-1.5 h-1.5 bg-slate-950 border-r border-t border-brand-primary/30 rotate-45 -mr-[4px] z-10" />
                      <div className="bg-slate-950 text-white text-[10px] md:text-xs font-black rounded-xl px-3 py-1.5 shadow-[0_4px_25px_rgba(0,0,0,0.6)] border border-brand-primary/40 whitespace-nowrap">
                        {item.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="h-px w-8 bg-slate-800" />
              <div className="relative group flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    const evt = new CustomEvent('app-trigger-sync');
                    window.dispatchEvent(evt);
                  }}
                  className="w-10 h-10 rounded-xl bg-slate-900/40 border border-slate-800 text-teal-400 hover:text-teal-300 hover:bg-slate-800 flex items-center justify-center transition-all cursor-pointer"
                >
                  <RefreshCw size={14} />
                </button>
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-[110] pointer-events-none">
                  <div className="w-1.5 h-1.5 bg-slate-950 border-r border-t border-brand-primary/30 rotate-45 -mr-[4px] z-10" />
                  <div className="bg-slate-950 text-white text-[10px] md:text-xs font-black rounded-xl px-3 py-1.5 shadow-xl border border-brand-primary/40 whitespace-nowrap">
                    تحديث ومزامنة الصفحة 🔄
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content (Shifted dynamically when sidebar is open or closed for seamless side-by-side view) */}
        <main className={`flex-1 flex flex-col min-w-0 bg-app-bg overflow-hidden transition-all duration-300 ${
          isSidebarOpen && isSecured 
            ? 'sm:mr-72 md:mr-80' 
            : isSecured 
              ? 'sm:mr-14 md:mr-16' 
              : ''
        }`}>
          {/* Global Alerts Bar */}
          <AnimatePresence>
            {globalAlerts.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-header-bg border-b border-white/10 overflow-hidden"
              >
                <div className="w-full max-w-[1920px] mx-auto px-4 py-2 flex items-center gap-4 overflow-x-auto no-scrollbar">
                  {globalAlerts.map((alert, idx) => (
                    <div 
                      key={`global-alert-${alert.id || idx}-${idx}`} 
                      className={`flex-shrink-0 flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-bold border ${
                        alert.type === 'error' ? 'bg-danger/10 border-danger/20 text-danger' :
                        alert.type === 'warning' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      }`}
                    >
                      <AlertCircle size={12} />
                      {alert.message}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
            {/* Page Title in Content wrapped in our Cinematic Graphic Terminal Box */}
            <div className="mb-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6" key={`title-wrapper-${location.pathname}`}>
              <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
                <CinematicTitleTerminal 
                  key={location.pathname}
                  arabicLabel={currentTitle}
                  shopName={shopSettings?.shopName || profile?.shopName || 'JAM SYSTEM PRO'}
                  isDark={isDark}
                />

                {/* 🔱 VIP Customer Portal Gateway Button positioned right next to Active Page Title Container */}
                <button
                  onClick={() => setIsVipModalOpen(true)}
                  className="py-2.5 px-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-400 hover:from-yellow-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-[0_4px_20px_rgba(214,175,55,0.25)] border border-yellow-300 flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.03] active:scale-95 mx-2 my-1 cursor-pointer"
                  style={{ minWidth: '150px' }}
                  title="بوابة تطبيق الزبائن VIP (رابط المتجر وتطبيق الزبائن)"
                >
                  <Crown size={14} className="text-slate-950 animate-bounce" />
                  <span>🔱 تطبيق الزبائن [VIP]</span>
                </button>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap md:flex-nowrap justify-end w-full sm:w-auto pb-2 sm:pb-0">
                {/* Connection Status Indicator */}

                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${isOnline ? 'bg-success/10 border-success/20 text-success' : 'bg-warning/10 border-warning/20 text-warning'}`}>
                  <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-warning'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">
                    {isOnline ? 'متصل' : 'أوفلاين'}
                  </span>
                </div>
              </div>
            </div>

            {/* محتوى الصفحة الرئيسي المعزول تماماً ضد أي تحريك أو سحب عرضي، مع الحفاظ على ملاءمة الأبعاد */}
            <div className="w-full overflow-x-hidden" style={{ touchAction: 'pan-y' }}>
              {children}
              <OnboardingGuide profile={profile} />
              <JAMUltimateOptimizer profile={profile} />
              <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
            </div>

            {/* Beautiful, High-Contrast Copyright Footer */}
            <footer className="mt-16 pt-8 border-t border-gray-100 dark:border-white/5 text-center space-y-2 pb-6">
              <p className="text-xs font-black text-slate-400 dark:text-gray-400">
                جميع الحقوق محفوظة © {new Date().getFullYear()} <span className="text-brand-primary">JAM System Pro</span>
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-gray-500 max-w-md mx-auto leading-relaxed">
                المنصة الرقمية المتكاملة لربط وإدارة المحلات التجارية ومراكز الصيانة.
              </p>
              <p className="text-[10px] font-black text-slate-500 dark:text-gray-400">
                م. عبد الغني المحفلي | 772315106
              </p>
            </footer>
          </div>
        </main>

        {/* Modern Live Notification Center & Floating Badge */}
        <NotificationManager profile={profile} shopSettings={shopSettings} />

        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm z-[80] sm:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar Reorganized to Primary Right Side (Matches Screenshot 2) */}
        <aside 
          ref={sidebarRef}
          style={{
            background: isDark ? '#090d16' : '#ffffff',
            borderLeft: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0'
          }}
          className={`fixed inset-y-0 right-0 z-[90] w-72 max-w-[85vw] sm:w-80 text-sidebar-text transition-all duration-500 ease-in-out flex flex-col jam-sidebar ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
            {/* Navigation Header */}
            <div className="px-6 h-16 flex items-center justify-between mb-2">
              <div className="flex flex-col">
                <span className="text-[16px] font-black tracking-tight text-white line-clamp-1" title={shopSettings?.shopName || profile?.shopName || 'JAM System'}>
                  {shopSettings?.shopName || profile?.shopName || 'JAM System'}
                </span>
                <span className="text-[9px] font-black text-[#d4af37] tracking-[0.3em] uppercase">PRO VERSION</span>
              </div>
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d4af37]/30 bg-black/40 overflow-hidden group">
                <div className="absolute inset-0 bg-[#d4af37]/10 group-hover:bg-[#d4af37]/20 transition-all" />
                <img 
                  src={SYSTEM_LOGO} 
                  alt="Logo" 
                  className="w-8 h-8 object-contain relative z-10" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Google Chrome Style Zoom Control */}
            <div className="px-6 py-2">
              <ChromeZoomControl
                fontSize={fontSize}
                onFontSizeChange={(newSize) => setFontSize(newSize)}
                min={9}
                max={24}
                defaultSize={13}
              />
            </div>

            {/* Quick Menu Customizer Toggle Button */}
            <div className="px-6 py-1">
              <button
                onClick={() => setIsCustomizingNav(prev => !prev)}
                className={`w-full py-2 px-3 rounded-2xl text-[10px] font-black flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  isCustomizingNav 
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_4px_15px_rgba(245,158,11,0.3)] font-black' 
                    : 'bg-white/5 hover:bg-white/10 text-white/70 border-white/5'
                }`}
              >
                <ArrowRightLeft size={12} className={isCustomizingNav ? "animate-spin text-slate-950" : ""} />
                <span>{isCustomizingNav ? "حفظ وإغلاق الترتيب 💾" : "تعديل ترتيب القوائم ⚙️"}</span>
              </button>
            </div>

            {/* Navigation Groups */}
            <div className="p-4 space-y-4">
              {isCustomizingNav && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-amber-300 leading-normal text-right">
                    وضع تعديل القائمة: اسحب الصفحة وصنفها أو استخدم الأسهم للتحريك داخل المجموعة، أو انقلها لموقع آخر عبر الخيارات.
                  </p>
                  <button
                    onClick={resetNavStructure}
                    className="py-1 px-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-[9px] font-black transition-all self-end flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={10} />
                    <span>ضبط المصنع لقوائم النظام</span>
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">القائمة الرئيسية</p>
                <NavLink 
                  item={{ id: 'dashboard', path: '/dashboard', icon: LayoutDashboard, label: 'لوحة التحكم والمتابعة', color: 'bg-brand-primary' }} 
                  pathname={location.pathname}
                  unreadMessages={unreadMessages}
                  pendingB2bRequestsCount={pendingB2bRequestsCount}
                  fontSize={13}
                  onClick={handleNavClick}
                  showGuide={sidebarGuide && isWithinOneDay}
                />
              </div>

              {filteredGroups.map(group => {
                const isOpen = expandedGroups.includes(group.title);
                return (
                  <div 
                    key={group.title} 
                    onDragOver={isCustomizingNav ? handleDragOverGroup : undefined}
                    onDrop={isCustomizingNav ? ((e) => handleDropOnGroup(e, group.title)) : undefined}
                    className={`flex flex-col gap-1 pt-2 ${showLegacyUIBorders ? 'border-t border-white/5' : 'border-none'}`}
                  >
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleGroup(group.title);
                      }}
                      className="flex items-center justify-between py-1.5 px-2.5 rounded-xl text-amber-400/90 bg-slate-900/60 hover:text-amber-300 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 transition-all w-full text-right cursor-pointer group/cat select-none shadow-sm"
                    >
                      <span className="text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider text-amber-300 group-hover/cat:text-amber-200 transition-colors flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                        {group.title}
                      </span>
                      {isOpen ? <ChevronUp size={13} className="text-amber-400" /> : <ChevronDown size={13} className="opacity-70 group-hover/cat:opacity-100 text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-1">
                        {group.items.map((item, index) => {
                          if (isCustomizingNav) {
                            return (
                              <div 
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, item.id, group.title)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDropOnItem(e, group.title, index)}
                                className={`flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/50 transition-all gap-1.5 cursor-grab active:cursor-grabbing ${
                                  draggedItemId === item.id ? 'opacity-40 border-dashed border-amber-500' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Menu size={14} className="text-white/40 flex-shrink-0" />
                                  <div className={`w-2 h-2 rounded-full ${item.color || 'bg-brand-primary'} flex-shrink-0`} />
                                  <span className="text-[10px] font-bold text-white truncate max-w-[160px]" title={item.label}>
                                    {item.label}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => shiftItemIndex(item.id, group.title, 'up')}
                                    disabled={index === 0}
                                    className="p-1 bg-white/5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                                    title="تحريك لأعلى"
                                  >
                                    <ChevronUp size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => shiftItemIndex(item.id, group.title, 'down')}
                                    disabled={index === group.items.length - 1}
                                    className="p-1 bg-white/5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                                    title="تحريك لأسفل"
                                  >
                                    <ChevronDown size={11} />
                                  </button>

                                  <select
                                    value={group.title}
                                    onChange={(e) => {
                                      const targetGroupTitle = e.target.value;
                                      if (targetGroupTitle !== group.title) {
                                        moveItemToGroup(item.id, group.title, targetGroupTitle);
                                      }
                                    }}
                                    style={{ direction: 'rtl' }}
                                    className="bg-slate-900 border border-white/10 rounded px-1 py-0.5 text-[8px] font-black text-brand-primary outline-none cursor-pointer"
                                  >
                                    {navStructure.map(g => (
                                      <option key={g.title} value={g.title} className="bg-slate-950 text-white text-[9px]">
                                        {g.title === 'العمليات الأساسية' ? 'العمليات' :
                                         g.title === 'المخزون والمستودع' ? 'المخازن' :
                                         g.title === 'المالية والشركاء' ? 'المالية' :
                                         g.title === 'الالمنتج والرقابة' || g.title === 'الرقابة والإدارة' ? 'الرقابة' : g.title}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <NavLink 
                                key={item.id} 
                                item={item} 
                                pathname={location.pathname}
                                unreadMessages={unreadMessages}
                                pendingB2bRequestsCount={pendingB2bRequestsCount}
                                fontSize={13}
                                onClick={handleNavClick}
                                showGuide={sidebarGuide && isWithinOneDay}
                              />
                            );
                          }
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar Footer (Socials & Logout) */}
          <div className="p-4 pb-6 bg-sidebar-bg/50 backdrop-blur-sm border-t border-brand-primary/10 space-y-4">
            <div className="flex gap-2 w-full">
              <a 
                href="https://wa.me/967772315106?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%20%D9%85%D8%B7%D9%88%D8%B1%20JAM%20System%20Pro%D8%8C%20%D8%A3%D8%AD%D8%AA%D8%A7%D8%AC%20%D8%A5%D9%84%D9%89%20%D8%AF%D8%B9%D9%85%20%D9%81%D9%86%D9%8A"
                target="_blank" 
                rel="noreferrer"
                className="flex-1 h-9 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-xl flex items-center justify-center gap-1 hover:scale-[1.02] active:scale-95 transition-all border border-green-500/20 shadow-md text-[10px] font-black px-1"
                title="تواصل مباشر عبر الواتساب"
              >
                <MessageSquare size={14} />
                <span>تواصل مباشر</span>
              </a>

              <button 
                onClick={handleLogout}
                className="flex-1 h-9 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center gap-1 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 text-[10px] font-black shadow-md shadow-red-500/5 group px-1 text-center"
                title="تسجيل الخروج الرسمي"
              >
                <LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />
                <span>تسجيل الخروج</span>
              </button>
            </div>

            <div className="text-center pt-2 border-t border-white/5">
               <p className="text-[8px] font-black text-sidebar-text/30 uppercase tracking-widest mb-1 text-center">Developed By</p>
               <div className="flex flex-col gap-0.5 text-center">
                  <p className="text-[9px] font-bold text-sidebar-text/50">ENG. ABDULGHANI ALMAHFALI</p>
                  <p className="text-[11px] font-black text-brand-primary tracking-[0.15em]">772315106</p>
               </div>
            </div>
          </div>
        </aside>
      </div>

      <OrdersDrawer 
        isOpen={showOrdersDrawer} 
        onClose={() => setShowOrdersDrawer(false)} 
        profile={profile} 
      />

      <VaultModal 
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        ownerId={profile?.ownerId || ''}
      />

      <AnimatePresence>
        {isProcessing && showLegacyLoadingSpinners && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-navy-900/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-6"
          >
            <div className="space-y-6">
              <div className="w-24 h-24 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto" />
              <h3 className="text-2xl font-black text-white">{processingMessage}</h3>
              <p className="text-gray-400 text-sm">يرجى الانتظار، جاري تنفيذ العملية بأمان...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isSecured && (
        <>
          <BubbleChat profile={profile} />
          <JamQuickScratchPad />
          <JamFloatingActionDock />
          <JAMSmartAssistant />
        </>
      )}
      <JamSidePanelWithNotifications 
        isOpen={isJamPanelOpen}
        onClose={() => setIsJamPanelOpen(false)}
        notifications={mappedNotifications}
        counters={counters}
        transientToast={transientToast}
        onMarkAsRead={handleMarkAsRead}
      />
      <JamGlobalFinancialModals 
        profile={profile}
        isOpen={jamGlobalModalType !== null}
        type={jamGlobalModalType}
        onClose={() => setJamGlobalModalType(null)}
        onSuccess={(message) => {
          setTransientToast({ show: true, message });
          setTimeout(() => setTransientToast(null), 5000);
        }}
      />
      <AnimatePresence>
        {isVipModalOpen && (
          <VipActivationModal 
            isOpen={isVipModalOpen}
            onClose={() => setIsVipModalOpen(false)}
            profile={profile}
          />
        )}
      </AnimatePresence>

      {/* ⏳ Daily 3-Day Trial / Expiration Warning Card Modal */}
      <TrialExpirationNoticeModal profile={profile} />

      {/* 🤖 ✨ المحاسب الذكي - AI Smart Accountant Drawer */}
      <AnimatePresence>
        {profile && isSmartAccountantOpen && (
          <SmartAIAccountantModal
            isOpen={isSmartAccountantOpen}
            onClose={() => setIsSmartAccountantOpen(false)}
            profile={profile}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 z-50 bg-[#0d1527] border-2 border-[#cf8a3c]/30 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 backdrop-blur-md"
          >
            <div className={`p-2 rounded-xl ${activeToast.type === 'offline' ? 'bg-amber-500/15 text-amber-500 animate-pulse' : 'bg-emerald-500/15 text-emerald-500'}`}>
              <AlertCircle size={20} />
            </div>
            <div className="flex-1 text-right">
              <h4 className="text-xs font-black tracking-wider text-[#cf8a3c]">
                {activeToast.type === 'offline' ? 'مذكرة اتصال أوفلاين' : 'مذكرة نظام البث'}
              </h4>
              <p className="text-xs font-bold text-gray-200 mt-1 leading-relaxed">
                {activeToast.message}
              </p>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
        {/* 🗝️ Premium Metallic Key Generator Modal */}
        <AnimatePresence>
          {isKeyGenOpen && (() => {
            const email = (profile?.email || '').toLowerCase().trim();
            const role = (profile?.role || '').toLowerCase();
            const businessType = (profile?.businessType || '').toLowerCase();
            const status = (profile?.status || '').toLowerCase();
            const rank = (profile?.rank || '').toLowerCase();
            const hierarchyLevel = profile?.hierarchyLevel;

            const isRetail = role === 'retailer' || 
                             role === 'retail' || 
                             businessType === 'retail' || 
                             businessType === 'retailer' || 
                             status === 'retail' || 
                             status === 'retailer' || 
                             rank === 'retail' || 
                             rank === 'retailer' || 
                             hierarchyLevel === 4;

            if (isRetail) return null;

            const isImporter = role === 'importer' || businessType === 'importer' || hierarchyLevel === 1 || rank === 'importer';
            const isGrandWholesaler = role === 'master_wholesale' || role === 'mega_wholesale' || businessType === 'master_wholesale' || businessType === 'mega_wholesale' || hierarchyLevel === 2 || rank === 'master_wholesale' || rank === 'mega_wholesale';
            const isWholesaler = role === 'wholesaler' || role === 'wholesale' || role === 'supplier' || role === 'distributor' || businessType === 'wholesale' || businessType === 'wholesaler' || hierarchyLevel === 3 || rank === 'wholesale' || rank === 'wholesaler';
            const isManagerStaff = email.endsWith('@jam.com') || role === 'manager';
            const isSuperOrOwner = role === 'superadmin' || role === 'owner';

            if (!(isImporter || isGrandWholesaler || isWholesaler || isManagerStaff || isSuperOrOwner)) {
              return null;
            }

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] bg-navy-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 20 }}
                  className={`w-full max-w-lg rounded-3xl border p-6 text-right space-y-6 ${
                    isDark 
                      ? 'bg-slate-950 border-white/10 text-white shadow-[0_0_50px_rgba(245,158,11,0.05)]' 
                      : 'bg-white border-slate-200 text-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.08)]'
                  }`}
                  dir="rtl"
                >
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-4 border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                      <KeyRound size={20} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base font-black">بوابة توليد مفاتيح الارتباط الذكية (B2B)</h3>
                      <p className="text-[10px] text-gray-400 font-bold">توليد وصياغة روابط آمنة لتوصيل سلة المبيعات والائتمان المالي</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsKeyGenOpen(false);
                      setGeneratedKey('');
                      setCopySuccess(false);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-all text-gray-400"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Form Content */}
                {!generatedKey ? (
                  <div className="space-y-4">
                    {/* Task Type */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-400 dark:text-gray-300">نوع عملية المفتاح (Task Type):</label>
                      <select
                        value={keyTaskType}
                        onChange={(e) => setKeyTaskType(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:border-amber-500 outline-none"
                      >
                        <option value="new">ارتباط جديد ومصادقة فورية</option>
                        <option value="renew">تجديد الارتباط القائم وترقية الذمة</option>
                      </select>
                    </div>

                    {/* Duration */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-400 dark:text-gray-300">صلاحية ومدة المفتاح (Key Duration):</label>
                      <select
                        value={keyDuration}
                        onChange={(e) => setKeyDuration(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:border-amber-500 outline-none"
                      >
                        <option value="month">شهر واحد (30 يوماً)</option>
                        <option value="year">عام كامل (365 يوماً)</option>
                        <option value="unlimited">دائم (صلاحية مفتوحة)</option>
                      </select>
                    </div>

                    {/* Permissions/Type Checkboxes */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 dark:text-gray-300 block">الصلاحيات والقنوات المفعلة بالارتباط:</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'cash', label: 'دفع نقدي (كاش)' },
                          { key: 'credit', label: 'حساب دين (ائتمان مالي)' },
                          { key: 'transfer', label: 'حوالات مستندات مالية' },
                          { key: 'jamPay', label: 'JAM Pay الإلكتروني' }
                        ].map((item) => (
                          <label
                            key={item.key}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                              keyPermissions[item.key as keyof typeof keyPermissions]
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 font-extrabold'
                                : 'bg-gray-50 dark:bg-navy-900/40 border-slate-200 dark:border-white/5 text-slate-400 dark:text-gray-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={keyPermissions[item.key as keyof typeof keyPermissions]}
                              onChange={(e) => setKeyPermissions({
                                ...keyPermissions,
                                [item.key]: e.target.checked
                              })}
                              className="hidden"
                            />
                            <span className="w-4 h-4 rounded border flex items-center justify-center text-[10px] font-black">
                              {keyPermissions[item.key as keyof typeof keyPermissions] ? '✓' : ''}
                            </span>
                            <span className="text-xs">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Conditional Credit Logic (الدين) */}
                    <AnimatePresence>
                      {keyPermissions.credit && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-4 text-right">
                            <span className="text-xs font-black text-amber-500 block border-b border-amber-500/10 pb-1.5">🛡️ إعدادات الائتمان المالي الإضافية:</span>
                            
                            {/* Account creation agreement */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600 dark:text-gray-300">هل توافق على إنشاء حساب للعميل مالك المفتاح؟</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={approveClientAccount}
                                  onChange={(e) => setApproveClientAccount(e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-gray-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                              </label>
                            </div>

                            {/* Credit limit */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-black text-slate-500 dark:text-gray-300 block">نسبة سقف الائتمان (YER):</label>
                              <input
                                type="number"
                                placeholder="أدخل سقف الائتمان بالريال اليمني"
                                value={creditLimit}
                                onChange={(e) => setCreditLimit(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white outline-none focus:border-amber-500"
                              />
                            </div>

                            {/* Installment toggle */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600 dark:text-gray-300">نظام التقسيط وجدولة المستحقات آلياً:</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={installmentSystem}
                                  onChange={(e) => setInstallmentSystem(e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-gray-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                              </label>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Actions */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleGenerateKey}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs rounded-xl hover:scale-[1.01] active:scale-95 transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer border-none"
                      >
                        <span>🗝️ صياغة وتوليد مفتاح الارتباط الذكي</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Generated Key View */
                  <div className="space-y-4 text-center py-4">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 mx-auto mb-2">
                      <Check size={32} className="animate-bounce" />
                    </div>
                    <h4 className="text-sm font-black text-emerald-500">تم توليد وتشفير مفتاح الارتباط بنجاح!</h4>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                      قم بنسخ هذا المفتاح وإرساله لشركائك الموزعين أو تجار التجزئة ليربطوا فوراً بكتالوجك ويرسلوا إليك سرياً الحوالات والديون والطلبات.
                    </p>

                    <div className="p-4 bg-gray-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-between gap-4">
                      <span className="font-mono text-sm font-black text-slate-800 dark:text-amber-400 select-all tracking-wider">
                        {generatedKey}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedKey);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }}
                        className={`px-4 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                          copySuccess
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25'
                        }`}
                      >
                        {copySuccess ? '✓ تم النسخ' : '📋 نسخ'}
                      </button>
                    </div>

                    <div className="pt-2 flex justify-end gap-2.5">
                      <button
                        onClick={() => {
                          setGeneratedKey('');
                          setCopySuccess(false);
                        }}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white rounded-xl bg-gray-100 dark:bg-white/5 border-none cursor-pointer"
                      >
                        توليد مفتاح آخر
                      </button>
                      <button
                        onClick={() => {
                          setIsKeyGenOpen(false);
                          setGeneratedKey('');
                          setCopySuccess(false);
                        }}
                        className="px-5 py-2 text-xs font-black bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-gray-100 rounded-xl border-none cursor-pointer"
                      >
                        إغلاق النافذة
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )})()}
        </AnimatePresence>
      </AnimatePresence>

      {/* Quick Global Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        profile={profile}
      />

      {/* Daily / Shift Close Modal */}
      {profile && (
        <DailyShiftCloseModal
          isOpen={isDailyShiftModalOpen}
          onClose={() => setIsDailyShiftModalOpen(false)}
          currentUser={profile}
          onConfirmShiftClose={handleConfirmShiftClose}
        />
      )}

      {/* Lightweight Cross B2B Wholesale Market Modal Overlay */}
      <CrossB2BWholesaleMarketModal
        isOpen={isCrossB2BMarketOpen}
        onClose={() => setIsCrossB2BMarketOpen(false)}
        profile={profile}
      />

      {/* 📱 5 App Variants (Editions) Selector & Inspector Modal */}
      <AppVariantsSelectorModal
        isOpen={isVariantsModalOpen}
        onClose={() => setIsVariantsModalOpen(false)}
        userProfile={profile}
      />

      {/* ⚡ Live Hot-Patch Background Interceptor & Security Guard */}
      <HotPatchSecurityGuard />
    </div>
  );
}
