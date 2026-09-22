import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLoading } from '../context/LoadingContext';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SYSTEM_LOGO } from '../constants/assets';
import { WalletDepositCard } from './WalletDepositCard';
import { 
  Zap, 
  Crown,
  Smartphone, 
  Trophy, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Gift, 
  ShoppingBasket, 
  Clock, 
  ArrowRight,
  Phone,
  PhoneCall,
  Banknote,
  Send,
  Share2,
  X,
  Plus,
  Stethoscope,
  Gavel,
  MessageSquare,
  Award,
  Eye,
  EyeOff,
  ShieldCheck,
  Wrench,
  AlertTriangle,
  Package,
  Cpu,
  Search,
  FileText,
  Store,
  Printer,
  Lock,
  Sparkles,
  Bell,
  BellRing,
  Gamepad2,
  Video,
  Tv,
  Heart,
  Volume2,
  VolumeX,
  PlaySquare,
  Share2,
  LogOut,
  Check
} from 'lucide-react';
import { auth, db, ensureAuth, handleFirestoreError, OperationType } from '../firebase';
import { JamFastProductImage } from './JamFastProductImage';
const clientLoginMockup = "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80";
import { onAuthStateChanged } from 'firebase/auth';
import { CustomerStoreLinkRouter } from '../services/CustomerStoreLinkRouter';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  onSnapshot,
  limit,
  updateDoc,
  increment,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { adService } from '../services/adService';
import AdOverlay from './AdOverlay';
import { smartCommerceService } from '../services/smartCommerceService';
import { Lead, Quiz, PromoOffer, InventoryItem, UserProfile } from '../types';
import confetti from 'canvas-confetti';

// Import New Components
import PhoneDoctor from './PhoneDoctor';
import LiveAuction from './LiveAuction';
import ReferralSystem from './ReferralSystem';
import ComplaintsCenter from './ComplaintsCenter';
import CustomerChat from './CustomerChat';
import TheGoldenVault from './TheGoldenVault';
import CircuitGame from './CircuitGame';
import { LocalMediaPlayer } from './LocalMediaPlayer';
import { printingService, PrintMethod } from '../services/printingService';
import DailyFortuneGame from './DailyFortuneGame';
import MXLocalPlayer from './MXLocalPlayer';
import LoginTechBackground from './LoginTechBackground';

