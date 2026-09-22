import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  User, 
  Phone, 
  DollarSign, 
  History, 
  AlertCircle,
  X,
  Edit2,
  Trash2,
  MapPin,
  Printer,
  Undo,
  Loader2
} from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, serverTimestamp, where, getDoc, getDocs, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Supplier, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { printReceipt } from '../services/printService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';
import { UniversalReportButton } from './UniversalReportButton';
import { UniversalReportPayload } from '../services/UniversalReportService';

interface SuppliersProps {
  profile: UserProfile | null;
}

export default function Suppliers({ profile }: SuppliersProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const [isConfirmPaymentOpen, setIsConfirmPaymentOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Supplier | null>(null);
  const [supplierPurchases, setSupplierPurchases] = useState<any[]>([]);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedPurchaseForReturn, setSelectedPurchaseForReturn] = useState<any>(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [isReturning, setIsReturning] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    debt: 0
  });

  useEffect(() => {
    if (!profile?.ownerId) return;

    const q = query(
      collection(db, 'suppliers'), 
      where('ownerId', '==', profile.ownerId),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!profile?.ownerId) return;
      try {
        const docSnap = await getDoc(doc(db, 'settings', profile.ownerId));
        if (docSnap.exists()) {
          setShopSettings(docSnap.data());
        }
      } catch (error) {
        console.warn('Error fetching settings (falling back to default):', error);
      }
    };
    fetchSettings();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...formData,
          ownerId: profile?.ownerId,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
      setStatus({ type: 'success', message: 'تم حفظ بيانات المورد بنجاح' });
    } catch (error) {
      console.error('Error saving supplier:', error);
      setStatus({ type: 'error', message: 'حدث خطأ أثناء حفظ البيانات' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForPayment || paymentAmount <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newDebt = Math.max(0, selectedSupplierForPayment.debt - paymentAmount);
      await updateDoc(doc(db, 'suppliers', selectedSupplierForPayment.id), {
        debt: newDebt,
        updatedAt: serverTimestamp()
      });

      // Payment to supplier is an expense
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile?.ownerId,
        type: 'expense',
        amount: paymentAmount,
        category: 'supplier_payment',
        description: `تسديد مورد: ${selectedSupplierForPayment.name}`,
        createdAt: serverTimestamp()
      });

      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setSelectedSupplierForPayment(null);
      setStatus({ type: 'success', message: 'تم تسجيل عملية التسديد بنجاح' });
    } catch (error) {
      console.error('Error processing payment:', error);
      setStatus({ type: 'error', message: 'حدث خطأ أثناء معالجة الدفعة' });
    } finally {
      setIsSubmitting(false);
      setIsConfirmPaymentOpen(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    setFormData({ name: '', phone: '', address: '', debt: 0 });
  };

  const editSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({ 
      name: supplier.name, 
      phone: supplier.phone, 
      address: supplier.address || '', 
      debt: supplier.debt 
    });
    setIsModalOpen(true);
  };

  const openHistory = (supplier: Supplier) => {
    setSelectedSupplierForHistory(supplier);
    setIsHistoryModalOpen(true);
    
    // Fetch purchases for this supplier
    const q = query(
      collection(db, 'purchases'), 
      where('ownerId', '==', profile?.ownerId),
      where('supplierId', '==', supplier.id),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSupplierPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Error fetching supplier history:', error);
    });

    return unsubscribe;
  };

  const handleReturnPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchaseForReturn || returnQuantity <= 0 || isReturning) return;
    if (returnQuantity > selectedPurchaseForReturn.quantity) {
      setStatus({ type: 'error', message: 'الكمية المرتجعة أكبر من المتوفرة في الفاتورة' });
      return;
    }

    setIsReturning(true);
    try {
      const returnTotal = returnQuantity * selectedPurchaseForReturn.cost;
      const supplierDoc = doc(db, 'suppliers', selectedPurchaseForReturn.supplierId);
      const supplierSnap = await getDoc(supplierDoc);

      if (supplierSnap.exists()) {
        const currentDebt = supplierSnap.data().debt || 0;
        await updateDoc(supplierDoc, {
          debt: Math.max(0, currentDebt - returnTotal),
          updatedAt: serverTimestamp()
        });
      }

      // Record return transaction
      await addDoc(collection(db, 'transactions'), {
        ownerId: profile?.ownerId,
        type: 'income',
        amount: returnTotal,
        category: 'purchase_return',
        description: `مردود مشتريات: ${selectedPurchaseForReturn.itemName} من ${selectedSupplierForHistory?.name}`,
        createdAt: serverTimestamp()
      });

      // Update inventory stock (decrement)
      const invQ = query(collection(db, 'inventory'), where('ownerId', '==', profile?.ownerId), where('name', '==', selectedPurchaseForReturn.itemName));
      const invSnap = await getDocs(invQ);
      if (!invSnap.empty) {
        const invDoc = invSnap.docs[0];
        await updateDoc(doc(db, 'inventory', invDoc.id), {
          stock: increment(-returnQuantity)
        });
      }

      // Update purchase record quantity
      await updateDoc(doc(db, 'purchases', selectedPurchaseForReturn.id), {
        quantity: selectedPurchaseForReturn.quantity - returnQuantity,
        returnedQuantity: increment(returnQuantity)
      });

      setIsReturnModalOpen(false);
      setSelectedPurchaseForReturn(null);
      setReturnQuantity(1);
      setStatus({ type: 'success', message: 'تم تسجيل المردود وتحديث الرصيد بنجاح' });
    } catch (error) {
      console.error('Error processing return:', error);
      setStatus({ type: 'error', message: 'حدث خطأ أثناء معالجة المردود' });
    } finally {
      setIsReturning(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.phone.includes(searchTerm)
  );

  return (
    <div className={`space-y-6 p-4 rounded-3xl min-h-screen transition-colors ${profile?.visualTheme === 'light' ? 'light-suppliers' : ''}`}>
      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-bold ${
              status.type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'
            }`}
          >
            {status.type === 'success' ? <AlertCircle size={20} /> : <AlertCircle size={20} />}
            {status.message}
            <button onClick={() => setStatus(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="بحث عن مورد..." 
            className="w-full pr-12 pl-4 py-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <UniversalReportButton
            variant="emerald"
            buttonText="تقرير حسابات الموردين"
            payload={{
              title: 'تقرير كشف حسابات الموردين والالتزامات المالية',
              subtitle: 'كشف تفصيلي بحسابات الموردين، الأرصدة المستحقة (لهم)، وسجلات التواصل',
              currency: 'ر.ي',
              summaryCards: [
                { label: 'إجمالي عدد الموردين', value: suppliers.length, currency: 'مورد', color: 'blue' },
                { label: 'الموردين المستحقين لأموال', value: suppliers.filter(s => (s.debt || 0) > 0).length, currency: 'مورد', color: 'amber' },
                { label: 'إجمالي مستحقات الموردين (لهم)', value: suppliers.reduce((sum, s) => sum + (Number(s.debt) || 0), 0).toLocaleString(), currency: 'ر.ي', color: 'red' }
              ],
              columns: [
                { key: 'name', header: 'اسم المورد', type: 'text', width: 22 },
                { key: 'phone', header: 'رقم الهاتف', type: 'text', width: 14 },
                { key: 'company', header: 'الشركة / النشاط', type: 'text', width: 18, formatter: (val) => val || '-' },
                { key: 'address', header: 'العنوان', type: 'text', width: 18, formatter: (val) => val || '-' },
                { key: 'debt', header: 'المبلغ المستحق (له علينا)', type: 'currency', width: 16 }
              ],
              data: filteredSuppliers
            }}
          />
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-navy-700 text-white rounded-xl font-bold bounce-hover shadow-lg cursor-pointer"
          >
            <Plus size={20} />
            إضافة مورد جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSuppliers.map((supplier) => (
          <motion.div
            layout
            key={supplier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-glass p-6 space-y-4 relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-2 h-full ${supplier.debt > 0 ? 'bg-warning' : 'bg-success'}`} />
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-navy-700/5 rounded-full flex items-center justify-center text-navy-700 dark:text-brand-primary">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{supplier.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone size={12} />
                    {supplier.phone}
                  </p>
                  {supplier.address && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin size={10} />
                      {supplier.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => editSupplier(supplier)} className="p-2 hover:bg-navy-700/10 rounded-lg transition-colors text-gray-400 hover:text-navy-700">
                  <Edit2 size={16} />
                </button>
                {profile?.role === 'manager' && (
                  <button 
                    onClick={() => {
                      setSupplierToDelete(supplier);
                      setIsConfirmDeleteOpen(true);
                    }}
                    className="p-2 hover:bg-danger/10 rounded-lg transition-colors text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-2xl flex items-center justify-between ${
              supplier.debt > 0 ? 'bg-warning/5 border border-warning/10' : 'bg-success/5 border border-success/10'
            }`}>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold">المستحقات له (دين)</p>
                <p className={`text-2xl font-black ${supplier.debt > 0 ? 'text-warning' : 'text-success'}`}>
                  {supplier.debt.toFixed(0)} ر.ي
                </p>
              </div>
              {supplier.debt > 0 && (
                <AlertCircle className="text-warning" size={24} />
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => printReceipt('customer_debt', supplier, shopSettings)}
                className="p-2 bg-navy-700/10 text-navy-700 dark:text-brand-primary rounded-lg hover:bg-navy-700/20 transition-colors"
                title="طباعة كشف حساب"
              >
                <Printer size={16} />
              </button>
              <button 
                onClick={() => openHistory(supplier)}
                className="flex-1 py-2 bg-navy-700 text-white text-xs font-bold rounded-lg hover:bg-navy-800 transition-colors flex items-center justify-center gap-2"
              >
                <History size={14} />
                سجل التوريد
              </button>
              <button 
                onClick={() => {
                  setSelectedSupplierForPayment(supplier);
                  setIsPaymentModalOpen(true);
                }}
                className="flex-1 py-2 bg-brand-primary/10 text-brand-primary text-xs font-bold rounded-lg hover:bg-brand-primary/20 transition-colors flex items-center justify-center gap-2"
              >
                <DollarSign size={14} />
                تسديد دفعة
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPaymentModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">تسديد مبلغ للمورد</h3>
                <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handlePayment} className="p-8 space-y-6">
                <div className="p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-700">
                  <p className="text-xs text-gray-400 mb-1">المورد:</p>
                  <p className="font-bold">{selectedSupplierForPayment?.name}</p>
                  <p className="text-xs text-warning mt-1">المستحقات الحالية: {selectedSupplierForPayment?.debt.toFixed(0)} ر.ي</p>
                </div>
                <div className="space-y-2">
                  <label className="label-field">المبلغ المدفوع (ر.ي)</label>
                  <input 
                    required 
                    type="number" 
                    className="input-field" 
                    value={paymentAmount} 
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    autoFocus
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsConfirmPaymentOpen(true)}
                  className="btn-primary w-full py-5 text-xl"
                >
                  تأكيد تسليم المبلغ
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmPaymentOpen}
        onClose={() => setIsConfirmPaymentOpen(false)}
        onConfirm={() => handlePayment({ preventDefault: () => {} } as any)}
        title="تأكيد تسليم مبلغ"
        message={`هل أنت متأكد من تسليم مبلغ ${paymentAmount} ر.ي للمورد ${selectedSupplierForPayment?.name}؟ سيتم خصم المبلغ من الصندوق.`}
        confirmText="تأكيد التسليم"
      />

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setIsConfirmDeleteOpen(false);
          setSupplierToDelete(null);
        }}
        onConfirm={async () => {
          if (supplierToDelete) {
            try {
              await deleteDoc(doc(db, 'suppliers', supplierToDelete.id));
              setStatus({ type: 'success', message: 'تم حذف المورد بنجاح' });
            } catch (error) {
              setStatus({ type: 'error', message: 'حدث خطأ أثناء الحذف' });
            }
          }
        }}
        title="حذف مورد"
        message={`هل أنت متأكد من حذف المورد ${supplierToDelete?.name}؟ لا يمكن التراجع عن هذه العملية.`}
        confirmText="حذف نهائي"
        type="danger"
      />

      <AnimatePresence>
        {isHistoryModalOpen && selectedSupplierForHistory && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-2xl bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">سجل توريد المورد</h3>
                  <p className="text-xs text-gray-400">{selectedSupplierForHistory.name}</p>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {supplierPurchases.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p>لا توجد عمليات توريد مسجلة لهذا المورد</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <thead className="text-xs text-gray-400 uppercase bg-gray-50 dark:bg-navy-900">
                        <tr>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">الصنف</th>
                          <th className="p-3">العدد</th>
                          <th className="p-3">التكلفة</th>
                          <th className="p-3">الباركود</th>
                          <th className="p-3 text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                        {supplierPurchases.map((purchase) => (
                          <tr key={purchase.id} className="text-sm">
                            <td className="p-3">
                              {purchase.createdAt ? format(new Date(purchase.createdAt.seconds * 1000), 'yyyy/MM/dd', { locale: ar }) : '-'}
                            </td>
                            <td className="p-3 font-bold">{purchase.itemName}</td>
                            <td className="p-3">{purchase.quantity}</td>
                            <td className="p-3">{purchase.cost} ر.ي</td>
                            <td className="p-3 text-xs font-mono">{purchase.barcode || '-'}</td>
                            <td className="p-3 text-center">
                              {purchase.quantity > 0 && (
                                <button 
                                  onClick={() => {
                                    setSelectedPurchaseForReturn(purchase);
                                    setReturnQuantity(purchase.quantity);
                                    setIsReturnModalOpen(true);
                                  }}
                                  className="p-1 px-2 text-warning hover:bg-warning/10 rounded-lg transition-colors border border-warning/20 flex items-center gap-1 mx-auto"
                                >
                                  <Undo size={12} />
                                  <span className="text-[10px] font-bold">مردود</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-navy-900 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingSupplier ? 'تعديل بيانات مورد' : 'إضافة مورد جديد'}</h3>
                <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="label-field">اسم المورد</label>
                  <input required type="text" className="input-field" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="label-field">رقم الهاتف</label>
                  <input required type="tel" className="input-field" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="label-field">العنوان</label>
                  <input type="text" className="input-field" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="label-field">الرصيد الافتتاحي (مستحقات له)</label>
                  <input required type="number" step="1" className="input-field" value={formData.debt} onChange={(e) => setFormData({...formData, debt: Number(e.target.value)})} />
                </div>
                <button type="submit" className="btn-primary w-full py-5 text-xl">
                  {editingSupplier ? 'تحديث البيانات' : 'حفظ المورد'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isReturnModalOpen && selectedPurchaseForReturn && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsReturnModalOpen(false)} className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-navy-800 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-warning text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">تسجيل مردود مشتريات</h3>
                <button onClick={() => setIsReturnModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleReturnPurchase} className="p-8 space-y-6">
                <div className="p-4 bg-warning/5 rounded-2xl border border-warning/10">
                  <p className="text-sm font-bold text-warning mb-1">الصنف: {selectedPurchaseForReturn.itemName}</p>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">الكمية القصوى المتاحة: {selectedPurchaseForReturn.quantity}</p>
                </div>
                <div className="space-y-2">
                  <label className="label-field text-right block font-bold">الكمية المرتجعة</label>
                  <input 
                    required 
                    type="number" 
                    min="1" 
                    max={selectedPurchaseForReturn.quantity} 
                    className="input-field text-center text-2xl" 
                    value={returnQuantity} 
                    onChange={(e) => setReturnQuantity(Number(e.target.value))} 
                    autoFocus
                  />
                </div>
                <div className="p-4 bg-gray-50 dark:bg-navy-900 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-500">سعر الوحدة</span>
                    <span className="font-bold">{selectedPurchaseForReturn.cost} ر.ي</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-navy-700">
                    <span className="text-sm font-bold">الإجمالي المرتجع (سيخصم من مديونية المورد)</span>
                    <span className="text-lg font-black text-warning">{(returnQuantity * selectedPurchaseForReturn.cost).toLocaleString()} ر.ي</span>
                  </div>
                </div>
                <button type="submit" disabled={isReturning} className="btn-primary w-full py-5 text-xl bg-warning border-warning text-white shadow-warning/20">
                  {isReturning ? <Loader2 className="animate-spin" /> : 'تأكيد المردود (خصم الرصيد)'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
