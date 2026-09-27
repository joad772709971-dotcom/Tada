import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Trash2, 
  Edit3, 
  Key, 
  Check, 
  X, 
  Lock, 
  Unlock, 
  Phone, 
  Mail, 
  ShieldCheck,
  Coins,
  Shield,
  Briefcase,
  Clock,
  Calendar,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, UserRole } from '../types';
import EmployeeShiftHistoryTable from './EmployeeShiftHistoryTable';

const getDomainForEmployeeRole = (role: string): string => {
  const r = (role || '').toLowerCase();
  if (r === 'manager') return 'jam.com';
  if (r === 'sales' || r === 'engineer') return 'yahoo.com';
  return 'yahoo.com';
};

interface EmployeesAndEngineersProps {
  users: UserProfile[];
  currentUser: UserProfile;
  onUpdateUsers: (updatedUsersList: UserProfile[]) => void;
}

export default function EmployeesAndEngineers({ 
  users, 
  currentUser, 
  onUpdateUsers 
}: EmployeesAndEngineersProps) {
  // Navigation & Search search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Form & Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'sales' as UserRole,
    password: '',
    custodyBalance: 0,
    status: 'active' as 'active' | 'disabled' | 'suspended',
    hideCostPrice: false,
    hideNetProfit: false,
    isSystemUser: true,
    workSystem: 'monthly' as 'monthly' | 'shifts',
    shiftPeriods: 'صباحية, مسائية',
    dailyWorkHours: 8
  });

  // Password Reset state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<UserProfile | null>(null);
  const [tempPassword, setTempPassword] = useState('');

  // Handle opening form for Create
  const handleOpenCreateForm = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'sales',
      password: '',
      custodyBalance: 0,
      status: 'active',
      hideCostPrice: false,
      hideNetProfit: false,
      isSystemUser: true,
      workSystem: 'monthly',
      shiftPeriods: 'صباحية, مسائية',
      dailyWorkHours: 8
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Handle opening form for Edit
  const handleOpenEditForm = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      password: '', // Kept empty unless they modify
      custodyBalance: user.custodyBalance || 0,
      status: user.status as any,
      hideCostPrice: !!user.hideCostPrice,
      hideNetProfit: !!user.hideNetProfit,
      isSystemUser: user.isSystemUser !== false,
      workSystem: user.workSystem || 'monthly',
      shiftPeriods: (user.shiftPeriods || ['صباحية', 'مسائية']).join(', '),
      dailyWorkHours: user.dailyWorkHours || 8
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Save changes
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('يرجى إدخال اسم الموظف كاملاً!');
      return;
    }

    let finalEmail = formData.email.trim();
    if (/^\d+$/.test(finalEmail) && !finalEmail.includes('@')) {
      const domain = getDomainForEmployeeRole(formData.role);
      finalEmail = `${finalEmail}@${domain}`;
    }

    if (formData.isSystemUser && (!finalEmail || !finalEmail.includes('@'))) {
      setFormError('يرجى إدخال بريد إلكتروني/اسم مستخدم صحيح!');
      return;
    }

    if (formData.isSystemUser && !editingUser && !formData.password) {
      setFormError('يرجى تعيين كلمة مرور أولية للموظف الجديد!');
      return;
    }

    const periodsArray = formData.shiftPeriods.split(',').map(p => p.trim()).filter(Boolean);

    let updatedList: UserProfile[];

    if (editingUser) {
      // Edit mode
      updatedList = users.map(u => {
        if (u.uid === editingUser.uid) {
          return {
            ...u,
            name: formData.name.trim(),
            email: finalEmail || `${Date.now()}@yahoo.com`,
            phone: formData.phone.trim(),
            role: formData.role,
            status: formData.status as any,
            custodyBalance: Number(formData.custodyBalance) || 0,
            hideCostPrice: formData.hideCostPrice,
            hideNetProfit: formData.hideNetProfit,
            isSystemUser: formData.isSystemUser,
            workSystem: formData.workSystem,
            shiftPeriods: periodsArray,
            dailyWorkHours: Number(formData.dailyWorkHours) || 8,
            ...(formData.password ? { password: formData.password } : {})
          };
        }
        return u;
      });
    } else {
      // Create mode
      const newUid = `user-${Date.now()}`;
      const newUser: UserProfile = {
        uid: newUid,
        name: formData.name.trim(),
        email: finalEmail || `${Date.now()}@yahoo.com`,
        phone: formData.phone.trim(),
        role: formData.role,
        status: formData.status as any,
        ownerId: currentUser.ownerId || currentUser.uid,
        password: formData.password,
        custodyBalance: Number(formData.custodyBalance) || 0,
        hideCostPrice: formData.hideCostPrice,
        hideNetProfit: formData.hideNetProfit,
        isSystemUser: formData.isSystemUser,
        workSystem: formData.workSystem,
        shiftPeriods: periodsArray,
        dailyWorkHours: Number(formData.dailyWorkHours) || 8
      };
      updatedList = [newUser, ...users];
    }

    onUpdateUsers(updatedList);
    setIsFormOpen(false);
  };

  // Trigger change status quickly
  const handleToggleUserStatus = (user: UserProfile) => {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    const updated = users.map(u => 
      u.uid === user.uid ? { ...u, status: nextStatus as any } : u
    );
    onUpdateUsers(updated);
  };

  // Password reset handler
  const handleOpenPasswordReset = (user: UserProfile) => {
    setPasswordTargetUser(user);
    setTempPassword('');
    setIsPasswordModalOpen(true);
  };

  const handleSavePasswordReset = () => {
    if (!tempPassword || tempPassword.length < 6) {
      alert('يجب أن تكون كلمة المرور 6 خانات أو أكثر!');
      return;
    }
    if (passwordTargetUser) {
      const updated = users.map(u => 
        u.uid === passwordTargetUser.uid ? { ...u, password: tempPassword } : u
      );
      onUpdateUsers(updated);
      setIsPasswordModalOpen(false);
      alert(`تم بنجاح تعيين كلمة مرور جديدة للموظف (${passwordTargetUser.name})`);
    }
  };

  // Filter users
  const filteredList = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phone || '').includes(searchTerm);
    
    if (selectedRole === 'all') return matchesSearch;
    return matchesSearch && user.role === selectedRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return <span className="px-2 py-1 bg-red-950/50 border border-red-900/60 text-red-300 text-xs font-black rounded-lg">المدير العام 👑</span>;
      case 'owner':
        return <span className="px-2 py-1 bg-indigo-950/50 border border-indigo-900/60 text-indigo-300 text-xs font-black rounded-lg">المالك الرئيسي 🏢</span>;
      case 'manager':
        return <span className="px-2 py-1 bg-violet-950/50 border border-violet-900/60 text-violet-300 text-xs font-black rounded-lg">مدير الفرع 📋</span>;
      case 'engineer':
        return <span className="px-2 py-1 bg-amber-950/50 border border-amber-900/60 text-amber-300 text-xs font-black rounded-lg">مهندس الصيانة 🛠️</span>;
      case 'sales':
        return <span className="px-2 py-1 bg-emerald-950/50 border border-emerald-900/60 text-emerald-300 text-xs font-black rounded-lg">كاشير المبيعات 💰</span>;
      default:
        return <span className="px-2 py-1 bg-zinc-950/50 border border-zinc-900/60 text-zinc-400 text-xs rounded-lg">عميل 👤</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-900 pb-4 gap-4">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            👥 إدارة الموظفين والمهندسين والصلاحيات
          </h2>
          <p className="text-zinc-500 text-[10px]/relaxed mt-0.5">تسجيل الدخول للكاشير ومهندسي الورشة، تخصيص نسب العمولات، إدارة العهد والصناديق الفرعية.</p>
        </div>
        
        <button
          onClick={handleOpenCreateForm}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs rounded hover:opacity-90 transition flex items-center gap-2 cursor-pointer shadow-lg"
        >
          <UserPlus size={15} />
          إضافة كادر جديد للمحل
        </button>
      </div>

      {/* Control filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 right-3 flex items-center text-zinc-500">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="ابحث بـ الاسم أو الهاتف أو البريد الإلكتروني..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 bg-[#080808] border border-zinc-900 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-600/50"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'engineer', label: 'المهندسين 🛠️' },
            { id: 'sales', label: 'كاشير ومبيعات 💰' },
            { id: 'manager', label: 'الإدارة 📋' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRole(r.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                selectedRole === r.id 
                  ? 'bg-amber-600 text-black font-bold' 
                  : 'bg-[#080808] text-zinc-400 hover:text-white border border-zinc-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map(user => {
          const isMe = user.uid === currentUser.uid;
          return (
            <div 
              key={user.uid}
              className={`p-5 rounded-2xl border bg-gradient-to-br from-[#0c0c0c] to-[#050505] transition-all flex flex-col justify-between h-44 ${
                user.status !== 'active' 
                  ? 'border-rose-950/50 opacity-60' 
                  : 'border-zinc-900 hover:border-zinc-800'
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        {user.name}
                        {isMe && <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md font-normal">أنت</span>}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getRoleBadge(user.role)}
                    {(user.hideCostPrice || user.hideNetProfit) && (
                      <span className="px-1.5 py-0.5 bg-amber-950/20 border border-amber-900/30 text-amber-400 text-[9px] font-black rounded-md flex items-center gap-0.5" title="تم حظر حقول معينة للموظف">
                        🔒 حقول محجوبة
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Phone size={12} className="text-zinc-600" />
                    <span>{user.phone || 'بدون رقم'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Coins size={12} className="text-amber-500" />
                    <span>العهدة: {user.custodyBalance ? `${user.custodyBalance.toLocaleString()} ر.ي` : '0 ر.ي'}</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-auto pt-3 border-t border-zinc-950 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditForm(user)}
                    className="p-1.5 bg-zinc-900/50 hover:bg-zinc-850 text-blue-400 rounded-lg border border-zinc-850 transition cursor-pointer text-[10px] flex items-center gap-1"
                    title="تعديل البيانات"
                  >
                    <Edit3 size={11} />
                    تعديل
                  </button>

                  <button
                    onClick={() => handleOpenPasswordReset(user)}
                    className="p-1.5 bg-zinc-900/50 hover:bg-zinc-850 text-amber-400 rounded-lg border border-zinc-850 transition cursor-pointer text-[10px] flex items-center gap-1"
                    title="تغيير كلمة المرور"
                  >
                    <Key size={11} />
                    تغيير الرمز
                  </button>
                </div>

                {!isMe && (
                  <button
                    onClick={() => handleToggleUserStatus(user)}
                    className={`p-1.5 text-[10px] rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      user.status === 'active'
                        ? 'bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 border border-rose-900/40'
                        : 'bg-emerald-950/30 hover:bg-emerald-950/60 text-emerald-300 border border-emerald-900/40'
                    }`}
                  >
                    {user.status === 'active' ? (
                      <>
                        <Lock size={11} />
                        إيقاف
                      </>
                    ) : (
                      <>
                        <Unlock size={11} />
                        تفعيل
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredList.length === 0 && (
          <div className="col-span-full py-16 text-center text-zinc-650 text-xs">
            لا توجد حسابات للموظفين مطابقة للبحث أو الفلتر المحدد.
          </div>
        )}
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsFormOpen(false)} 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="relative w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-6 text-right shadow-2xl z-10"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-900">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Users size={16} className="text-amber-500" />
                  {editingUser ? 'تعديل بيانات الكادر' : 'إضافة حساب كادر وموظف جديد'}
                </h3>
                <button 
                  onClick={() => setIsFormOpen(false)} 
                  className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg text-xs"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-950/40 border border-rose-900/50 text-rose-350 text-xs rounded-xl mb-4 leading-relaxed">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-bold">الاسم الرباعي الكامل</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-600 text-xs"
                    placeholder="مثال: يونس عبدالصمد المحفلي"
                  />
                </div>

                {/* Toggle: System User vs Regular Employee */}
                <div className="bg-[#050505] p-3.5 rounded-xl border border-zinc-900 space-y-2">
                  <label className="text-xs font-bold text-amber-400 block">👤 نوع حساب الموظف وصلاحية الدخول</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isSystemUser: true })}
                      className={`flex-1 p-2 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        formData.isSystemUser
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      🔑 مستخدم نظامي (بيانات دخول)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isSystemUser: false })}
                      className={`flex-1 p-2 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        !formData.isSystemUser
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      👤 موظف عادي (بدون دخول)
                    </button>
                  </div>
                </div>

                {formData.isSystemUser && (
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold">البريد الإلكتروني / اسم الدخول</label>
                    <input
                      type="text"
                      required={formData.isSystemUser}
                      value={formData.email}
                      onChange={(e) => {
                        const val = e.target.value;
                        const prevVal = formData.email || '';
                        let newVal = val;
                        if (val.endsWith('@') && !prevVal.endsWith('@') && /^\d+$/.test(val.slice(0, -1))) {
                          const domain = getDomainForEmployeeRole(formData.role);
                          newVal = val + domain;
                        }
                        setFormData({ ...formData, email: newVal });
                      }}
                      className="w-full p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-600 text-xs font-mono"
                      placeholder="مثال: 770000000"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">عند كتابة الرقم وعمل @، سيتم الإكمال تلقائياً إلى @{getDomainForEmployeeRole(formData.role)}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold">رقم تليفون الواتساب</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-600 text-xs text-center font-mono"
                      placeholder="772315106"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold">الصفة والدور الوظيفي</label>
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        const selectedRole = e.target.value;
                        let updatedEmail = formData.email;
                        const match = updatedEmail.match(/^(\d+)@(?:jam\.com|yahoo\.com)$/);
                        if (match) {
                          const phoneNum = match[1];
                          const newDomain = getDomainForEmployeeRole(selectedRole);
                          updatedEmail = `${phoneNum}@${newDomain}`;
                        }
                        setFormData({ ...formData, role: selectedRole as any, email: updatedEmail });
                      }}
                      className="w-full p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-600 text-xs"
                    >
                      <option value="sales">كاشير ومبيعات 💰</option>
                      <option value="engineer">مهندس صيانة وفحص 🛠️</option>
                      <option value="manager">مدير فرع 📋</option>
                    </select>
                  </div>
                </div>

                {formData.isSystemUser && !editingUser && (
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold">كلمة المرور الأولية (أكثر من 6 خانات)</label>
                    <input
                      type="password"
                      required={formData.isSystemUser}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-600 text-xs font-mono text-center"
                      placeholder="••••••"
                    />
                  </div>
                )}

                {/* Shift System & Working Hours Setup */}
                <div className="bg-[#050505] p-3.5 rounded-xl border border-zinc-900 space-y-3">
                  <span className="text-[10px] text-amber-500 font-bold block uppercase tracking-wide">⏰ نظام الدوام والورديات والساعات</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-bold">نظام الأجر / الدوام</label>
                      <select
                        value={formData.workSystem}
                        onChange={(e) => setFormData({ ...formData, workSystem: e.target.value as any })}
                        className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-xs"
                      >
                        <option value="monthly">راتب شهري ثابت 📅</option>
                        <option value="shifts">نظام الورديات 🔄</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1 font-bold">ساعات العمل اليومية</label>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={formData.dailyWorkHours}
                        onChange={(e) => setFormData({ ...formData, dailyWorkHours: Number(e.target.value) || 8 })}
                        className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono text-center text-xs"
                        placeholder="8"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold">فترات الورديات المحددة (مفصولة بفواصل)</label>
                    <input
                      type="text"
                      value={formData.shiftPeriods}
                      onChange={(e) => setFormData({ ...formData, shiftPeriods: e.target.value })}
                      className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-xs"
                      placeholder="صباحية, مسائية"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold">الأساس الأولي للعهدة النقدية</label>
                    <input
                      type="number"
                      value={formData.custodyBalance}
                      onChange={(e) => setFormData({ ...formData, custodyBalance: Number(e.target.value) || 0 })}
                      className="w-full p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-600 text-xs text-center font-mono"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold">الحالة الفورية</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-600 text-xs"
                    >
                      <option value="active">نشط ومفعل ✅</option>
                      <option value="disabled">موقف / معطل ❌</option>
                    </select>
                  </div>
                </div>

                {/* Advanced Field-Level Permissions */}
                <div className="bg-[#050505] p-3.5 rounded-xl border border-zinc-900/80 space-y-3">
                  <span className="text-[10px] text-amber-500 font-bold block uppercase tracking-wide">🛡️ صلاحيات الحقول المتقدمة (Field-Level Permissions)</span>
                  
                  <div className="flex items-center justify-between gap-2 p-1.5 hover:bg-zinc-900/30 rounded-lg">
                    <div>
                      <span className="text-xs font-bold text-zinc-300 block">إخفاء سعر التكلفة</span>
                      <span className="text-[10px] text-zinc-500">حجب رؤية أسعار شراء الأصناف وتكلفة الأجهزة عن هذا المستخدم</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={!!formData.hideCostPrice}
                      onChange={(e) => setFormData({ ...formData, hideCostPrice: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded border-zinc-800 bg-zinc-900 focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 p-1.5 hover:bg-zinc-900/30 rounded-lg">
                    <div>
                      <span className="text-xs font-bold text-zinc-300 block">إخفاء صافي الأرباح</span>
                      <span className="text-[10px] text-zinc-500">منع هذا الموظف من الاطلاع على هامش الربح والتقارير المالية</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={!!formData.hideNetProfit}
                      onChange={(e) => setFormData({ ...formData, hideNetProfit: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded border-zinc-800 bg-zinc-900 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-black rounded-lg transition-all text-xs cursor-pointer text-center"
                  >
                    حفظ وإدراج
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg transition-all text-xs cursor-pointer text-center"
                  >
                    إلغاء التراجع
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && passwordTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsPasswordModalOpen(false)} 
              className="absolute inset-0 bg-black/85 backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="relative w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-3xl p-6 text-right shadow-2xl z-10"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-900">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Lock size={15} className="text-amber-500" />
                  إعادة تعيين الرمز السري لشريك الكادر
                </h3>
                <button 
                  onClick={() => setIsPasswordModalOpen(false)} 
                  className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg text-xs"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-zinc-500 mb-4 font-sans leading-relaxed">
                تقوم الآن بتغيير مفتاح الدخول والرمز للموظف المحترف: 
                <span className="font-bold text-white block mt-1">({passwordTargetUser.name})</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-400 mb-1.5 text-xs">الرمز السري الجديد (6 حقول على الأقل)</label>
                  <input
                    type="password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="w-full p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white text-xs font-mono text-center focus:outline-none focus:border-amber-600"
                    placeholder="••••••"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={handleSavePasswordReset}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-black font-black text-xs rounded-lg transition-all cursor-pointer"
                  >
                    تثبيت وتحديث
                  </button>
                  <button
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs rounded-lg transition-all cursor-pointer"
                  >
                    إلغاء التراجع
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detailed Employee Breakdown & Official Holidays Section */}
      <div className="pt-6">
        <EmployeeShiftHistoryTable
          employees={users}
          onUpdateEmployee={(updatedEmp) => {
            const updated = users.map(u => u.uid === updatedEmp.uid ? updatedEmp : u);
            onUpdateUsers(updated);
          }}
        />
      </div>
      
    </div>
  );
}
