import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Search, 
  Trash2, 
  Plus, 
  Database,
  History,
  X,
  Loader2,
  TrendingDown,
  User,
  Users,
  Building2,
  Store,
  PieChart,
  Check,
  Eye,
  FileText,
  DollarSign
} from 'lucide-react';
import { collection, addDoc, onSnapshot, query, where, orderBy, updateDoc, doc, serverTimestamp, increment, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { logActivity } from '../services/activityLogService';
import { InventoryItem, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale/ar';
import ConfirmModal from './ConfirmModal';
import { chargeDamageToEmployee } from '../services/PayrollService';
import { postReturnOrLossToLedger } from '../services/InventoryLossesService';
import { AutomatedJournalEngine } from '../services/AutomatedJournalEngine';

interface DamagedItemsProps {
  profile: UserProfile | null;
}

export default function DamagedItems({ profile }: DamagedItemsProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [damagedRecords, setDamagedRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  // Responsibility Target State
  const [responsibilityTarget, setResponsibilityTarget] = useState<'single_employee' | 'multiple_employees' | 'supplier' | 'customer' | 'store' | 'split_store_employee'>('store');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [storeSplitPercent, setStoreSplitPercent] = useState<number>(50); // Store % in split_store_employee

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewRecordModal, setViewRecordModal] = useState<any | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('damaged'); // damaged, lost, expired, return_to_supplier
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters for table
  const [filterReason, setFilterReason] = useState<string>('all');
  const [filterTarget, setFilterTarget] = useState<string>('all');

  useEffect(() => {
    if (!profile?.ownerId) return;

    // 1. Inventory Items
    const qInv = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    const unsubInv = onSnapshot(qInv, (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'inventory');
    });

    // 2. Damaged Records
    const qDamaged = query(
      collection(db, 'damaged_items'), 
      where('ownerId', '==', profile.ownerId),
      orderBy('createdAt', 'desc')
    );
    const unsubDamaged = onSnapshot(qDamaged, (snap) => {
      setDamagedRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'damaged_items');
    });

    // 3. Employees list
    const qEmp = query(collection(db, 'users'), where('ownerId', '==', profile.ownerId));
    const unsubEmp = onSnapshot(qEmp, (snap) => {
      setEmployees(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // 4. Suppliers list
    const qSup = query(collection(db, 'suppliers'), where('ownerId', '==', profile.ownerId));
    const unsubSup = onSnapshot(qSup, (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });

    // 5. Customers list
    const qCust = query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId));
    const unsubCust = onSnapshot(qCust, (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    return () => {
      unsubInv();
      unsubDamaged();
      unsubEmp();
      unsubSup();
      unsubCust();
    };
  }, [profile]);

  const toggleEmployeeSelection = (empUid: string) => {
    if (selectedEmployeeIds.includes(empUid)) {
      setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== empUid));
    } else {
      setSelectedEmployeeIds([...selectedEmployeeIds, empUid]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || quantity <= 0 || isSubmitting) return;

    // Validate selections according to target
    if (responsibilityTarget === 'single_employee' && !selectedEmployeeId) {
      alert('يرجى اختيار الموظف المسؤول أولاً');
      return;
    }
    if (responsibilityTarget === 'multiple_employees' && selectedEmployeeIds.length === 0) {
      alert('يرجى اختيار موظف واحد على الأقل للمسؤولية المشتركة');
      return;
    }
    if (responsibilityTarget === 'split_store_employee' && !selectedEmployeeId) {
      alert('يرجى اختيار الموظف للشراكة في تحمل التكلفة مع المحل');
      return;
    }
    if (responsibilityTarget === 'supplier' && !selectedSupplierId) {
      alert('يرجى اختيار المورد المسؤول عن التالف أو المردود');
      return;
    }
    if (responsibilityTarget === 'customer' && !selectedCustomerId) {
      alert('يرجى اختيار عميل المحل المسؤول عن التالف');
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const totalCost = quantity * selectedItem.cost;
      const effectiveLoss = reason === 'return_to_supplier' ? 0 : totalCost;

      // Construct breakdown object for accounting & UI tracking
      let breakdownDetails: any = {
        target: responsibilityTarget,
        breakdownText: '',
        participants: []
      };

      if (responsibilityTarget === 'single_employee') {
        const emp = employees.find(e => e.uid === selectedEmployeeId);
        breakdownDetails.breakdownText = `على الموظف: ${emp?.name || 'غير معروف'} (100%)`;
        breakdownDetails.participants.push({
          type: 'employee',
          uid: selectedEmployeeId,
          name: emp?.name,
          amount: totalCost,
          percentage: 100
        });
      } else if (responsibilityTarget === 'multiple_employees') {
        const count = selectedEmployeeIds.length;
        const sharePerEmp = totalCost / count;
        const percentPerEmp = Math.round(100 / count);
        const empNames = selectedEmployeeIds.map(id => employees.find(e => e.uid === id)?.name || id).join(', ');
        breakdownDetails.breakdownText = `موزعة بالتقاسم على ${count} موظفين (${empNames})`;
        selectedEmployeeIds.forEach(id => {
          const emp = employees.find(e => e.uid === id);
          breakdownDetails.participants.push({
            type: 'employee',
            uid: id,
            name: emp?.name,
            amount: sharePerEmp,
            percentage: percentPerEmp
          });
        });
      } else if (responsibilityTarget === 'split_store_employee') {
        const emp = employees.find(e => e.uid === selectedEmployeeId);
        const storeShare = (totalCost * storeSplitPercent) / 100;
        const empShare = totalCost - storeShare;
        breakdownDetails.breakdownText = `مقسمة بين المحل (${storeSplitPercent}%) والموظف ${emp?.name} (${100 - storeSplitPercent}%)`;
        breakdownDetails.participants.push(
          { type: 'store', name: 'المحل', amount: storeShare, percentage: storeSplitPercent },
          { type: 'employee', uid: selectedEmployeeId, name: emp?.name, amount: empShare, percentage: 100 - storeSplitPercent }
        );
      } else if (responsibilityTarget === 'supplier') {
        const sup = suppliers.find(s => s.id === selectedSupplierId);
        breakdownDetails.breakdownText = `على حساب المورد: ${sup?.name || 'غير معروف'}`;
        breakdownDetails.participants.push({
          type: 'supplier',
          id: selectedSupplierId,
          name: sup?.name,
          amount: totalCost,
          percentage: 100
        });
      } else if (responsibilityTarget === 'customer') {
        const cust = customers.find(c => c.id === selectedCustomerId);
        breakdownDetails.breakdownText = `على حساب عميل المحل: ${cust?.name || 'غير معروف'}`;
        breakdownDetails.participants.push({
          type: 'customer',
          id: selectedCustomerId,
          name: cust?.name,
          amount: totalCost,
          percentage: 100
        });
      } else { // store
        breakdownDetails.breakdownText = `تحمل المحل الكامل للمصروف/الخسارة (100%)`;
        breakdownDetails.participants.push({
          type: 'store',
          name: 'المحل',
          amount: totalCost,
          percentage: 100
        });
      }

      // 1. Create Damaged Record in Firestore
      const recordRef = doc(collection(db, 'damaged_items'));
      batch.set(recordRef, {
        ownerId: profile?.ownerId,
        operated_by_employee_name: profile?.name || 'غير معروف',
        employee_uid: profile?.uid || 'غير معروف',
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        itemBarcode: selectedItem.barcode || '',
        quantity,
        cost: selectedItem.cost,
        totalLoss: effectiveLoss,
        reason,
        note,
        recordedBy: profile?.name,
        responsibilityTarget,
        responsibilityBreakdown: breakdownDetails,
        createdAt: serverTimestamp()
      });

      // 2. Reduce Inventory Stock
      const invRef = doc(db, 'inventory', selectedItem.id);
      batch.update(invRef, {
        stock: increment(-quantity),
        updatedAt: serverTimestamp()
      });

      // 3. Execution of financial posting based on responsibility
      if (responsibilityTarget === 'supplier') {
        const supRef = doc(db, 'suppliers', selectedSupplierId);
        batch.update(supRef, {
          debt: increment(-totalCost), // Reduce payable debt to supplier
          updatedAt: serverTimestamp()
        });
      } else if (responsibilityTarget === 'customer') {
        const custRef = doc(db, 'customers', selectedCustomerId);
        batch.update(custRef, {
          debt: increment(totalCost), // Add debt to customer for damaged item
          updatedAt: serverTimestamp()
        });
      } else if (responsibilityTarget === 'store') {
        const transRef = doc(collection(db, 'transactions'));
        batch.set(transRef, {
          ownerId: profile?.ownerId,
          operated_by_employee_name: profile?.name || 'غير معروف',
          employee_uid: profile?.uid || 'غير معروف',
          type: 'expense',
          amount: totalCost,
          category: 'damaged_loss',
          description: `خسارة تالف/فاقد مخزني (حساب المحل): ${selectedItem.name} (${quantity} حبة)`,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();

      // Ledger posting via Advanced Automated Journal Engine
      if (profile?.ownerId) {
        await postReturnOrLossToLedger({
          ownerId: profile.ownerId,
          type: reason === 'return_to_supplier' ? 'return' : 'loss',
          total: totalCost,
          paymentMethod: 'credit',
          items: [],
          notes: note || `${reason === 'return_to_supplier' ? 'مردود مورد' : 'تالف/مفقود'}: ${selectedItem.name} (${quantity} حبة) - ${breakdownDetails.breakdownText}`
        });

        const empNames = employees
          .filter(e => e.uid === selectedEmployeeId || selectedEmployeeIds.includes(e.uid))
          .map(e => e.name);

        await AutomatedJournalEngine.postEmployeeLossOrErrorVoucher({
          ownerId: profile.ownerId,
          storeId: profile.storeId || 'main_store',
          type: reason === 'damaged' ? 'damaged_goods' : 'inventory_shortage',
          totalCost: totalCost,
          responsibilityTarget: responsibilityTarget,
          employeeIds: selectedEmployeeIds.length > 0 ? selectedEmployeeIds : (selectedEmployeeId ? [selectedEmployeeId] : []),
          employeeNames: empNames,
          deductFrom: 'salary_payroll',
          storeSplitPercent: storeSplitPercent,
          itemName: selectedItem.name,
          quantity: quantity,
          notes: note || breakdownDetails.breakdownText
        });
      }

      // Charge employees directly if target includes employee shares
      if (reason !== 'return_to_supplier') {
        if (responsibilityTarget === 'single_employee' && selectedEmployeeId) {
          await chargeDamageToEmployee(selectedEmployeeId, totalCost, selectedItem.name, quantity);
        } else if (responsibilityTarget === 'multiple_employees' && selectedEmployeeIds.length > 0) {
          const share = totalCost / selectedEmployeeIds.length;
          await Promise.allSettled(
            selectedEmployeeIds.map(empId => chargeDamageToEmployee(empId, share, `${selectedItem.name} (تقاسم مع زملاء)`, quantity))
          );
        } else if (responsibilityTarget === 'split_store_employee' && selectedEmployeeId) {
          const empShare = totalCost * ((100 - storeSplitPercent) / 100);
          await chargeDamageToEmployee(selectedEmployeeId, empShare, `${selectedItem.name} (مساهمة المحل ${storeSplitPercent}%)`, quantity);
        }
      }

      await logActivity(
        profile, 
        'تسجيل تالف ومسؤولية', 
        `تم تسجيل ${quantity} حبة تالف من ${selectedItem.name}. [توزيع المسؤولية: ${breakdownDetails.breakdownText}]`
      );
      
      setStatus({ 
        type: 'success', 
        message: `تم تسجيل التالف وتحديث المخزون والخصوم بنجاح! (${breakdownDetails.breakdownText})`
      });
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error recording damaged item:', error);
      setStatus({ type: 'error', message: 'فشل تسجيل العملية' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setQuantity(1);
    setReason('damaged');
    setNote('');
    setResponsibilityTarget('store');
    setSelectedEmployeeId('');
    setSelectedEmployeeIds([]);
    setSelectedSupplierId('');
    setSelectedCustomerId('');
    setStoreSplitPercent(50);
  };

  const filteredInventoryItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.barcode?.includes(searchTerm)
  );

  const filteredRecords = damagedRecords.filter(r => {
    const matchesReason = filterReason === 'all' || r.reason === filterReason;
    const matchesTarget = filterTarget === 'all' || r.responsibilityTarget === filterTarget;
    return matchesReason && matchesTarget;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-glass p-6 border-l-4 border-danger shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-danger/10 text-danger rounded-2xl">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">إجمالي الخسائر والحدود</p>
              <h3 className="text-2xl font-black text-navy-900 dark:text-white">
                {damagedRecords.reduce((acc, r) => acc + (r.totalLoss || 0), 0).toLocaleString()} ر.ي
              </h3>
            </div>
          </div>
        </div>

        <div className="card-glass p-6 border-l-4 border-brand-primary shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-2xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">عمليات الهدر والفاقد</p>
              <h3 className="text-2xl font-black text-navy-900 dark:text-white">{damagedRecords.length} عملية</h3>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="card-glass p-6 border-2 border-dashed border-brand-primary/30 hover:border-brand-primary flex items-center justify-center gap-3 group transition-all cursor-pointer shadow-lg hover:shadow-xl"
        >
          <div className="p-3 bg-brand-primary text-white rounded-2xl group-hover:scale-110 transition-transform shadow-lg shadow-brand-primary/20">
            <Plus size={24} />
          </div>
          <span className="text-xl font-black text-navy-900 dark:text-white">تسجيل تالف/مفقود جديد</span>
        </button>
      </div>

      {/* History Table & Filters */}
      <div className="card-glass overflow-hidden shadow-xl border border-gray-100 dark:border-navy-700">
        <div className="p-6 bg-navy-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <History className="text-brand-primary" />
            <div>
              <h3 className="text-lg font-bold">سجل التالف وتوزيع المسؤوليات المخزنية</h3>
              <p className="text-xs text-gray-400">نظام توثيق وحساب الخسائر التالفة والمفقودة مع عزل المستأجرين</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={filterReason} 
              onChange={e => setFilterReason(e.target.value)}
              className="bg-navy-800 text-white text-xs font-bold px-3 py-2 rounded-xl border border-navy-700 outline-none"
            >
              <option value="all">جميع الأسباب</option>
              <option value="damaged">تالف (كسر/عطل)</option>
              <option value="lost">مفقود (نقص مخزن)</option>
              <option value="expired">منتهي الصلاحية</option>
              <option value="return_to_supplier">مردود للمورد</option>
            </select>

            <select 
              value={filterTarget} 
              onChange={e => setFilterTarget(e.target.value)}
              className="bg-navy-800 text-white text-xs font-bold px-3 py-2 rounded-xl border border-navy-700 outline-none"
            >
              <option value="all">جميع الجهات المسؤولة</option>
              <option value="single_employee">موظف واحد</option>
              <option value="multiple_employees">عدة موظفين</option>
              <option value="split_store_employee">مقسم بين المحل والموظف</option>
              <option value="supplier">المورد</option>
              <option value="customer">عميل المحل</option>
              <option value="store">المحل (مصروف)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 dark:bg-navy-900 border-b border-gray-100 dark:border-navy-700">
              <tr className="text-xs text-gray-400 font-black uppercase tracking-widest">
                <th className="p-4">التاريخ</th>
                <th className="p-4">الصنف</th>
                <th className="p-4">الكمية</th>
                <th className="p-4">التكلفة الإجمالية</th>
                <th className="p-4">السبب</th>
                <th className="p-4">توزيع المسؤولية والخصم</th>
                <th className="p-4">الموثق</th>
                <th className="p-4 text-center">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400 font-bold">لا توجد سجلات تالف أو مفقود مطابقة للفلتر.</td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 text-sm font-bold">
                      {record.createdAt?.toDate ? format(record.createdAt.toDate(), 'yyyy/MM/dd HH:mm', { locale: ar }) : '-'}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-navy-900 dark:text-white">{record.itemName}</p>
                      {record.itemBarcode && <p className="text-[10px] text-gray-400 font-mono">{record.itemBarcode}</p>}
                    </td>
                    <td className="p-4 font-black text-danger">{record.quantity} حبة</td>
                    <td className="p-4 font-black text-navy-900 dark:text-white">{(record.quantity * record.cost).toLocaleString()} ر.ي</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        record.reason === 'damaged' ? 'bg-orange-500/10 text-orange-500' :
                        record.reason === 'lost' ? 'bg-danger/10 text-danger' :
                        record.reason === 'return_to_supplier' ? 'bg-success/10 text-success' :
                        'bg-purple-500/10 text-purple-500'
                      }`}>
                        {record.reason === 'damaged' ? 'تالف' : 
                         record.reason === 'lost' ? 'مفقود' : 
                         record.reason === 'return_to_supplier' ? 'مردود مورد' : 
                         'منتهي الصلاحية'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-bold text-navy-800 dark:text-gray-200">
                        {record.responsibilityBreakdown?.breakdownText || record.responsibleEmployeeName || 'المحل (خسارة)'}
                      </div>
                    </td>
                    <td className="p-4 text-xs font-bold text-gray-400">{record.recordedBy || record.operated_by_employee_name}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => setViewRecordModal(record)}
                        className="p-2 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl transition-all cursor-pointer"
                        title="عرض كافة التفاصيل"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail View Modal */}
      <AnimatePresence>
        {viewRecordModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewRecordModal(null)} className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white dark:bg-navy-800 rounded-3xl p-6 shadow-2xl space-y-6 border border-gray-100 dark:border-navy-700">
              <div className="flex items-center justify-between border-b pb-4 border-gray-100 dark:border-navy-700">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-navy-900 dark:text-white">تفاصيل سجل التالف المخزني</h3>
                    <p className="text-xs text-gray-400">المعاملة #{viewRecordModal.id}</p>
                  </div>
                </div>
                <button onClick={() => setViewRecordModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-navy-700 rounded-full text-gray-400"><X size={18} /></button>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-navy-700">
                  <span className="text-gray-400">اسم الصنف:</span>
                  <span className="font-bold text-navy-900 dark:text-white">{viewRecordModal.itemName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-navy-700">
                  <span className="text-gray-400">الكمية المتضررة:</span>
                  <span className="font-black text-danger">{viewRecordModal.quantity} حبة</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-navy-700">
                  <span className="text-gray-400">تكلفة الحبة / الإجمالي:</span>
                  <span className="font-bold">{viewRecordModal.cost?.toLocaleString()} ر.ي / {(viewRecordModal.quantity * viewRecordModal.cost)?.toLocaleString()} ر.ي</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-navy-700">
                  <span className="text-gray-400">توزيع المسؤولية:</span>
                  <span className="font-bold text-brand-primary">{viewRecordModal.responsibilityBreakdown?.breakdownText || 'غير محدد'}</span>
                </div>
                {viewRecordModal.note && (
                  <div className="p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-700">
                    <p className="text-xs font-bold text-gray-400 mb-1">ملاحظات المسجل:</p>
                    <p className="text-xs font-medium text-navy-900 dark:text-white">{viewRecordModal.note}</p>
                  </div>
                )}
              </div>

              <button onClick={() => setViewRecordModal(null)} className="btn-secondary w-full py-3 rounded-2xl font-bold">إغلاق النافذة</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Entry Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsModalOpen(false)} 
              className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="relative w-full max-w-3xl bg-white dark:bg-navy-800 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 max-h-[90vh] flex flex-col"
            >
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-primary/20 rounded-2xl flex items-center justify-center">
                    <TrendingDown className="text-brand-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">تسجيل صنف تالف/مفقود وتحديد المسؤولية</h3>
                    <p className="text-[10px] text-brand-primary font-black uppercase tracking-[0.3em]">Inventory Write-off & Responsibility Engine</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white cursor-pointer">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Search Item */}
                <div className="space-y-3">
                  <label className="label-field text-right font-black">1. ابحث عن الصنف المتضرر أو المفقود</label>
                  <div className="relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      type="text" 
                      placeholder="اسم الصنف أو الباركود..."
                      className="input-field pr-12"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  {searchTerm && !selectedItem && (
                    <div className="mt-2 max-h-48 overflow-y-auto bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-700 divide-y divide-gray-100 dark:divide-navy-700">
                      {filteredInventoryItems.slice(0, 5).map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedItem(item);
                            setSearchTerm(item.name);
                          }}
                          className="w-full p-4 flex items-center justify-between hover:bg-brand-primary/5 transition-colors text-right cursor-pointer"
                        >
                          <div>
                            <p className="font-bold text-navy-900 dark:text-white">{item.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{item.category} | تكلفة الحبة: {item.cost?.toLocaleString()} ر.ي</p>
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-black text-brand-primary">{item.stock} متوفر بالمخزن</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedItem && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-brand-primary/5 rounded-3xl border border-brand-primary/20 space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-brand-primary/10 pb-4">
                      <div className="flex items-center gap-3">
                        <Database size={20} className="text-brand-primary" />
                        <span className="font-black text-navy-900 dark:text-white">{selectedItem.name}</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={resetForm}
                        className="text-xs font-bold text-danger hover:underline cursor-pointer"
                      >
                        تغيير الصنف
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">الكمية التالفة/المفقودة</label>
                        <div className="flex items-center gap-4 bg-white dark:bg-navy-800 p-2 rounded-2xl border border-gray-100 dark:border-navy-700">
                          <button 
                            type="button" 
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-navy-700 flex items-center justify-center font-bold cursor-pointer"
                          >-</button>
                          <input 
                            type="number" 
                            className="flex-1 text-center font-black text-xl bg-transparent outline-none"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Math.min(selectedItem.stock, Number(e.target.value))))}
                          />
                          <button 
                            type="button" 
                            onClick={() => setQuantity(q => Math.min(selectedItem.stock, q + 1))}
                            className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center font-bold shadow-lg shadow-brand-primary/20 cursor-pointer"
                          >+</button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">سبب الهدر</label>
                        <select 
                          className="w-full p-3 bg-white dark:bg-navy-800 border border-gray-100 dark:border-navy-700 rounded-2xl font-bold outline-none"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        >
                          <option value="damaged">تالف (كسر / عطل / ضرر)</option>
                          <option value="lost">مفقود (عجز مخزني / سرقة)</option>
                          <option value="expired">منتهي الصلاحية</option>
                          <option value="return_to_supplier">مردود للمورد (خصم من المديونية)</option>
                        </select>
                      </div>
                    </div>

                    {/* Responsibility Target Selector */}
                    <div className="space-y-4 pt-4 border-t border-brand-primary/10">
                      <label className="text-xs font-black text-navy-900 dark:text-white uppercase tracking-widest block">
                        2. توزيع المسؤولية المالية وتحميل التكلفة الإجمالية ({(quantity * selectedItem.cost).toLocaleString()} ر.ي):
                      </label>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setResponsibilityTarget('store')}
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            responsibilityTarget === 'store' 
                              ? 'bg-brand-primary text-white border-brand-primary shadow-md' 
                              : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700'
                          }`}
                        >
                          <Store size={16} />
                          المحل (مصروف)
                        </button>

                        <button
                          type="button"
                          onClick={() => setResponsibilityTarget('single_employee')}
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            responsibilityTarget === 'single_employee' 
                              ? 'bg-brand-primary text-white border-brand-primary shadow-md' 
                              : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700'
                          }`}
                        >
                          <User size={16} />
                          موظف واحد
                        </button>

                        <button
                          type="button"
                          onClick={() => setResponsibilityTarget('multiple_employees')}
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            responsibilityTarget === 'multiple_employees' 
                              ? 'bg-brand-primary text-white border-brand-primary shadow-md' 
                              : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700'
                          }`}
                        >
                          <Users size={16} />
                          عدة موظفين (تقاسم)
                        </button>

                        <button
                          type="button"
                          onClick={() => setResponsibilityTarget('split_store_employee')}
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            responsibilityTarget === 'split_store_employee' 
                              ? 'bg-brand-primary text-white border-brand-primary shadow-md' 
                              : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700'
                          }`}
                        >
                          <PieChart size={16} />
                          مناصفة/نسبة مع المحل
                        </button>

                        <button
                          type="button"
                          onClick={() => setResponsibilityTarget('supplier')}
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            responsibilityTarget === 'supplier' 
                              ? 'bg-brand-primary text-white border-brand-primary shadow-md' 
                              : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700'
                          }`}
                        >
                          <Building2 size={16} />
                          على المورد
                        </button>

                        <button
                          type="button"
                          onClick={() => setResponsibilityTarget('customer')}
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            responsibilityTarget === 'customer' 
                              ? 'bg-brand-primary text-white border-brand-primary shadow-md' 
                              : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700'
                          }`}
                        >
                          <User size={16} />
                          على عميل المحل
                        </button>
                      </div>

                      {/* Sub-selectors based on chosen responsibilityTarget */}
                      {responsibilityTarget === 'single_employee' && (
                        <div className="space-y-2 p-4 bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700">
                          <label className="text-xs font-bold text-gray-500">اختر الموظف المسؤول (يتم خصم 100% من راتبه):</label>
                          <select 
                            value={selectedEmployeeId}
                            onChange={e => setSelectedEmployeeId(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl font-bold text-xs"
                          >
                            <option value="">-- اضغط لاختيار الموظف --</option>
                            {employees.map(emp => (
                              <option key={emp.uid} value={emp.uid}>{emp.name || emp.fullName} ({emp.role})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {responsibilityTarget === 'multiple_employees' && (
                        <div className="space-y-2 p-4 bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700">
                          <label className="text-xs font-bold text-gray-500">اختر الموظفين المشاركين بالمسؤولية (تقسيم التكلفة بالتساوي):</label>
                          <div className="max-h-36 overflow-y-auto space-y-2 pr-2">
                            {employees.map(emp => {
                              const isChecked = selectedEmployeeIds.includes(emp.uid);
                              return (
                                <button
                                  key={emp.uid}
                                  type="button"
                                  onClick={() => toggleEmployeeSelection(emp.uid)}
                                  className={`w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                                    isChecked ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 'bg-gray-50 dark:bg-navy-900 border-gray-200 dark:border-navy-700 text-gray-600 dark:text-gray-300'
                                  }`}
                                >
                                  <span>{emp.name || emp.fullName}</span>
                                  {isChecked && <Check size={16} />}
                                </button>
                              );
                            })}
                          </div>
                          {selectedEmployeeIds.length > 0 && (
                            <p className="text-[11px] font-bold text-brand-primary">
                              الحصة لكل موظف: {((quantity * selectedItem.cost) / selectedEmployeeIds.length).toLocaleString()} ر.ي
                            </p>
                          )}
                        </div>
                      )}

                      {responsibilityTarget === 'split_store_employee' && (
                        <div className="space-y-3 p-4 bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700">
                          <div>
                            <label className="text-xs font-bold text-gray-500">اختر الموظف للشراكة:</label>
                            <select 
                              value={selectedEmployeeId}
                              onChange={e => setSelectedEmployeeId(e.target.value)}
                              className="w-full p-3 mt-1 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl font-bold text-xs"
                            >
                              <option value="">-- اضغط لاختيار الموظف --</option>
                              {employees.map(emp => (
                                <option key={emp.uid} value={emp.uid}>{emp.name || emp.fullName}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span>نسبة تحمّل المحل: {storeSplitPercent}%</span>
                              <span>نسبة تحمّل الموظف: {100 - storeSplitPercent}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="10" 
                              max="90" 
                              step="5"
                              value={storeSplitPercent} 
                              onChange={e => setStoreSplitPercent(Number(e.target.value))}
                              className="w-full accent-brand-primary"
                            />
                            <div className="flex justify-between text-[11px] font-bold text-gray-500">
                              <span>المحل: {((quantity * selectedItem.cost * storeSplitPercent) / 100).toLocaleString()} ر.ي</span>
                              <span>الموظف: {((quantity * selectedItem.cost * (100 - storeSplitPercent)) / 100).toLocaleString()} ر.ي</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {responsibilityTarget === 'supplier' && (
                        <div className="space-y-2 p-4 bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700">
                          <label className="text-xs font-bold text-gray-500">اختر المورد الخصيم من قائمة الموردين:</label>
                          <select 
                            value={selectedSupplierId}
                            onChange={e => setSelectedSupplierId(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl font-bold text-xs"
                          >
                            <option value="">-- قائمة الموردين --</option>
                            {suppliers.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.phone || 'بدون هاتف'})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {responsibilityTarget === 'customer' && (
                        <div className="space-y-2 p-4 bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700">
                          <label className="text-xs font-bold text-gray-500">اختر العميل المتسبب من قائمة عملاء المحل:</label>
                          <select 
                            value={selectedCustomerId}
                            onChange={e => setSelectedCustomerId(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl font-bold text-xs"
                          >
                            <option value="">-- قائمة عملاء المحل --</option>
                            {customers.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.phone || 'بدون هاتف'})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-brand-primary/10 flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-500">تكلفة الخسارة الإجمالية:</p>
                      <p className="text-2xl font-black text-danger">{(quantity * selectedItem.cost).toLocaleString()} ر.ي</p>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <label className="label-field text-right font-black">ملاحظات وسبب الهدر أو الفقد التفصيلي</label>
                  <textarea 
                    className="input-field min-h-[80px] py-3 text-xs"
                    placeholder="اكتب أسباب الضرر أو التفاصيل الميدانية للفحص..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={!selectedItem || isSubmitting}
                  className="btn-primary w-full py-4 text-lg bg-danger border-danger text-white hover:bg-danger/90 disabled:opacity-50 disabled:grayscale cursor-pointer shadow-xl"
                >
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'تأكيد وحفظ الخسارة وتوزيع المسؤولية'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 font-black ${
              status.type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'
            }`}
          >
            <AlertCircle size={24} />
            {status.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

