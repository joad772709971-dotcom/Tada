import React, { useEffect, useState } from 'react';
import { 
  Bell, AlertTriangle, TrendingDown, TrendingUp, DollarSign, 
  Clock, MessageCircle, ShoppingBasket, Users, Zap, X, Check, ArrowRight,
  Calendar, CreditCard, Trash2, Filter, ShieldCheck, CheckCheck, Sparkles, Layers, RefreshCw
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, doc, getDoc, getDocs,
  addDoc, updateDoc, serverTimestamp, Timestamp, limit, orderBy, writeBatch 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { idbService } from '../services/idbService';
import { UserProfile, WholesaleProduct } from '../types';
import { parseTemplate } from '../services/smsService';
import { DevicePermissionsService } from '../services/DevicePermissionsService';
import { playNotificationChime } from '../utils/audioAlerts';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { motion, AnimatePresence } from 'motion/react';

// ========================================================
// 1. JAM NOTIFICATION & BADGE DEFS FOR SIDE PANEL INTERACTION
// ========================================================
export interface JamNotification {
  id: string;
  title: string;
  message: string;
  category: 'FINANCIAL' | 'LOGISTICS' | 'NETWORK';
  isRead: boolean;
  createdAt?: any;
}

export const JamBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <span style={{
      background: '#ef4444',
      color: '#fff',
      borderRadius: '50%',
      padding: '2px 6px',
      fontSize: '10px',
      marginRight: '4px',
      fontWeight: 'bold',
      lineHeight: 1,
      display: 'inline-block'
    }}>
      {count}
    </span>
  );
};

