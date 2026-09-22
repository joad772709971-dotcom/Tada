import { useState, useEffect, useMemo } from 'react';
import { Smartphone, Wrench, ShoppingBasket, ShoppingCart, Package, Printer, Save, Loader2, QrCode, Wallet, User, Banknote, Sparkles, Wand2, Calculator, Info, Camera } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, updateDoc, Timestamp, getDoc, writeBatch, increment, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, InventoryItem, ShopSettings } from '../types';
import { postSaleToGL } from '../services/accountingService';
import { marketService } from '../services/marketService';
import { printReceipt } from '../services/printService';
import { audioService } from '../services/audioService';
import { BUSINESS_LABELS, BRANDS } from '../constants/labels';
import { convertCurrency } from '../services/currencyService';
import JAMPayModal from './JAMPayModal';
import BarcodeScanner from './BarcodeScanner';

interface QuickFormProps {
  profile: UserProfile | null;
  onSuccess: () => void;
}

// 1. Quick Balance Form
export function QuickBalanceForm({ profile, onSuccess }: QuickFormProps) {
  const [loading, setLoading] = useState(false);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!profile?.ownerId) return;
      const docSnap = await getDoc(doc(db, 'settings', profile.ownerId));
      if (docSnap.exists()) {
        setShopSettings(docSnap.data() as ShopSettings);
      }
    };
    fetchSettings();
  }, [profile]);

  const [formData, setFormData] = useState({
    phone: '',
    amount: '',
    provider: 'Yemen Mobile',
    notes: '',
    deductedFromProgram: '',
    amountReceived: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    setLoading(true);
    try {
      const amount = Number(formData.amount);
      const deducted = Number(formData.deductedFromProgram || amount);
      const received = Number(formData.amountReceived || amount);
      
      // Simplified: Cost is 95% of units for demo
      const cost = amount * 0.95;
      const profit = received - (deducted * 0.95);

      const batch = writeBatch(db);
      
      const balanceTransRef = doc(collection(db, 'balanceTransactions'));
      batch.set(balanceTransRef, {
        ownerId: profile.ownerId,
        type: 'sale',
        amount,
        cost,
        price: received,
        deductedFromProgram: deducted,
        amountReceived: received,
        profit,
        provider: formData.provider,
        phone: formData.phone,
        notes: formData.notes,
        createdAt: serverTimestamp()
      });

      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        ownerId: profile.ownerId,
        type: 'income',
        amount: received,
        category: 'mobile_balance',
        description: `بيع رصيد ${formData.provider} للرقم ${formData.phone} ${formData.notes ? '- ' + formData.notes : ''}`,
        createdAt: serverTimestamp()
      });

      await batch.commit();

      if (shopSettings?.enableAudioUI) audioService.playSuccess();
      onSuccess();
    } catch (error) {
      if (shopSettings?.enableAudioUI) audioService.playError();
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="space-y-0.5">
        <label className="text-[11px] font-black text-navy-950 dark:text-white uppercase tracking-widest px-1">رقم الهاتف</label>
        <input 
          required 
          type="tel" 
          className="w-full p-2 bg-gray-50 dark:bg-navy-800 border-2 border-transparent focus:border-brand-primary rounded-xl outline-none text-center text-xl font-black tracking-widest" 
          placeholder="77xxxxxxx"
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="text-[11px] font-black text-navy-950 dark:text-white uppercase tracking-widest px-1">المبلغ (وحدات)</label>
          <input 
            required 
            type="number" 
            className="w-full p-2 bg-gray-50 dark:bg-navy-800 border-2 border-transparent focus:border-brand-primary rounded-xl outline-none text-center font-black" 
            value={formData.amount}
            onChange={(e) => setFormData({...formData, amount: e.target.value})}
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[11px] font-black text-navy-950 dark:text-white uppercase tracking-widest px-1">الشركة</label>
          <select 
            className="w-full p-2 bg-gray-50 dark:bg-navy-800 border-2 border-transparent focus:border-brand-primary rounded-xl outline-none font-black"
            value={formData.provider}
            onChange={(e) => setFormData({...formData, provider: e.target.value})}
          >
            <option>Yemen Mobile</option>
            <option>Sabafon</option>
            <option>YOU</option>
            <option>Y</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <label className="label-field text-[10px]">المخصوم من البرنامج</label>
          <input 
            type="number" 
            className="input-field py-1.5" 
            placeholder={formData.amount || "0"}
            value={formData.deductedFromProgram}
            onChange={(e) => setFormData({...formData, deductedFromProgram: e.target.value})}
          />
        </div>
        <div className="space-y-0.5">
          <label className="label-field text-[10px]">المبلغ المستلم</label>
          <input 
            type="number" 
            className="input-field py-1.5" 
            placeholder={formData.amount || "0"}
            value={formData.amountReceived}
            onChange={(e) => setFormData({...formData, amountReceived: e.target.value})}
          />
        </div>
      </div>
      <div className="space-y-0.5">
        <label className="label-field text-[10px]">ملاحظات إضافية</label>
        <input 
          className="input-field py-1.5" 
          placeholder="رقم العملية أو ملاحظات..."
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
        />
      </div>
      <button disabled={loading} type="submit" className="btn-primary w-full py-2 text-base flex items-center justify-center gap-2 bg-success">
        {loading ? <Loader2 className="animate-spin" /> : <Smartphone size={18} />}
        تأكيد العملية
      </button>
    </form>
  );
}