function getEmbeddingUrl(url: string) {
  if (!url) return '';
  url = url.trim();
  
  // 1. YouTube
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&controls=1&loop=1&playlist=${ytMatch[1]}`;
  }

  // 2. Vimeo
  const vimeoRegex = /(?:vimeo\.com\/)(?:video\/)?([0-9]+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1&loop=1`;
  }

  return url;
}

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number = 8000, errorMsg: string = 'تعذر الاتصال بالخادم السحابي. يرجى التحقق من الإنترنت وإعادة المحاولة'): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
    promise.then(
      res => {
        clearTimeout(timer);
        resolve(res);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
};

export function getPhonePermutations(phoneStr: string): string[] {
  if (!phoneStr) return [];
  const raw = String(phoneStr).trim();
  const digitsOnly = raw.replace(/[^0-9]/g, '');
  if (!digitsOnly) return [raw];
  
  const set = new Set<string>();
  set.add(raw);
  set.add(digitsOnly);
  
  let local = digitsOnly;
  if (local.startsWith('967')) {
    local = local.slice(3);
  }
  if (local.startsWith('0')) {
    local = local.slice(1);
  }
  
  if (local) {
    set.add(local);
    set.add(`0${local}`);
    set.add(`967${local}`);
    set.add(`+967${local}`);
    set.add(`+9670${local}`);
    set.add(`00967${local}`);
  }
  
  return Array.from(set).filter(Boolean);
}

export default function CustomerPortal() {
  const { showLegacyUIBorders, showLegacyLoadingSpinners } = useLoading();

  // Helper classes for borders and styles that dynamically switch based on showLegacyUIBorders
  const gBorderColor = showLegacyUIBorders ? 'border-[#d4af37]/25' : 'border-white/5';
  const gBorderColor30 = showLegacyUIBorders ? 'border-[#d4af37]/30' : 'border-white/5';
  const gBorderColor35 = showLegacyUIBorders ? 'border-[#d4af37]/35' : 'border-white/10';
  const gBorderColor20 = showLegacyUIBorders ? 'border-[#d4af37]/20' : 'border-white/5';
  const gBgCard = showLegacyUIBorders ? 'bg-[#171d26]' : 'bg-[#111622]/50';
  const gBgDoubleCard = showLegacyUIBorders ? 'bg-[#002244]/50' : 'bg-[#111622]/40';
  const gRoundedHuge = showLegacyUIBorders ? 'rounded-[2.5rem]' : 'rounded-2xl';
  const gRoundedLarge = showLegacyUIBorders ? 'rounded-[2rem]' : 'rounded-xl';
  const gBorderRoyalGold40 = showLegacyUIBorders ? 'border-royal-gold/40' : 'border-white/10';
  const gBorderRoyalGold20 = showLegacyUIBorders ? 'border-royal-gold/20' : 'border-white/5';
  const gBorderRoyalGold30 = showLegacyUIBorders ? 'border-royal-gold/30' : 'border-white/5';
  const gTextColorRoyalGold = showLegacyUIBorders ? 'text-royal-gold' : 'text-amber-400';
  const gBgRoyalGold10 = showLegacyUIBorders ? 'bg-royal-gold/10' : 'bg-white/5';
  const gBgRoyalGold5 = showLegacyUIBorders ? 'bg-royal-gold/5' : 'bg-white/5';

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shopSlug = searchParams.get('shop');

  // Synchronously compute active slug on mount to check matching cache
  const getActiveSlug = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const rawSlug = urlParams.get('shop') || hashParams.get('shop') || shopSlug;
    return rawSlug ? decodeURIComponent(rawSlug).trim() : null;
  };

  const [shopProfile, setShopProfile] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('jam_portal_shop_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        const activeSlug = getActiveSlug();
        if (!activeSlug || parsed.name === activeSlug || parsed.id === activeSlug) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const [currentLead, setCurrentLead] = useState<Lead | null>(() => {
    try {
      const cached = localStorage.getItem('jam_portal_current_lead');
      if (cached) {
        const parsed = JSON.parse(cached);
        const cachedProfileStr = localStorage.getItem('jam_portal_shop_profile');
        if (cachedProfileStr) {
          const cachedProfile = JSON.parse(cachedProfileStr);
          const activeSlug = getActiveSlug();
          if ((!activeSlug || cachedProfile.name === activeSlug || cachedProfile.id === activeSlug) && parsed.ownerId === cachedProfile.id) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const [authStep, setAuthStep] = useState<'login' | 'verify' | 'welcome' | 'dashboard'>('login');

  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('jam_portal_shop_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        const activeSlug = getActiveSlug();
        if (!activeSlug || parsed.name === activeSlug || parsed.id === activeSlug) {
          return false; // Skip initial loading overlay
        }
      }
    } catch (e) {}
    return true;
  });

  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<UserProfile | null>(null);
  const [customerProfile, setCustomerProfile] = useState<any>(null);

  // States for digital invoice scanning (QR Code destination)
  const [scannedInvoice, setScannedInvoice] = useState<any>(null);
  const [scannedInvoiceLoading, setScannedInvoiceLoading] = useState(false);

  const urlInvoiceId = searchParams.get('invoiceId') || searchParams.get('invoice');

  useEffect(() => {
    if (urlInvoiceId) {
      setScannedInvoiceLoading(true);
      const invoiceRef = doc(db, 'sales', urlInvoiceId);
      getDoc(invoiceRef).then(async (snap) => {
        if (snap.exists()) {
          setScannedInvoice({ id: snap.id, ...snap.data() });
        } else {
          // Try returns collection
          const returnSnap = await getDoc(doc(db, 'returns', urlInvoiceId));
          if (returnSnap.exists()) {
            setScannedInvoice({ id: returnSnap.id, ...returnSnap.data(), isReturn: true });
          } else {
            // Try held_invoices collection
            const heldSnap = await getDoc(doc(db, 'held_invoices', urlInvoiceId));
            if (heldSnap.exists()) {
              setScannedInvoice({ id: heldSnap.id, ...heldSnap.data(), isHeld: true });
            } else {
              console.warn('Scanned digital invoice not found:', urlInvoiceId);
            }
          }
        }
      }).catch((err) => {
        console.error('Error loading digital invoice:', err);
      }).finally(() => {
        setScannedInvoiceLoading(false);
      });
    }
  }, [urlInvoiceId]);

  // States for store multi-tenancy cross-referencing
  const [matchingStores, setMatchingStores] = useState<any[]>([]);
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [pendingLoginInfo, setPendingLoginInfo] = useState<{
    phone: string;
    leadName?: string;
    isVip: boolean;
    vipData?: any;
  } | null>(null);

  // Refs for Firestore snapshot listener unsubscriptions to prevent permission errors on logout
  const unsubQuizzesRef = useRef<(() => void) | null>(null);
  const unsubTipsRef = useRef<(() => void) | null>(null);
  const unsubOffersRef = useRef<(() => void) | null>(null);
  const unsubInventoryRef = useRef<(() => void) | null>(null);
  const unsubBanksRef = useRef<(() => void) | null>(null);
  const [activeQuizzes, setActiveQuizzes] = useState<Quiz[]>([]);
  const [attemptedQuizIds, setAttemptedQuizIds] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  // 🔔 Simulated Notification Engine & APK Overlay Perms States
  const [activeSimulatedNotification, setActiveSimulatedNotification] = useState<{
    id: string;
    title: string;
    body: string;
    tag?: string;
  } | null>(null);

  const [overlayPermissionGranted, setOverlayPermissionGranted] = useState(() => {
    return localStorage.getItem('jam_apk_overlay_permission') === 'granted';
  });

  const [showAndroidOverlayModal, setShowAndroidOverlayModal] = useState(false);

  const playNotificationChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.05); // D6
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.5);
      osc2.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio Context failed:", e);
    }
  };

  const triggerSimulatedNotification = (title: string, body: string, tag?: string) => {
    // Play sound chime
    playNotificationChime();
    
    // Push state
    const id = Date.now().toString();
    setActiveSimulatedNotification({ id, title, body, tag });

    // Try fallback to native push if granted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, tag });
      } catch (err) {
        console.warn('Native Notification failed:', err);
      }
    }
  };

  useEffect(() => {
    if (!activeSimulatedNotification) return;
    const timer = setTimeout(() => {
      setActiveSimulatedNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeSimulatedNotification]);
  const prevRepairsRef = useRef<Record<string, string>>({});
  const [phoneTips, setPhoneTips] = useState<any[]>([]);
  const [activeOffers, setActiveOffers] = useState<PromoOffer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  
  const [phone, setPhone] = useState(() => {
    return localStorage.getItem('customerPhone') || '';
  });
  const [leadName, setLeadName] = useState(() => {
    return localStorage.getItem('customerName') || '';
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizResult, setQuizResult] = useState<{ success: boolean; points: number } | null>(null);

  const [bookingItem, setBookingItem] = useState<PromoOffer | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<'info' | 'payment' | 'success'>('info');

  const [activeTab, setActiveTab] = useState<'home' | 'store' | 'maintenance' | 'doctor' | 'auction' | 'feedback' | 'rewards' | 'chat' | 'games' | 'reels' | 'local_player' | 'invite' | 'quiz'>('home');
  const [activeGameTab, setActiveGameTab] = useState<'circuit' | 'vault'>('circuit');
  const [promoVideos, setPromoVideos] = useState<any[]>([]);
  const [activeReelIndex, setActiveReelIndex] = useState<number>(0);
  const [muted, setMuted] = useState(true);
  const [likesCount, setLikesCount] = useState<Record<string, number>>({});
  const [floatingHearts, setFloatingHearts] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [statementInvoices, setStatementInvoices] = useState<any[]>([]);
  const [statementSummary, setStatementSummary] = useState<{
    salesDebt: number;
    maintenanceDebt: number;
    networkDebt: number;
    totalPaid: number;
    netDebt: number;
    salesCount: number;
    maintenanceCount: number;
  }>({
    salesDebt: 0,
    maintenanceDebt: 0,
    networkDebt: 0,
    totalPaid: 0,
    netDebt: 0,
    salesCount: 0,
    maintenanceCount: 0
  });
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [membershipDetails, setMembershipDetails] = useState({ level: 'برونزي', nextLevel: 'فضي', progress: 0, color: 'text-gray-400' });
  const [myStoreOptions, setMyStoreOptions] = useState<any[]>([]);
  const [showLinkedStores, setShowLinkedStores] = useState(false);

  // Real-time live date and clock states
  const [liveTime, setLiveTime] = useState<string>('');
  const [hijriDateStr, setHijriDateStr] = useState<string>('');
  const [gregDateStr, setGregDateStr] = useState<string>('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      try {
        const timeFormatter = new Intl.DateTimeFormat('ar-YE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        setLiveTime(timeFormatter.format(now));

        const hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        setHijriDateStr(hijriFormatter.format(now) + ' هـ');

        const gregFormatter = new Intl.DateTimeFormat('ar-YE', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        setGregDateStr(gregFormatter.format(now) + ' م');
      } catch (e) {
        setLiveTime(now.toLocaleTimeString('ar-YE'));
        setGregDateStr(now.toLocaleDateString('ar-YE'));
      }
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const [loginMode, setLoginMode] = useState<'normal' | 'vip'>('normal');
  const [vipCode, setVipCode] = useState('');
  const [vipPassword, setVipPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [vipError, setVipError] = useState<string | null>(null);
  const [authConnectionError, setAuthConnectionError] = useState<string | null>(null);
  const [isJamPayPopupOpen, setIsJamPayPopupOpen] = useState(false);

  // Phase 2 states
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);
  const [subscriptionWarningMessage, setSubscriptionWarningMessage] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineRemainingDays, setOfflineRemainingDays] = useState<number | null>(null);

  // Phase 3 states
  const [printMethod, setPrintMethodState] = useState<PrintMethod>(printingService.getPrintMethod());

  const rememberedPhone = phone;
  const rememberedName = leadName || localStorage.getItem('customerName') || '';
  const isRecognized = !!rememberedPhone && !!rememberedName;
  const isFarewell = sessionStorage.getItem('jam_vip_logged_out_farewell') === 'true';

  // Support programmatic downloads (Excel / PDF / Backups / Tickets)
  useEffect(() => {
    // Explicitly ensure URL.createObjectURL is supported and clean
    console.log('✅ File download & Blob export engine enabled for Portal / WebView.');
  }, []);

  useEffect(() => {
    const checkOfflineStatusOnLoad = () => {
      const lastLoginStr = localStorage.getItem('last_login') || localStorage.getItem('jam_last_login_time');
      const hasToken = localStorage.getItem('jam_offline_token');
      const isActuallyOffline = !navigator.onLine;

      if (lastLoginStr) {
        const lastLoginTime = parseInt(lastLoginStr, 10);
        const elapsedMs = Date.now() - lastLoginTime;
        const tenDaysMs = 10 * 24 * 60 * 60 * 1000;

        if (elapsedMs > tenDaysMs) {
          console.warn("⚠️ Local session has expired (exceeded 10 days limit). Requiring cloud re-validation or logout.");
          if (navigator.onLine) {
            // Online: Force a cloud re-validation
            if (auth.currentUser) {
              console.log("Cloud re-validation succeeded via active Firebase Auth session.");
              localStorage.setItem('last_login', Date.now().toString());
              localStorage.setItem('jam_last_login_time', Date.now().toString());
            } else {
              console.log("Cloud re-validation failed. Forcing logout.");
              performLogout();
            }
          } else {
            // Offline: Cannot re-validate. Force logout.
            console.warn("Offline session expired (> 10 days). Forcing logout.");
            performLogout();
          }
        } else {
          // Grant read-only access to cached data if offline
          if (isActuallyOffline && hasToken) {
            const remainingDays = Math.ceil((tenDaysMs - elapsedMs) / (24 * 60 * 60 * 1000));
            setIsOfflineMode(true);
            setOfflineRemainingDays(remainingDays);
            console.log(`🌐 Offline Mode Enabled. Read-only cached access granted. Token active for ${remainingDays} more days.`);
            
            const savedPhone = localStorage.getItem('customerPhone');
            const savedName = localStorage.getItem('customerName');
            const savedLead = localStorage.getItem('jam_portal_current_lead');
            const savedProfile = localStorage.getItem('jam_portal_shop_profile');

            if (savedPhone && savedName) {
              setPhone(savedPhone);
              setLeadName(savedName);
              if (savedLead) {
                try { setCurrentLead(JSON.parse(savedLead)); } catch (e) {}
              }
              if (savedProfile) {
                try { setShopProfile(JSON.parse(savedProfile)); } catch (e) {}
              }
               sessionStorage.setItem('jam_portal_entered_dashboard', 'true');
               setAuthStep('dashboard');
              setIsAuthReady(true);
              setLoading(false);
            }
          }
        }
      }
    };
    checkOfflineStatusOnLoad();
  }, []);

  useEffect(() => {
    if (shopProfile) {
      const activeName = shopProfile.shopName || shopProfile.name || 'متجر JAM Pro';
      document.title = `تطبيق عملاء ${activeName} 👑`;
      
      // If there are dynamic primary/secondary colors in shopProfile, apply them
      if (shopProfile.primaryColor || shopProfile.secondaryColor) {
        const root = document.documentElement;
        if (shopProfile.primaryColor) {
          root.style.setProperty('--brand-primary', shopProfile.primaryColor);
        }
        if (shopProfile.secondaryColor) {
          root.style.setProperty('--brand-secondary', shopProfile.secondaryColor);
        }
      }
    } else {
      document.title = 'JAM System Pro - VIP Client Portal';
    }
  }, [shopProfile]);

  // 1. Back & Logout Guard (Mobile/Web)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const backListener = App.addListener('backButton', () => {
        // Correct path detection for portal + root detection
        const path = window.location.hash.toLowerCase();
        const isPortal = path.includes('/portal') || path.includes('/cp');
        
        // If we are on the main portal screen, exit app to shield admin area
        if (isPortal) {
          App.exitApp(); 
        }
      });
      return () => {
        backListener.then(l => l.remove());
      };
    }
  }, []);

  // No psychological engagement alerts on leave attempt to ensure a smooth exit with no warnings
  useEffect(() => {
    // Left empty intentionally to prevent warnings on exit
  }, []);

  useEffect(() => {
    if (currentLead) {
      const points = currentLead.points || 0;
      if (points > 10000) setMembershipDetails({ level: 'ملكي ماسي', nextLevel: 'القمة', progress: 100, color: 'text-cyan-400' });
      else if (points > 5000) setMembershipDetails({ level: 'ذهبي فاخر', nextLevel: 'ماسي', progress: (points / 10000) * 100, color: 'text-royal-gold' });
      else if (points > 1000) setMembershipDetails({ level: 'فضي متألق', nextLevel: 'ذهبي', progress: (points / 5000) * 100, color: 'text-stone-300' });
      else setMembershipDetails({ level: 'برونزي عادي', nextLevel: 'فضي', progress: (points / 1000) * 100, color: 'text-orange-400' });
    }
  }, [currentLead]);

  useEffect(() => {
    let active = true;
    if (!isAuthReady || !currentLead?.id) {
      setAttemptedQuizIds([]);
      return;
    }
    const fetchAttempts = async () => {
      try {
        const q = query(
          collection(db, 'customer_quiz_attempts'),
          where('leadId', '==', currentLead.id)
        );
        const snap = await getDocs(q);
        if (active) {
          const ids = snap.docs.map(d => d.data().quizId || d.id.split('_').pop() || '');
          setAttemptedQuizIds(ids.filter(Boolean));
        }
      } catch (err) {
        console.warn('Error fetching quiz attempts:', err);
      }
    };
    fetchAttempts();
    return () => { active = false; };
  }, [currentLead?.id, isAuthReady]);

  useEffect(() => {
    if (!currentLead?.phone || !shopProfile?.id) {
      setCustomerProfile(null);
      return;
    }

    const phoneVariants = getPhonePermutations(currentLead.phone);
    const targetStoreId = shopProfile.id;

    // Real-time listener for customer ledger profile & debt isolation
    const qStore = query(
      collection(db, 'customers'),
      where('storeId', '==', targetStoreId),
      where('phone', 'in', phoneVariants.slice(0, 10))
    );

    const qOwner = query(
      collection(db, 'customers'),
      where('ownerId', '==', targetStoreId),
      where('phone', 'in', phoneVariants.slice(0, 10))
    );

    let profileFromStore: any = null;
    let profileFromOwner: any = null;

    const updateProfile = () => {
      const activeProf = profileFromStore || profileFromOwner;
      if (activeProf) {
        setCustomerProfile(activeProf);
      } else {
        setCustomerProfile(null);
      }
    };

    const unsub1 = onSnapshot(qStore, (snap) => {
      if (!snap.empty) {
        profileFromStore = { id: snap.docs[0].id, ...snap.docs[0].data() };
      } else {
        profileFromStore = null;
      }
      updateProfile();
    }, (err) => {
      console.warn("⚠️ [CustomerPortal] Real-time customer profile (storeId) notice:", err.message);
    });

    const unsub2 = onSnapshot(qOwner, (snap) => {
      if (!snap.empty) {
        profileFromOwner = { id: snap.docs[0].id, ...snap.docs[0].data() };
      } else {
        profileFromOwner = null;
      }
      updateProfile();
    }, (err) => {
      console.warn("⚠️ [CustomerPortal] Real-time customer profile (ownerId) notice:", err.message);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [currentLead?.phone, shopProfile?.id]);
  const [maintenanceOrders, setMaintenanceOrders] = useState<any[]>([]);
  const [activeRepairs, setActiveRepairs] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthReady || !currentLead || !shopProfile) return;
    
    const currentUserId = currentLead?.id || '';
    const phoneVariants = getPhonePermutations(currentLead.phone);

    // Subscribing in real-time to customer's active maintenance orders under Diamond Isolation Protocol strict storeId
    const q = query(
      collection(db, 'maintenanceOrders'),
      where('storeId', '==', shopProfile.id),
      where('customerPhone', 'in', phoneVariants.slice(0, 10))
    );

    const qFallback = query(
      collection(db, 'maintenanceOrders'),
      where('ownerId', '==', shopProfile.id),
      where('customerPhone', 'in', phoneVariants.slice(0, 10))
    );

    // New Secure Query on "maintenance" collection (Diamond Isolation Protocol)
    const qMaintenance = query(
      collection(db, 'maintenance'),
      where('customerId', '==', currentUserId)
    );

    let listStoreId: any[] = [];
    let listOwnerId: any[] = [];
    let listMaintenance: any[] = [];

    const updateActiveRepairs = () => {
      // Merge and deduplicate by document ID
      const mergedMap = new Map<string, any>();
      listStoreId.forEach(item => mergedMap.set(item.id, item));
      listOwnerId.forEach(item => mergedMap.set(item.id, item));
      listMaintenance.forEach(item => mergedMap.set(item.id, item));
      const list = Array.from(mergedMap.values());

      // Filter only active repair states
      const activeList = list.filter(item => 
         item.status === 'received' || 
         item.status === 'working' || 
         item.status === 'ready' || 
         item.status === 'processing' ||
         item.status === 'Received'
      );
      setActiveRepairs(activeList);
    };

    const unsub1 = onSnapshot(q, (snap) => {
      listStoreId = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateActiveRepairs();
    }, (err) => {
      console.warn("⚠️ Exception subbing to storeId maintenanceOrders:", err.message);
    });

    const unsub2 = onSnapshot(qFallback, (snap) => {
      listOwnerId = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateActiveRepairs();
    }, (err) => {
      console.warn("⚠️ Exception subbing to ownerId maintenanceOrders:", err.message);
    });

    const unsub3 = onSnapshot(qMaintenance, (snap) => {
      listMaintenance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateActiveRepairs();
    }, (err) => {
      console.warn("⚠️ Exception subbing to customerId maintenance:", err.message);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [currentLead, shopProfile, isAuthReady]);

  // 🌐 Online/Offline Listeners & Notification Permission Setup
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      // Trigger immediate offline reminder if cached "ready" repairs exist
      try {
        const cached = localStorage.getItem('jam_cached_maintenance');
        if (cached) {
          const list = JSON.parse(cached) as any[];
          const readyDevices = list.filter(item => 
            item.status === 'ready' || 
            item.status === 'Ready' || 
            item.status === 'completed'
          );
          if (readyDevices.length > 0) {
            const devicesNames = readyDevices.map(d => d.deviceModel || d.deviceName || d.deviceType || 'هاتفك').join('، ');
            // Always trigger simulated overlay notification with sound chime
            triggerSimulatedNotification("تنبيه استلام أجهزة (أوفلاين) 📥", `تنبيه: أنت الآن غير متصل بالإنترنت. يرجى تذكر أخذ أجهزتك الجاهزة للاستلام: ${devicesNames}.`, 'offline-remind');
          }
        }
      } catch (e) {
        console.warn('Offline checks error:', e);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 🔄 Watch activeRepairs to handle caching & real-time system notifications
  useEffect(() => {
    if (!activeRepairs || activeRepairs.length === 0) return;

    // Save to local cache for offline checks
    try {
      localStorage.setItem('jam_cached_maintenance', JSON.stringify(activeRepairs));
    } catch (e) {
      console.warn(e);
    }

    const prev = prevRepairsRef.current;
    const current: Record<string, string> = {};

    activeRepairs.forEach(repair => {
      current[repair.id] = repair.status || '';

      const oldStatus = prev[repair.id];
      // Only notify if we had a prior status in the session and it has changed
      if (oldStatus !== undefined && oldStatus !== repair.status) {
        const device = repair.deviceModel || repair.deviceName || repair.deviceType || 'جهازك';
        let statusText = repair.status;
        if (repair.status === 'ready' || repair.status === 'Ready' || repair.status === 'completed') {
          statusText = 'جاهز للاستلام 🏆 (يرجى أخذ جهازك)';
        } else if (repair.status === 'working' || repair.status === 'Working') {
          statusText = 'قيد العمل والإصلاح ⚙️';
        } else if (repair.status === 'received' || repair.status === 'Received') {
          statusText = 'تم استلامه في المختبر 📥';
        } else if (repair.status === 'failed' || repair.status === 'Failed') {
          statusText = 'فشل الإصلاح ❌';
        }

        const title = "تحديث حالة الصيانة 🔧";
        const body = `تغيرت حالة جهازك (${device}) إلى: ${statusText}. يرجى الحضور للمحل أو استلامه.`;

        // Trigger overlay & system notification immediately
        triggerSimulatedNotification(title, body, repair.id);
      }
    });

    prevRepairsRef.current = current;
  }, [activeRepairs]);

  const [searchRepairId, setSearchRepairId] = useState('');
  const [trackedRepair, setTrackedRepair] = useState<any>(null);
  const [isSearchingRepair, setIsSearchingRepair] = useState(false);
  const [quizTimer, setQuizTimer] = useState(30);

  const [shopSearchQuery, setShopSearchQuery] = useState('');
  const [isSearchingShop, setIsSearchingShop] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [expandedCompatibilities, setExpandedCompatibilities] = useState<Record<string, boolean>>({});
  const [searchHistory, setSearchHistory] = useState<any[]>([]);

  useEffect(() => {
    let timer: any;
    if (activeQuiz && !quizResult) {
      setQuizTimer(30);
      timer = setInterval(() => {
        setQuizTimer(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeQuiz, quizResult]);

  const handleTrackRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryId = searchRepairId.trim();
    if (!queryId) {
      setActiveTab('maintenance');
      return;
    }
    
    setIsSearchingRepair(true);
    setTrackedRepair(null);
    setMaintenanceOrders([]);

    // Security Guard: Prevent spying on others (unless it's a specific Repair ID/IMEI)
    const isPhoneQuery = /^[0-9]{7,15}$/.test(queryId);
    if (isPhoneQuery && currentLead && queryId !== currentLead.phone) {
      alert(`عذراً، لا يمكنك الاستعلام إلا عن طلبات خاصة برقمك. للاستفسار يرجى التواصل مع إدارة المحل على رقم: ${shopProfile.phone}`);
      setIsSearchingRepair(false);
      return;
    }

    try {
      // Archive Filter: 7 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);

      let results: any[] = [];

      // 1. Try direct ID lookup
      const directDoc = await getDoc(doc(db, 'maintenanceOrders', queryId));
      if (directDoc.exists() && (directDoc.data().storeId === shopProfile.id || directDoc.data().ownerId === shopProfile.id)) {
        results.push({ id: directDoc.id, ...directDoc.data() });
      } else {
        // 2. Query by Phone/IMEI (Checking storeId primary, ownerId fallback)
        const qStoreId = query(
          collection(db, 'maintenanceOrders'),
          where('storeId', '==', shopProfile.id),
          isPhoneQuery ? where('customerPhone', '==', queryId) : where('imei', '==', queryId)
        );
        const snapStoreId = await getDocs(qStoreId);
        results = snapStoreId.docs.map(d => ({ id: d.id, ...d.data() }));

        if (results.length === 0) {
          const qOwnerId = query(
            collection(db, 'maintenanceOrders'),
            where('ownerId', '==', shopProfile.id),
            isPhoneQuery ? where('customerPhone', '==', queryId) : where('imei', '==', queryId)
          );
          const snapOwnerId = await getDocs(qOwnerId);
          results = snapOwnerId.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      }

      // 7-Day Archiving Filter for Delivered items
      const filteredResults = results.filter(order => {
        if (order.status !== 'delivered') return true;
        
        const deliveredDate = order.deliveredAt?.toDate ? order.deliveredAt.toDate() : 
                            order.deliveredAt?.seconds ? new Date(order.deliveredAt.seconds * 1000) : null;
        
        if (!deliveredDate) return true;
        return deliveredDate >= cutoffDate;
      });

      if (filteredResults.length > 0) {
        setMaintenanceOrders(filteredResults);
        setTrackedRepair(filteredResults[0]);
        setActiveTab('maintenance');
      } else {
        alert('لا توجد أجهزة نشطة تحت الصيانة حالياً أو تم أرشفتها تلقائياً بعد مرور 7 أيام على تسليمها.');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء البحث. يرجى المحاولة لاحقاً');
    } finally {
      setIsSearchingRepair(false);
    }
  };

  // Auto-fill info if Firebase Auth user is a customer, but do NOT auto-bypass the gate
  useEffect(() => {
    if (isAuthReady && authUser?.role === 'customer' && authStep === 'login' && shopProfile) {
      const autoPhone = authUser.phone || authUser.email.split('@')[0];
      if (autoPhone) {
        setPhone(autoPhone);
        setLeadName(authUser.name);
        // Persist to remember so they are recognized automatically
        localStorage.setItem('customerPhone', autoPhone);
        localStorage.setItem('customerName', authUser.name);
        localStorage.setItem('jam_returning_vip', 'true');
      }
    }
  }, [isAuthReady, authUser, authStep, shopProfile]);

  useEffect(() => {
    let active = true;
    if (currentLead && activeTab === 'maintenance' && shopProfile) {
      if (shopProfile.id === 'demo_store') {
        setMaintenanceOrders([]);
        return;
      }
      const fetchMaintenanceOrders = async () => {
        try {
          const currentUserId = currentLead?.id || '';

          const qStoreId = query(
            collection(db, 'maintenanceOrders'),
            where('storeId', '==', shopProfile.id),
            where('customerPhone', '==', currentLead.phone),
            orderBy('createdAt', 'desc'),
            limit(50)
          );
          let s = await getDocs(qStoreId);
          if (s.empty) {
            const qOwnerId = query(
              collection(db, 'maintenanceOrders'),
              where('ownerId', '==', shopProfile.id),
              where('customerPhone', '==', currentLead.phone),
              orderBy('createdAt', 'desc'),
              limit(50)
            );
            s = await getDocs(qOwnerId);
          }

          // Secure Query on "maintenance" collection (Diamond Isolation Protocol)
          let sMaintenance: any = { docs: [] };
          try {
            const qMaintenance = query(
              collection(db, 'maintenance'),
              where('customerId', '==', currentUserId)
            );
            sMaintenance = await getDocs(qMaintenance);
          } catch (mErr: any) {
            console.warn("⚠️ Diamond Isolation: Optional maintenance collection fetch bypassed:", mErr.message);
          }

          if (active) {
            const combinedMap = new Map<string, any>();
            s.docs.forEach(d => combinedMap.set(d.id, { id: d.id, ...d.data() }));
            sMaintenance.docs.forEach((d: any) => combinedMap.set(d.id, { id: d.id, ...d.data() }));

            const merged = Array.from(combinedMap.values()).sort((a, b) => {
              const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() :
                            a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
              const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() :
                            b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
              return dateB - dateA;
            });

            setMaintenanceOrders(merged);
          }
        } catch (error: any) {
          console.warn("⚠️ Graceful Fallback: Error fetching maintenanceOrders:", error.message);
          if (active) setMaintenanceOrders([]);
        }
      };
      fetchMaintenanceOrders();
    }
    return () => { active = false; };
  }, [currentLead, activeTab, shopProfile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (firebaseUser.isAnonymous) {
          setIsAuthReady(true);
          return;
        }
        // Fetch full profile
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setAuthUser(profile);
            
            // If it's a customer, pre-fill phone and potentially skip login step
            if (profile.role === 'customer') {
              setPhone(profile.phone || profile.email.split('@')[0]);
              setLeadName(profile.name);
            }
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
        setIsAuthReady(true);
      } else {
        ensureAuth().then(() => setIsAuthReady(true)).catch(err => {
          console.error('Anonymous auth failed:', err);
          setIsAuthReady(true); // Fallback
        });
      }
    });

    // Recover lead session from local storage
    const savedPhone = localStorage.getItem('customerPhone');
    const savedName = localStorage.getItem('customerName');
    if (savedPhone) {
      setPhone(savedPhone);
      if (savedName) setLeadName(savedName);
    }

    // Safety fallback for auth readiness
    const timer = setTimeout(() => setIsAuthReady(true), 3000);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const checkGuestAndRecover = async () => {
      const isGuest = !authUser || authUser?.role === 'Guest' || authUser?.role === 'guest';
      if (isGuest && isAuthReady) {
        const savedPhone = localStorage.getItem('customerPhone');
        if (!savedPhone) {
          console.log('No guest/session on Portal, keeping clean login screen');
          setAuthStep('login');
        }
      }
    };
    checkGuestAndRecover();
  }, [authUser, isAuthReady]);

  // Real-time promo videos listener for the current active shop
  useEffect(() => {
    const currentStoreId = shopProfile?.id || localStorage.getItem('current_shop_id') || 'demo_store';
    if (!currentStoreId) return;

    const qVideos = query(
      collection(db, 'promo_videos'),
      where('store_id', '==', currentStoreId)
    );

    const unsubscribe = onSnapshot(qVideos, (snapshot) => {
      const vids: any[] = [];
      snapshot.forEach(docSnap => {
        vids.push({ id: docSnap.id, ...docSnap.data() });
      });
      vids.sort((a, b) => {
        const tA = a.createdAt?.seconds || a.createdAt?.toDate?.()?.getTime() || 0;
        const tB = b.createdAt?.seconds || b.createdAt?.toDate?.()?.getTime() || 0;
        return tB - tA; // Newer first
      });
      setPromoVideos(vids);
      setActiveReelIndex(0); // auto play newest one immediately
    }, (error) => {
      console.warn("Silent grace mechanism: error fetching promo videos for portal feed", error);
    });

    return () => unsubscribe();
  }, [shopProfile?.id]);

  const handleLikeReel = (reelId: string) => {
    setLikesCount(prev => ({
      ...prev,
      [reelId]: (prev[reelId] || 0) + 1
    }));

    const newHearts = Array.from({ length: 5 }).map(() => ({
      id: Date.now() + Math.random(),
      x: Math.floor(Math.random() * 80) + 10,
      y: Math.floor(Math.random() * 20) + 60,
    }));
    setFloatingHearts(prev => [...prev, ...newHearts]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => !newHearts.some(nh => nh.id === h.id)));
    }, 1000);
  };

  const handleShareReel = (reel: any) => {
    if (!reel) return;
    const url = reel.videoUrl || reel.url || window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(reel.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      alert(`رابط الفيديو: ${url}`);
    });
  };

  // Load connected/linked store profiles for customer switcher
  useEffect(() => {
    const targetPhone = phone || currentLead?.phone || localStorage.getItem('customerPhone');
    if (!targetPhone && (!authUser || !authUser.linkedStores || authUser.linkedStores.length === 0)) {
      if (shopProfile && shopProfile.id) {
        setMyStoreOptions([shopProfile]);
      }
      return;
    }
    
    const fetchLinkedStores = async () => {
      try {
        const cleanPhone = targetPhone ? targetPhone.replace(/[\s\-\(\)]/g, '').trim() : '';
        const phoneVariants = cleanPhone ? getPhonePermutations(cleanPhone) : [];
        const storesMap: Record<string, any> = {};
        
        // 1. If authUser has linkedStores
        if (authUser?.linkedStores && authUser.linkedStores.length > 0) {
          try {
            const q1 = query(collection(db, 'users'), where('storeCode', 'in', authUser.linkedStores.slice(0, 10)));
            const snap1 = await getDocs(q1);
            snap1.docs.forEach(doc => {
              storesMap[doc.id] = { id: doc.id, ...doc.data() };
            });
            
            const q2 = query(collection(db, 'users'), where('__name__', 'in', authUser.linkedStores.slice(0, 10)));
            const snap2 = await getDocs(q2);
            snap2.docs.forEach(doc => {
              storesMap[doc.id] = { id: doc.id, ...doc.data() };
            });
          } catch (e) {}
        }

        // 2. Query stores by customer's phone in leads, clients, customers, and pending_activations
        if (phoneVariants.length > 0) {
          const storeIds = new Set<string>();
          try {
            const [leadsSnap, clientsSnap, customersSnap, activationsSnap] = await Promise.all([
              getDocs(query(collection(db, 'leads'), where('phone', 'in', phoneVariants.slice(0, 10)))),
              getDocs(query(collection(db, 'clients'), where('phone', 'in', phoneVariants.slice(0, 10)))),
              getDocs(query(collection(db, 'customers'), where('phone', 'in', phoneVariants.slice(0, 10)))),
              getDocs(query(collection(db, 'pending_activations'), where('customerPhone', 'in', phoneVariants.slice(0, 10))))
            ]);
            leadsSnap.docs.forEach(d => { if (d.data().ownerId) storeIds.add(String(d.data().ownerId)); });
            clientsSnap.docs.forEach(d => { if (d.data().storeId) storeIds.add(String(d.data().storeId)); });
            customersSnap.docs.forEach(d => { 
              const sid = d.data().ownerId || d.data().storeId;
              if (sid) storeIds.add(String(sid)); 
            });
            activationsSnap.docs.forEach(d => { if (d.data().storeId) storeIds.add(String(d.data().storeId)); });
          } catch (e) {
            console.warn('Could not batch query store ids by phone:', e);
          }

          // Resolve store docs
          for (const sId of storeIds) {
            if (!storesMap[sId]) {
              try {
                const sDoc = await getDoc(doc(db, 'users', sId));
                if (sDoc.exists()) {
                  storesMap[sDoc.id] = { id: sDoc.id, ...sDoc.data() };
                }
              } catch (e) {}
            }
          }
        }

        // Always include current active shop if fetched
        if (shopProfile && shopProfile.id) {
          storesMap[shopProfile.id] = { ...shopProfile, ...(storesMap[shopProfile.id] || {}) };
        }
        
        const list = Object.values(storesMap);
        if (list.length > 0) {
          setMyStoreOptions(list);
        }
      } catch (err) {
        console.warn('Error querying linked store details:', err);
      }
    };
    fetchLinkedStores();
  }, [authUser, shopProfile, phone, currentLead]);

  const handleSwitchStore = async (storeId: string) => {
    setLoading(true);
    try {
      CustomerStoreLinkRouter.saveStoreLink(storeId);
      localStorage.setItem('current_shop_id', storeId);
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
      
      // Update slug in query params/hash safely
      hashParams.set('shop', storeId);
      window.location.hash = `#/portal?${hashParams.toString()}`;
      window.location.reload();
    } catch (err) {
      console.error('Failed to change active store:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    let watchdog: any;
    let unsubQuizzes: (() => void) | null = null;
    let unsubTips: (() => void) | null = null;
    let unsubOffers: (() => void) | null = null;
    let unsubInventory: (() => void) | null = null;
    let unsubBanks: (() => void) | null = null;
    let unsubShopProfile: (() => void) | null = null;

    const initPortal = async () => {
      CustomerStoreLinkRouter.initStoreLinkFromURL();
      // Robust slug extraction from search OR hash
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
      
      let rawSlug = urlParams.get('shop') || hashParams.get('shop') || searchParams.get('shop') || shopSlug || CustomerStoreLinkRouter.getLinkedStoreId();
      let activeSlug = rawSlug ? decodeURIComponent(rawSlug).trim() : null;
      
      // Dynamic fallback to 'demo' to prevent blacklisting/relocating if no url parameters are supplied
      if (!activeSlug) {
        activeSlug = 'demo';
      }
      
      if (!isAuthReady) return;

      try {
        let shopDoc: any = null;
        
        if (activeSlug === 'demo' || activeSlug === 'demo_store' || localStorage.getItem('current_shop_id') === 'demo_store') {
          shopDoc = {
            id: 'demo_store',
            exists: () => true,
            data: () => ({
              name: 'demo',
              shopName: 'متجر الفخامة التجريبي (JAM System Pro)',
              role: 'owner',
              status: 'active',
              customer_app_license: 'active',
              phone: '777777777',
              email: 'demo@jam-system.pro',
              bankInfo: {
                bankName: 'بنك الكريمي الإسلامي',
                accountNumber: '123456789',
                accountName: 'مؤسسة نظام جام برو لتقنية المعلومات'
              },
              currency: 'ر.ي',
              reservationNumbers: '777777777|788888888',
              createdAt: new Date()
            })
          };
        } else if (activeSlug) {
          // 1. Try finding by Name (slug)
          const qName = query(
            collection(db, 'users'), 
            where('name', '==', activeSlug), 
            where('role', 'in', ['admin', 'manager', 'wholesaler', 'superadmin', 'distributor', 'owner']),
            limit(1)
          );
          const snapName = await getDocs(qName);
          if (!active) return;
          if (!snapName.empty) {
            shopDoc = snapName.docs[0];
          } else {
            // 2. Try finding by ID
            const direct = await getDoc(doc(db, 'users', activeSlug));
            if (!active) return;
            if (direct.exists()) shopDoc = direct;
          }
        } 
        
        // Fallback for logged in customers or staff
        if (!shopDoc && authUser) {
          const fallbackId = authUser.shopId || authUser.ownerId || (localStorage.getItem('current_shop_id'));
          if (fallbackId) {
            const direct = await getDoc(doc(db, 'users', fallbackId));
            if (!active) return;
            if (direct.exists()) shopDoc = direct;
          }
        }

        // If we still don't have a shop, and we JUST loaded auth as a customer, try waiting a bit
        if (!shopDoc && isAuthReady && authUser?.role === 'customer') {
           // Maybe the profile was just created and we need a second
           await new Promise(r => setTimeout(r, 1000));
           if (!active) return;
           const fallbackId = authUser.shopId || authUser.ownerId;
           if (fallbackId) {
             const direct = await getDoc(doc(db, 'users', fallbackId));
             if (!active) return;
             if (direct.exists()) shopDoc = direct;
           }
        }

        if (!shopDoc) {
          if (!isAuthReady) return;
          console.error('Shop not found:', activeSlug);
          window.location.href = window.location.origin + window.location.pathname + '#/dashboard';
          if (active) setLoading(false);
          if (watchdog) clearTimeout(watchdog);
          return;
        }

        const ownerId = shopDoc.id;
        const ownerData = shopDoc.data();
        const profileData = { id: shopDoc.id, ...ownerData };
        CustomerStoreLinkRouter.saveStoreLink(profileData.id, profileData.shopName || profileData.name, profileData.logoUrl);

        // --- PHASE 2: Multi-Tenant Subscription Routing Logic ---
        const current_shop = profileData;
        const checkShopExpired = (shop: any) => {
          if (!shop) return false;
          if (shop.id === 'demo_store' || shop.id === 'main_hub_store') return false;
          if (shop.isLifetime) return false;

          // Master accounts and superadmins are always active
          const emailLower = (shop.email || '').toLowerCase();
          if (emailLower.includes('a777503191') || shop.role === 'superadmin') return false;

          // If explicitly active customer portal / VIP license
          if (shop.customer_app_license === 'active' || shop.isCustomerPortalActive === true || shop.vipSubscriptionActive === true) {
            const subDate = shop.subscriptionEndDate || shop.subscriptionExpiry || shop.vipExpiry;
            if (subDate) {
              let endDate: Date;
              if (subDate?.toDate && typeof subDate.toDate === 'function') {
                endDate = subDate.toDate();
              } else {
                endDate = new Date(subDate);
              }
              if (!isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
                return true;
              }
            }
            return false;
          }

          if (shop.status === 'suspended' || shop.status === 'blocked' || shop.status === 'rejected' || shop.status === 'disabled') return true;
          if (shop.isExpired === true || shop.customer_app_license === 'expired') return true;
          const subDate = shop.subscriptionEndDate || shop.subscriptionExpiry || shop.vipExpiry;
          if (subDate) {
            let endDate: Date;
            if (subDate?.toDate && typeof subDate.toDate === 'function') {
              endDate = subDate.toDate();
            } else {
              endDate = new Date(subDate);
            }
            if (!isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
              return true;
            }
          }
          return false;
        };

        const isCurrentShopExpired = checkShopExpired(current_shop);
        
        if (isCurrentShopExpired && current_shop.id !== 'demo_store') {
          console.log(`⚠️ Shop ${current_shop.shopName || current_shop.id} status resides as EXPIRED.`);
          setSubscriptionWarningMessage("اشتراك هذا المتجر منتهي. جاري التحويل لمتجر نشط...");
          
          let redirected = false;
          const savedPhone = localStorage.getItem('customerPhone');
          if (savedPhone) {
            try {
              const [leadsSnap, clientsSnap, customersSnap] = await Promise.all([
                getDocs(query(collection(db, 'leads'), where('phone', '==', savedPhone))),
                getDocs(query(collection(db, 'clients'), where('phone', '==', savedPhone))),
                getDocs(query(collection(db, 'customers'), where('phone', '==', savedPhone)))
              ]);

              const foundStoreIds = new Set<string>();
              leadsSnap.docs.forEach(doc => { if (doc.data().ownerId) foundStoreIds.add(String(doc.data().ownerId)); });
              clientsSnap.docs.forEach(doc => { if (doc.data().storeId) foundStoreIds.add(String(doc.data().storeId)); });
              customersSnap.docs.forEach(doc => { if (doc.data().ownerId || doc.data().storeId) foundStoreIds.add(String(doc.data().ownerId || doc.data().storeId)); });

              // Include linked stores of authUser if any
              if (authUser?.linkedStores) {
                authUser.linkedStores.forEach((id: string) => foundStoreIds.add(id));
              }

              foundStoreIds.delete(current_shop.id);
              const otherStoreIds = Array.from(foundStoreIds).filter(Boolean);

              if (otherStoreIds.length > 0) {
                let activeFallbackStore: any = null;
                for (const fallbackId of otherStoreIds) {
                  const d = await getDoc(doc(db, 'users', fallbackId));
                  if (d.exists()) {
                    const candidate = { id: d.id, ...d.data() };
                    const isCandidateExpired = checkShopExpired(candidate);
                    if (!isCandidateExpired && (candidate.isCustomerPortalActive === true || candidate.customer_app_license === 'active' || candidate.status === 'active')) {
                      activeFallbackStore = candidate;
                      break;
                    }
                  }
                }

                if (activeFallbackStore) {
                  const activeShopId = activeFallbackStore.id;
                  console.log(`🔄 Automatically redirecting to active shop: ${activeShopId}`);
                  setSubscriptionWarningMessage("اشتراك هذا المتجر منتهي. جاري التحويل لمتجر نشط...");
                  
                  setShopProfile(activeFallbackStore);
                  localStorage.setItem('jam_portal_shop_profile', JSON.stringify(activeFallbackStore));
                  localStorage.setItem('current_shop_id', activeShopId);
                  
                  const sp = new URLSearchParams(window.location.search);
                  sp.set('shop', activeShopId);
                  window.history.replaceState(null, '', `${window.location.pathname}?${sp.toString()}`);
                  
                  setHasCheckedSubscription(true);
                  if (active) setLoading(false);
                  redirected = true;
                  setTimeout(() => {
                    window.location.reload();
                  }, 2000);
                  return;
                }
              }
            } catch (err) {
              console.warn('Error during subscription routing lookup:', err);
            }
          }
          
          if (!redirected) {
            console.log("No active shop exists in linked list. Redirecting to Subscription Expired Notice Page.");
            setSubscriptionWarningMessage("اشتراك هذا المتجر منتهي الصلاحية ولا يوجد متجر بديل نشط.");
            setHasCheckedSubscription(true);
            setAuthStep('subscription-expired');
            if (active) setLoading(false);
            return;
          }
        } else {
          setHasCheckedSubscription(true);
        }

        if (active) {
          if (ownerId !== 'demo_store') {
            unsubShopProfile = onSnapshot(doc(db, 'users', ownerId), (docSnap) => {
              if (docSnap.exists() && active) {
                const data = docSnap.data();
                const updatedProfileData = { id: docSnap.id, ...data };
                setShopProfile(updatedProfileData);
                localStorage.setItem('jam_portal_shop_profile', JSON.stringify(updatedProfileData));
                localStorage.setItem('current_shop_id', docSnap.id);
              }
            }, (err) => {
              console.warn("⚠️ Silent grace mechanism: Transient connection drop, token refresh, or network stall on store profile listener. Retaining last successfully loaded cached snapshot in component state.", err.message);
            });
          } else {
            setShopProfile(profileData);
            localStorage.setItem('jam_portal_shop_profile', JSON.stringify(profileData));
            localStorage.setItem('current_shop_id', 'demo_store');
          }
        }

        // Recover session for THIS shop - silently caches the lead details but leaves the gate screen active
        const savedPhone = localStorage.getItem('customerPhone');
        if (savedPhone && !currentLead) {
           try {
             const lead = await smartCommerceService.getOrCreateLead(savedPhone, ownerId, auth.currentUser?.uid);
             if (!active) return;
             if (active) {
               setCurrentLead(lead);
               try {
                 localStorage.setItem('jam_portal_current_lead', JSON.stringify(lead));
               } catch (e) {}
             }
           } catch (e) {
             console.warn('Silent session recovery failed:', e);
           }
        }

        if (ownerId === 'demo_store') {
          // Instantly set mock values so there is zero latency
          setActiveQuizzes([]);
          setPhoneTips([]);
          setActiveOffers([]);
          setInventory([]);
          setBankAccounts([]);
          if (active) setLoading(false);
          return;
        }

        if (!auth.currentUser) {
          if (active) setLoading(false);
          return; // Skip listening if user is logged out
        }

        if (!active) return;

        // Setup direct safe getDocs queries to optimize quota and avoid endless real-time connections
        const queryWithFallback = async (colName: string, extraFilters: any[] = []) => {
          try {
            const qStoreId = query(collection(db, colName), where('storeId', '==', ownerId), ...extraFilters);
            const snap = await getDocs(qStoreId);
            if (!snap.empty) return snap;
          } catch(e){}
          // Fallback to legacy ownerId
          const qOwnerId = query(collection(db, colName), where('ownerId', '==', ownerId), ...extraFilters);
          return await getDocs(qOwnerId);
        };

        try {
          const s = await queryWithFallback('quizzes', [where('isActive', '==', true)]);
          if (active) {
            const list = s.docs.map(d => ({ id: d.id, ...d.data() } as Quiz));
            setActiveQuizzes(list);
            localStorage.setItem(`jam_portal_quizzes_${ownerId}`, JSON.stringify(list));
          }
        } catch (err: any) {
          console.warn('Quizzes fetch error (tolerated, fallback to cache):', err.message);
          const cached = localStorage.getItem(`jam_portal_quizzes_${ownerId}`);
          if (cached && active) {
            try { setActiveQuizzes(JSON.parse(cached)); } catch(e){}
          }
        }

        try {
          const s = await queryWithFallback('phoneDoctorTips');
          if (active) {
            const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
            setPhoneTips(list);
            localStorage.setItem(`jam_portal_tips_${ownerId}`, JSON.stringify(list));
          }
        } catch (err: any) {
          console.warn('Tips fetch error (tolerated, fallback to cache):', err.message);
          const cached = localStorage.getItem(`jam_portal_tips_${ownerId}`);
          if (cached && active) {
            try { setPhoneTips(JSON.parse(cached)); } catch(e){}
          }
        }

        try {
          const s = await queryWithFallback('offers', [where('status', '==', 'active')]);
          if (active) {
            const list = s.docs.map(d => ({ id: d.id, ...d.data() } as PromoOffer));
            setActiveOffers(list);
            localStorage.setItem(`jam_portal_offers_${ownerId}`, JSON.stringify(list));
          }
        } catch (err: any) {
          console.warn('Offers fetch error (tolerated, fallback to cache):', err.message);
          const cached = localStorage.getItem(`jam_portal_offers_${ownerId}`);
          if (cached && active) {
            try { setActiveOffers(JSON.parse(cached)); } catch(e){}
          }
        }

        try {
          const s = await queryWithFallback('inventory');
          if (active) {
            const list = s.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
            setInventory(list);
            localStorage.setItem(`jam_portal_inventory_${ownerId}`, JSON.stringify(list));
          }
        } catch (err: any) {
          console.warn('Inventory fetch error (tolerated, fallback to cache):', err.message);
          const cached = localStorage.getItem(`jam_portal_inventory_${ownerId}`);
          if (cached && active) {
            try { setInventory(JSON.parse(cached)); } catch(e){}
          }
        }

        try {
          const s = await queryWithFallback('bank_accounts');
          if (active) {
            const list = s.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(a => a.ownerId !== 'DELETED' && a.storeId !== 'DELETED');
            setBankAccounts(list);
            localStorage.setItem(`jam_portal_banks_${ownerId}`, JSON.stringify(list));
          }
        } catch (err: any) {
          console.warn('Banks fetch error (tolerated, fallback to cache):', err.message);
          const cached = localStorage.getItem(`jam_portal_banks_${ownerId}`);
          if (cached && active) {
            try { setBankAccounts(JSON.parse(cached)); } catch(e){}
          }
        }

      } catch (err: any) {
        console.warn('Portal init error (handled gracefully with complete silent cache override):', err);
        const cached = localStorage.getItem('jam_portal_shop_profile');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (active) {
              setShopProfile(parsed);
              console.warn("⚠️ Intercepted transient connection drop/timeout. Retaining cached store snapshot silently.");
              
              // Hydrate sub-collections silently from local storage if available
              const hydrate = (key: string, setter: (val: any) => void) => {
                const c = localStorage.getItem(key);
                if (c) { try { setter(JSON.parse(c)); } catch(e){} }
              };
              hydrate(`jam_portal_quizzes_${parsed.id}`, setActiveQuizzes);
              hydrate(`jam_portal_tips_${parsed.id}`, setPhoneTips);
              hydrate(`jam_portal_offers_${parsed.id}`, setActiveOffers);
              hydrate(`jam_portal_inventory_${parsed.id}`, setInventory);
              hydrate(`jam_portal_banks_${parsed.id}`, setBankAccounts);
            }
          } catch (e) {}
        }
        if (active && !shopProfile && !cached) {
          setError('خطأ في الاتصال بالقاعدة: ' + (err.message || 'Unknown error'));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    // Watchdog timer
    watchdog = setTimeout(() => {
      if (active) {
        const cached = localStorage.getItem('jam_portal_shop_profile');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setShopProfile(parsed);
            
            // Hydrate other collections silently
            const hydrate = (key: string, setter: (val: any) => void) => {
              const c = localStorage.getItem(key);
              if (c) { try { setter(JSON.parse(c)); } catch(e){} }
            };
            hydrate(`jam_portal_quizzes_${parsed.id}`, setActiveQuizzes);
            hydrate(`jam_portal_tips_${parsed.id}`, setPhoneTips);
            hydrate(`jam_portal_offers_${parsed.id}`, setActiveOffers);
            hydrate(`jam_portal_inventory_${parsed.id}`, setInventory);
            hydrate(`jam_portal_banks_${parsed.id}`, setBankAccounts);

            setLoading(false);
            console.warn("⏱️ Watchdog timer fired but loaded store settings from local cache gracefully.");
            return;
          } catch (e) {}
        }
        if (!shopProfile) {
          setLoading(false);
          setError('تعذر تحميل بيانات المتجر. يرجى التأكد من الرابط أو المحاولة لاحقاً.');
        }
      }
    }, 20000);

    initPortal();
    return () => {
      active = false;
      if (watchdog) clearTimeout(watchdog);
      if (unsubQuizzes) { try { unsubQuizzes(); } catch(e){} }
      if (unsubTips) { try { unsubTips(); } catch(e){} }
      if (unsubOffers) { try { unsubOffers(); } catch(e){} }
      if (unsubInventory) { try { unsubInventory(); } catch(e){} }
      if (unsubBanks) { try { unsubBanks(); } catch(e){} }
      if (unsubShopProfile) { try { unsubShopProfile(); } catch(e){} }
    };
  }, [shopSlug, isAuthReady, authUser]);

  const [ads, setAds] = useState<any[]>([]);
  const [activeAds, setActiveAds] = useState<any[]>([]);
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeAd, setActiveAd] = useState<any>(null);
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  
  useEffect(() => {
    // Force Dark Mode for Customers as requested
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    let active = true;
    if (!isAuthReady) return;
    const fetchAds = async () => {
      try {
        const adsRef = collection(db, 'ads');
        const q = query(
          adsRef, 
          where('active', '==', true), 
          where('segments', 'array-contains', 'customers'),
          orderBy('order', 'asc')
        );
        const s = await getDocs(q);
        if (active) {
          setAds(s.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (error: any) {
        console.warn("⚠️ Graceful Fallback: Error fetching ads:", error.message);
        if (active) setAds([]);
      }
    };
    fetchAds();
    return () => { active = false; };
  }, [isAuthReady]);

  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentAdIndex(prev => (prev + 1) % ads.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [ads.length]);

  const [isDemoSettingUp, setIsDemoSettingUp] = useState(false);

  const ensureDemoStoreAndData = async () => {
    try {
      // Actively purge and delete previous demo store/data to ensure a completely clean database
      const demoStoreRef = doc(db, 'users', 'demo_store');
      await deleteDoc(demoStoreRef);

      const demoVipRef = doc(db, 'pending_activations', 'demo_vip_activation');
      await deleteDoc(demoVipRef);

      const demoQuizRef = doc(db, 'quizzes', 'demo_quiz_1');
      await deleteDoc(demoQuizRef);

      const demoOffer1Ref = doc(db, 'offers', 'demo_offer_1');
      await deleteDoc(demoOffer1Ref);

      const demoOffer2Ref = doc(db, 'offers', 'demo_offer_2');
      await deleteDoc(demoOffer2Ref);

      const demoTipRef = doc(db, 'phoneDoctorTips', 'demo_tip_1');
      await deleteDoc(demoTipRef);

      console.log('🧹 Cleaned up and deleted all previous demo store data successfully from Firestore.');

      // Automatically configure shopProfile to be empty or pristine to prevent dummy redirects
      const profileData = {
        id: 'real_store_clean',
        name: 'store',
        shopName: 'متجر الجملة والتجزئة الرئيسي',
        role: 'owner',
        status: 'active',
        customer_app_license: 'active',
        phone: '777777777',
        email: 'info@jamsystem.com',
        bankInfo: {
          bankName: 'بنك الكريمي الإسلامي',
          accountNumber: '123456789',
          accountName: 'المؤسسة التجارية'
        },
        currency: 'ر.ي'
      };
      setShopProfile(profileData);
      localStorage.setItem('jam_portal_shop_profile', JSON.stringify(profileData));
      localStorage.setItem('current_shop_id', 'real_store_clean');
      
      // Clear URL params gracefully
      const sp = new URLSearchParams(window.location.search);
      sp.delete('shop');
      window.history.replaceState(null, '', `${window.location.pathname}?${sp.toString()}`);

    } catch (err) {
      console.error('Error cleaning up demo content inside Firestore:', err);
    }
  };

  const handleAutofillDemo = async (type: 'normal' | 'vip') => {
    setIsDemoSettingUp(true);
    setLoading(true);
    try {
      // Execute firestore seeding in background, catch all failures silently to avoid blocking user flow
      try {
        await ensureDemoStoreAndData();
      } catch (seedErr) {
        console.warn("Seeding demo store data failed but proceeding gracefully on client-side:", seedErr);
      }
      
      const demoLead = {
        id: 'demo_store_777777777',
        ownerId: 'demo_store',
        phone: '777777777',
        name: type === 'normal' ? 'الأستاذ أحمد (عميل تجريبي)' : 'الأستاذ أحمد (عميل VIP التجريبي)',
        points: 15400,
        totalSpent: 98000,
        repairCount: 3,
        saleCount: 5,
        completedQuizzes: [],
        lastVisitAt: new Date(),
        createdAt: new Date()
      };

      const demoProfile = {
        id: 'demo_store',
        name: 'demo',
        shopName: 'متجر الفخامة التجريبي (JAM System Pro)',
        role: 'owner',
        status: 'active',
        customer_app_license: 'active',
        phone: '777777777',
        email: 'demo@jam-system.pro',
        bankInfo: {
          bankName: 'بنك الكريمي الإسلامي',
          accountNumber: '123456789',
          accountName: 'مؤسسة نظام جام برو لتقنية المعلومات'
        },
        currency: 'ر.ي'
      };

      setShopProfile(demoProfile);
      localStorage.setItem('jam_portal_shop_profile', JSON.stringify(demoProfile));
      localStorage.setItem('current_shop_id', 'demo_store');

      if (type === 'normal') {
        setLoginMode('normal');
        setPhone('777777777');
        setLeadName('الأستاذ أحمد (عميل تجريبي)');
        
        // Try background fetch, otherwise use constructed local mock
        let lead = demoLead;
        try {
          lead = await smartCommerceService.getOrCreateLead('777777777', 'demo_store', auth.currentUser?.uid, 'الأستاذ أحمد (عميل تجريبي)');
        } catch (dbErr) {
          console.warn('Real Firestore getOrCreateLead failed, using fallback mock data:', dbErr);
        }

        setCurrentLead(lead);
        localStorage.setItem('customerPhone', '777777777');
        localStorage.setItem('customerName', 'الأستاذ أحمد (عميل تجريبي)');
        localStorage.setItem('jam_portal_current_lead', JSON.stringify(lead));
        setAuthStep('dashboard');
        setActiveTab('home');
      } else {
        setLoginMode('vip');
        setPhone('777777777');
        setVipCode('77777777');
        setVipPassword('123456');
        
        // Try background fetch, otherwise use constructed local mock
        let lead = demoLead;
        try {
          lead = await smartCommerceService.getOrCreateLead('777777777', 'demo_store', auth.currentUser?.uid, 'الأستاذ أحمد (عميل VIP التجريبي)');
        } catch (dbErr) {
          console.warn('Real Firestore getOrCreateLead failed for VIP, using fallback mock data:', dbErr);
        }

        setCurrentLead(lead);
        localStorage.setItem('customerPhone', '777777777');
        localStorage.setItem('customerName', 'الأستاذ أحمد (عميل VIP التجريبي)');
        localStorage.setItem('jam_portal_current_lead', JSON.stringify(lead));
        localStorage.setItem('isVipLogged', 'true');
        localStorage.setItem('vipDocId', 'demo_vip_activation');
        setAuthStep('dashboard');
        setActiveTab('home');
      }
    } catch (err) {
      console.error('Autofill demo error:', err);
    } finally {
      setIsDemoSettingUp(false);
      setLoading(false);
    }
  };

  const completeLoginForStore = async (storeId: string, cleanPhone: string, inputName: string, isVip: boolean, vipData?: any) => {
    setLoading(true);
    try {
      if (shopProfile?.id !== storeId) {
        const direct = await getDoc(doc(db, 'users', storeId));
        if (direct.exists()) {
          const profileData = { id: direct.id, ...direct.data() };
          setShopProfile(profileData);
          localStorage.setItem('jam_portal_shop_profile', JSON.stringify(profileData));
          localStorage.setItem('current_shop_id', storeId);
          
          const sp = new URLSearchParams(window.location.search);
          sp.set('shop', storeId);
          window.history.replaceState(null, '', `${window.location.pathname}?${sp.toString()}`);
        }
      }

      let loggedUid = `client-auth-disabled-${cleanPhone}`;
      const finalName = vipData?.customerName || inputName || 'زبون VIP معتمد';
      
      const lead = await smartCommerceService.getOrCreateLead(cleanPhone, storeId, loggedUid, finalName);
      
      if (isVip && vipData?.id && !vipData.isUsed) {
        try {
          await updateDoc(doc(db, 'pending_activations', vipData.id), {
            isUsed: true,
            updatedAt: serverTimestamp()
          });
        } catch (updateErr) {
          console.warn("⚠️ Skipping activation update.");
        }
      }

      setCurrentLead(lead);
      localStorage.setItem('customerPhone', cleanPhone);
      localStorage.setItem('customerName', finalName);
      localStorage.setItem('jam_portal_current_lead', JSON.stringify(lead));
      localStorage.setItem('isVipLogged', isVip ? 'true' : 'false');
      localStorage.setItem('jam_last_login_time', Date.now().toString());
      localStorage.setItem('last_login', Date.now().toString());
      localStorage.setItem('jam_offline_token', `offline-token-${storeId}-${cleanPhone}`);
      if (vipData?.id) {
        localStorage.setItem('vipDocId', vipData.id);
      }

      sessionStorage.setItem('jam_portal_entered_dashboard', 'false');
      setAuthStep('welcome');
      setShowStoreSelector(false);
      const urlTab = searchParams.get('tab');
      if (!urlTab) {
        setActiveTab('home');
      }
    } catch (err) {
      console.error("Failed to complete login for store", storeId, err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkMultiStoreAndLogin = async (cleanPhone: string, inputName: string, isVip: boolean, vipData?: any) => {
    try {
      // Pull all matching store-client profile mappings across leads, clients, and customers with a timeout fallback
      const [leadsSnap, clientsSnap, customersSnap, activationsSnap] = await withTimeout(Promise.all([
        getDocs(query(collection(db, 'leads'), where('phone', '==', cleanPhone))),
        getDocs(query(collection(db, 'clients'), where('phone', '==', cleanPhone))),
        getDocs(query(collection(db, 'customers'), where('phone', '==', cleanPhone))),
        getDocs(query(collection(db, 'pending_activations'), where('customerPhone', '==', cleanPhone)))
      ]), 8000, 'تعذر الاستعلام عن المتاجر المرتبطة بالحساب (انتهت المهلة الزمنية للاتصال).');

      const foundStoreIds = new Set<string>();
      
      leadsSnap.docs.forEach(doc => {
        const id = doc.data().ownerId;
        if (id) foundStoreIds.add(String(id));
      });

      clientsSnap.docs.forEach(doc => {
        const id = doc.data().storeId;
        if (id) foundStoreIds.add(String(id));
      });

      customersSnap.docs.forEach(doc => {
        const id = doc.data().ownerId || doc.data().storeId;
        if (id) foundStoreIds.add(String(id));
      });

      activationsSnap.docs.forEach(doc => {
        const id = doc.data().storeId;
        if (id) foundStoreIds.add(String(id));
      });

      const storeIdList = Array.from(foundStoreIds).filter(Boolean);

      let fetchedStores: any[] = [];
      
      if (storeIdList.length > 0) {
        // Resolve each store info securely in parallel using direct doc reads
        const storeDocs = await Promise.all(
          storeIdList.map(async (id) => {
            try {
              const d = await getDoc(doc(db, 'users', id));
              if (d.exists()) {
                return { id: d.id, ...d.data() };
              }
            } catch (err) {
              console.warn(`[Portal Login] Could not resolve store details for store ID: ${id}`, err);
            }
            return null;
          })
        );
        fetchedStores = storeDocs.filter((s): s is any => s !== null);
      }
      
      if (shopProfile?.id && shopProfile.id !== 'demo_store') {
        const hasCurrentShop = fetchedStores.some(s => s.id === shopProfile.id);
        if (!hasCurrentShop) {
          fetchedStores.push(shopProfile);
        }
      }

      if (fetchedStores.length > 0) {
        setMyStoreOptions(fetchedStores);
      }

      if (fetchedStores.length <= 1) {
        const targetStore = fetchedStores[0] || shopProfile || { id: 'main_hub_store' };
        await completeLoginForStore(targetStore.id, cleanPhone, inputName, isVip, vipData);
      } else {
        setMatchingStores(fetchedStores);
        setPendingLoginInfo({ phone: cleanPhone, leadName: inputName, isVip, vipData });
        setShowStoreSelector(true);
      }
    } catch (err) {
      console.error("Multi-store check failed, falling back to current store:", err);
      await completeLoginForStore(shopProfile?.id || 'main_hub_store', cleanPhone, inputName, isVip, vipData);
    }
  };

  const handleLogin = async (e: React.FormEvent, method: 'whatsapp' | 'sms' | 'direct' = 'direct') => {
    if (e) e.preventDefault();
    setAuthConnectionError(null);
    if (phone.length < 4) return;
    setLoading(true);
    
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();

    try {
      await checkMultiStoreAndLogin(cleanPhone, leadName || 'زبون معتمد', false);
      console.log(`Login initiated for ${cleanPhone}, multi-tenancy store checked.`);
    } catch (err: any) {
      console.error('CustomerPortal login error:', err);
      setAuthConnectionError('عذراً، فشل تسجيل الدخول: ' + (err.message || 'خطأ غير معروف في الاتصال.'));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalLogout = async () => {
    setLoading(true);
    try {
      if (unsubQuizzesRef.current) { try { unsubQuizzesRef.current(); } catch(e){} unsubQuizzesRef.current = null; }
      if (unsubTipsRef.current) { try { unsubTipsRef.current(); } catch(e){} unsubTipsRef.current = null; }
      if (unsubOffersRef.current) { try { unsubOffersRef.current(); } catch(e){} unsubOffersRef.current = null; }
      if (unsubInventoryRef.current) { try { unsubInventoryRef.current(); } catch(e){} unsubInventoryRef.current = null; }
      if (unsubBanksRef.current) { try { unsubBanksRef.current(); } catch(e){} unsubBanksRef.current = null; }

      // Read current customer identity details to preserve them
      const savedPhone = localStorage.getItem('customerPhone') || '';
      const savedName = localStorage.getItem('customerName') || '';
      const savedShopProfile = localStorage.getItem('jam_portal_shop_profile') || '';
      const savedCurrentShopId = localStorage.getItem('current_shop_id') || '';
      const savedCurrentLead = localStorage.getItem('jam_portal_current_lead') || '';
      const savedIsVipLogged = localStorage.getItem('isVipLogged') || '';
      const savedVipDocId = localStorage.getItem('vipDocId') || '';
      const savedOfflineToken = localStorage.getItem('jam_offline_token') || '';

      // Clear localized component states immediately to instantly reset recognition UI
      setPhone('');
      setLeadName('');

      // Clear general session data but preserve essential customer identity
      localStorage.clear();
      sessionStorage.clear();
      await auth.signOut();

      // Restore saved customer details to keep them retained
      if (savedPhone) localStorage.setItem('customerPhone', savedPhone);
      if (savedName) localStorage.setItem('customerName', savedName);
      if (savedShopProfile) localStorage.setItem('jam_portal_shop_profile', savedShopProfile);
      if (savedCurrentShopId) localStorage.setItem('current_shop_id', savedCurrentShopId);
      if (savedCurrentLead) localStorage.setItem('jam_portal_current_lead', savedCurrentLead);
      if (savedIsVipLogged) localStorage.setItem('isVipLogged', savedIsVipLogged);
      if (savedVipDocId) localStorage.setItem('vipDocId', savedVipDocId);
      if (savedOfflineToken) localStorage.setItem('jam_offline_token', savedOfflineToken);
      localStorage.setItem('jam_returning_vip', 'true');

      // Navigate immediately via React Router SPA history to break route context
      navigate('/dashboard');

      // Use an immediate clean reload/redirect to ensure all modules are fresh
      setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname + '#/dashboard';
        window.location.reload();
      }, 50);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickVipLogin = async () => {
    setLoading(true);
    setVipError(null);
    try {
      const cachedLeadStr = localStorage.getItem('jam_portal_current_lead');
      if (cachedLeadStr) {
        const lead = JSON.parse(cachedLeadStr);
        setCurrentLead(lead);
        sessionStorage.setItem('jam_portal_entered_dashboard', 'false');
        setAuthStep('welcome');
        sessionStorage.removeItem('jam_vip_logged_out_farewell');
        setLoading(false);
        return;
      }
      const savedPhone = localStorage.getItem('customerPhone') || phone;
      const savedName = localStorage.getItem('customerName') || 'زبون VIP معتمد';
      const cleanPhone = savedPhone.replace(/[\s\-\(\)]/g, '').trim();
      await checkMultiStoreAndLogin(cleanPhone, savedName, true);
      sessionStorage.removeItem('jam_vip_logged_out_farewell');
    } catch (err: any) {
      console.error(err);
      setVipError('عذراً، تعذرت المزامنة السريعة للحساب: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVipLogin = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setVipError(null);
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
    const enteredCode = vipCode.trim();

    if (cleanPhone.length < 4) {
      setVipError('يرجى إدخال رقم هاتف صحيح يتكون من 4 أرقام على الأقل.');
      return;
    }
    if (enteredCode.length < 4) {
      setVipError('يرجى إدخال كلمة مرور صحيحة للحساب (المسجلة لدى المتجر).');
      return;
    }

    setLoading(true);

    try {
      let matchedDoc: any = null;
      const shopId = shopProfile?.id || 'main_hub_store';

      // 1. Verify credentials via the secure backend API that checks all Firestore collections on the server
      try {
        const res = await withTimeout(fetch('/api/auth/verify-vip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, password: enteredCode, storeId: shopId, code: enteredCode })
        }), 8000, 'فشل الاتصال بخادم التحقق من الهوية (انتهت المهلة الزمنية). يرجى التحقق من الشبكة.');
        if (res.ok) {
          const responseData = await res.json();
          if (responseData.success && responseData.matchedDoc) {
            matchedDoc = responseData.matchedDoc;
            console.log("👑 Signed In Successfully via Al-Thuraya ERP secure database server!");
          }
        }
      } catch (serverFallbackErr: any) {
        console.error("❌ Secure API VIP verify failed:", serverFallbackErr);
        // If it was a real timeout, throw it to notify the user instead of ignoring it
        if (serverFallbackErr.message && serverFallbackErr.message.includes('انتهت المهلة')) {
          throw serverFallbackErr;
        }
      }

      if (!matchedDoc) {
        setVipError('رقم الهاتف أو كود التفعيل غير مطابق. يرجى التأكد من البيانات المدخلة.');
        setLoading(false);
        return;
      }

      // Check shop license status dynamically
      try {
        const shopSnap = await withTimeout(getDoc(doc(db, 'users', shopId)), 6000);
        if (shopSnap.exists()) {
          const freshShop = shopSnap.data();
          const isPortalActiveBySubscription = freshShop.isCustomerPortalActive === true;
          if (!isPortalActiveBySubscription && (freshShop.customer_app_license !== 'active' || freshShop.status === 'disabled' || freshShop.status === 'suspended')) {
            setVipError('عذراً، تطبيق الزبائن VIP متوقف مؤقتاً لدى هذا المحل حالياً.');
            setLoading(false);
            return;
          }
        }
      } catch (licenseErr) {
        console.warn("⚠️ Shop license status check bypassed in fallback mode.");
      }

      const customerName = matchedDoc?.customerName || 'زبون VIP معتمد';
      await checkMultiStoreAndLogin(cleanPhone, customerName, true, matchedDoc);
    } catch (err: any) {
      console.error('VIP Auth Error:', err);
      setVipError('فشل الدخول السحابي: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const performLogout = async () => {
    setIsLoggingOut(true);
    (window as any).isLoggingOut = true;
    sessionStorage.setItem('just_logged_out', 'true');
    try {
      // Instantly shut down all snapshot listeners to prevent "Missing or insufficient permissions"
      if (unsubQuizzesRef.current) { try { unsubQuizzesRef.current(); } catch(e){} unsubQuizzesRef.current = null; }
      if (unsubTipsRef.current) { try { unsubTipsRef.current(); } catch(e){} unsubTipsRef.current = null; }
      if (unsubOffersRef.current) { try { unsubOffersRef.current(); } catch(e){} unsubOffersRef.current = null; }
      if (unsubInventoryRef.current) { try { unsubInventoryRef.current(); } catch(e){} unsubInventoryRef.current = null; }
      if (unsubBanksRef.current) { try { unsubBanksRef.current(); } catch(e){} unsubBanksRef.current = null; }

      // Read current customer identity details
      const savedPhone = localStorage.getItem('customerPhone') || '';
      const savedName = localStorage.getItem('customerName') || '';
      const savedShopProfile = localStorage.getItem('jam_portal_shop_profile') || '';
      const savedCurrentShopId = localStorage.getItem('current_shop_id') || '';
      const savedCurrentLead = localStorage.getItem('jam_portal_current_lead') || '';
      const savedIsVipLogged = localStorage.getItem('isVipLogged') || '';
      const savedVipDocId = localStorage.getItem('vipDocId') || '';
      const savedOfflineToken = localStorage.getItem('jam_offline_token') || '';

      // Clear general session data but do NOT wipe VIP client identity
      localStorage.clear();
      sessionStorage.clear();
      
      // Prevent auto-login recovery
      sessionStorage.setItem('just_logged_out', 'true');
      sessionStorage.setItem('jam_vip_logged_out_farewell', 'true'); // Show farewell screen on next mount/view HTML

      if (savedPhone) {
        localStorage.setItem('customerPhone', savedPhone);
      }
      if (savedName) {
        localStorage.setItem('customerName', savedName);
      }
      if (savedShopProfile) {
        localStorage.setItem('jam_portal_shop_profile', savedShopProfile);
      }
      if (savedCurrentShopId) {
        localStorage.setItem('current_shop_id', savedCurrentShopId);
      }
      if (savedCurrentLead) {
        localStorage.setItem('jam_portal_current_lead', savedCurrentLead);
      }
      if (savedIsVipLogged) {
        localStorage.setItem('isVipLogged', savedIsVipLogged);
      }
      if (savedVipDocId) {
        localStorage.setItem('vipDocId', savedVipDocId);
      }
      if (savedOfflineToken) {
        localStorage.setItem('jam_offline_token', savedOfflineToken);
      }
      localStorage.setItem('jam_returning_vip', 'true');

      // Reset local states to guarantee UI resets instantly
      setPhone(savedPhone);
      setLeadName(savedName);
      setVerificationCode('');
      setCurrentLead(savedCurrentLead ? JSON.parse(savedCurrentLead) : null);
      setAuthUser(null);
      setAuthStep('login');
      
      await auth.signOut();
      
      // STRICT REDIRECT to the Customer Portal for this shop, completely isolated from merchant program
      const shopId = shopProfile?.id || savedCurrentShopId;
      const redirectUrl = shopId 
        ? `${window.location.origin}/portal?shop=${shopId}`
        : `${window.location.origin}/portal`;
      
      window.location.href = redirectUrl;
      setTimeout(() => {
        window.location.reload();
      }, 150);
    } catch (error) {
      console.error("Secure logout failed:", error);
      window.location.href = window.location.origin + window.location.pathname + '#/dashboard';
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length < 4) return;
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
      await checkMultiStoreAndLogin(cleanPhone, leadName || 'زبون معتمد', false);
    } catch (err: any) {
      console.error('CustomerPortal verify error:', err);
      sessionStorage.setItem('jam_portal_entered_dashboard', 'false');
      setAuthStep('welcome');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStatement = async () => {
    setIsStatementOpen(true);
    if (!currentLead?.phone || !shopProfile?.id) return;
    setLoadingStatement(true);
    try {
      const phoneVariants = getPhonePermutations(currentLead.phone);
      const targetStoreId = shopProfile.id;
      const currentCustId = customerProfile?.id || currentLead?.id || '';
      
      // 1. Fetch Sales (Phones, Accessories, Hardware, Recharge, SIMs)
      const qSalesStore = query(
        collection(db, 'sales'),
        where('storeId', '==', targetStoreId),
        where('customerPhone', 'in', phoneVariants.slice(0, 10))
      );
      let salesSnap = await getDocs(qSalesStore);
      if (salesSnap.empty) {
        const qSalesOwner = query(
          collection(db, 'sales'),
          where('ownerId', '==', targetStoreId),
          where('customerPhone', 'in', phoneVariants.slice(0, 10))
        );
        salesSnap = await getDocs(qSalesOwner);
      }

      // Also try fetching by customerId if available
      let salesDocsById: any[] = [];
      if (currentCustId) {
        try {
          const qSalesById = query(
            collection(db, 'sales'),
            where('customerId', '==', currentCustId)
          );
          const snapById = await getDocs(qSalesById);
          salesDocsById = snapById.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {}
      }

      const salesMap = new Map<string, any>();
      salesSnap.docs.forEach(d => salesMap.set(d.id, { id: d.id, ...d.data() }));
      salesDocsById.forEach(d => salesMap.set(d.id, d));

      let totalSalesDebt = 0;
      let totalNetworkDebt = 0;
      let salesCount = 0;

      const salesDocs = Array.from(salesMap.values()).map(data => {
        const total = Number(data.total || data.totalAmount || 0);
        const isDebt = data.paymentMethod === 'debt' || data.isDebt || data.remainingDebt > 0;
        const isNetwork = data.category === 'recharge' || data.category === 'sim' || data.type === 'sim_sale';

        if (isDebt) {
          if (isNetwork) totalNetworkDebt += total;
          else totalSalesDebt += total;
          salesCount++;
        }

        const itemsSummary = Array.isArray(data.items) 
          ? data.items.map((i: any) => `${i.name || 'صنف'} (${i.quantity || 1})`).join(' ، ')
          : (data.description || 'مبيعات متجر');

        return {
          id: data.id,
          type: isNetwork ? 'network' : 'sale',
          title: isNetwork ? `خدمة رصيد/شريحة #${data.id.slice(-6).toUpperCase()}` : `فاتورة مبيعات #${data.id.slice(-6).toUpperCase()}`,
          amount: total,
          itemsSummary,
          paymentMethod: data.paymentMethod || 'cash',
          date: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date()),
          status: isDebt ? 'آجل (دين)' : 'مدفوع نقدياً',
          isDebt,
          ...data
        };
      });

      // 2. Fetch Maintenance Orders (Repairs / Devices)
      const qMaintStore = query(
        collection(db, 'maintenanceOrders'),
        where('storeId', '==', targetStoreId),
        where('customerPhone', 'in', phoneVariants.slice(0, 10))
      );
      let maintSnap = await getDocs(qMaintStore);
      if (maintSnap.empty) {
        const qMaintOwner = query(
          collection(db, 'maintenanceOrders'),
          where('ownerId', '==', targetStoreId),
          where('customerPhone', 'in', phoneVariants.slice(0, 10))
        );
        maintSnap = await getDocs(qMaintOwner);
      }

      // Also fetch from "maintenance" collection by customerId
      let maintDocsById: any[] = [];
      if (currentCustId) {
        try {
          const qMaintById = query(
            collection(db, 'maintenance'),
            where('customerId', '==', currentCustId)
          );
          const snapMById = await getDocs(qMaintById);
          maintDocsById = snapMById.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {}
      }

      const maintMap = new Map<string, any>();
      maintSnap.docs.forEach(d => maintMap.set(d.id, { id: d.id, ...d.data() }));
      maintDocsById.forEach(d => maintMap.set(d.id, d));

      let totalMaintenanceDebt = 0;
      let maintenanceCount = 0;

      const maintDocs = Array.from(maintMap.values()).map(data => {
        const totalCost = Number(data.cost || (Number(data.laborCost || 0) + Number(data.sparePartsCost || 0)));
        const advance = Number(data.advancePayment || 0);
        const remaining = Math.max(0, totalCost - advance);

        if (data.status !== 'delivered' && remaining > 0) {
          totalMaintenanceDebt += remaining;
          maintenanceCount++;
        }

        let statusAr = 'قيد الانتظار';
        if (data.status === 'received' || data.status === 'Received') statusAr = 'تم استلام الجهاز';
        else if (data.status === 'working' || data.status === 'Working') statusAr = 'قيد الإصلاح والصيانة';
        else if (data.status === 'ready' || data.status === 'Ready' || data.status === 'completed') statusAr = 'جاهز للاستلام بالمحل';
        else if (data.status === 'delivered' || data.status === 'Delivered') statusAr = 'تم التسليم بنجاح';

        return {
          id: data.id,
          type: 'maintenance',
          title: `صيانة جهاز: ${data.deviceModel || data.deviceName || 'جوال'} #${data.id.slice(-6).toUpperCase()}`,
          deviceBrand: data.deviceBrand || '',
          issue: data.issue || data.problem || 'صيانة عامة',
          amount: totalCost,
          advancePayment: advance,
          remainingDebt: remaining,
          paymentMethod: advance > 0 ? (remaining === 0 ? 'fully_paid' : 'partially_paid') : 'unpaid',
          date: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date()),
          status: statusAr,
          isDebt: remaining > 0,
          ...data
        };
      });

      // Combine both and sort descending by date
      const combined = [...salesDocs, ...maintDocs].sort((a, b) => b.date.getTime() - a.date.getTime());
      setStatementInvoices(combined);

      // Verified exact net debt
      const activeNetDebt = customerProfile?.debt !== undefined ? Number(customerProfile.debt) : (totalSalesDebt + totalMaintenanceDebt + totalNetworkDebt);

      setStatementSummary({
        salesDebt: totalSalesDebt,
        maintenanceDebt: totalMaintenanceDebt,
        networkDebt: totalNetworkDebt,
        totalPaid: 0,
        netDebt: activeNetDebt,
        salesCount,
        maintenanceCount
      });
    } catch (e) {
      console.error("Error loading statement records:", e);
    } finally {
      setLoadingStatement(false);
    }
  };

  const submitAnswer = async (index: number) => {
    if (!currentLead || !activeQuiz) return;
    if (quizTimer === 0) {
      alert('انتهى الوقت! حاول مرة أخرى في المسابقات القادمة.');
      setActiveQuiz(null);
      return;
    }
    setQuizLoading(true);
    try {
      const res = await smartCommerceService.submitQuiz(currentLead.id, activeQuiz.id, index);
      setQuizResult(res);
      setAttemptedQuizIds(prev => [...prev, activeQuiz.id]);
      if (res.success) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#00E5FF', '#FFFFFF']
        });
        // Update points locally
        setCurrentLead(prev => prev ? { ...prev, points: prev.points + res.points } : null);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setQuizLoading(false);
    }
  };

  useEffect(() => {
    // Load search history from local storage
    const history = localStorage.getItem('jam_shop_search_history');
    if (history) setSearchHistory(JSON.parse(history));
  }, []);

  const handleShopSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (shopSearchQuery.trim().length < 3) return;
    
    setIsSearchingShop(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('shopName', '>=', shopSearchQuery.trim()),
        where('shopName', '<=', shopSearchQuery.trim() + '\uf8ff'),
        where('role', 'in', ['manager', 'wholesaler', 'superadmin', 'distributor', 'owner']),
        limit(5)
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      
      if (results.length > 0) {
        // Save to history
        const newHistory = [results[0], ...searchHistory.filter(h => h.id !== results[0].id)].slice(0, 5);
        setSearchHistory(newHistory);
        localStorage.setItem('jam_shop_search_history', JSON.stringify(newHistory));
        
        // Navigate to shop
        window.location.search = `?shop=${results[0].name}`;
      } else {
        alert('لم يتم العثور على متجر بهذا الاسم');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingShop(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 p-8 ${!showLegacyLoadingSpinners ? 'kill-global-spinners' : ''}`} style={{ background: 'linear-gradient(135deg, #0e1116 0%, #12161f 100%)' }}>
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-24 h-24 bg-[#171d26] rounded-[2.5rem] flex items-center justify-center shadow-[0_0_50px_rgba(212,175,55,0.15)] border border-[#d4af37]/30 relative group"
        >
           <div className="absolute inset-0 bg-[#d4af37]/5 blur-2xl opacity-10 group-hover:opacity-30 transition-opacity" />
           <img 
             src="/assets/icons/customer-vip-icon.png"
             onError={(e) => { e.currentTarget.src = "/assets/icons/customer-icon.svg" }}
             alt="Logo" 
             className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" 
             referrerPolicy="no-referrer"
           />
        </motion.div>
        <div className="text-center space-y-2">
          <p className="text-[#d4af37] font-black animate-pulse tracking-[0.3em] uppercase text-[10px]">Royal Secure Access</p>
          <div className="w-32 h-1 bg-white/5 rounded-full mx-auto overflow-hidden">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-full h-full bg-[#d4af37] shadow-[0_0_10px_#D4AF37]"
            />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 p-8 ${!showLegacyLoadingSpinners ? 'kill-global-spinners' : ''}`} style={{ background: 'linear-gradient(135deg, #0e1116 0%, #12161f 100%)' }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-sm bg-[#171d26] p-10 rounded-[3rem] border border-[#d4af37]/30 shadow-2xl backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border-2 border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <AlertTriangle size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white leading-tight font-cairo">عذراً، فشل التحميل</h2>
            <p className="text-red-550 font-bold text-sm leading-relaxed font-cairo">{error}</p>
            <div className="text-[10px] text-gray-500 mt-4 tabular-nums">
              ID: {authUser?.shopId || 'N/A'} | Role: {authUser?.role || 'Guest'}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-[#d4af37] text-[#0e1116] rounded-2xl font-black transition-all hover:brightness-110 active:scale-95 cursor-pointer"
            >
              محاولة أخرى
            </button>
            <button 
              type="button"
              onClick={performLogout}
              className="w-full py-3 text-gray-400 hover:text-white transition-colors font-bold text-sm cursor-pointer"
            >
              تسجيل الخروج والبدء من جديد
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!shopProfile) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-12 animate-in fade-in duration-300 ${!showLegacyLoadingSpinners ? 'kill-global-spinners' : ''}`} style={{ background: 'linear-gradient(135deg, #0e1116 0%, #12161f 100%)' }}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-4"
        >
          <div className="w-32 h-32 bg-[#171d26] rounded-[3rem] flex items-center justify-center text-[#d4af37] border border-[#d4af37]/35 shadow-[0_0_50px_rgba(212,175,55,0.15)] mx-auto">
            <ShoppingBasket size={64} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white leading-tight">بوابة الزبائن <span className="text-[#d4af37]">الذكية</span></h1>
            <p className="text-gray-450 font-bold max-w-sm mx-auto leading-relaxed">
              ابحث عن متجرك المفضل للوصول إلى العروض، نقاط الولاء، وتتبع الصيانة.
            </p>
          </div>
        </motion.div>
 
        <form onSubmit={handleShopSearch} className="w-full max-w-md space-y-4">
           <div className="relative group">
              <input 
                type="text"
                placeholder="اكتب اسم المتجر المعتمد أو رمز التعريف..."
                className="w-full bg-[#0d1013] border border-[#d4af37]/30 p-6 pr-14 rounded-[2rem] text-right font-black text-white focus:border-[#d4af37] transition-all outline-none placeholder-[#718096]"
                value={shopSearchQuery}
                onChange={e => setShopSearchQuery(e.target.value)}
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[#d4af37] group-focus-within:text-white">
                <ShoppingBasket size={24} />
              </div>
           </div>
           <button 
             type="submit"
             disabled={isSearchingShop}
             className="w-full py-5 bg-gradient-to-r from-[#d4af37] to-[#ffd700] text-[#0e1116] rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
           >
             {isSearchingShop ? <Loader2 className="animate-spin mx-auto" /> : 'استكشاف المتجر'}
           </button>
        </form>
 
        {searchHistory.length > 0 && (
          <div className="w-full max-w-md space-y-4 text-right">
            <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-widest px-4">آخر الزيارات</h4>
            <div className="grid gap-2">
              {searchHistory.map((shop, idx) => (
                <button 
                  key={`${shop.id}-${idx}`}
                  type="button"
                  onClick={() => window.location.search = `?shop=${shop.name}`}
                  className="flex items-center justify-between p-5 bg-[#171d26] rounded-3xl border border-[#d4af37]/30 hover:border-[#d4af37] transition-all text-right cursor-pointer"
                >
                  <ArrowRight size={16} className="text-[#d4af37]" />
                  <div className="flex flex-col">
                    <span className="text-white font-black text-sm">{shop.shopName}</span>
                    <span className="text-[9px] text-gray-500 font-bold">{shop.city || 'Yemen'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
 
        <div className="pt-8 border-t border-white/5 w-full max-w-sm">
           <p className="text-gray-600 text-xs font-bold leading-relaxed">
             هل أنت صاحب متجر؟ <br />
             <button type="button" onClick={() => window.location.hash = '#/'} className="text-[#d4af37] hover:underline cursor-pointer">سجل دخولك من هنا</button>
           </p>
        </div>
      </div>
    );
  }

  if (scannedInvoiceLoading) {
    return (
      <div className="min-h-screen bg-[#0e1116] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">جاري تحميل الفاتورة الرقمية المعتمدة...</p>
      </div>
    );
  }

  if (scannedInvoice) {
    const items = scannedInvoice.items || [];
    const invoiceDate = scannedInvoice.createdAt?.seconds 
      ? new Date(scannedInvoice.createdAt.seconds * 1000) 
      : (scannedInvoice.createdAt ? new Date(scannedInvoice.createdAt) : new Date());
    const totalBeforeDiscount = items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const finalTotal = scannedInvoice.total || 0;
    const discount = scannedInvoice.discount || 0;
    const isReturn = scannedInvoice.isReturn || scannedInvoice.type === 'return';
    const isHeld = scannedInvoice.isHeld || scannedInvoice.id?.startsWith('HOLD-');

    return (
      <div className="min-h-screen bg-[#0e1116] text-gray-100 font-sans p-4 md:p-8 flex flex-col items-center justify-start overflow-y-auto" dir="rtl">
        <div className="w-full max-w-lg bg-[#111622]/90 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden my-4">
          <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -z-10"></div>
          
          {/* Header */}
          <div className="text-center border-b border-white/5 pb-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500/20 to-yellow-400/20 text-amber-400 rounded-full mx-auto flex items-center justify-center mb-3 border border-amber-500/20">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <h1 className="text-lg font-black text-white">{shopProfile?.shopName || 'متجر JAM Pro'}</h1>
            <p className="text-xs text-slate-400 mt-1">{shopProfile?.shopAddress || 'صنعاء - اليمن'}</p>
            <p className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 py-1 px-3 rounded-full inline-block mt-2">
              ✓ فاتورة رقمية معتمدة ومتوافقة مع الهواتف الذكية
            </p>
          </div>

          {/* Invoice Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-black/40 p-4 rounded-2xl border border-white/5">
            <div>
              <span className="text-slate-400 block mb-1">رقم الفاتورة:</span>
              <span className="font-mono font-black text-amber-400">#{scannedInvoice.id.slice(-8).toUpperCase()}</span>
            </div>
            <div className="text-left">
              <span className="text-slate-400 block mb-1">تاريخ الإصدار:</span>
              <span className="font-mono text-white">{invoiceDate.toLocaleString('ar-YE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">نوع المعاملة:</span>
              <span className={`font-black ${isReturn ? 'text-rose-400' : isHeld ? 'text-amber-400' : 'text-emerald-400'}`}>
                {isReturn ? '↩️ مرتجع مبيعات' : isHeld ? '⏳ فاتورة معلقة بعربون' : '🛒 فاتورة مبيعات'}
              </span>
            </div>
            <div className="text-left">
              <span className="text-slate-400 block mb-1">طريقة الدفع:</span>
              <span className="font-bold text-white">
                {scannedInvoice.paymentMethod === 'cash' ? 'نقداً (كاش)' : scannedInvoice.paymentMethod === 'transfer' ? 'حوالة بنكية' : 'آجل'}
              </span>
            </div>
            {scannedInvoice.customerName && (
              <div className="col-span-2 border-t border-white/5 pt-2 mt-1">
                <span className="text-slate-400 block mb-1">العميل:</span>
                <span className="font-bold text-white text-sm">{scannedInvoice.customerName}</span>
              </div>
            )}
          </div>

          {/* Items List */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 px-1">تفاصيل المنتجات والأصناف:</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {items.map((item: any, idx: number) => {
                const qty = item.qty || item.quantity || 1;
                const price = item.price || 0;
                return (
                  <div key={idx} className="flex justify-between items-center bg-white/[0.02] hover:bg-white/[0.04] p-3 rounded-xl border border-white/5 transition-all">
                    <div className="text-right">
                      <span className="text-xs font-bold text-white block">{item.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {qty} {item.unit || 'حبة'} × {Number(price).toLocaleString()} ر.ي
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-black text-white font-mono">
                        {Number(price * qty).toLocaleString()} ر.ي
                      </span>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">لا توجد أصناف في هذه الفاتورة.</p>
              )}
            </div>
          </div>

          {/* Totals Box */}
          <div className="bg-gradient-to-br from-[#1c120c] to-[#121622] border border-amber-500/20 p-4 rounded-2xl space-y-2.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>الإجمالي قبل الخصم:</span>
              <span className="font-mono font-bold text-white">{totalBeforeDiscount.toLocaleString()} ر.ي</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs text-rose-400">
                <span>خصم إضافي:</span>
                <span className="font-mono font-bold">-{discount.toLocaleString()} ر.ي</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black border-t border-white/5 pt-2.5 text-white">
              <span>صافي الفاتورة الرقمية:</span>
              <span className="font-mono text-amber-400 text-base">{finalTotal.toLocaleString()} ر.ي</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => window.print()}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer border border-white/10"
            >
              <Printer className="w-4 h-4" />
              <span>حفظ كـ PDF أو طباعة ورقية</span>
            </button>
            <button
              onClick={() => {
                setScannedInvoice(null);
                setSearchParams({});
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer border-none"
            >
              <Store className="w-4 h-4" />
              <span>دخول بوابة الخدمات والعملاء 👑</span>
            </button>
          </div>

          {/* Copyright Footer */}
          <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-white/5">
            <p className="font-bold">نظام AL-THURAYA ERP / JAM SYSTEM PRO</p>
            <p className="mt-0.5">شكراً لتسوقكم معنا ومساهمتكم في تقليص استهلاك الورق 🌳</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen text-gray-100 font-sans rtl selection:bg-[#d4af37] selection:text-[#0e1116] pb-24 overflow-y-auto max-h-screen ${!showLegacyLoadingSpinners ? 'kill-global-spinners' : ''}`} style={{ background: 'linear-gradient(135deg, #0e1116 0%, #12161f 100%)' }}>
      
      {/* 📱 Android-style Sliding System Notification Panel */}
      <AnimatePresence>
        {activeSimulatedNotification && (
          <motion.div
            initial={{ opacity: 0, y: -100, scale: 0.95 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-0 left-4 right-4 md:left-auto md:right-4 md:w-[420px] z-[99999] pointer-events-auto"
          >
            <div 
              onClick={() => setActiveSimulatedNotification(null)}
              className="bg-[#171d26]/95 backdrop-blur-xl border-2 border-[#d4af37]/40 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer hover:bg-[#1c2430] active:scale-[0.98] transition-all relative overflow-hidden group select-none text-right"
              dir="rtl"
            >
              {/* Subtle top bezel line indicating APK style */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-royal-gold/50 via-[#ffd700] to-royal-gold/50" />
              
              <div className="flex gap-4">
                {/* Simulated App Icon */}
                <div className="w-12 h-12 bg-deep-navy border border-[#d4af37]/30 rounded-2xl flex items-center justify-center shrink-0 relative shadow-inner">
                  <img 
                    src="/assets/icons/customer-vip-icon.png" 
                    onError={(e) => { e.currentTarget.src = "/assets/icons/customer-icon.svg" }}
                    alt="Logo" 
                    className="w-8 h-8 object-contain" 
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-royal-gold rounded-full flex items-center justify-center text-[#0e1116] text-[8px] font-black border-2 border-[#171d26]">
                    Pro
                  </span>
                </div>
                
                {/* Content */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#d4af37] font-black text-xs tracking-wider">نظام جـام برو • إشعار فوري</span>
                    <span className="text-[10px] text-zinc-400">الآن</span>
                  </div>
                  <h5 className="font-black text-white text-sm leading-snug">{activeSimulatedNotification.title}</h5>
                  <p className="text-xs text-zinc-300 leading-relaxed">{activeSimulatedNotification.body}</p>
                </div>
              </div>
              
              {/* Swipe to dismiss prompt */}
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500">
                <span>اضغط لإخفاء الإشعار 👆</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  مؤمن بالكامل بالذكاء الاصطناعي
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⚙️ Android Overlay / Draw-Over-Apps Permission Setting Modal Mockup */}
      <AnimatePresence>
        {showAndroidOverlayModal && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="w-full max-w-md bg-[#13171e] border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-right relative"
              dir="rtl"
            >
              {/* Top Android Bezel Style */}
              <div className="bg-[#1c222d] px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-300 font-bold text-xs tracking-wide">إعدادات النظام (إذن صلاحية الظهور)</span>
                <button 
                  onClick={() => setShowAndroidOverlayModal(false)}
                  className="w-8 h-8 bg-black/25 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-[#d4af37]/10 border-2 border-[#d4af37]/30 rounded-3xl flex items-center justify-center mx-auto text-[#d4af37] shadow-lg">
                    <Smartphone size={40} className="animate-pulse" />
                  </div>
                  <h3 className="text-xl font-black text-white">الظهور فوق التطبيقات الأخرى</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed px-4">
                    يتطلب تطبيق جـام برو (APK) منح صلاحية "الظهور والعمل في الخلفية" لعرض تراكبات الصيانة والإشعارات الصوتية الفورية.
                  </p>
                </div>

                {/* Settings Block simulating Android OS menu */}
                <div className="bg-[#181f2a] rounded-2xl p-4 border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 font-bold text-[10px] tracking-wider uppercase">تراخيص النظام الفردية</span>
                    <span className="text-[10px] text-[#d4af37] font-bold">مطلوب للـ APK</span>
                  </div>

                  {/* App Row */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-deep-navy border border-[#d4af37]/20 rounded-xl flex items-center justify-center shrink-0">
                        <img 
                          src="/assets/icons/customer-vip-icon.png" 
                          onError={(e) => { e.currentTarget.src = "/assets/icons/customer-icon.svg" }}
                          alt="Logo" 
                          className="w-7 h-7 object-contain" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="text-right">
                        <h5 className="font-black text-white text-sm sm:text-base md:text-lg">JAM System Pro</h5>
                        <p className="text-[9px] text-zinc-500 mt-0.5">منصة الصيانة والدفع الذكي للزبائن</p>
                      </div>
                    </div>

                    {/* Styled Toggle Switch */}
                    <button
                      onClick={() => {
                        const nextState = !overlayPermissionGranted;
                        setOverlayPermissionGranted(nextState);
                        if (nextState) {
                          localStorage.setItem('jam_apk_overlay_permission', 'granted');
                          setTimeout(() => {
                            setShowAndroidOverlayModal(false);
                            triggerSimulatedNotification(
                              "تم منح الصلاحيات بالكامل 🎉",
                              "رائع! تطبيق الزبائن جاهز الآن لاستلام إشعارات الصيانة فوق التطبيقات الأخرى بنجاح."
                            );
                          }, 600);
                        } else {
                          localStorage.removeItem('jam_apk_overlay_permission');
                        }
                      }}
                      className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none cursor-pointer flex items-center ${overlayPermissionGranted ? 'bg-[#d4af37] justify-end' : 'bg-zinc-700 justify-start'}`}
                    >
                      <motion.div 
                        layout 
                        className="w-4 h-4 rounded-full bg-[#0e1116] shadow-md"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>

                  {/* Permissions Note */}
                  <div className="text-[10px] text-zinc-500 leading-relaxed pr-2 border-r-2 border-[#d4af37]/30">
                    * عند التفعيل، سيتم إرسال إشعار صوتي فوري وتحديث الشاشة فور تغيير حالة أي هاتف تحت الصيانة الخاصة بك.
                  </div>
                </div>

                <button
                  onClick={() => {
                    setOverlayPermissionGranted(true);
                    localStorage.setItem('jam_apk_overlay_permission', 'granted');
                    setShowAndroidOverlayModal(false);
                    triggerSimulatedNotification(
                      "تم تفعيل الإشعارات بنجاح! 🔔",
                      "منظومة إشعارات جـام برو العائمة قيد التشغيل والعمل الفوري الآن."
                    );
                  }}
                  className="w-full py-4 bg-royal-gold text-deep-navy rounded-2xl font-black text-sm hover:bg-gold-glow transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check size={16} />
                  <span>تأكيد الموافقة وتفعيل الصلاحيات</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* High-end gold/brushed-metal selection grid */}
      {showStoreSelector && (
        <div className="fixed inset-0 z-[250] bg-[#0e1116]/95 backdrop-blur-2xl flex items-center justify-center p-6" id="multi-store-selector-overlay">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md bg-[#171d26] border border-[#d4af37]/30 rounded-[2.5rem] p-8 shadow-[0_0_80px_rgba(212,175,55,0.15)] relative overflow-hidden text-right"
            dir="rtl"
          >
            {/* Brushed-metal ambient sheen */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/5 opacity-50 pointer-events-none" />
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#d4af37]/10 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="text-center space-y-3 mb-8 relative z-10">
              <div className="w-16 h-16 bg-[#171d26] rounded-2xl flex items-center justify-center mx-auto border border-[#d4af37]/30 shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                <Store className="text-[#d4af37]" size={32} />
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">اختيار الفرع / المتجر</h2>
              <p className="text-gray-400 font-bold text-xs leading-relaxed px-4">
                لقد وجدنا حسابك مسجلاً في أكثر من متجر فرعي شريك. يرجى اختيار جهة الخدمة لتحميل نقاطك وعروضك وصيانتك:
              </p>
            </div>

            {/* Grid Container */}
            <div className="grid gap-3 max-h-[350px] overflow-y-auto pr-1" id="store-selection-grid">
              {matchingStores.map((store, idx) => (
                <motion.button
                  key={`${store.id}-${idx}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => completeLoginForStore(
                    store.id, 
                    pendingLoginInfo!.phone, 
                    pendingLoginInfo!.leadName || '', 
                    pendingLoginInfo!.isVip, 
                    pendingLoginInfo!.vipData
                  )}
                  type="button"
                  className="w-full relative group p-5 bg-[#0d1013] border border-[#d4af37]/20 hover:border-[#d4af37] rounded-2xl text-right transition-all flex items-center justify-between overflow-hidden shadow-lg cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#d4af37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-royal-gold/10 text-royal-gold rounded-xl flex items-center justify-center border border-royal-gold/20 group-hover:bg-royal-gold group-hover:text-deep-navy transition-colors">
                      <Store size={22} />
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-white font-black text-sm group-hover:text-royal-gold transition-colors">{store.shopName || store.name}</span>
                      <span className="text-[10px] text-gray-400 font-bold mt-1">رمز الفرع: <span className="font-mono">{store.id.slice(-8).toUpperCase()}</span></span>
                    </div>
                  </div>
                  
                  <ArrowRight size={18} className="text-royal-gold transform rotate-180 group-hover:translate-x-1 duration-200" />
                </motion.button>
              ))}
            </div>

            <button 
              type="button"
              onClick={() => {
                setShowStoreSelector(false);
                setLoading(false);
              }}
              className="mt-6 w-full py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء الرجوع للخلف
            </button>
          </motion.div>
        </div>
      )}
      {/* Royal Header with Dual Dates & Live Clock */}
      {(!isRecognized || authStep !== 'login') && (
        <header className="fixed top-0 inset-x-0 z-[120] bg-[#001122]/95 backdrop-blur-3xl border-b border-royal-gold/30 shadow-[0_4px_30px_rgba(0,0,0,0.5)] pt-[env(safe-area-inset-top)] min-h-[4.5rem]">
          <div className={`max-w-7xl mx-auto h-full px-3 sm:px-6 py-2 flex flex-col md:flex-row items-center justify-between gap-2 transition-all duration-300 ${authStep === 'dashboard' ? 'pr-[calc(80px+env(safe-area-inset-right))] sm:pr-[calc(105px+env(safe-area-inset-right))] md:pr-[calc(128px+env(safe-area-inset-right))] pl-[calc(0.75rem+env(safe-area-inset-left))]' : ''}`}>
            
            {/* Right Brand Details */}
            <div className="flex items-center justify-between w-full md:w-auto gap-2.5">
              <div className="flex items-center gap-2.5 active:scale-95 transition-all cursor-pointer" onClick={() => setActiveTab('home')}>
                <div className="w-10 h-10 bg-gradient-to-br from-royal-gold via-gold-glow to-royal-gold rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.3)] border border-white/10 shrink-0">
                  <Crown size={20} className="text-[#001122]" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs md:text-sm font-black text-white leading-tight truncate max-w-[150px] sm:max-w-[220px]">
                    عملاء {shopProfile.shopName} 👑
                  </span>
                  <span className="text-[8px] font-black text-royal-gold/90 tracking-wider">ROYAL VIP CUSTOMER PORTAL</span>
                </div>
              </div>

              {/* Mobile Only Quick Actions */}
              <div className="flex md:hidden items-center gap-1.5">
                {currentLead && (
                  <button 
                    onClick={() => setActiveTab('rewards')}
                    className="flex items-center gap-1 bg-amber-500/10 border border-[#d4af37]/35 px-2 py-1 rounded-xl text-[10px] font-black text-royal-gold"
                  >
                    <Trophy size={11} className="text-royal-gold animate-bounce" />
                    <span>{currentLead.points}</span>
                  </button>
                )}
                {(authUser || currentLead || localStorage.getItem('customerPhone')) && (
                  <button 
                    onClick={performLogout}
                    className="p-1.5 bg-red-600/80 hover:bg-red-600 rounded-xl text-white text-[10px] font-black"
                    title="خروج"
                  >
                    <LogOut size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Center Live Real-time Clock & Dual Dates Bar */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 bg-white/[0.04] border border-white/10 px-3 sm:px-5 py-1.5 rounded-2xl shadow-inner text-center w-full md:w-auto" dir="rtl">
              {/* Dual Dates */}
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-gray-300">
                <span className="text-royal-gold">📅</span>
                <span className="font-black text-royal-gold/90">{hijriDateStr || 'التقويم الهجري'}</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-300">{gregDateStr || 'التقويم الميلادي'}</span>
              </div>

              {/* Live Real-time Clock */}
              <div className="flex items-center gap-1.5 bg-[#001122]/90 border border-royal-gold/30 px-2.5 py-0.5 rounded-xl shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[11px] sm:text-xs font-black text-royal-gold tabular-nums tracking-wider">{liveTime || '00:00:00'}</span>
              </div>
            </div>

            {/* Left Quick Actions / Stats (Desktop) */}
            <div className="hidden md:flex items-center gap-2 overflow-visible">
              {/* Compact Store Switcher trigger */}
              {myStoreOptions.length > 1 && (
                <button 
                  onClick={() => setShowLinkedStores(true)}
                  className="flex items-center gap-1.5 bg-royal-gold/10 hover:bg-royal-gold/20 px-3 py-1.5 rounded-xl border border-royal-gold/25 transition-all text-xs font-black text-royal-gold cursor-pointer"
                  title="تبديل المتجر أو الفرع"
                >
                  <Store size={14} />
                  <span>المحلات ({myStoreOptions.length})</span>
                </button>
              )}

              {/* Compact Points pill */}
              {currentLead && (
                <button 
                  onClick={() => setActiveTab('rewards')}
                  className="flex items-center gap-1.5 bg-amber-500/10 border border-[#d4af37]/35 px-3 py-1.5 rounded-xl hover:bg-amber-500/20 transition-all cursor-pointer"
                >
                  <Trophy size={13} className="text-royal-gold animate-bounce" />
                  <span className="text-xs font-black text-white">{currentLead.points}</span>
                  <span className="text-[9px] font-bold text-royal-gold uppercase tracking-widest">نقطة</span>
                </button>
              )}

              {/* Compact Logout Icon */}
              {(authUser || currentLead || localStorage.getItem('customerPhone')) && (
                <button 
                  onClick={async () => {
                     const logoutAd = ads.find(a => a.trigger === 'logout');
                     if (logoutAd) {
                        setActiveAds([logoutAd]);
                        setIsAdOpen(true);
                        setIsLoggingOut(true);
                        adService.trackView(logoutAd.id);
                        setTimeout(() => {
                          performLogout();
                        }, 4000);
                     } else {
                        performLogout();
                     }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white shadow-[0_4px_12px_rgba(239,68,68,0.25)] border border-red-500/30 transition-all font-black text-xs cursor-pointer"
                  title="تسجيل خروج"
                >
                  <LogOut size={13} />
                  <span>خروج</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      <main className={`pt-[calc(6.5rem+env(safe-area-inset-top))] px-[calc(1rem+env(safe-area-inset-left))] max-w-2xl mx-auto space-y-8 pb-32 relative z-10 transition-all duration-300 ${authStep === 'dashboard' ? 'pr-[calc(96px+env(safe-area-inset-right))] sm:pr-[calc(118px+env(safe-area-inset-right))] md:pr-[calc(138px+env(safe-area-inset-right))] pl-[calc(1rem+env(safe-area-inset-left))]' : ''}`}>
        {/* Phase 2 alerts inside main for perfect layout alignment */}
        {isOfflineMode && (
          <div className="bg-amber-600/10 border border-amber-500/20 text-amber-300/90 py-1 px-3 rounded-xl text-center text-[10px] font-bold flex items-center justify-center gap-1.5 relative z-10 w-fit mx-auto shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span>أوفلاين 📶 - المتبقي {offlineRemainingDays} يوم للتفقد.</span>
          </div>
        )}

        {subscriptionWarningMessage && (
          <div className="bg-orange-600/20 border border-orange-500/30 text-orange-200 py-4 px-6 rounded-2xl text-center text-xs font-black relative z-10 flex flex-col items-center justify-center gap-1 leading-relaxed">
            <p>{subscriptionWarningMessage}</p>
          </div>
        )}
        <AnimatePresence mode="wait">
          {authStep === 'login' ? (
            <motion.div 
              key="login"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-12 py-6"
            >
              <div className="text-center space-y-6 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-royal-gold/10 rounded-full blur-[100px]" />
                <div className="inline-block p-7 bg-gradient-to-br from-royal-gold/20 to-royal-gold/5 rounded-[4rem] text-royal-gold mb-2 shadow-[0_0_80px_rgba(212,175,55,0.15)] border border-royal-gold/30 relative z-10 ring-8 ring-[#001122] group">
                   <div className="absolute inset-0 bg-royal-gold blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
                   <img 
                     src="/assets/icons/customer-vip-icon.png" 
                     onError={(e) => { e.currentTarget.src = "/assets/icons/customer-icon.svg" }}
                     alt="Logo" 
                     className="w-24 h-24 object-contain relative z-10 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] animate-pulse" 
                     referrerPolicy="no-referrer"
                   />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-center mb-2 px-4 leading-tight relative z-10" id="login-welcome-title">
                  <span className="block text-white mb-2 text-xl md:text-2xl font-bold">بوابة خدمات وعملاء VIP</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-royal-gold via-gold-glow to-royal-gold font-black drop-shadow-[0_0_20px_rgba(212,175,55,0.5)] text-3xl md:text-5xl">
                    {shopProfile?.shopName || 'متجر JAM Pro'}
                  </span>
                </h1>
                <p className="text-gray-400 font-bold px-10 leading-relaxed text-sm md:text-lg opacity-80 decoration-royal-gold/30 underline-offset-8">
                  بوابتك الرقمية الحصرية للحصول على العروض والمكافآت وتتبع الصيانة
                </p>
                {shopProfile?.reservationNumbers && (
                  <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <span className="text-[10px] text-royal-gold font-black uppercase tracking-widest block mb-2 opacity-60">أرقام الحجز المباشر</span>
                    <div className="flex flex-wrap justify-center gap-3">
                      {shopProfile.reservationNumbers.split('|').map((num: string, idx: number) => (
                        <a 
                          key={idx}
                          href={`tel:${num.trim()}`}
                          className="px-4 py-1.5 bg-royal-gold/10 border border-royal-gold/30 rounded-full text-royal-gold font-black text-xs hover:bg-royal-gold/20 transition-all flex items-center gap-2"
                        >
                          <Phone size={12} />
                          {num.trim()}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {shopProfile && shopProfile.id !== 'demo_store' && shopProfile.isCustomerPortalActive !== true ? (
                <div className="bg-red-950/20 backdrop-blur-3xl p-10 rounded-[3rem] border-2 border-red-500/30 shadow-[0_50px_150px_rgba(0,0,0,0.7)] text-center space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />
                  <AlertCircle className="mx-auto text-red-500 animate-bounce" size={64} />
                  <h3 className="text-2xl font-black text-white">تنبيه حماية واشتراك</h3>
                  <p className="text-lg text-red-200 font-extrabold leading-relaxed px-4">
                    عذراً، خدمة تطبيق الزبائن غير مفعلة لهذا المتجر حالياً، يرجى مراجعة إدارة المحل.
                  </p>
                  <p className="text-sm text-gray-400 font-bold max-w-sm mx-auto">
                     يرجى من مالك المحل سداد رسوم الاشتراك السنوي أو تفعيل الخدمة من لوحة الإشراف المتكاملة JAM System Pro لفتح البوابة.
                  </p>
                  <div className="pt-6 border-t border-white/5 flex flex-col gap-3">
                    {shopProfile.phone && (
                      <a 
                        href={`https://wa.me/967${shopProfile.phone.replace(/[\s\-\(\)]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95"
                      >
                        💬 تواصل بواتساب المحل ({shopProfile.phone})
                      </a>
                    )}
                    <button 
                      onClick={() => { window.location.href = window.location.origin + window.location.pathname + '#/dashboard'; }}
                      className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      الذهاب للنظام الرئيسي
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`backdrop-blur-3xl space-y-8 relative group overflow-hidden ${showLegacyUIBorders ? 'bg-[#002244]/40 p-10 rounded-[3rem] border-2 border-royal-gold/30 shadow-[0_50px_150px_rgba(0,0,0,0.7)]' : 'bg-[#111622]/60 p-8 rounded-[2rem] border border-white/5'}`} id="royal-login-card">
                  {showLegacyUIBorders && <div className="absolute top-0 right-0 w-80 h-80 bg-royal-gold/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />}
                  
                  {vipError && (
                    <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-2xl text-red-200 text-xs font-bold text-center animate-shake relative z-10" id="login-error-msg">
                      ⚠️ {vipError}
                    </div>
                  )}

                  {authConnectionError && (
                    <div className="p-5 bg-amber-950/40 border-2 border-amber-500/30 rounded-2xl text-amber-200 text-xs font-black text-right relative z-10 leading-relaxed shadow-lg" id="login-conn-error-msg">
                      <div className="flex items-center gap-2 mb-1.5 text-royal-gold">
                        <AlertTriangle size={16} className="animate-pulse" />
                        <span>تنبيه حالة الاتصال السحابي</span>
                      </div>
                      {authConnectionError}
                    </div>
                  )}

                  {isRecognized ? (
                    <div className="space-y-10 relative z-10 text-center animate-in fade-in zoom-in duration-500" id="client-recognized-landing">
                      
                      {/* Metallic Gold Shield Section showcasing Store Name superimposed over the mockup asset */}
                      <div className="relative mx-auto w-64 h-64 flex items-center justify-center">
                        <img 
                          src={clientLoginMockup} 
                          alt="Elite Golden Web Shield" 
                          className="w-full h-full object-contain absolute inset-0 z-0 drop-shadow-[0_20px_50px_rgba(212,175,55,0.4)]" 
                        />
                        <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center max-w-[190px]">
                          <span className="text-royal-gold text-[9px] uppercase font-black tracking-widest block mb-1 opacity-90">اسم المحل</span>
                          <h2 className="text-base font-black text-white px-2 tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] leading-snug">
                            {shopProfile?.shopName || 'متجر JAM Pro'}
                          </h2>
                        </div>
                      </div>

                      {/* Dynamic Greeting */}
                      <div className="space-y-3 px-6">
                        <h3 className="text-3xl font-black text-white leading-snug">
                          مرحباً بك يا <span className="text-transparent bg-clip-text bg-gradient-to-r from-royal-gold via-[#ffe58f] to-royal-gold font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{rememberedName}</span>
                        </h3>
                        <p className="text-gray-400 font-bold text-xs tracking-wider">الرقم المعتمد بالمنصة: <span className="font-mono text-royal-gold">{rememberedPhone}</span></p>
                      </div>

                      {/* Luxury Gold [دخول] Button */}
                      <div className="pt-2 max-w-xs mx-auto px-4">
                        <button 
                          type="button"
                          onClick={handleQuickVipLogin}
                          disabled={loading}
                          className="w-full py-5 bg-gradient-to-r from-royal-gold via-gold-glow to-royal-gold text-deep-navy shadow-[0_20px_60px_rgba(212,175,55,0.35)] hover:brightness-110 active:scale-[0.97] transition-all rounded-[2.5rem] font-black text-2xl border-t-2 border-white/20 flex items-center justify-center gap-3 cursor-pointer"
                          id="customer-login-quick-btn"
                        >
                          {loading ? (
                            <Loader2 className="animate-spin" size={28} />
                          ) : (
                            <>
                              <span>دخول</span>
                              <Sparkles size={20} className="text-deep-navy animate-pulse" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Clean logout options */}
                      <div className="pt-2">
                        <button 
                          type="button"
                          onClick={handleFinalLogout}
                          disabled={loading}
                          className="text-xs text-red-450 font-black hover:text-red-400 hover:underline transition-all"
                          id="final-logout-btn"
                        >
                          تسجيل خروج من الجلسة الحالية 🚪
                        </button>
                      </div>

                    </div>
                  ) : (
                    <div className="space-y-6 relative z-10">
                      {/* Integrated High-Tech Illustration Banner (Smartphones, Headphones, Charger, Data Bars, Keyboard Keys, Jam system pro) */}
                      <LoginTechBackground compact={true} />

                      <form onSubmit={handleVipLogin} className="space-y-6 text-right" id="login-secure-form">
                      <div className="space-y-5">
                        {/* Phone Input with Premium Label */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-black uppercase tracking-wider text-royal-gold/80 px-4">رقم الهاتف السحابي المعتمد</label>
                          <div className="relative group">
                            {showLegacyUIBorders && <div className="absolute inset-0 bg-royal-gold/10 rounded-3xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-xl" />}
                            <input 
                              required
                              type="tel"
                              placeholder="أدخل رقم جوالك المسجل بالفرع (مثال: 777000000)"
                              className={`w-full bg-[#0d1013] text-center text-white outline-none tracking-normal shadow-inner placeholder:text-[#718096] placeholder:text-xs placeholder:font-bold ${showLegacyUIBorders ? 'border border-[#d4af37]/30 hover:border-[#d4af37] p-5 rounded-[2rem] text-2xl font-black focus:border-[#d4af37] focus:ring-4 focus:ring-[#d4af37]/15 transition-all' : 'border border-white/10 hover:border-white/25 p-4 rounded-xl text-lg focus:border-amber-500 transition-colors'}`}
                              value={phone}
                              onChange={e => setPhone(e.target.value)}
                              id="customer-login-phone"
                            />
                          </div>
                        </div>

                        {/* Password input for Customer login with Premium Label */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-black uppercase tracking-wider text-royal-gold/80 px-4">رمز التحقق الأمني المغلف</label>
                          <div className="relative group flex items-center">
                            {showLegacyUIBorders && <div className="absolute inset-0 bg-royal-gold/10 rounded-3xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-xl" />}
                            <input 
                              required
                              type={showPassword ? 'text' : 'password'}
                              placeholder="أدخل رمز المرور السري للدخول الفوري"
                              className={`w-full bg-[#0d1013] text-center text-white outline-none shadow-inner placeholder:text-[#718096] placeholder:text-xs placeholder:font-bold tracking-normal ${showLegacyUIBorders ? 'border border-[#d4af37]/30 hover:border-[#d4af37] p-5 pl-14 rounded-[2rem] text-xl font-bold focus:border-[#d4af37] focus:ring-4 focus:ring-[#d4af37]/15 transition-all' : 'border border-white/10 hover:border-white/25 p-4 pl-12 rounded-xl text-lg focus:border-amber-500 transition-colors'}`}
                              value={vipCode}
                              onChange={e => setVipCode(e.target.value)}
                              id="customer-login-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute left-4 text-gray-400 hover:text-royal-gold transition-colors p-1 rounded-lg focus:outline-none cursor-pointer z-10"
                              title={showPassword ? "إخفاء رمز المرور" : "إظهار رمز المرور"}
                            >
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={loading}
                        className="w-full py-6 bg-gradient-to-r from-royal-gold via-gold-glow to-royal-gold text-deep-navy rounded-[2rem] font-black text-xl shadow-[0_20px_60px_rgba(212,175,55,0.3)] flex items-center justify-center gap-4 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 border-t-2 border-white/20"
                        id="customer-login-btn"
                      >
                        {loading ? <Loader2 className="animate-spin" size={24} /> : (
                          <>
                            دخول البوابة السريعة <ArrowRight size={24} />
                          </>
                        )}
                      </button>
                      </form>
                    </div>
                  )}

                  <p className="text-[9px] text-gray-500 text-center px-10 leading-relaxed font-black uppercase tracking-[0.1em] opacity-60" id="login-security-label">
                    Your privacy is protected by JAM Enterprise Security & Royal Guard Protocols
                  </p>
                </div>
              )}
            </motion.div>
          ) : authStep === 'verify' ? (
            <motion.div 
              key="verify"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-10 py-12"
            >
              <div className="text-center space-y-4">
                <div className="inline-block p-5 bg-royal-gold/10 rounded-[3rem] text-royal-gold mb-4 border border-royal-gold/20">
                   <Clock size={64} className="animate-spin-slow" />
                </div>
                <h2 className="text-3xl font-black text-white px-4 text-center">أدخل رمز التحقق</h2>
                <p className="text-gray-400 font-bold px-12 leading-relaxed">
                  لقد أرسلنا رمزاً لهاتفك لضمان خصوصيتك وأمان بياناتك
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-6">
                <input 
                  required
                  type="text"
                  maxLength={6}
                  placeholder="------"
                  className="w-full bg-[#0d1013] border border-[#d4af37]/35 p-8 rounded-3xl text-center text-5xl font-black text-[#d4af37] focus:border-[#d4af37] transition-all outline-none tracking-[0.5em] placeholder-[#718096]"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value)}
                />
                <button 
                  type="submit"
                  className="w-full py-6 bg-royal-gold text-deep-navy rounded-3xl font-black text-xl shadow-lg hover:bg-gold-glow transition-all"
                >
                  تأكيد الدخول
                </button>
                <button 
                  type="button"
                  onClick={() => setAuthStep('login')}
                  className="w-full text-gray-500 font-bold text-sm hover:text-white transition-colors"
                >
                  تغيير رقم الهاتف
                </button>
              </form>
            </motion.div>
          ) : authStep === 'welcome' ? (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="backdrop-blur-3xl p-6 sm:p-10 rounded-[3rem] border border-royal-gold/35 bg-[#001122]/90 shadow-[0_50px_150px_rgba(0,0,0,0.85)] text-center space-y-8 relative overflow-hidden max-w-2xl mx-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-royal-gold/15 via-transparent to-transparent opacity-60 pointer-events-none" />
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-royal-gold/20 rounded-full blur-[80px]" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-royal-gold/20 rounded-full blur-[80px]" />

              <div className="relative z-10 space-y-6 text-right" dir="rtl">
                {/* Royal App Icon & Greeting */}
                <div className="text-center space-y-3">
                  <div className="inline-block p-6 bg-gradient-to-br from-royal-gold/25 via-royal-gold/10 to-transparent rounded-[3rem] text-royal-gold shadow-[0_0_50px_rgba(212,175,55,0.25)] border-2 border-royal-gold/40">
                    <Crown size={64} className="animate-pulse mx-auto text-royal-gold drop-shadow-[0_0_20px_rgba(212,175,55,0.6)]" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black text-royal-gold uppercase tracking-widest block">تطبيق المتجر الملكي للزبائن VIP 👑</span>
                    <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                      بوابة عملاء {shopProfile?.shopName || 'المتجر'}
                    </h2>
                  </div>
                </div>

                <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-1 text-center">
                  <span className="text-xs text-gray-400 block font-bold">مرحباً بك يا</span>
                  <span className="text-xl md:text-2xl font-black text-royal-gold block drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                    {currentLead?.leadName || currentLead?.name || localStorage.getItem('customerName') || 'زبون VIP معتمد'}
                  </span>
                </div>

                {/* Primary Enter Action */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem('jam_portal_entered_dashboard', 'true');
                      setAuthStep('dashboard');
                    }}
                    className="w-full py-5 bg-gradient-to-r from-royal-gold via-gold-glow to-royal-gold text-deep-navy font-black text-lg rounded-2xl shadow-xl hover:shadow-[0_0_35px_rgba(212,175,55,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer border border-white/20"
                  >
                    <span>دخول إلى المتجر الملكي</span>
                    <Send size={20} className="rotate-180 text-deep-navy" />
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowLinkedStores(!showLinkedStores)}
                      className="py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                    >
                      <span>المحلات المسجلة ({myStoreOptions.length})</span>
                      <Store size={15} className="text-royal-gold" />
                    </button>

                    <button
                      type="button"
                      onClick={performLogout}
                      className="py-3.5 bg-red-950/20 hover:bg-red-900/30 border border-red-500/20 text-red-200 font-black text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                    >
                      <span>تسجيل خروج</span>
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* 9 Service Quick Tiles Directly on Welcome Screen */}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <span className="text-xs font-black text-royal-gold/90 block text-right">
                    الخدمات والأقسام المتاحة للزبون:
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: 'store', label: 'المتجر الملكي', icon: ShoppingBasket, color: 'from-amber-500/20 to-amber-500/5' },
                      { id: 'doctor', label: 'طبيب الهاتف', icon: Stethoscope, color: 'from-emerald-500/20 to-emerald-500/5' },
                      { id: 'local_player', label: 'مشغل الصوت', icon: Music, color: 'from-cyan-500/20 to-cyan-500/5' },
                      { id: 'maintenance', label: 'تتبع الصيانة', icon: Wrench, color: 'from-blue-500/20 to-blue-500/5' },
                      { id: 'rewards', label: 'نقاط الولاء', icon: Trophy, color: 'from-yellow-500/20 to-yellow-500/5' },
                      { id: 'quiz', label: 'المسابقات', icon: Gamepad2, color: 'from-purple-500/20 to-purple-500/5' },
                      { id: 'reels', label: 'فيديوهات التاجر', icon: Video, color: 'from-rose-500/20 to-rose-500/5' },
                      { id: 'invite', label: 'دعوة الأصدقاء', icon: Share2, color: 'from-teal-500/20 to-teal-500/5' },
                      { id: 'auction', label: 'الحراج العام', icon: Gavel, color: 'from-indigo-500/20 to-indigo-500/5' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          sessionStorage.setItem('jam_portal_entered_dashboard', 'true');
                          setAuthStep('dashboard');
                          setActiveTab(item.id as any);
                          if (item.id === 'local_player') {
                            window.dispatchEvent(new CustomEvent('toggle-jam-media-player', { detail: { open: true } }));
                          }
                        }}
                        className={`p-3 rounded-2xl bg-gradient-to-b ${item.color} border border-white/10 hover:border-royal-gold/40 flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer`}
                      >
                        <item.icon size={20} className="text-royal-gold" />
                        <span className="text-[11px] font-black text-white">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Display linked stores list directly for elegance */}
                <div className="pt-4 border-t border-white/10 text-right space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-royal-gold/90 flex items-center gap-1.5">
                      <Store size={15} className="text-royal-gold" />
                      المحلات المسجل لديها حسابك ({myStoreOptions.length}):
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold">اضغط لاختيار وتفعيل المتجر</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {myStoreOptions.length === 0 ? (
                      <div className="p-3.5 text-center text-xs text-gray-400 font-bold bg-white/5 rounded-2xl border border-white/5">
                        المتجر النشط: {shopProfile?.shopName || 'المتجر الحالي'}
                      </div>
                    ) : (
                      myStoreOptions.map((opt) => {
                        const isCurrent = opt.id === shopProfile?.id;
                        return (
                          <div 
                            key={opt.id}
                            onClick={() => {
                              if (!isCurrent) {
                                handleSwitchStore(opt.id);
                              }
                            }}
                            className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                              isCurrent 
                                ? 'bg-gradient-to-r from-royal-gold/20 via-royal-gold/10 to-transparent border-royal-gold/60 text-royal-gold shadow-[0_0_20px_rgba(212,175,55,0.15)] ring-1 ring-royal-gold/40' 
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-royal-gold/30 text-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${isCurrent ? 'bg-royal-gold/20 text-royal-gold' : 'bg-white/5 text-gray-400'}`}>
                                <Store size={18} />
                              </div>
                              <div className="text-right">
                                <span className="font-black text-sm block text-white">{opt.shopName || opt.name || 'متجر معتمد'}</span>
                                {opt.address && <span className="text-[10px] text-gray-400 block">{opt.address}</span>}
                              </div>
                            </div>
                            {isCurrent ? (
                              <span className="bg-royal-gold text-deep-navy text-[10px] font-black px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                                ✓ المتجر النشط
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400 hover:text-royal-gold font-bold px-2 py-1 rounded-lg border border-white/10 bg-white/5">
                                اختيار وتفعيل ←
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            localStorage.getItem('isVipLogged') === 'true' && (
              shopProfile && (
                shopProfile.status === 'suspended' || 
                shopProfile.status === 'blocked' || 
                shopProfile.status === 'disabled' || 
                shopProfile.isExpired === true || 
                shopProfile.customer_app_license === 'expired' || 
                (shopProfile.customer_app_license !== 'active' && shopProfile.isCustomerPortalActive !== true)
              )
            ) ? (
              <motion.div 
                key="suspended"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#171d26] border border-[#d4af37]/30 p-8 sm:p-10 rounded-[2.5rem] text-center space-y-6 shadow-2xl relative overflow-hidden z-10"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-[50px] pointer-events-none" />
                <div className="inline-block p-5 bg-orange-500/10 rounded-full text-orange-500 mb-2">
                  <AlertTriangle size={48} className="animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-white">اشتراك المحل موقوف أو منتهي</h3>
                <p className="text-gray-400 font-bold leading-relaxed text-sm">
                  عذراً، جرى إيقاف صلاحية الدخول لمتجر <strong>({shopProfile?.shopName || 'المحل التجاري'})</strong> لعدم تجديد الاشتراك أو رخصة تطبيق الزبائن VIP الخاصة بهم.<br/>
                  الرجاء مراجعة إدارة المحل لتجديد الاشتراك.
                </p>

                {/* المحلات المرتبطة بحسابك */}
                {myStoreOptions.length > 0 && (
                  <div className="pt-4 border-t border-white/10 text-right space-y-3">
                    <h4 className="text-sm font-bold text-gray-300">المحلات الأخرى المرتبطة بحسابك:</h4>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                      {myStoreOptions.map((opt) => {
                        const isOptExpired = opt.status === 'suspended' || opt.status === 'blocked' || opt.status === 'disabled' || opt.isExpired === true || opt.customer_app_license === 'expired';
                        return (
                          <div 
                            key={opt.id}
                            onClick={() => {
                              if (!isOptExpired) {
                                handleSwitchStore(opt.id);
                              } else {
                                alert(`عذراً، اشتراك متجر (${opt.shopName || opt.name || 'المحل'}) منتهي الصلاحية أيضاً.`);
                              }
                            }}
                            className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isOptExpired 
                                ? 'bg-red-500/10 border-red-500/20 text-gray-400' 
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 shadow-md shadow-emerald-950/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Store size={16} className={isOptExpired ? 'text-red-400' : 'text-emerald-400'} />
                              <span className="font-bold text-xs">{opt.shopName || opt.name || 'متجر غير معروف'}</span>
                            </div>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                              isOptExpired ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {isOptExpired ? 'منتهي الصلاحية' : 'نشط - اضغط للدخول 🔑'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={performLogout}
                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-black text-xs transition-colors border border-white/10"
                  >
                    تسجيل الخروج والرجوع للموقع الموحد
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-12"
              >
              {/* Home Dashboard View */}
              {activeTab === 'home' && (
                <div className="space-y-10">
                    {/* Dynamic Greeting on Customer Dashboard Header */}
                    <div className={`p-6 flex flex-col gap-1.5 text-right relative overflow-hidden ${showLegacyUIBorders ? 'bg-[#001122]/40 backdrop-blur-3xl rounded-[2.5rem] border border-royal-gold/20 shadow-lg shadow-black/10' : 'bg-[#111622]/50 rounded-2xl border border-white/5'}`}>
                      {showLegacyUIBorders && <div className="absolute top-1/2 left-0 -translate-y-1/2 w-48 h-48 bg-royal-gold/5 rounded-full blur-[60px] pointer-events-none" />}
                      <span className="text-[9px] font-black text-royal-gold/60 uppercase tracking-widest leading-none">لوحة التحكم للشركاء VIP</span>
                      <h2 className="text-2xl md:text-3xl font-black text-white leading-tight drop-shadow-[0_0_15px_rgba(212,175,55,0.25)]">
                        أهلاً بك، {(() => {
                          const fullName = currentLead?.name || customerProfile?.name || authUser?.name || 'الزبون المتميز';
                          return fullName.trim().split(/\s+/)[0];
                        })()}
                      </h2>
                      <p className="text-[11px] text-gray-400 font-bold leading-relaxed">
                        بوابتك الرقمية الحصرية لمتابعة صيانة أجهزتك، تجميع النقاط، واستكشاف العروض الفورية.
                      </p>
                    </div>

                    {/* Glowing Live Active repairs / bookings Alert Banner */}
                    {activeRepairs.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-5 flex items-center justify-between flex-wrap gap-4 text-right relative overflow-hidden ${showLegacyUIBorders ? 'bg-gradient-to-r from-amber-500/10 via-orange-500/15 to-amber-500/10 border-2 border-amber-500/30 rounded-[2.5rem] shadow-[0_0_30px_rgba(245,158,11,0.15)]' : 'bg-[#1e1510] border border-amber-500/20 rounded-2xl shadow-none'}`}
                      >
                        {showLegacyUIBorders && <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-[40px] pointer-events-none animate-pulse" />}
                        
                        <div className="flex items-center gap-3 flex-row-reverse z-10">
                          <div className={`w-10 h-10 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center ${showLegacyLoadingSpinners ? 'animate-bounce' : ''}`}>
                            <Wrench size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white flex items-center gap-2 justify-end">
                              تحديث مباشر: جهازك قيد المعالجة بالصيانة ⚙️
                              {showLegacyLoadingSpinners && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />}
                            </h4>
                            <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">
                              يوجد عدد ({activeRepairs.length}) أجهزة تحت الصيانة الفنية الفورية لدى المهندس. اضغط على التبويب لمتابعة الفحص.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setActiveTab('maintenance')}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-2xl shadow-md transition-all z-10 cursor-pointer"
                        >
                          أجهزتي في الصيانة 🛠️
                        </button>
                      </motion.div>
                    )}

                    {/* Central Ad Banner */}
                    {ads.length > 0 && (
                      <div className={`relative overflow-hidden h-48 group ${showLegacyUIBorders ? 'rounded-[2.5rem] border-2 border-royal-gold/30 shadow-2xl' : 'rounded-2xl border border-white/5 shadow-none'}`}>
                         <div className="absolute inset-0 bg-navy-950/40 z-10" />
                         <motion.div 
                           animate={{ x: `-${currentAdIndex * 100}%` }}
                           transition={{ duration: 0.8, ease: "easeInOut" }}
                           className="flex w-full h-full"
                         >
                            {ads.map(ad => (
                              <div key={ad.id} className="min-w-full h-full relative">
                                {ad.imageUrl && <img src={ad.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-20 space-y-2">
                                  <h3 className="text-xl font-black text-white drop-shadow-lg">{ad.title}</h3>
                                  <p className="text-xs font-bold text-royal-gold drop-shadow-md">{ad.content}</p>
                                  {ad.link && (
                                    <a 
                                      href={ad.link} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      onClick={() => adService.trackClick(ad.id)}
                                      className="px-4 py-1.5 bg-royal-gold text-deep-navy rounded-full text-[10px] font-black uppercase tracking-widest mt-2"
                                    >التفاصيل</a>
                                  )}
                                </div>
                              </div>
                            ))}
                         </motion.div>
                      </div>
                    )}

                    {shopProfile?.reservationNumbers && (
                      <div className={`p-6 flex items-center justify-between group overflow-hidden relative ${showLegacyUIBorders ? 'bg-gradient-to-r from-royal-gold/20 to-transparent rounded-[2.5rem] border border-royal-gold/30' : 'bg-[#111622]/50 rounded-2xl border border-white/5'}`}>
                        {showLegacyUIBorders && <div className="absolute top-0 right-0 w-20 h-20 bg-royal-gold/10 rounded-bl-[3rem] blur-xl group-hover:scale-150 transition-transform" />}
                        <div className="relative z-10 flex flex-col">
                          <span className="text-[10px] font-black text-royal-gold uppercase tracking-widest mb-1">أرقام حجوزات المركز</span>
                          <div className="flex flex-wrap gap-3">
                            {shopProfile.reservationNumbers.split('|').map((num: string, idx: number) => (
                              <a 
                                key={idx} 
                                href={`tel:${num.trim()}`}
                                className="text-lg font-black text-white hover:text-royal-gold transition-colors tabular-nums"
                              >
                                {num.trim()}
                              </a>
                            ))}
                          </div>
                        </div>
                        <div className="w-14 h-14 bg-royal-gold text-deep-navy rounded-2xl flex items-center justify-center shadow-lg relative z-10">
                          <PhoneCall size={28} className={showLegacyLoadingSpinners ? 'animate-pulse' : ''} />
                        </div>
                      </div>
                    )}

                    {/* Dynamic Debt Statement Card */}
                    <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-4 p-6 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
                      <div className="flex flex-col gap-1 min-w-[150px] flex-1 text-right">
                        <h3 className="text-sm font-black text-white">إجمالي حساب الديون المستقرة</h3>
                        <p className="text-3xl font-black text-rose-400 font-sans tracking-tight my-1">
                          {Number(customerProfile?.debt || 0).toLocaleString()} <span className="text-xs font-black text-gray-400">ر.ي</span>
                        </p>
                        <p className="text-[11px] text-gray-400 leading-relaxed font-bold">تتم المزامنة تلقائياً مع الفايربيس السحابي</p>
                      </div>
                      <button 
                        onClick={handleOpenStatement}
                        className="flex-none px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:brightness-110 text-white rounded-xl text-xs font-black active:scale-95 transition-all shadow-lg"
                      >
                        كشف تفصيلي
                      </button>
                    </div>



                   {/* Quick Repair Track */}
                   <div className={`p-4 space-y-3 ${showLegacyUIBorders ? 'bg-[#171d26] border border-[#d4af37]/30 rounded-3xl shadow-lg' : 'bg-[#111622]/60 border border-white/5 rounded-2xl'}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <Wrench size={14} className={showLegacyUIBorders ? 'text-royal-gold' : 'text-amber-400'} />
                        <span className="text-xs font-black text-white">تتبع كود صيانة جهازك فورا</span>
                      </div>
                      <form onSubmit={handleTrackRepair} className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="أدخل رقم الفاتورة أو رمز الـ IMEI للصيانة..."
                          className={`flex-1 bg-[#0d1013] px-3 py-2 text-xs font-bold text-white outline-none text-right placeholder-[#718096] ${showLegacyUIBorders ? 'border border-[#d4af37]/35 rounded-xl focus:border-[#d4af37] transition-all' : 'border border-white/10 focus:border-amber-500 rounded-xl'}`}
                          value={searchRepairId}
                          onChange={(e) => setSearchRepairId(e.target.value)}
                        />
                        <button 
                          type="submit"
                          disabled={isSearchingRepair}
                          className="bg-royal-gold text-deep-navy px-4 py-2 rounded-xl font-black text-xs active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Search size={14} />
                          <span>{isSearchingRepair ? 'جاري التتبع...' : 'تتبع'}</span>
                        </button>
                      </form>
                   </div>

                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                      {[
                        { id: 'local_player', label: 'مشغل الميديا الشامل', icon: Music, color: 'text-amber-400', desc: 'صوتيات وفيديو وإشعارات الستارة' },
                        { id: 'doctor', label: 'طبيب الهاتف', icon: Stethoscope, color: 'text-cyan-400', desc: 'فحص فوري للجهاز' },
                        { id: 'maintenance', label: 'أجهزتي في الصيانة', icon: Wrench, color: 'text-amber-400', desc: 'تتبع حالة أجهزتك بالصيانة' },
                        { id: 'store', label: 'المتجر الذكي', icon: ShoppingBasket, color: 'text-royal-gold', desc: 'عروض حصرية' },
                        { id: 'auction', label: 'المزادات الحية', icon: Gavel, color: 'text-amber-500', desc: 'زايد واربح' },
                        { id: 'rewards', label: 'بنك النقاط', icon: Gift, color: 'text-emerald-400', desc: 'حول نقاطك لهدايا' },
                        { id: 'vault', label: 'الخزنة الذهبية', icon: Lock, color: 'text-royal-gold', desc: 'تحدي الأكواد والجوائز الكبرى' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            if (item.id === 'local_player') {
                              window.dispatchEvent(new CustomEvent('toggle-jam-media-player', { detail: { open: true } }));
                            }
                          }}
                          className={`flex items-center gap-3 p-3.5 rounded-2xl text-right cursor-pointer transition-all group active:scale-95 relative overflow-hidden ${showLegacyUIBorders ? 'bg-[#001122]/90 border border-royal-gold/10 hover:border-royal-gold/30 hover:shadow-lg' : 'bg-[#111622]/45 border border-white/5'}`}
                        >
                          <div className="hidden" />
                          <div className={`p-2 rounded-xl group-hover:scale-105 transition-transform ${item.color} ${showLegacyUIBorders ? 'bg-royal-gold/5 border border-royal-gold/10 shadow-md' : 'bg-white/5 border border-white/10 shadow-none'}`}>
                            <item.icon size={20} />
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-white font-black text-xs leading-none mb-1">{item.label}</span>
                            <span className="text-[8px] text-gray-500 font-bold leading-none">{item.desc}</span>
                          </div>
                        </button>
                      ))}
                   </div>

                   {/* Integrated Universal Local Media Player (B2B Phase 3 Patch) */}
                   <LocalMediaPlayer />


                </div>
              )}

              {/* Tab Navigation (Floating at bottom would be nice, but keeping integrated for now) */}
              <div className="hidden">
                {[
                  { id: 'home', label: 'الرئيسية', icon: Zap },
                  { id: 'chat', label: 'المحادثة', icon: MessageSquare },
                  { id: 'rewards', label: 'المكافآت', icon: Gift },
                  { id: 'store', label: 'المتجر', icon: ShoppingBasket },
                  { id: 'maintenance', label: 'أجهزتي في الصيانة', icon: Wrench },
                  { id: 'doctor', label: 'طبيب الهاتف', icon: Stethoscope },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] transition-all whitespace-nowrap border-2 ${activeTab === tab.id ? 'bg-royal-gold text-deep-navy border-royal-gold shadow-[0_10px_20px_rgba(212,175,55,0.2)]' : 'bg-white/5 text-gray-400 border-transparent hover:border-white/10'}`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'store' && (
                <div className="space-y-12">
                  {/* Simple Clean Product Search */}
                  <div className={`p-4 space-y-3 ${gBgCard} border ${gBorderColor30} ${gRoundedHuge}`}>
                    <div className="relative">
                      <input 
                        type="text"
                        value={storeSearchQuery}
                        onChange={(e) => setStoreSearchQuery(e.target.value)}
                        placeholder="البحث السريع عن المعروضات الحصرية، قطع الغيار المضمونة والخدمات..."
                        className={`w-full bg-[#0d1013] text-xs text-white placeholder-[#718096] p-3.5 pr-11 text-right outline-none ${showLegacyUIBorders ? 'border border-[#d4af37]/35 rounded-2xl focus:border-[#d4af37] transition-all' : 'border border-white/10 focus:border-amber-500 rounded-xl'}`}
                      />
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Search size={16} className={gTextColorRoyalGold} />
                      </div>
                      {storeSearchQuery && (
                        <button 
                          onClick={() => setStoreSearchQuery('')}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-lg px-2.5 py-1 text-[9px] font-bold"
                        >
                          تصفية
                        </button>
                      )}
                    </div>

                    {storeSearchQuery && (
                      <p className="text-[10px] text-gray-400">
                        عرض نتائج البحث لـ: <strong className="text-royal-gold font-mono">{storeSearchQuery}</strong>
                      </p>
                    )}
                  </div>

                  {/* Filter and render items */}
                  {(() => {
                    const queryClean = storeSearchQuery.toLowerCase().trim();
                    const filteredItems = inventory.filter(i => 
                      i.stock > 0 && (
                        !queryClean ||
                        (i.name || '').toLowerCase().includes(queryClean) ||
                        (i.category || '').toLowerCase().includes(queryClean) ||
                        (i.compatibilityList && i.compatibilityList.some(comp => comp.toLowerCase().includes(queryClean)))
                      )
                    );

                    return (
                      <>
                        {/* Global Inventory / Latest Products Section */}
                        <section className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-white flex items-center gap-3">
                              <div className="p-2 bg-royal-gold/10 rounded-xl text-royal-gold"><Package size={20} /></div>
                              أحدث المنتجات المتوفرة
                            </h3>
                          </div>
                          
                          <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar">
                            {filteredItems.slice(0, 10).map((item, idx) => (
                              <div 
                                key={`${item.id}-latest-${idx}`}
                                className="min-w-[170px] max-w-[170px] bg-[#171d26] rounded-2xl border border-[#d4af37]/25 p-3 flex flex-col justify-between max-h-[340px] overflow-hidden shadow-md"
                              >
                                <div>
                                  <div className="w-full h-24 bg-deep-navy rounded-lg overflow-hidden border border-white/10 flex items-center justify-center mb-1">
                                    {item.photo ? (
                                      <JamFastProductImage imageUrl={item.photo} altName={item.name} className="max-h-full max-w-full object-contain" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-700">
                                        <ShoppingBasket size={18} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-0.5 mt-1 text-right">
                                    <p className="text-[8px] font-bold text-royal-gold truncate">{item.category}</p>
                                    <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                                    <p className="text-xs font-bold text-white">{(item.price || 0).toLocaleString()} <small className="text-[8px]">ر.ي</small></p>
                                  </div>
                                </div>

                                <button 
                                  onClick={() => {
                                    const mockOffer: PromoOffer = {
                                      id: 'item_' + item.id,
                                      ownerId: shopProfile.id,
                                      itemId: item.id,
                                      itemName: item.name,
                                      originalPrice: item.price,
                                      promoPrice: item.price,
                                      description: item.name + ' - منتج متوفر حالياً',
                                      occasion: 'متوفر حديثاً',
                                      status: 'active',
                                      createdAt: Timestamp.now(),
                                      startTime: Timestamp.now(),
                                      endTime: Timestamp.now()
                                    };
                                    setBookingItem(mockOffer);
                                    setIsBookingModalOpen(true);
                                    setBookingStep('info');
                                  }}
                                  className="w-full mt-2 py-1.5 bg-white/5 hover:bg-royal-gold hover:text-deep-navy rounded-lg text-[9px] font-bold transition-all border border-white/10 text-center"
                                >
                                  احجز الآن
                                </button>
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* Promoted and Published Products (Always Visible) */}
                        {inventory && inventory.some(i => i.status === 'published_in_market' || i.isPromoted || i.isPublished) && (
                          <section className="space-y-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xl font-black text-[#d4af37] flex items-center gap-3">
                                <div className="p-2 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><Sparkles size={20} /></div>
                                المنتجات المروجة والمنشورة لكم 📣
                              </h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2">
                              {inventory.filter(i => i.status === 'published_in_market' || i.isPromoted || i.isPublished).map((item, idx) => (
                                <div key={`${item.id}-promoted-${idx}`} className={`p-3 rounded-2xl flex flex-col justify-between max-h-[460px] overflow-hidden ${showLegacyUIBorders ? 'bg-[#171d26] border border-[#d4af37]/45 shadow-md shadow-[#d4af37]/5' : 'bg-[#111622]/80 border border-white/5 shadow-none'}`}>
                                  <div>
                                    <div className="w-full h-28 md:h-36 bg-slate-950/40 rounded-lg p-1.5 overflow-hidden border border-white/5 flex items-center justify-center mb-1">
                                      {item.photo ? (
                                        <JamFastProductImage imageUrl={item.photo} altName={item.name} className="max-h-full max-w-full object-contain" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-750">
                                          <ShoppingBasket size={18} />
                                        </div>
                                      )}
                                    </div>
                                    <span className="inline-block px-2 py-0.5 rounded bg-[#d4af37]/10 text-[#d4af37] text-[8px] font-black font-sans mb-1">منشور ومروج 📢</span>
                                    <h4 className="text-sm font-bold text-white mt-1 truncate">{item.name}</h4>
                                  </div>

                                  <div className="flex items-center justify-between mt-2 pt-1">
                                    <span className="text-xs md:text-sm font-bold text-royal-gold">{(item.price || 0).toLocaleString()} YER</span>
                                    <button 
                                      onClick={() => {
                                        const mockOffer: PromoOffer = {
                                          id: 'item_' + item.id,
                                          ownerId: shopProfile.id,
                                          itemId: item.id,
                                          itemName: item.name,
                                          originalPrice: item.price,
                                          promoPrice: item.price,
                                          description: item.name,
                                          occasion: 'منتج مروج ومنشور',
                                          status: 'active',
                                          createdAt: Timestamp.now(),
                                          startTime: Timestamp.now(),
                                          endTime: Timestamp.now()
                                        };
                                        setBookingItem(mockOffer);
                                        setIsBookingModalOpen(true);
                                        setBookingStep('info');
                                      }}
                                      className="p-1.5 bg-royal-gold/10 text-royal-gold rounded-lg hover:bg-royal-gold hover:text-deep-navy transition-all"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}

                        {/* General Inventory logic if autoExposeInventory is true */}
                        {shopProfile.autoExposeInventory && (
                          <section className="space-y-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xl font-black text-white flex items-center gap-3">
                                <div className="p-2 bg-royal-gold/10 rounded-xl text-royal-gold"><ShoppingBasket size={20} /></div>
                                المخزن الشامل
                              </h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2">
                              {filteredItems.map((item, idx) => (
                                <div key={`${item.id}-all-${idx}`} className={`p-3 rounded-2xl flex flex-col justify-between max-h-[460px] overflow-hidden ${showLegacyUIBorders ? 'bg-[#171d26] border border-[#d4af37]/25 shadow-md' : 'bg-[#111622]/50 border border-white/5 shadow-none'}`}>
                                  <div>
                                    <div className="w-full h-28 md:h-36 bg-slate-950/40 rounded-lg p-1.5 overflow-hidden border border-white/5 flex items-center justify-center mb-1">
                                      {item.photo ? (
                                        <JamFastProductImage imageUrl={item.photo} altName={item.name} className="max-h-full max-w-full object-contain" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-750">
                                          <ShoppingBasket size={18} />
                                        </div>
                                      )}
                                    </div>
                                    <h4 className="text-sm font-bold text-white mt-1 truncate">{item.name}</h4>
                                  </div>

                                  <div className="flex items-center justify-between mt-2 pt-1">
                                    <span className="text-xs md:text-sm font-bold text-royal-gold">{(item.price || 0).toLocaleString()} YER</span>
                                    <button 
                                      onClick={() => {
                                        const mockOffer: PromoOffer = {
                                          id: 'item_' + item.id,
                                          ownerId: shopProfile.id,
                                          itemId: item.id,
                                          itemName: item.name,
                                          originalPrice: item.price,
                                          promoPrice: item.price,
                                          description: item.name,
                                          occasion: 'منتج في المخزن',
                                          status: 'active',
                                          createdAt: Timestamp.now(),
                                          startTime: Timestamp.now(),
                                          endTime: Timestamp.now()
                                        };
                                        setBookingItem(mockOffer);
                                        setIsBookingModalOpen(true);
                                        setBookingStep('info');
                                      }}
                                      className="p-1.5 bg-royal-gold/10 text-royal-gold rounded-lg hover:bg-royal-gold hover:text-deep-navy transition-all"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                      </>
                    );
                  })()}

                  {/* Active Offers */}
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <div className="p-2 bg-royal-gold/10 rounded-xl text-royal-gold"><Gift size={20} /></div>
                        عروض اليوم الحصرية
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                      {activeOffers.map((offer, idx) => (
                        <motion.div 
                          key={`${offer.id}-${idx}`}
                          className={`p-6 space-y-6 relative group overflow-hidden ${showLegacyUIBorders ? 'bg-[#171d26] border border-[#d4af37]/25 rounded-[2.5rem] shadow-2xl' : 'bg-[#111622]/50 border border-white/5 rounded-2xl shadow-none'}`}
                        >
                          {showLegacyUIBorders && <div className="absolute top-0 left-0 w-32 h-32 bg-royal-gold/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl group-hover:bg-royal-gold/10 transition-all" />}
                          
                          <div className="flex gap-6 items-start">
                            <div className="w-32 h-32 bg-deep-navy rounded-[2rem] overflow-hidden border border-white/10 flex-shrink-0">
                              {offer.image ? (
                                <img src={offer.image} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-700">
                                   <ShoppingBasket size={48} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 space-y-2 pt-2">
                              <span className="bg-royal-gold/10 text-royal-gold text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">{offer.occasion}</span>
                              <h4 className="text-lg font-black text-white">{offer.itemName}</h4>
                              <p className="text-[10px] font-bold text-gray-500 leading-relaxed text-right line-clamp-2">{offer.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-white/5">
                             <div className="flex flex-col text-right">
                                <span className="text-[10px] text-gray-500 line-through font-bold">{(offer.originalPrice || 0).toLocaleString()} ر.ي</span>
                                <span className="text-2xl font-black text-royal-gold tabular-nums">{(offer.promoPrice || 0).toLocaleString()} <small className="text-[10px] font-bold uppercase">ر.ي</small></span>
                             </div>
                             <button 
                                onClick={() => {
                                  setBookingItem(offer);
                                  setIsBookingModalOpen(true);
                                  setBookingStep('info');
                                }}
                                className="bg-royal-gold text-deep-navy h-14 px-8 rounded-2xl font-black hover:bg-gold-glow transition-all flex items-center gap-2 shadow-lg active:scale-95"
                             >
                                <ShoppingBasket size={20} />
                                حجز فوري
                             </button>
                          </div>
                        </motion.div>
                      ))}
                      {activeOffers.length === 0 && (
                        <div className="p-16 text-center bg-white/5 rounded-[3rem] border-2 border-dashed border-white/5 space-y-4">
                            <ShoppingBasket size={48} className="mx-auto text-gray-800" />
                            <p className="text-gray-500 font-bold">لا يوجد عروض نشطة حالياً.. تفحص المزادات!</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'maintenance' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                      <div className="p-2 bg-royal-gold/10 rounded-xl text-royal-gold"><Wrench size={20} /></div>
                      طلبات الصيانة الخاصة بك
                    </h3>
                  </div>

                  {/* Offline Active Devices Reminder (حتى لو كان الزبون أوفلاين) */}
                  {!isOnline && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-[2rem] space-y-3"
                    >
                      <div className="flex items-center gap-3 text-amber-400">
                        <AlertTriangle className="animate-pulse shrink-0" size={24} />
                        <div>
                          <h4 className="font-black text-sm text-white">تنبيه صيانة أوفلاين (غير متصل بالشبكة)</h4>
                          <p className="text-[11px] text-zinc-400">يمكنك مراجعة أجهزتك واستلامها من المحل حتى بدون إنترنت.</p>
                        </div>
                      </div>
                      {(() => {
                        try {
                          const cached = localStorage.getItem('jam_cached_maintenance');
                          if (cached) {
                            const list = JSON.parse(cached) as any[];
                            const readyList = list.filter(item => 
                              item.status === 'ready' || 
                              item.status === 'Ready' || 
                              item.status === 'completed'
                            );
                            if (readyList.length > 0) {
                              return (
                                <div className="p-3 bg-black/30 rounded-xl space-y-2 border border-amber-500/10 mt-2">
                                  <p className="text-xs font-bold text-amber-300">⚠️ الأجهزة التالية جاهزة تماماً وتنتظرك لاستلامها:</p>
                                  <ul className="list-disc list-inside text-[11px] font-bold text-zinc-300 space-y-1">
                                    {readyList.map((d, i) => (
                                      <li key={i}>
                                        {d.deviceModel || d.deviceName || d.deviceType || 'هاتفك'} - <span className="text-green-400">جاهز للاستلام</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            }
                          }
                        } catch (e) {}
                        return null;
                      })()}
                    </motion.div>
                  )}

                  {/* System Notifications Authorization Banner (صلاحيات إشعارات فوق التطبيقات الأخرى) */}
                  <div className="p-6 bg-[#171d26] border border-[#d4af37]/20 rounded-[2.5rem] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
                    <div className="flex items-start gap-4 text-right">
                      <div className="w-14 h-14 bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-[1.25rem] flex items-center justify-center text-[#d4af37] shrink-0 relative">
                        <Bell size={26} className={(!overlayPermissionGranted || notificationPermission === 'default') ? "animate-bounce" : ""} />
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-royal-gold rounded-full border-2 border-[#171d26] animate-ping" />
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-royal-gold rounded-full border-2 border-[#171d26]" />
                      </div>
                      <div>
                        <h4 className="font-black text-white text-base">منظومة الإشعارات والظهور فوق التطبيقات (APK)</h4>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                          تفعيل هذا الخيار يمنح التطبيق صلاحية الظهور كأيقونة عائمة ونافذة منبثقة (Overlay Draw) وصلاحيات الإشعارات الصوتية لتنبيهك بحالة الصيانة فوراً حتى لو كان التطبيق مغلقاً.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                      {/* Test Notification Button */}
                      {(overlayPermissionGranted || notificationPermission === 'granted') && (
                        <button
                          onClick={() => {
                            triggerSimulatedNotification(
                              "تحديث حالة صيانة جهازك 🔧",
                              "المهندس: تم الانتهاء من إصلاح شاشة جهازك بنجاح. الجهاز الآن جاهز للاستلام الفوري في المحل 🏆"
                            );
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 bg-[#1a2333] border border-[#d4af37]/40 text-[#d4af37] font-black text-xs rounded-xl hover:bg-[#d4af37]/10 transition-all shadow-md active:scale-95 whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                        >
                          <BellRing size={14} className="animate-pulse" />
                          <span>إرسال إشعار تجريبي 🔔</span>
                        </button>
                      )}

                      {overlayPermissionGranted ? (
                        <div className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center gap-2 text-emerald-400 font-black text-xs">
                          <Check size={14} />
                          <span>صلاحية النظام مفعلة بنجاح</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setShowAndroidOverlayModal(true);
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 bg-royal-gold text-deep-navy font-black text-xs rounded-xl hover:bg-gold-glow transition-all shadow-md active:scale-95 whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                        >
                          <span>منح صلاحية الظهور والاشعارات الآن</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {maintenanceOrders
                      .filter(order => {
                        // Strict Data Isolation (Diamond Isolation Protocol)
                        if (shopProfile?.id !== 'demo_store') {
                          const currentUserId = currentLead?.id || '';
                          if (!currentLead || (order.customerPhone !== currentLead.phone && order.customerId !== currentUserId)) {
                            return false;
                          }
                        }
                        
                        // Time-To-Live (TTL) Logic: Hide any phone exactly 30 days after its status is "Received" (تم الاستلام / received) or delivered
                        if (order.status === 'Received' || order.status === 'received' || order.status === 'delivered') {
                          const updateTime = order.updatedAt?.toDate ? order.updatedAt.toDate().getTime() :
                                             order.updatedAt?.seconds ? order.updatedAt.seconds * 1000 :
                                             order.updatedAt ? new Date(order.updatedAt).getTime() :
                                             order.deliveredAt?.toDate ? order.deliveredAt.toDate().getTime() :
                                             order.deliveredAt?.seconds ? order.deliveredAt.seconds * 1000 :
                                             order.createdAt?.toDate ? order.createdAt.toDate().getTime() :
                                             order.createdAt?.seconds ? order.createdAt.seconds * 1000 : null;
                                                
                          if (updateTime) {
                            const ageMs = Date.now() - updateTime;
                            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
                            if (ageMs > thirtyDaysMs) return false;
                          }
                        }
                        return true;
                      })
                      .map((order, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={`${order.id}-${idx}`}
                        className={`p-6 space-y-4 relative overflow-hidden group ${showLegacyUIBorders ? 'bg-[#171d26] border border-[#d4af37]/25 rounded-[2.5rem]' : 'bg-[#111622]/50 border border-white/5 rounded-2xl'}`}
                      >
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 bg-deep-navy rounded-2xl flex items-center justify-center border transition-colors ${showLegacyUIBorders ? 'border-white/10 group-hover:border-royal-gold/30' : 'border-white/5'}`}>
                                <Smartphone className={gTextColorRoyalGold} size={24} />
                              </div>
                              <div>
                                <h4 className="font-black text-white">{order.deviceModel}</h4>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{order.deviceBrand}</p>
                              </div>
                           </div>
                           <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                              order.status === 'ready' ? 'bg-success/20 text-success' :
                              order.status === 'delivered' ? 'bg-royal-gold/20 text-royal-gold' :
                              order.status === 'working' ? 'bg-blue-500/20 text-blue-500' :
                              order.status === 'failed' ? 'bg-red-500/20 text-red-500' :
                              'bg-gray-500/20 text-gray-400'
                           }`}>
                              {order.status === 'ready' ? 'جاهز للاستلام' :
                               order.status === 'delivered' ? 'تم التسليم' :
                               order.status === 'working' ? 'قيد الصيانة' :
                               order.status === 'failed' ? 'فشل الإصلاح' :
                               'بانتظار الفحص'}
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                              <span className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">المشكلة</span>
                              <p className="text-xs font-bold text-white leading-relaxed">{order.issue}</p>
                           </div>
                           <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                              <span className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">التكلفة</span>
                              <div className="flex items-center gap-1">
                                 <span className="text-sm font-black text-royal-gold">{(order.cost || 0).toLocaleString()}</span>
                                 <span className="text-[8px] text-gray-500">ر.ي</span>
                              </div>
                           </div>
                        </div>

                        {order.status === 'ready' && (
                          <div className="bg-success/10 p-4 rounded-2xl border border-success/20 flex items-center gap-3">
                             <CheckCircle2 className="text-success shrink-0" size={20} />
                             <p className="text-xs font-bold text-success leading-relaxed">
                               جهازك جاهز للاستلام! يمكنك زيارتنا الآن لاستلامه. المبلغ المتبقي: {((order.cost || 0) - (order.advancePayment || 0)).toLocaleString()} ر.ي
                             </p>
                          </div>
                        )}

                        {order.status === 'awaiting_response' && (
                          <div className="bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20 flex items-center gap-3">
                             <AlertTriangle className="text-orange-500 shrink-0" size={20} />
                             <p className="text-xs font-bold text-orange-500 leading-relaxed">
                               بانتظار ردك للموافقة على عملية الإصلاح. التكلفة المتوقعة: {order.cost} ر.ي
                             </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                           <div className="flex-1 h-1.5 bg-deep-navy rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: 
                                  order.status === 'delivered' ? '100%' :
                                  order.status === 'ready' ? '80%' :
                                  order.status === 'working' ? '50%' :
                                  '20%'
                                }}
                                className={`h-full ${order.status === 'failed' ? 'bg-red-500' : 'bg-royal-gold'}`} 
                              />
                           </div>
                           <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Progress</span>
                        </div>
                      </motion.div>
                    ))}

                    {maintenanceOrders.length === 0 && (
                      <div className="p-20 text-center bg-white/5 rounded-[3rem] border-2 border-dashed border-white/5 space-y-4">
                          <Package size={48} className="mx-auto text-gray-800" />
                          <p className="text-gray-500 font-bold">لم نجد أي طلبات صيانة مسجلة بهذا الرقم في هذا المتجر.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'doctor' && (
                <PhoneDoctor lead={currentLead} ownerId={shopProfile.id} inventory={inventory} tips={phoneTips} />
              )}

              {activeTab === 'games' && (
                <div className="space-y-6">
                  {/* Games Switcher Tab */}
                  <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-white/5 gap-2" dir="rtl">
                    <button 
                      onClick={() => setActiveGameTab('circuit')} 
                      className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeGameTab === 'circuit' 
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_4px_15px_rgba(6,182,212,0.3)]' 
                          : 'text-gray-400 hover:text-white bg-transparent hover:bg-white/5'
                      }`}
                    >
                      ⚡ لعبة توصيل الدوائر (50 مستوى)
                    </button>
                    <button 
                      onClick={() => setActiveGameTab('vault')} 
                      className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeGameTab === 'vault' 
                          ? 'bg-gradient-to-r from-royal-gold to-yellow-500 text-slate-950 shadow-[0_4px_15px_rgba(212,175,55,0.3)]' 
                          : 'text-gray-400 hover:text-white bg-transparent hover:bg-white/5'
                      }`}
                    >
                      🔐 لعبة الخزن والأرقام السرية
                    </button>
                  </div>

                  {activeGameTab === 'circuit' ? (
                    <CircuitGame />
                  ) : (
                    <TheGoldenVault currentLead={currentLead} shopProfile={shopProfile} customerProfile={currentLead} />
                  )}
                </div>
              )}

              {activeTab === 'rewards' && (
                <div className="space-y-10">
                   <div className="text-right space-y-4">
                      <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${showLegacyUIBorders ? 'bg-royal-gold/10 border border-royal-gold/30 text-royal-gold' : 'bg-white/5 border border-white/10 text-amber-400'}`}>
                        Loyalty Program
                      </div>
                      <h3 className="text-3xl font-black text-white">متجر الهدايا والمكافآت</h3>
                      <p className="text-sm font-bold text-gray-500 leading-relaxed">استبدل نقاطك الملكية بهدايا وخصومات حصرية من {shopProfile.shopName}.</p>
                   </div>
                   
                   {/* Points Progress */}
                   <div className={`p-8 relative overflow-hidden group ${showLegacyUIBorders ? 'bg-[#002244]/50 rounded-[3rem] border-2 border-royal-gold/20 shadow-2xl' : 'bg-[#111622]/50 rounded-2xl border border-white/5 shadow-none'}`}>
                      {showLegacyUIBorders && <div className="absolute top-0 right-0 w-32 h-32 bg-royal-gold/5 rounded-full blur-3xl" />}
                      <div className="flex items-center justify-between mb-6">
                        <div className="space-y-1">
                           <span className="text-4xl font-black text-royal-gold">{(currentLead?.points || 0).toLocaleString()}</span>
                           <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-tighter">نقطة متاحة</span>
                        </div>
                        <div className={`w-16 h-16 bg-deep-navy rounded-2xl flex items-center justify-center border ${showLegacyUIBorders ? 'text-royal-gold border-royal-gold/30 shadow-lg' : 'text-amber-400 border-white/5 shadow-none'}`}>
                           <Trophy size={32} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                           <span>{(currentLead?.points || 0) >= 1000 ? 'VIP Status Achieved' : 'المستوى التالي: VIP'}</span>
                           <span>{Math.min(100, Math.floor(((currentLead?.points || 0) / 1000) * 100))}%</span>
                        </div>
                        <div className="h-3 bg-deep-navy rounded-full overflow-hidden border border-white/5">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${Math.min(100, Math.floor(((currentLead?.points || 0) / 1000) * 100))}%` }}
                             className="h-full bg-gradient-to-r from-royal-gold to-gold-glow shadow-[0_0_15px_#D4AF37]"
                           />
                        </div>
                      </div>
                   </div>

                   {currentLead?.phone && shopProfile?.id && (
                     <div className="my-10">
                       <DailyFortuneGame storeId={shopProfile.id} customerPhone={currentLead.phone} />
                     </div>
                   )}

                   <ReferralSystem lead={currentLead} ownerId={shopProfile.id} shopName={shopProfile.shopName} />

                   {/* Referral Redemption */}
                   <div className={`p-6 space-y-4 ${showLegacyUIBorders ? 'bg-[#171d26] border border-[#d4af37]/25 rounded-[2.5rem]' : 'bg-[#111622]/50 border border-white/5 rounded-2xl'}`}>
                      <div className="flex items-center gap-3">
                        <Gift className={showLegacyUIBorders ? 'text-royal-gold' : 'text-amber-400'} size={20} />
                        <h4 className="text-sm font-black text-white">هل لديك كود دعوة من صديق؟</h4>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="أدخل كود الخصم هنا"
                          className={`flex-1 bg-[#0d1013] text-xs font-bold text-white outline-none uppercase placeholder-[#718096] ${showLegacyUIBorders ? 'border border-[#d4af37]/35 rounded-2xl px-4 py-3 focus:border-[#d4af37] transition-all' : 'border border-white/10 focus:border-amber-500 rounded-xl px-4 py-2.5'}`}
                          id="referralCodeInput"
                        />
                        <button 
                          onClick={async () => {
                            const input = document.getElementById('referralCodeInput') as HTMLInputElement;
                            const code = input.value.trim();
                            if(!code) return;
                            try {
                              const discount = await smartCommerceService.redeemReferral(shopProfile.id, currentLead.phone, code);
                              alert(`مبروك! تم تفعيل كود الخصم بقيمة ${discount} ر.ي وربح صديقك 1000 نقطة!`);
                              input.value = '';
                            } catch (err: any) {
                              alert(err.message);
                            }
                          }}
                          className="bg-royal-gold text-deep-navy px-6 py-3 rounded-2xl font-black text-xs active:scale-95 transition-all"
                        >
                          تفعيل
                        </button>
                      </div>
                   </div>

                   {/* Quick Tasks */}
                   <section className="space-y-5">
                      <h3 className="text-lg font-black text-white flex items-center gap-3">
                        <div className="p-1.5 bg-royal-gold/10 rounded-lg text-royal-gold"><Award size={18} /></div>
                        مهام سريعة للربح
                      </h3>
                      <div className="grid gap-3">
                        {activeQuizzes.filter(quiz => !attemptedQuizIds.includes(quiz.id)).length === 0 ? (
                          <div className="text-center p-6 bg-white/5 border border-dashed border-white/10 rounded-[2rem] text-gray-400 font-bold">
                            لا توجد مسابقات جديدة متاحة حالياً. انتظر المسابقات القادمة!
                          </div>
                        ) : (
                          activeQuizzes.filter(quiz => !attemptedQuizIds.includes(quiz.id)).map(quiz => (
                            <button 
                              key={quiz.id}
                              onClick={() => setActiveQuiz(quiz)}
                              className="flex items-center gap-4 p-5 bg-[#171d26] border border-[#d4af37]/20 rounded-[2rem] hover:border-[#d4af37] transition-all text-right group"
                            >
                              <div className="w-12 h-12 bg-deep-navy border border-white/10 rounded-xl flex items-center justify-center group-hover:bg-royal-gold/20 transition-colors shrink-0">
                                <Trophy className="text-royal-gold" size={24} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-black text-white text-sm truncate mb-1">{quiz.question}</h4>
                                <div className="flex items-center gap-2">
                                  <Zap size={10} className="text-royal-gold" />
                                  <span className="text-[9px] font-black text-royal-gold uppercase">+ {quiz.points} نقطة</span>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                   </section>
                </div>
              )}

              {activeTab === 'auction' && (
                <LiveAuction lead={currentLead} ownerId="global" />
              )}

              {activeTab === 'chat' && (
                <CustomerChat lead={currentLead} shopProfile={shopProfile} />
              )}

              {activeTab === 'feedback' && (
                <ComplaintsCenter lead={currentLead} ownerId={shopProfile.id} />
              )}

              {activeTab === 'quiz' && (
                <div className="space-y-6" dir="rtl">
                  <div className="bg-[#002244]/40 p-6 rounded-3xl border border-royal-gold/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <span className="p-2 bg-gradient-to-br from-purple-500 to-amber-500 rounded-xl text-white shadow-lg">
                          <Gamepad2 size={18} />
                        </span>
                        المسابقات الملكية وتحديات النقاط 🎮
                      </h2>
                      <p className="text-xs text-gray-400 font-bold mt-1">
                        شارك في التحديات والأسئلة اليومية لكسب نقاط ولاء وهدايا فورية من {shopProfile.shopName}.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                      <Trophy size={16} className="text-royal-gold" />
                      <span className="text-xs font-black text-white">رصيدك: {(currentLead?.points || 0).toLocaleString()} نقطة</span>
                    </div>
                  </div>

                  {/* Quizzes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeQuizzes.filter(quiz => !attemptedQuizIds.includes(quiz.id)).length === 0 ? (
                      <div className="col-span-2 p-10 bg-white/5 rounded-3xl border border-white/5 text-center space-y-3">
                        <Trophy size={48} className="mx-auto text-royal-gold/40 animate-pulse" />
                        <h4 className="text-white font-black text-base">لا توجد مسابقات جديدة حالياً</h4>
                        <p className="text-xs text-gray-400 font-bold">تابعنا باستمرار، يتم إضافة أسئلة ومسابقات وجوائز بشكل دوري!</p>
                      </div>
                    ) : (
                      activeQuizzes.filter(quiz => !attemptedQuizIds.includes(quiz.id)).map(quiz => (
                        <div 
                          key={quiz.id}
                          className="p-6 bg-gradient-to-br from-[#0d1627] to-[#040914] border border-royal-gold/25 rounded-3xl space-y-4 hover:border-royal-gold/60 transition-all text-right shadow-lg"
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-3 py-1 bg-royal-gold/20 text-royal-gold rounded-full text-[10px] font-black border border-royal-gold/30">
                              + {quiz.points} نقطة
                            </span>
                            <span className="text-xs font-bold text-gray-400">سؤال تفاعلي</span>
                          </div>
                          <h4 className="font-black text-white text-base leading-relaxed">{quiz.question}</h4>
                          <button
                            onClick={() => setActiveQuiz(quiz)}
                            className="w-full py-3 bg-royal-gold text-deep-navy font-black text-xs rounded-xl hover:bg-gold-glow transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                          >
                            <span>بدء الإجابة الآن</span>
                            <Zap size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'invite' && (
                <div className="space-y-6" dir="rtl">
                  <div className="bg-[#002244]/40 p-6 rounded-3xl border border-royal-gold/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <span className="p-2 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl text-white shadow-lg">
                          <Share2 size={18} />
                        </span>
                        دعوة الأصدقاء واكسب نقاط 🤝
                      </h2>
                      <p className="text-xs text-gray-400 font-bold mt-1">
                        شارك رابط المتجر مع أصدقائك واحصل على نقاط ولاء ومكافآت فورية عند كل تسجيل أو زيارة.
                      </p>
                    </div>
                  </div>

                  <div className="p-8 bg-gradient-to-br from-[#0d1627] to-[#040914] border border-royal-gold/30 rounded-3xl space-y-6 text-center shadow-xl">
                    <div className="w-20 h-20 bg-royal-gold/10 rounded-full flex items-center justify-center mx-auto text-royal-gold border border-royal-gold/30 shadow-[0_0_30px_rgba(212,175,55,0.2)]">
                      <Share2 size={36} />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-white">رمز الدعوة الملكي الخاص بك</h3>
                      <p className="text-xs text-gray-400 font-bold max-w-md mx-auto leading-relaxed">
                        شارك كود الدعوة هذا مع عائلتك وأصدقائك ليتم تسجيلهم تحت عضويتك وتحصل على مكافآت قيمة!
                      </p>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-royal-gold/40 flex items-center justify-between max-w-md mx-auto">
                      <span className="font-mono text-xl font-black text-royal-gold tracking-widest">
                        VIP-{currentLead?.phone?.slice(-4) || '7777'}
                      </span>
                      <button
                        onClick={() => {
                          const inviteCode = `VIP-${currentLead?.phone?.slice(-4) || '7777'}`;
                          navigator.clipboard.writeText(inviteCode);
                          alert('تم نسخ رمز الدعوة بنجاح!');
                        }}
                        className="px-4 py-2 bg-royal-gold text-deep-navy font-black text-xs rounded-xl hover:bg-gold-glow transition-all"
                      >
                        نسخ الكود
                      </button>
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        onClick={() => {
                          const shareText = `ادعوك لزيارة المتجر الملكي لـ ${shopProfile.shopName}! استخدم كود الدعوة الخاص بي: VIP-${currentLead?.phone?.slice(-4) || '7777'} واستمتع بخدمات صيانة وعروض حصرية: ${window.location.origin}`;
                          if (navigator.share) {
                            navigator.share({ title: `بوابة ${shopProfile.shopName}`, text: shareText, url: window.location.origin });
                          } else {
                            navigator.clipboard.writeText(shareText);
                            alert('تم نسخ رابط الدعوة بنجاح!');
                          }
                        }}
                        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-royal-gold to-gold-glow text-deep-navy font-black text-sm rounded-2xl shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Share2 size={16} />
                        <span>مشاركة الرابط عبر الواتساب والتطبيقات</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reels' && (
                <div className="space-y-6" dir="rtl">
                  {/* Top Premium Reels Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                    <div>
                      <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <span className="p-2 bg-gradient-to-br from-rose-500 to-amber-500 rounded-xl text-white shadow-lg shadow-rose-500/10">
                          <Video size={18} />
                        </span>
                        العروض الترويجية المصورة (Reels) 🎥
                      </h2>
                      <p className="text-xs text-gray-400 font-bold mt-1">
                        تابع واستكشف آخر العروض المرئية والخصومات والتحديثات الحية المنشورة من قبل المتجر.
                      </p>
                    </div>
                  </div>

                  {/* Reels Player Container */}
                  {promoVideos.length === 0 ? (
                    <div className="h-[460px] border-2 border-dashed border-white/10 rounded-[2.5rem] bg-gradient-to-b from-slate-900/10 via-slate-900/30 to-slate-900/60 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-rose-500 shadow-xl mb-4">
                        <Video size={28} className="animate-pulse" />
                      </div>
                      <h3 className="text-base font-black text-white">لا توجد عروض ترويجية مرئية حالياً</h3>
                      <p className="text-xs text-gray-400 max-w-sm mt-1 font-bold leading-relaxed">
                        لم يقم {shopProfile?.shopName || 'المحل'} بإضافة عروض فيديو حتى الآن. يرجى مراجعة صفحة المتجر لاحقاً لمشاهدة الفيديوهات الجديدة عند نشرها.
                      </p>
                    </div>
                  ) : (
                    <div className="relative bg-black rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center mx-auto max-w-md h-[580px]">
                      
                      {/* Video Player Display */}
                      <div className="absolute inset-0 bg-[#020612] flex items-center justify-center z-10 p-4 text-center">
                        {(() => {
                          const activeReel = promoVideos[activeReelIndex];
                          if (!activeReel) return null;
                          const srcUrl = activeReel.videoUrl || activeReel.url || '';

                          if (videoErrors[activeReel.id] || !srcUrl.trim().startsWith('http')) {
                            return (
                              <div className="flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
                                <Video size={40} className="text-amber-500 animate-bounce" />
                                <h3 className="text-xs font-black">تعذر تشغيل العرض كمقطع مرئي مباشر</h3>
                                <p className="text-[10px] text-gray-400 max-w-xs leading-relaxed font-bold">
                                  قد يكون الرابط عبارة عن صفحة ويب أو يحتاج إلى تشغيل خارجي. يمكنك فتح الرابط مباشرة لمشاهدة العرض.
                                </p>
                                <a 
                                  href={srcUrl || '#'} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 rounded-xl text-[10px] font-black text-white transition-all shadow-lg cursor-pointer"
                                >
                                  مشاهدة العرض بالخارج 🌐
                                </a>
                              </div>
                            );
                          }

                          const embedding = getEmbeddingUrl(srcUrl);
                          const isIframe = embedding.includes('youtube.com') || embedding.includes('player.vimeo.com');

                          if (isIframe) {
                            return (
                              <iframe 
                                className="w-full h-full pointer-events-auto animate-none"
                                src={embedding} 
                                allow="autoplay; encrypted-media" 
                                allowFullScreen 
                                referrerPolicy="no-referrer"
                                title={activeReel.title}
                              />
                            );
                          } else {
                            // direct mp4 player
                            return (
                              <video 
                                key={srcUrl}
                                src={srcUrl} 
                                className="w-full h-full object-cover animate-none"
                                controls
                                autoPlay
                                loop
                                muted={muted}
                                playsInline
                                onError={() => setVideoErrors(prev => ({ ...prev, [activeReel.id]: true }))}
                              />
                            );
                          }
                        })()}
                      </div>

                      {/* Floating hearts animation overlays */}
                      <div className="absolute inset-0 pointer-events-none z-30">
                        {floatingHearts.map(heart => (
                          <div
                            key={heart.id}
                            className="absolute text-rose-500 text-2xl transition-all duration-1000 ease-out"
                            style={{ 
                              left: heart.x + '%',
                              top: heart.y + '%',
                              transform: 'scale(1.5)',
                              opacity: 0
                            }}
                          >
                            ❤️
                          </div>
                        ))}
                      </div>

                      {/* Volume toggler for raw HTML5 videos only */}
                      {!(promoVideos[activeReelIndex]?.videoUrl || promoVideos[activeReelIndex]?.url || '').includes('youtube.com') && !(promoVideos[activeReelIndex]?.videoUrl || promoVideos[activeReelIndex]?.url || '').includes('vimeo.com') && (
                        <button 
                          onClick={() => setMuted(!muted)}
                          className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2.5 rounded-full text-white transition-all z-20 cursor-pointer"
                        >
                          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                      )}

                      {/* Header Badge */}
                      <div className="absolute top-4 left-4 z-20">
                        <span className="px-3 py-1.5 bg-rose-500/90 text-white text-[9px] font-black tracking-widest uppercase rounded-full shadow-lg flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                          بث حي للعروض 🔴
                        </span>
                      </div>

                      {/* Bottom Description & Profile Info Overlays */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/40 to-transparent p-5 pt-20 text-right text-xs z-20 pointer-events-none">
                        <div className="pointer-events-auto flex flex-col gap-2 max-w-[80%]">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-white font-extrabold text-[13px]">
                              {shopProfile?.shopName || shopProfile?.name || 'متجر JAM Pro'}
                            </span>
                          </div>
                          <h4 className="text-amber-100 font-bold text-xs leading-relaxed">
                            {promoVideos[activeReelIndex]?.title}
                          </h4>
                        </div>
                      </div>

                      {/* Sidebar Interaction Buttons */}
                      <div className="absolute right-4 bottom-20 flex flex-col gap-4 z-25 text-center pointer-events-auto">
                        <button
                          onClick={() => handleLikeReel(promoVideos[activeReelIndex].id)}
                          className="w-10 h-10 bg-black/50 hover:bg-black/70 border border-white/10 rounded-full flex items-center justify-center text-white transition active:scale-90"
                        >
                          <Heart size={18} className="text-rose-500 fill-rose-500" />
                        </button>
                        <span className="text-[10px] text-white font-mono font-bold -mt-3.5 bg-black/30 rounded px-1 self-center">
                          {likesCount[promoVideos[activeReelIndex].id] || 0}
                        </span>

                        <button
                          onClick={() => handleShareReel(promoVideos[activeReelIndex])}
                          className="w-10 h-10 bg-black/50 hover:bg-black/70 border border-white/10 rounded-full flex items-center justify-center text-white transition active:scale-90"
                        >
                          <Share2 size={18} className="text-blue-400" />
                        </button>
                        <span className="text-[9px] text-white -mt-3 text-center self-center bg-black/30 px-1 rounded truncate max-w-[60px]">
                          {copiedId === promoVideos[activeReelIndex].id ? 'تم النسخ!' : 'مشاركة'}
                        </span>
                      </div>

                      {/* Navigation controls (Next/Previous) */}
                      <div className="absolute bottom-4 left-4 flex gap-2 z-25 pointer-events-auto">
                        <button
                          disabled={activeReelIndex === 0}
                          onClick={() => setActiveReelIndex(prev => prev - 1)}
                          className="px-3.5 py-1.5 bg-black/60 hover:bg-black/80 border border-white/10 rounded-xl text-white text-[10px] font-black transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                          ▲ السابق
                        </button>
                        <button
                          disabled={activeReelIndex === promoVideos.length - 1}
                          onClick={() => setActiveReelIndex(prev => prev + 1)}
                          className="px-3.5 py-1.5 bg-black/60 hover:bg-black/80 border border-white/10 rounded-xl text-white text-[10px] font-black transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                          التالي ▼
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {activeTab === 'local_player' && (
                <div className="space-y-6">
                  {/* Luxury Universal Media Player Hub Card */}
                  <div className="bg-gradient-to-br from-[#0e1626] via-[#131c2e] to-[#0a101d] p-6 sm:p-8 rounded-[2.5rem] border-2 border-[#d4af37]/40 shadow-2xl text-right relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-radial from-[#1e293b] to-black border-2 border-[#d4af37] flex items-center justify-center text-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.3)] shrink-0">
                          <Music size={30} />
                        </div>
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black mb-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            مشغل الميديا الشامل الفوري (صوتيات وفيديو)
                          </div>
                          <h3 className="text-xl sm:text-2xl font-black text-white">مشغل الوسائط المتكامل VIP</h3>
                          <p className="text-xs text-gray-300 font-bold mt-1">
                            يدعم كافة الصيغ، قوائم التشغيل، والتشغيل المستمر بالخلفية وستارة إشعارات الجوال وشاشة القفل 📱
                          </p>
                        </div>
                      </div>

                      {/* Primary Open Button */}
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('toggle-jam-media-player', { detail: { open: true } }));
                        }}
                        className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 text-slate-950 font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                      >
                        <Play size={18} fill="currentColor" />
                        <span>فتح والتحكم بمشغل الميديا الآن 🎵</span>
                      </button>
                    </div>

                    {/* Features Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                        <span className="block text-amber-300 text-xs font-black">🎵 كافة الصيغ</span>
                        <span className="text-[9px] text-gray-400">MP3, MP4, WAV, M4A, FLAC</span>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                        <span className="block text-emerald-300 text-xs font-black">🎧 خلفية وشاشة القفل</span>
                        <span className="text-[9px] text-gray-400">تحكم عبر ستارة إشعارات الهاتف</span>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                        <span className="block text-sky-300 text-xs font-black">📋 قوائم تشغيل ذكية</span>
                        <span className="text-[9px] text-gray-400">إضافة ملفات متعددة وتكرار وعشوائي</span>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                        <span className="block text-purple-300 text-xs font-black">📱 نافذة عائمة مصغرة</span>
                        <span className="text-[9px] text-gray-400">أيقونة أندرويد عائمة فوق الصفحات</span>
                      </div>
                    </div>
                  </div>

                  {/* Embedded MX Player View */}
                  <MXLocalPlayer />
                </div>
              )}

              {/* Enhanced Footer Profile Card */}
              <div className="bg-gradient-to-br from-navy-900 via-deep-navy to-navy-900 p-8 rounded-[3.5rem] border-2 border-white/5 text-center space-y-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-full h-full bg-royal-gold/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                    <div className="w-24 h-24 bg-deep-navy rounded-[2.5rem] border-4 border-royal-gold flex items-center justify-center text-4xl font-black text-royal-gold mx-auto shadow-[0_0_40px_rgba(212,175,55,0.3)]">
                        {currentLead.phone.slice(-2)}
                    </div>
                    <div className="absolute -top-1 -right-1 bg-success text-white p-1.5 rounded-xl border-4 border-deep-navy">
                        <CheckCircle2 size={16} />
                    </div>
                </div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white">{currentLead.name}</h3>
                    <p className="text-royal-gold/60 text-xs font-black tracking-[0.3em] uppercase">Premium Member</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                        <span className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">الرصيد الحالي</span>
                        <div className="flex items-center justify-center gap-1">
                           <span className="text-2xl font-black text-royal-gold tabular-nums">{(currentLead?.points || 0).toLocaleString()}</span>
                           <span className="text-[10px] text-royal-gold">ن</span>
                        </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                        <span className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">تاريخ الإنضمام</span>
                        <div className="flex items-center justify-center">
                          <span className="text-sm font-black text-white">
                            {currentLead.createdAt?.toDate && typeof currentLead.createdAt.toDate === 'function' 
                              ? currentLead.createdAt.toDate().toLocaleDateString('ar-YE') 
                              : currentLead.createdAt?.seconds 
                                ? new Date(currentLead.createdAt.seconds * 1000).toLocaleDateString('ar-YE')
                                : new Date().toLocaleDateString('ar-YE')}
                          </span>
                        </div>
                    </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </main>

      {/* Floating Premium Side Navigation Dock */}
      {authStep === 'dashboard' && (
        <aside className="fixed right-0 top-[calc(4.5rem+env(safe-area-inset-top))] bottom-0 w-[calc(5.4rem+env(safe-area-inset-right))] sm:w-[calc(6.8rem+env(safe-area-inset-right))] md:w-[calc(8rem+env(safe-area-inset-right))] z-[150] bg-gradient-to-b from-[#030914] via-[#091124] to-[#030914] backdrop-blur-3xl border-l-2 border-[#d4af37]/40 shadow-[-8px_0_45px_rgba(0,0,0,0.6)] flex flex-col items-center py-3 sm:py-5 gap-2 sm:gap-3 overflow-y-auto no-scrollbar pr-[env(safe-area-inset-right)]" dir="rtl">
          <div className="flex flex-col items-center gap-2 sm:gap-2.5 md:gap-3 w-full px-1 sm:px-2 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
            {[
              { id: 'home', label: 'الرئيسية', icon: Zap },
              { id: 'store', label: 'متجر المحل', icon: ShoppingBasket },
              { id: 'auction', label: 'الحراج العام', icon: Gavel },
              { id: 'doctor', label: 'طبيب الهاتف', icon: Stethoscope },
              { id: 'maintenance', label: 'تتبع الصيانة', icon: Wrench },
              { id: 'rewards', label: 'نقاط الولاء', icon: Trophy },
              { id: 'quiz', label: 'المسابقات', icon: Gamepad2 },
              { id: 'reels', label: 'فيديوهات التاجر', icon: Video },
              { id: 'local_player', label: 'مشغل الصوت', icon: Music },
              { id: 'invite', label: 'دعوة الأصدقاء', icon: Share2 },
              { id: 'chat', label: 'المحادثة', icon: MessageSquare },
              { id: 'feedback', label: 'الشكاوى والآراء', icon: AlertCircle },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'local_player') {
                    window.dispatchEvent(new CustomEvent('toggle-jam-media-player', { detail: { open: true } }));
                  }
                }}
                className={`w-[74px] sm:w-[92px] md:w-[108px] flex flex-col items-center justify-center py-2 sm:py-2.5 md:py-3 rounded-2xl transition-all cursor-pointer ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-br from-royal-gold/30 via-royal-gold/15 to-gold-glow/10 border-2 border-royal-gold/50 text-[#d4af37] font-black scale-105 shadow-[0_6px_22px_rgba(212,175,55,0.25)]' 
                    : 'text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <tab.icon 
                  className={`w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 shrink-0 transition-transform ${
                    activeTab === tab.id ? 'text-[#d4af37] drop-shadow-[0_0_8px_rgba(212,175,55,0.6)] scale-110' : 'text-gray-300'
                  }`} 
                />
                <span className={`text-[10px] sm:text-[11px] md:text-[12px] mt-1 font-black text-center leading-tight break-words max-w-full px-0.5 ${activeTab === tab.id ? 'text-[#d4af37]' : 'text-gray-300'}`}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* Quiz Modal */}
      <AnimatePresence>
        {activeQuiz && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if(!quizLoading) setActiveQuiz(null); setQuizResult(null); }} className="absolute inset-0 bg-deep-navy/95 backdrop-blur-2xl" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 30 }} 
              className="relative w-full max-w-sm bg-[#171d26] rounded-[3rem] border border-[#d4af37]/30 shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="p-10 space-y-8 text-center">
                {quizResult ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className={`w-28 h-28 rounded-[2.5rem] mx-auto flex items-center justify-center ${quizResult.success ? 'bg-success/20 text-success' : 'bg-red-500/20 text-red-500'}`}>
                        {quizResult.success ? <Trophy size={56} /> : <X size={56} />}
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-white mb-2">{quizResult.success ? 'أحسنت يا بطل!' : 'للأسف.. حاول مرة أخرى'}</h3>
                        <p className="text-gray-400 font-bold leading-relaxed">
                            {quizResult.success 
                              ? `لقد ربحت ${quizResult.points} نقطة ولاء تمت إضافتها إلى محفظتك في متجر ${shopProfile.shopName}.` 
                              : 'الإجابة خاطئة، لا تقلق، لدينا مسابقات متجددة يومياً.. لا تتوقف عن المحاولة!'}
                        </p>
                    </div>
                    <button 
                        onClick={() => { setActiveQuiz(null); setQuizResult(null); }}
                        className="w-full py-5 bg-royal-gold text-deep-navy rounded-2xl font-black text-xl hover:bg-gold-glow transition-all"
                    >
                        استمرار
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-royal-gold">
                        <Clock size={16} />
                        <span className="text-xl font-black tabular-nums">{quizTimer}s</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <Trophy size={16} />
                        <span className="text-[10px] font-black">{activeQuiz.points} pts</span>
                      </div>
                    </div>
                    <h3 className="text-2xl font-black text-white leading-tight">{activeQuiz.question}</h3>
                    <div className="grid gap-3 pt-4">
                      {activeQuiz.options.map((opt, i) => (
                        <button 
                          key={i}
                          disabled={quizLoading}
                          onClick={() => submitAnswer(i)}
                          className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl font-black text-white hover:bg-royal-gold hover:text-deep-navy disabled:opacity-50 transition-all flex items-center justify-between group"
                        >
                          <span className="text-right flex-1">{opt}</span>
                          <div className="w-6 h-6 border-2 border-white/10 rounded-full group-hover:border-deep-navy transition-colors shrink-0 mr-4" />
                        </button>
                      ))}
                    </div>
                    {quizLoading && <div className="p-4"><Loader2 className="animate-spin text-royal-gold mx-auto" size={32} /></div>}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking Drawer */}
      <AnimatePresence>
        {isBookingModalOpen && bookingItem && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBookingModalOpen(false)} className="absolute inset-0 bg-deep-navy/95 backdrop-blur-2xl" />
            <motion.div 
               initial={{ y: '100%' }} 
               animate={{ y: 0 }} 
               exit={{ y: '100%' }} 
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="relative w-full max-w-xl bg-[#171d26] rounded-t-[4rem] border-t border-[#d4af37]/35 shadow-[0_-20px_100px_rgba(0,0,0,0.4)] p-10 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-white/10 rounded-full" />
              
              <div className="space-y-10 py-6">
                {bookingStep === 'info' ? (
                  <>
                    <div className="text-center space-y-6">
                      <div className="w-24 h-24 bg-royal-gold/10 rounded-[2.5rem] flex items-center justify-center mx-auto text-royal-gold border border-royal-gold/20">
                        <ShoppingBasket size={48} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-3xl font-black text-white">تأكيد حجز المنتج</h3>
                        <p className="text-gray-400 font-bold">أنت الآن تقوم بحجز <span className="text-white">{bookingItem.itemName}</span> بسعر العرض الخاص</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-5 bg-white/5 rounded-3xl border border-white/10 text-center">
                          <span className="block text-[10px] text-gray-500 font-black mb-1">سعر الحجز</span>
                          <span className="text-2xl font-black text-royal-gold">{(bookingItem?.promoPrice || 0).toLocaleString()} ر.ي</span>
                       </div>
                       <div className="p-5 bg-white/5 rounded-3xl border border-white/10 text-center">
                          <span className="block text-[10px] text-gray-500 font-black mb-1">صلاحية الحجز</span>
                          <span className="text-lg font-black text-white">24 ساعة</span>
                       </div>
                    </div>

                    <div className="bg-royal-gold/5 border border-royal-gold/20 p-6 rounded-[2.5rem] space-y-4">
                        <div className="flex items-center gap-3 text-royal-gold">
                            <AlertCircle size={20} />
                            <h4 className="font-black text-sm">تذكير بالأمان والجدية</h4>
                        </div>
                        <ul className="text-xs text-gray-400 space-y-2 list-disc pr-5 font-bold leading-relaxed">
                            <li>الحجز لا يعتبر نهائياً إلا بعد إرفاق صورة إشعار التحويل.</li>
                            <li>المحل يضمن توفير المنتج لك فور تأكيد الدفع.</li>
                            <li>في حال عدم الدفع خلال المدة المحددة، يُلغى الحجز تلقائياً.</li>
                        </ul>
                    </div>

                    <button 
                      onClick={() => setBookingStep('payment')}
                      className="w-full py-6 bg-royal-gold text-deep-navy rounded-3xl font-black text-xl shadow-xl flex items-center justify-center gap-4 hover:bg-gold-glow transition-all"
                    >
                      إكمال عملية الدفع <ArrowRight size={24} />
                    </button>
                  </>
                ) : bookingStep === 'payment' ? (
                  <div className="space-y-10 animate-in slide-in-from-left duration-300">
                    <div className="space-y-6">
                        <h4 className="text-xl font-black text-white flex items-center gap-3">
                           <div className="p-2 bg-royal-gold/10 rounded-xl text-royal-gold"><Banknote size={20} /></div>
                           بيانات التحويل المعتمدة
                        </h4>

                        {/* Payment Method Selector */}
                        <div className="bg-[#001122]/60 p-4 border border-white/5 rounded-2xl space-y-3">
                          <span className="text-gray-400 font-bold text-xs block mb-1">وسيلة الدفع المفضلة:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-4 bg-royal-gold/10 border-2 border-royal-gold/50 rounded-2xl text-white font-black text-xs text-center flex items-center justify-center gap-2 select-none">
                              🏛️ التحويل والترتيب البنكي المباشر (مفعل)
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsJamPayPopupOpen(true)}
                              className="p-4 bg-gradient-to-r from-amber-500/10 to-yellow-600/5 border border-amber-500/60 hover:border-amber-400 text-amber-400 rounded-2xl font-bold text-xs text-center flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-all relative overflow-hidden group duration-200"
                              id="jampay-disabled-btn"
                            >
                              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                              <span className="flex items-center gap-1.5 font-bold">
                                📱 JAM Pay <span className="text-[10px] text-amber-400/75 font-medium">(جام بي - المحفظة الرقمية)</span>
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Customer Portal Deposit Wallets Card */}
                        <WalletDepositCard
                          wallets={multiBankAccounts}
                          ownerId={shopProfile?.ownerId || shopProfile?.uid}
                          storeName={shopProfile?.shopName || 'المحل'}
                          title="المحافظ الإلكترونية والحسابات المعتمدة للإيداع"
                          subtitle="قم بنسخ رقم المحفظة وتحويل المبلغ، ثم ارفع إثبات الحوالة أدناه:"
                          allowEdit={false}
                        />

                        <div className="space-y-4">
                          {(() => {
                            const source = shopProfile?.bankDisplaySource || 'both';
                            
                            if (source === 'hidden') {
                              return (
                                <div className="p-8 text-center bg-deep-navy border-2 border-white/5 rounded-[3rem]">
                                  <AlertTriangle className="mx-auto text-amber-500 mb-2 animate-pulse" size={32} />
                                  <p className="font-black text-white text-base">بوابة الدفع المباشر مغلقة حالياً</p>
                                  <p className="text-xs text-gray-400 mt-1">يرجى التواصل مع إدارة المحل مباشرةً لتأكيد طريقة الدفع المناسبة واستكمال حجز الجهاز.</p>
                                </div>
                              );
                            }

                            const showMain = source === 'main' || source === 'both';
                            const showMulti = source === 'multi' || source === 'both';
                            
                            const renderMainCard = () => {
                              const hasMainData = !!(shopProfile?.bankInfo?.bankName || shopProfile?.bankInfo?.accountNumber);
                              if (!hasMainData && source === 'main') {
                                 return (
                                   <div className="p-8 text-center bg-deep-navy border-2 border-white/5 rounded-[3rem]">
                                     <p className="font-bold text-gray-400 text-sm">لا يتوفر حساب بنكي رئيسي مُعرّف حالياً.</p>
                                   </div>
                                 );
                              }
                              if (!hasMainData && source === 'both') return null;

                              return (
                                <div key="main-bank-card" className="bg-gradient-to-br from-royal-gold/[0.05] to-deep-navy border-2 border-royal-gold/25 p-8 rounded-[3rem] space-y-6 relative overflow-hidden">
                                  <div className="absolute top-2 left-2 bg-royal-gold/20 text-royal-gold text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-wider">الحساب البنكي الرئيسي</div>
                                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                      <span className="text-gray-500 font-bold">اسم الحساب / البنك</span>
                                      <span className="text-white font-black">{shopProfile?.bankInfo?.bankName || 'الكريمي للتمويل'}</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-2 py-4 bg-royal-gold/5 rounded-3xl border border-royal-gold/20">
                                      <span className="text-xs font-black text-gray-400">رقم الحساب أو الخدمة</span>
                                      <span className="text-3xl font-black text-royal-gold tracking-widest tabular-nums">{shopProfile?.bankInfo?.accountNumber || '123456789'}</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-4">
                                      <span className="text-gray-500 font-bold">باسم (المستفيد الكامل)</span>
                                      <span className="text-white font-black">{shopProfile?.bankInfo?.accountName || shopProfile?.shopName}</span>
                                  </div>
                                </div>
                              );
                            };

                            const renderedCards: any[] = [];
                            
                            if (showMain) {
                              const card = renderMainCard();
                              if (card) renderedCards.push(card);
                            }

                            if (showMulti && bankAccounts.length > 0) {
                              bankAccounts.forEach(account => {
                                renderedCards.push(
                                  <div key={account.id} className="bg-deep-navy border-2 border-white/5 p-8 rounded-[3rem] space-y-6 relative overflow-hidden group hover:border-royal-gold/20 transition-all">
                                    <div className="absolute top-0 left-0 w-full h-full bg-royal-gold/[0.01]" />
                                    <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                        <span className="text-gray-500 font-bold">اسم البنك / الخدمة</span>
                                        <span className="text-white font-black">{account.bankName}</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 py-4 bg-royal-gold/5 rounded-3xl border border-royal-gold/25">
                                        <span className="text-xs font-black text-gray-400">رقم الحساب أو الخدمة</span>
                                        <span className="text-3xl font-black text-royal-gold tracking-widest tabular-nums">{account.accountNumber}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-4">
                                        <span className="text-gray-500 font-bold">باسم (المستفيد الكامل)</span>
                                        <span className="text-white font-black">{account.accountName}</span>
                                    </div>
                                  </div>
                                );
                              });
                            }

                            if (renderedCards.length === 0) {
                              return (
                                <div className="p-8 text-center bg-deep-navy border-2 border-white/5 rounded-[3rem]">
                                  <p className="font-bold text-gray-400 text-sm">لا تتوفر حسابات بنكية مضافة حالياً.</p>
                                </div>
                              );
                            }

                            return renderedCards;
                          })()}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-xl font-black text-white flex items-center gap-3">
                           <div className="p-2 bg-royal-gold/10 rounded-xl text-royal-gold"><Send size={20} /></div>
                           رفع إثبات الدفع
                        </h4>
                        <label className="block w-full text-center py-16 border-4 border-dashed border-white/5 rounded-[3rem] hover:border-royal-gold/30 cursor-pointer transition-all bg-white/5 relative group">
                            <input type="file" className="hidden" />
                            <div className="space-y-4">
                                <div className="w-20 h-20 bg-deep-navy rounded-full flex items-center justify-center mx-auto border-2 border-white/10 group-hover:border-royal-gold/30 transition-all">
                                   <Smartphone className="text-gray-600 group-hover:text-royal-gold transition-colors" size={32} />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-white font-black">اضغط لاختيار صورة الإشعار</p>
                                  <p className="text-[10px] text-gray-500 font-bold">Screenshot, JPG, PNG (Max 5MB)</p>
                                </div>
                            </div>
                        </label>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => setBookingStep('info')}
                        className="w-20 py-6 bg-white/5 text-gray-400 rounded-3xl font-black hover:bg-white/10 transition-all flex items-center justify-center"
                      >
                         <ArrowRight className="rotate-180" />
                      </button>
                      <button 
                        onClick={() => setBookingStep('success')}
                        className="flex-1 py-6 bg-royal-gold text-deep-navy rounded-3xl font-black text-xl shadow-2xl hover:bg-gold-glow transition-all"
                      >
                        تأكيد وإرسال الطلب
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-8 animate-in zoom-in duration-500">
                    <div className="relative inline-block">
                        <div className="w-32 h-32 bg-success/10 text-success rounded-[3rem] flex items-center justify-center mx-auto border-4 border-success/20">
                            <CheckCircle2 size={64} className="animate-pulse" />
                        </div>
                        <div className="absolute -top-4 -right-4 w-12 h-12 bg-royal-gold rounded-2xl flex items-center justify-center shadow-xl rotate-12">
                           <Trophy size={24} className="text-deep-navy" />
                        </div>
                    </div>
                    <div className="space-y-3 px-6">
                        <h3 className="text-3xl font-black text-white">تم إرسال طلبك ملكياً!</h3>
                        <p className="text-gray-400 font-bold leading-relaxed px-4">
                           طلبك في "الأمانة" الآن.. سيقوم فريق <span className="text-royal-gold">{shopProfile.shopName}</span> بمراجعة الدفع وتأكيد حجز جهازك فوراً.
                        </p>
                    </div>
                    <button 
                        onClick={() => {
                          setIsBookingModalOpen(false);
                          setBookingStep('info');
                        }}
                        className="w-full py-6 bg-white/5 border-2 border-white/10 text-white rounded-[2.5rem] font-black text-lg hover:bg-white/10 transition-all"
                    >
                        العودة لاستكشاف المتجر
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detailed Debt Statement Modal */}
      <AnimatePresence>
        {isStatementOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            dir="rtl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="bg-[#001122]/95 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] text-right"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 select-none">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-500/10 rounded-xl text-red-400">
                    <FileText size={18} />
                  </div>
                  <h3 className="text-lg font-black text-white">كشف الحساب التفصيلي</h3>
                </div>
                <button 
                  onClick={() => setIsStatementOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 pl-1">
                {/* Customer & Store Info Card */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                    <span>المتجر التابع له</span>
                    <span className="text-royal-gold font-black">{shopProfile?.shopName || 'المتجر الرئيسي'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                    <span>اسم العميل</span>
                    <span className="text-white font-black">{currentLead?.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                    <span>رقم الهاتف المربوط</span>
                    <span className="text-white font-mono font-black">{currentLead?.phone}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-400 border-t border-white/5 pt-2 mt-2">
                    <span>إجمالي المديونية القائمة</span>
                    <span className="text-xl font-black text-rose-400">
                      {((customerProfile?.debt !== undefined ? customerProfile.debt : statementSummary.netDebt) || 0).toLocaleString()} <span className="text-xs font-bold">ر.ي</span>
                    </span>
                  </div>
                </div>

                {/* Multi-Category Breakdown Cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-blue-300 font-bold block mb-1">📱 جوالات ومبيعات</span>
                    <span className="text-xs font-black text-white block">{statementSummary.salesDebt.toLocaleString()}</span>
                    <span className="text-[9px] text-gray-400">ر.ي</span>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-amber-300 font-bold block mb-1">🔧 صيانة أجهزة</span>
                    <span className="text-xs font-black text-white block">{statementSummary.maintenanceDebt.toLocaleString()}</span>
                    <span className="text-[9px] text-gray-400">ر.ي</span>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-emerald-300 font-bold block mb-1">📶 رصيد وشرايح</span>
                    <span className="text-xs font-black text-white block">{statementSummary.networkDebt.toLocaleString()}</span>
                    <span className="text-[9px] text-gray-400">ر.ي</span>
                  </div>
                </div>

                <h4 className="text-xs font-black text-gray-400 tracking-wider">سجل الفواتير والعمليات التفصيلية</h4>

                {loadingStatement ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <Loader2 className="animate-spin text-royal-gold" size={32} />
                    <span className="text-xs text-gray-400 font-bold">جاري تحميل العمليات السحـابيـة...</span>
                  </div>
                ) : statementInvoices.length === 0 ? (
                  <div className="text-center py-12 bg-white/2 rounded-2xl border border-dashed border-white/5">
                    <p className="text-xs text-gray-400 font-bold">لا توجد عمليات أو فواتير مسجلة لهذا الرقم في هذا المتجر.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {statementInvoices.map((inv: any, idx: number) => {
                      const isSale = inv.type === 'sale';
                      const isNetwork = inv.type === 'network';
                      const isMaint = inv.type === 'maintenance';

                      return (
                        <div key={`${inv.id}-${idx}`} className="bg-white/2 p-4 rounded-2xl border border-white/5 transition-all hover:bg-white/5 flex flex-col gap-2 text-right">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">
                                  {isMaint ? '🔧' : isNetwork ? '📶' : '📱'}
                                </span>
                                <span className="text-white font-black text-sm block">{inv.title}</span>
                              </div>
                              <span className="text-[10px] font-mono text-gray-500 block mt-0.5">
                                {inv.id.toUpperCase().slice(-10)} • {inv.date ? inv.date.toLocaleDateString('ar-EG') : '--'}
                              </span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black ${
                              inv.isDebt
                                ? 'bg-red-500/15 text-red-400 border border-red-500/20' 
                                : 'bg-green-500/15 text-green-400 border border-green-500/20'
                            }`}>
                              {inv.status}
                            </span>
                          </div>

                          {/* Item/Issue Details */}
                          {(inv.itemsSummary || inv.issue) && (
                            <div className="bg-white/5 p-2 rounded-xl text-[11px] text-gray-300 font-medium leading-relaxed">
                              {isMaint ? (
                                <span><strong className="text-amber-400">العطل/الخدمة:</strong> {inv.issue}</span>
                              ) : (
                                <span><strong className="text-blue-400">الأصناف:</strong> {inv.itemsSummary}</span>
                              )}
                            </div>
                          )}

                          <div className="border-t border-white/5 pt-2 flex justify-between items-center text-xs">
                            <span className="text-gray-400">
                              {isMaint ? 'تكلفة الصيانة:' : isNetwork ? 'قيمة الخدمة:' : 'إجمالي الفاتورة:'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-black">
                                {(inv.amount || 0).toLocaleString()} ر.ي
                              </span>
                              {isMaint && inv.advancePayment > 0 && (
                                <span className="text-[10px] text-emerald-400 font-bold">
                                  (مدفوع مقدم: {inv.advancePayment.toLocaleString()})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-4 mt-4 text-center">
                <p className="text-[10px] text-gray-500 font-bold leading-relaxed">
                  تتم المزامنة تلقائياً من خلال النظام المطور Jam system pro 2026. <br />
                  بإشراف المطور م. عبدالغني المحفلي.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JAM Pay Popup Modal */}
      <AnimatePresence>
        {isJamPayPopupOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
            dir="rtl"
            id="jampay-popup-overlay"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="bg-[#021830] border-2 border-royal-gold/40 w-full max-w-lg rounded-[2.5rem] p-8 shadow-[0_20px_80px_rgba(212,175,55,0.2)] relative overflow-hidden flex flex-col text-right space-y-6"
              id="jampay-popup-content"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-royal-gold/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-white/10 pb-4 select-none">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-royal-gold/10 rounded-2xl text-royal-gold shadow-[0_0_20px_rgba(212,175,55,0.2)] border border-royal-gold/30">
                    <ShieldCheck size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">بوابة JAM Pay السحابية</h3>
                    <span className="text-[10px] text-royal-gold font-bold block uppercase tracking-widest">Secure E-Payment Gateway</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsJamPayPopupOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors border border-white/5"
                  id="close-jampay-btn"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-6 py-2">
                {/* Arabic Content */}
                <div className="p-5 bg-royal-gold/5 border border-royal-gold/20 rounded-2xl space-y-2 text-right">
                  <div className="flex items-center gap-2 text-royal-gold font-black text-sm">
                    <span className="bg-royal-gold text-deep-navy px-2 py-0.5 rounded text-[10px] font-bold">قريباً جداً</span>
                    <span>تطوير شبكة دفع رقمية متكاملة</span>
                  </div>
                  <p className="text-gray-200 font-bold text-xs sm:text-sm leading-relaxed">
                    🚀 ميزة JAM Pay قيد التطوير حالياً! نحن نعمل على بناء شبكة دفع رقمية متكاملة لتسهيل معاملاتكم المالية.. انتظرونا قريباً جداً في التحديث القادم.
                  </p>
                </div>

                {/* English Content */}
                <div className="p-5 bg-white/[0.02] border border-white/15 rounded-2xl space-y-2 text-left" dir="ltr">
                  <div className="flex items-center gap-2 text-amber-400 font-black text-xs">
                    <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[9px] font-bold">Coming Soon</span>
                    <span>Integrated Payment Network</span>
                  </div>
                  <p className="text-gray-300 font-medium text-xs leading-relaxed">
                    🚀 JAM Pay feature is currently under development! We are actively building an integrated digital payment network to streamline your financial transactions.. Stay tuned, coming very soon.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsJamPayPopupOpen(false)}
                className="w-full py-4 bg-gradient-to-r from-royal-gold via-gold-glow to-royal-gold text-deep-navy rounded-2xl font-black text-sm transition-all hover:brightness-110 active:scale-95 shadow-md"
                id="jampay-ok-btn"
              >
                حسناً، فهمت
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AdOverlay 
        ads={activeAds}
        isOpen={isAdOpen}
        onClose={() => {
          setIsAdOpen(false);
          if (isLoggingOut) performLogout();
        }}
      />
    </div>
  );
}
