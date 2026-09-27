import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Wrench, 
  User, 
  Phone, 
  Smartphone, 
  Hash, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Calendar,
  History,
  Share2,
  MoreVertical,
  X,
  Package,
  DollarSign,
  MessageCircle,
  MessageSquare,
  Bell,
  Printer,
  Camera,
  Upload,
  Loader2,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  RefreshCw,
  Database,
  Download,
  Settings,
  Percent,
  Users,
  Key,
  Shield,
  Sparkles
} from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, serverTimestamp, getDoc, deleteDoc, where, Timestamp, increment, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { logActivity, logActivityDetailed } from '../services/activityLogService';
import { MaintenanceOrder, OrderStatus, UserProfile, InventoryItem } from '../types';
import { postSaleToGL } from '../services/accountingService';
import { postMaintenanceToLedger } from '../services/MaintenanceFinancialService';
import { motion, AnimatePresence } from 'motion/react';
import { sendSMS, templates, parseTemplate, sendWhatsApp } from '../services/smsService';
import { sendNotification } from '../services/notificationService';
import { printReceipt } from '../services/printService';
import { audioService } from '../services/audioService';
import { PatternLockGrid } from './PatternLockGrid';
import ConfirmModal from './ConfirmModal';
import { uploadToMega } from '../services/megaService';
import { useLabels } from '../hooks/useLabels';
import { transactionLockService } from '../services/transactionLockService';
import { draftVaultService } from '../services/draftVaultService';
import MessageModal from './MessageModal';
import { useVault } from '../context/VaultContext';
import { parseISO } from 'date-fns';

interface MaintenanceProps {
  profile: UserProfile | null;
  initialOpenAgreements?: boolean;
}

const BRANDS = [
  'Samsung', 'Lt', 'Tracfone', 'LG', 'Motorola', 'Huawei', 'China Mobile', 'Coolpad', 'Tab/iPad'
];

