import React, { ReactNode } from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string | ReactNode;
  loading?: boolean;
  error?: boolean;
  currency?: string;
  colorTheme?: 'emerald' | 'amber' | 'blue' | 'indigo' | 'rose' | 'slate' | 'gold';
  onClick?: () => void;
  id?: string;
}

export const formatNumberWithCommas = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null) return '0';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US');
};

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  description,
  loading = false,
  error = false,
  currency = 'ر.ي',
  colorTheme = 'slate',
  onClick,
  id
}) => {
  // Map color themes to Tailwind CSS classes
  const themeClasses = {
    emerald: {
      bg: 'hover:bg-emerald-500/[0.02]',
      border: 'hover:border-emerald-500/40',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      valueColor: 'text-emerald-600 dark:text-emerald-400'
    },
    amber: {
      bg: 'hover:bg-amber-500/[0.02]',
      border: 'hover:border-amber-500/40',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      valueColor: 'text-amber-600 dark:text-amber-400'
    },
    blue: {
      bg: 'hover:bg-blue-500/[0.02]',
      border: 'hover:border-blue-500/40',
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      valueColor: 'text-blue-600 dark:text-blue-400'
    },
    indigo: {
      bg: 'hover:bg-indigo-500/[0.02]',
      border: 'hover:border-indigo-500/40',
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      valueColor: 'text-indigo-600 dark:text-indigo-400'
    },
    rose: {
      bg: 'hover:bg-rose-500/[0.02]',
      border: 'hover:border-rose-500/40',
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      valueColor: 'text-rose-600 dark:text-rose-400'
    },
    gold: {
      bg: 'hover:bg-[#cf8a3c]/[0.02]',
      border: 'hover:border-[#cf8a3c]/40',
      iconBg: 'bg-[#cf8a3c]/10 text-[#cf8a3c]',
      valueColor: 'text-[#cf8a3c]'
    },
    slate: {
      bg: 'hover:bg-slate-500/[0.02]',
      border: 'hover:border-slate-500/40',
      iconBg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
      valueColor: 'text-slate-800 dark:text-slate-100'
    }
  };

  const selectedTheme = themeClasses[colorTheme] || themeClasses.slate;

  // Render Skeleton Loading State
  if (loading) {
    return (
      <div 
        id={id}
        className="bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-white/10 p-5 rounded-[1.8rem] animate-pulse text-right flex flex-col justify-between h-[135px]"
      >
        <div className="flex justify-between items-start">
          <div className="space-y-2.5 flex-1">
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full w-1/2" />
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4 mt-2" />
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-px bg-slate-100 dark:bg-white/5 my-2" />
        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full w-2/3" />
      </div>
    );
  }

  // Render Error / Empty Fallback State
  if (error) {
    return (
      <div 
        id={id}
        className="bg-white dark:bg-slate-900/95 border border-red-200 dark:border-red-950/30 p-5 rounded-[1.8rem] text-right flex flex-col justify-between h-[135px]"
      >
        <div className="flex justify-between items-start">
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-black text-slate-400">{title}</span>
            <span className="text-xl font-mono font-black text-red-500 mt-2">—</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-500 flex items-center justify-center font-bold">
            ⚠️
          </div>
        </div>
        <div className="h-px bg-slate-100 dark:bg-white/5 my-2" />
        <span className="text-[10px] text-red-400 font-bold">فشل جلب البيانات</span>
      </div>
    );
  }

  const isNumericValue = typeof value === 'number' || !isNaN(Number(value));
  const displayValue = isNumericValue ? formatNumberWithCommas(value) : value;

  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={onClick}
      className={`bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 ${selectedTheme.bg} ${selectedTheme.border} transition-all duration-300 p-5 rounded-[1.8rem] relative overflow-hidden shadow-sm flex flex-col justify-between h-[135px] cursor-pointer`}
      dir="rtl"
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col text-right">
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-wider">
            {title}
          </span>
          <h4 className={`text-xl font-black ${selectedTheme.valueColor} font-mono mt-1`}>
            {displayValue}{' '}
            {currency && (
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                {currency}
              </span>
            )}
          </h4>
        </div>
        <div className={`w-10 h-10 rounded-xl ${selectedTheme.iconBg} flex items-center justify-center shadow-sm`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="h-px bg-slate-100 dark:bg-white/5 my-2" />
      <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        {description}
      </div>
    </motion.div>
  );
};
