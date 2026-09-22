import React, { useState, useEffect, useMemo } from 'react';
import { 
  Check, 
  Plus, 
  Search, 
  Tag, 
  Trash2, 
  Smartphone, 
  Cpu, 
  Eye, 
  ShieldCheck, 
  Database, 
  RefreshCw,
  Info,
  Layers,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, doc, updateDoc, writeBatch } from 'firebase/firestore';

// هياكل البيانات للصنف والشبكة المحاسبية
export interface CompatibilityItem {
  id: string;                 // المعرف الفريد للصنف UUID
  name: string;               // اسم الصنف الأساسي (مثل: شاشة سامسونج A11)
  category: string;           // القسم (قطع غيار، لواصق، غلافات)
  price: number;              // السعر
  compatibilityList: string[]; // مصفوفة الموديلات والأجهزة المتوافقة معها (مثل: ["A115", "M11", "A11 Core"])
  stock?: number;
}

interface JAMCompatibilityEngineProps {
  ownerId?: string;
  items: CompatibilityItem[];
  onUpdateItems?: (updatedItems: CompatibilityItem[]) => void;
  isMerchantMode?: boolean;  // هل هو لوحة تحكم التاجر أم شاشة تصفح للزبون؟
}

/**
 * JAM Compatibility Engine (Cross-Product Compatibility Engine)
 * محرك التوافق والبدائل المتقاطعة للأصناف والقطع لبرنامج JAM System Pro
 * مصمم لربط المواد ببعضها ومعالجة البدائل أوفلاين بالكامل مع دعم الحفط المحسّن
 */
