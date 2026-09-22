import React from 'react';
import { Link } from 'react-router-dom';
import { preloadRoute } from '../services/routePreloader';

export const sidebarLuxuryStyles = {
  panelBg: '#090d16',
  borderColor: 'rgba(255, 255, 255, 0.05)',
  activeItemBg: 'rgba(212, 175, 55, 0.07)',
  goldGradientText: {
    color: '#ffd700',
    fontWeight: '800' as const
  }
};

interface JamSidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  hasNotification?: boolean;
  notifCount?: number;
  currentFontSize: number;
  iconColor?: string;
  onClick?: () => void;
  to?: string;
}

export const JamSidebarItemRender: React.FC<JamSidebarItemProps> = ({
  icon,
  label,
  isActive,
  hasNotification,
  notifCount,
  currentFontSize,
  iconColor = 'text-amber-400',
  onClick,
  to
}) => {
  const handlePreload = () => {
    if (to) {
      preloadRoute(to);
    }
  };

  const content = (
    <div
      onClick={to ? undefined : onClick}
      onMouseEnter={handlePreload}
      onTouchStart={handlePreload}
      onFocus={handlePreload}
      className={`group/item relative flex items-center justify-start py-1.5 px-2.5 md:py-2 md:px-3 mx-1 my-0.5 rounded-xl transition-all duration-150 ease-out select-none cursor-pointer overflow-hidden ${
        isActive 
          ? 'bg-gradient-to-r from-amber-500/30 via-amber-500/15 to-amber-950/20 text-amber-300 font-black border-r-4 border-amber-400 shadow-[0_0_22px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/30' 
          : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border-r-4 border-transparent hover:border-amber-400/40'
      }`}
    >
      {/* Active Indicator Glow Pillar */}
      {isActive && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-amber-400 rounded-l-full shadow-[0_0_10px_#f59e0b]" />
      )}

      {/* 💡 Ambient Backlight Glow Effect behind each item label */}
      <div 
        className={`absolute inset-0 rounded-xl transition-opacity duration-200 pointer-events-none ${
          isActive 
            ? 'bg-gradient-to-r from-amber-400/25 via-yellow-500/15 to-transparent opacity-100' 
            : 'group-hover/item:bg-gradient-to-r group-hover/item:from-amber-500/10 group-hover/item:to-transparent opacity-0 group-hover/item:opacity-100'
        }`}
      />

      {/* Icon with glowing backdrop and distinct section color */}
      <div 
        className={`relative z-10 flex items-center justify-center ml-2.5 transition-all duration-150 ease-out shrink-0 ${
          isActive 
            ? 'text-amber-300 scale-110 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]' 
            : `${iconColor} group-hover/item:scale-110 group-hover/item:brightness-125`
        }`}
      >
        {React.cloneElement(icon as React.ReactElement, { size: Math.max(16, currentFontSize + 2) })}
      </div>

      {/* Item Name Label */}
      <span 
        className={`relative z-10 font-sans tracking-tight text-xs sm:text-[13px] md:text-[13.5px] truncate transition-all duration-150 ${
          isActive 
            ? 'font-black text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' 
            : 'font-extrabold text-slate-300 group-hover/item:text-white'
        }`}
      >
        {label}
      </span>

      {/* Real-time notification badge */}
      {hasNotification && (
        <div className="relative z-10 mr-auto flex items-center justify-center min-w-[18px] h-[18px] bg-gradient-to-r from-red-600 to-amber-500 text-white text-[9px] font-mono font-black px-1.5 rounded-full shadow-lg shadow-red-500/30 shrink-0 animate-pulse border border-white/20">
          {notifCount && notifCount > 0 ? notifCount : '●'}
        </div>
      )}
      {!hasNotification && isActive && (
        <div className="relative z-10 mr-auto flex items-center gap-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm shrink-0">
          <span>مفعل</span>
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link 
        to={to} 
        onClick={onClick} 
        onMouseEnter={handlePreload}
        onTouchStart={handlePreload}
        onFocus={handlePreload}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        {content}
      </Link>
    );
  }

  return content;
};
