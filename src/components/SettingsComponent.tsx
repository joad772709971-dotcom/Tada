import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Store, 
  Phone, 
  MapPin, 
  FileText, 
  Compass, 
  Image as ImageIcon, 
  Bell, 
  Save, 
  Info,
  Wrench,
  Bike
} from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsComponentProps {
  activeStore: any;
  onUpdateActiveStore: (updatedFields: any) => void;
}

export default function SettingsComponent({ 
  activeStore, 
  onUpdateActiveStore 
}: SettingsComponentProps) {
  // Local state for settings form
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [businessType, setBusinessType] = useState<'mobiles' | 'motorcycles'>('mobiles');
  const [logoUrl, setLogoUrl] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load from activeStore prop
  useEffect(() => {
    if (activeStore) {
      setName(activeStore.name || '');
      setSlogan(activeStore.slogan || '');
      setPhone(activeStore.phone || activeStore.ownerPhone || '');
      setAddress(activeStore.address || '');
      setBusinessType(activeStore.businessType || 'mobiles');
      setLogoUrl(activeStore.logoUrl || '');
      setBroadcastMessage(activeStore.broadcastMessage || '');
    }
  }, [activeStore]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Trigger callback
    onUpdateActiveStore({
      name,
      slogan,
      phone,
      address,
      businessType,
      logoUrl,
      broadcastMessage
    });

    // Save also to local storage for quick fallback load
    localStorage.setItem('default_shop_name', name);
    localStorage.setItem('default_shop_phone', phone);
    localStorage.setItem('default_shop_address', address);
    localStorage.setItem('default_shop_slogan', slogan);
    localStorage.setItem('maint_business_type', businessType);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  if (!activeStore) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs">
        يرجى تحديد وضبط المتجر النشط أولاً للتمكن من تعديل الإعدادات.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-black text-white flex items-center gap-2">
          ⚙️ إعدادات المتجر والهوية والتهيئة الأساسية
        </h2>
        <p className="text-zinc-500 text-[10px]/relaxed mt-0.5">تهيئة وطباعة معلومات فروع JAM، تعديل الشعار ومعلومات عقود الصيانة، والتحكم بإشعارات البث العام للعملاء.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Settings Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5 bg-gradient-to-br from-[#0c0c0c] to-[#040404] p-6 rounded-2xl border border-zinc-900 shadow-xl">
          <div className="flex justify-between items-center pb-3 border-b border-zinc-950">
            <span className="text-xs font-black text-amber-500 flex items-center gap-1.5">
              <Store size={14} />
              بيانات الهوية والترويج الفرعي للمتجر
            </span>
            
            {saveSuccess && (
              <span className="text-[10px] bg-emerald-950/60 border border-emerald-900 text-emerald-400 px-3 py-1 rounded-lg font-bold animate-pulse">
                ✓ تم الحفظ وتعميم التحديثات بالنظام!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-zinc-400 mb-1.5 font-bold">اسم المتجر/المحل التجاري</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-3 flex items-center text-zinc-650">
                  <Store size={14} />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 bg-zinc-950/60 border border-zinc-900 rounded-xl text-white focus:outline-none focus:border-amber-600/50"
                  placeholder="مثال: ورشة المحفلي لقطع وصيانة الموتورات"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1.5 font-bold">شعار الفاتورة والترويج (Slogan)</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-3 flex items-center text-zinc-650">
                  <FileText size={14} />
                </span>
                <input
                  type="text"
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 bg-zinc-950/60 border border-zinc-900 rounded-xl text-white focus:outline-none focus:border-amber-600/50"
                  placeholder="العبارة المطبوعة أسفل الفاتورة"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1.5 font-bold">رقم هاتف التواصل وإجراءات الواتساب</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-3 flex items-center text-zinc-650">
                  <Phone size={14} />
                </span>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 bg-zinc-950/60 border border-zinc-900 rounded-xl text-white text-center font-mono focus:outline-none focus:border-amber-600/50"
                  placeholder="772315106"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1.5 font-bold">العنوان الجغرافي للمتجر</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-3 flex items-center text-zinc-650">
                  <MapPin size={14} />
                </span>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 bg-zinc-950/60 border border-zinc-900 rounded-xl text-white focus:outline-none focus:border-amber-600/50"
                  placeholder="مثال: صنعاء - جولة التحرير - جوار الكريمي"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1.5 font-bold">رابط صورة الشعار التجاري (Logo URL)</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-3 flex items-center text-zinc-650">
                  <ImageIcon size={14} />
                </span>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 bg-zinc-950/60 border border-zinc-900 rounded-xl text-white text-left font-mono focus:outline-none focus:border-amber-600/50 text-[11px]"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1.5 font-bold">طبيعة نشاط المحل الرئيسي صيانة جرد</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBusinessType('mobiles')}
                  className={`py-2 px-3 rounded-lg text-xs font-black cursor-pointer transition flex items-center justify-center gap-1.5 ${
                    businessType === 'mobiles'
                      ? 'bg-amber-650/20 text-amber-500 border border-amber-600/40'
                      : 'bg-zinc-950/60 text-zinc-500 border border-zinc-900 hover:text-zinc-300'
                  }`}
                >
                  <Compass size={14} />
                  صيانة هواتف موبايل
                </button>
                <button
                  type="button"
                  onClick={() => setBusinessType('motorcycles')}
                  className={`py-2 px-3 rounded-lg text-xs font-black cursor-pointer transition flex items-center justify-center gap-1.5 ${
                    businessType === 'motorcycles'
                      ? 'bg-amber-650/20 text-amber-500 border border-amber-600/40'
                      : 'bg-zinc-950/60 text-zinc-500 border border-zinc-900 hover:text-zinc-300'
                  }`}
                >
                  <Bike size={14} />
                  قسم دراجات وموتورات
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-zinc-400 mb-1.5 font-bold">رسالة البث والتحذيرات السلوكية المعروضة للزبائن (Broadcast Message)</label>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="w-full p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl text-white focus:outline-none focus:border-amber-600/50 h-20 text-xs leading-relaxed"
              placeholder="اكتب هنا إشعاراً عاماً ليظهر لجميع العملاء أو الموظفين عند الدخول، مثل: تنبيه بوجود جرد أو أوقات الدوام الرسمي في العيد."
            />
          </div>

          <div className="pt-2 border-t border-zinc-950 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-black text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Save size={14} />
              حفظ ومزامنة وتحديث فوري للفرع
            </button>
          </div>
        </form>

        {/* Sidebar Info/Preview Cards */}
        <div className="space-y-6">
          
          {/* Card Preview */}
          <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-900 p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4 text-xs font-black text-white">
              <Info size={14} className="text-amber-500" />
              معاينة مظهر الفواتير والموقع للزبائن
            </div>
            
            <div className="bg-white text-black p-4 rounded-xl font-sans text-[11px] text-right space-y-3 shadow-md" dir="rtl">
              <div className="text-center pb-2 border-b border-dashed border-zinc-300">
                <div className="font-extrabold text-[13px]">{name || 'مركز جام برو الذكي'}</div>
                <div className="text-zinc-500 text-[9px] mt-0.5">{slogan || 'صيانة فورية ومبيعات أصلية مضمونة'}</div>
              </div>
              
              <div className="space-y-1 text-zinc-650">
                <div>• المبيعات والجرد: نظام موحد</div>
                <div>• التليفون: {phone || '772315106'}</div>
                <div>• العنوان: {address || 'صنعاء - التحرير'}</div>
                <div>• نوع النشاط: {businessType === 'mobiles' ? 'صيانة هواتف وموبايل' : 'صيانة دراجات نارية وموتورات'}</div>
              </div>

              <div className="text-center pt-2 border-t border-dashed border-zinc-300 text-[8px] text-zinc-450 leading-relaxed">
                شكراً لزيارتكم وثقتكم بنا!
                <br />
                رقم فاتورتك معتمد ومسجل إلكترونياً
              </div>
            </div>
          </div>

          {/* Cloud Info */}
          <div className="bg-gradient-to-br from-[#0c0c0c] to-[#040404] border border-zinc-900/60 p-5 rounded-2xl text-xs space-y-3">
            <h4 className="font-black text-white flex items-center gap-1.5">
              <Bell size={13} className="text-amber-500" />
              قواعد الربط السحابي ومزامنة jam-moto
            </h4>
            <p className="text-zinc-500 text-[10px]/relaxed">
              الإعدادات والهوية السلوكية للمتجر مزامنة تلقائياً بقيد مالك الفرع الرئيسي ومربوطة في خادم firestore.
              يتم تحديث الهيكل اللوجيستي وقالب المعالجة على جميع الشاشات والأجهزة المتصلة فوز تحديثها.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
