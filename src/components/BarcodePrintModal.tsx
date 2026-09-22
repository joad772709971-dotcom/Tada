import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Search, 
  Printer, 
  Check, 
  Minus, 
  Plus, 
  Package,
  CheckCircle2
} from 'lucide-react';
import { InventoryItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import JsBarcode from 'jsbarcode';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  initialSelectedItems?: { itemId: string; quantity: number }[];
  shopName?: string;
  showPrice?: boolean;
}

interface PrintItem extends InventoryItem {
  printQuantity: number;
  isSelected: boolean;
}

export default function BarcodePrintModal({ 
  isOpen, 
  onClose, 
  items, 
  initialSelectedItems, 
  shopName = 'Jam system pro',
  showPrice = true
}: BarcodePrintModalProps) {
  const [localShowPrice, setLocalShowPrice] = useState(showPrice);
  const [searchTerm, setSearchTerm] = useState('');
  const [printableItems, setPrintableItems] = useState<PrintItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [paperType, setPaperType] = useState<'label' | 'a4_sheet'>('label');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const initial = items.map(item => {
        const foundInitial = initialSelectedItems?.find(si => si.itemId === item.id);
        return {
          ...item,
          printQuantity: foundInitial ? foundInitial.quantity : 1,
          isSelected: !!foundInitial
        };
      });
      setPrintableItems(initial);
    }
  }, [isOpen, items, initialSelectedItems]);

  const filteredItems = printableItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.barcode?.includes(searchTerm)
  );

  const toggleSelection = (itemId: string) => {
    setPrintableItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, isSelected: !item.isSelected } : item
    ));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setPrintableItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, printQuantity: Math.max(1, item.printQuantity + delta) } : item
    ));
  };

  const handleManualQuantity = (itemId: string, val: string) => {
    const num = parseInt(val) || 0;
    setPrintableItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, printQuantity: Math.max(0, num) } : item
    ));
  };

  const selectAll = () => {
    setPrintableItems(prev => prev.map(item => ({ ...item, isSelected: true })));
  };

  const deselectAll = () => {
    setPrintableItems(prev => prev.map(item => ({ ...item, isSelected: false })));
  };

  const handlePrint = async () => {
    const itemsToPrint = printableItems.filter(item => item.isSelected && item.printQuantity > 0 && item.barcode);
    if (itemsToPrint.length === 0) {
      alert('الرجاء تحديد أصناف تحتوي على باركود للطباعة');
      return;
    }

    setIsGenerating(true);
    
    let html = '';
    
    if (paperType === 'a4_sheet') {
       html = `
          <style>
             @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+39&family=Tajawal:wght@400;700&display=swap');
             @page { size: A4; margin: 0; }
             body { margin: 0; padding: 10mm; font-family: 'Tajawal', sans-serif; direction: rtl; }
             .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; }
             .cell { 
                height: 29mm; border: 0.1mm dashed #ccc; padding: 1mm; 
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                text-align: center; overflow: hidden; page-break-inside: avoid;
             }
             .shop { font-size: 7px; color: #666; margin-bottom: 1px; }
             .name { font-size: 9px; font-weight: bold; margin-bottom: 1px; height: 2.2em; overflow: hidden; }
             .barcode { font-family: 'Libre Barcode 39'; font-size: 32px; margin: 0; line-height: 1; }
             .price { font-size: 11px; font-weight: 900; color: #000; }
          </style>
          <div class="sheet">
       `;

       itemsToPrint.forEach(item => {
          for (let i = 0; i < item.printQuantity; i++) {
             html += `
                <div class="cell">
                   <div class="shop">${shopName}</div>
                   <div class="name">${item.name}</div>
                   <div class="barcode">*${item.barcode}*</div>
                   <div style="font-size: 8px; margin-bottom: 2px;">${item.barcode}</div>
                   ${localShowPrice ? `<div class="price">${Number(item.price).toLocaleString()} ر.ي</div>` : ''}
                </div>
             `;
          }
       });

       html += '</div>';
    } else {
       html = `
          <style>
             @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+39&family=Tajawal:wght@400;700&display=swap');
             @page { size: 50mm 25mm; margin: 0; }
             body { margin: 0; padding: 0; font-family: 'Tajawal', sans-serif; direction: rtl; }
             .label { 
                width: 50mm; height: 25mm; padding: 2mm; box-sizing: border-box;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                text-align: center; page-break-after: always;
             }
             .shop { font-size: 7px; color: #666; }
             .name { font-size: 9px; font-weight: bold; margin: 1px 0; max-height: 2em; overflow: hidden; }
             .barcode { font-family: 'Libre Barcode 39'; font-size: 35px; line-height: 1; margin: 2px 0; }
             .price { font-size: 12px; font-weight: 900; color: #000; }
          </style>
       `;

       itemsToPrint.forEach(item => {
          for (let i = 0; i < item.printQuantity; i++) {
             html += `
                <div class="label">
                   <div class="shop">${shopName}</div>
                   <div class="name">${item.name}</div>
                   <div class="barcode">*${item.barcode}*</div>
                   ${localShowPrice ? `<div class="price">${Number(item.price).toLocaleString()} ر.ي</div>` : ''}
                </div>
             `;
          }
       });
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head><title>طباعة الباركود</title></head>
        <body>
          ${html}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setIsGenerating(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            className="relative w-full max-w-4xl bg-white dark:bg-navy-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 bg-navy-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-primary/20 rounded-xl text-brand-primary">
                  <Printer size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">طباعة باركود المنتجات</h3>
                  <p className="text-xs text-gray-400">حدد المنتجات والكمية المطلوب طباعتها</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                  <span className="text-[10px] font-black uppercase text-gray-400">إظهار السعر</span>
                  <button 
                    onClick={() => setLocalShowPrice(!localShowPrice)}
                    className={`w-8 h-4 rounded-full relative transition-all ${localShowPrice ? 'bg-brand-primary' : 'bg-gray-600'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${localShowPrice ? (document.dir === 'rtl' ? 'left-4' : 'right-4') : (document.dir === 'rtl' ? 'left-0.5' : 'right-0.5')}`} />
                  </button>
                </div>

                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  title="إغلاق"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
              {/* Search and Selection Tools */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase">نوع الورق</label>
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-navy-950 rounded-2xl border border-gray-200 dark:border-navy-700">
                      <button 
                        onClick={() => setPaperType('label')}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${paperType === 'label' ? 'bg-brand-primary text-white' : 'text-gray-500'}`}
                      >
                        ملصقات (Roll)
                      </button>
                      <button 
                        onClick={() => setPaperType('a4_sheet')}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${paperType === 'a4_sheet' ? 'bg-brand-primary text-white' : 'text-gray-500'}`}
                      >
                        ورق A4 (30/ص)
                      </button>
                    </div>
                  </div>
                  <div className="relative flex-[2]">
                    <label className="text-[10px] font-black text-gray-400 uppercase">بحث سريع</label>
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="بحث باسم المنتج أو الباركود..." 
                        className="w-full pr-12 pl-4 py-3 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/50 text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={selectAll}
                    className="px-6 py-3 text-sm font-black bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/30 rounded-2xl transition-all"
                  >
                    تحديد الكل
                  </button>
                  <button 
                    onClick={deselectAll}
                    className="px-6 py-3 text-sm font-black bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-2xl transition-all"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 min-h-[300px]">
                {filteredItems.map((item) => (
                  <div 
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                      item.isSelected 
                        ? 'border-brand-primary bg-brand-primary/5 dark:bg-brand-primary/10' 
                        : 'border-gray-100 dark:border-navy-700 hover:border-brand-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <button 
                        onClick={() => toggleSelection(item.id)}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          item.isSelected 
                            ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                            : 'border-gray-300 dark:border-navy-600'
                        }`}
                      >
                        {item.isSelected && <Check size={14} strokeWidth={4} />}
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-navy-900 rounded-xl flex items-center justify-center text-gray-400 overflow-hidden shrink-0">
                          {item.photo ? (
                            <img src={item.photo} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package size={24} />
                          )}
                        </div>
                        <div>
                          <p className="font-black text-base text-navy-950 dark:text-brand-primary leading-tight">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-white/60 mt-1 font-mono font-bold">
                            {item.barcode ? `BARCODE: ${item.barcode}` : 'لا يوجد باركود (توليد تلقائي)'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">كمية الطباعة</p>
                       <div className="flex items-center gap-3 bg-white dark:bg-navy-900 p-1.5 rounded-xl border border-gray-100 dark:border-navy-700">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-800 flex items-center justify-center transition-colors text-gray-500"
                        >
                          <Minus size={16} />
                        </button>
                        <input 
                          type="number" 
                          min="1"
                          className="w-12 text-center font-black bg-transparent outline-none text-brand-primary"
                          value={item.printQuantity}
                          onChange={(e) => handleManualQuantity(item.id, e.target.value)}
                        />
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-800 flex items-center justify-center transition-colors text-gray-500"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
                    <Search size={48} strokeWidth={1} />
                    <p className="font-bold">لا توجد نتائج بحث</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 dark:bg-navy-900 border-t border-gray-100 dark:border-navy-700 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold">إجمالي الملصقات:</p>
                  <p className="text-2xl font-black text-navy-900 dark:text-white">
                    {printableItems.filter(i => i.isSelected).reduce((acc, curr) => acc + curr.printQuantity, 0)}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={onClose}
                    className="px-8 py-4 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={handlePrint}
                    disabled={isGenerating || printableItems.filter(i => i.isSelected).length === 0}
                    className="px-10 py-4 bg-brand-primary text-white rounded-2xl font-black flex items-center gap-3 bounce-hover shadow-xl shadow-brand-primary/20 disabled:opacity-50 disabled:grayscale"
                  >
                    <Printer size={20} />
                    <span>{isGenerating ? 'جاري تجهيز الطباعة...' : 'طباعة الملصقات'}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Loader2({ className }: { className?: string }) {
  return <Printer className={className} size={18} />;
}
