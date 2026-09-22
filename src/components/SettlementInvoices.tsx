import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Scale, 
  Calendar, 
  Calculator, 
  Percent, 
  AlertTriangle,
  FolderMinus,
  Briefcase,
  History,
  Activity
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  runTransaction, 
  serverTimestamp,
  increment,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, FixedAsset, AdjustmentVoucher, InventoryItem } from '../types';

interface SettlementInvoicesProps {
  profile: UserProfile | null;
}

export default function SettlementInvoices({ profile }: SettlementInvoicesProps) {
  const [activeSubTab, setActiveSubTab] = useState<'settlements' | 'assets'>('settlements');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vouchers, setVouchers] = useState<AdjustmentVoucher[]>([]);
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Form States
  const [voucherForm, setVoucherForm] = useState({
    productId: '',
    type: 'INCREMENT' as 'INCREMENT' | 'DECREMENT',
    quantity: '',
    reason: '',
    amount: '' // money adjustment rounding limit
  });

  const [assetForm, setAssetForm] = useState({
    name: '',
    value: '',
    usefulLife: '5',
    purchaseDate: new Date().toISOString().split('T')[0],
    depreciationMethod: 'straight_line' as 'straight_line' | 'declining_balance',
    salvageValue: '0'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.ownerId) return;

    // Load inventory for selection
    const qInv = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    const unsubscribeInv = onSnapshot(qInv, (snap) => {
      const list: InventoryItem[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as any);
      });
      setInventory(list);
    });

    // Load adjustment vouchers
    const qVouchers = query(
      collection(db, 'adjustmentVouchers'),
      where('ownerId', '==', profile.ownerId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeVouchers = onSnapshot(qVouchers, (snap) => {
      const list: AdjustmentVoucher[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as any);
      });
      setVouchers(list);
    }, (err) => console.log('Voucher fetch err:', err));

    // Load Fixed Assets
    const qAssets = query(
      collection(db, 'fixedAssets'),
      where('ownerId', '==', profile.ownerId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeAssets = onSnapshot(qAssets, (snap) => {
      const list: FixedAsset[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as any);
      });
      setAssets(list);
    }, (err) => console.log('Assets fetch err:', err));

    // Load Accounts
    const qAcc = query(collection(db, 'accounts'), where('ownerId', '==', profile.ownerId));
    const unsubscribeAcc = onSnapshot(qAcc, (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setAccounts(list);
    });

    return () => {
      unsubscribeInv();
      unsubscribeVouchers();
      unsubscribeAssets();
      unsubscribeAcc();
    };
  }, [profile]);

  // Asset depreciation details solver
  const computeDepreciation = (asset: FixedAsset) => {
    const cost = asset.value || 0;
    const salvage = asset.salvageValue || 0;
    const life = asset.usefulLife || 5;
    const buyDate = new Date(asset.purchaseDate || new Date());
    const now = new Date();
    
    // Elapsed years
    const diffTime = Math.max(0, now.getTime() - buyDate.getTime());
    const elapsedYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    
    let accumulated = 0;
    let bookValue = cost;
    let rate = 0;

    if (asset.depreciationMethod === 'straight_line') {
      rate = (1 / life) * 100;
      const annualDep = (cost - salvage) / life;
      accumulated = Math.min(cost - salvage, annualDep * elapsedYears);
      bookValue = Math.max(salvage, cost - accumulated);
    } else {
      // Declining Balance method (Double Declining standard rate multiplier 2.0)
      const factor = 2.0;
      rate = (factor / life) * 100;
      const doubleRate = factor / life;
      
      let tempValue = cost;
      let activeElapsed = Math.floor(elapsedYears);
      for (let i = 0; i < activeElapsed; i++) {
        const depAmt = tempValue * doubleRate;
        tempValue -= depAmt;
      }
      // fractional remainder
      const frac = elapsedYears - activeElapsed;
      if (frac > 0) {
        const depAmt = tempValue * doubleRate * frac;
        tempValue -= depAmt;
      }
      bookValue = Math.max(salvage, tempValue);
      accumulated = cost - bookValue;
    }

    return {
      rate: rate.toFixed(1),
      accumulated: Math.round(accumulated),
      bookValue: Math.round(bookValue)
    };
  };

  const handleAddVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherForm.productId || !voucherForm.quantity) {
      alert('الرجاء اختيار صنف وتحديد كمية التسوية');
      return;
    }

    const item = inventory.find(i => i.id === voucherForm.productId);
    if (!item) return;

    setIsSubmitting(true);
    try {
      const qAmount = parseFloat(voucherForm.quantity) || 0;
      const moneyRounding = parseFloat(voucherForm.amount) || 0;

      await runTransaction(db, async (transaction) => {
        const invRef = doc(db, 'inventory', item.id);
        const voucherRef = doc(collection(db, 'adjustmentVouchers'));
        const transRef = doc(collection(db, 'transactions'));

        // Update Stock
        transaction.update(invRef, {
          stock: increment(voucherForm.type === 'INCREMENT' ? qAmount : -qAmount)
        });

        // Record Voucher
        transaction.set(voucherRef, {
          ownerId: profile?.ownerId,
          productId: item.id,
          productName: item.name,
          type: voucherForm.type,
          quantity: qAmount,
          amount: moneyRounding,
          reason: voucherForm.reason || 'تسوية جردية دورية للمطابقة',
          createdAt: serverTimestamp(),
          createdBy: profile?.name || 'المدير العام'
        });

        // Post financial ledger if rounding money is involved
        if (moneyRounding > 0) {
          transaction.set(transRef, {
            ownerId: profile?.ownerId,
            type: voucherForm.type === 'INCREMENT' ? 'income' : 'expense',
            amount: moneyRounding,
            category: 'تسوية فروقات الميزان والتقريب المالي',
            referenceId: voucherRef.id,
            description: `سند تسوية وتقريب جرد مالي رقم #${voucherRef.id.slice(-6)} للصنف ${item.name}`,
            createdAt: serverTimestamp()
          });

          // Update main default cashier account balance if exist
          const mainAcc = accounts.find(a => a.isDefault === true);
          if (mainAcc) {
            transaction.update(doc(db, 'accounts', mainAcc.id), {
              balance: increment(voucherForm.type === 'INCREMENT' ? moneyRounding : -moneyRounding)
            });
          }
        }
      });

      alert('✅ تم ترحيل سند تسوية الفروقات الجردية بنجاح وعكسها في المخازن والقيود المالية!');
      setVoucherForm({
        productId: '',
        type: 'INCREMENT',
        quantity: '',
        reason: '',
        amount: ''
      });
    } catch (err: any) {
      console.error(err);
      alert('❌ فشل حفظ سند التسوية: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.name || !assetForm.value) {
      alert('الرجاء إدخال بيانات الأصل كاملة');
      return;
    }

    setIsSubmitting(true);
    try {
      const originalCost = parseFloat(assetForm.value) || 0;
      const salvageValue = parseFloat(assetForm.salvageValue) || 0;
      const usefulLife = parseInt(assetForm.usefulLife) || 5;

      await runTransaction(db, async (transaction) => {
        const assetRef = doc(collection(db, 'fixedAssets'));
        const transRef = doc(collection(db, 'transactions'));

        // Record Fixed Asset
        transaction.set(assetRef, {
          ownerId: profile?.ownerId,
          name: assetForm.name,
          value: originalCost,
          usefulLife,
          depreciationMethod: assetForm.depreciationMethod,
          salvageValue,
          purchaseDate: assetForm.purchaseDate,
          createdAt: serverTimestamp()
        });

        // Post purchase transaction inside ledger
        transaction.set(transRef, {
          ownerId: profile?.ownerId,
          type: 'expense',
          amount: originalCost,
          category: 'شراء وتملك الأصول الثابتة',
          referenceId: assetRef.id,
          description: `قيد اقتناء أصل ثابت مالي: ${assetForm.name}`,
          createdAt: serverTimestamp()
        });

        // Deduct from Default Account balance
        const mainAcc = accounts.find(a => a.isDefault === true);
        if (mainAcc) {
          transaction.update(doc(db, 'accounts', mainAcc.id), {
            balance: increment(-originalCost)
          });
        }
      });

      alert('✅ تم قيد واقتناء الأصل الثابت وتخصيص مخصص الإهلاك تلقائياً!');
      setAssetForm({
        name: '',
        value: '',
        usefulLife: '5',
        purchaseDate: new Date().toISOString().split('T')[0],
        depreciationMethod: 'straight_line',
        salvageValue: '0'
      });
    } catch (err: any) {
      console.error(err);
      alert('❌ فشل تسجيل الأصل: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Segment Selector tabs */}
      <div className="flex bg-navy-900/60 p-1 rounded-2xl border border-white/5 max-w-md mx-auto text-right">
        <button
          onClick={() => setActiveSubTab('settlements')}
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 border-none outline-none cursor-pointer ${
            activeSubTab === 'settlements' 
              ? 'bg-brand-primary text-navy-950 shadow-lg' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Scale size={16} />
          <span>فواتير تسويات الجرد والفروقات</span>
        </button>
        <button
          onClick={() => setActiveSubTab('assets')}
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 border-none outline-none cursor-pointer ${
            activeSubTab === 'assets' 
              ? 'bg-brand-primary text-navy-950 shadow-lg' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Briefcase size={16} />
          <span>الأصول الثابتة والإهلاك السنوي</span>
        </button>
      </div>

      {activeSubTab === 'settlements' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Creator form */}
          <div className="lg:col-span-1 bg-navy-950/60 p-6 rounded-[2rem] border border-white/10 space-y-4">
            <h4 className="text-sm font-black text-white border-b border-white/5 pb-3 flex items-center gap-2">
              <Scale className="text-brand-primary" />
              <span>إنشاء سند تسوية فوارق جردية</span>
            </h4>
            <form onSubmit={handleAddVoucher} className="space-y-3 text-right">
              <div>
                <label className="block text-[10px] text-gray-400 font-bold mb-1">اختر الصنف المتأثر جردياً:</label>
                <select
                  value={voucherForm.productId}
                  onChange={(e) => setVoucherForm(prev => ({ ...prev, productId: e.target.value }))}
                  className="w-full h-11 px-3 bg-navy-900 border border-white/15 rounded-xl text-xs text-white uppercase font-bold outline-none"
                >
                  <option value="">-- اضغط للاختيار --</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (متوفر حالياً: {item.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">نوع التسوية الجردية:</label>
                  <select
                    value={voucherForm.type}
                    onChange={(e: any) => setVoucherForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full h-11 px-3 bg-navy-900 border border-white/15 rounded-xl text-xs text-white uppercase font-bold outline-none"
                  >
                    <option value="INCREMENT">📈 زيادة جردية (فائض)</option>
                    <option value="DECREMENT">📉 عجز جردين (عجز)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">الكمية المسواة:</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="الكمية"
                    value={voucherForm.quantity}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full h-11 px-3 bg-navy-900 border border-white/15 rounded-xl text-xs text-white font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-bold mb-1">قيمة الموازنة والتقريب المالي (اختياري ر.ي):</label>
                <input
                  type="number"
                  placeholder="مبلغ التسوية المالية بالتسعيرة"
                  value={voucherForm.amount}
                  onChange={(e) => setVoucherForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full h-11 px-3 bg-navy-900 border border-white/15 rounded-xl text-xs text-white font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-bold mb-1">سبب الجرد والتحقق:</label>
                <textarea
                  rows={3}
                  placeholder="اكتب سبب الفارق جردياً..."
                  value={voucherForm.reason}
                  onChange={(e) => setVoucherForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full p-3 bg-navy-900 border border-white/15 rounded-xl text-xs text-white font-bold outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-brand-primary to-amber-500 text-navy-950 font-black rounded-xl text-xs hover:from-white hover:to-gray-100 transition-all cursor-pointer border-none"
              >
                {isSubmitting ? 'جاري قيد القيد الجردي...' : '💾 قيد وترحيل فوارق التسوية جردياً'}
              </button>
            </form>
          </div>

          {/* History log */}
          <div className="lg:col-span-2 bg-navy-950/60 p-6 rounded-[2rem] border border-white/10 space-y-4">
            <h4 className="text-sm font-black text-white border-b border-white/5 pb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="text-brand-primary" />
                <span>سجل فواتير وأرصدة تسوية الجرد</span>
              </span>
              <span className="text-[10px] p-1 px-2.5 bg-white/5 rounded-full font-bold text-gray-400">
                إجمالي السندات: {vouchers.length}
              </span>
            </h4>

            {vouchers.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-xs font-bold bg-navy-900/50 rounded-2xl">
                لا توجد فواتير تسوية جردية سابقة في قاعدة القيود.
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {vouchers.map(voucher => (
                  <div key={voucher.id} className="p-4 bg-navy-900/60 border border-white/5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1 text-right">
                      <div className="flex items-center gap-2">
                        <span className={`p-1 px-1.5 rounded text-[8px] font-black ${
                          voucher.type === 'INCREMENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {voucher.type === 'INCREMENT' ? '📈 فائض زائد' : '📉 عجز جرد'}
                        </span>
                        <h5 className="font-black text-xs text-white">{voucher.productName}</h5>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold leading-relaxed">{voucher.reason}</p>
                      <p className="text-[8px] text-gray-500 font-bold">بواسطة: {voucher.createdBy} | {(voucher.createdAt as any)?.toDate ? (voucher.createdAt as any).toDate().toLocaleDateString('ar-YE') : 'مؤخراً'}</p>
                    </div>

                    <div className="text-left font-mono font-black space-y-1">
                      <p className="text-xs text-white">الكمية المسواة: {voucher.type === 'INCREMENT' ? '+' : '-'}{voucher.quantity}</p>
                      {voucher.amount ? (
                        <p className="text-[10px] text-brand-primary">القيمة: {voucher.amount.toLocaleString()} ر.ي</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Asset Creator Form */}
          <div className="lg:col-span-1 bg-navy-950/60 p-6 rounded-[2rem] border border-white/10 space-y-4">
            <h4 className="text-sm font-black text-white border-b border-white/5 pb-3 flex items-center gap-2">
              <Briefcase className="text-brand-primary" />
              <span>قيد وحيازة أصل ثابت مالي</span>
            </h4>
            <form onSubmit={handleAddAsset} className="space-y-3 text-right">
              <div>
                <label className="block text-[10px] text-gray-400 font-bold mb-1">اسم الأصل الثابت الممتلك:</label>
                <input
                  type="text"
                  placeholder="مثال: سيارات التوزيع، أجهزة الخوادم"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-11 px-3 bg-navy-900 border border-white/15 rounded-xl text-xs text-white font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">القيمة التاريخية (تكلفة الاقتناء):</label>
                  <input
                    type="number"
                    placeholder="ر.ي"
                    value={assetForm.value}
                    onChange={(e) => setAssetForm(prev => ({ ...prev, value: e.target.value }))}
                    className="w-full h-11 px-3 bg-navy-900 border border-white/15 rounded-xl text-xs text-white font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">العمر الإنتاجي (سنوات):</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="العمر بالاعوام"
                    value={assetForm.usefulLife}
                    onChange={(e) => setAssetForm(prev => ({ ...prev, usefulLife: e.target.value }))}
                    className="w-full h-11 px-3 bg-navy-900 border border-white/15 rounded-xl text-xs text-white font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">تاريخ الاقتناء والتسجيل:</label>
                  <input
                    type="date"
                    value={assetForm.purchaseDate}
                    onChange={(e) => setAssetForm(prev => ({ ...prev, purchaseDate: e.target.value }))}
                    className="w-full h-11 px-3 bg-navy-900 border border-white/15 rounded-xl text-[10px] text-white font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">طريقة احتساب الإهلاك:</label>
                  <select
                    value={assetForm.depreciationMethod}
                    onChange={(e: any) => setAssetForm(prev => ({ ...prev, depreciationMethod: e.target.value }))}
                    className="w-full h-11 px-2 bg-navy-900 border border-white/15 rounded-xl text-[10px] text-white font-bold outline-none"
                  >
                    <option value="straight_line">القسط الثابت (SL)</option>
                    <option value="declining_balance">القسط المتناقص (DB)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-bold mb-1">القيمة النفادية المتبقية (الخردة ر.ي):</label>
                <input
                  type="number"
                  placeholder="القيمة المقدرة كخردة بعد فناء الأصل"
                  value={assetForm.salvageValue}
                  onChange={(e) => setAssetForm(prev => ({ ...prev, salvageValue: e.target.value }))}
                  className="w-full h-11 px-3 bg-navy-900 border border-white/15 rounded-xl text-xs text-white font-bold outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-brand-primary to-amber-500 text-navy-950 font-black rounded-xl text-xs hover:from-white hover:to-gray-100 transition-all cursor-pointer border-none"
              >
                {isSubmitting ? 'جاري الحفظ للتوازن المالي...' : '💾 تسجيل وإثبات الأصل الثابت بالفاتورة'}
              </button>
            </form>
          </div>

          {/* List layout and live calculators */}
          <div className="lg:col-span-2 bg-navy-950/60 p-6 rounded-[2rem] border border-white/10 space-y-4">
            <h4 className="text-sm font-black text-white border-b border-white/5 pb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="text-brand-primary" />
                <span>جرود الأصول والتقييم الحسابي الحالي</span>
              </span>
              <span className="text-[10px] p-1 px-2.5 bg-white/5 rounded-full font-bold text-gray-400">
                إجمالي الأصول: {assets.length}
              </span>
            </h4>

            {assets.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-xs font-bold bg-navy-900/50 rounded-2xl">
                لا توجد أصول ثابتة مقيدة وممتلكة حالياً.
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {assets.map(asset => {
                  const dep = computeDepreciation(asset);
                  return (
                    <div key={asset.id} className="p-5 bg-navy-900/60 border border-white/5 rounded-3xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="text-right">
                          <h5 className="font-black text-sm text-white">{asset.name}</h5>
                          <p className="text-[9px] text-gray-400 font-bold">تاريخ الاقتناء: {asset.purchaseDate} | العمر الإنتاجي: {asset.usefulLife} سنوات</p>
                        </div>
                        <span className="text-xs font-black text-brand-primary font-mono">
                          {asset.value?.toLocaleString()} YER
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-3 text-center">
                        <div className="p-2 bg-navy-950/40 rounded-xl border border-white/5">
                          <p className="text-[8px] text-gray-400 font-bold mb-0.5">نسبة الإهلاك السنوي</p>
                          <p className="text-xs font-black text-amber-500 font-mono">{dep.rate}%</p>
                        </div>
                        <div className="p-2 bg-navy-950/40 rounded-xl border border-white/5">
                          <p className="text-[8px] text-gray-400 font-bold mb-0.5">مجمع الإهلاك المتراكم</p>
                          <p className="text-xs font-black text-rose-500 font-mono">{dep.accumulated.toLocaleString()} ر.ي</p>
                        </div>
                        <div className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/10">
                          <p className="text-[8px] text-brand-primary font-bold mb-0.5">القيمة الدفترية الحالية</p>
                          <p className="text-xs font-black text-emerald-400 font-mono">{dep.bookValue.toLocaleString()} ر.ي</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
