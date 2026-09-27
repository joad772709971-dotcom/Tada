import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { KeyRound, ShieldCheck, X, Plus, Trash2, AlertCircle, RefreshCw, Sparkles, ShieldAlert, CheckCircle, Shield } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp, getDocs, addDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

interface GlobalB2bFloatingKeyProps {
  profile: UserProfile | null;
}

interface B2BPermissionVault {
  can_pay_cash: boolean;
  can_pay_credit: boolean;
  can_pay_jam: boolean;
  can_pay_transfer: boolean;
  is_blocked: boolean;
}

const isAllowedToManageB2B = (profile: UserProfile | null): boolean => {
  if (!profile) return false;
  const email = (profile.email || '').toLowerCase().trim();
  const role = (profile.role || '').toLowerCase();
  const businessType = (profile.businessType || '').toLowerCase();
  const status = (profile.status || '').toLowerCase();
  const rank = (profile.rank || '').toLowerCase();
  const hierarchyLevel = profile.hierarchyLevel;

  // Retail merchants (محلات التجزئة) are completely prohibited
  if (
    role === 'retailer' || 
    role === 'retail' || 
    role === 'customer' || 
    businessType === 'retail' || 
    businessType === 'retailer' || 
    status === 'retail' || 
    status === 'retailer' || 
    rank === 'retail' || 
    rank === 'retailer' || 
    hierarchyLevel === 4
  ) {
    return false;
  }

  // Only Importers (مستورد), Grand-Wholesalers (جملة الجملة), and Wholesalers (جملة) along with authorized manager staff (@jam.com)
  const isImporter = role === 'importer' || businessType === 'importer' || hierarchyLevel === 1 || rank === 'importer';
  const isGrandWholesaler = role === 'master_wholesale' || role === 'mega_wholesale' || businessType === 'master_wholesale' || businessType === 'mega_wholesale' || hierarchyLevel === 2 || rank === 'master_wholesale' || rank === 'mega_wholesale';
  const isWholesaler = role === 'wholesaler' || role === 'wholesale' || role === 'supplier' || role === 'distributor' || businessType === 'wholesale' || businessType === 'wholesaler' || hierarchyLevel === 3 || rank === 'wholesale' || rank === 'wholesaler';
  const isManagerStaff = email.endsWith('@jam.com') || role === 'manager';
  const isSuperOrOwner = role === 'superadmin' || role === 'owner';

  return isImporter || isGrandWholesaler || isWholesaler || isManagerStaff || isSuperOrOwner;
};

const getB2bCodeForUser = (prof: any): string => {
  if (!prof) return '-----';
  if (prof.b2bCode) return prof.b2bCode;
  if (prof.phone && prof.phone.replace(/[^0-9]/g, '').length >= 5) {
    return prof.phone.replace(/[^0-9]/g, '').slice(-5);
  }
  let hash = 0;
  const id = prof.ownerId || prof.uid || 'JAM';
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const code = Math.abs(hash % 90000) + 10000;
  return code.toString();
};

