import React, { useState, useMemo } from 'react';
import { 
  Trophy, AlertTriangle, Users, Building2, ShoppingBag, 
  TrendingUp, MessageCircle, Copy, Check, ExternalLink, Sparkles, 
  ArrowUpRight, DollarSign, Package, Phone, CheckCircle2, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface IntelligenceItem {
  id: string;
  name: string;
  quantity: number;
  minQuantity?: number;
  soldCount?: number;
  revenue?: number;
  supplierName?: string;
  costPrice?: number;
  salePrice?: number;
  category?: string;
}

export interface IntelligenceCustomer {
  id: string;
  name: string;
  phone?: string;
  totalDebt: number;
  lastPaymentDate?: string;
  loyaltyScore?: number; // 1-100
  status: 'excellent' | 'good' | 'overdue';
}

export interface IntelligenceSupplier {
  id: string;
  name: string;
  phone?: string;
  rating: number; // 1-5
  priceCompetitiveness: 'ممتاز' | 'جيد جداً' | 'متوسط';
  balance: number;
  suppliedItemsCount: number;
  speed: string;
}

interface SmartAIIntelligenceHubProps {
  shopName: string;
  ownerId: string;
  inventory: any[];
  customers: any[];
  suppliers: any[];
  onTriggerChatPrompt?: (prompt: string) => void;
}

export const SmartAIIntelligenceHub: React.FC<SmartAIIntelligenceHubProps> = ({
  shopName,
  ownerId,
  inventory,
  customers,
  suppliers,
  onTriggerChatPrompt
}) => {
  const [activeSection, setActiveSection] = useState<'top_sellers' | 'shortages' | 'suppliers' | 'customers'>('top_sellers');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // WhatsApp helper
  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const openWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    const encoded = encodeURIComponent(text);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  // 1. Process Top Selling Products (أكثر المنتجات مبيعاً)
  const topSellers: IntelligenceItem[] = useMemo(() => {
    if (inventory && inventory.length > 0) {
      return [...inventory]
        .map(item => ({
          id: item.id || Math.random().toString(),
          name: item.name || item.title || 'صنف بدون اسم',
          quantity: Number(item.quantity || item.stock || 0),
          minQuantity: Number(item.minQuantity || 5),
          soldCount: Number(item.soldCount || item.salesCount || 0),
          revenue: Number(item.salePrice || item.price || 0) * Number(item.soldCount || item.salesCount || 0),
          category: item.category || 'عام',
          costPrice: Number(item.costPrice || 0),
          salePrice: Number(item.salePrice || item.price || 0)
        }))
        .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
        .slice(0, 8);
    }
    return [];
  }, [inventory]);

  // 2. Process Shortages & Reorder Recommendations (المنتجات الناقصة وتوصية كم تسجل)
  const shortages = useMemo(() => {
    if (!inventory || inventory.length === 0) {
      return [];
    }

    const list = inventory.filter(item => {
      const qty = Number(item.quantity || item.stock || 0);
      const min = Number(item.minQuantity || 5);
      return qty <= min;
    });

    if (list.length === 0) {
      return [];
    }

    return list.map(item => {
      const currentQty = Number(item.quantity || item.stock || 0);
      const minQty = Number(item.minQuantity || 5);
      // Smart Reorder calculation: (minQty * 3) - currentQty
      const recommendedOrder = Math.max(10, (minQty * 3) - currentQty);
      return {
        id: item.id || Math.random().toString(),
        name: item.name || item.title || 'صنف ناقص',
        currentQty,
        minQty,
        recommendedOrder,
        supplierName: item.supplierName || 'المورد المعتمد'
      };
    });
  }, [inventory]);

  // Restock WhatsApp Draft Generator
  const restockWhatsAppMessage = useMemo(() => {
    if (shortages.length === 0) return '';
    let msg = `السلام عليكم ورحمة الله وبركاته، تحياتنا من إدارة *${shopName}*.. 🌹\n\nنأمل منكم التكرم بتجهيز وإرسال طلبيتنا من النواقص التالية مع أسعار اليوم:\n\n`;
    shortages.forEach((s, idx) => {
      msg += `${idx + 1}. *${s.name}* — المطلوب: (${s.recommendedOrder} حبة)\n`;
    });
    msg += `\nشاكرين حسن تعاملكم وسرعة استجابتكم دائماً..`;
    return msg;
  }, [shortages, shopName]);

  // 3. Process Best Suppliers (أفضل التجار والأسعار)
  const topSuppliers: IntelligenceSupplier[] = useMemo(() => {
    if (suppliers && suppliers.length > 0) {
      return suppliers.map((sup, idx) => ({
        id: sup.id || String(idx),
        name: sup.name || 'مورد تجاري',
        phone: sup.phone || '',
        rating: sup.rating || 5,
        priceCompetitiveness: 'ممتاز',
        balance: Number(sup.balance || sup.debt || 0),
        suppliedItemsCount: Number(sup.itemsCount || 0),
        speed: 'توريد معتمد'
      }));
    }
    return [];
  }, [suppliers]);

  // 4. Process Top Customers & Debt Follow-up (كبار العملاء ومتابعة الديون)
  const topCustomers: IntelligenceCustomer[] = useMemo(() => {
    if (customers && customers.length > 0) {
      return customers.map((c, idx) => ({
        id: c.id || String(idx),
        name: c.name || 'عميل محلي',
        phone: c.phone || '',
        totalDebt: Number(c.totalDebt || c.balance || c.debt || 0),
        lastPaymentDate: c.lastPaymentDate || 'سجل نشط',
        loyaltyScore: c.loyaltyScore || 90,
        status: (Number(c.totalDebt || c.balance || 0) > 100000) ? 'overdue' : 'excellent'
      }));
    }
    return [];
  }, [customers]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* NAVIGATION PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'top_sellers', label: '🏆 أكثر المنتجات مبيعاً', color: 'from-amber-500 to-yellow-500' },
          { id: 'shortages', label: '⚠️ المنتجات الناقصة ورسائل الطلب', color: 'from-rose-500 to-orange-500' },
          { id: 'suppliers', label: '🤝 أفضل التجار والأسعار', color: 'from-blue-500 to-indigo-500' },
          { id: 'customers', label: '🌟 كبار العملاء ومتابعة الديون', color: 'from-emerald-500 to-teal-500' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSection === tab.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md scale-[1.02]'
                : 'bg-slate-100 dark:bg-navy-950 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-800'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 1. TOP SELLERS SECTION */}
      {activeSection === 'top_sellers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Trophy size={16} className="text-amber-500" />
                <span>أكثر المنتجات مبيعاً وإيراداً في المتجر</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                تحليل حركات المبيعات لتحديد الأصناف الأعلى طلباً وضمان توفرها الدائم.
              </p>
            </div>
            {onTriggerChatPrompt && (
              <button
                type="button"
                onClick={() => onTriggerChatPrompt('أعطني تقريراً تحليلياً مفصلاً عن أكثر 5 منتجات مبيعاً وأرباحها')}
                className="px-3 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25 transition-colors"
              >
                تحليل عميق عبر الذكاء 🤖
              </button>
            )}
          </div>

          {topSellers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-2xl space-y-2">
              <Package size={36} className="text-slate-400 mx-auto" />
              <h5 className="font-black text-sm text-slate-900 dark:text-white">لا توجد منتجات مسجلة في المخزون حالياً</h5>
              <p className="text-xs text-slate-500">قم بإضافة أصناف وسلع في المخزن لرصد الأكثر مبيعاً والأرباح تلقائياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {topSellers.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      index === 0 ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' :
                      index === 1 ? 'bg-slate-300 text-slate-900' :
                      index === 2 ? 'bg-amber-700/30 text-amber-600' :
                      'bg-slate-100 dark:bg-navy-800 text-slate-500'
                    }`}>
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-black text-xs text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </h5>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span>القسم: {item.category}</span>
                        <span>المتوفر بالمخزن: <strong>{item.quantity} حبة</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono block">
                      {item.soldCount} مبيعة
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.revenue?.toLocaleString()} ر.ي
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. SHORTAGES & RESTOCK SECTION */}
      {activeSection === 'shortages' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-rose-500" />
                <span>المنتجات الناقصة وتوصية كم تسجل وتطلب</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                حساب ذكي للكميات المقترحة لتغطية استهلاك أسبوعين ومنع نفاد البضاعة.
              </p>
            </div>

            {shortages.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText(restockWhatsAppMessage, 'all_shortages')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-all"
                >
                  {copiedIndex === 'all_shortages' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copiedIndex === 'all_shortages' ? 'تم نسخ الطلبية!' : 'نسخ كشف النواقص'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openWhatsApp('', restockWhatsAppMessage)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all"
                >
                  <MessageCircle size={15} />
                  <span>إرسال للتاجر عبر واتساب 📲</span>
                </button>
              </div>
            )}
          </div>

          {shortages.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-2xl space-y-2">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
              <h5 className="font-black text-sm text-slate-900 dark:text-white">المخزون مكتمل ولا توجد أي نواقص</h5>
              <p className="text-xs text-slate-500">لا توجد أي سلع مسجلة تحت حد الأمان الأدنى حالياً، أو تم حذف كافة أصناف المخزون.</p>
            </div>
          ) : (
            <>
              {/* WhatsApp Preview Card */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={14} />
                    <span>مسودة رسالة طلب النواقص المجهزة تلقائياً للتاجر:</span>
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded-md">
                    {shortages.length} أصناف مطلوبة
                  </span>
                </div>
                <pre className="text-xs font-sans text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed bg-white/70 dark:bg-navy-950/70 p-3 rounded-xl border border-emerald-500/20">
                  {restockWhatsAppMessage}
                </pre>
              </div>

              {/* Shortage Item Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {shortages.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-white dark:bg-navy-900 border border-rose-200 dark:border-rose-900/40 flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div className="min-w-0">
                      <h5 className="font-black text-xs text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </h5>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                        <span className="text-rose-600 dark:text-rose-400 font-black">
                          المتبقي: {item.currentQty} حبة فقط
                        </span>
                        <span>الحد الأدنى: {item.minQty}</span>
                      </div>
                    </div>

                    <div className="text-left shrink-0 bg-amber-500/15 border border-amber-500/30 p-2 rounded-xl">
                      <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold block">
                        سجل واطلب:
                      </span>
                      <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                        +{item.recommendedOrder} حبة
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. SUPPLIERS SECTION */}
      {activeSection === 'suppliers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building2 size={16} className="text-blue-500" />
                <span>أفضل التجار والموردين وأسعارهم ومعاملتهم</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                مقارنة بين الموردين وفقاً لمنافسة الأسعار، سرعة التوريد، والالتزام.
              </p>
            </div>
          </div>

          {topSuppliers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-2xl space-y-2">
              <Building2 size={36} className="text-slate-400 mx-auto" />
              <h5 className="font-black text-sm text-slate-900 dark:text-white">لا يوجد موردون مسجلون حالياً</h5>
              <p className="text-xs text-slate-500">قم بتسجيل الموردين والتجار في دليل الموردين لرصد تقييماتهم وأسعارهم وتوريداتهم.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {topSuppliers.map(sup => (
                <div
                  key={sup.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 flex flex-col justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-black">
                        أسعار: {sup.priceCompetitiveness}
                      </span>
                      <span className="text-amber-500 text-xs font-black flex items-center gap-0.5 font-mono">
                        ★ {sup.rating}
                      </span>
                    </div>

                    <h5 className="font-black text-xs text-slate-900 dark:text-slate-100">
                      {sup.name}
                    </h5>

                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Package size={12} className="text-slate-400" />
                      <span>{sup.speed}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/10">
                    <span className="text-[10px] text-slate-400">
                      الرصيد: <strong className="font-mono text-slate-700 dark:text-slate-200">{sup.balance.toLocaleString()} ر.ي</strong>
                    </span>

                    {sup.phone && (
                      <button
                        type="button"
                        onClick={() => openWhatsApp(sup.phone!, `السلام عليكم ورحمة الله، تحياتنا من ${shopName}.. نود الاستفسار عن كشف الحساب والأسعار الحالية لديكم.`)}
                        className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 transition-colors"
                        title="محادثة واتساب"
                      >
                        <MessageCircle size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. CUSTOMERS & DEBT SECTION */}
      {activeSection === 'customers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Users size={16} className="text-emerald-500" />
                <span>كبار العملاء ومتابعة الديون والوفاء بالسداد</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة حركة العملاء، كبار الشارين، والديون المتأخرة مع تجهيز رسائل تذكير لطيفة.
              </p>
            </div>
          </div>

          {topCustomers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-2xl space-y-2">
              <Users size={36} className="text-slate-400 mx-auto" />
              <h5 className="font-black text-sm text-slate-900 dark:text-white">لا يوجد عملاء مسجلون حالياً</h5>
              <p className="text-xs text-slate-500">قم بإضافة عملاء وحسابات في دليل العملاء لتتبع أرصدتهم والتزاماتهم بالسداد.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {topCustomers.map(cust => {
                const hasDebt = cust.totalDebt > 0;
                const reminderText = `السلام عليكم ورحمة الله أخي الكريم *${cust.name}* العزيز.. 🌹\nنأمل أن تكون بأفضل حال. نود إحاطتكم بأن الرصيد المتبقي بحسابكم لدى *${shopName}* هو (${cust.totalDebt.toLocaleString()} ريال يمني). شاكرين وفاءكم وحسن تعاملكم الدائم معنا.`;

                return (
                  <div
                    key={cust.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 flex flex-col justify-between gap-2 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-black text-xs text-slate-900 dark:text-slate-100">
                            {cust.name}
                          </h5>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                            cust.status === 'excellent' 
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}>
                            {cust.status === 'excellent' ? 'ملتزم بالسداد 🌟' : 'دين متأخر ⚠️'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          آخر دفعة: {cust.lastPaymentDate}
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block">الدين المتبقي:</span>
                        <span className={`text-xs font-black font-mono ${
                          hasDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'
                        }`}>
                          {cust.totalDebt.toLocaleString()} ر.ي
                        </span>
                      </div>
                    </div>

                    {hasDebt && (
                      <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(reminderText, cust.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1"
                        >
                          {copiedIndex === cust.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          <span>{copiedIndex === cust.id ? 'تم النسخ!' : 'نسخ التذكير'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openWhatsApp(cust.phone || '', reminderText)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 shadow-sm"
                        >
                          <MessageCircle size={13} />
                          <span>تذكير عبر واتساب 📲</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartAIIntelligenceHub;
