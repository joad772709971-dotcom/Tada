import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Lock, 
  User, 
  Phone,
  KeyRound
} from 'lucide-react';
import { useConnectivity } from '../hooks/useConnectivity';
import JAMLogoSVG from './JAMLogoSVG';
import LoginTechBackground from './LoginTechBackground';
import CyberCircuitBackground from './CyberCircuitBackground';
import { getCurrentVariant, APP_VARIANTS } from '../services/variantEngine';
import { DesktopStandaloneWrapper } from '../services/DesktopStandaloneWrapper';
import LoginVirtualKeyboard from './LoginVirtualKeyboard';
import { getDeviceId } from '../services/quotaAndOfflineEngine';

const WhatsAppSVG = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

interface LoginProps {
  username: string;
  setUsername: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  isLoggingIn: boolean;
  loginError: string;
  onLogin: (e: React.FormEvent) => void;
  shopName: string;
  onSignUpClick?: () => void;
  onClearError?: () => void;
}

export default function Login({
  username,
  setUsername,
  password,
  setPassword,
  isLoggingIn,
  loginError,
  onLogin,
  shopName,
  onSignUpClick,
  onClearError
}: LoginProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [activeField, setActiveField] = useState<'username' | 'password'>('username');
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('jam_remember_me') === 'true';
  });
  const [showForgotNotice, setShowForgotNotice] = useState(false);
  const isOnline = useConnectivity();

  // Clear stale login errors on mount and unmount
  useEffect(() => {
    if (onClearError) onClearError();
    return () => {
      if (onClearError) onClearError();
    };
  }, []);

  // Auto-fill remembered credentials on mount
  useEffect(() => {
    const isRemembered = localStorage.getItem('jam_remember_me') === 'true';
    const cachedUser = localStorage.getItem('jam_remembered_username');
    if (isRemembered && cachedUser && !username) {
      setUsername(cachedUser);
    }
  }, []);

  const handleUsernameChange = (val: string) => {
    if (loginError && onClearError) onClearError();
    setUsername(val);
  };

  const handlePasswordChange = (val: string) => {
    if (loginError && onClearError) onClearError();
    setPassword(val);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    if (loginError && onClearError) onClearError();
    if (rememberMe) {
      localStorage.setItem('jam_remember_me', 'true');
      localStorage.setItem('jam_remembered_username', username);
    } else {
      localStorage.removeItem('jam_remember_me');
      localStorage.removeItem('jam_remembered_username');
    }
    // Broadcast window resize & notify success for Desktop Standalone
    DesktopStandaloneWrapper.notifyLoginSuccessAndExpandWindow();
    onLogin(e);
  };

  const handleRequestLicense = () => {
    try {
      let devId = '';
      try {
        devId = getDeviceId();
      } catch {
        devId = (typeof window !== 'undefined' ? localStorage.getItem('JAM_DEVICE_PERSISTENT_ID_V1') : '') || '';
      }
      
      if (!devId) {
        devId = `JAM_DEV_${Math.random().toString(36).substring(2, 8).toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('JAM_DEVICE_PERSISTENT_ID_V1', devId);
          }
        } catch (_) {}
      }

      const message = `السلام عليكم، أرغب في الاشتراك وتفعيل ترخيص جديد لنظام JAM System Pro.\nمعرّف جهازي (Device ID): ${devId}`;
      const whatsappUrl = `https://wa.me/967772315106?text=${encodeURIComponent(message)}`;

      if (typeof window !== 'undefined') {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Failed to open WhatsApp activation link:', err);
    }
  };

  return (
    <div className="login-ui-frozen relative flex min-h-[100dvh] w-full flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10 xl:gap-12 overflow-x-hidden overflow-y-auto overscroll-contain bg-[#040711] px-3.5 xs:px-4 sm:px-6 lg:px-10 py-5 sm:py-8 font-sans select-none pb-24 sm:pb-12" dir="rtl">
      
      {/* 🌌 High-Tech Cybernetic Motherboard & Micro-Matrix Circuit Background */}
      <CyberCircuitBackground />

      {/* 💻 Desktop Tech Illustration Panel (Enlarged and scaled for computer monitors) */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="hidden lg:block lg:w-[480px] xl:w-[580px] 2xl:w-[660px] shrink-0 relative z-10"
      >
        <LoginTechBackground />
      </motion.div>

      {/* 🔐 Ultra-Sleek Modern Glassmorphic Login Window Container - Mobile Adaptive & Tall Proportions */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative w-full max-w-[390px] xs:max-w-[410px] sm:max-w-[440px] md:max-w-[460px] mx-auto my-auto transition-all duration-300 overflow-hidden rounded-[2.5rem] border border-cyan-500/40 sm:border-cyan-500/30 bg-gradient-to-b from-[#0c162b]/98 via-[#081020]/98 to-[#030712]/98 p-6 xs:p-7 sm:p-8 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.25)] ring-1 ring-white/10 group z-20 shrink-0 backdrop-blur-2xl"
      >
        {/* Dynamic Light Sweep Highlight */}
        <div className="absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent blur-[25px] -skew-x-12 animate-[glance_4s_infinite] pointer-events-none" />

        {/* 🌟 Brand Master Icon - Large, Commanding & Proportional */}
        <div className="flex flex-col items-center mb-4 xs:mb-5 sm:mb-6 pt-1">
          <div className="relative group cursor-pointer">
            {/* Multi-layered Pulsing Cyber Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/35 via-sky-500/25 to-indigo-500/35 rounded-full blur-2xl opacity-75 group-hover:opacity-100 transition-all duration-500 animate-pulse" />
            <div className="absolute -inset-1 rounded-full border border-cyan-400/30 opacity-60 animate-[spin_16s_linear_infinite]" />
            
            {/* Prominent App Icon (Enlarged & Crisp for Mobile) */}
            <JAMLogoSVG className="w-32 h-32 xs:w-36 xs:h-36 sm:w-36 sm:h-36 z-10 filter drop-shadow-[0_16px_35px_rgba(0,0,0,0.95)] transition-all duration-300 hover:scale-105" />
          </div>
          
          <h1 className="mt-3 xs:mt-4 text-2xl xs:text-3xl sm:text-3xl text-center font-sans text-white font-black tracking-wide leading-tight" id="login-shop-title">
            {(localStorage.getItem('jam_last_logged_in_shop_name') || shopName || 'JAM System Pro')
              .replace(/\s*\([^)]*(مالك|عام|جملة|تجزئة|موظف|فني|محلي|مدمج|صاحب)[^)]*\)/gi, '')
              .trim() || 'JAM System Pro'}
          </h1>

          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
            <p className="text-xs xs:text-sm sm:text-sm font-bold text-cyan-300 tracking-wide text-center">
              منظومة إدارة المبيعات ونقاط البيع والمحاسبة الذكية
            </p>
          </div>
          
          {/* Real-time Connectivity Badge */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-pulse">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                متصل بالسيرفر السحابي المباشر
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-amber-500/20 border border-amber-500/35 text-amber-300 text-xs font-bold rounded-full">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping" />
                وضعية التشفير والعمل أوفلاين
              </span>
            )}
          </div>
        </div>

        {/* 📝 Balanced Login Input Fields Container - Mobile Tailored */}
        <form onSubmit={handleFormSubmit} className="space-y-4 xs:space-y-4.5 sm:space-y-5">
          
          {/* Username / Phone input field */}
          <div className="space-y-2" id="username-field-container">
            <label className="block text-xs xs:text-sm sm:text-sm font-bold text-slate-200 text-right pr-1 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="w-4.5 h-4.5 text-cyan-400" />
                <span>اسم المستخدم أو رقم الهاتف:</span>
              </span>
            </label>
            <div className={`relative rounded-2xl bg-slate-950/90 border transition-all shadow-inner ${
              activeField === 'username' 
                ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-[0_0_18px_rgba(6,182,212,0.3)]' 
                : 'border-slate-700/80 hover:border-slate-600 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/30'
            }`}>
              <input
                id="username-field-input"
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                onFocus={() => setActiveField('username')}
                onClick={() => setActiveField('username')}
                required
                className="w-full bg-transparent pl-12 pr-4 py-3.5 xs:py-4 text-right text-sm xs:text-base sm:text-base text-white placeholder-slate-500 outline-none font-bold tracking-wide rounded-2xl"
                placeholder="أدخل اسم الحساب أو رقم الهاتف..."
              />
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-400 transition-colors pointer-events-none">
                <Phone className="w-5 h-5 text-cyan-400/85" />
              </div>
            </div>
          </div>

          {/* Password input field */}
          <div className="space-y-2" id="password-field-container">
            <label className="block text-xs xs:text-sm sm:text-sm font-bold text-slate-200 text-right pr-1 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Lock className="w-4.5 h-4.5 text-cyan-400" />
                <span>كلمة المرور المشفرة:</span>
              </span>
            </label>
            <div className={`relative rounded-2xl bg-slate-950/90 border transition-all shadow-inner ${
              activeField === 'password' 
                ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-[0_0_18px_rgba(6,182,212,0.3)]' 
                : 'border-slate-700/80 hover:border-slate-600 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/30'
            }`}>
              <input
                id="password-field-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onFocus={() => setActiveField('password')}
                onClick={() => setActiveField('password')}
                required
                className="w-full bg-transparent pl-12 pr-4 py-3.5 xs:py-4 text-right text-sm xs:text-base sm:text-base text-white placeholder-slate-500 outline-none tracking-widest font-bold rounded-2xl"
                placeholder="••••••••••••"
              />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-white transition-colors cursor-pointer p-2"
                id="password-visibility-toggle-btn"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 text-cyan-400" />
                ) : (
                  <Eye className="w-5 h-5 text-slate-400 hover:text-cyan-400" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password Controls (Flexible, clean single-line row) */}
          <div className="flex items-center justify-between text-xs xs:text-sm px-1 select-none pt-1" id="remember-forgot-container">
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 hover:text-white font-medium text-xs xs:text-sm py-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded-md bg-slate-900 border border-slate-600 text-cyan-500 focus:ring-0 accent-cyan-500 cursor-pointer"
              />
              <span>تذكرني على هذا الجهاز</span>
            </label>

            <button 
              type="button" 
              onClick={() => setShowForgotNotice(!showForgotNotice)}
              className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/70 text-cyan-300 hover:text-cyan-200 text-xs font-medium rounded-xl border border-cyan-500/20 transition-all cursor-pointer inline-flex items-center gap-1 shrink-0"
              id="forgot-password-link"
            >
              <span>نسيت كلمة السر؟</span>
            </button>
          </div>

          {showForgotNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-950/95 border border-cyan-500/40 p-3.5 rounded-2xl text-center space-y-1.5"
            >
              <p className="text-xs xs:text-sm text-cyan-200 font-medium leading-relaxed">
                لاستعادة رمز الأمان أو إعادة تعيين كلمة المرور، يرجى التواصل فوراً مع الدعم الفني:
              </p>
              <a href="tel:772315106" className="block text-base sm:text-lg font-black text-cyan-400 tracking-widest hover:underline num-mono">
                772315106
              </a>
              <button 
                type="button" 
                onClick={() => setShowForgotNotice(false)} 
                className="text-xs text-slate-400 hover:text-white underline block mx-auto pt-1 cursor-pointer"
              >
                إغلاق التنبيه
              </button>
            </motion.div>
          )}

          {/* Error Message Alert */}
          {loginError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/20 border border-red-500/40 px-4 py-2.5 rounded-2xl text-red-200 text-xs xs:text-sm font-bold text-center shadow-lg"
            >
              {loginError}
            </motion.div>
          )}

          {/* 🚀 Sapphire Cyan Login Button - Expanded and Ergonomic for Mobile */}
          <button
            type="submit"
            disabled={isLoggingIn}
            className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:from-cyan-500 hover:via-sky-500 hover:to-indigo-500 px-4 py-3.5 sm:py-4 text-center font-black text-white shadow-[0_8px_25px_rgba(6,182,212,0.35)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-70 cursor-pointer mt-2 group"
          >
            <span className="absolute inset-0 block w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            
            <div className="flex items-center justify-center gap-2.5 relative z-10 text-sm xs:text-base sm:text-base font-black">
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>جاري التحقق وفتح المنظومة...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-white" />
                  <span>دخول النظام والتسجيل المباشر</span>
                </>
              )}
            </div>
          </button>

          {/* 💬 WhatsApp Request License / New Account Activation Button */}
          <button
            type="button"
            onClick={handleRequestLicense}
            id="request-new-license-whatsapp-btn"
            className="relative w-full overflow-hidden rounded-2xl border border-emerald-500/35 bg-gradient-to-r from-emerald-950/40 via-emerald-900/25 to-teal-950/40 hover:from-emerald-900/50 hover:via-emerald-800/35 hover:to-teal-900/50 px-4 py-3 sm:py-3.5 text-center transition-all duration-300 hover:border-emerald-400 hover:shadow-[0_0_18px_rgba(16,185,129,0.25)] active:scale-[0.98] cursor-pointer group mt-2.5"
            title="تواصل معنا عبر واتساب لطلب ترخيص وتفعيل نسخة جديدة للنظام"
          >
            <div className="flex items-center justify-center gap-2.5 relative z-10">
              <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                <WhatsAppSVG className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400" />
              </span>
              <span className="text-xs xs:text-sm sm:text-sm font-bold text-emerald-300 group-hover:text-emerald-200 tracking-wide transition-colors">
                طلب نسخة / تفعيل حساب جديد
              </span>
              <KeyRound className="w-4 h-4 text-emerald-400/80 group-hover:text-emerald-300 transition-colors" />
            </div>
          </button>

        </form>

        {/* Developer Attribution Footer */}
        <div className="mt-5 pt-3.5 border-t border-slate-800/80 text-center space-y-1" id="developer-attribution-footer">
           <div className="flex items-center justify-center gap-2">
              <div className="h-[1px] flex-1 bg-slate-800/70" />
              <span className="text-[10px] sm:text-xs text-cyan-400/80 font-bold tracking-widest uppercase">POWERED BY JAM SYSTEM PRO</span>
              <div className="h-[1px] flex-1 bg-slate-800/70" />
           </div>
           
           <div className="flex items-center justify-center gap-3 pt-1">
              <span className="text-slate-300 font-bold text-xs xs:text-sm">م. عبد الغني المحفلي</span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-400 font-bold text-xs xs:text-sm tracking-wider num-mono">772315106</span>
           </div>
        </div>
      </motion.div>

      {/* Animation Styles */}
      <style>{`
        @keyframes glance {
          0% { transform: translateX(-100%) skew(-12deg); }
          50% { transform: translateX(300%) skew(-12deg); }
          100% { transform: translateX(300%) skew(-12deg); }
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        @keyframes shiny-text {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
}
