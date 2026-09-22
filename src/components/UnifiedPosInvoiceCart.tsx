import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  Grid, 
  List, 
  Camera, 
  Search, 
  Plus, 
  Trash2, 
  Calculator, 
  MessageSquare, 
  Save, 
  Sliders, 
  ChevronDown, 
  UserPlus,
  Minus
} from 'lucide-react';

export interface PosCartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  total: number;
}

export interface UnifiedPosInvoiceCartProps {
  mode?: 'sales' | 'wholesale_sales' | 'retail_purchases' | 'wholesale_purchases';
  invoiceNumber?: string;
  invoiceDate?: string;
  partyLabel?: string;
  partyList?: Array<{ id: string; name: string }>;
  selectedPartyId?: string;
  onSelectParty?: (id: string) => void;
  onAddNewParty?: () => void;
  
  pricingPolicy?: 'retail' | 'semi_wholesale' | 'wholesale';
  onSelectPricingPolicy?: (policy: 'retail' | 'semi_wholesale' | 'wholesale') => void;
  
  paymentMethod?: 'cash' | 'credit' | 'network' | 'wallet';
  onSelectPaymentMethod?: (method: 'cash' | 'credit' | 'network' | 'wallet') => void;
  
  currency?: string;
  onSelectCurrency?: (currency: string) => void;
  
  exchangeRate?: number;
  onChangeExchangeRate?: (rate: number) => void;
  
  inventory?: Array<{ id: string; name: string; price: number; code?: string; stock?: number; category?: string }>;
  cartItems?: PosCartItem[];
  
  onScanBarcode?: (barcode: string) => void;
  onAddItemRow?: () => void;
  onUpdateCartItem?: (index: number, updated: Partial<PosCartItem>) => void;
  onDeleteCartItem?: (index: number) => void;
  
  onSaveAndPrint?: () => void;
  onOpenDetails?: () => void;
  onOpenCalculator?: () => void;
  onOpenChat?: () => void;
  
  className?: string;
}

