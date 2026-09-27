import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Calendar, 
  User, 
  Layers, 
  ArrowUpDown, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  Filter, 
  Download, 
  RefreshCw,
  AlertTriangle,
  History,
  Tag
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { FinancialAuditLog, UserProfile } from '../../types';

interface FinancialAuditTrailProps {
  profile: UserProfile;
}

export const FinancialAuditTrail: React.FC<FinancialAuditTrailProps> = ({ profile }) => {
  const [logs, setLogs] = useState<FinancialAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<FinancialAuditLog | null>(null);

  const ownerId = profile?.ownerId || localStorage.getItem('jam_admin_store_id') || 'main_store';

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'financialAuditLogs'),
      where('ownerId', '==', ownerId),
      orderBy('timestamp', 'desc'),
      limit(150)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs: FinancialAuditLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FinancialAuditLog));
      setLogs(fetchedLogs);
      setLoading(false);
    }, (error) => {
      console.warn("Audit logs listener warning:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ownerId]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (selectedAction !== 'ALL' && log.action !== selectedAction) return false;
      if (selectedEntity !== 'ALL' && log.entityType !== selectedEntity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (log.actionTitle || '').toLowerCase().includes(q);
        const matchUser = (log.userName || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        const matchEntityId = (log.entityId || '').toLowerCase().includes(q);
        if (!matchTitle && !matchUser && !matchDetails && !matchEntityId) return false;
      }
      return true;
    });
  }, [logs, selectedAction, selectedEntity, searchQuery]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-black">إنشاء +</span>;
      case 'APPROVE':
        return <span className="px-2.5 py-1 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg text-xs font-black">اعتماد وترحيل ✓</span>;
      case 'REJECT':
      case 'DELETE':
        return <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-black">إلغاء / رفض ✗</span>;
      case 'UPDATE':
        return <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-black">تعديل ✏️</span>;
      case 'RECONCILE':
        return <span className="px-2.5 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-black">تسوية بنكية ⚖️</span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg text-xs font-black">{action}</span>;
    }
  };

  const getEntityLabel = (type: string) => {
    switch (type) {
      case 'journal_entry':
        return 'سند قيد يومية';
      case 'voucher':
        return 'سند مالي';
      case 'account':
        return 'حساب دليل';
      case 'bank_reconciliation':
        return 'تسوية ومطابقة بنكية';
      case 'cost_center':
        return 'مركز تكلفة';
      case 'system_closing':
        return 'إقفال حسابات';
      default:
        return type;
    }
  };

  const formatLogDate = (timestamp: any) => {
    if (!timestamp) return 'الآن';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ar-YE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-3 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-full text-xs font-black flex items-center gap-1">
              <ShieldCheck size={13} />
              <span>رقابة وتدقيق الحركات المالية</span>
            </span>
            <span className="p-1 px-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[11px] font-bold">
              سجل غير قابل للتعديل (Immutable)
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5 mt-2">
            <History className="text-sky-400" size={24} />
            <span>سجل تدقيق ورقابة العمليات المحاسبية (Audit Trail)</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            توثيق زمني كامل لكافة عمليات إنشاء واعتماد وتعديل وإلغاء القيود والتسويات البنكية مع الاحتفاظ بالحالة قبل وبعد العملية.
          </p>
        </div>

        <div className="bg-slate-950 p-3 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-gray-500 font-bold block">إجمالي السجلات المرصودة</span>
            <span className="text-lg font-mono font-black text-sky-400">{logs.length} عملية</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 p-4 md:p-5 rounded-2xl border border-white/10 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="بحث في البيان، المستخدم، أو رقم السند..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 text-white pr-9 pl-3 py-2.5 text-xs rounded-xl outline-none focus:border-sky-500 font-bold"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 text-amber-300 p-2.5 text-xs rounded-xl font-bold outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">-- كل أنواع العمليات --</option>
              <option value="CREATE">إنشاء قيد / حركة</option>
              <option value="APPROVE">اعتماد وترحيل</option>
              <option value="UPDATE">تعديل قيد</option>
              <option value="REJECT">إلغاء / رفض</option>
              <option value="RECONCILE">تسوية ومطابقة بنكية</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 text-sky-300 p-2.5 text-xs rounded-xl font-bold outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="ALL">-- كل الكيانات المالية --</option>
              <option value="journal_entry">قيود اليومية العامة</option>
              <option value="voucher">سندات القبض والصرف</option>
              <option value="bank_reconciliation">مذكرات التسوية البنكية</option>
              <option value="cost_center">مراكز التكلفة</option>
              <option value="account">دليل الحسابات</option>
            </select>
          </div>

          {/* Refresh / Reset */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedAction('ALL');
                setSelectedEntity('ALL');
              }}
              className="flex-1 py-2.5 px-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>إعادة ضبط</span>
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold">جاري تحميل سجلات التدقيق والرقابة المالية...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-2">
            <History size={36} className="mx-auto text-gray-600 mb-2" />
            <p className="text-sm font-bold text-gray-300">لا توجد عمليات مطابقة لخيارات البحث الحالية</p>
            <p className="text-xs text-gray-500">يتم تسجيل كل قيد وتعديل واعتماد آلياً في هذا السجل فور تنفيذه.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-white/10 text-gray-400 text-xs font-bold">
                  <th className="p-4">التاريخ والوقت</th>
                  <th className="p-4">النوع / الإجراء</th>
                  <th className="p-4">البيان وعنوان العملية</th>
                  <th className="p-4">الكيان المالي</th>
                  <th className="p-4">المستخدم والمنفذ</th>
                  <th className="p-4 text-center">التفاصيل والفحص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs font-bold">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Timestamp */}
                    <td className="p-4 text-gray-300 font-mono text-[11px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-gray-500" />
                        <span>{formatLogDate(log.timestamp)}</span>
                      </div>
                    </td>

                    {/* Action Badge */}
                    <td className="p-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Title & Details */}
                    <td className="p-4">
                      <div className="font-bold text-white max-w-xs md:max-w-md truncate">
                        {log.actionTitle}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate max-w-xs md:max-w-md font-normal mt-0.5">
                        {log.details}
                      </div>
                    </td>

                    {/* Entity */}
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-white/5 text-gray-300 rounded-lg text-[11px]">
                        {getEntityLabel(log.entityType)}
                      </span>
                    </td>

                    {/* User */}
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px] font-black">
                          {log.userName ? log.userName.charAt(0) : 'U'}
                        </div>
                        <div>
                          <span className="text-white block text-xs">{log.userName || 'النظام'}</span>
                          <span className="text-[10px] text-gray-500 block font-normal">{log.userRole || 'مشرف'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Inspector Trigger */}
                    <td className="p-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLogForDetails(log)}
                        className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 mx-auto transition-all cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>فحص الأثر</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Before / After Snapshot Inspector Modal */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 text-right font-sans shadow-2xl" dir="rtl">
            
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <span className="text-xs text-sky-400 font-black">بطاقة تدقيق وفحص العملية</span>
                <h3 className="text-lg font-black text-white mt-1">{selectedLogForDetails.actionTitle}</h3>
                <span className="text-xs text-gray-400">{formatLogDate(selectedLogForDetails.timestamp)}</span>
              </div>
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Operator and Entity Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border border-white/10 text-xs">
              <div>
                <span className="text-gray-500 block text-[11px]">المستخدم المنفذ:</span>
                <span className="font-bold text-white">{selectedLogForDetails.userName}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">الرتبة / الصلاحية:</span>
                <span className="font-bold text-amber-300">{selectedLogForDetails.userRole || 'مشرف'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">الكيان المالي:</span>
                <span className="font-bold text-sky-300">{getEntityLabel(selectedLogForDetails.entityType)}</span>
              </div>
            </div>

            {/* Detailed Description */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 text-xs text-gray-300 space-y-1">
              <span className="text-gray-400 font-bold block">ملخص التغيير والأثر المالي:</span>
              <p className="leading-relaxed font-sans">{selectedLogForDetails.details}</p>
            </div>

            {/* Before vs After Snapshots */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-gray-300">لقطة البيانات قبل وبعد العملية (State Snapshot):</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                
                {/* Before State */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-rose-500/20 space-y-2">
                  <span className="text-[11px] font-black text-rose-400 block border-b border-rose-500/20 pb-1">
                    الحالة السابقة (Before):
                  </span>
                  {selectedLogForDetails.beforeState ? (
                    <pre className="text-[11px] font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-48 p-2 bg-black/40 rounded-xl">
                      {JSON.stringify(selectedLogForDetails.beforeState, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-gray-500 text-xs italic block p-2">لا توجد حالة سابقة (إنشاء أولي جديد)</span>
                  )}
                </div>

                {/* After State */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/20 space-y-2">
                  <span className="text-[11px] font-black text-emerald-400 block border-b border-emerald-500/20 pb-1">
                    الحالة بعد التعديل (After):
                  </span>
                  {selectedLogForDetails.afterState ? (
                    <pre className="text-[11px] font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-48 p-2 bg-black/40 rounded-xl">
                      {JSON.stringify(selectedLogForDetails.afterState, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-gray-500 text-xs italic block p-2">لا توجد بيانات لاحقة</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FinancialAuditTrail;
