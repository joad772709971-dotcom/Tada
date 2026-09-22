import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Power, 
  Users, 
  MapPin, 
  Phone, 
  Compass, 
  Eye, 
  X, 
  Check, 
  Lock, 
  Unlock,
  Building,
  Activity,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';

interface SuperOwnerPanelProps {
  stores: any[];
  users: UserProfile[];
  onAddStore: (store: any) => void;
  currentUser: UserProfile;
  onSelectWorkingStore: (storeId: string) => void;
}

export default function SuperOwnerPanel({
  stores,
  users,
  onAddStore,
  currentUser,
  onSelectWorkingStore
}: SuperOwnerPanelProps) {
  // Navigation & Search searching state
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const [formError, setFormError] = useState('');

  // New store form state
  const [newStore, setNewStore] = useState({
    id: '',
    name: '',
    slogan: '',
    phone: '',
    address: '',
    ownerName: '',
    ownerPhone: '',
    businessType: 'mobiles' as 'mobiles' | 'motorcycles',
    status: 'active' as 'active' | 'suspended',
    broadcastMessage: ''
  });

  // Handle adding store
  const handleSubmitStore = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newStore.id.trim()) {
      setFormError('يرجى تحديد مُعرِّف فريد للفرع (خانات بالإنجليزية بدون مسافات)!');
      return;
    }
    if (!newStore.name.trim()) {
      setFormError('يرجى إدخال الاسم المعتمد للفرع الجديد!');
      return;
    }

    // Check if ID already exists
    if (stores.some(s => s.id.toLowerCase() === newStore.id.trim().toLowerCase())) {
      setFormError('عذراً، هذا المعرف الفريد للفرع مسجل مسبقاً بالنظام!');
      return;
    }

    // Trigger onAddStore
    onAddStore({
      ...newStore,
      id: newStore.id.trim().toLowerCase(),
      createdAt: new Date().toISOString()
    });

    setIsAddStoreOpen(false);
    // Reset form
    setNewStore({
      id: '',
      name: '',
      slogan: '',
      phone: '',
      address: '',
      ownerName: '',
      ownerPhone: '',
      businessType: 'mobiles',
      status: 'active',
      broadcastMessage: ''
    });
  };

  // Filtered store listing
  const filteredStores = stores.filter(store => 
    store.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.ownerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Upper Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-900 pb-4 gap-4">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            👑 لوحة تحكم المالك العام والفروع الذكية
          </h2>
          <p className="text-zinc-500 text-[10px]/relaxed mt-0.5">تحليل أداء شجرة الفروع الكاملة، تعيين الصلاحيات القيادية، تجميد الحسابات ومتابعة أداء الورش الموحد.</p>
        </div>

        <button
          onClick={() => {
            setFormError('');
            setIsAddStoreOpen(true);
          }}
          className="px-4 py-2 bg-[#f1c40f] hover:bg-[#d2ac0a] text-black font-black text-xs rounded transition flex items-center gap-2 cursor-pointer shadow-lg"
        >
          <Plus size={15} />
          إنشاء فرع وتوكيل جديد
        </button>
      </div>

      {/* Analytics Overview Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-br from-[#0a0a0a] to-[#040404] border border-zinc-900 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-zinc-550 text-[10px] block font-bold">الفروع المرخصة المسجلة</span>
            <span className="text-xl font-black text-white mt-1 block font-mono">{stores.length} فرع</span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Building size={20} />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-[#0a0a0a] to-[#040404] border border-zinc-900 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-zinc-550 text-[10px] block font-bold">الكادر الموظف الإجمالي</span>
            <span className="text-xl font-black text-white mt-1 block font-mono">{users.length} شريك</span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-505 border border-indigo-550/20">
            <Users size={20} />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-[#0a0a0a] to-[#040404] border border-zinc-900 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-zinc-550 text-[10px] block font-bold">حالة البث الموحد</span>
            <span className="text-xs text-green-400 mt-2 block font-extrabold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
              قنوات الاتصال نشطة
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Activity size={20} />
          </div>
        </div>
      </div>

      {/* Search and control filter */}
      <div className="relative">
        <span className="absolute inset-y-0 right-3 flex items-center text-zinc-500">
          <Search size={16} />
        </span>
        <input
          type="text"
          placeholder="ابحث عن الفروع بـ معرف الإنجليزية، اسم المحل، أو اسم الوكيل المالي..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-4 pr-10 py-2.5 bg-[#080808] border border-zinc-900 rounded-xl text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-amber-600/50"
        />
      </div>

      {/* Grid of registered stores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStores.map(store => {
          const storeStaff = users.filter(u => u.ownerId === store.id || u.uid === store.ownerId);
          const isSuspended = store.status === 'suspended';

          return (
            <div
              key={store.id}
              className={`p-5 rounded-2xl border bg-gradient-to-br from-[#0c0c0c] to-[#040404] transition flex flex-col justify-between h-48 ${
                isSuspended 
                  ? 'border-rose-950/40 opacity-60' 
                  : 'border-zinc-900 hover:border-zinc-800'
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                      {store.name}
                      <span className="text-[9px] bg-zinc-900 text-zinc-500 px-1.5 py-0.5 rounded font-mono font-normal">
                        #{store.id}
                      </span>
                    </h4>
                    <p className="text-[10px] text-zinc-550 mt-1">{store.slogan || 'بدون شعار فاتورة مخصص'}</p>
                  </div>
                  
                  {isSuspended ? (
                    <span className="px-2 py-0.5 bg-rose-950/50 border border-rose-900/60 text-rose-400 text-[10px] font-bold rounded-lg animate-pulse">مجمّد ❄️</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-950/50 border border-emerald-900/65 text-emerald-400 text-[10px] font-bold rounded-lg">نشط ومفعل ✨</span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1 text-zinc-500">
                    <MapPin size={12} />
                    <span className="line-clamp-1">{store.address || 'صنعاء - التحرير'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-500">
                    <Users size={12} />
                    <span>الكادر: {storeStaff.length} موظف</span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-500">
                    <Phone size={12} />
                    <span>الهاتف: {store.phone || store.ownerPhone || 'لا يوجد'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-500">
                    <Compass size={12} />
                    <span>النشاط: {store.businessType === 'motorcycles' ? 'موتورات 🏍️' : 'هواتف 📱'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-zinc-950 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => onSelectWorkingStore(store.id)}
                  className="px-3.5 py-1.5 bg-amber-600/10 hover:bg-amber-600/20 text-[#f1c40f] border border-amber-600/30 rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                >
                  <Eye size={12} />
                  انتقل للإشراف والإدارة ⚙️
                </button>

                <div className="text-[9px] text-zinc-500 font-mono">
                  المدير: {store.ownerName || 'أبو جواد'}
                </div>
              </div>
            </div>
          );
        })}

        {filteredStores.length === 0 && (
          <div className="col-span-full py-16 text-center text-zinc-600 text-xs">
            لا توجد فروع ترخيص مطابقة للبحث الآن.
          </div>
        )}
      </div>

      {/* Model Create Store */}
      <AnimatePresence>
        {isAddStoreOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsAddStoreOpen(false)} 
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
                  <Building2 size={16} className="text-amber-500" />
                  تسجيل وترخيص فرع تجاري جديد بنظام JAM
                </h3>
                <button 
                  onClick={() => setIsAddStoreOpen(false)} 
                  className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg text-xs"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-950/40 border border-rose-900/50 text-rose-350 text-xs rounded-xl mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmitStore} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-bold">مُعرّف الفرع الفريد بالإنجليزية (ID - بدون مسافات)</label>
                  <input
                    type="text"
                    required
                    value={newStore.id}
                    onChange={(e) => setNewStore({ ...newStore, id: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900/60 border border-zinc-805/50 rounded-xl text-white text-center font-mono focus:outline-none focus:border-amber-600"
                    placeholder="e.g. shammari, alfarouk, aden_branch"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1.5 font-bold">الاسم التجاري المعتمد للفرع</label>
                  <input
                    type="text"
                    required
                    value={newStore.name}
                    onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900/60 border border-zinc-805/50 rounded-xl text-white focus:outline-none focus:border-amber-600"
                    placeholder="مثال: محلات ومستودعات الشمري للدراجات"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold">اسم الوكيل/المدير المسؤول</label>
                    <input
                      type="text"
                      required
                      value={newStore.ownerName}
                      onChange={(e) => setNewStore({ ...newStore, ownerName: e.target.value })}
                      className="w-full p-2.5 bg-zinc-900/60 border border-zinc-805/50 rounded-xl text-white focus:outline-none focus:border-amber-600"
                      placeholder="الأستاذ يحيى الشمري"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold">تليفون الوكيل المالي</label>
                    <input
                      type="text"
                      required
                      value={newStore.ownerPhone}
                      onChange={(e) => setNewStore({ ...newStore, ownerPhone: e.target.value })}
                      className="w-full p-2.5 bg-zinc-900/60 border border-zinc-805/50 rounded-xl text-white text-center font-mono focus:outline-none focus:border-amber-600"
                      placeholder="772315106"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold">طبيعة وترخيص القطاع</label>
                    <select
                      value={newStore.businessType}
                      onChange={(e) => setNewStore({ ...newStore, businessType: e.target.value as any })}
                      className="w-full p-2.5 bg-zinc-900/60 border border-zinc-805/50 rounded-xl text-white focus:outline-none focus:border-amber-600"
                    >
                      <option value="mobiles">صيانة ومبيعات جوالات 📱</option>
                      <option value="motorcycles">دراجات نارية وموتورات 🏍️</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold">عنوان الفرع الفعلي</label>
                    <input
                      type="text"
                      required
                      value={newStore.address}
                      onChange={(e) => setNewStore({ ...newStore, address: e.target.value })}
                      className="w-full p-2.5 bg-zinc-900/60 border border-zinc-805/50 rounded-xl text-white focus:outline-none focus:border-amber-600"
                      placeholder="صنعاء - شارع الستين"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#f1c40f] hover:bg-[#d2ac0a] text-black font-black rounded-lg transition text-center cursor-pointer"
                  >
                    ترخيص وتفعيل الفرع
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddStoreOpen(false)}
                    className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg transition text-center cursor-pointer"
                  >
                    إلغاء التراجع
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
