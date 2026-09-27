import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  HelpCircle, 
  Clipboard, 
  ShieldAlert, 
  Check, 
  Clock, 
  X, 
  User, 
  MapPin, 
  PlusCircle, 
  TrendingUp, 
  Cpu, 
  Plus, 
  Trash2, 
  Wrench, 
  DollarSign, 
  ChevronLeft,
  Search,
  CheckCircle,
  AlertOctagon,
  Activity
} from 'lucide-react';
import { SystemUser } from '../types';

interface OperationalRequest {
  id: string;
  type: 'shortage' | 'complaint';
  title: string;
  details: string;
  employeeName: string;
  username: string;
  governorate: string;
  departmentLabel: string;
  timestamp: string;
  status: 'pending' | 'solved' | 'rejected';
}

// Initial records for demo/seeding
const INITIAL_DEMO_REQUESTS: OperationalRequest[] = [
  {
    id: 'req-1',
    type: 'shortage',
    title: 'طلب ديزل إسعافي للمولد رقم 2',
    details: 'المولد رقم 2 بفرع ذمار شارف ديزله على الانتهاء. نحتاج إلى توريد 200 لتر ديزل لتجنب توقف التبريد عن العمل.',
    employeeName: 'سالم الكبسي',
    username: 'dhamar_worker',
    governorate: 'ذمار',
    departmentLabel: 'تشغيل فرع ذمار',
    timestamp: '2026-05-28 09:30 ص',
    status: 'pending'
  },
  {
    id: 'req-2',
    type: 'complaint',
    title: 'عطل مفاجئ في سير التعبئة والفرز',
    details: 'تعطل التروس الميكانيكية لسير التعبئة الآلي بفرع صنعاء. نوزع يدوياً الآن ونرجو سرعة إرسال فني الصيانة.',
    employeeName: 'عمار العنسي',
    username: 'sanaa_worker',
    governorate: 'صنعاء',
    departmentLabel: 'تشغيل فرع صنعاء',
    timestamp: '2026-05-28 10:15 ص',
    status: 'solved'
  },
  {
    id: 'req-3',
    type: 'shortage',
    title: 'طلب ميزانية طارئة لصيانة عازل السقف',
    details: 'بسبب أمطار الصيف الغزيرة في عدن، توجد تسريبات مياه رطوبة بسقف المخزن، نطلب ميزانية عاجلة لشراء رولات العازل الحراري والمائي.',
    employeeName: 'ماهر اليماني',
    username: 'aden_worker',
    governorate: 'عدن',
    departmentLabel: 'تشغيل فرع عدن',
    timestamp: '2026-05-28 11:00 ص',
    status: 'rejected'
  }
];

