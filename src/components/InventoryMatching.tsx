import { useState, useEffect } from 'react';
import { 
  Scan, 
  ClipboardCheck, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2,
  Package,
  Search,
  ArrowRightLeft
} from 'lucide-react';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, InventoryItem, InventoryMatch } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryMatchingProps {
  profile: UserProfile | null;
}

export default function InventoryMatching({ profile }: InventoryMatchingProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [matches, setMatches] = useState<{[key: string]: number}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.ownerId) return;
    const q = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    return onSnapshot(q, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    }, (error) => {
      console.warn("JAM SYSTEM PRO - Locked Error Safely (InventoryMatching):", error.message);
      setInventory([]);
    });
  }, [profile]);

  const handleMatchChange = (itemId: string, value: string) => {
    setMatches(prev => ({ ...prev, [itemId]: Number(value) }));
  };

  const submitAudits = async () => {
    if (Object.keys(matches).length === 0) return;
    if (!window.confirm('هل أنت متأكد من اعتماد مخرجات الجرد؟ سيتم تسجيل العجز/الفائض وتسوية المخزون.')) return;

    setIsSubmitting(true);
    try {
      for (const [itemId, physicalStock] of Object.entries(matches)) {
        const item = inventory.find(i => i.id === itemId);
        if (!item) continue;

        const difference = physicalStock - item.stock;
        const valueDifference = difference * item.cost;

        // 1. Record Match result
        await addDoc(collection(db, 'inventoryMatches'), {
          ownerId: profile?.ownerId,
          itemId,
          itemName: item.name,
          softwareStock: item.stock,
          physicalStock,
          difference,
          valueDifference,
          status: 'adjusted',
          createdAt: serverTimestamp()
        });

        // 2. Adjust Stock
        await updateDoc(doc(db, 'inventory', itemId), {
          stock: physicalStock
        });

        // Sync to subcollection doc: warehouses/{warehouseId}/stock/{productId}
        const primaryWarehouseId = item.category || 'المحل';
        await setDoc(doc(db, 'warehouses', primaryWarehouseId, 'stock', itemId), {
          productId: itemId,
          warehouseId: primaryWarehouseId,
          stock: physicalStock,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 3. If missing (loss), record in damaged/losses
        if (difference < 0) {
          await addDoc(collection(db, 'damagedItems'), {
            ownerId: profile?.ownerId,
            itemId,
            itemName: item.name,
            quantity: Math.abs(difference),
            cost: item.cost,
            totalLoss: Math.abs(valueDifference),
            reason: 'نقص عند مطابقة المخزن',
            createdAt: serverTimestamp()
          });
        }
      }
      alert('تم اعتماد الجرد وتسوية المخازن بنجاح.');
      setMatches({});
    } catch (err) {
      console.error(err);
      alert('خطأ في اعتماد الجرد');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInventory = inventory.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.barcode?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="bg-navy-900 border-r-4 border-r-brand-primary p-6 rounded-3xl text-white flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-black flex items-center gap-2">
            <ClipboardCheck className="text-brand-primary" />
            مطابقة المخزن (الجرد الفعلي)
          </h3>
          <p className="text-xs text-gray-400 font-bold">قم بتسجيل العدد الفعلي الموجود في المخزن لمطابقته مع النظام</p>
        </div>
        <button 
          onClick={submitAudits}
          disabled={isSubmitting || Object.keys(matches).length === 0}
          className="btn-primary px-8 flex items-center gap-2 group"
        >
          {isSubmitting ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />}
          اعتماد الجرد المكتمل
        </button>
      </div>

      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text"
          placeholder="ابحث عن صنف بالاسم أو الباركود للجرد..."
          className="w-full pr-12 pl-4 py-4 bg-white dark:bg-navy-800 border border-gray-100 dark:border-navy-700 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/50 shadow-sm transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInventory.map((item) => {
          const physical = matches[item.id] !== undefined ? matches[item.id] : '';
          const diff = physical !== '' ? Number(physical) - item.stock : 0;
          
          return (
            <motion.div 
              key={item.id} 
              layout
              className={`card-glass p-6 space-y-4 border-2 transition-all ${physical !== '' ? (diff === 0 ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5') : 'border-transparent'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-navy-900 dark:text-white">{item.name}</h4>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{item.barcode || 'NO BARCODE'}</p>
                </div>
                <div className="p-2 bg-navy-50 dark:bg-navy-900 rounded-lg text-brand-primary">
                  <Package size={18} />
                </div>
              </div>

              <div className="flex items-center gap-4 bg-navy-50 dark:bg-navy-900/50 p-4 rounded-2xl">
                 <div className="text-center flex-1">
                    <p className="text-[10px] text-gray-400 font-bold mb-1">المسجل برمجياً</p>
                    <p className="text-xl font-black text-navy-900 dark:text-white">{item.stock}</p>
                 </div>
                 <ArrowRightLeft className="text-gray-300" size={20} />
                 <div className="text-center flex-1">
                    <p className="text-[10px] text-gray-400 font-bold mb-1">العدد الفعلي</p>
                    <input 
                      type="number" 
                      className="w-full bg-white dark:bg-navy-800 border-2 border-brand-primary/20 rounded-xl px-2 py-1 text-center font-black text-brand-primary focus:border-brand-primary outline-none"
                      value={physical}
                      onChange={(e) => handleMatchChange(item.id, e.target.value)}
                      placeholder="?"
                    />
                 </div>
              </div>

              {physical !== '' && (
                <div className={`p-3 rounded-xl flex items-center justify-between text-xs font-black ${diff === 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  <span>{diff === 0 ? 'مطابق تماماً ✓' : (diff > 0 ? `فائض: +${diff}` : `عجز: ${diff}`)}</span>
                  {diff !== 0 && <span>قيمة الفرق: {(diff * item.cost).toFixed(0)} ر.ي</span>}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
