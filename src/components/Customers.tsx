import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  User, 
  Phone, 
  DollarSign, 
  History, 
  AlertCircle,
  X,
  Edit2,
  Trash2,
  MessageCircle,
  Bell,
  Send,
  Printer,
  Crown,
  Lock,
  Unlock,
  ShieldAlert,
  Building2,
  Sparkles,
  ShieldCheck,
  CreditCard,
  WifiOff,
  RefreshCw,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, serverTimestamp, where, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Customer, UserProfile, VipClient } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { sendSMS, sendWhatsApp, templates, parseTemplate } from '../services/smsService';
import { printReceipt } from '../services/printService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';
import MessageModal from './MessageModal';
import VipActivationModal from './VipActivationModal';
import B2BInvitationModal from './B2BInvitationModal';
import { UniversalReportButton } from './UniversalReportButton';
import { UniversalReportPayload } from '../services/UniversalReportService';
import { b2bOnboardingService } from '../services/b2bOnboardingService';
import { smartCommerceService } from '../services/smartCommerceService';
import { safeDeleteCustomer } from '../services/safeDeletionService';
import { InstantCacheService } from '../services/instantCacheService';
import { employeeDebtGuardService } from '../services/employeeDebtGuardService';
import { StoreQueueEngine } from '../services/StoreQueueEngine';
import { unifiedOfflineStoreEngine } from '../services/UnifiedOfflineStoreEngine';

interface CustomersProps {
  profile: UserProfile | null;
}

