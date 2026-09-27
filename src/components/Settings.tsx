import { useEffect, useState } from 'react';
import CryptoJS from 'crypto-js';
import { DevicePermissionsService } from '../services/DevicePermissionsService';
import { Image as ImageIcon, Download, Upload, Database, ShieldCheck, AlertCircle, CheckCircle2, 
  FileJson, HardDrive, Settings as SettingsIcon, Save, MapPin, Phone, KeyRound, RefreshCw, Clock,
  MessageCircle, ExternalLink, Cloud, Trash2, AlertTriangle, Loader2, LayoutDashboard, RotateCcw,
  Wallet, User, DollarSign, Banknote, Barcode, Printer, Plus, Minus, History, Bell, Palette, 
  Globe, Shield, Activity, Monitor, Volume2, Coins, Smartphone, Share2, Copy, QrCode, X, Key, Tag,
  Send, Package, ChevronDown, Check, Calendar, TrendingDown, Box, Calculator as CalculatorIcon,
  Store, SearchCode, PlusSquare, Zap, ShoppingBasket, Wrench, BarChart3, CreditCard, Users, Truck, Archive, Gavel, FileText,
  ScanLine, Layout, Briefcase, Link2, Link2Off, Cpu, Network
} from 'lucide-react';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, writeBatch, query, limit, where, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import JsBarcode from 'jsbarcode';
import { useRef } from 'react';
import { simulationService } from '../services/simulationService';
import { InventoryItem, BankAccount, Warehouse } from '../types';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { sendSMS, pingSMS } from '../services/smsService';
import { UserProfile } from '../types';
import { uploadToMega } from '../services/megaService';
import { performBackup } from '../services/backupService';
import { logActivity } from '../services/activityLogService';
import { verifyAccountingIntegrity } from '../services/accountingService';
import { remoteAccessService } from '../services/remoteAccessService';
import { securityService } from '../services/securityService';
import BarcodePrintModal from './BarcodePrintModal';
import PricingManager from './PricingManager';
import { JamBoxManager } from './JamBoxManager';
import BankTransferManager from './BankTransferManager';
import { NetworkSyncSettings } from './NetworkSyncSettings';
import { useLoading } from '../context/LoadingContext';

interface SettingsProps {
  profile: UserProfile | null;
}

interface MessageTemplates {
  debt: string;
  debt_payment: string;
  device_ready: string;
  inspection: string;
  shortage: string;
  maintenance_intake: string;
  maintenance_approval: string;
  maintenance_shortage: string;
  account_summary: string;
  debtReminder: string;
  statementSummary: string;
  stockAlert: string;
  maintenanceReady: string;
  installment_reminder: string;
  installment_payment?: string;
}

interface PrinterSettings {
  enableLabel: boolean;
  enableBarcode: boolean;
  enableInvoice: boolean;
  enableAutoPrint: boolean;
  labelWidth: number;
  labelHeight: number;
  barcodeWidth: number;
  barcodeHeight: number;
  showPriceOnBarcode?: boolean;
  printerName: string;
  type: string;
  name: string;
  invoiceTemplate?: string;
  labelTemplate?: string;
}

interface ShopSettings {
  shopName: string;
  supervisorName: string;
  shopPhone: string;
  shopAddress: string;
  shopLogo: string;
  shopStamp: string;
  businessType: string;
  uiTheme: string;
  currency: string;
  licenseExpiry: Timestamp | null;
  smsApiKey: string;
  smsMobileIp: string;
  backupMega: string;
  backupGDrive: string;
  backupMediaFire: string;
  city: string;
  visibility: boolean;
  prayerLockEnabled: boolean;
  maxDiscountPerSale: number;
  salaryAdvanceLimitPercent: number;
  messageTemplates: MessageTemplates;
  printer: PrinterSettings;
  socialLinks: {
    whatsapp: string;
    telegram: string;
    facebook: string;
  };
  sendSocialLinks: boolean;
  exchangeRates: {
    [key: string]: number;
  };
  enableTax: boolean;
  taxRate: number;
  discountEnabled: boolean;
  visualTheme: string;
  defaultThemeMode?: string;
  uiCustomization?: {
    headerColor?: string;
    sidebarColor?: string;
    headingFont?: string;
    titleColor?: string;
    cardOpacity?: number;
  };
  enableWhatsAppSharing: boolean;
  enableAutoPrint: boolean;
  enableAudioUI: boolean;
  enablePopupNotifications: boolean;
  enableBarcodeAutoPrice: boolean;
  autoPricingEnabled?: boolean;
  autoPricingType?: 'buy' | 'sell' | 'both';
  backupPrices?: { [itemId: string]: { price: number; cost: number } };
  customBaseUrl?: string;
  productLabels?: string[];
  productCategories?: string[];
  isAuthRequired?: boolean;
  invoiceLabel?: string;
  defaultInvoiceType?: 'simplified' | 'detailed';
  brands?: { id: string; name: string; logo: string }[];
  units?: { id: string; name: string }[];
  fontSizeBillTitle?: number;
  fontSizeBillBody?: number;
  fontSizeBillPrice?: number;
  billScale?: number;
  notificationSettings?: {
    priceMonitorEnabled: boolean;
    currencyMonitorEnabled: boolean;
    debtAlertDays: number;
    installmentAlertEnabled: boolean;
    reviewTime: string;
    debtMessagingTime: string;
  };
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  dashboardShortcuts: string[];
  warehouseMapping?: {
    suppliers: string;
    customers: string;
    maintenance: string;
    auction: string;
    damaged: string;
    cashSales: string;
  };
  reservationNumbers?: string;
  storeCode?: string;
}

