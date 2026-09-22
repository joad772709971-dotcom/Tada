import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Sun, 
  Moon, 
  ShoppingBasket, 
  Bell, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  LogOut, 
  Wifi, 
  Bluetooth, 
  KeyRound, 
  ChevronRight, 
  ChevronLeft, 
  Layers, 
  Info,
  Lock,
  Bot,
  Sparkles
} from 'lucide-react';
import { useFullscreen } from '../hooks/useFullscreen';
import { OfflineSyncStatusDock } from './OfflineSyncStatusDock';
import AboutSystemModal from './AboutSystemModal';
import { hardwareService } from '../services/hardwareService';

export interface JamUnifiedHeaderProps {
  storeName: string;
  userRole: 'SUPERADMIN' | 'MANAGER' | 'SALES_STAFF' | string;
  totalPendingTasks: number;
  onMasterBellClick: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onToggleOrdersDrawer: () => void;
  pendingOrdersCount: number;
  profile?: any;
  shopSettings?: any;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isOrdersDrawerOpen?: boolean;
  isJamPanelOpen?: boolean;
  currentPageTitle?: string;
  onLogout?: () => void;
  onSync?: () => void;
  onOpenKeyGen?: () => void;
  onOpenDailyShiftClose?: () => void;
  onOpenVariantsSelector?: () => void;
  onOpenSmartAccountant?: () => void;
}

