import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  PieChart, 
  Layers, 
  TrendingUp, 
  Briefcase,
  Users,
  ShieldCheck,
  Loader2,
  X
} from 'lucide-react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { CostCenter, JournalEntry, UserProfile } from '../../types';
import { financialAuditService } from '../../services/financialAuditService';

interface CostCentersManagerProps {
  profile: UserProfile;
}

export const CostCentersManager: React.FC<CostCentersManagerProps> = ({ profile }) => {
  const ownerId = profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<'branch' | 'department' | 'project'>('department');
  const [manager, setManager] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Initial default cost centers seeding if collection is empty
  const defaultPresets = [
    { code: 'CC-101', name: 'المركز الرئيسي / الإدارة العامة', type: 'department' as const, manager: 'المدير العام', budget: 1000000 },
    { code: 'CC-102', name: 'قسم المبيعات والتجزئة (المحل)', type: 'branch' as const, manager: 'مشرف المبيعات', budget: 500000 },
    { code: 'CC-103', name: 'قسم الصيانة وقطع الغيار', type: 'department' as const, manager: 'كبير الفنيين', budget: 300000 },
    { code: 'CC-104', name: 'المستودع والمخزن الرئيسي', type: 'department' as const, manager: 'أمين المستودع', budget: 200000 },
    { code: 'CC-105', name: 'خدمات التوصيل والشحن', type: 'department' as const, manager: 'مسؤول اللوجستيات', budget: 150000 }
  ];

  // Fetch Cost Centers
  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'costCenters'),
      where('ownerId', '==', ownerId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Automatically seed defaults
        for (const p of defaultPresets) {
          await financialAuditService.addCostCenter(ownerId, {
            ...p,
            operator: { uid: profile?.uid || 'admin', name: profile?.displayName || 'المدير' }
          });
        }
      } else {
        const list = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as CostCenter))
          .filter(c => c.active !== false);
        setCostCenters(list);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Cost centers listener error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ownerId]);

  // Fetch Journal Entries to calculate cost center expenses
  useEffect(() => {
    if (!ownerId) return;
    const q = query(
      collection(db, 'journalEntries'),
      where('ownerId', '==', ownerId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry));
      setJournalEntries(entries);
    });
    return () => unsubscribe();
  }, [ownerId]);

  // Calculate actual costs per cost center
  const costCenterAnalytics = useMemo(() => {
    const map: { [nameOrCode: string]: { totalExpense: number; totalRevenue: number; entryCount: number } } = {};

    journalEntries.forEach(entry => {
      if (entry.status === 'rejected') return;

      const mainCC = entry.costCenter;

      (entry.items || []).forEach(item => {
        const itemCC = item.costCenter || mainCC;
        if (itemCC) {
          if (!map[itemCC]) {
            map[itemCC] = { totalExpense: 0, totalRevenue: 0, entryCount: 0 };
          }
          map[itemCC].entryCount += 1;
          if (item.debit > 0) {
            map[itemCC].totalExpense += Number(item.debit);
          }
          if (item.credit > 0) {
            map[itemCC].totalRevenue += Number(item.credit);
          }
        }
      });
    });

    return map;
  }, [journalEntries]);

  // Filter cost centers
  const filteredCenters = useMemo(() => {
    return costCenters.filter(c => {
      if (selectedType !== 'ALL' && c.type !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.manager && c.manager.toLowerCase().includes(q));
      }
      return true;
    });
  }, [costCenters, selectedType, searchQuery]);

  const handleCreateCostCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setStatusMessage(null);
    try {
      await financialAuditService.addCostCenter(ownerId, {
        code: code.trim() || `CC-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        type,
        manager: manager.trim(),
        budget: parseFloat(budget) || 0,
        notes: notes.trim(),
        operator: {
          uid: profile?.uid || 'admin',
          name: profile?.displayName || profile?.name || 'المشرف',
          role: profile?.role || 'إدارة'
        }
      });

      setStatusMessage({ type: 'success', text: 'تم بنجاح إضافة مركز التكلفة الجديد وتفعيله بالنظام!' });
      setIsModalOpen(false);
      setCode('');
      setName('');
      setManager('');
      setBudget('');
      setNotes('');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'فشل حفظ مركز الكلفة: ' + (err?.message || err) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCenter = async (id: string, centerName: string) => {
    if (!window.confirm(`هل أنت متأكد من تعطيل مركز التكلفة "${centerName}"؟`)) return;
    try {
      await financialAuditService.deleteCostCenter(ownerId, id, centerName, {
        uid: profile?.uid || 'admin',
        name: profile?.displayName || 'المشرف'
      });
    } catch (err: any) {
      console.warn("Delete center error:", err);
    }
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case 'branch':
        return <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold">فرع / معرض 🏢</span>;
      case 'project':
        return <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold">مشروع تطوير 🏗️</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold">قسم تشغيلي 📂</span>;
    }
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-3 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full text-xs font-black flex items-center gap-1">
              <Building size={13} />
              <span>محرك مراكز التكلفة والمشاريع</span>
            </span>
            <span className="p-1 px-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full text-[11px] font-bold">
              Cost Centers Analytics
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5 mt-2">
            <Layers className="text-purple-400" size={24} />
            <span>إدارة مراكز التكلفة والفروع والمشاريع</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            توزيع وتتبع المصروفات والإيرادات والميزانيات التقديرية حسب الفروع والأقسام والمشاريع المستقلة.
          </p>
        </div>

        <button
          onClick={() => {
            setCode(`CC-${Math.floor(100 + Math.random() * 900)}`);
            setIsModalOpen(true);
          }}
          className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs md:text-sm rounded-2xl shadow-xl shadow-purple-600/20 transition-all flex items-center gap-2 cursor-pointer border-none"
        >
          <Plus size={16} />
          <span>إضافة مركز كلفة جديد +</span>
        </button>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${
          statusMessage.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
        }`}>
          {statusMessage.type === 'error' ? <AlertCircle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 p-4 md:p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="بحث باسم المركز، الكود، أو المدير المسؤول..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 text-white pr-10 pl-4 py-2.5 text-xs rounded-xl outline-none focus:border-purple-500 font-bold"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 text-purple-300 p-2.5 text-xs rounded-xl font-bold outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL">-- كل الأنواع --</option>
            <option value="department">أقسام تشغيلية</option>
            <option value="branch">فروع ومعارض</option>
            <option value="project">مشاريع تطوير</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 space-y-2">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400" />
          <p className="text-xs font-bold">جاري تحميل بيانات مراكز التكلفة...</p>
        </div>
      ) : filteredCenters.length === 0 ? (
        <div className="p-12 text-center text-gray-400 space-y-2 bg-slate-900/50 rounded-3xl border border-white/5">
          <Building size={36} className="mx-auto text-gray-600 mb-2" />
          <p className="text-sm font-bold text-gray-300">لا توجد مراكز تكلفة مطابقة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCenters.map((center) => {
            const stats = costCenterAnalytics[center.name] || costCenterAnalytics[center.code] || { totalExpense: 0, totalRevenue: 0, entryCount: 0 };
            const budgetVal = center.budget || 0;
            const budgetPercent = budgetVal > 0 ? Math.min(100, Math.round((stats.totalExpense / budgetVal) * 100)) : 0;

            return (
              <div
                key={center.id}
                className="bg-slate-900/90 border border-white/10 hover:border-purple-500/40 rounded-3xl p-5 shadow-xl space-y-4 transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                        {center.code}
                      </span>
                      {getTypeBadge(center.type)}
                    </div>
                    <h3 className="text-base font-black text-white">{center.name}</h3>
                  </div>

                  <button
                    onClick={() => handleDeleteCenter(center.id, center.name)}
                    title="تعطيل مركز الكلفة"
                    className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Manager & Budget Details */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-2xl border border-white/5 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 block">المسؤول / المدير:</span>
                    <span className="font-bold text-gray-300 truncate block">{center.manager || 'غير محدد'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">الميزانية المعتمدة:</span>
                    <span className="font-bold text-amber-400 font-mono">
                      {budgetVal > 0 ? `${budgetVal.toLocaleString()} ر.ي` : 'مفتوحة'}
                    </span>
                  </div>
                </div>

                {/* Financial Actuals */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-rose-950/20 p-2.5 rounded-xl border border-rose-500/20">
                    <span className="text-[10px] text-rose-400 block font-bold">إجمالي المصروفات:</span>
                    <span className="font-black text-rose-300 font-mono text-sm">
                      {stats.totalExpense.toLocaleString()} ر.ي
                    </span>
                  </div>
                  <div className="bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 block font-bold">إجمالي الإيرادات:</span>
                    <span className="font-black text-emerald-300 font-mono text-sm">
                      {stats.totalRevenue.toLocaleString()} ر.ي
                    </span>
                  </div>
                </div>

                {/* Budget Utilization Progress Bar */}
                {budgetVal > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] font-bold text-gray-400">
                      <span>استهلاك الميزانية:</span>
                      <span className={budgetPercent > 90 ? 'text-rose-400 font-black' : 'text-purple-300'}>
                        {budgetPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all ${
                          budgetPercent > 90 ? 'bg-rose-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${budgetPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer Count */}
                <div className="text-[10px] text-gray-500 pt-2 border-t border-white/5 flex justify-between">
                  <span>القيود والسندات المرتبطة:</span>
                  <span className="font-mono font-bold text-gray-300">{stats.entryCount} حركة</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Cost Center Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-lg w-full space-y-5 text-right font-sans shadow-2xl" dir="rtl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Plus className="text-purple-400" size={18} />
                <span>إضافة مركز كلفة أو مشروع جديد</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCostCenter} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300 block">كود المركز:</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 text-purple-300 p-2.5 text-xs rounded-xl font-mono font-bold outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300 block">نوع الكيان:</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/10 text-white p-2.5 text-xs rounded-xl font-bold outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="department">قسم تشغيلي</option>
                    <option value="branch">فرع / معرض</option>
                    <option value="project">مشروع تطوير</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-300 block">اسم مركز التكلفة: *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: قسم الصيانة، فرع المنصورة، مشروع المتجر الإلكتروني..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 text-white p-2.5 text-xs rounded-xl font-bold outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300 block">المسؤول / المدير:</label>
                  <input
                    type="text"
                    placeholder="اسم المشرف أو المدير"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 text-white p-2.5 text-xs rounded-xl font-bold outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-300 block">الميزانية التقديرية (ر.ي):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 text-amber-300 p-2.5 text-xs font-mono rounded-xl font-bold outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-300 block">ملاحظات وشرح:</label>
                <input
                  type="text"
                  placeholder="وصف مختصر للغرض من مركز الكلفة"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 text-white p-2.5 text-xs rounded-xl font-bold outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black cursor-pointer border-none flex items-center gap-1.5"
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>حفظ وتفعيل المركز</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CostCentersManager;
