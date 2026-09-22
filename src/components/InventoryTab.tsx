import { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { Search, Plus, Trash2, ShieldAlert, Barcode, Printer, Layers, Sliders, Check, HelpCircle } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface InventoryTabProps {
  products: Product[];
  onAddProduct: (prod: Product) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateProductQuantity: (id: string, newQty: number) => void;
}

export default function InventoryTab({ products, onAddProduct, onDeleteProduct, onUpdateProductQuantity }: InventoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // States for adding
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [category, setCategory] = useState('شاشات');
  const [lowStockThreshold, setLowStockThreshold] = useState('4');

  // Simulated scan state
  const [scanResult, setScanResult] = useState<string>('');
  const [scanQty, setScanQty] = useState<number>(1);
  const [scanCompletedMsg, setScanCompletedMsg] = useState<string>('');

  // Auto focus ref for JsBarcode elements
  const barcodeRefs = useRef<{ [key: string]: SVGSVGElement | null }>({});

  const categories = ['شاشات', 'بطاريات', 'إكسسوارات', 'شواحن', 'قطع غيار أخرى'];

  // Render Barcodes dynamically when products change or list updates
  useEffect(() => {
    products.forEach(p => {
      const element = barcodeRefs.current[p.id];
      if (element && p.barcode) {
        try {
          JsBarcode(element, p.barcode, {
            format: "CODE128",
            width: 1.5,
            height: 35,
            displayValue: true,
            fontSize: 10,
            background: "transparent",
            lineColor: "#cbd5e1"
          });
        } catch (err) {
          console.error("Barcode rendering failed:", err);
        }
      }
    });
  }, [products, isAdding]);

  // Filters
  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.barcode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesLowStock = !onlyLowStock || p.quantity <= p.lowStockThreshold;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const generateRandomBarcode = () => {
    // Standard random EAN-13 numeric barcode
    let code = "692";
    for(let i=0; i<9; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    setBarcode(code);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !barcode || !quantity || !purchasePrice || !sellPrice) return;

    const newProd: Product = {
      id: 'p_' + Date.now(),
      name,
      barcode,
      quantity: Number(quantity),
      purchasePrice: Number(purchasePrice),
      sellPrice: Number(sellPrice),
      category,
      lowStockThreshold: Number(lowStockThreshold) || 3
    };

    onAddProduct(newProd);

    // Reset fields
    setName('');
    setBarcode('');
    setQuantity('');
    setPurchasePrice('');
    setSellPrice('');
    setIsAdding(false);
  };

  // Simulated Barcode Quick Scanner Engine
  const handleSimulateScan = () => {
    const cleanedResult = scanResult.trim();
    if (!cleanedResult) return;

    const match = products.find(p => p.barcode === cleanedResult || p.name.includes(cleanedResult));
    if (match) {
      const change = Number(scanQty);
      if (match.quantity >= change) {
        onUpdateProductQuantity(match.id, match.quantity - change);
        setScanCompletedMsg(`🎯 معالجة سريعة: تم استقطاع عدد ${change} من قطة "${match.name}". المتبقي حالياً: ${match.quantity - change} في المخزن.`);
      } else {
        setScanCompletedMsg(`⚠️ عجز بالرصيد: كمية المخزن الحالية هي ${match.quantity}، بينما طلبت سحب ${change} قطع!`);
      }
    } else {
      setScanCompletedMsg(`❌ لا توجد سلعة متطابقة مع الباركود أو الاسم المدخل: "${cleanedResult}"`);
    }

    // timeout clear
    setTimeout(() => {
      setScanCompletedMsg('');
    }, 6000);
  };

  const handlePrintBarcode = (pName: string) => {
    window.print(); // Easy print handler fallback
  };

  return (
    <div className="space-y-6">
      {/* Upper header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/30 p-6 rounded-3xl border border-slate-850">
        <div>
          <h2 className="text-xl font-black text-white">إدارة المخازن وقطع الغيار</h2>
          <p className="text-xs text-slate-400 mt-1">الرقابة الكمية والبار كود والحد الحرج لإمدادات صيانة الهواتف الذكية</p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            type="button" 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-500 text-slate-950 font-bold rounded-xl text-xs w-full sm:w-auto hover:bg-teal-400"
          >
            <Plus className="w-4 h-4" />
            إضافة صنف مخزني جديد
          </button>
        </div>
      </div>

      {/* Simulator Quick Box & Scanner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Simulator */}
        <div className="lg:col-span-2 bg-slate-900/10 border border-slate-850 p-6 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Barcode className="w-5 h-5 text-teal-400" />
            شريان المبيعات السريعة (محاكي قارئ الباركود ومحطة الصرف)
          </h3>
          <p className="text-xs text-slate-400">
            أدخل باركود المنتج أو جزءاً من الاسم لمحاكاة القارئ المسدسي السلكي. ينقر الفني على الجزء وسيقوم النظام فوراً بالخصم من المخزن للزبون.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <input 
              type="text" 
              placeholder="امسح الباركود أو اكتب اسم المنتج هنا..."
              value={scanResult}
              onChange={e => setScanResult(e.target.value)}
              className="w-full sm:flex-1 bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input 
                type="number" 
                value={scanQty}
                onChange={e => setScanQty(Number(e.target.value))}
                min={1}
                className="w-20 bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2.5 text-xs font-mono text-white text-center"
              />
              <button 
                onClick={handleSimulateScan}
                className="px-4 py-2.5 bg-teal-500/15 border border-teal-500/30 hover:bg-teal-500/20 text-teal-400 text-xs font-bold rounded-xl whitespace-nowrap flex-1 sm:flex-none"
              >
                محاكاة الضغط والخصم
              </button>
            </div>
          </div>

          {scanCompletedMsg && (
            <div className={`p-4 rounded-xl text-xs font-bold ${
              scanCompletedMsg.includes('🎯') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-red-500/10 text-red-400 border border-red-500/15'
            }`}>
              {scanCompletedMsg}
            </div>
          )}
        </div>

        {/* Small overview count */}
        <div className="bg-slate-900/15 border border-slate-850 p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-400 block mb-1">إجمالي القطع في المستودع</h4>
            <p className="text-2xl font-mono font-black text-white">{(products.reduce((acc, p) => acc + p.quantity, 0))} أصناف</p>
          </div>
          <div className="border-t border-slate-800 pt-3">
            <h4 className="text-xs font-bold text-slate-400 block mb-1">السلع الحرجة (منخفضة الكمية)</h4>
            <p className="text-lg font-mono font-black text-amber-400">
              {products.filter(p => p.quantity <= p.lowStockThreshold).length} قطع مهددة بالنفاد
            </p>
          </div>
        </div>
      </div>

      {/* Adding Form Block */}
      {isAdding && (
        <form onSubmit={handleCreateProduct} className="bg-slate-900/40 p-6 rounded-3xl border border-teal-500/20 shadow-xl space-y-4 animate-fadeIn">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            تسجيل صنف مخزني أو شاشات وقطع غيار جديدة
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Name */}
            <div className="space-y-1.5 text-right md:col-span-2">
              <label className="text-xs text-slate-400 font-bold block">اسم المادة بالكامل</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: شاشة ايفون 14 برو شحن أصلي..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right"
                required
              />
            </div>

            {/* Barcode input */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold flex justify-between">
                <span>الباركود الترقيمي EAN</span>
                <button 
                  type="button" 
                  onClick={generateRandomBarcode}
                  className="text-teal-400 font-bold hover:underline"
                >
                  توليد باركود تلقائي
                </button>
              </label>
              <input 
                type="text" 
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="أو اكتب الباركود اليدوي..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs font-mono text-white text-right"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Quantity */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">الكمية الداخلة</label>
              <input 
                type="number" 
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="5"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right font-mono"
                required
              />
            </div>

            {/* Purchase Price */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">سعر شراء القطعة (د.ع)</label>
              <input 
                type="number" 
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                placeholder="15000"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right font-mono"
                required
              />
            </div>

            {/* Sell Price */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">سعر البيع الافتراضى (د.ع)</label>
              <input 
                type="number" 
                value={sellPrice}
                onChange={e => setSellPrice(e.target.value)}
                placeholder="25000"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right font-mono"
                required
              />
            </div>

            {/* Alarm line */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs text-slate-400 font-bold block">حد الإنذار بنقص الكمية</label>
              <input 
                type="number" 
                value={lowStockThreshold}
                onChange={e => setLowStockThreshold(e.target.value)}
                placeholder="3"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white text-right font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 text-right col-span-1">
              <label className="text-xs text-slate-400 font-bold block">نوع وتصنيف البضاعة</label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2.5 text-xs text-white text-right"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={() => setIsAdding(false)} 
              className="px-4 py-2 rounded-xl text-xs text-slate-400 font-bold hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 rounded-xl text-xs bg-teal-500 text-slate-950 font-bold hover:bg-teal-400"
            >
              حفظ في دليل المخازن
            </button>
          </div>
        </form>
      )}

      {/* Searching filters toolbar */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950/30 p-4 rounded-2xl border border-slate-900">
        {/* Search Input bar */}
        <div className="relative w-full md:flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
          <input 
            type="text"
            placeholder="ابحث بالاسم بالكامل، الموديل أو رقم الباركود الترقيمي..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 focus:border-teal-500 rounded-xl pr-10 pl-4 py-3 text-xs text-slate-200 text-right font-sans"
          />
        </div>

        {/* Action Toggle tools */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Category Selector */}
          <select 
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-slate-900/50 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-xs text-slate-300 font-medium"
          >
            <option value="all">كل الأقسام</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Alarm Checkbox toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-slate-900/30 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-300 select-none">
            <input 
              type="checkbox" 
              checked={onlyLowStock}
              onChange={e => setOnlyLowStock(e.target.checked)}
              className="rounded border-slate-800 text-teal-500 focus:ring-teal-500/20 w-4 h-4"
            />
            <span>النواقص فقط</span>
          </label>
        </div>
      </div>

      {/* Grid view of Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-slate-900/20 border border-slate-850 p-12 text-center text-slate-500 font-semibold rounded-3xl">
            لم نجد أي سلعة تطابق فلترة البحث التراكمي المطبق.
          </div>
        ) : (
          filtered.map(p => {
            const isCritical = p.quantity <= p.lowStockThreshold;
            return (
              <div 
                key={p.id} 
                className={`bg-slate-900/20 border p-5 rounded-3xl flex flex-col justify-between gap-4 relative overflow-hidden group hover:border-teal-500/20 transition-all ${
                  isCritical ? 'border-amber-500/20 bg-amber-500/1' : 'border-slate-850'
                }`}
              >
                {isCritical && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 text-xs text-amber-500 font-bold bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded-full">
                    <ShieldAlert className="w-3.5 h-3.5 animate-bounce" /> حرج
                  </div>
                )}

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded-full border border-teal-500/10">{p.category}</span>
                  <h4 className="text-sm font-bold text-white leading-snug mt-1">{p.name}</h4>
                  
                  <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-850/60 mt-2">
                    <span>الرصيد في المستودع:</span>
                    <span className={`font-mono font-black ${isCritical ? 'text-amber-400' : 'text-emerald-400'}`}>{p.quantity} قطع</span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>تكلفة الشراء:</span>
                    <span className="font-mono text-slate-300 font-bold">{p.purchasePrice.toLocaleString()} د.ع</span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400 pb-2">
                    <span>سعر البيع الافتراضي:</span>
                    <span className="font-mono text-white font-black">{p.sellPrice.toLocaleString()} د.ع</span>
                  </div>
                </div>

                {/* Printable real vector barcode canvas container */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-slate-800 flex flex-col items-center justify-center">
                  <svg 
                    ref={el => { barcodeRefs.current[p.id] = el; }} 
                    className="w-full mix-blend-screen text-slate-200 max-h-12"
                  ></svg>
                  <p className="text-[9px] font-mono text-slate-500 mt-1 uppercase">رموز مبيعات JAM</p>
                </div>

                {/* Action footer inside product card */}
                <div className="flex justify-between items-center border-t border-slate-850 pt-3">
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => onUpdateProductQuantity(p.id, p.quantity + 1)}
                      className="w-7 h-7 bg-slate-850 hover:bg-slate-750 font-black rounded-lg text-xs text-white"
                      title="زيادة الكمية بمقدار واحدة"
                    >
                      +
                    </button>
                    <button 
                      onClick={() => onUpdateProductQuantity(p.id, Math.max(0, p.quantity - 1))}
                      className="w-7 h-7 bg-slate-850 hover:bg-slate-750 font-black rounded-lg text-xs text-white"
                      title="تقليل الكمية بمقدار واحدة"
                    >
                      -
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handlePrintBarcode(p.name)}
                      className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl"
                      title="طباعة الباركود الملصق"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => onDeleteProduct(p.id)}
                      className="p-2 bg-slate-850/30 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl"
                      title="حذف المادة المحددة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