export default function Maintenance({ profile, initialOpenAgreements = false }: MaintenanceProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') === 'archived' ? 'archived' : 'active') as 'active' | 'archived';
  const [maintenanceViewMode, setMaintenanceViewMode] = useState<'active' | 'archived'>(initialMode);
  const [archiveDate, setArchiveDate] = useState<string>('');

  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'archived' || urlMode === 'active') {
      setMaintenanceViewMode(urlMode as any);
    }
  }, [searchParams]);

  // Automatically open engineer contracts if requested or if route is /engineer-accounts
  useEffect(() => {
    if (initialOpenAgreements || searchParams.get('tab') === 'agreements' || location.pathname === '/engineer-accounts') {
      setIsEngineerAgreementsOpen(true);
    }
  }, [initialOpenAgreements, searchParams, location.pathname]);

  const { isVaultOpen, vaultDate } = useVault();
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notificationChoice, setNotificationChoice] = useState<{
    order: MaintenanceOrder;
    status: OrderStatus;
    message: string;
  } | null>(null);
  const [isPartsModalOpen, setIsPartsModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MaintenanceOrder | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [workshopSettings, setWorkshopSettings] = useState({
    defaultEngineerId: '',
    defaultStockLocation: '',
    lossShopPercentage: 40,
    lossEngineerPercentage: 40,
    lossCustomerPercentage: 20,
    enableDelayPenalties: false,
    delayLimitDays: 30,
    dailyDelayFine: 500,
    enableConfiscation: false,
    enableDiagnosticFee: false,
    diagnosticFeePrice: 2000,
    sparePartProfitSharing: 'shop',
    enableReadyNotification: true,
    readyNotificationChannel: 'app',
  });
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmStatusOpen, setIsConfirmStatusOpen] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ id: string, status: OrderStatus } | null>(null);

  // Automated notification preference overrides on status change
  const [notifyOnReady, setNotifyOnReady] = useState(true);
  const [readyNotificationChannel, setReadyNotificationChannel] = useState<'app' | 'whatsapp' | 'sms'>('app');
  const [targetCustomerHasApp, setTargetCustomerHasApp] = useState<boolean | null>(null);
  const [checkingTargetCustomerApp, setCheckingTargetCustomerApp] = useState(false);

  useEffect(() => {
    if (isConfirmStatusOpen && pendingStatusUpdate?.status === 'ready') {
      setNotifyOnReady(workshopSettings.enableReadyNotification !== undefined ? workshopSettings.enableReadyNotification : true);
      setReadyNotificationChannel((workshopSettings.readyNotificationChannel as any) || 'app');
    }
  }, [isConfirmStatusOpen, pendingStatusUpdate, workshopSettings]);

  useEffect(() => {
    if (isConfirmStatusOpen && pendingStatusUpdate?.status === 'ready') {
      const order = orders.find(o => o.id === pendingStatusUpdate.id);
      if (order) {
        setCheckingTargetCustomerApp(true);
        const checkAppAccount = async () => {
          try {
            const cleanPhone = order.customerPhone.replace(/[\s\-\(\)]/g, '').trim();
            const q = query(
              collection(db, 'users'),
              where('phone', '==', cleanPhone)
            );
            const qSnap = await getDocs(q);
            const hasApp = !qSnap.empty;
            setTargetCustomerHasApp(hasApp);
            // Fallback to whatsapp if no app account
            if (!hasApp) {
              setReadyNotificationChannel('whatsapp');
            } else {
              setReadyNotificationChannel('app');
            }
          } catch (err) {
            console.error("Error checking customer app account:", err);
            setTargetCustomerHasApp(false);
            setReadyNotificationChannel('whatsapp');
          } finally {
            setCheckingTargetCustomerApp(false);
          }
        };
        checkAppAccount();
      }
    } else {
      setTargetCustomerHasApp(null);
      setCheckingTargetCustomerApp(false);
    }
  }, [isConfirmStatusOpen, pendingStatusUpdate, orders]);
  const [orderToDelete, setOrderToDelete] = useState<MaintenanceOrder | null>(null);
  const [lockType, setLockType] = useState<'text' | 'pattern'>('text');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [customerHasInAppAccount, setCustomerHasInAppAccount] = useState<boolean | null>(null);
  const [checkingAccountStatus, setCheckingAccountStatus] = useState<boolean>(false);

  // Engineer agreement and orderType states
  const [isEngineerAgreementsOpen, setIsEngineerAgreementsOpen] = useState(false);
  const [selectedEngForAgreement, setSelectedEngForAgreement] = useState<UserProfile | null>(null);
  const [agreementPercentage, setAgreementPercentage] = useState<number>(50);
  const [partPaymentResp, setPartPaymentResp] = useState<'shop' | 'engineer'>('shop');
  const [profitTiming, setProfitTiming] = useState<'on_complete' | 'on_ready'>('on_complete');
  const [failedLiability, setFailedLiability] = useState<'shop' | 'engineer' | 'split'>('shop');
  const [savingAgreement, setSavingAgreement] = useState(false);
  const [modalOrderType, setModalOrderType] = useState<'hardware' | 'software'>('hardware');

  useEffect(() => {
    if (isEngineerAgreementsOpen && !selectedEngForAgreement && engineers.length > 0) {
      const defaultEng = engineers.find(u => u.role === 'engineer' || u.role === 'employee' || u.role === 'manager') || engineers[0];
      if (defaultEng) setSelectedEngForAgreement(defaultEng);
    }
  }, [isEngineerAgreementsOpen, engineers, selectedEngForAgreement]);

  useEffect(() => {
    if (selectedEngForAgreement) {
      setAgreementPercentage(selectedEngForAgreement.engineerSharePercentage !== undefined ? Number(selectedEngForAgreement.engineerSharePercentage) : (workshopSettings.lossEngineerPercentage || 50));
      setPartPaymentResp(selectedEngForAgreement.sparePartPaymentResponsibility || 'shop');
      setProfitTiming(selectedEngForAgreement.profitTiming || 'on_complete');
      setFailedLiability(selectedEngForAgreement.failedRepairLiability || 'shop');
    }
  }, [selectedEngForAgreement, workshopSettings]);

  useEffect(() => {
    if (engineers.length > 0 && !selectedEngForAgreement) {
      const firstEng = engineers.find(u => u.role === 'engineer' || u.role === 'employee' || u.role === 'manager') || engineers[0];
      setSelectedEngForAgreement(firstEng);
    }
  }, [engineers, selectedEngForAgreement]);

  const openAddModal = (type: 'hardware' | 'software') => {
    setModalOrderType(type);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const [lastOrderData, setLastOrderData] = useState<MaintenanceOrder | null>(null);
  const [customPhone, setCustomPhone] = useState('');

  useEffect(() => {
    if (isSuccessModalOpen && lastOrderData) {
      setCustomPhone(lastOrderData.customerPhone || '');
    }
  }, [isSuccessModalOpen, lastOrderData]);

  useEffect(() => {
    if (notificationChoice) {
      const checkAndTriggerInAppAlert = async () => {
        setCheckingAccountStatus(true);
        try {
          const cleanPhone = notificationChoice.order.customerPhone.trim();
          const q = query(
            collection(db, 'users'), 
            where('phone', '==', cleanPhone)
          );
          const qSnap = await getDocs(q);
          const hasAccount = !qSnap.empty;
          setCustomerHasInAppAccount(hasAccount);

          if (hasAccount) {
            // Send automatic real-time push notification!
            const customerUserDoc = qSnap.docs[0];
            const userId = customerUserDoc.id;
            
            await addDoc(collection(db, 'notifications'), {
              receiverId: userId,
              title: `تحديث صيانة جهازك: ${notificationChoice.order.deviceModel}`,
              message: notificationChoice.message,
              type: 'maintenance',
              status: 'unread',
              createdAt: serverTimestamp()
            });

            console.log("🔔 Automated customer push notification sent successfully in-app directly.");
          }
        } catch (e) {
          console.error("Error checking or sending in-app notification:", e);
          setCustomerHasInAppAccount(false);
        } finally {
          setCheckingAccountStatus(false);
        }
      };

      checkAndTriggerInAppAlert();
    } else {
      setCustomerHasInAppAccount(null);
      setCheckingAccountStatus(false);
    }
  }, [notificationChoice]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [businessType, setBusinessType] = useState('mobiles');
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [isCompact, setIsCompact] = useState(window.innerWidth < 640);
  const [isMaximized, setIsMaximized] = useState(false);
  const labels = useLabels(businessType);

  const [messageModal, setMessageModal] = useState<{
    isOpen: boolean;
    phone: string;
    message: string;
    title: string;
  }>({
    isOpen: false,
    phone: '',
    message: '',
    title: ''
  });

  // Form State with Auto-Draft Vault Persistence
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    deviceBrand: '',
    deviceModel: '',
    deviceSerialNumber: '',
    orderType: 'hardware' as 'hardware' | 'software',
    imei: '',
    issue: '',
    lockPattern: '',
    appLockCode: '', // App Lock Code / PIN
    cost: '' as string | number,
    advancePayment: '' as string | number,
    laborCost: '' as string | number,
    engineerNotes: '',
    damageResponsibility: 50,
    engineerId: profile?.uid || '',
    engineerPercentage: 50,
    requiredPartId: '',
    requiredPartName: '',
    isPartMissing: false,
    devicePhoto: ''
  });

  // Customer search & previous device history states
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [selectedCustomerDevices, setSelectedCustomerDevices] = useState<any[]>([]);
  const [activeSelectedDeviceKey, setActiveSelectedDeviceKey] = useState<string>('new_device');

  // Helper to extract previous devices repaired for a customer
  const updateCustomerPreviousDevices = (custPhone: string, custName: string) => {
    const cleanPhone = (custPhone || '').replace(/[\s\-\(\)]/g, '').trim();
    const cleanName = (custName || '').trim().toLowerCase();
    if (!cleanPhone && !cleanName) {
      setSelectedCustomerDevices([]);
      return;
    }

    const matchedOrders = orders.filter(o => {
      const oPhone = (o.customerPhone || '').replace(/[\s\-\(\)]/g, '').trim();
      const oName = (o.customerName || '').trim().toLowerCase();
      return (cleanPhone && oPhone && (oPhone === cleanPhone || oPhone.endsWith(cleanPhone) || cleanPhone.endsWith(oPhone))) ||
             (cleanName && oName && (oName.includes(cleanName) || cleanName.includes(oName)));
    });

    const uniqueMap = new Map<string, any>();
    matchedOrders.forEach(o => {
      if (!o.deviceModel) return;
      const key = `${(o.deviceBrand || '').trim()}_${(o.deviceModel || '').trim()}_${(o.deviceSerialNumber || o.imei || '').trim()}`.toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          id: o.id,
          deviceBrand: o.deviceBrand || '',
          deviceModel: o.deviceModel || '',
          deviceSerialNumber: o.deviceSerialNumber || o.imei || '',
          imei: o.imei || '',
          lockPattern: o.lockPattern || '',
          appLockCode: (o as any).appLockCode || '',
          lastIssue: o.issue || '',
          lastCost: o.cost || 0,
          createdAt: o.createdAt
        });
      }
    });

    setSelectedCustomerDevices(Array.from(uniqueMap.values()));
  };

  const handleSelectCustomer = (cust: any) => {
    setFormData(prev => ({
      ...prev,
      customerName: cust.name || prev.customerName,
      customerPhone: cust.phone || prev.customerPhone
    }));
    setIsCustomerDropdownOpen(false);
    setCustomerSearchQuery('');
    updateCustomerPreviousDevices(cust.phone, cust.name);
    setActiveSelectedDeviceKey('new_device');
  };

  const handleSelectPreviousDevice = (dev: any) => {
    setActiveSelectedDeviceKey(dev.id);
    setFormData(prev => ({
      ...prev,
      deviceBrand: dev.deviceBrand || prev.deviceBrand,
      deviceModel: dev.deviceModel || prev.deviceModel,
      deviceSerialNumber: dev.deviceSerialNumber || '',
      imei: dev.imei || '',
      lockPattern: dev.lockPattern || '',
      appLockCode: dev.appLockCode || ''
    }));
    if (dev.lockPattern && dev.lockPattern.includes('-')) {
      setLockType('pattern');
    } else if (dev.lockPattern) {
      setLockType('text');
    }
  };

  const handleSelectNewDevice = () => {
    setActiveSelectedDeviceKey('new_device');
    setFormData(prev => ({
      ...prev,
      deviceBrand: '',
      deviceModel: '',
      deviceSerialNumber: '',
      imei: '',
      lockPattern: '',
      appLockCode: ''
    }));
  };

  // 💾 استرجاع مسودة كرت الصيانة المفتوح مسبقاً في حال انقطاع التيار أو إغلاق التطبيق
  useEffect(() => {
    if (isModalOpen) {
      const restoreMaintenanceDraft = async () => {
        const storeId = profile?.ownerId || 'default_store';
        const userId = profile?.uid || 'default_user';
        try {
          const draft = await draftVaultService.getDraft(storeId, userId, `maintenance_order_draft_${modalOrderType}`);
          if (draft && (draft.customerName || draft.customerPhone || draft.deviceModel || draft.issue)) {
            setFormData(draft);
            updateCustomerPreviousDevices(draft.customerPhone, draft.customerName);
            return;
          }
        } catch (e) {
          console.warn('Could not restore maintenance draft:', e);
        }

        // إذا لم توجد مسودة محفوظة، نهيئ الحقول بالقيم الافتراضية
        const savedEngineerId = localStorage.getItem('jam_maint_last_selected_engineer_id');
        setFormData({
          customerName: '',
          customerPhone: '',
          deviceBrand: '',
          deviceModel: '',
          deviceSerialNumber: '',
          orderType: modalOrderType,
          imei: '',
          issue: '',
          lockPattern: '',
          appLockCode: '',
          cost: workshopSettings.enableDiagnosticFee ? workshopSettings.diagnosticFeePrice : '',
          advancePayment: workshopSettings.enableDiagnosticFee ? workshopSettings.diagnosticFeePrice : '',
          laborCost: '',
          engineerNotes: '',
          damageResponsibility: 50,
          engineerId: savedEngineerId || workshopSettings.defaultEngineerId || profile?.uid || '',
          engineerPercentage: workshopSettings.lossEngineerPercentage || 50,
          requiredPartId: '',
          requiredPartName: '',
          isPartMissing: false,
          devicePhoto: ''
        });
        setSelectedCustomerDevices([]);
        setActiveSelectedDeviceKey('new_device');
      };
      restoreMaintenanceDraft();
    }
  }, [isModalOpen, workshopSettings, profile, modalOrderType]);

  // 💾 الحفظ التلقائي الفوري لمسودة كرت الصيانة عند كتابة أي بيان
  useEffect(() => {
    const storeId = profile?.ownerId || 'default_store';
    const userId = profile?.uid || 'default_user';
    if (isModalOpen) {
      const hasContent = formData.customerName || formData.customerPhone || formData.deviceModel || formData.issue || formData.cost;
      if (hasContent) {
        draftVaultService.saveDraft(storeId, userId, `maintenance_order_draft_${formData.orderType || 'hardware'}`, formData);
      }
    }
  }, [formData, isModalOpen, profile]);

  useEffect(() => {
    if (!profile?.ownerId) return;

    const isEngineer = profile?.role === 'engineer' || profile?.role === 'employee';
    let q = query(
      collection(db, 'maintenanceOrders'), 
      where('ownerId', '==', profile.ownerId)
    );

    if (profile.role !== 'owner' && profile.role !== 'superadmin' && profile.shopId) {
      q = query(q, where('shopId', '==', profile.shopId));
    }

    if (isEngineer) {
      q = query(q, where('engineerId', '==', profile.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceOrder))
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
          const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
          return dateB - dateA;
        });
      setOrders(ordersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'maintenanceOrders');
    });
    
    const unsubInv = onSnapshot(
      query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId)), 
      (snapshot) => {
        let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
        if (profile.role !== 'owner' && profile.role !== 'superadmin' && profile.shopId) {
          docs = docs.filter((d: any) => d.shopId === profile.shopId || d.storeId === profile.shopId || d.store_id === profile.shopId);
        }
        setInventory(docs);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'inventory');
      }
    );

    const unsubEngs = onSnapshot(
      query(collection(db, 'users'), where('ownerId', '==', profile.ownerId)), 
      (snapshot) => {
        let docs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        if (profile.role !== 'owner' && profile.role !== 'superadmin' && profile.shopId) {
          docs = docs.filter((u: any) => u.shopId === profile.shopId);
        }
        setEngineers(docs);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    const unsubWarehouses = onSnapshot(
      query(collection(db, 'warehouses'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (profile.role !== 'owner' && profile.role !== 'superadmin' && profile.shopId) {
          docs = docs.filter((w: any) => w.shopId === profile.shopId || w.storeId === profile.shopId || w.store_id === profile.shopId);
        }
        setWarehouses(docs);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'warehouses');
      }
    );

    const unsubCust = onSnapshot(
      query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCustomersList(docs);
      }, (error) => {
        console.warn('Customers listener warning in Maintenance:', error);
      }
    );

    return () => {
      unsubscribe();
      unsubInv();
      unsubEngs();
      unsubWarehouses();
      unsubCust();
    };
  }, [profile]);

  useEffect(() => {
    if (!profile?.ownerId) return;
    const unsubSettings = onSnapshot(
      doc(db, 'settings', profile.ownerId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBusinessType(data.businessType || 'mobiles');
          setShopSettings(data);
          
          setWorkshopSettings({
            defaultEngineerId: data.defaultEngineerId || '',
            defaultStockLocation: data.defaultStockLocation || '',
            lossShopPercentage: data.lossShopPercentage !== undefined ? data.lossShopPercentage : 40,
            lossEngineerPercentage: data.lossEngineerPercentage !== undefined ? data.lossEngineerPercentage : 40,
            lossCustomerPercentage: data.lossCustomerPercentage !== undefined ? data.lossCustomerPercentage : 20,
            enableDelayPenalties: !!data.enableDelayPenalties,
            delayLimitDays: data.delayLimitDays !== undefined ? data.delayLimitDays : 30,
            dailyDelayFine: data.dailyDelayFine !== undefined ? data.dailyDelayFine : 500,
            enableConfiscation: !!data.enableConfiscation,
            enableDiagnosticFee: !!data.enableDiagnosticFee,
            diagnosticFeePrice: data.diagnosticFeePrice !== undefined ? data.diagnosticFeePrice : 2000,
            sparePartProfitSharing: data.sparePartProfitSharing || 'shop',
            enableReadyNotification: data.enableReadyNotification !== undefined ? !!data.enableReadyNotification : true,
            readyNotificationChannel: data.readyNotificationChannel || 'app',
          });
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `settings/${profile.ownerId}`);
      }
    );
    return () => unsubSettings();
  }, [profile]);

  const addSparePart = async (item: InventoryItem) => {
    if (!selectedOrder) return;
    if (item.stock <= 0) return;

    try {
      const newPart = {
        id: item.id,
        name: item.name,
        cost: item.cost,
        price: item.price,
        barcode: item.barcode || ''
      };

      const updatedParts = [...(selectedOrder.sparePartsUsed || []), newPart];
      
      await updateDoc(doc(db, 'maintenanceOrders', selectedOrder.id), {
        sparePartsUsed: updatedParts,
        updatedAt: serverTimestamp()
      });

      // Deduct from inventory immediately to reserve it
      await updateDoc(doc(db, 'inventory', item.id), {
        stock: item.stock - 1
      });

      setSelectedOrder({ ...selectedOrder, sparePartsUsed: updatedParts });
    } catch (error) {
      console.error('Error adding spare part:', error);
    }
  };

  const syncMaintenanceVaultUpdate = async (ownerId: string, shopId: string, amount: number) => {
    try {
      const sId = shopId || ownerId || 'main_store';
      
      // 1. Update stores/{sId}/vaults/v1
      await setDoc(doc(db, 'stores', sId, 'vaults', 'v1'), {
        balance: increment(amount),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Update root vaults/ownerId-v1
      await setDoc(doc(db, 'vaults', `${ownerId}-v1`), {
        id: 'v1',
        name: 'صندوق النقد الرئيسي (الكاش)',
        type: 'cash',
        balance: increment(amount),
        ownerId,
        storeId: sId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 3. Update stores/{ownerId}/customBoxes/CASH_BOX
      await setDoc(doc(db, 'stores', ownerId, 'customBoxes', 'CASH_BOX'), {
        id: 'CASH_BOX',
        boxName: 'صندوق النقد الرئيسي (الكاش)',
        type: 'cash',
        balance: increment(amount),
        ownerId,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err: any) {
      console.warn("JAM SYSTEM PRO - Maintenance Vault Sync Error:", err.message);
    }
  };

  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || depositAmount <= 0) return;

    try {
      const newAdvance = (selectedOrder.advancePayment || 0) + depositAmount;
      await updateDoc(doc(db, 'maintenanceOrders', selectedOrder.id), {
        advancePayment: newAdvance,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        ownerId: profile?.ownerId,
        type: 'income',
        amount: depositAmount,
        category: 'maintenance_deposit',
        description: `توصيل مبلغ صيانة: ${selectedOrder.deviceModel} - ${selectedOrder.customerName}`,
        orderId: selectedOrder.id,
        createdAt: serverTimestamp()
      });

      if (profile?.ownerId) {
        await syncMaintenanceVaultUpdate(profile.ownerId, profile.shopId || profile.storeId || '', depositAmount);
      }

      setIsDepositModalOpen(false);
      setDepositAmount(0);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error adding deposit:', error);
    }
  };

  const getEngineerAgreement = (engineerId: string) => {
    const engineer = engineers.find(e => e.uid === engineerId);
    return {
      engineerSharePercentage: engineer?.engineerSharePercentage !== undefined ? Number(engineer.engineerSharePercentage) : (workshopSettings.lossEngineerPercentage || 50),
      sparePartPaymentResponsibility: engineer?.sparePartPaymentResponsibility || 'shop',
      profitTiming: engineer?.profitTiming || 'on_complete',
      failedRepairLiability: engineer?.failedRepairLiability || 'shop',
    };
  };

  const calculateProfit = (order: MaintenanceOrder) => {
    const partsCost = (order.sparePartsUsed || []).reduce((acc, p) => acc + p.cost, 0);
    const partsPrice = (order.sparePartsUsed || []).reduce((acc, p) => acc + p.price, 0);
    
    const agreement = getEngineerAgreement(order.engineerId);
    
    const sharingMode = (workshopSettings as any).sparePartProfitSharing || 'shop';
    const effectivePartsPrice = sharingMode === 'no_profit_parts' ? partsCost : partsPrice;
    
    const serviceFee = Math.max(0, order.cost - effectivePartsPrice);
    const shopPartsProfit = sharingMode === 'no_profit_parts' ? 0 : (partsPrice - partsCost);
    
    const percentage = agreement.engineerSharePercentage;
    const engineerServiceShare = serviceFee * (percentage / 100);
    const shopServiceShare = serviceFee * ((100 - percentage) / 100);

    const isSplit = sharingMode === 'split';
    const engineerPartsShare = isSplit ? (shopPartsProfit * 0.5) : 0;
    const shopPartsShare = isSplit ? (shopPartsProfit * 0.5) : shopPartsProfit;

    const engineerShare = engineerServiceShare + engineerPartsShare;
    const shopShare = shopServiceShare + shopPartsShare;

    const lossTotal = partsCost + (order.laborCost || 0);
    const riskShop = lossTotal * ((workshopSettings.lossShopPercentage || 40) / 100);
    const riskEngineer = lossTotal * ((workshopSettings.lossEngineerPercentage || 40) / 100);
    const riskCustomer = lossTotal * ((workshopSettings.lossCustomerPercentage || 20) / 100);

    return {
      total: order.cost - partsCost,
      shop: shopShare,
      engineer: engineerShare,
      partsCost,
      risk: {
        total: lossTotal,
        shop: riskShop,
        engineer: riskEngineer,
        customer: riskCustomer
      }
    };
  };

  const calculateDelayInfo = (order: MaintenanceOrder) => {
    if (!workshopSettings.enableDelayPenalties) {
      return { delayDays: 0, delayFine: 0, isConfiscated: false };
    }

    if (order.status !== 'ready' && order.status !== 'failed') {
      return { delayDays: 0, delayFine: 0, isConfiscated: false };
    }

    try {
      const completedDate = order.updatedAt 
        ? ((order.updatedAt as any).toDate ? (order.updatedAt as any).toDate() : new Date(order.updatedAt as any)) 
        : new Date();
      
      const diffTime = Math.abs(new Date().getTime() - completedDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const limitDays = workshopSettings.delayLimitDays || 30;
      const delayDays = Math.max(0, diffDays - limitDays);
      const dailyFine = workshopSettings.dailyDelayFine || 500;
      const delayFine = delayDays * dailyFine;

      const isConfiscated = workshopSettings.enableConfiscation && diffDays > limitDays;

      return {
        delayDays,
        delayFine,
        isConfiscated
      };
    } catch (e) {
      return { delayDays: 0, delayFine: 0, isConfiscated: false };
    }
  };

  const broadcastToCustomerApp = async (customerPhone: string, orderData: any) => {
    const cleanPhone = customerPhone.replace(/[\s\-\(\)]/g, '').trim();
    if (!cleanPhone || !profile?.ownerId) return;

    try {
      const collectionsToCheck = ['leads', 'clients', 'customers'];
      const bulkUpdates = [];

      for (const colName of collectionsToCheck) {
        const q = query(
          collection(db, colName), 
          where('phone', '==', cleanPhone),
          where('ownerId', '==', profile.ownerId)
        );
        const snap = await getDocs(q);
        
        for (const docSnap of snap.docs) {
          const ref = doc(db, colName, docSnap.id);
          const existingData = docSnap.data();
          const delayDetails = calculateDelayInfo(orderData);
          const profitInfo = calculateProfit(orderData);
          
          const trackingEntry = {
            orderId: orderData.id || '',
            deviceModel: orderData.deviceModel || '',
            deviceBrand: orderData.deviceBrand || '',
            status: orderData.status || 'waiting',
            issue: orderData.issue || '',
            cost: orderData.cost || 0,
            advancePayment: orderData.advancePayment || 0,
            remainingCost: (orderData.cost || 0) - (orderData.advancePayment || 0),
            diagnosticFeePrice: workshopSettings.diagnosticFeePrice || 0,
            enableDiagnosticFee: !!workshopSettings.enableDiagnosticFee,
            delayFineAmount: delayDetails.delayFine || 0,
            confiscated: !!delayDetails.isConfiscated,
            milestones: [
              {
                title: orderData.status === 'ready' ? 'جاهز للاستلام' : orderData.status === 'working' ? 'قيد الصيانة والعمل' : orderData.status === 'failed' ? 'فشل الإصلاح' : 'بانتظار الفحص والعمل',
                timestamp: new Date().toISOString(),
                description: orderData.engineerNotes || 'تم تحديث حالة وعمليات الصيانة لجهازكم بنجاح.'
              }
            ],
            liabilities: {
              shopPercentage: workshopSettings.lossShopPercentage || 40,
              engineerPercentage: workshopSettings.lossEngineerPercentage || 40,
              customerPercentage: workshopSettings.lossCustomerPercentage || 20,
              calculatedShopLoss: profitInfo.risk.shop,
              calculatedEngineerLoss: profitInfo.risk.engineer,
              calculatedCustomerLoss: profitInfo.risk.customer
            },
            updatedAt: new Date().toISOString()
          };

          let trackingList = existingData.maintenanceTracking || [];
          if (!Array.isArray(trackingList)) {
            trackingList = [];
          }
          
          const existingIndex = trackingList.findIndex((item: any) => item.orderId === trackingEntry.orderId);
          if (existingIndex > -1) {
            trackingList[existingIndex] = { ...trackingList[existingIndex], ...trackingEntry };
          } else {
            trackingList.push(trackingEntry);
          }

          bulkUpdates.push(
            updateDoc(ref, {
              maintenanceTracking: trackingList,
              updatedAt: serverTimestamp()
            })
          );
        }
      }

      if (bulkUpdates.length > 0) {
        await Promise.all(bulkUpdates);
        console.log(`Silently sync'd maintenance state to ${bulkUpdates.length} customer profiles.`);
      }
    } catch (err) {
      console.warn("Failed to silently broadcast customer tracking:", err);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.ownerId) return;

    setIsUploadingPhoto(true);
    try {
      const url = await uploadToMega(file, profile.ownerId, 'maintenance');
      setFormData(prev => ({ ...prev, devicePhoto: url }));
      setStatus({ type: 'success', message: 'تم رفع صورة الجهاز بنجاح.' });
    } catch (error: any) {
      setStatus({ type: 'error', message: `فشل رفع الصورة: ${error.message}` });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setStatus(null);
    setIsSubmitting(true);
    try {
      const transactionDate = isVaultOpen ? parseISO(vaultDate) : new Date();
      const sparePartsUsed: any[] = [];
      
      // Handle required part if specified (deduct from inventory if available)
      if (formData.orderType === 'hardware' && formData.requiredPartId && !formData.isPartMissing) {
        const item = inventory.find(i => i.id === formData.requiredPartId);
        if (item && item.stock > 0) {
          sparePartsUsed.push({
            id: item.id,
            name: item.name,
            cost: item.cost,
            price: item.price,
            barcode: item.barcode || ''
          });
          
          await updateDoc(doc(db, 'inventory', item.id), {
            stock: item.stock - 1
          });
        }
      }

      const dataToSave = {
        ownerId: profile?.ownerId,
        shopId: profile?.shopId || '',
        operated_by_employee_name: profile?.name || 'غير معروف',
        employee_uid: profile?.uid || 'غير معروف',
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        deviceBrand: formData.deviceBrand,
        deviceModel: formData.deviceModel,
        deviceSerialNumber: formData.deviceSerialNumber,
        orderType: formData.orderType,
        imei: formData.imei,
        issue: formData.issue,
        lockPattern: formData.lockPattern,
        appLockCode: formData.appLockCode || '',
        cost: Number(formData.cost) || 0,
        advancePayment: Number(formData.advancePayment) || 0,
        laborCost: Number(formData.laborCost) || 0,
        damageResponsibility: Number(formData.damageResponsibility) || 50,
        engineerPercentage: Number(formData.engineerPercentage) || 50,
        engineerId: formData.engineerId,
        engineerNotes: formData.engineerNotes,
        status: 'waiting',
        createdAt: isVaultOpen ? transactionDate : serverTimestamp(),
        updatedAt: isVaultOpen ? transactionDate : serverTimestamp(),
        sparePartsUsed: sparePartsUsed,
        devicePhoto: formData.devicePhoto || '',
        // Add info about missing part if applicable
        requiredPartName: formData.isPartMissing ? formData.requiredPartName : (formData.requiredPartId ? (inventory.find(i => i.id === formData.requiredPartId)?.name || '') : ''),
        isPartMissing: formData.isPartMissing
      };

      // Optimistic UI: Close modal and show success immediately
      const localData = {
        ...dataToSave,
        id: 'pending_' + Date.now(),
        createdAt: { seconds: Date.now() / 1000 }
      } as MaintenanceOrder;

      setLastOrderData(localData);
      setIsModalOpen(false);
      setIsSuccessModalOpen(true);
      if (shopSettings?.enableAudioUI) audioService.playSuccess();
      
      // Fast clear all form data & vault draft
      const storeId = profile?.ownerId || 'default_store';
      const userId = profile?.uid || 'default_user';
      draftVaultService.clearDraft(storeId, userId, `maintenance_order_draft_${formData.orderType || 'hardware'}`);

      setFormData({
        customerName: '',
        customerPhone: '',
        deviceBrand: '',
        deviceModel: '',
        deviceSerialNumber: '',
        orderType: 'hardware',
        imei: '',
        issue: '',
        lockPattern: '',
        appLockCode: '',
        cost: '',
        advancePayment: '',
        laborCost: '',
        engineerNotes: '',
        damageResponsibility: 50,
        engineerPercentage: 50,
        engineerId: profile?.uid || '',
        requiredPartId: '',
        requiredPartName: '',
        isPartMissing: false,
        devicePhoto: ''
      });
      setSelectedCustomerDevices([]);
      setActiveSelectedDeviceKey('new_device');
      setCustomerSearchQuery('');
      setSearchTerm('');
      setFilterStatus('all');

      // Background processing
      (async () => {
        try {
          const orderRef = await addDoc(collection(db, 'maintenanceOrders'), dataToSave);

          // Handle shortages in background
          if (formData.orderType === 'hardware' && formData.isPartMissing && formData.requiredPartName) {
            try {
              await addDoc(collection(db, 'shortages'), {
                ownerId: profile?.ownerId,
                name: `${formData.requiredPartName} (${formData.deviceBrand} ${formData.deviceModel})`,
                quantity: 1,
                category: 'spare_part',
                status: 'pending',
                createdAt: serverTimestamp()
              });
            } catch (shortageErr) {
              console.error('Error adding shortage:', shortageErr);
            }
          }

          // If there's an advance payment, record it in finances
          if (dataToSave.advancePayment > 0) {
            await addDoc(collection(db, 'transactions'), {
              ownerId: profile?.ownerId,
              operated_by_employee_name: profile?.name || 'غير معروف',
              employee_uid: profile?.uid || 'غير معروف',
              type: 'income',
              amount: dataToSave.advancePayment,
              category: 'maintenance_advance',
              description: `دفعة مقدمة صيانة: ${formData.deviceBrand} ${formData.deviceModel} - ${formData.customerName}`,
              orderId: orderRef.id,
              createdAt: serverTimestamp()
            });

            if (profile?.ownerId) {
              await syncMaintenanceVaultUpdate(profile.ownerId, profile.shopId || profile.storeId || '', dataToSave.advancePayment);
            }
          }

          await logActivity(profile, 'تسجيل طلب صيانة', `جهاز ${formData.deviceBrand} ${formData.deviceModel} للعميل ${formData.customerName}`);
          await broadcastToCustomerApp(formData.customerPhone, {
            ...dataToSave,
            id: orderRef.id
          });
        } catch (error) {
          if (shopSettings?.enableAudioUI) audioService.playError();
          console.error('Background order processing failed:', error);
          // The data is still in IndexedDB and will sync eventually
        }
      })();
    } catch (error) {
      if (shopSettings?.enableAudioUI) audioService.playError();
      console.error('Error in handleAddOrder:', error);
      setStatus({ type: 'error', message: 'حدث خطأ أثناء معالجة الطلب.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    // Optimistic UI: Close modal immediately
    setIsConfirmStatusOpen(false);
    setPendingStatusUpdate(null);

    // Background processing
    (async () => {
      try {
        const orderRef = doc(db, 'maintenanceOrders', orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) return;
        const currentOrder = { id: orderSnap.id, ...orderSnap.data() } as MaintenanceOrder;

        if (newStatus === 'delivered') {
          const remainingAmount = currentOrder.cost - (currentOrder.advancePayment || 0);
          if (remainingAmount > 0) {
            setStatus({ 
              type: 'error', 
              message: `عذراً، لا يمكن تغيير الحالة للتسليم بدون استكمال الدفع بالكامل المتبقي: ${remainingAmount} ر.ي.` 
            });
            return;
          }
        }

        const { dbConcurrencyService } = await import('../services/dbConcurrencyService');
        await dbConcurrencyService.runTransactionLock(
          'maintenanceOrders',
          orderId,
          { status: newStatus },
          profile?.uid || ''
        );

        // Log the state change for audit purposes
        const { logStateChange } = await import('../services/activityLogService');
        await logStateChange(
          profile, 
          'update_maintenance', 
          `تحديث حالة طلب صيانة ${currentOrder.deviceModel}`, 
          { status: currentOrder.status }, 
          { status: newStatus }
        );

        // Prepare notification choice if status is relevant
        if (['ready', 'failed', 'awaiting_response', 'delivered'].includes(newStatus)) {
          let message = '';
          const data = {
            name: currentOrder.customerName,
            device: currentOrder.deviceModel,
            amount: currentOrder.cost - (currentOrder.advancePayment || 0),
            store: shopSettings?.shopName || 'المحل',
            issue: currentOrder.issue,
            date: new Date().toLocaleDateString('ar-EG'),
            phone: currentOrder.customerPhone,
            contents: currentOrder.requiredPartName || 'لا يوجد',
            total: currentOrder.cost,
            paid: currentOrder.advancePayment || 0,
            remaining: currentOrder.cost - (currentOrder.advancePayment || 0),
            status: newStatus === 'ready' ? 'جاهزة' : newStatus === 'delivered' ? 'تم التسليم' : newStatus === 'failed' ? 'فشل الإصلاح' : 'بانتظار الرد'
          };

          if (newStatus === 'ready') {
            message = templates.deviceReady(currentOrder.deviceModel, data.amount, currentOrder.customerName, data.date);
          } else if (newStatus === 'delivered') {
            message = templates.deviceDelivered(currentOrder.customerName, currentOrder.deviceModel, data.date);
          } else if (newStatus === 'failed') {
            message = templates.repairFailed(currentOrder.deviceModel, currentOrder.customerName);
          } else if (newStatus === 'awaiting_response') {
            message = templates.inspectionResult(currentOrder.deviceModel, currentOrder.issue, currentOrder.cost, currentOrder.customerName);
          }
          
          if (message) {
            const finalMessage = parseTemplate(message, {}, shopSettings);

            if (newStatus === 'ready') {
              if (notifyOnReady) {
                if (readyNotificationChannel === 'app') {
                  // Direct automated in-app push alert
                  try {
                    const cleanPhone = currentOrder.customerPhone.replace(/[\s\-\(\)]/g, '').trim();
                    const q = query(
                      collection(db, 'users'), 
                      where('phone', '==', cleanPhone)
                    );
                    const qSnap = await getDocs(q);
                    const hasAccount = !qSnap.empty;
                    
                    if (hasAccount) {
                      const customerUserDoc = qSnap.docs[0];
                      const userId = customerUserDoc.id;
                      
                      await addDoc(collection(db, 'notifications'), {
                        receiverId: userId,
                        title: `تحديث صيانة جهازك: ${currentOrder.deviceModel}`,
                        message: finalMessage,
                        type: 'maintenance',
                        status: 'unread',
                        createdAt: serverTimestamp()
                      });
                      setStatus({ type: 'success', message: '🔔 تم إرسال إشعار فوري لتطبيق العميل بنجاح!' });
                    } else {
                      // fallback to WhatsApp if selected 'app' but has no account
                      sendWhatsApp(currentOrder.customerPhone, finalMessage);
                      setStatus({ type: 'success', message: '💬 العميل لا يمتلك حساباً بالتطبيق، تم بث الإشعار عبر واتساب تلقائياً.' });
                    }
                  } catch (e) {
                    console.error("Error sending auto in-app notification:", e);
                    sendWhatsApp(currentOrder.customerPhone, finalMessage);
                  }
                } else if (readyNotificationChannel === 'sms') {
                  // Send directly via SMS
                  try {
                    await sendSMS(currentOrder.customerPhone, finalMessage);
                    setStatus({ type: 'success', message: '📱 تم فتح نافذة إرسال رسالة SMS لإشعار الزبون بنجاح.' });
                  } catch (e) {
                    console.error("Error sending auto SMS notification:", e);
                    setStatus({ type: 'error', message: '❌ فشل فتح نافذة رسالة الـ SMS للزبون.' });
                  }
                } else {
                  // send directly via WhatsApp
                  sendWhatsApp(currentOrder.customerPhone, finalMessage);
                  setStatus({ type: 'success', message: '💬 تم فتح نافذة واتساب لإرسال إشعار الجاهزية للعميل.' });
                }
              } else {
                setStatus({ type: 'success', message: 'تم إعلان جاهزية الجهاز بنجاح (بدون إرسال إشعار للعميل).' });
              }
            } else {
              // keep manual choices for other statuses
              setNotificationChoice({ order: currentOrder, status: newStatus, message: finalMessage });
            }
            
            // Also send in-app notification to the supervisor/owner
            if (profile?.ownerId) {
              await sendNotification(
                profile.ownerId,
                `تحديث حالة طلب: ${currentOrder.deviceModel}`,
                `تم تغيير حالة الطلب الخاص بـ ${currentOrder.customerName} إلى ${data.status}`,
                newStatus === 'ready' ? 'success' : newStatus === 'failed' ? 'error' : 'info'
              );
            }
          }
        }

        const agreement = getEngineerAgreement(currentOrder.engineerId);

        // If status is ready, record engineer profit (if timing is on_ready)
        if (newStatus === 'ready') {
          if (agreement.profitTiming === 'on_ready') {
            const profit = calculateProfit(currentOrder);
            await addDoc(collection(db, 'engineerTransactions'), {
              ownerId: profile?.ownerId,
              engineerId: currentOrder.engineerId,
              type: 'profit',
              amount: profit.engineer,
              orderId: currentOrder.id,
              description: `فائدة صيانة جهاز (فور الجاهزية): ${currentOrder.deviceModel} (${agreement.engineerSharePercentage}%)`,
              createdAt: serverTimestamp()
            });

            // Update Employee Balance Record
            const empRef = doc(db, 'employees', currentOrder.engineerId);
            const empSnap = await getDoc(empRef);
            if (empSnap.exists()) {
               await updateDoc(empRef, {
                 balance: increment(profit.engineer),
                 updatedAt: serverTimestamp()
               });
            }
          }
        }

        // If status is failed, check if we need to deduct the refund of the advance deposit from the engineer and/or the shop
        if (newStatus === 'failed') {
          const advancePay = currentOrder.advancePayment || 0;
          if (advancePay > 0) {
            let engineerDeduction = 0;
            let shopRefund = 0;

            if (agreement.failedRepairLiability === 'engineer') {
              engineerDeduction = advancePay;
            } else if (agreement.failedRepairLiability === 'split') {
              engineerDeduction = advancePay * 0.5;
              shopRefund = advancePay * 0.5;
            } else { // default is 'shop'
              shopRefund = advancePay;
            }

            // Deduct from engineer if applicable
            if (engineerDeduction > 0) {
              await addDoc(collection(db, 'engineerTransactions'), {
                ownerId: profile?.ownerId,
                engineerId: currentOrder.engineerId,
                type: 'withdrawal',
                amount: engineerDeduction,
                orderId: currentOrder.id,
                description: `خصم قيمة العربون/الواصل المقدم لفشل إصلاح جهاز: ${currentOrder.deviceModel} (حسب العقد: على المهندس ${agreement.failedRepairLiability === 'split' ? 'بالنصف' : 'بالكامل'})`,
                createdAt: serverTimestamp()
              });

              // Update Employee Balance Record
              const empRef = doc(db, 'employees', currentOrder.engineerId);
              const empSnap = await getDoc(empRef);
              if (empSnap.exists()) {
                await updateDoc(empRef, {
                  balance: increment(-engineerDeduction),
                  updatedAt: serverTimestamp()
                });
              }
            }

            // Deduct from shop (cash outflow transaction) if applicable
            if (shopRefund > 0) {
              await addDoc(collection(db, 'transactions'), {
                ownerId: profile?.ownerId,
                operated_by_employee_name: profile?.name || 'غير معروف',
                employee_uid: profile?.uid || 'غير معروف',
                type: 'outflow',
                amount: shopRefund,
                category: 'maintenance_return',
                description: `مرتجع واصل مقدم صيانة جراء فشل إصلاح جهاز: ${currentOrder.deviceModel} - حصة المحل ${agreement.failedRepairLiability === 'split' ? '50%' : '100%'}`,
                orderId: currentOrder.id,
                createdAt: serverTimestamp()
              });
            }
          }
        }

        // If status is delivered, record remaining income and split profits
        if (newStatus === 'delivered') {
          const profit = calculateProfit(currentOrder);
          const remainingAmount = currentOrder.cost - (currentOrder.advancePayment || 0);
          
          if (remainingAmount > 0) {
            await addDoc(collection(db, 'transactions'), {
              ownerId: profile?.ownerId,
              operated_by_employee_name: profile?.name || 'غير معروف',
              employee_uid: profile?.uid || 'غير معروف',
              type: 'income',
              amount: remainingAmount,
              category: 'maintenance_final',
              description: `تسليم صيانة جهاز: ${currentOrder.deviceModel} - حصة المحل`,
              orderId: currentOrder.id,
              createdAt: serverTimestamp()
            });
          }

          // If profit timing is on_complete, credit engineer now!
          if (agreement.profitTiming === 'on_complete') {
            await addDoc(collection(db, 'engineerTransactions'), {
              ownerId: profile?.ownerId,
              engineerId: currentOrder.engineerId,
              type: 'profit',
              amount: profit.engineer,
              orderId: currentOrder.id,
              description: `فائدة صيانة جهاز (عند الاستلام والتسليم): ${currentOrder.deviceModel} (${agreement.engineerSharePercentage}%)`,
              createdAt: serverTimestamp()
            });

            // Update Employee Balance Record
            const empRef = doc(db, 'employees', currentOrder.engineerId);
            const empSnap = await getDoc(empRef);
            if (empSnap.exists()) {
               await updateDoc(empRef, {
                 balance: increment(profit.engineer),
                 updatedAt: serverTimestamp()
               });
            }
          }

          // Post to GL
          if (profile?.ownerId) {
            postSaleToGL(profile.ownerId, {
              total: currentOrder.cost,
              cost: currentOrder.cost - profit.total,
              paymentMethod: 'cash',
              currency: 'YER',
              exchangeRate: 1,
              description: `صيانة جهاز ${currentOrder.deviceModel} - ${currentOrder.customerName}`
            });

            postMaintenanceToLedger({
              ownerId: profile.ownerId,
              total: currentOrder.cost,
              isPaid: true,
              engineerCommission: profit.engineer,
              engineerName: currentOrder.engineerName,
              ticketNumber: currentOrder.id,
              customerName: currentOrder.customerName
            });

            // Reward points (Fixed 50 points per successful repair)
            import('../services/smartCommerceService').then(({ smartCommerceService }) => {
              smartCommerceService.rewardPoints(profile.ownerId!, currentOrder.customerPhone, 50, 'repair');
            });
          }
        }

        // If status is failed, return parts to inventory and refund advance payment
        if (newStatus === 'failed') {
          // Return parts
          for (const part of (currentOrder.sparePartsUsed || [])) {
            const invRef = doc(db, 'inventory', part.id);
            const invSnap = await getDoc(invRef);
            if (invSnap.exists()) {
              await updateDoc(invRef, {
                stock: invSnap.data().stock + 1
              });
            }
          }
        }

        await logActivityDetailed({
           type: 'update_maintenance',
           userId: profile.uid,
           userName: profile.name,
           ownerId: profile.ownerId || '',
           details: `تغيير حالة طلب ${currentOrder.customerName} إلى ${newStatus}`
        });

        await broadcastToCustomerApp(currentOrder.customerPhone, {
          ...currentOrder,
          status: newStatus
        });
      } catch (error: any) {
        console.error('Background status update failed:', error);
        setStatus({
          type: 'error',
          message: error.message || 'فشل تحديث حالة الطلب'
        });
      }
    })();
  };

  const filteredOrders = orders.filter(order => {
    // 1. Filter by Active vs Archived (delivered) view mode
    const isDelivered = order.status === 'delivered';
    if (maintenanceViewMode === 'active' && isDelivered) {
      return false;
    }
    if (maintenanceViewMode === 'archived' && !isDelivered) {
      return false;
    }

    // 2. Filter by search term
    const matchesSearch = 
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.imei?.includes(searchTerm);

    // 3. Filter by status dropdown
    const matchesFilter = filterStatus === 'all' || order.status === filterStatus;

    // 4. Filter by selected specific day (تحديد يوم)
    let matchesDate = true;
    if (archiveDate && order.createdAt) {
      const orderDateObj = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt as any);
      const orderDateStr = orderDateObj.toISOString().split('T')[0]; // YYYY-MM-DD
      matchesDate = orderDateStr === archiveDate;
    }

    return matchesSearch && matchesFilter && matchesDate;
  });

  const openMessageModal = (order: MaintenanceOrder, type: 'ready' | 'failed' | 'cost' | 'details' | 'custom', customMessage?: string) => {
    const data = {
      name: order.customerName,
      phone: order.customerPhone,
      issue: order.issue,
      device: order.deviceModel,
      contents: order.requiredPartName || 'لا يوجد',
      date: order.createdAt instanceof Timestamp ? order.createdAt.toDate().toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG'),
      total: order.cost,
      paid: order.advancePayment || 0,
      remaining: order.cost - (order.advancePayment || 0),
      status: order.status === 'ready' ? 'جاهزة' : order.status === 'delivered' ? 'تم التسليم' : order.status === 'working' ? 'قيد العمل' : 'بانتظار العمل'
    };

    let message = customMessage || '';
    let title = 'إرسال رسالة';

    if (!customMessage) {
      if (type === 'ready') {
        message = templates.deviceReady(order.deviceModel, data.remaining, order.customerName, data.date);
        title = 'إشعار جاهزية الجهاز';
      } else if (type === 'failed') {
        message = templates.repairFailed(order.deviceModel, order.customerName);
        title = 'إشعار فشل الإصلاح';
      } else if (type === 'cost') {
        message = templates.inspectionResult(order.deviceModel, order.issue, order.cost, order.customerName);
        title = 'إشعار نتيجة الفحص';
      } else if (type === 'details') {
        message = templates.orderDetails(data) + templates.trackingLink(profile?.name || 'alraqam1', order.customerPhone);
        title = 'إرسال تفاصيل الطلب';
      }
    }

    const finalMessage = parseTemplate(message, {}, shopSettings);

    setMessageModal({
      isOpen: true,
      phone: order.customerPhone,
      message: finalMessage,
      title
    });
  };

  // Derive live maintenance financial metrics for today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const dailyMaintenanceStats = orders.reduce((acc, order) => {
    let orderDate: Date | null = null;
    if (order.createdAt) {
      if (typeof (order.createdAt as any).toDate === 'function') {
        orderDate = (order.createdAt as any).toDate();
      } else if (order.createdAt instanceof Date) {
        orderDate = order.createdAt;
      } else {
        orderDate = new Date(order.createdAt as any);
      }
    }

    // Check if created today or updated today
    const isToday = orderDate && orderDate >= startOfToday;

    if (isToday) {
      acc.totalRevenue += Number(order.cost) || 0;
      acc.totalCount += 1;
      
      const profitInfo = calculateProfit(order);
      
      if (order.status === 'delivered' || order.status === 'ready') {
        acc.completedToday += 1;
        acc.commissionsToday += profitInfo.engineer;
        acc.netShopProfit += profitInfo.shop;
      }
    }

    if (order.status === 'waiting') {
      acc.waitingCount += 1;
    } else if (order.status === 'working') {
      acc.workingCount += 1;
    }

    return acc;
  }, { totalRevenue: 0, totalCount: 0, completedToday: 0, commissionsToday: 0, netShopProfit: 0, waitingCount: 0, workingCount: 0 });

  const handleSaveWorkshopSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;

    const totalLossShare = Number(workshopSettings.lossShopPercentage) + Number(workshopSettings.lossEngineerPercentage) + Number(workshopSettings.lossCustomerPercentage);
    if (totalLossShare !== 100) {
      alert('عذراً، يجب أن يكون مجموع نسب توزيع خسائر التوالف والمسؤولية مساوياً لـ 100% تماماً. المجموع الحالي: ' + totalLossShare + '%');
      return;
    }

    setIsSubmitting(true);
    try {
      const ownerId = profile?.ownerId;
      if (!ownerId) {
        throw new Error('لم يتم العثور على معرف مالك الحساب (ownerId). يرجى التأكد من تسجيل الدخول بحساب صحيح.');
      }

      await setDoc(doc(db, 'settings', ownerId), {
        ownerId: ownerId,
        defaultEngineerId: workshopSettings.defaultEngineerId || '',
        defaultStockLocation: workshopSettings.defaultStockLocation || '',
        lossShopPercentage: Number(workshopSettings.lossShopPercentage) || 0,
        lossEngineerPercentage: Number(workshopSettings.lossEngineerPercentage) || 0,
        lossCustomerPercentage: Number(workshopSettings.lossCustomerPercentage) || 0,
        enableDelayPenalties: !!workshopSettings.enableDelayPenalties,
        delayLimitDays: Number(workshopSettings.delayLimitDays) || 0,
        dailyDelayFine: Number(workshopSettings.dailyDelayFine) || 0,
        enableConfiscation: !!workshopSettings.enableConfiscation,
        enableDiagnosticFee: !!workshopSettings.enableDiagnosticFee,
        diagnosticFeePrice: Number(workshopSettings.diagnosticFeePrice) || 0,
        sparePartProfitSharing: workshopSettings.sparePartProfitSharing || 'shop',
        enableReadyNotification: !!workshopSettings.enableReadyNotification,
        readyNotificationChannel: workshopSettings.readyNotificationChannel || 'app',
        updatedAt: serverTimestamp()
      }, { merge: true });
      setStatus({ type: 'success', message: 'تم حفظ وتعميم إعدادات الورشة بنجاح.' });
      setIsSettingsOpen(false);
    } catch (err: any) {
      console.error('Error saving workshop settings:', err);
      setStatus({ type: 'error', message: 'فشل حفظ الإعدادات: ' + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEngForAgreement?.uid) return;
    setSavingAgreement(true);
    try {
      await updateDoc(doc(db, 'users', selectedEngForAgreement.uid), {
        engineerSharePercentage: Number(agreementPercentage),
        sparePartPaymentResponsibility: partPaymentResp,
        profitTiming: profitTiming,
        failedRepairLiability: failedLiability
      });
      
      // Update locally
      setEngineers(prev => prev.map(u => u.uid === selectedEngForAgreement.uid ? {
        ...u,
        engineerSharePercentage: Number(agreementPercentage),
        sparePartPaymentResponsibility: partPaymentResp,
        profitTiming: profitTiming,
        failedRepairLiability: failedLiability
      } : u));
      
      alert('✓ تم حفظ واتفاقية وعقد عمل المهندس وتثبيتها بنجاح!');
      setIsEngineerAgreementsOpen(false);
    } catch (error: any) {
      console.error('Error saving engineer agreement:', error);
      alert('فشل حفظ الاتفاقية: ' + error.message);
    } finally {
      setSavingAgreement(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Notifications */}
      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-bold ${
              status.type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'
            }`}
          >
            <AlertTriangle size={20} />
            {status.message}
            <button onClick={() => setStatus(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Choice Modal */}
      <AnimatePresence>
        {notificationChoice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotificationChoice(null)}
              className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-navy-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/10"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mx-auto">
                  <Bell size={40} />
                </div>
                <h3 className="text-2xl font-black text-navy-900 dark:text-white font-cairo">إرسال تنبيه للعميل</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-cairo">
                  اختر طريقة إرسال التنبيه للعميل (<span className="font-extrabold text-[#d4af37]">{notificationChoice.order.customerName}</span>) بخصوص حالة الجهاز.
                </p>

                {checkingAccountStatus ? (
                  <div className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl animate-pulse">
                    <Loader2 className="animate-spin text-amber-500" size={24} />
                    <span className="text-xs text-gray-400 font-cairo">جاري التحقق من وجود حساب نشط للزبون...</span>
                  </div>
                ) : customerHasInAppAccount ? (
                  <div className="p-4 bg-success/15 border border-success/30 rounded-2xl space-y-2 animate-in fade-in duration-300">
                    <div className="flex items-center justify-center gap-2 text-success font-black text-sm font-cairo">
                      <span>🔔 تم إرسال إشعار تلقائي فعال</span>
                    </div>
                    <p className="text-xs text-success/80 dark:text-success/90 leading-relaxed font-cairo">
                      يمتلك الزبون حساباً نشطاً على التطبيق، فتم إرسال تنبيه فوري يظهر له فور فتح الإنترنت مباشرة.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-1">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-bold leading-relaxed font-cairo">
                      ⚠️ الزبون لا يمتلك حساب فعال على التطبيق حالياً.
                    </p>
                    <p className="text-[10px] text-gray-400 font-cairo">
                      يرجى الاختيار من قنوات الرسائل التقليدية البديلة المتاحة بالأسفل لتنبيهه.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button
                    onClick={async () => {
                      try {
                        await sendSMS(notificationChoice.order.customerPhone, notificationChoice.message);
                        setNotificationChoice(null);
                        setStatus({ type: 'success', message: 'تم إرسال الرسالة بنجاح' });
                      } catch (err: any) {
                        console.error('SMS failed:', err);
                        setStatus({ type: 'error', message: err.message || 'فشل إرسال الرسالة. يرجى التحقق من الإعدادات.' });
                      }
                    }}
                    className="flex flex-col items-center gap-3 p-6 bg-navy-700 hover:bg-navy-800 text-white rounded-2xl transition-all group"
                  >
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone size={24} />
                    </div>
                    <span className="font-bold">رسالة SMS</span>
                  </button>

                  <button
                    onClick={() => {
                      openMessageModal(notificationChoice.order, 'custom', notificationChoice.message);
                      setNotificationChoice(null);
                    }}
                    className="flex flex-col items-center gap-3 p-6 bg-success hover:bg-success/90 text-white rounded-2xl transition-all group"
                  >
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageCircle size={24} />
                    </div>
                    <span className="font-bold">واتساب</span>
                  </button>
                </div>

                <button
                  onClick={() => setNotificationChoice(null)}
                  className="w-full py-3 text-gray-500 hover:text-navy-900 dark:hover:text-white font-bold transition-colors"
                >
                  إغلاق بدون إرسال
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="بحث بالاسم، الجهاز، أو IMEI..." 
            className="w-full pr-12 pl-4 py-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select 
            className="flex-1 sm:flex-none px-4 py-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">كل الحالات</option>
            <option value="waiting">بانتظار العمل</option>
            <option value="working">قيد العمل</option>
            <option value="awaiting_response">بانتظار الرد</option>
            <option value="ready">جاهز</option>
            <option value="delivered">تم التسليم</option>
            <option value="failed">فشل الإصلاح</option>
          </select>
          <button 
            onClick={() => openAddModal('hardware')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-navy-700 hover:bg-navy-800 text-white rounded-xl font-bold bounce-hover shadow-lg shadow-navy-900/20 text-sm"
          >
            <Plus size={18} />
            طلب صيانة (هاردوير)
          </button>
          
          <button 
            onClick={() => openAddModal('software')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-brand-primary hover:brightness-110 text-white rounded-xl font-bold bounce-hover shadow-lg shadow-brand-primary/20 text-sm"
          >
            <Plus size={18} />
            طلب برمجة (سوفتوير)
          </button>

          {(!profile?.role || profile.role === 'owner' || profile.role === 'manager' || profile.role === 'superadmin') && (
            <button 
              onClick={() => setIsEngineerAgreementsOpen(true)}
              className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 rounded-xl transition-all flex items-center justify-center cursor-pointer gap-2 font-bold text-sm"
              title="عقود واتفاقيات المهندسين الفردية"
            >
              <Users size={18} />
              <span className="hidden md:inline">عقود المهندسين</span>
            </button>
          )}
          
          {(!profile?.role || (profile.role !== 'customer' && profile.role !== 'guest')) && (
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 bg-navy-700/10 text-navy-700 dark:text-brand-primary hover:bg-navy-700/20 rounded-xl transition-all flex items-center justify-center cursor-pointer"
              title="إعدادات تشغيل الورشة والصلاحيات"
            >
              <Settings size={20} />
            </button>
          )}
        </div>
      </div>

      {/* View Mode Switching Controls (أجهزة نشطة vs أرشيف الأجهزة المستلمة) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-navy-900/40 rounded-2xl border border-gray-100 dark:border-navy-800">
        <div className="flex bg-white dark:bg-navy-800 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-navy-700 w-full md:w-auto">
          <button
            type="button"
            id="maint-active-mode-btn"
            onClick={() => {
              setMaintenanceViewMode('active');
              setSearchParams({ mode: 'active' });
            }}
            className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              maintenanceViewMode === 'active'
                ? 'bg-[#d4af37] text-black shadow-md font-bold'
                : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-navy-700'
            }`}
          >
            <Wrench size={16} />
            الجوالات النشطة تحت الصيانة ({orders.filter(o => o.status !== 'delivered').length})
          </button>
          <button
            type="button"
            id="maint-archived-mode-btn"
            onClick={() => {
              setMaintenanceViewMode('archived');
              setSearchParams({ mode: 'archived' });
            }}
            className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              maintenanceViewMode === 'archived'
                ? 'bg-[#d4af37] text-black shadow-md font-bold'
                : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-navy-700'
            }`}
          >
            <CheckCircle2 size={16} />
            أرشيف الجوالات المستلمة ({orders.filter(o => o.status === 'delivered').length})
          </button>
        </div>

        {/* Filters for specific day & link to historical archive */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {maintenanceViewMode === 'archived' && (
            <div className="flex items-center gap-2 bg-white dark:bg-navy-800 px-3 py-2 rounded-xl border border-gray-100 dark:border-navy-700 shadow-sm text-xs animate-in fade-in duration-300" id="maint-archive-datepicker-container">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-gray-400 dark:text-gray-300 font-bold">تحديد يوم الأرشيف:</span>
              <input
                id="maint-archive-date-input"
                type="date"
                className="bg-transparent outline-none font-bold text-gray-700 dark:text-gray-200 cursor-pointer"
                value={archiveDate}
                onChange={(e) => setArchiveDate(e.target.value)}
              />
              {archiveDate && (
                <button
                  type="button"
                  id="maint-clear-archive-date-btn"
                  onClick={() => setArchiveDate('')}
                  className="text-red-500 hover:text-red-600 font-black text-sm px-1"
                  title="مسح التاريخ"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            id="maint-goto-global-archive-btn"
            onClick={() => navigate('/archive?tab=maintenance')}
            className="px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border border-blue-500/15"
          >
            <History size={14} />
            الأرشيف التاريخي الشامل للفواتير
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4.5">
        <AnimatePresence>
          {filteredOrders.map((order, idx) => {
            const isSoftware = order.orderType === 'software';
            return (
            <motion.div
              layout
              key={`${order.id}-${idx}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-glass p-3 sm:p-4 space-y-2.5 relative overflow-hidden group rounded-2xl border border-gray-100 dark:border-navy-700/60 shadow-sm"
            >
              {/* Status Indicator Bar */}
              <div className={`absolute top-0 right-0 left-0 h-1 sm:h-1.5 ${
                order.status === 'ready' ? 'bg-success' :
                order.status === 'working' ? 'bg-blue-500' :
                order.status === 'awaiting_response' ? 'bg-amber-500' :
                order.status === 'delivered' ? 'bg-gray-400' : 'bg-danger'
              }`} />

              {/* Compact Header: Device Model + Type + Price */}
              <div className="flex justify-between items-start pt-1 gap-2">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Smartphone size={15} className="text-brand-primary shrink-0" />
                    <h3 className="text-sm sm:text-base font-black text-navy-900 dark:text-white truncate">
                      {order.deviceModel}
                    </h3>
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                      isSoftware 
                        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/20' 
                        : 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/20'
                    }`}>
                      {isSoftware ? '⚡ سوفتوير' : '🔧 هاردوير'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 flex items-center gap-1 truncate font-semibold">
                    <User size={12} className="text-gray-400 shrink-0" />
                    <span className="truncate">{order.customerName}</span>
                  </p>
                </div>

                <div className="text-left shrink-0 bg-slate-50 dark:bg-navy-900/60 px-2.5 py-1 rounded-xl border border-gray-100 dark:border-white/5">
                  <p className="text-sm sm:text-base font-black text-navy-900 dark:text-white font-mono leading-none">{order.cost} <span className="text-[10px] font-normal">ر.ي</span></p>
                  {order.advancePayment > 0 ? (
                    <p className="text-[9px] font-bold text-success mt-0.5">مقدم: {order.advancePayment}</p>
                  ) : (
                    <p className="text-[9px] text-gray-400 uppercase tracking-tighter">التكلفة</p>
                  )}
                </div>
              </div>

              {order.devicePhoto && (
                <div className="relative">
                  <img src={order.devicePhoto} alt="Device" className="w-full h-16 sm:h-20 object-cover rounded-xl shadow-xs border border-gray-100 dark:border-white/5" referrerPolicy="no-referrer" />
                </div>
              )}

              {/* Compact Info Row: Phone & Serial */}
              <div className="grid grid-cols-2 gap-2 py-1.5 px-2 bg-gray-50/70 dark:bg-navy-900/40 rounded-xl border border-gray-100 dark:border-navy-800 text-[11px]">
                <div className="flex items-center gap-1.5 truncate">
                  <Phone size={12} className="text-navy-700 dark:text-brand-primary shrink-0" />
                  <span className="font-mono font-bold truncate text-gray-700 dark:text-gray-200">{order.customerPhone}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate text-left justify-end">
                  <Hash size={12} className="text-navy-700 dark:text-brand-primary shrink-0" />
                  <span className="font-mono text-gray-600 dark:text-gray-300 truncate text-[10px]">{order.deviceSerialNumber || order.imei || '---'}</span>
                </div>
              </div>

              {/* Compact Issue Description */}
              <div className="bg-gray-50/50 dark:bg-navy-900/30 p-2 rounded-xl border border-gray-100 dark:border-navy-800 text-xs">
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold mb-0.5">
                  <span>{labels.issue}:</span>
                </div>
                <p className="text-gray-700 dark:text-gray-200 line-clamp-2 text-xs leading-snug">
                  {order.issue}
                </p>
              </div>

              {(order.lockPattern || order.appLockCode) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                  {order.lockPattern && (
                    <div className="flex items-center justify-between px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">النقش/القفل:</span>
                      <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs">🔑 {order.lockPattern}</span>
                    </div>
                  )}
                  {order.appLockCode && (
                    <div className="flex items-center justify-between px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs">
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">App PIN:</span>
                      <span className="font-mono font-black text-indigo-600 dark:text-indigo-300 text-xs">🛡️ {order.appLockCode}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Compact Action Buttons Row */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-navy-700/60 flex-wrap gap-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {order.status !== 'delivered' && (
                    <button 
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsDepositModalOpen(true);
                      }}
                      className="p-1.5 bg-success/10 text-success hover:bg-success/20 rounded-lg transition-colors cursor-pointer"
                      title="توصيل مبلغ (دفعة)"
                    >
                      <DollarSign size={15} />
                    </button>
                  )}
                  {order.status !== 'delivered' && (
                    <button 
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsPartsModalOpen(true);
                      }}
                      className="p-1.5 bg-navy-700/10 text-navy-700 dark:text-brand-primary hover:bg-navy-700/20 rounded-lg transition-colors cursor-pointer"
                      title="إضافة قطع غيار"
                    >
                      <Package size={15} />
                    </button>
                  )}
                  <button 
                    onClick={() => printReceipt('maintenance', order, shopSettings)}
                    className="p-1.5 bg-navy-700/10 text-navy-700 dark:text-brand-primary hover:bg-navy-700/20 rounded-lg transition-colors cursor-pointer"
                    title="طباعة سند استلام"
                  >
                    <Printer size={15} />
                  </button>
                  {order.status !== 'delivered' && (
                    <>
                      <button 
                        onClick={() => {
                          const portalUrl = `${window.location.origin}/portal?shop=${profile?.name}&phone=${order.customerPhone}&tab=maintenance`;
                          const date = new Date().toLocaleDateString('ar-EG');
                          const message = order.status === 'ready' 
                            ? templates.deviceReady(order.deviceModel, order.cost - (order.advancePayment || 0), order.customerName, date)
                            : order.status === 'failed'
                            ? templates.repairFailed(order.deviceModel, order.customerName)
                            : order.status === 'awaiting_response'
                            ? templates.inspectionResult(order.deviceModel, order.issue, order.cost, order.customerName)
                            : `عزيزي العميل لديكم اشعار من محل ${shopSettings?.shopName || 'Jam system pro'} بخصوص جهازكم ${order.deviceModel}`;
                          
                          const finalMessage = parseTemplate(message, {}, shopSettings) + `\n\nلمتابعة حالة جهازك:\n${portalUrl}`;
                          sendWhatsApp(order.customerPhone, finalMessage);
                        }}
                        className="p-1.5 bg-success/10 text-success hover:bg-success/20 rounded-lg transition-colors cursor-pointer"
                        title="إرسال واتساب"
                      >
                        <MessageCircle size={15} />
                      </button>
                      <button 
                        onClick={async () => {
                          const portalUrl = `${window.location.origin}/portal?shop=${profile?.name}&phone=${order.customerPhone}&tab=maintenance`;
                          const date = new Date().toLocaleDateString('ar-EG');
                          const message = order.status === 'ready' 
                            ? templates.deviceReady(order.deviceModel, order.cost - (order.advancePayment || 0), order.customerName, date)
                            : order.status === 'failed'
                            ? templates.repairFailed(order.deviceModel, order.customerName)
                            : order.status === 'awaiting_response'
                            ? templates.inspectionResult(order.deviceModel, order.issue, order.cost, order.customerName)
                            : `عزيزي العميل لديكم اشعار من نظام ادارة مبيعات محل ${shopSettings?.shopName || 'Jam system pro'} بخصوص جهازكم ${order.deviceModel}`;
                          
                          const finalMessage = parseTemplate(message, {}, shopSettings) + `\n\nتتبع جهازك: ${portalUrl}`;
                          try {
                            await sendSMS(order.customerPhone, finalMessage);
                            setStatus({ type: 'success', message: 'تم إرسال الرسالة بنجاح' });
                          } catch (err: any) {
                            console.error('Manual SMS failed:', err);
                            setStatus({ type: 'error', message: err.message || 'فشل إرسال الرسالة. يرجى التحقق من الإعدادات.' });
                          }
                        }}
                        className="p-1.5 bg-navy-700/10 text-navy-700 dark:text-brand-primary hover:bg-navy-700/20 rounded-lg transition-colors cursor-pointer"
                        title="إرسال SMS"
                      >
                        <Send size={15} />
                      </button>
                      <button 
                        onClick={() => {
                          const portalUrl = `${window.location.origin}/portal?shop=${profile?.name}&phone=${order.customerPhone}&tab=maintenance`;
                          const shareText = `مرحباً ${order.customerName}، يمكنك متابعة حالة صيانة جهازك (${order.deviceModel}) مباشرة من هنا:\n${portalUrl}`;
                          
                          if (navigator.share) {
                            navigator.share({
                              title: 'متابعة الصيانة',
                              text: shareText,
                              url: portalUrl
                            });
                          } else {
                            window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
                          }
                        }}
                        className="p-1.5 bg-royal-gold/10 text-royal-gold hover:bg-royal-gold/20 rounded-lg transition-colors cursor-pointer"
                        title="مشاركة رابط المتابعة"
                      >
                        <Share2 size={15} />
                      </button>
                    </>
                  )}
                  {order.status === 'waiting' && (
                    <>
                      <button 
                        onClick={() => {
                          setPendingStatusUpdate({ id: order.id, status: 'working' });
                          setIsConfirmStatusOpen(true);
                        }}
                        className="p-1.5 bg-warning/10 text-warning hover:bg-warning/20 rounded-lg transition-colors cursor-pointer"
                        title="بدء العمل"
                      >
                        <Clock size={15} />
                      </button>
                      <button 
                        onClick={() => {
                          setPendingStatusUpdate({ id: order.id, status: 'awaiting_response' });
                          setIsConfirmStatusOpen(true);
                        }}
                        className="p-1.5 bg-navy-700/10 text-navy-700 rounded-lg hover:bg-navy-700/20 transition-colors cursor-pointer"
                        title="بانتظار الرد بعد الفحص"
                      >
                        <AlertTriangle size={15} />
                      </button>
                    </>
                  )}
                  {order.status === 'working' && (
                    <>
                      <button 
                        onClick={() => {
                          setPendingStatusUpdate({ id: order.id, status: 'awaiting_response' });
                          setIsConfirmStatusOpen(true);
                        }}
                        className="p-1.5 bg-navy-700/10 text-navy-700 rounded-lg hover:bg-navy-700/20 transition-colors cursor-pointer"
                        title="بانتظار الرد بعد الفحص"
                      >
                        <AlertTriangle size={15} />
                      </button>
                      <button 
                        onClick={() => {
                          setPendingStatusUpdate({ id: order.id, status: 'ready' });
                          setIsConfirmStatusOpen(true);
                        }}
                        className="p-1.5 bg-success/10 text-success hover:bg-success/20 rounded-lg transition-colors cursor-pointer"
                        title="جاهز للاستلام"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                      <button 
                        onClick={() => {
                          setPendingStatusUpdate({ id: order.id, status: 'failed' });
                          setIsConfirmStatusOpen(true);
                        }}
                        className="p-1.5 bg-danger/10 text-danger hover:bg-danger/20 rounded-lg transition-colors cursor-pointer"
                        title="فشل الإصلاح"
                      >
                        <X size={15} />
                      </button>
                    </>
                  )}
                  {order.status === 'awaiting_response' && (
                    <>
                      <button 
                        onClick={() => {
                          setPendingStatusUpdate({ id: order.id, status: 'working' });
                          setIsConfirmStatusOpen(true);
                        }}
                        className="p-1.5 bg-warning/10 text-warning hover:bg-warning/20 rounded-lg transition-colors cursor-pointer"
                        title="بدء العمل (بعد الموافقة)"
                      >
                        <Clock size={15} />
                      </button>
                      <button 
                        onClick={() => {
                          setPendingStatusUpdate({ id: order.id, status: 'ready' });
                          setIsConfirmStatusOpen(true);
                        }}
                        className="p-1.5 bg-success/10 text-success hover:bg-success/20 rounded-lg transition-colors cursor-pointer"
                        title="جاهز للاستلام"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                      <button 
                        onClick={() => {
                          setPendingStatusUpdate({ id: order.id, status: 'failed' });
                          setIsConfirmStatusOpen(true);
                        }}
                        className="p-1.5 bg-danger/10 text-danger hover:bg-danger/20 rounded-lg transition-colors cursor-pointer"
                        title="فشل الإصلاح"
                      >
                        <X size={15} />
                      </button>
                    </>
                  )}
                  {order.status === 'ready' && (
                    <button 
                      onClick={() => {
                        const remaining = order.cost - (order.advancePayment || 0);
                        if (remaining > 0) {
                          setStatus({ 
                            type: 'error', 
                            message: `عذراً، يرجى استكمال كامل المبلغ المتبقي (${remaining} ر.ي) أولاً قبل تغيير حالة الطلب للتسليم.` 
                          });
                          return;
                        }
                        setPendingStatusUpdate({ id: order.id, status: 'delivered' });
                        setIsConfirmStatusOpen(true);
                      }}
                      className="p-1.5 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors cursor-pointer"
                      title="تسليم للجهاز"
                    >
                      <CheckCircle2 size={15} />
                    </button>
                  )}
                  {order.status === 'failed' && (
                    <div className="text-xs text-danger font-bold">فشل الإصلاح</div>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                    order.status === 'ready' ? 'bg-success/10 text-success' :
                    order.status === 'working' ? 'bg-warning/10 text-warning' :
                    order.status === 'delivered' ? 'bg-gray-100 text-gray-400' :
                    order.status === 'failed' ? 'bg-danger/10 text-danger' :
                    order.status === 'awaiting_response' ? 'bg-navy-700/10 text-navy-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {order.status === 'ready' ? 'جاهز' : 
                     order.status === 'working' ? 'قيد العمل' : 
                     order.status === 'delivered' ? 'تم التسليم' : 
                     order.status === 'failed' ? 'فشل الإصلاح' :
                     order.status === 'awaiting_response' ? 'بانتظار الرد' :
                     'بانتظار العمل'}
                  </span>
                  {order.status === 'ready' && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-success">ربح المهندس: {calculateProfit(order).engineer.toFixed(0)} ر.ي</p>
                      <p className="text-[10px] font-bold text-navy-700 dark:text-brand-primary">ربح المحل: {calculateProfit(order).shop.toFixed(0)} ر.ي</p>
                    </div>
                  )}
                  {order.status === 'delivered' && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400">إجمالي الربح: {calculateProfit(order).total.toFixed(0)} ر.ي</p>
                    </div>
                  )}
                  {order.status === 'failed' && (
                    <p className="text-[10px] font-bold text-danger">تم إرجاع القطع والمقدم</p>
                  )}
                </div>
              </div>
            </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {isConfirmStatusOpen && pendingStatusUpdate?.status === 'ready' ? (
        <AnimatePresence>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsConfirmStatusOpen(false);
                setPendingStatusUpdate(null);
              }}
              className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-navy-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-navy-700 space-y-6 text-right"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-navy-700">
                <h3 className="text-xl font-black text-navy-900 dark:text-white flex items-center gap-2">
                  <Wrench className="text-amber-500 animate-bounce" size={22} />
                  تأكيد الجاهزية وتنبيه الزبون
                </h3>
                <button
                  onClick={() => {
                    setIsConfirmStatusOpen(false);
                    setPendingStatusUpdate(null);
                  }}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-navy-700 rounded-lg text-gray-400 dark:text-gray-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Order Quick Details Card */}
              {(() => {
                const order = orders.find(o => o.id === pendingStatusUpdate.id);
                if (!order) return null;
                return (
                  <div className="bg-gray-50 dark:bg-navy-900 p-4 rounded-2xl border border-gray-100 dark:border-navy-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">العميل:</span>
                      <span className="text-sm font-bold text-navy-900 dark:text-white">{order.customerName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">الجهاز:</span>
                      <span className="text-sm font-bold text-navy-900 dark:text-white">{order.deviceBrand} {order.deviceModel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">الهاتف:</span>
                      <span className="text-xs font-mono font-bold text-navy-900 dark:text-slate-300">{order.customerPhone}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Customer VIP App Connectivity Check */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 block">حالة حساب العميل في تطبيق زبائن VIP:</span>
                {checkingTargetCustomerApp ? (
                  <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 animate-pulse">
                    <Loader2 className="animate-spin" size={14} />
                    <span>جاري التحقق من وجود حساب نشط للزبون...</span>
                  </div>
                ) : targetCustomerHasApp ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>الزبون يمتلك حساباً نشطاً على تطبيق VIP 📱 (جاهز للاستقبال فورا)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-500/5 p-3 rounded-xl border border-slate-500/10">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>الزبون لا يملك حساباً نشطاً حالياً ⚠️ (سيتم توجيه الإرسال عبر واتساب تلقائياً)</span>
                  </div>
                )}
              </div>

              {/* Toggle Notification Option */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-navy-900 dark:text-slate-200 block">إرسال إشعار جاهزية فوري:</span>
                    <span className="text-[10px] text-slate-400">تنبيه العميل بانتهاء الصيانة والمستحقات فور الحفظ</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnReady}
                      onChange={(e) => setNotifyOnReady(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-navy-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 dark:peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* Preferred Channel Selection */}
                {notifyOnReady && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 p-3 bg-slate-50 dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800"
                  >
                    <span className="text-xs font-bold text-slate-400 block mb-1">قناة الإرسال المفضلة:</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (targetCustomerHasApp) {
                            setReadyNotificationChannel('app');
                          } else {
                            setStatus({ type: 'error', message: 'عذراً، الزبون لا يمتلك حساب فعال في تطبيق VIP. تم تثبيت خيار واتساب.' });
                          }
                        }}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                          readyNotificationChannel === 'app'
                            ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold shadow-sm'
                            : 'border-gray-200 dark:border-navy-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-navy-600'
                        } ${!targetCustomerHasApp ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <Bell size={18} />
                        <span className="text-[10px] font-black">تطبيق VIP</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReadyNotificationChannel('whatsapp')}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                          readyNotificationChannel === 'whatsapp'
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-bold shadow-sm'
                            : 'border-gray-200 dark:border-navy-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-navy-600'
                        }`}
                      >
                        <MessageCircle size={18} />
                        <span className="text-[10px] font-black">واتساب</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReadyNotificationChannel('sms')}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                          readyNotificationChannel === 'sms'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-500 font-bold shadow-sm'
                            : 'border-gray-200 dark:border-navy-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-navy-600'
                        }`}
                      >
                        <MessageSquare size={18} />
                        <span className="text-[10px] font-black">رسالة SMS</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-navy-700">
                <button
                  onClick={() => {
                    setIsConfirmStatusOpen(false);
                    setPendingStatusUpdate(null);
                  }}
                  className="py-3 px-6 bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-slate-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-navy-700 transition-all text-center"
                >
                  تراجع وإلغاء
                </button>
                <button
                  onClick={() => {
                    if (pendingStatusUpdate) {
                      updateStatus(pendingStatusUpdate.id, pendingStatusUpdate.status);
                    }
                    setIsConfirmStatusOpen(false);
                    setPendingStatusUpdate(null);
                  }}
                  className="py-3 px-6 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 text-center"
                >
                  تأكيد وحفظ التغيير
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      ) : (
        <ConfirmModal
          isOpen={isConfirmStatusOpen}
          onClose={() => {
            setIsConfirmStatusOpen(false);
            setPendingStatusUpdate(null);
          }}
          onConfirm={() => {
            if (pendingStatusUpdate) {
              updateStatus(pendingStatusUpdate.id, pendingStatusUpdate.status);
            }
          }}
          title="تحديث حالة الطلب"
          message={`هل أنت متأكد من تغيير حالة الطلب إلى ${
            pendingStatusUpdate?.status === 'ready' ? 'جاهز' : 
            pendingStatusUpdate?.status === 'working' ? 'قيد العمل' : 
            pendingStatusUpdate?.status === 'delivered' ? 'تم التسليم' : 
            pendingStatusUpdate?.status === 'failed' ? 'فشل الإصلاح' :
            pendingStatusUpdate?.status === 'awaiting_response' ? 'بانتظار الرد' :
            'بانتظار العمل'
          }؟`}
          confirmText="تأكيد التغيير"
        />
      )}

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setIsConfirmDeleteOpen(false);
          setOrderToDelete(null);
        }}
        onConfirm={async () => {
          if (orderToDelete) {
            const isSuperAdmin = profile?.role === 'superadmin';
            const lockCheck = transactionLockService.canDelete(orderToDelete.createdAt);
            if (!lockCheck.allowed && !isSuperAdmin) {
              setStatus({ type: 'error', message: lockCheck.message });
              setIsConfirmDeleteOpen(false);
              setOrderToDelete(null);
              return;
            }
            try {
              await deleteDoc(doc(db, 'maintenanceOrders', orderToDelete.id));
              await logActivity(profile, 'حذف طلب صيانة', `تم حذف طلب الصيانة رقم ${orderToDelete.id.slice(-6)} للعميل ${orderToDelete.customerName}`);
              setStatus({ type: 'success', message: 'تم حذف الطلب بنجاح' });
            } catch (error) {
              setStatus({ type: 'error', message: 'حدث خطأ أثناء الحذف' });
            }
          }
        }}
        title="حذف طلب صيانة"
        message={`هل أنت متأكد من حذف طلب العميل ${orderToDelete?.customerName}؟ سيتم حذفه نهائياً.`}
        confirmText="حذف نهائي"
        type="danger"
      />

      {/* Deposit Modal */}
      <AnimatePresence>
        {isDepositModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDepositModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">توصيل مبلغ (دفعة صيانة)</h3>
                <button onClick={() => setIsDepositModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddDeposit} className="p-8 space-y-6">
                <div className="p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-700">
                  <p className="text-xs text-gray-400 mb-1">الجهاز والعميل:</p>
                  <p className="font-bold">{selectedOrder?.deviceModel} - {selectedOrder?.customerName}</p>
                  <div className="mt-2 flex justify-between text-xs">
                    <span>التكلفة: {selectedOrder?.cost}</span>
                    <span>المقدم الحالي: {selectedOrder?.advancePayment}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label-field">المبلغ المراد توصيله (ر.ي)</label>
                  <input 
                    required 
                    type="number" 
                    className="input-field" 
                    value={depositAmount} 
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn-primary w-full py-5 text-xl">
                  تأكيد استلام المبلغ (توصيل)
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Spare Parts Modal */}
      <AnimatePresence>
        {isPartsModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPartsModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-lg bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">إضافة قطع غيار للجهاز</h3>
                <button onClick={() => setIsPartsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-bold text-gray-400">القطع المستخدمة حالياً:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder?.sparePartsUsed?.map((p, i) => (
                      <span key={i} className="px-3 py-1 bg-navy-700/5 text-navy-700 dark:text-brand-primary rounded-full text-xs font-bold border border-navy-700/10">
                        {p.name} (${p.price})
                      </span>
                    ))}
                    {(!selectedOrder?.sparePartsUsed || selectedOrder.sparePartsUsed.length === 0) && <p className="text-xs text-gray-400 italic">لا توجد قطع مضافة</p>}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-bold text-gray-500">اختر من المخزن:</p>
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                    {inventory.filter(i => i.category === 'spare_part').map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addSparePart(item)}
                        disabled={item.stock <= 0}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-navy-900 border border-gray-100 dark:border-navy-700 rounded-xl hover:border-brand-primary transition-all"
                      >
                        <div className="text-right">
                          <p className="text-sm font-bold">{item.name}</p>
                          <p className="text-[10px] text-gray-400">كود: {item.barcode || '---'} | المتوفر: {item.stock}</p>
                        </div>
                        <p className="text-sm font-black text-navy-900 dark:text-white">{item.price} ر.ي</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Order Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                width: isMaximized ? '100vw' : '100%',
                height: isMaximized ? '100vh' : 'auto',
                maxWidth: isMaximized ? '100vw' : '850px',
                maxHeight: isMaximized ? '100vh' : '95vh'
              }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative bg-white dark:bg-navy-900 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isMaximized ? 'rounded-none border-0' : 'rounded-[2.5rem] border border-white/10'}`}
            >
              {/* Modal Header */}
              <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-brand-primary/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      إضافة كرت صيانة جديد
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-bold hidden sm:inline-block">نموذج مدمج وسريع</span>
                    </h3>
                    <p className="text-[10px] text-gray-400">سجل بيانات العميل والجهاز وتسعير العطل بسرعة وسهولة.</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors text-gray-500"
                    title={isMaximized ? "تصغير" : "ملء الشاشة"}
                  >
                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors text-gray-500"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddOrder} className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar text-right space-y-3" dir="rtl">
                {/* 1️⃣ بيانات العميل والأجهزة السابقة */}
                <div className="bg-gray-50/70 dark:bg-navy-900/40 p-3 sm:p-3.5 rounded-2xl border border-gray-100 dark:border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-brand-primary" />
                      <h4 className="text-xs font-black text-gray-700 dark:text-gray-300">بيانات العميل والجهاز</h4>
                    </div>
                    {/* Fast Customer Search Dropdown Trigger */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 text-brand-primary flex items-center gap-1 hover:bg-brand-primary/5 transition-all"
                      >
                        <Search size={11} />
                        بحث عميل سابق ({customersList.length})
                      </button>

                      {isCustomerDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-72 sm:w-80 bg-white dark:bg-navy-900 rounded-xl shadow-2xl border border-gray-200 dark:border-navy-700 p-2 z-50 text-right">
                          <div className="relative mb-2">
                            <input
                              type="text"
                              placeholder="ابحث بالاسم أو الهاتف..."
                              className="w-full input-field h-8 text-xs ps-7 pe-2"
                              value={customerSearchQuery}
                              onChange={(e) => setCustomerSearchQuery(e.target.value)}
                              autoFocus
                            />
                            <Search size={12} className="absolute start-2 top-1/2 -translate-y-1/2 text-gray-400" />
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                            {customersList
                              .filter(c => {
                                const q = customerSearchQuery.trim().toLowerCase();
                                if (!q) return true;
                                return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
                              })
                              .slice(0, 15)
                              .map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => handleSelectCustomer(c)}
                                  className="w-full text-right p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-800 flex items-center justify-between text-xs transition-colors"
                                >
                                  <span className="font-bold text-gray-800 dark:text-gray-200">{c.name}</span>
                                  <span className="text-[10px] font-mono text-gray-400">{c.phone}</span>
                                </button>
                              ))}
                            {customersList.length === 0 && (
                              <p className="text-[10px] text-gray-400 text-center py-2">لا يوجد عملاء مسجلون</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer Name, Phone & Device Details in Compact 4-Column Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-gray-500">اسم العميل الثلاثي *</label>
                      <input 
                        required
                        type="text" 
                        placeholder="اسم العميل..."
                        className="w-full input-field h-8 text-xs font-bold"
                        value={formData.customerName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({...formData, customerName: val});
                          updateCustomerPreviousDevices(formData.customerPhone, val);
                        }}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-gray-500">رقم الهاتف النشط *</label>
                      <input 
                        required
                        type="tel" 
                        placeholder="رقم الهاتف..."
                        className="w-full input-field h-8 text-xs font-mono font-bold text-center"
                        value={formData.customerPhone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({...formData, customerPhone: val});
                          updateCustomerPreviousDevices(val, formData.customerName);
                        }}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-gray-500">الماركة / الشركة *</label>
                      <select 
                        required
                        className="w-full input-field h-8 text-xs font-bold"
                        value={formData.deviceBrand}
                        onChange={(e) => setFormData({...formData, deviceBrand: e.target.value})}
                      >
                        <option value="">اختر الماركة...</option>
                        {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                        <option value="Special">أخرى</option>
                      </select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-gray-500">الموديل الدقيق *</label>
                      <input 
                        required
                        type="text" 
                        placeholder="A54, iPhone 13..."
                        className="w-full input-field h-8 text-xs font-bold"
                        value={formData.deviceModel}
                        onChange={(e) => setFormData({...formData, deviceModel: e.target.value})}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4 space-y-0.5">
                      <label className="text-[10px] font-bold text-gray-500">الرقم التسلسلي (S/N / IMEI)</label>
                      <input 
                        type="text" 
                        placeholder="اختياري (IMEI أو الرقم التسلسلي)..."
                        className="w-full input-field h-8 text-xs text-center font-mono"
                        value={formData.deviceSerialNumber}
                        onChange={(e) => setFormData({...formData, deviceSerialNumber: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* 2️⃣ تشخيص العطل، الفني وأقفال الحماية (Screen Lock & App PIN) */}
                <div className="bg-gray-50/70 dark:bg-navy-900/40 p-3 sm:p-3.5 rounded-2xl border border-gray-100 dark:border-white/5 space-y-2.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100 dark:border-white/5">
                    <Wrench size={14} className="text-brand-primary" />
                    <h4 className="text-xs font-black text-gray-700 dark:text-gray-300">تشخيص العطل والفني وحماية الجهاز</h4>
                  </div>

                  {/* Row 1: Engineer, Profit %, Order Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500">المهندس المسؤول</label>
                      <select 
                        required
                        className="w-full input-field h-9 text-xs font-bold"
                        value={formData.engineerId}
                        onChange={(e) => {
                          const engId = e.target.value;
                          setFormData({...formData, engineerId: engId});
                          localStorage.setItem('jam_maint_last_selected_engineer_id', engId);
                        }}
                      >
                        <option value="">اختر المهندس...</option>
                        {engineers.filter(e => e.role === 'engineer' || e.role === 'employee' || e.role === 'manager').map(eng => (
                          <option key={eng.uid} value={eng.uid}>{eng.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500">نسبة الفني %</label>
                      <input 
                        type="number" 
                        className="w-full input-field h-9 text-center text-xs font-black"
                        value={formData.engineerPercentage}
                        onChange={(e) => setFormData({...formData, engineerPercentage: Number(e.target.value)})}
                        placeholder="50"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500">طبيعة الصيانة</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, orderType: 'hardware'})}
                          className={`py-1.5 rounded-xl text-[10px] font-black border transition-all ${formData.orderType === 'hardware' ? 'bg-navy-900 border-navy-900 text-white shadow-sm' : 'border-gray-200 dark:border-navy-700 text-gray-500 bg-white dark:bg-navy-800'}`}
                        >
                          هاردوير (قطع)
                        </button>
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, orderType: 'software'})}
                          className={`py-1.5 rounded-xl text-[10px] font-black border transition-all ${formData.orderType === 'software' ? 'bg-brand-primary border-brand-primary text-white shadow-sm' : 'border-gray-200 dark:border-navy-700 text-gray-500 bg-white dark:bg-navy-800'}`}
                        >
                          سوفتوير (برمجة)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Screen Lock, App Lock Code (PIN), Damage Slider */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Screen Lock / Pattern */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-gray-500">قفل الشاشة / النقش</label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setLockType('text');
                              setFormData({...formData, lockPattern: ''});
                            }}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${lockType === 'text' ? 'bg-navy-700 text-white' : 'bg-gray-200 dark:bg-navy-800 text-gray-500'}`}
                          >
                            نص/رقم
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLockType('pattern');
                              setFormData({...formData, lockPattern: ''});
                            }}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${lockType === 'pattern' ? 'bg-navy-700 text-white' : 'bg-gray-200 dark:bg-navy-800 text-gray-500'}`}
                          >
                            نقش 9 نقاط
                          </button>
                        </div>
                      </div>
                      
                      {lockType === 'text' ? (
                        <input 
                          type="text" 
                          placeholder="رقم سري أو نقش..."
                          className="w-full input-field h-9 text-xs font-mono text-center"
                          value={formData.lockPattern}
                          onChange={(e) => setFormData({...formData, lockPattern: e.target.value})}
                        />
                      ) : (
                        <div className="p-1 bg-white dark:bg-navy-950 rounded-xl border border-gray-200 dark:border-navy-700 flex flex-col items-center">
                          <PatternLockGrid 
                            value={formData.lockPattern}
                            onChange={(newValue) => setFormData({...formData, lockPattern: newValue})}
                          />
                        </div>
                      )}
                    </div>

                    {/* NEW: App Lock Code / PIN */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Key size={11} />
                        رمز قفل التطبيقات (App PIN)
                      </label>
                      <input 
                        type="text" 
                        placeholder="مثال: 1234 أو كود واتساب..."
                        className="w-full input-field h-9 text-xs font-mono text-center font-bold border-indigo-200 focus:border-indigo-500 text-indigo-700 dark:text-indigo-300"
                        value={formData.appLockCode || ''}
                        onChange={(e) => setFormData({...formData, appLockCode: e.target.value})}
                      />
                    </div>

                    {/* Damage Responsibility Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-gray-500">تحمل مسؤولية التلف</span>
                        <span className="font-black text-brand-primary">{formData.damageResponsibility}%</span>
                      </div>
                      <div className="h-9 flex items-center px-2 bg-white dark:bg-navy-950 rounded-xl border border-gray-200 dark:border-navy-700">
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          step="10"
                          className="w-full accent-brand-primary h-1.5 cursor-pointer"
                          value={formData.damageResponsibility}
                          onChange={(e) => setFormData({...formData, damageResponsibility: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fault Details Textarea */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500">شرح وتفاصيل العطل والملاحظات</label>
                    <textarea 
                      required
                      placeholder="مثال: الشاشة مكسورة وتحتاج استبدال، تم الاتفاق على فحص البوردة..."
                      className="w-full input-field h-12 sm:h-14 min-h-[46px] py-1.5 text-xs resize-none"
                      value={formData.issue}
                      onChange={(e) => setFormData({...formData, issue: e.target.value})}
                    />
                  </div>
                </div>

                {/* 3️⃣ قطع الغيار (إذا كان هاردوير) */}
                {formData.orderType === 'hardware' && (
                  <div className="bg-gray-50/70 dark:bg-navy-900/40 p-3 sm:p-3.5 rounded-2xl border border-gray-100 dark:border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <Database size={14} className="text-brand-primary" />
                        <h4 className="text-xs font-black text-gray-700 dark:text-gray-300">قطعة الغيار المطلوبة</h4>
                      </div>
                      
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5"
                          checked={formData.isPartMissing}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setFormData({
                              ...formData, 
                              isPartMissing: isChecked,
                              requiredPartId: isChecked ? '' : formData.requiredPartId,
                              requiredPartName: isChecked ? '' : formData.requiredPartName
                            });
                          }}
                        />
                        <span className="text-[10px] font-bold text-red-500">القطعة غير متوفرة (طلب عجز)</span>
                      </label>
                    </div>

                    {!formData.isPartMissing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500">اختر من المخزن المتوفر</label>
                          <select
                            className="w-full input-field h-9 text-xs font-bold"
                            value={formData.requiredPartId}
                            onChange={(e) => {
                              const partId = e.target.value;
                              const selectedPart = inventory.find(i => i.id === partId);
                              if (selectedPart) {
                                setFormData(prev => {
                                  const labor = Number(prev.laborCost) || 0;
                                  const partPrice = Number(selectedPart.price) || 0;
                                  return {
                                    ...prev,
                                    requiredPartId: partId,
                                    requiredPartName: selectedPart.name,
                                    cost: labor + partPrice
                                  };
                                });
                              } else {
                                setFormData(prev => ({ ...prev, requiredPartId: '', requiredPartName: '' }));
                              }
                            }}
                          >
                            <option value="">--- لا توجد قطعة غيار مستخدمة ---</option>
                            {inventory.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} (المخزون: {item.stock}) ({item.price.toLocaleString()} ر.ي)
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {formData.requiredPartId && (
                          <div className="p-2 bg-white dark:bg-navy-950 rounded-xl border border-gray-100 dark:border-white/5 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-gray-400 block text-[9px]">شراء:</span>
                              <span className="font-bold text-gray-700 dark:text-gray-300 text-[11px]">
                                {(inventory.find(i => i.id === formData.requiredPartId)?.cost || 0).toLocaleString()} ر.ي
                              </span>
                            </div>
                            <div className="text-left">
                              <span className="text-gray-400 block text-[9px]">مبيع للزبون:</span>
                              <span className="font-black text-brand-primary text-[11px]">
                                {(inventory.find(i => i.id === formData.requiredPartId)?.price || 0).toLocaleString()} ر.ي
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-red-500">اسم القطعة المطلوبة لطلبها عجزاً</label>
                        <input 
                          required
                          type="text" 
                          placeholder="مثال: شاشة ايفون 13 برو ماكس..."
                          className="w-full input-field h-9 text-xs border-red-200 focus:border-red-500 text-red-600 font-bold"
                          value={formData.requiredPartName}
                          onChange={(e) => setFormData({...formData, requiredPartName: e.target.value})}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 4️⃣ التسعير المالي، الربح الحي والتقاط الصورة */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                  {/* Financials Column */}
                  <div className="lg:col-span-2 bg-gray-50/70 dark:bg-navy-900/40 p-3 rounded-2xl border border-gray-100 dark:border-white/5 space-y-2">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-gray-100 dark:border-white/5">
                      <DollarSign size={14} className="text-brand-primary" />
                      <h4 className="text-xs font-black text-gray-700 dark:text-gray-300">التسعير والمبالغ المالية</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-gray-500">أجور يد الفني</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            placeholder="0"
                            className="w-full input-field h-9 text-xs font-black ps-8 text-navy-800"
                            value={formData.laborCost}
                            onChange={(e) => {
                              const labor = Number(e.target.value) || 0;
                              setFormData(prev => {
                                const part = prev.requiredPartId ? inventory.find(i => i.id === prev.requiredPartId) : null;
                                const partPrice = part ? part.price : 0;
                                return {
                                  ...prev,
                                  laborCost: e.target.value,
                                  cost: labor + partPrice
                                };
                              });
                            }}
                          />
                          <div className="absolute start-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">ر.ي</div>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-brand-primary">الإجمالي المتفق عليه</label>
                        <div className="relative">
                          <input 
                            required
                            type="number" 
                            placeholder="0"
                            className="w-full input-field h-9 text-sm font-black ps-8 text-brand-primary bg-brand-primary/5"
                            value={formData.cost}
                            onChange={(e) => setFormData({...formData, cost: Number(e.target.value)})}
                          />
                          <div className="absolute start-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-brand-primary">ر.ي</div>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-orange-600">المبلغ المدفوع (عربون)</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            placeholder="0"
                            className="w-full input-field h-9 text-xs font-black ps-8 text-orange-600 bg-orange-500/5 border-orange-200"
                            value={formData.advancePayment}
                            onChange={(e) => setFormData({...formData, advancePayment: Number(e.target.value)})}
                          />
                          <div className="absolute start-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-orange-600">ر.ي</div>
                        </div>
                      </div>
                    </div>

                    {/* Inline Image Upload & Appearance Note */}
                    <div className="pt-1.5 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative group w-9 h-9 bg-white dark:bg-navy-900 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200 dark:border-navy-700 flex-shrink-0">
                          {formData.devicePhoto ? (
                            <>
                              <img src={formData.devicePhoto} alt="Device" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <button 
                                type="button"
                                onClick={() => setFormData({...formData, devicePhoto: ''})}
                                className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : isUploadingPhoto ? (
                            <Loader2 className="animate-spin text-brand-primary" size={14} />
                          ) : (
                            <Camera size={14} className="text-gray-400" />
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={handlePhotoUpload}
                            disabled={isUploadingPhoto}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 truncate">
                          {formData.devicePhoto ? 'تم التقاط صورة مظهر الجهاز ✅' : 'التقط صورة لتوثيق الخدوش والضربات'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Compact Live Expected Profits Widget */}
                  <div className="bg-gradient-to-br from-navy-900 to-navy-950 text-white p-3 rounded-2xl border border-white/5 space-y-1.5 shadow-md flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-white/10">
                      <Percent size={13} className="text-amber-400" />
                      <h4 className="text-[11px] font-black text-amber-400">تحليل الأرباح المتوقعة فورياً</h4>
                    </div>

                    {(() => {
                      const part = formData.requiredPartId && !formData.isPartMissing ? inventory.find(i => i.id === formData.requiredPartId) : null;
                      const pCost = part ? (part.cost || 0) : 0;
                      const pPrice = part ? (part.price || 0) : 0;
                      
                      const sharingMode = (workshopSettings as any).sparePartProfitSharing || 'shop';
                      const effectivePartPrice = sharingMode === 'no_profit_parts' ? pCost : pPrice;
                      const pProfit = sharingMode === 'no_profit_parts' ? 0 : Math.max(0, pPrice - pCost);
                      
                      const totalCostVal = Number(formData.cost) || 0;
                      const serviceVal = Math.max(0, totalCostVal - effectivePartPrice);
                      const engPercent = formData.engineerPercentage || workshopSettings.lossEngineerPercentage || 50;
                      
                      const engServiceShare = serviceVal * (engPercent / 100);
                      const shopServiceShare = serviceVal * ((100 - engPercent) / 100);
                      
                      const isSplitSharing = sharingMode === 'split';
                      const engPartShare = isSplitSharing ? (pProfit * 0.5) : 0;
                      const shopPartShare = isSplitSharing ? (pProfit * 0.5) : pProfit;

                      const expectedShopProfit = shopServiceShare + shopPartShare;
                      const expectedEngineerProfit = engServiceShare + engPartShare;
                      const totalExpectedProfit = totalCostVal - pCost;

                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-gray-300">أرباح المحل الصافية:</span>
                            <span className="font-black text-emerald-400 text-xs">{expectedShopProfit.toLocaleString()} ر.ي</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-gray-300">مستحق الفني:</span>
                            <span className="font-black text-amber-400 text-xs">{expectedEngineerProfit.toLocaleString()} ر.ي</span>
                          </div>
                          <div className="flex justify-between items-center font-black text-[11px] text-white pt-1 border-t border-white/10">
                            <span className="text-gray-200">إجمالي الفائدة:</span>
                            <span className="text-xs text-white">{totalExpectedProfit.toLocaleString()} ر.ي</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Compact Submission Footer */}
                <div className="pt-2 bg-gray-50 dark:bg-navy-950 p-2.5 sm:p-3 rounded-2xl flex items-center justify-between gap-3 border border-gray-100 dark:border-white/5">
                  <div className="hidden sm:block text-right">
                    <p className="text-[11px] font-black text-navy-900 dark:text-white">جاهز للحفظ وإصدار السند</p>
                    <p className="text-[9px] text-gray-500">سيتم ترحيل البيانات ومزامنتها فورياً.</p>
                  </div>
                  <div className="flex w-full sm:w-auto gap-2">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-white dark:bg-navy-800 text-gray-500 rounded-xl font-bold hover:bg-gray-100 transition-all border border-gray-200 dark:border-navy-700 text-xs"
                    >
                      تراجع
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 sm:flex-initial px-8 py-2 bg-navy-900 dark:bg-brand-primary text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-md shadow-brand-primary/10"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                      حفظ وتسجيل الطلب
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSuccessModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSuccessModalOpen(false)}
              className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white dark:bg-navy-800 p-8 rounded-3xl text-center space-y-5 max-w-sm w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-success/10 text-success rounded-full mx-auto flex items-center justify-center">
                <CheckCircle2 size={40} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold">تم تسجيل الطلب بنجاح!</h3>
                <p className="text-sm text-gray-500">تم حفظ بيانات الجهاز والعميل في النظام.</p>
              </div>

              {/* WhatsApp Phone Prompt Box */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2 text-right">
                <label className="text-[10px] font-black text-slate-400 block mb-1">رقم واتساب العميل (لإرسال كرت الصيانة):</label>
                <input 
                  type="text" 
                  value={customPhone} 
                  onChange={(e) => setCustomPhone(e.target.value)} 
                  placeholder="مثال: 772315106" 
                  className="w-full text-center text-xs font-black p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:ring-2 focus:ring-success outline-none"
                />
              </div>

              {/* Action Buttons Grid */}
              <div className="space-y-2">
                <button 
                  onClick={() => {
                    if (lastOrderData) {
                      const phone = customPhone.trim() || lastOrderData.customerPhone || '';
                      const shopName = shopSettings?.shopName || 'Jam system pro';
                      
                      let text = `*${shopName} - كرت صيانة جديد* 🔧\n`;
                      text += `*رقم السند:* #${lastOrderData.id.slice(-6)}\n`;
                      text += `*العميل:* ${lastOrderData.customerName}\n`;
                      text += `*الجهاز:* ${lastOrderData.deviceModel}\n`;
                      text += `*العطل:* ${lastOrderData.problem}\n`;
                      text += `*التكلفة المقدرة:* ${(lastOrderData.cost || 0).toLocaleString()} ر.ي\n`;
                      text += `--------------------------\n`;
                      text += `تم استلام جهازكم بنجاح وجاري العمل عليه من قبل المهندسين المختصين.\n`;
                      text += `شكراً لثقتكم بنا! 🌹\n`;
                      text += `للتواصل: ${shopSettings?.shopPhone || ''}`;

                      const encodedText = encodeURIComponent(text);
                      const url = `https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, '')}&text=${encodedText}`;
                      window.open(url, '_blank');
                    }
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 border-none cursor-pointer animate-fade-in"
                >
                  <MessageCircle size={16} />
                  <span>إرسال كرت الصيانة عبر واتساب 💬</span>
                </button>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (lastOrderData) printReceipt('maintenance', lastOrderData, shopSettings);
                    }}
                    className="btn-primary flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-black border-none cursor-pointer"
                  >
                    <Printer size={16} />
                    سند الاستلام
                  </button>
                  <button 
                    onClick={() => {
                      if (lastOrderData) printReceipt('phone_sticker', lastOrderData, shopSettings);
                    }}
                    className="btn-secondary flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-black border-2 border-warning/20 text-warning cursor-pointer"
                  >
                    <Smartphone size={16} />
                    لاصق الجوال
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setIsSuccessModalOpen(false)}
                className="btn-secondary w-full py-2 border-none cursor-pointer"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <MessageModal 
        isOpen={messageModal.isOpen}
        onClose={() => setMessageModal(prev => ({ ...prev, isOpen: false }))}
        phone={messageModal.phone}
        initialMessage={messageModal.message}
        title={messageModal.title}
      />

      {/* 🛠️ Advanced Workshop Configuration Desk Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-navy-950/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              className="relative w-full max-w-2xl bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-slate-800 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(245,158,11,0.15)] text-right z-10 space-y-6 overflow-y-auto max-h-[90vh]"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20">
                    <Settings className="animate-spin" style={{ animationDuration: '6s' }} size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">إعدادات الورشة والسياسات المتقدمة</h3>
                    <p className="text-xs text-slate-400">تكوين الخيارات الافتراضية، التوالف، الغرامات وتأمين الورشة</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveWorkshopSettings} className="space-y-6">
                {/* 1. DEFAULT BINDINGS */}
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                    <Database size={16} />
                    الارتباطات الافتراضية لقسم الصيانة
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 block">الفني / المهندس الافتراضي للطلبات الجديدة:</label>
                      <select
                        value={workshopSettings.defaultEngineerId}
                        onChange={(e) => setWorkshopSettings({ ...workshopSettings, defaultEngineerId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                      >
                        <option value="">اختر الفني الافتراضي...</option>
                        {engineers.filter(e => e.role === 'engineer' || e.role === 'employee' || e.role === 'manager').map(eng => (
                          <option key={eng.uid} value={eng.uid}>{eng.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 block">مخزن قطع الغيار الافتراضي المستهدف:</label>
                      <select
                        value={workshopSettings.defaultStockLocation}
                        onChange={(e) => setWorkshopSettings({ ...workshopSettings, defaultStockLocation: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                      >
                        <option value="">اختر المخزن الافتراضي...</option>
                        {warehouses.map(wh => (
                          <option key={wh.id} value={wh.id}>{wh.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 col-span-full">
                      <label className="text-xs font-bold text-slate-300 block">طريقة توزيع ربح قطع الغيار بالصيانة:</label>
                      <select
                        value={(workshopSettings as any).sparePartProfitSharing || 'shop'}
                        onChange={(e) => setWorkshopSettings({ ...workshopSettings, sparePartProfitSharing: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                      >
                        <option value="shop">كامل أرباح القطعة للمحل (المهندس يستلم نسبته من شغل اليد فقط)</option>
                        <option value="split">تقسيم مناصفة (50% للمحل و 50% للمهندس من أرباح القطعة)</option>
                        <option value="no_profit_parts">القطع بسعر التكلفة (لا يوجد ربح على القطع، وكامل فائض القيمة هو أجور يد يتقاسمها المهندس والمحل)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 1.5. AUTOMATED READY NOTIFICATIONS */}
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                    <Bell size={16} />
                    أتمتة إشعارات جاهزية الأجهزة للزبائن
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    تكوين سلوك الإشعارات التلقائية عند إعلان المهندسين جاهزية الأجهزة لتوفير الوقت والجهد وتجنب مكالمات الاستفسار:
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">إرسال إشعار تلقائي عند الجاهزية:</span>
                        <span className="text-[10px] text-slate-500">تفعيل بث واقتراح الإشعارات فوراً للزبائن عند تحويل حالة الصيانة لـ "جاهز"</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!workshopSettings.enableReadyNotification}
                          onChange={(e) => setWorkshopSettings({ ...workshopSettings, enableReadyNotification: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    {workshopSettings.enableReadyNotification && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2 pt-2 border-t border-slate-800/60"
                      >
                        <label className="text-xs font-bold text-slate-300 block">قناة الإرسال التلقائي الافتراضية:</label>
                        <select
                          value={workshopSettings.readyNotificationChannel || 'app'}
                          onChange={(e) => setWorkshopSettings({ ...workshopSettings, readyNotificationChannel: e.target.value as any })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                        >
                          <option value="app">تطبيق زبائن VIP (تلقائي فوري إذا كان لديه حساب)</option>
                          <option value="whatsapp">واتساب WhatsApp (فتح محادثة لإرسال كرت جاهزية فوري)</option>
                        </select>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* 2. MULTI-ENGINEER RISK & LOSS SHARING MATRIX */}
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                      <Percent size={16} />
                      مصفوفة توزيع نسب خسائر وتوالف الأجهزة (إدارة المسؤولية)
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-lg font-bold ${
                      (Number(workshopSettings.lossShopPercentage) + Number(workshopSettings.lossEngineerPercentage) + Number(workshopSettings.lossCustomerPercentage) === 100)
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      المجموع: {Number(workshopSettings.lossShopPercentage) + Number(workshopSettings.lossEngineerPercentage) + Number(workshopSettings.lossCustomerPercentage)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    عند حدوث تلف غير متوقع للجهاز أثناء الصيانة، حدد نسب تحمل الخسارة لتوزيع تكلفتها تلقائياً بالدفتر المالي والقيود اليومية بين الأطراف:
                  </p>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">مسؤولية المحل / المعرض:</span>
                        <span className="text-amber-500 font-black">{workshopSettings.lossShopPercentage}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={workshopSettings.lossShopPercentage}
                        onChange={(e) => setWorkshopSettings({ ...workshopSettings, lossShopPercentage: Number(e.target.value) })}
                        className="w-full accent-amber-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">مسؤولية المهندس / الفني المنفذ:</span>
                        <span className="text-amber-500 font-black">{workshopSettings.lossEngineerPercentage}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={workshopSettings.lossEngineerPercentage}
                        onChange={(e) => setWorkshopSettings({ ...workshopSettings, lossEngineerPercentage: Number(e.target.value) })}
                        className="w-full accent-amber-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">مسؤولية الزبون / العميل صاحب الجهاز:</span>
                        <span className="text-amber-500 font-black">{workshopSettings.lossCustomerPercentage}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={workshopSettings.lossCustomerPercentage}
                        onChange={(e) => setWorkshopSettings({ ...workshopSettings, lossCustomerPercentage: Number(e.target.value) })}
                        className="w-full accent-amber-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. DELAY PENALTIES & CONFISCATION PROTOCOLS */}
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                    <Clock size={16} />
                    غرامات ومصادرات التأخير وحماية الورشة
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    تجنب تكدس الأجهزة المهملة بالورشة عبر فرض غرامات تخزين يومية تلقائياً أو تفعيل المصادرة والبيع القانوني:
                  </p>

                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">تفعيل فرض غرامات تأخر الاستلام:</span>
                        <span className="text-[10px] text-slate-500">حساب غرامة تخزين يومية تضاف تلقائياً للفاتورة النهائية</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={workshopSettings.enableDelayPenalties}
                          onChange={(e) => setWorkshopSettings({ ...workshopSettings, enableDelayPenalties: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    {workshopSettings.enableDelayPenalties && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2"
                      >
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400">الحد الأقصى لأيام التأخير المجانية:</label>
                          <input
                            type="number"
                            value={workshopSettings.delayLimitDays}
                            onChange={(e) => setWorkshopSettings({ ...workshopSettings, delayLimitDays: Number(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-black text-white focus:outline-none focus:border-amber-500"
                            placeholder="30"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400">الغرامة اليومية الإضافية (ر.ي):</label>
                          <input
                            type="number"
                            value={workshopSettings.dailyDelayFine}
                            onChange={(e) => setWorkshopSettings({ ...workshopSettings, dailyDelayFine: Number(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-black text-white focus:outline-none focus:border-amber-500"
                            placeholder="500"
                          />
                        </div>
                      </motion.div>
                    )}

                    <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">تفعيل بروتوكول المصادرة والبيع القانوني للتصفية:</span>
                        <span className="text-[10px] text-slate-500">إذا تجاوز العميل المدة المحددة، تُصنف حالة جهازه تلقائياً قيد المصادرة القانونية للبيع</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={workshopSettings.enableConfiscation}
                          onChange={(e) => setWorkshopSettings({ ...workshopSettings, enableConfiscation: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 4. DIAGNOSTIC FEE POLICY */}
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                    <DollarSign size={16} />
                    سياسة تسعير تكلفة فحص وتشخيص الأعطال
                  </h4>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">تفعيل رسوم فحص ثابتة مدفوعة مقدماً:</span>
                        <span className="text-[10px] text-slate-500">تطبيق قيمة فحص ثابتة كدفعة أولى مستحقة بمجرد استلام الجهاز للتشخيص</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={workshopSettings.enableDiagnosticFee}
                          onChange={(e) => setWorkshopSettings({ ...workshopSettings, enableDiagnosticFee: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    {workshopSettings.enableDiagnosticFee && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1.5 pt-2"
                      >
                        <label className="text-xs font-bold text-slate-400">قيمة / سعر فحص وتشخيص الأجهزة الثابت (ر.ي):</label>
                        <input
                          type="number"
                          value={workshopSettings.diagnosticFeePrice}
                          onChange={(e) => setWorkshopSettings({ ...workshopSettings, diagnosticFeePrice: Number(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-black text-white focus:outline-none focus:border-amber-500"
                          placeholder="2000"
                        />
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 flex gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-all"
                  >
                    إلغاء التعديلات
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                    حفظ وتعميم سياسات الورشة
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🤝 Engineer Individual Agreements Desk Modal */}
      <AnimatePresence>
        {isEngineerAgreementsOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEngineerAgreementsOpen(false)}
              className="absolute inset-0 bg-navy-950/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              className="relative w-full max-w-2xl bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-slate-800 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(99,102,241,0.15)] text-right z-10 space-y-6 overflow-y-auto max-h-[90vh]"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <button
                  type="button"
                  onClick={() => setIsEngineerAgreementsOpen(false)}
                  className="p-2 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">إعدادات وعقود المهندسين الفردية</h3>
                    <p className="text-xs text-slate-400">تخصيص شروط العقد، النسب، ومواعيد ترحيل الأرباح لكل مهندس على حدة</p>
                  </div>
                </div>
              </div>

              {/* Selection of Engineer */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">اختر المهندس لتعديل عقده الفردي:</label>
                <select
                  value={selectedEngForAgreement?.uid || ''}
                  onChange={(e) => {
                    const eng = engineers.find(u => u.uid === e.target.value);
                    if (eng) setSelectedEngForAgreement(eng);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="">اختر المهندس...</option>
                  {engineers.filter(u => u.role === 'engineer' || u.role === 'employee' || u.role === 'manager').map(eng => (
                    <option key={eng.uid} value={eng.uid}>{eng.name} ({eng.role === 'engineer' ? 'فني صيانة' : eng.role === 'manager' ? 'مدير' : 'موظف'})</option>
                  ))}
                </select>
              </div>

              {selectedEngForAgreement ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSaveAgreement(e); }} className="space-y-6">
                  {/* 1. Labor cost share percentage */}
                  <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                    <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                      <Percent size={16} />
                      نسبة عمل اليد الفردية للمهندس
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      نسبة المهندس الخاصة من صافي أجور اليد لعمليات الصيانة التي يقوم بها:
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">نسبة المهندس الفردية:</span>
                        <span className="text-indigo-400 font-black">{agreementPercentage}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={agreementPercentage}
                        onChange={(e) => setAgreementPercentage(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* 2. Spare part responsibility */}
                  <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                    <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                      <Package size={16} />
                      المسؤولية عن قطعة الغيار المستخدمة
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      تحديد من يقوم بتغطية ودفع تكلفة قطعة الغيار فور استخدامها في الصيانة:
                    </p>
                    <div className="space-y-2">
                      <select
                        value={partPaymentResp}
                        onChange={(e) => setPartPaymentResp(e.target.value as 'shop' | 'engineer')}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                      >
                        <option value="shop">المحل بالكامل (يتحمل المحل تكلفة الشراء، ويستلم المهندس نسبته صافية من أجور اليد)</option>
                        <option value="engineer">رصيد/مستحقات المهندس (تُخصم تكلفة قطعة الغيار فوراً من رصيد حساب المهندس)</option>
                      </select>
                    </div>
                  </div>

                  {/* 3. Profit Transfer timing */}
                  <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                    <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                      <Clock size={16} />
                      موعد ترحيل أرباح الصيانة للفني
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      تحديد وقت ترحيل مستحقات الصيانة لحساب المهندس المالي بالبرنامج:
                    </p>
                    <div className="space-y-2">
                      <select
                        value={profitTiming}
                        onChange={(e) => setProfitTiming(e.target.value as 'on_complete' | 'on_ready')}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                      >
                        <option value="on_ready">فور جاهزية الجهاز (بمجرد إعلان الفني جاهزية الجهاز وسرعة الفحص)</option>
                        <option value="on_complete">وقت استلام الزبون (عند استلام العميل للجهاز واكتمال دفع الفاتورة)</option>
                      </select>
                    </div>
                  </div>

                  {/* 4. Failure and damage liability */}
                  <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
                    <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      مسؤولية إرجاع العربون/الواصل المقدم عند فشل الإصلاح
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      تحديد الطرف المسؤول عن إرجاع مبلغ العربون/الواصل المقدم المدفوع من قبل الزبون في حال فشل الإصلاح وتعذر صيانة الهاتف:
                    </p>
                    <div className="space-y-2">
                      <select
                        value={failedLiability}
                        onChange={(e) => setFailedLiability(e.target.value as 'shop' | 'engineer' | 'split')}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                      >
                        <option value="shop">المحل بالكامل (يتم إرجاع العربون من حساب وصندوق المحل)</option>
                        <option value="engineer">المهندس بالكامل (يتحمل المهندس إرجاع العربون للزبون ويُخصم من رصيده ومستحقاته)</option>
                        <option value="split">مناصفة (50% على المحل و 50% على المهندس المسؤول عن الصيانة)</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 flex gap-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsEngineerAgreementsOpen(false)}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-all"
                    >
                      إلغاء التعديلات
                    </button>
                    <button
                      type="submit"
                      disabled={savingAgreement}
                      className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:brightness-110 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
                    >
                      {savingAgreement ? <Loader2 className="animate-spin" size={18} /> : null}
                      حفظ وتثبيت اتفاقية المهندس
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  يرجى التأكد من إضافة حسابات موظفين أو مهندسين أولاً لتحديد شروط عقودهم.
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
