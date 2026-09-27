import React from 'react';
import { APP_ICONS } from '../constants/appIcons';

interface JAMLogoSVGProps {
  className?: string;
  variant?: 'merchant' | 'customer';
}

export default function JAMLogoSVG({ className = "w-24 h-24", variant = 'merchant' }: JAMLogoSVGProps) {
  const iconData = variant === 'customer' ? APP_ICONS.customerVip : APP_ICONS.merchant;

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* 3D Official Store Pro Image */}
      <img 
        src={iconData.path} 
        alt={iconData.title} 
        className="w-full h-full object-contain filter drop-shadow-[0_15px_30px_rgba(0,240,255,0.25)] transition-all duration-300 hover:scale-105"
        onError={(e) => {
          // Fallback to embedded Base64 dataURI if network file is delayed
          e.currentTarget.src = iconData.dataUri;
        }}
      />
    </div>
  );
}