export default function UnifiedPosInvoiceCart({
  mode = 'sales',
  invoiceNumber = 'INV-00001',
  invoiceDate = new Date().toISOString().split('T')[0].replace(/-/g, '/'),
  partyLabel = 'العميل',
  partyList = [{ id: '1', name: 'زبون نقدي عام مبيعات' }],
  selectedPartyId = '1',
  onSelectParty,
  onAddNewParty,
  pricingPolicy = 'retail',
  onSelectPricingPolicy,
  paymentMethod = 'wallet',
  onSelectPaymentMethod,
  currency = 'ريال يمني (ر.ي)',
  onSelectCurrency,
  exchangeRate = 1,
  onChangeExchangeRate,
  inventory = [],
  cartItems = [],
  onScanBarcode,
  onAddItemRow,
  onUpdateCartItem,
  onDeleteCartItem,
  onSaveAndPrint,
  onOpenDetails,
  onOpenCalculator,
  onOpenChat,
  className = ''
}: UnifiedPosInvoiceCartProps) {
  const [showInvoiceData, setShowInvoiceData] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [localCart, setLocalCart] = useState<PosCartItem[]>(cartItems.length > 0 ? cartItems : [
    { id: '1', productId: '', name: '', price: 0, quantity: 1, total: 0 }
  ]);

  const activeCart = cartItems.length > 0 ? cartItems : localCart;

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    if (onScanBarcode) {
      onScanBarcode(barcodeInput);
    } else {
      // Local fallback logic if inventory item matches barcode
      const found = inventory.find(i => i.code === barcodeInput || i.name.includes(barcodeInput));
      if (found) {
        const newItem: PosCartItem = {
          id: Date.now().toString(),
          productId: found.id,
          name: found.name,
          price: found.price,
          quantity: 1,
          total: found.price
        };
        setLocalCart(prev => [...prev, newItem]);
      }
    }
    setBarcodeInput('');
  };

  const handleAddRow = () => {
    if (onAddItemRow) {
      onAddItemRow();
    } else {
      setLocalCart(prev => [
        ...prev,
        { id: Date.now().toString(), productId: '', name: '', price: 0, quantity: 1, total: 0 }
      ]);
    }
  };

  const handleUpdateQty = (index: number, delta: number) => {
    const item = activeCart[index];
    if (!item) return;
    const newQty = Math.max(1, item.quantity + delta);
    const newTotal = newQty * item.price;

    if (onUpdateCartItem) {
      onUpdateCartItem(index, { quantity: newQty, total: newTotal });
    } else {
      setLocalCart(prev => {
        const copy = [...prev];
        copy[index] = { ...copy[index], quantity: newQty, total: newTotal };
        return copy;
      });
    }
  };

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = inventory.find(p => p.id === prodId);
    if (!prod) return;
    const price = prod.price || 0;
    const qty = activeCart[index]?.quantity || 1;
    const updated = {
      productId: prod.id,
      name: prod.name,
      price: price,
      total: price * qty
    };

    if (onUpdateCartItem) {
      onUpdateCartItem(index, updated);
    } else {
      setLocalCart(prev => {
        const copy = [...prev];
        copy[index] = { ...copy[index], ...updated };
        return copy;
      });
    }
  };

  const handleDelete = (index: number) => {
    if (onDeleteCartItem) {
      onDeleteCartItem(index);
    } else {
      setLocalCart(prev => prev.filter((_, i) => i !== index));
    }
  };

  const grandTotal = activeCart.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalItemsCount = activeCart.filter(i => i.name || i.productId).length;

  return (
    <div className={`w-full dir-rtl text-right bg-slate-100 dark:bg-[#0b0e14] rounded-3xl border border-slate-200 dark:border-white/10 p-3 sm:p-4 shadow-xl flex flex-col gap-4 font-sans ${className}`}>
      
      {/* 1. TOP HEADER & VIEW TOGGLES */}
      <div className="bg-white dark:bg-[#161b22] p-2 rounded-2xl border border-slate-200 dark:border-white/5 flex items-center justify-between gap-2 shadow-sm">
        
        {/* Left Toggle Button: [إخفاء البيانات / بيانات الفاتورة] */}
        <button
          type="button"
          onClick={() => setShowInvoiceData(!showInvoiceData)}
          className="bg-amber-100/80 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 rounded-2xl px-3.5 py-2 font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>{showInvoiceData ? 'إخفاء البيانات' : 'بيانات الفاتورة'}</span>
        </button>

        {/* Right Segmented Switcher: [جدول الفاتورة] vs [شبكة المنتجات] */}
        <div className="bg-slate-100 dark:bg-zinc-900/90 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/60 dark:border-white/5">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-white/10'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5 text-amber-500" />
            <span>شبكة المنتجات</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-white/10'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <List className="w-3.5 h-3.5 text-amber-500" />
            <span>جدول الفاتورة</span>
          </button>
        </div>
      </div>

      {/* 2. BARCODE INPUT ROW */}
      <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
        <div className="relative flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-3 py-2 text-sm font-bold flex items-center shadow-inner">
          <input
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="امسح باركود المنتج ..."
            className="w-full bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm font-bold"
          />
          <span className="bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 text-[10px] font-black px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700 shrink-0 select-none">
            ENTER
          </span>
        </div>

        <button
          type="submit"
          className="bg-slate-900 hover:bg-black dark:bg-black dark:hover:bg-zinc-900 text-white px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 border border-slate-800 dark:border-zinc-800"
        >
          <Camera className="w-4 h-4 text-amber-400" />
          <span>مسح</span>
        </button>
      </form>

      {/* 3. INVOICE DATA FORM PANEL (Visible when showInvoiceData === true) */}
      {showInvoiceData && (
        <div className="bg-white dark:bg-[#11151c] border border-slate-200/80 dark:border-white/5 rounded-3xl p-4 space-y-4 shadow-sm transition-all">
          
          {/* Row 1: Invoice Number & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block mb-1">
                رقم الفاتورة
              </label>
              <input
                type="text"
                disabled
                value={invoiceNumber}
                className="w-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-3 py-2 text-center text-slate-800 dark:text-slate-200 font-extrabold text-sm shadow-inner"
              />
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block mb-1">
                التاريخ
              </label>
              <input
                type="text"
                value={invoiceDate}
                readOnly
                className="w-full bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-2xl px-3 py-2 text-center text-slate-700 dark:text-slate-300 font-bold text-sm"
              />
            </div>
          </div>

          {/* Row 2: Customer / Supplier Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                {partyLabel}
              </label>
              {onAddNewParty && (
                <button
                  type="button"
                  onClick={onAddNewParty}
                  className="text-amber-600 dark:text-amber-400 hover:underline text-[11px] font-black flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>جديد+</span>
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={selectedPartyId}
                onChange={(e) => onSelectParty && onSelectParty(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs font-extrabold text-slate-800 dark:text-white outline-none cursor-pointer"
              >
                {partyList.map(p => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-zinc-900">
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Row 3: Pricing Policy & Payment Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            
            {/* Pricing Policy Toggle */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">سياسة التسعير</span>
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ذكي تلقائي
                </span>
              </div>

              <div className="bg-slate-100 dark:bg-zinc-900/90 p-1 rounded-2xl flex items-center gap-1 border border-slate-200 dark:border-zinc-800">
                {[
                  { key: 'retail', label: 'تجزئة' },
                  { key: 'semi_wholesale', label: 'نصف جملة' },
                  { key: 'wholesale', label: 'جملة' }
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => onSelectPricingPolicy && onSelectPricingPolicy(p.key as any)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      pricingPolicy === p.key
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method Toggle */}
            <div>
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block mb-1.5">
                طريقة السداد
              </label>

              <div className="bg-slate-100 dark:bg-zinc-900/90 p-1 rounded-2xl flex items-center gap-1 border border-slate-200 dark:border-zinc-800">
                {[
                  { key: 'cash', label: 'نقدي' },
                  { key: 'credit', label: 'آجل' },
                  { key: 'network', label: 'شبكة' },
                  { key: 'wallet', label: 'محفظة' }
                ].map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onSelectPaymentMethod && onSelectPaymentMethod(m.key as any)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      paymentMethod === m.key
                        ? 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-amber-400 font-black shadow-sm border border-slate-800 dark:border-zinc-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Row 4: Currency & Exchange Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block mb-1">
                عملة الفاتورة
              </label>
              <div className="relative">
                <select
                  value={currency}
                  onChange={(e) => onSelectCurrency && onSelectCurrency(e.target.value)}
                  className="w-full appearance-none bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none cursor-pointer"
                >
                  <option value="ريال يمني (ر.ي)">ريال يمني (ر.ي)</option>
                  <option value="ريال سعودي (ر.س)">ريال سعودي (ر.س)</option>
                  <option value="دولار أمريكي ($)">دولار أمريكي ($)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block mb-1">
                سعر الصرف
              </label>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => onChangeExchangeRate && onChangeExchangeRate(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-3 py-2 text-center text-slate-900 dark:text-white font-extrabold text-xs"
              />
            </div>
          </div>

        </div>
      )}

      {/* 4. PRODUCT GRID VIEW OR INVOICE TABLE VIEW */}
      {viewMode === 'grid' ? (
        /* PRODUCT GRID VIEW */
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن اسم المنتج، الكود، أو المادة..."
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl pr-9 pl-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none"
              />
            </div>

            <button
              type="button"
              className="bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-2xl text-xs shrink-0 cursor-pointer shadow-sm"
            >
              جميع الأصناف
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto p-1">
            {inventory
              .filter(item => !searchQuery || item.name.includes(searchQuery) || (item.code && item.code.includes(searchQuery)))
              .map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    const newItem: PosCartItem = {
                      id: Date.now().toString(),
                      productId: item.id,
                      name: item.name,
                      price: item.price,
                      quantity: 1,
                      total: item.price
                    };
                    if (onAddItemRow) {
                      onAddItemRow();
                    } else {
                      setLocalCart(prev => [...prev, newItem]);
                    }
                  }}
                  className="bg-white dark:bg-[#131720] hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/5 rounded-2xl p-3 text-right cursor-pointer transition-all hover:scale-[1.02] shadow-sm flex flex-col justify-between"
                >
                  <span className="text-xs font-black text-slate-900 dark:text-white line-clamp-2 mb-1">
                    {item.name}
                  </span>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-white/5">
                    <span className="font-extrabold text-amber-600 dark:text-amber-400">{item.price} ر.ي</span>
                    <span className="text-slate-400 text-[10px]">متاح: {item.stock ?? '--'}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        /* INVOICE TABLE / CARD LIST VIEW */
        <div className="space-y-3">
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {activeCart.map((item, index) => (
              <div
                key={item.id || index}
                className="bg-white dark:bg-[#11151c] border border-slate-200 dark:border-white/5 rounded-3xl p-3.5 space-y-3 shadow-sm hover:border-amber-500/30 transition-all"
              >
                {/* Header Row: #1 & Delete Icon */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-500 text-xs font-black font-mono bg-slate-100 dark:bg-zinc-900 px-2.5 py-0.5 rounded-lg">
                    #{index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer rounded-xl hover:bg-rose-500/10"
                    title="حذف السطر"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Select Product */}
                <div className="relative">
                  <select
                    value={item.productId || ''}
                    onChange={(e) => handleProductSelect(index, e.target.value)}
                    className="w-full appearance-none bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs font-extrabold text-slate-800 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="">-- اختر المنتج --</option>
                    {inventory.map(p => (
                      <option key={p.id} value={p.id} className="bg-white dark:bg-zinc-900">
                        {p.name} ({p.price} ر.ي)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>

                {/* Qty Stepper & Row Total */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 block mb-1">الكمية المباعة</span>
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(index, -1)}
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-xl cursor-pointer transition-all"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span className="w-8 text-center text-xs font-black text-slate-900 dark:text-white">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpdateQty(index, 1)}
                        className="p-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl cursor-pointer shadow-sm transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] font-black text-slate-400 block mb-0.5">إجمالي السطر</span>
                    <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                      {item.total || 0} ر.ي
                    </span>
                  </div>
                </div>

              </div>
            ))}
          </div>

          {/* Add Row Button */}
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={handleAddRow}
              className="bg-slate-900 hover:bg-black dark:bg-zinc-900 dark:hover:bg-zinc-800 text-amber-400 font-extrabold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer w-full border border-slate-800 dark:border-zinc-800"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>سطر جديد بالجدول</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. FLOATING CONTROLS & STICKY BOTTOM ACTION BAR */}
      <div className="pt-2 relative">
        
        {/* Floating Calculator & Chat quick buttons */}
        <div className="absolute -top-12 right-2 flex items-center gap-2 z-10">
          {onOpenCalculator && (
            <button
              type="button"
              onClick={onOpenCalculator}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 p-2.5 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer border border-amber-300"
              title="حاسبة متطورة"
            >
              <Calculator className="w-4 h-4" />
            </button>
          )}

          {onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 p-2.5 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer border border-amber-300"
              title="محادثة الدعم والدفع"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* STICKY BOTTOM ACTION CONTAINER */}
        <div className="bg-slate-950 dark:bg-black border border-slate-800 p-3.5 rounded-3xl text-white flex flex-col sm:flex-row justify-between items-center gap-3 shadow-2xl">
          
          {/* Total Summary */}
          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-400 block">
              الصافي النهائي ({totalItemsCount} أصناف)
            </span>
            <span className="text-2xl font-black text-amber-400 font-mono">
              {grandTotal.toLocaleString()} ر.ي
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onOpenDetails && (
              <button
                type="button"
                onClick={onOpenDetails}
                className="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-slate-200 font-black px-4 py-3 rounded-2xl flex items-center justify-center gap-2 border border-slate-700 text-xs cursor-pointer transition-all"
              >
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>التفاصيل</span>
              </button>
            )}

            <button
              type="button"
              onClick={onSaveAndPrint}
              className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all text-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ وطباعة</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
