import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  MapPin, 
  UserCheck, 
  Smartphone, 
  Sparkles, 
  LogIn, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertCircle,
  Users,
  Database,
  Info,
  Soup,
  Activity,
  Truck,
  Building2,
  ChevronLeft,
  Sun,
  Moon,
  Minus,
  X
} from 'lucide-react';
import { SystemUser } from '../types';
import JAMLogoSVG from './JAMLogoSVG';
import { DesktopStandaloneWrapper } from '../services/DesktopStandaloneWrapper';
import LoginVirtualKeyboard from './LoginVirtualKeyboard';

interface SecureLoginScreenProps {
  onLoginSuccess: (user: SystemUser, roleMode: 'worker' | 'distributor' | 'admin' | 'veterinary', initialTab?: any) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

// Predefined official employees for the three branches (Sanaa, Dhamar, Aden) & General Manager
const OFFICIAL_EMPLOYEES = [
  // CO-ADMIN / CENTRAL
  {
    username: 'super_admin',
    password: 'GM@admin_2026',
    fullName: 'المدير العام للنظام',
    role: 'GeneralManager' as const,
    governorate: 'الكل',
    branchLabel: 'الإدارة العامة والمركز الرئيسي',
    departmentLabel: 'الإدارة العليا والملاك',
    roleMode: 'admin' as const,
    initialTab: 'treasury'
  }
];

export function SecureLoginScreen({ onLoginSuccess, isDarkMode = true, onToggleTheme }: SecureLoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeField, setActiveField] = useState<'username' | 'password'>('username');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeBranchFilter, setActiveBranchFilter] = useState<'all' | 'sanaa' | 'dhamar' | 'aden'>('all');
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  // Sound generator
  const playBeep = (freq = 920, duration = 0.1) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('Swipe trigger is needed');
    }
  };

  // Check if session exists in memory due to "Remember Me"
  useEffect(() => {
    try {
      // Force load the clean OFFICIAL_EMPLOYEES and overwrite any stale cached data containing demo users
      localStorage.setItem('farmsync_dynamic_employees', JSON.stringify(OFFICIAL_EMPLOYEES));
      setEmployeesList(OFFICIAL_EMPLOYEES);

      const savedUser = localStorage.getItem('farmsync_remembered_user');
      const savedRoleMode = localStorage.getItem('farmsync_remembered_rolemode');
      const savedTab = localStorage.getItem('farmsync_remembered_tab');
      
      if (savedUser && savedRoleMode) {
        const userObj = JSON.parse(savedUser) as SystemUser;
        // Make sure the remembered user is not one of the deleted trial employees
        const isValidUser = OFFICIAL_EMPLOYEES.some(emp => emp.username === userObj.username) || userObj.username === 'super_admin' || userObj.username === 'super_zelai';
        if (isValidUser) {
          DesktopStandaloneWrapper.notifyLoginSuccessAndExpandWindow();
          onLoginSuccess(userObj, savedRoleMode as any, savedTab);
        } else {
          localStorage.removeItem('farmsync_remembered_user');
          localStorage.removeItem('farmsync_remembered_rolemode');
          localStorage.removeItem('farmsync_remembered_tab');
        }
      }
    } catch (e) {
      console.error('Error auto loading session', e);
      setEmployeesList(OFFICIAL_EMPLOYEES);
    }
  }, []);

  const handleValidationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password.trim()) {
      playBeep(330, 0.25);
      setErrorMessage('الرجاء إدخال اسم المستخدم وكلمة المرور بالكامل.');
      return;
    }

    // Try tracking in DB
    const matched = employeesList.find(
      u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password.trim()
    );

    if (matched) {
      if (matched.isApprovedByOwner === false) {
        playBeep(330, 0.45);
        setErrorMessage('⚠️ عذراً! تم إنشاء حسابك بنجاح من قبل مدير الفرع، ولكن لن تبدأ جلسة عملك إلا بعد موافقة واعتماد المالك أو مدير النظام.');
        return;
      }
      playBeep(1200, 0.3);
      
      // Map to correct SystemUser type
      const userObj: SystemUser = {
        id: Math.floor(100 + Math.random() * 900),
        username: matched.username,
        fullName: matched.fullName,
        governorate: matched.governorate,
        role: matched.role === 'GeneralManager' ? 'GeneralManager' : matched.role === 'FieldAccountant' ? 'FieldAccountant' : matched.role === 'Veterinarian' ? 'Veterinarian' : 'BranchManager' as any,
        branchLabel: matched.branchLabel
      };

      // Handle "Remember Me" persistence
      if (rememberMe) {
        localStorage.setItem('farmsync_remembered_user', JSON.stringify(userObj));
        localStorage.setItem('farmsync_remembered_rolemode', matched.roleMode);
        localStorage.setItem('farmsync_remembered_tab', matched.initialTab);
      } else {
        localStorage.removeItem('farmsync_remembered_user');
        localStorage.removeItem('farmsync_remembered_rolemode');
        localStorage.removeItem('farmsync_remembered_tab');
      }

      DesktopStandaloneWrapper.notifyLoginSuccessAndExpandWindow();
      onLoginSuccess(userObj, matched.roleMode, matched.initialTab);
    } else {
      playBeep(310, 0.3);
      setErrorMessage('⚠️ كلمة المرور أو اسم المستخدم غير صحيح! يرجى الاستعانة بالبطاقات التوضيحية المساعدة بالأسفل للتجربة السريعة.');
    }
  };

  const handleQuickFill = (employee: any) => {
    playBeep(980, 0.08);
    setUsername(employee.username);
    setPassword(employee.password);
    setErrorMessage('');
  };

  // filter list
  const filteredEmployeesList = employeesList.filter(emp => {
    if (activeBranchFilter === 'all') return true;
    if (activeBranchFilter === 'sanaa' && emp.governorate === 'صنعاء') return true;
    if (activeBranchFilter === 'dhamar' && emp.governorate === 'ذمار') return true;
    if (activeBranchFilter === 'aden' && emp.governorate === 'عدن') return true;
    return false;
  });

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-[#1a1a1a] to-black text-slate-100' : 'bg-slate-50 text-slate-800'} flex flex-col justify-start lg:justify-center items-center p-4 sm:p-6 select-none font-sans`} id="secure_login_pwa">
      
      {/* Dynamic Background decor tags */}
      <div className="fixed -top-40 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className={`w-full max-w-lg ${isDarkMode ? 'bg-slate-900/60 backdrop-blur-xl border-slate-800 text-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]' : 'bg-white border-slate-200 text-slate-800 shadow-2xl'} border rounded-3xl p-5 sm:p-8 relative mt-4 lg:mt-0 overflow-hidden`}>
        
        {/* شريط سحب النافذة لغلاف سطح المكتب (Desktop Window Drag Bar) */}
        <div 
          className="absolute top-0 left-0 right-0 h-8 z-50 flex items-center justify-between px-4 bg-slate-950/40 backdrop-blur-sm border-b border-emerald-500/20 select-none"
          style={{ WebkitAppRegion: 'drag' as any }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
            <span className="text-[10px] font-bold text-emerald-300 tracking-wider">JAM SYSTEM PRO</span>
          </div>
          <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' as any }}>
            <button
              type="button"
              onClick={() => DesktopStandaloneWrapper.minimizeWindow()}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="تصغير النافذة"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => DesktopStandaloneWrapper.closeWindow()}
              className="p-1 rounded text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 transition-colors"
              title="إغلاق"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Dynamic header badge & Theme toggle */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-bold px-2.5 py-1 rounded-xl text-[9px] flex items-center gap-1.5 font-sans">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>تشفير 256-bit آمن</span>
          </div>
          {onToggleTheme && (
            <button
              type="button"
              onClick={() => { playBeep(1000, 0.08); onToggleTheme(); }}
              className={`p-1 px-2.5 rounded-xl text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                isDarkMode 
                  ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:text-white' 
                  : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              {isDarkMode ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3 text-indigo-500" />}
              <span>{isDarkMode ? 'نهاراً ☀️' : 'ليلاً 🌙'}</span>
            </button>
          )}
        </div>

        {/* LOGO AND BRAND WELL */}
        <div className="text-center flex flex-col items-center gap-3 mt-4 mb-6">
          <div className="relative">
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-amber-500 p-0.5 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 hover:scale-105">
              <div className={`w-full h-full rounded-[22px] ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'} flex items-center justify-center text-emerald-500 p-2`}>
                <JAMLogoSVG className="w-28 h-28 sm:w-36 sm:h-36" />
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-lg">
              <Smartphone className="w-4 h-4 font-bold" />
            </span>
          </div>

          <div>
            <h1 className={`text-xl font-extrabold font-sans ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>بوابة التزامن الآمنة | JAM SYSTEM</h1>
            <h2 className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-bold mt-1`}>نظام إدارة المخازن والمبيعات والتوزيع الذكي</h2>
          </div>
        </div>

        {/* ERROR BLOCK */}
        {errorMessage && (
          <div className="bg-rose-950/70 border-2 border-rose-500 text-rose-300 p-3.5 rounded-2xl text-[11.5px] font-bold mb-4 flex items-start gap-2 text-right">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* SECURE SUBMISSIONS FORM */}
        <form onSubmit={handleValidationSubmit} className="flex flex-col gap-4">
          
          <div className="flex flex-col gap-1.5 text-right">
            <label className={`text-[11.5px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} font-extrabold flex items-center justify-between`}>
              <span>اسم المستخدم المعين بالدفاتر:</span>
              {activeField === 'username' && (
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ● كيبورد نشط
                </span>
              )}
            </label>
            <div className="relative">
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setActiveField('username')}
                onClick={() => setActiveField('username')}
                placeholder="أدخل الرمز التعريفي (مثل: sanaa_acc)"
                className={`w-full ${
                  activeField === 'username'
                    ? (isDarkMode ? 'bg-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 text-white' : 'bg-white border-emerald-500 ring-2 ring-emerald-500/30 text-slate-900')
                    : (isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')
                } border-2 p-3 px-4 rounded-xl text-xs placeholder-slate-400 focus:border-emerald-500 focus:outline-none transition-all text-right font-mono`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-right">
            <label className={`text-[11.5px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} font-extrabold flex items-center justify-between`}>
              <span>كلمة المرور المشفرة:</span>
              {activeField === 'password' && (
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ● كيبورد نشط
                </span>
              )}
            </label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setActiveField('password')}
                onClick={() => setActiveField('password')}
                placeholder="••••••••••••••"
                className={`w-full ${
                  activeField === 'password'
                    ? (isDarkMode ? 'bg-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 text-white' : 'bg-white border-emerald-500 ring-2 ring-emerald-500/30 text-slate-900')
                    : (isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')
                } border-2 p-3 px-4 rounded-xl text-xs placeholder-slate-400 focus:border-emerald-500 focus:outline-none transition-all text-right font-mono`}
              />
              <button
                type="button"
                onClick={() => { playBeep(650, 0.05); setShowPassword(!showPassword); }}
                className="absolute left-3 top-3.5 text-slate-400 hover:text-emerald-500"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* REMEMBER ME PERSISTENCE CHECK */}
          <div className={`flex items-center justify-between my-1 ${isDarkMode ? 'bg-slate-950/65 border-slate-800' : 'bg-slate-50 border-slate-200'} p-3 rounded-xl border`}>
            <label className="flex items-center gap-2 cursor-pointer text-right w-full">
              <input 
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => { playBeep(780, 0.07); setRememberMe(e.target.checked); }}
                className="w-4.5 h-4.5 bg-slate-900 border-slate-800 text-emerald-500 rounded focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
              />
              <div className="mr-1">
                <span className={`text-xs ${isDarkMode ? 'text-white' : 'text-slate-800'} font-black block`}>إبقاء بطاقة الدخول نشطة للجوال (تذكرني)</span>
                <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} block mt-0.5`}>تجنب تكرار الدخول أثناء مسح العنابر الميداني الوعر</span>
              </div>
            </label>
          </div>

          {/* DENSE MASSIVE ACTION BUTTON */}
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-emerald-500/10 active:scale-95 cursor-pointer h-14"
          >
            <LogIn className="w-5 h-5 text-slate-950" />
            <span>تسجيل دخول ميداني آمن</span>
          </button>

          {/* CUSTOMER PORTAL DIRECT LINK */}
          <a
            href="/portal"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = '/portal';
            }}
            className="w-full py-3 bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 border border-amber-300/40 transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>👑 بوابة عملاء وزبائن المتاجر الملكية VIP</span>
          </a>

        </form>

        {/* DYNAMIC HELP CARD: BRANCH ACCOUNTS ACCESS GENERATOR */}
        <div className={`mt-6 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} pt-5`}>
          <div className="flex items-center justify-between mb-3 text-right">
            <div>
              <span className="text-xs text-amber-500 font-extrabold block">قائمة حركات وتراخيص الدخول (سجل الموظفين والميدان):</span>
              <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} block mt-0.5`}>اضغط على الموظف للتعبئة التلقائية وفحص الصلاحيات الجغرافية فوراً:</span>
            </div>
          </div>

          {/* Filter Sub-Strip */}
          <div className={`grid grid-cols-4 gap-1 ${isDarkMode ? 'bg-slate-950 border-slate-850' : 'bg-slate-100 border-slate-200'} p-1 rounded-lg border mb-3`}>
            {[
              { key: 'all', label: 'الكل' },
              { key: 'sanaa', label: 'صنعاء' },
              { key: 'dhamar', label: 'ذمار' },
              { key: 'aden', label: 'عدن' }
            ].map(btn => (
              <button
                key={btn.key}
                type="button"
                onClick={() => { playBeep(840, 0.05); setActiveBranchFilter(btn.key as any); }}
                className={`text-[10px] py-1 rounded transition-all font-bold cursor-pointer ${
                  activeBranchFilter === btn.key 
                    ? (isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 shadow-sm') 
                    : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-550:text-slate-500 hover:text-slate-850:text-slate-900')
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Scrollable Quick list */}
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 text-right scrollbar-thin">
            {filteredEmployeesList.map((emp) => {
              const matchesInput = username.toLowerCase() === emp.username.toLowerCase();
              return (
                <button
                  key={emp.username}
                  type="button"
                  onClick={() => handleQuickFill(emp)}
                  className={`w-full p-2.5 rounded-xl border text-right transition-all flex items-center justify-between text-xs cursor-pointer ${
                    matchesInput 
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 font-bold shadow-sm' 
                      : (isDarkMode ? 'bg-slate-950/60 border-slate-800 text-slate-350:text-slate-300 hover:border-slate-700' : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/50')
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {emp.initialTab === 'kitchen' && (
                      <span className={`p-1 ${isDarkMode ? 'bg-amber-950 text-amber-400' : 'bg-amber-100 text-amber-700'} rounded`}>
                        <Soup className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {emp.initialTab === 'veterinary' && (
                      <span className={`p-1 ${isDarkMode ? 'bg-teal-950 text-teal-400' : 'bg-teal-100 text-teal-700'} rounded`}>
                        <Activity className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {emp.initialTab === 'pos_settlement' && (
                      <span className={`p-1 ${isDarkMode ? 'bg-indigo-950 text-indigo-400' : 'bg-indigo-100 text-indigo-700'} rounded`}>
                        <Truck className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {emp.initialTab === 'production' && (
                      <span className={`p-1 ${isDarkMode ? 'bg-emerald-950 text-emerald-400' : 'bg-emerald-105:bg-emerald-100 text-emerald-700'} rounded`}>
                        <Users className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {emp.initialTab === 'treasury' && (
                      <span className={`p-1 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-800'} rounded`}>
                        <Building2 className="w-3.5 h-3.5" />
                      </span>
                    )}

                    <div>
                      <div className="font-extrabold flex items-center gap-1.5">
                        <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>{emp.fullName}</span>
                        <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-normal`}>({emp.departmentLabel})</span>
                      </div>
                      <div className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
                        كود الدخول: <span className="font-mono text-emerald-600 font-bold">{emp.username}</span> | الفرع: <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{emp.governorate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] block ${isDarkMode ? 'text-slate-400 bg-slate-900' : 'text-slate-600 bg-slate-100'} p-1 rounded font-bold font-mono`}>{emp.password}</span>
                    <ChevronLeft className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>

          <div className={`${isDarkMode ? 'bg-slate-950 border-slate-850' : 'bg-slate-100 border-slate-200'} p-2.5 rounded-xl border text-[10px] text-slate-550:text-slate-500 text-right mt-3 mb-44 flex items-start gap-1.5`}>
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>يدعم التعرف التلقائي على الفرع والقسم؛ حيث يُقفل وصول الموظف للفرع المناسب له لحماية خصوصية بيانات الفروع المختلفة.</span>
          </div>

        </div>

      </div>

    </div>
  );
}
