import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, Monitor, Smartphone, Trash2, Loader2, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onUserUpdated?: () => void;
}

export default function DeviceManagerModal({ isOpen, onClose, userId, onUserUpdated }: DeviceManagerModalProps) {
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null); // tracks deletion of a specific HWID

  // Limits
  const [maxPCs, setMaxPCs] = useState<number>(5);
  const [maxMobiles, setMaxMobiles] = useState<number>(5);

  const getPolicyRoleKey = (role: string): 'owner' | 'employee' | 'customer' => {
    const r = (role || '').toLowerCase();
    if (r === 'owner' || r === 'manager' || r === 'superadmin') return 'owner';
    if (r === 'employee' || r === 'engineer' || r === 'wholesaler' || r === 'distributor') return 'employee';
    return 'customer';
  };

  const loadUserDataAndLimits = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Fetch user document
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        const u = { uid: userSnap.id, ...userSnap.data() } as UserProfile;
        setUserData(u);

        // 2. Fetch system rules
        const policyRole = getPolicyRoleKey(u.role || '');
        let systemMaxPCs = 5;
        let systemMaxMobiles = 5;

        if (policyRole === 'employee') {
          systemMaxPCs = 2;
          systemMaxMobiles = 2;
        } else if (policyRole === 'customer') {
          systemMaxPCs = 1;
          systemMaxMobiles = 1;
        }

        try {
          const policySnap = await getDoc(doc(db, 'role_policies', 'device_policy'));
          if (policySnap.exists()) {
            const policyData = policySnap.data();
            if (policyData && policyData[policyRole]) {
              if (policyData[policyRole].max_allowed_pcs !== undefined) {
                systemMaxPCs = Number(policyData[policyRole].max_allowed_pcs);
              }
              if (policyData[policyRole].max_allowed_mobiles !== undefined) {
                systemMaxMobiles = Number(policyData[policyRole].max_allowed_mobiles);
              }
            }
          }
        } catch (err) {
          console.error("Error loading role policies in Modal:", err);
        }

        // Apply specific override or global fallback
        setMaxPCs(u.max_allowed_pcs !== undefined ? Number(u.max_allowed_pcs) : systemMaxPCs);
        setMaxMobiles(u.max_allowed_mobiles !== undefined ? Number(u.max_allowed_mobiles) : systemMaxMobiles);
      }
    } catch (err) {
      console.error("Failed to load user and device details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      loadUserDataAndLimits();
    } else {
      setUserData(null);
    }
  }, [isOpen, userId]);

  const handleRemoveDevice = async (type: 'pc' | 'mobile', hwidToRemove: string) => {
    if (!userData || !userId) return;
    if (!window.confirm("هل أنت متأكد من رغبتك في إلغاء ربط وإزالة هذا الجهاز؟")) return;

    setUpdating(hwidToRemove);
    try {
      const pcs = (userData.registered_pcs || []).filter(h => h !== hwidToRemove);
      const mobiles = (userData.registered_mobiles || []).filter(h => h !== hwidToRemove);

      await updateDoc(doc(db, 'users', userId), {
        registered_pcs: pcs,
        registered_mobiles: mobiles,
        updatedAt: new Date()
      });

      setUserData(prev => prev ? { ...prev, registered_pcs: pcs, registered_mobiles: mobiles } : null);
      if (onUserUpdated) onUserUpdated();
    } catch (err) {
      console.error("Error removing device:", err);
      alert("خطأ أثناء إزالة الجهاز: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleBypass = async () => {
    if (!userData || !userId) return;
    setUpdating('bypass');
    try {
      const newBypass = !userData.hwid_bypass;
      await updateDoc(doc(db, 'users', userId), {
        hwid_bypass: newBypass,
        updatedAt: new Date()
      });

      setUserData(prev => prev ? { ...prev, hwid_bypass: newBypass } : null);
      if (onUserUpdated) onUserUpdated();
    } catch (err) {
      console.error("Error setting bypass toggle:", err);
      alert("خطأ أثناء تعديل حالة الاستثناء: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUpdating(null);
    }
  };

  if (!isOpen) return null;

  const pcs = userData?.registered_pcs || [];
  const mobiles = userData?.registered_mobiles || [];
  const isCustomer = (userData?.role || '').toLowerCase() === 'customer';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose} 
          className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }} 
          className="relative w-full max-w-lg bg-navy-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden text-right"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-navy-800 to-navy-950 p-5 border-b border-white/5 flex items-center justify-between">
            <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Monitor className="text-amber-500 w-4 h-4" />
              إدارة أجهزة المستخدم [{userData?.name || '---'}]
            </h3>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="animate-spin text-amber-500 w-8 h-8" />
                <span className="text-xs text-slate-400 font-bold">جاري تحميل بيانات الأجهزة والترخيص...</span>
              </div>
            ) : (
              <>
                {/* User info details badge */}
                <div className="p-4 bg-navy-950/60 rounded-2xl border border-white/5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-md font-bold uppercase">{userData?.role || '---'}</span>
                    <span className="text-slate-400 text-xs font-bold">{userData?.email}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">UID: {userData?.uid}</p>
                </div>

                {/* Section 1: PCs */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/[0.03]">
                    <span className="text-xs font-black text-slate-300">أجهزة الكمبيوتر (PCs)</span>
                    <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                      {pcs.length} / {maxPCs}
                    </span>
                  </div>

                  {pcs.length === 0 ? (
                    <p className="text-[11px] text-slate-500 text-center py-3 italic">لا توجد أجهزة كمبيوتر مسجلة حالياً لهذا المستخدم.</p>
                  ) : (
                    <div className="space-y-2">
                      {pcs.map((hwid, idx) => (
                        <div key={`pc-${idx}`} className="flex items-center justify-between p-3 bg-navy-950/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                          <button
                            onClick={() => handleRemoveDevice('pc', hwid)}
                            disabled={updating === hwid}
                            className="px-2.5 py-1 bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-black transition duration-200 flex items-center gap-1 cursor-pointer"
                          >
                            {updating === hwid ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                            إزالة هذا الكمبيوتر
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-white font-semibold select-all">{hwid}</span>
                            <Monitor className="text-slate-500 w-3.5 h-3.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Mobiles */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/[0.03]">
                    <span className="text-xs font-black text-slate-300">أجهزة الجوال (Mobiles)</span>
                    <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
                      {mobiles.length} / {maxMobiles}
                    </span>
                  </div>

                  {mobiles.length === 0 ? (
                    <p className="text-[11px] text-slate-500 text-center py-3 italic">لا توجد أجهزة جوال مسجلة حالياً لهذا المستخدم.</p>
                  ) : (
                    <div className="space-y-2">
                      {mobiles.map((hwid, idx) => (
                        <div key={`mobile-${idx}`} className="flex items-center justify-between p-3 bg-navy-950/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                          <button
                            onClick={() => handleRemoveDevice('mobile', hwid)}
                            disabled={updating === hwid}
                            className="px-2.5 py-1 bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-black transition duration-200 flex items-center gap-1 cursor-pointer"
                          >
                            {updating === hwid ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                            إزالة هذا الجوال
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-white font-semibold select-all">{hwid}</span>
                            <Smartphone className="text-slate-500 w-3.5 h-3.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 3: Customer Exception Switch (Only if user has Role = Customer) */}
                {isCustomer && (
                  <div className="p-4 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 rounded-2xl border border-amber-500/10 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleToggleBypass}
                        disabled={updating === 'bypass'}
                        className="p-1 focus:outline-none focus:ring-0 transition"
                      >
                        {userData?.hwid_bypass ? (
                          <ToggleRight className="text-emerald-450 w-11 h-11" />
                        ) : (
                          <ToggleLeft className="text-slate-500 w-11 h-11" />
                        )}
                      </button>
                      <div className="text-right">
                        <span className="font-extrabold text-white text-xs block">استثناء الزبون من تقييد الأجهزة</span>
                        <span className="text-[9.5px] text-slate-400 leading-relaxed block">تجاوز قيود حد الأجهزة المسموحة والسماح له بالولوج دائماً دون التحقق من الـ HWID.</span>
                      </div>
                    </div>
                    {userData?.hwid_bypass && (
                      <div className="text-[10px] bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl font-bold flex items-center gap-1.5 justify-end">
                        <span>✓ نظام الاستثناء الأمني مفعل حالياً ومصنف كـ "آمن دائم"</span>
                        <ShieldCheck size={14} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Footer Information */}
            <div className="pt-4 border-t border-white/5 text-center">
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black transition cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
