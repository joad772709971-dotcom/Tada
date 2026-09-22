import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  RotateCcw, 
  Check, 
  DollarSign, 
  Smartphone, 
  Wifi, 
  TrendingUp, 
  Search, 
  Sliders, 
  CheckCircle2, 
  AlertCircle,
  Tag
} from 'lucide-react';
import { TelecomPackageCatalogItem } from '../../types';
import { smartAccountingService, DEFAULT_TELECOM_PACKAGES } from '../../services/smartAccountingService';

interface PackagePricingCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  ownerId: string;
  onSelectPackage?: (pkg: TelecomPackageCatalogItem) => void;
}

export const PackagePricingCatalogModal: React.FC<PackagePricingCatalogModalProps> = ({
  isOpen,
  onClose,
  storeId,
  ownerId,
  onSelectPackage
}) => {
  const [catalog, setCatalog] = useState<TelecomPackageCatalogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'yemen_mobile' | 'yemen_4g' | 'you' | 'sabafon' | 'adsl_landline'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New or Edit package modal/form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    operator: 'yemen_mobile' | 'sabafon' | 'you' | 'yemen_4g' | 'adsl_landline' | 'other';
    operatorName: string;
    packageName: string;
    category: 'balance' | 'packages' | 'internet' | 'combo';
    wholesaleCost: number;
    retailPrice: number;
    unitDescription: string;
    notes: string;
  }>({
    operator: 'yemen_mobile',
    operatorName: 'يمن موبايل',
    packageName: '',
    category: 'packages',
    wholesaleCost: 1000,
    retailPrice: 1150,
    unitDescription: '',
    notes: ''
  });

  const loadCatalog = async () => {
    if (!storeId || !ownerId) return;
    setIsLoading(true);
    try {
      const items = await smartAccountingService.getPackageCatalog(storeId, ownerId);
      setCatalog(items);
    } catch (err: any) {
      setMessage({ text: 'فشل تحميل الكتالوج: ' + err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCatalog();
    }
  }, [isOpen, storeId, ownerId]);

  if (!isOpen) return null;

  const handleResetDefaults = async () => {
    if (!window.confirm('هل أنت متأكد من استعادة الباقات القياسية المعتمدة؟')) return;
    setIsSaving(true);
    try {
      const defaults = await smartAccountingService.resetDefaultPackageCatalog(storeId, ownerId);
      setCatalog(defaults);
      setMessage({ text: 'تم استعادة الكتالوج القياسي اليمني بنجاح', type: 'success' });
    } catch (err: any) {
      setMessage({ text: 'خطأ: ' + err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.packageName.trim()) {
      setMessage({ text: 'اسم الباقة مطلوب', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const saved = await smartAccountingService.savePackageCatalogItem({
        id: editingId || undefined,
        storeId,
        ownerId,
        operator: formData.operator,
        operatorName: formData.operatorName,
        packageName: formData.packageName.trim(),
        category: formData.category,
        wholesaleCost: Number(formData.wholesaleCost),
        retailPrice: Number(formData.retailPrice),
        profit: Number(formData.retailPrice) - Number(formData.wholesaleCost),
        unitDescription: formData.unitDescription,
        isActive: true,
        notes: formData.notes
      });

      if (editingId) {
        setCatalog(prev => prev.map(p => p.id === editingId ? saved : p));
        setMessage({ text: 'تم تعديل الباقة بنجاح', type: 'success' });
      } else {
        setCatalog(prev => [saved, ...prev]);
        setMessage({ text: 'تمت إضافة الباقة للكتالوج', type: 'success' });
      }

      setShowForm(false);
      setEditingId(null);
    } catch (err: any) {
      setMessage({ text: 'فشل الحفظ: ' + err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (pkg: TelecomPackageCatalogItem) => {
    setEditingId(pkg.id);
    setFormData({
      operator: pkg.operator,
      operatorName: pkg.operatorName,
      packageName: pkg.packageName,
      category: pkg.category,
      wholesaleCost: pkg.wholesaleCost,
      retailPrice: pkg.retailPrice,
      unitDescription: pkg.unitDescription || '',
      notes: pkg.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الباقة من الكتالوج؟')) return;
    try {
      await smartAccountingService.deletePackageCatalogItem(id);
      setCatalog(prev => prev.filter(p => p.id !== id));
      setMessage({ text: 'تم حذف الباقة بنجاح', type: 'success' });
    } catch (err: any) {
      setMessage({ text: 'فشل الحذف: ' + err.message, type: 'error' });
    }
  };

  const operatorTabs = [
    { id: 'all', label: 'كافة الخدمات' },
    { id: 'yemen_mobile', label: 'يمن موبايل' },
    { id: 'yemen_4g', label: 'يمن فورجي 4G' },
    { id: 'you', label: 'يو YOU' },
    { id: 'sabafon', label: 'سبأفون' },
    { id: 'adsl_landline', label: 'إنترنت ADSL' }
  ];

  const filteredCatalog = catalog.filter(item => {
    if (activeTab !== 'all' && item.operator !== activeTab) return false;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return (
        item.packageName.toLowerCase().includes(t) ||
        item.operatorName.toLowerCase().includes(t) ||
        (item.unitDescription && item.unitDescription.toLowerCase().includes(t))
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn" dir="rtl">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">كتالوج تسعير باقات الاتصالات والخدمات</h3>
              <p className="text-xs text-slate-400">مزامنة أسعار الشراء والبيع وحساب صافي الربح الفوري لكل عملية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Filter Bar */}
        <div className="p-4 bg-slate-800/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Operator Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            {operatorTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  operator: 'yemen_mobile',
                  operatorName: 'يمن موبايل',
                  packageName: '',
                  category: 'packages',
                  wholesaleCost: 1000,
                  retailPrice: 1150,
                  unitDescription: '',
                  notes: ''
                });
                setShowForm(true);
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة باقة جديدة</span>
            </button>

            <button
              onClick={handleResetDefaults}
              disabled={isSaving}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              title="استعادة الباقات القياسية المعتمدة في اليمن"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">استعادة القياسي</span>
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-xl flex items-center justify-between text-xs ${
            message.type === 'success' 
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Form for Add/Edit */}
        {showForm && (
          <div className="p-6 bg-slate-850 border-b border-slate-700/80 animate-fadeIn">
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-cyan-400" />
                  {editingId ? 'تعديل بيانات الباقة' : 'إضافة باقة / خدمة جديدة'}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  إلغاء
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">الشركة المزودة *</label>
                  <select
                    value={formData.operator}
                    onChange={(e) => {
                      const op = e.target.value as any;
                      const names: Record<string, string> = {
                        yemen_mobile: 'يمن موبايل',
                        yemen_4g: 'يمن فورجي 4G',
                        you: 'يو YOU',
                        sabafon: 'سبأفون',
                        adsl_landline: 'يمن نت ADSL / ثابت',
                        other: 'أخرى'
                      };
                      setFormData({ ...formData, operator: op, operatorName: names[op] || op });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="yemen_mobile">يمن موبايل</option>
                    <option value="yemen_4g">يمن فورجي 4G</option>
                    <option value="you">يو YOU</option>
                    <option value="sabafon">سبأفون</option>
                    <option value="adsl_landline">يمن نت ADSL / ثابت</option>
                    <option value="other">خدمة سداد أخرى</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">اسم الباقة أو الخدمة *</label>
                  <input
                    type="text"
                    required
                    value={formData.packageName}
                    onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                    placeholder="مثال: باقة مزايا الشهرية، فورجي 10 جيجا..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">سعر الشراء من المزود (ر.ي) *</label>
                  <input
                    type="number"
                    required
                    value={formData.wholesaleCost}
                    onChange={(e) => setFormData({ ...formData, wholesaleCost: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">سعر البيع للزبون (ر.ي) *</label>
                  <input
                    type="number"
                    required
                    value={formData.retailPrice}
                    onChange={(e) => setFormData({ ...formData, retailPrice: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">صافي الربح التلقائي</label>
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-cyan-400 flex items-center justify-between">
                    <span>{Number(formData.retailPrice) - Number(formData.wholesaleCost)} ر.ي</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({formData.wholesaleCost > 0 ? ((Number(formData.retailPrice) - Number(formData.wholesaleCost)) / Number(formData.wholesaleCost) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs text-slate-400 block mb-1">تفاصيل الباقة (الدقائق، الرصيد، الجيجابايت)</label>
                  <input
                    type="text"
                    value={formData.unitDescription}
                    onChange={(e) => setFormData({ ...formData, unitDescription: e.target.value })}
                    placeholder="مثال: 300 دقيقة + 300 رسالة + 500 ميجا"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ الباقة</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Content Body: Catalog Table */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم الباقة أو الشركة أو السعر..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs">جاري تحميل كتالوج الباقات...</div>
          ) : filteredCatalog.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              لا توجد باقات مطابقة للتصنيف الحالي. اضغط على "استعادة القياسي" لملء الكتالوج المعتمد.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCatalog.map(item => {
                const profit = item.retailPrice - item.wholesaleCost;
                const marginPercent = item.wholesaleCost > 0 ? ((profit / item.wholesaleCost) * 100).toFixed(1) : '0';

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                          {item.operatorName}
                        </span>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-700"
                            title="تعديل"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-700"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white mb-1">{item.packageName}</h4>
                      {item.unitDescription && (
                        <p className="text-[11px] text-slate-400">{item.unitDescription}</p>
                      )}
                    </div>

                    {/* Pricing Grid */}
                    <div className="pt-2 border-t border-slate-700/60 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-900/60 p-1.5 rounded-lg">
                        <span className="block text-[10px] text-slate-400">سعر الشراء</span>
                        <span className="font-bold text-amber-400">{item.wholesaleCost.toLocaleString()} ر.ي</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded-lg">
                        <span className="block text-[10px] text-slate-400">سعر البيع</span>
                        <span className="font-bold text-emerald-400">{item.retailPrice.toLocaleString()} ر.ي</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded-lg border border-cyan-500/30">
                        <span className="block text-[10px] text-cyan-300">الربح الصافي</span>
                        <span className="font-bold text-cyan-400">+{profit.toLocaleString()} ر.ي</span>
                      </div>
                    </div>

                    {onSelectPackage && (
                      <button
                        onClick={() => {
                          onSelectPackage(item);
                          onClose();
                        }}
                        className="w-full py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 rounded-lg text-xs font-bold transition-colors"
                      >
                        اختيار هذه الباقة للمعاملة
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <span>إجمالي الباقات المسجلة: <strong className="text-white">{catalog.length}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
