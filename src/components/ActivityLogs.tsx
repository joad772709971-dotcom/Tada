import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { History, Search, Filter, User, Clock, Info, ArrowRightLeft, Trash2, Edit2, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  type: string;
  userId: string;
  userName: string;
  details: string;
  oldValue?: any;
  newValue?: any;
  createdAt: any;
}

interface ActivityLogsProps {
  profile: UserProfile | null;
}

export default function ActivityLogs({ profile }: ActivityLogsProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.ownerId) return;

    const q = query(
      collection(db, 'activityLogs'),
      where('ownerId', '==', profile.ownerId),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activityLogs');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const filteredLogs = logs.filter(log => {
    const userNameStr = log.userName || '';
    const detailsStr = log.details || '';
    const matchesSearch = 
      userNameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      detailsStr.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || log.type === filterType;
    return matchesSearch && matchesType;
  });

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'login': return <PlusCircle className="text-success" size={18} />;
      case 'logout': return <Trash2 className="text-danger" size={18} />;
      case 'update_price': return <Edit2 className="text-warning" size={18} />;
      case 'add_sale': return <ArrowRightLeft className="text-emerald-500" size={18} />;
      case 'delete_sale': return <Trash2 className="text-rose-500" size={18} />;
      case 'delete_invoice': return <Trash2 className="text-danger" size={18} />;
      case 'add_item': return <PlusCircle className="text-blue-500" size={18} />;
      case 'update_item': return <Edit2 className="text-amber-500" size={18} />;
      case 'add_maintenance': return <Info className="text-cyan-500" size={18} />;
      case 'restore_backup': return <PlusCircle className="text-purple-500" size={18} />;
      default: return <Info className="text-navy-700 dark:text-brand-primary" size={18} />;
    }
  };

  const getLogTypeLabel = (type: string) => {
    switch (type) {
      case 'login': return 'دخول';
      case 'logout': return 'خروج';
      case 'update_price': return 'تعديل سعر';
      case 'delete_invoice': return 'حذف فاتورة';
      case 'delete_sale': return 'حذف مبيعات';
      case 'add_item': return 'إضافة صنف';
      case 'update_item': return 'تعديل صنف';
      case 'add_sale': return 'عملية بيع/مرتجع';
      case 'add_maintenance': return 'طلب صيانة';
      case 'restore_backup': return 'نسخة احتياطية';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-navy-900 text-brand-primary rounded-2xl flex items-center justify-center shadow-lg">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-navy-900 dark:text-white">سجل العمليات والرقابة</h1>
            <p className="text-xs text-gray-500">مراقبة تحركات المستخدمين والعمليات الحساسة</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث في السجلات..." 
              className="input-field pr-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="input-field sm:w-40"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">كل العمليات</option>
            <option value="login">تسجيل الدخول</option>
            <option value="logout">تسجيل الخروج</option>
            <option value="add_item">إضافة صنف</option>
            <option value="update_item">تعديل صنف</option>
            <option value="update_price">تعديل الأسعار</option>
            <option value="add_sale">عملية بيع/مرتجع</option>
            <option value="delete_sale">حذف مبيعات</option>
            <option value="add_maintenance">طلبات الصيانة</option>
            <option value="restore_backup">نسخ احتياطية</option>
          </select>
        </div>
      </div>

      <div className="card-glass overflow-hidden shadow-xl border-navy-900/5">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-navy-900 text-white text-sm">
              <tr>
                <th className="p-4">العملية</th>
                <th className="p-4">المستخدم</th>
                <th className="p-4">التفاصيل</th>
                <th className="p-4">القيمة السابقة</th>
                <th className="p-4">القيمة الجديدة</th>
                <th className="p-4">التوقيت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
              <AnimatePresence mode="popLayout">
                {filteredLogs.map((log) => (
                  <motion.tr 
                    layout
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getLogIcon(log.type)}
                        <span className="font-bold text-sm">{getLogTypeLabel(log.type)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span className="text-sm font-medium">{log.userName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {log.details}
                    </td>
                    <td className="p-4 font-mono text-xs text-danger">
                      {log.oldValue !== undefined ? String(log.oldValue) : '---'}
                    </td>
                    <td className="p-4 font-mono text-xs text-success">
                      {log.newValue !== undefined ? String(log.newValue) : '---'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock size={12} />
                        {log.createdAt?.toDate ? format(log.createdAt.toDate(), 'yyyy/MM/dd HH:mm', { locale: ar }) : '...'}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredLogs.length === 0 && !isLoading && (
            <div className="p-20 text-center space-y-4">
              <div className="w-20 h-20 bg-gray-100 dark:bg-navy-900 rounded-full flex items-center justify-center mx-auto text-gray-300">
                <History size={40} />
              </div>
              <p className="text-gray-500 font-bold">لا توجد سجلات تطابق البحث</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-widest pt-4">
        <span>نظام JAM System Pro - الرقابة الإدارية</span>
        <span>المطور عبدالغني المحفلي</span>
      </div>
    </div>
  );
}