export default function GlobalB2bFloatingKey({ profile }: GlobalB2bFloatingKeyProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const isWholesaler = isAllowedToManageB2B(profile);

  // Listen to window event to open the vault from the Navbar button
  useEffect(() => {
    const handleOpenVault = () => {
      setIsOpen(true);
    };
    window.addEventListener('open-b2b-vault', handleOpenVault);
    return () => window.removeEventListener('open-b2b-vault', handleOpenVault);
  }, []);
  const [activeSubTab, setActiveSubTab] = useState<'connections' | 'generate'>('connections');
  
  // Buyer state
  const [connections, setConnections] = useState<any[]>([]);
  const [searchKey, setSearchKey] = useState('');
  const [revalidateKey, setRevalidateKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);

  // Supplier state
  const [myGlobalKey, setMyGlobalKey] = useState('JAM-B2B');
  const [generatedKeys, setGeneratedKeys] = useState<any[]>([]);
  
  // Custom Key Generator inputs
  const [targetClientName, setTargetClientName] = useState('');
  const [targetBuyerCode, setTargetBuyerCode] = useState('');
  const [canPayCash, setCanPayCash] = useState(true);
  const [canPayCredit, setCanPayCredit] = useState(false);
  const [canPayJam, setCanPayJam] = useState(true);
  const [canPayTransfer, setCanPayTransfer] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  // Advanced B2B Key Generator fields (Task 1)
  const [keyType, setKeyType] = useState<'new_connection' | 'renewal' | 'debt_account'>('new_connection');
  const [keyDuration, setKeyDuration] = useState<'month' | 'year' | 'permanent'>('permanent');
  const [agreeToCreateAccount, setAgreeToCreateAccount] = useState(false);
  const [ceilingLimit, setCeilingLimit] = useState<number>(0);
  const [installmentPlan, setInstallmentPlan] = useState<'none' | 'installments'>('none');
  const [isMultiUse, setIsMultiUse] = useState(false);

  const [loadingKeys, setLoadingKeys] = useState(false);

  // Load Buyer's or Supplier's connections
  useEffect(() => {
    if (!profile?.ownerId) return;

    const q = query(
      collection(db, 'b2bConnections'),
      where(isWholesaler ? 'supplierId' : 'buyerId', '==', profile.ownerId)
    );

    let unsub = () => {};
    try {
      unsub = onSnapshot(q, (snap) => {
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setConnections(list);
        localStorage.setItem(`b2bConnections_${profile.ownerId}`, JSON.stringify(list));
      }, (err) => {
        console.warn("Bypass GlobalB2bFloatingKey connections snapshot error", err);
        const cached = localStorage.getItem(`b2bConnections_${profile.ownerId}`);
        if (cached) setConnections(JSON.parse(cached));
      });
    } catch (e) {
      console.warn("Bypass GlobalB2bFloatingKey connections trigger error", e);
      const cached = localStorage.getItem(`b2bConnections_${profile.ownerId}`);
      if (cached) setConnections(JSON.parse(cached));
    }

    return () => unsub();
  }, [profile?.ownerId, profile?.role]);

  // Load Supplier's generated keys & their own global key
  useEffect(() => {
    if (!profile?.ownerId || !isWholesaler) return;

    // Load supplier b2bKey from user profile
    setMyGlobalKey(profile.b2bKey || 'JAM-B2B');

    const q = query(
      collection(db, 'unifiedB2bKeys'),
      where('supplierId', '==', profile.ownerId)
    );

    let unsub = () => {};
    try {
      unsub = onSnapshot(q, (snap) => {
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setGeneratedKeys(list);
        localStorage.setItem(`unifiedB2bKeys_${profile.ownerId}`, JSON.stringify(list));
      }, (err) => {
        console.warn("Bypass unifiedB2bKeys snapshot error", err);
        const cached = localStorage.getItem(`unifiedB2bKeys_${profile.ownerId}`);
        if (cached) setGeneratedKeys(JSON.parse(cached));
      });
    } catch (e) {
      console.warn("Bypass unifiedB2bKeys trigger error", e);
      const cached = localStorage.getItem(`unifiedB2bKeys_${profile.ownerId}`);
      if (cached) setGeneratedKeys(JSON.parse(cached));
    }

    return () => unsub();
  }, [profile?.ownerId, profile?.role, profile?.b2bKey]);

  useEffect(() => {
    if (keyType === 'debt_account') {
      setCanPayCredit(true);
    }
  }, [keyType]);

  // Handle connecting a B2B supplier key (Retailer view)
  const handleConnectKey = async (keyToUse: string, isRevalidation: boolean = false) => {
    if (!keyToUse.trim() || !profile?.ownerId) return;

    setConnecting(true);
    setKeyError(null);
    setKeySuccess(null);

    const typedKey = keyToUse.trim().toUpperCase();

    try {
      // 1. Check if key is a 5-digit customized key in unifiedB2bKeys
      const unifiedKeyRef = doc(db, 'unifiedB2bKeys', typedKey);
      const unifiedKeySnap = await getDoc(unifiedKeyRef);

      let foundSupplier: any = null;
      let permissions: B2BPermissionVault = {
        can_pay_cash: true,
        can_pay_credit: false,
        can_pay_jam: true,
        can_pay_transfer: true,
        is_blocked: false
      };
      let debtSettings: any = null;
      let finalAccountId: string | null = null;

      if (unifiedKeySnap.exists()) {
        const keyData = unifiedKeySnap.data();

        // Check if key task/type is correct (debt_account keys act as new connection / credit handshake)
        if (isRevalidation) {
          if (keyData.keyType !== 'renewal') {
            setKeyError('عذراً، هذا المفتاح السري مخصص لإنشاء ارتباط جديد فقط، ولا يمكن استخدامه لتجديد صلاحيات ارتباط قائم.');
            setConnecting(false);
            return;
          }
        } else {
          if (keyData.keyType === 'renewal') {
            setKeyError('عذراً، هذا المفتاح مخصص لتجديد وتحديث صلاحيات ارتباط قائم فقط من خلال نافذة خزانة الصلاحيات، وليس لإنشاء ارتباط جديد.');
            setConnecting(false);
            return;
          }
        }

        // Validate Key Expiration (Duration Month/Year/Permanent)
        const createdAtVal = keyData.createdAt?.toDate?.() || new Date(keyData.createdAt);
        const diffMs = Date.now() - createdAtVal.getTime();

        if (keyData.duration === 'month' && diffMs > 30 * 24 * 60 * 60 * 1000) {
          setKeyError('عذراً، انتهت صلاحية هذا المفتاح السري المحددة بـ (شهر واحد فقط) من تاريخ إصداره.');
          setConnecting(false);
          return;
        }
        if (keyData.duration === 'year' && diffMs > 365 * 24 * 60 * 60 * 1000) {
          setKeyError('عذراً، انتهت صلاحية هذا المفتاح السري المحددة بـ (سنة واحدة فقط) من تاريخ إصداره.');
          setConnecting(false);
          return;
        }

        // Check if key is used and restricted to single binding
        if (!keyData.isMultiUse && keyData.isUsed && keyData.boundToBuyerId && keyData.boundToBuyerId !== profile.ownerId) {
          setKeyError('عذراً، هذا المفتاح تم استخدامه وربطه بحساب تاجر آخر بالفعل ولا يمكن تكراره.');
          setConnecting(false);
          return;
        }

        // Check if key is targeted/bound to a specific 5-digit buyer code
        if (!keyData.isMultiUse && keyData.targetBuyerCode) {
          const rCode = getB2bCodeForUser(profile);
          if (keyData.targetBuyerCode !== rCode) {
            setKeyError(`عذراً، هذا المفتاح مخصص لعميل ذو رمز خاص مختلف (${keyData.targetBuyerCode}). رمز متجرك الحالي هو ${rCode}.`);
            setConnecting(false);
            return;
          }
        }

        foundSupplier = {
          id: keyData.supplierId,
          name: keyData.supplierName,
          b2bKey: typedKey
        };

        if (keyData.debtSettings) {
          debtSettings = keyData.debtSettings;
        }

        if (keyData.permissions) {
          permissions = { ...keyData.permissions };
          if (permissions.can_pay_transfer === undefined) {
            permissions.can_pay_transfer = keyData.allowedPayments?.includes('transfer') || false;
          }
        } else {
          // Fallback parsing allowed payments
          const allowed = keyData.allowedPayments || [];
          permissions = {
            can_pay_cash: allowed.includes('cash'),
            can_pay_credit: allowed.includes('deferred'),
            can_pay_jam: allowed.includes('jampay'),
            can_pay_transfer: allowed.includes('transfer'),
            is_blocked: false
          };
        }

        // Handle Instant Credit Account Generation/activation
        if (keyData.keyType === 'debt_account' && keyData.accountId) {
          const accRef = doc(db, 'accounts', keyData.accountId);
          const accSnap = await getDoc(accRef);
          if (accSnap.exists()) {
            const accData = accSnap.data();
            // If already claimed by another buyer (i.e. multi-use key), clone a new one for this buyer
            if (accData.status === 'active' && accData.activatedByBuyerId !== profile.ownerId) {
              const newAccNum = `ACC-B2B-${typedKey}-${profile.ownerId.slice(0, 4).toUpperCase()}`;
              const newAccRef = await addDoc(collection(db, 'accounts'), {
                ownerId: keyData.supplierId,
                accountNumber: newAccNum,
                accountName: `حساب العميل الآجل: ${profile.ownerId} - (${profile.name || 'مفعل'})`,
                type: 'receivable',
                balance: 0,
                currency: 'YER',
                b2bKey: typedKey,
                status: 'active',
                activatedByBuyerId: profile.ownerId,
                activatedByBuyerName: profile.name || 'تاجر تجزئة',
                createdAt: serverTimestamp()
              });
              finalAccountId = newAccRef.id;
            } else {
              // Update pre-created temporary account to Mohamed's verified entity ID
              await updateDoc(accRef, {
                accountName: `حساب العميل الآجل: ${profile.ownerId} - (${profile.name || 'مفعل'})`,
                status: 'active',
                activatedAt: serverTimestamp(),
                activatedByBuyerId: profile.ownerId,
                activatedByBuyerName: profile.name || 'تاجر تجزئة'
              });
              finalAccountId = keyData.accountId;
            }
          }
        }

        // Mark key as used once to ensure single-use binding
        if (!keyData.isMultiUse) {
          await updateDoc(unifiedKeyRef, {
            isUsed: true,
            boundToBuyerId: profile.ownerId,
            boundToBuyerName: profile.name || 'تاجر تجزئة',
            usedAt: serverTimestamp()
          });
        } else {
          await updateDoc(unifiedKeyRef, {
            isUsed: true,
            [`usedBy_${profile.ownerId}`]: true,
            usedAt: serverTimestamp()
          });
        }

      } else {
        // Try query legacy b2bKey in users collection
        const qUsers = query(collection(db, 'users'), where('b2bKey', '==', typedKey));
        const usersSnap = await getDocs(qUsers);

        if (!usersSnap.empty) {
          const supDoc = usersSnap.docs[0];
          const supData = supDoc.data();
          foundSupplier = {
            id: supData.ownerId || supDoc.id,
            name: supData.shopName || supData.name,
            b2bKey: typedKey
          };
        }
      }

      if (!foundSupplier) {
        setKeyError('عذراً، لم نتمكن من العثور على أي مورد مسجل بهذا المفتاح.');
        setConnecting(false);
        return;
      }

      // 2. Establish connection or update existing permissions
      const connId = `${profile.ownerId}_${foundSupplier.id}`;
      const connRef = doc(db, 'b2bConnections', connId);
      const connSnap = await getDoc(connRef);

      if (isRevalidation && !connSnap.exists()) {
        setKeyError('عذراً، لا يوجد ارتباط سابق مسجل مع هذا المورد لتجديد صلاحياته. يرجى استخدام مفتاح ارتباط جديد للربط لأول مرة.');
        setConnecting(false);
        return;
      }

      const connData = {
        id: connId,
        buyerId: profile.ownerId,
        buyerName: profile.name || 'تاجر تجزئة',
        buyerPhone: profile.phone || '',
        supplierId: foundSupplier.id,
        supplierName: foundSupplier.name,
        supplierKey: typedKey,
        status: permissions.is_blocked ? 'blocked' : 'active',
        permissions: permissions,
        debtSettings: debtSettings || null,
        accountId: finalAccountId || null,
        allowedPayments: [
          ...(permissions.can_pay_cash ? ['cash'] : []),
          ...(permissions.can_pay_credit ? ['deferred'] : []),
          ...(permissions.can_pay_transfer ? ['transfer'] : []),
          ...(permissions.can_pay_jam ? ['jampay'] : [])
        ],
        updatedAt: serverTimestamp()
      };

      if (!connSnap.exists()) {
        await setDoc(connRef, {
          ...connData,
          connectedAt: serverTimestamp(),
          receivableBalance: 2500000,
          payableBalance: 1281100,
          wsSynced: true
        });

        // Ensure the wholesaler is in the standard 'suppliers' accounts of the buyer
        const supCheckQuery = query(
          collection(db, 'suppliers'),
          where('ownerId', '==', profile.ownerId),
          where('b2bSupplierId', '==', foundSupplier.id)
        );
        const supCheckSnap = await getDocs(supCheckQuery);
        if (supCheckSnap.empty) {
          await addDoc(collection(db, 'suppliers'), {
            name: foundSupplier.name,
            phone: foundSupplier.phone || '0000000',
            address: 'ارتباط موحد B2B',
            debt: 0,
            b2bSupplierId: foundSupplier.id,
            ownerId: profile.ownerId,
            createdAt: serverTimestamp()
          });
        }

        // Also write to networkLinks so B2B orders/life-cycles can check linkKey correctly!
        const linkId = `${profile.ownerId}_${foundSupplier.id}`;
        const linkRef = doc(db, 'networkLinks', linkId);
        await setDoc(linkRef, {
          id: linkId,
          wholesalerId: foundSupplier.id,
          wholesalerName: foundSupplier.name,
          retailerId: profile.ownerId,
          retailerName: profile.name || profile.shopName || 'تاجر تجزئة',
          linkKey: typedKey, // critical for b2bLifecycleService!
          status: permissions.is_blocked ? 'blocked' : 'active',
          type: permissions.can_pay_credit ? 'deferred' : 'cash_only',
          accountId: finalAccountId || null,
          updatedAt: serverTimestamp()
        }, { merge: true });

        setKeySuccess(isRevalidation ? 'تم تجديد الصلاحيات وإعادة التحقق بنجاح!' : 'تم الربط وبث الاتصال مع المورد بنجاح فوري!');
      } else {
        // Update permissions on existing connection
        await updateDoc(connRef, {
          permissions: permissions,
          status: permissions.is_blocked ? 'blocked' : 'active',
          debtSettings: debtSettings || null,
          allowedPayments: connData.allowedPayments,
          supplierKey: typedKey,
          accountId: finalAccountId || null,
          updatedAt: serverTimestamp()
        });

        // Also update networkLinks
        const linkId = `${profile.ownerId}_${foundSupplier.id}`;
        const linkRef = doc(db, 'networkLinks', linkId);
        await setDoc(linkRef, {
          linkKey: typedKey,
          status: permissions.is_blocked ? 'blocked' : 'active',
          type: permissions.can_pay_credit ? 'deferred' : 'cash_only',
          accountId: finalAccountId || null,
          updatedAt: serverTimestamp()
        }, { merge: true });

        setKeySuccess('تم تحديث وتجديد صلاحيات الارتباط من خزانة الصلاحيات بنجاح!');
      }

      // Automatically open the supplier's catalog in the market page
      if (!isRevalidation && foundSupplier && foundSupplier.id) {
        setTimeout(() => {
          setIsOpen(false);
          navigate('/market');
          // Dispatch a delay-free custom event to notify MarketUI to open this wholesaler's catalog
          window.dispatchEvent(new CustomEvent('b2b-connection-established', { detail: { supplierId: foundSupplier.id } }));
        }, 1200);
      }

      if (isRevalidation) {
        setRevalidateKey('');
      } else {
        setSearchKey('');
      }

    } catch (err: any) {
      console.error(err);
      setKeyError(`خطأ في تكوين الارتباط: ${err.message}`);
    } finally {
      setConnecting(false);
    }
  };

  // Generate customized key (Supplier view)
  const handleGenerateCustomKey = async () => {
    if (!profile?.ownerId) return;
    if (!isWholesaler) {
      setKeyError('عذراً، حساب التجزئة غير مصرح له بتوليد مفاتيح الارتباط.');
      return;
    }
    
    setConnecting(true);
    setKeyError(null);
    setKeySuccess(null);

    try {
      // Generate unique 5-digit numeric key
      let randomKey = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        randomKey = Math.floor(10000 + Math.random() * 90000).toString();
        const checkSnap = await getDoc(doc(db, 'unifiedB2bKeys', randomKey));
        if (!checkSnap.exists()) {
          isUnique = true;
        }
        attempts++;
      }

      const permissions: B2BPermissionVault = {
        can_pay_cash: canPayCash,
        can_pay_credit: canPayCredit,
        can_pay_jam: canPayJam,
        can_pay_transfer: canPayTransfer,
        is_blocked: isBlocked
      };

      const debtSettings = canPayCredit ? {
        agreeToCreateAccount,
        ceilingLimit: Number(ceilingLimit) || 0,
        installmentPlan
      } : null;

      // Create an immediate temporary ledger account if Key Type is "حساب دين"
      let tempAccountId = '';
      if (keyType === 'debt_account') {
        const accNum = `ACC-B2B-${randomKey}`;
        const tempAccRef = await addDoc(collection(db, 'accounts'), {
          ownerId: profile.ownerId,
          accountNumber: accNum,
          accountName: `حساب دين آجل معلق - مفتاح #${randomKey}`,
          type: 'receivable',
          balance: 0,
          currency: 'YER',
          b2bKey: randomKey,
          status: 'temporary',
          createdAt: serverTimestamp()
        });
        tempAccountId = tempAccRef.id;
      }

      let finalClientName = targetClientName.trim();
      if (isMultiUse) {
        finalClientName = finalClientName || 'عميل غير مخصص / متعدد الاستخدام';
      }

      await setDoc(doc(db, 'unifiedB2bKeys', randomKey), {
        b2bKey: randomKey,
        supplierId: profile.ownerId,
        supplierName: profile.shopName || profile.name || 'مستورد معتمد',
        clientName: finalClientName || 'عميل مخصص',
        targetBuyerCode: isMultiUse ? null : (targetBuyerCode.trim() || null),
        keyType,
        duration: keyDuration,
        permissions: permissions,
        debtSettings: debtSettings,
        isMultiUse,
        accountId: tempAccountId || null,
        allowedPayments: [
          ...(canPayCash ? ['cash'] : []),
          ...(canPayCredit ? ['deferred'] : []),
          ...(canPayJam ? ['jampay'] : []),
          ...(canPayTransfer ? ['transfer'] : [])
        ],
        isUsed: false,
        createdAt: serverTimestamp()
      });

      setKeySuccess(`تم توليد مفتاح مخصص للعميل بنجاح: #${randomKey}`);
      setTargetClientName('');
      setTargetBuyerCode('');
      // Reset forms
      setCanPayCash(true);
      setCanPayCredit(false);
      setCanPayJam(true);
      setCanPayTransfer(true);
      setIsBlocked(false);
      setAgreeToCreateAccount(false);
      setCeilingLimit(0);
      setInstallmentPlan('none');
      setKeyType('new_connection');
      setKeyDuration('permanent');
      setIsMultiUse(false);

    } catch (err: any) {
      console.error(err);
      setKeyError(`فشل توليد المفتاح: ${err.message}`);
    } finally {
      setConnecting(false);
    }
  };

  // Delete customized key (Supplier view)
  const handleDeleteKey = async (keyId: string) => {
    if (!window.confirm('هل تريد حذف وإلغاء صلاحية هذا المفتاح السري نهائياً؟')) return;
    try {
      await deleteDoc(doc(db, 'unifiedB2bKeys', keyId));
      setKeySuccess('تم حذف وتصفية المفتاح بنجاح.');
    } catch (err: any) {
      alert(`خطأ في حذف المفتاح: ${err.message}`);
    }
  };

  // Sever B2B Connection completely on supplier's blocking command (Tenant Isolation)
  const handleSeverConnection = async (connId: string, name: string, supplierKey?: string) => {
    if (!window.confirm(`تنبيه أمني: هل تريد قطع وحظر الاتصال نهائياً بـ (${name})؟ سيتم حذف المفتاح والصلاحيات فوراً وبشكل متبادل من كلا الحسابين لتأمين خصوصية البيانات.`)) return;

    try {
      // 1. Delete connection document
      await deleteDoc(doc(db, 'b2bConnections', connId));

      // 2. Delete key document from unifiedB2bKeys
      if (supplierKey) {
        await deleteDoc(doc(db, 'unifiedB2bKeys', supplierKey.toUpperCase()));
      }

      alert('تم قطع الارتباط وحذف المفتاح وتأمين خصوصية البيانات بنجاح.');
    } catch (err: any) {
      alert(`خطأ في قطع الارتباط: ${err.message}`);
    }
  };

  return (
    <>
      {/* Overlay Modal with Glassmorphism */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md font-sans text-right">
            {/* Modal backdrop closer */}
            <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-lg bg-slate-900/90 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl shadow-amber-500/5 overflow-hidden text-white"
            >
              {/* Background ambient gold gradient lights */}
              <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-44 h-44 bg-yellow-500/10 rounded-full blur-[60px] pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 active:scale-95 text-gray-400 hover:text-white rounded-full transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <KeyRound size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">خزانة الصلاحيات ومفاتيح الارتباط</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">نظام الصلاحيات الذكي وعزل البيانات الموحد</p>
                  </div>
                </div>
              </div>

              {/* Status and Notifications */}
              {keyError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-xl flex items-start gap-2.5 mb-4 animate-shake">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  <p className="leading-snug">{keyError}</p>
                </div>
              )}
              {keySuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-start gap-2.5 mb-4">
                  <CheckCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="leading-snug">{keySuccess}</p>
                </div>
              )}

              {/* Tab Navigation if Wholesaler */}
              {isWholesaler && (
                <div className="flex items-center gap-2 p-1 bg-black/40 rounded-2xl border border-white/5 mb-5 text-xs font-black">
                  <button
                    onClick={() => setActiveSubTab('connections')}
                    className={`flex-1 py-2 text-center rounded-xl transition-all cursor-pointer ${
                      activeSubTab === 'connections' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    ارتباطات العملاء
                  </button>
                  <button
                    onClick={() => setActiveSubTab('generate')}
                    className={`flex-1 py-2 text-center rounded-xl transition-all cursor-pointer ${
                      activeSubTab === 'generate' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    توليد مفاتيح الصلاحيات
                  </button>
                </div>
              )}

              {/* TAB CONTENT */}
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                
                {/* BUYER / RETAILER VIEW */}
                {!isWholesaler && (
                  <div className="space-y-5">
                    {/* B2B Link Field */}
                    <div className="space-y-2 bg-black/35 p-4 rounded-3xl border border-white/5">
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-400" />
                        الارتباط بمورد جديد
                      </h4>
                      <p className="text-[10px] text-gray-400 leading-normal">
                        أدخل مفتاح الارتباط السري (5 أرقام) المستلم من المورد لربط متجرك بكتالوجه وتنشيط الصلاحيات الممنوحة لك.
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleConnectKey(searchKey);
                        }}
                        className="flex items-center gap-2 mt-3"
                      >
                        <button
                          type="submit"
                          disabled={connecting || !searchKey.trim()}
                          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          {connecting ? <RefreshCw className="animate-spin" size={14} /> : 'ربط ومطابقة 🔗'}
                        </button>
                        <input
                          type="text"
                          value={searchKey}
                          onChange={(e) => setSearchKey(e.target.value)}
                          placeholder="مثال: 77218"
                          className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-center font-mono font-bold text-amber-400 placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </form>
                    </div>

                    {/* RE-VALIDATION / RENEWAL MODULE */}
                    <div className="space-y-2 bg-black/35 p-4 rounded-3xl border border-white/5">
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <RefreshCw size={14} className="text-teal-400 animate-spin-slow" />
                        تجديد الصلاحيات وفك القيود
                      </h4>
                      <p className="text-[10px] text-gray-400 leading-normal">
                        هل تواجه قيوداً في الدفع بالآجل أو الحوالات؟ أدخل كود التجديد (Re-validation Key) لتحديث خزانة صلاحياتك وتنشيطها فوراً.
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleConnectKey(revalidateKey, true)}
                          disabled={connecting || !revalidateKey.trim()}
                          className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 font-black text-xs rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          {connecting ? <RefreshCw className="animate-spin" size={14} /> : 'تحديث الصلاحية ⚡'}
                        </button>
                        <input
                          type="text"
                          value={revalidateKey}
                          onChange={(e) => setRevalidateKey(e.target.value)}
                          placeholder="أدخل كود التجديد السري"
                          className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-center font-mono font-bold text-teal-400 placeholder-gray-650 focus:outline-none focus:border-teal-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Active Connections & Permissions Vault */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-black text-gray-400">قناتك النشطة وخزائن الصلاحيات ({connections.length})</h4>
                      {connections.length === 0 ? (
                        <div className="text-center py-6 bg-black/20 rounded-2xl border border-white/5 text-xs text-gray-500 font-bold">
                          لا توجد ارتباطات سحابية نشطة حالياً. استخدم مفتاح ارتباط للبدء.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {connections.map((conn) => {
                            const p = conn.permissions || { can_pay_cash: true, can_pay_credit: false, can_pay_jam: true, is_blocked: false };
                            return (
                              <div key={conn.id} className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${conn.status === 'blocked' || p.is_blocked ? 'bg-red-500/15 text-red-400 border border-red-500/10' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10'}`}>
                                    {conn.status === 'blocked' || p.is_blocked ? 'ارتباط محظور 🛑' : 'ارتباط نشط وموثق 🔗'}
                                  </span>
                                  <h5 className="font-extrabold text-xs text-white">{conn.supplierName}</h5>
                                </div>

                                {/* Permissions Matrix */}
                                <div className="grid grid-cols-4 gap-1 text-[8px] font-black text-center pt-1.5 border-t border-white/5">
                                  <div className={`p-1 rounded-lg border ${p.can_pay_cash ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                    نقد: {p.can_pay_cash ? 'نعم' : 'لا'}
                                  </div>
                                  <div className={`p-1 rounded-lg border ${p.can_pay_credit ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                    آجل: {p.can_pay_credit ? 'نعم' : 'لا'}
                                  </div>
                                  <div className={`p-1 rounded-lg border ${p.can_pay_transfer !== false ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                    حوالة: {p.can_pay_transfer !== false ? 'نعم' : 'لا'}
                                  </div>
                                  <div className={`p-1 rounded-lg border ${p.can_pay_jam ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                    JAM Pay: {p.can_pay_jam ? 'نعم' : 'لا'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUPPLIER VIEW - TAB CONNECTIONS */}
                {isWholesaler && activeSubTab === 'connections' && (
                  <div className="space-y-4">
                    {/* General B2B Key Card */}
                    <div className="p-4 bg-gradient-to-br from-slate-900 to-[#0e1630] border border-white/10 rounded-3xl flex items-center justify-between">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 leading-none">مفتاح كتالوجك العام</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">انسخ وزوّد العملاء الجدد بهذا المفتاح</p>
                      </div>
                      <div className="bg-black/60 px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3">
                        <span className="font-mono text-sm font-black text-amber-500 tracking-wider select-all">{myGlobalKey}</span>
                        <KeyRound size={14} className="text-amber-500" />
                      </div>
                    </div>

                    {/* Active B2B Client Connections */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-gray-400">العملاء النشطون ومنع الارتباط التبادلي ({connections.length})</h4>
                      {connections.length === 0 ? (
                        <div className="text-center py-8 bg-black/20 rounded-2xl border border-white/5 text-xs text-gray-500 font-bold">
                          لم يقم أي عميل بالربط بمفتاحك بعد.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {connections.map((conn) => {
                            const p = conn.permissions || { can_pay_cash: true, can_pay_credit: false, can_pay_jam: true, is_blocked: false };
                            return (
                              <div key={conn.id} className="p-4 bg-black/35 rounded-2xl border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                  <button
                                    onClick={() => handleSeverConnection(conn.id, conn.buyerName, conn.supplierKey)}
                                    className="p-1.5 bg-red-600/10 hover:bg-red-600/25 text-red-400 border border-red-500/10 rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-black"
                                  >
                                    <Trash2 size={12} />
                                    حظر وحذف الارتباط 🔕
                                  </button>
                                  <div className="text-right">
                                    <h5 className="font-extrabold text-xs text-white">{conn.buyerName}</h5>
                                    <span className="text-[9px] text-gray-500 block mt-0.5 font-mono">الهاتف: {conn.buyerPhone || 'بلا رقم'}</span>
                                  </div>
                                </div>

                                {/* Permissions Matrix */}
                                <div className="grid grid-cols-3 gap-1.5 text-[9px] font-black text-center pt-2 border-t border-white/5">
                                  <div className={`p-1 rounded-md border ${p.can_pay_cash ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400' : 'bg-red-500/5 border-red-500/15 text-red-400'}`}>
                                    نقدي: {p.can_pay_cash ? 'مفعّل' : 'محظور'}
                                  </div>
                                  <div className={`p-1 rounded-md border ${p.can_pay_credit ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400' : 'bg-red-500/5 border-red-500/15 text-red-400'}`}>
                                    آجل: {p.can_pay_credit ? 'مفعّل' : 'محظور'}
                                  </div>
                                  <div className={`p-1 rounded-md border ${p.can_pay_jam ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400' : 'bg-red-500/5 border-red-500/15 text-red-400'}`}>
                                    حوالة: {p.can_pay_jam ? 'مفعّل' : 'محظور'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUPPLIER VIEW - TAB GENERATE KEY */}
                {isWholesaler && activeSubTab === 'generate' && (
                  <div className="space-y-4">
                    {/* Key Generator Form */}
                    <div className="p-4 bg-black/45 rounded-3xl border border-white/5 space-y-4 text-right">
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5 border-b border-white/5 pb-2">
                        <Sparkles size={14} className="text-amber-400" />
                        بوابة توليد مفتاح الارتباط الذكية
                      </h4>

                      {/* Client Name */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-gray-400">اسم العميل المستهدف (لتفرد المفتاح)</label>
                        <input
                          type="text"
                          value={targetClientName}
                          onChange={(e) => setTargetClientName(e.target.value)}
                          disabled={isMultiUse}
                          placeholder={isMultiUse ? "مفتاح متعدد الاستخدام وغير مخصص لعميل واحد" : "مثال: بقالة الأمانة، محلات البركة"}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 disabled:opacity-40"
                        />
                      </div>

                      {/* Multi-use toggle */}
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-950/40 p-2.5 rounded-xl border border-white/5 hover:bg-slate-900 transition-colors text-xs">
                        <input
                          type="checkbox"
                          checked={isMultiUse}
                          onChange={(e) => {
                            setIsMultiUse(e.target.checked);
                            if (e.target.checked) {
                              setTargetBuyerCode('');
                            }
                          }}
                          className="rounded border-white/10 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="font-extrabold text-amber-400">توليد مفتاح متعدد الاستخدام (غير مخصص لعميل محدد) ⚙️</span>
                      </label>

                      {/* Target Buyer Code */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-gray-400">كود متجر العميل (الـ 5 أرقام المكتوب في واجهة العميل) - اختياري</label>
                        <input
                          type="text"
                          value={targetBuyerCode}
                          onChange={(e) => setTargetBuyerCode(e.target.value.replace(/[^0-9]/g, ''))}
                          disabled={isMultiUse}
                          placeholder={isMultiUse ? "ملغي للمفاتيح متعددة الاستخدام" : "مثال: 77123"}
                          maxLength={5}
                          className="w-full bg-slate-950 border border-amber-500/20 rounded-xl px-3 py-2 text-xs font-bold text-amber-400 placeholder-gray-600 focus:outline-none focus:border-amber-500 font-mono text-center disabled:opacity-40"
                        />
                      </div>

                      {/* Key Type / Mission */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-gray-400">مهمة المفتاح (نوع العملية)</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setKeyType('new_connection')}
                            className={`py-2 text-[10px] sm:text-xs font-black rounded-lg transition-all border ${
                              keyType === 'new_connection'
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-950 text-gray-400 border-white/5 hover:text-white'
                            }`}
                          >
                            ارتباط جديد 🔗
                          </button>
                          <button
                            type="button"
                            onClick={() => setKeyType('renewal')}
                            className={`py-2 text-[10px] sm:text-xs font-black rounded-lg transition-all border ${
                              keyType === 'renewal'
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-950 text-gray-400 border-white/5 hover:text-white'
                            }`}
                          >
                            تجديد الارتباط 🔄
                          </button>
                          <button
                            type="button"
                            onClick={() => setKeyType('debt_account')}
                            className={`py-2 text-[10px] sm:text-xs font-black rounded-lg transition-all border ${
                              keyType === 'debt_account'
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-950 text-gray-400 border-white/5 hover:text-white'
                            }`}
                          >
                            حساب دين آجل 🧾
                          </button>
                        </div>
                      </div>

                      {/* Duration / Validity */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-gray-400">مدة صلاحية المفتاح</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setKeyDuration('month')}
                            className={`py-1.5 text-xs font-bold rounded-lg transition-all border ${
                              keyDuration === 'month'
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-950 text-gray-400 border-white/5'
                            }`}
                          >
                            شهر واحد
                          </button>
                          <button
                            type="button"
                            onClick={() => setKeyDuration('year')}
                            className={`py-1.5 text-xs font-bold rounded-lg transition-all border ${
                              keyDuration === 'year'
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-950 text-gray-400 border-white/5'
                            }`}
                          >
                            سنة واحدة
                          </button>
                          <button
                            type="button"
                            onClick={() => setKeyDuration('permanent')}
                            className={`py-1.5 text-xs font-bold rounded-lg transition-all border ${
                              keyDuration === 'permanent'
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-950 text-gray-400 border-white/5'
                            }`}
                          >
                            دائم مفتوح
                          </button>
                        </div>
                      </div>

                      {/* Payment Permissions */}
                      <div className="space-y-2 pt-1">
                        <p className="text-[10px] font-black text-gray-400">صلاحيات المفتاح (طرق السداد المسموحة):</p>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2.5 rounded-xl border border-white/5 hover:bg-slate-900 transition-colors">
                            <input
                              type="checkbox"
                              checked={canPayCash}
                              onChange={(e) => setCanPayCash(e.target.checked)}
                              className="rounded border-white/10 text-amber-500 focus:ring-amber-500"
                            />
                            <span>نقد (كاش)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2.5 rounded-xl border border-white/5 hover:bg-slate-900 transition-colors">
                            <input
                              type="checkbox"
                              checked={canPayCredit}
                              onChange={(e) => setCanPayCredit(e.target.checked)}
                              className="rounded border-white/10 text-amber-500 focus:ring-amber-500"
                            />
                            <span>دين (آجل)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2.5 rounded-xl border border-white/5 hover:bg-slate-900 transition-colors">
                            <input
                              type="checkbox"
                              checked={canPayTransfer}
                              onChange={(e) => setCanPayTransfer(e.target.checked)}
                              className="rounded border-white/10 text-amber-500 focus:ring-amber-500"
                            />
                            <span>حوالة مصرفية</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2.5 rounded-xl border border-white/5 hover:bg-slate-900 transition-colors">
                            <input
                              type="checkbox"
                              checked={canPayJam}
                              onChange={(e) => setCanPayJam(e.target.checked)}
                              className="rounded border-white/10 text-amber-500 focus:ring-amber-500"
                            />
                            <span>JAM Pay</span>
                          </label>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2.5 rounded-xl border border-red-500/10 hover:bg-slate-900 transition-colors mt-2 text-xs">
                          <input
                            type="checkbox"
                            checked={isBlocked}
                            onChange={(e) => setIsBlocked(e.target.checked)}
                            className="rounded border-white/10 text-red-500 focus:ring-red-500"
                          />
                          <span className="text-red-400 font-bold">حظر وتجميد الارتباط مؤقتاً</span>
                        </label>
                      </div>

                      {/* Advanced Debt Settings - Only shown if Credit is allowed */}
                      <AnimatePresence>
                        {canPayCredit && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-amber-500/5 border border-amber-500/10 p-3 rounded-2xl space-y-3 mt-2"
                          >
                            <label className="flex items-start gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={agreeToCreateAccount}
                                onChange={(e) => setAgreeToCreateAccount(e.target.checked)}
                                className="mt-0.5 rounded border-amber-500/20 text-amber-500 focus:ring-amber-500"
                              />
                              <span className="text-amber-200 font-medium">هل توافق على إنشاء حساب للعميل مالك المفتاح هذا؟</span>
                            </label>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-amber-400">سقف الائتمان / الحد الأقصى للمديونية (ر.ي)</label>
                              <input
                                type="number"
                                value={ceilingLimit}
                                onChange={(e) => setCeilingLimit(Number(e.target.value))}
                                placeholder="مثال: 500000"
                                className="w-full bg-slate-950 border border-amber-500/20 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-amber-400">خيار نظام التقسيط</label>
                              <select
                                value={installmentPlan}
                                onChange={(e: any) => setInstallmentPlan(e.target.value)}
                                className="w-full bg-slate-950 border border-amber-500/20 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                              >
                                <option value="none">سداد كامل (نظام آجل تقليدي)</option>
                                <option value="installments">نظام أقساط ميسرة مجدولة</option>
                              </select>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        onClick={handleGenerateCustomKey}
                        disabled={connecting || (!isMultiUse && !targetClientName.trim())}
                        className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-black text-xs rounded-xl transition duration-300 shadow-lg shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Plus size={14} />
                        توليد وتصدير المفتاح السري المخصص
                      </button>
                    </div>

                    {/* Active Generated Keys Vault */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-gray-400">المفاتيح المولدة حالياً ({generatedKeys.length})</h4>
                      {generatedKeys.length === 0 ? (
                        <div className="text-center py-6 bg-black/20 rounded-2xl border border-white/5 text-xs text-gray-500 font-bold">
                          لا توجد مفاتيح مخصصة نشطة في خزانة الصلاحيات السحابية.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {generatedKeys.map((k) => (
                            <div key={k.id} className="p-3 bg-black/40 border border-white/5 rounded-2xl flex flex-col gap-2 text-xs">
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => handleDeleteKey(k.id)}
                                  className="p-1 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                                
                                <div className="flex items-center gap-2">
                                  <span className="font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-black tracking-wider text-[11px] select-all">
                                    #{k.b2bKey}
                                  </span>
                                  <span className="text-[10px] text-gray-300 font-black">← {k.clientName}</span>
                                </div>
                              </div>

                              {/* Key configuration details */}
                              <div className="flex flex-wrap items-center justify-end gap-1.5 text-[9px] text-gray-400 font-bold">
                                {k.keyType === 'renewal' ? (
                                  <span className="px-1.5 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded">تجديد الارتباط</span>
                                ) : k.keyType === 'debt_account' ? (
                                  <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">حساب دين آجل</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">ارتباط جديد</span>
                                )}

                                {k.isMultiUse && (
                                  <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">متعدد الاستخدام</span>
                                )}

                                <span className="px-1.5 py-0.5 bg-gray-500/10 text-gray-300 border border-gray-500/20 rounded">
                                  المدة: {k.duration === 'month' ? 'شهر' : k.duration === 'year' ? 'سنة' : 'دائم مفتوح'}
                                </span>

                                {k.permissions?.can_pay_credit && (
                                  <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                    الآجل: مفعّل (سقف {k.debtSettings?.ceilingLimit || 0} ر.ي)
                                  </span>
                                )}

                                {k.permissions?.is_blocked && (
                                  <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded">محظور مؤقتاً</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