export const JAMCompatibilityEngine: React.FC<JAMCompatibilityEngineProps> = ({ 
  ownerId, 
  items = [], 
  onUpdateItems,
  isMerchantMode = true 
}) => {
  // الحالات المحلية
  const [products, setProducts] = useState<CompatibilityItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<CompatibilityItem | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'err'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'merchant' | 'client'>(isMerchantMode ? 'merchant' : 'client');

  // تحميل المنتجات ومزامنتها محلياً (الحصانة والأوفلاين)
  useEffect(() => {
    // محاكاة أو تحميل من التمرير
    if (items && items.length > 0) {
      setProducts(items);
    } else {
      // تحميل بيانات تجريبية إذا لم تُمرر
      const localData = localStorage.getItem('jam_offline_compatibility_products');
      if (localData) {
        setProducts(JSON.parse(localData));
      } else {
        const demo: CompatibilityItem[] = [
          { id: "prod-101", name: "شاشة سامسونج A10", category: "قطع غيار", price: 7500, compatibilityList: ["A105", "M10", "A7 2019"], stock: 12 },
          { id: "prod-102", name: "بطارية نوت 8 (530)", category: "بطاريات", price: 4500, compatibilityList: ["N950", "Note 8 Dual", "A320"], stock: 8 },
          { id: "prod-103", name: "لاصق نانو ضد الكسر", category: "لواصق", price: 800, compatibilityList: ["A10", "A11", "A12"], stock: 45 },
          { id: "prod-104", name: "شاشة ردمي نوت 10 برُو", category: "قطع غيار", price: 18500, compatibilityList: ["Redmi Note 10 Pro", "M2101K6G", "Note 10 Pro Max"], stock: 5 }
        ];
        setProducts(demo);
        localStorage.setItem('jam_offline_compatibility_products', JSON.stringify(demo));
      }
    }
  }, [items]);

  // استخراج قائمة مرجعية بأسماء الموديلات الشائعة والموجودة مسبقاً لمنع تكرار الكتابة والتشتت
  const existingModels = useMemo(() => {
    const modelsSet = new Set<string>();
    // موديلات افتراضية شائعة
    const defaults = ["A105", "M10", "A11", "A12", "N950", "A320", "M11", "A115", "iPhone 11", "Redmi Note 10", "iPhone 12 Pro", "Redmi Note 10 Pro", "A21s", "A51"];
    defaults.forEach(d => modelsSet.add(d));

    // إضافة الموديلات المدخلة مسبقاً في مخزن التاجر
    products.forEach(p => {
      if (p.compatibilityList) {
        p.compatibilityList.forEach(m => {
          if (m && m.trim()) modelsSet.add(m.trim());
        });
      }
    });

    return Array.from(modelsSet);
  }, [products]);

  // إرسال رسالة حالة مؤقتة
  const triggerStatus = (type: 'success' | 'err', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // دالة إضافة موديـل متوافق للصنف الحالي
  const handleAddCompatibility = async (modelName: string) => {
    if (!selectedProduct || !modelName.trim()) return;

    const trimmedName = modelName.trim();

    // التحقق من تكرار الموديل
    if (selectedProduct.compatibilityList.includes(trimmedName)) {
      triggerStatus('err', 'هذا الموديل مسجل بالفعل كمتوافق مع هذا الصنف');
      setInputValue('');
      return;
    }

    // تحديث المصفوفة محلياً (الحصانة والأوفلاين)
    const updatedList = [...selectedProduct.compatibilityList, trimmedName];
    const updatedProducts = products.map(p => {
      if (p.id === selectedProduct.id) {
        return { ...p, compatibilityList: updatedList };
      }
      return p;
    });

    setProducts(updatedProducts);
    setSelectedProduct({ ...selectedProduct, compatibilityList: updatedList });

    // حفظ أوفلاين في التخزين المحلي فوراً للحصانة
    localStorage.setItem('jam_offline_compatibility_products', JSON.stringify(updatedProducts));

    // حفظ في داتابيز فايرستور لإبقاء الفريق على اطلاع دائم
    try {
      const docRef = doc(db, 'inventory', selectedProduct.id);
      await updateDoc(docRef, { compatibilityList: updatedList });
      triggerStatus('success', `تم إضافة التوافق للـ "${trimmedName}" بنجاح ومزامنته بالسحابة`);
    } catch (e) {
      // إشعار بالعمل أوفلاين المضمون
      console.log("Firestore offline update - saved locally on device", e);
      triggerStatus('success', `تم حفظ الموديل [${trimmedName}] بجهازك أوفلاين (مضمون الحصانة والتوافق)`);
    }

    if (onUpdateItems) {
      onUpdateItems(updatedProducts);
    }

    setInputValue('');
  };

  // دالة حذف توافق مسجل
  const handleRemoveCompatibility = async (modelToRemove: string) => {
    if (!selectedProduct) return;

    const updatedList = selectedProduct.compatibilityList.filter(m => m !== modelToRemove);
    const updatedProducts = products.map(p => {
      if (p.id === selectedProduct.id) {
        return { ...p, compatibilityList: updatedList };
      }
      return p;
    });

    setProducts(updatedProducts);
    setSelectedProduct({ ...selectedProduct, compatibilityList: updatedList });

    localStorage.setItem('jam_offline_compatibility_products', JSON.stringify(updatedProducts));

    try {
      const docRef = doc(db, 'inventory', selectedProduct.id);
      await updateDoc(docRef, { compatibilityList: updatedList });
      triggerStatus('success', 'تم إزالة التوافق ومزامنته سحابياً');
    } catch (e) {
      triggerStatus('success', 'تم إزالة التوافق محلياً في جهازك بنجاح');
    }

    if (onUpdateItems) {
      onUpdateItems(updatedProducts);
    }
  };

  // تصفية الاقتراحات للأسماء الموجودة مسبقاً لمنع التكرار
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    const lowerInput = inputValue.toLowerCase();
    return existingModels.filter(model => 
      model.toLowerCase().includes(lowerInput) &&
      (!selectedProduct || !selectedProduct.compatibilityList.includes(model))
    ).slice(0, 5); // 5 اقتراحات تكفي لمنع التشويش
  }, [inputValue, existingModels, selectedProduct]);

  // فرز وتصفية المنتجات بناءً على البحث
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return products;

    return products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.compatibilityList.some(comp => comp.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  return (
    <div className="bg-navy-950 text-white rounded-[2rem] border-2 border-[#d4af37]/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden font-sans select-none" id="compatibility-engine">
      
      {/* هيدر المحرك والتنقل */}
      <div className="bg-navy-900/50 p-5 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#d4af37]/20 rounded-xl relative">
            <Cpu size={22} className="text-[#d4af37] animate-pulse" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#d4af37] tracking-wider uppercase flex items-center gap-1.5">
              <span>JAM Compatibility Engine</span>
              <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-black uppercase">OFFLINE IMMUNE</span>
            </h3>
            <p className="text-[10px] text-gray-400 font-bold">محرك فرز الأصناف والبدائل المتقاطعة للقطع والأجهزة المستدامة</p>
          </div>
        </div>

        {/* أزرار التبديل المستقلة بين لوحة التحكم والعرض */}
        <div className="flex bg-navy-950 p-1 rounded-xl border border-white/5">
          <button 
            type="button"
            onClick={() => setActiveTab('merchant')}
            className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${activeTab === 'merchant' ? 'bg-[#d4af37] text-navy-950 shadow-md' : 'text-gray-400 hover:text-white'}`}
          >
            🛠️ لوحة التاجر
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('client')}
            className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${activeTab === 'client' ? 'bg-cyan-500 text-navy-950 shadow-md' : 'text-gray-400 hover:text-white'}`}
          >
            🛒 شاشة البدائل والزبون
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3 text-xs font-bold text-center border-b ${statusMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {statusMessage.text}
        </div>
      )}

      {/* المحتوى الرئيسي */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'merchant' ? (
            <motion.div 
              key="merchant"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-navy-900/40 p-4 rounded-3xl border border-white/5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* اختيار الصنف من المخزن لتعديل بدائله */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-white block">1. اختر الصنف المراد ربطه بالتوافقات:</label>
                    <div className="relative">
                      <select 
                        onChange={(e) => {
                          const prod = products.find(p => p.id === e.target.value);
                          setSelectedProduct(prod || null);
                          setInputValue('');
                        }}
                        value={selectedProduct?.id || ''}
                        className="w-full bg-navy-950/80 border border-white/10 rounded-2xl p-3.5 text-white focus:border-[#d4af37] outline-none font-bold text-xs appearance-none cursor-pointer"
                      >
                        <option value="">-- اضغط لاختيار الصنف من المخزن --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.category}) - {p.price.toLocaleString()} ر.ي
                          </option>
                        ))}
                      </select>
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                        <Layers size={16} />
                      </div>
                    </div>
                  </div>

                  {/* معلومات فنية مدمجة مفيدة */}
                  <div className="p-4 bg-[#d4af37]/5 rounded-2xl border border-[#d4af37]/10 flex items-start gap-3">
                    <Info size={16} className="text-[#d4af37] mt-0.5 flex-shrink-0" />
                    <div className="text-[11px] leading-relaxed text-gray-300">
                      <strong className="text-[#d4af37] block mb-1">💡 نصيحة التوافق الذكي:</strong>
                      ربط المنتجات التبادية (مثل توافق كوشة شاشة A10 مع M10) يغنيك عن تسجيل أصناف وهمية زائدة، ويسرّع عمليات البيع الفوري عند نفاذ المنتج الأصلي.
                    </div>
                  </div>

                </div>

                {/* لوحة تحرير التوافقات للصنف المختار */}
                {selectedProduct ? (
                  <div className="p-5 bg-navy-950 border border-[#d4af37]/20 rounded-2xl space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <Smartphone size={16} className="text-[#d4af37]" />
                        <span className="text-xs text-gray-400">تعديل توافقات الصنف:</span>
                        <strong className="text-sm font-black text-white">{selectedProduct.name}</strong>
                      </div>
                      <span className="text-[10px] uppercase font-mono bg-navy-900 border border-white/10 px-2.5 py-1 rounded-full text-gray-400">
                        ID: {selectedProduct.id}
                      </span>
                    </div>

                    {/* حقل الإدخال الذكي مع قائمة الاقتراحات للأسماء الموجودة مسبقاً */}
                    <div className="relative space-y-2">
                      <label className="text-[11px] font-bold text-gray-400 block">ادخل اسم الموديل أو ابحث عن موديل مستخدم مسبقاً لتفادي الازدواجية:</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder="مثلاً: A105, A30, Redmi 9T, S21..."
                          className="flex-1 bg-navy-900 border border-white/10 rounded-2xl p-3 text-white font-mono text-xs focus:ring-2 focus:ring-[#d4af37] focus:border-transparent outline-none transition-all"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCompatibility(inputValue);
                            }
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => handleAddCompatibility(inputValue)}
                          className="px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs transition-colors flex items-center gap-1.5"
                        >
                          <Plus size={14} />
                          إضافة صنف
                        </button>
                      </div>

                      {/* صندوق الاقتراحات الذكي والمنبثق (Auto-complete Suggestions) لمنع تكرار المسميات */}
                      <AnimatePresence>
                        {filteredSuggestions.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute z-30 left-0 right-0 mt-1 bg-navy-900 border border-[#d4af37]/30 rounded-2xl shadow-2xl max-h-48 overflow-y-auto overflow-x-hidden divide-y divide-white/5"
                          >
                            {filteredSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => handleAddCompatibility(suggestion)}
                                className="w-full p-3 hover:bg-[#d4af37] hover:text-navy-950 font-mono text-xs text-right border-none block transition-all"
                              >
                                <span className="text-[10px] text-gray-400 font-sans block">🔍 موديل مسجل بالنظام سابقاً</span>
                                <strong className="font-black underline">{suggestion}</strong>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* عرض التوافقات الحالية المرتبطة بالمنتج مع إمكانية مراجعتها والحد من تكرارها */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-gray-450 font-bold block">التوافقات الحالية المرتبطة (البدائل المتطابقة):</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.compatibilityList && selectedProduct.compatibilityList.length > 0 ? (
                          selectedProduct.compatibilityList.map((model, idx) => (
                            <div 
                              key={idx} 
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-navy-900 text-[#d4af37] rounded-xl border border-[#d4af37]/30 font-mono text-[11px] group"
                            >
                              <span>{model}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveCompatibility(model)}
                                className="text-gray-500 hover:text-red-500 p-0.5 rounded-full hover:bg-white/5 transition-colors"
                                title="إزالة هذا الموديل"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500 italic block py-2">لا توجد أجهزة متوافقة مرتبطة حتى الآن. أضف موديلك الأول أعلاه.</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl text-gray-500 text-xs">
                    يرجى اختيار صنف من قائمة المخزن في الأعلى لعرض وتحديث موديلاته وأجهزته البديلة.
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="client"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-navy-900/40 p-4 rounded-3xl border border-white/5 space-y-4">
                
                {/* حقل البحث الذكي عن البدائل والتوافق المزدوج للزبون */}
                <div className="relative">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم القطعة أو نوع جهازك البديل (مثلاً: A10, بطارية, شاشة)..."
                    className="w-full bg-navy-950 border-2 border-white/5 rounded-2xl p-4 pr-12 text-white outline-none focus:border-cyan-500 font-bold text-xs"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <Search size={18} />
                  </div>
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white font-bold text-xs"
                    >
                      مسح
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(product => (
                      <div key={product.id} className="p-4 bg-navy-950 rounded-2xl border border-white/5 hover:border-cyan-500/50 transition-all space-y-3 shadow-md">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="px-2 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/30 text-[9px] font-black rounded uppercase tracking-wider block w-fit mb-1.5">
                              {product.category}
                            </span>
                            <span className="font-black text-white text-xs">{product.name}</span>
                          </div>
                          <div className="text-left">
                            <span className="font-mono text-cyan-400 font-black text-xs block">{product.price.toLocaleString()} ر.ي</span>
                            {product.stock !== undefined && (
                              <span className={`text-[10px] font-bold block ${product.stock > 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                {product.stock > 0 ? `متوفر: ${product.stock} قطع` : 'نفذت الكمية'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* لوحة التوافقات والبدائل تعرض تحت المنتج مباشرة لراحة المستهلك بوضوح */}
                        <div className="mt-2 pt-2.5 border-t border-white/5 space-y-1.5">
                          <span className="text-[10px] text-emerald-400 font-black flex items-center gap-1">
                            <Sparkles size={11} className="text-[#d4af37]" />
                            <span>الأجهزة والبدائل المتوافقة (تركيب فوري ومضمون):</span>
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {product.compatibilityList && product.compatibilityList.length > 0 ? (
                              product.compatibilityList.map((model, idx) => (
                                <span 
                                  key={idx} 
                                  className="px-2.5 py-1 bg-navy-900 text-gray-300 hover:text-white rounded-lg text-[10px] font-mono border border-white/10 hover:border-[#d4af37]/30 transition-all cursor-default"
                                >
                                  {model}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-gray-650 italic">لا توجد بدائل بديلة مسجلة، متوافق مع الموديل الأصلي فقط.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500 text-xs italic">
                      🤷‍♂️ لم يتم العثور على قطع تتوافق مع بحـثك. جرب مفرَدات أخرى (مثل: A11 أو بطارية ونوع الجوال).
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 p-4 bg-navy-900/30 rounded-2xl border border-white/5 text-[10px] text-gray-400 leading-relaxed text-right flex items-start gap-2.5">
          <ShieldCheck size={14} className="text-[#d4af37] flex-shrink-0 mt-0.5" />
          <span>
            بروتوكول الحصانة المتقاطعة (PCE): يتم الحفظ الاحتياطي الفوري للتوافقات في جهاز المسوق أو التاجر أوفلاين بالكامل باستخدام المعرفات الفريدة UUID لمنع تزحزح الروابط أو فقدانها عند انقطاع الاتصال بالإنترنت التام.
          </span>
        </div>
      </div>
    </div>
  );
};
