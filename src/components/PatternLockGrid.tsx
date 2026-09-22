import React from 'react';

interface PatternLockGridProps {
  value: string; // e.g. "1-4-7-8"
  onChange?: (newValue: string) => void;
  readOnly?: boolean;
}

export const PatternLockGrid: React.FC<PatternLockGridProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const points = value ? value.split('-').map(Number).filter(n => n >= 1 && n <= 9) : [];

  // Coordinate mapping for a 3x3 grid centered at 20%, 50%, 80%
  const getCoordinates = (num: number) => {
    const col = (num - 1) % 3;
    const row = Math.floor((num - 1) / 3);
    return {
      x: 20 + col * 30, // 20%, 50%, 80%
      y: 20 + row * 30, // 20%, 50%, 80%
    };
  };

  const handleDotClick = (num: number) => {
    if (readOnly || !onChange) return;

    if (points.includes(num)) {
      // If the clicked dot is already the last dot, remove it (undo)
      if (points[points.length - 1] === num) {
        const newPoints = points.slice(0, -1);
        onChange(newPoints.join('-'));
      } else {
        // Clear pattern to restart if they click an intermediate dot
        onChange(num.toString());
      }
    } else {
      // Add dot to sequence
      const newPoints = [...points, num];
      onChange(newPoints.join('-'));
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange) onChange('');
  };

  // Render SVG lines between consecutive points
  const renderLines = () => {
    const lines: React.ReactNode[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const from = getCoordinates(points[i]);
      const to = getCoordinates(points[i + 1]);
      
      // Determine line color (gradient effect or active color)
      const color = i === 0 ? '#10b981' : i === points.length - 2 ? '#ef4444' : '#f59e0b';

      lines.push(
        <line
          key={`line-${i}`}
          x1={`${from.x}%`}
          y1={`${from.y}%`}
          x2={`${to.x}%`}
          y2={`${to.y}%`}
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.9"
        />
      );

      // Add small directional arrow along the line
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);

      lines.push(
        <polygon
          key={`arrow-${i}`}
          points={`${midX},${midY - 2.5} ${midX + 4},${midY} ${midX},${midY + 2.5}`}
          transform={`rotate(${angle} ${midX} ${midY})`}
          fill={color}
          opacity="0.95"
        />
      );
    }
    return lines;
  };

  return (
    <div className="flex flex-col items-center justify-center p-2.5 bg-slate-900/60 dark:bg-navy-950/80 border border-slate-700/60 dark:border-white/10 rounded-2xl max-w-[210px] mx-auto shadow-inner">
      <div className="relative w-44 h-44 select-none">
        {/* SVG Drawing Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {renderLines()}
        </svg>

        {/* 9-Dot Layout Grid with Generous Spacing */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-3 p-3 z-20">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
            const isSelected = points.includes(num);
            const index = points.indexOf(num);
            const isStart = isSelected && index === 0;
            const isEnd = isSelected && index === points.length - 1 && points.length > 1;

            let dotClass = 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-600/50 shadow-sm';
            if (isStart) {
              dotClass = 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50 ring-4 ring-emerald-500/20 border border-emerald-400 scale-105';
            } else if (isEnd) {
              dotClass = 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 ring-4 ring-rose-500/20 border border-rose-400 scale-105';
            } else if (isSelected) {
              dotClass = 'bg-amber-500 text-black shadow-md shadow-amber-500/40 border border-amber-400 font-black scale-105';
            }

            return (
              <div key={num} className="flex items-center justify-center w-full h-full">
                <button
                  type="button"
                  onClick={() => handleDotClick(num)}
                  disabled={readOnly}
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-[11px] font-black transition-all duration-200 ${dotClass} ${readOnly ? 'cursor-default' : 'cursor-pointer active:scale-90 hover:scale-105'}`}
                  title={`نقطة رقم ${num}`}
                >
                  {/* Number or Start/End indicator */}
                  {isSelected ? (
                    <span>
                      {isStart ? '●' : isEnd ? '■' : index + 1}
                    </span>
                  ) : (
                    <div className="w-2.5 h-2.5 bg-slate-400/50 rounded-full group-hover:bg-slate-300" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {!readOnly && (
        <div className="mt-2 flex justify-between items-center w-full px-1.5 gap-2 border-t border-slate-800 pt-1.5 text-[10px]">
          <span className="text-slate-400 truncate">
            {points.length > 0 ? (
              <span className="text-amber-400 font-bold">النقش: {points.join(' ➔ ')}</span>
            ) : (
              'ارسم النقش بالضغط على النقاط'
            )}
          </span>
          {points.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="text-rose-400 hover:text-rose-300 font-black px-1 py-0.5 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              مسح
            </button>
          )}
        </div>
      )}
    </div>
  );
};

