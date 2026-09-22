import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  ChevronDown, 
  Check, 
  Sparkles, 
  Download, 
  X, 
  CheckCircle2, 
  HardDriveDownload 
} from 'lucide-react';
import { UniversalReportService, UniversalReportPayload } from '../services/UniversalReportService';

interface UniversalReportButtonProps {
  payload: UniversalReportPayload;
  buttonText?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'compact' | 'emerald';
  className?: string;
  showCountBadge?: boolean;
}

interface ExportToastData {
  title: string;
  filename: string;
  format: string;
  count: number;
}

export const UniversalReportButton: React.FC<UniversalReportButtonProps> = ({
  payload,
  buttonText = 'تصدير تقرير',
  variant = 'primary',
  className = '',
  showCountBadge = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [toastData, setToastData] = useState<ExportToastData | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show rich persistent toast for 10 seconds with manual dismiss
  const triggerExportToast = (format: string, ext: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    const safeTitle = payload.title || 'تقرير مالي';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${safeTitle.replace(/\s+/g, '_')}_${dateStr}.${ext}`;

    setToastData({
      title: safeTitle,
      filename,
      format,
      count: payload.data ? payload.data.length : 0
    });

    // Increased duration: 10 seconds before auto-dismiss
    toastTimeoutRef.current = setTimeout(() => {
      setToastData(null);
    }, 10000);
  };

  const dismissToast = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastData(null);
  };

  const handleExportExcel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExporting(true);
    setIsOpen(false);
    try {
      const success = await UniversalReportService.exportToExcel(payload);
      if (success) {
        setExportSuccess('تم تصدير الإكسل!');
        triggerExportToast('Excel (.xlsx)', 'xlsx');
        setTimeout(() => setExportSuccess(null), 4000);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExporting(true);
    setIsOpen(false);
    try {
      const success = await UniversalReportService.exportToCSV(payload);
      if (success) {
        setExportSuccess('تم تصدير CSV!');
        triggerExportToast('CSV (.csv)', 'csv');
        setTimeout(() => setExportSuccess(null), 4000);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    UniversalReportService.printReport(payload);
  };

  const recordCount = payload.data ? payload.data.length : 0;

  // Base button styles based on variant
  let btnClasses = 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 select-none ';
  if (variant === 'primary') {
    btnClasses += 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20';
  } else if (variant === 'emerald') {
    btnClasses += 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20';
  } else if (variant === 'secondary') {
    btnClasses += 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700';
  } else if (variant === 'outline') {
    btnClasses += 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50';
  } else if (variant === 'compact') {
    btnClasses = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 transition-all';
  }

  return (
    <div className={`relative inline-block text-right ${className}`} ref={dropdownRef} dir="rtl">
      <button
        type="button"
        id={`btn-report-${payload.title.replace(/\s+/g, '-')}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className={`${btnClasses} ${isExporting ? 'opacity-70 cursor-wait' : ''}`}
        title={`إصدار تقرير ${payload.title}`}
      >
        {exportSuccess ? (
          <>
            <Check className="w-4 h-4 text-emerald-300" />
            <span>{exportSuccess}</span>
          </>
        ) : (
          <>
            <FileSpreadsheet className="w-4 h-4" />
            <span>{buttonText}</span>
            {showCountBadge && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/20 text-white/90 font-mono">
                {recordCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              خيارات تقرير {payload.title}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              {recordCount > 0 ? `يتضمن ${recordCount} سجل حقيقي` : 'تقرير فوري معتمد (سجل 0)'}
            </div>
          </div>

          <div className="p-1 space-y-0.5">
            <button
              type="button"
              onClick={handleExportExcel}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="text-right flex-1">
                <div>تصدير إكسل Excel (.xlsx)</div>
                <div className="text-[10px] text-slate-400 font-normal">جدول مالي متكامل مع المجاميع</div>
              </div>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Printer className="w-4 h-4" />
              </div>
              <div className="text-right flex-1">
                <div>طباعة ومعاينة PDF</div>
                <div className="text-[10px] text-slate-400 font-normal">عرض ومستند رسمي جاهز للطباعة</div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-right flex-1">
                <div>ملف نصي CSV (UTF-8)</div>
                <div className="text-[10px] text-slate-400 font-normal">متوافق مع كل الأنظمة والجداول</div>
              </div>
            </button>
          </div>

          <div className="px-3 pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>متوافق بنسبة 100% مع الأندرويد والكمبيوتر</span>
          </div>
        </div>
      )}

      {/* Enhanced Persistent Export Toast with Download Indicator & Dismiss Button */}
      {toastData && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed bottom-6 right-6 z-[9999] max-w-md w-[calc(100vw-3rem)] bg-slate-950/95 text-white border border-emerald-500/40 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl p-4 animate-in fade-in slide-in-from-bottom-5 duration-300"
          dir="rtl"
        >
          {/* Top Progress bar showing download complete */}
          <div className="w-full bg-emerald-950/60 rounded-full h-1.5 mb-3 overflow-hidden border border-emerald-500/20">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full w-full shadow-sm shadow-emerald-400/50 animate-pulse" />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 size={22} className="text-emerald-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-white">اكتمل التنزيل بنجاح 🟢</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
                    100% مكتمل
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 font-mono font-medium truncate max-w-[240px]">
                  {toastData.filename}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 pt-0.5">
                  <span>الصيغة: <strong className="text-emerald-300">{toastData.format}</strong></span>
                  <span>•</span>
                  <span>البيانات: <strong className="text-white">{toastData.count} سجل</strong></span>
                </div>
              </div>
            </div>

            {/* Manual Dismiss Button */}
            <button
              type="button"
              onClick={dismissToast}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-all cursor-pointer shrink-0"
              title="إغلاق الإشعار (Dismiss)"
            >
              <X size={15} />
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-emerald-400/80 flex items-center gap-1">
              <HardDriveDownload size={12} />
              <span>تم حفظ الملف في مجلد التنزيلات (Downloads)</span>
            </span>
            <button
              type="button"
              onClick={dismissToast}
              className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-[11px] font-bold border border-emerald-500/40 transition-all cursor-pointer"
            >
              إغلاق (Dismiss)
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
