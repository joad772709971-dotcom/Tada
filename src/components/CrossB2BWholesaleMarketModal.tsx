import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, ShoppingBag, ShieldCheck, Zap, Store, Tag, Plus, CheckCircle2, AlertCircle, Phone, Check, Clock } from 'lucide-react';
import { CoreRelayEngine, MarketFeedItem } from '../services/CoreRelayEngine';
import { CreditGuard } from '../services/CreditGuard';
import { b2bLinkageEngine, ShopConnectionDoc } from '../services/b2bLinkageEngine';
import { UserProfile } from '../types';

interface CrossB2BWholesaleMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
}

interface EnrichedMarketItem extends MarketFeedItem {
  originalPrice: number;
  calculatedPrice: number;
  customPriceTier: string;
  tierLabel: string;
  discountPercent: number;
  isAvailable: boolean;
  connectionStatus: 'active' | 'expired' | 'not_connected';
}

export default function CrossB2BWholesaleMarketModal({
  isOpen,
  onClose,
  profile
}: CrossB2BWholesaleMarketModalProps) {
  const [feedItems, setFeedItems] = useState<EnrichedMarketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [orderingItem, setOrderingItem] = useState<EnrichedMarketItem | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [securityCode, setSecurityCode] = useState('');
  const [creditNotice, setCreditNotice] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMarketFeed();
    }
  }, [isOpen, selectedCategory]);

  const loadMarketFeed = async () => {
    setLoading(true);
    const rawItems = await CoreRelayEngine.getMarketFeed(selectedCategory);
    const myShopId = profile?.storeId || profile?.ownerId || profile?.uid || '';

    // Enrich items with dynamic Custom Price Override & active Connection check
    const enriched: EnrichedMarketItem[] = await Promise.all(
      rawItems.map(async (item) => {
        let activeTier = 'wholesale';
        let customDiscountPercent = 0;
        let connectionStatus: 'active' | 'expired' | 'not_connected' = 'not_connected';

        if (myShopId && item.storeId) {
          const connRes = await b2bLinkageEngine.isConnectionActive(myShopId, item.storeId);
          if (connRes.connection) {
            connectionStatus = connRes.active ? 'active' : (connRes.connection.status === 'expired' ? 'expired' : 'not_connected');
            activeTier = connRes.connection.customPriceTier || 'wholesale';
            customDiscountPercent = Number(connRes.connection.customDiscountPercent || 0);
          }
        }

        const tierPricing = b2bLinkageEngine.calculateCustomTierPrice(
          item.price,
          activeTier,
          customDiscountPercent
        );

        return {
          ...item,
          originalPrice: item.price,
          calculatedPrice: connectionStatus === 'active' ? tierPricing.finalPrice : item.price,
          customPriceTier: activeTier,
          tierLabel: tierPricing.tierLabel,
          discountPercent: tierPricing.discountPercent,
          isAvailable: Number(item.availableStock || 0) > 0,
          connectionStatus
        };
      })
    );

    setFeedItems(enriched);
    setLoading(false);
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderingItem || !profile) return;

    setIsSubmitting(true);
    setCreditNotice(null);

    const myShopId = profile.storeId || profile.ownerId || profile.uid;

    // 1. Connection Active & Expiry Verification (offline-friendly)
    if (orderingItem.storeId) {
      const connCheck = await b2bLinkageEngine.isConnectionActive(myShopId, orderingItem.storeId);
      if (!connCheck.active) {
        const errorMsg = connCheck.reason || '⛔ الارتباط التجاري مع هذا المورد غير نشط أو منتهي الصلاحية.';
        setCreditNotice(errorMsg);
        alert(errorMsg);
        setIsSubmitting(false);
        return;
      }
    }

    // 2. Strict Inventory Limit Enforcement (reject if requested qty > supplier's actual stock)
    if (orderingItem.availableStock !== undefined && orderQuantity > orderingItem.availableStock) {
      const stockMsg = `⛔ لا يمكن تنفيذ المعاملة: الكمية المطلوبة (${orderQuantity}) تتجاوز الرصيد الفعلي المتوفر لدى المورد!`;
      setCreditNotice(stockMsg);
      alert(stockMsg);
      setIsSubmitting(false);
      return;
    }

    const effectivePrice = orderingItem.calculatedPrice || orderingItem.price;
    const totalAmount = effectivePrice * orderQuantity;

    // 3. Validate Credit Guard Limits
    const creditCheck = await CreditGuard.verifyTransactionCredit({
      accountId: profile.ownerId || profile.uid,
      transactionAmount: totalAmount,
      securityCode
    });

    if (!creditCheck.allowed) {
      setCreditNotice(creditCheck.message);
      setIsSubmitting(false);
      return;
    }

    // 4. Relay Order Silently with dynamic calculated price
    const relayResult = await CoreRelayEngine.relayOrderBetweenStores({
      fromStoreId: profile.storeId || profile.ownerId || profile.uid,
      fromStoreName: profile.shopName || profile.name || 'متجر جديد',
      toStoreId: orderingItem.storeId,
      toStoreName: orderingItem.storeName,
      customerName: profile.name || 'تاجر تجزئة',
      customerPhone: profile.phoneNumber || '',
      items: [{
        productId: orderingItem.id,
        productName: orderingItem.productName,
        quantity: orderQuantity,
        price: effectivePrice
      }],
      totalAmount,
      currency: orderingItem.currency || 'YER'
    });

    setIsSubmitting(false);

    if (relayResult.success) {
      setSuccessMessage(`✅ تم إرسال الطلب بنجاح للتاجر (${orderingItem.storeName})! كود الطلب: ${relayResult.orderId.substring(0, 8)}`);
      setOrderingItem(null);
      setSecurityCode('');
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setCreditNotice('❌ تعذر إرسال الطلب عبر محرك التتابع، يرجى المحاولة مرة أخرى.');
    }
  };

  const filteredItems = feedItems.filter(item => 
    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.storeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 dir-rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span>سوق الجملة المتقاطع خفيف الوزن</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    B2B Fast Relay
                  </span>
                </h2>
                <p className="text-xs text-slate-400">تصفح واطلب المنتجات مباشرة بضغطة زر بدون إثقال الجهاز</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-6 py-3 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Controls Bar */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="بحث عن منتج أو تاجر..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'هواتف', 'إلكترونيات', 'قطع غيار', 'اكسسوارات'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat === 'ALL' ? 'الجميع' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Body / Cards Grid */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3">
                <Zap className="w-8 h-8 text-amber-500 animate-bounce" />
                <p className="text-xs font-bold">جاري تحميل سوق الجملة اللحظي...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-sm font-bold text-slate-400">لا توجد عروض متوفرة حالياً في هذا القسم</p>
                <p className="text-xs mt-1">يتم تحديث العروض المتقاطعة تلقائياً عند نشر التجار لمنتجاتهم</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span className="flex items-center gap-1 font-bold text-amber-400">
                          <Store className="w-3.5 h-3.5" />
                          {item.storeName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px]">
                          {item.category}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">
                        {item.productName}
                      </h3>

                      {/* Dynamic Custom Price Override & Tier Badge */}
                      <div className="mt-3">
                        {item.calculatedPrice < item.originalPrice && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 line-through mb-0.5">
                            <span>{item.originalPrice.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-amber-400 no-underline bg-amber-500/10 px-1 rounded">
                              خصم {item.discountPercent}%
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline justify-between gap-1">
                          <div className="flex items-baseline gap-1 text-emerald-400 font-black text-base">
                            <span>{item.calculatedPrice.toLocaleString()}</span>
                            <span className="text-xs font-normal text-slate-400">{item.currency || 'ريال'}</span>
                          </div>
                          {item.connectionStatus === 'active' && item.discountPercent > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                              {item.tierLabel}
                            </span>
                          )}
                          {item.connectionStatus === 'expired' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              ارتباط منتهي
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Hide Quantities & Display Binary Status Badge */}
                      <div className="mt-3 pt-2 border-t border-slate-900 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>أقل كمية: {item.minQuantity} قطعة</span>
                        {item.isAvailable ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            متوفر
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            غير متوفر
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      disabled={!item.isAvailable || item.connectionStatus === 'expired'}
                      onClick={() => {
                        setOrderingItem(item);
                        setOrderQuantity(item.minQuantity || 1);
                        setCreditNotice(null);
                      }}
                      className={`mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        !item.isAvailable || item.connectionStatus === 'expired'
                          ? 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed'
                          : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 cursor-pointer'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>
                        {item.connectionStatus === 'expired' 
                          ? 'الارتباط منتهي الصلاحية' 
                          : (!item.isAvailable ? 'غير متوفر حالياً' : 'طلب كمية بالجملة')}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Ordering Drawer Modal */}
          {orderingItem && (
            <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 w-full max-w-md space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-white text-sm">تأكيد طلب جملة B2B</h3>
                  <button onClick={() => setOrderingItem(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {creditNotice && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{creditNotice}</span>
                  </div>
                )}

                <div className="text-xs space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">المورد:</span>
                    <span className="text-white font-bold">{orderingItem.storeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">المنتج:</span>
                    <span className="text-amber-300 font-bold">{orderingItem.productName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">سعر القطعة (المخصص):</span>
                    <div className="flex items-center gap-2">
                      {orderingItem.calculatedPrice < orderingItem.originalPrice && (
                        <span className="text-slate-500 line-through text-[11px]">
                          {orderingItem.originalPrice.toLocaleString()}
                        </span>
                      )}
                      <span className="text-emerald-400 font-bold">
                        {orderingItem.calculatedPrice.toLocaleString()} ريال
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">حالة التوفر لدى المورد:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">
                      متوفر في المستودع
                    </span>
                  </div>
                </div>

                <form onSubmit={handleOrderSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">الكمية المطلوبة:</label>
                    <input
                      type="number"
                      min={orderingItem.minQuantity || 1}
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">شفرة أمان الحساب (اختياري للتحقق):</label>
                    <input
                      type="password"
                      placeholder="أدخل الشفرة إن وجدت"
                      value={securityCode}
                      onChange={(e) => setSecurityCode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm"
                    />
                  </div>

                  <div className="text-xs font-bold text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex justify-between">
                    <span>الإجمالي الكلي:</span>
                    <span>{(orderingItem.calculatedPrice * orderQuantity).toLocaleString()} ريال</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 bg-amber-500 text-slate-950 font-black rounded-xl text-xs hover:bg-amber-400 transition-all cursor-pointer"
                    >
                      {isSubmitting ? 'جاري الفحص والترحيل...' : 'تأكيد وترحيل الطلب'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderingItem(null)}
                      className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
