import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Settings, 
  Save, 
  AlertCircle,
  RefreshCw,
  Calculator,
  Database,
  ArrowRightLeft,
  Info,
  CheckCircle,
  Sparkles,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

// تراكيب بيانات قواعد التسعير للمحل - التصميم الملكي
export interface JamPricingRule {
  isRuleEnabled: boolean;
  strategyDirection: 'BUY_BASED_ON_SELL' | 'SELL_BASED_ON_BUY';
  percentageMarkup: number;
  fixedMarkup: number;
  updatedAt: any;
}

interface JamAutoPricingManagerProps {
  storeCode: string;
  ownerId: string;
  onSyncComplete: () => void;
}

export const JamAutoPricingManager: React.FC<JamAutoPricingManagerProps> = ({ storeCode, ownerId, onSyncComplete }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [strategy, setStrategy] = useState<'BUY_BASED_ON_SELL' | 'SELL_BASED_ON_BUY'>('SELL_BASED_ON_BUY');
  const [percentage, setPercentage] = useState<number>(5); // 5% كحد افتراضي لهامش ربح التجار
  const [fixedAmount, setFixedAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // لخيارات استعراض إحصائيات المعالجة قبل الحفظ
  const [itemsCount, setItemsCount] = useState(0);
  const [showExplanation, setShowExplanation] = useState(true);

  // 1. تحميل القواعد المحفوظة مسبقاً من مسار السيادة المستقل للمحل
  useEffect(() => {
    const loadPricingRules = async () => {
      if (!storeCode) return;
      try {
        const docRef = doc(db, 'stores', storeCode, 'settings', 'pricingRules');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsEnabled(data.isRuleEnabled ?? false);
          setStrategy(data.strategyDirection ?? 'SELL_BASED_ON_BUY');
          setPercentage(data.percentageMarkup ?? 5);
          setFixedAmount(data.fixedMarkup ?? 0);
        }
      } catch (error) {
        console.error("⚠️ فشل تحميل قواعد التسعير المستقلة:", error);
      }
    };

    // تحميل عدد السلع الكلية في المخزن للمعاينة الذكية
    const fetchItemsCount = async () => {
      if (!ownerId) return;
      try {
        const q = query(
          collection(db, 'inventory'), 
          where('ownerId', '==', ownerId)
        );
        const snap = await getDocs(q);
        setItemsCount(snap.size);
      } catch (err) {
        console.error("⚠️ فشل تحميل إحصاء السلع للمعاينة:", err);
      }
    };

    loadPricingRules();
    fetchItemsCount();
  }, [storeCode, ownerId]);

  // 2. معالج ترحيل وحفظ القواعد الدائمة في السيرفر وتحديث معلومات الكتالوج فوراً
  const handleSavePricingRules = async () => {
    if (!storeCode) {
      setStatus({ type: 'error', message: 'رمز المتجر غير متاح حالياً للاتصال.' });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const pricingPayload: JamPricingRule = {
        isRuleEnabled: isEnabled,
        strategyDirection: strategy,
        percentageMarkup: Number(percentage),
        fixedMarkup: Number(fixedAmount),
        updatedAt: serverTimestamp()
      };

      console.log(`📈 جاري اعتماد وحقن قواعد التسعير التلقائي للمتجر ${storeCode}:`, pricingPayload);
      
      // الحقن بداخل الفايربيز للسيادة المستقلة للمحل
      const docRef = doc(db, 'stores', storeCode, 'settings', 'pricingRules');
      await setDoc(docRef, pricingPayload, { merge: true });

      // تفعيل معالجة الكتالوج وإعادة الحساب الذكي للخلفية فورياً
      let recalculationMessage = '';
      if (isEnabled && ownerId) {
        // فلب خوارزمية جلب السلع لتنفيذ الحساب
        const q = query(
          collection(db, 'inventory'), 
          where('ownerId', '==', ownerId)
        );
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        let updateCount = 0;

        snap.docs.forEach(docSnap => {
          const item = docSnap.data();
          let currentPrice = item.price || 0;
          let currentCost = item.cost || 0;
          let didChange = false;

          if (strategy === 'SELL_BASED_ON_BUY') {
            // سعر البيع بناءً على الشراء والجرام (الربح = التكلفة + نسبة الهامش المحدثة + مبلغ إضافي)
            const calculatedPrice = Math.round(currentCost * (1 + Number(percentage) / 100)) + Number(fixedAmount);
            if (calculatedPrice !== currentPrice && calculatedPrice > Number(fixedAmount)) {
              batch.update(docSnap.ref, { 
                price: calculatedPrice,
                updatedAt: serverTimestamp()
              });
              didChange = true;
            }
          } else if (strategy === 'BUY_BASED_ON_SELL') {
            // سعر الشراء والتكلفة بناءً على السوق والبيع (التكلفة = سعر البيع الحالي / (1 + نسبة الهامش))
            // نطرح المبلغ الثابت أولاً من السعر ثم نحسب التكلفة قبل الهامش النسبة
            const calculatedCost = Math.round((currentPrice - Number(fixedAmount)) / (1 + Number(percentage) / 100));
            if (calculatedCost !== currentCost && calculatedCost >= 0) {
              batch.update(docSnap.ref, { 
                cost: calculatedCost,
                updatedAt: serverTimestamp()
              });
              didChange = true;
            }
          }

          if (didChange) {
            updateCount++;
          }
        });

        if (updateCount > 0) {
          await batch.commit();
          recalculationMessage = ` وقمنا بإعادة تسعير وتحديث ${updateCount} صنف بالمخزن فوراً!`;
        } else {
          recalculationMessage = ' (جميع السلع مطابقة بالفعل للنسب المحددة، لا داعي للتحديث).';
        }
      } else {
        recalculationMessage = ' وتم تعطيل التطبيق الآلي الفوري على المخزون.';
      }

      // إخطار المتجر ومزامنة الجداول
      if (onSyncComplete) {
        onSyncComplete();
      }

      setStatus({ 
        type: 'success', 
        message: `✓ تم حفظ قواعد التسعير الدائمة بنجاح!${recalculationMessage}` 
      });

      // إخفاء الإشعار بعد فترة قصيرة
      setTimeout(() => setStatus(null), 5000);
    } catch (error: any) {
      console.error("❌ خطأ في حفظ قواعد التسعير وإعادة الحساب الذكي:", error);
      setStatus({ 
        type: 'error', 
        message: `فشل الحفظ: ${error.message || 'مشكلة في خادم الاتصالات المالي.'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="relative text-right overflow-hidden rounded-[2.2rem] border border-[#cf8a3c]/30 shadow-2xl p-6 md:p-8 animate-fade-in transition-all text-slate-100" 
      style={{ 
        background: 'linear-gradient(145deg, #0b1126, #040817)',
        boxShadow: '0 25px 60px rgba(2, 6, 23, 0.9), inset 0 1px 2px rgba(255, 255, 255, 0.05)'
      }} 
      dir="rtl"
    >
      {/* Royal Sparkle background bubble */}
      <div className="absolute top-0 left-0 w-44 h-44 bg-[#cf8a3c]/5 rounded-full blur-3xl pointer-events-none" />

      {/* الرأس الفخم */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#cf8a3c]/15 border border-[#cf8a3c]/35 text-[#cf8a3c] flex items-center justify-center shadow-lg shadow-[#cf8a3c]/10">
            <Calculator size={26} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#cf8a3c]/20 text-[#f5d061] text-[9px] font-black rounded-md border border-[#cf8a3c]/30">المنظومة الذكية</span>
              <h3 className="text-lg font-black text-white">مدير التسعير التلقائي الفوري</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              جدول قواعد مستقلة للمحل يضمن الحساب المباشر لهامش الأرباح وتكاليف التوريد والمبيع تزامناً مع السوق.
            </p>
          </div>
        </div>

        {/* زر التنبيه الفخم للمؤشر */}
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          type="button"
          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 border border-white/10 self-start sm:self-auto cursor-pointer"
        >
          <HelpCircle size={14} />
          {showExplanation ? "إخفاء التفاصيل" : "عرض دليل الحسابات"}
        </button>
      </div>

      {/* دليل ودستور العملية الحسابية الدائم */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-slate-950/40 border border-[#cf8a3c]/15 rounded-2xl text-xs space-y-2 pointer-events-none text-slate-400 backdrop-blur-sm overflow-hidden"
          >
            <div className="flex items-center gap-1.5 text-[#f5d061] font-black text-xs">
              <Sparkles size={14} />
              <span>معايير السياسة الحسابية التلقائية للمتجر:</span>
            </div>
            <p>
              • <strong className="text-slate-300">سعر البيع بناءً على الشراء والجرام:</strong> يفيد تجار التجزئة بحيث بمجرد إدخال سعر التكلفة للغرض أو الشحن، يقوم النظام بحساب سعر مبيعه آلياً كالتالي: <span className="text-[#cf8a3c] num-mono font-black">(التكلفة * (1 + نسبة الهامش/100)) + الإضافي المقطوع</span>.
            </p>
            <p>
              • <strong className="text-slate-300">سعر التكلفة بناءً على السوق والبيع:</strong> مفيد في فحص هوامش المبيعات وشرائح الخصم؛ بحيث يتم فك تكلفة الغرض آلياً بناءً على سعر البيع الحالي في السوق كالتالي: <span className="text-[#cf8a3c] num-mono font-black">((سعر البيع - المقطوع) / (1 + نسبة الهامش/100))</span>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Overlay messages */}
      {status && (
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl mb-6 flex items-start gap-3 border shadow-lg ${
            status.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          {status.type === 'success' ? <CheckCircle size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
          <div>
            <span className="font-extrabold text-sm block">
              {status.type === 'success' ? 'عملية موفقة' : 'تنبيه بالنظام'}
            </span>
            <span className="text-xs mt-1 block font-medium">{status.message}</span>
          </div>
        </motion.div>
      )}

      {/* بورد التحكم الرئيسي */}
      <div className="space-y-6">
        
        {/* Toggle Switch */}
        <div className="p-4 bg-slate-950/60 border border-white/5 rounded-2xl flex items-center justify-between">
          <div className="text-right">
            <span className="text-xs font-black text-white block">⚙️ تفعيل محرك التسعير الآلي الفوري</span>
            <span className="text-[10px] text-slate-400 mt-1 block">
              عند تفعيله، سيتم فرض الهوامش والنسب المعطاة آلياً على كافة السلع المعروضة حال حفظك للبيانات.
            </span>
          </div>
          
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={isEnabled} 
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-slate-950 after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#cf8a3c] peer-checked:after:bg-slate-950 shadow-inner"></div>
            <span className="mr-3 text-xs font-black text-slate-300">
              {isEnabled ? 'مفعّل ونشط' : 'معطّل الآن'}
            </span>
          </label>
        </div>

        {/* اتجاه التسعير التلقائي */}
        <div className="space-y-3">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <ArrowRightLeft size={14} className="text-[#cf8a3c]" />
            وجهة حساب الأسعار المفضلة للمخازن:
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Strategy 1: Sell based on purchase */}
            <div 
              onClick={() => setStrategy('SELL_BASED_ON_BUY')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${
                strategy === 'SELL_BASED_ON_BUY'
                ? 'border-[#cf8a3c] bg-[#cf8a3c]/10 text-white shadow-md'
                : 'border-white/5 bg-slate-900/60 text-slate-400 hover:border-white/10 hover:text-slate-200'
              }`}
            >
              <div className="text-right">
                <span className="text-xs font-black block">📈 سعر البيع بناءً على الشحن والشراء</span>
                <span className="text-[10px] text-slate-500 mt-1 block">الأرباح = سعر التكلفة المتوفر + % نسبة الهامش</span>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${strategy === 'SELL_BASED_ON_BUY' ? 'bg-[#cf8a3c] text-slate-950' : 'bg-slate-800'}`}>
                <TrendingUp size={16} strokeWidth={2.5} />
              </div>
            </div>

            {/* Strategy 2: Buy based on sell */}
            <div 
              onClick={() => setStrategy('BUY_BASED_ON_SELL')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${
                strategy === 'BUY_BASED_ON_SELL'
                ? 'border-[#cf8a3c] bg-[#cf8a3c]/10 text-white shadow-md'
                : 'border-white/5 bg-slate-900/60 text-slate-400 hover:border-white/10 hover:text-slate-200'
              }`}
            >
              <div className="text-right">
                <span className="text-xs font-black block">📉 سعر الشراء والتكلفة بناءً على السوق</span>
                <span className="text-[10px] text-slate-500 mt-1 block">التكلفة الآمنة = سعر السوق المعروض / (1 + % نسبة الفارق)</span>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${strategy === 'BUY_BASED_ON_SELL' ? 'bg-[#cf8a3c] text-slate-950' : 'bg-slate-800'}`}>
                <TrendingDown size={16} strokeWidth={2.5} />
              </div>
            </div>

          </div>
        </div>

        {/* مدخلات الحساب الذكي */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          
          {/* نسبة الهامش المئوية */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 flex items-center gap-1">
              <Percent size={13} className="text-[#cf8a3c]" />
              نسبة الهامش أو الفارق المئوية (%)
            </label>
            <div className="relative">
              <input 
                type="number"
                value={percentage}
                onChange={(e) => setPercentage(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full p-4 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-2xl outline-none text-xl font-bold font-mono text-center text-[#f5d061]"
                min="0"
                step="0.5"
                placeholder="أدخل نسبة الهامش..."
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</div>
            </div>
            
            {/* Quick value tags */}
            <div className="flex flex-wrap gap-1.5 justify-center pt-1">
              {[3, 5, 8, 10, 15, 20, 25].map(val => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setPercentage(val)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                    percentage === val 
                    ? 'bg-[#cf8a3c] text-slate-950 shadow-sm' 
                    : 'bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          {/* المبلغ الثابت المضاف */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 flex items-center gap-1">
              <span className="text-[#cf8a3c] font-black text-xs">YER</span>
              المبلغ المضاف الثابت والمقطوع فوري (YER)
            </label>
            <div className="relative">
              <input 
                type="number"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-4 bg-slate-950 border border-white/10 focus:border-[#cf8a3c] rounded-2xl outline-none text-xl font-bold font-mono text-center text-[#f5d061]"
                min="0"
                placeholder="0 (اختياري)"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xs">ر.ي</div>
            </div>

            {/* Quick fixed value tags */}
            <div className="flex flex-wrap gap-1.5 justify-center pt-1">
              {[0, 100, 250, 500, 1000, 1500, 2000].map(val => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setFixedAmount(val)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                    fixedAmount === val 
                    ? 'bg-[#cf8a3c] text-slate-950 shadow-sm' 
                    : 'bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {val === 0 ? 'مقطوع صفر' : `+${val.toLocaleString()} ر.ي`}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* المخزن المستهدف للإبراق ومعلومات الدعم */}
        <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-[#cf8a3c]" />
            <span>إجمالي سلع المخازن المنتسبة للفرع الحالي:</span>
          </div>
          <span className="font-black text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-white/10 num-mono">
            {itemsCount} سلع مسجلة
          </span>
        </div>

        {/* زر التثبيت النهائي */}
        <button 
          onClick={handleSavePricingRules}
          disabled={loading}
          type="button"
          className="w-full py-4 rounded-xl font-black text-xs text-slate-950 shadow-md hover:scale-[1.01] active:scale-95 transition-all text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          style={{ 
            background: 'linear-gradient(135deg, #cf8a3c, #f5d061)',
            boxShadow: '0 8px 20px rgba(207, 138, 60, 0.25)'
          }}
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>جاري حقن الحسابات وقيد قواعد المتجر تلقائياً...</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>💾 حفظ واعتماد قواعد التسعير التلقائية الدائمة وإدارة الكتل</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
};
