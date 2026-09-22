import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Settings2, 
  Save, 
  AlertCircle,
  RefreshCw,
  Edit3,
  Calculator,
  Database,
  ArrowRightLeft,
  Info
} from 'lucide-react';
import { collection, query, where, getDocs, writeBatch, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { InventoryItem, ShopSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { JamAutoPricingManager } from './JamAutoPricingManager';

interface PricingManagerProps {
  profile: any;
  shopSettings: ShopSettings;
  setShopSettings: React.Dispatch<React.SetStateAction<ShopSettings>>;
}

export default function PricingManager({ profile, shopSettings, setShopSettings }: PricingManagerProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Rules State
  const [profitMargin, setProfitMargin] = useState(shopSettings.autoPricingProfitMargin || 15);
  const [direction, setDirection] = useState<'cost_to_sale' | 'sale_to_cost' | 'none'>(shopSettings.autoPricingDirection || 'none');
  const [isEnabled, setIsEnabled] = useState(shopSettings.autoPricingEnabled || false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchItems();
  }, [profile?.ownerId]);

  const fetchItems = async () => {
    if (!profile?.ownerId) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'inventory'), 
        where('ownerId', '==', profile.ownerId)
      );
      const snap = await getDocs(q);
      const inventoryData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setItems(inventoryData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGlobalRules = async () => {
    if (!profile?.ownerId) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'settings', profile.ownerId), {
        autoPricingEnabled: isEnabled,
        autoPricingProfitMargin: profitMargin,
        autoPricingDirection: direction,
        updatedAt: serverTimestamp()
      });
      
      setShopSettings({
        ...shopSettings,
        autoPricingEnabled: isEnabled,
        autoPricingProfitMargin: profitMargin,
        autoPricingDirection: direction
      });
      
      setStatus({ type: 'success', message: 'تم حفظ قواعد التسعير التلقائي بنجاح' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const applyPricingLocally = async () => {
    if (!window.confirm('هل أنت متأكد من تطبيق تحديث الأسعار على جميع الأصناف المختارة؟ لا يمكن التراجع عن هذه العملية.')) return;
    
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      let count = 0;

      const itemsToUpdate = items.filter(item => 
        selectedCategory === 'all' || item.category === selectedCategory
      );

      itemsToUpdate.forEach(item => {
        let newPrice = item.price;
        let newCost = item.cost;

        if (direction === 'cost_to_sale') {
          newPrice = Math.round(item.cost * (1 + profitMargin / 100));
          if (newPrice !== item.price) {
            batch.update(doc(db, 'inventory', item.id), { price: newPrice });
            count++;
          }
        } else if (direction === 'sale_to_cost') {
          newCost = Math.round(item.price / (1 + profitMargin / 100));
          if (newCost !== item.cost) {
            batch.update(doc(db, 'inventory', item.id), { cost: newCost });
            count++;
          }
        }
      });

      if (count > 0) {
        await batch.commit();
        setStatus({ type: 'success', message: `تم تحديث ${count} صنف بنجاح` });
        fetchItems();
      } else {
        setStatus({ type: 'info' as any, message: 'لا توجد أصناف تحتاج للتحديث' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const categories = Array.from(new Set(items.map(i => i.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-navy-900 dark:text-brand-primary flex items-center gap-3">
            <Calculator className="text-brand-primary" size={32} />
            مدير التسعير التلقائي
          </h2>
          <p className="text-sm text-gray-500 mt-1">تحكم بأسعار البيع والشراء بناءً على قواعد ونسب مئوية ثابتة</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchItems}
            className="p-3 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-2xl text-gray-500 hover:text-brand-primary transition-all shadow-sm"
            title="تحديث البيانات"
          >
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          <button 
            onClick={saveGlobalRules}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-2xl font-black shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            <Save size={20} />
            حفظ القواعد الدائمة
          </button>
        </div>
      </div>

      {status && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm ${
            status.type === 'success' ? 'bg-success/10 border-success/20 text-success' : 'bg-danger/10 border-danger/20 text-danger'
          }`}
        >
          <AlertCircle size={20} />
          <span className="font-bold">{status.message}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules Config Panel */}
        <div className="lg:col-span-2 space-y-6">
          <JamAutoPricingManager 
            storeCode={shopSettings?.storeCode || profile?.ownerId || 'STORE_DEFAULT'} 
            ownerId={profile?.ownerId || ''} 
            onSyncComplete={fetchItems} 
          />
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <div className="card-glass p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-navy-900/10 pb-3">
              <RefreshCw className="text-brand-primary" size={20} />
              <h3 className="font-black text-base">تحديث جماعي (مرة واحدة)</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">نطاق التحديث</label>
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl font-bold"
                >
                  <option value="all">جميع المخازن / التصنيفات</option>
                  {categories.filter(c => c && c !== 'all').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="p-4 bg-navy-50 dark:bg-navy-900 rounded-xl space-y-2">
                <p className="text-[10px] font-bold text-gray-400">ملخص العملية:</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>عدد الأصناف:</span>
                    <span className="font-black text-navy-900 dark:text-brand-primary">
                      {items.filter(i => selectedCategory === 'all' || i.category === selectedCategory).length}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>العملية:</span>
                    <span className="font-black text-brand-primary">
                      {direction === 'cost_to_sale' ? 'تحديث سعر البيع' : direction === 'sale_to_cost' ? 'تحديث سعر التكلفة' : 'لم يتم تحديد اتجاه'}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={applyPricingLocally}
                disabled={isLoading || direction === 'none'}
                className="w-full py-4 bg-navy-900 text-white rounded-2xl font-black shadow-xl hover:bg-navy-800 active:scale-95 transition-all disabled:opacity-50"
              >
                تطبيق التحديث الآن
              </button>
            </div>
          </div>

          <div className="card-glass p-6 bg-brand-primary/5 border-brand-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Database className="text-brand-primary" size={20} />
              <h3 className="font-black text-sm">إحصائيات الأسعار</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">إجمالي قيمة المخزون (بيع):</span>
                <span className="text-sm font-black text-navy-900 dark:text-white">
                  {items.reduce((acc, i) => acc + (i.price * i.stock), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">إجمالي قيمة المخزون (شراء):</span>
                <span className="text-sm font-black text-navy-900 dark:text-white">
                  {items.reduce((acc, i) => acc + (i.cost * i.stock), 0).toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-navy-900/10 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500">الربح المتوقع:</span>
                <span className="text-sm font-black text-success">
                  {(items.reduce((acc, i) => acc + (i.price * i.stock), 0) - items.reduce((acc, i) => acc + (i.cost * i.stock), 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