// 2. Quick Maintenance Form
export function QuickMaintenanceForm({ profile, onSuccess }: QuickFormProps) {
  const [loading, setLoading] = useState(false);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerDevices, setCustomerDevices] = useState<any[]>([]);
  const [activeDeviceKey, setActiveDeviceKey] = useState<string>('new_device');
  const [recentOrders, setRecentOrders] = useState<MaintenanceOrder[]>([]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!profile?.ownerId) return;
      const docSnap = await getDoc(doc(db, 'settings', profile.ownerId));
      if (docSnap.exists()) {
        setShopSettings(docSnap.data() as ShopSettings);
      }
    };
    fetchSettings();
  }, [profile]);

  useEffect(() => {
    if (!profile?.ownerId) return;
    const unsubCust = onSnapshot(
      query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        setCustomers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => console.warn('QuickForms customer sync:', err)
    );

    const unsubOrders = onSnapshot(
      query(collection(db, 'maintenanceOrders'), where('ownerId', '==', profile.ownerId)),
      (snapshot) => {
        setRecentOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceOrder)));
      },
      (err) => console.warn('QuickForms orders sync:', err)
    );

    return () => {
      unsubCust();
      unsubOrders();
    };
  }, [profile]);

  const businessType = profile?.businessType || 'mobiles';
  const labels = BUSINESS_LABELS[businessType as keyof typeof BUSINESS_LABELS] || BUSINESS_LABELS.mobiles;

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    deviceBrand: '',
    deviceModel: '',
    imei: '',
    lockPattern: '',
    appLockCode: '',
    issue: '',
    cost: '',
    advance: '',
    laborCost: '',
    engineerNotes: ''
  });

  // Extract previous devices for customer
  const updateCustomerDevices = (phone: string, name: string) => {
    const cleanP = (phone || '').replace(/[\s\-\(\)]/g, '').trim();
    const cleanN = (name || '').trim().toLowerCase();
    if (!cleanP && !cleanN) {
      setCustomerDevices([]);
      return;
    }

    const matched = recentOrders.filter(o => {
      const oP = (o.customerPhone || '').replace(/[\s\-\(\)]/g, '').trim();
      const oN = (o.customerName || '').trim().toLowerCase();
      return (cleanP && oP && (oP === cleanP || oP.endsWith(cleanP) || cleanP.endsWith(oP))) ||
             (cleanN && oN && (oN.includes(cleanN) || cleanN.includes(oN)));
    });

    const uniqueMap = new Map<string, any>();
    matched.forEach(o => {
      if (!o.deviceModel) return;
      const key = `${o.deviceBrand || ''}_${o.deviceModel || ''}_${o.deviceSerialNumber || o.imei || ''}`.toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          id: o.id,
          deviceBrand: o.deviceBrand || '',
          deviceModel: o.deviceModel || '',
          imei: o.deviceSerialNumber || o.imei || '',
          lockPattern: o.lockPattern || '',
          appLockCode: (o as any).appLockCode || '',
          issue: o.issue || '',
          cost: o.cost || ''
        });
      }
    });

    setCustomerDevices(Array.from(uniqueMap.values()));
  };

  const handleSelectCustomer = (cust: any) => {
    setFormData(prev => ({
      ...prev,
      customerName: cust.name || prev.customerName,
      customerPhone: cust.phone || prev.customerPhone
    }));
    setShowCustomerDropdown(false);
    setCustomerSearch('');
    updateCustomerDevices(cust.phone, cust.name);
    setActiveDeviceKey('new_device');
  };

  const handleSelectDevice = (dev: any) => {
    setActiveDeviceKey(dev.id);
    setFormData(prev => ({
      ...prev,
      deviceBrand: dev.deviceBrand || prev.deviceBrand,
      deviceModel: dev.deviceModel || prev.deviceModel,
      imei: dev.imei || '',
      lockPattern: dev.lockPattern || '',
      appLockCode: dev.appLockCode || ''
    }));
  };

  const handleNewDeviceSelect = () => {
    setActiveDeviceKey('new_device');
    setFormData(prev => ({
      ...prev,
      deviceBrand: '',
      deviceModel: '',
      imei: '',
      lockPattern: '',
      appLockCode: ''
    }));
  };

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(c => 
        (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || 
        (c.phone || '').includes(customerSearch)
      ).slice(0, 5)
    : [];

  const handleSubmit = async (e: React.FormEvent, shouldPrint = false) => {
    if (e) e.preventDefault();
    if (!profile?.ownerId) return;
    setLoading(true);
    try {
      const data = {
        ownerId: profile.ownerId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        deviceBrand: formData.deviceBrand || 'Other',
        deviceModel: formData.deviceModel,
        imei: formData.imei,
        lockPattern: formData.lockPattern,
        appLockCode: formData.appLockCode,
        orderType: 'hardware',
        issue: formData.issue,
        cost: Number(formData.cost) || 0,
        advancePayment: Number(formData.advance) || 0,
        laborCost: Number(formData.laborCost) || 0,
        status: 'waiting',
        engineerId: profile.uid,
        engineerNotes: formData.engineerNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        sparePartsUsed: []
      };

      const docRef = await addDoc(collection(db, 'maintenanceOrders'), data);

      if (data.advancePayment > 0) {
        await addDoc(collection(db, 'transactions'), {
          ownerId: profile.ownerId,
          type: 'income',
          amount: data.advancePayment,
          category: 'maintenance_advance',
          description: `دفعة مقدمة صيانة: ${data.deviceModel} - ${data.customerName}`,
          createdAt: serverTimestamp()
        });
      }

      if (shouldPrint) {
        if (shopSettings?.enableAudioUI) audioService.playPrint();
        printReceipt('maintenance', { ...data, id: docRef.id }, shopSettings || {});
      } else if (shopSettings?.enableAutoPrint) {
        setTimeout(() => {
          if (shopSettings?.enableAudioUI) audioService.playPrint();
          printReceipt('maintenance', { ...data, id: docRef.id }, shopSettings || {});
        }, 500);
      }

      if (shopSettings?.enableAudioUI) audioService.playSuccess();
      onSuccess();
    } catch (error) {
      if (shopSettings?.enableAudioUI) audioService.playError();
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(e)} className="space-y-2.5 text-right text-xs" dir="rtl">
      {/* Customer Search & Fast Select Row */}
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-1">
          <input
            type="text"
            placeholder="🔍 بحث سريع عن عميل مسجل (بالاسم أو الهاتف)..."
            className="w-full p-2 bg-amber-500/10 dark:bg-navy-900 border border-amber-500/30 rounded-xl text-xs font-bold outline-none placeholder:text-gray-400 focus:border-brand-primary"
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setShowCustomerDropdown(true);
            }}
            onFocus={() => setShowCustomerDropdown(true)}
          />
        </div>

        {showCustomerDropdown && filteredCustomers.length > 0 && (
          <div className="absolute z-30 top-full start-0 end-0 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl shadow-2xl p-1 max-h-40 overflow-y-auto space-y-1">
            {filteredCustomers.map(cust => (
              <button
                key={cust.id}
                type="button"
                onClick={() => handleSelectCustomer(cust)}
                className="w-full text-right p-2 hover:bg-brand-primary/10 rounded-lg flex items-center justify-between transition-colors"
              >
                <div className="font-bold text-navy-900 dark:text-white flex items-center gap-1.5">
                  <User size={13} className="text-brand-primary" />
                  <span>{cust.name}</span>
                </div>
                <span className="text-[11px] font-mono text-gray-500">{cust.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Customer Name & Phone */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-navy-950 dark:text-white uppercase tracking-wider px-1">اسم العميل *</label>
          <input 
            required 
            className="w-full p-2 bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 focus:border-brand-primary rounded-xl outline-none font-bold text-xs" 
            value={formData.customerName} 
            onChange={(e) => {
              const val = e.target.value;
              setFormData({...formData, customerName: val});
              updateCustomerDevices(formData.customerPhone, val);
            }} 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-navy-950 dark:text-white uppercase tracking-wider px-1">رقم الهاتف *</label>
          <input 
            required 
            type="tel"
            className="w-full p-2 bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 focus:border-brand-primary rounded-xl outline-none font-bold text-xs text-center font-mono" 
            value={formData.customerPhone} 
            onChange={(e) => {
              const val = e.target.value;
              setFormData({...formData, customerPhone: val});
              updateCustomerDevices(val, formData.customerName);
            }} 
          />
        </div>
      </div>

      {/* Customer's Previous Devices Strip (if any) */}
      {customerDevices.length > 0 && (
        <div className="p-2 bg-brand-primary/5 dark:bg-brand-primary/10 rounded-xl border border-brand-primary/20 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black text-brand-primary">
            <span>سجل أجهزة العميل السابقة ({customerDevices.length}):</span>
            <span className="text-gray-400 font-normal">اضغط لجلب البيانات</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={handleNewDeviceSelect}
              className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-all ${activeDeviceKey === 'new_device' ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700'}`}
            >
              ✨ جهاز جديد
            </button>
            {customerDevices.map((dev) => (
              <button
                key={dev.id}
                type="button"
                onClick={() => handleSelectDevice(dev)}
                className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-all flex items-center gap-1 ${activeDeviceKey === dev.id ? 'bg-navy-900 dark:bg-navy-700 text-white border-navy-900 shadow-sm' : 'bg-white dark:bg-navy-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-navy-700 hover:border-brand-primary'}`}
              >
                <Smartphone size={11} className="text-brand-primary" />
                <span>{dev.deviceBrand} {dev.deviceModel}</span>
                {dev.imei && <span className="opacity-70 text-[9px]">({dev.imei.slice(-4)})</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Device Brand, Model & IMEI */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-navy-950 dark:text-white uppercase tracking-wider px-1">{labels.deviceBrand}</label>
          {businessType === 'mobiles' ? (
            <select 
              className="w-full p-2 bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 focus:border-brand-primary rounded-xl outline-none font-bold text-xs"
              value={formData.deviceBrand}
              onChange={(e) => setFormData({...formData, deviceBrand: e.target.value})}
            >
              <option value="">اختر الشركة...</option>
              {BRANDS.map(brand => <option key={brand} value={brand}>{brand}</option>)}
              <option value="Other">أخرى</option>
            </select>
          ) : (
            <input className="w-full p-2 bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 focus:border-brand-primary rounded-xl outline-none font-bold text-xs" placeholder={labels.deviceBrand} value={formData.deviceBrand} onChange={(e) => setFormData({...formData, deviceBrand: e.target.value})} />
          )}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-navy-950 dark:text-white uppercase tracking-wider px-1">{labels.deviceModel} *</label>
          <input required className="w-full p-2 bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 focus:border-brand-primary rounded-xl outline-none font-bold text-xs" placeholder="مثلاً: A54, Note 12..." value={formData.deviceModel} onChange={(e) => setFormData({...formData, deviceModel: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-navy-950 dark:text-white uppercase tracking-wider px-1">{labels.imei}</label>
          <input className="w-full p-2 bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 focus:border-brand-primary rounded-xl outline-none font-bold text-xs font-mono" placeholder="S/N أو IMEI" value={formData.imei} onChange={(e) => setFormData({...formData, imei: e.target.value})} />
        </div>
      </div>

      {/* Screen Lock & App Lock Code PIN */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-navy-950 dark:text-white uppercase tracking-wider px-1">رمز قفل الشاشة / النقش</label>
          <input 
            className="w-full p-2 bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 focus:border-brand-primary rounded-xl outline-none font-mono font-bold text-xs text-center" 
            placeholder="مثال: 1234 أو نقش" 
            value={formData.lockPattern} 
            onChange={(e) => setFormData({...formData, lockPattern: e.target.value})} 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider px-1">رمز قفل التطبيقات (App PIN)</label>
          <input 
            className="w-full p-2 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 focus:border-indigo-500 rounded-xl outline-none font-mono font-bold text-xs text-center text-indigo-600 dark:text-indigo-400" 
            placeholder="رمز قفل البرامج (إن وجد)" 
            value={formData.appLockCode} 
            onChange={(e) => setFormData({...formData, appLockCode: e.target.value})} 
          />
        </div>
      </div>

      {/* Issue Description */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-navy-950 dark:text-white uppercase tracking-wider px-1">{labels.issue} *</label>
        <input required className="w-full p-2 bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 focus:border-brand-primary rounded-xl outline-none font-bold text-xs" placeholder="وصف العطل بدقة..." value={formData.issue} onChange={(e) => setFormData({...formData, issue: e.target.value})} />
      </div>

      {/* Financials: Cost, Advance, Labor */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-1">إجمالي التكلفة *</label>
          <input required type="number" className="w-full p-2 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500 rounded-xl outline-none font-black text-sm text-emerald-600 dark:text-emerald-400 text-center" placeholder="0" value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider px-1">العربون (المقدم)</label>
          <input type="number" className="w-full p-2 bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50 focus:border-orange-500 rounded-xl outline-none font-black text-sm text-orange-600 dark:text-orange-400 text-center" placeholder="0" value={formData.advance} onChange={(e) => setFormData({...formData, advance: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-navy-950 dark:text-white uppercase tracking-wider px-1">أجور اليد</label>
          <input type="number" className="w-full p-2 bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 focus:border-brand-primary rounded-xl outline-none font-bold text-xs text-center" placeholder="0" value={formData.laborCost} onChange={(e) => setFormData({...formData, laborCost: e.target.value})} />
        </div>
      </div>

      {/* Engineer Notes */}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider px-1">ملاحظات الفني / حالة الجهاز</label>
        <textarea 
          className="w-full p-2 bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 focus:border-brand-primary rounded-xl outline-none text-xs min-h-[48px] max-h-[70px] resize-none" 
          value={formData.engineerNotes} 
          onChange={(e) => setFormData({...formData, engineerNotes: e.target.value})}
          placeholder="مثلاً: الجهاز به خدوش خفيفة، البطارية سليمة..."
        />
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button 
          type="button" 
          onClick={(e) => handleSubmit(e as any, true)}
          className="py-2.5 bg-navy-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 hover:bg-navy-800 transition-all text-xs"
        >
          <Printer size={15} />
          حفظ وطباعة
        </button>
        <button 
          disabled={loading}
          type="submit" 
          className="py-2.5 bg-success text-white rounded-xl font-bold flex items-center justify-center gap-1.5 hover:bg-success/90 transition-all text-xs shadow-md shadow-success/20"
        >
          {loading ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
          حفظ واستلام
        </button>
      </div>
    </form>
  );
}

// 3. Quick Inventory/Sale Form
export function QuickInventoryForm({ profile, onSuccess, type = 'sale' }: QuickFormProps & { type?: 'sale' | 'purchase' }) {
  const [loading, setLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [isJAMPayOpen, setIsJAMPayOpen] = useState(false);
  const [categoryPrefix, setCategoryPrefix] = useState('');
  const [autoPricing, setAutoPricing] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [vaults, setVaults] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [formData, setFormData] = useState({
    barcode: '',
    quantity: '1',
    price: '',
    itemName: '',
    deviceModel: '',
    discount: '0',
    paymentMethod: 'cash',
    currency: 'YER',
    customerName: '',
    notes: '',
    simNewPurchaseCost: '0',
    simReplacementPurchaseCost: '0',
    simNewRetailPrice: '0',
    simReplacementRetailPrice: '0',
    transferRef: '',
    selectedVaultId: ''
  });
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('jam-quick-categories');
    return saved ? JSON.parse(saved) : ['كشاف', 'شاحن', 'بطارية', 'سماعة', 'كيبل', 'شاشة', 'خازن', 'غلاف', 'لاصق', 'توصيلة', 'مفرد'];
  });

  const addCategory = () => {
    const newCat = prompt('أدخل اسم الصنف الجديد (البادئة):');
    if (newCat && !categories.includes(newCat)) {
      const updated = [...categories, newCat];
      setCategories(updated);
      localStorage.setItem('jam-quick-categories', JSON.stringify(updated));
    }
  };

  // Live query for vaults/safes and inventory to support instant product-name search and custom safe payout
  useEffect(() => {
    if (!profile?.ownerId) return;
    const sId = profile.storeId || profile.ownerId || 'main_store';
    
    // Subscribe to vaults
    const qVaults = query(collection(db, 'stores', sId, 'vaults'));
    const unsubVaults = onSnapshot(qVaults, (snap) => {
      if (!snap.empty) {
        setVaults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else {
        const qRoot = query(collection(db, 'vaults'), where('ownerId', '==', profile.ownerId));
        getDocs(qRoot).then(rSnap => {
          setVaults(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      }
    });

    // Subscribe to inventory for instant name search
    const qInv = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId));
    const unsubInv = onSnapshot(qInv, (snap) => {
      setInventoryItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    });

    return () => {
      unsubVaults();
      unsubInv();
    };
  }, [profile]);

  // Computing auto suggestions
  const matchedSuggestions = useMemo(() => {
    const term = formData.itemName.trim().toLowerCase();
    const modelTerm = formData.deviceModel.trim().toLowerCase();
    if (term.length < 2 && modelTerm.length < 2) return [];
    return inventoryItems.filter(item => {
      const matchName = item.name?.toLowerCase().includes(term);
      const matchModel = item.model?.toLowerCase().includes(modelTerm) || item.name?.toLowerCase().includes(modelTerm);
      return (matchName || matchModel) && item.name !== formData.itemName;
    }).slice(0, 5);
  }, [inventoryItems, formData.itemName, formData.deviceModel]);

  const selectSuggestion = (item: InventoryItem) => {
    setFoundItem(item);
    setFormData(prev => ({ 
      ...prev, 
      barcode: item.barcode || prev.barcode,
      itemName: item.name || '', 
      deviceModel: item.model || '',
      price: (type === 'sale' ? item.price : item.cost).toString() 
    }));
  };

  useEffect(() => {
    const fetchSettings = async () => {
      if (!profile?.ownerId) return;
      const docSnap = await getDoc(doc(db, 'settings', profile.ownerId));
      if (docSnap.exists()) {
        setShopSettings(docSnap.data() as ShopSettings);
      }

      // Fetch customers for the dropdown
      const q = query(collection(db, 'customers'), where('ownerId', '==', profile.ownerId));
      const snap = await getDocs(q);
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchSettings();
  }, [profile]);

  const currentExchangeRate = useMemo(() => {
    if (!shopSettings?.currencyRates) return 1;
    const rateObj = shopSettings.currencyRates[formData.currency];
    if (!rateObj) return 1;
    return type === 'sale' ? (rateObj.buy || 1) : (rateObj.sell || 1);
  }, [shopSettings, formData.currency, type]);

  // Auto-naming disabled to avoid duplicated/overriding item names
  useEffect(() => {
    // Disabled to respect custom name inputs
  }, []);

  const discoverPrice = async (barcodeVal?: string, nameVal?: string) => {
    if (!autoPricing || !profile?.uid) return;
    setDiscoverLoading(true);
    try {
      const data = await marketService.discoverSmartPrice({
        barcode: barcodeVal,
        name: nameVal,
        userRole: profile.role,
        ownerId: profile.ownerId,
        businessType: profile.businessType
      });
      
      if (data) {
        setFormData(prev => ({
          ...prev,
          price: (type === 'sale' ? data.sell : data.buy).toString()
        }));
        if (shopSettings?.enableAudioUI) audioService.playSuccess();
      }
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleBarcodeSearch = async (barcode: string) => {
    setFormData(prev => ({ ...prev, barcode }));
    if (barcode.length >= 3 && profile?.ownerId) {
      const q = query(collection(db, 'inventory'), where('ownerId', '==', profile.ownerId), where('barcode', '==', barcode));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const item = { id: snap.docs[0].id, ...snap.docs[0].data() } as InventoryItem;
        setFoundItem(item);
        setFormData(prev => ({ 
          ...prev, 
          itemName: item.name, 
          deviceModel: item.model || '',
          price: (type === 'sale' ? item.price : item.cost).toString() 
        }));
      } else {
        setFoundItem(null);
        discoverPrice(barcode);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.ownerId) return;
    setLoading(true);
    try {
      const qty = Number(formData.quantity) || 0;
      let price = Number(formData.price) || 0;
      const discount = Number(formData.discount) || 0;

      const isSimCategory = categoryPrefix === 'sim_cards' || categoryPrefix.includes('شريحة') || categoryPrefix.includes('شرايح') || categoryPrefix.includes('شريحه') || categoryPrefix.includes('شرائح') || categoryPrefix.toLowerCase().includes('sim');
      const isBalanceCategory = categoryPrefix === 'mobile_balance' || categoryPrefix.includes('رصيد') || categoryPrefix.includes('رصيده') || categoryPrefix.toLowerCase().includes('balance') || categoryPrefix.toLowerCase().includes('credit');

      const simNewPurchaseCost = Number(formData.simNewPurchaseCost) || 0;
      const simReplacementPurchaseCost = Number(formData.simReplacementPurchaseCost) || 0;
      const simNewRetailPrice = Number(formData.simNewRetailPrice) || 0;
      const simReplacementRetailPrice = Number(formData.simReplacementRetailPrice) || 0;

      if (isSimCategory) {
        if (type === 'purchase') {
          price = simNewPurchaseCost;
        } else {
          price = simNewRetailPrice;
        }
      }

      if (isBalanceCategory && type === 'purchase') {
        // Retail price is hidden/removed, price represents just the cost
      }

      const total = (price * qty) - discount;
      
      const batch = writeBatch(db);
      const totalCost = (foundItem?.cost || price) * qty;

      if (type === 'sale') {
        const profit = foundItem ? (price - foundItem.cost) * qty - discount : 0;
        const saleRef = doc(collection(db, 'sales'));
        
        batch.set(saleRef, {
          ownerId: profile.ownerId,
          items: [{
            id: foundItem?.id || 'manual',
            name: formData.itemName || 'صنف يدوي',
            model: formData.deviceModel,
            quantity: qty,
            price: price,
            cost: foundItem?.cost || price,
            discount: discount
          }],
          total: total,
          profit: profit,
          paymentMethod: formData.paymentMethod,
          currency: formData.currency,
          customerName: formData.customerName,
          notes: formData.notes,
          sellerId: profile.uid,
          sellerName: profile.name,
          createdAt: serverTimestamp()
        });

        if (foundItem) {
          batch.update(doc(db, 'inventory', foundItem.id), {
            stock: increment(-qty)
          });
        }

        const transRef = doc(collection(db, 'transactions'));
        batch.set(transRef, {
          ownerId: profile.ownerId,
          type: 'income',
          amount: total,
          category: 'sale',
          description: `بيع سريع: ${formData.itemName} ${formData.notes ? '- ' + formData.notes : ''}`,
          createdAt: serverTimestamp()
        });

        await batch.commit();

        postSaleToGL(profile.ownerId, {
          id: saleRef.id,
          total: total,
          cost: totalCost,
          paymentMethod: formData.paymentMethod as any,
          currency: formData.currency as any,
          exchangeRate: currentExchangeRate,
          description: `بيع سريع فاتورة ${saleRef.id.slice(-6)} للعميل ${formData.customerName}`
        });

      } else {
        // Purchase logic
        if (foundItem) {
          const newCost = isSimCategory ? simNewPurchaseCost : price;
          let newPrice = foundItem.price;

          // If manual price was adjusted and differs from foundPrice, respect it unless autoPricing is forced
          const inputPrice = Number(formData.price) || 0;
          
          if (isSimCategory) {
            newPrice = simNewRetailPrice;
          } else if (isBalanceCategory) {
            newPrice = 0; // completely remove retail price from calculations
          } else if (shopSettings?.autoPricingEnabled) {
            const margin = shopSettings.autoPricingProfitMargin || 15;
            newPrice = Math.round(newCost * (1 + margin / 100));
          } else if (inputPrice > 0) {
            // Respect the price entered in the form if auto-pricing is off
            newPrice = inputPrice;
          }

          batch.update(doc(db, 'inventory', foundItem.id), {
            stock: increment(qty),
            cost: newCost,
            price: newPrice,
            simNewPurchaseCost: isSimCategory ? simNewPurchaseCost : (foundItem.simNewPurchaseCost || 0),
            simReplacementPurchaseCost: isSimCategory ? simReplacementPurchaseCost : (foundItem.simReplacementPurchaseCost || 0),
            simNewRetailPrice: isSimCategory ? simNewRetailPrice : (foundItem.simNewRetailPrice || 0),
            simReplacementRetailPrice: isSimCategory ? simReplacementRetailPrice : (foundItem.simReplacementRetailPrice || 0),
            updatedAt: serverTimestamp()
          });
        } else {
          const itemRef = doc(collection(db, 'inventory'));
          const newCost = isSimCategory ? simNewPurchaseCost : price;
          let newPrice = isSimCategory ? simNewRetailPrice : (price * 1.2);

          const inputPrice = Number(formData.price) || 0;

          if (isSimCategory) {
            newPrice = simNewRetailPrice;
          } else if (isBalanceCategory) {
            newPrice = 0; // completely remove retail price from calculations
          } else if (shopSettings?.autoPricingEnabled) {
            const margin = shopSettings.autoPricingProfitMargin || 15;
            newPrice = Math.round(newCost * (1 + margin / 100));
          } else if (inputPrice > 0) {
            newPrice = inputPrice;
          }

          batch.set(itemRef, {
            ownerId: profile.ownerId,
            name: formData.itemName,
            model: formData.deviceModel,
            barcode: formData.barcode,
            stock: qty,
            minStock: 5,
            price: newPrice,
            cost: newCost,
            category: categoryPrefix || 'المحل',
            type: 'item',
            simNewPurchaseCost: isSimCategory ? simNewPurchaseCost : 0,
            simReplacementPurchaseCost: isSimCategory ? simReplacementPurchaseCost : 0,
            simNewRetailPrice: isSimCategory ? simNewRetailPrice : 0,
            simReplacementRetailPrice: isSimCategory ? simReplacementRetailPrice : 0,
            createdAt: serverTimestamp()
          });
        }

        const transRef = doc(collection(db, 'transactions'));
        batch.set(transRef, {
          ownerId: profile.ownerId,
          type: 'expense',
          amount: price * qty,
          category: 'inventory_purchase',
          description: `شراء سريع: ${formData.itemName}`,
          createdAt: serverTimestamp()
        });

        await batch.commit();
      }

      if (shopSettings?.enableAudioUI) audioService.playSuccess();
      if (shopSettings?.enableAutoPrint) {
        setTimeout(() => {
          if (shopSettings?.enableAudioUI) audioService.playPrint();
          // @ts-ignore
          printReceipt(type === 'sale' ? 'sale' : 'purchase', { id: 'quick', ...formData, total }, shopSettings || {});
        }, 500);
      }
      onSuccess();
    } catch (error) {
      if (shopSettings?.enableAudioUI) audioService.playError();
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = (Number(formData.price) * Number(formData.quantity)) - Number(formData.discount);

  return (
    <div className="flex flex-col gap-4 max-h-[85vh] overflow-y-auto custom-scrollbar p-1">
      {/* Header Info */}
      <div className="flex items-center justify-between p-4 bg-navy-900 text-white rounded-2xl shadow-xl border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 bg-brand-primary/20 rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/10 border border-brand-primary/30">
            <ShoppingCart className="text-brand-primary" size={24} />
          </div>
          <div>
            <h4 className="font-black text-xl tracking-tight leading-none mb-1">{type === 'sale' ? 'فاتورة مبيع سريعة' : 'فاتورة شراء سريعة'}</h4>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-brand-primary text-white px-2 py-0.5 rounded-full font-black">نظام JAM</span>
              <span className="text-[10px] text-gray-400 font-bold">{new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
        <div className="text-left bg-white/5 p-2 rounded-xl border border-white/5 relative z-10">
          <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5 text-center">العملة</p>
          <select 
            className="bg-transparent text-brand-primary font-black text-lg outline-none cursor-pointer text-center px-2"
            value={formData.currency}
            onChange={(e) => setFormData({...formData, currency: e.target.value})}
          >
            <option value="YER">YER</option>
            <option value="USD">USD</option>
            <option value="SAR">SAR</option>
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Item Selection Area */}
        <div className="p-3 bg-[#f7f4ec] dark:bg-navy-900 rounded-2xl border-2 border-[#d3ccbc] dark:border-white/5 shadow-md space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-navy-900/60 dark:text-white/60 uppercase tracking-widest flex items-center justify-between gap-px px-1">
                <span className="flex items-center gap-2">
                  <QrCode size={12} className="text-brand-primary" />
                  البحث بالباركود
                </span>
                {discoverLoading && <Loader2 size={10} className="animate-spin text-brand-primary" />}
              </label>
              <div className="relative group flex items-center">
                <input 
                  autoFocus
                  className="w-full p-2 bg-gray-50 dark:bg-navy-800/50 border-2 border-transparent focus:border-brand-primary/50 dark:border-white/5 rounded-xl outline-none focus:ring-4 focus:ring-brand-primary/10 text-center font-mono text-base transition-all group-hover:bg-gray-100 dark:group-hover:bg-navy-800" 
                  placeholder="000"
                  value={formData.barcode} 
                  onChange={(e) => handleBarcodeSearch(e.target.value)} 
                />
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 px-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg transition-all text-[10px] font-black flex items-center gap-1 shadow active:scale-95"
                >
                  <Camera size={12} /> الكاميرا
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-navy-900/60 dark:text-white/60 uppercase tracking-widest flex items-center justify-between px-1">
                <span className="flex items-center gap-2">
                  <ShoppingBasket size={12} className="text-brand-primary" />
                  اسم المنتج أو الصنف الفعلي
                </span>
              </label>
              <div className="relative">
                <input 
                  required 
                  className="w-full p-2.5 bg-navy-50/50 dark:bg-navy-800/30 border border-brand-primary/30 focus:border-brand-primary rounded-xl outline-none focus:ring-4 focus:ring-brand-primary/5 font-black text-sm text-navy-900 dark:text-white" 
                  value={formData.itemName} 
                  onChange={(e) => setFormData({...formData, itemName: e.target.value})} 
                  placeholder="ابحث أو ادخل اسم المنتج..."
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50">
                   <Sparkles size={14} className="text-brand-primary" />
                   <span className="text-[8px] font-black">AI PRO</span>
                </div>
              </div>

              {/* Instant Search Suggestions Box */}
              {matchedSuggestions.length > 0 && (
                <div className="mt-2 bg-white dark:bg-navy-850 border-2 border-brand-primary/30 rounded-2xl p-2.5 shadow-2xl space-y-1 z-30 max-h-52 overflow-y-auto">
                  <p className="text-[9px] font-black text-brand-primary uppercase tracking-wider block mb-1">🔍 تم العثور على المنتجات المطابقة التالية:</p>
                  {matchedSuggestions.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectSuggestion(item)}
                      className="w-full flex items-center justify-between text-right p-3 rounded-xl hover:bg-brand-primary hover:text-white bg-gray-50 dark:bg-navy-800/60 transition-all text-xs font-black text-navy-900 dark:text-white"
                    >
                      <div className="flex flex-col text-right">
                        <span>{item.name}</span>
                        <span className="text-[10px] text-gray-400 font-bold">الموديل: {item.model || 'غير محدد'}</span>
                      </div>
                      <div className="text-left font-mono flex items-center gap-2">
                        <span className="text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded text-[10px]">المخزون: {item.stock}</span>
                        <span className="font-bold">{type === 'sale' ? item.price : item.cost} {formData.currency}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quantity & Pricing responsive container (Flex Stack on Mobile, Row on Larger Screens - No Overlap) */}
          <div className="flex flex-col sm:flex-row gap-5 pt-2 border-t border-gray-200/50 dark:border-white/5">
            <div className="flex-1 w-full space-y-1">
              <label className="text-[10px] font-black text-navy-900/60 dark:text-white/60 uppercase tracking-widest px-1">الكمية المطلوبة</label>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-navy-800/50 p-1.5 rounded-xl border border-gray-100 dark:border-white/5 shadow-inner">
                <button 
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, quantity: Math.max(1, Number(prev.quantity) - 1).toString() }))}
                  className="w-10 h-10 bg-white dark:bg-navy-700 rounded-lg flex items-center justify-center hover:bg-brand-primary hover:text-white transition-all shadow-md active:scale-95 text-lg font-black border border-gray-100 dark:border-white/10"
                >
                  -
                </button>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  className="flex-1 bg-transparent text-center font-black text-lg outline-none tabular-nums text-navy-900 dark:text-white" 
                  value={formData.quantity} 
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})} 
                />
                <button 
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, quantity: (Number(prev.quantity) + 1).toString() }))}
                  className="w-10 h-10 bg-white dark:bg-navy-700 rounded-lg flex items-center justify-center hover:bg-brand-primary hover:text-white transition-all shadow-md active:scale-95 text-lg font-black border border-gray-100 dark:border-white/10"
                >
                  +
                </button>
              </div>
            </div>
            {(() => {
              const isSimCategory = categoryPrefix === 'sim_cards' || categoryPrefix.includes('شريحة') || categoryPrefix.includes('شرايح') || categoryPrefix.includes('شريحه') || categoryPrefix.includes('شرائح') || categoryPrefix.toLowerCase().includes('sim');
              const isBalanceCategory = categoryPrefix === 'mobile_balance' || categoryPrefix.includes('رصيد') || categoryPrefix.includes('رصيده') || categoryPrefix.toLowerCase().includes('balance') || categoryPrefix.toLowerCase().includes('credit');

              if (isSimCategory) {
                return (
                  <div className="flex-1 w-full space-y-4 col-span-1 border border-brand-primary/10 dark:border-white/5 rounded-3xl p-4 bg-gray-50/50 dark:bg-navy-800/20 text-right">
                    <span className="text-xs font-black text-brand-primary block mb-2 border-b border-black/5 dark:border-white/5 pb-1">🎴 أسعار وتكاليف فئات الشريحة</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">سعر الشراء جديد</label>
                        <input 
                          required 
                          type="number" 
                          step="0.01" 
                          className="w-full p-2.5 bg-white dark:bg-navy-900 border border-emerald-500/20 rounded-xl outline-none font-bold text-lg text-emerald-600 dark:text-emerald-400 text-center" 
                          placeholder="0"
                          value={formData.simNewPurchaseCost} 
                          onChange={(e) => setFormData({...formData, simNewPurchaseCost: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-amber-600 dark:text-amber-400">سعر البيع جديد</label>
                        <input 
                          required 
                          type="number" 
                          step="0.01" 
                          className="w-full p-2.5 bg-white dark:bg-navy-900 border border-amber-500/20 rounded-xl outline-none font-bold text-lg text-amber-600 dark:text-amber-400 text-center" 
                          placeholder="0"
                          value={formData.simNewRetailPrice} 
                          onChange={(e) => setFormData({...formData, simNewRetailPrice: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-rose-600 dark:text-rose-400">سعر الشراء بدل فاقد</label>
                        <input 
                          required 
                          type="number" 
                          step="0.01" 
                          className="w-full p-2.5 bg-white dark:bg-navy-900 border border-rose-500/20 rounded-xl outline-none font-bold text-lg text-rose-600 dark:text-rose-400 text-center" 
                          placeholder="0"
                          value={formData.simReplacementPurchaseCost} 
                          onChange={(e) => setFormData({...formData, simReplacementPurchaseCost: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-yellow-600 dark:text-yellow-400">سعر البيع بدل فاقد</label>
                        <input 
                          required 
                          type="number" 
                          step="0.01" 
                          className="w-full p-2.5 bg-white dark:bg-navy-900 border border-yellow-500/20 rounded-xl outline-none font-bold text-lg text-yellow-600 dark:text-yellow-400 text-center" 
                          placeholder="0"
                          value={formData.simReplacementRetailPrice} 
                          onChange={(e) => setFormData({...formData, simReplacementRetailPrice: e.target.value})} 
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex-1 w-full space-y-1">
                  <label className="text-[10px] font-black text-navy-900/60 dark:text-white/60 uppercase tracking-widest px-1">
                    {type === 'sale' ? 'سعر البيع النهائي' : 'سعر الشراء الفعلي'}
                  </label>
                  <div className="relative">
                    <input 
                      required 
                      type="number" 
                      step="0.01" 
                      className="w-full p-2.5 bg-gray-50 dark:bg-navy-800/50 border border-gray-100 dark:border-white/5 rounded-xl outline-none focus:ring-4 focus:ring-brand-primary/10 text-center font-black text-xl text-brand-primary tabular-nums" 
                      value={formData.price} 
                      onChange={(e) => setFormData({...formData, price: e.target.value})} 
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 bg-white dark:bg-navy-900 px-2 py-1 rounded border border-gray-100 dark:border-white/10 shadow-sm">{formData.currency}</span>
                  </div>
                  {isBalanceCategory && type === 'purchase' && (
                    <p className="text-[10px] font-black text-amber-600 mt-1.5 text-center leading-relaxed">
                      💡 تم تعطيل وإخفاء سعر البيع (رأس مال رصيد جملة - الأرباح تُحسب آلياً)
                    </p>
                  )}
                  {/* Currency quick override selection group to ensure high visibility */}
                  <div className="flex justify-center gap-1.5 mt-2">
                    {['YER', 'SAR', 'USD'].map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, currency: curr }))}
                        className={`px-3 py-1.5 rounded-xl font-black text-[10px] border transition-all ${formData.currency === curr ? 'bg-brand-primary text-white border-brand-primary shadow-md scale-105' : 'bg-white dark:bg-navy-800 text-gray-500 border-gray-200 dark:border-white/10 hover:bg-gray-50'}`}
                      >
                        {curr === 'YER' ? 'ر.ي YER' : curr === 'SAR' ? 'ر.س SAR' : 'دولار USD'}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Payment & Customer Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-3">
            <div className="p-4 bg-[#f7f4ec] dark:bg-navy-900 rounded-3xl border-2 border-[#d3ccbc] dark:border-white/5 shadow-lg space-y-3">
              <label className="text-[11px] font-black text-navy-900/60 dark:text-white/60 uppercase tracking-widest flex items-center gap-2">
                <Wallet size={14} className="text-brand-primary" />
                طريقة السداد
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'cash', label: 'نقدي', icon: '💵' },
                  { id: 'transfer', label: 'حوالة', icon: '💳' },
                  { id: 'debt', label: 'دين', icon: '👤' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setFormData({...formData, paymentMethod: m.id})}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border-2 font-black text-xs transition-all ${formData.paymentMethod === m.id ? 'bg-navy-900 text-brand-primary border-brand-primary shadow-xl scale-105' : 'bg-gray-50 dark:bg-navy-800/50 border-transparent text-gray-400 hover:border-brand-primary/30'}`}
                  >
                    <span className="text-xl">{m.icon}</span>
                    {m.label}
                  </button>
                ))}

                {/* JAM Pay Premium Button */}
                <button
                  type="button"
                  onClick={() => setIsJAMPayOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl border border-amber-500/60 hover:border-amber-400 text-amber-400 bg-gradient-to-r from-amber-500/10 to-yellow-600/5 transition-all text-xs cursor-pointer relative shadow-[0_0_8px_rgba(245,158,11,0.1)] active:scale-95 duration-200"
                  id="quick-jampay-btn"
                >
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-lg leading-none">📱</span>
                  <span className="flex flex-col items-center leading-none text-center">
                    <span className="font-bold text-[10px]">JAM Pay</span>
                    <span className="text-[7px] text-amber-400/70 font-medium">جام بي</span>
                  </span>
                </button>
              </div>

              {/* Conditional Vault/Account selection & Transfer Ref input (User request aligned) */}
              {(formData.paymentMethod === 'cash' || formData.paymentMethod === 'transfer') && (
                <div className="space-y-3 pt-3 border-t border-gray-200/50 dark:border-white/5">
                  {formData.paymentMethod === 'transfer' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-navy-900/60 dark:text-gray-400 uppercase tracking-widest block">
                        رقم الحوالة المستلمة (المرجع المالي)
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full p-2.5 bg-white dark:bg-navy-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-bold text-sm text-center text-brand-primary focus:border-brand-primary"
                        placeholder="أدخل رقم الحوالة هنا..."
                        value={formData.transferRef}
                        onChange={(e) => setFormData({...formData, transferRef: e.target.value})}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-navy-900/60 dark:text-gray-400 uppercase tracking-widest block">
                      صندوق أو حساب الدفع المستهدف
                    </label>
                    <select
                      className="w-full p-2.5 bg-white dark:bg-navy-800 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-black text-xs text-navy-900 dark:text-white"
                      value={formData.selectedVaultId}
                      onChange={(e) => setFormData({...formData, selectedVaultId: e.target.value})}
                    >
                      <option value="">
                        {formData.paymentMethod === 'transfer' ? '🏦 حساب البنك الافتراضي الرئيسي' : '💵 صندوق البيع التلقائي للفرع'}
                      </option>
                      {vaults.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.type === 'bank' ? '🏦' : '💵'} {v.name || 'حساب/صندوق'} ({Number(v.balance || 0).toLocaleString()} {v.currency || 'YER'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#f7f4ec] dark:bg-navy-900 rounded-3xl border-2 border-[#d3ccbc] dark:border-white/5 shadow-lg space-y-1">
              <label className="text-[11px] font-black text-navy-900/60 dark:text-white/60 uppercase tracking-widest flex items-center gap-2">
                <User size={14} className="text-brand-primary" />
                العميل
              </label>
              <select 
                className="w-full p-3 bg-gray-50 dark:bg-navy-800/50 border border-gray-100 dark:border-white/5 rounded-2xl outline-none text-base font-black shadow-inner"
                value={formData.customerName}
                onChange={(e) => setFormData({...formData, customerName: e.target.value})}
              >
                <option value="">عميل نقدي</option>
                {customers.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#f7f4ec] dark:bg-navy-900 rounded-2xl border-2 border-[#d3ccbc] dark:border-white/5 shadow-md space-y-1">
              <label className="text-[10px] font-black text-navy-900/60 dark:text-white/60 uppercase tracking-widest flex items-center gap-2">
                <Banknote size={12} className="text-danger" />
                الخصم (ر.ي)
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  className="w-full p-2 bg-gray-50 dark:bg-navy-800/50 border border-gray-100 dark:border-white/5 rounded-xl outline-none font-black text-danger text-lg text-center shadow-inner" 
                  placeholder="0"
                  value={formData.discount}
                  onChange={(e) => setFormData({...formData, discount: e.target.value})}
                />
              </div>
            </div>
            <div className="p-3 bg-[#f7f4ec] dark:bg-navy-900 rounded-2xl border-2 border-[#d3ccbc] dark:border-white/5 shadow-md space-y-1">
              <label className="text-[10px] font-black text-navy-900/60 dark:text-white/60 uppercase tracking-widest">الملاحظات</label>
              <textarea 
                className="w-full p-2 bg-gray-50 dark:bg-navy-800/50 border border-gray-100 dark:border-white/5 rounded-xl outline-none text-xs font-bold min-h-[50px] shadow-inner resize-none" 
                placeholder="اكتب ملاحظاتك..."
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Summary & Action */}
        <div className="p-5 bg-navy-900 rounded-[2rem] text-white space-y-4 shadow-2xl relative overflow-hidden border border-white/5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-3xl -mr-32 -mt-32 pointer-events-none" />
          
          <div className="relative flex justify-between items-center border-b border-white/10 pb-4">
            <div className="space-y-0.5">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">الإجمالي النهائي</p>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-black text-brand-primary tracking-tighter tabular-nums">{(Number(totalAmount) || 0).toLocaleString()}</p>
                <p className="text-xl font-black text-brand-primary/60">ر.ي</p>
              </div>
            </div>
            <div className="text-left">
              {formData.currency !== 'YER' && (
                <div className="bg-white/5 p-3 rounded-2xl border border-white/10 shadow-inner backdrop-blur-md">
                  <p className="text-3xl font-black text-white tabular-nums">{(totalAmount / currentExchangeRate).toFixed(2)} <span className="text-sm text-brand-primary">{formData.currency}</span></p>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            <button 
              disabled={loading || !formData.itemName} 
              type="submit" 
              className={`relative w-full py-4 rounded-xl font-black text-2xl flex items-center justify-center gap-4 transition-all shadow-2xl active:scale-[0.98] ${type === 'sale' ? 'bg-success hover:bg-success/90 shadow-success/30' : 'bg-danger hover:bg-danger/90 shadow-danger/30'}`}
            >
              {loading ? <Loader2 className="animate-spin" size={28} /> : (type === 'sale' ? <ShoppingCart size={28} /> : <Package size={28} />)}
              {type === 'sale' ? 'حفظ الفاتورة الآن' : 'حفظ الشراء الآن'}
            </button>
            
            <div className="flex items-center justify-between px-2 opacity-50">
              <p className="text-[9px] font-black text-gray-400">نظام JAM Pro | {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-[9px] font-black text-gray-400">جميع الحقوق محفوظة © {new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      </form>
      <JAMPayModal isOpen={isJAMPayOpen} onClose={() => setIsJAMPayOpen(false)} />
      
      {showCamera && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center z-[9999] p-4 text-right">
          <div className="bg-navy-900 border-2 border-brand-primary/20 p-6 rounded-[2.5rem] max-w-md w-full space-y-4 shadow-2xl relative">
            <h4 className="text-white font-black text-xl text-center">📷 قارئ الباركود الذكي بالكاميرا</h4>
            <p className="text-gray-400 text-xs text-center">وجه كاميرا الهاتف نحو باركود السلعة ليتم قراءتها آلياً ومزامنتها فوراً مع الفاتورة السريعة</p>
            
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black max-h-[300px]">
              <BarcodeScanner 
                onScan={(code) => {
                  handleBarcodeSearch(code);
                  setShowCamera(false);
                }} 
                onClose={() => setShowCamera(false)}
              />
            </div>
            
            <button
              type="button"
              onClick={() => setShowCamera(false)}
              className="w-full py-3.5 bg-danger hover:bg-danger/90 text-white font-black rounded-xl transition-all shadow-lg text-sm"
            >
              إلغاء وقفل الكاميرا
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
