import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  Scan, 
  CheckCircle, 
  AlertCircle, 
  Edit3, 
  Plus, 
  Trash2, 
  DollarSign, 
  FileText, 
  ZoomIn, 
  RotateCw, 
  ShieldCheck, 
  Layers, 
  ArrowRight,
  Package,
  Clock,
  Sparkles,
  Save
} from 'lucide-react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { SmartPurchaseInvoiceResult, SmartInvoiceItem } from '../../types';
import { smartAccountingService } from '../../services/smartAccountingService';

interface SmartInvoiceOCRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceApproved: (invoice: SmartPurchaseInvoiceResult) => void;
  storeId: string;
  ownerId: string;
}

export const SmartInvoiceOCRModal: React.FC<SmartInvoiceOCRModalProps> = ({
  isOpen,
  onClose,
  onInvoiceApproved,
  storeId,
  ownerId
}) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [invoiceData, setInvoiceData] = useState<SmartPurchaseInvoiceResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Supplier auto-complete
  const [existingSuppliers, setExistingSuppliers] = useState<any[]>([]);

  // Post-verification options
  const [updateSupplierDebt, setUpdateSupplierDebt] = useState(true);
  const [autoAddInventory, setAutoAddInventory] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !ownerId) return;
    const fetchSuppliers = async () => {
      try {
        const q = query(
          collection(db, 'suppliers'),
          where('ownerId', '==', ownerId),
          limit(30)
        );
        const snap = await getDocs(q);
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setExistingSuppliers(list);
      } catch (e) {
        console.warn('Failed to load suppliers:', e);
      }
    };
    fetchSuppliers();
  }, [isOpen, ownerId]);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    setImageFile(file);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImageBase64(base64);
      processOCR(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const processOCR = async (base64: string, mimeType: string) => {
    setIsAnalyzing(true);
    setAnalysisStep('جاري تشغيل محرك الرؤية الحاسوبية Gemini Vision وفك الخط اليدوي...');
    setErrorMsg('');

    try {
      setTimeout(() => {
        setAnalysisStep('جاري تدقيق الشاشات، البطاريات، قطع الصيانة، وحساب الباقي السابق...');
      }, 1200);

      const parsedInvoice = await smartAccountingService.processInvoiceOCR({
        imageBase64: base64,
        mimeType,
        ownerId,
        storeId
      });

      setInvoiceData(parsedInvoice);
    } catch (err: any) {
      console.error('OCR Error:', err);
      setErrorMsg('حدث خطأ أثناء معالجة صورة الفاتورة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Item modifications inside the verification modal
  const handleItemChange = (index: number, field: keyof SmartInvoiceItem, value: any) => {
    if (!invoiceData) return;
    const updatedItems = [...invoiceData.items];
    const targetItem = { ...updatedItems[index], [field]: value };

    if (field === 'quantity' || field === 'unitCost') {
      targetItem.subtotal = Number(targetItem.quantity || 0) * Number(targetItem.unitCost || 0);
    }
    updatedItems[index] = targetItem;

    recalculateTotals(updatedItems, invoiceData.previousBalance, invoiceData.paidAmount);
  };

  const handleAddItem = () => {
    if (!invoiceData) return;
    const newItem: SmartInvoiceItem = {
      name: 'صنف جديد',
      category: 'screens',
      quantity: 1,
      unitCost: 1000,
      subtotal: 1000
    };
    const updatedItems = [...invoiceData.items, newItem];
    recalculateTotals(updatedItems, invoiceData.previousBalance, invoiceData.paidAmount);
  };

  const handleRemoveItem = (index: number) => {
    if (!invoiceData) return;
    const updatedItems = invoiceData.items.filter((_, i) => i !== index);
    recalculateTotals(updatedItems, invoiceData.previousBalance, invoiceData.paidAmount);
  };

  const recalculateTotals = (items: SmartInvoiceItem[], prevBal: number, paid: number) => {
    if (!invoiceData) return;
    const totalAmount = items.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
    const grandTotal = totalAmount + Number(prevBal || 0);
    const remainingDebt = grandTotal - Number(paid || 0);

    setInvoiceData({
      ...invoiceData,
      items,
      previousBalance: Number(prevBal || 0),
      totalAmount,
      grandTotal,
      paidAmount: Number(paid || 0),
      remainingDebt
    });
  };

  const handleConfirmAndSave = async () => {
    if (!invoiceData) return;
    if (!invoiceData.supplierName.trim()) {
      setErrorMsg('يرجى تحديد اسم المورد');
      return;
    }
    if (invoiceData.items.length === 0) {
      setErrorMsg('يجب أن تحتوي الفاتورة على صنف واحد على الأقل');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload: SmartPurchaseInvoiceResult = {
        ...invoiceData,
        storeId,
        ownerId,
        imageUrl: imageBase64
      };

      await smartAccountingService.saveApprovedPurchaseInvoice(payload);

      onInvoiceApproved(payload);
      onClose();
    } catch (err: any) {
      setErrorMsg('فشل ترحيل الفاتورة: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn" dir="rtl">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>قارئ ومدقق فواتير المشتريات الذكي</span>
                <span className="text-[11px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">Gemini Vision OCR</span>
              </h3>
              <p className="text-xs text-slate-400">تحويل الفواتير اليدوية (شاشات، بطاريات، صيانة) إلى قيود محاسبية ومخزنية معتمدة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {!invoiceData ? (
            /* Upload & Capture State */
            <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                }}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-3xl p-10 bg-slate-800/30 hover:bg-slate-800/50 transition-all cursor-pointer group"
              >
                <div className="w-20 h-20 mx-auto rounded-3xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-10 h-10" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">اسحب صورة الفاتورة المكتوبة يدوياً أو انقر لاختيارها</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  يدعم فواتير محلات قطع الغيار وشاشات الهواتف والبطاريات باللغة العربية، بما فيها الحساب القديم والباقي السابق.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>تصفح ملفات الجهاز</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-lg shadow-cyan-600/20"
                  >
                    <Camera className="w-4 h-4" />
                    <span>التقاط صورة عبر الكاميرا</span>
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
              </div>

              {isAnalyzing && (
                <div className="p-6 bg-slate-800/80 border border-cyan-500/30 rounded-2xl flex flex-col items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>{analysisStep || 'جاري الفحص بالذكاء الاصطناعي...'}</span>
                  </div>
                  <p className="text-xs text-slate-400">يتم التعرف على كتابة اليد واستخراج الأسماء والأسعار والديون السابقة...</p>
                </div>
              )}
            </div>
          ) : (
            /* Editable Verification Modal (Split Screen Layout) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Image Viewer (4 cols) */}
              <div className="lg:col-span-4 bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    صورة الفاتورة المرفقة:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                      title="تكبير"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setRotation(prev => (prev + 90) % 360)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                      title="تدوير"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setInvoiceData(null);
                        setImageBase64('');
                      }}
                      className="text-rose-400 hover:text-rose-300 text-[11px] px-2 py-0.5 rounded hover:bg-rose-500/10"
                    >
                      تغيير الصورة
                    </button>
                  </div>
                </div>

                <div className="relative w-full h-80 sm:h-96 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                  {imageBase64 ? (
                    <img
                      src={imageBase64}
                      alt="Invoice"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                        transition: 'transform 0.2s ease-in-out'
                      }}
                      className="max-h-full max-w-full object-contain cursor-grab"
                    />
                  ) : (
                    <div className="text-xs text-slate-500">لا توجد صورة مرفقة</div>
                  )}
                </div>

                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-[11px] text-cyan-300 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ملاحظة التدقيق الذكي:</span>
                  </div>
                  <p className="text-slate-400">
                    تمت مطابقة أسعار الشاشات والبطاريات واستخراج الباقي السابق تلقائياً. يمكنك تعديل أي حقل على اليمين قبل الاعتماد.
                  </p>
                </div>
              </div>

              {/* Right Column: Editable Data Table (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                
                {/* Supplier & Header Information */}
                <div className="p-4 bg-slate-800/60 border border-slate-700/70 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">اسم المورد *</label>
                    <input
                      type="text"
                      list="suppliers-list"
                      value={invoiceData.supplierName}
                      onChange={(e) => setInvoiceData({ ...invoiceData, supplierName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      placeholder="اسم المورد أو الشركة..."
                    />
                    <datalist id="suppliers-list">
                      {existingSuppliers.map(s => <option key={s.id} value={s.name} />)}
                    </datalist>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">رقم الفاتورة</label>
                    <input
                      type="text"
                      value={invoiceData.invoiceNumber}
                      onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">تاريخ الفاتورة</label>
                    <input
                      type="date"
                      value={invoiceData.invoiceDate}
                      onChange={(e) => setInvoiceData({ ...invoiceData, invoiceDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-900/60">
                  <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-cyan-400" />
                      بنود الفاتورة المستخرجة ({invoiceData.items.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة بند</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-800/40 text-slate-400 border-b border-slate-800">
                          <th className="p-2.5">اسم الصنف / القطعة</th>
                          <th className="p-2.5 w-24">التصنيف</th>
                          <th className="p-2.5 w-20 text-center">الكمية</th>
                          <th className="p-2.5 w-28 text-left">سعر الحبة</th>
                          <th className="p-2.5 w-28 text-left">الإجمالي</th>
                          <th className="p-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {invoiceData.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.category || 'screens'}
                                onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
                              >
                                <option value="screens">شاشات</option>
                                <option value="batteries">بطاريات</option>
                                <option value="spare_parts">قطع غيار</option>
                                <option value="maintenance">صيانة</option>
                                <option value="accessories">إكسسوارات</option>
                                <option value="other">أخرى</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-center text-white focus:outline-none focus:border-cyan-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={item.unitCost}
                                onChange={(e) => handleItemChange(idx, 'unitCost', Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-left text-amber-400 font-bold focus:outline-none focus:border-cyan-500"
                              />
                            </td>
                            <td className="p-2 text-left font-mono font-bold text-white">
                              {Number(item.subtotal || 0).toLocaleString()} ر.ي
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Audit Summary Box (Previous Balance + Net + Grand + Paid + Remaining) */}
                <div className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-2xl space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                    {/* Items Net */}
                    <div className="bg-slate-900/70 p-2 rounded-xl">
                      <span className="block text-[10px] text-slate-400">فاتورة اليوم الصافية</span>
                      <span className="font-bold text-slate-200 text-sm">{invoiceData.totalAmount.toLocaleString()} ر.ي</span>
                    </div>

                    {/* Previous Balance */}
                    <div className="bg-slate-900/70 p-2 rounded-xl border border-amber-500/20">
                      <span className="block text-[10px] text-amber-400">الباقي السابق (الحساب القديم)</span>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <input
                          type="number"
                          value={invoiceData.previousBalance}
                          onChange={(e) => recalculateTotals(invoiceData.items, Number(e.target.value), invoiceData.paidAmount)}
                          className="w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs font-bold text-amber-400"
                        />
                        <span className="text-[10px] text-amber-400">ر.ي</span>
                      </div>
                    </div>

                    {/* Grand Total */}
                    <div className="bg-slate-900/70 p-2 rounded-xl">
                      <span className="block text-[10px] text-slate-400">الإجمالي العام المستحق</span>
                      <span className="font-bold text-white text-sm">{invoiceData.grandTotal.toLocaleString()} ر.ي</span>
                    </div>

                    {/* Paid */}
                    <div className="bg-slate-900/70 p-2 rounded-xl border border-emerald-500/20">
                      <span className="block text-[10px] text-emerald-400">المدفوع نقداً</span>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <input
                          type="number"
                          value={invoiceData.paidAmount}
                          onChange={(e) => recalculateTotals(invoiceData.items, invoiceData.previousBalance, Number(e.target.value))}
                          className="w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs font-bold text-emerald-400"
                        />
                        <span className="text-[10px] text-emerald-400">ر.ي</span>
                      </div>
                    </div>

                    {/* Remaining Debt */}
                    <div className="bg-slate-900/70 p-2 rounded-xl border border-rose-500/30 col-span-2 sm:col-span-1">
                      <span className="block text-[10px] text-rose-300">المتبقي آجل (ذمة)</span>
                      <span className="font-bold text-rose-400 text-sm">{invoiceData.remainingDebt.toLocaleString()} ر.ي</span>
                    </div>
                  </div>

                  {/* Operational Checkboxes */}
                  <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateSupplierDebt}
                        onChange={(e) => setUpdateSupplierDebt(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>ترحيل المتبقي آلياً لحساب ذمة المورد ({invoiceData.supplierName || 'المورد'})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoAddInventory}
                        onChange={(e) => setAutoAddInventory(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>زيادة كميات الأصناف تلقائياً في مخزون المحل</span>
                    </label>
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        {invoiceData && (
          <div className="px-6 py-4 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setInvoiceData(null)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-bold transition-colors"
            >
              إلغاء وإعادة المسح
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmAndSave}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري الترحيل والحفظ...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>اعتماد الفاتورة وترحيلها لدفتر الأستاذ والمخزون</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