export interface JamAlert extends JamNotification {
  type: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  icon?: any;
  path?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationManagerProps {
  profile: UserProfile | null;
  shopSettings: any;
}

// Storage helpers for persistence
const getDeletedAlertIds = (): Set<string> => {
  try {
    const saved = localStorage.getItem('jam_deleted_alerts');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
};

const saveDeletedAlertId = (id: string) => {
  try {
    const current = getDeletedAlertIds();
    current.add(id);
    localStorage.setItem('jam_deleted_alerts', JSON.stringify(Array.from(current)));
  } catch (e) {
    console.warn('Failed to save deleted alert ID', e);
  }
};

const saveAllDeletedAlertIds = (ids: string[]) => {
  try {
    const current = getDeletedAlertIds();
    ids.forEach(id => current.add(id));
    localStorage.setItem('jam_deleted_alerts', JSON.stringify(Array.from(current)));
  } catch (e) {
    console.warn('Failed to save deleted alert IDs', e);
  }
};

const getReadAlertIds = (): Set<string> => {
  try {
    const saved = localStorage.getItem('jam_read_alerts');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
};

const markAlertIdAsRead = (id: string) => {
  try {
    const current = getReadAlertIds();
    current.add(id);
    localStorage.setItem('jam_read_alerts', JSON.stringify(Array.from(current)));
  } catch (e) {
    console.warn('Failed to save read alert ID', e);
  }
};

const getCategoryForType = (type: string): 'FINANCIAL' | 'LOGISTICS' | 'NETWORK' => {
  if (['rate_change', 'debt_due', 'late_installment', 'cashier_receipt', 'debt_messaging'].includes(type)) {
    return 'FINANCIAL';
  }
  if (['price_change', 'daily_review', 'worker_packing', 'quantity_confirmed', 'inventory_settled', 'maint_assign'].includes(type)) {
    return 'LOGISTICS';
  }
  return 'NETWORK';
};

export default function NotificationManager({ profile, shopSettings }: NotificationManagerProps) {
  const [activeAlerts, setActiveAlerts] = useState<JamAlert[]>([]);
  const [toastAlerts, setToastAlerts] = useState<JamAlert[]>([]);
  const [shownSchedules, setShownSchedules] = useState<Set<string>>(new Set());
  const [exchangeRates, setExchangeRates] = useState<any>(null);
  const [priceCache, setPriceCache] = useState<Record<string, number>>({});
  
  // UI & Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'FINANCIAL' | 'LOGISTICS' | 'NETWORK'>('ALL');
  const [permissionGranted, setPermissionGranted] = useState<boolean>(true);
  const [requestingPerm, setRequestingPerm] = useState<boolean>(false);

  // 0. Automatic Notification Permissions Requester on Boot
  useEffect(() => {
    const initNotificationPermissions = async () => {
      try {
        // Trigger background hardware & permissions initialization
        await DevicePermissionsService.requestAllRequiredPermissions();

        if (Capacitor.isNativePlatform()) {
          const status = await PushNotifications.checkPermissions();
          if (status.receive === 'granted') {
            setPermissionGranted(true);
          } else {
            console.log('🔔 Requesting Push Notification permissions on startup...');
            const req = await PushNotifications.requestPermissions();
            setPermissionGranted(req.receive === 'granted');
          }
        } else {
          if ('Notification' in window) {
            if (Notification.permission === 'granted') {
              setPermissionGranted(true);
            } else if (Notification.permission !== 'denied') {
              console.log('🔔 Requesting Web Notification permissions on startup...');
              const res = await Notification.requestPermission();
              setPermissionGranted(res === 'granted');
            } else {
              setPermissionGranted(false);
            }
          }
        }
      } catch (err) {
        console.warn('Silent notification permissions check error:', err);
      }
    };

    initNotificationPermissions();
  }, []);

  const handleManualPermissionRequest = async () => {
    setRequestingPerm(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const req = await PushNotifications.requestPermissions();
        setPermissionGranted(req.receive === 'granted');
      } else if ('Notification' in window) {
        const res = await Notification.requestPermission();
        setPermissionGranted(res === 'granted');
      } else {
        setPermissionGranted(true);
      }
    } catch (e) {
      console.warn('Manual permission request error:', e);
    } finally {
      setRequestingPerm(false);
    }
  };

  // Helper to safely add alert ignoring deleted ones
  const addAlert = (alertData: any) => {
    const deletedSet = getDeletedAlertIds();
    if (deletedSet.has(alertData.id)) return;

    const readSet = getReadAlertIds();
    const category = alertData.category || getCategoryForType(alertData.type);
    const isRead = readSet.has(alertData.id);

    const newAlert: JamAlert = {
      ...alertData,
      category,
      isRead,
      createdAt: alertData.createdAt || Date.now()
    };

    setActiveAlerts(prev => {
      if (prev.some(a => a.id === alertData.id)) return prev;
      return [newAlert, ...prev];
    });

    // Also push to transient toasts and play audio chime if unread
    if (!isRead) {
      playNotificationChime(alertData.severity || 'info');
      
      setToastAlerts(prev => {
        if (prev.some(a => a.id === alertData.id)) return prev;
        return [newAlert, ...prev];
      });

      // Auto-dismiss toast after 6 seconds
      setTimeout(() => {
        setToastAlerts(prev => prev.filter(a => a.id !== alertData.id));
      }, 6000);
    }
  };

  const deleteSingleAlert = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    saveDeletedAlertId(id);
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
    setToastAlerts(prev => prev.filter(a => a.id !== id));
  };

  const clearAllAlerts = () => {
    const ids = activeAlerts.map(a => a.id);
    saveAllDeletedAlertIds(ids);
    setActiveAlerts([]);
    setToastAlerts([]);
  };

  const markAsRead = (id: string) => {
    markAlertIdAsRead(id);
    setActiveAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  // 1. Price Monitoring
  useEffect(() => {
    if (!profile?.ownerId || !profile.followedWholesalerIds?.length || !shopSettings?.notificationSettings?.priceMonitorEnabled) return;

    const q = query(
      collection(db, 'wholesaleProducts'),
      where('wholesalerId', 'in', profile.followedWholesalerIds)
    );

    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const item = { id: change.doc.id, ...change.doc.data() } as WholesaleProduct;
        
        if (change.type === 'modified') {
          const oldPrice = priceCache[item.id];
          if (oldPrice !== undefined && oldPrice !== item.price) {
            const wDoc = await getDoc(doc(db, 'users', item.wholesalerId));
            const wName = wDoc.exists() ? (wDoc.data() as any).name : 'مورد';

            addAlert({
              id: `price-${item.id}-${Date.now()}`,
              type: 'price_change',
              category: 'LOGISTICS',
              title: 'تغير سعر صنف',
              message: `تنبيه: تغير سعر (${item.name}) عند المورد (${wName}). السعر السابق: ${oldPrice}, السعر الجديد: ${item.price}`,
              severity: item.price > oldPrice ? 'warning' : 'success',
              icon: item.price > oldPrice ? TrendingUp : TrendingDown,
              path: '#/inventory',
              action: {
                label: 'تحديث السعر عندي الآن',
                onClick: () => updateLocalPrice(item)
              }
            });
          }
        }
        
        setPriceCache(prev => ({ ...prev, [item.id]: item.price }));
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wholesaleProducts');
    });
  }, [profile?.followedWholesalerIds, shopSettings?.notificationSettings?.priceMonitorEnabled]);

