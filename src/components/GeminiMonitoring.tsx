import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Activity, 
  Key, 
  History, 
  ToggleLeft, 
  ToggleRight,
  Database,
  BarChart3,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, where, orderBy, getDoc, setDoc } from 'firebase/firestore';

interface GeminiKey {
  id: string;
  key_value: string;
  status: 'active' | 'inactive';
  error_count: number;
  last_used?: any;
  label?: string;
  createdAt?: any;
}

export default function GeminiMonitoring() {
  const [keys, setKeys] = useState<GeminiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Upgraded master settings and emergency controls state
  const [emergencyKey, setEmergencyKey] = useState<string>('');
  const [showEmergencyKey, setShowEmergencyKey] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');

  // Update Guard states
  const [guardVersion, setGuardVersion] = useState('2.5.0');
  const [guardMandatory, setGuardMandatory] = useState(false);
  const [guardStatus, setGuardStatus] = useState('');
  const [guardSaving, setGuardSaving] = useState(false);

  // Load current values on mount
  useEffect(() => {
    getDoc(doc(db, 'settings', 'app_config')).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.latestVersion) setGuardVersion(data.latestVersion);
        if (data.isMandatory !== undefined) setGuardMandatory(!!data.isMandatory);
      }
    }).catch(err => {
      console.error("Error loading app config: ", err);
    });
  }, []);

  const handlePublishUpdate = async () => {
    if (!guardVersion.trim()) {
      setGuardStatus('⚠️ يرجى إدخال رقم الإصدار');
      return;
    }
    setGuardSaving(true);
    setGuardStatus('جاري الحفظ والنشر...');
    try {
      await setDoc(doc(db, 'settings', 'app_config'), {
        latestVersion: guardVersion.trim(),
        isMandatory: guardMandatory,
        updatedAt: new Date()
      }, { merge: true });
      
      setGuardStatus('✅ تم نشر وتطبيق التحديث الفوري بنجاح!');
      setTimeout(() => setGuardStatus(''), 5050);
    } catch (e: any) {
      setGuardStatus('❌ فشل النشر: ' + (e?.message || e));
    } finally {
      setGuardSaving(false);
    }
  };

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.emergencyRecoveryKey) {
          setEmergencyKey(data.emergencyRecoveryKey);
        }
      }
    });
    return () => unsub();
  }, [currentUser]);

  const handleGenerateEmergencyKey = async () => {
    if (!currentUser) return;
    const key = Math.random().toString(36).substring(2, 10).toUpperCase();
    try {
      setGenerationStatus('جاري التوليد...');
      await updateDoc(doc(db, 'users', currentUser.uid), {
        emergencyRecoveryKey: key,
        updatedAt: serverTimestamp()
      });
      setGenerationStatus('✅ تم التوليد بنجاح!');
      setTimeout(() => setGenerationStatus(''), 4000);
    } catch (e: any) {
      setGenerationStatus('❌ فشل إنشاء المفتاح: ' + (e?.message || e));
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'gemini_keys'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const k = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeminiKey));
      setKeys(k);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gemini_keys');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;

    try {
      await addDoc(collection(db, 'gemini_keys'), {
        key_value: newKey.trim(),
        label: newLabel.trim() || `Key ${keys.length + 1}`,
        status: 'active',
        error_count: 0,
        createdAt: serverTimestamp()
      });
      setNewKey('');
      setNewLabel('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding key:', error);
    }
  };

  const toggleStatus = async (key: GeminiKey) => {
    try {
      await updateDoc(doc(db, 'gemini_keys', key.id), {
        status: key.status === 'active' ? 'inactive' : 'active',
        error_count: key.status === 'inactive' ? 0 : key.error_count // Reset errors when reactivating
      });
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const deleteKey = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المفتاح نهائياً؟')) return;
    try {
      await deleteDoc(doc(db, 'gemini_keys', id));
    } catch (error) {
      console.error('Error deleting key:', error);
    }
  };

  const resetErrors = async (id: string) => {
    try {
      await updateDoc(doc(db, 'gemini_keys', id), {
        error_count: 0,
        status: 'active'
      });
    } catch (error) {
      console.error('Error resetting errors:', error);
    }
  };

  const filteredKeys = keys.filter(k => 
    k.key_value.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (k.label || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: keys.length,
    active: keys.filter(k => k.status === 'active' && k.error_count < 3).length,
    inactive: keys.filter(k => k.status === 'inactive' || k.error_count >= 3).length,
    errors: keys.reduce((acc, k) => acc + k.error_count, 0)
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-navy-900/40 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-brand-primary/20 rounded-2xl text-brand-primary">
                <RefreshCw className="animate-spin-slow" size={32} />
             </div>
             <div>
                <h1 className="text-3xl font-black text-white tracking-tight">مراقب تدوير المفاتيح</h1>
                <p className="text-sm text-gray-400 font-bold">إدارة ديناميكية لمفاتيح Gemini AI لضمان استمرارية الخدمة</p>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="bg-navy-950/50 px-6 py-4 rounded-3xl border border-white/5 text-center min-w-[100px]">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">الإجمالي</p>
              <p className="text-2xl font-black text-white tabular-nums">{stats.total}</p>
           </div>
           <div className="bg-success/10 px-6 py-4 rounded-3xl border border-success/20 text-center min-w-[100px]">
              <p className="text-[10px] text-success/60 font-black uppercase tracking-widest mb-1">نشط</p>
              <p className="text-2xl font-black text-success tabular-nums">{stats.active}</p>
           </div>
           <div className="bg-danger/10 px-6 py-4 rounded-3xl border border-danger/20 text-center min-w-[100px]">
              <p className="text-[10px] text-danger/60 font-black uppercase tracking-widest mb-1">معطل</p>
              <p className="text-2xl font-black text-danger tabular-nums">{stats.inactive}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Control Panel */}
        <div className="lg:col-span-1 space-y-6">
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="w-full py-5 bg-brand-primary text-white rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-xl shadow-brand-primary/20 hover:scale-[1.02] transition-all"
          >
            <Plus size={24} />
            <span>إضافة مفتاح جديد</span>
          </button>

          <AnimatePresence>
            {isAdding && (
              <motion.form 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleAddKey}
                className="bg-navy-900/50 p-6 rounded-[2rem] border border-white/10 space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-black uppercase px-2">وصف المفتاح (اختياري)</label>
                  <input 
                    type="text" 
                    placeholder="مثال: مفتاح المطور الشخصي"
                    className="w-full bg-navy-950 border-none rounded-xl p-4 text-white font-bold"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-black uppercase px-2">قيمة المفتاح (API KEY)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="AIzaSy..."
                    className="w-full bg-navy-950 border-none rounded-xl p-4 text-white font-mono text-sm"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                   <button type="submit" className="flex-1 py-3 bg-white text-navy-950 rounded-xl font-black">حفظ المفتاح</button>
                   <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 bg-white/5 text-gray-400 rounded-xl font-bold">إلغاء</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="bg-navy-900/30 p-8 rounded-[2rem] border border-white/5 space-y-6">
             <div className="flex items-center gap-3 text-white">
                <BarChart3 className="text-brand-primary" size={24} />
                <h3 className="font-black">تحليلات النظام</h3>
             </div>
             
             <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-400 font-bold">معدل الخطأ الكلي:</span>
                   <span className="text-white font-black tabular-nums">{stats.errors} خطأ</span>
                </div>
                <div className="w-full h-2 bg-navy-950 rounded-full overflow-hidden">
                   <div 
                    className="h-full bg-danger transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (stats.errors / (keys.length * 3 || 1)) * 100)}%` }} 
                   />
                </div>
                <p className="text-[10px] text-gray-500 font-bold text-center">يتم حظر المفتاح تلقائياً بعد 3 أخطاء متتالية</p>
             </div>
          </div>
        </div>

        {/* Keys List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative mb-6">
             <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
             <input 
              type="text" 
              placeholder="بحث في المفاتيح المسجلة..."
              className="w-full bg-navy-900/50 border border-white/5 rounded-2xl py-4 pr-12 pl-6 text-white text-sm font-bold focus:ring-2 ring-brand-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>

          <div className="space-y-4">
             {loading ? (
               <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-brand-primary" size={48} />
               </div>
             ) : filteredKeys.length === 0 ? (
               <div className="bg-white/5 border border-dashed border-white/10 rounded-[2rem] py-20 text-center">
                  <Key className="mx-auto text-gray-600 mb-4" size={48} />
                  <p className="text-gray-500 font-bold">لا توجد مفاتيح مسجلة تطابق بحثك</p>
               </div>
             ) : (
               filteredKeys.map((key) => (
                 <motion.div 
                   layout
                   key={key.id}
                   className={`group relative bg-navy-900/40 p-6 rounded-[2rem] border transition-all ${
                     key.error_count >= 3 ? 'border-danger/30' : 
                     key.status === 'inactive' ? 'border-white/5' : 'border-success/30'
                   }`}
                 >
                   <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                         <div className={`p-3 rounded-2xl ${
                           key.error_count >= 3 ? 'bg-danger/20 text-danger' : 
                           key.status === 'inactive' ? 'bg-gray-800 text-gray-500' : 'bg-success/20 text-success'
                         }`}>
                           <Database size={24} />
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                               <h3 className="text-white font-black">{key.label}</h3>
                               {key.error_count >= 3 && (
                                 <span className="px-2 py-0.5 bg-danger/20 text-danger text-[8px] font-black rounded-lg uppercase">Blocked</span>
                               )}
                            </div>
                            <p className="text-xs font-mono text-gray-500 mt-0.5">{key.key_value.substring(0, 15)}••••••••••••{key.key_value.substring(key.key_value.length - 4)}</p>
                         </div>
                      </div>

                      <div className="flex items-center gap-2">
                         <div className="flex flex-col items-end px-4 border-r border-white/5">
                            <span className="text-[9px] text-gray-500 font-black uppercase">Errors</span>
                            <span className={`text-lg font-black tabular-nums transition-colors ${key.error_count > 0 ? (key.error_count >= 3 ? 'text-danger' : 'text-orange-500') : 'text-gray-400'}`}>
                              {key.error_count}/3
                            </span>
                         </div>
                         
                         <div className="flex gap-1">
                            <button 
                              onClick={() => toggleStatus(key)}
                              className={`p-3 rounded-xl transition-all ${
                                key.status === 'active' ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                              }`}
                              title={key.status === 'active' ? 'تعطيل' : 'تفعيل'}
                            >
                              {key.status === 'active' ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                            </button>
                            
                            <button 
                              onClick={() => resetErrors(key.id)}
                              className="p-3 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-all"
                              title="تصفير الأخطاء"
                            >
                              <RefreshCw size={20} />
                            </button>

                            <button 
                              onClick={() => deleteKey(key.id)}
                              className="p-3 bg-danger/10 text-danger rounded-xl hover:bg-danger/20 transition-all"
                              title="حذف نهائي"
                            >
                              <Trash2 size={20} />
                            </button>
                         </div>
                      </div>
                   </div>

                   <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-4">
                         <div className="flex items-center gap-1.5">
                            <Clock size={12} />
                            <span>آخر استخدام: {key.last_used ? new Date(key.last_used).toLocaleString('ar-YE') : 'لم يستخدم بعد'}</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={12} className={key.status === 'active' ? 'text-success' : 'text-gray-600'} />
                            <span>الحالة: {key.status === 'active' ? 'نشط ومتاح' : 'متوقف يدوياً'}</span>
                         </div>
                      </div>
                      
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                         ID: {key.id}
                      </div>
                   </div>
                 </motion.div>
               ))
             )}
          </div>
        </div>
      </div>

      {/* Upgraded Owner Master Controls & Emergency Key Setup Block */}
      <div className="bg-gradient-to-b from-navy-900/60 to-[#0e213b] p-8 rounded-[2.5rem] border border-brand-primary/20 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-primary/20 rounded-2xl text-brand-primary">
              <ShieldAlert className="text-yellow-500 animate-pulse" size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">لوحة تحكم الطوارئ والترقيات العظمى (Master Controls)</h3>
              <p className="text-xs text-gray-400 font-bold">بوابة المطور والمالك لتعيين مفتاح الطوارئ (Emergency Key) وتأمين عمليات الخروج والصلاحيات العالية</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
          <div className="bg-navy-950/40 p-6 rounded-3xl border border-white/5 space-y-4">
            <h4 className="text-sm font-black text-brand-primary flex items-center gap-2">
              <Key size={16} />
              مفتاح استعادة الطوارئ الخاص بالمالك
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed font-bold">
              يُستخدم مفتاح الطوارئ لتجاوز بوابات التحقق الثنائي وحماية الحساب في حالات فقدان الرمز أو تعطل الأجهزة المحمولة الموثوقة.
            </p>
            
            <div className="space-y-4 pt-2">
              <button
                type="button"
                onClick={handleGenerateEmergencyKey}
                className="w-full py-4 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500 hover:text-navy-950 rounded-2xl text-xs font-black transition-all flex items-center justify-between px-5"
              >
                <span>توليد مفتاح استعادة الطوارئ (Emergency Key)</span>
                <RefreshCw size={14} />
              </button>

              {generationStatus && (
                <p className="text-xs text-center font-bold text-yellow-400 animate-pulse">{generationStatus}</p>
              )}

              {emergencyKey && (
                <div className="p-4 bg-navy-950/80 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 block">مفتاح الطوارئ الحالي</span>
                    <span className="font-mono text-base font-black tracking-widest text-[#ffd700]">
                      {showEmergencyKey ? emergencyKey : '••••••••'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEmergencyKey(!showEmergencyKey)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                  >
                    <Activity size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-navy-950/40 p-6 rounded-3xl border border-white/5 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-black text-amber-500 flex items-center gap-2 mb-2">
                <AlertTriangle size={16} />
                تأمين الاتصال والصيانة
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed font-bold">
                تصفير بصمات الأجهزة أو تدوير كافة الرموز المسجلة يعيد الأمان إلى الحالة الافتراضية لمنع الاختراقات المشبوهة. الرمز الافتراضي المعتمد لتصفير الحسابات هو المكون من 4 خانات (1234).
              </p>
            </div>
            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase">
              <span>الإدارة العليا للمتجر</span>
              <span>نشط دائمًا ✅</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin 15s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
