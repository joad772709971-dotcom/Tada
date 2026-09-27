import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, User, Eye, EyeOff, ShieldAlert, Sparkles } from 'lucide-react';
import JAMLogoSVG from './JAMLogoSVG';
import LoginVirtualKeyboard from './LoginVirtualKeyboard';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeField, setActiveField] = useState<'username' | 'password'>('username');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!username.trim() || !password.trim()) {
      setErrorMsg('فضلاً أدخل اسم المستخدم وكلمة المرور الأمنية أولاً.');
      return;
    }

    setLoading(true);

    // Simulate database lookup of the administrative credentials (e.g., مصعب, المالك)
    setTimeout(() => {
      setLoading(false);
      // Let's accept any login for fluid demo, but specially welcome "مصعب" or "المالك"
      localStorage.setItem('jam_admin_logged', 'true');
      localStorage.setItem('jam_admin_username', username);
      navigate('/admin/dashboard');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a1a1a] to-black relative overflow-hidden flex flex-col items-center justify-center p-4 select-none font-sans" dir="rtl">
      
      {/* Immersive background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-amber-500/5 via-yellow-500/5 to-transparent blur-[120px] rounded-full pointer-events-none" />

      {/* 1. Golden Shield & Glass container matched precisely to user's uploaded image */}
      <div className="w-full max-w-[370px] bg-gradient-to-b from-[#e19a18] via-[#cca825] to-[#aa831b] rounded-[40px] p-[3px] shadow-2xl neon-glow-gold relative z-10">
        
        {/* Soft Inner card body simulating the premium physical metal glass aesthetic */}
        <div className="w-full bg-[#121307]/95 rounded-[38px] p-8 pb-10 flex flex-col items-center text-center relative overflow-hidden">
          
          {/* Decorative ambient rays */}
          <div className="absolute -top-10 left-10 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-10 right-10 w-24 h-24 bg-[#cca825]/10 rounded-full blur-2xl"></div>

          {/* Golden/Silver Glass Badge with official 3D logo */}
          <div className="w-28 h-28 rounded-[32px] bg-sky-950/20 border-2 border-[#fff]/10 flex items-center justify-center overflow-hidden shadow-lg mb-6 shadow-[#000]/40 backdrop-blur-md">
            <JAMLogoSVG className="w-22 h-22" />
          </div>

          {/* Titles & Branding */}
          <h2 className="text-3xl sm:text-4xl font-black text-amber-100 tracking-tight block">Jam system pro</h2>
          <span className="text-[11px] text-[#e0b753] font-bold block mt-1 tracking-wider uppercase">الإدارة والتدقيق الذكي</span>

          {/* Form Action */}
          <form onSubmit={handleLoginSubmit} className="w-full mt-8 space-y-4">
            
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 text-rose-300 rounded-xl p-3 text-[10.5px] font-bold text-right flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-450 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Field A: Username/Email */}
            <div className="relative">
              <span className="absolute right-3.5 top-3.5 text-amber-500/60">
                <User className="w-4 h-4" />
              </span>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setActiveField('username')}
                onClick={() => setActiveField('username')}
                placeholder="البريد أو اسم المستخدم"
                className={`w-full bg-black/60 border text-amber-100 placeholder-amber-100/60 text-xs rounded-2xl pr-10 pl-4 py-3.5 text-right outline-none transition ${
                  activeField === 'username' ? 'border-[#e0b753] ring-2 ring-[#e0b753]/30' : 'border-[#e0b753]/45'
                }`}
                required
              />
            </div>

            {/* Field B: Secure Password */}
            <div className="relative">
              <span className="absolute right-3.5 top-3.5 text-amber-500/60">
                <Key className="w-4 h-4" />
              </span>
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setActiveField('password')}
                onClick={() => setActiveField('password')}
                placeholder="كلمة المرور الآمنة"
                className={`w-full bg-black/60 border text-amber-100 placeholder-amber-100/60 text-xs rounded-2xl pr-10 pl-11 py-3.5 text-right outline-none transition ${
                  activeField === 'password' ? 'border-[#e0b753] ring-2 ring-[#e0b753]/30' : 'border-[#e0b753]/45'
                }`}
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-3.5 text-amber-500/40 hover:text-amber-100 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Extra accessories checkboxes */}
            <div className="flex items-center justify-between text-[10.5px] font-bold text-amber-100/70 pt-1 px-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                  className="rounded border-[#e0b753]/30 bg-black checked:bg-amber-500 accent-amber-550 w-3.5 h-3.5 outline-none"
                />
                <span>تذكرني على هذا الجهاز</span>
              </label>
              <button 
                type="button" 
                onClick={() => alert('الرجاء مراجعة مسؤول المنصة الفنية بالنظام لاستعادة الرمز المفقود.')}
                className="hover:text-amber-105 transition"
              >
                نسيت الرمز؟
              </button>
            </div>

            {/* Premium Gold Button matching physical screen specular highlights */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-6 bg-gradient-to-r from-[#ffe17d] via-[#e5b32f] to-[#aa831b] text-slate-950 font-black text-xs rounded-2xl shadow-xl hover:brightness-110 active:scale-[0.98] transition tracking-widest flex items-center justify-center gap-1"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>دخول النظام</span>
                  <span className="font-mono text-[9px] mr-0.5">⟩</span>
                </>
              )}
            </button>

          </form>

        </div>
      </div>

      {/* 2. LOWER SIGN OFF DETAILS EXACT MATCH TO ATTACHED DESIGN LAYOUT SCREEN */}
      <div className="mt-8 mb-44 text-center space-y-1 text-[10px] text-slate-500 font-sans tracking-wide">
        <div className="flex items-center justify-center gap-1 text-slate-600 font-bold uppercase text-[9px]">
          <span className="w-1.5 h-1.5 bg-[#e0b753]/35 rounded-full"></span>
          <span>Powered by JAM AI</span>
        </div>
        
        <div className="font-extrabold text-[#e0b753]/80 pt-1 text-xs">م. عبد الغني المحفلي</div>
        <div className="font-mono text-xs text-[#e0b753]/60">772315106</div>
      </div>

    </div>
  );
}
