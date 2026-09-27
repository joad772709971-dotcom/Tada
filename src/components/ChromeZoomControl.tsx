import React from 'react';
import { 
  Minus, 
  Plus, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2 
} from 'lucide-react';

interface ChromeZoomControlProps {
  fontSize: number;
  onFontSizeChange: (newSize: number) => void;
  min?: number;
  max?: number;
  defaultSize?: number;
}

export default function ChromeZoomControl({
  fontSize,
  onFontSizeChange,
  min = 9,
  max = 24,
  defaultSize = 13
}: ChromeZoomControlProps) {
  
  // Calculate percentage relative to default baseline (13px = 100%)
  const zoomPercentage = Math.round((fontSize / defaultSize) * 100);

  const handleZoomOut = () => {
    const nextSize = Math.max(fontSize - 1, min);
    onFontSizeChange(nextSize);
  };

  const handleZoomIn = () => {
    const nextSize = Math.min(fontSize + 1, max);
    onFontSizeChange(nextSize);
  };

  const handleResetZoom = () => {
    onFontSizeChange(defaultSize);
  };

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  };

  return (
    <div className="p-2.5 bg-navy-950/80 dark:bg-black/50 rounded-2xl border border-white/10 shadow-lg select-none" dir="rtl">
      {/* Header with Title & Fullscreen toggle */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <ZoomIn size={13} className="text-[#d4af37]" />
          <span className="text-[10px] font-black text-gray-200 tracking-wide">تكبير وتصغير العرض</span>
        </div>
        <button
          type="button"
          onClick={handleFullscreenToggle}
          title="ملء الشاشة بالكامل (Fullscreen)"
          className="p-1 rounded-md text-gray-400 hover:text-amber-400 hover:bg-white/5 transition-all cursor-pointer"
        >
          <Maximize2 size={12} />
        </button>
      </div>

      {/* Chrome Style Compact Zoom Pill Button Group */}
      <div className="flex items-center justify-between bg-black/60 rounded-xl border border-white/10 p-1">
        {/* Zoom Out Button (-) */}
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={fontSize <= min}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          title="تصغير الخط والعرض (-)"
        >
          <Minus size={14} className="stroke-[2.5]" />
        </button>

        {/* Center Percentage Display & Click-to-Reset */}
        <button
          type="button"
          onClick={handleResetZoom}
          title="إعادة ضبط الحجم الأصلي (100%)"
          className="flex-1 px-2 py-1 flex items-center justify-center gap-1 hover:bg-white/5 rounded-md transition-all group cursor-pointer"
        >
          <span className="font-mono font-black text-xs text-amber-400 group-hover:text-amber-300">
            {zoomPercentage}%
          </span>
          {zoomPercentage !== 100 && (
            <RotateCcw size={10} className="text-gray-400 group-hover:text-white transition-colors" />
          )}
        </button>

        {/* Zoom In Button (+) */}
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={fontSize >= max}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-tr from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 shadow-md active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer font-black"
          title="تكبير الخط والعرض (+)"
        >
          <Plus size={14} className="stroke-[3]" />
        </button>
      </div>

      {/* Fine-Tuning Mini Slider */}
      <div className="mt-2 px-1">
        <input 
          type="range" 
          min={min} 
          max={max} 
          value={fontSize} 
          onChange={(e) => onFontSizeChange(Number(e.target.value))}
          className="w-full accent-[#d4af37] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
          title={`حجم الخط الفعلي: ${fontSize}px`}
        />
      </div>
    </div>
  );
}