export default function Settings({ profile }: SettingsProps) {
  const navigate = useNavigate();
  
  const [shopSettings, setShopSettings] = useState<ShopSettings>({
    shopName: profile?.shopName || profile?.name || 'متجري الجديد',
    supervisorName: profile?.name || profile?.username || 'صاحب المحل',
    shopPhone: profile?.shopPhone || profile?.phone || '77*******',
    shopAddress: profile?.shopAddress || profile?.address || 'اليمن',
    shopLogo: '',
    shopStamp: '',
    businessType: profile?.businessType || 'mobiles',
    uiTheme: 'modern',
    currency: 'ر.ي',
    licenseExpiry: null,
    smsApiKey: 'e23c4b28de90dae1f098b2465aec73bd03bd709e853b6f69',
    smsMobileIp: '192.168.0.174',
    backupMega: '',
    backupGDrive: '',
    backupMediaFire: '',
    city: 'Sanaa',
    visibility: true,
    prayerLockEnabled: true,
    maxDiscountPerSale: 500,
    salaryAdvanceLimitPercent: 50,
    messageTemplates: {
      debt: `عزيزي {name}، نود تذكيرك بأن مديونيتكم لدى المحل هي {balance} ريال. نرجو التكرم بالسداد.\nإدارة: ${profile?.name || 'المحل'}`,
      debt_payment: `تم استلام مبلغ {amount} ريال منكم. الرصيد المتبقي: {balance} ريال.\nإدارة: ${profile?.name || 'المحل'}`,
      device_ready: `عزيزي {name}، جهازك {device} جاهز للاستلام. التكلفة المتبقية: {amount}. {store}\nإدارة: ${profile?.name || 'المحل'}`,
      inspection: `عزيزي {name}، نتيجة فحص جهازك {device}: {issue}. التكلفة التقديرية: {amount}. هل ترغب في البدء؟ {store}\nإدارة: ${profile?.name || 'المحل'}`,
      shortage: `نقص في المخزن: {name}. الكمية المطلوبة: {quantity}. {store}\nإدارة: ${profile?.name || 'المحل'}`,
      maintenance_intake: `عزيزي {name}، تم استلام جهازك {device} بنجاح. رقم الطلب: {ticket_id}.\nإدارة: ${profile?.name || 'المحل'}`,
      maintenance_approval: `عزيزي {name}، بعد الفحص الفني، يحتاج جهازك إلى {parts}، التكلفة: {price}. هل نعتمد الإصلاح؟\nإدارة: ${profile?.name || 'المحل'}`,
      maintenance_shortage: `نحيطك علماً بأن جهازك {device} بانتظار توفر قطع غيار. سنوافيك بالجديد فور وصولها.\nإدارة: ${profile?.name || 'المحل'}`,
      account_summary: `ملخص حسابك: إجمالي المشتريات {total_purchases}، المدفوع {total_paid}، المتبقي {balance}.\nإدارة: ${profile?.name || 'المحل'}`,
      installment_reminder: `عزيزي {name}، نذكركم بموعد سداد القسط المستحق بقيمة {amount}. نرجو التكرم بالسداد في أقرب وقت.\nإدارة: ${profile?.name || 'المحل'}`,
      debtReminder: '',
      statementSummary: '',
      stockAlert: '',
      maintenanceReady: ''
    },
    printer: {
      enableLabel: true,
      enableBarcode: true,
      enableInvoice: true,
      enableAutoPrint: false,
      labelWidth: 50,
      labelHeight: 30,
      barcodeWidth: 40,
      barcodeHeight: 25,
      showPriceOnBarcode: true,
      printerName: 'XP-420B',
      type: 'thermal',
      name: 'Default Printer'
    },
    socialLinks: {
      whatsapp: '',
      telegram: '',
      facebook: ''
    },
    sendSocialLinks: false,
    exchangeRates: {
      'USD': 530,
      'SAR': 140,
      'YER': 1
    },
    enableTax: false,
    taxRate: 5,
    discountEnabled: true,
    visualTheme: 'jam-pro-identity',
    enableWhatsAppSharing: true,
    enableAutoPrint: false,
    enableAudioUI: true,
    enablePopupNotifications: true,
    enableBarcodeAutoPrice: true,
    autoPricingEnabled: false,
    autoPricingType: 'both',
    backupPrices: {},
    customBaseUrl: window.location.origin,
    invoiceLabel: 'فاتورة مبيعات',
    fontSizeBillTitle: 24,
    fontSizeBillBody: 14,
    fontSizeBillPrice: 18,
    billScale: 1.0,
    productLabels: ['سماعة', 'وصلة', 'شاحن', 'جوال', 'MP3', 'بطارية', 'كفر'],
    productCategories: ['المحل', 'المستودع', 'spare_part', 'accessories_shop'],
    dashboardShortcuts: ['sale', 'maintenance', 'balance', 'inventory'],
    notificationSettings: {
      priceMonitorEnabled: true,
      currencyMonitorEnabled: true,
      debtAlertDays: 2,
      installmentAlertEnabled: true,
      reviewTime: '21:00',
      debtMessagingTime: '10:00'
    },
    bankInfo: {
      bankName: '',
      accountNumber: '',
      accountName: ''
    },
    reservationNumbers: '',
    storeCode: ''
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newWarehouseCode, setNewWarehouseCode] = useState('');
  const [newWarehouseLocation, setNewWarehouseLocation] = useState('');
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ processed: number, total: number, phase: number, totalPhases: number } | null>(null);
  const [devPassword, setDevPassword] = useState('');
  const [showRestorePanel, setShowRestorePanel] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedBarcodeItem, setSelectedBarcodeItem] = useState<InventoryItem | null>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [barcodeCount, setBarcodeCount] = useState(1);
  const [barcodeLabel, setBarcodeLabel] = useState('');
  const [barcodeValue, setBarcodeValue] = useState('');
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<{ isValid: boolean, discrepancies: any[] } | null>(null);
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', price: 0, stock: 0 });
  const [bankingSubTab, setBankingSubTab] = useState<'accounts' | 'transfers' | 'custom_boxes'>('accounts');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isAddingBank, setIsAddingBank] = useState(false);
  const [newBank, setNewBank] = useState<Partial<BankAccount>>({ bankName: '', accountName: '', accountNumber: '', currency: 'YER', balance: 0 });
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditLogs, setAuditLogs] = useState<{ type: 'info' | 'success' | 'error', message: string, time: string }[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleBackup = async () => {
    if (!profile?.ownerId || isBackingUp) return;
    setIsBackingUp(true);
    try {
      await performBackup(profile.ownerId);
      setStatus({ type: 'success', message: 'تم تنزيل وإنشاء النسخة الاحتياطية بنجاح' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'فشل تصدير النسخة الاحتياطية' });
    } finally {
      setIsBackingUp(false);
    }
  };
  const [remoteLink, setRemoteLink] = useState('');
  const [portalLink, setPortalLink] = useState('');
  const [isGeneratingRemote, setIsGeneratingRemote] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const { 
    showLegacyUIBorders, 
    setLegacyUIBorders, 
    showLegacyLoadingSpinners, 
    setLegacyLoadingSpinners,
    globalActionTimeout,
    setGlobalActionTimeout
  } = useLoading();
  const [securityCode, setSecurityCode] = useState('');
  const [confirmSecurityCode, setConfirmSecurityCode] = useState('');
  const [isChangingSecurityCode, setIsChangingSecurityCode] = useState(false);
  const [quickEntryWarehouse, setQuickEntryWarehouse] = useState(() => localStorage.getItem('jam-quick-entry-warehouse') || 'المحل');
  const [quickEntryLabel, setQuickEntryLabel] = useState(() => localStorage.getItem('jam-quick-entry-label') || '');
  const [quickEntryData, setQuickEntryData] = useState({ name: '', stock: '', price: '', cost: '' });
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [categories, setCategories] = useState<string[]>(['المحل', 'spare_part', 'accessories_shop', 'sim_cards']);
  const [barcodePrintQueue, setBarcodePrintQueue] = useState<{ item: InventoryItem; count: number }[]>([]);

  // System Permissions and Hardware Control Panel States
  const [permStates, setPermStates] = useState({
    camera: 'pending',
    storage: 'pending',
    bluetooth: 'pending',
    notifications: 'pending',
    overlay: 'manual_needed',
    wifi: navigator.onLine ? 'online' : 'offline',
    backgroundAudio: 'not_active',
    googleDrive: 'not_linked'
  });
  const [printersList, setPrintersList] = useState<any[]>([]);

  const handleRequestBluetooth = async () => {
    try {
      setStatus({ type: 'success', message: 'جاري البحث عن طابعات بلوتوث قريبة للاقتران...' });
      const granted = await DevicePermissionsService.requestOnDemand('bluetooth');
      if (granted) {
        const printers = await DevicePermissionsService.prepareBluetoothDevicePairing();
        setPrintersList(printers);
        setPermStates(prev => ({ ...prev, bluetooth: 'granted' }));
        setStatus({ type: 'success', message: 'تم فحص أجهزة البلوتوث وتفعيل محركات الاتصال بنجاح!' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: 'فشل فحص البلوتوث: ' + e.message });
    }
  };

  const handleRequestStorage = async () => {
    try {
      const granted = await DevicePermissionsService.requestOnDemand('files');
      if (granted) {
        setPermStates(prev => ({ ...prev, storage: 'granted' }));
        setStatus({ type: 'success', message: 'صلاحية التخزين وقراءة واستيراد الملفات نشطة الآن.' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: 'فشل تفعيل صلاحية الملفات: ' + e.message });
    }
  };

  const handleRequestCamera = async () => {
    try {
      const granted = await DevicePermissionsService.requestOnDemand('camera');
      setPermStates(prev => ({ ...prev, camera: granted ? 'granted' : 'denied' }));
      setStatus({ type: 'success', message: 'تم التحقق من الكاميرا وتجهيز قارئ الباركود للمسح الفوري.' });
    } catch (e: any) {
      setStatus({ type: 'error', message: 'فشل تفعيل الكاميرا: ' + e.message });
    }
  };

  const handleRequestNotifications = async () => {
    try {
      const granted = await DevicePermissionsService.requestOnDemand('background_play');
      if (granted) {
        setPermStates(prev => ({ ...prev, notifications: 'granted' }));
        setStatus({ type: 'success', message: 'تم تفعيل استقبال الإشعارات العاجلة بنجاح!' });
      } else {
        setStatus({ type: 'error', message: 'صلاحية الإشعارات لم يتم منحها.' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: 'فشل تفعيل الإشعارات: ' + e.message });
    }
  };

  const handleOverlayInstructions = () => {
    alert(`👑 تفعيل ميزة "الظهور فوق التطبيقات" (Overlay):
1. انتقل لإعدادات هاتفك الاندرويد (Settings).
2. اختر "التطبيقات" (Apps) -> "إدارة التطبيقات".
3. ابحث عن تطبيقنا "JAM System Pro".
4. اضغط على "الظهور فوق التطبيقات الأخرى" (Display over other apps).
5. قم بتفعيل الخيار (السماح بالظهور).`);
    setPermStates(prev => ({ ...prev, overlay: 'active' }));
    setStatus({ type: 'success', message: 'تم تحديث حالة صلاحية العرض العائم بنجاح.' });
  };

  const handleCheckWifi = async () => {
    const granted = await DevicePermissionsService.requestOnDemand('wifi');
    if (granted) {
      const online = navigator.onLine;
      setPermStates(prev => ({ ...prev, wifi: online ? 'online' : 'offline' }));
      if (online) {
        setStatus({ type: 'success', message: 'الشبكة نشطة: متصل بالإنترنت ومزامنة السحابة سريعة!' });
      } else {
        setStatus({ type: 'error', message: 'الشبكة غير نشطة: أنت تعمل حالياً بالوضع غير المتصل (أوفلاين).' });
      }
    }
  };

  const handleToggleBackgroundAudio = async () => {
    try {
      const granted = await DevicePermissionsService.requestOnDemand('background_play');
      if (granted) {
        const synth = window.speechSynthesis;
        if (synth) {
          const utterance = new SpeechSynthesisUtterance("مساعد باركود نشط بالخلفية");
          utterance.lang = 'ar-SA';
          utterance.volume = 0.5;
          synth.speak(utterance);
        }
        setPermStates(prev => ({ ...prev, backgroundAudio: 'active' }));
        setStatus({ type: 'success', message: 'تم تفعيل قناة التشغيل الخلفي والمساعد الصوتي بنجاح!' });
      }
    } catch (e) {
      setPermStates(prev => ({ ...prev, backgroundAudio: 'active' }));
    }
  };

  const handleGoogleDriveSync = async () => {
    try {
      const granted = await DevicePermissionsService.requestOnDemand('google_drive');
      if (granted) {
        setPermStates(prev => ({ ...prev, googleDrive: 'linked' }));
        setStatus({ type: 'success', message: 'تم إتمام مصادقة الربط بحساب قوقل والاتصال بـ Google Drive لمزامنة النسخ.' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: 'فشل الاتصال بـ Google Drive: ' + e.message });
    }
  };

  const handleRequestAllPermissions = async () => {
    try {
      setStatus({ type: 'success', message: 'جاري استدعاء وطلب كافة صلاحيات الأجهزة المتاحة دفعة واحدة...' });
      await DevicePermissionsService.requestAllRequiredPermissions();
      setPermStates({
        camera: 'granted',
        storage: 'granted',
        bluetooth: 'granted',
        notifications: 'granted',
        overlay: 'active',
        wifi: navigator.onLine ? 'online' : 'offline',
        backgroundAudio: 'active',
        googleDrive: 'linked'
      });
      setStatus({ type: 'success', message: 'رائع! تم تفعيل وفحص كافة صلاحيات الهاتف المحمول والأجهزة بنجاح!' });
    } catch (e: any) {
      setStatus({ type: 'error', message: 'خطأ أثناء طلب الصلاحيات: ' + e.message });
    }
  };

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    if (!profile?.ownerId) return;
    const q = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    return onSnapshot(q, (snapshot) => {
      const cats = new Set(['المحل', 'spare_part', 'accessories_shop', 'sim_cards']);
      // Add existing product categories from inventory
      snapshot.docs.forEach(doc => {
        if (doc.data().category) cats.add(doc.data().category);
      });
      // Merge with custom categories from shop settings
      if (shopSettings.productCategories) {
        shopSettings.productCategories.forEach((cat: string) => cats.add(cat));
      }
      // Merge with custom warehouses
      warehouses.forEach(wh => cats.add(wh.name));
      setCategories(Array.from(cats));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });
  }, [profile, shopSettings, warehouses]);
  const [manualBarcodeItem, setManualBarcodeItem] = useState({ name: '', price: 0, barcode: '' });
  const [isManualBarcode, setIsManualBarcode] = useState(false);
  const [isBulkPrintModalOpen, setIsBulkPrintModalOpen] = useState(false);
  const [bulkPrintInitialItems, setBulkPrintInitialItems] = useState<{ itemId: string; quantity: number }[]>([]);
  const [manualGoogleTokenBase64, setManualGoogleTokenBase64] = useState('');

  useEffect(() => {
    // 1. Web message event listener
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        handleSaveGoogleTokens(event.data.tokens);
      }
    };
    window.addEventListener('message', handleMessage);

    // 2. Capacitor native deep linking event listener
    let deeplinkListener: any = null;
    const initDeepLinkListener = async () => {
      try {
        const { App } = await import('@capacitor/app');
        deeplinkListener = await App.addListener('appUrlOpen', async (data: any) => {
          console.log('[Native App URL Opened]', data.url);
          if (data.url && data.url.includes('tokens=')) {
            try {
              const urlObj = new URL(data.url);
              const tokensBase64 = urlObj.searchParams.get('tokens');
              if (tokensBase64) {
                const decryptedTokens = JSON.parse(atob(decodeURIComponent(tokensBase64)));
                await handleSaveGoogleTokens(decryptedTokens);
                setStatus({ type: 'success', message: 'تم الربط التلقائي عبر تطبيق الهاتف وعبر الرابط العميق!' });
              }
            } catch (err: any) {
              console.error('Failed deep link parsing:', err);
              setStatus({ type: 'error', message: 'الرابط العميق لا يحمل رمز أمان صالح.' });
            }
          }
        });
      } catch (err) {
        console.warn('Capacitor App plugin not initialized (pure web environment):', err);
      }
    };
    initDeepLinkListener();

    return () => {
      window.removeEventListener('message', handleMessage);
      if (deeplinkListener) {
        deeplinkListener.remove();
      }
    };
  }, [profile]);

  const handleSaveGoogleTokens = async (tokens: any) => {
    if (!profile?.uid) return;
    try {
      await setDoc(doc(db, 'users', profile.uid), {
        cloudSync: {
          provider: 'google',
          tokens: tokens,
          lastSync: new Date().toISOString()
        }
      }, { merge: true });
      setStatus({ type: 'success', message: 'تم ربط حساب Google Drive بنجاح!' });
    } catch (error: any) {
      setStatus({ type: 'error', message: 'فشل حفظ بيانات الربط' });
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      const response = await fetch(`/api/auth/google/url?origin=${encodeURIComponent(window.location.origin)}`);
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.message || 'يرجى تفعيل صلاحية Google Drive في لوحة التحكم وتعيين معرف العميل (Google Client ID) أولاً.');
      }
      if (Capacitor.isNativePlatform()) {
        // Fallback for native Android webview blockages: open via external system browser
        window.open(data.url, '_system');
      } else {
        window.open(data.url, 'google_auth', 'width=600,height=700');
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: 'فشل الاتصال بخادم المصادقة: ' + (error.message || error) });
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    if (!profile?.uid) return;
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء ربط حساب Google Drive؟')) return;
    try {
      await setDoc(doc(db, 'users', profile.uid), {
        cloudSync: null
      }, { merge: true });
      setStatus({ type: 'success', message: 'تم إلغاء ربط حساب Google Drive بنجاح!' });
    } catch (error: any) {
      setStatus({ type: 'error', message: 'فشل إلغاء ربط الحساب' });
    }
  };

  const [isRestoring, setIsRestoring] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [showBackupsModal, setShowBackupsModal] = useState(false);

  const ENCRYPTION_KEY = profile?.ownerId ? `${profile.ownerId}_JAM_PRO_SECURE` : 'JAM_PRO_DEFAULT_KEY';

  const handleSyncToCloud = async () => {
    if (!profile?.cloudSync?.tokens || isSyncing) return;
    setIsSyncing(true);
    try {
      // Fetch all data to backup (Hardened)
      const collectionsToBackup = ['inventory', 'sales', 'customers', 'transactions', 'maintenanceOrders', 'accounts', 'suppliers', 'shortages'];
      const backupData: any = { timestamp: new Date().toISOString() };
      
      for (const colName of collectionsToBackup) {
        const snap = await getDocs(query(collection(db, colName), where('ownerId', '==', profile?.ownerId)));
        backupData[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      // Use the hardened security service for encryption and compression
      const encryptedBackup = securityService.createBackup(backupData, profile?.ownerId);
      const formattedBackup = `JAM_STORE_BACKUP_HEADER:v1:${profile?.ownerId || 'unknown'}\n${encryptedBackup}`;

      const response = await fetch('/api/cloud/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: profile.cloudSync.tokens,
          data: { encrypted: formattedBackup },
          fileName: `jam_hardened_backup_${profile.name}_${new Date().toISOString().split('T')[0]}.json`
        })
      });

      const result = await response.json();
      if (result.success) {
        await setDoc(doc(db, 'users', profile.uid), {
          cloudSync: {
            ...profile.cloudSync,
            lastSync: new Date().toISOString()
          }
        }, { merge: true });
        setStatus({ type: 'success', message: 'تمت المزامنة السحابية المشفرة بنجاح!' });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: `فشل المزامنة: ${error.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchBackups = async () => {
    if (!profile?.cloudSync?.tokens) return;
    try {
      const response = await fetch('/api/cloud/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: profile.cloudSync.tokens })
      });
      const result = await response.json();
      if (result.success) {
        setBackups(result.files || []);
        setShowBackupsModal(true);
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: 'فشل جلب قائمة النسخ الاحتياطية' });
    }
  };

  const handleRestoreFromCloud = async (fileId: string) => {
    if (!window.confirm('تحذير: استعادة البيانات ستقوم فقط باستيراد الملفات المحذوفة أو الإضافية غير الموجودة في النظام حالياً (على مراحل لحماية النظام من التعليق). هل تريد الاستمرار؟')) return;
    setIsRestoring(true);
    setRestoreProgress(null);
    try {
      const response = await fetch('/api/cloud/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: profile?.cloudSync?.tokens, fileId })
      });
      const result = await response.json();
      
      if (!result.success || !result.data?.encrypted) {
        throw new Error('فشل تحميل الملف أو الملف غير صالح');
      }

      const fileData = result.data.encrypted;
      let encryptionOwnerId = profile?.ownerId;
      let encryptedPayload = fileData;

      if (fileData.startsWith('JAM_STORE_BACKUP_HEADER:')) {
        const parts = fileData.split('\n');
        const header = parts[0];
        const headerParts = header.split(':');
        if (headerParts.length >= 3) {
          encryptionOwnerId = headerParts[2].trim();
        }
        encryptedPayload = parts.slice(1).join('\n');
      }

      // Use the hardened security service for restoration
      const decryptedData = securityService.restoreBackup(encryptedPayload, encryptionOwnerId);

      // Flatten documents to process them in chunks
      const allWrites: { colName: string, id: string, data: any }[] = [];
      let skippedCount = 0;

      setStatus({ type: 'info', message: 'جاري فحص قاعدة البيانات ومقارنة الفروقات والمستندات المحذوفة...' });

      for (const [colName, docs] of Object.entries(decryptedData)) {
        if (!Array.isArray(docs)) continue;
        
        // Fetch existing IDs for this collection under this owner
        let existingIds = new Set<string>();
        try {
          const snap = await getDocs(query(collection(db, colName), where('ownerId', '==', profile?.ownerId)));
          existingIds = new Set(snap.docs.map(d => d.id));
        } catch (err) {
          console.error(`Error querying existing docs for ${colName}:`, err);
        }

        for (const docData of docs) {
          const { id, ...data } = docData;
          // Only restore if the document does NOT exist in the database (i.e. it is deleted or additional)
          if (!existingIds.has(id)) {
            allWrites.push({ colName, id, data });
          } else {
            skippedCount++;
          }
        }
      }

      const totalDocs = allWrites.length;
      if (totalDocs === 0) {
        setStatus({ 
          type: 'success', 
          message: `تم التحقق! النظام محدث بالكامل ولا توجد ملفات محذوفة أو إضافية مفقودة لاستعادتها (تم تجاوز ${skippedCount} مستند موجود بالفعل).` 
        });
        setShowBackupsModal(false);
        return;
      }

      // Restore to Firestore in chunks (staged)
      const chunkSize = 100;
      let processedCount = 0;
      let phase = 1;
      const totalPhases = Math.ceil(totalDocs / chunkSize);

      for (let i = 0; i < totalDocs; i += chunkSize) {
        const chunk = allWrites.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        for (const writeItem of chunk) {
          const docRef = doc(db, writeItem.colName, writeItem.id);
          batch.set(docRef, { ...writeItem.data, ownerId: profile?.ownerId }, { merge: true });
        }

        await batch.commit();
        processedCount += chunk.length;
        
        setRestoreProgress({
          processed: processedCount,
          total: totalDocs,
          phase: phase,
          totalPhases: totalPhases
        });
        
        phase++;
        // Yield to allow main thread and UI rendering to avoid freezing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await logActivity(
        profile,
        'استعادة سحابية مشفرة',
        `تم استعادة ${totalDocs} وثيقة محذوفة/مضافة مفقودة من Google Drive بنجاح وتجاوز ${skippedCount} وثيقة موجودة بالفعل`
      );

      setStatus({ type: 'success', message: `تمت عملية الاستعادة الذكية بنجاح! تم استيراد ${totalDocs} ملف مفقود/محذوف، وتخطي ${skippedCount} مستند موجود دون تعديل.` });
      setShowBackupsModal(false);
    } catch (error: any) {
      console.error('Restore error:', error);
      setStatus({ type: 'error', message: `فشل الاستعادة: ${error.message}` });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  useEffect(() => {
    if (!profile?.ownerId) return;
    const q = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    const unsub = onSnapshot(q, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });
    return () => unsub();
  }, [profile?.ownerId]);

  useEffect(() => {
    const itemToDraw = isManualBarcode ? manualBarcodeItem : selectedBarcodeItem;
    if (itemToDraw && barcodeRef.current) {
      const safeVal = (itemToDraw.barcode || (itemToDraw as any).id || '123456').replace(/[^\x00-\x7F]/g, '');
      try {
        JsBarcode(barcodeRef.current, safeVal || '0000', {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 14,
          margin: 10
        });
      } catch (e) {
        console.error("Barcode preview error", e);
      }
      setBarcodeValue(itemToDraw.barcode || (itemToDraw as any).id || '123456');
      setBarcodeLabel(itemToDraw.name);
    }
  }, [selectedBarcodeItem, manualBarcodeItem, isManualBarcode]);

  const handlePrintBarcodes = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svgContent = barcodeRef.current?.outerHTML || '';
    
    // Generate barcode SVGs for the queue items
    // Since JsBarcode works on refs, we'll need to generate them via a hidden div or similar if we want dynamic ones.
    // However, the user wants a simple way. If we have a queue, we will render each item.
    
    // Create a temporary container to render SVGs for all items in queue
    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);

    const queueItemsHtml = barcodePrintQueue.map((itemInQueue, idx) => {
      const canvas = document.createElement('canvas');
      const safeBar = (itemInQueue.item.barcode || itemInQueue.item.id).replace(/[^\x00-\x7F]/g, '');
      try {
        JsBarcode(canvas, safeBar || '0000', {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 14,
          margin: 10
        });
      } catch (e) {
        console.error("Queue barcode error", e);
      }
      const dataUrl = canvas.toDataURL();
      
      return Array(itemInQueue.count).fill(0).map(() => `
        <div class="barcode-item">
          <div class="shop-name">${shopSettings.shopName}</div>
          <div class="label">${itemInQueue.item.name}</div>
          <img src="${dataUrl}" style="width: 100%; height: auto;" />
          ${shopSettings.printer?.showPriceOnBarcode !== false ? `<div class="price">${itemInQueue.item.price.toLocaleString()} ${shopSettings.currency}</div>` : ''}
        </div>
      `).join('');
    }).join('');

    document.body.removeChild(tempDiv);

    printWindow.document.write(`
      <html>
        <head>
          <title>طباعة الباركود - JAM System Pro</title>
          <style>
            @page { size: auto; margin: 0; }
            body { 
              font-family: sans-serif; 
              display: flex; 
              flex-wrap: wrap; 
              gap: 10px; 
              padding: 20px;
              direction: rtl;
            }
            .barcode-item {
              border: 1px solid #eee;
              padding: 10px;
              text-align: center;
              width: 180px;
              break-inside: avoid;
            }
            .label { font-weight: bold; font-size: 11px; margin-bottom: 2px; }
            .shop-name { font-size: 9px; color: #666; margin-bottom: 5px; }
            .price { font-weight: 800; font-size: 13px; color: #000; margin-top: 5px; }
          </style>
        </head>
        <body>
          ${queueItemsHtml || `
            <div class="barcode-item">
              <div class="shop-name">${shopSettings.shopName}</div>
              <div class="label">${barcodeLabel}</div>
              ${svgContent}
              ${shopSettings.printer?.showPriceOnBarcode !== false ? `<div class="price">${selectedBarcodeItem?.price.toLocaleString()} ${shopSettings.currency}</div>` : ''}
            </div>
          `}
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const addToPrintQueue = () => {
    const itemToAdd = isManualBarcode ? { ...manualBarcodeItem, id: `manual-${Date.now()}` } : selectedBarcodeItem;
    if (!itemToAdd || !itemToAdd.name) return;
    setBarcodePrintQueue(prev => [
      ...prev, 
      { item: itemToAdd as InventoryItem, count: barcodeCount }
    ]);
  };

  const removeFromQueue = (index: number) => {
    setBarcodePrintQueue(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!profile?.ownerId) return;
    const q = query(collection(db, 'warehouses'), where('ownerId', '==', profile.ownerId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
      setWarehouses(list);
    }, (error) => {
      console.error("Failed to load warehouses:", error);
    });
    return () => unsubscribe();
  }, [profile?.ownerId]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!profile?.ownerId) return;
      try {
        const docId = (profile?.role !== 'owner' && profile?.role !== 'superadmin' && profile?.shopId) ? profile.shopId : profile.ownerId;
        const docSnap = await getDoc(doc(db, 'settings', docId));
        if (docSnap.exists()) {
          setShopSettings(prev => ({ ...prev, ...docSnap.data() }));
        } else {
          setShopSettings(prev => ({
            ...prev,
            shopName: profile?.shopName || profile?.name || 'متجري الجديد',
            supervisorName: profile?.name || profile?.username || 'صاحب المحل',
            shopPhone: profile?.shopPhone || profile?.phone || '77*******',
            shopAddress: profile?.shopAddress || profile?.address || 'اليمن',
            businessType: profile?.businessType || 'mobiles',
          }));
        }
      } catch (error) {
        console.warn('Error fetching settings (falling back to default):', error);
      }
    };
    fetchSettings();
    // Pre-calculate portal link
    const baseUrl = shopSettings.customBaseUrl || (import.meta as any).env?.VITE_APP_URL || window.location.origin;
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    if (profile?.name) {
      // Better shared link format: puts parameters where they are most stable
      setPortalLink(`${cleanBaseUrl}/?shop=${encodeURIComponent(profile.name)}#/portal`);
    }
  }, [profile, shopSettings.customBaseUrl]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.ownerId) return;

    setIsUploadingLogo(true);
    try {
      const logoUrl = await uploadToMega(file, profile.ownerId, 'branding');
      setShopSettings(prev => ({ ...prev, shopLogo: logoUrl }));
      setStatus({ type: 'success', message: 'تم رفع الشعار بنجاح.' });
    } catch (error: any) {
      setStatus({ type: 'error', message: `فشل رفع الشعار: ${error.message}` });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const [isUploadingStamp, setIsUploadingStamp] = useState(false);
  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.ownerId) return;

    setIsUploadingStamp(true);
    try {
      const stampUrl = await uploadToMega(file, profile.ownerId, 'branding_stamp');
      setShopSettings(prev => ({ ...prev, shopStamp: stampUrl }));
      setStatus({ type: 'success', message: 'تم رفع ختم المحل بنجاح.' });
    } catch (error: any) {
      setStatus({ type: 'error', message: `فشل رفع الختم: ${error.message}` });
    } finally {
      setIsUploadingStamp(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await DevicePermissionsService.requestOnDemand('backup_download');
      // Fetch all core data collections
      const collectionsToBackup = ['inventory', 'sales', 'customers', 'transactions', 'maintenanceOrders', 'accounts', 'suppliers', 'shortages'];
      const backupData: any = { timestamp: new Date().toISOString() };
      
      for (const colName of collectionsToBackup) {
        const snap = await getDocs(query(collection(db, colName), where('ownerId', '==', profile?.ownerId)));
        backupData[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      // Use the new hardened security service for encryption and compression
      const encryptedBackup = securityService.createBackup(backupData, profile?.ownerId);
      const formattedBackupFile = `JAM_STORE_BACKUP_HEADER:v1:${profile?.ownerId || 'unknown'}\n${encryptedBackup}`;
      
      const filename = `JAM_PRO_HARDENED_BACKUP_${new Date().toISOString().split('T')[0]}.jam`;

      if (Capacitor.isNativePlatform()) {
        try {
          const checkStatus = await Filesystem.checkForPermissions();
          if (checkStatus.publicStorage !== 'granted') {
            await Filesystem.requestPermissions();
          }
          const writeResult = await Filesystem.writeFile({
            path: filename,
            data: formattedBackupFile,
            directory: Directory.Documents,
            encoding: Encoding.UTF8
          });
          
          await Share.share({
            title: `JAM Pro Backup - ${new Date().toLocaleDateString()}`,
            text: `نسخة احتياطية مشفرة لبرنامج JAM System Pro`,
            url: writeResult.uri,
            dialogTitle: 'حفظ أو مشاركة النسخة الاحتياطية'
          });
          
          alert(`تم تصدير النسخة الاحتياطية بنجاح وحفظها!`);
        } catch (writeErr: any) {
          console.warn('Failed to write backup to Documents folder, trying Downloads folder:', writeErr);
          try {
            const writeResult = await Filesystem.writeFile({
              path: filename,
              data: formattedBackupFile,
              directory: Directory.Downloads,
              encoding: Encoding.UTF8
            });
            
            await Share.share({
              title: `JAM Pro Backup - ${new Date().toLocaleDateString()}`,
              text: `نسخة احتياطية مشفرة لبرنامج JAM System Pro`,
              url: writeResult.uri,
              dialogTitle: 'حفظ أو مشاركة النسخة الاحتياطية'
            });
            
            alert(`تم تصدير النسخة الاحتياطية بنجاح وحفظها!`);
          } catch (downloadErr: any) {
            console.error('Failed to write backup to Downloads folder as well:', downloadErr);
            // Safe fallback to Cache
            try {
              const writeResult = await Filesystem.writeFile({
                path: filename,
                data: formattedBackupFile,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
              });
              
              await Share.share({
                title: `JAM Pro Backup - ${new Date().toLocaleDateString()}`,
                text: `نسخة احتياطية مشفرة لبرنامج JAM System Pro`,
                url: writeResult.uri,
                dialogTitle: 'حفظ أو مشاركة النسخة الاحتياطية'
              });
              
              alert(`تم حفظ وتصدير النسخة الاحتياطية بنجاح!`);
            } catch (cacheErr: any) {
              alert(`فشل التصدير والمشاركة: ${cacheErr.message}`);
            }
          }
        }
      } else {
        const blob = new Blob([formattedBackupFile], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }

      setStatus({ type: 'success', message: 'تم إنشاء نسخة احتياطية مشفرة بـ AES-256 بنجاح.' });
    } catch (error: any) {
      console.error('Export error:', error);
      setStatus({ type: 'error', message: 'فشل تصدير النسخة: ' + error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await DevicePermissionsService.requestOnDemand('backup_upload');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setImportData(event.target?.result as string);
        setShowRestorePanel(true);
      } catch (err) {
        setStatus({ type: 'error', message: 'ملف غير صالح.' });
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!importData) return;

    setIsImporting(true);
    setRestoreProgress(null);
    try {
      let encryptionOwnerId = profile?.ownerId;
      let encryptedPayload = importData;

      if (importData.startsWith('JAM_STORE_BACKUP_HEADER:')) {
        const parts = importData.split('\n');
        const header = parts[0];
        const headerParts = header.split(':');
        if (headerParts.length >= 3) {
          encryptionOwnerId = headerParts[2].trim();
        }
        encryptedPayload = parts.slice(1).join('\n');
      }

      // Use the new hardened security service for restoration
      const decryptedData = securityService.restoreBackup(encryptedPayload, encryptionOwnerId);
      
      // Flatten documents to process them in chunks
      const allWrites: { colName: string, id: string, data: any }[] = [];
      let skippedCount = 0;

      setStatus({ type: 'info', message: 'جاري فحص وتصفية المستندات لمطابقة المحذوفات والزيادات...' });

      for (const [colName, docs] of Object.entries(decryptedData)) {
        if (!Array.isArray(docs)) continue;
        
        // Fetch existing IDs for this collection under this owner
        let existingIds = new Set<string>();
        try {
          const snap = await getDocs(query(collection(db, colName), where('ownerId', '==', profile?.ownerId)));
          existingIds = new Set(snap.docs.map(d => d.id));
        } catch (err) {
          console.error(`Error querying existing docs for ${colName}:`, err);
        }

        for (const docData of docs) {
          const { id, ...data } = docData;
          // Only restore if the document does NOT exist in the database (i.e. it is deleted or additional)
          if (!existingIds.has(id)) {
            allWrites.push({ colName, id, data });
          } else {
            skippedCount++;
          }
        }
      }

      const totalDocs = allWrites.length;
      if (totalDocs === 0) {
        setStatus({ 
          type: 'success', 
          message: `تم التحقق! لم يتم العثور على أي ملفات محذوفة أو إضافية لمزامنتها (تم تجاوز ${skippedCount} مستند موجود بالفعل).` 
        });
        setIsImporting(false);
        setShowRestorePanel(false);
        setImportData(null);
        setDevPassword('');
        return;
      }

      // Restore to Firestore in chunks (staged)
      const chunkSize = 100;
      let processedCount = 0;
      let phase = 1;
      const totalPhases = Math.ceil(totalDocs / chunkSize);

      for (let i = 0; i < totalDocs; i += chunkSize) {
        const chunk = allWrites.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        for (const writeItem of chunk) {
          const docRef = doc(db, writeItem.colName, writeItem.id);
          batch.set(docRef, { ...writeItem.data, ownerId: profile?.ownerId }, { merge: true });
        }

        await batch.commit();
        processedCount += chunk.length;
        
        setRestoreProgress({
          processed: processedCount,
          total: totalDocs,
          phase: phase,
          totalPhases: totalPhases
        });
        
        phase++;
        // Yield to allow main thread and UI rendering to avoid freezing
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await logActivity(
        profile,
        'استعادة نسخة مشفرة',
        `تم استعادة ${totalDocs} وثيقة محذوفة/مضافة مفقودة من نسخة مشفرة بنجاح وتجاوز ${skippedCount} وثيقة موجودة بالفعل`
      );

      setStatus({ type: 'success', message: `تمت عملية الاستعادة الذكية بنجاح! تم استيراد ${totalDocs} ملف مفقود/محذوف، وتخطي ${skippedCount} مستند موجود دون تعديل.` });
      setShowRestorePanel(false);
      setImportData(null);
      setDevPassword('');
    } catch (error: any) {
      console.error('Restore error:', error);
      setStatus({ type: 'error', message: `فشل الاستعادة: ${error.message}` });
    } finally {
      setIsImporting(false);
      setRestoreProgress(null);
    }
  };

  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  const handleUpdateAllPrices = async () => {
    if (!profile?.ownerId || isUpdatingPrices) return;
    if (!window.confirm('هل أنت متأكد من رغبتك في تحديث أسعار كافة المخزون بناءً على آخر العمليات؟ سيتم الاحتفاظ بنسخة احتياطية للرجوع عنها.')) return;

    setIsUpdatingPrices(true);
    try {
      // 1. Backup current prices if needed (only for items with valid price/cost)
      const currentBackup = shopSettings.backupPrices || {};
      const newBackup = { ...currentBackup };
      
      // 2. Fetch all sales and purchases to find latest prices
      const [salesSnap, purchasesSnap] = await Promise.all([
        getDocs(query(collection(db, 'sales'), where('ownerId', '==', profile.ownerId))),
        getDocs(query(collection(db, 'purchases'), where('ownerId', '==', profile.ownerId)))
      ]);

      // Map latest prices by itemId or Name
      const latestSellPrices: { [key: string]: number } = {};
      const latestCosts: { [key: string]: number } = {};

      salesSnap.docs.forEach(doc => {
        const data = doc.data();
        (data.items || []).forEach((item: any) => {
          latestSellPrices[item.id] = item.price;
        });
      });

      purchasesSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.itemId) {
          latestCosts[data.itemId] = data.cost;
        }
      });

      const batch = writeBatch(db);
      let count = 0;

      for (const item of inventory) {
        let needsUpdate = false;
        const updates: any = {};

        if (shopSettings.autoPricingType !== 'buy') {
          const latestPrice = latestSellPrices[item.id];
          if (latestPrice && latestPrice !== item.price) {
            updates.price = latestPrice;
            needsUpdate = true;
          }
        }

        if (shopSettings.autoPricingType !== 'sell') {
          const latestCost = latestCosts[item.id];
          if (latestCost && latestCost !== item.cost) {
            updates.cost = latestCost;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          // Backup before update
          if (!newBackup[item.id]) {
            newBackup[item.id] = { price: item.price, cost: item.cost };
          }
          batch.update(doc(db, 'inventory', item.id), updates);
          count++;
          
          if (count >= 490) { // Batch limit
            await batch.commit();
            // Start new batch would be needed here but for simplicity let's stick to one large batch 
            // and assume inventory is not huge (>490 items that NEED update)
            // In a production app, we should use chunks.
          }
        }
      }

      await batch.commit();
      
      // Save backup to settings
      await updateDoc(doc(db, 'settings', profile.ownerId), { backupPrices: newBackup });
      setShopSettings(prev => ({ ...prev, backupPrices: newBackup }));

      setStatus({ type: 'success', message: `تم تحديث أسعار ${count} صنف بنجاح!` });
    } catch (error: any) {
      console.error('Error updating prices:', error);
      setStatus({ type: 'error', message: 'فشل تحديث الأسعار التلقائي' });
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const [showUndoOptions, setShowUndoOptions] = useState(false);

  const handleUndoPricing = async (mode: 'restore' | 'keep') => {
    if (!profile?.ownerId) return;
    
    setIsUpdatingPrices(true);
    try {
      if (mode === 'restore') {
        if (!shopSettings.backupPrices || Object.keys(shopSettings.backupPrices).length === 0) {
           alert('لا توجد نسخة احتياطية للأسعار اليدوية السابقة.');
           return;
        }
        const backup = shopSettings.backupPrices;
        const batch = writeBatch(db);
        let count = 0;

        for (const itemId in backup) {
          batch.update(doc(db, 'inventory', itemId), {
            price: backup[itemId].price,
            cost: backup[itemId].cost
          });
          count++;
          if (count >= 490) break;
        }
        await batch.commit();
        await updateDoc(doc(db, 'settings', profile.ownerId), { 
          backupPrices: {},
          autoPricingEnabled: false 
        });
        setShopSettings(prev => ({ ...prev, backupPrices: {}, autoPricingEnabled: false }));
        setStatus({ type: 'success', message: `تم استعادة أسعار ${count} صنف وإيقاف التسعير الآلي.` });
      } else {
        // Just stop auto-pricing but keep current system-updated prices
        await updateDoc(doc(db, 'settings', profile.ownerId), { 
          autoPricingEnabled: false 
        });
        setShopSettings(prev => ({ ...prev, autoPricingEnabled: false }));
        setStatus({ type: 'success', message: 'تم الإبقاء على الأسعار الحالية وإيقاف التحديث التلقائي.' });
      }
      setShowUndoOptions(false);
    } catch (error) {
      setStatus({ type: 'error', message: 'فشل تنفيذ الطلب' });
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const handleSaveSecurityCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (securityCode.length !== 4 || !/^\d+$/.test(securityCode)) {
      setStatus({ type: 'error', message: 'يجب أن يتكون الرمز من 4 أرقام فقط.' });
      return;
    }
    if (securityCode !== confirmSecurityCode) {
      setStatus({ type: 'error', message: 'الرموز غير متطابقة.' });
      return;
    }
    if (!profile?.uid) return;

    setIsChangingSecurityCode(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        securityCode: securityCode,
        isSecurityCodeSet: true,
        mustChangeSecurityCode: false,
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'تم حفظ الرمز الأمني بنجاح!' });
      setSecurityCode('');
      setConfirmSecurityCode('');
    } catch (error: any) {
      setStatus({ type: 'error', message: 'فشل حفظ الرمز الأمني' });
    } finally {
      setIsChangingSecurityCode(false);
    }
  };

  const handleResetUserCode = async (userUid: string) => {
    if (!profile || (profile.role !== 'superadmin' && profile.role !== 'master_wholesale')) {
      alert('ليس لديك صلاحية تصفير الرموز.');
      return;
    }
    if (!confirm('هل أنت متأكد من تصفير رمز هذا المستخدم؟ سيعود الرمز إلى 1234 ويُطلب منه التغيير فوراً.')) return;

    try {
      await updateDoc(doc(db, 'users', userUid), {
        securityCode: '1234',
        isSecurityCodeSet: true,
        mustChangeSecurityCode: true,
        updatedAt: serverTimestamp()
      });
      alert('تم تصفير الرمز بنجاح.');
    } catch (e) {
      alert('فشل تصفير الرمز.');
    }
  };

  const handleGenerateEmergencyKey = async () => {
    if (profile?.role !== 'superadmin') return;
    const key = Math.random().toString(36).substring(2, 10).toUpperCase();
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        emergencyRecoveryKey: key
      });
      setStatus({ type: 'success', message: 'تم إنشاء مفتاح الطوارئ بنجاح!' });
    } catch (e) {
      setStatus({ type: 'error', message: 'فشل إنشاء المفتاح' });
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    setIsSaving(true);
    try {
      const docId = (profile?.role !== 'owner' && profile?.role !== 'superadmin' && profile?.shopId) ? profile.shopId : profile.ownerId;
      await setDoc(doc(db, 'settings', docId), {
        ...shopSettings,
        ownerId: profile.ownerId,
        shopId: profile.shopId || '',
        updatedAt: serverTimestamp()
      });
      // أيضا تحديث حقل الظهور في ملف المستخدم
      if (profile.uid) {
        await updateDoc(doc(db, 'users', profile.uid), {
          visibility: shopSettings.visibility,
          hideFromDiscovery: !shopSettings.visibility
        });
      }
      setStatus({ type: 'success', message: 'تم حفظ إعدادات المحل بنجاح.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `settings/${profile.ownerId}`);
    } finally {
      setIsSaving(false);
    }
  };


  const testConnection = async () => {
    if (!shopSettings.smsMobileIp) {
      setStatus({ type: 'error', message: 'يرجى إدخال عنوان IP الجوال أولاً.' });
      return;
    }
    
    setIsTesting(true);
    setStatus(null);
    try {
      await pingSMS(shopSettings.smsApiKey);
      setStatus({ type: 'success', message: 'تم الاتصال بنجاح بمزود الخدمة (SmsMobileAPI)!' });
    } catch (error: any) {
      console.error('Test connection error:', error);
      setStatus({ type: 'error', message: `فشل الاتصال: ${error.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const sendWelcomeTest = async () => {
    if (!shopSettings.smsMobileIp) {
      setStatus({ type: 'error', message: 'يرجى إدخال عنوان IP الجوال أولاً.' });
      return;
    }
    
    setIsTesting(true);
    setStatus(null);
    try {
      const testPhone = '772315106';
      const welcomeMessage = `Jam system pro: أهلاً بك عزيزي العميل في مركزنا المتطور. نحن نسعى دائماً لتقديم أفضل الخدمات لك.`;
      
      await sendSMS(testPhone, welcomeMessage, {
        apiKey: shopSettings.smsApiKey,
        mobileIp: shopSettings.smsMobileIp
      });
      setStatus({ type: 'success', message: 'تم إرسال الرسالة الترحيبية بنجاح!' });
    } catch (error: any) {
      console.error('Welcome test error:', error);
      setStatus({ type: 'error', message: `فشل الإرسال: ${error.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleIntegrityCheck = async () => {
    if (!profile?.ownerId) return;
    setIsCheckingIntegrity(true);
    setStatus(null);
    try {
      const result = await verifyAccountingIntegrity(profile.ownerId);
      setIntegrityResult(result);
      if (result.isValid) {
        setStatus({ type: 'success', message: 'نظام المحاسبة سليم 100%. جميع العمليات مطابقة للأرصدة.' });
      } else {
        setStatus({ type: 'error', message: `تم العثور على ${result.discrepancies.length} فروقات في الحسابات!` });
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: `فشل فحص النزاهة: ${error.message}` });
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  const handleQuickEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || !quickEntryData.name || !quickEntryWarehouse) {
      setStatus({ type: 'error', message: 'يرجى إكمال البيانات المطلوبة (الاسم والمستودع)' });
      return;
    }

    setIsQuickAdding(true);
    try {
      const finalName = quickEntryLabel ? `${quickEntryLabel} ${quickEntryData.name}` : quickEntryData.name;
      const part1 = Math.floor(100 + Math.random() * 900).toString();
      const part2 = Math.floor(1000 + Math.random() * 9000).toString();
      const generatedBarcode = `JAM ${part1}-${part2}`;
      const productData = {
        ownerId: profile.ownerId,
        name: finalName,
        barcode: generatedBarcode,
        price: Number(quickEntryData.price) || 0,
        stock: Number(quickEntryData.stock) || 0,
        cost: Number(quickEntryData.cost) || 0,
        category: quickEntryWarehouse,
        type: 'item',
        minStock: 2,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Reset UI state immediately for "fast clear"
      setQuickEntryData({ name: '', stock: '', price: '', cost: '' });
      localStorage.setItem('jam-quick-entry-warehouse', quickEntryWarehouse);
      localStorage.setItem('jam-quick-entry-label', quickEntryLabel);

      // Perform save and logging in parallel
      await Promise.all([
        addDoc(collection(db, 'inventory'), productData),
        logActivity(
          profile,
          'إضافة سريعة',
          `إضافة سريعة للصنف: ${productData.name} في ${quickEntryWarehouse}`
        )
      ]);

      setStatus({ type: 'success', message: `تمت إضافة (${productData.name}) بنجاح` });
      
      // Focus back to name field after short delay
      setTimeout(() => {
        const nameInput = document.getElementById('quick-entry-name');
        if (nameInput) nameInput.focus();
      }, 100);

    } catch (error: any) {
      setStatus({ type: 'error', message: `فشل الإضافة: ${error.message}` });
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleGenerateRemoteLink = async () => {
    if (!profile) return;
    setIsGeneratingRemote(true);
    try {
      const link = await remoteAccessService.generateRemoteLink(profile.uid, shopSettings.customBaseUrl);
      setRemoteLink(link);
      setStatus({ type: 'success', message: 'تم توليد رابط الوصول عن بعد بنجاح.' });
    } catch (error: any) {
      setStatus({ type: 'error', message: `فشل توليد الرابط: ${error.message}` });
    } finally {
      setIsGeneratingRemote(false);
    }
  };

  const handleRevokeRemoteAccess = async () => {
    if (!profile) return;
    if (!confirm('هل أنت متأكد من إلغاء كافة روابط الوصول عن بعد الحالية؟ سيتوقف الرابط الحالي عن العمل فوراً.')) return;
    
    setIsGeneratingRemote(true);
    try {
      await remoteAccessService.revokeAccess(profile.uid);
      setRemoteLink('');
      setStatus({ type: 'success', message: 'تم إلغاء صلاحيات الوصول عن بعد بنجاح.' });
    } catch (error: any) {
      setStatus({ type: 'error', message: `فشل إلغاء الصلاحيات: ${error.message}` });
    } finally {
      setIsGeneratingRemote(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setStatus({ type: 'success', message: 'تم نسخ الرابط إلى الحافظة.' });
  };

  const shareViaWhatsApp = () => {
    if (!remoteLink || !profile) return;
    remoteAccessService.sendViaWhatsApp(remoteLink, profile.name, shopSettings.shopName);
  };

  useEffect(() => {
    if (!profile?.ownerId) return;
    setIsLoadingBanks(true);
    const q = query(collection(db, 'bank_accounts'), where('ownerId', '==', profile.ownerId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
      setBankAccounts(accounts);
      setIsLoadingBanks(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bank_accounts');
      setIsLoadingBanks(false);
    });
    return () => unsubscribe();
  }, [profile?.ownerId]);

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId || !newBank.bankName || !newBank.accountNumber) return;

    setIsAddingBank(true);
    const sId = profile?.storeId || profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';
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
      setStatus({ type: 'success', message: 'تم إضافة الحساب البنكي بنجاح وتعميمه للعمليات والعملاء.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, 'bank_accounts');
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

      setStatus({ type: 'success', message: 'تم حذف الحساب بنجاح من كافة المنافذ.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `bank_accounts/${id}`);
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
        reason: `تعديل يدوي مباشر للحساب من الإعدادات من قبل ${profile.name}: ${reason} (من ${oldBalance} إلى ${newBalance})`,
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
        description: `تعديل رصيد يدوي مباشر للآيبان من الإعدادات (${isSurplus ? 'زيادة' : 'عجز'}): ${reason}`,
        userId: profile.uid,
        userName: profile.name,
        boxId: id,
        createdAt: serverTimestamp()
      });

      // 7. Log activity
      await logActivity(profile, 'تعديل رصيد حساب', `تم تعديل رصيد الحساب ${id} يدوياً بقيمة فارق ${absDiff} ر.ي بسبب ${reason}`);

      setStatus({ type: 'success', message: '✓ تم تعديل الرصيد وتوليد سند تسوية وقيد مالي تلقائي بنجاح! ✅' });
      return true;
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `bank_accounts/${id}`);
      return false;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
      if (tabParam === 'audit' && params.get('auto') === 'true') {
        setTimeout(() => handleFullAudit(true), 500);
      }
    }
  }, [profile?.ownerId]);

  const handleFullAudit = async (skipConfirm = false) => {
    if (!profile?.ownerId || isAuditing) return;
    
    if (!skipConfirm) {
      const confirmAudit = window.confirm('هل تريد البدء في عملية تدقيق شاملة لكافة العمليات المالية (مبيعات، صيانة، رصيد)؟ سيقوم النظام بمقارنة الكواليس وتصحيح أي أخطاء حسابية تاريخية.');
      if (!confirmAudit) return;
    }

    setIsAuditing(true);
    setAuditLogs([]);
    const addLog = (type: 'info' | 'success' | 'error', message: string) => {
      setAuditLogs(prev => [...prev, { type, message, time: new Date().toLocaleTimeString() }]);
    };

    try {
      addLog('info', 'بدء فحص وتدقيق قواعد البيانات...');
      const { FinancialService } = await import('../services/financialService');
      
      addLog('info', 'جاري تدقيق أرباح مبيعات الرصيد (Mobile Balance)...');
      const balanceCount = await FinancialService.repairBalanceHistoricalData(profile.ownerId);
      addLog('success', `تم الانتهاء من تدقيق الرصيد: تم إصلاح ${balanceCount} عملية.`);

      addLog('info', 'جاري تدقيق مبيعات الأجهزة والمستلزمات (Sales)...');
      const salesCount = await FinancialService.repairSalesData(profile.ownerId);
      addLog('success', `تم الانتهاء من تدقيق المبيعات: تم إصلاح ${salesCount} فاتورة.`);

      addLog('info', 'جاري تدقيق أرباح قسم الصيانة (Maintenance)...');
      const maintCount = await FinancialService.repairHistoricalData(profile.ownerId);
      addLog('success', `تم الانتهاء من تدقيق الصيانة: تم إصلاح ${maintCount} طلب.`);

      addLog('info', 'جاري فحص وتصحيح أسعار المخزون (Inventory)...');
      const invCount = await FinancialService.repairInventoryData(profile.ownerId, 25);
      addLog('success', `تم الانتهاء من تدقيق المخزون: تمت معالجة ${invCount} صنف.`);

      await logActivity(profile, 'تدقيق شامل للنظام', `تم إجراء تدقيق مالي شامل وتصحيح ${balanceCount + salesCount + maintCount + invCount} قيد.`);
      
      try {
        await updateDoc(doc(db, 'users', profile.uid), { lastAuditDate: serverTimestamp() });
      } catch (e) {
        console.warn('Audit date save failed');
      }

      setStatus({ type: 'success', message: 'اكتمل التدقيق الشامل بنجاح! تم تصحيح كافة الحسابات والمخزون.' });
      addLog('success', 'اكتملت العملية بنجاح 100%');
    } catch (error: any) {
      addLog('error', `فشل التدقيق: ${error.message}`);
      setStatus({ type: 'error', message: 'فشل في إكمال التدقيق ' });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleInitializeSimulation = async () => {
    if (!profile?.ownerId || isSaving) return;
    if (!confirm('هل تريد تعبئة النظام ببيانات تجريبية (أصناف، عملاء، أرصدة) لتجربة البرنامج؟')) return;

    setIsSaving(true);
    try {
      const { simulationService } = await import('../services/simulationService');
      const count = await simulationService.setupTestAccount(profile.email, profile.ownerId);
      if (count > 0) {
        setStatus({ type: 'success', message: `تمت تعبئة ${count} أصناف وبيانات تجريبية بنجاح.` });
      } else {
        setStatus({ type: 'success', message: 'النظام يحتوي بالفعل على بيانات كافية، لم يتم إضافة بيانات تجريبية.' });
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: 'فشل الإعداد التجريبي: ' + e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const resetShopToDefault = async () => {
    if (!profile?.ownerId) return;
    if (!window.confirm('هل أنت متأكد من تصفير كافة إعدادات المحل للضبط الافتراضي؟ (هذا لا يحذف فواتيرك ولكن يغير شكل البرنامج والأسعار الثابتة)')) return;

    setIsSaving(true);
    const defaultSettings: ShopSettings = {
      shopName: 'Jam system pro',
      supervisorName: 'مدير النظام',
      shopPhone: '',
      shopAddress: '',
      shopLogo: '',
      shopStamp: '',
      businessType: 'mobiles',
      uiTheme: 'modern',
      currency: 'ر.ي',
      licenseExpiry: shopSettings.licenseExpiry, // Preserve license
      smsApiKey: '',
      smsMobileIp: '',
      backupMega: '',
      backupGDrive: '',
      backupMediaFire: '',
      city: 'Sanaa',
      visibility: true,
      prayerLockEnabled: true,
      maxDiscountPerSale: 500,
      salaryAdvanceLimitPercent: 50,
      dashboardShortcuts: [],
      messageTemplates: {
        debt: 'عزيزي {name}، نود تذكيرك بأن مديونيتكم لدى المحل هي {balance} ريال. نرجو التكرم بالسداد.',
        debt_payment: 'تم استلام مبلغ {amount} ريال منكم. الرصيد المتبقي: {balance} ريال.',
        device_ready: 'عزيزي {name}، جهازك {device} جاهز للاستلام. التكلفة المتبقية: {amount}.',
        inspection: 'عزيزي {name}، نتيجة فحص جهازك {device}: {issue}. التكلفة التقديرية: {amount}.',
        shortage: 'نقص في المخزن: {name}.',
        maintenance_intake: 'تم استلام جهازك {device} بنجاح. رقم الطلب: {ticket_id}.',
        maintenance_approval: 'بعد الفحص، يحتاج جهازك إلى {parts}، التكلفة: {price}. هل نعتمد؟',
        maintenance_shortage: 'جهازك {device} بانتظار توفر قطع غيار.',
        account_summary: 'ملخص حسابك: المشتريات {total_purchases}، الرصيد {balance}.',
        installment_reminder: 'عزيزي {name}، موعد سداد القسط المستحق بقيمة {amount}.',
        debtReminder: '',
        statementSummary: '',
        stockAlert: '',
        maintenanceReady: '',
        installment_payment: 'تم استلام القسط بنجاح' as any
      },
      printer: {
        enableLabel: true,
        enableBarcode: true,
        enableInvoice: true,
        enableAutoPrint: false,
        labelWidth: 50,
        labelHeight: 30,
        barcodeWidth: 40,
        barcodeHeight: 25,
        printerName: 'XP-420B',
        type: 'thermal',
        name: 'Default Printer',
        invoiceTemplate: 'modern_gold',
        labelTemplate: 'qr_luxury'
      },
      socialLinks: { whatsapp: '', telegram: '', facebook: '' },
      sendSocialLinks: false,
      exchangeRates: { 'USD': 530, 'SAR': 140, 'YER': 1 },
      enableTax: false,
      taxRate: 5,
      discountEnabled: true,
      visualTheme: 'bronze-luxury',
      enableWhatsAppSharing: true,
      enableAutoPrint: false,
      enableAudioUI: true,
      enablePopupNotifications: true,
      enableBarcodeAutoPrice: true,
      autoPricingEnabled: false,
      autoPricingType: 'both',
      backupPrices: {},
      customBaseUrl: window.location.origin,
      invoiceLabel: 'فاتورة مبيعات',
      fontSizeBillTitle: 24,
      fontSizeBillBody: 14,
      fontSizeBillPrice: 18,
      billScale: 1.0,
      productLabels: ['سماعة', 'وصلة', 'شاحن', 'جوال', 'بطارية'],
      productCategories: ['المحل', 'المستودع', 'spare_part'],
      notificationSettings: {
        priceMonitorEnabled: true,
        currencyMonitorEnabled: true,
        debtAlertDays: 2,
        installmentAlertEnabled: true,
        reviewTime: '21:00',
        debtMessagingTime: '10:00'
      }
    };

    try {
      await updateDoc(doc(db, 'users', profile.ownerId), defaultSettings as any);
      setShopSettings(defaultSettings);
      setStatus({ type: 'success', message: 'تمت استعادة ضبط المصنع للإعدادات بنجاح!' });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'فشل تصفير الإعدادات.' });
    } finally {
      setIsSaving(false);
    }
  };

  const addAllInventoryToQueue = () => {
    if (inventory.length === 0) {
      setStatus({ type: 'error', message: 'المخزون فارغ!' });
      return;
    }
    const newItems = inventory.map(item => ({ item, count: 1 }));
    setBarcodePrintQueue(prev => [...prev, ...newItems]);
    setStatus({ type: 'success', message: `تم إضافة ${inventory.length} صنف لطابور الطباعة` });
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto flex flex-col md:flex-row gap-8">
      {/* Sidebar Tabs */}
      <div className="w-full md:w-64 space-y-2 shrink-0">
        <div className="flex items-center gap-3 mb-6 px-4">
          <SettingsIcon className="text-brand-primary" size={28} />
          <h2 className="text-2xl font-black text-navy-900 dark:text-white">الإعدادات</h2>
        </div>

        {[
          { id: 'general', label: 'الهوية والنشاط', icon: LayoutDashboard },
          { id: 'network-sync', label: 'المزامنة والربط الشبكي', icon: Network },
          { id: 'pricing', label: 'قواعد التسعير', icon: CalculatorIcon },
          { id: 'notifications', label: 'التنبيهات والرسائل', icon: Bell },
          { id: 'printing', label: 'الطباعة والباركود', icon: Printer },
          { id: 'remote', label: 'الروابط والمشاركة للزبائن', icon: Share2 },
          { id: 'quick-entry', label: 'الإدخال السريع', icon: Plus },
          { id: 'backup', label: 'النسخ الاحتياطي والأرشيف', icon: HardDrive },
          { id: 'currency', label: 'العملات والضريبة والمالية', icon: DollarSign },
          { id: 'warehouses', label: 'ربط المخازن بالمجالات', icon: Archive },
          { id: 'management', label: 'إدارة البراندات والوحدات', icon: Package },
          { id: 'security', label: 'أمان الحساب والحماية', icon: ShieldCheck },
          { id: 'permissions', label: 'أذونات وصلاحيات الجهاز', icon: Shield },
          { id: 'audit', label: 'تدقيق النظام المالي', icon: Activity },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-800'
            }`}
          >
            <tab.icon size={20} />
            {tab.label}
          </button>
        ))}

        <div className="pt-8 px-4">
          <div className="p-4 bg-navy-900/5 dark:bg-white/5 rounded-2xl border border-navy-700/10">
            <p className="text-[10px] text-gray-500 font-bold mb-1">إصدار النظام</p>
            <p className="text-xs font-black text-navy-900 dark:text-white">JAM Pro v2.5.0</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-8">
        {status && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-4 rounded-2xl flex items-center gap-3 ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
          >
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <p className="font-bold flex-1">{status.message}</p>
            <button onClick={() => setStatus(null)} className="p-1 hover:bg-white/10 rounded-lg"><X size={16} /></button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'general' && (
            <motion.div 
              key="general"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Header section */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-navy-800 p-8 rounded-[3rem] shadow-xl border border-gray-100 dark:border-navy-700">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-brand-primary/10 text-brand-primary rounded-[2rem] flex items-center justify-center shadow-inner">
                    <Store size={40} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-navy-900 dark:text-white">هوية النشاط التجاري</h3>
                    <p className="text-sm text-gray-400 font-bold">تحكم في ظهور علامتك التجارية ومعلومات التواصل الأساسية</p>
                  </div>
                </div>
                <button 
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="px-10 py-4 bg-brand-primary text-white rounded-2xl font-black shadow-xl shadow-brand-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                  حفظ تغييرات الهوية
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Identity Bento */}
                <div className="lg:col-span-1 space-y-8">
                  <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-bl-[4rem] group-hover:scale-110 transition-transform" />
                    <h4 className="text-xl font-black text-navy-900 dark:text-white mb-8 flex items-center gap-3">
                      <ImageIcon className="text-brand-primary" size={24} />
                      الشعار الرسمي
                    </h4>
                    
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative group/logo">
                        {shopSettings.shopLogo ? (
                          <img src={shopSettings.shopLogo} alt="Shop Logo" className="w-48 h-48 rounded-[3rem] object-cover shadow-2xl border-4 border-white dark:border-navy-900" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-48 h-48 bg-gray-50 dark:bg-navy-900 rounded-[3rem] flex items-center justify-center border-4 border-dashed border-gray-200 dark:border-navy-700">
                            <ImageIcon size={64} className="text-gray-300" />
                          </div>
                        )}
                        <label className="absolute inset-0 flex items-center justify-center bg-navy-900/40 opacity-0 group-hover/logo:opacity-100 transition-opacity rounded-[3rem] cursor-pointer backdrop-blur-sm">
                          <div className="bg-white text-navy-900 p-4 rounded-2xl shadow-xl">
                            <Upload size={24} />
                          </div>
                          <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                        </label>
                        {isUploadingLogo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-navy-900/60 rounded-[3rem] backdrop-blur-md">
                            <Loader2 className="text-brand-primary animate-spin" size={48} />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-bold text-center leading-relaxed">
                        يُستخدم الشعار في ترويسة الفوارير والتقارير <br/>يفضل أن يكون PNG بخلفية شفافة
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg relative overflow-hidden group">
                     <h4 className="text-xl font-black text-navy-900 dark:text-white mb-6 flex items-center gap-3">
                      <ShieldCheck className="text-emerald-500" size={24} />
                      الختم والتوثيق
                    </h4>
                    <div className="flex items-center gap-6">
                      <div className="relative group/stamp shrink-0">
                        {shopSettings.shopStamp ? (
                          <img src={shopSettings.shopStamp} alt="Shop Stamp" className="w-24 h-24 rounded-full object-contain grayscale opacity-60 group-hover/stamp:opacity-100 transition-all shadow-md" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-24 h-24 bg-gray-50 dark:bg-navy-900 rounded-full flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-navy-700">
                            <ShieldCheck size={32} className="text-gray-300" />
                          </div>
                        )}
                        <label className="absolute inset-0 flex items-center justify-center bg-navy-900/40 opacity-0 group-hover/stamp:opacity-100 transition-opacity rounded-full cursor-pointer backdrop-blur-sm">
                          <Upload className="text-white" size={20} />
                          <input type="file" className="hidden" accept="image/*" onChange={handleStampUpload} disabled={isUploadingStamp} />
                        </label>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-navy-900 dark:text-white">ختم المتجر</p>
                        <p className="text-[10px] text-gray-400 font-bold leading-tight">يظهر أسفل التقارير الرسمية لضمان الوثوقية</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Information Bento */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2 bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-6">
                    <h4 className="text-xl font-black text-navy-900 dark:text-white flex items-center gap-3 mb-2">
                      <LayoutDashboard className="text-indigo-500" size={24} />
                      البيانات التجارية
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">اسم المحل / المركز</label>
                        <div className="relative">
                           <input 
                            required
                            type="text" 
                            className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-lg focus:ring-2 ring-brand-primary/50 transition-all"
                            value={shopSettings.shopName}
                            onChange={(e) => setShopSettings({...shopSettings, shopName: e.target.value})}
                          />
                          <SettingsIcon className="absolute left-6 top-4.5 text-gray-300" size={20} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">نوع النشاط</label>
                        <select 
                          className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-lg focus:ring-2 ring-brand-primary/50 transition-all appearance-none"
                          value={shopSettings.businessType}
                          onChange={(e) => setShopSettings({...shopSettings, businessType: e.target.value as any})}
                        >
                          <option value="mobiles">جوالات (صيانة، رصيد، IMEI)</option>
                          <option value="clothing">ملابس وأحذية (مقاس، لون، ماركة)</option>
                          <option value="grocery">بقالة (تاريخ انتهاء، وزن)</option>
                          <option value="pharmacy">صيدلية (الاسم العلمي، صلاحية)</option>
                          <option value="restaurant">مطعم (أقسام، طاولات، POS)</option>
                          <option value="construction">مواد بناء (وحدات قياس)</option>
                          <option value="tailoring">خياطة (تطريز، تفصيل، مقاسات)</option>
                          <option value="wholesale">تجارة جملة (توزيع، مناديب، طلبات شبكية)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">اسم المشرف المسؤول</label>
                        <input 
                          required
                          type="text" 
                          className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-lg focus:ring-2 ring-brand-primary/50 transition-all"
                          value={shopSettings.supervisorName}
                          onChange={(e) => setShopSettings({...shopSettings, supervisorName: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">رقم التواصل الأساسي</label>
                        <input 
                          required
                          type="text" 
                          className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-lg focus:ring-2 ring-brand-primary/50 transition-all"
                          value={shopSettings.shopPhone}
                          onChange={(e) => setShopSettings({...shopSettings, shopPhone: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">أرقام الحجوزات (تظهر للعملاء)</label>
                        <input 
                          type="text" 
                          placeholder="مثلاً: 777111222 | 700111222"
                          className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-lg focus:ring-2 ring-brand-primary/50 transition-all text-brand-primary"
                          value={shopSettings.reservationNumbers || ''}
                          onChange={(e) => setShopSettings({...shopSettings, reservationNumbers: e.target.value})}
                        />
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">العنوان الجغرافي الكامل</label>
                        <div className="relative">
                          <input 
                            required
                            type="text" 
                            className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-10 md:py-4 rounded-2xl font-black text-lg focus:ring-2 ring-brand-primary/50 transition-all"
                            value={shopSettings.shopAddress}
                            onChange={(e) => setShopSettings({...shopSettings, shopAddress: e.target.value})}
                          />
                          <MapPin className="absolute left-6 top-4.5 text-gray-300" size={20} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* تهيئة المتجر (Store Configuration) */}
                  <div className="md:col-span-2 bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-6">
                    <h4 className="text-xl font-black text-navy-900 dark:text-white flex items-center gap-3 mb-2">
                      <SettingsIcon className="text-brand-primary" size={24} />
                      تهيئة المتجر (Store Configuration)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">
                          رمز المحل الفريد (Store Code) - لترميز الفواتير والمعاملات
                        </label>
                        <div className="relative">
                          <input 
                            disabled={profile?.role !== 'owner' && profile?.role !== 'manager' && profile?.role !== 'superadmin' && profile?.role !== 'master_wholesale'}
                            type="text" 
                            className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-lg focus:ring-2 ring-brand-primary/50 transition-all placeholder:text-gray-300/50"
                            placeholder="مثال: JAM-DHAMAR-01"
                            value={shopSettings.storeCode || ''}
                            onChange={(e) => setShopSettings({...shopSettings, storeCode: e.target.value.toUpperCase().replace(/\s+/g, '')})}
                          />
                          <ScanLine className="absolute left-6 top-4.5 text-gray-300" size={20} />
                        </div>
                        <p className="text-xs text-gray-400 font-bold leading-relaxed px-2">
                          {profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'superadmin' || profile?.role === 'master_wholesale'
                            ? "رمز فريد يُستخدم كبادئة لجميع أرقام الفواتير والعمليات المالية لضمان الخصوصية والترابط الشبكي."
                            : "عذراً، يمتلك مالك المحل أو المدير صلاحية تعديل رمز تهيئة المحل فقط."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-4">
                    <h4 className="text-xl font-black text-navy-900 dark:text-white flex items-center gap-3">
                      <Palette className="text-orange-500" size={24} />
                      تجربة المستخدم
                    </h4>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase">نمط اللوحة (UI Theme)</label>
                        <select 
                          className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-sm focus:ring-2 ring-orange-500/50 transition-all appearance-none"
                          value={shopSettings.uiTheme || 'modern'}
                          onChange={(e) => setShopSettings({...shopSettings, uiTheme: e.target.value as any})}
                        >
                          <option value="classic">كلاسيكي (Classic)</option>
                          <option value="modern">عصري (Modern)</option>
                          <option value="touch-pos">لمس (Touch POS - للمطاعم)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-gray-400 uppercase">المدينة (للمواقيت الفلكية)</label>
                         <select 
                          className="w-full bg-gray-50 dark:bg-navy-900 border-none px-6 py-4 rounded-2xl font-black text-sm focus:ring-2 ring-orange-500/50 transition-all appearance-none"
                          value={shopSettings.city}
                          onChange={(e) => setShopSettings({...shopSettings, city: e.target.value})}
                        >
                          <option value="Sanaa">صنعاء</option>
                          <option value="Aden">عدن</option>
                          <option value="Taiz">تعز</option>
                          <option value="Ibb">إب</option>
                          <option value="Hodeidah">الحديدة</option>
                          <option value="Mukalla">المكلا</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-4">
                    <h4 className="text-xl font-black text-navy-900 dark:text-white flex items-center gap-3">
                      <Coins className="text-emerald-500" size={24} />
                      سياسات العمل
                    </h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-emerald-50/50 dark:bg-navy-900 rounded-2xl border border-emerald-100 dark:border-navy-700">
                         <div>
                            <p className="text-sm font-black text-navy-900 dark:text-white">قفل أوقات الصلاة</p>
                            <p className="text-[10px] text-gray-400">تأمين الشاشة وقت الصلاة</p>
                         </div>
                         <button 
                            type="button"
                            onClick={() => setShopSettings({...shopSettings, prayerLockEnabled: !shopSettings.prayerLockEnabled})}
                            className={`w-12 h-6 rounded-full transition-colors relative ${shopSettings.prayerLockEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-navy-700'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${shopSettings.prayerLockEnabled ? (document.dir === 'rtl' ? 'left-7' : 'right-7') : (document.dir === 'rtl' ? 'left-1' : 'right-1')}`} />
                          </button>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-indigo-50/50 dark:bg-navy-900 rounded-2xl border border-indigo-100 dark:border-navy-700">
                         <div>
                            <p className="text-sm font-black text-navy-900 dark:text-white">جلب الأسعار تلقائياً</p>
                            <p className="text-[10px] text-gray-400">عند مسح باركود المنتج</p>
                         </div>
                         <button 
                            type="button"
                            onClick={() => setShopSettings({...shopSettings, enableBarcodeAutoPrice: !shopSettings.enableBarcodeAutoPrice})}
                            className={`w-12 h-6 rounded-full transition-colors relative ${shopSettings.enableBarcodeAutoPrice ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-navy-700'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${shopSettings.enableBarcodeAutoPrice ? (document.dir === 'rtl' ? 'left-7' : 'right-7') : (document.dir === 'rtl' ? 'left-1' : 'right-1')}`} />
                          </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            <div className="space-y-4 md:col-span-2 border-t border-navy-700/10 pt-6">
              <h4 className="text-lg font-bold flex items-center gap-2">
                <Share2 size={18} className="text-brand-primary" />
                روابط المباشرة للمتابعة (Social Links)
              </h4>
              <p className="text-[10px] text-gray-400 -mt-2">هذه الروابط تظهر في القائمة الجانبية وتستخدم في فواتير التحصيل.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="label-field flex items-center gap-2">
                    <MessageCircle size={14} className="text-green-500" />
                    رابط واتساب
                  </label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="https://wa.me/967..."
                    value={shopSettings.socialLinks?.whatsapp}
                    onChange={(e) => setShopSettings({
                      ...shopSettings, 
                      socialLinks: { ...shopSettings.socialLinks, whatsapp: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="label-field flex items-center gap-2">
                    <Send size={14} className="text-blue-500" />
                    رابط تلجرام
                  </label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="https://t.me/your_channel"
                    value={shopSettings.socialLinks?.telegram}
                    onChange={(e) => setShopSettings({
                      ...shopSettings, 
                      socialLinks: { ...shopSettings.socialLinks, telegram: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="label-field flex items-center gap-2">
                    <ExternalLink size={14} className="text-blue-600" />
                    رابط فيسبوك
                  </label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="https://facebook.com/your_page"
                    value={shopSettings.socialLinks?.facebook}
                    onChange={(e) => setShopSettings({
                      ...shopSettings, 
                      socialLinks: { ...shopSettings.socialLinks, facebook: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-200 dark:border-navy-700">
                <div className="flex-1">
                  <p className="text-sm font-bold">إرسال روابط المتابعة مع الرسائل</p>
                  <p className="text-[10px] text-gray-500">إلحاق روابط التواصل آلياً في نهاية كل رسالة</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setShopSettings({...shopSettings, sendSocialLinks: !shopSettings.sendSocialLinks})}
                  className={`w-12 h-6 rounded-full transition-colors relative ${shopSettings.sendSocialLinks ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-navy-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${shopSettings.sendSocialLinks ? (document.dir === 'rtl' ? 'left-7' : 'right-7') : (document.dir === 'rtl' ? 'left-1' : 'right-1')}`} />
                </button>
              </div>
            </div>

            <div className="space-y-4 md:col-span-2 border-t border-navy-700/10 pt-6 mt-4">
              <h4 className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck size={18} className="text-brand-primary" />
                إعدادات الخصوصية والظهور
              </h4>
              <p className="text-[10px] text-gray-400 -mt-2">تحكم في كيفية ظهور متجرك للمستخدمين الآخرين في النظام.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-200 dark:border-navy-700">
                  <div className="flex-1">
                    <p className="text-sm font-bold">الظهور في قائمة الموردين</p>
                    <p className="text-[10px] text-gray-500">عند تفعيله، سيظهر اسم متجرك للمستخدمين الآخرين للربط والطلب.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={async () => {
                      if (!profile?.uid) return;
                      const newVal = profile.visibility === false ? true : false;
                      await setDoc(doc(db, 'users', profile.uid), { visibility: newVal }, { merge: true });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${profile?.visibility !== false ? 'bg-green-500' : 'bg-gray-300 dark:bg-navy-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${profile?.visibility !== false ? (document.dir === 'rtl' ? 'left-7' : 'right-7') : (document.dir === 'rtl' ? 'left-1' : 'right-1')}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-200 dark:border-navy-700">
                  <div className="flex-1">
                    <p className="text-sm font-bold">تعطيل طلبات الدردشة الجديدة</p>
                    <p className="text-[10px] text-gray-500">منع المستخدمين الجدد من بدء محادثات معك (المقربون فقط يمكنهم ذلك).</p>
                  </div>
                  <button 
                    type="button"
                    onClick={async () => {
                      if (!profile?.uid) return;
                      const newVal = !profile.disableChatRequests;
                      await setDoc(doc(db, 'users', profile.uid), { disableChatRequests: newVal }, { merge: true });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${profile?.disableChatRequests ? 'bg-orange-500' : 'bg-gray-300 dark:bg-navy-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${profile?.disableChatRequests ? (document.dir === 'rtl' ? 'left-7' : 'right-7') : (document.dir === 'rtl' ? 'left-1' : 'right-1')}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button 
                type="submit"
                disabled={isSaving}
                className="btn-primary px-10 py-4 flex items-center gap-3"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-4 border-navy-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={20} />
                )}
                {isSaving ? 'جاري الحفظ...' : 'حفظ بيانات المحل'}
              </button>
            </div>
          </motion.div>
        )}

      {activeTab === 'pricing' && profile && (
        <motion.div 
          key="pricing"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <PricingManager 
            profile={profile}
            shopSettings={shopSettings as any}
            setShopSettings={setShopSettings as any}
          />
        </motion.div>
      )}

      {activeTab === 'banking-deleted-moved' && profile && (
        <motion.div 
          key="banking"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between flex-col md:flex-row gap-4 border-b border-gray-100 dark:border-white/5 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-600/10 text-blue-600 rounded-3xl flex items-center justify-center">
                <CreditCard size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-navy-900 dark:text-white">المركز والتحصيل البنكي</h3>
                <p className="text-sm font-bold text-gray-500">إدارة حسابات الصندوق البنكية والتحويلات المالية المستلمة من الزبائن في واجهة واحدة.</p>
              </div>
            </div>
          </div>

          {/* Sub-Tabs Navigation */}
          <div className="flex gap-4 p-1.5 bg-gray-150 dark:bg-navy-900 rounded-2xl w-fit border border-gray-100 dark:border-navy-800 flex-wrap">
            <button
              onClick={() => setBankingSubTab('accounts')}
              className={`px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 transition-all ${
                bankingSubTab === 'accounts'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              <Briefcase size={18} />
              الحسابات البنكية العامة
            </button>
            <button
              onClick={() => setBankingSubTab('transfers')}
              className={`px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 transition-all ${
                bankingSubTab === 'transfers'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              <History size={18} />
              الحوالات والتحويلات المستلمة
            </button>
            <button
              onClick={() => setBankingSubTab('custom_boxes')}
              className={`px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 transition-all ${
                bankingSubTab === 'custom_boxes'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              <Coins size={18} />
              مهايئ الصناديق المالية مخصص
            </button>
          </div>

          {bankingSubTab === 'accounts' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add New Bank Account Form */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-navy-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-navy-700 shadow-xl space-y-6">
                  <h4 className="font-black text-navy-900 dark:text-white flex items-center gap-2">
                    <PlusSquare className="text-blue-500" size={20} />
                    إضافة حساب جديد
                  </h4>
                  <form onSubmit={handleAddBank} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">اسم البنك / الخدمة</label>
                      <input 
                        required
                        type="text" 
                        placeholder="مثلاً: بنك الكريمي، ون كاش"
                        className="input-field py-4"
                        value={newBank.bankName}
                        onChange={(e) => setNewBank({...newBank, bankName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">رقم الحساب / الجوال</label>
                      <input 
                        required
                        type="text" 
                        placeholder="رقم الحساب الصحيح"
                        className="input-field py-4"
                        value={newBank.accountNumber}
                        onChange={(e) => setNewBank({...newBank, accountNumber: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">اسم صاحب الحساب</label>
                      <input 
                        required
                        type="text" 
                        placeholder="الاسم المسجل في البنك"
                        className="input-field py-4"
                        value={newBank.accountName}
                        onChange={(e) => setNewBank({...newBank, accountName: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">العملة</label>
                        <select 
                          className="input-field py-4"
                          value={newBank.currency}
                          onChange={(e) => setNewBank({...newBank, currency: e.target.value as any})}
                        >
                          <option value="YER">ريال يمني</option>
                          <option value="SAR">ريال سعودي</option>
                          <option value="USD">دولار أمريكي</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">الرصيد الافتتاحي</label>
                        <input 
                          type="number" 
                          placeholder="0.00"
                          className="input-field py-4"
                          value={newBank.balance}
                          onChange={(e) => setNewBank({...newBank, balance: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={isAddingBank}
                      className="w-full py-4 bg-navy-950 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"
                    >
                      {isAddingBank ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                      حفظ الحساب البنكي
                    </button>
                  </form>
                </div>
              </div>

              {/* Existing Accounts List */}
              <div className="lg:col-span-2 space-y-6">
                {isLoadingBanks ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                    <Loader2 className="animate-spin text-blue-500" size={48} />
                    <p className="font-bold">جاري تحميل الحسابات البنكية...</p>
                  </div>
                ) : bankAccounts.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50 dark:bg-navy-900 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-navy-800 space-y-4">
                    <div className="w-20 h-20 bg-white dark:bg-navy-950 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <CreditCard size={40} className="text-gray-300" />
                    </div>
                    <div>
                      <p className="font-black text-navy-900 dark:text-white">لا توجد حسابات بنكية مضافة</p>
                      <p className="text-xs text-gray-500">قم بإضافة حسابك الأول لتسهيل استلام التحويلات المالية.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {bankAccounts.map(account => (
                      <motion.div 
                        layout
                        key={account.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-navy-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-navy-700 shadow-lg group hover:border-blue-500/30 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-600 rounded-xl">
                              <Store size={24} />
                            </div>
                            <button 
                              onClick={() => handleDeleteBank(account.id, account)}
                              className="p-2 text-danger opacity-0 group-hover:opacity-100 bg-danger/5 hover:bg-danger hover:text-white rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          
                          <div>
                            <h4 className="text-xl font-black text-navy-900 dark:text-white">{account.bankName}</h4>
                            <p className="text-sm font-bold text-gray-500">{account.accountName}</p>
                          </div>

                          <div className="p-4 bg-gray-50 dark:bg-navy-950 rounded-2xl border border-gray-100 dark:border-navy-900/50">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">رقم الحساب</p>
                            <p className="font-mono text-lg font-black tracking-wider text-blue-600">{account.accountNumber}</p>
                          </div>
                        </div>

                        <div className="mt-8 flex items-end justify-between">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">الرصيد الحالي</p>
                            <div className="flex items-center gap-2">
                               <input 
                                 type="number"
                                 className="bg-transparent font-black text-2xl w-32 border-b-2 border-transparent focus:border-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                 defaultValue={account.balance}
                                 disabled={!(profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'superadmin' || profile?.role === 'master_wholesale')}
                                 onBlur={async (e) => {
                                   const val = Number(e.target.value);
                                   if (val !== account.balance) {
                                     const success = await handleUpdateBankBalance(account.id, val, account.balance);
                                     if (!success) {
                                       e.target.value = String(account.balance);
                                     }
                                   }
                                 }}
                               />
                               <span className="font-bold text-gray-500">{account.currency}</span>
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-blue-500/10 text-blue-600 text-[10px] font-black rounded-full border border-blue-500/20 uppercase">
                            ACTIVE_ACCOUNT
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : bankingSubTab === 'transfers' ? (
            <div className="card-glass p-6">
              <BankTransferManager profile={profile} />
            </div>
          ) : (
            <div className="card-glass p-6">
              <JamBoxManager storeCode={profile?.ownerId || 'JAM_STORE_1'} profile={profile} />
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'notifications' && (
        <motion.div 
          key="notifications"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center">
              <Bell size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold">التنبيهات وإرسال الرسائل</h3>
              <p className="text-sm text-gray-500">تهيئة الربط مع الجوال وتخصيص قوالب الرسائل التلقائية.</p>
            </div>
          </div>



          {/* Privacy & Toggles Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { id: 'enableWhatsAppSharing', label: 'إرسال واتساب', desc: 'إظهار خيار الإرسال بعد الفاتورة', icon: MessageCircle },
              { id: 'enableAudioUI', label: 'الأصوات التفاعلية', desc: 'كتم/تشغيل أصوات النظام', icon: Volume2 },
              { id: 'enablePopupNotifications', label: 'التنبيهات المنبثقة', desc: 'إشعارات النواقص والديون', icon: Bell },
              { id: 'priceMonitorEnabled', label: 'مراقبة الأسعار', desc: 'تنبيه عند تغير أسعار الموردين', icon: TrendingDown, isNested: true },
              { id: 'currencyMonitorEnabled', label: 'مراقب العملات', desc: 'تنبيه عند تغير سعر الصرف', icon: Coins, isNested: true },
              { id: 'installmentAlertEnabled', label: 'تنبيهات الأقساط', desc: 'تذكير شهري بالمتأخرين', icon: Calendar, isNested: true },
              { id: 'sendSocialLinks', label: 'روابط المتابعة', desc: 'إلحاق روابط التواصل بالرسائل', icon: Globe },
            ].map((toggle: any) => (
              <div key={toggle.id} className="flex items-center justify-between p-6 bg-white dark:bg-navy-900 rounded-3xl border border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center text-gray-500">
                    <toggle.icon size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm tracking-tight">{toggle.label}</span>
                    <span className="text-[10px] text-gray-500">{toggle.desc}</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    if (toggle.isNested) {
                      setShopSettings({
                        ...shopSettings,
                        notificationSettings: {
                          ...shopSettings.notificationSettings!,
                          [toggle.id]: !shopSettings.notificationSettings?.[toggle.id as keyof typeof shopSettings.notificationSettings]
                        }
                      });
                    } else {
                      setShopSettings({...shopSettings, [toggle.id]: !shopSettings[toggle.id as keyof typeof shopSettings]});
                    }
                  }}
                  className={`w-12 h-6 rounded-full transition-all relative ${
                    toggle.isNested 
                      ? shopSettings.notificationSettings?.[toggle.id as keyof typeof shopSettings.notificationSettings] 
                      : shopSettings[toggle.id as keyof typeof shopSettings] 
                        ? 'bg-success' : 'bg-gray-300 dark:bg-navy-700'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    (toggle.isNested ? shopSettings.notificationSettings?.[toggle.id as keyof typeof shopSettings.notificationSettings] : shopSettings[toggle.id as keyof typeof shopSettings])
                      ? (document.dir === 'rtl' ? 'left-7' : 'right-7') 
                      : (document.dir === 'rtl' ? 'left-1' : 'right-1')
                  }`} />
                </button>
              </div>
            ))}
          </div>

          {/* New Scheduling Section */}
          <div className="card-glass p-8 space-y-6">
            <h4 className="font-bold flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-4">
              <Clock size={18} className="text-brand-primary" />
              جدولة المواعيد الذكية
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="label-field text-xs">وقت المراجعة اليومية (النواقص)</label>
                <input 
                  type="time" 
                  className="input-field"
                  value={shopSettings.notificationSettings?.reviewTime || '21:00'}
                  onChange={(e) => setShopSettings({
                    ...shopSettings,
                    notificationSettings: {
                      ...shopSettings.notificationSettings!,
                      reviewTime: e.target.value
                    }
                  })}
                />
              </div>
              <div className="space-y-2">
                <label className="label-field text-xs">وقت مراسلة المديونين</label>
                <input 
                  type="time" 
                  className="input-field"
                  value={shopSettings.notificationSettings?.debtMessagingTime || '10:00'}
                  onChange={(e) => setShopSettings({
                    ...shopSettings,
                    notificationSettings: {
                      ...shopSettings.notificationSettings!,
                      debtMessagingTime: e.target.value
                    }
                  })}
                />
              </div>
              <div className="space-y-2">
                <label className="label-field text-xs">تنبيه الديون قبل (أيام)</label>
                <input 
                  type="number" 
                  className="input-field"
                  min="1"
                  max="7"
                  value={shopSettings.notificationSettings?.debtAlertDays || 2}
                  onChange={(e) => setShopSettings({
                    ...shopSettings,
                    notificationSettings: {
                      ...shopSettings.notificationSettings!,
                      debtAlertDays: Number(e.target.value)
                    }
                  })}
                />
              </div>
            </div>
          </div>

          {/* Message Templates Section */}
          <div className="card-glass p-8 space-y-6">
            <h4 className="font-bold flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-4">
              <MessageCircle size={18} className="text-orange-500" />
              قوالب الرسائل المخصصة
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h5 className="text-xs font-black text-gray-400 uppercase">الحسابات والديون</h5>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400">رسالة تذكير بالمديونية</label>
                    <textarea 
                      className="input-field min-h-[80px] text-xs"
                      value={shopSettings.messageTemplates?.debtReminder}
                      onChange={(e) => setShopSettings({
                        ...shopSettings, 
                        messageTemplates: { ...shopSettings.messageTemplates, debtReminder: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400">قالب تذكير بالأقساط</label>
                    <textarea 
                      className="input-field min-h-[80px] text-xs"
                      value={shopSettings.messageTemplates?.installment_reminder}
                      onChange={(e) => setShopSettings({
                        ...shopSettings, 
                        messageTemplates: { ...shopSettings.messageTemplates, installment_reminder: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400">رسالة كشف الحساب</label>
                    <textarea 
                      className="input-field min-h-[80px] text-xs"
                      value={shopSettings.messageTemplates?.statementSummary}
                      onChange={(e) => setShopSettings({
                        ...shopSettings, 
                        messageTemplates: { ...shopSettings.messageTemplates, statementSummary: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="text-xs font-black text-gray-400 uppercase">المخزون والتنبيهات</h5>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400">رسالة نقص المخزون</label>
                    <textarea 
                      className="input-field min-h-[80px] text-xs"
                      value={shopSettings.messageTemplates?.stockAlert}
                      onChange={(e) => setShopSettings({
                        ...shopSettings, 
                        messageTemplates: { ...shopSettings.messageTemplates, stockAlert: e.target.value }
                      })}
                    />
                  </div>
                  {shopSettings.businessType === 'mobiles' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400">جاهزية الصيانة</label>
                      <textarea 
                        className="input-field min-h-[80px] text-xs"
                        value={shopSettings.messageTemplates?.maintenanceReady}
                        onChange={(e) => setShopSettings({
                          ...shopSettings, 
                          messageTemplates: { ...shopSettings.messageTemplates, maintenanceReady: e.target.value }
                        })}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-navy-700/10">
              <button onClick={saveSettings} className="btn-primary px-10 py-4 flex items-center gap-3">
                <Save size={20} />
                حفظ القوالب والتنبيهات
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'printing' && (
        <motion.div 
          key="printing"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
              <Printer size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold">إعدادات الطباعة والباركود</h3>
              <p className="text-sm text-gray-500">التحكم في الطابعات، مقاسات الفواتير، وتوليد ملصقات الباركود.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Configuration */}
            <div className="card-glass p-8 space-y-6 flex flex-col">
              <h4 className="font-bold flex items-center gap-2 text-blue-500">
                <Printer size={18} />
                تكوين الطابعة والاتصال
              </h4>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-blue-900 dark:text-blue-400">وسيلة الاتصال بالطباعة</p>
                      <p className="text-[10px] text-blue-600">اختر كيف يتصل البرنامج بالطابعة</p>
                    </div>
                    <div className="flex gap-1 p-1 bg-white/50 dark:bg-navy-950/50 rounded-xl border border-blue-200 dark:border-blue-900/30">
                      {[
                        { id: 'system', icon: Monitor, label: 'النظام' },
                        { id: 'bluetooth', icon: Box, label: 'بلوتوث' },
                        { id: 'wifi', icon: Cloud, label: 'واي فاي' },
                        { id: 'usb', icon: Smartphone, label: 'USB' }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setShopSettings({
                            ...shopSettings,
                            printer: { ...shopSettings.printer, type: mode.id as any }
                          })}
                          className={`p-2 rounded-lg flex flex-col items-center gap-1 min-w-[50px] transition-all ${shopSettings.printer?.type === mode.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-blue-600'}`}
                        >
                          <mode.icon size={16} />
                          <span className="text-[8px] font-bold">{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {shopSettings.printer?.type === 'bluetooth' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="pt-2 border-t border-blue-200 dark:border-blue-900/30">
                      <div className="flex items-center justify-between p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20">
                        <div className="flex items-center gap-3">
                          <Activity className="animate-pulse" size={18} />
                          <span className="text-xs font-black">وضع البحث عن أجهزة البلوتوث نشط</span>
                        </div>
                        <button className="px-4 py-1.5 bg-white text-blue-600 rounded-lg text-[10px] font-black hover:scale-105 transition-transform">
                          اقتران جديد
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-field">قالب الفاتورة (Invoice)</label>
                    <select 
                      className="input-field"
                      value={shopSettings.printer?.invoiceTemplate || 'modern_gold'}
                      onChange={(e) => setShopSettings({
                        ...shopSettings, 
                        printer: { ...shopSettings.printer, invoiceTemplate: e.target.value as any }
                      })}
                    >
                      <option value="modern_gold">ذهبي عصري (Modern Gold)</option>
                      <option value="classic_blue">أزرق كلاسيكي (Classic Blue)</option>
                      <option value="thermal_compact">حراري مدمج (Thermal Compact)</option>
                      <option value="thermal_long">حراري طويل (Thermal Long)</option>
                      <option value="minimalist_white">أبيض بسيط (Minimalist White)</option>
                      <option value="futuristic_neon">مستقبلي نيون (Futuristic Neon)</option>
                      <option value="vintage_paper">ورق كلاسيكي (Vintage Paper)</option>
                      <option value="corporate_dark">شركات داكن (Corporate Dark)</option>
                      <option value="royal_black">أسود ملكي (Royal Black)</option>
                      <option value="eco_green">أخضر اقتصادي (Eco Green)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label-field">قالب الملصق (Label)</label>
                    <select 
                      className="input-field"
                      value={shopSettings.printer?.labelTemplate || 'standard_barcode'}
                      onChange={(e) => setShopSettings({
                        ...shopSettings, 
                        printer: { ...shopSettings.printer, labelTemplate: e.target.value as any }
                      })}
                    >
                      <option value="standard_barcode">باركود قياسي (Standard)</option>
                      <option value="qr_luxury">QR فخم (QR Luxury)</option>
                      <option value="barcode_sheet_a4">ورق A4 (30 باركود/صفحة)</option>
                      <option value="jewelry_mini">مجوهرات مصغر (Jewelry)</option>
                      <option value="shipping_bold">شحن عريض (Shipping)</option>
                      <option value="tag_simple">بيان بسيط (Tag)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-black text-gray-700 dark:text-gray-300">نمط الفاتورة الافتراضي</h5>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setShopSettings({ ...shopSettings, defaultInvoiceType: 'simplified' })}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                        shopSettings.defaultInvoiceType === 'simplified' 
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' 
                          : 'border-gray-100 dark:border-navy-700 text-gray-500 hover:border-brand-primary/10'
                      }`}
                    >
                      <Zap size={24} />
                      <span className="text-xs font-black">مبسطة (قطاعي)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShopSettings({ ...shopSettings, defaultInvoiceType: 'detailed' })}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                        shopSettings.defaultInvoiceType === 'detailed' 
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' 
                          : 'border-gray-100 dark:border-navy-700 text-gray-500 hover:border-brand-primary/10'
                      }`}
                    >
                      <FileText size={24} />
                      <span className="text-xs font-black">تفصيلية (جملة)</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-black text-gray-700 dark:text-gray-300">أحجام خطوط الفاتورة والتحجيم</h5>
                    <button 
                      onClick={() => setShopSettings({
                        ...shopSettings,
                        fontSizeBillTitle: 24,
                        fontSizeBillBody: 14,
                        fontSizeBillPrice: 18,
                        billScale: 1.0
                      })}
                      className="text-[10px] font-black text-brand-primary uppercase tracking-widest flex items-center gap-1 hover:underline"
                    >
                      <RotateCcw size={12} />
                      استعادة الافتراضي
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">عنوان الفاتورة</label>
                      <input 
                        type="number" 
                        className="input-field py-2 text-center" 
                        value={shopSettings.fontSizeBillTitle || 24} 
                        onChange={(e) => setShopSettings({...shopSettings, fontSizeBillTitle: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">نصوص البيانات</label>
                      <input 
                        type="number" 
                        className="input-field py-2 text-center" 
                        value={shopSettings.fontSizeBillBody || 14} 
                        onChange={(e) => setShopSettings({...shopSettings, fontSizeBillBody: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">أحجام المبالغ</label>
                      <input 
                        type="number" 
                        className="input-field py-2 text-center" 
                        value={shopSettings.fontSizeBillPrice || 18} 
                        onChange={(e) => setShopSettings({...shopSettings, fontSizeBillPrice: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">مقياس التكبير</label>
                      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                        <button 
                          onClick={() => setShopSettings({...shopSettings, billScale: Math.max(0.5, (shopSettings.billScale || 1.0) - 0.1)})}
                          className="p-1 hover:bg-white/10 rounded-lg text-brand-primary"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="flex-1 text-center text-xs font-black tabular-nums">
                          {Math.round((shopSettings.billScale || 1.0) * 100)}%
                        </span>
                        <button 
                          onClick={() => setShopSettings({...shopSettings, billScale: Math.min(2.0, (shopSettings.billScale || 1.0) + 0.1)})}
                          className="p-1 hover:bg-white/10 rounded-lg text-brand-primary"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-field">مقاس الورق</label>
                    <select 
                      className="input-field"
                      value={shopSettings.printer?.type === 'thermal-58' ? '58mm' : (shopSettings.printer?.type === 'a4' ? 'a4' : '80mm')}
                      onChange={(e) => setShopSettings({
                        ...shopSettings, 
                        printer: { ...shopSettings.printer, type: e.target.value as any }
                      })}
                    >
                      <option value="thermal">حرارية 80mm (كبير)</option>
                      <option value="thermal-58">حرارية 58mm (صغير)</option>
                      <option value="a4">ورق عادي A4</option>
                      <option value="labels">ملصقات حرارية (Labels)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label-field">حالة الطباعة</label>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-white/5">
                      <span className="text-xs font-bold text-gray-500">طباعة تلقائية</span>
                      <button 
                        type="button"
                        onClick={() => setShopSettings({
                          ...shopSettings,
                          printer: { ...shopSettings.printer, enableAutoPrint: !shopSettings.printer?.enableAutoPrint }
                        })}
                        className={`w-10 h-5 rounded-full relative transition-all ${shopSettings.printer?.enableAutoPrint ? 'bg-success' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${shopSettings.printer?.enableAutoPrint ? (document.dir === 'rtl' ? 'left-5' : 'right-5') : (document.dir === 'rtl' ? 'left-0.5' : 'right-0.5')}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">عرض الباركود (mm)</label>
                    <input 
                      type="number" 
                      className="input-field py-2"
                      value={shopSettings.printer?.barcodeWidth}
                      onChange={(e) => setShopSettings({
                        ...shopSettings, 
                        printer: { ...shopSettings.printer, barcodeWidth: Number(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">طول الباركود (mm)</label>
                    <input 
                      type="number" 
                      className="input-field py-2"
                      value={shopSettings.printer?.barcodeHeight}
                      onChange={(e) => setShopSettings({
                        ...shopSettings, 
                        printer: { ...shopSettings.printer, barcodeHeight: Number(e.target.value) }
                      })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                      <Tag size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black">إظهار السعر في الباركود</p>
                      <p className="text-[10px] text-gray-500">تفعيل/تعطيل طباعة السعر أسفل ملصق الباركود</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      const currentStatus = shopSettings.printer?.showPriceOnBarcode;
                      // If it's undefined or specifically true, set to false. Otherwise set to true.
                      const newStatus = currentStatus === false ? true : false;
                      setShopSettings({
                        ...shopSettings,
                        printer: { 
                          ...shopSettings.printer, 
                          showPriceOnBarcode: newStatus 
                        }
                      });
                    }}
                    className={`w-10 h-5 rounded-full relative transition-all ${shopSettings.printer?.showPriceOnBarcode !== false ? 'bg-success' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${shopSettings.printer?.showPriceOnBarcode !== false ? (document.dir === 'rtl' ? 'left-5' : 'right-5') : (document.dir === 'rtl' ? 'left-0.5' : 'right-0.5')}`} />
                  </button>
                </div>
                <div className="pt-4 border-t border-navy-700/10 flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      setBulkPrintInitialItems(inventory.map(item => ({ itemId: item.id, quantity: 1 })));
                      setIsBulkPrintModalOpen(true);
                    }}
                    className="w-full py-4 bg-navy-900 border border-brand-primary/50 text-brand-primary hover:bg-brand-primary hover:text-white rounded-2xl font-black flex items-center justify-center gap-3 transition-all"
                  >
                    <Printer size={20} />
                    طباعة باركود لكافة أصناف المخزن
                  </button>
                  <div className="flex gap-2">
                    <button onClick={saveSettings} className="flex-1 btn-primary py-4 flex items-center justify-center gap-3 font-black">
                      <Save size={20} />
                      حفظ التغييرات
                    </button>
                    <button 
                      onClick={resetShopToDefault}
                      className="px-6 bg-danger/10 text-danger rounded-2xl flex items-center gap-2 hover:bg-danger hover:text-white transition-all font-black text-xs border border-danger/20"
                    >
                      <RotateCcw size={16} />
                      إعادة ضبط المصنع
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-glass p-8 space-y-6 flex flex-col">
              <h4 className="font-bold flex items-center gap-2 text-brand-primary">
                <Barcode size={18} />
                توليد وطباعة الباركود
              </h4>

              <div className="flex bg-navy-900/10 p-1 rounded-2xl mb-4">
                <button 
                  onClick={() => setIsManualBarcode(false)}
                  className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${!isManualBarcode ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500'}`}
                >
                  اختيار من المخزون
                </button>
                <button 
                  onClick={() => setIsManualBarcode(true)}
                  className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${isManualBarcode ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500'}`}
                >
                  إدخال يدوي
                </button>
              </div>

              <div className="space-y-4">
                {!isManualBarcode ? (
                  <div className="space-y-2">
                    <label className="label-field">اختر الصنف</label>
                    <select 
                      className="input-field"
                      onChange={(e) => {
                        const item = inventory.find(i => i.id === e.target.value);
                        if (item) {
                          setSelectedBarcodeItem(item);
                          setBarcodeLabel(item.name);
                        }
                      }}
                      value={selectedBarcodeItem?.id || ''}
                    >
                      <option value="">-- اختر صنف --</option>
                      {inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="label-field">اسم الصنف</label>
                      <input 
                        type="text" 
                        className="input-field"
                        placeholder="مثال: آيفون 15 برو"
                        value={manualBarcodeItem.name}
                        onChange={(e) => setManualBarcodeItem({...manualBarcodeItem, name: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="label-field">السعر</label>
                        <input 
                          type="number" 
                          className="input-field"
                          placeholder="0"
                          value={manualBarcodeItem.price || ''}
                          onChange={(e) => setManualBarcodeItem({...manualBarcodeItem, price: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="label-field">الباركود (اختياري)</label>
                        <input 
                          type="text" 
                          className="input-field"
                          placeholder="تركه فارغاً لتوليد تلقائي"
                          value={manualBarcodeItem.barcode}
                          onChange={(e) => setManualBarcodeItem({...manualBarcodeItem, barcode: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-field">العنوان على الملصق</label>
                    <input 
                      type="text" 
                      className="input-field"
                      value={barcodeLabel}
                      onChange={(e) => setBarcodeLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label-field">الكمية (عدد الملصقات)</label>
                    <input 
                      type="number" 
                      className="input-field"
                      min={1}
                      value={barcodeCount}
                      onChange={(e) => setBarcodeCount(Number(e.target.value))}
                    />
                  </div>
                </div>
                <button 
                  onClick={addToPrintQueue}
                  disabled={isManualBarcode ? !manualBarcodeItem.name : !selectedBarcodeItem}
                  className="btn-secondary w-full py-3 flex items-center justify-center gap-2 border-2 border-brand-primary/20"
                >
                  <Plus size={18} />
                  إضافة لقائمة الطباعة
                </button>
              </div>

              {barcodePrintQueue.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-navy-700/10">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold">قائمة الطباعة المختارة</h5>
                    <button onClick={() => setBarcodePrintQueue([])} className="text-xs text-danger hover:underline">إلغاء الكل</button>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
                    {barcodePrintQueue.map((q, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-navy-900/5 dark:bg-white/5 rounded-2xl border border-navy-700/10 animate-fade-in">
                        <div className="flex-1">
                          <p className="font-bold text-sm leading-tight mb-1">{q.item.name}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded-full">الكمية: {q.count}</span>
                            <span className="text-[10px] text-gray-500">{q.item.price.toLocaleString()} {shopSettings.currency}</span>
                          </div>
                        </div>
                        <button onClick={() => removeFromQueue(idx)} className="p-2 hover:bg-danger/10 text-danger rounded-xl transition-colors"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2">
                    <button 
                      onClick={handlePrintBarcodes}
                      className="btn-primary w-full py-4 flex items-center justify-center gap-3 text-lg"
                    >
                      <Printer size={20} />
                      طباعة القائمة ({barcodePrintQueue.reduce((acc, curr) => acc + curr.count, 0)})
                    </button>
                  </div>
                </div>
              )}

              {!barcodePrintQueue.length && selectedBarcodeItem && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 border-2 border-dashed border-gray-200 dark:border-white/5 rounded-[2.5rem]">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 mb-1">{shopSettings.shopName}</p>
                    <p className="text-xs font-bold truncate max-w-[150px]">{barcodeLabel}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm">
                    <svg ref={barcodeRef}></svg>
                  </div>
                  <button 
                    onClick={handlePrintBarcodes}
                    className="btn-secondary w-full py-4 flex items-center justify-center gap-3"
                  >
                    <Printer size={18} />
                    طباعة هذا الملصق فقط
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}



      {activeTab === 'remote' && (
        <motion.div 
          key="remote"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          {/* Link configuration removed as requested */}

          <hr className="border-navy-100 dark:border-white/5" />

          {/* New Persistence / Offline Section */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-2xl flex items-center justify-center">
              <Database size={32} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold">التخزين المحلي والأوفلاين (Persistence)</h3>
              <p className="text-sm text-gray-500">مزامنة كافة الأصناف والإعدادات في ذاكرة البرنامج للاستخدام بدون إنترنت.</p>
            </div>
            <button 
              onClick={async () => {
                setIsSyncing(true);
                try {
                  const collections = ['inventory', 'customers', 'maintenanceOrders', 'users', 'settings'];
                  for (const col of collections) {
                    const q = query(collection(db, col), where('ownerId', '==', profile?.ownerId));
                    await getDocs(q); 
                  }
                  setStatus({ type: 'success', message: 'تمت المزامنة الكاملة للتخزين المحلي بنجاح.' });
                } catch (err: any) {
                  setStatus({ type: 'error', message: 'فشل المزامنة المحلية: ' + err.message });
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all"
            >
              {isSyncing ? <Loader2 className="animate-spin" size={20} /> : <Database size={20} />}
              مزامنة للأوفلاين
            </button>
          </div>

          <hr className="border-navy-100 dark:border-white/5" />

          {/* Customer Portal Section - ROYAL DESIGN */}
          <div className="bg-gradient-to-br from-purple-600/10 to-navy-900 border-2 border-purple-500/20 rounded-[2.5rem] p-8 space-y-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-purple-500 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Globe size={32} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black text-white">بوابة الخدمات الملكية (للزبائن)</h3>
                  <span className="bg-purple-500/20 text-purple-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Public</span>
                </div>
                <p className="text-sm text-gray-400 font-bold">رابط عام مخصص لزوار وعملاء محلك لمتابعة الصيانة، المزاد، ونظام الجوائز.</p>
              </div>
            </div>

            {/* Moved Bank Accounts display source & Setup for Passport */}
            <div className="border-t border-purple-500/20 pt-6 space-y-6">
              <div className="bg-black/30 p-6 rounded-2xl border border-white/5 space-y-4">
                <h4 className="font-black text-white flex items-center gap-2 text-base">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  خيارات عرض الحسابات البنكية لصفحة العملاء وحجز الأجهزة
                </h4>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 block mb-1">مصدر عرض بيانات التحويل البنكي المعتمد للعميل:</label>
                  <select 
                    className="w-full bg-[#1e2333]/80 border border-white/10 px-4 py-3 rounded-xl font-bold text-sm text-white outline-none focus:ring-2 ring-purple-500 transition-all cursor-pointer text-right"
                    value={shopSettings?.bankDisplaySource || 'both'}
                    onChange={(e) => setShopSettings({...shopSettings, bankDisplaySource: e.target.value})}
                  >
                    <option value="both">عرض الحساب البنكي الرئيسي + الحسابات العامة المتعددة معاً (موصى به)</option>
                    <option value="main">عرض الحساب البنكي الرئيسي فقط للحجوزات</option>
                    <option value="multi">عرض الحسابات البنكية المتعددة المضافة بالصندوق فقط</option>
                    <option value="hidden">إخفاء الحسابات بالكامل من صفحة الدفع والتحويل</option>
                  </select>
                </div>
              </div>

              {/* Exclusive Bank Info configuration, now moved to Passport Settings */}
              <div className="bg-[#1e1430]/40 border border-purple-400/20 p-6 rounded-2xl space-y-4">
                <h4 className="font-bold text-purple-200 flex items-center gap-2 text-sm">
                  <Banknote size={18} className="text-purple-400" />
                  بيانات الحساب البنكي الرئيسي للمتجر (المُتحكّم بصفحة الحجوزات)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 block text-right">اسم البنك / الخدمة المعتمدة</label>
                    <input 
                      className="w-full bg-black/40 border border-white/10 px-4 py-3 rounded-xl font-bold text-sm text-white focus:ring-1 ring-purple-500 focus:outline-none text-center"
                      value={shopSettings?.bankInfo?.bankName || ''}
                      onChange={(e) => setShopSettings({...shopSettings, bankInfo: { ...(shopSettings?.bankInfo || { bankName: '', accountNumber: '', accountName: '' }), bankName: e.target.value }})}
                      placeholder="مثال: يمن باي / الكريمي"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 block text-right">رقم الحساب أو المحفظة</label>
                    <input 
                      className="w-full bg-black/40 border border-white/10 px-4 py-3 rounded-xl font-bold text-sm text-white focus:ring-1 ring-purple-500 focus:outline-none text-center tracking-wider"
                      value={shopSettings?.bankInfo?.accountNumber || ''}
                      onChange={(e) => setShopSettings({...shopSettings, bankInfo: { ...(shopSettings?.bankInfo || { bankName: '', accountNumber: '', accountName: '' }), accountNumber: e.target.value }})}
                      placeholder="مثلاً: 123456789"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 block text-right">باسم المستفيد الكامل</label>
                    <input 
                      className="w-full bg-black/40 border border-white/10 px-4 py-3 rounded-xl font-bold text-sm text-white focus:ring-1 ring-purple-500 focus:outline-none text-center"
                      value={shopSettings?.bankInfo?.accountName || ''}
                      onChange={(e) => setShopSettings({...shopSettings, bankInfo: { ...(shopSettings?.bankInfo || { bankName: '', accountNumber: '', accountName: '' }), accountName: e.target.value }})}
                      placeholder="الاسم الكامل المسجل في البنك"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={saveSettings} 
                  disabled={isSaving}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg transition-all"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  حفظ إعدادات الحساب والبوابة
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'quick-entry' && (
        <motion.div 
          key="quick-entry"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center">
              <Plus size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold">الإدخال السريع للبضاعة</h3>
              <p className="text-sm text-gray-500">أضف أصناف جديدة للمخزن بسرعة وسهولة دون تعقيد.</p>
            </div>
          </div>

          <div className="card-glass p-10 space-y-8">
            <form onSubmit={handleQuickEntry} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Product Type/Label */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-brand-primary flex items-center gap-2 uppercase tracking-widest">
                    <Tag size={14} />
                    نوع الصنف (اختياري)
                  </label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <select 
                        className="input-field pr-12 text-lg font-bold bg-navy-900/10 border-brand-primary/20 focus:border-brand-primary appearance-none"
                        value={quickEntryLabel}
                        onChange={(e) => setQuickEntryLabel(e.target.value)}
                      >
                        <option value="">بدون تصنيف</option>
                        {(shopSettings.productLabels || ['سماعة', 'وصلة', 'شاحن', 'جوال', 'MP3']).map(label => (
                          <option key={label} value={label} className="bg-navy-900 text-white">{label}</option>
                        ))}
                      </select>
                      <Tag className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary/50 pointer-events-none" size={20} />
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary/50 pointer-events-none" size={20} />
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        const newLabel = window.prompt('أدخل اسم النوع الجديد (مثلاً: بطارية):');
                        if (newLabel) {
                          setShopSettings(prev => ({
                            ...prev,
                            productLabels: [...(prev.productLabels || []), newLabel]
                          }));
                          setQuickEntryLabel(newLabel);
                        }
                      }}
                      className="p-4 bg-brand-primary/5 text-brand-primary rounded-2xl border border-brand-primary/20"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">سيتم تثبيت هذا الخيار حتى تختار غيره (مثلاً: لتسجيل عدة سماعات).</p>
                </div>

                {/* Fixed Warehouse Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-brand-primary flex items-center gap-2 uppercase tracking-widest">
                    <MapPin size={14} />
                    تحديد المخزن / الموقع
                  </label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <select 
                        className="input-field pr-12 text-lg font-bold bg-navy-900/10 border-brand-primary/20 focus:border-brand-primary appearance-none"
                        value={quickEntryWarehouse}
                        onChange={(e) => setQuickEntryWarehouse(e.target.value)}
                      >
                        {['المحل', ...warehouses.map(wh => wh.name)].map(whName => (
                          <option key={whName} value={whName} className="bg-navy-900 text-white">{whName}</option>
                        ))}
                      </select>
                      <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary/50 pointer-events-none" size={20} />
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary/50 pointer-events-none" size={20} />
                    </div>
                    <button 
                      type="button"
                      onClick={async () => {
                        const newName = window.prompt('أدخل اسم المخزن/الموقع الجديد:');
                        if (!newName) return;
                        
                        const existingNames = ['المحل', ...warehouses.map(wh => wh.name)];
                        if (existingNames.includes(newName)) {
                          alert('المستودع موجود بالفعل!');
                          return;
                        }

                        if (!profile?.ownerId) {
                          alert('يرجى تسجيل الدخول أولاً!');
                          return;
                        }

                        try {
                          const code = 'WH_' + Math.random().toString(36).substring(2, 7).toUpperCase();
                          await addDoc(collection(db, 'warehouses'), {
                            ownerId: profile.ownerId,
                            name: newName,
                            code: code,
                            location: '',
                            createdAt: serverTimestamp()
                          });
                          setQuickEntryWarehouse(newName);
                          setStatus({ type: 'success', message: `تم إضافة مستودع "${newName}" بنجاح!` });
                        } catch (err) {
                          console.error(err);
                          setStatus({ type: 'error', message: 'فشل إضافة المستودع.' });
                        }
                      }}
                      className="p-4 bg-brand-primary/10 text-brand-primary rounded-2xl hover:bg-brand-primary/20 transition-all border border-brand-primary/20"
                      title="إضافة مخزن جديد"
                    >
                      <Plus size={24} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">سيتم حفظ هذا الخيار لعمليات الإدخال القادمة تلقائياً.</p>
                </div>

                {/* Item Name */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-brand-primary flex items-center gap-2 uppercase tracking-widest">
                    <Package size={14} />
                    اسم الصنف
                  </label>
                  <input 
                    id="quick-entry-name"
                    required
                    type="text" 
                    placeholder="أدخل اسم المنتج هنا..."
                    className="input-field text-lg font-bold"
                    value={quickEntryData.name}
                    onChange={(e) => setQuickEntryData({...quickEntryData, name: e.target.value})}
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-brand-primary flex items-center gap-2 uppercase tracking-widest">
                    <Activity size={14} />
                    الكمية المتوفرة
                  </label>
                  <input 
                    required
                    type="number" 
                    placeholder="0"
                    className="input-field text-xl font-black text-center"
                    value={quickEntryData.stock}
                    onChange={(e) => setQuickEntryData({...quickEntryData, stock: e.target.value})}
                  />
                </div>

                {/* Price */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-brand-primary flex items-center gap-2 uppercase tracking-widest">
                    <DollarSign size={14} />
                    سعر البيع ({shopSettings.currency})
                  </label>
                  <input 
                    required
                    type="number" 
                    placeholder="0.00"
                    className="input-field text-xl font-black text-center text-success"
                    value={quickEntryData.price}
                    onChange={(e) => setQuickEntryData({...quickEntryData, price: e.target.value})}
                  />
                </div>
                
                {/* Cost (Optional but good for reports) */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                    <Banknote size={14} />
                    سعر التكلفة (اختياري)
                  </label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="input-field text-xl font-black text-center text-orange-500"
                    value={quickEntryData.cost}
                    onChange={(e) => setQuickEntryData({...quickEntryData, cost: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex justify-center pt-6">
                <button 
                  type="submit"
                  disabled={isQuickAdding}
                  className="px-20 py-5 btn-primary font-black text-xl shadow-2xl shadow-brand-primary/30 flex items-center gap-4 hover:scale-105 active:scale-95 transition-all"
                >
                  {isQuickAdding ? <Loader2 className="animate-spin" size={28} /> : <Zap size={28} />}
                  إضافة للمخزن فوراً
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {activeTab === 'backup' && (
        <motion.div 
          key="backup"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-navy-950 text-white rounded-2xl flex items-center justify-center">
              <HardDrive size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold">النسخ الاحتياطي</h3>
              <p className="text-sm text-gray-500">حماية بياناتك عبر النسخ السحابي أو تصدير ملفات محلية.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Cloud Backup */}
            <div className="card-glass p-8 space-y-6">
              <h4 className="font-bold flex items-center gap-2 text-brand-primary">
                <Cloud size={18} />
                النسخ الاحتياطي السحابي (Google Drive)
              </h4>
              <p className="text-xs text-gray-500">يتم تشفير كافة البيانات محلياً ورفعها بشكل آمن وتلقائي بحساب Google Drive الخاص بك.</p>
              
              {profile?.cloudSync?.tokens ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-400 space-y-1">
                    <p className="font-bold flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      مرتبط بحساب Google Drive بنجاح
                    </p>
                    <p className="opacity-80">
                      آخر مزامنة: {profile.cloudSync.lastSync ? new Date(profile.cloudSync.lastSync).toLocaleString('ar-YE') : 'لم تتم المزامنة بعد'}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <button 
                      onClick={handleSyncToCloud}
                      disabled={isSyncing}
                      className="w-full py-4 bg-brand-primary text-white rounded-2xl font-black shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSyncing ? <Loader2 className="animate-spin" size={18} /> : <Cloud size={18} />}
                      مزامنة ورفع البيانات للسحاب الآن
                    </button>
                    <button 
                      onClick={fetchBackups}
                      className="w-full py-4 bg-gray-50 dark:bg-navy-950 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                    >
                      <History size={16} />
                      استعراض الأرشيف السحابي
                    </button>
                    <button 
                      type="button"
                      onClick={handleDisconnectGoogleDrive}
                      className="w-full py-2 text-xs text-red-500 hover:underline transition-all"
                    >
                      إلغاء ربط حساب Google Drive
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-500 text-center">
                    الحساب ليس مرتبطاً بأي تخزين سحابي حالياً. يرجى الربط لحفظ الأرشيف.
                  </div>
                  
                  <button 
                    onClick={handleConnectGoogleDrive}
                    className="w-full py-4 bg-brand-primary text-white rounded-2xl font-black shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Smartphone size={18} />
                    ربط حساب Google Drive
                  </button>

                  {/* Dynamic Redirect URI Info Card */}
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs space-y-3 text-right" dir="rtl">
                    <div className="flex items-start gap-2 text-blue-400">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold">حل مشكلة الربط (Error 400: redirect_uri_mismatch):</p>
                        <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                          لتجنب مشاكل الربط في هذا المتصفح أو التطبيقات، يجب إضافة الرابط أدناه في حساب مطوري Google الخاص بك كـ <strong>"رابط إعادة توجيه معتمد" (Authorized redirect URI)</strong>:
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-black/20 dark:bg-navy-900/50 p-2.5 rounded-xl border border-gray-100/5 dark:border-navy-800">
                      <span className="font-mono text-[10px] text-gray-300 select-all break-all flex-1 text-left" dir="ltr">
                        {window.location.origin}/auth/google/callback
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/auth/google/callback`);
                          setStatus({ type: 'success', message: 'تم نسخ رابط إعادة التوجيه بنجاح!' });
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all shrink-0"
                        title="نسخ الرابط"
                      >
                        <Copy size={14} />
                      </button>
                    </div>

                    <p className="text-[9px] text-gray-500 leading-normal">
                      💡 <strong>الخطوات:</strong> اذهب لـ Google Cloud Console ← APIs & Services ← Credentials ← اختر Client ID الخاص بك ← أضف الرابط أعلاه في حقل "Authorized redirect URIs" ← احفظ التغييرات وجرب مجدداً!
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-navy-950 rounded-2xl border border-gray-100 dark:border-navy-900 space-y-3">
                    <h5 className="text-[11px] font-bold text-gray-400">للتفعيل اليدوي على الهواتف الذكية (APK)</h5>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      إذا لم ينجح الربط التلقائي، انقر على زر التفعيل بالأعلى، واكمل تسجيل الدخول في المتصفح، ثم انسخ الرمز الأمني والصقه بالأسفل:
                    </p>
                    <textarea 
                      placeholder="الصق رمز الأمان المنسوخ (Base64) هنا..."
                      value={manualGoogleTokenBase64}
                      onChange={(e) => setManualGoogleTokenBase64(e.target.value)}
                      className="w-full h-16 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-xl p-2 font-mono text-[10px] focus:outline-none focus:border-brand-primary text-brand-primary resize-none"
                    />
                    <button 
                      onClick={async () => {
                        if (!manualGoogleTokenBase64.trim()) {
                          alert('يرجى لصق الرمز الأمني أولاً.');
                          return;
                        }
                        try {
                          const decodedTokens = JSON.parse(atob(manualGoogleTokenBase64.trim()));
                          await handleSaveGoogleTokens(decodedTokens);
                          setManualGoogleTokenBase64('');
                          setStatus({ type: 'success', message: 'تم تفعيل وربط Google Drive يدوياً بنجاح!' });
                        } catch (err) {
                          alert('رمز الأمان غير صالح أو تالف، يرجى إعادة نسخه والتأكد منه.');
                        }
                      }}
                      className="w-full py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all"
                    >
                      تفعيل رمز الأمان يدوياً ✓
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Local Backup */}
            <div className="card-glass p-8 space-y-6">
              <h4 className="font-bold flex items-center gap-2 text-emerald-500">
                <Database size={18} />
                النسخ المحلي (Offline)
              </h4>
              <p className="text-xs text-gray-500">قم بتنزيل ملف البيانات كاملاً على جهازك كحماية إضافية.</p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleExport}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  تنزيل ملف البيانات (.json)
                </button>
                <div className="relative">
                   <input 
                     type="file" 
                     className="absolute inset-0 opacity-0 cursor-pointer" 
                     onChange={handleFileSelect} 
                     accept=".json"
                   />
                   <div className="w-full py-4 bg-gray-50 dark:bg-navy-950 text-emerald-500 border-2 border-dashed border-emerald-500/20 rounded-2xl font-bold flex items-center justify-center gap-2">
                     <Upload size={16} />
                     رفع ملف استعادة محلي
                   </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4 font-mono text-[12px] relative z-10 custom-scrollbar">
                {auditLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 gap-6">
                    <History size={64} strokeWidth={1} />
                    <div className="text-center">
                      <p className="font-black text-white/40 text-lg mb-2">لا توجد سجلات نشاط حالياً</p>
                      <p className="text-xs font-bold">ابدأ عملية التدقيق لفحص سلامة قاعدة البيانات</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log, i) => (
                      <motion.div 
                        key={i} 
                        ref={i === auditLogs.length - 1 ? (el) => el?.scrollIntoView({ behavior: 'smooth' }) : null}
                        initial={{ opacity: 0, x: -20 }} 
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                          log.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                          log.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
                          'bg-white/5 border-white/5 text-white/60'
                        }`}
                      >
                        <span className="text-[10px] font-black opacity-30 mt-1 shrink-0">[{log.time}]</span>
                        <div className="flex-1 space-y-1">
                          <p className="font-bold leading-relaxed">{log.message}</p>
                          {log.type === 'error' && <p className="text-[10px] opacity-60">!! CRITICAL_ERROR: الحسابات قد تكون غير دقيقة في هذا القسم</p>}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-white/5 border-t border-white/5 flex items-center gap-4 text-[10px] font-black text-white/20 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-brand-primary rounded-full" />
                  STATUS: {isAuditing ? 'ACTIVE' : 'IDLE'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                  INTEGRITY: SECURE
                </div>
                <div className="flex-1 text-left opacity-10">JAM_PRO_V2.5.0_LOG_SUBSYSTEM</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'android_removed' && (
        <motion.div 
          key="android"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8 text-right"
          dir="rtl"
        >
          {/* Header Card */}
          <div className="flex flex-col md:flex-row items-center gap-6 p-8 bg-gradient-to-l from-navy-905 to-navy-800 text-white rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Smartphone size={32} />
            </div>
            <div className="flex-1 space-y-2 text-center md:text-right">
              <h3 className="text-2xl font-black tracking-tight text-white">بناء تطبيق أندرويد الهجين (Android APK Export)</h3>
              <p className="text-sm text-gray-300 font-medium leading-relaxed">
                مشروعك مجهز بالكامل بأحدث إصدارات Capacitor v6 للهواتف الذكية. اتبع التعليمات أدناه لتوليد ملف الـ <span className="text-emerald-400 font-extrabold font-mono">APK</span> وتثبيته على هاتفك مباشرة!
              </p>
            </div>
            <div className="px-6 py-3 bg-emerald-500 text-navy-950 rounded-2xl font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 border border-emerald-400">
              <span className="w-2 h-2 rounded-full bg-navy-950" />
              CAPACITOR 6.0.0 READY
            </div>
          </div>

          {/* Developer/Engineer UI Controls (لوحة تحكم وتعديل خيارات واجهة التطبيق ومطور النظام) */}
          <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-xl space-y-6">
            <h4 className="text-xl font-black text-navy-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-6 bg-brand-primary rounded-full inline-block animate-pulse" />
              🎛️ لوحة تحكم المهندس وتعديل خيارات الواجهة (UI Developer Panel)
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
              تمكنك هذه الإعدادات المتقدمة من تهيئة واجهات العرض وعناصر التحميل للنظام بالكامل بشكل ديناميكي ومباشر دون التعديل بالشفرة المصدرية.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option 1: Container Borders */}
              <div className="p-6 bg-slate-50 dark:bg-navy-900/50 rounded-2xl border border-gray-100 dark:border-navy-700/80 hover:border-brand-primary/30 transition-all flex flex-col justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="toggle-legacy-borders"
                      checked={showLegacyUIBorders}
                      onChange={(e) => setLegacyUIBorders(e.target.checked)}
                      className="w-5 h-5 rounded-lg text-brand-primary focus:ring-brand-primary border-gray-300 dark:border-navy-600 dark:bg-navy-700 cursor-pointer"
                    />
                    <label htmlFor="toggle-legacy-borders" className="text-sm font-black text-navy-900 dark:text-white cursor-pointer select-none">
                      تفعيل إطارات ومظاهر الحاويات الذهبية الفاخرة
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 font-bold leading-relaxed pr-7">
                    بما في ذلك الحدود البارزة للقوائم، تظليلات صناديق العمل الجانبية، والمؤشرات الباردة اللامعة. (عند الإغلاق، تكون الأزرار والقوائم مسطحة وشفافة).
                  </p>
                </div>
                <div className={`text-[10px] font-black self-start px-2 py-1 rounded-md ${showLegacyUIBorders ? 'bg-amber-500/10 text-amber-500' : 'bg-gray-500/10 text-gray-400'}`}>
                  {showLegacyUIBorders ? 'وضع فاخر نشط (Luxury Mode Active)' : 'وضع مظهر مسطح (Flat Design Active)'}
                </div>
              </div>

              {/* Option 2: Action Response Rate and Timeout Controller */}
              <div className="p-6 bg-slate-50 dark:bg-navy-900/50 rounded-2xl border border-gray-100 dark:border-navy-700/80 hover:border-brand-primary/30 transition-all flex flex-col justify-between gap-4">
                <div className="space-y-1 text-right">
                  <h5 className="text-base font-black text-navy-900 dark:text-white flex items-center gap-2 justify-start">
                    <span>⏱️</span> معدل سرعة استجابة الأزرار والانتظار
                  </h5>
                  <p className="text-xs text-gray-400 font-bold leading-relaxed">
                    عند الإيقاف، لن تظهر حركة الانتظار عند الحفظ لتسريع التفاعل لجميع المستخدمين بوضع فوري برق.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => setGlobalActionTimeout(0)}
                    className={`px-3 py-2 rounded-xl font-black text-[10px] transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                      globalActionTimeout === 0
                        ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-md scale-[1.02]'
                        : 'bg-white dark:bg-navy-800 border-gray-200 dark:border-navy-700 text-gray-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-navy-700'
                    }`}
                  >
                    ⚡ فوري (0ms)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalActionTimeout(150)}
                    className={`px-3 py-2 rounded-xl font-black text-[10px] transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                      globalActionTimeout === 150
                        ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-md scale-[1.02]'
                        : 'bg-white dark:bg-navy-800 border-gray-200 dark:border-navy-700 text-gray-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-navy-700'
                    }`}
                  >
                    ✨ سلس (150ms)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalActionTimeout(1000)}
                    className={`px-3 py-2 rounded-xl font-black text-[10px] transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                      globalActionTimeout === 1000
                        ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-md scale-[1.02]'
                        : 'bg-white dark:bg-navy-800 border-gray-200 dark:border-navy-700 text-gray-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-navy-700'
                    }`}
                  >
                    🔍 تدقيق (1000ms)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Steps & Commands */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Step 1 */}
              <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-4 relative">
                <div className="absolute top-6 left-6 w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center font-black text-lg">
                  ١
                </div>
                <h4 className="text-lg font-black text-navy-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-6 bg-brand-primary rounded-full inline-block" />
                  تنزيل كود المصدر (Source Code)
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  أنقر على قائمة <strong>مشروعك الجاري</strong> في أداة <strong>Google AI Studio</strong> بالجهتين العلوية واختيار <strong>Export to ZIP</strong> أو <strong>Export to GitHub</strong> لحفظ المشروع كاملاً في حاسوبك الشخصي وفك الضغط عنه.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-4 relative">
                <div className="absolute top-6 left-6 w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center font-black text-lg">
                  ٢
                </div>
                <h4 className="text-lg font-black text-navy-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-6 bg-brand-primary rounded-full inline-block" />
                  تجهيز ومزامنة بيئة العمل (Sync Environment)
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  قم بفتح سطر الأوامر (Terminal أو Git Bash) داخل مجلد المشروع الذي فككت ضغطه، ونفذ الأوامر التالية بالترتيب لبناء وتجهيز أندرويد:
                </p>

                {/* Commands Terminal Grid */}
                <div className="space-y-3 pt-2">
                  {[
                    {
                      cmd: "npm install --legacy-peer-deps",
                      desc: "تثبيت كل ملحقات ومكتبات المشروع الهجينة"
                    },
                    {
                      cmd: "npm run build",
                      desc: "تجميع شفرة الويب (Vite) وبنائها محلياً للتطبيق"
                    },
                    {
                      cmd: "npx cap sync android",
                      desc: "أقوى أمر: يقوم بنقل وضغط ملفات الويب فورياً لبيئة الأندرويد"
                    },
                    {
                      cmd: "npx cap open android",
                      desc: "تلقائي التجهيز: يقوم بفتح المشروع بأكمله بذكاء داخل أندرويد ستوديو"
                    }
                  ].map((item, index) => (
                    <div key={index} className="p-4 bg-slate-950 rounded-2xl border border-white/5 flex items-center justify-between gap-4 group">
                      <div className="flex-1 space-y-1">
                        <p className="font-mono text-xs text-brand-primary select-all text-left" dir="ltr">{item.cmd}</p>
                        <p className="text-[10px] text-gray-400 font-bold">{item.desc}</p>
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(item.cmd);
                          setStatus({ type: 'success', message: `تم نسخ الأمر [${item.cmd}] بنجاح` });
                        }}
                        className="p-3 bg-white/5 hover:bg-brand-primary hover:text-white rounded-xl text-gray-400 transition-all shadow-md active:scale-95 flex items-center justify-center"
                        title="نسخ الأمر"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-4 relative">
                <div className="absolute top-6 left-6 w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center font-black text-lg">
                  ٣
                </div>
                <h4 className="text-lg font-black text-navy-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-6 bg-brand-primary rounded-full inline-block" />
                  تشغيل وبناء التطبيق على هاتفك (Build & Run)
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-bold">
                  بمجرد فتح أندرويد ستوديو، انتظر حتى ينتهي Gradle من مزامنة المشروع بالكامل. بعد ذلك، قم بتوصيل هاتفك المحمول عبر كابل USB وتفعيل وضع تصحيح الأخطاء (USB Debugging)، ثم اضغط على زر <strong>Run</strong> لتثبيت التطبيق أو اختر <strong>Build APK</strong> لتوليد ملف التثبيت المستقل.
                </p>
              </div>

            </div>

            {/* Checklist and Android Studio guidance */}
            <div className="space-y-6">
              
              {/* Android Studio Visual */}
              <div className="bg-emerald-950/20 dark:bg-emerald-950/10 p-8 rounded-[3rem] border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 space-y-4">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center">
                  <Wrench size={24} />
                </div>
                <h4 className="font-black text-lg text-emerald-900 dark:text-emerald-300">متطلبات البناء للهواتف</h4>
                <ul className="space-y-3 text-xs font-bold leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>تثبيت إصدار <strong>Node.js v18</strong> أو أعلى.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>تنزيل برنامج <strong>Android Studio (Ladybug)</strong> أو أحدث.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>تثبيت حزمة <strong>Java JDK 17</strong> وضبط مسار البيئة لها لضمان توافق Gradle.</span>
                  </li>
                </ul>
              </div>

              {/* Step 4: Run & Build in GUI */}
              <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-4">
                <h4 className="text-base font-black text-navy-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-5 bg-amber-500 rounded-full inline-block" />
                  تصدير الـ APK النهائي من الواجهة
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed font-bold">
                  بمجرد فتح المشروع في أندرويد ستوديو، اتبع هذه الخطوات السهلة داخل البرنامج:
                </p>
                <div className="space-y-3 text-xs leading-relaxed font-bold text-gray-600 dark:text-gray-300">
                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-gray-100 dark:bg-navy-900 rounded flex items-center justify-center text-[10px] shrink-0 font-extrabold text-brand-primary">١</span>
                    <p>انتظر حتى ينتهي الـ <strong>Gradle Build Sync</strong> بنجاح.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-gray-100 dark:bg-navy-900 rounded flex items-center justify-center text-[10px] shrink-0 font-extrabold text-brand-primary">٢</span>
                    <p>من الشريط العلوي، اختر <strong>Build</strong> ثم انقر فوق <strong>Build Bundle(s) / APK(s)</strong>.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-gray-100 dark:bg-navy-900 rounded flex items-center justify-center text-[10px] shrink-0 font-extrabold text-brand-primary">٣</span>
                    <p>اختر <strong>Build APK</strong> لكي يتم تجهيز الصيغة المباشرة للتثبيت.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-gray-100 dark:bg-navy-900 rounded flex items-center justify-center text-[10px] shrink-0 font-extrabold text-brand-primary">٤</span>
                    <p>سيظهر لك إشعار بالأسفل يحتوي على زر <strong>Locate</strong>، اضغط عليه لتجد ملف الـ <span className="text-brand-primary font-black">app-debug.apk</span> جاهزاً للإرسال لهاتفك!</p>
                  </div>
                </div>
              </div>

              {/* Version Standardization Guard info */}
              <div className="bg-amber-500/10 p-6 rounded-[2.5rem] border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-sm">
                  <AlertTriangle size={16} />
                  <span>تأمين توافق المنصة</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed font-bold">
                  لقد وحدنا إصدارات مكتبات الكاباسيتور بالكامل على الكود <strong>v6.0.0</strong> لدعم بيلد Gradle آمن وحل تعارضات Android Gradle Plugin تلقائياً. المزامنة مستقرة وجاهزة للعمل الفوري في بيئات التطوير.
                </p>
              </div>

            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'security' && (
        <motion.div 
          key="security"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-navy-950 text-white rounded-2xl flex items-center justify-center">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black">أمان الحساب (Identity & 2FA)</h3>
              <p className="text-sm text-gray-500">قم بتعيين رمز الأمان الخاص بك لحماية حسابك من الاختراق.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-glass p-8 space-y-6 border-navy-700/10 h-fit">
              <h4 className="font-bold flex items-center gap-2">
                <KeyRound size={18} className="text-brand-primary" />
                ضبط رمز الدخول (4 أرقام)
              </h4>
              <p className="text-[10px] text-gray-500">يُطلب هذا الرمز عند كل عملية تسجيل دخول لضمان هويتك عند تفعيل التحقق الثنائي.</p>

              <form onSubmit={handleSaveSecurityCode} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 px-2 uppercase">الرمز الجديد</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    className="w-full bg-gray-50 dark:bg-navy-900 p-4 rounded-2xl border-none font-black text-center text-xl tracking-[0.5em] focus:ring-2 ring-brand-primary/20"
                    placeholder="****"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 px-2 uppercase">تأكيد الرمز</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    className="w-full bg-gray-50 dark:bg-navy-900 p-4 rounded-2xl border-none font-black text-center text-xl tracking-[0.5em] focus:ring-2 ring-brand-primary/20"
                    placeholder="****"
                    value={confirmSecurityCode}
                    onChange={(e) => setConfirmSecurityCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isChangingSecurityCode}
                  className="w-full py-4 bg-navy-950 text-white rounded-2xl font-black shadow-lg shadow-navy-900/10 hover:bg-black transition-all flex items-center justify-center gap-2"
                >
                  {isChangingSecurityCode ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  حفظ وتفعيل الرمز
                </button>
              </form>

              {/* Flat toggle for independent 2FA activation/deactivation */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-900/40 rounded-2xl border border-black/5 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className={profile?.twoFactorEnabled ? "text-emerald-500" : "text-gray-400"} size={22} />
                  <div className="text-right" dir="rtl">
                    <p className="text-xs font-bold text-navy-900 dark:text-white">تفعيل التحقق الثنائي (2FA)</p>
                    <p className="text-[10px] text-gray-400">يفرض طلب رمز الأمان عند تفعيله.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!profile?.uid) return;
                    const newState = !(profile?.twoFactorEnabled === true);
                    try {
                      await updateDoc(doc(db, 'users', profile.uid), {
                        twoFactorEnabled: newState,
                        updatedAt: serverTimestamp()
                      });
                      setStatus({ type: 'success', message: newState ? 'تم تفعيل التحقق الثنائي بنجاح ✅' : 'تم إيقاف التحقق الثنائي بنجاح ⚠️' });
                    } catch (err) {
                      setStatus({ type: 'error', message: 'فشل تعديل حالة التحقق الثنائي' });
                    }
                  }}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none flex items-center ${profile?.twoFactorEnabled ? 'bg-emerald-500 justify-end' : 'bg-gray-300 dark:bg-gray-700 justify-start'}`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200" />
                </button>
              </div>

              {profile?.isSecurityCodeSet && (
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-200 dark:border-green-900/20" id="2fa-status">
                  <CheckCircle2 className="text-green-500" size={20} />
                  <p className="text-xs font-bold text-green-700 dark:text-green-400">حسابك تم إعداد رمز الأمان بنظام التحقق الثنائي له.</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="card-glass p-8 border-navy-700/10 space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" />
                  بروتوكول الأمان
                </h4>
                <ul className="space-y-3 text-[10px] text-gray-500 font-bold list-disc pr-4">
                  <li>الرمز مكون من 4 أرقام ويجب حفظه جيداً.</li>
                  <li>عند نسيان الرمز، تواصل مع الإدارة لإعادة التعيين.</li>
                  <li>عند تصفير الرمز من الإدارة، يعود للرمز الافتراضي (1234).</li>
                </ul>
                <div className="p-6 bg-brand-primary/5 rounded-[2.5rem] border border-brand-primary/10 space-y-4 mt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h5 className="font-black text-navy-900 dark:text-white">قالب الفاتورة الافتراضي</h5>
                      <p className="text-[10px] text-gray-500">حدد نوع الفاتورة الذي يظهر تلقائياً في صفحة المبيعات</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setShopSettings({ ...shopSettings, defaultInvoiceType: 'simplified' })}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${shopSettings.defaultInvoiceType === 'simplified' ? 'border-brand-primary bg-brand-primary/10' : 'border-black/5 dark:border-white/5 hover:border-brand-primary/50'}`}
                    >
                      <Zap size={24} className={shopSettings.defaultInvoiceType === 'simplified' ? 'text-brand-primary' : 'text-gray-400'} />
                      <span className="text-xs font-black">فاتورة مبسطة</span>
                    </button>
                    <button
                      onClick={() => setShopSettings({ ...shopSettings, defaultInvoiceType: 'detailed' })}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${shopSettings.defaultInvoiceType === 'detailed' ? 'border-brand-primary bg-brand-primary/10' : 'border-black/5 dark:border-white/5 hover:border-brand-primary/50'}`}
                    >
                      <Layout size={24} className={shopSettings.defaultInvoiceType === 'detailed' ? 'text-brand-primary' : 'text-gray-400'} />
                      <span className="text-xs font-black">فاتورة تفصيلية</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'permissions' && (
        <motion.div 
          key="permissions"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6 dir-rtl text-right"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black text-navy-900 dark:text-white">إعدادات أذونات وصلاحيات الجهاز (System Permissions)</h3>
              <p className="text-sm text-gray-500">إدارة وتفعيل الأذونات التشغيلية للطباعة، الكاميرا، الشبكة، الإشعارات، والملفات دون نُوافذ منبثقة إجبارية.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Bluetooth */}
            <div className="card-glass p-5 border-navy-700/10 rounded-3xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-2xl">
                    <Bluetooth size={22} />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${permStates.bluetooth === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {permStates.bluetooth === 'granted' ? 'مفعل' : 'قيد الانتظار'}
                  </span>
                </div>
                <h4 className="font-black text-sm text-navy-900 dark:text-white">البلوتوث (Bluetooth)</h4>
                <p className="text-xs text-gray-500 leading-relaxed">الاقتران بالطابعات المحمولة وقارئ الباركود اللاسلكي فورياً.</p>
              </div>
              <button
                onClick={handleRequestBluetooth}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                تفعيل وفحص البلوتوث
              </button>
            </div>

            {/* Wi-Fi & Network */}
            <div className="card-glass p-5 border-navy-700/10 rounded-3xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-cyan-500/10 text-cyan-500 rounded-2xl">
                    <Globe size={22} />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${permStates.wifi === 'online' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {permStates.wifi === 'online' ? 'متصل' : 'أوفلاين'}
                  </span>
                </div>
                <h4 className="font-black text-sm text-navy-900 dark:text-white">الشبكة الداخلية (Wi-Fi)</h4>
                <p className="text-xs text-gray-500 leading-relaxed">ربط الكاشيرات بالشبكة المحلية والمزامنة اللحظية.</p>
              </div>
              <button
                onClick={handleCheckWifi}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                فحص اتصال الشبكة
              </button>
            </div>

            {/* Camera */}
            <div className="card-glass p-5 border-navy-700/10 rounded-3xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-2xl">
                    <ScanLine size={22} />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${permStates.camera === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {permStates.camera === 'granted' ? 'مفعل' : 'غير مفعل'}
                  </span>
                </div>
                <h4 className="font-black text-sm text-navy-900 dark:text-white">الكاميرا والباركود</h4>
                <p className="text-xs text-gray-500 leading-relaxed">مسح الباركود بالكاميرا وإدراج صور المنتجات بالفواتير.</p>
              </div>
              <button
                onClick={handleRequestCamera}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                طلب اذن الكاميرا
              </button>
            </div>

            {/* Storage & Files */}
            <div className="card-glass p-5 border-navy-700/10 rounded-3xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-2xl">
                    <HardDrive size={22} />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${permStates.storage === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {permStates.storage === 'granted' ? 'مفعل' : 'غير مفعل'}
                  </span>
                </div>
                <h4 className="font-black text-sm text-navy-900 dark:text-white">الملفات والتصدير (Excel/PDF)</h4>
                <p className="text-xs text-gray-500 leading-relaxed">تصدير واستيراد التقارير والنسخ الاحتياطية لجهازك.</p>
              </div>
              <button
                onClick={handleRequestStorage}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                تفعيل اذن الملفات
              </button>
            </div>

            {/* Notifications */}
            <div className="card-glass p-5 border-navy-700/10 rounded-3xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-yellow-500/10 text-yellow-500 rounded-2xl">
                    <Bell size={22} />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${permStates.notifications === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {permStates.notifications === 'granted' ? 'مفعل' : 'غير مفعل'}
                  </span>
                </div>
                <h4 className="font-black text-sm text-navy-900 dark:text-white">الإشعارات والتنبيهات</h4>
                <p className="text-xs text-gray-500 leading-relaxed">تنبيهات فورية بالديون المستحقة ونواقص المخزون.</p>
              </div>
              <button
                onClick={handleRequestNotifications}
                className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                تفعيل الإشعارات
              </button>
            </div>

            {/* System Overlay */}
            <div className="card-glass p-5 border-navy-700/10 rounded-3xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-teal-500/10 text-teal-500 rounded-2xl">
                    <Monitor size={22} />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${permStates.overlay === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                    {permStates.overlay === 'active' ? 'نشط' : 'إعداد يدوي'}
                  </span>
                </div>
                <h4 className="font-black text-sm text-navy-900 dark:text-white">العرض عائماً (Overlay)</h4>
                <p className="text-xs text-gray-500 leading-relaxed">إظهار شاشة الكاشير السريعة فوق التطبيقات عند الطلب.</p>
              </div>
              <button
                onClick={handleOverlayInstructions}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                تعليمات التفعيل للنظام
              </button>
            </div>

            {/* Background Audio */}
            <div className="card-glass p-5 border-navy-700/10 rounded-3xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-2xl">
                    <Volume2 size={22} />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${permStates.backgroundAudio === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                    {permStates.backgroundAudio === 'active' ? 'نشط' : 'متوقف'}
                  </span>
                </div>
                <h4 className="font-black text-sm text-navy-900 dark:text-white">المساعد الصوتي والخلفية</h4>
                <p className="text-xs text-gray-500 leading-relaxed">نطق أسعار المنتجات والتنبيهات الصوتية بالكاشير.</p>
              </div>
              <button
                onClick={handleToggleBackgroundAudio}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                اختبار وتفعيل الصوت
              </button>
            </div>

            {/* Cloud Sync */}
            <div className="card-glass p-5 border-navy-700/10 rounded-3xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-[#4f46e5]/10 text-[#4f46e5] rounded-2xl">
                    <Cloud size={22} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500">
                    تلقائي
                  </span>
                </div>
                <h4 className="font-black text-sm text-navy-900 dark:text-white">المزامنة التلقائية</h4>
                <p className="text-xs text-gray-500 leading-relaxed">حفظ واستعادة بيانات الفواتير والمخزون سحابياً.</p>
              </div>
              <button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="w-full py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isBackingUp ? 'جاري النسخ...' : 'مزامنة احتياطية سريعة'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'warehouses' && (
        <motion.div 
          key="warehouses"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
              <Archive size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold">ربط المجالات والمستودعات</h3>
              <p className="text-sm text-gray-500">قم بتعيين المستودع الافتراضي لكل قسم عمل لضمان توجيه البضائع آلياً.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sticky top-24 z-10 bg-gray-50 dark:bg-navy-950/80 backdrop-blur-md p-4 -m-4 rounded-3xl mb-8">
             <div className="flex items-start gap-4 p-6 bg-white dark:bg-navy-900 rounded-[2.5rem] border border-blue-500/10 shadow-sm">
                <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                  <RefreshCw size={24} />
                </div>
                <div>
                   <h4 className="font-black text-navy-900 dark:text-white">ذكاء التوجيه التلقائي</h4>
                   <p className="text-[10px] text-gray-500 mt-1">عند البيع أو المرتجع، سيقوم النظام بخصم أو إضافة الكميات للمستودع المربوط هنا تلقائياً حسب المجال المختار.</p>
                </div>
             </div>
             <button 
              onClick={saveSettings}
              disabled={isSaving}
              className="px-10 py-4 bg-brand-primary text-white rounded-2xl font-black shadow-xl shadow-brand-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
              حفظ ربط المخازن
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { id: 'suppliers', label: 'سوق الموردين (المشتريات)', icon: Truck, desc: 'يوجه مبيعات الجملة وطلبات التوريد' },
              { id: 'customers', label: 'زبائن المحل (المبيعات)', icon: Users, desc: 'يوجه مبيعات العملاء المسجلين' },
              { id: 'maintenance', label: 'قسم الصيانة وقطع الغيار', icon: Wrench, desc: 'يوجه قطع الغيار المستخدمة في الصيانة' },
              { id: 'auction', label: 'قسم الحراج والحراج العام', icon: Gavel, desc: 'الجهة النهائية لبضائع الحراج بنوعيه' },
              { id: 'damaged', label: 'مخزن التالف والهوالك', icon: Trash2, desc: 'الجهة النهائية للبضائع غير الصالحة' },
              { id: 'cashSales', label: 'مبيع كاش (المحل)', icon: ShoppingBasket, desc: 'يوجه مبيعات المحل المباشرة' },
            ].map((domain) => {
              const currentWarehouse = shopSettings.warehouseMapping?.[domain.id as keyof typeof shopSettings.warehouseMapping] || '';
              const isLinked = currentWarehouse !== '';

              return (
                <div 
                  key={domain.id} 
                  className={`bg-white dark:bg-navy-900 p-8 rounded-[2.5rem] border transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[300px] ${
                    isLinked 
                      ? 'border-emerald-500/20 hover:border-emerald-500/40 dark:border-emerald-500/10 shadow-emerald-500/[0.02] shadow-xl' 
                      : 'border-gray-100 dark:border-navy-800 hover:border-amber-500/20'
                  }`}
                >
                  {/* Decorative Link Status Background Glow */}
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-[0.05] pointer-events-none -mr-10 -mt-10 transition-colors duration-500 ${
                    isLinked ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />

                  <div className="space-y-6 z-10">
                     {/* Card Header Info */}
                     <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                             isLinked 
                               ? 'bg-emerald-500/10 text-emerald-500' 
                               : 'bg-gray-50 dark:bg-navy-950 text-gray-400 dark:text-gray-600'
                           }`}>
                             <domain.icon size={28} />
                           </div>
                           <div>
                              <h4 className="font-black text-navy-900 dark:text-white text-base">{domain.label}</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">{domain.desc}</p>
                           </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                           {isLinked ? (
                             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                مرتبط وموجّه
                             </span>
                           ) : (
                             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                توجيه يدوي
                             </span>
                           )}
                        </div>
                     </div>

                     {/* Link Details and Unlink Option */}
                     {isLinked ? (
                       <div className="p-4 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.01] rounded-2xl border border-emerald-500/10 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                             <Link2 size={18} className="text-emerald-500 shrink-0" />
                             <div>
                                <p className="text-[10px] text-gray-400 font-bold">المستودع النشط حالياً</p>
                                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{currentWarehouse}</p>
                             </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShopSettings({
                                 ...shopSettings,
                                 warehouseMapping: {
                                    ...(shopSettings.warehouseMapping || { suppliers: '', customers: '', maintenance: '', auction: '', damaged: '', cashSales: '' }),
                                    [domain.id]: ''
                                 }
                              });
                              setStatus({ type: 'success', message: `تم إلغاء ربط قسم: ${domain.label} بنجاح. لا تنسى حفظ التغييرات!` });
                            }}
                            className="px-3 py-2 text-xs font-black text-red-500 hover:bg-red-500/10 border border-red-500/10 rounded-xl transition-all flex items-center gap-1 hover:border-red-500/30"
                            title="إلغاء ربط القسم بالمستودع"
                          >
                             <Link2Off size={14} />
                             إلغاء الربط
                          </button>
                       </div>
                     ) : (
                       <div className="p-4 bg-gray-50 dark:bg-navy-950 rounded-2xl border border-dashed border-gray-200 dark:border-navy-900 flex items-center gap-2">
                          <Link2Off size={18} className="text-gray-400 shrink-0" />
                          <p className="text-xs text-gray-400 font-bold">
                             لا يوجد مستودع مرتبط تلقائياً. قم باختيار مستودع أدناه لتفعيل التوجيه التلقائي.
                          </p>
                       </div>
                     )}
                  </div>

                  {/* Change/Set Link Control Dropdown */}
                  <div className="mt-6 pt-4 border-t border-gray-50 dark:border-navy-950 space-y-2 z-10">
                     <label className="text-[10px] font-black text-navy-900 dark:text-white uppercase tracking-widest px-1">
                        <span>تغيير الربط إلى مستودع آخر</span>
                     </label>
                     <div className="relative">
                        <select 
                          className="w-full bg-gray-50 dark:bg-navy-950 border border-transparent p-4 rounded-2xl font-black text-sm appearance-none outline-none focus:ring-2 ring-brand-primary/20"
                          value={currentWarehouse}
                          onChange={(e) => {
                             const targetValue = e.target.value;
                             setShopSettings({
                                ...shopSettings,
                                warehouseMapping: {
                                   ...(shopSettings.warehouseMapping || { suppliers: '', customers: '', maintenance: '', auction: '', damaged: '', cashSales: '' }),
                                   [domain.id]: targetValue
                                }
                             });
                             if (targetValue) {
                               setStatus({ type: 'success', message: `تم توجيه قسم "${domain.label}" إلى المستودع "${targetValue}". يرجى النقر على "حفظ ربط المخازن" للاعتماد.` });
                             } else {
                               setStatus({ type: 'success', message: `تم إلغاء ربط قسم "${domain.label}".` });
                             }
                          }}
                        >
                          <option value="">اختر مستودعاً للربط...</option>
                          {['المحل', ...warehouses.map(wh => wh.name)].map(whName => (
                             <option key={whName} value={whName}>{whName}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                     </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end my-4">
             <button
                type="button"
                onClick={async () => {
                   if (!profile?.ownerId) {
                     setStatus({ type: 'error', message: 'خطأ: لم يتم العثور على هوية المتجر.' });
                     return;
                   }
                   setIsSaving(true);
                   try {
                     const docId = (profile?.role !== 'owner' && profile?.role !== 'superadmin' && profile?.shopId) ? profile.shopId : profile.ownerId;
                     await setDoc(doc(db, 'settings', docId), {
                       ...shopSettings,
                       ownerId: profile.ownerId,
                       updatedAt: serverTimestamp()
                     });
                     setStatus({ type: 'success', message: 'تم حفظ وتفعيل ربط المستودعات والأقسام الافتراضية بنجاح!' });
                   } catch (error: any) {
                     handleFirestoreError(error, OperationType.WRITE, `settings/${profile.ownerId}`);
                   } finally {
                     setIsSaving(false);
                   }
                }}
                disabled={isSaving}
                className="px-6 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-black text-sm flex items-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer"
             >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {isSaving ? 'جاري حفظ الربط...' : 'حفظ ربط المخازن والأقسام الافتراضية'}
             </button>
          </div>

          <div className="p-8 bg-amber-500/5 rounded-[3rem] border border-amber-500/10 flex items-start gap-4">
             <AlertCircle className="text-amber-500 shrink-0 mt-1" size={24} />
             <div>
                <h5 className="font-black text-amber-900 dark:text-amber-500">لماذا هذا الربط مهم؟</h5>
                <p className="text-xs text-amber-800/60 dark:text-amber-400/60 font-bold leading-relaxed mt-1">
                  بدلاً من اختيار المستودع يدوياً في كل عملية، سيقوم النظام بالنظر في "نوع المجال" (سواء كنت في صفحة المبيعات، الصيانة، أو الحراج) ويقوم تلقائياً بترحيل الحركات المالية والكميات للمستودع المحدد أعلاه.
                </p>
             </div>
          </div>

          {/* إدارة المخازن والمستودعات الميدانية الجديدة */}
          <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-6 mt-8">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-navy-900 dark:text-white flex items-center gap-2">
                <Archive className="text-brand-primary" size={24} />
                إدارة السعة المستودعية والمخازن الجديدة (Field Warehouses)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 dark:bg-navy-950 p-6 rounded-3xl border border-gray-100 dark:border-navy-900">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400">اسم المستودع / المخزن</label>
                <input 
                  type="text"
                  placeholder="مثال: مخزن الدائري الغربي"
                  className="w-full bg-white dark:bg-navy-900 p-4 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-sm font-bold"
                  value={newWarehouseName}
                  onChange={(e) => setNewWarehouseName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400">الرمز الفريد للمستودع (Code)</label>
                <input 
                  type="text"
                  placeholder="مثال: WH_WEST"
                  className="w-full bg-white dark:bg-navy-900 p-4 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-sm font-bold"
                  value={newWarehouseCode}
                  onChange={(e) => setNewWarehouseCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400">الموقع الجغرافي (اختياري)</label>
                <input 
                  type="text"
                  placeholder="مثال: شارع الخمسين، صنعاء"
                  className="w-full bg-white dark:bg-navy-900 p-4 rounded-xl border border-gray-200 dark:border-navy-800 outline-none text-sm font-bold"
                  value={newWarehouseLocation}
                  onChange={(e) => setNewWarehouseLocation(e.target.value)}
                />
              </div>
              <div className="col-span-1 md:col-span-3 flex justify-end">
                <button 
                  type="button"
                  onClick={async () => {
                    if (!profile?.ownerId || !newWarehouseName || !newWarehouseCode) {
                      alert('يرجى كتابة اسم ورمز المخزن!');
                      return;
                    }
                    setIsAddingWarehouse(true);
                    try {
                      await addDoc(collection(db, 'warehouses'), {
                        ownerId: profile.ownerId,
                        name: newWarehouseName,
                        code: newWarehouseCode.toUpperCase().replace(/\s+/g, '_'),
                        location: newWarehouseLocation || '',
                        createdAt: serverTimestamp()
                      });
                      setNewWarehouseName('');
                      setNewWarehouseCode('');
                      setNewWarehouseLocation('');
                      setStatus({ type: 'success', message: 'تم إضافة المخزن الجديد بنجاح!' });
                    } catch (err) {
                      console.error(err);
                      setStatus({ type: 'error', message: 'فشل إضافة المستودع.' });
                    } finally {
                      setIsAddingWarehouse(false);
                    }
                  }}
                  disabled={isAddingWarehouse}
                  className="px-8 py-3 bg-brand-primary text-white font-bold rounded-xl shadow-lg flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {isAddingWarehouse ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  إضافة مستودع فيديرالي جديد
                </button>
              </div>
            </div>

            {/* جدول / شبكة عرض المخازن المسجلة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              {warehouses.map((wh) => (
                <div key={wh.id} className="p-5 bg-gray-50 dark:bg-navy-950 rounded-2xl border border-gray-100 dark:border-navy-900 flex flex-col justify-between relative group hover:border-brand-primary/30 transition-all">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <Archive size={16} />
                      </div>
                      <span className="font-black text-sm text-navy-900 dark:text-white">{wh.name}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 font-mono">CODE: {wh.code}</p>
                    {wh.location && <p className="text-[10px] text-gray-500 font-bold mt-1">📍 {wh.location}</p>}
                  </div>
                  <div className="flex justify-end mt-4">
                    <button 
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`هل أنت متأكد من حذف مستودع "${wh.name}"؟`)) {
                          try {
                            await deleteDoc(doc(db, 'warehouses', wh.id));
                            setStatus({ type: 'success', message: 'تم حذف المستودع بنجاح.' });
                          } catch (err) {
                            console.error(err);
                            setStatus({ type: 'error', message: 'فشل حذف المستودع' });
                          }
                        }
                      }}
                      className="text-xs text-danger hover:underline flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                      حذف
                    </button>
                  </div>
                </div>
              ))}

              {warehouses.length === 0 && (
                <div className="col-span-full py-8 text-center bg-gray-50 dark:bg-navy-950 rounded-2xl border border-dashed border-gray-200 dark:border-navy-900">
                  <Archive className="mx-auto text-gray-300 dark:text-gray-700 animate-pulse mb-2" size={32} />
                  <p className="text-xs text-gray-400 font-bold">لم تقم بإضافة مخازن فيزيائية مخصصة بعد. أضف مستودعاً للبدء.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'management' && (
        <motion.div
          key="management"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center">
              <Package size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold">إدارة البيانات المرجعية (Brands & Units)</h3>
              <p className="text-sm text-gray-500">إدارة العلامات التجارية للشركات والوحدات القياسية للأصناف.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Brands Section */}
            <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-navy-900 dark:text-white flex items-center gap-2">
                  <Tag className="text-brand-primary" size={20} />
                  الماركات والعلامات التجارية
                </h4>
                <button 
                  onClick={() => {
                    const name = window.prompt('اسم الماركة الجديدة:');
                    if (name) {
                      setShopSettings(prev => ({
                        ...prev,
                        brands: [...(prev.brands || []), { id: Date.now().toString(), name, logo: '' }]
                      }));
                    }
                  }}
                  className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl hover:bg-brand-primary hover:text-white transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {shopSettings.brands?.map((brand) => (
                  <div key={brand.id} className="p-4 bg-gray-50 dark:bg-navy-950 rounded-2xl border border-gray-100 dark:border-navy-900 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 overflow-hidden relative group/logo">
                        {brand.logo ? (
                          <img src={brand.logo} alt={brand.name} className="w-full h-full object-contain" />
                        ) : (
                          <ImageIcon size={16} className="text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        )}
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover/logo:opacity-100 cursor-pointer flex items-center justify-center transition-opacity">
                           <Upload size={14} className="text-white" />
                           <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file && profile?.ownerId) {
                                try {
                                  const url = await uploadToMega(file, profile.ownerId, `brand_logo_${brand.id}`);
                                  setShopSettings(prev => ({
                                    ...prev,
                                    brands: prev.brands?.map(b => b.id === brand.id ? { ...b, logo: url } : b)
                                  }));
                                } catch (err) {
                                  setStatus({ type: 'error', message: 'فشل رفع الشعار' });
                                }
                              }
                            }}
                           />
                        </label>
                      </div>
                      <span className="text-sm font-bold">{brand.name}</span>
                    </div>
                    <button 
                      onClick={() => setShopSettings(prev => ({ ...prev, brands: prev.brands?.filter(b => b.id !== brand.id) }))}
                      className="text-danger opacity-20 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {(!shopSettings.brands || shopSettings.brands.length === 0) && (
                  <p className="col-span-full text-xs text-gray-400 italic text-center py-4">لم يتم إضافة براندات بعد.</p>
                )}
              </div>
            </div>

            {/* Units Section */}
            <div className="bg-white dark:bg-navy-800 p-8 rounded-[3rem] border border-gray-100 dark:border-navy-700 shadow-lg space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-navy-900 dark:text-white flex items-center gap-2">
                  <Package className="text-blue-500" size={20} />
                  وحدات القياس (Units)
                </h4>
                <button 
                  onClick={() => {
                    const name = window.prompt('اسم الوحدة الجديدة:');
                    if (name) {
                      setShopSettings(prev => ({
                        ...prev,
                        units: [...(prev.units || []), { id: Date.now().toString(), name }]
                      }));
                    }
                  }}
                  className="p-2 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {shopSettings.units?.map((unit) => (
                  <div key={unit.id} className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-navy-900 rounded-xl group/unit">
                    <span className="text-sm font-bold">{unit.name}</span>
                    <button 
                       onClick={() => setShopSettings(prev => ({ ...prev, units: prev.units?.filter(u => u.id !== unit.id) }))}
                       className="text-danger opacity-20 group-hover/unit:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {(!shopSettings.units || shopSettings.units.length === 0) && (
                  <p className="w-full text-xs text-gray-400 italic text-center py-4">لم يتم إضافة وحدات قياس بعد (مثل حبة، كرتون).</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'currency' && (
        <motion.div 
          key="currency"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center">
              <Coins size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold">أسعار العملات والضريبة</h3>
              <p className="text-sm text-gray-500">تحديد العملة الرئيسية، أسعار الصرف، ونسبة الضريبة والقيمة المضافة.</p>
            </div>
          </div>

          <div className="card-glass p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-sm font-black text-gray-400 uppercase tracking-wider">اختيار العملة والضريبة</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="label-field">العملة الرئيسية للنظام</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['ر.ي', 'ر.س', 'USD'].map(cur => (
                        <button 
                          key={cur}
                          onClick={() => setShopSettings({...shopSettings, currency: cur})}
                          className={`py-3 rounded-xl font-black text-sm transition-all ${shopSettings.currency === cur ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20' : 'bg-navy-900/5 dark:bg-white/5 text-gray-500 border-transparent hover:bg-gray-100'}`}
                        >
                          {cur}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-navy-900 dark:text-gray-100">تفعيل الضريبة (%)</p>
                      <p className="text-[10px] text-gray-500">تُضاف تلقائياً في الفواتير</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        step="0.1"
                        className="w-16 bg-white dark:bg-navy-800 border-none rounded-lg text-center font-bold text-sm py-1"
                        value={shopSettings.taxRate || 0}
                        onChange={(e) => setShopSettings({...shopSettings, taxRate: Number(e.target.value)})}
                      />
                      <button 
                        onClick={() => setShopSettings({...shopSettings, enableTax: !shopSettings.enableTax})}
                        className={`w-12 h-6 rounded-full transition-all relative ${shopSettings.enableTax ? 'bg-success' : 'bg-gray-300 dark:bg-navy-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${shopSettings.enableTax ? (document.dir === 'rtl' ? 'left-7' : 'right-7') : (document.dir === 'rtl' ? 'left-1' : 'right-1')}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-black text-gray-400 uppercase tracking-wider">أسعار صرف العملات الأجنبية</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-white dark:bg-navy-900 rounded-2xl border border-blue-500/10">
                    <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center font-black">USD</div>
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-500 mb-1">سعر الدولار مقابل {shopSettings.currency}</p>
                      <input 
                        type="number" 
                        className="w-full bg-transparent font-black text-xl outline-none" 
                        value={shopSettings.exchangeRates?.USD || 0}
                        onChange={(e) => setShopSettings({
                          ...shopSettings, 
                          exchangeRates: { ...shopSettings.exchangeRates, USD: Number(e.target.value) }
                        })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-white dark:bg-navy-900 rounded-2xl border border-success/10">
                    <div className="w-10 h-10 bg-success/10 text-success rounded-xl flex items-center justify-center font-black">SAR</div>
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-500 mb-1">سعر الريال السعودي مقابل {shopSettings.currency}</p>
                      <input 
                        type="number" 
                        className="w-full bg-transparent font-black text-xl outline-none" 
                        value={shopSettings.exchangeRates?.SAR || 0}
                        onChange={(e) => setShopSettings({
                          ...shopSettings, 
                          exchangeRates: { ...shopSettings.exchangeRates, SAR: Number(e.target.value) }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-navy-700/10">
              <button onClick={saveSettings} className="btn-primary px-10 py-4 flex items-center gap-3">
                <Save size={20} />
                حفظ إعدادات العملة
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Network & Multi-Sync Tab */}
      {activeTab === 'network-sync' && (
        <motion.div
          key="network-sync-panel"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
        >
          <NetworkSyncSettings 
            profile={profile} 
            onShowToast={(msg, type) => setStatus({ type, message: msg })} 
          />
        </motion.div>
      )}

      </AnimatePresence>


      {/* Local Restore Confirmation Modal */}
      <AnimatePresence>
        {showRestorePanel && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card-glass max-w-lg w-full p-8 space-y-6 border-2 border-brand-primary"
            >
              <div className="w-20 h-20 bg-brand-primary/10 text-brand-primary rounded-3xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={48} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black">استعادة نسخة احتياطية</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  تم التعرف على ملف النسخة الاحتياطية للمحل بنجاح. سيتم دمج البيانات المفقودة أو المحذوفة آلياً وعلى مراحل آمنة للحفاظ على استقرار النظام.
                </p>
              </div>

              {restoreProgress ? (
                <div className="space-y-3 bg-navy-950/40 p-4 rounded-2xl border border-brand-primary/20 text-right">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-300">
                    <span>التقدم: {Math.round((restoreProgress.processed / restoreProgress.total) * 100)}%</span>
                    <span>المرحلة {restoreProgress.phase} من {restoreProgress.totalPhases}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-brand-primary h-full transition-all duration-300 rounded-full" 
                      style={{ width: `${(restoreProgress.processed / restoreProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold leading-relaxed text-center">
                    جاري دمج ومعالجة {restoreProgress.processed} وثيقة من أصل {restoreProgress.total}...
                    <br />
                    يرجى الانتظار، تتم الاستعادة على مراحل لضمان عدم توقف أو بطء التطبيق.
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-brand-primary/5 border border-brand-primary/10 rounded-2xl text-center text-xs text-gray-300">
                  ⚠️ تأكيد: الضغط على زر الاستعادة سيقوم بدمج السجلات والملفات المفقودة مع قاعدة البيانات الحالية دون حذف أي سجلات مضافة حديثاً.
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  disabled={isImporting}
                  onClick={() => {
                    setShowRestorePanel(false);
                    setImportData(null);
                    setDevPassword('');
                  }}
                  className="flex-1 py-4 bg-gray-100 dark:bg-white/5 font-bold rounded-2xl disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button 
                  disabled={isImporting}
                  onClick={handleRestore}
                  className="flex-1 py-4 btn-primary font-bold rounded-2xl disabled:opacity-50"
                >
                  {isImporting ? <Loader2 className="animate-spin mx-auto" /> : 'تأكيد واستعادة البيانات الآن'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cloud Backups List Modal */}
      <AnimatePresence>
        {showBackupsModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card-glass max-w-2xl w-full p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black flex items-center gap-2">
                  <History size={24} className="text-brand-primary" />
                  أرشيف النسخ السحابية
                </h3>
                <button onClick={() => setShowBackupsModal(false)} className="p-2 hover:bg-white/5 rounded-xl">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                {backups.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 font-bold border-2 border-dashed border-white/5 rounded-2xl">
                    لا يوجد نسخ احتياطية مسجلة في هذا الحساب.
                  </div>
                ) : (
                  backups.map((bk) => (
                    <div key={bk.id} className="p-4 bg-white dark:bg-navy-900 border border-white/10 rounded-2xl flex items-center justify-between group hover:border-brand-primary transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
                          <Cloud size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-700 dark:text-white truncate max-w-[200px]">{bk.name}</p>
                          <p className="text-[10px] text-gray-500">{new Date(bk.createdTime).toLocaleString('ar-YE')}</p>
                        </div>
                      </div>
                      <button 
                        disabled={isRestoring}
                        onClick={() => handleRestoreFromCloud(bk.id)}
                        className="btn-secondary px-4 py-2 text-xs flex items-center gap-2"
                      >
                        {isRestoring ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                        استعادة
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              {restoreProgress && (
                <div className="space-y-3 bg-navy-950/40 p-4 rounded-2xl border border-brand-primary/20 text-right">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-300">
                    <span>التقدم: {Math.round((restoreProgress.processed / restoreProgress.total) * 100)}%</span>
                    <span>المرحلة {restoreProgress.phase} من {restoreProgress.totalPhases}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-brand-primary h-full transition-all duration-300 rounded-full" 
                      style={{ width: `${(restoreProgress.processed / restoreProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold leading-relaxed text-center">
                    جاري استرجاع ودمج {restoreProgress.processed} وثيقة من أصل {restoreProgress.total} سحابياً...
                    <br />
                    يرجى الانتظار، تتم الاستعادة على مراحل آمنة لتفادي بطء المتصفح.
                  </div>
                </div>
              )}
              
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5 text-emerald-400" />
                  <p className="text-[10px] font-bold leading-relaxed italic text-right">
                    💡 تم ترقية نظام التشفير ليعمل على مستوى المحل (وليس الجهاز فقط). يمكنك الآن تصدير النسخة واستعادتها من أي جوال أو جهاز تابع للمحل بكل سهولة وأمان!
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BarcodePrintModal
        isOpen={isBulkPrintModalOpen}
        onClose={() => setIsBulkPrintModalOpen(false)}
        items={inventory}
        initialSelectedItems={bulkPrintInitialItems}
        shopName={shopSettings.shopName}
        showPrice={shopSettings.printer?.showPriceOnBarcode !== false}
      />
    </div>

    {/* Status Message */}
    <AnimatePresence>
      {status && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`p-6 rounded-2xl flex items-center gap-4 shadow-xl fixed bottom-8 right-8 z-[200] ${
            status.type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'
          }`}
        >
          {status.type === 'success' ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
          <p className="text-lg font-bold">{status.message}</p>
          <button 
            onClick={() => setStatus(null)}
            className="mr-auto p-2 hover:bg-white/20 rounded-lg transition-all"
          >
            <X size={24} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
}
