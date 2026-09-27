import React from 'react';
import { SYSTEM_LOGO } from '../constants/assets';

interface LoginTechBackgroundProps {
  className?: string;
  compact?: boolean;
}

export default function LoginTechBackground({ className = '', compact = false }: LoginTechBackgroundProps) {
  return (
    <div className={`relative overflow-hidden rounded-[2.2rem] sm:rounded-[2.8rem] border border-amber-500/35 bg-gradient-to-br from-[#070c1a]/95 via-[#0b1428]/95 to-[#04060f] ${compact ? 'p-4' : 'p-5 sm:p-7 xl:p-8'} text-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(245,158,11,0.12)] ${className}`}>
      {/* Background glowing lighting orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/15 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/15 rounded-full blur-[110px] pointer-events-none" />
      
      {/* Decorative Grid Mesh */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(rgba(245, 158, 11, 0.3) 1px, transparent 1px), radial-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          backgroundPosition: '0 0, 14px 14px'
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center space-y-3.5">
        
        {/* Title Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] sm:text-[11px] font-black uppercase tracking-widest shadow-sm">
            <span>منظومة الجوالات والصيانة والمحاسبة ⚡</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Jam System Pro
          </h2>
          <p className="text-xs text-gray-300 font-bold">
            محاسبة محلات الجوالات • الملحقات • مركز الصيانة وقطع الغيار
          </p>
        </div>

        {/* Central High-Tech Vector Illustration Scene - Expanded & Scaled for PC Display */}
        <div className="w-full max-w-2xl mx-auto py-1">
          <svg viewBox="0 0 800 520" className="w-full h-auto drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)] filter transition-all duration-300 hover:scale-[1.01]">
            <defs>
              {/* Gradients */}
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>

              <linearGradient id="phoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              <linearGradient id="phoneScreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0a1128" />
                <stop offset="50%" stopColor="#061224" />
                <stop offset="100%" stopColor="#020817" />
              </linearGradient>

              <linearGradient id="solderHeatGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#fef08a" />
              </linearGradient>

              <linearGradient id="barGrad1" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.95" />
              </linearGradient>

              <linearGradient id="barGrad2" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.95" />
              </linearGradient>

              <linearGradient id="barGrad3" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.95" />
              </linearGradient>

              <linearGradient id="keyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>

              {/* Glow Filters */}
              <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              
              <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* 1. Base Glass Desk Surface */}
            <ellipse cx="400" cy="440" rx="380" ry="60" fill="url(#phoneScreenGrad)" stroke="#334155" strokeWidth="2" opacity="0.85" />
            <ellipse cx="400" cy="440" rx="340" ry="45" fill="none" stroke="url(#goldGrad)" strokeWidth="1" opacity="0.3" strokeDasharray="6,6" />

            {/* 2. Phone Repair Motherboard / IC Circuit (لوحة أم ورقيقة صيانة) - Bottom Center Background */}
            <g id="repair-circuit-board" transform="translate(320, 395)">
              <rect x="0" y="0" width="160" height="70" rx="10" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" opacity="0.9" />
              {/* Circuit traces */}
              <path d="M 10 20 L 40 20 L 50 35 L 90 35" fill="none" stroke="#34d399" strokeWidth="1.5" />
              <path d="M 20 50 L 60 50 L 75 35 L 140 35" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
              <circle cx="90" cy="35" r="4" fill="#34d399" />
              <circle cx="140" cy="35" r="4" fill="#f59e0b" />
              {/* Main Processor IC Chip */}
              <rect x="55" y="10" width="50" height="40" rx="5" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="80" y="34" fill="#fbbf24" fontSize="8" fontWeight="extrabold" textAnchor="middle">JAM BIONIC</text>
            </g>

            {/* 3. Maintenance Tools Set (عدة الصيانة: مفك دقيق، ملقط، كاوية لحام) */}
            <g id="maintenance-tools-group">
              {/* Screwdriver (مفك صيانة) - Left Angled */}
              <g transform="translate(80, 220) rotate(25)">
                {/* Handle */}
                <rect x="0" y="0" width="18" height="110" rx="5" fill="url(#goldGrad)" stroke="#fef08a" strokeWidth="1" />
                <line x1="0" y1="30" x2="18" y2="30" stroke="#000" strokeWidth="2" opacity="0.3" />
                <line x1="0" y1="60" x2="18" y2="60" stroke="#000" strokeWidth="2" opacity="0.3" />
                <line x1="0" y1="90" x2="18" y2="90" stroke="#000" strokeWidth="2" opacity="0.3" />
                {/* Metallic Shaft */}
                <rect x="6" y="110" width="6" height="80" fill="#94a3b8" stroke="#cbd5e1" strokeWidth="1" />
                {/* Precision Tip */}
                <polygon points="6,190 12,190 9,205" fill="#334155" />
              </g>

              {/* Precision Tweezers (ملقط صيانة دقيق) - Left */}
              <g transform="translate(130, 240) rotate(-15)">
                <path d="M 0 0 C 15 50 10 120 2 170 L 6 170 C 20 120 25 50 12 0 Z" fill="#64748b" stroke="#cbd5e1" strokeWidth="1" />
                <path d="M 22 0 C 12 50 12 120 4 170 L 6 170 C 18 120 20 50 30 0 Z" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
              </g>

              {/* Soldering Iron with Heat Glow (كاوية لحام متوهجة) - Right */}
              <g transform="translate(680, 240) rotate(-35)">
                {/* Rubber Grip */}
                <rect x="0" y="0" width="22" height="120" rx="6" fill="#1e293b" stroke="#06b6d4" strokeWidth="1.5" />
                <rect x="4" y="20" width="14" height="80" rx="3" fill="#0f172a" />
                {/* Steel Barrel */}
                <rect x="7" y="120" width="8" height="60" fill="#cbd5e1" />
                {/* Hot Tip with Thermal Glow */}
                <polygon points="7,180 15,180 11,200" fill="url(#solderHeatGrad)" filter="url(#glowRed)" />
              </g>
            </g>

            {/* 4. Accounting Financial Charts & POS Metrics - Background Right */}
            <g id="data-bars-group">
              <line x1="530" y1="360" x2="710" y2="360" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
              <line x1="530" y1="300" x2="710" y2="300" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
              <line x1="530" y1="240" x2="710" y2="240" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
              <line x1="530" y1="180" x2="710" y2="180" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />

              {/* Bar 1 - Gold */}
              <rect x="545" y="220" width="26" height="140" rx="6" fill="url(#barGrad1)" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="558" y="210" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">85%</text>

              {/* Bar 2 - Cyan */}
              <rect x="585" y="160" width="26" height="200" rx="6" fill="url(#barGrad2)" stroke="#06b6d4" strokeWidth="1.5" />
              <text x="598" y="150" fill="#06b6d4" fontSize="10" fontWeight="bold" textAnchor="middle">98%</text>

              {/* Bar 3 - Emerald */}
              <rect x="625" y="260" width="26" height="100" rx="6" fill="url(#barGrad3)" stroke="#10b981" strokeWidth="1.5" />
              <text x="638" y="250" fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle">62%</text>

              {/* Bar 4 - Gold Tall */}
              <rect x="665" y="120" width="26" height="240" rx="6" fill="url(#barGrad1)" stroke="#f59e0b" strokeWidth="2" filter="url(#glowGold)" />
              <text x="678" y="110" fill="#fbbf24" fontSize="11" fontWeight="black" textAnchor="middle">100%</text>

              {/* Trend Line overlay */}
              <path d="M 558 220 L 598 160 L 638 260 L 678 120" fill="none" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="678" cy="120" r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
            </g>

            {/* 5. Mobile Phone Accessories (سماعات رأس، حافطة شاحن سريع، كابل) */}
            <g id="accessories-group">
              <path d="M 130 320 Q 130 190 210 190 Q 290 190 290 320" fill="none" stroke="#475569" strokeWidth="10" strokeLinecap="round" />
              <path d="M 130 320 Q 130 190 210 190 Q 290 190 290 320" fill="none" stroke="url(#goldGrad)" strokeWidth="3" strokeLinecap="round" />
              
              {/* Left Earcup */}
              <rect x="112" y="300" width="32" height="60" rx="12" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
              <rect x="117" y="310" width="8" height="40" rx="4" fill="#334155" />

              {/* Right Earcup */}
              <rect x="276" y="300" width="32" height="60" rx="12" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
              <rect x="294" y="310" width="8" height="40" rx="4" fill="#334155" />

              {/* Fast Charger Adapter (شاحن سريع) */}
              <g transform="translate(60, 390)">
                <rect x="0" y="0" width="48" height="38" rx="8" fill="#1e293b" stroke="#06b6d4" strokeWidth="1.5" />
                <rect x="-10" y="10" width="10" height="5" fill="#94a3b8" rx="2" />
                <rect x="-10" y="23" width="10" height="5" fill="#94a3b8" rx="2" />
                <rect x="34" y="14" width="8" height="10" rx="3" fill="#06b6d4" filter="url(#glowCyan)" />
              </g>

              {/* Curved Fast Charging Cable */}
              <path d="M 102 400 Q 140 425 180 405 Q 220 385 240 395" fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" filter="url(#glowCyan)" />
            </g>

            {/* 6. Main Modern Smartphone 1 (Front & Center) showing "Jam System Pro" */}
            <g id="phone-main-group" transform="translate(250, 75)">
              <rect x="-5" y="-5" width="190" height="370" rx="35" fill="url(#goldGrad)" opacity="0.3" filter="url(#glowGold)" />
              <rect x="0" y="0" width="180" height="360" rx="32" fill="url(#phoneGrad)" stroke="url(#goldGrad)" strokeWidth="3" />
              <rect x="8" y="8" width="164" height="344" rx="26" fill="url(#phoneScreenGrad)" stroke="#1e293b" strokeWidth="2" />

              {/* Dynamic Island Notch */}
              <rect x="62" y="16" width="56" height="14" rx="7" fill="#020617" stroke="#334155" strokeWidth="1" />
              <circle cx="74" cy="23" r="3" fill="#1e293b" />
              <circle cx="104" cy="23" r="2.5" fill="#06b6d4" />

              {/* SCREEN CONTENT: JAM SYSTEM PRO BRANDING */}
              <text x="24" y="26" fill="#94a3b8" fontSize="8" fontWeight="bold">10:56</text>
              <path d="M 140 22 L 152 22 L 152 28 L 140 28 Z" fill="none" stroke="#10b981" strokeWidth="1" />
              <rect x="142" y="24" width="8" height="2" fill="#10b981" />

              <circle cx="90" cy="108" r="38" fill="url(#goldGrad)" opacity="0.2" filter="url(#glowGold)" />
              <circle cx="90" cy="108" r="30" fill="#0b1329" stroke="url(#goldGrad)" strokeWidth="2" />

              <image href={SYSTEM_LOGO} x="68" y="86" width="44" height="44" />

              <text x="90" y="168" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle" letterSpacing="0.5">
                JAM SYSTEM PRO
              </text>
              
              <text x="90" y="185" fill="#f59e0b" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                محلات الجوالات والصيانة والمستلزمات 👑
              </text>

              <rect x="22" y="202" width="136" height="38" rx="10" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="32" y="218" fill="#94a3b8" fontSize="8" fontWeight="bold">إجمالي مبيعات الجوالات والصيانة:</text>
              <text x="32" y="232" fill="#10b981" fontSize="11" fontWeight="black">3,850,000 ر.ي</text>
              <circle cx="140" cy="221" r="8" fill="#10b981" opacity="0.2" />
              <path d="M 136 223 L 140 218 L 144 223" fill="none" stroke="#10b981" strokeWidth="1.5" />

              <rect x="22" y="248" width="136" height="34" rx="10" fill="url(#goldGrad)" opacity="0.9" />
              <text x="90" y="269" fill="#090d16" fontSize="10" fontWeight="extrabold" textAnchor="middle">
                دخول النظام السحابي ⚡
              </text>

              <rect x="22" y="290" width="42" height="24" rx="6" fill="#1e293b" />
              <text x="43" y="305" fill="#38bdf8" fontSize="7" fontWeight="bold" textAnchor="middle">مزامنة ✓</text>

              <rect x="69" y="290" width="42" height="24" rx="6" fill="#1e293b" />
              <text x="90" y="305" fill="#f59e0b" fontSize="7" fontWeight="bold" textAnchor="middle">صيانة 🛠️</text>

              <rect x="116" y="290" width="42" height="24" rx="6" fill="#1e293b" />
              <text x="137" y="305" fill="#a855f7" fontSize="7" fontWeight="bold" textAnchor="middle">جملة 📦</text>

              <rect x="60" y="338" width="60" height="4" rx="2" fill="#64748b" />
            </g>

            {/* 7. Secondary Smartphone 2 (Left Tilted) */}
            <g id="phone-secondary-group" transform="translate(170, 125) rotate(-14)">
              <rect x="0" y="0" width="115" height="235" rx="20" fill="url(#phoneGrad)" stroke="#475569" strokeWidth="2" />
              <rect x="6" y="6" width="103" height="223" rx="16" fill="#090d16" />
              <rect x="14" y="28" width="87" height="60" rx="8" fill="#1e293b" stroke="#06b6d4" strokeWidth="1" />
              <text x="57" y="52" fill="#38bdf8" fontSize="7.5" fontWeight="bold" textAnchor="middle">قطع الغيار والصيانة</text>
              <text x="57" y="68" fill="#ffffff" fontSize="8.5" fontWeight="black" textAnchor="middle">VIP Service</text>
            </g>
          </svg>
        </div>

        {/* Bottom Feature Badges */}
        {!compact && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full pt-1">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-center space-y-0.5">
              <span className="text-base block">📱</span>
              <span className="text-[10px] font-black text-amber-300 block">جوالات وإكسسوارات</span>
              <span className="text-[9px] text-gray-400">مبيعات وتنوع المخزن</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-center space-y-0.5">
              <span className="text-base block">🛠️</span>
              <span className="text-[10px] font-black text-cyan-300 block">عدة وقطع الصيانة</span>
              <span className="text-[9px] text-gray-400">تتبع المهندسين والقطع</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-center space-y-0.5">
              <span className="text-base block">📊</span>
              <span className="text-[10px] font-black text-emerald-300 block">حسابات وأرباح POS</span>
              <span className="text-[9px] text-gray-400">تقارير ودفعات لحظية</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-center space-y-0.5">
              <span className="text-base block">☁️</span>
              <span className="text-[10px] font-black text-purple-300 block">ربط سحابي أوفلاين</span>
              <span className="text-[9px] text-gray-400">مزامنة فورية ودقيقة</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
