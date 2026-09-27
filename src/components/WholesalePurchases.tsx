import { useState, useEffect, useRef } from 'react';
import { 
  Search, Package, ShoppingBasket, Zap, Save, Trash2, Plus, Minus, 
  Barcode, Calculator, Truck, AlertCircle, CheckCircle2, Loader2,
  Maximize2, Minimize2, FileText
} from 'lucide-react';
import { 
  collection, query, where, getDocs, addDoc, serverTimestamp, 
  doc, updateDoc, increment, writeBatch, getDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, InventoryItem, Supplier } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { postPurchaseToGL } from '../services/accountingService';
import { StrictPrecisionEngine } from '../services/StrictPrecisionEngine';

interface WholesalePurchasesProps {
  profile: UserProfile | null;
}

export default function WholesalePurchases({ profile }: WholesalePurchasesProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const searchRef = useRef<HTMLInputElement>(null);

  // تحميل البيانات
  useEffect(() => {
    if (!profile?.ownerId) return;
    const fetchData = async () => {
      try {
        const [invSnap, suppSnap, settingsSnap] = await Promise.all([
          getDocs(query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId))),
          getDocs(query(collection(db, 'suppliers'), where('ownerId', '==', profile.ownerId))),
          getDoc(doc(db, 'settings', profile.ownerId))
        ]);
        setItems(invSnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
        setSuppliers(suppSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
        if (settingsSnap.exists()) {
          setShopSettings(settingsSnap.data());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile?.ownerId]);

  // اختصارات لوحة المفاتيح
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F12') { e.preventDefault(); handleSavePurchase(); }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [cart, selectedSupplier, paymentMethod]);

  const addToCart = (product: InventoryItem, unitType: 'piece' | 'dozen' | 'carton' = 'piece') => {
    const cartId = `${product.id}-${unitType}`;
    const existing = cart.find(c => c.cartId === cartId);
    
    let buyPrice = product.cost || 0;
    let qtyInPieces = 1;
    
    if (unitType === 'dozen') {
      const dozenUnit = product.units?.find(u => u.name.includes('درزن') || u.factor === 12);
      qtyInPieces = dozenUnit?.factor || 12;
      buyPrice = (product.cost || 0) * qtyInPieces;
    } else if (unitType === 'carton') {
      const cartonUnit = product.units?.find(u => u.name.includes('كرتون') || u.factor >= 24);
      qtyInPieces = cartonUnit?.factor || 24;
      buyPrice = (product.cost || 0) * qtyInPieces;
    }

    if (existing) {
      setCart(cart.map(c => c.cartId === cartId ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { 
        cartId, 
        id: product.id, 
        name: product.name, 
        buyPrice, 
        quantity: 1, 
        unitType, 
        qtyInPieces,
        originalProduct: product 
      }]);
    }
  };

  const removeFromCart = (cartId: string) => {
    setCart(cart.filter(c => c.cartId !== cartId));
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.cartId === cartId) {
        const newQty = Math.max(0.1, c.quantity + delta);
        return { ...c, quantity: newQty };
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const updatePrice = (cartId: string, newPrice: number) => {
    setCart(cart.map(c => c.cartId === cartId ? { ...c, buyPrice: newPrice } : c));
  };

  const total = cart.reduce((acc, item) => {
    const q = StrictPrecisionEngine.parseFractionOrDecimal(item.quantity);
    const p = Number(item.buyPrice) || 0;
    const lineTotal = StrictPrecisionEngine.financialRound(q * p, 2);
    return StrictPrecisionEngine.safeAdd(acc, lineTotal, 2);
  }, 0);

  const handleSavePurchase = async () => {
    if (cart.length === 0 || !profile?.ownerId) return;
    if (!selectedSupplier) {
       alert('يرجى اختيار المورد أولاً');
       return;
    }

    // تدقيق توازن الفاتورة المحاسبي الصارم (Audit Balance Validation)
    const balanceAudit = StrictPrecisionEngine.verifyInvoiceBalance(
      cart.map(c => ({
        quantity: StrictPrecisionEngine.parseFractionOrDecimal(c.quantity),
        price: Number(c.buyPrice) || 0,
        discount: 0
      })),
      0,
      0,
      total
    );

    if (!balanceAudit.isBalanced) {
      console.warn('⚠️ تنبيه فروقات الموازنة المحاسبية للفاتورة:', balanceAudit.message);
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      // 1. تسجيل فاتورة المشتريات
      const purchaseRef = doc(collection(db, 'purchases'));
      batch.set(purchaseRef, {
        ownerId: profile.ownerId,
        buyerId: profile.uid,
        buyerName: profile.name,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        items: cart,
        total,
        paymentMethod,
        status: 'completed',
        isAuditBalanced: balanceAudit.isBalanced,
        createdAt: serverTimestamp(),
      });

      // 2. تحديث المخزون (زيادة الكميات بالوحدة الصغرى وحساب المتوسط المرجح WAC الصارم)
      for (const item of cart) {
        const itemRef = doc(db, 'inventory', item.id);
        const qtyInPieces = Number(item.qtyInPieces) || 1;
        const qtyNew = StrictPrecisionEngine.convertMajorToBaseUnit(item.quantity, qtyInPieces);
        const costNew = StrictPrecisionEngine.safeDiv(item.buyPrice, qtyInPieces, 4);
        const currentStock = Math.max(0, item.originalProduct?.stock || 0);
        const currentCost = item.originalProduct?.cost || item.originalProduct?.lastBuyPrice || 0;
        
        const weightedCost = StrictPrecisionEngine.calculateWeightedAverageCost(
          currentStock,
          currentCost,
          qtyNew,
          costNew
        );

        let newPrice = item.originalProduct?.price || 0;
        if (shopSettings?.autoPricingEnabled) {
          const margin = shopSettings.autoPricingProfitMargin || 15;
          newPrice = StrictPrecisionEngine.financialRound(weightedCost * (1 + margin / 100), 2);
        }

        batch.update(itemRef, {
          stock: increment(qtyNew),
          lastBuyPrice: costNew,
          cost: weightedCost,
          price: newPrice,
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();

      if (profile?.ownerId) {
        postPurchaseToGL(profile.ownerId, {
          id: purchaseRef.id,
          total,
          paymentMethod,
          type: 'purchase'
        });
      }

      setCart([]);
      setSelectedSupplier(null);
      alert('تم تسجيل فاتورة المشتريات وتحديث المخزون بنجاح');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'purchases');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <Loader2 className="animate-spin text-brand-primary" size={48} />
      <p className="font-black animate-pulse">جاري تحميل نظام المشتريات...</p>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 dark:bg-navy-950 overflow-hidden">
      {/* المنتجات */}
      <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-primary transition-colors" size={20} />
            <input 
              ref={searchRef}
              type="text" 
              placeholder="ابحث عن صنف لشرائه (F1)..." 
              className="w-full pr-12 pl-4 py-4 bg-white dark:bg-navy-900 rounded-2xl border-2 border-transparent focus:border-brand-primary outline-none shadow-sm transition-all font-bold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 px-6 bg-blue-600/10 text-blue-600 rounded-2xl font-black border border-blue-600/20">
             <Truck size={20} />
             <span>نظام مشتريات الجملة</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pr-2 custom-scrollbar">
          {items
            .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.barcode === searchQuery)
            .map((item, idx) => (
            <motion.div 
              layout
              key={`pur-prod-${item.id}-${idx}`}
              className="bg-white dark:bg-navy-900 p-4 rounded-[2rem] border border-gray-100 dark:border-navy-800 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
            >
              <h3 className="font-black text-sm mb-1 truncate">{item.name}</h3>
              <div className="flex justify-between items-center mb-4">
                 <span className="text-[10px] text-gray-400 font-bold">الرصيد الحالي: {item.stock}</span>
                 <span className="text-[10px] text-blue-600 font-black">التكلفة: {item.cost}</span>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={() => addToCart(item, 'piece')}
                  className="w-full py-2 bg-gray-50 dark:bg-navy-800 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2"
                >
                  شراء حبة
                </button>
                <button 
                  onClick={() => addToCart(item, 'dozen')}
                  className="w-full py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2"
                >
                  شراء درزن
                </button>
                <button 
                  onClick={() => addToCart(item, 'carton')}
                  className="w-full py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2"
                >
                  شراء كرتون
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* فاتورة المشتريات */}
      <div className="w-full lg:w-[450px] bg-white dark:bg-navy-900 shadow-[-20px_0_50px_rgba(0,0,0,0.05)] border-r border-gray-100 dark:border-navy-800 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-navy-800 flex items-center justify-between">
           <h2 className="text-xl font-black flex items-center gap-3 italic">
              <FileText className="text-blue-600" />
              تجهيز فاتورة الشراء
           </h2>
           <button onClick={() => setCart([])} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
              <Trash2 size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
               <Truck size={48} className="text-gray-200 mb-4" />
               <p className="text-gray-400 font-bold">لم تضف أي بضاعة للشرء بعد</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {cart.map((item, idx) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={`pur-cart-${item.cartId}-${idx}`}
                  className="p-4 bg-gray-50 dark:bg-navy-800 rounded-3xl"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-black text-sm">{item.name} ({item.unitType === 'carton' ? 'كرتون' : item.unitType === 'dozen' ? 'درزن' : 'حبة'})</h4>
                    <button onClick={() => removeFromCart(item.cartId)} className="text-rose-500"><Trash2 size={16}/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                     <div className="flex items-center gap-3 bg-white dark:bg-navy-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-navy-700">
                        <button onClick={() => updateQuantity(item.cartId, -1)} className="text-blue-600"><Minus size={14}/></button>
                        <span className="font-black text-sm w-10 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.cartId, 1)} className="text-blue-600"><Plus size={14}/></button>
                     </div>
                     <div className="relative">
                        <input 
                          type="number" 
                          className="w-full text-left bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-700 rounded-xl py-1.5 px-3 font-black text-blue-600 text-sm outline-none"
                          value={item.buyPrice}
                          onChange={(e) => updatePrice(item.cartId, Number(e.target.value))}
                        />
                        <span className="absolute right-0 -top-4 text-[8px] text-gray-400 font-bold uppercase">سعر الشراء</span>
                     </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="p-6 bg-gray-50 dark:bg-navy-950 border-t border-gray-100 dark:border-navy-800 space-y-4">
          <div className="space-y-4">
             <select 
                className="w-full py-3 px-4 bg-white dark:bg-navy-900 rounded-xl font-bold text-xs shadow-sm border-none outline-none"
                value={selectedSupplier?.id || ''}
                onChange={(e) => {
                  const s = suppliers.find(supp => supp.id === e.target.value);
                  setSelectedSupplier(s || null);
                }}
              >
                <option value="">اختر المورد...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}
              </select>

              <div className="flex gap-2 p-1 bg-white dark:bg-navy-900 rounded-xl">
                {(['cash', 'credit'] as const).map(m => (
                  <button 
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${paymentMethod === m ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                  >
                    {m === 'cash' ? 'دفع نقدي' : 'شراء آجل'}
                  </button>
                ))}
              </div>
          </div>

          <div className="flex justify-between items-center py-4 border-t border-dashed border-gray-200">
             <span className="text-sm font-black text-gray-400">إجمالي فاتورة الشراء</span>
             <span className="text-3xl font-black text-navy-950 dark:text-white">{total.toLocaleString()}</span>
          </div>

          <button 
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleSavePurchase}
            className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : (
              <><Save size={24} /> حفظ فاتورة المشتريات (F12)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
