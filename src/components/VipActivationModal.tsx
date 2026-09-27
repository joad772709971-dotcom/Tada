import { useState, useEffect, useRef } from 'react';
import { 
  Crown, X, Send, Printer, MessageSquare, Phone, User, Key, 
  Clock, CheckCircle2, Loader2, AlertCircle, Trash2, Smartphone,
  Copy, Check, QrCode, Sparkles, ExternalLink, ShieldCheck
} from 'lucide-react';
import { 
  collection, query, where, orderBy, onSnapshot, addDoc, 
  serverTimestamp, deleteDoc, doc, updateDoc, getDocs, getDoc, setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { sendSystemSMS } from '../services/smsService';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { unifiedOfflineStoreEngine } from '../services/UnifiedOfflineStoreEngine';
import { Customer } from '../types';

interface VipActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
}

interface PendingActivation {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  customerPassword?: string;
  storeId: string;
  isUsed: boolean;
  createdAt: any;
}

const generateRandomPassword = () => Math.floor(100000 + Math.random() * 900000).toString();

export default function VipActivationModal({ isOpen, onClose, profile }: VipActivationModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPassword, setCustomerPassword] = useState(generateRandomPassword());
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activations, setActivations] = useState<PendingActivation[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resetState, setResetState] = useState<Record<string, string>>({});
  const [appConfig, setAppConfig] = useState<any>(null);
  
  // Instant VIP Ticket modal state
  const [activeTicketModal, setActiveTicketModal] = useState<PendingActivation | null>(null);
  const [copied, setCopied] = useState(false);

  const activeStoreId = profile?.shopId || profile?.ownerId || 'default_store';

  const [localActivations, setLocalActivations] = useState<PendingActivation[]>(() => {
    try {
      const saved = localStorage.getItem(`local_vip_activations_${activeStoreId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem(`local_vip_activations_${activeStoreId}`, JSON.stringify(localActivations));
    } catch (e) {
      console.warn("Storage quota exceeded or error", e);
    }
  }, [localActivations, activeStoreId]);

  // Listen to activations
  useEffect(() => {
    if (!isOpen || !profile) return;
    setLoading(true);

    const q = query(
      collection(db, 'pending_activations'),
      where('storeId', '==', activeStoreId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: PendingActivation[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as PendingActivation);
      });
      // Sort in memory to avoid index requirements
      const sorted = list.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return dateB - dateA;
      });
      setActivations(sorted);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching activations:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, profile, activeStoreId]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
      if (snap.exists()) {
        setAppConfig(snap.data());
      }
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResetCustomerFingerprint = async (act: PendingActivation) => {
    if (!window.confirm(`هل أنت متأكد من إعادة تعيين بصمة الجوال للزبون (${act.customerName})؟`)) return;
    
    const phone = act.customerPhone.trim();
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
    
    setResetState(prev => ({ ...prev, [act.id]: 'loading' }));
    
    try {
      // 1. Query 'users' collection
      try {
        const usersRef = collection(db, 'users');
        const qUsers = query(usersRef, where('phone', '==', cleanPhone));
        const snap = await getDocs(qUsers);
        for (const d of snap.docs) {
          await updateDoc(doc(db, 'users', d.id), {
            registered_mobiles: [],
            registered_pcs: [],
            hwid: null,
            updatedAt: serverTimestamp()
          });
        }
      } catch (e: any) {
        console.warn('Error resetting users device cache:', e.message);
      }

      // 2. Reset in Store-isolated subcollection: stores/{activeStoreId}/customers
      try {
        const storeCustRef = doc(db, 'stores', activeStoreId, 'customers', `cust_${activeStoreId}_${cleanPhone}`);
        const storeCustSnap = await getDoc(storeCustRef);
        if (storeCustSnap.exists()) {
          await updateDoc(storeCustRef, {
            registered_mobiles: [],
            registered_pcs: [],
            hwid: null,
            updatedAt: serverTimestamp()
          });
        }
      } catch (e: any) {
        console.warn('Error resetting store customer device cache:', e.message);
      }

      // 3. Query 'customers' collection
      try {
        const customersRef = collection(db, 'customers');
        const qCustomers = query(customersRef, where('phone', '==', cleanPhone));
        const snap = await getDocs(qCustomers);
        for (const d of snap.docs) {
          await updateDoc(doc(db, 'customers', d.id), {
            registered_mobiles: [],
            registered_pcs: [],
            hwid: null
          });
        }
      } catch (e: any) {
        console.warn('Error resetting customers device cache:', e.message);
      }

      setResetState(prev => ({ ...prev, [act.id]: 'success' }));
      setSuccessMsg(`🚀 تم إعادة تعيين بصمة الجوال للعميل (${act.customerName}) بنجاح وتصفير الأجهزة المربوطة!`);
      setTimeout(() => {
        setResetState(prev => {
          const c = { ...prev };
          delete c[act.id];
          return c;
        });
        setSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setResetState(prev => ({ ...prev, [act.id]: 'error' }));
      alert('فشل إعادة تعيين البصمة: ' + err.message);
    }
  };

  // 1. Print Receipt Ticket Option
  const handlePrintTicket = (act: PendingActivation) => {
    const shopName = profile?.shopName || 'JAM System Pro';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('خطأ: تم حجب النافذة المنبثقة من قبل المتصفح. يرجى تفعيل النوافذ المنبثقة للطباعة.');
      return;
    }

    const portalUrl = `${window.location.origin}/portal?store=${activeStoreId}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>بطاقة تفعيل VIP - ${act.customerName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800;900&display=swap');
            * { box-sizing: border-box; }
            body { 
              font-family: 'Tajawal', sans-serif; 
              direction: rtl; 
              text-align: center; 
              padding: 24px; 
              margin: 0;
              color: #0f172a;
              background-color: #f8fafc;
            }
            .ticket-card {
              border: 3px solid #d4af37;
              border-radius: 20px;
              padding: 30px 24px;
              max-width: 380px;
              margin: 0 auto;
              background: #ffffff;
              box-shadow: 0 10px 25px rgba(0,0,0,0.08);
              position: relative;
            }
            .crown {
              font-size: 42px;
              margin-bottom: 4px;
              color: #d4af37;
            }
            .shop-title {
              font-size: 20px;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 4px 0;
            }
            .sub-title {
              font-size: 13px;
              font-weight: 700;
              color: #d97706;
              margin-bottom: 20px;
              letter-spacing: 0.5px;
            }
            .divider {
              height: 2px;
              background: linear-gradient(to right, transparent, #d4af37, transparent);
              margin: 15px 0;
            }
            .field-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px 14px;
              background: #f8fafc;
              border-radius: 12px;
              margin-bottom: 10px;
              border: 1px solid #e2e8f0;
            }
            .field-label {
              font-size: 13px;
              color: #64748b;
              font-weight: 700;
            }
            .field-value {
              font-size: 15px;
              color: #0f172a;
              font-weight: 900;
              font-family: monospace;
              direction: ltr;
            }
            .status-badge {
              background: #0f172a;
              color: #fbbf24;
              padding: 12px;
              font-size: 15px;
              font-weight: 900;
              border-radius: 12px;
              margin: 16px 0;
              border: 1px solid #d4af37;
            }
            .footer-notes {
              font-size: 11px;
              line-height: 1.6;
              color: #475569;
              margin-top: 16px;
              font-weight: 600;
            }
            .btn-print {
              margin-top: 20px;
              background: linear-gradient(135deg, #d4af37, #f59e0b);
              color: #0f172a;
              border: none;
              padding: 12px 24px;
              font-size: 14px;
              font-weight: 900;
              border-radius: 10px;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(212,175,55,0.3);
            }
            @media print {
              body { background-color: #ffffff; padding: 0; }
              .ticket-card { box-shadow: none; border: 2px solid #000; }
              .btn-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="ticket-card">
            <div class="crown">👑</div>
            <h1 class="shop-title">${shopName}</h1>
            <div class="sub-title">سند تفعيل وبطاقة اشتراك الزبائن VIP</div>
            
            <div class="divider"></div>

            <div class="field-row">
              <span class="field-label">اسم العميل:</span>
              <span class="field-value" style="direction: rtl; font-family: inherit;">${act.customerName}</span>
            </div>

            <div class="field-row">
              <span class="field-label">رقم الهاتف للدخول:</span>
              <span class="field-value">${act.customerPhone}</span>
            </div>

            <div class="field-row">
              <span class="field-label">كلمة المرور البدئية:</span>
              <span class="field-value" style="color: #b45309;">${act.customerPassword || '123456'}</span>
            </div>

            <div class="status-badge">✨ الحساب مفعل ونشط (دخول مباشر 100%)</div>

            <p class="footer-notes">
              يسر مركز <strong>${shopName}</strong> الترحيب بك في فئة النخبة VIP.<br/>
              للدخول ومتابعة كشف الحساب والطلبات فورياً، افتح تطبيق الزبائن وسجل الدخول برقم هاتفك وكلمة المرور المسجلة أعلاه.
            </p>

            <button class="btn-print" onclick="window.print()">طباعة السند الآن 🖨️</button>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  // 2. WhatsApp Send Option
  const handleWhatsAppSend = (act: PendingActivation) => {
    const shopName = profile?.shopName || 'JAM System Pro';
    const portalUrl = `${window.location.origin}/portal?store=${activeStoreId}`;
    const appLink = appConfig?.customerAppLink || portalUrl;
    
    const message = `👑 مرحباً بك يا ${act.customerName} في VIP النخبة لدى *${shopName}*! 🌟\n\n` +
      `تم تفعيل وتنشيط حساب الزبائن الخاص بك بنجاح.\n\n` +
      `📱 *رقم الهاتف للدخول:* ${act.customerPhone}\n` +
      `🔑 *كلمة المرور البدئية:* ${act.customerPassword || '123456'}\n\n` +
      `🌐 *رابط الدخول المباشر للبوابة:* \n${portalUrl}\n\n` +
      `📥 *تطبيق الزبائن:* \n${appLink}\n\n` +
      `يسرنا انضمامك للنخبة لمتابعة كشوفات حسابك، الفواتير، والطلبات فورياً!`;
    
    let clean = act.customerPhone.replace(/\D/g, '');
    if (!clean.startsWith('967') && clean.length === 9) {
      clean = '967' + clean;
    }
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // 3. Copy Details Option
  const handleCopyCredentials = (act: PendingActivation) => {
    const shopName = profile?.shopName || 'JAM System Pro';
    const portalUrl = `${window.location.origin}/portal?store=${activeStoreId}`;
    const text = `👑 بيانات تفعيل VIP لدى ${shopName}:\nالاسم: ${act.customerName}\nالهاتف: ${act.customerPhone}\nكلمة المرور: ${act.customerPassword || '123456'}\nرابط الدخول: ${portalUrl}`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // 4. SMS Send Option
  const handleSMSSend = async (act: PendingActivation) => {
    try {
      const portalUrl = `${window.location.origin}/portal?store=${activeStoreId}`;
      const smsBody = `تم تفعيل حسابك VIP بنجاح لدى ${profile?.shopName || 'المحل'}. هاتف: ${act.customerPhone} كلمة المرور: ${act.customerPassword || '123456'}. رابط: ${portalUrl}`;
      await sendSystemSMS(act.customerPhone, smsBody, act.customerName);
      alert(`👑 تم إرسال إشعار التفعيل الملكي وكلمة المرور ورابط التطبيق كرسالة نصية SMS إلى الجوال: ${act.customerPhone} بنجاح!`);
    } catch (err: any) {
      console.error(err);
      alert(`فشل إرسال الـ SMS: ${err.message || err}`);
    }
  };

  // Handle activation removal/delete
  const handleDeleteActivation = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا الرمز التفعيلي؟')) return;
    try {
      if (id && id.startsWith('local_act_')) {
        setLocalActivations(prev => prev.filter(la => la.id !== id));
      } else {
        await deleteDoc(doc(db, 'pending_activations', id));
      }
    } catch (err: any) {
      alert('خطأ أثناء حذف الرمز: ' + err.message);
    }
  };

  // Handle Code Generation & Account Activation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanPhone = customerPhone.replace(/[\s\-\(\)]/g, '').trim();
    const cleanName = customerName.trim();
    const cleanPass = customerPassword.trim();

    if (!cleanName || !cleanPhone || !cleanPass) {
      setErrorMsg('يرجى تعبئة جميع الحقول بشكل صحيح.');
      return;
    }

    // Check VIP Quota Limits per Subscription Tier
    const tierLimit = profile?.quotas?.maxCustomers || profile?.vipClientsLimit || (
      profile?.planTier === 'royal' ? 5000 :
      profile?.planTier === 'gold' ? 1000 :
      profile?.planTier === 'silver' ? 300 :
      100
    );
    const isSuper = profile?.role === 'superadmin' || (profile as any)?.isSuperAdmin === true;
    
    // Count existing registered/pending VIP clients
    const currentCount = Math.max(activations.length, localActivations.length);
    if (!isSuper && currentCount >= tierLimit) {
      setErrorMsg(`⚠️ لقد وصلت إلى الحد الأقصى لسقف الزبائن المسموح به في باقتك الحالية (${tierLimit} زبون VIP). يرجى الترقية إلى باقة أعلى (الذهبية أو الملكية) لإضافة المزيد من الزبائن.`);
      return;
    }

    setGenerating(true);
    const code = Math.floor(10000000 + Math.random() * 90000000).toString();

    try {
      let finalUidFromApi = `client-auth-disabled-${cleanPhone}`;

      // 1. Parallel API call with short timeout (max 2 seconds) so it never blocks UI
      const apiPromise = fetch('/api/auth/register-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          password: cleanPass,
          name: cleanName,
          storeId: activeStoreId
        }),
        signal: AbortSignal.timeout(2000)
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.uid) finalUidFromApi = data.uid;
      })
      .catch(e => console.warn('Fast API register completed or fallback:', e.message));

      // 2. Direct Firestore writes with strict Store Isolation & Unified Users Identity
      const pendingDocRef = doc(db, 'pending_activations', `${activeStoreId}_${cleanPhone}`);
      const userDocRef = doc(db, 'users', cleanPhone);

      const pendingData = {
        id: `${activeStoreId}_${cleanPhone}`,
        code,
        customerName: cleanName,
        customerPhone: cleanPhone,
        customerPassword: cleanPass,
        storeId: activeStoreId,
        ownerId: profile?.ownerId || activeStoreId,
        isUsed: false,
        uid: finalUidFromApi,
        createdAt: serverTimestamp()
      };

      // Customer document for store isolated subcollection & local store engine
      const customerData: Partial<Customer> = {
        id: `cust_${activeStoreId}_${cleanPhone}`,
        ownerId: activeStoreId,
        shopId: activeStoreId,
        name: cleanName,
        phone: cleanPhone,
        portalPassword: cleanPass,
        status: 'active',
        tier: 'عميل VIP 👑',
        businessTier: 'individual',
        allowCredit: true,
        debt: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store subcollection document (Multi-tenant isolated)
      const storeSubDocRef = doc(db, 'stores', activeStoreId, 'customers', `cust_${activeStoreId}_${cleanPhone}`);

      // Execute database writes with multi-tenant store isolation (No duplicate collections)
      await Promise.allSettled([
        apiPromise,
        setDoc(pendingDocRef, pendingData, { merge: true }),
        setDoc(storeSubDocRef, {
          ...customerData,
          storeId: activeStoreId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true }),
        setDoc(userDocRef, {
          userId: cleanPhone,
          uid: cleanPhone,
          phone: cleanPhone,
          name: cleanName,
          password: cleanPass,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          associatedStores: [activeStoreId],
          linkedStores: [activeStoreId],
          primaryStoreId: activeStoreId,
          updatedAt: serverTimestamp()
        }, { merge: true }),
        unifiedOfflineStoreEngine.saveCustomerLocal(customerData as Customer, true)
      ]);

      // Construct activation object for immediate display
      const newActivation: PendingActivation = {
        id: `${activeStoreId}_${cleanPhone}`,
        code,
        customerName: cleanName,
        customerPhone: cleanPhone,
        customerPassword: cleanPass,
        storeId: activeStoreId,
        isUsed: false,
        createdAt: { toDate: () => new Date() }
      };

      // Optimistically update list
      setActivations(prev => [newActivation, ...prev.filter(p => p.customerPhone !== cleanPhone)]);
      
      // Save local backup copy
      setLocalActivations(prev => [newActivation, ...prev.filter(p => p.customerPhone !== cleanPhone)]);

      // Trigger instant confetti
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#d4af37', '#10b981', '#f59e0b', '#3b82f6']
        });
      } catch (e) {}

      // Reset form immediately
      setCustomerName('');
      setCustomerPhone('');
      setCustomerPassword(generateRandomPassword());
      setGenerating(false);

      // Open Instant VIP Ticket modal for immediate WhatsApp send / Print
      setActiveTicketModal(newActivation);

    } catch (err: any) {
      console.error('Generation error:', err);
      setErrorMsg(`خطأ أثناء توليد الحساب: ${err.message || err}`);
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
      {/* Overlay Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
      />

      {/* Main Luxury Modal Content */}
      <motion.div 
        initial={{ scale: 0.9, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 30, opacity: 0 }}
        className="bg-gradient-to-b from-slate-900 to-navy-950 border border-royal-gold/30 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh] text-right"
        dir="rtl"
      >
        {/* Shimmer layout effects */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-royal-gold/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-royal-gold/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-royal-gold to-amber-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-[0_0_15px_rgba(214,175,55,0.3)]">
              <Crown size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2 flex-wrap">
                <span>بوابة اشتراكات الزبائن VIP النخبة</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-black animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  ID المزامنة متصل 🔐
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg font-black">
                  سقف الباقة: {profile?.quotas?.maxCustomers || profile?.vipClientsLimit || (profile?.planTier === 'royal' ? 5000 : profile?.planTier === 'gold' ? 1000 : profile?.planTier === 'silver' ? 300 : 100)} زبون VIP
                </span>
              </h2>
              <p className="text-xs text-amber-100/60 font-bold">
                توليد كرت التفعيل وصياغة أكواد التحقق السحابية الثابتة للتطبيق المستقل
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl flex items-center justify-center border border-white/5 transition-all outline-none cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable contents */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
          
          {/* Active Error and Success Displays */}
          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pulse">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form to enter customer details & generate code */}
          <form onSubmit={handleGenerate} className="bg-white/5 rounded-[2rem] p-6 border border-white/5 space-y-6">
            <h3 className="text-sm font-black text-royal-gold flex items-center gap-2 border-b border-white/5 pb-2">
              <User size={16} />
              تسجيل رمز وتفعيل فوري لعميل جديد [VIP]
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 col-span-1 md:col-span-3">
              {/* Customer Name */}
              <div className="space-y-2">
                <label className="text-xs font-black text-amber-100/70 block">اسم الزبون الفعلي</label>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 text-royal-gold/60" size={18} />
                  <input
                    required
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: يحيى بن أحمد الهاشمي"
                    className="w-full h-12 pr-12 pl-4 bg-black/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-royal-gold focus:ring-1 focus:ring-royal-gold/50 transition-all text-right"
                  />
                </div>
              </div>

              {/* Customer Phone */}
              <div className="space-y-2">
                <label className="text-xs font-black text-amber-100/70 block">رقم هاتف الزبون الذكي</label>
                <div className="relative">
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-royal-gold/60" size={18} />
                  <input
                    required
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="مثال: 777503191"
                    className="w-full h-12 pr-12 pl-4 bg-black/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-royal-gold focus:ring-1 focus:ring-royal-gold/50 transition-all text-right font-mono"
                  />
                </div>
              </div>

              {/* Customer Password */}
              <div className="space-y-2">
                <label className="text-xs font-black text-amber-100/70 block">كلمة المرور البدئية</label>
                <div className="relative">
                  <Key className="absolute right-4 top-1/2 -translate-y-1/2 text-royal-gold/60" size={18} />
                  <input
                    required
                    type="text"
                    value={customerPassword}
                    onChange={(e) => setCustomerPassword(e.target.value)}
                    placeholder="مثال: 123456"
                    className="w-full h-12 pr-12 pl-4 bg-black/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-royal-gold focus:ring-1 focus:ring-royal-gold/50 transition-all text-right font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              disabled={generating}
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-royal-gold via-amber-400 to-yellow-500 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 hover:from-amber-400 hover:to-yellow-300 transition-all shadow-lg hover:shadow-royal-gold/30 disabled:opacity-50 cursor-pointer text-sm"
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin text-slate-950" size={18} />
                  جاري تنشيط الحساب وتوليد السند فورياً...
                </>
              ) : (
                <>
                  <Crown size={20} className="text-slate-950" />
                  <span>تنشيط وتفعيل حساب الزبون وعرض كرت الاشتراك فوراً ⚡</span>
                </>
              )}
            </button>
          </form>

          {/* Active/Pending Activation Logs Table */}
          <div className="space-y-4">
            {(() => {
              const combinedActivations = [
                ...localActivations,
                ...activations.filter(act => !localActivations.some(la => la.customerPhone === act.customerPhone || la.code === act.code))
              ];
              return (
                <>
                  <h3 className="text-sm font-black text-white flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="flex items-center gap-2">
                      <Key size={16} className="text-royal-gold" />
                      حسابات الزبائن VIP المفعلة والجاهزة للدخول المباشر
                    </span>
                    <span className="text-[10px] bg-royal-gold/10 text-royal-gold px-2 py-0.5 rounded-lg font-black">
                      {combinedActivations.length} حساب زبون
                    </span>
                  </h3>

                  {loading && activations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <Loader2 className="animate-spin text-royal-gold mb-2" size={24} />
                      <span className="text-xs font-black">جاري سحب بيانات الحسابات...</span>
                    </div>
                  ) : combinedActivations.length === 0 ? (
                    <div className="text-center py-12 bg-white/5 border border-white/5 border-dashed rounded-[2rem] text-gray-500 text-xs">
                      لا توجد حسابات زبائن VIP مسجلة حالياً.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {combinedActivations.map((act) => (
                        <div 
                          key={act.id} 
                          className="p-4 sm:p-5 bg-white/5 border border-white/5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/10 transition-all group"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {act.id.startsWith('local_act_') ? (
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" title="حساب محلي احتياطي" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-royal-gold animate-pulse" />
                              )}
                              <h4 className="font-extrabold text-white text-sm flex items-center gap-2 flex-wrap">
                                <span>{act.customerName}</span>
                                {act.id.startsWith('local_act_') && <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 px-1 border border-amber-400/20 rounded">(محلي سريع)</span>}
                              </h4>
                              {/* 🔒 Reset Mobile Fingerprint utility link */}
                              <div className="pt-1 pb-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleResetCustomerFingerprint(act)}
                                  disabled={resetState[act.id] === 'loading'}
                                  className={`text-[9px] font-black flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all active:scale-95 cursor-pointer ${
                                    resetState[act.id] === 'loading'
                                      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 animate-pulse'
                                      : resetState[act.id] === 'success'
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-black'
                                      : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 hover:border-rose-500/30 text-rose-400 hover:text-rose-300'
                                  }`}
                                >
                                  <Smartphone size={10} className={resetState[act.id] === 'loading' ? 'animate-spin' : ''} />
                                  <span>
                                    {resetState[act.id] === 'loading'
                                      ? 'جاري إعادة التعيين...'
                                      : resetState[act.id] === 'success'
                                      ? '⚡ تم تصفير البصمة بنجاح!'
                                      : 'إعادة تعيين بصمة الجوال'}
                                  </span>
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-4 text-xs font-bold font-mono">
                              <span className="text-gray-400">هاتف: {act.customerPhone}</span>
                              <span className="text-[#d4af37]">مرور: {act.customerPassword || '123456'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold pl-4">
                              <Clock size={12} />
                              <span>منذ {act.createdAt?.toDate ? act.createdAt.toDate().toLocaleTimeString('ar-YE') : 'الآن'}</span>
                              <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.2 rounded-md font-black text-[9px]">نشط 100%</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                            {/* View Ticket Card */}
                            <button
                              type="button"
                              onClick={() => setActiveTicketModal(act)}
                              title="عرض كرت وسند التفعيل"
                              className="px-3 py-2 bg-gradient-to-r from-royal-gold/20 to-amber-500/20 hover:from-royal-gold/30 hover:to-amber-500/30 text-royal-gold border border-royal-gold/30 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Crown size={14} />
                              <span>عرض السند 👑</span>
                            </button>

                            {/* WhatsApp Direct */}
                            <button 
                              type="button"
                              onClick={() => handleWhatsAppSend(act)}
                              title="إرسال عبر WhatsApp"
                              className="w-9 h-9 bg-[#25d366]/15 hover:bg-[#25d366]/30 text-[#25d366] rounded-xl flex items-center justify-center border border-[#25d366]/30 transition-all outline-none cursor-pointer"
                            >
                              <MessageSquare size={15} />
                            </button>

                            {/* Printing Action */}
                            <button 
                              type="button"
                              onClick={() => handlePrintTicket(act)}
                              title="طباعة تذكرة التفعيل"
                              className="w-9 h-9 bg-white/10 hover:bg-white/20 text-amber-100 hover:text-white rounded-xl flex items-center justify-center border border-white/10 transition-all outline-none cursor-pointer"
                            >
                              <Printer size={15} />
                            </button>

                            {/* Delete Code */}
                            <button 
                              type="button"
                              onClick={() => handleDeleteActivation(act.id)}
                              title="إلغاء وحذف الكود"
                              className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center border border-red-500/20 transition-all outline-none cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </motion.div>

      {/* 👑 INSTANT VIP TICKET / RECEIPT MODAL 👑 */}
      <AnimatePresence>
        {activeTicketModal && (
          <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveTicketModal(null)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              className="bg-gradient-to-b from-slate-900 via-navy-950 to-slate-950 border-2 border-royal-gold rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(214,175,55,0.25)] relative z-20 flex flex-col text-right"
              dir="rtl"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-royal-gold/20 via-amber-500/10 to-transparent border-b border-royal-gold/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-royal-gold to-amber-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shadow-royal-gold/20 font-black">
                    <Crown size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-1.5">
                      <span>سند تفعيل اشتراك زبون VIP</span>
                      <Sparkles size={16} className="text-royal-gold" />
                    </h3>
                    <p className="text-xs text-amber-200/80 font-bold">
                      {profile?.shopName || 'JAM System Pro'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTicketModal(null)}
                  className="w-9 h-9 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl flex items-center justify-center border border-white/10 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Ticket Card Content */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Status Callout */}
                <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-center gap-2 text-emerald-400 text-xs font-black">
                  <ShieldCheck size={18} />
                  <span>تم التفعيل والتنشيط بنجاح - الحساب جاهز للدخول المباشر 100%</span>
                </div>

                {/* Account Details Box */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between py-1 border-b border-white/5 text-sm">
                    <span className="text-gray-400 font-bold">اسم العميل VIP:</span>
                    <span className="text-white font-black text-base">{activeTicketModal.customerName}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-white/5 text-sm">
                    <span className="text-gray-400 font-bold">رقم الهاتف للدخول:</span>
                    <span className="text-amber-300 font-mono font-black text-base direction-ltr">{activeTicketModal.customerPhone}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 text-sm">
                    <span className="text-gray-400 font-bold">كلمة المرور البدئية:</span>
                    <span className="text-emerald-400 font-mono font-black text-base">{activeTicketModal.customerPassword || '123456'}</span>
                  </div>
                </div>

                {/* Direct Action Buttons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* WhatsApp Send Button */}
                  <button
                    type="button"
                    onClick={() => handleWhatsAppSend(activeTicketModal)}
                    className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer text-sm active:scale-95"
                  >
                    <MessageSquare size={18} />
                    <span>إرسال بالواتساب فوراً 💬</span>
                  </button>

                  {/* Print Button */}
                  <button
                    type="button"
                    onClick={() => handlePrintTicket(activeTicketModal)}
                    className="py-3.5 px-4 bg-gradient-to-r from-royal-gold to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-royal-gold/20 transition-all cursor-pointer text-sm active:scale-95"
                  >
                    <Printer size={18} />
                    <span>طباعة السند 🖨️</span>
                  </button>

                  {/* Copy Credentials Button */}
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(activeTicketModal)}
                    className="py-3 px-4 bg-white/10 hover:bg-white/15 text-white font-bold rounded-2xl flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer text-xs active:scale-95"
                  >
                    {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    <span>{copied ? 'تم النسخ للحافظة بنجاح!' : 'نسخ بيانات الدخول 📋'}</span>
                  </button>

                  {/* SMS Button */}
                  <button
                    type="button"
                    onClick={() => handleSMSSend(activeTicketModal)}
                    className="py-3 px-4 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 font-bold rounded-2xl flex items-center justify-center gap-2 border border-sky-500/30 transition-all cursor-pointer text-xs active:scale-95"
                  >
                    <Smartphone size={16} />
                    <span>إرسال رسالة SMS 📱</span>
                  </button>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setActiveTicketModal(null)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-2xl font-bold text-xs transition-all cursor-pointer"
                >
                  إغلاق السند والعودة للقائمة ✕
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
