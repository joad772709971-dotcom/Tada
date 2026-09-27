import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Percent, 
  Save, 
  Sparkles, 
  Layers, 
  Search, 
  Check, 
  RotateCcw, 
  ArrowRightLeft, 
  Link2, 
  TrendingUp, 
  CheckCheck,
  AlertCircle,
  Eye,
  Sliders,
  Calculator,
  RefreshCw,
  Boxes
} from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

export interface TieredProductItem {
  id: string;
  name: string;
  barcode: string;
  stock: number;
  cost?: number;
  category?: string;
  price_imported?: number;
  price_wholesale_wholesale?: number;
  price_wholesale?: number;
  price_retail?: number;
  // Fallbacks
  price?: number;
  wholesalePrice?: number;
}

interface TieredPricingManagerProps {
  items: TieredProductItem[];
  categories?: string[];
  ownerId?: string;
  onRefresh?: () => void;
  onClose?: () => void;
}

export const TieredPricingManager: React.FC<TieredPricingManagerProps> = ({
  items,
  categories = [],
  ownerId,
  onRefresh,
  onClose
}) => {
  const currentUid = ownerId || auth.currentUser?.uid || 'system';

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Working state for row price inputs: itemId -> { imported, wholesale_wholesale, wholesale, retail }
  const [pricingEdits, setPricingEdits] = useState<{
    [itemId: string]: {
      imported: string;
      wholesale_wholesale: string;
      wholesale: string;
      retail: string;
    };
  }>(() => {
    const initial: any = {};
    items.forEach(item => {
      initial[item.id] = {
        imported: (item.price_imported ?? 0) > 0 ? String(item.price_imported) : '',
        wholesale_wholesale: (item.price_wholesale_wholesale ?? 0) > 0 ? String(item.price_wholesale_wholesale) : '',
        wholesale: (item.price_wholesale ?? item.wholesalePrice ?? 0) > 0 ? String(item.price_wholesale ?? item.wholesalePrice) : '',
        retail: (item.price_retail ?? item.price ?? 0) > 0 ? String(item.price_retail ?? item.price) : ''
      };
    });
    return initial;
  });

  // Selected items for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Auto Pricing Control Bar State
  const [autoPricingMode, setAutoPricingMode] = useState<'percentage' | 'fixed'>('percentage');
  const [baseTier, setBaseTier] = useState<'cost' | 'imported' | 'wholesale_wholesale' | 'wholesale' | 'retail'>('cost');
  
  // Custom margin step per tier
  const [marginImported, setMarginImported] = useState<number>(10);
  const [marginWholesaleWholesale, setMarginWholesaleWholesale] = useState<number>(15);
  const [marginWholesale, setMarginWholesale] = useState<number>(25);
  const [marginRetail, setMarginRetail] = useState<number>(40);

  // Column ignore/include toggles
  const [enableImportedCol, setEnableImportedCol] = useState(true);
  const [enableWholesaleWholesaleCol, setEnableWholesaleWholesaleCol] = useState(true);
  const [enableWholesaleCol, setEnableWholesaleCol] = useState(true);
  const [enableRetailCol, setEnableRetailCol] = useState(true);

  // Sync / Unify Columns Mode: map target -> source
  const [syncTargets, setSyncTargets] = useState<{
    wholesaleWithMega: boolean;
    megaWithImported: boolean;
  }>({
    wholesaleWithMega: false,
    megaWithImported: false
  });

  // Filtered product items
  const filteredProducts = useMemo(() => {
    return items.filter(it => {
      const matchSearch = searchTerm.trim() === '' || 
        it.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (it.barcode && it.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchCategory = selectedCategory === 'all' || it.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [items, searchTerm, selectedCategory]);

  const handlePriceChange = (itemId: string, field: 'imported' | 'wholesale_wholesale' | 'wholesale' | 'retail', val: string) => {
    setPricingEdits(prev => {
      const current = prev[itemId] || { imported: '', wholesale_wholesale: '', wholesale: '', retail: '' };
      const updated = { ...current, [field]: val };

      // Check sync column rules if active
      if (syncTargets.wholesaleWithMega) {
        if (field === 'wholesale_wholesale') updated.wholesale = val;
        if (field === 'wholesale') updated.wholesale_wholesale = val;
      }
      if (syncTargets.megaWithImported) {
        if (field === 'imported') updated.wholesale_wholesale = val;
        if (field === 'wholesale_wholesale') updated.imported = val;
      }

      return { ...prev, [itemId]: updated };
    });
  };

  // Quick Action: Unify Two Columns across all displayed products
  const handleUnifyColumns = (source: 'wholesale' | 'wholesale_wholesale' | 'imported', target: 'wholesale' | 'wholesale_wholesale' | 'imported') => {
    setPricingEdits(prev => {
      const next = { ...prev };
      filteredProducts.forEach(prod => {
        const row = next[prod.id] || { imported: '', wholesale_wholesale: '', wholesale: '', retail: '' };
        const sourceVal = (row as any)[source] || '';
        (row as any)[target] = sourceVal;
        next[prod.id] = { ...row };
      });
      return next;
    });
    setSaveSuccessMsg(`✓ تم بنجاح توحيد عمود ${source === 'wholesale' ? 'الجملة' : source === 'wholesale_wholesale' ? 'جملة الجملة' : 'المستورد'} مع ${target === 'wholesale' ? 'الجملة' : target === 'wholesale_wholesale' ? 'جملة الجملة' : 'المستورد'}`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Auto-pricing calculation tool
  const applyAutoPricing = () => {
    const targetItems = selectedIds.length > 0 
      ? filteredProducts.filter(p => selectedIds.includes(p.id)) 
      : filteredProducts;

    if (targetItems.length === 0) {
      setSaveErrorMsg('لا توجد أصناف لتطبيق التسعير التلقائي عليها.');
      setTimeout(() => setSaveErrorMsg(null), 3500);
      return;
    }

    setPricingEdits(prev => {
      const next = { ...prev };
      targetItems.forEach(prod => {
        let baseVal = 0;
        const currentEdit = prev[prod.id] || { imported: '', wholesale_wholesale: '', wholesale: '', retail: '' };

        if (baseTier === 'cost') {
          baseVal = Number(prod.cost) || 0;
        } else if (baseTier === 'imported') {
          baseVal = Number(currentEdit.imported) || Number(prod.price_imported) || Number(prod.cost) || 0;
        } else if (baseTier === 'wholesale_wholesale') {
          baseVal = Number(currentEdit.wholesale_wholesale) || Number(prod.price_wholesale_wholesale) || 0;
        } else if (baseTier === 'wholesale') {
          baseVal = Number(currentEdit.wholesale) || Number(prod.price_wholesale) || Number(prod.wholesalePrice) || 0;
        } else if (baseTier === 'retail') {
          baseVal = Number(currentEdit.retail) || Number(prod.price_retail) || Number(prod.price) || 0;
        }

        if (baseVal <= 0) {
          // If no base value found, try cost or current retail price
          baseVal = Number(prod.cost) || Number(prod.price) || 1000;
        }

        let calcImported = baseVal;
        let calcWholesaleWholesale = baseVal;
        let calcWholesale = baseVal;
        let calcRetail = baseVal;

        if (autoPricingMode === 'percentage') {
          if (baseTier === 'cost') {
            calcImported = Math.round(baseVal * (1 + marginImported / 100));
            calcWholesaleWholesale = Math.round(baseVal * (1 + marginWholesaleWholesale / 100));
            calcWholesale = Math.round(baseVal * (1 + marginWholesale / 100));
            calcRetail = Math.round(baseVal * (1 + marginRetail / 100));
          } else {
            calcImported = Math.round(baseVal * (1 + marginImported / 100));
            calcWholesaleWholesale = Math.round(calcImported * (1 + marginWholesaleWholesale / 100));
            calcWholesale = Math.round(calcWholesaleWholesale * (1 + marginWholesale / 100));
            calcRetail = Math.round(calcWholesale * (1 + marginRetail / 100));
          }
        } else {
          // Fixed addition
          if (baseTier === 'cost') {
            calcImported = baseVal + marginImported;
            calcWholesaleWholesale = baseVal + marginWholesaleWholesale;
            calcWholesale = baseVal + marginWholesale;
            calcRetail = baseVal + marginRetail;
          } else {
            calcImported = baseVal + marginImported;
            calcWholesaleWholesale = calcImported + marginWholesaleWholesale;
            calcWholesale = calcWholesaleWholesale + marginWholesale;
            calcRetail = calcWholesale + marginRetail;
          }
        }

        next[prod.id] = {
          imported: enableImportedCol ? String(Math.max(0, calcImported)) : currentEdit.imported,
          wholesale_wholesale: enableWholesaleWholesaleCol ? String(Math.max(0, calcWholesaleWholesale)) : currentEdit.wholesale_wholesale,
          wholesale: enableWholesaleCol ? String(Math.max(0, calcWholesale)) : currentEdit.wholesale,
          retail: enableRetailCol ? String(Math.max(0, calcRetail)) : currentEdit.retail
        };
      });
      return next;
    });

    setSaveSuccessMsg(`✓ تم بنجاح تطبيق التسعير التلقائي على (${targetItems.length}) منتج. اضغط "حفظ التغييرات" للاعتماد.`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Save single item to Firestore
  const saveSingleItem = async (itemId: string) => {
    const edit = pricingEdits[itemId];
    if (!edit) return;

    setIsSaving(true);
    try {
      const imp = Number(edit.imported) || 0;
      const ww = Number(edit.wholesale_wholesale) || 0;
      const w = Number(edit.wholesale) || 0;
      const ret = Number(edit.retail) || 0;

      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      if (enableImportedCol) updateData.price_imported = imp;
      if (enableWholesaleWholesaleCol) updateData.price_wholesale_wholesale = ww;
      if (enableWholesaleCol) {
        updateData.price_wholesale = w;
        if (w > 0) updateData.wholesalePrice = w;
      }
      if (enableRetailCol) {
        updateData.price_retail = ret;
        if (ret > 0) updateData.price = ret;
      }

      await updateDoc(doc(db, 'inventory', itemId), updateData);

      // Also mirror to wholesaleProducts if present
      try {
        const wpQuery = query(collection(db, 'wholesaleProducts'), where('originalItemId', '==', itemId));
        const wpSnap = await getDocs(wpQuery);
        for (const wpDoc of wpSnap.docs) {
          await updateDoc(wpDoc.ref, {
            ...updateData,
            price: ret > 0 ? ret : (w > 0 ? w : wpDoc.data().price)
          });
        }
      } catch (err) {
        console.warn('Could not mirror to wholesaleProducts:', err);
      }

      setSaveSuccessMsg(`✓ تم حفظ أسعار الصنف بنجاح في قاعدة البيانات.`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      setSaveErrorMsg(`خطأ في حفظ الأسعار: ${err.message}`);
      setTimeout(() => setSaveErrorMsg(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk Save all modified or selected items
  const handleBulkSave = async () => {
    setIsSaving(true);
    setSaveErrorMsg(null);
    try {
      const targetItems = selectedIds.length > 0 
        ? filteredProducts.filter(p => selectedIds.includes(p.id)) 
        : filteredProducts;

      let savedCount = 0;
      for (const prod of targetItems) {
        const edit = pricingEdits[prod.id];
        if (!edit) continue;

        const imp = Number(edit.imported) || 0;
        const ww = Number(edit.wholesale_wholesale) || 0;
        const w = Number(edit.wholesale) || 0;
        const ret = Number(edit.retail) || 0;

        const updateData: any = {
          updatedAt: serverTimestamp()
        };

        if (enableImportedCol) updateData.price_imported = imp;
        if (enableWholesaleWholesaleCol) updateData.price_wholesale_wholesale = ww;
        if (enableWholesaleCol) {
          updateData.price_wholesale = w;
          if (w > 0) updateData.wholesalePrice = w;
        }
        if (enableRetailCol) {
          updateData.price_retail = ret;
          if (ret > 0) updateData.price = ret;
        }

        await updateDoc(doc(db, 'inventory', prod.id), updateData);
        savedCount++;
      }

      setSaveSuccessMsg(`✓ تم بنجاح حفظ وتثبيت أسعار (${savedCount}) صنف في قاعدة البيانات!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      setSaveErrorMsg(`حدث خطأ أثناء الحفظ الجماعي: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-950 border border-amber-500/25 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-6 text-white" dir="rtl">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/10 border border-amber-500/30 text-amber-400 shadow-md">
              <Layers size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>التسعير حسب الفئات (B2B Price Matrix)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                  المرحلة الرابعة
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                إدارة مركزية لأسعار السلع بفئات (المستورد • جملة الجملة • الجملة • التجزئة) مع شريط احتساب وهوامش ذكية
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              إغلاق القسم ✕
            </button>
          )}

          <button
            type="button"
            onClick={handleBulkSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={15} />
            <span>{isSaving ? 'جاري الحفظ...' : `حفظ وتطبيق الأسعار ${selectedIds.length > 0 ? `(${selectedIds.length})` : 'لكل المعروض'}`}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {saveSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check size={16} className="text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {saveErrorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <span>{saveErrorMsg}</span>
        </div>
      )}

      {/* --- SMART AUTO-PRICING TOOLBAR (شريط إعدادات التسعير التلقائي) --- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 to-navy-950/90 border border-amber-500/25 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-amber-400" />
            <h3 className="text-xs sm:text-sm font-black text-amber-300">
              شريط إعدادات التسعير التلقائي وهوامش الفئات ⚡
            </h3>
          </div>

          {/* Mode Switch: Percentage vs Fixed */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setAutoPricingMode('percentage')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                autoPricingMode === 'percentage'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Percent size={12} />
              <span>نسبة مئوية (%)</span>
            </button>
            <button
              type="button"
              onClick={() => setAutoPricingMode('fixed')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                autoPricingMode === 'fixed'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <DollarSign size={12} />
              <span>مبلغ ثابت (ر.ي)</span>
            </button>
          </div>
        </div>

        {/* Setting Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          
          {/* 1. Base Tier */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-300 block">
              القيمة المرجعية الأساسية:
            </label>
            <select
              value={baseTier}
              onChange={(e) => setBaseTier(e.target.value as any)}
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="cost">سعر التكلفة (Cost)</option>
              <option value="imported">سعر المستورد (Importer)</option>
              <option value="wholesale_wholesale">سعر جملة الجملة (Mega)</option>
              <option value="wholesale">سعر الجملة (Wholesale)</option>
              <option value="retail">سعر التجزئة (Retail)</option>
            </select>
          </div>

          {/* 2. Margin Importer */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-rose-300">
                1. فئة المستورد:
              </label>
              <button
                type="button"
                onClick={() => setEnableImportedCol(!enableImportedCol)}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  enableImportedCol ? 'bg-rose-500/20 text-rose-300' : 'bg-white/5 text-gray-500'
                }`}
              >
                {enableImportedCol ? 'مشمول' : 'تجاهل'}
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                disabled={!enableImportedCol}
                value={marginImported}
                onChange={(e) => setMarginImported(Number(e.target.value))}
                className="w-full bg-slate-950 border border-rose-500/30 rounded-xl px-3 py-2 text-xs font-mono text-white disabled:opacity-30 focus:border-rose-400 focus:outline-none pl-8"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">
                {autoPricingMode === 'percentage' ? '%' : 'ر.ي'}
              </span>
            </div>
          </div>

          {/* 3. Margin Wholesale-Wholesale */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-purple-300">
                2. جملة الجملة:
              </label>
              <button
                type="button"
                onClick={() => setEnableWholesaleWholesaleCol(!enableWholesaleWholesaleCol)}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  enableWholesaleWholesaleCol ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-500'
                }`}
              >
                {enableWholesaleWholesaleCol ? 'مشمول' : 'تجاهل'}
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                disabled={!enableWholesaleWholesaleCol}
                value={marginWholesaleWholesale}
                onChange={(e) => setMarginWholesaleWholesale(Number(e.target.value))}
                className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-mono text-white disabled:opacity-30 focus:border-purple-400 focus:outline-none pl-8"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">
                {autoPricingMode === 'percentage' ? '%' : 'ر.ي'}
              </span>
            </div>
          </div>

          {/* 4. Margin Wholesale */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-amber-300">
                3. سعر الجملة:
              </label>
              <button
                type="button"
                onClick={() => setEnableWholesaleCol(!enableWholesaleCol)}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  enableWholesaleCol ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-gray-500'
                }`}
              >
                {enableWholesaleCol ? 'مشمول' : 'تجاهل'}
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                disabled={!enableWholesaleCol}
                value={marginWholesale}
                onChange={(e) => setMarginWholesale(Number(e.target.value))}
                className="w-full bg-slate-950 border border-amber-500/30 rounded-xl px-3 py-2 text-xs font-mono text-white disabled:opacity-30 focus:border-amber-400 focus:outline-none pl-8"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">
                {autoPricingMode === 'percentage' ? '%' : 'ر.ي'}
              </span>
            </div>
          </div>

          {/* 5. Margin Retail */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-emerald-300">
                4. سعر التجزئة:
              </label>
              <button
                type="button"
                onClick={() => setEnableRetailCol(!enableRetailCol)}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  enableRetailCol ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-gray-500'
                }`}
              >
                {enableRetailCol ? 'مشمول' : 'تجاهل'}
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                disabled={!enableRetailCol}
                value={marginRetail}
                onChange={(e) => setMarginRetail(Number(e.target.value))}
                className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-mono text-white disabled:opacity-30 focus:border-emerald-400 focus:outline-none pl-8"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">
                {autoPricingMode === 'percentage' ? '%' : 'ر.ي'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Quick Unification presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-400 text-[11px] font-bold">إجراءات توحيد سريعة:</span>
            <button
              type="button"
              onClick={() => handleUnifyColumns('wholesale_wholesale', 'wholesale')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 text-[11px] transition-all cursor-pointer flex items-center gap-1"
            >
              <Link2 size={12} className="text-purple-400" />
              <span>توحيد (الجملة = جملة الجملة)</span>
            </button>
            <button
              type="button"
              onClick={() => handleUnifyColumns('imported', 'wholesale_wholesale')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 text-[11px] transition-all cursor-pointer flex items-center gap-1"
            >
              <Link2 size={12} className="text-rose-400" />
              <span>توحيد (المستورد = جملة الجملة)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={applyAutoPricing}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <Sparkles size={14} />
            <span>تطبيق الهامش التلقائي بضغطة واحدة 🚀</span>
          </button>
        </div>
      </div>

      {/* Search & Categories Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الباركود..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 pr-9 pl-4 text-xs text-white placeholder:text-gray-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto py-1 hide-scroll">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            الكل ({items.length})
          </button>
          {categories.map((cat, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Products Pricing Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="bg-slate-950/80 border-b border-white/10 text-gray-400 font-bold select-none text-[11px]">
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(filteredProducts.map(p => p.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  className="rounded border-white/20 bg-slate-950 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                />
              </th>
              <th className="p-3">اسم المنتج والمواصفات</th>
              <th className="p-3 text-center">الباركود</th>
              <th className="p-3 text-center">الكمية الحالية</th>
              <th className="p-3 text-center">سعر التكلفة</th>
              
              {/* 4 Tier Input Columns */}
              <th className="p-3 text-center bg-rose-500/10 text-rose-300 font-black">
                سعر المستورد
              </th>
              <th className="p-3 text-center bg-purple-500/10 text-purple-300 font-black">
                سعر جملة الجملة
              </th>
              <th className="p-3 text-center bg-amber-500/10 text-amber-300 font-black">
                سعر الجملة
              </th>
              <th className="p-3 text-center bg-emerald-500/10 text-emerald-300 font-black">
                سعر التجزئة
              </th>
              <th className="p-3 text-center">حفظ الصنف</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-500 text-xs">
                  لا توجد منتجات تطابق البحث الحالي.
                </td>
              </tr>
            ) : (
              filteredProducts.map((prod) => {
                const edit = pricingEdits[prod.id] || { imported: '', wholesale_wholesale: '', wholesale: '', retail: '' };
                const isSelected = selectedIds.includes(prod.id);

                return (
                  <tr 
                    key={prod.id} 
                    className={`hover:bg-white/[0.03] transition-colors ${
                      isSelected ? 'bg-amber-500/[0.04]' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, prod.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== prod.id));
                          }
                        }}
                        className="rounded border-white/20 bg-slate-950 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                      />
                    </td>

                    {/* Product Name */}
                    <td className="p-3">
                      <div className="font-bold text-white max-w-[220px] truncate" title={prod.name}>
                        {prod.name}
                      </div>
                      {prod.category && (
                        <div className="text-[10px] text-gray-400 mt-0.5 font-normal">
                          {prod.category}
                        </div>
                      )}
                    </td>

                    {/* Barcode */}
                    <td className="p-3 text-center font-mono text-[11px] text-gray-300">
                      {prod.barcode || '—'}
                    </td>

                    {/* Stock */}
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                        prod.stock <= 3 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {prod.stock}
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="p-3 text-center font-mono text-xs text-gray-400">
                      {(Number(prod.cost) || 0).toLocaleString()} ر.ي
                    </td>

                    {/* Input 1: Imported Price */}
                    <td className="p-2.5 text-center bg-rose-500/5">
                      <div className="relative max-w-[120px] mx-auto">
                        <input
                          type="number"
                          placeholder="تجاهل / 0"
                          value={edit.imported}
                          onChange={(e) => handlePriceChange(prod.id, 'imported', e.target.value)}
                          className="w-full bg-slate-950/90 border border-rose-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono text-center focus:border-rose-400 focus:outline-none transition-all placeholder:text-gray-600"
                        />
                      </div>
                    </td>

                    {/* Input 2: Wholesale-Wholesale Price */}
                    <td className="p-2.5 text-center bg-purple-500/5">
                      <div className="relative max-w-[120px] mx-auto">
                        <input
                          type="number"
                          placeholder="تجاهل / 0"
                          value={edit.wholesale_wholesale}
                          onChange={(e) => handlePriceChange(prod.id, 'wholesale_wholesale', e.target.value)}
                          className="w-full bg-slate-950/90 border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono text-center focus:border-purple-400 focus:outline-none transition-all placeholder:text-gray-600"
                        />
                      </div>
                    </td>

                    {/* Input 3: Wholesale Price */}
                    <td className="p-2.5 text-center bg-amber-500/5">
                      <div className="relative max-w-[120px] mx-auto">
                        <input
                          type="number"
                          placeholder="تجاهل / 0"
                          value={edit.wholesale}
                          onChange={(e) => handlePriceChange(prod.id, 'wholesale', e.target.value)}
                          className="w-full bg-slate-950/90 border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono text-center focus:border-amber-400 focus:outline-none transition-all placeholder:text-gray-600"
                        />
                      </div>
                    </td>

                    {/* Input 4: Retail Price */}
                    <td className="p-2.5 text-center bg-emerald-500/5">
                      <div className="relative max-w-[120px] mx-auto">
                        <input
                          type="number"
                          placeholder="تجاهل / 0"
                          value={edit.retail}
                          onChange={(e) => handlePriceChange(prod.id, 'retail', e.target.value)}
                          className="w-full bg-slate-950/90 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono text-center focus:border-emerald-400 focus:outline-none transition-all placeholder:text-gray-600"
                        />
                      </div>
                    </td>

                    {/* Per-row Save button */}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => saveSingleItem(prod.id)}
                        disabled={isSaving}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-300 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer"
                        title="حفظ أسعار هذا الصنف فقط"
                      >
                        <Save size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span>إجمالي السلع المعروضة: <strong className="text-white">{filteredProducts.length}</strong></span>
          <span>•</span>
          <span>المحددة للتسعير الجماعي: <strong className="text-amber-400">{selectedIds.length}</strong></span>
        </div>
        <div className="text-[11px] text-gray-400">
          💡 يمكنك ترك أي خانة فارغة أو بصفر لتجاهلها، وسيتم اعتماد السعر السابق تلقائياً.
        </div>
      </div>

    </div>
  );
};