export default function Customers({ profile }: CustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notificationChoice, setNotificationChoice] = useState<{
    customer: Customer | { name: string; phone: string };
    message: string;
  } | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [selectedSubWalletId, setSelectedSubWalletId] = useState<string>('AL_KURIMI');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const updateBoxBalance = async (boxId: string, amountChange: number) => {
    if (!profile?.ownerId || !boxId) return;
    try {
      const customRef = doc(db, 'stores', profile.ownerId, 'customBoxes', boxId);
      const customSnap = await getDoc(customRef);
      if (customSnap.exists()) {
        const currentBal = Number(customSnap.data().balance || 0);
        await updateDoc(customRef, {
          balance: currentBal + amountChange
        });
      }
    } catch (err) {
      console.error('Error updating vault balance from customers invoice:', err);
    }
  };

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const [isConfirmPaymentOpen, setIsConfirmPaymentOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isBulkNotifyOpen, setIsBulkNotifyOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [customerTab, setCustomerTab] = useState<'all' | 'active' | 'debtors' | 'blocked' | 'vip'>('all');
  const [vipClients, setVipClients] = useState<VipClient[]>([]);
  const [loadingVip, setLoadingVip] = useState(false);

  useEffect(() => {
    if (customerTab === 'vip' && profile?.ownerId) {
      setLoadingVip(true);
      const q = query(
        collection(db, 'clients'),
        where('storeId', '==', profile.ownerId)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            uid: data.uid || '',
            storeId: data.storeId || '',
            phone: data.phone || '',
            name: data.name || '',
            password: data.password || '',
            points: Number(data.points ?? 0),
            totalSpent: Number(data.totalSpent ?? 0),
            repairCount: Number(data.repairCount ?? 0),
            saleCount: Number(data.saleCount ?? 0),
            createdAt: data.createdAt
          } as VipClient;
        });
        setVipClients(list);
        setLoadingVip(false);
      }, (error) => {
        console.error('Error listening to vip clients:', error);
        setLoadingVip(false);
      });
      return () => unsubscribe();
    }
  }, [customerTab, profile?.ownerId]);

  const getCustomerTier = (c: any) => {
    if (c.tier) return c.tier;
    const nameL = c.name.toLowerCase();
    if (nameL.includes('مستورد') || nameL.includes('توكيلات') || nameL.includes('توكيل') || nameL.includes('وكيل') || nameL.includes('جملة') || nameL.includes('سوبر') || nameL.includes('شركة') || nameL.includes('مؤسسة') || nameL.includes('importer') || nameL.includes('import')) {
      return 'طبقة المستوردين العليا 👑';
    }
    return 'زبون عادي 👤';
  };

  const handleToggleBlockCustomer = async (c: any) => {
    try {
      if (c.status === 'blocked') {
        if (window.confirm(`هل تريد بالتأكيد فك حظر حساب الزبون ${c.name}؟`)) {
          await updateDoc(doc(db, 'customers', c.id), {
            status: 'active',
            banReason: '',
            updatedAt: serverTimestamp()
          });
          alert('تم فك الحظر بنجاح ✅');
        }
      } else {
        const reason = prompt('أدخل سبب حظر هذا الحساب:');
        if (reason) {
          await updateDoc(doc(db, 'customers', c.id), {
            status: 'blocked',
            banReason: reason,
            updatedAt: serverTimestamp()
          });
          alert('تم حظر الحساب بنجاح 🔒');
        }
      }
    } catch (e) {
      console.error(e);
      alert('خطأ أثناء تعديل حالة الحظر');
    }
  };

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

  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [isVipLicenseAlertOpen, setIsVipLicenseAlertOpen] = useState(false);
  const [vipAlertReason, setVipAlertReason] = useState<'offline' | 'unlicensed' | 'expired'>('unlicensed');
  const [isCheckingVipAccess, setIsCheckingVipAccess] = useState(false);

  const checkVipAccessAndExecute = async (action: () => void) => {
    // 1. Connection check
    if (!navigator.onLine) {
      setVipAlertReason('offline');
      setIsVipLicenseAlertOpen(true);
      return;
    }

    // 2. SuperAdmin bypass
    const isSuper = profile?.role === 'superadmin' || (profile as any)?.isSuperAdmin === true;
    if (isSuper) {
      action();
      return;
    }

    setIsCheckingVipAccess(true);
    try {
      let liveProfile = profile as any;
      let liveSettings = shopSettings;
      
      if (profile?.ownerId) {
        try {
          const snap = await getDoc(doc(db, 'users', profile.ownerId));
          if (snap.exists()) {
            liveProfile = { ...liveProfile, ...snap.data() };
          }
          const setSnap = await getDoc(doc(db, 'settings', profile.ownerId));
          if (setSnap.exists()) {
            liveSettings = { ...liveSettings, ...setSnap.data() };
          }
        } catch (e) {
          console.warn('Live license check network notice:', e);
        }
      }

      // Check Expiry
      const expiry = liveProfile?.customerAppLicenseExpiry || liveProfile?.vipExpiry || liveSettings?.customerAppLicenseExpiry || liveSettings?.vipExpiry;
      if (expiry) {
        const expDate = expiry?.toDate ? expiry.toDate() : new Date(expiry);
        if (expDate < new Date()) {
          setVipAlertReason('expired');
          setIsVipLicenseAlertOpen(true);
          setIsCheckingVipAccess(false);
          return;
        }
      }

      // Check License status
      const isLicenseActive = 
        liveProfile?.customer_app_license === 'active' || 
        liveProfile?.customerAppLicenseActive === true || 
        liveProfile?.vipSubscriptionActive === true || 
        liveSettings?.customer_app_license === 'active' ||
        liveSettings?.vipSubscriptionActive === true;

      if (!isLicenseActive) {
        setVipAlertReason('unlicensed');
        setIsVipLicenseAlertOpen(true);
        setIsCheckingVipAccess(false);
        return;
      }

      action();
    } catch (err) {
      console.error('Error during VIP access check:', err);
      const isFallbackActive = profile?.customer_app_license === 'active' || (profile as any)?.vipSubscriptionActive === true;
      if (isFallbackActive) {
        action();
      } else {
        setVipAlertReason('unlicensed');
        setIsVipLicenseAlertOpen(true);
      }
    } finally {
      setIsCheckingVipAccess(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    shopName: '',
    phone: '',
    address: '',
    code: '',
    businessTier: 'retail' as 'retail' | 'wholesale' | 'mega_wholesale' | 'importer' | 'individual',
    allowCredit: false,
    creditLimit: 0,
    debt: 0
  });
  const [b2bInviteCustomer, setB2bInviteCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (!profile?.ownerId) return;

    // ⚡ Instant Cache Hydration (0ms load time)
    const cacheKey = `customers_${profile.ownerId}`;
    const cached = InstantCacheService.get<Customer[]>(cacheKey);
    if (cached && cached.length > 0) {
      setCustomers(cached);
    }

    const q = query(
      collection(db, 'customers'), 
      where('ownerId', '==', profile.ownerId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Customer))
        .filter(c => (c as any).status !== 'deleted' && (c as any).isDeleted !== true)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
      InstantCacheService.set(cacheKey, list);
      setCustomers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });
    return () => unsubscribe();
  }, [profile?.ownerId]);

  useEffect(() => {
    const fetchShopSettings = async () => {
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
    fetchShopSettings();
  }, [profile]);

  const openMessageModal = (customer: { name: string; phone: string; debt?: number }, type: 'debt' | 'debt_payment' | 'custom', customMessage?: string) => {
    const data = {
      name: customer.name,
      amount: customer.debt || 0,
      store: shopSettings?.shopName || 'المحل'
    };

    let message = customMessage || '';
    let title = 'إرسال رسالة';

    if (!customMessage) {
      if (type === 'debt') {
        const template = shopSettings?.messageTemplates?.debt || 'عزيزي {name}، نود تذكيركم بأن لديكم مديونية متبقية قدرها {amount} في {store}. نرجو التكرم بالسداد في أقرب وقت.';
        message = parseTemplate(template, data);
        title = 'تذكير بالمديونية';
      } else if (type === 'debt_payment') {
        const template = shopSettings?.messageTemplates?.debt_payment || 'تم استلام مبلغ {amount} من العميل {name}. شكراً لتعاملكم مع {store}.';
        message = parseTemplate(template, data);
        title = 'إشعار استلام مبلغ';
      }
    }

    setMessageModal({
      isOpen: true,
      phone: customer.phone,
      message,
      title
    });
  };

  const handleCreateCustomerSubmit = async (formDataVal: { name: string; phone: string }) => {
    try {
      const shopOwnerId = profile?.ownerId || profile?.uid; 
      if (!shopOwnerId) return;

      // 1. توليد الباسورد المستقر من 6 خانات
      const randomPassword = Math.floor(100000 + Math.random() * 900000).toString();

      // 2. ترحيل وتوثيق الحساب سحابياً عبر الخدمة الموحدة (smartCommerceService)
      await smartCommerceService.getOrCreateLead(formDataVal.phone, shopOwnerId, formDataVal.name, randomPassword);

      // 3. صياغة كارت الترحيب ومشاركته آلياً عبر رابط المتجر الموحد للزبائن
      const shopName = profile?.shopName || 'متجر JAM Pro';
      const portalLink = `${window.location.origin}/#/portal?shop=${encodeURIComponent(shopOwnerId)}`;
      
      const whatsappMessage = `مرحباً بك يا ${formDataVal.name} في ${shopName}.\nتم تفعيل حسابك المباشر في بوابة الزبائن VIP لمتابعة فواتيرك وصيانة أجهزتك ونقاطك أولاً بأول:\n\nرقم الهاتف: ${formDataVal.phone}\nكلمة المرور الآمنة: ${randomPassword}\n\nرابط البوابة المباشر:\n${portalLink}`;
      
      const encodedMessage = encodeURIComponent(whatsappMessage);
      window.open(`https://wa.me/${formDataVal.phone}?text=${encodedMessage}`, '_blank');
      
    } catch (err) {
      console.error('Error in local creation logic:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const isB2B = formData.businessTier !== 'individual';
      let autoTier = 'زبون عادي 👤';
      if (formData.businessTier === 'retail') autoTier = 'تجزئة 🏪';
      else if (formData.businessTier === 'wholesale') autoTier = 'جملة 📦';
      else if (formData.businessTier === 'mega_wholesale') autoTier = 'جملة الجملة 🏛️';
      else if (formData.businessTier === 'importer') autoTier = 'مستورد 🚢';

      if (editingCustomer) {
        const updatedCustomerData = {
          id: editingCustomer.id,
          name: formData.name.trim(),
          shopName: formData.shopName.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          code: formData.code.trim(),
          businessTier: formData.businessTier,
          allowCredit: formData.allowCredit,
          creditLimit: formData.allowCredit ? Number(formData.creditLimit) || 0 : 0,
          isB2BClient: isB2B,
          debt: Number(formData.debt) || 0,
          ownerId: profile?.ownerId,
          tier: autoTier,
          updatedAt: new Date().toISOString()
        };
        await unifiedOfflineStoreEngine.saveCustomerLocal(updatedCustomerData as Customer, true);

        if (navigator.onLine) {
          await updateDoc(doc(db, 'customers', editingCustomer.id), {
            name: formData.name.trim(),
            shopName: formData.shopName.trim(),
            phone: formData.phone.trim(),
            address: formData.address.trim(),
            code: formData.code.trim(),
            businessTier: formData.businessTier,
            allowCredit: formData.allowCredit,
            creditLimit: formData.allowCredit ? Number(formData.creditLimit) || 0 : 0,
            isB2BClient: isB2B,
            debt: Number(formData.debt) || 0,
            tier: autoTier,
            updatedAt: serverTimestamp()
          }).catch(e => console.warn('Deferred online customer update:', e));
        }
        setStatus({ type: 'success', message: 'تم تحديث بيانات العميل بنجاح (محلياً وسحابياً)' });
      } else {
        const customerData: Partial<Customer> = {
          name: formData.name.trim(),
          shopName: formData.shopName.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          code: formData.code.trim(),
          businessTier: formData.businessTier,
          allowCredit: formData.allowCredit,
          creditLimit: formData.allowCredit ? Number(formData.creditLimit) || 0 : 0,
          isB2BClient: isB2B,
          debt: Number(formData.debt) || 0,
          ownerId: profile?.ownerId,
          linkedUid: null,
          tier: autoTier,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Save immediately in local database
        await unifiedOfflineStoreEngine.saveCustomerLocal(customerData as Customer, true);

        if (navigator.onLine) {
          handleCreateCustomerSubmit({ name: formData.name, phone: formData.phone }).catch(() => {});
          addDoc(collection(db, 'customers'), {
            ...customerData,
            createdAt: serverTimestamp()
          }).catch(e => console.warn('Deferred online customer create:', e));
        }
        setStatus({ type: 'success', message: 'تمت إضافة العميل الجديد وتثبيت السند بنجاح' });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving customer:', error);
      setStatus({ type: 'error', message: 'حدث خطأ أثناء حفظ بيانات العميل' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForPayment || paymentAmount <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const targetBoxId = paymentMethod === 'cash' ? 'CASH_BOX' : selectedSubWalletId;
      const newDebt = Math.max(0, selectedCustomerForPayment.debt - paymentAmount);

      // ⚡ Enqueue to StoreQueueEngine for 0ms Deduplication & Math Audit
      StoreQueueEngine.enqueueTask(
        profile?.ownerId || 'master',
        'debt_repayment',
        'transactions',
        {
          customerId: selectedCustomerForPayment.id,
          customerName: selectedCustomerForPayment.name,
          amount: paymentAmount,
          newDebt,
          paymentMethod,
          boxId: targetBoxId
        },
        profile
      ).catch(err => console.warn('Debt repayment StoreQueueEngine enqueue notice:', err));

      await updateDoc(doc(db, 'customers', selectedCustomerForPayment.id), {
        debt: newDebt,
        updatedAt: serverTimestamp()
      });

      // Adjust wallet balance in database
      await updateBoxBalance(targetBoxId, paymentAmount);

      await addDoc(collection(db, 'transactions'), {
        ownerId: profile?.ownerId,
        type: 'income',
        amount: paymentAmount,
        category: 'debt_repayment',
        description: `تسديد قسط/دفعة من الدين: العميل ${selectedCustomerForPayment.name}. طريقة الدفع: ${paymentMethod === 'cash' ? 'نقداً عبر الصندوق الرئيسي' : 'إيداع بنكي/قيد مالي'}`,
        boxId: targetBoxId,
        createdAt: serverTimestamp()
      });

      // Settle and free up employee credit ceiling if customer was indebted on an employee's guarantee
      employeeDebtGuardService.settleCustomerDebtsByPayment({
        customerName: selectedCustomerForPayment.name,
        customerPhone: selectedCustomerForPayment.phone,
        paidAmount: paymentAmount,
        receivedByUsername: profile?.username || 'cashier',
        receivedByName: profile?.fullName || 'صراف الصندوق الرئيسي',
        receivedByRole: profile?.role || 'cashier',
        receiptVoucherId: `REC-${Date.now().toString().slice(-5)}`
      });

      // Send SMS Notification
      try {
        const data = {
          name: selectedCustomerForPayment.name,
          amount: paymentAmount,
          store: shopSettings?.shopName || 'المحل'
        };
        const template = shopSettings?.messageTemplates?.debt_payment || templates.debtRepayment(paymentAmount, newDebt);
        const message = parseTemplate(template, data);
        setNotificationChoice({ 
          customer: selectedCustomerForPayment, 
          message 
        });
      } catch (smsError) {
        console.error('Failed to prepare notification:', smsError);
      }

      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setSelectedCustomerForPayment(null);
    } catch (error) {
      console.error('Error processing payment:', error);
    } finally {
      setIsSubmitting(false);
      setIsConfirmPaymentOpen(false);
    }
  };

  const handleBulkNotify = async () => {
    const debtors = customers.filter(c => c.debt > 0);
    if (debtors.length === 0) return;

    if (!window.confirm(`هل أنت متأكد من رغبتك في إرسال رسائل تذكير لعدد (${debtors.length}) من العملاء؟`)) return;

    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    for (const customer of debtors) {
      try {
        const data = {
          name: customer.name,
          amount: customer.debt,
          store: shopSettings?.shopName || 'المحل'
        };
        const template = shopSettings?.messageTemplates?.debt || 'عزيزي {name}، تذكير بمديونيتكم: {amount} ريال.';
        const message = parseTemplate(template, data);
        
        await sendSMS(customer.phone, message);
        successCount++;
      } catch (err) {
        console.error(`Failed to notify ${customer.name}:`, err);
        failCount++;
      }
    }

    setStatus({ 
      type: successCount > 0 ? 'success' : 'error', 
      message: `تم الإرسال لـ ${successCount} عملاء. ${failCount > 0 ? `فشل الإرسال لـ ${failCount} عملاء.` : ''}` 
    });
    setIsSubmitting(false);
    setIsBulkNotifyOpen(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData({
      name: '',
      shopName: '',
      phone: '',
      address: '',
      code: '',
      businessTier: 'retail',
      allowCredit: false,
      creditLimit: 0,
      debt: 0
    });
  };

  const editCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      shopName: customer.shopName || '',
      phone: customer.phone || '',
      address: customer.address || '',
      code: customer.code || '',
      businessTier: customer.businessTier || 'retail',
      allowCredit: customer.allowCredit || (customer.creditLimit ? customer.creditLimit > 0 : false),
      creditLimit: customer.creditLimit || 0,
      debt: customer.debt || 0
    });
    setIsModalOpen(true);
  };

  const filteredCustomers = customers.filter(c => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      (c.name || '').toLowerCase().includes(q) || 
      (c.phone || '').includes(q) ||
      (c.shopName || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (customerTab === 'active') {
      return (c.status !== 'blocked' && c.debt === 0);
    }
    if (customerTab === 'debtors') {
      return (c.debt > 0);
    }
    if (customerTab === 'blocked') {
      return (c.status === 'blocked');
    }
    return true; // 'all'
  });

  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);

  const openHistory = (customer: Customer) => {
    setSelectedCustomerForHistory(customer);
    setIsHistoryModalOpen(true);
    
    // Fetch sales for this customer
    const q = query(
      collection(db, 'sales'), 
      where('ownerId', '==', profile?.ownerId),
      where('customerId', '==', customer.id),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomerSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Error fetching customer history:', error);
    });

    return unsubscribe;
  };

  return (
    <div className={`customers-ui-frozen space-y-6 p-4 rounded-3xl min-h-screen transition-colors ${profile?.visualTheme === 'light' ? 'light-customers' : ''}`}>
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
                <h3 className="text-2xl font-black text-navy-900 dark:text-white">إرسال تنبيه للعميل</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  اختر طريقة إرسال التنبيه للعميل ({notificationChoice.customer.name}) بخصوص الدين.
                </p>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button
                    onClick={async () => {
                      try {
                        await sendSMS(notificationChoice.customer.phone, notificationChoice.message);
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
                      openMessageModal(notificationChoice.customer, 'custom', notificationChoice.message);
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
            {status.type === 'success' ? <Bell size={20} /> : <AlertCircle size={20} />}
            {status.message}
            <button onClick={() => setStatus(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Status Tabs for unified Customers Management */}
      <div className="flex bg-gray-100 dark:bg-navy-900/50 p-1.5 rounded-2xl max-w-2xl mx-auto mb-6 border border-gray-200/50 dark:border-white/5 flex-wrap gap-1">
        <button
          onClick={() => setCustomerTab('all')}
          className={`flex-1 min-w-[100px] py-3 text-xs font-black rounded-xl transition-all border-none outline-none cursor-pointer ${
            customerTab === 'all' 
              ? 'bg-navy-700 text-white dark:bg-brand-primary dark:text-navy-950 shadow-md' 
              : 'bg-transparent text-gray-500 hover:text-navy-950 dark:hover:text-white'
          }`}
        >
          كل العملاء الموحدين 👥
        </button>
        <button
          onClick={() => setCustomerTab('active')}
          className={`flex-1 min-w-[100px] py-3 text-xs font-black rounded-xl transition-all border-none outline-none cursor-pointer ${
            customerTab === 'active' 
              ? 'bg-navy-700 text-white dark:bg-brand-primary dark:text-navy-950 shadow-md' 
              : 'bg-transparent text-gray-500 hover:text-navy-950 dark:hover:text-white'
          }`}
        >
          العملاء النشطين 🟢
        </button>
        <button
          onClick={() => setCustomerTab('debtors')}
          className={`flex-1 min-w-[100px] py-3 text-xs font-black rounded-xl transition-all border-none outline-none cursor-pointer ${
            customerTab === 'debtors' 
              ? 'bg-navy-700 text-white dark:bg-brand-primary dark:text-navy-950 shadow-md' 
              : 'bg-transparent text-gray-500 hover:text-navy-950 dark:hover:text-white'
          }`}
        >
          سجل المدنيين والديون ⌛
        </button>
        <button
          onClick={() => setCustomerTab('blocked')}
          className={`flex-1 min-w-[100px] py-3 text-xs font-black rounded-xl transition-all border-none outline-none cursor-pointer ${
            customerTab === 'blocked' 
              ? 'bg-navy-700 text-white dark:bg-brand-primary dark:text-navy-950 shadow-md' 
              : 'bg-transparent text-gray-500 hover:text-navy-950 dark:hover:text-white'
          }`}
        >
          ملاك الحسابات المحظورة 🔒
        </button>
        {/* VIP Portal Tab - Guarded by subscription & online connection */}
        <button
          onClick={() => checkVipAccessAndExecute(() => setCustomerTab('vip'))}
          disabled={isCheckingVipAccess}
          className={`flex-1 min-w-[100px] py-3 text-xs font-black rounded-xl transition-all border-none outline-none cursor-pointer flex items-center justify-center gap-1.5 ${
            customerTab === 'vip' 
              ? 'bg-[#d4af37] text-slate-950 shadow-md font-bold' 
              : 'bg-transparent text-amber-500 hover:text-amber-400 font-bold'
          }`}
        >
          {isCheckingVipAccess ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 size={14} className="animate-spin text-amber-500" />
              التحقق...
            </span>
          ) : (
            <>
              <span>بوابة زبائن VIP 👑</span>
              {vipClients.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-900/30 text-slate-900 font-black">
                  {vipClients.length}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="بحث بالاسم أو رقم الهاتف..." 
            className="w-full pr-12 pl-4 py-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <UniversalReportButton
            variant="emerald"
            buttonText="تقرير حسابات العملاء"
            payload={{
              title: 'تقرير كشف حسابات وأرصدة العملاء والمديونيات',
              subtitle: customerTab === 'debtors' ? 'كشف العملاء المدينين وأرصدة الديون المعلقة' : customerTab === 'blocked' ? 'كشف الحسابات المحظورة' : 'سجل بيانات العملاء الشامل والأرصدة الائتمانية',
              currency: 'ر.ي',
              summaryCards: [
                { label: 'إجمالي عدد العملاء', value: customers.length, currency: 'عميل', color: 'blue' },
                { label: 'العملاء المدينين', value: customers.filter(c => (c.debt || 0) > 0).length, currency: 'عميل', color: 'amber' },
                { label: 'إجمالي مديونيات العملاء (عليهم)', value: customers.reduce((sum, c) => sum + (Number(c.debt) || 0), 0).toLocaleString(), currency: 'ر.ي', color: 'red' },
                { label: 'سقف الائتمان الممنوح', value: customers.reduce((sum, c) => sum + (Number(c.creditLimit) || 0), 0).toLocaleString(), currency: 'ر.ي', color: 'purple' }
              ],
              columns: [
                { key: 'name', header: 'اسم العميل', type: 'text', width: 22 },
                { key: 'phone', header: 'رقم الهاتف', type: 'text', width: 14 },
                { key: 'shopName', header: 'المحل / النشاط', type: 'text', width: 18, formatter: (val) => val || '-' },
                { key: 'businessTier', header: 'الفئة', type: 'text', width: 12, formatter: (val) => val === 'wholesale' ? 'جملة' : 'تجزئة' },
                { key: 'debt', header: 'المديونية الحالية (علية)', type: 'currency', width: 15 },
                { key: 'creditLimit', header: 'سقف الائتمان', type: 'currency', width: 14 },
                { key: 'status', header: 'الحالة', type: 'text', width: 12, formatter: (val) => val === 'blocked' ? 'محظور' : 'نشط' }
              ],
              data: filteredCustomers
            }}
          />
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-navy-700 text-white rounded-xl font-bold bounce-hover shadow-lg cursor-pointer border-none"
          >
            <Plus size={20} />
            إضافة عميل جديد
          </button>
        </div>

        <button 
          type="button"
          onClick={() => checkVipAccessAndExecute(() => setIsVipModalOpen(true))}
          disabled={isCheckingVipAccess}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-slate-950 rounded-xl font-black bounce-hover shadow-lg shadow-amber-500/20 border border-amber-400 cursor-pointer disabled:opacity-75"
        >
          {isCheckingVipAccess ? (
            <>
              <Loader2 size={20} className="animate-spin text-slate-950" />
              <span>جاري التحقق من الترخيص...</span>
            </>
          ) : (
            <>
              <Crown size={20} className="text-slate-950 animate-bounce" />
              <span>إنشاء حسابات الزبائن [VIP]</span>
            </>
          )}
        </button>
        
        {customers.some(c => c.debt > 0) && (
          <button 
            onClick={() => setIsBulkNotifyOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold bounce-hover shadow-lg"
          >
            <Bell size={20} />
            مراسلة كافة المدينين
          </button>
        )}
      </div>

      {customerTab === 'vip' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loadingVip ? (
            <div className="col-span-full text-center py-12 text-[#d4af37]">
              <Loader2 className="animate-spin inline-block mr-2" size={24} />
              <span className="font-bold">جاري جلب زبائن تطبيق VIP...</span>
            </div>
          ) : (
            vipClients.map((client) => (
              <motion.div
                layout
                key={client.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card-glass p-6 space-y-4 relative overflow-hidden border-2 border-indigo-500/10"
              >
                <div className="absolute top-0 right-0 w-2 h-full bg-[#d4af37]" />
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400">
                      <Crown size={22} className="text-[#d4af37] animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{client.name || 'زبون VIP معتمد'}</h3>
                      <p className="text-sm text-gray-400 flex items-center gap-1 font-mono">
                        <Phone size={12} />
                        {client.phone}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[8.5px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 rounded-full font-black">
                     حساب موثق VIP ✨
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-navy-950/40 rounded-2xl border border-navy-700/20 text-xs">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">رصيد نقاط الولاء</p>
                    <p className="text-lg font-black text-success mt-0.5">
                      {client.points ?? 0} نقطة
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">إجمالي المشتريات والصرف</p>
                    <p className="text-lg font-black text-white mt-0.5">
                      {(client.totalSpent ?? 0).toLocaleString()} ر.ي
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">عمليات الإصلاح والصيانة</p>
                    <p className="text-sm font-bold text-gray-400 mt-0.5">
                      {client.repairCount ?? 0} أجهزة
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">البريد المعتمد</p>
                    <p className="text-[10.5px] font-semibold text-indigo-400 mt-0.5 font-mono select-all font-bold">
                      {client.phone}@jam-system.pro
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-navy-950/20 px-3 py-2 rounded-xl text-[10px] text-gray-500 font-bold">
                  <span>التفعيل آلي عبر Firebase Auth</span>
                  <span className="font-bold text-[#d4af37] bg-[#d4af37]/10 px-2 py-1 rounded-md">رمز الدخول: {client.password || '---'}</span>
                </div>
              </motion.div>
            ))
          )}
          {!loadingVip && vipClients.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400 bg-navy-900/10 border border-navy-700/10 rounded-2xl italic font-bold">
              لا يوجد زبائن VIP مسجلين أو مفعلين لهذا المتجر حالياً. اضغط على زر "إنشاء حسابات الزبائن [VIP]" لتوليد حساب جديد.
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {paginatedCustomers.map((customer) => (
            <motion.div
              layout
              key={customer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-glass p-6 space-y-4 relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 w-2 h-full ${customer.status === 'blocked' ? 'bg-red-600' : (customer.debt > 0 ? 'bg-danger' : 'bg-success')}`} />
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-navy-700/5 rounded-full flex items-center justify-center text-navy-700 dark:text-brand-primary">
                    {customer.status === 'blocked' ? <Lock size={22} className="text-red-500 animate-pulse" /> : <User size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg">{customer.name}</h3>
                      {customer.shopName && (
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                          ({customer.shopName})
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-[9px] bg-brand-primary/10 text-brand-primary rounded-full font-black">
                        {customer.businessTier === 'retail' ? 'تجزئة 🏪' :
                         customer.businessTier === 'wholesale' ? 'جملة 📦' :
                         customer.businessTier === 'mega_wholesale' ? 'جملة الجملة 🏛️' :
                         customer.businessTier === 'importer' ? 'مستورد 🚢' :
                         getCustomerTier(customer)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                      <p className="flex items-center gap-1 font-mono">
                        <Phone size={12} />
                        {customer.phone}
                      </p>
                      {customer.code && (
                        <span className="font-mono text-[11px] text-amber-500 font-bold">
                          🏷️ {customer.code}
                        </span>
                      )}
                      {customer.address && (
                        <span className="text-[11px] text-gray-400">
                          📍 {customer.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {b2bOnboardingService.isEligibleForB2BInvite(profile, customer).isEligible && (
                    <button
                      onClick={() => setB2bInviteCustomer(customer)}
                      className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg transition-colors border border-amber-500/20"
                      title="دعوة انضمام ذكية B2B للكتالوج والطلب المباشر"
                    >
                      <Sparkles size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleToggleBlockCustomer(customer)} 
                    className={`p-2 rounded-lg transition-colors ${customer.status === 'blocked' ? 'bg-success/10 text-success' : 'hover:bg-red-500/10 text-red-500'}`}
                    title={customer.status === 'blocked' ? 'إلغاء حظر الحساب' : 'حظر الحساب'}
                  >
                    {customer.status === 'blocked' ? <Unlock size={16} /> : <Lock size={16} />}
                  </button>
                  <button onClick={() => editCustomer(customer)} className="p-2 hover:bg-navy-700/10 rounded-lg transition-colors text-gray-400 hover:text-navy-700">
                    <Edit2 size={16} />
                  </button>
                  {profile?.role === 'manager' && (
                    <button 
                      onClick={() => {
                        setCustomerToDelete(customer);
                        setIsConfirmDeleteOpen(true);
                      }}
                      className="p-2 hover:bg-danger/10 rounded-lg transition-colors text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {customer.status === 'blocked' && (
                <div className="p-3 bg-red-500/10 text-red-500 text-xs font-black rounded-xl border border-red-500/15 flex items-start gap-2">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p>🚫 الحساب محظور حالياً بموجب قرار الحماية</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-bold">السبب: {customer.banReason || 'تحذير أمني تجاري'}</p>
                  </div>
                </div>
              )}

              <div className={`p-4 rounded-2xl flex items-center justify-between ${
                customer.debt > 0 ? 'bg-danger/5 border border-danger/10' : 'bg-success/5 border border-success/10'
              }`}>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">إجمالي الديون</p>
                  <p className={`text-2xl font-black ${customer.debt > 0 ? 'text-danger' : 'text-success'}`}>
                    {customer.debt.toFixed(0)} ر.ي
                  </p>
                  {customer.creditLimit ? (
                    <p className="text-[10px] text-emerald-500 font-bold mt-0.5">
                      سقف الائتمان: {customer.creditLimit.toLocaleString()} ر.ي
                    </p>
                  ) : null}
                </div>
                {customer.debt > 0 && (
                  <AlertCircle className="text-danger" size={24} />
                )}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => printReceipt('customer_debt', customer, shopSettings)}
                  className="p-2 bg-navy-700/10 text-navy-700 dark:text-brand-primary rounded-lg hover:bg-navy-700/20 transition-colors"
                  title="طباعة"
                >
                  <Printer size={16} />
                </button>
                <button 
                  onClick={() => {
                    openMessageModal(customer, 'debt');
                  }}
                  className="p-2 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors"
                  title="واتساب"
                >
                  <MessageCircle size={16} />
                </button>
                <button 
                  onClick={async () => {
                    const message = `عزيزي العميل ${customer.name} لديكم اشعار من ${profile?.shopName || 'Jam system pro'} بخصوص حسابكم، إجمالي الديون الحالية: ${customer.debt.toFixed(0)} ر.ي`;
                    try {
                      await sendSMS(customer.phone, message);
                      setStatus({ type: 'success', message: 'تم إرسال الرسالة بنجاح' });
                    } catch (err: any) {
                      console.error('Manual SMS failed:', err);
                      setStatus({ type: 'error', message: err.message || 'فشل إرسال الرسالة. يرجى التحقق من الإعدادات.' });
                    }
                  }}
                  className="p-2 bg-navy-700/10 text-navy-700 dark:text-brand-primary rounded-lg hover:bg-navy-700/20 transition-colors"
                  title="SMS"
                >
                  <Send size={16} />
                </button>
                <button 
                  onClick={() => openHistory(customer)}
                  className="flex-1 py-2 bg-navy-700 text-white text-xs font-bold rounded-lg hover:bg-navy-800 transition-colors flex items-center justify-center gap-2"
                >
                  <History size={14} />
                  سجل المشتريات
                </button>
                <button 
                  onClick={() => {
                    setSelectedCustomerForPayment(customer);
                    setIsPaymentModalOpen(true);
                  }}
                  className="flex-1 py-2 bg-brand-primary/10 text-brand-primary text-xs font-bold rounded-lg hover:bg-brand-primary/20 transition-colors flex items-center justify-center gap-2"
                >
                  <DollarSign size={14} />
                  تسديد دفعة
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {customerTab !== 'vip' && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-6" dir="rtl">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-5 py-2.5 rounded-xl bg-navy-700 hover:bg-navy-800 dark:bg-navy-800 dark:hover:bg-navy-700 text-white disabled:opacity-50 transition-all font-bold text-sm flex items-center gap-1 shadow-md"
          >
            السابق
          </button>
          <span className="font-bold text-sm text-gray-600 dark:text-gray-300">
            صفحة {currentPage} من {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-5 py-2.5 rounded-xl bg-navy-700 hover:bg-navy-800 dark:bg-navy-800 dark:hover:bg-navy-700 text-white disabled:opacity-50 transition-all font-bold text-sm flex items-center gap-1 shadow-md"
          >
            التالي
          </button>
        </div>
      )}

      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPaymentModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">تسديد مبلغ من الدين</h3>
                <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handlePayment} className="p-8 space-y-6">
                <div className="p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-700">
                  <p className="text-xs text-gray-400 mb-1">العميل:</p>
                  <p className="font-bold">{selectedCustomerForPayment?.name}</p>
                  <p className="text-xs text-danger mt-1">الدين الحالي: {selectedCustomerForPayment?.debt.toFixed(0)} ر.ي</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="label-field block text-right font-bold text-xs text-amber-500">طريقة القبض والإيداع المالي</label>
                    <div className="grid grid-cols-2 gap-2 mt-1" dir="rtl">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`py-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${paymentMethod === 'cash' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-transparent text-gray-400 border-white/10 hover:text-white'}`}
                      >
                        💵 كاش بالصندوق
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bank')}
                        className={`py-3 rounded-xl border font-bold text-xs transition-all cursor-pointer ${paymentMethod === 'bank' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-transparent text-gray-400 border-white/10 hover:text-white'}`}
                      >
                        🏦 تحويل/إيداع بنكي
                      </button>
                    </div>
                  </div>

                  {paymentMethod === 'bank' && (
                    <div className="space-y-1" dir="rtl">
                      <label className="label-field block text-right font-bold text-xs text-amber-500">اختر البنك أو المصرف للإيداع</label>
                      <select
                        className="input-field bg-navy-900 border border-white/10 p-3 rounded-xl text-white w-full h-[46px] text-xs font-bold"
                        value={selectedSubWalletId}
                        onChange={(e) => setSelectedSubWalletId(e.target.value)}
                      >
                        <option value="AL_KURIMI">بنك الكريمي الإسلامي (1102)</option>
                        <option value="AL_TADHAMON">بنك التضامن الإسلامي (1103)</option>
                        <option value="YKB">بنك اليمن والكويت (1104)</option>
                        <option value="AL_NAJM">شركة النجم للصرافة (1105)</option>
                        <option value="AL_AMQI">شركة العمقي للصرافة (1106)</option>
                        <option value="JAWALI">محفظة جوالي الإلكترونية (1107)</option>
                      </select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="label-field block text-right font-bold text-xs text-amber-500">المبلغ المدفوع (ر.ي)</label>
                    <input 
                      required 
                      type="number" 
                      className="input-field bg-navy-900 border border-white/10 p-3 rounded-xl text-white w-full text-center" 
                      value={paymentAmount} 
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      autoFocus
                    />
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsConfirmPaymentOpen(true)}
                  className="btn-primary w-full py-4 text-sm font-black text-slate-950 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl mt-4"
                >
                  ✓ تأكيد استلام وترحيل المبلغ
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmPaymentOpen}
        onClose={() => setIsConfirmPaymentOpen(false)}
        onConfirm={() => handlePayment({ preventDefault: () => {} } as any)}
        title="تأكيد استلام دفعة"
        message={`هل أنت متأكد من استلام مبلغ ${paymentAmount} ر.ي من العميل ${selectedCustomerForPayment?.name}؟ سيتم خصم المبلغ من دينه.`}
        confirmText="تأكيد الاستلام"
      />

      <ConfirmModal
        isOpen={isBulkNotifyOpen}
        onClose={() => setIsBulkNotifyOpen(false)}
        onConfirm={handleBulkNotify}
        title="مراسلة كافة المدينين"
        message={`سيقوم النظام بإرسال رسائل SMS تذكيرية لكافة العملاء الذين عليهم ديون (عدد: ${customers.filter(c => c.debt > 0).length}). هل تريد الاستمرار بجهازك المتصل؟`}
        confirmText="بدء الإرسال الجماعي"
      />

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setIsConfirmDeleteOpen(false);
          setCustomerToDelete(null);
        }}
        onConfirm={async () => {
          if (customerToDelete) {
            try {
              const res = await safeDeleteCustomer({
                customerId: customerToDelete.id,
                phone: customerToDelete.phone,
                uid: (customerToDelete as any).linkedUid || (customerToDelete as any).uid,
                storeId: profile?.ownerId
              });
              if (res.success) {
                setStatus({ type: 'success', message: 'تم حذف حساب ومستندات العميل بأمان تام دون ترك معلقات' });
              } else {
                setStatus({ type: 'error', message: res.message });
              }
            } catch (error: any) {
              setStatus({ type: 'error', message: 'حدث خطأ أثناء الحذف: ' + (error?.message || error) });
            }
          }
        }}
        title="حذف حساب العميل نهائياً وبأمان"
        message={`هل أنت متأكد من الحذف الآمن للعميل (${customerToDelete?.name})؟ سيتم مسح حسابه وكافة مستنداته وسجلاته من النظام بشكل قطعي دون ترك بيانات معلقة.`}
        confirmText="تأكيد الحذف الآمن"
        type="danger"
      />

      <AnimatePresence>
        {isHistoryModalOpen && selectedCustomerForHistory && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-2xl bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">سجل مشتريات العميل</h3>
                  <p className="text-xs text-gray-400">{selectedCustomerForHistory.name}</p>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {customerSales.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p>لا توجد عمليات شراء مسجلة لهذا العميل</p>
                  </div>
                ) : (
                  customerSales.map((sale) => (
                    <div key={sale.id} className="p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-700 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs text-gray-400">
                            {sale.createdAt ? format(new Date(sale.createdAt.seconds * 1000), 'yyyy/MM/dd hh:mm a', { locale: ar }) : 'تاريخ غير معروف'}
                          </p>
                          <p className="font-bold text-navy-700 dark:text-brand-primary">إجمالي: {sale.total.toFixed(0)} ر.ي</p>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          sale.paymentMethod === 'debt' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                        }`}>
                          {sale.paymentMethod === 'debt' ? 'آجل' : 'نقدي'}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        {sale.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm border-t border-gray-200 dark:border-navy-700 pt-1">
                            <span>{item.name} x{item.quantity}</span>
                            <span className="font-bold">{item.price * item.quantity} ر.ي</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-navy-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 cursor-pointer" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 15 }} className="relative w-full max-w-2xl bg-white dark:bg-navy-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[94vh] sm:max-h-[92vh] flex flex-col z-10 my-auto">
              <div className="p-4 sm:p-6 bg-navy-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-brand-primary/20 text-brand-primary flex items-center justify-center">
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-xl font-bold">{editingCustomer ? 'تعديل بيانات عميل' : 'إضافة عميل جديد'}</h3>
                    <p className="text-[10px] sm:text-xs text-gray-400">إدارة بيانات النشاط التجاري وسقف الائتمان</p>
                  </div>
                </div>
                <button onClick={closeModal} className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 text-right overscroll-contain" dir="rtl">
                {/* رتبة النشاط التجاري (Business Tier First) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-700 dark:text-gray-300">رتبة ونوع النشاط (Business Tier)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
                    {[
                      { id: 'retail', label: 'تجزئة 🏪', desc: 'محل قطاعي' },
                      { id: 'wholesale', label: 'جملة 📦', desc: 'تاجر جملة' },
                      { id: 'mega_wholesale', label: 'جملة الجملة 🏛️', desc: 'موزع رئيسي' },
                      { id: 'importer', label: 'مستورد 🚢', desc: 'وكيل استيراد' },
                      { id: 'individual', label: 'أفراد 👤', desc: 'زبون عادي' }
                    ].map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, businessTier: tier.id as any })}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          formData.businessTier === tier.id
                            ? 'bg-brand-primary text-white border-brand-primary font-black shadow-sm'
                            : 'bg-gray-50 dark:bg-navy-900 border-gray-200 dark:border-navy-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs font-black">{tier.label}</div>
                        <div className="text-[9px] opacity-80">{tier.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* اسم العميل واسم المحل (مشروط بالتصنيف) */}
                <div className={`grid grid-cols-1 ${formData.businessTier !== 'individual' ? 'sm:grid-cols-2' : ''} gap-3`}>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">اسم العميل / المسؤول *</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="مثال: أحمد محمد الشامي"
                      className="input-field w-full text-xs font-bold" 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    />
                  </div>
                  {formData.businessTier !== 'individual' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300">اسم المحل / المنشأة التجارية</label>
                      <input 
                        type="text" 
                        placeholder="مثال: مركز النور التجاري"
                        className="input-field w-full text-xs font-bold" 
                        value={formData.shopName} 
                        onChange={(e) => setFormData({...formData, shopName: e.target.value})} 
                      />
                    </div>
                  )}
                </div>

                {/* رقم الهاتف والكود */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">رقم الهاتف (الواتساب) *</label>
                    <input 
                      required 
                      type="tel" 
                      placeholder="770000000"
                      className="input-field w-full text-xs font-mono font-bold" 
                      value={formData.phone} 
                      onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">كود / رمز العميل</label>
                    <input 
                      type="text" 
                      placeholder="CUST-1001"
                      className="input-field w-full text-xs font-mono font-bold uppercase" 
                      value={formData.code} 
                      onChange={(e) => setFormData({...formData, code: e.target.value})} 
                    />
                  </div>
                </div>

                {/* العنوان / الموقع */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {formData.businessTier !== 'individual' ? 'العنوان / موقع المحل' : 'العنوان / السكن (اختياري)'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={formData.businessTier !== 'individual' ? "مثال: صنعاء - شارع تعز - بجوار جولة 45" : "مثال: صنعاء - حدة"}
                    className="input-field w-full text-xs" 
                    value={formData.address} 
                    onChange={(e) => setFormData({...formData, address: e.target.value})} 
                  />
                </div>

                {/* خيار فتح حساب آجل وسقف المديونية */}
                <div className="p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-200 dark:border-navy-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-navy-900 dark:text-white flex items-center gap-1.5">
                        <CreditCard size={14} className="text-brand-primary" />
                        <span>فتح حساب آجل وائتمان تجاري</span>
                      </div>
                      <p className="text-[11px] text-gray-500">تمكين العميل من الشراء بالآجل وفق سقف مالي محدد</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.allowCredit}
                        onChange={(e) => setFormData({ ...formData, allowCredit: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {formData.allowCredit && (
                    <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-navy-800 animate-fadeIn">
                      <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400">سقف المديونية الأقصى (Credit Limit) ر.ي</label>
                      <input
                        type="number"
                        placeholder="مثال: 500000"
                        value={formData.creditLimit || ''}
                        onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                        className="input-field w-full text-xs font-mono font-black"
                      />
                    </div>
                  )}
                </div>

                {/* الرصيد الافتتاحي للديون */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-rose-500">الرصيد الافتتاحي الحالي (دين) ر.ي</label>
                  <input 
                    type="number" 
                    step="1" 
                    className="input-field w-full text-xs font-mono" 
                    value={formData.debt} 
                    onChange={(e) => setFormData({...formData, debt: Number(e.target.value)})} 
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="btn-primary w-full py-4 text-base font-black disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'جاري الحفظ...' : (editingCustomer ? 'تحديث بيانات العميل' : 'حفظ وتسجيل العميل')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* B2B Onboarding Invitation Modal */}
      <B2BInvitationModal
        isOpen={Boolean(b2bInviteCustomer)}
        onClose={() => setB2bInviteCustomer(null)}
        customer={b2bInviteCustomer}
        profile={profile}
      />

      {/* Royal VIP License & Connection Verification Modal */}
      <AnimatePresence>
        {isVipLicenseAlertOpen && (
          <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVipLicenseAlertOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-navy-900 to-slate-950 border border-royal-gold/30 rounded-[2.5rem] p-8 shadow-2xl z-10 overflow-hidden text-center"
            >
              {/* Background Glow */}
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-royal-gold/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              {vipAlertReason === 'offline' ? (
                <div className="space-y-5">
                  <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
                    <WifiOff size={40} className="animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-white">الاتصال بالإنترنت مطلوب</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      عذراً، يتطلب فتح بوابة زبائن VIP وتوليد بطاقات التفعيل ومزامنة الحسابات اتصالاً نشطاً بالإنترنت للتحقق الآمن ومزامنة السحابة فورياً.
                    </p>
                  </div>
                  <div className="p-4 bg-navy-950/60 rounded-2xl border border-white/5 text-xs text-amber-300 font-bold flex items-center justify-center gap-2">
                    <Sparkles size={16} className="text-royal-gold shrink-0" />
                    <span>تأكد من الاتصال بشبكة الواي فاي أو بيانات الهاتف وأعد المحاولة.</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => {
                        if (navigator.onLine) {
                          setIsVipLicenseAlertOpen(false);
                          checkVipAccessAndExecute(() => setIsVipModalOpen(true));
                        } else {
                          alert('لا يزال جهازك غير متصل بالإنترنت حالياً.');
                        }
                      }}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 rounded-2xl font-black text-sm shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw size={16} />
                      <span>إعادة الفحص الآن</span>
                    </button>
                    <button
                      onClick={() => setIsVipLicenseAlertOpen(false)}
                      className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-white rounded-2xl font-bold text-sm transition-all cursor-pointer"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              ) : vipAlertReason === 'expired' ? (
                <div className="space-y-5">
                  <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                    <Crown size={40} className="text-[#d4af37] animate-bounce" />
                  </div>
                  <div className="space-y-2">
                    <span className="px-3 py-1 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-full text-xs font-black inline-block">
                      انتهت فترة الاشتراك
                    </span>
                    <h3 className="text-2xl font-black text-white">انتهت باقة تطبيق الزبائن VIP</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      لقد انتهت فترة ترخيص وباقة تطبيق الزبائن الخاصة بمتجرك ({profile?.shopName || 'متجرك'}). يرجى تجديد الاشتراك مع إدارة النظام لإعادة تفعيل البوابة ومزامنة الزبائن فوراً.
                    </p>
                  </div>
                  <div className="p-4 bg-navy-950/60 rounded-2xl border border-white/5 text-xs text-gray-300 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">معرف المتجر:</span>
                      <span className="font-mono text-royal-gold font-bold">{profile?.ownerId || 'store-id'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">اسم المحل:</span>
                      <span className="font-bold text-white">{profile?.shopName || 'المحل'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <a
                      href={`https://wa.me/967770000000?text=${encodeURIComponent(`👑 مرحباً إدارة النظام (SuperAdmin)، أود تجديد باقة واشتراك تطبيق الزبائن VIP لمتجري:\nاسم المحل: ${profile?.shopName || 'المحل'}\nمعرف المحل: ${profile?.ownerId || 'store-id'}\nرقم الهاتف: ${profile?.phone || ''}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-slate-950 rounded-2xl font-black text-sm shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all flex items-center justify-center gap-2 text-decoration-none"
                    >
                      <Crown size={16} className="text-slate-950" />
                      <span>تجديد الاشتراك فوراً</span>
                    </a>
                    <button
                      onClick={() => setIsVipLicenseAlertOpen(false)}
                      className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-white rounded-2xl font-bold text-sm transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="w-20 h-20 bg-royal-gold/10 border border-royal-gold/30 text-royal-gold rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                    <Crown size={40} className="text-[#d4af37] animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <span className="px-3 py-1 bg-royal-gold/15 border border-royal-gold/30 text-royal-gold rounded-full text-xs font-black inline-block">
                      ميزة ملكية VIP 🌟
                    </span>
                    <h3 className="text-2xl font-black text-white">تفعيل باقة تطبيق الزبائن مطلوب</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      بوابة وتطبيق الزبائن الملكية (VIP Customer Portal & Mobile App) غير مفعلة لهذا المتجر حالياً. يرجى التواصل مع إدارة النظام (SuperAdmin) لتفعيل باقة الزبائن وفتح البوابة وتوليد بطاقات الدخول التلقائية.
                    </p>
                  </div>
                  <div className="p-4 bg-navy-950/60 rounded-2xl border border-white/5 text-xs text-gray-300 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">معرف المتجر:</span>
                      <span className="font-mono text-royal-gold font-bold">{profile?.ownerId || 'store-id'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">اسم المحل:</span>
                      <span className="font-bold text-white">{profile?.shopName || 'المحل'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <a
                      href={`https://wa.me/967770000000?text=${encodeURIComponent(`👑 مرحباً إدارة النظام (SuperAdmin)، أود تفعيل باقة واشتراك تطبيق الزبائن VIP لمتجري:\nاسم المحل: ${profile?.shopName || 'المحل'}\nمعرف المحل: ${profile?.ownerId || 'store-id'}\nرقم الهاتف: ${profile?.phone || ''}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-slate-950 rounded-2xl font-black text-sm shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all flex items-center justify-center gap-2 text-decoration-none"
                    >
                      <Crown size={16} className="text-slate-950" />
                      <span>طلب التفعيل من السوبر أدمن</span>
                    </a>
                    <button
                      onClick={() => setIsVipLicenseAlertOpen(false)}
                      className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-white rounded-2xl font-bold text-sm transition-all cursor-pointer"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              )}
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
      <VipActivationModal 
        isOpen={isVipModalOpen} 
        onClose={() => setIsVipModalOpen(false)} 
        profile={profile} 
      />
    </div>
  );
}