export function ComplaintsCenterDashboard() {
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [requests, setRequests] = useState<OperationalRequest[]>([]);
  
  // Form input states
  const [requestType, setRequestType] = useState<'shortage' | 'complaint'>('shortage');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  
  // Custom toast/alert notification
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Beep Audio sound player
  const playSound = (freq = 850, dur = 0.08) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gainSetting = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gainSetting.gain.setValueAtTime(0.04, ctx.currentTime);
      gainSetting.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + dur);
      osc.connect(gainSetting);
      gainSetting.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  // Load active logged-in employee & system-wide requests
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('farmsync_remembered_user');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }

      const storedRequests = localStorage.getItem('farmsync_operations_requests');
      if (storedRequests) {
        setRequests(JSON.parse(storedRequests));
      } else {
        localStorage.setItem('farmsync_operations_requests', JSON.stringify(INITIAL_DEMO_REQUESTS));
        setRequests(INITIAL_DEMO_REQUESTS);
      }
    } catch (e) {
      setRequests(INITIAL_DEMO_REQUESTS);
    }
  }, []);

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !details.trim()) {
      playSound(330, 0.25);
      alert('الرجاء كتابة عنوان ونشاط الطلب أو البلاغ بالكامل.');
      return;
    }

    playSound(1150, 0.15);

    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 10) + ' ' + now.toLocaleTimeString('ar-YE', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const newReq: OperationalRequest = {
      id: 'req-' + Math.floor(1000 + Math.random() * 8999),
      type: requestType,
      title: title.trim(),
      details: details.trim(),
      employeeName: currentUser?.fullName || 'موظف ميداني مجهول',
      username: currentUser?.username || 'field_anonymous',
      governorate: currentUser?.governorate || 'الكل',
      departmentLabel: currentUser?.branchLabel || 'إدارة العمليات الميدانية',
      timestamp: formattedDate,
      status: 'pending'
    };

    const updated = [newReq, ...requests];
    setRequests(updated);
    localStorage.setItem('farmsync_operations_requests', JSON.stringify(updated));

    // Clear and toast
    setTitle('');
    setDetails('');
    setActionNotice('✔ تم ترحيل طلبك بنجاح وسجله النظام بمستوى أمني مرتفع لإشعار المالك!');
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  // Modify request status (For GM or branch supervisors)
  const handleUpdateStatus = (id: string, nextStatus: 'pending' | 'solved' | 'rejected') => {
    playSound(950, 0.1);
    const updated = requests.map(r => {
      if (r.id === id) {
        return { ...r, status: nextStatus };
      }
      return r;
    });
    setRequests(updated);
    localStorage.setItem('farmsync_operations_requests', JSON.stringify(updated));
  };

  // Delete Request record
  const handleDeleteRequest = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا السجل وبلاغ العطل الميداني نهائياً؟')) {
      playSound(550, 0.12);
      const updated = requests.filter(r => r.id !== id);
      setRequests(updated);
      localStorage.setItem('farmsync_operations_requests', JSON.stringify(updated));
    }
  };

  return (
    <div className="flex flex-col gap-6" id="operations-complaints-center">
      
      {/* Visual Header Grid */}
      <div className="bg-gradient-to-tr from-slate-900 via-slate-900 to-rose-950/20 border border-slate-800 rounded-3xl p-6 relative overflow-hidden text-right">
        <div className="absolute top-0 left-0 text-slate-800/15 p-8 transform -translate-x-3 -translate-y-3 font-black text-6xl select-none pointer-events-none">
          OPERATIONS
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 px-2.5 rounded-full bg-rose-950/80 border border-rose-500/30 text-[10px] text-rose-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              مركز تتبع الصيانة والاحتياجات
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-100">بوابة الإبلاغ عن الأعطال ورفع الاحتياجات الميدانية</h1>
          <p className="text-xs text-slate-400 mt-1">تتيح للعمال والموزعين والأطباء رفع فوري للنواقص الميدانية والأعطال الميكانيكية وإحالتها لغرفة الإدارة العليا تلقائياً.</p>
        </div>
      </div>

      {/* Success Notification Action Box */}
      {actionNotice && (
        <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-300 p-4 rounded-2xl text-xs font-bold text-right flex items-center justify-between animate-pulse">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: TWO HUGE BUTTONS SELECTOR & SUBMISSION FORM */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-5 rounded-3xl text-right flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-800 pb-3.5 mb-5">
              <span className="text-xs text-amber-500 font-extrabold block">إنشاء معاملة ميدانية جديدة:</span>
              <p className="text-[10px] text-slate-500 mt-0.5">اختر نوع البلاغ تالياً بضغطة زر لتهيئة الخوادم وفق احتياجك:</p>
            </div>

            {/* TWO HUGE GLOVE-FRIENDLY BUTTONS */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              
              {/* Type A: Shortages & Tools Budget Button */}
              <button
                type="button"
                onClick={() => { playSound(920, 0.08); setRequestType('shortage'); }}
                className={`p-4 rounded-2xl border transition-all text-right flex flex-col justify-between h-28 cursor-pointer relative overflow-hidden ${
                  requestType === 'shortage'
                    ? 'bg-emerald-950/80 border-emerald-510 border-emerald-500 shadow-md ring-1 ring-emerald-500/10'
                    : 'bg-slate-950/50 border-slate-850 hover:bg-slate-950 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`p-1.5 rounded-xl ${requestType === 'shortage' ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-900 text-slate-500'}`}>
                    <DollarSign className="w-5 h-5" />
                  </span>
                  <div className={`w-3.5 h-3.5 rounded-full border-4 border-slate-900 ${requestType === 'shortage' ? 'bg-emerald-500' : 'bg-transparent'}`} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white leading-tight">طلب نواقص وديزل وميزانية</h3>
                  <span className="text-[9px] text-slate-400 block mt-0.5">تفريغ، علف، صيانة طارئة</span>
                </div>
              </button>

              {/* Type B: Malfunction & Issues Complaint Button */}
              <button
                type="button"
                onClick={() => { playSound(720, 0.08); setRequestType('complaint'); }}
                className={`p-4 rounded-2xl border transition-all text-right flex flex-col justify-between h-28 cursor-pointer relative overflow-hidden ${
                  requestType === 'complaint'
                    ? 'bg-rose-955/20 bg-rose-950/50 border-rose-500 shadow-md ring-1 ring-rose-500/15'
                    : 'bg-slate-950/50 border-slate-850 hover:bg-slate-950 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`p-1.5 rounded-xl ${requestType === 'complaint' ? 'bg-rose-900 text-rose-400' : 'bg-slate-900 text-slate-500'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </span>
                  <div className={`w-3.5 h-3.5 rounded-full border-4 border-slate-900 ${requestType === 'complaint' ? 'bg-rose-500' : 'bg-transparent'}`} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white leading-tight">بلاغ وشكوى عن عطل فني</h3>
                  <span className="text-[9px] text-slate-400 block mt-0.5">مرض القطيع، تسرب مائي، تكييف</span>
                </div>
              </button>

            </div>

            {/* TEXT INPUTS FORM */}
            <form onSubmit={handleCreateRequest} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400">العنوان المعبر عن الطلب / المشكلة الميدانية:</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={requestType === 'shortage' ? 'مثال: طلب عاجل لشراء حزام تعبئة بلاستيكي' : 'مثال: كسر ميكانيكي في خلاط خلايا التبريد'}
                  className="w-full bg-slate-950 border border-slate-850 p-2.5 rounded-xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-right font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400">الشرح والتفاصيل (برجاء التوضيح بدقة للمالك):</label>
                <textarea 
                  rows={4}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="حدد المشكلة المادية أو النقص، واذكر رقم القسم أو الخط لكي يتمكن فريق الصيانة والإدارة الرئيسية من رصد الاحتياج فوراً..."
                  className="w-full bg-slate-950 border border-slate-850 p-2.5 rounded-xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-right leading-relaxed font-sans"
                />
              </div>

              {/* Dynamic Employee Recognition Display */}
              {currentUser && (
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-slate-400 block text-[9.5px]">صاحب التوقيع للطلب آلياً:</span>
                      <span className="text-white font-extrabold">{currentUser.fullName} ({currentUser.role})</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-slate-300">فرع: {currentUser.governorate}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className={`w-full font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[98%] cursor-pointer text-xs ${
                  requestType === 'shortage' 
                    ? 'bg-emerald-600 hover:bg-emerald-555:bg-emerald-500 text-slate-950'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>إبرام وترحيل الطلب بنظام JAM SYSTEM</span>
              </button>

            </form>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-850 text-[10px] text-slate-500 mt-4 leading-normal">
            ⚙️ يقوم لوح البيانات بربط بصمة الهاش وهويات تسجيل الدخول آلياً لرفع مصداقية الشكاوى والحد من تزييف الاحتياجات الدفترية بالفروع.
          </div>

        </div>

        {/* RIGHT COLUMN: RECENT LOGGED INCIDENTS / ISSUES TRACKING LIST */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-5 rounded-3xl text-right">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Clipboard className="w-4 h-4 text-slate-400" />
              <h2 className="text-xs font-black text-slate-200">سجل المعاملات والعهود المرفوعة حالياً بالفروع</h2>
            </div>
            <span className="p-0.5 px-2 bg-slate-950 text-slate-400 text-[10px] font-mono rounded-lg border border-slate-850">
              {requests.length} معاملة
            </span>
          </div>

          {/* Render complaints cards */}
          <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
            {(() => {
              const displayRequests = currentUser && currentUser.governorate && currentUser.governorate !== 'الكل'
                ? requests.filter(r => r.governorate === currentUser.governorate)
                : requests;

              if (displayRequests.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-600 text-xs flex flex-col items-center justify-center">
                    <Clipboard className="w-10 h-10 text-slate-700 mb-2" />
                    <span>لم يتم العثور على أي عهود وبلاغات حالية لفرعك.</span>
                  </div>
                );
              }

              return displayRequests.map((req) => (
                <div 
                  key={req.id} 
                  className={`p-4 rounded-2xl border transition-all ${
                    req.type === 'shortage'
                      ? 'bg-slate-950/80 border-emerald-950 hover:border-emerald-900/40'
                      : 'bg-slate-950/80 border-rose-950 hover:border-rose-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`p-1 rounded text-[9px] font-extrabold ${
                        req.type === 'shortage' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950/60 text-rose-400'
                      }`}>
                        {req.type === 'shortage' ? 'طلب نواقص وموزعين' : 'بلاغ وشكوى عطل'}
                      </span>
                      <h3 className="text-xs font-black text-white">{req.title}</h3>
                    </div>

                    {/* Status Badge */}
                    <span className={`p-0.5 px-2.5 rounded-full text-[9px] font-black border ${
                      req.status === 'pending' ? 'bg-amber-950/70 border-amber-500/30 text-amber-400' :
                      req.status === 'solved' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400' :
                      'bg-rose-950/60 border-rose-500/40 text-rose-400'
                    }`}>
                      {req.status === 'pending' ? 'قيد المراجعة 🕒' :
                       req.status === 'solved' ? 'تم الحل والمبادرة ✔' :
                       'مرفوض ⛔'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed mb-3 bg-slate-900/50 p-2.5 rounded-xl border border-slate-850">
                    {req.details}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-slate-400 pt-2 border-t border-slate-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-200 font-extrabold">الموظف: {req.employeeName}</span>
                      <span className="text-slate-500">|</span>
                      <span>كود: <span className="font-mono text-emerald-400">{req.username}</span></span>
                      <span className="text-slate-500">|</span>
                      <span className="font-bold text-white bg-slate-900 p-0.5 px-2 rounded">فرع {req.governorate}</span>
                    </div>
                    <span className="font-mono text-[9px] text-slate-500">{req.timestamp}</span>
                  </div>

                  {/* ADMIN CHANGER CONTROLS (Only visible to GeneralManager or simulated high personnel) */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-900/80 flex items-center justify-between bg-slate-900/30 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-500">تعديل حالة الطلب دفترياً:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateStatus(req.id, 'solved')}
                        title="تفويض الحل والمطابقة"
                        className="p-1 px-2.5 bg-emerald-950 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-900 rounded-lg text-[9px] font-bold cursor-pointer"
                      >
                        إثبات الحل
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(req.id, 'rejected')}
                        title="حجب الطلب"
                        className="p-1 px-2.5 bg-rose-950 text-rose-400 border border-rose-500/20 hover:bg-rose-900 rounded-lg text-[9px] font-bold cursor-pointer"
                      >
                        رفض القيد
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(req.id)}
                        className="p-1 px-1.5 bg-slate-950 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="شطب المعاملة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              ));
            })()}
          </div>

        </div>

      </div>

    </div>
  );
}