export const JamLuxuryUnifiedHeader: React.FC<JamUnifiedHeaderProps> = ({
  storeName,
  userRole,
  totalPendingTasks,
  onMasterBellClick,
  isSidebarOpen,
  onToggleSidebar,
  isDark,
  onToggleTheme,
  onToggleOrdersDrawer,
  pendingOrdersCount,
  profile,
  shopSettings,
  isFullscreen: parentIsFullscreen,
  onToggleFullscreen,
  isOrdersDrawerOpen = false,
  isJamPanelOpen = false,
  currentPageTitle,
  onLogout,
  onSync,
  onOpenKeyGen,
  onOpenDailyShiftClose,
  onOpenVariantsSelector,
  onOpenSmartAccountant
}) => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const { isFullscreen: localIsFullscreen, toggleFullscreen: localToggleFullscreen } = useFullscreen();
  const [isSyncing, setIsSyncing] = useState(false);

  const isFullscreen = parentIsFullscreen !== undefined ? parentIsFullscreen : localIsFullscreen;

  // ----------------------------------------------------
  // Scrollable Actions Bar: Refs & Drag / Scroll State
  // ----------------------------------------------------
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const isDraggingRef = useRef(false);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Update scroll limits and arrows visibility
  const updateScrollIndicators = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollWidth, clientWidth, scrollLeft } = el;
    const overflow = scrollWidth > clientWidth + 4;
    setHasOverflow(overflow);

    if (!overflow) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScroll = scrollWidth - clientWidth;
    const absScroll = Math.abs(scrollLeft);

    setCanScrollLeft(absScroll < maxScroll - 4 || scrollLeft > 4);
    setCanScrollRight(absScroll > 4 || scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    updateScrollIndicators();
    el.addEventListener('scroll', updateScrollIndicators, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollIndicators();
      });
      resizeObserver.observe(el);
    }

    window.addEventListener('resize', updateScrollIndicators);

    return () => {
      el.removeEventListener('scroll', updateScrollIndicators);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [updateScrollIndicators]);

  // Mouse wheel horizontal scroll handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta !== 0) {
      el.scrollBy({
        left: delta,
        behavior: 'auto'
      });
      updateScrollIndicators();
    }
  };

  // Mouse drag-to-scroll handlers (Grab and Drag)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    isMouseDownRef.current = true;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftStartRef.current = el.scrollLeft;
    isDraggingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!isMouseDownRef.current || !el) return;

    const x = e.pageX - el.offsetLeft;
    const walk = x - startXRef.current;

    if (Math.abs(walk) > 5) {
      isDraggingRef.current = true;
      el.scrollLeft = scrollLeftStartRef.current - walk;
      updateScrollIndicators();
    }
  };

  const endDrag = () => {
    isMouseDownRef.current = false;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 60);
  };

  const handleCaptureClick = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // Smooth button scroll triggers
  const handleScrollByAmount = (amount: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({
      left: amount,
      behavior: 'smooth'
    });
    setTimeout(updateScrollIndicators, 200);
  };

  // ----------------------------------------------------
  // Hardware Notifications & Dynamic Per-Shop Badge State
  // ----------------------------------------------------
  const [hardwareToast, setHardwareToast] = useState<{ title: string; desc: string; type: 'bt' | 'wifi' | 'notif' | 'sync' } | null>(null);

  const showHardwareNotification = (title: string, desc: string, type: 'bt' | 'wifi' | 'notif' | 'sync') => {
    setHardwareToast({ title, desc, type });
    setTimeout(() => {
      setHardwareToast(prev => (prev?.title === title ? null : prev));
    }, 3500);
  };

  // Unique identifier for the currently active shop
  const currentShopId = profile?.ownerId || (profile as any)?.shopId || shopSettings?.shopId || shopSettings?.ownerId || profile?.uid || 'default_shop';

  // Per-shop seen counts for bell and sidebar notifications
  const [seenBellCount, setSeenBellCount] = useState<number>(() => {
    try {
      const v = localStorage.getItem(`jam_seen_bell_${currentShopId}`);
      return v !== null ? parseInt(v, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [seenSidebarCount, setSeenSidebarCount] = useState<number>(() => {
    try {
      const v = localStorage.getItem(`jam_seen_sidebar_${currentShopId}`);
      return v !== null ? parseInt(v, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Reload seen counts when shop changes
  useEffect(() => {
    try {
      const bSaved = localStorage.getItem(`jam_seen_bell_${currentShopId}`);
      setSeenBellCount(bSaved !== null ? parseInt(bSaved, 10) : 0);
      const sSaved = localStorage.getItem(`jam_seen_sidebar_${currentShopId}`);
      setSeenSidebarCount(sSaved !== null ? parseInt(sSaved, 10) : 0);
    } catch {}
  }, [currentShopId]);

  // When notifications panel opens, dismiss bell counter for this shop
  useEffect(() => {
    if (isJamPanelOpen && totalPendingTasks > 0) {
      setSeenBellCount(totalPendingTasks);
      try {
        localStorage.setItem(`jam_seen_bell_${currentShopId}`, String(totalPendingTasks));
      } catch {}
    }
  }, [isJamPanelOpen, totalPendingTasks, currentShopId]);

  // When sidebar opens, dismiss sidebar counter for this shop
  useEffect(() => {
    if (isSidebarOpen && totalPendingTasks > 0) {
      setSeenSidebarCount(totalPendingTasks);
      try {
        localStorage.setItem(`jam_seen_sidebar_${currentShopId}`, String(totalPendingTasks));
      } catch {}
    }
  }, [isSidebarOpen, totalPendingTasks, currentShopId]);

  // Synchronize downwards if notifications are read or cleared externally
  useEffect(() => {
    if (totalPendingTasks < seenBellCount) {
      setSeenBellCount(totalPendingTasks);
      try {
        localStorage.setItem(`jam_seen_bell_${currentShopId}`, String(totalPendingTasks));
      } catch {}
    }
    if (totalPendingTasks < seenSidebarCount) {
      setSeenSidebarCount(totalPendingTasks);
      try {
        localStorage.setItem(`jam_seen_sidebar_${currentShopId}`, String(totalPendingTasks));
      } catch {}
    }
  }, [totalPendingTasks, seenBellCount, seenSidebarCount, currentShopId]);

  // Effective badge counters (disappear immediately when opened)
  const effectiveBellCount = isJamPanelOpen ? 0 : Math.max(0, totalPendingTasks - seenBellCount);
  const effectiveSidebarCount = isSidebarOpen ? 0 : Math.max(0, totalPendingTasks - seenSidebarCount);

  const handleNotificationsClick = async () => {
    // Hide badge immediately upon opening
    setSeenBellCount(totalPendingTasks);
    try {
      localStorage.setItem(`jam_seen_bell_${currentShopId}`, String(totalPendingTasks));
    } catch {}
    try {
      await hardwareService.requestNotificationPermission();
    } catch (e) {
      console.warn('Notification permission note:', e);
    }
    onMasterBellClick();
  };

  const handleToggleSidebar = () => {
    // If opening sidebar, hide its badge immediately
    if (!isSidebarOpen) {
      setSeenSidebarCount(totalPendingTasks);
      try {
        localStorage.setItem(`jam_seen_sidebar_${currentShopId}`, String(totalPendingTasks));
      } catch {}
    }
    onToggleSidebar();
  };

  // Clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLocalSync = async () => {
    setIsSyncing(true);
    if (onSync) {
      try {
        await onSync();
      } catch (err) {
        console.warn('Sync callback error:', err);
      }
    }
    // Also trigger offline queue sync across the app
    window.dispatchEvent(new CustomEvent('app-trigger-sync'));
    setTimeout(() => {
      setIsSyncing(false);
    }, 600);
  };

  const toggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }
    localToggleFullscreen();
  };

  const getNormalizedRole = (role: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'superadmin') return 'SUPERADMIN';
    if (r === 'manager' || r === 'owner') return 'MANAGER';
    return 'SALES_STAFF';
  };

  const getRoleBadgeStyle = (role: string) => {
    const r = getNormalizedRole(role);
    if (r === 'SUPERADMIN') {
      return {
        background: isDark ? 'rgba(234, 179, 8, 0.12)' : 'rgba(234, 179, 8, 0.08)',
        border: '1px solid rgba(234, 179, 8, 0.35)',
        color: '#eab308'
      };
    } else if (r === 'MANAGER') {
      return {
        background: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 165, 233, 0.08)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        color: '#38bdf8'
      };
    } else {
      return {
        background: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(5, 150, 105, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        color: '#10b981'
      };
    }
  };

  const normalizedRole = getNormalizedRole(userRole);

  // ----------------------------------------------------
  // Uniform Styling Tokens for all Action Buttons
  // ----------------------------------------------------
  const baseBtn = "h-9 sm:h-10 rounded-xl transition-all duration-200 border flex items-center justify-center cursor-pointer active:scale-95 shrink-0 select-none shadow-sm focus:outline-none";
  const iconBtn = `${baseBtn} w-9 sm:w-10`;
  const textBtn = `${baseBtn} px-2.5 sm:px-3 text-xs font-black gap-1.5 whitespace-nowrap`;

  return (
    <header 
      id="jam-luxury-unified-header"
      className="w-full flex items-center justify-between px-2 sm:px-3 md:px-5 py-1 transition-all duration-200 select-none"
      style={{
        minHeight: '46px',
        background: isDark ? '#080c14' : '#ffffff',
        borderBottom: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
        zIndex: 100,
        position: 'relative',
        gap: '6px'
      }} 
      dir="rtl"
    >
      {/* ============================================================ */}
      {/* 1. Right Section: Store Branding, Role Badge & Sidebar Toggle */}
      {/* ============================================================ */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div className="flex flex-col justify-center">
          <span className="font-black gold-shimmer-topbar tracking-[0.2px] hover:brightness-110 text-xs sm:text-sm md:text-base line-clamp-1 max-w-[110px] sm:max-w-[160px] md:max-w-none">
            {storeName || 'JAM System Pro'}
          </span>
          <span className="text-[7px] md:text-[8px] uppercase font-black text-slate-500 tracking-wider">
            JAM SYSTEM PRO
          </span>
        </div>

        {/* Sidebar Open/Close Toggle Button (واضح ومميز مع شارة رقمية متغيرة) */}
        <button
          id="btn-toggle-sidebar"
          onClick={handleToggleSidebar}
          className={`flex items-center justify-center gap-1.5 h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl transition-all duration-200 cursor-pointer relative group border shadow-sm active:scale-95 shrink-0 select-none ${
            isSidebarOpen 
              ? 'bg-gradient-to-r from-amber-500/25 via-yellow-500/15 to-amber-600/25 text-amber-300 border-amber-400/50 hover:bg-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)]' 
              : isDark
                ? 'bg-slate-900/95 border-amber-500/30 text-amber-300 hover:border-amber-400 hover:text-white hover:bg-slate-800 shadow-sm'
                : 'bg-amber-50/90 border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400 shadow-sm'
          }`}
          title={isSidebarOpen ? 'إغلاق القائمة الجانبية ❮' : 'فتح القائمة الجانبية ❯'}
        >
          <div className="flex items-center gap-1.5 font-black text-xs">
            <span className="font-mono text-sm leading-none text-amber-400 font-bold">
              {isSidebarOpen ? '❮' : '❯'}
            </span>
            <Menu size={16} className="text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="hidden xs:inline-block font-black text-xs tracking-tight">
              القائمة
            </span>
          </div>

          {/* Dynamic per-shop notification counter on sidebar button */}
          {effectiveSidebarCount > 0 && !isSidebarOpen && (
            <span 
              id="sidebar-dynamic-notif-badge"
              className="absolute -top-1.5 -left-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-black min-w-[19px] h-[19px] rounded-full flex items-center justify-center px-1 shadow-md shadow-red-500/40 animate-pulse border-2 border-slate-900 z-30 ring-1 ring-red-400/40"
            >
              {effectiveSidebarCount > 99 ? '99+' : effectiveSidebarCount}
            </span>
          )}

          <div className="absolute top-full mt-2 right-0 hidden group-hover:flex flex-col items-center z-[150] pointer-events-none">
            <div className="w-1.5 h-1.5 bg-slate-950 border-l border-t border-amber-500/40 rotate-45 -mb-[4px] z-10" />
            <div className="bg-slate-950 text-white text-[9px] md:text-[10px] font-black rounded-lg px-2.5 py-1 shadow-lg border border-amber-500/40 whitespace-nowrap">
              {isSidebarOpen ? 'إغلاق القائمة الجانبية ❮' : 'فتح القائمة الجانبية ❯'}
              {effectiveSidebarCount > 0 && ` (${effectiveSidebarCount} جديد)`}
            </div>
          </div>
        </button>

        {/* Role Badge */}
        <div 
          className="hidden xs:flex items-center justify-center h-[20px] shrink-0"
          style={{
            ...getRoleBadgeStyle(userRole),
            borderRadius: '6px',
            padding: '2px 8px'
          }}
        >
          <span className="text-[9px] font-black tracking-wider font-mono">
            {normalizedRole}
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. Center Section: System Clock, Gregorian & Hijri Dates */}
      {/* ============================================================ */}
      <div className="hidden 2xl:flex items-center justify-center shrink-0">
        <div className={`flex items-center gap-2.5 py-1 px-3.5 rounded-xl border ${
          isDark 
            ? 'bg-slate-950/60 border-slate-800 text-slate-200 shadow-inner' 
            : 'bg-slate-50 border-slate-200 text-slate-800'
        }`} dir="rtl">
          <span className="font-black text-xs text-[#cf8a3c]">
            🕒 {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Aden' })}
          </span>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-2 text-[10px] opacity-90 font-medium">
            <span>📅 {new Intl.DateTimeFormat('ar-YE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Aden' }).format(currentTime)}</span>
            <span className="font-bold text-[#cf8a3c]">🕌 {new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Aden' }).format(currentTime)}</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. Left Section: REBUILT SCROLLABLE ACTION BUTTONS BAR       */}
      {/* ============================================================ */}
      <div className="relative flex items-center min-w-0 flex-1 justify-end">
        {/* Scroll Left Quick Arrow Indicator */}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => handleScrollByAmount(-180)}
            className={`hidden sm:flex items-center justify-center w-6 h-9 rounded-lg transition-all duration-150 shrink-0 z-10 mx-0.5 border ${
              isDark 
                ? 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            } shadow-sm cursor-pointer`}
            title="تمرير لليسار ◀"
          >
            <ChevronRight size={14} />
          </button>
        )}

        {/* Scrollable Track Container */}
        <div 
          ref={scrollContainerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onClickCapture={handleCaptureClick}
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto overflow-y-hidden py-1 px-1 custom-header-scroll select-none touch-pan-x flex-nowrap min-w-0 cursor-grab active:cursor-grabbing"
          style={{
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* [1] ⚡ Universal Offline Sync Status Dock */}
          <OfflineSyncStatusDock profile={profile} />

          {/* [1.5] 🤖 ✨ المحاسب الذكي - AI Smart Accountant Quick Control Button */}
          <button
            id="header-btn-smart-accountant"
            onClick={() => {
              if (onOpenSmartAccountant) {
                onOpenSmartAccountant();
              } else {
                window.dispatchEvent(new CustomEvent('open-smart-ai-accountant'));
              }
            }}
            className={`${textBtn} relative overflow-hidden bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 text-amber-500 dark:text-amber-300 border-amber-400/50 hover:border-amber-400 hover:shadow-[0_0_15px_rgba(245,158,11,0.35)] active:scale-95 group transition-all shrink-0`}
            title="المحاسب الذكي والمستشار المالي الفوري (نظام العزل والتحليلات المتقدمة) 🤖✨"
          >
            <Bot size={16} className="text-amber-500 dark:text-amber-300 shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-transform" />
            <Sparkles size={13} className="text-yellow-500 dark:text-yellow-300 animate-pulse shrink-0" />
            <span className="font-black tracking-tight text-amber-600 dark:text-amber-200">المحاسب الذكي</span>
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-amber-500/25 text-amber-700 dark:text-amber-200 border border-amber-500/30 shrink-0">
              AI PRO
            </span>
          </button>

          {/* [3] 🖥️ Fullscreen Toggle Button (زر ملء الشاشة) */}
          <button
            id="header-btn-fullscreen"
            onClick={toggleFullscreen}
            className={`${textBtn} ${
              isDark 
                ? 'bg-slate-900/90 border-slate-800 text-sky-400 hover:bg-slate-800 hover:border-sky-500/40' 
                : 'bg-white border-slate-200 text-sky-600 hover:bg-slate-50 hover:border-sky-300'
            }`}
            title={isFullscreen ? 'تصغير الشاشة 🗗' : 'ملء الشاشة 🗖'}
          >
            {isFullscreen ? (
              <Minimize2 size={15} className="shrink-0 text-sky-400" />
            ) : (
              <Maximize2 size={15} className="shrink-0 text-sky-400" />
            )}
            <span className="hidden sm:inline font-bold">
              {isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
            </span>
          </button>

          {/* [4] ☀️/🌙 Dark / Light Theme Mode Switcher */}
          {onToggleTheme && (
            <button
              id="header-btn-theme-toggle"
              onClick={onToggleTheme}
              className={`${iconBtn} ${
                isDark 
                  ? 'bg-slate-900/90 border-slate-800 text-amber-300 hover:bg-slate-800 hover:border-amber-400/40 hover:text-amber-200' 
                  : 'bg-white border-slate-200 text-amber-600 hover:bg-slate-50 hover:border-amber-400'
              }`}
              title={isDark ? 'التحويل إلى الوضع الفاتح ☀️' : 'التحويل إلى الوضع الليلي الفاخر 🌙'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}

          {/* [5] 🔒 Shift / Daily Register Close Button */}
          {onOpenDailyShiftClose && (
            <button
              id="header-btn-daily-shift"
              onClick={onOpenDailyShiftClose}
              className={`${textBtn} ${
                isDark
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-400/50'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="إغلاق اليومية والوردية وتسليم الصندوق 🔒"
            >
              <Lock size={14} className="text-amber-400 shrink-0" />
              <span className="hidden md:inline font-bold">إغلاق الوردية</span>
            </button>
          )}

          {/* [7] 🔑 B2B Key Generator Trigger */}
          {onOpenKeyGen && (
            <button
              id="header-btn-key-gen"
              onClick={onOpenKeyGen}
              className={`${textBtn} ${
                isDark 
                  ? 'bg-gradient-to-r from-amber-500/20 via-amber-600/15 to-amber-500/20 border-amber-500/40 text-amber-300 hover:border-amber-400' 
                  : 'bg-gradient-to-r from-amber-50 via-amber-100/50 to-amber-50 border-amber-600/30 text-amber-800 hover:border-amber-500'
              }`}
              title="توليد مفتاح ارتباط جديد أو تجديد الارتباط (B2B) 🔑"
            >
              <KeyRound size={15} className="text-amber-400 shrink-0" />
              <span className="hidden md:inline font-bold">مفاتيح الارتباط</span>
            </button>
          )}

          {/* [8] 👁️ Toggle Floating Action Dock Trigger */}
          <button
            id="header-btn-floating-dock"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('toggle-jam-floating-dock'));
            }}
            className={`${iconBtn} ${
              isDark 
                ? 'bg-slate-900/90 border-slate-800 text-amber-400 hover:bg-slate-800 hover:border-amber-500/50' 
                : 'bg-white border-slate-200 text-amber-600 hover:bg-slate-50'
            }`}
            title="إظهار / إخفاء الأزرار العائمة ومسرع المنظومة 👁️"
          >
            <Layers size={16} />
          </button>

          {/* [9] 🔄 Refresh & Cloud Data Sync Trigger */}
          <button
            id="header-btn-sync"
            onClick={handleLocalSync}
            className={`${iconBtn} ${
              isDark 
                ? 'bg-slate-900/90 border-slate-800 text-teal-400 hover:bg-slate-800 hover:border-teal-500/50' 
                : 'bg-white border-slate-200 text-teal-600 hover:bg-slate-50'
            }`}
            title="مزامنة وتحديث البيانات 🔄"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          </button>

          {/* [10] 🧺 Sales & Orders Basket Drawer Trigger */}
          <button
            id="header-btn-orders-drawer"
            onClick={onToggleOrdersDrawer}
            className={`relative ${iconBtn} ${
              isOrdersDrawerOpen
                ? 'bg-[#cf8a3c] border-[#cf8a3c] text-white font-bold shadow-md'
                : isDark 
                  ? 'bg-slate-900/90 border-slate-800 text-[#cf8a3c] hover:bg-slate-800 hover:border-amber-500/50' 
                  : 'bg-white border-slate-200 text-[#b87333] hover:bg-slate-50'
            }`}
            title="سلة المبيعات والطلبيات الجارية"
          >
            <ShoppingBasket size={16} />
            {pendingOrdersCount > 0 && (
              <span className="absolute -top-1 -left-1 bg-[#cf8a3c] text-slate-950 text-[9px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 shadow-md">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          {/* [11] 🔔 Notifications Bell & Master Hub Trigger (واضح ومميز مع شارة رقمية متغيرة) */}
          <button
            id="header-btn-notifications"
            onClick={handleNotificationsClick}
            className={`relative flex items-center justify-center gap-1.5 h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl transition-all duration-200 border cursor-pointer active:scale-95 shrink-0 select-none shadow-sm focus:outline-none ${
              isJamPanelOpen
                ? 'bg-amber-500 border-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                : isDark 
                  ? 'bg-slate-900/90 border-amber-500/40 text-amber-300 hover:bg-slate-800 hover:border-amber-400 hover:text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.15)]' 
                  : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 hover:border-amber-400'
            }`}
            title="الإشعارات والمركز الموحد للمحل 🔔"
          >
            <Bell size={16} className={`shrink-0 ${effectiveBellCount > 0 && !isJamPanelOpen ? "animate-bounce text-amber-400" : "text-amber-400/90"}`} />
            <span className="hidden md:inline font-black text-xs">
              الإشعارات
            </span>
            {effectiveBellCount > 0 && !isJamPanelOpen && (
              <span 
                id="header-dynamic-bell-badge"
                className="absolute -top-1.5 -left-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-black min-w-[19px] h-[19px] rounded-full flex items-center justify-center px-1 shadow-md shadow-red-500/40 animate-pulse border-2 border-slate-900 z-30 ring-1 ring-red-400/40"
              >
                {effectiveBellCount > 99 ? '99+' : effectiveBellCount}
              </span>
            )}
          </button>

          {/* [12] ℹ️ System Info / Overview Modal Trigger */}
          <button
            id="header-btn-about-system"
            onClick={() => setIsAboutModalOpen(true)}
            className={`${iconBtn} ${
              isDark 
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]' 
                : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
            }`}
            title="وصف النظام والمنظومة الذكية ℹ️"
          >
            <Info size={16} className="text-amber-400" />
          </button>

          {/* [13] 🚪 Official Logout Trigger */}
          {onLogout && (
            <button
              id="header-btn-logout"
              onClick={onLogout}
              className={`${iconBtn} ${
                isDark 
                  ? 'bg-slate-900/90 border-slate-800 text-rose-400 hover:bg-rose-950/30 hover:border-rose-500/50 hover:text-rose-300' 
                  : 'bg-white border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300'
              }`}
              title="تسجيل الخروج الرسمي 🚪"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>

        {/* Scroll Right Quick Arrow Indicator */}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => handleScrollByAmount(180)}
            className={`hidden sm:flex items-center justify-center w-6 h-9 rounded-lg transition-all duration-150 shrink-0 z-10 mx-0.5 border ${
              isDark 
                ? 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            } shadow-sm cursor-pointer`}
            title="تمرير لليمين ▶"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. Floating Hardware Toast Notification Pill                  */}
      {/* ============================================================ */}
      {hardwareToast && (
        <div 
          id="hardware-status-toast"
          className="absolute top-[calc(100%+8px)] left-4 z-[300] bg-slate-950/95 border border-amber-500/40 text-white rounded-2xl p-3 shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className={`p-2 rounded-xl text-slate-950 font-black ${
            hardwareToast.type === 'bt' ? 'bg-indigo-400' :
            hardwareToast.type === 'wifi' ? 'bg-emerald-400' : 'bg-amber-400'
          }`}>
            {hardwareToast.type === 'bt' ? <Bluetooth size={16} /> :
             hardwareToast.type === 'wifi' ? <Wifi size={16} /> : <Bell size={16} />}
          </div>
          <div className="text-right">
            <div className="text-xs font-black text-amber-300">{hardwareToast.title}</div>
            <div className="text-[11px] text-zinc-300 font-medium">{hardwareToast.desc}</div>
          </div>
          <button 
            onClick={() => setHardwareToast(null)} 
            className="text-zinc-500 hover:text-white p-1 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. About System Modal Component                               */}
      {/* ============================================================ */}
      <AboutSystemModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        isDark={isDark}
        currentStoreName={storeName}
      />
    </header>
  );
};
