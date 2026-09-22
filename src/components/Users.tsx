import { useState, useEffect } from 'react';
import { Plus, Search, Store, Mail, Lock, User, Phone, MapPin, Loader2, X, ShieldCheck, AlertCircle as AlertIcon, Key, Power, PowerOff, Edit2, Trash2, Check, Users as UsersIcon, UserPlus, Shield, Camera, Upload, Image as ImageIcon, RefreshCw, Printer, Settings } from 'lucide-react';
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, where, getDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, inMemoryPersistence, setPersistence, signInWithEmailAndPassword, updatePassword, signOut } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { uploadToMega } from '../services/megaService';
import { printReceipt } from '../services/printService';
import { getDomainForRole, checkPhoneUniqueness } from '../services/OfflineCore';
import { createResilientUser, updateResilientUserPassword, getSecondaryAuth } from '../services/resilientAuthService';

interface UsersProps {
  profile: UserProfile | null;
}

const secondaryAuth = getSecondaryAuth();

export default function Users({ profile }: UsersProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] = useState(false);
  const [selectedUserForCustom, setSelectedUserForCustom] = useState<UserProfile | null>(null);
  const [customizationData, setCustomizationData] = useState<{ mobilePages: string[], desktopPages: string[] }>({ mobilePages: [], desktopPages: [] });
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<{
    canSeeBuyPrice: boolean;
    canGiveDiscount: boolean;
    canDeleteInvoice: boolean;
    canAccessFinancials: boolean;
    canManageStock: boolean;
    canChangeMaintenanceStatus: boolean;
    canSetRepairPrice: boolean;
    canDeliverDevice: boolean;
    canWithdrawCash: boolean;
    canEditStockQuantities: boolean;
    canDeleteProducts: boolean;
    canImportGoods: boolean;
  }>({
    canSeeBuyPrice: true,
    canGiveDiscount: true,
    canDeleteInvoice: true,
    canAccessFinancials: true,
    canManageStock: true,
    canChangeMaintenanceStatus: true,
    canSetRepairPrice: true,
    canDeliverDevice: true,
    canWithdrawCash: true,
    canEditStockQuantities: true,
    canDeleteProducts: true,
    canImportGoods: true,
  });

  const selectUserForPermissions = (user: UserProfile) => {
    setSelectedUserForCustom(user);
    setCustomizationData({
      mobilePages: user.interfaceCustomization?.mobilePages || [],
      desktopPages: user.interfaceCustomization?.desktopPages || []
    });
    
    const userPerms = (user as any).permissions || {};
    setSelectedUserPermissions({
      canSeeBuyPrice: userPerms.canSeeBuyPrice !== false,
      canGiveDiscount: userPerms.canGiveDiscount !== false,
      canDeleteInvoice: userPerms.canDeleteInvoice !== false,
      canAccessFinancials: userPerms.canAccessFinancials !== false,
      canManageStock: userPerms.canManageStock !== false,
      canChangeMaintenanceStatus: userPerms.canChangeMaintenanceStatus !== false,
      canSetRepairPrice: userPerms.canSetRepairPrice !== false,
      canDeliverDevice: userPerms.canDeliverDevice !== false,
      canWithdrawCash: userPerms.canWithdrawCash !== false,
      canEditStockQuantities: userPerms.canEditStockQuantities !== false,
      canDeleteProducts: userPerms.canDeleteProducts !== false,
      canImportGoods: userPerms.canImportGoods !== false,
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const [activeTab, setActiveTab] = useState<'all' | 'engineer' | 'cashier' | 'delivery' | 'packer'>('all');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'employee' as UserRole,
    password: '',
    paymentType: 'commission' as 'commission' | 'salary',
    commissionRate: '' as string | number,
    salaryAmount: '' as string | number,
    photo: '',
    allowOffline: false,
    offlineLimitHours: 72
  });

  useEffect(() => {
    if (!profile?.ownerId) return;
    
    // Global visibility for users - restricted by ownerId for non-superadmins
    // Fix: Each shop/branch only sees its own employees (Branch-Level Filtering)
    const q = profile.role === 'superadmin' 
      ? query(collection(db, 'users'))
      : (profile.role !== 'owner' && profile.shopId)
        ? query(collection(db, 'users'), where('ownerId', '==', profile.ownerId), where('shopId', '==', profile.shopId))
        : query(collection(db, 'users'), where('ownerId', '==', profile.ownerId));

    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)).filter(u => {
        const role = (u.role || '').toLowerCase();
        return role !== 'customer' && role !== 'owner' && role !== 'superadmin' && role !== 'developer' && u.status !== 'deleted' && u.isDeleted !== true;
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsub();
  }, [profile]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.ownerId) return;

    setIsUploadingPhoto(true);
    try {
      const url = await uploadToMega(file, profile.ownerId, 'employees');
      setFormData(prev => ({ ...prev, photo: url }));
      setStatus({ type: 'success', message: 'تم رفع صورة الموظف بنجاح.' });
    } catch (error: any) {
      setStatus({ type: 'error', message: `فشل رفع الصورة: ${error.message}` });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus(null);

    try {
      if (!editingUser) {
        const quotas = profile?.quotas || { maxEmployees: 5, maxPrepWorkers: 5, maxCustomers: 50 };
        const selectedRole = formData.role;
        const isPrepRole = selectedRole === 'staff';
        
        if (isPrepRole) {
          const currentPrepCount = users.filter(u => u.role === 'staff').length;
          const maxPrep = quotas.maxPrepWorkers || 5;
          if (currentPrepCount >= maxPrep) {
            throw new Error(`عذراً، لقد تجاوزت الحصّة المحددة لتطبيق الجوال (عمال التجهيز) المتاحة وهي: ${maxPrep} حسابات.`);
          }
        } else {
          const currentEmpCount = users.filter(u => u.role !== 'staff').length;
          const maxEmp = quotas.maxEmployees || 5;
          if (currentEmpCount >= maxEmp) {
            throw new Error(`عذراً، لقد تجاوزت الحصّة المحددة لأجهزة الكمبيوتر والمشرفين المتاحة وهي: ${maxEmp} حسابات.`);
          }
        }
      }

      const dataToSave: any = {
        name: formData.name,
        role: formData.role || 'Customer',
        photo: formData.photo || '',
        paymentType: formData.paymentType,
        commissionRate: formData.paymentType === 'commission' ? (Number(formData.commissionRate) / 100 || 0) : 0,
        salaryAmount: formData.paymentType === 'salary' ? (Number(formData.salaryAmount) || 0) : 0,
        allowOffline: formData.allowOffline,
        offlineLimitHours: Number(formData.offlineLimitHours) || 72,
        updatedAt: serverTimestamp()
      };

      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.uid), dataToSave);
        setStatus({ type: 'success', message: 'تم تحديث بيانات المستخدم بنجاح' });
      } else {
        // 1. Create Auth User
        // If it's a phone number (only digits) or username, append the target domain in the background based on their assigned Role
        const cleanPhoneOrEmail = formData.email.trim();
        const isPhone = /^\+?[0-9]{6,15}$/.test(cleanPhoneOrEmail);
        if (isPhone) {
          await checkPhoneUniqueness(cleanPhoneOrEmail);
        }

        const targetDomain = getDomainForRole(formData.role || 'sales');
        const firebaseEmail = cleanPhoneOrEmail.includes('@') ? cleanPhoneOrEmail : `${cleanPhoneOrEmail}${targetDomain}`;
        const authProvision = await createResilientUser(firebaseEmail, formData.password, {
          name: formData.name,
          role: formData.role,
          phone: isPhone ? cleanPhoneOrEmail : '',
          shopName: profile?.shopName || ''
        });
        const uid = authProvision.uid;

        // 2. Create User Profile
        const newUserProfile: any = {
          ...dataToSave,
          uid,
          phone: isPhone ? cleanPhoneOrEmail : '',
          ownerId: profile?.ownerId || '',
          shopId: profile?.shopId || '', // Fix: Save shopId/branchId
          email: firebaseEmail, // Store computed email with @gmail.com
          isProgramUser: true, // Strictly flagged as Program User
          programUserStatus: 'active',
          status: 'active',
          currentPassword: formData.password, // Storing for admin to be able to change it later
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp(),
          shopName: profile?.shopName || '',
          shopPhone: profile?.shopPhone || '',
          shopAddress: profile?.shopAddress || ''
        };
        await setDoc(doc(db, 'users', uid), newUserProfile);
        setStatus({ type: 'success', message: 'تم إنشاء حساب المستخدم بنجاح' });

        // Print receipt immediately after creation
        if (confirm('هل تريد طباعة سند اشتراك للمستخدم الآن؟')) {
          const settingsSnap = await getDoc(doc(db, 'settings', profile?.ownerId || 'general'));
          const settings = settingsSnap.exists() ? settingsSnap.data() : null;
          printReceipt('user_registration', newUserProfile, settings);
        }
      }
      
      setTimeout(() => {
        closeModal();
        setStatus(null);
      }, 1500);
    } catch (error: any) {
      console.error('Error saving user:', error);
      let errorMessage = error.message || 'حدث خطأ أثناء حفظ البيانات';
      if (error.code === 'auth/network-request-failed') {
        errorMessage = 'خطأ في الاتصال بالشبكة. يرجى التأكد من اتصال الإنترنت أو المحاولة من متصفح آخر. قد يكون السبب حظر الطلب من قبل إضافات المتصفح (مثل مانع الإعلانات).';
      }
      setStatus({ type: 'error', message: errorMessage });
      alert('Error: ' + errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (isSubmitting) return;
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا المستخدم نهائياً؟')) return;
    setIsSubmitting(true);
    setStatus(null);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setStatus({ type: 'success', message: 'تم حذف حساب المستخدم بنجاح' });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setStatus({ type: 'error', message: error.message || 'حدث خطأ أثناء حذف المستخدم' });
      alert('Error: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword || isSubmitting) return;
    setIsSubmitting(true);
    setStatus(null);

    try {
      // 1. Update in Firebase Auth and Server API safely
      const currentPassword = (selectedUser as any).currentPassword;
      const firebaseEmail = selectedUser.email.includes('@') ? selectedUser.email : `${selectedUser.email}@jam-pro.net`;
      await updateResilientUserPassword(firebaseEmail, currentPassword || '', newPassword, selectedUser.uid);

      // 2. Update in Firestore (Source of truth for Admin Overwrite)
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        currentPassword: newPassword,
        updatedAt: serverTimestamp()
      });

      setStatus({ type: 'success', message: 'تم تحديث كلمة المرور بنجاح في قاعدة البيانات والمصادقة.' });
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setNewPassword('');
        setStatus(null);
      }, 2000);
    } catch (error: any) {
      console.error('Error updating password:', error);
      setStatus({ type: 'error', message: error.message || 'حدث خطأ أثناء تحديث كلمة المرور' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCustomization = async () => {
    if (!selectedUserForCustom?.uid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', selectedUserForCustom.uid), {
        interfaceCustomization: customizationData,
        permissions: selectedUserPermissions,
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'تم تحديث واجهات وصلاحيات الموظف بنجاح.' });
      setTimeout(() => {
        setIsCustomizationModalOpen(false);
        setSelectedUserForCustom(null);
        setStatus(null);
      }, 1500);
    } catch (error: any) {
      setStatus({ type: 'error', message: 'فشل التحديث: ' + error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: UserProfile) => {
    try {
      const newStatus = user.status === 'active' ? 'disabled' : 'active';
      await updateDoc(doc(db, 'users', user.uid), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleResetUserCode = async (user: UserProfile) => {
    if (!profile || (profile.role !== 'superadmin' && profile.role !== 'master_wholesale' && profile.role !== 'manager')) {
      setStatus({ type: 'error', message: 'ليس لديك صلاحية تصفير الرموز.' });
      return;
    }
    if (!confirm(`هل أنت متأكد من تصفير رمز الأمان للمستخدم ${user.name}؟ سيعود الرمز إلى 1234 ويُطلب منه التغيير فوراً عند أول دخول.`)) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        securityCode: '1234',
        isSecurityCodeSet: true,
        mustChangeSecurityCode: true,
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: `تم تصفير رمز ${user.name} بنجاح إلى 1234.` });
    } catch (e) {
      setStatus({ type: 'error', message: 'فشل تصفير الرمز.' });
    }
  };

  const openModal = (user: UserProfile | null = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        password: '',
        paymentType: user.paymentType || 'commission',
        commissionRate: user.commissionRate ? user.commissionRate * 100 : '',
        salaryAmount: user.salaryAmount || '',
        photo: user.photo || '',
        allowOffline: user.allowOffline || false,
        offlineLimitHours: user.offlineLimitHours || 72
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: 'employee',
        password: '',
        paymentType: 'commission',
        commissionRate: '',
        salaryAmount: '',
        photo: '',
        allowOffline: false,
        offlineLimitHours: 72
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  if (profile?.role !== 'manager' && profile?.role !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400 space-y-4">
        <Shield size={64} className="opacity-20" />
        <p className="text-xl font-bold">عذراً، هذه الصفحة للمدراء فقط</p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'engineer') return u.role === 'engineer';
    if (activeTab === 'cashier') return u.role === 'cashier' || u.role === 'CASHIER' || u.role === 'sales';
    if (activeTab === 'delivery') return u.role === 'delivery_agent' || u.role === 'distributor';
    if (activeTab === 'packer') return u.role === 'staff' || u.role === 'packer';
    return true;
  });

  const getCount = (tab: string) => {
    return users.filter((u) => {
      if (tab === 'all') return true;
      if (tab === 'engineer') return u.role === 'engineer';
      if (tab === 'cashier') return u.role === 'cashier' || u.role === 'CASHIER' || u.role === 'sales';
      if (tab === 'delivery') return u.role === 'delivery_agent' || u.role === 'distributor';
      if (tab === 'packer') return u.role === 'staff' || u.role === 'packer';
      return true;
    }).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h3 className="text-2xl font-black text-navy-900 dark:text-white flex items-center gap-3">
          <UsersIcon className="text-brand-primary" />
          إدارة المستخدمين والصلاحيات المشتركة
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => {
              setSelectedUserForCustom(null);
              setIsCustomizationModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-navy-950 font-extrabold rounded-xl shadow-lg shadow-emerald-500/10 hover:brightness-110 bounce-hover"
          >
            <ShieldCheck size={18} />
            إدارة الصلاحيات الموحدة 🔐
          </button>
          
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 px-5 py-3 bg-brand-primary text-white font-black rounded-xl shadow-lg shadow-brand-primary/20 bounce-hover"
          >
            <UserPlus size={18} />
            إضافة مستخدم جديد
          </button>
        </div>
      </div>

      {/* Modern Tabs Navigation for 4 Professional Pillars */}
      <div className="flex flex-wrap items-center gap-2 bg-navy-900/40 p-2 rounded-2xl border border-white/5">
        {[
          { id: 'all', label: 'كافة العاملين', count: getCount('all'), color: 'text-white' },
          { id: 'engineer', label: 'قسم المهندسين', count: getCount('engineer'), color: 'text-sky-400' },
          { id: 'cashier', label: 'الصرافين وعمال الصندوق', count: getCount('cashier'), color: 'text-emerald-400' },
          { id: 'delivery', label: 'عمال التوصيل والسائقين', count: getCount('delivery'), color: 'text-amber-400' },
          { id: 'packer', label: 'موظفي المستودعات والتعبئة', count: getCount('packer'), color: 'text-purple-400' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === tab.id
                ? 'bg-brand-primary text-navy-900 shadow-md scale-[1.02]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className={activeTab === tab.id ? 'text-navy-950 font-black' : tab.color}>●</span>
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-navy-950/20 text-navy-900 font-bold' : 'bg-white/10 text-gray-400'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user, idx) => (
          <motion.div 
            key={`${user.uid}-${idx}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-glass p-6 relative group overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-2 h-full ${user.role === 'manager' ? 'bg-brand-primary' : 'bg-navy-700'}`} />
            
            <div className="flex items-start justify-between mb-4">
              <div className="w-16 h-16 rounded-2xl bg-navy-900 flex items-center justify-center text-brand-primary text-2xl font-black shadow-inner overflow-hidden">
                {user.photo ? (
                  <img src={user.photo} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  user.name[0]
                )}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openModal(user)} className="p-2 bg-white/10 hover:bg-brand-primary hover:text-white rounded-lg transition-all">
                  <Edit2 size={16} />
                </button>
                {user.uid !== profile?.uid && (
                  <button onClick={() => handleDelete(user.uid)} className="p-2 bg-white/10 hover:bg-danger hover:text-white rounded-lg transition-all">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">{user.name}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Mail size={12} />
                  {user.email}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                  user.status === 'disabled' ? 'bg-danger/10 text-danger' :
                  user.role === 'manager' ? 'bg-brand-primary/10 text-brand-primary' : 
                  user.role === 'engineer' ? 'bg-blue-500/10 text-blue-500' :
                  user.role === 'cashier' || (user as any).role === 'CASHIER' ? 'bg-emerald-500/10 text-emerald-500' :
                  user.role === 'delivery_agent' ? 'bg-amber-500/10 text-amber-500' :
                  user.role === 'staff' || (user as any).role === 'packer' ? 'bg-purple-500/10 text-purple-500' :
                  user.role === 'wholesaler' ? 'bg-indigo-500/10 text-indigo-500' :
                  user.role === 'retailer' ? 'bg-emerald-500/10 text-emerald-500' :
                  user.role === 'customer' ? 'bg-royal-gold/10 text-royal-gold' :
                  'bg-navy-700/10 text-gray-400'
                }`}>
                  <Shield size={10} />
                  {user.status === 'disabled' ? 'حساب معطل' :
                   user.role === 'manager' ? 'مدير' : 
                   user.role === 'engineer' ? 'مهندس صيانة' : 
                   user.role === 'cashier' || (user as any).role === 'CASHIER' ? 'عامل صندوق (صراف)' : 
                   user.role === 'delivery_agent' ? 'عامل توصيل وسائق' : 
                   user.role === 'staff' || (user as any).role === 'packer' ? 'موظف مستودعات وتجهيز' : 
                   user.role === 'wholesaler' ? 'تاجر جملة' :
                   user.role === 'retailer' ? 'تاجر تجزئة' :
                   user.role === 'customer' ? 'زبون' :
                   user.role === 'sales' ? 'مبيعات' :
                   'موظف'}
                </span>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-navy-700 flex items-center justify-between">
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      const settingsSnap = await getDoc(doc(db, 'settings', profile?.ownerId || 'general'));
                      const settings = settingsSnap.exists() ? settingsSnap.data() : null;
                      printReceipt('user_registration', user, settings);
                    }}
                    className="p-2 bg-brand-primary/10 hover:bg-brand-primary hover:text-white rounded-lg transition-all text-brand-primary"
                    title="طباعة سند"
                  >
                    <Printer size={14} />
                  </button>
                  <button 
                    onClick={() => {
                      selectUserForPermissions(user);
                      setIsCustomizationModalOpen(true);
                    }}
                    className="p-2 bg-blue-500/10 hover:bg-blue-500 hover:text-white rounded-lg transition-all text-blue-500"
                    title="تخصيص الواجهات المتاحة للموظف"
                  >
                    <Settings size={14} />
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedUser(user);
                      setIsPasswordModalOpen(true);
                    }}
                    className="p-2 bg-navy-700/10 hover:bg-navy-700 hover:text-white rounded-lg transition-all text-navy-700"
                    title="تغيير كلمة المرور"
                  >
                    <Key size={14} />
                  </button>
                  <button 
                    onClick={() => handleResetUserCode(user)}
                    className="p-2 bg-amber-500/10 hover:bg-amber-500 hover:text-white rounded-lg transition-all text-amber-600"
                    title="تصفير رمز الأمان"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button 
                    onClick={() => toggleUserStatus(user)}
                    className={`p-2 rounded-lg transition-all ${
                      user.status === 'disabled' ? 'bg-success/10 text-success hover:bg-success hover:text-white' : 'bg-danger/10 text-danger hover:bg-danger hover:text-white'
                    }`}
                    title={user.status === 'disabled' ? 'تفعيل الحساب' : 'تعطيل الحساب'}
                  >
                    {user.status === 'disabled' ? <Power size={14} /> : <PowerOff size={14} />}
                  </button>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  {user.status === 'disabled' ? (
                    <span className="text-danger flex items-center gap-1"><X size={10} /> معطل</span>
                  ) : (
                    <span className="text-success flex items-center gap-1"><Check size={10} /> نشط</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {editingUser ? <Edit2 className="text-brand-primary" /> : <UserPlus className="text-brand-primary" />}
                  {editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
                </h3>
                <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                <div className="md:col-span-2 flex flex-col items-center gap-4 p-6 bg-navy-900/5 dark:bg-white/5 rounded-3xl border-2 border-dashed border-gray-200 dark:border-navy-700">
                  <div className="relative group">
                    {formData.photo ? (
                      <img src={formData.photo} alt="Employee" className="w-24 h-24 rounded-2xl object-cover shadow-xl" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-24 h-24 bg-navy-900/10 rounded-2xl flex items-center justify-center">
                        <User size={48} className="text-gray-400" />
                      </div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-navy-900/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer">
                      <Upload className="text-white" size={24} />
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
                    </label>
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 flex items-center justify-center bg-navy-900/60 rounded-2xl">
                        <Loader2 className="text-brand-primary animate-spin" size={32} />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold">صورة الموظف</p>
                    <p className="text-[10px] text-gray-500">ارفع صورة شخصية للموظف</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-field">الاسم الكامل</label>
                  <input required type="text" className="input-field" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="label-field">البريد الإلكتروني أو رقم الهاتف</label>
                  <input 
                    required 
                    disabled={!!editingUser} 
                    type="text" 
                    className="input-field disabled:opacity-50 font-mono" 
                    placeholder="مثال: 770000000" 
                    value={formData.email} 
                    onChange={(e) => {
                      const val = e.target.value;
                      const prevVal = formData.email || '';
                      let newVal = val;
                      if (val.endsWith('@') && !prevVal.endsWith('@') && /^\d+$/.test(val.slice(0, -1))) {
                        const domain = getDomainForRole(formData.role || 'sales');
                        const suffix = domain.startsWith('@') ? domain.slice(1) : domain;
                        newVal = val + suffix;
                      }
                      setFormData({...formData, email: newVal});
                    }} 
                  />
                  <p className="text-[10px] text-gray-500">عند كتابة الرقم وعمل @، سيتم الإكمال تلقائياً إلى {getDomainForRole(formData.role || 'sales')}</p>
                </div>
                <div className="space-y-2">
                  <label className="label-field">الصلاحية</label>
                  <select 
                    className="input-field" 
                    value={formData.role} 
                    onChange={(e) => {
                      const selectedRole = e.target.value;
                      let updatedEmail = formData.email;
                      const match = updatedEmail.match(/^(\d+)@(?:gmail\.com|jam\.com|yahoo\.com|joad\.com|mna\.com|dad\.com)$/);
                      if (match) {
                        const phoneNum = match[1];
                        const newDomain = getDomainForRole(selectedRole);
                        updatedEmail = `${phoneNum}${newDomain}`;
                      }
                      setFormData({...formData, role: selectedRole as UserRole, email: updatedEmail});
                    }}
                  >
                    <option value="manager">مدير (صلاحيات كاملة)</option>
                    <option value="sales">موظف مبيعات</option>
                    <option value="cashier">عامل صندوق وصراف (CASHIER)</option>
                    <option value="engineer">مهندس صيانة (Engineer)</option>
                    <option value="delivery_agent">عامل توصيل وسائق (DELIVERY_AGENT)</option>
                    <option value="staff">موظف مستودعات وتجهيز (Packer / Staff)</option>
                  </select>
                </div>
                <div className="space-y-4 p-5 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-2xl">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Shield className="text-brand-primary" size={16} />
                    صلاحيات العمل دون إنترنت
                  </h4>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500">السماح بالعمل دون إنترنت</label>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, allowOffline: !formData.allowOffline})}
                      className={`w-12 h-6 rounded-full transition-all relative ${formData.allowOffline ? 'bg-success' : 'bg-gray-300 dark:bg-navy-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.allowOffline ? 'right-7' : 'right-1'}`} />
                    </button>
                  </div>
                  {formData.allowOffline && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 font-mono">المدة المسموح بها (بالساعات)</label>
                      <input 
                        type="number" 
                        className="input-field py-2 text-sm" 
                        placeholder="72 ساعة"
                        value={formData.offlineLimitHours} 
                        onChange={(e) => setFormData({...formData, offlineLimitHours: Number(e.target.value)})} 
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="label-field">نظام الدفع</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, paymentType: 'commission'})}
                      className={`p-3 rounded-xl border-2 font-bold transition-all ${formData.paymentType === 'commission' ? 'border-brand-primary bg-brand-primary/10 text-navy-900 dark:text-brand-primary' : 'border-gray-100 dark:border-navy-700 text-gray-400'}`}
                    >
                      نسبة (%)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, paymentType: 'salary'})}
                      className={`p-3 rounded-xl border-2 font-bold transition-all ${formData.paymentType === 'salary' ? 'border-brand-primary bg-brand-primary/10 text-navy-900 dark:text-brand-primary' : 'border-gray-100 dark:border-navy-700 text-gray-400'}`}
                    >
                      راتب ثابت
                    </button>
                  </div>
                </div>

                {formData.paymentType === 'commission' ? (
                  <div className="space-y-2">
                    <label className="label-field">نسبة العمولة (%)</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      className="input-field" 
                      placeholder="أدخل النسبة..."
                      value={formData.commissionRate} 
                      onChange={(e) => setFormData({...formData, commissionRate: e.target.value})} 
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="label-field">مبلغ الراتب الشهري</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      placeholder="أدخل الراتب..."
                      value={formData.salaryAmount} 
                      onChange={(e) => setFormData({...formData, salaryAmount: e.target.value})} 
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="label-field">كلمة المرور (6 أرقام على الأقل)</label>
                  <div className="relative">
                    <input 
                      required={!editingUser} 
                      type="password" 
                      minLength={6}
                      placeholder={editingUser ? 'اتركه فارغاً لعدم التغيير' : 'كلمة مرور الدخول (6 أرقام)'} 
                      className="input-field pl-12" 
                      value={formData.password} 
                      onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  </div>
                </div>

                {status && (
                  <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    <AlertIcon size={16} />
                    {status.message}
                  </div>
                )}

                <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-5 text-xl">
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : (editingUser ? 'تحديث البيانات' : 'إنشاء الحساب')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Change Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPasswordModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Key className="text-brand-primary" />
                  تغيير كلمة المرور
                </h3>
                <button onClick={() => setIsPasswordModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              
              <form onSubmit={handleUpdatePassword} className="p-8 space-y-4">
                <div className="p-4 bg-navy-50 dark:bg-navy-900/50 rounded-xl space-y-1">
                  <p className="text-xs text-gray-500">تغيير كلمة المرور للمستخدم:</p>
                  <p className="font-bold text-navy-900 dark:text-white">{selectedUser?.name}</p>
                  <p className="text-xs text-brand-primary">{selectedUser?.email}</p>
                </div>

                <div className="space-y-2">
                  <label className="label-field">كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input 
                      required 
                      type="password" 
                      minLength={6} 
                      className="input-field pl-12" 
                      placeholder="أدخل 6 أرقام أو حروف على الأقل"
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  </div>
                </div>

                {status && (
                  <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    <AlertIcon size={16} />
                    {status.message}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="btn-primary w-full py-4 text-lg mt-4"
                >
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'تحديث كلمة المرور'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCustomizationModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCustomizationModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-5xl bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden my-4 sm:my-8 max-h-[90vh] flex flex-col">
              
              {/* Header */}
              <div className="p-5 sm:p-6 bg-navy-900 text-white flex items-center justify-between border-b border-white/5" dir="rtl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold">
                      بوابة التحكم الموحدة بصلاحيات الموظفين والكاشير والصيانة
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ضبط واجهات العمليات وما يمكن رؤيته لكل شخص باسمه وبشكل معزول تماماً
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsCustomizationModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              
              {/* Body */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50 dark:bg-navy-900/30" dir="rtl">
                
                {/* Right Panel: Employee List (Isolated per Shop) */}
                <div className="w-full md:w-80 border-l border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800/50 flex flex-col overflow-y-auto p-4 space-y-4">
                  <div className="pb-2 border-b border-gray-100 dark:border-navy-700">
                    <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">قائمة الموظفين والعاملين لديكم</h4>
                  </div>

                  {/* Engineers Group */}
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-bold text-sky-500 bg-sky-500/10 px-2 py-1 rounded-md w-max">👨‍💻 قسم الصيانة والمهندسين</h5>
                    {users.filter(u => u.role === 'engineer').length === 0 ? (
                      <p className="text-[11px] text-gray-400 pr-2">لا يوجد مهندسين مسجلين حالياً</p>
                    ) : (
                      users.filter(u => u.role === 'engineer').map((u) => (
                        <button
                          key={u.uid}
                          onClick={() => selectUserForPermissions(u)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-right ${
                            selectedUserForCustom?.uid === u.uid 
                              ? 'bg-gradient-to-l from-sky-500/20 to-sky-500/5 border-r-4 border-sky-500 font-bold text-sky-700 dark:text-sky-300'
                              : 'hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center font-black text-sm">
                            {u.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{u.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Cashiers Group */}
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-navy-700/50">
                    <h5 className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md w-max">💰 الصرافة وأمناء الصندوق</h5>
                    {users.filter(u => u.role === 'cashier' || (u.role as string) === 'CASHIER').length === 0 ? (
                      <p className="text-[11px] text-gray-400 pr-2">لا يوجد كاشير مسجل حالياً</p>
                    ) : (
                      users.filter(u => u.role === 'cashier' || (u.role as string) === 'CASHIER').map((u) => (
                        <button
                          key={u.uid}
                          onClick={() => selectUserForPermissions(u)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-right ${
                            selectedUserForCustom?.uid === u.uid 
                              ? 'bg-gradient-to-l from-emerald-500/20 to-emerald-500/5 border-r-4 border-emerald-500 font-bold text-emerald-700 dark:text-emerald-300'
                              : 'hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-sm">
                            {u.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{u.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Other Employees Group */}
                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-navy-700/50">
                    <h5 className="text-[11px] font-bold text-purple-500 bg-purple-500/10 px-2 py-1 rounded-md w-max">📦 الموظفين والمبيعات والمستودع</h5>
                    {users.filter(u => u.role !== 'engineer' && u.role !== 'cashier' && (u.role as string) !== 'CASHIER').length === 0 ? (
                      <p className="text-[11px] text-gray-400 pr-2">لا يوجد موظفي مبيعات مسجلين حالياً</p>
                    ) : (
                      users.filter(u => u.role !== 'engineer' && u.role !== 'cashier' && (u.role as string) !== 'CASHIER').map((u) => (
                        <button
                          key={u.uid}
                          onClick={() => selectUserForPermissions(u)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-right ${
                            selectedUserForCustom?.uid === u.uid 
                              ? 'bg-gradient-to-l from-purple-500/20 to-purple-500/5 border-r-4 border-purple-500 font-bold text-purple-700 dark:text-purple-300'
                              : 'hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-black text-sm">
                            {u.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{u.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Left Panel: Permissions Configuration Form */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col">
                  {selectedUserForCustom ? (
                    <div className="space-y-6 flex-1">
                      
                      {/* Active User Header */}
                      <div className="p-4 bg-navy-900/40 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-brand-primary text-black flex items-center justify-center font-black text-lg">
                            {selectedUserForCustom.photo ? (
                              <img src={selectedUserForCustom.photo} alt={selectedUserForCustom.name} className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              selectedUserForCustom.name[0]
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-navy-900 dark:text-white">{selectedUserForCustom.name}</h4>
                            <p className="text-xs text-gray-400">
                              نوع الحساب الأساسي: {
                                selectedUserForCustom.role === 'manager' ? 'مدير متجر' :
                                selectedUserForCustom.role === 'engineer' ? 'مهندس صيانة' :
                                selectedUserForCustom.role === 'cashier' || (selectedUserForCustom.role as string) === 'CASHIER' ? 'كاشير وصراف' :
                                'موظف مبيعات ومستودع'
                              }
                            </p>
                          </div>
                        </div>

                        <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-black uppercase">
                          قيد التعديل الآن
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* 1. App Navigation / Pages Visibility */}
                        <div className="p-5 bg-white dark:bg-navy-800 rounded-3xl border border-gray-100 dark:border-navy-700/50 space-y-4">
                          <h4 className="font-extrabold text-xs text-navy-900 dark:text-white pb-2 border-b border-gray-100 dark:border-navy-700 flex items-center gap-2">
                            <span>📱</span>
                            الواجهات والصفحات التي يراها ويفتحها الموظف
                          </h4>
                          
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 rounded-xl text-[10px] font-bold leading-relaxed">
                            قم بتحديد الأقسام التي تظهر في قائمة الموظف عند تسجيل دخوله للمتجر.
                          </div>

                          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                            {([
                              'sales', 'wholesale-pos', 'returns', 'inventory', 'customers', 'suppliers',
                              'finances', 'maintenance', 'damages', 'warehouse', 'inventory-match', 'delivery', 'dashboard', 'shortages', 'warehouse-prep', 'cashier', 'accounts'
                            ]).map((pageId) => {
                              const labelMap: Record<string, string> = {
                                sales: 'المبيعات والتجزئة والبيع المباشر 🛒',
                                'wholesale-pos': 'مبيعات الجملة والجملة الخاصة 🏪',
                                returns: 'إدارة المرتجعات واسترداد البضاعة 🔄',
                                inventory: 'المخزون وإدارة المستودع 📦',
                                customers: 'إدارة شؤون العملاء والزبائن 👥',
                                suppliers: 'إدارة الموردين والشركات 🏢',
                                finances: 'الحسابات العامة والمركز المالي والترصيد 📈',
                                maintenance: 'قسم الصيانة وفحص الأجهزة والورش 🔧',
                                damages: 'قسم التوالف والضمانات والأجهزة الملغية ⚠️',
                                warehouse: 'المطابقة والتجهيز وكراتين الطلبيات 📦',
                                'inventory-match': 'جرد البضاعة ومطابقة الأرصدة 🔍',
                                delivery: 'قسم التوصيل والمناديب وسواقين الشحن 🚚',
                                dashboard: 'لوحة التحكم الرئيسية السريعة 📊',
                                shortages: 'قسم النواقص وطلبيات السوق اليومية 📝',
                                'warehouse-prep': 'تطبيق عامل تجهيز الطلبيات المستودعية 📦',
                                cashier: 'أعمال الصناديق والصراف للشبكة والخزنة 💸',
                                accounts: 'المنظومة المحاسبية المتكاملة والقيد المزدوج 🏛️'
                              };
                              return (
                                <label key={`custom-desk-${pageId}`} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-navy-900 rounded-xl cursor-pointer transition-colors">
                                  <input 
                                    type="checkbox"
                                    className="rounded text-brand-primary focus:ring-brand-primary w-4 h-4"
                                    checked={customizationData.desktopPages.includes(pageId) || customizationData.mobilePages.includes(pageId)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setCustomizationData(prev => {
                                        const newDesk = checked 
                                          ? [...prev.desktopPages, pageId]
                                          : prev.desktopPages.filter(p => p !== pageId);
                                        const newMob = checked 
                                          ? [...prev.mobilePages, pageId]
                                          : prev.mobilePages.filter(p => p !== pageId);
                                        return { desktopPages: newDesk, mobilePages: newMob };
                                      });
                                    }}
                                  />
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                    {labelMap[pageId] || pageId}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Operational & Transaction Permissions */}
                        <div className="p-5 bg-white dark:bg-navy-800 rounded-3xl border border-gray-100 dark:border-navy-700/50 space-y-4">
                          <h4 className="font-extrabold text-xs text-navy-900 dark:text-white pb-2 border-b border-gray-100 dark:border-navy-700 flex items-center gap-2">
                            <span>🔑</span>
                            صلاحيات العمليات والمدخلات (خاصة لكل مستخدم)
                          </h4>

                          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-[10px] font-bold leading-relaxed">
                            اختر ما يمكن للموظف إجراؤه أو التعديل عليه في المتجر مباشرة.
                          </div>

                          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                            
                            {/* General/Cashier Permissions */}
                            <div className="space-y-2">
                              <h5 className="text-[10px] font-extrabold text-gray-400">صلاحيات المبيعات والأموال</h5>
                              
                              {[
                                { id: 'canSeeBuyPrice', label: 'رؤية أسعار شراء السلع والمنتجات 🏷️', desc: 'يسمح له برؤية سعر التكلفة الفعلي للسلع' },
                                { id: 'canGiveDiscount', label: 'صلاحية تقديم الخصومات للزبائن 💸', desc: 'يسمح له بعمل خصومات يدوية بالفاتورة' },
                                { id: 'canDeleteInvoice', label: 'صلاحية تعديل أو حذف الفواتير الصادرة 🗑️', desc: 'يسمح له بحذف الفواتير من السجل والتقارير' },
                                { id: 'canAccessFinancials', label: 'رؤية الأرباح والتقارير المالية العامة 📈', desc: 'يسمح برؤية صافي الأرباح للمتجر بالتقارير' },
                                { id: 'canWithdrawCash', label: 'سحب وتصدير مبالغ نقدية من الصندوق 💵', desc: 'يسمح بعمل عمليات سحب (صرفيات) نقدية' }
                              ].map((perm) => (
                                <label key={perm.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-navy-900 rounded-xl cursor-pointer transition-colors">
                                  <input 
                                    type="checkbox"
                                    className="rounded text-brand-primary focus:ring-brand-primary w-4 h-4 mt-0.5"
                                    checked={(selectedUserPermissions as any)[perm.id] !== false}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSelectedUserPermissions(prev => ({ ...prev, [perm.id]: checked }));
                                    }}
                                  />
                                  <div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">{perm.label}</span>
                                    <span className="text-[9px] text-gray-400 block mt-0.5">{perm.desc}</span>
                                  </div>
                                </label>
                              ))}
                            </div>

                            {/* Maintenance Engineer Specific */}
                            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-navy-700/50">
                              <h5 className="text-[10px] font-extrabold text-sky-400">صلاحيات فني ومهندس الصيانة</h5>
                              
                              {[
                                { id: 'canChangeMaintenanceStatus', label: 'تعديل حالة صيانة الأجهزة والتشخيص 🔧', desc: 'يسمح للمهندس بتغيير حالة الجهاز إلى فحص/جاهز' },
                                { id: 'canSetRepairPrice', label: 'تحديد أسعار قطع الغيار وأجور الصيانة 💰', desc: 'يسمح بتعديل ووضع أسعار قطع الغيار والمصلحين' },
                                { id: 'canDeliverDevice', label: 'تسليم الأجهزة المستلمة للزبائن مباشرة 🤝', desc: 'يسمح بتسليم الجهاز المقبوض واستلام الكاش' }
                              ].map((perm) => (
                                <label key={perm.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-navy-900 rounded-xl cursor-pointer transition-colors">
                                  <input 
                                    type="checkbox"
                                    className="rounded text-brand-primary focus:ring-brand-primary w-4 h-4 mt-0.5"
                                    checked={(selectedUserPermissions as any)[perm.id] !== false}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSelectedUserPermissions(prev => ({ ...prev, [perm.id]: checked }));
                                    }}
                                  />
                                  <div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">{perm.label}</span>
                                    <span className="text-[9px] text-gray-400 block mt-0.5">{perm.desc}</span>
                                  </div>
                                </label>
                              ))}
                            </div>

                            {/* Inventory & Stock Permissions */}
                            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-navy-700/50">
                              <h5 className="text-[10px] font-extrabold text-purple-400">صلاحيات المستودع والسلع</h5>
                              
                              {[
                                { id: 'canEditStockQuantities', label: 'تعديل وتصفير وجرد كميات المخزون مباشرة 📦', desc: 'يسمح بتعديل الرصيد والمخزون مباشرة' },
                                { id: 'canImportGoods', label: 'توريد البضائع وإدخال شحنات وكميات جديدة 📥', desc: 'يسمح بإدخال كميات سلع موردة وتوسيع المخزن' },
                                { id: 'canDeleteProducts', label: 'حذف المنتجات والسلع نهائياً من السيستم ❌', desc: 'يسمح بحذف الكارت تماماً' }
                              ].map((perm) => (
                                <label key={perm.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-navy-900 rounded-xl cursor-pointer transition-colors">
                                  <input 
                                    type="checkbox"
                                    className="rounded text-brand-primary focus:ring-brand-primary w-4 h-4 mt-0.5"
                                    checked={(selectedUserPermissions as any)[perm.id] !== false}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSelectedUserPermissions(prev => ({ ...prev, [perm.id]: checked }));
                                    }}
                                  />
                                  <div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">{perm.label}</span>
                                    <span className="text-[9px] text-gray-400 block mt-0.5">{perm.desc}</span>
                                  </div>
                                </label>
                              ))}
                            </div>

                          </div>
                        </div>

                      </div>

                      {status && (
                        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                          <AlertIcon size={14} />
                          {status.message}
                        </div>
                      )}

                      {/* Submit Actions */}
                      <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-navy-700/50">
                        <button 
                          onClick={() => {
                            setIsCustomizationModalOpen(false);
                            setSelectedUserForCustom(null);
                          }}
                          className="flex-1 py-3.5 bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-white rounded-xl text-xs font-bold"
                        >
                          إلغاء التعديل
                        </button>
                        <button 
                          onClick={handleUpdateCustomization}
                          disabled={isSubmitting}
                          className="flex-[2] py-3.5 bg-brand-primary text-black rounded-xl text-xs font-black shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2"
                        >
                          {isSubmitting ? <Loader2 className="animate-spin text-black" size={16} /> : (
                            <>
                              <ShieldCheck size={16} />
                              <span>حفظ ومزامنة كافة صلاحيات {selectedUserForCustom.name} 💾</span>
                            </>
                          )}
                        </button>
                      </div>

                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                      <div className="w-20 h-20 bg-navy-100 dark:bg-navy-800 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 animate-pulse">
                        <ShieldCheck size={40} />
                      </div>
                      <div className="space-y-2 max-w-sm" dir="rtl">
                        <h4 className="text-base font-extrabold text-navy-900 dark:text-white">بوابة الصلاحيات شاغرة</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          الرجاء تحديد أحد الموظفين من القائمة اليمنى لتبدأ فوراً بتعيين واجهاته المتاحة وصلاحياته العملياتية كحذف الفواتير ورؤية الأرباح وأسعار الشراء بالاسم وبشكل معزول.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