  // 2. Exchange Rate Monitoring
  useEffect(() => {
    if (!profile?.ownerId || !shopSettings?.notificationSettings?.currencyMonitorEnabled) return;

    const unsub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const newRates = docSnap.data().exchangeRates;
        if (exchangeRates && JSON.stringify(exchangeRates) !== JSON.stringify(newRates)) {
          addAlert({
            id: `rate-${Date.now()}`,
            type: 'rate_change',
            category: 'FINANCIAL',
            title: 'تغير أسعار الصرف',
            message: 'تحذير: لقد تغير سعر الصرف العالمي. يرجى مراجعة أسعار البيع المرتبطة بالعملات الأجنبية فوراً لضمان هامش الربح.',
            severity: 'error',
            icon: DollarSign,
            path: '#/inventory',
            action: {
              label: 'مراجعة الأسعار',
              onClick: () => window.location.hash = '#/inventory'
            }
          });
        }
        setExchangeRates(newRates);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/general');
    });

    return () => unsub();
  }, [profile?.ownerId, shopSettings?.notificationSettings?.currencyMonitorEnabled, exchangeRates]);

  // 3. Debt & Installments
  useEffect(() => {
    if (!profile?.ownerId || !shopSettings?.notificationSettings?.installmentAlertEnabled) return;

    const checkDebtsAndInstallments = () => {
      const q = query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId), where('debt', '>', 0));
      return onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          
          if (data.dueDate) {
            const dueDate = data.dueDate instanceof Timestamp ? data.dueDate.toDate() : new Date(data.dueDate);
            const diffDays = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= (shopSettings.notificationSettings?.debtAlertDays || 2) && diffDays >= 0) {
              addAlert({
                id: `debt-${doc.id}`,
                type: 'debt_due',
                category: 'FINANCIAL',
                title: 'موعد استحقاق دين',
                message: `تنبيه: مديونية العميل (${data.name}) تستحق خلال ${diffDays} أيام. المبلغ: ${data.debt}`,
                severity: 'warning',
                icon: Clock,
                path: '#/customers'
              });
            }
          }

          if (data.lastPaymentDate) {
            const lastPayment = data.lastPaymentDate instanceof Timestamp ? data.lastPaymentDate.toDate() : new Date(data.lastPaymentDate);
            const daysSinceLast = Math.floor((new Date().getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSinceLast > 30) {
              addAlert({
                id: `installment-${doc.id}`,
                type: 'late_installment',
                category: 'FINANCIAL',
                title: 'تأخر في سداد القسط',
                message: `تنبيه: العميل (${data.name}) متأخر عن السداد منذ ${daysSinceLast} يوم. إجمالي دينه: ${data.debt}`,
                severity: 'error',
                icon: Calendar,
                action: {
                  label: 'مراسلة الآن',
                  onClick: () => {
                    const msg = parseTemplate(shopSettings.messageTemplates?.installment_reminder || '', { name: data.name, amount: data.debt });
                    window.open(`https://wa.me/${data.phone}?text=${encodeURIComponent(msg)}`, '_blank');
                  }
                }
              });
            }
          }
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'customers');
      });
    };

    const unsub = checkDebtsAndInstallments();
    return () => unsub();
  }, [profile?.ownerId, shopSettings?.notificationSettings?.installmentAlertEnabled]);

  // 4. Daily Scheduler
  useEffect(() => {
    if (!profile?.ownerId || !shopSettings?.notificationSettings) return;

    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (timeStr === shopSettings.notificationSettings.reviewTime && !shownSchedules.has(`review-${timeStr}`)) {
        addAlert({
          id: `schedule-review-${Date.now()}`,
          type: 'daily_review',
          category: 'LOGISTICS',
          title: 'وقت المراجعة اليومية',
          message: 'حان الآن موعد مراجعة قائمة النواقص والطلبات المعلقة لإرسالها للموردين.',
          severity: 'info',
          icon: ShoppingBasket,
          path: '#/inventory',
          action: {
            label: 'فتح قائمة النواقص',
            onClick: () => window.location.hash = '#/inventory'
          }
        });
        setShownSchedules(prev => new Set(prev).add(`review-${timeStr}`));
      }

      if (timeStr === shopSettings.notificationSettings.debtMessagingTime && !shownSchedules.has(`debt-msg-${timeStr}`)) {
        addAlert({
          id: `schedule-debt-${Date.now()}`,
          type: 'debt_messaging',
          category: 'FINANCIAL',
          title: 'وقت مراسلة المديونين',
          message: 'حان موعد مراسلة العملاء المديونين. هل ترغب في عرض كشف المدينين الآن؟',
          severity: 'info',
          icon: MessageCircle,
          path: '#/customers',
          action: {
            label: 'عرض كشف المديونين',
            onClick: () => window.location.hash = '#/customers'
          }
        });
        setShownSchedules(prev => new Set(prev).add(`debt-msg-${timeStr}`));
      }

      if (timeStr === '00:00') {
        setShownSchedules(new Set());
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [profile?.ownerId, shopSettings?.notificationSettings, shownSchedules]);

  // 5. Chat Notification Listener
  useEffect(() => {
    if (!profile?.ownerId) return;

    const q = query(
      collection(db, 'messages'),
      where('receiverId', '==', profile.ownerId),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data();
          const createdAt = msg.createdAt instanceof Timestamp ? msg.createdAt.toMillis() : Date.now();
          if (Date.now() - createdAt < 10000) {
            addAlert({
              id: `msg-${change.doc.id}`,
              type: 'new_message',
              category: 'NETWORK',
              title: `رسالة جديدة من ${msg.customerName || 'مستخدم'}`,
              message: msg.content.length > 50 ? `${msg.content.substring(0, 50)}...` : msg.content,
              severity: 'info',
              icon: MessageCircle,
              path: `#/chat?contactId=${msg.senderId}`,
              action: {
                label: 'فتح الدردشة',
                onClick: () => window.location.hash = `#/chat?contactId=${msg.senderId}`
              }
            });
          }
        }
      });
    });

    return () => unsub();
  }, [profile?.ownerId]);

  // 6. Network Order Notifications (9-Stage Lifecycle)
  useEffect(() => {
    if (!profile?.ownerId) return;

    const q = query(
      collection(db, 'networkOrders'),
      where(profile.role === 'wholesaler' ? 'wholesalerId' : 'retailerId', '==', profile.ownerId),
      orderBy('updatedAt', 'desc'),
      limit(5)
    );

    const unsubOrders = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const order = change.doc.data();
          const orderId = change.doc.id;
          const updatedAt = order.updatedAt instanceof Timestamp ? order.updatedAt.toMillis() : Date.now();
          
          if (Date.now() - updatedAt < 12000) {
            if (order.status === 'pending') {
              addAlert({
                id: `stage1-${orderId}`,
                type: 'new_order',
                category: 'NETWORK',
                title: 'المرحلة ١/٩: تم تقديم طلب شبكي جديد 🛒',
                message: `وصل طلب جديد بمبلغ ${order.total?.toLocaleString()} ر.ي من ${order.retailerName || 'متجر العميل'}`,
                severity: 'info',
                icon: ShoppingBasket,
                path: '#/network',
                action: {
                  label: 'عرض وتجهيز المعاملة',
                  onClick: () => window.location.hash = '#/network'
                }
              });
            }

            if (order.status === 'packing' || order.status === 'prepping') {
              addAlert({
                id: `stage2-${orderId}`,
                type: 'worker_packing',
                category: 'LOGISTICS',
                title: 'المرحلة ٢/٩: طاقم العمل يجهّز الآن 📦',
                message: `الطلبية رقم (${orderId.slice(-6)}) قيد الفرز والتعليب والتغليف بواسطة الأمين والمحضّر الآن.`,
                severity: 'warning',
                icon: Users,
                path: '#/network'
              });
            }

            if (order.status === 'confirmed' || order.status === 'ready') {
              addAlert({
                id: `stage3-${orderId}`,
                type: 'quantity_confirmed',
                category: 'LOGISTICS',
                title: 'المرحلة ٣/٩: تأكيد الكميات والمطابقة دقة ١٠٠٪ 🎯',
                message: `تمت مطابقة وتأكيد الكميات والاعتماد للسلع بالطلبية رقم (${orderId.slice(-6)}) بنجاح.`,
                severity: 'success',
                icon: Check,
                path: '#/network'
              });
            }

            if (order.paymentStatus === 'paid' || order.invoiceIssued) {
              addAlert({
                id: `stage4-${orderId}`,
                type: 'cashier_receipt',
                category: 'FINANCIAL',
                title: 'المرحلة ٤/٩: استلام السند وفاتورة الصندوق 🧾',
                message: `تم استيفاء الحسابات المالية وطباعة فاتورة الصندوق للرصيد المعني بالمعاملة رقم (${orderId.slice(-6)}).`,
                severity: 'success',
                icon: CreditCard,
                path: '#/network'
              });
            }

            if (order.status === 'settled' || order.status === 'delivered' || order.status === 'received') {
              addAlert({
                id: `stage5-${orderId}`,
                type: 'inventory_settled',
                category: 'LOGISTICS',
                title: 'المرحلة ٥/٩: تسوية المخزن وتصفير الفروقات 🔄',
                message: `تم تصفير نواقص المخزن بنجاح وتحديث أرصدة المخزون السحابي واللوكال.`,
                severity: 'success',
                icon: Zap,
                path: '#/network'
              });
            }
          }
        }
      });
    }, (error) => {
      console.warn('9-stage orders listener notice (offline/permission):', error?.message || error);
    });

    const wpQuery = query(collection(db, 'wholesaleProducts'), orderBy('createdAt', 'desc'), limit(1));
    const unsubWP = onSnapshot(wpQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const item = change.doc.data();
          const createdAt = item.createdAt instanceof Timestamp ? item.createdAt.toMillis() : Date.now();
          if (Date.now() - createdAt < 12000 && item.wholesalerId !== profile?.ownerId) {
            addAlert({
              id: `stage6-${change.doc.id}`,
              type: 'new_product_published',
              category: 'NETWORK',
              title: 'المرحلة ٦/٩: سلع حية جديدة كلياً في الأسواق 🌐',
              message: `قام المورد (${item.wholesalerName}) بنشر المنتج الجديد (${item.name}) بسعر ${item.price?.toLocaleString()} ر.ي في سوق B2B!`,
              severity: 'info',
              icon: Zap,
              path: '#/network'
            });
          }
        }
      });
    });

    return () => {
      unsubOrders();
      unsubWP();
    };
  }, [profile?.ownerId, profile?.role]);

  // 7. Timed Escalations Matrix (Stages 7, 8, and 9)
  useEffect(() => {
    if (!profile?.ownerId) return;

    const checkEscalations = async () => {
      try {
        const q = query(
          collection(db, 'networkOrders'),
          where(profile.role === 'wholesaler' ? 'wholesalerId' : 'retailerId', '==', profile.ownerId)
        );
        const snap = await getDocs(q);
        const nowMs = Date.now();

        snap.docs.forEach(docSnap => {
          const order = docSnap.data();
          const orderId = docSnap.id;
          const createdAt = order.createdAt instanceof Timestamp ? order.createdAt.toMillis() : nowMs;
          const updatedAt = order.updatedAt instanceof Timestamp ? order.updatedAt.toMillis() : nowMs;

          if (order.status === 'pending' && (nowMs - createdAt) > 300000) {
            addAlert({
              id: `escalation-stage7-${orderId}`,
              type: 'supplier_delay',
              category: 'NETWORK',
              title: 'المرحلة ٧/٩: تصعيد تأخر المورد في الاستجابة ⏰',
              message: `تحذير: الطلبية المعلقة رقم (${orderId.slice(-6)}) مضى عليها أكثر من ٥ دقائق دون رد أو قبول من المورد!`,
              severity: 'error',
              icon: AlertTriangle,
              path: '#/network'
            });
          }

          if ((order.status === 'ready' || order.status === 'confirmed') && (nowMs - updatedAt) > 600000) {
            addAlert({
              id: `escalation-stage8-${orderId}`,
              type: 'shipment_delay',
              category: 'LOGISTICS',
              title: 'المرحلة ٨/٩: تصعيد تأخر شحن السلعة وتخطي الوقت 🚨',
              message: `تصعيد عاجل: السلع جاهزة ومطابقة للطلب (${orderId.slice(-6)}) ولكن الشحن تأخر لأكثر من ١٠ دقائق!`,
              severity: 'error',
              icon: AlertTriangle,
              path: '#/network'
            });
          }

          if (order.status === 'dispatched' && (nowMs - updatedAt) > 900000) {
            addAlert({
              id: `escalation-stage9-${orderId}`,
              type: 'client_delay',
              category: 'NETWORK',
              title: 'المرحلة ٩/٩: تصعيد تأخر استلام العميل والتأكيد ⚠️',
              message: `تنبيه: تم شحن الطلب رقم (${orderId.slice(-6)}) منذ ١٥ دقيقة ولكن العميل لم يؤكد النواقص أو الاستلام حتى الآن.`,
              severity: 'warning',
              icon: Clock,
              path: '#/network'
            });
          }
        });
      } catch (err: any) {
        console.warn('Timed escalation monitoring notice (offline/permission):', err?.message || err);
      }
    };

    checkEscalations();
    const interval = setInterval(checkEscalations, 60000);
    return () => clearInterval(interval);
  }, [profile?.ownerId, profile?.role]);

  // 8. Logistics & Incoming Orders
  useEffect(() => {
    if (!profile?.ownerId) return;

    const q = query(
      collection(db, 'shortages'),
      where('targetShopId', '==', profile.ownerId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
          
          if (Date.now() - createdAt < 15000) {
            addAlert({
              id: `shortage-in-${change.doc.id}`,
              type: 'incoming_order',
              category: 'LOGISTICS',
              title: 'طلب توريد وارد 🚛',
              message: `طلب جديد: (${data.name}) العدد: ${data.quantity} من: ${data.senderName || 'متجر زميل'}`,
              severity: 'info',
              icon: ShoppingBasket,
              path: '#/orders',
              action: {
                label: 'عرض الطلبات الواردة',
                onClick: () => window.location.hash = '#/orders'
              }
            });
          }
        }
      });
    }, (error) => {
      console.log('Shortages listener error:', error);
    });
  }, [profile?.ownerId]);

  // 9. Maintenance Assignment Notifications
  useEffect(() => {
    if (!profile?.uid || profile.role !== 'engineer') return;

    const q = query(
      collection(db, 'maintenanceOrders'),
      where('engineerId', '==', profile.uid),
      where('status', '==', 'received'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
          
          if (Date.now() - createdAt < 15000) {
            addAlert({
              id: `maint-assign-${change.doc.id}`,
              type: 'new_assignment',
              category: 'LOGISTICS',
              title: 'تكليف صيانة جديد 🛠️',
              message: `تم تكليفك بصيانة (${data.deviceModel}) للعميل: ${data.customerName}`,
              severity: 'warning',
              icon: Clock,
              path: '#/maintenance',
              action: {
                label: 'ابدأ الصيانة',
                onClick: () => window.location.hash = '#/maintenance'
              }
            });
          }
        }
      });
    }, (error) => {
       console.log('Maintenance assign listener error:', error);
    });
  }, [profile?.uid, profile?.role]);

  const updateLocalPrice = async (item: WholesaleProduct) => {
    if (!profile?.ownerId) return;
    try {
      const q = query(
        collection(db, 'inventory'), 
        where('ownerId', '==', profile.ownerId),
        where('name', '==', item.name)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const batch = writeBatch(db);
        const updatedItems: any[] = [];
        
        querySnapshot.docs.forEach(inventoryDoc => {
          const data = inventoryDoc.data();
          const updatedDoc = {
            ...data,
            id: inventoryDoc.id,
            price: item.price,
            updatedAt: new Date()
          };
          
          batch.update(inventoryDoc.ref, {
            price: item.price,
            updatedAt: serverTimestamp()
          });
          
          updatedItems.push(updatedDoc);
        });
        
        await batch.commit();

        for (const uItem of updatedItems) {
          await idbService.syncInventory([uItem]);
        }

        alert(`✅ تم تحديث السعر (Local & Cloud) لـ (${item.name}) بنجاح.`);
      } else {
        alert('❌ لم يتم العثور على الصنف في مخزونك للمطابقة.');
      }
      deleteSingleAlert(item.id);
    } catch (error) {
      console.warn('Sync price error:', error);
      alert('⚠️ حدث خطأ أثناء المزامنة.');
    }
  };

  // Filter alerts by active tab
  const filteredAlerts = activeAlerts.filter(a => {
    if (activeTab === 'ALL') return true;
    return a.category === activeTab;
  });

  const unreadCount = activeAlerts.filter(a => !a.isRead).length;
  const financialCount = activeAlerts.filter(a => a.category === 'FINANCIAL' && !a.isRead).length;
  const logisticsCount = activeAlerts.filter(a => a.category === 'LOGISTICS' && !a.isRead).length;
  const networkCount = activeAlerts.filter(a => a.category === 'NETWORK' && !a.isRead).length;

  return (
    <>
      {/* Integrated into main header "مركز الحركة والرقابة الذكية (الإشعارات والرقابة الحية)" */}

      {/* 2. CENTER DRAWER / NOTIFICATION CONTROL VAULT MODAL */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md font-sans text-right" dir="rtl">
            <div className="absolute inset-0" onClick={() => setIsDrawerOpen(false)} />

            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              className="relative w-full max-w-xl bg-slate-900/95 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden text-white flex flex-col max-h-[85vh]"
            >
              {/* Background ambient lighting */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
                    <Bell size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">مركز الإشعارات والرقابة الحية</h3>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black">
                          {unreadCount} غير مقروء
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">متابعة تحركات المبيعات، المالية، اللوجستيات والشبكة</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Permission Banner Action */}
                  {!permissionGranted ? (
                    <button
                      onClick={handleManualPermissionRequest}
                      disabled={requestingPerm}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {requestingPerm ? <RefreshCw className="animate-spin" size={14} /> : 'تفعيل الإشعارات 🔔'}
                    </button>
                  ) : (
                    <span className="hidden sm:inline-flex px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-xl items-center gap-1">
                      <ShieldCheck size={12} /> مفعّلة
                    </span>
                  )}

                  {/* Mass Delete / Clear All Button */}
                  {activeAlerts.length > 0 && (
                    <button
                      onClick={clearAllAlerts}
                      className="px-3 py-1.5 bg-red-600/15 hover:bg-red-600/30 text-red-400 border border-red-500/20 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="حذف جميع الإشعارات من الشاشة"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">مسح الكل</span>
                    </button>
                  )}

                  {/* Close button */}
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-2 hover:bg-white/10 active:scale-95 text-gray-400 hover:text-white rounded-full transition-all cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Sub-header Category Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1.5 bg-black/50 rounded-2xl border border-white/5 mb-4 shrink-0 overflow-x-auto custom-scrollbar text-xs font-black">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                    activeTab === 'ALL' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🌐 الكل ({activeAlerts.length})
                </button>
                <button
                  onClick={() => setActiveTab('FINANCIAL')}
                  className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                    activeTab === 'FINANCIAL' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  💰 مالية <JamBadge count={financialCount} />
                </button>
                <button
                  onClick={() => setActiveTab('LOGISTICS')}
                  className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                    activeTab === 'LOGISTICS' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  📦 مخازن <JamBadge count={logisticsCount} />
                </button>
                <button
                  onClick={() => setActiveTab('NETWORK')}
                  className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                    activeTab === 'NETWORK' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🔗 شبكة <JamBadge count={networkCount} />
                </button>
              </div>

              {/* Alerts List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 pl-1 custom-scrollbar">
                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-12 bg-black/20 rounded-3xl border border-white/5 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 text-gray-500 flex items-center justify-center mx-auto">
                      <Bell size={24} />
                    </div>
                    <p className="text-xs text-gray-400 font-bold">لا توجد إشعارات أو حركات معلقة في هذا القسم حالياً.</p>
                  </div>
                ) : (
                  filteredAlerts.map((alert) => {
                    const IconComp = alert.icon || Bell;
                    return (
                      <div
                        key={alert.id}
                        onClick={() => {
                          markAsRead(alert.id);
                          if (alert.path) {
                            window.location.hash = alert.path;
                            setIsDrawerOpen(false);
                          }
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 relative group ${
                          alert.isRead 
                            ? 'bg-slate-950/40 border-white/5 opacity-70' 
                            : 'bg-slate-950/80 border-white/10 hover:border-amber-500/40 shadow-lg'
                        }`}
                      >
                        {/* Icon Badge */}
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                          alert.severity === 'error' ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                          alert.severity === 'warning' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                          alert.severity === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                          'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          <IconComp size={18} />
                        </div>

                        {/* Text Details */}
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-extrabold text-xs text-white truncate">{alert.title}</h4>
                            <span className="text-[9px] text-gray-500 shrink-0 font-mono">
                              {alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : 'الآن'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 mt-1 leading-relaxed">{alert.message}</p>

                          {/* Quick action button */}
                          {alert.action && (
                            <div className="mt-2.5 flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  alert.action?.onClick();
                                  markAsRead(alert.id);
                                }}
                                className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow"
                              >
                                <Zap size={12} />
                                {alert.action.label}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* INDIVIDUAL DELETE BUTTON */}
                        <button
                          onClick={(e) => deleteSingleAlert(alert.id, e)}
                          className="p-1.5 bg-red-600/10 hover:bg-red-600/30 text-red-400 border border-red-500/10 rounded-xl transition-all cursor-pointer hover:scale-110 active:scale-95 shrink-0"
                          title="حذف الإشعار"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. TRANSIENT REAL-TIME TOAST POPUPS (Corner Floating) */}
      <div className="fixed bottom-24 right-8 z-[9998] flex flex-col gap-3 max-w-sm w-full pointer-events-none" dir="rtl">
        <AnimatePresence>
          {toastAlerts.map((alert) => {
            const IconComp = alert.icon || Bell;
            return (
              <motion.div
                key={`toast-${alert.id}`}
                initial={{ x: 400, opacity: 0, scale: 0.85 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: 400, opacity: 0, scale: 0.85 }}
                className={`pointer-events-auto p-4 rounded-3xl border-2 shadow-2xl flex flex-col gap-3 bg-slate-900/95 text-white backdrop-blur-md ${
                  alert.severity === 'error' ? 'border-red-500/40 shadow-red-500/20' :
                  alert.severity === 'warning' ? 'border-amber-500/40 shadow-amber-500/20' :
                  'border-indigo-500/40 shadow-indigo-500/20'
                }`}
              >
                <div 
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => {
                    markAsRead(alert.id);
                    if (alert.path) {
                      window.location.hash = alert.path;
                    }
                    setToastAlerts(prev => prev.filter(a => a.id !== alert.id));
                  }}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${
                    alert.severity === 'error' ? 'bg-red-500/20 text-red-400' :
                    alert.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-indigo-500/20 text-indigo-400'
                  }`}>
                    <IconComp size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-xs text-white">{alert.title}</h4>
                    <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">{alert.message}</p>
                  </div>

                  {/* Toast Individual Delete/Dismiss Button */}
                  <button 
                    onClick={(e) => deleteSingleAlert(alert.id, e)}
                    className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                    title="حذف"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {alert.action && (
                  <div className="flex gap-2 justify-end pt-1">
                    <button 
                      onClick={() => {
                        alert.action?.onClick();
                        markAsRead(alert.id);
                        setToastAlerts(prev => prev.filter(a => a.id !== alert.id));
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-[10px] font-black bg-amber-500 text-slate-950 flex items-center gap-1.5 transition-all active:scale-95 shadow"
                    >
                      <Zap size={12} />
                      {alert.action.label}
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
